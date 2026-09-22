import { describe, expect, it } from 'vitest'
import {
  analyzeChangeBatchTail,
  CHANGE_BATCH_TAIL_METRIC,
  CHANGE_BATCH_TAIL_SYNTHETIC_MARKER,
  presentationClaimId,
  type ChangeBatchCoverageRow,
  type ChangeBatchTailInput,
  type ChangeBatchUnit,
} from './changeBatchTail.js'
import {
  acceptChangeBatchTailView,
  assertChangeBatchTailViewPresentationSafe,
  buildChangeBatchTailView,
  resolveChangeBatchTailReference,
} from './changeBatchTailView.js'
import { buildSyntheticChangeBatchTailView } from './changeBatchTailSynthetic.js'
import { getMetricDefinition, validateMetricResult } from './metrics.js'
import { validateFinding } from './findings.js'
import { WhyResolutionSchema, whyResolutionAnswersReference } from './whyContract.js'

/**
 * Phase E (#174) — construct, cohort, censoring, competing-outcome, coverage, support and
 * projection tests for the change-batch lens. Every unit is invented.
 */

const WINDOW = { start: '2026-06-01T00:00:00.000Z', end: '2026-06-29T00:00:00.000Z' }
const AS_OF = '2026-06-29T00:00:00.000Z'
const HOUR = 3_600_000
const DAY = 24 * HOUR
const at = (dayOffset: number, hours = 10): string => new Date(Date.parse(WINDOW.start) + dayOffset * DAY + hours * HOUR).toISOString()

type Outcome = { mergedAfterHours: number } | { closedAfterHours: number } | 'open'

function unit(day: number, outcome: Outcome, lines: number, files = 1, overrides: Partial<ChangeBatchUnit> = {}): ChangeBatchUnit {
  const createdAt = at(day)
  const plus = (hours: number): string => new Date(Date.parse(createdAt) + hours * HOUR).toISOString()
  const mergedAt = typeof outcome === 'object' && 'mergedAfterHours' in outcome ? plus(outcome.mergedAfterHours) : null
  const closedAt = typeof outcome === 'object' && 'closedAfterHours' in outcome ? plus(outcome.closedAfterHours) : mergedAt
  return {
    createdAt,
    mergedAt,
    closedAt,
    state: mergedAt !== null ? 'MERGED' : closedAt !== null ? 'CLOSED' : 'OPEN',
    isDraft: false,
    additions: lines,
    deletions: 0,
    changedFiles: files,
    retention: 'live',
    ...overrides,
  }
}

function coverageRow(overrides: Partial<ChangeBatchCoverageRow> = {}): ChangeBatchCoverageRow {
  return {
    label: 'coverage-1',
    jobLabel: 'job-1',
    consentLabel: 'consent-1',
    instrumentLabel: 'instrument-1',
    status: 'complete',
    jobStatus: 'complete',
    snapshotClosed: true,
    expectedUnits: 10,
    observedUnits: 10,
    omittedUnits: 0,
    saturationReason: null,
    limitationCode: 'COMPLETE',
    retryable: false,
    rangeStart: WINDOW.start,
    rangeEnd: WINDOW.end,
    observedAt: AS_OF,
    retention: 'live',
    ...overrides,
  }
}

function input(units: readonly ChangeBatchUnit[], coverage: readonly ChangeBatchCoverageRow[] = [coverageRow()], overrides: Partial<ChangeBatchTailInput> = {}): ChangeBatchTailInput {
  return {
    source: { kind: 'synthetic', marker: CHANGE_BATCH_TAIL_SYNTHETIC_MARKER },
    scopeSurrogate: 'lens-scope-0123456789abcdef01234567',
    scope: { hasAlias: true, linkedAt: '2026-05-06T09:15:27.123Z' },
    window: WINDOW,
    asOf: AS_OF,
    units,
    coverage,
    lineage: [],
    ...overrides,
  }
}

/** Five merged small, five merged middle, five merged large — the minimum presentable cohort. */
function presentableUnits(): ChangeBatchUnit[] {
  const units: ChangeBatchUnit[] = []
  for (let index = 0; index < 5; index += 1) {
    units.push(unit(index, { mergedAfterHours: 10 + index * 10 }, 10 + index, 1))
    units.push(unit(index + 5, { mergedAfterHours: 60 + index * 20 }, 100 + index * 10, 4))
    units.push(unit(index + 10, { mergedAfterHours: 120 + index * 40 }, 500 + index * 100, 12))
  }
  return units
}

