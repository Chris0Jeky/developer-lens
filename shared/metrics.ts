import { z } from 'zod'
import { CapabilityIdSchema } from './capabilities.js'

/**
 * ADR-25 — versioned metric-definition registry (analytical core).
 *
 * Registry entries are data: this module holds a typed structure, its validation, and its
 * lookups. There is deliberately no I/O, no network, no clock read, and no capability
 * activation anywhere in it. Definitions are C1 (aggregate, non-identifying) by contract.
 *
 * The registry answers, for every analytic number the product may expose: what exactly was
 * measured, on which cohort, under which assumptions — and what must never be inferred from it.
 */
export const METRIC_CONTRACT_VERSION = '1.0.0' as const

/** Registry entries carry no identifying content; the whole module is a C1 definition surface. */
export const METRIC_DEFINITION_DATA_CLASS = 'C1' as const

export class MetricRegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MetricRegistryError'
  }
}

const CodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]*$/)
const IdentifierSchema = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/)
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/)
const StatementSchema = z.string().min(12)
const UtcTimestampSchema = z.string().datetime({ offset: true })
const NonnegativeIntegerSchema = z.number().int().nonnegative()
const UnitIntervalSchema = z.number().min(0).max(1)

/**
 * Blended-construct terms. ADR-25 forbids any metric that leans on an undocumented shared
 * "engagement/importance/activity/health/maturity/confidence" scalar, and the product boundary
 * forbids person scoring outright. These lists back the explicit forbidden-construct validation
 * that runs alongside the closed enums below.
 */
export const FORBIDDEN_CONSTRUCT_TERMS = [
  'engagement',
  'importance',
  'activity',
  'health',
  'maturity',
  'confidence',
  'productivity',
  'performance',
  'wellbeing',
  'leaderboard',
  'ranking',
  'score',
  'rating',
  'grade',
  'effectiveness',
  'efficiency',
  'impact',
] as const

/** Person-scoring terms. No analytical subject, cohort, or metric id may name a human. */
export const FORBIDDEN_PERSON_SUBJECT_TERMS = [
  'person',
  'people',
  'individual',
  'contributor',
  'developer',
  'author',
  'committer',
  'reviewer',
  'employee',
  'engineer',
  'teammate',
  'team_member',
  'username',
  'user_login',
  'headcount',
  'seniority',
] as const

/**
 * Returns the first forbidden term contained in `value`, or null.
 *
 * Deliberately NOT applied to `prohibitedInterpretations`, `limitations`, or confounder
 * statements: those fields exist precisely so an author can write "this is not an engagement
 * signal", and scanning them would make the required warning impossible to express.
 */
export function findForbiddenConstructTerm(value: string): string | null {
  const haystack = value.toLowerCase()
  for (const term of [...FORBIDDEN_CONSTRUCT_TERMS, ...FORBIDDEN_PERSON_SUBJECT_TERMS]) {
    if (haystack.includes(term)) {
      return term
    }
  }
  return null
}

/**
 * Analytical subject — closed. Every member is a system-level cohort or window. There is no
 * person, contributor, author, or team member, so a person metric is not expressible.
 */
export const METRIC_ANALYTICAL_SUBJECTS = [
  'repository_window',
  'pull_request_cohort',
  'check_run_cohort',
  'issue_cohort',
  'release_cohort',
  'commit_series',
  'dependency_update_cohort',
  'module_graph',
] as const
export const MetricAnalyticalSubjectSchema = z.enum(METRIC_ANALYTICAL_SUBJECTS)
export type MetricAnalyticalSubject = z.infer<typeof MetricAnalyticalSubjectSchema>

/** Unit — closed. No `score`, `index`, `points`, or `rating` member exists. */
export const METRIC_UNITS = [
  'event_count',
  'count_of_distinct',
  'events_per_day',
  'seconds',
  'days',
  'proportion',
] as const
export const MetricUnitSchema = z.enum(METRIC_UNITS)
export type MetricUnit = z.infer<typeof MetricUnitSchema>

/** Semantic category — closed. No engagement/health/maturity/activity/importance member exists. */
export const METRIC_SEMANTIC_CATEGORIES = [
  'event_count',
  'lifecycle_duration',
  'inter_event_interval',
  'proportion_of_cohort',
  'dispersion',
  'topology_statistic',
] as const
export const MetricSemanticCategorySchema = z.enum(METRIC_SEMANTIC_CATEGORIES)
export type MetricSemanticCategory = z.infer<typeof MetricSemanticCategorySchema>

export const METRIC_WINDOW_SEMANTICS = [
  'half_open_utc_window',
  'matched_half_open_windows',
  'as_of_snapshot',
] as const
export const MetricWindowSemanticsSchema = z.enum(METRIC_WINDOW_SEMANTICS)
export type MetricWindowSemantics = z.infer<typeof MetricWindowSemanticsSchema>

/** ADR-26: pure analysis functions never read the system clock. `asOf` is always injected. */
export const METRIC_CLOCK_SOURCES = ['injected_as_of'] as const
export const MetricClockSourceSchema = z.enum(METRIC_CLOCK_SOURCES)

/**
 * ADR-02's twelve coverage dimensions, referenced by NAME.
 *
 * DL-SPINE-04 is extending `shared/coverage.ts` into a versioned v2 dimension registry in a
 * parallel lane. This module therefore keeps a local string enum of the same twelve names
 * instead of importing new v2 symbols, so the two changes do not collide. When the v2 registry
 * lands, this constant becomes an alias of it.
 */
export const METRIC_COVERAGE_DIMENSIONS = [
  'permission',
  'completeness',
  'eligibility',
  'freshness',
  'censoring_freedom',
  'consistency',
  'sample',
  'source_diversity',
  'parser_coverage',
  'comparability',
  'drift_stability',
  'calibration',
] as const
export const MetricCoverageDimensionSchema = z.enum(METRIC_COVERAGE_DIMENSIONS)
export type MetricCoverageDimension = z.infer<typeof MetricCoverageDimensionSchema>

/** ADR-02: every dimension is registered `higher_is_better`; polarity is never guessed. */
export const METRIC_COVERAGE_DIMENSION_DIRECTION = 'higher_is_better' as const

/** Missingness — closed. There is no imputation or zero-fill member. */
export const METRIC_MISSINGNESS_POLICIES = [
  'exclude_from_eligible_cohort',
  'retain_as_unknown_and_report',
  'abstain_metric',
] as const
export const MetricMissingnessPolicySchema = z.enum(METRIC_MISSINGNESS_POLICIES)

/** Truncation — closed. There is no "assume complete" member. */
export const METRIC_TRUNCATION_POLICIES = [
  'abstain_when_truncated',
  'report_with_truncation_limitation',
] as const
export const MetricTruncationPolicySchema = z.enum(METRIC_TRUNCATION_POLICIES)

export const METRIC_CENSORING_RULES = [
  'no_censoring_possible',
  'right_censor_at_window_end',
  'left_and_right_censor_at_window_bounds',
] as const
export const MetricCensoringRuleSchema = z.enum(METRIC_CENSORING_RULES)

export const METRIC_STATUSES = ['active', 'superseded', 'withdrawn'] as const
export const MetricStatusSchema = z.enum(METRIC_STATUSES)
export type MetricStatus = z.infer<typeof MetricStatusSchema>

export const METRIC_FIXTURE_CLASSES = [
  'eligibility',
  'missingness',
  'censoring',
  'boundary_dates',
  'empty_eligible_cohort',
  'truncation',
  'unsupported_definition',
  'version_supersession',
  'sensitivity_variant',
  'counterexample',
] as const
export const MetricFixtureClassSchema = z.enum(METRIC_FIXTURE_CLASSES)

