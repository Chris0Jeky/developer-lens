import { createHash } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  ftruncateSync,
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
import {
  assertPublishedStorageV3ArtifactCatalogue,
  assertStorageV3ArtifactDirectorySyncSupported,
  assertStorageV3ArtifactCatalogue,
  assertStorageV3ArtifactRootInstallationKey,
  bindStorageV3MigrationBackupAttemptIdentity,
  beginStorageV3MigrationBackupArtifact,
  bindStorageV3ArtifactRoot,
  promoteStorageV3MigrationBackupArtifact,
  proveStorageV3MigrationBackupPublication,
  readStorageV3MigrationBackupAttempt,
  recordStorageV3MigrationBackupAttemptContentSha256,
  storageV3ArtifactFilePath,
  storageV3MigrationBackupIntentSha256,
  storageV3MigrationBackupManifest,
  storageV3MaintenanceStatus,
  syncStorageV3ArtifactDirectory,
  type StorageV3ArtifactRoot,
} from './v3ArtifactCatalogue.js'
import { withStorageV3WriterLease } from './v3WriterLease.js'
import {
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  STORAGE_V3_SHADOW_USER_VERSION,
  storageV3ShadowSchemaFingerprint,
} from './v3ShadowSchema.js'
import {
  bindTaskInstallationKeyBody,
  type TaskInstallationKeyHandle,
} from './taskInstallationKey.js'
import { isCanonicalTaskId } from '../taskId.js'

export const STORAGE_V3_BACKUP_ERROR = 'STORAGE_V3_BACKUP_INVALID' as const
const BACKUP_DOMAIN = 'developer-lens.storage-v3-backup-manifest.v1' as const
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'binary')
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0

export class StorageV3BackupError extends Error {
  readonly code = STORAGE_V3_BACKUP_ERROR
  constructor() { super(STORAGE_V3_BACKUP_ERROR); this.name = 'StorageV3BackupError' }
}
const fail = (): never => { throw new StorageV3BackupError() }

export type StorageV3BackupInput = Readonly<{
  db: Database.Database
  root: StorageV3ArtifactRoot
  backupAt: string
  artifactId: string
  ownerScopeIds: readonly string[]
  installationKey: TaskInstallationKeyHandle
  /** @internal invented-fixture failure injection only. */
  failAfterStage?: (stage: StorageV3BackupStage) => void
  /** @internal invented-fixture failure injection only. */
  failAtPhase?: (phase: StorageV3BackupPhase) => void
}>

export type StorageV3BackupPhase =
  | 'beforeSqliteBackup'
  | 'partialSqliteWrite'
  | 'sqliteSnapshotBeforeHash'
  | 'partialManifestWrite'
  | 'manifestBeforeFsync'

export const STORAGE_V3_BACKUP_STAGES = [
  'intentCommitted',
  'sqliteTempDurable',
  'manifestTempDurable',
  'sqliteFinalLinked',
  'manifestFinalLinked',
  'finalNamesDurable',
  'cataloguePromoted',
  'sqliteTempUnlinked',
  'manifestTempUnlinked',
] as const
export type StorageV3BackupStage = typeof STORAGE_V3_BACKUP_STAGES[number]

/** @internal invented-fixture process-fault phases; these are not durability claims. */
export type StorageV3BackupDirectorySyncPhase =
  | 'sqliteTempClaim'
  | 'manifestTempClaim'
  | 'finalNames'
  | 'sqliteTempRemoval'
  | 'manifestTempRemoval'

type StorageV3BackupDirectorySynchronizer = (
  root: StorageV3ArtifactRoot,
  phase: StorageV3BackupDirectorySyncPhase,
) => void

export type StorageV3BackupResult = Readonly<{
  artifactId: string
  locator: string
  manifestLocator: string
  contentSha256: string
  manifestSha256: string
}>

/** Caller-owned inputs for the read-only finalized-backup verifier. */
export type StorageV3MigrationBackupVerificationInput = Readonly<{
  db: Database.Database
  root: StorageV3ArtifactRoot
  backupAt: string
  artifactId: string
  installationKey: TaskInstallationKeyHandle
}>

/** Proof returned after every physical/catalogue/manifest/snapshot check passes. */
export type StorageV3MigrationBackupVerification = Readonly<{
  artifactId: string
  locator: string
  backupAt: string
  selectedArtifactId: string
  ownerScopeIds: readonly string[]
  contentSha256: string
  manifestSha256: string
}>

/** Caller-owned inputs for the restore-boundary verifier.  No live selected-store
 * connection is accepted: the finalized backup pair is the complete proof input. */
export type StorageV3MigrationBackupRestoreVerificationInput = Readonly<{
  root: StorageV3ArtifactRoot
  backupAt: string
  artifactId: string
  installationKey: TaskInstallationKeyHandle
}>

/** Content-free proof returned by the restore-boundary verifier. */
export type StorageV3MigrationBackupRestoreVerification = Readonly<{
  artifactId: string
  locator: string
  stagedLocator: string
  backupAt: string
  selectedArtifactId: string
  ownerScopeIds: readonly string[]
  intentSha256: string
  contentSha256: string
  manifestSha256: string
}>

interface BackupSnapshotIdentity {
  readonly selectedArtifactId: string
  readonly ownerScopeIds: readonly string[]
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function stat(path: string): BigIntStats | undefined {
  try { return lstatSync(path, { bigint: true }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    return fail()
  }
}

function sameIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino
}

function assertAbsent(path: string): void { if (stat(path) !== undefined) fail() }

function assertDescriptorPath(
  path: string,
  descriptor: number,
  expectedNlink: bigint,
  allowEmpty = false,
): BigIntStats {
  const before = stat(path)
  if (before === undefined) return fail()
  let canonical: string
  try { canonical = realpathSync.native(path) } catch { return fail() }
  const handle = fstatSync(descriptor, { bigint: true })
  const after = stat(path)
  if (after === undefined
    || !before.isFile() || before.isSymbolicLink()
    || !handle.isFile() || handle.isSymbolicLink()
    || !after.isFile() || after.isSymbolicLink()
    || before.nlink !== expectedNlink || handle.nlink !== expectedNlink || after.nlink !== expectedNlink
    || (!allowEmpty && handle.size === 0n)
    || before.size !== handle.size || handle.size !== after.size
    || !sameIdentity(before, handle) || !sameIdentity(handle, after)
    || canonical !== path) fail()
  return handle
}

function openBoundDescriptor(path: string, flags: number, expectedNlink: bigint, allowEmpty = false): number {
  let descriptor: number
  try { descriptor = openSync(path, flags | NO_FOLLOW) } catch { return fail() }
  try {
    assertDescriptorPath(path, descriptor, expectedNlink, allowEmpty)
    return descriptor
  } catch {
    closeSync(descriptor)
    return fail()
  }
}

function assertHardLinkToDescriptor(path: string, descriptor: number): void {
  const other = openBoundDescriptor(path, constants.O_RDONLY, 2n)
  try {
    const expected = fstatSync(descriptor, { bigint: true })
    const actual = fstatSync(other, { bigint: true })
    if (!sameIdentity(expected, actual) || expected.size !== actual.size || expected.nlink !== 2n) fail()
  } finally { closeSync(other) }
}

function hashSqliteDescriptor(descriptor: number): string {
  const before = fstatSync(descriptor, { bigint: true })
  if (!before.isFile() || before.size < BigInt(SQLITE_HEADER.length)) fail()
  const header = Buffer.alloc(SQLITE_HEADER.length)
  if (readSync(descriptor, header, 0, header.length, 0) !== header.length || !header.equals(SQLITE_HEADER)) fail()
  const hash = createHash('sha256')
  const bytes = Buffer.alloc(64 * 1024)
  let position = 0
  for (;;) {
    const count = readSync(descriptor, bytes, 0, bytes.length, position)
    if (count === 0) break
    hash.update(bytes.subarray(0, count))
    position += count
  }
  const after = fstatSync(descriptor, { bigint: true })
  if (!sameIdentity(before, after) || before.size !== after.size || before.nlink !== after.nlink) fail()
  return hash.digest('hex')
}

function readDescriptorExactly(descriptor: number, expectedLength: number): Buffer {
  if (!Number.isSafeInteger(expectedLength) || expectedLength < 1 || expectedLength > 1024 * 1024) fail()
  const bytes = Buffer.alloc(expectedLength)
  let offset = 0
  while (offset < bytes.length) {
    const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset)
    if (count === 0) fail()
    offset += count
  }
  const overflow = Buffer.alloc(1)
  if (readSync(descriptor, overflow, 0, 1, expectedLength) !== 0) fail()
  return bytes
}

