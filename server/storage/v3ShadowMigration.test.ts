import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { installV2BridgeStore } from '../api/v2/store.js'
import { installClaimGraphStorage } from './claims.js'
import { openStorageDatabase } from './database.js'
import { installIncrementalGithubCoreStorage } from './incremental.js'
import { createInstallationAliases } from './installationAliases.js'
import {
  orchestrateStorageV3ShadowMigration,
  StorageV3ShadowMigrationError,
  type StorageV3ShadowTargetAttempt,
} from './v3ShadowMigration.js'
import {
  STORAGE_V3_SHADOW_REWRITE_STAGES,
  STORAGE_V3_SHADOW_TABLES,
  rewriteStorageV3Shadow,
} from './v3ShadowRewrite.js'
import { STORAGE_V3_SHADOW_SCHEMA_VERSION } from './v3ShadowSchema.js'

function sourceFixture(): { db: Database.Database; key: Buffer; raw: string } {
  const db = openStorageDatabase(':memory:')
  installIncrementalGithubCoreStorage(db)
  installClaimGraphStorage(db)
  installV2BridgeStore(db)
  db.prepare('INSERT INTO v2_store_provenance (singleton, mode, synthetic_marker, importer_version, created_at) VALUES (1, ?, ?, ?, ?)')
    .run('synthetic', 'developer-lens.synthetic-importer.v1', '1.0.0', '2026-01-01T00:00:00.000Z')
  const key = Buffer.alloc(32, 17)
  const raw = 'invented-b1biii-repository'
  const aliases = createInstallationAliases(key)
  const provider = aliases.repositoryProviderId(raw)
  const analytical = aliases.repositoryAnalyticalKey(raw)
  // A PRE-EXISTING scope row: the rewrite PRESERVES this scope id verbatim, so both
  // targets must agree on it literally — the exact #133 seam.
  db.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at) VALUES (?, ?, ?)')
    .run(PRESERVED_SCOPE, provider, '2026-01-01T00:00:00.000Z')
  db.prepare('INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, 0, 0, 0)')
    .run(provider, analytical)
  db.prepare('INSERT INTO commit_observation (repository_provider_id, sha, occurred_at, source, feature_type, is_revert, is_fixup, message_length) VALUES (?, ?, ?, ?, ?, 0, 0, 1)')
    .run(provider, 'invented-sha', '2026-01-01T00:00:00.000Z', 'github', 'feat')
  // A slice-A legacy tombstone: rewritten as `del-<same 64 hex>` DERIVED from this row,
  // not minted, so both targets must carry it literally (PR #127 late review).
  db.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)')
    .run(`scope_tombstone_${LEGACY_TOMBSTONE_SUFFIX}`, 'tombstone_cascade', 'cap_github_core', '2026-01-01T12:00:00.000Z')
  return { db, key, raw }
}

const LEGACY_TOMBSTONE_SUFFIX = 'a'.repeat(64)
const PRESERVED_SCOPE = `scope-${'1'.repeat(64)}`

interface AttemptRecord {
  closeCount: number
  reopenCount: number
  discardCount: number
}

type ReopenHook = (kind: 'primary' | 'replay', attempt: FileAttempt) => void

class FileAttempt implements StorageV3ShadowTargetAttempt {
  public readonly db: Database.Database
  private readonly path: string
  private readonly kind: 'primary' | 'replay'
  private readonly record: AttemptRecord
  private readonly onReopen: ReopenHook | undefined
  public constructor(
    path: string,
    kind: 'primary' | 'replay',
    record: AttemptRecord,
    onReopen?: ReopenHook,
  ) {
    this.path = path
    this.kind = kind
    this.record = record
    this.onReopen = onReopen
    this.db = new Database(path)
    this.db.pragma('busy_timeout = 0')
  }
  close(): void {
    this.record.closeCount += 1
    this.db.close()
  }
  reopen(): StorageV3ShadowTargetAttempt {
    this.record.reopenCount += 1
    const reopened = new FileAttempt(this.path, this.kind, this.record, this.onReopen)
    this.onReopen?.(this.kind, reopened)
    return reopened
  }
  discard(): void {
    this.record.discardCount += 1
    for (const suffix of ['', '-wal', '-shm']) {
      try { rmSync(`${this.path}${suffix}`, { force: true }) } catch { /* exact test-owned cleanup */ }
    }
  }
}

