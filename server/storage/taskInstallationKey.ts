import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  type BigIntStats,
} from 'node:fs'
import { link, lstat, open, readdir, realpath, unlink, type FileHandle } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import {
  createInstallationAliases,
  type InstallationAliases,
} from './installationAliases.js'
import { isCanonicalTaskId } from '../taskId.js'
import {
  assertGithubCoreActivationGrant,
  type GithubCoreActivationGrant,
} from '../connectors/github/activationGrant.js'

export const TASK_INSTALLATION_KEY_ERROR_CODE = 'INVALID_TASK_INSTALLATION_KEY' as const
/**
 * Setup publishes by no-clobber hard link. A task root on a filesystem without hard links (some
 * FAT/exFAT, network, or container mounts) cannot host a key; this distinct content-free code lets a
 * caller report that instead of a generic invalid-key refusal. Nothing is published in that case.
 */
export const TASK_INSTALLATION_KEY_UNSUPPORTED_FILESYSTEM_CODE =
  'TASK_INSTALLATION_KEY_UNSUPPORTED_FILESYSTEM' as const
/**
 * `link` was refused for a reason the errno cannot attribute: EPERM covers both a filesystem without
 * hard links and an ordinary permission/ACL/lock refusal, and EXDEV inside one task directory means
 * the two names resolved to different volumes (a mount or path swap), not a capability fact. Nothing
 * is published; the caller must investigate rather than assume an unsupported filesystem.
 */
export const TASK_INSTALLATION_KEY_LINK_REFUSED_CODE = 'TASK_INSTALLATION_KEY_LINK_REFUSED' as const
export type TaskInstallationKeyErrorCode =
  | typeof TASK_INSTALLATION_KEY_ERROR_CODE
  | typeof TASK_INSTALLATION_KEY_UNSUPPORTED_FILESYSTEM_CODE
  | typeof TASK_INSTALLATION_KEY_LINK_REFUSED_CODE
/** errno values that do mean "this filesystem cannot create the hard link". */
const HARD_LINK_UNSUPPORTED_ERRNOS = new Set(['ENOTSUP', 'EOPNOTSUPP', 'ENOSYS'])
/** errno values where `link` was refused but the cause is ambiguous; see LINK_REFUSED above. */
const HARD_LINK_REFUSED_ERRNOS = new Set(['EPERM', 'EXDEV'])

const INSTALLATION_KEY_BYTES = 32
const INSTALLATION_KEY_SIZE = 32n
const INSTALLATION_KEY_FILE = 'installation-key.bin'
const NON_BLOCKING_FLAG = constants.O_NONBLOCK ?? 0
const NO_FOLLOW_FLAG = constants.O_NOFOLLOW ?? 0
const DIRECTORY_FLAG = constants.O_DIRECTORY ?? 0
const RESTRICTIVE_FILE_MODE = 0o600
/** Task-owned staging names: one random, never-reused name per setup invocation (#59). */
const STAGING_NAME_PATTERN = /^\.installation-key\.bin\.[0-9a-f]{32}\.staging$/

/**
 * Default-off continuity foundation only.
 *
 * A bare expected fingerprint is only an integrity assertion because callers can copy it from an
 * inspection handle. Continuity authorization requires fresh setup or a separately issued opaque
 * source grant; there is still no production grant issuer or backup caller.
 */
export class TaskInstallationKeyError extends Error {
  readonly code: TaskInstallationKeyErrorCode

  constructor(code: TaskInstallationKeyErrorCode = TASK_INSTALLATION_KEY_ERROR_CODE) {
    super(code)
    this.name = 'TaskInstallationKeyError'
    this.code = code
  }
}

export type TaskInstallationKeySetupInput = Readonly<{
  workspaceRoot: string
  taskId: string
}>

export type TaskInstallationKeyLoadInput = Readonly<{
  workspaceRoot: string
  taskId: string
  expectedFingerprint?: string
}>

export type GithubCoreTaskInstallationKeyLoadInput = Readonly<{
  workspaceRoot: string
  grant: GithubCoreActivationGrant
}>

export type TaskInstallationKeyHandle = Readonly<{
  taskId: string
  fingerprint: string
  aliases: InstallationAliases
}>

type HandleRecord = Readonly<{
  key: Buffer
  keyPath: string
  taskDirectory: DirectoryIdentity
}>

const HANDLE_KEYS = new WeakMap<object, HandleRecord>()
/** Private capability: only a fresh setup or anchored reload may sign durable backup material. */
const CONTINUITY_AUTHORIZED_HANDLES = new WeakSet<object>()
const TASK_INSTALLATION_BINDING_DOMAIN = 'developer-lens.storage-v3-backup-key-binding.v1' as const

