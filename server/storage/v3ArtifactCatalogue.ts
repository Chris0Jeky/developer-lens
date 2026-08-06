import { createHash, randomBytes as cryptoRandomBytes } from 'node:crypto'
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  rmSync,
  type BigIntStats,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import {
  ArtifactIdV3Schema,
  DeletionOperationIdV3Schema,
  IsoWeekV3Schema,
  ScopeIdV3Schema,
} from './v3Proposal.js'
import {
  STORAGE_V3_ARTIFACT_KINDS,
  STORAGE_V3_ARTIFACT_LOCATORS,
  STORAGE_V3_ARTIFACT_STATES,
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  STORAGE_V3_SHADOW_USER_VERSION,
  storageV3ShadowSchemaFingerprint,
  storageV3ArtifactManifestSha256,
  storageV3SelectedStoreContentSha256,
  type StorageV3ArtifactKind,
  type StorageV3ArtifactState,
} from './v3ShadowSchema.js'

export { STORAGE_V3_ARTIFACT_LOCATORS }

/** One fixed application-owned marker; callers cannot choose a lock locator. */
export const STORAGE_V3_WRITER_LEASE_LOCATOR = 'v3-writer.lease' as const

/**
 * LIFE-02 B4: the selected v3 store is the durable catalogue.  Absolute paths
 * never cross the SQL boundary; the process instead binds each opened store to
 * an opaque, revalidated root handle held only in this module.
 */

export const STORAGE_V3_ARTIFACT_ERROR = 'STORAGE_V3_ARTIFACT_INVALID' as const

export class StorageV3ArtifactError extends Error {
  public readonly code = STORAGE_V3_ARTIFACT_ERROR

  constructor() {
    super(STORAGE_V3_ARTIFACT_ERROR)
    this.name = 'StorageV3ArtifactError'
  }
}

const fail = (): never => { throw new StorageV3ArtifactError() }

/** Explicitly outside recall: its output directory is selected by the user. */
export const STORAGE_V3_USER_DIRECTED_ARTIFACTS = Object.freeze({
  analysisPack: Object.freeze({ classification: 'user-directed', recalled: false }),
})

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'binary')
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0
const SAFE_LOCATOR = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const MIGRATION_BACKUP_LOCATOR = /^migration-backup-[0-9]{8}T[0-9]{6}Z\.sqlite$/
const MIGRATION_BACKUP_STAGED_LOCATOR = /^migration-backup-[0-9]{8}T[0-9]{6}Z\.sqlite\.tmp$/

interface RootIdentity {
  readonly path: string
  readonly dev: bigint
  readonly ino: bigint
}

/** Runtime-opaque; the path exists only in ROOT_IDENTITIES. */
export interface StorageV3ArtifactRoot {
  readonly __storageV3ArtifactRoot: never
}

/** Opaque proof that one exact child was a stable, confined SQLite file. */
export interface StorageV3ArtifactFileProof {
  readonly __storageV3ArtifactFileProof: never
}

const ROOT_IDENTITIES = new WeakMap<StorageV3ArtifactRoot, RootIdentity>()
const STORE_ROOTS = new WeakMap<Database.Database, StorageV3ArtifactRoot>()
const FILE_PROOFS = new WeakMap<StorageV3ArtifactFileProof, StableFile>()

const identityAvailable = (value: Readonly<{ dev: bigint; ino: bigint }>): boolean =>
  value.dev !== 0n || value.ino !== 0n

const sameIdentity = (
  left: Readonly<{ dev: bigint; ino: bigint }>,
  right: Readonly<{ dev: bigint; ino: bigint }>,
): boolean => identityAvailable(left) && identityAvailable(right)
  && left.dev === right.dev && left.ino === right.ino

function captureRoot(path: string): RootIdentity {
  const before = lstatSync(path, { bigint: true })
  const canonical = realpathSync.native(path)
  const after = lstatSync(path, { bigint: true })
  if (
    !before.isDirectory() || !after.isDirectory()
    || before.isSymbolicLink() || after.isSymbolicLink()
    || canonical !== path || !sameIdentity(before, after)
  ) fail()
  return Object.freeze({ path, dev: after.dev, ino: after.ino })
}

function rootIdentity(root: StorageV3ArtifactRoot): RootIdentity {
  const expected = ROOT_IDENTITIES.get(root)
  if (expected === undefined) return fail()
  const actual = captureRoot(expected.path)
  if (!sameIdentity(expected, actual)) fail()
  return expected
}

function lstatEntry(path: string): BigIntStats | undefined {
  try {
    return lstatSync(path, { bigint: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    return fail()
  }
}

/** Create only the explicit app-controlled root and return no path value. */
export function createStorageV3ArtifactRoot(directory: string): StorageV3ArtifactRoot {
  if (typeof directory !== 'string' || directory.length === 0) fail()
  const absolute = resolve(directory)
  let existingAncestor = absolute
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor)
    if (parent === existingAncestor) fail()
    existingAncestor = parent
  }
  // Refuse a symlink/reparse escape before mkdir can create through it.
  captureRoot(existingAncestor)
  mkdirSync(absolute, { recursive: true })
  return openStorageV3ArtifactRoot(absolute)
}

/** Open an existing reviewed root without creating filesystem state. */
export function openStorageV3ArtifactRoot(directory: string): StorageV3ArtifactRoot {
  if (typeof directory !== 'string' || directory.length === 0) fail()
  const absolute = resolve(directory)
  if (!existsSync(absolute)) fail()
  const identity = captureRoot(absolute)
  const handle = Object.freeze({}) as StorageV3ArtifactRoot
  ROOT_IDENTITIES.set(handle, identity)
  return handle
}

