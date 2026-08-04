import { constants } from 'node:fs'
import { lstat, open, realpath, type FileHandle } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { TextDecoder } from 'node:util'

export const ACTIVATION_TASK_CARD_LOAD_ERROR_CODE =
  'INVALID_ACTIVATION_TASK_CARD_LOAD' as const

const TASK_ID = /^[A-Za-z0-9_-]{1,128}$/
const MAX_TASK_CARD_BYTES = 64 * 1024
const NON_BLOCKING_READ_FLAG = constants.O_NONBLOCK ?? 0

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

export type LoadedActivationTaskCard = Readonly<{
  taskId: string
  parsed: unknown
}>

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

function parseJsonWithoutDuplicateKeys(text: string): unknown {
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

async function assertHandleMatchesPath(handle: FileHandle, canonicalCardPath: string): Promise<void> {
  const [handleStats, pathStats, canonicalPath] = await Promise.all([
    handle.stat(),
    lstat(canonicalCardPath),
    realpath(canonicalCardPath),
  ])
  if (!handleStats.isFile() || !pathStats.isFile() || canonicalPath !== canonicalCardPath) invalidLoad()
  if (!portableFileIdentityMatches(handleStats, pathStats)) invalidLoad()
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

async function readBoundedCard(handle: FileHandle): Promise<string> {
  const initial = await handle.stat()
  if (!initial.isFile() || initial.size > MAX_TASK_CARD_BYTES) invalidLoad()
  const bytes = Buffer.alloc(initial.size)
  let offset = 0
  while (offset < bytes.length) {
    const result = await handle.read(bytes, offset, bytes.length - offset, offset)
    if (result.bytesRead === 0) invalidLoad()
    offset += result.bytesRead
  }
  const final = await handle.stat()
  if (!final.isFile() || final.size !== initial.size || final.size > MAX_TASK_CARD_BYTES) invalidLoad()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  return decoder.decode(bytes)
}

function assertSafeTaskId(taskId: string): void {
  if (!TASK_ID.test(taskId) || taskId === '.' || taskId === '..') invalidLoad()
}

/** Read one canonical, confined activation card without parsing or echoing its content. */
export async function loadActivationTaskCard(
  input: ActivationTaskCardLoadInput,
): Promise<LoadedActivationTaskCard> {
  try {
    const snapshot = snapshotClosedInput(input)
    if (snapshot.workspaceRoot.length === 0 || !isAbsolute(snapshot.workspaceRoot)) invalidLoad()
    assertSafeTaskId(snapshot.taskId)

    const canonicalWorkspaceRoot = await realpath(resolve(snapshot.workspaceRoot))
    if (!(await lstat(canonicalWorkspaceRoot)).isDirectory()) invalidLoad()

    const expectedRelativeRoot = join('.developer-lens', 'activation', snapshot.taskId)
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
    const handle = await open(canonicalCardPath, constants.O_RDONLY | NON_BLOCKING_READ_FLAG)
    try {
      await assertCanonicalCardPath(canonicalWorkspaceRoot, expectedRelativeRoot, expectedPath)
      await assertHandleMatchesPath(handle, canonicalCardPath)
      return { taskId: snapshot.taskId, parsed: parseJsonWithoutDuplicateKeys(await readBoundedCard(handle)) }
    } finally {
      await handle.close()
    }
  } catch (error) {
    if (error instanceof ActivationTaskCardLoadError) throw error
    invalidLoad()
  }
}
