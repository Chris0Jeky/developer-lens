import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { ArtifactIdV3Schema, IsoWeekV3Schema, ScopeIdV3Schema } from './v3Proposal.js'
import {
  assertStorageV3ArtifactCatalogue,
  storageV3MaintenanceStatus,
} from './v3ArtifactCatalogue.js'
import {
  assertSelectableStorageV3Target,
} from './v3ShadowMigration.js'
import {
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  storageV3ShadowSchemaFingerprint,
} from './v3ShadowSchema.js'
import { isoWeekFromCanonicalTimestamp } from './v3ShadowRewrite.js'

/**
 * LIFE-03 restore boundary: the caller has already copied and independently
 * verified this exact SQLite image.  This proof carries no filesystem path and
 * does not perform a copy, link, publication, or standalone verification.
 */
export type StorageV3RestoreSnapshotProof = Readonly<{
  db: Database.Database
  artifactId: string
  stagedLocator: string
  finalLocator: string
  backupAt: string
  selectedArtifactId: string
  ownerScopeIds: readonly string[]
  /** The staged row's self-referential intent hash, supplied by the verifier. */
  intentSha256: string
}>

/** Name used by the forthcoming standalone verifier integration. */
export type StorageV3RestoreSnapshotNormalizationInput = StorageV3RestoreSnapshotProof

export const STORAGE_V3_RESTORE_NORMALIZATION_STAGES = [
  'preflight',
  'maintenancePending',
  'artifactPending',
  'artifactDeleting',
  'attemptDeleted',
  'ownersDeleted',
  'artifactDeleted',
  'maintenanceComplete',
  'precommit',
] as const
export type StorageV3RestoreNormalizationStage =
  typeof STORAGE_V3_RESTORE_NORMALIZATION_STAGES[number]

export type StorageV3RestoreErrorCode = 'STORAGE_V3_RESTORE_INVALID'

export class StorageV3RestoreError extends Error {
  public readonly code: StorageV3RestoreErrorCode = 'STORAGE_V3_RESTORE_INVALID'

  constructor() {
    super('STORAGE_V3_RESTORE_INVALID')
    this.name = 'StorageV3RestoreError'
  }
}

const fail = (): never => { throw new StorageV3RestoreError() }
export const STORAGE_V3_RESTORE_OPERATION_DOMAIN = 'developer-lens.storage-v3-restore-normalization.v1' as const
const BACKUP_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const LOCATOR = /^migration-backup-[0-9]{8}T[0-9]{6}Z\.sqlite$/
const IDENTITY = /^(?:0|[1-9][0-9]{0,19})$/
const SHA256 = /^[0-9a-f]{64}$/

type ClosedProof = Readonly<StorageV3RestoreSnapshotProof>

function closeProof(input: unknown): ClosedProof {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype) return fail()
  const expected = [
    'db', 'artifactId', 'stagedLocator', 'finalLocator', 'backupAt',
    'selectedArtifactId', 'ownerScopeIds', 'intentSha256',
  ] as const
  const keys = Reflect.ownKeys(input)
  if (keys.length !== expected.length
    || keys.some((key) => typeof key !== 'string' || !expected.includes(key as typeof expected[number]))) return fail()
  const read = (key: typeof expected[number]): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return fail()
    return (descriptor as PropertyDescriptor & { value: unknown }).value
  }
  const db = read('db') as Database.Database
  const artifactId = read('artifactId')
  const stagedLocator = read('stagedLocator')
  const finalLocator = read('finalLocator')
  const backupAt = read('backupAt')
  const selectedArtifactId = read('selectedArtifactId')
  const ownerScopeIds = read('ownerScopeIds')
  const intentSha256 = read('intentSha256')
  if (!db?.open || db.inTransaction || typeof artifactId !== 'string'
    || typeof stagedLocator !== 'string' || typeof finalLocator !== 'string'
    || typeof backupAt !== 'string' || typeof selectedArtifactId !== 'string'
    || !Array.isArray(ownerScopeIds) || ownerScopeIds.some((scope) => typeof scope !== 'string')
    || typeof intentSha256 !== 'string') return fail()
  return Object.freeze({
    db,
    artifactId,
    stagedLocator,
    finalLocator,
    backupAt,
    selectedArtifactId,
    ownerScopeIds: Object.freeze([...(ownerScopeIds as string[])]),
    intentSha256,
  })
}

function canonicalBackupAt(value: string): string {
  if (!BACKUP_TIMESTAMP.test(value) || Number.isNaN(Date.parse(value))) return fail()
  const expected = new Date(Date.parse(value)).toISOString().replace('.000Z', 'Z')
  if (expected !== value) return fail()
  return value
}

function operationId(artifactId: string, locator: string): string {
  return `del-${createHash('sha256').update(`${STORAGE_V3_RESTORE_OPERATION_DOMAIN}\0${artifactId}\0${locator}`, 'utf8').digest('hex')}`
}

