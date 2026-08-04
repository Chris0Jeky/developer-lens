import { z } from 'zod'
import {
  CoverageDimensionSchema,
  CoverageDimensionValueSchema,
  CoverageLimitingReasonSchema,
  isLimitingReasonRegistered,
  type CoverageDimension,
  type CoverageLimitingReason,
} from './coverage.js'
import {
  MetricResultSchema,
  formatMetricReference,
  getMetricDefinition,
  isRegisteredMetric,
  type MetricFormula,
  type MetricResult,
  type MetricValue,
} from './metrics.js'

/**
 * ADR-26 §3 (with ADR-07's matched-window middle case) — the reusable matched-period comparison
 * contract (DL-COMPARE-01).
 *
 * The question this module exists to answer honestly: did this window genuinely differ from its
 * matched baseline window, or only in what we were able to observe?
 *
 * Three properties are load-bearing and are enforced by construction rather than by convention:
 *
 * 1. **A failed comparison is never a zero delta.** The result is a discriminated union, and the
 *    `INCOMPARABLE` member has no counts, no value, and no censoring declaration — a refusal is
 *    not representable as a number, so nothing downstream can render it as "no change".
 * 2. **Matched-partial arithmetic never touches unmatched time.** A `MATCHED_PARTIAL` outcome is
 *    computed only from metric results the caller recomputed over the matched subwindows. The
 *    naive whole-window diff is not merely un-rendered — it is never computed, so it cannot leak.
 * 3. **The system clock is never read.** Every instant enters through the injected canonical
 *    `asOf` or through the window schemas; the module parses ISO-8601 strings and nothing else.
 *    `shared/comparison.test.ts` proves this against the module source.
 *
 * There is no I/O, no network, no persistence, and no new export sink anywhere in it. The module
 * consumes the C1 aggregate shapes of `shared/metrics.ts` and `shared/coverage.ts`; it defines no
 * person-level concept and cannot express one, because a MetricResult cannot.
 *
 * DL-EVQ-08 later implements the era/snapshot variant of ADR-07 over this same contract.
 */
export const COMPARISON_CONTRACT_VERSION = '1.0.0' as const

/** Comparisons are aggregate-over-aggregate; the whole module is a C1 surface. */
export const COMPARISON_DATA_CLASS = 'C1' as const

export class ComparisonContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ComparisonContractError'
  }
}

/* ------------------------------------------------------------------------------------------ *
 * Primitive schemas
 *
 * These mirror the private primitives of `shared/metrics.ts` (which does not export them) so the
 * two contracts accept exactly the same identifiers, versions, codes, and instants. Where a shape
 * IS exported there — MetricResultSchema, the coverage dimension value — it is imported, never
 * re-declared.
 * ------------------------------------------------------------------------------------------ */

const IdentifierSchema = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/)
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/)
const StatementSchema = z.string().min(12)
const UtcInstantSchema = z.string().datetime({ offset: true })
const NonnegativeIntegerSchema = z.number().int().nonnegative()
const UnitIntervalSchema = z.number().min(0).max(1)

/**
 * Epoch milliseconds for an ISO-8601 instant that has already passed `UtcInstantSchema`.
 *
 * Offsets are honoured, so `2026-07-01T02:00:00+02:00` and `2026-07-01T00:00:00.000Z` are the
 * same instant. No local-time interpretation is possible anywhere in this module: there is no
 * locale formatting, no timezone database read, and no calendar arithmetic.
 */
function epochMs(instant: string): number {
  const parsed = Date.parse(instant)
  if (Number.isNaN(parsed)) {
    throw new ComparisonContractError(`Instant "${instant}" is not a parseable ISO-8601 timestamp`)
  }
  return parsed
}

/**
 * A half-open UTC interval `[start, end)`. An instant exactly at `end` belongs to the NEXT
 * window and never to this one, so an event on a shared boundary is counted exactly once across
 * a pair of adjacent windows.
 */
export const HalfOpenWindowSchema = z
  .object({ start: UtcInstantSchema, end: UtcInstantSchema })
  .strict()
  .superRefine((window, context) => {
    if (epochMs(window.start) >= epochMs(window.end)) {
      context.addIssue({
        code: 'custom',
        message: 'A comparison window is half-open and strictly increasing: start < end',
        path: ['end'],
      })
    }
  })
export type HalfOpenWindow = z.infer<typeof HalfOpenWindowSchema>

export function windowDurationMs(window: HalfOpenWindow): number {
  return epochMs(window.end) - epochMs(window.start)
}

/** Half-open membership: `start <= instant < end`. The single rule for every boundary question. */
export function windowContains(window: HalfOpenWindow, instant: string): boolean {
  const at = epochMs(instant)
  return at >= epochMs(window.start) && at < epochMs(window.end)
}

/* ------------------------------------------------------------------------------------------ *
 * Closed registries
 * ------------------------------------------------------------------------------------------ */

/**
 * The three comparability outcomes of ADR-26 §3 / ADR-07's middle case.
 *
 * `MATCHED_PARTIAL` is the case the naive design misses: the instrument matched on part of the
 * period, so a number exists, but only over that part and only with its selection-bias warning.
 */
export const COMPARISON_OUTCOMES = ['FULL', 'MATCHED_PARTIAL', 'INCOMPARABLE'] as const
export const ComparisonOutcomeSchema = z.enum(COMPARISON_OUTCOMES)
export type ComparisonOutcome = z.infer<typeof ComparisonOutcomeSchema>

/**
 * Structural refusals — reasons the two windows cannot be compared AT ALL. Each one produces an
 * `INCOMPARABLE` result, which carries no numbers of any kind.
 *
 * Window-SHAPE violations are deliberately NOT members here. Unequal-duration or overlapping
 * windows are a caller-contract error, not a data-observed refusal: `ComparisonSpecSchema` fails
 * closed on them (`superRefine`), so `ComparisonInputSchema.safeParse` rejects the input and
 * `compareMatchedWindows` throws a `ComparisonContractError` before any side is inspected. A shape
 * that can never reach the arithmetic cannot be a reason the arithmetic emits — the parse throw IS
 * the whole treatment, so there is no `WINDOW_SHAPE_MISMATCH` refusal code.
 */
export const STRUCTURAL_REFUSAL_REASONS = [
  /** The two sides name different metrics, or different versions of one metric. Never coerced. */
  'METRIC_MISMATCH',
  /** A side's result window is not the window the spec bound it to. */
  'WINDOW_BINDING_MISMATCH',
  /** A side was computed at a different `asOf` than the canonical injected one. */
  'AS_OF_MISMATCH',
  /** `asOf` falls inside a compared window: its open tail is unobserved, so durations differ. */
  'WINDOW_OPEN_AT_AS_OF',
  /** The two sides describe different scopes or cohorts. */
  'COHORT_MISMATCH',
  /** A side is `unavailable` or `coverage_failed`: there is nothing to compare, not a zero. */
  'UNAVAILABLE_SIDE',
  /** A side is `truncated`: its counts differ from the other side by instrument, not by system. */
  'TRUNCATED_SIDE',
  /** A side never measured the `comparability` dimension, so no matched claim is supportable. */
  'COMPARABILITY_DIMENSION_ABSENT',
  /** The `comparability` dimension is null or below the preregistered tolerance on a side. */
  'COVERAGE_INCOMPARABLE',
  /** Subwindows overlap, run backwards, or escape their parent window. */
  'SUBWINDOW_PARTITION_INVALID',
  /** No instant of the period had a matching instrument on both sides: matched fraction 0. */
  'NO_MATCHED_SUBWINDOW',
  /** Matched fraction is positive but below the metric's preregistered minimum. */
  'MATCHED_FRACTION_BELOW_MINIMUM',
  /** Matched-partial arithmetic was requested without results recomputed over matched time. */
  'MATCHED_SUBWINDOW_RESULT_MISSING',
  /** A matched-subwindow result claims more eligible units than its own whole window holds. */
  'MATCHED_RESULT_EXCEEDS_WHOLE',
  /**
   * The matched set is more than one contiguous stretch. A single matched-subwindow result cannot
   * honestly represent recomputation over disjoint stretches of the period; bridging them would
   * fabricate arithmetic across the gap. A later card may extend this to segment-wise results.
   */
  'MATCHED_SET_NONCONTIGUOUS',
  /**
   * A matched-subwindow result's own window is not the single matched segment it must cover. A
   * whole-window or wrong-span result must never masquerade as matched-only arithmetic.
   */
  'MATCHED_WINDOW_MISMATCH',
  /** The declared censoring treatment contradicts the censored counts actually reported. */
  'CENSORING_TREATMENT_CONTRADICTED',
  /** Two present values of different kinds (a count against a distribution) do not subtract. */
  'VALUE_KIND_MISMATCH',
] as const

