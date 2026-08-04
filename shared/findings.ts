import { z } from 'zod'
import {
  CLAIM_ABSTENTION_STATEMENT_CODE,
  CLAIM_LAYERS,
  ClaimIdSchema,
  ClaimLayerSchema,
  ClaimStatementCodeSchema,
  LimitationInstanceSchema,
  MethodVersionSchema,
  OpaqueTokenSchema,
  type ClaimLayer,
  type ClaimStatementCode,
} from './claims.js'
import {
  CoverageDimensionSchema,
  CoverageLimitingReasonSchema,
  isLimitingReasonRegistered,
} from './coverage.js'
import {
  METRIC_RENDER_SURFACES,
  MetricResultStateSchema,
  findForbiddenConstructTerm,
  getMetricDefinition,
  isRegisteredMetric,
  type MetricCoverageEntry,
  type MetricResult,
} from './metrics.js'

/**
 * ADR-26 — finding contract and AnalyticReference.
 *
 * A finding is not a sentence attached to evidence. It is the answer to four questions at once:
 * what does the system claim, what contradicts it, what else could explain it, and how stable is
 * the claim under perturbation. This module is the versioned contract for that answer.
 *
 * It sits BETWEEN two merged contracts and re-litigates neither:
 *   - `shared/metrics.ts` (ADR-25) owns metric definitions, results, counts, states, coverage
 *     entries, sensitivity variants, and the forbidden-construct scan. A finding REFERENCES a
 *     result; it never re-derives, re-defines, or embeds one wholesale.
 *   - `shared/claims.ts` (ADR-01) owns claim layers, statement codes, limitation instances, and
 *     the `cl_` + 64 hex claim ID format. A finding reuses those schemas directly.
 *
 * There is deliberately no I/O, no network, no clock read, and no persistence here. Findings are
 * C1 by contract: no alias value, no person field, no X-class input.
 */
export const FINDING_CONTRACT_VERSION = '1.0.0' as const

/** Schema version carried by every finding payload; part of the `finding_id@version` identity. */
export const FINDING_SCHEMA_VERSION = '1.0.0' as const

/** Findings carry aggregate statements and content-free surrogates only. */
export const FINDING_DATA_CLASS = 'C1' as const

export class FindingContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FindingContractError'
  }
}

/* ------------------------------------------------------------------------------------------ *
 * Leaf schemas — reused from the merged contracts wherever one already exists
 * ------------------------------------------------------------------------------------------ */

const CodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]*$/)
const StatementSchema = z.string().min(12)
const MetricIdSchema = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/)
const MetricVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/)
const UnitIntervalSchema = z.number().min(0).max(1)
const NonnegativeIntegerSchema = z.number().int().nonnegative()

/**
 * `finding_id@version`. The id is an opaque token (the same structural rule `shared/claims.ts`
 * applies to every identifier-shaped field, so prose, paths, and human names are rejected
 * structurally) and the version is a semantic version.
 *
 * Deliberately NOT a content hash: minting deterministic analytic identities is DL-SPINE-02's
 * job, and inventing a second hashing scheme here would create a rival to it. `@` is outside the
 * opaque-token alphabet, so `lastIndexOf('@')` splits a reference unambiguously.
 */
export const FindingIdSchema = OpaqueTokenSchema
export const FindingVersionSchema = MethodVersionSchema

/** The four layers are `shared/claims.ts`'s, not a parallel set. */
export const FINDING_LAYERS = CLAIM_LAYERS
export const FindingLayerSchema = ClaimLayerSchema
export type FindingLayer = ClaimLayer

/**
 * Relabel ordering. A finding may present material from its own layer or a stricter one, never
 * from a looser one: a deterministic finding that renders a modelled claim would be exactly the
 * modelled -> deterministic relabel ADR-26 forbids. `abstention` sits at the top because an
 * abstention renders no value at all, so nothing it references can be dressed up by it.
 */
const LAYER_RANK: Readonly<Record<FindingLayer, number>> = {
  deterministic: 0,
  modelled: 1,
  hypothesis: 2,
  abstention: 3,
}

/* ------------------------------------------------------------------------------------------ *
 * AnalyticReference (ADR-26 §2)
 * ------------------------------------------------------------------------------------------ */

/**
 * An evidence anchor. `evidenceId` uses the opaque-token format `shared/claims.ts` gives
 * `EvidenceAnchor.evidenceId` and every evidence-targeted claim edge.
 */
export const ObservationReferenceSchema = z
  .object({
    kind: z.literal('observation'),
    evidenceId: OpaqueTokenSchema,
  })
  .strict()
export type ObservationReference = z.infer<typeof ObservationReferenceSchema>

/**
 * A claim reference. The ID format is `shared/claims.ts`'s `cl_` + 64 lowercase hex, reused as a
 * schema rather than restated, and no writer internal is imported: DL-SPINE-02 is bumping the ID
 * MATERIAL version, which changes what is hashed, not the shape of the resulting token.
 *
 * `claimLayer` records the layer of the claim this reference resolves to. It travels with the
 * reference because the layer-honesty rules below have to be decidable from the finding alone —
 * a resolver that walks to the stored claim row is the second line of defence, not the first.
 */
export const ClaimReferenceSchema = z
  .object({
    kind: z.literal('claim'),
    claimId: ClaimIdSchema,
    claimLayer: ClaimLayerSchema,
  })
  .strict()
export type ClaimReference = z.infer<typeof ClaimReferenceSchema>

export const AnalyticReferenceSchema = z.discriminatedUnion('kind', [
  ObservationReferenceSchema,
  ClaimReferenceSchema,
])
export type AnalyticReference = z.infer<typeof AnalyticReferenceSchema>

