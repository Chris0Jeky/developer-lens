import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  OPENAI_LUNA_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE,
  OpenAiLunaActivationTaskCardLoadError,
  loadOpenAiLunaActivationTaskCard,
} from './openaiActivationTaskLoader.js'

const taskId = 'fixture-luna-card'
const now = '2026-08-04T12:00:00.000Z'
const digest = 'a'.repeat(64)
const bundleId = `req_${'b'.repeat(32)}`
let roots: string[] = []

const baseCard = (cardTaskId = taskId) => ({
  schemaVersion: 'openai-luna-activation-card.v1',
  taskId: cardTaskId,
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
    requestLimit: 1,
    retryLimit: 0,
    maxInputBytes: 16_000,
    maxOutputTokens: 2_000,
    maxEstimatedUsd: 0.01,
    timeoutMs: 30_000,
  },
  priceQuote: {
    model: 'gpt-5.6-luna',
    serviceTier: 'default',
    contextBand: 'short',
    unit: 'USD_PER_MILLION_TOKENS',
    inputUsdPerMillionTokens: 0.2,
    cacheWriteUsdPerMillionTokens: 0.25,
    outputUsdPerMillionTokens: 1.2,
    verifiedAt: '2026-08-04T00:00:00Z',
  },
  payload: { bundleId, bundleSha256: digest, requestBodySha256: digest },
  pricingEvidenceStatus: 'reconciled',
  officialEvidence: [
    { kind: 'model', url: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
    { kind: 'pricing', url: 'https://developers.openai.com/api/docs/pricing', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
    { kind: 'data_controls', url: 'https://developers.openai.com/api/docs/guides/your-data', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
    { kind: 'structured_outputs', url: 'https://developers.openai.com/api/docs/guides/structured-outputs', retrievedAt: '2026-08-04T00:00:00.000Z', sha256: digest },
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
  review: { status: 'reviewed', preview: 'exact_request_body_bound', reviewedAt: '2026-08-04T11:00:00.000Z' },
})

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })))
  roots = []
})

async function fixtureRoot(card: unknown = baseCard()): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'developer-lens-openai-loader-'))
  roots.push(root)
  const cardDirectory = join(root, '.developer-lens', 'activation', taskId)
  await mkdir(cardDirectory, { recursive: true })
  await writeFile(join(cardDirectory, 'task-card.json'), JSON.stringify(card), 'utf8')
  return root
}

async function cardPath(root: string): Promise<string> {
  return join(root, '.developer-lens', 'activation', taskId, 'task-card.json')
}

async function expectInvalid(input: unknown, at = now): Promise<void> {
  await expect(loadOpenAiLunaActivationTaskCard(input as never, at)).rejects.toMatchObject({
    code: OPENAI_LUNA_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE,
    message: OPENAI_LUNA_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE,
  })
  await expect(loadOpenAiLunaActivationTaskCard(input as never, at)).rejects.toBeInstanceOf(
    OpenAiLunaActivationTaskCardLoadError,
  )
}

describe('OpenAI/Luna activation task card loader', () => {
  it('loads the exact invented card and deeply freezes the result', async () => {
    const root = await fixtureRoot()
    const card = await loadOpenAiLunaActivationTaskCard({ workspaceRoot: root, taskId }, now)
    expect(card.taskId).toBe(taskId)
    expect(Object.isFrozen(card)).toBe(true)
    expect(Object.isFrozen(card.limits)).toBe(true)
    expect(Object.isFrozen(card.officialEvidence)).toBe(true)
    expect(Object.isFrozen(card.officialEvidence[0])).toBe(true)
  })

  it('requires the parsed card task id to match the snapshotted path task id', async () => {
    const root = await fixtureRoot(baseCard('other-luna-card'))
    await expectInvalid({ workspaceRoot: root, taskId })
  })

  it('maps stale, malformed, and schema-invalid cards to one stable error', async () => {
    const root = await fixtureRoot({ ...baseCard(), priceQuote: { ...baseCard().priceQuote, verifiedAt: '2026-08-02T11:59:59Z' } })
    await expectInvalid({ workspaceRoot: root, taskId })

    const path = await cardPath(root)
    await writeFile(path, '{ malformed fixture JSON', 'utf8')
    await expectInvalid({ workspaceRoot: root, taskId })
    await writeFile(path, JSON.stringify({ ...baseCard(), secretFixture: 'must-not-leak' }), 'utf8')
    await expectInvalid({ workspaceRoot: root, taskId })
  })

  it('snapshots closed data properties before awaiting and rejects accessors or path options', async () => {
    const root = await fixtureRoot()
    const input = { workspaceRoot: root, taskId }
    const pending = loadOpenAiLunaActivationTaskCard(input, now)
    input.taskId = '../outside'
    await expect(pending).resolves.toMatchObject({ taskId })

    let getterCalled = false
    const accessorInput = {} as Record<string, unknown>
    Object.defineProperty(accessorInput, 'workspaceRoot', {
      get: () => { getterCalled = true; throw new Error('getter must not run') },
      enumerable: true,
    })
    Object.defineProperty(accessorInput, 'taskId', { value: taskId, enumerable: true })
    await expectInvalid(accessorInput)
    expect(getterCalled).toBe(false)
    await expectInvalid({ workspaceRoot: root, taskId, cardPath: 'arbitrary.json' })
  })

  it('rejects malformed, duplicate-key, invalid-UTF-8, and oversized cards', async () => {
    const root = await fixtureRoot()
    const path = await cardPath(root)
    const serialized = JSON.stringify(baseCard())

    await writeFile(path, serialized.replace('{', '{"taskId":"fixture-luna-card",'), 'utf8')
    await expectInvalid({ workspaceRoot: root, taskId })
    await writeFile(path, serialized.replace('{"schemaVersion"', '{"task\\u0049d":"fixture-luna-card","schemaVersion"'), 'utf8')
    await expectInvalid({ workspaceRoot: root, taskId })
    await writeFile(path, Buffer.from([0xc3, 0x28]))
    await expectInvalid({ workspaceRoot: root, taskId })
    await writeFile(path, Buffer.alloc(64 * 1024 + 1, 0x20))
    await expectInvalid({ workspaceRoot: root, taskId })
  })

  it('rejects traversal and symlink escapes before reading outside content', async () => {
    const root = await fixtureRoot()
    await expectInvalid({ workspaceRoot: root, taskId: '../outside' })
    await expectInvalid({ workspaceRoot: root, taskId: 'C:\\outside' })
    await expectInvalid({ workspaceRoot: root, taskId: `${taskId}/alternate` })
    await expectInvalid({ workspaceRoot: '.', taskId })

    const outside = await mkdtemp(join(tmpdir(), 'developer-lens-openai-loader-outside-'))
    roots.push(outside)
    await mkdir(join(root, '.developer-lens', 'activation'), { recursive: true })
    await mkdir(join(outside, taskId), { recursive: true })
    await writeFile(join(outside, taskId, 'task-card.json'), JSON.stringify(baseCard()), 'utf8')
    await rm(join(root, '.developer-lens', 'activation', taskId), { recursive: true })
    try {
      await symlink(join(outside, taskId), join(root, '.developer-lens', 'activation', taskId), 'junction')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'EACCES') return
      throw error
    }
    await expectInvalid({ workspaceRoot: root, taskId })
    await expect(readFile(join(outside, taskId, 'task-card.json'), 'utf8')).resolves.toContain('fixture-luna-card')
  })
})
