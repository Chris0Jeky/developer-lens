import type {
  CoverageSource,
  RangeKey,
  RawCommit,
  RawDataset,
  RawDatedRepositoryEvent,
  RawPullRequest,
  RawRepository,
} from '../shared/types.js'
import { ghJson, graphql, runGh } from './gh.js'

interface GraphPageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

interface RepositoryNode {
  id: string
  nameWithOwner: string
  name: string
  url?: string
  description?: string | null
  isPrivate: boolean
  isArchived: boolean
  isFork: boolean
  pushedAt?: string | null
  primaryLanguage?: { name: string; color?: string | null } | null
  languages?: {
    edges: Array<{
      size: number
      node: { name: string; color?: string | null }
    }>
  }
  repositoryTopics?: {
    nodes: Array<{ topic: { name: string } }>
  }
}

interface PullRequestNode {
  id: string
  number: number
  title: string
  url: string
  createdAt: string
  mergedAt?: string | null
  closedAt?: string | null
  state: string
  isDraft: boolean
  additions?: number
  deletions?: number
  changedFiles?: number
  comments: { totalCount: number }
  reviews: { totalCount: number }
  repository: RepositoryNode
}

interface ContributionRoot {
  viewer: {
    login: string
    name?: string | null
    avatarUrl?: string
    contributionsCollection: {
      restrictedContributionsCount: number
      contributionCalendar: {
        totalContributions: number
        weeks: Array<{
          contributionDays: Array<{
            date: string
            contributionCount: number
          }>
        }>
      }
      commitContributionsByRepository: Array<{
        repository: RepositoryNode
        contributions: {
          nodes: Array<{ occurredAt: string; commitCount: number }>
          pageInfo: GraphPageInfo
        }
      }>
    }
  }
}

interface RestCommit {
  sha: string
  commit: {
    message: string
    author?: { date?: string | null } | null
    committer?: { date?: string | null } | null
  }
  parents?: Array<{ sha: string }>
}

interface RestRepository {
  node_id: string
  full_name: string
  name: string
  html_url: string
  description?: string | null
  private: boolean
  archived: boolean
  fork: boolean
  pushed_at?: string | null
  language?: string | null
  topics?: string[]
}

const REPOSITORY_FRAGMENT = `
  fragment DeveloperLensRepository on Repository {
    id
    nameWithOwner
    name
    url
    description
    isPrivate
    isArchived
    isFork
    pushedAt
    primaryLanguage { name color }
    languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
      edges { size node { name color } }
    }
    repositoryTopics(first: 10) {
      nodes { topic { name } }
    }
  }
`

const CONTRIBUTION_QUERY = `
  query DeveloperLensContributions($from: DateTime!, $to: DateTime!) {
    viewer {
      login
      name
      avatarUrl
      contributionsCollection(from: $from, to: $to) {
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays { date contributionCount }
          }
        }
        commitContributionsByRepository(maxRepositories: 100) {
          repository { ...DeveloperLensRepository }
          contributions(first: 100) {
            nodes { occurredAt commitCount }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  }
  ${REPOSITORY_FRAGMENT}
`

const PULL_REQUEST_QUERY = `
  query DeveloperLensPullRequests(
    $from: DateTime!
    $to: DateTime!
    $after: String
  ) {
    viewer {
      contributionsCollection(from: $from, to: $to) {
        pullRequestContributions(
          first: 100
          after: $after
          orderBy: { direction: DESC }
        ) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            occurredAt
            pullRequest {
              id
              number
              title
              url
              createdAt
              mergedAt
              closedAt
              state
              isDraft
              additions
              deletions
              changedFiles
              comments { totalCount }
              reviews { totalCount }
              repository { ...DeveloperLensRepository }
            }
          }
        }
      }
    }
  }
  ${REPOSITORY_FRAGMENT}
`

