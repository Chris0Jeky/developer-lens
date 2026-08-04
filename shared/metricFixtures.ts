import type { MetricCoverageDimension } from './metrics.js'

/**
 * Invented metric-definition and metric-result fixtures for DL-METRIC-01.
 *
 * Everything here is fabricated. No fixture is derived from real, private, or generated data,
 * and no fixture names a person. DL-VALIDATE-01 consumes this module as the seed of the
 * analytical conformance corpus, so the exports are deliberately data, never assertions.
 */

/* ------------------------------------------------------------------------------------------ *
 * Definition fixtures
 * ------------------------------------------------------------------------------------------ */

/** A well-formed definition that is NOT in the registry: proves the schema accepts new metrics. */
export const REGISTERABLE_DEFINITION_FIXTURE: unknown = {
  metricId: 'release.publication_interval',
  version: '1.0.0',
  status: 'active',
  label: 'Interval between published releases',
  questionAnswered: 'How much time elapsed between consecutive published releases inside the window?',
  analyticalSubject: 'release_cohort',
  unit: 'days',
  semanticCategory: 'inter_event_interval',
  windowSemantics: 'half_open_utc_window',
  clockSource: 'injected_as_of',
  requiredCapabilities: ['cap.github.deployments'],
  requiredFields: [{ fieldPath: 'release.publishedAt', dataClass: 'C3', nullable: true }],
  eligibility: {
    cohortId: 'release.published_in_window',
    statement: 'Published releases whose publication event falls inside the half-open window.',
    inclusionRules: [{ ruleCode: 'PUBLISHED_IN_WINDOW', statement: 'The publication event falls inside the half-open window.' }],
    exclusionRules: [{ ruleCode: 'DRAFT_RELEASE', statement: 'The release was never published and has no publication event.' }],
  },
  event: {
    eventCode: 'RELEASE_PUBLISHED',
    statement: 'The publication of a release by the forge.',
    censoringRule: 'left_and_right_censor_at_window_bounds',
    censoringStatement: 'The first and last intervals of the window are censored because their neighbours lie outside it.',
  },
  missingness: {
    policy: 'exclude_from_eligible_cohort',
    truncationPolicy: 'report_with_truncation_limitation',
    statement: 'A release without a publication timestamp leaves the cohort under a named reason and is never imputed.',
  },
  formula: {
    kind: 'inter_event_interval_quantiles',
    procedureId: 'release.publication_interval_v1',
    eventCode: 'RELEASE_PUBLISHED',
    quantiles: [0.5, 0.9],
  },
  supportGates: {
    minimumEligible: 3,
    appliesTo: 'display_eligibility',
    emptyCohortExempt: true,
    belowGateBehaviour: 'render_as_range_only',
  },
  comparisonRequirements: {
    requiresMatchedWindow: false,
    minimumMatchedFraction: 0,
    incomparableOutcome: 'explicit_no_comparison',
    emptyCohortOutcome: 'explicit_empty_outcome',
  },
  sensitivityVariants: [
    { variantId: 'EXCLUDE_PRERELEASES', statement: 'Recompute counting stable releases only.', parameterChange: 'Add a prerelease exclusion rule to the cohort.' },
  ],
  knownConfounders: [
    { code: 'RELEASE_TRAIN_CHANGE', statement: 'A change of release cadence policy alters the interval without any change in the work.' },
  ],
  prohibitedInterpretations: [
    { code: 'NOT_PERSON_MEASURE', statement: 'A release interval is a property of a repository window and must never be attributed to an individual person.' },
    { code: 'NOT_DEMAND', statement: 'A longer interval does not establish that less was delivered inside it.' },
  ],
  coverageDimensions: ['completeness', 'eligibility', 'censoring_freedom', 'sample'],
  fixtureClasses: ['eligibility', 'missingness', 'censoring', 'boundary_dates', 'empty_eligible_cohort'],
  renderPolicy: {
    surfaces: ['atlas', 'evidence_drawer'],
    requiresDefinitionCard: true,
    requiresProhibitedInterpretations: true,
    exportSinks: ['api'],
    maximumDataClass: 'C1',
  },
  supersession: { supersededBy: null, supersededAt: null, reasonCode: null },
}

/**
 * The deliberately underspecified definition. Every failure below is a SCHEMA failure, not a
 * hand-written guard: no prohibited interpretations, no sensitivity variants, no confounders,
 * a duration formula that claims censoring is impossible, an incomplete coverage vector, and an
 * incomplete fixture suite.
 */
