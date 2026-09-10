
export interface PullRequestObservation {
  id: string
  createdAt: number
  mergedAt: number | null
  closedAt: number | null
  additions: number | null
  deletions: number | null
  changedFiles: number | null
}

export type Outcome = 'merged' | 'closed_without_merge' | 'right_censored'

export function toSurvivalRow(
  pr: PullRequestObservation,
  windowEndExclusive: number,
): {
  durationHours: number
  outcome: Outcome
  batchPrimary: number | null
  batchSensitivity: number | null
} {
  const mergedInWindow = pr.mergedAt != null && pr.mergedAt < windowEndExclusive
  const closedInWindow = pr.closedAt != null && pr.closedAt < windowEndExclusive
  const terminal = mergedInWindow
    ? pr.mergedAt!
    : closedInWindow
      ? pr.closedAt!
      : windowEndExclusive
  const outcome: Outcome =
    mergedInWindow ? 'merged'
    : closedInWindow ? 'closed_without_merge'
    : 'right_censored'

  return {
    durationHours: Math.max(0, terminal - pr.createdAt) / 3_600_000,
    outcome,
    batchPrimary: pr.changedFiles,
    batchSensitivity:
      pr.additions == null || pr.deletions == null
        ? null
        : Math.log1p(pr.additions + pr.deletions),
  }
}

/**
 * V1 cohort recommendation:
 * - include PRs created inside [windowStart, windowEndExclusive);
 * - merged is the event of interest;
 * - closed without merge is a competing outcome;
 * - still open at window end is right-censored;
 * - group thresholds and support floors are versioned method parameters.
 */
