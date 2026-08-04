import { describe, expect, it } from 'vitest'
import type { GithubCoreRestCompleteResult } from './restTransport.js'
import {
  composeGithubCoreRestComplete,
  type GithubCoreRestCompositionContext,
} from './restComposition.js'

const rangeStart = '2026-07-01T00:00:00.000Z'
const rangeEnd = '2026-08-01T00:00:00.000Z'

const context: GithubCoreRestCompositionContext = {
  checkpoint: null,
  scopeAlias: 'repo-alias',
  rangeStart,
  rangeEnd,
  observedAt: '2026-08-04T00:00:00.000Z',
  jobId: 'job-composition-1',
  consentRevision: 'consent-composition-1',
  pageCap: 5,
}

function completeResult(overrides: Partial<GithubCoreRestCompleteResult> = {}): GithubCoreRestCompleteResult {
  return {
    kind: 'complete',
    status: 'complete',
    total: 3,
    rangeStart,
    rangeEnd,
    repositoryAlias: 'repo-alias',
    rateLimit: { remaining: 17, reset: 1234 },
    repositoryFlags: { public: true, archived: true, disabled: false, fork: false },
    units: [
      { alias: 'issue-a', kind: 'issue', updatedAt: '2026-07-03T00:00:00.000Z' },
      { alias: 'issue-z', kind: 'issue', updatedAt: '2026-07-02T00:00:00.000Z' },
      { alias: 'pull-request-b', kind: 'pull_request', updatedAt: '2026-07-04T00:00:00.000Z' },
    ],
    pages: [
      { pageNumber: 1, receiptAlias: 'page-1', unitCount: 2, unitAliases: ['issue-a', 'issue-z'], nextPage: 2 },
      { pageNumber: 2, receiptAlias: 'page-2', unitCount: 1, unitAliases: ['pull-request-b'], nextPage: null },
    ],
    observedUnitCount: 3,
    observedPageCount: 2,
    ...overrides,
  }
}

