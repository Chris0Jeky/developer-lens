import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { installV2BridgeStore } from '../api/v2/store.js'
import { installClaimGraphStorage } from './claims.js'
import { openStorageDatabase } from './database.js'
import { installIncrementalGithubCoreStorage } from './incremental.js'
import {
  installStorageV3ShadowSchema,
  STORAGE_V3_ARTIFACT_TABLES,
  STORAGE_V3_ARTIFACT_TRIGGER_NAMES,
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_C2_RETENTION_OWNER_TRIGGER_NAME,
  STORAGE_V3_SHADOW_COVERAGE_IDENTITY_TRIGGER_NAMES,
  STORAGE_V3_SHADOW_OWNER_IDENTITY_TRIGGER_NAMES,
  STORAGE_V3_SHADOW_OWNER_IDENTITY_INDEX_NAMES,
  STORAGE_V3_SHADOW_RESULT,
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  STORAGE_V3_SHADOW_SCHEMA_SQL,
  STORAGE_V3_SHADOW_SCHEMA_VERSION,
  STORAGE_V3_SHADOW_IDENTITY_BINDING_TRIGGER_NAMES,
  STORAGE_V3_SHADOW_IMMUTABLE_INSERT_TRIGGER_NAMES,
  STORAGE_V3_SHADOW_IMMUTABLE_TRIGGERS,
  STORAGE_V3_SHADOW_LINEAGE_OWNER_TRIGGER_NAMES,
  STORAGE_V3_SHADOW_LINEAGE_SCOPE_TRIGGER_NAME,
  STORAGE_V3_SHADOW_TABLES,
  STORAGE_V3_SHADOW_USER_VERSION,
  storageV3ShadowSchemaFingerprint,
  storageV3ShadowResult,
} from './v3ShadowSchema.js'
import { STORAGE_V3_DISPOSITIONS, STORAGE_V3_TABLES } from './v3Proposal.js'

const hex = (letter: string): string => letter.repeat(64)
const scopeA = `scope-${hex('a')}`
const scopeB = `scope-${hex('b')}`
const id = (prefix: string, letter = 'a'): string => `${prefix}${hex(letter)}`

const tables = (db: Database.Database): string[] => db.prepare(
  "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
).pluck().all() as string[]

