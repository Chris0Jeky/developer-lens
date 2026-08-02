export type RangeKey = '6m' | '12m'

export type Confidence = 'high' | 'medium' | 'low'

export type InsightOrder = 1 | 2 | 3

export interface CoverageSource {
  id: string
  label: string
  status: 'complete' | 'partial' | 'unavailable'
  detail: string
  itemCount?: number
}

export interface ActivityDay {
  date: string
  contributions: number
  commits: number
  pullRequests: number
  reviews: number
  issues: number
  localCommits: number
}

export interface WeeklyActivity {
  week: string
  label: string
  total: number
  commits: number
  pullRequests: number
  reviews: number
  issues: number
  activeDays: number
  repositories: number
}

export interface LanguageMetric {
  name: string
  color: string
  bytes: number
  activityWeight: number
  repositoryCount: number
  share: number
}

export interface RepositoryMetric {
  key: string
  nameWithOwner: string
  displayName: string
  url?: string
  description?: string
  isPrivate: boolean
  isArchived: boolean
  isFork: boolean
  commits: number
  localCommits: number
  pullRequests: number
  mergedPullRequests: number
  reviews: number
  issues: number
  activeDays: number
  activeWeeks: number
  firstHalfActivity: number
  secondHalfActivity: number
  momentum: number
  engagement: number
  primaryLanguage?: string
  languageColor?: string
  topics: string[]
}

export interface PullRequestMetric {
  id: string
  repository: string
  number: number
  title: string
  url: string
  createdAt: string
  mergedAt?: string
  closedAt?: string
  state: string
  isDraft: boolean
  additions?: number
  deletions?: number
  changedFiles?: number
  comments: number
  reviews: number
}

export interface Insight {
  id: string
  order: InsightOrder
  category:
    | 'rhythm'
    | 'focus'
    | 'delivery'
    | 'collaboration'
    | 'craft'
    | 'trajectory'
  eyebrow: string
  title: string
  body: string
  evidence: string[]
  caveat?: string
  confidence: Confidence
  score: number
}

export interface DnaMetric {
  key:
    | 'focus'
    | 'shipping'
    | 'collaboration'
    | 'consistency'
    | 'breadth'
    | 'stewardship'
  label: string
  value: number
  description: string
}

export interface DeveloperArchetype {
  name: string
  shortName: string
  description: string
  signals: string[]
}

export interface ThemeMetric {
  key: string
  label: string
  count: number
  share: number
  color: string
}

export interface SummaryMetrics {
  contributions: number
  commits: number
  localOnlyCommits: number
  pullRequests: number
  mergedPullRequests: number
  mergeRate: number
  reviews: number
  issues: number
  activeDays: number
  activeWeeks: number
  longestStreak: number
  repositories: number
  privateRepositories: number
  effectiveRepositories: number
  medianMergeHours?: number
  busiestDay?: { date: string; contributions: number }
  strongestMonth?: { month: string; contributions: number }
}

export interface DashboardMeta {
  schemaVersion: 1
  range: RangeKey
  from: string
  to: string
  generatedAt: string
  mode: 'private' | 'demo'
  privacy: 'local-only'
  subject: {
    login: string
    name?: string
    avatarUrl?: string
  }
  coverageScore: number
  coverage: CoverageSource[]
  warnings: string[]
}

export interface DashboardData {
  meta: DashboardMeta
  summary: SummaryMetrics
  activity: ActivityDay[]
  weekly: WeeklyActivity[]
  repositories: RepositoryMetric[]
  languages: LanguageMetric[]
  pullRequests: PullRequestMetric[]
  insights: Insight[]
  dna: DnaMetric[]
  archetype: DeveloperArchetype
  themes: ThemeMetric[]
}

export interface RawRepository {
  id: string
  nameWithOwner: string
  name: string
  url?: string
  description?: string
  isPrivate: boolean
  isArchived: boolean
  isFork: boolean
  pushedAt?: string
  primaryLanguage?: { name: string; color?: string }
  languages: Array<{ name: string; color?: string; size: number }>
  topics: string[]
}

export interface RawCommit {
  sha: string
  repository: string
  occurredAt: string
  source: 'github' | 'local-git'
  additions?: number
  deletions?: number
  files?: number
  parentCount?: number
  features: {
    type: string
    isRevert: boolean
    isFixup: boolean
    subjectLength: number
  }
}

export interface RawPullRequest {
  id: string
  repository: string
  number: number
  title: string
  url: string
  createdAt: string
  mergedAt?: string
  closedAt?: string
  state: string
  isDraft: boolean
  additions?: number
  deletions?: number
  changedFiles?: number
  comments: number
  reviews: number
}

export interface RawDatedRepositoryEvent {
  id: string
  repository: string
  occurredAt: string
}

export interface RawDataset {
  schemaVersion: 1
  range: RangeKey
  from: string
  to: string
  collectedAt: string
  subject: {
    login: string
    name?: string
    avatarUrl?: string
  }
  contributionCalendar: Array<{ date: string; count: number }>
  contributionTotal: number
  restrictedContributions: number
  repositories: RawRepository[]
  commits: RawCommit[]
  commitDaysByRepository: Array<{
    repository: string
    date: string
    count: number
  }>
  pullRequests: RawPullRequest[]
  reviews: RawDatedRepositoryEvent[]
  issues: RawDatedRepositoryEvent[]
  coverage: CoverageSource[]
  warnings: string[]
}
