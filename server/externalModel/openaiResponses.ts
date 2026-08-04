import { Buffer } from 'node:buffer'
import { z } from 'zod'
import {
  parseC1EvidenceBundle,
  parseModelOutput,
  type C1EvidenceBundle,
  type ModelOutput,
} from './c1Contract.js'

export const OPENAI_LUNA_ENDPOINT = 'https://api.openai.com/v1/responses' as const
export const OPENAI_LUNA_MODEL = 'gpt-5.6-luna' as const
export const OPENAI_LUNA_MAX_INPUT_BYTES = 16_000 as const
export const OPENAI_LUNA_MAX_OUTPUT_TOKENS = 2_000 as const
export const OPENAI_LUNA_MAX_ESTIMATED_USD = 0.01 as const
export const OPENAI_LUNA_MAX_PRICE_AGE_SECONDS = 86_400 as const

const FIXED_INSTRUCTIONS =
  'Use only the supplied deterministic C1 evidence. Return schema-valid hypotheses, counter-hypotheses, or abstentions; never invent evidence or include source text.'
const UtcTimestampSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
const PriceQuoteSchema = z.object({
  model: z.literal(OPENAI_LUNA_MODEL),
  inputUsdPerMillionTokens: z.number().finite().nonnegative().max(10_000),
  outputUsdPerMillionTokens: z.number().finite().nonnegative().max(10_000),
  verifiedAt: UtcTimestampSchema,
}).strict()
const CallResultSchema = z.object({
  status: z.number().int().min(100).max(599),
  structuredOutput: z.unknown(),
}).strict()

export type OpenAiLunaPriceQuote = z.infer<typeof PriceQuoteSchema>

export type OpenAiLunaRequestDescriptor = Readonly<{
  method: 'POST'
  url: typeof OPENAI_LUNA_ENDPOINT
  headers: Readonly<{
    Accept: 'application/json'
    'Content-Type': 'application/json'
  }>
  body: string
}>

export type OpenAiLunaCallResult = z.infer<typeof CallResultSchema>
export type OpenAiLunaCall = (request: OpenAiLunaRequestDescriptor) => Promise<OpenAiLunaCallResult>

export class OpenAiLunaRequestError extends Error {
  readonly code: OpenAiLunaRequestErrorCode

  constructor(code: OpenAiLunaRequestErrorCode) {
    super(code)
    this.name = 'OpenAiLunaRequestError'
    this.code = code
  }
}

export type OpenAiLunaRequestErrorCode =
  | 'OPENAI_LUNA_REQUEST_INVALID'
  | 'OPENAI_LUNA_PRICE_INVALID'
  | 'OPENAI_LUNA_INPUT_TOO_LARGE'
  | 'OPENAI_LUNA_COST_LIMIT'
  | 'OPENAI_LUNA_CALL_FAILED'
  | 'OPENAI_LUNA_PROVIDER_STATUS'
  | 'OPENAI_LUNA_OUTPUT_INVALID'

function fail(code: OpenAiLunaRequestErrorCode): never {
  throw new OpenAiLunaRequestError(code)
}