/** Bind a selected-store connection to the already reviewed root, in process only. */
export function bindStorageV3ArtifactRoot(
  db: Database.Database,
  root: StorageV3ArtifactRoot,
): void {
  if (!db?.open) fail()
  const requested = rootIdentity(root)
  const existing = STORE_ROOTS.get(db)
  if (existing !== undefined) {
    const bound = rootIdentity(existing)
    if (
      bound.path !== requested.path
      || !sameIdentity(bound, requested)
    ) fail()
  }
  STORE_ROOTS.set(db, root)
}

function boundRoot(db: Database.Database): StorageV3ArtifactRoot {
  const root = STORE_ROOTS.get(db)
  if (root === undefined) return fail()
  rootIdentity(root)
  return root
}

function validateLocator(kind: StorageV3ArtifactKind, locator: string): void {
  if (!SAFE_LOCATOR.test(locator) || locator === '.' || locator === '..') fail()
  if (kind === 'selected_store' && locator !== STORAGE_V3_ARTIFACT_LOCATORS.selectedStore) fail()
  if (kind === 'migration_primary_temp' && locator !== STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary) fail()
  if (kind === 'migration_replay_temp' && locator !== STORAGE_V3_ARTIFACT_LOCATORS.migrationReplay) fail()
  if (kind === 'migration_backup_v1' && !MIGRATION_BACKUP_LOCATOR.test(locator) && !MIGRATION_BACKUP_STAGED_LOCATOR.test(locator)) fail()
  if (kind === 'invented_fixture_store' && !locator.endsWith('.sqlite')) fail()
}

function artifactPath(root: StorageV3ArtifactRoot, locator: string): string {
  if (!SAFE_LOCATOR.test(locator)) fail()
  return join(rootIdentity(root).path, locator)
}

function manifestSha256(kind: StorageV3ArtifactKind, locator: string): string {
  validateLocator(kind, locator)
  return storageV3ArtifactManifestSha256(kind, locator)
}

export function storageV3MigrationBackupIntentSha256(
  artifactId: string,
  finalLocator: string,
): string {
  if (!ArtifactIdV3Schema.safeParse(artifactId).success) fail()
  validateLocator('migration_backup_v1', finalLocator)
  if (finalLocator.endsWith('.sqlite.tmp')) fail()
  return createHash('sha256')
    .update(`developer-lens.storage-v3-backup-intent.v1\0${artifactId}\0${finalLocator}`, 'utf8')
    .digest('hex')
}

interface StableFile {
  readonly path: string
  readonly dev: bigint
  readonly ino: bigint
  readonly nlink: bigint
  readonly size: bigint
  readonly ctimeNs: bigint
  readonly mtimeNs: bigint
}

function captureStableFile(path: string, expectedNlink = 1n): StableFile {
  const before = lstatSync(path, { bigint: true })
  const canonical = realpathSync.native(path)
  const descriptor = openSync(path, constants.O_RDONLY | NO_FOLLOW)
  try {
    const handle = fstatSync(descriptor, { bigint: true })
    const after = lstatSync(path, { bigint: true })
    if (
      !before.isFile() || !handle.isFile() || !after.isFile()
      || before.isSymbolicLink() || after.isSymbolicLink()
      || before.nlink !== expectedNlink || handle.nlink !== expectedNlink || after.nlink !== expectedNlink
      || canonical !== path
      || !sameIdentity(before, handle) || !sameIdentity(handle, after)
      || before.size !== handle.size || handle.size !== after.size
      || before.ctimeNs !== handle.ctimeNs || handle.ctimeNs !== after.ctimeNs
      || before.mtimeNs !== handle.mtimeNs || handle.mtimeNs !== after.mtimeNs
    ) fail()
    return Object.freeze({
      path,
      dev: handle.dev,
      ino: handle.ino,
      nlink: handle.nlink,
      size: handle.size,
      ctimeNs: handle.ctimeNs,
      mtimeNs: handle.mtimeNs,
    })
  } finally {
    closeSync(descriptor)
  }
}

function assertSameFile(expected: StableFile): void {
  const actual = captureStableFile(expected.path, expected.nlink)
  if (
    !sameIdentity(expected, actual)
    || expected.size !== actual.size
    || expected.ctimeNs !== actual.ctimeNs
    || expected.mtimeNs !== actual.mtimeNs
  ) fail()
}

function assertSqliteKind(path: string, kind: StorageV3ArtifactKind, expectedNlink = 1n): StableFile {
  const stable = captureStableFile(path, expectedNlink)
  if (stable.size === 0n) {
    if (kind === 'migration_primary_temp' || kind === 'migration_replay_temp') return stable
    fail()
  }
  if (stable.size < BigInt(SQLITE_HEADER.length)) fail()
  const descriptor = openSync(path, constants.O_RDONLY | NO_FOLLOW)
  try {
    const header = Buffer.alloc(SQLITE_HEADER.length)
    if (readSync(descriptor, header, 0, header.length, 0) !== header.length) fail()
    if (!header.equals(SQLITE_HEADER)) fail()
  } finally {
    closeSync(descriptor)
  }
  assertSameFile(stable)
  return stable
}

export function proveStorageV3ArtifactFile(
  root: StorageV3ArtifactRoot,
  locator: string,
  kind: StorageV3ArtifactKind,
): StorageV3ArtifactFileProof {
  validateLocator(kind, locator)
  const stable = assertSqliteKind(artifactPath(root, locator), kind)
  const proof = Object.freeze({}) as StorageV3ArtifactFileProof
  FILE_PROOFS.set(proof, stable)
  return proof
}

export function assertStorageV3ArtifactFileProof(proof: StorageV3ArtifactFileProof): void {
  const stable = FILE_PROOFS.get(proof)
  if (stable === undefined) return fail()
  assertSameFile(stable)
}

