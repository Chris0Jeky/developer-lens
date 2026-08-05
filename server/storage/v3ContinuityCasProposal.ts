import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { OperationIdV3Schema, ScopeIdV3Schema } from './v3Proposal.js'

/**
 * B2b-ii-i is an isolated CAS proposal for invented fixtures. It deliberately
 * has no database opener, scope initializer, continuity writer, artifact input,
 * lifecycle input, clock, retention field, production caller, or capability
 * activation path.
 */
export const V3_CONTINUITY_CAS_PROPOSAL_APPLICATION_ID = 0x444c4333
export const V3_CONTINUITY_CAS_PROPOSAL_USER_VERSION = 1

const MAX_REVISION = Number.MAX_SAFE_INTEGER
const ERROR_CODE = 'INVALID_V3_CONTINUITY_CAS_PROPOSAL' as const
const TABLES = Object.freeze([
  'continuity_cas_operation_proposal',
  'continuity_cas_state_proposal',
] as const)

interface SchemaObject {
  readonly type: 'table' | 'trigger'
  readonly name: string
  readonly tableName: string
  readonly sql: string
}

const SCHEMA_OBJECTS = Object.freeze([
  {
    type: 'table',
    name: 'continuity_cas_state_proposal',
    tableName: 'continuity_cas_state_proposal',
    sql: `CREATE TABLE continuity_cas_state_proposal (
  scope_id TEXT PRIMARY KEY
    CHECK (
      length(scope_id) = 70
      AND substr(scope_id, 1, 6) = 'scope-'
      AND substr(scope_id, 7) NOT GLOB '*[^0-9a-f]*'
    ),
  revision INTEGER NOT NULL
    CHECK (revision >= 0 AND revision <= ${MAX_REVISION})
) STRICT`,
  },
  {
    type: 'table',
    name: 'continuity_cas_operation_proposal',
    tableName: 'continuity_cas_operation_proposal',
    sql: `CREATE TABLE continuity_cas_operation_proposal (
  operation_id TEXT PRIMARY KEY
    CHECK (
      length(operation_id) = 67
      AND substr(operation_id, 1, 3) = 'op-'
      AND substr(operation_id, 4) NOT GLOB '*[^0-9a-f]*'
    ),
  scope_id TEXT NOT NULL,
  expected_revision INTEGER NOT NULL
    CHECK (expected_revision >= 0 AND expected_revision < ${MAX_REVISION}),
  applied_revision INTEGER NOT NULL
    CHECK (
      applied_revision > 0
      AND applied_revision <= ${MAX_REVISION}
      AND applied_revision = expected_revision + 1
    ),
  payload_sha256 TEXT NOT NULL
    CHECK (
      length(payload_sha256) = 64
      AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
    ),
  UNIQUE (scope_id, applied_revision),
  FOREIGN KEY (scope_id)
    REFERENCES continuity_cas_state_proposal(scope_id)
    ON DELETE RESTRICT
) STRICT`,
  },
  {
    type: 'trigger',
    name: 'continuity_cas_state_scope_immutable',
    tableName: 'continuity_cas_state_proposal',
    sql: `CREATE TRIGGER continuity_cas_state_scope_immutable
BEFORE UPDATE OF scope_id ON continuity_cas_state_proposal
BEGIN
  SELECT RAISE(ABORT, '${ERROR_CODE}');
END`,
  },
  {
    type: 'trigger',
    name: 'continuity_cas_state_revision_step',
    tableName: 'continuity_cas_state_proposal',
    sql: `CREATE TRIGGER continuity_cas_state_revision_step
BEFORE UPDATE OF revision ON continuity_cas_state_proposal
WHEN NEW.revision != OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, '${ERROR_CODE}');
END`,
  },
  {
    type: 'trigger',
    name: 'continuity_cas_state_no_delete',
    tableName: 'continuity_cas_state_proposal',
    sql: `CREATE TRIGGER continuity_cas_state_no_delete
BEFORE DELETE ON continuity_cas_state_proposal
BEGIN
  SELECT RAISE(ABORT, '${ERROR_CODE}');
END`,
  },
  {
    type: 'trigger',
    name: 'continuity_cas_operation_matches_state',
    tableName: 'continuity_cas_operation_proposal',
    sql: `CREATE TRIGGER continuity_cas_operation_matches_state
BEFORE INSERT ON continuity_cas_operation_proposal
WHEN NOT EXISTS (
  SELECT 1 FROM continuity_cas_state_proposal AS state
  WHERE state.scope_id = NEW.scope_id
    AND state.revision = NEW.applied_revision
)
BEGIN
  SELECT RAISE(ABORT, '${ERROR_CODE}');
END`,
  },
  {
    type: 'trigger',
    name: 'continuity_cas_operation_no_update',
    tableName: 'continuity_cas_operation_proposal',
    sql: `CREATE TRIGGER continuity_cas_operation_no_update
BEFORE UPDATE ON continuity_cas_operation_proposal
BEGIN
  SELECT RAISE(ABORT, '${ERROR_CODE}');
END`,
  },
  {
    type: 'trigger',
    name: 'continuity_cas_operation_no_delete',
    tableName: 'continuity_cas_operation_proposal',
    sql: `CREATE TRIGGER continuity_cas_operation_no_delete
BEFORE DELETE ON continuity_cas_operation_proposal
BEGIN
  SELECT RAISE(ABORT, '${ERROR_CODE}');
END`,
  },
] as const satisfies readonly SchemaObject[])