/**
 * Value-level refusals — the windows ARE comparable, and their eligible/censored counts are a
 * real observation, but this particular VALUE does not subtract. Issue #67 lives here: an empty
 * eligible cohort compared against a populated one is a genuine count difference and a typed
 * absence of a duration delta, never a fabricated zero.
 */
export const VALUE_REFUSAL_REASONS = [
  /** Either side is below the metric's minimum support gate, so the delta is refused. */
  'SUPPORT_GATE_FAILED',
  /** One side observed zero eligible units: a null distribution does not subtract (#67). */
  'EMPTY_SIDE_NO_DISTRIBUTION',
  /** Both sides observed zero eligible units: both are observed zeros, with no distribution. */
  'BOTH_SIDES_EMPTY_COHORT',
  /** A proportion over an empty cohort has no denominator, on either side. */
  'PROPORTION_UNDEFINED_ON_EMPTY_COHORT',
  /** Every eligible unit on a side is censored, so that side has no outcome distribution. */
  'CENSORED_ONLY_SIDE',
  /** The declared censoring treatment compares counts only, by choice. */
  'COUNTS_ONLY_BY_DECLARED_TREATMENT',
  /** The two distributions report different quantile levels; there is no aligned pair. */
  'QUANTILE_SET_MISMATCH',
  /** A side carries a typed `no_value` for a reason that is not one of the cases above. */
  'NO_VALUE_SIDE',
] as const

/** One closed refusal registry; the two subsets above are disjoint and exhaustive over it. */
export const COMPARISON_REFUSAL_REASONS = [
  ...STRUCTURAL_REFUSAL_REASONS,
  ...VALUE_REFUSAL_REASONS,
] as const

export const StructuralRefusalReasonSchema = z.enum(STRUCTURAL_REFUSAL_REASONS)
export type StructuralRefusalReason = z.infer<typeof StructuralRefusalReasonSchema>
export const ValueRefusalReasonSchema = z.enum(VALUE_REFUSAL_REASONS)
export type ValueRefusalReason = z.infer<typeof ValueRefusalReasonSchema>
export type ComparisonRefusalReason = StructuralRefusalReason | ValueRefusalReason

/**
 * How censoring was treated in whatever arithmetic the result carries. There is deliberately no
 * "ignore censoring" member: a comparison either differences counts only, or differences a
 * distribution over uncensored units while declaring the censored tails it left out.
 */
export const COMPARISON_CENSORING_TREATMENTS = [
  /** Counts are differenced; no distribution is compared. Censored units stay inside the counts. */
  'counts_only_delta',
  /**
   * A distribution over the uncensored sample is differenced, and the censored counts on both
   * sides are reported beside it. The censored tails are NOT in the distribution and never
   * scored as an outcome.
   */
  'uncensored_sample_with_declared_tails',
  /** The metric declares censoring impossible; asserting it requires zero censored units. */
  'no_censoring_possible',
] as const
export const ComparisonCensoringTreatmentSchema = z.enum(COMPARISON_CENSORING_TREATMENTS)
export type ComparisonCensoringTreatment = z.infer<typeof ComparisonCensoringTreatmentSchema>

const CENSORING_TREATMENT_STATEMENTS: Readonly<Record<ComparisonCensoringTreatment, string>> = {
  counts_only_delta:
    'Counts are differenced. Right-censored units at each window boundary remain inside the eligible and censored counts on both sides and are never dropped from them.',
  uncensored_sample_with_declared_tails:
    'The distribution difference covers uncensored units only. Right-censored units at each window boundary stay in the counts, are excluded from both samples, and are never scored as an outcome.',
  no_censoring_possible:
    'The metric declares that no unit inside a completed window can be censored, and both sides report zero censored units, so no censored tail was excluded from the arithmetic.',
}

/**
 * Named limitations a comparison may carry. `MATCHED_SUBWINDOW_SELECTION_BIAS` is required on
 * every `MATCHED_PARTIAL` result and cannot be removed: the schema refuses the outcome without it.
 */
export const COMPARISON_LIMITATIONS = [
  'MATCHED_SUBWINDOW_SELECTION_BIAS',
  'CENSORED_TAILS_EXCLUDED',
  'UNEQUAL_CENSORING_BETWEEN_SIDES',
  'EMPTY_COHORT_SIDE',
] as const
export const ComparisonLimitationCodeSchema = z.enum(COMPARISON_LIMITATIONS)
export type ComparisonLimitationCode = z.infer<typeof ComparisonLimitationCodeSchema>

/** The limitation that ADR-07 requires beside every matched fraction. */
export const REQUIRED_MATCHED_PARTIAL_LIMITATION = 'MATCHED_SUBWINDOW_SELECTION_BIAS' as const

const LIMITATION_STATEMENTS: Readonly<Record<ComparisonLimitationCode, string>> = {
  MATCHED_SUBWINDOW_SELECTION_BIAS:
    'Matched subwindows are a non-random subsample of the period: coverage quality correlates with activity volume, so the matched difference may not represent the unmatched remainder.',
  CENSORED_TAILS_EXCLUDED:
    'Units still running at a window boundary are right-censored: they are counted, excluded from the compared distribution, and never scored as an outcome.',
  UNEQUAL_CENSORING_BETWEEN_SIDES:
    'The two sides were censored at different rates, so part of any distribution difference may reflect unequal follow-up rather than a difference in the system.',
  EMPTY_COHORT_SIDE:
    'At least one side observed zero eligible units under complete coverage: the count difference is real, and no distribution exists on that side to difference.',
}

/**
 * What disqualified an unmatched stretch of the period. Every kind names the coverage dimension
 * it degrades, which is how this contract feeds `comparability` (one of the twelve dimensions of
 * `shared/coverage.ts`) back to the reader.
 */
export const SUBWINDOW_MISMATCH_KINDS = [
  'NO_COUNTERPART',
  'SOURCE_CHANGED',
  'PARSER_MAJOR_CHANGED',
  'CONFIG_REVISION_CHANGED',
  'COMPARABILITY_BELOW_TOLERANCE',
] as const
export const SubwindowMismatchKindSchema = z.enum(SUBWINDOW_MISMATCH_KINDS)
export type SubwindowMismatchKind = z.infer<typeof SubwindowMismatchKindSchema>

/**
 * Mismatch kind → the dimension it disqualifies, and the registered limiting reason that names
 * it where one exists. `SOURCE_CHANGED` and `COMPARABILITY_BELOW_TOLERANCE` have no dedicated
 * code in the v2 registry, so they name the dimension and leave the reason null rather than
 * inventing an unregistered code.
 */
const MISMATCH_DISQUALIFICATION: Readonly<
  Record<SubwindowMismatchKind, { dimension: CoverageDimension; limitingReason: CoverageLimitingReason | null }>
> = {
  NO_COUNTERPART: { dimension: 'comparability', limitingReason: 'NO_SNAPSHOT_PAIR' },
  SOURCE_CHANGED: { dimension: 'comparability', limitingReason: null },
  PARSER_MAJOR_CHANGED: { dimension: 'comparability', limitingReason: 'PARSER_MAJOR_CHANGED' },
  CONFIG_REVISION_CHANGED: { dimension: 'comparability', limitingReason: 'CONFIG_REVISION_CHANGED' },
  COMPARABILITY_BELOW_TOLERANCE: { dimension: 'comparability', limitingReason: null },
}

/* ------------------------------------------------------------------------------------------ *
 * Input contract
 * ------------------------------------------------------------------------------------------ */

/**
 * The instrument that produced a stretch of a window. ADR-07 keys comparability to equal parser
 * major and equal config revision; the source is added because the same period observed through
 * two different connectors is not the same measurement either.
 */
export const InstrumentSchema = z
  .object({
    sourceId: IdentifierSchema,
    parserMajor: NonnegativeIntegerSchema,
    configRevision: z.string().min(1),
  })
  .strict()
export type Instrument = z.infer<typeof InstrumentSchema>

/**
 * A stretch of one window observed under a single instrument, with the `comparability` reading
 * that applied to it. Subwindows on a side must not overlap and must lie inside their window;
 * gaps are legal and become unmatched residual.
 */
