import type Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  SYNTHETIC_STORED_OBSERVATION_AS_OF,
  SYNTHETIC_STORED_OBSERVATION_BASELINE,
  SYNTHETIC_STORED_OBSERVATION_CONSENT,
  SYNTHETIC_STORED_OBSERVATION_CURRENT,
  SYNTHETIC_STORED_OBSERVATION_SCOPE,
  createSyntheticV3StoredObservationDatabase,
} from './syntheticV3StoredObservation.js'
import {
  bridgeV3StoredObservation,
  type V3StoredObservationBridgeInput,
  type V3StoredObservationAbstentionCode,
} from './v3StoredObservationBridge.js'
import { STORAGE_V3_SHADOW_LINEAGE_SCOPE_TRIGGER_NAME } from '../storage/v3ShadowSchema.js'

const id = (prefix: string, value: number): string => `${prefix}${String(value).padStart(64, '0')}`

function input(
  db: Database.Database,
  overrides: Partial<Omit<V3StoredObservationBridgeInput, 'db'>> = {},
): V3StoredObservationBridgeInput {
  return {
    db,
    scopeId: SYNTHETIC_STORED_OBSERVATION_SCOPE,
    capabilityId: 'github.core',
    consentRevision: SYNTHETIC_STORED_OBSERVATION_CONSENT,
    baselineWindow: SYNTHETIC_STORED_OBSERVATION_BASELINE,
    currentWindow: SYNTHETIC_STORED_OBSERVATION_CURRENT,
    asOf: SYNTHETIC_STORED_OBSERVATION_AS_OF,
    ...overrides,
  }
}

function expectAbstention(
  db: Database.Database,
  code: V3StoredObservationAbstentionCode,
  overrides: Partial<Omit<V3StoredObservationBridgeInput, 'db'>> = {},
): void {
  const result = bridgeV3StoredObservation(input(db, overrides))
  expect(result.status).toBe('abstained')
  if (result.status === 'abstained') expect(result.code).toBe(code)
}

function duplicateCurrentProof(db: Database.Database): void {
  const oldJob = id('job-', 2)
  const oldSnapshot = id('snap-', 2)
  const oldCoverage = id('cov-', 2)
  const newJob = id('job-', 22)
  const newSnapshot = id('snap-', 22)
  db.prepare(`INSERT INTO collection_job (
    scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version,
    consent_revision, status, source_job_id, payload_hash, range_start, range_end, observed_at,
    started_at, completed_at, c2_expires_at
  ) SELECT scope_id, ?, capability_id, storage_contract_version, query_version, source_api_version,
    consent_revision, status, source_job_id, payload_hash, range_start, range_end, observed_at,
    started_at, completed_at, c2_expires_at FROM collection_job WHERE job_id = ?`)
    .run(newJob, oldJob)
  db.prepare(`INSERT INTO source_snapshot (
    scope_id, snapshot_id, job_id, capability_id, source_snapshot_id, snapshot_hash,
    range_start, range_end, observed_at, c2_expires_at, status
  ) SELECT scope_id, ?, ?, capability_id, source_snapshot_id, snapshot_hash,
    range_start, range_end, observed_at, c2_expires_at, status FROM source_snapshot WHERE snapshot_id = ?`)
    .run(newSnapshot, newJob, oldSnapshot)
  db.prepare(`INSERT INTO coverage_ledger (
    scope_id, coverage_id, job_id, snapshot_id, capability_id, status, expected_units,
    observed_units, omitted_units, saturation_reason, retryable, observed_at, limitation_code,
    source_coverage_id, range_start, range_end, c2_expires_at
  ) SELECT scope_id, ?, ?, ?, capability_id, status, expected_units, observed_units,
    omitted_units, saturation_reason, retryable, observed_at, limitation_code, source_coverage_id,
    range_start, range_end, c2_expires_at FROM coverage_ledger WHERE coverage_id = ?`)
    .run(id('cov-', 22), newJob, newSnapshot, oldCoverage)
}

