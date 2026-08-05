import { constants, type BigIntStats } from 'node:fs'
import { lstat, open, realpath, type FileHandle } from 'node:fs/promises'
import { createHash, timingSafeEqual } from 'node:crypto'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { TextDecoder } from 'node:util'

export const ACTIVATION_TASK_CARD_LOAD_ERROR_CODE =
  'INVALID_ACTIVATION_TASK_CARD_LOAD' as const

const TASK_ID = /^[A-Za-z0-9_-]{1,128}$/
const LOWERCASE_SHA_256 = /^[0-9a-f]{64}$/
const MAX_TASK_CARD_BYTES = 64 * 1024
const NON_BLOCKING_READ_FLAG = constants.O_NONBLOCK ?? 0
const NO_FOLLOW_READ_FLAG = constants.O_NOFOLLOW ?? 0

export class ActivationTaskCardLoadError extends Error {
  readonly code = ACTIVATION_TASK_CARD_LOAD_ERROR_CODE

  constructor() {
    super(ACTIVATION_TASK_CARD_LOAD_ERROR_CODE)
    this.name = 'ActivationTaskCardLoadError'
  }
}

export type ActivationTaskCardLoadInput = Readonly<{
  workspaceRoot: string
  taskId: string
}>

export type HashBoundActivationTaskCardLoadInput = Readonly<{
  workspaceRoot: string
  taskId: string
  expectedSha256: string
}>

export type LoadedActivationTaskCard = Readonly<{
  taskId: string
  parsed: unknown
}>

type ActivationTaskCardLoaderHooks = Readonly<{
  afterFirstRead?: () => void | Promise<void>
}>

type StableDirectoryIdentity = Readonly<{
  path: string
  dev: bigint
  ino: bigint
}>

const NO_HOOKS: ActivationTaskCardLoaderHooks = Object.freeze({})

function invalidLoad(): never {
  throw new ActivationTaskCardLoadError()
}

function snapshotClosedInput(value: unknown): ActivationTaskCardLoadInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidLoad()
  const keys = Reflect.ownKeys(value)
  if (keys.length !== 2 || !keys.includes('workspaceRoot') || !keys.includes('taskId')) invalidLoad()
  const workspaceDescriptor = Object.getOwnPropertyDescriptor(value, 'workspaceRoot')
  const taskDescriptor = Object.getOwnPropertyDescriptor(value, 'taskId')
  if (
    !workspaceDescriptor || !Object.hasOwn(workspaceDescriptor, 'value') ||
    !taskDescriptor || !Object.hasOwn(taskDescriptor, 'value')
  ) invalidLoad()
  const workspaceRoot = workspaceDescriptor.value
  const taskId = taskDescriptor.value
  if (typeof workspaceRoot !== 'string' || typeof taskId !== 'string') invalidLoad()
  return { workspaceRoot, taskId }
}

function snapshotHashBoundClosedInput(value: unknown): HashBoundActivationTaskCardLoadInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidLoad()
  const keys = Reflect.ownKeys(value)
  if (
    keys.length !== 3 ||
    !keys.includes('workspaceRoot') ||
    !keys.includes('taskId') ||
    !keys.includes('expectedSha256')
  ) invalidLoad()
  const workspaceDescriptor = Object.getOwnPropertyDescriptor(value, 'workspaceRoot')
  const taskDescriptor = Object.getOwnPropertyDescriptor(value, 'taskId')
  const hashDescriptor = Object.getOwnPropertyDescriptor(value, 'expectedSha256')
  if (
    !workspaceDescriptor || !Object.hasOwn(workspaceDescriptor, 'value') ||
    !taskDescriptor || !Object.hasOwn(taskDescriptor, 'value') ||
    !hashDescriptor || !Object.hasOwn(hashDescriptor, 'value')
  ) invalidLoad()
  const workspaceRoot = workspaceDescriptor.value
  const taskId = taskDescriptor.value
  const expectedSha256 = hashDescriptor.value
  if (
    typeof workspaceRoot !== 'string' ||
    typeof taskId !== 'string' ||
    typeof expectedSha256 !== 'string' ||
    !LOWERCASE_SHA_256.test(expectedSha256)
  ) invalidLoad()
  return { workspaceRoot, taskId, expectedSha256 }
}

function parseJsonString(text: string, start: number): { value: string; next: number } {
  let index = start + 1
  while (index < text.length) {
    const character = text[index]
    if (character === '\\') {
      index += 2
      continue
    }
    if (character === '"') {
      const token = text.slice(start, index + 1)
      const value = JSON.parse(token) as unknown
      if (typeof value !== 'string') throw new Error('invalid JSON string')
      return { value, next: index + 1 }
    }
    if (character < ' ') throw new Error('invalid JSON string')
    index += 1
  }
  throw new Error('unterminated JSON string')
}

