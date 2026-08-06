import { createHash } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  unlinkSync,
  writeSync,
  type BigIntStats,
} from 'node:fs'
import Database from 'better-sqlite3'
import { ArtifactIdV3Schema, IsoWeekV3Schema, ScopeIdV3Schema } from './v3Proposal.js'
import {
  assertStorageV3ArtifactCatalogue,
  assertStorageV3ArtifactRootInstallationKey,
  bindStorageV3ArtifactRoot,
  openStorageV3ArtifactRoot,
  storageV3ArtifactFilePath,
  syncStorageV3ArtifactDirectory,
  STORAGE_V3_ARTIFACT_LOCATORS,
  type StorageV3ArtifactRoot,
  storageV3MaintenanceStatus,
} from './v3ArtifactCatalogue.js'
import {
  verifyStorageV3MigrationBackupForRestore,
  type StorageV3MigrationBackupRestoreVerification,
} from './v3Backup.js'
import {
  readStorageV3MigrationSelection,
  recordStorageV3MigrationSelection,
  type StorageV3MigrationSelection,
} from './v3SelectionReceipt.js'
import { openSelectedStorageV3StoreReadonly } from './v3StoreFiles.js'
import { withStorageV3WriterLease } from './v3WriterLease.js'
import type { TaskInstallationKeyHandle } from './taskInstallationKey.js'
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
  // SQLite backup captures the live catalogue after the SQLite provisional
  // identity is bound but before the manifest exists or the copied bytes can
  // be hashed without creating a self-referential snapshot.
  if (row.manifest_dev !== null || row.manifest_ino !== null
    || row.sqlite_content_sha256 !== null) return fail()
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
  if (Number(input.db.prepare('SELECT COUNT(*) FROM app_artifact').pluck().get()) !== 2) return fail()
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

/** One non-legacy refusal for the closed restore boundary. */
export const STORAGE_V3_RESTORE_UNAVAILABLE = 'v3-restore-unavailable' as const

export type StorageV3RestoreFromSelectionInput = Readonly<{
  directory: string
  backupAt: string
  backupArtifactId: string
  installationKey: TaskInstallationKeyHandle
  /** An already verified immutable selection receipt; restore never mints one. */
  selection: StorageV3MigrationSelection
}>

export type StorageV3RestoreResult =
  | Readonly<{ reader: 'sqlite-v3'; db: Database.Database; selection: StorageV3MigrationSelection }>
  | Readonly<{ reader: 'unavailable'; code: typeof STORAGE_V3_RESTORE_UNAVAILABLE }>

type RestoreStage =
  | 'claim'
  | 'copy'
  | 'normalize'
  | 'receipt'
  | 'link'
  | 'directory-sync'
  | 'temp-unlink'
  | 'readonly-reopen'

type RestoreDirectorySyncPhase = 'link' | 'temp-unlink'
type RestoreSynchronizer = (root: StorageV3ArtifactRoot, phase: RestoreDirectorySyncPhase) => void
type RestoreFailureInjector = (stage: RestoreStage) => void

const NO_FOLLOW = constants.O_NOFOLLOW ?? 0
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'binary')
const ARTIFACT_ID = /^art-[0-9a-f]{64}$/
const LEGACY_SOURCE_ID = /^legacy-[0-9a-f]{64}$/
const CANONICAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function restoreUnavailable(): StorageV3RestoreResult {
  return Object.freeze({ reader: 'unavailable' as const, code: STORAGE_V3_RESTORE_UNAVAILABLE })
}

function lstatRestore(path: string): BigIntStats | undefined {
  try { return lstatSync(path, { bigint: true }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    return fail()
  }
}

function sameRestoreIdentity(left: Readonly<{ dev: bigint; ino: bigint }>, right: Readonly<{ dev: bigint; ino: bigint }>): boolean {
  return (left.dev !== 0n || left.ino !== 0n)
    && (right.dev !== 0n || right.ino !== 0n)
    && left.dev === right.dev && left.ino === right.ino
}

function assertRestoreRegular(path: string, descriptor: number, expectedNlink: bigint): BigIntStats {
  const before = lstatRestore(path)
  if (before === undefined) return fail()
  const canonical = (() => { try { return realpathSync.native(path) } catch { return undefined } })()
  const handle = fstatSync(descriptor, { bigint: true })
  const after = lstatRestore(path)
  if (after === undefined || canonical !== path
    || !before.isFile() || before.isSymbolicLink() || before.nlink !== expectedNlink
    || !handle.isFile() || handle.isSymbolicLink() || handle.nlink !== expectedNlink
    || !after.isFile() || after.isSymbolicLink() || after.nlink !== expectedNlink
    || !sameRestoreIdentity(before, handle) || !sameRestoreIdentity(handle, after)
    || before.size !== handle.size || handle.size !== after.size) return fail()
  return handle
}

function assertRestoreNoSidecars(root: StorageV3ArtifactRoot, locator: string): void {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    if (lstatRestore(storageV3ArtifactFilePath(root, `${locator}${suffix}`)) !== undefined) return fail()
  }
}

