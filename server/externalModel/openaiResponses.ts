import { Buffer } from 'node:buffer'
import { z } from 'zod'
import {
  parseC1EvidenceBundle,
  parseModelOutput,
  type C1EvidenceBundle,
  ModelOutputSchema,
  type ModelOutput,
} from './c1Contract.js'

export const OPENAI_LUNA_ENDPOINT = 'https://api.openai.com/v1/responses' as const
export const OPENAI_LUNA_MODEL = 'gpt-5.6-luna' as const
export const OPENAI_LUNA_MAX_INPUT_BYTES = 16_000 as const
export const OPENAI_LUNA_MAX_OUTPUT_TOKENS = 2_000 as const
export const OPENAI_LUNA_MAX_ESTIMATED_USD = 0.01 as const
export const OPENAI_LUNA_MAX_PRICE_AGE_SECONDS = 86_400 as const
export const OPENAI_LUNA_OUTPUT_SCHEMA_NAME = 'developer_lens_c1_output' as const

const FIXED_INSTRUCTIONS =
  'Use only the supplied deterministic C1 evidence. Return schema-valid hypotheses, counter-hypotheses, or abstentions; never invent evidence or include source text.'
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
const PriceQuoteSchema = z.object({
  model: z.literal(OPENAI_LUNA_MODEL),
  serviceTier: z.literal('default'),
  contextBand: z.literal('short'),
  unit: z.literal('USD_PER_MILLION_TOKENS'),
  inputUsdPerMillionTokens: z.number().finite().positive().max(10_000),
  cacheWriteUsdPerMillionTokens: z.number().finite().positive().max(10_000),
  outputUsdPerMillionTokens: z.number().finite().positive().max(10_000),
  verifiedAt: UtcTimestampSchema,
}).strict()
export const OpenAiLunaPriceQuoteSchema = PriceQuoteSchema
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
  | 'OPENAI_LUNA_SCHEMA_INVALID'

function fail(code: OpenAiLunaRequestErrorCode): never {
  throw new OpenAiLunaRequestError(code)
}

const OPENAI_STRICT_SCHEMA_KEYWORDS = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'pattern',
  'minItems',
  'maxItems',
])

function convertSchemaValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(convertSchemaValue)
  if (value === null || typeof value !== 'object') return value
  const converted: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === '$schema') continue
    if (key === 'const') {
      converted.enum = [convertSchemaValue(child)]
      continue
    }
    converted[key] = convertSchemaValue(child)
  }
  return converted
}

function assertOpenAiStrictSchema(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('OPENAI_LUNA_SCHEMA_INVALID')
  }
  const schema = value as Record<string, unknown>
  for (const key of Object.keys(schema)) {
    if (!OPENAI_STRICT_SCHEMA_KEYWORDS.has(key)) fail('OPENAI_LUNA_SCHEMA_INVALID')
  }
  if (schema.type === 'object') {
    const properties = schema.properties
    const required = schema.required
    if (
      properties === null || typeof properties !== 'object' || Array.isArray(properties) ||
      !Array.isArray(required) || schema.additionalProperties !== false
    ) {
      fail('OPENAI_LUNA_SCHEMA_INVALID')
    }
    const propertyNames = Object.keys(properties)
    if (
      required.length !== propertyNames.length ||
      required.some((name) => typeof name !== 'string' || !propertyNames.includes(name))
    ) {
      fail('OPENAI_LUNA_SCHEMA_INVALID')
    }
    for (const propertySchema of Object.values(properties)) assertOpenAiStrictSchema(propertySchema)
  }
  if (schema.items !== undefined) assertOpenAiStrictSchema(schema.items)
}

function buildModelOutputJsonSchema(): Record<string, unknown> {
  const converted = convertSchemaValue(z.toJSONSchema(ModelOutputSchema, { target: 'draft-7' }))
  assertOpenAiStrictSchema(converted)
  return converted
}

const modelOutputJsonSchema = buildModelOutputJsonSchema()

function canonicalUtc(value: string): number | null {
  return parseCanonicalUtc(value)
}

export function parseOpenAiLunaPriceQuote(priceQuote: unknown, now: string): OpenAiLunaPriceQuote {
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
    service_tier: 'default',
    store: false,
    max_output_tokens: bundle.budget.max_output_tokens,
    instructions: FIXED_INSTRUCTIONS,
    input: evidenceInput,
    text: {
      format: {
        type: 'json_schema',
        name: OPENAI_LUNA_OUTPUT_SCHEMA_NAME,
        strict: true,
        schema: modelOutputJsonSchema,
      },
    },
  } as const
  const body = JSON.stringify(bodyObject)
  const bodyBytes = Buffer.byteLength(body, 'utf8')
  if (bodyBytes > OPENAI_LUNA_MAX_INPUT_BYTES) fail('OPENAI_LUNA_INPUT_TOO_LARGE')
  return { body, inputBytes, bodyBytes }
}

function estimateUsd(bodyBytes: number, maxOutputTokens: number, price: OpenAiLunaPriceQuote): number {
  // A byte-level upper bound cannot underestimate a byte-pair token count. Use the more expensive
  // of an ordinary input or cache write so implicit prompt caching cannot bypass the ceiling.
  const maximumInputTokens = bodyBytes
  const maximumInputPrice = Math.max(
    price.inputUsdPerMillionTokens,
    price.cacheWriteUsdPerMillionTokens,
  )
  const estimate = (
    maximumInputTokens * maximumInputPrice +
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
  const price = parseOpenAiLunaPriceQuote(input.priceQuote, input.now)
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