function validateMaintenance(db: Database.Database): void {
  const rows = db.prepare(
    'SELECT state, operation_id, scope_id, event_week FROM storage_maintenance_state WHERE singleton = 1',
  ).all() as Array<Record<string, unknown>>
  if (rows.length > 1) return fail()
  const row = rows[0]
  if (row === undefined) return
  if (row.state !== 'complete' || row.operation_id !== null || row.scope_id !== null || row.event_week !== null) return fail()
}

function validateAttempt(row: Record<string, unknown>, artifactId: string): void {
  if (row.artifact_id !== artifactId) return fail()
  const identity = (value: unknown): string => {
    if (typeof value !== 'string' || !IDENTITY.test(value)) return fail()
    return value
  }
  identity(row.sqlite_dev)
  identity(row.sqlite_ino)
  identity(row.manifest_dev)
  identity(row.manifest_ino)
  if (typeof row.sqlite_content_sha256 !== 'string' || !SHA256.test(row.sqlite_content_sha256)) return fail()
}

function validateProofAndRows(input: ClosedProof): { scopeId: string; eventWeek: string; opId: string } {
  const backupAt = canonicalBackupAt(input.backupAt)
  if (!ArtifactIdV3Schema.safeParse(input.artifactId).success
    || !ArtifactIdV3Schema.safeParse(input.selectedArtifactId).success
    || input.stagedLocator !== `${input.finalLocator}.tmp`
    || !LOCATOR.test(input.finalLocator)
    || input.finalLocator !== `migration-backup-${backupAt.replace(/[-:]/g, '')}.sqlite`
    || !LOCATOR.test(input.finalLocator)
    || !SHA256.test(input.intentSha256)) return fail()
  if (input.ownerScopeIds.length === 0
    || input.ownerScopeIds.some((scope, index) => !ScopeIdV3Schema.safeParse(scope).success
      || scope !== [...input.ownerScopeIds].sort()[index])) return fail()
  const scopeId = input.ownerScopeIds[0]!
  const eventWeek = isoWeekFromCanonicalTimestamp(backupAt.replace('Z', '.000Z'))
  if (!IsoWeekV3Schema.safeParse(eventWeek).success) return fail()

  const backups = input.db.prepare(
    `SELECT artifact_id, kind, state, manifest_sha256, content_sha256,
            relative_locator, deletion_operation_id, deletion_scope_id, deletion_week
     FROM app_artifact WHERE kind = 'migration_backup_v1' ORDER BY artifact_id`,
  ).all() as Array<Record<string, unknown>>
  if (backups.length !== 1) return fail()
  const backup = backups[0]!
  if (backup.artifact_id !== input.artifactId || backup.kind !== 'migration_backup_v1'
    || backup.state !== 'active' || backup.relative_locator !== input.stagedLocator
    || backup.manifest_sha256 !== input.intentSha256 || backup.content_sha256 !== input.intentSha256
    || backup.deletion_operation_id !== null || backup.deletion_scope_id !== null
    || backup.deletion_week !== null) return fail()

  const attempts = input.db.prepare(
    `SELECT artifact_id, sqlite_dev, sqlite_ino, manifest_dev, manifest_ino,
            sqlite_content_sha256 FROM migration_backup_attempt ORDER BY artifact_id`,
  ).all() as Array<Record<string, unknown>>
  if (attempts.length !== 1) return fail()
  validateAttempt(attempts[0]!, input.artifactId)

  const owners = input.db.prepare(
    'SELECT scope_id FROM app_artifact_scope WHERE artifact_id = ? ORDER BY scope_id',
  ).pluck().all(input.artifactId) as string[]
  if (JSON.stringify(owners) !== JSON.stringify(input.ownerScopeIds)) return fail()
  for (const owner of owners) {
    if (input.db.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(owner) === undefined) return fail()
  }

  const selected = input.db.prepare(
    "SELECT artifact_id, state FROM app_artifact WHERE kind = 'selected_store' ORDER BY artifact_id",
  ).all() as Array<{ artifact_id: string; state: string }>
  if (selected.length !== 1 || selected[0]!.artifact_id !== input.selectedArtifactId
    || selected[0]!.state !== 'active') return fail()
  if (Number(input.db.prepare('SELECT COUNT(*) FROM migration_selection_state').pluck().get()) !== 0) return fail()
  validateMaintenance(input.db)
  return Object.freeze({ scopeId, eventWeek, opId: operationId(input.artifactId, input.stagedLocator) })
}

function checkAfterNormalization(db: Database.Database): void {
  if (storageV3ShadowSchemaFingerprint(db) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT
    || String(db.prepare('PRAGMA integrity_check').pluck().get()) !== 'ok'
    || String(db.prepare('PRAGMA quick_check').pluck().get()) !== 'ok'
    || db.prepare('PRAGMA foreign_key_check').all().length !== 0
    || storageV3MaintenanceStatus(db) !== 'complete') return fail()
  assertStorageV3ArtifactCatalogue(db)
  assertSelectableStorageV3Target(db, { allowContinuityCasState: true })
}

