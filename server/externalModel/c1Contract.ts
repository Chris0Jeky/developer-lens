import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { COVERAGE_STATUSES, CoverageStatusSchema } from '../../shared/coverage.js'

/** The first model-facing feature vocabulary. It is intentionally closed. */
export const C1_FEATURE_IDS = [
  'DL.CI.RERUN_RATIO.v1',
  'DL.COV.COMPLETE_RATIO.v1',
  'DL.FLOW.ISSUE_PR_RELEASE_RATIO.v1',
  'DL.OWN.COVERAGE_RATIO.v1',
] as const

export const C1_STATEMENT_CODES = [
  'CI_RERUN_PATTERN',
  'COVERAGE_GAP',
  'DELIVERY_FLOW',
  'OWNERSHIP_COVERAGE',
  'ABSTAIN_LOW_COVERAGE',
] as const

export const C1_ALTERNATIVE_CODES = [
  'COVERAGE_CHANGE',
  'MIXED_SIGNALS',
  'OBSERVABILITY_CHANGE',
  'SAMPLING_VARIANCE',
  'SEASONALITY',
  'NONE',
] as const

export const C1_LIMITATION_CODES = [
  'COVERAGE_INCOMPLETE',
  'COVERAGE_RESTRICTED',
  'COVERAGE_SPARSE',
  'COVERAGE_UNITS_DIFFER',
  'DECLARED_OWNERSHIP_NOT_STEWARDSHIP',
  'LINKAGE_NOT_CAUSAL',
  'OBSERVABILITY_CHANGED',
  'RERUN_NOT_FLAKE',
  'SAMPLE_TOO_SMALL',
] as const

export const C1_UNIT_CODES = [
  'ratio',
] as const

export const C1_COVERAGE_STATUSES = COVERAGE_STATUSES

export const C1FeatureIdSchema = z.enum(C1_FEATURE_IDS)
export const C1StatementCodeSchema = z.enum(C1_STATEMENT_CODES)
export const C1AlternativeCodeSchema = z.enum(C1_ALTERNATIVE_CODES)
export const C1LimitationCodeSchema = z.enum(C1_LIMITATION_CODES)
export const C1UnitCodeSchema = z.enum(C1_UNIT_CODES)
export const C1CoverageStatusSchema = CoverageStatusSchema

const MAX_EVIDENCE = 128
const MAX_CLAIMS = 32
const MAX_IDS = 16
const MAX_INPUT_BYTES = 16_000
const MAX_NUMBER = Number.MAX_SAFE_INTEGER
const UTC_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/

function parseCanonicalUtc(value: string): number | null {
  const match = UTC_TIMESTAMP_PATTERN.exec(value)
  if (!match) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  const date = new Date(parsed)
  const milliseconds = Number((match[7] ?? '').padEnd(3, '0') || '0')
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3]) ||
    date.getUTCHours() !== Number(match[4]) ||
    date.getUTCMinutes() !== Number(match[5]) ||
    date.getUTCSeconds() !== Number(match[6]) ||
    date.getUTCMilliseconds() !== milliseconds
  ) return null
  return parsed
}

const UtcTimestampSchema = z.string().superRefine((value, context) => {
  if (parseCanonicalUtc(value) === null) {
    context.addIssue({ code: 'custom', message: 'timestamp is not canonical' })
  }
})
const RequestIdSchema = z.string().regex(/^req_[a-f0-9]{32}$/)
const EvidenceIdSchema = z.string().regex(/^ev_\d{3}$/)
const ClaimIdSchema = z.string().regex(/^claim_\d{2}$/)
const BoundedNumberSchema = z.number().finite().nonnegative().max(MAX_NUMBER)
const NonnegativeIntegerSchema = z.number().int().nonnegative().max(MAX_NUMBER)
const PositiveIntegerSchema = z.number().int().positive().max(MAX_NUMBER)
type C1FeatureId = typeof C1_FEATURE_IDS[number]
type C1StatementCode = Exclude<typeof C1_STATEMENT_CODES[number], 'ABSTAIN_LOW_COVERAGE'>

