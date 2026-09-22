import {
  CHANGE_BATCH_TAIL_SYNTHETIC_MARKER,
  type ChangeBatchCoverageRow,
  type ChangeBatchLineageEvent,
  type ChangeBatchTailInput,
  type ChangeBatchUnit,
} from './changeBatchTail.js'
import { buildChangeBatchTailView, type ChangeBatchTailView } from './changeBatchTailView.js'

/**
 * Phase E (#174) — the EXPLICITLY SYNTHETIC input for the public showcase and the offline demo.
 *
 * Every row is invented: no account, repository, person or private history is read, and the view
 * built from it carries `source.kind = 'synthetic'` with the synthetic marker, so it can never be
 * mistaken for a stored reading. It runs through the same pure analysis as the stored path; only
 * the input differs. The coverage vector is DERIVED from the invented ledger rows below by the same
 * code that derives it from a selected store — there is no hardcoded vector on this path either.
 */
export const SYNTHETIC_CHANGE_BATCH_WINDOW = { start: '2026-06-01T00:00:00.000Z', end: '2026-06-29T00:00:00.000Z' } as const
export const SYNTHETIC_CHANGE_BATCH_AS_OF = '2026-06-29T00:00:00.000Z' as const
export const SYNTHETIC_CHANGE_BATCH_SCOPE = 'lens-scope-5a5a5a5a5a5a5a5a5a5a5a5a' as const

const HOUR_MS = 3_600_000
const at = (dayOffset: number, hour: number): string =>
  new Date(Date.parse(SYNTHETIC_CHANGE_BATCH_WINDOW.start) + (dayOffset * 24 + hour) * HOUR_MS).toISOString()

type Outcome = { merged: number } | { closed: number } | 'open'

/** One invented pull request: opening day/hour, outcome after N hours, and its size. */
function pr(day: number, hour: number, outcome: Outcome, lines: number, files: number, draft = false): ChangeBatchUnit {
  const createdAt = at(day, hour)
  const after = (hours: number): string => new Date(Date.parse(createdAt) + hours * HOUR_MS).toISOString()
  const merged = typeof outcome === 'object' && 'merged' in outcome ? after(outcome.merged) : null
  const closed = typeof outcome === 'object' && 'closed' in outcome ? after(outcome.closed) : merged
  return {
    createdAt,
    mergedAt: merged,
    closedAt: closed,
    state: merged !== null ? 'MERGED' : closed !== null ? 'CLOSED' : 'OPEN',
    isDraft: draft,
    additions: Math.ceil(lines * 0.7),
    deletions: Math.floor(lines * 0.3),
    changedFiles: files,
    retention: 'live',
  }
}

export const SYNTHETIC_CHANGE_BATCH_UNITS: readonly ChangeBatchUnit[] = [
  // Small batches (under 50 lines): mostly merged within a few days.
  pr(0, 10, { merged: 6 }, 12, 1),
  pr(1, 9, { merged: 20 }, 30, 2),
  pr(2, 14, { merged: 30 }, 8, 1),
  pr(3, 11, { merged: 44 }, 41, 3),
  pr(5, 16, { merged: 18 }, 25, 2),
  pr(8, 10, { merged: 70 }, 16, 1),
  pr(11, 13, { merged: 26 }, 44, 4),
  pr(15, 9, { merged: 52 }, 20, 2),
  pr(20, 15, { closed: 30 }, 6, 1),
  pr(26, 11, 'open', 33, 2),
  // Middle batches (50–399 lines).
  pr(0, 13, { merged: 50 }, 120, 5),
  pr(2, 10, { merged: 90 }, 260, 8),
  pr(4, 9, { merged: 36 }, 75, 3),
  pr(6, 15, { merged: 120 }, 310, 11),
  pr(9, 11, { merged: 66 }, 180, 6),
  pr(12, 10, { merged: 160 }, 95, 4),
  pr(18, 14, { merged: 72 }, 220, 9),
  pr(22, 9, 'open', 140, 5, true),
  pr(25, 16, 'open', 350, 12),
  // Large batches (400+ lines): a long, partly censored tail.
  pr(1, 11, { merged: 140 }, 820, 21),
  pr(3, 15, { merged: 230 }, 450, 9),
  pr(5, 10, { merged: 96 }, 1200, 30),
  pr(7, 12, { merged: 310 }, 640, 14),
  pr(10, 9, { merged: 180 }, 510, 16),
  pr(13, 14, { merged: 260 }, 980, 25),
  pr(16, 11, { closed: 200 }, 700, 18),
  pr(19, 10, 'open', 1500, 40),
  pr(23, 13, 'open', 430, 7),
  pr(24, 9, 'open', 880, 22, true),
  // Excluded with typed reasons: opened before the window (one of them closed inside it — an old
  // CLOSED row is never a competing outcome of this window), and a row cleared at retention.
  { ...pr(-12, 10, { closed: 400 }, 90, 3) },
  { ...pr(-3, 10, { merged: 100 }, 60, 2) },
  { createdAt: null, mergedAt: null, closedAt: null, state: 'MERGED', isDraft: false, additions: 40, deletions: 2, changedFiles: 2, retention: 'cleared' },
]

