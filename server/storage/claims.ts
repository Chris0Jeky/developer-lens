import { randomBytes } from 'node:crypto'
import type Database from 'better-sqlite3'
import { z } from 'zod'
import {
  CLAIM_EDGE_ROLES,
  CLAIM_EDGE_ROLE_TARGET_KIND,
  CLAIM_ID_MATERIAL_VERSION,
  CLAIM_ID_MATERIAL_VERSIONS,
  CLAIM_LAYERS,
  CLAIM_LIMITATION_CODES,
  CLAIM_LIMITATION_DIMENSIONS,
  CLAIM_SCHEMA_VERSION,
  CLAIM_SCOPE_ID_ENTROPY_BYTES,
  CLAIM_SCOPE_ID_PREFIX,
  CLAIM_STATEMENT_CODES,
  CLAIM_ABSTENTION_STATEMENT_CODE,
  CanonicalTimestampSchema,
  ClaimEvidenceEdgeSchema,
  ClaimIdSchema,
  ClaimLayerSchema,
  ClaimRecordSchema,
  ClaimScopeIdSchema,
  ClaimStatementCodeSchema,
  CoverageTargetSchema,
  EvidenceAnchorSchema,
  LimitationInstanceSchema,
  LineageEventSchema,
  LINEAGE_EVENT_KINDS,
  MethodVersionSchema,
  OpaqueTokenSchema,
  claimMayCiteLayer,
  claimStabilityKey,
  claimStabilityKeyToken,
  computeClaimId,
  type CitableLayer,
  type ClaimEvidenceEdge,
  type ClaimLayer,
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

/**
 * Canonical lifecycle metadata for ADR-01 claim-graph storage.  These entries are
 * intentionally adjacent to the table registry rather than copied into a procedural
 * deletion list.
 */
export interface ClaimGraphTableRegistryEntry {
  readonly tableName: ClaimGraphTable
  readonly capabilityId: 'github.core'
  readonly deletionRole: 'scope-root' | 'dependent' | 'lineage'
  /** Parent tables referenced by this table's cross-table foreign keys. */
  readonly dependsOn: readonly string[]
  /** SQLite enforces this dependency within one DELETE statement, not planner order. */
  readonly selfReferentialForeignKeys: boolean
  /** An affected row identifier that may be removed before the tombstone is written. */
  readonly lineageSubjectColumn?: string
}

export const CLAIM_GRAPH_TABLE_REGISTRY = [
  {
    tableName: 'evidence',
    capabilityId: 'github.core',
    deletionRole: 'dependent',
    dependsOn: ['coverage_ledger'],
    selfReferentialForeignKeys: false,
    lineageSubjectColumn: 'evidence_id',
  },
  {
    tableName: 'claim_scope',
    capabilityId: 'github.core',
    deletionRole: 'scope-root',
    dependsOn: [],
    selfReferentialForeignKeys: false,
    lineageSubjectColumn: 'scope_id',
  },
  {
    tableName: 'claim',
    capabilityId: 'github.core',
    deletionRole: 'dependent',
    dependsOn: ['claim_scope'],
    selfReferentialForeignKeys: true,
    lineageSubjectColumn: 'claim_id',
  },
  {
    tableName: 'claim_evidence_edge',
    capabilityId: 'github.core',
    deletionRole: 'dependent',
    dependsOn: ['claim', 'evidence', 'coverage_ledger'],
    selfReferentialForeignKeys: false,
  },
  {
    tableName: 'limitation_instance',
    capabilityId: 'github.core',
    deletionRole: 'dependent',
    dependsOn: ['claim'],
    selfReferentialForeignKeys: false,
  },
  {
    tableName: 'lineage_event',
    capabilityId: 'github.core',
    deletionRole: 'lineage',
    dependsOn: [],
    selfReferentialForeignKeys: false,
  },
] as const satisfies readonly ClaimGraphTableRegistryEntry[]

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
/**
 * The minted C1 scope surrogate: `scope-` plus 64 lowercase hex digits. The CHECK is what
 * makes "the C2 alias value can never become the scope_id" a table-level property rather
 * than a convention — an alias is an opaque token of arbitrary shape and cannot satisfy it
 * unless it is itself already a surrogate, and the writer never copies an alias here.
 */
const claimScopeIdentifier = (column: string): string =>
  `length(${column}) = ${CLAIM_SCOPE_ID_PREFIX.length + CLAIM_SCOPE_ID_ENTROPY_BYTES * 2}`
  + ` AND ${column} GLOB '${CLAIM_SCOPE_ID_PREFIX}*'`
  + ` AND substr(${column}, ${CLAIM_SCOPE_ID_PREFIX.length + 1}) NOT GLOB '*[^0-9a-f]*'`

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
    scope_id TEXT PRIMARY KEY NOT NULL CHECK (${claimScopeIdentifier('scope_id')}),
    scope_alias TEXT CHECK (scope_alias IS NULL OR (${opaque('scope_alias')})),
    linked_at TEXT NOT NULL CHECK (${canonicalTimestamp('linked_at')})
  ) STRICT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS claim_scope_alias ON claim_scope (scope_alias)
    WHERE scope_alias IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS claim (
    claim_id TEXT PRIMARY KEY NOT NULL CHECK (${claimIdentifier('claim_id')}),
    layer TEXT NOT NULL CHECK (layer IN (${quoted(CLAIM_LAYERS)})),
    statement_code TEXT NOT NULL CHECK (statement_code IN (${quoted(CLAIM_STATEMENT_CODES)})),
    method_id TEXT NOT NULL CHECK (${opaque('method_id')}),
    method_version TEXT NOT NULL CHECK (length(method_version) BETWEEN 1 AND 64 AND method_version NOT GLOB '*[^0-9A-Za-z.-]*'),
    window_start TEXT NOT NULL CHECK (${canonicalTimestamp('window_start')}),
    window_end TEXT NOT NULL CHECK (${canonicalTimestamp('window_end')}),
    scope_id TEXT NOT NULL REFERENCES claim_scope(scope_id) CHECK (${claimScopeIdentifier('scope_id')}),
    schema_version TEXT NOT NULL CHECK (schema_version = '${CLAIM_SCHEMA_VERSION}'),
    -- Every STORABLE version, not only the one this writer emits. Pinning a single value would
    -- make a v3 rollout a table rebuild and leave the replay version check tautological.
    -- (No apostrophes in this DDL: see the note on normalizeSchemaSql.)
    claim_id_material_version TEXT NOT NULL CHECK (claim_id_material_version IN (${quoted(CLAIM_ID_MATERIAL_VERSIONS)})),
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
  /** ADR-01 failure clause: one canonicalisation version reproduced an ID over different content. */
  | 'CLAIM_ID_COLLISION'
  /**
   * A stored row was derived under a different canonicalisation version than the current
   * writer's. Its content is not comparable and must not be acted on. Unreachable while
   * `CLAIM_ID_MATERIAL_VERSIONS` has one entry; reachable the day a v3 is appended.
   */
  | 'CLAIM_ID_MATERIAL_VERSION_MISMATCH'
  /** A minted scope surrogate collided with the C2 alias it was minted for. */
  | 'CLAIM_SCOPE_SURROGATE_COLLISION'
  | 'CLAIM_UNKNOWN'
  /** A claim cited a target weaker than its own layer (ADR-26 relabelling guard). */
  | 'CLAIM_LAYER_ORDER_VIOLATION'
  /** The same evidence ID was re-registered with different anchor content. */
  | 'CLAIM_EVIDENCE_ANCHOR_CONFLICT'
  | 'CLAIM_SUPERSESSION_SERIES_MISMATCH'
  /** The claim already points at a different successor; supersession is never re-pointed. */
  | 'CLAIM_SUPERSESSION_CONFLICT'
  /** The link would close a cycle in the supersession chain. */
  | 'CLAIM_SUPERSESSION_CYCLE'

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

/**
 * Keyword case and whitespace are insignificant to SQLite; the contents of a string literal
 * are not. `layer IN ('deterministic')` and `layer IN ('DETERMINISTIC')` are different
 * constraints, so lowercasing the whole statement would let a store whose CHECK literals
 * differ in case pass the shape comparison. Only the spans *outside* single-quoted literals
 * are normalized; literal spans are compared byte-for-byte.
 *
 * The scanner tracks single quotes only. An apostrophe inside a `--` comment would desync it and
 * mis-classify the remainder of the statement as literal text. The DDL above contains no such
 * apostrophe and must keep containing none — that is a constraint on this file, not a claim
 * about SQL in general.
 */
function normalizeSchemaSql(sql: string): string {
  const trimmed = sql.replace(/;\s*$/, '')
  const parts: string[] = []
  let index = 0
  while (index < trimmed.length) {
    const quote = trimmed.indexOf("'", index)
    const outside = quote === -1 ? trimmed.slice(index) : trimmed.slice(index, quote)
    parts.push(outside.replace(/\bIF\s+NOT\s+EXISTS\b/gi, '').replace(/\s+/g, ' ').toLowerCase())
    if (quote === -1) break
    let end = quote + 1
    while (end < trimmed.length && (trimmed[end] !== "'" || trimmed[end + 1] === "'")) {
      end += trimmed[end] === "'" ? 2 : 1
    }
    if (end >= trimmed.length) throw new ClaimStorageError('CLAIM_GRAPH_SCHEMA_MISMATCH')
    parts.push(trimmed.slice(quote, end + 1))
    index = end + 1
  }
  return parts.join('').replace(/^ | $/g, '')
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

/** Read-only schema assertion used by lifecycle planning before any deletion is attempted. */
export function assertClaimGraphStorageSchema(db: Database.Database): void {
  if (!hasExpectedSchema(readOwnedSchemaRows(db))) {
    throw new ClaimStorageError('CLAIM_GRAPH_SCHEMA_MISMATCH')
  }
  assertHealthyStorage(db)
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

export const RegisterClaimScopeInputSchema = z
  .object({ scopeAlias: OpaqueTokenSchema, linkedAt: CanonicalTimestampSchema })
  .strict()
export type RegisterClaimScopeInput = z.infer<typeof RegisterClaimScopeInputSchema>

export interface ClaimScopeRegistration {
  /** The C1 surrogate to put on claims. Minted here; never supplied by the caller. */
  readonly scopeId: string
  /** The first link time for this alias, which a later re-registration does not advance. */
  readonly linkedAt: string
  readonly minted: boolean
}

type EntropySource = (size: number) => Buffer

/**
 * The surrogate is 32 random bytes, not a digest of anything. Two reasons, and neither is a
 * claim that a keyed digest would be linkable across installations — an installation-keyed
 * HMAC is not, and this repo already uses exactly that construction for its provider aliases
 * (`server/storage/installationAliases.ts`):
 *
 * 1. **Classification.** A digest of a C2 value is a *function of* a C2 value, and the
 *    evidence catalog already classifies HMAC-derived stable IDs as C2 (13-month). A derived
 *    surrogate could not honestly be stored as C1 and hashed into C1 claim IDs.
 * 2. **Erasure, which alone decides the design.** A derivation stays computable after the
 *    alias is cleared, so the link could be re-established from the alias at any later date —
 *    the 13-month boundary would erase a row, not a capability. Random-and-looked-up means
 *    that once `scope_alias` is NULL, no function reproduces the link.
 */
function mintClaimScopeId(entropy: EntropySource): string {
  const bytes = entropy(CLAIM_SCOPE_ID_ENTROPY_BYTES)
  if (!Buffer.isBuffer(bytes) || bytes.length !== CLAIM_SCOPE_ID_ENTROPY_BYTES) {
    throw new ClaimStorageError('CLAIM_GRAPH_CONSTRAINT_FAILED')
  }
  return parseOrThrow(ClaimScopeIdSchema, `${CLAIM_SCOPE_ID_PREFIX}${bytes.toString('hex')}`)
}

/**
 * C2 write path. The caller supplies only the alias VALUE; the content-free `scope_id` the
 * C1 `claim` row carries is minted here and returned. Re-registering the same alias is
 * idempotent — it returns the existing surrogate and does NOT advance `linked_at`, so the
 * charter's 13-month alias-link boundary is computed from the true first-link time, and
 * replay reproduces identical claim IDs because the scope component is unchanged.
 *
 * After `clearClaimScopeAlias`, re-registering the same alias mints a NEW surrogate: the
 * erased link is not silently re-established, and the new claims form a new series.
 */
function registerClaimScopeCore(
  db: Database.Database,
  value: unknown,
  entropy: EntropySource,
): ClaimScopeRegistration {
  const input = parseOrThrow(RegisterClaimScopeInputSchema, value)
  const apply = db.transaction((): ClaimScopeRegistration => {
    const existing = db.prepare(
      'SELECT scope_id, linked_at FROM claim_scope WHERE scope_alias = ?',
    ).get(input.scopeAlias) as { scope_id: string; linked_at: string } | undefined
    if (existing) {
      return {
        scopeId: parseOrThrow(ClaimScopeIdSchema, existing.scope_id),
        linkedAt: parseOrThrow(CanonicalTimestampSchema, existing.linked_at),
        minted: false,
      }
    }
    const scopeId = mintClaimScopeId(entropy)
    /**
     * The C1 surrogate is never the C2 alias value. Random minting makes this overwhelmingly
     * likely but not structural — an alias may itself be `scope-` + 64 hex, and an entropy
     * source can be chosen — so it is enforced rather than assumed.
     */
    if (scopeId === input.scopeAlias) {
      throw new ClaimStorageError('CLAIM_SCOPE_SURROGATE_COLLISION')
    }
    db.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at) VALUES (?, ?, ?)')
      .run(scopeId, input.scopeAlias, input.linkedAt)
    return { scopeId, linkedAt: input.linkedAt, minted: true }
  })
  return write(apply)
}

export function registerClaimScope(db: Database.Database, value: unknown): ClaimScopeRegistration {
  return registerClaimScopeCore(db, value, randomBytes)
}

/**
 * @internal Invented-fixture seams only.
 *
 * The seam injects the ENTROPY, not the surrogate — the result is still `scope-` + hex of
 * those bytes. That constrains the SHAPE but not the value: chosen bytes make a surrogate
 * predictable, which real minting never is, and could even reproduce an alias that happens to
 * be `scope-` + 64 hex. The alias-equals-surrogate case is refused by the writer itself
 * (`CLAIM_SCOPE_SURROGATE_COLLISION`), so that one cannot be reached through the seam either;
 * predictability is the residual, and it is why this stays test-only.
 */
export const claimScopeTestSeams = Object.freeze({
  registerWithEntropy(
    db: Database.Database,
    value: unknown,
    entropy: EntropySource,
  ): ClaimScopeRegistration {
    return registerClaimScopeCore(db, value, entropy)
  },
})

/** C2 read path, deliberately separate: no C1 claim read ever returns the alias value. */
export function readClaimScopeAlias(db: Database.Database, scopeId: string): string | null {
  const scope = parseOrThrow(ClaimScopeIdSchema, scopeId)
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
  const scope = parseOrThrow(ClaimScopeIdSchema, scopeId)
  return write(() =>
    db.prepare('UPDATE claim_scope SET scope_alias = NULL WHERE scope_id = ?').run(scope).changes,
  )
}

export interface RegisterEvidenceAnchorResult {
  readonly applied: boolean
}

/**
 * Registers the evidence anchor an edge resolves to: identity, layer, and the composite
 * key of the existing `coverage_ledger` row, which completes the ADR-01 walk
 * evidence -> coverage -> capability -> consent revision.
 *
 * Idempotent, like every other writer here: re-registering identical content is a no-op
 * (`applied: false`) so a replay does not have to know what a previous run already wrote.
 * Re-registering the same evidence ID with *different* content is content drift and fails
 * with its own code rather than a generic constraint failure.
 */
export function registerEvidenceAnchor(
  db: Database.Database,
  value: unknown,
): RegisterEvidenceAnchorResult {
  const anchor = parseOrThrow(EvidenceAnchorSchema, value)
  const apply = db.transaction((): RegisterEvidenceAnchorResult => {
    const existing = db.prepare(
      'SELECT layer, schema_version, coverage_id, coverage_range_start, coverage_job_id FROM evidence WHERE evidence_id = ?',
    ).get(anchor.evidenceId) as {
      layer: string
      schema_version: string
      coverage_id: string
      coverage_range_start: string
      coverage_job_id: string
    } | undefined
    if (existing) {
      const same = existing.layer === anchor.layer
        && existing.schema_version === CANONICAL_ENVELOPE_SCHEMA_VERSION
        && existing.coverage_id === anchor.coverage.coverageId
        && existing.coverage_range_start === anchor.coverage.rangeStart
        && existing.coverage_job_id === anchor.coverage.jobId
      if (!same) throw new ClaimStorageError('CLAIM_EVIDENCE_ANCHOR_CONFLICT')
      return { applied: false }
    }
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
    return { applied: true }
  })
  return write(apply)
}

export const RegisterClaimInputSchema = z
  .object({
    layer: ClaimLayerSchema,
    statementCode: ClaimStatementCodeSchema,
    methodId: OpaqueTokenSchema,
    methodVersion: MethodVersionSchema,
    windowStart: CanonicalTimestampSchema,
    windowEnd: CanonicalTimestampSchema,
    scopeId: ClaimScopeIdSchema,
    createdAt: CanonicalTimestampSchema,
    /**
     * At least one typed basis edge: an unsupported statement has no walk and cannot enter.
     *
     * Contract-only, and deliberately so — "this claim has >= 1 row in another table" is a
     * cross-row cardinality constraint that a SQLite row CHECK cannot express. A claim inserted
     * by raw SQL with no edges is therefore representable in the table; it surfaces downstream
     * as a claim whose evidence walk returns nothing rather than as a write failure. Accepted
     * residual: every writer in this module goes through this schema.
     */
    edges: z.array(ClaimEvidenceEdgeSchema).min(1),
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
  claim_id_material_version: string
  created_at: string
  superseded_by: string | null
}

const CLAIM_COLUMNS =
  'claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at, superseded_by'

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
    claimIdMaterialVersion: row.claim_id_material_version,
    createdAt: row.created_at,
    supersededBy: row.superseded_by,
  })
}