export const InstrumentSubwindowSchema = z
  .object({
    window: HalfOpenWindowSchema,
    instrument: InstrumentSchema,
    comparability: CoverageDimensionValueSchema,
  })
  .strict()
export type InstrumentSubwindow = z.infer<typeof InstrumentSubwindowSchema>

/**
 * One side of a comparison.
 *
 * `matchedResult` is the metric recomputed over the matched subwindows only. It is required for
 * `MATCHED_PARTIAL` and unused for `FULL` — which is exactly the point: matched-partial numbers
 * cannot be manufactured by rescaling whole-window numbers, so the caller has to have actually
 * recomputed them.
 */
export const ComparisonSideSchema = z
  .object({
    result: MetricResultSchema,
    subwindows: z.array(InstrumentSubwindowSchema),
    matchedResult: MetricResultSchema.nullable(),
  })
  .strict()
export type ComparisonSide = z.infer<typeof ComparisonSideSchema>

/**
 * The comparison specification. Everything the comparison depends on is here and explicit: the
 * canonical injected `asOf`, both windows, the metric binding, the cohort, and the preregistered
 * tolerances. Nothing is defaulted, and nothing is read from the environment.
 */
export const ComparisonSpecSchema = z
  .object({
    comparisonId: z.string().min(1),
    /** ADR-26: the one canonical injected `asOf`. Both sides must have been computed at it. */
    asOf: UtcInstantSchema,
    currentWindow: HalfOpenWindowSchema,
    baselineWindow: HalfOpenWindowSchema,
    /** `metric_id@version`, matched across both sides. A version difference is a mismatch. */
    metric: z.object({ metricId: IdentifierSchema, version: VersionSchema }).strict(),
    /** The explicit cohort choice. Binding it to the metric definition is the registry's job. */
    cohortId: IdentifierSchema,
    scopeAlias: z.string().min(1),
    censoringTreatment: ComparisonCensoringTreatmentSchema,
    /** The metric definition's preregistered `comparisonRequirements.minimumMatchedFraction`. */
    minimumMatchedFraction: UnitIntervalSchema,
    /** Preregistered coverage tolerance for calling a subwindow pair instrument-matched. */
    comparabilityTolerance: UnitIntervalSchema,
    /** The metric definition's `supportGates.minimumEligible`, applied to distribution deltas. */
    minimumSupportUnits: NonnegativeIntegerSchema,
  })
  .strict()
  .superRefine((spec, context) => {
    const currentDuration = windowDurationMs(spec.currentWindow)
    const baselineDuration = windowDurationMs(spec.baselineWindow)
    if (currentDuration !== baselineDuration) {
      context.addIssue({
        code: 'custom',
        message: `Matched windows have equal duration; the current window spans ${currentDuration}ms and the baseline ${baselineDuration}ms`,
        path: ['baselineWindow'],
      })
    }
    /**
     * Overlapping windows share units, so their difference would count the shared stretch on
     * both sides. A matched baseline precedes the current window and does not touch it.
     */
    if (epochMs(spec.baselineWindow.end) > epochMs(spec.currentWindow.start)) {
      context.addIssue({
        code: 'custom',
        message: 'The baseline window must end at or before the current window starts; overlapping windows share units',
        path: ['baselineWindow', 'end'],
      })
    }
  })
export type ComparisonSpec = z.infer<typeof ComparisonSpecSchema>

export const ComparisonInputSchema = z
  .object({
    spec: ComparisonSpecSchema,
    current: ComparisonSideSchema,
    baseline: ComparisonSideSchema,
  })
  .strict()
export type ComparisonInput = z.infer<typeof ComparisonInputSchema>

/* ------------------------------------------------------------------------------------------ *
 * Output contract
 * ------------------------------------------------------------------------------------------ */

const SideCountsSchema = z
  .object({ eligible: NonnegativeIntegerSchema, censored: NonnegativeIntegerSchema })
  .strict()

/**
 * The count comparison, present on every comparable outcome.
 *
 * Issue #67: this is what makes an empty cohort a first-class comparison input. Zero eligible
 * units against forty is a real, reportable difference of forty — it is the DURATION comparison
 * that has no value, not the count one.
 *
 * Issue #82 (M-b): censored units are inside `eligible` and are additionally reported in
 * `censored`, so a reader can see how much of each side is still open.
 */
const CountsComparisonSchema = z
  .object({
    current: SideCountsSchema,
    baseline: SideCountsSchema,
    eligibleDelta: z.number().int(),
    censoredDelta: z.number().int(),
  })
  .strict()
  .superRefine((counts, context) => {
    if (counts.eligibleDelta !== counts.current.eligible - counts.baseline.eligible) {
      context.addIssue({ code: 'custom', message: 'eligibleDelta must equal current minus baseline', path: ['eligibleDelta'] })
    }
    if (counts.censoredDelta !== counts.current.censored - counts.baseline.censored) {
      context.addIssue({ code: 'custom', message: 'censoredDelta must equal current minus baseline', path: ['censoredDelta'] })
    }
  })
export type CountsComparison = z.infer<typeof CountsComparisonSchema>

const PROPORTION_DELTA_TOLERANCE = 1e-9

const QuantileDeltaSchema = z
  .object({
    quantile: z.number().gt(0).lt(1),
    current: z.number().nonnegative(),
    baseline: z.number().nonnegative(),
    delta: z.number(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.delta !== entry.current - entry.baseline) {
      context.addIssue({ code: 'custom', message: 'A quantile delta must equal current minus baseline', path: ['delta'] })
    }
  })

/**
 * The compared value — a closed discriminated union.
 *
 * `no_value` is a first-class member, not an error path: it is how "these windows are comparable,
 * and this particular number is not" is said out loud. It always names a closed reason.
 */
export const ComparisonValueSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('count_delta'),
      current: NonnegativeIntegerSchema,
      baseline: NonnegativeIntegerSchema,
      delta: z.number().int(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.delta !== value.current - value.baseline) {
        context.addIssue({ code: 'custom', message: 'A count delta must equal current minus baseline', path: ['delta'] })
      }
    }),
  z
    .object({
      kind: z.literal('proportion_delta'),
      current: z.object({ numerator: NonnegativeIntegerSchema, denominator: z.number().int().positive() }).strict(),
      baseline: z.object({ numerator: NonnegativeIntegerSchema, denominator: z.number().int().positive() }).strict(),
      /** Difference of the two proportions, in proportion points (not a ratio of ratios). */
      deltaProportion: z.number(),
    })
    .strict()
    .superRefine((value, context) => {
      const expected = value.current.numerator / value.current.denominator - value.baseline.numerator / value.baseline.denominator
      if (Math.abs(value.deltaProportion - expected) > PROPORTION_DELTA_TOLERANCE) {
        context.addIssue({ code: 'custom', message: 'deltaProportion must equal the current share minus the baseline share', path: ['deltaProportion'] })
      }
    }),
  z
    .object({
      kind: z.literal('quantile_delta'),
      /** Both sample sizes are mandatory: a quantile difference is unreadable without them. */
      currentSampleSize: NonnegativeIntegerSchema,
      baselineSampleSize: NonnegativeIntegerSchema,
      quantiles: z.array(QuantileDeltaSchema).min(1),
    })
    .strict()
    .superRefine((value, context) => {
      const levels = value.quantiles.map((entry) => entry.quantile)
      if (new Set(levels).size !== levels.length) {
        context.addIssue({ code: 'custom', message: 'Compared quantile levels must be distinct', path: ['quantiles'] })
      }
      if (value.currentSampleSize === 0 || value.baselineSampleSize === 0) {
        context.addIssue({
          code: 'custom',
          message: 'A quantile delta requires a non-empty sample on both sides; an empty side has no distribution to subtract',
          path: ['quantiles'],
        })
      }
    }),
  z.object({ kind: z.literal('no_value'), reasonCode: ValueRefusalReasonSchema }).strict(),
])
export type ComparisonValue = z.infer<typeof ComparisonValueSchema>

/** Every comparable outcome states, in the result itself, how censoring was treated. */
const CensoringDeclarationSchema = z
  .object({
    treatment: ComparisonCensoringTreatmentSchema,
    currentCensored: NonnegativeIntegerSchema,
    baselineCensored: NonnegativeIntegerSchema,
    statement: StatementSchema,
  })
  .strict()
