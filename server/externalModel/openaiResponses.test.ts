import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import {
  OPENAI_LUNA_ENDPOINT,
  OPENAI_LUNA_MAX_INPUT_BYTES,
  OPENAI_LUNA_OUTPUT_SCHEMA_NAME,
  OpenAiLunaPriceQuoteSchema,
  OpenAiLunaRequestError,
  buildOpenAiLunaRequest,
} from './openaiResponses.js'
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

const priceQuote = {
  model: 'gpt-5.6-luna' as const,
  serviceTier: 'default' as const,
  contextBand: 'short' as const,
  unit: 'USD_PER_MILLION_TOKENS' as const,
  inputUsdPerMillionTokens: 0.2,
  cacheWriteUsdPerMillionTokens: 0.25,
  outputUsdPerMillionTokens: 1.2,
  verifiedAt: '2026-08-04T00:00:00Z',
}
const now = '2026-08-04T12:00:00Z'

function expectCode(action: () => unknown, code: string): void {
  expect(action).toThrowError(new OpenAiLunaRequestError(code as never))
}

describe('credentialless OpenAI/Luna Responses request boundary', () => {
  it('builds an exact credentialless descriptor with a closed body allowlist', () => {
    const request = buildOpenAiLunaRequest({ bundle, priceQuote, now })
    expect(request).toMatchObject({ method: 'POST', url: OPENAI_LUNA_ENDPOINT })
    expect(request.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' })
    expect(Object.keys(request)).toEqual(['method', 'url', 'headers', 'body'])
    const body = JSON.parse(request.body) as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'gpt-5.6-luna', service_tier: 'default', store: false, max_output_tokens: 1500,
      instructions: expect.stringContaining('deterministic C1 evidence'),
      input: JSON.stringify(bundle),
      text: { format: {
        type: 'json_schema', name: OPENAI_LUNA_OUTPUT_SCHEMA_NAME, strict: true,
        schema: { type: 'object', additionalProperties: false },
      } },
    })
    expect(Object.keys(body).sort()).toEqual([
      'input', 'instructions', 'max_output_tokens', 'model', 'service_tier', 'store', 'text',
    ])
    const format = (body.text as { format: { schema: Record<string, unknown> } }).format
    expect(format.schema).not.toHaveProperty('$schema')
    expect(format.schema).toMatchObject({
      required: ['schema_version', 'request_id', 'claims'],
      properties: {
        schema_version: { type: 'string', enum: ['1.0.0'] },
        claims: { items: { additionalProperties: false } },
      },
    })
    expect(JSON.stringify(format.schema)).not.toContain('"const"')
    expect(JSON.stringify(request)).not.toContain('Authorization')
    expect(JSON.stringify(request)).not.toContain('tools')
    expect(JSON.stringify(request)).not.toContain('SECRET_PROVIDER_ID')
    expect(Buffer.byteLength(JSON.stringify(bundle), 'utf8')).toBeLessThanOrEqual(OPENAI_LUNA_MAX_INPUT_BYTES)
    expect(Buffer.byteLength(request.body, 'utf8')).toBeLessThanOrEqual(OPENAI_LUNA_MAX_INPUT_BYTES)
    expect(Object.isFrozen(request)).toBe(true)
  })

  it('rejects invalid, stale, malformed, and over-budget pricing before any callback', () => {
    expectCode(() => buildOpenAiLunaRequest({ bundle, priceQuote: { ...priceQuote, model: 'other' }, now }), 'OPENAI_LUNA_PRICE_INVALID')
    expectCode(() => buildOpenAiLunaRequest({ bundle, priceQuote: { ...priceQuote, serviceTier: 'auto' }, now }), 'OPENAI_LUNA_PRICE_INVALID')
    expectCode(() => buildOpenAiLunaRequest({ bundle, priceQuote: { ...priceQuote, unit: 'USD_PER_TOKEN' }, now }), 'OPENAI_LUNA_PRICE_INVALID')
    expectCode(() => buildOpenAiLunaRequest({ bundle, priceQuote: { ...priceQuote, verifiedAt: '2026-08-02T11:59:59Z' }, now }), 'OPENAI_LUNA_PRICE_INVALID')
    expect(OpenAiLunaPriceQuoteSchema.safeParse({
      ...priceQuote,
      verifiedAt: '2026-02-30T00:00:00Z',
    }).success).toBe(false)
    expectCode(() => buildOpenAiLunaRequest({
      bundle,
      priceQuote: { ...priceQuote, verifiedAt: '2026-02-30T00:00:00Z' },
      now: '2026-03-02T00:00:00Z',
    }), 'OPENAI_LUNA_PRICE_INVALID')
    expectCode(() => buildOpenAiLunaRequest({ bundle, priceQuote: { ...priceQuote, inputUsdPerToken: 1 }, now }), 'OPENAI_LUNA_PRICE_INVALID')
    expectCode(() => buildOpenAiLunaRequest({ bundle, priceQuote: { ...priceQuote, outputUsdPerMillionTokens: 10_000 }, now }), 'OPENAI_LUNA_COST_LIMIT')
    expectCode(() => buildOpenAiLunaRequest({
      bundle: { ...bundle, budget: { ...bundle.budget, max_output_tokens: 1 } },
      priceQuote: {
        ...priceQuote,
        inputUsdPerMillionTokens: 10,
        cacheWriteUsdPerMillionTokens: 10,
        outputUsdPerMillionTokens: 0.000_001,
      },
      now,
    }), 'OPENAI_LUNA_COST_LIMIT')
    expectCode(() => buildOpenAiLunaRequest({ bundle: { ...bundle, repository_name: 'PRIVATE_CANARY' }, priceQuote, now }), 'OPENAI_LUNA_REQUEST_INVALID')
  })

  it('rejects a full serialized body over 16,000 bytes while allowing the C1 input itself', () => {
    let nearLimit: C1EvidenceBundle | undefined
    for (let count = 1; count <= 128; count += 1) {
      const candidate = {
        ...bundle,
        evidence: Array.from({ length: count }, (_, index) => ({
          evidence_id: `ev_${String(index + 1).padStart(3, '0')}`,
          layer: 'deterministic' as const,
          feature_id: 'DL.CI.RERUN_RATIO.v1' as const,
          value: 0.08,
          unit: 'ratio' as const,
          coverage: { status: 'complete' as const, sample: 75 },
          limitation_code: 'RERUN_NOT_FLAKE' as const,
        })),
      }
      const inputBytes = Buffer.byteLength(JSON.stringify(candidate), 'utf8')
      if (inputBytes <= OPENAI_LUNA_MAX_INPUT_BYTES) nearLimit = candidate as unknown as C1EvidenceBundle
    }
    expect(nearLimit).toBeDefined()
    expect(Buffer.byteLength(JSON.stringify(nearLimit), 'utf8')).toBeLessThanOrEqual(OPENAI_LUNA_MAX_INPUT_BYTES)
    expectCode(() => buildOpenAiLunaRequest({ bundle: nearLimit, priceQuote, now }), 'OPENAI_LUNA_INPUT_TOO_LARGE')
  })

})
