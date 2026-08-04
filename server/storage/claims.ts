import type Database from 'better-sqlite3'
import { z } from 'zod'
import {
  CLAIM_EDGE_ROLES,
  CLAIM_EDGE_ROLE_TARGET_KIND,
  CLAIM_LAYERS,
  CLAIM_LIMITATION_CODES,
  CLAIM_LIMITATION_DIMENSIONS,
  CLAIM_SCHEMA_VERSION,
  CLAIM_STATEMENT_CODES,
  CLAIM_ABSTENTION_STATEMENT_CODE,
  CanonicalTimestampSchema,
  ClaimEvidenceEdgeSchema,
  ClaimIdSchema,
  ClaimLayerSchema,
  ClaimRecordSchema,
  ClaimScopeSchema,
  ClaimStatementCodeSchema,
  CoverageTargetSchema,
  EvidenceAnchorSchema,
  LimitationInstanceSchema,
  LineageEventSchema,
  LINEAGE_EVENT_KINDS,
  MethodVersionSchema,
  OpaqueTokenSchema,
  claimStabilityKey,
  claimStabilityKeyToken,
  computeClaimId,
  type ClaimEvidenceEdge,
  type ClaimRecord,
} from '../../shared/claims.js'
import { EVIDENCE_LAYERS, CANONICAL_ENVELOPE_SCHEMA_VERSION } from '../../shared/provenance.js'
import { runStorageChecks } from './database.js'

export const CLAIM_GRAPH_STORAGE_VERSION = '1.0.0' as const

/**
 * The claim-graph table families (ADR-01). `evidence` is the anchor the ADR's edge
 * targets reference; the P2 canonical store had no such table, so it is created here
 * as an identity-and-coverage-link row only. Envelope payload persistence belongs to
 * its own card and may extend this table additively.
 */
export const CLAIM_GRAPH_TABLES = [
  'evidence',
  'claim_scope',
  'claim',
  'claim_evidence_edge',
  'limitation_instance',
  'lineage_event',
] as const
export type ClaimGraphTable = typeof CLAIM_GRAPH_TABLES[number]

/** The existing coverage table every claim-graph coverage reference resolves against. */
export const CLAIM_GRAPH_COVERAGE_TABLE = 'coverage_ledger' as const

const quoted = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ')
const opaque = (column: string): string =>
  `length(${column}) BETWEEN 1 AND 128 AND ${column} NOT GLOB '*[^A-Za-z0-9:._-]*'`
const longOpaque = (column: string): string =>
  `length(${column}) BETWEEN 1 AND 256 AND ${column} NOT GLOB '*[^A-Za-z0-9:._-]*'`
const canonicalTimestamp = (column: string): string =>
  `length(${column}) = 24 AND ${column} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'`
const claimIdentifier = (column: string): string =>
  `length(${column}) = 67 AND ${column} GLOB 'cl_*' AND substr(${column}, 4) NOT GLOB '*[^0-9a-f]*'`

const EVIDENCE_ROLES = CLAIM_EDGE_ROLES.filter(
  (role) => CLAIM_EDGE_ROLE_TARGET_KIND[role] === 'evidence',
)

/**
 * Every statement string in these tables is a closed code or an opaque token, so prose,
 * filesystem paths, and human names are rejected by the table itself and not only by the
 * TypeScript contract.
 */
