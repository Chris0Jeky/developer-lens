import { describe, expect, it } from 'vitest'
import { CAPABILITY_IDS } from './capabilities.js'
import { COVERAGE_DIMENSIONS } from './coverage.js'
import {
  EMPTY_ELIGIBLE_COHORT_REASON_CODE,
  METRIC_ANALYTICAL_SUBJECTS,
  METRIC_CONTRACT_VERSION,
  METRIC_COVERAGE_DIMENSIONS,
  METRIC_DEFINITION_DATA_CLASS,
  METRIC_REGISTRY,
  METRIC_RESULT_STATES,
  METRIC_SEMANTIC_CATEGORIES,
  METRIC_UNITS,
  MetricDefinitionSchema,
  MetricRegistryError,
  MetricResultSchema,
  assertExposableMetricResult,
  buildMetricDefinitionCard,
  evaluateDisplayEligibility,
  findForbiddenConstructTerm,
  findForbiddenPathTerm,
  formatMetricReference,
  getMetricDefinition,
  isRegisteredMetric,
  listActiveMetrics,
  parseMetricReference,
  resolveLatestActive,
  resolveMetricForComputation,
  resolveMetricForRendering,
  validateMetricResult,
} from './metrics.js'
import {
  BACKWARDS_SUPERSESSION_FIXTURE,
  BLENDED_SCALAR_DEFINITION_FIXTURE,
  BOUNDARY_EVENT_AT_WINDOW_END_RESULT,
  CENSORED_IN_DENOMINATOR_RESULT,
  CENSORED_ONLY_RESULT,
  COVERAGE_FAILED_RESULT,
  EMPTY_COHORT_BEFORE_WINDOW_END_RESULT,
  EMPTY_COHORT_UNDER_PARTIAL_COVERAGE_RESULT,
  EMPTY_COHORT_UNDER_PARTIAL_PERMISSION_RESULT,
  EMPTY_COHORT_UNDER_STALE_FRESHNESS_RESULT,
  EMPTY_ELIGIBLE_COHORT_COUNT_RESULT,
  EMPTY_ELIGIBLE_COHORT_DISTRIBUTION_RESULT,
  EMPTY_ELIGIBLE_COHORT_SHARE_RESULT,
  FABRICATED_ZERO_DURATION_RESULT,
  FABRICATED_ZERO_SHARE_RESULT,
  LOW_SUPPORT_OBSERVED_RESULT,
  LOW_SUPPORT_SHARE_RESULT,
  MISSING_COVERAGE_DIMENSION_RESULT,
  NON_MONOTONE_QUANTILES_RESULT,
  NUMERATOR_EXCEEDS_DENOMINATOR_RESULT,
  OBSERVED_INTERVAL_RESULT,
  OBSERVED_SHARE_RESULT,
  PERSON_KEYED_DISTINCT_COUNT_FIXTURE,
  PERSON_SCORING_IDENTIFIER_FIXTURE,
  REGISTERABLE_DEFINITION_FIXTURE,
  SAMPLE_EXCEEDS_UNCENSORED_RESULT,
  SENSITIVITY_FABRICATED_ZERO_RESULT,
  STRUCTURALLY_INCOMPLETE_DEFINITION_FIXTURE,
  SUPERSEDED_PINNED_RESULT,
  TERMINAL_EVENT_COHORT_FIXTURE,
  THREE_QUANTILES_FROM_ONE_OBSERVATION_RESULT,
  TRUNCATED_RESULT,
  TRUNCATED_ZERO_COUNT_RESULT,
  UNAVAILABLE_RESULT,
  UNDECLARED_EXCLUSION_REASON_RESULT,
  UNDECLARED_QUANTILE_SET_RESULT,
  UNDERSPECIFIED_DEFINITION_FIXTURE,
  UNREGISTERED_METRIC_RESULT,
  UPGRADE_LAG_DEFINITION_FIXTURE,
  VALUE_SHAPE_MISMATCH_RESULT,
  X_CLASS_FIELD_DEFINITION_FIXTURE,
  ZERO_LENGTH_WINDOW_RESULT,
} from './metricFixtures.js'

const INTERVAL_V1 = 'pull_request.integration_interval@1.0.0'
const INTERVAL_V2 = 'pull_request.integration_interval@1.1.0'
const READY_COUNT = 'pull_request.ready_event_count@1.0.0'
const PASS_SHARE = 'check_run.first_attempt_pass_share@1.0.0'

