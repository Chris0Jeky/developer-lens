import { createHash } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  unlinkSync,
  type BigIntStats,
} from 'node:fs'
import Database from 'better-sqlite3'
import {
  assertStorageV3ArtifactRootInstallationKey,
  openStorageV3ArtifactRoot,
  storageV3ArtifactFilePath,
  storageV3ArtifactRootBinding,
  storageV3MaintenanceStatus,
  syncStorageV3ArtifactDirectory,
  STORAGE_V3_ARTIFACT_LOCATORS,
  type StorageV3ArtifactRoot,
} from './v3ArtifactCatalogue.js'
import {
  consumeStorageV3MigrationSelectionProof,
  verifyStorageV3MigrationSelectionProof,
  v3SelectionProofTestSeams,
  type StorageV3MigrationSelectionProofHandle,
} from './v3SelectionProof.js'
import {
  readStorageV3MigrationSelection,
  type StorageV3MigrationSelection,
} from './v3SelectionReceipt.js'
import {
  assertStorageV3RevocationReplayApplied,
  verifyStorageV3RevocationReplay,
} from './v3RevocationReplay.js'
import {
  STORAGE_V3_MIGRATION_CLEANUP_FILE_ROLES,
  STORAGE_V3_MIGRATION_CLEANUP_PHASES,
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  STORAGE_V3_SHADOW_USER_VERSION,
  storageV3ShadowSchemaFingerprint,
  type StorageV3MigrationCleanupFileRole,
  type StorageV3MigrationCleanupPhase,
} from './v3ShadowSchema.js'
import type { TaskInstallationKeyHandle } from './taskInstallationKey.js'
import { withStorageV3WriterLease, type StorageV3WriterLease } from './v3WriterLease.js'
import type { StorageV3MigrationBackupRestoreVerification } from './v3Backup.js'

/** The v1 importer must stage its app-owned source at this fixed name before registration. */
export const STORAGE_V3_LEGACY_SOURCE_LOCATOR = 'legacy-source-v1.json' as const
export const STORAGE_V3_MIGRATION_CLEANUP_ERROR = 'STORAGE_V3_MIGRATION_CLEANUP_REFUSED' as const

export class StorageV3MigrationCleanupError extends Error {
  public readonly code = STORAGE_V3_MIGRATION_CLEANUP_ERROR

  constructor() {
    super(STORAGE_V3_MIGRATION_CLEANUP_ERROR)
    this.name = 'StorageV3MigrationCleanupError'
  }
}

const fail = (): never => { throw new StorageV3MigrationCleanupError() }
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0
const HEX = /^[0-9a-f]{64}$/
const LEGACY_ID = /^legacy-[0-9a-f]{64}$/
const CANONICAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ISO_WEEK = /^\d{4}-W(?:0[1-9]|[1-4][0-9]|5[0-3])$/

type CleanupState = Readonly<{
  phase: StorageV3MigrationCleanupPhase
  legacySourceId: string | null
  selectedArtifactId: string | null
  backupArtifactId: string | null
  taskFingerprint: string
  rootBinding: string
  completedWeek: string | null
}>

type CleanupFile = Readonly<{
  role: StorageV3MigrationCleanupFileRole
  locator: string
  expectedPresent: boolean
  dev: bigint | null
  ino: bigint | null
  nlink: bigint | null
  sha256: string | null
}>

type StableFile = Readonly<{
  path: string
  dev: bigint
  ino: bigint
  nlink: bigint
  size: bigint
  ctimeNs: bigint
  mtimeNs: bigint
  sha256: string
}>

export type StorageV3MigrationCleanupRegistrationInput = Readonly<{
  db: Database.Database
  root: StorageV3ArtifactRoot
  legacySourceId: string
  installationKey: TaskInstallationKeyHandle
}>

export type StorageV3MigrationCleanupSelectionInput = Readonly<{
  db: Database.Database
  root: StorageV3ArtifactRoot
  legacySourceId: string
  selectedArtifactId: string
  backupArtifactId: string
  installationKey: TaskInstallationKeyHandle
}>

export type StorageV3MigrationCleanupInput = Readonly<{
  directory: string
  installationKey: TaskInstallationKeyHandle
}>

export type StorageV3RestoredMigrationCleanupRegistrationInput = Readonly<{
  db: Database.Database
  root: StorageV3ArtifactRoot
  selection: StorageV3MigrationSelection
  verification: StorageV3MigrationBackupRestoreVerification
  installationKey: TaskInstallationKeyHandle
}>

export type StorageV3MigrationCleanupResult = Readonly<{
  status: 'not_due' | 'complete' | 'replayed'
}>

