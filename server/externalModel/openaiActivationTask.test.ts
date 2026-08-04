import { describe, expect, it } from 'vitest'
import {
  OPENAI_LUNA_ACTIVATION_CARD_ERROR_CODE,
  OpenAiLunaActivationTaskCardError,
  parseOpenAiLunaActivationTaskCard,
} from './openaiActivationTask.js'

const now = '2026-08-04T12:00:00.000Z'
const digest = 'a'.repeat(64)
const bundleId = `req_${'b'.repeat(32)}`

const baseCard = () => ({
  schemaVersion: 'openai-luna-activation-card.v1',
  taskId: 'fixture-luna-card',
  capabilityId: 'cap.external.model',
  authorizedAt: '2026-08-04T00:00:00.000Z',
  authorizationBasis: 'owner-approved G4 OpenAI Luna boundary',
  purpose: 'user-reviewed local C1 hypotheses',
  provider: 'openai',
  model: 'gpt-5.6-luna',
  endpoint: 'https://api.openai.com/v1/responses',
  serviceTier: 'default',
  store: false,
  structuredOutput: { type: 'json_schema', name: 'developer_lens_c1_output', strict: true },
  credential: { source: 'process_environment', variable: 'Llm__OpenAi__ApiKey', fallback: 'none' },
  limits: {
    requestLimit: 1,
    retryLimit: 0,
    maxInputBytes: 16_000,
    maxOutputTokens: 2_000,
    maxEstimatedUsd: 0.01,
    timeoutMs: 30_000,
  },
  priceQuote: {
    model: 'gpt-5.6-luna',
    serviceTier: 'default',
    contextBand: 'short',
    unit: 'USD_PER_MILLION_TOKENS',
    inputUsdPerMillionTokens: 0.2,
    cacheWriteUsdPerMillionTokens: 0.25,
    outputUsdPerMillionTokens: 1.2,
    verifiedAt: '2026-08-04T00:00:00Z',
  },
  payload: { bundleId, bundleSha256: digest, requestBodySha256: digest },
  pricingEvidenceStatus: 'reconciled',
  officialEvidence: [
    { kind: 'model', url: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
    { kind: 'pricing', url: 'https://developers.openai.com/api/docs/pricing', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
    { kind: 'data_controls', url: 'https://developers.openai.com/api/docs/guides/your-data', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
    { kind: 'structured_outputs', url: 'https://developers.openai.com/api/docs/guides/structured-outputs', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
  ],
  privacyControls: [
    'local_c1_bundle_only',
    'no_repository_or_source_bytes',
    'no_hosted_tools_files_or_vector_stores',
    'no_conversation_or_background_mode',
    'no_local_cache_telemetry_or_persistence',
    'provider_retention_boundary_acknowledged',
    'no_presentation_export_or_public_sink',
  ],
  outputControls: [
    'validated_c1_hypothesis_only',
    'process_only_validated_output',
    'raw_provider_bodies_and_ids_discarded',
    'unknown_or_unstructured_output_rejected',
  ],
  stopConditions: [
    'model_terms_or_pricing_changed',
    'pricing_evidence_unreconciled',
    'payload_preview_hash_mismatch',
    'request_or_spend_ceiling_exceeded',
    'credential_missing_or_blank',
    'timeout_rate_limit_provider_error_or_malformed_output',
    'no_retry_or_fallback',
  ],
  review: { status: 'reviewed', preview: 'exact_request_body_bound', reviewedAt: '2026-08-04T11:00:00.000Z' },
})

function expectInvalid(value: unknown, at = now): void {
  expect(() => parseOpenAiLunaActivationTaskCard(value, at)).toThrowError(
    new OpenAiLunaActivationTaskCardError(),
  )
  expect(() => parseOpenAiLunaActivationTaskCard(value, at)).toThrow(OPENAI_LUNA_ACTIVATION_CARD_ERROR_CODE)
}

describe('OpenAI/Luna activation task card', () => {
  it('accepts the exact invented card and deeply freezes it', () => {
    const card = parseOpenAiLunaActivationTaskCard(baseCard(), now)
    expect(card.capabilityId).toBe('cap.external.model')
    expect(card.payload.bundleId).toBe(bundleId)
    expect(Object.isFrozen(card)).toBe(true)
    expect(Object.isFrozen(card.limits)).toBe(true)
    expect(Object.isFrozen(card.officialEvidence)).toBe(true)
    expect(Object.isFrozen(card.officialEvidence[0])).toBe(true)
  })

  it('rejects missing, extra, weakened, and mismatched execution fields', () => {
    const valid = baseCard()
    expectInvalid({ ...valid, model: 'gpt-5.5' })
    expectInvalid({ ...valid, endpoint: 'https://api.openai.com/v1/chat/completions' })
    expectInvalid({ ...valid, serviceTier: 'priority' })
    expectInvalid({ ...valid, store: true })
    expectInvalid({ ...valid, capabilityId: 'github.core' })
    expectInvalid({ ...valid, credential: { ...valid.credential, variable: 'OPENAI_API_KEY' } })
    expectInvalid({ ...valid, credential: { ...valid.credential, fallback: 'OPENAI_API_KEY' } })
    expectInvalid({ ...valid, limits: { ...valid.limits, requestLimit: 2 } })
    expectInvalid({ ...valid, limits: { ...valid.limits, retryLimit: 1 } })
    expectInvalid({ ...valid, limits: { ...valid.limits, maxInputBytes: 16_001 } })
    expectInvalid({ ...valid, limits: { ...valid.limits, maxOutputTokens: 2_001 } })
    expectInvalid({ ...valid, limits: { ...valid.limits, maxEstimatedUsd: 0.011 } })
    expectInvalid({ ...valid, unknown: 'fixture-extra' })
    const { purpose: _purpose, ...missing } = valid
    expectInvalid(missing)
  })

  it('requires the same fresh short-context quote and reconciled official evidence set', () => {
    const valid = baseCard()
    expectInvalid({ ...valid, priceQuote: { ...valid.priceQuote, contextBand: 'long' } })
    expectInvalid({ ...valid, priceQuote: { ...valid.priceQuote, verifiedAt: '2026-08-02T11:59:59Z' } })
    expectInvalid({ ...valid, pricingEvidenceStatus: 'unreconciled' })
    expectInvalid({
      ...valid,
      officialEvidence: valid.officialEvidence.map((evidence) =>
        evidence.kind === 'pricing' ? { ...evidence, url: 'https://example.invalid/pricing' } : evidence),
    })
    expectInvalid({
      ...valid,
      officialEvidence: [...valid.officialEvidence.slice(0, 3), valid.officialEvidence[0]],
    })
    expectInvalid({
      ...valid,
      officialEvidence: valid.officialEvidence.map((evidence) =>
        evidence.kind === 'model' ? { ...evidence, sha256: digest.toUpperCase() } : evidence),
    })
  })

  it('rejects future and stale evidence, changed payload bindings, and incomplete closed controls', () => {
    const valid = baseCard()
    expectInvalid({
      ...valid,
      officialEvidence: valid.officialEvidence.map((evidence) =>
        evidence.kind === 'model' ? { ...evidence, retrievedAt: '2026-08-04T12:00:01.000Z' } : evidence),
    })
    expectInvalid({
      ...valid,
      officialEvidence: valid.officialEvidence.map((evidence) =>
        evidence.kind === 'model' ? { ...evidence, retrievedAt: '2026-08-03T11:59:59.000Z' } : evidence),
    })
    expectInvalid({ ...valid, payload: { ...valid.payload, bundleId: 'bundle-not-a-c1-id' } })
    expectInvalid({ ...valid, payload: { ...valid.payload, requestBodySha256: 'not-a-sha' } })
    expectInvalid({ ...valid, privacyControls: valid.privacyControls.slice(0, -1) })
    expectInvalid({
      ...valid,
      privacyControls: valid.privacyControls.map((control) =>
        control === 'provider_retention_boundary_acknowledged'
          ? 'no_cache_telemetry_or_persistence'
          : control),
    })
    expectInvalid({ ...valid, outputControls: [...valid.outputControls.slice(0, -1), valid.outputControls[0]] })
    expectInvalid({ ...valid, stopConditions: [...valid.stopConditions, 'pricing_evidence_unreconciled'] })
    expectInvalid({ ...valid, review: { ...valid.review, status: 'pending' } })
  })

  it('requires authorization, price, and evidence to predate the exact review', () => {
    const valid = baseCard()
    expectInvalid({ ...valid, authorizedAt: '2026-08-04T11:00:01.000Z' })
    expectInvalid({ ...valid, review: { ...valid.review, reviewedAt: '2026-08-03T23:59:59.000Z' } })
    expectInvalid({
      ...valid,
      priceQuote: { ...valid.priceQuote, verifiedAt: '2026-08-04T00:00:01Z' },
    })
    expectInvalid({
      ...valid,
      officialEvidence: valid.officialEvidence.map((evidence) =>
        evidence.kind === 'data_controls'
          ? { ...evidence, retrievedAt: '2026-08-04T11:00:01.000Z' }
          : evidence),
    })
  })
})