const MINIMUM_SAMPLE: Readonly<Record<C1FeatureId, number>> = {
  'DL.CI.RERUN_RATIO.v1': 20,
  'DL.COV.COMPLETE_RATIO.v1': 1,
  'DL.FLOW.ISSUE_PR_RELEASE_RATIO.v1': 10,
  'DL.OWN.COVERAGE_RATIO.v1': 1,
}

const STATEMENT_FEATURE: Readonly<Record<C1StatementCode, C1FeatureId>> = {
  CI_RERUN_PATTERN: 'DL.CI.RERUN_RATIO.v1',
  COVERAGE_GAP: 'DL.COV.COMPLETE_RATIO.v1',
  DELIVERY_FLOW: 'DL.FLOW.ISSUE_PR_RELEASE_RATIO.v1',
  OWNERSHIP_COVERAGE: 'DL.OWN.COVERAGE_RATIO.v1',
}

const USABLE_LIMITATION: Readonly<Record<C1FeatureId, typeof C1_LIMITATION_CODES[number]>> = {
  'DL.CI.RERUN_RATIO.v1': 'RERUN_NOT_FLAKE',
  'DL.COV.COMPLETE_RATIO.v1': 'COVERAGE_UNITS_DIFFER',
  'DL.FLOW.ISSUE_PR_RELEASE_RATIO.v1': 'LINKAGE_NOT_CAUSAL',
  'DL.OWN.COVERAGE_RATIO.v1': 'DECLARED_OWNERSHIP_NOT_STEWARDSHIP',
}

const INCOMPLETE_LIMITATIONS = new Set<typeof C1_LIMITATION_CODES[number]>([
  'COVERAGE_INCOMPLETE',
  'COVERAGE_RESTRICTED',
  'COVERAGE_SPARSE',
  'OBSERVABILITY_CHANGED',
])

export const C1RangeSchema = z.object({
  start: UtcTimestampSchema,
  end: UtcTimestampSchema,
}).strict().superRefine((range, context) => {
  const start = parseCanonicalUtc(range.start)
  const end = parseCanonicalUtc(range.end)
  if (start === null || end === null || start >= end) {
    context.addIssue({ code: 'custom', path: ['end'], message: 'invalid_range' })
  }
  if (start === null || end === null) return
  const startDate = new Date(start)
  const maximumEnd = Date.UTC(
    startDate.getUTCFullYear() + 3,
    startDate.getUTCMonth(),
    Math.min(
      startDate.getUTCDate(),
      new Date(Date.UTC(startDate.getUTCFullYear() + 3, startDate.getUTCMonth() + 1, 0)).getUTCDate(),
    ),
    startDate.getUTCHours(),
    startDate.getUTCMinutes(),
    startDate.getUTCSeconds(),
    startDate.getUTCMilliseconds(),
  )
  if (end > maximumEnd) {
    context.addIssue({ code: 'custom', path: ['end'], message: 'range_too_large' })
  }
})

export const C1BudgetSchema = z.object({
  // The transport independently enforces the authoritative 16,000 UTF-8 byte envelope.
  max_input_tokens: PositiveIntegerSchema.max(12_000),
  max_output_tokens: PositiveIntegerSchema.max(2_000),
}).strict()

export const C1CoverageSchema = z.object({
  status: C1CoverageStatusSchema,
  sample: NonnegativeIntegerSchema,
}).strict()

