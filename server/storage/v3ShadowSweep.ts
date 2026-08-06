import { randomBytes as cryptoRandomBytes } from 'node:crypto'
import Database from 'better-sqlite3'
import { CanonicalTimestampSchema } from '../../shared/claims.js'
import {
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  STORAGE_V3_SHADOW_SCHEMA_VERSION,
  STORAGE_V3_SHADOW_TABLES,
  STORAGE_V3_SHADOW_USER_VERSION,
  storageV3ShadowSchemaFingerprint,
} from './v3ShadowSchema.js'
import { assertContinuityCasConsistency } from './v3ContinuityCasProposal.js'
import { addUtcMonthsClamped, isoWeekFromCanonicalTimestamp } from './v3ShadowRewrite.js'

export const STORAGE_V3_C2_SWEEP_GROUPS = [
  'claimScope',
  'repositoryIdentity',
  'commitObservation',
  'pullRequestFact',
  'datedEventObservation',
  'collectionJob',
  'collectionCheckpoint',
  'sourceSnapshot',
  'coverageLedger',
  'claim',
] as const

export type StorageV3C2SweepGroup = typeof STORAGE_V3_C2_SWEEP_GROUPS[number]

export const STORAGE_V3_C2_SWEEP_STAGES = [
  ...STORAGE_V3_C2_SWEEP_GROUPS,
  'casReceipts',
  'lineage',
  'finalValidation',
] as const

export type StorageV3C2SweepStage = typeof STORAGE_V3_C2_SWEEP_STAGES[number]

export type StorageV3C2SweepErrorCode =
  | 'TARGET_SCHEMA_REFUSED'
  | 'INVALID_TIMESTAMP'
  | 'SWEEP_STATE_REFUSED'
  | 'SWEEP_BUSY'
  | 'SWEEP_FAILED'

export class StorageV3C2SweepError extends Error {
  public readonly code: StorageV3C2SweepErrorCode

  constructor(code: StorageV3C2SweepErrorCode) {
    super(code)
    this.name = 'StorageV3C2SweepError'
    this.code = code
  }
}

export interface StorageV3C2SweepOptions {
  readonly targetDb: Database.Database
  readonly asOf: string
  readonly randomBytes?: (size: number) => Buffer
  /** Test-only failure injection. The callback receives no retained or expired values. */
  readonly failAfterStage?: (stage: StorageV3C2SweepStage) => void
}

export interface StorageV3C2SweepResult {
  readonly completeB2: false
  readonly status: 'complete' | 'noop'
  readonly schemaVersion: typeof STORAGE_V3_SHADOW_SCHEMA_VERSION
  readonly cleared: Readonly<Record<StorageV3C2SweepGroup, number>>
  /** CAS payload receipts cleared at the 13-month boundary (PR #130 late review / #128). */
  readonly casReceiptsCleared: number
  readonly lineageEvents: number
}

type Row = Record<string, unknown>
type RetentionSubjectKind = 'job' | 'snapshot' | 'checkpoint' | 'coverage'
type RetentionEventKind = 'scope_alias_expired' | 'c2_retention_expired'

interface StoredExpiryGroup {
  readonly key: Exclude<StorageV3C2SweepGroup, 'claim'>
  readonly table: string
  readonly idColumns: readonly string[]
  readonly expiryColumn: string
  readonly clearColumns: readonly string[]
  readonly retentionSubjectKind?: RetentionSubjectKind
  readonly retentionSubjectColumn?: string
}

interface PlannedClear {
  readonly group: StoredExpiryGroup
  readonly ids: readonly string[]
  readonly expiresAt: string
  readonly scopeId: string
  readonly subjectId?: string
}

interface PlannedClaimClear {
  readonly scopeId: string
  readonly claimId: string
  readonly createdAt: string
}

interface PlannedLineageEvent {
  readonly scopeId: string
  readonly subjectKind: 'scope' | RetentionSubjectKind
  readonly subjectId: string
  readonly eventKind: RetentionEventKind
  readonly eventWeek: string
}