export const UNDERSPECIFIED_DEFINITION_FIXTURE: unknown = {
  metricId: 'pull_request.turnaround',
  version: '1.0.0',
  status: 'active',
  label: 'PR turnaround',
  questionAnswered: 'How fast are pull requests handled?',
  analyticalSubject: 'pull_request_cohort',
  unit: 'seconds',
  semanticCategory: 'lifecycle_duration',
  windowSemantics: 'half_open_utc_window',
  clockSource: 'injected_as_of',
  requiredCapabilities: ['github.core'],
  requiredFields: [{ fieldPath: 'pullRequest.mergedAt', dataClass: 'C1', nullable: true }],
  eligibility: {
    cohortId: 'pull_request.all',
    statement: 'All pull requests seen in the window.',
    inclusionRules: [{ ruleCode: 'SEEN_IN_WINDOW', statement: 'The pull request was seen inside the window.' }],
    exclusionRules: [],
  },
  event: {
    eventCode: 'PULL_REQUEST_MERGED',
    statement: 'The merge event recorded by the forge.',
    censoringRule: 'no_censoring_possible',
    censoringStatement: 'Censoring was not considered for this definition.',
  },
  missingness: {
    policy: 'exclude_from_eligible_cohort',
    truncationPolicy: 'report_with_truncation_limitation',
    statement: 'Missing endpoints are dropped from the cohort.',
  },
  formula: {
    kind: 'duration_quantiles',
    procedureId: 'pull_request.turnaround_v1',
    startEventCode: 'PULL_REQUEST_OPENED',
    endEventCode: 'PULL_REQUEST_MERGED',
    quantiles: [0.5],
  },
  supportGates: {
    minimumEligible: 5,
    appliesTo: 'display_eligibility',
    emptyCohortExempt: true,
    belowGateBehaviour: 'suppress_display',
  },
  comparisonRequirements: {
    requiresMatchedWindow: true,
    minimumMatchedFraction: 0.5,
    incomparableOutcome: 'explicit_no_comparison',
    emptyCohortOutcome: 'explicit_empty_outcome',
  },
  sensitivityVariants: [],
  knownConfounders: [],
  prohibitedInterpretations: [],
  coverageDimensions: ['completeness'],
  fixtureClasses: ['eligibility'],
  renderPolicy: {
    surfaces: ['atlas'],
    requiresDefinitionCard: true,
    requiresProhibitedInterpretations: true,
    exportSinks: ['api'],
    maximumDataClass: 'C1',
  },
  supersession: { supersededBy: null, supersededAt: null, reasonCode: null },
}

/**
 * Structurally incomplete rather than empty: every required list is populated, so the failures
 * come from the cross-field schema rules — a duration formula that denies censoring, a coverage
 * vector missing dimensions the definition's own settings require, and a short fixture suite.
 */
export const STRUCTURALLY_INCOMPLETE_DEFINITION_FIXTURE: unknown = {
  ...(UNDERSPECIFIED_DEFINITION_FIXTURE as Record<string, unknown>),
  metricId: 'pull_request.turnaround_incomplete',
  sensitivityVariants: [
    { variantId: 'ALTERNATIVE_START', statement: 'Recompute from the opening event instead.', parameterChange: 'Swap the cohort start event.' },
  ],
  knownConfounders: [
    { code: 'RELEASE_FREEZE', statement: 'A release freeze lengthens intervals without any change in how work is done.' },
  ],
  prohibitedInterpretations: [
    { code: 'NOT_PERSON_MEASURE', statement: 'This is a cohort property and must never be read as a measure of any individual person.' },
  ],
}

/** A blended person-scoring scalar. Subject, unit, category, and formula kind are all unrepresentable. */
export const BLENDED_SCALAR_DEFINITION_FIXTURE: unknown = {
  ...(REGISTERABLE_DEFINITION_FIXTURE as Record<string, unknown>),
  metricId: 'team.engagement_index',
  label: 'Team engagement index',
  questionAnswered: 'How engaged is the team overall this window?',
  analyticalSubject: 'contributor',
  unit: 'score',
  semanticCategory: 'engagement',
  formula: {
    kind: 'weighted_composite',
    procedureId: 'team.engagement_index_v1',
    weights: { commits: 0.4, reviews: 0.3, issues: 0.3 },
  },
}