/** Every registered metric must name at least these fixture classes before it may be exposed. */
export const REQUIRED_METRIC_FIXTURE_CLASSES = [
  'eligibility',
  'missingness',
  'censoring',
  'boundary_dates',
  'empty_eligible_cohort',
] as const

export const METRIC_RENDER_SURFACES = ['atlas', 'story', 'evidence_drawer', 'api_v2'] as const
/** Export sinks a metric result may reach. `public`, `model`, `log`, `persistence` are absent. */
export const METRIC_EXPORT_SINKS = ['api', 'frontend', 'export'] as const

const MetricReferenceSchema = z
  .object({ metricId: IdentifierSchema, version: VersionSchema })
  .strict()
export type MetricReference = z.infer<typeof MetricReferenceSchema>

const RequiredFieldSchema = z
  .object({
    fieldPath: z.string().regex(/^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*$/),
    /** `X` is not a member: an X-class field can never be a metric input. */
    dataClass: z.enum(['C0', 'C1', 'C2', 'C3', 'C4']),
    nullable: z.boolean(),
  })
  .strict()

const EligibilityRuleSchema = z
  .object({ ruleCode: CodeSchema, statement: StatementSchema })
  .strict()

const EligibilitySchema = z
  .object({
    cohortId: IdentifierSchema,
    statement: StatementSchema,
    inclusionRules: z.array(EligibilityRuleSchema).min(1),
    exclusionRules: z.array(EligibilityRuleSchema),
  })
  .strict()

const EventDefinitionSchema = z
  .object({
    eventCode: CodeSchema,
    statement: StatementSchema,
    censoringRule: MetricCensoringRuleSchema,
    censoringStatement: StatementSchema,
  })
  .strict()

const MissingnessSchema = z
  .object({
    policy: MetricMissingnessPolicySchema,
    truncationPolicy: MetricTruncationPolicySchema,
    statement: StatementSchema,
  })
  .strict()

const QuantileListSchema = z.array(z.number().gt(0).lt(1)).min(1)

/**
 * Deterministic formula — a closed discriminated union.
 *
 * There is deliberately no `weighted_composite`, `blended_index`, or `scalar_rollup` member:
 * a blended engagement/importance/activity/health/maturity/confidence scalar has no
 * representable formula here, so such a registration is schema-rejected by construction rather
 * than by a hand-written guard.
 */
const MetricFormulaSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('event_count'),
      procedureId: IdentifierSchema,
      eventCode: CodeSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('distinct_count'),
      procedureId: IdentifierSchema,
      keyFieldPath: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('proportion_of_cohort'),
      procedureId: IdentifierSchema,
      numeratorEventCode: CodeSchema,
      denominatorCohortId: IdentifierSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('duration_quantiles'),
      procedureId: IdentifierSchema,
      startEventCode: CodeSchema,
      endEventCode: CodeSchema,
      quantiles: QuantileListSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('inter_event_interval_quantiles'),
      procedureId: IdentifierSchema,
      eventCode: CodeSchema,
      quantiles: QuantileListSchema,
    })
    .strict(),
])
export type MetricFormula = z.infer<typeof MetricFormulaSchema>

/**
 * Minimum support gates.
 *
 * Issue #67: gating is display eligibility, never row existence, and a typed empty-eligible
 * cohort is exempt — a fully covered quiet period is a complete observation of zero, not a
 * small sample. Both facts are literals so no registration can weaken them.
 */
const SupportGateSchema = z
  .object({
    minimumEligible: NonnegativeIntegerSchema,
    appliesTo: z.literal('display_eligibility'),
    emptyCohortExempt: z.literal(true),
    belowGateBehaviour: z.enum(['suppress_display', 'render_as_range_only']),
  })
  .strict()

const ComparisonRequirementsSchema = z
  .object({
    requiresMatchedWindow: z.boolean(),
    minimumMatchedFraction: UnitIntervalSchema,
    /** ADR-26: a failed comparison is never a zero delta. */
    incomparableOutcome: z.literal('explicit_no_comparison'),
    /** Issue #67: an empty eligible cohort compares as an explicit empty outcome. */
    emptyCohortOutcome: z.literal('explicit_empty_outcome'),
  })
  .strict()

const SensitivityVariantSchema = z
  .object({
    variantId: CodeSchema,
    statement: StatementSchema,
    parameterChange: StatementSchema,
  })
  .strict()

const ConfounderSchema = z.object({ code: CodeSchema, statement: StatementSchema }).strict()

const ProhibitedInterpretationSchema = z
  .object({ code: CodeSchema, statement: StatementSchema })
  .strict()

const RenderPolicySchema = z
  .object({
    surfaces: z.array(z.enum(METRIC_RENDER_SURFACES)).min(1),
    /** A metric never renders without its definition card or its prohibited interpretations. */
    requiresDefinitionCard: z.literal(true),
    requiresProhibitedInterpretations: z.literal(true),
    exportSinks: z.array(z.enum(METRIC_EXPORT_SINKS)),
    maximumDataClass: z.enum(['C0', 'C1']),
  })
  .strict()

const SupersessionSchema = z
  .object({
    supersededBy: MetricReferenceSchema.nullable(),
    supersededAt: UtcTimestampSchema.nullable(),
    reasonCode: CodeSchema.nullable(),
  })
  .strict()

const FORMULA_UNITS: Readonly<Record<MetricFormula['kind'], readonly MetricUnit[]>> = {
  event_count: ['event_count', 'events_per_day'],
  distinct_count: ['count_of_distinct'],
  proportion_of_cohort: ['proportion'],
  duration_quantiles: ['seconds', 'days'],
  inter_event_interval_quantiles: ['seconds', 'days'],
}

const FORMULA_CATEGORIES: Readonly<Record<MetricFormula['kind'], readonly MetricSemanticCategory[]>> = {
  event_count: ['event_count'],
  distinct_count: ['event_count', 'topology_statistic'],
  proportion_of_cohort: ['proportion_of_cohort'],
  duration_quantiles: ['lifecycle_duration', 'dispersion'],
  inter_event_interval_quantiles: ['inter_event_interval', 'dispersion'],
}

const DISTRIBUTION_FORMULA_KINDS = ['duration_quantiles', 'inter_event_interval_quantiles'] as const