function executeNormalization(
  rawInput: unknown,
  failAfterStage?: (stage: StorageV3RestoreNormalizationStage) => void,
): Readonly<{ artifactId: string; operationId: string; eventWeek: string; maintenance: 'complete' }> {
  const input = closeProof(rawInput)
  const { db } = input
  try {
    assertSelectableStorageV3Target(db, { allowContinuityCasState: true })
    assertStorageV3ArtifactCatalogue(db)
    const expected = validateProofAndRows(input)
    failAfterStage?.('preflight')
    const run = db.transaction(() => {
      // The complete marker is durable even when this row did not exist before a
      // restore.  Existing schema guards enforce complete -> pending -> complete.
      const hasMaintenance = db.prepare(
        'SELECT 1 FROM storage_maintenance_state WHERE singleton = 1',
      ).get() !== undefined
      if (hasMaintenance) {
        if (db.prepare(
          `UPDATE storage_maintenance_state SET state = 'pending', operation_id = ?, scope_id = ?, event_week = ?
           WHERE singleton = 1 AND state = 'complete'`,
        ).run(expected.opId, expected.scopeId, expected.eventWeek).changes !== 1) return fail()
      } else {
        db.prepare(
          `INSERT INTO storage_maintenance_state (singleton, state, operation_id, scope_id, event_week)
           VALUES (1, 'pending', ?, ?, ?)`,
        ).run(expected.opId, expected.scopeId, expected.eventWeek)
      }
      failAfterStage?.('maintenancePending')
      if (db.prepare(
        `UPDATE app_artifact SET state = 'pending', deletion_operation_id = ?, deletion_scope_id = ?, deletion_week = ?
         WHERE artifact_id = ? AND kind = 'migration_backup_v1' AND state = 'active'`,
      ).run(expected.opId, expected.scopeId, expected.eventWeek, input.artifactId).changes !== 1) return fail()
      failAfterStage?.('artifactPending')
      if (db.prepare(
        `UPDATE app_artifact SET state = 'deleting'
         WHERE artifact_id = ? AND kind = 'migration_backup_v1' AND state = 'pending'
           AND deletion_operation_id = ? AND deletion_scope_id = ? AND deletion_week = ?`,
      ).run(input.artifactId, expected.opId, expected.scopeId, expected.eventWeek).changes !== 1) return fail()
      failAfterStage?.('artifactDeleting')
      if (db.prepare('DELETE FROM migration_backup_attempt WHERE artifact_id = ?').run(input.artifactId).changes !== 1) return fail()
      failAfterStage?.('attemptDeleted')
      if (db.prepare('DELETE FROM app_artifact_scope WHERE artifact_id = ?').run(input.artifactId).changes
        !== input.ownerScopeIds.length) return fail()
      failAfterStage?.('ownersDeleted')
      if (db.prepare('DELETE FROM app_artifact WHERE artifact_id = ?').run(input.artifactId).changes !== 1) return fail()
      failAfterStage?.('artifactDeleted')
      if (db.prepare(
        `UPDATE storage_maintenance_state
         SET state = 'complete', operation_id = NULL, scope_id = NULL, event_week = NULL
         WHERE singleton = 1 AND state = 'pending' AND operation_id = ? AND scope_id = ? AND event_week = ?`,
      ).run(expected.opId, expected.scopeId, expected.eventWeek).changes !== 1) return fail()
      failAfterStage?.('maintenanceComplete')
      if (String(db.prepare('PRAGMA integrity_check').pluck().get()) !== 'ok'
        || db.prepare('PRAGMA foreign_key_check').all().length !== 0) return fail()
      failAfterStage?.('precommit')
      return undefined
    })
    run.immediate()
    checkAfterNormalization(db)
    return Object.freeze({ artifactId: input.artifactId, operationId: expected.opId, eventWeek: expected.eventWeek, maintenance: 'complete' as const })
  } catch (error) {
    if (error instanceof StorageV3RestoreError) throw error
    return fail()
  }
}

/** Normalize a verified copied snapshot before the ordinary selected-store reopen. */
export function normalizeStorageV3RestoredSnapshot(
  input: StorageV3RestoreSnapshotNormalizationInput,
): Readonly<{ artifactId: string; operationId: string; eventWeek: string; maintenance: 'complete' }> {
  return executeNormalization(input)
}

/** @internal invented-fixture rollback seam; production callers cannot inject failures. */
export const v3RestoreTestSeams = Object.freeze({
  normalizeWithFailure(
    input: StorageV3RestoreSnapshotProof,
    failAfterStage: (stage: StorageV3RestoreNormalizationStage) => void,
  ) {
    if (typeof failAfterStage !== 'function') return fail()
    return executeNormalization(input, failAfterStage)
  },
})