/** Stable physical byte hash for every separately deletable artifact file. */
function physicalContentSha256(path: string, kind: StorageV3ArtifactKind, expectedNlink = 1n): string {
  const stable = assertSqliteKind(path, kind, expectedNlink)
  const descriptor = openSync(path, constants.O_RDONLY | NO_FOLLOW)
  const hash = createHash('sha256')
  try {
    const buffer = Buffer.alloc(64 * 1024)
    for (;;) {
      const read = readSync(descriptor, buffer, 0, buffer.length, null)
      if (read === 0) break
      hash.update(buffer.subarray(0, read))
    }
  } finally {
    closeSync(descriptor)
  }
  assertSameFile(stable)
  return hash.digest('hex')
}

function physicalFileSha256(path: string, expectedNlink: bigint): string {
  const stable = captureStableFile(path, expectedNlink)
  const descriptor = openSync(path, constants.O_RDONLY | NO_FOLLOW)
  const hash = createHash('sha256')
  try {
    const buffer = Buffer.alloc(64 * 1024)
    for (;;) {
      const read = readSync(descriptor, buffer, 0, buffer.length, null)
      if (read === 0) break
      hash.update(buffer.subarray(0, read))
    }
  } finally {
    closeSync(descriptor)
  }
  assertSameFile(stable)
  return hash.digest('hex')
}

/**
 * Registration accepts only a standalone SQLite image. Fold any valid WAL into
 * the main file, switch the artifact to rollback-journal mode, close it, and
 * remove the now-inert exact sidecars before taking the durable byte hash.
 */
function quiesceStorageV3DatabaseFamily(
  root: StorageV3ArtifactRoot,
  locator: string,
  kind: StorageV3ArtifactKind,
): string {
  const path = artifactPath(root, locator)
  const proof = proveStorageV3ArtifactFile(root, locator, kind)
  let artifactDb: Database.Database | undefined
  try {
    artifactDb = new Database(path, { fileMustExist: true })
    assertStorageV3ArtifactFileProof(proof)
    const checkpoint = artifactDb.pragma('wal_checkpoint(TRUNCATE)') as Array<{ busy: number }>
    if (checkpoint.some((row) => Number(row.busy) !== 0)) fail()
    const mode = String(artifactDb.pragma('journal_mode = DELETE', { simple: true })).toLowerCase()
    if (mode !== 'delete') fail()
  } catch (error) {
    if (error instanceof StorageV3ArtifactError) throw error
    return fail()
  } finally {
    if (artifactDb?.open) artifactDb.close()
  }
  removeStorageV3DatabaseSidecars(root, locator)
  return physicalContentSha256(path, kind)
}

function safeRemoveExactFile(root: StorageV3ArtifactRoot, locator: string): void {
  const path = artifactPath(root, locator)
  const entry = lstatEntry(path)
  if (entry === undefined) return
  if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1n) fail()
  const stable = captureStableFile(path)
  assertSameFile(stable)
  rmSync(path)
}

/** Exact known SQLite family only; no directory scan or caller-shaped suffix. */
export function removeStorageV3DatabaseFamily(
  root: StorageV3ArtifactRoot,
  locator: string,
): void {
  if (!SAFE_LOCATOR.test(locator)) fail()
  removeStorageV3DatabaseSidecars(root, locator)
  safeRemoveExactFile(root, locator)
}

export function removeStorageV3DatabaseSidecars(
  root: StorageV3ArtifactRoot,
  locator: string,
): void {
  if (!SAFE_LOCATOR.test(locator)) fail()
  for (const suffix of ['-shm', '-wal', '-journal']) {
    safeRemoveExactFile(root, `${locator}${suffix}`)
  }
}

export function storageV3ArtifactFilePath(
  root: StorageV3ArtifactRoot,
  locator: string,
): string {
  return artifactPath(root, locator)
}

function safeRemoveLink(root: StorageV3ArtifactRoot, locator: string): void {
  const path = artifactPath(root, locator)
  const entry = lstatEntry(path)
  if (entry === undefined) return
  if (!entry.isFile() || entry.isSymbolicLink() || (entry.nlink !== 1n && entry.nlink !== 2n)) fail()
  const stable = captureStableFile(path, entry.nlink)
  assertSameFile(stable)
  rmSync(path)
}

interface MigrationBackupFilePair {
  readonly temp?: StableFile
  readonly final?: StableFile
}

interface MigrationBackupFiles {
  readonly staged: boolean
  readonly tempLocator: string
  readonly finalLocator: string
  readonly manifestTempLocator: string
  readonly manifestFinalLocator: string
  readonly sqlite: MigrationBackupFilePair
  readonly manifest: MigrationBackupFilePair
}

function inspectMigrationBackupPair(
  root: StorageV3ArtifactRoot,
  tempLocator: string,
  finalLocator: string,
  staged: boolean,
  allowPublishedMissing: boolean,
): MigrationBackupFilePair {
  const tempPath = artifactPath(root, tempLocator)
  const finalPath = artifactPath(root, finalLocator)
  const tempEntry = lstatEntry(tempPath)
  const finalEntry = lstatEntry(finalPath)
  if (staged && tempEntry === undefined && finalEntry !== undefined) fail()
  if (!staged && finalEntry === undefined) {
    if (allowPublishedMissing && tempEntry === undefined) return Object.freeze({})
    fail()
  }
  if (tempEntry !== undefined && finalEntry !== undefined) {
    const temp = captureStableFile(tempPath, 2n)
    const final = captureStableFile(finalPath, 2n)
    if (temp.dev !== final.dev || temp.ino !== final.ino || temp.size !== final.size) fail()
    return Object.freeze({ temp, final })
  }
  const temp = tempEntry === undefined ? undefined : captureStableFile(tempPath, 1n)
  const final = finalEntry === undefined ? undefined : captureStableFile(finalPath, 1n)
  return Object.freeze({ temp, final })
}