function isDistributionFormula(formula: MetricFormula): boolean {
  return (DISTRIBUTION_FORMULA_KINDS as readonly string[]).includes(formula.kind)
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

export const MetricDefinitionSchema = z
  .object({
    metricId: IdentifierSchema,
    version: VersionSchema,
    status: MetricStatusSchema,
    label: z.string().min(3),
    /** What exactly this metric answers, in one sentence. */
    questionAnswered: StatementSchema,
    analyticalSubject: MetricAnalyticalSubjectSchema,
    unit: MetricUnitSchema,
    semanticCategory: MetricSemanticCategorySchema,
    windowSemantics: MetricWindowSemanticsSchema,
    clockSource: MetricClockSourceSchema,
    requiredCapabilities: z.array(CapabilityIdSchema).min(1),
    requiredFields: z.array(RequiredFieldSchema).min(1),
    eligibility: EligibilitySchema,
    event: EventDefinitionSchema,
    missingness: MissingnessSchema,
    formula: MetricFormulaSchema,
    supportGates: SupportGateSchema,
    comparisonRequirements: ComparisonRequirementsSchema,
    sensitivityVariants: z.array(SensitivityVariantSchema).min(1),
    knownConfounders: z.array(ConfounderSchema).min(1),
    /** Required and non-empty: a metric with nothing forbidden has not been thought through. */
    prohibitedInterpretations: z.array(ProhibitedInterpretationSchema).min(1),
    coverageDimensions: z.array(MetricCoverageDimensionSchema).min(1),
    fixtureClasses: z.array(MetricFixtureClassSchema).min(1),
    renderPolicy: RenderPolicySchema,
    supersession: SupersessionSchema,
  })
  .strict()
  .superRefine((definition, context) => {
    for (const [field, value] of [
      ['metricId', definition.metricId],
      ['label', definition.label],
      ['questionAnswered', definition.questionAnswered],
      ['eligibility.cohortId', definition.eligibility.cohortId],
      ['formula.procedureId', definition.formula.procedureId],
      ['event.eventCode', definition.event.eventCode],
    ] as const) {
      const term = findForbiddenConstructTerm(value)
      if (term) {
        context.addIssue({
          code: 'custom',
          message: `Forbidden construct term "${term}" in ${field}: blended and person-scoring metrics cannot be registered`,
          path: field.split('.'),
        })
      }
    }

    if (!FORMULA_UNITS[definition.formula.kind].includes(definition.unit)) {
      context.addIssue({
        code: 'custom',
        message: `Unit ${definition.unit} is not measurable by a ${definition.formula.kind} formula`,
        path: ['unit'],
      })
    }
    if (!FORMULA_CATEGORIES[definition.formula.kind].includes(definition.semanticCategory)) {
      context.addIssue({
        code: 'custom',
        message: `Semantic category ${definition.semanticCategory} does not match a ${definition.formula.kind} formula`,
        path: ['semanticCategory'],
      })
    }

    if (isDistributionFormula(definition.formula) && definition.event.censoringRule === 'no_censoring_possible') {
      context.addIssue({
        code: 'custom',
        message: 'A duration or interval metric must declare a censoring rule; durations can always be right-censored',
        path: ['event', 'censoringRule'],
      })
    }

    const dimensions = new Set(definition.coverageDimensions)
    if (dimensions.size !== definition.coverageDimensions.length) {
      context.addIssue({ code: 'custom', message: 'Coverage dimensions must be unique', path: ['coverageDimensions'] })
    }
    for (const required of ['completeness', 'eligibility'] as const) {
      if (!dimensions.has(required)) {
        context.addIssue({
          code: 'custom',
          message: `Every metric consumes the ${required} coverage dimension`,
          path: ['coverageDimensions'],
        })
      }
    }
    if (isDistributionFormula(definition.formula) && !dimensions.has('censoring_freedom')) {
      context.addIssue({
        code: 'custom',
        message: 'A duration or interval metric must consume the censoring_freedom coverage dimension',
        path: ['coverageDimensions'],
      })
    }
    if (definition.comparisonRequirements.requiresMatchedWindow && !dimensions.has('comparability')) {
      context.addIssue({
        code: 'custom',
        message: 'A comparison-requiring metric must consume the comparability coverage dimension',
        path: ['coverageDimensions'],
      })
    }
    if (definition.supportGates.minimumEligible > 0 && !dimensions.has('sample')) {
      context.addIssue({
        code: 'custom',
        message: 'A support-gated metric must consume the sample coverage dimension',
        path: ['coverageDimensions'],
      })
    }

    const fixtures = new Set(definition.fixtureClasses)
    for (const required of REQUIRED_METRIC_FIXTURE_CLASSES) {
      if (!fixtures.has(required)) {
        context.addIssue({
          code: 'custom',
          message: `Fixture class ${required} is required before a metric may be registered`,
          path: ['fixtureClasses'],
        })
      }
    }

    const exclusionCodes = new Set(definition.eligibility.exclusionRules.map((rule) => rule.ruleCode))
    if (exclusionCodes.size !== definition.eligibility.exclusionRules.length) {
      context.addIssue({
        code: 'custom',
        message: 'Exclusion rule codes must be unique; excluded counts key on them',
        path: ['eligibility', 'exclusionRules'],
      })
    }

    const variantIds = new Set(definition.sensitivityVariants.map((variant) => variant.variantId))
    if (variantIds.size !== definition.sensitivityVariants.length) {
      context.addIssue({ code: 'custom', message: 'Sensitivity variant ids must be unique', path: ['sensitivityVariants'] })
    }

    const { supersededBy, supersededAt, reasonCode } = definition.supersession
    if (definition.status === 'active' && (supersededBy !== null || supersededAt !== null || reasonCode !== null)) {
      context.addIssue({ code: 'custom', message: 'An active definition carries no supersession record', path: ['supersession'] })
    }
    if (definition.status === 'superseded') {
      if (supersededBy === null || supersededAt === null || reasonCode === null) {
        context.addIssue({
          code: 'custom',
          message: 'A superseded definition must name its successor, the time, and the reason',
          path: ['supersession'],
        })
      } else {
        if (supersededBy.metricId !== definition.metricId) {
          context.addIssue({
            code: 'custom',
            message: 'A metric is superseded only by a newer version of the same metric id',
            path: ['supersession', 'supersededBy', 'metricId'],
          })
        }
        if (compareVersions(supersededBy.version, definition.version) <= 0) {
          context.addIssue({
            code: 'custom',
            message: 'The superseding version must be greater than the superseded version',
            path: ['supersession', 'supersededBy', 'version'],
          })
        }
        if (!fixtures.has('version_supersession')) {
          context.addIssue({
            code: 'custom',
            message: 'A superseded definition must carry the version_supersession fixture class',
            path: ['fixtureClasses'],
          })
        }
      }
    }
    if (definition.status === 'withdrawn') {
      if (supersededBy !== null) {
        context.addIssue({
          code: 'custom',
          message: 'A withdrawn definition has no successor; use superseded when one exists',
          path: ['supersession', 'supersededBy'],
        })
      }
      if (reasonCode === null) {
        context.addIssue({ code: 'custom', message: 'A withdrawn definition must record a reason code', path: ['supersession', 'reasonCode'] })
      }
    }
  })

export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>

/* ------------------------------------------------------------------------------------------ *
 * Result contract (ADR-25/26). The later finding and comparison cards consume this shape.
 * ------------------------------------------------------------------------------------------ */

/**
 * Result states — closed and mutually exclusive.
 *
 * `empty_eligible_cohort` (issue #67) is a fully covered period that genuinely contained zero
 * eligible events. It is a distinct state from `unavailable`, `truncated`, `censored_only`, and
 * `coverage_failed`, so a quiet week can never be conflated with a coverage gap.
 */
export const METRIC_RESULT_STATES = [
  'observed',
  'empty_eligible_cohort',
  'censored_only',
  'truncated',
  'unavailable',
  'coverage_failed',
] as const
export const MetricResultStateSchema = z.enum(METRIC_RESULT_STATES)
export type MetricResultState = z.infer<typeof MetricResultStateSchema>

/** Reserved: only an `empty_eligible_cohort` row may carry this reason code, and it always does. */
export const EMPTY_ELIGIBLE_COHORT_REASON_CODE = 'EMPTY_ELIGIBLE_COHORT' as const
export const CENSORED_ONLY_REASON_CODE = 'ALL_ELIGIBLE_EVENTS_CENSORED' as const

const QuantileValueSchema = z
  .object({ quantile: z.number().gt(0).lt(1), value: z.number().nonnegative() })
  .strict()

/**
 * Observed value — closed discriminated union.
 *
 * An empty eligible cohort reads as an observed count of 0 for a counting metric, and as a
 * `quantiles` value whose distribution is explicitly `null` for a duration or interval metric.
 * A fabricated zero-duration quantile is rejected: `sampleSize === 0` requires `quantiles: null`.
 */
export const MetricValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('count'), observedCount: NonnegativeIntegerSchema }).strict(),
  z
    .object({
      kind: z.literal('proportion'),
      numerator: NonnegativeIntegerSchema,
      denominator: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('quantiles'),
      sampleSize: NonnegativeIntegerSchema,
      quantiles: z.array(QuantileValueSchema).min(1).nullable(),
    })
    .strict(),
  z.object({ kind: z.literal('no_value'), reasonCode: CodeSchema }).strict(),
])
export type MetricValue = z.infer<typeof MetricValueSchema>