type ClosedInput = Readonly<{
  workspaceRoot: string
  taskId: string
  expectedFingerprint?: string
}>

type PortableIdentity = Readonly<{
  dev: bigint
  ino: bigint
}>

type DirectoryIdentity = PortableIdentity & Readonly<{
  path: string
}>

type CanonicalKeyPath = Readonly<{
  taskId: string
  keyPath: string
  directories: readonly DirectoryIdentity[]
}>

type InternalHooks = Readonly<{
  beforeOpen?: () => void | Promise<void>
  afterOpen?: () => void | Promise<void>
  afterFirstRead?: () => void | Promise<void>
}>

type RandomBytesSource = (size: number) => Buffer

/** Fault-injection checkpoints of the staged setup protocol (#59); production passes none. */
export type TaskInstallationKeySetupCheckpoint =
  | 'after-staging-open'
  | 'after-partial-write'
  | 'after-sync'
  | 'after-verify'
  | 'after-close'
  | 'before-publish'
  | 'after-publish'
  | 'after-staging-unlink'
  | 'after-directory-sync'

type SetupFaults = Readonly<{
  checkpoint?: (
    name: TaskInstallationKeySetupCheckpoint,
    paths: Readonly<{ stagingPath: string; keyPath: string }>,
  ) => void | Promise<void>
  /** Simulates a close that reports failure after the descriptor was released. */
  closeFails?: boolean
  /** Simulates `link()` failing with this errno instead of publishing. */
  linkErrorCode?: string
}>

const NO_HOOKS: InternalHooks = Object.freeze({})
const NO_FAULTS: SetupFaults = Object.freeze({})

function invalidKey(): never {
  throw new TaskInstallationKeyError()
}

function ownDataValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalidKey()
  return descriptor.value
}

function snapshotClosedInput(value: unknown, allowExpectedFingerprint: boolean): ClosedInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidKey()
  const keys = Reflect.ownKeys(value)
  const expectedKeys = allowExpectedFingerprint && keys.includes('expectedFingerprint') ? 3 : 2
  if (
    keys.length !== expectedKeys ||
    !keys.includes('workspaceRoot') ||
    !keys.includes('taskId') ||
    keys.some((key) => typeof key !== 'string' || !['workspaceRoot', 'taskId', 'expectedFingerprint'].includes(key))
  ) {
    invalidKey()
  }

  const workspaceRoot = ownDataValue(value, 'workspaceRoot')
  const taskId = ownDataValue(value, 'taskId')
  if (typeof workspaceRoot !== 'string' || typeof taskId !== 'string') invalidKey()

  if (!keys.includes('expectedFingerprint')) return { workspaceRoot, taskId }
  if (!allowExpectedFingerprint) invalidKey()
  const expectedFingerprint = ownDataValue(value, 'expectedFingerprint')
  if (typeof expectedFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(expectedFingerprint)) {
    invalidKey()
  }
  return { workspaceRoot, taskId, expectedFingerprint }
}

function snapshotGithubCoreGrantInput(value: unknown): Readonly<{
  workspaceRoot: string
  grant: GithubCoreActivationGrant
}> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidKey()
  const keys = Reflect.ownKeys(value)
  if (keys.length !== 2 || !keys.includes('workspaceRoot') || !keys.includes('grant')
    || keys.some((key) => typeof key !== 'string' || !['workspaceRoot', 'grant'].includes(key))) {
    invalidKey()
  }
  const grantValue = ownDataValue(value, 'grant')
  let grant: GithubCoreActivationGrant
  try {
    grant = assertGithubCoreActivationGrant(grantValue)
  } catch {
    return invalidKey()
  }
  const workspaceRoot = ownDataValue(value, 'workspaceRoot')
  if (typeof workspaceRoot !== 'string') invalidKey()
  return Object.freeze({ workspaceRoot, grant })
}

function portableIdentityMatches(left: PortableIdentity, right: PortableIdentity): boolean {
  const leftAvailable = left.dev !== 0n || left.ino !== 0n
  const rightAvailable = right.dev !== 0n || right.ino !== 0n
  return leftAvailable && rightAvailable && left.dev === right.dev && left.ino === right.ino
}

function assertRegularKeyFile(stats: BigIntStats, expectedSize: bigint): void {
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size !== expectedSize || stats.nlink !== 1n) {
    invalidKey()
  }
  if (process.platform !== 'win32' && (stats.mode & 0o077n) !== 0n) invalidKey()
}

function stableFileStateMatches(left: BigIntStats, right: BigIntStats): boolean {
  return portableIdentityMatches(left, right) &&
    left.size === right.size &&
    left.nlink === right.nlink &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
}