interface FileFactoryHarness {
  readonly factory: {
    create(kind: 'primary' | 'replay'): StorageV3ShadowTargetAttempt
    accept(primary: StorageV3ShadowTargetAttempt): void
  }
  readonly state: { accepted?: StorageV3ShadowTargetAttempt }
  readonly paths: ReadonlyMap<'primary' | 'replay', string>
  readonly records: ReadonlyMap<'primary' | 'replay', AttemptRecord>
  cleanup(): void
}

function fileFactory(onReopen?: ReopenHook): FileFactoryHarness {
  const root = mkdtempSync(join(tmpdir(), 'developer-lens-b1biii-'))
  const paths = new Map<'primary' | 'replay', string>([
    ['primary', join(root, 'primary.sqlite')],
    ['replay', join(root, 'replay.sqlite')],
  ])
  const records = new Map<'primary' | 'replay', AttemptRecord>([
    ['primary', { closeCount: 0, reopenCount: 0, discardCount: 0 }],
    ['replay', { closeCount: 0, reopenCount: 0, discardCount: 0 }],
  ])
  const state: { accepted?: StorageV3ShadowTargetAttempt } = {}
  return {
    factory: {
      create: (kind) => new FileAttempt(paths.get(kind)!, kind, records.get(kind)!, onReopen),
      accept: (primary) => { state.accepted = primary },
    },
    state,
    paths,
    records,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

const entropy = (value: number) => () => Buffer.alloc(32, value)

function closeAccepted(paths: FileFactoryHarness): void {
  if (!paths.state.accepted) return
  paths.state.accepted.close()
  paths.state.accepted.discard()
  paths.state.accepted = undefined
}

function expectOpaqueFailure(run: () => unknown): void {
  try {
    run()
    throw new Error('expected orchestration failure')
  } catch (error) {
    expect(error).toBeInstanceOf(StorageV3ShadowMigrationError)
    expect(error).toMatchObject({ code: 'ORCHESTRATION_FAILED', message: 'ORCHESTRATION_FAILED' })
  }
}

describe('B1b-iii shadow orchestration', () => {
  it.each(STORAGE_V3_SHADOW_REWRITE_STAGES)(
    'rolls back injected %s failures, including zero-row stages, without mutating the source',
    (stage) => {
      const { db: source, key, raw } = sourceFixture()
      const target = new Database(':memory:')
      const before = source.serialize()
      try {
        expect(() => rewriteStorageV3Shadow({
          sourceDb: source,
          targetDb: target,
          identityBindings: [{ rawProviderId: raw }],
          installationKey: key,
          asOf: '2026-01-02T00:00:00.000Z',
          randomBytes: entropy(19),
          failAfterStage: (actual) => { if (actual === stage) throw new Error('opaque-injected') },
        })).toThrow()
        for (const table of STORAGE_V3_SHADOW_TABLES) {
          expect(target.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get(), `${stage}:${table}`).toBe(0)
        }
        expect(source.serialize()).toEqual(before)
      } finally { source.close(); target.close() }
    },
  )

  it.each(STORAGE_V3_SHADOW_REWRITE_STAGES.map((stage, index) => [
    stage,
    index % 2 === 0 ? 'primary' as const : 'replay' as const,
  ]))('discards both attempts for injected %s failures in %s', (stage, failedKind) => {
    const { db: source, key, raw } = sourceFixture()
    const paths = fileFactory()
    const before = source.serialize()
    try {
      expectOpaqueFailure(() => orchestrateStorageV3ShadowMigration({
        sourceDb: source,
        identityBindings: [{ rawProviderId: raw }],
        installationKey: key,
        asOf: '2026-01-02T00:00:00.000Z',
        targetFactory: paths.factory,
        primaryRandomBytes: entropy(21),
        replayRandomBytes: entropy(22),
        failAfterStage: (kind, actual) => {
          if (kind === failedKind && actual === stage) throw new Error('private-injected-detail')
        },
      }))
      expect(paths.state.accepted).toBeUndefined()
      expect(paths.records.get('primary')!.discardCount).toBeGreaterThan(0)
      expect(paths.records.get('replay')!.discardCount).toBeGreaterThan(0)
      expect(existsSync(paths.paths.get('primary')!)).toBe(false)
      expect(existsSync(paths.paths.get('replay')!)).toBe(false)
      expect(source.serialize()).toEqual(before)
    } finally { source.close(); paths.cleanup() }
  })

  it('selects only a freshly reopened, FK-enforcing target and emits an opaque frozen result', () => {
    const { db: source, key, raw } = sourceFixture()
    const paths = fileFactory()
    const aliases = createInstallationAliases(key)
    try {
      const result = orchestrateStorageV3ShadowMigration({
        sourceDb: source,
        identityBindings: [{ rawProviderId: raw }],
        installationKey: key,
        asOf: '2026-01-02T00:00:00.000Z',
        targetFactory: paths.factory,
        primaryRandomBytes: entropy(21),
        replayRandomBytes: entropy(22),
      })
      const accepted = paths.state.accepted!
      expect(result.completeB1b).toBe(true)
      expect(result.selectable).toBe(true)
      expect(result.checksum).toMatch(/^[0-9a-f]{64}$/)
      expect(Object.isFrozen(result)).toBe(true)
      expect(paths.records.get('primary')).toMatchObject({ closeCount: 1, reopenCount: 1, discardCount: 0 })
      expect(paths.records.get('replay')).toMatchObject({ closeCount: 2, reopenCount: 1, discardCount: 1 })
      expect(accepted.db.prepare('PRAGMA foreign_keys').pluck().get()).toBe(1)
      expect(() => accepted.db.prepare(
        'INSERT INTO repository_identity (scope_id, is_private, is_archived, is_fork) VALUES (?, 0, 0, 0)',
      ).run(`scope-${'f'.repeat(64)}`)).toThrow(/FOREIGN KEY constraint failed/i)
      const publicResult = JSON.stringify(result)
      for (const forbidden of [
        raw,
        key.toString('hex'),
        key.toString('base64'),
        aliases.repositoryProviderId(raw),
        aliases.repositoryAnalyticalKey(raw),
        ...paths.paths.values(),
      ]) expect(publicResult).not.toContain(forbidden)
    } finally { closeAccepted(paths); source.close(); paths.cleanup() }
  })

  /**
   * The upcoming real q-5 store records `activation_card` provenance. Migration
   * validates provenance STRUCTURE, so such a source must survive the whole
   * orchestration — both rewrites, the mint-order equivalence proof, and
   * acceptance — with its C0 row preserved byte-for-byte, card ID included. The
   * ADR-04 SERVING refusal is a separate gate on the v2 read path.
   */
  it('accepts an activation-card source and preserves its provenance verbatim', () => {
    const { db: source, key, raw } = sourceFixture()
    source.prepare('UPDATE v2_store_provenance SET mode = ?, synthetic_marker = NULL, activation_card_id = ?')
      .run('activation_card', 'invented-activation-card')
    const paths = fileFactory()
    try {
      const result = orchestrateStorageV3ShadowMigration({
        sourceDb: source,
        identityBindings: [{ rawProviderId: raw }],
        installationKey: key,
        asOf: '2026-01-02T00:00:00.000Z',
        targetFactory: paths.factory,
        primaryRandomBytes: entropy(23),
        replayRandomBytes: entropy(24),
      })
      expect(result.status).toBe('complete')
      const accepted = paths.state.accepted!
      expect(accepted.db.prepare(
        'SELECT singleton, mode, synthetic_marker, activation_card_id, importer_version, created_at FROM v2_store_provenance',
      ).get()).toEqual({
        singleton: 1,
        mode: 'activation_card',
        synthetic_marker: null,
        activation_card_id: 'invented-activation-card',
        importer_version: '1.0.0',
        created_at: '2026-01-01T00:00:00.000Z',
      })
      // v2_coverage_record stays delete-disposition under either mode.
      expect(accepted.db.prepare('SELECT COUNT(*) FROM v2_coverage_record').pluck().get()).toBe(0)
      expect(JSON.stringify(result)).not.toContain('invented-activation-card')
    } finally { closeAccepted(paths); source.close(); paths.cleanup() }
  })

  it.each([
    ['schema drift', (kind: 'primary' | 'replay', attempt: FileAttempt) => {
      if (kind === 'primary') attempt.db.exec('CREATE TABLE unexpected(value TEXT) STRICT')
    }],
    ['foreign-key corruption', (kind: 'primary' | 'replay', attempt: FileAttempt) => {
      if (kind !== 'primary') return
      attempt.db.pragma('foreign_keys = OFF')
      attempt.db.prepare(
        'INSERT INTO repository_identity (scope_id, is_private, is_archived, is_fork) VALUES (?, 0, 0, 0)',
      ).run(`scope-${'f'.repeat(64)}`)
    }],
    ['C1 replay mismatch', (kind: 'primary' | 'replay', attempt: FileAttempt) => {
      if (kind === 'replay') attempt.db.prepare('UPDATE repository_identity SET is_private = 1').run()
    }],
    ['TEMP-table shadowing of a validated table', (kind: 'primary' | 'replay', attempt: FileAttempt) => {
      if (kind === 'primary') attempt.db.exec('CREATE TEMP TABLE claim_scope (scope_id TEXT)')
    }],
    ['retained C2 divergence invisible to the C1 checksum', (kind: 'primary' | 'replay', attempt: FileAttempt) => {
      if (kind === 'replay') attempt.db.prepare('UPDATE commit_observation SET sha = ?').run('tampered-sha')
    }],
    ['minted-id substitution in a literal commit SHA column', (_kind: 'primary' | 'replay', attempt: FileAttempt) => {
      // Copy the target's OWN minted observation id into the literal SHA field.
      // A global value-only encoder would normalize both rows to the same mint
      // index; the closed cell registry must compare this field literally.
      const mintedObservationId = attempt.db.prepare('SELECT observation_id FROM commit_observation').pluck().get()
      expect(mintedObservationId).toMatch(/^obs-/)
      attempt.db.prepare('UPDATE commit_observation SET sha = ?').run(mintedObservationId)
    }],
    // The exact #133 scenario, previously proven to ESCAPE the graph-colouring digest:
    // a PRESERVED scope id consistently substituted with a same-shaped value in one
    // target. Under the mint-order proof the substituted value is not in the mint
    // list, is compared literally, and refuses.
    ['same-shaped substitution of a PRESERVED scope id (#133)', (kind: 'primary' | 'replay', attempt: FileAttempt) => {
      if (kind !== 'primary') return
      const db = attempt.db
      const substituted = `scope-${'2'.repeat(64)}`
      const scopeRow = db.prepare('SELECT * FROM claim_scope WHERE scope_id = ?').get(PRESERVED_SCOPE) as Record<string, unknown>
      const identityRows = db.prepare('SELECT * FROM repository_identity WHERE scope_id = ?').all(PRESERVED_SCOPE) as Array<Record<string, unknown>>
      const commitRows = db.prepare('SELECT * FROM commit_observation WHERE scope_id = ?').all(PRESERVED_SCOPE) as Array<Record<string, unknown>>
      db.prepare('DELETE FROM commit_observation WHERE scope_id = ?').run(PRESERVED_SCOPE)
      db.prepare('DELETE FROM repository_identity WHERE scope_id = ?').run(PRESERVED_SCOPE)
      db.prepare('DELETE FROM claim_scope WHERE scope_id = ?').run(PRESERVED_SCOPE)
      const insert = (table: string, row: Record<string, unknown>): void => {
        const entries = Object.entries({ ...row, scope_id: substituted })
        db.prepare(
          `INSERT INTO ${table} (${entries.map(([column]) => column).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`,
        ).run(...entries.map(([, value]) => value))
      }
      insert('claim_scope', scopeRow)
      for (const row of identityRows) insert('repository_identity', row)
      for (const row of commitRows) insert('commit_observation', row)
    }],
    // The exact PR #127 late-review scenario: a source-derived legacy deletion ID is
    // replaced with another same-shaped `del-<64hex>` in ONE target. Alpha-renaming
    // would colour both values identically and accept; literal comparison refuses.
    ['same-shaped substitution of a source-derived legacy deletion ID', (kind: 'primary' | 'replay', attempt: FileAttempt) => {
      if (kind !== 'primary') return
      // lineage_event key columns are immutable-trigger guarded, so model the hostile
      // divergence as delete + re-insert of the substituted row.
      const week = attempt.db.prepare("SELECT event_week FROM lineage_event WHERE event_kind = 'legacy_deletion_operation'").pluck().get() as string
      attempt.db.prepare("DELETE FROM lineage_event WHERE event_kind = 'legacy_deletion_operation'").run()
      const substituted = `del-${'b'.repeat(64)}`
      attempt.db.prepare(
        'INSERT INTO lineage_event (scope_id, subject_kind, subject_id, operation_id, capability_id, caused_by, event_kind, event_week) VALUES (NULL, ?, ?, ?, ?, NULL, ?, ?)',
      ).run('deletion', substituted, substituted, 'github.core', 'legacy_deletion_operation', week)
    }],
    ['injected continuity CAS state at acceptance', (_kind: 'primary' | 'replay', attempt: FileAttempt) => {
      const scope = attempt.db.prepare('SELECT scope_id FROM claim_scope LIMIT 1').pluck().get() as string
      attempt.db.prepare('INSERT INTO continuity_cas_state (scope_id, revision) VALUES (?, 0)').run(scope)
    }],
    ['identical injection into a delete-disposition table', (_kind: 'primary' | 'replay', attempt: FileAttempt) => {
      attempt.db.prepare('INSERT INTO import_run (run_id, schema_version, status) VALUES (?, ?, ?)')
        .run(`run-${'c'.repeat(64)}`, STORAGE_V3_SHADOW_SCHEMA_VERSION, 'complete')
      const scope = attempt.db.prepare('SELECT scope_id FROM claim_scope LIMIT 1').pluck().get() as string
      attempt.db.prepare(
        'INSERT INTO coverage_observation (scope_id, coverage_id, capability_id, status, limitation_code, observed_units) VALUES (?, ?, ?, ?, ?, 0)',
      ).run(scope, `cov-${'d'.repeat(64)}`, 'github.core', 'complete', 'NONE')
    }],
  ] as const)('refuses %s after reopen and discards both targets', (_label, onReopen) => {
    const { db: source, key, raw } = sourceFixture()
    const paths = fileFactory(onReopen)
    try {
      expectOpaqueFailure(() => orchestrateStorageV3ShadowMigration({
        sourceDb: source,
        identityBindings: [{ rawProviderId: raw }],
        installationKey: key,
        asOf: '2026-01-02T00:00:00.000Z',
        targetFactory: paths.factory,
        primaryRandomBytes: entropy(21),
        replayRandomBytes: entropy(22),
      }))
      expect(paths.state.accepted).toBeUndefined()
      expect(paths.records.get('primary')!.discardCount).toBeGreaterThan(0)
      expect(paths.records.get('replay')!.discardCount).toBeGreaterThan(0)
    } finally { closeAccepted(paths); source.close(); paths.cleanup() }
  })

  it('restores disabled CHECK enforcement on the reopened connection before acceptance', () => {
    const { db: source, key, raw } = sourceFixture()
    const paths = fileFactory((kind, attempt) => {
      if (kind === 'primary') attempt.db.pragma('ignore_check_constraints = ON')
    })
    try {
      orchestrateStorageV3ShadowMigration({
        sourceDb: source,
        identityBindings: [{ rawProviderId: raw }],
        installationKey: key,
        asOf: '2026-01-02T00:00:00.000Z',
        targetFactory: paths.factory,
        primaryRandomBytes: entropy(21),
        replayRandomBytes: entropy(22),
      })
      const accepted = paths.state.accepted!
      expect(accepted.db.prepare('PRAGMA ignore_check_constraints').pluck().get()).toBe(0)
      expect(accepted.db.prepare('PRAGMA writable_schema').pluck().get()).toBe(0)
      expect(() => accepted.db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)')
        .run('not-a-scope')).toThrow(/CHECK constraint failed/i)
    } finally { closeAccepted(paths); source.close(); paths.cleanup() }
  })

  it('fails closed if the source changes between the primary and replay reads', () => {
    const { db: source, key, raw } = sourceFixture()
    const paths = fileFactory()
    let mutated = false
    try {
      expectOpaqueFailure(() => orchestrateStorageV3ShadowMigration({
        sourceDb: source,
        identityBindings: [{ rawProviderId: raw }],
        installationKey: key,
        asOf: '2026-01-02T00:00:00.000Z',
        targetFactory: paths.factory,
        primaryRandomBytes: entropy(21),
        replayRandomBytes: entropy(22),
        failAfterStage: (kind, stage) => {
          if (kind === 'primary' && stage === 'finalValidation' && !mutated) {
            mutated = true
            source.prepare("UPDATE commit_observation SET sha = 'invented-concurrent-sha'").run()
          }
        },
      }))
      expect(paths.state.accepted).toBeUndefined()
      expect(paths.records.get('primary')!.discardCount).toBeGreaterThan(0)
      expect(paths.records.get('replay')!.discardCount).toBeGreaterThan(0)
    } finally { source.close(); paths.cleanup() }
  })

  it('fails closed under a second writer lock without selecting a partial target', () => {
    const { db: source, key, raw } = sourceFixture()
    const paths = fileFactory()
    const held = new Database(paths.paths.get('primary')!)
    held.pragma('busy_timeout = 0')
    held.exec('BEGIN IMMEDIATE')
    try {
      expectOpaqueFailure(() => orchestrateStorageV3ShadowMigration({
        sourceDb: source,
        identityBindings: [{ rawProviderId: raw }],
        installationKey: key,
        asOf: '2026-01-02T00:00:00.000Z',
        targetFactory: paths.factory,
        primaryRandomBytes: entropy(21),
        replayRandomBytes: entropy(22),
      }))
      expect(paths.state.accepted).toBeUndefined()
      expect(paths.records.get('primary')!.discardCount).toBeGreaterThan(0)
      expect(paths.records.get('replay')!.discardCount).toBeGreaterThan(0)
    } finally {
      held.exec('ROLLBACK')
      held.close()
      source.close()
      paths.cleanup()
    }
  })
})