const ExcludedCountSchema = z
  .object({ reasonCode: CodeSchema, count: z.number().int().positive() })
  .strict()

const MetricCountsSchema = z
  .object({
    eligible: NonnegativeIntegerSchema,
    censored: NonnegativeIntegerSchema,
    excluded: z.array(ExcludedCountSchema),
  })
  .strict()
  .superRefine((counts, context) => {
    if (counts.censored > counts.eligible) {
      context.addIssue({ code: 'custom', message: 'Censored units are a subset of the eligible cohort', path: ['censored'] })
    }
    const codes = new Set(counts.excluded.map((entry) => entry.reasonCode))
    if (codes.size !== counts.excluded.length) {
      context.addIssue({ code: 'custom', message: 'Excluded counts must be keyed by distinct reason codes', path: ['excluded'] })
    }
  })

/** ADR-02 canonical dimension shape. The wire/SQL spelling of `limitingReason` is `limiting_reason`. */
const MetricCoverageEntrySchema = z
  .object({
    dimension: MetricCoverageDimensionSchema,
    value: UnitIntervalSchema.nullable(),
    limitingReason: CodeSchema.nullable(),
  })
  .strict()
export type MetricCoverageEntry = z.infer<typeof MetricCoverageEntrySchema>

/** The one canonical wire/SQL spelling required by ADR-02, emitted from the camelCase TS shape. */
export function toCoverageWireEntry(entry: MetricCoverageEntry): {
  dimension: MetricCoverageDimension
  value: number | null
  limiting_reason: string | null
} {
  return { dimension: entry.dimension, value: entry.value, limiting_reason: entry.limitingReason }
}

const SensitivityResultSchema = z
  .object({
    variantId: CodeSchema,
    state: MetricResultStateSchema,
    value: MetricValueSchema,
  })
  .strict()

const CalculationProvenanceSchema = z
  .object({
    procedureId: IdentifierSchema,
    metricContractVersion: VersionSchema,
    engineVersion: VersionSchema,
  })
  .strict()

export const MetricResultSchema = z
  .object({
    resultId: z.string().min(1),
    metricId: IdentifierSchema,
    /** Results always pin the exact definition version, superseded or not. */
    metricVersion: VersionSchema,
    scopeAlias: z.string().min(1),
    window: z.object({ start: UtcTimestampSchema, end: UtcTimestampSchema }).strict(),
    asOf: UtcTimestampSchema,
    state: MetricResultStateSchema,
    stateReasonCode: CodeSchema,
    counts: MetricCountsSchema,
    value: MetricValueSchema,
    coverage: z.array(MetricCoverageEntrySchema).min(1),
    evidenceIds: z.array(z.string().min(1)),
    calculation: CalculationProvenanceSchema,
    sensitivity: z.array(SensitivityResultSchema),
  })
  .strict()
  .superRefine((result, context) => {
    const windowStart = Date.parse(result.window.start)
    const windowEnd = Date.parse(result.window.end)
    const asOf = Date.parse(result.asOf)
    if (windowStart >= windowEnd) {
      context.addIssue({ code: 'custom', message: 'Result windows are half-open and increasing', path: ['window', 'end'] })
    }
    if (asOf < windowStart) {
      context.addIssue({ code: 'custom', message: 'asOf cannot precede the window it describes', path: ['asOf'] })
    }

    const isEmptyCohort = result.state === 'empty_eligible_cohort'
    if (isEmptyCohort !== (result.stateReasonCode === EMPTY_ELIGIBLE_COHORT_REASON_CODE)) {
      context.addIssue({
        code: 'custom',
        message: `${EMPTY_ELIGIBLE_COHORT_REASON_CODE} is reserved for, and required by, the empty_eligible_cohort state`,
        path: ['stateReasonCode'],
      })
    }

    if (result.value.kind === 'quantiles' && (result.value.sampleSize === 0) !== (result.value.quantiles === null)) {
      context.addIssue({
        code: 'custom',
        message: 'An empty sample has a null distribution; a non-empty sample has quantiles. Zero-duration values are never fabricated',
        path: ['value', 'quantiles'],
      })
    }
    if (result.value.kind === 'count' && result.value.observedCount > 0 && result.counts.eligible === 0) {
      context.addIssue({
        code: 'custom',
        message: 'A positive observed count requires a non-empty eligible cohort',
        path: ['value', 'observedCount'],
      })
    }

    const completeness = result.coverage.find((entry) => entry.dimension === 'completeness')

    switch (result.state) {
      case 'observed': {
        if (result.counts.eligible === 0) {
          context.addIssue({ code: 'custom', message: 'An observed result has a non-empty eligible cohort; use empty_eligible_cohort', path: ['counts', 'eligible'] })
        }
        if (result.value.kind === 'no_value') {
          context.addIssue({ code: 'custom', message: 'An observed result carries a value', path: ['value'] })
        }
        if (asOf < windowEnd) {
          context.addIssue({ code: 'custom', message: 'An observed result requires a completed window (asOf at or after window end)', path: ['asOf'] })
        }
        break
      }
      case 'empty_eligible_cohort': {
        if (result.counts.eligible !== 0 || result.counts.censored !== 0) {
          context.addIssue({ code: 'custom', message: 'An empty eligible cohort has zero eligible and zero censored units', path: ['counts'] })
        }
        if (asOf < windowEnd) {
          context.addIssue({ code: 'custom', message: 'An empty eligible cohort requires a completed window (asOf at or after window end)', path: ['asOf'] })
        }
        if (!completeness || completeness.value !== 1 || completeness.limitingReason !== null) {
          context.addIssue({
            code: 'custom',
            message: 'An empty eligible cohort is only claimable under complete coverage; otherwise the state is unavailable or truncated',
            path: ['coverage'],
          })
        }
        if (result.value.kind === 'count' && result.value.observedCount !== 0) {
          context.addIssue({ code: 'custom', message: 'An empty eligible cohort counts an observed zero', path: ['value', 'observedCount'] })
        }
        if (result.value.kind === 'quantiles' && (result.value.sampleSize !== 0 || result.value.quantiles !== null)) {
          context.addIssue({ code: 'custom', message: 'An empty eligible cohort has a null distribution and a zero sample', path: ['value'] })
        }
        if (result.value.kind === 'proportion') {
          context.addIssue({
            code: 'custom',
            message: 'A proportion over an empty cohort is not computable; use no_value with the empty-cohort reason code',
            path: ['value'],
          })
        }
        if (result.value.kind === 'no_value' && result.value.reasonCode !== EMPTY_ELIGIBLE_COHORT_REASON_CODE) {
          context.addIssue({ code: 'custom', message: 'An empty eligible cohort names the empty-cohort reason code', path: ['value', 'reasonCode'] })
        }
        break
      }
      case 'censored_only': {
        if (result.counts.eligible === 0 || result.counts.censored !== result.counts.eligible) {
          context.addIssue({ code: 'custom', message: 'A censored-only result has every eligible unit censored', path: ['counts'] })
        }
        if (result.value.kind !== 'no_value' || result.value.reasonCode !== CENSORED_ONLY_REASON_CODE) {
          context.addIssue({ code: 'custom', message: `A censored-only result carries no_value with ${CENSORED_ONLY_REASON_CODE}`, path: ['value'] })
        }
        break
      }
      case 'truncated': {
        if (!completeness || completeness.limitingReason === null) {
          context.addIssue({ code: 'custom', message: 'A truncated result names a limiting reason on completeness', path: ['coverage'] })
        }
        break
      }
      case 'unavailable':
      case 'coverage_failed': {
        if (result.value.kind !== 'no_value') {
          context.addIssue({ code: 'custom', message: 'An unavailable or failed result never carries a numeric value', path: ['value'] })
        }
        if (result.counts.eligible !== 0) {
          context.addIssue({ code: 'custom', message: 'An unavailable or failed result has no measured eligible cohort', path: ['counts', 'eligible'] })
        }
        break
      }
    }

    const dimensions = new Set(result.coverage.map((entry) => entry.dimension))
    if (dimensions.size !== result.coverage.length) {
      context.addIssue({ code: 'custom', message: 'Coverage dimensions must be unique on a result', path: ['coverage'] })
    }

    const variantIds = new Set(result.sensitivity.map((entry) => entry.variantId))
    if (variantIds.size !== result.sensitivity.length) {
      context.addIssue({ code: 'custom', message: 'Sensitivity variant ids must be unique on a result', path: ['sensitivity'] })
    }
  })