describe('construct: an opened-to-merge interval, never labelled as ready-to-merge (blocker 1)', () => {
  it('computes and names the opened-to-merge construct with readiness explicitly unrecorded', () => {
    const view = buildChangeBatchTailView(input(presentableUnits()))
    expect(view.state).toBe('presentable')
    for (const result of view.results) {
      expect(result.metricId).toBe('pull_request.opened_to_merge_interval_by_change_stratum')
      expect(result.metricId).not.toBe('pull_request.integration_interval')
    }
    for (const reference of view.finding.metricResults) expect(reference.metricId).toBe(CHANGE_BATCH_TAIL_METRIC.metricId)
    const definition = getMetricDefinition(view.metricReference)
    expect(definition.formula).toMatchObject({ startEventCode: 'PULL_REQUEST_OPENED', endEventCode: 'PULL_REQUEST_MERGED' })
    expect(definition.prohibitedInterpretations.map((entry) => entry.code)).toContain('NOT_READY_TO_MERGE')
    expect(view.readiness.status).toBe('not_recorded')
    expect(view.finding.prohibitedInterpretations.map((entry) => entry.code)).toContain('NOT_READY_TO_MERGE')
    expect(JSON.stringify(view)).not.toMatch(/ready[- ]to[- ]merge interval (?:is|was) /i)
  })

  it('reproduces a hand-verified golden: opening to merge, nearest-rank p50/p75/p90 per stratum', () => {
    const analysis = analyzeChangeBatchTail(input(presentableUnits()))
    const small = analysis.binnings[0].strata[0].result
    // Small stratum merged after 10, 20, 30, 40, 50 hours → nearest-rank p50=30h, p75=40h, p90=50h.
    expect(small.value).toEqual({
      kind: 'quantiles',
      sampleSize: 5,
      quantiles: [
        { quantile: 0.5, value: 30 * 3600 },
        { quantile: 0.75, value: 40 * 3600 },
        { quantile: 0.9, value: 50 * 3600 },
      ],
    })
    expect(small.counts).toEqual({ eligible: 5, censored: 0, excluded: [{ reasonCode: 'OTHER_SIZE_STRATUM', count: 10 }] })
    expect(validateMetricResult(small).definition.version).toBe('1.0.0')
  })
})

