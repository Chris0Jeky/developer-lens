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
  writeFileSync,
  type BigIntStats,
} from 'node:fs'
import Database from 'better-sqlite3'
import {
  assertPublishedStorageV3ArtifactCatalogue,
  assertStorageV3ArtifactCatalogue,
  assertStorageV3ArtifactRootInstallationKey,
  beginStorageV3MigrationBackupArtifact,
  bindStorageV3ArtifactRoot,
  promoteStorageV3MigrationBackupArtifact,
  proveStorageV3MigrationBackupPublication,
  storageV3ArtifactFilePath,
  storageV3MigrationBackupIntentSha256,
  storageV3MigrationBackupManifest,
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
}>

export const STORAGE_V3_BACKUP_STAGES = [
  'intentCommitted',
  'sqliteTempDurable',
  'manifestTempDurable',
  'sqliteFinalLinked',
  'manifestFinalLinked',
  'cataloguePromoted',
  'sqliteTempUnlinked',
  'manifestTempUnlinked',
] as const
export type StorageV3BackupStage = typeof STORAGE_V3_BACKUP_STAGES[number]

export type StorageV3BackupResult = Readonly<{
  artifactId: string
  locator: string
  manifestLocator: string
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
    || !/^[a-z0-9_-]{1,128}$/.test(input.installationKey.taskId)
    || !/^[a-f0-9]{64}$/.test(input.installationKey.fingerprint)) fail()
  const scopes = input.ownerScopeIds
  if (!Array.isArray(scopes) || scopes.length === 0
    || scopes.some((value, index) => typeof value !== 'string'
      || value !== [...scopes].sort()[index]
      || !/^scope-[0-9a-f]{64}$/.test(value))) fail()
  bindTaskInstallationKeyBody(input.installationKey, sha256(`${BACKUP_DOMAIN}\0closed-input`))
}

function closeInput(input: StorageV3BackupInput): StorageV3BackupInput {
  const closed = Object.freeze({
    db: input.db,
    root: input.root,
    backupAt: input.backupAt,
    artifactId: input.artifactId,
    ownerScopeIds: Object.freeze([...input.ownerScopeIds]),
    installationKey: input.installationKey,
    ...(input.failAfterStage === undefined ? {} : { failAfterStage: input.failAfterStage }),
  })
  assertInput(closed)
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

function cleanupPublishedTemp(
  tempPath: string,
  finalPath: string,
  finalDescriptor: number,
): void {
  if (stat(tempPath) === undefined) {
    assertDescriptorPath(finalPath, finalDescriptor, 1n)
    return
  }
  assertDescriptorPath(finalPath, finalDescriptor, 2n)
  assertHardLinkToDescriptor(tempPath, finalDescriptor)
  unlinkSync(tempPath)
  assertDescriptorPath(finalPath, finalDescriptor, 1n)
}

function replayIfExact(
  input: StorageV3BackupInput,
  locator: string,
  manifestLocator: string,
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
    cleanupPublishedTemp(tempPath, finalPath, finalDescriptor)
    cleanupPublishedTemp(manifestTempPath, manifestPath, manifestDescriptor)
    return Object.freeze({ artifactId: input.artifactId, locator, manifestLocator, contentSha256, manifestSha256 })
  } finally {
    if (manifestDescriptor !== undefined) closeSync(manifestDescriptor)
    closeSync(finalDescriptor)
  }
}

function attempt(input: StorageV3BackupInput): StorageV3BackupResult | Promise<StorageV3BackupResult> {
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
  const replay = replayIfExact(input, locator, manifestLocator)
  if (replay) return replay

  const stagedRow = input.db.prepare(
    "SELECT artifact_id, content_sha256, manifest_sha256 FROM app_artifact WHERE kind = 'migration_backup_v1' AND relative_locator = ? AND state = 'active'",
  ).get(tempLocator) as { artifact_id: string; content_sha256: string; manifest_sha256: string } | undefined
  if (stagedRow) {
    assertStorageV3ArtifactCatalogue(input.db)
    const intentSha256 = storageV3MigrationBackupIntentSha256(input.artifactId, locator)
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
    })
    input.failAfterStage?.('intentCommitted')
  }

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
        sidecarsAbsent(source)
        await input.db.backup(tempPath)
        fsyncSync(sqliteDescriptor)
      } else {
        sqliteDescriptor = openBoundDescriptor(
          tempPath,
          constants.O_RDWR,
          existingFinal === undefined ? 1n : 2n,
        )
        if (existingFinal !== undefined) assertHardLinkToDescriptor(finalPath, sqliteDescriptor)
      }

      const sqliteNlink = stat(finalPath) === undefined ? 1n : 2n
      sidecarsAbsent(tempPath)
      assertDescriptorPath(tempPath, sqliteDescriptor, sqliteNlink)
      const contentSha256 = hashSqliteDescriptor(sqliteDescriptor)
      const snapshot = inspectBackupDb(tempPath, sqliteDescriptor, sqliteNlink)
      assertOwners(snapshot.ownerScopeIds, input.ownerScopeIds)
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
        writeFileSync(manifestDescriptor, expectedManifest.bytes)
        fsyncSync(manifestDescriptor)
        assertDescriptorPath(manifestTempPath, manifestDescriptor, 1n)
        if (!readDescriptorExactly(manifestDescriptor, expectedManifest.bytes.length).equals(expectedManifest.bytes)) fail()
      } else {
        manifestDescriptor = openExactManifest(
          manifestTempPath,
          expectedManifest.bytes,
          existingManifestFinal === undefined ? 1n : 2n,
        )
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

      unlinkSync(tempPath)
      assertDescriptorPath(finalPath, sqliteDescriptor, 1n)
      input.failAfterStage?.('sqliteTempUnlinked')
      unlinkSync(manifestTempPath)
      assertDescriptorPath(manifestPath, manifestDescriptor, 1n)
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

/** Create one immutable selected-store backup while holding the app writer lease for all async work. */
export function createStorageV3MigrationBackup(input: StorageV3BackupInput): Promise<StorageV3BackupResult> {
  try {
    const closed = closeInput(input)
    return Promise.resolve(withStorageV3WriterLease(closed.root, () => attempt(closed)))
  } catch {
    return Promise.reject(new StorageV3BackupError())
  }
}

/** Restart/recovery entrypoint: exact same closed input resumes a staged intent under the lease. */
export const recoverStorageV3MigrationBackup = createStorageV3MigrationBackup
