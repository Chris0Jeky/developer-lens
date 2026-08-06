import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { CLAIM_SCHEMA_VERSION } from '../../shared/claims.js'
import {
  applyContinuityCasOperation,
  assertContinuityCasConsistency,
  initializeContinuityCasScope,
} from './v3ContinuityCasProposal.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import {
  isoWeekFromCanonicalTimestamp,
} from './v3ShadowRewrite.js'
import {
  STORAGE_V3_C2_SWEEP_GROUPS,
  STORAGE_V3_C2_SWEEP_STAGES,
  StorageV3C2SweepError,
  sweepStorageV3C2,
  type StorageV3C2SweepErrorCode,
} from './v3ShadowSweep.js'

const hex = (letter: string): string => letter.repeat(64)
const id = (prefix: string, letter: string): string => `${prefix}${hex(letter)}`
const scopeId = id('scope-', 'a')
const jobId = id('job-', 'b')
const snapshotId = id('snap-', 'c')
const checkpointId = id('ckpt-', 'd')
const coverageId = id('cov-', 'e')
const evidenceId = id('ev-', 'f')
const claimId = id('cl_', '1')
const expiresAt = '2026-02-28T12:00:00.000Z'
const beforeExpiry = '2026-02-28T11:59:59.999Z'
const createdAt = '2025-01-31T12:00:00.000Z'

