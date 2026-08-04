import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  OPENAI_LUNA_MAX_INPUT_BYTES,
  buildOpenAiLunaRequest,
  buildOpenAiLunaRequestPreview,
} from './openaiResponses.js'
import {
  OPENAI_LUNA_PAYLOAD_PREVIEW_ERROR_CODE,
  OpenAiLunaPayloadPreviewError,
  bindOpenAiLunaPayloadPreview,
} from './openaiPayloadPreview.js'
import type { C1EvidenceBundle } from './c1Contract.js'

const bundle = {
  schema_version: '1.0.0',
  bundle_id: 'req_00000000000000000000000000000001',
  range: { start: '2026-01-01T00:00:00Z', end: '2026-03-01T00:00:00Z' },
  consent_revision: 'consent-v3',
  redaction_revision: 'redaction-v2',
  budget: { max_input_tokens: 12000, max_output_tokens: 1500 },
  evidence: [{
    evidence_id: 'ev_001', layer: 'deterministic', feature_id: 'DL.CI.RERUN_RATIO.v1',
    value: 0.08, unit: 'ratio', coverage: { status: 'complete', sample: 75 }, limitation_code: 'RERUN_NOT_FLAKE',
  }],
} as unknown as C1EvidenceBundle

const now = '2026-08-04T12:00:00.000Z'
const digest = 'a'.repeat(64)
const bundleId = bundle.bundle_id
const expectedBundleSha256 = '68e9ace889aae56b369dd2a382df3202997c4d271fac4e79539162935236b3e4'
const expectedRequestBodySha256 = '585cc61fa7b09a4592a0df167212e85ec7155be7f442cc97e63d7f61741f40c5'