export const C1EvidenceSchema = z.object({
  evidence_id: EvidenceIdSchema,
  layer: z.literal('deterministic'),
  feature_id: C1FeatureIdSchema,
  value: BoundedNumberSchema.max(1).nullable(),
  unit: C1UnitCodeSchema,
  coverage: C1CoverageSchema,
  limitation_code: C1LimitationCodeSchema,
}).strict().superRefine((evidence, context) => {
  const enoughSamples = evidence.coverage.sample >= MINIMUM_SAMPLE[evidence.feature_id]
  const usable = evidence.coverage.status === 'complete' && enoughSamples
  if (usable !== (evidence.value !== null)) {
    context.addIssue({ code: 'custom', path: ['value'], message: 'coverage_value_mismatch' })
  }
  if (usable && evidence.limitation_code !== USABLE_LIMITATION[evidence.feature_id]) {
    context.addIssue({ code: 'custom', path: ['limitation_code'], message: 'feature_limitation' })
  }
  if (evidence.coverage.status === 'complete' && !enoughSamples && evidence.limitation_code !== 'SAMPLE_TOO_SMALL') {
    context.addIssue({ code: 'custom', path: ['limitation_code'], message: 'sample_limitation' })
  }
  if (evidence.coverage.status !== 'complete' && !INCOMPLETE_LIMITATIONS.has(evidence.limitation_code)) {
    context.addIssue({ code: 'custom', path: ['limitation_code'], message: 'coverage_limitation' })
  }
})

export const C1EvidenceBundleSchema = z.object({
  schema_version: z.literal('1.0.0'),
  bundle_id: RequestIdSchema,
  range: C1RangeSchema,
  consent_revision: z.literal('consent-v3'),
  redaction_revision: z.literal('redaction-v2'),
  budget: C1BudgetSchema,
  evidence: z.array(C1EvidenceSchema).min(1).max(MAX_EVIDENCE),
}).strict().superRefine((bundle, context) => {
  const ids = bundle.evidence.map((evidence) => evidence.evidence_id)
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['evidence'], message: 'duplicate_evidence_id' })
  }
  if (Buffer.byteLength(JSON.stringify(bundle), 'utf8') > MAX_INPUT_BYTES) {
    context.addIssue({ code: 'custom', path: [], message: 'input_byte_budget' })
  }
})

export const ModelClaimSchema = z.object({
  claim_id: ClaimIdSchema,
  kind: z.enum(['hypothesis', 'counter_hypothesis', 'abstention']),
  statement_code: C1StatementCodeSchema,
  evidence_ids: z.array(EvidenceIdSchema).min(1).max(MAX_IDS),
  contradicting_evidence_ids: z.array(EvidenceIdSchema).max(MAX_IDS),
  alternative_codes: z.array(C1AlternativeCodeSchema).min(1).max(MAX_IDS),
  confidence_band: z.enum(['low', 'medium', 'high']),
  limitation_codes: z.array(C1LimitationCodeSchema).min(1).max(MAX_IDS),
}).strict().superRefine((claim, context) => {
  const allIds = [...claim.evidence_ids, ...claim.contradicting_evidence_ids]
  if (new Set(allIds).size !== allIds.length) {
    context.addIssue({ code: 'custom', path: ['evidence_ids'], message: 'duplicate_evidence_id' })
  }
  if (new Set(claim.alternative_codes).size !== claim.alternative_codes.length) {
    context.addIssue({ code: 'custom', path: ['alternative_codes'], message: 'duplicate_alternative_code' })
  }
  if (claim.alternative_codes.includes('NONE') && claim.alternative_codes.length !== 1) {
    context.addIssue({ code: 'custom', path: ['alternative_codes'], message: 'none_not_exclusive' })
  }
  if (new Set(claim.limitation_codes).size !== claim.limitation_codes.length) {
    context.addIssue({ code: 'custom', path: ['limitation_codes'], message: 'duplicate_limitation_code' })
  }
  if (claim.kind === 'abstention') {
    if (claim.confidence_band !== 'low') {
      context.addIssue({ code: 'custom', path: ['confidence_band'], message: 'abstention_confidence' })
    }
    if (claim.statement_code !== 'ABSTAIN_LOW_COVERAGE') {
      context.addIssue({ code: 'custom', path: ['statement_code'], message: 'abstention_statement' })
    }
  } else {
    if (claim.statement_code === 'ABSTAIN_LOW_COVERAGE') {
      context.addIssue({ code: 'custom', path: ['statement_code'], message: 'non_abstention_statement' })
    }
  }
})

