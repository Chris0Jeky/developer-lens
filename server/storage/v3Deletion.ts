import { randomBytes as cryptoRandomBytes } from 'node:crypto'
import type Database from 'better-sqlite3'
import { DeletionOperationIdV3Schema, ScopeIdV3Schema } from './v3Proposal.js'
import { assertContinuityCasConsistency } from './v3ContinuityCasProposal.js'
import {
  assertStorageV3ArtifactCatalogue,
  completeStorageV3ArtifactDeletions,
  finalizeSelectedStorageV3ScopeOwnership,
  markStorageV3MaintenanceComplete,
  scheduleStorageV3ArtifactsForScope,
  storageV3MaintenanceStatus,
  type StorageV3ArtifactDeletionStage,
} from './v3ArtifactCatalogue.js'
import { isoWeekFromCanonicalTimestamp } from './v3ShadowRewrite.js'
import {
  STORAGE_V3_CAS_NO_DELETE_TRIGGERS,
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  STORAGE_V3_SHADOW_TABLES,
  STORAGE_V3_SHADOW_USER_VERSION,
  storageV3ShadowSchemaFingerprint,
} from './v3ShadowSchema.js'

/**
 * DL-LIFE-02 B3 — complete, transactionally-single scope deletion on the SELECTED
 * v3 store (10_LIFE_02B_DECISION.md §4/§5 item 4).
 *
 * One `BEGIN IMMEDIATE` transaction: enumerate every registered SQL subject of the
 * scope, delete dependents before parents across every registered shadow table (the CAS
 * guards are dropped and byte-identically recreated inside the same transaction —
 * scope revocation is the one operation allowed to remove CAS rows), then write the
 * surviving record: one `tombstone_cascade` lineage row per subject under a single
 * `del-` operation, scope-unbound (`scope_id IS NULL`) exactly like the slice-A
 * legacy compatibility rows, carrying only content-free C1 identifiers and the
 * ISO-week floor of the caller's `asOf`. Verify integrity, foreign keys, schema
 * fingerprint, and CAS consistency; commit once.
 *
 * Replay is idempotent: deleting an already-tombstoned scope with the recorded
 * operation reports `replayed` and changes nothing. A DIFFERENT deletion operation
 * for an already-tombstoned subject conflicts and fails closed (#128), as does a
 * pre-existing tombstone for a still-live enumerated subject.
 *
 * The committed transaction leaves WAL/journal maintenance owed:
 * `completeStorageV3DeletionMaintenance` checkpoints and truncates the exact WAL and
 * rebuilds the logical database (VACUUM), is idempotent, and resumes after a crash
 * without restoring revoked rows. A deletion result reports `maintenance: 'pending'`
 * until that runs — completion must never be claimed while it is owed.
 */

export type StorageV3DeletionErrorCode =
  | 'INVALID_REQUEST'
  | 'STORE_REFUSED'
  | 'UNKNOWN_SCOPE'
  | 'OPERATION_CONFLICT'
  | 'DELETION_FAILED'
  | 'MAINTENANCE_FAILED'

export class StorageV3DeletionError extends Error {
  public readonly code: StorageV3DeletionErrorCode

  constructor(code: StorageV3DeletionErrorCode) {
    super(code)
    this.name = 'StorageV3DeletionError'
    this.code = code
  }
}

const fail = (code: StorageV3DeletionErrorCode): never => {
  throw new StorageV3DeletionError(code)
}

/**
 * Every shadow table has exactly one deletion handling; a store table outside this
 * registry refuses the whole operation. `mustBeEmpty` tables are delete-disposition
 * outputs the rewrite never writes; `global` survives scope deletion untouched;
 * `scopeRows` deletes by `scope_id`; `scopeLineage` deletes the scope's bound lineage
 * while scope-unbound rows (legacy and B3 tombstones) survive; `cas` rows fall with
 * their scope through the recreated-trigger path.
 */
type V3DeletionHandling = 'mustBeEmpty' | 'global' | 'scopeRows' | 'scopeLineage' | 'cas'