/** Enum members are all legal here; only the explicit forbidden-construct validation rejects it. */
export const PERSON_SCORING_IDENTIFIER_FIXTURE: unknown = {
  ...(REGISTERABLE_DEFINITION_FIXTURE as Record<string, unknown>),
  metricId: 'repository.developer_activity_rollup',
  label: 'Developer activity rollup',
}

/** X-class fields can never be metric inputs; the field class enum has no `X` member. */
export const X_CLASS_FIELD_DEFINITION_FIXTURE: unknown = {
  ...(REGISTERABLE_DEFINITION_FIXTURE as Record<string, unknown>),
  metricId: 'release.publication_interval_with_secret_input',
  requiredFields: [{ fieldPath: 'release.rawProviderBlob', dataClass: 'X', nullable: false }],
}

/** A definition that claims supersession by an older version of itself. */
export const BACKWARDS_SUPERSESSION_FIXTURE: unknown = {
  ...(REGISTERABLE_DEFINITION_FIXTURE as Record<string, unknown>),
  version: '2.0.0',
  status: 'superseded',
  fixtureClasses: ['eligibility', 'missingness', 'censoring', 'boundary_dates', 'empty_eligible_cohort', 'version_supersession'],
  supersession: {
    supersededBy: { metricId: 'release.publication_interval', version: '1.0.0' },
    supersededAt: '2026-08-04T00:00:00.000Z',
    reasonCode: 'ROLLED_BACK',
  },
}

/* ------------------------------------------------------------------------------------------ *
 * Result fixtures
 * ------------------------------------------------------------------------------------------ */

const INTERVAL_DIMENSIONS: readonly MetricCoverageDimension[] = [
  'permission', 'completeness', 'eligibility', 'freshness', 'censoring_freedom', 'sample', 'comparability',
]
const COUNT_DIMENSIONS: readonly MetricCoverageDimension[] = [
  'permission', 'completeness', 'eligibility', 'freshness', 'comparability',
]

function completeCoverage(dimensions: readonly MetricCoverageDimension[]): unknown[] {
  return dimensions.map((dimension) => ({ dimension, value: 1, limitingReason: null }))
}

function limitedCoverage(
  dimensions: readonly MetricCoverageDimension[],
  limited: Partial<Record<MetricCoverageDimension, { value: number | null; limitingReason: string | null }>>,
): unknown[] {
  return dimensions.map((dimension) => {
    const override = limited[dimension]
    return {
      dimension,
      value: override ? override.value : 1,
      limitingReason: override ? override.limitingReason : null,
    }
  })
}

const JULY_WINDOW = { start: '2026-07-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z' }
const AS_OF = '2026-08-01T00:00:00.000Z'

const INTERVAL_CALCULATION = {
  procedureId: 'pull_request.interval_quantiles_v2',
  metricContractVersion: '1.0.0',
  engineVersion: '1.0.0',
}
const COUNT_CALCULATION = {
  procedureId: 'pull_request.ready_count_v1',
  metricContractVersion: '1.0.0',
  engineVersion: '1.0.0',
}

/** A normal observed distribution over a completed window. */
export const OBSERVED_INTERVAL_RESULT: unknown = {
  resultId: 'result-observed-interval',
  metricId: 'pull_request.integration_interval',
  metricVersion: '1.1.0',
  scopeAlias: 'scope-alpha',
  window: JULY_WINDOW,
  asOf: AS_OF,
  state: 'observed',
  stateReasonCode: 'OBSERVED',
  counts: { eligible: 14, censored: 2, excluded: [{ reasonCode: 'NEVER_READY_FOR_REVIEW', count: 3 }] },
  value: {
    kind: 'quantiles',
    sampleSize: 12,
    quantiles: [
      { quantile: 0.5, value: 43200 },
      { quantile: 0.75, value: 90000 },
      { quantile: 0.9, value: 208800 },
    ],
  },
  coverage: completeCoverage(INTERVAL_DIMENSIONS),
  evidenceIds: ['claim-interval-1'],
  calculation: INTERVAL_CALCULATION,
  sensitivity: [
    {
      variantId: 'EXCLUDE_LONG_TAIL',
      state: 'observed',
      value: { kind: 'quantiles', sampleSize: 10, quantiles: [{ quantile: 0.5, value: 39600 }] },
    },
  ],
}

