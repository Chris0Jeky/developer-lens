import { nearestRankQuantile } from './conformance.js'
import {
  evaluateDisplayEligibility,
  getMetricDefinition,
  MetricResultSchema,
  type MetricCoverageEntry,
  type MetricDisplayEligibility,
  type MetricResult,
  type MetricValue,
} from './metrics.js'
import type { CoverageLimitingReason } from './coverage.js'
import type {
  AlternativeExplanation,
  Finding,
  FindingRobustness,
  RenderedMark,
} from './findings.js'
import type { LimitationInstance } from './claims.js'

/**
 * Phase E (#174) — the second evidence-aware lens: change-batch size versus integration tail.
 *
 * A PURE, client-safe composition (no I/O, no clock, no SQLite, no `node:crypto`). It runs on the
 * server over the stored-observation bridge's rows and in the browser over the explicitly
 * synthetic public fixture, so the two paths cannot disagree about what the lens computes.
 *
 * The construct, stated exactly:
 * - Cohort: pull requests whose OPENING instant falls in the half-open window [start, end).
 *   Membership never depends on the merge or the close, so the risk set is not conditioned on the
 *   outcome. The stored schema records no ready-for-review instant, so the interval is named
 *   opened-to-merge and is never presented as the ready-to-merge integration interval.
 * - Outcome at the window end: merged before the end → an observed interval (merge − opening);
 *   closed without merge before the end → a COMPETING outcome, eligible but outside the merged
 *   sample and never censored; anything else (still open, or resolved only after the end) →
 *   right-censored at the end. A close outside the eligible window is therefore never counted as
 *   a competing outcome, and a pull request opened before the window is never eligible at all.
 * - Batch-size basis: additions + deletions (primary) with changed files as the sensitivity
 *   basis; declared fixed thresholds (primary) with data-derived value thirds as the binning
 *   sensitivity; nearest-rank p50/p75/p90 per stratum; a censoring-aware Harrell concordance
 *   between size and time to merge as the continuous rank measure.
 * - Support: a stratum distribution below five merged units is withheld (`suppress_display`);
 *   the lens abstains when the whole window is not vouched for by the coverage ledger, when the
 *   cohort has no displayable distribution, or when fewer than two strata can be shown.
 */
export const CHANGE_BATCH_TAIL_METHOD_ID = 'change_batch_tail' as const
export const CHANGE_BATCH_TAIL_METHOD_VERSION = '1.0.0' as const
export const CHANGE_BATCH_TAIL_VIEW_VERSION = '1.0.0' as const
export const CHANGE_BATCH_TAIL_QUESTION_ID = 'q_change_batch_tail' as const
export const CHANGE_BATCH_TAIL_METRIC = {
  metricId: 'pull_request.opened_to_merge_interval_by_change_stratum',
  version: '1.0.0',
} as const
export const CHANGE_BATCH_TAIL_METRIC_REFERENCE =
  `${CHANGE_BATCH_TAIL_METRIC.metricId}@${CHANGE_BATCH_TAIL_METRIC.version}` as const
export const CHANGE_BATCH_TAIL_PROCEDURE_ID = 'pull_request.opened_to_merge_stratum_quantiles_v1' as const
/** The marker an explicitly synthetic (public showcase) view carries. */
export const CHANGE_BATCH_TAIL_SYNTHETIC_MARKER = 'developer-lens.phase-e.synthetic-change-batch.v1' as const

/** Minimum merged units for a stratum distribution to be displayed (the metric's support gate). */
export const CHANGE_BATCH_MINIMUM_SUPPORT = 5
/** Minimum comparable pairs before the concordance is displayed. */
export const CHANGE_BATCH_MINIMUM_COMPARABLE_PAIRS = 10
const DECLARED_QUANTILES = [0.5, 0.75, 0.9] as const
/**
 * Declared materiality threshold for competing outcomes: when at least this share of a stratum's
 * eligible units closed without merge, its merged sample is a selected subset and the reading
 * carries a COVERAGE_SPARSE limitation on censoring_freedom (copy key competing_selected_sample).
 */
export const CHANGE_BATCH_MATERIAL_COMPETING_SHARE = 0.2

export const CHANGE_BATCH_QUESTION =
  'How does the tail of the opened-to-merge interval differ across change-batch sizes in this window?'

export const CHANGE_BATCH_COHORT_STATEMENT =
  'Pull requests opened inside the half-open window. Merge before the window end is the observed outcome; a close without merge before the window end is a competing outcome (eligible, outside the merged sample, never censored); every other eligible pull request is right-censored at the window end. The interval starts at opening because stored observations record no ready-for-review instant.'

export const CHANGE_BATCH_DECISIONS = {
  supported: [
    'Whether larger change batches in this window sat in a longer opened-to-merge tail than smaller ones, read as a queue property of this cohort.',
    'Whether that ordering survives a different size basis, data-derived bins, and counting still-open work at its lower bound.',
    'How much of the window the coverage ledger vouches for, and what was excluded, censored, or closed without merge.',
  ],
  unsupported: [
    'Any statement about a person, author, or reviewer; every number here describes a cohort of pull requests.',
    'That splitting a change would shorten its interval; the reading is associational and carries no cause.',
    'A size limit, target, or threshold for anyone.',
    'The ready-to-merge integration interval; the ready-for-review instant is not recorded in stored observations.',
    'Comparisons with other windows or repositories; this lens reads one window of one scope.',
  ],
} as const

/* ------------------------------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------------------------------ */

export type ChangeBatchRetention = 'live' | 'expired' | 'cleared'

export interface ChangeBatchUnit {
  readonly createdAt: string | null
  readonly mergedAt: string | null
  readonly closedAt: string | null
  readonly state: 'OPEN' | 'CLOSED' | 'MERGED'
  readonly isDraft: boolean
  readonly additions: number | null
  readonly deletions: number | null
  readonly changedFiles: number | null
  readonly retention: ChangeBatchRetention
}

export type ChangeBatchCoverageStatus = 'complete' | 'truncated' | 'failed' | 'restricted'

/** One coverage-ledger row, already named by presentation-local labels (never storage keys). */
export interface ChangeBatchCoverageRow {
  readonly label: string
  readonly jobLabel: string
  readonly consentLabel: string
  readonly instrumentLabel: string
  readonly status: ChangeBatchCoverageStatus
  readonly jobStatus: ChangeBatchCoverageStatus
  readonly snapshotClosed: boolean
  readonly expectedUnits: number | null
  readonly observedUnits: number
  readonly omittedUnits: number | null
  readonly saturationReason: string | null
  readonly limitationCode: string
  readonly retryable: boolean
  readonly rangeStart: string | null
  readonly rangeEnd: string | null
  readonly observedAt: string | null
  readonly retention: ChangeBatchRetention
}

export interface ChangeBatchLineageEvent {
  readonly subjectKind: string
  readonly eventKind: string
  readonly eventWeek: string
  readonly coverageLabel: string | null
  readonly jobLabel: string | null
}

export type ChangeBatchSource =
  | { readonly kind: 'synthetic'; readonly marker: typeof CHANGE_BATCH_TAIL_SYNTHETIC_MARKER }
  | { readonly kind: 'selected_v3_store' }

export interface ChangeBatchTailInput {
  readonly source: ChangeBatchSource
  /** Presentation-local scope surrogate. Never a storage scope key and never an alias. */
  readonly scopeSurrogate: string
  readonly scope: { readonly hasAlias: boolean; readonly linkedAt: string | null }
  readonly window: { readonly start: string; readonly end: string }
  readonly asOf: string
  readonly units: readonly ChangeBatchUnit[]
  readonly coverage: readonly ChangeBatchCoverageRow[]
  readonly lineage: readonly ChangeBatchLineageEvent[]
}

/* ------------------------------------------------------------------------------------------ *
 * Grain helpers (ADR-01: operational instants render at ISO-week grain or coarser)
 * ------------------------------------------------------------------------------------------ */

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS
const MONDAY_EPOCH_MS = Date.UTC(1970, 0, 5)