function assertCurrentKeyFileMatches(record: HandleRecord): void {
  let descriptor: number | undefined
  const firstRead = Buffer.alloc(INSTALLATION_KEY_BYTES)
  const secondRead = Buffer.alloc(INSTALLATION_KEY_BYTES)
  const overflow = Buffer.alloc(1)
  try {
    const before = lstatSync(record.keyPath, { bigint: true })
    assertRegularKeyFile(before, INSTALLATION_KEY_SIZE)
    descriptor = openSync(
      record.keyPath,
      constants.O_RDONLY | NON_BLOCKING_FLAG | NO_FOLLOW_FLAG,
    )
    const opened = fstatSync(descriptor, { bigint: true })
    assertRegularKeyFile(opened, INSTALLATION_KEY_SIZE)
    if (!stableFileStateMatches(before, opened)) invalidKey()
    for (const bytes of [firstRead, secondRead]) {
      let offset = 0
      while (offset < bytes.length) {
        const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset)
        if (count === 0) invalidKey()
        offset += count
      }
      if (readSync(descriptor, overflow, 0, overflow.length, INSTALLATION_KEY_BYTES) !== 0) invalidKey()
      const observed = fstatSync(descriptor, { bigint: true })
      if (!stableFileStateMatches(opened, observed)) invalidKey()
    }
    const after = lstatSync(record.keyPath, { bigint: true })
    if (!stableFileStateMatches(opened, after)
      || !timingSafeEqual(firstRead, secondRead)
      || !timingSafeEqual(firstRead, record.key)) invalidKey()
  } catch (error) {
    if (error instanceof TaskInstallationKeyError) throw error
    return invalidKey()
  } finally {
    let closeFailed = false
    if (descriptor !== undefined) {
      try { closeSync(descriptor) } catch { closeFailed = true }
    }
    firstRead.fill(0)
    secondRead.fill(0)
    overflow.fill(0)
    if (closeFailed) invalidKey()
  }
}

async function captureCanonicalDirectory(path: string): Promise<DirectoryIdentity> {
  const before = await lstat(path, { bigint: true })
  const canonical = await realpath(path)
  const after = await lstat(path, { bigint: true })
  if (
    !before.isDirectory() || before.isSymbolicLink() ||
    !after.isDirectory() || after.isSymbolicLink() ||
    canonical !== path ||
    !portableIdentityMatches(before, after)
  ) {
    invalidKey()
  }
  return Object.freeze({ path, dev: after.dev, ino: after.ino })
}

async function resolveCanonicalKeyPath(input: ClosedInput): Promise<CanonicalKeyPath> {
  if (
    input.workspaceRoot.length === 0 ||
    !isAbsolute(input.workspaceRoot) ||
    resolve(input.workspaceRoot) !== input.workspaceRoot ||
    !isCanonicalTaskId(input.taskId)
  ) {
    invalidKey()
  }

  const canonicalWorkspaceRoot = await realpath(input.workspaceRoot)
  if (canonicalWorkspaceRoot !== input.workspaceRoot) invalidKey()

  const developerLensDirectory = join(canonicalWorkspaceRoot, '.developer-lens')
  const activationDirectory = join(developerLensDirectory, 'activation')
  const taskDirectory = join(activationDirectory, input.taskId)
  const keyPath = join(taskDirectory, INSTALLATION_KEY_FILE)
  const expectedRelativePath = join(
    '.developer-lens',
    'activation',
    input.taskId,
    INSTALLATION_KEY_FILE,
  )
  if (relative(canonicalWorkspaceRoot, keyPath) !== expectedRelativePath) invalidKey()

  const directories: DirectoryIdentity[] = []
  for (const directory of [
    canonicalWorkspaceRoot,
    developerLensDirectory,
    activationDirectory,
    taskDirectory,
  ]) {
    directories.push(await captureCanonicalDirectory(directory))
  }
  return Object.freeze({ taskId: input.taskId, keyPath, directories: Object.freeze(directories) })
}

async function assertDirectoryIdentities(path: CanonicalKeyPath): Promise<void> {
  for (const expected of path.directories) {
    const actual = await captureCanonicalDirectory(expected.path)
    if (!portableIdentityMatches(expected, actual)) invalidKey()
  }
}

