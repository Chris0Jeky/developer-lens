import { constants, type BigIntStats } from 'node:fs'
import { lstat, open, realpath, type FileHandle } from 'node:fs/promises'
import { createHash, timingSafeEqual } from 'node:crypto'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { TextDecoder } from 'node:util'

const TASK_ID = /^[A-Za-z0-9_-]{1,128}$/
const LOWERCASE_SHA_256 = /^[0-9a-f]{64}$/
const MAX_ACTIVATION_ARTIFACT_BYTES = 64 * 1024
const NON_BLOCKING_READ_FLAG = constants.O_NONBLOCK ?? 0
const NO_FOLLOW_READ_FLAG = constants.O_NOFOLLOW ?? 0

export type LoadedActivationArtifact = Readonly<{
  taskId: string
  parsed: unknown
}>
export type LoadedHashBoundActivationArtifact = Readonly<{
  taskId: string
  sha256: string
  parsed: unknown
}>
export type ActivationArtifactLoadInput = Readonly<{
  workspaceRoot: string
  taskId: string
}>
export type HashBoundActivationArtifactLoadInput = Readonly<{
  workspaceRoot: string
  taskId: string
  expectedSha256: string
}>

export type ActivationArtifactLoaderHooks = Readonly<{
  afterFirstRead?: () => void | Promise<void>
}>

type StableDirectoryIdentity = Readonly<{
  path: string
  dev: bigint
  ino: bigint
}>
type Snapshot = ActivationArtifactLoadInput | HashBoundActivationArtifactLoadInput
type ArtifactSpec = Readonly<{
  fileName: string
  maxBytes: number
}>
type InvalidLoad = () => never

const NO_HOOKS: ActivationArtifactLoaderHooks = Object.freeze({})
const TASK_CARD_SPEC: ArtifactSpec = Object.freeze({
  fileName: 'task-card.json',
  maxBytes: MAX_ACTIVATION_ARTIFACT_BYTES,
})
const LAST_RUN_REPORT_SPEC: ArtifactSpec = Object.freeze({
  fileName: 'last-run-report.json',
  maxBytes: MAX_ACTIVATION_ARTIFACT_BYTES,
})
const CONTINUITY_REVIEW_ANCHOR_SPEC: ArtifactSpec = Object.freeze({
  fileName: 'continuity-review-anchor.json',
  maxBytes: MAX_ACTIVATION_ARTIFACT_BYTES,
})

function snapshotClosedInput(value: unknown, invalid: InvalidLoad): ActivationArtifactLoadInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  const keys = Reflect.ownKeys(value)
  if (
    keys.length !== 2 ||
    !keys.includes('workspaceRoot') ||
    !keys.includes('taskId')
  ) invalid()
  const workspaceDescriptor = Object.getOwnPropertyDescriptor(value, 'workspaceRoot')
  const taskDescriptor = Object.getOwnPropertyDescriptor(value, 'taskId')
  if (
    !workspaceDescriptor || !Object.hasOwn(workspaceDescriptor, 'value') ||
    !taskDescriptor || !Object.hasOwn(taskDescriptor, 'value')
  ) invalid()
  const workspaceRoot = workspaceDescriptor.value
  const taskId = taskDescriptor.value
  if (typeof workspaceRoot !== 'string' || typeof taskId !== 'string') invalid()
  return { workspaceRoot, taskId }
}

function snapshotHashBoundClosedInput(
  value: unknown,
  invalid: InvalidLoad,
): HashBoundActivationArtifactLoadInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  const keys = Reflect.ownKeys(value)
  if (
    keys.length !== 3 ||
    !keys.includes('workspaceRoot') ||
    !keys.includes('taskId') ||
    !keys.includes('expectedSha256')
  ) invalid()
  const workspaceDescriptor = Object.getOwnPropertyDescriptor(value, 'workspaceRoot')
  const taskDescriptor = Object.getOwnPropertyDescriptor(value, 'taskId')
  const hashDescriptor = Object.getOwnPropertyDescriptor(value, 'expectedSha256')
  if (
    !workspaceDescriptor || !Object.hasOwn(workspaceDescriptor, 'value') ||
    !taskDescriptor || !Object.hasOwn(taskDescriptor, 'value') ||
    !hashDescriptor || !Object.hasOwn(hashDescriptor, 'value')
  ) invalid()
  const workspaceRoot = workspaceDescriptor.value
  const taskId = taskDescriptor.value
  const expectedSha256 = hashDescriptor.value
  if (
    typeof workspaceRoot !== 'string' ||
    typeof taskId !== 'string' ||
    typeof expectedSha256 !== 'string' ||
    !LOWERCASE_SHA_256.test(expectedSha256)
  ) invalid()
  return { workspaceRoot, taskId, expectedSha256 }
}