export function analyticReferenceId(reference: AnalyticReference): string {
  return reference.kind === 'claim' ? reference.claimId : reference.evidenceId
}

/**
 * Value categories for a rendered analytic mark.
 *
 * ADR-26: raw allowed provider/local facts resolve through an observation/evidence ID; counts,
 * ratios, quantiles, durations, shares, graph statistics, and deltas are DERIVED and are
 * deterministic claims. The UI never labels a parser-derived or aggregated number as observed.
 */
export const DERIVED_VALUE_CATEGORIES = [
  'count',
  'ratio',
  'quantile',
  'duration',
  'share',
  'delta',
  'graph_statistic',
] as const
export const OBSERVABLE_VALUE_CATEGORIES = ['raw_fact'] as const
export const FINDING_VALUE_CATEGORIES = [
  ...DERIVED_VALUE_CATEGORIES,
  ...OBSERVABLE_VALUE_CATEGORIES,
] as const
export const FindingValueCategorySchema = z.enum(FINDING_VALUE_CATEGORIES)
export type FindingValueCategory = z.infer<typeof FindingValueCategorySchema>

/** The reference kind a value category is allowed to resolve through. */
export function requiredReferenceKindFor(category: FindingValueCategory): AnalyticReference['kind'] {
  return (DERIVED_VALUE_CATEGORIES as readonly string[]).includes(category) ? 'claim' : 'observation'
}

const DerivedMarkSchema = z
  .object({
    markId: OpaqueTokenSchema,
    valueCategory: z.enum(DERIVED_VALUE_CATEGORIES),
    reference: ClaimReferenceSchema,
  })
  .strict()

const ObservedMarkSchema = z
  .object({
    markId: OpaqueTokenSchema,
    valueCategory: z.enum(OBSERVABLE_VALUE_CATEGORIES),
    reference: ObservationReferenceSchema,
  })
  .strict()

/**
 * Every rendered analytic mark, paired with the reference it resolves through.
 *
 * The pairing is structural, not a refinement: a `count` mark carrying an ObservationReference
 * matches neither branch of the union, so "derived number presented as an observation" is
 * unrepresentable rather than merely invalid.
 */
export const RenderedMarkSchema = z.union([DerivedMarkSchema, ObservedMarkSchema], {
  error:
    'A derived value (count, ratio, quantile, duration, share, delta, graph statistic) resolves through a ClaimReference; only a raw allowed fact resolves through an ObservationReference',
})
export type RenderedMark = z.infer<typeof RenderedMarkSchema>

/** The same rule as a predicate, for callers holding a mark that has already been parsed. */
export function markReferenceKindMatches(mark: RenderedMark): boolean {
  return mark.reference.kind === requiredReferenceKindFor(mark.valueCategory)
}

/* ------------------------------------------------------------------------------------------ *
 * Metric result references — pointers, never embedded results
 * ------------------------------------------------------------------------------------------ */

export const FINDING_RESULT_ROLES = ['primary', 'supporting'] as const
export const FindingResultRoleSchema = z.enum(FINDING_RESULT_ROLES)
export type FindingResultRole = z.infer<typeof FindingResultRoleSchema>

/**
 * `metric_id@version` plus the id of the result row it was computed into. The result itself is
 * NOT embedded: a finding that carried a copy of the numbers could drift from the row that
 * produced them, and the evidence walk exists precisely so the drawer resolves the live row.
 *
 * `scopeAlias` is deliberately absent although `MetricResult` carries one — the alias VALUE is a
 * C2 fact, and this contract is C1. The finding carries the content-free `scopeId` surrogate.
 */
export const MetricResultReferenceSchema = z
  .object({
    metricId: MetricIdSchema,
    metricVersion: MetricVersionSchema,
    resultId: z.string().min(1),
    role: FindingResultRoleSchema,
  })
  .strict()
export type MetricResultReference = z.infer<typeof MetricResultReferenceSchema>

export function formatMetricResultReference(reference: MetricResultReference): string {
  return `${reference.metricId}@${reference.metricVersion}#${reference.resultId}`
}

/* ------------------------------------------------------------------------------------------ *
 * Sample / eligibility / censoring summary and metric-specific coverage
 * ------------------------------------------------------------------------------------------ */

type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never

/**
 * The eligible / censored / excluded counts, in `shared/metrics.ts`'s shape. The invariants are
 * mirrored so an embedded summary cannot contradict the result it summarises, and the exported
 * constant below is a compile-time proof that the shape IS `MetricResult['counts']` — if ADR-25's
 * counts change, this module stops compiling, which is the point of writing it down.
 */
