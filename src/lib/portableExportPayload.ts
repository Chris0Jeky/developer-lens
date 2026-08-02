import type {
  DashboardData,
  DnaMetric,
  RepositoryMetric,
  ThemeMetric,
} from '../../shared/types.js'
import { PUBLIC_SHOWCASE_URL } from './sharePayload.js'

export type PortableArtifact = 'dashboard' | 'wrapped'
export type RepositoryRedaction = 'private-aliases' | 'all-aliases'

export interface PortableExportOptions {
  artifact: PortableArtifact
  aliasSeed: string
  repositoryRedaction: RepositoryRedaction
}

export interface PortableMetric {
  label: string
  value: number
}

export interface PortableWeek {
  label: string
  total: number
  commits: number
  pullRequests: number
  reviews: number
  issues: number
  activeDays: number
  repositories: number
}

export interface PortableWeekday {
  label: string
  contributions: number
  activeDays: number
}

export interface PortableRepository {
  label: string
  disclosure: 'synthetic' | 'public-name' | 'private-alias' | 'masked-alias'
  primaryLanguage: string
  color: string
  commits: number
  mergedPullRequests: number
  reviews: number
  issues: number
  activeWeeks: number
  engagement: number
  momentum: number
  attentionShare: number
}

export interface PortableLanguage {
  name: string
  color: string
  share: number
  footprintShare: number
  repositoryCount: number
}

export interface PortableDimension {
  key: DnaMetric['key']
  label: string
  value: number
  explanation: string
}

export interface PortableTheme {
  key: string
  label: string
  color: string
  count: number
  share: number
}

export interface PortableNarrative {
  id: string
  order: 1 | 2 | 3
  title: string
  body: string
  evidence: string[]
  limitation: string
}

export interface PortableExportPayload {
  schemaVersion: 1
  artifact: PortableArtifact
  scope: 'public-demo' | 'redacted-local'
  range: '6m' | '12m'
  rangeLabel: string
  title: string
  subtitle: string
  repositoryRedaction: RepositoryRedaction | 'synthetic'
  privacyNote: string
  canonicalUrl?: string
  fileStem: string
  summary: {
    contributions: number
    commits: number
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
    medianMergeHours: number | null
    coverageScore: number
  }
  weeks: PortableWeek[]
  weekdays: PortableWeekday[]
  repositories: PortableRepository[]
  languages: PortableLanguage[]
  dna: PortableDimension[]
  archetype: {
    name: string
    shortName: string
    description: string
  }
  themes: PortableTheme[]
  narratives: PortableNarrative[]
  coverage: {
    complete: number
    partial: number
    unavailable: number
    total: number
  }
}

const ALIAS_WORDS = [
  'Aurora',
  'Beacon',
  'Cinder',
  'Comet',
  'Delta',
  'Ember',
  'Flint',
  'Grove',
  'Harbor',
  'Helix',
  'Iris',
  'Juniper',
  'Kepler',
  'Lattice',
  'Lumen',
  'Mariner',
  'Meadow',
  'Nebula',
  'Nimbus',
  'Nova',
  'Orbit',
  'Orchid',
  'Prism',
  'Quartz',
  'Relay',
  'Ridge',
  'Solstice',
  'Sparrow',
  'Summit',
  'Tangent',
  'Tide',
  'Vale',
  'Vector',
  'Violet',
  'Weaver',
  'Zenith',
] as const

const ARCHETYPES: Record<string, { name: string; description: string }> = {
  'Force Multiplier': {
    name: 'The Force Multiplier',
    description: 'The visible trace leans toward feedback, review, and work strengthened across project boundaries.',
  },
  'Orchestration Architect': {
    name: 'The Orchestration Architect',
    description: 'The visible trace connects many changes and repositories into a sustained integration system.',
  },
  'Cross-Repo Navigator': {
    name: 'The Cross-Repo Navigator',
    description: 'The visible trace moves across systems while retaining meaningful continuity.',
  },
  'Systems Gardener': {
    name: 'The Systems Gardener',
    description: 'The visible trace gives substantial weight to proving, explaining, repairing, and refining systems.',
  },
  'Release Closer': {
    name: 'The Release Closer',
    description: 'The visible trace repeatedly carries proposed changes into observed merged outcomes.',
  },
  'Deep-System Builder': {
    name: 'The Deep-System Builder',
    description: 'The visible trace concentrates sustained attention on a smaller group of systems.',
  },
  'Product Cartographer': {
    name: 'The Product Cartographer',
    description: 'The visible trace balances making, mapping, and refining across an evolving portfolio.',
  },
  'Development Explorer': {
    name: 'The Development Explorer',
    description: 'The visible trace forms a varied development landscape without forcing it into a narrower label.',
  },
}