export function floorToWeek(instant: string): string {
  const at = Date.parse(instant)
  return new Date(at - ((((at - MONDAY_EPOCH_MS) % WEEK_MS) + WEEK_MS) % WEEK_MS)).toISOString()
}

export function ceilToWeek(instant: string): string {
  const floored = floorToWeek(instant)
  return floored === new Date(Date.parse(instant)).toISOString()
    ? floored
    : new Date(Date.parse(floored) + WEEK_MS).toISOString()
}

/** Monday 00:00Z of an ISO week label such as `2026-W27`. */
export function isoWeekStart(label: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(label)
  if (!match) return 'unknown'
  const year = Number(match[1])
  const week = Number(match[2])
  const jan4 = Date.UTC(year, 0, 4)
  const jan4Weekday = (new Date(jan4).getUTCDay() + 6) % 7
  const week1Monday = jan4 - jan4Weekday * DAY_MS
  return new Date(week1Monday + (week - 1) * WEEK_MS).toISOString()
}

export function isWeekAlignedInstant(instant: string): boolean {
  const at = Date.parse(instant)
  return !Number.isNaN(at) && (((at - MONDAY_EPOCH_MS) % WEEK_MS) + WEEK_MS) % WEEK_MS === 0
}

/* ------------------------------------------------------------------------------------------ *
 * Deterministic, content-free presentation identifiers
 * ------------------------------------------------------------------------------------------ */

