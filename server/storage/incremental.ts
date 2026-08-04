import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { z } from 'zod'
import {
  GITHUB_CORE_QUERY_VERSION,
  GITHUB_CORE_REST_API_VERSION,
  type GithubCoreCheckpoint,
  type GithubCoreCheckpointTransition,
} from '../connectors/github/core.js'
import { CoverageRecordSchema } from '../../shared/coverage.js'
import { runStorageChecks } from './database.js'

export const INCREMENTAL_GITHUB_CORE_STORAGE_VERSION = '2.2.0' as const
export const INCREMENTAL_GITHUB_CORE_TABLES = [
  'collection_job',
  'collection_checkpoint',
  'source_snapshot',
  'coverage_ledger',
] as const

export type IncrementalGithubCoreTable = typeof INCREMENTAL_GITHUB_CORE_TABLES[number]

const INCREMENTAL_GITHUB_CORE_STORAGE_SQL = [
  'CREATE TABLE IF NOT EXISTS collection_job (',
  '  job_id TEXT PRIMARY KEY NOT NULL CHECK (length(job_id) BETWEEN 1 AND 128 AND job_id NOT GLOB \'*[^A-Za-z0-9:._-]*\'),',
  '  storage_contract_version TEXT NOT NULL CHECK (storage_contract_version = \'2.2.0\'),',
  '  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64 AND payload_hash NOT GLOB \'*[^0-9a-f]*\'),',
  '  capability_id TEXT NOT NULL CHECK (capability_id = \'github.core\'),',
  '  scope_alias TEXT NOT NULL CHECK (length(scope_alias) BETWEEN 1 AND 128 AND scope_alias NOT GLOB \'*[^A-Za-z0-9:._-]*\'),',
  '  query_version TEXT NOT NULL CHECK (query_version = \'github.core.v1\'),',
  '  source_api_version TEXT NOT NULL CHECK (source_api_version = \'2026-03-10\'),',
  '  consent_revision TEXT NOT NULL CHECK (length(consent_revision) BETWEEN 1 AND 128 AND consent_revision NOT GLOB \'*[^A-Za-z0-9:._-]*\'),',
  '  range_start TEXT NOT NULL,',
  '  range_end TEXT NOT NULL,',
  '  observed_at TEXT NOT NULL,',
  '  started_at TEXT NOT NULL,',
  '  completed_at TEXT NOT NULL,',
  '  status TEXT NOT NULL CHECK (status IN (\'complete\', \'truncated\', \'failed\', \'restricted\')),',
  '  UNIQUE (job_id, capability_id, scope_alias),',
  '  CHECK (range_start < range_end),',
  '  CHECK (started_at <= completed_at)',
  ') STRICT;',
  'CREATE TRIGGER IF NOT EXISTS collection_job_immutable_update',
  'BEFORE UPDATE ON collection_job',
  'BEGIN',
  '  SELECT RAISE(ABORT, \'COLLECTION_JOB_IMMUTABLE\');',
  'END;',
  'CREATE TABLE IF NOT EXISTS source_snapshot (',
  '  snapshot_id TEXT PRIMARY KEY NOT NULL CHECK (length(snapshot_id) BETWEEN 1 AND 128 AND snapshot_id NOT GLOB \'*[^A-Za-z0-9:._-]*\'),',
  '  job_id TEXT NOT NULL UNIQUE,',
  '  capability_id TEXT NOT NULL CHECK (capability_id = \'github.core\'),',
  '  scope_alias TEXT NOT NULL CHECK (length(scope_alias) BETWEEN 1 AND 128 AND scope_alias NOT GLOB \'*[^A-Za-z0-9:._-]*\'),',
  '  snapshot_hash TEXT NOT NULL CHECK (length(snapshot_hash) = 64 AND snapshot_hash NOT GLOB \'*[^0-9a-f]*\'),',
  '  range_start TEXT NOT NULL,',
  '  range_end TEXT NOT NULL,',
  '  observed_at TEXT NOT NULL,',
  '  UNIQUE (snapshot_id, capability_id, scope_alias),',
  '  FOREIGN KEY (job_id, capability_id, scope_alias) REFERENCES collection_job(job_id, capability_id, scope_alias) ON DELETE CASCADE,',
  '  CHECK (range_start < range_end)',
  ') STRICT;',
  'CREATE TRIGGER IF NOT EXISTS source_snapshot_complete_job',
  'BEFORE INSERT ON source_snapshot',
  'BEGIN',
  '  SELECT CASE WHEN NOT EXISTS (',
  '    SELECT 1 FROM collection_job',
  '    WHERE job_id = NEW.job_id AND status = \'complete\'',
  '      AND capability_id = NEW.capability_id AND scope_alias = NEW.scope_alias',
  '  ) THEN RAISE(ABORT, \'SOURCE_SNAPSHOT_JOB_MISMATCH\') END;',
  'END;',
  'CREATE TABLE IF NOT EXISTS coverage_ledger (',
  '  coverage_id TEXT NOT NULL CHECK (length(coverage_id) BETWEEN 1 AND 256 AND coverage_id NOT GLOB \'*[^A-Za-z0-9:._-]*\'),',
  '  range_start TEXT NOT NULL,',
  '  job_id TEXT NOT NULL UNIQUE,',
  '  snapshot_id TEXT,',
  '  capability_id TEXT NOT NULL CHECK (capability_id = \'github.core\'),',
  '  scope_alias TEXT NOT NULL CHECK (length(scope_alias) BETWEEN 1 AND 128 AND scope_alias NOT GLOB \'*[^A-Za-z0-9:._-]*\'),',
  '  range_end TEXT NOT NULL,',
  '  status TEXT NOT NULL CHECK (status IN (\'complete\', \'truncated\', \'failed\', \'restricted\')),',
  '  expected_units INTEGER CHECK (expected_units IS NULL OR expected_units >= 0),',
  '  observed_units INTEGER NOT NULL CHECK (observed_units >= 0),',
  '  omitted_units INTEGER CHECK (omitted_units IS NULL OR omitted_units >= 0),',
  '  saturation_reason TEXT CHECK (saturation_reason IS NULL OR (length(saturation_reason) BETWEEN 1 AND 64 AND saturation_reason NOT GLOB \'*[^A-Z0-9_]*\')),',
  '  retryable INTEGER NOT NULL CHECK (retryable IN (0, 1)),',
  '  observed_at TEXT NOT NULL,',
  '  limitation_code TEXT NOT NULL CHECK (length(limitation_code) BETWEEN 1 AND 64 AND limitation_code NOT GLOB \'*[^A-Z0-9_]*\'),',
  '  PRIMARY KEY (coverage_id, range_start, job_id),',
  '  FOREIGN KEY (job_id, capability_id, scope_alias) REFERENCES collection_job(job_id, capability_id, scope_alias) ON DELETE CASCADE,',
  '  FOREIGN KEY (snapshot_id, capability_id, scope_alias) REFERENCES source_snapshot(snapshot_id, capability_id, scope_alias) ON DELETE CASCADE,',
  '  CHECK (range_start < range_end),',
  '  CHECK ((status = \'complete\' AND snapshot_id IS NOT NULL) OR (status != \'complete\' AND snapshot_id IS NULL))',
  ') STRICT;',
  'CREATE TRIGGER IF NOT EXISTS coverage_ledger_job_match',
  'BEFORE INSERT ON coverage_ledger',
  'BEGIN',
  '  SELECT CASE WHEN NOT EXISTS (',
  '    SELECT 1 FROM collection_job',
  '    WHERE job_id = NEW.job_id AND status = NEW.status',
  '      AND capability_id = NEW.capability_id AND scope_alias = NEW.scope_alias',
  '  ) THEN RAISE(ABORT, \'COVERAGE_JOB_MISMATCH\') END;',
  'END;',
  'CREATE TABLE IF NOT EXISTS collection_checkpoint (',
  '  capability_id TEXT NOT NULL CHECK (capability_id = \'github.core\'),',
  '  scope_alias TEXT NOT NULL CHECK (length(scope_alias) BETWEEN 1 AND 128 AND scope_alias NOT GLOB \'*[^A-Za-z0-9:._-]*\'),',
  '  query_version TEXT NOT NULL CHECK (query_version = \'github.core.v1\'),',
  '  source_api_version TEXT NOT NULL CHECK (source_api_version = \'2026-03-10\'),',
  '  high_watermark TEXT,',
  '  cursor_hint TEXT CHECK (cursor_hint IS NULL OR (length(cursor_hint) BETWEEN 1 AND 128 AND cursor_hint NOT GLOB \'*[^A-Za-z0-9:._-]*\')),',
  '  bounded_overlap_start TEXT NOT NULL,',
  '  last_complete_snapshot_hash TEXT NOT NULL CHECK (length(last_complete_snapshot_hash) = 64 AND last_complete_snapshot_hash NOT GLOB \'*[^0-9a-f]*\'),',
  '  consent_revision TEXT NOT NULL CHECK (length(consent_revision) BETWEEN 1 AND 128 AND consent_revision NOT GLOB \'*[^A-Za-z0-9:._-]*\'),',
  '  committed_job_id TEXT NOT NULL UNIQUE,',
  '  source_snapshot_id TEXT NOT NULL UNIQUE,',
  '  PRIMARY KEY (capability_id, scope_alias),',
  '  FOREIGN KEY (committed_job_id, capability_id, scope_alias) REFERENCES collection_job(job_id, capability_id, scope_alias) ON DELETE CASCADE,',
  '  FOREIGN KEY (source_snapshot_id, capability_id, scope_alias) REFERENCES source_snapshot(snapshot_id, capability_id, scope_alias) ON DELETE CASCADE',
  ') STRICT;',
  'CREATE TRIGGER IF NOT EXISTS collection_checkpoint_complete_job_insert',
  'BEFORE INSERT ON collection_checkpoint',
  'BEGIN',
  '  SELECT CASE WHEN NOT EXISTS (',
  '    SELECT 1 FROM collection_job',
  '    WHERE job_id = NEW.committed_job_id AND status = \'complete\'',
  '      AND capability_id = NEW.capability_id AND scope_alias = NEW.scope_alias',
  '  ) THEN RAISE(ABORT, \'CHECKPOINT_JOB_MISMATCH\') END;',
  'END;',
  'CREATE TRIGGER IF NOT EXISTS collection_checkpoint_complete_job_update',
  'BEFORE UPDATE ON collection_checkpoint',
  'BEGIN',
  '  SELECT CASE WHEN NOT EXISTS (',
  '    SELECT 1 FROM collection_job',
  '    WHERE job_id = NEW.committed_job_id AND status = \'complete\'',
  '      AND capability_id = NEW.capability_id AND scope_alias = NEW.scope_alias',
  '  ) THEN RAISE(ABORT, \'CHECKPOINT_JOB_MISMATCH\') END;',
  'END;',
].join('\n')

