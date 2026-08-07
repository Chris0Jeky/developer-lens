import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  STORAGE_V3_RESTORE_NORMALIZATION_STAGES,
  StorageV3RestoreError,
  STORAGE_V3_RESTORE_UNAVAILABLE,
  normalizeStorageV3RestoredSnapshot,
  restoreStorageV3SelectedStoreFromVerifiedSelection,
  v3RestorePublicationTestSeams,
  v3RestoreTestSeams,
  type StorageV3RestoreFromSelectionInput,
  type StorageV3RestoreSnapshotProof,
} from './v3Restore.js'
import {
  createStorageV3ArtifactRoot,
  openStorageV3ArtifactRoot,
  registerSelectedStorageV3Artifact,
  STORAGE_V3_ARTIFACT_LOCATORS,
  storageV3MaintenanceStatus,
} from './v3ArtifactCatalogue.js'
import { v3BackupTestSeams } from './v3Backup.js'
import {
  recordStorageV3MigrationSelectionWithInitialization,
  replayStorageV3MigrationSuccessReport,
  storageV3MigrationRootBinding,
  type StorageV3MigrationSelection,
} from './v3SelectionReceipt.js'
import {
  STORAGE_V3_SELECTION_PROOF_NAMES,
  StorageV3SelectionProofError,
  v3SelectionProofTestSeams,
  verifyStorageV3MigrationSelectionProof,
} from './v3SelectionProof.js'
import {
  STORAGE_V3_REVOCATION_REPLAY_NAMES,
  v3RevocationReplayTestSeams,
} from './v3RevocationReplay.js'
import { installStorageV3ShadowSchema, storageV3ArtifactManifestSha256, storageV3SelectedStoreContentSha256 } from './v3ShadowSchema.js'
import { taskInstallationKeyTestSeams } from './taskInstallationKey.js'
import { withStorageV3WriterLease } from './v3WriterLease.js'
import {
  registerStorageV3MigrationCleanup,
  STORAGE_V3_LEGACY_SOURCE_LOCATOR,
  v3MigrationCleanupTestSeams,
} from './v3MigrationCleanup.js'

const SCOPE_A = `scope-${'a'.repeat(64)}`
const SCOPE_B = `scope-${'b'.repeat(64)}`
const SELECTED = `art-${'1'.repeat(64)}`
const BACKUP = `art-${'2'.repeat(64)}`
const FINAL_LOCATOR = 'migration-backup-20260806T123456Z.sqlite'
const STAGED_LOCATOR = `${FINAL_LOCATOR}.tmp`
const INTENT = 'a'.repeat(64)
const POST_BACKUP_CLAIM = `cl_${'6'.repeat(64)}`