function skipWhitespace(text: string, index: number): number {
  while (index < text.length && /\s/.test(text[index] ?? '')) index += 1
  return index
}

function scanJsonValue(text: string, start: number): number {
  let index = skipWhitespace(text, start)
  const character = text[index]
  if (character === '"') return parseJsonString(text, index).next
  if (character === '{') return scanJsonObject(text, index)
  if (character === '[') return scanJsonArray(text, index)
  const valueStart = index
  while (index < text.length && !',]}'.includes(text[index] ?? '')) index += 1
  const token = text.slice(valueStart, index).trim()
  if (!token) throw new Error('missing JSON value')
  JSON.parse(token)
  return index
}

function scanJsonObject(text: string, start: number): number {
  let index = skipWhitespace(text, start + 1)
  const keys = new Set<string>()
  if (text[index] === '}') return index + 1
  while (index < text.length) {
    if (text[index] !== '"') throw new Error('object key is not a string')
    const key = parseJsonString(text, index)
    if (keys.has(key.value)) throw new Error('duplicate JSON object key')
    keys.add(key.value)
    index = skipWhitespace(text, key.next)
    if (text[index] !== ':') throw new Error('missing object colon')
    index = scanJsonValue(text, index + 1)
    index = skipWhitespace(text, index)
    if (text[index] === '}') return index + 1
    if (text[index] !== ',') throw new Error('missing object comma')
    index = skipWhitespace(text, index + 1)
  }
  throw new Error('unterminated JSON object')
}

function scanJsonArray(text: string, start: number): number {
  let index = skipWhitespace(text, start + 1)
  if (text[index] === ']') return index + 1
  while (index < text.length) {
    index = scanJsonValue(text, index)
    index = skipWhitespace(text, index)
    if (text[index] === ']') return index + 1
    if (text[index] !== ',') throw new Error('missing array comma')
    index = skipWhitespace(text, index + 1)
  }
  throw new Error('unterminated JSON array')
}

/** @internal Strict JSON parser shared by confined response/card boundaries. */
export function parseJsonWithoutDuplicateKeys(text: string): unknown {
  const end = scanJsonValue(text, 0)
  if (skipWhitespace(text, end) !== text.length) throw new Error('trailing JSON value')
  return JSON.parse(text)
}

function assertCanonicalCardPath(
  canonicalWorkspaceRoot: string,
  expectedRelativeRoot: string,
  expectedPath: string,
): Promise<void> {
  return Promise.all([
    realpath(canonicalWorkspaceRoot),
    realpath(join(canonicalWorkspaceRoot, expectedRelativeRoot)),
    realpath(expectedPath),
  ]).then(([workspace, directory, card]) => {
    if (workspace !== canonicalWorkspaceRoot || directory !== join(canonicalWorkspaceRoot, expectedRelativeRoot) || card !== expectedPath) {
      invalidLoad()
    }
  })
}

function stableFileStateMatches(left: BigIntStats, right: BigIntStats): boolean {
  return left.isFile() &&
    right.isFile() &&
    left.nlink === 1n &&
    right.nlink === 1n &&
    portableBigIntFileIdentityMatches(left, right) &&
    left.size === right.size &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
}

function portableBigIntFileIdentityMatches(
  left: Readonly<{ dev: bigint; ino: bigint }>,
  right: Readonly<{ dev: bigint; ino: bigint }>,
): boolean {
  const leftAvailable = left.dev !== 0n || left.ino !== 0n
  const rightAvailable = right.dev !== 0n || right.ino !== 0n
  return leftAvailable && rightAvailable && left.dev === right.dev && left.ino === right.ino
}

async function assertHandleMatchesPath(handle: FileHandle, canonicalCardPath: string): Promise<BigIntStats> {
  const [handleStats, pathStats, canonicalPath] = await Promise.all([
    handle.stat({ bigint: true }),
    lstat(canonicalCardPath, { bigint: true }),
    realpath(canonicalCardPath),
  ])
  if (
    !handleStats.isFile() ||
    !pathStats.isFile() ||
    handleStats.nlink !== 1n ||
    pathStats.nlink !== 1n ||
    canonicalPath !== canonicalCardPath
  ) invalidLoad()
  if (!stableFileStateMatches(handleStats, pathStats)) invalidLoad()
  return handleStats
}

