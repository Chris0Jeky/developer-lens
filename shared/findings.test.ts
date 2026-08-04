import { describe, expect, it } from 'vitest'
import { CLAIM_LAYERS, CLAIM_STATEMENT_CODES } from './claims.js'
import { findForbiddenConstructTerm, isRegisteredMetric } from './metrics.js'
import {
  AnalyticReferenceSchema,
  BANNED_FIELD_TERMS,
  CAUSAL_OR_EVALUATIVE_TERMS,
  ClaimReferenceSchema,
  COVERAGE_ENTRY_MATCHES_METRIC_COVERAGE_ENTRY,
  DERIVED_VALUE_CATEGORIES,
  FINDING_CONTRACT_VERSION,
  FINDING_DATA_CLASS,
  FINDING_LAYERS,
  FINDING_SCHEMA_VERSION,
  FINDING_VALUE_CATEGORIES,
  FindingAbstentionSchema,
  FindingContractError,
  FindingRobustnessSchema,
  FindingSampleSummarySchema,
  FindingSchema,
  MetricResultReferenceSchema,
  OBSERVABLE_VALUE_CATEGORIES,
  ObservationReferenceSchema,
  PresentationEligibilitySchema,
  RenderedMarkSchema,
  SAMPLE_COUNTS_MATCH_METRIC_COUNTS,
  STATEMENT_CODE_LICENSED_TERMS,
  analyticReferenceId,
  assertDeterministicFallbackPair,
  assertRenderableFinding,
  buildFindingReferenceWalk,
  findBannedFieldName,
  findCausalOrEvaluativeTerm,
  formatFindingReference,
  formatMetricResultReference,
  markReferenceKindMatches,
  parseFindingReference,
  requiredReferenceKindFor,
  validateFinding,
} from './findings.js'

/* ------------------------------------------------------------------------------------------ *
 * Fixtures — a valid finding at each layer, built as plain data so tests can corrupt one field
 * at a time. Metric references are REAL registered ids from shared/metrics.ts so the registry
 * checks in validateFinding pass on the positive cases.
 * ------------------------------------------------------------------------------------------ */

const hex = (character: string): string => character.repeat(64)
const CLAIM_A = `cl_${hex('a')}`
const CLAIM_B = `cl_${hex('b')}`
const CLAIM_C = `cl_${hex('c')}`

/** A distinct-count metric — real, active, gives a legitimate `count` mark. */
const READY_COUNT_ID = 'pull_request.ready_event_count'
const READY_COUNT_REF = `${READY_COUNT_ID}@1.0.0`
/** A real sensitivity variant of the ready-count metric. */
const READY_COUNT_VARIANT = 'CALENDAR_WEEK_ALIGNED'
/** A real variant name, but of a DIFFERENT metric — unknown to the ready-count primary. */
const WRONG_METRIC_VARIANT = 'INCLUDE_CANCELLED_AS_UNKNOWN'

type Payload = Record<string, unknown>

function baseDeterministicFinding(): Payload {
  return {
    findingId: 'fnd_ready_count_det',
    version: '1.0.0',
    schemaVersion: '1.0.0',
    questionId: 'q_ready_count',
    layer: 'deterministic',
    statementCode: 'DELIVERY_FLOW',
    method: { methodId: 'method_ready_count', methodVersion: '1.0.0' },
    scopeId: 'scope_alpha',
    metricResults: [
      { metricId: READY_COUNT_ID, metricVersion: '1.0.0', resultId: 'result_1', role: 'primary' },
    ],
    observation: 'The window recorded twelve pull requests that became ready.',
    candidateInterpretation: null,
    marks: [
      { markId: 'mark_count', valueCategory: 'count', reference: { kind: 'claim', claimId: CLAIM_A, claimLayer: 'deterministic' } },
    ],
    evidence: [{ kind: 'claim', claimId: CLAIM_B, claimLayer: 'deterministic' }],
    counterEvidence: [],
    alternativeExplanations: [],
    limitations: [],
    prohibitedInterpretations: [
      { code: 'NOT_PERSON_MEASURE', statement: 'A cohort statistic, never a reading of any single person.' },
    ],
    sampleSummary: { resultId: 'result_1', state: 'observed', counts: { eligible: 12, censored: 0, excluded: [] } },
    coverage: [{ dimension: 'completeness', value: 1, limiting_reason: null }],
    robustness: { status: 'not-tested', checks: [] },
    discriminatingEvidence: null,
    presentationEligibility: { eligible: true, reasonCode: 'PRESENTABLE', surfaces: ['atlas'] },
    abstention: null,
  }
}

function baseAbstentionFinding(): Payload {
  return {
    findingId: 'fnd_ready_count_abstain',
    version: '1.0.0',
    schemaVersion: '1.0.0',
    questionId: 'q_ready_count',
    layer: 'abstention',
    statementCode: 'ABSTAIN_LOW_COVERAGE',
    method: { methodId: 'method_modelled_ready', methodVersion: '1.0.0' },
    scopeId: 'scope_alpha',
    metricResults: [
      { metricId: READY_COUNT_ID, metricVersion: '1.0.0', resultId: 'result_1', role: 'primary' },
    ],
    observation: 'The value is withheld while coverage remains under the floor.',
    candidateInterpretation: null,
    marks: [],
    evidence: [],
    counterEvidence: [],
    alternativeExplanations: [],
    limitations: [],
    prohibitedInterpretations: [],
    sampleSummary: { resultId: 'result_1', state: 'unavailable', counts: { eligible: 0, censored: 0, excluded: [] } },
    coverage: [{ dimension: 'sample', value: 0.1, limiting_reason: 'SAMPLE_BELOW_MINIMUM' }],
    robustness: { status: 'not-tested', checks: [] },
    discriminatingEvidence: null,
    presentationEligibility: { eligible: true, reasonCode: 'PRESENTABLE_AS_ABSTENTION', surfaces: ['evidence_drawer'] },
    abstention: {
      floorCode: 'SAMPLE_FLOOR',
      dimension: 'sample',
      limitingReason: 'SAMPLE_BELOW_MINIMUM',
      statement: 'Coverage on the sample dimension fell below its floor.',
      fallbackFindingId: null,
    },
  }
}

