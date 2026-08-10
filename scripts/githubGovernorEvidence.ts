import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { graphql } from '../server/gh.js'

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const SHA_PATTERN = /^[0-9a-f]{40}$/i
const THREAD_ID_PATTERN = /^[A-Za-z0-9_=-]+$/
const MAX_COMMENT_BYTES = 65_536

const SNAPSHOT_QUERY = /* GraphQL */ `
  query GovernorPullRequestSnapshot($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        number
        url
        state
        isDraft
        headRefOid
        baseRefOid
        mergeable
        mergeStateStatus
        updatedAt
        closingIssuesReferences(first: 100) {
          totalCount
          pageInfo { hasNextPage }
          nodes { number url }
        }
        commits(last: 1) {
          nodes {
            commit {
              oid
              statusCheckRollup {
                state
                contexts(first: 100) {
                  pageInfo { hasNextPage }
                  nodes {
                    __typename
                    ... on CheckRun {
                      name
                      status
                      conclusion
                      detailsUrl
                      startedAt
                      completedAt
                    }
                    ... on StatusContext {
                      context
                      state
                      targetUrl
                      createdAt
                    }
                  }
                }
              }
            }
          }
        }
        reviews(first: 100) {
          totalCount
          pageInfo { hasNextPage }
          nodes {
            state
            submittedAt
            author { login }
            commit { oid }
          }
        }
        reviewThreads(first: 100) {
          totalCount
          pageInfo { hasNextPage }
          nodes {
            id
            isResolved
            isOutdated
            comments(first: 100) {
              totalCount
              pageInfo { hasNextPage }
              nodes {
                id
                url
                createdAt
                author { login }
              }
            }
          }
        }
      }
    }
  }
`

const REPLY_MUTATION = /* GraphQL */ `
  mutation GovernorReviewThreadReply($threadId: ID!, $body: String!) {
    addPullRequestReviewThreadReply(
      input: { pullRequestReviewThreadId: $threadId, body: $body }
    ) {
      comment { id url }
    }
  }
`

const pageInfoSchema = z.object({ hasNextPage: z.boolean() })
const actorSchema = z.object({ login: z.string().min(1) }).nullable()
const checkRunSchema = z.object({
  __typename: z.literal('CheckRun'),
  name: z.string().min(1),
  status: z.string().min(1),
  conclusion: z.string().nullable(),
  detailsUrl: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
})
const statusContextSchema = z.object({
  __typename: z.literal('StatusContext'),
  context: z.string().min(1),
  state: z.string().min(1),
  targetUrl: z.string().nullable(),
  createdAt: z.string(),
})
const statusCheckRollupSchema = z
  .object({
    state: z.string().min(1),
    contexts: z.object({
      pageInfo: pageInfoSchema,
      nodes: z.array(z.discriminatedUnion('__typename', [checkRunSchema, statusContextSchema])),
    }),
  })
  .nullable()
const snapshotDataSchema = z.object({
  repository: z.object({
    pullRequest: z
      .object({
        number: z.number().int().positive(),
        url: z.string().url(),
        state: z.string().min(1),
        isDraft: z.boolean(),
        headRefOid: z.string().regex(SHA_PATTERN),
        baseRefOid: z.string().regex(SHA_PATTERN),
        mergeable: z.string().min(1),
        mergeStateStatus: z.string().min(1),
        updatedAt: z.string(),
        closingIssuesReferences: z.object({
          totalCount: z.number().int().nonnegative(),
          pageInfo: pageInfoSchema,
          nodes: z.array(
            z.object({ number: z.number().int().positive(), url: z.string().url() }),
          ),
        }),
        commits: z.object({
          nodes: z.array(
            z.object({
              commit: z.object({
                oid: z.string().regex(SHA_PATTERN),
                statusCheckRollup: statusCheckRollupSchema,
              }),
            }),
          ),
        }),
        reviews: z.object({
          totalCount: z.number().int().nonnegative(),
          pageInfo: pageInfoSchema,
          nodes: z.array(
            z.object({
              state: z.string().min(1),
              submittedAt: z.string().nullable(),
              author: actorSchema,
              commit: z.object({ oid: z.string().regex(SHA_PATTERN) }).nullable(),
            }),
          ),
        }),
        reviewThreads: z.object({
          totalCount: z.number().int().nonnegative(),
          pageInfo: pageInfoSchema,
          nodes: z.array(
            z.object({
              id: z.string().min(1),
              isResolved: z.boolean(),
              isOutdated: z.boolean(),
              comments: z.object({
                totalCount: z.number().int().nonnegative(),
                pageInfo: pageInfoSchema,
                nodes: z.array(
                  z.object({
                    id: z.string().min(1),
                    url: z.string().url(),
                    createdAt: z.string(),
                    author: actorSchema,
                  }),
                ),
              }),
            }),
          ),
        }),
      })
      .nullable(),
  }),
})
const replyDataSchema = z.object({
  addPullRequestReviewThreadReply: z.object({
    comment: z.object({ id: z.string().min(1), url: z.string().url() }),
  }),
})