function closeRestoreInput(raw: unknown): Readonly<StorageV3RestoreFromSelectionInput> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.getPrototypeOf(raw) !== Object.prototype) return fail()
  const expected = ['directory', 'backupAt', 'backupArtifactId', 'installationKey', 'selection'] as const
  const keys = Reflect.ownKeys(raw)
  if (keys.length !== expected.length || keys.some((key) => typeof key !== 'string' || !expected.includes(key as typeof expected[number]))) return fail()
  const read = (key: typeof expected[number]): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(raw, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return fail()
    return (descriptor as PropertyDescriptor & { value: unknown }).value
  }
  const directory = read('directory')
  const backupAt = read('backupAt')
  const backupArtifactId = read('backupArtifactId')
  const installationKey = read('installationKey')
  const value = read('selection')
  if (typeof directory !== 'string' || directory.length === 0
    || typeof backupAt !== 'string' || typeof backupArtifactId !== 'string' || !ARTIFACT_ID.test(backupArtifactId)
    || !installationKey || typeof installationKey !== 'object'
    || !value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const selectionKeys = ['readerState', 'legacySourceId', 'selectedArtifactId', 'backupArtifactId', 'successfulReportAt', 'graceDeadlineAt'] as const
  const ownSelectionKeys = Reflect.ownKeys(value)
  if (ownSelectionKeys.length !== selectionKeys.length
    || ownSelectionKeys.some((key) => typeof key !== 'string' || !selectionKeys.includes(key as typeof selectionKeys[number]))) return fail()
  const selectionValue = (key: typeof selectionKeys[number]): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return fail()
    return (descriptor as PropertyDescriptor & { value: unknown }).value
  }
  const readerState = selectionValue('readerState')
  const legacySourceId = selectionValue('legacySourceId')
  const selectedArtifactId = selectionValue('selectedArtifactId')
  const selectedBackupArtifactId = selectionValue('backupArtifactId')
  const successfulReportAt = selectionValue('successfulReportAt')
  const graceDeadlineAt = selectionValue('graceDeadlineAt')
  if (readerState !== 'v3_selected' || typeof legacySourceId !== 'string' || !LEGACY_SOURCE_ID.test(legacySourceId)
    || typeof selectedArtifactId !== 'string' || !ARTIFACT_ID.test(selectedArtifactId)
    || typeof selectedBackupArtifactId !== 'string' || !ARTIFACT_ID.test(selectedBackupArtifactId)
    || typeof successfulReportAt !== 'string' || !CANONICAL_TIMESTAMP.test(successfulReportAt)
    || typeof graceDeadlineAt !== 'string' || !CANONICAL_TIMESTAMP.test(graceDeadlineAt)
    || new Date(Date.parse(successfulReportAt) + 7 * 24 * 60 * 60 * 1000).toISOString() !== graceDeadlineAt) return fail()
  return Object.freeze({
    directory,
    backupAt,
    backupArtifactId,
    installationKey: installationKey as TaskInstallationKeyHandle,
    selection: Object.freeze({
      readerState: 'v3_selected' as const,
      legacySourceId,
      selectedArtifactId,
      backupArtifactId: selectedBackupArtifactId,
      successfulReportAt,
      graceDeadlineAt,
    }),
  })
}

function assertExactRestoreSelection(actual: StorageV3MigrationSelection, expected: StorageV3MigrationSelection): void {
  if (actual.readerState !== expected.readerState
    || actual.legacySourceId !== expected.legacySourceId
    || actual.selectedArtifactId !== expected.selectedArtifactId
    || actual.backupArtifactId !== expected.backupArtifactId
    || actual.successfulReportAt !== expected.successfulReportAt
    || actual.graceDeadlineAt !== expected.graceDeadlineAt) return fail()
}

function assertRestoreSelectedArtifact(db: Database.Database, expected: string): void {
  const rows = db.prepare("SELECT artifact_id, state FROM app_artifact WHERE kind = 'selected_store'").all() as Array<{ artifact_id: string; state: string }>
  if (rows.length !== 1 || rows[0]?.artifact_id !== expected || rows[0]?.state !== 'active') return fail()
}