export type CensoringDeclaration = z.infer<typeof CensoringDeclarationSchema>

const LimitationSchema = z
  .object({ code: ComparisonLimitationCodeSchema, statement: StatementSchema })
  .strict()
export type ComparisonLimitation = z.infer<typeof LimitationSchema>

/**
 * An unmatched stretch of the period, expressed as an offset range from the window start so it
 * describes both windows at once. ADR-07: the residual names its disqualifying dimension.
 */
const ResidualSegmentSchema = z
  .object({
    startOffsetMs: NonnegativeIntegerSchema,
    endOffsetMs: NonnegativeIntegerSchema,
    mismatchKind: SubwindowMismatchKindSchema,
    disqualifyingDimension: CoverageDimensionSchema,
    limitingReason: CoverageLimitingReasonSchema.nullable(),
  })
  .strict()
  .superRefine((segment, context) => {
    if (segment.startOffsetMs >= segment.endOffsetMs) {
      context.addIssue({ code: 'custom', message: 'A residual segment is half-open and increasing', path: ['endOffsetMs'] })
    }
    if (segment.limitingReason !== null && !isLimitingReasonRegistered(segment.disqualifyingDimension, segment.limitingReason)) {
      context.addIssue({
        code: 'custom',
        message: `Limiting reason ${segment.limitingReason} is not registered for the ${segment.disqualifyingDimension} dimension`,
        path: ['limitingReason'],
      })
    }
  })
export type ResidualSegment = z.infer<typeof ResidualSegmentSchema>

const ComparisonIdentitySchema = {
  comparisonId: z.string().min(1),
  contractVersion: z.literal(COMPARISON_CONTRACT_VERSION),
  asOf: UtcInstantSchema,
  metric: z.object({ metricId: IdentifierSchema, version: VersionSchema }).strict(),
  cohortId: IdentifierSchema,
  scopeAlias: z.string().min(1),
  currentWindow: HalfOpenWindowSchema,
  baselineWindow: HalfOpenWindowSchema,
}

const FullComparisonSchema = z
  .object({
    ...ComparisonIdentitySchema,
    outcome: z.literal('FULL'),
    /** FULL is exactly total coverage of the period by matching instruments. */
    matchedFraction: z.literal(1),
    arithmeticBasis: z.literal('whole_window'),
    counts: CountsComparisonSchema,
    value: ComparisonValueSchema,
    censoring: CensoringDeclarationSchema,
    limitations: z.array(LimitationSchema),
    /** Nothing is unmatched, so there is no residual to name. */
    residual: z.array(ResidualSegmentSchema).max(0),
  })
  .strict()

const MatchedPartialComparisonSchema = z
  .object({
    ...ComparisonIdentitySchema,
    outcome: z.literal('MATCHED_PARTIAL'),
    matchedFraction: z.number().gt(0).lt(1),
    /**
     * The naive whole-window diff is not merely un-rendered here: it is never computed. Every
     * number on this outcome comes from the matched-subwindow results.
     */
    arithmeticBasis: z.literal('matched_subwindows_only'),
    counts: CountsComparisonSchema,
    value: ComparisonValueSchema,
    censoring: CensoringDeclarationSchema,
    limitations: z.array(LimitationSchema).min(1),
    residual: z.array(ResidualSegmentSchema).min(1),
  })
  .strict()
  .superRefine((comparison, context) => {
    if (!comparison.limitations.some((entry) => entry.code === REQUIRED_MATCHED_PARTIAL_LIMITATION)) {
      context.addIssue({
        code: 'custom',
        message: `A matched-partial comparison always carries the ${REQUIRED_MATCHED_PARTIAL_LIMITATION} limitation; it cannot be removed`,
        path: ['limitations'],
      })
    }
  })

/**
 * The refusal. It is `.strict()` and declares no `counts`, `value`, or `censoring` key, so a
 * failed comparison has no representable delta — zero or otherwise.
 */
const IncomparableComparisonSchema = z
  .object({
    ...ComparisonIdentitySchema,
    outcome: z.literal('INCOMPARABLE'),
    /** Null when the refusal was decided before instrument matching ran. */
    matchedFraction: UnitIntervalSchema.nullable(),
    reasonCode: StructuralRefusalReasonSchema,
    detail: z.string().min(1),
    residual: z.array(ResidualSegmentSchema),
  })
  .strict()

export const ComparisonResultSchema = z.discriminatedUnion('outcome', [
  FullComparisonSchema,
  MatchedPartialComparisonSchema,
  IncomparableComparisonSchema,
])
export type ComparisonResult = z.infer<typeof ComparisonResultSchema>
export type FullComparison = z.infer<typeof FullComparisonSchema>
export type MatchedPartialComparison = z.infer<typeof MatchedPartialComparisonSchema>
export type IncomparableComparison = z.infer<typeof IncomparableComparisonSchema>

/** Narrowing helper: true exactly when the outcome carries arithmetic. */
export function isComparable(
  comparison: ComparisonResult,
): comparison is FullComparison | MatchedPartialComparison {
  return comparison.outcome !== 'INCOMPARABLE'
}

/* ------------------------------------------------------------------------------------------ *
 * Instrument matching
 * ------------------------------------------------------------------------------------------ */

/**
 * A maximal contiguous stretch that matched on both sides, as an offset range from each window's
 * own start. The complement of `residual` within `[0, durationMs)`. A `FULL` match is the single
 * segment `[0, durationMs)`; a valid `MATCHED_PARTIAL` is exactly one interior segment.
 */
export interface MatchedSegment {
  readonly startOffsetMs: number
  readonly endOffsetMs: number
}

export interface SubwindowMatching {
  /** Matched milliseconds over window duration, in [0, 1]. A first-class reported number. */
  readonly matchedFraction: number
  readonly matchedMs: number
  readonly durationMs: number
  readonly residual: readonly ResidualSegment[]
  /** The matched stretches, merged and adjacent-collapsed. One honest MATCHED_PARTIAL segment. */
  readonly matchedSegments: readonly MatchedSegment[]
}

interface OffsetSubwindow {
  readonly startOffsetMs: number
  readonly endOffsetMs: number
  readonly subwindow: InstrumentSubwindow
}

/** Non-overlapping, inside its parent, strictly increasing. Anything else is not a partition. */
function toOffsetSubwindows(
  window: HalfOpenWindow,
  subwindows: readonly InstrumentSubwindow[],
): OffsetSubwindow[] | null {
  const windowStart = epochMs(window.start)
  const windowEnd = epochMs(window.end)
  const offsets = subwindows.map((subwindow) => ({
    startOffsetMs: epochMs(subwindow.window.start) - windowStart,
    endOffsetMs: epochMs(subwindow.window.end) - windowStart,
    subwindow,
  }))
  for (const offset of offsets) {
    if (offset.startOffsetMs < 0 || epochMs(offset.subwindow.window.end) > windowEnd) {
      return null
    }
  }
  const sorted = [...offsets].sort((left, right) => left.startOffsetMs - right.startOffsetMs)
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].startOffsetMs < sorted[index - 1].endOffsetMs) {
      return null
    }
  }
  return sorted
}

function coveringSubwindow(offsets: readonly OffsetSubwindow[], startOffsetMs: number): OffsetSubwindow | null {
  for (const offset of offsets) {
    if (startOffsetMs >= offset.startOffsetMs && startOffsetMs < offset.endOffsetMs) {
      return offset
    }
  }
  return null
}

/**
 * A subwindow's own comparability limiting reason, passed through only when it is registered for
 * the `comparability` dimension. A null, or any code the registry does not carry for comparability,
 * yields null rather than an invented or cross-dimension code — the same rule
 * `MISMATCH_DISQUALIFICATION` applies to the codeless kinds: the residual names the dimension and
 * leaves the reason null. This keeps every emitted `ResidualSegment.limitingReason` one that
 * `ResidualSegmentSchema` accepts for `comparability`, so the result parses on the way out.
 */
function comparabilityReason(reason: CoverageLimitingReason | null): CoverageLimitingReason | null {
  return reason !== null && isLimitingReasonRegistered('comparability', reason) ? reason : null
}

/**
 * Classify one elementary segment. Precedence is fixed and documented so the residual reason is
 * deterministic: a missing counterpart outranks a source change, which outranks a parser-major
 * change, which outranks a config-revision change, which outranks a coverage shortfall.
 */