export type MetricResult = z.infer<typeof MetricResultSchema>

/* ------------------------------------------------------------------------------------------ *
 * Registry
 * ------------------------------------------------------------------------------------------ */

for (const value of [...METRIC_ANALYTICAL_SUBJECTS, ...METRIC_UNITS, ...METRIC_SEMANTIC_CATEGORIES]) {
  const term = findForbiddenConstructTerm(value)
  if (term) {
    throw new MetricRegistryError(
      `Closed metric enum member "${value}" contains the forbidden construct term "${term}"`,
    )
  }
}

function defineMetric(definition: unknown): MetricDefinition {
  return MetricDefinitionSchema.parse(definition)
}

const PR_INTEGRATION_INTERVAL_SHARED = {
  metricId: 'pull_request.integration_interval',
  analyticalSubject: 'pull_request_cohort',
  unit: 'seconds',
  semanticCategory: 'lifecycle_duration',
  windowSemantics: 'matched_half_open_windows',
  clockSource: 'injected_as_of',
  requiredCapabilities: ['github.core'],
  requiredFields: [
    { fieldPath: 'pullRequest.readyForReviewAt', dataClass: 'C1', nullable: true },
    { fieldPath: 'pullRequest.mergedAt', dataClass: 'C1', nullable: true },
    { fieldPath: 'pullRequest.closedAt', dataClass: 'C1', nullable: true },
  ],
  supportGates: {
    minimumEligible: 5,
    appliesTo: 'display_eligibility',
    emptyCohortExempt: true,
    belowGateBehaviour: 'render_as_range_only',
  },
  comparisonRequirements: {
    requiresMatchedWindow: true,
    minimumMatchedFraction: 0.8,
    incomparableOutcome: 'explicit_no_comparison',
    emptyCohortOutcome: 'explicit_empty_outcome',
  },
  knownConfounders: [
    { code: 'RELEASE_FREEZE', statement: 'A release freeze lengthens intervals without any change in how work is done.' },
    { code: 'BATCHED_REVIEW', statement: 'Batched review sessions cluster merges and shorten the observed tail.' },
    { code: 'WINDOW_LENGTH', statement: 'Short windows admit fewer long-lived pull requests and bias the tail downwards.' },
  ],
  prohibitedInterpretations: [
    { code: 'NOT_PERSON_MEASURE', statement: 'This is a property of a pull-request cohort and must never be read as a measure of any individual person or their productivity.' },
    { code: 'NOT_CAUSAL', statement: 'A shorter interval does not establish that any process change caused it.' },
    { code: 'NOT_QUALITY', statement: 'Integration speed says nothing about the quality or the value of what was merged.' },
    { code: 'NOT_TARGET', statement: 'This must never be used as a target, a threshold, or an input to a performance review.' },
  ],
  coverageDimensions: [
    'permission', 'completeness', 'eligibility', 'freshness', 'censoring_freedom', 'sample', 'comparability',
  ],
  renderPolicy: {
    surfaces: ['atlas', 'evidence_drawer', 'api_v2'],
    requiresDefinitionCard: true,
    requiresProhibitedInterpretations: true,
    exportSinks: ['api', 'frontend', 'export'],
    maximumDataClass: 'C1',
  },
} as const

/**
 * The registered metrics. Every entry is an invented, product-boundary-safe system metric:
 * cohorts of pull requests, check runs, and windows — never a person.
 */