/** FNV-1a (32-bit) over a string with a seed; eight seeds make a 64-hex presentation claim id. */
function fnv1a(value: string, seed: number): string {
  let hash = (0x811c9dc5 ^ seed) >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** A presentation-minted claim id (`cl_` + 64 hex). It names a view number, not a stored claim. */
export function presentationClaimId(material: string): string {
  let hex = ''
  for (let seed = 0; seed < 8; seed += 1) hex += fnv1a(`change-batch-tail/${material}`, seed * 0x9e3779b1)
  return `cl_${hex}`
}

/* ------------------------------------------------------------------------------------------ *
 * Strata
 * ------------------------------------------------------------------------------------------ */

export type ChangeBatchBasisId = 'lines_changed' | 'changed_files'
export type ChangeBatchBinningId = 'declared_thresholds' | 'value_thirds'

export interface ChangeBatchStratumSpec {
  readonly stratumId: 's1' | 's2' | 's3'
  readonly label: string
  /** Inclusive lower bound; null only for an empty data-derived stratum. */
  readonly lower: number | null
  /** Exclusive upper bound for declared thresholds, inclusive max for value thirds; null = open. */
  readonly upper: number | null
}

export const CHANGE_BATCH_BASES: Readonly<Record<ChangeBatchBasisId, { readonly label: string; readonly unitLabel: string }>> = {
  lines_changed: { label: 'Lines added plus deleted', unitLabel: 'lines' },
  changed_files: { label: 'Changed files', unitLabel: 'files' },
}

export const CHANGE_BATCH_BINNINGS: Readonly<Record<ChangeBatchBinningId, string>> = {
  declared_thresholds: 'Declared fixed thresholds',
  value_thirds: 'Data-derived value thirds (ties kept together)',
}

const DECLARED_THRESHOLDS: Readonly<Record<ChangeBatchBasisId, readonly [number, number]>> = {
  lines_changed: [50, 400],
  changed_files: [3, 10],
}

function basisValue(unit: ChangeBatchUnit, basis: ChangeBatchBasisId): number | null {
  if (basis === 'changed_files') return unit.changedFiles
  if (unit.additions === null || unit.deletions === null) return null
  return unit.additions + unit.deletions
}

function declaredStrata(basis: ChangeBatchBasisId): readonly ChangeBatchStratumSpec[] {
  const [low, high] = DECLARED_THRESHOLDS[basis]
  const unit = CHANGE_BATCH_BASES[basis].unitLabel
  return [
    { stratumId: 's1', label: `under ${low} ${unit}`, lower: 0, upper: low },
    { stratumId: 's2', label: `${low}–${high - 1} ${unit}`, lower: low, upper: high },
    { stratumId: 's3', label: `${high}+ ${unit}`, lower: high, upper: null },
  ]
}

function inDeclared(value: number, spec: ChangeBatchStratumSpec): boolean {
  return value >= (spec.lower ?? 0) && (spec.upper === null || value < spec.upper)
}

/**
 * Value thirds by midpoint rank over DISTINCT values, so tied sizes always share a stratum. The
 * assignment is monotone in the value; a stratum may be empty when ties or a small cohort make a
 * third impossible, and it then reports an empty or withheld reading rather than a fabricated one.
 */
function valueThirds(values: readonly number[], basis: ChangeBatchBasisId): {
  readonly strata: readonly ChangeBatchStratumSpec[]
  readonly assign: (value: number) => 's1' | 's2' | 's3'
} {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  const distinct = [...counts.keys()].sort((left, right) => left - right)
  const total = values.length
  const groupOf = new Map<number, 0 | 1 | 2>()
  let before = 0
  for (const value of distinct) {
    const after = before + (counts.get(value) ?? 0)
    const midpoint = (before + after) / 2
    groupOf.set(value, Math.min(2, Math.floor((midpoint * 3) / Math.max(total, 1))) as 0 | 1 | 2)
    before = after
  }
  const ids = ['s1', 's2', 's3'] as const
  const unit = CHANGE_BATCH_BASES[basis].unitLabel
  const strata = ids.map((stratumId, index) => {
    const members = distinct.filter((value) => groupOf.get(value) === index)
    if (members.length === 0) return { stratumId, label: `third ${index + 1} (empty)`, lower: null, upper: null }
    const lower = members[0]
    const upper = members[members.length - 1]
    return { stratumId, label: `third ${index + 1}: ${lower === upper ? `${lower}` : `${lower}–${upper}`} ${unit}`, lower, upper }
  })
  return {
    strata,
    assign: (value) => ids[groupOf.get(value) ?? 2],
  }
}

/* ------------------------------------------------------------------------------------------ *
 * Unit classification
 * ------------------------------------------------------------------------------------------ */

export type ChangeBatchExclusion =
  | 'OPENED_OUTSIDE_WINDOW'
  | 'MISSING_OPEN_TIMESTAMP'
  | 'RETENTION_EXPIRED'
  | 'LIFECYCLE_INCONSISTENT'

export type ChangeBatchOutcome = 'merged' | 'competing' | 'censored'

interface ClassifiedUnit {
  readonly unit: ChangeBatchUnit
  readonly exclusion: ChangeBatchExclusion | null
  readonly outcome: ChangeBatchOutcome | null
  /** Seconds from opening to merge (merged), to close (competing), or to the window end (censored). */
  readonly observedSeconds: number | null
}

const ms = (instant: string): number => Date.parse(instant)

function lifecycleConsistent(unit: ChangeBatchUnit): boolean {
  const created = ms(unit.createdAt as string)
  if (unit.mergedAt !== null && ms(unit.mergedAt) < created) return false
  if (unit.closedAt !== null && ms(unit.closedAt) < created) return false
  if (unit.state === 'MERGED' && unit.mergedAt === null) return false
  if (unit.state === 'CLOSED' && (unit.closedAt === null || unit.mergedAt !== null)) return false
  if (unit.state === 'OPEN' && (unit.mergedAt !== null || unit.closedAt !== null)) return false
  return true
}

function classify(unit: ChangeBatchUnit, window: { start: string; end: string }): ClassifiedUnit {
  if (unit.retention === 'cleared' || unit.createdAt === null) {
    return { unit, exclusion: 'MISSING_OPEN_TIMESTAMP', outcome: null, observedSeconds: null }
  }
  if (unit.retention === 'expired') {
    // Past its retention boundary at asOf: its timestamps may not be read, even for membership.
    return { unit, exclusion: 'RETENTION_EXPIRED', outcome: null, observedSeconds: null }
  }
  const created = ms(unit.createdAt)
  if (!(created >= ms(window.start) && created < ms(window.end))) {
    return { unit, exclusion: 'OPENED_OUTSIDE_WINDOW', outcome: null, observedSeconds: null }
  }
  if (!lifecycleConsistent(unit)) {
    return { unit, exclusion: 'LIFECYCLE_INCONSISTENT', outcome: null, observedSeconds: null }
  }
  const end = ms(window.end)
  if (unit.mergedAt !== null && ms(unit.mergedAt) < end) {
    return { unit, exclusion: null, outcome: 'merged', observedSeconds: (ms(unit.mergedAt) - created) / 1000 }
  }
  if (unit.mergedAt === null && unit.closedAt !== null && ms(unit.closedAt) < end) {
    return { unit, exclusion: null, outcome: 'competing', observedSeconds: (ms(unit.closedAt) - created) / 1000 }
  }
  return { unit, exclusion: null, outcome: 'censored', observedSeconds: (end - created) / 1000 }
}

/* ------------------------------------------------------------------------------------------ *
 * Coverage derived from the coverage ledger
 * ------------------------------------------------------------------------------------------ */

export interface ChangeBatchCoverageRowView {
  readonly label: string
  readonly jobLabel: string
  readonly status: ChangeBatchCoverageStatus
  readonly jobStatus: ChangeBatchCoverageStatus
  readonly retention: ChangeBatchRetention
  /** Week-grained, clipped to the window; null when the row's range was cleared at retention. */
  readonly rangeStartWeek: string | null
  readonly rangeEndWeek: string | null
  readonly overlapsWindow: boolean | null
  readonly vouches: boolean
  readonly notVouchingReason: CoverageLimitingReason | null
}

export interface ChangeBatchWindowCoverage {
  /** Window-level dimensions; `sample` and `censoring_freedom` are added per result. */
  readonly permission: MetricCoverageEntry
  readonly completeness: MetricCoverageEntry
  readonly eligibility: MetricCoverageEntry
  readonly freshness: MetricCoverageEntry
  readonly rows: readonly ChangeBatchCoverageRowView[]
  readonly consentRevisions: number
  readonly instrumentRevisions: number
}

const GAP_REASON_PRIORITY: readonly CoverageLimitingReason[] = [
  'RESTRICTED',
  'FAILED',
  'DELETED',
  'SATURATION_CAP_REACHED',
  'EXPECTED_UNITS_UNKNOWN',
  'UNAVAILABLE',
]

function rowVouches(row: ChangeBatchCoverageRow): { vouches: boolean; reason: CoverageLimitingReason | null } {
  if (row.retention !== 'live' || row.rangeStart === null || row.rangeEnd === null) return { vouches: false, reason: 'DELETED' }
  if (row.status === 'restricted' || row.jobStatus === 'restricted') return { vouches: false, reason: 'RESTRICTED' }
  if (row.status === 'failed' || row.jobStatus === 'failed') return { vouches: false, reason: 'FAILED' }
  if (row.status === 'truncated' || row.jobStatus === 'truncated' || row.saturationReason !== null) {
    return { vouches: false, reason: 'SATURATION_CAP_REACHED' }
  }
  if (row.expectedUnits === null) return { vouches: false, reason: 'EXPECTED_UNITS_UNKNOWN' }
  if (
    !row.snapshotClosed
    || row.observedUnits !== row.expectedUnits
    || row.omittedUnits !== 0
    || row.observedAt === null
    // A row observed before its own range ended cannot vouch for the part it never saw.
    || ms(row.observedAt) < ms(row.rangeEnd)
  ) return { vouches: false, reason: 'UNAVAILABLE' }
  return { vouches: true, reason: null }
}

function unionLength(intervals: ReadonlyArray<readonly [number, number]>): number {
  const sorted = [...intervals].filter(([start, end]) => end > start).sort((left, right) => left[0] - right[0])
  let total = 0
  let currentStart: number | null = null
  let currentEnd = 0
  for (const [start, end] of sorted) {
    if (currentStart === null || start > currentEnd) {
      if (currentStart !== null) total += currentEnd - currentStart
      currentStart = start
      currentEnd = end
    } else if (end > currentEnd) {
      currentEnd = end
    }
  }
  if (currentStart !== null) total += currentEnd - currentStart
  return total
}

/** A ratio floored to four decimals, and exactly 1 only when the numerator is the whole. */
function ratio(part: number, whole: number): number {
  if (whole <= 0) return 1
  if (part >= whole) return 1
  return Math.floor((part / whole) * 10_000) / 10_000
}

function weekClip(instant: string, window: { start: string; end: string }, side: 'start' | 'end'): string {
  const clipped = side === 'start'
    ? new Date(Math.max(ms(instant), ms(window.start))).toISOString()
    : new Date(Math.min(ms(instant), ms(window.end))).toISOString()
  if (clipped === window.start || clipped === window.end) return clipped
  return side === 'start' ? floorToWeek(clipped) : ceilToWeek(clipped)
}

export function deriveWindowCoverage(input: ChangeBatchTailInput, classified: readonly ClassifiedUnit[]): ChangeBatchWindowCoverage {
  const windowStart = ms(input.window.start)
  const windowEnd = ms(input.window.end)
  const windowLength = windowEnd - windowStart
  const vouching: Array<readonly [number, number]> = []
  const restricted: Array<readonly [number, number]> = []
  const gapReasons = new Set<CoverageLimitingReason>()
  const rows: ChangeBatchCoverageRowView[] = input.coverage.map((row) => {
    const { vouches, reason } = rowVouches(row)
    let overlapsWindow: boolean | null = null
    let rangeStartWeek: string | null = null
    let rangeEndWeek: string | null = null
    if (row.rangeStart !== null && row.rangeEnd !== null) {
      const start = Math.max(ms(row.rangeStart), windowStart)
      const end = Math.min(ms(row.rangeEnd), windowEnd)
      overlapsWindow = end > start
      if (overlapsWindow) {
        rangeStartWeek = weekClip(row.rangeStart, input.window, 'start')
        rangeEndWeek = weekClip(row.rangeEnd, input.window, 'end')
        if (vouches) vouching.push([start, end])
        else if (reason !== null) gapReasons.add(reason)
        if (row.status === 'restricted' || row.jobStatus === 'restricted') restricted.push([start, end])
      }
    } else if (reason !== null) {
      // A cleared row cannot be placed, but it still explains a gap it may have covered.
      gapReasons.add(reason)
    }
    return {
      label: row.label,
      jobLabel: row.jobLabel,
      status: row.status,
      jobStatus: row.jobStatus,
      retention: row.retention,
      rangeStartWeek,
      rangeEndWeek,
      overlapsWindow,
      vouches: vouches && overlapsWindow === true,
      notVouchingReason: vouches ? null : reason,
    }
  })

  const covered = unionLength(vouching)
  const completenessValue = ratio(covered, windowLength)
  const gapReason = completenessValue === 1
    ? null
    : GAP_REASON_PRIORITY.find((candidate) => gapReasons.has(candidate)) ?? 'UNAVAILABLE'
  const restrictedLength = unionLength(restricted)
  const permissionValue = restrictedLength === 0 ? 1 : ratio(windowLength - restrictedLength, windowLength)

  const undecidable = classified.filter((entry) =>
    entry.exclusion === 'MISSING_OPEN_TIMESTAMP' || entry.exclusion === 'RETENTION_EXPIRED' || entry.exclusion === 'LIFECYCLE_INCONSISTENT').length
  // The denominator is the window's CANDIDATE set: rows placed outside the window say nothing
  // about how well this window's cohort could be decided, so they neither dilute nor inflate it.
  const candidates = classified.filter((entry) => entry.exclusion !== 'OPENED_OUTSIDE_WINDOW').length
  const eligibilityValue = ratio(candidates - undecidable, candidates)
  const retentionLoss = classified.some((entry) => entry.exclusion === 'MISSING_OPEN_TIMESTAMP' || entry.exclusion === 'RETENTION_EXPIRED')

  const vouchingRows = input.coverage.filter((row) => rowVouches(row).vouches && row.rangeStart !== null)
  return {
    permission: { dimension: 'permission', value: permissionValue, limiting_reason: permissionValue === 1 ? null : 'RESTRICTED' },
    completeness: { dimension: 'completeness', value: completenessValue, limiting_reason: gapReason },
    eligibility: {
      dimension: 'eligibility',
      value: eligibilityValue,
      limiting_reason: eligibilityValue === 1 ? null : retentionLoss ? 'DELETED' : 'ELIGIBILITY_RULE_UNRESOLVED',
    },
    freshness: covered === 0
      ? { dimension: 'freshness', value: null, limiting_reason: 'NO_COLLECTION_TIMESTAMP' }
      : { dimension: 'freshness', value: 1, limiting_reason: null },
    rows,
    consentRevisions: new Set(vouchingRows.map((row) => row.consentLabel)).size,
    instrumentRevisions: new Set(vouchingRows.map((row) => row.instrumentLabel)).size,
  }
}

/* ------------------------------------------------------------------------------------------ *
 * Stratum results — each one a registry-validated MetricResult
 * ------------------------------------------------------------------------------------------ */

export interface ChangeBatchStratumReading {
  readonly basisId: ChangeBatchBasisId | 'all'
  readonly binningId: ChangeBatchBinningId | 'all'
  readonly stratum: ChangeBatchStratumSpec | null
  readonly result: MetricResult
  readonly display: MetricDisplayEligibility
  readonly merged: number
  readonly censored: number
  readonly competing: number
  /** p90 with censored units added at their observed lower bound; null when withheld. */
  readonly lowerBoundP90: number | null
}

function quantilesOf(values: readonly number[]): Array<{ quantile: number; value: number }> | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  return DECLARED_QUANTILES.map((quantile) => ({ quantile, value: nearestRankQuantile(sorted, quantile) }))
}

