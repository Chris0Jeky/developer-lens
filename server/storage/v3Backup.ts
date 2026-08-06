import { createHash } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  realpathSync,
  readFileSync,
  readSync,
  unlinkSync,
  linkSync,
  writeFileSync,
  type BigIntStats,
} from 'node:fs'
import Database from 'better-sqlite3'
import {
  assertPublishedStorageV3ArtifactCatalogue,
  bindStorageV3ArtifactRoot,
  registerStorageV3MigrationBackupArtifact,
  storageV3ArtifactFilePath,
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

export const STORAGE_V3_BACKUP_ERROR = 'STORAGE_V3_BACKUP_INVALID' as const
const BACKUP_DOMAIN = 'developer-lens.storage-v3-backup-manifest.v1' as const
const OWNER_DOMAIN = 'developer-lens.storage-v3-backup-owner-set.v1' as const
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
}>

export type StorageV3BackupResult = Readonly<{
  artifactId: string
  locator: string
  manifestLocator: string
  contentSha256: string
  manifestSha256: string
}>

function sha256(bytes: Buffer | string): string { return createHash('sha256').update(bytes).digest('hex') }
function canonicalJson(value: unknown): string { return JSON.stringify(value) }
function stat(path: string): BigIntStats | undefined {
  try { return lstatSync(path, { bigint: true }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    return fail()
  }
}
function assertAbsent(path: string): void { if (stat(path) !== undefined) fail() }
function assertRegular(path: string, expectedNlink = 1n): BigIntStats {
  const before = stat(path)
  if (!before || !before.isFile() || before.isSymbolicLink() || before.nlink !== expectedNlink || before.size === 0n) {
    fail()
  }
  try { if (realpathSync.native(path) !== path) fail() } catch { return fail() }
  const fd = openSync(path, constants.O_RDONLY | NO_FOLLOW)
  try {
    const handle = fstatSync(fd, { bigint: true })
    if (!handle.isFile() || handle.isSymbolicLink() || handle.nlink !== expectedNlink
      || handle.dev !== before.dev || handle.ino !== before.ino || handle.size !== before.size) fail()
  } finally { closeSync(fd) }
  return before
}
function physicalHash(path: string): string {
  assertRegular(path)
  const fd = openSync(path, constants.O_RDONLY | NO_FOLLOW)
  const hash = createHash('sha256')
  try {
    const header = Buffer.alloc(SQLITE_HEADER.length)
    if (readSync(fd, header, 0, header.length, 0) !== header.length || !header.equals(SQLITE_HEADER)) fail()
    const bytes = Buffer.alloc(64 * 1024)
    for (;;) { const count = readSync(fd, bytes, 0, bytes.length, null); if (count === 0) break; hash.update(bytes.subarray(0, count)) }
  } finally { closeSync(fd) }
  return hash.digest('hex')
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
  if (!input.installationKey || typeof input.installationKey !== 'object' || !/^[a-z0-9_-]{1,128}$/.test(input.installationKey.taskId)
    || !/^[a-f0-9]{64}$/.test(input.installationKey.fingerprint)) fail()
  const scopes = input.ownerScopeIds
  if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some((value, index) => typeof value !== 'string' || value !== [...scopes].sort()[index] || !/^scope-[0-9a-f]{64}$/.test(value))) fail()
}
function sidecarsAbsent(path: string): void {
  for (const suffix of ['-wal', '-shm', '-journal']) if (stat(`${path}${suffix}`)) fail()
}

