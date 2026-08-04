import { z } from 'zod'
import { CapabilityIdSchema } from './capabilities.js'
import {
  COVERAGE_DIMENSIONS,
  CoverageDimensionSchema,
  CoverageLimitingReasonSchema,
  isLimitingReasonRegistered,
  type CoverageDimension,
} from './coverage.js'

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
export const METRIC_CONTRACT_VERSION = '1.1.0' as const

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
const FieldPathSchema = z.string().regex(/^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*$/)
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/)
const StatementSchema = z.string().min(12)
const UtcTimestampSchema = z.string().datetime({ offset: true })
const NonnegativeIntegerSchema = z.number().int().nonnegative()
const UnitIntervalSchema = z.number().min(0).max(1)

/**
 * Blended-construct terms. ADR-25 forbids any metric that leans on an undocumented shared
 * "engagement/importance/activity/health/maturity/confidence" scalar, and the product boundary
 * forbids person scoring outright.
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
 * Person-identifying path segments. Applied to field paths and distinct-count keys, where a
 * person metric hides most easily: a `distinct_count` over `pullRequest.author.login` has a
 * legal subject, unit, category, and formula kind, and is caught only here.
 */
export const FORBIDDEN_PERSON_PATH_TERMS = [
  'author',
  'login',
  'user',
  'actor',
  'assignee',
  'committer',
  'reviewer',
  'requester',
  'member',
  'team',
  'email',
  'name',
  'handle',
  'avatar',
  'profile',
  'identity',
  'owner',
] as const

/**
 * Token-aware matching. Substring matching produced false rejections that would have forced
 * real metrics out of the registry — `dependency.upgrade_lag` is not a "grade", `inactivity`
 * is not `activity`, and `integrating` is not a `rating`. Identifiers split on separators and
 * camelCase humps; prose splits on word boundaries.
 */
function tokenize(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0)
}

function matchesTerm(tokens: readonly string[], term: string): boolean {
  if (!term.includes('_')) {
    return tokens.includes(term)
  }
  return `_${tokens.join('_')}_`.includes(`_${term}_`)
}

function findTerm(value: string, terms: readonly string[]): string | null {
  const tokens = tokenize(value)
  for (const term of terms) {
    if (matchesTerm(tokens, term)) {
      return term
    }
  }
  return null
}

/**
 * Returns the first forbidden term contained in `value`, or null.
 *
 * Deliberately NOT applied to `prohibitedInterpretations`, `knownConfounders`, or limitation
 * statements: those fields exist precisely so an author can write "this is not an engagement
 * signal", and scanning them would make the required warning impossible to express.
 */
export function findForbiddenConstructTerm(value: string): string | null {
  return findTerm(value, [...FORBIDDEN_CONSTRUCT_TERMS, ...FORBIDDEN_PERSON_SUBJECT_TERMS])
}