function issuePaths(candidate: unknown): string[] {
  const parsed = MetricDefinitionSchema.safeParse(candidate)
  expect(parsed.success).toBe(false)
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join('.'))
}

function resultIssues(candidate: unknown): Array<{ path: string; message: string }> {
  const parsed = MetricResultSchema.safeParse(candidate)
  expect(parsed.success).toBe(false)
  return parsed.success ? [] : parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
}

function resultMessages(candidate: unknown): string {
  return resultIssues(candidate).map((issue) => issue.message).join(' | ')
}

describe('DL-METRIC-01 registry contract', () => {
  it('registers only closed, fully specified, C1 definitions', () => {
    expect(METRIC_CONTRACT_VERSION).toBe('1.1.0')
    expect(METRIC_DEFINITION_DATA_CLASS).toBe('C1')
    expect(METRIC_REGISTRY.length).toBeGreaterThan(0)
    for (const definition of METRIC_REGISTRY) {
      expect(MetricDefinitionSchema.safeParse(definition).success, formatMetricReference(definition)).toBe(true)
      expect(definition.prohibitedInterpretations.length, formatMetricReference(definition)).toBeGreaterThan(0)
      expect(definition.clockSource).toBe('injected_as_of')
      expect(definition.renderPolicy.exportSinks).not.toContain('public')
      for (const capability of definition.requiredCapabilities) {
        expect(CAPABILITY_IDS).toContain(capability)
      }
      for (const field of definition.requiredFields) {
        expect(field.dataClass).not.toBe('X')
        expect(findForbiddenPathTerm(field.fieldPath), field.fieldPath).toBeNull()
      }
      for (const dimension of definition.coverageDimensions) {
        expect(COVERAGE_DIMENSIONS).toContain(dimension)
      }
    }
  })

  it('takes its coverage dimensions from the shared v2 registry rather than a local copy', () => {
    expect(METRIC_COVERAGE_DIMENSIONS).toBe(COVERAGE_DIMENSIONS)
    expect([...METRIC_COVERAGE_DIMENSIONS]).toHaveLength(12)
  })

  it('rejects hostile names and accepts legitimate ones that merely contain a forbidden substring', () => {
    expect(findForbiddenConstructTerm('contributor_health_score')).toBe('health')
    expect(findForbiddenConstructTerm('team.engagement_index')).toBe('engagement')
    expect(findForbiddenConstructTerm('repository.developer_activity_rollup')).toBe('activity')
    expect(findForbiddenPathTerm('pullRequest.author.login')).toBe('author')
    expect(findForbiddenPathTerm('checkRun.startedAt')).toBeNull()

    // Token matching, not substring matching.
    expect(findForbiddenConstructTerm('dependency.upgrade_lag')).toBeNull()
    expect(findForbiddenConstructTerm('window.inactivity_span')).toBeNull()
    expect(findForbiddenConstructTerm('pull_request.integrating_window')).toBeNull()
    expect(MetricDefinitionSchema.safeParse(UPGRADE_LAG_DEFINITION_FIXTURE).success).toBe(true)

    for (const member of [...METRIC_ANALYTICAL_SUBJECTS, ...METRIC_UNITS, ...METRIC_SEMANTIC_CATEGORIES]) {
      expect(findForbiddenConstructTerm(member), member).toBeNull()
    }
  })

  it('accepts a well-formed unregistered definition and rejects the underspecified one on schema', () => {
    expect(MetricDefinitionSchema.safeParse(REGISTERABLE_DEFINITION_FIXTURE).success).toBe(true)
    expect(issuePaths(UNDERSPECIFIED_DEFINITION_FIXTURE)).toContain('prohibitedInterpretations')

    const structural = issuePaths(STRUCTURALLY_INCOMPLETE_DEFINITION_FIXTURE)
    expect(structural).toContain('event.censoringRule')
    expect(structural).toContain('coverageDimensions')
    expect(structural).toContain('fixtureClasses')
  })

  it('schema-rejects blended, person-scoring, X-class and backwards-superseding registrations', () => {
    expect(issuePaths(BLENDED_SCALAR_DEFINITION_FIXTURE)).toEqual(
      expect.arrayContaining(['analyticalSubject', 'unit', 'semanticCategory']),
    )
    expect(issuePaths(PERSON_SCORING_IDENTIFIER_FIXTURE)).toEqual(expect.arrayContaining(['metricId', 'label']))
    expect(issuePaths(X_CLASS_FIELD_DEFINITION_FIXTURE)).toContain('requiredFields.0.dataClass')
    expect(issuePaths(BACKWARDS_SUPERSESSION_FIXTURE)).toContain('supersession.supersededBy.version')
  })

  it('catches the person metric whose declared enums are all legal', () => {
    // subject, unit, category and formula kind are every one of them legitimate; the metric
    // counts distinct people, and only the key-path scan can tell.
    const parsed = MetricDefinitionSchema.safeParse(PERSON_KEYED_DISTINCT_COUNT_FIXTURE)
    expect(parsed.success).toBe(false)
    expect(issuePaths(PERSON_KEYED_DISTINCT_COUNT_FIXTURE)).toContain('formula.keyFieldPath')
  })

  it('refuses a metric whose declared unit or category contradicts its formula', () => {
    const mismatched = { ...(REGISTERABLE_DEFINITION_FIXTURE as Record<string, unknown>), unit: 'event_count' }
    expect(issuePaths(mismatched)).toContain('unit')
    const miscategorised = { ...(REGISTERABLE_DEFINITION_FIXTURE as Record<string, unknown>), semanticCategory: 'event_count' }
    expect(issuePaths(miscategorised)).toContain('semanticCategory')
  })

  it('lets a definition name the readings it forbids without tripping the construct scan', () => {
    const definition = getMetricDefinition(READY_COUNT)
    const statements = definition.prohibitedInterpretations.map((entry) => entry.statement).join(' ')
    expect(statements).toContain('individual person')
    expect(findForbiddenConstructTerm(statements)).not.toBeNull()
    expect(MetricDefinitionSchema.safeParse(definition).success).toBe(true)

    // The exemption is load-bearing: naming the forbidden readings must stay possible.
    const warnsExplicitly = {
      ...(REGISTERABLE_DEFINITION_FIXTURE as Record<string, unknown>),
      knownConfounders: [
        { code: 'PERCEIVED_ENGAGEMENT', statement: 'Readers often mistake this for an engagement signal; it is not one.' },
      ],
      prohibitedInterpretations: [
        { code: 'NOT_PRODUCTIVITY', statement: 'This must never be read as a measure of productivity, performance, or individual output.' },
      ],
    }
    expect(MetricDefinitionSchema.safeParse(warnsExplicitly).success).toBe(true)
  })
})