function countExclusions(entries: ReadonlyMap<string, number>): Array<{ reasonCode: string; count: number }> {
  return [...entries.entries()].filter(([, count]) => count > 0).map(([reasonCode, count]) => ({ reasonCode, count }))
}

function resultIdFor(basisId: string, binningId: string, stratumId: string | null): string {
  return stratumId === null ? 'cbt.all' : `cbt.${basisId}.${binningId}.${stratumId}`
}

function computeStratum(
  input: ChangeBatchTailInput,
  classified: readonly ClassifiedUnit[],
  coverage: ChangeBatchWindowCoverage,
  membership: { basisId: ChangeBatchBasisId | 'all'; binningId: ChangeBatchBinningId | 'all'; stratum: ChangeBatchStratumSpec | null; stratumOf: ((unit: ChangeBatchUnit) => 's1' | 's2' | 's3' | null) | null },
): ChangeBatchStratumReading {
  const excluded = new Map<string, number>()
  const add = (code: string): void => { excluded.set(code, (excluded.get(code) ?? 0) + 1) }
  const members: ClassifiedUnit[] = []
  for (const entry of classified) {
    if (entry.exclusion !== null) { add(entry.exclusion); continue }
    if (membership.stratumOf !== null && membership.stratum !== null) {
      const stratumId = membership.stratumOf(entry.unit)
      if (stratumId === null) { add('SIZE_BASIS_MISSING'); continue }
      if (stratumId !== membership.stratum.stratumId) { add('OTHER_SIZE_STRATUM'); continue }
    }
    members.push(entry)
  }
  const eligible = members.length
  const mergedDurations = members.filter((entry) => entry.outcome === 'merged').map((entry) => entry.observedSeconds as number)
  const censoredUnits = members.filter((entry) => entry.outcome === 'censored')
  const censored = censoredUnits.length
  const competing = members.filter((entry) => entry.outcome === 'competing').length
  const lowerBound = [...mergedDurations, ...censoredUnits.map((entry) => entry.observedSeconds as number)]

  const windowFullyCovered = coverage.completeness.value === 1
  const windowEntries = [coverage.permission, coverage.completeness, coverage.eligibility, coverage.freshness]
  const allWindowComplete = windowEntries.every((entry) => entry.value === 1 && entry.limiting_reason === null)
  const sampleSize = mergedDurations.length
  const empty = eligible === 0

  let state: MetricResult['state']
  let stateReasonCode: string
  let value: MetricValue
  if (!windowFullyCovered) {
    state = 'truncated'
    stateReasonCode = 'WINDOW_COVERAGE_INCOMPLETE'
    value = { kind: 'no_value', reasonCode: 'WINDOW_COVERAGE_INCOMPLETE' }
  } else if (empty && allWindowComplete) {
    state = 'empty_eligible_cohort'
    stateReasonCode = 'EMPTY_ELIGIBLE_COHORT'
    value = { kind: 'quantiles', sampleSize: 0, quantiles: null }
  } else if (empty) {
    // An observed zero is only claimable under complete coverage on every declared dimension.
    state = 'unavailable'
    stateReasonCode = 'EMPTY_UNDER_LIMITED_COVERAGE'
    value = { kind: 'no_value', reasonCode: 'EMPTY_UNDER_LIMITED_COVERAGE' }
  } else if (censored === eligible) {
    state = 'censored_only'
    stateReasonCode = 'ALL_ELIGIBLE_EVENTS_CENSORED'
    value = { kind: 'no_value', reasonCode: 'ALL_ELIGIBLE_EVENTS_CENSORED' }
  } else {
    state = 'observed'
    stateReasonCode = 'OBSERVED'
    value = { kind: 'quantiles', sampleSize, quantiles: quantilesOf(mergedDurations) }
  }

  const exempt = state === 'empty_eligible_cohort'
  const sampleEntry: MetricCoverageEntry = exempt || sampleSize >= CHANGE_BATCH_MINIMUM_SUPPORT
    ? { dimension: 'sample', value: 1, limiting_reason: null }
    : { dimension: 'sample', value: ratio(sampleSize, CHANGE_BATCH_MINIMUM_SUPPORT), limiting_reason: 'SAMPLE_BELOW_MINIMUM' }
  // `censoring_freedom` is registered as "1 = no censoring in the window" (shared/coverage.ts), so
  // it counts right-censored units only. A material closed-without-merge share is disclosed
  // separately (SELECTED_MERGED_SAMPLE alternative + COVERAGE_SPARSE limitation), never folded here.
  const censoringEntry: MetricCoverageEntry = {
    dimension: 'censoring_freedom',
    value: eligible === 0 ? 1 : ratio(eligible - censored, eligible),
    limiting_reason: null,
  }
  const resultId = resultIdFor(membership.basisId, membership.binningId, membership.stratum?.stratumId ?? null)
  const lowerBoundQuantiles = quantilesOf(lowerBound)
  const candidate = {
    resultId,
    metricId: CHANGE_BATCH_TAIL_METRIC.metricId,
    metricVersion: CHANGE_BATCH_TAIL_METRIC.version,
    scopeAlias: input.scopeSurrogate,
    window: { start: input.window.start, end: input.window.end },
    asOf: input.asOf,
    state,
    stateReasonCode,
    counts: { eligible, censored, excluded: countExclusions(excluded) },
    value,
    coverage: [coverage.permission, coverage.completeness, coverage.eligibility, coverage.freshness, censoringEntry, sampleEntry],
    evidenceIds: [evidenceIdFor(membership.basisId, membership.binningId, membership.stratum?.stratumId ?? null, 'opened')],
    calculation: {
      procedureId: CHANGE_BATCH_TAIL_PROCEDURE_ID,
      metricContractVersion: CHANGE_BATCH_TAIL_METRIC.version,
      engineVersion: CHANGE_BATCH_TAIL_METHOD_VERSION,
    },
    sensitivity: state === 'observed'
      ? [{
          variantId: 'OPEN_AT_LOWER_BOUND',
          state,
          value: { kind: 'quantiles', sampleSize: lowerBound.length, quantiles: lowerBoundQuantiles },
        }]
      : [],
  }
  const result = MetricResultSchema.parse(candidate)
  const display = evaluateDisplayEligibility(getMetricDefinition(CHANGE_BATCH_TAIL_METRIC_REFERENCE), result)
  return {
    basisId: membership.basisId,
    binningId: membership.binningId,
    stratum: membership.stratum,
    result,
    display,
    merged: sampleSize,
    censored,
    competing,
    // Its own support gate: the lower-bound sample (merged plus censored-at-bound) must reach the
    // minimum support, independent of the merged-only display gate, so a stratum with few merges
    // but many still-open units still moves the OPEN_AT_LOWER_BOUND check. A withheld stratum never
    // DISPLAYS this value (the view nulls it); it feeds the sensitivity ordering only.
    lowerBoundP90: (state === 'observed' || state === 'censored_only')
      && lowerBound.length >= CHANGE_BATCH_MINIMUM_SUPPORT
      && lowerBoundQuantiles !== null
      ? lowerBoundQuantiles[lowerBoundQuantiles.length - 1].value
      : null,
  }
}

