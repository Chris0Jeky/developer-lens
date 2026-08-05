import { describe, expect, it } from 'vitest'
import { CLAIM_ID_MATERIAL_VERSION, CLAIM_SCHEMA_VERSION, type ClaimRecord } from '../../shared/claims.js'
import {
  ClaimStabilityError,
  analyseClaimStability,
  type ClaimStabilityObservation,
} from './claimStability.js'

const SCOPE_ID = `scope-${'a'.repeat(64)}`
const WINDOW_START = '2026-01-01T00:00:00.000Z'
const WINDOW_END = '2026-02-01T00:00:00.000Z'

function claim(version: number, supersededBy: string | null, methodVersion = '1.0.0'): ClaimRecord {
  return {
    claimId: `cl_${String(version).repeat(64)}`,
    layer: 'deterministic',
    statementCode: 'COVERAGE_GAP',
    methodId: 'det.coverage_ratio',
    methodVersion,
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    scopeId: SCOPE_ID,
    schemaVersion: CLAIM_SCHEMA_VERSION,
    claimIdMaterialVersion: CLAIM_ID_MATERIAL_VERSION,
    createdAt: `2026-01-0${version}T00:00:00.000Z`,
    supersededBy,
  }
}

function observation(
  collectionOrdinal: number,
  isoWeek: string,
  version: number,
  supersededBy: string | null,
  measuredValue: number,
  coverageFingerprint: string,
  methodVersion = '1.0.0',
): ClaimStabilityObservation {
  return {
    collectionOrdinal,
    isoWeek,
    claim: claim(version, supersededBy, methodVersion),
    measuredValue,
    coverageFingerprint,
  }
}