interface IncrementalSchemaDefinition {
  readonly type: 'table' | 'trigger'
  readonly name: string
  readonly tableName: string
  readonly sql: string
}

interface IncrementalSchemaRow {
  readonly type: string
  readonly name: string
  readonly tbl_name: string
  readonly sql: string | null
}

function parseSchemaDefinitions(sql: string): IncrementalSchemaDefinition[] {
  const statements: string[] = []
  let current: string[] = []
  let trigger = false
  for (const line of sql.split('\n')) {
    const trimmed = line.trim()
    current.push(line)
    if (/^CREATE\s+TRIGGER\b/i.test(trimmed)) trigger = true
    if ((trigger && trimmed === 'END;') || (!trigger && trimmed.endsWith(';'))) {
      statements.push(current.join('\n'))
      current = []
      trigger = false
    }
  }
  if (current.length > 0) throw new Error('INCREMENTAL_STORAGE_SCHEMA_MISMATCH')

  return statements.map((statement) => {
    const match = statement.match(
      /^\s*CREATE\s+(TABLE|TRIGGER)\s+IF\s+NOT\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)/i,
    )
    if (!match) throw new Error('INCREMENTAL_STORAGE_SCHEMA_MISMATCH')
    const type = match[1].toLowerCase() as IncrementalSchemaDefinition['type']
    const name = match[2]
    const tableName = type === 'table'
      ? name
      : statement.match(/\bON\s+([A-Za-z_][A-Za-z0-9_]*)/i)?.[1]
    if (!tableName) throw new Error('INCREMENTAL_STORAGE_SCHEMA_MISMATCH')
    return { type, name, tableName, sql: statement }
  })
}

