import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createInventedV2Source,
  migrateInventedSource,
  STORE_LIFECYCLE_TIMELINE,
} from '../../scripts/storeLifecycle.js'
import { openSelectedStorageV3Store } from './v3StoreFiles.js'
import { isoWeekFromCanonicalTimestamp } from './v3ShadowRewrite.js'
import { sweepStorageV3C2 } from './v3ShadowSweep.js'

/**
 * The C2 sweep against a real rewrite output. Every earlier sweep proof seeded
 * its target by hand; this one migrates an invented v2 store through the file
 * factory and sweeps the store the orchestrator actually accepted.
 */
const AGED_EXPIRY = '2026-04-01T00:00:00.000Z'
const RECENT_EXPIRY = '2027-02-01T00:00:00.000Z'
const DELETABLE_EXPIRY = '2027-02-15T00:00:00.000Z'

type Row = Record<string, unknown>

const C2_COLUMNS = [
  ['claim_scope', ['scope_alias', 'linked_at', 'alias_expires_at']],
  ['repository_identity', ['provider_id', 'analytical_key', 'identity_expires_at']],
  ['commit_observation', ['sha', 'occurred_at', 'source', 'c2_expires_at']],
  ['pull_request_fact', ['number', 'created_at', 'merged_at', 'closed_at', 'c2_expires_at']],
  ['dated_event_observation', ['occurred_at', 'c2_expires_at']],
  ['collection_job', [
    'source_job_id', 'payload_hash', 'range_start', 'range_end', 'observed_at',
    'started_at', 'completed_at', 'c2_expires_at',
  ]],
  ['collection_checkpoint', [
    'high_watermark', 'cursor_hint', 'bounded_overlap_start',
    'last_complete_snapshot_hash', 'c2_expires_at',
  ]],
  ['source_snapshot', [
    'source_snapshot_id', 'snapshot_hash', 'range_start', 'range_end',
    'observed_at', 'c2_expires_at',
  ]],
  ['coverage_ledger', ['source_coverage_id', 'range_start', 'range_end', 'observed_at', 'c2_expires_at']],
  ['claim', ['created_at']],
] as const

const C1_COLUMNS = [
  ['claim_scope', 'scope_id', 'scope_id'],
  ['repository_identity', 'scope_id, is_private, is_archived, is_fork', 'scope_id'],
  ['commit_observation', 'scope_id, observation_id, additions, deletions, files, feature_type, message_length', 'observation_id'],
  ['pull_request_fact', 'scope_id, fact_id, state, is_draft, additions, comments, reviews', 'fact_id'],
  ['dated_event_observation', 'scope_id, event_id, event_kind', 'event_id'],
  ['collection_job', 'scope_id, job_id, capability_id, status, storage_contract_version', 'job_id'],
  ['collection_checkpoint', 'scope_id, checkpoint_id, job_id, snapshot_id, coverage_state, deletion_order', 'checkpoint_id'],
  ['source_snapshot', 'scope_id, snapshot_id, job_id, status', 'snapshot_id'],
  ['coverage_ledger', 'scope_id, coverage_id, job_id, snapshot_id, status, observed_units, limitation_code', 'coverage_id'],
  ['evidence', 'scope_id, evidence_id, coverage_id, layer, schema_version', 'evidence_id'],
  ['claim', 'scope_id, claim_id, layer, statement_code, method_id, window_start, window_end', 'claim_id'],
  ['claim_evidence_edge', 'scope_id, claim_id, role, target_evidence_id', 'claim_id, role'],
  ['limitation_instance', 'scope_id, claim_id, limitation_code, dimension, copy_key', 'claim_id, limitation_code'],
] as const

const c1Snapshot = (db: Database.Database): Record<string, Row[]> => Object.fromEntries(
  C1_COLUMNS.map(([table, columns, order]) => [
    table,
    db.prepare(`SELECT ${columns} FROM ${table} ORDER BY ${order}`).all() as Row[],
  ]),
)

const c2Values = (db: Database.Database, scopeId: string): unknown[] =>
  C2_COLUMNS.flatMap(([table, columns]) =>
    (db.prepare(`SELECT ${columns.join(', ')} FROM ${table} WHERE scope_id = ?`).all(scopeId) as Row[])
      .flatMap((row) => Object.values(row)))

const lineageRows = (db: Database.Database): Row[] => db.prepare(
  `SELECT scope_id, subject_kind, subject_id, operation_id, event_kind, event_week
   FROM lineage_event ORDER BY event_kind, subject_kind, subject_id`,
).all() as Row[]

