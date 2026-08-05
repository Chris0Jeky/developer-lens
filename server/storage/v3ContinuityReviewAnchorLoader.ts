import {
  loadHashBoundContinuityReviewAnchorArtifact,
  type HashBoundActivationArtifactLoadInput,
} from '../activationArtifactLoader.js'
import {
  parseGithubCoreContinuityReviewAnchor,
  type GithubCoreContinuityReviewAnchor,
} from './v3ContinuityReviewAnchor.js'

export const GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_LOAD_ERROR_CODE =
  'INVALID_GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_LOAD' as const

export class GithubCoreContinuityReviewAnchorLoadError extends Error {
  readonly code = GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_LOAD_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_LOAD_ERROR_CODE)
    this.name = 'GithubCoreContinuityReviewAnchorLoadError'
  }
}

export type GithubCoreContinuityReviewAnchorLoadInput = HashBoundActivationArtifactLoadInput
export type LoadedGithubCoreContinuityReviewAnchor = Readonly<{
  taskId: string
  sha256: string
  anchor: GithubCoreContinuityReviewAnchor
}>

function invalidLoad(): never {
  throw new GithubCoreContinuityReviewAnchorLoadError()
}

/**
 * Load and parse the fixed local-C2 continuity review anchor without activating any caller.
 *
 * Equality between the external SHA-256 and the digest of the observed stable bytes proves
 * observed bytes only. It does not authenticate owner identity, review or approval, establish
 * trusted time, bind a report, task card, key, lifecycle, CAS state, retention, or completeness,
 * authorize or renew continuity, or prove authorization, provenance, or lifecycle state.
 */
export async function loadHashBoundGithubCoreContinuityReviewAnchor(
  input: unknown,
): Promise<LoadedGithubCoreContinuityReviewAnchor> {
  try {
    const loaded = await loadHashBoundContinuityReviewAnchorArtifact(input)
    const anchor = parseGithubCoreContinuityReviewAnchor(loaded.parsed)
    if (anchor.taskId !== loaded.taskId) invalidLoad()
    return Object.freeze({ taskId: loaded.taskId, sha256: loaded.sha256, anchor })
  } catch (error) {
    if (error instanceof GithubCoreContinuityReviewAnchorLoadError) throw error
    invalidLoad()
  }
}