export type GraphqlExecutor = (
  query: string,
  variables: Record<string, unknown>,
) => Promise<unknown>

export interface SnapshotRequirements {
  expectHead?: string
  expectBase?: string
  requireGreen?: boolean
  requireNoUnresolved?: boolean
  requireNoClosingIssues?: boolean
}

export interface PullRequestSnapshot {
  schemaVersion: 1
  observedAt: string
  repository: string
  pullRequest: {
    number: number
    url: string
    state: string
    isDraft: boolean
    headRefOid: string
    baseRefOid: string
    mergeable: string
    mergeStateStatus: string
    updatedAt: string
  }
  checks: {
    rollupState: string | null
    completeAndGreen: boolean
    nodes: Array<
      | {
          kind: 'check-run'
          name: string
          status: string
          conclusion: string | null
          url: string | null
        }
      | {
          kind: 'status-context'
          name: string
          state: string
          url: string | null
        }
    >
  }
  reviews: {
    totalCount: number
    nodes: Array<{
      author: string | null
      state: string
      submittedAt: string | null
      commitOid: string | null
    }>
  }
  reviewThreads: {
    totalCount: number
    unresolvedCount: number
    nodes: Array<{
      id: string
      isResolved: boolean
      isOutdated: boolean
      commentCount: number
      latestCommentAt: string | null
      latestCommentUrl: string | null
      latestCommentAuthor: string | null
    }>
  }
  closingIssues: Array<{ number: number; url: string }>
  coverage: { complete: true }
}

const defaultExecutor: GraphqlExecutor = async (query, variables) =>
  await graphql<unknown>(query, variables)

function splitRepository(repository: string): { owner: string; name: string } {
  if (!REPOSITORY_PATTERN.test(repository)) {
    throw new Error('Repository must use the owner/name form.')
  }
  const [owner, name] = repository.split('/')
  if (!owner || !name) {
    throw new Error('Repository must use the owner/name form.')
  }
  return { owner, name }
}

function requireCompleteConnection(label: string, hasNextPage: boolean): void {
  if (hasNextPage) {
    throw new Error(`${label} exceeded the 100-item evidence bound; snapshot is incomplete.`)
  }
}