function sameStrings(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index])
}

function catalogueOwners(db: Database.Database, artifactId: string): string[] {
  return db.prepare(
    'SELECT scope_id FROM app_artifact_scope WHERE artifact_id = ? ORDER BY scope_id',
  ).pluck().all(artifactId) as string[]
}

function liveOwners(db: Database.Database): string[] {
  return db.prepare('SELECT scope_id FROM claim_scope ORDER BY scope_id').pluck().all() as string[]
}

function assertOwners(actual: readonly string[], expected: readonly string[]): void {
  if (!sameStrings(actual, expected)) fail()
}

function validateAt(value: string): void {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) fail()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value.replace('Z', '.000Z')) fail()
}

function assertInput(input: StorageV3BackupInput): void {
  if (!input || typeof input !== 'object' || !input.db?.open || input.db.inTransaction) fail()
  validateAt(input.backupAt)
  if (!/^art-[0-9a-f]{64}$/.test(input.artifactId)) fail()
  if (!input.installationKey || typeof input.installationKey !== 'object'
    || !isCanonicalTaskId(input.installationKey.taskId)
    || !/^[a-f0-9]{64}$/.test(input.installationKey.fingerprint)) fail()
  const scopes = input.ownerScopeIds
  if (!Array.isArray(scopes) || scopes.length === 0
    || scopes.some((value, index) => typeof value !== 'string'
      || value !== [...scopes].sort()[index]
      || !/^scope-[0-9a-f]{64}$/.test(value))) fail()
  bindTaskInstallationKeyBody(input.installationKey, sha256(`${BACKUP_DOMAIN}\0closed-input`))
}

function attemptContext(input: StorageV3BackupInput, locator: string) {
  return {
    db: input.db,
    artifactId: input.artifactId,
    finalLocator: locator,
    installationKey: input.installationKey,
  } as const
}

function assertRecordedIdentity(
  path: string,
  descriptor: number,
  expectedNlink: bigint,
  dev: string | null,
  ino: string | null,
): void {
  if (dev === null || ino === null) fail()
  const stats = assertDescriptorPath(path, descriptor, expectedNlink, true)
  if (stats.dev.toString(10) !== dev || stats.ino.toString(10) !== ino) fail()
}

function isStrictSqlitePrefix(descriptor: number): boolean {
  const size = fstatSync(descriptor, { bigint: true }).size
  if (size === 0n || size > BigInt(SQLITE_HEADER.length)) return false
  const prefix = Buffer.alloc(Number(size))
  return readSync(descriptor, prefix, 0, prefix.length, 0) === prefix.length
    && SQLITE_HEADER.subarray(0, prefix.length).equals(prefix)
}

function isIncoherentSqlitePartial(path: string, descriptor: number, expectedNlink: bigint): boolean {
  const size = fstatSync(descriptor, { bigint: true }).size
  if (size === 0n || isStrictSqlitePrefix(descriptor)) return true
  if (size < BigInt(SQLITE_HEADER.length)) return false
  const header = Buffer.alloc(SQLITE_HEADER.length)
  if (readSync(descriptor, header, 0, header.length, 0) !== header.length || !header.equals(SQLITE_HEADER)) return false
  // SQLite's 100-byte database header is mandatory even for an otherwise
  // empty database. A file that stops inside it is a header-valid partial.
  if (size < 100n) return true
  // A valid SQLite image with any schema is coherent and must not be
  // refreshed merely because it is the wrong application schema. Conversely,
  // a header-valid image that fails SQLite's own readonly integrity check is a
  // recoverable pre-durable partial. Reprove the bound descriptor/path around
  // the check so a concurrent replacement cannot turn this into an unlink or
  // truncate of foreign bytes.
  assertDescriptorPath(path, descriptor, expectedNlink, true)
  let candidate: Database.Database | undefined
  try {
    candidate = new Database(path, { fileMustExist: true, readonly: true })
    const coherent = String(candidate.pragma('integrity_check', { simple: true })) === 'ok'
    if (candidate.open) candidate.close()
    candidate = undefined
    assertDescriptorPath(path, descriptor, expectedNlink, true)
    return !coherent
  } catch (error) {
    if (candidate?.open) candidate.close()
    assertDescriptorPath(path, descriptor, expectedNlink, true)
    if (error instanceof StorageV3BackupError) throw error
    return true
  }
}

function truncateForRetry(path: string, descriptor: number, expectedNlink: bigint): void {
  ftruncateSync(descriptor, 0)
  fsyncSync(descriptor)
  assertDescriptorPath(path, descriptor, expectedNlink, true)
}

function manifestIsExactOrPrefix(descriptor: number, expected: Buffer): 'exact' | 'prefix' | 'invalid' {
  const size = fstatSync(descriptor, { bigint: true }).size
  if (size > BigInt(expected.length)) return 'invalid'
  if (size === 0n) return 'prefix'
  const bytes = Buffer.alloc(Number(size))
  if (readSync(descriptor, bytes, 0, bytes.length, 0) !== bytes.length) return 'invalid'
  if (!expected.subarray(0, bytes.length).equals(bytes)) return 'invalid'
  return size === BigInt(expected.length) ? 'exact' : 'prefix'
}

