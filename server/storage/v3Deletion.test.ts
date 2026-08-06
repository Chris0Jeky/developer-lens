import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { CLAIM_SCHEMA_VERSION, computeClaimId } from '../../shared/claims.js'
import { installV2BridgeStore } from '../api/v2/store.js'
import { installClaimGraphStorage } from './claims.js'
import { openStorageDatabase } from './database.js'
import { installIncrementalGithubCoreStorage } from './incremental.js'
import { createInstallationAliases } from './installationAliases.js'
import {
  applyContinuityCasOperation,
  initializeContinuityCasScope,
} from './v3ContinuityCasProposal.js'
import {
  completeStorageV3DeletionMaintenance,
  deleteStorageV3Scope,
  readStorageV3DeletionLineage,
  STORAGE_V3_DELETION_STAGES,
  StorageV3DeletionError,
  type StorageV3DeletionStage,
} from './v3Deletion.js'
import { rewriteStorageV3Shadow } from './v3ShadowRewrite.js'
import { STORAGE_V3_SHADOW_TABLES } from './v3ShadowSchema.js'

/**
 * B3 — complete scope deletion on the selected v3 domain. The fixture is a REAL
 * migrated store: a two-scope invented v2 source (bridge installed, exercising
 * bridge-present migration) rewritten through the production engine, with CAS
 * activity on both scopes. Deleting one scope must remove every registered SQL
 * descendant and its CAS rows, leave the other scope untouched, survive replay,
 * refuse conflicting deletion identities, and roll back completely from an
 * injected failure at every stage.
 */

const AS_OF = '2026-03-01T00:00:00.000Z'
const DELETE_AT = '2026-03-02T00:00:00.000Z'
const LEGACY_SUFFIX = 'e'.repeat(64)

interface ScopeSeed {
  readonly raw: string
  readonly provider: string
}

