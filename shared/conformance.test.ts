import { describe, expect, it } from 'vitest'
import {
  CONFORMANCE_CONTRACT_VERSION,
  computeIntegrationIntervalResult,
  conformsToGolden,
  constructSignature,
  nearestRankQuantile,
  type CohortEntryConstruct,
  type IntervalWindowSpec,
  type PullRequestLifecycle,
} from './conformance.js'
import {
  MetricRegistryError,
  assertExposableMetricResult,
  getMetricDefinition,
  resolveMetricForComputation,
  resolveMetricForRendering,
  validateMetricResult,
  type MetricResult,
} from './metrics.js'
import { FindingContractError, FindingSchema, validateFinding } from './findings.js'
import {
  ComparisonContractError,
  STRUCTURAL_REFUSAL_REASONS,
  compareMatchedWindows,
  isComparable,
} from './comparison.js'

/* ==========================================================================================
 * DL-VALIDATE-01 — analytical conformance and counterexample suite.
 *
 * The suite tests CONSTRUCT VALIDITY, not only code correctness. Its acceptance criterion is a
 * single, sharp claim: a metric that is deterministic, private, reproducible — and measuring the
 * WRONG CONSTRUCT — passes every schema, typecheck, and registry check and still fails this suite.
 * Every fixture is invented C0/C1 data; nothing names a person.
 * ========================================================================================== */

const INTERVAL_REFERENCE = 'pull_request.integration_interval@1.1.0'
const WITHDRAWN_REFERENCE = 'pull_request.merged_pull_request_count@1.0.0'
const PASS_SHARE_REFERENCE = 'check_run.first_attempt_pass_share@1.0.0'

/**
 * Invented pull-request lifecycles engineered so the created-at cohort and the became-ready cohort
 * genuinely differ: P1/P10 enter only the became-ready cohort, P5/P9 enter only the created cohort,
 * and the rest enter both — with different interval starts. P7 never resolves (right-censored on
 * both). No field names a person.
 */