function classifySegment(
  current: OffsetSubwindow | null,
  baseline: OffsetSubwindow | null,
  comparabilityTolerance: number,
): { matched: true } | { matched: false; kind: SubwindowMismatchKind; limitingReason: CoverageLimitingReason | null } {
  if (!current || !baseline) {
    return { matched: false, kind: 'NO_COUNTERPART', limitingReason: MISMATCH_DISQUALIFICATION.NO_COUNTERPART.limitingReason }
  }
  const left = current.subwindow.instrument
  const right = baseline.subwindow.instrument
  if (left.sourceId !== right.sourceId) {
    return { matched: false, kind: 'SOURCE_CHANGED', limitingReason: null }
  }
  if (left.parserMajor !== right.parserMajor) {
    return { matched: false, kind: 'PARSER_MAJOR_CHANGED', limitingReason: MISMATCH_DISQUALIFICATION.PARSER_MAJOR_CHANGED.limitingReason }
  }
  if (left.configRevision !== right.configRevision) {
    return { matched: false, kind: 'CONFIG_REVISION_CHANGED', limitingReason: MISMATCH_DISQUALIFICATION.CONFIG_REVISION_CHANGED.limitingReason }
  }
  const currentComparability = current.subwindow.comparability
  const baselineComparability = baseline.subwindow.comparability
  const currentValue = currentComparability.value
  const baselineValue = baselineComparability.value
  if (currentValue === null || currentValue < comparabilityTolerance) {
    return { matched: false, kind: 'COMPARABILITY_BELOW_TOLERANCE', limitingReason: comparabilityReason(currentComparability.limiting_reason) }
  }
  if (baselineValue === null || baselineValue < comparabilityTolerance) {
    return { matched: false, kind: 'COMPARABILITY_BELOW_TOLERANCE', limitingReason: comparabilityReason(baselineComparability.limiting_reason) }
  }
  return { matched: true }
}

/**
 * Match the two sides subwindow by subwindow, on aligned offsets from each window's own start.
 * The windows have equal duration (schema-enforced), so an offset names the same relative
 * position in both, and only stretches instrumented the same way on both sides enter arithmetic.
 *
 * Adjacent segments with the same classification are merged, so the residual reads as intervals
 * rather than as an artefact of where the two partitions happened to have boundaries.
 */
export function matchInstrumentSubwindows(
  spec: ComparisonSpec,
  current: readonly InstrumentSubwindow[],
  baseline: readonly InstrumentSubwindow[],
): SubwindowMatching | null {
  const durationMs = windowDurationMs(spec.currentWindow)
  const currentOffsets = toOffsetSubwindows(spec.currentWindow, current)
  const baselineOffsets = toOffsetSubwindows(spec.baselineWindow, baseline)
  if (!currentOffsets || !baselineOffsets) {
    return null
  }

  const boundaries = new Set<number>([0, durationMs])
  for (const offset of [...currentOffsets, ...baselineOffsets]) {
    if (offset.startOffsetMs > 0 && offset.startOffsetMs < durationMs) {
      boundaries.add(offset.startOffsetMs)
    }
    if (offset.endOffsetMs > 0 && offset.endOffsetMs < durationMs) {
      boundaries.add(offset.endOffsetMs)
    }
  }
  const ordered = [...boundaries].sort((left, right) => left - right)

  let matchedMs = 0
  const residual: ResidualSegment[] = []
  const matchedSegments: MatchedSegment[] = []
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const startOffsetMs = ordered[index]
    const endOffsetMs = ordered[index + 1]
    const classification = classifySegment(
      coveringSubwindow(currentOffsets, startOffsetMs),
      coveringSubwindow(baselineOffsets, startOffsetMs),
      spec.comparabilityTolerance,
    )
    if (classification.matched) {
      matchedMs += endOffsetMs - startOffsetMs
      const previousMatched = matchedSegments[matchedSegments.length - 1]
      if (previousMatched && previousMatched.endOffsetMs === startOffsetMs) {
        matchedSegments[matchedSegments.length - 1] = { startOffsetMs: previousMatched.startOffsetMs, endOffsetMs }
      } else {
        matchedSegments.push({ startOffsetMs, endOffsetMs })
      }
      continue
    }
    const previous = residual[residual.length - 1]
    if (
      previous &&
      previous.endOffsetMs === startOffsetMs &&
      previous.mismatchKind === classification.kind &&
      previous.limitingReason === classification.limitingReason
    ) {
      residual[residual.length - 1] = { ...previous, endOffsetMs }
      continue
    }
    residual.push({
      startOffsetMs,
      endOffsetMs,
      mismatchKind: classification.kind,
      disqualifyingDimension: MISMATCH_DISQUALIFICATION[classification.kind].dimension,
      limitingReason: classification.limitingReason,
    })
  }

  return { matchedFraction: matchedMs / durationMs, matchedMs, durationMs, residual, matchedSegments }
}

/* ------------------------------------------------------------------------------------------ *
 * Value comparison
 * ------------------------------------------------------------------------------------------ */

/**
 * The number a support gate must gate, per value kind.
 *
 * This mirrors the `supportUnits` function of `shared/metrics.ts`, which is module-private there
 * and so cannot be imported. `shared/comparison.test.ts` pins the two together by cross-checking
 * this function against the exported `evaluateDisplayEligibility`, so a change on the metrics
 * side fails loudly here instead of drifting silently.
 */
export function comparisonSupportUnits(result: MetricResult): number | null {
  switch (result.value.kind) {
    case 'quantiles':
      return result.value.sampleSize
    case 'proportion':
      return result.value.denominator
    case 'count':
      return result.counts.eligible
    case 'no_value':
      return null
  }
}

function isEmptyCohort(result: MetricResult): boolean {
  return result.state === 'empty_eligible_cohort'
}

/** The concrete value kind a metric produces — the value-kind universe minus the typed absence. */
type EmptyCohortValueClass = Exclude<MetricValue['kind'], 'no_value'>

/**
 * Formula kind → the concrete value kind it produces. Mirrors metrics.ts's module-private
 * `VALUE_KINDS_BY_FORMULA` (event_count/distinct_count → count, proportion_of_cohort → proportion,
 * duration_quantiles/inter_event_interval_quantiles → quantiles), the same way
 * `comparisonSupportUnits` mirrors its private `supportUnits`. Keying on `MetricFormula['kind']`
 * makes it total: a formula kind added on the metrics side fails this map to compile rather than
 * silently defaulting to a wrong class here.
 */
const FORMULA_VALUE_CLASS: Readonly<Record<MetricFormula['kind'], EmptyCohortValueClass>> = {
  event_count: 'count',
  distinct_count: 'count',
  proportion_of_cohort: 'proportion',
  duration_quantiles: 'quantiles',
  inter_event_interval_quantiles: 'quantiles',
}

/**
 * The value-kind class of an empty-cohort comparison.
 *
 * A concrete value on EITHER side is authoritative: both sides name one metric (binding is checked
 * before any value work), so an empty side encoded as `count(0)` or `quantiles(0, null)` reveals
 * its class exactly as a populated side does. Only when NEITHER side carries a concrete value —
 * both are `no_value`-encoded, whether an empty side under the `EMPTY_ELIGIBLE_COHORT` encoding or
 * a populated side that abstained — do we consult the registered formula, and only a registered
 * metric can decide it. Otherwise the class is genuinely undecidable (`null`), and the caller must
 * never reach for the proportion label it never established.
 */
function emptyCohortValueClass(
  spec: ComparisonSpec,
  current: MetricResult,
  baseline: MetricResult,
): EmptyCohortValueClass | null {
  for (const value of [current.value, baseline.value]) {
    if (value.kind !== 'no_value') {
      return value.kind
    }
  }
  const reference = formatMetricReference(spec.metric)
  return isRegisteredMetric(reference) ? FORMULA_VALUE_CLASS[getMetricDefinition(reference).formula.kind] : null
}

/**
 * Decide the compared value. Order matters and is deliberate: a declared counts-only treatment
 * wins over everything (the caller asked for counts only), then structural absences on a side,
 * then issue #67's empty-cohort cases, then the support gate, then the arithmetic.
 */