const DNA_META: Record<DnaMetric['key'], { label: string; explanation: string }> = {
  focus: {
    label: 'Focus',
    explanation: 'How strongly visible activity clusters around the leading repositories.',
  },
  shipping: {
    label: 'Shipping',
    explanation: 'How often authored pull requests are observed reaching a merged state.',
  },
  collaboration: {
    label: 'Collaboration',
    explanation: 'The visible balance of review and pull-request feedback activity.',
  },
  consistency: {
    label: 'Consistency',
    explanation: 'How broadly visible activity is distributed across the observed weeks.',
  },
  breadth: {
    label: 'Breadth',
    explanation: 'How many repositories carry sustained rather than incidental activity.',
  },
  stewardship: {
    label: 'Stewardship',
    explanation: 'The visible share of proving, explaining, repairing, and refining work.',
  },
}

const THEME_META: Record<string, { label: string; color: string }> = {
  feat: { label: 'Building', color: '#b99cff' },
  fix: { label: 'Repairing', color: '#ff8f91' },
  docs: { label: 'Explaining', color: '#ffd166' },
  test: { label: 'Proving', color: '#67e8b8' },
  refactor: { label: 'Refining', color: '#6ed8ff' },
  chore: { label: 'Maintaining', color: '#a9b6d6' },
  perf: { label: 'Optimising', color: '#ffab70' },
  revert: { label: 'Reverting', color: '#ff709f' },
  other: { label: 'Other', color: '#8b95aa' },
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function finite(value: number, minimum = 0): number {
  return Number.isFinite(value) ? Math.max(minimum, value) : minimum
}

function integer(value: number): number {
  return Math.round(finite(value))
}

function ratio(value: number): number {
  return Math.min(1, finite(value))
}

function percentage(value: number): number {
  return Math.round(ratio(value) * 100)
}

function safeColor(value: string | undefined, fallback = '#8b95aa'): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

function safeLabel(value: string | undefined, fallback: string): string {
  const normalized = [...(value ?? '')]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0
      return code >= 32 && code !== 127
    })
    .join('')
    .trim()
  return normalized ? normalized.slice(0, 80) : fallback
}

function seedNumber(seed: string): number {
  let value = 2_166_136_261
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index)
    value = Math.imul(value, 16_777_619)
  }
  return value >>> 0
}

function shuffledAliases(seed: string, count: number): string[] {
  let state = seedNumber(seed) || 0x9e3779b9
  const words = [...ALIAS_WORDS]
  const random = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4_294_967_296
  }
  for (let index = words.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[words[index], words[target]] = [words[target], words[index]]
  }
  return Array.from({ length: count }, (_, index) => {
    const word = words[index % words.length]
    const cycle = Math.floor(index / words.length)
    return `Project ${word}${cycle === 0 ? '' : ` ${cycle + 1}`}`
  })
}

function repositoryLabels(
  repositories: RepositoryMetric[],
  scope: PortableExportPayload['scope'],
  redaction: RepositoryRedaction,
  seed: string,
): PortableRepository[] {
  const aliases = shuffledAliases(seed, repositories.length)
  const totalEngagement = repositories.reduce(
    (sum, repository) => sum + finite(repository.engagement),
    0,
  )

  return repositories.map((repository, index) => {
    const shouldAlias =
      scope === 'redacted-local' &&
      (redaction === 'all-aliases' || repository.isPrivate)
    const disclosure: PortableRepository['disclosure'] =
      scope === 'public-demo'
        ? 'synthetic'
        : redaction === 'all-aliases'
          ? 'masked-alias'
          : repository.isPrivate
            ? 'private-alias'
            : 'public-name'
    const language = safeLabel(repository.primaryLanguage, 'Not detected')

    return {
      label: shouldAlias
        ? aliases[index]
        : safeLabel(repository.displayName, `Repository ${index + 1}`),
      disclosure,
      primaryLanguage: language,
      color: safeColor(repository.languageColor),
      commits: integer(repository.commits + repository.localCommits),
      mergedPullRequests: integer(repository.mergedPullRequests),
      reviews: integer(repository.reviews),
      issues: integer(repository.issues),
      activeWeeks: integer(repository.activeWeeks),
      engagement: Math.round(finite(repository.engagement) * 10) / 10,
      momentum: Math.max(-100, Math.min(100, Math.round(repository.momentum))),
      attentionShare:
        totalEngagement > 0
          ? Math.round((finite(repository.engagement) / totalEngagement) * 1_000) / 1_000
          : 0,
    }
  })
}