export const METRIC_REGISTRY: readonly MetricDefinition[] = [
  defineMetric({
    ...PR_INTEGRATION_INTERVAL_SHARED,
    version: '1.0.0',
    status: 'superseded',
    label: 'Pull-request integration interval (v1)',
    questionAnswered: 'How long did merged pull requests take from opening to merge inside the window?',
    eligibility: {
      cohortId: 'pull_request.merged_in_window',
      statement: 'Pull requests whose merge event falls inside the half-open window.',
      inclusionRules: [
        { ruleCode: 'MERGED_IN_WINDOW', statement: 'The merge timestamp falls inside the half-open window.' },
      ],
      exclusionRules: [
        { ruleCode: 'MISSING_OPEN_TIMESTAMP', statement: 'The opening timestamp is absent, so no interval can be computed.' },
      ],
    },
    event: {
      eventCode: 'PULL_REQUEST_MERGED',
      statement: 'The merge event recorded by the forge for a pull request.',
      censoringRule: 'right_censor_at_window_end',
      censoringStatement: 'Pull requests still open at the window end are right-censored and excluded from the distribution.',
    },
    missingness: {
      policy: 'exclude_from_eligible_cohort',
      truncationPolicy: 'abstain_when_truncated',
      statement: 'A pull request missing either endpoint leaves the eligible cohort and is counted under its exclusion reason.',
    },
    formula: {
      kind: 'duration_quantiles',
      procedureId: 'pull_request.interval_quantiles_v1',
      startEventCode: 'PULL_REQUEST_OPENED',
      endEventCode: 'PULL_REQUEST_MERGED',
      quantiles: [0.5, 0.75, 0.9],
    },
    sensitivityVariants: [
      { variantId: 'EXCLUDE_LONG_TAIL', statement: 'Recompute without pull requests older than the window length.', parameterChange: 'Drop eligible units whose start precedes the window start.' },
    ],
    fixtureClasses: ['eligibility', 'missingness', 'censoring', 'boundary_dates', 'empty_eligible_cohort', 'version_supersession'],
    supersession: {
      supersededBy: { metricId: 'pull_request.integration_interval', version: '1.1.0' },
      supersededAt: '2026-08-04T00:00:00.000Z',
      reasonCode: 'COHORT_START_EVENT_CORRECTED',
    },
  }),
  defineMetric({
    ...PR_INTEGRATION_INTERVAL_SHARED,
    version: '1.1.0',
    status: 'active',
    label: 'Pull-request integration interval',
    questionAnswered: 'How long did pull requests take from ready-for-review to merge inside the window?',
    eligibility: {
      cohortId: 'pull_request.ready_and_merged_in_window',
      statement: 'Pull requests that became ready for review before the window end and merged inside the half-open window.',
      inclusionRules: [
        { ruleCode: 'READY_BEFORE_WINDOW_END', statement: 'The ready-for-review event precedes the window end.' },
        { ruleCode: 'MERGED_IN_WINDOW', statement: 'The merge timestamp falls inside the half-open window.' },
      ],
      exclusionRules: [
        { ruleCode: 'NEVER_READY_FOR_REVIEW', statement: 'The pull request never left draft, so the cohort start event never occurred.' },
        { ruleCode: 'MISSING_READY_TIMESTAMP', statement: 'The ready-for-review timestamp is absent for a pull request that did leave draft.' },
      ],
    },
    event: {
      eventCode: 'PULL_REQUEST_MERGED',
      statement: 'The merge event recorded by the forge for a pull request that was ready for review.',
      censoringRule: 'right_censor_at_window_end',
      censoringStatement: 'Pull requests ready for review but not merged by the window end are right-censored and reported separately.',
    },
    missingness: {
      policy: 'exclude_from_eligible_cohort',
      truncationPolicy: 'report_with_truncation_limitation',
      statement: 'A pull request missing the ready-for-review endpoint leaves the eligible cohort under a named exclusion reason and is never imputed.',
    },
    formula: {
      kind: 'duration_quantiles',
      procedureId: 'pull_request.interval_quantiles_v2',
      startEventCode: 'PULL_REQUEST_READY_FOR_REVIEW',
      endEventCode: 'PULL_REQUEST_MERGED',
      quantiles: [0.5, 0.75, 0.9],
    },
    sensitivityVariants: [
      { variantId: 'EXCLUDE_LONG_TAIL', statement: 'Recompute without pull requests whose start precedes the window.', parameterChange: 'Drop eligible units whose ready-for-review event precedes the window start.' },
      { variantId: 'OPEN_TREATED_AS_CENSORED', statement: 'Recompute treating still-open pull requests as censored at the window end.', parameterChange: 'Move right-censored units into the reported censored count instead of the exclusion list.' },
    ],
    fixtureClasses: ['eligibility', 'missingness', 'censoring', 'boundary_dates', 'empty_eligible_cohort', 'truncation', 'sensitivity_variant', 'version_supersession'],
    supersession: { supersededBy: null, supersededAt: null, reasonCode: null },
  }),
  defineMetric({
    metricId: 'pull_request.ready_event_count',
    version: '1.0.0',
    status: 'active',
    label: 'Pull requests made ready for review',
    questionAnswered: 'How many pull requests became ready for review inside the window?',
    analyticalSubject: 'pull_request_cohort',
    unit: 'event_count',
    semanticCategory: 'event_count',
    windowSemantics: 'half_open_utc_window',
    clockSource: 'injected_as_of',
    requiredCapabilities: ['github.core'],
    requiredFields: [{ fieldPath: 'pullRequest.readyForReviewAt', dataClass: 'C1', nullable: true }],
    eligibility: {
      cohortId: 'pull_request.ready_in_window',
      statement: 'Pull requests whose ready-for-review event falls inside the half-open window.',
      inclusionRules: [
        { ruleCode: 'READY_IN_WINDOW', statement: 'The ready-for-review event falls inside the half-open window.' },
      ],
      exclusionRules: [
        { ruleCode: 'NEVER_READY_FOR_REVIEW', statement: 'The pull request never left draft inside the window.' },
      ],
    },
    event: {
      eventCode: 'PULL_REQUEST_READY_FOR_REVIEW',
      statement: 'The transition of a pull request out of draft state.',
      censoringRule: 'no_censoring_possible',
      censoringStatement: 'A point event inside a completed window cannot be censored; only coverage can be missing.',
    },
    missingness: {
      policy: 'exclude_from_eligible_cohort',
      truncationPolicy: 'report_with_truncation_limitation',
      statement: 'A pull request without a ready-for-review timestamp is excluded under a named reason and never counted as zero.',
    },
    formula: {
      kind: 'event_count',
      procedureId: 'pull_request.ready_count_v1',
      eventCode: 'PULL_REQUEST_READY_FOR_REVIEW',
    },
    supportGates: {
      minimumEligible: 0,
      appliesTo: 'display_eligibility',
      emptyCohortExempt: true,
      belowGateBehaviour: 'suppress_display',
    },
    comparisonRequirements: {
      requiresMatchedWindow: true,
      minimumMatchedFraction: 1,
      incomparableOutcome: 'explicit_no_comparison',
      emptyCohortOutcome: 'explicit_empty_outcome',
    },
    sensitivityVariants: [
      { variantId: 'CALENDAR_WEEK_ALIGNED', statement: 'Recompute on calendar-week-aligned windows.', parameterChange: 'Shift the window start to the preceding Monday boundary.' },
    ],
    knownConfounders: [
      { code: 'RELEASE_FREEZE', statement: 'A release freeze suppresses ready-for-review events without any change in intent.' },
      { code: 'HOLIDAY_PERIOD', statement: 'A holiday period produces genuinely quiet windows that are complete, not missing.' },
    ],
    prohibitedInterpretations: [
      { code: 'NOT_PERSON_MEASURE', statement: 'A count of events must never be attributed to, or read as a measure of, any individual person.' },
      { code: 'NOT_OUTPUT', statement: 'This counts transitions out of draft, not delivered value or effort spent.' },
      { code: 'ZERO_IS_NOT_ABSENCE', statement: 'A complete window with zero events is an observed quiet period; it is not missing data and must not be read as one.' },
    ],
    coverageDimensions: ['permission', 'completeness', 'eligibility', 'freshness', 'comparability'],
    fixtureClasses: ['eligibility', 'missingness', 'censoring', 'boundary_dates', 'empty_eligible_cohort', 'truncation'],
    renderPolicy: {
      surfaces: ['atlas', 'story', 'evidence_drawer', 'api_v2'],
      requiresDefinitionCard: true,
      requiresProhibitedInterpretations: true,
      exportSinks: ['api', 'frontend', 'export'],
      maximumDataClass: 'C1',
    },
    supersession: { supersededBy: null, supersededAt: null, reasonCode: null },
  }),
  defineMetric({
    metricId: 'check_run.first_attempt_pass_share',
    version: '1.0.0',
    status: 'active',
    label: 'First-attempt check-run pass share',
    questionAnswered: 'What share of check-run series passed on their first attempt inside the window?',
    analyticalSubject: 'check_run_cohort',
    unit: 'proportion',
    semanticCategory: 'proportion_of_cohort',
    windowSemantics: 'half_open_utc_window',
    clockSource: 'injected_as_of',
    requiredCapabilities: ['cap.github.actions'],
    requiredFields: [
      { fieldPath: 'checkRun.attemptNumber', dataClass: 'C3', nullable: false },
      { fieldPath: 'checkRun.conclusion', dataClass: 'C3', nullable: true },
      { fieldPath: 'checkRun.completedAt', dataClass: 'C3', nullable: true },
    ],
    eligibility: {
      cohortId: 'check_run.series_completed_in_window',
      statement: 'Check-run series whose first attempt completed inside the half-open window.',
      inclusionRules: [
        { ruleCode: 'FIRST_ATTEMPT_COMPLETED_IN_WINDOW', statement: 'The first attempt of the series completed inside the half-open window.' },
      ],
      exclusionRules: [
        { ruleCode: 'CANCELLED_BEFORE_CONCLUSION', statement: 'The series was cancelled before reaching any conclusion.' },
        { ruleCode: 'MISSING_CONCLUSION', statement: 'No conclusion was recorded for the first attempt.' },
      ],
    },
    event: {
      eventCode: 'CHECK_RUN_FIRST_ATTEMPT_CONCLUDED',
      statement: 'The conclusion of the first attempt of a check-run series.',
      censoringRule: 'right_censor_at_window_end',
      censoringStatement: 'A series whose first attempt is still running at the window end is right-censored, not counted as a failure.',
    },
    missingness: {
      policy: 'retain_as_unknown_and_report',
      truncationPolicy: 'abstain_when_truncated',
      statement: 'A series without a recorded conclusion is retained as unknown and reported, never folded into the failing side.',
    },
    formula: {
      kind: 'proportion_of_cohort',
      procedureId: 'check_run.first_attempt_pass_share_v1',
      numeratorEventCode: 'CHECK_RUN_FIRST_ATTEMPT_PASSED',
      denominatorCohortId: 'check_run.series_completed_in_window',
    },
    supportGates: {
      minimumEligible: 10,
      appliesTo: 'display_eligibility',
      emptyCohortExempt: true,
      belowGateBehaviour: 'suppress_display',
    },
    comparisonRequirements: {
      requiresMatchedWindow: true,
      minimumMatchedFraction: 0.9,
      incomparableOutcome: 'explicit_no_comparison',
      emptyCohortOutcome: 'explicit_empty_outcome',
    },
    sensitivityVariants: [
      { variantId: 'INCLUDE_CANCELLED_AS_UNKNOWN', statement: 'Recompute with cancelled series retained as unknown rather than excluded.', parameterChange: 'Move the CANCELLED_BEFORE_CONCLUSION rule from exclusion to unknown retention.' },
    ],
    knownConfounders: [
      { code: 'FLAKY_INFRASTRUCTURE', statement: 'Infrastructure flakiness moves the share without any change in the code under test.' },
      { code: 'WORKFLOW_REDEFINITION', statement: 'A redefined workflow changes what a first attempt even means across the window boundary.' },
    ],
    prohibitedInterpretations: [
      { code: 'NOT_PERSON_MEASURE', statement: 'A pass share is a property of a check-run cohort and must never be attributed to any individual person.' },
      { code: 'NOT_CODE_QUALITY', statement: 'A pass share measures the configured checks, not the correctness of the code.' },
      { code: 'NOT_COMPARABLE_ACROSS_WORKFLOWS', statement: 'Shares from differently configured workflows are not comparable without a matched-instrument check.' },
    ],
    coverageDimensions: [
      'permission', 'completeness', 'eligibility', 'freshness', 'consistency', 'sample', 'parser_coverage', 'comparability',
    ],
    fixtureClasses: ['eligibility', 'missingness', 'censoring', 'boundary_dates', 'empty_eligible_cohort', 'truncation', 'counterexample'],
    renderPolicy: {
      surfaces: ['atlas', 'evidence_drawer', 'api_v2'],
      requiresDefinitionCard: true,
      requiresProhibitedInterpretations: true,
      exportSinks: ['api', 'frontend'],
      maximumDataClass: 'C1',
    },
    supersession: { supersededBy: null, supersededAt: null, reasonCode: null },
  }),
]

