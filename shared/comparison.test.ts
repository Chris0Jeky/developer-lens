import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COMPARISON_CONTRACT_VERSION,
  ComparisonContractError,
  ComparisonResultSchema,
  ComparisonSpecSchema,
  HalfOpenWindowSchema,
  REQUIRED_MATCHED_PARTIAL_LIMITATION,
  STRUCTURAL_REFUSAL_REASONS,
  compareMatchedWindows,
  comparisonSupportUnits,
  isComparable,
  matchInstrumentSubwindows,
  toComparisonTableRow,
  windowContains,
  windowDurationMs,
  type ComparisonResult,
  type InstrumentSubwindow,
} from './comparison.js'
import { MetricResultSchema, evaluateDisplayEligibility, listActiveMetrics, type MetricResult } from './metrics.js'
import {
  CENSORED_ONLY_RESULT,
  EMPTY_ELIGIBLE_COHORT_COUNT_RESULT,
  OBSERVED_INTERVAL_RESULT,
  OBSERVED_SHARE_RESULT,
} from './metricFixtures.js'

/* ------------------------------------------------------------------------------------------ *
 * Shared fixture scaffolding
 *
 * Two adjacent, equal-duration (10 day) half-open windows. The baseline ends exactly where the
 * current begins, so they are matched and non-overlapping. `AS_OF` is the current window's end,
 * so both windows are completed and `WINDOW_OPEN_AT_AS_OF` never trips on the happy path.
 * ------------------------------------------------------------------------------------------ */

type Json = Record<string, unknown>

const DAY_MS = 86_400_000
const TEN_DAYS = 10 * DAY_MS
const FIVE_DAYS = 5 * DAY_MS
const THREE_DAYS = 3 * DAY_MS

const BASELINE_WINDOW = { start: '2026-01-01T00:00:00.000Z', end: '2026-01-11T00:00:00.000Z' }
const CURRENT_WINDOW = { start: '2026-01-11T00:00:00.000Z', end: '2026-01-21T00:00:00.000Z' }
const AS_OF = '2026-01-21T00:00:00.000Z'
const CURRENT_MID = '2026-01-16T00:00:00.000Z' // offset +5 days into the current window
const BASELINE_MID = '2026-01-06T00:00:00.000Z' // offset +5 days into the baseline window

const SCOPE = 'scope-alpha'
const COHORT = 'pull_request.became_ready_in_window'
const INTERVAL_METRIC = { metricId: 'compare.integration_interval', version: '1.1.0' }
const COUNT_METRIC = { metricId: 'compare.ready_count', version: '1.0.0' }
const SHARE_METRIC = { metricId: 'compare.pass_share', version: '1.0.0' }

const CALC = { procedureId: 'compare.fixture_v1', metricContractVersion: '1.1.0', engineVersion: '1.0.0' }
const COMPARABLE_1 = { value: 1, limiting_reason: null }
const COMPARABILITY_ONLY = [{ dimension: 'comparability', value: 1, limiting_reason: null }]
const INSTRUMENT_A = { sourceId: 'github', parserMajor: 3, configRevision: 'cfg-2026-01' }

function makeResult(o: {
  resultId: string
  metric: { metricId: string; version: string }
  window: { start: string; end: string }
  state: string
  stateReasonCode: string
  counts: Json
  value: Json
  coverage?: Json[]
  asOf?: string
  scopeAlias?: string
}): Json {
  return {
    resultId: o.resultId,
    metricId: o.metric.metricId,
    metricVersion: o.metric.version,
    scopeAlias: o.scopeAlias ?? SCOPE,
    window: o.window,
    asOf: o.asOf ?? AS_OF,
    state: o.state,
    stateReasonCode: o.stateReasonCode,
    counts: o.counts,
    value: o.value,
    coverage: o.coverage ?? COMPARABILITY_ONLY,
    evidenceIds: [],
    calculation: CALC,
    sensitivity: [],
  }
}

function observedInterval(
  window: { start: string; end: string },
  o: { eligible: number; censored: number; sampleSize: number; quantiles: Json[]; resultId?: string; asOf?: string; coverage?: Json[] },
): Json {
  return makeResult({
    resultId: o.resultId ?? 'r-interval',
    metric: INTERVAL_METRIC,
    window,
    asOf: o.asOf,
    coverage: o.coverage,
    state: 'observed',
    stateReasonCode: 'OBSERVED',
    counts: { eligible: o.eligible, censored: o.censored, excluded: [] },
    value: { kind: 'quantiles', sampleSize: o.sampleSize, quantiles: o.quantiles },
  })
}

function observedCount(
  window: { start: string; end: string },
  o: { eligible: number; count: number; censored?: number; resultId?: string; metric?: { metricId: string; version: string }; coverage?: Json[]; value?: Json },
): Json {
  return makeResult({
    resultId: o.resultId ?? 'r-count',
    metric: o.metric ?? COUNT_METRIC,
    window,
    coverage: o.coverage,
    state: 'observed',
    stateReasonCode: 'OBSERVED',
    counts: { eligible: o.eligible, censored: o.censored ?? 0, excluded: [] },
    value: o.value ?? { kind: 'count', observedCount: o.count },
  })
}

function observedShare(
  window: { start: string; end: string },
  o: { eligible: number; censored?: number; numerator: number; denominator: number; resultId?: string; coverage?: Json[] },
): Json {
  return makeResult({
    resultId: o.resultId ?? 'r-share',
    metric: SHARE_METRIC,
    window,
    coverage: o.coverage,
    state: 'observed',
    stateReasonCode: 'OBSERVED',
    counts: { eligible: o.eligible, censored: o.censored ?? 0, excluded: [] },
    value: { kind: 'proportion', numerator: o.numerator, denominator: o.denominator },
  })
}

function emptyCohort(window: { start: string; end: string }, metric: { metricId: string; version: string }, value: Json, resultId: string): Json {
  return makeResult({
    resultId,
    metric,
    window,
    state: 'empty_eligible_cohort',
    stateReasonCode: 'EMPTY_ELIGIBLE_COHORT',
    counts: { eligible: 0, censored: 0, excluded: [] },
    value,
  })
}

const emptyCount = (window: { start: string; end: string }, resultId = 'r-empty-count') =>
  emptyCohort(window, COUNT_METRIC, { kind: 'count', observedCount: 0 }, resultId)
const emptyInterval = (window: { start: string; end: string }, resultId = 'r-empty-interval') =>
  emptyCohort(window, INTERVAL_METRIC, { kind: 'quantiles', sampleSize: 0, quantiles: null }, resultId)
const emptyShare = (window: { start: string; end: string }, resultId = 'r-empty-share') =>
  emptyCohort(window, SHARE_METRIC, { kind: 'no_value', reasonCode: 'EMPTY_ELIGIBLE_COHORT' }, resultId)

function censoredOnlyInterval(window: { start: string; end: string }, asOf: string, resultId = 'r-censored'): Json {
  return makeResult({
    resultId,
    metric: INTERVAL_METRIC,
    window,
    asOf,
    state: 'censored_only',
    stateReasonCode: 'ALL_ELIGIBLE_EVENTS_CENSORED',
    counts: { eligible: 4, censored: 4, excluded: [] },
    value: { kind: 'no_value', reasonCode: 'ALL_ELIGIBLE_EVENTS_CENSORED' },
  })
}

function unavailableCount(window: { start: string; end: string }, resultId = 'r-unavailable'): Json {
  return makeResult({
    resultId,
    metric: COUNT_METRIC,
    window,
    state: 'unavailable',
    stateReasonCode: 'CAPABILITY_NEVER_AUTHORIZED',
    counts: { eligible: 0, censored: 0, excluded: [] },
    value: { kind: 'no_value', reasonCode: 'CAPABILITY_NEVER_AUTHORIZED' },
  })
}

function truncatedCount(window: { start: string; end: string }, resultId = 'r-truncated'): Json {
  return makeResult({
    resultId,
    metric: COUNT_METRIC,
    window,
    state: 'truncated',
    stateReasonCode: 'SOURCE_PAGE_LIMIT_REACHED',
    counts: { eligible: 40, censored: 0, excluded: [] },
    value: { kind: 'count', observedCount: 40 },
    coverage: [
      { dimension: 'completeness', value: 0.6, limiting_reason: 'SATURATION_CAP_REACHED' },
      { dimension: 'comparability', value: 1, limiting_reason: null },
    ],
  })
}

function makeSpec(overrides: Json = {}): Json {
  return {
    comparisonId: 'cmp-1',
    asOf: AS_OF,
    currentWindow: CURRENT_WINDOW,
    baselineWindow: BASELINE_WINDOW,
    metric: INTERVAL_METRIC,
    cohortId: COHORT,
    scopeAlias: SCOPE,
    censoringTreatment: 'uncensored_sample_with_declared_tails',
    minimumMatchedFraction: 0.3,
    comparabilityTolerance: 0.8,
    minimumSupportUnits: 0,
    ...overrides,
  }
}

function makeSide(result: Json, subwindows: Json[] = [], matchedResult: Json | null = null): Json {
  return { result, subwindows, matchedResult }
}

function fullSub(window: { start: string; end: string }, instrument: Json = INSTRUMENT_A, comparability: Json = COMPARABLE_1): Json[] {
  return [{ window, instrument, comparability }]
}

function firstHalfSub(start: string, mid: string, instrument: Json = INSTRUMENT_A): Json[] {
  return [{ window: { start, end: mid }, instrument, comparability: COMPARABLE_1 }]
}

