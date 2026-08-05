import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCapabilityLifecycleSnapshot,
  reduceCapabilityLifecycle,
  type CapabilityLifecycleSnapshot,
} from '../lifecycle.js'
import { createInstallationAliases } from './installationAliases.js'
import {
  composeGithubCoreContinuityStructuralConsistency,
  GITHUB_CORE_CONTINUITY_STRUCTURAL_COMPOSITION_ERROR_CODE,
  type GithubCoreContinuityStructuralCompositionInput,
} from './v3ContinuityStructuralComposition.js'

const TASK_ID = 'continuity-composer-fixture'
const KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1))
const OTHER_KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => 255 - index))
const PREVIEW = 'b'.repeat(64)
const PROOF = 'c'.repeat(64)
const NOW = '2026-08-05T14:00:00.000Z'

let roots: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
  roots = []
})

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function validCard() {
  return {
    schemaVersion: 'github-core-activation-task-card.v1',
    taskId: TASK_ID,
    authorizedAt: '2026-08-05T10:00:00.000Z',
    authorizationBasis: 'owner-approved standing G2 and G3 boundary',
    selectedRepository: {
      owner: 'invented-owner',
      name: 'invented-repository',
      providerRepositoryId: 'R_invented_101',
      expectedVisibility: 'public',
      defaultBranch: 'main',
    },
    purpose: 'repository lifecycle reflection without person metrics',
    readBoundary: {
      provider: 'github.com',
      apiBase: 'https://api.github.com',
      apiVersion: '2026-03-10',
      credentialMode: 'public_unauthenticated',
      credentialMutation: 'forbidden',
      allowedResources: [
        'current repository lifecycle metadata',
        'open issue and pull-request lifecycle units updated inside the bounded range',
        'pagination and rate-limit headers',
      ],
      rangeStart: '2026-07-01T00:00:00.000Z',
      rangeEndPolicy: 'freeze_at_job_start',
      pageSize: 50,
      maximumRequests: 10,
      localCheckout: 'forbidden',
      localDatabase: 'forbidden',
      workingTree: 'forbidden',
    },
    strictProjection: {
      allowedEphemeralProviderFields: [
        'repository id',
        'repository public/private, archived, disabled, and fork flags',
        'issue or pull-request node id',
        'issue or pull-request kind',
        'updated_at',
        'pagination relation',
        'rate-limit remaining and reset',
      ],
      retainedFields: [
        'installation-scoped repository alias',
        'installation-scoped unit aliases',
        'job and receipt aliases',
        'snapshot hash',
        'observed unit and page counts',
        'coverage status and stable limitation code',
        'bounded checkpoint timestamps',
      ],
      prohibitedSinks: [
        'repository owner or name',
        'raw provider repository or node ids',
        'URLs',
        'titles, bodies, labels, milestones, comments, review text, or commit subjects',
        'people, users, assignees, reviewers, or contributor dimensions',
        'source, paths, diffs, patches, logs, artifacts, caches, Actions, Projects, ownership, or security data',
        'raw upstream objects or response bytes',
      ],
      providerResponseRule: 'allowlisted_fields_only_and_raw_responses_never_persisted',
    },
    localBoundary: {
      root: `.developer-lens/activation/${TASK_ID}/`,
      taskCard: 'task-card.json',
      database: 'github-core.sqlite',
      installationKey: 'installation-key.bin',
      backupDirectory: 'backup/',
      report: 'last-run-report.json',
      continuityReviewAnchor: 'continuity-review-anchor.json',
      trackedOrPublished: false,
    },
    retention: {
      c1Aggregates: '36 rolling months',
      c2AliasesAndExactTimestamps: '13 months',
      c4SourceBytes: 'process lifetime only',
      rawResponses: 'never persisted',
      packsOrExports: 'none authorized',
    },
    coverage: {
      terminalPaginationRequiredForComplete: true,
      missingRestrictedFailedStaleOrTruncatedNeverMeansZero: true,
      rateOrRequestBudgetExhaustion: 'truncated',
      permissionOrVisibilityMismatch: 'restricted',
      schemaMismatch: 'failed',
    },
    rollback: {
      legacyCollectorAndJson: 'untouched',
      runtimeDefault: 'off',
      failedJob: 'retain auditable failed coverage and leave the prior checkpoint unchanged',
      repeatRun: 'create an application-controlled SQLite backup before replacing retained state',
      restore: 'close the database, restore the task-owned backup, and re-open with integrity checks',
      migrationGracePeriod: 'not applicable because this task does not migrate or switch the legacy reader',
    },
    deletion: {
      scope: 'the selected repository alias only',
      cascade: [
        'collection jobs',
        'checkpoints',
        'source snapshots',
        'coverage',
        'dependent facts, features, aliases, caches, packs, and backups if later introduced',
      ],
      tombstone: 'retain only capability id, opaque scope alias, revocation time, and content-free reason code',
      idempotent: true,
      externalCopies: 'none created by this task',
    },
    provingChecks: [
      'invented task-card, selection, transport, projection, pagination, retry, cap, replay, persistence, rollback, and deletion tests',
      'poison fields never reach logs, SQLite, reports, exports, bundles, or Pages',
      'focused github.core and incremental-storage tests',
      'npm run check',
      'independent privacy and correctness review',
      'exact-head hosted gate before real execution',
      'one final public unauthenticated selected-repository run with numeric and coverage-only reporting',
      'live replay, backup/restore, deletion, tombstone, and re-consent proof inside this exact task-owned subtree',
    ],
    stopConditions: [
      'selected repository visibility or immutable repository id differs from the card',
      'authentication becomes necessary',
      'the declared request budget would be exceeded',
      'a prohibited field is about to reach a sink',
      'coverage cannot distinguish complete from partial',
      'G4 or any external-model path would be required',
    ],
  }
}