function writeManifestAtZero(
  path: string,
  descriptor: number,
  expectedNlink: bigint,
  bytes: Buffer,
  beforeFsync?: () => void,
): void {
  ftruncateSync(descriptor, 0)
  if (writeSync(descriptor, bytes, 0, bytes.length, 0) !== bytes.length) fail()
  beforeFsync?.()
  fsyncSync(descriptor)
  assertDescriptorPath(path, descriptor, expectedNlink)
  if (!readDescriptorExactly(descriptor, bytes.length).equals(bytes)) fail()
}

function captureInput(input: unknown, allowHooks: boolean, retainHooks = allowHooks): StorageV3BackupInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype) fail()
  const objectInput = input as object
  const expected = ['db', 'root', 'backupAt', 'artifactId', 'ownerScopeIds', 'installationKey']
  const optional = allowHooks ? ['failAfterStage', 'failAtPhase'] : []
  const keys = Reflect.ownKeys(objectInput)
  if (keys.some((key) => typeof key !== 'string' || (!expected.includes(key) && !optional.includes(key)))) fail()
  if (expected.some((key) => !keys.includes(key))) fail()
  if (keys.some((key) => !expected.includes(String(key)) && optional.includes(String(key)))
    && !allowHooks) fail()
  if (keys.length < expected.length || keys.length > expected.length + optional.length) fail()
  const value = (key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(objectInput, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail()
    return (descriptor as PropertyDescriptor & { value: unknown }).value
  }
  const closedRecord: Record<string, unknown> = {
    db: value('db'), root: value('root'), backupAt: value('backupAt'), artifactId: value('artifactId'),
    ownerScopeIds: Object.freeze([...(value('ownerScopeIds') as readonly string[])]),
    installationKey: value('installationKey'),
  }
  if (retainHooks) for (const key of optional) if (keys.includes(key)) closedRecord[key] = value(key)
  const closed = Object.freeze(closedRecord) as StorageV3BackupInput
  assertInput(closed)
  return closed
}

function captureVerificationInput(input: unknown): StorageV3MigrationBackupVerificationInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype) fail()
  const objectInput = input as object
  const expected = ['db', 'root', 'backupAt', 'artifactId', 'installationKey']
  const keys = Reflect.ownKeys(objectInput)
  if (keys.length !== expected.length
    || keys.some((key) => typeof key !== 'string' || !expected.includes(key))) fail()
  const value = (key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(objectInput, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail()
    return (descriptor as PropertyDescriptor & { value: unknown }).value
  }
  const closed = Object.freeze({
    db: value('db'),
    root: value('root'),
    backupAt: value('backupAt'),
    artifactId: value('artifactId'),
    installationKey: value('installationKey'),
  }) as StorageV3MigrationBackupVerificationInput
  if (!closed.db?.open || closed.db.inTransaction
    || typeof closed.root !== 'object' || closed.root === null
    || typeof closed.backupAt !== 'string'
    || typeof closed.artifactId !== 'string'
    || !closed.installationKey || typeof closed.installationKey !== 'object'
    || !isCanonicalTaskId(closed.installationKey.taskId)
    || !/^[a-f0-9]{64}$/.test(closed.installationKey.fingerprint)) fail()
  validateAt(closed.backupAt)
  if (!/^art-[0-9a-f]{64}$/.test(closed.artifactId)) fail()
  // This binds continuity without exposing key bytes or making the verifier an HMAC oracle.
  bindTaskInstallationKeyBody(closed.installationKey, sha256(`${BACKUP_DOMAIN}\0closed-verifier-input`))
  return closed
}

function captureRestoreVerificationInput(input: unknown): StorageV3MigrationBackupRestoreVerificationInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype) fail()
  const objectInput = input as object
  const expected = ['root', 'backupAt', 'artifactId', 'installationKey']
  const keys = Reflect.ownKeys(objectInput)
  if (keys.length !== expected.length
    || keys.some((key) => typeof key !== 'string' || !expected.includes(key))) fail()
  const value = (key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(objectInput, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail()
    return (descriptor as PropertyDescriptor & { value: unknown }).value
  }
  const closed = Object.freeze({
    root: value('root'),
    backupAt: value('backupAt'),
    artifactId: value('artifactId'),
    installationKey: value('installationKey'),
  }) as StorageV3MigrationBackupRestoreVerificationInput
  if (!closed.root || typeof closed.root !== 'object'
    || !closed.installationKey || typeof closed.installationKey !== 'object'
    || !isCanonicalTaskId(closed.installationKey.taskId)
    || !/^[a-f0-9]{64}$/.test(closed.installationKey.fingerprint)) fail()
  validateAt(closed.backupAt)
  if (!/^art-[0-9a-f]{64}$/.test(closed.artifactId)) fail()
  // Bind continuity before any filesystem or SQLite reads.  This is a proof of
  // possession, not a general HMAC oracle.
  bindTaskInstallationKeyBody(closed.installationKey, sha256(`${BACKUP_DOMAIN}\0restore-verifier-input`))
  return closed
}

function sidecarsAbsent(path: string): void {
  for (const suffix of ['-wal', '-shm', '-journal']) if (stat(`${path}${suffix}`)) fail()
}

function makeManifest(
  input: StorageV3BackupInput,
  locator: string,
  contentSha256: string,
  selectedArtifactId: string,
): { bytes: Buffer; bodySha256: string } {
  return storageV3MigrationBackupManifest({
    locator,
    backupAt: input.backupAt,
    artifactId: input.artifactId,
    selectedArtifactId,
    contentSha256,
    ownerScopeIds: input.ownerScopeIds,
    installationKey: input.installationKey,
  })
}

function inspectBackupDb(
  path: string,
  descriptor: number,
  expectedNlink: bigint,
): BackupSnapshotIdentity {
  assertDescriptorPath(path, descriptor, expectedNlink)
  let backup: Database.Database | undefined
  try {
    backup = new Database(path, { fileMustExist: true, readonly: true })
    backup.pragma('foreign_keys = ON')
    if (Number(backup.pragma('application_id', { simple: true })) !== STORAGE_V3_SHADOW_APPLICATION_ID
      || Number(backup.pragma('user_version', { simple: true })) !== STORAGE_V3_SHADOW_USER_VERSION
      || storageV3ShadowSchemaFingerprint(backup) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT
      || String(backup.pragma('integrity_check', { simple: true })) !== 'ok'
      || (backup.pragma('foreign_key_check') as unknown[]).length !== 0) fail()
    const selected = backup.prepare(
      "SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store' AND state = 'active'",
    ).all() as Array<{ artifact_id: string }>
    if (selected.length !== 1 || !/^art-[0-9a-f]{64}$/.test(selected[0]?.artifact_id ?? '')) fail()
    const ownerScopeIds = liveOwners(backup)
    if (ownerScopeIds.length === 0) fail()
    return Object.freeze({ selectedArtifactId: selected[0]!.artifact_id, ownerScopeIds: Object.freeze(ownerScopeIds) })
  } catch (error) {
    if (error instanceof StorageV3BackupError) throw error
    return fail()
  } finally {
    if (backup?.open) backup.close()
    assertDescriptorPath(path, descriptor, expectedNlink)
  }
}

