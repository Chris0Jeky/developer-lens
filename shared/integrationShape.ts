import {
  computeIntegrationIntervalResult,
  conformsToGolden,
  constructSignature,
  nearestRankQuantile,
  type IntervalWindowSpec,
  type PullRequestLifecycle,
} from './conformance.js'
import {
  formatMetricReference,
  validateMetricResult,
  type MetricResult,
  type MetricValue,
} from './metrics.js'
import {
  compareMatchedWindows,
  isComparable,
  windowDurationMs,
  type ComparisonInput,
  type ComparisonResult,
  type HalfOpenWindow,
  type Instrument,
} from './comparison.js'
import type {
  AlternativeExplanation,
  DiscriminatingEvidence,
  Finding,
  FindingCoverageEntry,
  FindingRobustness,
  MetricResultReference,
  RenderedMark,
  AnalyticReference,
} from './findings.js'
import type { LimitationInstance } from './claims.js'

/**
 * DL-VALUE-01 — the first deterministic comparative finding: PR integration shape across matched
 * windows. This is the client-safe half of the composition (imports only zod-backed contracts,
 * never `shared/claims.ts` or `shared/findings.ts` at value level, so no `node:crypto` reaches the
 * browser bundle — findings/claims types are erased `import type`s). `server/analysis/integrationShape.ts`
 * assembles the same content into a Finding and runs `validateFinding`/`assertRenderableFinding`, so
 * the constants below are the single source of truth for the copy that the finding contract validates
 * and the Atlas panel renders.
 *
 * Every fact is invented C1: no account, repository, person, or private history is read. The scope
 * ALIAS (`scope-integration-demo`) lives only on the metric results and the comparison spec; the
 * finding and every evidence projection carry the content-free `scope_id` SURROGATE instead — the
 * alias→surrogate strip point (PR #89 review note) is exactly the boundary between the comparison
 * output and the finding, right here.
 */
export const INTEGRATION_SHAPE_METHOD_VERSION = '1.0.0' as const

export const INTEGRATION_INTERVAL_METRIC = { metricId: 'pull_request.integration_interval', version: '1.1.0' } as const
export const INTEGRATION_INTERVAL_REFERENCE = formatMetricReference(INTEGRATION_INTERVAL_METRIC)
export const INTEGRATION_SHAPE_COHORT_ID = 'pull_request.became_ready_in_window' as const

/** Equal-duration, non-overlapping matched windows (28 days each), both complete at the injected asOf. */
export const BASELINE_WINDOW: HalfOpenWindow = { start: '2026-06-01T00:00:00.000Z', end: '2026-06-29T00:00:00.000Z' }
export const CURRENT_WINDOW: HalfOpenWindow = { start: '2026-06-29T00:00:00.000Z', end: '2026-07-27T00:00:00.000Z' }
export const INTEGRATION_SHAPE_AS_OF = '2026-07-27T00:00:00.000Z' as const

/** C2-ish installation alias — never leaves the metric/comparison layer. */
export const INTEGRATION_SHAPE_SCOPE_ALIAS = 'scope-integration-demo' as const
/** The content-free C1 scope surrogate the finding and every evidence projection carry instead. */
export const INTEGRATION_SHAPE_SCOPE_ID = `scope-${'1a'.repeat(32)}` as const

export const CURRENT_RESULT_ID = 'integration-shape-current' as const
export const BASELINE_RESULT_ID = 'integration-shape-baseline' as const

export const INTEGRATION_SHAPE_QUESTION =
  'How did PR integration shape differ between this window and the preceding matched window?'
export const INTEGRATION_SHAPE_COHORT_STATEMENT =
  'Pull requests that became ready for review inside each matched 28-day window (becameReadyAt = readyForReviewAt when present, otherwise createdAt). Merge is the terminal event; pull requests still open at a window boundary are right-censored there; a close without merge leaves the risk set as a competing terminal outcome; pull requests whose entry point cannot be placed are excluded with a typed reason.'

const SECONDS_PER_DAY = 86400
const ms = (instant: string): number => Date.parse(instant)

/* ------------------------------------------------------------------------------------------ *
 * Invented lifecycle fixtures — one list per matched window, each with a small excluded set.
 * ------------------------------------------------------------------------------------------ */