function parseJsonString(
  text: string,
  start: number,
): { value: string; next: number } {
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

/** @internal Strict JSON parser shared by confined activation artifacts. */
export function parseJsonWithoutDuplicateKeys(text: string): unknown {
  const end = scanJsonValue(text, 0)
  if (skipWhitespace(text, end) !== text.length) throw new Error('trailing JSON value')
  return JSON.parse(text)
}

function portableBigIntFileIdentityMatches(
  left: Readonly<{ dev: bigint; ino: bigint }>,
  right: Readonly<{ dev: bigint; ino: bigint }>,
): boolean {
  const leftAvailable = left.dev !== 0n || left.ino !== 0n
  const rightAvailable = right.dev !== 0n || right.ino !== 0n
  return leftAvailable && rightAvailable && left.dev === right.dev && left.ino === right.ino
}
export function portableFileIdentityMatches(
  handleIdentity: Readonly<{ dev: number; ino: number }>,
  pathIdentity: Readonly<{ dev: number; ino: number }>,
): boolean {
  const handleAvailable = handleIdentity.dev !== 0 || handleIdentity.ino !== 0
  const pathAvailable = pathIdentity.dev !== 0 || pathIdentity.ino !== 0
  return handleAvailable && pathAvailable &&
    handleIdentity.dev === pathIdentity.dev && handleIdentity.ino === pathIdentity.ino
}

function stableFileStateMatches(left: BigIntStats, right: BigIntStats): boolean {
  return left.isFile() && right.isFile() &&
    left.nlink === 1n && right.nlink === 1n &&
    portableBigIntFileIdentityMatches(left, right) &&
    left.size === right.size &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
}

async function assertHandleMatchesPath(
  handle: FileHandle,
  canonicalPath: string,
  invalid: InvalidLoad,
): Promise<BigIntStats> {
  const [handleStats, pathStats, actualPath] = await Promise.all([
    handle.stat({ bigint: true }),
    lstat(canonicalPath, { bigint: true }),
    realpath(canonicalPath),
  ])
  if (
    !handleStats.isFile() || !pathStats.isFile() ||
    handleStats.nlink !== 1n || pathStats.nlink !== 1n ||
    actualPath !== canonicalPath ||
    !stableFileStateMatches(handleStats, pathStats)
  ) invalid()
  return handleStats
}

async function captureCanonicalDirectoryIdentity(
  path: string,
  invalid: InvalidLoad,
): Promise<StableDirectoryIdentity> {
  const before = await lstat(path, { bigint: true })
  const canonical = await realpath(path)
  const after = await lstat(path, { bigint: true })
  if (
    !before.isDirectory() || !after.isDirectory() ||
    before.isSymbolicLink() || after.isSymbolicLink() ||
    canonical !== path || !portableBigIntFileIdentityMatches(before, after)
  ) invalid()
  return Object.freeze({ path, dev: after.dev, ino: after.ino })
}

async function assertCanonicalDirectoryIdentities(
  expected: readonly StableDirectoryIdentity[],
  invalid: InvalidLoad,
): Promise<void> {
  await Promise.all(expected.map(async (identity) => {
    const actual = await captureCanonicalDirectoryIdentity(identity.path, invalid)
    if (!portableBigIntFileIdentityMatches(identity, actual)) invalid()
  }))
}

async function assertCanonicalPaths(
  workspace: string,
  relativeRoot: string,
  expectedPath: string,
  invalid: InvalidLoad,
): Promise<void> {
  const [workspaceReal, directoryReal, artifactReal] = await Promise.all([
    realpath(workspace),
    realpath(join(workspace, relativeRoot)),
    realpath(expectedPath),
  ])
  if (workspaceReal !== workspace || directoryReal !== join(workspace, relativeRoot) || artifactReal !== expectedPath) invalid()
}
async function readExactBytes(
  handle: FileHandle,
  size: number,
  invalid: InvalidLoad,
): Promise<Buffer> {
  const bytes = Buffer.alloc(size)
  const overflow = Buffer.alloc(1)
  try {
    let offset = 0
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset)
      if (result.bytesRead === 0) invalid()
      offset += result.bytesRead
    }
    const extra = await handle.read(overflow, 0, 1, size)
    if (extra.bytesRead !== 0) invalid()
    return bytes
  } catch (error) {
    bytes.fill(0)
    throw error
  } finally {
    overflow.fill(0)
  }
}