/** The construct scan plus the person-path denylist, for field paths and distinct-count keys. */
export function findForbiddenPathTerm(value: string): string | null {
  return findTerm(value, [...FORBIDDEN_PERSON_PATH_TERMS]) ?? findForbiddenConstructTerm(value)
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
 * The coverage dimension set is `shared/coverage.ts`'s v2 registry (DL-SPINE-04), not a local
 * copy. These are aliases so metric-side consumers have a stable name; the canonical list, its
 * direction registry, and its per-dimension limiting-reason registration all live there.
 *
 * A metric result carries a SUBSET vector — only the dimensions its definition declares it
 * consumes — so it uses the canonical per-dimension value shape rather than
 * `CoverageVectorV2Schema`, which requires all twelve.
 */
export const METRIC_COVERAGE_DIMENSIONS = COVERAGE_DIMENSIONS
export const MetricCoverageDimensionSchema = CoverageDimensionSchema
export type MetricCoverageDimension = CoverageDimension

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
    fieldPath: FieldPathSchema,
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
 * How a proportion's denominator relates to the reported counts. A censored unit has no
 * outcome, so counting it in the denominator would silently score "still running" as "did not
 * pass" — exactly the censoring bias this contract exists to prevent.
 */
export const METRIC_DENOMINATOR_BASES = ['eligible', 'eligible_minus_censored'] as const
export const MetricDenominatorBasisSchema = z.enum(METRIC_DENOMINATOR_BASES)
export type MetricDenominatorBasis = z.infer<typeof MetricDenominatorBasisSchema>

/**
 * Deterministic formula — a closed discriminated union.
 *
 * There is deliberately no `weighted_composite`, `blended_index`, or `scalar_rollup` member, so
 * a blended engagement/importance/activity/health/maturity/confidence scalar has no
 * representable formula and is rejected at registration.
 *
 * This closes the DECLARATION, not the implementation. `procedureId` is an opaque handle, and
 * nothing here can prove the code behind it computes what the entry claims — a procedure
 * registered as `event_count` could compute a weighted blend and this schema would not know.
 * Binding a procedure to its declared formula is DL-VALIDATE-01's conformance job.
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
      keyFieldPath: FieldPathSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('proportion_of_cohort'),
      procedureId: IdentifierSchema,
      numeratorEventCode: CodeSchema,
      denominatorCohortId: IdentifierSchema,
      denominatorBasis: MetricDenominatorBasisSchema,
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

interface ScannableDefinition {
  metricId: string
  label: string
  questionAnswered: string
  eligibility: z.infer<typeof EligibilitySchema>
  event: z.infer<typeof EventDefinitionSchema>
  missingness: z.infer<typeof MissingnessSchema>
  formula: MetricFormula
}

/** Identifier and prose fields scanned for blended and person-scoring constructs. */
function constructScanTargets(definition: ScannableDefinition): Array<readonly [string, string]> {
  const targets: Array<readonly [string, string]> = [
    ['metricId', definition.metricId],
    ['label', definition.label],
    ['questionAnswered', definition.questionAnswered],
    ['eligibility.cohortId', definition.eligibility.cohortId],
    ['eligibility.statement', definition.eligibility.statement],
    ['event.eventCode', definition.event.eventCode],
    ['event.statement', definition.event.statement],
    ['event.censoringStatement', definition.event.censoringStatement],
    ['missingness.statement', definition.missingness.statement],
    ['formula.procedureId', definition.formula.procedureId],
  ]
  definition.eligibility.inclusionRules.forEach((rule, index) => {
    targets.push([`eligibility.inclusionRules.${index}.ruleCode`, rule.ruleCode])
    targets.push([`eligibility.inclusionRules.${index}.statement`, rule.statement])
  })
  definition.eligibility.exclusionRules.forEach((rule, index) => {
    targets.push([`eligibility.exclusionRules.${index}.ruleCode`, rule.ruleCode])
    targets.push([`eligibility.exclusionRules.${index}.statement`, rule.statement])
  })
  switch (definition.formula.kind) {
    case 'event_count':
    case 'inter_event_interval_quantiles':
      targets.push(['formula.eventCode', definition.formula.eventCode])
      break
    case 'duration_quantiles':
      targets.push(['formula.startEventCode', definition.formula.startEventCode])
      targets.push(['formula.endEventCode', definition.formula.endEventCode])
      break
    case 'proportion_of_cohort':
      targets.push(['formula.numeratorEventCode', definition.formula.numeratorEventCode])
      targets.push(['formula.denominatorCohortId', definition.formula.denominatorCohortId])
      break
    case 'distinct_count':
      break
  }
  return targets
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
    for (const [field, value] of constructScanTargets(definition)) {
      const term = findForbiddenConstructTerm(value)
      if (term) {
        context.addIssue({
          code: 'custom',
          message: `Forbidden construct term "${term}" in ${field}: blended and person-scoring metrics cannot be registered`,
          path: field.split('.'),
        })
      }
    }

    definition.requiredFields.forEach((field, index) => {
      const term = findForbiddenPathTerm(field.fieldPath)
      if (term) {
        context.addIssue({
          code: 'custom',
          message: `Forbidden person-identifying path segment "${term}" in requiredFields.${index}.fieldPath`,
          path: ['requiredFields', index, 'fieldPath'],
        })
      }
    })
    if (definition.formula.kind === 'distinct_count') {
      const term = findForbiddenPathTerm(definition.formula.keyFieldPath)
      if (term) {
        context.addIssue({
          code: 'custom',
          message: `Forbidden person-identifying path segment "${term}" in formula.keyFieldPath: counting distinct people is a person metric`,
          path: ['formula', 'keyFieldPath'],
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

    if (definition.formula.kind === 'proportion_of_cohort') {
      if (definition.formula.denominatorCohortId !== definition.eligibility.cohortId) {
        context.addIssue({
          code: 'custom',
          message: 'A proportion denominator must be the metric\'s own eligibility cohort',
          path: ['formula', 'denominatorCohortId'],
        })
      }
      if (definition.event.censoringRule !== 'no_censoring_possible' && definition.formula.denominatorBasis === 'eligible') {
        context.addIssue({
          code: 'custom',
          message: 'A censorable proportion must exclude censored units from its denominator; a censored unit has no outcome to classify',
          path: ['formula', 'denominatorBasis'],
        })
      }
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
    if (definition.event.censoringRule !== 'no_censoring_possible' && !dimensions.has('censoring_freedom')) {
      context.addIssue({
        code: 'custom',
        message: 'A metric that can right-censor must consume the censoring_freedom coverage dimension',
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
 * eligible units. It is a distinct state from `unavailable`, `truncated`, `censored_only`, and
 * `coverage_failed`, so a quiet window can never be conflated with a coverage gap.
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

/**
 * The one place value-versus-state consistency is decided, applied to the result's own value AND
 * to every sensitivity entry's value against that entry's own state.
 *
 * Keeping it in one function is the point: the first version of this contract enforced these
 * rules only on the top-level value, so a sensitivity variant could carry a fabricated
 * zero-duration distribution, or a numerator larger than its denominator, and pass.
 */
function checkValueAgainstState(
  state: MetricResultState,
  value: MetricValue,
  path: Array<string | number>,
  context: z.RefinementCtx,
): void {
  if (value.kind === 'quantiles') {
    if ((value.sampleSize === 0) !== (value.quantiles === null)) {
      context.addIssue({
        code: 'custom',
        message: 'An empty sample has a null distribution; a non-empty sample has quantiles. Zero-duration values are never fabricated',
        path: [...path, 'quantiles'],
      })
    }
    if (value.quantiles) {
      const sorted = [...value.quantiles].sort((left, right) => left.quantile - right.quantile)
      const quantiles = sorted.map((entry) => entry.quantile)
      if (new Set(quantiles).size !== quantiles.length) {
        context.addIssue({ code: 'custom', message: 'Quantiles must be distinct', path: [...path, 'quantiles'] })
      }
      for (let index = 1; index < sorted.length; index += 1) {
        if (sorted[index].value < sorted[index - 1].value) {
          context.addIssue({
            code: 'custom',
            message: 'Quantile values must be non-decreasing in the quantile; a distribution cannot run backwards',
            path: [...path, 'quantiles'],
          })
          break
        }
      }
    }
  }

  if (value.kind === 'proportion' && value.numerator > value.denominator) {
    context.addIssue({
      code: 'custom',
      message: 'A proportion numerator cannot exceed its denominator',
      path: [...path, 'numerator'],
    })
  }

  switch (state) {
    case 'observed': {
      if (value.kind === 'no_value') {
        context.addIssue({ code: 'custom', message: 'An observed result carries a value', path })
      }
      break
    }
    case 'empty_eligible_cohort': {
      if (value.kind === 'count' && value.observedCount !== 0) {
        context.addIssue({ code: 'custom', message: 'An empty eligible cohort counts an observed zero', path: [...path, 'observedCount'] })
      }
      if (value.kind === 'quantiles' && (value.sampleSize !== 0 || value.quantiles !== null)) {
        context.addIssue({ code: 'custom', message: 'An empty eligible cohort has a null distribution and a zero sample', path })
      }
      if (value.kind === 'proportion') {
        context.addIssue({
          code: 'custom',
          message: 'A proportion over an empty cohort is not computable; use no_value with the empty-cohort reason code',
          path,
        })
      }
      if (value.kind === 'no_value' && value.reasonCode !== EMPTY_ELIGIBLE_COHORT_REASON_CODE) {
        context.addIssue({ code: 'custom', message: 'An empty eligible cohort names the empty-cohort reason code', path: [...path, 'reasonCode'] })
      }
      break
    }
    case 'censored_only': {
      if (value.kind !== 'no_value' || value.reasonCode !== CENSORED_ONLY_REASON_CODE) {
        context.addIssue({ code: 'custom', message: `A censored-only result carries no_value with ${CENSORED_ONLY_REASON_CODE}`, path })
      }
      break
    }
    case 'truncated': {
      /**
       * Zero is the one count indistinguishable from "could not look": under truncation a
       * reported 0 cannot be told apart from a source that stopped returning rows.
       */
      if (value.kind === 'count' && value.observedCount === 0) {
        context.addIssue({
          code: 'custom',
          message: 'A truncated result cannot report an observed zero; use no_value, or a state that says what was not seen',
          path: [...path, 'observedCount'],
        })
      }
      break
    }
    case 'unavailable':
    case 'coverage_failed': {
      if (value.kind !== 'no_value') {
        context.addIssue({ code: 'custom', message: 'An unavailable or failed result never carries a numeric value', path })
      }
      break
    }
  }
}

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

/**
 * One dimension of a result's coverage vector, in `shared/coverage.ts`'s canonical shape:
 * `{ value, limiting_reason }`, snake_case on every surface, with the limiting reason drawn
 * from the v2 closed registry and checked against the dimension that cites it.
 */
const MetricCoverageEntrySchema = z
  .object({
    dimension: MetricCoverageDimensionSchema,
    value: UnitIntervalSchema.nullable(),
    limiting_reason: CoverageLimitingReasonSchema.nullable(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.value === null && entry.limiting_reason === null) {
      context.addIssue({
        code: 'custom',
        message: 'A null dimension value must carry a limiting reason; absence is never a default',
        path: ['limiting_reason'],
      })
    }
    if (entry.limiting_reason !== null && !isLimitingReasonRegistered(entry.dimension, entry.limiting_reason)) {
      context.addIssue({
        code: 'custom',
        message: `Limiting reason ${entry.limiting_reason} is not registered for the ${entry.dimension} dimension`,
        path: ['limiting_reason'],
      })
    }
  })
export type MetricCoverageEntry = z.infer<typeof MetricCoverageEntrySchema>

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

    checkValueAgainstState(result.state, result.value, ['value'], context)
    result.sensitivity.forEach((entry, index) => {
      checkValueAgainstState(entry.state, entry.value, ['sensitivity', index, 'value'], context)
    })

    if (result.value.kind === 'count' && result.value.observedCount > 0 && result.counts.eligible === 0) {
      context.addIssue({
        code: 'custom',
        message: 'A positive observed count requires a non-empty eligible cohort',
        path: ['value', 'observedCount'],
      })
    }
    /**
     * Issue #82 (M-b): the sample is at MOST the uncensored eligible units, not exactly. A
     * competing terminal outcome (a pull request closed without merging) leaves the risk set
     * without the target event and without being right-censored, so it is counted in `eligible`
     * yet is neither censored nor in the merged-duration sample — making sampleSize strictly less
     * than eligible − censored. N−1 interval metrics undercount the same way. Only a sample that
     * EXCEEDS the uncensored eligible units is impossible, so the equality is relaxed to `<=`.
     */
    if (result.value.kind === 'quantiles' && result.value.sampleSize > result.counts.eligible - result.counts.censored) {
      context.addIssue({
        code: 'custom',
        message: 'A distribution samples exactly the eligible units that were not censored, less any that left through a competing terminal outcome such as a close without merge; a sample can never exceed the uncensored eligible units',
        path: ['value', 'sampleSize'],
      })
    }

    switch (result.state) {
      case 'observed': {
        if (result.counts.eligible === 0) {
          context.addIssue({ code: 'custom', message: 'An observed result has a non-empty eligible cohort; use empty_eligible_cohort', path: ['counts', 'eligible'] })
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
        /**
         * Complete on EVERY declared dimension, not merely completeness. A window with full
         * completeness but degraded freshness, permission, or parser coverage has not been
         * observed well enough to claim that nothing happened in it.
         */
        for (const entry of result.coverage) {
          if (entry.value !== 1 || entry.limiting_reason !== null) {
            context.addIssue({
              code: 'custom',
              message: `An empty eligible cohort is only claimable under complete coverage on every declared dimension; ${entry.dimension} is limited`,
              path: ['coverage'],
            })
            break
          }
        }
        break
      }
      case 'censored_only': {
        if (result.counts.eligible === 0 || result.counts.censored !== result.counts.eligible) {
          context.addIssue({ code: 'custom', message: 'A censored-only result has every eligible unit censored', path: ['counts'] })
        }
        break
      }
      case 'truncated': {
        const completeness = result.coverage.find((entry) => entry.dimension === 'completeness')
        if (!completeness || completeness.limiting_reason === null) {
          context.addIssue({ code: 'custom', message: 'A truncated result names a limiting reason on completeness', path: ['coverage'] })
        }
        break
      }
      case 'unavailable':
      case 'coverage_failed': {
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
    { code: 'WINDOW_LENGTH', statement: 'A short window admits fewer long-lived pull requests, so the observed tail is bounded by the window itself.' },
  ],
  prohibitedInterpretations: [
    { code: 'NOT_PERSON_MEASURE', statement: 'This is a property of a pull-request cohort and must never be read as a measure of any individual person or their productivity.' },
    { code: 'NOT_CAUSAL', statement: 'A shorter interval does not establish that any process change caused it.' },
    { code: 'NOT_QUALITY', statement: 'Integration speed says nothing about the quality or the value of what was merged.' },
    { code: 'NOT_TARGET', statement: 'This must never be used as a target, a threshold, or an input to a performance review.' },
    { code: 'NOT_COMPLETED_CASES_ONLY', statement: 'The distribution covers merged units only; the censored count is part of the reading and must be shown beside it, never dropped.' },
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
 *
 * Cohorts are RISK SETS. Membership is decided by entry into the risk set, never by the terminal
 * event: conditioning on the terminal event would make the declared right-censoring
 * unrepresentable (`censored` would be structurally zero) and would bake completed-cases
 * survivorship bias into every duration and share reading.
 */
export const METRIC_REGISTRY: readonly MetricDefinition[] = [
  defineMetric({
    ...PR_INTEGRATION_INTERVAL_SHARED,
    version: '1.0.0',
    status: 'superseded',
    label: 'Pull-request integration interval (v1)',
    questionAnswered: 'Among pull requests opened inside the window, how long did they take to reach merge?',
    requiredFields: [
      { fieldPath: 'pullRequest.createdAt', dataClass: 'C1', nullable: false },
      { fieldPath: 'pullRequest.mergedAt', dataClass: 'C1', nullable: true },
    ],
    eligibility: {
      cohortId: 'pull_request.opened_in_window',
      statement: 'Pull requests opened inside the half-open window, whether or not they have since merged.',
      inclusionRules: [
        { ruleCode: 'OPENED_IN_WINDOW', statement: 'The opening timestamp falls inside the half-open window.' },
      ],
      exclusionRules: [
        { ruleCode: 'MISSING_OPEN_TIMESTAMP', statement: 'The opening timestamp is absent, so the cohort entry point cannot be placed.' },
      ],
    },
    event: {
      eventCode: 'PULL_REQUEST_MERGED',
      statement: 'The merge event recorded by the forge. It is the terminal event of the interval and never a cohort condition.',
      censoringRule: 'right_censor_at_window_end',
      censoringStatement: 'An eligible pull request with no merge event by the window end is right-censored at the boundary and counted in the censored total.',
    },
    missingness: {
      policy: 'exclude_from_eligible_cohort',
      truncationPolicy: 'abstain_when_truncated',
      statement: 'A pull request whose cohort entry point cannot be placed leaves the eligible set under its named exclusion reason.',
    },
    formula: {
      kind: 'duration_quantiles',
      procedureId: 'pull_request.interval_quantiles_v1',
      startEventCode: 'PULL_REQUEST_OPENED',
      endEventCode: 'PULL_REQUEST_MERGED',
      quantiles: [0.5, 0.75, 0.9],
    },
    sensitivityVariants: [
      { variantId: 'EXCLUDE_LONG_TAIL', statement: 'Recompute without pull requests older than the window length.', parameterChange: 'Drop eligible units whose entry point precedes the window start.' },
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
    questionAnswered: 'Among pull requests that became ready for review inside the window, how long did they take to reach merge?',
    requiredFields: [
      { fieldPath: 'pullRequest.readyForReviewAt', dataClass: 'C1', nullable: true },
      { fieldPath: 'pullRequest.createdAt', dataClass: 'C1', nullable: false },
      { fieldPath: 'pullRequest.mergedAt', dataClass: 'C1', nullable: true },
    ],
    eligibility: {
      cohortId: 'pull_request.became_ready_in_window',
      statement: 'Pull requests whose canonical becameReadyAt fact falls inside the half-open window, whether or not they have since merged. Membership never depends on the merge.',
      inclusionRules: [
        {
          ruleCode: 'BECAME_READY_IN_WINDOW',
          statement: 'The canonical becameReadyAt fact — readyForReviewAt when the pull request left draft, otherwise createdAt — falls inside the half-open window.',
        },
      ],
      exclusionRules: [
        { ruleCode: 'BECAME_READY_OUTSIDE_WINDOW', statement: 'The becameReadyAt fact falls outside the half-open window, so the unit belongs to another window.' },
        { ruleCode: 'MISSING_CREATION_TIMESTAMP', statement: 'Neither a draft transition nor a creation timestamp is recorded, so becameReadyAt cannot be derived.' },
      ],
    },
    event: {
      eventCode: 'PULL_REQUEST_MERGED',
      statement: 'The merge event recorded by the forge. It is the terminal event of the interval and never a cohort condition.',
      censoringRule: 'right_censor_at_window_end',
      censoringStatement: 'An eligible pull request with no merge event by the window end is right-censored at the boundary and counted in the censored total, never dropped and never treated as merged. A pull request closed without merging leaves the risk set through a competing terminal outcome (issue #82): it stays in the eligible count, is excluded from the merged-duration sample, and is never right-censored, so the sampled distribution covers at most the uncensored eligible units and may cover fewer.',
    },
    missingness: {
      policy: 'exclude_from_eligible_cohort',
      truncationPolicy: 'report_with_truncation_limitation',
      statement: 'A pull request whose becameReadyAt fact cannot be derived leaves the cohort under a named exclusion reason; no timestamp is ever imputed.',
    },
    formula: {
      kind: 'duration_quantiles',
      procedureId: 'pull_request.interval_quantiles_v2',
      startEventCode: 'PULL_REQUEST_BECAME_READY',
      endEventCode: 'PULL_REQUEST_MERGED',
      quantiles: [0.5, 0.75, 0.9],
    },
    sensitivityVariants: [
      { variantId: 'EXCLUDE_LONG_TAIL', statement: 'Recompute without pull requests whose entry point precedes the window.', parameterChange: 'Drop eligible units whose becameReadyAt fact precedes the window start.' },
      {
        variantId: 'OPEN_TREATED_AS_CENSORED',
        statement: 'Recompute with the right-censored units included at their observed lower bound instead of omitted from the distribution.',
        parameterChange: 'Add each censored unit at the window end minus its becameReadyAt fact, rather than restricting the sample to merged units.',
      },
    ],
    fixtureClasses: ['eligibility', 'missingness', 'censoring', 'boundary_dates', 'empty_eligible_cohort', 'truncation', 'sensitivity_variant', 'version_supersession'],
    supersession: { supersededBy: null, supersededAt: null, reasonCode: null },
  }),
  defineMetric({
    metricId: 'pull_request.ready_event_count',
    version: '1.0.0',
    status: 'active',
    label: 'Pull requests that became ready for review',
    questionAnswered: 'How many pull requests became ready for review inside the window?',
    analyticalSubject: 'pull_request_cohort',
    unit: 'count_of_distinct',
    semanticCategory: 'event_count',
    windowSemantics: 'half_open_utc_window',
    clockSource: 'injected_as_of',
    requiredCapabilities: ['github.core'],
    requiredFields: [
      { fieldPath: 'pullRequest.opaqueId', dataClass: 'C1', nullable: false },
      { fieldPath: 'pullRequest.readyForReviewAt', dataClass: 'C1', nullable: true },
      { fieldPath: 'pullRequest.createdAt', dataClass: 'C1', nullable: false },
    ],
    eligibility: {
      cohortId: 'pull_request.became_ready_in_window',
      statement: 'Pull requests whose canonical becameReadyAt fact falls inside the half-open window. A repository that never uses drafts still has a populated cohort, because a pull request opened outside draft becomes ready at creation.',
      inclusionRules: [
        {
          ruleCode: 'BECAME_READY_IN_WINDOW',
          statement: 'The canonical becameReadyAt fact — readyForReviewAt when present, otherwise createdAt — falls inside the half-open window.',
        },
      ],
      exclusionRules: [
        { ruleCode: 'BECAME_READY_OUTSIDE_WINDOW', statement: 'The becameReadyAt fact falls outside the half-open window, so the unit belongs to another window.' },
        { ruleCode: 'MISSING_CREATION_TIMESTAMP', statement: 'Neither a draft transition nor a creation timestamp is recorded, so becameReadyAt cannot be derived.' },
      ],
    },
    event: {
      eventCode: 'PULL_REQUEST_BECAME_READY',
      statement: 'A pull request entering the ready-for-review state: the draft transition where one exists, and creation where the pull request was never a draft.',
      censoringRule: 'no_censoring_possible',
      censoringStatement: 'A point fact inside a completed window cannot be censored; only coverage can be missing, and that is a different state.',
    },
    missingness: {
      policy: 'exclude_from_eligible_cohort',
      truncationPolicy: 'report_with_truncation_limitation',
      statement: 'A pull request with no derivable becameReadyAt fact is excluded under a named reason and never counted as a zero.',
    },
    formula: {
      kind: 'distinct_count',
      procedureId: 'pull_request.ready_count_v1',
      keyFieldPath: 'pullRequest.opaqueId',
    },
    supportGates: {
      minimumEligible: 3,
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
      { variantId: 'DRAFT_TRANSITION_ONLY', statement: 'Recompute counting only pull requests that actually left draft.', parameterChange: 'Drop the createdAt fallback from the becameReadyAt rule.' },
    ],
    knownConfounders: [
      { code: 'RELEASE_FREEZE', statement: 'A release freeze suppresses these transitions without any change in intent.' },
      { code: 'HOLIDAY_PERIOD', statement: 'A holiday period produces genuinely quiet windows that are complete, not missing.' },
      {
        code: 'DRAFT_WORKFLOW_ADOPTION',
        statement: 'Adopting or abandoning the draft workflow moves where becameReadyAt falls without changing how much work was proposed, so counts spanning such a change are not comparable.',
      },
      {
        code: 'TEAM_SIZE_ONE',
        statement: 'A single-maintainer repository often skips the draft step entirely, so its counts reflect a different workflow rather than a different amount of work.',
      },
    ],
    prohibitedInterpretations: [
      { code: 'NOT_PERSON_MEASURE', statement: 'A count of pull requests must never be attributed to, or read as a measure of, any individual person.' },
      { code: 'NOT_OUTPUT', statement: 'This counts pull requests entering review, not delivered value or effort spent.' },
      { code: 'ZERO_IS_NOT_ABSENCE', statement: 'A complete window with zero eligible pull requests is an observed quiet period; it is not missing data and must not be rendered as one.' },
      { code: 'NOT_COMPARABLE_ACROSS_WORKFLOWS', statement: 'Counts spanning a change in draft-workflow adoption are not comparable, because the cohort entry point moved.' },
    ],
    coverageDimensions: ['permission', 'completeness', 'eligibility', 'freshness', 'sample', 'comparability'],
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
    questionAnswered: 'Among check-run series whose first attempt started inside the window, what share of the concluded first attempts passed?',
    analyticalSubject: 'check_run_cohort',
    unit: 'proportion',
    semanticCategory: 'proportion_of_cohort',
    windowSemantics: 'half_open_utc_window',
    clockSource: 'injected_as_of',
    requiredCapabilities: ['cap.github.actions'],
    requiredFields: [
      { fieldPath: 'checkRun.startedAt', dataClass: 'C3', nullable: false },
      { fieldPath: 'checkRun.attemptNumber', dataClass: 'C3', nullable: false },
      { fieldPath: 'checkRun.conclusion', dataClass: 'C3', nullable: true },
      { fieldPath: 'checkRun.completedAt', dataClass: 'C3', nullable: true },
    ],
    eligibility: {
      cohortId: 'check_run.first_attempt_started_in_window',
      statement: 'Check-run series whose first attempt started inside the half-open window, whether or not that attempt has concluded.',
      inclusionRules: [
        { ruleCode: 'FIRST_ATTEMPT_STARTED_IN_WINDOW', statement: 'The start timestamp of the first attempt falls inside the half-open window.' },
      ],
      exclusionRules: [
        { ruleCode: 'CANCELLED_BEFORE_CONCLUSION', statement: 'The series was cancelled before reaching any conclusion, so no outcome exists to classify.' },
        { ruleCode: 'MISSING_CONCLUSION', statement: 'No conclusion field was recorded for a first attempt that did finish.' },
      ],
    },
    event: {
      eventCode: 'CHECK_RUN_FIRST_ATTEMPT_CONCLUDED',
      statement: 'The conclusion of the first attempt of a check-run series. It is the outcome event and never a cohort condition.',
      censoringRule: 'right_censor_at_window_end',
      censoringStatement: 'A series whose first attempt is still running at the window end is right-censored, counted in the censored total, and left out of the denominator — never scored as a failure.',
    },
    missingness: {
      policy: 'retain_as_unknown_and_report',
      truncationPolicy: 'abstain_when_truncated',
      statement: 'A series with no recorded conclusion is retained as unknown and reported, never folded into the failing side of the share.',
    },
    formula: {
      kind: 'proportion_of_cohort',
      procedureId: 'check_run.first_attempt_pass_share_v1',
      numeratorEventCode: 'CHECK_RUN_FIRST_ATTEMPT_PASSED',
      denominatorCohortId: 'check_run.first_attempt_started_in_window',
      denominatorBasis: 'eligible_minus_censored',
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
      {
        // Issue #82 (M-a): the eligible_minus_censored denominator is unbiased only under
        // non-informative censoring. This worst-case variant bounds the share against the
        // possibility that every still-running first attempt would have failed.
        variantId: 'WORST_CASE_CENSORED_ALL_FAIL',
        statement: 'Recompute a worst-case lower bound on the share by assuming every right-censored first attempt would have concluded as a failure.',
        parameterChange: 'Add the censored count back into the denominator and leave the numerator unchanged, so the reported share becomes the smallest value the still-running attempts could resolve to.',
      },
    ],
    knownConfounders: [
      { code: 'FLAKY_INFRASTRUCTURE', statement: 'Infrastructure flakiness moves the share without any change in the code under test.' },
      { code: 'WORKFLOW_REDEFINITION', statement: 'A redefined workflow changes what a first attempt even means across the window boundary.' },
      {
        // Issue #82 (M-a): CI censoring is informative, not missing at random — a longer-running
        // first attempt is likelier to fail — so dropping the still-running units from the
        // denominator biases the share upward. Surfaced here so the reading never reads as clean.
        code: 'CENSORED_NOT_MISSING_AT_RANDOM',
        statement: 'Right-censored first attempts are not missing at random: a longer-running attempt is likelier to fail, so excluding the still-running units from the denominator biases the share upward. The eligible_minus_censored denominator is unbiased only under non-informative censoring, which check-run timing violates.',
      },
    ],
    prohibitedInterpretations: [
      { code: 'NOT_PERSON_MEASURE', statement: 'A pass share is a property of a check-run cohort and must never be attributed to any individual person.' },
      { code: 'NOT_CODE_QUALITY', statement: 'A pass share measures the configured checks, not the correctness of the code.' },
      { code: 'NOT_COMPARABLE_ACROSS_WORKFLOWS', statement: 'Shares from differently configured workflows are not comparable without a matched-instrument check.' },
    ],
    coverageDimensions: [
      'permission', 'completeness', 'eligibility', 'freshness', 'censoring_freedom', 'consistency', 'sample', 'parser_coverage', 'comparability',
    ],
    fixtureClasses: ['eligibility', 'missingness', 'censoring', 'boundary_dates', 'empty_eligible_cohort', 'truncation', 'sensitivity_variant', 'counterexample'],
    renderPolicy: {
      surfaces: ['atlas', 'evidence_drawer', 'api_v2'],
      requiresDefinitionCard: true,
      requiresProhibitedInterpretations: true,
      exportSinks: ['api', 'frontend'],
      maximumDataClass: 'C1',
    },
    supersession: { supersededBy: null, supersededAt: null, reasonCode: null },
  }),
  /**
   * A REAL registered withdrawn definition (PR #88 review fold-in, item 5a). It exists so the
   * finding contract's withdrawn-metric gate can be exercised against a genuinely
   * registered-but-withdrawn metric rather than a test double: `isRegisteredMetric` returns true
   * for it, yet `resolveMetricForRendering` throws because a withdrawn definition renders nothing.
   * It is a fully specified, schema-valid, product-boundary-safe definition; it was withdrawn
   * precisely for a construct-validity flaw — its cohort conditioned on the terminal merge event,
   * which structurally erased right-censoring — with no successor version to route to.
   */
  defineMetric({
    metricId: 'pull_request.merged_pull_request_count',
    version: '1.0.0',
    status: 'withdrawn',
    label: 'Merged pull requests (withdrawn)',
    questionAnswered: 'How many pull requests merged inside the window? Withdrawn: the cohort conditioned on the terminal merge event, which structurally erased right-censoring.',
    analyticalSubject: 'pull_request_cohort',
    unit: 'count_of_distinct',
    semanticCategory: 'event_count',
    windowSemantics: 'half_open_utc_window',
    clockSource: 'injected_as_of',
    requiredCapabilities: ['github.core'],
    requiredFields: [
      { fieldPath: 'pullRequest.opaqueId', dataClass: 'C1', nullable: false },
      { fieldPath: 'pullRequest.mergedAt', dataClass: 'C1', nullable: true },
    ],
    eligibility: {
      cohortId: 'pull_request.merged_in_window',
      statement: 'Pull requests whose merge event fell inside the half-open window. Withdrawn: conditioning cohort membership on the terminal merge event made right-censoring unrepresentable.',
      inclusionRules: [
        { ruleCode: 'MERGED_IN_WINDOW', statement: 'The merge event falls inside the half-open window.' },
      ],
      exclusionRules: [
        { ruleCode: 'MISSING_MERGE_TIMESTAMP', statement: 'No merge timestamp is recorded, so the cohort entry point cannot be placed.' },
      ],
    },
    event: {
      eventCode: 'PULL_REQUEST_MERGED',
      statement: 'The merge event recorded by the forge.',
      censoringRule: 'no_censoring_possible',
      censoringStatement: 'A point fact inside a completed window cannot be censored; only coverage can be missing, and that is a different state.',
    },
    missingness: {
      policy: 'exclude_from_eligible_cohort',
      truncationPolicy: 'report_with_truncation_limitation',
      statement: 'A pull request without a merge timestamp is excluded under its named reason and never counted as a zero.',
    },
    formula: {
      kind: 'distinct_count',
      procedureId: 'pull_request.merged_count_v1',
      keyFieldPath: 'pullRequest.opaqueId',
    },
    supportGates: {
      minimumEligible: 3,
      appliesTo: 'display_eligibility',
      emptyCohortExempt: true,
      belowGateBehaviour: 'suppress_display',
    },
    comparisonRequirements: {
      requiresMatchedWindow: false,
      minimumMatchedFraction: 0,
      incomparableOutcome: 'explicit_no_comparison',
      emptyCohortOutcome: 'explicit_empty_outcome',
    },
    sensitivityVariants: [
      { variantId: 'EXCLUDE_AUTOMATED_MERGES', statement: 'Recompute excluding automated merges.', parameterChange: 'Add an automation exclusion rule to the cohort.' },
    ],
    knownConfounders: [
      { code: 'MERGE_QUEUE_BATCHING', statement: 'A merge queue batches merges, clustering the count without any change in how much work was proposed.' },
    ],
    prohibitedInterpretations: [
      { code: 'NOT_PERSON_MEASURE', statement: 'A count of merged pull requests is a cohort property and must never be attributed to any individual person.' },
      { code: 'NOT_OUTPUT', statement: 'A merge count is not a measure of delivered value or of effort spent.' },
    ],
    coverageDimensions: ['completeness', 'eligibility', 'sample'],
    fixtureClasses: ['eligibility', 'missingness', 'censoring', 'boundary_dates', 'empty_eligible_cohort'],
    renderPolicy: {
      surfaces: ['atlas'],
      requiresDefinitionCard: true,
      requiresProhibitedInterpretations: true,
      exportSinks: ['api'],
      maximumDataClass: 'C1',
    },
    supersession: { supersededBy: null, supersededAt: null, reasonCode: 'COHORT_CONDITIONED_ON_TERMINAL_EVENT' },
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

/**
 * At most one ACTIVE version per metric id. Two active versions would leave "which definition
 * does a new result use?" undecidable, and because results pin exact versions the ambiguity
 * would be invisible downstream.
 */
const activeByMetricId = new Map<string, MetricDefinition>()
for (const definition of METRIC_REGISTRY) {
  if (definition.status !== 'active') {
    continue
  }
  const existing = activeByMetricId.get(definition.metricId)
  if (existing) {
    throw new MetricRegistryError(
      `Metric ${definition.metricId} has two active versions (${existing.version} and ${definition.version}); exactly one may be active`,
    )
  }
  activeByMetricId.set(definition.metricId, definition)
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

/** The single active definition for a metric id. */
export function resolveLatestActive(metricId: string): MetricDefinition {
  const definition = activeByMetricId.get(metricId)
  if (!definition) {
    throw new MetricRegistryError(`Metric ${metricId} has no active version`)
  }
  return definition
}

/** New results may only be computed from an active definition; supersession names the successor. */
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

  /** The reported distribution must answer the quantiles the definition declares — no more, no fewer. */
  if ('quantiles' in definition.formula && result.value.kind === 'quantiles' && result.value.quantiles) {
    const declaredQuantiles = [...definition.formula.quantiles].sort()
    const reportedQuantiles = result.value.quantiles.map((entry) => entry.quantile).sort()
    if (declaredQuantiles.join(',') !== reportedQuantiles.join(',')) {
      throw new MetricRegistryError(
        `Result reports quantiles [${reportedQuantiles.join(', ')}] but ${formatMetricReference(definition)} declares [${declaredQuantiles.join(', ')}]`,
      )
    }
  }

  /**
   * The declared denominator relation, checked against the reported counts. A sensitivity
   * variant may legitimately redefine the denominator, so this binds the top-level value only.
   */
  if (definition.formula.kind === 'proportion_of_cohort' && result.value.kind === 'proportion') {
    const expected = definition.formula.denominatorBasis === 'eligible'
      ? result.counts.eligible
      : result.counts.eligible - result.counts.censored
    if (result.value.denominator !== expected) {
      throw new MetricRegistryError(
        `Result denominator ${result.value.denominator} contradicts the declared ${definition.formula.denominatorBasis} basis (expected ${expected})`,
      )
    }
  }

  return { result, definition }
}

export interface MetricDisplayEligibility {
  display: boolean
  reasonCode: string
  belowGateBehaviour: MetricDefinition['supportGates']['belowGateBehaviour'] | null
}

/**
 * The number a support gate must actually gate, per value kind. Gating a quantile distribution
 * on the eligible count would let three quantiles drawn from a single observation pass a gate of
 * five, and gating a proportion on the eligible count would ignore that censored units are not
 * in its denominator.
 */
function supportUnits(result: MetricResult): number | null {
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
    case 'observed': {
      const measured = supportUnits(result)
      if (measured !== null && measured < definition.supportGates.minimumEligible) {
        return {
          display: definition.supportGates.belowGateBehaviour === 'render_as_range_only',
          reasonCode: 'BELOW_MINIMUM_SUPPORT',
          belowGateBehaviour: definition.supportGates.belowGateBehaviour,
        }
      }
      return { display: true, reasonCode: 'SUPPORT_GATE_MET', belowGateBehaviour: null }
    }
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
          `Minimum support for display: ${definition.supportGates.minimumEligible} (${definition.supportGates.appliesTo}; empty cohorts exempt)`,
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
