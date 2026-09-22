import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { STORAGE_V3_ARTIFACT_LOCATORS } from './v3ArtifactCatalogue.js'
import { readStoredObservations, type StoredObservationRequest } from './v3ObservationBridge.js'
import {
  createInventedSelectedStore,
  fixtureKey,
  FIXTURE_OTHER_SCOPE,
  FIXTURE_SCOPE,
  type InventedSelectedStore,
} from './v3ObservationBridge.test.fixture.js'
import type { StorageV3SelectedReader } from './v3ReaderSelection.js'

const WINDOW = { start: '2026-06-01T00:00:00.000Z', end: '2026-06-29T00:00:00.000Z' }
const AS_OF = '2026-07-01T00:00:00.000Z'
const REQUEST: StoredObservationRequest = { scopeId: FIXTURE_SCOPE, window: WINDOW, asOf: AS_OF }

const stores: InventedSelectedStore[] = []
const openHandles: Database.Database[] = []

afterEach(() => {
  for (const db of openHandles.splice(0)) if (db.open) db.close()
  for (const store of stores.splice(0)) store.cleanup()
})

async function selectedReader(seed: Parameters<typeof createInventedSelectedStore>[0]): Promise<StorageV3SelectedReader> {
  const store = await createInventedSelectedStore(seed)
  stores.push(store)
  const selection = store.select()
  if (selection.reader !== 'sqlite-v3') throw new Error(`invented store was not selected: ${JSON.stringify(selection)}`)
  openHandles.push(selection.db)
  return selection
}