/** A canonical FULL-coverage interval comparison, current vs baseline, both fully instrument-matched. */
function fullIntervalInput(overrides: { spec?: Json } = {}): Json {
  const current = observedInterval(CURRENT_WINDOW, {
    eligible: 12,
    censored: 2,
    sampleSize: 10,
    quantiles: [{ quantile: 0.5, value: 50_000 }, { quantile: 0.9, value: 130_000 }],
    resultId: 'r-current',
  })
  const baseline = observedInterval(BASELINE_WINDOW, {
    eligible: 10,
    censored: 1,
    sampleSize: 9,
    quantiles: [{ quantile: 0.5, value: 40_000 }, { quantile: 0.9, value: 100_000 }],
    resultId: 'r-baseline',
  })
  return {
    spec: overrides.spec ?? makeSpec(),
    current: makeSide(current, fullSub(CURRENT_WINDOW)),
    baseline: makeSide(baseline, fullSub(BASELINE_WINDOW)),
  }
}

function asIncomparable(result: ComparisonResult): Extract<ComparisonResult, { outcome: 'INCOMPARABLE' }> {
  expect(result.outcome).toBe('INCOMPARABLE')
  if (result.outcome !== 'INCOMPARABLE') throw new Error('not incomparable')
  return result
}

/* ------------------------------------------------------------------------------------------ *
 * 1. Injected asOf — zero clock reads (asserted against the module source)
 * ------------------------------------------------------------------------------------------ */