describe('storage-v3 C2 sweep against a migrated store', () => {
  let directory: string
  let store: Database.Database | undefined

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'developer-lens-v3-sweep-integration-'))
    const source = createInventedV2Source(directory)
    try {
      // The B3 fixture order: the bridge is present from the start and the
      // historical legacy tombstone travels through the rewrite as lineage.
      expect(migrateInventedSource(source, directory).status).toBe('complete')
    } finally {
      source.db.close()
    }
    store = openSelectedStorageV3Store(directory)
  })

  afterEach(() => {
    store?.close()
    store = undefined
    rmSync(directory, { recursive: true, force: true })
  })

  it('clears only the expired cohort and keeps every C1 anchor of both', () => {
    const db = store!
    const scopeExpiry = db.prepare(
      'SELECT scope_id, alias_expires_at FROM claim_scope ORDER BY alias_expires_at',
    ).all() as Row[]
    expect(scopeExpiry.map(({ alias_expires_at: expiry }) => expiry))
      .toEqual([AGED_EXPIRY, RECENT_EXPIRY, DELETABLE_EXPIRY])
    const agedScope = String(scopeExpiry[0].scope_id)
    const recentScope = String(scopeExpiry[1].scope_id)

    // The rewrite retained live C2 for both cohorts, so the sweep has a real choice.
    expect(c2Values(db, agedScope).every((value) => value !== null)).toBe(true)
    const recentBefore = c2Values(db, recentScope)
    expect(recentBefore.every((value) => value !== null)).toBe(true)
    const c1Before = c1Snapshot(db)
    const migratedLineage = lineageRows(db)
    expect(migratedLineage).toHaveLength(1)
    expect(migratedLineage[0]).toMatchObject({ event_kind: 'legacy_deletion_operation', scope_id: null })

    const swept = sweepStorageV3C2({ targetDb: db, asOf: STORE_LIFECYCLE_TIMELINE.sweepAsOf })
    expect(swept).toMatchObject({
      status: 'complete',
      cleared: {
        claimScope: 1,
        repositoryIdentity: 1,
        commitObservation: 1,
        pullRequestFact: 1,
        datedEventObservation: 1,
        collectionJob: 1,
        collectionCheckpoint: 1,
        sourceSnapshot: 1,
        coverageLedger: 1,
        claim: 1,
      },
      lineageEvents: 5,
    })

    expect(c2Values(db, agedScope).every((value) => value === null)).toBe(true)
    expect(c2Values(db, recentScope)).toEqual(recentBefore)
    expect(c1Snapshot(db)).toEqual(c1Before)
    expect(db.prepare('PRAGMA integrity_check').pluck().get()).toBe('ok')
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })

  it('records one retention event per retained expired subject and none for the live cohort', () => {
    const db = store!
    const agedScope = String(db.prepare(
      'SELECT scope_id FROM claim_scope WHERE alias_expires_at = ?',
    ).pluck().get(AGED_EXPIRY))
    const agedJob = String(db.prepare('SELECT job_id FROM collection_job WHERE scope_id = ?').pluck().get(agedScope))
    const agedSnapshot = String(db.prepare('SELECT snapshot_id FROM source_snapshot WHERE scope_id = ?').pluck().get(agedScope))
    const agedCheckpoint = String(db.prepare('SELECT checkpoint_id FROM collection_checkpoint WHERE scope_id = ?').pluck().get(agedScope))
    const agedCoverage = String(db.prepare('SELECT coverage_id FROM coverage_ledger WHERE scope_id = ?').pluck().get(agedScope))

    sweepStorageV3C2({ targetDb: db, asOf: STORE_LIFECYCLE_TIMELINE.sweepAsOf })

    const events = lineageRows(db).filter(({ event_kind: kind }) => kind !== 'legacy_deletion_operation')
    expect(events.map(({ subject_kind: kind, subject_id: subject, event_kind: event }) =>
      ({ kind, subject, event }))).toEqual([
      { kind: 'checkpoint', subject: agedCheckpoint, event: 'c2_retention_expired' },
      { kind: 'coverage', subject: agedCoverage, event: 'c2_retention_expired' },
      { kind: 'job', subject: agedJob, event: 'c2_retention_expired' },
      { kind: 'snapshot', subject: agedSnapshot, event: 'c2_retention_expired' },
      { kind: 'scope', subject: agedScope, event: 'scope_alias_expired' },
    ])
    expect(new Set(events.map(({ scope_id: scope }) => scope))).toEqual(new Set([agedScope]))
    expect(new Set(events.map(({ operation_id: operation }) => operation)).size).toBe(1)
    expect(new Set(events.map(({ event_week: week }) => week)))
      .toEqual(new Set([isoWeekFromCanonicalTimestamp(AGED_EXPIRY)]))
  })

  it('stays selectable after the sweep and never resurrects or remints on replay', () => {
    const db = store!
    sweepStorageV3C2({ targetDb: db, asOf: STORE_LIFECYCLE_TIMELINE.sweepAsOf })
    const afterFirst = db.serialize()
    const replay = sweepStorageV3C2({
      targetDb: db,
      asOf: STORE_LIFECYCLE_TIMELINE.sweepAsOf,
      randomBytes: () => { throw new Error('a completed sweep must never remint') },
    })
    expect(replay.status).toBe('noop')
    expect(replay.lineageEvents).toBe(0)
    expect(db.serialize().equals(afterFirst)).toBe(true)

    db.close()
    store = undefined
    const reopened = openSelectedStorageV3Store(directory)
    try {
      expect(Number(reopened.prepare('SELECT COUNT(*) FROM lineage_event').pluck().get())).toBe(6)
      expect(Number(reopened.prepare('SELECT COUNT(*) FROM claim').pluck().get())).toBe(3)
    } finally {
      reopened.close()
    }
  })

  it('clears the second cohort only once its own boundary is reached', () => {
    const db = store!
    const recentScope = String(db.prepare(
      'SELECT scope_id FROM claim_scope WHERE alias_expires_at = ?',
    ).pluck().get(RECENT_EXPIRY))
    sweepStorageV3C2({ targetDb: db, asOf: STORE_LIFECYCLE_TIMELINE.sweepAsOf })
    expect(c2Values(db, recentScope).every((value) => value !== null)).toBe(true)
    const later = sweepStorageV3C2({ targetDb: db, asOf: RECENT_EXPIRY })
    expect(later.status).toBe('complete')
    expect(later.lineageEvents).toBe(5)
    expect(c2Values(db, recentScope).every((value) => value === null)).toBe(true)
    expect(Number(db.prepare('SELECT COUNT(*) FROM claim').pluck().get())).toBe(3)
    expect(Number(db.prepare('SELECT COUNT(*) FROM coverage_ledger').pluck().get())).toBe(3)
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
})
