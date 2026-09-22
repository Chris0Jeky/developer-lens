import { join } from 'node:path'
import { tmpdir } from 'node:os'
import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import type { V2RuntimeConfig } from './config.js'
import { createV2Router, createV2RouterForLaunch } from './router.js'
import type { ChangeBatchTailStoredSource } from './changeBatchTail.js'
import { isWeekAlignedInstant } from '../../../shared/changeBatchTail.js'
import {
  acceptChangeBatchTailView,
  resolveChangeBatchTailReference,
  type ChangeBatchTailView,
} from '../../../shared/changeBatchTailView.js'
import {
  composeStoredChangeBatchTailView,
  composeSyntheticChangeBatchTailView,
  gateChangeBatchTailView,
  presentationScopeSurrogate,
} from '../../analysis/changeBatchTail.js'
import {
  createInventedSelectedStore,
  fixtureKey,
  FIXTURE_SCOPE,
  type FixtureCoverage,
  type FixtureLineage,
  type FixturePullRequest,
  type InventedSelectedStore,
  type InventedStoreSeed,
} from '../../storage/v3ObservationBridge.test.fixture.js'
import type { StorageV3SelectedReader } from '../../storage/v3ReaderSelection.js'

/**
 * Phase E (#174) end to end over INVENTED selected v3 stores: bridge → lens → gates → API.
 * Required fixtures: partial coverage, all-censored + old CLOSED rows, wrong cohort/start,
 * support below five, linked tombstone/expiry provenance, selected-artifact refusal, projection
 * canaries, and default-off endpoint behaviour.
 */

const TOKEN = 'f0e1d2c3b4a5968778695a4b3c2d1e0f0e1d2c3b4a5968778695a4b3c2d1e0f0'
const API_HOST = '127.0.0.1:4141'
const WEB_ORIGIN = 'http://127.0.0.1:5173'
const ROUTE = '/api/v2/lenses/change-batch-tail'
const WINDOW = { start: '2026-06-01T00:00:00.000Z', end: '2026-06-29T00:00:00.000Z' }
const AS_OF = '2026-06-30T00:00:00.000Z'
const REQUEST = { scopeId: FIXTURE_SCOPE, window: WINDOW, asOf: AS_OF }
const HOUR = 3_600_000

function configFor(): V2RuntimeConfig {
  return { token: TOKEN, allowedHosts: [API_HOST], allowedOrigins: [WEB_ORIGIN], storePath: join(tmpdir(), 'developer-lens-phase-e-unused.sqlite') }
}

function app(source?: ChangeBatchTailStoredSource): express.Express {
  const server = express()
  server.use('/api/v2', createV2Router(configFor(), { changeBatchTailSource: source }))
  return server
}

function get(server: express.Express) {
  return request(server).get(ROUTE).set('Host', API_HOST).set('Origin', WEB_ORIGIN).set('Authorization', `Bearer ${TOKEN}`)
}

const stores: InventedSelectedStore[] = []
afterEach(() => {
  for (const store of stores.splice(0)) store.cleanup()
})

async function storeWith(seed: InventedStoreSeed, options: { selected?: boolean } = {}): Promise<InventedSelectedStore> {
  const store = await createInventedSelectedStore(seed, options)
  stores.push(store)
  return store
}

/** Invented pull requests opened at day/hour offsets inside the June window. */
function opened(tag: string, day: number, outcome: { mergeHours?: number; closeHours?: number }, lines: number, files: number): FixturePullRequest {
  const created = Date.parse(WINDOW.start) + (day * 24 + 7) * HOUR + 13 * 60_000 + 7_000
  const iso = (hours: number): string => new Date(created + hours * HOUR).toISOString()
  return {
    tag,
    createdAt: new Date(created).toISOString(),
    mergedAt: outcome.mergeHours === undefined ? null : iso(outcome.mergeHours),
    closedAt: outcome.closeHours === undefined ? undefined : iso(outcome.closeHours),
    additions: Math.ceil(lines * 0.6),
    deletions: Math.floor(lines * 0.4),
    changedFiles: files,
  }
}

function presentablePullRequests(): FixturePullRequest[] {
  const rows: FixturePullRequest[] = []
  for (let index = 0; index < 6; index += 1) {
    rows.push(opened(`small-${index}`, index, { mergeHours: 8 + index * 6 }, 12 + index, 1))
    rows.push(opened(`middle-${index}`, index + 6, { mergeHours: 40 + index * 15 }, 120 + index * 30, 5))
    rows.push(opened(`large-${index}`, index + 12, { mergeHours: 100 + index * 40 }, 600 + index * 150, 14))
  }
  rows.push(opened('large-open', 20, {}, 900, 20))
  rows.push(opened('small-closed', 21, { closeHours: 30 }, 20, 2))
  return rows
}