export const V3_CONTINUITY_CAS_PROPOSAL_SCHEMA_SQL = SCHEMA_OBJECTS
  .map(({ sql }) => `${sql};`)
  .join('\n')

interface SchemaRow {
  readonly type: string
  readonly name: string
  readonly tbl_name: string
  readonly sql: string | null
}

const normalizeSchemaSql = (sql: string): string => sql
  .replace(/;\s*$/, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([(),=+<>])\s*/g, '$1')
  .trim()
  .toLowerCase()

const fingerprintRows = (rows: readonly SchemaRow[]): string => createHash('sha256')
  .update(rows
    .map(({ type, name, tbl_name: tableName, sql }) => {
      if (sql === null) fail()
      return `${type}|${name}|${tableName}|${normalizeSchemaSql(sql)}`
    })
    .sort()
    .join('\n'))
  .digest('hex')

export const V3_CONTINUITY_CAS_PROPOSAL_SCHEMA_FINGERPRINT = fingerprintRows(
  SCHEMA_OBJECTS.map(({ type, name, tableName, sql }) => ({
    type,
    name,
    tbl_name: tableName,
    sql,
  })),
)

export type V3ContinuityCasProposalStatus = 'applied' | 'replayed' | 'stale' | 'conflict'

export interface V3ContinuityCasProposalResult {
  readonly kind: 'v3_continuity_cas_proposal'
  readonly status: V3ContinuityCasProposalStatus
}

const RESULTS = Object.freeze({
  applied: Object.freeze({ kind: 'v3_continuity_cas_proposal', status: 'applied' }),
  replayed: Object.freeze({ kind: 'v3_continuity_cas_proposal', status: 'replayed' }),
  stale: Object.freeze({ kind: 'v3_continuity_cas_proposal', status: 'stale' }),
  conflict: Object.freeze({ kind: 'v3_continuity_cas_proposal', status: 'conflict' }),
} as const satisfies Readonly<Record<V3ContinuityCasProposalStatus, V3ContinuityCasProposalResult>>)

export class V3ContinuityCasProposalError extends Error {
  public readonly code = ERROR_CODE

  constructor() {
    super(ERROR_CODE)
    this.name = 'V3ContinuityCasProposalError'
  }
}

function fail(): never {
  throw new V3ContinuityCasProposalError()
}

export interface V3ContinuityCasProposalInput {
  readonly scopeId: string
  readonly expectedRevision: number
  readonly operationId: string
  /** Opaque local-C2 receipt digest; this disposable fixture schema grants no production retention. */
  readonly payloadSha256: string
}