const FindingSampleCountsSchema = z
  .object({
    eligible: NonnegativeIntegerSchema,
    censored: NonnegativeIntegerSchema,
    excluded: z.array(z.object({ reasonCode: CodeSchema, count: z.number().int().positive() }).strict()),
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
export type FindingSampleCounts = z.infer<typeof FindingSampleCountsSchema>

export const SAMPLE_COUNTS_MATCH_METRIC_COUNTS: MutuallyAssignable<
  FindingSampleCounts,
  MetricResult['counts']
> = true

/**
 * The sample/eligibility/censoring summary. `state` is `shared/metrics.ts`'s result-state enum,
 * so "the eligible cohort was empty" is the typed `empty_eligible_cohort` state (issue #67) and
 * never a parallel boolean invented here.
 */
export const FindingSampleSummarySchema = z
  .object({
    resultId: z.string().min(1),
    state: MetricResultStateSchema,
    counts: FindingSampleCountsSchema,
  })
  .strict()
  .superRefine((summary, context) => {
    if (summary.state === 'empty_eligible_cohort' && (summary.counts.eligible !== 0 || summary.counts.censored !== 0)) {
      context.addIssue({
        code: 'custom',
        message: 'An empty eligible cohort has zero eligible and zero censored units',
        path: ['counts'],
      })
    }
  })
export type FindingSampleSummary = z.infer<typeof FindingSampleSummarySchema>

/**
 * One metric-specific coverage entry, in the canonical `{ value, limiting_reason }` shape — the
 * snake_case wire spelling is load-bearing and is not harmonised to camelCase. The constant below
 * proves the shape is `MetricCoverageEntry`, not a copy of it.
 */
const FindingCoverageEntrySchema = z
  .object({
    dimension: CoverageDimensionSchema,
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
export type FindingCoverageEntry = z.infer<typeof FindingCoverageEntrySchema>

export const COVERAGE_ENTRY_MATCHES_METRIC_COVERAGE_ENTRY: MutuallyAssignable<
  FindingCoverageEntry,
  MetricCoverageEntry
> = true

/* ------------------------------------------------------------------------------------------ *
 * Alternatives, discriminating evidence, robustness
 * ------------------------------------------------------------------------------------------ */

const AlternativeExplanationSchema = z
  .object({ code: CodeSchema, statement: StatementSchema })
  .strict()
export type AlternativeExplanation = z.infer<typeof AlternativeExplanationSchema>

/**
 * What evidence would distinguish the alternatives. `distinguishes` names the alternatives the
 * statement would separate, so "we listed alternatives and then said nothing useful about them"
 * is a schema error rather than a review finding.
 */
const DiscriminatingEvidenceSchema = z
  .object({
    statement: StatementSchema,
    distinguishes: z.array(CodeSchema).min(1),
  })
  .strict()
export type DiscriminatingEvidence = z.infer<typeof DiscriminatingEvidenceSchema>

export const ROBUSTNESS_STATUSES = ['not-tested', 'fragile', 'stable'] as const
export const RobustnessStatusSchema = z.enum(ROBUSTNESS_STATUSES)
export type RobustnessStatus = z.infer<typeof RobustnessStatusSchema>

export const ROBUSTNESS_CHECK_OUTCOMES = [
  'held',
  'changed_magnitude',
  'changed_direction',
  'not_applicable',
] as const
export const RobustnessCheckOutcomeSchema = z.enum(ROBUSTNESS_CHECK_OUTCOMES)

/**
 * A named robustness check. `sensitivityVariantId`, when present, names a sensitivity variant of
 * the finding's primary metric definition (ADR-25 owns those variants; `validateFinding` resolves
 * the name against the registry rather than restating the list).
 */
const RobustnessCheckSchema = z
  .object({
    checkId: CodeSchema,
    statement: StatementSchema,
    outcome: RobustnessCheckOutcomeSchema,
    sensitivityVariantId: CodeSchema.nullable(),
  })
  .strict()

/**
 * Robustness status with its named checks. `not-tested` FORBIDS checks — a status that says
 * nothing was tested while listing tests is the exact dishonesty this field exists to prevent —
 * and `stable` / `fragile` each require at least one. A check that flipped the direction of the
 * reading cannot coexist with `stable`.
 */
export const FindingRobustnessSchema = z
  .object({
    status: RobustnessStatusSchema,
    checks: z.array(RobustnessCheckSchema),
  })
  .strict()
  .superRefine((robustness, context) => {
    if (robustness.status === 'not-tested' && robustness.checks.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'A not-tested robustness status carries no checks; naming checks means the status is stable or fragile',
        path: ['checks'],
      })
    }
    if (robustness.status !== 'not-tested' && robustness.checks.length === 0) {
      context.addIssue({
        code: 'custom',
        message: `A ${robustness.status} robustness status requires at least one named check`,
        path: ['checks'],
      })
    }
    const checkIds = new Set(robustness.checks.map((check) => check.checkId))
    if (checkIds.size !== robustness.checks.length) {
      context.addIssue({ code: 'custom', message: 'Robustness check ids must be unique', path: ['checks'] })
    }
    if (robustness.status === 'stable' && robustness.checks.some((check) => check.outcome === 'changed_direction')) {
      context.addIssue({
        code: 'custom',
        message: 'A check that changed the direction of the reading makes the finding fragile, not stable',
        path: ['status'],
      })
    }
  })
export type FindingRobustness = z.infer<typeof FindingRobustnessSchema>

/* ------------------------------------------------------------------------------------------ *
 * Presentation eligibility and abstention
 * ------------------------------------------------------------------------------------------ */

export const FINDING_PRESENTATION_REASONS = [
  'PRESENTABLE',
  'PRESENTABLE_AS_ABSTENTION',
  'ABSTAINED',
  'METRIC_DISPLAY_GATED',
  'COVERAGE_FLOOR_FAILED',
  'ALTERNATIVES_UNRESOLVED',
  'ROBUSTNESS_NOT_TESTED',
] as const
export const FindingPresentationReasonSchema = z.enum(FINDING_PRESENTATION_REASONS)
export type FindingPresentationReason = z.infer<typeof FindingPresentationReasonSchema>

const PRESENTABLE_REASONS = ['PRESENTABLE', 'PRESENTABLE_AS_ABSTENTION'] as const

/** Render surfaces are `shared/metrics.ts`'s closed set; a finding cannot invent a surface. */
export const FindingSurfaceSchema = z.enum(METRIC_RENDER_SURFACES)

export const PresentationEligibilitySchema = z
  .object({
    eligible: z.boolean(),
    reasonCode: FindingPresentationReasonSchema,
    surfaces: z.array(FindingSurfaceSchema),
  })
  .strict()
  .superRefine((eligibility, context) => {
    const presentable = (PRESENTABLE_REASONS as readonly string[]).includes(eligibility.reasonCode)
    if (eligibility.eligible !== presentable) {
      context.addIssue({
        code: 'custom',
        message: 'A presentable finding names a presentable reason code, and an ineligible one names why it is withheld',
        path: ['reasonCode'],
      })
    }
    if (eligibility.eligible && eligibility.surfaces.length === 0) {
      context.addIssue({ code: 'custom', message: 'A presentable finding names at least one surface', path: ['surfaces'] })
    }
    if (!eligibility.eligible && eligibility.surfaces.length > 0) {
      context.addIssue({ code: 'custom', message: 'An ineligible finding renders on no surface', path: ['surfaces'] })
    }
    const surfaces = new Set(eligibility.surfaces)
    if (surfaces.size !== eligibility.surfaces.length) {
      context.addIssue({ code: 'custom', message: 'Surfaces must be unique', path: ['surfaces'] })
    }
  })
export type PresentationEligibility = z.infer<typeof PresentationEligibilitySchema>

/**
 * The failed floor an abstention carries. The dimension and the limiting reason come from the
 * coverage registry and are checked against it, so an abstention can never cite a reason that
 * dimension does not register.
 *
 * `fallbackFindingId` is the ONLY link between an abstained modelled finding and a deterministic
 * fallback: the fallback is a separate finding, under its own method, with its own claim. There
 * is no field anywhere in this contract that lets a modelled finding re-emit itself as
 * deterministic.
 */
export const FindingAbstentionSchema = z
  .object({
    floorCode: CodeSchema,
    dimension: CoverageDimensionSchema,
    limitingReason: CoverageLimitingReasonSchema,
    statement: StatementSchema,
    fallbackFindingId: FindingIdSchema.nullable(),
  })
  .strict()
  .superRefine((abstention, context) => {
    if (!isLimitingReasonRegistered(abstention.dimension, abstention.limitingReason)) {
      context.addIssue({
        code: 'custom',
        message: `Limiting reason ${abstention.limitingReason} is not registered for the ${abstention.dimension} dimension`,
        path: ['limitingReason'],
      })
    }
  })
export type FindingAbstention = z.infer<typeof FindingAbstentionSchema>

/* ------------------------------------------------------------------------------------------ *
 * Copy test — causal and evaluative wording
 * ------------------------------------------------------------------------------------------ */

/**
 * Token-aware matching, mirrored from `shared/metrics.ts`. That module's `tokenize`/`matchesTerm`
 * pair is not exported, so the primitive is restated here rather than reimplemented differently:
 * identifiers split on separators and camelCase humps, prose splits on word boundaries, and a
 * term matches a whole token only. `shared/findings.test.ts` pins the two to the same behaviour.
 *
 * The blended-construct half of the scan is NOT restated: `findForbiddenConstructTerm` is
 * imported from `shared/metrics.ts` and used as-is.
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

/**
 * Causal wording. A deterministic reading measures what happened, not why it happened, and no
 * metric in the registry licenses an attribution.
 */
export const CAUSAL_TERMS = [
  'because',
  'cause',
  'caused',
  'causes',
  'causing',
  'drives',
  'drove',
  'driven',
  'leads',
  'led',
  'due',
  'therefore',
  'thus',
  'hence',
  'resulted',
  'resulting',
  'explains',
  'explained',
  'attributable',
  'influence',
  'influenced',
] as const

/**
 * Evaluative wording. "Faster is better" is a judgement about people and process that no counted
 * interval supports; neutral phrasing states the measured change instead ("the median was four
 * hours lower than the previous window").
 *
 * The blended-construct family — productivity, performance, efficiency, impact, health, score,
 * rating, grade — is covered by `findForbiddenConstructTerm` and is not duplicated here, except
 * for `productivity`, which is kept so the mirrored tokenizer can be pinned against the exported
 * one on a shared term.
 */
export const EVALUATIVE_TERMS = [
  'better',
  'best',
  'worse',
  'worst',
  'improves',
  'improved',
  'improving',
  'improvement',
  'faster',
  'slower',
  'degrades',
  'degraded',
  'degrading',
  'healthy',
  'healthier',
  'optimal',
  'ideal',
  'poor',
  'blame',
  'responsible',
  'productivity',
] as const

export const CAUSAL_OR_EVALUATIVE_TERMS = [...CAUSAL_TERMS, ...EVALUATIVE_TERMS] as const

/**
 * The escape hatch, closed and explicit: which statement codes license which terms.
 *
 * The two coverage-shaped codes license `because` so a finding can explain an INSTRUMENT
 * limitation ("the count is incomplete because the connector was never authorised"). That is a
 * statement about the collector, not about the subject; no code licenses a subject-level cause,
 * and every other registered code licenses nothing.
 */
export const STATEMENT_CODE_LICENSED_TERMS: Readonly<Record<ClaimStatementCode, readonly string[]>> = {
  ABSTAIN_LOW_COVERAGE: ['because'],
  CI_RERUN_PATTERN: [],
  COVERAGE_GAP: ['because'],
  DELIVERY_FLOW: [],
  OWNERSHIP_COVERAGE: [],
}

for (const [statementCode, licensed] of Object.entries(STATEMENT_CODE_LICENSED_TERMS)) {
  for (const term of licensed) {
    if (!(CAUSAL_OR_EVALUATIVE_TERMS as readonly string[]).includes(term)) {
      throw new FindingContractError(
        `Statement code ${statementCode} licenses "${term}", which is not a scanned causal or evaluative term`,
      )
    }
  }
}

/** The first causal or evaluative term in `value` that `licensed` does not permit, or null. */
export function findCausalOrEvaluativeTerm(
  value: string,
  licensed: readonly string[] = [],
): string | null {
  const tokens = tokenize(value)
  for (const term of CAUSAL_OR_EVALUATIVE_TERMS) {
    if (licensed.includes(term)) {
      continue
    }
    if (matchesTerm(tokens, term)) {
      return term
    }
  }
  return null
}

interface CopyScanTarget {
  readonly field: string
  readonly text: string
  readonly scanCausal: boolean
}

/**
 * The text-bearing shape of a finding, spelled out rather than inferred: the scan runs inside
 * `FindingSchema`'s own refinement, so referring to `Finding` here would make the schema's type
 * circular. Same reason `shared/metrics.ts` spells out `ScannableDefinition`.
 */
interface ScannableFinding {
  readonly observation: string
  readonly candidateInterpretation: string | null
  readonly alternativeExplanations: readonly { readonly statement: string }[]
  readonly discriminatingEvidence: { readonly statement: string } | null
  readonly robustness: { readonly checks: readonly { readonly statement: string }[] }
  readonly abstention: { readonly statement: string } | null
}

/**
 * Which text a finding gets scanned for, and for what.
 *
 * `limitations` carry copy keys rather than prose, and `prohibitedInterpretations` are EXEMPT
 * from both scans — exactly as `shared/metrics.ts` exempts its own prohibited interpretations and
 * confounders. Those fields exist so an author can write "this is never a productivity measure",
 * and scanning them would make the required warning impossible to express.
 *
 * `candidateInterpretation`, `alternativeExplanations`, and `discriminatingEvidence` are where a
 * causal reading is ALLOWED to be named — that is what a hypothesis is — so they are scanned for
 * blended constructs only. The `observation` is what was measured, at every layer, so it is
 * scanned for both.
 */
function copyScanTargets(finding: Finding): readonly CopyScanTarget[] {
  const targets: CopyScanTarget[] = [
    { field: 'observation', text: finding.observation, scanCausal: true },
  ]
  if (finding.candidateInterpretation !== null) {
    targets.push({ field: 'candidateInterpretation', text: finding.candidateInterpretation, scanCausal: false })
  }
  finding.alternativeExplanations.forEach((alternative, index) => {
    targets.push({ field: `alternativeExplanations.${index}.statement`, text: alternative.statement, scanCausal: false })
  })
  if (finding.discriminatingEvidence !== null) {
    targets.push({ field: 'discriminatingEvidence.statement', text: finding.discriminatingEvidence.statement, scanCausal: false })
  }
  finding.robustness.checks.forEach((check, index) => {
    targets.push({ field: `robustness.checks.${index}.statement`, text: check.statement, scanCausal: false })
  })
  if (finding.abstention !== null) {
    targets.push({ field: 'abstention.statement', text: finding.abstention.statement, scanCausal: true })
  }
  return targets
}

/* ------------------------------------------------------------------------------------------ *
 * Banned band-shaped fields
 * ------------------------------------------------------------------------------------------ */

/**
 * ADR-26: confidence never re-collapses into a scalar or a low/medium/high band. Every schema
 * here is strict, so such a field is already unrepresentable; this scan runs first only so the
 * failure says WHY instead of "unrecognized key".
 */
export const BANNED_FIELD_TERMS = [
  'confidence',
  'score',
  'rating',
  'band',
  'grade',
  'certainty',
  'likelihood',
  'probability',
] as const

export function findBannedFieldName(candidate: unknown, path: readonly string[] = []): string | null {
  if (Array.isArray(candidate)) {
    for (const [index, entry] of candidate.entries()) {
      const found = findBannedFieldName(entry, [...path, String(index)])
      if (found) {
        return found
      }
    }
    return null
  }
  if (candidate === null || typeof candidate !== 'object') {
    return null
  }
  for (const [key, value] of Object.entries(candidate)) {
    const tokens = tokenize(key)
    for (const term of BANNED_FIELD_TERMS) {
      if (matchesTerm(tokens, term)) {
        return [...path, key].join('.')
      }
    }
    const found = findBannedFieldName(value, [...path, key])
    if (found) {
      return found
    }
  }
  return null
}

/* ------------------------------------------------------------------------------------------ *
 * The finding contract
 * ------------------------------------------------------------------------------------------ */

export const FindingSchema = z
  .object({
    findingId: FindingIdSchema,
    version: FindingVersionSchema,
    schemaVersion: z.literal(FINDING_SCHEMA_VERSION),
    questionId: OpaqueTokenSchema,
    layer: FindingLayerSchema,
    statementCode: ClaimStatementCodeSchema,
    /** The method that produced this finding. A fallback finding carries a DIFFERENT method. */
    method: z.object({ methodId: OpaqueTokenSchema, methodVersion: MethodVersionSchema }).strict(),
    /** The content-free scope surrogate, never the C2 alias value. */
    scopeId: OpaqueTokenSchema,
    /** A finding cannot exist, let alone render, without metric/result provenance. */
    metricResults: z.array(MetricResultReferenceSchema).min(1),
    observation: StatementSchema,
    /** Hypothesis-only: the candidate interpretation being offered, never asserted. */
    candidateInterpretation: StatementSchema.nullable(),
    marks: z.array(RenderedMarkSchema),
    evidence: z.array(AnalyticReferenceSchema),
    counterEvidence: z.array(AnalyticReferenceSchema),
    alternativeExplanations: z.array(AlternativeExplanationSchema),
    /** `shared/claims.ts`'s limitation instances, reused whole. */
    limitations: z.array(LimitationInstanceSchema),
    /** Scan-exempt, as in `shared/metrics.ts`: this is where "never a productivity measure" goes. */
    prohibitedInterpretations: z.array(z.object({ code: CodeSchema, statement: StatementSchema }).strict()),
    sampleSummary: FindingSampleSummarySchema,
    coverage: z.array(FindingCoverageEntrySchema).min(1),
    robustness: FindingRobustnessSchema,
    discriminatingEvidence: DiscriminatingEvidenceSchema.nullable(),
    presentationEligibility: PresentationEligibilitySchema,
    abstention: FindingAbstentionSchema.nullable(),
  })
  .strict()
  .superRefine((finding, context) => {
    /* -- Layer honesty ---------------------------------------------------------------------- */

    const abstains = finding.layer === 'abstention'
    if (abstains !== (finding.statementCode === CLAIM_ABSTENTION_STATEMENT_CODE)) {
      context.addIssue({
        code: 'custom',
        message: `${CLAIM_ABSTENTION_STATEMENT_CODE} and the abstention layer imply each other`,
        path: ['statementCode'],
      })
    }
    if (abstains !== (finding.abstention !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'An abstention finding carries the failed floor; a non-abstention finding carries none',
        path: ['abstention'],
      })
    }
    if (abstains && finding.marks.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'An abstention renders no value marks; a deterministic fallback is a separate finding under its own method',
        path: ['marks'],
      })
    }
    if (abstains && finding.abstention?.fallbackFindingId === finding.findingId) {
      context.addIssue({
        code: 'custom',
        message: 'A deterministic fallback is a SEPARATE finding; an abstention cannot name itself as its own fallback',
        path: ['abstention', 'fallbackFindingId'],
      })
    }
    if (!abstains && finding.presentationEligibility.reasonCode === 'PRESENTABLE_AS_ABSTENTION') {
      context.addIssue({
        code: 'custom',
        message: 'Only an abstention finding presents as an abstention',
        path: ['presentationEligibility', 'reasonCode'],
      })
    }
    if (abstains && finding.presentationEligibility.reasonCode === 'PRESENTABLE') {
      context.addIssue({
        code: 'custom',
        message: 'An abstention that is shown is shown AS an abstention, never as an ordinary finding',
        path: ['presentationEligibility', 'reasonCode'],
      })
    }

    const referenceGroups: Array<readonly [string, readonly AnalyticReference[]]> = [
      ['marks', finding.marks.map((mark) => mark.reference)],
      ['evidence', finding.evidence],
      ['counterEvidence', finding.counterEvidence],
    ]
    for (const [field, references] of referenceGroups) {
      references.forEach((reference, index) => {
        if (reference.kind !== 'claim') {
          return
        }
        if (field === 'marks' && reference.claimLayer === 'abstention') {
          context.addIssue({
            code: 'custom',
            message: 'An abstained claim has no value to render',
            path: [field, index],
          })
          return
        }
        if (LAYER_RANK[reference.claimLayer] > LAYER_RANK[finding.layer]) {
          context.addIssue({
            code: 'custom',
            message: `A ${finding.layer} finding cannot present a ${reference.claimLayer} claim; relabelling across evidence layers is forbidden`,
            path: [field, index, 'claimLayer'],
          })
        }
      })
    }

    if (finding.layer !== 'hypothesis' && finding.candidateInterpretation !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Only a hypothesis offers a candidate interpretation',
        path: ['candidateInterpretation'],
      })
    }

    /* -- Alternatives and the falsifier ------------------------------------------------------ */

    if (finding.layer === 'hypothesis' && finding.alternativeExplanations.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'A hypothesis without alternative explanations is an assertion',
        path: ['alternativeExplanations'],
      })
    }
    const alternativeCodes = new Set(finding.alternativeExplanations.map((alternative) => alternative.code))
    if (alternativeCodes.size !== finding.alternativeExplanations.length) {
      context.addIssue({ code: 'custom', message: 'Alternative explanation codes must be unique', path: ['alternativeExplanations'] })
    }
    if (finding.alternativeExplanations.length > 0 && finding.discriminatingEvidence === null) {
      context.addIssue({
        code: 'custom',
        message: 'Naming alternatives requires saying what evidence would distinguish them',
        path: ['discriminatingEvidence'],
      })
    }
    if (finding.alternativeExplanations.length === 0 && finding.discriminatingEvidence !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Discriminating evidence distinguishes alternatives; there are none',
        path: ['discriminatingEvidence'],
      })
    }
    if (finding.discriminatingEvidence) {
      const distinguishes = finding.discriminatingEvidence.distinguishes
      if (new Set(distinguishes).size !== distinguishes.length) {
        context.addIssue({ code: 'custom', message: 'Distinguished alternative codes must be unique', path: ['discriminatingEvidence', 'distinguishes'] })
      }
      distinguishes.forEach((code, index) => {
        if (!alternativeCodes.has(code)) {
          context.addIssue({
            code: 'custom',
            message: `Discriminating evidence names "${code}", which is not one of this finding's alternatives`,
            path: ['discriminatingEvidence', 'distinguishes', index],
          })
        }
      })
    }

    /* -- References ------------------------------------------------------------------------- */

    const primaryCount = finding.metricResults.filter((reference) => reference.role === 'primary').length
    if (primaryCount !== 1) {
      context.addIssue({
        code: 'custom',
        message: 'A finding names exactly one primary metric result; the summary and coverage below describe it',
        path: ['metricResults'],
      })
    }
    const resultKeys = new Set(finding.metricResults.map(formatMetricResultReference))
    if (resultKeys.size !== finding.metricResults.length) {
      context.addIssue({ code: 'custom', message: 'Metric result references must be distinct', path: ['metricResults'] })
    }
    const primary = finding.metricResults.find((reference) => reference.role === 'primary')
    if (primary && finding.sampleSummary.resultId !== primary.resultId) {
      context.addIssue({
        code: 'custom',
        message: 'The sample summary summarises the primary metric result',
        path: ['sampleSummary', 'resultId'],
      })
    }

    if (!abstains && finding.evidence.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'A finding above abstention rests on at least one evidence reference',
        path: ['evidence'],
      })
    }
    const evidenceIds = finding.evidence.map(analyticReferenceId)
    if (new Set(evidenceIds).size !== evidenceIds.length) {
      context.addIssue({ code: 'custom', message: 'Evidence references must be distinct', path: ['evidence'] })
    }
    const counterIds = finding.counterEvidence.map(analyticReferenceId)
    if (new Set(counterIds).size !== counterIds.length) {
      context.addIssue({ code: 'custom', message: 'Counter-evidence references must be distinct', path: ['counterEvidence'] })
    }
    const overlap = counterIds.filter((id) => evidenceIds.includes(id))
    if (overlap.length > 0) {
      context.addIssue({
        code: 'custom',
        message: `Reference ${overlap[0]} is cited as both evidence and counter-evidence`,
        path: ['counterEvidence'],
      })
    }
    const markIds = finding.marks.map((mark) => mark.markId)
    if (new Set(markIds).size !== markIds.length) {
      context.addIssue({ code: 'custom', message: 'Mark ids must be unique', path: ['marks'] })
    }

    const dimensions = new Set(finding.coverage.map((entry) => entry.dimension))
    if (dimensions.size !== finding.coverage.length) {
      context.addIssue({ code: 'custom', message: 'Coverage dimensions must be unique on a finding', path: ['coverage'] })
    }
    const limitationKeys = new Set(finding.limitations.map((limitation) => `${limitation.limitationCode}|${limitation.dimension}`))
    if (limitationKeys.size !== finding.limitations.length) {
      context.addIssue({ code: 'custom', message: 'Limitations must be distinct by code and dimension', path: ['limitations'] })
    }

    /* -- Presentation ------------------------------------------------------------------------ */

    if (finding.robustness.status === 'fragile' && finding.limitations.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'A fragile finding discloses at least one limitation',
        path: ['limitations'],
      })
    }
    if (
      finding.presentationEligibility.eligible &&
      (finding.layer === 'deterministic' || finding.layer === 'modelled') &&
      finding.marks.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A presentable deterministic or modelled finding renders at least one referenced mark',
        path: ['marks'],
      })
    }

    /* -- Copy test --------------------------------------------------------------------------- */

    const licensed = STATEMENT_CODE_LICENSED_TERMS[finding.statementCode]
    for (const target of copyScanTargets(finding)) {
      const construct = findForbiddenConstructTerm(target.text)
      if (construct) {
        context.addIssue({
          code: 'custom',
          message: `Forbidden construct term "${construct}" in ${target.field}: a finding never names a blended or person-scoring construct`,
          path: target.field.split('.'),
        })
        continue
      }
      if (!target.scanCausal) {
        continue
      }
      const causal = findCausalOrEvaluativeTerm(target.text, licensed)
      if (causal) {
        context.addIssue({
          code: 'custom',
          message: `Causal or evaluative term "${causal}" in ${target.field} is not licensed by statement code ${finding.statementCode}`,
          path: target.field.split('.'),
        })
      }
    }
  })