/**
 * THE issue-#67 exemplar. A fully covered July with zero eligible ready-for-review events:
 * the count reads an observed 0, the row carries EMPTY_ELIGIBLE_COHORT, and it is a distinct
 * state from unavailable, truncated, censored, and coverage_failed.
 */
export const EMPTY_ELIGIBLE_COHORT_COUNT_RESULT: unknown = {
  resultId: 'result-empty-count',
  metricId: 'pull_request.ready_event_count',
  metricVersion: '1.0.0',
  scopeAlias: 'scope-alpha',
  window: JULY_WINDOW,
  asOf: AS_OF,
  state: 'empty_eligible_cohort',
  stateReasonCode: 'EMPTY_ELIGIBLE_COHORT',
  counts: { eligible: 0, censored: 0, excluded: [{ reasonCode: 'NEVER_READY_FOR_REVIEW', count: 2 }] },
  value: { kind: 'count', observedCount: 0 },
  coverage: completeCoverage(COUNT_DIMENSIONS),
  evidenceIds: ['claim-empty-count-1'],
  calculation: COUNT_CALCULATION,
  sensitivity: [],
}

/** The same quiet window for a duration metric: sample 0, distribution explicitly null. */
export const EMPTY_ELIGIBLE_COHORT_DISTRIBUTION_RESULT: unknown = {
  resultId: 'result-empty-distribution',
  metricId: 'pull_request.integration_interval',
  metricVersion: '1.1.0',
  scopeAlias: 'scope-alpha',
  window: JULY_WINDOW,
  asOf: AS_OF,
  state: 'empty_eligible_cohort',
  stateReasonCode: 'EMPTY_ELIGIBLE_COHORT',
  counts: { eligible: 0, censored: 0, excluded: [] },
  value: { kind: 'quantiles', sampleSize: 0, quantiles: null },
  coverage: completeCoverage(INTERVAL_DIMENSIONS),
  evidenceIds: [],
  calculation: INTERVAL_CALCULATION,
  sensitivity: [],
}

/** The forbidden shape: a fabricated zero-duration distribution over an empty sample. */
export const FABRICATED_ZERO_DURATION_RESULT: unknown = {
  ...(EMPTY_ELIGIBLE_COHORT_DISTRIBUTION_RESULT as Record<string, unknown>),
  resultId: 'result-fabricated-zero',
  value: { kind: 'quantiles', sampleSize: 0, quantiles: [{ quantile: 0.5, value: 0 }] },
}

/** An empty cohort asserted over coverage that is not complete: must be rejected. */
export const EMPTY_COHORT_UNDER_PARTIAL_COVERAGE_RESULT: unknown = {
  ...(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT as Record<string, unknown>),
  resultId: 'result-empty-partial-coverage',
  coverage: limitedCoverage(COUNT_DIMENSIONS, {
    completeness: { value: 0.4, limitingReason: 'PARTIAL_SOURCE_WINDOW' },
  }),
}

/** An empty cohort asserted before the window has finished: must be rejected. */
export const EMPTY_COHORT_BEFORE_WINDOW_END_RESULT: unknown = {
  ...(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT as Record<string, unknown>),
  resultId: 'result-empty-open-window',
  asOf: '2026-07-15T00:00:00.000Z',
}

/** Not measurable at all: no capability, therefore no value and no zero. */
export const UNAVAILABLE_RESULT: unknown = {
  resultId: 'result-unavailable',
  metricId: 'pull_request.ready_event_count',
  metricVersion: '1.0.0',
  scopeAlias: 'scope-alpha',
  window: JULY_WINDOW,
  asOf: AS_OF,
  state: 'unavailable',
  stateReasonCode: 'CAPABILITY_NEVER_AUTHORIZED',
  counts: { eligible: 0, censored: 0, excluded: [] },
  value: { kind: 'no_value', reasonCode: 'CAPABILITY_NEVER_AUTHORIZED' },
  coverage: limitedCoverage(COUNT_DIMENSIONS, {
    permission: { value: null, limitingReason: 'NEVER_AUTHORIZED' },
    completeness: { value: null, limitingReason: 'NEVER_AUTHORIZED' },
  }),
  evidenceIds: [],
  calculation: COUNT_CALCULATION,
  sensitivity: [],
}