async function captureCanonicalDirectoryIdentity(path: string): Promise<StableDirectoryIdentity> {
  const before = await lstat(path, { bigint: true })
  const canonical = await realpath(path)
  const after = await lstat(path, { bigint: true })
  if (
    !before.isDirectory() ||
    !after.isDirectory() ||
    before.isSymbolicLink() ||
    after.isSymbolicLink() ||
    canonical !== path ||
    !portableBigIntFileIdentityMatches(before, after)
  ) {
    invalidLoad()
  }
  return Object.freeze({
    path,
    dev: after.dev,
    ino: after.ino,
  })
}

async function assertCanonicalDirectoryIdentity(expected: StableDirectoryIdentity): Promise<void> {
  const actual = await captureCanonicalDirectoryIdentity(expected.path)
  if (
    !portableBigIntFileIdentityMatches(expected, actual)
  ) invalidLoad()
}

async function assertCanonicalDirectoryIdentities(
  expected: readonly StableDirectoryIdentity[],
): Promise<void> {
  await Promise.all(expected.map((identity) => assertCanonicalDirectoryIdentity(identity)))
}

/** @internal Pure regression seam for filesystems without usable file identity. */
export function portableFileIdentityMatches(
  handleIdentity: Readonly<{ dev: number; ino: number }>,
  pathIdentity: Readonly<{ dev: number; ino: number }>,
): boolean {
  const handleAvailable = handleIdentity.dev !== 0 || handleIdentity.ino !== 0
  const pathAvailable = pathIdentity.dev !== 0 || pathIdentity.ino !== 0
  return handleAvailable && pathAvailable &&
    handleIdentity.dev === pathIdentity.dev && handleIdentity.ino === pathIdentity.ino
}

async function readExactCardBytes(handle: FileHandle, size: number): Promise<Buffer> {
  const bytes = Buffer.alloc(size)
  const overflow = Buffer.alloc(1)
  try {
    let offset = 0
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset)
      if (result.bytesRead === 0) invalidLoad()
      offset += result.bytesRead
    }
    const extra = await handle.read(overflow, 0, overflow.length, size)
    if (extra.bytesRead !== 0) invalidLoad()
    return bytes
  } catch (error) {
    bytes.fill(0)
    throw error
  } finally {
    overflow.fill(0)
  }
}

async function readBoundedCard(
  handle: FileHandle,
  initialState: BigIntStats,
  hooks: ActivationTaskCardLoaderHooks,
  afterStableRead: () => void | Promise<void>,
): Promise<{ readonly text: string; readonly sha256: string }> {
  if (!initialState.isFile() || initialState.size > BigInt(MAX_TASK_CARD_BYTES)) invalidLoad()
  const size = Number(initialState.size)
  if (!Number.isSafeInteger(size) || size < 0) invalidLoad()
  let firstRead: Buffer | undefined
  let secondRead: Buffer | undefined
  try {
    firstRead = await readExactCardBytes(handle, size)
    if (hooks.afterFirstRead) await hooks.afterFirstRead()
    secondRead = await readExactCardBytes(handle, size)
    if (
      firstRead.length !== secondRead.length ||
      !timingSafeEqual(firstRead, secondRead)
    ) {
      invalidLoad()
    }
    const final = await handle.stat({ bigint: true })
    if (!stableFileStateMatches(initialState, final) || final.size > BigInt(MAX_TASK_CARD_BYTES)) invalidLoad()
    await afterStableRead()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    const text = decoder.decode(firstRead)
    const sha256 = createHash('sha256').update(firstRead).digest('hex')
    return { text, sha256 }
  } finally {
    firstRead?.fill(0)
    secondRead?.fill(0)
  }
}

function assertSafeTaskId(taskId: string): void {
  if (!TASK_ID.test(taskId) || taskId === '.' || taskId === '..') invalidLoad()
}