describe('storage-v3 B2a shadow schema', () => {
  it('installs the closed immutable-trigger registry in the schema fingerprint', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      const triggers = db.prepare(
        "SELECT name, tbl_name, sql FROM sqlite_schema WHERE type = 'trigger' ORDER BY name",
      ).all() as Array<{ name: string; tbl_name: string; sql: string }>
      const immutableTriggerNames = STORAGE_V3_SHADOW_IMMUTABLE_TRIGGERS
        .map(({ tableName }) => `storage_v3_immutable_${tableName}`)
      const casTriggerNames = [
        'continuity_cas_operation_matches_state',
        'continuity_cas_operation_no_delete',
        'continuity_cas_operation_no_update',
        'continuity_cas_state_no_delete',
        'continuity_cas_state_revision_step',
        'continuity_cas_state_scope_immutable',
      ]
      expect(triggers.map(({ name }) => name)).toEqual(
        [
          ...immutableTriggerNames,
          ...STORAGE_V3_SHADOW_IMMUTABLE_INSERT_TRIGGER_NAMES,
          ...STORAGE_V3_SHADOW_IDENTITY_BINDING_TRIGGER_NAMES,
          ...STORAGE_V3_SHADOW_COVERAGE_IDENTITY_TRIGGER_NAMES,
          ...STORAGE_V3_SHADOW_OWNER_IDENTITY_TRIGGER_NAMES,
          ...STORAGE_V3_SHADOW_LINEAGE_OWNER_TRIGGER_NAMES,
          ...casTriggerNames,
          ...STORAGE_V3_ARTIFACT_TRIGGER_NAMES,
          STORAGE_V3_SHADOW_C2_RETENTION_OWNER_TRIGGER_NAME,
          STORAGE_V3_SHADOW_LINEAGE_SCOPE_TRIGGER_NAME,
        ].sort(),
      )
      expect(triggers
        .filter(({ name }) => casTriggerNames.includes(name))
        .every(({ sql }) => sql.includes('STORAGE_V3_CONTINUITY_CAS_INVALID'))).toBe(true)
      expect(triggers
        .filter(({ name }) => immutableTriggerNames.includes(name))
        .every(({ sql }) => sql.includes('OLD.') && sql.includes(' IS NOT NEW.') && sql.includes("STORAGE_V3_SHADOW_IMMUTABLE_KEY"))).toBe(true)
      expect(triggers
        .filter(({ name }) => STORAGE_V3_SHADOW_IMMUTABLE_INSERT_TRIGGER_NAMES.includes(name))
        .every(({ sql }) => sql.includes('BEFORE INSERT') && sql.includes("STORAGE_V3_SHADOW_IMMUTABLE_KEY"))).toBe(true)
      expect(triggers
        .filter(({ name }) => (STORAGE_V3_SHADOW_IDENTITY_BINDING_TRIGGER_NAMES as readonly string[]).includes(name))
        .every(({ sql }) => sql.includes('BEFORE INSERT') && sql.includes("STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY"))).toBe(true)
      expect(triggers.find(({ name }) => name === STORAGE_V3_SHADOW_LINEAGE_SCOPE_TRIGGER_NAME)?.sql)
        .toContain('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')
      expect(triggers
        .filter(({ name }) => STORAGE_V3_SHADOW_LINEAGE_OWNER_TRIGGER_NAMES.includes(name))
        .every(({ sql }) => sql.includes('BEFORE INSERT') && sql.includes('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE'))).toBe(true)
      expect(storageV3ShadowSchemaFingerprint(db)).toBe(STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT)
    } finally {
      db.close()
    }
  })

  it('fails closed without repairing a missing required trigger', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      const missingTrigger = `storage_v3_immutable_${STORAGE_V3_SHADOW_IMMUTABLE_TRIGGERS[0].tableName}`
      db.exec(`DROP TRIGGER ${missingTrigger}`)
      const before = db.prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
      ).all()
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
      expect(db.prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
      ).all()).toEqual(before)
      expect(db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'trigger' AND name = ?").get(missingTrigger)).toBeUndefined()
    } finally {
      db.close()
    }
  })

  it('fails closed for an extra main or TEMP trigger targeting an owned table', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.exec(`CREATE TRIGGER injected_extra AFTER INSERT ON claim
        BEGIN SELECT RAISE(ABORT, 'injected'); END;`)
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
      db.exec('DROP TRIGGER injected_extra')
      db.exec(`CREATE TEMP TRIGGER arbitrary_temp AFTER INSERT ON claim
        BEGIN SELECT 1; END;`)
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
    } finally {
      db.close()
    }
  })

  it('fails closed for case-variant TEMP objects targeting an owned table', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.exec(`CREATE TEMP TRIGGER injected_case AFTER INSERT ON CLAIM
        BEGIN SELECT RAISE(ABORT, 'injected'); END;`)
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
    } finally {
      db.close()
    }
  })

  it('rejects hostile identity updates across every immutable trigger family', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeB)
      db.prepare('INSERT INTO repository_identity (scope_id, is_private, is_archived, is_fork) VALUES (?, 0, 0, 0)').run(scopeA)
      db.prepare('INSERT INTO commit_observation (scope_id, observation_id, feature_type, is_revert, is_fixup, message_length) VALUES (?, ?, ?, 0, 0, 0)').run(scopeA, id('obs-'), 'other')
      db.prepare('INSERT INTO pull_request_fact (scope_id, fact_id, state, is_draft, comments, reviews) VALUES (?, ?, ?, 0, 0, 0)').run(scopeA, id('pr-'), 'OPEN')
      db.prepare('INSERT INTO coverage_observation (scope_id, coverage_id, capability_id, status, limitation_code, observed_units) VALUES (?, ?, ?, ?, ?, 0)').run(scopeA, id('cov-'), 'github.core', 'complete', 'NONE')
      db.prepare('INSERT INTO dated_event_observation (scope_id, event_id, event_kind) VALUES (?, ?, ?)').run(scopeA, id('event-'), 'issue')
      const jobId = id('job-')
      const snapshotId = id('snap-')
      const coverageId = id('cov-', 'b')
      const evidenceId = id('ev-')
      const claimId = id('cl_')
      const checkpointId = id('ckpt-')
      db.prepare('INSERT INTO collection_job (scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version, consent_revision, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(scopeA, jobId, 'github.core', '2.2.0', 'query', 'api', 'consent', 'complete')
      db.prepare('INSERT INTO source_snapshot (scope_id, snapshot_id, job_id, capability_id, status) VALUES (?, ?, ?, ?, ?)').run(scopeA, snapshotId, jobId, 'github.core', 'closed')
      db.prepare('INSERT INTO collection_checkpoint (scope_id, checkpoint_id, job_id, snapshot_id, capability_id, query_version, source_api_version, consent_revision, coverage_state, deletion_order, lineage_coverage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)').run(scopeA, checkpointId, jobId, snapshotId, 'github.core', 'query', 'api', 'consent', 'complete', 'complete')
      db.prepare('INSERT INTO coverage_ledger (scope_id, coverage_id, job_id, snapshot_id, capability_id, status, observed_units, retryable, limitation_code) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)').run(scopeA, coverageId, jobId, snapshotId, 'github.core', 'complete', 'NONE')
      db.prepare('INSERT INTO evidence (scope_id, evidence_id, coverage_id, layer, schema_version) VALUES (?, ?, ?, ?, ?)').run(scopeA, evidenceId, coverageId, 'observed', '2.0.0')
      db.prepare('INSERT INTO claim (scope_id, claim_id, layer, statement_code, method_id, method_version, window_start, window_end, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(scopeA, claimId, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '1.0.0', 'claim-id.v3', '2026-02-01T00:00:00.000Z')
      db.prepare('INSERT INTO claim_evidence_edge (scope_id, claim_id, role, target_evidence_id) VALUES (?, ?, ?, ?)').run(scopeA, claimId, 'supports', evidenceId)
      db.prepare('INSERT INTO limitation_instance (scope_id, claim_id, limitation_code, dimension, copy_key) VALUES (?, ?, ?, ?, ?)').run(scopeA, claimId, 'COVERAGE_RESTRICTED', 'completeness', 'copy')
      db.prepare('INSERT INTO lineage_event (scope_id, subject_kind, subject_id, operation_id, capability_id, event_kind, event_week) VALUES (?, ?, ?, ?, ?, ?, ?)').run(scopeA, 'claim', claimId, id('op-'), 'github.core', 'correction', '2026-W32')

      const before = new Map<string, unknown[]>()
      for (const { tableName } of STORAGE_V3_SHADOW_IMMUTABLE_TRIGGERS) {
        before.set(tableName, db.prepare(`SELECT * FROM ${tableName}`).all())
      }
      const updates: Record<string, string> = {
        claim_scope: `UPDATE claim_scope SET scope_id = '${scopeB}' WHERE scope_id = '${scopeA}'`,
        repository_identity: `UPDATE repository_identity SET scope_id = '${scopeB}' WHERE scope_id = '${scopeA}'`,
        commit_observation: `UPDATE commit_observation SET observation_id = '${id('obs-', 'b')}' WHERE scope_id = '${scopeA}'`,
        pull_request_fact: `UPDATE pull_request_fact SET fact_id = '${id('pr-', 'b')}' WHERE scope_id = '${scopeA}'`,
        coverage_observation: `UPDATE coverage_observation SET coverage_id = '${id('cov-', 'c')}' WHERE scope_id = '${scopeA}'`,
        dated_event_observation: `UPDATE dated_event_observation SET event_id = '${id('event-', 'b')}' WHERE scope_id = '${scopeA}'`,
        collection_job: `UPDATE collection_job SET job_id = '${id('job-', 'b')}' WHERE scope_id = '${scopeA}'`,
        collection_checkpoint: `UPDATE collection_checkpoint SET checkpoint_id = '${id('ckpt-', 'b')}' WHERE scope_id = '${scopeA}'`,
        source_snapshot: `UPDATE source_snapshot SET snapshot_id = '${id('snap-', 'b')}' WHERE scope_id = '${scopeA}'`,
        coverage_ledger: `UPDATE coverage_ledger SET coverage_id = '${id('cov-', 'd')}' WHERE scope_id = '${scopeA}'`,
        evidence: `UPDATE evidence SET evidence_id = '${id('ev-', 'b')}' WHERE scope_id = '${scopeA}'`,
        claim: `UPDATE claim SET claim_id = '${id('cl_', 'b')}' WHERE scope_id = '${scopeA}'`,
        claim_evidence_edge: `UPDATE claim_evidence_edge SET role = 'derives_from', target_claim_id = '${id('cl_', 'b')}', target_evidence_id = NULL WHERE scope_id = '${scopeA}'`,
        limitation_instance: `UPDATE limitation_instance SET copy_key = 'other' WHERE scope_id = '${scopeA}'`,
        lineage_event: `UPDATE lineage_event SET scope_id = '${scopeB}' WHERE subject_id = '${claimId}'`,
      }
      for (const { tableName } of STORAGE_V3_SHADOW_IMMUTABLE_TRIGGERS) {
        expect(() => db.exec(updates[tableName])).toThrow('STORAGE_V3_SHADOW_IMMUTABLE_KEY')
        expect(db.prepare(`SELECT * FROM ${tableName}`).all()).toEqual(before.get(tableName))
      }
    } finally {
      db.close()
    }
  })

  it('rolls back earlier mutable writes when a later immutable-key update aborts the transaction', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeB)
      db.prepare('INSERT INTO repository_identity (scope_id, is_private, is_archived, is_fork) VALUES (?, 0, 0, 0)').run(scopeA)
      const hostileTransaction = db.transaction(() => {
        db.prepare('UPDATE repository_identity SET is_archived = 1 WHERE scope_id = ?').run(scopeA)
        db.prepare('UPDATE repository_identity SET scope_id = ? WHERE scope_id = ?').run(scopeB, scopeA)
      })
      expect(hostileTransaction).toThrow('STORAGE_V3_SHADOW_IMMUTABLE_KEY')
      expect(db.prepare('SELECT scope_id, is_archived FROM repository_identity').get()).toEqual({
        scope_id: scopeA,
        is_archived: 0,
      })
    } finally {
      db.close()
    }
  })

  it('rejects INSERT OR REPLACE identity rebinding and immutable parent changes', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      const insertScope = db.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at, alias_expires_at) VALUES (?, ?, ?, ?)')
      insertScope.run(scopeA, 'provider-a', '2026-01-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z')
      insertScope.run(scopeB, 'provider-b', '2026-01-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z')
      expect(() => db.prepare('INSERT OR REPLACE INTO claim_scope (scope_id, scope_alias, linked_at, alias_expires_at) VALUES (?, ?, ?, ?)')
        .run(scopeB, 'provider-a', '2026-01-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY')

      db.prepare('INSERT INTO repository_identity (scope_id, provider_id, analytical_key, identity_expires_at, is_private, is_archived, is_fork) VALUES (?, ?, ?, ?, 0, 0, 0)')
        .run(scopeA, 'provider-id-a', 'analytical-a', '2027-02-01T00:00:00.000Z')
      expect(() => db.prepare('INSERT OR REPLACE INTO repository_identity (scope_id, provider_id, analytical_key, identity_expires_at, is_private, is_archived, is_fork) VALUES (?, ?, ?, ?, 0, 0, 0)')
        .run(scopeB, 'provider-id-a', 'analytical-a', '2027-02-01T00:00:00.000Z'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY')

      const insertJob = db.prepare('INSERT INTO collection_job (scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version, consent_revision, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      const jobA = id('job-')
      const jobB = id('job-', 'b')
      const snapshotId = id('snap-')
      insertJob.run(scopeA, jobA, 'github.core', '2.2.0', 'query-a', 'api', 'consent', 'complete')
      insertJob.run(scopeA, jobB, 'github.core', '2.2.0', 'query-b', 'api', 'consent', 'complete')
      db.prepare('INSERT INTO source_snapshot (scope_id, snapshot_id, job_id, capability_id, status) VALUES (?, ?, ?, ?, ?)')
        .run(scopeA, snapshotId, jobA, 'github.core', 'closed')
      expect(() => db.prepare('INSERT OR REPLACE INTO source_snapshot (scope_id, snapshot_id, job_id, capability_id, status) VALUES (?, ?, ?, ?, ?)')
        .run(scopeA, snapshotId, jobB, 'github.core', 'closed'))
        .toThrow('STORAGE_V3_SHADOW_IMMUTABLE_KEY')

      expect(db.prepare('SELECT scope_id, scope_alias FROM claim_scope ORDER BY scope_id').all()).toEqual([
        { scope_id: scopeA, scope_alias: 'provider-a' },
        { scope_id: scopeB, scope_alias: 'provider-b' },
      ])
      expect(db.prepare('SELECT scope_id, provider_id, analytical_key FROM repository_identity').get()).toEqual({
        scope_id: scopeA,
        provider_id: 'provider-id-a',
        analytical_key: 'analytical-a',
      })
      expect(db.prepare('SELECT scope_id, snapshot_id, job_id FROM source_snapshot').get()).toEqual({
        scope_id: scopeA,
        snapshot_id: snapshotId,
        job_id: jobA,
      })
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  it('installs the 18 migrated tables, CAS state, B4 catalogue, and all dispositions', () => {
    const db = new Database(':memory:')
    try {
      expect(installStorageV3ShadowSchema(db)).toEqual(STORAGE_V3_SHADOW_RESULT)
      expect(tables(db)).toEqual([...STORAGE_V3_SHADOW_TABLES].sort())
      expect(STORAGE_V3_SHADOW_TABLES).toEqual([
        ...STORAGE_V3_TABLES,
        'continuity_cas_operation',
        'continuity_cas_state',
        ...STORAGE_V3_ARTIFACT_TABLES,
      ])
      expect(new Set(STORAGE_V3_DISPOSITIONS.map(({ tableName }) => tableName)).size).toBe(18)
      expect(STORAGE_V3_DISPOSITIONS.map(({ tableName }) => tableName).sort()).toEqual([...STORAGE_V3_TABLES].sort())
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
      expect(db.prepare("SELECT sql FROM sqlite_schema WHERE name = 'claim'").pluck().get()).toMatch(/STRICT/)
      expect(Number(db.prepare('PRAGMA application_id').pluck().get())).toBe(STORAGE_V3_SHADOW_APPLICATION_ID)
      expect(Number(db.prepare('PRAGMA user_version').pluck().get())).toBe(STORAGE_V3_SHADOW_USER_VERSION)
      expect(STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT).toMatch(/^[0-9a-f]{64}$/)
    } finally {
      db.close()
    }
  })

  it('admits only canonically shaped or cleared claim operational provenance', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      const insertClaim = db.prepare('INSERT INTO claim (scope_id, claim_id, layer, statement_code, method_id, method_version, window_start, window_end, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      const claimValues = (claimId: string, createdAt: string | null): readonly unknown[] => [
        scopeA,
        claimId,
        'modelled',
        'DELIVERY_FLOW',
        'method',
        '1.0.0',
        '2026-01-01T00:00:00.000Z',
        '2026-02-01T00:00:00.000Z',
        '1.0.0',
        'claim-id.v3',
        createdAt,
      ]
      insertClaim.run(...claimValues(id('cl_'), null))
      insertClaim.run(...claimValues(id('cl_', 'b'), '2026-02-01T00:00:00.000Z'))
      expect(() => insertClaim.run(...claimValues(id('cl_', 'c'), '2026-02-01T00:00:00'))).toThrow()
      expect(db.prepare('SELECT claim_id, created_at FROM claim ORDER BY claim_id').all()).toEqual([
        { claim_id: id('cl_'), created_at: null },
        { claim_id: id('cl_', 'b'), created_at: '2026-02-01T00:00:00.000Z' },
      ])
    } finally {
      db.close()
    }
  })

  it('is idempotent in an isolated target', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      const before = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all()
      installStorageV3ShadowSchema(db)
      expect(db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all()).toEqual(before)
    } finally {
      db.close()
    }
  })

  it('rejects an outer transaction that prevents foreign-key enforcement', () => {
    const db = new Database(':memory:')
    try {
      db.pragma('foreign_keys = OFF')
      const nestedInstall = db.transaction(() => installStorageV3ShadowSchema(db))
      expect(nestedInstall).toThrow('STORAGE_V3_SHADOW_FOREIGN_KEY_MISMATCH')
      expect(Number(db.prepare('PRAGMA application_id').pluck().get())).toBe(0)
      expect(Number(db.prepare('PRAGMA user_version').pluck().get())).toBe(0)
      expect(tables(db)).toEqual([])
    } finally {
      db.close()
    }
  })

  it('enforces canonical scope parents and rejects cross-scope claim edges', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      const scopes = db.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at, alias_expires_at) VALUES (?, ?, ?, ?)')
      scopes.run(scopeA, 'provider-a', '2026-01-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z')
      scopes.run(scopeB, 'provider-b', '2026-01-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z')
      expect(() => scopes.run(`scope-${hex('c')}`, 'provider-a', '2026-01-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z')).toThrow()
      const identity = db.prepare(
        'INSERT INTO repository_identity (scope_id, provider_id, analytical_key, identity_expires_at, is_private, is_archived, is_fork) VALUES (?, ?, ?, ?, 0, 0, 0)',
      )
      identity.run(scopeA, 'provider-a', 'analytical-a', '2027-02-01T00:00:00.000Z')
      identity.run(scopeB, 'provider-b', 'analytical-b', '2027-02-01T00:00:00.000Z')
      db.prepare('INSERT INTO collection_job (scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version, consent_revision, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(scopeA, id('job-'), 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete')
      db.prepare('INSERT INTO source_snapshot (scope_id, snapshot_id, job_id, capability_id, status) VALUES (?, ?, ?, ?, ?)').run(scopeA, id('snap-'), id('job-'), 'github.core', 'closed')
      db.prepare('INSERT INTO coverage_ledger (scope_id, coverage_id, job_id, snapshot_id, capability_id, status, observed_units, retryable, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(scopeA, id('cov-'), id('job-'), id('snap-'), 'github.core', 'complete', 2, 0, 'SOURCE_FIXTURE')
      db.prepare('INSERT INTO evidence (scope_id, evidence_id, coverage_id, layer, schema_version) VALUES (?, ?, ?, ?, ?)').run(scopeA, id('ev-'), id('cov-'), 'observed', '2.0.0')
      const insertClaim = db.prepare('INSERT INTO claim (scope_id, claim_id, layer, statement_code, method_id, method_version, window_start, window_end, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      insertClaim.run(scopeA, id('cl_'), 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '1.0.0', 'claim-id.v3', '2026-02-01T00:00:00.000Z')
      insertClaim.run(scopeB, id('cl_', 'b'), 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '1.0.0', 'claim-id.v3', '2026-02-01T00:00:00.000Z')
      expect(() => db.prepare('INSERT INTO claim_evidence_edge (scope_id, claim_id, role, target_evidence_id) VALUES (?, ?, ?, ?)').run(scopeB, id('cl_', 'b'), 'supports', id('ev-'))).toThrow()
      db.prepare('INSERT INTO claim_evidence_edge (scope_id, claim_id, role, target_coverage_id) VALUES (?, ?, ?, ?)').run(scopeA, id('cl_'), 'coverage_basis', id('cov-'))
      expect(() => db.prepare('INSERT INTO claim_evidence_edge (scope_id, claim_id, role, target_coverage_id) VALUES (?, ?, ?, ?)').run(scopeA, id('cl_'), 'supports', id('cov-'))).toThrow()
      expect(() => identity.run('not-a-scope', 'provider-c', 'analytical-c', '2027-02-01T00:00:00.000Z')).toThrow()
      db.prepare('UPDATE repository_identity SET provider_id = NULL, analytical_key = NULL, identity_expires_at = NULL WHERE scope_id = ?').run(scopeA)
      db.prepare('UPDATE claim_scope SET scope_alias = NULL, linked_at = NULL, alias_expires_at = NULL WHERE scope_id = ?').run(scopeA)
      expect(db.prepare('SELECT scope_id FROM claim_scope WHERE scope_id = ?').pluck().get(scopeA)).toBe(scopeA)
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  it('binds coverage and checkpoint snapshot edges to their own job', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      const insertJob = db.prepare('INSERT INTO collection_job (scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version, consent_revision, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      insertJob.run(scopeA, id('job-'), 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete')
      insertJob.run(scopeA, id('job-', 'b'), 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete')
      db.prepare('INSERT INTO source_snapshot (scope_id, snapshot_id, job_id, capability_id, status) VALUES (?, ?, ?, ?, ?)').run(scopeA, id('snap-', 'b'), id('job-', 'b'), 'github.core', 'closed')
      const insertCoverage = db.prepare('INSERT INTO coverage_ledger (scope_id, coverage_id, job_id, snapshot_id, capability_id, status, observed_units, retryable, limitation_code) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)')
      // job-a citing job-b's snapshot: the two single-column edges alone allowed it.
      expect(() => insertCoverage.run(scopeA, id('cov-'), id('job-'), id('snap-', 'b'), 'github.core', 'complete', 'NONE'))
        .toThrow(/FOREIGN KEY constraint failed/i)
      const insertCheckpoint = db.prepare('INSERT INTO collection_checkpoint (scope_id, checkpoint_id, job_id, snapshot_id, capability_id, query_version, source_api_version, consent_revision, coverage_state, deletion_order, lineage_coverage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)')
      expect(() => insertCheckpoint.run(scopeA, id('ckpt-'), id('job-'), id('snap-', 'b'), 'github.core', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete', 'complete'))
        .toThrow(/FOREIGN KEY constraint failed/i)
      // The matching job still binds, and a non-complete coverage row keeps a NULL snapshot.
      insertCoverage.run(scopeA, id('cov-', 'b'), id('job-', 'b'), id('snap-', 'b'), 'github.core', 'complete', 'NONE')
      insertCheckpoint.run(scopeA, id('ckpt-', 'b'), id('job-', 'b'), id('snap-', 'b'), 'github.core', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete', 'complete')
      db.prepare('INSERT INTO coverage_ledger (scope_id, coverage_id, job_id, capability_id, status, observed_units, retryable, limitation_code) VALUES (?, ?, ?, ?, ?, 0, 0, ?)')
        .run(scopeA, id('cov-', 'c'), id('job-'), 'github.core', 'failed', 'NONE')
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  it('keeps exactly one closed snapshot per job', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO collection_job (scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version, consent_revision, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(scopeA, id('job-'), 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete')
      const insert = db.prepare('INSERT INTO source_snapshot (scope_id, snapshot_id, job_id, capability_id, status) VALUES (?, ?, ?, ?, ?)')
      insert.run(scopeA, id('snap-'), id('job-'), 'github.core', 'closed')
      // UNIQUE (scope_id, snapshot_id, job_id) never enforced this: it contains the PK.
      expect(() => insert.run(scopeA, id('snap-', 'b'), id('job-'), 'github.core', 'closed'))
        .toThrow(/UNIQUE constraint failed|STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY/i)
    } finally {
      db.close()
    }
  })

  it('requires canonical claim window timestamps', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      const insert = db.prepare('INSERT INTO claim (scope_id, claim_id, layer, statement_code, method_id, method_version, window_start, window_end, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      const windows = [
        ['2026-1-1', '2026-2-1'],
        ['2026-01-01T00:00:00.000Z ', '2026-02-01T00:00:00.000Z '],
        ['2026-01-01T00:00:00+02:00', '2026-02-01T00:00:00+02:00'],
        ['2026-01-01', '2026-02-01'],
      ] as const
      for (const [windowStart, windowEnd] of windows) {
        expect(() => insert.run(scopeA, id('cl_'), 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', windowStart, windowEnd, '1.0.0', 'claim-id.v3', '2026-02-01T00:00:00.000Z'))
          .toThrow(/CHECK constraint failed/i)
      }
      insert.run(scopeA, id('cl_'), 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '1.0.0', 'claim-id.v3', '2026-02-01T00:00:00.000Z')
    } finally {
      db.close()
    }
  })

  it('rejects a duplicate C1 owner in another scope before any lineage exists', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeB)
      expect(db.prepare(
        "SELECT COUNT(*) FROM sqlite_schema WHERE type = 'index' AND name IN (" +
        STORAGE_V3_SHADOW_OWNER_IDENTITY_INDEX_NAMES.map(() => '?').join(', ') + ')',
      ).pluck().get(...STORAGE_V3_SHADOW_OWNER_IDENTITY_INDEX_NAMES)).toBe(STORAGE_V3_SHADOW_OWNER_IDENTITY_INDEX_NAMES.length)
      expect(db.prepare('SELECT COUNT(*) FROM lineage_event').pluck().get()).toBe(0)
      const insertJob = db.prepare('INSERT INTO collection_job (scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version, consent_revision, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      insertJob.run(scopeA, id('job-'), 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete')
      insertJob.run(scopeB, id('job-', 'b'), 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete')
      expect(() => insertJob.run(scopeB, id('job-'), 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete'))
        .toThrow(/UNIQUE constraint failed|STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY/i)
      const insertSnapshot = db.prepare('INSERT INTO source_snapshot (scope_id, snapshot_id, job_id, capability_id, status) VALUES (?, ?, ?, ?, ?)')
      insertSnapshot.run(scopeA, id('snap-'), id('job-'), 'github.core', 'closed')
      expect(() => insertSnapshot.run(scopeB, id('snap-'), id('job-', 'b'), 'github.core', 'closed'))
        .toThrow(/UNIQUE constraint failed|STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY/i)
      const insertCoverage = db.prepare('INSERT INTO coverage_ledger (scope_id, coverage_id, job_id, capability_id, status, observed_units, retryable, limitation_code) VALUES (?, ?, ?, ?, ?, 0, 0, ?)')
      insertCoverage.run(scopeA, id('cov-'), id('job-'), 'github.core', 'failed', 'NONE')
      expect(() => insertCoverage.run(scopeB, id('cov-'), id('job-', 'b'), 'github.core', 'failed', 'NONE'))
        .toThrow(/UNIQUE constraint failed|STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY/i)
      // coverage_observation shares the cov- id space, so a per-table index cannot see it.
      const insertObservation = db.prepare('INSERT INTO coverage_observation (scope_id, coverage_id, capability_id, status, limitation_code, observed_units) VALUES (?, ?, ?, ?, ?, 0)')
      expect(() => insertObservation.run(scopeB, id('cov-'), 'github.core', 'complete', 'NONE'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY')
      insertObservation.run(scopeA, id('cov-'), 'github.core', 'complete', 'NONE')
      expect(() => insertCoverage.run(scopeB, id('cov-', 'b'), id('job-', 'b'), 'github.core', 'failed', 'NONE')).not.toThrow()
      db.prepare('DELETE FROM coverage_ledger WHERE scope_id = ? AND coverage_id = ?').run(scopeB, id('cov-', 'b'))
      insertObservation.run(scopeB, id('cov-', 'b'), 'github.core', 'complete', 'NONE')
      expect(() => insertCoverage.run(scopeA, id('cov-', 'b'), id('job-'), 'github.core', 'failed', 'NONE'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY')
    } finally {
      db.close()
    }
  })

  it('refuses INSERT OR REPLACE from moving a C1 owner across scopes (PR #138 review)', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeB)
      db.prepare('INSERT INTO collection_job (scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version, consent_revision, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(scopeA, id('job-'), 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete')
      // OR REPLACE would satisfy the unique index by DELETING scope A's row; the
      // BEFORE INSERT guard fires before conflict resolution and aborts instead.
      expect(() => db.prepare('INSERT OR REPLACE INTO collection_job (scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version, consent_revision, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(scopeB, id('job-'), 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY')
      expect(db.prepare('SELECT scope_id FROM collection_job WHERE job_id = ?').pluck().get(id('job-'))).toBe(scopeA)
    } finally {
      db.close()
    }
  })

  it('refuses INSERT OR REPLACE from discarding pending maintenance identity', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare(`INSERT INTO storage_maintenance_state (
        singleton, state, operation_id, scope_id, event_week
      ) VALUES (1, 'pending', ?, ?, '2026-W05')`).run(id('del-'), scopeA)

      expect(() => db.prepare(`INSERT OR REPLACE INTO storage_maintenance_state (
        singleton, state, operation_id, scope_id, event_week
      ) VALUES (1, 'complete', NULL, NULL, NULL)`).run())
        .toThrow('STORAGE_V3_ARTIFACT_INVALID')
      expect(db.prepare(`SELECT state, operation_id, scope_id, event_week
        FROM storage_maintenance_state WHERE singleton = 1`).get()).toEqual({
        state: 'pending',
        operation_id: id('del-'),
        scope_id: scopeA,
        event_week: '2026-W05',
      })
    } finally {
      db.close()
    }
  })

  it('binds ownerless artifact and deletion lineage to a single scope', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeB)
      const insert = db.prepare('INSERT INTO lineage_event (scope_id, subject_kind, subject_id, operation_id, capability_id, caused_by, event_kind, event_week) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      // art- subjects have no owner table, so only the history guard can bind them.
      insert.run(scopeA, 'artifact', id('art-'), id('op-', '1'), 'github.core', null, 'index_built', '2026-W05')
      expect(() => insert.run(scopeB, 'artifact', id('art-'), id('op-', '2'), 'github.core', null, 'index_built', '2026-W05'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')
      insert.run(scopeA, 'job', id('job-'), id('op-', '3'), 'github.core', id('art-', 'b'), 'index_built', '2026-W05')
      expect(() => insert.run(scopeB, 'job', id('job-', 'b'), id('op-', '4'), 'github.core', id('art-', 'b'), 'index_built', '2026-W05'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')
      insert.run(scopeA, 'deletion', id('del-', '5'), id('del-', '6'), 'github.core', null, 'tombstone_cascade', '2026-W05')
      expect(() => insert.run(scopeB, 'deletion', id('del-', '5'), id('del-', '7'), 'github.core', null, 'tombstone_cascade', '2026-W05'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')
      // Same scope stays legal for every ownerless kind.
      insert.run(scopeA, 'artifact', id('art-'), id('op-', '8'), 'github.core', null, 'export_included', '2026-W05')
    } finally {
      db.close()
    }
  })

  it('rejects empty coverage-ledger limitation and saturation codes', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO collection_job (scope_id, job_id, capability_id, storage_contract_version, query_version, source_api_version, consent_revision, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(scopeA, id('job-'), 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete')
      db.prepare('INSERT INTO source_snapshot (scope_id, snapshot_id, job_id, capability_id, status) VALUES (?, ?, ?, ?, ?)').run(scopeA, id('snap-'), id('job-'), 'github.core', 'closed')
      const insert = db.prepare('INSERT INTO coverage_ledger (scope_id, coverage_id, job_id, snapshot_id, capability_id, status, observed_units, retryable, saturation_reason, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      expect(() => insert.run(scopeA, id('cov-'), id('job-'), id('snap-'), 'github.core', 'complete', 2, 0, null, ''))
        .toThrow(/CHECK constraint failed/i)
      expect(() => insert.run(scopeA, id('cov-'), id('job-'), id('snap-'), 'github.core', 'complete', 2, 0, '', 'NONE'))
        .toThrow(/CHECK constraint failed/i)
      insert.run(scopeA, id('cov-'), id('job-'), id('snap-'), 'github.core', 'complete', 2, 0, null, 'NONE')
    } finally {
      db.close()
    }
  })

  it('enforces exact lineage operation, subject, cause, and ISO-week invariants', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeB)
      db.prepare(`INSERT INTO collection_job (
        scope_id, job_id, capability_id, storage_contract_version, query_version,
        source_api_version, consent_revision, status
      ) VALUES (?, ?, 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-v3', 'complete')`)
        .run(scopeA, id('job-'))
      const insert = db.prepare('INSERT INTO lineage_event (scope_id, subject_kind, subject_id, operation_id, capability_id, caused_by, event_kind, event_week) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      insert.run(scopeA, 'scope', scopeA, id('del-'), 'github.core', null, 'index_deleted', '2026-W32')
      insert.run(scopeA, 'job', id('job-'), id('op-', '8'), 'github.core', null, 'c2_retention_expired', '2026-W32')
      expect(() => insert.run(scopeA, 'job', id('job-'), id('op-', '5'), 'github.core', null, 'c2_retention_expired', '2026-W32')).toThrow()
      expect(() => insert.run(scopeA, 'coverage', id('cov-'), id('op-', '6'), 'github.core', null, 'c2_retention_expired', '2026-W32'))
        .toThrow('STORAGE_V3_SHADOW_C2_RETENTION_OWNER_REQUIRED')
      expect(() => insert.run(scopeA, 'scope', scopeA, id('op-', '7'), 'github.core', null, 'c2_retention_expired', '2026-W32')).toThrow()
      insert.run(null, 'deletion', id('del-', 'b'), id('del-', 'b'), 'github.core', null, 'legacy_deletion_operation', '2026-W32')
      expect(() => insert.run(null, 'deletion', id('del-', 'b'), id('del-', 'b'), 'github.core', null, 'legacy_deletion_operation', '2026-W32')).toThrow()
      expect(() => insert.run(scopeA, 'deletion', id('del-', 'c'), id('del-', 'd'), 'github.core', null, 'legacy_deletion_operation', '2026-W32')).toThrow()
      expect(() => insert.run(scopeA, 'deletion', id('del-', 'c'), id('del-', 'c'), 'github.core', null, 'legacy_deletion_operation', '2026-W32')).toThrow()
      expect(() => insert.run(null, 'scope', scopeA, id('op-', 'a'), 'github.core', null, 'correction', '2026-W32')).toThrow()
      insert.run(scopeA, 'claim', id('cl_', 'c'), id('op-', '9'), 'github.core', null, 'correction', '2026-W32')
      expect(() => insert.run(scopeB, 'claim', id('cl_', 'c'), id('op-', '9'), 'github.core', null, 'correction', '2026-W32')).toThrow()
      expect(() => insert.run(scopeA, 'scope', scopeA, id('op-', 'b'), 'github.core', scopeB, 'scope_series_restarted', '2026-W32')).toThrow()
      expect(() => insert.run(scopeA, 'scope', scopeA, id('op-', 'c'), 'github.core', null, 'correction', '2026-W00')).toThrow()
      expect(() => insert.run(scopeA, 'scope', scopeA, id('op-', 'd'), 'github.core', null, 'correction', '2026-W54')).toThrow()
      expect(() => insert.run(scopeA, 'scope', scopeA, id('op-', 'f'), 'github.core', null, 'correction', '2025-W53')).toThrow()
      expect(() => insert.run(scopeA, 'scope', scopeA, id('op-', 'e'), 'github.core', null, 'index_deleted', '2026-W32')).toThrow()
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  it('rejects cross-scope live lineage subjects and causes while retaining content-free tombstones', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeB)
      const claimA = id('cl_')
      const claimB = id('cl_', 'b')
      const tombstoneClaim = id('cl_', 'c')
      const insertClaim = db.prepare('INSERT INTO claim (scope_id, claim_id, layer, statement_code, method_id, method_version, window_start, window_end, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      insertClaim.run(scopeA, claimA, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '1.0.0', 'claim-id.v3', '2026-02-01T00:00:00.000Z')
      insertClaim.run(scopeB, claimB, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '1.0.0', 'claim-id.v3', '2026-02-01T00:00:00.000Z')
      const insertLineage = db.prepare('INSERT INTO lineage_event (scope_id, subject_kind, subject_id, operation_id, capability_id, caused_by, event_kind, event_week) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')

      expect(() => insertLineage.run(scopeA, 'claim', claimB, id('op-'), 'github.core', null, 'correction', '2026-W32'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')
      insertLineage.run(scopeB, 'claim', claimB, id('op-', 'b'), 'github.core', null, 'correction', '2026-W32')
      expect(() => insertLineage.run(scopeA, 'claim', tombstoneClaim, id('op-', 'c'), 'github.core', claimB, 'correction', '2026-W32'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')
      insertLineage.run(scopeA, 'claim', tombstoneClaim, id('op-', 'd'), 'github.core', claimA, 'correction', '2026-W32')
      insertLineage.run(scopeB, 'claim', id('cl_', 'd'), id('op-', 'e'), 'github.core', null, 'correction', '2026-W32')

      expect(db.prepare('SELECT COUNT(*) FROM lineage_event').pluck().get()).toBe(3)
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  it('rejects later owner insertion, rebinding, and tombstone reuse across scopes', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeB)
      const insertLineage = db.prepare('INSERT INTO lineage_event (scope_id, subject_kind, subject_id, operation_id, capability_id, caused_by, event_kind, event_week) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      const insertClaim = db.prepare('INSERT INTO claim (scope_id, claim_id, layer, statement_code, method_id, method_version, window_start, window_end, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      const claimValues = (scopeId: string, claimId: string): readonly unknown[] => [
        scopeId,
        claimId,
        'modelled',
        'DELIVERY_FLOW',
        'method',
        '1.0.0',
        '2026-01-01T00:00:00.000Z',
        '2026-02-01T00:00:00.000Z',
        '1.0.0',
        'claim-id.v3',
        '2026-02-01T00:00:00.000Z',
      ]
      const subjectClaim = id('cl_', 'c')
      const causeClaim = id('cl_', 'd')
      const tombstoneClaim = id('cl_', 'f')

      insertLineage.run(scopeA, 'claim', subjectClaim, id('op-'), 'github.core', null, 'correction', '2026-W32')
      expect(() => insertClaim.run(...claimValues(scopeB, subjectClaim)))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')
      insertClaim.run(...claimValues(scopeA, subjectClaim))
      db.prepare('DELETE FROM claim WHERE scope_id = ? AND claim_id = ?').run(scopeA, subjectClaim)
      expect(() => insertClaim.run(...claimValues(scopeB, subjectClaim)))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')

      insertLineage.run(scopeA, 'claim', id('cl_', 'e'), id('op-', 'b'), 'github.core', causeClaim, 'correction', '2026-W32')
      expect(() => insertClaim.run(...claimValues(scopeB, causeClaim)))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')
      expect(() => insertLineage.run(scopeB, 'claim', id('cl_', '1'), id('op-', 'c'), 'github.core', causeClaim, 'correction', '2026-W32'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')
      insertClaim.run(...claimValues(scopeA, causeClaim))

      insertLineage.run(scopeA, 'claim', tombstoneClaim, id('op-', 'd'), 'github.core', null, 'correction', '2026-W32')
      expect(() => insertLineage.run(scopeB, 'claim', tombstoneClaim, id('op-', 'e'), 'github.core', null, 'correction', '2026-W32'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')

      expect(db.prepare('SELECT scope_id, claim_id FROM claim ORDER BY claim_id').all()).toEqual([
        { scope_id: scopeA, claim_id: causeClaim },
      ])
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  it('binds neutral and deletion operation causes to one scope in both insertion orders', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeB)
      const insertLineage = db.prepare('INSERT INTO lineage_event (scope_id, subject_kind, subject_id, operation_id, capability_id, caused_by, event_kind, event_week) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      const operationB = id('op-', 'b')
      const unbackedCause = id('op-', 'f')
      const legacyDeletion = id('del-')

      insertLineage.run(scopeB, 'claim', id('cl_', 'b'), operationB, 'github.core', null, 'correction', '2026-W32')
      expect(() => insertLineage.run(scopeA, 'claim', id('cl_'), id('op-', 'c'), 'github.core', operationB, 'correction', '2026-W32'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')
      insertLineage.run(scopeB, 'claim', id('cl_', 'c'), id('op-', 'd'), 'github.core', operationB, 'correction', '2026-W32')

      insertLineage.run(scopeA, 'claim', id('cl_', 'd'), id('op-', 'e'), 'github.core', unbackedCause, 'correction', '2026-W32')
      expect(() => insertLineage.run(scopeB, 'claim', id('cl_', 'e'), id('op-', '1'), 'github.core', unbackedCause, 'correction', '2026-W32'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')
      expect(() => insertLineage.run(scopeB, 'claim', id('cl_', 'f'), unbackedCause, 'github.core', null, 'correction', '2026-W32'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')

      insertLineage.run(null, 'deletion', legacyDeletion, legacyDeletion, 'github.core', null, 'legacy_deletion_operation', '2026-W32')
      expect(() => insertLineage.run(scopeA, 'claim', id('cl_', '2'), id('op-', '2'), 'github.core', legacyDeletion, 'correction', '2026-W32'))
        .toThrow('STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE')

      expect(db.prepare('SELECT COUNT(*) FROM lineage_event').pluck().get()).toBe(4)
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  it('preserves a validated bridge record in either mode and refuses every XOR violation', () => {
    const db = new Database(':memory:')
    const provenance = (): unknown =>
      db.prepare('SELECT singleton, mode, synthetic_marker, activation_card_id FROM v2_store_provenance').get()
    try {
      installStorageV3ShadowSchema(db)
      const insert = db.prepare('INSERT INTO v2_store_provenance (singleton, mode, synthetic_marker, activation_card_id, importer_version, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      insert.run(1, 'synthetic', 'invented', null, 'test-v1', '2026-01-01T00:00:00.000Z')
      db.prepare('INSERT INTO v2_coverage_record (coverage_id, capability_id, scope_alias, range_start, range_end, status, expected_units, observed_units, omitted_units, saturation_reason, retryable, observed_at, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('c0-coverage', 'github.core', 'c0-scope', '2026-01-01', '2026-02-01', 'complete', 2, 2, 0, null, 0, '2026-02-01T00:00:00.000Z', 'NONE')
      expect(provenance()).toEqual({ singleton: 1, mode: 'synthetic', synthetic_marker: 'invented', activation_card_id: null })
      // The singleton stays a singleton, whatever the second row claims.
      expect(() => insert.run(2, 'activation_card', null, 'invented-activation-card', 'test-v1', '2026-01-01T00:00:00.000Z')).toThrow()

      // The v2 source shape is supported end to end: activation_card provenance is
      // storable here so a real q-5 store can be migrated and preserved verbatim.
      db.prepare('DELETE FROM v2_store_provenance').run()
      insert.run(1, 'activation_card', null, 'invented-activation-card', 'test-v1', '2026-01-01T00:00:00.000Z')
      expect(provenance()).toEqual({ singleton: 1, mode: 'activation_card', synthetic_marker: null, activation_card_id: 'invented-activation-card' })

      // Each mode must carry exactly its own witness, and only recognized modes exist.
      db.prepare('DELETE FROM v2_store_provenance').run()
      for (const [mode, marker, card] of [
        ['synthetic', null, null],
        ['synthetic', null, 'invented-activation-card'],
        ['synthetic', 'invented', 'invented-activation-card'],
        ['activation_card', null, null],
        ['activation_card', 'invented', null],
        ['activation_card', 'invented', 'invented-activation-card'],
        ['activation_card', null, 'invented card'],
        ['unreviewed_card', 'invented', null],
      ] as const) {
        expect(() => insert.run(1, mode, marker, card, 'test-v1', '2026-01-01T00:00:00.000Z'), `${mode}/${marker}/${card}`).toThrow()
      }
      expect(db.prepare('SELECT COUNT(*) FROM v2_store_provenance').pluck().get()).toBe(0)
    } finally {
      db.close()
    }
  })

  it('does not mutate a separate v2 source fixture', () => {
    const source = openStorageDatabase(':memory:')
    const shadow = new Database(':memory:')
    try {
      installIncrementalGithubCoreStorage(source)
      installClaimGraphStorage(source)
      installV2BridgeStore(source)
      source.prepare('INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, 0, 0, 0)').run('source-provider', 'source-alias')
      source.prepare('INSERT INTO coverage_observation (capability_id, status, limitation_code, observed_units) VALUES (?, ?, ?, ?)').run('github.core', 'complete', 'SOURCE_FIXTURE', 2)
      const before = {
        tables: tables(source),
        identities: source.prepare('SELECT * FROM repository_identity').all(),
        coverage: source.prepare('SELECT * FROM coverage_observation').all(),
      }
      installStorageV3ShadowSchema(shadow)
      expect({
        tables: tables(source),
        identities: source.prepare('SELECT * FROM repository_identity').all(),
        coverage: source.prepare('SELECT * FROM coverage_observation').all(),
      }).toEqual(before)
    } finally {
      source.close()
      shadow.close()
    }
  })

  it('rejects a v2 target before DDL and leaves its bytes/schema unchanged', () => {
    const source = openStorageDatabase(':memory:')
    try {
      installIncrementalGithubCoreStorage(source)
      installClaimGraphStorage(source)
      installV2BridgeStore(source)
      source.prepare('INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, 0, 0, 0)').run('v2-provider', 'v2-alias')
      const before = {
        applicationId: Number(source.prepare('PRAGMA application_id').pluck().get()),
        userVersion: Number(source.prepare('PRAGMA user_version').pluck().get()),
        schema: source.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all(),
        rows: source.prepare('SELECT * FROM repository_identity').all(),
      }
      expect(() => installStorageV3ShadowSchema(source)).toThrow('STORAGE_V3_SHADOW_TARGET_MISMATCH')
      expect({
        applicationId: Number(source.prepare('PRAGMA application_id').pluck().get()),
        userVersion: Number(source.prepare('PRAGMA user_version').pluck().get()),
        schema: source.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all(),
        rows: source.prepare('SELECT * FROM repository_identity').all(),
      }).toEqual(before)
    } finally {
      source.close()
    }
  })

  it('rejects a marker-compatible target whose schema was altered', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.exec('ALTER TABLE claim ADD COLUMN injected TEXT')
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
    } finally {
      db.close()
    }
  })

  it('rolls back schema additions when a marker-compatible partial target is invalid', () => {
    const db = new Database(':memory:')
    try {
      db.pragma(`application_id = ${STORAGE_V3_SHADOW_APPLICATION_ID}`)
      db.pragma(`user_version = ${STORAGE_V3_SHADOW_USER_VERSION}`)
      db.exec('CREATE TABLE claim (injected TEXT) STRICT;')
      const before = db.prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
      ).all()
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
      expect(db.prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
      ).all()).toEqual(before)
    } finally {
      db.close()
    }
  })

  it('rejects a marker-compatible target whose CHECK literal differs only in case', () => {
    const db = new Database(':memory:')
    try {
      db.pragma(`application_id = ${STORAGE_V3_SHADOW_APPLICATION_ID}`)
      db.pragma(`user_version = ${STORAGE_V3_SHADOW_USER_VERSION}`)
      db.exec(STORAGE_V3_SHADOW_SCHEMA_SQL.replace("mode = 'synthetic'", "mode = 'SYNTHETIC'"))
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
    } finally {
      db.close()
    }
  })

  it('accepts a marker-compatible target that differs only in keyword case and whitespace', () => {
    const db = new Database(':memory:')
    try {
      db.pragma(`application_id = ${STORAGE_V3_SHADOW_APPLICATION_ID}`)
      db.pragma(`user_version = ${STORAGE_V3_SHADOW_USER_VERSION}`)
      db.exec(STORAGE_V3_SHADOW_SCHEMA_SQL
        .replaceAll('NOT NULL', 'not    null')
        .replaceAll(') STRICT', ')\n  strict'))
      expect(() => installStorageV3ShadowSchema(db)).not.toThrow()
    } finally {
      db.close()
    }
  })

  it('rejects TEMP objects that shadow an owned schema name', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.exec('CREATE TEMP TABLE claim (sentinel TEXT NOT NULL) STRICT;')
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
    } finally {
      db.close()
    }
  })

  it('rejects added triggers that can change shadow writes', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.exec(`CREATE TRIGGER injected AFTER INSERT ON claim
        BEGIN SELECT RAISE(ABORT, 'injected'); END;`)
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
    } finally {
      db.close()
    }
  })

  it('rejects marker-only non-v3 stores before changing identity or schema', () => {
    const db = new Database(':memory:')
    try {
      db.pragma('application_id = 0x444c5632')
      db.pragma('user_version = 2')
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_TARGET_MISMATCH')
      expect(Number(db.prepare('PRAGMA application_id').pluck().get())).toBe(0x444c5632)
      expect(Number(db.prepare('PRAGMA user_version').pluck().get())).toBe(2)
      expect(tables(db)).toEqual([])
    } finally {
      db.close()
    }
  })

  it.each([
    ['B1b-i', 301],
    ['B1b-iii', 302],
    ['B2a-i', 303],
    ['B2a-ii', 304],
  ])('rejects the superseded %s shadow identity before changing schema', (_slice, userVersion) => {
    const db = new Database(':memory:')
    try {
      db.pragma(`application_id = ${STORAGE_V3_SHADOW_APPLICATION_ID}`)
      db.pragma(`user_version = ${userVersion}`)
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_TARGET_MISMATCH')
      expect(Number(db.prepare('PRAGMA user_version').pluck().get())).toBe(userVersion)
      expect(tables(db)).toEqual([])
    } finally {
      db.close()
    }
  })

  it('returns the exact incomplete and non-selectable B1b result', () => {
    expect(storageV3ShadowResult()).toBe(STORAGE_V3_SHADOW_RESULT)
    expect(STORAGE_V3_SHADOW_RESULT).toEqual({
      completeB1b: false,
      selectable: false,
      status: 'incomplete',
      schemaVersion: STORAGE_V3_SHADOW_SCHEMA_VERSION,
    })
  })
})
