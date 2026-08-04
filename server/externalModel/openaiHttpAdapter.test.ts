import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  OPENAI_LUNA_HTTP_ADAPTER_ERROR,
  OPENAI_LUNA_MAX_RESPONSE_BYTES,
  OpenAiLunaHttpAdapterError,
  invokeOpenAiLunaBoundPayloadCore,
  type OpenAiLunaHttpAdapterErrorCode,
  type OpenAiLunaHttpAdapterRuntime,
} from './openaiHttpAdapter.js'
import { OPENAI_LUNA_CREDENTIAL_VARIABLE } from './openaiActivationTask.js'
import {
  bindOpenAiLunaPayloadPreview,
  type OpenAiLunaBoundPayloadPreview,
} from './openaiPayloadPreview.js'
import { buildOpenAiLunaRequestPreview } from './openaiResponses.js'

const now = '2026-08-04T12:00:00.000Z'
const bundle = {
  schema_version: '1.0.0',
  bundle_id: 'req_00000000000000000000000000000001',
  range: { start: '2026-01-01T00:00:00Z', end: '2026-03-01T00:00:00Z' },
  consent_revision: 'consent-v3',
  redaction_revision: 'redaction-v2',
  budget: { max_input_tokens: 12_000, max_output_tokens: 1_500 },
  evidence: [{
    evidence_id: 'ev_001',
    layer: 'deterministic',
    feature_id: 'DL.CI.RERUN_RATIO.v1',
    value: 0.08,
    unit: 'ratio',
    coverage: { status: 'complete', sample: 75 },
    limitation_code: 'RERUN_NOT_FLAKE',
  }],
}
const priceQuote = {
  model: 'gpt-5.6-luna',
  serviceTier: 'default',
  contextBand: 'short',
  unit: 'USD_PER_MILLION_TOKENS',
  inputUsdPerMillionTokens: 0.2,
  cacheWriteUsdPerMillionTokens: 0.25,
  outputUsdPerMillionTokens: 1.2,
  verifiedAt: '2026-08-04T00:00:00Z',
}
const modelOutput = {
  schema_version: '1.0.0',
  request_id: bundle.bundle_id,
  claims: [{
    claim_id: 'claim_01',
    kind: 'hypothesis',
    statement_code: 'CI_RERUN_PATTERN',
    evidence_ids: ['ev_001'],
    contradicting_evidence_ids: [],
    alternative_codes: ['SEASONALITY'],
    confidence_band: 'low',
    limitation_codes: ['RERUN_NOT_FLAKE'],
  }],
}
const digest = 'a'.repeat(64)

function sha256Utf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function makeBound(timeoutMs = 30_000): OpenAiLunaBoundPayloadPreview {
  const preview = buildOpenAiLunaRequestPreview({ bundle, priceQuote, now })
  const card = {
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
    credential: {
      source: 'process_environment',
      variable: OPENAI_LUNA_CREDENTIAL_VARIABLE,
      fallback: 'none',
    },
    limits: {
      requestLimit: 1,
      retryLimit: 0,
      maxInputBytes: 16_000,
      maxOutputTokens: 2_000,
      maxEstimatedUsd: 0.01,
      timeoutMs,
    },
    priceQuote,
    payload: {
      bundleId: bundle.bundle_id,
      bundleSha256: sha256Utf8(preview.bundleJson),
      requestBodySha256: sha256Utf8(preview.request.body),
    },
    pricingEvidenceStatus: 'reconciled',
    officialEvidence: [
      {
        kind: 'model',
        url: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
        retrievedAt: '2026-08-04T00:00:00.000Z',
        sha256: digest,
      },
      {
        kind: 'pricing',
        url: 'https://developers.openai.com/api/docs/pricing',
        retrievedAt: '2026-08-04T00:00:00.000Z',
        sha256: digest,
      },
      {
        kind: 'data_controls',
        url: 'https://developers.openai.com/api/docs/guides/your-data',
        retrievedAt: '2026-08-04T00:00:00.000Z',
        sha256: digest,
      },
      {
        kind: 'structured_outputs',
        url: 'https://developers.openai.com/api/docs/guides/structured-outputs',
        retrievedAt: '2026-08-04T00:00:00.000Z',
        sha256: digest,
      },
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
    review: {
      status: 'reviewed',
      preview: 'exact_request_body_bound',
      reviewedAt: '2026-08-04T11:00:00.000Z',
    },
  }
  return bindOpenAiLunaPayloadPreview({ card, bundle, now })
}

function assistantMessage(content: unknown[] = [{
  type: 'output_text',
  text: JSON.stringify(modelOutput),
  annotations: [],
}]): Record<string, unknown> {
  return {
    id: 'msg_fixture_provider_id',
    type: 'message',
    status: 'completed',
    role: 'assistant',
    content,
  }
}

function completedEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'resp_fixture_provider_id',
    object: 'response',
    status: 'completed',
    error: null,
    incomplete_details: null,
    model: 'gpt-5.6-luna',
    service_tier: 'default',
    store: false,
    output: [assistantMessage()],
    usage: {
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 3, cache_write_tokens: 2 },
      output_tokens: 50,
      output_tokens_details: { reasoning_tokens: 4 },
      total_tokens: 150,
      provider_usage_id: 'usage_fixture_provider_id',
    },
    ...overrides,
  }
}