async function loadActivationTaskCardSnapshot(
  snapshot: ActivationTaskCardLoadInput,
  expectedSha256?: string,
  hooks: ActivationTaskCardLoaderHooks = NO_HOOKS,
): Promise<LoadedActivationTaskCard> {
  if (snapshot.workspaceRoot.length === 0 || !isAbsolute(snapshot.workspaceRoot)) invalidLoad()
  assertSafeTaskId(snapshot.taskId)

  const canonicalWorkspaceRoot = await realpath(resolve(snapshot.workspaceRoot))
  if (!(await lstat(canonicalWorkspaceRoot)).isDirectory()) invalidLoad()

  const expectedRelativeRoot = join('.developer-lens', 'activation', snapshot.taskId)
  const expectedParentPath = join(canonicalWorkspaceRoot, expectedRelativeRoot)
  const expectedPath = join(canonicalWorkspaceRoot, expectedRelativeRoot, 'task-card.json')
  const canonicalCardPath = await realpath(expectedPath)
  const cardRelativePath = relative(canonicalWorkspaceRoot, canonicalCardPath)
  if (
    isAbsolute(cardRelativePath) ||
    cardRelativePath === '..' ||
    cardRelativePath.startsWith(`..${sep}`) ||
    cardRelativePath !== join(expectedRelativeRoot, 'task-card.json') ||
    canonicalCardPath !== expectedPath ||
    !(await lstat(canonicalCardPath)).isFile()
  ) {
    invalidLoad()
  }

  await assertCanonicalCardPath(canonicalWorkspaceRoot, expectedRelativeRoot, expectedPath)
  const confinedDirectoryPaths = [
    canonicalWorkspaceRoot,
    join(canonicalWorkspaceRoot, '.developer-lens'),
    join(canonicalWorkspaceRoot, '.developer-lens', 'activation'),
    expectedParentPath,
  ]
  const confinedDirectoryIdentities = await Promise.all(
    confinedDirectoryPaths.map((path) => captureCanonicalDirectoryIdentity(path)),
  )
  const handle = await open(
    canonicalCardPath,
    constants.O_RDONLY | NON_BLOCKING_READ_FLAG | NO_FOLLOW_READ_FLAG,
  )
  try {
    await assertCanonicalCardPath(canonicalWorkspaceRoot, expectedRelativeRoot, expectedPath)
    await assertCanonicalDirectoryIdentities(confinedDirectoryIdentities)
    const initialState = await assertHandleMatchesPath(handle, canonicalCardPath)
    const card = await readBoundedCard(
      handle,
      initialState,
      {
        afterFirstRead: async () => {
          await assertCanonicalCardPath(canonicalWorkspaceRoot, expectedRelativeRoot, expectedPath)
          await assertCanonicalDirectoryIdentities(confinedDirectoryIdentities)
          const middleState = await assertHandleMatchesPath(handle, canonicalCardPath)
          if (!stableFileStateMatches(initialState, middleState)) invalidLoad()
          if (hooks.afterFirstRead) await hooks.afterFirstRead()
        },
      },
      async () => {
        await assertCanonicalCardPath(canonicalWorkspaceRoot, expectedRelativeRoot, expectedPath)
        await assertCanonicalDirectoryIdentities(confinedDirectoryIdentities)
        const finalState = await assertHandleMatchesPath(handle, canonicalCardPath)
        if (!stableFileStateMatches(initialState, finalState)) invalidLoad()
      },
    )
    if (expectedSha256 !== undefined && card.sha256 !== expectedSha256) invalidLoad()
    return { taskId: snapshot.taskId, parsed: parseJsonWithoutDuplicateKeys(card.text) }
  } finally {
    await handle.close()
  }
}

async function loadActivationTaskCardWithHooks(
  input: ActivationTaskCardLoadInput,
  hooks: ActivationTaskCardLoaderHooks,
): Promise<LoadedActivationTaskCard> {
  try {
    return await loadActivationTaskCardSnapshot(snapshotClosedInput(input), undefined, hooks)
  } catch (error) {
    if (error instanceof ActivationTaskCardLoadError) throw error
    invalidLoad()
  }
}

/** Read one canonical, confined activation card without parsing or echoing its content. */
export async function loadActivationTaskCard(
  input: ActivationTaskCardLoadInput,
): Promise<LoadedActivationTaskCard> {
  try {
    return await loadActivationTaskCardSnapshot(snapshotClosedInput(input))
  } catch (error) {
    if (error instanceof ActivationTaskCardLoadError) throw error
    invalidLoad()
  }
}

/** Bind one stable canonical card snapshot to a caller-supplied lowercase SHA-256. */
export async function loadHashBoundActivationTaskCard(
  input: HashBoundActivationTaskCardLoadInput,
): Promise<LoadedActivationTaskCard> {
  try {
    const snapshot = snapshotHashBoundClosedInput(input)
    return await loadActivationTaskCardSnapshot(snapshot, snapshot.expectedSha256)
  } catch (error) {
    if (error instanceof ActivationTaskCardLoadError) throw error
    invalidLoad()
  }
}

/** @internal Invented-fixture seam only; production callers must use the closed public functions. */
export const activationTaskCardLoaderTestSeams = Object.freeze({
  loadWithHooks: loadActivationTaskCardWithHooks,
})