export function evidenceIdFor(
  basisId: string,
  binningId: string,
  stratumId: string | null,
  facet: 'opened' | 'merged' | 'open_tail' | 'competing' | 'coverage',
): string {
  return stratumId === null ? `ev.cbt.all.${facet}` : `ev.cbt.${basisId}.${binningId}.${stratumId}.${facet}`
}

/* ------------------------------------------------------------------------------------------ *
 * Concordance — the continuous, censoring-aware rank measure
 * ------------------------------------------------------------------------------------------ */

export interface ChangeBatchConcordance {
  readonly basisId: ChangeBatchBasisId
  readonly shown: boolean
  readonly reasonCode: 'SHOWN' | 'BELOW_MINIMUM_SUPPORT' | 'TOO_FEW_COMPARABLE_PAIRS' | 'WINDOW_NOT_DISPLAYABLE'
  /** Harrell's C: share of comparable pairs in which the smaller batch merged first (ties = ½). */
  readonly value: number | null
  readonly comparablePairs: number
  readonly concordantPairs: number
  readonly tiedSizePairs: number
  readonly mergedEvents: number
}

function concordance(
  classified: readonly ClassifiedUnit[],
  basisId: ChangeBatchBasisId,
  windowDisplayable: boolean,
): ChangeBatchConcordance {
  const units = classified
    .filter((entry) => entry.exclusion === null)
    .map((entry) => ({ size: basisValue(entry.unit, basisId), time: entry.observedSeconds as number, event: entry.outcome === 'merged' }))
    .filter((entry): entry is { size: number; time: number; event: boolean } => entry.size !== null)
  let comparable = 0
  let concordant = 0
  let tied = 0
  for (const first of units) {
    if (!first.event) continue
    for (const second of units) {
      if (first === second) continue
      // Cause-specific: a close without merge ends observation, so it is never an event here.
      const firstEarlier = first.time < second.time || (first.time === second.time && !second.event)
      if (!firstEarlier) continue
      comparable += 1
      if (first.size < second.size) concordant += 1
      else if (first.size === second.size) tied += 1
    }
  }
  const mergedEvents = units.filter((entry) => entry.event).length
  const base = { basisId, comparablePairs: comparable, concordantPairs: concordant, tiedSizePairs: tied, mergedEvents }
  if (!windowDisplayable) return { ...base, shown: false, reasonCode: 'WINDOW_NOT_DISPLAYABLE', value: null }
  if (mergedEvents < CHANGE_BATCH_MINIMUM_SUPPORT) return { ...base, shown: false, reasonCode: 'BELOW_MINIMUM_SUPPORT', value: null }
  if (comparable < CHANGE_BATCH_MINIMUM_COMPARABLE_PAIRS) return { ...base, shown: false, reasonCode: 'TOO_FEW_COMPARABLE_PAIRS', value: null }
  return { ...base, shown: true, reasonCode: 'SHOWN', value: Math.round(((concordant + tied / 2) / comparable) * 1000) / 1000 }
}

/* ------------------------------------------------------------------------------------------ *
 * The analysis
 * ------------------------------------------------------------------------------------------ */

export interface ChangeBatchBinningReading {
  readonly basisId: ChangeBatchBasisId
  readonly binningId: ChangeBatchBinningId
  readonly role: 'primary' | 'sensitivity'
  readonly strata: readonly ChangeBatchStratumReading[]
  /** sign(p90 of the largest displayable stratum − p90 of the smallest), or null if < 2 shown. */
  readonly tailOrdering: -1 | 0 | 1 | null
  readonly lowerBoundTailOrdering: -1 | 0 | 1 | null
}

export type ChangeBatchAbstentionReason =
  | 'WINDOW_COVERAGE_INCOMPLETE'
  | 'EMPTY_ELIGIBLE_COHORT'
  | 'EMPTY_UNDER_LIMITED_COVERAGE'
  | 'ALL_ELIGIBLE_EVENTS_CENSORED'
  | 'BELOW_MINIMUM_SUPPORT'
  | 'TOO_FEW_DISPLAYABLE_STRATA'
  | 'COHORT_NOT_DISPLAYABLE'

export interface ChangeBatchTailAnalysis {
  readonly input: ChangeBatchTailInput
  readonly all: ChangeBatchStratumReading
  readonly coverage: ChangeBatchWindowCoverage
  readonly binnings: readonly ChangeBatchBinningReading[]
  readonly concordance: readonly ChangeBatchConcordance[]
  readonly abstention: ChangeBatchAbstentionReason | null
  readonly draftsStillOpen: number
}

function sign(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0
}

function ordering(
  strata: readonly ChangeBatchStratumReading[],
  pick: (reading: ChangeBatchStratumReading) => number | null,
  admit: (reading: ChangeBatchStratumReading) => boolean = (reading) => reading.display.display && reading.result.state === 'observed',
): -1 | 0 | 1 | null {
  const shown = strata
    .map((reading) => ({ reading, value: admit(reading) ? pick(reading) : null }))
    .filter((entry): entry is { reading: ChangeBatchStratumReading; value: number } => entry.value !== null)
  if (shown.length < 2) return null
  return sign(shown[shown.length - 1].value - shown[0].value)
}

function p90Of(reading: ChangeBatchStratumReading): number | null {
  const value = reading.result.value
  if (value.kind !== 'quantiles' || value.quantiles === null) return null
  return value.quantiles.find((entry) => entry.quantile === 0.9)?.value ?? null
}