function inspectMigrationBackupFiles(
  root: StorageV3ArtifactRoot,
  row: ArtifactRow,
  allowPublishedMissing: boolean,
): MigrationBackupFiles {
  const staged = row.relative_locator.endsWith('.sqlite.tmp')
  const finalLocator = staged ? row.relative_locator.slice(0, -4) : row.relative_locator
  const tempLocator = `${finalLocator}.tmp`
  const manifestFinalLocator = `${finalLocator}.manifest.json`
  const manifestTempLocator = `${tempLocator}.manifest.json`
  const sqlite = inspectMigrationBackupPair(root, tempLocator, finalLocator, staged, allowPublishedMissing)
  const manifest = inspectMigrationBackupPair(
    root,
    manifestTempLocator,
    manifestFinalLocator,
    staged,
    allowPublishedMissing,
  )
  if (staged && !allowPublishedMissing) {
    if ((manifest.temp !== undefined || manifest.final !== undefined) && sqlite.temp === undefined) fail()
    if (sqlite.final !== undefined && manifest.temp === undefined) fail()
    if (manifest.final !== undefined && sqlite.final === undefined) fail()
  }
  if (!staged) {
    if (sqlite.final !== undefined
      && physicalContentSha256(sqlite.final.path, 'migration_backup_v1', sqlite.final.nlink) !== row.content_sha256) fail()
    if (manifest.final !== undefined
      && physicalFileSha256(manifest.final.path, manifest.final.nlink) !== row.manifest_sha256) fail()
  }
  return Object.freeze({
    staged,
    tempLocator,
    finalLocator,
    manifestTempLocator,
    manifestFinalLocator,
    sqlite,
    manifest,
  })
}

function removeMigrationBackupFiles(root: StorageV3ArtifactRoot, files: MigrationBackupFiles): void {
  if (files.staged) {
    safeRemoveLink(root, files.finalLocator)
    safeRemoveLink(root, files.tempLocator)
    safeRemoveLink(root, files.manifestFinalLocator)
    safeRemoveLink(root, files.manifestTempLocator)
  } else {
    safeRemoveLink(root, files.tempLocator)
    safeRemoveLink(root, files.finalLocator)
    safeRemoveLink(root, files.manifestTempLocator)
    safeRemoveLink(root, files.manifestFinalLocator)
  }
}

/** Return the exact lease path under an already reviewed root. */
export function storageV3WriterLeasePath(root: StorageV3ArtifactRoot): string {
  return artifactPath(root, STORAGE_V3_WRITER_LEASE_LOCATOR)
}

interface ArtifactRow {
  readonly artifact_id: string
  readonly kind: string
  readonly state: string
  readonly manifest_sha256: string
  readonly content_sha256: string
  readonly relative_locator: string
  readonly deletion_operation_id: string | null
  readonly deletion_scope_id: string | null
  readonly deletion_week: string | null
}

interface MaintenanceRow {
  readonly state: 'complete' | 'pending'
  readonly operation_id: string | null
  readonly scope_id: string | null
  readonly event_week: string | null
}

function readMaintenance(db: Database.Database): MaintenanceRow {
  const rows = db.prepare(
    'SELECT state, operation_id, scope_id, event_week FROM storage_maintenance_state WHERE singleton = 1',
  ).all() as MaintenanceRow[]
  if (rows.length === 0) {
    return Object.freeze({
      state: 'complete' as const,
      operation_id: null,
      scope_id: null,
      event_week: null,
    })
  }
  if (rows.length !== 1) fail()
  const row = rows[0]
  if (!row || (row.state !== 'complete' && row.state !== 'pending')) fail()
  if (row.state === 'complete') {
    if (row.operation_id !== null || row.scope_id !== null || row.event_week !== null) fail()
  } else if (
    !DeletionOperationIdV3Schema.safeParse(row.operation_id).success
    || !ScopeIdV3Schema.safeParse(row.scope_id).success
    || !IsoWeekV3Schema.safeParse(row.event_week).success
  ) fail()
  return row
}

export function storageV3MaintenanceStatus(db: Database.Database): 'complete' | 'pending' {
  return readMaintenance(db).state
}

function artifactRows(db: Database.Database): ArtifactRow[] {
  return db.prepare(
    `SELECT artifact_id, kind, state, manifest_sha256, content_sha256, relative_locator,
            deletion_operation_id, deletion_scope_id, deletion_week
     FROM app_artifact ORDER BY artifact_id`,
  ).all() as ArtifactRow[]
}

/** Structural and ownership proof shared by selection, deletion, and recovery. */
export function assertStorageV3ArtifactCatalogue(db: Database.Database): void {
  const maintenance = readMaintenance(db)
  const liveScopes = new Set(db.prepare('SELECT scope_id FROM claim_scope').pluck().all() as string[])
  let selectedStores = 0
  for (const row of artifactRows(db)) {
    const kind = row.kind as StorageV3ArtifactKind
    const state = row.state as StorageV3ArtifactState
    if (!ArtifactIdV3Schema.safeParse(row.artifact_id).success) fail()
    if (!(STORAGE_V3_ARTIFACT_KINDS as readonly string[]).includes(kind)) fail()
    if (!(STORAGE_V3_ARTIFACT_STATES as readonly string[]).includes(state)) fail()
    validateLocator(kind, row.relative_locator)
    if (kind === 'migration_backup_v1') {
      if (!/^[0-9a-f]{64}$/.test(row.manifest_sha256)) fail()
      if (row.relative_locator.endsWith('.sqlite.tmp')) {
        const finalLocator = row.relative_locator.slice(0, -4)
        const intentSha256 = storageV3MigrationBackupIntentSha256(row.artifact_id, finalLocator)
        if (row.content_sha256 !== intentSha256 || row.manifest_sha256 !== intentSha256) fail()
      }
    } else if (row.manifest_sha256 !== manifestSha256(kind, row.relative_locator)) fail()
    if (!/^[0-9a-f]{64}$/.test(row.content_sha256)) fail()
    if (kind === 'selected_store') {
      selectedStores += 1
      if (state !== 'active' || row.content_sha256 !== storageV3SelectedStoreContentSha256()) fail()
    }
    if (state === 'active') {
      if (row.deletion_operation_id !== null || row.deletion_scope_id !== null || row.deletion_week !== null) fail()
    } else if (
      !DeletionOperationIdV3Schema.safeParse(row.deletion_operation_id).success
      || !ScopeIdV3Schema.safeParse(row.deletion_scope_id).success
      || !IsoWeekV3Schema.safeParse(row.deletion_week).success
      || maintenance.state !== 'pending'
      || maintenance.operation_id !== row.deletion_operation_id
      || maintenance.scope_id !== row.deletion_scope_id
      || maintenance.event_week !== row.deletion_week
    ) fail()

    const owners = db.prepare(
      'SELECT scope_id FROM app_artifact_scope WHERE artifact_id = ? ORDER BY scope_id',
    ).pluck().all(row.artifact_id) as string[]
    if (kind !== 'selected_store' && state === 'active' && owners.length === 0) fail()
    for (const owner of owners) {
      if (!ScopeIdV3Schema.safeParse(owner).success) fail()
      if (!liveScopes.has(owner)) fail()
    }
  }
  if (selectedStores > 1) fail()
  if (maintenance.state === 'complete' && artifactRows(db).some(({ state }) => state !== 'active')) fail()
}

