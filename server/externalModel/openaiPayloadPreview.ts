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

export type OpenAiLunaBoundPayloadPreview = Readonly<{
  card: OpenAiLunaActivationTaskCard
  preview: OpenAiLunaRequestPreview
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
    const bound: OpenAiLunaBoundPayloadPreview = { card, preview }
    return freezeDeep(bound)
  } catch (error) {
    if (error instanceof OpenAiLunaPayloadPreviewError) throw error
    invalidPreview()
  }
}