/** Coverage saturated: a partial reading with an explicit truncation limitation. */
export const TRUNCATED_RESULT: unknown = {
  resultId: 'result-truncated',
  metricId: 'pull_request.ready_event_count',
  metricVersion: '1.0.0',
  scopeAlias: 'scope-alpha',
  window: JULY_WINDOW,
  asOf: AS_OF,
  state: 'truncated',
  stateReasonCode: 'SOURCE_PAGE_LIMIT_REACHED',
  counts: { eligible: 40, censored: 0, excluded: [] },
  value: { kind: 'count', observedCount: 40 },
  coverage: limitedCoverage(COUNT_DIMENSIONS, {
    completeness: { value: 0.6, limitingReason: 'SOURCE_PAGE_LIMIT_REACHED' },
  }),
  evidenceIds: ['claim-truncated-1'],
  calculation: COUNT_CALCULATION,
  sensitivity: [],
}

/** Every eligible unit is right-censored: no distribution, and never a zero. */
export const CENSORED_ONLY_RESULT: unknown = {
  resultId: 'result-censored-only',
  metricId: 'pull_request.integration_interval',
  metricVersion: '1.1.0',
  scopeAlias: 'scope-alpha',
  window: JULY_WINDOW,
  asOf: AS_OF,
  state: 'censored_only',
  stateReasonCode: 'ALL_ELIGIBLE_EVENTS_CENSORED',
  counts: { eligible: 4, censored: 4, excluded: [] },
  value: { kind: 'no_value', reasonCode: 'ALL_ELIGIBLE_EVENTS_CENSORED' },
  coverage: limitedCoverage(INTERVAL_DIMENSIONS, {
    censoring_freedom: { value: 0, limitingReason: 'ALL_UNITS_RIGHT_CENSORED' },
  }),
  evidenceIds: ['claim-censored-1'],
  calculation: INTERVAL_CALCULATION,
  sensitivity: [],
}

/** The collection itself failed: distinct from a genuinely quiet window. */
export const COVERAGE_FAILED_RESULT: unknown = {
  ...(UNAVAILABLE_RESULT as Record<string, unknown>),
  resultId: 'result-coverage-failed',
  state: 'coverage_failed',
  stateReasonCode: 'COLLECTION_FAILED',
  value: { kind: 'no_value', reasonCode: 'COLLECTION_FAILED' },
  coverage: limitedCoverage(COUNT_DIMENSIONS, {
    completeness: { value: null, limitingReason: 'COLLECTION_FAILED' },
    freshness: { value: null, limitingReason: 'COLLECTION_FAILED' },
  }),
}

/** Observed but below the definition's minimum support gate: the row exists, display is gated. */
export const LOW_SUPPORT_OBSERVED_RESULT: unknown = {
  ...(OBSERVED_INTERVAL_RESULT as Record<string, unknown>),
  resultId: 'result-low-support',
  counts: { eligible: 3, censored: 0, excluded: [] },
  value: { kind: 'quantiles', sampleSize: 3, quantiles: [{ quantile: 0.5, value: 50400 }] },
  sensitivity: [],
}

/** A result pinned to the superseded v1.0.0 definition; it must still resolve for rendering. */
export const SUPERSEDED_PINNED_RESULT: unknown = {
  ...(OBSERVED_INTERVAL_RESULT as Record<string, unknown>),
  resultId: 'result-superseded-pinned',
  metricVersion: '1.0.0',
  counts: { eligible: 9, censored: 1, excluded: [{ reasonCode: 'MISSING_OPEN_TIMESTAMP', count: 1 }] },
  calculation: { procedureId: 'pull_request.interval_quantiles_v1', metricContractVersion: '1.0.0', engineVersion: '1.0.0' },
  sensitivity: [],
}

/** A metric nobody registered. Exposure must fail closed. */
export const UNREGISTERED_METRIC_RESULT: unknown = {
  ...(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT as Record<string, unknown>),
  resultId: 'result-unregistered',
  metricId: 'pull_request.vibe_check',
  metricVersion: '1.0.0',
}

/** Boundary date: an event exactly at the window end belongs to the next window, so July is empty. */
export const BOUNDARY_EVENT_AT_WINDOW_END_RESULT: unknown = {
  ...(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT as Record<string, unknown>),
  resultId: 'result-boundary-window-end',
  counts: { eligible: 0, censored: 0, excluded: [{ reasonCode: 'NEVER_READY_FOR_REVIEW', count: 1 }] },
}

/** A degenerate window whose start equals its end. */
export const ZERO_LENGTH_WINDOW_RESULT: unknown = {
  ...(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT as Record<string, unknown>),
  resultId: 'result-zero-length-window',
  window: { start: JULY_WINDOW.end, end: JULY_WINDOW.end },
}