function parseInput(input: unknown): V3ContinuityCasProposalInput {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) fail()
  const prototype = Object.getPrototypeOf(input)
  if (prototype !== Object.prototype && prototype !== null) fail()
  const keys = Reflect.ownKeys(input)
  const expectedKeys = ['expectedRevision', 'operationId', 'payloadSha256', 'scopeId']
  if (keys.some((key) => typeof key !== 'string') || keys.length !== expectedKeys.length) fail()
  if ([...keys].sort().some((key, index) => key !== expectedKeys[index])) fail()

  const values: Record<string, unknown> = {}
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) fail()
    values[key] = descriptor.value
  }
  const scope = ScopeIdV3Schema.safeParse(values.scopeId)
  const operation = OperationIdV3Schema.safeParse(values.operationId)
  if (!scope.success || !operation.success) fail()
  if (
    typeof values.expectedRevision !== 'number'
    || !Number.isSafeInteger(values.expectedRevision)
    || values.expectedRevision < 0
    || values.expectedRevision >= MAX_REVISION
  ) fail()
  if (
    typeof values.payloadSha256 !== 'string'
    || !/^[0-9a-f]{64}$/.test(values.payloadSha256)
  ) fail()
  return Object.freeze({
    scopeId: scope.data,
    expectedRevision: values.expectedRevision,
    operationId: operation.data,
    payloadSha256: values.payloadSha256,
  })
}

function pragmaInteger(db: Database.Database, name: string): number {
  return Number(db.prepare(`PRAGMA ${name}`).pluck().get())
}

function hasAnyUserSchemaObject(db: Database.Database, schema: 'sqlite_schema' | 'sqlite_temp_schema'): boolean {
  return db.prepare(`SELECT 1 FROM ${schema} WHERE name NOT GLOB 'sqlite_*' LIMIT 1`).get() !== undefined
}

function installedSchemaFingerprint(db: Database.Database): string {
  return fingerprintRows(db.prepare(
    "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' ORDER BY type, name",
  ).all() as SchemaRow[])
}

function enableConnectionGuards(db: Database.Database): void {
  db.pragma('foreign_keys = ON')
  db.pragma('recursive_triggers = ON')
  if (pragmaInteger(db, 'foreign_keys') !== 1 || pragmaInteger(db, 'recursive_triggers') !== 1) fail()
}

function assertDatabaseConsistency(db: Database.Database): void {
  if (String(db.prepare('PRAGMA integrity_check').pluck().get()) !== 'ok') fail()
  if (String(db.prepare('PRAGMA quick_check').pluck().get()) !== 'ok') fail()
  if (db.prepare('PRAGMA foreign_key_check').get() !== undefined) fail()
  const inconsistent = db.prepare(
    `SELECT state.scope_id
     FROM continuity_cas_state_proposal AS state
     LEFT JOIN (
       SELECT scope_id, COUNT(*) AS operation_count, MAX(applied_revision) AS maximum_revision
       FROM continuity_cas_operation_proposal
       GROUP BY scope_id
     ) AS history ON history.scope_id = state.scope_id
     WHERE state.revision != COALESCE(history.operation_count, 0)
        OR state.revision != COALESCE(history.maximum_revision, 0)
     LIMIT 1`,
  ).get()
  if (inconsistent !== undefined) fail()
}

function assertInstalledTarget(db: Database.Database): void {
  if (
    pragmaInteger(db, 'application_id') !== V3_CONTINUITY_CAS_PROPOSAL_APPLICATION_ID
    || pragmaInteger(db, 'user_version') !== V3_CONTINUITY_CAS_PROPOSAL_USER_VERSION
    || hasAnyUserSchemaObject(db, 'sqlite_temp_schema')
  ) fail()
  const tables = (db.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
  ).all() as Array<{ name: string }>).map(({ name }) => name)
  if (tables.length !== TABLES.length || tables.some((name, index) => name !== TABLES[index])) fail()
  if (installedSchemaFingerprint(db) !== V3_CONTINUITY_CAS_PROPOSAL_SCHEMA_FINGERPRINT) fail()
  assertDatabaseConsistency(db)
}