function canonicalUtc(value: string): number | null {
  if (!UtcTimestampSchema.safeParse(value).success) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validatePriceQuote(priceQuote: unknown, now: string): OpenAiLunaPriceQuote {
  const parsed = PriceQuoteSchema.safeParse(priceQuote)
  const nowMs = canonicalUtc(now)
  if (!parsed.success || nowMs === null) fail('OPENAI_LUNA_PRICE_INVALID')
  const verifiedAtMs = canonicalUtc(parsed.data.verifiedAt)
  if (verifiedAtMs === null || verifiedAtMs > nowMs) fail('OPENAI_LUNA_PRICE_INVALID')
  const ageSeconds = Math.floor((nowMs - verifiedAtMs) / 1000)
  if (ageSeconds > OPENAI_LUNA_MAX_PRICE_AGE_SECONDS) fail('OPENAI_LUNA_PRICE_INVALID')
  return parsed.data
}

function bodyForBundle(bundle: C1EvidenceBundle): {
  body: string
  inputBytes: number
  bodyBytes: number
} {
  let evidenceInput: string
  try {
    evidenceInput = JSON.stringify(bundle)
  } catch {
    fail('OPENAI_LUNA_REQUEST_INVALID')
  }
  const inputBytes = Buffer.byteLength(evidenceInput, 'utf8')
  if (inputBytes > OPENAI_LUNA_MAX_INPUT_BYTES) fail('OPENAI_LUNA_INPUT_TOO_LARGE')
  const bodyObject = {
    model: OPENAI_LUNA_MODEL,
    store: false,
    max_output_tokens: bundle.budget.max_output_tokens,
    input: `${FIXED_INSTRUCTIONS}\n${evidenceInput}`,
  } as const
  const body = JSON.stringify(bodyObject)
  const bodyBytes = Buffer.byteLength(body, 'utf8')
  if (bodyBytes > OPENAI_LUNA_MAX_INPUT_BYTES) fail('OPENAI_LUNA_INPUT_TOO_LARGE')
  return { body, inputBytes, bodyBytes }
}

function estimateUsd(bodyBytes: number, maxOutputTokens: number, price: OpenAiLunaPriceQuote): number {
  const estimatedInputTokens = Math.ceil(bodyBytes / 4)
  const estimate = (
    estimatedInputTokens * price.inputUsdPerMillionTokens +
    maxOutputTokens * price.outputUsdPerMillionTokens
  ) / 1_000_000
  if (!Number.isFinite(estimate) || estimate > OPENAI_LUNA_MAX_ESTIMATED_USD) {
    fail('OPENAI_LUNA_COST_LIMIT')
  }
  return estimate
}

/** Build a fixed, credentialless descriptor; no filesystem/network/env access occurs. */
export function buildOpenAiLunaRequest(input: {
  bundle: unknown
  priceQuote: unknown
  now: string
}): OpenAiLunaRequestDescriptor {
  let bundle: C1EvidenceBundle
  try {
    bundle = parseC1EvidenceBundle(input.bundle)
  } catch {
    fail('OPENAI_LUNA_REQUEST_INVALID')
  }
  const price = validatePriceQuote(input.priceQuote, input.now)
  const { body, bodyBytes } = bodyForBundle(bundle)
  estimateUsd(bodyBytes, bundle.budget.max_output_tokens, price)
  return Object.freeze({
    method: 'POST',
    url: OPENAI_LUNA_ENDPOINT,
    headers: Object.freeze({ Accept: 'application/json', 'Content-Type': 'application/json' }),
    body,
  })
}

/** Invoke one injected call and validate only its structured output; never retry. */
export async function sendOpenAiLunaRequest(input: {
  bundle: unknown
  priceQuote: unknown
  now: string
  call: OpenAiLunaCall
}): Promise<ModelOutput> {
  let bundle: C1EvidenceBundle
  let request: OpenAiLunaRequestDescriptor
  try {
    bundle = parseC1EvidenceBundle(input.bundle)
    request = buildOpenAiLunaRequest({ bundle, priceQuote: input.priceQuote, now: input.now })
  } catch (error) {
    if (error instanceof OpenAiLunaRequestError) throw error
    fail('OPENAI_LUNA_REQUEST_INVALID')
  }

  let result: unknown
  try {
    result = await input.call(request)
  } catch {
    fail('OPENAI_LUNA_CALL_FAILED')
  }
  const parsedResult = CallResultSchema.safeParse(result)
  if (!parsedResult.success) fail('OPENAI_LUNA_CALL_FAILED')
  if (parsedResult.data.status < 200 || parsedResult.data.status >= 300) {
    fail('OPENAI_LUNA_PROVIDER_STATUS')
  }
  try {
    return parseModelOutput(bundle, parsedResult.data.structuredOutput)
  } catch {
    fail('OPENAI_LUNA_OUTPUT_INVALID')
  }
}