function latestComment(
  comments: Array<{ createdAt: string; url: string; author: { login: string } | null }>,
): { createdAt: string; url: string; author: string | null } | null {
  return (
    comments
      .map((comment) => ({
        createdAt: comment.createdAt,
        url: comment.url,
        author: comment.author?.login ?? null,
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  )
}

function enforceRequirements(
  snapshot: PullRequestSnapshot,
  requirements: SnapshotRequirements,
): void {
  if (requirements.expectHead && snapshot.pullRequest.headRefOid !== requirements.expectHead) {
    throw new Error(
      `Head mismatch: expected ${requirements.expectHead}, observed ${snapshot.pullRequest.headRefOid}.`,
    )
  }
  if (requirements.expectBase && snapshot.pullRequest.baseRefOid !== requirements.expectBase) {
    throw new Error(
      `Base mismatch: expected ${requirements.expectBase}, observed ${snapshot.pullRequest.baseRefOid}.`,
    )
  }
  if (requirements.requireGreen && !snapshot.checks.completeAndGreen) {
    throw new Error('Required checks are missing, incomplete, or not green.')
  }
  if (requirements.requireNoUnresolved && snapshot.reviewThreads.unresolvedCount !== 0) {
    throw new Error(
      `Expected zero unresolved review threads, observed ${snapshot.reviewThreads.unresolvedCount}.`,
    )
  }
  if (requirements.requireNoClosingIssues && snapshot.closingIssues.length !== 0) {
    throw new Error(
      `Expected zero closing issue references, observed ${snapshot.closingIssues.length}.`,
    )
  }
}

export async function getPullRequestSnapshot(
  repository: string,
  pullRequestNumber: number,
  requirements: SnapshotRequirements = {},
  execute: GraphqlExecutor = defaultExecutor,
  now: () => Date = () => new Date(),
): Promise<PullRequestSnapshot> {
  if (!Number.isSafeInteger(pullRequestNumber) || pullRequestNumber <= 0) {
    throw new Error('Pull request number must be a positive integer.')
  }
  for (const [label, sha] of [
    ['Expected head', requirements.expectHead],
    ['Expected base', requirements.expectBase],
  ] as const) {
    if (sha && !SHA_PATTERN.test(sha)) {
      throw new Error(`${label} must be a full 40-character commit SHA.`)
    }
  }

  const { owner, name } = splitRepository(repository)
  const parsed = snapshotDataSchema.parse(
    await execute(SNAPSHOT_QUERY, { owner, name, number: pullRequestNumber }),
  )
  const pullRequest = parsed.repository.pullRequest
  if (!pullRequest) {
    throw new Error(`Pull request ${repository}#${pullRequestNumber} was not found.`)
  }

  requireCompleteConnection(
    'Closing issue references',
    pullRequest.closingIssuesReferences.pageInfo.hasNextPage,
  )
  requireCompleteConnection('Reviews', pullRequest.reviews.pageInfo.hasNextPage)
  requireCompleteConnection('Review threads', pullRequest.reviewThreads.pageInfo.hasNextPage)
  for (const thread of pullRequest.reviewThreads.nodes) {
    requireCompleteConnection(`Comments for review thread ${thread.id}`, thread.comments.pageInfo.hasNextPage)
  }

  const commit = pullRequest.commits.nodes[0]?.commit
  if (!commit || commit.oid !== pullRequest.headRefOid) {
    throw new Error('Pull request head commit evidence is missing or inconsistent.')
  }
  if (commit.statusCheckRollup) {
    requireCompleteConnection(
      'Status checks',
      commit.statusCheckRollup.contexts.pageInfo.hasNextPage,
    )
  }

  const checks =
    commit.statusCheckRollup?.contexts.nodes.map((check) =>
      check.__typename === 'CheckRun'
        ? {
            kind: 'check-run' as const,
            name: check.name,
            status: check.status,
            conclusion: check.conclusion,
            url: check.detailsUrl,
          }
        : {
            kind: 'status-context' as const,
            name: check.context,
            state: check.state,
            url: check.targetUrl,
          },
    ) ?? []
  const completeAndGreen =
    checks.length > 0 &&
    checks.every((check) =>
      check.kind === 'check-run'
        ? check.status === 'COMPLETED' && check.conclusion === 'SUCCESS'
        : check.state === 'SUCCESS',
    )

  const snapshot: PullRequestSnapshot = {
    schemaVersion: 1,
    observedAt: now().toISOString(),
    repository,
    pullRequest: {
      number: pullRequest.number,
      url: pullRequest.url,
      state: pullRequest.state,
      isDraft: pullRequest.isDraft,
      headRefOid: pullRequest.headRefOid,
      baseRefOid: pullRequest.baseRefOid,
      mergeable: pullRequest.mergeable,
      mergeStateStatus: pullRequest.mergeStateStatus,
      updatedAt: pullRequest.updatedAt,
    },
    checks: {
      rollupState: commit.statusCheckRollup?.state ?? null,
      completeAndGreen,
      nodes: checks,
    },
    reviews: {
      totalCount: pullRequest.reviews.totalCount,
      nodes: pullRequest.reviews.nodes.map((review) => ({
        author: review.author?.login ?? null,
        state: review.state,
        submittedAt: review.submittedAt,
        commitOid: review.commit?.oid ?? null,
      })),
    },
    reviewThreads: {
      totalCount: pullRequest.reviewThreads.totalCount,
      unresolvedCount: pullRequest.reviewThreads.nodes.filter((thread) => !thread.isResolved).length,
      nodes: pullRequest.reviewThreads.nodes.map((thread) => {
        const latest = latestComment(thread.comments.nodes)
        return {
          id: thread.id,
          isResolved: thread.isResolved,
          isOutdated: thread.isOutdated,
          commentCount: thread.comments.totalCount,
          latestCommentAt: latest?.createdAt ?? null,
          latestCommentUrl: latest?.url ?? null,
          latestCommentAuthor: latest?.author ?? null,
        }
      }),
    },
    closingIssues: pullRequest.closingIssuesReferences.nodes,
    coverage: { complete: true },
  }
  enforceRequirements(snapshot, requirements)
  return snapshot
}

export async function replyToReviewThread(
  input: {
    repository: string
    pullRequestNumber: number
    threadId: string
    body: string
    apply: boolean
    expectHead: string
    expectBase: string
  },
  execute: GraphqlExecutor = defaultExecutor,
): Promise<{
  repository: string
  pullRequestNumber: number
  threadId: string
  comment: { id: string; url: string }
}> {
  if (!input.apply) {
    throw new Error('Review-thread replies require the explicit --apply flag.')
  }
  if (!THREAD_ID_PATTERN.test(input.threadId)) {
    throw new Error('Review thread ID contains unsupported characters.')
  }
  const bodyBytes = Buffer.byteLength(input.body, 'utf8')
  if (input.body.trim().length === 0 || bodyBytes > MAX_COMMENT_BYTES || input.body.includes('\0')) {
    throw new Error('Reply body must be non-empty UTF-8 text of at most 65536 bytes without NUL.')
  }

  const snapshot = await getPullRequestSnapshot(
    input.repository,
    input.pullRequestNumber,
    { expectHead: input.expectHead, expectBase: input.expectBase },
    execute,
  )
  if (!snapshot.reviewThreads.nodes.some((thread) => thread.id === input.threadId)) {
    throw new Error('Review thread does not belong to the specified pull request snapshot.')
  }

  const parsed = replyDataSchema.parse(
    await execute(REPLY_MUTATION, { threadId: input.threadId, body: input.body }),
  )
  return {
    repository: input.repository,
    pullRequestNumber: input.pullRequestNumber,
    threadId: input.threadId,
    comment: parsed.addPullRequestReviewThreadReply.comment,
  }
}

type ParsedCommand =
  | {
      kind: 'snapshot'
      repository: string
      pullRequestNumber: number
      requirements: SnapshotRequirements
    }
  | {
      kind: 'reply'
      repository: string
      pullRequestNumber: number
      threadId: string
      apply: boolean
      bodyFromStdin: boolean
      expectHead: string
      expectBase: string
    }

function parsePositiveInteger(value: string | undefined, label: string): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${label} must be a positive integer.`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`)
  }
  return parsed
}