function compareValues(spec: ComparisonSpec, current: MetricResult, baseline: MetricResult): ComparisonValue {
  if (spec.censoringTreatment === 'counts_only_delta') {
    return { kind: 'no_value', reasonCode: 'COUNTS_ONLY_BY_DECLARED_TREATMENT' }
  }
  if (current.state === 'censored_only' || baseline.state === 'censored_only') {
    return { kind: 'no_value', reasonCode: 'CENSORED_ONLY_SIDE' }
  }

  const currentEmpty = isEmptyCohort(current)
  const baselineEmpty = isEmptyCohort(baseline)
  const currentValue = current.value
  const baselineValue = baseline.value

  /**
   * Issue #67. An empty eligible cohort is a complete observation of zero, classified by the
   * metric's value-kind CLASS rather than by whichever legal encoding a side happened to use. The
   * old branch keyed off `no_value` and mislabelled every non-count case as an undefined
   * proportion; because an empty count side is legally encodable as `no_value/EMPTY_ELIGIBLE_COHORT`
   * that both mistagged empty count and quantile sides AND swallowed real count deltas.
   */
  if (currentEmpty || baselineEmpty) {
    const bothEmpty = currentEmpty && baselineEmpty
    const valueClass = emptyCohortValueClass(spec, current, baseline)

    /**
     * Count class. An empty eligible cohort is a complete observation of zero for a counting
     * metric, so 0 against 40 is a real difference of forty. The empty side's entailed zero holds
     * under EITHER legal encoding of the empty_eligible_cohort state: metrics.ts's
     * `checkValueAgainstState` forces `observedCount === 0` for an empty count side ("An empty
     * eligible cohort counts an observed zero"), and the same state's
     * `{ kind: 'no_value', reasonCode: 'EMPTY_ELIGIBLE_COHORT' }` encoding stands for that same
     * observed zero. So each empty side contributes 0; only a populated side that itself abstained
     * (`no_value`) leaves nothing to subtract.
     */
    if (valueClass === 'count') {
      const currentCount = currentEmpty ? 0 : currentValue.kind === 'count' ? currentValue.observedCount : null
      const baselineCount = baselineEmpty ? 0 : baselineValue.kind === 'count' ? baselineValue.observedCount : null
      if (currentCount === null || baselineCount === null) {
        return { kind: 'no_value', reasonCode: 'NO_VALUE_SIDE' }
      }
      return { kind: 'count_delta', current: currentCount, baseline: baselineCount, delta: currentCount - baselineCount }
    }

    /** Proportion class, actually established: an empty cohort leaves it with no denominator. */
    if (valueClass === 'proportion') {
      return { kind: 'no_value', reasonCode: 'PROPORTION_UNDEFINED_ON_EMPTY_COHORT' }
    }

    /**
     * Undecidable class — the metric is unregistered and neither side carries a concrete value.
     * Report only what is true, never the proportion label that was never established: both empty
     * is two observed empty cohorts; one empty against a populated side that abstained (`no_value`)
     * is that abstention, and that is all we can honestly say.
     */
    if (valueClass === null) {
      return { kind: 'no_value', reasonCode: bothEmpty ? 'BOTH_SIDES_EMPTY_COHORT' : 'NO_VALUE_SIDE' }
    }

    /**
     * Quantile class. A null distribution has nothing to subtract, and fabricating a zero-duration
     * value is exactly the failure this contract exists to prevent.
     */
    return { kind: 'no_value', reasonCode: bothEmpty ? 'BOTH_SIDES_EMPTY_COHORT' : 'EMPTY_SIDE_NO_DISTRIBUTION' }
  }

  if (currentValue.kind === 'no_value' || baselineValue.kind === 'no_value') {
    return { kind: 'no_value', reasonCode: 'NO_VALUE_SIDE' }
  }

  if (currentValue.kind === 'count' && baselineValue.kind === 'count') {
    return {
      kind: 'count_delta',
      current: currentValue.observedCount,
      baseline: baselineValue.observedCount,
      delta: currentValue.observedCount - baselineValue.observedCount,
    }
  }

  if (currentValue.kind === 'proportion' && baselineValue.kind === 'proportion') {
    const currentSupport = comparisonSupportUnits(current)
    const baselineSupport = comparisonSupportUnits(baseline)
    if (
      currentSupport === null ||
      baselineSupport === null ||
      currentSupport < spec.minimumSupportUnits ||
      baselineSupport < spec.minimumSupportUnits
    ) {
      return { kind: 'no_value', reasonCode: 'SUPPORT_GATE_FAILED' }
    }
    return {
      kind: 'proportion_delta',
      current: { numerator: currentValue.numerator, denominator: currentValue.denominator },
      baseline: { numerator: baselineValue.numerator, denominator: baselineValue.denominator },
      deltaProportion:
        currentValue.numerator / currentValue.denominator - baselineValue.numerator / baselineValue.denominator,
    }
  }

  if (currentValue.kind === 'quantiles' && baselineValue.kind === 'quantiles') {
    const currentSupport = currentValue.sampleSize
    const baselineSupport = baselineValue.sampleSize
    if (currentSupport < spec.minimumSupportUnits || baselineSupport < spec.minimumSupportUnits) {
      return { kind: 'no_value', reasonCode: 'SUPPORT_GATE_FAILED' }
    }
    if (!currentValue.quantiles || !baselineValue.quantiles) {
      return { kind: 'no_value', reasonCode: 'EMPTY_SIDE_NO_DISTRIBUTION' }
    }
    const baselineByLevel = new Map(baselineValue.quantiles.map((entry) => [entry.quantile, entry.value]))
    if (
      baselineByLevel.size !== currentValue.quantiles.length ||
      currentValue.quantiles.some((entry) => !baselineByLevel.has(entry.quantile))
    ) {
      return { kind: 'no_value', reasonCode: 'QUANTILE_SET_MISMATCH' }
    }
    return {
      kind: 'quantile_delta',
      currentSampleSize: currentSupport,
      baselineSampleSize: baselineSupport,
      quantiles: currentValue.quantiles.map((entry) => {
        const baselineAtLevel = baselineByLevel.get(entry.quantile) as number
        return {
          quantile: entry.quantile,
          current: entry.value,
          baseline: baselineAtLevel,
          delta: entry.value - baselineAtLevel,
        }
      }),
    }
  }

  /** Unreachable: mismatched present kinds are refused structurally, before this runs. */
  return { kind: 'no_value', reasonCode: 'NO_VALUE_SIDE' }
}

function buildLimitations(
  spec: ComparisonSpec,
  outcome: ComparisonOutcome,
  current: MetricResult,
  baseline: MetricResult,
  value: ComparisonValue,
): ComparisonLimitation[] {
  const codes: ComparisonLimitationCode[] = []
  if (outcome === 'MATCHED_PARTIAL') {
    codes.push(REQUIRED_MATCHED_PARTIAL_LIMITATION)
  }
  if (spec.censoringTreatment === 'uncensored_sample_with_declared_tails' && (current.counts.censored > 0 || baseline.counts.censored > 0)) {
    codes.push('CENSORED_TAILS_EXCLUDED')
  }
  /**
   * Issue #82 (M-c): a censoring-rate gap between the sides biases a share difference the same way
   * it biases a distribution difference. A censorable proportion's denominator is
   * eligible_minus_censored (metrics.ts forces this), so both sides already exclude their censored
   * units — and if they exclude unequal fractions, part of the delta reflects unequal follow-up
   * rather than a real difference. `CENSORED_TAILS_EXCLUDED` already discloses that censoring
   * happened; this adds the rate-gap warning. A non-censorable proportion (denominatorBasis
   * 'eligible') is forced to no_censoring_possible, so both censored counts are zero and this never
   * fires spuriously.
   */
  if (value.kind === 'quantile_delta' || value.kind === 'proportion_delta') {
    const currentFraction = current.counts.eligible === 0 ? 0 : current.counts.censored / current.counts.eligible
    const baselineFraction = baseline.counts.eligible === 0 ? 0 : baseline.counts.censored / baseline.counts.eligible
    if (currentFraction !== baselineFraction) {
      codes.push('UNEQUAL_CENSORING_BETWEEN_SIDES')
    }
  }
  if (isEmptyCohort(current) || isEmptyCohort(baseline)) {
    codes.push('EMPTY_COHORT_SIDE')
  }
  return codes.map((code) => ({ code, statement: LIMITATION_STATEMENTS[code] }))
}

/* ------------------------------------------------------------------------------------------ *
 * The comparison
 * ------------------------------------------------------------------------------------------ */

const UNAVAILABLE_STATES = ['unavailable', 'coverage_failed'] as const

function sameInstant(left: string, right: string): boolean {
  return epochMs(left) === epochMs(right)
}

