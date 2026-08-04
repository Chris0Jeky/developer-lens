import { Buffer } from 'node:buffer'
import { TextDecoder } from 'node:util'
import { z } from 'zod'
import { parseJsonWithoutDuplicateKeys } from '../activationTaskCardLoader.js'
import {
  parseC1EvidenceBundle,
  parseModelOutput,
  type C1EvidenceBundle,
  type ModelOutput,
} from './c1Contract.js'
import { OPENAI_LUNA_CREDENTIAL_VARIABLE } from './openaiActivationTask.js'
import {
  revalidateOpenAiLunaBoundPayloadPreview,
  type OpenAiLunaBoundPayloadPreview,
} from './openaiPayloadPreview.js'
import { OPENAI_LUNA_MODEL } from './openaiResponses.js'

export const OPENAI_LUNA_MAX_RESPONSE_BYTES = 262_144 as const

export const OPENAI_LUNA_HTTP_ADAPTER_ERROR = {
  BOUND_PAYLOAD_INVALID: 'OPENAI_LUNA_HTTP_BOUND_PAYLOAD_INVALID',
  CREDENTIAL_INVALID: 'OPENAI_LUNA_HTTP_CREDENTIAL_INVALID',
  REQUEST_FAILED: 'OPENAI_LUNA_HTTP_REQUEST_FAILED',
  TIMEOUT: 'OPENAI_LUNA_HTTP_TIMEOUT',
  PROVIDER_STATUS: 'OPENAI_LUNA_HTTP_PROVIDER_STATUS',
  MEDIA_TYPE_INVALID: 'OPENAI_LUNA_HTTP_MEDIA_TYPE_INVALID',
  RESPONSE_TOO_LARGE: 'OPENAI_LUNA_HTTP_RESPONSE_TOO_LARGE',
  RESPONSE_INVALID: 'OPENAI_LUNA_HTTP_RESPONSE_INVALID',
  OUTPUT_INVALID: 'OPENAI_LUNA_HTTP_OUTPUT_INVALID',
  USAGE_INVALID: 'OPENAI_LUNA_HTTP_USAGE_INVALID',
} as const

export type OpenAiLunaHttpAdapterErrorCode =
  typeof OPENAI_LUNA_HTTP_ADAPTER_ERROR[keyof typeof OPENAI_LUNA_HTTP_ADAPTER_ERROR]

export class OpenAiLunaHttpAdapterError extends Error {
  readonly code: OpenAiLunaHttpAdapterErrorCode

  constructor(code: OpenAiLunaHttpAdapterErrorCode) {
    super(code)
    this.name = 'OpenAiLunaHttpAdapterError'
    this.code = code
  }
}

export type OpenAiLunaUsageReceipt = Readonly<{
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedUsdUpperBound: number
}>

export type OpenAiLunaValidatedResult = Readonly<{
  output: ModelOutput
  receipt: OpenAiLunaUsageReceipt
}>

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export type OpenAiLunaHttpAdapterRuntime = Readonly<{
  currentTime: () => string
  readEnvironmentVariable: (name: typeof OPENAI_LUNA_CREDENTIAL_VARIABLE) => string | undefined
  fetch: FetchLike
}>

const NonnegativeSafeIntegerSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const EmptyArraySchema = z.array(z.never()).length(0)
const UsageSchema = z.object({
  input_tokens: NonnegativeSafeIntegerSchema,
  output_tokens: NonnegativeSafeIntegerSchema,
  total_tokens: NonnegativeSafeIntegerSchema,
}).passthrough()
const OutputTextSchema = z.object({
  type: z.literal('output_text'),
  text: z.string(),
  annotations: EmptyArraySchema,
  logprobs: EmptyArraySchema.optional(),
}).strict()
const AssistantMessageSchema = z.object({
  id: z.string().min(1).max(512),
  type: z.literal('message'),
  status: z.literal('completed'),
  role: z.literal('assistant'),
  content: z.tuple([OutputTextSchema]),
}).strict()
const CompletedResponseSchema = z.object({
  object: z.literal('response'),
  status: z.literal('completed'),
  error: z.null(),
  incomplete_details: z.null(),
  model: z.literal(OPENAI_LUNA_MODEL),
  service_tier: z.literal('default'),
  store: z.literal(false),
  output: z.tuple([AssistantMessageSchema]),
  usage: z.unknown(),
}).passthrough()