function assertSelectedStoreIdentity(db: Database.Database): void {
  if (!db?.open || db.inTransaction) fail()
  if (Number(db.prepare('PRAGMA application_id').pluck().get()) !== STORAGE_V3_SHADOW_APPLICATION_ID) fail()
  if (Number(db.prepare('PRAGMA user_version').pluck().get()) !== STORAGE_V3_SHADOW_USER_VERSION) fail()
  if (storageV3ShadowSchemaFingerprint(db) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT) fail()
}

function mintArtifactId(
  db: Database.Database,
  entropy: (size: number) => Buffer,
): string {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const bytes = entropy(32)
    if (!Buffer.isBuffer(bytes) || bytes.length !== 32) fail()
    const candidate = `art-${bytes.toString('hex')}`
    if (!db.prepare(
      'SELECT 1 FROM app_artifact WHERE artifact_id = ? UNION ALL SELECT 1 FROM lineage_event WHERE subject_id = ? LIMIT 1',
    ).get(candidate, candidate)) return candidate
  }
  return fail()
}

function insertArtifact(
  db: Database.Database,
  input: Readonly<{
    artifactId: string
    kind: StorageV3ArtifactKind
    locator: string
    scopeIds: readonly string[]
    contentSha256: string
  }>,
): void {
  validateLocator(input.kind, input.locator)
  const scopes = [...new Set(input.scopeIds)].sort()
  if (
    scopes.length !== input.scopeIds.length
    || (input.kind !== 'selected_store' && scopes.length === 0)
  ) fail()
  for (const scopeId of scopes) {
    if (!ScopeIdV3Schema.safeParse(scopeId).success) fail()
    if (!db.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(scopeId)) fail()
  }
  db.prepare(
    `INSERT INTO app_artifact (
      artifact_id, kind, state, manifest_sha256, content_sha256, relative_locator
    ) VALUES (?, ?, 'active', ?, ?, ?)`,
  ).run(
    input.artifactId,
    input.kind,
    manifestSha256(input.kind, input.locator),
    input.contentSha256,
    input.locator,
  )
  const insertOwner = db.prepare(
    'INSERT INTO app_artifact_scope (artifact_id, scope_id) VALUES (?, ?)',
  )
  for (const scopeId of scopes) insertOwner.run(input.artifactId, scopeId)
}

/** Internal factory seam: catalogue the selected DB before its proven file is published. */
export function registerSelectedStorageV3Artifact(
  db: Database.Database,
  root: StorageV3ArtifactRoot,
  entropy: (size: number) => Buffer = cryptoRandomBytes,
): string {
  bindStorageV3ArtifactRoot(db, root)
  assertSelectedStoreIdentity(db)
  assertStorageV3ArtifactCatalogue(db)
  if (artifactRows(db).some(({ kind }) => kind === 'selected_store')) fail()
  const primaryTemps = artifactRows(db).filter(({ kind }) => kind === 'migration_primary_temp')
  if (primaryTemps.length > 1) fail()
  if (primaryTemps.length === 1) {
    const primary = primaryTemps[0]
    if (!primary || primary.state !== 'active') return fail()
    if (db.prepare(
      `UPDATE app_artifact
       SET kind = 'selected_store', manifest_sha256 = ?, content_sha256 = ?, relative_locator = ?
       WHERE artifact_id = ? AND kind = 'migration_primary_temp' AND state = 'active'`,
    ).run(
      manifestSha256('selected_store', STORAGE_V3_ARTIFACT_LOCATORS.selectedStore),
      storageV3SelectedStoreContentSha256(),
      STORAGE_V3_ARTIFACT_LOCATORS.selectedStore,
      primary.artifact_id,
    ).changes !== 1) fail()
    assertStorageV3ArtifactCatalogue(db)
    return primary.artifact_id
  }
  const artifactId = mintArtifactId(db, entropy)
  const scopeIds = db.prepare('SELECT scope_id FROM claim_scope ORDER BY scope_id').pluck().all() as string[]
  db.transaction(() => insertArtifact(db, {
    artifactId,
    kind: 'selected_store',
    locator: STORAGE_V3_ARTIFACT_LOCATORS.selectedStore,
    scopeIds,
    contentSha256: storageV3SelectedStoreContentSha256(),
  }))()
  assertStorageV3ArtifactCatalogue(db)
  return artifactId
}