function jsonResponse(
  value: unknown,
  status = 200,
  contentType: string | null = 'application/json',
): Response {
  const headers = new Headers()
  if (contentType !== null) headers.set('content-type', contentType)
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), { status, headers })
}

function makeRuntime(input: {
  credential: string | undefined
  response: OpenAiLunaHttpAdapterRuntime['fetch']
  currentTime?: string
  credentialFailure?: boolean
}): {
    runtime: OpenAiLunaHttpAdapterRuntime
    stats: { credentialReads: number; fetchCalls: number; names: string[] }
  } {
  const stats = { credentialReads: 0, fetchCalls: 0, names: [] as string[] }
  return {
    stats,
    runtime: {
      currentTime: () => input.currentTime ?? now,
      readEnvironmentVariable: (name) => {
        stats.credentialReads += 1
        stats.names.push(name)
        if (input.credentialFailure) throw new Error('fixture-environment-failure')
        return input.credential
      },
      fetch: async (request, init) => {
        stats.fetchCalls += 1
        return input.response(request, init)
      },
    },
  }
}

async function expectAdapterError(
  action: () => Promise<unknown>,
  code: OpenAiLunaHttpAdapterErrorCode,
): Promise<OpenAiLunaHttpAdapterError> {
  let caught: unknown
  try {
    await action()
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(OpenAiLunaHttpAdapterError)
  expect(caught).toMatchObject({ code, message: code })
  return caught as OpenAiLunaHttpAdapterError
}

describe('OpenAI/Luna bound HTTP adapter', () => {
  it('sends the reviewed descriptor body once and returns only frozen output and numeric receipt', async () => {
    const bound = makeBound()
    let capturedUrl: string | URL | Request | undefined
    let capturedInit: RequestInit | undefined
    const { runtime, stats } = makeRuntime({
      credential: 'fixture-api-key',
      response: async (request, init) => {
        capturedUrl = request
        capturedInit = init
        return jsonResponse(completedEnvelope(), 201, 'Application/JSON; charset=utf-8')
      },
    })

    const result = await invokeOpenAiLunaBoundPayloadCore(bound, runtime)

    expect(stats).toEqual({
      credentialReads: 1,
      fetchCalls: 1,
      names: [OPENAI_LUNA_CREDENTIAL_VARIABLE],
    })
    expect(capturedUrl).toBe(bound.preview.request.url)
    expect(capturedInit).toMatchObject({
      method: 'POST',
      body: bound.preview.request.body,
      redirect: 'error',
    })
    expect(capturedInit?.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer fixture-api-key',
      'Content-Type': 'application/json',
    })
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal)
    expect(Object.keys(result)).toEqual(['output', 'receipt'])
    expect(result.output).toEqual(modelOutput)
    expect(result.receipt).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedUsdUpperBound: 0.000_085,
    })
    expect(Object.keys(result.receipt)).toEqual([
      'inputTokens', 'outputTokens', 'totalTokens', 'estimatedUsdUpperBound',
    ])
    expect(JSON.stringify(result)).not.toContain('fixture_provider_id')
    expect(JSON.stringify(result)).not.toContain('fixture-api-key')
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.output)).toBe(true)
    expect(Object.isFrozen(result.output.claims)).toBe(true)
    expect(Object.isFrozen(result.output.claims[0])).toBe(true)
    expect(Object.isFrozen(result.receipt)).toBe(true)
  })

  it('rejects forged or stale bindings before credential or fetch access', async () => {
    const bound = makeBound()
    const forged = Object.freeze({ card: bound.card, preview: bound.preview })
    for (const [input, currentTime] of [
      [forged, now],
      [bound, '2026-08-05T00:00:01.000Z'],
    ] as const) {
      const { runtime, stats } = makeRuntime({
        credential: 'fixture-api-key',
        currentTime,
        response: async () => jsonResponse(completedEnvelope()),
      })
      await expectAdapterError(
        () => invokeOpenAiLunaBoundPayloadCore(input, runtime),
        OPENAI_LUNA_HTTP_ADAPTER_ERROR.BOUND_PAYLOAD_INVALID,
      )
      expect(stats).toEqual({ credentialReads: 0, fetchCalls: 0, names: [] })
    }
  })

  it('reads only the approved credential name once and rejects missing or blank values', async () => {
    for (const credential of [undefined, '', ' \r\n\t']) {
      const { runtime, stats } = makeRuntime({
        credential,
        response: async () => jsonResponse(completedEnvelope()),
      })
      await expectAdapterError(
        () => invokeOpenAiLunaBoundPayloadCore(makeBound(), runtime),
        OPENAI_LUNA_HTTP_ADAPTER_ERROR.CREDENTIAL_INVALID,
      )
      expect(stats).toEqual({
        credentialReads: 1,
        fetchCalls: 0,
        names: [OPENAI_LUNA_CREDENTIAL_VARIABLE],
      })
    }

    const failedRead = makeRuntime({
      credential: undefined,
      credentialFailure: true,
      response: async () => jsonResponse(completedEnvelope()),
    })
    await expectAdapterError(
      () => invokeOpenAiLunaBoundPayloadCore(makeBound(), failedRead.runtime),
      OPENAI_LUNA_HTTP_ADAPTER_ERROR.CREDENTIAL_INVALID,
    )
    expect(failedRead.stats.credentialReads).toBe(1)
    expect(failedRead.stats.fetchCalls).toBe(0)
  })

  it('does not retry network failures, redirects, provider failures, or timeout', async () => {
    const network = makeRuntime({
      credential: 'fixture-api-key',
      response: async () => { throw new Error('fixture-private-provider-body') },
    })
    const networkError = await expectAdapterError(
      () => invokeOpenAiLunaBoundPayloadCore(makeBound(), network.runtime),
      OPENAI_LUNA_HTTP_ADAPTER_ERROR.REQUEST_FAILED,
    )
    expect(network.stats.fetchCalls).toBe(1)
    expect(networkError.message).not.toContain('fixture-private-provider-body')

    for (const status of [302, 400, 429, 503]) {
      const failure = makeRuntime({
        credential: 'fixture-api-key',
        response: async (_request, init) => {
          expect(init?.redirect).toBe('error')
          return jsonResponse('fixture-private-provider-body', status)
        },
      })
      await expectAdapterError(
        () => invokeOpenAiLunaBoundPayloadCore(makeBound(), failure.runtime),
        OPENAI_LUNA_HTTP_ADAPTER_ERROR.PROVIDER_STATUS,
      )
      expect(failure.stats.fetchCalls).toBe(1)
    }

    const timeout = makeRuntime({
      credential: 'fixture-api-key',
      response: async (_request, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new Error('fixture-timeout-provider-body')),
          { once: true },
        )
      }),
    })
    await expectAdapterError(
      () => invokeOpenAiLunaBoundPayloadCore(makeBound(5), timeout.runtime),
      OPENAI_LUNA_HTTP_ADAPTER_ERROR.TIMEOUT,
    )
    expect(timeout.stats.fetchCalls).toBe(1)

    const stalledBody = makeRuntime({
      credential: 'fixture-api-key',
      response: async (_request, init) => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            init?.signal?.addEventListener(
              'abort',
              () => controller.error(new Error('fixture-stalled-provider-body')),
              { once: true },
            )
          },
        })
        return new Response(body, { headers: { 'content-type': 'application/json' } })
      },
    })
    await expectAdapterError(
      () => invokeOpenAiLunaBoundPayloadCore(makeBound(5), stalledBody.runtime),
      OPENAI_LUNA_HTTP_ADAPTER_ERROR.TIMEOUT,
    )
    expect(stalledBody.stats.fetchCalls).toBe(1)
  })

  it('requires application/json and caps declared and streamed response bytes', async () => {
    for (const contentType of [null, 'text/plain', 'application/problem+json']) {
      const invalidType = makeRuntime({
        credential: 'fixture-api-key',
        response: async () => jsonResponse(completedEnvelope(), 200, contentType),
      })
      await expectAdapterError(
        () => invokeOpenAiLunaBoundPayloadCore(makeBound(), invalidType.runtime),
        OPENAI_LUNA_HTTP_ADAPTER_ERROR.MEDIA_TYPE_INVALID,
      )
      expect(invalidType.stats.fetchCalls).toBe(1)
    }

    const declared = makeRuntime({
      credential: 'fixture-api-key',
      response: async () => new Response('{}', {
        headers: {
          'content-length': String(OPENAI_LUNA_MAX_RESPONSE_BYTES + 1),
          'content-type': 'application/json',
        },
      }),
    })
    await expectAdapterError(
      () => invokeOpenAiLunaBoundPayloadCore(makeBound(), declared.runtime),
      OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_TOO_LARGE,
    )

    const streamed = makeRuntime({
      credential: 'fixture-api-key',
      response: async () => new Response(new Uint8Array(OPENAI_LUNA_MAX_RESPONSE_BYTES + 1), {
        headers: { 'content-type': 'application/json' },
      }),
    })
    await expectAdapterError(
      () => invokeOpenAiLunaBoundPayloadCore(makeBound(), streamed.runtime),
      OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_TOO_LARGE,
    )

    const malformedLength = makeRuntime({
      credential: 'fixture-api-key',
      response: async () => new Response('{}', {
        headers: { 'content-length': '01', 'content-type': 'application/json' },
      }),
    })
    await expectAdapterError(
      () => invokeOpenAiLunaBoundPayloadCore(makeBound(), malformedLength.runtime),
      OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_INVALID,
    )
  })

  it('fatally decodes UTF-8 and rejects duplicate JSON keys in both response layers', async () => {
    const invalidUtf8 = makeRuntime({
      credential: 'fixture-api-key',
      response: async () => new Response(Uint8Array.from([0xc3, 0x28]), {
        headers: { 'content-type': 'application/json' },
      }),
    })
    await expectAdapterError(
      () => invokeOpenAiLunaBoundPayloadCore(makeBound(), invalidUtf8.runtime),
      OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_INVALID,
    )

    const responseText = JSON.stringify(completedEnvelope()).replace(
      '"status":"completed"',
      '"status":"completed","status":"completed"',
    )
    const duplicateEnvelope = makeRuntime({
      credential: 'fixture-api-key',
      response: async () => jsonResponse(responseText),
    })
    await expectAdapterError(
      () => invokeOpenAiLunaBoundPayloadCore(makeBound(), duplicateEnvelope.runtime),
      OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_INVALID,
    )

    const duplicateOutputText = JSON.stringify(modelOutput).replace(
      '"schema_version":"1.0.0"',
      '"schema_version":"1.0.0","schema_version":"1.0.0"',
    )
    const duplicateOutput = makeRuntime({
      credential: 'fixture-api-key',
      response: async () => jsonResponse(completedEnvelope({
        output: [assistantMessage([{
          type: 'output_text', text: duplicateOutputText, annotations: [],
        }])],
      })),
    })
    await expectAdapterError(
      () => invokeOpenAiLunaBoundPayloadCore(makeBound(), duplicateOutput.runtime),
      OPENAI_LUNA_HTTP_ADAPTER_ERROR.OUTPUT_INVALID,
    )
  })

  it('rejects nonterminal, refusal, missing, multiple, and unknown response output shapes', async () => {
    const invalidEnvelopes: unknown[] = [
      completedEnvelope({ status: 'in_progress' }),
      completedEnvelope({ status: 'incomplete' }),
      completedEnvelope({ status: 'unknown' }),
      completedEnvelope({ status: undefined }),
      completedEnvelope({ output: [] }),
      completedEnvelope({ output: [assistantMessage(), assistantMessage()] }),
      completedEnvelope({ output: [{ type: 'reasoning', id: 'reasoning_fixture_id' }] }),
      completedEnvelope({ output: [{ ...assistantMessage(), status: 'in_progress' }] }),
      completedEnvelope({ output: [{ ...assistantMessage(), role: 'user' }] }),
      completedEnvelope({ output: [{ ...assistantMessage(), provider_extra: true }] }),
      completedEnvelope({ output: [assistantMessage([])] }),
      completedEnvelope({ output: [assistantMessage([
        { type: 'output_text', text: JSON.stringify(modelOutput), annotations: [] },
        { type: 'output_text', text: JSON.stringify(modelOutput), annotations: [] },
      ])] }),
      completedEnvelope({ output: [assistantMessage([{
        type: 'refusal', refusal: 'fixture-refusal-provider-body',
      }])] }),
      completedEnvelope({ output: [assistantMessage([{
        type: 'unknown', text: JSON.stringify(modelOutput), annotations: [],
      }])] }),
      completedEnvelope({ output: [assistantMessage([{
        type: 'output_text', text: JSON.stringify(modelOutput), annotations: [], provider_extra: true,
      }])] }),
    ]

    for (const envelope of invalidEnvelopes) {
      const invalid = makeRuntime({
        credential: 'fixture-api-key',
        response: async () => jsonResponse(envelope),
      })
      await expectAdapterError(
        () => invokeOpenAiLunaBoundPayloadCore(makeBound(), invalid.runtime),
        OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_INVALID,
      )
      expect(invalid.stats.fetchCalls).toBe(1)
    }
  })

  it('cross-binds structured output to the exact request and evidence IDs', async () => {
    const invalidOutputs: unknown[] = [
      { ...modelOutput, request_id: 'req_11111111111111111111111111111111' },
      {
        ...modelOutput,
        claims: [{ ...modelOutput.claims[0], evidence_ids: ['ev_999'] }],
      },
      { ...modelOutput, provider_source: 'fixture-private-provider-body' },
      '{',
    ]
    for (const output of invalidOutputs) {
      const text = typeof output === 'string' ? output : JSON.stringify(output)
      const invalid = makeRuntime({
        credential: 'fixture-api-key',
        response: async () => jsonResponse(completedEnvelope({
          output: [assistantMessage([{ type: 'output_text', text, annotations: [] }])],
        })),
      })
      const error = await expectAdapterError(
        () => invokeOpenAiLunaBoundPayloadCore(makeBound(), invalid.runtime),
        OPENAI_LUNA_HTTP_ADAPTER_ERROR.OUTPUT_INVALID,
      )
      expect(error.message).not.toContain('fixture-private-provider-body')
    }
  })

  it('rejects malformed or over-budget numeric usage', async () => {
    const invalidUsages: unknown[] = [
      { input_tokens: -1, output_tokens: 50, total_tokens: 49 },
      { input_tokens: 1.5, output_tokens: 50, total_tokens: 51.5 },
      { input_tokens: 100, output_tokens: 50, total_tokens: 151 },
      { input_tokens: 12_001, output_tokens: 50, total_tokens: 12_051 },
      { input_tokens: 100, output_tokens: 1_501, total_tokens: 1_601 },
      { input_tokens: 100, output_tokens: 50 },
    ]
    for (const usage of invalidUsages) {
      const invalid = makeRuntime({
        credential: 'fixture-api-key',
        response: async () => jsonResponse(completedEnvelope({ usage })),
      })
      await expectAdapterError(
        () => invokeOpenAiLunaBoundPayloadCore(makeBound(), invalid.runtime),
        OPENAI_LUNA_HTTP_ADAPTER_ERROR.USAGE_INVALID,
      )
    }
  })
})
