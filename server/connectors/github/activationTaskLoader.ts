import {
  loadHashBoundActivationTaskCard,
  loadActivationTaskCard,
  type ActivationTaskCardLoadInput,
  type HashBoundActivationTaskCardLoadInput,
} from '../../activationTaskCardLoader.js'
import {
  parseGithubCoreActivationTaskCard,
  type GithubCoreActivationTaskCard,
} from './activationTask.js'
import {
  assertGithubCoreActivationGrant,
  type GithubCoreActivationGrant,
} from './activationGrant.js'

export const GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE =
  'INVALID_GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD' as const

export class GithubCoreActivationTaskCardLoadError extends Error {
  readonly code = GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE)
    this.name = 'GithubCoreActivationTaskCardLoadError'
  }
}

export type GithubCoreActivationTaskCardLoadInput = ActivationTaskCardLoadInput
export type GithubCoreHashBoundActivationTaskCardLoadInput = HashBoundActivationTaskCardLoadInput &
  Readonly<{ grant: GithubCoreActivationGrant }>

type GrantedHashBoundLoadInput = Readonly<{
  workspaceRoot: string
  taskId: string
  expectedSha256: string
  grant: GithubCoreActivationGrant
}>

function invalidLoad(): never {
  throw new GithubCoreActivationTaskCardLoadError()
}

function snapshotGrantedHashBoundInput(input: unknown): GrantedHashBoundLoadInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalidLoad()
  const expectedKeys = ['grant', 'workspaceRoot', 'taskId', 'expectedSha256'] as const
  const keys = Reflect.ownKeys(input)
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key as typeof expectedKeys[number]))
  ) invalidLoad()

  const grantDescriptor = Object.getOwnPropertyDescriptor(input, 'grant')
  if (!grantDescriptor || !Object.hasOwn(grantDescriptor, 'value')) invalidLoad()
  const grant = assertGithubCoreActivationGrant(grantDescriptor.value)

  const value = (key: 'workspaceRoot' | 'taskId' | 'expectedSha256'): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalidLoad()
    return descriptor.value
  }
  const workspaceRoot = value('workspaceRoot')
  const taskId = value('taskId')
  const expectedSha256 = value('expectedSha256')
  if (
    typeof workspaceRoot !== 'string' ||
    typeof taskId !== 'string' ||
    typeof expectedSha256 !== 'string' ||
    taskId !== grant.taskId ||
    expectedSha256 !== grant.taskCardSha256
  ) invalidLoad()
  return Object.freeze({ workspaceRoot, taskId, expectedSha256, grant })
}

/**
 * Read the one canonical, ignored github.core task card for a task id.
 *
 * The generic reader owns confinement, file identity, bounded reads, UTF-8,
 * and duplicate-key safety; this wrapper preserves the GitHub parser/API.
 */
export async function loadGithubCoreActivationTaskCard(
  input: GithubCoreActivationTaskCardLoadInput,
): Promise<GithubCoreActivationTaskCard> {
  try {
    const loaded = await loadActivationTaskCard(input)
    const card = parseGithubCoreActivationTaskCard(loaded.parsed)
    if (card.localBoundary.root !== `.developer-lens/activation/${loaded.taskId}/`) invalidLoad()
    return card
  } catch (error) {
    if (error instanceof GithubCoreActivationTaskCardLoadError) throw error
    invalidLoad()
  }
}

/** Load and validate the card only when its stable opened bytes match the supplied SHA-256. */
export async function loadHashBoundGithubCoreActivationTaskCard(
  input: GithubCoreHashBoundActivationTaskCardLoadInput,
): Promise<GithubCoreActivationTaskCard> {
  try {
    const closed = snapshotGrantedHashBoundInput(input)
    const loaded = await loadHashBoundActivationTaskCard({
      workspaceRoot: closed.workspaceRoot,
      taskId: closed.taskId,
      expectedSha256: closed.expectedSha256,
    })
    const card = parseGithubCoreActivationTaskCard(loaded.parsed)
    if (card.localBoundary.root !== `.developer-lens/activation/${loaded.taskId}/`) invalidLoad()
    return card
  } catch (error) {
    if (error instanceof GithubCoreActivationTaskCardLoadError) throw error
    invalidLoad()
  }
}

export { portableFileIdentityMatches } from '../../activationTaskCardLoader.js'
