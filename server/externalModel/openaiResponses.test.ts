import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import {
  OPENAI_LUNA_ENDPOINT,
  OPENAI_LUNA_MAX_INPUT_BYTES,
  OpenAiLunaRequestError,
  buildOpenAiLunaRequest,
  sendOpenAiLunaRequest,
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

const output = {
  schema_version: '1.0.0', request_id: bundle.bundle_id,
  claims: [{
    claim_id: 'claim_01', kind: 'hypothesis', statement_code: 'CI_RERUN_PATTERN',
    evidence_ids: ['ev_001'], contradicting_evidence_ids: [], alternative_codes: ['SEASONALITY'],
    confidence_band: 'low', limitation_codes: ['RERUN_NOT_FLAKE'],
  }],
}

const priceQuote = {
  model: 'gpt-5.6-luna' as const,
  inputUsdPerMillionTokens: 1,
  outputUsdPerMillionTokens: 1,
  verifiedAt: '2026-08-04T00:00:00Z',
}
const now = '2026-08-04T12:00:00Z'

function expectCode(action: () => unknown, code: string): void {
  expect(action).toThrowError(new OpenAiLunaRequestError(code as never))
}

describe('injected OpenAI/Luna Responses boundary', () => {
  it('builds an exact credentialless descriptor with a closed body allowlist', () => {
    const request = buildOpenAiLunaRequest({ bundle, priceQuote, now })
    expect(request).toMatchObject({ method: 'POST', url: OPENAI_LUNA_ENDPOINT })
    expect(request.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' })
    expect(Object.keys(request)).toEqual(['method', 'url', 'headers', 'body'])
    const body = JSON.parse(request.body) as Record<string, unknown>
    expect(body).toEqual({
      model: 'gpt-5.6-luna', store: false, max_output_tokens: 1500,
      input: expect.stringContaining('req_00000000000000000000000000000001'),
    })
    expect(Object.keys(body).sort()).toEqual(['input', 'max_output_tokens', 'model', 'store'])
    expect(JSON.stringify(request)).not.toContain('Authorization')
    expect(JSON.stringify(request)).not.toContain('tools')
    expect(JSON.stringify(request)).not.toContain('SECRET_PROVIDER_ID')
    expect(Buffer.byteLength(JSON.stringify(bundle), 'utf8')).toBeLessThanOrEqual(OPENAI_LUNA_MAX_INPUT_BYTES)
    expect(Buffer.byteLength(request.body, 'utf8')).toBeLessThanOrEqual(OPENAI_LUNA_MAX_INPUT_BYTES)
    expect(Object.isFrozen(request)).toBe(true)
  })

  it('rejects invalid, stale, malformed, and over-budget pricing before any callback', () => {
    expectCode(() => buildOpenAiLunaRequest({ bundle, priceQuote: { ...priceQuote, model: 'other' }, now }), 'OPENAI_LUNA_PRICE_INVALID')
    expectCode(() => buildOpenAiLunaRequest({ bundle, priceQuote: { ...priceQuote, verifiedAt: '2026-08-02T11:59:59Z' }, now }), 'OPENAI_LUNA_PRICE_INVALID')
    expectCode(() => buildOpenAiLunaRequest({ bundle, priceQuote: { ...priceQuote, inputUsdPerToken: 1 }, now }), 'OPENAI_LUNA_PRICE_INVALID')
    expectCode(() => buildOpenAiLunaRequest({ bundle, priceQuote: { ...priceQuote, outputUsdPerMillionTokens: 10_000 }, now }), 'OPENAI_LUNA_COST_LIMIT')
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

  it('calls exactly once, never retries, and returns only validated structured output', async () => {
    let calls = 0
    const result = await sendOpenAiLunaRequest({
      bundle, priceQuote, now,
      call: async (request) => {
        calls += 1
        expect(request.url).toBe(OPENAI_LUNA_ENDPOINT)
        return { status: 200, structuredOutput: output }
      },
    })
    expect(calls).toBe(1)
    expect(result).toEqual(output)

    calls = 0
    await expect(sendOpenAiLunaRequest({
      bundle, priceQuote, now,
      call: async () => { calls += 1; throw new Error('SECRET_PROVIDER_BODY') },
    })).rejects.toThrow('OPENAI_LUNA_CALL_FAILED')
    expect(calls).toBe(1)
  })

  it('rejects non-2xx, raw provider fields, and invalid output without leaking content', async () => {
    await expect(sendOpenAiLunaRequest({
      bundle, priceQuote, now,
      call: async () => ({ status: 503, structuredOutput: { provider_id: 'SECRET_PROVIDER_ID' } }),
    })).rejects.toThrow('OPENAI_LUNA_PROVIDER_STATUS')

    await expect(sendOpenAiLunaRequest({
      bundle, priceQuote, now,
      call: async () => ({ status: 200, structuredOutput: { ...output, claims: [{ ...output.claims[0], evidence_ids: ['ev_999'] }] } }),
    })).rejects.toThrow('OPENAI_LUNA_OUTPUT_INVALID')

    await expect(sendOpenAiLunaRequest({
      bundle, priceQuote, now,
      call: async () => ({ status: 200, structuredOutput: output, body: 'SECRET_PROVIDER_BODY' } as never),
    })).rejects.toThrow('OPENAI_LUNA_CALL_FAILED')
    try {
      await sendOpenAiLunaRequest({
        bundle, priceQuote, now,
        call: async () => { throw new Error('SECRET_PROVIDER_BODY') },
      })
    } catch (error) {
      expect((error as Error).message).not.toContain('SECRET_PROVIDER_BODY')
      expect((error as Error).message).not.toContain('SECRET_PROVIDER_ID')
    }
  })
})