async function publicationFixture(options: Readonly<{
  interruptSelectionProof?: boolean
  revokeAfterBackup?: boolean
  addClaimAfterBackup?: boolean
  partialRevocationAfterBackup?: boolean
}> = {}): Promise<{
  root: string
  input: StorageV3RestoreFromSelectionInput
  selection: StorageV3MigrationSelection
  backupPath: string
  manifestPath: string
  backupBytes: Buffer
  manifestBytes: Buffer
  selectionProofBytes: Buffer
  close(): void
}> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'developer-lens-life03-restore-'))
  const taskId = 'invented-restore-task'
  const root = join(workspaceRoot, '.developer-lens', 'activation', taskId)
  mkdirSync(root, { recursive: true })
  const rootHandle = createStorageV3ArtifactRoot(root)
  const db = new Database(join(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
  try {
    installStorageV3ShadowSchema(db)
    db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_A)
    db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_B)
    const selectedArtifactId = registerSelectedStorageV3Artifact(db, rootHandle, () => Buffer.alloc(32, 3))
    db.prepare(`INSERT INTO commit_observation (
      scope_id, observation_id, sha, occurred_at, source, c2_expires_at,
      additions, deletions, files, parent_count, feature_type, is_revert, is_fixup, message_length
    ) VALUES (?, ?, NULL, NULL, NULL, NULL, 4, 2, 1, 1, 'docs', 0, 0, 18)`)
      .run(SCOPE_A, `obs-${'4'.repeat(64)}`)
    const installationKey = await taskInstallationKeyTestSeams.setupWithRandomBytes(
      { workspaceRoot, taskId },
      () => Buffer.alloc(32, 7),
    )
    const backupAt = '2026-08-06T12:35:05Z'
    const backup = await v3BackupTestSeams.createWithDirectorySynchronizer({
      db,
      root: rootHandle,
      backupAt,
      artifactId: `art-${'4'.repeat(64)}`,
      ownerScopeIds: [SCOPE_A, SCOPE_B],
      installationKey,
    }, () => {})
    writeFileSync(join(root, STORAGE_V3_LEGACY_SOURCE_LOCATOR), '{"invented":true}\n', { flag: 'wx' })
    registerStorageV3MigrationCleanup({
      db,
      root: rootHandle,
      legacySourceId: `legacy-${'5'.repeat(64)}`,
      installationKey,
    })
    const selection = withStorageV3WriterLease(rootHandle, (lease) => {
      const recorded = recordStorageV3MigrationSelectionWithInitialization(db, {
        legacySourceId: `legacy-${'5'.repeat(64)}`,
        selectedArtifactId,
        backupArtifactId: backup.artifactId,
        backupAt,
        taskId: installationKey.taskId,
        taskFingerprint: installationKey.fingerprint,
        rootBinding: storageV3MigrationRootBinding(root),
        successReportProof: replayStorageV3MigrationSuccessReport({
          legacySourceId: `legacy-${'5'.repeat(64)}`,
          selectedArtifactId,
          backupArtifactId: backup.artifactId,
          backupAt,
          taskId: installationKey.taskId,
          taskFingerprint: installationKey.fingerprint,
          rootBinding: storageV3MigrationRootBinding(root),
        }, '2026-08-06T12:40:00.000Z'),
      }, (pendingSelection, initializationGrant) => {
        v3RevocationReplayTestSeams.ensureWithDirectorySynchronizer(
          rootHandle,
          installationKey,
          pendingSelection,
          initializationGrant,
          lease,
          () => {},
        )
      })
      v3RevocationReplayTestSeams.commitInitializationWithDirectorySynchronizer(
        rootHandle,
        installationKey,
        recorded.selection,
        lease,
        () => {},
      )
      return recorded.selection
    })
    if (options.interruptSelectionProof === true) {
      try {
        v3SelectionProofTestSeams.publishWithDirectorySynchronizer(
          rootHandle, selection, installationKey, () => {}, 'finalLink',
        )
        throw new Error('expected invented selection-proof interruption')
      } catch (error) {
        if (!(error instanceof StorageV3SelectionProofError)) throw error
      }
    } else {
      v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(
        db,
        rootHandle,
        installationKey,
        () => {},
      )
    }
    const backupPath = join(root, backup.locator)
    const manifestPath = join(root, backup.manifestLocator)
    const backupBytes = readFileSync(backupPath)
    const manifestBytes = readFileSync(manifestPath)
    const selectionProofBytes = readFileSync(join(root, STORAGE_V3_SELECTION_PROOF_NAMES.final))
    if (options.addClaimAfterBackup === true) db.prepare(`INSERT INTO claim (
      scope_id, claim_id, layer, statement_code, method_id, method_version,
      window_start, window_end, schema_version, claim_id_material_version, created_at
    ) VALUES (?, ?, 'modelled', 'DELIVERY_FLOW', 'invented-method', '1.0.0',
      '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z',
      '1.0.0', 'claim-id.v3', '2026-02-01T00:00:00.000Z')`)
      .run(SCOPE_A, POST_BACKUP_CLAIM)
    db.close()
    if (options.revokeAfterBackup === true) {
      v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: root,
        installationKey,
        scopeId: SCOPE_A,
        asOf: '2026-08-06T13:00:00.000Z',
        randomBytes: () => Buffer.alloc(32, 9),
      }, () => {})
      // Simulate an old signed backup reappearing from an external filesystem
      // snapshot after revocation cleanup removed the app-controlled pair.
      writeFileSync(backupPath, backupBytes, { mode: 0o600 })
      writeFileSync(manifestPath, manifestBytes, { mode: 0o600 })
    }
    if (options.partialRevocationAfterBackup === true) {
      let interrupted = false
      expect(() => v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: root,
        installationKey,
        scopeId: SCOPE_A,
        asOf: '2026-08-06T13:00:00.000Z',
        randomBytes: () => Buffer.alloc(32, 9),
      }, (_root, stage) => {
        if (stage === 'headReplace' && !interrupted) {
          interrupted = true
          throw new Error('invented partial restore interruption')
        }
      }, undefined, 1)).toThrow('invented partial restore interruption')
    }
    unlinkSync(join(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
    return {
      root,
      selection,
      input: Object.freeze({
        directory: root,
        backupAt,
        backupArtifactId: backup.artifactId,
        installationKey,
        selectionProof: options.interruptSelectionProof === true
          ? v3SelectionProofTestSeams.verifyWithDirectorySynchronizer(rootHandle, installationKey, () => {})
          : verifyStorageV3MigrationSelectionProof(rootHandle, installationKey),
      }),
      backupPath,
      manifestPath,
      backupBytes,
      manifestBytes,
      selectionProofBytes,
      close: () => rmSync(workspaceRoot, { recursive: true, force: true }),
    }
  } catch (error) {
    if (db.open) db.close()
    rmSync(workspaceRoot, { recursive: true, force: true })
    throw error
  }
}

