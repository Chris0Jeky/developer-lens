import { z } from 'zod'
import {
  OPENAI_LUNA_ENDPOINT,
  OPENAI_LUNA_MAX_ESTIMATED_USD,
  OPENAI_LUNA_MAX_INPUT_BYTES,
  OPENAI_LUNA_MAX_OUTPUT_TOKENS,
  OPENAI_LUNA_MAX_PRICE_AGE_SECONDS,
  OPENAI_LUNA_MODEL,
  OPENAI_LUNA_OUTPUT_SCHEMA_NAME,
  OpenAiLunaPriceQuoteSchema,
  parseOpenAiLunaPriceQuote,
} from './openaiResponses.js'

export const OPENAI_LUNA_ACTIVATION_CARD_SCHEMA_VERSION =
  'openai-luna-activation-card.v1' as const
export const OPENAI_LUNA_ACTIVATION_CARD_ERROR_CODE =
  'INVALID_OPENAI_LUNA_ACTIVATION_CARD' as const
export const OPENAI_LUNA_CREDENTIAL_VARIABLE = 'Llm__OpenAi__ApiKey' as const
export const OPENAI_LUNA_MAX_TIMEOUT_MS = 120_000 as const
export const OPENAI_LUNA_MAX_EVIDENCE_AGE_SECONDS = OPENAI_LUNA_MAX_PRICE_AGE_SECONDS

const MODEL_URL = 'https://developers.openai.com/api/docs/models/gpt-5.6-luna' as const
const PRICING_URL = 'https://developers.openai.com/api/docs/pricing' as const
const DATA_CONTROLS_URL = 'https://developers.openai.com/api/docs/guides/your-data' as const
const STRUCTURED_OUTPUTS_URL = 'https://developers.openai.com/api/docs/guides/structured-outputs' as const
const EVIDENCE_KINDS = ['model', 'pricing', 'data_controls', 'structured_outputs'] as const
const PRIVACY_CONTROLS = [
  'local_c1_bundle_only',
  'no_repository_or_source_bytes',
  'no_hosted_tools_files_or_vector_stores',
  'no_conversation_background_or_provider_state',
  'no_cache_telemetry_or_persistence',
  'no_presentation_export_or_public_sink',
] as const
const OUTPUT_CONTROLS = [
  'validated_c1_hypothesis_only',
  'process_only_validated_output',
  'raw_provider_bodies_and_ids_discarded',
  'unknown_or_unstructured_output_rejected',
] as const
const STOP_CONDITIONS = [
  'model_terms_or_pricing_changed',
  'pricing_evidence_unreconciled',
  'payload_preview_hash_mismatch',
  'request_or_spend_ceiling_exceeded',
  'credential_missing_or_blank',
  'timeout_rate_limit_provider_error_or_malformed_output',
  'no_retry_or_fallback',
] as const

const CanonicalTimestampSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .superRefine((value, context) => {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
      context.addIssue({ code: 'custom', message: 'timestamp is not canonical' })
    }
  })
const OpaqueTaskIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const BundleIdSchema = z.string().regex(/^req_[a-f0-9]{32}$/)
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

function strictObject<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
  return z.object(shape).strict()
}

const EvidenceSchema = strictObject({
  kind: z.enum(EVIDENCE_KINDS),
  url: z.enum([MODEL_URL, PRICING_URL, DATA_CONTROLS_URL, STRUCTURED_OUTPUTS_URL]),
  retrievedAt: CanonicalTimestampSchema,
  sha256: Sha256Schema,
}).superRefine((evidence, context) => {
  const expectedUrl: Record<typeof EVIDENCE_KINDS[number], string> = {
    model: MODEL_URL,
    pricing: PRICING_URL,
    data_controls: DATA_CONTROLS_URL,
    structured_outputs: STRUCTURED_OUTPUTS_URL,
  }
  if (evidence.url !== expectedUrl[evidence.kind]) {
    context.addIssue({ code: 'custom', path: ['url'], message: 'evidence URL does not match kind' })
  }
})