export type Finding = z.infer<typeof FindingSchema>

export function formatFindingReference(finding: Pick<Finding, 'findingId' | 'version'>): string {
  return `${finding.findingId}@${finding.version}`
}

export function parseFindingReference(reference: string): { findingId: string; version: string } {
  const separator = reference.lastIndexOf('@')
  if (separator <= 0) {
    throw new FindingContractError(`Finding reference must be "finding_id@version": received "${reference}"`)
  }
  const parsed = z
    .object({ findingId: FindingIdSchema, version: FindingVersionSchema })
    .strict()
    .safeParse({ findingId: reference.slice(0, separator), version: reference.slice(separator + 1) })
  if (!parsed.success) {
    throw new FindingContractError(`Finding reference is malformed: "${reference}"`)
  }
  return parsed.data
}

/* ------------------------------------------------------------------------------------------ *
 * Validation against the metric registry
 * ------------------------------------------------------------------------------------------ */

/**
 * Parses a finding and resolves everything it points at that lives in another contract: every
 * metric reference must be a registered `metric_id@version`, and every robustness check that
 * names a sensitivity variant must name one the primary metric actually defines.
 *
 * Fails closed. A finding whose numbers came from a metric nobody wrote down cannot be validated,
 * and therefore cannot be rendered.
 */