export interface RegisterStorageV3ArtifactOptions {
  readonly db: Database.Database
  readonly kind: Exclude<StorageV3ArtifactKind, 'selected_store'>
  readonly relativeLocator: string
  readonly scopeIds: readonly string[]
  readonly artifactId?: string
  readonly randomBytes?: (size: number) => Buffer
}

/** Register one existing, exact SQLite artifact under the store's bound root. */
export function registerStorageV3Artifact(
  options: RegisterStorageV3ArtifactOptions,
): Readonly<{ artifactId: string; state: 'active' }> {
  const { db, kind, relativeLocator, scopeIds } = options
  if (kind === 'migration_backup_v1') fail()
  assertSelectedStoreIdentity(db)
  assertStorageV3ArtifactCatalogue(db)
  if (readMaintenance(db).state !== 'complete') fail()
  const root = boundRoot(db)
  validateLocator(kind, relativeLocator)
  if (db.prepare('SELECT 1 FROM app_artifact WHERE relative_locator = ?').get(relativeLocator)) fail()
  const contentSha256 = quiesceStorageV3DatabaseFamily(root, relativeLocator, kind)
  const artifactId = options.artifactId ?? mintArtifactId(db, options.randomBytes ?? cryptoRandomBytes)
  if (!ArtifactIdV3Schema.safeParse(artifactId).success) fail()
  if (db.prepare(
    'SELECT 1 FROM app_artifact WHERE artifact_id = ? UNION ALL SELECT 1 FROM lineage_event WHERE subject_id = ? LIMIT 1',
  ).get(artifactId, artifactId)) fail()
  db.transaction(() => insertArtifact(db, {
    artifactId,
    kind,
    locator: relativeLocator,
    scopeIds,
    contentSha256,
  })).immediate()
  assertStorageV3ArtifactCatalogue(db)
  return Object.freeze({ artifactId, state: 'active' as const })
}

/** LIFE-03-only catalogue seam. Generic registration intentionally cannot supply a manifest hash. */
function registerStorageV3MigrationBackupArtifact(input: Readonly<{
  db: Database.Database
  artifactId: string
  relativeLocator: string
  scopeIds: readonly string[]
  contentSha256: string
  manifestSha256: string
}>): Readonly<{ artifactId: string; state: 'active' }> {
  const { db, artifactId, relativeLocator, scopeIds, contentSha256, manifestSha256: physicalManifestSha256 } = input
  assertSelectedStoreIdentity(db)
  assertStorageV3ArtifactCatalogue(db)
  if (readMaintenance(db).state !== 'complete') fail()
  if (!/^[a-f0-9]{64}$/.test(physicalManifestSha256) || !/^[a-f0-9]{64}$/.test(contentSha256)) fail()
  if (!ArtifactIdV3Schema.safeParse(artifactId).success) fail()
  validateLocator('migration_backup_v1', relativeLocator)
  boundRoot(db)
  if (db.prepare(
    'SELECT 1 FROM app_artifact WHERE artifact_id = ? OR relative_locator = ? UNION ALL SELECT 1 FROM lineage_event WHERE subject_id = ? LIMIT 1',
  ).get(artifactId, relativeLocator, artifactId)) fail()
  const scopes = [...scopeIds].sort()
  if (scopes.length === 0 || scopes.some((scope, index) => scope !== scopeIds[index] || !ScopeIdV3Schema.safeParse(scope).success)) fail()
  const liveScopes = db.prepare('SELECT scope_id FROM claim_scope ORDER BY scope_id').pluck().all() as string[]
  if (scopes.length !== liveScopes.length || scopes.some((scope, index) => scope !== liveScopes[index])) fail()
  if (relativeLocator.endsWith('.sqlite.tmp')) {
    const finalLocator = relativeLocator.slice(0, -4)
    const intentSha256 = storageV3MigrationBackupIntentSha256(artifactId, finalLocator)
    if (contentSha256 !== intentSha256 || physicalManifestSha256 !== intentSha256) fail()
  }
  db.transaction(() => {
    db.prepare(`INSERT INTO app_artifact (
      artifact_id, kind, state, manifest_sha256, content_sha256, relative_locator
    ) VALUES (?, 'migration_backup_v1', 'active', ?, ?, ?)`)
      .run(artifactId, physicalManifestSha256, contentSha256, relativeLocator)
    const insert = db.prepare('INSERT INTO app_artifact_scope (artifact_id, scope_id) VALUES (?, ?)')
    for (const scope of scopes) insert.run(artifactId, scope)
  }).immediate()
  assertStorageV3ArtifactCatalogue(db)
  return Object.freeze({ artifactId, state: 'active' as const })
}

export function beginStorageV3MigrationBackupArtifact(input: Readonly<{
  db: Database.Database
  artifactId: string
  finalLocator: string
  scopeIds: readonly string[]
}>): Readonly<{ artifactId: string; stagedLocator: string; placeholderSha256: string }> {
  const stagedLocator = `${input.finalLocator}.tmp`
  const placeholderSha256 = storageV3MigrationBackupIntentSha256(input.artifactId, input.finalLocator)
  registerStorageV3MigrationBackupArtifact({
    db: input.db, artifactId: input.artifactId, relativeLocator: stagedLocator,
    scopeIds: input.scopeIds, contentSha256: placeholderSha256, manifestSha256: placeholderSha256,
  })
  return Object.freeze({ artifactId: input.artifactId, stagedLocator, placeholderSha256 })
}

