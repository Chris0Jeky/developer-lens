import { createHash } from 'node:crypto'
import {
  buildOpenAiLunaRequestPreview,
  type OpenAiLunaRequestPreview,
} from './openaiResponses.js'
import {
  parseOpenAiLunaActivationTaskCard,
  type OpenAiLunaActivationTaskCard,
} from './openaiActivationTask.js'

export const OPENAI_LUNA_PAYLOAD_PREVIEW_ERROR_CODE =
  'OPENAI_LUNA_PAYLOAD_PREVIEW_INVALID' as const

export class OpenAiLunaPayloadPreviewError extends Error {
  readonly code = OPENAI_LUNA_PAYLOAD_PREVIEW_ERROR_CODE

  constructor() {
    super(OPENAI_LUNA_PAYLOAD_PREVIEW_ERROR_CODE)
    this.name = 'OpenAiLunaPayloadPreviewError'
  }
}

const OPENAI_LUNA_BOUND_PAYLOAD_BRAND: unique symbol = Symbol('OpenAiLunaBoundPayloadPreview')
const genuineBoundPayloads = new WeakSet<object>()

export type OpenAiLunaBoundPayloadPreview = Readonly<{
  card: OpenAiLunaActivationTaskCard
  preview: OpenAiLunaRequestPreview
  readonly [OPENAI_LUNA_BOUND_PAYLOAD_BRAND]: true
}>

function invalidPreview(): never {
  throw new OpenAiLunaPayloadPreviewError()
}

function sha256Utf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child)
  }
  return value
}

function isDeeplyFrozen(value: unknown, visited = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== 'object') return true
  if (visited.has(value)) return true
  if (!Object.isFrozen(value)) return false
  visited.add(value)
  return Reflect.ownKeys(value).every((key) => isDeeplyFrozen(Reflect.get(value, key), visited))
}

function sameRequest(
  left: OpenAiLunaRequestPreview['request'],
  right: OpenAiLunaRequestPreview['request'],
): boolean {
  return left.method === right.method &&
    left.url === right.url &&
    left.body === right.body &&
    left.headers.Accept === right.headers.Accept &&
    left.headers['Content-Type'] === right.headers['Content-Type'] &&
    Reflect.ownKeys(left).length === Reflect.ownKeys(right).length &&
    Reflect.ownKeys(left.headers).length === Reflect.ownKeys(right.headers).length
}

/** Bind an untrusted reviewed card to one exact, credentialless C1 request preview. */
export function bindOpenAiLunaPayloadPreview(input: {
  card: unknown
  bundle: unknown
  now: string
}): OpenAiLunaBoundPayloadPreview {
  try {
    const card = parseOpenAiLunaActivationTaskCard(input.card, input.now)
    const preview = buildOpenAiLunaRequestPreview({
      bundle: input.bundle,
      priceQuote: card.priceQuote,
      now: input.now,
    })
    if (
      preview.bundleId !== card.payload.bundleId ||
      sha256Utf8(preview.bundleJson) !== card.payload.bundleSha256 ||
      sha256Utf8(preview.request.body) !== card.payload.requestBodySha256
    ) invalidPreview()
    const bound = { card, preview } as OpenAiLunaBoundPayloadPreview
    Object.defineProperty(bound, OPENAI_LUNA_BOUND_PAYLOAD_BRAND, {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    })
    freezeDeep(bound)
    genuineBoundPayloads.add(bound)
    return bound
  } catch (error) {
    if (error instanceof OpenAiLunaPayloadPreviewError) throw error
    invalidPreview()
  }
}

/** @internal Revalidate one genuine immutable binding immediately before credential access. */
export function revalidateOpenAiLunaBoundPayloadPreview(
  input: unknown,
  now: string,
): OpenAiLunaBoundPayloadPreview {
  try {
    if (
      input === null ||
      typeof input !== 'object' ||
      !genuineBoundPayloads.has(input) ||
      !isDeeplyFrozen(input)
    ) invalidPreview()
    const brand = Object.getOwnPropertyDescriptor(input, OPENAI_LUNA_BOUND_PAYLOAD_BRAND)
    if (
      brand?.value !== true ||
      brand.enumerable !== false ||
      brand.writable !== false ||
      brand.configurable !== false
    ) invalidPreview()

    const bound = input as OpenAiLunaBoundPayloadPreview
    const card = parseOpenAiLunaActivationTaskCard(bound.card, now)
    const bundle = JSON.parse(bound.preview.bundleJson) as unknown
    const rebuilt = buildOpenAiLunaRequestPreview({ bundle, priceQuote: card.priceQuote, now })
    if (
      bound.preview.bundleId !== card.payload.bundleId ||
      sha256Utf8(bound.preview.bundleJson) !== card.payload.bundleSha256 ||
      sha256Utf8(bound.preview.request.body) !== card.payload.requestBodySha256 ||
      rebuilt.bundleId !== bound.preview.bundleId ||
      rebuilt.bundleJson !== bound.preview.bundleJson ||
      !sameRequest(rebuilt.request, bound.preview.request)
    ) invalidPreview()
    return bound
  } catch (error) {
    if (error instanceof OpenAiLunaPayloadPreviewError) throw error
    invalidPreview()
  }
}