const CLAIM_GRAPH_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS evidence (
    evidence_id TEXT PRIMARY KEY NOT NULL CHECK (${opaque('evidence_id')}),
    layer TEXT NOT NULL CHECK (layer IN (${quoted(EVIDENCE_LAYERS)})),
    schema_version TEXT NOT NULL CHECK (schema_version = '${CANONICAL_ENVELOPE_SCHEMA_VERSION}'),
    coverage_id TEXT NOT NULL CHECK (${longOpaque('coverage_id')}),
    coverage_range_start TEXT NOT NULL CHECK (${canonicalTimestamp('coverage_range_start')}),
    coverage_job_id TEXT NOT NULL CHECK (${opaque('coverage_job_id')}),
    -- deliberate NO ACTION: deletion order and tombstone cascade deferred to DL-LIFE-02 (issue #80)
    FOREIGN KEY (coverage_id, coverage_range_start, coverage_job_id)
      REFERENCES ${CLAIM_GRAPH_COVERAGE_TABLE}(coverage_id, range_start, job_id)
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS claim_scope (
    scope_id TEXT PRIMARY KEY NOT NULL CHECK (${opaque('scope_id')}),
    scope_alias TEXT CHECK (scope_alias IS NULL OR (${opaque('scope_alias')})),
    linked_at TEXT NOT NULL CHECK (${canonicalTimestamp('linked_at')})
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS claim (
    claim_id TEXT PRIMARY KEY NOT NULL CHECK (${claimIdentifier('claim_id')}),
    layer TEXT NOT NULL CHECK (layer IN (${quoted(CLAIM_LAYERS)})),
    statement_code TEXT NOT NULL CHECK (statement_code IN (${quoted(CLAIM_STATEMENT_CODES)})),
    method_id TEXT NOT NULL CHECK (${opaque('method_id')}),
    method_version TEXT NOT NULL CHECK (length(method_version) BETWEEN 1 AND 64 AND method_version NOT GLOB '*[^0-9A-Za-z.-]*'),
    window_start TEXT NOT NULL CHECK (${canonicalTimestamp('window_start')}),
    window_end TEXT NOT NULL CHECK (${canonicalTimestamp('window_end')}),
    scope_id TEXT NOT NULL REFERENCES claim_scope(scope_id),
    schema_version TEXT NOT NULL CHECK (schema_version = '${CLAIM_SCHEMA_VERSION}'),
    created_at TEXT NOT NULL CHECK (${canonicalTimestamp('created_at')}),
    superseded_by TEXT REFERENCES claim(claim_id),
    CHECK (window_start < window_end),
    CHECK (superseded_by IS NULL OR superseded_by <> claim_id),
    CHECK ((layer = 'abstention') = (statement_code = '${CLAIM_ABSTENTION_STATEMENT_CODE}'))
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS claim_stability_key ON claim (
    statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version
  )`,
  `CREATE TABLE IF NOT EXISTS claim_evidence_edge (
    claim_id TEXT NOT NULL REFERENCES claim(claim_id),
    role TEXT NOT NULL CHECK (role IN (${quoted(CLAIM_EDGE_ROLES)})),
    target_evidence_id TEXT REFERENCES evidence(evidence_id),
    target_claim_id TEXT REFERENCES claim(claim_id),
    target_coverage_id TEXT,
    target_coverage_range_start TEXT,
    target_coverage_job_id TEXT,
    -- deliberate NO ACTION: deletion order and tombstone cascade deferred to DL-LIFE-02 (issue #80)
    FOREIGN KEY (target_coverage_id, target_coverage_range_start, target_coverage_job_id)
      REFERENCES ${CLAIM_GRAPH_COVERAGE_TABLE}(coverage_id, range_start, job_id),
    CHECK ((target_evidence_id IS NOT NULL) + (target_claim_id IS NOT NULL) + (target_coverage_id IS NOT NULL) = 1),
    CHECK ((target_coverage_id IS NULL) = (target_coverage_range_start IS NULL)),
    CHECK ((target_coverage_id IS NULL) = (target_coverage_job_id IS NULL)),
    CHECK (
      (role = 'derives_from' AND target_claim_id IS NOT NULL) OR
      (role = 'coverage_basis' AND target_coverage_id IS NOT NULL) OR
      (role IN (${quoted(EVIDENCE_ROLES)}) AND target_evidence_id IS NOT NULL)
    ),
    CHECK (target_claim_id IS NULL OR target_claim_id <> claim_id)
  ) STRICT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS claim_evidence_edge_identity ON claim_evidence_edge (
    claim_id, role,
    COALESCE(target_evidence_id, target_claim_id, target_coverage_id),
    COALESCE(target_coverage_job_id, '')
  )`,
  `CREATE TABLE IF NOT EXISTS limitation_instance (
    claim_id TEXT NOT NULL REFERENCES claim(claim_id),
    limitation_code TEXT NOT NULL CHECK (limitation_code IN (${quoted(CLAIM_LIMITATION_CODES)})),
    dimension TEXT NOT NULL CHECK (dimension IN (${quoted(CLAIM_LIMITATION_DIMENSIONS)})),
    copy_key TEXT NOT NULL CHECK (${opaque('copy_key')}),
    PRIMARY KEY (claim_id, limitation_code, dimension)
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS lineage_event (
    subject_id TEXT NOT NULL CHECK (${longOpaque('subject_id')}),
    event_kind TEXT NOT NULL CHECK (event_kind IN (${quoted(LINEAGE_EVENT_KINDS)})),
    caused_by TEXT CHECK (caused_by IS NULL OR (${longOpaque('caused_by')})),
    occurred_at TEXT NOT NULL CHECK (${canonicalTimestamp('occurred_at')})
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS lineage_event_subject ON lineage_event (subject_id, occurred_at)`,
]

export const CLAIM_GRAPH_STORAGE_SQL = CLAIM_GRAPH_STATEMENTS
  .map((statement) => `${statement};`)
  .join('\n')

export type ClaimStorageErrorCode =
  | 'CLAIM_GRAPH_SCHEMA_MISMATCH'
  | 'CLAIM_GRAPH_PRECONDITION_MISSING'
  | 'CLAIM_GRAPH_CHECK_FAILED'
  | 'CLAIM_GRAPH_CONSTRAINT_FAILED'
  | 'CLAIM_CONTRACT_INVALID'
  | 'CLAIM_ID_COLLISION'
  | 'CLAIM_UNKNOWN'
  | 'CLAIM_SUPERSESSION_SERIES_MISMATCH'

/**
 * Errors carry a code and nothing else. Claim fields are caller-supplied, so an error
 * message must never echo them back into a log sink.
 */
export class ClaimStorageError extends Error {
  public readonly code: ClaimStorageErrorCode

  constructor(code: ClaimStorageErrorCode) {
    super(code)
    this.name = 'ClaimStorageError'
    this.code = code
  }
}

interface SchemaObject {
  readonly type: 'table' | 'index'
  readonly name: string
  readonly tableName: string
  readonly sql: string
}

interface SchemaRow {
  readonly type: string
  readonly name: string
  readonly tbl_name: string
  readonly sql: string | null
}

function parseSchemaObjects(statements: readonly string[]): SchemaObject[] {
  return statements.map((sql) => {
    const match = sql.match(
      /^\s*CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)/i,
    )
    if (!match) throw new ClaimStorageError('CLAIM_GRAPH_SCHEMA_MISMATCH')
    const type = match[1].toLowerCase() as SchemaObject['type']
    const name = match[2]
    const tableName = type === 'table' ? name : sql.match(/\bON\s+([A-Za-z_][A-Za-z0-9_]*)/i)?.[1]
    if (!tableName) throw new ClaimStorageError('CLAIM_GRAPH_SCHEMA_MISMATCH')
    return { type, name, tableName, sql }
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

const CLAIM_GRAPH_SCHEMA_OBJECTS = parseSchemaObjects(CLAIM_GRAPH_STATEMENTS)
const CLAIM_GRAPH_OBJECT_NAMES = CLAIM_GRAPH_SCHEMA_OBJECTS.map(({ name }) => name)

function readRelevantSchemaRows(
  db: Database.Database,
  catalog: 'sqlite_schema' | 'sqlite_temp_schema',
): SchemaRow[] {
  const namePlaceholders = CLAIM_GRAPH_OBJECT_NAMES.map(() => '?').join(', ')
  const tablePlaceholders = CLAIM_GRAPH_TABLES.map(() => '?').join(', ')
  return db.prepare(
    `SELECT type, name, tbl_name, sql FROM ${catalog}
     WHERE name IN (${namePlaceholders})
        OR (
          tbl_name IN (${tablePlaceholders})
          AND type IN ('index', 'trigger')
          AND name NOT GLOB 'sqlite_autoindex_*'
        )`,
  ).all(...CLAIM_GRAPH_OBJECT_NAMES, ...CLAIM_GRAPH_TABLES) as SchemaRow[]
}

/**
 * Both catalogs are read. A TEMP object shadows a main-schema one for every unqualified
 * statement, so checking `sqlite_schema` alone would let the installer report success on
 * a store where the module's own INSERTs resolve to the wrong table.
 */
function readOwnedSchemaRows(db: Database.Database): SchemaRow[] {
  return [
    ...readRelevantSchemaRows(db, 'sqlite_schema'),
    ...readRelevantSchemaRows(db, 'sqlite_temp_schema'),
  ]
}

function hasExpectedSchema(rows: readonly SchemaRow[]): boolean {
  if (rows.length !== CLAIM_GRAPH_SCHEMA_OBJECTS.length) return false
  const expected = new Map(CLAIM_GRAPH_SCHEMA_OBJECTS.map((object) => [object.name, object]))
  return rows.every((row) => {
    const object = expected.get(row.name)
    return object !== undefined
      && row.type === object.type
      && row.tbl_name === object.tableName
      && row.sql !== null
      && normalizeSchemaSql(row.sql) === normalizeSchemaSql(object.sql)
  })
}

function assertHealthyStorage(db: Database.Database): void {
  const checks = runStorageChecks(db)
  if (checks.integrity !== 'ok' || checks.quick !== 'ok' || checks.foreignKeys.length > 0) {
    throw new ClaimStorageError('CLAIM_GRAPH_CHECK_FAILED')
  }
}

/**
 * Installs the claim graph additively. The write is transactional: either every object
 * exists in exactly the expected shape, or nothing is created. An existing object whose
 * definition differs fails closed rather than being silently reused.
 */
export function installClaimGraphStorage(db: Database.Database): void {
  db.pragma('foreign_keys = ON')
  const coverageTable = db.prepare(
    "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?",
  ).pluck().get(CLAIM_GRAPH_COVERAGE_TABLE)
  if (coverageTable === undefined) {
    throw new ClaimStorageError('CLAIM_GRAPH_PRECONDITION_MISSING')
  }

  try {
    db.transaction(() => {
      const existing = readOwnedSchemaRows(db)
      if (existing.length > 0) {
        if (!hasExpectedSchema(existing)) throw new ClaimStorageError('CLAIM_GRAPH_SCHEMA_MISMATCH')
        assertHealthyStorage(db)
        return
      }
      db.exec(CLAIM_GRAPH_STORAGE_SQL)
      if (!hasExpectedSchema(readOwnedSchemaRows(db))) {
        throw new ClaimStorageError('CLAIM_GRAPH_SCHEMA_MISMATCH')
      }
      assertHealthyStorage(db)
    })()
  } catch (error) {
    if (error instanceof ClaimStorageError) throw error
    throw new ClaimStorageError('CLAIM_GRAPH_SCHEMA_MISMATCH')
  }
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new ClaimStorageError('CLAIM_CONTRACT_INVALID')
  return parsed.data
}

function write<T>(operation: () => T): T {
  try {
    return operation()
  } catch (error) {
    if (error instanceof ClaimStorageError) throw error
    throw new ClaimStorageError('CLAIM_GRAPH_CONSTRAINT_FAILED')
  }
}

/**
 * C2 write path. The alias VALUE is stored only here, keyed by the content-free
 * surrogate the C1 `claim` row carries. `linked_at` records when the link was first
 * established and is NOT advanced by a later re-registration: first link wins, so the
 * charter's 13-month alias-link boundary is computed from the true link time.
 */
export function registerClaimScope(db: Database.Database, value: unknown): void {
  const scope = parseOrThrow(ClaimScopeSchema, value)
  write(() => {
    db.prepare(
      'INSERT INTO claim_scope (scope_id, scope_alias, linked_at) VALUES (?, ?, ?) ON CONFLICT(scope_id) DO UPDATE SET scope_alias = excluded.scope_alias',
    ).run(scope.scopeId, scope.scopeAlias, scope.linkedAt)
  })
}

/** C2 read path, deliberately separate: no C1 claim read ever returns the alias value. */
export function readClaimScopeAlias(db: Database.Database, scopeId: string): string | null {
  const scope = parseOrThrow(OpaqueTokenSchema, scopeId)
  const row = db.prepare('SELECT scope_alias FROM claim_scope WHERE scope_id = ?')
    .pluck().get(scope) as string | null | undefined
  return row ?? null
}

/**
 * Clears the C2 alias value, leaving every C1 claim row and its stability-key series
 * intact. This is the erase step a retention sweeper would call; the sweeper that reads
 * `linked_at` and decides when the 13-month boundary has passed is future work
 * (issue #80).
 */
export function clearClaimScopeAlias(db: Database.Database, scopeId: string): number {
  const scope = parseOrThrow(OpaqueTokenSchema, scopeId)
  return write(() =>
    db.prepare('UPDATE claim_scope SET scope_alias = NULL WHERE scope_id = ?').run(scope).changes,
  )
}

/**
 * Registers the evidence anchor an edge resolves to: identity, layer, and the composite
 * key of the existing `coverage_ledger` row, which completes the ADR-01 walk
 * evidence -> coverage -> capability -> consent revision.
 */
export function registerEvidenceAnchor(db: Database.Database, value: unknown): void {
  const anchor = parseOrThrow(EvidenceAnchorSchema, value)
  write(() => {
    db.prepare(
      'INSERT INTO evidence (evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(
      anchor.evidenceId,
      anchor.layer,
      CANONICAL_ENVELOPE_SCHEMA_VERSION,
      anchor.coverage.coverageId,
      anchor.coverage.rangeStart,
      anchor.coverage.jobId,
    )
  })
}

export const RegisterClaimInputSchema = z
  .object({
    layer: ClaimLayerSchema,
    statementCode: ClaimStatementCodeSchema,
    methodId: OpaqueTokenSchema,
    methodVersion: MethodVersionSchema,
    windowStart: CanonicalTimestampSchema,
    windowEnd: CanonicalTimestampSchema,
    scopeId: OpaqueTokenSchema,
    createdAt: CanonicalTimestampSchema,
    edges: z.array(ClaimEvidenceEdgeSchema),
    limitations: z.array(LimitationInstanceSchema),
  })
  .strict()
export type RegisterClaimInput = z.infer<typeof RegisterClaimInputSchema>

export interface RegisterClaimResult {
  readonly claimId: string
  readonly applied: boolean
}

interface EdgeColumns {
  readonly role: string
  readonly targetEvidenceId: string | null
  readonly targetClaimId: string | null
  readonly targetCoverageId: string | null
  readonly targetCoverageRangeStart: string | null
  readonly targetCoverageJobId: string | null
}

function edgeColumns(edge: ClaimEvidenceEdge): EdgeColumns {
  if ('targetEvidenceId' in edge) {
    return {
      role: edge.role,
      targetEvidenceId: edge.targetEvidenceId,
      targetClaimId: null,
      targetCoverageId: null,
      targetCoverageRangeStart: null,
      targetCoverageJobId: null,
    }
  }
  if ('targetClaimId' in edge) {
    return {
      role: edge.role,
      targetEvidenceId: null,
      targetClaimId: edge.targetClaimId,
      targetCoverageId: null,
      targetCoverageRangeStart: null,
      targetCoverageJobId: null,
    }
  }
  const coverage = CoverageTargetSchema.parse(edge.targetCoverage)
  return {
    role: edge.role,
    targetEvidenceId: null,
    targetClaimId: null,
    targetCoverageId: coverage.coverageId,
    targetCoverageRangeStart: coverage.rangeStart,
    targetCoverageJobId: coverage.jobId,
  }
}

function edgeToken(columns: EdgeColumns): string {
  return [
    columns.role,
    columns.targetEvidenceId ?? '',
    columns.targetClaimId ?? '',
    columns.targetCoverageId ?? '',
    columns.targetCoverageRangeStart ?? '',
    columns.targetCoverageJobId ?? '',
  ].join('|')
}

interface ClaimRow {
  claim_id: string
  layer: string
  statement_code: string
  method_id: string
  method_version: string
  window_start: string
  window_end: string
  scope_id: string
  schema_version: string
  created_at: string
  superseded_by: string | null
}

function toClaimRecord(row: ClaimRow): ClaimRecord {
  return ClaimRecordSchema.parse({
    claimId: row.claim_id,
    layer: row.layer,
    statementCode: row.statement_code,
    methodId: row.method_id,
    methodVersion: row.method_version,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    scopeId: row.scope_id,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    supersededBy: row.superseded_by,
  })
}

/** C1 read path. Returns claim content only; the C2 alias is never joined in. */
export function readClaim(db: Database.Database, claimId: string): ClaimRecord | null {
  const parsedId = parseOrThrow(ClaimIdSchema, claimId)
  const row = db.prepare(
    'SELECT claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, created_at, superseded_by FROM claim WHERE claim_id = ?',
  ).get(parsedId) as ClaimRow | undefined
  return row ? toClaimRecord(row) : null
}

function readEdgeTokens(db: Database.Database, claimId: string): string[] {
  const rows = db.prepare(
    'SELECT role, target_evidence_id, target_claim_id, target_coverage_id, target_coverage_range_start, target_coverage_job_id FROM claim_evidence_edge WHERE claim_id = ?',
  ).all(claimId) as {
    role: string
    target_evidence_id: string | null
    target_claim_id: string | null
    target_coverage_id: string | null
    target_coverage_range_start: string | null
    target_coverage_job_id: string | null
  }[]
  return rows.map((row) => edgeToken({
    role: row.role,
    targetEvidenceId: row.target_evidence_id,
    targetClaimId: row.target_claim_id,
    targetCoverageId: row.target_coverage_id,
    targetCoverageRangeStart: row.target_coverage_range_start,
    targetCoverageJobId: row.target_coverage_job_id,
  })).sort()
}

function readLimitationTokens(db: Database.Database, claimId: string): string[] {
  const rows = db.prepare(
    'SELECT limitation_code, dimension, copy_key FROM limitation_instance WHERE claim_id = ?',
  ).all(claimId) as { limitation_code: string; dimension: string; copy_key: string }[]
  return rows.map((row) => [row.limitation_code, row.dimension, row.copy_key].join('|')).sort()
}

/**
 * Registers one claim with its edges and limitations in a single transaction. The claim
 * ID is derived, never supplied: replaying identical inputs reproduces the same ID and is
 * a no-op, while the same ID with different content fails closed.
 */
export function registerClaim(db: Database.Database, value: unknown): RegisterClaimResult {
  const input = parseOrThrow(RegisterClaimInputSchema, value)
  const edges = input.edges.map(edgeColumns)
  const evidenceIds = edges
    .map((edge) => edge.targetEvidenceId)
    .filter((id): id is string => id !== null)

  const claim = parseOrThrow(ClaimRecordSchema, {
    claimId: computeClaimId({
      statementCode: input.statementCode,
      methodId: input.methodId,
      methodVersion: input.methodVersion,
      evidenceIds,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      scopeId: input.scopeId,
      schemaVersion: CLAIM_SCHEMA_VERSION,
    }),
    layer: input.layer,
    statementCode: input.statementCode,
    methodId: input.methodId,
    methodVersion: input.methodVersion,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    scopeId: input.scopeId,
    schemaVersion: CLAIM_SCHEMA_VERSION,
    createdAt: input.createdAt,
    supersededBy: null,
  })

  const edgeTokens = [...new Set(edges.map(edgeToken))].sort()
  const limitationTokens = [
    ...new Set(input.limitations.map((limitation) =>
      [limitation.limitationCode, limitation.dimension, limitation.copyKey].join('|'),
    )),
  ].sort()

  const apply = db.transaction((): boolean => {
    const existing = readClaim(db, claim.claimId)
    if (existing) {
      const sameClaim = existing.layer === claim.layer
        && existing.statementCode === claim.statementCode
        && existing.methodId === claim.methodId
        && existing.methodVersion === claim.methodVersion
        && existing.windowStart === claim.windowStart
        && existing.windowEnd === claim.windowEnd
        && existing.scopeId === claim.scopeId
        && existing.schemaVersion === claim.schemaVersion
        && existing.createdAt === claim.createdAt
      const sameEdges = readEdgeTokens(db, claim.claimId).join('\n') === edgeTokens.join('\n')
      const sameLimitations =
        readLimitationTokens(db, claim.claimId).join('\n') === limitationTokens.join('\n')
      if (!sameClaim || !sameEdges || !sameLimitations) {
        throw new ClaimStorageError('CLAIM_ID_COLLISION')
      }
      return false
    }

    db.prepare(
      'INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, created_at, superseded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
    ).run(
      claim.claimId,
      claim.layer,
      claim.statementCode,
      claim.methodId,
      claim.methodVersion,
      claim.windowStart,
      claim.windowEnd,
      claim.scopeId,
      claim.schemaVersion,
      claim.createdAt,
    )

    const insertEdge = db.prepare(
      'INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id, target_claim_id, target_coverage_id, target_coverage_range_start, target_coverage_job_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    for (const edge of edges) {
      insertEdge.run(
        claim.claimId,
        edge.role,
        edge.targetEvidenceId,
        edge.targetClaimId,
        edge.targetCoverageId,
        edge.targetCoverageRangeStart,
        edge.targetCoverageJobId,
      )
    }

    const insertLimitation = db.prepare(
      'INSERT INTO limitation_instance (claim_id, limitation_code, dimension, copy_key) VALUES (?, ?, ?, ?)',
    )
    for (const limitation of input.limitations) {
      insertLimitation.run(
        claim.claimId,
        limitation.limitationCode,
        limitation.dimension,
        limitation.copyKey,
      )
    }
    return true
  })

  return { claimId: claim.claimId, applied: write(apply) }
}

const SupersedeClaimInputSchema = z
  .object({ claimId: ClaimIdSchema, supersededBy: ClaimIdSchema })
  .strict()

/**
 * Links a claim to its successor. Both claims must share a stability key: a supersession
 * chain is a series within one statement/method/window/scope, never across scopes.
 */
export function supersedeClaim(db: Database.Database, value: unknown): void {
  const input = parseOrThrow(SupersedeClaimInputSchema, value)
  if (input.claimId === input.supersededBy) throw new ClaimStorageError('CLAIM_CONTRACT_INVALID')

  const apply = db.transaction(() => {
    const claim = readClaim(db, input.claimId)
    const successor = readClaim(db, input.supersededBy)
    if (!claim || !successor) throw new ClaimStorageError('CLAIM_UNKNOWN')
    if (
      claimStabilityKeyToken(claimStabilityKey(claim)) !==
      claimStabilityKeyToken(claimStabilityKey(successor))
    ) {
      throw new ClaimStorageError('CLAIM_SUPERSESSION_SERIES_MISMATCH')
    }
    db.prepare('UPDATE claim SET superseded_by = ? WHERE claim_id = ?')
      .run(input.supersededBy, input.claimId)
  })
  write(apply)
}

/** Appends a correction / revocation / export lineage event. Append-only by contract. */
export function registerLineageEvent(db: Database.Database, value: unknown): void {
  const event = parseOrThrow(LineageEventSchema, value)
  write(() => {
    db.prepare(
      'INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)',
    ).run(event.subjectId, event.eventKind, event.causedBy, event.occurredAt)
  })
}