const COMPLETE: FixtureCoverage = { tag: 'june', rangeStart: WINDOW.start, rangeEnd: WINDOW.end, observedAt: '2026-06-29T04:05:06.789Z' }

function sourceFor(store: InventedSelectedStore, request = REQUEST): ChangeBatchTailStoredSource {
  return { select: () => store.select(), request }
}

function expectNoStoredLeak(body: unknown, seed: InventedStoreSeed): void {
  const serialized = JSON.stringify(body)
  const forbidden = [FIXTURE_SCOPE, 'invented-alias-phase-e', '2026-05-06T09:15:27.123Z']
  for (const pr of seed.pullRequests ?? []) {
    forbidden.push(fixtureKey('pr', pr.tag))
    for (const value of [pr.createdAt, pr.mergedAt, pr.closedAt]) if (typeof value === 'string') forbidden.push(value)
  }
  for (const cov of seed.coverage ?? []) {
    forbidden.push(fixtureKey('job', cov.tag), fixtureKey('cov', cov.tag), fixtureKey('snap', cov.tag), `source-job-${cov.tag}`, `source-cov-${cov.tag}`)
    if (cov.observedAt) forbidden.push(cov.observedAt)
    forbidden.push(cov.consentRevision ?? 'consent-invented-1')
  }
  // A Monday-midnight instant is already at the allowed ISO-week grain, so only finer values are leaks.
  for (const value of forbidden) if (!isWeekAlignedInstant(value)) expect(serialized, value).not.toContain(value)
  expect(serialized).not.toMatch(/(?:scope|job|snap|cov|pr|del|op)-[0-9a-f]{64}/)
  expect(serialized).not.toMatch(/"(?:fact_id|factId|coverage_id|coverageId|scope_id|number|mergedAt|closedAt)"/)
}

