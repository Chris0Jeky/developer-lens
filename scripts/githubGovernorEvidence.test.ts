import { describe, expect, it, vi } from 'vitest'
import {
  getPullRequestSnapshot,
  parseCommand,
  replyToReviewThread,
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
    threadPage?: boolean
    commentPage?: boolean
    unresolved?: boolean
    closingIssues?: Array<{ number: number; url: string }>
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
                  state: 'SUCCESS',
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
        requireGreen: true,
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

  it('rejects mismatched exact heads and missing successful checks', async () => {
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
        { requireGreen: true },
        second.execute,
      ),
    ).rejects.toThrow(/missing, incomplete, or not green/)
  })

  it('rejects malformed repositories before making a request', async () => {
    const execute = vi.fn<GraphqlExecutor>()
    await expect(getPullRequestSnapshot('owner/repo; echo unsafe', 1, {}, execute)).rejects.toThrow(
      /owner\/name/,
    )
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('review-thread reply', () => {
  const hostileBody = `Line one with 'single' and "double" quotes.
$env:TEMP; $(Write-Output unsafe-looking)
Unicode stays UTF-8: café.`

  it('requires explicit apply before reading stdin or calling GitHub', async () => {
    const execute = vi.fn<GraphqlExecutor>()
    const readInput = vi.fn(async () => hostileBody)

    await expect(
      runCli(
        [
          'reply',
          '--repo',
          'Chris0Jeky/developer-lens',
          '--pr',
          '236',
          '--thread',
          THREAD_ID,
          '--expect-head',
          HEAD,
          '--expect-base',
          BASE,
          '--body-stdin',
        ],
        execute,
        readInput,
      ),
    ).rejects.toThrow(/explicit --apply/)
    expect(readInput).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('passes multiline hostile text only as a GraphQL variable and validates the returned URL', async () => {
    const { execute, calls } = executorReturning(snapshotResponse(), {
      addPullRequestReviewThreadReply: {
        comment: { id: 'reply-1', url: 'https://example.test/comment/reply-1' },
      },
    })

    const result = await replyToReviewThread(
      {
        repository: 'Chris0Jeky/developer-lens',
        pullRequestNumber: 236,
        threadId: THREAD_ID,
        body: hostileBody,
        apply: true,
        expectHead: HEAD,
        expectBase: BASE,
      },
      execute,
    )

    expect(calls).toHaveLength(2)
    expect(calls[1]?.variables).toEqual({ threadId: THREAD_ID, body: hostileBody })
    expect(calls[1]?.query).not.toContain(hostileBody)
    expect(result.comment).toEqual({
      id: 'reply-1',
      url: 'https://example.test/comment/reply-1',
    })
  })

  it('fails when the thread is absent from the bounded PR snapshot', async () => {
    const response = snapshotResponse() as {
      repository: { pullRequest: { reviewThreads: { nodes: unknown[]; totalCount: number } } }
    }
    response.repository.pullRequest.reviewThreads.nodes = []
    response.repository.pullRequest.reviewThreads.totalCount = 0
    const { execute } = executorReturning(response)

    await expect(
      replyToReviewThread(
        {
          repository: 'Chris0Jeky/developer-lens',
          pullRequestNumber: 236,
          threadId: THREAD_ID,
          body: 'Safe body',
          apply: true,
          expectHead: HEAD,
          expectBase: BASE,
        },
        execute,
      ),
    ).rejects.toThrow(/does not belong/)
  })

  it('fails closed on an unexpected mutation response', async () => {
    const { execute } = executorReturning(snapshotResponse(), {
      addPullRequestReviewThreadReply: { comment: { id: 'reply-1' } },
    })
    await expect(
      replyToReviewThread(
        {
          repository: 'Chris0Jeky/developer-lens',
          pullRequestNumber: 236,
          threadId: THREAD_ID,
          body: 'Safe body',
          apply: true,
          expectHead: HEAD,
          expectBase: BASE,
        },
        execute,
      ),
    ).rejects.toThrow()
  })

  it('does not accept inline or file body channels', () => {
    expect(() =>
      parseCommand([
        'reply',
        '--repo',
        'Chris0Jeky/developer-lens',
        '--pr',
        '236',
        '--thread',
        THREAD_ID,
        '--body-file',
        'comment.md',
        '--apply',
      ]),
    ).toThrow(/Unsupported option: --body-file/)
  })

  it('rejects a missing thread ID before any stdin read', async () => {
    const execute = vi.fn<GraphqlExecutor>()
    const readInput = vi.fn(async () => 'Safe body')
    await expect(
      runCli(
        [
          'reply',
          '--repo',
          'Chris0Jeky/developer-lens',
          '--pr',
          '236',
          '--apply',
          '--body-stdin',
        ],
        execute,
        readInput,
      ),
    ).rejects.toThrow(/thread ID/i)
    expect(readInput).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })
})