function copyRestoreBackup(
  root: StorageV3ArtifactRoot,
  verified: StorageV3MigrationBackupRestoreVerification,
  tempPath: string,
  failAfterStage?: RestoreFailureInjector,
): Readonly<{ dev: bigint; ino: bigint; size: bigint }> {
  const sourcePath = storageV3ArtifactFilePath(root, verified.locator)
  let sourceDescriptor: number | undefined
  let tempDescriptor: number | undefined
  let claimedIdentity: Readonly<{ dev: bigint; ino: bigint }> | undefined
  try {
    sourceDescriptor = openSync(sourcePath, constants.O_RDONLY | NO_FOLLOW)
    const sourceBefore = assertRestoreRegular(sourcePath, sourceDescriptor, 1n)
    tempDescriptor = openSync(tempPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | NO_FOLLOW, 0o600)
    const claimed = assertRestoreRegular(tempPath, tempDescriptor, 1n)
    claimedIdentity = Object.freeze({ dev: claimed.dev, ino: claimed.ino })
    failAfterStage?.('claim')
    const hash = createHash('sha256')
    const buffer = Buffer.alloc(64 * 1024)
    let offset = 0
    for (;;) {
      const count = readSync(sourceDescriptor, buffer, 0, buffer.length, null)
      if (count === 0) break
      const chunk = buffer.subarray(0, count)
      hash.update(chunk)
      let written = 0
      while (written < count) written += writeSync(tempDescriptor!, chunk, written, count - written, offset + written)
      offset += count
    }
    fsyncSync(tempDescriptor)
    failAfterStage?.('copy')
    const sourceAfter = assertRestoreRegular(sourcePath, sourceDescriptor, 1n)
    const tempAfter = assertRestoreRegular(tempPath, tempDescriptor, 1n)
    if (!sameRestoreIdentity(sourceBefore, sourceAfter)
      || hash.digest('hex') !== verified.contentSha256
      || tempAfter.size !== sourceAfter.size
      || tempAfter.size < BigInt(SQLITE_HEADER.length)) return fail()
    return Object.freeze({ dev: tempAfter.dev, ino: tempAfter.ino, size: tempAfter.size })
  } catch (error) {
    if (claimedIdentity !== undefined) {
      try {
        const current = lstatRestore(tempPath)
        if (current !== undefined && current.isFile() && !current.isSymbolicLink()
          && current.nlink === 1n && sameRestoreIdentity(current, claimedIdentity)) unlinkSync(tempPath)
      } catch { /* preserve the single content-free refusal */ }
    }
    throw error
  } finally {
    if (tempDescriptor !== undefined) closeSync(tempDescriptor)
    if (sourceDescriptor !== undefined) closeSync(sourceDescriptor)
  }
}

function removeClaimedRestoreTemp(root: StorageV3ArtifactRoot, locator: string, identity: Readonly<{ dev: bigint; ino: bigint }>): void {
  const path = storageV3ArtifactFilePath(root, locator)
  const entry = lstatRestore(path)
  if (entry === undefined || entry.isSymbolicLink() || !entry.isFile() || entry.nlink !== 1n || !sameRestoreIdentity(entry, identity)) return
  unlinkSync(path)
}

