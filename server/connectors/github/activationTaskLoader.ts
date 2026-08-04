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
export type GithubCoreHashBoundActivationTaskCardLoadInput = HashBoundActivationTaskCardLoadInput

function invalidLoad(): never {
  throw new GithubCoreActivationTaskCardLoadError()
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

/** Load and validate the card only when its exact opened bytes match the reviewed SHA-256. */
export async function loadHashBoundGithubCoreActivationTaskCard(
  input: GithubCoreHashBoundActivationTaskCardLoadInput,
): Promise<GithubCoreActivationTaskCard> {
  try {
    const loaded = await loadHashBoundActivationTaskCard(input)
    const card = parseGithubCoreActivationTaskCard(loaded.parsed)
    if (card.localBoundary.root !== `.developer-lens/activation/${loaded.taskId}/`) invalidLoad()
    return card
  } catch (error) {
    if (error instanceof GithubCoreActivationTaskCardLoadError) throw error
    invalidLoad()
  }
}

export { portableFileIdentityMatches } from '../../activationTaskCardLoader.js'
