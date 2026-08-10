import { describe, expect, it, vi } from 'vitest'
import {
  getPullRequestSnapshot,
  parseCommand,
  runCli,
  type GraphqlExecutor,
} from './githubGovernorEvidence.js'

const HEAD = 'a'.repeat(40)
const BASE = 'b'.repeat(40)
const THREAD_ID = 'PRRT_kwDOExample_1-='

function snapshotResponse(
  overrides: {
    head?: string
    checks?: unknown[]
    checkPage?: boolean
    topLevelPage?: boolean
    threadPage?: boolean
    commentPage?: boolean
    unresolved?: boolean
    closingIssues?: Array<{ number: number; url: string }>
    rollupState?: string
  } = {},
): unknown {
  const checks =
    overrides.checks ??
    [
      {
        __typename: 'CheckRun',
        name: 'Prove the pull request',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        detailsUrl: 'https://example.test/check/1',
        startedAt: '2026-08-10T00:00:00Z',
        completedAt: '2026-08-10T00:01:00Z',
      },
    ]
  const closingIssues = overrides.closingIssues ?? []
  return {
    repository: {
      pullRequest: {
        number: 236,
        url: 'https://example.test/pull/236',
        state: 'OPEN',
        isDraft: false,
        headRefOid: overrides.head ?? HEAD,
        baseRefOid: BASE,
        mergeable: 'MERGEABLE',
        mergeStateStatus: 'CLEAN',
        updatedAt: '2026-08-10T00:02:00Z',
        comments: {
          totalCount: 1,
          pageInfo: { hasNextPage: overrides.topLevelPage ?? false },
          nodes: [
            {
              id: 'top-level-1',
              url: 'https://example.test/comment/top-level-1',
              createdAt: '2026-08-10T00:01:50Z',
              author: { login: 'owner' },
            },
          ],
        },
        closingIssuesReferences: {
          totalCount: closingIssues.length,
          pageInfo: { hasNextPage: false },
          nodes: closingIssues,
        },
        commits: {
          nodes: [
            {
              commit: {
                oid: overrides.head ?? HEAD,
                statusCheckRollup: {
                  state: overrides.rollupState ?? 'SUCCESS',
                  contexts: {
                    pageInfo: { hasNextPage: overrides.checkPage ?? false },
                    nodes: checks,
                  },
                },
              },
            },
          ],
        },
        reviews: {
          totalCount: 1,
          pageInfo: { hasNextPage: false },
          nodes: [
            {
              state: 'COMMENTED',
              submittedAt: '2026-08-10T00:01:30Z',
              author: { login: 'reviewer' },
              commit: { oid: overrides.head ?? HEAD },
            },
          ],
        },
        reviewThreads: {
          totalCount: 1,
          pageInfo: { hasNextPage: overrides.threadPage ?? false },
          nodes: [
            {
              id: THREAD_ID,
              isResolved: !(overrides.unresolved ?? false),
              isOutdated: false,
              comments: {
                totalCount: 2,
                pageInfo: { hasNextPage: overrides.commentPage ?? false },
                nodes: [
                  {
                    id: 'comment-1',
                    url: 'https://example.test/comment/1',
                    createdAt: '2026-08-10T00:00:30Z',
                    author: { login: 'reviewer' },
                  },
                  {
                    id: 'comment-2',
                    url: 'https://example.test/comment/2',
                    createdAt: '2026-08-10T00:01:45Z',
                    author: { login: 'owner' },
                  },
                ],
              },
            },
          ],
        },
      },
    },
  }
}

function executorReturning(...responses: unknown[]): {
  execute: GraphqlExecutor
  calls: Array<{ query: string; variables: Record<string, unknown> }>
} {
  const calls: Array<{ query: string; variables: Record<string, unknown> }> = []
  const execute: GraphqlExecutor = async (query, variables) => {
    calls.push({ query, variables })
    if (responses.length === 0) {
      throw new Error('No test response configured.')
    }
    return responses.shift()
  }
  return { execute, calls }
}