function seedScopeGraph(db: Database.Database, key: Buffer, raw: string, tag: string): ScopeSeed {
  const aliases = createInstallationAliases(key)
  const provider = aliases.repositoryProviderId(raw)
  const analytical = aliases.repositoryAnalyticalKey(raw)
  const oldScope = `scope-${tag.repeat(64).slice(0, 64)}`
  db.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at) VALUES (?, ?, ?)')
    .run(oldScope, provider, '2026-01-01T00:00:00.000Z')
  db.prepare('INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, 0, 0, 0)')
    .run(provider, analytical)
  db.prepare('INSERT INTO commit_observation (repository_provider_id, sha, occurred_at, source, feature_type, is_revert, is_fixup, message_length) VALUES (?, ?, ?, ?, ?, 0, 0, 1)')
    .run(provider, `sha-${tag}`, '2026-01-02T00:00:00.000Z', 'github', 'feat')
  db.prepare('INSERT INTO pull_request_fact (provider_id, repository_provider_id, number, state, is_draft, created_at, additions, deletions, changed_files, comments, reviews) VALUES (?, ?, ?, ?, 0, ?, 1, 1, 1, 0, 0)')
    .run(`pr-source-${tag}`, provider, tag.charCodeAt(0), 'MERGED', '2026-01-02T00:00:00.000Z')
  db.prepare('INSERT INTO dated_event_observation (provider_id, repository_provider_id, event_kind, occurred_at) VALUES (?, ?, ?, ?)')
    .run(`event-source-${tag}`, provider, 'review', '2026-01-03T00:00:00.000Z')
  db.prepare('INSERT INTO collection_job (job_id, storage_contract_version, payload_hash, capability_id, scope_alias, query_version, source_api_version, consent_revision, range_start, range_end, observed_at, started_at, completed_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(`job-${tag}`, '2.2.0', 'a'.repeat(64), 'github.core', provider, 'github.core.v1', '2026-03-10', 'consent-v3', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 'complete')
  db.prepare('INSERT INTO source_snapshot (snapshot_id, job_id, capability_id, scope_alias, snapshot_hash, range_start, range_end, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(`snapshot-${tag}`, `job-${tag}`, 'github.core', provider, 'b'.repeat(64), '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z')
  db.prepare('INSERT INTO coverage_ledger (coverage_id, range_start, job_id, snapshot_id, capability_id, scope_alias, range_end, status, expected_units, observed_units, omitted_units, retryable, observed_at, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(`coverage-${tag}`, '2026-01-01T00:00:00.000Z', `job-${tag}`, `snapshot-${tag}`, 'github.core', provider, '2026-02-01T00:00:00.000Z', 'complete', 1, 1, 0, 0, '2026-02-01T00:00:00.000Z', 'NONE')
  db.prepare('INSERT INTO collection_checkpoint (capability_id, scope_alias, query_version, source_api_version, high_watermark, cursor_hint, bounded_overlap_start, last_complete_snapshot_hash, consent_revision, committed_job_id, source_snapshot_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('github.core', provider, 'github.core.v1', '2026-03-10', '2026-02-01T00:00:00.000Z', 'cursor', '2026-01-31T00:00:00.000Z', 'b'.repeat(64), 'consent-v3', `job-${tag}`, `snapshot-${tag}`)
  db.prepare('INSERT INTO evidence (evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(`evidence-${tag}`, 'observed', '2.0.0', `coverage-${tag}`, '2026-01-01T00:00:00.000Z', `job-${tag}`)
  const claim = computeClaimId({
    layer: 'modelled',
    statementCode: 'DELIVERY_FLOW',
    methodId: 'method',
    methodVersion: '1.0.0',
    basis: [{ role: 'supports', targetEvidenceId: `evidence-${tag}` }],
    windowStart: '2026-01-01T00:00:00.000Z',
    windowEnd: '2026-02-01T00:00:00.000Z',
    scopeId: oldScope,
    schemaVersion: CLAIM_SCHEMA_VERSION,
  })
  db.prepare('INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(claim, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', oldScope, CLAIM_SCHEMA_VERSION, 'claim-id.v2', '2026-02-01T00:00:00.000Z')
  db.prepare('INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id) VALUES (?, ?, ?)')
    .run(claim, 'supports', `evidence-${tag}`)
  db.prepare('INSERT INTO limitation_instance (claim_id, limitation_code, dimension, copy_key) VALUES (?, ?, ?, ?)')
    .run(claim, 'SAMPLE_TOO_SMALL', 'sample', 'copy')
  return { raw, provider }
}

interface MigratedFixture {
  readonly target: Database.Database
  readonly scopeA: string
  readonly scopeB: string
  cleanup(): void
}

function migratedFixture(options: { casOnBoth?: boolean } = {}): MigratedFixture {
  const source = openStorageDatabase(':memory:')
  installIncrementalGithubCoreStorage(source)
  installClaimGraphStorage(source)
  installV2BridgeStore(source)
  source.prepare('INSERT INTO v2_store_provenance (singleton, mode, synthetic_marker, importer_version, created_at) VALUES (1, ?, ?, ?, ?)')
    .run('synthetic', 'developer-lens.synthetic-importer.v1', '1.0.0', '2026-01-01T00:00:00.000Z')
  const key = Buffer.alloc(32, 41)
  const seedA = seedScopeGraph(source, key, 'invented-b3-repo-a', 'a')
  const seedB = seedScopeGraph(source, key, 'invented-b3-repo-b', 'b')
  // The C0 bridge is PRESENT at migration time — the B3 ordering the CLI could not
  // previously exercise. Its rows are validated then dropped (delete disposition).
  source.prepare('INSERT INTO v2_coverage_record (coverage_id, capability_id, scope_alias, range_start, range_end, status, expected_units, observed_units, omitted_units, saturation_reason, retryable, observed_at, limitation_code) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, NULL, 0, ?, ?)')
    .run('invented-c0-coverage', 'github.core', 'invented-c0-scope', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 'complete', '2026-02-01T00:00:00.000Z', 'COMPLETE')
  // A slice-A legacy tombstone: must survive any scope deletion untouched.
  source.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)')
    .run(`scope_tombstone_${LEGACY_SUFFIX}`, 'tombstone_cascade', 'cap_github_core', '2026-01-03T00:00:00.000Z')

  const target = new Database(':memory:')
  rewriteStorageV3Shadow({
    sourceDb: source,
    targetDb: target,
    identityBindings: [{ rawProviderId: seedA.raw }, { rawProviderId: seedB.raw }],
    installationKey: key,
    asOf: AS_OF,
    randomBytes: (() => {
      let counter = 0
      return () => Buffer.alloc(32, 50 + ((counter += 1) % 200))
    })(),
  })
  source.close()

  const aliases = createInstallationAliases(key)
  const scopeFor = (raw: string): string =>
    target.prepare('SELECT scope_id FROM claim_scope WHERE scope_alias = ?')
      .pluck().get(aliases.repositoryProviderId(raw)) as string
  const scopeA = scopeFor(seedA.raw)
  const scopeB = scopeFor(seedB.raw)

  if (options.casOnBoth !== false) {
    for (const [scope, seed] of [[scopeA, 61], [scopeB, 62]] as const) {
      initializeContinuityCasScope(target, scope)
      applyContinuityCasOperation(target, {
        scopeId: scope,
        expectedRevision: 0,
        operationId: `op-${seed.toString(16).padStart(2, '0').repeat(32)}`,
        payloadSha256: 'c'.repeat(64),
      })
    }
  }
  return { target, scopeA, scopeB, cleanup: () => target.close() }
}

function scopeRowCounts(db: Database.Database, scopeId: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const table of STORAGE_V3_SHADOW_TABLES) {
    const hasScope = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
      .some(({ name }) => name === 'scope_id')
    if (!hasScope) continue
    counts[table] = Number(
      db.prepare(`SELECT COUNT(*) FROM ${table} WHERE scope_id = ?`).pluck().get(scopeId),
    )
  }
  return counts
}

function snapshotScope(db: Database.Database, scopeId: string): string {
  const rows: unknown[] = []
  for (const table of [...STORAGE_V3_SHADOW_TABLES].sort()) {
    const hasScope = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
      .some(({ name }) => name === 'scope_id')
    if (!hasScope) continue
    rows.push([table, db.prepare(`SELECT * FROM ${table} WHERE scope_id = ? ORDER BY rowid`).all(scopeId)])
  }
  return JSON.stringify(rows)
}

function expectCode(run: () => unknown, code: string): void {
  try {
    run()
    throw new Error('expected StorageV3DeletionError')
  } catch (error) {
    expect(error).toBeInstanceOf(StorageV3DeletionError)
    expect(error).toMatchObject({ code, message: code })
  }
}

// Every test migrates a full two-scope fixture through the production rewrite, which
// legitimately exceeds the 5s default under a loaded parallel run.
describe('B3 v3 scope deletion', { timeout: 30_000 }, () => {
  it('deletes one scope completely, tombstones every subject, and leaves the other scope byte-intact', () => {
    const fixture = migratedFixture()
    try {
      const otherBefore = snapshotScope(fixture.target, fixture.scopeB)
      const legacyBefore = fixture.target.prepare(
        "SELECT * FROM lineage_event WHERE event_kind = 'legacy_deletion_operation'",
      ).all()
      const result = deleteStorageV3Scope({
        db: fixture.target,
        scopeId: fixture.scopeA,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 200),
      })
      expect(result.status).toBe('deleted')
      expect(result.maintenance).toBe('pending')
      // scope + claim + job + snapshot + checkpoint + coverage + evidence
      expect(result.tombstonesWritten).toBe(7)
      expect(result.operationId).toMatch(/^del-[0-9a-f]{64}$/)

      const remaining = scopeRowCounts(fixture.target, fixture.scopeA)
      expect(Object.values(remaining).every((count) => count === 0)).toBe(true)
      expect(snapshotScope(fixture.target, fixture.scopeB)).toBe(otherBefore)
      expect(fixture.target.prepare(
        "SELECT * FROM lineage_event WHERE event_kind = 'legacy_deletion_operation'",
      ).all()).toEqual(legacyBefore)

      // Every tombstone is scope-unbound, under ONE operation, at week grain.
      const tombstones = fixture.target.prepare(
        `SELECT scope_id, subject_kind, operation_id, event_week FROM lineage_event
         WHERE event_kind = 'tombstone_cascade'`,
      ).all() as Array<{ scope_id: unknown; subject_kind: string; operation_id: string; event_week: string }>
      expect(tombstones).toHaveLength(7)
      for (const row of tombstones) {
        expect(row.scope_id).toBeNull()
        expect(row.operation_id).toBe(result.operationId)
        expect(row.event_week).toBe('2026-W10')
      }
      expect(new Set(tombstones.map((row) => row.subject_kind))).toEqual(
        new Set(['scope', 'claim', 'job', 'snapshot', 'checkpoint', 'coverage', 'evidence']),
      )

      // CAS rows for the deleted scope are gone; the other scope's survive.
      expect(fixture.target.prepare('SELECT COUNT(*) FROM continuity_cas_state').pluck().get()).toBe(1)
      expect(fixture.target.prepare('SELECT COUNT(*) FROM continuity_cas_operation').pluck().get()).toBe(1)
      expect(fixture.target.prepare(
        'SELECT COUNT(*) FROM continuity_cas_state WHERE scope_id = ?',
      ).pluck().get(fixture.scopeB)).toBe(1)

      // The deletion lineage reader explains the erasure content-free.
      const lineage = readStorageV3DeletionLineage(fixture.target)
      expect(lineage.filter((entry) => entry.operationId === result.operationId)).toHaveLength(7)
      expect(lineage.some((entry) => entry.eventKind === 'legacy_deletion_operation')).toBe(true)
    } finally { fixture.cleanup() }
  })

  it('replays idempotently with the recorded operation and refuses a different one', () => {
    const fixture = migratedFixture()
    try {
      const first = deleteStorageV3Scope({
        db: fixture.target, scopeId: fixture.scopeA, asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 201),
      })
      const before = fixture.target.serialize()
      const replay = deleteStorageV3Scope({
        db: fixture.target, scopeId: fixture.scopeA, asOf: DELETE_AT, operationId: first.operationId,
      })
      expect(replay.status).toBe('replayed')
      expect(replay.operationId).toBe(first.operationId)
      expect(replay.tombstonesWritten).toBe(0)
      expect(fixture.target.serialize()).toEqual(before)
      // No operation named at all also replays (the store knows its identity).
      expect(deleteStorageV3Scope({
        db: fixture.target, scopeId: fixture.scopeA, asOf: DELETE_AT,
      }).status).toBe('replayed')
      expectCode(() => deleteStorageV3Scope({
        db: fixture.target, scopeId: fixture.scopeA, asOf: DELETE_AT,
        operationId: `del-${'f'.repeat(64)}`,
      }), 'OPERATION_CONFLICT')
      // A replay in a materially different week is a different request: conflict.
      expectCode(() => deleteStorageV3Scope({
        db: fixture.target, scopeId: fixture.scopeA, asOf: '2026-05-01T00:00:00.000Z',
        operationId: first.operationId,
      }), 'OPERATION_CONFLICT')
      expect(fixture.target.serialize()).toEqual(before)
    } finally { fixture.cleanup() }
  })

  it('refuses a fresh deletion that reuses a seen operation identity', () => {
    const fixture = migratedFixture()
    try {
      const legacyOperation = fixture.target.prepare(
        "SELECT operation_id FROM lineage_event WHERE event_kind = 'legacy_deletion_operation'",
      ).pluck().get() as string
      expectCode(() => deleteStorageV3Scope({
        db: fixture.target, scopeId: fixture.scopeA, asOf: DELETE_AT, operationId: legacyOperation,
      }), 'OPERATION_CONFLICT')
    } finally { fixture.cleanup() }
  })

  it('refuses a scope that never existed', () => {
    const fixture = migratedFixture()
    try {
      expectCode(() => deleteStorageV3Scope({
        db: fixture.target, scopeId: `scope-${'9'.repeat(64)}`, asOf: DELETE_AT,
      }), 'UNKNOWN_SCOPE')
    } finally { fixture.cleanup() }
  })

  it('refuses to pile a second deletion identity onto an already-tombstoned live subject (#128)', () => {
    const fixture = migratedFixture()
    try {
      const claimId = fixture.target.prepare(
        'SELECT claim_id FROM claim WHERE scope_id = ?',
      ).pluck().get(fixture.scopeA) as string
      fixture.target.prepare(
        `INSERT INTO lineage_event (scope_id, subject_kind, subject_id, operation_id, capability_id, caused_by, event_kind, event_week)
         VALUES (?, 'claim', ?, ?, 'github.core', NULL, 'tombstone_cascade', '2026-W09')`,
      ).run(fixture.scopeA, claimId, `del-${'d'.repeat(64)}`)
      expectCode(() => deleteStorageV3Scope({
        db: fixture.target, scopeId: fixture.scopeA, asOf: DELETE_AT,
      }), 'OPERATION_CONFLICT')
    } finally { fixture.cleanup() }
  })

  it.each(STORAGE_V3_DELETION_STAGES)('rolls back completely from an injected %s failure', (stage) => {
    const fixture = migratedFixture()
    try {
      const before = fixture.target.serialize()
      expectCode(() => deleteStorageV3Scope({
        db: fixture.target, scopeId: fixture.scopeA, asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 202),
        failAfterStage: (actual: StorageV3DeletionStage) => {
          if (actual === stage) throw new Error('opaque-injected')
        },
      }), 'DELETION_FAILED')
      expect(fixture.target.serialize()).toEqual(before)
    } finally { fixture.cleanup() }
  })

  it('restores the CAS no-delete guards after deletion, with the schema fingerprint unchanged', () => {
    const fixture = migratedFixture()
    try {
      deleteStorageV3Scope({
        db: fixture.target, scopeId: fixture.scopeA, asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 203),
      })
      expect(() => fixture.target.prepare(
        'DELETE FROM continuity_cas_operation WHERE scope_id = ?',
      ).run(fixture.scopeB)).toThrow(/STORAGE_V3_CONTINUITY_CAS_INVALID/)
      expect(() => fixture.target.prepare(
        'DELETE FROM continuity_cas_state WHERE scope_id = ?',
      ).run(fixture.scopeB)).toThrow(/STORAGE_V3_CONTINUITY_CAS_INVALID/)
    } finally { fixture.cleanup() }
  })

  it('refuses a store carrying an unregistered table', () => {
    const fixture = migratedFixture()
    try {
      fixture.target.exec('CREATE TABLE surprise (value TEXT) STRICT')
      expectCode(() => deleteStorageV3Scope({
        db: fixture.target, scopeId: fixture.scopeA, asOf: DELETE_AT,
      }), 'STORE_REFUSED')
    } finally { fixture.cleanup() }
  })

  it('completes WAL/rebuild maintenance idempotently on a file store with no resurrection', () => {
    const root = mkdtempSync(join(tmpdir(), 'developer-lens-b3-'))
    const path = join(root, 'selected.sqlite')
    const memory = migratedFixture()
    try {
      writeFileSync(path, memory.target.serialize())
      const db = new Database(path)
      try {
        db.pragma('journal_mode = WAL')
        const result = deleteStorageV3Scope({
          db, scopeId: memory.scopeA, asOf: DELETE_AT,
          randomBytes: () => Buffer.alloc(32, 204),
        })
        expect(result.status).toBe('deleted')
        expect(result.maintenance).toBe('pending')
        expect(completeStorageV3DeletionMaintenance(db).maintenance).toBe('complete')
        // Idempotent: a crash between commit and maintenance just reruns it.
        expect(completeStorageV3DeletionMaintenance(db).maintenance).toBe('complete')
        const walPath = `${path}-wal`
        if (existsSync(walPath)) expect(statSync(walPath).size).toBe(0)
      } finally { db.close() }
      const reopened = new Database(path)
      try {
        expect(Number(reopened.prepare(
          'SELECT COUNT(*) FROM claim_scope WHERE scope_id = ?',
        ).pluck().get(memory.scopeA))).toBe(0)
        expect(Number(reopened.prepare(
          'SELECT COUNT(*) FROM claim_scope WHERE scope_id = ?',
        ).pluck().get(memory.scopeB))).toBe(1)
        expect(Number(reopened.prepare(
          "SELECT COUNT(*) FROM lineage_event WHERE event_kind = 'tombstone_cascade'",
        ).pluck().get())).toBe(7)
      } finally { reopened.close() }
    } finally {
      memory.cleanup()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
