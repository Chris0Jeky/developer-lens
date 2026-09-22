/**
 * Every free-text `DashboardMeta.warnings` template a collector or demo producer emits.
 *
 * Producers call these builders instead of inlining strings, so the PublicLensProjection.v1
 * warning-code mapping (`shared/lensProjection.ts`) can be tested against the exact text that
 * reaches a dashboard: rewording a template here without updating that mapping fails
 * `shared/lensProjection.test.ts` instead of silently exporting `unrecognized_warning`.
 * Several templates interpolate repository names; that text stays local and only its registry
 * code is ever exported.
 */
export const COLLECTION_WARNINGS = {
  commitDaysGrouped: (repository: string) =>
    `${repository}: GitHub grouped more than 100 active commit days; per-repository commit fetching is used for detail.`,
  authoredPullRequestSearchCapped: () =>
    'GitHub search capped authored pull-request detail at 1,000 results; contribution totals retain the larger public count.',
  reviewRecordsTruncated: (repository: string, pullRequestNumber: number) =>
    `${repository}#${pullRequestNumber}: only the first 100 review records were inspected.`,
  reviewedPullRequestSearchCapped: () =>
    'GitHub search capped reviewed pull requests at 1,000; private review coverage may be partial.',
  authoredIssueSearchCapped: () =>
    'GitHub search capped authored issue detail at 1,000; contribution totals retain the larger public count.',
  commitDetailQueryFailed: (failedRepositories: number) =>
    `${failedRepositories} repositories could not be queried for detailed authored commits. Contribution totals remain available.`,
  lineStatisticsQueryFailed: (failedRepositories: number) =>
    `${failedRepositories} repositories could not be queried for authored line statistics.`,
  restrictedContributions: (restrictedCount: number) =>
    `${restrictedCount} contributions are restricted by GitHub privacy rules and cannot be attributed to repositories.`,
  localGitIdentityMissing: () =>
    'Local Git enrichment was skipped because no unambiguous author email identity was configured.',
  localRepositoryUnreadable: (repositoryName: string) =>
    `${repositoryName} could not be read; it was excluded from local enrichment.`,
  demoIllustrativeData: () =>
    'This is illustrative data. Run npm run collect to reveal your own development story.',
  hostedShowcase: () =>
    'This hosted showcase demonstrates the analytical engine; its statistics do not describe a person.',
} as const

export type CollectionWarningTemplate = keyof typeof COLLECTION_WARNINGS