describe('v3 stored-observation bridge', () => {
  it('joins exact retained proof and computes tied value thirds plus changed-files sensitivity', () => {
    const db = createSyntheticV3StoredObservationDatabase()
    try {
      const result = bridgeV3StoredObservation(input(db))
      expect(result.status).toBe('complete')
      if (result.status !== 'complete') return
      expect(result.envelope.factProvenanceLimitation).toBe('pull_request_fact_has_no_job_provenance')
      expect(result.envelope.current.strata).toHaveLength(3)
      expect(result.envelope.current.strata.every((stratum) => stratum.tiesKeptTogether)).toBe(true)
      expect(result.envelope.sensitivity.variant).toBe('changed_files')
      expect(result.finding.marks).toHaveLength(5)
      expect(result.finding.evidence).toHaveLength(1)
      expect(result.metrics.every((metric) => metric.result.evidenceIds.length === 1)).toBe(true)
      expect(result.metrics.every((metric) => metric.result.coverage.find((entry) => entry.dimension === 'completeness')?.value === 1)).toBe(true)
      expect(result.envelope.deletionLineage).toEqual({ status: 'none_recorded', eventCount: 0, events: [] })
    } finally {
      db.close()
    }
  })

  it('joins deletion tombstones as content-free week-grain aggregates', () => {
    const db = createSyntheticV3StoredObservationDatabase()
    try {
      // Simulate the post-delete retained tombstone while leaving the invented fact corpus in
      // place so this focused reader test can prove both aggregation and the complete lens.
      db.exec(`DROP TRIGGER ${STORAGE_V3_SHADOW_LINEAGE_SCOPE_TRIGGER_NAME}`)
      db.prepare(`INSERT INTO lineage_event (
        scope_id, subject_kind, subject_id, operation_id, capability_id,
        caused_by, event_kind, event_week
      ) VALUES (NULL, 'scope', ?, ?, 'github.core', NULL, 'tombstone_cascade', '2026-W31')`)
        .run(SYNTHETIC_STORED_OBSERVATION_SCOPE, id('del-', 1))
      const result = bridgeV3StoredObservation(input(db))
      expect(result.status).toBe('complete')
      if (result.status === 'complete') {
        expect(result.envelope.deletionLineage).toEqual({
          status: 'present',
          eventCount: 1,
          events: [{ subjectKind: 'scope', eventKind: 'tombstone_cascade', week: '2026-W31', count: 1 }],
        })
      }
    } finally {
      db.close()
    }
  })

  it('coalesces duplicate value groups so equal values never split between thirds', async () => {
    const { partitionChangeBatchValueThirds } = await import('../../shared/changeBatchIntegrationTail.js')
    const thirds = partitionChangeBatchValueThirds([
      { value: 1, rows: ['a', 'b', 'c'] },
      { value: 1, rows: ['d', 'e', 'f'] },
      { value: 2, rows: ['g', 'h', 'i'] },
    ])
    const locations = Object.values(thirds).filter((rows) => rows.some((row) => row === 'a' || row === 'd'))
    expect(locations).toHaveLength(1)
    expect(locations[0]).toEqual(expect.arrayContaining(['a', 'b', 'c', 'd', 'e', 'f']))
  })

  it('abstains on missing, broad, ambiguous, wrong-scope, and expired proofs', () => {
    const cases: Array<[V3StoredObservationAbstentionCode, (db: Database.Database) => void, Partial<Omit<V3StoredObservationBridgeInput, 'db'>>?]> = [
      ['COVERAGE_NOT_COMPLETE', (db) => db.prepare('DELETE FROM coverage_ledger WHERE coverage_id = ?').run(id('cov-', 2))],
      ['COVERAGE_NOT_COMPLETE', (db) => {
        for (const table of ['coverage_ledger', 'collection_job', 'source_snapshot']) {
          db.prepare(`UPDATE ${table} SET range_start = ? WHERE range_start = ?`)
            .run('2026-07-02T00:00:00.000Z', SYNTHETIC_STORED_OBSERVATION_CURRENT.start)
        }
      }],
      ['COVERAGE_AMBIGUOUS', duplicateCurrentProof],
      ['COVERAGE_NOT_COMPLETE', () => undefined, { scopeId: `scope-${'8'.repeat(64)}` }],
      ['COVERAGE_NOT_COMPLETE', (db) => db.prepare('UPDATE coverage_ledger SET c2_expires_at = ? WHERE coverage_id = ?')
        .run(SYNTHETIC_STORED_OBSERVATION_AS_OF, id('cov-', 2))],
    ]
    for (const [code, mutate, overrides] of cases) {
      const db = createSyntheticV3StoredObservationDatabase()
      try {
        mutate(db)
        expectAbstention(db, code, overrides)
      } finally {
        db.close()
      }
    }
  })

  it('abstains on malformed proof clocks and mismatched storage/query instruments', () => {
    const future = createSyntheticV3StoredObservationDatabase()
    try {
      const value = '2026-08-02T00:00:00.000Z'
      future.prepare('UPDATE coverage_ledger SET observed_at = ? WHERE coverage_id = ?').run(value, id('cov-', 2))
      future.prepare('UPDATE source_snapshot SET observed_at = ? WHERE snapshot_id = ?').run(value, id('snap-', 2))
      future.prepare('UPDATE collection_job SET observed_at = ?, completed_at = ? WHERE job_id = ?').run(value, value, id('job-', 2))
      expectAbstention(future, 'COVERAGE_BINDING_MISMATCH')
    } finally {
      future.close()
    }

    const mismatched = createSyntheticV3StoredObservationDatabase()
    try {
      mismatched.prepare('UPDATE collection_job SET storage_contract_version = ? WHERE job_id = ?')
        .run('3.2.7', id('job-', 2))
      expectAbstention(mismatched, 'COVERAGE_BINDING_MISMATCH')
    } finally {
      mismatched.close()
    }
  })

  it('requires an explicit synthetic store marker and refuses activation-card provenance', () => {
    const db = createSyntheticV3StoredObservationDatabase()
    try {
      db.prepare(`UPDATE v2_store_provenance
        SET mode = 'activation_card', synthetic_marker = NULL, activation_card_id = 'invented-card'`)
        .run()
      expectAbstention(db, 'SOURCE_NOT_AUTHORIZED')
    } finally {
      db.close()
    }
  })

  it('rejects unmatched windows and a non-surrogate scope before composing a finding', () => {
    const db = createSyntheticV3StoredObservationDatabase()
    try {
      expectAbstention(db, 'COVERAGE_BINDING_MISMATCH', {
        baselineWindow: { ...SYNTHETIC_STORED_OBSERVATION_BASELINE, start: '2026-06-06T00:00:00.000Z' },
      })
      expect(() => bridgeV3StoredObservation(input(db, { scopeId: 'private/repository' })))
        .toThrowError('INVALID_SCOPE')
    } finally {
      db.close()
    }
  })

  it('distinguishes all-censored cohorts from below-minimum observed support', () => {
    const censored = createSyntheticV3StoredObservationDatabase()
    try {
      censored.prepare(`UPDATE pull_request_fact SET state = 'OPEN', merged_at = NULL, closed_at = NULL
        WHERE ready_for_review_at >= ? AND ready_for_review_at < ?`)
        .run(SYNTHETIC_STORED_OBSERVATION_CURRENT.start, SYNTHETIC_STORED_OBSERVATION_CURRENT.end)
      expectAbstention(censored, 'ALL_CENSORED')
    } finally {
      censored.close()
    }

    const low = createSyntheticV3StoredObservationDatabase()
    try {
      low.prepare(`UPDATE pull_request_fact SET state = 'OPEN', merged_at = NULL
        WHERE fact_id IN (
          SELECT fact_id FROM pull_request_fact
          WHERE ready_for_review_at >= ? AND ready_for_review_at < ?
            AND additions + deletions = 10 AND state = 'MERGED'
          ORDER BY fact_id LIMIT 2
        )`).run(SYNTHETIC_STORED_OBSERVATION_CURRENT.start, SYNTHETIC_STORED_OBSERVATION_CURRENT.end)
      expectAbstention(low, 'SUPPORT_BELOW_MINIMUM')
    } finally {
      low.close()
    }
  })

  it('gates the changed-files sensitivity strata at the same support floor', () => {
    const db = createSyntheticV3StoredObservationDatabase()
    try {
      db.prepare(`UPDATE pull_request_fact SET changed_files = NULL
        WHERE fact_id IN (
          SELECT fact_id FROM pull_request_fact
          WHERE ready_for_review_at >= ? AND ready_for_review_at < ?
            AND changed_files = 1 AND state = 'MERGED'
          ORDER BY fact_id LIMIT 2
        )`).run(SYNTHETIC_STORED_OBSERVATION_CURRENT.start, SYNTHETIC_STORED_OBSERVATION_CURRENT.end)
      expectAbstention(db, 'SUPPORT_BELOW_MINIMUM')
    } finally {
      db.close()
    }
  })

  it('reports missing batch size explicitly without imputing it', () => {
    const db = createSyntheticV3StoredObservationDatabase()
    try {
      db.prepare(`UPDATE pull_request_fact SET additions = NULL
        WHERE fact_id = (
          SELECT fact_id FROM pull_request_fact
          WHERE ready_for_review_at >= ? AND ready_for_review_at < ?
            AND additions + deletions = 10 AND state = 'MERGED'
          ORDER BY fact_id LIMIT 1
        )`).run(SYNTHETIC_STORED_OBSERVATION_CURRENT.start, SYNTHETIC_STORED_OBSERVATION_CURRENT.end)
      const result = bridgeV3StoredObservation(input(db))
      expect(result.status).toBe('complete')
      if (result.status === 'complete') expect(result.envelope.current.missingSizeExcluded).toBe(1)
    } finally {
      db.close()
    }
  })

  it('abstains on unresolved readiness inside a window but ignores a terminal old row outside both windows', () => {
    const missing = createSyntheticV3StoredObservationDatabase()
    try {
      missing.prepare(`UPDATE pull_request_fact SET ready_for_review_at = NULL, ready_for_review_basis = NULL
        WHERE fact_id = (
          SELECT fact_id FROM pull_request_fact WHERE ready_for_review_at >= ? AND ready_for_review_at < ? LIMIT 1
        )`).run(SYNTHETIC_STORED_OBSERVATION_CURRENT.start, SYNTHETIC_STORED_OBSERVATION_CURRENT.end)
      expectAbstention(missing, 'READY_FACT_MISSING')
    } finally {
      missing.close()
    }

    const old = createSyntheticV3StoredObservationDatabase()
    try {
      old.prepare(`INSERT INTO pull_request_fact (
        scope_id, fact_id, number, created_at, merged_at, closed_at, c2_expires_at,
        state, is_draft, additions, deletions, changed_files, comments, reviews,
        ready_for_review_at, ready_for_review_basis
      ) VALUES (?, ?, 999, '2026-01-01T00:00:00.000Z', NULL, '2026-05-01T00:00:00.000Z',
        '2027-08-01T00:00:00.000Z', 'CLOSED', 0, 1, 1, 1, 0, 0, NULL, NULL)`)
        .run(SYNTHETIC_STORED_OBSERVATION_SCOPE, id('pr-', 999))
      expect(bridgeV3StoredObservation(input(old)).status).toBe('complete')
    } finally {
      old.close()
    }
  })

  it('abstains when lifecycle state contradicts terminal timestamps', () => {
    const db = createSyntheticV3StoredObservationDatabase()
    try {
      db.prepare(`UPDATE pull_request_fact SET state = 'CLOSED', merged_at = NULL, closed_at = NULL
        WHERE fact_id = (
          SELECT fact_id FROM pull_request_fact WHERE ready_for_review_at >= ? AND ready_for_review_at < ? LIMIT 1
        )`).run(SYNTHETIC_STORED_OBSERVATION_CURRENT.start, SYNTHETIC_STORED_OBSERVATION_CURRENT.end)
      expectAbstention(db, 'INVALID_LIFECYCLE_TIMESTAMP')
    } finally {
      db.close()
    }
  })

  it('treats complete zero-of-zero coverage as complete rather than a clean zero score', () => {
    const db = createSyntheticV3StoredObservationDatabase()
    try {
      db.prepare('UPDATE coverage_ledger SET expected_units = 0, observed_units = 0 WHERE coverage_id = ?')
        .run(id('cov-', 2))
      const result = bridgeV3StoredObservation(input(db))
      expect(result.status).toBe('complete')
      if (result.status === 'complete') {
        expect(result.metrics[0].result.coverage.find((entry) => entry.dimension === 'completeness'))
          .toMatchObject({ value: 1, limiting_reason: null })
      }
    } finally {
      db.close()
    }
  })

  it('detects a schema without explicit readiness columns', () => {
    const db = createSyntheticV3StoredObservationDatabase()
    try {
      db.pragma('foreign_keys = OFF')
      db.exec(`DROP TABLE pull_request_fact;
        CREATE TABLE pull_request_fact (
          scope_id TEXT, fact_id TEXT, created_at TEXT, merged_at TEXT, closed_at TEXT,
          additions INTEGER, deletions INTEGER, changed_files INTEGER, c2_expires_at TEXT, state TEXT
        );`)
      expectAbstention(db, 'READY_COLUMNS_MISSING')
    } finally {
      db.close()
    }
  })

  it('does not disguise an internal storage or contract fault as analytical abstention', () => {
    const db = createSyntheticV3StoredObservationDatabase()
    db.close()
    expect(() => bridgeV3StoredObservation(input(db))).toThrow()
  })
})
