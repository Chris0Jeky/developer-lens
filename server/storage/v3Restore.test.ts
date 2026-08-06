import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  STORAGE_V3_RESTORE_NORMALIZATION_STAGES,
  StorageV3RestoreError,
  normalizeStorageV3RestoredSnapshot,
  v3RestoreTestSeams,
  type StorageV3RestoreSnapshotProof,
} from './v3Restore.js'
import {
  STORAGE_V3_ARTIFACT_LOCATORS,
  storageV3MaintenanceStatus,
} from './v3ArtifactCatalogue.js'
import { installStorageV3ShadowSchema, storageV3ArtifactManifestSha256, storageV3SelectedStoreContentSha256 } from './v3ShadowSchema.js'

const SCOPE_A = `scope-${'a'.repeat(64)}`
const SCOPE_B = `scope-${'b'.repeat(64)}`
const SELECTED = `art-${'1'.repeat(64)}`
const BACKUP = `art-${'2'.repeat(64)}`
const FINAL_LOCATOR = 'migration-backup-20260806T123456Z.sqlite'
const STAGED_LOCATOR = `${FINAL_LOCATOR}.tmp`
const INTENT = 'a'.repeat(64)

function fixture(): { db: Database.Database; proof: StorageV3RestoreSnapshotProof; close(): void } {
  const db = new Database(':memory:')
  installStorageV3ShadowSchema(db)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_A)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_B)
  db.prepare(`INSERT INTO app_artifact (
    artifact_id, kind, state, manifest_sha256, content_sha256, relative_locator
  ) VALUES (?, 'selected_store', 'active', ?, ?, ?)`)
    .run(SELECTED, storageV3ArtifactManifestSha256('selected_store', STORAGE_V3_ARTIFACT_LOCATORS.selectedStore), storageV3SelectedStoreContentSha256(), STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
  for (const scope of [SCOPE_A, SCOPE_B]) {
    db.prepare('INSERT INTO app_artifact_scope (artifact_id, scope_id) VALUES (?, ?)').run(SELECTED, scope)
  }
  db.prepare(`INSERT INTO app_artifact (
    artifact_id, kind, state, manifest_sha256, content_sha256, relative_locator
  ) VALUES (?, 'migration_backup_v1', 'active', ?, ?, ?)`)
    .run(BACKUP, INTENT, INTENT, STAGED_LOCATOR)
  for (const scope of [SCOPE_A, SCOPE_B]) {
    db.prepare('INSERT INTO app_artifact_scope (artifact_id, scope_id) VALUES (?, ?)').run(BACKUP, scope)
  }
  db.prepare(`INSERT INTO migration_backup_attempt (
    artifact_id, sqlite_dev, sqlite_ino, manifest_dev, manifest_ino, sqlite_content_sha256
  ) VALUES (?, '11', '22', '33', '44', ?)`)
    .run(BACKUP, 'b'.repeat(64))
  db.prepare(`INSERT INTO storage_maintenance_state (
    singleton, state, operation_id, scope_id, event_week
  ) VALUES (1, 'complete', NULL, NULL, NULL)`).run()
  db.prepare(`INSERT INTO lineage_event (
    scope_id, subject_kind, subject_id, operation_id, capability_id,
    caused_by, event_kind, event_week
  ) VALUES (NULL, 'artifact', ?, 'del-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'github.core', NULL, 'index_deleted', '2026-W31')`).run(`art-${'3'.repeat(64)}`)
  db.prepare(`INSERT INTO commit_observation (
    scope_id, observation_id, sha, occurred_at, source, c2_expires_at,
    additions, deletions, files, parent_count, feature_type, is_revert, is_fixup, message_length
  ) VALUES (?, 'obs-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'docs', 0, 0, 0)`).run(SCOPE_A)
  const proof = Object.freeze({
    db,
    artifactId: BACKUP,
    stagedLocator: STAGED_LOCATOR,
    finalLocator: FINAL_LOCATOR,
    backupAt: '2026-08-06T12:34:56Z',
    selectedArtifactId: SELECTED,
    ownerScopeIds: Object.freeze([SCOPE_A, SCOPE_B]),
    intentSha256: INTENT,
  })
  return { db, proof, close: () => { if (db.open) db.close() } }
}

function expectRefusal(run: () => unknown): void {
  expect(run).toThrowError(new StorageV3RestoreError())
}

