import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { installV2BridgeStore } from '../api/v2/store.js'
import { installClaimGraphStorage } from './claims.js'
import { openStorageDatabase } from './database.js'
import { installIncrementalGithubCoreStorage } from './incremental.js'
import {
  installStorageV3ShadowSchema,
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_RESULT,
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  STORAGE_V3_SHADOW_SCHEMA_SQL,
  STORAGE_V3_SHADOW_SCHEMA_VERSION,
  STORAGE_V3_SHADOW_TABLES,
  STORAGE_V3_SHADOW_USER_VERSION,
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

describe('storage-v3 B1b shadow schema', () => {
  it('installs exactly the registered 18 tables and all dispositions', () => {
    const db = new Database(':memory:')
    try {
      expect(installStorageV3ShadowSchema(db)).toEqual(STORAGE_V3_SHADOW_RESULT)
      expect(tables(db)).toEqual([...STORAGE_V3_TABLES].sort())
      expect(STORAGE_V3_SHADOW_TABLES).toEqual(STORAGE_V3_TABLES)
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
      insertClaim.run(scopeA, id('cl_'), 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01', '2026-02-01', '1.0.0', 'claim-id.v3', '2026-02-01T00:00:00.000Z')
      insertClaim.run(scopeB, id('cl_', 'b'), 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01', '2026-02-01', '1.0.0', 'claim-id.v3', '2026-02-01T00:00:00.000Z')
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

  it('enforces exact lineage operation, subject, cause, and ISO-week invariants', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeA)
      db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scopeB)
      const insert = db.prepare('INSERT INTO lineage_event (scope_id, subject_kind, subject_id, operation_id, capability_id, caused_by, event_kind, event_week) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      insert.run(scopeA, 'scope', scopeA, id('del-'), 'github.core', null, 'index_deleted', '2026-W32')
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

  it('preserves only validated synthetic bridge rows', () => {
    const db = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(db)
      db.prepare('INSERT INTO v2_store_provenance (singleton, mode, synthetic_marker, importer_version, created_at) VALUES (1, ?, ?, ?, ?)').run('synthetic', 'invented', 'test-v1', '2026-01-01T00:00:00.000Z')
      db.prepare('INSERT INTO v2_coverage_record (coverage_id, capability_id, scope_alias, range_start, range_end, status, expected_units, observed_units, omitted_units, saturation_reason, retryable, observed_at, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('c0-coverage', 'github.core', 'c0-scope', '2026-01-01', '2026-02-01', 'complete', 2, 2, 0, null, 0, '2026-02-01T00:00:00.000Z', 'NONE')
      expect(() => db.prepare('INSERT INTO v2_store_provenance (singleton, mode, synthetic_marker, importer_version, created_at) VALUES (2, ?, ?, ?, ?)').run('activation_card', 'invented', 'test-v1', '2026-01-01T00:00:00.000Z')).toThrow()
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

  it('rejects the superseded B1b-i shadow identity before changing schema', () => {
    const db = new Database(':memory:')
    try {
      db.pragma(`application_id = ${STORAGE_V3_SHADOW_APPLICATION_ID}`)
      db.pragma('user_version = 301')
      expect(() => installStorageV3ShadowSchema(db)).toThrow('STORAGE_V3_SHADOW_TARGET_MISMATCH')
      expect(Number(db.prepare('PRAGMA user_version').pluck().get())).toBe(301)
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