const STORED_EXPIRY_GROUPS: readonly StoredExpiryGroup[] = [
  {
    key: 'claimScope',
    table: 'claim_scope',
    idColumns: ['scope_id'],
    expiryColumn: 'alias_expires_at',
    clearColumns: ['scope_alias', 'linked_at', 'alias_expires_at'],
  },
  {
    key: 'repositoryIdentity',
    table: 'repository_identity',
    idColumns: ['scope_id'],
    expiryColumn: 'identity_expires_at',
    clearColumns: ['provider_id', 'analytical_key', 'identity_expires_at'],
  },
  {
    key: 'commitObservation',
    table: 'commit_observation',
    idColumns: ['scope_id', 'observation_id'],
    expiryColumn: 'c2_expires_at',
    clearColumns: ['sha', 'occurred_at', 'source', 'c2_expires_at'],
  },
  {
    key: 'pullRequestFact',
    table: 'pull_request_fact',
    idColumns: ['scope_id', 'fact_id'],
    expiryColumn: 'c2_expires_at',
    clearColumns: ['number', 'created_at', 'merged_at', 'closed_at', 'c2_expires_at'],
  },
  {
    key: 'datedEventObservation',
    table: 'dated_event_observation',
    idColumns: ['scope_id', 'event_id'],
    expiryColumn: 'c2_expires_at',
    clearColumns: ['occurred_at', 'c2_expires_at'],
  },
  {
    key: 'collectionJob',
    table: 'collection_job',
    idColumns: ['scope_id', 'job_id'],
    expiryColumn: 'c2_expires_at',
    clearColumns: [
      'source_job_id', 'payload_hash', 'range_start', 'range_end', 'observed_at',
      'started_at', 'completed_at', 'c2_expires_at',
    ],
    retentionSubjectKind: 'job',
    retentionSubjectColumn: 'job_id',
  },
  {
    key: 'collectionCheckpoint',
    table: 'collection_checkpoint',
    idColumns: ['scope_id', 'checkpoint_id'],
    expiryColumn: 'c2_expires_at',
    clearColumns: [
      'high_watermark', 'cursor_hint', 'bounded_overlap_start',
      'last_complete_snapshot_hash', 'c2_expires_at',
    ],
    retentionSubjectKind: 'checkpoint',
    retentionSubjectColumn: 'checkpoint_id',
  },
  {
    key: 'sourceSnapshot',
    table: 'source_snapshot',
    idColumns: ['scope_id', 'snapshot_id'],
    expiryColumn: 'c2_expires_at',
    clearColumns: [
      'source_snapshot_id', 'snapshot_hash', 'range_start', 'range_end',
      'observed_at', 'c2_expires_at',
    ],
    retentionSubjectKind: 'snapshot',
    retentionSubjectColumn: 'snapshot_id',
  },
  {
    key: 'coverageLedger',
    table: 'coverage_ledger',
    idColumns: ['scope_id', 'coverage_id'],
    expiryColumn: 'c2_expires_at',
    clearColumns: ['source_coverage_id', 'range_start', 'range_end', 'observed_at', 'c2_expires_at'],
    retentionSubjectKind: 'coverage',
    retentionSubjectColumn: 'coverage_id',
  },
] as const

const fail = (code: StorageV3C2SweepErrorCode): never => {
  throw new StorageV3C2SweepError(code)
}

const requiredString = (value: unknown): string =>
  typeof value === 'string' && value.length > 0 ? value : fail('SWEEP_STATE_REFUSED')

const targetTimestamp = (value: unknown): string =>
  typeof value === 'string' && CanonicalTimestampSchema.safeParse(value).success
    ? value
    : fail('SWEEP_STATE_REFUSED')

const callerTimestamp = (value: unknown): string =>
  typeof value === 'string' && CanonicalTimestampSchema.safeParse(value).success
    ? value
    : fail('INVALID_TIMESTAMP')