const REVIEW_QUERY = `
  query DeveloperLensReviews(
    $from: DateTime!
    $to: DateTime!
    $after: String
  ) {
    viewer {
      contributionsCollection(from: $from, to: $to) {
        pullRequestReviewContributions(
          first: 100
          after: $after
          orderBy: { direction: DESC }
        ) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            occurredAt
            pullRequestReview { id }
            pullRequest {
              id
              number
              repository { ...DeveloperLensRepository }
            }
          }
        }
      }
    }
  }
  ${REPOSITORY_FRAGMENT}
`

const ISSUE_QUERY = `
  query DeveloperLensIssues(
    $from: DateTime!
    $to: DateTime!
    $after: String
  ) {
    viewer {
      contributionsCollection(from: $from, to: $to) {
        issueContributions(
          first: 100
          after: $after
          orderBy: { direction: DESC }
        ) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            occurredAt
            issue {
              id
              number
              repository { ...DeveloperLensRepository }
            }
          }
        }
      }
    }
  }
  ${REPOSITORY_FRAGMENT}
`

const SEARCH_PULL_REQUESTS_QUERY = `
  query DeveloperLensSearchPullRequests($query: String!, $after: String) {
    search(query: $query, type: ISSUE, first: 100, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on PullRequest {
          id
          number
          title
          url
          createdAt
          mergedAt
          closedAt
          state
          isDraft
          additions
          deletions
          changedFiles
          comments { totalCount }
          reviews { totalCount }
          repository {
            id nameWithOwner name url description isPrivate isArchived isFork pushedAt
            primaryLanguage { name color }
          }
        }
      }
    }
  }
`

const SEARCH_ISSUES_QUERY = `
  query DeveloperLensSearchIssues($query: String!, $after: String) {
    search(query: $query, type: ISSUE, first: 100, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on Issue {
          id
          number
          createdAt
          repository {
            id nameWithOwner name url description isPrivate isArchived isFork pushedAt
            primaryLanguage { name color }
          }
        }
      }
    }
  }
`

const SEARCH_REVIEWS_QUERY = `
  query DeveloperLensSearchReviews($query: String!, $after: String) {
    search(query: $query, type: ISSUE, first: 25, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on PullRequest {
          id
          number
          repository {
            id nameWithOwner name url description isPrivate isArchived isFork pushedAt
            primaryLanguage { name color }
          }
          reviews(first: 100) {
            totalCount
            pageInfo { hasNextPage }
            nodes { id submittedAt author { login } }
          }
        }
      }
    }
  }
`

function toRepository(node: RepositoryNode): RawRepository {
  return {
    id: node.id,
    nameWithOwner: node.nameWithOwner,
    name: node.name,
    url: node.url,
    description: node.description ?? undefined,
    isPrivate: node.isPrivate,
    isArchived: node.isArchived,
    isFork: node.isFork,
    pushedAt: node.pushedAt ?? undefined,
    primaryLanguage: node.primaryLanguage
      ? {
          name: node.primaryLanguage.name,
          color: node.primaryLanguage.color ?? undefined,
        }
      : undefined,
    languages: (node.languages?.edges ?? []).map((edge) => ({
      name: edge.node.name,
      color: edge.node.color ?? undefined,
      size: edge.size,
    })),
    topics: (node.repositoryTopics?.nodes ?? []).map(
      (item) => item.topic.name,
    ),
  }
}

function fromRestRepository(repository: RestRepository): RawRepository {
  return {
    id: repository.node_id,
    nameWithOwner: repository.full_name,
    name: repository.name,
    url: repository.html_url,
    description: repository.description ?? undefined,
    isPrivate: repository.private,
    isArchived: repository.archived,
    isFork: repository.fork,
    pushedAt: repository.pushed_at ?? undefined,
    primaryLanguage: repository.language
      ? {
          name: repository.language,
          color: undefined,
        }
      : undefined,
    // REST exposes only a primary-language label, not byte composition. Keep
    // this empty so it can never overwrite richer GraphQL language edges.
    languages: [],
    topics: repository.topics ?? [],
  }
}

export function mergeRepositoryData(
  existing: RawRepository,
  repository: RawRepository,
): RawRepository {
  return {
    ...existing,
    ...repository,
    description: repository.description ?? existing.description,
    primaryLanguage: repository.primaryLanguage ?? existing.primaryLanguage,
    languages:
      repository.languages.length > 0 ? repository.languages : existing.languages,
    topics: repository.topics.length > 0 ? repository.topics : existing.topics,
  }
}

