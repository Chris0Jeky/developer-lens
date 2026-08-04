import { describe, expect, it } from 'vitest'
import {
  GITHUB_CORE_QUERY_VERSION,
  GITHUB_CORE_REST_API_VERSION,
  type GithubCoreCheckpoint,
} from './core.js'
import {
  collectSyntheticGithubCorePages,
  type GithubCoreSyntheticCollectionInput,
  type GithubCoreSyntheticPageRequest,
} from './coreAdapter.js'

const rangeStart = '2026-01-01T00:00:00.000Z'
const rangeEnd = '2026-01-02T00:00:00.000Z'
const observedAt = '2026-01-03T00:00:00.000Z'

function input(overrides: Partial<GithubCoreSyntheticCollectionInput> = {}): GithubCoreSyntheticCollectionInput {
  return {
    execution: 'invented_fixture',
    capabilityId: 'github.core',
    scopeAlias: 'scope-01',
    consentRevision: 'consent-01',
    queryVersion: GITHUB_CORE_QUERY_VERSION,
    sourceApiVersion: GITHUB_CORE_REST_API_VERSION,
    rangeStart,
    rangeEnd,
    observedAt,
    jobId: 'job-01',
    pageCap: 3,
    checkpoint: null,
    ...overrides,
  }
}

function page(request: GithubCoreSyntheticPageRequest, receiptId: string, nextCursor: string | null) {
  return {
    kind: 'page' as const,
    request,
    receipt: { receiptId, pageNumber: request.pageNumber, unitIds: [`unit-${request.pageNumber}`], nextCursor },
  }
}

function checkpoint(): GithubCoreCheckpoint {
  return {
    capabilityId: 'github.core',
    scopeAlias: 'scope-01',
    queryVersion: GITHUB_CORE_QUERY_VERSION,
    sourceApiVersion: GITHUB_CORE_REST_API_VERSION,
    boundedOverlapStart: rangeStart,
    consentRevision: 'consent-01',
    committedJobId: 'prior-job',
  }
}