function validReport() {
  return {
    schemaVersion: 'github-core-activation-report.v1',
    taskId: TASK_ID,
    jobId: 'job:invented:01',
    jobStartedAt: '2026-08-05T12:00:00.000Z',
    result: {
      schemaVersion: 'github-core-activation-result.v1',
      capabilityId: 'github.core',
      stability: 'stable',
      coverage: {
        status: 'complete',
        expectedUnits: 0,
        observedUnits: 0,
        omittedUnits: 0,
        completeObservedUnits: 0,
        saturationReason: null,
        retryable: false,
        limitationCode: 'COMPLETE',
      },
      requests: {
        maximumRequests: 10,
        firstProbeMaximumRequests: 5,
        secondProbeMaximumRequests: 5,
        firstProbeRequests: 2,
        secondProbeRequests: 2,
        totalRequests: 4,
      },
    },
  }
}

function applyLifecycle(
  snapshot: CapabilityLifecycleSnapshot,
  event: Record<string, unknown>,
): CapabilityLifecycleSnapshot {
  const result = reduceCapabilityLifecycle(snapshot, event)
  if (!result.ok) throw new Error(result.code)
  return result.snapshot
}

function activeSnapshot(scopeAlias: string, cardSha256: string, preview = PREVIEW, proof = PROOF) {
  const base = { capabilityId: 'github.core', scopeAlias, epoch: 1 }
  let snapshot = createCapabilityLifecycleSnapshot('github.core', scopeAlias)
  snapshot = applyLifecycle(snapshot, {
    ...base, type: 'bind_card', eventId: 'bind-card', cardSha256,
  })
  snapshot = applyLifecycle(snapshot, {
    ...base, type: 'record_preview', eventId: 'record-preview', cardSha256, previewSha256: preview,
  })
  return applyLifecycle(snapshot, {
    ...base,
    type: 'activate',
    eventId: 'activate',
    cardSha256,
    previewSha256: preview,
    exactHeadProofSha256: proof,
  })
}