describe('cohort, censoring and competing outcomes', () => {
  it('counts a close without merge as competing only inside the eligible window (blocker 4)', () => {
    const units = [
      ...presentableUnits(),
      unit(20, { closedAfterHours: 24 }, 15),                     // closed inside the window → competing
      unit(26, { closedAfterHours: 24 * 10 }, 15),                // closed after the window end → censored
      unit(-20, { closedAfterHours: 24 * 25 }, 15),               // opened before, closed inside → not eligible
      unit(-40, { closedAfterHours: 24 * 3 }, 15),                // old CLOSED row → not eligible
    ]
    const analysis = analyzeChangeBatchTail(input(units))
    expect(analysis.all.competing).toBe(1)
    expect(analysis.all.censored).toBe(1)
    expect(analysis.all.result.counts.eligible).toBe(17)
    expect(analysis.all.result.counts.excluded).toEqual([{ reasonCode: 'OPENED_OUTSIDE_WINDOW', count: 2 }])
    // The competing unit leaves the merged sample without being censored.
    const value = analysis.all.result.value
    expect(value.kind === 'quantiles' ? value.sampleSize : -1).toBe(15)
  })

  it('abstains on an all-censored cohort while excluding old CLOSED rows from it', () => {
    const units = [
      unit(1, 'open', 20), unit(3, 'open', 200), unit(5, 'open', 900), unit(8, { mergedAfterHours: 24 * 40 }, 30),
      unit(-30, { closedAfterHours: 24 * 5 }, 20), unit(-60, { mergedAfterHours: 24 }, 20),
    ]
    const view = buildChangeBatchTailView(input(units))
    expect(view.state).toBe('abstained')
    expect(view.abstention?.reasonCode).toBe('ALL_ELIGIBLE_EVENTS_CENSORED')
    expect(view.results[0].state).toBe('censored_only')
    expect(view.cohort).toMatchObject({ eligible: 4, censored: 4, competing: 0, merged: 0 })
    expect(view.cohort.excluded).toEqual([{ reasonCode: 'OPENED_OUTSIDE_WINDOW', count: 2 }])
    expect(view.finding.layer).toBe('abstention')
    expect(view.finding.marks).toEqual([])
    expect(view.binnings).toEqual([])
    acceptChangeBatchTailView(JSON.parse(JSON.stringify(view)))
  })

  it('uses the half-open window: opened at start is in, opened at end is out, and a wrong start moves the cohort', () => {
    const atStart: ChangeBatchUnit = { ...unit(0, { mergedAfterHours: 5 }, 10), createdAt: WINDOW.start, mergedAt: at(0, 5), closedAt: at(0, 5) }
    const atEnd: ChangeBatchUnit = { ...unit(0, 'open', 10), createdAt: WINDOW.end }
    const analysis = analyzeChangeBatchTail(input([...presentableUnits(), atStart, atEnd]))
    expect(analysis.all.result.counts.eligible).toBe(16)
    expect(analysis.all.result.counts.excluded).toEqual([{ reasonCode: 'OPENED_OUTSIDE_WINDOW', count: 1 }])

    // The same facts read over a window starting a week later: earlier openings leave the cohort.
    const shifted = analyzeChangeBatchTail(input(presentableUnits(), [coverageRow({ rangeStart: '2026-06-08T00:00:00.000Z', rangeEnd: '2026-07-06T00:00:00.000Z', observedAt: '2026-07-06T00:00:00.000Z' })], {
      window: { start: '2026-06-08T00:00:00.000Z', end: '2026-07-06T00:00:00.000Z' },
      asOf: '2026-07-06T00:00:00.000Z',
    }))
    expect(shifted.all.result.counts.eligible).toBeLessThan(15)
    expect(shifted.all.result.counts.excluded[0]).toMatchObject({ reasonCode: 'OPENED_OUTSIDE_WINDOW' })

    expect(() => analyzeChangeBatchTail(input(presentableUnits(), undefined, { asOf: '2026-06-20T00:00:00.000Z' }))).toThrow(/completed/)
  })

  it('excludes cleared, expired and inconsistent rows under named reasons and never reads their timestamps', () => {
    const units = [
      ...presentableUnits(),
      { ...unit(2, { mergedAfterHours: 3 }, 10), retention: 'expired' as const },
      { ...unit(2, 'open', 10), createdAt: null, retention: 'cleared' as const },
      { ...unit(2, { mergedAfterHours: 3 }, 10), mergedAt: at(1) },
    ]
    const analysis = analyzeChangeBatchTail(input(units))
    expect(analysis.all.result.counts.excluded).toEqual([
      { reasonCode: 'RETENTION_EXPIRED', count: 1 },
      { reasonCode: 'MISSING_OPEN_TIMESTAMP', count: 1 },
      { reasonCode: 'LIFECYCLE_INCONSISTENT', count: 1 },
    ])
    expect(analysis.coverage.eligibility).toEqual({ dimension: 'eligibility', value: 0.8333, limiting_reason: 'DELETED' })
  })
})