/** A result whose coverage vector omits a dimension the definition declares it consumes. */
export const MISSING_COVERAGE_DIMENSION_RESULT: unknown = {
  ...(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT as Record<string, unknown>),
  resultId: 'result-missing-dimension',
  coverage: completeCoverage(['permission', 'completeness', 'eligibility', 'freshness']),
}

/** A result whose excluded reason is not one of the definition's exclusion rules. */
export const UNDECLARED_EXCLUSION_REASON_RESULT: unknown = {
  ...(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT as Record<string, unknown>),
  resultId: 'result-undeclared-exclusion',
  counts: { eligible: 0, censored: 0, excluded: [{ reasonCode: 'FELT_WRONG', count: 1 }] },
}

const SHARE_DIMENSIONS: readonly MetricCoverageDimension[] = [
  'permission', 'completeness', 'eligibility', 'freshness', 'consistency', 'sample', 'parser_coverage', 'comparability',
]
const SHARE_CALCULATION = {
  procedureId: 'check_run.first_attempt_pass_share_v1',
  metricContractVersion: '1.0.0',
  engineVersion: '1.0.0',
}

/** An observed proportion above its support gate. */
export const OBSERVED_SHARE_RESULT: unknown = {
  resultId: 'result-observed-share',
  metricId: 'check_run.first_attempt_pass_share',
  metricVersion: '1.0.0',
  scopeAlias: 'scope-alpha',
  window: JULY_WINDOW,
  asOf: AS_OF,
  state: 'observed',
  stateReasonCode: 'OBSERVED',
  counts: { eligible: 48, censored: 1, excluded: [{ reasonCode: 'CANCELLED_BEFORE_CONCLUSION', count: 4 }] },
  value: { kind: 'proportion', numerator: 31, denominator: 48 },
  coverage: completeCoverage(SHARE_DIMENSIONS),
  evidenceIds: ['claim-share-1'],
  calculation: SHARE_CALCULATION,
  sensitivity: [
    {
      variantId: 'INCLUDE_CANCELLED_AS_UNKNOWN',
      state: 'observed',
      value: { kind: 'proportion', numerator: 31, denominator: 52 },
    },
  ],
}

/** Below the ten-series support gate of a `suppress_display` metric: the row still exists. */
export const LOW_SUPPORT_SHARE_RESULT: unknown = {
  ...(OBSERVED_SHARE_RESULT as Record<string, unknown>),
  resultId: 'result-low-support-share',
  counts: { eligible: 6, censored: 0, excluded: [] },
  value: { kind: 'proportion', numerator: 4, denominator: 6 },
  sensitivity: [],
}

/** A proportion over an empty eligible cohort is not computable — and is never a zero share. */
export const EMPTY_ELIGIBLE_COHORT_SHARE_RESULT: unknown = {
  resultId: 'result-empty-share',
  metricId: 'check_run.first_attempt_pass_share',
  metricVersion: '1.0.0',
  scopeAlias: 'scope-alpha',
  window: JULY_WINDOW,
  asOf: AS_OF,
  state: 'empty_eligible_cohort',
  stateReasonCode: 'EMPTY_ELIGIBLE_COHORT',
  counts: { eligible: 0, censored: 0, excluded: [{ reasonCode: 'MISSING_CONCLUSION', count: 2 }] },
  value: { kind: 'no_value', reasonCode: 'EMPTY_ELIGIBLE_COHORT' },
  coverage: completeCoverage(SHARE_DIMENSIONS),
  evidenceIds: [],
  calculation: SHARE_CALCULATION,
  sensitivity: [],
}

/** The forbidden shape for a share: an empty cohort reported as a zero proportion. */
export const FABRICATED_ZERO_SHARE_RESULT: unknown = {
  ...(EMPTY_ELIGIBLE_COHORT_SHARE_RESULT as Record<string, unknown>),
  resultId: 'result-fabricated-zero-share',
  value: { kind: 'proportion', numerator: 0, denominator: 1 },
}

/** A count result claimed for a duration metric: the value shape contradicts the formula. */
export const VALUE_SHAPE_MISMATCH_RESULT: unknown = {
  ...(OBSERVED_INTERVAL_RESULT as Record<string, unknown>),
  resultId: 'result-value-shape-mismatch',
  value: { kind: 'count', observedCount: 12 },
  sensitivity: [],
}