describe('Phase E change-batch lens endpoint (#174)', { timeout: 60_000 }, () => {
  it('is default-off: no stored source, and the launch router never wires one', async () => {
    const off = await get(app()).expect(404)
    expect(off.body).toEqual({ error: { code: 'V2_NOT_FOUND' } })
    const launched = express()
    launched.use('/api/v2', createV2RouterForLaunch(TOKEN))
    const response = await request(launched).get(ROUTE).set('Host', '127.0.0.1:4141').set('Origin', WEB_ORIGIN).set('Authorization', `Bearer ${TOKEN}`)
    expect(response.status).toBe(404)
    // The guard still runs before the default-off answer.
    await request(app()).get(ROUTE).set('Host', API_HOST).set('Origin', WEB_ORIGIN).expect(401)
  })

  it('serves a gated, presentation-safe stored reading with coverage derived from the store', async () => {
    const seed: InventedStoreSeed = {
      pullRequests: [
        ...presentablePullRequests(),
        opened('old-closed', -30, { closeHours: 24 * 35 }, 30, 1),
      ],
      coverage: [COMPLETE],
    }
    const store = await storeWith(seed)
    const response = await get(app(sourceFor(store))).expect(200)
    const view = acceptChangeBatchTailView(response.body.view)
    expect(view.source).toEqual({ kind: 'selected_v3_store' })
    expect(view.state).toBe('presentable')
    expect(view.scopeSurrogate).toBe(presentationScopeSurrogate(FIXTURE_SCOPE))
    // large-5 opens on day 17 and merges 300h later, after the window end: censored, not merged.
    expect(view.cohort).toMatchObject({ eligible: 20, merged: 17, censored: 2, competing: 1 })
    expect(view.cohort.excluded).toEqual([{ reasonCode: 'OPENED_OUTSIDE_WINDOW', count: 1 }])
    expect(view.results[0].coverage.find((entry) => entry.dimension === 'completeness')).toEqual({ dimension: 'completeness', value: 1, limiting_reason: null })
    expect(view.coverage.rows).toEqual([expect.objectContaining({ label: 'coverage-1', jobLabel: 'job-1', vouches: true, rangeStartWeek: WINDOW.start, rangeEndWeek: WINDOW.end })])
    expect(view.coverage.nodes[0]).toMatchObject({ kind: 'coverage', observedAt: '2026-06-29T00:00:00.000Z' })
    expect(view.readiness.status).toBe('not_recorded')
    expectNoStoredLeak(response.body, seed)
    for (const mark of view.marks) {
      const walk = resolveChangeBatchTailReference(view, { kind: 'claim', claimId: mark.claimId, claimLayer: 'deterministic' })
      expect(walk.kind).toBe('explanation')
    }
  })

  it('abstains on partial-overlap coverage read from the store', async () => {
    const seed: InventedStoreSeed = {
      pullRequests: presentablePullRequests(),
      coverage: [{ tag: 'half', rangeStart: '2026-05-18T00:00:00.000Z', rangeEnd: '2026-06-15T00:00:00.000Z', observedAt: '2026-06-15T00:00:00.000Z' }],
    }
    const response = await get(app(sourceFor(await storeWith(seed)))).expect(200)
    const view = acceptChangeBatchTailView(response.body.view)
    expect(view.state).toBe('abstained')
    expect(view.abstention).toMatchObject({ reasonCode: 'WINDOW_COVERAGE_INCOMPLETE', limitingReason: 'UNAVAILABLE' })
    expect(view.results[0].coverage.find((entry) => entry.dimension === 'completeness')?.value).toBe(0.5)
    expect(view.marks.some((mark) => mark.valueCategory === 'quantile')).toBe(false)
    expectNoStoredLeak(response.body, seed)
  })

  it('abstains on an all-censored cohort and keeps old CLOSED rows out of it', async () => {
    const seed: InventedStoreSeed = {
      pullRequests: [
        opened('open-1', 2, {}, 20, 1), opened('open-2', 9, {}, 300, 6), opened('open-3', 15, {}, 800, 18),
        opened('merged-late', 20, { mergeHours: 24 * 15 }, 40, 2),
        opened('closed-late', 22, { closeHours: 24 * 12 }, 40, 2),
        opened('old-closed', -40, { closeHours: 24 * 35 }, 40, 2),
        opened('old-merged', -10, { mergeHours: 24 * 12 }, 40, 2),
      ],
      coverage: [COMPLETE],
    }
    const view = acceptChangeBatchTailView((await get(app(sourceFor(await storeWith(seed)))).expect(200)).body.view)
    expect(view.abstention?.reasonCode).toBe('ALL_ELIGIBLE_EVENTS_CENSORED')
    expect(view.cohort).toMatchObject({ eligible: 5, censored: 5, competing: 0, merged: 0 })
    expect(view.cohort.excluded).toEqual([{ reasonCode: 'OPENED_OUTSIDE_WINDOW', count: 2 }])
  })

  it('reads the explicit cohort start: the same store under a wrong start gives a different, honest cohort', async () => {
    const seed: InventedStoreSeed = { pullRequests: presentablePullRequests(), coverage: [{ tag: 'wide', rangeStart: '2026-05-04T00:00:00.000Z', rangeEnd: WINDOW.end, observedAt: WINDOW.end }] }
    const store = await storeWith(seed)
    const shifted = { ...REQUEST, window: { start: '2026-06-15T00:00:00.000Z', end: WINDOW.end } }
    const view = acceptChangeBatchTailView((await get(app(sourceFor(store, shifted))).expect(200)).body.view)
    expect(view.window).toEqual(shifted.window)
    expect(view.cohort.eligible).toBeLessThan(20)
    expect(view.cohort.excluded[0]).toMatchObject({ reasonCode: 'OPENED_OUTSIDE_WINDOW' })
    // A window that has not completed at asOf is refused, never read as censored-to-now.
    const early = { ...REQUEST, asOf: '2026-06-20T00:00:00.000Z' }
    expect((await get(app(sourceFor(store, early))).expect(503)).body).toEqual({ error: { code: 'V2_STORE_UNAVAILABLE' } })
  })

  it('abstains below minimum support of five', async () => {
    const seed: InventedStoreSeed = {
      pullRequests: [
        opened('a', 1, { mergeHours: 5 }, 10, 1), opened('b', 2, { mergeHours: 40 }, 200, 5),
        opened('c', 3, { mergeHours: 90 }, 800, 12), opened('d', 4, { mergeHours: 7 }, 12, 1), opened('e', 5, {}, 30, 1),
      ],
      coverage: [COMPLETE],
    }
    const view = acceptChangeBatchTailView((await get(app(sourceFor(await storeWith(seed)))).expect(200)).body.view)
    expect(view.abstention).toMatchObject({ reasonCode: 'BELOW_MINIMUM_SUPPORT', limitingReason: 'SAMPLE_BELOW_MINIMUM' })
    expect(view.finding.marks).toEqual([])
    expect(view.binnings).toEqual([])
  })

  it('links tombstone and retention-expiry lineage to the rows it names, content-free', async () => {
    const lineage: FixtureLineage[] = [
      { subjectKind: 'coverage', subjectId: fixtureKey('cov', 'expired'), eventKind: 'c2_retention_expired', eventWeek: '2026-W22', operationTag: 'exp-cov' },
      { subjectKind: 'job', subjectId: fixtureKey('job', 'expired'), eventKind: 'c2_retention_expired', eventWeek: '2026-W22', operationTag: 'exp-job' },
      { subjectKind: 'scope', subjectId: FIXTURE_SCOPE, eventKind: 'tombstone_cascade', eventWeek: '2026-W23', operationTag: 'tomb-1' },
    ]
    const seed: InventedStoreSeed = {
      pullRequests: [...presentablePullRequests(), { tag: 'cleared', createdAt: null }],
      coverage: [COMPLETE, { tag: 'expired', rangeStart: null, rangeEnd: null }],
      lineage,
    }
    const response = await get(app(sourceFor(await storeWith(seed)))).expect(200)
    const view: ChangeBatchTailView = acceptChangeBatchTailView(response.body.view)
    expect(view.coverage.lineage).toEqual(expect.arrayContaining([
      { subjectKind: 'coverage', eventKind: 'c2_retention_expired', eventWeek: '2026-W22', coverageLabel: 'coverage-2', jobLabel: null },
      { subjectKind: 'job', eventKind: 'c2_retention_expired', eventWeek: '2026-W22', coverageLabel: null, jobLabel: 'job-2' },
      { subjectKind: 'scope', eventKind: 'tombstone_cascade', eventWeek: '2026-W23', coverageLabel: null, jobLabel: null },
    ]))
    expect(view.coverage.rows.find((row) => row.label === 'coverage-2')).toMatchObject({ retention: 'cleared', vouches: false, notVouchingReason: 'DELETED' })
    expect(view.cohort.excluded).toEqual(expect.arrayContaining([{ reasonCode: 'MISSING_OPEN_TIMESTAMP', count: 1 }]))
    expect(view.results[0].coverage.find((entry) => entry.dimension === 'eligibility')?.limiting_reason).toBe('DELETED')
    const mark = view.marks.find((entry) => entry.subject.measure === 'p90')
    if (!mark) throw new Error('p90 mark missing')
    const walk = resolveChangeBatchTailReference(view, { kind: 'claim', claimId: mark.claimId, claimLayer: 'deterministic' })
    if (walk.kind !== 'explanation') throw new Error('expected an explanation')
    expect(walk.lineage).toEqual([{ kind: 'lineage_event', subjectId: mark.claimId, eventKind: 'tombstone_cascade', causedBy: 'scope', occurredAt: '2026-06-01T00:00:00.000Z' }])
    const expiredEdge = walk.edges.find((group) => group.role === 'coverage_basis')?.edges.find((edge) => edge.targetRef === 'coverage-2')
    expect(expiredEdge?.target).toMatchObject({ kind: 'missing_link', reason: 'MISSING_COVERAGE', targetId: 'coverage-2', lineage: [{ subjectId: 'coverage-2', eventKind: 'c2_retention_expired' }] })
    expectNoStoredLeak(response.body, seed)
  })

  it('refuses a store that was never accepted as the selected artifact, and non-synthetic provenance', async () => {
    const unselected = await storeWith({ pullRequests: presentablePullRequests(), coverage: [COMPLETE] }, { selected: false })
    expect((await get(app(sourceFor(unselected))).expect(503)).body).toEqual({ error: { code: 'V2_STORE_UNAVAILABLE' } })
    const carded = await storeWith({ provenance: 'activation_card', pullRequests: presentablePullRequests(), coverage: [COMPLETE] })
    expect((await get(app(sourceFor(carded))).expect(409)).body).toEqual({ error: { code: 'V2_STORE_PROVENANCE_REFUSED' } })
  })

  it('composes only from a proven selected reader and fails closed on a gate violation', async () => {
    const store = await storeWith({ pullRequests: presentablePullRequests(), coverage: [COMPLETE] })
    const selection = store.select()
    if (selection.reader !== 'sqlite-v3') throw new Error('not selected')
    try {
      const forged = { ...selection } as StorageV3SelectedReader
      expect(composeStoredChangeBatchTailView(forged, REQUEST)).toEqual({ status: 'refused', code: 'NOT_A_PROVEN_SELECTED_READER' })
      const composed = composeStoredChangeBatchTailView(selection, REQUEST)
      if (composed.status !== 'view') throw new Error(composed.code)
      // A stratum claiming display below its gate is rejected by the serving gate.
      const tampered = JSON.parse(JSON.stringify(composed.view)) as ChangeBatchTailView
      const stratum = tampered.binnings[0].strata[0]
      tampered.results = tampered.results.map((result) => result.resultId === stratum.resultId
        ? { ...result, value: { kind: 'quantiles', sampleSize: 3, quantiles: result.value.kind === 'quantiles' ? result.value.quantiles : null }, coverage: result.coverage.map((entry) => entry.dimension === 'sample' ? { dimension: 'sample', value: 0.6, limiting_reason: 'SAMPLE_BELOW_MINIMUM' } : entry) }
        : result)
      expect(() => gateChangeBatchTailView(tampered)).toThrow(/display gate/)
    } finally {
      selection.db.close()
    }
    expect(composeSyntheticChangeBatchTailView().source.kind).toBe('synthetic')
  })
})
