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
import { lstat, open, realpath, type FileHandle } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
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

const INSTALLATION_KEY_BYTES = 32
const INSTALLATION_KEY_SIZE = 32n
const INSTALLATION_KEY_FILE = 'installation-key.bin'
const NON_BLOCKING_FLAG = constants.O_NONBLOCK ?? 0
const NO_FOLLOW_FLAG = constants.O_NOFOLLOW ?? 0
const RESTRICTIVE_FILE_MODE = 0o600

/**
 * Default-off continuity foundation only.
 *
 * A bare expected fingerprint is only an integrity assertion because callers can copy it from an
 * inspection handle. Continuity authorization requires fresh setup or a separately issued opaque
 * source grant; there is still no production grant issuer or backup caller.
 */
export class TaskInstallationKeyError extends Error {
  readonly code = TASK_INSTALLATION_KEY_ERROR_CODE

  constructor() {
    super(TASK_INSTALLATION_KEY_ERROR_CODE)
    this.name = 'TaskInstallationKeyError'
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

const NO_HOOKS: InternalHooks = Object.freeze({})

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
): Promise<BigIntStats> {
  await assertDirectoryIdentities(path)
  const [handleStats, pathStats, canonicalPath] = await Promise.all([
    handle.stat({ bigint: true }),
    lstat(path.keyPath, { bigint: true }),
    realpath(path.keyPath),
  ])
  assertRegularKeyFile(handleStats, expectedSize)
  assertRegularKeyFile(pathStats, expectedSize)
  if (canonicalPath !== path.keyPath || !portableIdentityMatches(handleStats, pathStats)) invalidKey()
  await assertDirectoryIdentities(path)
  return handleStats
}

async function writeExactly(handle: FileHandle, bytes: Buffer): Promise<void> {
  let offset = 0
  while (offset < bytes.length) {
    const result = await handle.write(bytes, offset, bytes.length - offset, offset)
    if (result.bytesWritten === 0) invalidKey()
    offset += result.bytesWritten
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

async function setupTaskInstallationKeyCore(
  input: TaskInstallationKeySetupInput,
  randomBytesSource: RandomBytesSource,
  hooks: InternalHooks,
): Promise<TaskInstallationKeyHandle> {
  let generated: Buffer | undefined
  let key: Buffer | undefined
  let verification: Buffer | undefined
  let snapshot: Buffer | undefined
  try {
    const closedInput = snapshotClosedInput(input, false)
    const path = await resolveCanonicalKeyPath(closedInput)
    await assertKeyPathMissing(path)

    const candidate = randomBytesSource(INSTALLATION_KEY_BYTES)
    if (!Buffer.isBuffer(candidate)) invalidKey()
    generated = candidate
    if (generated.length !== INSTALLATION_KEY_BYTES) invalidKey()
    key = Buffer.from(generated)

    if (hooks.beforeOpen) await hooks.beforeOpen()
    await assertDirectoryIdentities(path)
    const handle = await open(
      path.keyPath,
      constants.O_RDWR |
        constants.O_CREAT |
        constants.O_EXCL |
        NON_BLOCKING_FLAG |
        NO_FOLLOW_FLAG,
      RESTRICTIVE_FILE_MODE,
    )
    try {
      if (hooks.afterOpen) await hooks.afterOpen()
      const created = await assertHandleMatchesPath(handle, path, 0n)
      if (process.platform !== 'win32') await handle.chmod(RESTRICTIVE_FILE_MODE)
      const writable = await assertHandleMatchesPath(handle, path, 0n)
      if (!portableIdentityMatches(created, writable)) invalidKey()

      await writeExactly(handle, key)
      await handle.sync()
      const written = await assertHandleMatchesPath(handle, path, INSTALLATION_KEY_SIZE)
      if (!portableIdentityMatches(created, written)) invalidKey()

      verification = await readExactKey(handle)
      const verified = await assertHandleMatchesPath(handle, path, INSTALLATION_KEY_SIZE)
      if (!stableFileStateMatches(written, verified) || !timingSafeEqual(key, verification)) {
        invalidKey()
      }
      snapshot = Buffer.from(verification)
    } finally {
      await handle.close()
    }
    if (snapshot === undefined) invalidKey()
    return createOpaqueHandle(path, snapshot, undefined, true)
  } catch (error) {
    if (error instanceof TaskInstallationKeyError) throw error
    return invalidKey()
  } finally {
    generated?.fill(0)
    key?.fill(0)
    verification?.fill(0)
    snapshot?.fill(0)
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
  return setupTaskInstallationKeyCore(input, randomBytes, NO_HOOKS)
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
    return setupTaskInstallationKeyCore(input, source, NO_HOOKS)
  },
  loadWithHooks(
    input: TaskInstallationKeyLoadInput,
    hooks: InternalHooks,
  ): Promise<TaskInstallationKeyHandle> {
    return loadTaskInstallationKeyCore(input, hooks)
  },
  portableIdentityMatches,
})
