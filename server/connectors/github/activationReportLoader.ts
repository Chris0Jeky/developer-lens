import {
  loadHashBoundActivationLastRunReport,
  type HashBoundActivationArtifactLoadInput,
} from '../../activationArtifactLoader.js'
import {
  parseGithubCoreActivationReport,
  type GithubCoreActivationReport,
} from './activationReport.js'

export const GITHUB_CORE_ACTIVATION_REPORT_LOAD_ERROR_CODE =
  'INVALID_GITHUB_CORE_ACTIVATION_REPORT_LOAD' as const

export class GithubCoreActivationReportLoadError extends Error {
  readonly code = GITHUB_CORE_ACTIVATION_REPORT_LOAD_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_ACTIVATION_REPORT_LOAD_ERROR_CODE)
    this.name = 'GithubCoreActivationReportLoadError'
  }
}

export type GithubCoreActivationReportLoadInput = HashBoundActivationArtifactLoadInput

function invalidLoad(): never {
  throw new GithubCoreActivationReportLoadError()
}

/**
 * Load the fixed local-C2 report only when two stable reads match an external SHA-256.
 *
 * A matching digest proves observed bytes only. It does not prove report origin, owner review,
 * trusted time, card/key binding, authorization, continuity, renewal, or source completeness.
 */
export async function loadHashBoundGithubCoreActivationReport(
  input: GithubCoreActivationReportLoadInput,
): Promise<GithubCoreActivationReport> {
  try {
    const loaded = await loadHashBoundActivationLastRunReport(input)
    const report = parseGithubCoreActivationReport(loaded.parsed)
    if (report.taskId !== loaded.taskId) invalidLoad()
    return report
  } catch (error) {
    if (error instanceof GithubCoreActivationReportLoadError) throw error
    invalidLoad()
  }
}