function sameWindow(left: HalfOpenWindow, right: HalfOpenWindow): boolean {
  return sameInstant(left.start, right.start) && sameInstant(left.end, right.end)
}

function comparabilityEntry(result: MetricResult): { value: number | null; limiting_reason: string | null } | null {
  const entry = result.coverage.find((candidate) => candidate.dimension === 'comparability')
  return entry ? { value: entry.value, limiting_reason: entry.limiting_reason } : null
}

/**
 * Compare a window against its matched baseline window.
 *
 * The input is parsed, never trusted, and the returned result is parsed again on the way out, so
 * every invariant this module documents is enforced on real data rather than only in tests.
 *
 * Refusal order is fixed and documented, because which reason a caller sees must be
 * deterministic: identity and binding first (metric, cohort, windows, `asOf`), then observability
 * of each whole-window side, then the comparability dimension, then subwindow structure and
 * matching, then the matched-subwindow inputs (the matched set's contiguity, and per matched side
 * its presence, binding, `asOf`, own observability, window geometry, and eligible bound), then the
 * declared censoring treatment checked against the effective arithmetic sides, then value shape.
 */
export function compareMatchedWindows(candidate: unknown): ComparisonResult {
  const parsed = ComparisonInputSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new ComparisonContractError(
      `Comparison input is invalid: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    )
  }
  const { spec, current, baseline } = parsed.data

  const identity = {
    comparisonId: spec.comparisonId,
    contractVersion: COMPARISON_CONTRACT_VERSION,
    asOf: spec.asOf,
    metric: spec.metric,
    cohortId: spec.cohortId,
    scopeAlias: spec.scopeAlias,
    currentWindow: spec.currentWindow,
    baselineWindow: spec.baselineWindow,
  }

  const refuse = (
    reasonCode: StructuralRefusalReason,
    detail: string,
    matchedFraction: number | null = null,
    residual: readonly ResidualSegment[] = [],
  ): ComparisonResult =>
    ComparisonResultSchema.parse({
      ...identity,
      outcome: 'INCOMPARABLE',
      matchedFraction,
      reasonCode,
      detail,
      residual: [...residual],
    })

  const sides = [
    { label: 'current', side: current, window: spec.currentWindow },
    { label: 'baseline', side: baseline, window: spec.baselineWindow },
  ] as const

  /** 1. Metric binding. A version difference is a different definition, never a coercion. */
  for (const { label, side } of sides) {
    if (side.result.metricId !== spec.metric.metricId || side.result.metricVersion !== spec.metric.version) {
      return refuse(
        'METRIC_MISMATCH',
        `The ${label} side reports ${side.result.metricId}@${side.result.metricVersion} but the comparison is bound to ${spec.metric.metricId}@${spec.metric.version}`,
      )
    }
  }

  /** 2. Cohort/scope binding. */
  for (const { label, side } of sides) {
    if (side.result.scopeAlias !== spec.scopeAlias) {
      return refuse(
        'COHORT_MISMATCH',
        `The ${label} side was computed over scope "${side.result.scopeAlias}" but the comparison is bound to "${spec.scopeAlias}"`,
      )
    }
  }

  /** 3. Window binding, then 4. the canonical injected asOf. */
  for (const { label, side, window } of sides) {
    if (!sameWindow(side.result.window, window)) {
      return refuse('WINDOW_BINDING_MISMATCH', `The ${label} side's result window is not the window the spec bound it to`)
    }
    if (!sameInstant(side.result.asOf, spec.asOf)) {
      return refuse(
        'AS_OF_MISMATCH',
        `The ${label} side was computed at ${side.result.asOf}, not at the canonical injected asOf ${spec.asOf}`,
      )
    }
  }

  /**
   * 5. Open tails. If `asOf` falls inside a compared window, that window's tail was never
   * observed, so the two sides cover unequal amounts of observed time even though their nominal
   * durations match. Rather than silently comparing a partial month against a whole one, the
   * comparison refuses and the caller re-specifies a shorter equal pair.
   */
  for (const { label, window } of sides) {
    if (epochMs(spec.asOf) < epochMs(window.end)) {
      return refuse(
        'WINDOW_OPEN_AT_AS_OF',
        `asOf ${spec.asOf} falls inside the ${label} window, whose tail is therefore unobserved; compare equal completed windows instead`,
      )
    }
  }

  /** 6. Observability of each side. Nothing here is a zero. */
  for (const { label, side } of sides) {
    if ((UNAVAILABLE_STATES as readonly string[]).includes(side.result.state)) {
      return refuse('UNAVAILABLE_SIDE', `The ${label} side is ${side.result.state}: there is no observation to compare, and no zero to report`)
    }
    if (side.result.state === 'truncated') {
      return refuse(
        'TRUNCATED_SIDE',
        `The ${label} side is truncated, so a difference against it would measure the instrument rather than the system`,
      )
    }
  }

  /**
   * 7. The `comparability` coverage dimension. This contract is that dimension's primary
   * consumer: a result that never measured comparability cannot support a matched claim, and a
   * result whose comparability is null or below the preregistered tolerance is refused outright.
   */
  for (const { label, side } of sides) {
    const entry = comparabilityEntry(side.result)
    if (!entry) {
      return refuse(
        'COMPARABILITY_DIMENSION_ABSENT',
        `The ${label} side declares no comparability coverage dimension, so no matched comparison is supportable`,
      )
    }
    if (entry.value === null) {
      return refuse(
        'COVERAGE_INCOMPARABLE',
        `The ${label} side's comparability dimension is unmeasurable (${entry.limiting_reason ?? 'no reason recorded'})`,
      )
    }
    if (entry.value < spec.comparabilityTolerance) {
      return refuse(
        'COVERAGE_INCOMPARABLE',
        `The ${label} side's comparability is ${entry.value}, below the preregistered tolerance ${spec.comparabilityTolerance}`,
      )
    }
  }

  /** 8. Subwindow structure, then 9. instrument matching. */
  const matching = matchInstrumentSubwindows(spec, current.subwindows, baseline.subwindows)
  if (!matching) {
    return refuse('SUBWINDOW_PARTITION_INVALID', 'Subwindows overlap, run backwards, or fall outside their own window')
  }
  if (matching.matchedMs === 0) {
    return refuse('NO_MATCHED_SUBWINDOW', 'No stretch of the period was instrumented the same way on both sides', 0, matching.residual)
  }
  if (matching.matchedFraction < spec.minimumMatchedFraction) {
    return refuse(
      'MATCHED_FRACTION_BELOW_MINIMUM',
      `The matched fraction ${matching.matchedFraction} is below the preregistered minimum ${spec.minimumMatchedFraction}`,
      matching.matchedFraction,
      matching.residual,
    )
  }

  const isFull = matching.matchedMs === matching.durationMs

  /**
   * 10. Matched-partial arithmetic runs on results recomputed over the matched subwindows only.
   * Without them there is no honest number to report, and rescaling the whole-window result would
   * be a fabrication, so the comparison refuses.
   */
  let effectiveCurrent = current.result
  let effectiveBaseline = baseline.result
  if (!isFull) {
    /**
     * A single matched-subwindow result can only stand for ONE contiguous matched stretch. A
     * matched set split into disjoint stretches has no honest single-window result: bridging the
     * gap would fabricate arithmetic across time that matched on neither side. (`matchedMs > 0`
     * here — the NO_MATCHED_SUBWINDOW gate above ran — so there is at least one segment.)
     */
    if (matching.matchedSegments.length !== 1) {
      return refuse(
        'MATCHED_SET_NONCONTIGUOUS',
        `The matched set spans ${matching.matchedSegments.length} disjoint stretches; one matched-subwindow result cannot honestly represent recomputation over them`,
        matching.matchedFraction,
        matching.residual,
      )
    }
    const matchedSegment = matching.matchedSegments[0]

    const matchedSides = [
      { label: 'current', whole: current.result, matched: current.matchedResult, window: spec.currentWindow },
      { label: 'baseline', whole: baseline.result, matched: baseline.matchedResult, window: spec.baselineWindow },
    ] as const
    for (const { label, whole, matched, window } of matchedSides) {
      if (!matched) {
        return refuse(
          'MATCHED_SUBWINDOW_RESULT_MISSING',
          `The ${label} side has no result recomputed over its matched subwindows, and a whole-window number must never stand in for one`,
          matching.matchedFraction,
          matching.residual,
        )
      }
      if (
        matched.metricId !== spec.metric.metricId ||
        matched.metricVersion !== spec.metric.version ||
        matched.scopeAlias !== spec.scopeAlias
      ) {
        return refuse(
          'METRIC_MISMATCH',
          `The ${label} side's matched-subwindow result is not bound to ${spec.metric.metricId}@${spec.metric.version} on scope "${spec.scopeAlias}"`,
          matching.matchedFraction,
          matching.residual,
        )
      }
      if (!sameInstant(matched.asOf, spec.asOf)) {
        return refuse(
          'AS_OF_MISMATCH',
          `The ${label} side's matched-subwindow result was computed at ${matched.asOf}, not at the canonical injected asOf`,
          matching.matchedFraction,
          matching.residual,
        )
      }
      /**
       * Observability of the matched side, checked exactly as step 6 checks the whole-window side.
       * A matched result that was never observed (`unavailable`/`coverage_failed`) or was cut off
       * by its instrument (`truncated`) is not a zero: substituting it would manufacture a
       * real-looking delta from a side no one measured. The whole-window path refused these states;
       * the matched path did not, so a censored/unavailable/truncated matched side could feed the
       * MATCHED_PARTIAL counts, value, and censoring untouched.
       */
      if ((UNAVAILABLE_STATES as readonly string[]).includes(matched.state)) {
        return refuse(
          'UNAVAILABLE_SIDE',
          `The ${label} side's matched-subwindow result is ${matched.state}: there is no observation to substitute, and no zero to report`,
          matching.matchedFraction,
          matching.residual,
        )
      }
      if (matched.state === 'truncated') {
        return refuse(
          'TRUNCATED_SIDE',
          `The ${label} side's matched-subwindow result is truncated, so a difference against it would measure the instrument rather than the system`,
          matching.matchedFraction,
          matching.residual,
        )
      }
      /**
       * The matched result must cover exactly the single matched segment, mapped into this side's
       * own window: a whole-window or wrong-span result must never masquerade as matched-only
       * arithmetic. Offsets are compared in epoch-ms (no clock read; `epochMs` is `Date.parse` of a
       * string), and the message is built from the window strings and offset numbers alone.
       */
      const expectedStartMs = epochMs(window.start) + matchedSegment.startOffsetMs
      const expectedEndMs = epochMs(window.start) + matchedSegment.endOffsetMs
      if (epochMs(matched.window.start) !== expectedStartMs || epochMs(matched.window.end) !== expectedEndMs) {
        return refuse(
          'MATCHED_WINDOW_MISMATCH',
          `The ${label} side's matched-subwindow result covers [${matched.window.start}, ${matched.window.end}) but the single matched segment is offset [${matchedSegment.startOffsetMs}, ${matchedSegment.endOffsetMs}) ms from the window start ${window.start}`,
          matching.matchedFraction,
          matching.residual,
        )
      }
      if (matched.counts.eligible > whole.counts.eligible) {
        return refuse(
          'MATCHED_RESULT_EXCEEDS_WHOLE',
          `The ${label} side's matched subwindows report ${matched.counts.eligible} eligible units, more than the ${whole.counts.eligible} of the whole window`,
          matching.matchedFraction,
          matching.residual,
        )
      }
    }
    effectiveCurrent = current.matchedResult as MetricResult
    effectiveBaseline = baseline.matchedResult as MetricResult
  }

  /**
   * 11. The declared censoring treatment must not contradict the counts of the sides the arithmetic
   * actually uses. Checking the EFFECTIVE sides covers both bases with one rule: for FULL they are
   * the whole-window results (coverage preserved), and for MATCHED_PARTIAL they are the matched
   * results substituted above. Without this, a censored matched side could ship beside the static
   * `no_censoring_possible` statement that both sides report zero censored — which its counts deny.
   */
  if (spec.censoringTreatment === 'no_censoring_possible') {
    for (const { label, result } of [
      { label: 'current', result: effectiveCurrent },
      { label: 'baseline', result: effectiveBaseline },
    ] as const) {
      if (result.counts.censored > 0) {
        return refuse(
          'CENSORING_TREATMENT_CONTRADICTED',
          `The comparison declares censoring impossible but the ${label} side reports ${result.counts.censored} censored units`,
          matching.matchedFraction,
          matching.residual,
        )
      }
    }
  }

  /** 12. Two present values of different kinds do not subtract. */
  if (
    effectiveCurrent.value.kind !== 'no_value' &&
    effectiveBaseline.value.kind !== 'no_value' &&
    effectiveCurrent.value.kind !== effectiveBaseline.value.kind
  ) {
    return refuse(
      'VALUE_KIND_MISMATCH',
      `The current side reports a ${effectiveCurrent.value.kind} value and the baseline a ${effectiveBaseline.value.kind}; they do not subtract`,
      matching.matchedFraction,
      matching.residual,
    )
  }

  const outcome: ComparisonOutcome = isFull ? 'FULL' : 'MATCHED_PARTIAL'
  const value = compareValues(spec, effectiveCurrent, effectiveBaseline)

  const counts: CountsComparison = {
    current: { eligible: effectiveCurrent.counts.eligible, censored: effectiveCurrent.counts.censored },
    baseline: { eligible: effectiveBaseline.counts.eligible, censored: effectiveBaseline.counts.censored },
    eligibleDelta: effectiveCurrent.counts.eligible - effectiveBaseline.counts.eligible,
    censoredDelta: effectiveCurrent.counts.censored - effectiveBaseline.counts.censored,
  }

  const censoring: CensoringDeclaration = {
    treatment: spec.censoringTreatment,
    currentCensored: effectiveCurrent.counts.censored,
    baselineCensored: effectiveBaseline.counts.censored,
    statement: CENSORING_TREATMENT_STATEMENTS[spec.censoringTreatment],
  }

  return ComparisonResultSchema.parse({
    ...identity,
    outcome,
    matchedFraction: isFull ? 1 : matching.matchedFraction,
    arithmeticBasis: isFull ? 'whole_window' : 'matched_subwindows_only',
    counts,
    value,
    censoring,
    limitations: buildLimitations(spec, outcome, effectiveCurrent, effectiveBaseline, value),
    residual: matching.residual,
  })
}