function makeManifest(input: StorageV3BackupInput, locator: string, contentSha256: string): { bytes: Buffer; bodySha256: string } {
  const ownerScopeIds = [...input.ownerScopeIds]
  const ownerScopeHash = sha256(`${OWNER_DOMAIN}\0${ownerScopeIds.join('\0')}`)
  const selected = input.db.prepare("SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store' AND state = 'active'").get() as { artifact_id: string } | undefined
  if (!selected) fail()
  const body = {
    version: 'migration_backup_v1',
    locator,
    backupAt: input.backupAt,
    artifactId: input.artifactId,
    selectedArtifactId: selected.artifact_id,
    applicationId: STORAGE_V3_SHADOW_APPLICATION_ID,
    userVersion: STORAGE_V3_SHADOW_USER_VERSION,
    schemaFingerprint: STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
    contentSha256,
    ownerScopeIds,
    ownerScopeHash,
    taskId: input.installationKey.taskId,
    taskFingerprint: input.installationKey.fingerprint,
  }
  const bodySha256 = sha256(`${BACKUP_DOMAIN}\0${canonicalJson(body)}`)
  const manifest = { ...body, bodySha256, installationKeyBinding: bindTaskInstallationKeyBody(input.installationKey, bodySha256) }
  return { bytes: Buffer.from(`${canonicalJson(manifest)}\n`, 'utf8'), bodySha256 }
}

function replayIfExact(input: StorageV3BackupInput, locator: string, manifestLocator: string): StorageV3BackupResult | undefined {
  const finalPath = storageV3ArtifactFilePath(input.root, locator)
  const manifestPath = storageV3ArtifactFilePath(input.root, manifestLocator)
  const finalEntry = stat(finalPath)
  const manifestEntry = stat(manifestPath)
  if (finalEntry === undefined && manifestEntry === undefined) return undefined
  if (finalEntry === undefined || manifestEntry === undefined) fail()
  const contentSha256 = physicalHash(finalPath)
  const manifestBytes = readFileSync(manifestPath)
  const manifestSha256 = sha256(manifestBytes)
  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(manifestBytes.toString('utf8')) as Record<string, unknown> } catch { return fail() }
  const selected = input.db.prepare("SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store' AND state = 'active'").get() as { artifact_id: string } | undefined
  if (!selected) fail()
  if (parsed.artifactId !== input.artifactId || parsed.selectedArtifactId !== selected.artifact_id
    || parsed.locator !== locator || parsed.backupAt !== input.backupAt || parsed.contentSha256 !== contentSha256
    || parsed.taskId !== input.installationKey.taskId || parsed.taskFingerprint !== input.installationKey.fingerprint
    || JSON.stringify(parsed.ownerScopeIds) !== JSON.stringify(input.ownerScopeIds)) fail()
  const body = { ...parsed }
  delete body.bodySha256; delete body.installationKeyBinding
  const bodySha256 = sha256(`${BACKUP_DOMAIN}\0${canonicalJson(body)}`)
  if (parsed.bodySha256 !== bodySha256 || parsed.installationKeyBinding !== bindTaskInstallationKeyBody(input.installationKey, bodySha256)) fail()
  const row = input.db.prepare('SELECT kind, state, content_sha256, manifest_sha256 FROM app_artifact WHERE artifact_id = ? AND relative_locator = ?').get(input.artifactId, locator) as Record<string, unknown> | undefined
  if (!row || row.kind !== 'migration_backup_v1' || row.state !== 'active' || row.content_sha256 !== contentSha256 || row.manifest_sha256 !== manifestSha256) fail()
  validateBackupDb(finalPath)
  return Object.freeze({ artifactId: input.artifactId, locator, manifestLocator, contentSha256, manifestSha256 })
}

function validateBackupDb(path: string): void {
  const backup = new Database(path, { fileMustExist: true })
  try {
    backup.pragma('foreign_keys = ON')
    if (Number(backup.pragma('application_id', { simple: true })) !== STORAGE_V3_SHADOW_APPLICATION_ID
      || Number(backup.pragma('user_version', { simple: true })) !== STORAGE_V3_SHADOW_USER_VERSION
      || storageV3ShadowSchemaFingerprint(backup) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT
      || String(backup.pragma('integrity_check', { simple: true })) !== 'ok'
      || backup.pragma('foreign_key_check').length !== 0) fail()
  } finally { backup.close() }
}