function normalizeSchemaSql(sql: string): string {
  return sql
    .replace(/\bIF\s+NOT\s+EXISTS\b/gi, '')
    .replace(/;\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const INCREMENTAL_GITHUB_CORE_SCHEMA_DEFINITIONS = parseSchemaDefinitions(
  INCREMENTAL_GITHUB_CORE_STORAGE_SQL,
)

function schemaFingerprint(rows: readonly IncrementalSchemaDefinition[] | readonly IncrementalSchemaRow[]): string {
  const canonical = rows
    .map((row) => {
      const tableName = 'tableName' in row ? row.tableName : row.tbl_name
      const sql = 'tableName' in row ? row.sql : row.sql ?? ''
      return [row.type, row.name, tableName, normalizeSchemaSql(sql)].join('|')
    })
    .sort()
    .join('\n')
  return createHash('sha256').update(canonical).digest('hex')
}

export const INCREMENTAL_GITHUB_CORE_STORAGE_SCHEMA_FINGERPRINT = schemaFingerprint(
  INCREMENTAL_GITHUB_CORE_SCHEMA_DEFINITIONS,
)

const INCREMENTAL_GITHUB_CORE_SCHEMA_NAMES = INCREMENTAL_GITHUB_CORE_SCHEMA_DEFINITIONS.map(
  ({ name }) => name,
)
const INCREMENTAL_GITHUB_CORE_SCHEMA_TABLE_NAMES = INCREMENTAL_GITHUB_CORE_SCHEMA_DEFINITIONS
  .filter(({ type }) => type === 'table')
  .map(({ name }) => name)

function readRelevantSchemaRows(
  db: Database.Database,
  catalog: 'sqlite_schema' | 'sqlite_temp_schema',
): IncrementalSchemaRow[] {
  const namePlaceholders = INCREMENTAL_GITHUB_CORE_SCHEMA_NAMES.map(() => '?').join(', ')
  const tablePlaceholders = INCREMENTAL_GITHUB_CORE_SCHEMA_TABLE_NAMES.map(() => '?').join(', ')
  return db.prepare(
    `SELECT type, name, tbl_name, sql FROM ${catalog}
     WHERE name IN (${namePlaceholders})
        OR (
          tbl_name IN (${tablePlaceholders})
          AND type IN ('index', 'trigger')
          AND name NOT GLOB 'sqlite_autoindex_*'
        )`,
  ).all(
    ...INCREMENTAL_GITHUB_CORE_SCHEMA_NAMES,
    ...INCREMENTAL_GITHUB_CORE_SCHEMA_TABLE_NAMES,
  ) as IncrementalSchemaRow[]
}

function readOwnedSchemaRows(db: Database.Database): IncrementalSchemaRow[] {
  return [
    ...readRelevantSchemaRows(db, 'sqlite_schema'),
    ...readRelevantSchemaRows(db, 'sqlite_temp_schema'),
  ]
}

function hasExpectedSchema(rows: readonly IncrementalSchemaRow[]): boolean {
  if (rows.length !== INCREMENTAL_GITHUB_CORE_SCHEMA_DEFINITIONS.length) return false
  const expected = new Map(
    INCREMENTAL_GITHUB_CORE_SCHEMA_DEFINITIONS.map((definition) => [definition.name, definition]),
  )
  return rows.every((row) => {
    const definition = expected.get(row.name)
    return definition !== undefined
      && row.type === definition.type
      && row.tbl_name === definition.tableName
      && row.sql !== null
      && normalizeSchemaSql(row.sql) === normalizeSchemaSql(definition.sql)
  })
}

export function readIncrementalGithubCoreStorageSchemaFingerprint(db: Database.Database): string {
  return schemaFingerprint(readOwnedSchemaRows(db))
}

const OpaqueIdSchema = z.string().regex(/^[A-Za-z0-9:._-]{1,128}$/)
const CoverageIdSchema = z.string().regex(/^[A-Za-z0-9:._-]{1,256}$/)
const LowercaseSha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const CanonicalTimestampSchema = z.string().datetime({ offset: true }).refine(
  (value) => new Date(value).toISOString() === value,
  'Timestamp must use canonical UTC form',
)

const CheckpointSchema = z.object({
  capabilityId: z.literal('github.core'),
  scopeAlias: OpaqueIdSchema,
  queryVersion: z.literal(GITHUB_CORE_QUERY_VERSION),
  sourceApiVersion: z.literal(GITHUB_CORE_REST_API_VERSION),
  highWatermark: CanonicalTimestampSchema.optional(),
  cursorHint: OpaqueIdSchema.optional(),
  boundedOverlapStart: CanonicalTimestampSchema,
  lastCompleteSnapshotHash: LowercaseSha256Schema.optional(),
  consentRevision: OpaqueIdSchema,
  committedJobId: OpaqueIdSchema,
}).strict()

const TransitionSchema = z.object({
  status: z.enum(['complete', 'truncated', 'failed', 'restricted']),
  coverage: CoverageRecordSchema,
  checkpoint: CheckpointSchema.nullable(),
  appliedReceiptIds: z.array(OpaqueIdSchema).superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: 'custom', message: 'Receipt IDs must be unique' })
    }
  }),
  cursorHint: OpaqueIdSchema.optional(),
}).strict()

