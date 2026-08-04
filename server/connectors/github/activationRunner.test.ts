import type Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GITHUB_CORE_ACTIVATION_RUNNER_ERROR_CODE,
  runGithubCoreActivation,
  type GithubCoreActivationRunnerInput,
} from './activationRunner.js'
import type {
  GithubCoreRestFetch,
  GithubCoreRestResponse,
} from './restTransport.js'
import { openStorageDatabase } from '../../storage/database.js'
import {
  installIncrementalGithubCoreStorage,
  readIncrementalGithubCoreCheckpoint,
} from '../../storage/incremental.js'
import { createInstallationAliases } from '../../storage/installationAliases.js'

const taskId = 'activation-runner-fixture'
const rangeStart = '2026-07-01T00:00:00.000Z'
const firstJobStart = '2026-08-01T00:00:00.000Z'
const secondJobStart = '2026-08-02T00:00:00.000Z'
const installationKey = Buffer.alloc(32, 0x5a)

const roots: string[] = []
const databases: Database.Database[] = []

afterEach(async () => {
  for (const db of databases.splice(0)) {
    if (db.open) db.close()
  }
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

function database(): Database.Database {
  const db = openStorageDatabase(':memory:')
  installIncrementalGithubCoreStorage(db)
  databases.push(db)
  return db
}

function card(maximumRequests = 5): Record<string, unknown> {
  return {
    schemaVersion: 'github-core-activation-task-card.v1',
    taskId,
    authorizedAt: '2026-08-04T00:00:00.000Z',
    authorizationBasis: 'invented owner reviewed fixture',
    selectedRepository: {
      owner: 'fixture-owner',
      name: 'fixture-repository',
      providerRepositoryId: '101',
      expectedVisibility: 'public',
      defaultBranch: 'main',
    },
    purpose: 'invented repository lifecycle reflection',
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
      rangeStart,
      rangeEndPolicy: 'freeze_at_job_start',
      pageSize: 2,
      maximumRequests,
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
      root: `.developer-lens/activation/${taskId}/`,
      taskCard: 'task-card.json',
      database: 'github-core.sqlite',
      installationKey: 'installation-key.bin',
      backupDirectory: 'backup/',
      report: 'last-run-report.json',
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

async function cardFixture(value: unknown = card()): Promise<{
  readonly root: string
  readonly expectedTaskCardSha256: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'developer-lens-runner-'))
  roots.push(root)
  const directory = join(root, '.developer-lens', 'activation', taskId)
  await mkdir(directory, { recursive: true })
  const bytes = Buffer.from(JSON.stringify(value), 'utf8')
  await writeFile(join(directory, 'task-card.json'), bytes)
  return {
    root,
    expectedTaskCardSha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): GithubCoreRestResponse {
  return {
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? headers[name] },
    text: async () => JSON.stringify(body),
  }
}

function fetchFixture(responses: readonly GithubCoreRestResponse[]): {
  readonly fetch: GithubCoreRestFetch
  readonly calls: string[]
} {
  const queue = [...responses]
  const calls: string[] = []
  return {
    calls,
    fetch: async (url) => {
      calls.push(url)
      const next = queue.shift()
      if (!next) throw new Error('invented fixture exhausted')
      return next
    },
  }
}

const metadata = {
  id: 101,
  private: false,
  archived: false,
  disabled: false,
  fork: false,
  owner: { login: 'POISON_OWNER' },
  name: 'POISON_REPOSITORY',
}

function completeProbe(nodeId: string): readonly GithubCoreRestResponse[] {
  return [
    response(200, metadata),
    response(200, [{
      node_id: nodeId,
      updated_at: '2026-07-02T00:00:00.000Z',
      title: 'POISON_TITLE',
      body: 'POISON_BODY',
    }]),
  ]
}

function runnerInput(
  fixture: Awaited<ReturnType<typeof cardFixture>>,
  db: Database.Database,
  fetch: GithubCoreRestFetch,
  overrides: Partial<GithubCoreActivationRunnerInput> = {},
): GithubCoreActivationRunnerInput {
  return {
    workspaceRoot: fixture.root,
    taskId,
    expectedTaskCardSha256: fixture.expectedTaskCardSha256,
    db,
    installationKey,
    fetch,
    jobId: 'fixture-job-1',
    jobStartedAt: firstJobStart,
    ...overrides,
  }
}

async function expectRunnerFailure(input: unknown): Promise<void> {
  await expect(runGithubCoreActivation(input as never)).rejects.toMatchObject({
    code: GITHUB_CORE_ACTIVATION_RUNNER_ERROR_CODE,
    message: GITHUB_CORE_ACTIVATION_RUNNER_ERROR_CODE,
  })
}

function count(db: Database.Database, table: string): number {
  return Number(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get())
}

describe('default-off github.core activation runner', () => {
  it('persists one job-bound complete proposal only after two equal complete hashes', async () => {
    const fixture = await cardFixture(card(5))
    const db = database()
    const transport = fetchFixture([
      ...completeProbe('invented-node-a'),
      ...completeProbe('invented-node-a'),
    ])

    const result = await runGithubCoreActivation(runnerInput(fixture, db, transport.fetch))

    expect(result).toEqual({
      stability: 'stable',
      coverage: {
        status: 'complete',
        expectedUnits: 1,
        observedUnits: 1,
        omittedUnits: 0,
        completeObservedUnits: 1,
        saturationReason: null,
        retryable: false,
        limitationCode: 'COMPLETE',
      },
      requests: {
        maximumRequests: 5,
        firstProbeMaximumRequests: 2,
        secondProbeMaximumRequests: 3,
        firstProbeRequests: 2,
        secondProbeRequests: 2,
        totalRequests: 4,
      },
    })
    expect(result.requests.firstProbeRequests).toBeLessThanOrEqual(result.requests.firstProbeMaximumRequests)
    expect(result.requests.secondProbeRequests).toBeLessThanOrEqual(result.requests.secondProbeMaximumRequests)
    expect(result.requests.totalRequests).toBeLessThanOrEqual(result.requests.maximumRequests)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.coverage)).toBe(true)
    expect(Object.isFrozen(result.requests)).toBe(true)
    expect(Object.keys(result).sort()).toEqual(['coverage', 'requests', 'stability'])
    expect(JSON.stringify(result)).not.toMatch(/fixture-owner|fixture-repository|invented-node|POISON|repo-|task-card|sha256/i)
    expect(count(db, 'collection_job')).toBe(1)
    expect(count(db, 'coverage_ledger')).toBe(1)
    expect(count(db, 'source_snapshot')).toBe(1)
    expect(count(db, 'collection_checkpoint')).toBe(1)
    expect(transport.calls).toHaveLength(4)
  })

  it('persists the first bound noncomplete result only and never performs the second probe', async () => {
    const fixture = await cardFixture(card(5))
    const db = database()
    const transport = fetchFixture([response(404, { message: 'POISON_NOT_FOUND' })])

    const result = await runGithubCoreActivation(runnerInput(fixture, db, transport.fetch))

    expect(result).toMatchObject({
      stability: 'not_observed',
      coverage: {
        status: 'restricted',
        observedUnits: 0,
        completeObservedUnits: null,
        limitationCode: 'NOT_FOUND',
      },
      requests: { firstProbeRequests: 1, secondProbeRequests: 0, totalRequests: 1 },
    })
    expect(count(db, 'collection_job')).toBe(1)
    expect(count(db, 'coverage_ledger')).toBe(1)
    expect(count(db, 'source_snapshot')).toBe(0)
    expect(count(db, 'collection_checkpoint')).toBe(0)
    expect(transport.calls).toHaveLength(1)
  })

  it('persists fixed SNAPSHOT_UNSTABLE coverage for unequal complete hashes', async () => {
    const fixture = await cardFixture(card(5))
    const db = database()
    const seedTransport = fetchFixture([
      ...completeProbe('invented-node-a'),
      ...completeProbe('invented-node-a'),
    ])
    await runGithubCoreActivation(runnerInput(fixture, db, seedTransport.fetch, {
      jobId: 'fixture-seed-job',
    }))
    const scopeAlias = createInstallationAliases(installationKey).githubCoreAlias('repository', '101')
    const priorCheckpoint = readIncrementalGithubCoreCheckpoint(db, scopeAlias)
    expect(priorCheckpoint).not.toBeNull()
    const transport = fetchFixture([
      ...completeProbe('invented-node-a'),
      ...completeProbe('invented-node-b'),
    ])

    const result = await runGithubCoreActivation(runnerInput(fixture, db, transport.fetch, {
      jobId: 'fixture-unstable-job',
      jobStartedAt: secondJobStart,
    }))

    expect(result).toMatchObject({
      stability: 'unstable',
      coverage: {
        status: 'truncated',
        expectedUnits: null,
        observedUnits: 0,
        omittedUnits: null,
        completeObservedUnits: null,
        saturationReason: 'SNAPSHOT_UNSTABLE',
        limitationCode: 'SNAPSHOT_UNSTABLE',
      },
    })
    expect(count(db, 'collection_job')).toBe(2)
    expect(count(db, 'coverage_ledger')).toBe(2)
    expect(count(db, 'source_snapshot')).toBe(1)
    expect(count(db, 'collection_checkpoint')).toBe(1)
    expect(readIncrementalGithubCoreCheckpoint(db, scopeAlias)).toEqual(priorCheckpoint)
    expect(db.prepare('SELECT snapshot_id, status, expected_units, saturation_reason, limitation_code FROM coverage_ledger WHERE job_id = ?').get('fixture-unstable-job'))
      .toEqual({
        snapshot_id: null,
        status: 'truncated',
        expected_units: null,
        saturation_reason: 'SNAPSHOT_UNSTABLE',
        limitation_code: 'SNAPSHOT_UNSTABLE',
      })
  })

  it('discards the first complete proposal when the second probe is noncomplete', async () => {
    const fixture = await cardFixture(card(4))
    const db = database()
    const seedTransport = fetchFixture([
      ...completeProbe('invented-node-a'),
      ...completeProbe('invented-node-a'),
    ])
    await runGithubCoreActivation(runnerInput(fixture, db, seedTransport.fetch, {
      jobId: 'fixture-seed-job',
    }))
    const scopeAlias = createInstallationAliases(installationKey).githubCoreAlias('repository', '101')
    const priorCheckpoint = readIncrementalGithubCoreCheckpoint(db, scopeAlias)
    expect(priorCheckpoint).not.toBeNull()
    expect(count(db, 'source_snapshot')).toBe(1)

    const transport = fetchFixture([
      ...completeProbe('invented-node-a'),
      response(403, { message: 'POISON_PERMISSION' }),
    ])
    const result = await runGithubCoreActivation(runnerInput(fixture, db, transport.fetch, {
      jobId: 'fixture-followup-job',
      jobStartedAt: secondJobStart,
    }))

    expect(result).toMatchObject({
      stability: 'not_observed',
      coverage: {
        status: 'restricted',
        completeObservedUnits: null,
        limitationCode: 'PERMISSION_DENIED',
      },
      requests: { firstProbeRequests: 2, secondProbeRequests: 1, totalRequests: 3 },
    })
    expect(readIncrementalGithubCoreCheckpoint(db, scopeAlias)).toEqual(priorCheckpoint)
    expect(count(db, 'source_snapshot')).toBe(1)
    expect(count(db, 'collection_checkpoint')).toBe(1)
    expect(db.prepare('SELECT job_id, status FROM collection_job ORDER BY job_id').all()).toEqual([
      { job_id: 'fixture-followup-job', status: 'restricted' },
      { job_id: 'fixture-seed-job', status: 'complete' },
    ])
  })

  it('rejects a changed reviewed card digest against the prior checkpoint before fetch or persistence', async () => {
    const originalFixture = await cardFixture(card(4))
    const changedFixture = await cardFixture({
      ...card(4),
      authorizationBasis: 'invented owner reviewed fixture revision two',
    })
    const db = database()
    const seedTransport = fetchFixture([
      ...completeProbe('invented-node-a'),
      ...completeProbe('invented-node-a'),
    ])
    await runGithubCoreActivation(runnerInput(originalFixture, db, seedTransport.fetch, {
      jobId: 'fixture-seed-job',
    }))
    const scopeAlias = createInstallationAliases(installationKey).githubCoreAlias('repository', '101')
    const priorCheckpoint = readIncrementalGithubCoreCheckpoint(db, scopeAlias)
    const before = {
      jobs: count(db, 'collection_job'),
      coverage: count(db, 'coverage_ledger'),
      snapshots: count(db, 'source_snapshot'),
      checkpoints: count(db, 'collection_checkpoint'),
    }
    const transport = fetchFixture([])

    await expectRunnerFailure(runnerInput(changedFixture, db, transport.fetch, {
      jobId: 'fixture-reconsent-required',
      jobStartedAt: secondJobStart,
    }))

    expect(transport.calls).toHaveLength(0)
    expect(readIncrementalGithubCoreCheckpoint(db, scopeAlias)).toEqual(priorCheckpoint)
    expect({
      jobs: count(db, 'collection_job'),
      coverage: count(db, 'coverage_ledger'),
      snapshots: count(db, 'source_snapshot'),
      checkpoints: count(db, 'collection_checkpoint'),
    }).toEqual(before)
  })

  it('rejects alias-key, hash, card, closed-input, and unsplittable-budget failures before fetch', async () => {
    const validFixture = await cardFixture(card(5))
    const invalidCardFixture = await cardFixture({ ...card(5), secretFixture: 'POISON_SECRET' })
    const unsplittableFixture = await cardFixture(card(1))
    const db = database()
    const transport = fetchFixture([])
    const validInput = runnerInput(validFixture, db, transport.fetch)

    await expectRunnerFailure({ ...validInput, installationKey: Buffer.alloc(31, 0x5a) })
    await expectRunnerFailure({ ...validInput, expectedTaskCardSha256: '0'.repeat(64) })
    await expectRunnerFailure(runnerInput(invalidCardFixture, db, transport.fetch))
    await expectRunnerFailure({ ...validInput, card: card(5) })
    await expectRunnerFailure(runnerInput(unsplittableFixture, db, transport.fetch))

    expect(transport.calls).toHaveLength(0)
    expect(count(db, 'collection_job')).toBe(0)
    expect(count(db, 'coverage_ledger')).toBe(0)
    expect(count(db, 'source_snapshot')).toBe(0)
    expect(count(db, 'collection_checkpoint')).toBe(0)
  })
})