function setRepository(
  repositories: Map<string, RawRepository>,
  repository: RawRepository,
): void {
  const existing = repositories.get(repository.nameWithOwner)
  repositories.set(
    repository.nameWithOwner,
    existing ? mergeRepositoryData(existing, repository) : repository,
  )
}

export function classifyCommit(message: string): RawCommit['features'] {
  const subject = message.split(/\r?\n/, 1)[0].trim()
  const conventionalMatch = subject.match(
    /^(feat|fix|docs|test|refactor|perf|build|ci|chore|revert)(?:\([^)]+\))?[!:]/i,
  )
  const lower = subject.toLowerCase()

  let type = conventionalMatch?.[1]?.toLowerCase() ?? 'other'
  if (type === 'other') {
    if (/\b(test|spec|coverage)\b/.test(lower)) type = 'test'
    else if (/\b(doc|readme|guide|copy)\b/.test(lower)) type = 'docs'
    else if (/\b(fix|bug|repair|correct|guard)\b/.test(lower)) type = 'fix'
    else if (/\b(refactor|cleanup|simplif|extract)\b/.test(lower))
      type = 'refactor'
    else if (/\b(add|create|implement|support|feature)\b/.test(lower)) type = 'feat'
    else if (/\b(ci|workflow|release|depend|config|chore)\b/.test(lower))
      type = 'chore'
  }

  return {
    type,
    isRevert: /^revert\b/i.test(subject),
    isFixup: /^(fixup!|squash!)/i.test(subject),
    subjectLength: subject.length,
  }
}

export function dedupeDatedEvents(
  events: RawDatedRepositoryEvent[],
): RawDatedRepositoryEvent[] {
  return [...new Map(events.map((event) => [event.id, event])).values()]
}

export function contributionCoverageStatus(
  restrictedContributions: number,
): CoverageSource['status'] {
  return restrictedContributions > 0 ? 'partial' : 'complete'
}

async function paginateConnection<TNode>(
  query: string,
  connectionName:
    | 'pullRequestContributions'
    | 'pullRequestReviewContributions'
    | 'issueContributions',
  from: string,
  to: string,
): Promise<TNode[]> {
  let after: string | null = null
  const nodes: TNode[] = []

  do {
    const page: {
      viewer: {
        contributionsCollection: Record<
          typeof connectionName,
          { nodes: TNode[]; pageInfo: GraphPageInfo }
        >
      }
    } = await graphql(query, { from, to, after })

    const connection = page.viewer.contributionsCollection[connectionName]
    nodes.push(...connection.nodes)
    after = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null
  } while (after)

  return nodes
}

async function paginateSearch<TNode>(
  query: string,
  searchQuery: string,
  pageSize: 25 | 100,
): Promise<{ nodes: TNode[]; totalCount: number; truncated: boolean }> {
  let after: string | null = null
  const nodes: TNode[] = []
  let totalCount = 0

  do {
    const page: {
      search: {
        issueCount: number
        nodes: Array<TNode | null>
        pageInfo: GraphPageInfo
      }
    } = await graphql(query, { query: searchQuery, after })
    totalCount = page.search.issueCount
    nodes.push(...page.search.nodes.filter((node): node is TNode => node !== null))
    after = page.search.pageInfo.hasNextPage
      ? page.search.pageInfo.endCursor
      : null
    if (nodes.length >= 1_000) after = null
  } while (after)

  return {
    nodes,
    totalCount,
    truncated: totalCount > nodes.length && nodes.length >= Math.min(1_000, pageSize),
  }
}