export const STORAGE_V3_MIGRATION_CLEANUP_STAGES = [
  'legacyIntent',
  'legacyWalUnlinked',
  'legacyShmUnlinked',
  'legacyJournalUnlinked',
  'legacyBaseUnlinked',
  'legacyDirectorySynced',
  'legacyDurable',
  'backupIntent',
  'backupWalUnlinked',
  'backupShmUnlinked',
  'backupJournalUnlinked',
  'backupSqliteUnlinked',
  'backupManifestUnlinked',
  'backupDirectorySynced',
  'complete',
] as const
export type StorageV3MigrationCleanupStage = typeof STORAGE_V3_MIGRATION_CLEANUP_STAGES[number]
type DirectorySynchronizer = (root: StorageV3ArtifactRoot, phase: 'preflight' | 'legacy' | 'backup') => void
type ProofVerifier = (
  root: StorageV3ArtifactRoot,
  installationKey: TaskInstallationKeyHandle,
) => StorageV3MigrationSelectionProofHandle

function ownValues(raw: unknown, expected: readonly string[]): Map<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)
    || Object.getPrototypeOf(raw as object) !== Object.prototype) fail()
  const keys = Reflect.ownKeys(raw as object)
  if (keys.length !== expected.length
    || keys.some((key) => typeof key !== 'string' || !expected.includes(key))) fail()
  const result = new Map<string, unknown>()
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(raw as object, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail()
    result.set(key, (descriptor as PropertyDescriptor & { value: unknown }).value)
  }
  return result
}

function sameIdentity(left: Readonly<{ dev: bigint; ino: bigint }>, right: Readonly<{ dev: bigint; ino: bigint }>): boolean {
  return (left.dev !== 0n || left.ino !== 0n) && left.dev === right.dev && left.ino === right.ino
}

function statOrAbsent(path: string): BigIntStats | undefined {
  try { return lstatSync(path, { bigint: true }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    return fail()
  }
}

function hashDescriptor(descriptor: number): string {
  const hash = createHash('sha256')
  const buffer = Buffer.alloc(64 * 1024)
  for (;;) {
    const count = readSync(descriptor, buffer, 0, buffer.length, null)
    if (count === 0) break
    hash.update(buffer.subarray(0, count))
  }
  return hash.digest('hex')
}

function captureStable(root: StorageV3ArtifactRoot, locator: string, expectedNlink = 1n): StableFile {
  const path = storageV3ArtifactFilePath(root, locator)
  let descriptor: number | undefined
  try {
    const before = statOrAbsent(path) ?? fail()
    const canonical = realpathSync.native(path)
    descriptor = openSync(path, constants.O_RDONLY | NO_FOLLOW)
    const handleBefore = fstatSync(descriptor, { bigint: true })
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== expectedNlink
      || !handleBefore.isFile() || handleBefore.isSymbolicLink() || handleBefore.nlink !== expectedNlink
      || canonical !== path || !sameIdentity(before, handleBefore)
      || before.size !== handleBefore.size || before.ctimeNs !== handleBefore.ctimeNs
      || before.mtimeNs !== handleBefore.mtimeNs) fail()
    const sha256 = hashDescriptor(descriptor)
    const handleAfter = fstatSync(descriptor, { bigint: true })
    const after = statOrAbsent(path) ?? fail()
    if (!sameIdentity(handleBefore, handleAfter) || !sameIdentity(handleAfter, after)
      || handleAfter.nlink !== expectedNlink || after.nlink !== expectedNlink
      || handleBefore.size !== handleAfter.size || handleAfter.size !== after.size
      || handleBefore.ctimeNs !== handleAfter.ctimeNs || handleAfter.ctimeNs !== after.ctimeNs
      || handleBefore.mtimeNs !== handleAfter.mtimeNs || handleAfter.mtimeNs !== after.mtimeNs) fail()
    return Object.freeze({
      path,
      dev: handleAfter.dev,
      ino: handleAfter.ino,
      nlink: handleAfter.nlink,
      size: handleAfter.size,
      ctimeNs: handleAfter.ctimeNs,
      mtimeNs: handleAfter.mtimeNs,
      sha256,
    })
  } catch (error) {
    if (error instanceof StorageV3MigrationCleanupError) throw error
    return fail()
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function canonicalUnsigned(value: unknown): bigint | null {
  if (value === null) return null
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,19})$/.test(value)) return fail()
  return BigInt(value)
}