interface RestoreBackupSnapshotIdentity extends BackupSnapshotIdentity {
  readonly backupAttemptSqliteDev: string
  readonly backupAttemptSqliteIno: string
}

function canonicalAttemptIdentity(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,19})$/.test(value)) fail()
  return value as string
}

/**
 * Inspect the pre-selection image captured by the SQLite backup API.  The image
 * deliberately retains the staged, self-referential backup catalogue row and its
 * one attempt row; restore must validate that shape, never normalize it.
 */
function inspectRestoreBackupDb(
  path: string,
  descriptor: number,
  expectedNlink: bigint,
  artifactId: string,
  finalLocator: string,
  installationKey: TaskInstallationKeyHandle,
): RestoreBackupSnapshotIdentity {
  assertDescriptorPath(path, descriptor, expectedNlink)
  let backup: Database.Database | undefined
  try {
    backup = new Database(path, { fileMustExist: true, readonly: true })
    backup.pragma('foreign_keys = ON')
    if (Number(backup.pragma('application_id', { simple: true })) !== STORAGE_V3_SHADOW_APPLICATION_ID
      || Number(backup.pragma('user_version', { simple: true })) !== STORAGE_V3_SHADOW_USER_VERSION
      || storageV3ShadowSchemaFingerprint(backup) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT
      || String(backup.pragma('integrity_check', { simple: true })) !== 'ok'
      || (backup.pragma('foreign_key_check') as unknown[]).length !== 0) fail()

    const maintenance = backup.prepare(
      'SELECT state, operation_id, scope_id, event_week FROM storage_maintenance_state',
    ).all() as Array<{ state: string; operation_id: string | null; scope_id: string | null; event_week: string | null }>
    if (maintenance.length > 1 || (maintenance.length === 1
      && (maintenance[0]?.state !== 'complete'
        || maintenance[0].operation_id !== null || maintenance[0].scope_id !== null
        || maintenance[0].event_week !== null))) fail()

    const selection = backup.prepare('SELECT 1 FROM migration_selection_state').all()
    if (selection.length !== 0) fail()
    if (backup.prepare("SELECT 1 FROM app_artifact WHERE state <> 'active' LIMIT 1").get() !== undefined) fail()

    const selected = backup.prepare(
      `SELECT artifact_id, kind, state, relative_locator,
              deletion_operation_id, deletion_scope_id, deletion_week
       FROM app_artifact WHERE kind = 'selected_store'`,
    ).all() as Array<{
      artifact_id: string; kind: string; state: string; relative_locator: string
      deletion_operation_id: string | null; deletion_scope_id: string | null; deletion_week: string | null
    }>
    if (selected.length !== 1 || selected[0]?.kind !== 'selected_store'
      || selected[0].state !== 'active' || selected[0].relative_locator !== 'v3-store.sqlite'
      || selected[0].deletion_operation_id !== null || selected[0].deletion_scope_id !== null
      || selected[0].deletion_week !== null || !/^art-[0-9a-f]{64}$/.test(selected[0].artifact_id)) fail()
    const selectedArtifactId = selected[0].artifact_id

    const ownerScopeIds = backup.prepare('SELECT scope_id FROM claim_scope ORDER BY scope_id').pluck().all() as string[]
    if (ownerScopeIds.length === 0
      || ownerScopeIds.some((scope, index) => !/^scope-[0-9a-f]{64}$/.test(scope)
        || scope !== [...ownerScopeIds].sort()[index])) fail()
    assertOwners(
      backup.prepare('SELECT scope_id FROM app_artifact_scope WHERE artifact_id = ? ORDER BY scope_id')
        .pluck().all(selectedArtifactId) as string[],
      ownerScopeIds,
    )

    const backups = backup.prepare(
      `SELECT artifact_id, kind, state, manifest_sha256, content_sha256,
              relative_locator, deletion_operation_id, deletion_scope_id, deletion_week
       FROM app_artifact WHERE kind = 'migration_backup_v1'`,
    ).all() as Array<{
      artifact_id: string; kind: string; state: string; manifest_sha256: string; content_sha256: string
      relative_locator: string; deletion_operation_id: string | null; deletion_scope_id: string | null
      deletion_week: string | null
    }>
    if (backups.length !== 1) fail()
    const staged = backups[0]!
    const stagedLocator = `${finalLocator}.tmp`
    const intentSha256 = storageV3MigrationBackupIntentSha256(
      artifactId, finalLocator, installationKey.fingerprint,
    )
    if (staged.artifact_id !== artifactId || staged.kind !== 'migration_backup_v1'
      || staged.state !== 'active' || staged.relative_locator !== stagedLocator
      || staged.content_sha256 !== intentSha256 || staged.manifest_sha256 !== intentSha256
      || staged.deletion_operation_id !== null || staged.deletion_scope_id !== null
      || staged.deletion_week !== null) fail()
    assertOwners(
      backup.prepare('SELECT scope_id FROM app_artifact_scope WHERE artifact_id = ? ORDER BY scope_id')
        .pluck().all(artifactId) as string[],
      ownerScopeIds,
    )

    const attempts = backup.prepare(
      `SELECT artifact_id, sqlite_dev, sqlite_ino, manifest_dev, manifest_ino,
              sqlite_content_sha256 FROM migration_backup_attempt`,
    ).all() as Array<{
      artifact_id: string; sqlite_dev: string | null; sqlite_ino: string | null
      manifest_dev: string | null; manifest_ino: string | null; sqlite_content_sha256: string | null
    }>
    if (attempts.length !== 1) fail()
    const attempt = attempts[0]!
    if (attempt.artifact_id !== artifactId || attempt.sqlite_dev === null || attempt.sqlite_ino === null
      || attempt.manifest_dev !== null || attempt.manifest_ino !== null
      || attempt.sqlite_content_sha256 !== null) fail()
    const backupAttemptSqliteDev = canonicalAttemptIdentity(attempt.sqlite_dev)
    const backupAttemptSqliteIno = canonicalAttemptIdentity(attempt.sqlite_ino)

    return Object.freeze({
      selectedArtifactId,
      ownerScopeIds: Object.freeze(ownerScopeIds),
      backupAttemptSqliteDev,
      backupAttemptSqliteIno,
    })
  } catch (error) {
    if (error instanceof StorageV3BackupError) throw error
    return fail()
  } finally {
    if (backup?.open) backup.close()
    assertDescriptorPath(path, descriptor, expectedNlink)
  }
}

function openExactManifest(
  path: string,
  expected: Buffer,
  expectedNlink: bigint,
): number {
  const descriptor = openBoundDescriptor(path, constants.O_RDONLY, expectedNlink)
  try {
    const stats = assertDescriptorPath(path, descriptor, expectedNlink)
    if (stats.size !== BigInt(expected.length)
      || !readDescriptorExactly(descriptor, expected.length).equals(expected)) fail()
    assertDescriptorPath(path, descriptor, expectedNlink)
    return descriptor
  } catch {
    closeSync(descriptor)
    return fail()
  }
}