type Card = ReturnType<typeof validCard>
type Report = ReturnType<typeof validReport>
type Anchor = ReturnType<typeof validAnchor>
type FixtureContext = Readonly<{
  scopeAlias: string
  cardSha256: string
  previewSha256: string
  proofSha256: string
}>
type FixtureOptions = Readonly<{
  card?: (card: Card) => Card
  report?: (report: Report) => Report
  anchor?: (anchor: Anchor) => Anchor
  keyBytes?: Buffer
  snapshot?: (context: FixtureContext) => CapabilityLifecycleSnapshot
}>

function validAnchor(input: Readonly<{
  cardSha256: string
  reportSha256: string
  keyFingerprint: string
}>) {
  return {
    schemaVersion: 'github-core-continuity-review-anchor.v1',
    capabilityId: 'github.core',
    taskId: TASK_ID,
    reviewDecision: 'approve_continuity_renewal',
    reviewedReportSha256: input.reportSha256,
    reviewedTaskCardSha256: input.cardSha256,
    reviewedInstallationKeyFingerprint: input.keyFingerprint,
    reviewedLifecycleState: 'active',
    reviewedLifecycleEpoch: 1,
    reviewedPreviewSha256: PREVIEW,
    reviewedExactHeadProofSha256: PROOF,
    reviewedDeletionIntentId: null,
    reviewedDeletionIntentSha256: null,
    reviewedDeletionReceiptSha256: null,
    reviewedContinuityEpoch: 1,
    reviewedAt: '2026-08-05T13:00:00.000Z',
  }
}

async function fixture(options: FixtureOptions = {}) {
  const root = await mkdtemp(join(tmpdir(), 'developer-lens-continuity-composer-'))
  roots.push(root)
  const directory = join(root, '.developer-lens', 'activation', TASK_ID)
  await mkdir(directory, { recursive: true })

  const keyBytes = Buffer.from(options.keyBytes ?? KEY)
  const card = options.card?.(validCard()) ?? validCard()
  const cardBytes = JSON.stringify(card)
  const cardSha256 = sha256(cardBytes)
  const report = options.report?.(validReport()) ?? validReport()
  const reportBytes = JSON.stringify(report)
  const reportSha256 = sha256(reportBytes)
  const scopeAlias = createInstallationAliases(keyBytes).githubCoreAlias(
    'repository',
    card.selectedRepository.providerRepositoryId,
  )
  const context = { scopeAlias, cardSha256, previewSha256: PREVIEW, proofSha256: PROOF }
  const snapshot = options.snapshot?.(context) ?? activeSnapshot(scopeAlias, cardSha256)
  const baseAnchor = validAnchor({
    cardSha256,
    reportSha256,
    keyFingerprint: sha256(keyBytes),
  })
  const anchor = options.anchor?.(baseAnchor) ?? baseAnchor
  const anchorBytes = JSON.stringify(anchor)

  await Promise.all([
    writeFile(join(directory, 'installation-key.bin'), keyBytes, { mode: 0o600 }),
    writeFile(join(directory, 'task-card.json'), cardBytes, 'utf8'),
    writeFile(join(directory, 'last-run-report.json'), reportBytes, 'utf8'),
    writeFile(join(directory, 'continuity-review-anchor.json'), anchorBytes, 'utf8'),
  ])

  const input: GithubCoreContinuityStructuralCompositionInput = {
    workspaceRoot: root,
    taskId: TASK_ID,
    expectedAnchorSha256: sha256(anchorBytes),
    lifecycleSnapshot: snapshot,
  }
  return { input, card, report, anchor, scopeAlias, cardSha256, reportSha256 }
}