export const SYNTHETIC_CHANGE_BATCH_COVERAGE: readonly ChangeBatchCoverageRow[] = [
  {
    label: 'coverage-1',
    jobLabel: 'job-1',
    consentLabel: 'consent-1',
    instrumentLabel: 'instrument-1',
    status: 'complete',
    jobStatus: 'complete',
    snapshotClosed: true,
    expectedUnits: 33,
    observedUnits: 33,
    omittedUnits: 0,
    saturationReason: null,
    limitationCode: 'COMPLETE',
    retryable: false,
    rangeStart: SYNTHETIC_CHANGE_BATCH_WINDOW.start,
    rangeEnd: SYNTHETIC_CHANGE_BATCH_WINDOW.end,
    observedAt: SYNTHETIC_CHANGE_BATCH_AS_OF,
    retention: 'live',
  },
  {
    // An older collection whose range was cleared at its retention boundary: it vouches for
    // nothing, and its linked expiry lineage explains why.
    label: 'coverage-2',
    jobLabel: 'job-2',
    consentLabel: 'consent-1',
    instrumentLabel: 'instrument-1',
    status: 'complete',
    jobStatus: 'complete',
    snapshotClosed: true,
    expectedUnits: 14,
    observedUnits: 14,
    omittedUnits: 0,
    saturationReason: null,
    limitationCode: 'COMPLETE',
    retryable: false,
    rangeStart: null,
    rangeEnd: null,
    observedAt: null,
    retention: 'cleared',
  },
]

export const SYNTHETIC_CHANGE_BATCH_LINEAGE: readonly ChangeBatchLineageEvent[] = [
  { subjectKind: 'coverage', eventKind: 'c2_retention_expired', eventWeek: '2026-W22', coverageLabel: 'coverage-2', jobLabel: null },
  { subjectKind: 'job', eventKind: 'c2_retention_expired', eventWeek: '2026-W22', coverageLabel: null, jobLabel: 'job-2' },
]

export function syntheticChangeBatchInput(): ChangeBatchTailInput {
  return {
    source: { kind: 'synthetic', marker: CHANGE_BATCH_TAIL_SYNTHETIC_MARKER },
    scopeSurrogate: SYNTHETIC_CHANGE_BATCH_SCOPE,
    scope: { hasAlias: true, linkedAt: '2026-05-04T00:00:00.000Z' },
    window: { ...SYNTHETIC_CHANGE_BATCH_WINDOW },
    asOf: SYNTHETIC_CHANGE_BATCH_AS_OF,
    units: SYNTHETIC_CHANGE_BATCH_UNITS,
    coverage: SYNTHETIC_CHANGE_BATCH_COVERAGE,
    lineage: SYNTHETIC_CHANGE_BATCH_LINEAGE,
  }
}

/** The public showcase view: invented input, the shared analysis, explicitly synthetic source. */
export function buildSyntheticChangeBatchTailView(): ChangeBatchTailView {
  return buildChangeBatchTailView(syntheticChangeBatchInput())
}