export function formatMetricReference(reference: MetricReference): string {
  return `${reference.metricId}@${reference.version}`
}

export function parseMetricReference(reference: string): MetricReference {
  const separator = reference.lastIndexOf('@')
  if (separator <= 0) {
    throw new MetricRegistryError(`Metric reference must be "metric_id@version": received "${reference}"`)
  }
  const parsed = MetricReferenceSchema.safeParse({
    metricId: reference.slice(0, separator),
    version: reference.slice(separator + 1),
  })
  if (!parsed.success) {
    throw new MetricRegistryError(`Metric reference is malformed: "${reference}"`)
  }
  return parsed.data
}

const registryByReference = new Map<string, MetricDefinition>(
  METRIC_REGISTRY.map((definition) => [formatMetricReference(definition), definition]),
)

if (registryByReference.size !== METRIC_REGISTRY.length) {
  throw new MetricRegistryError('The metric registry contains a duplicate metric_id@version')
}

for (const definition of METRIC_REGISTRY) {
  const successor = definition.supersession.supersededBy
  if (successor && !registryByReference.has(formatMetricReference(successor))) {
    throw new MetricRegistryError(
      `${formatMetricReference(definition)} names an unregistered successor ${formatMetricReference(successor)}`,
    )
  }
}

export function isRegisteredMetric(reference: string): boolean {
  return registryByReference.has(reference)
}

/** Fails closed: an unregistered metric_id@version can never be resolved, and so never exposed. */
export function getMetricDefinition(reference: string): MetricDefinition {
  const definition = registryByReference.get(reference)
  if (!definition) {
    throw new MetricRegistryError(`Metric ${reference} is not registered; undocumented metrics cannot be exposed`)
  }
  return definition
}

/** New results may only be computed from an active definition; supersession points at the successor. */
export function resolveMetricForComputation(reference: string): MetricDefinition {
  const definition = getMetricDefinition(reference)
  if (definition.status === 'superseded') {
    const successor = definition.supersession.supersededBy
    throw new MetricRegistryError(
      `Metric ${reference} is superseded by ${successor ? formatMetricReference(successor) : 'a newer version'}; compute against the successor`,
    )
  }
  if (definition.status === 'withdrawn') {
    throw new MetricRegistryError(`Metric ${reference} is withdrawn and cannot be computed`)
  }
  return definition
}

/**
 * Existing results pin their exact version, so a superseded definition stays renderable — the
 * successor travels with it so the surface can say which reading has replaced it. A withdrawn
 * definition renders nothing.
 */
export function resolveMetricForRendering(reference: string): {
  definition: MetricDefinition
  supersededBy: MetricReference | null
} {
  const definition = getMetricDefinition(reference)
  if (definition.status === 'withdrawn') {
    throw new MetricRegistryError(`Metric ${reference} is withdrawn and cannot be rendered`)
  }
  return { definition, supersededBy: definition.supersession.supersededBy }
}

export function listActiveMetrics(): readonly MetricDefinition[] {
  return METRIC_REGISTRY.filter((definition) => definition.status === 'active')
}

/* ------------------------------------------------------------------------------------------ *
 * Result validation and display gating
 * ------------------------------------------------------------------------------------------ */

const VALUE_KINDS_BY_FORMULA: Readonly<Record<MetricFormula['kind'], readonly MetricValue['kind'][]>> = {
  event_count: ['count', 'no_value'],
  distinct_count: ['count', 'no_value'],
  proportion_of_cohort: ['proportion', 'no_value'],
  duration_quantiles: ['quantiles', 'no_value'],
  inter_event_interval_quantiles: ['quantiles', 'no_value'],
}

/**
 * Validates a result against its pinned definition. Throws for an unregistered metric, so a V2
 * surface cannot expose a number whose definition nobody wrote down.
 */
export function validateMetricResult(candidate: unknown): {
  result: MetricResult
  definition: MetricDefinition
} {
  const parsed = MetricResultSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new MetricRegistryError(`Metric result is invalid: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`)
  }
  const result = parsed.data
  const { definition } = resolveMetricForRendering(formatMetricReference({ metricId: result.metricId, version: result.metricVersion }))

  if (!VALUE_KINDS_BY_FORMULA[definition.formula.kind].includes(result.value.kind)) {
    throw new MetricRegistryError(
      `Result value kind "${result.value.kind}" does not match the ${definition.formula.kind} formula of ${formatMetricReference(definition)}`,
    )
  }
  if (result.calculation.procedureId !== definition.formula.procedureId) {
    throw new MetricRegistryError(
      `Result names procedure "${result.calculation.procedureId}" but ${formatMetricReference(definition)} is computed by "${definition.formula.procedureId}"`,
    )
  }

  const declared = new Set<string>(definition.coverageDimensions)
  const reported = new Set(result.coverage.map((entry) => entry.dimension))
  for (const dimension of declared) {
    if (!reported.has(dimension as MetricCoverageDimension)) {
      throw new MetricRegistryError(`Result omits the declared coverage dimension "${dimension}"`)
    }
  }
  for (const dimension of reported) {
    if (!declared.has(dimension)) {
      throw new MetricRegistryError(`Result reports coverage dimension "${dimension}" that ${formatMetricReference(definition)} does not consume`)
    }
  }

  const exclusionCodes = new Set(definition.eligibility.exclusionRules.map((rule) => rule.ruleCode))
  for (const excluded of result.counts.excluded) {
    if (!exclusionCodes.has(excluded.reasonCode)) {
      throw new MetricRegistryError(`Excluded reason "${excluded.reasonCode}" is not an exclusion rule of ${formatMetricReference(definition)}`)
    }
  }

  const variantIds = new Set(definition.sensitivityVariants.map((variant) => variant.variantId))
  for (const entry of result.sensitivity) {
    if (!variantIds.has(entry.variantId)) {
      throw new MetricRegistryError(`Sensitivity variant "${entry.variantId}" is not defined by ${formatMetricReference(definition)}`)
    }
  }

  if (definition.event.censoringRule === 'no_censoring_possible' && result.counts.censored > 0) {
    throw new MetricRegistryError(`${formatMetricReference(definition)} declares that censoring is impossible, but the result reports censored units`)
  }

  return { result, definition }
}