function assertTargetSchema(db: Database.Database): void {
  if (Number(db.prepare('PRAGMA application_id').pluck().get()) !== STORAGE_V3_SHADOW_APPLICATION_ID) {
    fail('TARGET_SCHEMA_REFUSED')
  }
  if (Number(db.prepare('PRAGMA user_version').pluck().get()) !== STORAGE_V3_SHADOW_USER_VERSION) {
    fail('TARGET_SCHEMA_REFUSED')
  }
  const tables = db.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
  ).pluck().all() as string[]
  if (JSON.stringify(tables) !== JSON.stringify([...STORAGE_V3_SHADOW_TABLES].sort())) {
    fail('TARGET_SCHEMA_REFUSED')
  }
  if (storageV3ShadowSchemaFingerprint(db) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT) {
    fail('TARGET_SCHEMA_REFUSED')
  }
  if (db.prepare("SELECT 1 FROM sqlite_temp_schema WHERE name NOT GLOB 'sqlite_*' LIMIT 1").get()) {
    fail('TARGET_SCHEMA_REFUSED')
  }
  if (String(db.prepare('PRAGMA integrity_check').pluck().get()) !== 'ok') fail('TARGET_SCHEMA_REFUSED')
  if (String(db.prepare('PRAGMA quick_check').pluck().get()) !== 'ok') fail('TARGET_SCHEMA_REFUSED')
  if (db.prepare('PRAGMA foreign_key_check').get() !== undefined) fail('TARGET_SCHEMA_REFUSED')
}

function planStoredClears(db: Database.Database, asOf: string): PlannedClear[] {
  const planned: PlannedClear[] = []
  for (const group of STORED_EXPIRY_GROUPS) {
    const selectedColumns = [...group.idColumns, group.expiryColumn]
    const rows = db.prepare(
      `SELECT ${selectedColumns.join(', ')} FROM ${group.table}
       WHERE ${group.expiryColumn} IS NOT NULL
       ORDER BY ${group.idColumns.join(', ')}`,
    ).all() as Row[]
    for (const row of rows) {
      const expiresAt = targetTimestamp(row[group.expiryColumn])
      if (asOf < expiresAt) continue
      const ids = group.idColumns.map((column) => requiredString(row[column]))
      const scopeId = requiredString(row.scope_id)
      const subjectId = group.retentionSubjectColumn
        ? requiredString(row[group.retentionSubjectColumn])
        : undefined
      planned.push({ group, ids, expiresAt, scopeId, subjectId })
    }
  }
  return planned
}

function clearRepositoryIdentitiesForExpiredAliases(
  db: Database.Database,
  scopeIds: ReadonlySet<string>,
): number {
  const clear = db.prepare(
    `UPDATE repository_identity
     SET provider_id = NULL, analytical_key = NULL, identity_expires_at = NULL
     WHERE scope_id = ? AND provider_id IS NOT NULL`,
  )
  let cleared = 0
  for (const scopeId of scopeIds) {
    const result = clear.run(scopeId)
    if (result.changes > 1) fail('SWEEP_STATE_REFUSED')
    cleared += result.changes
  }
  return cleared
}

function planClaimClears(db: Database.Database, asOf: string): PlannedClaimClear[] {
  const rows = db.prepare(
    `SELECT scope_id, claim_id, created_at FROM claim
     WHERE created_at IS NOT NULL ORDER BY scope_id, claim_id`,
  ).all() as Row[]
  const planned: PlannedClaimClear[] = []
  for (const row of rows) {
    const createdAt = targetTimestamp(row.created_at)
    const expiresAt = (() => {
      try {
        return addUtcMonthsClamped(createdAt)
      } catch {
        return fail('SWEEP_STATE_REFUSED')
      }
    })()
    if (asOf >= expiresAt) {
      planned.push({
        scopeId: requiredString(row.scope_id),
        claimId: requiredString(row.claim_id),
        createdAt,
      })
    }
  }
  return planned
}

const retentionSubjectKey = (scopeId: string, subjectKind: RetentionSubjectKind, subjectId: string): string =>
  [scopeId, subjectKind, subjectId].join('\0')