function fail(code: OpenAiLunaHttpAdapterErrorCode): never {
  throw new OpenAiLunaHttpAdapterError(code)
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child)
  }
  return value
}

function prepareBoundPayload(
  input: unknown,
  now: string,
): Readonly<{ bound: OpenAiLunaBoundPayloadPreview; bundle: C1EvidenceBundle }> {
  try {
    const bound = revalidateOpenAiLunaBoundPayloadPreview(input, now)
    const bundle = parseC1EvidenceBundle(
      parseJsonWithoutDuplicateKeys(bound.preview.bundleJson),
    )
    return { bound, bundle }
  } catch {
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.BOUND_PAYLOAD_INVALID)
  }
}

function readCredential(runtime: OpenAiLunaHttpAdapterRuntime): string {
  let credential: unknown
  try {
    credential = runtime.readEnvironmentVariable(OPENAI_LUNA_CREDENTIAL_VARIABLE)
  } catch {
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.CREDENTIAL_INVALID)
  }
  if (typeof credential !== 'string' || credential.trim().length === 0) {
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.CREDENTIAL_INVALID)
  }
  return credential
}

async function fetchCompletedResponseOnce(
  bound: OpenAiLunaBoundPayloadPreview,
  credential: string,
  fetchImplementation: FetchLike,
): Promise<z.infer<typeof CompletedResponseSchema>> {
  const controller = new AbortController()
  let didTimeout = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      didTimeout = true
      controller.abort()
      reject(new Error())
    }, bound.card.limits.timeoutMs)
  })

  const request = (async () => {
    const response = await fetchImplementation(bound.preview.request.url, {
      method: bound.preview.request.method,
      headers: {
        Accept: bound.preview.request.headers.Accept,
        Authorization: `Bearer ${credential}`,
        'Content-Type': bound.preview.request.headers['Content-Type'],
      },
      body: bound.preview.request.body,
      redirect: 'error',
      signal: controller.signal,
    })
    if (!(response instanceof Response)) fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.REQUEST_FAILED)
    return parseResponse(response)
  })()

  try {
    return await Promise.race([request, timeout])
  } catch (error) {
    if (didTimeout) return fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.TIMEOUT)
    if (error instanceof OpenAiLunaHttpAdapterError) throw error
    return fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.REQUEST_FAILED)
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // Provider body and cancellation errors are deliberately discarded.
  }
}

function isApplicationJson(value: string | null): boolean {
  if (value === null) return false
  return value.split(';', 1)[0]?.trim().toLowerCase() === 'application/json'
}

function assertContentLength(response: Response): void {
  const value = response.headers.get('content-length')
  if (value === null) return
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_INVALID)
  }
  const length = Number(value)
  if (!Number.isSafeInteger(length)) {
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_INVALID)
  }
  if (length > OPENAI_LUNA_MAX_RESPONSE_BYTES) {
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_TOO_LARGE)
  }
}

async function readResponseBytes(response: Response): Promise<Uint8Array> {
  if (response.body === null) fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_INVALID)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > OPENAI_LUNA_MAX_RESPONSE_BYTES) {
        try {
          await reader.cancel()
        } catch {
          // Provider body and cancellation errors are deliberately discarded.
        }
        fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_TOO_LARGE)
      }
      chunks.push(part.value)
    }
  } catch (error) {
    if (error instanceof OpenAiLunaHttpAdapterError) throw error
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_INVALID)
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // Provider body and stream errors are deliberately discarded.
    }
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size)
}