describe('injected asOf: the module never reads a clock', () => {
  // Resolve from the project root (vitest's cwd); the module sits beside this test in shared/.
  const source = readFileSync(resolve(process.cwd(), 'shared/comparison.ts'), 'utf8')

  it('contains no Date.now', () => {
    expect(source).not.toMatch(/Date\.now/)
  })

  it('contains no performance.now', () => {
    expect(source).not.toMatch(/performance\s*\.\s*now/)
  })

  it('contains no argument-less new Date()', () => {
    expect(source).not.toMatch(/new\s+Date\(\s*\)/)
  })

  it('uses no `new Date(...)` at all — Date.parse of a string is the only permitted Date API', () => {
    expect(source).not.toMatch(/new\s+Date\s*\(/)
    expect(source).toMatch(/Date\.parse\(/)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 2. Equal-duration half-open UTC windows
 * ------------------------------------------------------------------------------------------ */

describe('half-open UTC windows', () => {
  it('membership is [start, end): an event exactly at end belongs to the next window', () => {
    expect(windowContains(CURRENT_WINDOW, CURRENT_WINDOW.start)).toBe(true)
    expect(windowContains(CURRENT_WINDOW, CURRENT_WINDOW.end)).toBe(false)
    expect(windowContains(BASELINE_WINDOW, BASELINE_WINDOW.end)).toBe(false)
  })

  it('a shared boundary event is counted exactly once across two adjacent windows', () => {
    const boundary = BASELINE_WINDOW.end // === CURRENT_WINDOW.start
    expect(windowContains(BASELINE_WINDOW, boundary)).toBe(false)
    expect(windowContains(CURRENT_WINDOW, boundary)).toBe(true)
  })

  it('honours offsets: +02:00 and Z that name the same instant are treated as equal', () => {
    // 2026-01-11T02:00:00+02:00 === 2026-01-11T00:00:00Z === CURRENT_WINDOW.start
    expect(windowContains(CURRENT_WINDOW, '2026-01-11T02:00:00+02:00')).toBe(true)
    // 2026-01-21T02:00:00+02:00 === 2026-01-21T00:00:00Z === CURRENT_WINDOW.end -> next window
    expect(windowContains(CURRENT_WINDOW, '2026-01-21T02:00:00+02:00')).toBe(false)
    expect(windowDurationMs({ start: '2026-01-11T00:00:00.000Z', end: '2026-01-21T02:00:00+02:00' })).toBe(TEN_DAYS)
  })

  it('rejects a window whose start is not strictly before its end', () => {
    expect(HalfOpenWindowSchema.safeParse({ start: CURRENT_WINDOW.end, end: CURRENT_WINDOW.end }).success).toBe(false)
    expect(HalfOpenWindowSchema.safeParse({ start: CURRENT_WINDOW.end, end: CURRENT_WINDOW.start }).success).toBe(false)
    expect(HalfOpenWindowSchema.safeParse(CURRENT_WINDOW).success).toBe(true)
  })

  it('computes equal durations for the matched pair', () => {
    expect(windowDurationMs(CURRENT_WINDOW)).toBe(TEN_DAYS)
    expect(windowDurationMs(BASELINE_WINDOW)).toBe(TEN_DAYS)
  })
})

describe('comparison spec: matched-pair rules', () => {
  it('accepts equal-duration, adjacent, non-overlapping windows', () => {
    expect(ComparisonSpecSchema.safeParse(makeSpec()).success).toBe(true)
  })

  it('accepts an offset-expressed boundary that is the same instant as the neighbour (no string compare)', () => {
    // current start written with a +02:00 offset equal to the baseline end written in Z.
    const spec = makeSpec({ currentWindow: { start: '2026-01-11T02:00:00+02:00', end: '2026-01-21T02:00:00+02:00' } })
    expect(ComparisonSpecSchema.safeParse(spec).success).toBe(true)
  })

  it('rejects unequal-duration windows', () => {
    const spec = makeSpec({ currentWindow: { start: '2026-01-11T00:00:00.000Z', end: '2026-01-31T00:00:00.000Z' } })
    expect(ComparisonSpecSchema.safeParse(spec).success).toBe(false)
  })

  it('rejects overlapping current/baseline windows', () => {
    const spec = makeSpec({ baselineWindow: { start: '2026-01-05T00:00:00.000Z', end: '2026-01-15T00:00:00.000Z' } })
    expect(ComparisonSpecSchema.safeParse(spec).success).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 3. The three outcomes with matched fraction as a first-class number
 * ------------------------------------------------------------------------------------------ */

describe('three outcomes: FULL / MATCHED_PARTIAL / INCOMPARABLE', () => {
  it('FULL: total instrument coverage yields matchedFraction 1 and whole-window arithmetic', () => {
    const result = compareMatchedWindows(fullIntervalInput())
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL') {
      expect(result.matchedFraction).toBe(1)
      expect(result.arithmeticBasis).toBe('whole_window')
      expect(result.residual).toHaveLength(0)
      expect(result.value.kind).toBe('quantile_delta')
      expect(result.counts.eligibleDelta).toBe(2) // 12 - 10
      expect(result.counts.censoredDelta).toBe(1) // 2 - 1
      if (result.value.kind === 'quantile_delta') {
        expect(result.value.currentSampleSize).toBe(10)
        expect(result.value.baselineSampleSize).toBe(9)
        expect(result.value.quantiles.map((q) => q.delta)).toEqual([10_000, 30_000])
      }
      // uncensored treatment with censored units on both sides, at unequal rates.
      const codes = result.limitations.map((l) => l.code)
      expect(codes).toContain('CENSORED_TAILS_EXCLUDED')
      expect(codes).toContain('UNEQUAL_CENSORING_BETWEEN_SIDES')
    }
    // The result round-trips its own schema.
    expect(ComparisonResultSchema.safeParse(result).success).toBe(true)
  })

  it('MATCHED_PARTIAL: partial coverage uses only the matched-subwindow results and carries the bias limitation', () => {
    const spec = makeSpec()
    const current = observedInterval(CURRENT_WINDOW, { eligible: 12, censored: 2, sampleSize: 10, quantiles: [{ quantile: 0.5, value: 50_000 }, { quantile: 0.9, value: 130_000 }], resultId: 'r-current' })
    const baseline = observedInterval(BASELINE_WINDOW, { eligible: 10, censored: 1, sampleSize: 9, quantiles: [{ quantile: 0.5, value: 40_000 }, { quantile: 0.9, value: 100_000 }], resultId: 'r-baseline' })
    const currentMatched = observedInterval({ start: CURRENT_WINDOW.start, end: CURRENT_MID }, { eligible: 6, censored: 1, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 48_000 }, { quantile: 0.9, value: 120_000 }], resultId: 'r-current-matched' })
    const baselineMatched = observedInterval({ start: BASELINE_WINDOW.start, end: BASELINE_MID }, { eligible: 5, censored: 0, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 38_000 }, { quantile: 0.9, value: 95_000 }], resultId: 'r-baseline-matched' })
    const result = compareMatchedWindows({
      spec,
      current: makeSide(current, firstHalfSub(CURRENT_WINDOW.start, CURRENT_MID), currentMatched),
      baseline: makeSide(baseline, firstHalfSub(BASELINE_WINDOW.start, BASELINE_MID), baselineMatched),
    })
    expect(result.outcome).toBe('MATCHED_PARTIAL')
    if (result.outcome === 'MATCHED_PARTIAL') {
      expect(result.matchedFraction).toBeCloseTo(0.5, 10)
      expect(result.arithmeticBasis).toBe('matched_subwindows_only')
      // Counts come from the MATCHED results (6 vs 5), never the whole-window 12 vs 10.
      expect(result.counts.current.eligible).toBe(6)
      expect(result.counts.baseline.eligible).toBe(5)
      expect(result.counts.eligibleDelta).toBe(1)
      expect(result.limitations.map((l) => l.code)).toContain(REQUIRED_MATCHED_PARTIAL_LIMITATION)
      expect(result.residual).toHaveLength(1)
      expect(result.residual[0].mismatchKind).toBe('NO_COUNTERPART')
      if (result.value.kind === 'quantile_delta') {
        expect(result.value.currentSampleSize).toBe(5)
        expect(result.value.quantiles.map((q) => q.delta)).toEqual([10_000, 25_000])
      }
    }
    expect(ComparisonResultSchema.safeParse(result).success).toBe(true)
  })

  it('INCOMPARABLE carries no counts/value/censoring on the actual result object', () => {
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: COUNT_METRIC }),
      current: makeSide(unavailableCount(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(observedCount(BASELINE_WINDOW, { eligible: 40, count: 40 }), fullSub(BASELINE_WINDOW)),
    })
    const refusal = asIncomparable(result)
    expect(refusal.reasonCode).toBe('UNAVAILABLE_SIDE')
    expect(Object.prototype.hasOwnProperty.call(refusal, 'counts')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(refusal, 'value')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(refusal, 'censoring')).toBe(false)
  })

  it('isComparable narrows FULL/MATCHED_PARTIAL true and INCOMPARABLE false', () => {
    expect(isComparable(compareMatchedWindows(fullIntervalInput()))).toBe(true)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 4. Strict output schema — a refusal cannot carry a delta, a matched-partial cannot drop the bias
 * ------------------------------------------------------------------------------------------ */

describe('strict result schema', () => {
  const identity = {
    comparisonId: 'cmp-x',
    contractVersion: COMPARISON_CONTRACT_VERSION,
    asOf: AS_OF,
    metric: INTERVAL_METRIC,
    cohortId: COHORT,
    scopeAlias: SCOPE,
    currentWindow: CURRENT_WINDOW,
    baselineWindow: BASELINE_WINDOW,
  }

  const validMatchedPartial = {
    ...identity,
    outcome: 'MATCHED_PARTIAL',
    matchedFraction: 0.5,
    arithmeticBasis: 'matched_subwindows_only',
    counts: { current: { eligible: 6, censored: 1 }, baseline: { eligible: 5, censored: 0 }, eligibleDelta: 1, censoredDelta: 1 },
    value: { kind: 'count_delta', current: 6, baseline: 5, delta: 1 },
    censoring: { treatment: 'counts_only_delta', currentCensored: 1, baselineCensored: 0, statement: 'Counts differenced across the matched subwindows only.' },
    limitations: [{ code: 'MATCHED_SUBWINDOW_SELECTION_BIAS', statement: 'Matched subwindows are a non-random subsample of the period.' }],
    residual: [{ startOffsetMs: FIVE_DAYS, endOffsetMs: TEN_DAYS, mismatchKind: 'NO_COUNTERPART', disqualifyingDimension: 'comparability', limitingReason: 'NO_SNAPSHOT_PAIR' }],
  }

  const validIncomparable = {
    ...identity,
    outcome: 'INCOMPARABLE',
    matchedFraction: null,
    reasonCode: 'UNAVAILABLE_SIDE',
    detail: 'The baseline side is unavailable, so there is nothing to compare.',
    residual: [],
  }

  it('accepts a well-formed MATCHED_PARTIAL', () => {
    expect(ComparisonResultSchema.safeParse(validMatchedPartial).success).toBe(true)
  })

  it('refuses a MATCHED_PARTIAL missing the MATCHED_SUBWINDOW_SELECTION_BIAS limitation', () => {
    const withoutBias = {
      ...validMatchedPartial,
      limitations: [{ code: 'CENSORED_TAILS_EXCLUDED', statement: 'Right-censored units were excluded from the compared sample.' }],
    }
    expect(ComparisonResultSchema.safeParse(withoutBias).success).toBe(false)
  })

  it('refuses a MATCHED_PARTIAL with no limitations at all', () => {
    expect(ComparisonResultSchema.safeParse({ ...validMatchedPartial, limitations: [] }).success).toBe(false)
  })

  it('accepts a well-formed INCOMPARABLE', () => {
    expect(ComparisonResultSchema.safeParse(validIncomparable).success).toBe(true)
  })

  it('refuses an INCOMPARABLE with a value delta injected onto it', () => {
    const withDelta = { ...validIncomparable, value: { kind: 'count_delta', current: 0, baseline: 0, delta: 0 } }
    expect(ComparisonResultSchema.safeParse(withDelta).success).toBe(false)
  })

  it('refuses an INCOMPARABLE with counts or censoring injected onto it', () => {
    const withCounts = { ...validIncomparable, counts: { current: { eligible: 0, censored: 0 }, baseline: { eligible: 0, censored: 0 }, eligibleDelta: 0, censoredDelta: 0 } }
    const withCensoring = { ...validIncomparable, censoring: { treatment: 'counts_only_delta', currentCensored: 0, baselineCensored: 0, statement: 'Counts differenced only.' } }
    expect(ComparisonResultSchema.safeParse(withCounts).success).toBe(false)
    expect(ComparisonResultSchema.safeParse(withCensoring).success).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 5. Issue #67 — empty cohorts, censoring, and the no-fabricated-zero guarantee
 * ------------------------------------------------------------------------------------------ */

describe('issue #67: empty cohorts and typed no-value', () => {
  function countInput(current: Json, baseline: Json): Json {
    return {
      spec: makeSpec({ metric: COUNT_METRIC }),
      current: makeSide(current, fullSub(CURRENT_WINDOW)),
      baseline: makeSide(baseline, fullSub(BASELINE_WINDOW)),
    }
  }

  it('empty-vs-populated COUNT is a real count difference (0 vs 40 -> -40)', () => {
    const result = compareMatchedWindows(countInput(emptyCount(CURRENT_WINDOW), observedCount(BASELINE_WINDOW, { eligible: 40, count: 40 })))
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL' && result.value.kind === 'count_delta') {
      expect(result.value.current).toBe(0)
      expect(result.value.baseline).toBe(40)
      expect(result.value.delta).toBe(-40)
    } else {
      throw new Error('expected a count_delta')
    }
  })

  it('populated-vs-empty COUNT is a real count difference (40 vs 0 -> +40)', () => {
    const result = compareMatchedWindows(countInput(observedCount(CURRENT_WINDOW, { eligible: 40, count: 40 }), emptyCount(BASELINE_WINDOW)))
    if (result.outcome === 'FULL' && result.value.kind === 'count_delta') {
      expect(result.value.delta).toBe(40)
    } else {
      throw new Error('expected a count_delta')
    }
  })

  it('empty-vs-populated DURATION/quantile is a typed no_value EMPTY_SIDE_NO_DISTRIBUTION', () => {
    const populated = observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }] })
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: INTERVAL_METRIC }),
      current: makeSide(emptyInterval(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(populated, fullSub(BASELINE_WINDOW)),
    })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL') {
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'EMPTY_SIDE_NO_DISTRIBUTION' })
      // The count difference is still real and present alongside the refused distribution.
      expect(result.counts.eligibleDelta).toBe(-8)
      expect(result.limitations.map((l) => l.code)).toContain('EMPTY_COHORT_SIDE')
    }
  })

  it('empty-vs-populated PROPORTION is PROPORTION_UNDEFINED_ON_EMPTY_COHORT', () => {
    const populated = observedShare(BASELINE_WINDOW, { eligible: 20, numerator: 10, denominator: 20 })
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: SHARE_METRIC }),
      current: makeSide(emptyShare(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(populated, fullSub(BASELINE_WINDOW)),
    })
    if (result.outcome === 'FULL') {
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'PROPORTION_UNDEFINED_ON_EMPTY_COHORT' })
    } else {
      throw new Error('expected FULL with a no_value')
    }
  })

  it('empty-vs-empty (distribution) is BOTH_SIDES_EMPTY_COHORT', () => {
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: INTERVAL_METRIC }),
      current: makeSide(emptyInterval(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(emptyInterval(BASELINE_WINDOW), fullSub(BASELINE_WINDOW)),
    })
    if (result.outcome === 'FULL') {
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'BOTH_SIDES_EMPTY_COHORT' })
    } else {
      throw new Error('expected FULL with a no_value')
    }
  })

  it('empty-vs-empty (count) is a real observed zero, never a fabricated absence', () => {
    // Both sides fully observed zero eligible units: the count difference of 0 is measured, not fabricated.
    const result = compareMatchedWindows(countInput(emptyCount(CURRENT_WINDOW), emptyCount(BASELINE_WINDOW)))
    if (result.outcome === 'FULL' && result.value.kind === 'count_delta') {
      expect(result.value.delta).toBe(0)
    } else {
      throw new Error('expected a real count_delta of 0')
    }
  })

  it('empty-vs-empty on an unregistered, no_value-encoded metric is BOTH_SIDES_EMPTY_COHORT (proportion never established)', () => {
    // F1: SHARE_METRIC is unregistered and both empty sides are no_value-encoded, so neither the
    // side values nor the registry establish a proportion. The honest reading is two observed empty
    // cohorts — never the PROPORTION_UNDEFINED label, which asserts a proportion that was never set.
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: SHARE_METRIC }),
      current: makeSide(emptyShare(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(emptyShare(BASELINE_WINDOW), fullSub(BASELINE_WINDOW)),
    })
    if (result.outcome === 'FULL') {
      expect(result.value.kind).toBe('no_value')
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'BOTH_SIDES_EMPTY_COHORT' })
    } else {
      throw new Error('expected FULL with a no_value')
    }
  })

  it('a censored-only side yields a typed no_value CENSORED_ONLY_SIDE', () => {
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: INTERVAL_METRIC }),
      current: makeSide(censoredOnlyInterval(CURRENT_WINDOW, AS_OF), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }] }), fullSub(BASELINE_WINDOW)),
    })
    if (result.outcome === 'FULL') {
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'CENSORED_ONLY_SIDE' })
    } else {
      throw new Error('expected FULL with CENSORED_ONLY_SIDE no_value')
    }
  })

  it('a declared counts_only treatment yields COUNTS_ONLY_BY_DECLARED_TREATMENT but keeps real counts', () => {
    const result = compareMatchedWindows(fullIntervalInput({ spec: makeSpec({ censoringTreatment: 'counts_only_delta' }) }))
    if (result.outcome === 'FULL') {
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'COUNTS_ONLY_BY_DECLARED_TREATMENT' })
      expect(result.counts.eligibleDelta).toBe(2)
      expect(result.censoring.treatment).toBe('counts_only_delta')
    }
  })

  it('an unavailable side is INCOMPARABLE UNAVAILABLE_SIDE (never a zero)', () => {
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: COUNT_METRIC }),
      current: makeSide(unavailableCount(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(observedCount(BASELINE_WINDOW, { eligible: 40, count: 40 }), fullSub(BASELINE_WINDOW)),
    })
    expect(asIncomparable(result).reasonCode).toBe('UNAVAILABLE_SIDE')
  })

  it('a truncated side is INCOMPARABLE TRUNCATED_SIDE', () => {
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: COUNT_METRIC }),
      current: makeSide(truncatedCount(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(observedCount(BASELINE_WINDOW, { eligible: 40, count: 40 }), fullSub(BASELINE_WINDOW)),
    })
    expect(asIncomparable(result).reasonCode).toBe('TRUNCATED_SIDE')
  })

  it('no_censoring_possible contradicted by censored>0 is INCOMPARABLE CENSORING_TREATMENT_CONTRADICTED', () => {
    const current = observedCount(CURRENT_WINDOW, { eligible: 40, count: 40, censored: 5, resultId: 'r-current' })
    const baseline = observedCount(BASELINE_WINDOW, { eligible: 30, count: 30, censored: 0, resultId: 'r-baseline' })
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: COUNT_METRIC, censoringTreatment: 'no_censoring_possible' }),
      current: makeSide(current, fullSub(CURRENT_WINDOW)),
      baseline: makeSide(baseline, fullSub(BASELINE_WINDOW)),
    })
    expect(asIncomparable(result).reasonCode).toBe('CENSORING_TREATMENT_CONTRADICTED')
  })

  it('no refusal path ever fabricates a zero delta', () => {
    const refusalInputs: Json[] = [
      { spec: makeSpec({ metric: COUNT_METRIC }), current: makeSide(unavailableCount(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)), baseline: makeSide(observedCount(BASELINE_WINDOW, { eligible: 40, count: 40 }), fullSub(BASELINE_WINDOW)) },
      { spec: makeSpec({ metric: COUNT_METRIC }), current: makeSide(truncatedCount(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)), baseline: makeSide(observedCount(BASELINE_WINDOW, { eligible: 40, count: 40 }), fullSub(BASELINE_WINDOW)) },
      { spec: makeSpec({ metric: SHARE_METRIC }), current: makeSide(emptyShare(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)), baseline: makeSide(observedShare(BASELINE_WINDOW, { eligible: 20, numerator: 10, denominator: 20 }), fullSub(BASELINE_WINDOW)) },
      { spec: makeSpec({ metric: INTERVAL_METRIC }), current: makeSide(emptyInterval(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)), baseline: makeSide(observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }] }), fullSub(BASELINE_WINDOW)) },
    ]
    for (const input of refusalInputs) {
      const result = compareMatchedWindows(input)
      if (result.outcome === 'INCOMPARABLE') {
        expect(Object.prototype.hasOwnProperty.call(result, 'value')).toBe(false)
      } else {
        // A comparable outcome may still refuse the value; when it does, it is a typed no_value.
        if (result.value.kind === 'no_value') {
          expect(typeof result.value.reasonCode).toBe('string')
        }
        // It is never a count/proportion/quantile delta that reads as a fabricated zero here,
        // because none of these inputs is a genuine observed-zero count comparison.
        expect(result.value.kind).toBe('no_value')
      }
    }
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 5b. F1 — empty-cohort class holds under either legal encoding, and the no_value case
 * ------------------------------------------------------------------------------------------ */