async function readStableArtifact(
  handle: FileHandle,
  initialState: BigIntStats,
  spec: ArtifactSpec,
  hooks: ActivationArtifactLoaderHooks,
  beforeSecondRead: () => void | Promise<void>,
  afterStableRead: () => void | Promise<void>,
  invalid: InvalidLoad,
): Promise<{ text: string; sha256: string }> {
  if (!initialState.isFile() || initialState.size > BigInt(spec.maxBytes)) invalid()
  const size = Number(initialState.size)
  if (!Number.isSafeInteger(size) || size < 0) invalid()
  let firstRead: Buffer | undefined
  let secondRead: Buffer | undefined
  try {
    firstRead = await readExactBytes(handle, size, invalid)
    await beforeSecondRead()
    if (hooks.afterFirstRead) await hooks.afterFirstRead()
    secondRead = await readExactBytes(handle, size, invalid)
    if (
      firstRead.length !== secondRead.length ||
      !timingSafeEqual(firstRead, secondRead)
    ) invalid()
    const final = await handle.stat({ bigint: true })
    if (
      !stableFileStateMatches(initialState, final) ||
      final.size > BigInt(spec.maxBytes)
    ) invalid()
    await afterStableRead()
    const text = new TextDecoder('utf-8', { fatal: true }).decode(firstRead)
    return { text, sha256: createHash('sha256').update(firstRead).digest('hex') }
  } finally {
    firstRead?.fill(0)
    secondRead?.fill(0)
  }
}

function assertSafeTaskId(taskId: string, invalid: InvalidLoad): void {
  if (!TASK_ID.test(taskId) || taskId === '.' || taskId === '..') invalid()
}

async function loadFixedArtifactSnapshot(
  snapshot: Snapshot,
  spec: ArtifactSpec,
  expectedSha256: string | undefined,
  hooks: ActivationArtifactLoaderHooks,
  invalid: InvalidLoad,
): Promise<LoadedHashBoundActivationArtifact> {
  if (snapshot.workspaceRoot.length === 0 || !isAbsolute(snapshot.workspaceRoot)) invalid()
  assertSafeTaskId(snapshot.taskId, invalid)
  const canonicalWorkspaceRoot = await realpath(resolve(snapshot.workspaceRoot))
  if (!(await lstat(canonicalWorkspaceRoot)).isDirectory()) invalid()
  const expectedRelativeRoot = join('.developer-lens', 'activation', snapshot.taskId)
  const expectedParentPath = join(canonicalWorkspaceRoot, expectedRelativeRoot)
  const expectedPath = join(expectedParentPath, spec.fileName)
  const canonicalPath = await realpath(expectedPath)
  const artifactRelativePath = relative(canonicalWorkspaceRoot, canonicalPath)
  if (
    isAbsolute(artifactRelativePath) ||
    artifactRelativePath === '..' ||
    artifactRelativePath.startsWith(`..${sep}`) ||
    artifactRelativePath !== join(expectedRelativeRoot, spec.fileName) ||
    canonicalPath !== expectedPath ||
    !(await lstat(canonicalPath)).isFile()
  ) invalid()
  await assertCanonicalPaths(canonicalWorkspaceRoot, expectedRelativeRoot, expectedPath, invalid)
  const directoryPaths = [
    canonicalWorkspaceRoot,
    join(canonicalWorkspaceRoot, '.developer-lens'),
    join(canonicalWorkspaceRoot, '.developer-lens', 'activation'),
    expectedParentPath,
  ]
  const directoryIdentities = await Promise.all(
    directoryPaths.map((path) => captureCanonicalDirectoryIdentity(path, invalid)),
  )
  const handle = await open(
    canonicalPath,
    constants.O_RDONLY | NON_BLOCKING_READ_FLAG | NO_FOLLOW_READ_FLAG,
  )
  try {
    await assertCanonicalPaths(canonicalWorkspaceRoot, expectedRelativeRoot, expectedPath, invalid)
    await assertCanonicalDirectoryIdentities(directoryIdentities, invalid)
    const initialState = await assertHandleMatchesPath(handle, canonicalPath, invalid)
    const artifact = await readStableArtifact(
      handle,
      initialState,
      spec,
      hooks,
      async () => {
        await assertCanonicalPaths(canonicalWorkspaceRoot, expectedRelativeRoot, expectedPath, invalid)
        await assertCanonicalDirectoryIdentities(directoryIdentities, invalid)
        const middleState = await assertHandleMatchesPath(handle, canonicalPath, invalid)
        if (!stableFileStateMatches(initialState, middleState)) invalid()
      },
      async () => {
        await assertCanonicalPaths(canonicalWorkspaceRoot, expectedRelativeRoot, expectedPath, invalid)
        await assertCanonicalDirectoryIdentities(directoryIdentities, invalid)
        const finalState = await assertHandleMatchesPath(handle, canonicalPath, invalid)
        if (!stableFileStateMatches(initialState, finalState)) invalid()
      },
      invalid,
    )
    if (expectedSha256 !== undefined && artifact.sha256 !== expectedSha256) invalid()
    return {
      taskId: snapshot.taskId,
      sha256: artifact.sha256,
      parsed: parseJsonWithoutDuplicateKeys(artifact.text),
    }
  } finally { await handle.close() }
}