describe('coverage derived from the ledger (blocker 2)', () => {
  it('never accepts partial-overlap coverage as complete', () => {
    const partial = coverageRow({ rangeStart: '2026-05-25T00:00:00.000Z', rangeEnd: '2026-06-15T00:00:00.000Z', observedAt: '2026-06-15T00:00:00.000Z' })
    const view = buildChangeBatchTailView(input(presentableUnits(), [partial]))
    expect(view.state).toBe('abstained')
    expect(view.abstention).toMatchObject({ reasonCode: 'WINDOW_COVERAGE_INCOMPLETE', dimension: 'completeness', limitingReason: 'UNAVAILABLE' })
    expect(view.results[0].state).toBe('truncated')
    expect(view.results[0].coverage.find((entry) => entry.dimension === 'completeness')).toEqual({ dimension: 'completeness', value: 0.5, limiting_reason: 'UNAVAILABLE' })
    expect(JSON.stringify(view.results)).not.toContain('"quantiles":[')
    acceptChangeBatchTailView(JSON.parse(JSON.stringify(view)))
  })

  it('unions adjacent complete rows but not truncated, restricted, expired or prematurely observed ones', () => {
    const halves = [
      coverageRow({ label: 'coverage-1', rangeEnd: '2026-06-15T00:00:00.000Z', observedAt: '2026-06-15T00:00:00.000Z' }),
      coverageRow({ label: 'coverage-2', jobLabel: 'job-2', rangeStart: '2026-06-15T00:00:00.000Z' }),
    ]
    expect(analyzeChangeBatchTail(input(presentableUnits(), halves)).coverage.completeness).toEqual({ dimension: 'completeness', value: 1, limiting_reason: null })

    const cases: Array<[Partial<ChangeBatchCoverageRow>, string, string]> = [
      [{ status: 'truncated', saturationReason: 'SATURATION_CAP_REACHED', observedUnits: 5, omittedUnits: 5 }, 'completeness', 'SATURATION_CAP_REACHED'],
      [{ status: 'restricted', jobStatus: 'restricted' }, 'completeness', 'RESTRICTED'],
      [{ retention: 'expired' }, 'completeness', 'DELETED'],
      [{ observedAt: '2026-06-20T00:00:00.000Z' }, 'completeness', 'UNAVAILABLE'],
      [{ expectedUnits: null, omittedUnits: null }, 'completeness', 'EXPECTED_UNITS_UNKNOWN'],
    ]
    for (const [override, dimension, reason] of cases) {
      const coverage = analyzeChangeBatchTail(input(presentableUnits(), [coverageRow(override)])).coverage
      expect(coverage[dimension as 'completeness']).toEqual({ dimension, value: 0, limiting_reason: reason })
    }
    const restricted = analyzeChangeBatchTail(input(presentableUnits(), [coverageRow({ status: 'restricted', jobStatus: 'restricted' })])).coverage
    expect(restricted.permission).toEqual({ dimension: 'permission', value: 0, limiting_reason: 'RESTRICTED' })
  })

  it('takes the vector from the ledger rows it is given, not from a constant', () => {
    const noLedger = analyzeChangeBatchTail(input(presentableUnits(), []))
    expect(noLedger.coverage.completeness).toEqual({ dimension: 'completeness', value: 0, limiting_reason: 'UNAVAILABLE' })
    expect(noLedger.coverage.freshness).toEqual({ dimension: 'freshness', value: null, limiting_reason: 'NO_COLLECTION_TIMESTAMP' })
    expect(noLedger.abstention).toBe('WINDOW_COVERAGE_INCOMPLETE')
  })
})

describe('minimum support abstention (blocker 5)', () => {
  it('abstains with no quantile anywhere when the cohort merged fewer than five', () => {
    const units = [unit(1, { mergedAfterHours: 5 }, 10), unit(2, { mergedAfterHours: 50 }, 100), unit(3, { mergedAfterHours: 90 }, 900), unit(4, { mergedAfterHours: 9 }, 12), unit(6, 'open', 40)]
    const view = buildChangeBatchTailView(input(units))
    expect(view.state).toBe('abstained')
    expect(view.abstention).toMatchObject({ reasonCode: 'BELOW_MINIMUM_SUPPORT', dimension: 'sample', limitingReason: 'SAMPLE_BELOW_MINIMUM' })
    expect(view.marks.some((mark) => mark.valueCategory === 'quantile')).toBe(false)
    expect(view.finding.marks).toEqual([])
    expect(view.binnings).toEqual([])
    expect(view.concordance).toEqual([])
    expect(validateFinding(view.finding).layer).toBe('abstention')
  })

  it('withholds a below-support stratum inside a presentable view and renders no number for it', () => {
    const units = presentableUnits().filter((_entry, index) => !(index % 3 === 1 && index > 3))
    const view = buildChangeBatchTailView(input(units))
    const middle = view.binnings[0].strata[1]
    expect(middle.merged).toBeLessThan(5)
    expect(middle.displayed).toBe(false)
    expect(middle.displayReasonCode).toBe('BELOW_MINIMUM_SUPPORT')
    expect(middle.quantiles).toBeNull()
    expect(view.marks.find((mark) => mark.subject.basisId === 'lines_changed' && mark.subject.binningId === 'declared_thresholds' && mark.subject.stratumId === 's2' && mark.subject.measure === 'p90')).toBeUndefined()
    expect(view.finding.limitations.map((entry) => entry.limitationCode)).toContain('SAMPLE_TOO_SMALL')
  })

  it('abstains when fewer than two strata can be displayed', () => {
    const units = presentableUnits().filter((entry) => (entry.additions ?? 0) < 50)
    const view = buildChangeBatchTailView(input([...units, unit(20, { mergedAfterHours: 5 }, 600)]))
    expect(view.abstention?.reasonCode).toBe('TOO_FEW_DISPLAYABLE_STRATA')
  })
})