describe('DL-METRIC-01 risk-set cohorts', () => {
  it('never conditions cohort membership on the terminal event', () => {
    for (const reference of [INTERVAL_V1, INTERVAL_V2, PASS_SHARE]) {
      const definition = getMetricDefinition(reference)
      const inclusionCodes = definition.eligibility.inclusionRules.map((rule) => rule.ruleCode)
      expect(inclusionCodes, reference).not.toContain(definition.event.eventCode)
      for (const rule of definition.eligibility.inclusionRules) {
        expect(rule.statement.toLowerCase(), `${reference} ${rule.ruleCode}`).not.toContain('merge')
      }
      expect(definition.event.censoringRule, reference).not.toBe('no_censoring_possible')
    }
  })

  it('lets right-censoring actually happen, so the declared censoring rule is exercisable', () => {
    const observed = validateMetricResult(OBSERVED_INTERVAL_RESULT).result
    expect(observed.counts.eligible).toBe(14)
    expect(observed.counts.censored).toBe(2)
    // The distribution is the uncensored remainder, and the censored count travels with it.
    expect(observed.value).toMatchObject({ kind: 'quantiles', sampleSize: 12 })
    expect(validateMetricResult(CENSORED_ONLY_RESULT).result.counts.censored).toBe(4)
  })

  it('derives the pull-request cohort start from a canonical fact that non-draft repositories also have', () => {
    for (const reference of [INTERVAL_V2, READY_COUNT]) {
      const definition = getMetricDefinition(reference)
      const rule = definition.eligibility.inclusionRules[0]
      expect(rule.ruleCode, reference).toBe('BECAME_READY_IN_WINDOW')
      expect(rule.statement, reference).toContain('createdAt')
      expect(definition.eligibility.exclusionRules.map((entry) => entry.ruleCode), reference)
        .not.toContain('NEVER_READY_FOR_REVIEW')
    }

    const count = getMetricDefinition(READY_COUNT)
    expect(count.eligibility.statement).toContain('never uses drafts')
    expect(count.formula.kind).toBe('distinct_count')
    expect(count.unit).toBe('count_of_distinct')
    expect(count.knownConfounders.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(['DRAFT_WORKFLOW_ADOPTION', 'TEAM_SIZE_ONE']),
    )
  })

  it('refuses a censorable proportion that counts censored units in its denominator', () => {
    expect(issuePaths(TERMINAL_EVENT_COHORT_FIXTURE)).toContain('formula.denominatorBasis')
    expect(getMetricDefinition(PASS_SHARE).formula).toMatchObject({ denominatorBasis: 'eligible_minus_censored' })
    expect(() => validateMetricResult(CENSORED_IN_DENOMINATOR_RESULT)).toThrow(/contradicts the declared eligible_minus_censored basis/)
  })
})