/** C1 read path. Returns claim content only; the C2 alias is never joined in. */
export function readClaim(db: Database.Database, claimId: string): ClaimRecord | null {
  const parsedId = parseOrThrow(ClaimIdSchema, claimId)
  const row = db.prepare(
    `SELECT ${CLAIM_COLUMNS} FROM claim WHERE claim_id = ?`,
  ).get(parsedId) as ClaimRow | undefined
  return row ? toClaimRecord(row) : null
}

/**
 * Refuses to ACT on a row derived under a canonicalisation version other than this writer's.
 * A missing row is not a mismatch — a first write has nothing to disagree with.
 *
 * Reads the column directly instead of going through `readClaim`, deliberately: the row
 * contract admits only versions this build knows about, so a writer that met a row from a
 * NEWER build would fail to parse it and report a contract error instead of the honest
 * version mismatch. The gate must not depend on the gated row satisfying the current contract.
 *
 * Equally deliberately not applied inside `readClaim` itself: reading is how a mismatch gets
 * discovered, and a resolver must still be able to display a claim it is not allowed to
 * rewrite. Every path that COMPARES or MUTATES a stored row calls this.
 */
function assertCurrentMaterialVersion(db: Database.Database, claimId: string): void {
  const stored = db.prepare(
    'SELECT claim_id_material_version FROM claim WHERE claim_id = ?',
  ).pluck().get(claimId) as string | undefined
  if (stored !== undefined && stored !== CLAIM_ID_MATERIAL_VERSION) {
    throw new ClaimStorageError('CLAIM_ID_MATERIAL_VERSION_MISMATCH')
  }
}

