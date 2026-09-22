import type { DashboardData } from '../../shared/types.js'
import {
  DNA_KEYS,
  LENS_PROJECTION_PRODUCER,
  LENS_PROJECTION_SCHEMA_VERSION,
  LENS_PROJECTION_SHOWCASE_URL,
  THEME_KEYS,
  PublicLensProjectionSchema,
  computeLensInputHash,
  computeLensProjectionHash,
  mapCoverageWarnings,
  type LensThemeKey,
  type PublicLensProjection,
} from '../../shared/lensProjection.js'
import {
  createPortableExportPayload,
  type PortableExportPayload,
  type RepositoryRedaction,
} from './portableExportPayload.js'

/**
 * `PortableExportPayload` → `PublicLensProjection.v1`.
 *
 * A projection, not a re-computation: every value is read from the already-redacted portable
 * payload, rescaled where the contract uses a different unit (DNA `0..100` → `0..1`, momentum
 * `-100..100` → `-1..1`), and bounded. The only inputs from outside the payload are the ones the
 * payload does not carry: `generatedAt`, the free-text warnings (exported as registry codes only),
 * the open-work count behind the optional `delivery` block, and provenance.
 */

export const LENS_PROJECTION_REPOSITORY_LIMIT = 12
const NAMED_THEME_KEYS = new Set<string>(THEME_KEYS.filter((key) => key !== 'other'))

export interface PublicLensProjectionOptions {
  /** Any parseable instant; exported as canonical UTC seconds with a `Z` suffix. */
  generatedAt: string
  producerCommit: string
  producerVersion: string
  /** `DashboardMeta.warnings`; only their registry codes are exported. */
  warnings: readonly string[]
  /** Authored pull requests still open at collection. Absent means `delivery` is not exported. */
  openAtRangeEnd?: number
}

