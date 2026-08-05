import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { reconcileGithubCoreReceipts } from '../connectors/github/core.js'
import {
  ClaimStorageError,
  claimScopeTestSeams,
  clearClaimScopeAlias,
  installClaimGraphStorage,
  registerClaim,
  registerEvidenceAnchor,
  registerLineageEvent,
} from './claims.js'
import { openStorageDatabase } from './database.js'
import {
  DeletionPlannerError,
  REGISTERED_GITHUB_CORE_DELETION_TABLES,
  deletionPlannerTestSeams,
  executeRegisteredGithubCoreDeletion,
  planRegisteredGithubCoreDeletion,
} from './deletionPlanner.js'
import {
  installIncrementalGithubCoreStorage,
  persistIncrementalGithubCoreTransition,
} from './incremental.js'

const databases: Database.Database[] = []
const OCCURRED_AT = '2026-04-06T12:00:00.000Z'
const TOMBSTONE_ID = `scope_tombstone_${'d4'.repeat(32)}`
const ALPHA_SCOPE = `scope-${'a1'.repeat(32)}`
const BETA_SCOPE = `scope-${'b2'.repeat(32)}`

afterEach(() => {
  for (const db of databases.splice(0)) {
    if (db.open) db.close()
  }
})

function errorCode(operation: () => unknown): string {
  try {
    operation()
  } catch (error) {
    if (error instanceof DeletionPlannerError || error instanceof ClaimStorageError) return error.code
    return `UNEXPECTED:${String(error)}`
  }
  return 'NO_ERROR'
}

function count(db: Database.Database, tableName: string, where = '', ...args: string[]): number {
  return Number(db.prepare(`SELECT COUNT(*) FROM "${tableName}"${where}`).pluck().get(...args))
}

function persistComplete(db: Database.Database, scopeAlias: string, jobId: string, hash: string): void {
  persistIncrementalGithubCoreTransition(db, {
    jobId,
    scopeAlias,
    consentRevision: `consent-${scopeAlias}`,
    sourceSnapshotId: `snapshot-${jobId}`,
    startedAt: '2026-04-06T00:00:01.000Z',
    completedAt: '2026-04-06T00:00:02.000Z',
    transition: reconcileGithubCoreReceipts({
      checkpoint: null,
      // #86: caller-owned content-free coverage key; the connector no longer mints one.
      coverageId: `cov-${'a'.repeat(64)}`,
      scopeAlias,
      rangeStart: '2026-01-05T00:00:00.000Z',
      rangeEnd: '2026-01-06T00:00:00.000Z',
      observedAt: '2026-01-06T00:00:00.000Z',
      jobId,
      consentRevision: `consent-${scopeAlias}`,
      pageCap: 2,
      snapshotHash: hash,
      receipts: [{ receiptId: `receipt-${jobId}`, pageNumber: 1, unitIds: [], nextCursor: null }],
    }),
  })
}