describe('DL-METRIC-01 lookup and supersession', () => {
  it('fails closed for an unregistered metric', () => {
    expect(isRegisteredMetric(READY_COUNT)).toBe(true)
    expect(isRegisteredMetric('pull_request.vibe_check@1.0.0')).toBe(false)
    expect(() => getMetricDefinition('pull_request.vibe_check@1.0.0')).toThrow(MetricRegistryError)
    expect(() => getMetricDefinition('pull_request.integration_interval@9.9.9')).toThrow(/not registered/)
  })

  it('parses and formats metric references and refuses malformed ones', () => {
    expect(parseMetricReference(INTERVAL_V2)).toEqual({ metricId: 'pull_request.integration_interval', version: '1.1.0' })
    expect(formatMetricReference({ metricId: 'pull_request.integration_interval', version: '1.1.0' })).toBe(INTERVAL_V2)
    expect(() => parseMetricReference('pull_request.integration_interval')).toThrow(MetricRegistryError)
    expect(() => parseMetricReference('@1.0.0')).toThrow(MetricRegistryError)
    expect(() => parseMetricReference('pull_request.integration_interval@one')).toThrow(MetricRegistryError)
  })

  it('keeps exactly one active version per metric id and resolves it by name', () => {
    const activeIds = listActiveMetrics().map((definition) => definition.metricId)
    expect(new Set(activeIds).size).toBe(activeIds.length)
    expect(resolveLatestActive('pull_request.integration_interval').version).toBe('1.1.0')
    expect(() => resolveLatestActive('pull_request.vibe_check')).toThrow(/no active version/)
  })

  it('routes new computation to the successor while keeping the pinned version renderable', () => {
    expect(getMetricDefinition(INTERVAL_V1).status).toBe('superseded')
    expect(() => resolveMetricForComputation(INTERVAL_V1)).toThrow(/superseded by pull_request.integration_interval@1\.1\.0/)
    expect(resolveMetricForComputation(INTERVAL_V2).version).toBe('1.1.0')

    const rendered = resolveMetricForRendering(INTERVAL_V1)
    expect(rendered.definition.version).toBe('1.0.0')
    expect(rendered.supersededBy).toEqual({ metricId: 'pull_request.integration_interval', version: '1.1.0' })
    expect(listActiveMetrics().map((definition) => formatMetricReference(definition))).not.toContain(INTERVAL_V1)

    const { result, definition } = validateMetricResult(SUPERSEDED_PINNED_RESULT)
    expect(result.metricVersion).toBe('1.0.0')
    expect(definition.formula.procedureId).toBe('pull_request.interval_quantiles_v1')
  })
})