const baseCard = (overrides: Record<string, unknown> = {}) => ({
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
    requestLimit: 1, retryLimit: 0, maxInputBytes: 16_000, maxOutputTokens: 2_000,
    maxEstimatedUsd: 0.01, timeoutMs: 30_000,
  },
  priceQuote: {
    model: 'gpt-5.6-luna', serviceTier: 'default', contextBand: 'short', unit: 'USD_PER_MILLION_TOKENS',
    inputUsdPerMillionTokens: 0.2, cacheWriteUsdPerMillionTokens: 0.25,
    outputUsdPerMillionTokens: 1.2, verifiedAt: '2026-08-04T00:00:00Z',
  },
  payload: { bundleId, bundleSha256: expectedBundleSha256, requestBodySha256: expectedRequestBodySha256 },
  pricingEvidenceStatus: 'reconciled',
  officialEvidence: [
    { kind: 'model', url: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
    { kind: 'pricing', url: 'https://developers.openai.com/api/docs/pricing', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
    { kind: 'data_controls', url: 'https://developers.openai.com/api/docs/guides/your-data', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
    { kind: 'structured_outputs', url: 'https://developers.openai.com/api/docs/guides/structured-outputs', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
  ],
  privacyControls: [
    'local_c1_bundle_only', 'no_repository_or_source_bytes', 'no_hosted_tools_files_or_vector_stores',
    'no_conversation_or_background_mode', 'no_local_cache_telemetry_or_persistence',
    'provider_retention_boundary_acknowledged', 'no_presentation_export_or_public_sink',
  ],
  outputControls: [
    'validated_c1_hypothesis_only', 'process_only_validated_output',
    'raw_provider_bodies_and_ids_discarded', 'unknown_or_unstructured_output_rejected',
  ],
  stopConditions: [
    'model_terms_or_pricing_changed', 'pricing_evidence_unreconciled', 'payload_preview_hash_mismatch',
    'request_or_spend_ceiling_exceeded', 'credential_missing_or_blank',
    'timeout_rate_limit_provider_error_or_malformed_output', 'no_retry_or_fallback',
  ],
  review: { status: 'reviewed', preview: 'exact_request_body_bound', reviewedAt: '2026-08-04T11:00:00.000Z' },
  ...overrides,
})

function expectInvalid(action: () => unknown): void {
  expect(action).toThrowError(new OpenAiLunaPayloadPreviewError())
  expect(action).toThrow(OPENAI_LUNA_PAYLOAD_PREVIEW_ERROR_CODE)
}

describe('OpenAI/Luna exact payload preview and binding', () => {
  it('keeps preview and request descriptors byte-identical and credentialless', () => {
    const preview = buildOpenAiLunaRequestPreview({ bundle, priceQuote: baseCard().priceQuote, now })
    const request = buildOpenAiLunaRequest({ bundle, priceQuote: baseCard().priceQuote, now })
    expect(preview.bundleId).toBe(bundleId)
    expect(preview.bundleJson).toBe(JSON.stringify(bundle))
    expect(JSON.parse(preview.request.body)).toMatchObject({ input: preview.bundleJson, store: false })
    expect(request).toEqual(preview.request)
    expect(Buffer.byteLength(preview.bundleJson, 'utf8')).toBeLessThanOrEqual(OPENAI_LUNA_MAX_INPUT_BYTES)
    expect(Buffer.byteLength(preview.request.body, 'utf8')).toBeLessThanOrEqual(OPENAI_LUNA_MAX_INPUT_BYTES)
    expect(JSON.stringify(preview.request)).not.toContain('Authorization')
    expect(JSON.stringify(preview.request)).not.toContain('tools')
    expect(Object.isFrozen(preview)).toBe(true)
    expect(Object.isFrozen(preview.request)).toBe(true)
    expect(Object.isFrozen(preview.request.headers)).toBe(true)
  })

  it('binds independently pinned bundle and body hashes and freezes the result', () => {
    const bound = bindOpenAiLunaPayloadPreview({ card: baseCard(), bundle, now })
    expect(bound.card.taskId).toBe('fixture-luna-card')
    expect(bound.preview.bundleId).toBe(bundleId)
    expect(createHash('sha256').update(bound.preview.bundleJson, 'utf8').digest('hex')).toBe(expectedBundleSha256)
    expect(createHash('sha256').update(bound.preview.request.body, 'utf8').digest('hex')).toBe(expectedRequestBodySha256)
    expect(Object.isFrozen(bound)).toBe(true)
    expect(Object.isFrozen(bound.card)).toBe(true)
    expect(Object.isFrozen(bound.preview)).toBe(true)
    expect(Object.isFrozen(bound.preview.request)).toBe(true)
  })

  it('rejects each payload binding mismatch with one content-free error', () => {
    for (const field of ['bundleId', 'bundleSha256', 'requestBodySha256'] as const) {
      const mismatch = field === 'bundleId' ? `req_${'c'.repeat(32)}` : 'f'.repeat(64)
      const payload = { ...baseCard().payload, [field]: mismatch }
      expectInvalid(() => bindOpenAiLunaPayloadPreview({ card: baseCard({ payload }), bundle, now }))
    }
  })

  it('rejects stale or forged cards, forbidden bundle fields, oversize, and cost failures', () => {
    expectInvalid(() => bindOpenAiLunaPayloadPreview({
      card: baseCard({ priceQuote: { ...baseCard().priceQuote, verifiedAt: '2026-08-02T11:59:59Z' } }), bundle, now,
    }))
    expectInvalid(() => bindOpenAiLunaPayloadPreview({ card: baseCard({ model: 'gpt-5.5' }), bundle, now }))
    expectInvalid(() => bindOpenAiLunaPayloadPreview({ card: baseCard(), bundle: { ...bundle, repository_name: 'PRIVATE_CANARY' }, now }))
    expectInvalid(() => bindOpenAiLunaPayloadPreview({
      card: baseCard(),
      bundle: {
        ...bundle,
        evidence: Array.from({ length: 128 }, (_, index) => ({
          ...bundle.evidence[0], evidence_id: `ev_${String(index + 1).padStart(3, '0')}`,
        })),
      },
      now,
    }))
    expectInvalid(() => bindOpenAiLunaPayloadPreview({
      card: baseCard({ priceQuote: { ...baseCard().priceQuote, outputUsdPerMillionTokens: 10_000 } }), bundle, now,
    }))
  })

  it('does not expose caller content in failure messages or accept output mutation', () => {
    const bound = bindOpenAiLunaPayloadPreview({ card: baseCard(), bundle, now })
    expect(() => { (bound.preview as { bundleId: string }).bundleId = 'forged' }).toThrow()
    expect(bound.preview.bundleId).toBe(bundleId)
    try {
      bindOpenAiLunaPayloadPreview({ card: baseCard({ taskId: 'secret-card-id' }), bundle, now })
    } catch (error) {
      expect((error as Error).message).toBe(OPENAI_LUNA_PAYLOAD_PREVIEW_ERROR_CODE)
      expect((error as Error).message).not.toContain('secret-card-id')
      expect((error as Error).message).not.toContain('PRIVATE_CANARY')
    }
  })
})