/**
 * Verify one already-finalized singleton backup without taking a lease or mutating state.
 *
 * The caller supplies only the opaque task identity and backup timestamp.  The selected
 * artifact and owner set are read from the open store, and every returned field is derived
 * from the exact catalogue row and physically re-proven files.
 */
export function verifyStorageV3MigrationBackup(
  input: StorageV3MigrationBackupVerificationInput,
): StorageV3MigrationBackupVerification {
  let sqliteDescriptor: number | undefined
  let manifestDescriptor: number | undefined
  try {
    const closed = captureVerificationInput(input)
    const locator = `migration-backup-${closed.backupAt.replace(/[-:]/g, '')}.sqlite`
    const stagedLocator = `${locator}.tmp`
    const manifestLocator = `${locator}.manifest.json`
    const tempLocator = stagedLocator
    const manifestTempLocator = `${tempLocator}.manifest.json`
    const source = storageV3ArtifactFilePath(closed.root, 'v3-store.sqlite')
    if (typeof closed.db.name !== 'string' || closed.db.name !== source) fail()
    assertStorageV3ArtifactRootInstallationKey(closed.root, closed.installationKey)
    sidecarsAbsent(source)
    // A finalized backup cannot coexist with an open/expired migration or any catalogue
    // state other than the immutable active selected store and one active final backup.
    if (storageV3MaintenanceStatus(closed.db) !== 'complete') fail()
    assertPublishedStorageV3ArtifactCatalogue(closed.db)
    const selected = closed.db.prepare(
      `SELECT artifact_id, state, relative_locator
       FROM app_artifact WHERE kind = 'selected_store'`,
    ).all() as Array<{ artifact_id: string; state: string; relative_locator: string }>
    if (selected.length !== 1 || selected[0]?.state !== 'active'
      || selected[0].relative_locator !== 'v3-store.sqlite') fail()
    const selectedArtifactId = selected[0]!.artifact_id
    const liveOwnerScopeIds = liveOwners(closed.db)
    if (liveOwnerScopeIds.length === 0) fail()
    assertOwners(catalogueOwners(closed.db, selectedArtifactId), liveOwnerScopeIds)

    const backups = closed.db.prepare(
      `SELECT artifact_id, kind, state, manifest_sha256, content_sha256,
              relative_locator, deletion_operation_id, deletion_scope_id, deletion_week
       FROM app_artifact WHERE kind = 'migration_backup_v1'`,
    ).all() as Array<{
      artifact_id: string; kind: string; state: string; manifest_sha256: string; content_sha256: string
      relative_locator: string; deletion_operation_id: string | null; deletion_scope_id: string | null
      deletion_week: string | null
    }>
    if (backups.length !== 1) fail()
    const row = backups[0]!
    if (row.artifact_id !== closed.artifactId || row.kind !== 'migration_backup_v1'
      || row.state !== 'active' || row.relative_locator !== locator
      || row.relative_locator.endsWith('.sqlite.tmp')
      || row.deletion_operation_id !== null || row.deletion_scope_id !== null || row.deletion_week !== null) fail()
    assertOwners(catalogueOwners(closed.db, row.artifact_id), liveOwnerScopeIds)

    const finalPath = storageV3ArtifactFilePath(closed.root, locator)
    const manifestPath = storageV3ArtifactFilePath(closed.root, manifestLocator)
    const tempPath = storageV3ArtifactFilePath(closed.root, tempLocator)
    const manifestTempPath = storageV3ArtifactFilePath(closed.root, manifestTempLocator)
    // Published cleanup is part of the finalized state.  Refuse orphaned provisional names
    // instead of silently selecting through a staged or foreign pair.
    sidecarsAbsent(tempPath)
    assertAbsent(tempPath)
    assertAbsent(manifestTempPath)
    sidecarsAbsent(finalPath)

    sqliteDescriptor = openBoundDescriptor(finalPath, constants.O_RDONLY, 1n)
    const contentSha256 = hashSqliteDescriptor(sqliteDescriptor)
    if (row.content_sha256 !== contentSha256) fail()
    const snapshot = inspectBackupDb(finalPath, sqliteDescriptor, 1n)
    if (snapshot.selectedArtifactId !== selectedArtifactId) fail()
    assertOwners(snapshot.ownerScopeIds, liveOwnerScopeIds)

    const expectedManifest = storageV3MigrationBackupManifest({
      locator,
      backupAt: closed.backupAt,
      artifactId: closed.artifactId,
      selectedArtifactId,
      contentSha256,
      ownerScopeIds: liveOwnerScopeIds,
      installationKey: closed.installationKey,
    })
    const manifestSha256 = sha256(expectedManifest.bytes)
    if (row.manifest_sha256 !== manifestSha256) fail()
    manifestDescriptor = openExactManifest(manifestPath, expectedManifest.bytes, 1n)
    return Object.freeze({
      artifactId: closed.artifactId,
      locator,
      backupAt: closed.backupAt,
      selectedArtifactId,
      ownerScopeIds: Object.freeze([...liveOwnerScopeIds]),
      contentSha256,
      manifestSha256,
    })
  } catch (error) {
    if (error instanceof StorageV3BackupError) throw error
    return fail()
  } finally {
    if (manifestDescriptor !== undefined) closeSync(manifestDescriptor)
    if (sqliteDescriptor !== undefined) closeSync(sqliteDescriptor)
  }
}

/**
 * Verify one finalized backup pair for restore without opening the live selected
 * store or reading its catalogue.  The backup image itself is the catalogue
 * authority at this boundary and must still contain the reviewed pre-selection
 * staged intent/attempt shape.
 */
export function verifyStorageV3MigrationBackupForRestore(
  input: StorageV3MigrationBackupRestoreVerificationInput,
): StorageV3MigrationBackupRestoreVerification {
  let sqliteDescriptor: number | undefined
  let manifestDescriptor: number | undefined
  try {
    const closed = captureRestoreVerificationInput(input)
    const locator = `migration-backup-${closed.backupAt.replace(/[-:]/g, '')}.sqlite`
    const stagedLocator = `${locator}.tmp`
    const manifestLocator = `${locator}.manifest.json`
    const tempLocator = stagedLocator
    const manifestTempLocator = `${tempLocator}.manifest.json`
    assertStorageV3ArtifactRootInstallationKey(closed.root, closed.installationKey)

    const finalPath = storageV3ArtifactFilePath(closed.root, locator)
    const manifestPath = storageV3ArtifactFilePath(closed.root, manifestLocator)
    const tempPath = storageV3ArtifactFilePath(closed.root, tempLocator)
    const manifestTempPath = storageV3ArtifactFilePath(closed.root, manifestTempLocator)
    // Publication is a closed pair: no provisional names or SQLite family
    // sidecars may remain in the task-key-bound root.
    sidecarsAbsent(finalPath)
    sidecarsAbsent(manifestPath)
    sidecarsAbsent(tempPath)
    sidecarsAbsent(manifestTempPath)
    assertAbsent(tempPath)
    assertAbsent(manifestTempPath)

    sqliteDescriptor = openBoundDescriptor(finalPath, constants.O_RDONLY, 1n)
    const contentSha256 = hashSqliteDescriptor(sqliteDescriptor)
    const snapshot = inspectRestoreBackupDb(
      finalPath,
      sqliteDescriptor,
      1n,
      closed.artifactId,
      locator,
      closed.installationKey,
    )
    const expectedManifest = storageV3MigrationBackupManifest({
      locator,
      backupAt: closed.backupAt,
      artifactId: closed.artifactId,
      selectedArtifactId: snapshot.selectedArtifactId,
      contentSha256,
      ownerScopeIds: snapshot.ownerScopeIds,
      installationKey: closed.installationKey,
    })
    const manifestSha256 = sha256(expectedManifest.bytes)
    manifestDescriptor = openExactManifest(manifestPath, expectedManifest.bytes, 1n)
    return Object.freeze({
      artifactId: closed.artifactId,
      locator,
      stagedLocator,
      backupAt: closed.backupAt,
      selectedArtifactId: snapshot.selectedArtifactId,
      ownerScopeIds: Object.freeze([...snapshot.ownerScopeIds]),
      intentSha256: storageV3MigrationBackupIntentSha256(
        closed.artifactId,
        locator,
        closed.installationKey.fingerprint,
      ),
      contentSha256,
      manifestSha256,
    })
  } catch (error) {
    if (error instanceof StorageV3BackupError) throw error
    return fail()
  } finally {
    if (manifestDescriptor !== undefined) closeSync(manifestDescriptor)
    if (sqliteDescriptor !== undefined) closeSync(sqliteDescriptor)
  }
}