function retainedIncrementalSubjects(db: Database.Database): ReadonlySet<string> {
  const subjects = new Set<string>()
  const coverageRows = db.prepare(`WITH referenced_coverage AS (
    SELECT scope_id, target_coverage_id AS coverage_id
    FROM claim_evidence_edge WHERE target_coverage_id IS NOT NULL
    UNION
    SELECT edge.scope_id, evidence.coverage_id
    FROM claim_evidence_edge AS edge
    JOIN evidence
      ON evidence.scope_id = edge.scope_id
     AND evidence.evidence_id = edge.target_evidence_id
    WHERE edge.target_evidence_id IS NOT NULL
  )
  SELECT referenced.scope_id, referenced.coverage_id, coverage.job_id, coverage.snapshot_id
  FROM referenced_coverage AS referenced
  JOIN coverage_ledger AS coverage
    ON coverage.scope_id = referenced.scope_id
   AND coverage.coverage_id = referenced.coverage_id`).all() as Row[]
  for (const row of coverageRows) {
    const scopeId = requiredString(row.scope_id)
    const coverageId = requiredString(row.coverage_id)
    const jobId = requiredString(row.job_id)
    subjects.add(retentionSubjectKey(scopeId, 'coverage', coverageId))
    subjects.add(retentionSubjectKey(scopeId, 'job', jobId))
    if (row.snapshot_id !== null && row.snapshot_id !== undefined) {
      subjects.add(retentionSubjectKey(scopeId, 'snapshot', requiredString(row.snapshot_id)))
    }
  }
  for (const row of db.prepare(
    'SELECT scope_id, checkpoint_id, job_id, snapshot_id FROM collection_checkpoint',
  ).all() as Row[]) {
    const scopeId = requiredString(row.scope_id)
    const jobId = requiredString(row.job_id)
    const snapshotId = requiredString(row.snapshot_id)
    if (
      subjects.has(retentionSubjectKey(scopeId, 'job', jobId))
      && subjects.has(retentionSubjectKey(scopeId, 'snapshot', snapshotId))
    ) {
      subjects.add(retentionSubjectKey(scopeId, 'checkpoint', requiredString(row.checkpoint_id)))
    }
  }
  return subjects
}

function plannedLineageEvents(
  clears: readonly PlannedClear[],
  retainedSubjects: ReadonlySet<string>,
): PlannedLineageEvent[] {
  const events: PlannedLineageEvent[] = []
  for (const { group, expiresAt, scopeId, subjectId } of clears) {
    if (group.key === 'claimScope') {
      events.push({
        scopeId,
        subjectKind: 'scope',
        subjectId: scopeId,
        eventKind: 'scope_alias_expired',
        eventWeek: isoWeekFromCanonicalTimestamp(expiresAt),
      })
      continue
    }
    if (
      group.retentionSubjectKind
      && subjectId
      && retainedSubjects.has(retentionSubjectKey(scopeId, group.retentionSubjectKind, subjectId))
    ) {
      events.push({
        scopeId,
        subjectKind: group.retentionSubjectKind,
        subjectId,
        eventKind: 'c2_retention_expired',
        eventWeek: isoWeekFromCanonicalTimestamp(expiresAt),
      })
    }
  }
  return events
}

/** Monday 00:00:00.000Z of an ISO week label — the earliest instant the week covers. */
function isoWeekMondayTimestamp(week: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(week)
  if (!match) return fail('SWEEP_STATE_REFUSED')
  const year = Number(match[1])
  const weekNumber = Number(match[2])
  const jan4 = Date.UTC(year, 0, 4)
  const jan4Weekday = new Date(jan4).getUTCDay() || 7
  const week1Monday = jan4 - (jan4Weekday - 1) * 86_400_000
  return new Date(week1Monday + (weekNumber - 1) * 7 * 86_400_000).toISOString()
}

/**
 * Clear CAS payload receipts whose 13-month lifetime has passed. The receipt's exact
 * applied time is not stored (grain rule), so the boundary is computed from the week's
 * Monday — the earliest instant the row can have been written — which can only expire
 * a receipt up to six days EARLY, never retain it past 13 months. Rows stay (revision
 * history is C1); only the local-C2 digest is cleared, which the clear-only trigger
 * permits. No lineage event: CAS operations are not an analytic subject class and no
 * resolver walks them.
 */