describe('LIFE-03 restore snapshot normalization', () => {
  it('removes only the copied staged backup and preserves selected/observed/tombstone state', () => {
    const fx = fixture()
    try {
      const beforeObservation = fx.db.prepare('SELECT * FROM commit_observation').all()
      const beforeTombstone = fx.db.prepare("SELECT * FROM lineage_event WHERE event_kind = 'index_deleted'").all()
      const result = normalizeStorageV3RestoredSnapshot(fx.proof)
      expect(result).toMatchObject({ artifactId: BACKUP, maintenance: 'complete', eventWeek: '2026-W32' })
      expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(0)
      expect(fx.db.prepare('SELECT COUNT(*) FROM migration_backup_attempt').pluck().get()).toBe(0)
      expect(fx.db.prepare('SELECT scope_id FROM app_artifact_scope WHERE artifact_id = ? ORDER BY scope_id').pluck().all(SELECTED)).toEqual([SCOPE_A, SCOPE_B])
      expect(fx.db.prepare('SELECT artifact_id, state FROM app_artifact WHERE kind = \'selected_store\'').get()).toEqual({ artifact_id: SELECTED, state: 'active' })
      expect(fx.db.prepare('SELECT * FROM commit_observation').all()).toEqual(beforeObservation)
      expect(fx.db.prepare("SELECT * FROM lineage_event WHERE event_kind = 'index_deleted'").all()).toEqual(beforeTombstone)
      expect(storageV3MaintenanceStatus(fx.db)).toBe('complete')
    } finally { fx.close() }
  })

  it.each([
    ['wrong artifact', (fx: ReturnType<typeof fixture>) => Object.freeze({ ...fx.proof, artifactId: `art-${'9'.repeat(64)}` })],
    ['wrong locator', (fx: ReturnType<typeof fixture>) => Object.freeze({ ...fx.proof, finalLocator: 'migration-backup-20260806T123457Z.sqlite', stagedLocator: 'migration-backup-20260806T123457Z.sqlite.tmp' })],
    ['wrong intent', (fx: ReturnType<typeof fixture>) => Object.freeze({ ...fx.proof, intentSha256: 'f'.repeat(64) })],
    ['owner mismatch', (fx: ReturnType<typeof fixture>) => Object.freeze({ ...fx.proof, ownerScopeIds: Object.freeze([SCOPE_A]) })],
    ['selection already exists', (fx: ReturnType<typeof fixture>) => { fx.db.prepare(`INSERT INTO migration_selection_state (singleton, reader_state, legacy_source_id, selected_artifact_id, backup_artifact_id, successful_report_at, grace_deadline_at) VALUES (1, 'v3_selected', ?, ?, ?, '2026-08-01T00:00:00.000Z', '2026-08-08T00:00:00.000Z')`).run(`legacy-${'a'.repeat(64)}`, SELECTED, BACKUP); return fx.proof }],
  ] as const)('refuses %s without mutation', (_label, mutate) => {
    const fx = fixture()
    try {
      const before = fx.db.serialize()
      const candidate = mutate(fx)
      const mutated = fx.db.serialize()
      expectRefusal(() => normalizeStorageV3RestoredSnapshot(candidate))
      expect(fx.db.serialize()).toEqual(mutated)
      expect(fx.db.prepare('SELECT COUNT(*) FROM app_artifact WHERE kind = \'migration_backup_v1\'').pluck().get()).toBe(1)
      void before
    } finally { fx.close() }
  })

  it.each(STORAGE_V3_RESTORE_NORMALIZATION_STAGES)('rolls back byte-for-byte after %s', (stage) => {
    const fx = fixture()
    try {
      const before = fx.db.serialize()
      expectRefusal(() => v3RestoreTestSeams.normalizeWithFailure(fx.proof, (current) => {
        if (current === stage) throw new Error('invented restore interruption')
      }))
      expect(fx.db.serialize()).toEqual(before)
      expect(fx.db.prepare('SELECT state FROM app_artifact WHERE artifact_id = ?').pluck().get(BACKUP)).toBe('active')
      expect(fx.db.prepare('SELECT COUNT(*) FROM migration_backup_attempt').pluck().get()).toBe(1)
      expect(storageV3MaintenanceStatus(fx.db)).toBe('complete')
    } finally { fx.close() }
  })
})