export const BASELINE_LIFECYCLES: readonly PullRequestLifecycle[] = [
  { opaqueId: 'b1', createdAt: '2026-06-02T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-06-04T00:00:00.000Z', closedAt: null },
  { opaqueId: 'b2', createdAt: '2026-06-03T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-06-06T00:00:00.000Z', closedAt: null },
  { opaqueId: 'b3', createdAt: '2026-06-05T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-06-09T00:00:00.000Z', closedAt: null },
  { opaqueId: 'b4', createdAt: '2026-06-06T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-06-11T00:00:00.000Z', closedAt: null },
  { opaqueId: 'b5', createdAt: '2026-06-08T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-06-15T00:00:00.000Z', closedAt: null },
  { opaqueId: 'b6', createdAt: '2026-06-10T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-06-20T00:00:00.000Z', closedAt: null },
  // Two still open at the June boundary: right-censored, counted, never scored as merged.
  { opaqueId: 'b7', createdAt: '2026-06-20T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
  { opaqueId: 'b8', createdAt: '2026-06-25T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
  // Excluded with typed reasons: entry point before the window, and no derivable entry point.
  { opaqueId: 'bx1', createdAt: '2026-05-20T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
  { opaqueId: 'bx2', createdAt: null, readyForReviewAt: null, mergedAt: null, closedAt: null },
]

export const CURRENT_LIFECYCLES: readonly PullRequestLifecycle[] = [
  { opaqueId: 'c1', createdAt: '2026-06-30T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-01T00:00:00.000Z', closedAt: null },
  { opaqueId: 'c2', createdAt: '2026-07-01T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-03T00:00:00.000Z', closedAt: null },
  { opaqueId: 'c3', createdAt: '2026-07-02T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-04T00:00:00.000Z', closedAt: null },
  { opaqueId: 'c4', createdAt: '2026-07-05T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-08T00:00:00.000Z', closedAt: null },
  { opaqueId: 'c5', createdAt: '2026-07-06T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-10T00:00:00.000Z', closedAt: null },
  { opaqueId: 'c6', createdAt: '2026-07-08T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-13T00:00:00.000Z', closedAt: null },
  // Three still open at the July boundary: right-censored.
  { opaqueId: 'c7', createdAt: '2026-07-15T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
  { opaqueId: 'c8', createdAt: '2026-07-18T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
  { opaqueId: 'c9', createdAt: '2026-07-20T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
  // One closed without merging: a competing terminal outcome (issue #82) — eligible, out of the
  // merged sample, and NOT right-censored, so the sample falls below eligible − censored.
  { opaqueId: 'c10', createdAt: '2026-07-10T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: '2026-07-22T00:00:00.000Z' },
  { opaqueId: 'cx1', createdAt: '2026-06-20T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
  { opaqueId: 'cx2', createdAt: null, readyForReviewAt: null, mergedAt: null, closedAt: null },
]

/** A fully covered current window that genuinely contained zero eligible pull requests (issue #67). */
export const EMPTY_CURRENT_LIFECYCLES: readonly PullRequestLifecycle[] = [
  { opaqueId: 'e1', createdAt: '2026-05-01T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
]

/** A current window whose merged sample sits below the metric's minimum support (5): forces abstention. */
export const LOW_SUPPORT_CURRENT_LIFECYCLES: readonly PullRequestLifecycle[] = [
  { opaqueId: 'l1', createdAt: '2026-06-30T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-02T00:00:00.000Z', closedAt: null },
  { opaqueId: 'l2', createdAt: '2026-07-02T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-05T00:00:00.000Z', closedAt: null },
  { opaqueId: 'l3', createdAt: '2026-07-05T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-09T00:00:00.000Z', closedAt: null },
  { opaqueId: 'l4', createdAt: '2026-07-18T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
]

/* ------------------------------------------------------------------------------------------ *
 * Composition procedure. The registry-conformant base is `computeIntegrationIntervalResult`
 * (the merged DL-VALIDATE-01 reference procedure), extended with the two sensitivity variants the
 * v1.1.0 definition declares. Adding sensitivity leaves the construct signature untouched, so the
 * result still passes `conformsToGolden` against the reference procedure's own output.
 * ------------------------------------------------------------------------------------------ */

const DECLARED_QUANTILES = [0.5, 0.75, 0.9] as const

function windowSpec(window: HalfOpenWindow, resultId: string): IntervalWindowSpec {
  return {
    windowStart: window.start,
    windowEnd: window.end,
    asOf: INTEGRATION_SHAPE_AS_OF,
    scopeAlias: INTEGRATION_SHAPE_SCOPE_ALIAS,
    resultId,
  }
}

/** Quantiles when each right-censored unit is added at its observed lower bound (windowEnd − entry). */
function openTreatedQuantiles(
  lifecycles: readonly PullRequestLifecycle[],
  window: HalfOpenWindow,
): { sampleSize: number; quantiles: readonly { quantile: number; value: number }[] | null } {
  const end = ms(window.end)
  const sample: number[] = []
  for (const lifecycle of lifecycles) {
    const entry = lifecycle.readyForReviewAt ?? lifecycle.createdAt
    if (entry === null) continue
    const entryMs = ms(entry)
    if (!(entryMs >= ms(window.start) && entryMs < end)) continue
    const mergedBefore = lifecycle.mergedAt !== null && ms(lifecycle.mergedAt) < end
    const closedBefore = lifecycle.closedAt !== null && ms(lifecycle.closedAt) < end
    if (mergedBefore) sample.push((ms(lifecycle.mergedAt as string) - entryMs) / 1000)
    else if (closedBefore) continue
    else sample.push((end - entryMs) / 1000)
  }
  const sorted = [...sample].sort((left, right) => left - right)
  if (sorted.length === 0) return { sampleSize: 0, quantiles: null }
  return {
    sampleSize: sorted.length,
    quantiles: DECLARED_QUANTILES.map((quantile) => ({ quantile, value: nearestRankQuantile(sorted, quantile) })),
  }
}

function sensitivityValue(
  variant: 'EXCLUDE_LONG_TAIL' | 'OPEN_TREATED_AS_CENSORED',
  base: MetricResult,
  lifecycles: readonly PullRequestLifecycle[],
  window: HalfOpenWindow,
): { variantId: string; state: MetricResult['state']; value: MetricValue } {
  if (variant === 'EXCLUDE_LONG_TAIL') {
    // Every eligible unit's entry point already falls inside the window, so nothing is dropped: the
    // variant recomputes to the base distribution (held). Reported honestly as the recomputed value.
    return { variantId: 'EXCLUDE_LONG_TAIL', state: base.state, value: base.value }
  }
  const open = openTreatedQuantiles(lifecycles, window)
  return {
    variantId: 'OPEN_TREATED_AS_CENSORED',
    state: base.state,
    value: { kind: 'quantiles', sampleSize: open.sampleSize, quantiles: open.quantiles === null ? null : [...open.quantiles] },
  }
}

/**
 * The composition procedure for one window. Returns a fully validated MetricResult carrying both
 * declared sensitivity variants. `conformsToGolden` against the reference procedure holds because
 * sensitivity is not part of the construct signature.
 */
export function computeIntegrationShapeResult(
  lifecycles: readonly PullRequestLifecycle[],
  window: HalfOpenWindow,
  resultId: string,
): MetricResult {
  const base = computeIntegrationIntervalResult(lifecycles, windowSpec(window, resultId), 'becameReady')
  if (base.state !== 'observed') {
    // Empty/censored-only/etc. carry no distribution, so the interval sensitivity variants do not apply.
    return base
  }
  const candidate = {
    ...base,
    sensitivity: [
      sensitivityValue('EXCLUDE_LONG_TAIL', base, lifecycles, window),
      sensitivityValue('OPEN_TREATED_AS_CENSORED', base, lifecycles, window),
    ],
  }
  return validateMetricResult(candidate).result
}

export const CURRENT_RESULT: MetricResult = computeIntegrationShapeResult(CURRENT_LIFECYCLES, CURRENT_WINDOW, CURRENT_RESULT_ID)
export const BASELINE_RESULT: MetricResult = computeIntegrationShapeResult(BASELINE_LIFECYCLES, BASELINE_WINDOW, BASELINE_RESULT_ID)

/**
 * The golden exemplar for this fixture set (issue: "add a golden exemplar for your fixture set").
 * Hand-verified from CURRENT_LIFECYCLES over the July window under the became-ready construct:
 * eligible {c1..c10} = 10; c7/c8/c9 right-censored = 3; c10 closed without merge (competing
 * outcome) so out of the sample; six merged intervals [1,2,2,3,4,5] days; nearest-rank
 * p50/p75/p90 = 172800/345600/432000s.
 */
export const CURRENT_GOLDEN = {
  reference: INTEGRATION_INTERVAL_REFERENCE,
  state: 'observed' as const,
  eligible: 10,
  censored: 3,
  value: {
    kind: 'quantiles' as const,
    sampleSize: 6,
    quantiles: [
      { quantile: 0.5, value: 172800 },
      { quantile: 0.75, value: 345600 },
      { quantile: 0.9, value: 432000 },
    ],
  },
}

/** True when the composition procedure reproduces the hand-verified golden construct signature. */
export function compositionConformsToGolden(): boolean {
  const referenceGolden = computeIntegrationIntervalResult(CURRENT_LIFECYCLES, windowSpec(CURRENT_WINDOW, CURRENT_RESULT_ID), 'becameReady')
  return (
    JSON.stringify(constructSignature(referenceGolden)) === JSON.stringify(CURRENT_GOLDEN) &&
    conformsToGolden(CURRENT_RESULT, referenceGolden)
  )
}

/* ------------------------------------------------------------------------------------------ *
 * Comparison builders — the FULL headline and the three-outcome + empty + abstention variants.
 * ------------------------------------------------------------------------------------------ */

const INSTRUMENT_R1: Instrument = { sourceId: 'github', parserMajor: 1, configRevision: 'r1' }
const INSTRUMENT_R2: Instrument = { sourceId: 'github', parserMajor: 1, configRevision: 'r2' }
const FULL_COMPARABILITY = { value: 1, limiting_reason: null } as const

export const COMPARABILITY_TOLERANCE = 0.9
export const MINIMUM_MATCHED_FRACTION = 0.8
export const MINIMUM_SUPPORT_UNITS = 5
const CENSORING_TREATMENT = 'uncensored_sample_with_declared_tails' as const

function baseSpec(comparisonId: string): ComparisonInput['spec'] {
  return {
    comparisonId,
    asOf: INTEGRATION_SHAPE_AS_OF,
    currentWindow: CURRENT_WINDOW,
    baselineWindow: BASELINE_WINDOW,
    metric: INTEGRATION_INTERVAL_METRIC,
    cohortId: INTEGRATION_SHAPE_COHORT_ID,
    scopeAlias: INTEGRATION_SHAPE_SCOPE_ALIAS,
    censoringTreatment: CENSORING_TREATMENT,
    minimumMatchedFraction: MINIMUM_MATCHED_FRACTION,
    comparabilityTolerance: COMPARABILITY_TOLERANCE,
    minimumSupportUnits: MINIMUM_SUPPORT_UNITS,
  }
}

function wholeSubwindow(window: HalfOpenWindow, instrument: Instrument = INSTRUMENT_R1) {
  return [{ window, instrument, comparability: FULL_COMPARABILITY }]
}

/** The headline: both windows fully instrumented the same way → FULL, matched fraction 1. */
export const FULL_COMPARISON: ComparisonResult = compareMatchedWindows({
  spec: baseSpec('integration-shape-full'),
  current: { result: CURRENT_RESULT, subwindows: wholeSubwindow(CURRENT_WINDOW), matchedResult: null },
  baseline: { result: BASELINE_RESULT, subwindows: wholeSubwindow(BASELINE_WINDOW), matchedResult: null },
})

/** A config-revision change over the last 4 of 28 days: matched fraction ≈ 0.857 → MATCHED_PARTIAL. */
function offsetWindow(window: HalfOpenWindow, offsetMs: number): HalfOpenWindow {
  return { start: window.start, end: new Date(ms(window.start) + offsetMs).toISOString() }
}
const MATCHED_PARTIAL_MATCHED_MS = 24 * SECONDS_PER_DAY * 1000
const CURRENT_MATCHED_WINDOW = offsetWindow(CURRENT_WINDOW, MATCHED_PARTIAL_MATCHED_MS)
const BASELINE_MATCHED_WINDOW = offsetWindow(BASELINE_WINDOW, MATCHED_PARTIAL_MATCHED_MS)

export const MATCHED_PARTIAL_COMPARISON: ComparisonResult = compareMatchedWindows({
  spec: baseSpec('integration-shape-matched-partial'),
  current: {
    result: CURRENT_RESULT,
    subwindows: [
      { window: { start: CURRENT_WINDOW.start, end: CURRENT_MATCHED_WINDOW.end }, instrument: INSTRUMENT_R1, comparability: FULL_COMPARABILITY },
      { window: { start: CURRENT_MATCHED_WINDOW.end, end: CURRENT_WINDOW.end }, instrument: INSTRUMENT_R2, comparability: FULL_COMPARABILITY },
    ],
    matchedResult: computeIntegrationShapeResult(CURRENT_LIFECYCLES, CURRENT_MATCHED_WINDOW, 'integration-shape-current-matched'),
  },
  baseline: {
    result: BASELINE_RESULT,
    subwindows: wholeSubwindow(BASELINE_WINDOW),
    matchedResult: computeIntegrationShapeResult(BASELINE_LIFECYCLES, BASELINE_MATCHED_WINDOW, 'integration-shape-baseline-matched'),
  },
})

/** A config-revision change over 12 of 28 days: matched fraction ≈ 0.571 < 0.8 → INCOMPARABLE. */
const INCOMPARABLE_MATCHED_MS = 16 * SECONDS_PER_DAY * 1000
export const INCOMPARABLE_COMPARISON: ComparisonResult = compareMatchedWindows({
  spec: baseSpec('integration-shape-incomparable'),
  current: {
    result: CURRENT_RESULT,
    subwindows: [
      { window: offsetWindow(CURRENT_WINDOW, INCOMPARABLE_MATCHED_MS), instrument: INSTRUMENT_R1, comparability: FULL_COMPARABILITY },
      { window: { start: offsetWindow(CURRENT_WINDOW, INCOMPARABLE_MATCHED_MS).end, end: CURRENT_WINDOW.end }, instrument: INSTRUMENT_R2, comparability: FULL_COMPARABILITY },
    ],
    matchedResult: null,
  },
  baseline: { result: BASELINE_RESULT, subwindows: wholeSubwindow(BASELINE_WINDOW), matchedResult: null },
})

/** Issue #67: a fully covered empty current cohort compared against a populated baseline. */
export const EMPTY_CURRENT_RESULT: MetricResult = computeIntegrationShapeResult(EMPTY_CURRENT_LIFECYCLES, CURRENT_WINDOW, 'integration-shape-current-empty')
export const EMPTY_COMPARISON: ComparisonResult = compareMatchedWindows({
  spec: baseSpec('integration-shape-empty'),
  current: { result: EMPTY_CURRENT_RESULT, subwindows: wholeSubwindow(CURRENT_WINDOW), matchedResult: null },
  baseline: { result: BASELINE_RESULT, subwindows: wholeSubwindow(BASELINE_WINDOW), matchedResult: null },
})

/** A current window below minimum support (sample 3 < 5): the matched delta is refused. */
export const LOW_SUPPORT_CURRENT_RESULT: MetricResult = computeIntegrationShapeResult(LOW_SUPPORT_CURRENT_LIFECYCLES, CURRENT_WINDOW, 'integration-shape-current-low')
export const ABSTENTION_COMPARISON: ComparisonResult = compareMatchedWindows({
  spec: baseSpec('integration-shape-abstention'),
  current: { result: LOW_SUPPORT_CURRENT_RESULT, subwindows: wholeSubwindow(CURRENT_WINDOW), matchedResult: null },
  baseline: { result: BASELINE_RESULT, subwindows: wholeSubwindow(BASELINE_WINDOW), matchedResult: null },
})

export const WINDOW_DURATION_MS = windowDurationMs(CURRENT_WINDOW)

/* ------------------------------------------------------------------------------------------ *
 * Evidence and mark identifiers — shared with the evidence-walk projection.
 * ------------------------------------------------------------------------------------------ */

const claimId = (label: string): string => `cl_${label.repeat(32)}`

export const CLAIM_IDS = {
  p50: claimId('50'),
  p75: claimId('75'),
  p90: claimId('90'),
  eligible: claimId('e1'),
  censored: claimId('ce'),
  matchedFraction: claimId('fa'),
  baseline: claimId('ba'),
} as const

export const EVIDENCE_IDS = {
  readyCurrent: 'ev_ready_events_current',
  mergeCurrent: 'ev_merge_events_current',
  readyBaseline: 'ev_ready_events_baseline',
  mergeBaseline: 'ev_merge_events_baseline',
  openTailCurrent: 'ev_open_tail_current',
} as const

/* ------------------------------------------------------------------------------------------ *
 * Finding content — typed against `shared/findings.ts` so it drifts loudly if the contract moves.
 * ------------------------------------------------------------------------------------------ */

const observationReference = (id: string): AnalyticReference => ({ kind: 'observation', evidenceId: id })

export const INTEGRATION_SHAPE_MARKS: readonly RenderedMark[] = [
  { markId: 'mark_p50_delta', valueCategory: 'delta', reference: { kind: 'claim', claimId: CLAIM_IDS.p50, claimLayer: 'deterministic' } },
  { markId: 'mark_p75_delta', valueCategory: 'delta', reference: { kind: 'claim', claimId: CLAIM_IDS.p75, claimLayer: 'deterministic' } },
  { markId: 'mark_p90_delta', valueCategory: 'delta', reference: { kind: 'claim', claimId: CLAIM_IDS.p90, claimLayer: 'deterministic' } },
  { markId: 'mark_eligible_current', valueCategory: 'count', reference: { kind: 'claim', claimId: CLAIM_IDS.eligible, claimLayer: 'deterministic' } },
  { markId: 'mark_censored_current', valueCategory: 'count', reference: { kind: 'claim', claimId: CLAIM_IDS.censored, claimLayer: 'deterministic' } },
  { markId: 'mark_matched_fraction', valueCategory: 'ratio', reference: { kind: 'claim', claimId: CLAIM_IDS.matchedFraction, claimLayer: 'deterministic' } },
]

const INTEGRATION_SHAPE_EVIDENCE: readonly AnalyticReference[] = [
  observationReference(EVIDENCE_IDS.readyCurrent),
  observationReference(EVIDENCE_IDS.mergeCurrent),
  observationReference(EVIDENCE_IDS.readyBaseline),
  observationReference(EVIDENCE_IDS.mergeBaseline),
]

const INTEGRATION_SHAPE_COUNTER_EVIDENCE: readonly AnalyticReference[] = [
  observationReference(EVIDENCE_IDS.openTailCurrent),
]

export const INTEGRATION_SHAPE_ALTERNATIVES: readonly AlternativeExplanation[] = [
  {
    code: 'CENSORING_ARTIFACT',
    statement:
      'The lower merged-interval quantiles in the current window may reflect that more long-running pull requests remain right-censored there rather than a shift in the underlying interval distribution.',
  },
  {
    code: 'RELEASE_FREEZE',
    statement:
      'A release freeze in one window can lengthen or shorten the observed intervals without any change in how the work moved through review.',
  },
  {
    code: 'BATCHED_REVIEW',
    statement:
      'Batched review sessions cluster merges and shorten the observed tail, which a matched-window difference cannot separate from a genuine change on its own.',
  },
]

const INTEGRATION_SHAPE_DISCRIMINATING: DiscriminatingEvidence = {
  statement:
    'Following the currently right-censored pull requests to their eventual merge, and re-reading the pair once both windows are equally aged, would separate a genuine distribution difference from a censoring artifact and from a one-off release freeze.',
  distinguishes: ['CENSORING_ARTIFACT', 'RELEASE_FREEZE'],
}

export const INTEGRATION_SHAPE_LIMITATIONS: readonly LimitationInstance[] = [
  { limitationCode: 'COVERAGE_UNITS_DIFFER', dimension: 'censoring_freedom', copyKey: 'copy.integration_shape.censored_tails' },
  { limitationCode: 'LINKAGE_NOT_CAUSAL', dimension: 'comparability', copyKey: 'copy.integration_shape.not_causal' },
]

const INTEGRATION_SHAPE_PROHIBITED = [
  { code: 'NOT_PERSON_MEASURE', statement: 'This is a property of a pull-request cohort and is never a measure of any individual person or their productivity.' },
  { code: 'NOT_CAUSAL', statement: 'A lower interval does not establish that any process change caused it.' },
  { code: 'NOT_QUALITY', statement: 'Integration interval says nothing about the quality or the value of what was merged.' },
] as const

const INTEGRATION_SHAPE_ROBUSTNESS: FindingRobustness = {
  status: 'fragile',
  checks: [
    {
      checkId: 'EXCLUDE_LONG_TAIL',
      statement: 'Recomputed on each side with pull requests entering before the window start removed; every entry point already falls inside the window, so the distribution was unchanged.',
      outcome: 'held',
      sensitivityVariantId: 'EXCLUDE_LONG_TAIL',
    },
    {
      checkId: 'OPEN_TREATED_AS_CENSORED',
      statement: 'Recomputed with each right-censored unit added at its observed lower bound instead of omitted from the sample; the ninetieth-percentile difference reversed sign.',
      outcome: 'changed_direction',
      sensitivityVariantId: 'OPEN_TREATED_AS_CENSORED',
    },
  ],
}

const INTEGRATION_SHAPE_OBSERVATION =
  'Across matched 28-day windows, the merged integration interval distribution in the current window sits below the preceding window at every reported quantile, while the current window carries more right-censored pull requests still open at its boundary.'

const METRIC_RESULT_REFERENCES: readonly MetricResultReference[] = [
  { metricId: INTEGRATION_INTERVAL_METRIC.metricId, metricVersion: INTEGRATION_INTERVAL_METRIC.version, resultId: CURRENT_RESULT_ID, role: 'primary' },
  { metricId: INTEGRATION_INTERVAL_METRIC.metricId, metricVersion: INTEGRATION_INTERVAL_METRIC.version, resultId: BASELINE_RESULT_ID, role: 'supporting' },
]

function findingCoverage(result: MetricResult): FindingCoverageEntry[] {
  return result.coverage.map((entry) => ({ dimension: entry.dimension, value: entry.value, limiting_reason: entry.limiting_reason }))
}

/**
 * The full deterministic finding, typed as `Finding`. `server/analysis/integrationShape.ts` runs
 * it through `validateFinding`/`assertRenderableFinding`; the client renders the same object.
 */
export function buildIntegrationShapeFinding(): Finding {
  return {
    findingId: 'integration_shape_matched',
    version: INTEGRATION_SHAPE_METHOD_VERSION,
    schemaVersion: '1.0.0',
    questionId: 'q_pr_integration_shape',
    layer: 'deterministic',
    statementCode: 'DELIVERY_FLOW',
    method: { methodId: 'integration_shape_matched', methodVersion: INTEGRATION_SHAPE_METHOD_VERSION },
    scopeId: INTEGRATION_SHAPE_SCOPE_ID,
    metricResults: [...METRIC_RESULT_REFERENCES],
    observation: INTEGRATION_SHAPE_OBSERVATION,
    candidateInterpretation: null,
    marks: [...INTEGRATION_SHAPE_MARKS],
    evidence: [...INTEGRATION_SHAPE_EVIDENCE],
    counterEvidence: [...INTEGRATION_SHAPE_COUNTER_EVIDENCE],
    alternativeExplanations: [...INTEGRATION_SHAPE_ALTERNATIVES],
    limitations: [...INTEGRATION_SHAPE_LIMITATIONS],
    prohibitedInterpretations: [...INTEGRATION_SHAPE_PROHIBITED],
    sampleSummary: { resultId: CURRENT_RESULT_ID, state: CURRENT_RESULT.state, counts: CURRENT_RESULT.counts },
    coverage: findingCoverage(CURRENT_RESULT),
    robustness: INTEGRATION_SHAPE_ROBUSTNESS,
    discriminatingEvidence: INTEGRATION_SHAPE_DISCRIMINATING,
    presentationEligibility: { eligible: true, reasonCode: 'PRESENTABLE', surfaces: ['atlas', 'evidence_drawer', 'api_v2'] },
    abstention: null,
  }
}

/**
 * The abstention finding for the low-support variant. A modelled/deterministic reading cannot be
 * computed below the support floor, so the finding abstains honestly rather than rendering a range
 * that would read as a number.
 */
export function buildIntegrationShapeAbstentionFinding(): Finding {
  return {
    findingId: 'integration_shape_abstention',
    version: INTEGRATION_SHAPE_METHOD_VERSION,
    schemaVersion: '1.0.0',
    questionId: 'q_pr_integration_shape',
    layer: 'abstention',
    statementCode: 'ABSTAIN_LOW_COVERAGE',
    method: { methodId: 'integration_shape_matched', methodVersion: INTEGRATION_SHAPE_METHOD_VERSION },
    scopeId: INTEGRATION_SHAPE_SCOPE_ID,
    metricResults: [
      { metricId: INTEGRATION_INTERVAL_METRIC.metricId, metricVersion: INTEGRATION_INTERVAL_METRIC.version, resultId: LOW_SUPPORT_CURRENT_RESULT.resultId, role: 'primary' },
      { metricId: INTEGRATION_INTERVAL_METRIC.metricId, metricVersion: INTEGRATION_INTERVAL_METRIC.version, resultId: BASELINE_RESULT_ID, role: 'supporting' },
    ],
    observation:
      'The current window holds too few merged pull requests to compare its integration interval distribution against the preceding window, so this reading is withheld.',
    candidateInterpretation: null,
    marks: [],
    evidence: [],
    counterEvidence: [],
    alternativeExplanations: [],
    limitations: [{ limitationCode: 'SAMPLE_TOO_SMALL', dimension: 'sample', copyKey: 'copy.integration_shape.below_support' }],
    prohibitedInterpretations: [...INTEGRATION_SHAPE_PROHIBITED],
    sampleSummary: { resultId: LOW_SUPPORT_CURRENT_RESULT.resultId, state: LOW_SUPPORT_CURRENT_RESULT.state, counts: LOW_SUPPORT_CURRENT_RESULT.counts },
    coverage: findingCoverage(LOW_SUPPORT_CURRENT_RESULT),
    robustness: { status: 'not-tested', checks: [] },
    discriminatingEvidence: null,
    presentationEligibility: { eligible: true, reasonCode: 'PRESENTABLE_AS_ABSTENTION', surfaces: ['atlas', 'evidence_drawer', 'api_v2'] },
    abstention: {
      floorCode: 'SUPPORT_FLOOR',
      dimension: 'sample',
      limitingReason: 'SAMPLE_BELOW_MINIMUM',
      statement:
        'The current window merged fewer pull requests than the minimum support the interval metric requires for display, so the matched comparison is withheld rather than shown as a range.',
      fallbackFindingId: null,
    },
  }
}

/* ------------------------------------------------------------------------------------------ *
 * Presentation bundle — everything the Atlas panel and the walkthrough test read.
 * ------------------------------------------------------------------------------------------ */

export interface IntegrationShapeOutcomeRow {
  readonly key: 'full' | 'matched_partial' | 'incomparable'
  readonly label: string
  readonly comparison: ComparisonResult
}

export interface IntegrationShapePresentation {
  readonly question: string
  readonly cohortStatement: string
  readonly scopeId: string
  readonly scopeAliasIsStripped: true
  readonly finding: Finding
  readonly abstentionFinding: Finding
  readonly current: MetricResult
  readonly baseline: MetricResult
  readonly headline: ComparisonResult
  readonly outcomes: readonly IntegrationShapeOutcomeRow[]
  readonly emptyCohort: { readonly comparison: ComparisonResult; readonly current: MetricResult }
  readonly abstention: { readonly comparison: ComparisonResult; readonly current: MetricResult }
  readonly sensitivity: {
    readonly variantId: 'OPEN_TREATED_AS_CENSORED'
    readonly label: string
    readonly quantiles: readonly { readonly quantile: number; readonly current: number; readonly baseline: number; readonly delta: number }[]
  }
  readonly conformsToGolden: boolean
}

function openTreatedFor(result: MetricResult): readonly { quantile: number; value: number }[] {
  const entry = result.sensitivity.find((variant) => variant.variantId === 'OPEN_TREATED_AS_CENSORED')
  if (!entry || entry.value.kind !== 'quantiles' || entry.value.quantiles === null) return []
  return entry.value.quantiles
}

function buildSensitivity(): IntegrationShapePresentation['sensitivity'] {
  const current = openTreatedFor(CURRENT_RESULT)
  const baseline = openTreatedFor(BASELINE_RESULT)
  const baselineByLevel = new Map(baseline.map((entry) => [entry.quantile, entry.value]))
  return {
    variantId: 'OPEN_TREATED_AS_CENSORED',
    label: 'Open pull requests treated as observed-so-far',
    quantiles: current.map((entry) => {
      const baselineValue = baselineByLevel.get(entry.quantile) ?? 0
      return { quantile: entry.quantile, current: entry.value, baseline: baselineValue, delta: entry.value - baselineValue }
    }),
  }
}

export function buildIntegrationShapePresentation(): IntegrationShapePresentation {
  return {
    question: INTEGRATION_SHAPE_QUESTION,
    cohortStatement: INTEGRATION_SHAPE_COHORT_STATEMENT,
    scopeId: INTEGRATION_SHAPE_SCOPE_ID,
    scopeAliasIsStripped: true,
    finding: buildIntegrationShapeFinding(),
    abstentionFinding: buildIntegrationShapeAbstentionFinding(),
    current: CURRENT_RESULT,
    baseline: BASELINE_RESULT,
    headline: FULL_COMPARISON,
    outcomes: [
      { key: 'full', label: 'Full', comparison: FULL_COMPARISON },
      { key: 'matched_partial', label: 'Matched-partial', comparison: MATCHED_PARTIAL_COMPARISON },
      { key: 'incomparable', label: 'Incomparable', comparison: INCOMPARABLE_COMPARISON },
    ],
    emptyCohort: { comparison: EMPTY_COMPARISON, current: EMPTY_CURRENT_RESULT },
    abstention: { comparison: ABSTENTION_COMPARISON, current: LOW_SUPPORT_CURRENT_RESULT },
    sensitivity: buildSensitivity(),
    conformsToGolden: compositionConformsToGolden(),
  }
}

/* ------------------------------------------------------------------------------------------ *
 * Small formatting helpers the panel and tests share.
 * ------------------------------------------------------------------------------------------ */

/** Seconds → a signed day label, e.g. `-2.0 d` or `+0.5 d`. Never causal, never evaluative. */
export function secondsToDayLabel(seconds: number): string {
  const days = seconds / SECONDS_PER_DAY
  const sign = days > 0 ? '+' : ''
  return `${sign}${days.toFixed(1)} d`
}

export function isComparableOutcome(comparison: ComparisonResult): boolean {
  return isComparable(comparison)
}