async function fetchAccessibleRepositories(from: string): Promise<RawRepository[]> {
  const pages = await ghJson<RestRepository[][]>([
    'api',
    '--method',
    'GET',
    '--paginate',
    '--slurp',
    'user/repos',
    '-f',
    'affiliation=owner,collaborator,organization_member',
    '-f',
    'visibility=all',
    '-f',
    'sort=pushed',
    '-f',
    'direction=desc',
    '-f',
    'per_page=100',
  ])
  const cutoff = Date.parse(from)
  return pages
    .flat()
    .filter(
      (repository) =>
        repository.pushed_at && Date.parse(repository.pushed_at) >= cutoff,
    )
    .map(fromRestRepository)
}

async function mapWithLimit<T, TResult>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<TResult>,
): Promise<Array<PromiseSettledResult<TResult>>> {
  const results: Array<PromiseSettledResult<TResult>> = new Array(items.length)
  let cursor = 0

  async function runWorker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      try {
        results[index] = {
          status: 'fulfilled',
          value: await worker(items[index]),
        }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  )
  return results
}

async function fetchRepositoryCommits(
  repository: string,
  login: string,
  from: string,
  to: string,
): Promise<RawCommit[]> {
  const pages = await ghJson<RestCommit[][]>([
    'api',
    '--method',
    'GET',
    '--paginate',
    '--slurp',
    `repos/${repository}/commits`,
    '-f',
    `author=${login}`,
    '-f',
    `since=${from}`,
    '-f',
    `until=${to}`,
    '-f',
    'per_page=100',
  ])

  return pages.flat().map((item) => {
    const occurredAt =
      item.commit.author?.date ?? item.commit.committer?.date ?? from
    return {
      sha: item.sha,
      repository,
      occurredAt,
      source: 'github',
      parentCount: item.parents?.length,
      features: classifyCommit(item.commit.message),
    }
  })
}