export const ModelOutputSchema = z.object({
  schema_version: z.literal('1.0.0'),
  request_id: RequestIdSchema,
  claims: z.array(ModelClaimSchema).min(1).max(MAX_CLAIMS),
}).strict().superRefine((output, context) => {
  const ids = output.claims.map((claim) => claim.claim_id)
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['claims'], message: 'duplicate_claim_id' })
  }
})

export type C1EvidenceBundle = z.infer<typeof C1EvidenceBundleSchema>
export type C1Evidence = z.infer<typeof C1EvidenceSchema>
export type ModelClaim = z.infer<typeof ModelClaimSchema>
export type ModelOutput = z.infer<typeof ModelOutputSchema>

export class C1ContractValidationError extends Error {
  readonly code = 'C1_CONTRACT_INVALID' as const

  constructor() {
    super('C1_CONTRACT_INVALID')
    this.name = 'C1ContractValidationError'
  }
}

/** Parse without exposing caller-controlled Zod paths or prose in an error. */
export function parseC1EvidenceBundle(value: unknown): C1EvidenceBundle {
  const parsed = C1EvidenceBundleSchema.safeParse(value)
  if (!parsed.success) throw new C1ContractValidationError()
  return parsed.data
}

/** Validate claims against the exact request bundle and request-scoped ID. */
export function parseModelOutput(bundle: C1EvidenceBundle, value: unknown): ModelOutput {
  const parsedBundle = C1EvidenceBundleSchema.safeParse(bundle)
  const parsed = ModelOutputSchema.safeParse(value)
  if (!parsedBundle.success || !parsed.success || parsed.data.request_id !== parsedBundle.data.bundle_id) {
    throw new C1ContractValidationError()
  }
  const evidenceById = new Map(
    parsedBundle.data.evidence.map((evidence) => [evidence.evidence_id, evidence] as const),
  )
  for (const claim of parsed.data.claims) {
    const referenced = [...claim.evidence_ids, ...claim.contradicting_evidence_ids]
      .map((evidenceId) => evidenceById.get(evidenceId))
    if (referenced.some((evidence) => !evidence)) throw new C1ContractValidationError()
    const exactEvidence = referenced.filter((evidence) => evidence !== undefined)
    const evidenceLimitations = new Set(exactEvidence.map((evidence) => evidence.limitation_code))
    if (claim.limitation_codes.some((code) => !evidenceLimitations.has(code))) {
      throw new C1ContractValidationError()
    }
    if (claim.kind === 'abstention') {
      if (exactEvidence.some((evidence) => evidence.value !== null)) throw new C1ContractValidationError()
      continue
    }
    if (claim.statement_code === 'ABSTAIN_LOW_COVERAGE') throw new C1ContractValidationError()
    const expectedFeature = STATEMENT_FEATURE[claim.statement_code]
    if (
      exactEvidence.some((evidence) => evidence.value === null) ||
      exactEvidence.some((evidence) => evidence.feature_id !== expectedFeature)
    ) {
      throw new C1ContractValidationError()
    }
  }
  return parsed.data
}

export const validateC1EvidenceBundle = parseC1EvidenceBundle
export const validateModelOutput = parseModelOutput

// Backwards-friendly aliases for callers that use the architecture's compact names.
export const EvidenceBundleSchema = C1EvidenceBundleSchema
export const EvidenceSchema = C1EvidenceSchema
export const ClaimSchema = ModelClaimSchema
export const StructuredModelOutputSchema = ModelOutputSchema
export type StructuredModelOutput = ModelOutput