/** Install the proposal into one strictly empty fixture database. */
export function installV3ContinuityCasProposal(db: Database.Database): void {
  try {
    if (db.inTransaction) fail()
    if (
      pragmaInteger(db, 'application_id') !== 0
      || pragmaInteger(db, 'user_version') !== 0
      || hasAnyUserSchemaObject(db, 'sqlite_schema')
      || hasAnyUserSchemaObject(db, 'sqlite_temp_schema')
    ) fail()
    enableConnectionGuards(db)
    const install = db.transaction(() => {
      db.pragma(`application_id = ${V3_CONTINUITY_CAS_PROPOSAL_APPLICATION_ID}`)
      db.pragma(`user_version = ${V3_CONTINUITY_CAS_PROPOSAL_USER_VERSION}`)
      db.exec(V3_CONTINUITY_CAS_PROPOSAL_SCHEMA_SQL)
      assertInstalledTarget(db)
    })
    install.immediate()
  } catch (error) {
    if (error instanceof V3ContinuityCasProposalError) throw error
    fail()
  }
}

interface OperationRow {
  readonly scope_id: string
  readonly expected_revision: number
  readonly applied_revision: number
  readonly payload_sha256: string
}

interface StateRow {
  readonly revision: number
}

export interface V3ContinuityCasProposalTestHooks {
  readonly afterStateMutation?: () => void
  readonly afterOperationInsert?: () => void
}

function executeApply(
  db: Database.Database,
  rawInput: unknown,
  testHooks?: V3ContinuityCasProposalTestHooks,
): V3ContinuityCasProposalResult {
  const input = parseInput(rawInput)
  if (db.inTransaction) fail()
  enableConnectionGuards(db)
  const apply = db.transaction((): V3ContinuityCasProposalResult => {
    assertInstalledTarget(db)
    const existingOperation = db.prepare(
      `SELECT scope_id, expected_revision, applied_revision, payload_sha256
       FROM continuity_cas_operation_proposal
       WHERE operation_id = ?`,
    ).get(input.operationId) as OperationRow | undefined
    const appliedRevision = input.expectedRevision + 1
    if (existingOperation) {
      if (
        existingOperation.scope_id !== input.scopeId
        || existingOperation.expected_revision !== input.expectedRevision
        || existingOperation.applied_revision !== appliedRevision
        || existingOperation.payload_sha256 !== input.payloadSha256
      ) return RESULTS.conflict
      const state = db.prepare(
        'SELECT revision FROM continuity_cas_state_proposal WHERE scope_id = ?',
      ).get(input.scopeId) as StateRow | undefined
      if (!state || state.revision < existingOperation.applied_revision) fail()
      return RESULTS.replayed
    }

    const state = db.prepare(
      'SELECT revision FROM continuity_cas_state_proposal WHERE scope_id = ?',
    ).get(input.scopeId) as StateRow | undefined
    if (!state || state.revision !== input.expectedRevision) return RESULTS.stale
    const updated = db.prepare(
      `UPDATE continuity_cas_state_proposal
       SET revision = ?
       WHERE scope_id = ? AND revision = ?`,
    ).run(appliedRevision, input.scopeId, input.expectedRevision)
    if (updated.changes !== 1) fail()
    testHooks?.afterStateMutation?.()
    db.prepare(
      `INSERT INTO continuity_cas_operation_proposal (
        operation_id, scope_id, expected_revision, applied_revision, payload_sha256
      ) VALUES (?, ?, ?, ?, ?)`,
    ).run(
      input.operationId,
      input.scopeId,
      input.expectedRevision,
      appliedRevision,
      input.payloadSha256,
    )
    testHooks?.afterOperationInsert?.()
    assertDatabaseConsistency(db)
    return RESULTS.applied
  })
  return apply.immediate()
}

/** Apply one proposal-only CAS operation. Unknown scopes fail closed as stale. */
export function applyV3ContinuityCasProposal(
  db: Database.Database,
  input: V3ContinuityCasProposalInput,
): V3ContinuityCasProposalResult {
  try {
    return executeApply(db, input)
  } catch (error) {
    if (error instanceof V3ContinuityCasProposalError) throw error
    return fail()
  }
}

/** Test-only rollback seam; the production import graph must never import this module. */
export function applyV3ContinuityCasProposalWithTestHooks(
  db: Database.Database,
  input: V3ContinuityCasProposalInput,
  hooks: V3ContinuityCasProposalTestHooks,
): V3ContinuityCasProposalResult {
  try {
    return executeApply(db, input, hooks)
  } catch (error) {
    if (error instanceof V3ContinuityCasProposalError) throw error
    return fail()
  }
}

export const V3_CONTINUITY_CAS_PROPOSAL_TABLES = TABLES
