import type Database from 'better-sqlite3'
import { OperationIdV3Schema, ScopeIdV3Schema } from './v3Proposal.js'
import { isoWeekFromCanonicalTimestamp } from './v3ShadowRewrite.js'
import {
  STORAGE_V3_CONTINUITY_CAS_ERROR,
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  STORAGE_V3_SHADOW_USER_VERSION,
  storageV3ShadowSchemaFingerprint,
} from './v3ShadowSchema.js'

/**
 * The continuity compare-and-swap primitive, applied to the shadow store that
 * holds the state it guards. Authority is the owning process plus a single
 * BEGIN IMMEDIATE transaction: no clock, no artifact input, no credential, and
 * no capability activation path.
 */
const MAX_REVISION = Number.MAX_SAFE_INTEGER
const ERROR_CODE = STORAGE_V3_CONTINUITY_CAS_ERROR

/**
 * `receipt_expired` is the honest answer for a replay whose stored receipt digest was
 * cleared by the 13-month C2 sweep: with no receipt, replay-vs-conflict cannot be
 * verified, so the operation is refused rather than falsely reported `replayed` or
 * `applied`. Detection is never weakened into acceptance (PR #130 late review).
 */
export type ContinuityCasStatus = 'applied' | 'replayed' | 'stale' | 'conflict' | 'receipt_expired'
/** A scope initializer is idempotent: it either mints revision 0 or finds it. */
export type ContinuityCasScopeStatus = 'created' | 'existing'

export interface ContinuityCasResult {
  readonly kind: 'v3_continuity_cas'
  readonly status: ContinuityCasStatus
}

const RESULTS = Object.freeze({
  applied: Object.freeze({ kind: 'v3_continuity_cas', status: 'applied' }),
  replayed: Object.freeze({ kind: 'v3_continuity_cas', status: 'replayed' }),
  stale: Object.freeze({ kind: 'v3_continuity_cas', status: 'stale' }),
  conflict: Object.freeze({ kind: 'v3_continuity_cas', status: 'conflict' }),
  receipt_expired: Object.freeze({ kind: 'v3_continuity_cas', status: 'receipt_expired' }),
} as const satisfies Readonly<Record<ContinuityCasStatus, ContinuityCasResult>>)

export class ContinuityCasError extends Error {
  public readonly code = ERROR_CODE

  constructor() {
    super(ERROR_CODE)
    this.name = 'ContinuityCasError'
  }
}

function fail(): never {
  throw new ContinuityCasError()
}

export interface ContinuityCasInput {
  readonly scopeId: string
  readonly expectedRevision: number
  readonly operationId: string
  /** Opaque local-C2 receipt digest; the 13-month sweep clears it in place. */
  readonly payloadSha256: string
}

/**
 * `applied_week` records the WRITER's process wall time, captured inside the CAS
 * transaction and floored to ISO week (§7.4: never caller-supplied — a caller-chosen
 * time could stretch the receipt's 13-month lifetime or expire a live one). It is a
 * retention record, not replay identity: replay is discriminated by the payload
 * digest, so a crash-restart replay across a week boundary still replays. The seam
 * exists for deterministic tests only; production callers use the process clock.
 */
export type ContinuityCasClockForTest = () => string

function capturedWeek(nowForTest?: ContinuityCasClockForTest): string {
  const timestamp = nowForTest ? nowForTest() : new Date().toISOString()
  const time = Date.parse(timestamp)
  if (!Number.isFinite(time) || new Date(time).toISOString() !== timestamp) fail()
  return isoWeekFromCanonicalTimestamp(timestamp)
}