/**
 * Resolves the layer of every edge target and enforces the dependency order. A missing
 * target is reported as the same constraint failure the FK would raise, so the check
 * cannot be used to probe which IDs exist by error code alone.
 *
 * Coverage targets are `coverage_ledger` rows — deterministic ledger facts at the
 * `observed` end of the ladder — so they satisfy the rule for every citing layer; their
 * existence stays an FK concern.
 */
function assertLayerDependencyOrder(
  db: Database.Database,
  layer: ClaimLayer,
  edges: readonly EdgeColumns[],
): void {
  const evidenceLayer = db.prepare('SELECT layer FROM evidence WHERE evidence_id = ?').pluck()
  const claimLayer = db.prepare('SELECT layer FROM claim WHERE claim_id = ?').pluck()
  for (const edge of edges) {
    const target = edge.targetEvidenceId !== null
      ? evidenceLayer.get(edge.targetEvidenceId)
      : edge.targetClaimId !== null ? claimLayer.get(edge.targetClaimId) : null
    if (target === null) continue
    if (typeof target !== 'string') throw new ClaimStorageError('CLAIM_GRAPH_CONSTRAINT_FAILED')
    if (!claimMayCiteLayer(layer, target as CitableLayer)) {
      throw new ClaimStorageError('CLAIM_LAYER_ORDER_VIOLATION')
    }
  }
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

  /**
   * Duplicate-bearing input is valid input: the same basis edge or limitation supplied twice
   * describes the same fact twice. Dedup once, here, and use the deduped sets for BOTH the
   * insert and the replay comparison — inserting the raw array while comparing the deduped
   * set is what made a legal duplicate hard-fail on the unique index.
   */
  const edges = [...new Map(input.edges.map((edge) => {
    const columns = edgeColumns(edge)
    return [edgeToken(columns), columns] as const
  })).values()]
  const edgeTokens = edges.map(edgeToken).sort()
  const limitations = [...new Map(input.limitations.map((limitation) => [
    [limitation.limitationCode, limitation.dimension, limitation.copyKey].join('|'),
    limitation,
  ] as const)).values()]
  const limitationTokens = limitations.map((limitation) =>
    [limitation.limitationCode, limitation.dimension, limitation.copyKey].join('|'),
  ).sort()

  const claim = parseOrThrow(ClaimRecordSchema, {
    claimId: computeClaimId({
      layer: input.layer,
      statementCode: input.statementCode,
      methodId: input.methodId,
      methodVersion: input.methodVersion,
      basis: input.edges,
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
    claimIdMaterialVersion: CLAIM_ID_MATERIAL_VERSION,
    createdAt: input.createdAt,
    supersededBy: null,
  })

  const apply = db.transaction((): boolean => {
    /**
     * Version first, ahead of the read and separately from the content comparison.
     * `CLAIM_ID_COLLISION` means drift under ONE canonicalisation version; if the stored row
     * was derived under a different version, its fields are not comparable to ours at all and
     * the honest answer is a distinct error, not a collision verdict. This is the branch that
     * stops being dead the day a v3 is appended to `CLAIM_ID_MATERIAL_VERSIONS`.
     */
    assertCurrentMaterialVersion(db, claim.claimId)
    const existing = readClaim(db, claim.claimId)
    if (existing) {
      /**
       * `createdAt` is deliberately absent from this comparison. It is not ID material, so a
       * genuine replay of identical inputs at a later wall-clock must be a no-op, not a
       * collision. First write wins: the stored `created_at` is never rewritten. What remains
       * comparable is the content that is NOT ID material — limitations above all — so
       * `CLAIM_ID_COLLISION` now means exactly "content drift under one canonicalisation
       * version" (ADR-01's failure clause), never "the clock moved".
       */
      const sameClaim = existing.layer === claim.layer
        && existing.statementCode === claim.statementCode
        && existing.methodId === claim.methodId
        && existing.methodVersion === claim.methodVersion
        && existing.windowStart === claim.windowStart
        && existing.windowEnd === claim.windowEnd
        && existing.scopeId === claim.scopeId
        && existing.schemaVersion === claim.schemaVersion
      const sameEdges = readEdgeTokens(db, claim.claimId).join('\n') === edgeTokens.join('\n')
      const sameLimitations =
        readLimitationTokens(db, claim.claimId).join('\n') === limitationTokens.join('\n')
      if (!sameClaim || !sameEdges || !sameLimitations) {
        throw new ClaimStorageError('CLAIM_ID_COLLISION')
      }
      return false
    }

    assertLayerDependencyOrder(db, claim.layer, edges)

    db.prepare(
      `INSERT INTO claim (${CLAIM_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
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
      claim.claimIdMaterialVersion,
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
    for (const limitation of limitations) {
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
 * Bound on the forward walk. The visited set already makes the walk terminate on any cyclic
 * store — including a cycle that does NOT contain the claim being linked, which is the case a
 * "does the chain reach me?" check alone would miss. This is the second, independent bound: an
 * acyclic but pathologically long chain cannot hold the transaction open either. Both refusals
 * report `CLAIM_SUPERSESSION_CYCLE`, since from the writer's side an unwalkable chain and a
 * cyclic one are the same refusal.
 */
const SUPERSESSION_WALK_LIMIT = 4096

/**
 * Links a claim to its successor. A supersession chain is a series within one
 * statement/method/window/scope — and within one layer: relabelling a modelled claim as its
 * hypothesis "successor" is the ADR-26 violation the layer equality closes, even though the
 * indexed stability tuple follows ADR-01 and does not carry `layer`.
 *
 * Three invariants make the chain a DAG that DL-SPINE-03's walk can terminate on:
 * - a claim is never re-pointed once superseded (re-pointing the SAME successor is an
 *   idempotent no-op, so a replayed correction does not fail);
 * - the successor chain is walked forward before the write, and a link that would reach the
 *   claim again is refused;
 * - the walk itself is bounded twice, by a visited set and by a step limit, so it terminates
 *   even on a store that was made cyclic out of band.
 */
export function supersedeClaim(db: Database.Database, value: unknown): void {
  const input = parseOrThrow(SupersedeClaimInputSchema, value)
  if (input.claimId === input.supersededBy) throw new ClaimStorageError('CLAIM_CONTRACT_INVALID')

  const apply = db.transaction(() => {
    // Linking two claims whose IDs were derived under different rules is exactly the
    // cross-version mutation the version stamp exists to refuse.
    assertCurrentMaterialVersion(db, input.claimId)
    assertCurrentMaterialVersion(db, input.supersededBy)
    const claim = readClaim(db, input.claimId)
    const successor = readClaim(db, input.supersededBy)
    if (!claim || !successor) throw new ClaimStorageError('CLAIM_UNKNOWN')
    if (
      claim.layer !== successor.layer ||
      claimStabilityKeyToken(claimStabilityKey(claim)) !==
      claimStabilityKeyToken(claimStabilityKey(successor))
    ) {
      throw new ClaimStorageError('CLAIM_SUPERSESSION_SERIES_MISMATCH')
    }
    if (claim.supersededBy !== null) {
      if (claim.supersededBy === input.supersededBy) return
      throw new ClaimStorageError('CLAIM_SUPERSESSION_CONFLICT')
    }

    const nextInChain = db.prepare('SELECT superseded_by FROM claim WHERE claim_id = ?').pluck()
    const visited = new Set<string>([claim.claimId])
    let cursor: string | null = successor.claimId
    for (let step = 0; cursor !== null; step += 1) {
      if (visited.has(cursor)) throw new ClaimStorageError('CLAIM_SUPERSESSION_CYCLE')
      if (step >= SUPERSESSION_WALK_LIMIT) throw new ClaimStorageError('CLAIM_SUPERSESSION_CYCLE')
      visited.add(cursor)
      cursor = (nextInChain.get(cursor) as string | null | undefined) ?? null
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
