import { describe, expect, it } from 'vitest'
import { CAPABILITY_IDS } from './capabilities.js'
import {
  EMPTY_ELIGIBLE_COHORT_REASON_CODE,
  FORBIDDEN_CONSTRUCT_TERMS,
  FORBIDDEN_PERSON_SUBJECT_TERMS,
  METRIC_ANALYTICAL_SUBJECTS,
  METRIC_CONTRACT_VERSION,
  METRIC_COVERAGE_DIMENSIONS,
  METRIC_COVERAGE_DIMENSION_DIRECTION,
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
  formatMetricReference,
  getMetricDefinition,
  isRegisteredMetric,
  listActiveMetrics,
  parseMetricReference,
  resolveMetricForComputation,
  resolveMetricForRendering,
  toCoverageWireEntry,
  validateMetricResult,
} from './metrics.js'
import {
  BACKWARDS_SUPERSESSION_FIXTURE,
  BLENDED_SCALAR_DEFINITION_FIXTURE,
  BOUNDARY_EVENT_AT_WINDOW_END_RESULT,
  CENSORED_ONLY_RESULT,
  COVERAGE_FAILED_RESULT,
  EMPTY_COHORT_BEFORE_WINDOW_END_RESULT,
  EMPTY_COHORT_UNDER_PARTIAL_COVERAGE_RESULT,
  EMPTY_ELIGIBLE_COHORT_COUNT_RESULT,
  EMPTY_ELIGIBLE_COHORT_DISTRIBUTION_RESULT,
  EMPTY_ELIGIBLE_COHORT_SHARE_RESULT,
  FABRICATED_ZERO_DURATION_RESULT,
  FABRICATED_ZERO_SHARE_RESULT,
  LOW_SUPPORT_OBSERVED_RESULT,
  LOW_SUPPORT_SHARE_RESULT,
  MISSING_COVERAGE_DIMENSION_RESULT,
  OBSERVED_INTERVAL_RESULT,
  OBSERVED_SHARE_RESULT,
  PERSON_SCORING_IDENTIFIER_FIXTURE,
  REGISTERABLE_DEFINITION_FIXTURE,
  STRUCTURALLY_INCOMPLETE_DEFINITION_FIXTURE,
  SUPERSEDED_PINNED_RESULT,
  TRUNCATED_RESULT,
  UNAVAILABLE_RESULT,
  UNDECLARED_EXCLUSION_REASON_RESULT,
  UNDERSPECIFIED_DEFINITION_FIXTURE,
  UNREGISTERED_METRIC_RESULT,
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

describe('DL-METRIC-01 registry contract', () => {
  it('registers only closed, fully specified, C1 definitions', () => {
    expect(METRIC_CONTRACT_VERSION).toBe('1.0.0')
    expect(METRIC_DEFINITION_DATA_CLASS).toBe('C1')
    expect(METRIC_REGISTRY.length).toBeGreaterThan(0)
    for (const definition of METRIC_REGISTRY) {
      expect(MetricDefinitionSchema.safeParse(definition).success, formatMetricReference(definition)).toBe(true)
      expect(definition.prohibitedInterpretations.length, formatMetricReference(definition)).toBeGreaterThan(0)
      expect(definition.clockSource).toBe('injected_as_of')
      expect(definition.renderPolicy.maximumDataClass === 'C0' || definition.renderPolicy.maximumDataClass === 'C1').toBe(true)
      expect(definition.renderPolicy.exportSinks).not.toContain('public')
      for (const capability of definition.requiredCapabilities) {
        expect(CAPABILITY_IDS).toContain(capability)
      }
      for (const field of definition.requiredFields) {
        expect(field.dataClass).not.toBe('X')
      }
      for (const dimension of definition.coverageDimensions) {
        expect(METRIC_COVERAGE_DIMENSIONS).toContain(dimension)
      }
    }
  })

  it('keeps the twelve ADR-02 coverage dimensions referenced by name with a registered direction', () => {
    expect([...METRIC_COVERAGE_DIMENSIONS]).toEqual([
      'permission', 'completeness', 'eligibility', 'freshness', 'censoring_freedom', 'consistency',
      'sample', 'source_diversity', 'parser_coverage', 'comparability', 'drift_stability', 'calibration',
    ])
    expect(METRIC_COVERAGE_DIMENSION_DIRECTION).toBe('higher_is_better')
    expect(toCoverageWireEntry({ dimension: 'completeness', value: 0.5, limitingReason: 'PARTIAL_SOURCE_WINDOW' })).toEqual({
      dimension: 'completeness',
      value: 0.5,
      limiting_reason: 'PARTIAL_SOURCE_WINDOW',
    })
  })

  it('closes the subject, unit and category enums against person scoring and blended scalars', () => {
    for (const member of [...METRIC_ANALYTICAL_SUBJECTS, ...METRIC_UNITS, ...METRIC_SEMANTIC_CATEGORIES]) {
      expect(findForbiddenConstructTerm(member), member).toBeNull()
    }
    for (const banned of ['engagement', 'importance', 'activity', 'health', 'maturity', 'confidence']) {
      expect(FORBIDDEN_CONSTRUCT_TERMS).toContain(banned)
    }
    for (const banned of ['person', 'contributor', 'developer', 'author', 'reviewer']) {
      expect(FORBIDDEN_PERSON_SUBJECT_TERMS).toContain(banned)
    }
    expect(findForbiddenConstructTerm('repository_window')).toBeNull()
    expect(findForbiddenConstructTerm('contributor_health_score')).toBe('health')
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
    expect(MetricDefinitionSchema.safeParse(BLENDED_SCALAR_DEFINITION_FIXTURE).success).toBe(false)
    expect(issuePaths(BLENDED_SCALAR_DEFINITION_FIXTURE)).toEqual(
      expect.arrayContaining(['analyticalSubject', 'unit', 'semanticCategory']),
    )
    expect(issuePaths(PERSON_SCORING_IDENTIFIER_FIXTURE)).toEqual(expect.arrayContaining(['metricId', 'label']))
    expect(issuePaths(X_CLASS_FIELD_DEFINITION_FIXTURE)).toContain('requiredFields.0.dataClass')
    expect(issuePaths(BACKWARDS_SUPERSESSION_FIXTURE)).toContain('supersession.supersededBy.version')
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
    expect(interval.result.counts).toEqual({
      eligible: 14,
      censored: 2,
      excluded: [{ reasonCode: 'NEVER_READY_FOR_REVIEW', count: 3 }],
    })
    expect(validateMetricResult(OBSERVED_SHARE_RESULT).result.value).toEqual({
      kind: 'proportion',
      numerator: 31,
      denominator: 48,
    })
  })

  it('rejects results whose shape, coverage, exclusions or procedure contradict the definition', () => {
    expect(() => validateMetricResult(VALUE_SHAPE_MISMATCH_RESULT)).toThrow(/does not match the duration_quantiles formula/)
    expect(() => validateMetricResult(MISSING_COVERAGE_DIMENSION_RESULT)).toThrow(/omits the declared coverage dimension/)
    expect(() => validateMetricResult(UNDECLARED_EXCLUSION_REASON_RESULT)).toThrow(/is not an exclusion rule/)
    expect(() => validateMetricResult(UNREGISTERED_METRIC_RESULT)).toThrow(MetricRegistryError)
    expect(() => validateMetricResult({ ...(OBSERVED_INTERVAL_RESULT as Record<string, unknown>), calculation: { procedureId: 'pull_request.made_up', metricContractVersion: '1.0.0', engineVersion: '1.0.0' } }))
      .toThrow(/is computed by/)
  })

  it('keeps window boundaries half-open and refuses claims about unfinished windows', () => {
    expect(resultIssues(ZERO_LENGTH_WINDOW_RESULT).map((issue) => issue.path)).toContain('window.end')
    expect(validateMetricResult(BOUNDARY_EVENT_AT_WINDOW_END_RESULT).result.counts.eligible).toBe(0)
    const openWindow = { ...(OBSERVED_INTERVAL_RESULT as Record<string, unknown>), asOf: '2026-07-15T00:00:00.000Z' }
    expect(resultIssues(openWindow).map((issue) => issue.message).join(' ')).toContain('requires a completed window')
  })
})

describe('DL-METRIC-01 typed empty-cohort observations (issue #67)', () => {
  it('admits a fully covered window with zero eligible events as an observed zero', () => {
    const { result } = validateMetricResult(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT)
    expect(result.state).toBe('empty_eligible_cohort')
    expect(result.stateReasonCode).toBe(EMPTY_ELIGIBLE_COHORT_REASON_CODE)
    expect(result.value).toEqual({ kind: 'count', observedCount: 0 })
    expect(result.counts.eligible).toBe(0)
    expect(result.counts.excluded).toEqual([{ reasonCode: 'NEVER_READY_FOR_REVIEW', count: 2 }])
  })

  it('leaves duration and share values null rather than fabricating a zero', () => {
    const distribution = validateMetricResult(EMPTY_ELIGIBLE_COHORT_DISTRIBUTION_RESULT).result
    expect(distribution.value).toEqual({ kind: 'quantiles', sampleSize: 0, quantiles: null })
    const share = validateMetricResult(EMPTY_ELIGIBLE_COHORT_SHARE_RESULT).result
    expect(share.value).toEqual({ kind: 'no_value', reasonCode: EMPTY_ELIGIBLE_COHORT_REASON_CODE })

    expect(resultIssues(FABRICATED_ZERO_DURATION_RESULT).map((issue) => issue.path)).toContain('value.quantiles')
    expect(resultIssues(FABRICATED_ZERO_DURATION_RESULT).map((issue) => issue.message).join(' '))
      .toContain('Zero-duration values are never fabricated')
    expect(resultIssues(FABRICATED_ZERO_SHARE_RESULT).map((issue) => issue.message).join(' '))
      .toContain('A proportion over an empty cohort is not computable')
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

  it('refuses an empty-cohort claim that coverage does not support', () => {
    expect(resultIssues(EMPTY_COHORT_UNDER_PARTIAL_COVERAGE_RESULT).map((issue) => issue.path)).toContain('coverage')
    expect(resultIssues(EMPTY_COHORT_BEFORE_WINDOW_END_RESULT).map((issue) => issue.path)).toContain('asOf')
    const misreported = { ...(UNAVAILABLE_RESULT as Record<string, unknown>), stateReasonCode: EMPTY_ELIGIBLE_COHORT_REASON_CODE }
    expect(resultIssues(misreported).map((issue) => issue.path)).toContain('stateReasonCode')
  })

  it('gates display after the row exists, and never gates the typed empty row away', () => {
    const countDefinition = getMetricDefinition(READY_COUNT)
    const emptyRow = validateMetricResult(EMPTY_ELIGIBLE_COHORT_COUNT_RESULT).result
    expect(evaluateDisplayEligibility(countDefinition, emptyRow)).toEqual({
      display: true,
      reasonCode: 'EMPTY_ELIGIBLE_COHORT_EXEMPT',
      belowGateBehaviour: null,
    })

    const shareDefinition = getMetricDefinition(PASS_SHARE)
    expect(shareDefinition.supportGates.minimumEligible).toBe(10)
    expect(shareDefinition.supportGates.appliesTo).toBe('display_eligibility')
    expect(shareDefinition.supportGates.emptyCohortExempt).toBe(true)

    const emptyShare = validateMetricResult(EMPTY_ELIGIBLE_COHORT_SHARE_RESULT).result
    expect(evaluateDisplayEligibility(shareDefinition, emptyShare).display).toBe(true)

    const lowShare = validateMetricResult(LOW_SUPPORT_SHARE_RESULT).result
    expect(evaluateDisplayEligibility(shareDefinition, lowShare)).toEqual({
      display: false,
      reasonCode: 'BELOW_MINIMUM_SUPPORT',
      belowGateBehaviour: 'suppress_display',
    })
    // The row itself survives the gate: only its display eligibility changed.
    expect(lowShare.counts.eligible).toBe(6)
    expect(lowShare.value).toEqual({ kind: 'proportion', numerator: 4, denominator: 6 })

    const intervalDefinition = getMetricDefinition(INTERVAL_V2)
    const lowInterval = validateMetricResult(LOW_SUPPORT_OBSERVED_RESULT).result
    expect(evaluateDisplayEligibility(intervalDefinition, lowInterval)).toEqual({
      display: true,
      reasonCode: 'BELOW_MINIMUM_SUPPORT',
      belowGateBehaviour: 'render_as_range_only',
    })
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

    const supersededCard = buildMetricDefinitionCard(INTERVAL_V1)
    expect(supersededCard.status).toBe('superseded')
    expect(supersededCard.supersededBy).toBe(INTERVAL_V2)
    expect(() => buildMetricDefinitionCard('pull_request.vibe_check@1.0.0')).toThrow(MetricRegistryError)
  })
})