export function analyzeChangeBatchTail(input: ChangeBatchTailInput): ChangeBatchTailAnalysis {
  if (!(ms(input.window.start) < ms(input.window.end)) || ms(input.asOf) < ms(input.window.end)) {
    throw new Error('change-batch lens requires a completed half-open window at the injected asOf')
  }
  const classified = input.units.map((unit) => classify(unit, input.window))
  const coverage = deriveWindowCoverage(input, classified)
  const all = computeStratum(input, classified, coverage, { basisId: 'all', binningId: 'all', stratum: null, stratumOf: null })

  const binnings: ChangeBatchBinningReading[] = []
  for (const basisId of ['lines_changed', 'changed_files'] as const) {
    for (const binningId of ['declared_thresholds', 'value_thirds'] as const) {
      let strata: readonly ChangeBatchStratumSpec[]
      let stratumOf: (unit: ChangeBatchUnit) => 's1' | 's2' | 's3' | null
      if (binningId === 'declared_thresholds') {
        strata = declaredStrata(basisId)
        stratumOf = (unit) => {
          const value = basisValue(unit, basisId)
          if (value === null) return null
          return strata.find((spec) => inDeclared(value, spec))?.stratumId ?? null
        }
      } else {
        const values = classified
          .filter((entry) => entry.exclusion === null)
          .map((entry) => basisValue(entry.unit, basisId))
          .filter((value): value is number => value !== null)
        const thirds = valueThirds(values, basisId)
        strata = thirds.strata
        stratumOf = (unit) => {
          const value = basisValue(unit, basisId)
          return value === null ? null : thirds.assign(value)
        }
      }
      const readings = strata.map((stratum) => computeStratum(input, classified, coverage, { basisId, binningId, stratum, stratumOf }))
      binnings.push({
        basisId,
        binningId,
        role: basisId === 'lines_changed' && binningId === 'declared_thresholds' ? 'primary' : 'sensitivity',
        strata: readings,
        tailOrdering: ordering(readings, p90Of),
        // The lower-bound ordering admits every stratum whose lower-bound sample met support.
        lowerBoundTailOrdering: ordering(readings, (reading) => reading.lowerBoundP90, (reading) => reading.lowerBoundP90 !== null),
      })
    }
  }

  const primary = binnings[0]
  const displayableStrata = primary.strata.filter((reading) => reading.display.display && reading.result.state === 'observed').length
  let abstention: ChangeBatchAbstentionReason | null = null
  if (all.result.state === 'truncated') abstention = 'WINDOW_COVERAGE_INCOMPLETE'
  else if (all.result.state === 'empty_eligible_cohort') abstention = 'EMPTY_ELIGIBLE_COHORT'
  // "Nothing eligible" under limited coverage is "could not look", never a quiet window.
  else if (all.result.state === 'unavailable') abstention = 'EMPTY_UNDER_LIMITED_COVERAGE'
  else if (all.result.state === 'censored_only') abstention = 'ALL_ELIGIBLE_EVENTS_CENSORED'
  else if (all.display.reasonCode === 'BELOW_MINIMUM_SUPPORT') abstention = 'BELOW_MINIMUM_SUPPORT'
  else if (!all.display.display) abstention = 'COHORT_NOT_DISPLAYABLE'
  else if (displayableStrata < 2) abstention = 'TOO_FEW_DISPLAYABLE_STRATA'

  const windowDisplayable = abstention === null
  return {
    input,
    all,
    coverage,
    binnings,
    concordance: (['lines_changed', 'changed_files'] as const).map((basisId) => concordance(classified, basisId, windowDisplayable)),
    abstention,
    draftsStillOpen: classified.filter((entry) => entry.exclusion === null && entry.outcome === 'censored' && entry.unit.isDraft).length,
  }
}

/* ------------------------------------------------------------------------------------------ *
 * Marks: every displayed number is a claim reference the Evidence Drawer can resolve
 * ------------------------------------------------------------------------------------------ */

export type ChangeBatchMeasure =
  | 'eligible'
  | 'merged'
  | 'censored'
  | 'competing'
  | 'excluded'
  | 'p50'
  | 'p75'
  | 'p90'
  | 'lower_bound_p90'
  | 'concordance'
  | 'coverage'

export interface ChangeBatchMarkSubject {
  readonly basisId: ChangeBatchBasisId | 'all'
  readonly binningId: ChangeBatchBinningId | 'all'
  readonly stratumId: 's1' | 's2' | 's3' | null
  readonly measure: ChangeBatchMeasure
  /** Coverage dimension or exclusion reason when the measure needs one. */
  readonly detail: string | null
}

export interface ChangeBatchMark {
  readonly markId: string
  readonly claimId: string
  readonly valueCategory: 'count' | 'quantile' | 'ratio' | 'share'
  readonly subject: ChangeBatchMarkSubject
  /** One plain sentence naming exactly what this number is. */
  readonly statement: string
}

function markKey(subject: ChangeBatchMarkSubject): string {
  return [subject.basisId, subject.binningId, subject.stratumId ?? 'all', subject.measure, subject.detail ?? '-'].join('.')
}

function stratumName(reading: ChangeBatchStratumReading): string {
  return reading.stratum === null ? 'the whole cohort' : `the ${reading.stratum.label} stratum (${CHANGE_BATCH_BASES[reading.basisId as ChangeBatchBasisId].label.toLowerCase()}, ${CHANGE_BATCH_BINNINGS[reading.binningId as ChangeBatchBinningId].toLowerCase()})`
}

const MEASURE_WORDING: Readonly<Record<ChangeBatchMeasure, string>> = {
  eligible: 'pull requests opened in the window',
  merged: 'pull requests merged before the window end (the distribution sample)',
  censored: 'pull requests still open at the window end (right-censored)',
  competing: 'pull requests closed without merge before the window end (competing outcome)',
  excluded: 'rows excluded under a named reason',
  p50: 'median opened-to-merge interval among merged pull requests',
  p75: '75th-percentile opened-to-merge interval among merged pull requests',
  p90: '90th-percentile opened-to-merge interval among merged pull requests',
  lower_bound_p90: '90th-percentile interval with still-open pull requests added at their observed lower bound',
  concordance: 'share of comparable pairs in which the smaller batch merged first (Harrell concordance)',
  coverage: 'coverage-vector value',
}

export function buildChangeBatchMarks(analysis: ChangeBatchTailAnalysis): readonly ChangeBatchMark[] {
  const marks: ChangeBatchMark[] = []
  const scopeMaterial = `${analysis.input.source.kind}|${analysis.input.scopeSurrogate}|${analysis.input.window.start}|${analysis.input.window.end}|${analysis.input.asOf}`
  const push = (subject: ChangeBatchMarkSubject, valueCategory: ChangeBatchMark['valueCategory'], statement: string): void => {
    const key = markKey(subject)
    marks.push({ markId: `m.${key}`, claimId: presentationClaimId(`${scopeMaterial}|${key}`), valueCategory, subject, statement })
  }
  const readingMarks = (reading: ChangeBatchStratumReading, withQuantiles: boolean): void => {
    const subjectBase = { basisId: reading.basisId, binningId: reading.binningId, stratumId: reading.stratum?.stratumId ?? null }
    for (const measure of ['eligible', 'merged', 'censored', 'competing'] as const) {
      push({ ...subjectBase, measure, detail: null }, 'count', `Count of ${MEASURE_WORDING[measure]} in ${stratumName(reading)}.`)
    }
    if (withQuantiles && reading.display.display && reading.result.state === 'observed' && reading.result.value.kind === 'quantiles' && reading.result.value.quantiles !== null) {
      for (const measure of ['p50', 'p75', 'p90'] as const) {
        push({ ...subjectBase, measure, detail: null }, 'quantile', `The ${MEASURE_WORDING[measure]} in ${stratumName(reading)}.`)
      }
      if (reading.lowerBoundP90 !== null) {
        push({ ...subjectBase, measure: 'lower_bound_p90', detail: null }, 'quantile', `The ${MEASURE_WORDING.lower_bound_p90} in ${stratumName(reading)}.`)
      }
    }
  }

  readingMarks(analysis.all, false)
  for (const excluded of analysis.all.result.counts.excluded) {
    push({ basisId: 'all', binningId: 'all', stratumId: null, measure: 'excluded', detail: excluded.reasonCode }, 'count', `Count of rows excluded as ${excluded.reasonCode}.`)
  }
  for (const entry of analysis.all.result.coverage) {
    if (entry.value === null) continue
    push({ basisId: 'all', binningId: 'all', stratumId: null, measure: 'coverage', detail: entry.dimension }, 'ratio', `The ${entry.dimension} coverage value for the whole cohort.`)
  }
  if (analysis.abstention === null) {
    for (const binning of analysis.binnings) {
      for (const reading of binning.strata) readingMarks(reading, true)
    }
    for (const entry of analysis.concordance) {
      if (!entry.shown) continue
      push({ basisId: entry.basisId, binningId: 'all', stratumId: null, measure: 'concordance', detail: null }, 'ratio', `The ${MEASURE_WORDING.concordance} on ${CHANGE_BATCH_BASES[entry.basisId].label.toLowerCase()}.`)
    }
  }
  return marks
}

/* ------------------------------------------------------------------------------------------ *
 * Finding
 * ------------------------------------------------------------------------------------------ */

const PROHIBITED = getMetricDefinition(CHANGE_BATCH_TAIL_METRIC_REFERENCE).prohibitedInterpretations
  .map((entry) => ({ code: entry.code, statement: entry.statement }))