function clearExpiredCasReceipts(db: Database.Database, asOf: string): number {
  const candidates = db.prepare(
    'SELECT operation_id, applied_week FROM continuity_cas_operation WHERE payload_sha256 IS NOT NULL',
  ).all() as Array<{ operation_id: string; applied_week: string }>
  const clear = db.prepare(
    'UPDATE continuity_cas_operation SET payload_sha256 = NULL WHERE operation_id = ? AND payload_sha256 IS NOT NULL',
  )
  let cleared = 0
  for (const candidate of candidates) {
    if (addUtcMonthsClamped(isoWeekMondayTimestamp(candidate.applied_week)) > asOf) continue
    if (clear.run(candidate.operation_id).changes !== 1) fail('SWEEP_STATE_REFUSED')
    cleared += 1
  }
  return cleared
}

function mintOperationId(
  entropy: (size: number) => Buffer,
  used: Set<string>,
): string {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const bytes = entropy(32)
    if (!Buffer.isBuffer(bytes) || bytes.length !== 32) fail('SWEEP_FAILED')
    const operationId = `op-${bytes.toString('hex')}`
    if (!used.has(operationId)) {
      used.add(operationId)
      return operationId
    }
  }
  return fail('SWEEP_FAILED')
}

function emptyCounts(): Record<StorageV3C2SweepGroup, number> {
  return Object.fromEntries(STORAGE_V3_C2_SWEEP_GROUPS.map((group) => [group, 0])) as
    Record<StorageV3C2SweepGroup, number>
}

const sqliteBusy = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String(error.code) : ''
  return code.startsWith('SQLITE_BUSY') || code.startsWith('SQLITE_LOCKED')
}

/**
 * Clear expired C2 values from an already-installed v3 shadow target.
 *
 * This seam is target-only and monotone: it never copies a source value, mints a
 * C1 anchor, selects a production database, or activates a capability.
 */