describe('F1: empty-cohort classification under either legal encoding', () => {
  // pull_request.ready_event_count@1.0.0 is a REGISTERED distinct_count (count class).
  const REGISTERED_COUNT_METRIC = { metricId: 'pull_request.ready_event_count', version: '1.0.0' }

  /** An empty side under the OTHER legal empty encoding: no_value/EMPTY_ELIGIBLE_COHORT. */
  const emptyCountNoValue = (window: { start: string; end: string }, metric = COUNT_METRIC, resultId = 'r-empty-count-nv') =>
    emptyCohort(window, metric, { kind: 'no_value', reasonCode: 'EMPTY_ELIGIBLE_COHORT' }, resultId)
  const emptyIntervalNoValue = (window: { start: string; end: string }, resultId = 'r-empty-interval-nv') =>
    emptyCohort(window, INTERVAL_METRIC, { kind: 'no_value', reasonCode: 'EMPTY_ELIGIBLE_COHORT' }, resultId)

  it('no_value-encoded empty count side vs observed 40 is count_delta -40 (empty as current)', () => {
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: COUNT_METRIC }),
      current: makeSide(emptyCountNoValue(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(observedCount(BASELINE_WINDOW, { eligible: 40, count: 40 }), fullSub(BASELINE_WINDOW)),
    })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL' && result.value.kind === 'count_delta') {
      expect(result.value.current).toBe(0)
      expect(result.value.baseline).toBe(40)
      expect(result.value.delta).toBe(-40)
    } else {
      throw new Error('expected a count_delta of -40')
    }
  })

  it('no_value-encoded empty count side vs observed 40 is count_delta +40 (empty as baseline)', () => {
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: COUNT_METRIC }),
      current: makeSide(observedCount(CURRENT_WINDOW, { eligible: 40, count: 40 }), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(emptyCountNoValue(BASELINE_WINDOW), fullSub(BASELINE_WINDOW)),
    })
    if (result.outcome === 'FULL' && result.value.kind === 'count_delta') {
      expect(result.value.delta).toBe(40)
    } else {
      throw new Error('expected a count_delta of +40')
    }
  })

  it('no_value-encoded empty quantile side vs populated is EMPTY_SIDE_NO_DISTRIBUTION', () => {
    const populated = observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }] })
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: INTERVAL_METRIC }),
      current: makeSide(emptyIntervalNoValue(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(populated, fullSub(BASELINE_WINDOW)),
    })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL') {
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'EMPTY_SIDE_NO_DISTRIBUTION' })
    }
  })

  it('both-empty no_value on the REGISTERED count metric is a real count_delta 0', () => {
    // Neither side carries a concrete value, so the registered distinct_count formula decides the
    // class and the two observed empty cohorts subtract to an honest zero — never a proportion label.
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: REGISTERED_COUNT_METRIC }),
      current: makeSide(emptyCountNoValue(CURRENT_WINDOW, REGISTERED_COUNT_METRIC, 'r-reg-cur'), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(emptyCountNoValue(BASELINE_WINDOW, REGISTERED_COUNT_METRIC, 'r-reg-base'), fullSub(BASELINE_WINDOW)),
    })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL' && result.value.kind === 'count_delta') {
      expect(result.value.delta).toBe(0)
    } else {
      throw new Error('expected a real count_delta of 0')
    }
  })

  it('both-empty no_value on an UNREGISTERED metric is BOTH_SIDES_EMPTY_COHORT', () => {
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: COUNT_METRIC }),
      current: makeSide(emptyCountNoValue(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(emptyCountNoValue(BASELINE_WINDOW, COUNT_METRIC, 'r-empty-count-nv-2'), fullSub(BASELINE_WINDOW)),
    })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL') {
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'BOTH_SIDES_EMPTY_COHORT' })
    }
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 5c. S1 — matched-side state is re-checked; the censoring contradiction runs on effective sides
 * ------------------------------------------------------------------------------------------ */