describe('DL-METRIC-01 result contract', () => {
  it('validates observed results against their pinned definition', () => {
    const interval = validateMetricResult(OBSERVED_INTERVAL_RESULT)
    expect(interval.result.state).toBe('observed')
    expect(interval.result.counts.excluded).toEqual([{ reasonCode: 'BECAME_READY_OUTSIDE_WINDOW', count: 3 }])
    expect(validateMetricResult(OBSERVED_SHARE_RESULT).result.value).toEqual({
      kind: 'proportion',
      numerator: 31,
      denominator: 47,
    })
  })

  it('rejects results whose shape, coverage, exclusions or procedure contradict the definition', () => {
    expect(() => validateMetricResult(VALUE_SHAPE_MISMATCH_RESULT)).toThrow(/does not match the duration_quantiles formula/)
    expect(() => validateMetricResult(MISSING_COVERAGE_DIMENSION_RESULT)).toThrow(/omits the declared coverage dimension/)
    expect(() => validateMetricResult(UNDECLARED_EXCLUSION_REASON_RESULT)).toThrow(/is not an exclusion rule/)
    expect(() => validateMetricResult(UNREGISTERED_METRIC_RESULT)).toThrow(MetricRegistryError)
    expect(() => validateMetricResult({ ...(OBSERVED_INTERVAL_RESULT as Record<string, unknown>), calculation: { procedureId: 'pull_request.made_up', metricContractVersion: '1.1.0', engineVersion: '1.0.0' } }))
      .toThrow(/is computed by/)
  })

  it('holds distributions to their declared quantiles, their sample, and their direction', () => {
    expect(() => validateMetricResult(UNDECLARED_QUANTILE_SET_RESULT)).toThrow(/declares \[0\.5, 0\.75, 0\.9\]/)
    expect(resultMessages(NON_MONOTONE_QUANTILES_RESULT)).toContain('cannot run backwards')
    expect(resultMessages(SAMPLE_EXCEEDS_UNCENSORED_RESULT)).toContain('samples exactly the eligible units that were not censored')
  })

  it('holds proportions to their bounds', () => {
    expect(resultMessages(NUMERATOR_EXCEEDS_DENOMINATOR_RESULT)).toContain('numerator cannot exceed its denominator')
  })

  it('keeps window boundaries half-open and refuses claims about unfinished windows', () => {
    expect(resultIssues(ZERO_LENGTH_WINDOW_RESULT).map((issue) => issue.path)).toContain('window.end')
    expect(validateMetricResult(BOUNDARY_EVENT_AT_WINDOW_END_RESULT).result.counts.eligible).toBe(0)
    const openWindow = { ...(OBSERVED_INTERVAL_RESULT as Record<string, unknown>), asOf: '2026-07-15T00:00:00.000Z' }
    expect(resultMessages(openWindow)).toContain('requires a completed window')
  })

  it('applies the value and state rules to sensitivity variants, not only to the top-level value', () => {
    expect(resultMessages(SENSITIVITY_FABRICATED_ZERO_RESULT)).toContain('Zero-duration values are never fabricated')
    expect(resultIssues(SENSITIVITY_FABRICATED_ZERO_RESULT).map((issue) => issue.path))
      .toContain('sensitivity.0.value.quantiles')
  })
})