export async function loadActivationTaskCardArtifact(
  input: unknown,
  invalid: InvalidLoad,
  hooks: ActivationArtifactLoaderHooks = NO_HOOKS,
): Promise<LoadedActivationArtifact> {
  const snapshot = snapshotClosedInput(input, invalid)
  const loaded = await loadFixedArtifactSnapshot(snapshot, TASK_CARD_SPEC, undefined, hooks, invalid)
  return { taskId: loaded.taskId, parsed: loaded.parsed }
}

export async function loadHashBoundActivationTaskCardArtifact(
  input: unknown,
  invalid: InvalidLoad,
): Promise<LoadedActivationArtifact> {
  const snapshot = snapshotHashBoundClosedInput(input, invalid)
  const loaded = await loadFixedArtifactSnapshot(snapshot, TASK_CARD_SPEC, snapshot.expectedSha256, NO_HOOKS, invalid)
  return { taskId: loaded.taskId, parsed: loaded.parsed }
}

export const ACTIVATION_ARTIFACT_LOAD_ERROR_CODE = 'INVALID_ACTIVATION_ARTIFACT_LOAD' as const
export class ActivationArtifactLoadError extends Error {
  readonly code = ACTIVATION_ARTIFACT_LOAD_ERROR_CODE

  constructor() {
    super(ACTIVATION_ARTIFACT_LOAD_ERROR_CODE)
    this.name = 'ActivationArtifactLoadError'
  }
}

function invalidArtifactLoad(): never {
  throw new ActivationArtifactLoadError()
}

/** Load the fixed, hash-bound last-run-report artifact; parsing is intentionally caller-owned. */
export async function loadHashBoundActivationLastRunReport(input: unknown): Promise<LoadedActivationArtifact> {
  try {
    const snapshot = snapshotHashBoundClosedInput(input, invalidArtifactLoad)
    const loaded = await loadFixedArtifactSnapshot(
      snapshot,
      LAST_RUN_REPORT_SPEC,
      snapshot.expectedSha256,
      NO_HOOKS,
      invalidArtifactLoad,
    )
    return { taskId: loaded.taskId, parsed: loaded.parsed }
  } catch (error) {
    if (error instanceof ActivationArtifactLoadError) throw error
    invalidArtifactLoad()
  }
}

/** @internal Invented-fixture seam only; production callers cannot select filenames or limits. */
export const activationArtifactLoaderTestSeams = Object.freeze({
  loadReportWithHooks: async (
    input: unknown,
    hooks: ActivationArtifactLoaderHooks,
  ): Promise<LoadedActivationArtifact> => {
    try {
      const snapshot = snapshotHashBoundClosedInput(input, invalidArtifactLoad)
      return await loadFixedArtifactSnapshot(
        snapshot,
        LAST_RUN_REPORT_SPEC,
        snapshot.expectedSha256,
        hooks,
        invalidArtifactLoad,
      ).then((loaded) => ({ taskId: loaded.taskId, parsed: loaded.parsed }))
    } catch (error) {
      if (error instanceof ActivationArtifactLoadError) throw error
      invalidArtifactLoad()
    }
  },
  loadAnchorWithHooks: async (
    input: unknown,
    hooks: ActivationArtifactLoaderHooks,
  ): Promise<LoadedHashBoundActivationArtifact> => {
    try {
      const snapshot = snapshotHashBoundClosedInput(input, invalidArtifactLoad)
      return await loadFixedArtifactSnapshot(
        snapshot,
        CONTINUITY_REVIEW_ANCHOR_SPEC,
        snapshot.expectedSha256,
        hooks,
        invalidArtifactLoad,
      )
    } catch (error) {
      if (error instanceof ActivationArtifactLoadError) throw error
      invalidArtifactLoad()
    }
  },
})

/**
 * Load the fixed, hash-bound continuity review-anchor artifact.
 *
 * Equality between the externally supplied SHA-256 and the digest of the observed stable bytes
 * proves those bytes only. It does not authenticate owner identity, review or approval; prove
 * trusted time; bind a report, task card, key, lifecycle, CAS state, retention, or completeness;
 * authorize, renew, or activate continuity; or establish provenance of this artifact.
 */
export async function loadHashBoundContinuityReviewAnchorArtifact(
  input: unknown,
): Promise<LoadedHashBoundActivationArtifact> {
  try {
    const snapshot = snapshotHashBoundClosedInput(input, invalidArtifactLoad)
    return await loadFixedArtifactSnapshot(
      snapshot,
      CONTINUITY_REVIEW_ANCHOR_SPEC,
      snapshot.expectedSha256,
      NO_HOOKS,
      invalidArtifactLoad,
    )
  } catch (error) {
    if (error instanceof ActivationArtifactLoadError) throw error
    invalidArtifactLoad()
  }
}