export function promoteStorageV3MigrationBackupArtifact(input: Readonly<{
  db: Database.Database
  artifactId: string
  stagedLocator: string
  finalLocator: string
  contentSha256: string
  manifestSha256: string
}>): void {
  validateLocator('migration_backup_v1', input.stagedLocator)
  validateLocator('migration_backup_v1', input.finalLocator)
  if (input.stagedLocator !== `${input.finalLocator}.tmp`) fail()
  if (!/^[a-f0-9]{64}$/.test(input.contentSha256) || !/^[a-f0-9]{64}$/.test(input.manifestSha256)) fail()
  const intentSha256 = storageV3MigrationBackupIntentSha256(input.artifactId, input.finalLocator)
  if (input.db.prepare(`UPDATE app_artifact SET relative_locator = ?, content_sha256 = ?, manifest_sha256 = ?
      WHERE artifact_id = ? AND kind = 'migration_backup_v1' AND state = 'active' AND relative_locator = ?
        AND content_sha256 = ? AND manifest_sha256 = ?`).run(
    input.finalLocator, input.contentSha256, input.manifestSha256, input.artifactId, input.stagedLocator,
    intentSha256, intentSha256,
  ).changes !== 1) fail()
  assertStorageV3ArtifactCatalogue(input.db)
}

/** Called inside B3's IMMEDIATE transaction before any owned scope rows disappear. */
export function scheduleStorageV3ArtifactsForScope(
  db: Database.Database,
  input: Readonly<{
    scopeId: string
    operationId: string
    eventWeek: string
  }>,
): number {
  if (!db.inTransaction) fail()
  assertStorageV3ArtifactCatalogue(db)
  if (readMaintenance(db).state !== 'complete') fail()
  if (
    !ScopeIdV3Schema.safeParse(input.scopeId).success
    || !DeletionOperationIdV3Schema.safeParse(input.operationId).success
    || !IsoWeekV3Schema.safeParse(input.eventWeek).success
  ) fail()
  const candidates = db.prepare(
    `SELECT artifact.artifact_id
     FROM app_artifact AS artifact
     JOIN app_artifact_scope AS owner ON owner.artifact_id = artifact.artifact_id
     WHERE owner.scope_id = ?
       AND artifact.kind <> 'selected_store'
       AND artifact.state = 'active'
     ORDER BY artifact.artifact_id`,
  ).pluck().all(input.scopeId) as string[]
  const schedule = db.prepare(
    `UPDATE app_artifact
     SET state = 'pending', deletion_operation_id = ?, deletion_scope_id = ?, deletion_week = ?
     WHERE artifact_id = ? AND state = 'active'`,
  )
  for (const artifactId of candidates) {
    if (schedule.run(input.operationId, input.scopeId, input.eventWeek, artifactId).changes !== 1) fail()
  }
  const maintenanceExists = db.prepare(
    'SELECT 1 FROM storage_maintenance_state WHERE singleton = 1',
  ).get() !== undefined
  if (maintenanceExists) {
    if (db.prepare(
      `UPDATE storage_maintenance_state
       SET state = 'pending', operation_id = ?, scope_id = ?, event_week = ?
       WHERE singleton = 1 AND state = 'complete'`,
    ).run(input.operationId, input.scopeId, input.eventWeek).changes !== 1) fail()
  } else {
    db.prepare(
      `INSERT INTO storage_maintenance_state (
        singleton, state, operation_id, scope_id, event_week
      ) VALUES (1, 'pending', ?, ?, ?)`,
    ).run(input.operationId, input.scopeId, input.eventWeek)
  }
  // Scope ownership is an actual FK. The durable marker plus each pending row's
  // deletion_scope_id carries recovery identity after the SQL scope disappears.
  db.prepare('DELETE FROM app_artifact_scope WHERE scope_id = ?').run(input.scopeId)
  return candidates.length
}

export const STORAGE_V3_ARTIFACT_DELETION_STAGES = [
  'markedDeleting',
  'sidecarsDeleted',
  'fileDeleted',
  'catalogueFinalized',
] as const
export type StorageV3ArtifactDeletionStage = typeof STORAGE_V3_ARTIFACT_DELETION_STAGES[number]

export interface CompleteStorageV3ArtifactDeletionOptions {
  readonly failAfterStage?: (
    stage: StorageV3ArtifactDeletionStage,
    completedArtifacts: number,
  ) => void
}

/**
 * Resume every persisted file phase.  Missing while `pending` is unexplained and
 * refused; missing while `deleting` is the exact crash-after-unlink recovery case.
 */