export function canonicalGeneratedAt(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('generatedAt is not a valid instant')
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Largest-remainder apportionment of 1000 thousandths across non-negative weights, ties broken by
 * input order. Independently rounded shares can sum past 1; apportioned shares sum to exactly 1
 * (or are all 0 when every weight is 0), so the contract's `sum <= 1.0001` bound always holds.
 */
export function apportionThousandths(weights: readonly number[]): number[] {
  const safe = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0))
  const total = safe.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return safe.map(() => 0)
  const exact = safe.map((weight) => (weight / total) * 1_000)
  const thousandths = exact.map((value) => Math.floor(value))
  let remaining = 1_000 - thousandths.reduce((sum, value) => sum + value, 0)
  const order = exact
    .map((value, index) => ({ index, remainder: value - thousandths[index] }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
  for (const { index } of order) {
    if (remaining <= 0) break
    thousandths[index] += 1
    remaining -= 1
  }
  return thousandths.map((value) => value / 1_000)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum
}

function projectThemes(themes: PortableExportPayload['themes']): PublicLensProjection['themes'] {
  const counts = new Map<LensThemeKey, { count: number; share: number }>()
  for (const theme of themes) {
    // `ThemeMetric.key` is an open string; every conventional-commit type outside the eight named
    // keys (style, wip, deps, ...) folds into `other` before export.
    const key = (NAMED_THEME_KEYS.has(theme.key) ? theme.key : 'other') as LensThemeKey
    const existing = counts.get(key) ?? { count: 0, share: 0 }
    counts.set(key, {
      count: existing.count + clamp(theme.count, 0, Number.MAX_SAFE_INTEGER),
      share: existing.share + clamp(theme.share, 0, 1),
    })
  }
  const keys = THEME_KEYS.filter((key) => counts.has(key))
  const byCount = keys.map((key) => counts.get(key)!.count)
  const weights = byCount.some((value) => value > 0) ? byCount : keys.map((key) => counts.get(key)!.share)
  const shares = apportionThousandths(weights)
  return keys
    .map((key, index) => ({ key, share: shares[index] }))
    .filter((_, index) => weights[index] > 0)
    .sort((left, right) => right.share - left.share || THEME_KEYS.indexOf(left.key) - THEME_KEYS.indexOf(right.key))
}

function projectRepositories(
  repositories: PortableExportPayload['repositories'],
): PublicLensProjection['repositories'] {
  const shares = apportionThousandths(repositories.map((repository) => repository.attentionShare))
  return repositories
    .map((repository, index) => ({ repository, index, share: shares[index] }))
    .sort((left, right) => right.share - left.share || left.index - right.index)
    .slice(0, LENS_PROJECTION_REPOSITORY_LIMIT)
    .map(({ repository, share }) => {
      const language = repository.primaryLanguage.trim()
      return {
        label: repository.label.slice(0, 40).trimEnd(),
        disclosure: repository.disclosure,
        ...(language && language !== 'Not detected' ? { primaryLanguage: language.slice(0, 32).trimEnd() } : {}),
        attentionShare: share,
        activeWeeks: Math.round(clamp(repository.activeWeeks, 0, 1_000_000)),
        momentum: clamp(Math.round(repository.momentum) / 100, -1, 1),
        mergedPullRequests: Math.round(clamp(repository.mergedPullRequests, 0, 1_000_000)),
        reviews: Math.round(clamp(repository.reviews, 0, 1_000_000)),
      }
    })
}

function projectNarratives(narratives: PortableExportPayload['narratives']): PublicLensProjection['narratives'] {
  // The portable payload may carry several narratives per order; the contract admits one per
  // order, so the first narrative of each order is kept.
  const byOrder = new Map<1 | 2 | 3, PortableExportPayload['narratives'][number]>()
  for (const narrative of narratives) if (!byOrder.has(narrative.order)) byOrder.set(narrative.order, narrative)
  return [...byOrder.values()]
    .sort((left, right) => left.order - right.order)
    .map(({ order, title, body, limitation }) => ({ order, title, body, limitation }))
}

/** Throws when the result violates any structural, semantic, provenance, or privacy rule. */
export function createPublicLensProjection(
  payload: PortableExportPayload,
  options: PublicLensProjectionOptions,
): PublicLensProjection {
  const publicDemo = payload.scope === 'public-demo'
  const dnaByKey = new Map(payload.dna.map((dimension) => [dimension.key, dimension.value]))
  const medianMergeHours = payload.summary.medianMergeHours
  const openAtRangeEnd = options.openAtRangeEnd
  const delivery =
    medianMergeHours !== null && openAtRangeEnd !== undefined && payload.summary.mergedPullRequests > 0
      ? {
          mergedSamples: payload.summary.mergedPullRequests,
          medianMergeHours,
          openAtRangeEnd,
          censored: openAtRangeEnd > 0,
        }
      : undefined
  const projection: PublicLensProjection = {
    schemaVersion: LENS_PROJECTION_SCHEMA_VERSION,
    dataClass: publicDemo ? 'C0' : 'C1',
    scope: payload.scope,
    generatedAt: canonicalGeneratedAt(options.generatedAt),
    range: payload.range,
    rangeLabel: payload.rangeLabel,
    repositoryRedaction: payload.repositoryRedaction,
    privacyNote: payload.privacyNote,
    summary: {
      commits: payload.summary.commits,
      mergedPullRequests: payload.summary.mergedPullRequests,
      reviews: payload.summary.reviews,
      issues: payload.summary.issues,
      activeDays: payload.summary.activeDays,
      activeWeeks: payload.summary.activeWeeks,
      repositories: payload.summary.repositories,
    },
    dna: DNA_KEYS.map((key) => ({ key, value: clamp(Math.round(dnaByKey.get(key) ?? 0) / 100, 0, 1) })) as PublicLensProjection['dna'],
    archetype: { name: payload.archetype.name, description: payload.archetype.description },
    repositories: projectRepositories(payload.repositories),
    themes: projectThemes(payload.themes),
    ...(delivery ? { delivery } : {}),
    narratives: projectNarratives(payload.narratives),
    coverage: {
      ...payload.coverage,
      scorePercent: payload.summary.coverageScore,
      warnings: mapCoverageWarnings(options.warnings) as PublicLensProjection['coverage']['warnings'],
    },
    provenance: {
      producer: LENS_PROJECTION_PRODUCER,
      producerVersion: options.producerVersion,
      producerCommit: options.producerCommit,
      inputHash: computeLensInputHash(payload),
      projectionHash: `sha256:${'0'.repeat(64)}`,
      ...(publicDemo ? { showcaseUrl: LENS_PROJECTION_SHOWCASE_URL } : {}),
    },
  }
  projection.provenance.projectionHash = computeLensProjectionHash(projection)
  return PublicLensProjectionSchema.parse(projection)
}

/** Authored pull requests still open when the dashboard was collected. */
export function openPullRequestsAtRangeEnd(dashboard: DashboardData): number {
  return dashboard.pullRequests.filter((pullRequest) => !pullRequest.mergedAt && !pullRequest.closedAt).length
}

export interface DashboardLensProjectionOptions {
  aliasSeed: string
  repositoryRedaction: RepositoryRedaction
  producerCommit: string
  producerVersion: string
  /** Defaults to the dashboard's own `meta.generatedAt`. */
  generatedAt?: string
}

/** Dashboard → redacted portable payload → projection, through the one portable redaction path. */
export function createPublicLensProjectionFromDashboard(
  dashboard: DashboardData,
  options: DashboardLensProjectionOptions,
): { payload: PortableExportPayload; projection: PublicLensProjection } {
  const payload = createPortableExportPayload(dashboard, {
    artifact: 'dashboard',
    aliasSeed: options.aliasSeed,
    repositoryRedaction: options.repositoryRedaction,
  })
  const projection = createPublicLensProjection(payload, {
    generatedAt: options.generatedAt ?? dashboard.meta.generatedAt,
    producerCommit: options.producerCommit,
    producerVersion: options.producerVersion,
    warnings: dashboard.meta.warnings,
    openAtRangeEnd: openPullRequestsAtRangeEnd(dashboard),
  })
  return { payload, projection }
}
