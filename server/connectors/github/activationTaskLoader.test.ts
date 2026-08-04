import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE,
  loadGithubCoreActivationTaskCard,
} from './activationTaskLoader.js'

const taskId = 'fixture-loader-01'

const validCard = () => ({
  schemaVersion: 'github-core-activation-task-card.v1',
  taskId,
  authorizedAt: '2026-08-04T00:00:00.000Z',
  authorizationBasis: 'owner-approved standing G2 and G3 boundary',
  selectedRepository: {
    owner: 'fixture-owner', name: 'fixture-repository', providerRepositoryId: 'R_fixture_01',
    expectedVisibility: 'public', defaultBranch: 'main',
  },
  purpose: 'repository lifecycle reflection without person metrics',
  readBoundary: {
    provider: 'github.com', apiBase: 'https://api.github.com', apiVersion: '2026-03-10',
    credentialMode: 'public_unauthenticated', credentialMutation: 'forbidden',
    allowedResources: [
      'current repository lifecycle metadata',
      'open issue and pull-request lifecycle units updated inside the bounded range',
      'pagination and rate-limit headers',
    ],
    rangeStart: '2026-07-01T00:00:00.000Z', rangeEndPolicy: 'freeze_at_job_start', pageSize: 50,
    maximumRequests: 10, localCheckout: 'forbidden', localDatabase: 'forbidden', workingTree: 'forbidden',
  },
  strictProjection: {
    allowedEphemeralProviderFields: [
      'repository id', 'repository public/private, archived, disabled, and fork flags',
      'issue or pull-request node id', 'issue or pull-request kind', 'updated_at',
      'pagination relation', 'rate-limit remaining and reset',
    ],
    retainedFields: [
      'installation-scoped repository alias', 'installation-scoped unit aliases', 'job and receipt aliases',
      'snapshot hash', 'observed unit and page counts', 'coverage status and stable limitation code',
      'bounded checkpoint timestamps',
    ],
    prohibitedSinks: [
      'repository owner or name', 'raw provider repository or node ids', 'URLs',
      'titles, bodies, labels, milestones, comments, review text, or commit subjects',
      'people, users, assignees, reviewers, or contributor dimensions',
      'source, paths, diffs, patches, logs, artifacts, caches, Actions, Projects, ownership, or security data',
      'raw upstream objects or response bytes',
    ],
    providerResponseRule: 'allowlisted_fields_only_and_raw_responses_never_persisted',
  },
  localBoundary: {
    root: `.developer-lens/activation/${taskId}/`, taskCard: 'task-card.json', database: 'github-core.sqlite',
    installationKey: 'installation-key.bin', backupDirectory: 'backup/', report: 'last-run-report.json',
    trackedOrPublished: false,
  },
  retention: {
    c1Aggregates: '36 rolling months', c2AliasesAndExactTimestamps: '13 months',
    c4SourceBytes: 'process lifetime only', rawResponses: 'never persisted', packsOrExports: 'none authorized',
  },
  coverage: {
    terminalPaginationRequiredForComplete: true, missingRestrictedFailedStaleOrTruncatedNeverMeansZero: true,
    rateOrRequestBudgetExhaustion: 'truncated', permissionOrVisibilityMismatch: 'restricted', schemaMismatch: 'failed',
  },
  rollback: {
    legacyCollectorAndJson: 'untouched', runtimeDefault: 'off',
    failedJob: 'retain auditable failed coverage and leave the prior checkpoint unchanged',
    repeatRun: 'create an application-controlled SQLite backup before replacing retained state',
    restore: 'close the database, restore the task-owned backup, and re-open with integrity checks',
    migrationGracePeriod: 'not applicable because this task does not migrate or switch the legacy reader',
  },
  deletion: {
    scope: 'the selected repository alias only',
    cascade: ['collection jobs', 'checkpoints', 'source snapshots', 'coverage', 'dependent facts, features, aliases, caches, packs, and backups if later introduced'],
    tombstone: 'retain only capability id, opaque scope alias, revocation time, and content-free reason code',
    idempotent: true, externalCopies: 'none created by this task',
  },
  provingChecks: [
    'invented task-card, selection, transport, projection, pagination, retry, cap, replay, persistence, rollback, and deletion tests',
    'poison fields never reach logs, SQLite, reports, exports, bundles, or Pages',
    'focused github.core and incremental-storage tests', 'npm run check', 'independent privacy and correctness review',
    'exact-head hosted gate before real execution', 'one final public unauthenticated selected-repository run with numeric and coverage-only reporting',
    'live replay, backup/restore, deletion, tombstone, and re-consent proof inside this exact task-owned subtree',
  ],
  stopConditions: [
    'selected repository visibility or immutable repository id differs from the card', 'authentication becomes necessary',
    'the declared request budget would be exceeded', 'a prohibited field is about to reach a sink',
    'coverage cannot distinguish complete from partial', 'G4 or any external-model path would be required',
  ],
})

let roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })))
  roots = []
})

async function fixtureRoot(card: unknown = validCard()): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'developer-lens-loader-'))
  roots.push(root)
  const cardDirectory = join(root, '.developer-lens', 'activation', taskId)
  await mkdir(cardDirectory, { recursive: true })
  await writeFile(join(cardDirectory, 'task-card.json'), JSON.stringify(card), 'utf8')
  return root
}

async function expectInvalid(input: unknown): Promise<void> {
  await expect(loadGithubCoreActivationTaskCard(input as never)).rejects.toMatchObject({
    code: GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE,
    message: GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD_ERROR_CODE,
  })
}

describe('github.core activation task card loader', () => {
  it('reads only the canonical task card and returns the parser’s frozen card', async () => {
    const root = await fixtureRoot()
    const card = await loadGithubCoreActivationTaskCard({ workspaceRoot: root, taskId })
    expect(card.taskId).toBe(taskId)
    expect(card.localBoundary.root).toBe(`.developer-lens/activation/${taskId}/`)
    expect(Object.isFrozen(card)).toBe(true)
    expect(Object.isFrozen(card.localBoundary)).toBe(true)
  })

  it('rejects malformed JSON, schema errors, and a wrong filename without leaking values', async () => {
    const root = await fixtureRoot()
    const cardPath = join(root, '.developer-lens', 'activation', taskId, 'task-card.json')
    await writeFile(cardPath, '{ malformed fixture JSON', 'utf8')
    await expectInvalid({ workspaceRoot: root, taskId })

    await writeFile(cardPath, JSON.stringify({ ...validCard(), secretFixture: 'must-not-leak' }), 'utf8')
    await expectInvalid({ workspaceRoot: root, taskId })

    await rm(cardPath)
    await writeFile(join(root, '.developer-lens', 'activation', taskId, 'other.json'), JSON.stringify(validCard()), 'utf8')
    await expectInvalid({ workspaceRoot: root, taskId })
  })

  it('rejects traversal, absolute, alternate-root, and card-root mismatch inputs', async () => {
    const root = await fixtureRoot()
    await expectInvalid({ workspaceRoot: root, taskId: '../outside' })
    await expectInvalid({ workspaceRoot: root, taskId: 'C:\\outside' })
    await expectInvalid({ workspaceRoot: root, taskId: '/outside' })
    await expectInvalid({ workspaceRoot: root, taskId: `${taskId}/alternate` })
    await expectInvalid({ workspaceRoot: '.', taskId })
    await expectInvalid({ workspaceRoot: root, taskId: taskId, extra: 'closed' })
    await expectInvalid({ workspaceRoot: root, taskId: taskId, workspace: 'alternate-root' })

    const mismatch = validCard()
    mismatch.localBoundary.root = '.developer-lens/activation/other-task/'
    await writeFile(join(root, '.developer-lens', 'activation', taskId, 'task-card.json'), JSON.stringify(mismatch), 'utf8')
    await expectInvalid({ workspaceRoot: root, taskId })
  })

  it('rejects a symlink escape before reading the outside card when supported', async () => {
    const root = await mkdtemp(join(tmpdir(), 'developer-lens-loader-'))
    roots.push(root)
    const outside = await mkdtemp(join(tmpdir(), 'developer-lens-loader-outside-'))
    roots.push(outside)
    await mkdir(join(root, '.developer-lens', 'activation'), { recursive: true })
    await mkdir(join(outside, taskId), { recursive: true })
    await writeFile(join(outside, taskId, 'task-card.json'), JSON.stringify(validCard()), 'utf8')
    try {
      await symlink(join(outside, taskId), join(root, '.developer-lens', 'activation', taskId), 'junction')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'EACCES') return
      throw error
    }
    await expectInvalid({ workspaceRoot: root, taskId })
    await expect(readFile(join(outside, taskId, 'task-card.json'), 'utf8')).resolves.toContain('fixture-loader-01')
  })
})