describe('S1: matched-side state re-check and effective-side censoring', () => {
  const wholeCurrent = observedInterval(CURRENT_WINDOW, { eligible: 12, censored: 0, sampleSize: 12, quantiles: [{ quantile: 0.5, value: 50_000 }], resultId: 'r-current' })
  const wholeBaseline = observedInterval(BASELINE_WINDOW, { eligible: 10, censored: 0, sampleSize: 10, quantiles: [{ quantile: 0.5, value: 40_000 }], resultId: 'r-baseline' })
  const goodBaselineMatched = observedInterval({ start: BASELINE_WINDOW.start, end: BASELINE_MID }, { eligible: 5, censored: 0, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 38_000 }], resultId: 'r-bm' })

  function partial(currentMatched: Json, baselineMatched: Json, specOverride: Json = {}): Json {
    return {
      spec: makeSpec(specOverride),
      current: makeSide(wholeCurrent, firstHalfSub(CURRENT_WINDOW.start, CURRENT_MID), currentMatched),
      baseline: makeSide(wholeBaseline, firstHalfSub(BASELINE_WINDOW.start, BASELINE_MID), baselineMatched),
    }
  }

  it('an unavailable matched side is UNAVAILABLE_SIDE (never fed into MATCHED_PARTIAL counts)', () => {
    const unavailableMatched = makeResult({
      resultId: 'r-cm-unavailable',
      metric: INTERVAL_METRIC,
      window: { start: CURRENT_WINDOW.start, end: CURRENT_MID },
      state: 'unavailable',
      stateReasonCode: 'CAPABILITY_NEVER_AUTHORIZED',
      counts: { eligible: 0, censored: 0, excluded: [] },
      value: { kind: 'no_value', reasonCode: 'CAPABILITY_NEVER_AUTHORIZED' },
    })
    expect(asIncomparable(compareMatchedWindows(partial(unavailableMatched, goodBaselineMatched))).reasonCode).toBe('UNAVAILABLE_SIDE')
  })

  it('a truncated matched side is TRUNCATED_SIDE', () => {
    const truncatedMatched = makeResult({
      resultId: 'r-cm-truncated',
      metric: INTERVAL_METRIC,
      window: { start: CURRENT_WINDOW.start, end: CURRENT_MID },
      state: 'truncated',
      stateReasonCode: 'SOURCE_PAGE_LIMIT_REACHED',
      counts: { eligible: 5, censored: 0, excluded: [] },
      value: { kind: 'quantiles', sampleSize: 5, quantiles: [{ quantile: 0.5, value: 48_000 }] },
      coverage: [
        { dimension: 'completeness', value: 0.6, limiting_reason: 'SATURATION_CAP_REACHED' },
        { dimension: 'comparability', value: 1, limiting_reason: null },
      ],
    })
    expect(asIncomparable(compareMatchedWindows(partial(truncatedMatched, goodBaselineMatched))).reasonCode).toBe('TRUNCATED_SIDE')
  })

  it('no_censoring_possible with censored>0 only in the matched results is CENSORING_TREATMENT_CONTRADICTED', () => {
    // The whole sides report zero censored, so the old whole-side check would have passed this;
    // the effective-side check catches the censored units the matched arithmetic actually uses.
    const censoredMatched = observedInterval({ start: CURRENT_WINDOW.start, end: CURRENT_MID }, { eligible: 6, censored: 2, sampleSize: 4, quantiles: [{ quantile: 0.5, value: 48_000 }], resultId: 'r-cm-censored' })
    const result = compareMatchedWindows(partial(censoredMatched, goodBaselineMatched, { censoringTreatment: 'no_censoring_possible' }))
    expect(asIncomparable(result).reasonCode).toBe('CENSORING_TREATMENT_CONTRADICTED')
  })

  it('no_censoring_possible with censored=0 everywhere still produces MATCHED_PARTIAL', () => {
    const cleanMatched = observedInterval({ start: CURRENT_WINDOW.start, end: CURRENT_MID }, { eligible: 6, censored: 0, sampleSize: 6, quantiles: [{ quantile: 0.5, value: 48_000 }], resultId: 'r-cm-clean' })
    const result = compareMatchedWindows(partial(cleanMatched, goodBaselineMatched, { censoringTreatment: 'no_censoring_possible' }))
    expect(result.outcome).toBe('MATCHED_PARTIAL')
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 5d. F2 — the matched-subwindow result's own window is validated against the matched segment
 * ------------------------------------------------------------------------------------------ */

describe('F2: matched-subwindow result window is validated', () => {
  const wholeCurrent = observedInterval(CURRENT_WINDOW, { eligible: 12, censored: 0, sampleSize: 12, quantiles: [{ quantile: 0.5, value: 50_000 }], resultId: 'r-current' })
  const wholeBaseline = observedInterval(BASELINE_WINDOW, { eligible: 10, censored: 0, sampleSize: 10, quantiles: [{ quantile: 0.5, value: 40_000 }], resultId: 'r-baseline' })
  const goodCurrentMatched = observedInterval({ start: CURRENT_WINDOW.start, end: CURRENT_MID }, { eligible: 6, censored: 0, sampleSize: 6, quantiles: [{ quantile: 0.5, value: 48_000 }], resultId: 'r-cm' })
  const goodBaselineMatched = observedInterval({ start: BASELINE_WINDOW.start, end: BASELINE_MID }, { eligible: 5, censored: 0, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 38_000 }], resultId: 'r-bm' })

  function partial(
    currentMatched: Json | null,
    baselineMatched: Json | null,
    currentSub: Json[] = firstHalfSub(CURRENT_WINDOW.start, CURRENT_MID),
    baselineSub: Json[] = firstHalfSub(BASELINE_WINDOW.start, BASELINE_MID),
  ): Json {
    return {
      spec: makeSpec(),
      current: makeSide(wholeCurrent, currentSub, currentMatched),
      baseline: makeSide(wholeBaseline, baselineSub, baselineMatched),
    }
  }

  it('a whole-window matchedResult masquerading as matched-only is MATCHED_WINDOW_MISMATCH', () => {
    // The single matched segment is [0,5d), but this matched result spans the whole 10-day window.
    const masquerade = observedInterval(CURRENT_WINDOW, { eligible: 6, censored: 0, sampleSize: 6, quantiles: [{ quantile: 0.5, value: 48_000 }], resultId: 'r-cm-whole' })
    expect(asIncomparable(compareMatchedWindows(partial(masquerade, goodBaselineMatched))).reasonCode).toBe('MATCHED_WINDOW_MISMATCH')
  })

  it('a correct contiguous matched window produces MATCHED_PARTIAL end-to-end', () => {
    const result = compareMatchedWindows(partial(goodCurrentMatched, goodBaselineMatched))
    expect(result.outcome).toBe('MATCHED_PARTIAL')
    if (result.outcome === 'MATCHED_PARTIAL') {
      expect(result.matchedFraction).toBeCloseTo(0.5, 10)
      expect(result.counts.current.eligible).toBe(6)
      expect(result.value.kind).toBe('quantile_delta')
    }
  })

  it('two matched stretches split by a residual gap is MATCHED_SET_NONCONTIGUOUS', () => {
    // Each side covers [0,3d) and [5d,10d) with the same instrument; [3d,5d) is uncovered on both,
    // so the matched set is two disjoint segments — no single matched result can honestly cover it.
    const splitCurrentSub = [
      { window: { start: CURRENT_WINDOW.start, end: '2026-01-14T00:00:00.000Z' }, instrument: INSTRUMENT_A, comparability: COMPARABLE_1 },
      { window: { start: CURRENT_MID, end: CURRENT_WINDOW.end }, instrument: INSTRUMENT_A, comparability: COMPARABLE_1 },
    ]
    const splitBaselineSub = [
      { window: { start: BASELINE_WINDOW.start, end: '2026-01-04T00:00:00.000Z' }, instrument: INSTRUMENT_A, comparability: COMPARABLE_1 },
      { window: { start: BASELINE_MID, end: BASELINE_WINDOW.end }, instrument: INSTRUMENT_A, comparability: COMPARABLE_1 },
    ]
    const result = compareMatchedWindows(partial(null, null, splitCurrentSub, splitBaselineSub))
    expect(asIncomparable(result).reasonCode).toBe('MATCHED_SET_NONCONTIGUOUS')
  })

  it('an off-by-one-ms matched window end is MATCHED_WINDOW_MISMATCH', () => {
    const offByOne = observedInterval({ start: CURRENT_WINDOW.start, end: '2026-01-16T00:00:00.001Z' }, { eligible: 6, censored: 0, sampleSize: 6, quantiles: [{ quantile: 0.5, value: 48_000 }], resultId: 'r-cm-offbyone' })
    expect(asIncomparable(compareMatchedWindows(partial(offByOne, goodBaselineMatched))).reasonCode).toBe('MATCHED_WINDOW_MISMATCH')
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 5e. S2 — window-shape violations surface as a parse throw, not a dead typed refusal
 * ------------------------------------------------------------------------------------------ */

describe('S2: window-shape violations throw at parse, WINDOW_SHAPE_MISMATCH is removed', () => {
  it('compareMatchedWindows throws ComparisonContractError on mismatched-duration windows', () => {
    // A 20-day current window against the 10-day baseline fails ComparisonSpecSchema.superRefine,
    // so the input never parses and no INCOMPARABLE result (WINDOW_SHAPE_MISMATCH) is ever built.
    const wideWindow = { start: '2026-01-11T00:00:00.000Z', end: '2026-01-31T00:00:00.000Z' }
    const current = observedInterval(wideWindow, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }] })
    const baseline = observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 41_000 }] })
    expect(() =>
      compareMatchedWindows({
        spec: makeSpec({ currentWindow: wideWindow }),
        current: makeSide(current, fullSub(wideWindow)),
        baseline: makeSide(baseline, fullSub(BASELINE_WINDOW)),
      }),
    ).toThrow(ComparisonContractError)
  })

  it('STRUCTURAL_REFUSAL_REASONS no longer carries the dead WINDOW_SHAPE_MISMATCH member', () => {
    expect((STRUCTURAL_REFUSAL_REASONS as readonly string[]).includes('WINDOW_SHAPE_MISMATCH')).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 6. matchInstrumentSubwindows — partition, arithmetic, merging, precedence
 * ------------------------------------------------------------------------------------------ */

describe('matchInstrumentSubwindows', () => {
  const spec = ComparisonSpecSchema.parse(makeSpec())

  function sub(window: { start: string; end: string }, instrument: Json, comparability: Json = COMPARABLE_1): InstrumentSubwindow {
    return { window, instrument, comparability } as unknown as InstrumentSubwindow
  }

  it('returns null when subwindows overlap on a side (not a partition)', () => {
    const current = [
      sub({ start: CURRENT_WINDOW.start, end: '2026-01-17T00:00:00.000Z' }, INSTRUMENT_A),
      sub({ start: '2026-01-15T00:00:00.000Z', end: CURRENT_WINDOW.end }, INSTRUMENT_A),
    ]
    expect(matchInstrumentSubwindows(spec, current, fullSubTyped(BASELINE_WINDOW))).toBeNull()
  })

  it('returns null when a subwindow falls outside its parent window', () => {
    const current = [sub({ start: '2026-01-10T00:00:00.000Z', end: CURRENT_MID }, INSTRUMENT_A)]
    expect(matchInstrumentSubwindows(spec, current, fullSubTyped(BASELINE_WINDOW))).toBeNull()
  })

  it('computes matched fraction from aligned offsets (full match -> 1)', () => {
    const matching = matchInstrumentSubwindows(spec, fullSubTyped(CURRENT_WINDOW), fullSubTyped(BASELINE_WINDOW))
    expect(matching).not.toBeNull()
    expect(matching?.matchedMs).toBe(TEN_DAYS)
    expect(matching?.matchedFraction).toBe(1)
    expect(matching?.residual).toHaveLength(0)
  })

  it('computes a partial matched fraction and a residual for an uncovered tail', () => {
    const current = [sub({ start: CURRENT_WINDOW.start, end: CURRENT_MID }, INSTRUMENT_A)]
    const baseline = [sub({ start: BASELINE_WINDOW.start, end: BASELINE_MID }, INSTRUMENT_A)]
    const matching = matchInstrumentSubwindows(spec, current, baseline)
    expect(matching?.matchedMs).toBe(FIVE_DAYS)
    expect(matching?.matchedFraction).toBeCloseTo(0.5, 10)
    expect(matching?.residual).toHaveLength(1)
    expect(matching?.residual[0]).toMatchObject({ startOffsetMs: FIVE_DAYS, endOffsetMs: TEN_DAYS, mismatchKind: 'NO_COUNTERPART', limitingReason: 'NO_SNAPSHOT_PAIR' })
  })

  it('merges adjacent residual segments of the same kind into one interval', () => {
    // current covers only [0,3d); baseline covers [0,3d) and [5d,10d): the two uncovered stretches
    // [3d,5d) and [5d,10d) are both NO_COUNTERPART and adjacent, so they collapse to [3d,10d).
    const current = [sub({ start: CURRENT_WINDOW.start, end: '2026-01-14T00:00:00.000Z' }, INSTRUMENT_A)]
    const baseline = [
      sub({ start: BASELINE_WINDOW.start, end: '2026-01-04T00:00:00.000Z' }, INSTRUMENT_A),
      sub({ start: BASELINE_MID, end: BASELINE_WINDOW.end }, INSTRUMENT_A),
    ]
    const matching = matchInstrumentSubwindows(spec, current, baseline)
    expect(matching?.matchedMs).toBe(THREE_DAYS)
    expect(matching?.residual).toHaveLength(1)
    expect(matching?.residual[0]).toMatchObject({ startOffsetMs: THREE_DAYS, endOffsetMs: TEN_DAYS, mismatchKind: 'NO_COUNTERPART' })
  })

  it('keeps adjacent residual segments of different kinds separate', () => {
    // [0,5d): neither side covered -> NO_COUNTERPART. [5d,10d): both covered, different source -> SOURCE_CHANGED.
    const current = [sub({ start: CURRENT_MID, end: CURRENT_WINDOW.end }, { sourceId: 'source_a', parserMajor: 1, configRevision: 'x' })]
    const baseline = [sub({ start: BASELINE_MID, end: BASELINE_WINDOW.end }, { sourceId: 'source_b', parserMajor: 1, configRevision: 'x' })]
    const matching = matchInstrumentSubwindows(spec, current, baseline)
    expect(matching?.matchedMs).toBe(0)
    expect(matching?.residual.map((r) => r.mismatchKind)).toEqual(['NO_COUNTERPART', 'SOURCE_CHANGED'])
    expect(matching?.residual[1]).toMatchObject({ startOffsetMs: FIVE_DAYS, endOffsetMs: TEN_DAYS, limitingReason: null })
  })

  describe('classification precedence: NO_COUNTERPART > SOURCE_CHANGED > PARSER_MAJOR_CHANGED > CONFIG_REVISION_CHANGED > COMPARABILITY_BELOW_TOLERANCE', () => {
    function oneSegmentKind(current: Json, baseline: Json, comparabilityCurrent: Json = COMPARABLE_1, comparabilityBaseline: Json = COMPARABLE_1): string {
      const matching = matchInstrumentSubwindows(
        spec,
        [sub(CURRENT_WINDOW, current, comparabilityCurrent)],
        [sub(BASELINE_WINDOW, baseline, comparabilityBaseline)],
      )
      expect(matching?.residual).toHaveLength(1)
      return matching?.residual[0].mismatchKind as string
    }

    it('source difference outranks a simultaneous parser and config difference', () => {
      expect(oneSegmentKind({ sourceId: 'a', parserMajor: 1, configRevision: 'x' }, { sourceId: 'b', parserMajor: 2, configRevision: 'y' })).toBe('SOURCE_CHANGED')
    })

    it('parser-major difference outranks a config difference', () => {
      expect(oneSegmentKind({ sourceId: 'a', parserMajor: 1, configRevision: 'x' }, { sourceId: 'a', parserMajor: 2, configRevision: 'y' })).toBe('PARSER_MAJOR_CHANGED')
    })

    it('config-revision difference outranks a coverage shortfall', () => {
      expect(oneSegmentKind({ sourceId: 'a', parserMajor: 1, configRevision: 'x' }, { sourceId: 'a', parserMajor: 1, configRevision: 'y' }, { value: 0.1, limiting_reason: null }, { value: 0.1, limiting_reason: null })).toBe('CONFIG_REVISION_CHANGED')
    })

    it('a comparability shortfall is the lowest-precedence residual kind', () => {
      expect(oneSegmentKind(INSTRUMENT_A, INSTRUMENT_A, { value: 0.5, limiting_reason: 'NO_SNAPSHOT_PAIR' }, COMPARABLE_1)).toBe('COMPARABILITY_BELOW_TOLERANCE')
    })
  })

  it('passes a comparability shortfall reason through only when it is registered for the dimension', () => {
    // A registered comparability reason survives...
    const registered = matchInstrumentSubwindows(
      spec,
      [sub(CURRENT_WINDOW, INSTRUMENT_A, { value: 0.5, limiting_reason: 'PARSER_MAJOR_CHANGED' })],
      [sub(BASELINE_WINDOW, INSTRUMENT_A, COMPARABLE_1)],
    )
    expect(registered?.residual[0]).toMatchObject({ mismatchKind: 'COMPARABILITY_BELOW_TOLERANCE', limitingReason: 'PARSER_MAJOR_CHANGED' })
    // ...a code registered for a DIFFERENT dimension (freshness) is dropped to null, never emitted.
    const foreign = matchInstrumentSubwindows(
      spec,
      [sub(CURRENT_WINDOW, INSTRUMENT_A, { value: 0.5, limiting_reason: 'STALE_BEYOND_SLO' })],
      [sub(BASELINE_WINDOW, INSTRUMENT_A, COMPARABLE_1)],
    )
    expect(foreign?.residual[0]).toMatchObject({ mismatchKind: 'COMPARABILITY_BELOW_TOLERANCE', limitingReason: null })
  })

  it('a foreign comparability reason still produces a parseable INCOMPARABLE result end-to-end', () => {
    // Regression guard for the comparabilityReason fix: an unregistered-for-comparability code would
    // otherwise make ResidualSegmentSchema throw when the refusal is parsed on the way out.
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: INTERVAL_METRIC }),
      current: makeSide(observedInterval(CURRENT_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }] }), fullSub(CURRENT_WINDOW, INSTRUMENT_A, { value: 0.5, limiting_reason: 'STALE_BEYOND_SLO' })),
      baseline: makeSide(observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }] }), fullSub(BASELINE_WINDOW, INSTRUMENT_A)),
    })
    const refusal = asIncomparable(result)
    expect(refusal.reasonCode).toBe('NO_MATCHED_SUBWINDOW')
    expect(refusal.matchedFraction).toBe(0)
    expect(refusal.residual[0].limitingReason).toBeNull()
  })

  function fullSubTyped(window: { start: string; end: string }): InstrumentSubwindow[] {
    return [sub(window, INSTRUMENT_A)]
  }
})