export function completeStorageV3ArtifactDeletions(
  db: Database.Database,
  options: CompleteStorageV3ArtifactDeletionOptions = {},
): number {
  if (db.inTransaction) fail()
  assertStorageV3ArtifactCatalogue(db)
  const maintenance = readMaintenance(db)
  if (maintenance.state === 'complete') return 0
  const pending = artifactRows(db).filter(({ state }) => state !== 'active')
  if (pending.length === 0) return 0
  const root = boundRoot(db)
  let completed = 0
  for (const original of pending) {
    let row = original
    const kind = row.kind as StorageV3ArtifactKind
    validateLocator(kind, row.relative_locator)
    const path = artifactPath(root, row.relative_locator)
    const backupFiles = kind === 'migration_backup_v1'
      ? inspectMigrationBackupFiles(root, row, row.state === 'deleting')
      : undefined
    if (row.state === 'pending') {
      if (backupFiles === undefined) {
        const entry = lstatEntry(path)
        if (entry === undefined || !entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1n) fail()
        if (physicalContentSha256(path, kind) !== row.content_sha256) fail()
      }
      db.transaction(() => {
        if (db.prepare(
          `UPDATE app_artifact SET state = 'deleting'
           WHERE artifact_id = ? AND state = 'pending'`,
        ).run(row.artifact_id).changes !== 1) fail()
      }).immediate()
      options.failAfterStage?.('markedDeleting', completed)
      row = { ...row, state: 'deleting' }
    }
    if (row.state !== 'deleting') fail()
    // A shared artifact may still have ordinary lineage owned by a surviving
    // scope. Reconcile that history before unlinking bytes so the final
    // scope-null index_deleted record cannot collide across scopes after a
    // crash or reopen.
    db.transaction(() => {
      db.prepare(
        `DELETE FROM lineage_event
         WHERE ((subject_kind = 'artifact' AND subject_id = ?) OR caused_by = ?)
           AND event_kind NOT IN ('tombstone_cascade', 'index_deleted', 'legacy_deletion_operation')`,
      ).run(row.artifact_id, row.artifact_id)
      if (db.prepare(
        `SELECT 1 FROM lineage_event
         WHERE ((subject_kind = 'artifact' AND subject_id = ?) OR caused_by = ?)
           AND event_kind NOT IN ('tombstone_cascade', 'index_deleted', 'legacy_deletion_operation')
         LIMIT 1`,
      ).get(row.artifact_id, row.artifact_id)) fail()
    }).immediate()
    if (backupFiles === undefined) {
      const entry = lstatEntry(path)
      if (entry !== undefined) {
        if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1n) fail()
        if (physicalContentSha256(path, kind) !== row.content_sha256) fail()
      }
    }
    const sidecarLocators = backupFiles === undefined
      ? [row.relative_locator]
      : [backupFiles.tempLocator, backupFiles.finalLocator]
    for (const locator of sidecarLocators) {
      for (const suffix of ['-shm', '-wal', '-journal']) safeRemoveExactFile(root, `${locator}${suffix}`)
    }
    options.failAfterStage?.('sidecarsDeleted', completed)
    if (backupFiles === undefined) safeRemoveExactFile(root, row.relative_locator)
    else removeMigrationBackupFiles(root, backupFiles)
    options.failAfterStage?.('fileDeleted', completed)
    if (backupFiles === undefined) {
      if (lstatEntry(path) !== undefined
        || ['-shm', '-wal', '-journal'].some((suffix) => lstatEntry(`${path}${suffix}`) !== undefined)) fail()
    } else {
      for (const locator of [
        backupFiles.tempLocator,
        backupFiles.finalLocator,
        backupFiles.manifestTempLocator,
        backupFiles.manifestFinalLocator,
      ]) if (lstatEntry(artifactPath(root, locator)) !== undefined) fail()
      for (const locator of [backupFiles.tempLocator, backupFiles.finalLocator]) {
        if (['-shm', '-wal', '-journal'].some((suffix) => lstatEntry(artifactPath(root, `${locator}${suffix}`)) !== undefined)) fail()
      }
    }
    db.transaction(() => {
      const current = db.prepare(
        `SELECT state, deletion_operation_id, deletion_scope_id, deletion_week
         FROM app_artifact WHERE artifact_id = ?`,
      ).get(row.artifact_id) as Record<string, unknown> | undefined
      if (
        current?.state !== 'deleting'
        || current.deletion_operation_id !== maintenance.operation_id
        || current.deletion_scope_id !== maintenance.scope_id
        || current.deletion_week !== maintenance.event_week
      ) fail()
      const existingDeletion = db.prepare(
        `SELECT operation_id, event_week FROM lineage_event
         WHERE scope_id IS NULL AND subject_kind = 'artifact' AND subject_id = ?
           AND event_kind = 'index_deleted'`,
      ).get(row.artifact_id) as { operation_id: string; event_week: string } | undefined
      if (existingDeletion === undefined) {
        db.prepare(
          `INSERT INTO lineage_event (
            scope_id, subject_kind, subject_id, operation_id, capability_id,
            caused_by, event_kind, event_week
          ) VALUES (NULL, 'artifact', ?, ?, 'github.core', ?, 'index_deleted', ?)`,
        ).run(row.artifact_id, maintenance.operation_id, maintenance.scope_id, maintenance.event_week)
      } else if (
        existingDeletion.operation_id !== maintenance.operation_id
        || existingDeletion.event_week !== maintenance.event_week
      ) fail()
      db.prepare('DELETE FROM app_artifact_scope WHERE artifact_id = ?').run(row.artifact_id)
      if (db.prepare(
        "DELETE FROM app_artifact WHERE artifact_id = ? AND state = 'deleting'",
      ).run(row.artifact_id).changes !== 1) fail()
    }).immediate()
    completed += 1
    options.failAfterStage?.('catalogueFinalized', completed)
  }
  assertStorageV3ArtifactCatalogue(db)
  return completed
}

/** Remove the compacted scope from the selected-store ownership set, idempotently. */
export function finalizeSelectedStorageV3ScopeOwnership(db: Database.Database): void {
  if (!db.inTransaction) fail()
  const maintenance = readMaintenance(db)
  if (maintenance.state !== 'pending' || maintenance.scope_id === null) fail()
  db.prepare(
    `DELETE FROM app_artifact_scope
     WHERE scope_id = ? AND artifact_id IN (
       SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store'
     )`,
  ).run(maintenance.scope_id)
}

export function markStorageV3MaintenanceComplete(db: Database.Database): void {
  if (!db.inTransaction) fail()
  if (artifactRows(db).some(({ state }) => state !== 'active')) fail()
  if (db.prepare(
    `UPDATE storage_maintenance_state
     SET state = 'complete', operation_id = NULL, scope_id = NULL, event_week = NULL
     WHERE singleton = 1 AND state = 'pending'`,
  ).run().changes !== 1) fail()
}

/** Selection requires the one published selected-store catalogue row. */
export function assertPublishedStorageV3ArtifactCatalogue(db: Database.Database): void {
  assertStorageV3ArtifactCatalogue(db)
  const rows = db.prepare(
    `SELECT artifact_id, state, manifest_sha256, content_sha256, relative_locator
     FROM app_artifact WHERE kind = 'selected_store'`,
  ).all() as Array<Record<string, unknown>>
  if (rows.length !== 1) fail()
  const row = rows[0]
  if (
    row?.state !== 'active'
    || row.relative_locator !== STORAGE_V3_ARTIFACT_LOCATORS.selectedStore
    || row.manifest_sha256 !== manifestSha256('selected_store', STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
    || row.content_sha256 !== storageV3SelectedStoreContentSha256()
  ) fail()
}
