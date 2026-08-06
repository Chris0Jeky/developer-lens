import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { installStorageV3ShadowSchema } from '../storage/v3ShadowSchema.js'
import { bridgeV3StoredObservation } from './v3StoredObservationBridge.js'

const scopeId = `scope-${'1'.repeat(64)}`
const consentRevision = 'consent-v3'
const currentWindow = { start: '2026-07-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z' }
const baselineWindow = { start: '2026-06-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z' }
const hash = 'a'.repeat(64)
const id = (prefix: string, n: number) => `${prefix}${String(n).padStart(64, '0')}`

function fixture(options: { readyColumns?: boolean; coverage?: 'complete' | 'partial' | 'ambiguous' | 'wrong-scope' } = {}): Database.Database {
  const db = new Database(':memory:')
  installStorageV3ShadowSchema(db)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeId)
  if (options.readyColumns !== false) db.exec('ALTER TABLE pull_request_fact ADD COLUMN ready_for_review_at TEXT; ALTER TABLE pull_request_fact ADD COLUMN ready_for_review_basis TEXT;')
  const insertJob = db.prepare(`INSERT INTO collection_job
    (scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version, consent_revision, status, source_job_id, payload_hash, range_start, range_end, observed_at, started_at, completed_at, c2_expires_at)
    VALUES (?, ?, 'github.core', '3.0.0', 'github.core.v1', '2026-03-10', ?, 'complete', ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertSnapshot = db.prepare(`INSERT INTO source_snapshot
    (scope_id, snapshot_id, job_id, capability_id, source_snapshot_id, snapshot_hash, range_start, range_end, observed_at, c2_expires_at, status)
    VALUES (?, ?, ?, 'github.core', ?, ?, ?, ?, ?, ?, 'closed')`)
  const insertCoverage = db.prepare(`INSERT INTO coverage_ledger
    (scope_id, coverage_id, job_id, snapshot_id, capability_id, status, expected_units, observed_units, omitted_units, retryable, limitation_code, source_coverage_id, range_start, range_end, observed_at, c2_expires_at)
    VALUES (?, ?, ?, ?, 'github.core', ?, 12, 12, 0, 0, 'COMPLETE', ?, ?, ?, ?, ?)`)
  const addWindow = (window: typeof currentWindow, n: number) => {
    const jobId = id('job-', n)
    const snapshotId = id('snap-', n)
    const coverageId = id('cov-', n)
    const scope = options.coverage === 'wrong-scope' ? `scope-${'2'.repeat(64)}` : scopeId
    if (scope !== scopeId) db.prepare('INSERT OR IGNORE INTO claim_scope (scope_id) VALUES (?)').run(scope)
    insertJob.run(scope, jobId, consentRevision, id('source-', n), hash, window.start, window.end, window.end, window.start, window.end, window.end)
    insertSnapshot.run(scope, snapshotId, jobId, id('source-snap-', n), hash, window.start, window.end, window.end, window.end)
    const status = options.coverage === 'partial' ? 'truncated' : 'complete'
    insertCoverage.run(scope, coverageId, jobId, status === 'complete' ? snapshotId : null, status, status === 'complete' ? id('source-cov-', n) : null, status === 'complete' ? window.start : null, status === 'complete' ? window.end : null, status === 'complete' ? window.end : null, status === 'complete' ? window.end : null)
    if (options.coverage === 'ambiguous') {
      const jobId2 = id('job-', n + 10)
      const snapshotId2 = id('snap-', n + 10)
      insertJob.run(scope, jobId2, consentRevision, id('source-', n + 10), hash, window.start, window.end, window.end, window.start, window.end, window.end)
      insertSnapshot.run(scope, snapshotId2, jobId2, id('source-snap-', n + 10), hash, window.start, window.end, window.end, window.end)
      insertCoverage.run(scope, id('cov-', n + 10), jobId2, snapshotId2, 'complete', id('source-cov-', n + 10), window.start, window.end, window.end, window.end)
    }
  }
  addWindow(currentWindow, 1)
  addWindow(baselineWindow, 2)
  if (options.readyColumns !== false) {
    const insert = db.prepare(`INSERT INTO pull_request_fact
      (scope_id, fact_id, number, created_at, merged_at, closed_at, c2_expires_at, state, is_draft, additions, deletions, changed_files, comments, reviews, ready_for_review_at, ready_for_review_basis)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, 0, ?, ?)`)
    const rows = [
      ['2026-07-02T00:00:00.000Z', '2026-07-03T00:00:00.000Z', null, 'OPEN', 1, 1, 1],
      ['2026-07-03T00:00:00.000Z', null, null, 'OPEN', 1, 1, 2],
      ['2026-07-04T00:00:00.000Z', null, '2026-07-10T00:00:00.000Z', 'CLOSED', 2, 2, null],
      ['2026-07-05T00:00:00.000Z', null, null, 'OPEN', 2, 2, 2],
      ['2026-07-06T00:00:00.000Z', '2026-07-08T00:00:00.000Z', null, 'MERGED', 3, 3, 3],
      ['2026-07-07T00:00:00.000Z', '2026-07-10T00:00:00.000Z', null, 'MERGED', 3, 3, 3],
      ['2026-06-05T00:00:00.000Z', '2026-06-08T00:00:00.000Z', null, 'MERGED', 4, 4, 4],
      ['2026-06-06T00:00:00.000Z', '2026-06-10T00:00:00.000Z', null, 'MERGED', 5, 5, 5],
      ['2026-06-07T00:00:00.000Z', null, null, 'OPEN', 6, 6, 6],
    ] as const
    rows.forEach((row, index) => {
      const [ready, merged, closed, state, additions, deletions, files] = row
      insert.run(scopeId, id('pr-', index + 1), index + 1, ready ?? '2026-01-01T00:00:00.000Z', merged, closed, '2027-01-01T00:00:00.000Z', state, additions, deletions, files, ready, ready === null ? null : 'timeline_event')
    })
    let next = rows.length + 1
    for (const [base, days] of [['2026-07-01T00:00:00.000Z', 18], ['2026-06-01T00:00:00.000Z', 18]] as const) {
      for (let index = 0; index < days; index += 1) {
        const ready = new Date(Date.parse(base) + index * 86_400_000).toISOString()
        const merged = new Date(Date.parse(ready) + 86_400_000).toISOString()
        const size = index < 6 ? 1 : index < 12 ? 10 : 100
        insert.run(scopeId, id('pr-', next), next, ready, merged, null, '2027-01-01T00:00:00.000Z', 'MERGED', size, size, index % 3 + 1, ready, 'creation_observed_never_draft')
        next += 1
      }
    }
  }
  return db
}

const input = (db: Database.Database) => ({ db, scopeId, capabilityId: 'github.core' as const, consentRevision, currentWindow, baselineWindow, asOf: '2026-08-02T00:00:00.000Z' })

describe('v3 stored-observation bridge', () => {
  it('joins complete coverage and computes tied size thirds plus changed-files sensitivity', () => {
    const result = bridgeV3StoredObservation(input(fixture()))
    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.envelope.factProvenanceLimitation).toBe('pull_request_fact_has_no_job_provenance')
    expect(result.envelope.current.strata.every((stratum) => stratum.tiesKeptTogether)).toBe(true)
    expect(result.envelope.sensitivity.variant).toBe('changed_files')
    expect(result.finding.layer).toBe('deterministic')
  })

  it.each([
    ['missing ready columns', fixture({ readyColumns: false }), 'READY_COLUMNS_MISSING'],
    ['partial coverage', fixture({ coverage: 'partial' }), 'COVERAGE_NOT_COMPLETE'],
    ['ambiguous coverage', fixture({ coverage: 'ambiguous' }), 'COVERAGE_AMBIGUOUS'],
    ['wrong scope', fixture({ coverage: 'wrong-scope' }), 'COVERAGE_NOT_COMPLETE'],
  ])('%s abstains with a typed code', (_label, db, code) => {
    const result = bridgeV3StoredObservation(input(db))
    expect(result.status).toBe('abstained')
    if (result.status === 'abstained') expect(result.code).toBe(code)
  })

  it('keeps an all-censored cohort explicit and does not count an old closed row', () => {
    const db = fixture()
    db.prepare('DELETE FROM pull_request_fact').run()
    const insert = db.prepare(`INSERT INTO pull_request_fact
      (scope_id, fact_id, number, created_at, merged_at, closed_at, c2_expires_at, state, is_draft, additions, deletions, changed_files, comments, reviews, ready_for_review_at, ready_for_review_basis)
      VALUES (?, ?, ?, ?, NULL, ?, ?, 'CLOSED', 0, 1, 1, 1, 0, 0, ?, 'timeline_event')`)
    insert.run(scopeId, id('pr-', 77), 77, '2026-06-20T00:00:00.000Z', '2026-06-25T00:00:00.000Z', '2027-01-01T00:00:00.000Z', '2026-06-20T00:00:00.000Z')
    const result = bridgeV3StoredObservation(input(db))
    expect(result.status).toBe('abstained')
    if (result.status === 'abstained') expect(['SUPPORT_BELOW_MINIMUM', 'COVERAGE_BINDING_MISMATCH']).toContain(result.code)
  })
})
