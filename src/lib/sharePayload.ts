import type { DashboardData } from '../../shared/types.js'

export const PUBLIC_SHOWCASE_URL = 'https://chris0jeky.github.io/developer-lens/'

export type ShareTone = 'story' | 'professional' | 'compact'

export interface ShareContext {
  kind: 'overview' | 'wrapped'
  chapterId?: string
  chapterNumber?: number
  chapterLabel?: string
}

export interface ShareMetric {
  label: string
  value: string
}

export interface SharePayload {
  scope: 'public-demo' | 'redacted-local'
  context: ShareContext
  eyebrow: string
  title: string
  description: string
  rangeLabel: string
  archetype: string
  metrics: ShareMetric[]
  accent: [string, string]
  privacyNote: string
  canonicalUrl?: string
  fileStem: string
}

const ARCHETYPES = new Set([
  'Force Multiplier',
  'Orchestration Architect',
  'Cross-Repo Navigator',
  'Systems Gardener',
  'Release Closer',
  'Deep-System Builder',
  'Product Cartographer',
])

const CHAPTERS: Record<
  string,
  {
    eyebrow: string
    title: (data: DashboardData, archetype: string) => string
    description: (data: DashboardData) => string
    accent: [string, string]
  }
> = {
  opening: {
    eyebrow: '01 · The opening frame',
    title: () => 'A development trail came into focus.',
    description: (data) =>
      `${formatNumber(data.summary.contributions)} visible contribution signals formed the story.`,
    accent: ['#9b6cff', '#45ddbd'],
  },
  constellation: {
    eyebrow: '02 · The constellation',
    title: (data) => `${formatNumber(data.summary.repositories)} repositories formed a constellation.`,
    description: (data) =>
      `${formatNumber(data.summary.effectiveRepositories)} held most of the visible gravity.`,
    accent: ['#5d63e7', '#c05ae8'],
  },
  archetype: {
    eyebrow: '03 · The signature',
    title: (_data, archetype) => `The signature: ${archetype}.`,
    description: () => 'A deterministic lens on the shape behind the totals—not a score.',
    accent: ['#ff746b', '#f6c55a'],
  },
  rhythm: {
    eyebrow: '04 · The rhythm',
    title: (data) => `${formatNumber(data.summary.activeWeeks)} weeks lit up.`,
    description: (data) =>
      `${formatNumber(data.summary.longestStreak)} days formed the longest visible run.`,
    accent: ['#27caaa', '#3f72e6'],
  },
  delivery: {
    eyebrow: '05 · Crossing the line',
    title: (data) => `${formatNumber(data.summary.mergedPullRequests)} changes crossed the line.`,
    description: (data) =>
      `${Math.round(data.summary.mergeRate * 100)}% of authored pull requests were observed as merged.`,
    accent: ['#f0655c', '#9859e8'],
  },
  hidden: {
    eyebrow: '06 · The privacy boundary',
    title: () => 'The hidden work stayed hidden.',
    description: () => 'This share card contains aggregates—not repository names, titles, or raw events.',
    accent: ['#d99b39', '#bb58b8'],
  },
  landscape: {
    eyebrow: '07 · The technical landscape',
    title: (data) => `${formatNumber(data.languages.length)} languages moved through the lens.`,
    description: () => 'The full dashboard keeps composition and activity weighting visibly distinct.',
    accent: ['#3576dd', '#31d1b4'],
  },
  connection: {
    eyebrow: '08 · The deeper connection',
    title: () => 'Independent signals became a deeper hypothesis.',
    description: () => 'Evidence, interpretation, confidence, and limits remain attached.',
    accent: ['#df5198', '#7955e8'],
  },
  closing: {
    eyebrow: '09 · The next lens',
    title: () => 'A reflection, not a verdict.',
    description: () => 'The next chapter starts with deciding what deserves attention.',
    accent: ['#865ee8', '#3fd2ac'],
  },
}

/**
 * The nine Wrapped chapters in story order, derived from `CHAPTERS` so a new chapter cannot
 * drift out of the headless exporter. String keys keep insertion order, so this stays stable.
 */
export const WRAPPED_CHAPTER_IDS: readonly string[] = Object.freeze(Object.keys(CHAPTERS))

