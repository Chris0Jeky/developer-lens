import { lstat, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  parseGithubCoreActivationTaskCard,
  type GithubCoreActivationTaskCard,
} from './activationTask.js'

export const GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE =
  'INVALID_GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD' as const

const TASK_ID = /^[A-Za-z0-9_-]{1,128}$/

export class GithubCoreActivationTaskCardLoadError extends Error {
  readonly code = GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE)
    this.name = 'GithubCoreActivationTaskCardLoadError'
  }
}

export type GithubCoreActivationTaskCardLoadInput = Readonly<{
  workspaceRoot: string
  taskId: string
}>

function invalidLoad(): never {
  throw new GithubCoreActivationTaskCardLoadError()
}

function isClosedInput(value: unknown): value is GithubCoreActivationTaskCardLoadInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  if (keys.length !== 2 || !keys.includes('workspaceRoot') || !keys.includes('taskId')) return false
  const input = value as Record<string, unknown>
  return typeof input.workspaceRoot === 'string' && typeof input.taskId === 'string'
}

function assertSafeTaskId(taskId: string): void {
  if (!TASK_ID.test(taskId) || taskId === '.' || taskId === '..') invalidLoad()
}

/**
 * Read the one canonical, ignored github.core task card for a task id.
 *
 * The input deliberately has no arbitrary card-path option. Filesystem
 * metadata is checked before the UTF-8 content read, including symlink and
 * alternate-root rejection.
 */
export async function loadGithubCoreActivationTaskCard(
  input: GithubCoreActivationTaskCardLoadInput,
): Promise<GithubCoreActivationTaskCard> {
  try {
    if (!isClosedInput(input)) invalidLoad()
    if (input.workspaceRoot.length === 0 || !isAbsolute(input.workspaceRoot)) invalidLoad()
    assertSafeTaskId(input.taskId)

    const canonicalWorkspaceRoot = await realpath(resolve(input.workspaceRoot))
    if (!(await lstat(canonicalWorkspaceRoot)).isDirectory()) invalidLoad()

    const expectedRelativeRoot = join('.developer-lens', 'activation', input.taskId)
    const expectedPath = join(canonicalWorkspaceRoot, expectedRelativeRoot, 'task-card.json')
    const canonicalCardPath = await realpath(expectedPath)

    // realpath resolves every ancestor and the file itself. Requiring the
    // exact canonical spelling rejects traversal, alternate roots, and all
    // symlink/junction escapes before opening the card for content.
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

    const parsed = JSON.parse(await readFile(canonicalCardPath, 'utf8')) as unknown
    const card = parseGithubCoreActivationTaskCard(parsed)
    if (card.localBoundary.root !== `${expectedRelativeRoot.replaceAll('\\', '/')}/`) invalidLoad()
    return card
  } catch (error) {
    if (error instanceof GithubCoreActivationTaskCardLoadError) throw error
    invalidLoad()
  }
}
