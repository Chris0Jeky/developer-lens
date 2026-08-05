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
  replayNormalizedShadowChecksum,
  StorageV3ShadowMigrationError,
  type StorageV3ShadowTargetAttempt,
} from './v3ShadowMigration.js'
import {
  STORAGE_V3_SHADOW_REWRITE_STAGES,
  STORAGE_V3_SHADOW_TABLES,
  rewriteStorageV3Shadow,
} from './v3ShadowRewrite.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'

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
  db.prepare('INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, 0, 0, 0)')
    .run(provider, analytical)
  db.prepare('INSERT INTO commit_observation (repository_provider_id, sha, occurred_at, source, feature_type, is_revert, is_fixup, message_length) VALUES (?, ?, ?, ?, ?, 0, 0, 1)')
    .run(provider, 'invented-sha', '2026-01-01T00:00:00.000Z', 'github', 'feat')
  return { db, key, raw }
}

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
      expect(replayNormalizedShadowChecksum(accepted.db)).toBe(result.checksum)
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
    } finally { source.close(); paths.cleanup() }
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

function checksumFixture(
  scope: string,
  rows: ReadonlyArray<readonly [string, string, number]>,
): Database.Database {
  const db = new Database(':memory:')
  installStorageV3ShadowSchema(db)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(scope)
  for (const [observationId, featureType, additions] of rows) {
    db.prepare(`INSERT INTO commit_observation (
      scope_id, observation_id, additions, feature_type, is_revert, is_fixup, message_length
    ) VALUES (?, ?, ?, ?, 0, 0, 1)`).run(scope, observationId, additions, featureType)
  }
  return db
}

function insertChecksumClaim(db: Database.Database, scope: string, createdAt: string | null): void {
  db.prepare(`INSERT INTO claim (
    scope_id, claim_id, layer, statement_code, method_id, method_version,
    window_start, window_end, schema_version, claim_id_material_version, created_at
  ) VALUES (?, ?, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', ?, ?, '1.0.0', 'claim-id.v3', ?)`)
    .run(
      scope,
      `cl_${'7'.repeat(64)}`,
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      createdAt,
    )
}

describe('B1b-iii C1 replay checksum', () => {
  it('is invariant to fresh C2 IDs, C2 values, and row insertion order', () => {
    const first = checksumFixture(`scope-${'1'.repeat(64)}`, [
      [`obs-${'2'.repeat(64)}`, 'feat', 1],
      [`obs-${'3'.repeat(64)}`, 'fix', 2],
    ])
    const second = checksumFixture(`scope-${'4'.repeat(64)}`, [
      [`obs-${'6'.repeat(64)}`, 'fix', 2],
      [`obs-${'5'.repeat(64)}`, 'feat', 1],
    ])
    try {
      second.prepare(`UPDATE commit_observation SET
        sha = 'invented-c2-sha', occurred_at = '2026-01-01T00:00:00.000Z',
        source = 'local-git', c2_expires_at = '2027-02-01T00:00:00.000Z'`).run()
      expect(replayNormalizedShadowChecksum(second)).toBe(replayNormalizedShadowChecksum(first))
    } finally { first.close(); second.close() }
  })

  it('changes for a semantic C1 difference', () => {
    const first = checksumFixture(`scope-${'1'.repeat(64)}`, [
      [`obs-${'2'.repeat(64)}`, 'feat', 1],
    ])
    const second = checksumFixture(`scope-${'3'.repeat(64)}`, [
      [`obs-${'4'.repeat(64)}`, 'feat', 2],
    ])
    try {
      expect(replayNormalizedShadowChecksum(second)).not.toBe(replayNormalizedShadowChecksum(first))
    } finally { first.close(); second.close() }
  })

  it('keeps claim IDs and C1 checksum stable when only C2 claim provenance changes or expires', () => {
    const scope = `scope-${'1'.repeat(64)}`
    const first = checksumFixture(scope, [])
    const second = checksumFixture(scope, [])
    const cleared = checksumFixture(scope, [])
    try {
      insertChecksumClaim(first, scope, '2025-01-31T12:00:00.000Z')
      insertChecksumClaim(second, scope, '2025-02-01T12:00:00.000Z')
      insertChecksumClaim(cleared, scope, null)
      const checksum = replayNormalizedShadowChecksum(first)
      expect(replayNormalizedShadowChecksum(second)).toBe(checksum)
      expect(replayNormalizedShadowChecksum(cleared)).toBe(checksum)
      second.prepare('UPDATE claim SET layer = ?').run('hypothesis')
      expect(replayNormalizedShadowChecksum(second)).not.toBe(checksum)
    } finally {
      first.close()
      second.close()
      cleared.close()
    }
  })
})