describe('pure complete REST composition', () => {
  it('maps two pages to frozen receipts, high-watermarks, hash, and bounded source ID', () => {
    const result = composeGithubCoreRestComplete({ ...context, result: completeResult() })

    expect(result.transition.status).toBe('complete')
    expect(result.receipts).toEqual([
      {
        receiptId: 'page-1',
        pageNumber: 1,
        unitIds: ['issue-a', 'issue-z'],
        highWatermark: '2026-07-03T00:00:00.000Z',
        nextCursor: 'page-2',
      },
      {
        receiptId: 'page-2',
        pageNumber: 2,
        unitIds: ['pull-request-b'],
        highWatermark: '2026-07-04T00:00:00.000Z',
        nextCursor: null,
      },
    ])
    expect(result.transition.checkpoint?.lastCompleteSnapshotHash).toBe(result.snapshotHash)
    expect(result.sourceSnapshotId).toMatch(/^ghcore_[a-f0-9]{64}$/)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.receipts)).toBe(true)
    expect(Object.isFrozen(result.receipts[0])).toBe(true)
    expect(Object.isFrozen(result.receipts[0]!.unitIds)).toBe(true)
  })

  it('accepts an explicit empty terminal page without fabricating a receipt', () => {
    const result = composeGithubCoreRestComplete({
      ...context,
      result: completeResult({
        total: 0,
        units: [],
        pages: [{ pageNumber: 1, receiptAlias: 'page-empty', unitCount: 0, unitAliases: [], nextPage: null }],
        observedUnitCount: 0,
        observedPageCount: 1,
      }),
    })

    expect(result.transition.coverage).toMatchObject({ status: 'complete', expectedUnits: 0, observedUnits: 0 })
    expect(result.receipts).toEqual([{
      receiptId: 'page-empty',
      pageNumber: 1,
      unitIds: [],
      nextCursor: null,
    }])
  })

  it('is replay-stable across page/unit permutations and rate-limit changes', () => {
    const first = completeResult()
    const permuted = completeResult({
      rateLimit: { remaining: 0, reset: 9999 },
      units: [first.units[2]!, first.units[0]!, first.units[1]!],
      pages: [
        { ...first.pages[1]!, unitAliases: ['pull-request-b'] },
        { ...first.pages[0]!, unitAliases: ['issue-z', 'issue-a'] },
      ],
    })
    const left = composeGithubCoreRestComplete({ ...context, result: first })
    const right = composeGithubCoreRestComplete({ ...context, result: permuted })

    expect(right.snapshotHash).toBe(left.snapshotHash)
    expect(right.receipts).toEqual(left.receipts)
  })

  it('keeps content hashes replay-stable while assigning distinct snapshot rows to distinct jobs', () => {
    const first = composeGithubCoreRestComplete({ ...context, result: completeResult() })
    const replay = composeGithubCoreRestComplete({
      ...context,
      jobId: 'job-composition-2',
      observedAt: '2026-08-04T01:00:00.000Z',
      result: completeResult(),
    })

    expect(replay.snapshotHash).toBe(first.snapshotHash)
    expect(replay.sourceSnapshotId).not.toBe(first.sourceSnapshotId)
    expect(composeGithubCoreRestComplete({ ...context, result: completeResult() }).sourceSnapshotId)
      .toBe(first.sourceSnapshotId)
  })

  it.each([
    ['scope mismatch', { repositoryAlias: 'other-scope' }],
    ['range start mismatch', { rangeStart: '2026-07-02T00:00:00.000Z' }],
    ['range end mismatch', { rangeEnd: '2026-07-31T00:00:00.000Z' }],
    ['total mismatch', { total: 2 }],
    ['unit count mismatch', { observedUnitCount: 2 }],
    ['page count mismatch', { observedPageCount: 1 }],
    ['unknown member', { pages: [{ pageNumber: 1, receiptAlias: 'page-1', unitCount: 2, unitAliases: ['issue-a', 'unknown'], nextPage: 2 }, completeResult().pages[1]!] }],
    ['page count field mismatch', { pages: [{ pageNumber: 1, receiptAlias: 'page-1', unitCount: 1, unitAliases: ['issue-a', 'issue-z'], nextPage: 2 }, completeResult().pages[1]!] }],
    ['missing page sequence', { pages: [{ pageNumber: 2, receiptAlias: 'page-2', unitCount: 1, unitAliases: ['pull-request-b'], nextPage: null }] }],
    ['nonterminal last page', { pages: [{ pageNumber: 1, receiptAlias: 'page-1', unitCount: 2, unitAliases: ['issue-a', 'issue-z'], nextPage: 2 }, { pageNumber: 2, receiptAlias: 'page-2', unitCount: 1, unitAliases: ['pull-request-b'], nextPage: 3 }] }],
    ['duplicate receipt alias', { pages: [{ pageNumber: 1, receiptAlias: 'page-1', unitCount: 2, unitAliases: ['issue-a', 'issue-z'], nextPage: 2 }, { pageNumber: 2, receiptAlias: 'page-1', unitCount: 1, unitAliases: ['pull-request-b'], nextPage: null }] }],
    ['duplicate unit alias', { pages: [{ pageNumber: 1, receiptAlias: 'page-1', unitCount: 3, unitAliases: ['issue-a', 'issue-a', 'issue-z'], nextPage: 2 }, completeResult().pages[1]!] }],
    ['out-of-range timestamp', { units: [{ alias: 'issue-a', kind: 'issue', updatedAt: '2026-08-01T00:00:00.000Z' }, completeResult().units[1]!, completeResult().units[2]!] }],
    ['invalid alias', { units: [{ alias: 'raw/provider/id', kind: 'issue', updatedAt: '2026-07-03T00:00:00.000Z' }, completeResult().units[1]!, completeResult().units[2]!] }],
    ['repository-unit alias collision', {
      units: [{ alias: 'repo-alias', kind: 'issue', updatedAt: '2026-07-03T00:00:00.000Z' }, completeResult().units[1]!, completeResult().units[2]!],
      pages: [{ pageNumber: 1, receiptAlias: 'page-1', unitCount: 2, unitAliases: ['repo-alias', 'issue-z'], nextPage: 2 }, completeResult().pages[1]!],
    }],
  ] as const)('rejects %s', (_label, override) => {
    expect(() => composeGithubCoreRestComplete({ ...context, result: completeResult(override) })).toThrow(
      'REST_COMPLETE_COMPOSITION_INVALID',
    )
  })

  it('rejects a unit partition mismatch and a malformed terminal chain without leaking canaries', () => {
    const malformed = completeResult({
      units: [{ alias: 'POISON_UNIT', kind: 'issue', updatedAt: '2026-07-03T00:00:00.000Z' }, completeResult().units[1]!, completeResult().units[2]!],
      pages: completeResult().pages,
    })
    expect(() => composeGithubCoreRestComplete({ ...context, result: malformed })).toThrow(
      'REST_COMPLETE_COMPOSITION_INVALID',
    )
    try {
      composeGithubCoreRestComplete({ ...context, result: malformed })
    } catch (error) {
      expect((error as Error).message).not.toContain('POISON_UNIT')
    }
  })

  it('changes the hash for material flags, membership, and unit facts', () => {
    const baseline = composeGithubCoreRestComplete({ ...context, result: completeResult() }).snapshotHash
    for (const result of [
      completeResult({ repositoryFlags: { public: true, archived: false, disabled: false, fork: false } }),
      completeResult({ units: [completeResult().units[0]!, completeResult().units[1]!, { alias: 'pull-request-c', kind: 'pull_request', updatedAt: '2026-07-04T00:00:00.000Z' }], pages: [{ pageNumber: 1, receiptAlias: 'page-1', unitCount: 2, unitAliases: ['issue-a', 'issue-z'], nextPage: 2 }, { pageNumber: 2, receiptAlias: 'page-2', unitCount: 1, unitAliases: ['pull-request-c'], nextPage: null }] }),
      completeResult({ units: [{ alias: 'issue-a', kind: 'issue', updatedAt: '2026-07-05T00:00:00.000Z' }, completeResult().units[1]!, completeResult().units[2]!] }),
    ]) {
      expect(composeGithubCoreRestComplete({ ...context, result }).snapshotHash).not.toBe(baseline)
    }
  })

  it('snapshots projected inputs against later mutation', () => {
    const result = completeResult()
    const composed = composeGithubCoreRestComplete({ ...context, result })
    ;(result.units as GithubCoreRestCompleteResult['units'] as Array<GithubCoreRestCompleteResult['units'][number]>)[0] = {
      alias: 'mutated',
      kind: 'issue',
      updatedAt: '2026-07-03T00:00:00.000Z',
    }
    ;(result.pages as GithubCoreRestCompleteResult['pages'] as Array<GithubCoreRestCompleteResult['pages'][number]>)[0] = {
      ...result.pages[0]!,
      unitAliases: ['mutated'],
      unitCount: 1,
    }
    expect(composed.receipts[0]!.unitIds).toEqual(['issue-a', 'issue-z'])
  })
})