function restoreFromVerifiedSelection(
  rawInput: unknown,
  synchronize: RestoreSynchronizer,
  failAfterStage?: RestoreFailureInjector,
): StorageV3RestoreResult {
  let closed: Readonly<StorageV3RestoreFromSelectionInput>
  try { closed = closeRestoreInput(rawInput) } catch { return restoreUnavailable() }
  let root: StorageV3ArtifactRoot | undefined
  let claimedTemp: Readonly<{ dev: bigint; ino: bigint }> | undefined
  let publishedIdentity: Readonly<{ dev: bigint; ino: bigint }> | undefined
  let writable: Database.Database | undefined
  try {
    root = openStorageV3ArtifactRoot(closed.directory)
    assertStorageV3ArtifactRootInstallationKey(root, closed.installationKey)
    return withStorageV3WriterLease(root, () => {
      const selectedPath = storageV3ArtifactFilePath(root!, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
      const tempLocator = STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary
      const tempPath = storageV3ArtifactFilePath(root!, tempLocator)
      const selectedEntry = lstatRestore(selectedPath)
      if (selectedEntry !== undefined) {
        if (selectedEntry.isSymbolicLink() || !selectedEntry.isFile()) return restoreUnavailable()
        const replay = openSelectedStorageV3StoreReadonly(closed.directory)
        try {
          const receipt = readStorageV3MigrationSelection(replay)
          if (receipt === undefined) return restoreUnavailable()
          assertExactRestoreSelection(receipt, closed.selection)
          assertRestoreSelectedArtifact(replay, closed.selection.selectedArtifactId)
          return Object.freeze({ reader: 'sqlite-v3' as const, db: replay, selection: receipt })
        } catch {
          if (replay.open) replay.close()
          return restoreUnavailable()
        }
      }
      assertRestoreNoSidecars(root!, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
      assertRestoreNoSidecars(root!, tempLocator)
      const verified = verifyStorageV3MigrationBackupForRestore({
        root: root!,
        backupAt: closed.backupAt,
        artifactId: closed.backupArtifactId,
        installationKey: closed.installationKey,
      })
      if (verified.selectedArtifactId !== closed.selection.selectedArtifactId
        || verified.artifactId !== closed.selection.backupArtifactId) return restoreUnavailable()
      claimedTemp = copyRestoreBackup(root!, verified, tempPath, failAfterStage)
      writable = new Database(tempPath, { fileMustExist: true })
      bindStorageV3ArtifactRoot(writable, root!)
      assertSelectableStorageV3Target(writable, { allowContinuityCasState: true })
      assertStorageV3ArtifactCatalogue(writable)
      failAfterStage?.('normalize')
      normalizeStorageV3RestoredSnapshot({
        db: writable,
        artifactId: verified.artifactId,
        stagedLocator: verified.stagedLocator,
        finalLocator: verified.locator,
        backupAt: verified.backupAt,
        selectedArtifactId: verified.selectedArtifactId,
        ownerScopeIds: verified.ownerScopeIds,
        intentSha256: verified.intentSha256,
      })
      failAfterStage?.('receipt')
      const recorded = recordStorageV3MigrationSelection(writable, {
        legacySourceId: closed.selection.legacySourceId,
        selectedArtifactId: closed.selection.selectedArtifactId,
        backupArtifactId: closed.selection.backupArtifactId,
        successfulReportAt: closed.selection.successfulReportAt,
      })
      assertExactRestoreSelection(recorded.selection, closed.selection)
      writable.close()
      writable = undefined
      assertRestoreNoSidecars(root!, tempLocator)
      const tempDescriptor = openSync(tempPath, constants.O_RDONLY | NO_FOLLOW)
      try {
        const stable = assertRestoreRegular(tempPath, tempDescriptor, 1n)
        fsyncSync(tempDescriptor)
        if (!sameRestoreIdentity(stable, claimedTemp!)) return fail()
      } finally { closeSync(tempDescriptor) }
      failAfterStage?.('link')
      linkSync(tempPath, selectedPath)
      const selectedDescriptor = openSync(selectedPath, constants.O_RDONLY | NO_FOLLOW)
      try {
        const selectedStable = assertRestoreRegular(selectedPath, selectedDescriptor, 2n)
        if (!sameRestoreIdentity(selectedStable, claimedTemp!)) return fail()
        publishedIdentity = Object.freeze({ dev: selectedStable.dev, ino: selectedStable.ino })
      } finally { closeSync(selectedDescriptor) }
      failAfterStage?.('directory-sync')
      synchronize(root!, 'link')
      failAfterStage?.('temp-unlink')
      unlinkSync(tempPath)
      synchronize(root!, 'temp-unlink')
      failAfterStage?.('readonly-reopen')
      const reader = openSelectedStorageV3StoreReadonly(closed.directory)
      try {
        const receipt = readStorageV3MigrationSelection(reader)
        if (receipt === undefined) return fail()
        assertExactRestoreSelection(receipt, closed.selection)
        assertRestoreSelectedArtifact(reader, closed.selection.selectedArtifactId)
        return Object.freeze({ reader: 'sqlite-v3' as const, db: reader, selection: receipt })
      } catch {
        if (reader.open) reader.close()
        return fail()
      }
    })
  } catch {
    if (writable?.open) { try { writable.close() } catch { /* refusal remains content-free */ } }
    if (root !== undefined && publishedIdentity === undefined && claimedTemp !== undefined) {
      try { removeClaimedRestoreTemp(root, STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary, claimedTemp) } catch { /* preserve exact safe recovery state */ }
    }
    return restoreUnavailable()
  }
}

/** Restore from an exact, externally verified selection receipt. */
export function restoreStorageV3SelectedStoreFromVerifiedSelection(
  input: StorageV3RestoreFromSelectionInput,
): StorageV3RestoreResult {
  return restoreFromVerifiedSelection(input, syncStorageV3ArtifactDirectory)
}

/** @internal invented-fixture synchronizer/failure seam; unavailable to production callers. */
export const v3RestorePublicationTestSeams = Object.freeze({
  restoreWithSynchronizer(
    input: StorageV3RestoreFromSelectionInput,
    synchronize: RestoreSynchronizer,
    failAfterStage?: RestoreFailureInjector,
  ): StorageV3RestoreResult {
    if (typeof synchronize !== 'function' || (failAfterStage !== undefined && typeof failAfterStage !== 'function')) return restoreUnavailable()
    return restoreFromVerifiedSelection(input, synchronize, failAfterStage)
  },
})