describe('Phase E stored-observation bridge (#174)', { timeout: 30_000 }, () => {
  it('reads pull_request_fact, coverage and lineage through a proven selected reader only', async () => {
    const reader = await selectedReader({
      pullRequests: [
        { tag: 'a', createdAt: '2026-06-02T10:00:00.000Z', mergedAt: '2026-06-04T10:00:00.000Z', additions: 30, deletions: 5, changedFiles: 2 },
        { tag: 'b', createdAt: '2026-06-03T10:00:00.000Z', additions: 400, deletions: 50, changedFiles: 12 },
        { tag: 'other', scopeId: FIXTURE_OTHER_SCOPE, createdAt: '2026-06-03T10:00:00.000Z' },
      ],
      coverage: [{ tag: 'june', rangeStart: WINDOW.start, rangeEnd: WINDOW.end, observedAt: '2026-06-30T03:00:00.000Z' }],
      lineage: [{ subjectKind: 'coverage', subjectId: fixtureKey('cov', 'june'), eventKind: 'c2_retention_expired', eventWeek: '2026-W27', operationTag: 'e1' }],
    })
    const result = readStoredObservations(reader, REQUEST)
    expect(result.status).toBe('read')
    if (result.status !== 'read') return
    const observation = result.observation
    expect(observation.pullRequests).toHaveLength(2)
    expect(observation.pullRequests.every((row) => row.readyForReviewAt.status === 'not_recorded')).toBe(true)
    expect(observation.coverage).toHaveLength(1)
    expect(observation.coverage[0]).toMatchObject({ status: 'complete', snapshotClosed: true, retention: 'live' })
    expect(observation.lineage).toEqual([
      { subjectKind: 'coverage', eventKind: 'c2_retention_expired', eventWeek: '2026-W27', linkedCoverageOrdinal: 1, linkedJobOrdinal: null },
    ])
    expect(observation.internal.forbiddenValues).toContain(fixtureKey('pr', 'a'))
    expect(observation.internal.forbiddenValues).toContain(fixtureKey('job', 'june'))
    expect(observation.internal.forbiddenValues).toContain('2026-06-02T10:00:00.000Z')
    expect(observation.internal.forbiddenValues).not.toContain(WINDOW.start)
  })

  it('refuses a selection-shaped handle opened on an arbitrary schema-valid path (blocker 3)', async () => {
    const unselected = await createInventedSelectedStore({
      pullRequests: [{ tag: 'a', createdAt: '2026-06-02T10:00:00.000Z' }],
    }, { selected: false })
    stores.push(unselected)
    const arbitrary = new Database(join(unselected.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore), { readonly: true, fileMustExist: true })
    openHandles.push(arbitrary)
    // The file is a valid v3 schema with rows in it — and still never reachable.
    expect(arbitrary.prepare('SELECT COUNT(*) FROM pull_request_fact').pluck().get()).toBe(1)
    const forged = { reader: 'sqlite-v3', db: arbitrary, selection: {} } as unknown as StorageV3SelectedReader
    expect(readStoredObservations(forged, REQUEST)).toEqual({ status: 'refused', code: 'NOT_A_PROVEN_SELECTED_READER' })

    // Even a genuinely selected store's file, reopened directly rather than through the proof path.
    const reader = await selectedReader({})
    const reopened = new Database(reader.db.name, { readonly: true, fileMustExist: true })
    openHandles.push(reopened)
    const copied = { ...reader, db: reopened } as StorageV3SelectedReader
    expect(readStoredObservations(copied, REQUEST)).toEqual({ status: 'refused', code: 'NOT_A_PROVEN_SELECTED_READER' })
  })

  it('never selects a store that was not accepted as the selected artifact', async () => {
    const unselected = await createInventedSelectedStore({}, { selected: false })
    stores.push(unselected)
    const selection = unselected.select()
    expect(selection.reader).not.toBe('sqlite-v3')
    expect(readStoredObservations(selection as unknown as StorageV3SelectedReader, REQUEST))
      .toEqual({ status: 'refused', code: 'NOT_A_PROVEN_SELECTED_READER' })
  })

  it('refuses non-synthetic or missing provenance, unknown scopes, incomplete windows and malformed requests', async () => {
    const carded = await selectedReader({ provenance: 'activation_card' })
    expect(readStoredObservations(carded, REQUEST)).toEqual({ status: 'refused', code: 'STORE_PROVENANCE_NOT_SYNTHETIC' })
    const bare = await selectedReader({ provenance: 'absent' })
    expect(readStoredObservations(bare, REQUEST)).toEqual({ status: 'refused', code: 'STORE_PROVENANCE_NOT_SYNTHETIC' })

    const reader = await selectedReader({})
    expect(readStoredObservations(reader, { ...REQUEST, scopeId: `scope-${'9'.repeat(64)}` }))
      .toEqual({ status: 'refused', code: 'UNKNOWN_SCOPE' })
    expect(readStoredObservations(reader, { ...REQUEST, asOf: '2026-06-20T00:00:00.000Z' }))
      .toEqual({ status: 'refused', code: 'WINDOW_NOT_COMPLETE_AT_AS_OF' })
    expect(readStoredObservations(reader, { ...REQUEST, scopeId: 'invented-alias-phase-e' }))
      .toEqual({ status: 'refused', code: 'REQUEST_INVALID' })
    expect(readStoredObservations(reader, { ...REQUEST, window: { start: WINDOW.end, end: WINDOW.start } }))
      .toEqual({ status: 'refused', code: 'REQUEST_INVALID' })
  })

  it('reports retention state without reading cleared or expired timestamps as live', async () => {
    const reader = await selectedReader({
      pullRequests: [
        { tag: 'live', createdAt: '2026-06-02T10:00:00.000Z' },
        { tag: 'expired', createdAt: '2026-06-03T10:00:00.000Z', c2ExpiresAt: '2026-06-30T00:00:00.000Z' },
        { tag: 'cleared', createdAt: null },
      ],
      coverage: [
        { tag: 'live', rangeStart: WINDOW.start, rangeEnd: WINDOW.end },
        { tag: 'cleared', rangeStart: null, rangeEnd: null },
      ],
    })
    const result = readStoredObservations(reader, REQUEST)
    if (result.status !== 'read') throw new Error(result.code)
    const byRetention = Object.fromEntries(result.observation.pullRequests.map((row) => [row.retention, row]))
    expect(Object.keys(byRetention).sort()).toEqual(['cleared', 'expired', 'live'])
    expect(byRetention.cleared.createdAt).toBeNull()
    expect(result.observation.coverage.map((row) => row.retention).sort()).toEqual(['cleared', 'live'])
    expect(result.observation.coverage.find((row) => row.retention === 'cleared')?.rangeStart).toBeNull()
  })
})
