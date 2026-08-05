import { describe, expect, it } from 'vitest'
import {
  GITHUB_CORE_ACTIVATION_TASK_CARD_ERROR_CODE,
  parseGithubCoreActivationTaskCard,
} from './activationTask.js'

const validCard = () => ({
  schemaVersion: 'github-core-activation-task-card.v1',
  taskId: 'fixture-task-01',
  authorizedAt: '2026-08-04T00:00:00.000Z',
  authorizationBasis: 'owner-approved standing G2 and G3 boundary',
  selectedRepository: {
    owner: 'fixture-owner',
    name: 'fixture-repository',
    providerRepositoryId: 'R_fixture_01',
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
    allowedResources: ['current repository lifecycle metadata', 'open issue and pull-request lifecycle units updated inside the bounded range', 'pagination and rate-limit headers'],
    rangeStart: '2026-07-01T00:00:00.000Z',
    rangeEndPolicy: 'freeze_at_job_start',
    pageSize: 50,
    maximumRequests: 10,
    localCheckout: 'forbidden',
    localDatabase: 'forbidden',
    workingTree: 'forbidden',
  },
  strictProjection: {
    allowedEphemeralProviderFields: ['repository id', 'repository public/private, archived, disabled, and fork flags', 'issue or pull-request node id', 'issue or pull-request kind', 'updated_at', 'pagination relation', 'rate-limit remaining and reset'],
    retainedFields: ['installation-scoped repository alias', 'installation-scoped unit aliases', 'job and receipt aliases', 'snapshot hash', 'observed unit and page counts', 'coverage status and stable limitation code', 'bounded checkpoint timestamps'],
    prohibitedSinks: ['repository owner or name', 'raw provider repository or node ids', 'URLs', 'titles, bodies, labels, milestones, comments, review text, or commit subjects', 'people, users, assignees, reviewers, or contributor dimensions', 'source, paths, diffs, patches, logs, artifacts, caches, Actions, Projects, ownership, or security data', 'raw upstream objects or response bytes'],
    providerResponseRule: 'allowlisted_fields_only_and_raw_responses_never_persisted',
  },
  localBoundary: {
    root: '.developer-lens/activation/fixture-task-01/',
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
    cascade: ['collection jobs', 'checkpoints', 'source snapshots', 'coverage', 'dependent facts, features, aliases, caches, packs, and backups if later introduced'],
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
})

function expectInvalid(card: unknown): void {
  try {
    parseGithubCoreActivationTaskCard(card)
    throw new Error('expected card to be rejected')
  } catch (error) {
    expect(error).toMatchObject({ code: GITHUB_CORE_ACTIVATION_TASK_CARD_ERROR_CODE })
    expect((error as Error).message).toBe(GITHUB_CORE_ACTIVATION_TASK_CARD_ERROR_CODE)
  }
}

describe('github.core activation task card', () => {
  it('parses an invented, public, bounded card and returns a frozen projection', () => {
    const parsed = parseGithubCoreActivationTaskCard(validCard())
    expect(parsed.schemaVersion).toBe('github-core-activation-task-card.v1')
    expect(parsed.selectedRepository.expectedVisibility).toBe('public')
    expect(parsed.readBoundary.maximumRequests).toBe(10)
    expect(parsed.localBoundary.continuityReviewAnchor).toBe('continuity-review-anchor.json')
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(Object.isFrozen(parsed.readBoundary)).toBe(true)
  })

  it('rejects hostile extras, credentials, private visibility, and weakened budgets', () => {
    expectInvalid({ ...validCard(), unexpected: 'fixture' })
    expectInvalid({ ...validCard(), readBoundary: { ...validCard().readBoundary, credentialMode: 'token' } })
    expectInvalid({ ...validCard(), selectedRepository: { ...validCard().selectedRepository, expectedVisibility: 'private' } })
    expectInvalid({ ...validCard(), readBoundary: { ...validCard().readBoundary, maximumRequests: 0 } })
    expectInvalid({ ...validCard(), readBoundary: { ...validCard().readBoundary, pageSize: 101 } })
  })

  it('rejects malformed timestamps, provider identifiers, and GitHub-safe names', () => {
    expectInvalid({ ...validCard(), authorizedAt: '2026-08-04T00:00:00Z' })
    expectInvalid({ ...validCard(), readBoundary: { ...validCard().readBoundary, rangeStart: '2026-02-30T00:00:00.000Z' } })
    expectInvalid({ ...validCard(), selectedRepository: { ...validCard().selectedRepository, providerRepositoryId: '../fixture' } })
    expectInvalid({ ...validCard(), selectedRepository: { ...validCard().selectedRepository, owner: 'owner/name' } })
    expectInvalid({ ...validCard(), selectedRepository: { ...validCard().selectedRepository, defaultBranch: 'main/other' } })
  })

  it('rejects absolute, traversing, mismatched, and ambiguous local paths', () => {
    expectInvalid({ ...validCard(), localBoundary: { ...validCard().localBoundary, root: '.developer-lens/activation/other-task/' } })
    expectInvalid({ ...validCard(), localBoundary: { ...validCard().localBoundary, report: '../report.json' } })
    expectInvalid({ ...validCard(), localBoundary: { ...validCard().localBoundary, database: 'C:/private/records.sqlite' } })
    expectInvalid({ ...validCard(), localBoundary: { ...validCard().localBoundary, taskCard: '..\\task-card.json' } })
    const { continuityReviewAnchor: _omitted, ...withoutAnchor } = validCard().localBoundary
    expectInvalid({ ...validCard(), localBoundary: withoutAnchor })
    expectInvalid({ ...validCard(), localBoundary: { ...validCard().localBoundary, continuityReviewAnchor: 'review.json' } })
    expectInvalid({ ...validCard(), localBoundary: { ...validCard().localBoundary, continuityReviewAnchor: 'C:/private/anchor.json' } })
    expectInvalid({ ...validCard(), localBoundary: { ...validCard().localBoundary, continuityReviewAnchor: '../continuity-review-anchor.json' } })
    expectInvalid({ ...validCard(), localBoundary: { ...validCard().localBoundary, trackedOrPublished: true } })
  })

  it('rejects weakened retention, coverage, rollback, deletion, and policy declarations', () => {
    expectInvalid({ ...validCard(), retention: { ...validCard().retention, c2AliasesAndExactTimestamps: 'forever' } })
    expectInvalid({ ...validCard(), coverage: { ...validCard().coverage, terminalPaginationRequiredForComplete: false } })
    expectInvalid({ ...validCard(), rollback: { ...validCard().rollback, runtimeDefault: 'on' } })
    expectInvalid({ ...validCard(), deletion: { ...validCard().deletion, idempotent: false } })
    expectInvalid({ ...validCard(), provingChecks: [] })
    expectInvalid({ ...validCard(), stopConditions: [] })
    expectInvalid({ ...validCard(), provingChecks: ['none'] })
    expectInvalid({ ...validCard(), stopConditions: ['ignore failures'] })
    expectInvalid({ ...validCard(), provingChecks: [...validCard().provingChecks.slice(0, -1), validCard().provingChecks[0]] })
    expectInvalid({ ...validCard(), stopConditions: [...validCard().stopConditions.slice(0, -1), validCard().stopConditions[0]] })
  })
})