describe('matched-fraction gates at compareMatchedWindows level', () => {
  it('NO_MATCHED_SUBWINDOW when nothing matched (fraction 0)', () => {
    // current covers the first half, baseline covers the second half: no aligned overlap.
    const current = observedInterval(CURRENT_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }] })
    const baseline = observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 41_000 }] })
    const result = compareMatchedWindows({
      spec: makeSpec(),
      current: makeSide(current, firstHalfSub(CURRENT_WINDOW.start, CURRENT_MID)),
      baseline: makeSide(baseline, [{ window: { start: BASELINE_MID, end: BASELINE_WINDOW.end }, instrument: INSTRUMENT_A, comparability: COMPARABLE_1 }]),
    })
    const refusal = asIncomparable(result)
    expect(refusal.reasonCode).toBe('NO_MATCHED_SUBWINDOW')
    expect(refusal.matchedFraction).toBe(0)
  })

  it('MATCHED_FRACTION_BELOW_MINIMUM when the matched fraction is positive but under the preregistered minimum', () => {
    const current = observedInterval(CURRENT_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }] })
    const baseline = observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 41_000 }] })
    const result = compareMatchedWindows({
      spec: makeSpec({ minimumMatchedFraction: 0.8 }), // actual matched is 0.5
      current: makeSide(current, firstHalfSub(CURRENT_WINDOW.start, CURRENT_MID), observedInterval({ start: CURRENT_WINDOW.start, end: CURRENT_MID }, { eligible: 4, censored: 0, sampleSize: 4, quantiles: [{ quantile: 0.5, value: 40_000 }], resultId: 'r-cm' })),
      baseline: makeSide(baseline, firstHalfSub(BASELINE_WINDOW.start, BASELINE_MID), observedInterval({ start: BASELINE_WINDOW.start, end: BASELINE_MID }, { eligible: 4, censored: 0, sampleSize: 4, quantiles: [{ quantile: 0.5, value: 41_000 }], resultId: 'r-bm' })),
    })
    const refusal = asIncomparable(result)
    expect(refusal.reasonCode).toBe('MATCHED_FRACTION_BELOW_MINIMUM')
    expect(refusal.matchedFraction).toBeCloseTo(0.5, 10)
  })

  it('SUBWINDOW_PARTITION_INVALID when a side is not a valid partition', () => {
    const current = observedInterval(CURRENT_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }] })
    const baseline = observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 41_000 }] })
    const overlapping = [
      { window: { start: CURRENT_WINDOW.start, end: '2026-01-17T00:00:00.000Z' }, instrument: INSTRUMENT_A, comparability: COMPARABLE_1 },
      { window: { start: '2026-01-15T00:00:00.000Z', end: CURRENT_WINDOW.end }, instrument: INSTRUMENT_A, comparability: COMPARABLE_1 },
    ]
    const result = compareMatchedWindows({ spec: makeSpec(), current: makeSide(current, overlapping), baseline: makeSide(baseline, fullSub(BASELINE_WINDOW)) })
    expect(asIncomparable(result).reasonCode).toBe('SUBWINDOW_PARTITION_INVALID')
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 7. Matched-partial arithmetic uses only recomputed matched-subwindow results
 * ------------------------------------------------------------------------------------------ */