describe('sensitivity, rank measure and alternatives', () => {
  it('computes a censoring-aware Harrell concordance by hand', () => {
    const units = [
      unit(0, { mergedAfterHours: 10 }, 1), unit(0, { mergedAfterHours: 20 }, 2), unit(0, { mergedAfterHours: 30 }, 3),
      unit(0, { mergedAfterHours: 40 }, 4), unit(0, { mergedAfterHours: 50 }, 5), unit(0, 'open', 6),
    ]
    const entry = analyzeChangeBatchTail(input(units)).concordance[0]
    // Every merged unit precedes every later unit, and sizes rise with time: 5+4+3+2+1 = 15 pairs, all concordant.
    expect(entry).toMatchObject({ comparablePairs: 15, concordantPairs: 15, tiedSizePairs: 0, mergedEvents: 5 })
  })

  it('keeps tied sizes in one data-derived third', () => {
    const units = [...presentableUnits(), ...Array.from({ length: 6 }, (_, index) => unit(15 + index, { mergedAfterHours: 12 }, 100))]
    const thirds = analyzeChangeBatchTail(input(units)).binnings.find((entry) => entry.basisId === 'lines_changed' && entry.binningId === 'value_thirds')
    const holding = thirds?.strata.filter((reading) => reading.stratum !== null && reading.stratum.lower !== null && reading.stratum.lower <= 100 && (reading.stratum.upper ?? 0) >= 100)
    expect(holding).toHaveLength(1)
  })

  it('reports a fragile reading when a sensitivity basis reverses the tail ordering', () => {
    // Line counts rise with the tail, but changed files fall with it.
    const units: ChangeBatchUnit[] = []
    for (let index = 0; index < 5; index += 1) {
      units.push(unit(index, { mergedAfterHours: 10 + index }, 10, 20))
      units.push(unit(index + 5, { mergedAfterHours: 60 + index }, 100, 5))
      units.push(unit(index + 10, { mergedAfterHours: 300 + index }, 900, 1))
    }
    const view = buildChangeBatchTailView(input(units))
    expect(view.finding.robustness.status).toBe('fragile')
    expect(view.finding.robustness.checks.find((check) => check.checkId === 'CHANGED_FILES_BASIS')?.outcome).toBe('changed_direction')
    expect(view.finding.alternativeExplanations.map((entry) => entry.code)).toEqual(expect.arrayContaining(['WORK_TYPE_MIX', 'CENSORING_ARTIFACT', 'DRAFT_TIME_INCLUDED']))
  })
})