function readState(db: Database.Database): CleanupState | undefined {
  const rows = db.prepare(
    `SELECT phase, legacy_source_id, selected_artifact_id, backup_artifact_id,
            task_fingerprint, root_binding, completed_week
     FROM migration_cleanup_state WHERE singleton = 1`,
  ).all() as Array<Record<string, unknown>>
  if (rows.length === 0) return undefined
  if (rows.length !== 1) return fail()
  const row = rows[0]!
  if (typeof row.phase !== 'string'
    || !(STORAGE_V3_MIGRATION_CLEANUP_PHASES as readonly string[]).includes(row.phase)
    || typeof row.task_fingerprint !== 'string' || !HEX.test(row.task_fingerprint)
    || typeof row.root_binding !== 'string' || !/^root-[0-9a-f]{64}$/.test(row.root_binding)
    || (row.legacy_source_id !== null && (typeof row.legacy_source_id !== 'string' || !LEGACY_ID.test(row.legacy_source_id)))
    || (row.selected_artifact_id !== null && (typeof row.selected_artifact_id !== 'string' || !/^art-[0-9a-f]{64}$/.test(row.selected_artifact_id)))
    || (row.backup_artifact_id !== null && (typeof row.backup_artifact_id !== 'string' || !/^art-[0-9a-f]{64}$/.test(row.backup_artifact_id)))
    || (row.completed_week !== null && (typeof row.completed_week !== 'string' || !ISO_WEEK.test(row.completed_week)))) fail()
  return Object.freeze({
    phase: row.phase as StorageV3MigrationCleanupPhase,
    legacySourceId: row.legacy_source_id as string | null,
    selectedArtifactId: row.selected_artifact_id as string | null,
    backupArtifactId: row.backup_artifact_id as string | null,
    taskFingerprint: row.task_fingerprint as string,
    rootBinding: row.root_binding as string,
    completedWeek: row.completed_week as string | null,
  })
}

function readFiles(db: Database.Database): readonly CleanupFile[] {
  const rows = db.prepare(
    `SELECT role, relative_locator, expected_present, file_dev, file_ino, file_nlink, content_sha256
     FROM migration_cleanup_file ORDER BY role`,
  ).all() as Array<Record<string, unknown>>
  return Object.freeze(rows.map((row): CleanupFile => {
    if (typeof row.role !== 'string'
      || !(STORAGE_V3_MIGRATION_CLEANUP_FILE_ROLES as readonly string[]).includes(row.role)
      || typeof row.relative_locator !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(row.relative_locator)
      || (row.expected_present !== 0 && row.expected_present !== 1)) return fail()
    const dev = canonicalUnsigned(row.file_dev)
    const ino = canonicalUnsigned(row.file_ino)
    const nlink = canonicalUnsigned(row.file_nlink)
    const sha256 = row.content_sha256
    if (row.expected_present === 0) {
      if (dev !== null || ino !== null || nlink !== null || sha256 !== null) return fail()
    } else if (dev === null || ino === null || nlink === null || nlink === 0n
      || (dev === 0n && ino === 0n) || typeof sha256 !== 'string' || !HEX.test(sha256)) return fail()
    return Object.freeze({
      role: row.role as StorageV3MigrationCleanupFileRole,
      locator: row.relative_locator,
      expectedPresent: row.expected_present === 1,
      dev,
      ino,
      nlink,
      sha256: sha256 as string | null,
    })
  }))
}

function assertStoreAt(db: Database.Database, expectedPath: string): void {
  if (!db?.open || db.inTransaction || db.name !== expectedPath
    || Number(db.prepare('PRAGMA application_id').pluck().get()) !== STORAGE_V3_SHADOW_APPLICATION_ID
    || Number(db.prepare('PRAGMA user_version').pluck().get()) !== STORAGE_V3_SHADOW_USER_VERSION
    || storageV3ShadowSchemaFingerprint(db) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT) fail()
}