describe('DL-METRIC-01 typed empty-cohort observations (issue #67)', () => {
  it('admits a fully covered window with zero eligible units as an observed zero', () => {
    const { result } = validateMetricResult(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT)
    expect(result.state).toBe('empty_eligible_cohort')
    expect(result.stateReasonCode).toBe(EMPTY_ELIGIBLE_COHORT_REASON_CODE)
    expect(result.value).toEqual({ kind: 'count', observedCount: 0 })
    expect(result.counts.eligible).toBe(0)
    expect(result.counts.excluded).toEqual([{ reasonCode: 'BECAME_READY_OUTSIDE_WINDOW', count: 2 }])
  })

  it('leaves duration and share values null rather than fabricating a zero', () => {
    const distribution = validateMetricResult(EMPTY_ELIGIBLE_COHORT_DISTRIBUTION_RESULT).result
    expect(distribution.value).toEqual({ kind: 'quantiles', sampleSize: 0, quantiles: null })
    const share = validateMetricResult(EMPTY_ELIGIBLE_COHORT_SHARE_RESULT).result
    expect(share.value).toEqual({ kind: 'no_value', reasonCode: EMPTY_ELIGIBLE_COHORT_REASON_CODE })

    expect(resultIssues(FABRICATED_ZERO_DURATION_RESULT).map((issue) => issue.path)).toContain('value.quantiles')
    expect(resultMessages(FABRICATED_ZERO_DURATION_RESULT)).toContain('Zero-duration values are never fabricated')
    expect(resultMessages(FABRICATED_ZERO_SHARE_RESULT)).toContain('A proportion over an empty cohort is not computable')
  })

  it('keeps the empty state distinguishable from unavailable, truncated, censored and failed coverage', () => {
    expect([...METRIC_RESULT_STATES]).toEqual([
      'observed', 'empty_eligible_cohort', 'censored_only', 'truncated', 'unavailable', 'coverage_failed',
    ])
    const states = [
      EMPTY_ELIGIBLE_COHORT_COUNT_RESULT,
      UNAVAILABLE_RESULT,
      TRUNCATED_RESULT,
      CENSORED_ONLY_RESULT,
      COVERAGE_FAILED_RESULT,
    ].map((candidate) => validateMetricResult(candidate).result)
    expect(states.map((result) => result.state)).toEqual([
      'empty_eligible_cohort', 'unavailable', 'truncated', 'censored_only', 'coverage_failed',
    ])
    expect(new Set(states.map((result) => result.stateReasonCode)).size).toBe(5)
    for (const result of states.slice(1)) {
      expect(result.stateReasonCode).not.toBe(EMPTY_ELIGIBLE_COHORT_REASON_CODE)
    }
    expect(validateMetricResult(UNAVAILABLE_RESULT).result.value).toEqual({
      kind: 'no_value',
      reasonCode: 'CAPABILITY_NEVER_AUTHORIZED',
    })
  })

  it('refuses an observed zero under truncation, where zero cannot be told from "could not look"', () => {
    expect(resultMessages(TRUNCATED_ZERO_COUNT_RESULT)).toContain('cannot report an observed zero')
  })

  it('requires complete coverage on EVERY declared dimension before claiming a quiet window', () => {
    expect(resultMessages(EMPTY_COHORT_UNDER_PARTIAL_COVERAGE_RESULT)).toContain('completeness is limited')
    expect(resultMessages(EMPTY_COHORT_UNDER_STALE_FRESHNESS_RESULT)).toContain('freshness is limited')
    expect(resultMessages(EMPTY_COHORT_UNDER_PARTIAL_PERMISSION_RESULT)).toContain('permission is limited')
    expect(resultIssues(EMPTY_COHORT_BEFORE_WINDOW_END_RESULT).map((issue) => issue.path)).toContain('asOf')
    const misreported = { ...(UNAVAILABLE_RESULT as Record<string, unknown>), stateReasonCode: EMPTY_ELIGIBLE_COHORT_REASON_CODE }
    expect(resultIssues(misreported).map((issue) => issue.path)).toContain('stateReasonCode')
  })

  it('gates display after the row exists, and never gates the typed empty row away', () => {
    const countDefinition = getMetricDefinition(READY_COUNT)
    expect(countDefinition.supportGates.minimumEligible).toBeGreaterThan(0)
    const emptyRow = validateMetricResult(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT).result
    expect(evaluateDisplayEligibility(countDefinition, emptyRow)).toEqual({
      display: true,
      reasonCode: 'EMPTY_ELIGIBLE_COHORT_EXEMPT',
      belowGateBehaviour: null,
    })

    const shareDefinition = getMetricDefinition(PASS_SHARE)
    expect(shareDefinition.supportGates.appliesTo).toBe('display_eligibility')
    expect(shareDefinition.supportGates.emptyCohortExempt).toBe(true)
    expect(evaluateDisplayEligibility(shareDefinition, validateMetricResult(EMPTY_ELIGIBLE_COHORT_SHARE_RESULT).result).display).toBe(true)

    const lowShare = validateMetricResult(LOW_SUPPORT_SHARE_RESULT).result
    expect(evaluateDisplayEligibility(shareDefinition, lowShare)).toEqual({
      display: false,
      reasonCode: 'BELOW_MINIMUM_SUPPORT',
      belowGateBehaviour: 'suppress_display',
    })
    // The row itself survives the gate: only its display eligibility changed.
    expect(lowShare.counts.eligible).toBe(6)
    expect(lowShare.value).toEqual({ kind: 'proportion', numerator: 4, denominator: 6 })
  })

  it('gates on the number the value is actually made of', () => {
    const intervalDefinition = getMetricDefinition(INTERVAL_V2)
    expect(evaluateDisplayEligibility(intervalDefinition, validateMetricResult(LOW_SUPPORT_OBSERVED_RESULT).result)).toEqual({
      display: true,
      reasonCode: 'BELOW_MINIMUM_SUPPORT',
      belowGateBehaviour: 'render_as_range_only',
    })

    // Three quantiles from a single observation: 1 < the gate of 5, even though the row exists.
    const thin = validateMetricResult(THREE_QUANTILES_FROM_ONE_OBSERVATION_RESULT).result
    expect(thin.counts.eligible).toBe(1)
    expect(evaluateDisplayEligibility(intervalDefinition, thin).reasonCode).toBe('BELOW_MINIMUM_SUPPORT')

    // A share is gated on its denominator, which excludes the censored units.
    const shareDefinition = getMetricDefinition(PASS_SHARE)
    expect(evaluateDisplayEligibility(shareDefinition, validateMetricResult(OBSERVED_SHARE_RESULT).result).reasonCode)
      .toBe('SUPPORT_GATE_MET')
  })

  it('applies the definition truncation policy and hides only unmeasured states', () => {
    const countDefinition = getMetricDefinition(READY_COUNT)
    expect(countDefinition.missingness.truncationPolicy).toBe('report_with_truncation_limitation')
    expect(evaluateDisplayEligibility(countDefinition, validateMetricResult(TRUNCATED_RESULT).result)).toEqual({
      display: true,
      reasonCode: 'TRUNCATED_WITH_LIMITATION',
      belowGateBehaviour: null,
    })
    expect(evaluateDisplayEligibility(countDefinition, validateMetricResult(UNAVAILABLE_RESULT).result).display).toBe(false)
    expect(evaluateDisplayEligibility(countDefinition, validateMetricResult(COVERAGE_FAILED_RESULT).result).display).toBe(false)
  })
})