function deepFixture(): Database.Database {
  const db = openStorageDatabase(':memory:')
  databases.push(db)
  installIncrementalGithubCoreStorage(db)
  persistComplete(db, 'scope-a', 'job-a1', 'a'.repeat(64))
  persistComplete(db, 'scope-b', 'job-b1', 'b'.repeat(64))
  installClaimGraphStorage(db)

  const coverage = db.prepare(
    "SELECT coverage_id, range_start, job_id FROM coverage_ledger WHERE scope_alias = 'scope-a'",
  ).get() as { coverage_id: string; range_start: string; job_id: string }
  claimScopeTestSeams.registerWithEntropy(
    db,
    { scopeAlias: 'scope-a', linkedAt: '2026-01-05T00:00:00.000Z' },
    () => Buffer.from('a1'.repeat(32), 'hex'),
  )
  registerEvidenceAnchor(db, {
    evidenceId: 'secret-evidence',
    layer: 'deterministic',
    coverage: {
      coverageId: coverage.coverage_id,
      rangeStart: coverage.range_start,
      jobId: coverage.job_id,
    },
  })
  const claim = registerClaim(db, {
    layer: 'hypothesis',
    statementCode: 'CI_RERUN_PATTERN',
    methodId: 'fixture.cascade',
    methodVersion: '1.0.0',
    windowStart: '2026-01-05T00:00:00.000Z',
    windowEnd: '2026-01-06T00:00:00.000Z',
    scopeId: ALPHA_SCOPE,
    createdAt: OCCURRED_AT,
    edges: [
      { role: 'supports', targetEvidenceId: 'secret-evidence' },
      {
        role: 'coverage_basis',
        targetCoverage: {
          coverageId: coverage.coverage_id,
          rangeStart: coverage.range_start,
          jobId: coverage.job_id,
        },
      },
    ],
    limitations: [{ limitationCode: 'RERUN_NOT_FLAKE', dimension: 'completeness', copyKey: 'fixture.limit' }],
  })
  registerLineageEvent(db, {
    subjectId: claim.claimId,
    eventKind: 'correction',
    causedBy: null,
    occurredAt: OCCURRED_AT,
  })
  registerLineageEvent(db, {
    subjectId: 'secret-evidence',
    eventKind: 'correction',
    causedBy: null,
    occurredAt: OCCURRED_AT,
  })
  registerLineageEvent(db, {
    subjectId: 'job-a1',
    eventKind: 'correction',
    causedBy: null,
    occurredAt: OCCURRED_AT,
  })
  registerLineageEvent(db, {
    subjectId: 'snapshot-job-a1',
    eventKind: 'correction',
    causedBy: null,
    occurredAt: OCCURRED_AT,
  })
  registerLineageEvent(db, {
    subjectId: 'scope-a',
    eventKind: 'correction',
    causedBy: null,
    occurredAt: OCCURRED_AT,
  })
  registerLineageEvent(db, {
    subjectId: 'opaque-alias-cause',
    eventKind: 'correction',
    causedBy: 'scope-a',
    occurredAt: OCCURRED_AT,
  })
  registerLineageEvent(db, {
    subjectId: 'opaque-evidence-cause',
    eventKind: 'correction',
    causedBy: 'secret-evidence',
    occurredAt: OCCURRED_AT,
  })
  return db
}

function registeredRowCounts(db: Database.Database): Record<string, number> {
  return Object.fromEntries(
    REGISTERED_GITHUB_CORE_DELETION_TABLES.map(({ tableName }) => [tableName, count(db, tableName)]),
  )
}

function plantCrossScopeClaim(
  db: Database.Database,
  options: { readonly evidenceTarget?: string; readonly supersededByAlpha?: boolean },
): string {
  claimScopeTestSeams.registerWithEntropy(
    db,
    { scopeAlias: 'scope-b', linkedAt: '2026-01-05T00:00:00.000Z' },
    () => Buffer.from('b2'.repeat(32), 'hex'),
  )
  const alphaClaimId = String(db.prepare(
    'SELECT claim_id FROM claim WHERE scope_id = ?',
  ).pluck().get(ALPHA_SCOPE))
  const claimId = `cl_${'b2'.repeat(32)}`
  db.prepare(`
    INSERT INTO claim (
      claim_id, layer, statement_code, method_id, method_version,
      window_start, window_end, scope_id, schema_version,
      claim_id_material_version, created_at, superseded_by
    )
    SELECT ?, layer, statement_code, method_id, method_version,
           window_start, window_end, ?, schema_version,
           claim_id_material_version, created_at, ?
    FROM claim WHERE claim_id = ?
  `).run(
    claimId,
    BETA_SCOPE,
    options.supersededByAlpha ? alphaClaimId : null,
    alphaClaimId,
  )
  if (options.evidenceTarget) {
    db.prepare(`
      INSERT INTO claim_evidence_edge (
        claim_id, role, target_evidence_id, target_claim_id,
        target_coverage_id, target_coverage_range_start, target_coverage_job_id
      ) VALUES (?, 'supports', ?, NULL, NULL, NULL, NULL)
    `).run(claimId, options.evidenceTarget)
  }
  return claimId
}