function freshRestoreInput(fx: Awaited<ReturnType<typeof publicationFixture>>): StorageV3RestoreFromSelectionInput {
  return Object.freeze({
    ...fx.input,
    selectionProof: verifyStorageV3MigrationSelectionProof(
      openStorageV3ArtifactRoot(fx.root),
      fx.input.installationKey,
    ),
  })
}

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
  ) VALUES (?, '11', '22', NULL, NULL, NULL)`)
    .run(BACKUP)
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
  it('refuses malformed publication requests with one non-legacy unavailable code', () => {
    const result = restoreStorageV3SelectedStoreFromVerifiedSelection({} as never)
    expect(result).toEqual({ reader: 'unavailable', code: STORAGE_V3_RESTORE_UNAVAILABLE })
  })

  it('refuses a caller-minted receipt in place of an opaque selection-proof handle', async () => {
    const fx = await publicationFixture()
    try {
      const result = v3RestorePublicationTestSeams.restoreWithSynchronizer({
        ...fx.input,
        selectionProof: fx.selection as never,
      }, () => {})
      expect(result).toEqual({ reader: 'unavailable', code: STORAGE_V3_RESTORE_UNAVAILABLE })
      expect(existsSync(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))).toBe(false)
      expect(readFileSync(join(fx.root, STORAGE_V3_SELECTION_PROOF_NAMES.final)))
        .toEqual(fx.selectionProofBytes)
      expect(readFileSync(fx.backupPath)).toEqual(fx.backupBytes)
    } finally { fx.close() }
  })

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

  it('refuses replay after the exact copied snapshot was already normalized', () => {
    const fx = fixture()
    try {
      normalizeStorageV3RestoredSnapshot(fx.proof)
      const normalized = fx.db.serialize()
      expectRefusal(() => normalizeStorageV3RestoredSnapshot(fx.proof))
      expect(fx.db.serialize()).toEqual(normalized)
    } finally { fx.close() }
  })

  it('copies, normalizes, selects, publishes, and reopens without mutating the backup pair', async () => {
    const fx = await publicationFixture()
    try {
      const syncs: string[] = []
      const stages: string[] = []
      const result = v3RestorePublicationTestSeams.restoreWithSynchronizer(
        fx.input,
        (_root, phase) => syncs.push(phase),
        (stage) => stages.push(stage),
      )
      expect(result.reader).toBe('sqlite-v3')
      expect(stages).toEqual([
        'claim', 'copy', 'normalize', 'tombstone-replay', 'receipt', 'link',
        'directory-sync', 'temp-unlink', 'readonly-reopen',
      ])
      if (result.reader !== 'sqlite-v3') throw new Error('expected restored reader')
      expect(result.selection).toEqual(fx.selection)
      expect(result.db.prepare('SELECT additions, deletions, files FROM commit_observation').get())
        .toEqual({ additions: 4, deletions: 2, files: 1 })
      expect(result.db.prepare('SELECT artifact_id, state FROM app_artifact').all())
        .toEqual([{ artifact_id: fx.selection.selectedArtifactId, state: 'active' }])
      expect(result.db.prepare('SELECT COUNT(*) FROM migration_backup_attempt').pluck().get()).toBe(0)
      result.db.close()

      const selectedPath = join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
      expect(existsSync(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary))).toBe(false)
      expect(statSync(selectedPath).ino).not.toBe(statSync(fx.backupPath).ino)
      expect(readFileSync(fx.backupPath)).toEqual(fx.backupBytes)
      expect(readFileSync(fx.manifestPath)).toEqual(fx.manifestBytes)
      expect(readFileSync(join(fx.root, STORAGE_V3_SELECTION_PROOF_NAMES.final)))
        .toEqual(fx.selectionProofBytes)
      expect(syncs).toEqual(['link', 'temp-unlink'])

      const replay = v3RestorePublicationTestSeams.restoreWithSynchronizer(
        freshRestoreInput(fx),
        (_root, phase) => syncs.push(`replay:${phase}`),
      )
      expect(replay.reader).toBe('sqlite-v3')
      if (replay.reader === 'sqlite-v3') replay.db.close()
      expect(syncs).toEqual(['link', 'temp-unlink', 'replay:temp-unlink'])
      expect(readFileSync(fx.backupPath)).toEqual(fx.backupBytes)
      expect(readFileSync(fx.manifestPath)).toEqual(fx.manifestBytes)
    } finally { fx.close() }
  })

  it('finalizes an authenticated proof pair and restores after the selected store is lost', async () => {
    const fx = await publicationFixture({ interruptSelectionProof: true })
    try {
      expect(existsSync(join(fx.root, STORAGE_V3_SELECTION_PROOF_NAMES.temp))).toBe(false)
      const restored = v3RestorePublicationTestSeams.restoreWithSynchronizer(fx.input, () => {})
      expect(restored.reader).toBe('sqlite-v3')
      if (restored.reader !== 'sqlite-v3') throw new Error('expected restored reader')
      expect(restored.selection).toEqual(fx.selection)
      restored.db.close()
      expect(readFileSync(fx.backupPath)).toEqual(fx.backupBytes)
      expect(readFileSync(fx.manifestPath)).toEqual(fx.manifestBytes)
      expect(readFileSync(join(fx.root, STORAGE_V3_SELECTION_PROOF_NAMES.final)))
        .toEqual(fx.selectionProofBytes)
    } finally { fx.close() }
  })

  it('rebuilds cleanup registration from the restore verifier and expires the retained pair', async () => {
    const fx = await publicationFixture()
    try {
      const preserved = new Map(readdirSync(fx.root)
        .filter((name) => name.startsWith('migration-selection-v1') || name.startsWith('revocation-replay-v1'))
        .map((name) => [name, readFileSync(join(fx.root, name))]))
      const restored = v3RestorePublicationTestSeams.restoreWithSynchronizer(fx.input, () => {})
      expect(restored.reader).toBe('sqlite-v3')
      if (restored.reader !== 'sqlite-v3') throw new Error('expected restored reader')
      expect(restored.db.prepare('SELECT phase FROM migration_cleanup_state').pluck().get()).toBe('ready')
      restored.db.close()

      expect(v3MigrationCleanupTestSeams.cleanupAtWithDirectorySynchronizer(
        { directory: fx.root, installationKey: fx.input.installationKey },
        '2026-08-13T12:40:00.000Z',
        () => {},
      )).toEqual({ status: 'complete' })
      expect(existsSync(fx.backupPath)).toBe(false)
      expect(existsSync(fx.manifestPath)).toBe(false)
      expect(existsSync(join(fx.root, STORAGE_V3_LEGACY_SOURCE_LOCATOR))).toBe(false)
      for (const [name, bytes] of preserved) expect(readFileSync(join(fx.root, name))).toEqual(bytes)
    } finally { fx.close() }
  })

  it('replays a later revocation before publishing an old signed backup', async () => {
    const fx = await publicationFixture({ revokeAfterBackup: true, addClaimAfterBackup: true })
    try {
      const result = v3RestorePublicationTestSeams.restoreWithSynchronizer(fx.input, () => {})
      expect(result.reader).toBe('sqlite-v3')
      if (result.reader !== 'sqlite-v3') throw new Error('expected restored reader')
      expect(result.db.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A))
        .toBeUndefined()
      expect(result.db.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_B))
        .toBeDefined()
      expect(result.db.prepare('SELECT 1 FROM commit_observation WHERE scope_id = ?').get(SCOPE_A))
        .toBeUndefined()
      expect(result.db.prepare(
        "SELECT operation_id, event_week FROM lineage_event WHERE subject_kind = 'scope' AND subject_id = ? AND event_kind = 'tombstone_cascade'",
      ).get(SCOPE_A)).toEqual({
        operation_id: `del-${'09'.repeat(32)}`,
        event_week: '2026-W32',
      })
      expect(result.db.prepare(
        "SELECT operation_id, event_week FROM lineage_event WHERE subject_kind = 'claim' AND subject_id = ? AND event_kind = 'tombstone_cascade'",
      ).get(POST_BACKUP_CLAIM)).toEqual({
        operation_id: `del-${'09'.repeat(32)}`,
        event_week: '2026-W32',
      })
      result.db.close()
      expect(readFileSync(fx.backupPath)).toEqual(fx.backupBytes)
      expect(readFileSync(fx.manifestPath)).toEqual(fx.manifestBytes)
      expect(readFileSync(join(fx.root, STORAGE_V3_SELECTION_PROOF_NAMES.final)))
        .toEqual(fx.selectionProofBytes)
    } finally { fx.close() }
  })

  it('refuses an old signed backup when the durable replay tail is missing', async () => {
    const fx = await publicationFixture({ revokeAfterBackup: true })
    try {
      const headPath = join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head)
      const headBytes = readFileSync(headPath)
      unlinkSync(join(fx.root, 'revocation-replay-v1-00000001.json'))

      expect(v3RestorePublicationTestSeams.restoreWithSynchronizer(fx.input, () => {}))
        .toEqual({ reader: 'unavailable', code: STORAGE_V3_RESTORE_UNAVAILABLE })
      expect(readFileSync(headPath)).toEqual(headBytes)
      expect(existsSync(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))).toBe(false)
    } finally { fx.close() }
  })

  it('refuses restore while a physically head-matched revocation group is incomplete', async () => {
    const fx = await publicationFixture({ partialRevocationAfterBackup: true })
    try {
      const headPath = join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head)
      const headBytes = readFileSync(headPath)
      expect(v3RestorePublicationTestSeams.restoreWithSynchronizer(fx.input, () => {}))
        .toEqual({ reader: 'unavailable', code: STORAGE_V3_RESTORE_UNAVAILABLE })
      expect(readFileSync(headPath)).toEqual(headBytes)
      expect(existsSync(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))).toBe(false)
    } finally { fx.close() }
  })

  it('does not accept an unsynchronized published pair on replay', async () => {
    const fx = await publicationFixture()
    try {
      const rejectLinkSync = (_root: unknown, phase: string): void => {
        if (phase === 'link') throw new Error('invented directory sync failure')
      }
      expect(v3RestorePublicationTestSeams.restoreWithSynchronizer(fx.input, rejectLinkSync as never))
        .toEqual({ reader: 'unavailable', code: STORAGE_V3_RESTORE_UNAVAILABLE })
      expect(existsSync(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))).toBe(true)
      expect(existsSync(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary))).toBe(true)
      expect(v3RestorePublicationTestSeams.restoreWithSynchronizer(freshRestoreInput(fx), rejectLinkSync as never))
        .toEqual({ reader: 'unavailable', code: STORAGE_V3_RESTORE_UNAVAILABLE })

      const recovered = v3RestorePublicationTestSeams.restoreWithSynchronizer(freshRestoreInput(fx), () => {})
      expect(recovered.reader).toBe('sqlite-v3')
      if (recovered.reader === 'sqlite-v3') recovered.db.close()
      expect(existsSync(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary))).toBe(false)
      expect(readFileSync(fx.backupPath)).toEqual(fx.backupBytes)
    } finally { fx.close() }
  })

  it('preserves a replacement temp and refuses when the link input changes', async () => {
    const fx = await publicationFixture()
    try {
      const tempPath = join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary)
      const replacement = Buffer.from('invented foreign restore temp')
      const result = v3RestorePublicationTestSeams.restoreWithSynchronizer(
        fx.input,
        () => {},
        (stage) => {
          if (stage !== 'link') return
          unlinkSync(tempPath)
          writeFileSync(tempPath, replacement, { flag: 'wx', mode: 0o600 })
        },
      )
      expect(result).toEqual({ reader: 'unavailable', code: STORAGE_V3_RESTORE_UNAVAILABLE })
      expect(existsSync(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))).toBe(false)
      expect(readFileSync(tempPath)).toEqual(replacement)
      expect(readFileSync(fx.backupPath)).toEqual(fx.backupBytes)
    } finally { fx.close() }
  })

  it('re-proves the exact published pair after link sync before removing its temp name', async () => {
    const fx = await publicationFixture()
    try {
      const tempPath = join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary)
      const replacement = Buffer.from('invented post-link replacement')
      const result = v3RestorePublicationTestSeams.restoreWithSynchronizer(
        fx.input,
        (_root, phase) => {
          if (phase !== 'link') return
          unlinkSync(tempPath)
          writeFileSync(tempPath, replacement, { flag: 'wx', mode: 0o600 })
        },
      )
      expect(result).toEqual({ reader: 'unavailable', code: STORAGE_V3_RESTORE_UNAVAILABLE })
      expect(readFileSync(tempPath)).toEqual(replacement)
      expect(existsSync(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))).toBe(true)
      expect(readFileSync(fx.backupPath)).toEqual(fx.backupBytes)
    } finally { fx.close() }
  })
})