function parseInput(input: unknown): ContinuityCasInput {
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

function parseScopeId(scopeId: unknown): string {
  const scope = ScopeIdV3Schema.safeParse(scopeId)
  return scope.success ? scope.data : fail()
}

function pragmaInteger(db: Database.Database, name: string): number {
  return Number(db.prepare(`PRAGMA ${name}`).pluck().get())
}

function hasAnyTempSchemaObject(db: Database.Database): boolean {
  return db.prepare(
    "SELECT 1 FROM sqlite_temp_schema WHERE name NOT GLOB 'sqlite_*' LIMIT 1",
  ).get() !== undefined
}

function enableConnectionGuards(db: Database.Database): void {
  db.pragma('foreign_keys = ON')
  db.pragma('recursive_triggers = ON')
  if (pragmaInteger(db, 'foreign_keys') !== 1 || pragmaInteger(db, 'recursive_triggers') !== 1) fail()
}

/**
 * Every scope's revision must equal both its operation count and its highest
 * applied revision, AND every CAS scope must still be owned by a claim_scope row:
 * an orphaned state (its scope deleted around the CAS, which the deliberate
 * absence of an FK permits) must refuse further advancement rather than guard
 * nothing (PR #136 review). Divergence means the history was edited around the CAS.
 */
export function assertContinuityCasConsistency(db: Database.Database): void {
  const inconsistent = db.prepare(
    `SELECT state.scope_id
     FROM continuity_cas_state AS state
     LEFT JOIN (
       SELECT scope_id, COUNT(*) AS operation_count, MAX(applied_revision) AS maximum_revision
       FROM continuity_cas_operation
       GROUP BY scope_id
     ) AS history ON history.scope_id = state.scope_id
     WHERE state.revision != COALESCE(history.operation_count, 0)
        OR state.revision != COALESCE(history.maximum_revision, 0)
        OR NOT EXISTS (SELECT 1 FROM claim_scope WHERE claim_scope.scope_id = state.scope_id)
     LIMIT 1`,
  ).get()
  if (inconsistent !== undefined) fail()
}

function assertDatabaseConsistency(db: Database.Database): void {
  if (String(db.prepare('PRAGMA integrity_check').pluck().get()) !== 'ok') fail()
  if (String(db.prepare('PRAGMA quick_check').pluck().get()) !== 'ok') fail()
  if (db.prepare('PRAGMA foreign_key_check').get() !== undefined) fail()
  assertContinuityCasConsistency(db)
}

/** The CAS writes only into an installed shadow store, proven before every write. */
function assertShadowStore(db: Database.Database): void {
  if (
    pragmaInteger(db, 'application_id') !== STORAGE_V3_SHADOW_APPLICATION_ID
    || pragmaInteger(db, 'user_version') !== STORAGE_V3_SHADOW_USER_VERSION
    || hasAnyTempSchemaObject(db)
  ) fail()
  if (storageV3ShadowSchemaFingerprint(db) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT) fail()
  assertDatabaseConsistency(db)
}

export interface ContinuityCasState {
  readonly scopes: number
  readonly operations: number
  /** Ascending revisions only: scope identifiers never leave this module. */
  readonly revisions: readonly number[]
}

/** Content-free CAS state for an owner-facing status report. */
export function readContinuityCasState(db: Database.Database): ContinuityCasState {
  try {
    const revisions = (db.prepare(
      'SELECT revision FROM continuity_cas_state ORDER BY revision',
    ).pluck().all() as number[]).map((revision) => Number(revision))
    const operations = Number(
      db.prepare('SELECT COUNT(*) FROM continuity_cas_operation').pluck().get(),
    )
    return Object.freeze({
      scopes: revisions.length,
      operations,
      revisions: Object.freeze(revisions),
    })
  } catch (error) {
    if (error instanceof ContinuityCasError) throw error
    return fail()
  }
}

/**
 * Create the revision-0 state row for one scope if it is absent. Idempotent, so
 * an interrupted first run and a restart reach the same state.
 */
export function initializeContinuityCasScope(
  db: Database.Database,
  scopeId: string,
): ContinuityCasScopeStatus {
  try {
    const scope = parseScopeId(scopeId)
    if (db.inTransaction) fail()
    enableConnectionGuards(db)
    const initialize = db.transaction((): ContinuityCasScopeStatus => {
      assertShadowStore(db)
      const existing = db.prepare(
        'SELECT revision FROM continuity_cas_state WHERE scope_id = ?',
      ).get(scope)
      if (existing) return 'existing'
      // Existence rule, deliberately not an FK: a phantom CAS scope must never guard a
      // scope the store does not hold (PR #130 late review / #128), while B3 scope
      // deletion must still be able to remove CAS rows together with their scope —
      // a RESTRICT edge from state to claim_scope would block that erasure order.
      if (!db.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(scope)) fail()
      const inserted = db.prepare(
        'INSERT INTO continuity_cas_state (scope_id, revision) VALUES (?, 0)',
      ).run(scope)
      if (inserted.changes !== 1) fail()
      assertDatabaseConsistency(db)
      return 'created'
    })
    return initialize.immediate()
  } catch (error) {
    if (error instanceof ContinuityCasError) throw error
    return fail()
  }
}

interface OperationRow {
  readonly scope_id: string
  readonly expected_revision: number
  readonly applied_revision: number
  readonly payload_sha256: string | null
  readonly applied_week: string
}

interface StateRow {
  readonly revision: number
}

export interface ContinuityCasTestHooks {
  readonly afterStateMutation?: () => void
  readonly afterOperationInsert?: () => void
}

function executeApply(
  db: Database.Database,
  rawInput: unknown,
  testHooks?: ContinuityCasTestHooks,
  nowForTest?: ContinuityCasClockForTest,
): ContinuityCasResult {
  const input = parseInput(rawInput)
  if (db.inTransaction) fail()
  enableConnectionGuards(db)
  const apply = db.transaction((): ContinuityCasResult => {
    assertShadowStore(db)
    const existingOperation = db.prepare(
      `SELECT scope_id, expected_revision, applied_revision, payload_sha256, applied_week
       FROM continuity_cas_operation
       WHERE operation_id = ?`,
    ).get(input.operationId) as OperationRow | undefined
    const appliedRevision = input.expectedRevision + 1
    if (existingOperation) {
      if (
        existingOperation.scope_id !== input.scopeId
        || existingOperation.expected_revision !== input.expectedRevision
        || existingOperation.applied_revision !== appliedRevision
      ) return RESULTS.conflict
      // The sweep cleared this receipt at the 13-month boundary: replay identity can
      // no longer be verified, so refuse rather than guess in either direction.
      if (existingOperation.payload_sha256 === null) return RESULTS.receipt_expired
      if (existingOperation.payload_sha256 !== input.payloadSha256) return RESULTS.conflict
      const state = db.prepare(
        'SELECT revision FROM continuity_cas_state WHERE scope_id = ?',
      ).get(input.scopeId) as StateRow | undefined
      if (!state || state.revision < existingOperation.applied_revision) fail()
      return RESULTS.replayed
    }

    // Capture only after BEGIN IMMEDIATE owns the writer lock. A wait spanning an
    // ISO-week boundary must record the week in which the operation can commit.
    const appliedWeek = capturedWeek(nowForTest)
    const state = db.prepare(
      'SELECT revision FROM continuity_cas_state WHERE scope_id = ?',
    ).get(input.scopeId) as StateRow | undefined
    if (!state || state.revision !== input.expectedRevision) return RESULTS.stale
    const updated = db.prepare(
      `UPDATE continuity_cas_state
       SET revision = ?
       WHERE scope_id = ? AND revision = ?`,
    ).run(appliedRevision, input.scopeId, input.expectedRevision)
    if (updated.changes !== 1) fail()
    testHooks?.afterStateMutation?.()
    db.prepare(
      `INSERT INTO continuity_cas_operation (
        operation_id, scope_id, expected_revision, applied_revision, payload_sha256, applied_week
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      input.operationId,
      input.scopeId,
      input.expectedRevision,
      appliedRevision,
      input.payloadSha256,
      appliedWeek,
    )
    testHooks?.afterOperationInsert?.()
    assertDatabaseConsistency(db)
    return RESULTS.applied
  })
  return apply.immediate()
}

/** Apply one CAS operation. Unknown scopes fail closed as stale, never bootstrap. */
export function applyContinuityCasOperation(
  db: Database.Database,
  input: ContinuityCasInput,
  nowForTest?: ContinuityCasClockForTest,
): ContinuityCasResult {
  try {
    return executeApply(db, input, undefined, nowForTest)
  } catch (error) {
    if (error instanceof ContinuityCasError) throw error
    return fail()
  }
}

/** Test-only rollback seam; the production import graph must never import this. */
export function applyContinuityCasOperationWithTestHooks(
  db: Database.Database,
  input: ContinuityCasInput,
  hooks: ContinuityCasTestHooks,
): ContinuityCasResult {
  try {
    return executeApply(db, input, hooks)
  } catch (error) {
    if (error instanceof ContinuityCasError) throw error
    return fail()
  }
}