export function validateFinding(candidate: unknown): Finding {
  const bannedField = findBannedFieldName(candidate)
  if (bannedField) {
    throw new FindingContractError(
      `Field "${bannedField}" is a confidence, score, rating, or band field; claim state is a closed enum and never a scalar or a low/medium/high band`,
    )
  }

  const parsed = FindingSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new FindingContractError(
      `Finding is invalid: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
    )
  }
  const finding = parsed.data

  for (const reference of finding.metricResults) {
    const metricReference = `${reference.metricId}@${reference.metricVersion}`
    if (!isRegisteredMetric(metricReference)) {
      throw new FindingContractError(
        `Finding references metric ${metricReference}, which is not registered; an undocumented metric cannot back a finding`,
      )
    }
  }

  const primary = finding.metricResults.find((reference) => reference.role === 'primary')
  if (primary) {
    const definition = getMetricDefinition(`${primary.metricId}@${primary.metricVersion}`)
    const variantIds = new Set(definition.sensitivityVariants.map((variant) => variant.variantId))
    for (const check of finding.robustness.checks) {
      if (check.sensitivityVariantId !== null && !variantIds.has(check.sensitivityVariantId)) {
        throw new FindingContractError(
          `Robustness check ${check.checkId} names sensitivity variant "${check.sensitivityVariantId}", which ${primary.metricId}@${primary.metricVersion} does not define`,
        )
      }
    }
  }

  return finding
}

export interface RenderableFinding {
  finding: Finding
  reference: string
  surface: (typeof METRIC_RENDER_SURFACES)[number]
}

/**
 * The render gate. A finding that is not presentation-eligible, or that is eligible on other
 * surfaces only, fails closed here rather than being quietly downgraded at the surface.
 */
export function assertRenderableFinding(
  candidate: unknown,
  surface: (typeof METRIC_RENDER_SURFACES)[number],
): RenderableFinding {
  const finding = validateFinding(candidate)
  if (!finding.presentationEligibility.eligible) {
    throw new FindingContractError(
      `Finding ${formatFindingReference(finding)} is not presentation-eligible (${finding.presentationEligibility.reasonCode})`,
    )
  }
  if (!finding.presentationEligibility.surfaces.includes(surface)) {
    throw new FindingContractError(
      `Finding ${formatFindingReference(finding)} is not eligible for the "${surface}" surface`,
    )
  }
  return { finding, reference: formatFindingReference(finding), surface }
}

/**
 * The abstention/fallback pair check (ADR-26). A modelled finding that fails its floor abstains;
 * any deterministic fallback is a SEPARATE finding, answering the same question, under its own
 * method, referencing its own deterministic claim. This asserts the pair is honest — most
 * importantly that the fallback did not simply re-emit the modelled reading under a new label.
 */
export function assertDeterministicFallbackPair(
  abstentionCandidate: unknown,
  fallbackCandidate: unknown,
): { abstention: Finding; fallback: Finding } {
  const abstention = validateFinding(abstentionCandidate)
  const fallback = validateFinding(fallbackCandidate)

  if (abstention.layer !== 'abstention' || abstention.abstention === null) {
    throw new FindingContractError('The first finding of a fallback pair is the abstention')
  }
  if (fallback.layer !== 'deterministic') {
    throw new FindingContractError('A deterministic fallback renders at the deterministic layer')
  }
  if (abstention.abstention.fallbackFindingId !== fallback.findingId) {
    throw new FindingContractError(
      `Abstention ${formatFindingReference(abstention)} does not name ${fallback.findingId} as its deterministic fallback`,
    )
  }
  if (abstention.questionId !== fallback.questionId) {
    throw new FindingContractError('A fallback answers the same question as the abstention it replaces')
  }
  if (abstention.method.methodId === fallback.method.methodId) {
    throw new FindingContractError(
      'A deterministic fallback runs its OWN method; reusing the abstained method id relabels modelled output as deterministic',
    )
  }
  const relabelled = fallback.marks.find(
    (mark) => mark.reference.kind === 'claim' && mark.reference.claimLayer !== 'deterministic',
  )
  if (relabelled) {
    throw new FindingContractError(
      `Deterministic fallback mark ${relabelled.markId} resolves to a non-deterministic claim; model output never inherits deterministic styling`,
    )
  }
  return { abstention, fallback }
}

/* ------------------------------------------------------------------------------------------ *
 * Evidence walk (demo surface)
 * ------------------------------------------------------------------------------------------ */

export interface FindingReferenceWalkEntry {
  readonly role: 'metric_result' | 'mark' | 'evidence' | 'counter_evidence'
  readonly label: string
  readonly referenceKind: 'metric_result' | 'observation' | 'claim'
  readonly id: string
  readonly valueCategory: FindingValueCategory | null
  readonly claimLayer: FindingLayer | null
}

/**
 * The full reference walk behind one finding, in the order the Evidence Drawer resolves it:
 * result provenance first, then every rendered mark with the reference kind it resolves through,
 * then the evidence and the counter-evidence. Every derived number in the walk reads as a claim,
 * never as an observation — that is the property the drawer is there to show.
 */
export function buildFindingReferenceWalk(finding: Finding): readonly FindingReferenceWalkEntry[] {
  const entries: FindingReferenceWalkEntry[] = finding.metricResults.map((reference) => ({
    role: 'metric_result',
    label: `${reference.role} result`,
    referenceKind: 'metric_result',
    id: formatMetricResultReference(reference),
    valueCategory: null,
    claimLayer: null,
  }))

  for (const mark of finding.marks) {
    entries.push({
      role: 'mark',
      label: mark.markId,
      referenceKind: mark.reference.kind,
      id: analyticReferenceId(mark.reference),
      valueCategory: mark.valueCategory,
      claimLayer: mark.reference.kind === 'claim' ? mark.reference.claimLayer : null,
    })
  }

  const groups = [
    { role: 'evidence' as const, references: finding.evidence },
    { role: 'counter_evidence' as const, references: finding.counterEvidence },
  ]
  for (const group of groups) {
    for (const reference of group.references) {
      entries.push({
        role: group.role,
        label: group.role === 'evidence' ? 'supports' : 'contradicts',
        referenceKind: reference.kind,
        id: analyticReferenceId(reference),
        valueCategory: null,
        claimLayer: reference.kind === 'claim' ? reference.claimLayer : null,
      })
    }
  }

  return entries
}