const CommitInputSchema = z.object({
  jobId: OpaqueIdSchema,
  scopeAlias: OpaqueIdSchema,
  consentRevision: OpaqueIdSchema,
  sourceSnapshotId: OpaqueIdSchema.optional(),
  startedAt: CanonicalTimestampSchema,
  completedAt: CanonicalTimestampSchema,
  transition: TransitionSchema,
}).strict()

type ParsedCommitInput = z.infer<typeof CommitInputSchema>

type IncrementalCoverageRecord = z.infer<typeof CoverageRecordSchema>

export interface RestrictedGithubCoreCheckpointTransition {
  readonly status: 'restricted'
  readonly coverage: IncrementalCoverageRecord & { readonly status: 'restricted' }
  readonly checkpoint: GithubCoreCheckpoint | null
  readonly appliedReceiptIds: readonly string[]
  readonly cursorHint?: string
}

export type PersistedGithubCoreCheckpointTransition =
  | GithubCoreCheckpointTransition
  | RestrictedGithubCoreCheckpointTransition

export interface PersistGithubCoreTransitionInput {
  readonly jobId: string
  readonly scopeAlias: string
  readonly consentRevision: string
  readonly sourceSnapshotId?: string
  readonly startedAt: string
  readonly completedAt: string
  readonly transition: PersistedGithubCoreCheckpointTransition
}