export function parseCommand(argv: string[]): ParsedCommand {
  const tokens = [...argv]
  const kind = tokens[0] && !tokens[0].startsWith('--') ? tokens.shift() : 'snapshot'
  if (kind !== 'snapshot' && kind !== 'reply') {
    throw new Error(`Unsupported operation: ${kind ?? ''}.`)
  }

  const values = new Map<string, string>()
  const booleans = new Set<string>()
  const booleanNames = new Set([
    '--apply',
    '--body-stdin',
    '--require-green',
    '--require-no-unresolved',
    '--require-no-closing-issues',
  ])
  const valueNames = new Set(['--repo', '--pr', '--thread', '--expect-head', '--expect-base'])
  while (tokens.length > 0) {
    const name = tokens.shift()
    if (!name || (!booleanNames.has(name) && !valueNames.has(name))) {
      throw new Error(`Unsupported option: ${name ?? ''}.`)
    }
    if (values.has(name) || booleans.has(name)) {
      throw new Error(`Duplicate option: ${name}.`)
    }
    if (booleanNames.has(name)) {
      booleans.add(name)
      continue
    }
    const value = tokens.shift()
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${name}.`)
    }
    values.set(name, value)
  }

  const repository = values.get('--repo') ?? ''
  splitRepository(repository)
  const pullRequestNumber = parsePositiveInteger(values.get('--pr'), '--pr')
  if (kind === 'reply') {
    for (const unsupported of [
      '--require-green',
      '--require-no-unresolved',
      '--require-no-closing-issues',
    ]) {
      if (values.has(unsupported) || booleans.has(unsupported)) {
        throw new Error(`${unsupported} is only valid for snapshot.`)
      }
    }
    const threadId = values.get('--thread') ?? ''
    if (!THREAD_ID_PATTERN.test(threadId)) {
      throw new Error('Review thread ID contains unsupported characters.')
    }
    const expectHead = values.get('--expect-head') ?? ''
    const expectBase = values.get('--expect-base') ?? ''
    for (const [label, sha] of [
      ['--expect-head', expectHead],
      ['--expect-base', expectBase],
    ] as const) {
      if (!SHA_PATTERN.test(sha)) {
        throw new Error(`${label} is required and must be a full 40-character commit SHA.`)
      }
    }
    return {
      kind,
      repository,
      pullRequestNumber,
      threadId,
      apply: booleans.has('--apply'),
      bodyFromStdin: booleans.has('--body-stdin'),
      expectHead,
      expectBase,
    }
  }

  for (const unsupported of ['--thread', '--apply', '--body-stdin']) {
    if (values.has(unsupported) || booleans.has(unsupported)) {
      throw new Error(`${unsupported} is only valid for reply.`)
    }
  }
  return {
    kind,
    repository,
    pullRequestNumber,
    requirements: {
      expectHead: values.get('--expect-head'),
      expectBase: values.get('--expect-base'),
      requireGreen: booleans.has('--require-green'),
      requireNoUnresolved: booleans.has('--require-no-unresolved'),
      requireNoClosingIssues: booleans.has('--require-no-closing-issues'),
    },
  }
}

async function readStandardInput(): Promise<string> {
  process.stdin.setEncoding('utf8')
  let value = ''
  for await (const chunk of process.stdin) {
    value += chunk
  }
  return value
}

export async function runCli(
  argv: string[],
  execute: GraphqlExecutor = defaultExecutor,
  readInput: () => Promise<string> = readStandardInput,
): Promise<unknown> {
  const command = parseCommand(argv)
  if (command.kind === 'snapshot') {
    return await getPullRequestSnapshot(
      command.repository,
      command.pullRequestNumber,
      command.requirements,
      execute,
    )
  }
  if (!command.bodyFromStdin) {
    throw new Error('Review-thread replies require --body-stdin; inline bodies are not accepted.')
  }
  if (!command.apply) {
    throw new Error('Review-thread replies require the explicit --apply flag.')
  }
  return await replyToReviewThread(
    {
      repository: command.repository,
      pullRequestNumber: command.pullRequestNumber,
      threadId: command.threadId,
      body: await readInput(),
      apply: command.apply,
      expectHead: command.expectHead,
      expectBase: command.expectBase,
    },
    execute,
  )
}

async function main(): Promise<void> {
  try {
    const result = await runCli(process.argv.slice(2))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } catch (error) {
    const message = error instanceof z.ZodError ? 'GitHub returned an unexpected response shape.' : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