function seedSweepTarget(db: Database.Database): void {
  installStorageV3ShadowSchema(db)
  db.prepare(`INSERT INTO claim_scope (
    scope_id, scope_alias, linked_at, alias_expires_at
  ) VALUES (?, 'provider-a', ?, ?)`).run(scopeId, createdAt, expiresAt)
  db.prepare(`INSERT INTO repository_identity (
    scope_id, provider_id, analytical_key, identity_expires_at,
    is_private, is_archived, is_fork
  ) VALUES (?, 'provider-a', 'analytical-a', ?, 0, 0, 0)`).run(scopeId, expiresAt)
  db.prepare(`INSERT INTO coverage_observation (
    scope_id, coverage_id, capability_id, status, limitation_code, observed_units
  ) VALUES (?, ?, 'github.core', 'complete', 'NONE', 3)`)
    .run(scopeId, id('cov-', '7'))
  db.prepare(`INSERT INTO v2_store_provenance (
    singleton, mode, synthetic_marker, importer_version, created_at
  ) VALUES (1, 'synthetic', 'invented-sweep-fixture', 'test-v1', ?)`)
    .run(createdAt)
  db.prepare(`INSERT INTO v2_coverage_record (
    coverage_id, capability_id, scope_alias, range_start, range_end, status,
    expected_units, observed_units, omitted_units, retryable, observed_at, limitation_code
  ) VALUES ('invented-c0-coverage', 'github.core', 'invented-c0-scope', ?, ?,
    'complete', 3, 3, 0, 0, ?, 'NONE')`)
    .run('2025-01-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z', createdAt)
  db.prepare(`INSERT INTO commit_observation (
    scope_id, observation_id, sha, occurred_at, source, c2_expires_at,
    additions, deletions, files, parent_count, feature_type, is_revert, is_fixup, message_length
  ) VALUES (?, ?, 'invented-sha', ?, 'github', ?, 3, 1, 1, 1, 'feat', 0, 0, 12)`)
    .run(scopeId, id('obs-', '2'), createdAt, expiresAt)
  db.prepare(`INSERT INTO pull_request_fact (
    scope_id, fact_id, number, created_at, merged_at, closed_at, c2_expires_at,
    state, is_draft, additions, deletions, changed_files, comments, reviews
  ) VALUES (?, ?, 17, ?, ?, ?, ?, 'MERGED', 0, 3, 1, 1, 2, 1)`)
    .run(scopeId, id('pr-', '3'), createdAt, createdAt, createdAt, expiresAt)
  db.prepare(`INSERT INTO dated_event_observation (
    scope_id, event_id, occurred_at, c2_expires_at, event_kind
  ) VALUES (?, ?, ?, ?, 'review')`).run(scopeId, id('event-', '4'), createdAt, expiresAt)
  db.prepare(`INSERT INTO collection_job (
    scope_id, job_id, capability_id, storage_contract_version, query_version,
    source_api_version, consent_revision, status, source_job_id, payload_hash,
    range_start, range_end, observed_at, started_at, completed_at, c2_expires_at
  ) VALUES (?, ?, 'github.core', '2.2.0', 'github.core.v1', '2026-03-10',
    'consent-v3', 'complete', 'source-job-a', ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      scopeId,
      jobId,
      hex('5'),
      '2025-01-01T00:00:00.000Z',
      '2025-02-01T00:00:00.000Z',
      createdAt,
      createdAt,
      createdAt,
      expiresAt,
    )
  db.prepare(`INSERT INTO source_snapshot (
    scope_id, snapshot_id, job_id, capability_id, source_snapshot_id, snapshot_hash,
    range_start, range_end, observed_at, c2_expires_at, status
  ) VALUES (?, ?, ?, 'github.core', 'source-snapshot-a', ?, ?, ?, ?, ?, 'closed')`)
    .run(
      scopeId,
      snapshotId,
      jobId,
      hex('6'),
      '2025-01-01T00:00:00.000Z',
      '2025-02-01T00:00:00.000Z',
      createdAt,
      expiresAt,
    )
  db.prepare(`INSERT INTO coverage_ledger (
    scope_id, coverage_id, job_id, snapshot_id, capability_id, status,
    expected_units, observed_units, omitted_units, retryable, limitation_code,
    source_coverage_id, range_start, range_end, observed_at, c2_expires_at
  ) VALUES (?, ?, ?, ?, 'github.core', 'complete', 3, 3, 0, 0, 'NONE',
    'source-coverage-a', ?, ?, ?, ?)`)
    .run(
      scopeId,
      coverageId,
      jobId,
      snapshotId,
      '2025-01-01T00:00:00.000Z',
      '2025-02-01T00:00:00.000Z',
      createdAt,
      expiresAt,
    )
  db.prepare(`INSERT INTO collection_checkpoint (
    scope_id, checkpoint_id, job_id, snapshot_id, capability_id, query_version,
    source_api_version, consent_revision, coverage_state, deletion_order,
    lineage_coverage, high_watermark, cursor_hint, bounded_overlap_start,
    last_complete_snapshot_hash, c2_expires_at
  ) VALUES (?, ?, ?, ?, 'github.core', 'github.core.v1', '2026-03-10',
    'consent-v3', 'complete', 0, 'complete', ?, 'cursor-a', ?, ?, ?)`)
    .run(
      scopeId,
      checkpointId,
      jobId,
      snapshotId,
      '2025-02-01T00:00:00.000Z',
      '2025-01-01T00:00:00.000Z',
      hex('6'),
      expiresAt,
    )
  db.prepare(`INSERT INTO evidence (
    scope_id, evidence_id, coverage_id, layer, schema_version
  ) VALUES (?, ?, ?, 'observed', '2.0.0')`).run(scopeId, evidenceId, coverageId)
  db.prepare(`INSERT INTO claim (
    scope_id, claim_id, layer, statement_code, method_id, method_version,
    window_start, window_end, schema_version, claim_id_material_version, created_at
  ) VALUES (?, ?, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', ?, ?, ?, 'claim-id.v3', ?)`)
    .run(
      scopeId,
      claimId,
      '2025-01-01T00:00:00.000Z',
      '2025-02-01T00:00:00.000Z',
      CLAIM_SCHEMA_VERSION,
      createdAt,
    )
  db.prepare(`INSERT INTO claim_evidence_edge (
    scope_id, claim_id, role, target_evidence_id
  ) VALUES (?, ?, 'supports', ?)`).run(scopeId, claimId, evidenceId)
  db.prepare(`INSERT INTO limitation_instance (
    scope_id, claim_id, limitation_code, dimension, copy_key
  ) VALUES (?, ?, 'SAMPLE_TOO_SMALL', 'sample', 'copy')`).run(scopeId, claimId)
}

function seedUnreferencedJob(db: Database.Database): string {
  const unreferencedJobId = id('job-', '9')
  db.prepare(`INSERT INTO collection_job (
    scope_id, job_id, capability_id, storage_contract_version, query_version,
    source_api_version, consent_revision, status, source_job_id, payload_hash,
    range_start, range_end, observed_at, started_at, completed_at, c2_expires_at
  ) VALUES (?, ?, 'github.core', '2.2.0', 'github.core.v1', '2026-03-10',
    'consent-v3', 'complete', 'source-job-unreferenced', ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      scopeId,
      unreferencedJobId,
      hex('9'),
      '2025-01-01T00:00:00.000Z',
      '2025-02-01T00:00:00.000Z',
      createdAt,
      createdAt,
      createdAt,
      expiresAt,
    )
  return unreferencedJobId
}

function sweepError(action: () => unknown, code: StorageV3C2SweepErrorCode): void {
  try {
    action()
  } catch (error) {
    expect(error).toBeInstanceOf(StorageV3C2SweepError)
    expect((error as StorageV3C2SweepError).code).toBe(code)
    expect((error as Error).message).toBe(code)
    return
  }
  throw new Error(`expected ${code}`)
}

function everyC2Value(db: Database.Database): unknown[] {
  const selections = [
    ['claim_scope', 'scope_alias, linked_at, alias_expires_at'],
    ['repository_identity', 'provider_id, analytical_key, identity_expires_at'],
    ['commit_observation', 'sha, occurred_at, source, c2_expires_at'],
    ['pull_request_fact', 'number, created_at, merged_at, closed_at, c2_expires_at'],
    ['dated_event_observation', 'occurred_at, c2_expires_at'],
    [
      'collection_job',
      'source_job_id, payload_hash, range_start, range_end, observed_at, started_at, completed_at, c2_expires_at',
    ],
    [
      'collection_checkpoint',
      'high_watermark, cursor_hint, bounded_overlap_start, last_complete_snapshot_hash, c2_expires_at',
    ],
    ['source_snapshot', 'source_snapshot_id, snapshot_hash, range_start, range_end, observed_at, c2_expires_at'],
    ['coverage_ledger', 'source_coverage_id, range_start, range_end, observed_at, c2_expires_at'],
    ['claim', 'created_at'],
  ] as const
  return selections.flatMap(([table, columns]) =>
    (db.prepare(`SELECT ${columns} FROM ${table}`).all() as Array<Record<string, unknown>>)
      .flatMap((row) => Object.values(row)))
}

function retainedSnapshot(db: Database.Database): Record<string, unknown[]> {
  const selections = [
    ['import_run', 'run_id, schema_version, status', 'run_id'],
    ['claim_scope', 'scope_id', 'scope_id'],
    ['repository_identity', 'scope_id, is_private, is_archived, is_fork', 'scope_id'],
    [
      'commit_observation',
      'scope_id, observation_id, additions, deletions, files, parent_count, feature_type, is_revert, is_fixup, message_length',
      'scope_id, observation_id',
    ],
    [
      'pull_request_fact',
      'scope_id, fact_id, state, is_draft, additions, deletions, changed_files, comments, reviews',
      'scope_id, fact_id',
    ],
    [
      'coverage_observation',
      'scope_id, coverage_id, capability_id, status, limitation_code, observed_units',
      'scope_id, coverage_id',
    ],
    ['dated_event_observation', 'scope_id, event_id, event_kind', 'scope_id, event_id'],
    ['v2_store_provenance', 'singleton, mode, synthetic_marker, importer_version, created_at', 'singleton'],
    [
      'v2_coverage_record',
      'coverage_id, capability_id, scope_alias, range_start, range_end, status, expected_units, observed_units, omitted_units, saturation_reason, retryable, observed_at, limitation_code',
      'coverage_id',
    ],
    [
      'collection_job',
      'scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version, consent_revision, status',
      'scope_id, job_id',
    ],
    [
      'collection_checkpoint',
      'scope_id, checkpoint_id, job_id, snapshot_id, capability_id, query_version, source_api_version, consent_revision, coverage_state, deletion_order, lineage_coverage',
      'scope_id, checkpoint_id',
    ],
    ['source_snapshot', 'scope_id, snapshot_id, job_id, capability_id, status', 'scope_id, snapshot_id'],
    [
      'coverage_ledger',
      'scope_id, coverage_id, job_id, snapshot_id, capability_id, status, expected_units, observed_units, omitted_units, saturation_reason, retryable, limitation_code',
      'scope_id, coverage_id',
    ],
    ['evidence', 'scope_id, evidence_id, coverage_id, layer, schema_version', 'scope_id, evidence_id'],
    [
      'claim',
      'scope_id, claim_id, layer, statement_code, method_id, method_version, window_start, window_end, schema_version, claim_id_material_version, superseded_by',
      'scope_id, claim_id',
    ],
    [
      'claim_evidence_edge',
      'scope_id, claim_id, role, target_evidence_id, target_claim_id, target_coverage_id',
      'scope_id, claim_id, role',
    ],
    [
      'limitation_instance',
      'scope_id, claim_id, limitation_code, dimension, copy_key',
      'scope_id, claim_id, limitation_code, dimension, copy_key',
    ],
  ] as const
  return Object.fromEntries(selections.map(([table, columns, order]) => [
    table,
    db.prepare(`SELECT ${columns} FROM ${table} ORDER BY ${order}`).all(),
  ]))
}

describe('storage-v3 B2a-iii ongoing C2 sweep', () => {
  it('clears every C2 group at the inclusive boundary without changing the C1 claim graph', () => {
    const db = new Database(':memory:')
    try {
      seedSweepTarget(db)
      const unreferencedJobId = seedUnreferencedJob(db)
      const retainedBefore = retainedSnapshot(db)
      const early = sweepStorageV3C2({
        targetDb: db,
        asOf: beforeExpiry,
        randomBytes: () => { throw new Error('entropy must not run for a no-op') },
      })
      expect(early.status).toBe('noop')
      expect(early.cleared).toEqual(Object.fromEntries(STORAGE_V3_C2_SWEEP_GROUPS.map((key) => [key, 0])))
      expect(everyC2Value(db).every((value) => value !== null)).toBe(true)

      const swept = sweepStorageV3C2({
        targetDb: db,
        asOf: expiresAt,
        randomBytes: () => Buffer.alloc(32, 51),
      })
      const expectedCleared = Object.fromEntries(STORAGE_V3_C2_SWEEP_GROUPS.map((key) => [key, 1]))
      expectedCleared.collectionJob = 2
      expect(swept).toMatchObject({
        completeB2: false,
        status: 'complete',
        schemaVersion: '3.1.0-shadow-b3',
        cleared: expectedCleared,
        lineageEvents: 5,
      })
      expect(everyC2Value(db).every((value) => value === null)).toBe(true)
      expect(retainedSnapshot(db)).toEqual(retainedBefore)
      expect(db.prepare(`SELECT job_id, status FROM collection_job`).get()).toEqual({ job_id: jobId, status: 'complete' })
      expect(db.prepare('SELECT COUNT(*) FROM collection_job').pluck().get()).toBe(2)
      expect(db.prepare(`SELECT snapshot_id, job_id, status FROM source_snapshot`).get())
        .toEqual({ snapshot_id: snapshotId, job_id: jobId, status: 'closed' })
      expect(db.prepare(`SELECT coverage_id, job_id, snapshot_id, status FROM coverage_ledger`).get())
        .toEqual({ coverage_id: coverageId, job_id: jobId, snapshot_id: snapshotId, status: 'complete' })
      expect(db.prepare('SELECT COUNT(*) FROM evidence').pluck().get()).toBe(1)
      expect(db.prepare('SELECT COUNT(*) FROM claim').pluck().get()).toBe(1)
      expect(db.prepare('SELECT COUNT(*) FROM claim_evidence_edge').pluck().get()).toBe(1)
      expect(db.prepare('SELECT COUNT(*) FROM limitation_instance').pluck().get()).toBe(1)

      const lineage = db.prepare(`SELECT
        scope_id, subject_kind, subject_id, operation_id, event_kind, event_week
        FROM lineage_event ORDER BY event_kind, subject_kind, subject_id`).all() as Array<Record<string, unknown>>
      expect(lineage).toHaveLength(5)
      expect(new Set(lineage.map(({ operation_id }) => operation_id))).toEqual(new Set([`op-${'33'.repeat(32)}`]))
      expect(new Set(lineage.map(({ event_week }) => event_week)))
        .toEqual(new Set([isoWeekFromCanonicalTimestamp(expiresAt)]))
      expect(lineage.map(({ subject_kind, subject_id, event_kind }) => ({ subject_kind, subject_id, event_kind })))
        .toEqual([
          { subject_kind: 'checkpoint', subject_id: checkpointId, event_kind: 'c2_retention_expired' },
          { subject_kind: 'coverage', subject_id: coverageId, event_kind: 'c2_retention_expired' },
          { subject_kind: 'job', subject_id: jobId, event_kind: 'c2_retention_expired' },
          { subject_kind: 'snapshot', subject_id: snapshotId, event_kind: 'c2_retention_expired' },
          { subject_kind: 'scope', subject_id: scopeId, event_kind: 'scope_alias_expired' },
        ])
      expect(db.prepare('SELECT 1 FROM lineage_event WHERE subject_id = ?').get(unreferencedJobId)).toBeUndefined()

      const replay = sweepStorageV3C2({
        targetDb: db,
        asOf: '2027-01-01T00:00:00.000Z',
        randomBytes: () => { throw new Error('a completed sweep must never resurrect or remint') },
      })
      expect(replay.status).toBe('noop')
      expect(replay.lineageEvents).toBe(0)
      expect(everyC2Value(db).every((value) => value === null)).toBe(true)
      expect(db.prepare('SELECT COUNT(*) FROM lineage_event').pluck().get()).toBe(5)
    } finally {
      db.close()
    }
  })

  it.each(STORAGE_V3_C2_SWEEP_STAGES)('rolls back the full sweep after %s', (stage) => {
    const db = new Database(':memory:')
    try {
      seedSweepTarget(db)
      const before = db.serialize()
      sweepError(() => sweepStorageV3C2({
        targetDb: db,
        asOf: expiresAt,
        randomBytes: () => Buffer.alloc(32, 52),
        failAfterStage: (candidate) => {
          if (candidate === stage) throw new Error('invented failure')
        },
      }), 'SWEEP_FAILED')
      expect(db.inTransaction).toBe(false)
      expect(db.serialize().equals(before)).toBe(true)
    } finally {
      db.close()
    }
  })

  it('mints one neutral operation per scope and never crosses lineage scope ownership', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      const scopes = [scopeId, id('scope-', 'b')]
      for (const [index, scope] of scopes.entries()) {
        db.prepare(`INSERT INTO claim_scope (
          scope_id, scope_alias, linked_at, alias_expires_at
        ) VALUES (?, ?, ?, ?)`).run(scope, `provider-${index}`, createdAt, expiresAt)
      }
      const entropy = [60, 60, 61]
      let entropyIndex = 0
      const result = sweepStorageV3C2({
        targetDb: db,
        asOf: expiresAt,
        randomBytes: () => Buffer.alloc(32, entropy[entropyIndex++] ?? 62),
      })
      expect(result.cleared.claimScope).toBe(2)
      expect(result.lineageEvents).toBe(2)
      const events = db.prepare(`SELECT scope_id, subject_id, operation_id
        FROM lineage_event ORDER BY scope_id`).all() as Array<Record<string, unknown>>
      expect(events.map(({ scope_id, subject_id }) => ({ scope_id, subject_id }))).toEqual([
        { scope_id: scopes[0], subject_id: scopes[0] },
        { scope_id: scopes[1], subject_id: scopes[1] },
      ])
      expect(new Set(events.map(({ operation_id }) => operation_id)).size).toBe(2)
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  it('refuses invalid callers, schema identities, and malformed target clocks before mutation', () => {
    const empty = new Database(':memory:')
    const target = new Database(':memory:')
    try {
      const emptyBefore = empty.serialize()
      sweepError(() => sweepStorageV3C2({ targetDb: empty, asOf: expiresAt }), 'TARGET_SCHEMA_REFUSED')
      expect(empty.serialize().equals(emptyBefore)).toBe(true)

      seedSweepTarget(target)
      const validBefore = target.serialize()
      sweepError(() => sweepStorageV3C2({ targetDb: target, asOf: '2026-02-28T12:00:00Z' }), 'INVALID_TIMESTAMP')
      expect(target.serialize().equals(validBefore)).toBe(true)

      target.prepare("UPDATE claim SET created_at = '2025-02-29T12:00:00.000Z'").run()
      const malformedBefore = target.serialize()
      sweepError(() => sweepStorageV3C2({ targetDb: target, asOf: expiresAt }), 'SWEEP_STATE_REFUSED')
      expect(target.serialize().equals(malformedBefore)).toBe(true)
    } finally {
      empty.close()
      target.close()
    }
  })

  it('fails closed under a second writer and succeeds without partial state after release', () => {
    const directory = mkdtempSync(join(tmpdir(), 'developer-lens-v3-sweep-'))
    const databasePath = join(directory, 'shadow.sqlite')
    const held = new Database(databasePath)
    const contender = new Database(databasePath)
    try {
      seedSweepTarget(held)
      held.pragma('busy_timeout = 0')
      contender.pragma('busy_timeout = 0')
      held.exec('BEGIN IMMEDIATE')
      sweepError(() => sweepStorageV3C2({
        targetDb: contender,
        asOf: expiresAt,
        randomBytes: () => Buffer.alloc(32, 53),
      }), 'SWEEP_BUSY')
      expect(held.prepare('SELECT scope_alias FROM claim_scope').pluck().get()).toBe('provider-a')
      held.exec('ROLLBACK')

      const result = sweepStorageV3C2({
        targetDb: contender,
        asOf: expiresAt,
        randomBytes: () => Buffer.alloc(32, 53),
      })
      expect(result.status).toBe('complete')
      expect(contender.prepare('SELECT scope_alias FROM claim_scope').pluck().get()).toBeNull()
      expect(contender.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      if (held.inTransaction) held.exec('ROLLBACK')
      held.close()
      contender.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('clears CAS payload receipts at the 13-month boundary and leaves younger ones intact (#128)', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      const scopeId = `scope-${'a'.repeat(64)}`
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeId)
      initializeContinuityCasScope(db, scopeId)
      const aged = {
        scopeId,
        expectedRevision: 0,
        operationId: `op-${'a'.repeat(64)}`,
        payloadSha256: 'b'.repeat(64),
      }
      const young = {
        ...aged,
        expectedRevision: 1,
        operationId: `op-${'b'.repeat(64)}`,
      }
      expect(applyContinuityCasOperation(db, aged, () => '2025-01-15T00:00:00.000Z').status)
        .toBe('applied')
      expect(applyContinuityCasOperation(db, young, () => '2026-03-01T00:00:00.000Z').status)
        .toBe('applied')

      // Under the boundary: nothing clears.
      const early = sweepStorageV3C2({
        targetDb: db,
        asOf: '2026-02-01T00:00:00.000Z',
        randomBytes: () => Buffer.alloc(32, 60),
      })
      expect(early.casReceiptsCleared).toBe(0)

      // At the boundary the aged receipt clears; the young one survives; the rows
      // themselves remain (revision history is C1) and consistency still holds.
      const swept = sweepStorageV3C2({
        targetDb: db,
        asOf: '2026-03-01T00:00:00.000Z',
        randomBytes: () => Buffer.alloc(32, 61),
      })
      expect(swept.casReceiptsCleared).toBe(1)
      expect(db.prepare('SELECT payload_sha256 FROM continuity_cas_operation WHERE operation_id = ?')
        .pluck().get(aged.operationId)).toBeNull()
      expect(db.prepare('SELECT payload_sha256 FROM continuity_cas_operation WHERE operation_id = ?')
        .pluck().get(young.operationId)).toBe('b'.repeat(64))
      expect(db.prepare('SELECT COUNT(*) FROM continuity_cas_operation').pluck().get()).toBe(2)
      assertContinuityCasConsistency(db)

      // Idempotent: a rerun clears nothing further.
      expect(sweepStorageV3C2({
        targetDb: db,
        asOf: '2026-03-01T00:00:00.000Z',
        randomBytes: () => Buffer.alloc(32, 62),
      }).casReceiptsCleared).toBe(0)
    } finally {
      db.close()
    }
  })
})