export async function collectGithub(
  range: RangeKey,
  from: string,
  to: string,
): Promise<RawDataset> {
  await runGh(['auth', 'status'])

  const [contributionRoot, accessibleRepositories] = await Promise.all([
    graphql<ContributionRoot>(CONTRIBUTION_QUERY, { from, to }),
    fetchAccessibleRepositories(from),
  ])
  const collection = contributionRoot.viewer.contributionsCollection
  const repositories = new Map<string, RawRepository>()
  const coverage: CoverageSource[] = []
  const warnings: string[] = []

  const contributionCalendar = collection.contributionCalendar.weeks.flatMap(
    (week) =>
      week.contributionDays.map((day) => ({
        date: day.date,
        count: day.contributionCount,
      })),
  )

  const commitDaysByRepository = collection.commitContributionsByRepository.flatMap(
    (item) => {
      setRepository(repositories, toRepository(item.repository))
      if (item.contributions.pageInfo.hasNextPage) {
        warnings.push(
          `${item.repository.nameWithOwner}: GitHub grouped more than 100 active commit days; per-repository commit fetching is used for detail.`,
        )
      }
      return item.contributions.nodes.map((node) => ({
        repository: item.repository.nameWithOwner,
        date: node.occurredAt.slice(0, 10),
        count: node.commitCount,
      }))
    },
  )

  const searchFrom = from.slice(0, 10)
  const searchTo = to.slice(0, 10)
  const login = contributionRoot.viewer.login
  const [
    pullRequestNodes,
    reviewNodes,
    issueNodes,
    searchedPullRequests,
    searchedReviews,
    searchedIssues,
  ] = await Promise.all([
    paginateConnection<{ occurredAt: string; pullRequest: PullRequestNode }>(
      PULL_REQUEST_QUERY,
      'pullRequestContributions',
      from,
      to,
    ),
    paginateConnection<{
      occurredAt: string
      pullRequestReview: { id: string }
      pullRequest: { id: string; number: number; repository: RepositoryNode }
    }>(
      REVIEW_QUERY,
      'pullRequestReviewContributions',
      from,
      to,
    ),
    paginateConnection<{
      occurredAt: string
      issue: { id: string; number: number; repository: RepositoryNode }
    }>(ISSUE_QUERY, 'issueContributions', from, to),
    paginateSearch<PullRequestNode>(
      SEARCH_PULL_REQUESTS_QUERY,
      `is:pr author:${login} created:${searchFrom}..${searchTo}`,
      100,
    ),
    paginateSearch<{
      id: string
      number: number
      repository: RepositoryNode
      reviews: {
        totalCount: number
        pageInfo: { hasNextPage: boolean }
        nodes: Array<{
          id: string
          submittedAt?: string | null
          author?: { login: string } | null
        }>
      }
    }>(
      SEARCH_REVIEWS_QUERY,
      `is:pr reviewed-by:${login} updated:>=${searchFrom}`,
      25,
    ),
    paginateSearch<{
      id: string
      number: number
      createdAt: string
      repository: RepositoryNode
    }>(
      SEARCH_ISSUES_QUERY,
      `is:issue author:${login} created:${searchFrom}..${searchTo}`,
      100,
    ),
  ])
  let privateSearchPartial =
    searchedPullRequests.truncated || searchedReviews.truncated || searchedIssues.truncated

  const combinedPullRequestNodes = new Map<string, PullRequestNode>()
  for (const node of pullRequestNodes) {
    combinedPullRequestNodes.set(node.pullRequest.id, node.pullRequest)
  }
  for (const node of searchedPullRequests.nodes) {
    combinedPullRequestNodes.set(node.id, node)
  }
  if (searchedPullRequests.truncated) {
    warnings.push(
      `GitHub search capped authored pull-request detail at 1,000 results; contribution totals retain the larger public count.`,
    )
  }

  const pullRequests: RawPullRequest[] = [...combinedPullRequestNodes.values()].map((pr) => {
    setRepository(repositories, toRepository(pr.repository))
    return {
      id: pr.id,
      repository: pr.repository.nameWithOwner,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt ?? undefined,
      closedAt: pr.closedAt ?? undefined,
      state: pr.state,
      isDraft: pr.isDraft,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      comments: pr.comments.totalCount,
      reviews: pr.reviews.totalCount,
    }
  })

  const reviewEvents: RawDatedRepositoryEvent[] = []
  for (const node of reviewNodes) {
    setRepository(repositories, toRepository(node.pullRequest.repository))
    reviewEvents.push({
      id: node.pullRequestReview.id,
      repository: node.pullRequest.repository.nameWithOwner,
      occurredAt: node.occurredAt,
    })
  }
  for (const pullRequest of searchedReviews.nodes) {
    setRepository(repositories, toRepository(pullRequest.repository))
    if (pullRequest.reviews.pageInfo.hasNextPage) {
      privateSearchPartial = true
      warnings.push(
        `${pullRequest.repository.nameWithOwner}#${pullRequest.number}: only the first 100 review records were inspected.`,
      )
    }
    for (const review of pullRequest.reviews.nodes) {
      if (
        review.author?.login !== login ||
        !review.submittedAt ||
        review.submittedAt < from ||
        review.submittedAt > to
      ) {
        continue
      }
      reviewEvents.push({
        id: review.id,
        repository: pullRequest.repository.nameWithOwner,
        occurredAt: review.submittedAt,
      })
    }
  }
  if (searchedReviews.truncated) {
    warnings.push(
      'GitHub search capped reviewed pull requests at 1,000; private review coverage may be partial.',
    )
  }
  const reviews = dedupeDatedEvents(reviewEvents)

  const issuesById = new Map<string, RawDatedRepositoryEvent>()
  for (const node of issueNodes) {
    setRepository(repositories, toRepository(node.issue.repository))
    issuesById.set(node.issue.id, {
      id: node.issue.id,
      repository: node.issue.repository.nameWithOwner,
      occurredAt: node.occurredAt,
    })
  }
  for (const issue of searchedIssues.nodes) {
    setRepository(repositories, toRepository(issue.repository))
    issuesById.set(issue.id, {
      id: issue.id,
      repository: issue.repository.nameWithOwner,
      occurredAt: issue.createdAt,
    })
  }
  if (searchedIssues.truncated) {
    warnings.push(
      'GitHub search capped authored issue detail at 1,000; contribution totals retain the larger public count.',
    )
  }
  const issues = [...issuesById.values()]

  coverage.push({
    id: 'github-contributions',
    label: 'GitHub contribution graph',
    status: contributionCoverageStatus(collection.restrictedContributionsCount),
    detail:
      collection.restrictedContributionsCount > 0
        ? `${collection.restrictedContributionsCount} contribution signals are restricted by GitHub privacy rules and cannot be attributed to repositories.`
        : 'Calendar, authored PR, review, issue, and repository contribution connections.',
    itemCount: collection.contributionCalendar.totalContributions,
  })

  const accessibleByName = new Map(
    accessibleRepositories.map((repository) => [repository.nameWithOwner, repository]),
  )
  const repositoryNames = [
    ...new Set([...repositories.keys(), ...accessibleByName.keys()]),
  ]
  const commitResults = await mapWithLimit(repositoryNames, 4, async (repository) => ({
    repository,
    commits: await fetchRepositoryCommits(
      repository,
      contributionRoot.viewer.login,
      from,
      to,
    ),
  }))

  const commits: RawCommit[] = []
  const detailedCommitsByRepository = new Map<string, RawCommit[]>()
  let failedCommitRepositories = 0
  for (const result of commitResults) {
    if (result.status === 'fulfilled') {
      commits.push(...result.value.commits)
      detailedCommitsByRepository.set(
        result.value.repository,
        result.value.commits,
      )
      if (result.value.commits.length > 0) {
        const accessible = accessibleByName.get(result.value.repository)
        if (accessible) setRepository(repositories, accessible)
      }
    } else {
      failedCommitRepositories += 1
    }
  }

  if (failedCommitRepositories > 0) {
    warnings.push(
      `${failedCommitRepositories} repositories could not be queried for detailed authored commits. Contribution totals remain available.`,
    )
  }
  coverage.push({
    id: 'github-commits',
    label: 'GitHub authored commits',
    status:
      failedCommitRepositories === 0
        ? 'complete'
        : failedCommitRepositories === repositoryNames.length
          ? 'unavailable'
          : 'partial',
    detail:
      'Authenticated per-repository default-branch commit history; deleted and force-pushed history is not observable.',
    itemCount: commits.length,
  })

  const contributionCommitRepositories = new Set(
    commitDaysByRepository.map((day) => day.repository.toLowerCase()),
  )
  for (const [repository, detailedCommits] of detailedCommitsByRepository) {
    if (contributionCommitRepositories.has(repository.toLowerCase())) continue
    const counts = new Map<string, number>()
    for (const commit of detailedCommits) {
      const date = commit.occurredAt.slice(0, 10)
      counts.set(date, (counts.get(date) ?? 0) + 1)
    }
    for (const [date, count] of counts) {
      commitDaysByRepository.push({ repository, date, count })
    }
  }

  const activePrivateRepositories = [...repositories.values()].filter(
    (repository) => repository.isPrivate,
  ).length
  coverage.push({
    id: 'github-private-repositories',
    label: 'Private repository enrichment',
    status: privateSearchPartial ? 'partial' : 'complete',
    detail:
      privateSearchPartial
        ? 'Authenticated repository enumeration is complete; one or more GitHub search or nested-review caps make event-level enrichment partial.'
        : 'Authenticated accessible-repository enumeration plus commit and GitHub search enrichment; private names never enter tracked files.',
    itemCount: activePrivateRepositories,
  })

  if (collection.restrictedContributionsCount > 0) {
    warnings.push(
      `${collection.restrictedContributionsCount} contributions are restricted by GitHub privacy rules and cannot be attributed to repositories.`,
    )
  }

  return {
    schemaVersion: 1,
    range,
    from,
    to,
    collectedAt: new Date().toISOString(),
    subject: {
      login: contributionRoot.viewer.login,
      name: contributionRoot.viewer.name ?? undefined,
      avatarUrl: contributionRoot.viewer.avatarUrl,
    },
    contributionCalendar,
    contributionTotal: collection.contributionCalendar.totalContributions,
    restrictedContributions: collection.restrictedContributionsCount,
    repositories: [...repositories.values()],
    commits,
    commitDaysByRepository,
    pullRequests,
    reviews,
    issues,
    coverage,
    warnings,
  }
}