const OVERVIEW = {
  eyebrow: 'Developer Lens · Development retrospective',
  title: () => 'A development trail, brought into focus.',
  description: (data: DashboardData) =>
    `${formatNumber(data.summary.commits)} commit signals across ${formatNumber(data.summary.activeWeeks)} active weeks—mapped as rhythm, delivery, and project gravity.`,
  accent: ['#966cff', '#43ddb9'] as [string, string],
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value)
}

function safeArchetype(value: string): string {
  return ARCHETYPES.has(value) ? value : 'Development Explorer'
}

function safeChapter(context: ShareContext) {
  if (context.kind !== 'wrapped') return OVERVIEW
  return CHAPTERS[context.chapterId ?? ''] ?? CHAPTERS.opening
}

export function createSharePayload(
  data: DashboardData,
  context: ShareContext = { kind: 'overview' },
): SharePayload {
  const publicDemo = data.meta.privacy === 'public-demo'
  const archetype = safeArchetype(data.archetype.shortName)
  const chapter = safeChapter(context)
  const rangeLabel = data.meta.range === '6m' ? 'Six-month lens' : 'One-year lens'
  const contextSlug = context.kind === 'wrapped' ? `wrapped-${context.chapterId ?? 'story'}` : 'overview'

  return {
    scope: publicDemo ? 'public-demo' : 'redacted-local',
    context: {
      kind: context.kind,
      chapterId: context.kind === 'wrapped' ? context.chapterId : undefined,
      chapterNumber: context.kind === 'wrapped' ? context.chapterNumber : undefined,
      chapterLabel: context.kind === 'wrapped' ? chapter.eyebrow : undefined,
    },
    eyebrow: chapter.eyebrow,
    title: chapter.title(data, archetype),
    description: chapter.description(data),
    rangeLabel,
    archetype,
    metrics: [
      { label: 'Commit signals', value: formatNumber(data.summary.commits) },
      { label: 'Merged PRs', value: formatNumber(data.summary.mergedPullRequests) },
      { label: 'Reviews', value: formatNumber(data.summary.reviews) },
      { label: 'Active days', value: formatNumber(data.summary.activeDays) },
      { label: 'Active weeks', value: formatNumber(data.summary.activeWeeks) },
      { label: 'Repositories', value: formatNumber(data.summary.repositories) },
    ],
    accent: chapter.accent,
    privacyNote: publicDemo
      ? 'Synthetic showcase · no personal GitHub data'
      : 'Redacted aggregate · no identity, repository names, PR titles, exact dates, or raw events',
    canonicalUrl: publicDemo ? PUBLIC_SHOWCASE_URL : undefined,
    fileStem: `developer-lens-${data.meta.range}-${contextSlug}`,
  }
}

export function createShareCaption(payload: SharePayload, tone: ShareTone): string {
  const commits = payload.metrics.find((metric) => metric.label === 'Commit signals')?.value ?? '—'
  const merged = payload.metrics.find((metric) => metric.label === 'Merged PRs')?.value ?? '—'
  const activeWeeks = payload.metrics.find((metric) => metric.label === 'Active weeks')?.value ?? '—'
  const link = payload.canonicalUrl ? `\n\nExplore the synthetic showcase: ${payload.canonicalUrl}` : ''
  const boundary = payload.scope === 'public-demo'
    ? 'All data in this showcase is synthetic.'
    : 'Shared from a deliberately redacted local snapshot.'

  if (tone === 'compact') {
    return `${payload.title} ${commits} commits · ${merged} merged PRs · ${activeWeeks} active weeks. ${boundary}${link}`
  }

  if (tone === 'professional') {
    return `I used Developer Lens to look beyond the contribution graph and examine the shape of a ${payload.rangeLabel.toLowerCase()}: ${commits} commit signals, ${merged} merged pull requests, and ${activeWeeks} active weeks.\n\nThe useful part was not the totals—it was seeing rhythm, project gravity, delivery flow, and evidence-backed hypotheses together. ${boundary}${link}`
  }

  return `${payload.title}\n\n${payload.description}\n\n${commits} commit signals · ${merged} merged pull requests · ${activeWeeks} active weeks.\n\n${boundary}${link}`
}

export function sharePayloadText(payload: SharePayload): string {
  return JSON.stringify(payload)
}