describe('projection: every displayed number resolves through the Evidence Drawer path', () => {
  it('resolves every mark to a contract-valid walk for exactly that stratum and measure', () => {
    const view = buildSyntheticChangeBatchTailView()
    expect(view.source).toEqual({ kind: 'synthetic', marker: CHANGE_BATCH_TAIL_SYNTHETIC_MARKER })
    const seen = new Set<string>()
    for (const mark of view.marks) {
      const reference = { kind: 'claim' as const, claimId: mark.claimId, claimLayer: 'deterministic' as const }
      const resolution = resolveChangeBatchTailReference(view, reference)
      expect(WhyResolutionSchema.safeParse(resolution).success, mark.markId).toBe(true)
      expect(whyResolutionAnswersReference(reference, resolution)).toBe(true)
      if (resolution.kind !== 'explanation') throw new Error(mark.markId)
      expect(resolution.element).toEqual({ kind: 'ui_element', elementId: mark.markId })
      const supports = resolution.edges.find((group) => group.role === 'supports')?.edges.map((edge) => edge.targetRef) ?? []
      if (mark.subject.stratumId !== null && mark.subject.measure !== 'concordance') {
        // A stratum's number never opens another stratum's (or window's) walk.
        for (const ref of supports) expect(ref).toContain(`${mark.subject.basisId}.${mark.subject.binningId}.${mark.subject.stratumId}.`)
      }
      expect(resolution.edges.find((group) => group.role === 'coverage_basis')?.edges.length).toBe(view.coverage.nodes.length)
      seen.add(mark.claimId)
    }
    expect(seen.size).toBe(view.marks.length)
    expect(resolveChangeBatchTailReference(view, { kind: 'claim', claimId: presentationClaimId('unknown'), claimLayer: 'deterministic' }).kind).toBe('unresolvable')
    expect(resolveChangeBatchTailReference(view, { kind: 'observation', evidenceId: 'ev.cbt.lines_changed.value_thirds.s9.merged' }).kind).toBe('missing_link')
  })

  it('carries linked retention-expiry lineage on the coverage row that expired', () => {
    const view = buildSyntheticChangeBatchTailView()
    const mark = view.marks.find((entry) => entry.subject.measure === 'p90' && entry.subject.stratumId === 's3')
    if (!mark) throw new Error('p90 mark missing')
    const tree = resolveChangeBatchTailReference(view, { kind: 'claim', claimId: mark.claimId, claimLayer: 'deterministic' })
    if (tree.kind !== 'explanation') throw new Error('expected an explanation')
    const coverage = tree.edges.find((group) => group.role === 'coverage_basis')?.edges ?? []
    const expired = coverage.find((edge) => edge.targetRef === 'coverage-2')?.target
    expect(expired).toMatchObject({ kind: 'missing_link', reason: 'MISSING_COVERAGE', targetId: 'coverage-2' })
    expect(expired && 'lineage' in expired ? expired.lineage : []).toEqual([
      { kind: 'lineage_event', subjectId: 'coverage-2', eventKind: 'c2_retention_expired', causedBy: null, occurredAt: '2026-05-25T00:00:00.000Z' },
    ])
  })

  it('accepts the synthetic view and rejects tampered or leaking ones (projection canaries)', () => {
    const view = buildSyntheticChangeBatchTailView()
    expect(acceptChangeBatchTailView(JSON.parse(JSON.stringify(view))).state).toBe('presentable')
    const leakKey = JSON.parse(JSON.stringify(view))
    leakKey.question = `about job-${'a'.repeat(64)}`
    expect(() => acceptChangeBatchTailView(leakKey)).toThrow(/storage-shaped/)
    const leakInstant = JSON.parse(JSON.stringify(view))
    leakInstant.coverage.rows[0].rangeStartWeek = '2026-06-03T10:11:12.000Z'
    expect(() => acceptChangeBatchTailView(leakInstant)).toThrow(/ISO-week grain/)
    const extraField = JSON.parse(JSON.stringify(view))
    extraField.cohort.createdAt = WINDOW.start
    expect(() => acceptChangeBatchTailView(extraField)).toThrow(/schema/)
    const wrongMark = JSON.parse(JSON.stringify(view))
    wrongMark.finding.marks[0].reference.claimId = presentationClaimId('other')
    expect(() => acceptChangeBatchTailView(wrongMark)).toThrow()
    expect(() => assertChangeBatchTailViewPresentationSafe(view, ['2026-06-01T10:00:00.000Z'])).not.toThrow()
    expect(() => assertChangeBatchTailViewPresentationSafe({ ...view, question: 'x 2026-06-01T10:00:00.000Z' }, ['2026-06-01T10:00:00.000Z'])).toThrow()
  })

  it('never carries person, causal or evaluative language in the finding copy', () => {
    const view = buildSyntheticChangeBatchTailView()
    expect(() => validateFinding(view.finding)).not.toThrow()
    expect(view.finding.observation).not.toMatch(/\b(?:author|reviewer|developer|faster|slower|better|worse|because|caused)\b/i)
    expect(view.decisions.unsupported.join(' ')).toMatch(/person/)
  })
})