describe('GitHub governor evidence snapshot', () => {
  it('binds repository and PR values as GraphQL variables and returns typed evidence', async () => {
    const { execute, calls } = executorReturning(snapshotResponse())

    const result = await getPullRequestSnapshot(
      'Chris0Jeky/developer-lens',
      236,
      {
        expectHead: HEAD,
        expectBase: BASE,
        requiredCheck: 'Prove the pull request',
        requireNoUnresolved: true,
        requireNoClosingIssues: true,
      },
      execute,
      () => new Date('2026-08-10T00:03:00Z'),
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.variables).toEqual({ owner: 'Chris0Jeky', name: 'developer-lens', number: 236 })
    expect(calls[0]?.query).not.toContain('Chris0Jeky')
    expect(result).toMatchObject({
      observedAt: '2026-08-10T00:03:00.000Z',
      repository: 'Chris0Jeky/developer-lens',
      checks: { completeAndGreen: true },
      topLevelComments: {
        totalCount: 1,
        nodes: [{ id: 'top-level-1', author: 'owner' }],
      },
      reviewThreads: {
        unresolvedCount: 0,
        nodes: [
          {
            id: THREAD_ID,
            latestCommentAt: '2026-08-10T00:01:45Z',
            latestCommentUrl: 'https://example.test/comment/2',
          },
        ],
      },
      coverage: { complete: true },
    })
  })

  it.each([
    ['review threads', { threadPage: true }],
    ['thread comments', { commentPage: true }],
    ['status checks', { checkPage: true }],
    ['top-level comments', { topLevelPage: true }],
  ])('fails closed when %s exceed the evidence bound', async (_label, overrides) => {
    const { execute } = executorReturning(snapshotResponse(overrides))
    await expect(
      getPullRequestSnapshot('Chris0Jeky/developer-lens', 236, {}, execute),
    ).rejects.toThrow(/snapshot is incomplete/i)
  })

  it('uses direct typed requirements instead of shell filters', async () => {
    const { execute } = executorReturning(snapshotResponse({ unresolved: true }))
    await expect(
      getPullRequestSnapshot(
        'Chris0Jeky/developer-lens',
        236,
        { requireNoUnresolved: true },
        execute,
      ),
    ).rejects.toThrow('Expected zero unresolved review threads, observed 1.')
  })

  it('rejects mismatched exact heads and missing required successful checks', async () => {
    const first = executorReturning(snapshotResponse({ head: 'c'.repeat(40) }))
    await expect(
      getPullRequestSnapshot(
        'Chris0Jeky/developer-lens',
        236,
        { expectHead: HEAD },
        first.execute,
      ),
    ).rejects.toThrow(/Head mismatch/)

    const second = executorReturning(snapshotResponse({ checks: [] }))
    await expect(
      getPullRequestSnapshot(
        'Chris0Jeky/developer-lens',
        236,
        { requiredCheck: 'Prove the pull request' },
        second.execute,
      ),
    ).rejects.toThrow('Required check was not observed: Prove the pull request.')

    const third = executorReturning(
      snapshotResponse({
        checks: [
          {
            __typename: 'CheckRun',
            name: 'Unrelated success',
            status: 'COMPLETED',
            conclusion: 'SUCCESS',
            detailsUrl: 'https://example.test/check/unrelated',
            startedAt: '2026-08-10T00:00:00Z',
            completedAt: '2026-08-10T00:01:00Z',
          },
        ],
      }),
    )
    await expect(
      getPullRequestSnapshot(
        'Chris0Jeky/developer-lens',
        236,
        { requiredCheck: 'Prove the pull request' },
        third.execute,
      ),
    ).rejects.toThrow('Required check was not observed: Prove the pull request.')

    const fourth = executorReturning(
      snapshotResponse({
        rollupState: 'PENDING',
        checks: [
          {
            __typename: 'CheckRun',
            name: 'Prove the pull request',
            status: 'COMPLETED',
            conclusion: 'SUCCESS',
            detailsUrl: 'https://example.test/check/required',
            startedAt: '2026-08-10T00:00:00Z',
            completedAt: '2026-08-10T00:01:00Z',
          },
          {
            __typename: 'CheckRun',
            name: 'Still running',
            status: 'IN_PROGRESS',
            conclusion: null,
            detailsUrl: 'https://example.test/check/pending',
            startedAt: '2026-08-10T00:00:00Z',
            completedAt: null,
          },
        ],
      }),
    )
    await expect(
      getPullRequestSnapshot(
        'Chris0Jeky/developer-lens',
        236,
        { requiredCheck: 'Prove the pull request' },
        fourth.execute,
      ),
    ).rejects.toThrow('GitHub check rollup is incomplete or not green.')

    const duplicate = executorReturning(
      snapshotResponse({
        checks: [
          {
            __typename: 'CheckRun',
            name: 'Prove the pull request',
            status: 'COMPLETED',
            conclusion: 'SKIPPED',
            detailsUrl: 'https://example.test/check/skipped',
            startedAt: '2026-08-10T00:00:00Z',
            completedAt: '2026-08-10T00:00:01Z',
          },
          {
            __typename: 'CheckRun',
            name: 'Prove the pull request',
            status: 'COMPLETED',
            conclusion: 'SUCCESS',
            detailsUrl: 'https://example.test/check/success',
            startedAt: '2026-08-10T00:00:02Z',
            completedAt: '2026-08-10T00:01:00Z',
          },
        ],
      }),
    )
    await expect(
      getPullRequestSnapshot(
        'Chris0Jeky/developer-lens',
        236,
        { requiredCheck: 'Prove the pull request' },
        duplicate.execute,
      ),
    ).resolves.toMatchObject({ checks: { rollupState: 'SUCCESS', completeAndGreen: true } })

    const failedRollup = executorReturning(snapshotResponse({ rollupState: 'FAILURE' }))
    await expect(
      getPullRequestSnapshot(
        'Chris0Jeky/developer-lens',
        236,
        { requiredCheck: 'Prove the pull request' },
        failedRollup.execute,
      ),
    ).rejects.toThrow('GitHub check rollup is incomplete or not green.')
  })

  it('rejects malformed repositories before making a request', async () => {
    const execute = vi.fn<GraphqlExecutor>()
    await expect(getPullRequestSnapshot('owner/repo; echo unsafe', 1, {}, execute)).rejects.toThrow(
      /owner\/name/,
    )
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('read-only command surface', () => {
  it('rejects write operations before calling GitHub', async () => {
    const execute = vi.fn<GraphqlExecutor>()
    await expect(
      runCli(
        ['reply', '--repo', 'Chris0Jeky/developer-lens', '--pr', '236', '--apply'],
        execute,
      ),
    ).rejects.toThrow('Unsupported operation: reply.')
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects mutation-shaped options on the snapshot command', () => {
    expect(() =>
      parseCommand([
        'snapshot',
        '--repo',
        'Chris0Jeky/developer-lens',
        '--pr',
        '236',
        '--body-stdin',
      ]),
    ).toThrow('Unsupported option: --body-stdin.')
  })
})