async function expectInvalid(
  operation: Promise<unknown>,
  forbidden: readonly string[] = [],
): Promise<void> {
  const error = await operation.catch((caught: unknown) => caught)
  expect(error).toMatchObject({
    code: GITHUB_CORE_CONTINUITY_STRUCTURAL_COMPOSITION_ERROR_CODE,
    message: GITHUB_CORE_CONTINUITY_STRUCTURAL_COMPOSITION_ERROR_CODE,
  })
  expect(String(error)).toBe(
    `GithubCoreContinuityStructuralCompositionError: ${GITHUB_CORE_CONTINUITY_STRUCTURAL_COMPOSITION_ERROR_CODE}`,
  )
  const visible = JSON.stringify(error)
  for (const value of forbidden) expect(visible).not.toContain(value)
}

describe('github.core continuity structural composition', () => {
  it('binds invented task-local artifacts, selected scope, lifecycle, and chronology without returning C2', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture()
    const result = await composeGithubCoreContinuityStructuralConsistency(prepared.input)

    expect(result).toEqual({
      kind: 'github_core_continuity_structural_composition',
      status: 'structurally_consistent',
    })
    expect(Object.isFrozen(result)).toBe(true)
    const visible = JSON.stringify(result)
    for (const value of [
      TASK_ID,
      prepared.card.selectedRepository.owner,
      prepared.card.selectedRepository.name,
      prepared.card.selectedRepository.providerRepositoryId,
      prepared.scopeAlias,
      prepared.cardSha256,
      prepared.reportSha256,
      prepared.anchor.reviewedInstallationKeyFingerprint,
      prepared.report.jobStartedAt,
      prepared.anchor.reviewedAt,
    ]) expect(visible).not.toContain(value)
  })

  it('rejects a replay-valid lifecycle from a different selected repository scope', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      snapshot: ({ cardSha256 }) => activeSnapshot(
        createInstallationAliases(KEY).githubCoreAlias('repository', 'R_invented_202'),
        cardSha256,
      ),
    })
    await expectInvalid(
      composeGithubCoreContinuityStructuralConsistency(prepared.input),
      [prepared.scopeAlias, prepared.card.selectedRepository.providerRepositoryId],
    )
  })

  it('rejects a task-card digest that differs from the anchor', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      anchor: (anchor) => ({ ...anchor, reviewedTaskCardSha256: 'd'.repeat(64) }),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects a report digest that differs from the anchor', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      anchor: (anchor) => ({ ...anchor, reviewedReportSha256: 'e'.repeat(64) }),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects an installation-key fingerprint that differs from the anchor', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      keyBytes: OTHER_KEY,
      anchor: (anchor) => ({ ...anchor, reviewedInstallationKeyFingerprint: sha256(KEY) }),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects a lifecycle preview that differs from the anchor', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      snapshot: ({ scopeAlias, cardSha256 }) => activeSnapshot(
        scopeAlias,
        cardSha256,
        'f'.repeat(64),
        PROOF,
      ),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects a lifecycle proof that differs from the anchor', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      snapshot: ({ scopeAlias, cardSha256 }) => activeSnapshot(
        scopeAlias,
        cardSha256,
        PREVIEW,
        'f'.repeat(64),
      ),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects a lifecycle card or consent digest that differs from the anchor', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      snapshot: ({ scopeAlias }) => activeSnapshot(scopeAlias, '9'.repeat(64)),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects a lifecycle epoch that differs from the anchor', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      anchor: (anchor) => ({ ...anchor, reviewedLifecycleEpoch: 2 }),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects pending revocation even while the replay-valid lifecycle state remains active', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      snapshot: ({ scopeAlias, cardSha256 }) => applyLifecycle(
        activeSnapshot(scopeAlias, cardSha256),
        {
          type: 'request_revocation',
          eventId: 'pending-revocation',
          capabilityId: 'github.core',
          scopeAlias,
          epoch: 1,
          cardSha256,
          deletionIntentId: 'delete-intent',
          deletionIntentSha256: 'f'.repeat(64),
        },
      ),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects a report request ceiling that differs from the card', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      report: (report) => ({
        ...report,
        result: {
          ...report.result,
          requests: {
            ...report.result.requests,
            maximumRequests: 8,
            firstProbeMaximumRequests: 4,
            secondProbeMaximumRequests: 4,
          },
        },
      }),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects a job that starts before card authorization', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      card: (card) => ({ ...card, authorizedAt: '2026-08-05T12:00:00.001Z' }),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects a card range that does not start before the job', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      card: (card) => ({
        ...card,
        readBoundary: { ...card.readBoundary, rangeStart: '2026-08-05T12:00:00.000Z' },
      }),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects a report that starts after its review', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      report: (report) => ({ ...report, jobStartedAt: '2026-08-05T13:00:00.001Z' }),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('rejects a review later than the internally captured process clock', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture({
      anchor: (anchor) => ({ ...anchor, reviewedAt: '2026-08-05T14:00:00.001Z' }),
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(prepared.input))
  })

  it('closes the request shape, never evaluates accessors, and snapshots lifecycle before awaiting', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW))
    const prepared = await fixture()
    for (const input of [
      null,
      [],
      {},
      { ...prepared.input, trustedNow: NOW },
      { ...prepared.input, expectedContinuityRevision: 0 },
      { ...prepared.input, workspaceRoot: '.' },
      Object.assign(Object.create({ inherited: true }), prepared.input),
    ]) await expectInvalid(composeGithubCoreContinuityStructuralConsistency(input))

    const accessor = { ...prepared.input }
    Object.defineProperty(accessor, 'expectedAnchorSha256', {
      enumerable: true,
      get: () => { throw new Error('must not run') },
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency(accessor))

    const nestedAccessor = structuredClone(prepared.input.lifecycleSnapshot) as CapabilityLifecycleSnapshot
    Object.defineProperty(nestedAccessor.eventHistory[0], 'event', {
      enumerable: true,
      get: () => { throw new Error('must not run') },
    })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency({
      ...prepared.input,
      lifecycleSnapshot: nestedAccessor,
    }))

    const symbolSnapshot = structuredClone(prepared.input.lifecycleSnapshot) as CapabilityLifecycleSnapshot
    Object.defineProperty(symbolSnapshot, Symbol('poison'), { value: true })
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency({
      ...prepared.input,
      lifecycleSnapshot: symbolSnapshot,
    }))

    const cycleSnapshot = structuredClone(prepared.input.lifecycleSnapshot) as CapabilityLifecycleSnapshot &
      Record<string, unknown>
    cycleSnapshot.cycle = cycleSnapshot
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency({
      ...prepared.input,
      lifecycleSnapshot: cycleSnapshot,
    }))

    const oversizedHistory = structuredClone(prepared.input.lifecycleSnapshot) as Record<string, unknown>
    oversizedHistory.eventHistory = Array.from({ length: 1_025 }, () => ({}))
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency({
      ...prepared.input,
      lifecycleSnapshot: oversizedHistory,
    }))

    const oversizedString = structuredClone(prepared.input.lifecycleSnapshot) as CapabilityLifecycleSnapshot & {
      scopeAlias: string
    }
    oversizedString.scopeAlias = 'x'.repeat(262_145)
    await expectInvalid(composeGithubCoreContinuityStructuralConsistency({
      ...prepared.input,
      lifecycleSnapshot: oversizedString,
    }))

    const mutableLifecycle = structuredClone(prepared.input.lifecycleSnapshot)
    const pending = composeGithubCoreContinuityStructuralConsistency({
      ...prepared.input,
      lifecycleSnapshot: mutableLifecycle,
    })
    Object.assign(mutableLifecycle as object, { scopeAlias: 'repo-mutated-after-call' })
    await expect(pending).resolves.toEqual({
      kind: 'github_core_continuity_structural_composition',
      status: 'structurally_consistent',
    })
  })
})