function cleanupPublishedTemp(
  root: StorageV3ArtifactRoot,
  tempPath: string,
  finalPath: string,
  finalDescriptor: number,
  phase: StorageV3BackupDirectorySyncPhase,
  syncDirectory: StorageV3BackupDirectorySynchronizer,
): void {
  if (stat(tempPath) === undefined) {
    assertDescriptorPath(finalPath, finalDescriptor, 1n)
    syncDirectory(root, phase)
    assertAbsent(tempPath)
    assertDescriptorPath(finalPath, finalDescriptor, 1n)
    return
  }
  assertDescriptorPath(finalPath, finalDescriptor, 2n)
  assertHardLinkToDescriptor(tempPath, finalDescriptor)
  unlinkSync(tempPath)
  assertDescriptorPath(finalPath, finalDescriptor, 1n)
  syncDirectory(root, phase)
  assertAbsent(tempPath)
  assertDescriptorPath(finalPath, finalDescriptor, 1n)
}

function replayIfExact(
  input: StorageV3BackupInput,
  locator: string,
  manifestLocator: string,
  syncDirectory: StorageV3BackupDirectorySynchronizer,
): StorageV3BackupResult | undefined {
  const tempLocator = `${locator}.tmp`
  const manifestTempLocator = `${tempLocator}.manifest.json`
  const finalPath = storageV3ArtifactFilePath(input.root, locator)
  const manifestPath = storageV3ArtifactFilePath(input.root, manifestLocator)
  const tempPath = storageV3ArtifactFilePath(input.root, tempLocator)
  const manifestTempPath = storageV3ArtifactFilePath(input.root, manifestTempLocator)
  const staged = input.db.prepare(
    "SELECT 1 FROM app_artifact WHERE artifact_id = ? AND kind = 'migration_backup_v1' AND relative_locator = ? AND state = 'active'",
  ).get(input.artifactId, tempLocator)
  if (staged) return undefined
  const row = input.db.prepare(
    'SELECT kind, state, content_sha256, manifest_sha256 FROM app_artifact WHERE artifact_id = ? AND relative_locator = ?',
  ).get(input.artifactId, locator) as Record<string, unknown> | undefined
  const finalEntry = stat(finalPath)
  const manifestEntry = stat(manifestPath)
  if (row === undefined) {
    if (finalEntry !== undefined || manifestEntry !== undefined
      || stat(tempPath) !== undefined || stat(manifestTempPath) !== undefined) fail()
    return undefined
  }
  if (finalEntry === undefined || manifestEntry === undefined
    || row.kind !== 'migration_backup_v1' || row.state !== 'active') fail()
  sidecarsAbsent(finalPath)
  if (stat(tempPath) !== undefined) sidecarsAbsent(tempPath)
  assertOwners(catalogueOwners(input.db, input.artifactId), input.ownerScopeIds)
  const sqliteNlink = stat(tempPath) === undefined ? 1n : 2n
  const manifestNlink = stat(manifestTempPath) === undefined ? 1n : 2n
  const finalDescriptor = openBoundDescriptor(finalPath, constants.O_RDONLY, sqliteNlink)
  let manifestDescriptor: number | undefined
  try {
    if (sqliteNlink === 2n) assertHardLinkToDescriptor(tempPath, finalDescriptor)
    const contentSha256 = hashSqliteDescriptor(finalDescriptor)
    const snapshot = inspectBackupDb(finalPath, finalDescriptor, sqliteNlink)
    assertOwners(snapshot.ownerScopeIds, input.ownerScopeIds)
    const expectedManifest = makeManifest(input, locator, contentSha256, snapshot.selectedArtifactId)
    manifestDescriptor = openExactManifest(manifestPath, expectedManifest.bytes, manifestNlink)
    if (manifestNlink === 2n) assertHardLinkToDescriptor(manifestTempPath, manifestDescriptor)
    const manifestSha256 = sha256(expectedManifest.bytes)
    if (row.content_sha256 !== contentSha256 || row.manifest_sha256 !== manifestSha256) fail()
    cleanupPublishedTemp(
      input.root,
      tempPath,
      finalPath,
      finalDescriptor,
      'sqliteTempRemoval',
      syncDirectory,
    )
    cleanupPublishedTemp(
      input.root,
      manifestTempPath,
      manifestPath,
      manifestDescriptor,
      'manifestTempRemoval',
      syncDirectory,
    )
    return Object.freeze({ artifactId: input.artifactId, locator, manifestLocator, contentSha256, manifestSha256 })
  } finally {
    if (manifestDescriptor !== undefined) closeSync(manifestDescriptor)
    closeSync(finalDescriptor)
  }
}