async function parseResponse(response: Response): Promise<z.infer<typeof CompletedResponseSchema>> {
  if (response.redirected || response.status < 200 || response.status >= 300) {
    await cancelResponseBody(response)
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.PROVIDER_STATUS)
  }
  if (!isApplicationJson(response.headers.get('content-type'))) {
    await cancelResponseBody(response)
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.MEDIA_TYPE_INVALID)
  }
  try {
    assertContentLength(response)
    const bytes = await readResponseBytes(response)
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const parsed = CompletedResponseSchema.safeParse(parseJsonWithoutDuplicateKeys(text))
    if (!parsed.success) fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_INVALID)
    return parsed.data
  } catch (error) {
    await cancelResponseBody(response)
    if (error instanceof OpenAiLunaHttpAdapterError) throw error
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.RESPONSE_INVALID)
  }
}

function validateOutput(bundle: C1EvidenceBundle, text: string): ModelOutput {
  try {
    return parseModelOutput(bundle, parseJsonWithoutDuplicateKeys(text))
  } catch {
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.OUTPUT_INVALID)
  }
}

function buildUsageReceipt(
  bound: OpenAiLunaBoundPayloadPreview,
  bundle: C1EvidenceBundle,
  value: unknown,
): OpenAiLunaUsageReceipt {
  const parsed = UsageSchema.safeParse(value)
  if (!parsed.success) fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.USAGE_INVALID)
  const usage = parsed.data
  if (
    usage.total_tokens !== usage.input_tokens + usage.output_tokens ||
    usage.input_tokens > bundle.budget.max_input_tokens ||
    usage.output_tokens > bundle.budget.max_output_tokens
  ) fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.USAGE_INVALID)

  const maximumInputPrice = Math.max(
    bound.card.priceQuote.inputUsdPerMillionTokens,
    bound.card.priceQuote.cacheWriteUsdPerMillionTokens,
  )
  const estimatedUsdUpperBound = (
    usage.input_tokens * maximumInputPrice +
    usage.output_tokens * bound.card.priceQuote.outputUsdPerMillionTokens
  ) / 1_000_000
  if (
    !Number.isFinite(estimatedUsdUpperBound) ||
    estimatedUsdUpperBound > bound.card.limits.maxEstimatedUsd
  ) fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.USAGE_INVALID)

  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
    estimatedUsdUpperBound,
  }
}

/** @internal Injected seam for invented tests; it still requires a genuine reviewed binding. */
export async function invokeOpenAiLunaBoundPayloadCore(
  input: unknown,
  runtime: OpenAiLunaHttpAdapterRuntime,
): Promise<OpenAiLunaValidatedResult> {
  let now: string
  try {
    now = runtime.currentTime()
  } catch {
    fail(OPENAI_LUNA_HTTP_ADAPTER_ERROR.BOUND_PAYLOAD_INVALID)
  }
  const { bound, bundle } = prepareBoundPayload(input, now)
  const credential = readCredential(runtime)
  const completed = await fetchCompletedResponseOnce(bound, credential, runtime.fetch)
  const output = validateOutput(bundle, completed.output[0].content[0].text)
  const receipt = buildUsageReceipt(bound, bundle, completed.usage)
  return freezeDeep({ output, receipt })
}

/** Invoke one reviewed OpenAI/Luna request with no retry, cache, telemetry, or persistence. */
export function invokeOpenAiLunaBoundPayload(
  input: OpenAiLunaBoundPayloadPreview,
): Promise<OpenAiLunaValidatedResult> {
  return invokeOpenAiLunaBoundPayloadCore(input, {
    currentTime: () => new Date().toISOString(),
    readEnvironmentVariable: (name) => process.env[name],
    fetch: (request, init) => globalThis.fetch(request, init),
  })
}