/* ------------------------------------------------------------------------------------------ *
 * Demo surface — the three-outcome table
 * ------------------------------------------------------------------------------------------ */

export interface ComparisonTableRow {
  readonly comparisonId: string
  readonly outcome: ComparisonOutcome
  readonly matchedFraction: number | null
  readonly eligible: string
  readonly value: string
  readonly censoring: string
  readonly limitations: readonly string[]
}

/** How a compared value reads in one line. A refusal reads as a reason, never as a number. */
function describeValue(value: ComparisonValue): string {
  switch (value.kind) {
    case 'count_delta':
      return `count ${value.baseline} → ${value.current} (delta ${value.delta})`
    case 'proportion_delta':
      return `share ${value.baseline.numerator}/${value.baseline.denominator} → ${value.current.numerator}/${value.current.denominator} (delta ${value.deltaProportion.toFixed(4)})`
    case 'quantile_delta':
      return `quantile deltas ${value.quantiles.map((entry) => `p${entry.quantile * 100}: ${entry.delta}`).join(', ')} (n ${value.baselineSampleSize} → ${value.currentSampleSize})`
    case 'no_value':
      return `no value: ${value.reasonCode}`
  }
}

/**
 * A presentation-ready row per comparison. `INCOMPARABLE` rows carry the reason in the value
 * column, so a table of comparisons cannot render a refusal as a dash that reads like zero.
 */
export function toComparisonTableRow(comparison: ComparisonResult): ComparisonTableRow {
  if (!isComparable(comparison)) {
    return {
      comparisonId: comparison.comparisonId,
      outcome: comparison.outcome,
      matchedFraction: comparison.matchedFraction,
      eligible: 'not compared',
      value: `no comparison: ${comparison.reasonCode}`,
      censoring: 'no arithmetic performed',
      limitations: [],
    }
  }
  return {
    comparisonId: comparison.comparisonId,
    outcome: comparison.outcome,
    matchedFraction: comparison.matchedFraction,
    eligible: `${comparison.counts.baseline.eligible} → ${comparison.counts.current.eligible} (delta ${comparison.counts.eligibleDelta})`,
    value: describeValue(comparison.value),
    censoring: `${comparison.censoring.treatment}; censored ${comparison.censoring.baselineCensored} → ${comparison.censoring.currentCensored}`,
    limitations: comparison.limitations.map((entry) => entry.code),
  }
}