describe('matched-partial arithmetic inputs', () => {
  function partialInput(currentMatched: Json | null, baselineMatched: Json | null, specOverride: Json = {}): Json {
    const current = observedInterval(CURRENT_WINDOW, { eligible: 12, censored: 2, sampleSize: 10, quantiles: [{ quantile: 0.5, value: 50_000 }], resultId: 'r-current' })
    const baseline = observedInterval(BASELINE_WINDOW, { eligible: 10, censored: 1, sampleSize: 9, quantiles: [{ quantile: 0.5, value: 40_000 }], resultId: 'r-baseline' })
    return {
      spec: makeSpec(specOverride),
      current: makeSide(current, firstHalfSub(CURRENT_WINDOW.start, CURRENT_MID), currentMatched),
      baseline: makeSide(baseline, firstHalfSub(BASELINE_WINDOW.start, BASELINE_MID), baselineMatched),
    }
  }

  const goodCurrentMatched = observedInterval({ start: CURRENT_WINDOW.start, end: CURRENT_MID }, { eligible: 6, censored: 1, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 48_000 }], resultId: 'r-cm' })
  const goodBaselineMatched = observedInterval({ start: BASELINE_WINDOW.start, end: BASELINE_MID }, { eligible: 5, censored: 0, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 38_000 }], resultId: 'r-bm' })

  it('missing matchedResult on a side is MATCHED_SUBWINDOW_RESULT_MISSING', () => {
    const result = compareMatchedWindows(partialInput(null, goodBaselineMatched))
    expect(asIncomparable(result).reasonCode).toBe('MATCHED_SUBWINDOW_RESULT_MISSING')
  })

  it('a matched result with more eligible units than its whole window is MATCHED_RESULT_EXCEEDS_WHOLE', () => {
    const tooBig = observedInterval({ start: CURRENT_WINDOW.start, end: CURRENT_MID }, { eligible: 20, censored: 0, sampleSize: 20, quantiles: [{ quantile: 0.5, value: 48_000 }], resultId: 'r-cm-big' })
    const result = compareMatchedWindows(partialInput(tooBig, goodBaselineMatched))
    expect(asIncomparable(result).reasonCode).toBe('MATCHED_RESULT_EXCEEDS_WHOLE')
  })

  it('a matched result bound to a different metric is METRIC_MISMATCH', () => {
    const wrongMetric = makeResult({ resultId: 'r-cm-wrong', metric: { metricId: 'compare.other_metric', version: '1.1.0' }, window: { start: CURRENT_WINDOW.start, end: CURRENT_MID }, state: 'observed', stateReasonCode: 'OBSERVED', counts: { eligible: 6, censored: 1, excluded: [] }, value: { kind: 'quantiles', sampleSize: 5, quantiles: [{ quantile: 0.5, value: 48_000 }] } })
    const result = compareMatchedWindows(partialInput(wrongMetric, goodBaselineMatched))
    expect(asIncomparable(result).reasonCode).toBe('METRIC_MISMATCH')
  })

  it('a matched result computed at a different asOf is AS_OF_MISMATCH', () => {
    const wrongAsOf = observedInterval({ start: CURRENT_WINDOW.start, end: CURRENT_MID }, { eligible: 6, censored: 1, sampleSize: 5, quantiles: [{ quantile: 0.5, value: 48_000 }], resultId: 'r-cm-asof', asOf: '2026-01-20T00:00:00.000Z' })
    const result = compareMatchedWindows(partialInput(wrongAsOf, goodBaselineMatched))
    expect(asIncomparable(result).reasonCode).toBe('AS_OF_MISMATCH')
  })

  it('valid matched results on both sides produce MATCHED_PARTIAL', () => {
    const result = compareMatchedWindows(partialInput(goodCurrentMatched, goodBaselineMatched))
    expect(result.outcome).toBe('MATCHED_PARTIAL')
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 8. Structural identity / binding refusals
 * ------------------------------------------------------------------------------------------ */

describe('structural refusals', () => {
  function intervalPairWith(currentOverride: Json = {}, baselineOverride: Json = {}, specOverride: Json = {}): Json {
    const current = { ...observedInterval(CURRENT_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }], resultId: 'r-current' }), ...currentOverride }
    const baseline = { ...observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 41_000 }], resultId: 'r-baseline' }), ...baselineOverride }
    return { spec: makeSpec(specOverride), current: makeSide(current, fullSub(CURRENT_WINDOW)), baseline: makeSide(baseline, fullSub(BASELINE_WINDOW)) }
  }

  it('WINDOW_OPEN_AT_AS_OF when asOf falls inside a compared window', () => {
    const openAsOf = '2026-01-15T00:00:00.000Z' // inside the current window
    const current = censoredOnlyInterval(CURRENT_WINDOW, openAsOf, 'r-current')
    const baseline = observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 41_000 }], resultId: 'r-baseline', asOf: openAsOf })
    const result = compareMatchedWindows({ spec: makeSpec({ asOf: openAsOf }), current: makeSide(current, fullSub(CURRENT_WINDOW)), baseline: makeSide(baseline, fullSub(BASELINE_WINDOW)) })
    expect(asIncomparable(result).reasonCode).toBe('WINDOW_OPEN_AT_AS_OF')
  })

  it('the base interval pair is comparable (sanity anchor for the mismatch cases)', () => {
    expect(compareMatchedWindows(intervalPairWith()).outcome).toBe('FULL')
  })

  it('AS_OF_MISMATCH when a side was computed at a different asOf', () => {
    // The baseline result was computed at a different (still valid) asOf than the spec's canonical one.
    const result = compareMatchedWindows(intervalPairWith({}, { asOf: '2026-01-20T00:00:00.000Z' }))
    expect(asIncomparable(result).reasonCode).toBe('AS_OF_MISMATCH')
  })

  it('WINDOW_BINDING_MISMATCH when a side result window is not the spec window', () => {
    const result = compareMatchedWindows(intervalPairWith({}, { window: CURRENT_WINDOW }))
    expect(asIncomparable(result).reasonCode).toBe('WINDOW_BINDING_MISMATCH')
  })

  it('METRIC_MISMATCH on a differing metric id', () => {
    const result = compareMatchedWindows(intervalPairWith({}, { metricId: 'compare.some_other_metric' }))
    expect(asIncomparable(result).reasonCode).toBe('METRIC_MISMATCH')
  })

  it('METRIC_MISMATCH on a version difference of the same metric', () => {
    const result = compareMatchedWindows(intervalPairWith({}, { metricVersion: '1.0.0' }))
    expect(asIncomparable(result).reasonCode).toBe('METRIC_MISMATCH')
  })

  it('COHORT_MISMATCH on a differing scope alias', () => {
    const result = compareMatchedWindows(intervalPairWith({}, { scopeAlias: 'scope-beta' }))
    expect(asIncomparable(result).reasonCode).toBe('COHORT_MISMATCH')
  })

  it('COMPARABILITY_DIMENSION_ABSENT when a side never measured comparability', () => {
    const result = compareMatchedWindows(intervalPairWith({ coverage: [{ dimension: 'completeness', value: 1, limiting_reason: null }] }))
    expect(asIncomparable(result).reasonCode).toBe('COMPARABILITY_DIMENSION_ABSENT')
  })

  it('COVERAGE_INCOMPARABLE when a side comparability is null', () => {
    const result = compareMatchedWindows(intervalPairWith({ coverage: [{ dimension: 'comparability', value: null, limiting_reason: 'NO_SNAPSHOT_PAIR' }] }))
    expect(asIncomparable(result).reasonCode).toBe('COVERAGE_INCOMPARABLE')
  })

  it('COVERAGE_INCOMPARABLE when a side comparability is below the preregistered tolerance', () => {
    const result = compareMatchedWindows(intervalPairWith({ coverage: [{ dimension: 'comparability', value: 0.5, limiting_reason: null }] }, {}, { comparabilityTolerance: 0.8 }))
    expect(asIncomparable(result).reasonCode).toBe('COVERAGE_INCOMPARABLE')
  })

  it('VALUE_KIND_MISMATCH when two present values are different kinds', () => {
    // Same metric binding, but the sides report a count and a distribution.
    const current = observedCount(CURRENT_WINDOW, { eligible: 8, count: 8, metric: INTERVAL_METRIC, resultId: 'r-current' })
    const baseline = observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 41_000 }], resultId: 'r-baseline' })
    const result = compareMatchedWindows({ spec: makeSpec(), current: makeSide(current, fullSub(CURRENT_WINDOW)), baseline: makeSide(baseline, fullSub(BASELINE_WINDOW)) })
    expect(asIncomparable(result).reasonCode).toBe('VALUE_KIND_MISMATCH')
  })

  it('QUANTILE_SET_MISMATCH when the two distributions report different quantile levels', () => {
    const current = observedInterval(CURRENT_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }, { quantile: 0.9, value: 90_000 }], resultId: 'r-current' })
    const baseline = observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 41_000 }, { quantile: 0.95, value: 95_000 }], resultId: 'r-baseline' })
    const result = compareMatchedWindows({ spec: makeSpec(), current: makeSide(current, fullSub(CURRENT_WINDOW)), baseline: makeSide(baseline, fullSub(BASELINE_WINDOW)) })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL') {
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'QUANTILE_SET_MISMATCH' })
    }
  })

  it('SUPPORT_GATE_FAILED when a side is below the minimum support units', () => {
    const current = observedShare(CURRENT_WINDOW, { eligible: 47, numerator: 31, denominator: 47, resultId: 'r-current' })
    const baseline = observedShare(BASELINE_WINDOW, { eligible: 40, numerator: 20, denominator: 40, resultId: 'r-baseline' })
    const result = compareMatchedWindows({ spec: makeSpec({ metric: SHARE_METRIC, minimumSupportUnits: 100 }), current: makeSide(current, fullSub(CURRENT_WINDOW)), baseline: makeSide(baseline, fullSub(BASELINE_WINDOW)) })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL') {
      expect(result.value).toEqual({ kind: 'no_value', reasonCode: 'SUPPORT_GATE_FAILED' })
    }
  })

  it('a comparable share above the support gate produces a real proportion_delta', () => {
    const current = observedShare(CURRENT_WINDOW, { eligible: 47, numerator: 31, denominator: 47, resultId: 'r-current' })
    const baseline = observedShare(BASELINE_WINDOW, { eligible: 40, numerator: 20, denominator: 40, resultId: 'r-baseline' })
    const result = compareMatchedWindows({ spec: makeSpec({ metric: SHARE_METRIC, minimumSupportUnits: 10 }), current: makeSide(current, fullSub(CURRENT_WINDOW)), baseline: makeSide(baseline, fullSub(BASELINE_WINDOW)) })
    expect(result.outcome).toBe('FULL')
    if (result.outcome === 'FULL' && result.value.kind === 'proportion_delta') {
      expect(result.value.deltaProportion).toBeCloseTo(31 / 47 - 20 / 40, 10)
    } else {
      throw new Error('expected a proportion_delta')
    }
  })

  it('rejects a structurally invalid input with a ComparisonContractError', () => {
    expect(() => compareMatchedWindows({ spec: { comparisonId: '' }, current: {}, baseline: {} })).toThrow(ComparisonContractError)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 9. toComparisonTableRow — refusals read as reasons, never numbers or zero-like dashes
 * ------------------------------------------------------------------------------------------ */

describe('toComparisonTableRow', () => {
  it('renders an INCOMPARABLE refusal as a reason, not a number or a dash', () => {
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: COUNT_METRIC }),
      current: makeSide(unavailableCount(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(observedCount(BASELINE_WINDOW, { eligible: 40, count: 40 }), fullSub(BASELINE_WINDOW)),
    })
    const row = toComparisonTableRow(result)
    expect(row.value).toBe('no comparison: UNAVAILABLE_SIDE')
    expect(row.eligible).toBe('not compared')
    expect(row.value).not.toBe('0')
    expect(row.value).not.toMatch(/^[-—–]$/)
    expect(row.value).not.toMatch(/\b0\b/)
  })

  it('renders a typed no_value comparison as a reason, not a bare zero', () => {
    const populated = observedInterval(BASELINE_WINDOW, { eligible: 8, censored: 0, sampleSize: 8, quantiles: [{ quantile: 0.5, value: 40_000 }] })
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: INTERVAL_METRIC }),
      current: makeSide(emptyInterval(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(populated, fullSub(BASELINE_WINDOW)),
    })
    const row = toComparisonTableRow(result)
    expect(row.value).toBe('no value: EMPTY_SIDE_NO_DISTRIBUTION')
  })

  it('renders a real count delta as a number', () => {
    const result = compareMatchedWindows({
      spec: makeSpec({ metric: COUNT_METRIC }),
      current: makeSide(emptyCount(CURRENT_WINDOW), fullSub(CURRENT_WINDOW)),
      baseline: makeSide(observedCount(BASELINE_WINDOW, { eligible: 40, count: 40 }), fullSub(BASELINE_WINDOW)),
    })
    const row = toComparisonTableRow(result)
    expect(row.value).toContain('delta -40')
    expect(row.eligible).toContain('delta -40')
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 10. Support-gate pin — comparisonSupportUnits mirrors metrics' private supportUnits
 * ------------------------------------------------------------------------------------------ */

describe('comparisonSupportUnits pin against metrics evaluateDisplayEligibility', () => {
  function observedForKind(kind: 'count' | 'proportion' | 'quantiles', support: number): MetricResult {
    const base = {
      resultId: `r-${kind}-${support}`,
      metricId: 'compare.pin_metric',
      metricVersion: '1.0.0',
      scopeAlias: SCOPE,
      window: BASELINE_WINDOW,
      asOf: AS_OF,
      state: 'observed',
      stateReasonCode: 'OBSERVED',
      coverage: COMPARABILITY_ONLY,
      evidenceIds: [],
      calculation: CALC,
      sensitivity: [],
    }
    if (kind === 'count') {
      return MetricResultSchema.parse({ ...base, counts: { eligible: support, censored: 0, excluded: [] }, value: { kind: 'count', observedCount: support } })
    }
    if (kind === 'proportion') {
      return MetricResultSchema.parse({ ...base, counts: { eligible: Math.max(support, 1), censored: 0, excluded: [] }, value: { kind: 'proportion', numerator: 0, denominator: support } })
    }
    return MetricResultSchema.parse({ ...base, counts: { eligible: support, censored: 0, excluded: [] }, value: { kind: 'quantiles', sampleSize: support, quantiles: [{ quantile: 0.5, value: 1_000 }] } })
  }

  it('agrees on the below-gate boundary for every value kind and every registered definition', () => {
    const definitions = listActiveMetrics()
    expect(definitions.length).toBeGreaterThan(0)
    for (const definition of definitions) {
      const minimum = definition.supportGates.minimumEligible
      const supports = [minimum - 1, minimum, minimum + 1].filter((value) => value >= 1)
      for (const kind of ['count', 'proportion', 'quantiles'] as const) {
        for (const support of supports) {
          const result = observedForKind(kind, support)
          const measured = comparisonSupportUnits(result)
          expect(measured).toBe(support) // comparison-side number reads the same field metrics does
          const belowGate = evaluateDisplayEligibility(definition, result).reasonCode === 'BELOW_MINIMUM_SUPPORT'
          expect(belowGate).toBe(measured !== null && measured < minimum)
        }
      }
    }
  })

  it('returns null for a no_value result, matching a distribution with no support', () => {
    const censoredOnly = MetricResultSchema.parse(CENSORED_ONLY_RESULT)
    expect(comparisonSupportUnits(censoredOnly)).toBeNull()
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 11. Fixtures parse under MetricResultSchema (validity of the comparison inputs)
 * ------------------------------------------------------------------------------------------ */

describe('fixtures parse under MetricResultSchema', () => {
  it('every locally built side result parses', () => {
    const built: Json[] = [
      observedInterval(CURRENT_WINDOW, { eligible: 12, censored: 2, sampleSize: 10, quantiles: [{ quantile: 0.5, value: 50_000 }, { quantile: 0.9, value: 130_000 }] }),
      observedCount(CURRENT_WINDOW, { eligible: 40, count: 40 }),
      observedShare(CURRENT_WINDOW, { eligible: 47, numerator: 31, denominator: 47 }),
      emptyCount(CURRENT_WINDOW),
      emptyInterval(CURRENT_WINDOW),
      emptyShare(CURRENT_WINDOW),
      censoredOnlyInterval(CURRENT_WINDOW, AS_OF),
      unavailableCount(CURRENT_WINDOW),
      truncatedCount(CURRENT_WINDOW),
    ]
    for (const fixture of built) {
      expect(MetricResultSchema.safeParse(fixture).success).toBe(true)
    }
  })

  it('the canonical metricFixtures results also parse and expose the expected support numbers', () => {
    expect(comparisonSupportUnits(MetricResultSchema.parse(OBSERVED_INTERVAL_RESULT))).toBe(12) // sampleSize
    expect(comparisonSupportUnits(MetricResultSchema.parse(OBSERVED_SHARE_RESULT))).toBe(47) // denominator
    expect(comparisonSupportUnits(MetricResultSchema.parse(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT))).toBe(0) // eligible
  })
})