export interface PersistGithubCoreTransitionResult {
  readonly applied: boolean
  readonly payloadHash: string
}

interface CheckpointRow {
  capability_id: 'github.core'
  scope_alias: string
  query_version: typeof GITHUB_CORE_QUERY_VERSION
  source_api_version: typeof GITHUB_CORE_REST_API_VERSION
  high_watermark: string | null
  cursor_hint: string | null
  bounded_overlap_start: string
  last_complete_snapshot_hash: string
  consent_revision: string
  committed_job_id: string
}

function assertHealthyStorage(db: Database.Database): void {
  const checks = runStorageChecks(db)
  if (checks.integrity !== 'ok' || checks.quick !== 'ok' || checks.foreignKeys.length > 0) {
    throw new Error('INCREMENTAL_STORAGE_CHECK_FAILED')
  }
}

export function installIncrementalGithubCoreStorage(db: Database.Database): void {
  try {
    db.pragma('foreign_keys = ON')
    db.transaction(() => {
      const existing = readOwnedSchemaRows(db)
      if (existing.length > 0) {
        if (!hasExpectedSchema(existing)) {
          throw new Error('INCREMENTAL_STORAGE_SCHEMA_MISMATCH')
        }
        assertHealthyStorage(db)
        return
      }

      db.exec(INCREMENTAL_GITHUB_CORE_STORAGE_SQL)
      const installed = readOwnedSchemaRows(db)
      if (!hasExpectedSchema(installed)) {
        throw new Error('INCREMENTAL_STORAGE_SCHEMA_MISMATCH')
      }
      assertHealthyStorage(db)
    })()
  } catch (error) {
    if (error instanceof Error && error.message === 'INCREMENTAL_STORAGE_CHECK_FAILED') {
      throw error
    }
    throw new Error('INCREMENTAL_STORAGE_SCHEMA_MISMATCH')
  }
}

function checkpointProjection(checkpoint: GithubCoreCheckpoint | null): unknown {
  if (!checkpoint) return null
  return {
    capabilityId: checkpoint.capabilityId,
    scopeAlias: checkpoint.scopeAlias,
    queryVersion: checkpoint.queryVersion,
    sourceApiVersion: checkpoint.sourceApiVersion,
    highWatermark: checkpoint.highWatermark ?? null,
    cursorHint: checkpoint.cursorHint ?? null,
    boundedOverlapStart: checkpoint.boundedOverlapStart,
    lastCompleteSnapshotHash: checkpoint.lastCompleteSnapshotHash ?? null,
    consentRevision: checkpoint.consentRevision,
    committedJobId: checkpoint.committedJobId,
  }
}