function attempt(input: StorageV3BackupInput): StorageV3BackupResult | Promise<StorageV3BackupResult> {
  assertInput(input)
  bindStorageV3ArtifactRoot(input.db, input.root)
  assertPublishedStorageV3ArtifactCatalogue(input.db)
  const source = storageV3ArtifactFilePath(input.root, 'v3-store.sqlite')
  if (typeof input.db.name !== 'string' || input.db.name !== source) fail()
  sidecarsAbsent(source)
  const locator = `migration-backup-${input.backupAt.replace(/[-:]/g, '').replace('.000Z', 'Z')}.sqlite`
  const manifestLocator = `${locator}.manifest.json`
  const temp = `${locator}.tmp`
  const manifestTemp = `${manifestLocator}.tmp`
  const replay = replayIfExact(input, locator, manifestLocator)
  if (replay) return replay
  for (const path of [storageV3ArtifactFilePath(input.root, locator), storageV3ArtifactFilePath(input.root, manifestLocator), storageV3ArtifactFilePath(input.root, temp), storageV3ArtifactFilePath(input.root, manifestTemp)]) assertAbsent(path)
  const tempPath = storageV3ArtifactFilePath(input.root, temp)
  const finalPath = storageV3ArtifactFilePath(input.root, locator)
  const manifestPath = storageV3ArtifactFilePath(input.root, manifestLocator)
  const manifestTempPath = storageV3ArtifactFilePath(input.root, manifestTemp)
  const descriptor = openSync(tempPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | NO_FOLLOW, 0o600)
  const initial = fstatSync(descriptor, { bigint: true })
  if (!initial.isFile() || initial.isSymbolicLink() || initial.nlink !== 1n || initial.dev === 0n || initial.ino === 0n) {
    closeSync(descriptor)
    return fail()
  }
  const run = async (): Promise<StorageV3BackupResult> => {
    try {
      await input.db.backup(tempPath)
      const afterBackup = fstatSync(descriptor, { bigint: true })
      if (!afterBackup.isFile() || afterBackup.isSymbolicLink() || afterBackup.dev !== initial.dev || afterBackup.ino !== initial.ino || afterBackup.nlink < 1n || afterBackup.size === 0n) fail()
      const contentSha256 = physicalHash(tempPath)
      validateBackupDb(tempPath)
      const manifest = makeManifest(input, locator, contentSha256)
      writeFileSync(manifestTempPath, manifest.bytes, { flag: 'wx', mode: 0o600 })
      const manifestSha256 = sha256(readFileSync(manifestTempPath))
      linkSync(tempPath, finalPath)
      const tempStat = assertRegular(tempPath, 2n); const finalStat = assertRegular(finalPath, 2n)
      if (tempStat.dev !== finalStat.dev || tempStat.ino !== finalStat.ino || tempStat.nlink !== 2n) fail()
      linkSync(manifestTempPath, manifestPath)
      const manifestTempStat = assertRegular(manifestTempPath, 2n); const manifestFinalStat = assertRegular(manifestPath, 2n)
      if (manifestTempStat.dev !== manifestFinalStat.dev || manifestTempStat.ino !== manifestFinalStat.ino || manifestTempStat.nlink !== 2n) fail()
      unlinkSync(tempPath); unlinkSync(manifestTempPath)
      if (assertRegular(finalPath).nlink !== 1n || assertRegular(manifestPath).nlink !== 1n) fail()
      if (physicalHash(finalPath) !== contentSha256 || sha256(readFileSync(manifestPath)) !== manifestSha256) fail()
      registerStorageV3MigrationBackupArtifact({ db: input.db, artifactId: input.artifactId, relativeLocator: locator, scopeIds: input.ownerScopeIds, contentSha256, manifestSha256 })
      return Object.freeze({ artifactId: input.artifactId, locator, manifestLocator, contentSha256, manifestSha256 })
    } catch (error) {
      if (error instanceof StorageV3BackupError) throw error
      return fail()
    } finally { closeSync(descriptor) }
  }
  return run()
}

/** Create one immutable selected-store backup while holding the app writer lease for all async work. */
export function createStorageV3MigrationBackup(input: StorageV3BackupInput): Promise<StorageV3BackupResult> {
  try { return Promise.resolve(withStorageV3WriterLease(input.root, () => attempt(input))) } catch { return Promise.reject(new StorageV3BackupError()) }
}
