import {
  differenceInCalendarDays,
  differenceInHours,
  eachDayOfInterval,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns'
import type {
  ActivityDay,
  Confidence,
  DashboardData,
  DnaMetric,
  Insight,
  LanguageMetric,
  RangeKey,
  RawCommit,
  RawDataset,
  RepositoryMetric,
  ThemeMetric,
  WeeklyActivity,
} from '../shared/types.js'

const LANGUAGE_FALLBACKS: Record<string, string> = {
  TypeScript: '#6ea8fe',
  JavaScript: '#f7df72',
  Python: '#55b4d4',
  Rust: '#f2845c',
  Go: '#6bd5e1',
  HTML: '#f07855',
  CSS: '#bd77ff',
  Shell: '#7de5ac',
  PowerShell: '#61a7ef',
  Java: '#f4a460',
  C: '#a8b4d8',
  'C++': '#e984c4',
}

const THEME_META: Record<string, { label: string; color: string }> = {
  feat: { label: 'Building', color: '#b99cff' },
  fix: { label: 'Repairing', color: '#ff8f91' },
  docs: { label: 'Explaining', color: '#ffd166' },
  test: { label: 'Proving', color: '#67e8b8' },
  refactor: { label: 'Refining', color: '#6ed8ff' },
  chore: { label: 'Maintaining', color: '#a9b6d6' },
  perf: { label: 'Optimising', color: '#ffab70' },
  build: { label: 'Maintaining', color: '#a9b6d6' },
  ci: { label: 'Maintaining', color: '#a9b6d6' },
  revert: { label: 'Reverting', color: '#ff709f' },
  other: { label: 'Other', color: '#8b95aa' },
}

interface RepoAccumulator {
  dates: Set<string>
  weeks: Set<string>
  commits: number
  localCommits: number
  pullRequests: number
  mergedPullRequests: number
  reviews: number
  issues: number
  firstHalfActivity: number
  secondHalfActivity: number
}

function dateKey(value: string): string {
  return value.slice(0, 10)
}

function normalizedRepo(value: string): string {
  return value.toLowerCase().replace(/\.git$/i, '')
}

function weekKey(value: string): string {
  return format(startOfWeek(parseISO(dateKey(value)), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function rounded(value: number, digits = 0): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function confidenceScore(
  coverageScore: number,
  eventCount: number,
  observedWeeks: number,
): number {
  return Math.round(
    100 *
      (0.45 * coverageScore +
        0.2 +
        0.2 * Math.min(1, Math.sqrt(eventCount / 30)) +
        0.15 * Math.min(1, observedWeeks / 12)),
  )
}

function confidenceLabel(score: number): Confidence {
  if (score >= 80) return 'high'
  if (score >= 60) return 'medium'
  return 'low'
}

function calculateCoverage(raw: RawDataset): number {
  const required = raw.coverage.filter(
    (source) => source.id !== 'local-git' || source.status !== 'unavailable',
  )
  if (required.length === 0) return 0
  const score = required.reduce((total, source) => {
    if (source.status === 'complete') return total + 1
    if (source.status === 'partial') return total + 0.65
    return total
  }, 0)
  return rounded(score / required.length, 2)
}

function dedupeCommits(commits: RawCommit[]): {
  commits: RawCommit[]
  localOnly: RawCommit[]
} {
  const githubKeys = new Set(
    commits
      .filter((commit) => commit.source === 'github')
      .map((commit) => `${normalizedRepo(commit.repository)}:${commit.sha}`),
  )
  const merged = new Map<string, RawCommit>()

  for (const commit of commits) {
    const key = `${normalizedRepo(commit.repository)}:${commit.sha}`
    const existing = merged.get(key)
    if (!existing || commit.source === 'local-git') {
      merged.set(key, {
        ...(existing ?? commit),
        ...commit,
        source: existing?.source === 'github' ? 'github' : commit.source,
      })
    }
  }

  const localOnly = commits.filter(
    (commit) =>
      commit.source === 'local-git' &&
      !githubKeys.has(`${normalizedRepo(commit.repository)}:${commit.sha}`),
  )
  return { commits: [...merged.values()], localOnly }
}

function buildThemes(commits: RawCommit[]): ThemeMetric[] {
  const counts = new Map<string, number>()
  for (const commit of commits) {
    const normalized = ['build', 'ci'].includes(commit.features.type)
      ? 'chore'
      : commit.features.type
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }
  const total = commits.length || 1
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: THEME_META[key]?.label ?? THEME_META.other.label,
      count,
      share: rounded(count / total, 3),
      color: THEME_META[key]?.color ?? THEME_META.other.color,
    }))
    .sort((a, b) => b.count - a.count)
}

function buildArchetype(
  dna: DnaMetric[],
  themes: ThemeMetric[],
  stats: {
    pullRequests: number
    mergedPullRequests: number
    reviews: number
    repositories: number
  },
) {
  const value = (key: DnaMetric['key']) =>
    dna.find((metric) => metric.key === key)?.value ?? 0
  const maintenanceShare = themes
    .filter((theme) => ['fix', 'test', 'docs', 'refactor', 'chore'].includes(theme.key))
    .reduce((sum, theme) => sum + theme.share, 0)

  if (stats.reviews >= Math.max(12, stats.pullRequests * 1.25)) {
    return {
      name: 'The Force Multiplier',
      shortName: 'Force Multiplier',
      description:
        'Your visible trail leans toward unblocking, reviewing, and strengthening work across project boundaries.',
      signals: [
        `${stats.reviews} submitted reviews`,
        `${stats.pullRequests} authored pull requests`,
        `${stats.repositories} repositories in the activity map`,
      ],
    }
  }
  if (
    stats.mergedPullRequests >= 100 &&
    stats.reviews >= 100 &&
    stats.repositories >= 8
  ) {
    return {
      name: 'The Orchestration Architect',
      shortName: 'Orchestration Architect',
      description:
        'Your trace looks less like a single project sprint and more like an operating system for moving many changes through many repositories.',
      signals: [
        `${stats.mergedPullRequests} merged pull requests`,
        `${stats.reviews} reviews contributed`,
        `${stats.repositories} repositories in motion`,
      ],
    }
  }
  if (stats.repositories >= 9 && value('breadth') >= 65) {
    return {
      name: 'The Cross-Repo Navigator',
      shortName: 'Cross-Repo Navigator',
      description:
        'You move between systems while keeping enough continuity to turn many threads into shipped work.',
      signals: [
        `${stats.repositories} active repositories`,
        `${value('breadth')}% breadth signature`,
        `${stats.mergedPullRequests} merged pull requests`,
      ],
    }
  }
  if (maintenanceShare >= 0.48 && themes.length > 0) {
    return {
      name: 'The Systems Gardener',
      shortName: 'Systems Gardener',
      description:
        'A large share of your trace is the quiet craft of keeping systems correct, legible, tested, and ready for change.',
      signals: [
        `${Math.round(maintenanceShare * 100)}% maintenance-oriented commit signals`,
        `${value('stewardship')}% stewardship signature`,
        `${stats.reviews} reviews across the period`,
      ],
    }
  }
  if (
    stats.pullRequests >= 8 &&
    stats.mergedPullRequests / Math.max(1, stats.pullRequests) >= 0.78
  ) {
    return {
      name: 'The Release Closer',
      shortName: 'Release Closer',
      description:
        'Your public development trail repeatedly turns change proposals into integrated outcomes.',
      signals: [
        `${stats.mergedPullRequests} merged pull requests`,
        `${Math.round((stats.mergedPullRequests / stats.pullRequests) * 100)}% observed merge rate`,
        `${value('shipping')}% shipping signature`,
      ],
    }
  }
  if (value('focus') >= 65) {
    return {
      name: 'The Deep-System Builder',
      shortName: 'Deep-System Builder',
      description:
        'Your activity clusters around a small number of systems, favouring sustained attention over broad sampling.',
      signals: [
        `${value('focus')}% focus signature`,
        `${stats.repositories} repositories observed`,
        `${stats.mergedPullRequests} integrated changes`,
      ],
    }
  }

  return {
    name: 'The Product Cartographer',
    shortName: 'Product Cartographer',
    description:
      'Your work trace balances making, mapping, and refining—building a clearer route through evolving systems.',
    signals: [
      `${stats.repositories} repositories mapped`,
      `${stats.pullRequests} authored pull requests`,
      `${stats.reviews} reviews contributed`,
    ],
  }
}

function repoAccumulator(): RepoAccumulator {
  return {
    dates: new Set(),
    weeks: new Set(),
    commits: 0,
    localCommits: 0,
    pullRequests: 0,
    mergedPullRequests: 0,
    reviews: 0,
    issues: 0,
    firstHalfActivity: 0,
    secondHalfActivity: 0,
  }
}

function strongestMonth(activity: ActivityDay[]) {
  const months = new Map<string, number>()
  for (const day of activity) {
    const month = day.date.slice(0, 7)
    months.set(month, (months.get(month) ?? 0) + day.contributions + day.localCommits)
  }
  const winner = [...months.entries()].sort((a, b) => b[1] - a[1])[0]
  return winner
    ? { month: format(parseISO(`${winner[0]}-01`), 'MMMM yyyy'), contributions: winner[1] }
    : undefined
}

function longestStreak(activity: ActivityDay[]): number {
  let current = 0
  let longest = 0
  for (const day of activity) {
    const active =
      day.contributions +
        day.localCommits +
        day.pullRequests +
        day.reviews +
        day.issues >
      0
    current = active ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  return longest
}

function buildInsights(args: {
  coverageScore: number
  range: RangeKey
  activity: ActivityDay[]
  weekly: WeeklyActivity[]
  repositories: RepositoryMetric[]
  themes: ThemeMetric[]
  summary: DashboardData['summary']
}): Insight[] {
  const { activity, coverageScore, repositories, summary, themes, weekly } = args
  const insights: Insight[] = []
  const observedWeeks = weekly.filter((week) => week.total > 0).length
  const add = (
    insight: Omit<Insight, 'confidence' | 'score'> & { eventCount: number },
  ) => {
    const score = confidenceScore(
      coverageScore,
      insight.eventCount,
      observedWeeks,
    )
    const { eventCount: _eventCount, ...finding } = insight
    insights.push({ ...finding, score, confidence: confidenceLabel(score) })
  }

  const month = summary.strongestMonth
  add({
    id: 'rhythm-observed',
    order: 1,
    category: 'rhythm',
    eyebrow: 'Observed · rhythm',
    title: `${summary.activeWeeks} active weeks, with room to breathe`,
    body: month
      ? `${month.month} formed the strongest visible pulse. Your longest continuous contribution run was ${summary.longestStreak} days; this describes cadence, not effort or value.`
      : 'The selected period contains too little dated activity to name a stable rhythm.',
    evidence: [
      `${summary.activeDays} active days`,
      `${summary.activeWeeks} active weeks`,
      `${summary.longestStreak}-day longest streak`,
    ],
    caveat: 'GitHub timestamps and local Git metadata do not measure hours worked.',
    eventCount: summary.contributions,
  })

  const topRepo = repositories[0]
  add({
    id: 'portfolio-gravity',
    order: 1,
    category: 'focus',
    eyebrow: 'Observed · focus',
    title:
      summary.effectiveRepositories <= 5
        ? 'A few systems held most of the gravity'
        : 'Your attention formed a broad project constellation',
    body: topRepo
      ? `${topRepo.displayName} was the strongest gravity well, while the activity distribution behaves like roughly ${summary.effectiveRepositories} equally active repositories.`
      : 'No repository-level contribution trail was available for this window.',
    evidence: [
      `${summary.repositories} repositories observed`,
      `${summary.effectiveRepositories} effective repositories`,
      topRepo ? `${topRepo.displayName}: ${topRepo.engagement} engagement points` : 'No top repository',
    ],
    caveat: 'Engagement blends observed activity kinds; it is not an impact score.',
    eventCount: summary.commits + summary.pullRequests + summary.reviews,
  })

  add({
    id: 'delivery-shape',
    order: 1,
    category: 'delivery',
    eyebrow: 'Observed · delivery',
    title: `${summary.mergedPullRequests} changes crossed the merge line`,
    body:
      summary.medianMergeHours !== undefined
        ? `Among merged pull requests, the median observed creation-to-merge interval was ${summary.medianMergeHours < 24 ? `${rounded(summary.medianMergeHours, 1)} hours` : `${rounded(summary.medianMergeHours / 24, 1)} days`}. ${Math.round(summary.mergeRate * 100)}% of authored pull requests in this period are currently merged.`
        : 'No merged authored pull requests were available to estimate an observed delivery interval.',
    evidence: [
      `${summary.pullRequests} authored pull requests`,
      `${summary.mergedPullRequests} merged`,
      `${Math.round(summary.mergeRate * 100)}% observed merge rate`,
    ],
    caveat: 'Creation-to-merge time reflects repository process as well as the change itself.',
    eventCount: summary.pullRequests,
  })

  const reviewRatio = summary.reviews / Math.max(1, summary.pullRequests)
  add({
    id: 'collaboration-shape',
    order: 1,
    category: 'collaboration',
    eyebrow: 'Observed · collaboration',
    title:
      reviewRatio >= 1
        ? 'Review was a first-class part of your work'
        : 'Authored change led the collaboration mix',
    body: `You submitted ${summary.reviews} reviews alongside ${summary.pullRequests} authored pull requests—a ${rounded(reviewRatio, 1)} to 1 review-to-authoring ratio in the observable GitHub trail.`,
    evidence: [
      `${summary.reviews} submitted reviews`,
      `${summary.pullRequests} authored pull requests`,
      `${rounded(reviewRatio, 1)}× review-to-PR ratio`,
    ],
    caveat: 'A review count does not reveal review depth or whether it unblocked a merge.',
    eventCount: summary.reviews + summary.pullRequests,
  })

  const midpoint = Math.floor(activity.length / 2)
  const firstHalf = activity
    .slice(0, midpoint)
    .reduce((sum, day) => sum + day.contributions + day.localCommits, 0)
  const secondHalf = activity
    .slice(midpoint)
    .reduce((sum, day) => sum + day.contributions + day.localCommits, 0)
  const momentumRatio = (secondHalf + 0.5) / (firstHalf + 0.5)
  if (firstHalf + secondHalf >= 20 && (momentumRatio >= 1.35 || momentumRatio <= 0.74)) {
    add({
      id: 'momentum-shift',
      order: 2,
      category: 'trajectory',
      eyebrow: 'Derived · trajectory',
      title:
        momentumRatio >= 1.35
          ? 'The period gathered momentum as it unfolded'
          : 'The work arrived in a front-loaded wave',
      body:
        momentumRatio >= 1.35
          ? `The second half carried ${rounded(momentumRatio, 1)}× the contribution signal of the first, suggesting a meaningful shift in visible development cadence.`
          : `The first half carried ${rounded(1 / momentumRatio, 1)}× the contribution signal of the second. That can reflect completion, a deliberate pause, or work outside the observed sources.`,
      evidence: [
        `${firstHalf} first-half contribution signals`,
        `${secondHalf} second-half contribution signals`,
        `${rounded(momentumRatio, 2)}× second/first ratio`,
      ],
      caveat: 'This is a within-window comparison, not a forecast or productivity judgment.',
      eventCount: firstHalf + secondHalf,
    })
  }

  const rising = [...repositories]
    .filter((repo) => repo.firstHalfActivity + repo.secondHalfActivity >= 5)
    .sort((a, b) => b.momentum - a.momentum)[0]
  if (rising && rising.momentum >= 1.5 && rising.secondHalfActivity >= 5) {
    add({
      id: 'repo-emergence',
      order: 2,
      category: 'trajectory',
      eyebrow: 'Derived · plot twist',
      title:
        rising.firstHalfActivity < 2
          ? `${rising.displayName} entered the picture in the second half`
          : `${rising.displayName} became an emerging centre of gravity`,
      body:
        rising.firstHalfActivity < 2
          ? `No attributable activity appeared in the first half, followed by ${rising.secondHalfActivity} weighted signals in the second. That is an emergence pattern, not an infinite growth rate.`
          : `Its observable activity rose from ${rising.firstHalfActivity} signals in the first half to ${rising.secondHalfActivity} in the second—a ${rounded(rising.momentum, 1)}× shift.`,
      evidence: [
        `${rising.firstHalfActivity} first-half signals`,
        `${rising.secondHalfActivity} second-half signals`,
        rising.firstHalfActivity < 2
          ? 'Newly observed in the second half'
          : `${rounded(rising.momentum, 1)}× momentum`,
      ],
      caveat: 'Repository activity combines commits, PRs, reviews, and issues with transparent weights.',
      eventCount: rising.firstHalfActivity + rising.secondHalfActivity,
    })
  }

  const quietCraft = themes
    .filter((theme) => ['fix', 'docs', 'test', 'refactor', 'chore'].includes(theme.key))
    .reduce((sum, theme) => sum + theme.count, 0)
  const themedTotal = themes.reduce((sum, theme) => sum + theme.count, 0)
  if (themedTotal >= 10 && quietCraft / themedTotal >= 0.4) {
    add({
      id: 'quiet-craft',
      order: 2,
      category: 'craft',
      eyebrow: 'Derived · quiet craft',
      title: 'Much of the work was invisible infrastructure for future work',
      body: `${Math.round((quietCraft / themedTotal) * 100)}% of classified commit subjects carried repair, test, documentation, refactoring, or maintenance signals. That pattern is consistent with strengthening systems, not merely adding surface area.`,
      evidence: themes
        .filter((theme) => ['fix', 'docs', 'test', 'refactor', 'chore'].includes(theme.key))
        .slice(0, 3)
        .map((theme) => `${theme.label}: ${theme.count} commits`),
      caveat: 'Subject-line classification is heuristic and says nothing about change quality.',
      eventCount: themedTotal,
    })
  }

  const privateRepositories = repositories.filter((repo) => repo.isPrivate)
  const privateEngagement = privateRepositories.reduce(
    (sum, repo) => sum + repo.engagement,
    0,
  )
  const totalEngagement = repositories.reduce(
    (sum, repo) => sum + repo.engagement,
    0,
  )
  const privateEngagementShare = privateEngagement / Math.max(1, totalEngagement)
  if (privateRepositories.length > 0) {
    add({
      id: 'private-surface',
      order: 2,
      category: 'focus',
      eyebrow: 'Derived · hidden portfolio',
      title: 'The public profile was only part of the story',
      body: `${privateRepositories.length} of ${repositories.length} active repositories were private, carrying ${Math.round(privateEngagementShare * 100)}% of the repository-attributed engagement signal. Authenticated enrichment materially changes the visible portfolio.`,
      evidence: [
        `${privateRepositories.length} private active repositories`,
        `${Math.round(privateEngagementShare * 100)}% private engagement share`,
        `${repositories.length} total repositories with attributed activity`,
      ],
      caveat: 'Restricted GitHub calendar signals can remain unattributed even after repository enrichment.',
      eventCount: privateEngagement,
    })
  }

  const pullRequestsPerActiveDay =
    summary.pullRequests / Math.max(1, summary.activeDays)
  if (
    summary.pullRequests >= 50 &&
    summary.mergeRate >= 0.85 &&
    summary.medianMergeHours !== undefined &&
    summary.medianMergeHours <= 24
  ) {
    add({
      id: 'integration-loop',
      order: 2,
      category: 'delivery',
      eyebrow: 'Derived · delivery system',
      title: 'Integration behaved like a tight, repeatable loop',
      body: `${Math.round(summary.mergeRate * 100)}% of authored pull requests are merged, with a ${rounded(summary.medianMergeHours, 1)}-hour median observed interval and ${rounded(pullRequestsPerActiveDay, 1)} authored PRs per active day. The shape is consistent with small-batch, highly structured delivery.`,
      evidence: [
        `${summary.pullRequests} authored pull requests`,
        `${Math.round(summary.mergeRate * 100)}% observed merge rate`,
        `${rounded(summary.medianMergeHours, 1)}h median creation-to-merge`,
      ],
      caveat: 'Fast integration can reflect automation, repository convention, or PR granularity; it is not a quality measure.',
      eventCount: summary.pullRequests,
    })
  }

  const busiestCrossRepoWeek = [...weekly].sort(
    (a, b) => b.repositories - a.repositories || b.total - a.total,
  )[0]
  if (
    busiestCrossRepoWeek &&
    busiestCrossRepoWeek.repositories >= 8 &&
    repositories.length >= 12
  ) {
    add({
      id: 'cross-repo-wave',
      order: 2,
      category: 'trajectory',
      eyebrow: 'Derived · systems motion',
      title: 'Some work moved as a cross-repository wave',
      body: `The week of ${busiestCrossRepoWeek.label} carried observable activity across ${busiestCrossRepoWeek.repositories} repositories. That clustering is consistent with coordinated migrations, release trains, or shared-system changes rather than isolated feature work.`,
      evidence: [
        `${busiestCrossRepoWeek.repositories} repositories in one week`,
        `${busiestCrossRepoWeek.total} contribution signals that week`,
        `${repositories.length} repositories across the full window`,
      ],
      caveat: 'Temporal clustering cannot identify a shared cause without content-level evidence.',
      eventCount: busiestCrossRepoWeek.total,
    })
  }

  const activeDaySignals = activity
    .map((day) => day.contributions + day.localCommits)
    .filter((count) => count > 0)
    .sort((a, b) => b - a)
  const topTenDayShare =
    activeDaySignals.slice(0, 10).reduce((sum, count) => sum + count, 0) /
    Math.max(1, activeDaySignals.reduce((sum, count) => sum + count, 0))
  if (activeDaySignals.length >= 30 && topTenDayShare >= 0.3) {
    add({
      id: 'burst-cadence',
      order: 2,
      category: 'rhythm',
      eyebrow: 'Derived · cadence shape',
      title: 'The cadence mixed continuity with concentrated bursts',
      body: `The ten strongest days carried ${Math.round(topTenDayShare * 100)}% of dated contribution signals, while activity still appeared across ${summary.activeWeeks} weeks. The trace looks wave-shaped rather than uniform.`,
      evidence: [
        `${Math.round(topTenDayShare * 100)}% of signals on the top ten days`,
        `${summary.activeDays} active days`,
        `${summary.activeWeeks} active weeks`,
      ],
      caveat: 'Large automated or bulk commits can dominate GitHub day totals.',
      eventCount: summary.contributions,
    })
  }

  if (summary.localOnlyCommits > 0) {
    add({
      id: 'local-blind-spot',
      order: 2,
      category: 'craft',
      eyebrow: 'Derived · hidden work',
      title: `${summary.localOnlyCommits} commits existed beyond GitHub’s visible lens`,
      body: 'Explicit local enrichment found commits on local refs that were not present in the fetched GitHub commit set. The dashboard includes them without storing file paths or commit subjects.',
      evidence: [
        `${summary.localOnlyCommits} local-only commit identities`,
        `${summary.commits} total observed commits`,
        'Repository + SHA exact deduplication',
      ],
      caveat: 'Local-only can include unpushed branches, alternate default branches, or API attribution differences.',
      eventCount: summary.localOnlyCommits,
    })
  }

  const topShare = repositories.length
    ? repositories[0].engagement /
      Math.max(1, repositories.reduce((sum, repo) => sum + repo.engagement, 0))
    : 0
  if (
    rising &&
    quietCraft / Math.max(1, themedTotal) >= 0.45 &&
    topShare >= 0.25 &&
    summary.mergedPullRequests >= 8
  ) {
    add({
      id: 'sustained-stewardship-hypothesis',
      order: 3,
      category: 'trajectory',
      eyebrow: 'Hypothesis · pattern connection',
      title: 'The trace is consistent with a focused stewardship wave',
      body: `Three independent signals align: activity concentrated around a leading system, maintenance-oriented work was prominent, and ${summary.mergedPullRequests} authored changes reached merge. Together they suggest a period of consolidation and operational strengthening.`,
      evidence: [
        `${Math.round(topShare * 100)}% top-repository engagement share`,
        `${Math.round((quietCraft / themedTotal) * 100)}% quiet-craft commit signals`,
        `${summary.mergedPullRequests} merged pull requests`,
      ],
      caveat: 'This is a multi-signal hypothesis, not evidence of business impact or intent.',
      eventCount: summary.commits + summary.pullRequests,
    })
  }

  if (
    summary.pullRequests >= 100 &&
    summary.mergeRate >= 0.9 &&
    summary.reviews >= 100 &&
    repositories.length >= 10 &&
    busiestCrossRepoWeek?.repositories >= 8
  ) {
    add({
      id: 'orchestration-hypothesis',
      order: 3,
      category: 'trajectory',
      eyebrow: 'Hypothesis · operating model',
      title: 'The development trace is consistent with agent-shaped orchestration',
      body: `High PR throughput, rapid integration, a substantial review trail, and cross-repository waves all align. Together they suggest the central achievement was not only code—it was a repeatable system for coordinating code-producing and code-reviewing work across repositories.`,
      evidence: [
        `${summary.mergedPullRequests} merged pull requests`,
        `${summary.reviews} submitted reviews`,
        `${busiestCrossRepoWeek.repositories} repositories active in the strongest cross-repo week`,
      ],
      caveat: 'This inference describes the event shape. GitHub metadata alone cannot prove which work was agent-assisted.',
      eventCount:
        summary.pullRequests + summary.reviews + summary.commits,
    })
  }

  return insights.sort((a, b) => a.order - b.order || b.score - a.score)
}

export function analyzeDataset(raw: RawDataset): DashboardData {
  const fromDate = parseISO(raw.from)
  const toDate = parseISO(raw.to)
  const midpointTime = fromDate.getTime() + (toDate.getTime() - fromDate.getTime()) / 2
  const coverageScore = calculateCoverage(raw)
  const { commits: uniqueCommits, localOnly } = dedupeCommits(raw.commits)
  const dayMap = new Map<string, ActivityDay>()
  const repoMap = new Map(raw.repositories.map((repo) => [normalizedRepo(repo.nameWithOwner), repo]))
  const repoActivity = new Map<string, RepoAccumulator>()
  const weeklyRepos = new Map<string, Set<string>>()

  for (const date of eachDayOfInterval({ start: fromDate, end: toDate })) {
    const key = format(date, 'yyyy-MM-dd')
    dayMap.set(key, {
      date: key,
      contributions: 0,
      commits: 0,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
      localCommits: 0,
    })
  }
  for (const day of raw.contributionCalendar) {
    const target = dayMap.get(day.date)
    if (target) target.contributions = day.count
  }

  const touchRepo = (repository: string, occurredAt: string, weight: number) => {
    const key = normalizedRepo(repository)
    const date = dateKey(occurredAt)
    const week = weekKey(occurredAt)
    const stats = repoActivity.get(key) ?? repoAccumulator()
    stats.dates.add(date)
    stats.weeks.add(week)
    if (parseISO(occurredAt).getTime() < midpointTime) stats.firstHalfActivity += weight
    else stats.secondHalfActivity += weight
    repoActivity.set(key, stats)
    const repos = weeklyRepos.get(week) ?? new Set<string>()
    repos.add(key)
    weeklyRepos.set(week, repos)
  }

  for (const contribution of raw.commitDaysByRepository) {
    const day = dayMap.get(contribution.date)
    if (day) day.commits += contribution.count
    const key = normalizedRepo(contribution.repository)
    const stats = repoActivity.get(key) ?? repoAccumulator()
    stats.commits += contribution.count
    repoActivity.set(key, stats)
    touchRepo(contribution.repository, contribution.date, contribution.count)
  }
  for (const commit of localOnly) {
    const date = dateKey(commit.occurredAt)
    const day = dayMap.get(date)
    if (day) day.localCommits += 1
    const key = normalizedRepo(commit.repository)
    const stats = repoActivity.get(key) ?? repoAccumulator()
    stats.localCommits += 1
    repoActivity.set(key, stats)
    touchRepo(commit.repository, commit.occurredAt, 1)
  }
  for (const pullRequest of raw.pullRequests) {
    const day = dayMap.get(dateKey(pullRequest.createdAt))
    if (day) day.pullRequests += 1
    const key = normalizedRepo(pullRequest.repository)
    const stats = repoActivity.get(key) ?? repoAccumulator()
    stats.pullRequests += 1
    if (pullRequest.mergedAt) stats.mergedPullRequests += 1
    repoActivity.set(key, stats)
    touchRepo(pullRequest.repository, pullRequest.createdAt, 5)
  }
  for (const review of raw.reviews) {
    const day = dayMap.get(dateKey(review.occurredAt))
    if (day) day.reviews += 1
    const key = normalizedRepo(review.repository)
    const stats = repoActivity.get(key) ?? repoAccumulator()
    stats.reviews += 1
    repoActivity.set(key, stats)
    touchRepo(review.repository, review.occurredAt, 3)
  }
  for (const issue of raw.issues) {
    const day = dayMap.get(dateKey(issue.occurredAt))
    if (day) day.issues += 1
    const key = normalizedRepo(issue.repository)
    const stats = repoActivity.get(key) ?? repoAccumulator()
    stats.issues += 1
    repoActivity.set(key, stats)
    touchRepo(issue.repository, issue.occurredAt, 2)
  }

  const activity = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  const weeklyMap = new Map<string, WeeklyActivity>()
  for (const day of activity) {
    const key = weekKey(day.date)
    const total =
      day.contributions +
      day.localCommits +
      day.pullRequests +
      day.reviews +
      day.issues
    const week = weeklyMap.get(key) ?? {
      week: key,
      label: format(parseISO(key), 'd MMM'),
      total: 0,
      commits: 0,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
      activeDays: 0,
      repositories: 0,
    }
    week.total += total
    week.commits += day.commits + day.localCommits
    week.pullRequests += day.pullRequests
    week.reviews += day.reviews
    week.issues += day.issues
    if (total > 0) week.activeDays += 1
    weeklyMap.set(key, week)
  }
  for (const [key, week] of weeklyMap) {
    week.repositories = weeklyRepos.get(key)?.size ?? 0
  }
  const weekly = [...weeklyMap.values()].sort((a, b) => a.week.localeCompare(b.week))

  const repositories: RepositoryMetric[] = [...repoActivity.entries()]
    .map(([key, stats]) => {
      const rawRepository = repoMap.get(key)
      const nameWithOwner = rawRepository?.nameWithOwner ?? key
      const engagement =
        stats.commits +
        stats.localCommits +
        stats.pullRequests * 5 +
        stats.reviews * 3 +
        stats.issues * 2
      return {
        key,
        nameWithOwner,
        displayName: rawRepository?.name ?? nameWithOwner.split('/').at(-1) ?? nameWithOwner,
        url: rawRepository?.url,
        description: rawRepository?.description,
        isPrivate: rawRepository?.isPrivate ?? true,
        isArchived: rawRepository?.isArchived ?? false,
        isFork: rawRepository?.isFork ?? false,
        commits: stats.commits,
        localCommits: stats.localCommits,
        pullRequests: stats.pullRequests,
        mergedPullRequests: stats.mergedPullRequests,
        reviews: stats.reviews,
        issues: stats.issues,
        activeDays: stats.dates.size,
        activeWeeks: stats.weeks.size,
        firstHalfActivity: stats.firstHalfActivity,
        secondHalfActivity: stats.secondHalfActivity,
        momentum: rounded(
          (stats.secondHalfActivity + 0.5) / (stats.firstHalfActivity + 0.5),
          2,
        ),
        engagement,
        primaryLanguage: rawRepository?.primaryLanguage?.name,
        languageColor: rawRepository?.primaryLanguage?.color,
        topics: rawRepository?.topics ?? [],
      }
    })
    .sort((a, b) => b.engagement - a.engagement)

  const totalEngagement = repositories.reduce((sum, repo) => sum + repo.engagement, 0)
  const hhi = repositories.reduce((sum, repo) => {
    const share = repo.engagement / Math.max(1, totalEngagement)
    return sum + share * share
  }, 0)
  const effectiveRepositories = hhi > 0 ? rounded(1 / hhi, 1) : 0

  const languageMap = new Map<
    string,
    Omit<LanguageMetric, 'share'>
  >()
  for (const repo of repositories) {
    const rawRepository = repoMap.get(repo.key)
    const languages =
      rawRepository?.languages.length
        ? rawRepository.languages
        : rawRepository?.primaryLanguage
          ? [
              {
                name: rawRepository.primaryLanguage.name,
                color: rawRepository.primaryLanguage.color,
                size: 1,
              },
            ]
          : []
    const bytes = languages.reduce((sum, language) => sum + language.size, 0)
    for (const language of languages) {
      const current = languageMap.get(language.name) ?? {
        name: language.name,
        color: language.color ?? LANGUAGE_FALLBACKS[language.name] ?? '#96a2bd',
        bytes: 0,
        activityWeight: 0,
        repositoryCount: 0,
      }
      current.bytes += language.size
      current.activityWeight += repo.engagement * (language.size / Math.max(1, bytes))
      current.repositoryCount += 1
      languageMap.set(language.name, current)
    }
  }
  const totalLanguageWeight = [...languageMap.values()].reduce(
    (sum, language) => sum + language.activityWeight,
    0,
  )
  const languages = [...languageMap.values()]
    .map((language) => ({
      ...language,
      activityWeight: rounded(language.activityWeight, 1),
      share: rounded(language.activityWeight / Math.max(1, totalLanguageWeight), 3),
    }))
    .sort((a, b) => b.activityWeight - a.activityWeight)

  const githubCommitCount = raw.commitDaysByRepository.reduce(
    (sum, day) => sum + day.count,
    0,
  )
  const mergedPullRequests = raw.pullRequests.filter((pr) => pr.mergedAt)
  const mergeHours = mergedPullRequests
    .map((pr) => differenceInHours(parseISO(pr.mergedAt!), parseISO(pr.createdAt)))
    .filter((hours) => hours >= 0)
  const activeDays = activity.filter(
    (day) =>
      day.contributions +
        day.localCommits +
        day.pullRequests +
        day.reviews +
        day.issues >
      0,
  ).length
  const busiest = [...activity].sort(
    (a, b) => b.contributions + b.localCommits - (a.contributions + a.localCommits),
  )[0]
  const summary: DashboardData['summary'] = {
    contributions: raw.contributionTotal + localOnly.length,
    commits: githubCommitCount + localOnly.length,
    localOnlyCommits: localOnly.length,
    pullRequests: raw.pullRequests.length,
    mergedPullRequests: mergedPullRequests.length,
    mergeRate: rounded(mergedPullRequests.length / Math.max(1, raw.pullRequests.length), 3),
    reviews: raw.reviews.length,
    issues: raw.issues.length,
    activeDays,
    activeWeeks: weekly.filter((week) => week.total > 0).length,
    longestStreak: longestStreak(activity),
    repositories: repositories.length,
    privateRepositories: repositories.filter((repo) => repo.isPrivate).length,
    effectiveRepositories,
    medianMergeHours: median(mergeHours),
    busiestDay:
      busiest && busiest.contributions + busiest.localCommits > 0
        ? {
            date: busiest.date,
            contributions: busiest.contributions + busiest.localCommits,
          }
        : undefined,
    strongestMonth: strongestMonth(activity),
  }

  const topShare = repositories.length
    ? repositories[0].engagement / Math.max(1, totalEngagement)
    : 0
  const totalWeeks = Math.max(1, Math.ceil(differenceInCalendarDays(toDate, fromDate) / 7))
  const themes = buildThemes(uniqueCommits)
  const quietCraftShare = themes
    .filter((theme) => ['fix', 'docs', 'test', 'refactor', 'chore'].includes(theme.key))
    .reduce((sum, theme) => sum + theme.share, 0)
  const dna: DnaMetric[] = [
    {
      key: 'focus',
      label: 'Focus',
      value: Math.round(clamp(topShare * 125)),
      description: 'How strongly visible activity gathered around leading repositories.',
    },
    {
      key: 'shipping',
      label: 'Shipping',
      value: Math.round(
        clamp(summary.mergeRate * 70 + Math.min(30, summary.mergedPullRequests * 2)),
      ),
      description: 'The shape of authored pull requests reaching merge, not a quality score.',
    },
    {
      key: 'collaboration',
      label: 'Collaboration',
      value: Math.round(
        clamp(
          (summary.reviews / Math.max(1, summary.pullRequests + summary.reviews)) * 70 +
            Math.min(30, summary.reviews * 1.5),
        ),
      ),
      description: 'Review activity relative to authored changes in the observable trail.',
    },
    {
      key: 'consistency',
      label: 'Consistency',
      value: Math.round(clamp((summary.activeWeeks / totalWeeks) * 100)),
      description: 'Share of weeks with at least one visible development signal.',
    },
    {
      key: 'breadth',
      label: 'Breadth',
      value: Math.round(clamp((effectiveRepositories / 8) * 100)),
      description: 'Effective repository variety after accounting for concentration.',
    },
    {
      key: 'stewardship',
      label: 'Stewardship',
      value: Math.round(clamp(quietCraftShare * 100)),
      description: 'Repair, test, docs, refactor, and maintenance signals in commit subjects.',
    },
  ]

  const archetype = buildArchetype(dna, themes, {
    pullRequests: summary.pullRequests,
    mergedPullRequests: summary.mergedPullRequests,
    reviews: summary.reviews,
    repositories: summary.repositories,
  })
  const insights = buildInsights({
    coverageScore,
    range: raw.range,
    activity,
    weekly,
    repositories,
    themes,
    summary,
  })

  return {
    meta: {
      schemaVersion: 1,
      range: raw.range,
      from: raw.from,
      to: raw.to,
      generatedAt: new Date().toISOString(),
      mode: raw.subject.login === 'demo-builder' ? 'demo' : 'private',
      privacy: 'local-only',
      subject: raw.subject,
      coverageScore: Math.round(coverageScore * 100),
      coverage: raw.coverage,
      warnings: raw.warnings,
    },
    summary,
    activity,
    weekly,
    repositories,
    languages,
    pullRequests: raw.pullRequests
      .map((pr) => ({ ...pr }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    insights,
    dna,
    archetype,
    themes,
  }
}