function coverageProjection(coverage: z.infer<typeof CoverageRecordSchema>): unknown {
  return {
    coverageId: coverage.coverageId,
    capabilityId: coverage.capabilityId,
    scopeAlias: coverage.scopeAlias,
    rangeStart: coverage.rangeStart,
    rangeEnd: coverage.rangeEnd,
    status: coverage.status,
    expectedUnits: coverage.expectedUnits,
    observedUnits: coverage.observedUnits,
    omittedUnits: coverage.omittedUnits,
    saturationReason: coverage.saturationReason ?? null,
    retryable: coverage.retryable,
    observedAt: coverage.observedAt,
    limitationCode: coverage.limitationCode,
  }
}

function payloadHash(input: ParsedCommitInput): string {
  const canonical = {
    storageContractVersion: INCREMENTAL_GITHUB_CORE_STORAGE_VERSION,
    jobId: input.jobId,
    scopeAlias: input.scopeAlias,
    consentRevision: input.consentRevision,
    sourceSnapshotId: input.sourceSnapshotId ?? null,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    transition: {
      status: input.transition.status,
      coverage: coverageProjection(input.transition.coverage),
      checkpoint: checkpointProjection(input.transition.checkpoint),
      appliedReceiptIds: input.transition.appliedReceiptIds,
      cursorHint: input.transition.cursorHint ?? null,
    },
  }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

function assertCheckpointGeometry(
  checkpoint: GithubCoreCheckpoint,
  rangeStart: string,
  rangeEnd: string,
): void {
  const overlapStart = Date.parse(checkpoint.boundedOverlapStart)
  const highWatermark = checkpoint.highWatermark
    ? Date.parse(checkpoint.highWatermark)
    : undefined
  if (highWatermark !== undefined) {
    if (highWatermark < Date.parse(rangeStart) || highWatermark >= Date.parse(rangeEnd)) {
      throw new Error('CHECKPOINT_HIGH_WATERMARK_OUT_OF_RANGE')
    }
    if (overlapStart > highWatermark) throw new Error('CHECKPOINT_WINDOW_INVERTED')
  }
}

function parseCommitInput(value: unknown): ParsedCommitInput {
  const input = CommitInputSchema.parse(value)
  const coverage = input.transition.coverage
  CoverageIdSchema.parse(coverage.coverageId)
  OpaqueIdSchema.parse(coverage.scopeAlias)
  CanonicalTimestampSchema.parse(coverage.rangeStart)
  CanonicalTimestampSchema.parse(coverage.rangeEnd)
  CanonicalTimestampSchema.parse(coverage.observedAt)
  if (coverage.capabilityId !== 'github.core') throw new Error('COVERAGE_CAPABILITY_MISMATCH')
  if (coverage.scopeAlias !== input.scopeAlias) throw new Error('COVERAGE_SCOPE_MISMATCH')
  if (coverage.status !== input.transition.status) throw new Error('COVERAGE_STATUS_MISMATCH')
  if (Date.parse(input.startedAt) > Date.parse(input.completedAt)) {
    throw new Error('COLLECTION_JOB_TIME_ORDER_INVALID')
  }
  if (input.transition.cursorHint && input.transition.status !== 'truncated') {
    throw new Error('CURSOR_HINT_STATUS_MISMATCH')
  }

  const checkpoint = input.transition.checkpoint
  if (checkpoint) {
    if (checkpoint.scopeAlias !== input.scopeAlias) throw new Error('CHECKPOINT_SCOPE_MISMATCH')
    if (checkpoint.consentRevision !== input.consentRevision) {
      throw new Error('CHECKPOINT_CONSENT_MISMATCH')
    }
    assertCheckpointGeometry(checkpoint, coverage.rangeStart, coverage.rangeEnd)
  }

  if (input.transition.status === 'complete') {
    if (!input.sourceSnapshotId) throw new Error('COMPLETE_SNAPSHOT_ID_REQUIRED')
    if (!checkpoint) throw new Error('COMPLETE_CHECKPOINT_REQUIRED')
    if (checkpoint.committedJobId !== input.jobId) throw new Error('CHECKPOINT_JOB_MISMATCH')
    if (!checkpoint.lastCompleteSnapshotHash) {
      throw new Error('COMPLETE_SNAPSHOT_HASH_REQUIRED')
    }
  } else if (input.sourceSnapshotId !== undefined) {
    throw new Error('NONCOMPLETE_SNAPSHOT_FORBIDDEN')
  }
  return input
}

export function readIncrementalGithubCoreCheckpoint(
  db: Database.Database,
  scopeAlias: string,
): GithubCoreCheckpoint | null {
  const scope = OpaqueIdSchema.parse(scopeAlias)
  const row = db.prepare(
    'SELECT capability_id, scope_alias, query_version, source_api_version, high_watermark, cursor_hint, bounded_overlap_start, last_complete_snapshot_hash, consent_revision, committed_job_id FROM collection_checkpoint WHERE capability_id = ? AND scope_alias = ?',
  ).get('github.core', scope) as CheckpointRow | undefined
  if (!row) return null
  return CheckpointSchema.parse({
    capabilityId: row.capability_id,
    scopeAlias: row.scope_alias,
    queryVersion: row.query_version,
    sourceApiVersion: row.source_api_version,
    ...(row.high_watermark ? { highWatermark: row.high_watermark } : {}),
    ...(row.cursor_hint ? { cursorHint: row.cursor_hint } : {}),
    boundedOverlapStart: row.bounded_overlap_start,
    lastCompleteSnapshotHash: row.last_complete_snapshot_hash,
    consentRevision: row.consent_revision,
    committedJobId: row.committed_job_id,
  })
}

function checkpointsEqual(
  left: GithubCoreCheckpoint | null,
  right: GithubCoreCheckpoint | null,
): boolean {
  return JSON.stringify(checkpointProjection(left)) === JSON.stringify(checkpointProjection(right))
}

function assertCompleteAdvance(
  previous: GithubCoreCheckpoint | null,
  next: GithubCoreCheckpoint,
): void {
  if (!previous) return
  if (
    previous.scopeAlias !== next.scopeAlias ||
    previous.queryVersion !== next.queryVersion ||
    previous.sourceApiVersion !== next.sourceApiVersion ||
    previous.consentRevision !== next.consentRevision
  ) {
    throw new Error('CHECKPOINT_CONTRACT_MISMATCH')
  }
  if (previous.highWatermark && !next.highWatermark) {
    throw new Error('CHECKPOINT_WATERMARK_REGRESSION')
  }
  if (
    previous.highWatermark &&
    next.highWatermark &&
    Date.parse(next.highWatermark) < Date.parse(previous.highWatermark)
  ) {
    throw new Error('CHECKPOINT_WATERMARK_REGRESSION')
  }
}

function assertExistingCommit(
  db: Database.Database,
  jobId: string,
  status: ParsedCommitInput['transition']['status'],
): void {
  const coverageCount = Number(
    db.prepare('SELECT COUNT(*) FROM coverage_ledger WHERE job_id = ?').pluck().get(jobId),
  )
  const snapshotCount = Number(
    db.prepare('SELECT COUNT(*) FROM source_snapshot WHERE job_id = ?').pluck().get(jobId),
  )
  if (coverageCount !== 1 || snapshotCount !== Number(status === 'complete')) {
    throw new Error('COLLECTION_JOB_INCOMPLETE_REPLAY_STATE')
  }
}

export function persistIncrementalGithubCoreTransition(
  db: Database.Database,
  value: unknown,
): PersistGithubCoreTransitionResult {
  const input = parseCommitInput(value)
  const hash = payloadHash(input)
  const write = db.transaction((): boolean => {
    const existing = db.prepare(
      'SELECT payload_hash, status FROM collection_job WHERE job_id = ?',
    ).get(input.jobId) as { payload_hash: string; status: ParsedCommitInput['transition']['status'] } | undefined
    if (existing) {
      if (existing.payload_hash !== hash || existing.status !== input.transition.status) {
        throw new Error('COLLECTION_JOB_ID_COLLISION')
      }
      assertExistingCommit(db, input.jobId, input.transition.status)
      return false
    }

    const durableCheckpoint = readIncrementalGithubCoreCheckpoint(db, input.scopeAlias)
    if (input.transition.status === 'complete') {
      assertCompleteAdvance(durableCheckpoint, input.transition.checkpoint!)
    } else if (!checkpointsEqual(durableCheckpoint, input.transition.checkpoint)) {
      throw new Error('NONCOMPLETE_CHECKPOINT_ADVANCE')
    }

    const coverage = input.transition.coverage
    db.prepare(
      'INSERT INTO collection_job (job_id, storage_contract_version, payload_hash, capability_id, scope_alias, query_version, source_api_version, consent_revision, range_start, range_end, observed_at, started_at, completed_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      input.jobId,
      INCREMENTAL_GITHUB_CORE_STORAGE_VERSION,
      hash,
      'github.core',
      input.scopeAlias,
      GITHUB_CORE_QUERY_VERSION,
      GITHUB_CORE_REST_API_VERSION,
      input.consentRevision,
      coverage.rangeStart,
      coverage.rangeEnd,
      coverage.observedAt,
      input.startedAt,
      input.completedAt,
      input.transition.status,
    )

    const snapshotId = input.transition.status === 'complete' ? input.sourceSnapshotId! : null
    if (input.transition.status === 'complete') {
      const checkpoint = input.transition.checkpoint!
      db.prepare(
        'INSERT INTO source_snapshot (snapshot_id, job_id, capability_id, scope_alias, snapshot_hash, range_start, range_end, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        snapshotId,
        input.jobId,
        'github.core',
        input.scopeAlias,
        checkpoint.lastCompleteSnapshotHash,
        coverage.rangeStart,
        coverage.rangeEnd,
        coverage.observedAt,
      )
    }

    db.prepare(
      'INSERT INTO coverage_ledger (coverage_id, range_start, job_id, snapshot_id, capability_id, scope_alias, range_end, status, expected_units, observed_units, omitted_units, saturation_reason, retryable, observed_at, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      coverage.coverageId,
      coverage.rangeStart,
      input.jobId,
      snapshotId,
      coverage.capabilityId,
      coverage.scopeAlias,
      coverage.rangeEnd,
      coverage.status,
      coverage.expectedUnits,
      coverage.observedUnits,
      coverage.omittedUnits,
      coverage.saturationReason ?? null,
      Number(coverage.retryable),
      coverage.observedAt,
      coverage.limitationCode,
    )

    if (input.transition.status === 'complete') {
      const checkpoint = input.transition.checkpoint!
      db.prepare(
        'INSERT INTO collection_checkpoint (capability_id, scope_alias, query_version, source_api_version, high_watermark, cursor_hint, bounded_overlap_start, last_complete_snapshot_hash, consent_revision, committed_job_id, source_snapshot_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(capability_id, scope_alias) DO UPDATE SET query_version = excluded.query_version, source_api_version = excluded.source_api_version, high_watermark = excluded.high_watermark, cursor_hint = excluded.cursor_hint, bounded_overlap_start = excluded.bounded_overlap_start, last_complete_snapshot_hash = excluded.last_complete_snapshot_hash, consent_revision = excluded.consent_revision, committed_job_id = excluded.committed_job_id, source_snapshot_id = excluded.source_snapshot_id',
      ).run(
        checkpoint.capabilityId,
        checkpoint.scopeAlias,
        checkpoint.queryVersion,
        checkpoint.sourceApiVersion,
        checkpoint.highWatermark ?? null,
        checkpoint.cursorHint ?? null,
        checkpoint.boundedOverlapStart,
        checkpoint.lastCompleteSnapshotHash,
        checkpoint.consentRevision,
        checkpoint.committedJobId,
        snapshotId,
      )
    }

    assertHealthyStorage(db)
    return true
  })

  return { applied: write(), payloadHash: hash }
}

export type IncrementalGithubCoreDeletionResult = Record<IncrementalGithubCoreTable, number>

export function deleteIncrementalGithubCoreScope(
  db: Database.Database,
  scopeAlias: string,
): IncrementalGithubCoreDeletionResult {
  const scope = OpaqueIdSchema.parse(scopeAlias)
  const remove = db.transaction((): IncrementalGithubCoreDeletionResult => {
    const result: IncrementalGithubCoreDeletionResult = {
      collection_job: 0,
      collection_checkpoint: db.prepare(
        'DELETE FROM collection_checkpoint WHERE capability_id = ? AND scope_alias = ?',
      ).run('github.core', scope).changes,
      source_snapshot: 0,
      coverage_ledger: db.prepare(
        'DELETE FROM coverage_ledger WHERE capability_id = ? AND scope_alias = ?',
      ).run('github.core', scope).changes,
    }
    result.source_snapshot = db.prepare(
      'DELETE FROM source_snapshot WHERE capability_id = ? AND scope_alias = ?',
    ).run('github.core', scope).changes
    result.collection_job = db.prepare(
      'DELETE FROM collection_job WHERE capability_id = ? AND scope_alias = ?',
    ).run('github.core', scope).changes
    assertHealthyStorage(db)
    return result
  })
  return remove()
}