describe('DL-METRIC-01 exposure gate and definition card', () => {
  it('refuses to expose an unregistered metric or an unlisted sink', () => {
    expect(() => assertExposableMetricResult(UNREGISTERED_METRIC_RESULT, 'api')).toThrow(/not registered/)
    expect(() => assertExposableMetricResult(OBSERVED_SHARE_RESULT, 'export')).toThrow(/not exposable through the "export" sink/)
    const exposed = assertExposableMetricResult(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT, 'api')
    expect(exposed.reference).toBe(READY_COUNT)
    expect(exposed.supersededBy).toBeNull()
    expect(exposed.displayEligibility.display).toBe(true)
    expect(exposed.result.state).toBe('empty_eligible_cohort')
  })

  it('renders one registered metric with its full definition card', () => {
    const card = buildMetricDefinitionCard(INTERVAL_V2)
    expect(card.reference).toBe(INTERVAL_V2)
    expect(card.label).toBe('Pull-request integration interval')
    expect(card.status).toBe('active')
    expect(card.supersededBy).toBeNull()
    expect(card.dataClass).toBe('C1')
    expect(card.sections.map((section) => section.heading)).toEqual([
      'Question answered',
      'Subject, unit and window',
      'Inputs required',
      'Eligibility and cohort',
      'Event and censoring',
      'Missingness and truncation',
      'Formula',
      'Support and comparison',
      'Sensitivity variants',
      'Known confounders',
      'What this must never mean',
      'Coverage dimensions consumed',
      'Fixture classes',
      'Render and export policy',
      'Supersession',
    ])
    for (const section of card.sections) {
      expect(section.lines.length, section.heading).toBeGreaterThan(0)
    }
    const prohibited = card.sections.find((section) => section.heading === 'What this must never mean')
    expect(prohibited?.lines).toHaveLength(getMetricDefinition(INTERVAL_V2).prohibitedInterpretations.length)
    expect(prohibited?.lines.join(' ')).toContain('NOT_PERSON_MEASURE')
    const censoring = card.sections.find((section) => section.heading === 'Event and censoring')
    expect(censoring?.lines.join(' ')).toContain('right_censor_at_window_end')

    const supersededCard = buildMetricDefinitionCard(INTERVAL_V1)
    expect(supersededCard.status).toBe('superseded')
    expect(supersededCard.supersededBy).toBe(INTERVAL_V2)
    expect(() => buildMetricDefinitionCard('pull_request.vibe_check@1.0.0')).toThrow(MetricRegistryError)
  })
})