function attempt(
  input: StorageV3BackupInput,
  syncDirectory: StorageV3BackupDirectorySynchronizer,
): StorageV3BackupResult | Promise<StorageV3BackupResult> {
  assertInput(input)
  bindStorageV3ArtifactRoot(input.db, input.root)
  assertStorageV3ArtifactRootInstallationKey(input.root, input.installationKey)
  const source = storageV3ArtifactFilePath(input.root, 'v3-store.sqlite')
  if (typeof input.db.name !== 'string' || input.db.name !== source) fail()
  sidecarsAbsent(source)
  const locator = `migration-backup-${input.backupAt.replace(/[-:]/g, '')}.sqlite`
  const manifestLocator = `${locator}.manifest.json`
  const tempLocator = `${locator}.tmp`
  const manifestTempLocator = `${tempLocator}.manifest.json`
  const replay = replayIfExact(input, locator, manifestLocator, syncDirectory)
  if (replay) return replay

  const stagedRow = input.db.prepare(
    "SELECT artifact_id, content_sha256, manifest_sha256 FROM app_artifact WHERE kind = 'migration_backup_v1' AND relative_locator = ? AND state = 'active'",
  ).get(tempLocator) as { artifact_id: string; content_sha256: string; manifest_sha256: string } | undefined
  if (stagedRow) {
    assertStorageV3ArtifactCatalogue(input.db)
    const intentSha256 = storageV3MigrationBackupIntentSha256(
      input.artifactId,
      locator,
      input.installationKey.fingerprint,
    )
    if (stagedRow.artifact_id !== input.artifactId
      || stagedRow.content_sha256 !== intentSha256
      || stagedRow.manifest_sha256 !== intentSha256) fail()
    assertOwners(catalogueOwners(input.db, input.artifactId), input.ownerScopeIds)
  } else {
    assertPublishedStorageV3ArtifactCatalogue(input.db)
    assertOwners(liveOwners(input.db), input.ownerScopeIds)
  }

  const tempPath = storageV3ArtifactFilePath(input.root, tempLocator)
  const finalPath = storageV3ArtifactFilePath(input.root, locator)
  const manifestTempPath = storageV3ArtifactFilePath(input.root, manifestTempLocator)
  const manifestPath = storageV3ArtifactFilePath(input.root, manifestLocator)
  if (!stagedRow) {
    for (const path of [tempPath, finalPath, manifestTempPath, manifestPath]) assertAbsent(path)
    beginStorageV3MigrationBackupArtifact({
      db: input.db,
      artifactId: input.artifactId,
      finalLocator: locator,
      scopeIds: input.ownerScopeIds,
      installationKey: input.installationKey,
    })
    input.failAfterStage?.('intentCommitted')
  }

  // From this point on every retry reads the attempt through its key-bound
  // catalogue context. A present provisional name without a recorded identity
  // is never treated as application-owned.
  let attemptState = readStorageV3MigrationBackupAttempt(attemptContext(input, locator))

  const run = async (): Promise<StorageV3BackupResult> => {
    let sqliteDescriptor: number | undefined
    let manifestDescriptor: number | undefined
    try {
      const existingTemp = stat(tempPath)
      const existingFinal = stat(finalPath)
      if (existingTemp === undefined) {
        if (existingFinal !== undefined || stat(manifestTempPath) !== undefined || stat(manifestPath) !== undefined) fail()
        assertOwners(liveOwners(input.db), input.ownerScopeIds)
        try {
          sqliteDescriptor = openSync(
            tempPath,
            constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | NO_FOLLOW,
            0o600,
          )
        } catch { return fail() }
        assertDescriptorPath(tempPath, sqliteDescriptor, 1n, true)
        fsyncSync(sqliteDescriptor)
        syncDirectory(input.root, 'sqliteTempClaim')
        assertDescriptorPath(tempPath, sqliteDescriptor, 1n, true)
        const claimed = fstatSync(sqliteDescriptor, { bigint: true })
        attemptState = bindStorageV3MigrationBackupAttemptIdentity({
          ...attemptContext(input, locator), file: 'sqlite', dev: claimed.dev, ino: claimed.ino,
        })
        assertRecordedIdentity(tempPath, sqliteDescriptor, 1n, attemptState.sqliteDev, attemptState.sqliteIno)
        input.failAtPhase?.('beforeSqliteBackup')
        sidecarsAbsent(source)
        input.failAtPhase?.('partialSqliteWrite')
        await input.db.backup(tempPath)
        fsyncSync(sqliteDescriptor)
      } else {
        sqliteDescriptor = openBoundDescriptor(
          tempPath,
          constants.O_RDWR,
          existingFinal === undefined ? 1n : 2n,
          true,
        )
        attemptState = readStorageV3MigrationBackupAttempt(attemptContext(input, locator))
        assertRecordedIdentity(tempPath, sqliteDescriptor, existingFinal === undefined ? 1n : 2n, attemptState.sqliteDev, attemptState.sqliteIno)
        if (existingFinal !== undefined) assertHardLinkToDescriptor(finalPath, sqliteDescriptor)
        if (attemptState.sqliteContentSha256 === null) {
          const expectedNlink = existingFinal === undefined ? 1n : 2n
          if (isIncoherentSqlitePartial(tempPath, sqliteDescriptor, expectedNlink)) {
            // The provisional is identity-bound, but its owner set may have
            // changed while the process was down. Revalidate the live store
            // before truncating or asking SQLite to overwrite its bytes.
            assertOwners(liveOwners(input.db), input.ownerScopeIds)
            truncateForRetry(tempPath, sqliteDescriptor, expectedNlink)
            input.failAtPhase?.('beforeSqliteBackup')
            sidecarsAbsent(source)
            assertOwners(liveOwners(input.db), input.ownerScopeIds)
            input.failAtPhase?.('partialSqliteWrite')
            await input.db.backup(tempPath)
            fsyncSync(sqliteDescriptor)
          } else {
            // A complete coherent snapshot may have survived after backup but
            // before the hash row was committed. Keep it byte-for-byte.
            fsyncSync(sqliteDescriptor)
            assertDescriptorPath(tempPath, sqliteDescriptor, expectedNlink)
          }
        }
      }

      const sqliteNlink = stat(finalPath) === undefined ? 1n : 2n
      sidecarsAbsent(tempPath)
      assertDescriptorPath(tempPath, sqliteDescriptor, sqliteNlink)
      const contentSha256 = hashSqliteDescriptor(sqliteDescriptor)
      const snapshot = inspectBackupDb(tempPath, sqliteDescriptor, sqliteNlink)
      assertOwners(snapshot.ownerScopeIds, input.ownerScopeIds)
      input.failAtPhase?.('sqliteSnapshotBeforeHash')
      if (attemptState.sqliteContentSha256 !== null && attemptState.sqliteContentSha256 !== contentSha256) fail()
      attemptState = recordStorageV3MigrationBackupAttemptContentSha256({
        ...attemptContext(input, locator), contentSha256,
      })
      input.failAfterStage?.('sqliteTempDurable')

      const expectedManifest = makeManifest(input, locator, contentSha256, snapshot.selectedArtifactId)
      const existingManifestTemp = stat(manifestTempPath)
      const existingManifestFinal = stat(manifestPath)
      if (existingManifestTemp === undefined) {
        if (existingManifestFinal !== undefined) fail()
        try {
          manifestDescriptor = openSync(
            manifestTempPath,
            constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | NO_FOLLOW,
            0o600,
          )
        } catch { return fail() }
        assertDescriptorPath(manifestTempPath, manifestDescriptor, 1n, true)
        fsyncSync(manifestDescriptor)
        syncDirectory(input.root, 'manifestTempClaim')
        assertDescriptorPath(manifestTempPath, manifestDescriptor, 1n, true)
        const claimed = fstatSync(manifestDescriptor, { bigint: true })
        attemptState = bindStorageV3MigrationBackupAttemptIdentity({
          ...attemptContext(input, locator), file: 'manifest', dev: claimed.dev, ino: claimed.ino,
        })
        assertRecordedIdentity(manifestTempPath, manifestDescriptor, 1n, attemptState.manifestDev, attemptState.manifestIno)
        input.failAtPhase?.('partialManifestWrite')
        writeManifestAtZero(
          manifestTempPath,
          manifestDescriptor,
          1n,
          expectedManifest.bytes,
          () => input.failAtPhase?.('manifestBeforeFsync'),
        )
      } else {
        manifestDescriptor = openBoundDescriptor(
          manifestTempPath,
          constants.O_RDWR,
          existingManifestFinal === undefined ? 1n : 2n,
          true,
        )
        attemptState = readStorageV3MigrationBackupAttempt(attemptContext(input, locator))
        assertRecordedIdentity(manifestTempPath, manifestDescriptor, existingManifestFinal === undefined ? 1n : 2n, attemptState.manifestDev, attemptState.manifestIno)
        const manifestState = manifestIsExactOrPrefix(manifestDescriptor, expectedManifest.bytes)
        if (manifestState === 'invalid') fail()
        if (manifestState === 'prefix') {
          writeManifestAtZero(
            manifestTempPath,
            manifestDescriptor,
            existingManifestFinal === undefined ? 1n : 2n,
            expectedManifest.bytes,
            () => input.failAtPhase?.('manifestBeforeFsync'),
          )
        } else {
          input.failAtPhase?.('manifestBeforeFsync')
          fsyncSync(manifestDescriptor)
          assertDescriptorPath(
            manifestTempPath,
            manifestDescriptor,
            existingManifestFinal === undefined ? 1n : 2n,
          )
          if (!readDescriptorExactly(manifestDescriptor, expectedManifest.bytes.length).equals(expectedManifest.bytes)) fail()
        }
        if (existingManifestFinal !== undefined) assertHardLinkToDescriptor(manifestPath, manifestDescriptor)
      }
      const manifestSha256 = sha256(expectedManifest.bytes)
      input.failAfterStage?.('manifestTempDurable')

      if (stat(finalPath) === undefined) {
        assertDescriptorPath(tempPath, sqliteDescriptor, 1n)
        linkSync(tempPath, finalPath)
      }
      assertDescriptorPath(tempPath, sqliteDescriptor, 2n)
      assertHardLinkToDescriptor(finalPath, sqliteDescriptor)
      input.failAfterStage?.('sqliteFinalLinked')

      if (stat(manifestPath) === undefined) {
        assertDescriptorPath(manifestTempPath, manifestDescriptor, 1n)
        linkSync(manifestTempPath, manifestPath)
      }
      assertDescriptorPath(manifestTempPath, manifestDescriptor, 2n)
      assertHardLinkToDescriptor(manifestPath, manifestDescriptor)
      if (hashSqliteDescriptor(sqliteDescriptor) !== contentSha256
        || !readDescriptorExactly(manifestDescriptor, expectedManifest.bytes.length).equals(expectedManifest.bytes)) fail()
      input.failAfterStage?.('manifestFinalLinked')

      syncDirectory(input.root, 'finalNames')
      assertDescriptorPath(tempPath, sqliteDescriptor, 2n)
      assertHardLinkToDescriptor(finalPath, sqliteDescriptor)
      assertDescriptorPath(manifestTempPath, manifestDescriptor, 2n)
      assertHardLinkToDescriptor(manifestPath, manifestDescriptor)
      if (hashSqliteDescriptor(sqliteDescriptor) !== contentSha256
        || !readDescriptorExactly(manifestDescriptor, expectedManifest.bytes.length).equals(expectedManifest.bytes)) fail()
      input.failAfterStage?.('finalNamesDurable')

      const publicationProof = proveStorageV3MigrationBackupPublication({
        db: input.db,
        artifactId: input.artifactId,
        stagedLocator: tempLocator,
        finalLocator: locator,
        backupAt: input.backupAt,
        selectedArtifactId: snapshot.selectedArtifactId,
        contentSha256,
        manifestSha256,
        ownerScopeIds: input.ownerScopeIds,
        installationKey: input.installationKey,
      })
      promoteStorageV3MigrationBackupArtifact(publicationProof)
      input.failAfterStage?.('cataloguePromoted')

      cleanupPublishedTemp(
        input.root,
        tempPath,
        finalPath,
        sqliteDescriptor,
        'sqliteTempRemoval',
        syncDirectory,
      )
      input.failAfterStage?.('sqliteTempUnlinked')
      cleanupPublishedTemp(
        input.root,
        manifestTempPath,
        manifestPath,
        manifestDescriptor,
        'manifestTempRemoval',
        syncDirectory,
      )
      input.failAfterStage?.('manifestTempUnlinked')
      return Object.freeze({ artifactId: input.artifactId, locator, manifestLocator, contentSha256, manifestSha256 })
    } catch (error) {
      if (error instanceof StorageV3BackupError) throw error
      return fail()
    } finally {
      if (manifestDescriptor !== undefined) closeSync(manifestDescriptor)
      if (sqliteDescriptor !== undefined) closeSync(sqliteDescriptor)
    }
  }
  return run()
}