const V3_DELETION_REGISTRY = {
  import_run: 'mustBeEmpty',
  coverage_observation: 'mustBeEmpty',
  v2_coverage_record: 'mustBeEmpty',
  v2_store_provenance: 'global',
  claim_scope: 'scopeRows',
  repository_identity: 'scopeRows',
  commit_observation: 'scopeRows',
  pull_request_fact: 'scopeRows',
  dated_event_observation: 'scopeRows',
  collection_job: 'scopeRows',
  collection_checkpoint: 'scopeRows',
  source_snapshot: 'scopeRows',
  coverage_ledger: 'scopeRows',
  evidence: 'scopeRows',
  claim: 'scopeRows',
  claim_evidence_edge: 'scopeRows',
  limitation_instance: 'scopeRows',
  lineage_event: 'scopeLineage',
  continuity_cas_state: 'cas',
  continuity_cas_operation: 'cas',
  app_artifact: 'global',
  app_artifact_scope: 'global',
  migration_backup_attempt: 'global',
  storage_maintenance_state: 'global',
} as const satisfies Record<(typeof STORAGE_V3_SHADOW_TABLES)[number], V3DeletionHandling>

/** Children strictly before parents; claim_scope last among scope-bound rows. */
const SCOPE_ROW_DELETION_ORDER = [
  'claim_evidence_edge',
  'limitation_instance',
  'claim',
  'evidence',
  'coverage_ledger',
  'collection_checkpoint',
  'source_snapshot',
  'collection_job',
  'coverage_observation',
  'dated_event_observation',
  'pull_request_fact',
  'commit_observation',
  'repository_identity',
  'claim_scope',
] as const

/** Subject classes that receive per-subject tombstones, with their id columns. */
const SUBJECT_ENUMERATION = [
  { subjectKind: 'claim', table: 'claim', idColumn: 'claim_id' },
  { subjectKind: 'job', table: 'collection_job', idColumn: 'job_id' },
  { subjectKind: 'snapshot', table: 'source_snapshot', idColumn: 'snapshot_id' },
  { subjectKind: 'checkpoint', table: 'collection_checkpoint', idColumn: 'checkpoint_id' },
  { subjectKind: 'coverage', table: 'coverage_ledger', idColumn: 'coverage_id' },
  { subjectKind: 'evidence', table: 'evidence', idColumn: 'evidence_id' },
] as const

export const STORAGE_V3_DELETION_STAGES = [
  'storeAssertions',
  'enumeration',
  'conflictCheck',
  'artifactSchedule',
  'lineageDelete',
  'scopeRowDelete',
  'casDelete',
  'tombstones',
  'finalValidation',
] as const
export type StorageV3DeletionStage = typeof STORAGE_V3_DELETION_STAGES[number]

export interface StorageV3ScopeDeletionOptions {
  readonly db: Database.Database
  readonly scopeId: string
  /** Canonical millisecond timestamp; only its ISO-week floor reaches storage. */
  readonly asOf: string
  /** Replay of a recorded deletion supplies its exact operation; a fresh one omits it. */
  readonly operationId?: string
  readonly randomBytes?: (size: number) => Buffer
  /** Test-only failure injection; receives no retained or deleted values. */
  readonly failAfterStage?: (stage: StorageV3DeletionStage) => void
}

export interface StorageV3ScopeDeletionResult {
  readonly completeB3: true
  readonly status: 'deleted' | 'replayed'
  /** Content-free row counts removed per table; zero for every table on replay. */
  readonly deletedRows: Readonly<Record<string, number>>
  readonly tombstonesWritten: number
  /** The content-free `del-` operation binding this deletion; replay must reuse it. */
  readonly operationId: string
  /** Durable catalogue/WAL maintenance state, never a return-only promise. */
  readonly maintenance: 'pending' | 'complete'
}

const CANONICAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function parseAsOf(value: unknown): string {
  if (typeof value !== 'string' || !CANONICAL_TIMESTAMP.test(value)) fail('INVALID_REQUEST')
  const time = Date.parse(value as string)
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) fail('INVALID_REQUEST')
  return value as string
}