async function assertKeyPathMissing(path: CanonicalKeyPath): Promise<void> {
  await assertDirectoryIdentities(path)
  try {
    await lstat(path.keyPath, { bigint: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  invalidKey()
}

async function assertHandleMatchesPath(
  handle: FileHandle,
  path: CanonicalKeyPath,
  expectedSize: bigint,
  filePath: string = path.keyPath,
): Promise<BigIntStats> {
  await assertDirectoryIdentities(path)
  const [handleStats, pathStats, canonicalPath] = await Promise.all([
    handle.stat({ bigint: true }),
    lstat(filePath, { bigint: true }),
    realpath(filePath),
  ])
  assertRegularKeyFile(handleStats, expectedSize)
  assertRegularKeyFile(pathStats, expectedSize)
  if (canonicalPath !== filePath || !portableIdentityMatches(handleStats, pathStats)) invalidKey()
  await assertDirectoryIdentities(path)
  return handleStats
}

async function writeExactly(handle: FileHandle, bytes: Buffer, position = 0): Promise<void> {
  let offset = 0
  while (offset < bytes.length) {
    const result = await handle.write(bytes, offset, bytes.length - offset, position + offset)
    if (result.bytesWritten === 0) invalidKey()
    offset += result.bytesWritten
  }
}

function assertPortableIdentityAvailable(identity: PortableIdentity): void {
  if (identity.dev === 0n && identity.ino === 0n) invalidKey()
}

/**
 * Prove that one confined name is still exactly the file this module created: regular, not a link,
 * the expected size and link count, owner-only on POSIX, and the same portable identity.
 */
async function assertPathHoldsIdentity(
  path: CanonicalKeyPath,
  filePath: string,
  identity: PortableIdentity,
  expectedLinks: bigint,
): Promise<BigIntStats> {
  await assertDirectoryIdentities(path)
  const [stats, canonicalPath] = await Promise.all([
    lstat(filePath, { bigint: true }),
    realpath(filePath),
  ])
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size !== INSTALLATION_KEY_SIZE
    || stats.nlink !== expectedLinks || canonicalPath !== filePath
    || !portableIdentityMatches(stats, identity)) invalidKey()
  if (process.platform !== 'win32' && (stats.mode & 0o077n) !== 0n) invalidKey()
  await assertDirectoryIdentities(path)
  return stats
}

/**
 * Remove one task-owned name only while it still names `identity`. Returns false, leaving the
 * name untouched, when it now names anything else. Node exposes no unlink-by-descriptor, so this is
 * check-then-act: it is only ever applied to a random staging name reserved by this module, never
 * to the key path, so a lost race can at worst remove a foreign file squatting on that reserved
 * name — never the published key.
 */
async function unlinkNameIfIdentity(filePath: string, identity: PortableIdentity): Promise<boolean> {
  let stats: BigIntStats
  try {
    stats = await lstat(filePath, { bigint: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
    throw error
  }
  if (!stats.isFile() || stats.isSymbolicLink() || !portableIdentityMatches(stats, identity)) return false
  await unlink(filePath)
  return true
}

/**
 * Make a directory-entry change durable where the platform allows it. Windows cannot open a
 * directory for fsync through Node (EPERM), so publication there relies on NTFS metadata journaling;
 * that limitation is documented rather than emulated.
 */
async function syncTaskDirectory(directory: DirectoryIdentity): Promise<void> {
  if (process.platform === 'win32') return
  const handle = await open(directory.path, constants.O_RDONLY | DIRECTORY_FLAG | NO_FOLLOW_FLAG)
  try {
    const stats = await handle.stat({ bigint: true })
    if (!stats.isDirectory() || !portableIdentityMatches(stats, directory)) invalidKey()
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function readExactKey(handle: FileHandle): Promise<Buffer> {
  const bytes = Buffer.alloc(INSTALLATION_KEY_BYTES)
  const extra = Buffer.alloc(1)
  try {
    let offset = 0
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset)
      if (result.bytesRead === 0) invalidKey()
      offset += result.bytesRead
    }
    const overflow = await handle.read(extra, 0, extra.length, INSTALLATION_KEY_BYTES)
    if (overflow.bytesRead !== 0) invalidKey()
    return bytes
  } catch (error) {
    bytes.fill(0)
    throw error
  } finally {
    extra.fill(0)
  }
}

function createOpaqueHandle(
  path: CanonicalKeyPath,
  key: Buffer,
  expectedFingerprint?: string,
  continuityAuthorized = false,
): TaskInstallationKeyHandle {
  const fingerprint = createHash('sha256').update(key).digest('hex')
  if (expectedFingerprint !== undefined) {
    const expected = Buffer.from(expectedFingerprint, 'ascii')
    const actual = Buffer.from(fingerprint, 'ascii')
    try {
      if (!timingSafeEqual(actual, expected)) invalidKey()
    } finally {
      expected.fill(0)
      actual.fill(0)
    }
  }
  const aliases = createInstallationAliases(key)
  for (const aliasFunction of Object.values(aliases)) Object.freeze(aliasFunction)
  const handle = Object.freeze({ taskId: path.taskId, fingerprint, aliases: Object.freeze(aliases) })
  const taskDirectory = path.directories.at(-1)
  if (taskDirectory === undefined) invalidKey()
  HANDLE_KEYS.set(handle, Object.freeze({ key: Buffer.from(key), keyPath: path.keyPath, taskDirectory }))
  if (continuityAuthorized) CONTINUITY_AUTHORIZED_HANDLES.add(handle)
  return handle
}

export type TaskInstallationKeyDirectoryIdentity = Readonly<{
  path: string
  dev: bigint
  ino: bigint
}>

/** Prove that this opaque handle was freshly created or loaded against its reviewed fingerprint. */
export function assertTaskInstallationKeyContinuity(handle: TaskInstallationKeyHandle): void {
  if (!handle || typeof handle !== 'object'
    || !HANDLE_KEYS.has(handle) || !CONTINUITY_AUTHORIZED_HANDLES.has(handle)) invalidKey()
  assertCurrentKeyFileMatches(HANDLE_KEYS.get(handle) ?? invalidKey())
}

/**
 * Prove that a handle was issued by this module and that its task key file still exists with the
 * same bytes. Integrity only: it never grants backup continuity authority. A deleted, replaced, or
 * rotated key therefore stops a cached handle from minting aliases for any later write.
 */
export function assertTaskInstallationKeyHandleCurrent(handle: TaskInstallationKeyHandle): void {
  if (!handle || typeof handle !== 'object') invalidKey()
  const record = HANDLE_KEYS.get(handle) ?? invalidKey()
  if (handle.fingerprint !== createHash('sha256').update(record.key).digest('hex')) invalidKey()
  assertCurrentKeyFileMatches(record)
}

/** Prove that an opaque handle was loaded from this exact canonical task directory. */
export function assertTaskInstallationKeyTaskDirectory(
  handle: TaskInstallationKeyHandle,
  directory: TaskInstallationKeyDirectoryIdentity,
): void {
  if (!handle || typeof handle !== 'object' || !directory || typeof directory !== 'object') invalidKey()
  const record = HANDLE_KEYS.get(handle)
  if (record === undefined
    || !isCanonicalTaskId(handle.taskId)
    || directory.path !== record.taskDirectory.path
    || !portableIdentityMatches(directory, record.taskDirectory)) invalidKey()
}

/** Bind one canonical body digest to the opaque task key; no raw-key or general HMAC oracle. */
export function bindTaskInstallationKeyBody(
  handle: TaskInstallationKeyHandle,
  bodySha256: string,
): string {
  if (!handle || typeof handle !== 'object' || !/^[a-f0-9]{64}$/.test(bodySha256)) invalidKey()
  assertTaskInstallationKeyContinuity(handle)
  const record = HANDLE_KEYS.get(handle)
  if (!record || handle.fingerprint !== createHash('sha256').update(record.key).digest('hex')) invalidKey()
  try {
    return createHmac('sha256', record.key)
      .update(`${TASK_INSTALLATION_BINDING_DOMAIN}\0${bodySha256}`, 'utf8')
      .digest('hex')
  } finally {
    // Keep the opaque handle useful for its lifetime, but never expose the key bytes.
  }
}

export const bindTaskInstallationKeyHandle = bindTaskInstallationKeyBody

/**
 * #59 staged, task-owned creation. The key is written to a random staging name reserved for this
 * invocation, synced, read back, and closed; only then is it published with a no-clobber hard link
 * (`link` fails with EEXIST, so an existing or raced key is never overwritten). The staging name is
 * removed only while it still names the exact file this invocation created, and the key path is
 * never unlinked on any path. A failure before publication therefore leaves no key and lets a retry
 * start clean; a failure after publication leaves one complete, verified key that `load` reads
 * (and `recoverTaskInstallationKeyPublication` finishes if a crash left the staging link behind).
 *
 * Limits, stated rather than emulated: Node has no unlink-by-descriptor and no atomic
 * check-and-link, so identity checks around `link`/`unlink` are check-then-act. A same-principal
 * writer racing inside that window can at worst get a swapped staging file linked under the key
 * name, which the post-link identity check refuses and every reader rejects (two links), or have its
 * own file removed from our reserved random staging name; the key path is never unlinked. Windows
 * adds three gaps: no directory fsync (Node returns EPERM, so entry durability relies on NTFS
 * journaling), no `O_NOFOLLOW` (symlinks are refused through lstat/realpath checks instead), and no
 * POSIX mode bits (an owner-only ACL is not verified; the #6 follow-up keeps that as an activation
 * precondition). File identity is volume serial plus file index; a zero identity fails closed.
 * Publication requires hard-link support in the task root's filesystem: where `link` reports
 * ENOTSUP/EOPNOTSUPP/ENOSYS, setup publishes nothing and refuses with the distinct content-free
 * TASK_INSTALLATION_KEY_UNSUPPORTED_FILESYSTEM code; EPERM/EXDEV refuse with
 * TASK_INSTALLATION_KEY_LINK_REFUSED because those errnos do not prove the capability is absent.
 */
async function setupTaskInstallationKeyCore(
  input: TaskInstallationKeySetupInput,
  randomBytesSource: RandomBytesSource,
  faults: SetupFaults,
): Promise<TaskInstallationKeyHandle> {
  let generated: Buffer | undefined
  let key: Buffer | undefined
  let verification: Buffer | undefined
  let staging: FileHandle | undefined
  let stagingPath: string | undefined
  let stagingIdentity: PortableIdentity | undefined
  let stagingRemoved = false
  let taskDirectory: DirectoryIdentity | undefined
  let published = false
  try {
    const closedInput = snapshotClosedInput(input, false)
    const path = await resolveCanonicalKeyPath(closedInput)
    taskDirectory = path.directories.at(-1) ?? invalidKey()
    await assertKeyPathMissing(path)

    const candidate = randomBytesSource(INSTALLATION_KEY_BYTES)
    if (!Buffer.isBuffer(candidate)) invalidKey()
    generated = candidate
    if (generated.length !== INSTALLATION_KEY_BYTES) invalidKey()
    key = Buffer.from(generated)

    const stagingName = `.${INSTALLATION_KEY_FILE}.${randomBytes(16).toString('hex')}.staging`
    const ownedStagingPath = join(taskDirectory.path, stagingName)
    if (!STAGING_NAME_PATTERN.test(stagingName)
      || relative(taskDirectory.path, ownedStagingPath) !== stagingName
      || basename(ownedStagingPath) !== stagingName) invalidKey()
    const paths = Object.freeze({ stagingPath: ownedStagingPath, keyPath: path.keyPath })
    const checkpoint = async (name: TaskInstallationKeySetupCheckpoint): Promise<void> => {
      if (faults.checkpoint) await faults.checkpoint(name, paths)
    }

    await assertDirectoryIdentities(path)
    staging = await open(
      ownedStagingPath,
      constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | NON_BLOCKING_FLAG | NO_FOLLOW_FLAG,
      RESTRICTIVE_FILE_MODE,
    )
    stagingPath = ownedStagingPath
    const opened = await staging.stat({ bigint: true })
    assertPortableIdentityAvailable(opened)
    // Every later cleanup decision is bound to this exact identity, captured from our descriptor.
    stagingIdentity = Object.freeze({ dev: opened.dev, ino: opened.ino })
    await checkpoint('after-staging-open')

    const created = await assertHandleMatchesPath(staging, path, 0n, ownedStagingPath)
    if (!portableIdentityMatches(created, stagingIdentity)) invalidKey()
    if (process.platform !== 'win32') await staging.chmod(RESTRICTIVE_FILE_MODE)

    const half = INSTALLATION_KEY_BYTES / 2
    await writeExactly(staging, key.subarray(0, half), 0)
    await checkpoint('after-partial-write')
    await writeExactly(staging, key.subarray(half), half)
    await staging.sync()
    await checkpoint('after-sync')

    const written = await assertHandleMatchesPath(staging, path, INSTALLATION_KEY_SIZE, ownedStagingPath)
    verification = await readExactKey(staging)
    const verified = await assertHandleMatchesPath(staging, path, INSTALLATION_KEY_SIZE, ownedStagingPath)
    if (!portableIdentityMatches(written, stagingIdentity)
      || !stableFileStateMatches(written, verified)
      || !timingSafeEqual(key, verification)) invalidKey()
    await checkpoint('after-verify')

    const closing = staging
    staging = undefined
    await closing.close()
    if (faults.closeFails) invalidKey()
    await checkpoint('after-close')

    // Publication: a complete, synced, verified, closed file gains the key name without clobbering.
    await assertKeyPathMissing(path)
    await assertPathHoldsIdentity(path, ownedStagingPath, stagingIdentity, 1n)
    await checkpoint('before-publish')
    try {
      if (faults.linkErrorCode !== undefined) {
        throw Object.assign(new Error('INJECTED_LINK_FAILURE'), { code: faults.linkErrorCode })
      }
      await link(ownedStagingPath, path.keyPath)
    } catch (error) {
      const errno = (error as NodeJS.ErrnoException).code
      if (errno !== undefined && HARD_LINK_UNSUPPORTED_ERRNOS.has(errno)) {
        throw new TaskInstallationKeyError(TASK_INSTALLATION_KEY_UNSUPPORTED_FILESYSTEM_CODE)
      }
      if (errno !== undefined && HARD_LINK_REFUSED_ERRNOS.has(errno)) {
        throw new TaskInstallationKeyError(TASK_INSTALLATION_KEY_LINK_REFUSED_CODE)
      }
      throw error
    }
    published = true
    await checkpoint('after-publish')
    await assertPathHoldsIdentity(path, path.keyPath, stagingIdentity, 2n)

    if (!await unlinkNameIfIdentity(ownedStagingPath, stagingIdentity)) invalidKey()
    stagingRemoved = true
    await checkpoint('after-staging-unlink')
    await assertPathHoldsIdentity(path, path.keyPath, stagingIdentity, 1n)
    await syncTaskDirectory(taskDirectory)
    await checkpoint('after-directory-sync')

    // End to end: the published name reads back as exactly the generated bytes.
    assertCurrentKeyFileMatches(Object.freeze({ key, keyPath: path.keyPath, taskDirectory }))
    await assertPathHoldsIdentity(path, path.keyPath, stagingIdentity, 1n)
    return createOpaqueHandle(path, key, undefined, true)
  } catch (error) {
    const refusal = error instanceof TaskInstallationKeyError
      && (error.code === TASK_INSTALLATION_KEY_UNSUPPORTED_FILESYSTEM_CODE
        || error.code === TASK_INSTALLATION_KEY_LINK_REFUSED_CODE)
      ? new TaskInstallationKeyError(error.code)
      : new TaskInstallationKeyError()
    await abandonIncompleteCreation({
      staging,
      stagingPath: stagingRemoved ? undefined : stagingPath,
      stagingIdentity,
      taskDirectory: published ? taskDirectory : undefined,
    })
    throw refusal
  } finally {
    generated?.fill(0)
    key?.fill(0)
    verification?.fill(0)
  }
}

/**
 * Best-effort, identity-bound cleanup of one failed invocation. It closes the owned descriptor,
 * removes the staging name only while it still names the file this invocation created, and re-syncs
 * the directory after a publication. It never unlinks the key path and never throws, so the caller
 * always reports the same content-free error.
 */
async function abandonIncompleteCreation(owned: Readonly<{
  staging: FileHandle | undefined
  stagingPath: string | undefined
  stagingIdentity: PortableIdentity | undefined
  taskDirectory: DirectoryIdentity | undefined
}>): Promise<void> {
  if (owned.staging) {
    try { await owned.staging.close() } catch { /* the descriptor is released either way */ }
  }
  if (owned.stagingPath !== undefined && owned.stagingIdentity !== undefined) {
    try { await unlinkNameIfIdentity(owned.stagingPath, owned.stagingIdentity) } catch { /* left for task-root deletion */ }
  }
  if (owned.taskDirectory !== undefined) {
    try { await syncTaskDirectory(owned.taskDirectory) } catch { /* durability stays best-effort */ }
  }
}

/**
 * Finish a publication that a crash interrupted between the no-clobber link and the staging unlink
 * (the key then has a second link, which every reader refuses). Only a task-owned staging name that
 * is provably a second link of the published key file is removed, so the key bytes stay reachable
 * through the key path throughout; the key path itself is never touched. Unpublished staging debris
 * is not provably this invocation's and stays inert until task-root deletion. Recovery grants no
 * continuity authority: callers load the key and verify its fingerprint against a reviewed value.
 */
async function recoverTaskInstallationKeyPublicationCore(input: TaskInstallationKeySetupInput): Promise<void> {
  try {
    const closedInput = snapshotClosedInput(input, false)
    const path = await resolveCanonicalKeyPath(closedInput)
    const taskDirectory = path.directories.at(-1) ?? invalidKey()
    let published: BigIntStats
    try {
      published = await lstat(path.keyPath, { bigint: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    if (!published.isFile() || published.isSymbolicLink() || published.size !== INSTALLATION_KEY_SIZE) invalidKey()
    assertPortableIdentityAvailable(published)
    const identity = Object.freeze({ dev: published.dev, ino: published.ino })
    if (published.nlink !== 1n) {
      for (const name of await readdir(taskDirectory.path)) {
        if (!STAGING_NAME_PATTERN.test(name)) continue
        const candidate = join(taskDirectory.path, name)
        if (relative(taskDirectory.path, candidate) !== name) invalidKey()
        const stats = await lstat(candidate, { bigint: true })
        if (!portableIdentityMatches(stats, identity)) continue
        await unlinkNameIfIdentity(candidate, identity)
      }
      await syncTaskDirectory(taskDirectory)
    }
    await assertPathHoldsIdentity(path, path.keyPath, identity, 1n)
  } catch (error) {
    if (error instanceof TaskInstallationKeyError) throw error
    invalidKey()
  }
}

async function loadTaskInstallationKeyCore(
  input: TaskInstallationKeyLoadInput,
  hooks: InternalHooks,
  continuityAuthorized = false,
): Promise<TaskInstallationKeyHandle> {
  let firstRead: Buffer | undefined
  let secondRead: Buffer | undefined
  let snapshot: Buffer | undefined
  try {
    const closedInput = snapshotClosedInput(input, true)
    const path = await resolveCanonicalKeyPath(closedInput)
    if (hooks.beforeOpen) await hooks.beforeOpen()
    await assertDirectoryIdentities(path)

    const handle = await open(
      path.keyPath,
      constants.O_RDONLY | NON_BLOCKING_FLAG | NO_FOLLOW_FLAG,
    )
    try {
      if (hooks.afterOpen) await hooks.afterOpen()
      const initial = await assertHandleMatchesPath(handle, path, INSTALLATION_KEY_SIZE)
      firstRead = await readExactKey(handle)
      if (hooks.afterFirstRead) await hooks.afterFirstRead()
      const middle = await assertHandleMatchesPath(handle, path, INSTALLATION_KEY_SIZE)
      secondRead = await readExactKey(handle)
      const final = await assertHandleMatchesPath(handle, path, INSTALLATION_KEY_SIZE)
      if (
        !stableFileStateMatches(initial, middle) ||
        !stableFileStateMatches(middle, final) ||
        !timingSafeEqual(firstRead, secondRead)
      ) {
        invalidKey()
      }

      snapshot = Buffer.from(firstRead)
      const beforeClose = await assertHandleMatchesPath(handle, path, INSTALLATION_KEY_SIZE)
      if (!stableFileStateMatches(final, beforeClose)) invalidKey()
    } finally {
      await handle.close()
    }
    if (snapshot === undefined) invalidKey()
    return createOpaqueHandle(
      path,
      snapshot,
      closedInput.expectedFingerprint,
      continuityAuthorized,
    )
  } catch (error) {
    if (error instanceof TaskInstallationKeyError) throw error
    return invalidKey()
  } finally {
    firstRead?.fill(0)
    secondRead?.fill(0)
    snapshot?.fill(0)
  }
}

/** Create one task-owned installation key. Existing or raced paths always fail; nothing rotates. */
export function setupTaskInstallationKey(
  input: TaskInstallationKeySetupInput,
): Promise<TaskInstallationKeyHandle> {
  return setupTaskInstallationKeyCore(input, randomBytes, NO_FAULTS)
}

/**
 * Complete a key publication interrupted after its no-clobber link (#59). Resolves when no key is
 * published (a fresh setup may run) or when exactly one complete key name remains; never creates,
 * rotates, or unlinks the key, and never grants continuity authority.
 */
export function recoverTaskInstallationKeyPublication(
  input: TaskInstallationKeySetupInput,
): Promise<void> {
  return recoverTaskInstallationKeyPublicationCore(input)
}

/**
 * Load an existing task-owned key without creating, replacing, or rotating it. A matching bare
 * `expectedFingerprint` proves equality only; it never establishes backup continuity authority.
 */
export function loadTaskInstallationKey(
  input: TaskInstallationKeyLoadInput,
): Promise<TaskInstallationKeyHandle> {
  return loadTaskInstallationKeyCore(input, NO_HOOKS)
}

/** Load an existing key through the process-local github.core grant that reviewed its binding. */
export async function loadTaskInstallationKeyForGithubCoreGrant(
  input: GithubCoreTaskInstallationKeyLoadInput,
): Promise<TaskInstallationKeyHandle> {
  const closed = snapshotGithubCoreGrantInput(input)
  return loadTaskInstallationKeyCore({
    workspaceRoot: closed.workspaceRoot,
    taskId: closed.grant.taskId,
    expectedFingerprint: closed.grant.installationKeyFingerprint,
  }, NO_HOOKS, true)
}

/** @internal Invented-fixture seams only; production callers must use the closed public functions. */
export const taskInstallationKeyTestSeams = Object.freeze({
  setupWithRandomBytes(
    input: TaskInstallationKeySetupInput,
    source: RandomBytesSource,
  ): Promise<TaskInstallationKeyHandle> {
    return setupTaskInstallationKeyCore(input, source, NO_FAULTS)
  },
  setupWithFaults(
    input: TaskInstallationKeySetupInput,
    source: RandomBytesSource,
    faults: SetupFaults,
  ): Promise<TaskInstallationKeyHandle> {
    return setupTaskInstallationKeyCore(input, source, faults)
  },
  stagingNamePattern: STAGING_NAME_PATTERN,
  loadWithHooks(
    input: TaskInstallationKeyLoadInput,
    hooks: InternalHooks,
  ): Promise<TaskInstallationKeyHandle> {
    return loadTaskInstallationKeyCore(input, hooks)
  },
  portableIdentityMatches,
})