function assertStore(db: Database.Database, root: StorageV3ArtifactRoot): void {
  assertStoreAt(db, storageV3ArtifactFilePath(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
}

function fileMap(db: Database.Database, exact = true): Map<StorageV3MigrationCleanupFileRole, CleanupFile> {
  const files = readFiles(db)
  if (exact && (files.length !== STORAGE_V3_MIGRATION_CLEANUP_FILE_ROLES.length
    || STORAGE_V3_MIGRATION_CLEANUP_FILE_ROLES.some((role) => !files.some((file) => file.role === role)))) fail()
  return new Map(files.map((file) => [file.role, file]))
}

function assertFile(root: StorageV3ArtifactRoot, file: CleanupFile, allowRemoved: boolean): void {
  const path = storageV3ArtifactFilePath(root, file.locator)
  const entry = statOrAbsent(path)
  if (!file.expectedPresent) {
    if (entry !== undefined) fail()
    return
  }
  if (entry === undefined) {
    if (!allowRemoved) fail()
    return
  }
  const stable = captureStable(root, file.locator, file.nlink ?? fail())
  if (file.dev !== stable.dev || file.ino !== stable.ino || file.nlink !== stable.nlink
    || file.sha256 !== stable.sha256) fail()
}

function assertFiles(root: StorageV3ArtifactRoot, files: Iterable<CleanupFile>, allowRemoved: boolean): void {
  for (const file of files) assertFile(root, file, allowRemoved)
}

function assertBinding(
  state: CleanupState,
  root: StorageV3ArtifactRoot,
  installationKey: TaskInstallationKeyHandle,
): void {
  assertStorageV3ArtifactRootInstallationKey(root, installationKey)
  if (state.taskFingerprint !== installationKey.fingerprint
    || state.rootBinding !== storageV3ArtifactRootBinding(root)) fail()
}

function assertReadyValues(
  state: CleanupState,
  expected: Readonly<{
    legacySourceId: string
    selectedArtifactId: string
    backupArtifactId: string
  }>,
): void {
  if (state.phase !== 'ready'
    || state.legacySourceId !== expected.legacySourceId
    || state.selectedArtifactId !== expected.selectedArtifactId
    || state.backupArtifactId !== expected.backupArtifactId
    || state.completedWeek !== null) fail()
}

/**
 * Complete the pre-selection registry using only the fixed app-owned legacy
 * locator. Backup locators and identities were transferred during promotion.
 */
export function registerStorageV3MigrationCleanup(
  rawInput: StorageV3MigrationCleanupRegistrationInput,
): void {
  const values = ownValues(rawInput, ['db', 'root', 'legacySourceId', 'installationKey'])
  const db = values.get('db') as Database.Database
  const root = values.get('root') as StorageV3ArtifactRoot
  const legacySourceId = values.get('legacySourceId')
  const installationKey = values.get('installationKey') as TaskInstallationKeyHandle
  if (typeof legacySourceId !== 'string' || !LEGACY_ID.test(legacySourceId)
    || !root || typeof root !== 'object' || !installationKey || typeof installationKey !== 'object') fail()
  assertStore(db, root)
  assertStorageV3ArtifactRootInstallationKey(root, installationKey)
  if (storageV3MaintenanceStatus(db) !== 'complete'
    || db.prepare('SELECT 1 FROM migration_selection_state LIMIT 1').get() !== undefined) fail()
  const state = readState(db) ?? fail()
  if (state.phase !== 'backup_bound' || state.legacySourceId !== null
    || state.taskFingerprint !== installationKey.fingerprint
    || state.rootBinding !== storageV3ArtifactRootBinding(root)
    || state.selectedArtifactId === null || state.backupArtifactId === null) fail()
  const selected = db.prepare(
    "SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store' AND state = 'active'",
  ).pluck().all() as string[]
  const backup = db.prepare(
    "SELECT artifact_id FROM app_artifact WHERE kind = 'migration_backup_v1' AND state = 'active'",
  ).pluck().all() as string[]
  if (selected.length !== 1 || selected[0] !== state.selectedArtifactId
    || backup.length !== 1 || backup[0] !== state.backupArtifactId) fail()
  const existing = fileMap(db, false)
  const backupRoles = STORAGE_V3_MIGRATION_CLEANUP_FILE_ROLES.filter((role) => role.startsWith('backup_'))
  if (existing.size !== backupRoles.length || backupRoles.some((role) => !existing.has(role))) fail()
  assertFiles(root, existing.values(), false)

  const legacyLocators = Object.freeze({
    legacy_base: STORAGE_V3_LEGACY_SOURCE_LOCATOR,
    legacy_wal: `${STORAGE_V3_LEGACY_SOURCE_LOCATOR}-wal`,
    legacy_shm: `${STORAGE_V3_LEGACY_SOURCE_LOCATOR}-shm`,
    legacy_journal: `${STORAGE_V3_LEGACY_SOURCE_LOCATOR}-journal`,
  } as const)
  const captured = new Map<StorageV3MigrationCleanupFileRole, StableFile | undefined>()
  for (const [role, locator] of Object.entries(legacyLocators) as Array<
    [keyof typeof legacyLocators, string]
  >) {
    const present = statOrAbsent(storageV3ArtifactFilePath(root, locator))
    if (role === 'legacy_base' && present === undefined) fail()
    captured.set(role, present === undefined ? undefined : captureStable(root, locator))
  }
  db.transaction(() => {
    const current = readState(db) ?? fail()
    if (current.phase !== 'backup_bound'
      || current.selectedArtifactId !== state.selectedArtifactId
      || current.backupArtifactId !== state.backupArtifactId) fail()
    const insert = db.prepare(
      `INSERT INTO migration_cleanup_file (
        role, relative_locator, expected_present, file_dev, file_ino, file_nlink, content_sha256
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const [role, locator] of Object.entries(legacyLocators) as Array<
      [keyof typeof legacyLocators, string]
    >) {
      const file = captured.get(role)
      insert.run(
        role,
        locator,
        file === undefined ? 0 : 1,
        file?.dev.toString(10) ?? null,
        file?.ino.toString(10) ?? null,
        file?.nlink.toString(10) ?? null,
        file?.sha256 ?? null,
      )
    }
    if (db.prepare(
      `UPDATE migration_cleanup_state SET phase = 'ready', legacy_source_id = ?
       WHERE singleton = 1 AND phase = 'backup_bound'`,
    ).run(legacySourceId).changes !== 1) fail()
  }).immediate()
  const ready = readState(db) ?? fail()
  const selectedArtifactId = state.selectedArtifactId ?? fail()
  const backupArtifactId = state.backupArtifactId ?? fail()
  assertReadyValues(ready, {
    legacySourceId: legacySourceId as string,
    selectedArtifactId,
    backupArtifactId,
  })
  assertFiles(root, fileMap(db).values(), false)
}

/**
 * Rebuild the same ready registry in a verified restored snapshot. The backup
 * image predates its own final publication identity, so the restore verifier's
 * exact external pair is the only accepted source for these rows.
 */
export function registerRestoredStorageV3MigrationCleanup(
  rawInput: StorageV3RestoredMigrationCleanupRegistrationInput,
): void {
  const values = ownValues(rawInput, ['db', 'root', 'selection', 'verification', 'installationKey'])
  const db = values.get('db') as Database.Database
  const root = values.get('root') as StorageV3ArtifactRoot
  const selection = values.get('selection') as StorageV3MigrationSelection
  const verification = values.get('verification') as StorageV3MigrationBackupRestoreVerification
  const installationKey = values.get('installationKey') as TaskInstallationKeyHandle
  if (!root || typeof root !== 'object' || !selection || typeof selection !== 'object'
    || !verification || typeof verification !== 'object'
    || !installationKey || typeof installationKey !== 'object') fail()
  assertStoreAt(db, storageV3ArtifactFilePath(root, STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary))
  assertStorageV3ArtifactRootInstallationKey(root, installationKey)
  if (storageV3MaintenanceStatus(db) !== 'complete'
    || readState(db) !== undefined || readFiles(db).length !== 0
    || db.prepare('SELECT 1 FROM migration_selection_state LIMIT 1').get() !== undefined
    || !LEGACY_ID.test(selection.legacySourceId)
    || verification.artifactId !== selection.backupArtifactId
    || verification.selectedArtifactId !== selection.selectedArtifactId
    || !/^migration-backup-[0-9]{8}T[0-9]{6}Z\.sqlite$/.test(verification.locator)
    || verification.stagedLocator !== `${verification.locator}.tmp`
    || !HEX.test(verification.contentSha256) || !HEX.test(verification.manifestSha256)) fail()
  const selected = db.prepare(
    "SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store' AND state = 'active'",
  ).pluck().all() as string[]
  if (selected.length !== 1 || selected[0] !== selection.selectedArtifactId
    || db.prepare("SELECT 1 FROM app_artifact WHERE kind = 'migration_backup_v1'").get() !== undefined) fail()

  const legacyLocators = Object.freeze({
    legacy_base: STORAGE_V3_LEGACY_SOURCE_LOCATOR,
    legacy_wal: `${STORAGE_V3_LEGACY_SOURCE_LOCATOR}-wal`,
    legacy_shm: `${STORAGE_V3_LEGACY_SOURCE_LOCATOR}-shm`,
    legacy_journal: `${STORAGE_V3_LEGACY_SOURCE_LOCATOR}-journal`,
  } as const)
  const legacy = new Map<keyof typeof legacyLocators, StableFile | undefined>()
  for (const [role, locator] of Object.entries(legacyLocators) as Array<
    [keyof typeof legacyLocators, string]
  >) {
    const present = statOrAbsent(storageV3ArtifactFilePath(root, locator))
    if (role === 'legacy_base' && present === undefined) fail()
    legacy.set(role, present === undefined ? undefined : captureStable(root, locator))
  }
  const backupSqlite = captureStable(root, verification.locator)
  const backupManifestLocator = `${verification.locator}.manifest.json`
  const backupManifest = captureStable(root, backupManifestLocator)
  if (backupSqlite.sha256 !== verification.contentSha256
    || backupManifest.sha256 !== verification.manifestSha256) fail()
  const absentBackupLocators = Object.freeze({
    backup_wal: `${verification.locator}-wal`,
    backup_shm: `${verification.locator}-shm`,
    backup_journal: `${verification.locator}-journal`,
    backup_temp_sqlite: verification.stagedLocator,
    backup_temp_manifest: `${verification.stagedLocator}.manifest.json`,
  } as const)
  for (const locator of Object.values(absentBackupLocators)) {
    if (statOrAbsent(storageV3ArtifactFilePath(root, locator)) !== undefined) fail()
  }

  db.transaction(() => {
    db.prepare(
      `INSERT INTO migration_cleanup_state (
        singleton, phase, selected_artifact_id, backup_artifact_id, task_fingerprint, root_binding
      ) VALUES (1, 'backup_bound', ?, ?, ?, ?)`,
    ).run(
      selection.selectedArtifactId,
      selection.backupArtifactId,
      installationKey.fingerprint,
      storageV3ArtifactRootBinding(root),
    )
    const insert = db.prepare(
      `INSERT INTO migration_cleanup_file (
        role, relative_locator, expected_present, file_dev, file_ino, file_nlink, content_sha256
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const present = (role: string, locator: string, file: StableFile): void => {
      insert.run(
        role, locator, 1,
        file.dev.toString(10), file.ino.toString(10), file.nlink.toString(10), file.sha256,
      )
    }
    const absent = (role: string, locator: string): void => {
      insert.run(role, locator, 0, null, null, null, null)
    }
    present('backup_sqlite', verification.locator, backupSqlite)
    present('backup_manifest', backupManifestLocator, backupManifest)
    for (const [role, locator] of Object.entries(absentBackupLocators)) absent(role, locator)
    for (const [role, locator] of Object.entries(legacyLocators) as Array<
      [keyof typeof legacyLocators, string]
    >) {
      const file = legacy.get(role)
      if (file === undefined) absent(role, locator)
      else present(role, locator, file)
    }
    if (db.prepare(
      `UPDATE migration_cleanup_state SET phase = 'ready', legacy_source_id = ?
       WHERE singleton = 1 AND phase = 'backup_bound'`,
    ).run(selection.legacySourceId).changes !== 1) fail()
  }).immediate()
  const ready = readState(db) ?? fail()
  assertBinding(ready, root, installationKey)
  assertReadyValues(ready, {
    legacySourceId: selection.legacySourceId,
    selectedArtifactId: selection.selectedArtifactId,
    backupArtifactId: selection.backupArtifactId,
  })
  assertFiles(root, fileMap(db).values(), false)
}

/** Selection is unavailable unless the entire fixed cleanup registry is exact. */
export function assertStorageV3MigrationCleanupSelectionReady(
  rawInput: StorageV3MigrationCleanupSelectionInput,
): void {
  const values = ownValues(rawInput, [
    'db', 'root', 'legacySourceId', 'selectedArtifactId', 'backupArtifactId', 'installationKey',
  ])
  const db = values.get('db') as Database.Database
  const root = values.get('root') as StorageV3ArtifactRoot
  const installationKey = values.get('installationKey') as TaskInstallationKeyHandle
  const expected = {
    legacySourceId: values.get('legacySourceId'),
    selectedArtifactId: values.get('selectedArtifactId'),
    backupArtifactId: values.get('backupArtifactId'),
  }
  if (!root || typeof root !== 'object' || !installationKey || typeof installationKey !== 'object'
    || typeof expected.legacySourceId !== 'string' || !LEGACY_ID.test(expected.legacySourceId)
    || typeof expected.selectedArtifactId !== 'string' || !/^art-[0-9a-f]{64}$/.test(expected.selectedArtifactId)
    || typeof expected.backupArtifactId !== 'string' || !/^art-[0-9a-f]{64}$/.test(expected.backupArtifactId)) fail()
  assertStore(db, root)
  if (storageV3MaintenanceStatus(db) !== 'complete') fail()
  const state = readState(db) ?? fail()
  assertBinding(state, root, installationKey)
  assertReadyValues(state, expected as {
    legacySourceId: string; selectedArtifactId: string; backupArtifactId: string
  })
  assertFiles(root, fileMap(db).values(), false)
}

function canonicalNow(value: unknown): string {
  if (typeof value !== 'string' || !CANONICAL_TIMESTAMP.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) fail()
  return value as string
}

function isoWeek(timestamp: string): string {
  const date = new Date(timestamp)
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7))
  const first = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((thursday.getTime() - first.getTime()) / 86_400_000) + 1) / 7)
  const result = `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
  if (!ISO_WEEK.test(result)) return fail()
  return result
}

function exactSelection(left: StorageV3MigrationSelection, right: StorageV3MigrationSelection): boolean {
  return left.readerState === right.readerState
    && left.legacySourceId === right.legacySourceId
    && left.selectedArtifactId === right.selectedArtifactId
    && left.backupArtifactId === right.backupArtifactId
    && left.successfulReportAt === right.successfulReportAt
    && left.graceDeadlineAt === right.graceDeadlineAt
}

function openReadonlySelection(
  root: StorageV3ArtifactRoot,
): Readonly<{ db: Database.Database; selection: StorageV3MigrationSelection; state: CleanupState }> {
  const path = storageV3ArtifactFilePath(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
  captureStable(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
  let db: Database.Database | undefined
  try {
    db = new Database(path, { fileMustExist: true, readonly: true })
    assertStore(db, root)
    const selection = readStorageV3MigrationSelection(db) ?? fail()
    const state = readState(db) ?? fail()
    return Object.freeze({ db, selection, state })
  } catch (error) {
    if (db?.open) db.close()
    if (error instanceof StorageV3MigrationCleanupError) throw error
    return fail()
  }
}

function transition(db: Database.Database, from: StorageV3MigrationCleanupPhase, to: StorageV3MigrationCleanupPhase): void {
  if (db.prepare(
    'UPDATE migration_cleanup_state SET phase = ? WHERE singleton = 1 AND phase = ?',
  ).run(to, from).changes !== 1) fail()
}

function unlinkRegistered(
  root: StorageV3ArtifactRoot,
  file: CleanupFile,
  allowRemoved: boolean,
): void {
  assertFile(root, file, allowRemoved)
  const path = storageV3ArtifactFilePath(root, file.locator)
  if (statOrAbsent(path) === undefined) return
  unlinkSync(path)
  if (statOrAbsent(path) !== undefined) fail()
}

function phaseFiles(
  files: Map<StorageV3MigrationCleanupFileRole, CleanupFile>,
  prefix: 'legacy_' | 'backup_',
): CleanupFile[] {
  const result = [...files.values()].filter(({ role }) => role.startsWith(prefix))
  const expected = STORAGE_V3_MIGRATION_CLEANUP_FILE_ROLES.filter((role) => role.startsWith(prefix))
  if (result.length !== expected.length || expected.some((role) => !result.some((file) => file.role === role))) fail()
  return result
}

function finalizeBackupCatalogue(db: Database.Database, backupArtifactId: string, completedWeek: string): void {
  db.transaction(() => {
    const state = readState(db) ?? fail()
    if (state.phase !== 'backup_deleting' || state.backupArtifactId !== backupArtifactId) fail()
    const artifact = db.prepare(
      "SELECT state FROM app_artifact WHERE artifact_id = ? AND kind = 'migration_backup_v1'",
    ).get(backupArtifactId) as { state: string } | undefined
    if (artifact !== undefined) {
      if (artifact.state !== 'active') fail()
      db.prepare('DELETE FROM app_artifact_scope WHERE artifact_id = ?').run(backupArtifactId)
      if (db.prepare('DELETE FROM app_artifact WHERE artifact_id = ?').run(backupArtifactId).changes !== 1) fail()
    }
    db.prepare('DELETE FROM migration_cleanup_file').run()
    if (db.prepare(
      `UPDATE migration_cleanup_state
       SET phase = 'complete', legacy_source_id = NULL,
           selected_artifact_id = NULL, backup_artifact_id = NULL, completed_week = ?
       WHERE singleton = 1 AND phase = 'backup_deleting'`,
    ).run(completedWeek).changes !== 1) fail()
  }).immediate()
}

function runExpiredCleanup(
  input: StorageV3MigrationCleanupInput,
  now: () => string,
  synchronize: DirectorySynchronizer,
  verifyProof: ProofVerifier,
  failAfterStage?: (stage: StorageV3MigrationCleanupStage) => void,
): StorageV3MigrationCleanupResult {
  const values = ownValues(input, ['directory', 'installationKey'])
  const directory = values.get('directory')
  const installationKey = values.get('installationKey') as TaskInstallationKeyHandle
  if (typeof directory !== 'string' || directory.length === 0
    || !installationKey || typeof installationKey !== 'object') fail()
  const root = openStorageV3ArtifactRoot(directory as string)
  assertStorageV3ArtifactRootInstallationKey(root, installationKey)
  const current = canonicalNow(now())
  const initial = openReadonlySelection(root)
  const selection = initial.selection
  const initialState = initial.state
  initial.db.close()
  assertBinding(initialState, root, installationKey)
  if (current < selection.graceDeadlineAt) {
    return Object.freeze({ status: 'not_due' as const })
  }
  synchronize(root, 'preflight')
  return withStorageV3WriterLease(root, (lease: StorageV3WriterLease) => {
    const path = storageV3ArtifactFilePath(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
    const db = new Database(path, { fileMustExist: true })
    try {
      assertStore(db, root)
      const durableSelection = readStorageV3MigrationSelection(db) ?? fail()
      if (!exactSelection(selection, durableSelection) || current < durableSelection.graceDeadlineAt) fail()
      const proof = consumeStorageV3MigrationSelectionProof(
        verifyProof(root, installationKey), root, installationKey,
      )
      if (!exactSelection(proof, durableSelection)) fail()
      if (storageV3MaintenanceStatus(db) !== 'complete') fail()
      const replay = verifyStorageV3RevocationReplay(root, installationKey, durableSelection, lease)
      assertStorageV3RevocationReplayApplied(db, replay)
      let state = readState(db) ?? fail()
      assertBinding(state, root, installationKey)
      if (state.phase === 'complete') {
        if (readFiles(db).length !== 0 || state.completedWeek === null) fail()
        return Object.freeze({ status: 'replayed' as const })
      }
      if (state.legacySourceId !== durableSelection.legacySourceId
        || state.selectedArtifactId !== durableSelection.selectedArtifactId
        || state.backupArtifactId !== durableSelection.backupArtifactId
        || state.completedWeek !== null) fail()
      const files = fileMap(db)
      const legacyFiles = phaseFiles(files, 'legacy_')
      const backupFiles = phaseFiles(files, 'backup_')

      if (state.phase === 'ready') {
        assertFiles(root, [...legacyFiles, ...backupFiles], false)
        db.transaction(() => transition(db, 'ready', 'legacy_deleting')).immediate()
        failAfterStage?.('legacyIntent')
        state = readState(db) ?? fail()
      }
      if (state.phase === 'legacy_deleting') {
        const ordered = [
          ['legacy_wal', 'legacyWalUnlinked'],
          ['legacy_shm', 'legacyShmUnlinked'],
          ['legacy_journal', 'legacyJournalUnlinked'],
          ['legacy_base', 'legacyBaseUnlinked'],
        ] as const
        for (const [role, stage] of ordered) {
          unlinkRegistered(root, files.get(role) ?? fail(), true)
          failAfterStage?.(stage)
        }
        synchronize(root, 'legacy')
        failAfterStage?.('legacyDirectorySynced')
        db.transaction(() => transition(db, 'legacy_deleting', 'legacy_durable')).immediate()
        failAfterStage?.('legacyDurable')
        state = readState(db) ?? fail()
      }
      if (state.phase === 'legacy_durable') {
        for (const file of legacyFiles) {
          if (statOrAbsent(storageV3ArtifactFilePath(root, file.locator)) !== undefined) fail()
        }
        assertFiles(root, backupFiles, false)
        db.transaction(() => transition(db, 'legacy_durable', 'backup_deleting')).immediate()
        failAfterStage?.('backupIntent')
        state = readState(db) ?? fail()
      }
      if (state.phase !== 'backup_deleting') fail()
      const backupOrder = [
        ['backup_wal', 'backupWalUnlinked'],
        ['backup_shm', 'backupShmUnlinked'],
        ['backup_journal', 'backupJournalUnlinked'],
        ['backup_temp_sqlite', undefined],
        ['backup_temp_manifest', undefined],
        ['backup_sqlite', 'backupSqliteUnlinked'],
        ['backup_manifest', 'backupManifestUnlinked'],
      ] as const
      for (const [role, stage] of backupOrder) {
        unlinkRegistered(root, files.get(role) ?? fail(), true)
        if (stage !== undefined) failAfterStage?.(stage)
      }
      synchronize(root, 'backup')
      failAfterStage?.('backupDirectorySynced')
      finalizeBackupCatalogue(db, durableSelection.backupArtifactId, isoWeek(current))
      failAfterStage?.('complete')
      return Object.freeze({ status: 'complete' as const })
    } catch (error) {
      if (error instanceof StorageV3MigrationCleanupError) throw error
      return fail()
    } finally { if (db.open) db.close() }
  })
}

/** Runtime-owned clock and native directory sync; unsupported platforms refuse before unlink. */
export function cleanupExpiredStorageV3Migration(
  input: StorageV3MigrationCleanupInput,
): StorageV3MigrationCleanupResult {
  try {
    return runExpiredCleanup(
      input,
      () => new Date().toISOString(),
      (root) => syncStorageV3ArtifactDirectory(root),
      verifyStorageV3MigrationSelectionProof,
    )
  } catch (error) {
    if (error instanceof StorageV3MigrationCleanupError) throw error
    return fail()
  }
}

/** @internal Invented-fixture clock, sync and process-interruption seams. */
export const v3MigrationCleanupTestSeams = Object.freeze({
  cleanupAtWithDirectorySynchronizer(
    input: StorageV3MigrationCleanupInput,
    now: string,
    synchronize: DirectorySynchronizer,
    failAfterStage?: (stage: StorageV3MigrationCleanupStage) => void,
  ): StorageV3MigrationCleanupResult {
    if (typeof synchronize !== 'function'
      || (failAfterStage !== undefined && typeof failAfterStage !== 'function')) return fail()
    return runExpiredCleanup(
      input,
      () => now,
      synchronize,
      (root, installationKey) => v3SelectionProofTestSeams.verifyWithDirectorySynchronizer(
        root, installationKey, () => {},
      ),
      failAfterStage,
    )
  },
})
