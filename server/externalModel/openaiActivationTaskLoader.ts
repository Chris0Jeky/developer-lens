import {
  loadActivationTaskCard,
  type ActivationTaskCardLoadInput,
} from '../activationTaskCardLoader.js'
import {
  parseOpenAiLunaActivationTaskCard,
  type OpenAiLunaActivationTaskCard,
} from './openaiActivationTask.js'

export const OPENAI_LUNA_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE =
  'INVALID_OPENAI_LUNA_ACTIVATION_TASK_CARD_LOAD' as const

export class OpenAiLunaActivationTaskCardLoadError extends Error {
  readonly code = OPENAI_LUNA_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE

  constructor() {
    super(OPENAI_LUNA_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE)
    this.name = 'OpenAiLunaActivationTaskCardLoadError'
  }
}

export type OpenAiLunaActivationTaskCardLoadInput = ActivationTaskCardLoadInput

/** Load and validate the one confined, reviewed OpenAI/Luna activation card. */
export async function loadOpenAiLunaActivationTaskCard(
  input: OpenAiLunaActivationTaskCardLoadInput,
  now: string,
): Promise<OpenAiLunaActivationTaskCard> {
  try {
    const loaded = await loadActivationTaskCard(input)
    const card = parseOpenAiLunaActivationTaskCard(loaded.parsed, now)
    if (card.taskId !== loaded.taskId) throw new Error('task binding')
    return card
  } catch (error) {
    if (error instanceof OpenAiLunaActivationTaskCardLoadError) throw error
    throw new OpenAiLunaActivationTaskCardLoadError()
  }
}