const ALTERNATIVES: readonly AlternativeExplanation[] = [
  {
    code: 'WORK_TYPE_MIX',
    statement: 'Large and small batches often carry different kinds of work, so a longer tail in the large stratum can reflect what was proposed rather than how size shaped its path to merge.',
  },
  {
    code: 'CENSORING_ARTIFACT',
    statement: 'Larger batches opened late in the window have less follow-up before the boundary, so a stratum difference can partly be which units were still open when observation stopped.',
  },
  {
    code: 'DRAFT_TIME_INCLUDED',
    statement: 'The interval starts at opening, so a stratum that more often opens as a draft carries draft time that a ready-for-review clock would not.',
  },
  {
    code: 'BATCHED_REVIEW',
    statement: 'Review sessions that land several merges together shorten the observed tail in whichever strata they touch, independent of batch size.',
  },
  {
    code: 'SELECTED_MERGED_SAMPLE',
    statement: 'Larger batches may more often be closed without merge, so each merged sample is a selected subset of its stratum and the tails compare survivors rather than whole strata.',
  },
]

const DISCRIMINATING = {
  statement: 'Re-reading the window once the censored pull requests resolve, comparing the closed-without-merge share across strata, stratifying within one kind of work, and collecting the ready-for-review instant would separate a size-linked tail from censoring, a selected merged sample, work mix, and draft time.',
  distinguishes: ['CENSORING_ARTIFACT', 'SELECTED_MERGED_SAMPLE', 'WORK_TYPE_MIX', 'DRAFT_TIME_INCLUDED'],
}

function days(seconds: number): string {
  return `${(seconds / 86_400).toFixed(1)} days`
}

function robustnessOf(analysis: ChangeBatchTailAnalysis): FindingRobustness {
  const primary = analysis.binnings[0]
  const outcome = (candidate: -1 | 0 | 1 | null): 'held' | 'changed_magnitude' | 'changed_direction' | 'not_applicable' => {
    if (primary.tailOrdering === null || candidate === null) return 'not_applicable'
    if (candidate === primary.tailOrdering) return 'held'
    if (candidate === 0 || primary.tailOrdering === 0) return 'changed_magnitude'
    return 'changed_direction'
  }
  /**
   * OPEN_AT_LOWER_BOUND compares the lower bounds of the SAME endpoint pair the primary ordering
   * compared (the first and last displayed strata), so it can only read `held` after testing that
   * pair. A withheld stratum whose lower-bound sample met support may additionally reverse the
   * wider lower-bound ordering; that can only push the check to `changed_direction`, never to `held`.
   */
  const displayed = primary.strata.filter((reading) => reading.display.display && reading.result.state === 'observed')
  const first = displayed[0]
  const last = displayed[displayed.length - 1]
  const pairLowerBound: -1 | 0 | 1 | null = displayed.length >= 2 && first.lowerBoundP90 !== null && last.lowerBoundP90 !== null
    ? sign(last.lowerBoundP90 - first.lowerBoundP90)
    : null
  const lowerBoundOutcome = ((): 'held' | 'changed_magnitude' | 'changed_direction' | 'not_applicable' => {
    const paired = outcome(pairLowerBound)
    const widened = primary.lowerBoundTailOrdering
    if (paired !== 'not_applicable' && widened !== null && widened !== 0 && primary.tailOrdering !== null
      && primary.tailOrdering !== 0 && widened !== primary.tailOrdering) return 'changed_direction'
    return paired
  })()
  const filesDeclared = analysis.binnings.find((entry) => entry.basisId === 'changed_files' && entry.binningId === 'declared_thresholds')
  const linesThirds = analysis.binnings.find((entry) => entry.basisId === 'lines_changed' && entry.binningId === 'value_thirds')
  const checks = [
    {
      checkId: 'CHANGED_FILES_BASIS',
      statement: 'Recomputed the strata on changed files instead of lines added plus deleted and compared the direction of the largest-versus-smallest 90th-percentile difference.',
      outcome: outcome(filesDeclared?.tailOrdering ?? null),
      sensitivityVariantId: 'CHANGED_FILES_BASIS',
    },
    {
      checkId: 'VALUE_THIRDS_BINS',
      statement: 'Recomputed with data-derived value thirds instead of the declared thresholds and compared the direction of the same 90th-percentile difference.',
      outcome: outcome(linesThirds?.tailOrdering ?? null),
      sensitivityVariantId: 'VALUE_THIRDS_BINS',
    },
    {
      checkId: 'OPEN_AT_LOWER_BOUND',
      statement: 'Recomputed with still-open pull requests added at their observed lower bound and compared the direction of the same 90th-percentile difference.',
      outcome: lowerBoundOutcome,
      sensitivityVariantId: 'OPEN_AT_LOWER_BOUND',
    },
  ] as const
  const applicable = checks.filter((check) => check.outcome !== 'not_applicable')
  const moved = checks.some((check) => check.outcome === 'changed_direction' || check.outcome === 'changed_magnitude')
  return {
    status: moved || applicable.length === 0 ? 'fragile' : 'stable',
    checks: checks.map((check) => ({ ...check })),
  }
}

/** True when any primary stratum's closed-without-merge share reaches the declared threshold. */
export function materialCompeting(analysis: ChangeBatchTailAnalysis): boolean {
  return analysis.binnings[0]?.strata.some((reading) => {
    const eligible = reading.result.counts.eligible
    return eligible > 0 && reading.competing / eligible >= CHANGE_BATCH_MATERIAL_COMPETING_SHARE
  }) ?? false
}

function limitationsOf(analysis: ChangeBatchTailAnalysis): LimitationInstance[] {
  const limitations: LimitationInstance[] = [
    { limitationCode: 'COVERAGE_UNITS_DIFFER', dimension: 'censoring_freedom', copyKey: 'copy.change_batch_tail.censored_and_competing' },
    { limitationCode: 'LINKAGE_NOT_CAUSAL', dimension: 'comparability', copyKey: 'copy.change_batch_tail.associational_only' },
  ]
  if (materialCompeting(analysis)) {
    limitations.push({ limitationCode: 'COVERAGE_SPARSE', dimension: 'censoring_freedom', copyKey: 'copy.change_batch_tail.competing_selected_sample' })
  }
  const withheld = analysis.binnings.some((binning) => binning.strata.some((reading) => reading.display.reasonCode === 'BELOW_MINIMUM_SUPPORT'))
  if (withheld || analysis.abstention === 'BELOW_MINIMUM_SUPPORT' || analysis.abstention === 'TOO_FEW_DISPLAYABLE_STRATA') {
    limitations.push({ limitationCode: 'SAMPLE_TOO_SMALL', dimension: 'sample', copyKey: 'copy.change_batch_tail.stratum_withheld' })
  }
  if (analysis.coverage.completeness.value !== 1) {
    limitations.push({ limitationCode: 'COVERAGE_INCOMPLETE', dimension: 'completeness', copyKey: 'copy.change_batch_tail.window_not_vouched' })
  }
  if (analysis.coverage.eligibility.value !== 1) {
    limitations.push({ limitationCode: 'COVERAGE_INCOMPLETE', dimension: 'eligibility', copyKey: 'copy.change_batch_tail.rows_unplaceable' })
  }
  if (analysis.coverage.permission.value !== 1) {
    limitations.push({ limitationCode: 'COVERAGE_RESTRICTED', dimension: 'permission', copyKey: 'copy.change_batch_tail.restricted_stretch' })
  }
  if (analysis.coverage.consentRevisions > 1 || analysis.coverage.instrumentRevisions > 1) {
    limitations.push({ limitationCode: 'OBSERVABILITY_CHANGED', dimension: 'consistency', copyKey: 'copy.change_batch_tail.instrument_changed' })
  }
  return limitations
}

function findingCoverage(analysis: ChangeBatchTailAnalysis): Finding['coverage'] {
  return analysis.all.result.coverage.map((entry) => ({ dimension: entry.dimension, value: entry.value, limiting_reason: entry.limiting_reason }))
}

