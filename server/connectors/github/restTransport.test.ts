import { describe, expect, it } from 'vitest'
import { parseGithubCoreActivationTaskCard, type GithubCoreActivationTaskCard } from './activationTask.js'
import {
  collectGithubCoreRest,
  type GithubCoreRestFetch,
  type GithubCoreRestResponse,
} from './restTransport.js'

const rangeStart = '2026-07-01T00:00:00.000Z'
const rangeEnd = '2026-08-01T00:00:00.000Z'

function card(overrides: { maximumRequests?: number } = {}): GithubCoreActivationTaskCard {
  return parseGithubCoreActivationTaskCard({
    schemaVersion: 'github-core-activation-task-card.v1', taskId: 'transport-fixture', authorizedAt: '2026-08-04T00:00:00.000Z',
    authorizationBasis: 'invented fixture', selectedRepository: { owner: 'fixture-owner', name: 'fixture-repository', providerRepositoryId: '101', expectedVisibility: 'public', defaultBranch: 'main' },
    purpose: 'invented fixture', readBoundary: { provider: 'github.com', apiBase: 'https://api.github.com', apiVersion: '2026-03-10', credentialMode: 'public_unauthenticated', credentialMutation: 'forbidden', allowedResources: ['current repository lifecycle metadata', 'open issue and pull-request lifecycle units updated inside the bounded range', 'pagination and rate-limit headers'], rangeStart, rangeEndPolicy: 'freeze_at_job_start', pageSize: 2, maximumRequests: overrides.maximumRequests ?? 5, localCheckout: 'forbidden', localDatabase: 'forbidden', workingTree: 'forbidden' },
    strictProjection: { allowedEphemeralProviderFields: ['repository id', 'repository public/private, archived, disabled, and fork flags', 'issue or pull-request node id', 'issue or pull-request kind', 'updated_at', 'pagination relation', 'rate-limit remaining and reset'], retainedFields: ['installation-scoped repository alias', 'installation-scoped unit aliases', 'job and receipt aliases', 'snapshot hash', 'observed unit and page counts', 'coverage status and stable limitation code', 'bounded checkpoint timestamps'], prohibitedSinks: ['repository owner or name', 'raw provider repository or node ids', 'URLs', 'titles, bodies, labels, milestones, comments, review text, or commit subjects', 'people, users, assignees, reviewers, or contributor dimensions', 'source, paths, diffs, patches, logs, artifacts, caches, Actions, Projects, ownership, or security data', 'raw upstream objects or response bytes'], providerResponseRule: 'allowlisted_fields_only_and_raw_responses_never_persisted' },
    localBoundary: { root: '.developer-lens/activation/transport-fixture/', taskCard: 'task-card.json', database: 'github-core.sqlite', installationKey: 'installation-key.bin', backupDirectory: 'backup/', report: 'last-run-report.json', trackedOrPublished: false },
    retention: { c1Aggregates: '36 rolling months', c2AliasesAndExactTimestamps: '13 months', c4SourceBytes: 'process lifetime only', rawResponses: 'never persisted', packsOrExports: 'none authorized' },
    coverage: { terminalPaginationRequiredForComplete: true, missingRestrictedFailedStaleOrTruncatedNeverMeansZero: true, rateOrRequestBudgetExhaustion: 'truncated', permissionOrVisibilityMismatch: 'restricted', schemaMismatch: 'failed' },
    rollback: { legacyCollectorAndJson: 'untouched', runtimeDefault: 'off', failedJob: 'retain auditable failed coverage and leave the prior checkpoint unchanged', repeatRun: 'create an application-controlled SQLite backup before replacing retained state', restore: 'close the database, restore the task-owned backup, and re-open with integrity checks', migrationGracePeriod: 'not applicable because this task does not migrate or switch the legacy reader' },
    deletion: { scope: 'the selected repository alias only', cascade: ['collection jobs', 'checkpoints', 'source snapshots', 'coverage', 'dependent facts, features, aliases, caches, packs, and backups if later introduced'], tombstone: 'retain only capability id, opaque scope alias, revocation time, and content-free reason code', idempotent: true, externalCopies: 'none created by this task' }, provingChecks: ['synthetic fixture'], stopConditions: ['any credential mutation'],
  })
}

function response(status: number, body: unknown, headers: Record<string, string> = {}): GithubCoreRestResponse {
  return { status, headers: { get: (name) => headers[name.toLowerCase()] ?? headers[name] }, text: async () => JSON.stringify(body) }
}

function fetchFixture(responses: GithubCoreRestResponse[]): { fetch: GithubCoreRestFetch; calls: { url: string; init: Record<string, unknown> }[] } {
  const calls: { url: string; init: Record<string, unknown> }[] = []
  return { calls, fetch: async (url, init) => { calls.push({ url, init: init as unknown as Record<string, unknown> }); const next = responses.shift(); if (!next) throw new Error('fixture exhausted'); return next } }
}

const metadata = { id: 101, private: false, archived: true, disabled: false, fork: false, owner: { login: 'POISON_OWNER' }, name: 'POISON_NAME', html_url: 'https://poison.invalid' }

