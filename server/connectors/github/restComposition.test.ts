import { describe, expect, it } from 'vitest'
import type {
  GithubCoreRestCompleteResult,
  GithubCoreRestNonCompleteResult,
  GithubCoreRestTruncatedResult,
} from './restTransport.js'
import {
  composeGithubCoreRestComplete,
  composeGithubCoreRestNoncomplete,
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

const nonCompleteContext = {
  ...context,
  attempt: 1,
} as const

function nonCompleteResult(
  overrides: Partial<GithubCoreRestNonCompleteResult> = {},
): GithubCoreRestNonCompleteResult {
  return {
    kind: 'truncated',
    status: 'truncated',
    total: null,
    code: 'REQUEST_BUDGET_EXHAUSTED',
    repositoryAlias: 'repo-alias',
    rateLimit: { remaining: 3, reset: 1234 },
    repositoryFlags: {
      public: true,
      archived: false,
      disabled: false,
      fork: false,
    },
    units: [{ alias: 'issue-a', kind: 'issue', updatedAt: '2026-07-03T00:00:00.000Z' }],
    pages: [{ pageNumber: 1, receiptAlias: 'page-1', unitCount: 1, unitAliases: ['issue-a'], nextPage: 2 }],
    observedUnitCount: 1,
    observedPageCount: 1,
    rangeStart,
    rangeEnd,
    ...overrides,
  } as GithubCoreRestNonCompleteResult
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

describe('pure noncomplete REST composition', () => {
  it('composes restricted, failed, pre/post-metadata, and partial truncation without snapshots', () => {
    const restricted = composeGithubCoreRestNoncomplete({
      ...nonCompleteContext,
      result: {
        kind: 'restricted', status: 'restricted', code: 'NOT_FOUND', repositoryAlias: 'repo-alias',
        rateLimit: { remaining: null, reset: null }, rangeStart, rangeEnd,
      },
    })
    const failed = composeGithubCoreRestNoncomplete({
      ...nonCompleteContext,
      result: {
        kind: 'failed', status: 'failed', code: 'SCHEMA_INVALID', repositoryAlias: 'repo-alias',
        rateLimit: { remaining: null, reset: null }, rangeStart, rangeEnd,
      },
    })
    const transient = composeGithubCoreRestNoncomplete({
      ...nonCompleteContext,
      result: {
        kind: 'failed', status: 'failed', code: 'TRANSIENT', repositoryAlias: 'repo-alias',
        rateLimit: { remaining: null, reset: null }, rangeStart, rangeEnd,
      },
    })
    const metadataOnly = composeGithubCoreRestNoncomplete({
      ...nonCompleteContext,
      result: nonCompleteResult({ repositoryFlags: null, units: null, pages: null, observedUnitCount: null, observedPageCount: null }),
    })
    const postMetadataBudget = composeGithubCoreRestNoncomplete({
      ...nonCompleteContext,
      result: nonCompleteResult({ units: [], pages: [], observedUnitCount: 0, observedPageCount: 0 }),
    })
    const postMetadataRateLimit = composeGithubCoreRestNoncomplete({
      ...nonCompleteContext,
      result: nonCompleteResult({
        code: 'RATE_LIMITED',
        rateLimit: { remaining: 0, reset: 1234 },
        units: [],
        pages: [],
        observedUnitCount: 0,
        observedPageCount: 0,
      }),
    })
    const partial = composeGithubCoreRestNoncomplete({ ...nonCompleteContext, result: nonCompleteResult() })
    expect(restricted.transition).toMatchObject({ status: 'restricted', checkpoint: null, appliedReceiptIds: [] })
    expect(failed.transition).toMatchObject({ status: 'failed', checkpoint: null, appliedReceiptIds: [] })
    expect(transient.transition).toMatchObject({
      status: 'failed', checkpoint: null, appliedReceiptIds: [],
      coverage: { limitationCode: 'FAILURE_TRANSIENT', retryable: true },
    })
    expect(metadataOnly.transition).toMatchObject({ status: 'truncated', checkpoint: null, appliedReceiptIds: [] })
    expect(postMetadataBudget.transition).toMatchObject({
      status: 'truncated', checkpoint: null, appliedReceiptIds: [], coverage: { limitationCode: 'REQUEST_BUDGET_EXHAUSTED' },
    })
    expect(postMetadataRateLimit.transition).toMatchObject({
      status: 'truncated', checkpoint: null, appliedReceiptIds: [], coverage: { limitationCode: 'RATE_LIMITED' },
    })
    expect(postMetadataBudget.transition).not.toHaveProperty('cursorHint')
    expect(postMetadataRateLimit.transition).not.toHaveProperty('cursorHint')
    expect(partial.transition).toMatchObject({ status: 'truncated', appliedReceiptIds: ['page-1'], cursorHint: '2' })
    for (const result of [
      restricted, failed, transient, metadataOnly, postMetadataBudget, postMetadataRateLimit, partial,
    ]) {
      expect(Object.keys(result)).toEqual(['transition'])
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.transition)).toBe(true)
      expect(result).not.toHaveProperty('snapshotHash')
      expect(result).not.toHaveProperty('sourceSnapshotId')
    }
  })

  it('rejects unbound, mismatched, unknown, incoherent, colliding, and terminal outcomes', () => {
    const restricted = {
      kind: 'restricted', status: 'restricted', code: 'NOT_FOUND', repositoryAlias: 'repo-alias',
      rateLimit: { remaining: null, reset: null }, rangeStart, rangeEnd,
    } as const
    const invalids: GithubCoreRestNonCompleteResult[] = [
      { ...restricted, rangeStart: null, rangeEnd: null },
      { ...restricted, rangeStart: rangeEnd },
      { ...restricted, repositoryAlias: 'other-scope' },
      { ...restricted, extra: 'unknown' } as unknown as GithubCoreRestNonCompleteResult,
      nonCompleteResult({ observedUnitCount: 2 }),
      nonCompleteResult({ units: null }),
      nonCompleteResult({ units: [], pages: [], observedUnitCount: 1, observedPageCount: 0 }),
      nonCompleteResult({ units: [], pages: [], observedUnitCount: 0, observedPageCount: 1 }),
      nonCompleteResult({ units: [{ alias: 'issue-a', kind: 'issue', updatedAt: rangeStart }], pages: [], observedUnitCount: 1, observedPageCount: 0 }),
      nonCompleteResult({ pages: [{ pageNumber: 1, receiptAlias: 'issue-a', unitCount: 1, unitAliases: ['issue-a'], nextPage: 2 }] }),
      nonCompleteResult({ pages: [{ pageNumber: 1, receiptAlias: 'page-1', unitCount: 1, unitAliases: ['issue-a'], nextPage: null }] }),
      nonCompleteResult({ units: [{ alias: 'issue-a', kind: 'issue', updatedAt: rangeEnd }] }),
      nonCompleteResult({ code: 'RATE_LIMITED', status: 'failed', kind: 'failed' }),
    ]
    for (const result of invalids) {
      expect(() => composeGithubCoreRestNoncomplete({ ...nonCompleteContext, result })).toThrow(
        'REST_NONCOMPLETE_COMPOSITION_INVALID',
      )
    }
    expect(() => composeGithubCoreRestNoncomplete({ ...nonCompleteContext, attempt: 0, result: nonCompleteResult() })).toThrow(
      'REST_NONCOMPLETE_COMPOSITION_INVALID',
    )
  })

  it('preserves checkpoint and resists caller mutation across stable replays', () => {
    const checkpoint = {
      capabilityId: 'github.core' as const,
      scopeAlias: 'repo-alias',
      queryVersion: 'github.core.v1' as const,
      sourceApiVersion: '2026-03-10' as const,
      highWatermark: '2026-07-10T00:00:00.000Z',
      boundedOverlapStart: rangeStart,
      consentRevision: 'consent-composition-1',
      committedJobId: 'job-old',
    }
    const result = nonCompleteResult() as GithubCoreRestTruncatedResult
    const first = composeGithubCoreRestNoncomplete({ ...nonCompleteContext, checkpoint, result: result as GithubCoreRestNonCompleteResult })
    const replay = composeGithubCoreRestNoncomplete({ ...nonCompleteContext, checkpoint, result: nonCompleteResult({ rateLimit: { remaining: 0, reset: 9999 } }) })
    expect(first.transition.checkpoint).toEqual(checkpoint)
    expect(first.transition.checkpoint).not.toBe(checkpoint)
    expect(replay.transition).toEqual(first.transition)
    ;((result.pages as Array<NonNullable<GithubCoreRestTruncatedResult['pages']>[number]>)[0] as unknown as { unitAliases: string[] }).unitAliases = ['mutated']
    expect(first.transition.appliedReceiptIds).toEqual(['page-1'])
    expect(Object.isFrozen(first.transition.appliedReceiptIds)).toBe(true)
    expect(Object.isFrozen(checkpoint)).toBe(false)
  })
})