function baseHypothesisFinding(): Payload {
  return {
    ...baseDeterministicFinding(),
    findingId: 'fnd_ready_count_hyp',
    layer: 'hypothesis',
    candidateInterpretation: 'The dip was caused by a release freeze in the window.',
    marks: [],
    alternativeExplanations: [
      { code: 'ALT_FREEZE', statement: 'A release freeze suppressed the transitions without any real change.' },
      { code: 'ALT_HOLIDAY', statement: 'A holiday period produced a genuinely quiet but complete window.' },
    ],
    discriminatingEvidence: {
      statement: 'A calendar overlay would separate a freeze from a holiday period.',
      distinguishes: ['ALT_FREEZE', 'ALT_HOLIDAY'],
    },
    presentationEligibility: { eligible: false, reasonCode: 'ALTERNATIVES_UNRESOLVED', surfaces: [] },
  }
}

/** Shallow top-level override — nested corruptions pass the whole replacement subtree. */
function make(base: () => Payload, overrides: Payload = {}): Payload {
  return { ...base(), ...overrides }
}

function expectRejected(candidate: unknown): void {
  expect(() => validateFinding(candidate)).toThrow(FindingContractError)
}

/* ------------------------------------------------------------------------------------------ *
 * Module invariants and reuse of the merged contracts
 * ------------------------------------------------------------------------------------------ */