function metricResultReferences(analysis: ChangeBatchTailAnalysis): Finding['metricResults'] {
  const references: Array<Finding['metricResults'][number]> = [
    { metricId: CHANGE_BATCH_TAIL_METRIC.metricId, metricVersion: CHANGE_BATCH_TAIL_METRIC.version, resultId: analysis.all.result.resultId, role: 'primary' },
  ]
  if (analysis.abstention === null) {
    for (const binning of analysis.binnings) {
      // A stratum withheld by its display gate is not served as a result at all (blocker 5).
      for (const reading of binning.strata.filter((entry) => entry.display.display)) {
        references.push({ metricId: CHANGE_BATCH_TAIL_METRIC.metricId, metricVersion: CHANGE_BATCH_TAIL_METRIC.version, resultId: reading.result.resultId, role: 'supporting' })
      }
    }
  }
  return references
}

const ABSTENTION_COPY: Readonly<Record<ChangeBatchAbstentionReason, { floorCode: string; dimension: 'completeness' | 'sample' | 'limited_window_dimension'; statement: string }>> = {
  EMPTY_UNDER_LIMITED_COVERAGE: {
    floorCode: 'COVERAGE_FLOOR',
    dimension: 'limited_window_dimension',
    statement: 'No placeable pull request remains in the window, but the window was not observed completely, so this is withheld as a coverage gap rather than read as a quiet window.',
  },
  WINDOW_COVERAGE_INCOMPLETE: {
    floorCode: 'COVERAGE_FLOOR',
    dimension: 'completeness',
    statement: 'The coverage ledger does not vouch for the whole window, so no stratum distribution is shown; a partly observed window is never read as complete.',
  },
  EMPTY_ELIGIBLE_COHORT: {
    floorCode: 'SUPPORT_FLOOR',
    dimension: 'sample',
    statement: 'No pull request that could be placed in the window was opened in it, so there is no change-batch tail to describe.',
  },
  ALL_ELIGIBLE_EVENTS_CENSORED: {
    floorCode: 'SUPPORT_FLOOR',
    dimension: 'sample',
    statement: 'Every eligible pull request was still open at the window end, so no merged sample exists and every interval stays right-censored.',
  },
  BELOW_MINIMUM_SUPPORT: {
    floorCode: 'SUPPORT_FLOOR',
    dimension: 'sample',
    statement: 'The window merged fewer pull requests than the minimum support of five, so the size-versus-tail reading is withheld rather than shown as a range.',
  },
  TOO_FEW_DISPLAYABLE_STRATA: {
    floorCode: 'SUPPORT_FLOOR',
    dimension: 'sample',
    statement: 'Fewer than two change-size strata reached the minimum support of five merged pull requests, so there is no size comparison to show.',
  },
  COHORT_NOT_DISPLAYABLE: {
    floorCode: 'SUPPORT_FLOOR',
    dimension: 'sample',
    statement: 'The cohort distribution did not pass its display gate, so the size-versus-tail reading is withheld.',
  },
}

export function buildChangeBatchFinding(analysis: ChangeBatchTailAnalysis, marks: readonly ChangeBatchMark[]): Finding {
  const base = {
    version: CHANGE_BATCH_TAIL_METHOD_VERSION,
    schemaVersion: '1.0.0' as const,
    questionId: CHANGE_BATCH_TAIL_QUESTION_ID,
    method: { methodId: CHANGE_BATCH_TAIL_METHOD_ID, methodVersion: CHANGE_BATCH_TAIL_METHOD_VERSION },
    scopeId: analysis.input.scopeSurrogate,
    metricResults: metricResultReferences(analysis),
    candidateInterpretation: null,
    prohibitedInterpretations: PROHIBITED,
    sampleSummary: { resultId: analysis.all.result.resultId, state: analysis.all.result.state, counts: analysis.all.result.counts },
    coverage: findingCoverage(analysis),
  }
  const coverageEvidence = { kind: 'observation' as const, evidenceId: evidenceIdFor('all', 'all', null, 'coverage') }
  if (analysis.abstention !== null) {
    const copy = ABSTENTION_COPY[analysis.abstention]
    const limited = [analysis.coverage.completeness, analysis.coverage.eligibility, analysis.coverage.permission, analysis.coverage.freshness]
      .find((entry) => entry.limiting_reason !== null)
    const dimension = copy.dimension === 'limited_window_dimension' ? (limited?.dimension ?? 'completeness') : copy.dimension
    const limitingReason: CoverageLimitingReason = copy.dimension === 'completeness'
      ? analysis.coverage.completeness.limiting_reason ?? 'UNAVAILABLE'
      : copy.dimension === 'limited_window_dimension'
        ? limited?.limiting_reason ?? 'UNAVAILABLE'
        : 'SAMPLE_BELOW_MINIMUM'
    return {
      ...base,
      findingId: 'change_batch_tail_abstention',
      layer: 'abstention',
      statementCode: 'ABSTAIN_LOW_COVERAGE',
      observation: copy.statement,
      marks: [],
      evidence: [coverageEvidence],
      counterEvidence: [],
      alternativeExplanations: [],
      limitations: limitationsOf(analysis),
      robustness: { status: 'not-tested', checks: [] },
      discriminatingEvidence: null,
      presentationEligibility: { eligible: true, reasonCode: 'PRESENTABLE_AS_ABSTENTION', surfaces: ['atlas', 'evidence_drawer', 'api_v2'] },
      abstention: { floorCode: copy.floorCode, dimension, limitingReason, statement: copy.statement, fallbackFindingId: null },
    }
  }

  const primary = analysis.binnings[0]
  const shown = primary.strata.filter((reading) => reading.display.display && reading.result.state === 'observed')
  const smallest = shown[0]
  const largest = shown[shown.length - 1]
  const smallP90 = p90Of(smallest) ?? 0
  const largeP90 = p90Of(largest) ?? 0
  const robustness = robustnessOf(analysis)
  const clause = (reading: ChangeBatchStratumReading, p90: number): string =>
    `the ${reading.stratum?.label} stratum's 90th-percentile opened-to-merge interval was ${days(p90)} among the ${reading.merged} of its ${reading.result.counts.eligible} opened pull requests that merged before the window end (${reading.censored} still open, ${reading.competing} closed without merge)`
  // A merged-only quantile is framed by its own merged count and its own stratum's censored and
  // competing counts, and no direction is stated when any sensitivity check moved the comparison.
  const relation = largeP90 > smallP90 ? 'longer than' : largeP90 < smallP90 ? 'shorter than' : 'the same as'
  const direction = robustness.status === 'fragile'
    ? 'A sensitivity check changed this comparison, so no ordering between the strata is stated.'
    : `Among merged pull requests only, the larger stratum's tail was ${relation} the smaller stratum's.`
  const observation = `In this window, ${clause(largest, largeP90)}; ${clause(smallest, smallP90)}. ${direction}`
  const renderedMarks: RenderedMark[] = marks.map((mark) => ({
    markId: mark.markId,
    valueCategory: mark.valueCategory,
    reference: { kind: 'claim', claimId: mark.claimId, claimLayer: 'deterministic' },
  }))
  const evidence = primary.strata.map((reading) => ({
    kind: 'observation' as const,
    evidenceId: evidenceIdFor(reading.basisId, reading.binningId, reading.stratum?.stratumId ?? null, 'merged'),
  }))
  const counterEvidence = primary.strata
    .filter((reading) => reading.censored > 0)
    .map((reading) => ({
      kind: 'observation' as const,
      evidenceId: evidenceIdFor(reading.basisId, reading.binningId, reading.stratum?.stratumId ?? null, 'open_tail'),
    }))
  return {
    ...base,
    findingId: 'change_batch_tail',
    layer: 'deterministic',
    statementCode: 'DELIVERY_FLOW',
    observation,
    marks: renderedMarks,
    evidence: [...evidence, coverageEvidence],
    counterEvidence,
    alternativeExplanations: [...ALTERNATIVES],
    limitations: limitationsOf(analysis),
    robustness,
    discriminatingEvidence: { statement: DISCRIMINATING.statement, distinguishes: [...DISCRIMINATING.distinguishes] },
    presentationEligibility: { eligible: true, reasonCode: 'PRESENTABLE', surfaces: ['atlas', 'evidence_drawer', 'api_v2'] },
    abstention: null,
  }
}