const CardSchema = strictObject({
  schemaVersion: z.literal(OPENAI_LUNA_ACTIVATION_CARD_SCHEMA_VERSION),
  taskId: OpaqueTaskIdSchema,
  capabilityId: z.literal('cap.external.model'),
  authorizedAt: CanonicalTimestampSchema,
  authorizationBasis: z.literal('owner-approved G4 OpenAI Luna boundary'),
  purpose: z.literal('user-reviewed local C1 hypotheses'),
  provider: z.literal('openai'),
  model: z.literal(OPENAI_LUNA_MODEL),
  endpoint: z.literal(OPENAI_LUNA_ENDPOINT),
  serviceTier: z.literal('default'),
  store: z.literal(false),
  structuredOutput: strictObject({
    type: z.literal('json_schema'),
    name: z.literal(OPENAI_LUNA_OUTPUT_SCHEMA_NAME),
    strict: z.literal(true),
  }),
  credential: strictObject({
    source: z.literal('process_environment'),
    variable: z.literal(OPENAI_LUNA_CREDENTIAL_VARIABLE),
    fallback: z.literal('none'),
  }),
  limits: strictObject({
    requestLimit: z.literal(1),
    retryLimit: z.literal(0),
    maxInputBytes: z.literal(OPENAI_LUNA_MAX_INPUT_BYTES),
    maxOutputTokens: z.literal(OPENAI_LUNA_MAX_OUTPUT_TOKENS),
    maxEstimatedUsd: z.literal(OPENAI_LUNA_MAX_ESTIMATED_USD),
    timeoutMs: z.number().int().min(1).max(OPENAI_LUNA_MAX_TIMEOUT_MS),
  }),
  priceQuote: OpenAiLunaPriceQuoteSchema,
  payload: strictObject({
    bundleId: BundleIdSchema,
    bundleSha256: Sha256Schema,
    requestBodySha256: Sha256Schema,
  }),
  pricingEvidenceStatus: z.literal('reconciled'),
  officialEvidence: z.array(EvidenceSchema).length(EVIDENCE_KINDS.length),
  privacyControls: z.array(z.enum(PRIVACY_CONTROLS)).length(PRIVACY_CONTROLS.length),
  outputControls: z.array(z.enum(OUTPUT_CONTROLS)).length(OUTPUT_CONTROLS.length),
  stopConditions: z.array(z.enum(STOP_CONDITIONS)).length(STOP_CONDITIONS.length),
  review: strictObject({
    status: z.literal('reviewed'),
    preview: z.literal('exact_request_body_bound'),
    reviewedAt: CanonicalTimestampSchema,
  }),
}).superRefine((card, context) => {
  const requireExactSet = (
    values: readonly string[],
    expected: readonly string[],
    path: (string | number)[],
  ): void => {
    if (new Set(values).size !== values.length || expected.some((value) => !values.includes(value))) {
      context.addIssue({ code: 'custom', path, message: 'closed set is incomplete or duplicated' })
    }
  }
  requireExactSet(card.privacyControls, PRIVACY_CONTROLS, ['privacyControls'])
  requireExactSet(card.outputControls, OUTPUT_CONTROLS, ['outputControls'])
  requireExactSet(card.stopConditions, STOP_CONDITIONS, ['stopConditions'])

  const evidenceKinds = card.officialEvidence.map((evidence) => evidence.kind)
  requireExactSet(evidenceKinds, EVIDENCE_KINDS, ['officialEvidence'])
})

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T

export type OpenAiLunaActivationTaskCard = DeepReadonly<z.infer<typeof CardSchema>>

export class OpenAiLunaActivationTaskCardError extends Error {
  readonly code = OPENAI_LUNA_ACTIVATION_CARD_ERROR_CODE

  constructor() {
    super(OPENAI_LUNA_ACTIVATION_CARD_ERROR_CODE)
    this.name = 'OpenAiLunaActivationTaskCardError'
  }
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child)
  }
  return value
}

function canonicalMillis(value: string): number {
  if (!CanonicalTimestampSchema.safeParse(value).success) throw new Error('timestamp')
  return Date.parse(value)
}

function assertNotFutureOrStale(value: string, nowMs: number): void {
  const timestamp = canonicalMillis(value)
  const ageSeconds = Math.floor((nowMs - timestamp) / 1000)
  if (timestamp > nowMs || ageSeconds > OPENAI_LUNA_MAX_EVIDENCE_AGE_SECONDS) throw new Error('evidence freshness')
}

/** Parse one reviewed, closed activation card without reading files or credentials. */
export function parseOpenAiLunaActivationTaskCard(
  input: unknown,
  now: string,
): OpenAiLunaActivationTaskCard {
  try {
    const nowMs = canonicalMillis(now)
    const card = CardSchema.parse(input)
    const authorizedAt = canonicalMillis(card.authorizedAt)
    const reviewedAt = canonicalMillis(card.review.reviewedAt)
    if (authorizedAt > reviewedAt || reviewedAt > nowMs) throw new Error('invalid review chronology')
    for (const evidence of card.officialEvidence) {
      assertNotFutureOrStale(evidence.retrievedAt, nowMs)
      if (canonicalMillis(evidence.retrievedAt) > reviewedAt) throw new Error('evidence postdates review')
    }
    const priceQuote = parseOpenAiLunaPriceQuote(card.priceQuote, now)
    const priceVerifiedAt = Date.parse(priceQuote.verifiedAt)
    const pricingEvidence = card.officialEvidence.find((evidence) => evidence.kind === 'pricing')
    if (
      priceVerifiedAt > reviewedAt ||
      pricingEvidence === undefined ||
      priceVerifiedAt !== canonicalMillis(pricingEvidence.retrievedAt)
    ) {
      throw new Error('price evidence is not review-bound')
    }
    return freezeDeep(card) as OpenAiLunaActivationTaskCard
  } catch {
    throw new OpenAiLunaActivationTaskCardError()
  }
}