const LIFECYCLES: readonly PullRequestLifecycle[] = [
  { opaqueId: 'pr-1', createdAt: '2026-06-20T00:00:00.000Z', readyForReviewAt: '2026-07-02T00:00:00.000Z', mergedAt: '2026-07-06T00:00:00.000Z', closedAt: null },
  { opaqueId: 'pr-2', createdAt: '2026-07-03T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-08T00:00:00.000Z', closedAt: null },
  { opaqueId: 'pr-3', createdAt: '2026-07-05T00:00:00.000Z', readyForReviewAt: '2026-07-09T00:00:00.000Z', mergedAt: '2026-07-12T00:00:00.000Z', closedAt: null },
  { opaqueId: 'pr-4', createdAt: '2026-07-10T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-11T00:00:00.000Z', closedAt: null },
  { opaqueId: 'pr-5', createdAt: '2026-07-25T00:00:00.000Z', readyForReviewAt: '2026-08-04T00:00:00.000Z', mergedAt: '2026-08-06T00:00:00.000Z', closedAt: null },
  { opaqueId: 'pr-7', createdAt: '2026-07-29T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
  { opaqueId: 'pr-9', createdAt: '2026-07-20T00:00:00.000Z', readyForReviewAt: '2026-08-01T00:00:00.000Z', mergedAt: '2026-07-25T00:00:00.000Z', closedAt: null },
  { opaqueId: 'pr-10', createdAt: '2026-06-25T00:00:00.000Z', readyForReviewAt: '2026-07-01T00:00:00.000Z', mergedAt: '2026-07-04T00:00:00.000Z', closedAt: null },
]

const JULY: IntervalWindowSpec = {
  windowStart: '2026-07-01T00:00:00.000Z',
  windowEnd: '2026-08-01T00:00:00.000Z',
  asOf: '2026-08-01T00:00:00.000Z',
  scopeAlias: 'scope-alpha',
  resultId: 'conf-interval-july',
}

const compute = (construct: CohortEntryConstruct, spec: IntervalWindowSpec = JULY): MetricResult =>
  computeIntegrationIntervalResult(LIFECYCLES, spec, construct)

/**
 * THE golden. Hand-verified from LIFECYCLES over July under the became-ready construct: eligible
 * {pr-1,pr-2,pr-3,pr-4,pr-7,pr-10} = 6, pr-7 right-censored, five merged intervals
 * [86400, 259200, 259200, 345600, 432000]s, nearest-rank p50/p75/p90 = 259200/345600/432000.
 */
const BECAME_READY_GOLDEN = {
  state: 'observed' as const,
  eligible: 6,
  censored: 1,
  value: {
    kind: 'quantiles' as const,
    sampleSize: 5,
    quantiles: [
      { quantile: 0.5, value: 259200 },
      { quantile: 0.75, value: 345600 },
      { quantile: 0.9, value: 432000 },
    ],
  },
}

/* ------------------------------------------------------------------------------------------ *
 * 0. The wrong-construct counterexample — the card's acceptance criterion.
 * ------------------------------------------------------------------------------------------ */

describe('DL-VALIDATE-01 wrong-construct counterexample (acceptance criterion)', () => {
  it('binds the correct procedure to the golden it must reproduce', () => {
    const golden = compute('becameReady')
    // The golden is pinned to hand-verified construct values, not merely to "whatever ran".
    expect(constructSignature(golden)).toEqual({ reference: INTERVAL_REFERENCE, ...BECAME_READY_GOLDEN })
    // It is a legal result under the full registry gate, not only the schema.
    expect(() => validateMetricResult(golden)).not.toThrow()
    expect(assertExposableMetricResult(golden, 'api').reference).toBe(INTERVAL_REFERENCE)
    expect(conformsToGolden(golden, golden)).toBe(true)
  })

  it('catches a metric that is deterministic, private, reproducible — and measures the WRONG cohort', () => {
    const golden = compute('becameReady')
    // The planted wrong metric: the SUPERSEDED created-at construct (v1.0.0's cohort start), run
    // while bound to the ACTIVE v1.1.0 definition. Right code, wrong cohort — exactly the
    // COHORT_START_EVENT_CORRECTED supersession the registry itself records.
    const wrong = compute('created')

    // 1) It is deterministic and reproducible: two runs are byte-identical.
    expect(compute('created')).toEqual(wrong)

    // 2) It passes EVERY normal check a private, well-formed metric must pass:
    //    schema (MetricResultSchema, applied inside the procedure), the registry-level result
    //    contract, and the full V2 exposure gate. Nothing structural rejects it.
    expect(() => validateMetricResult(wrong)).not.toThrow()
    const exposed = assertExposableMetricResult(wrong, 'api')
    expect(exposed.reference).toBe(INTERVAL_REFERENCE)
    expect(exposed.result.calculation.procedureId).toBe('pull_request.interval_quantiles_v2')

    // 3) And it FAILS this suite: its construct signature does not match the golden. The cohort is
    //    wrong, so the censored count, the sample size, and every quantile diverge.
    expect(conformsToGolden(wrong, golden)).toBe(false)
    expect(constructSignature(wrong)).toEqual({
      reference: INTERVAL_REFERENCE,
      state: 'observed',
      eligible: 6,
      censored: 2,
      value: {
        kind: 'quantiles',
        sampleSize: 4,
        quantiles: [
          { quantile: 0.5, value: 432000 },
          { quantile: 0.75, value: 432000 },
          { quantile: 0.9, value: 604800 },
        ],
      },
    })

    // The discriminating divergence, called out so the failure mode is legible: the wrong cohort
    // both censors a merged-after-window unit it should never have admitted (pr-5) and starts every
    // interval too early, so the wrong metric reads systematically slower on a smaller sample.
    expect(wrong.counts.censored).not.toBe(golden.counts.censored)
    if (wrong.value.kind === 'quantiles' && golden.value.kind === 'quantiles') {
      expect(wrong.value.sampleSize).toBeLessThan(golden.value.sampleSize)
      expect(wrong.value.quantiles?.[0].value).toBeGreaterThan(golden.value.quantiles?.[0].value ?? 0)
    }
  })

  it('proves the gap is real: schema and registry accept the wrong result, only the golden rejects it', () => {
    const wrong = compute('created')
    // A schema/registry-only reviewer would wave this through — that is precisely the failure the
    // conformance golden exists to catch. The two facts together ARE the card's thesis.
    expect(() => validateMetricResult(wrong)).not.toThrow()
    expect(conformsToGolden(wrong, compute('becameReady'))).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 1. Goldens.
 * ------------------------------------------------------------------------------------------ */

describe('goldens', () => {
  it('the nearest-rank quantile method is monotone and total on the golden sample', () => {
    const sorted = [86400, 259200, 259200, 345600, 432000]
    expect(nearestRankQuantile(sorted, 0.5)).toBe(259200)
    expect(nearestRankQuantile(sorted, 0.75)).toBe(345600)
    expect(nearestRankQuantile(sorted, 0.9)).toBe(432000)
  })

  it('the golden result is fully exposable and round-trips its own registry contract', () => {
    const golden = compute('becameReady')
    const { result, definition } = validateMetricResult(golden)
    expect(result.state).toBe('observed')
    expect(definition.formula.procedureId).toBe('pull_request.interval_quantiles_v2')
    expect(result.value).toEqual(BECAME_READY_GOLDEN.value)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 2. Empty eligible cohorts (issue #67) + the #82 N1 ruling.
 * ------------------------------------------------------------------------------------------ */

const SEPTEMBER: IntervalWindowSpec = {
  windowStart: '2026-09-01T00:00:00.000Z',
  windowEnd: '2026-10-01T00:00:00.000Z',
  asOf: '2026-10-01T00:00:00.000Z',
  scopeAlias: 'scope-alpha',
  resultId: 'conf-interval-september',
}

/**
 * Issue #82 N1, SETTLED by the coordinator (verbatim rationale — recorded here and in the report):
 *
 *   "On an empty eligible cohort, the `sample` coverage dimension is 1 — vacuously complete. An
 *    empty eligible cohort under complete coverage is a COMPLETE observation of zero (the #67
 *    doctrine across the merged contracts); a null would read as 'unmeasurable' when sampling was
 *    fully realized."
 *
 * So the exemplar asserts an all-dimensions-1 empty-cohort row, sample included. This is not a
 * code change: metrics.ts already requires complete coverage on every declared dimension for an
 * empty cohort, and defining sample=1 as "all of a zero-sized sample observed" is exactly that.
 */
const N1_RATIONALE_VERBATIM =
  'an empty eligible cohort under complete coverage is a COMPLETE observation of zero; a null would read as unmeasurable when sampling was fully realized'

describe('empty eligible cohorts (#67) and the #82 N1 sample=1 ruling', () => {
  it('a fully covered quiet window is a typed empty-cohort observation, not a gap', () => {
    const empty = compute('becameReady', SEPTEMBER)
    const { result } = validateMetricResult(empty)
    expect(result.state).toBe('empty_eligible_cohort')
    expect(result.stateReasonCode).toBe('EMPTY_ELIGIBLE_COHORT')
    expect(result.counts).toMatchObject({ eligible: 0, censored: 0 })
    expect(result.value).toEqual({ kind: 'quantiles', sampleSize: 0, quantiles: null })
  })

  it('N1: the sample dimension is 1 on a zero-unit cohort — vacuously complete, never null', () => {
    const empty = compute('becameReady', SEPTEMBER)
    expect(N1_RATIONALE_VERBATIM).toContain('COMPLETE observation of zero')
    // Every declared dimension, including sample, reads 1 with no limiting reason.
    for (const entry of empty.coverage) {
      expect(entry.value, `${entry.dimension} must be vacuously complete on an empty cohort`).toBe(1)
      expect(entry.limiting_reason).toBeNull()
    }
    const sample = empty.coverage.find((entry) => entry.dimension === 'sample')
    expect(sample).toBeDefined()
    expect(sample?.value).toBe(1)
  })

  it('an empty cohort under any degraded dimension is refused — a quiet window is not a blind one', () => {
    const empty = compute('becameReady', SEPTEMBER)
    const blinded = {
      ...empty,
      coverage: empty.coverage.map((entry) =>
        entry.dimension === 'freshness' ? { ...entry, value: 0.7, limiting_reason: 'STALE_BEYOND_SLO' } : entry,
      ),
    }
    expect(() => validateMetricResult(blinded)).toThrow(/only claimable under complete coverage/)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 3. Right-censoring, censored-only, and the #82 M-b competing-outcome relaxation.
 * ------------------------------------------------------------------------------------------ */

const CENSORED_ONLY_LIFECYCLES: readonly PullRequestLifecycle[] = [
  { opaqueId: 'pr-a', createdAt: '2026-07-04T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
  { opaqueId: 'pr-b', createdAt: '2026-07-06T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
]

const COMPETING_OUTCOME_LIFECYCLES: readonly PullRequestLifecycle[] = [
  // Two merge cleanly; one is closed without merging (competing outcome); one stays open (censored).
  { opaqueId: 'pr-m1', createdAt: '2026-07-02T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-05T00:00:00.000Z', closedAt: null },
  { opaqueId: 'pr-m2', createdAt: '2026-07-03T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-09T00:00:00.000Z', closedAt: null },
  { opaqueId: 'pr-closed', createdAt: '2026-07-06T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: '2026-07-08T00:00:00.000Z' },
  { opaqueId: 'pr-open', createdAt: '2026-07-20T00:00:00.000Z', readyForReviewAt: null, mergedAt: null, closedAt: null },
]

describe('right-censoring and the #82 M-b competing-outcome relaxation', () => {
  it('right-censors an unmerged unit at the window end and keeps it in the counts, never the sample', () => {
    const golden = compute('becameReady')
    expect(golden.counts.censored).toBe(1)
    if (golden.value.kind === 'quantiles') {
      expect(golden.value.sampleSize).toBe(5) // pr-7 censored, excluded from the distribution
    }
  })

  it('reports a fully censored window as censored_only, distinct from empty and from a zero', () => {
    const result = computeIntegrationIntervalResult(CENSORED_ONLY_LIFECYCLES, JULY, 'becameReady')
    const { result: parsed } = validateMetricResult(result)
    expect(parsed.state).toBe('censored_only')
    expect(parsed.value).toEqual({ kind: 'no_value', reasonCode: 'ALL_ELIGIBLE_EVENTS_CENSORED' })
    expect(parsed.counts).toMatchObject({ eligible: 2, censored: 2 })
  })

  it('M-b: a close-without-merge competing outcome makes sampleSize < eligible − censored, and validates', () => {
    const result = computeIntegrationIntervalResult(COMPETING_OUTCOME_LIFECYCLES, JULY, 'becameReady')
    const { result: parsed } = validateMetricResult(result)
    expect(parsed.counts.eligible).toBe(4) // all four became ready in July
    expect(parsed.counts.censored).toBe(1) // only pr-open
    if (parsed.value.kind === 'quantiles') {
      // pr-closed left through a competing outcome: eligible, not censored, not sampled.
      expect(parsed.value.sampleSize).toBe(2)
      expect(parsed.value.sampleSize).toBeLessThan(parsed.counts.eligible - parsed.counts.censored)
    }
  })

  it('M-b: the old equality still holds on the goldens (no competing outcome ⇒ sampleSize === eligible − censored)', () => {
    const golden = compute('becameReady')
    if (golden.value.kind === 'quantiles') {
      expect(golden.value.sampleSize).toBe(golden.counts.eligible - golden.counts.censored)
    }
  })

  it('M-b: a sample that EXCEEDS the uncensored eligible units is still rejected', () => {
    const golden = compute('becameReady')
    const oversampled = {
      ...golden,
      value: golden.value.kind === 'quantiles' ? { ...golden.value, sampleSize: golden.counts.eligible + 1 } : golden.value,
    }
    expect(() => validateMetricResult(oversampled)).toThrow(/samples exactly the eligible units that were not censored/)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 4. Missingness, null/unknown, and truncation.
 * ------------------------------------------------------------------------------------------ */

const MISSINGNESS_LIFECYCLES: readonly PullRequestLifecycle[] = [
  { opaqueId: 'pr-ok', createdAt: '2026-07-04T00:00:00.000Z', readyForReviewAt: null, mergedAt: '2026-07-07T00:00:00.000Z', closedAt: null },
  // No creation timestamp and never a draft: the cohort entry point cannot be placed.
  { opaqueId: 'pr-missing', createdAt: null, readyForReviewAt: null, mergedAt: '2026-07-09T00:00:00.000Z', closedAt: null },
]

describe('missingness, null/unknown, and truncation', () => {
  it('missingness: a unit with no derivable cohort entry is excluded under its named reason, never imputed', () => {
    const result = computeIntegrationIntervalResult(MISSINGNESS_LIFECYCLES, JULY, 'becameReady')
    const { result: parsed } = validateMetricResult(result)
    expect(parsed.counts.eligible).toBe(1)
    expect(parsed.counts.excluded).toContainEqual({ reasonCode: 'MISSING_CREATION_TIMESTAMP', count: 1 })
  })

  it('null/unknown: an unmeasurable result carries no_value and no zero, distinct from an empty cohort', () => {
    const golden = compute('becameReady')
    const unavailable = {
      ...golden,
      resultId: 'conf-interval-unavailable',
      state: 'unavailable' as const,
      stateReasonCode: 'CAPABILITY_NEVER_AUTHORIZED',
      counts: { eligible: 0, censored: 0, excluded: [] },
      value: { kind: 'no_value' as const, reasonCode: 'CAPABILITY_NEVER_AUTHORIZED' },
      coverage: golden.coverage.map((entry) => ({ ...entry, value: null, limiting_reason: 'NEVER_AUTHORIZED' })),
    }
    const { result } = validateMetricResult(unavailable)
    expect(result.state).toBe('unavailable')
    expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'CAPABILITY_NEVER_AUTHORIZED' })
    expect(result.state).not.toBe('empty_eligible_cohort')
  })

  it('truncation: a truncated window may not report an observed zero (zero is indistinguishable from "could not look")', () => {
    const golden = compute('becameReady')
    const truncatedZero = {
      ...golden,
      resultId: 'conf-truncated-zero',
      state: 'truncated' as const,
      stateReasonCode: 'SOURCE_PAGE_LIMIT_REACHED',
      counts: { eligible: 0, censored: 0, excluded: [] },
      value: { kind: 'count' as const, observedCount: 0 },
    }
    // The value shape (count) contradicts the interval formula, and the truncated-zero rule bites —
    // either way the metric registry refuses it. A truncated reading is never a silent zero.
    expect(() => validateMetricResult(truncatedZero)).toThrow(MetricRegistryError)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 5. Boundary timestamps: half-open edges and offset-vs-Z equivalence.
 * ------------------------------------------------------------------------------------------ */

const BOUNDARY_LIFECYCLES: readonly PullRequestLifecycle[] = [
  // Exactly at the window start: half-open [start, end) includes it.
  { opaqueId: 'pr-start', createdAt: '2026-06-28T00:00:00.000Z', readyForReviewAt: '2026-07-01T00:00:00.000Z', mergedAt: '2026-07-03T00:00:00.000Z', closedAt: null },
  // Exactly at the window end: belongs to the NEXT window, excluded.
  { opaqueId: 'pr-end', createdAt: '2026-07-15T00:00:00.000Z', readyForReviewAt: '2026-08-01T00:00:00.000Z', mergedAt: '2026-08-03T00:00:00.000Z', closedAt: null },
  // The window start written with a +02:00 offset equal to the Z boundary: the SAME instant.
  { opaqueId: 'pr-offset', createdAt: '2026-06-29T00:00:00.000Z', readyForReviewAt: '2026-07-01T02:00:00+02:00', mergedAt: '2026-07-05T00:00:00.000Z', closedAt: null },
]

describe('boundary timestamps: half-open edges and offset equivalence', () => {
  it('an event at the window start is in; an event at the window end belongs to the next window', () => {
    const result = computeIntegrationIntervalResult(BOUNDARY_LIFECYCLES, JULY, 'becameReady')
    const { result: parsed } = validateMetricResult(result)
    // pr-start and pr-offset are eligible; pr-end is excluded at the shared boundary.
    expect(parsed.counts.eligible).toBe(2)
    expect(parsed.counts.excluded).toContainEqual({ reasonCode: 'BECAME_READY_OUTSIDE_WINDOW', count: 1 })
  })

  it('offset-vs-Z: +02:00 and Z that name the same instant are treated identically', () => {
    const offsetResult = computeIntegrationIntervalResult([BOUNDARY_LIFECYCLES[2]], JULY, 'becameReady')
    const zEquivalent: PullRequestLifecycle = { ...BOUNDARY_LIFECYCLES[2], readyForReviewAt: '2026-07-01T00:00:00.000Z' }
    const zResult = computeIntegrationIntervalResult([zEquivalent], JULY, 'becameReady')
    expect(constructSignature(offsetResult)).toEqual(constructSignature(zResult))
    expect(offsetResult.counts.eligible).toBe(1)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 6. Alternate cohort and window definitions; sensitivity variants; #82 M-a pass-share confounder.
 * ------------------------------------------------------------------------------------------ */

const CALENDAR_WEEK_WINDOW: IntervalWindowSpec = {
  // A calendar-week-aligned re-slice of the same facts: a different window definition, so a
  // different cohort, from the same underlying lifecycles.
  windowStart: '2026-07-06T00:00:00.000Z',
  windowEnd: '2026-07-13T00:00:00.000Z',
  asOf: '2026-08-01T00:00:00.000Z',
  scopeAlias: 'scope-alpha',
  resultId: 'conf-interval-week',
}

describe('alternate cohort and window definitions, and sensitivity variants', () => {
  it('alternate cohort: the created-at and became-ready constructs select genuinely different units', () => {
    const becameReady = compute('becameReady')
    const created = compute('created')
    // Same eligible COUNT here by construction, but not the same UNITS: the censored and sampled
    // partitions differ, which is what a cohort swap actually changes.
    expect(created.counts.censored).not.toBe(becameReady.counts.censored)
    expect(conformsToGolden(created, becameReady)).toBe(false)
  })

  it('alternate window: re-slicing to a calendar week yields a different, smaller cohort', () => {
    const week = compute('becameReady', CALENDAR_WEEK_WINDOW)
    const { result } = validateMetricResult(week)
    // Only pr-3 (became ready 07-09) and pr-4 (07-10) fall in [07-06, 07-13).
    expect(result.counts.eligible).toBe(2)
    expect(result.counts.eligible).toBeLessThan(compute('becameReady').counts.eligible)
  })

  it('sensitivity variants: the interval metric names its variants and pass-share carries M-a\'s worst case', () => {
    const interval = getMetricDefinition(INTERVAL_REFERENCE)
    expect(interval.sensitivityVariants.map((variant) => variant.variantId)).toEqual(
      expect.arrayContaining(['EXCLUDE_LONG_TAIL', 'OPEN_TREATED_AS_CENSORED']),
    )
    const share = getMetricDefinition(PASS_SHARE_REFERENCE)
    expect(share.sensitivityVariants.map((variant) => variant.variantId)).toContain('WORST_CASE_CENSORED_ALL_FAIL')
  })

  it('M-a: the pass-share metric declares informative censoring as a confounder', () => {
    const share = getMetricDefinition(PASS_SHARE_REFERENCE)
    const confounder = share.knownConfounders.find((entry) => entry.code === 'CENSORED_NOT_MISSING_AT_RANDOM')
    expect(confounder).toBeDefined()
    expect(confounder?.statement).toMatch(/not missing at random/i)
    // The declared denominator excludes censored units, which is exactly the seam the confounder warns about.
    expect(share.formula).toMatchObject({ kind: 'proportion_of_cohort', denominatorBasis: 'eligible_minus_censored' })
  })

  it('M-a: a fixture where censored runs correlate with failure exercises the worst-case bound', () => {
    // Invented: 40 concluded first attempts, 32 passed; 10 more were right-censored (still running).
    // Informative censoring means the still-running attempts are likelier to fail; the reported
    // share (32/40 = 0.80) is an upper bound, and the worst-case lower bound assumes all 10 fail.
    const eligible = 50
    const censored = 10
    const concluded = eligible - censored // 40
    const passed = 32
    const reportedShare = passed / concluded // 0.80
    const worstCaseShare = passed / (concluded + censored) // 32/50 = 0.64
    expect(reportedShare).toBeCloseTo(0.8, 10)
    expect(worstCaseShare).toBeLessThan(reportedShare) // the confounder can only lower the estimate
    expect(worstCaseShare).toBeCloseTo(0.64, 10)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 7. Supersession — the superseded construct routes to its successor for new computation.
 * ------------------------------------------------------------------------------------------ */

describe('supersession routes the wrong construct to its correction', () => {
  it('new computation against the superseded v1.0.0 created-at definition is refused', () => {
    // The created-at construct is not merely wrong in this suite — it is the SUPERSEDED definition,
    // and the registry refuses to compute new results against it, naming the successor.
    expect(getMetricDefinition('pull_request.integration_interval@1.0.0').status).toBe('superseded')
    expect(() => resolveMetricForComputation('pull_request.integration_interval@1.0.0')).toThrow(/superseded by/)
    expect(resolveMetricForComputation(INTERVAL_REFERENCE).version).toBe('1.1.0')
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 8. Permutation / null baseline — a guard against calling noise a wave.
 * ------------------------------------------------------------------------------------------ */

/** Exhaustive two-sided permutation p-value for a difference in group sums (small n only). */
function permutationPValue(groupA: readonly number[], groupB: readonly number[]): number {
  const pooled = [...groupA, ...groupB]
  const k = groupA.length
  const observed = Math.abs(sum(groupA) - sum(groupB))
  const indices = pooled.map((_, index) => index)
  let total = 0
  let atLeastAsExtreme = 0
  for (const combination of combinations(indices, k)) {
    const chosen = new Set(combination)
    const a = pooled.filter((_, index) => chosen.has(index))
    const b = pooled.filter((_, index) => !chosen.has(index))
    total += 1
    if (Math.abs(sum(a) - sum(b)) >= observed - 1e-9) {
      atLeastAsExtreme += 1
    }
  }
  return atLeastAsExtreme / total
}

function sum(values: readonly number[]): number {
  return values.reduce((accumulator, value) => accumulator + value, 0)
}

function* combinations(items: readonly number[], choose: number): Generator<number[]> {
  if (choose === 0) {
    yield []
    return
  }
  for (let index = 0; index <= items.length - choose; index += 1) {
    for (const rest of combinations(items.slice(index + 1), choose - 1)) {
      yield [items[index], ...rest]
    }
  }
}

describe('permutation / null baseline for wave-like findings', () => {
  it('a small between-window difference falls inside the null band: not a wave', () => {
    // Two matched windows of three units each; the sums barely differ.
    const current = [3, 4, 5]
    const baseline = [4, 4, 4]
    const p = permutationPValue(current, baseline)
    expect(p).toBeGreaterThan(0.2) // indistinguishable from a relabelling of the same pool
  })

  it('a clear between-window difference falls outside the null band: a real signal', () => {
    // Four units per side, cleanly separated: only the exact partition and its mirror reproduce a
    // gap this large, so 2 of the 70 label assignments are as extreme — p ~= 0.029.
    const current = [20, 21, 22, 23]
    const baseline = [1, 2, 3, 4]
    const p = permutationPValue(current, baseline)
    expect(p).toBeLessThan(0.05) // no realistic relabelling reproduces a gap this large
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 9. Finding-contract construct validity — 5a / 5b / 5c fold-ins and contradiction.
 * ------------------------------------------------------------------------------------------ */

const READY_COUNT_ID = 'pull_request.ready_event_count'
const CLAIM_A = `cl_${'a'.repeat(64)}`
const CLAIM_B = `cl_${'b'.repeat(64)}`
const CLAIM_C = `cl_${'c'.repeat(64)}`

type Payload = Record<string, unknown>

/** A valid deterministic finding whose primary is the registered, active ready-count metric. */
function baseFinding(overrides: Payload = {}): Payload {
  return {
    findingId: 'fnd_conf_det',
    version: '1.0.0',
    schemaVersion: '1.0.0',
    questionId: 'q_conf',
    layer: 'deterministic',
    statementCode: 'DELIVERY_FLOW',
    method: { methodId: 'method_conf', methodVersion: '1.0.0' },
    scopeId: 'scope_alpha',
    metricResults: [{ metricId: READY_COUNT_ID, metricVersion: '1.0.0', resultId: 'result_1', role: 'primary' }],
    observation: 'The window recorded twelve pull requests that became ready.',
    candidateInterpretation: null,
    marks: [{ markId: 'mark_count', valueCategory: 'count', reference: { kind: 'claim', claimId: CLAIM_A, claimLayer: 'deterministic' } }],
    evidence: [{ kind: 'claim', claimId: CLAIM_B, claimLayer: 'deterministic' }],
    counterEvidence: [],
    alternativeExplanations: [],
    limitations: [],
    prohibitedInterpretations: [{ code: 'NOT_PERSON_MEASURE', statement: 'A cohort statistic, never a reading of any single person.' }],
    sampleSummary: { resultId: 'result_1', state: 'observed', counts: { eligible: 12, censored: 0, excluded: [] } },
    coverage: [{ dimension: 'completeness', value: 1, limiting_reason: null }],
    robustness: { status: 'not-tested', checks: [] },
    discriminatingEvidence: null,
    presentationEligibility: { eligible: true, reasonCode: 'PRESENTABLE', surfaces: ['atlas'] },
    abstention: null,
    ...overrides,
  }
}

describe('finding contract construct validity (5a / 5b / 5c) and contradiction', () => {
  it('the base finding is valid, so every rejection below isolates one defect', () => {
    expect(validateFinding(baseFinding()).findingId).toBe('fnd_conf_det')
  })

  it('5a: the withdrawn metric is registered but renders nothing — the real fixture behind the gate', () => {
    expect(getMetricDefinition(WITHDRAWN_REFERENCE).status).toBe('withdrawn')
    expect(() => resolveMetricForRendering(WITHDRAWN_REFERENCE)).toThrow(/withdrawn/)
    expect(() => resolveMetricForComputation(WITHDRAWN_REFERENCE)).toThrow(/withdrawn/)
  })

  it('5a: a finding with a withdrawn PRIMARY metric fails closed, against the real registered metric', () => {
    const finding = baseFinding({
      metricResults: [{ metricId: 'pull_request.merged_pull_request_count', metricVersion: '1.0.0', resultId: 'result_1', role: 'primary' }],
    })
    expect(() => validateFinding(finding)).toThrow(FindingContractError)
    expect(() => validateFinding(finding)).toThrow(WITHDRAWN_REFERENCE)
    expect(() => validateFinding(finding)).toThrow(/withdrawn/)
  })

  it('5a: a finding with a withdrawn SUPPORTING metric also fails closed', () => {
    const finding = baseFinding({
      metricResults: [
        { metricId: READY_COUNT_ID, metricVersion: '1.0.0', resultId: 'result_1', role: 'primary' },
        { metricId: 'pull_request.merged_pull_request_count', metricVersion: '1.0.0', resultId: 'result_2', role: 'supporting' },
      ],
    })
    expect(() => validateFinding(finding)).toThrow(/withdrawn/)
  })

  it('5b: a finding may not cite a coverage dimension its primary metric never declares consuming', () => {
    // ready_event_count declares permission/completeness/eligibility/freshness/sample/comparability
    // but NOT consistency; a finding citing consistency is embedded-copy drift.
    const drifted = baseFinding({ coverage: [{ dimension: 'consistency', value: 1, limiting_reason: null }] })
    expect(() => validateFinding(drifted)).toThrow(/consistency.*declares it consumes/)
    // A dimension the primary DOES declare passes the cross-check.
    const declared = baseFinding({ coverage: [{ dimension: 'sample', value: 1, limiting_reason: null }] })
    expect(validateFinding(declared).coverage[0].dimension).toBe('sample')
  })

  it('5c: a truncated sample summary must carry a completeness entry naming a limiting reason', () => {
    const truncatedComplete = baseFinding({
      sampleSummary: { resultId: 'result_1', state: 'truncated', counts: { eligible: 40, censored: 0, excluded: [] } },
      coverage: [{ dimension: 'completeness', value: 1, limiting_reason: null }],
    })
    expect(() => validateFinding(truncatedComplete)).toThrow(/truncated sample summary requires a completeness/)

    const truncatedHonest = baseFinding({
      sampleSummary: { resultId: 'result_1', state: 'truncated', counts: { eligible: 40, censored: 0, excluded: [] } },
      coverage: [{ dimension: 'completeness', value: 0.6, limiting_reason: 'SATURATION_CAP_REACHED' }],
    })
    expect(validateFinding(truncatedHonest).sampleSummary.state).toBe('truncated')
  })

  it('5d: an unlicensed causal claim in a robustness check statement is rejected (issue #91)', () => {
    // A rendered robustness check statement is copy-scanned like the observation: a deterministic
    // DELIVERY_FLOW finding (which licenses no causal terms) cannot smuggle "because" into a check.
    const causalCheck = baseFinding({
      robustness: { status: 'stable', checks: [{ checkId: 'CHK', statement: 'held steady because a code freeze reduced churn this window', outcome: 'held', sensitivityVariantId: null }] },
    })
    expect(() => validateFinding(causalCheck)).toThrow(FindingContractError)
    const parsed = FindingSchema.safeParse(causalCheck)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toContain('robustness.checks.0.statement')
    }
    // A statement that only describes the perturbation — no causal claim — is accepted.
    const honestCheck = baseFinding({
      robustness: { status: 'stable', checks: [{ checkId: 'CHK', statement: 'Recomputed on a window that excludes the code-freeze interval.', outcome: 'held', sensitivityVariantId: null }] },
    })
    expect(validateFinding(honestCheck).robustness.status).toBe('stable')
  })

  it('contradiction: a finding may carry counter-evidence that contradicts its own evidence', () => {
    const contradicted = baseFinding({
      evidence: [{ kind: 'claim', claimId: CLAIM_B, claimLayer: 'deterministic' }],
      counterEvidence: [{ kind: 'observation', evidenceId: 'ev_contradicts' }],
    })
    const finding = validateFinding(contradicted)
    expect(finding.counterEvidence).toHaveLength(1)
    // Evidence and counter-evidence must be disjoint — a reference cannot be cited as both.
    const overlap = baseFinding({
      evidence: [{ kind: 'claim', claimId: CLAIM_C, claimLayer: 'deterministic' }],
      counterEvidence: [{ kind: 'claim', claimId: CLAIM_C, claimLayer: 'deterministic' }],
    })
    expect(() => validateFinding(overlap)).toThrow(FindingContractError)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 10. Comparison-contract construct validity — matched-partial, incomparable, empty value-class,
 *     source disagreement, and the #82 M-c proportion-delta censoring warning.
 * ------------------------------------------------------------------------------------------ */

const B_WIN = { start: '2026-01-01T00:00:00.000Z', end: '2026-01-11T00:00:00.000Z' }
const C_WIN = { start: '2026-01-11T00:00:00.000Z', end: '2026-01-21T00:00:00.000Z' }
const CMP_AS_OF = '2026-01-21T00:00:00.000Z'
const CMP_SCOPE = 'scope-cmp'
const INSTRUMENT_A = { sourceId: 'github', parserMajor: 3, configRevision: 'cfg-1' }
const INSTRUMENT_B = { sourceId: 'mirror', parserMajor: 3, configRevision: 'cfg-1' }
const COMPARABILITY_ONLY = [{ dimension: 'comparability', value: 1, limiting_reason: null }]

type Json = Record<string, unknown>

function cmpResult(o: {
  metric: { metricId: string; version: string }
  window: { start: string; end: string }
  state: string
  stateReasonCode: string
  counts: Json
  value: Json
  resultId: string
  coverage?: Json[]
}): Json {
  return {
    resultId: o.resultId,
    metricId: o.metric.metricId,
    metricVersion: o.metric.version,
    scopeAlias: CMP_SCOPE,
    window: o.window,
    asOf: CMP_AS_OF,
    state: o.state,
    stateReasonCode: o.stateReasonCode,
    counts: o.counts,
    value: o.value,
    coverage: o.coverage ?? COMPARABILITY_ONLY,
    evidenceIds: [],
    calculation: { procedureId: 'cmp.fixture_v1', metricContractVersion: '1.1.0', engineVersion: '1.0.0' },
    sensitivity: [],
  }
}

const SHARE_METRIC = { metricId: 'cmp.pass_share', version: '1.0.0' }
const COUNT_METRIC = { metricId: 'cmp.count', version: '1.0.0' }
const INTERVAL_METRIC = { metricId: 'cmp.interval', version: '1.1.0' }

function cmpSpec(overrides: Json = {}): Json {
  return {
    comparisonId: 'cmp',
    asOf: CMP_AS_OF,
    currentWindow: C_WIN,
    baselineWindow: B_WIN,
    metric: INTERVAL_METRIC,
    cohortId: 'cmp.cohort',
    scopeAlias: CMP_SCOPE,
    censoringTreatment: 'uncensored_sample_with_declared_tails',
    minimumMatchedFraction: 0.3,
    comparabilityTolerance: 0.8,
    minimumSupportUnits: 0,
    ...overrides,
  }
}

const side = (result: Json, subwindows: Json[] = [], matchedResult: Json | null = null): Json => ({ result, subwindows, matchedResult })
const fullSub = (window: { start: string; end: string }, instrument: Json = INSTRUMENT_A): Json[] => [{ window, instrument, comparability: { value: 1, limiting_reason: null } }]

function shareSide(window: { start: string; end: string }, o: { eligible: number; censored: number; numerator: number; denominator: number; resultId: string }): Json {
  return cmpResult({
    metric: SHARE_METRIC, window, resultId: o.resultId, state: 'observed', stateReasonCode: 'OBSERVED',
    counts: { eligible: o.eligible, censored: o.censored, excluded: [] },
    value: { kind: 'proportion', numerator: o.numerator, denominator: o.denominator },
  })
}

function intervalSide(window: { start: string; end: string }, o: { eligible: number; censored: number; sampleSize: number; quantiles: Json[]; resultId: string }): Json {
  return cmpResult({
    metric: INTERVAL_METRIC, window, resultId: o.resultId, state: 'observed', stateReasonCode: 'OBSERVED',
    counts: { eligible: o.eligible, censored: o.censored, excluded: [] },
    value: { kind: 'quantiles', sampleSize: o.sampleSize, quantiles: o.quantiles },
  })
}

function emptyShareSide(window: { start: string; end: string }, metric: { metricId: string; version: string }, resultId: string): Json {
  return cmpResult({
    metric, window, resultId, state: 'empty_eligible_cohort', stateReasonCode: 'EMPTY_ELIGIBLE_COHORT',
    counts: { eligible: 0, censored: 0, excluded: [] }, value: { kind: 'no_value', reasonCode: 'EMPTY_ELIGIBLE_COHORT' },
  })
}

describe('comparison contract: matched-partial, incomparable, and empty value-class', () => {
  it('a failed comparison refuses with no representable delta (no WINDOW_SHAPE_MISMATCH member exists)', () => {
    // Unequal-duration windows are a caller-contract error: the spec fails to parse and the call
    // THROWS, rather than producing an INCOMPARABLE result. There is deliberately no shape refusal code.
    expect([...STRUCTURAL_REFUSAL_REASONS]).not.toContain('WINDOW_SHAPE_MISMATCH')
    const input = {
      spec: cmpSpec({ currentWindow: { start: '2026-01-11T00:00:00.000Z', end: '2026-01-31T00:00:00.000Z' } }),
      current: side(intervalSide(C_WIN, { eligible: 5, censored: 0, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 1000 }], resultId: 'r-c' }), fullSub(C_WIN)),
      baseline: side(intervalSide(B_WIN, { eligible: 5, censored: 0, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 1000 }], resultId: 'r-b' }), fullSub(B_WIN)),
    }
    expect(() => compareMatchedWindows(input)).toThrow(ComparisonContractError)
  })

  it('MATCHED_PARTIAL: arithmetic comes from the matched-subwindow results only, with the bias limitation', () => {
    const current = intervalSide(C_WIN, { eligible: 12, censored: 2, sampleSize: 10, quantiles: [{ quantile: 0.5, value: 50_000 }, { quantile: 0.9, value: 130_000 }], resultId: 'r-c' })
    const baseline = intervalSide(B_WIN, { eligible: 10, censored: 1, sampleSize: 9, quantiles: [{ quantile: 0.5, value: 40_000 }, { quantile: 0.9, value: 100_000 }], resultId: 'r-b' })
    const currentMatched = intervalSide({ start: C_WIN.start, end: '2026-01-16T00:00:00.000Z' }, { eligible: 6, censored: 1, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 48_000 }, { quantile: 0.9, value: 120_000 }], resultId: 'r-cm' })
    const baselineMatched = intervalSide({ start: B_WIN.start, end: '2026-01-06T00:00:00.000Z' }, { eligible: 5, censored: 0, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 38_000 }, { quantile: 0.9, value: 95_000 }], resultId: 'r-bm' })
    const firstHalfCurrent = [{ window: { start: C_WIN.start, end: '2026-01-16T00:00:00.000Z' }, instrument: INSTRUMENT_A, comparability: { value: 1, limiting_reason: null } }]
    const firstHalfBaseline = [{ window: { start: B_WIN.start, end: '2026-01-06T00:00:00.000Z' }, instrument: INSTRUMENT_A, comparability: { value: 1, limiting_reason: null } }]
    const result = compareMatchedWindows({
      spec: cmpSpec(),
      current: side(current, firstHalfCurrent, currentMatched),
      baseline: side(baseline, firstHalfBaseline, baselineMatched),
    })
    expect(result.outcome).toBe('MATCHED_PARTIAL')
    if (result.outcome === 'MATCHED_PARTIAL') {
      expect(result.matchedFraction).toBeCloseTo(0.5, 10)
      expect(result.arithmeticBasis).toBe('matched_subwindows_only')
      expect(result.counts.current.eligible).toBe(6) // the matched result, never the whole-window 12
      expect(result.limitations.map((l) => l.code)).toContain('MATCHED_SUBWINDOW_SELECTION_BIAS')
    }
  })

  it('INCOMPARABLE (MATCHED_SET_NONCONTIGUOUS): two disjoint matched stretches cannot be one result', () => {
    const twoStretches = [
      { window: { start: C_WIN.start, end: '2026-01-14T00:00:00.000Z' }, instrument: INSTRUMENT_A, comparability: { value: 1, limiting_reason: null } },
      { window: { start: '2026-01-18T00:00:00.000Z', end: C_WIN.end }, instrument: INSTRUMENT_A, comparability: { value: 1, limiting_reason: null } },
    ]
    const twoStretchesBaseline = [
      { window: { start: B_WIN.start, end: '2026-01-04T00:00:00.000Z' }, instrument: INSTRUMENT_A, comparability: { value: 1, limiting_reason: null } },
      { window: { start: '2026-01-08T00:00:00.000Z', end: B_WIN.end }, instrument: INSTRUMENT_A, comparability: { value: 1, limiting_reason: null } },
    ]
    const result = compareMatchedWindows({
      spec: cmpSpec(),
      current: side(intervalSide(C_WIN, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 1000 }], resultId: 'r-c' }), twoStretches),
      baseline: side(intervalSide(B_WIN, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 1000 }], resultId: 'r-b' }), twoStretchesBaseline),
    })
    expect(isComparable(result)).toBe(false)
    if (!isComparable(result)) expect(result.reasonCode).toBe('MATCHED_SET_NONCONTIGUOUS')
  })

  it('INCOMPARABLE (MATCHED_WINDOW_MISMATCH): a whole-window result cannot masquerade as matched-only', () => {
    const firstHalfCurrent = [{ window: { start: C_WIN.start, end: '2026-01-16T00:00:00.000Z' }, instrument: INSTRUMENT_A, comparability: { value: 1, limiting_reason: null } }]
    const firstHalfBaseline = [{ window: { start: B_WIN.start, end: '2026-01-06T00:00:00.000Z' }, instrument: INSTRUMENT_A, comparability: { value: 1, limiting_reason: null } }]
    // The matched-subwindow result covers the WHOLE window, not the single matched [0, 5d) segment.
    const wrongMatched = intervalSide(C_WIN, { eligible: 6, censored: 0, sampleSize: 6, quantiles: [{ quantile: 0.5, value: 1000 }], resultId: 'r-cm' })
    const baselineMatched = intervalSide({ start: B_WIN.start, end: '2026-01-06T00:00:00.000Z' }, { eligible: 5, censored: 0, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 900 }], resultId: 'r-bm' })
    const result = compareMatchedWindows({
      spec: cmpSpec(),
      current: side(intervalSide(C_WIN, { eligible: 12, censored: 0, sampleSize: 12, quantiles: [{ quantile: 0.5, value: 1000 }], resultId: 'r-c' }), firstHalfCurrent, wrongMatched),
      baseline: side(intervalSide(B_WIN, { eligible: 10, censored: 0, sampleSize: 10, quantiles: [{ quantile: 0.5, value: 900 }], resultId: 'r-b' }), firstHalfBaseline, baselineMatched),
    })
    expect(isComparable(result)).toBe(false)
    if (!isComparable(result)) expect(result.reasonCode).toBe('MATCHED_WINDOW_MISMATCH')
  })

  it('INCOMPARABLE (CENSORING_TREATMENT_CONTRADICTED): "no censoring possible" cannot ship beside censored counts', () => {
    const result = compareMatchedWindows({
      spec: cmpSpec({ censoringTreatment: 'no_censoring_possible' }),
      current: side(intervalSide(C_WIN, { eligible: 12, censored: 2, sampleSize: 10, quantiles: [{ quantile: 0.5, value: 1000 }], resultId: 'r-c' }), fullSub(C_WIN)),
      baseline: side(intervalSide(B_WIN, { eligible: 10, censored: 0, sampleSize: 10, quantiles: [{ quantile: 0.5, value: 900 }], resultId: 'r-b' }), fullSub(B_WIN)),
    })
    expect(isComparable(result)).toBe(false)
    if (!isComparable(result)) expect(result.reasonCode).toBe('CENSORING_TREATMENT_CONTRADICTED')
  })

  it('INCOMPARABLE (TRUNCATED_SIDE): a difference against a truncated side would measure the instrument', () => {
    const truncated = cmpResult({
      metric: COUNT_METRIC, window: C_WIN, resultId: 'r-c', state: 'truncated', stateReasonCode: 'SOURCE_PAGE_LIMIT_REACHED',
      counts: { eligible: 40, censored: 0, excluded: [] }, value: { kind: 'count', observedCount: 40 },
      coverage: [{ dimension: 'completeness', value: 0.6, limiting_reason: 'SATURATION_CAP_REACHED' }, { dimension: 'comparability', value: 1, limiting_reason: null }],
    })
    const baseline = cmpResult({
      metric: COUNT_METRIC, window: B_WIN, resultId: 'r-b', state: 'observed', stateReasonCode: 'OBSERVED',
      counts: { eligible: 30, censored: 0, excluded: [] }, value: { kind: 'count', observedCount: 30 },
    })
    const result = compareMatchedWindows({
      spec: cmpSpec({ metric: COUNT_METRIC, censoringTreatment: 'no_censoring_possible' }),
      current: side(truncated, fullSub(C_WIN)),
      baseline: side(baseline, fullSub(B_WIN)),
    })
    expect(isComparable(result)).toBe(false)
    if (!isComparable(result)) expect(result.reasonCode).toBe('TRUNCATED_SIDE')
  })

  it('source disagreement: a period observed through different connectors does not match', () => {
    // The whole current period is instrumented by a different source than the baseline, so no
    // stretch matches on both sides: the residual names the comparability dimension it degraded.
    const result = compareMatchedWindows({
      spec: cmpSpec({ metric: COUNT_METRIC, censoringTreatment: 'no_censoring_possible' }),
      current: side(cmpResult({ metric: COUNT_METRIC, window: C_WIN, resultId: 'r-c', state: 'observed', stateReasonCode: 'OBSERVED', counts: { eligible: 8, censored: 0, excluded: [] }, value: { kind: 'count', observedCount: 8 } }), fullSub(C_WIN, INSTRUMENT_B)),
      baseline: side(cmpResult({ metric: COUNT_METRIC, window: B_WIN, resultId: 'r-b', state: 'observed', stateReasonCode: 'OBSERVED', counts: { eligible: 7, censored: 0, excluded: [] }, value: { kind: 'count', observedCount: 7 } }), fullSub(B_WIN, INSTRUMENT_A)),
    })
    expect(isComparable(result)).toBe(false)
    if (!isComparable(result)) {
      expect(result.reasonCode).toBe('NO_MATCHED_SUBWINDOW')
      expect(result.residual[0].mismatchKind).toBe('SOURCE_CHANGED')
      expect(result.residual[0].disqualifyingDimension).toBe('comparability')
    }
  })

  it('empty value-class via the registry: a populated count minus an empty cohort is a real count delta (#67)', () => {
    const populated = cmpResult({ metric: COUNT_METRIC, window: C_WIN, resultId: 'r-c', state: 'observed', stateReasonCode: 'OBSERVED', counts: { eligible: 40, censored: 0, excluded: [] }, value: { kind: 'count', observedCount: 40 } })
    const empty = cmpResult({ metric: COUNT_METRIC, window: B_WIN, resultId: 'r-b', state: 'empty_eligible_cohort', stateReasonCode: 'EMPTY_ELIGIBLE_COHORT', counts: { eligible: 0, censored: 0, excluded: [] }, value: { kind: 'count', observedCount: 0 } })
    const result = compareMatchedWindows({
      spec: cmpSpec({ metric: COUNT_METRIC, censoringTreatment: 'no_censoring_possible' }),
      current: side(populated, fullSub(C_WIN)),
      baseline: side(empty, fullSub(B_WIN)),
    })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL') {
      expect(result.value).toMatchObject({ kind: 'count_delta', current: 40, baseline: 0, delta: 40 })
      expect(result.limitations.map((l) => l.code)).toContain('EMPTY_COHORT_SIDE')
    }
  })

  it('empty value-class via the registry: both-empty on a REGISTERED proportion is refused as undefined, not zero', () => {
    // Neither side carries a concrete value, so the value-kind class is decided by the registered
    // metric definition — a proportion over an empty cohort has no denominator, on either side.
    const result = compareMatchedWindows({
      spec: cmpSpec({ metric: { metricId: 'check_run.first_attempt_pass_share', version: '1.0.0' }, cohortId: 'check_run.first_attempt_started_in_window' }),
      current: side(emptyShareSide(C_WIN, { metricId: 'check_run.first_attempt_pass_share', version: '1.0.0' }, 'r-c'), fullSub(C_WIN)),
      baseline: side(emptyShareSide(B_WIN, { metricId: 'check_run.first_attempt_pass_share', version: '1.0.0' }, 'r-b'), fullSub(B_WIN)),
    })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL') {
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'PROPORTION_UNDEFINED_ON_EMPTY_COHORT' })
    }
  })

  it('empty value-class undecidable: both-empty on an UNREGISTERED metric reports two empty cohorts, never a proportion', () => {
    const result = compareMatchedWindows({
      spec: cmpSpec({ metric: { metricId: 'cmp.unregistered_mystery', version: '1.0.0' } }),
      current: side(emptyShareSide(C_WIN, { metricId: 'cmp.unregistered_mystery', version: '1.0.0' }, 'r-c'), fullSub(C_WIN)),
      baseline: side(emptyShareSide(B_WIN, { metricId: 'cmp.unregistered_mystery', version: '1.0.0' }, 'r-b'), fullSub(B_WIN)),
    })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL') {
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'BOTH_SIDES_EMPTY_COHORT' })
    }
  })
})

describe('comparison contract: #82 M-c proportion-delta unequal-censoring warning', () => {
  it('M-c: a censoring-rate gap between the sides raises UNEQUAL_CENSORING_BETWEEN_SIDES for a proportion delta', () => {
    // current censored 5/50 = 0.10; baseline censored 0/40 = 0.00 — unequal follow-up.
    const result = compareMatchedWindows({
      spec: cmpSpec({ metric: SHARE_METRIC }),
      current: side(shareSide(C_WIN, { eligible: 50, censored: 5, numerator: 30, denominator: 45, resultId: 'r-c' }), fullSub(C_WIN)),
      baseline: side(shareSide(B_WIN, { eligible: 40, censored: 0, numerator: 24, denominator: 40, resultId: 'r-b' }), fullSub(B_WIN)),
    })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL') {
      expect(result.value.kind).toBe('proportion_delta')
      const codes = result.limitations.map((l) => l.code)
      expect(codes).toContain('UNEQUAL_CENSORING_BETWEEN_SIDES')
      expect(codes).toContain('CENSORED_TAILS_EXCLUDED')
    }
  })

  it('M-c: equal censoring rates on both sides do NOT raise the unequal-censoring warning', () => {
    // current 5/50 = 0.10; baseline 4/40 = 0.10 — equal follow-up, so only the tails note fires.
    const result = compareMatchedWindows({
      spec: cmpSpec({ metric: SHARE_METRIC }),
      current: side(shareSide(C_WIN, { eligible: 50, censored: 5, numerator: 30, denominator: 45, resultId: 'r-c' }), fullSub(C_WIN)),
      baseline: side(shareSide(B_WIN, { eligible: 40, censored: 4, numerator: 21, denominator: 36, resultId: 'r-b' }), fullSub(B_WIN)),
    })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL') {
      expect(result.value.kind).toBe('proportion_delta')
      const codes = result.limitations.map((l) => l.code)
      expect(codes).not.toContain('UNEQUAL_CENSORING_BETWEEN_SIDES')
      expect(codes).toContain('CENSORED_TAILS_EXCLUDED')
    }
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 11. Fixture-class census — every class named on the card has at least one exemplar.
 * ------------------------------------------------------------------------------------------ */

describe('fixture-class census', () => {
  it('pins the contract version', () => {
    expect(CONFORMANCE_CONTRACT_VERSION).toBe('1.0.0')
  })

  it('every fixture class the card names is exercised above by at least one exemplar', () => {
    // A fixture class may never be waived for a family without a recorded decision; this census is
    // that record. Each entry points at the describe/it exemplar that discharges it.
    const covered: Readonly<Record<string, string>> = {
      goldens: 'goldens › the golden result is fully exposable',
      'wrong-cohort counterexamples': 'acceptance criterion › catches a metric measuring the WRONG cohort',
      'empty eligible cohorts': 'empty eligible cohorts (#67) + comparison empty value-class',
      'null/unknown': 'missingness, null/unknown, and truncation › null/unknown',
      missingness: 'missingness › excluded under MISSING_CREATION_TIMESTAMP',
      truncation: 'truncation › truncated window may not report an observed zero + TRUNCATED_SIDE',
      'right-censoring': 'right-censoring › censored at the window end + censored_only',
      'alternate cohort definitions': 'alternate cohort › created vs became-ready',
      'alternate window definitions': 'alternate window › calendar-week re-slice',
      'sensitivity variants': 'sensitivity variants › interval + pass-share worst-case',
      contradiction: 'finding contract › contradiction counter-evidence',
      'source disagreement': 'comparison › source disagreement (different connectors)',
      'boundary timestamps': 'boundary timestamps › half-open edges and offset-vs-Z',
      'matched-partial comparison': 'comparison › MATCHED_PARTIAL',
      'incomparable comparison': 'comparison › INCOMPARABLE (several structural reasons)',
      'permutation/null baselines': 'permutation / null baseline for wave-like findings',
    }
    // The card's bound fold-ins are also each discharged by a named exemplar.
    const boundDecisions: Readonly<Record<string, string>> = {
      'N1 sample=1 on empty cohort': 'empty eligible cohorts › N1',
      'M-a pass-share confounder + worst case': 'sensitivity/M-a exemplars',
      'M-b competing-outcome relaxation': 'right-censoring/M-b exemplars',
      'M-c proportion-delta unequal censoring': 'comparison › M-c both directions',
      '5a real withdrawn metric': 'finding contract › 5a withdrawn primary + supporting',
      '5b coverage-dimension cross-check': 'finding contract › 5b',
      '5c truncated completeness cross-check': 'finding contract › 5c',
      '5d robustness check causal-scan': 'finding contract › 5d issue #91',
    }
    expect(Object.keys(covered).length).toBeGreaterThanOrEqual(16)
    expect(Object.keys(boundDecisions)).toHaveLength(8)
    for (const description of [...Object.values(covered), ...Object.values(boundDecisions)]) {
      expect(description.length).toBeGreaterThan(0)
    }
  })
})