describe('github.core REST transport projection', () => {
  it('uses fixed unauthenticated GET requests and projects only allowlisted fields', async () => {
    const fixture = fetchFixture([
      response(200, metadata, { 'x-ratelimit-remaining': '17', 'x-ratelimit-reset': '1234' }),
      response(200, [{ node_id: 'raw+/=1', updated_at: '2026-07-02T00:00:00.000Z', pull_request: {}, title: 'POISON_TITLE', body: 'POISON_BODY', user: { login: 'POISON_USER' }, url: 'https://poison.invalid' }, { node_id: 'raw-2', updated_at: rangeEnd }]),
    ])
    const aliases: string[] = []
    const result = await collectGithubCoreRest({ card: card(), rangeEnd, fetch: fixture.fetch, alias: (domain, id) => { aliases.push(`${domain}:${id}`); return `${domain}-alias-${id.replaceAll(/[^A-Za-z0-9_-]/g, '_')}` } })
    expect(result.kind).toBe('complete')
    expect(result).toMatchObject({ repositoryAlias: 'repository-alias-101', repositoryFlags: { public: true, archived: true, disabled: false, fork: false }, observedUnitCount: 1, rateLimit: { remaining: null, reset: null } })
    expect(result.units).toEqual([{ alias: 'pull_request-alias-raw___1', kind: 'pull_request', updatedAt: '2026-07-02T00:00:00.000Z' }])
    expect(JSON.stringify(result)).not.toContain('POISON')
    expect(JSON.stringify(result)).not.toContain('raw+/=1')
    expect(aliases).toEqual(['repository:101', 'pull_request:raw+/=1'])
    expect(fixture.calls).toHaveLength(2)
    expect(fixture.calls[0]!.url).toBe('https://api.github.com/repos/fixture-owner/fixture-repository')
    const query = new URL(fixture.calls[1]!.url).searchParams
    expect(Object.fromEntries(query)).toEqual({ state: 'open', since: rangeStart, per_page: '2', page: '1', sort: 'updated', direction: 'asc' })
    for (const call of fixture.calls) {
      expect(call.init).toMatchObject({ method: 'GET', redirect: 'error' })
      expect(call.init.headers).toEqual({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'developer-lens-public-transport/1' })
      expect(call.init.headers).not.toHaveProperty('Authorization')
      expect(call.init.headers).not.toHaveProperty('Cookie')
    }
  })

  it('rejects metadata mismatches and distinguishes terminal pagination from hostile links', async () => {
    const mismatch = fetchFixture([response(200, { ...metadata, id: 999 })])
    await expect(collectGithubCoreRest({ card: card(), rangeEnd, fetch: mismatch.fetch, alias: () => 'repo-alias' })).resolves.toMatchObject({ kind: 'restricted', code: 'REPOSITORY_ID_MISMATCH' })
    const hostile = fetchFixture([response(200, metadata), response(200, [{ node_id: 'n1', updated_at: '2026-07-02T00:00:00.000Z' }], { link: '<https://evil.invalid/repos/fixture-owner/fixture-repository/issues?page=2>; rel="next"' })])
    await expect(collectGithubCoreRest({ card: card(), rangeEnd, fetch: hostile.fetch, alias: () => 'repo-alias' })).resolves.toMatchObject({ kind: 'failed', code: 'SCHEMA_INVALID' })
    const terminal = fetchFixture([response(200, metadata), response(200, [{ node_id: 'n1', updated_at: '2026-07-02T00:00:00.000Z' }])])
    await expect(collectGithubCoreRest({ card: card(), rangeEnd, fetch: terminal.fetch, alias: () => 'repo-alias' })).resolves.toMatchObject({ kind: 'complete', observedPageCount: 1 })
  })

  it('truncates before a non-terminal page when the request cap is exhausted', async () => {
    const fixture = fetchFixture([response(200, metadata), response(200, [{ node_id: 'n1', updated_at: '2026-07-02T00:00:00.000Z' }], { link: '<https://api.github.com/repos/fixture-owner/fixture-repository/issues?state=open&since=2026-07-01T00%3A00%3A00.000Z&per_page=2&page=2&sort=updated&direction=asc>; rel="next"' })])
    await expect(collectGithubCoreRest({ card: card({ maximumRequests: 2 }), rangeEnd, fetch: fixture.fetch, alias: () => 'repo-alias' })).resolves.toMatchObject({ kind: 'truncated', code: 'REQUEST_BUDGET_EXHAUSTED', total: null })
    expect(fixture.calls).toHaveLength(2)
  })

  it('classifies rate, permission, not-found, server, network, and malformed responses without leaking messages', async () => {
    const cases: Array<[GithubCoreRestResponse | Error, string]> = [[response(429, {}, { 'x-ratelimit-remaining': '0' }), 'RATE_LIMITED'], [response(403, {}), 'PERMISSION_DENIED'], [response(404, {}), 'NOT_FOUND'], [response(503, {}), 'TRANSIENT'], [new Error('SECRET_NETWORK_DETAIL'), 'TRANSIENT']]
    for (const [outcome, code] of cases) {
      const fixture = fetchFixture(outcome instanceof Error ? [] : [outcome])
      const fetch = outcome instanceof Error ? (async () => { throw outcome }) as GithubCoreRestFetch : fixture.fetch
      const result = await collectGithubCoreRest({ card: card(), rangeEnd, fetch, alias: () => 'repo-alias' })
      expect(result).toMatchObject({ kind: code === 'RATE_LIMITED' ? 'failed' : code === 'PERMISSION_DENIED' || code === 'NOT_FOUND' ? 'restricted' : 'failed', code: code === 'RATE_LIMITED' ? 'RATE_LIMITED' : code })
      expect(JSON.stringify(result)).not.toContain('SECRET_NETWORK_DETAIL')
    }
  })
})