function request() {
  return {
    capabilityId: 'github.core' as const,
    scopeAlias: 'scope-a',
    tombstoneSubjectId: TOMBSTONE_ID,
    occurredAt: OCCURRED_AT,
  }
}

describe('DL-LIFE-02 registered deletion planner', () => {
  it('plans a closed, explicitly incomplete registered domain in children-before-parents order', () => {
    const db = deepFixture()
    const plan = planRegisteredGithubCoreDeletion(db, request())

    expect(plan.completeProduct).toBe(false)
    expect(plan.excludedDomains).toEqual([
      'v2_store', 'legacy_schema', 'filesystem_packs', 'backups', 'caches', 'indexes',
    ])
    const order = plan.deletionOrder.map(({ tableName }) => tableName)
    expect(order.indexOf('claim_evidence_edge')).toBeLessThan(order.indexOf('claim'))
    expect(order.indexOf('claim_evidence_edge')).toBeLessThan(order.indexOf('evidence'))
    expect(order.indexOf('evidence')).toBeLessThan(order.indexOf('coverage_ledger'))
    expect(order.indexOf('coverage_ledger')).toBeLessThan(order.indexOf('collection_job'))
    expect(order).toContain('lineage_event')
  })

  it('rejects C2 and generic opaque tokens as tombstone subjects', () => {
    const db = deepFixture()
    for (const tombstoneSubjectId of ['scope-a', 'opaque-revocation-token']) {
      expect(errorCode(() => planRegisteredGithubCoreDeletion(db, {
        ...request(),
        tombstoneSubjectId,
      }))).toBe('DELETION_REQUEST_INVALID')
    }
  })

  it('fails a direct NO ACTION coverage delete, then removes the deep chain transactionally', () => {
    const db = deepFixture()
    expect(() => db.prepare("DELETE FROM coverage_ledger WHERE scope_alias = 'scope-a'").run()).toThrow(/FOREIGN KEY/)
    expect(count(db, 'coverage_ledger', ' WHERE scope_alias = ?', 'scope-a')).toBe(1)

    const result = executeRegisteredGithubCoreDeletion(db, planRegisteredGithubCoreDeletion(db, request()))
    expect(result.tombstoneWritten).toBe(true)
    for (const table of ['collection_job', 'collection_checkpoint', 'source_snapshot', 'coverage_ledger']) {
      expect(count(db, table, ' WHERE scope_alias = ?', 'scope-a')).toBe(0)
      expect(count(db, table, ' WHERE scope_alias = ?', 'scope-b')).toBe(1)
    }
    expect(count(db, 'evidence')).toBe(0)
    expect(count(db, 'claim_evidence_edge')).toBe(0)
    expect(count(db, 'limitation_instance')).toBe(0)
    expect(count(db, 'claim')).toBe(0)
    expect(count(db, 'claim_scope')).toBe(0)
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })

  it('rolls back every deletion and tombstone on an injected failure', () => {
    const db = deepFixture()
    const before = Object.fromEntries([
      'collection_job', 'collection_checkpoint', 'source_snapshot', 'coverage_ledger',
      'evidence', 'claim_scope', 'claim', 'claim_evidence_edge', 'limitation_instance', 'lineage_event',
    ].map((tableName) => [tableName, count(db, tableName)]))
    const plan = planRegisteredGithubCoreDeletion(db, request())

    expect(errorCode(() => deletionPlannerTestSeams.executeWithFailureAfterTable(db, plan, 'claim')))
      .toBe('DELETION_TRANSACTION_FAILED')
    for (const [tableName, rows] of Object.entries(before)) {
      expect(count(db, tableName)).toBe(rows)
    }
    expect(count(db, 'lineage_event', " WHERE event_kind = 'tombstone_cascade'")).toBe(0)
  })

  it('refuses reused tombstone IDs atomically when another scope still has rows', () => {
    const db = deepFixture()
    const staleScopeBPlan = planRegisteredGithubCoreDeletion(db, {
      ...request(),
      scopeAlias: 'scope-b',
    })
    executeRegisteredGithubCoreDeletion(db, planRegisteredGithubCoreDeletion(db, request()))
    const before = registeredRowCounts(db)

    expect(errorCode(() => executeRegisteredGithubCoreDeletion(db, staleScopeBPlan)))
      .toBe('DELETION_TOMBSTONE_CONFLICT')
    expect(registeredRowCounts(db)).toEqual(before)
    expect(count(db, 'collection_job', ' WHERE scope_alias = ?', 'scope-b')).toBe(1)
    expect(count(db, 'lineage_event', " WHERE event_kind = 'tombstone_cascade'")).toBe(1)
  })

  it('refuses atomically when the C1 claim binding has lost its original alias', () => {
    const db = deepFixture()
    const stalePlan = planRegisteredGithubCoreDeletion(db, request())
    expect(clearClaimScopeAlias(db, ALPHA_SCOPE)).toBe(1)
    const before = registeredRowCounts(db)

    expect(errorCode(() => executeRegisteredGithubCoreDeletion(db, stalePlan)))
      .toBe('DELETION_SCOPE_BINDING_INCOMPLETE')
    expect(registeredRowCounts(db)).toEqual(before)
    expect(count(db, 'collection_job', ' WHERE scope_alias = ?', 'scope-a')).toBe(1)
    expect(count(db, 'claim')).toBe(1)
    expect(count(db, 'lineage_event', " WHERE event_kind = 'tombstone_cascade'")).toBe(0)
  })

  it('refuses an unbound claim scope with no claim and preserves its lineage atomically', () => {
    const db = deepFixture()
    const stalePlan = planRegisteredGithubCoreDeletion(db, request())
    db.prepare('DELETE FROM limitation_instance').run()
    db.prepare('DELETE FROM claim_evidence_edge').run()
    db.prepare('DELETE FROM claim').run()
    expect(clearClaimScopeAlias(db, ALPHA_SCOPE)).toBe(1)
    registerLineageEvent(db, {
      subjectId: ALPHA_SCOPE,
      eventKind: 'correction',
      causedBy: null,
      occurredAt: OCCURRED_AT,
    })
    const before = registeredRowCounts(db)
    const lineageBefore = db.prepare(
      'SELECT rowid, subject_id, event_kind, caused_by, occurred_at FROM lineage_event ORDER BY rowid',
    ).all()

    expect(errorCode(() => planRegisteredGithubCoreDeletion(db, request())))
      .toBe('DELETION_SCOPE_BINDING_INCOMPLETE')
    expect(errorCode(() => executeRegisteredGithubCoreDeletion(db, stalePlan)))
      .toBe('DELETION_SCOPE_BINDING_INCOMPLETE')
    expect(registeredRowCounts(db)).toEqual(before)
    expect(db.prepare(
      'SELECT rowid, subject_id, event_kind, caused_by, occurred_at FROM lineage_event ORDER BY rowid',
    ).all()).toEqual(lineageBefore)
    expect(count(db, 'claim')).toBe(0)
    expect(count(db, 'claim_scope', ' WHERE scope_alias IS NULL')).toBe(1)
    expect(count(db, 'lineage_event', " WHERE event_kind = 'tombstone_cascade'")).toBe(0)
  })

  it('refuses a cross-scope claim that cites evidence selected for deletion', () => {
    const db = deepFixture()
    plantCrossScopeClaim(db, { evidenceTarget: 'secret-evidence' })
    const before = registeredRowCounts(db)

    expect(errorCode(() => planRegisteredGithubCoreDeletion(db, request())))
      .toBe('DELETION_CROSS_SCOPE_DEPENDENCY')
    expect(registeredRowCounts(db)).toEqual(before)
    expect(count(db, 'lineage_event', " WHERE event_kind = 'tombstone_cascade'")).toBe(0)
  })

  it('refuses an incoming cross-scope supersession before the NO ACTION delete', () => {
    const db = deepFixture()
    plantCrossScopeClaim(db, { supersededByAlpha: true })
    const before = registeredRowCounts(db)

    expect(errorCode(() => planRegisteredGithubCoreDeletion(db, request())))
      .toBe('DELETION_CROSS_SCOPE_DEPENDENCY')
    expect(registeredRowCounts(db)).toEqual(before)
    expect(count(db, 'lineage_event', " WHERE event_kind = 'tombstone_cascade'")).toBe(0)
  })

  it('is idempotent and leaves only the content-free registered tombstone for the revoked fixture', () => {
    const db = deepFixture()
    const first = executeRegisteredGithubCoreDeletion(db, planRegisteredGithubCoreDeletion(db, request()))
    const replay = executeRegisteredGithubCoreDeletion(db, planRegisteredGithubCoreDeletion(db, request()))

    expect(first.alreadyTombstoned).toBe(false)
    expect(replay).toMatchObject({ tombstoneWritten: false, alreadyTombstoned: true })
    expect(replay.deletedTables).toEqual([])
    const lineage = db.prepare(
      'SELECT subject_id, event_kind, caused_by, occurred_at FROM lineage_event',
    ).all()
    expect(lineage).toEqual([{
      subject_id: TOMBSTONE_ID,
      event_kind: 'tombstone_cascade',
      caused_by: 'cap_github_core',
      occurred_at: OCCURRED_AT,
    }])
    const persisted = JSON.stringify(lineage)
    expect(persisted).not.toContain('scope-a')
    expect(persisted).not.toContain('fixture.cascade')
    expect(persisted).not.toContain('coverage_id')
    expect(persisted).not.toContain('secret-evidence')
    expect(persisted).not.toContain('job-a1')
    expect(persisted).not.toContain('snapshot-job-a1')
  })

  it('fails closed on a planted managed table without registry lineage', () => {
    const db = deepFixture()
    db.exec('CREATE TABLE managed_canary (capability_id TEXT NOT NULL, scope_alias TEXT NOT NULL) STRICT;')
    expect(errorCode(() => planRegisteredGithubCoreDeletion(db, request())))
      .toBe('DELETION_REGISTRY_UNREGISTERED_MANAGED_TABLE')
  })

  it('fails closed on installed-schema drift', () => {
    const db = deepFixture()
    db.exec('DROP TRIGGER collection_job_immutable_update;')
    expect(errorCode(() => planRegisteredGithubCoreDeletion(db, request())))
      .toBe('DELETION_REGISTRY_SCHEMA_DRIFT')
  })

  it('rejects duplicate, missing-lineage, unknown-dependency, and cyclic registry metadata', () => {
    const root = {
      tableName: 'table_a',
      capabilityId: 'github.core',
      deletionRole: 'scope-root',
      dependsOn: [],
      selfReferentialForeignKeys: false,
    } as const
    expect(errorCode(() => deletionPlannerTestSeams.validateRegistryMetadata([root, root])))
      .toBe('DELETION_REGISTRY_DUPLICATE_TABLE')
    expect(errorCode(() => deletionPlannerTestSeams.validateRegistryMetadata([{
      ...root, tableName: 'table_b', capabilityId: '',
    }])))
      .toBe('DELETION_REGISTRY_MISSING_CAPABILITY_LINEAGE')
    expect(errorCode(() => deletionPlannerTestSeams.validateRegistryMetadata([{
      ...root, dependsOn: ['unknown_parent'],
    }])))
      .toBe('DELETION_REGISTRY_UNKNOWN_DEPENDENCY')
    expect(errorCode(() => deletionPlannerTestSeams.validateRegistryMetadata([
      { ...root, dependsOn: ['table_b'] },
      { ...root, tableName: 'table_b', dependsOn: ['table_a'] },
    ])))
      .toBe('DELETION_REGISTRY_CYCLE')
  })

  it('rejects missing dependency metadata against the installed foreign-key graph', () => {
    const db = deepFixture()
    const missingEvidenceDependency = REGISTERED_GITHUB_CORE_DELETION_TABLES.map((entry) =>
      entry.tableName === 'evidence' ? { ...entry, dependsOn: [] } : entry,
    )
    expect(errorCode(() => deletionPlannerTestSeams.validateRegistryAgainstSchema(db, missingEvidenceDependency)))
      .toBe('DELETION_REGISTRY_SCHEMA_DRIFT')
  })
})