describe('github.core invented page adapter', () => {
  it('requests null then the exact prior cursor and completes terminal pages', async () => {
    const seen: GithubCoreSyntheticPageRequest[] = []
    const result = await collectSyntheticGithubCorePages(input(), async (request) => {
      seen.push(request)
      return request.pageNumber === 1 ? page(request, 'receipt-01', 'cursor-02') : page(request, 'receipt-02', null)
    })

    expect(seen.map(({ pageNumber, cursor }) => [pageNumber, cursor])).toEqual([[1, null], [2, 'cursor-02']])
    expect(result.status).toBe('complete')
    expect(result.execution).toBe('invented_fixture')
    expect(result.appliedReceiptIds).toEqual(['receipt-01', 'receipt-02'])
    expect(result.classification).toBeNull()
  })

  it('rejects missing or wrong synthetic marker and extra input before callback', async () => {
    const acquire = async () => { throw new Error('callback must not run') }
    await expect(collectSyntheticGithubCorePages({ ...input(), execution: 'inert' as 'invented_fixture' }, acquire)).rejects.toThrow('invented_fixture')
    await expect(collectSyntheticGithubCorePages({ ...input(), extra: true } as unknown as GithubCoreSyntheticCollectionInput, acquire)).rejects.toThrow('not permitted')
    await expect(collectSyntheticGithubCorePages({ ...input(), pageCap: Number.MAX_SAFE_INTEGER }, acquire)).rejects.toThrow('between 1 and')
  })

  it('rejects an incompatible checkpoint before invoking acquisition', async () => {
    let calls = 0
    await expect(collectSyntheticGithubCorePages(input({ checkpoint: { ...checkpoint(), scopeAlias: 'other-scope' } }), async () => {
      calls += 1
      return Promise.reject(new Error('must not run'))
    })).rejects.toThrow('scope mismatch')
    expect(calls).toBe(0)
  })

  it('does not let a callback mutate the bound request', async () => {
    const result = await collectSyntheticGithubCorePages(input(), async (request) => {
      try {
        ;(request as { scopeAlias: string }).scopeAlias = 'other-scope'
      } catch {
        // Frozen request objects are part of the contract.
      }
      return page(request, 'receipt-01', null)
    })
    expect(result.status).toBe('complete')
    expect(result.requests[0]?.scopeAlias).toBe('scope-01')
  })

  it('snapshots validated input before callback closure mutation', async () => {
    const previous = checkpoint()
    const mutable = input({ checkpoint: previous })
    const result = await collectSyntheticGithubCorePages(mutable, async (request) => {
      ;(mutable as { scopeAlias: string }).scopeAlias = 'other-scope'
      ;(mutable as { pageCap: number }).pageCap = 1_000
      ;(previous as { scopeAlias: string }).scopeAlias = 'other-scope'
      return page(request, 'receipt-01', null)
    })

    expect(result.status).toBe('complete')
    expect(result.requests[0]?.scopeAlias).toBe('scope-01')
    expect(result.coverage.scopeAlias).toBe('scope-01')
    expect(result.checkpoint?.scopeAlias).toBe('scope-01')
  })

  it('accepts no receipt when a page echo or nested receipt is hostile', async () => {
    const previous = checkpoint()
    const result = await collectSyntheticGithubCorePages(input({ checkpoint: previous }), async (request) => ({
      kind: 'page' as const,
      request: { ...request, scopeAlias: 'other-scope' },
      receipt: { receiptId: 'receipt-01', pageNumber: 1, unitIds: [], nextCursor: null, extra: true },
    } as never))

    expect(result.status).toBe('failed')
    expect(result.coverage.limitationCode).toBe('FAILURE_SCHEMA')
    expect(result.appliedReceiptIds).toEqual([])
    expect(result.checkpoint).toEqual(previous)
  })

  it('truncates at the cap and keeps the prior checkpoint with a non-durable hint', async () => {
    const previous = checkpoint()
    const result = await collectSyntheticGithubCorePages(input({ checkpoint: previous, pageCap: 1 }), async (request) => page(request, 'receipt-01', 'cursor-02'))

    expect(result).toMatchObject({ status: 'truncated', cursorHint: 'cursor-02', checkpoint: previous })
    expect(result.checkpoint?.cursorHint).toBeUndefined()
  })

  it('classifies returned failures without scheduling retries', async () => {
    for (const kind of ['rate_limited', 'transient', 'permission', 'unsupported', 'schema', 'unknown'] as const) {
      const result = await collectSyntheticGithubCorePages(input(), async (request) => ({
        kind: 'failure' as const,
        request,
        failure: { kind, attempt: 1 },
      }))
      expect(result.status).toBe('failed')
      expect(result.coverage.limitationCode).toBe(`FAILURE_${kind.toUpperCase()}`)
      expect(result.retryScheduled).toBe(false)
      expect(result.execution).toBe('invented_fixture')
      expect(result.classification?.kind).toBe(kind)
    }
  })

  it('maps thrown typed and unknown failures and rejects duplicate or cyclic pagination', async () => {
    const typed = await collectSyntheticGithubCorePages(input(), async () => { throw { kind: 'transient', attempt: 2 } })
    expect(typed.classification).toMatchObject({ kind: 'transient', attempt: 2 })
    const unknown = await collectSyntheticGithubCorePages(input(), async () => { throw new Error('unknown') })
    expect(unknown.classification?.kind).toBe('unknown')

    const duplicate = await collectSyntheticGithubCorePages(input(), async (request) => page(request, 'same', request.pageNumber === 1 ? 'cursor-02' : null))
    expect(duplicate.status).toBe('failed')
    expect(duplicate.coverage.limitationCode).toBe('FAILURE_SCHEMA')
    const cyclic = await collectSyntheticGithubCorePages(input(), async (request) => page(request, `receipt-${request.pageNumber}`, request.cursor ?? 'cursor-01'))
    expect(cyclic.status).toBe('failed')
    expect(cyclic.coverage.limitationCode).toBe('FAILURE_SCHEMA')
  })
})