function pragmaInteger(db: Database.Database, name: string): number {
  return Number(db.prepare(`PRAGMA ${name}`).pluck().get())
}

function assertSelectedStore(db: Database.Database): void {
  db.pragma('foreign_keys = ON')
  if (pragmaInteger(db, 'foreign_keys') !== 1) fail('STORE_REFUSED')
  if (pragmaInteger(db, 'application_id') !== STORAGE_V3_SHADOW_APPLICATION_ID) fail('STORE_REFUSED')
  if (pragmaInteger(db, 'user_version') !== STORAGE_V3_SHADOW_USER_VERSION) fail('STORE_REFUSED')
  if (db.prepare("SELECT 1 FROM sqlite_temp_schema WHERE name NOT GLOB 'sqlite_*' LIMIT 1").get()) {
    fail('STORE_REFUSED')
  }
  if (storageV3ShadowSchemaFingerprint(db) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT) fail('STORE_REFUSED')
  const tables = db.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
  ).pluck().all() as string[]
  const registered = Object.keys(V3_DELETION_REGISTRY).sort()
  if (JSON.stringify(tables) !== JSON.stringify(registered)) fail('STORE_REFUSED')
  for (const [table, handling] of Object.entries(V3_DELETION_REGISTRY)) {
    if (handling !== 'mustBeEmpty') continue
    if (Number(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get()) !== 0) fail('STORE_REFUSED')
  }
  assertContinuityCasConsistency(db)
  assertStorageV3ArtifactCatalogue(db)
}

function mintDeletionOperationId(
  db: Database.Database,
  entropy: (size: number) => Buffer,
): string {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const bytes = entropy(32)
    if (!Buffer.isBuffer(bytes) || bytes.length !== 32) fail('DELETION_FAILED')
    const candidate = `del-${bytes.toString('hex')}`
    const collision = db.prepare(
      'SELECT 1 FROM lineage_event WHERE subject_id = ? OR operation_id = ? OR caused_by = ? LIMIT 1',
    ).get(candidate, candidate, candidate)
    if (!collision) return candidate
  }
  return fail('DELETION_FAILED')
}