function portableThemes(themes: ThemeMetric[]): PortableTheme[] {
  const combined = new Map<string, { count: number; share: number }>()
  for (const theme of themes) {
    const key = THEME_META[theme.key] ? theme.key : 'other'
    const existing = combined.get(key) ?? { count: 0, share: 0 }
    combined.set(key, {
      count: existing.count + integer(theme.count),
      share: existing.share + ratio(theme.share),
    })
  }
  return [...combined.entries()]
    .map(([key, values]) => ({
      key,
      label: THEME_META[key].label,
      color: THEME_META[key].color,
      count: values.count,
      share: Math.round(Math.min(1, values.share) * 1_000) / 1_000,
    }))
    .sort((left, right) => right.count - left.count)
}

function portableDna(dna: DnaMetric[]): PortableDimension[] {
  return (Object.keys(DNA_META) as DnaMetric['key'][]).map((key) => {
    const source = dna.find((metric) => metric.key === key)
    return {
      key,
      label: DNA_META[key].label,
      value: Math.max(0, Math.min(100, integer(source?.value ?? 0))),
      explanation: DNA_META[key].explanation,
    }
  })
}

function buildNarratives(payload: {
  summary: PortableExportPayload['summary']
  languages: PortableLanguage[]
  themes: PortableTheme[]
  coverage: PortableExportPayload['coverage']
}): PortableNarrative[] {
  const { summary } = payload
  const topLanguage = payload.languages[0]
  const topTheme = payload.themes[0]
  const effectiveShare =
    summary.repositories > 0 ? summary.effectiveRepositories / summary.repositories : 0
  const mergeHours = summary.medianMergeHours
  const confidence =
    summary.coverageScore >= 80 ? 'strong' : summary.coverageScore >= 60 ? 'moderate' : 'limited'

  const connection =
    summary.reviews >= Math.max(12, summary.pullRequests * 1.25)
      ? {
          title: 'Feedback became a first-class part of the system.',
          body: 'Review activity outweighed authored pull-request volume, which is consistent with a period shaped by feedback as well as direct change.',
          evidence: [
            `${summary.reviews} submitted reviews`,
            `${summary.pullRequests} authored pull requests`,
          ],
        }
      : effectiveShare >= 0.6 && summary.repositories >= 4
        ? {
            title: 'Breadth was supported by continuity.',
            body: 'A majority of observed repositories crossed the sustained-engagement threshold, so the portfolio was broad without being merely incidental.',
            evidence: [
              `${summary.effectiveRepositories} sustained repositories`,
              `${summary.repositories} repositories observed`,
            ],
          }
        : {
            title: 'The strongest pattern is concentration with a surrounding portfolio.',
            body: 'A smaller set of repositories carried sustained gravity while lighter traces remained visible around them.',
            evidence: [
              `${summary.effectiveRepositories} sustained repositories`,
              `${summary.repositories} repositories observed`,
            ],
          }

  return [
    {
      id: 'cadence',
      order: 1,
      title: `${summary.activeWeeks} weeks carried visible activity.`,
      body: 'Active weeks and streaks describe continuity in observable events, not time worked or effort.',
      evidence: [
        `${summary.activeDays} active days`,
        `${summary.longestStreak}-day longest visible run`,
      ],
      limitation: 'Small and large events count alike in cadence totals.',
    },
    {
      id: 'delivery',
      order: 2,
      title: `${summary.mergedPullRequests} authored changes were observed as merged.`,
      body:
        mergeHours === null
          ? 'Merge timing was not eligible for a stable median in this snapshot.'
          : `The median observed creation-to-merge interval was ${Math.round(mergeHours * 10) / 10} hours.`,
      evidence: [
        `${percentage(summary.mergeRate)}% observed merge rate`,
        `${summary.reviews} submitted reviews`,
      ],
      limitation: 'Merge timing reflects system conventions, batch size, automation, queueing, and risk; speed is not quality.',
    },
    {
      id: 'landscape',
      order: 2,
      title: topLanguage
        ? `${topLanguage.name} led an activity-weighted language landscape.`
        : 'No language landscape was eligible.',
      body: topLanguage
        ? `${payload.languages.length} detected languages were weighted by repository composition and visible activity.`
        : 'Language metadata was unavailable in the exported snapshot.',
      evidence: topLanguage
        ? [
            `${percentage(topLanguage.share)}% leading activity-weighted share`,
            topTheme
              ? `${topTheme.label} was the largest commit-message theme`
              : 'No commit-message theme was eligible',
          ]
        : ['No eligible language observations'],
      limitation: 'Language share is not authored-line share, and commit-message themes are coarse classifications.',
    },
    {
      id: 'connection',
      order: 3,
      title: connection.title,
      body: connection.body,
      evidence: connection.evidence,
      limitation: `This is a deterministic hypothesis with ${confidence} source coverage, not a causal claim or performance judgment.`,
    },
  ]
}