describe('module invariants', () => {
  it('pins the contract, schema and data-class constants', () => {
    expect(FINDING_CONTRACT_VERSION).toBe('1.0.0')
    expect(FINDING_SCHEMA_VERSION).toBe('1.0.0')
    expect(FINDING_DATA_CLASS).toBe('C1')
  })

  it('reuses claim layers rather than defining a parallel set', () => {
    expect(FINDING_LAYERS).toEqual(CLAIM_LAYERS)
  })

  it('licenses terms only over exactly the registered statement codes', () => {
    expect(new Set(Object.keys(STATEMENT_CODE_LICENSED_TERMS))).toEqual(new Set(CLAIM_STATEMENT_CODES))
  })

  it('never licenses a term that is not itself scanned', () => {
    for (const licensed of Object.values(STATEMENT_CODE_LICENSED_TERMS)) {
      for (const term of licensed) {
        expect(CAUSAL_OR_EVALUATIVE_TERMS).toContain(term)
      }
    }
  })

  it('only the coverage-shaped codes license "because"; every subject-level code licenses nothing', () => {
    expect(STATEMENT_CODE_LICENSED_TERMS.ABSTAIN_LOW_COVERAGE).toEqual(['because'])
    expect(STATEMENT_CODE_LICENSED_TERMS.COVERAGE_GAP).toEqual(['because'])
    expect(STATEMENT_CODE_LICENSED_TERMS.DELIVERY_FLOW).toEqual([])
    expect(STATEMENT_CODE_LICENSED_TERMS.CI_RERUN_PATTERN).toEqual([])
    expect(STATEMENT_CODE_LICENSED_TERMS.OWNERSHIP_COVERAGE).toEqual([])
  })

  it('exposes the compile-time shape proofs as runtime true', () => {
    expect(SAMPLE_COUNTS_MATCH_METRIC_COUNTS).toBe(true)
    expect(COVERAGE_ENTRY_MATCHES_METRIC_COVERAGE_ENTRY).toBe(true)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * AnalyticReference union and value categories
 * ------------------------------------------------------------------------------------------ */

describe('AnalyticReference', () => {
  it('accepts a well-formed observation reference', () => {
    expect(AnalyticReferenceSchema.safeParse({ kind: 'observation', evidenceId: 'ev_1' }).success).toBe(true)
  })

  it('accepts a well-formed claim reference carrying its resolved layer', () => {
    expect(AnalyticReferenceSchema.safeParse({ kind: 'claim', claimId: CLAIM_A, claimLayer: 'modelled' }).success).toBe(true)
  })

  it('rejects a claim reference whose id is not cl_ + 64 hex', () => {
    expect(ClaimReferenceSchema.safeParse({ kind: 'claim', claimId: 'cl_abc', claimLayer: 'deterministic' }).success).toBe(false)
    expect(ClaimReferenceSchema.safeParse({ kind: 'claim', claimId: `cl_${'A'.repeat(64)}`, claimLayer: 'deterministic' }).success).toBe(false)
  })

  it('rejects a claim reference with no resolved layer', () => {
    expect(ClaimReferenceSchema.safeParse({ kind: 'claim', claimId: CLAIM_A }).success).toBe(false)
  })

  it('rejects extra keys on an observation reference (strict)', () => {
    expect(ObservationReferenceSchema.safeParse({ kind: 'observation', evidenceId: 'ev_1', extra: 1 }).success).toBe(false)
  })

  it('rejects an unknown reference kind', () => {
    expect(AnalyticReferenceSchema.safeParse({ kind: 'guess', evidenceId: 'ev_1' }).success).toBe(false)
  })

  it('projects the resolving id regardless of kind', () => {
    expect(analyticReferenceId({ kind: 'claim', claimId: CLAIM_A, claimLayer: 'deterministic' })).toBe(CLAIM_A)
    expect(analyticReferenceId({ kind: 'observation', evidenceId: 'ev_9' })).toBe('ev_9')
  })

  it('maps every derived value category to a claim and raw facts to an observation', () => {
    expect(FINDING_VALUE_CATEGORIES).toEqual([...DERIVED_VALUE_CATEGORIES, ...OBSERVABLE_VALUE_CATEGORIES])
    for (const category of DERIVED_VALUE_CATEGORIES) {
      expect(requiredReferenceKindFor(category)).toBe('claim')
    }
    for (const category of OBSERVABLE_VALUE_CATEGORIES) {
      expect(requiredReferenceKindFor(category)).toBe('observation')
    }
  })
})

/* ------------------------------------------------------------------------------------------ *
 * RenderedMark — derived-as-observed is structurally unrepresentable
 * ------------------------------------------------------------------------------------------ */

describe('RenderedMark pairing', () => {
  it('accepts a derived value paired with a claim reference', () => {
    const parsed = RenderedMarkSchema.safeParse({
      markId: 'mk', valueCategory: 'ratio', reference: { kind: 'claim', claimId: CLAIM_A, claimLayer: 'deterministic' },
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts a raw fact paired with an observation reference', () => {
    const parsed = RenderedMarkSchema.safeParse({
      markId: 'mk', valueCategory: 'raw_fact', reference: { kind: 'observation', evidenceId: 'ev_1' },
    })
    expect(parsed.success).toBe(true)
  })

  it('cannot represent a derived value resolving through an observation', () => {
    const parsed = RenderedMarkSchema.safeParse({
      markId: 'mk', valueCategory: 'count', reference: { kind: 'observation', evidenceId: 'ev_1' },
    })
    expect(parsed.success).toBe(false)
  })

  it('cannot represent a raw fact resolving through a claim', () => {
    const parsed = RenderedMarkSchema.safeParse({
      markId: 'mk', valueCategory: 'raw_fact', reference: { kind: 'claim', claimId: CLAIM_A, claimLayer: 'deterministic' },
    })
    expect(parsed.success).toBe(false)
  })

  it('agrees with the predicate on a parsed mark', () => {
    const mark = RenderedMarkSchema.parse({
      markId: 'mk', valueCategory: 'delta', reference: { kind: 'claim', claimId: CLAIM_A, claimLayer: 'deterministic' },
    })
    expect(markReferenceKindMatches(mark)).toBe(true)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * Metric result references
 * ------------------------------------------------------------------------------------------ */

describe('MetricResultReference', () => {
  it('formats a reference as metric_id@version#result', () => {
    expect(formatMetricResultReference({ metricId: READY_COUNT_ID, metricVersion: '1.0.0', resultId: 'result_1', role: 'primary' }))
      .toBe(`${READY_COUNT_ID}@1.0.0#result_1`)
  })

  it('rejects a non snake_case metric id and a non-semver version', () => {
    expect(MetricResultReferenceSchema.safeParse({ metricId: 'PullRequest.Count', metricVersion: '1.0.0', resultId: 'r', role: 'primary' }).success).toBe(false)
    expect(MetricResultReferenceSchema.safeParse({ metricId: READY_COUNT_ID, metricVersion: '1.0', resultId: 'r', role: 'primary' }).success).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * Sample summary — runtime mirror of the metric counts invariants
 * ------------------------------------------------------------------------------------------ */

describe('FindingSampleSummary invariants', () => {
  it('accepts a well-formed summary', () => {
    expect(FindingSampleSummarySchema.safeParse({ resultId: 'r', state: 'observed', counts: { eligible: 8, censored: 3, excluded: [] } }).success).toBe(true)
  })

  it('rejects more censored than eligible units', () => {
    expect(FindingSampleSummarySchema.safeParse({ resultId: 'r', state: 'observed', counts: { eligible: 2, censored: 5, excluded: [] } }).success).toBe(false)
  })

  it('rejects duplicate excluded reason codes', () => {
    const parsed = FindingSampleSummarySchema.safeParse({
      resultId: 'r', state: 'observed', counts: { eligible: 4, censored: 0, excluded: [{ reasonCode: 'MISSING', count: 1 }, { reasonCode: 'MISSING', count: 2 }] },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a non-positive excluded count', () => {
    expect(FindingSampleSummarySchema.safeParse({ resultId: 'r', state: 'observed', counts: { eligible: 4, censored: 0, excluded: [{ reasonCode: 'MISSING', count: 0 }] } }).success).toBe(false)
  })

  it('forces an empty eligible cohort to zero eligible and zero censored units', () => {
    expect(FindingSampleSummarySchema.safeParse({ resultId: 'r', state: 'empty_eligible_cohort', counts: { eligible: 0, censored: 0, excluded: [] } }).success).toBe(true)
    expect(FindingSampleSummarySchema.safeParse({ resultId: 'r', state: 'empty_eligible_cohort', counts: { eligible: 3, censored: 0, excluded: [] } }).success).toBe(false)
    expect(FindingSampleSummarySchema.safeParse({ resultId: 'r', state: 'empty_eligible_cohort', counts: { eligible: 0, censored: 1, excluded: [] } }).success).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * Robustness
 * ------------------------------------------------------------------------------------------ */

describe('FindingRobustness', () => {
  it('accepts not-tested with no checks', () => {
    expect(FindingRobustnessSchema.safeParse({ status: 'not-tested', checks: [] }).success).toBe(true)
  })

  it('forbids checks under a not-tested status', () => {
    const parsed = FindingRobustnessSchema.safeParse({
      status: 'not-tested', checks: [{ checkId: 'C1', statement: 'Recomputed on a shifted window.', outcome: 'held', sensitivityVariantId: null }],
    })
    expect(parsed.success).toBe(false)
  })

  it('requires at least one named check for stable and fragile', () => {
    expect(FindingRobustnessSchema.safeParse({ status: 'stable', checks: [] }).success).toBe(false)
    expect(FindingRobustnessSchema.safeParse({ status: 'fragile', checks: [] }).success).toBe(false)
  })

  it('rejects duplicate check ids', () => {
    const parsed = FindingRobustnessSchema.safeParse({
      status: 'stable',
      checks: [
        { checkId: 'C1', statement: 'Recomputed on a shifted window.', outcome: 'held', sensitivityVariantId: null },
        { checkId: 'C1', statement: 'Recomputed without the long tail.', outcome: 'held', sensitivityVariantId: null },
      ],
    })
    expect(parsed.success).toBe(false)
  })

  it('a direction-flipping check cannot coexist with a stable status', () => {
    const parsed = FindingRobustnessSchema.safeParse({
      status: 'stable', checks: [{ checkId: 'C1', statement: 'Recomputed on a shifted window.', outcome: 'changed_direction', sensitivityVariantId: null }],
    })
    expect(parsed.success).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * Presentation eligibility
 * ------------------------------------------------------------------------------------------ */

describe('PresentationEligibility', () => {
  it('accepts an eligible finding naming a presentable reason and a surface', () => {
    expect(PresentationEligibilitySchema.safeParse({ eligible: true, reasonCode: 'PRESENTABLE', surfaces: ['atlas'] }).success).toBe(true)
  })

  it('rejects an eligible finding that names a withholding reason', () => {
    expect(PresentationEligibilitySchema.safeParse({ eligible: true, reasonCode: 'ABSTAINED', surfaces: ['atlas'] }).success).toBe(false)
  })

  it('rejects an ineligible finding that names a presentable reason', () => {
    expect(PresentationEligibilitySchema.safeParse({ eligible: false, reasonCode: 'PRESENTABLE', surfaces: [] }).success).toBe(false)
  })

  it('requires a surface when eligible and forbids surfaces when not', () => {
    expect(PresentationEligibilitySchema.safeParse({ eligible: true, reasonCode: 'PRESENTABLE', surfaces: [] }).success).toBe(false)
    expect(PresentationEligibilitySchema.safeParse({ eligible: false, reasonCode: 'ABSTAINED', surfaces: ['atlas'] }).success).toBe(false)
  })

  it('rejects duplicate and unknown surfaces', () => {
    expect(PresentationEligibilitySchema.safeParse({ eligible: true, reasonCode: 'PRESENTABLE', surfaces: ['atlas', 'atlas'] }).success).toBe(false)
    expect(PresentationEligibilitySchema.safeParse({ eligible: true, reasonCode: 'PRESENTABLE', surfaces: ['billboard'] }).success).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * Abstention leaf
 * ------------------------------------------------------------------------------------------ */

describe('FindingAbstention', () => {
  it('accepts a floor whose reason is registered for its dimension', () => {
    const parsed = FindingAbstentionSchema.safeParse({
      floorCode: 'SAMPLE_FLOOR', dimension: 'sample', limitingReason: 'SAMPLE_BELOW_MINIMUM', statement: 'The sample floor was not met.', fallbackFindingId: null,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a reason not registered for the cited dimension', () => {
    const parsed = FindingAbstentionSchema.safeParse({
      floorCode: 'SAMPLE_FLOOR', dimension: 'sample', limitingReason: 'NO_PARSER_FOR_LANGUAGE', statement: 'The sample floor was not met.', fallbackFindingId: null,
    })
    expect(parsed.success).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * Banned band-shaped fields — no confidence scalar or band, anywhere
 * ------------------------------------------------------------------------------------------ */

describe('findBannedFieldName scan', () => {
  it('lists exactly the confidence, score and band family', () => {
    expect([...BANNED_FIELD_TERMS]).toEqual(['confidence', 'score', 'rating', 'band', 'grade', 'certainty', 'likelihood', 'probability'])
  })

  it('finds a top-level banned key', () => {
    expect(findBannedFieldName({ confidence: 0.9 })).toBe('confidence')
  })

  it('finds a nested banned key with its path', () => {
    expect(findBannedFieldName({ robustness: { checks: { grade: 'A' } } })).toBe('robustness.checks.grade')
  })

  it('finds a banned key nested inside an array with its index', () => {
    expect(findBannedFieldName({ marks: [{ markId: 'm' }, { scoreBand: 2 }] })).toBe('marks.1.scoreBand')
  })

  it('detects camelCase and snake_case banned keys by token, not substring', () => {
    expect(findBannedFieldName({ certaintyLevel: 1 })).toBe('certaintyLevel')
    expect(findBannedFieldName({ likelihood_estimate: 1 })).toBe('likelihood_estimate')
  })

  it('does not flag words that merely contain a banned term as a substring', () => {
    expect(findBannedFieldName({ upgrade: 1, scoreboard: 2, gradient: 3 })).toBeNull()
  })

  it('returns null for non-object inputs', () => {
    expect(findBannedFieldName(null)).toBeNull()
    expect(findBannedFieldName('confidence')).toBeNull()
    expect(findBannedFieldName([1, 2, 3])).toBeNull()
  })

  it('fails a whole finding closed on a banned field, before schema parsing', () => {
    expect(() => validateFinding(make(baseDeterministicFinding, { confidence: 0.5 }))).toThrow(/confidence, score, rating, or band/)
  })

  it('catches a banned field nested inside a subobject of a finding', () => {
    const corrupt = make(baseDeterministicFinding, { method: { methodId: 'm', methodVersion: '1.0.0', score: 1 } })
    expect(() => validateFinding(corrupt)).toThrow(FindingContractError)
    expect(findBannedFieldName(corrupt)).toBe('method.score')
  })

  it('catches a banned field nested inside an array element of a finding', () => {
    const corrupt = make(baseDeterministicFinding, {
      marks: [{ markId: 'mark_count', valueCategory: 'count', reference: { kind: 'claim', claimId: CLAIM_A, claimLayer: 'deterministic' }, ratingBand: 1 }],
    })
    expect(findBannedFieldName(corrupt)).toBe('marks.0.ratingBand')
    expect(() => validateFinding(corrupt)).toThrow(FindingContractError)
  })

  it('the strict schema also rejects an unknown key even without the scan', () => {
    expect(FindingSchema.safeParse(make(baseDeterministicFinding, { unexpectedExtra: 1 })).success).toBe(false)
    expect(FindingSchema.safeParse(make(baseDeterministicFinding, { probability: 0.5 })).success).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * Copy scan — construct, causal and evaluative wording
 * ------------------------------------------------------------------------------------------ */

describe('findCausalOrEvaluativeTerm', () => {
  it('returns the first unlicensed causal term or null', () => {
    expect(findCausalOrEvaluativeTerm('the merge failed because ci was red')).toBe('because')
    expect(findCausalOrEvaluativeTerm('the median interval was four hours lower')).toBeNull()
  })

  it('honours the licensed set', () => {
    expect(findCausalOrEvaluativeTerm('incomplete because unauthorised', ['because'])).toBeNull()
    expect(findCausalOrEvaluativeTerm('incomplete because unauthorised')).toBe('because')
  })

  it('matches whole tokens only, never substrings', () => {
    expect(findCausalOrEvaluativeTerm('the causeway was repaved')).toBeNull()
    expect(findCausalOrEvaluativeTerm('a duel at dawn')).toBeNull()
    expect(findCausalOrEvaluativeTerm('closed due to a paused connector')).toBe('due')
  })

  it('splits camelCase humps when scanning', () => {
    expect(findCausalOrEvaluativeTerm('itHappenedBecauseOfCi')).toBe('because')
  })
})

describe('copy scan inside a finding', () => {
  it('rejects an unlicensed causal term in the observation', () => {
    expectRejected(make(baseDeterministicFinding, { observation: 'The dip happened because the connector paused.' }))
  })

  it('licenses "because" under COVERAGE_GAP', () => {
    const finding = make(baseDeterministicFinding, {
      statementCode: 'COVERAGE_GAP',
      observation: 'The count is incomplete because the connector was never authorised.',
    })
    expect(validateFinding(finding).statementCode).toBe('COVERAGE_GAP')
  })

  it('licenses "because" under ABSTAIN_LOW_COVERAGE on the abstention statement', () => {
    const finding = make(baseAbstentionFinding, {
      abstention: {
        floorCode: 'SAMPLE_FLOOR', dimension: 'sample', limitingReason: 'SAMPLE_BELOW_MINIMUM',
        statement: 'The value is withheld because coverage fell below the floor.', fallbackFindingId: null,
      },
    })
    expect(validateFinding(finding).layer).toBe('abstention')
  })

  it('rejects an evaluative term in the observation', () => {
    expectRejected(make(baseDeterministicFinding, { observation: 'The window closed faster than the previous one.' }))
  })

  it('rejects a blended construct term in the observation', () => {
    expectRejected(make(baseDeterministicFinding, { observation: 'Team productivity rose across the window.' }))
  })

  it('exempts prohibitedInterpretations from both scans', () => {
    const finding = make(baseDeterministicFinding, {
      prohibitedInterpretations: [{ code: 'NOT_PRODUCTIVITY', statement: 'This is never a productivity or performance measure of anyone.' }],
    })
    expect(validateFinding(finding).findingId).toBe('fnd_ready_count_det')
  })

  it('scans a hypothesis candidate interpretation for constructs but allows causal wording there', () => {
    // "caused" is causal and permitted in a candidate interpretation.
    expect(validateFinding(baseHypothesisFinding()).layer).toBe('hypothesis')
    // A blended construct is still forbidden even in a candidate interpretation.
    expectRejected(make(baseHypothesisFinding, { candidateInterpretation: 'The productivity of the team explains the dip.' }))
  })
})

/* ------------------------------------------------------------------------------------------ *
 * The mirrored tokenizer is pinned to the exported metrics scan on a shared term
 * ------------------------------------------------------------------------------------------ */

describe('tokenizer mirror pinned to findForbiddenConstructTerm', () => {
  // "productivity" is the one term both scans share: it is a construct term in metrics and an
  // evaluative term here, so the finding-side scan and the metric-side scan must agree on it.
  const cases: ReadonlyArray<{ text: string; hit: boolean; note: string }> = [
    { text: 'productivity', hit: true, note: 'bare token' },
    { text: 'measured productivity this window', hit: true, note: 'word among words' },
    { text: 'teamProductivity trend', hit: true, note: 'camelCase hump' },
    { text: 'the team_productivity_index dropped', hit: true, note: 'snake_case multi-word context' },
    { text: 'productivityhub dashboard', hit: false, note: 'longer token, not a match' },
    { text: 'an unproductive stretch', hit: false, note: 'substring, not a token' },
  ]

  for (const { text, hit, note } of cases) {
    it(`agrees on "${text}" (${note})`, () => {
      const mirrored = findCausalOrEvaluativeTerm(text) === 'productivity'
      const exported = findForbiddenConstructTerm(text) === 'productivity'
      expect(mirrored).toBe(hit)
      expect(exported).toBe(hit)
      expect(mirrored).toBe(exported)
    })
  }
})

/* ------------------------------------------------------------------------------------------ *
 * validateFinding — happy path and registry resolution
 * ------------------------------------------------------------------------------------------ */

describe('validateFinding registry resolution', () => {
  it('accepts and round-trips a valid deterministic finding', () => {
    const finding = validateFinding(baseDeterministicFinding())
    expect(finding).toEqual(baseDeterministicFinding())
  })

  it('accepts a valid abstention finding', () => {
    expect(validateFinding(baseAbstentionFinding()).layer).toBe('abstention')
  })

  it('confirms the positive fixtures reference genuinely registered metrics', () => {
    expect(isRegisteredMetric(READY_COUNT_REF)).toBe(true)
  })

  it('fails closed on an unregistered metric reference', () => {
    expect(isRegisteredMetric(`${READY_COUNT_ID}@9.9.9`)).toBe(false)
    expectRejected(make(baseDeterministicFinding, {
      metricResults: [{ metricId: READY_COUNT_ID, metricVersion: '9.9.9', resultId: 'result_1', role: 'primary' }],
    }))
  })

  it('accepts a robustness check that names a real sensitivity variant of the primary', () => {
    const finding = make(baseDeterministicFinding, {
      limitations: [{ limitationCode: 'SAMPLE_TOO_SMALL', dimension: 'sample', copyKey: 'copy.sample_small' }],
      robustness: { status: 'stable', checks: [{ checkId: 'CHK_WEEK', statement: 'Recomputed on calendar-week-aligned windows.', outcome: 'held', sensitivityVariantId: READY_COUNT_VARIANT }] },
    })
    expect(validateFinding(finding).robustness.status).toBe('stable')
  })

  it('fails closed on a sensitivity variant the primary metric does not define', () => {
    const finding = make(baseDeterministicFinding, {
      robustness: { status: 'stable', checks: [{ checkId: 'CHK_BAD', statement: 'Recomputed under a variant of another metric.', outcome: 'held', sensitivityVariantId: WRONG_METRIC_VARIANT }] },
    })
    expect(() => validateFinding(finding)).toThrow(/does not define/)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * validateFinding — reference and structural rules
 * ------------------------------------------------------------------------------------------ */

describe('validateFinding structural rules', () => {
  it('requires exactly one primary metric result', () => {
    expectRejected(make(baseDeterministicFinding, {
      metricResults: [
        { metricId: READY_COUNT_ID, metricVersion: '1.0.0', resultId: 'result_1', role: 'primary' },
        { metricId: READY_COUNT_ID, metricVersion: '1.0.0', resultId: 'result_2', role: 'primary' },
      ],
    }))
    expectRejected(make(baseDeterministicFinding, {
      metricResults: [{ metricId: READY_COUNT_ID, metricVersion: '1.0.0', resultId: 'result_1', role: 'supporting' }],
    }))
  })

  it('requires distinct metric result references', () => {
    expectRejected(make(baseDeterministicFinding, {
      metricResults: [
        { metricId: READY_COUNT_ID, metricVersion: '1.0.0', resultId: 'result_1', role: 'primary' },
        { metricId: READY_COUNT_ID, metricVersion: '1.0.0', resultId: 'result_1', role: 'supporting' },
      ],
    }))
  })

  it('binds the sample summary to the primary result', () => {
    expectRejected(make(baseDeterministicFinding, { sampleSummary: { resultId: 'result_2', state: 'observed', counts: { eligible: 12, censored: 0, excluded: [] } } }))
  })

  it('requires at least one evidence reference above abstention', () => {
    expectRejected(make(baseDeterministicFinding, { evidence: [] }))
  })

  it('requires distinct evidence and counter-evidence, with no overlap', () => {
    expectRejected(make(baseDeterministicFinding, { evidence: [{ kind: 'claim', claimId: CLAIM_B, claimLayer: 'deterministic' }, { kind: 'claim', claimId: CLAIM_B, claimLayer: 'deterministic' }] }))
    expectRejected(make(baseDeterministicFinding, {
      evidence: [{ kind: 'claim', claimId: CLAIM_B, claimLayer: 'deterministic' }],
      counterEvidence: [{ kind: 'claim', claimId: CLAIM_B, claimLayer: 'deterministic' }],
    }))
  })

  it('requires unique mark ids', () => {
    expectRejected(make(baseDeterministicFinding, {
      marks: [
        { markId: 'mark_count', valueCategory: 'count', reference: { kind: 'claim', claimId: CLAIM_A, claimLayer: 'deterministic' } },
        { markId: 'mark_count', valueCategory: 'count', reference: { kind: 'claim', claimId: CLAIM_C, claimLayer: 'deterministic' } },
      ],
    }))
  })

  it('requires unique coverage dimensions', () => {
    expectRejected(make(baseDeterministicFinding, {
      coverage: [{ dimension: 'completeness', value: 1, limiting_reason: null }, { dimension: 'completeness', value: 1, limiting_reason: null }],
    }))
  })

  it('requires limitations distinct by code and dimension', () => {
    expectRejected(make(baseDeterministicFinding, {
      limitations: [
        { limitationCode: 'SAMPLE_TOO_SMALL', dimension: 'sample', copyKey: 'copy.a' },
        { limitationCode: 'SAMPLE_TOO_SMALL', dimension: 'sample', copyKey: 'copy.b' },
      ],
    }))
  })

  it('requires a presentable deterministic finding to render at least one mark', () => {
    expectRejected(make(baseDeterministicFinding, { marks: [] }))
  })

  it('requires a fragile finding to disclose at least one limitation', () => {
    expectRejected(make(baseDeterministicFinding, {
      robustness: { status: 'fragile', checks: [{ checkId: 'CHK', statement: 'Recomputed without the long tail.', outcome: 'changed_magnitude', sensitivityVariantId: null }] },
      limitations: [],
    }))
  })

  it('rejects a coverage entry whose null value carries no limiting reason', () => {
    expectRejected(make(baseDeterministicFinding, { coverage: [{ dimension: 'sample', value: null, limiting_reason: null }] }))
  })

  it('rejects a coverage limiting reason not registered for its dimension', () => {
    expectRejected(make(baseDeterministicFinding, { coverage: [{ dimension: 'sample', value: null, limiting_reason: 'NO_PARSER_FOR_LANGUAGE' }] }))
  })

  it('accepts a degraded-but-measured coverage dimension', () => {
    const finding = make(baseDeterministicFinding, { coverage: [{ dimension: 'completeness', value: 0.6, limiting_reason: 'SATURATION_CAP_REACHED' }] })
    expect(validateFinding(finding).coverage[0].value).toBe(0.6)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * Alternatives and the falsifier
 * ------------------------------------------------------------------------------------------ */

describe('alternatives and discriminating evidence', () => {
  it('rejects a hypothesis with no alternatives', () => {
    expectRejected(make(baseHypothesisFinding, { alternativeExplanations: [], discriminatingEvidence: null }))
  })

  it('rejects a non-hypothesis that offers a candidate interpretation', () => {
    expectRejected(make(baseDeterministicFinding, { candidateInterpretation: 'A neutral restatement of the count.' }))
  })

  it('requires discriminating evidence whenever alternatives are named', () => {
    expectRejected(make(baseHypothesisFinding, { discriminatingEvidence: null }))
  })

  it('rejects discriminating evidence when there are no alternatives', () => {
    expectRejected(make(baseDeterministicFinding, {
      discriminatingEvidence: { statement: 'This would separate two explanations that do not exist.', distinguishes: ['ALT_X'] },
    }))
  })

  it('rejects discriminating evidence that names an alternative the finding does not carry', () => {
    expectRejected(make(baseHypothesisFinding, {
      discriminatingEvidence: { statement: 'A calendar overlay would separate the two candidates.', distinguishes: ['ALT_FREEZE', 'ALT_UNLISTED'] },
    }))
  })

  it('rejects duplicate alternative codes', () => {
    expectRejected(make(baseHypothesisFinding, {
      alternativeExplanations: [
        { code: 'ALT_FREEZE', statement: 'A release freeze suppressed the transitions.' },
        { code: 'ALT_FREEZE', statement: 'The same code reused for a different statement.' },
      ],
      discriminatingEvidence: { statement: 'A calendar overlay would separate them.', distinguishes: ['ALT_FREEZE'] },
    }))
  })
})

/* ------------------------------------------------------------------------------------------ *
 * Layer honesty and relabelling
 * ------------------------------------------------------------------------------------------ */

describe('layer honesty and relabelling', () => {
  it('a looser-layer claim cannot render as a mark under a stricter finding layer', () => {
    const finding = make(baseDeterministicFinding, {
      marks: [{ markId: 'mark_count', valueCategory: 'count', reference: { kind: 'claim', claimId: CLAIM_A, claimLayer: 'modelled' } }],
    })
    expect(() => validateFinding(finding)).toThrow(/relabelling across evidence layers is forbidden/)
  })

  it('a looser-layer claim cannot be cited as evidence under a stricter finding layer', () => {
    expectRejected(make(baseDeterministicFinding, {
      evidence: [{ kind: 'claim', claimId: CLAIM_B, claimLayer: 'hypothesis' }],
    }))
  })

  it('a stricter-layer claim may render under a looser finding layer', () => {
    // A modelled finding presenting a deterministic claim is conservative, not a relabel.
    const finding = make(baseDeterministicFinding, {
      findingId: 'fnd_modelled_ready',
      layer: 'modelled',
      marks: [{ markId: 'mark_count', valueCategory: 'count', reference: { kind: 'claim', claimId: CLAIM_A, claimLayer: 'deterministic' } }],
      evidence: [{ kind: 'claim', claimId: CLAIM_B, claimLayer: 'deterministic' }],
    })
    expect(validateFinding(finding).layer).toBe('modelled')
  })

  it('an abstained claim has no value to render as a mark', () => {
    expect(() => validateFinding(make(baseDeterministicFinding, {
      marks: [{ markId: 'mark_count', valueCategory: 'count', reference: { kind: 'claim', claimId: CLAIM_A, claimLayer: 'abstention' } }],
    }))).toThrow(/no value to render/)
  })

  it('the abstention layer and its statement code imply each other', () => {
    expectRejected(make(baseAbstentionFinding, { statementCode: 'DELIVERY_FLOW' }))
    expectRejected(make(baseDeterministicFinding, { statementCode: 'ABSTAIN_LOW_COVERAGE' }))
  })

  it('only an abstention finding carries the failed floor', () => {
    expectRejected(make(baseDeterministicFinding, {
      abstention: { floorCode: 'F', dimension: 'sample', limitingReason: 'SAMPLE_BELOW_MINIMUM', statement: 'Floor not met on the sample dimension.', fallbackFindingId: null },
    }))
    expectRejected(make(baseAbstentionFinding, { abstention: null }))
  })

  it('an abstention renders no value marks', () => {
    expect(() => validateFinding(make(baseAbstentionFinding, {
      marks: [{ markId: 'mark_count', valueCategory: 'count', reference: { kind: 'claim', claimId: CLAIM_A, claimLayer: 'deterministic' } }],
    }))).toThrow(FindingContractError)
  })

  it('an abstention cannot name itself as its own fallback', () => {
    expect(() => validateFinding(make(baseAbstentionFinding, {
      abstention: { floorCode: 'F', dimension: 'sample', limitingReason: 'SAMPLE_BELOW_MINIMUM', statement: 'Floor not met on the sample dimension.', fallbackFindingId: 'fnd_ready_count_abstain' },
    }))).toThrow(/name itself/)
  })

  it('presentable-as-abstention belongs only to an abstention finding', () => {
    expectRejected(make(baseDeterministicFinding, { presentationEligibility: { eligible: true, reasonCode: 'PRESENTABLE_AS_ABSTENTION', surfaces: ['atlas'] } }))
  })

  it('a shown abstention is shown as an abstention, never as an ordinary finding', () => {
    expectRejected(make(baseAbstentionFinding, { presentationEligibility: { eligible: true, reasonCode: 'PRESENTABLE', surfaces: ['evidence_drawer'] } }))
  })
})

/* ------------------------------------------------------------------------------------------ *
 * References — format and parse
 * ------------------------------------------------------------------------------------------ */

describe('finding reference format and parse', () => {
  it('round-trips a finding reference', () => {
    const reference = formatFindingReference({ findingId: 'fnd_ready_count_det', version: '1.2.3' })
    expect(reference).toBe('fnd_ready_count_det@1.2.3')
    expect(parseFindingReference(reference)).toEqual({ findingId: 'fnd_ready_count_det', version: '1.2.3' })
  })

  it('splits on the last @ so only the version tail is the version', () => {
    // findingId cannot itself contain @, but the parser still uses lastIndexOf defensively.
    expect(parseFindingReference('fnd_x@1.0.0')).toEqual({ findingId: 'fnd_x', version: '1.0.0' })
  })

  it('rejects malformed references', () => {
    expect(() => parseFindingReference('no-separator')).toThrow(FindingContractError)
    expect(() => parseFindingReference('@1.0.0')).toThrow(FindingContractError)
    expect(() => parseFindingReference('fnd_x@')).toThrow(FindingContractError)
    expect(() => parseFindingReference('fnd_x@not-a-version')).toThrow(FindingContractError)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * The render gate
 * ------------------------------------------------------------------------------------------ */

describe('assertRenderableFinding', () => {
  it('returns a renderable finding on a listed surface', () => {
    const renderable = assertRenderableFinding(baseDeterministicFinding(), 'atlas')
    expect(renderable.surface).toBe('atlas')
    expect(renderable.reference).toBe('fnd_ready_count_det@1.0.0')
  })

  it('refuses a presentation-ineligible finding', () => {
    const finding = make(baseDeterministicFinding, { presentationEligibility: { eligible: false, reasonCode: 'COVERAGE_FLOOR_FAILED', surfaces: [] } })
    expect(() => assertRenderableFinding(finding, 'atlas')).toThrow(/not presentation-eligible/)
  })

  it('refuses a finding that is eligible on other surfaces only', () => {
    expect(() => assertRenderableFinding(baseDeterministicFinding(), 'story')).toThrow(/not eligible for the "story" surface/)
  })

  it('refuses an invalid candidate', () => {
    expect(() => assertRenderableFinding(make(baseDeterministicFinding, { evidence: [] }), 'atlas')).toThrow(FindingContractError)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * The abstention / deterministic-fallback pair
 * ------------------------------------------------------------------------------------------ */

describe('assertDeterministicFallbackPair', () => {
  function abstentionOf(): Payload {
    return make(baseAbstentionFinding, {
      findingId: 'fnd_pair_abstain',
      questionId: 'q_pair',
      method: { methodId: 'method_modelled_pair', methodVersion: '1.0.0' },
      abstention: { floorCode: 'SAMPLE_FLOOR', dimension: 'sample', limitingReason: 'SAMPLE_BELOW_MINIMUM', statement: 'Floor not met on the sample dimension.', fallbackFindingId: 'fnd_pair_fallback' },
    })
  }
  function fallbackOf(): Payload {
    return make(baseDeterministicFinding, {
      findingId: 'fnd_pair_fallback',
      questionId: 'q_pair',
      method: { methodId: 'method_deterministic_pair', methodVersion: '1.0.0' },
    })
  }

  it('accepts an honest pair: same question, different method, deterministic fallback', () => {
    const pair = assertDeterministicFallbackPair(abstentionOf(), fallbackOf())
    expect(pair.abstention.findingId).toBe('fnd_pair_abstain')
    expect(pair.fallback.findingId).toBe('fnd_pair_fallback')
  })

  it('rejects a fallback that reuses the abstained method id', () => {
    const fallback = make(fallbackOf, { method: { methodId: 'method_modelled_pair', methodVersion: '1.0.0' } })
    expect(() => assertDeterministicFallbackPair(abstentionOf(), fallback)).toThrow(/relabels modelled output as deterministic/)
  })

  it('rejects a fallback that answers a different question', () => {
    const fallback = make(fallbackOf, { questionId: 'q_other' })
    expect(() => assertDeterministicFallbackPair(abstentionOf(), fallback)).toThrow(/same question/)
  })

  it('rejects an abstention that does not name the fallback', () => {
    const abstention = make(abstentionOf, {
      abstention: { floorCode: 'SAMPLE_FLOOR', dimension: 'sample', limitingReason: 'SAMPLE_BELOW_MINIMUM', statement: 'Floor not met on the sample dimension.', fallbackFindingId: 'fnd_someone_else' },
    })
    expect(() => assertDeterministicFallbackPair(abstention, fallbackOf())).toThrow(/does not name/)
  })

  it('rejects a first finding that is not an abstention', () => {
    expect(() => assertDeterministicFallbackPair(fallbackOf(), fallbackOf())).toThrow(/first finding of a fallback pair is the abstention/)
  })

  it('rejects a fallback that is not deterministic', () => {
    expect(() => assertDeterministicFallbackPair(abstentionOf(), abstentionOf())).toThrow(/renders at the deterministic layer/)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * Evidence walk
 * ------------------------------------------------------------------------------------------ */

describe('buildFindingReferenceWalk', () => {
  it('orders the walk: results, then marks, then evidence, then counter-evidence', () => {
    const finding = validateFinding(make(baseDeterministicFinding, {
      counterEvidence: [{ kind: 'observation', evidenceId: 'ev_counter' }],
    }))
    const walk = buildFindingReferenceWalk(finding)
    expect(walk.map((entry) => entry.role)).toEqual(['metric_result', 'mark', 'evidence', 'counter_evidence'])
  })

  it('reads the metric result entry as provenance with no value category or layer', () => {
    const walk = buildFindingReferenceWalk(validateFinding(baseDeterministicFinding()))
    const result = walk[0]
    expect(result.referenceKind).toBe('metric_result')
    expect(result.id).toBe(`${READY_COUNT_ID}@1.0.0#result_1`)
    expect(result.valueCategory).toBeNull()
    expect(result.claimLayer).toBeNull()
  })

  it('reads every derived mark as a claim, never as an observation', () => {
    const walk = buildFindingReferenceWalk(validateFinding(baseDeterministicFinding()))
    const mark = walk.find((entry) => entry.role === 'mark')
    expect(mark?.referenceKind).toBe('claim')
    expect(mark?.valueCategory).toBe('count')
    expect(mark?.claimLayer).toBe('deterministic')
    expect(mark?.id).toBe(CLAIM_A)
  })

  it('labels evidence as supporting and counter-evidence as contradicting', () => {
    const finding = validateFinding(make(baseDeterministicFinding, {
      counterEvidence: [{ kind: 'observation', evidenceId: 'ev_counter' }],
    }))
    const walk = buildFindingReferenceWalk(finding)
    const supports = walk.find((entry) => entry.role === 'evidence')
    const contradicts = walk.find((entry) => entry.role === 'counter_evidence')
    expect(supports?.label).toBe('supports')
    expect(supports?.referenceKind).toBe('claim')
    expect(contradicts?.label).toBe('contradicts')
    expect(contradicts?.referenceKind).toBe('observation')
    expect(contradicts?.id).toBe('ev_counter')
  })
})