export interface MetricDisplayEligibility {
  display: boolean
  reasonCode: string
  belowGateBehaviour: MetricDefinition['supportGates']['belowGateBehaviour'] | null
}

/**
 * Minimum-support gating applies to display eligibility only, and runs strictly AFTER the typed
 * result row exists (issue #67). A typed empty-eligible cohort is exempt: a fully covered window
 * with zero events is a complete observation, not a small sample, and the row is never erased.
 */
export function evaluateDisplayEligibility(
  definition: MetricDefinition,
  result: MetricResult,
): MetricDisplayEligibility {
  switch (result.state) {
    case 'empty_eligible_cohort':
      return { display: true, reasonCode: 'EMPTY_ELIGIBLE_COHORT_EXEMPT', belowGateBehaviour: null }
    case 'observed':
      if (result.counts.eligible < definition.supportGates.minimumEligible) {
        return {
          display: definition.supportGates.belowGateBehaviour === 'render_as_range_only',
          reasonCode: 'BELOW_MINIMUM_SUPPORT',
          belowGateBehaviour: definition.supportGates.belowGateBehaviour,
        }
      }
      return { display: true, reasonCode: 'SUPPORT_GATE_MET', belowGateBehaviour: null }
    case 'truncated':
      return {
        display: definition.missingness.truncationPolicy === 'report_with_truncation_limitation',
        reasonCode: definition.missingness.truncationPolicy === 'report_with_truncation_limitation'
          ? 'TRUNCATED_WITH_LIMITATION'
          : 'TRUNCATION_ABSTAINED',
        belowGateBehaviour: null,
      }
    case 'censored_only':
      return { display: true, reasonCode: 'CENSORED_ONLY_REPORTED', belowGateBehaviour: null }
    case 'unavailable':
    case 'coverage_failed':
      return { display: false, reasonCode: result.stateReasonCode, belowGateBehaviour: null }
  }
}

export interface ExposableMetricResult {
  result: MetricResult
  definition: MetricDefinition
  reference: string
  supersededBy: MetricReference | null
  displayEligibility: MetricDisplayEligibility
}

/**
 * The V2 exposure gate. An unregistered or withdrawn metric, a result whose value shape
 * contradicts its formula, or a sink outside the metric's render policy all fail closed here.
 */
export function assertExposableMetricResult(
  candidate: unknown,
  sink: (typeof METRIC_EXPORT_SINKS)[number],
): ExposableMetricResult {
  const { result, definition } = validateMetricResult(candidate)
  if (!definition.renderPolicy.exportSinks.includes(sink)) {
    throw new MetricRegistryError(
      `${formatMetricReference(definition)} is not exposable through the "${sink}" sink`,
    )
  }
  return {
    result,
    definition,
    reference: formatMetricReference(definition),
    supersededBy: definition.supersession.supersededBy,
    displayEligibility: evaluateDisplayEligibility(definition, result),
  }
}

/* ------------------------------------------------------------------------------------------ *
 * Definition card (demo surface)
 * ------------------------------------------------------------------------------------------ */

export interface MetricDefinitionCardSection {
  heading: string
  lines: readonly string[]
}

export interface MetricDefinitionCard {
  reference: string
  label: string
  status: MetricStatus
  supersededBy: string | null
  dataClass: typeof METRIC_DEFINITION_DATA_CLASS
  sections: readonly MetricDefinitionCardSection[]
}

/**
 * Renders the full definition card a metric must carry wherever it is shown. Every section is
 * mandatory, and "What this must never mean" is never optional or collapsed away.
 */
export function buildMetricDefinitionCard(reference: string): MetricDefinitionCard {
  const { definition, supersededBy } = resolveMetricForRendering(reference)
  return {
    reference: formatMetricReference(definition),
    label: definition.label,
    status: definition.status,
    supersededBy: supersededBy ? formatMetricReference(supersededBy) : null,
    dataClass: METRIC_DEFINITION_DATA_CLASS,
    sections: [
      { heading: 'Question answered', lines: [definition.questionAnswered] },
      {
        heading: 'Subject, unit and window',
        lines: [
          `Subject: ${definition.analyticalSubject}`,
          `Unit: ${definition.unit} (${definition.semanticCategory})`,
          `Window: ${definition.windowSemantics}, clock: ${definition.clockSource}`,
        ],
      },
      {
        heading: 'Inputs required',
        lines: [
          `Capabilities: ${definition.requiredCapabilities.join(', ')}`,
          ...definition.requiredFields.map((field) => `Field: ${field.fieldPath} (${field.dataClass}${field.nullable ? ', nullable' : ''})`),
        ],
      },
      {
        heading: 'Eligibility and cohort',
        lines: [
          definition.eligibility.statement,
          ...definition.eligibility.inclusionRules.map((rule) => `Include ${rule.ruleCode}: ${rule.statement}`),
          ...definition.eligibility.exclusionRules.map((rule) => `Exclude ${rule.ruleCode}: ${rule.statement}`),
        ],
      },
      {
        heading: 'Event and censoring',
        lines: [`${definition.event.eventCode}: ${definition.event.statement}`, `${definition.event.censoringRule}: ${definition.event.censoringStatement}`],
      },
      {
        heading: 'Missingness and truncation',
        lines: [`${definition.missingness.policy} / ${definition.missingness.truncationPolicy}`, definition.missingness.statement],
      },
      { heading: 'Formula', lines: [`${definition.formula.kind} via ${definition.formula.procedureId}`] },
      {
        heading: 'Support and comparison',
        lines: [
          `Minimum eligible for display: ${definition.supportGates.minimumEligible} (${definition.supportGates.appliesTo}; empty cohorts exempt)`,
          `Matched window required: ${definition.comparisonRequirements.requiresMatchedWindow}, minimum matched fraction ${definition.comparisonRequirements.minimumMatchedFraction}`,
          `Incomparable outcome: ${definition.comparisonRequirements.incomparableOutcome}; empty cohort outcome: ${definition.comparisonRequirements.emptyCohortOutcome}`,
        ],
      },
      {
        heading: 'Sensitivity variants',
        lines: definition.sensitivityVariants.map((variant) => `${variant.variantId}: ${variant.statement} (${variant.parameterChange})`),
      },
      {
        heading: 'Known confounders',
        lines: definition.knownConfounders.map((confounder) => `${confounder.code}: ${confounder.statement}`),
      },
      {
        heading: 'What this must never mean',
        lines: definition.prohibitedInterpretations.map((entry) => `${entry.code}: ${entry.statement}`),
      },
      { heading: 'Coverage dimensions consumed', lines: [definition.coverageDimensions.join(', ')] },
      { heading: 'Fixture classes', lines: [definition.fixtureClasses.join(', ')] },
      {
        heading: 'Render and export policy',
        lines: [
          `Surfaces: ${definition.renderPolicy.surfaces.join(', ')}`,
          `Export sinks: ${definition.renderPolicy.exportSinks.join(', ')} (maximum class ${definition.renderPolicy.maximumDataClass})`,
        ],
      },
      {
        heading: 'Supersession',
        lines: [
          supersededBy
            ? `Superseded by ${formatMetricReference(supersededBy)} at ${definition.supersession.supersededAt} (${definition.supersession.reasonCode})`
            : 'Current definition; results pin this exact version.',
        ],
      },
    ],
  }
}