export function createPortableExportSeed(): string {
  const bytes = new Uint32Array(4)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
    return [...bytes].map((value) => value.toString(36)).join('-')
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createPortableExportPayload(
  data: DashboardData,
  options: PortableExportOptions,
): PortableExportPayload {
  const scope = data.meta.privacy === 'public-demo' ? 'public-demo' : 'redacted-local'
  const publicDemo = scope === 'public-demo'
  const summary: PortableExportPayload['summary'] = {
    contributions: integer(data.summary.contributions),
    commits: integer(data.summary.commits),
    pullRequests: integer(data.summary.pullRequests),
    mergedPullRequests: integer(data.summary.mergedPullRequests),
    mergeRate: ratio(data.summary.mergeRate),
    reviews: integer(data.summary.reviews),
    issues: integer(data.summary.issues),
    activeDays: integer(data.summary.activeDays),
    activeWeeks: integer(data.summary.activeWeeks),
    longestStreak: integer(data.summary.longestStreak),
    repositories: integer(data.summary.repositories),
    privateRepositories: integer(data.summary.privateRepositories),
    effectiveRepositories: integer(data.summary.effectiveRepositories),
    medianMergeHours:
      data.summary.medianMergeHours === undefined
        ? null
        : Math.round(finite(data.summary.medianMergeHours) * 10) / 10,
    coverageScore: percentage(data.meta.coverageScore),
  }
  const weeks = data.weekly.map((week, index) => ({
    label: `Week ${String(index + 1).padStart(2, '0')}`,
    total: integer(week.total),
    commits: integer(week.commits),
    pullRequests: integer(week.pullRequests),
    reviews: integer(week.reviews),
    issues: integer(week.issues),
    activeDays: integer(week.activeDays),
    repositories: integer(week.repositories),
  }))
  const weekdayMap = new Map(
    WEEKDAYS.map((label) => [label, { label, contributions: 0, activeDays: 0 }]),
  )
  for (const day of data.activity) {
    const parsed = new Date(`${day.date.slice(0, 10)}T12:00:00Z`)
    if (Number.isNaN(parsed.getTime())) continue
    const weekday = WEEKDAYS[(parsed.getUTCDay() + 6) % 7]
    const bucket = weekdayMap.get(weekday)
    if (!bucket) continue
    bucket.contributions += integer(day.contributions)
    if (day.contributions > 0) bucket.activeDays += 1
  }
  const languages = data.languages.map((language, index) => ({
    name: safeLabel(language.name, `Language ${index + 1}`),
    color: safeColor(language.color),
    share: Math.round(ratio(language.share) * 1_000) / 1_000,
    footprintShare: Math.round(ratio(language.footprintShare) * 1_000) / 1_000,
    repositoryCount: integer(language.repositoryCount),
  }))
  const safeArchetype = Object.hasOwn(ARCHETYPES, data.archetype.shortName)
    ? data.archetype.shortName
    : 'Development Explorer'
  const archetypeSource = ARCHETYPES[safeArchetype]
  const coverage = {
    complete: data.meta.coverage.filter((source) => source.status === 'complete').length,
    partial: data.meta.coverage.filter((source) => source.status === 'partial').length,
    unavailable: data.meta.coverage.filter((source) => source.status === 'unavailable').length,
    total: data.meta.coverage.length,
  }
  const themes = portableThemes(data.themes)
  const repositoryRedaction = publicDemo ? 'synthetic' : options.repositoryRedaction
  const payloadBase = {
    summary,
    languages,
    themes,
    coverage,
  }

  return {
    schemaVersion: 1,
    artifact: options.artifact,
    scope,
    range: data.meta.range,
    rangeLabel: data.meta.range === '6m' ? 'Six-month lens' : 'One-year lens',
    title:
      options.artifact === 'dashboard'
        ? 'The full development lens'
        : 'The complete development Wrapped',
    subtitle:
      options.artifact === 'dashboard'
        ? 'A portable map of rhythm, delivery, project gravity, technical landscape, and evidence.'
        : 'Nine chapters tracing a development system from visible events to a bounded hypothesis.',
    repositoryRedaction,
    privacyNote: publicDemo
      ? 'Synthetic showcase · no personal GitHub data'
      : options.repositoryRedaction === 'all-aliases'
        ? 'Redacted local export · every repository name is replaced by a fresh alias'
        : 'Redacted local export · private repository names are replaced by fresh aliases',
    canonicalUrl: publicDemo ? PUBLIC_SHOWCASE_URL : undefined,
    fileStem: `developer-lens-${data.meta.range}-${options.artifact}-portable`,
    summary,
    weeks,
    weekdays: [...weekdayMap.values()],
    repositories: repositoryLabels(
      data.repositories,
      scope,
      options.repositoryRedaction,
      options.aliasSeed,
    ),
    languages,
    dna: portableDna(data.dna),
    archetype: {
      name: archetypeSource.name,
      shortName: safeArchetype,
      description: archetypeSource.description,
    },
    themes,
    narratives: buildNarratives(payloadBase),
    coverage,
  }
}