export function sweepStorageV3C2(options: StorageV3C2SweepOptions): StorageV3C2SweepResult {
  const asOf = callerTimestamp(options.asOf)
  const entropy = options.randomBytes ?? cryptoRandomBytes
  const execute = (): StorageV3C2SweepResult => {
    if (options.targetDb.inTransaction) fail('SWEEP_STATE_REFUSED')
    options.targetDb.pragma('foreign_keys = ON')
    if (Number(options.targetDb.prepare('PRAGMA foreign_keys').pluck().get()) !== 1) {
      fail('TARGET_SCHEMA_REFUSED')
    }

    const run = options.targetDb.transaction((): StorageV3C2SweepResult => {
    assertTargetSchema(options.targetDb)
    const clears = planStoredClears(options.targetDb, asOf)
    const claimClears = planClaimClears(options.targetDb, asOf)
    const events = plannedLineageEvents(clears, retainedIncrementalSubjects(options.targetDb))
    const expiredAliasScopes = new Set(
      clears
        .filter((candidate) => candidate.group.key === 'claimScope')
        .map((candidate) => candidate.scopeId),
    )
    // An alias link and its same-scope repository identity are one C2 identity
    // boundary. If the link expires first, clear both in this transaction and
    // avoid replaying the identity candidate through its independent clock.
    const executableClears = clears.filter(
      (candidate) => candidate.group.key !== 'repositoryIdentity' || !expiredAliasScopes.has(candidate.scopeId),
    )
    const counts = emptyCounts()

    for (const group of STORED_EXPIRY_GROUPS) {
      const groupClears = executableClears.filter((candidate) => candidate.group === group)
      const assignments = group.clearColumns.map((column) => `${column} = NULL`).join(', ')
      const identity = group.idColumns.map((column) => `${column} = ?`).join(' AND ')
      const update = options.targetDb.prepare(
        `UPDATE ${group.table} SET ${assignments}
         WHERE ${identity} AND ${group.expiryColumn} = ?`,
      )
      for (const candidate of groupClears) {
        const result = update.run(...candidate.ids, candidate.expiresAt)
        if (result.changes !== 1) fail('SWEEP_STATE_REFUSED')
        counts[group.key] += 1
      }
      if (group.key === 'claimScope') {
        counts.repositoryIdentity += clearRepositoryIdentitiesForExpiredAliases(
          options.targetDb,
          expiredAliasScopes,
        )
      }
      options.failAfterStage?.(group.key)
    }

    const clearClaim = options.targetDb.prepare(
      'UPDATE claim SET created_at = NULL WHERE scope_id = ? AND claim_id = ? AND created_at = ?',
    )
    for (const candidate of claimClears) {
      const result = clearClaim.run(candidate.scopeId, candidate.claimId, candidate.createdAt)
      if (result.changes !== 1) fail('SWEEP_STATE_REFUSED')
      counts.claim += 1
    }
    options.failAfterStage?.('claim')

    // Like every other CAS writer: refuse to mutate around divergent or orphaned CAS
    // history, and prove the receipt clearing preserved consistency (PR #136 review).
    try {
      assertContinuityCasConsistency(options.targetDb)
    } catch {
      fail('SWEEP_STATE_REFUSED')
    }
    const casReceiptsCleared = clearExpiredCasReceipts(options.targetDb, asOf)
    try {
      assertContinuityCasConsistency(options.targetDb)
    } catch {
      fail('SWEEP_STATE_REFUSED')
    }
    options.failAfterStage?.('casReceipts')

    const usedLineageKeys = new Set<string>()
    for (const row of options.targetDb.prepare(
      'SELECT subject_id, operation_id, caused_by FROM lineage_event',
    ).all() as Row[]) {
      for (const value of [row.subject_id, row.operation_id, row.caused_by]) {
        if (typeof value === 'string') usedLineageKeys.add(value)
      }
    }
    const operationByScope = new Map<string, string>()
    const alreadyRecorded = options.targetDb.prepare(
      `SELECT 1 FROM lineage_event
       WHERE scope_id = ? AND subject_kind = ? AND subject_id = ?
         AND event_kind = ? AND event_week = ? LIMIT 1`,
    )
    const insertLineage = options.targetDb.prepare(
      `INSERT INTO lineage_event (
        scope_id, subject_kind, subject_id, operation_id, capability_id,
        caused_by, event_kind, event_week
      ) VALUES (?, ?, ?, ?, 'github.core', NULL, ?, ?)`,
    )
    let lineageEvents = 0
    for (const event of events) {
      if (alreadyRecorded.get(
        event.scopeId,
        event.subjectKind,
        event.subjectId,
        event.eventKind,
        event.eventWeek,
      )) continue
      let operationId = operationByScope.get(event.scopeId)
      if (!operationId) {
        operationId = mintOperationId(entropy, usedLineageKeys)
        operationByScope.set(event.scopeId, operationId)
      }
      insertLineage.run(
        event.scopeId,
        event.subjectKind,
        event.subjectId,
        operationId,
        event.eventKind,
        event.eventWeek,
      )
      lineageEvents += 1
    }
    options.failAfterStage?.('lineage')

    if (String(options.targetDb.prepare('PRAGMA integrity_check').pluck().get()) !== 'ok') {
      fail('SWEEP_STATE_REFUSED')
    }
    if (String(options.targetDb.prepare('PRAGMA quick_check').pluck().get()) !== 'ok') {
      fail('SWEEP_STATE_REFUSED')
    }
    if (options.targetDb.prepare('PRAGMA foreign_key_check').get() !== undefined) {
      fail('SWEEP_STATE_REFUSED')
    }
    options.failAfterStage?.('finalValidation')

    const cleared = Object.freeze({ ...counts })
    const changed = Object.values(cleared).some((count) => count > 0)
      || casReceiptsCleared > 0
      || lineageEvents > 0
    return Object.freeze({
      completeB2: false,
      status: changed ? 'complete' : 'noop',
      schemaVersion: STORAGE_V3_SHADOW_SCHEMA_VERSION,
      cleared,
      casReceiptsCleared,
      lineageEvents,
    })
    })
    return run.immediate()
  }

  try {
    return execute()
  } catch (error) {
    if (error instanceof StorageV3C2SweepError) throw error
    if (sqliteBusy(error)) fail('SWEEP_BUSY')
    return fail('SWEEP_FAILED')
  }
}