describe('analyseClaimStability', () => {
  it('replays five collections deterministically and separates coverage, value, overlap, and method-version churn', () => {
    const v2 = `cl_${'2'.repeat(64)}`
    const v3 = `cl_${'3'.repeat(64)}`
    const replay = [
      observation(3, '2026-W03', 2, v3, 10, 'coverage-b'), // input order is intentionally late
      observation(1, '2026-W01', 1, v2, 10, 'coverage-a'),
      observation(5, '2026-W05', 4, null, 10, 'coverage-c', '2.0.0'),
      // A method-version stratum starts a new chain; storage forbids cross-version supersession.
      observation(4, '2026-W04', 3, null, 8, 'coverage-b'),
      observation(2, '2026-W02', 1, v2, 10, 'coverage-a'),
    ]

    const report = analyseClaimStability(replay)
    expect(report.profiles).toHaveLength(1)
    const profile = report.profiles[0]
    expect(profile.methodVersionChurn).toEqual({ transitionCount: 4, changedCount: 1, share: 0.25 })
    expect(profile.series).toHaveLength(2)

    const v1 = profile.series.find((series) => series.methodVersion === '1.0.0')
    expect(v1).toMatchObject({
      snapshots: [
        { versionOrdinal: 1, isoWeek: '2026-W01', change: 'initial' },
        { versionOrdinal: 1, isoWeek: '2026-W02', change: 'unchanged' },
        { versionOrdinal: 2, isoWeek: '2026-W03', change: 'coverage_only' },
        { versionOrdinal: 3, isoWeek: '2026-W04', change: 'value_only' },
      ],
      counts: {
        collectionCount: 4,
        transitionCount: 3,
        churnCount: 2,
        versionChurnCount: 2,
        coverageChurnCount: 1,
        valueChurnCount: 1,
        evidenceOnlyChurnCount: 0,
        oscillationCount: 0,
      },
      valueRange: { min: 8, max: 10 },
      attribution: { coverageShare: 0.5, valueShare: 0.5, bothShare: 0 },
    })
    expect(profile.series.find((series) => series.methodVersion === '2.0.0')).toMatchObject({
      snapshots: [{ versionOrdinal: 1, isoWeek: '2026-W05', change: 'initial' }],
      counts: { churnCount: 0 },
    })

    const rendered = JSON.stringify(report)
    expect(rendered).not.toContain(SCOPE_ID)
    expect(rendered).not.toContain('2026-01-01T00:00:00.000Z')
    expect(rendered).not.toContain(v2)
    expect(rendered).not.toContain('coverage-a')
  })

  it('reports a static fixture as zero churn with null attribution shares', () => {
    const report = analyseClaimStability([
      observation(1, '2026-W01', 1, null, 4, 'coverage-static'),
    ])
    const series = report.profiles[0].series[0]
    expect(series.counts).toMatchObject({
      collectionCount: 1,
      transitionCount: 0,
      churnCount: 0,
      versionChurnCount: 0,
      oscillationCount: 0,
    })
    expect(series.valueRange).toEqual({ min: 4, max: 4 })
    expect(series.attribution).toEqual({ coverageShare: null, valueShare: null, bothShare: null })
    expect(report.profiles[0].methodVersionChurn).toEqual({ transitionCount: 0, changedCount: 0, share: null })
  })

  it('counts value oscillation and keeps combined attribution explicit', () => {
    const v2 = `cl_${'2'.repeat(64)}`
    const v3 = `cl_${'3'.repeat(64)}`
    const report = analyseClaimStability([
      observation(1, '2026-W01', 1, v2, 3, 'coverage-a'),
      observation(2, '2026-W02', 2, v3, 5, 'coverage-b'),
      observation(3, '2026-W03', 3, null, 3, 'coverage-c'),
    ])
    const series = report.profiles[0].series[0]
    expect(series.counts).toMatchObject({
      churnCount: 2,
      coverageChurnCount: 2,
      valueChurnCount: 2,
      oscillationCount: 1,
    })
    expect(series.attribution).toEqual({ coverageShare: 1, valueShare: 1, bothShare: 1 })
  })

  it('refuses ambiguous, broken, and privacy-shaped input instead of inventing an ordering', () => {
    const v2 = `cl_${'2'.repeat(64)}`
    expect(() => analyseClaimStability([
      observation(1, '2026-W01', 1, null, 1, 'coverage-a'),
      observation(1, '2026-W01', 2, null, 1, 'coverage-b'),
    ])).toThrow(new ClaimStabilityError('DUPLICATE_FAMILY_COLLECTION'))
    expect(() => analyseClaimStability([
      observation(1, '2026-W01', 1, null, 1, 'coverage-a'),
      observation(2, '2026-W02', 2, null, 1, 'coverage-b'),
    ])).toThrow(new ClaimStabilityError('BROKEN_SUPERSESSION_CHAIN'))
    expect(() => analyseClaimStability([{
      ...observation(1, '2026-W01', 1, v2, 1, 'coverage-a'),
      collectionTimestamp: '2026-01-01T00:00:00.000Z',
    }])).toThrow(new ClaimStabilityError('INVALID_INPUT'))
  })

  it('validates the complete supersession graph before accepting a successor', () => {
    const v1 = `cl_${'1'.repeat(64)}`
    const v2 = `cl_${'2'.repeat(64)}`
    const v3 = `cl_${'3'.repeat(64)}`

    // The observed transition A -> B is real, but B -> A makes the complete chain cyclic.
    expect(() => analyseClaimStability([
      observation(1, '2026-W01', 1, v2, 1, 'coverage-a'),
      observation(2, '2026-W02', 2, v1, 2, 'coverage-b'),
    ])).toThrow(new ClaimStabilityError('BROKEN_SUPERSESSION_CHAIN'))

    // Missing successors and links that cross a method-version stratum are broken chains too.
    expect(() => analyseClaimStability([
      observation(1, '2026-W01', 1, v2, 1, 'coverage-a'),
    ])).toThrow(new ClaimStabilityError('BROKEN_SUPERSESSION_CHAIN'))
    expect(() => analyseClaimStability([
      observation(1, '2026-W01', 1, v2, 1, 'coverage-a'),
      observation(2, '2026-W02', 2, null, 1, 'coverage-a', '2.0.0'),
    ])).toThrow(new ClaimStabilityError('BROKEN_SUPERSESSION_CHAIN'))
    expect(() => analyseClaimStability([
      observation(1, '2026-W01', 2, null, 1, 'coverage-a'),
      observation(2, '2026-W02', 1, v2, 1, 'coverage-a'),
    ])).toThrow(new ClaimStabilityError('BROKEN_SUPERSESSION_CHAIN'))

    // A complete A -> B -> C chain remains legal and advances three version ordinals.
    const legal = analyseClaimStability([
      observation(1, '2026-W01', 1, v2, 1, 'coverage-a'),
      observation(2, '2026-W02', 2, v3, 2, 'coverage-b'),
      observation(3, '2026-W03', 3, null, 3, 'coverage-c'),
    ])
    expect(legal.profiles[0].series[0].snapshots.map(({ versionOrdinal }) => versionOrdinal))
      .toEqual([1, 2, 3])
  })
})
