import {
  loadActivationTaskCardArtifact,
  loadHashBoundActivationTaskCardArtifact,
  parseJsonWithoutDuplicateKeys,
  portableFileIdentityMatches,
  type ActivationArtifactLoaderHooks,
  type ActivationArtifactLoadInput,
  type HashBoundActivationArtifactLoadInput,
  type LoadedActivationArtifact,
} from './activationArtifactLoader.js'

export const ACTIVATION_TASK_CARD_LOAD_ERROR_CODE = 'INVALID_ACTIVATION_TASK_CARD_LOAD' as const

export class ActivationTaskCardLoadError extends Error {
  readonly code = ACTIVATION_TASK_CARD_LOAD_ERROR_CODE

  constructor() {
    super(ACTIVATION_TASK_CARD_LOAD_ERROR_CODE)
    this.name = 'ActivationTaskCardLoadError'
  }
}

export type ActivationTaskCardLoadInput = ActivationArtifactLoadInput
export type HashBoundActivationTaskCardLoadInput = HashBoundActivationArtifactLoadInput
export type LoadedActivationTaskCard = LoadedActivationArtifact

function invalidLoad(): never {
  throw new ActivationTaskCardLoadError()
}

async function loadCard(
  input: unknown,
  hashBound: boolean,
  hooks?: ActivationArtifactLoaderHooks,
): Promise<LoadedActivationTaskCard> {
  try {
    return hashBound
      ? await loadHashBoundActivationTaskCardArtifact(input, invalidLoad)
      : await loadActivationTaskCardArtifact(input, invalidLoad, hooks)
  } catch (error) {
    if (error instanceof ActivationTaskCardLoadError) throw error
    invalidLoad()
  }
}

/** Read one canonical, confined activation card without parsing or echoing its content. */
export async function loadActivationTaskCard(
  input: ActivationTaskCardLoadInput,
): Promise<LoadedActivationTaskCard> {
  return loadCard(input, false)
}

/** Bind one stable canonical card snapshot to a caller-supplied lowercase SHA-256. */
export async function loadHashBoundActivationTaskCard(
  input: HashBoundActivationTaskCardLoadInput,
): Promise<LoadedActivationTaskCard> {
  return loadCard(input, true)
}

async function loadWithHooks(
  input: ActivationTaskCardLoadInput,
  hooks: ActivationArtifactLoaderHooks,
): Promise<LoadedActivationTaskCard> {
  return loadCard(input, false, hooks)
}

/** @internal Invented-fixture seam only; production callers must use the closed public functions. */
export const activationTaskCardLoaderTestSeams = Object.freeze({
  loadWithHooks,
})

export { parseJsonWithoutDuplicateKeys, portableFileIdentityMatches }