/** Delete one scope and every registered SQL descendant; see the module contract. */
export function deleteStorageV3Scope(
  options: StorageV3ScopeDeletionOptions,
): Readonly<StorageV3ScopeDeletionResult> {
  const scope = ScopeIdV3Schema.safeParse(options.scopeId)
  if (!scope.success) return fail('INVALID_REQUEST')
  const scopeId = scope.data
  const asOf = parseAsOf(options.asOf)
  const eventWeek = isoWeekFromCanonicalTimestamp(asOf)
  let requestedOperation: string | undefined
  if (options.operationId !== undefined) {
    const parsed = DeletionOperationIdV3Schema.safeParse(options.operationId)
    if (!parsed.success) return fail('INVALID_REQUEST')
    requestedOperation = parsed.data
  }
  const entropy = options.randomBytes ?? cryptoRandomBytes
  const db = options.db
  if (db.inTransaction) fail('STORE_REFUSED')

  try {
    const run = db.transaction((): Readonly<StorageV3ScopeDeletionResult> => {
      assertSelectedStore(db)
      options.failAfterStage?.('storeAssertions')

      const scopeExists = db.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(scopeId) !== undefined
      const recordedScopeTombstones = db.prepare(
        `SELECT DISTINCT operation_id, event_week FROM lineage_event
         WHERE event_kind = 'tombstone_cascade' AND subject_kind = 'scope' AND subject_id = ?`,
      ).all(scopeId) as Array<{ operation_id: string; event_week: string }>

      if (!scopeExists) {
        // Exact replay only: one unambiguous recorded (operation, week) pair, the
        // requested operation matching it when named, and the SAME deletion week —
        // a materially different request is a conflict, never a silent replay
        // (PR #136 review).
        if (recordedScopeTombstones.length === 0) fail('UNKNOWN_SCOPE')
        if (recordedScopeTombstones.length > 1) fail('OPERATION_CONFLICT')
        const recorded = recordedScopeTombstones[0]
        if (recorded === undefined) return fail('DELETION_FAILED')
        if (requestedOperation !== undefined && requestedOperation !== recorded.operation_id) {
          fail('OPERATION_CONFLICT')
        }
        if (recorded.event_week !== eventWeek) fail('OPERATION_CONFLICT')
        return Object.freeze({
          completeB3: true as const,
          status: 'replayed' as const,
          deletedRows: Object.freeze({}),
          tombstonesWritten: 0,
          operationId: recorded.operation_id,
          maintenance: storageV3MaintenanceStatus(db),
        })
      }

      const subjects: Array<{ subjectKind: string; subjectId: string }> = [
        { subjectKind: 'scope', subjectId: scopeId },
      ]
      for (const { subjectKind, table, idColumn } of SUBJECT_ENUMERATION) {
        const ids = db.prepare(
          `SELECT ${idColumn} FROM ${table} WHERE scope_id = ? ORDER BY ${idColumn}`,
        ).pluck().all(scopeId) as string[]
        for (const subjectId of ids) subjects.push({ subjectKind, subjectId })
      }
      options.failAfterStage?.('enumeration')

      // A live subject that already carries a deletion tombstone means two deletion
      // identities would exist for one subject: refuse rather than pile a second
      // operation onto it (#128 — duplicate deletion lineage per subject).
      const priorTombstone = db.prepare(
        `SELECT 1 FROM lineage_event
         WHERE event_kind IN ('tombstone_cascade', 'index_deleted')
           AND subject_kind = ? AND subject_id = ? LIMIT 1`,
      )
      for (const { subjectKind, subjectId } of subjects) {
        if (priorTombstone.get(subjectKind, subjectId)) fail('OPERATION_CONFLICT')
      }
      const operationId = requestedOperation ?? mintDeletionOperationId(db, entropy)
      if (requestedOperation !== undefined) {
        // A fresh deletion may not reuse an operation identity the store has seen.
        const seen = db.prepare(
          'SELECT 1 FROM lineage_event WHERE subject_id = ? OR operation_id = ? OR caused_by = ? LIMIT 1',
        ).get(requestedOperation, requestedOperation, requestedOperation)
        if (seen) fail('OPERATION_CONFLICT')
      }
      options.failAfterStage?.('conflictCheck')

      scheduleStorageV3ArtifactsForScope(db, {
        scopeId,
        operationId,
        eventWeek,
      })
      options.failAfterStage?.('artifactSchedule')

      // A scoped deletion-kind row for a subject OUTSIDE the enumeration (its data row
      // already gone, or an artifact-kind record) is the only surviving proof of an
      // EARLIER erasure — it must outlive this scope as a scope-unbound record, not be
      // destroyed with the scope's ordinary lineage (PR #136 review). The immutable
      // trigger forbids updating scope_id, so it is captured here and re-inserted
      // scope-unbound in the tombstone stage, after the owner rows are gone (the
      // cross-scope lineage triggers reject NULL-scope rows while owners still live).
      const preservedTombstones = db.prepare(
        `SELECT subject_kind, subject_id, operation_id, capability_id, caused_by, event_kind, event_week
         FROM lineage_event
         WHERE scope_id = ? AND event_kind IN ('tombstone_cascade', 'index_deleted')`,
      ).all(scopeId) as Array<Record<string, unknown>>
      const deletedRows: Record<string, number> = {}
      deletedRows.lineage_event = db.prepare(
        'DELETE FROM lineage_event WHERE scope_id = ?',
      ).run(scopeId).changes - preservedTombstones.length
      options.failAfterStage?.('lineageDelete')

      // The claim self-reference is immediate NO ACTION: clear it first so the
      // per-table DELETE cannot trip on its own scope's supersession order.
      db.prepare('UPDATE claim SET superseded_by = NULL WHERE scope_id = ?').run(scopeId)
      for (const table of SCOPE_ROW_DELETION_ORDER) {
        deletedRows[table] = db.prepare(
          `DELETE FROM ${table} WHERE scope_id = ?`,
        ).run(scopeId).changes
      }
      options.failAfterStage?.('scopeRowDelete')

      for (const trigger of STORAGE_V3_CAS_NO_DELETE_TRIGGERS) {
        db.exec(`DROP TRIGGER ${trigger.name}`)
      }
      deletedRows.continuity_cas_operation = db.prepare(
        'DELETE FROM continuity_cas_operation WHERE scope_id = ?',
      ).run(scopeId).changes
      deletedRows.continuity_cas_state = db.prepare(
        'DELETE FROM continuity_cas_state WHERE scope_id = ?',
      ).run(scopeId).changes
      for (const trigger of STORAGE_V3_CAS_NO_DELETE_TRIGGERS) {
        db.exec(trigger.sql)
      }
      options.failAfterStage?.('casDelete')

      const reinsertPreserved = db.prepare(
        `INSERT INTO lineage_event (
          scope_id, subject_kind, subject_id, operation_id, capability_id,
          caused_by, event_kind, event_week
        ) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const row of preservedTombstones) {
        reinsertPreserved.run(
          row.subject_kind,
          row.subject_id,
          row.operation_id,
          row.capability_id,
          row.caused_by,
          row.event_kind,
          row.event_week,
        )
      }
      const insertTombstone = db.prepare(
        `INSERT INTO lineage_event (
          scope_id, subject_kind, subject_id, operation_id, capability_id,
          caused_by, event_kind, event_week
        ) VALUES (NULL, ?, ?, ?, 'github.core', ?, 'tombstone_cascade', ?)`,
      )
      let tombstonesWritten = 0
      for (const { subjectKind, subjectId } of subjects) {
        insertTombstone.run(
          subjectKind,
          subjectId,
          operationId,
          subjectKind === 'scope' ? null : scopeId,
          eventWeek,
        )
        tombstonesWritten += 1
      }
      options.failAfterStage?.('tombstones')

      if (String(db.prepare('PRAGMA integrity_check').pluck().get()) !== 'ok') fail('DELETION_FAILED')
      if (String(db.prepare('PRAGMA quick_check').pluck().get()) !== 'ok') fail('DELETION_FAILED')
      if (db.prepare('PRAGMA foreign_key_check').get() !== undefined) fail('DELETION_FAILED')
      if (storageV3ShadowSchemaFingerprint(db) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT) {
        fail('DELETION_FAILED')
      }
      assertContinuityCasConsistency(db)
      assertStorageV3ArtifactCatalogue(db)
      options.failAfterStage?.('finalValidation')

      return Object.freeze({
        completeB3: true as const,
        status: 'deleted' as const,
        deletedRows: Object.freeze(deletedRows),
        tombstonesWritten,
        operationId,
        maintenance: 'pending' as const,
      })
    })
    return run.immediate()
  } catch (error) {
    if (error instanceof StorageV3DeletionError) throw error
    return fail('DELETION_FAILED')
  }
}

export interface StorageV3DeletionLineageEntry {
  readonly subjectKind: string
  readonly subjectId: string
  readonly operationId: string
  readonly causedBy: string | null
  readonly eventKind: 'tombstone_cascade' | 'index_deleted' | 'legacy_deletion_operation'
  readonly eventWeek: string
}

/**
 * The content-free deletion record of the store: every deletion-kind lineage row,
 * carrying only C1 random identifiers, the closed event kind, and week grain. This is
 * what "explain the tombstones" reads after a scope is erased — an absent subject is
 * distinguishable from unexplained damage by exactly these rows. Consumed by the
 * owner CLI journey; the stored-observation resolver joins arrive with the bridge.
 */
export function readStorageV3DeletionLineage(
  db: Database.Database,
): readonly StorageV3DeletionLineageEntry[] {
  const rows = db.prepare(
    `SELECT subject_kind, subject_id, operation_id, caused_by, event_kind, event_week
     FROM lineage_event
     WHERE event_kind IN ('tombstone_cascade', 'index_deleted', 'legacy_deletion_operation')
     ORDER BY subject_kind, subject_id, event_week`,
  ).all() as Array<Record<string, unknown>>
  return rows.map((row) => Object.freeze({
    subjectKind: String(row.subject_kind),
    subjectId: String(row.subject_id),
    operationId: String(row.operation_id),
    causedBy: row.caused_by === null ? null : String(row.caused_by),
    eventKind: String(row.event_kind) as StorageV3DeletionLineageEntry['eventKind'],
    eventWeek: String(row.event_week),
  }))
}

export interface StorageV3DeletionMaintenanceResult {
  readonly maintenance: 'complete'
  readonly artifactsDeleted: number
}

export const STORAGE_V3_DELETION_MAINTENANCE_STAGES = [
  'artifactsDeleted',
  'selectedOwnershipFinalized',
  'vacuumed',
  'markerCompleted',
  'checkpointed',
] as const
export type StorageV3DeletionMaintenanceStage =
  typeof STORAGE_V3_DELETION_MAINTENANCE_STAGES[number]

export interface StorageV3DeletionMaintenanceOptions {
  /** Content-free hooks used only by invented crash/restart fixtures. */
  readonly failAfterStage?: (stage: StorageV3DeletionMaintenanceStage) => void
  readonly failAfterArtifactStage?: (
    stage: StorageV3ArtifactDeletionStage,
    completedArtifacts: number,
  ) => void
}

/**
 * The post-commit completion saga: checkpoint and TRUNCATE the exact WAL, rebuild the
 * logical database (VACUUM reclaims and rewrites every remaining page, so deleted-row
 * images do not survive in free pages), checkpoint again, and re-verify integrity.
 * Idempotent and crash-resumable: rerunning after an interruption completes the same
 * state and can never restore revoked rows — the deletion itself already committed.
 */
export function completeStorageV3DeletionMaintenance(
  db: Database.Database,
  options: StorageV3DeletionMaintenanceOptions = {},
): Readonly<StorageV3DeletionMaintenanceResult> {
  try {
    if (db.inTransaction) fail('MAINTENANCE_FAILED')
    const checkpoint = () => {
      const rows = db.pragma('wal_checkpoint(TRUNCATE)') as Array<{ busy: number }>
      if (rows.some((row) => Number(row.busy) !== 0)) fail('MAINTENANCE_FAILED')
    }
    let artifactsDeleted = 0
    const state = storageV3MaintenanceStatus(db)
    if (state === 'pending') {
      artifactsDeleted = completeStorageV3ArtifactDeletions(db, {
        failAfterStage: options.failAfterArtifactStage,
      })
      options.failAfterStage?.('artifactsDeleted')
      db.transaction(() => finalizeSelectedStorageV3ScopeOwnership(db)).immediate()
      options.failAfterStage?.('selectedOwnershipFinalized')
      checkpoint()
      db.exec('VACUUM')
      options.failAfterStage?.('vacuumed')
      db.transaction(() => markStorageV3MaintenanceComplete(db)).immediate()
      options.failAfterStage?.('markerCompleted')
      checkpoint()
      options.failAfterStage?.('checkpointed')
    } else {
      // Idempotent replay of an already completed saga still proves the exact WAL
      // family is quiescent, without rewriting a content-free store needlessly.
      checkpoint()
    }
    if (String(db.prepare('PRAGMA integrity_check').pluck().get()) !== 'ok') fail('MAINTENANCE_FAILED')
    if (db.prepare('PRAGMA foreign_key_check').get() !== undefined) fail('MAINTENANCE_FAILED')
    assertStorageV3ArtifactCatalogue(db)
    if (storageV3MaintenanceStatus(db) !== 'complete') fail('MAINTENANCE_FAILED')
    return Object.freeze({ maintenance: 'complete' as const, artifactsDeleted })
  } catch (error) {
    if (error instanceof StorageV3DeletionError) throw error
    return fail('MAINTENANCE_FAILED')
  }
}