function createWithDirectorySynchronizer(
  input: StorageV3BackupInput,
  syncDirectory: StorageV3BackupDirectorySynchronizer,
  requireNativeSupport: boolean,
): Promise<StorageV3BackupResult> {
  try {
    // Native callers may provide the internal hook-shaped object, but hooks are
    // captured as data properties and deliberately stripped before execution.
    const closed = captureInput(input, true, !requireNativeSupport)
    if (typeof syncDirectory !== 'function') fail()
    if (requireNativeSupport) assertStorageV3ArtifactDirectorySyncSupported()
    return Promise.resolve(withStorageV3WriterLease(
      closed.root,
      () => attempt(closed, syncDirectory),
    ))
  } catch {
    return Promise.reject(new StorageV3BackupError())
  }
}

/** Create one immutable selected-store backup while holding the app writer lease for all async work. */
export function createStorageV3MigrationBackup(input: StorageV3BackupInput): Promise<StorageV3BackupResult> {
  return createWithDirectorySynchronizer(input, syncStorageV3ArtifactDirectory, true)
}

/** Restart/recovery entrypoint: exact same closed input resumes a staged intent under the lease. */
export const recoverStorageV3MigrationBackup = createStorageV3MigrationBackup

/**
 * @internal Invented-fixture seam. Callback success proves only userspace
 * ordering, never persistence across host power loss; hosted POSIX must run
 * the native entrypoint above.
 */
export const v3BackupTestSeams = Object.freeze({
  createWithDirectorySynchronizer(
    input: StorageV3BackupInput,
    synchronizer: (phase: StorageV3BackupDirectorySyncPhase) => void,
  ): Promise<StorageV3BackupResult> {
    if (typeof synchronizer !== 'function') return Promise.reject(new StorageV3BackupError())
    return createWithDirectorySynchronizer(input, (_root, phase) => synchronizer(phase), false)
  },
})
