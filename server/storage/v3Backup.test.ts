import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import type { GithubCoreActivationGrant } from '../connectors/github/activationGrant.js'

// #151: production ships no grant issuer. The two anchored-reload success paths explicitly opt into
// a test-owned validator; all other calls delegate to the real default-deny validator.
const grantValidation = vi.hoisted(() => ({ acceptTestGrants: false }))
vi.mock('../connectors/github/activationGrant.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../connectors/github/activationGrant.js')>()
  return {
    ...actual,
    assertGithubCoreActivationGrant: (input: unknown): GithubCoreActivationGrant =>
      grantValidation.acceptTestGrants
        ? input as GithubCoreActivationGrant
        : actual.assertGithubCoreActivationGrant(input),
  }
})
import {
  beginStorageV3MigrationBackupArtifact,
  bindStorageV3MigrationBackupAttemptIdentity,
  createStorageV3ArtifactRoot,
  promoteStorageV3MigrationBackupArtifact,
  proveStorageV3MigrationBackupPublication,
  readStorageV3MigrationBackupAttempt,
  recordStorageV3MigrationBackupAttemptContentSha256,
  storageV3MigrationBackupManifest,
  storageV3WriterLeasePath,
  STORAGE_V3_ARTIFACT_LOCATORS,
  StorageV3ArtifactError,
} from './v3ArtifactCatalogue.js'
import {
  createStorageV3MigrationBackup as createNativeStorageV3MigrationBackup,
  STORAGE_V3_BACKUP_STAGES,
  StorageV3BackupError,
  v3BackupTestSeams,
  type StorageV3BackupDirectorySyncPhase,
  type StorageV3BackupInput,
  type StorageV3BackupStage,
} from './v3Backup.js'
import { completeStorageV3DeletionMaintenance, deleteStorageV3Scope } from './v3Deletion.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import {
  loadTaskInstallationKey,
  loadTaskInstallationKeyForGithubCoreGrant,
  setupTaskInstallationKey,
  taskInstallationKeyTestSeams,
} from './taskInstallationKey.js'

const SCOPE_A = `scope-${'a'.repeat(64)}`
const SCOPE_B = `scope-${'b'.repeat(64)}`
const SCOPE_C = `scope-${'c'.repeat(64)}`

const noOpDirectorySynchronizer = (_phase: StorageV3BackupDirectorySyncPhase): void => {}

function createStorageV3MigrationBackup(
  input: StorageV3BackupInput,
  synchronizer = noOpDirectorySynchronizer,
) {
  return v3BackupTestSeams.createWithDirectorySynchronizer(input, synchronizer)
}

const recoverStorageV3MigrationBackup = createStorageV3MigrationBackup

async function fixture(taskId = 'invented-backup-task'): Promise<{ workspaceRoot: string; taskId: string; root: string; db: Database.Database; key: Awaited<ReturnType<typeof setupTaskInstallationKey>>; cleanup(): void }> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'developer-lens-life03-backup-'))
  const root = join(workspaceRoot, '.developer-lens', 'activation', taskId)
  mkdirSync(root, { recursive: true })
  const rootHandle = createStorageV3ArtifactRoot(root)
  const db = new Database(join(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
  installStorageV3ShadowSchema(db)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_A)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_B)
  const { registerSelectedStorageV3Artifact } = await import('./v3ArtifactCatalogue.js')
  registerSelectedStorageV3Artifact(db, rootHandle, () => Buffer.alloc(32, 3))
  const key = await taskInstallationKeyTestSeams.setupWithRandomBytes({ workspaceRoot, taskId }, () => Buffer.alloc(32, 7))
  return { workspaceRoot, taskId, root, db, key, cleanup: () => { if (db.open) db.close(); rmSync(workspaceRoot, { recursive: true, force: true }) } }
}

function inventedGrant(taskId: string, fingerprint: string): GithubCoreActivationGrant {
  return Object.freeze({
    capabilityId: 'github.core',
    taskId,
    taskCardSha256: 'a'.repeat(64),
    installationKeyFingerprint: fingerprint,
    scopeAlias: `repo-${'c'.repeat(64)}`,
  })
}

async function withTestGrant<T>(operation: () => Promise<T>): Promise<T> {
  grantValidation.acceptTestGrants = true
  try {
    return await operation()
  } finally {
    grantValidation.acceptTestGrants = false
  }
}

describe('LIFE-03 timestamped selected-store backup', { timeout: 30_000 }, () => {
  it.skipIf(process.platform !== 'win32')('fails closed before intent or bytes when native directory durability is unsupported', async () => {
    const fx = await fixture()
    try {
      const root = createStorageV3ArtifactRoot(fx.root)
      await expect(createNativeStorageV3MigrationBackup({
        db: fx.db,
        root,
        backupAt: '2026-08-06T12:34:55Z',
        artifactId: `art-${'0'.repeat(64)}`,
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: fx.key,
      })).rejects.toMatchObject({
        code: 'STORAGE_V3_BACKUP_INVALID',
        message: 'STORAGE_V3_BACKUP_INVALID',
      })
      expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(0)
      expect(existsSync(join(fx.root, 'migration-backup-20260806T123455Z.sqlite.tmp'))).toBe(false)
      expect(existsSync(storageV3WriterLeasePath(root))).toBe(false)
    } finally { fx.cleanup() }
  })

  it.skipIf(process.platform === 'win32')('proves the native POSIX directory-sync path with invented files', async () => {
    const fx = await fixture()
    try {
      await expect(createNativeStorageV3MigrationBackup({
        db: fx.db,
        root: createStorageV3ArtifactRoot(fx.root),
        backupAt: '2026-08-06T12:34:55Z',
        artifactId: `art-${'0'.repeat(64)}`,
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: fx.key,
      })).resolves.toMatchObject({ locator: 'migration-backup-20260806T123455Z.sqlite' })
    } finally { fx.cleanup() }
  })

  it('backs up through SQLite backup API and preserves invented C1 rows', async () => {
    const fx = await fixture()
    try {
      const result = await createStorageV3MigrationBackup({
        db: fx.db,
        root: createStorageV3ArtifactRoot(fx.root),
        backupAt: '2026-08-06T12:34:56Z',
        artifactId: `art-${'1'.repeat(64)}`,
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: fx.key,
      })
      expect(result.locator).toBe('migration-backup-20260806T123456Z.sqlite')
      expect(existsSync(join(fx.root, result.locator))).toBe(true)
      expect(existsSync(join(fx.root, result.manifestLocator))).toBe(true)
      const manifest = JSON.parse(readFileSync(join(fx.root, result.manifestLocator), 'utf8')) as Record<string, unknown>
      expect(manifest).toMatchObject({ version: 'migration_backup_v1', artifactId: `art-${'1'.repeat(64)}`, ownerScopeIds: [SCOPE_A, SCOPE_B] })
      expect(manifest.selectedArtifactId).not.toBe(manifest.artifactId)
      const backup = new Database(join(fx.root, result.locator), { fileMustExist: true })
      expect(backup.prepare('SELECT scope_id FROM claim_scope ORDER BY scope_id').pluck().all()).toEqual([SCOPE_A, SCOPE_B])
      backup.close()
      expect(fx.db.prepare('SELECT kind, content_sha256, manifest_sha256 FROM app_artifact WHERE artifact_id = ?').get(result.artifactId)).toMatchObject({ kind: 'migration_backup_v1', content_sha256: result.contentSha256, manifest_sha256: result.manifestSha256 })
      expect(fx.db.prepare('SELECT 1 FROM migration_backup_attempt WHERE artifact_id = ?').get(result.artifactId)).toBeUndefined()
      expect(() => fx.db.prepare(`INSERT OR REPLACE INTO app_artifact (
          artifact_id, kind, state, manifest_sha256, content_sha256, relative_locator
        ) VALUES (?, 'migration_backup_v1', 'active', ?, ?, ?)`)
        .run(
          `art-${'2'.repeat(64)}`,
          'e'.repeat(64),
          'f'.repeat(64),
          'migration-backup-20260806T123455Z.sqlite',
        )).toThrow(/STORAGE_V3_ARTIFACT_INVALID/)
      expect(fx.db.prepare("SELECT artifact_id FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().all())
        .toEqual([result.artifactId])
    } finally { fx.cleanup() }
  })

  it('refuses malformed timestamps and conflicting pre-existing files without exposing details', async () => {
    const fx = await fixture()
    try {
      const input = { db: fx.db, root: createStorageV3ArtifactRoot(fx.root), backupAt: '2026-08-06T12:34:56.000Z', artifactId: `art-${'2'.repeat(64)}`, ownerScopeIds: [SCOPE_A, SCOPE_B], installationKey: fx.key }
      await expect(createStorageV3MigrationBackup(input)).rejects.toBeInstanceOf(StorageV3BackupError)
      const first = { ...input, backupAt: '2026-08-06T12:34:56Z', artifactId: `art-${'3'.repeat(64)}` }
      await expect(createStorageV3MigrationBackup(first)).resolves.toBeDefined()
      await expect(createStorageV3MigrationBackup(first)).resolves.toBeDefined()
      await expect(createStorageV3MigrationBackup({ ...first, artifactId: `art-${'4'.repeat(64)}` })).rejects.toBeInstanceOf(StorageV3BackupError)
      const retry = { ...first, backupAt: '2026-08-06T12:34:57Z', artifactId: `art-${'5'.repeat(64)}` }
      await expect(createStorageV3MigrationBackup(retry)).rejects.toBeInstanceOf(StorageV3BackupError)
      expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(1)
      for (const suffix of ['', '.tmp', '.manifest.json', '.tmp.manifest.json']) {
        expect(existsSync(join(fx.root, `migration-backup-20260806T123457Z.sqlite${suffix}`))).toBe(false)
      }
    } finally { fx.cleanup() }
  })

  it('refuses an owner subset before cataloguing or writing backup bytes', async () => {
    const fx = await fixture()
    try {
      const locator = 'migration-backup-20260806T123500Z.sqlite'
      await expect(createStorageV3MigrationBackup({
        db: fx.db,
        root: createStorageV3ArtifactRoot(fx.root),
        backupAt: '2026-08-06T12:35:00Z',
        artifactId: `art-${'6'.repeat(64)}`,
        ownerScopeIds: [SCOPE_A],
        installationKey: fx.key,
      })).rejects.toBeInstanceOf(StorageV3BackupError)
      expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(0)
      for (const suffix of ['', '.tmp', '.manifest.json', '.tmp.manifest.json']) {
        expect(existsSync(join(fx.root, `${locator}${suffix}`))).toBe(false)
      }
    } finally { fx.cleanup() }
  })

  it('requires an opaque continuity-authorized key before staging and accepts an anchored reload', async () => {
    const fx = await fixture('Upper_Backup_Task')
    try {
      const input = {
        db: fx.db,
        root: createStorageV3ArtifactRoot(fx.root),
        backupAt: '2026-08-06T12:35:00Z',
        artifactId: `art-${'6'.repeat(64)}`,
        ownerScopeIds: [SCOPE_A, SCOPE_B],
      }
      const ordinary = await loadTaskInstallationKey({ workspaceRoot: fx.workspaceRoot, taskId: fx.taskId })
      await expect(createStorageV3MigrationBackup({ ...input, installationKey: ordinary })).rejects
        .toBeInstanceOf(StorageV3BackupError)
      expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(0)
      for (const suffix of ['', '.tmp', '.manifest.json', '.tmp.manifest.json']) {
        expect(existsSync(join(fx.root, `migration-backup-20260806T123500Z.sqlite${suffix}`))).toBe(false)
      }

      const anchored = await withTestGrant(() => loadTaskInstallationKeyForGithubCoreGrant({
        workspaceRoot: fx.workspaceRoot,
        grant: inventedGrant(fx.taskId, fx.key.fingerprint),
      }))
      await expect(createStorageV3MigrationBackup({ ...input, installationKey: anchored })).resolves.toMatchObject({
        locator: 'migration-backup-20260806T123500Z.sqlite',
      })
    } finally { fx.cleanup() }
  })

  it('does not let a copied replacement-key fingerprint authorize backup effects', async () => {
    const fx = await fixture()
    try {
      writeFileSync(join(fx.root, 'installation-key.bin'), Buffer.alloc(32, 12), { mode: 0o600 })
      const replacement = await loadTaskInstallationKey({
        workspaceRoot: fx.workspaceRoot,
        taskId: fx.taskId,
      })
      const copiedFingerprint = await loadTaskInstallationKey({
        workspaceRoot: fx.workspaceRoot,
        taskId: fx.taskId,
        expectedFingerprint: replacement.fingerprint,
      })
      await expect(createStorageV3MigrationBackup({
        db: fx.db,
        root: createStorageV3ArtifactRoot(fx.root),
        backupAt: '2026-08-06T12:35:02Z',
        artifactId: `art-${'8'.repeat(64)}`,
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: copiedFingerprint,
      })).rejects.toBeInstanceOf(StorageV3BackupError)
      expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(0)
      expect(existsSync(join(fx.root, 'migration-backup-20260806T123502Z.sqlite.tmp'))).toBe(false)
    } finally { fx.cleanup() }
  })

  it('refuses an unanchored handle at the direct manifest seam', async () => {
    const fx = await fixture()
    try {
      const ordinary = await loadTaskInstallationKey({ workspaceRoot: fx.workspaceRoot, taskId: fx.taskId })
      const selectedArtifactId = fx.db.prepare(
        "SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store'",
      ).pluck().get() as string
      expect(() => storageV3MigrationBackupManifest({
        locator: 'migration-backup-20260806T123500Z.sqlite',
        backupAt: '2026-08-06T12:35:00Z',
        artifactId: `art-${'6'.repeat(64)}`,
        selectedArtifactId,
        contentSha256: 'a'.repeat(64),
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: ordinary,
      })).toThrow('INVALID_TASK_INSTALLATION_KEY')
      expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(0)
    } finally { fx.cleanup() }
  })

  it('requires continuity authorization before the direct intent seam can catalogue a backup', async () => {
    const fx = await fixture()
    try {
      const ordinary = await loadTaskInstallationKey({ workspaceRoot: fx.workspaceRoot, taskId: fx.taskId })
      expect(() => beginStorageV3MigrationBackupArtifact({
        db: fx.db,
        artifactId: `art-${'6'.repeat(64)}`,
        finalLocator: 'migration-backup-20260806T123500Z.sqlite',
        scopeIds: [SCOPE_A, SCOPE_B],
        installationKey: ordinary,
      })).toThrow(StorageV3ArtifactError)
      expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(0)

      const anchored = await withTestGrant(() => loadTaskInstallationKeyForGithubCoreGrant({
        workspaceRoot: fx.workspaceRoot,
        grant: inventedGrant(fx.taskId, fx.key.fingerprint),
      }))
      expect(beginStorageV3MigrationBackupArtifact({
        db: fx.db,
        artifactId: `art-${'6'.repeat(64)}`,
        finalLocator: 'migration-backup-20260806T123500Z.sqlite',
        scopeIds: [SCOPE_A, SCOPE_B],
        installationKey: anchored,
      })).toMatchObject({ stagedLocator: 'migration-backup-20260806T123500Z.sqlite.tmp' })
    } finally { fx.cleanup() }
  })

  it('snapshots the direct intent database instead of accepting an accessor-swapped root', async () => {
    const left = await fixture()
    const right = await fixture()
    try {
      let getterCalled = false
      let next = left.db
      const malicious = {
        artifactId: `art-${'6'.repeat(64)}`,
        finalLocator: 'migration-backup-20260806T123500Z.sqlite',
        scopeIds: [SCOPE_A, SCOPE_B],
        installationKey: left.key,
      } as Record<string, unknown>
      Object.defineProperty(malicious, 'db', {
        enumerable: true,
        get: () => {
          getterCalled = true
          const selected = next
          next = next === left.db ? right.db : left.db
          return selected
        },
      })
      expect(() => beginStorageV3MigrationBackupArtifact(
        malicious as unknown as Parameters<typeof beginStorageV3MigrationBackupArtifact>[0],
      )).toThrow(StorageV3ArtifactError)
      expect(getterCalled).toBe(false)
      for (const db of [left.db, right.db]) {
        expect(db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get())
          .toBe(0)
      }
    } finally { left.cleanup(); right.cleanup() }
  })

  it('binds a staged intent to the original installation-key fingerprint', async () => {
    const fx = await fixture()
    try {
      const input = {
        db: fx.db,
        root: createStorageV3ArtifactRoot(fx.root),
        backupAt: '2026-08-06T12:35:03Z',
        artifactId: `art-${'9'.repeat(64)}`,
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: fx.key,
      }
      await expect(createStorageV3MigrationBackup({
        ...input,
        failAfterStage: (stage) => { if (stage === 'intentCommitted') throw new Error('invented') },
      })).rejects.toBeInstanceOf(StorageV3BackupError)
      unlinkSync(join(fx.root, 'installation-key.bin'))
      const replacement = await taskInstallationKeyTestSeams.setupWithRandomBytes(
        { workspaceRoot: fx.workspaceRoot, taskId: fx.taskId },
        () => Buffer.alloc(32, 12),
      )
      expect(replacement.fingerprint).not.toBe(fx.key.fingerprint)
      await expect(recoverStorageV3MigrationBackup({ ...input, installationKey: replacement })).rejects
        .toBeInstanceOf(StorageV3BackupError)
      await expect(recoverStorageV3MigrationBackup(input)).rejects.toBeInstanceOf(StorageV3BackupError)
      const staged = fx.db.prepare(
        "SELECT content_sha256, manifest_sha256 FROM app_artifact WHERE kind = 'migration_backup_v1'",
      ).get() as { content_sha256: string; manifest_sha256: string }
      expect(staged.content_sha256).toBe(staged.manifest_sha256)
      expect(existsSync(join(fx.root, 'migration-backup-20260806T123503Z.sqlite'))).toBe(false)
    } finally { fx.cleanup() }
  })

  it('refuses forged and replacement-key handles before recovery can publish a staged intent', async () => {
    const fx = await fixture()
    try {
      const input = {
        db: fx.db,
        root: createStorageV3ArtifactRoot(fx.root),
        backupAt: '2026-08-06T12:35:01Z',
        artifactId: `art-${'7'.repeat(64)}`,
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: fx.key,
      }
      await expect(createStorageV3MigrationBackup({
        ...input,
        failAfterStage: (stage) => { if (stage === 'intentCommitted') throw new Error('invented') },
      })).rejects.toBeInstanceOf(StorageV3BackupError)
      const forged = Object.freeze({ ...fx.key })
      await expect(recoverStorageV3MigrationBackup({ ...input, installationKey: forged })).rejects
        .toBeInstanceOf(StorageV3BackupError)
      expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(1)

      writeFileSync(join(fx.root, 'installation-key.bin'), Buffer.alloc(32, 12), { mode: 0o600 })
      const replacement = await loadTaskInstallationKey({ workspaceRoot: fx.workspaceRoot, taskId: fx.taskId })
      await expect(recoverStorageV3MigrationBackup({ ...input, installationKey: replacement })).rejects
        .toBeInstanceOf(StorageV3BackupError)
      expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(1)
      await expect(recoverStorageV3MigrationBackup(input)).rejects.toBeInstanceOf(StorageV3BackupError)
    } finally { fx.cleanup() }
  })

  it('refuses a genuine installation key from another task root before staging', async () => {
    const left = await fixture()
    const right = await fixture()
    try {
      await expect(createStorageV3MigrationBackup({
        db: left.db,
        root: createStorageV3ArtifactRoot(left.root),
        backupAt: '2026-08-06T12:35:01Z',
        artifactId: `art-${'9'.repeat(64)}`,
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: right.key,
      })).rejects.toBeInstanceOf(StorageV3BackupError)
      expect(left.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(0)
      expect(existsSync(join(left.root, 'migration-backup-20260806T123501Z.sqlite.tmp'))).toBe(false)
    } finally {
      left.cleanup()
      right.cleanup()
    }
  })

  it('refuses publication without a single-use proof of the exact physical pair', async () => {
    const fx = await fixture()
    try {
      const artifactId = `art-${'8'.repeat(64)}`
      const finalLocator = 'migration-backup-20260806T123502Z.sqlite'
      const intent = beginStorageV3MigrationBackupArtifact({
        db: fx.db,
        artifactId,
        finalLocator,
        scopeIds: [SCOPE_A, SCOPE_B],
        installationKey: fx.key,
      })
      const selectedArtifactId = fx.db.prepare(
        "SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store'",
      ).pluck().get() as string

      expect(() => proveStorageV3MigrationBackupPublication({
        db: fx.db,
        artifactId,
        stagedLocator: intent.stagedLocator,
        finalLocator,
        backupAt: '2026-08-06T12:35:02Z',
        selectedArtifactId,
        contentSha256: 'c'.repeat(64),
        manifestSha256: 'd'.repeat(64),
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: fx.key,
      })).toThrow(StorageV3ArtifactError)
      expect(() => promoteStorageV3MigrationBackupArtifact({} as never)).toThrow(StorageV3ArtifactError)
      expect(fx.db.prepare(
        'SELECT relative_locator, content_sha256, manifest_sha256 FROM app_artifact WHERE artifact_id = ?',
      ).get(artifactId)).toEqual({
        relative_locator: intent.stagedLocator,
        content_sha256: intent.placeholderSha256,
        manifest_sha256: intent.placeholderSha256,
      })
    } finally { fx.cleanup() }
  })

  it('orders durable final names before promotion and durable cleanup after each exact unlink', async () => {
    const fx = await fixture()
    try {
      const artifactId = `art-${'4'.repeat(64)}`
      const locator = 'migration-backup-20260806T123555Z.sqlite'
      const phases: StorageV3BackupDirectorySyncPhase[] = []
      const result = await createStorageV3MigrationBackup({
        db: fx.db,
        root: createStorageV3ArtifactRoot(fx.root),
        backupAt: '2026-08-06T12:35:55Z',
        artifactId,
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: fx.key,
      }, (phase) => {
        phases.push(phase)
        const row = fx.db.prepare(
          'SELECT relative_locator FROM app_artifact WHERE artifact_id = ?',
        ).pluck().get(artifactId)
        if (phase === 'finalNames') {
          expect(row).toBe(`${locator}.tmp`)
          expect(existsSync(join(fx.root, locator))).toBe(true)
          expect(existsSync(join(fx.root, `${locator}.manifest.json`))).toBe(true)
          expect(existsSync(join(fx.root, `${locator}.tmp`))).toBe(true)
          expect(existsSync(join(fx.root, `${locator}.tmp.manifest.json`))).toBe(true)
        } else if (phase === 'sqliteTempRemoval') {
          expect(row).toBe(locator)
          expect(existsSync(join(fx.root, `${locator}.tmp`))).toBe(false)
          expect(existsSync(join(fx.root, `${locator}.tmp.manifest.json`))).toBe(true)
        } else {
          expect(row).toBe(locator)
          expect(existsSync(join(fx.root, `${locator}.tmp`))).toBe(false)
          expect(existsSync(join(fx.root, `${locator}.tmp.manifest.json`))).toBe(false)
        }
      })
      expect(result.locator).toBe(locator)
      expect(phases).toEqual(['finalNames', 'sqliteTempRemoval', 'manifestTempRemoval'])
    } finally { fx.cleanup() }
  })

  it.each([
    'finalNames',
    'sqliteTempRemoval',
    'manifestTempRemoval',
  ] as const)('recovers an invented process fault before %s directory sync without touching unrelated files', async (faultPhase) => {
    const fx = await fixture()
    try {
      const artifactId = `art-${'4'.repeat(64)}`
      const locator = 'migration-backup-20260806T123555Z.sqlite'
      const unrelated = join(fx.root, 'invented-unrelated.keep')
      const unrelatedBytes = Buffer.from('invented unrelated bytes', 'utf8')
      writeFileSync(unrelated, unrelatedBytes, { flag: 'wx', mode: 0o600 })
      const input = {
        db: fx.db,
        root: createStorageV3ArtifactRoot(fx.root),
        backupAt: '2026-08-06T12:35:55Z',
        artifactId,
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: fx.key,
      }
      await expect(createStorageV3MigrationBackup(input, (phase) => {
        if (phase === faultPhase) throw new Error('invented process fault')
      })).rejects.toBeInstanceOf(StorageV3BackupError)

      const publishedLocator = fx.db.prepare(
        'SELECT relative_locator FROM app_artifact WHERE artifact_id = ?',
      ).pluck().get(artifactId)
      if (faultPhase === 'finalNames') {
        expect(publishedLocator).toBe(`${locator}.tmp`)
        expect(existsSync(join(fx.root, `${locator}.tmp`))).toBe(true)
        expect(existsSync(join(fx.root, `${locator}.tmp.manifest.json`))).toBe(true)
      } else {
        expect(publishedLocator).toBe(locator)
        expect(existsSync(join(fx.root, `${locator}.tmp`))).toBe(false)
        expect(existsSync(join(fx.root, `${locator}.tmp.manifest.json`)))
          .toBe(faultPhase === 'sqliteTempRemoval')
      }
      expect(readFileSync(unrelated).equals(unrelatedBytes)).toBe(true)

      const recoveryPhases: StorageV3BackupDirectorySyncPhase[] = []
      const recovered = await recoverStorageV3MigrationBackup(input, (phase) => {
        recoveryPhases.push(phase)
      })
      expect(recovered.locator).toBe(locator)
      expect(existsSync(join(fx.root, `${locator}.tmp`))).toBe(false)
      expect(existsSync(join(fx.root, `${locator}.tmp.manifest.json`))).toBe(false)
      expect(readFileSync(unrelated).equals(unrelatedBytes)).toBe(true)
      expect(recoveryPhases.at(-2)).toBe('sqliteTempRemoval')
      expect(recoveryPhases.at(-1)).toBe('manifestTempRemoval')
    } finally { fx.cleanup() }
  })

  it('refuses to report cleanup complete if a temp name is replaced during directory sync', async () => {
    const fx = await fixture()
    try {
      const locator = 'migration-backup-20260806T123554Z.sqlite'
      const tempPath = join(fx.root, `${locator}.tmp`)
      const replacement = Buffer.from('invented replacement temp', 'utf8')
      const input = {
        db: fx.db,
        root: createStorageV3ArtifactRoot(fx.root),
        backupAt: '2026-08-06T12:35:54Z',
        artifactId: `art-${'d'.repeat(64)}`,
        ownerScopeIds: [SCOPE_A, SCOPE_B],
        installationKey: fx.key,
      }
      await expect(createStorageV3MigrationBackup(input, (phase) => {
        if (phase === 'sqliteTempRemoval') {
          writeFileSync(tempPath, replacement, { flag: 'wx', mode: 0o600 })
        }
      })).rejects.toBeInstanceOf(StorageV3BackupError)
      expect(readFileSync(tempPath).equals(replacement)).toBe(true)
      expect(fx.db.prepare(
        'SELECT relative_locator FROM app_artifact WHERE artifact_id = ?',
      ).pluck().get(input.artifactId)).toBe(locator)
      await expect(recoverStorageV3MigrationBackup(input)).rejects.toBeInstanceOf(StorageV3BackupError)
      expect(readFileSync(tempPath).equals(replacement)).toBe(true)
    } finally { fx.cleanup() }
  })

  it.each(STORAGE_V3_BACKUP_STAGES)('recovers after durable stage %s', async (stage) => {
    const fx = await fixture()
    let reopened: Database.Database | undefined
    try {
      const input = { db: fx.db, root: createStorageV3ArtifactRoot(fx.root), backupAt: '2026-08-06T12:35:56Z', artifactId: `art-${'5'.repeat(64)}`, ownerScopeIds: [SCOPE_A, SCOPE_B], installationKey: fx.key }
      await expect(createStorageV3MigrationBackup({ ...input, failAfterStage: (seen: StorageV3BackupStage) => { if (seen === stage) throw new Error('injected') } })).rejects.toBeInstanceOf(StorageV3BackupError)
      const locator = 'migration-backup-20260806T123556Z.sqlite'
      if (stage === 'intentCommitted') {
        const retry = { ...input, backupAt: '2026-08-06T12:35:57Z', artifactId: `art-${'6'.repeat(64)}` }
        await expect(createStorageV3MigrationBackup(retry)).rejects.toBeInstanceOf(StorageV3BackupError)
        expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(1)
        for (const suffix of ['', '.tmp', '.manifest.json', '.tmp.manifest.json']) {
          expect(existsSync(join(fx.root, `migration-backup-20260806T123557Z.sqlite${suffix}`))).toBe(false)
        }
      }
      if (stage === 'finalNamesDurable') {
        expect(fx.db.prepare(
          'SELECT relative_locator FROM app_artifact WHERE artifact_id = ?',
        ).pluck().get(input.artifactId)).toBe(`${locator}.tmp`)
      }
      if (stage === 'sqliteTempUnlinked') {
        expect(existsSync(join(fx.root, `${locator}.tmp`))).toBe(false)
        expect(existsSync(join(fx.root, `${locator}.tmp.manifest.json`))).toBe(true)
      } else if (stage === 'manifestTempUnlinked') {
        expect(existsSync(join(fx.root, `${locator}.tmp`))).toBe(false)
        expect(existsSync(join(fx.root, `${locator}.tmp.manifest.json`))).toBe(false)
      }
      if (stage !== 'intentCommitted') {
        fx.db.transaction(() => {
          fx.db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_C)
          const selectedArtifactId = fx.db.prepare(
            "SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store'",
          ).pluck().get() as string
          fx.db.prepare('INSERT INTO app_artifact_scope (artifact_id, scope_id) VALUES (?, ?)')
            .run(selectedArtifactId, SCOPE_C)
        })()
      }
      fx.db.close()
      reopened = new Database(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore), { fileMustExist: true })
      const recoveryInput = { ...input, db: reopened }
      const crashMarker = storageV3WriterLeasePath(input.root)
      writeFileSync(crashMarker, '', { flag: 'wx', mode: 0o600 })
      await expect(recoverStorageV3MigrationBackup(recoveryInput)).rejects.toBeInstanceOf(StorageV3BackupError)
      unlinkSync(crashMarker)
      const result = await recoverStorageV3MigrationBackup(recoveryInput)
      expect(result.locator).toBe(locator)
      expect(existsSync(join(fx.root, `${result.locator}.tmp`))).toBe(false)
      expect(existsSync(join(fx.root, `${result.locator}.tmp.manifest.json`))).toBe(false)
      expect(reopened.prepare('SELECT state, relative_locator FROM app_artifact WHERE artifact_id = ?').get(result.artifactId)).toEqual({ state: 'active', relative_locator: result.locator })
      const backup = new Database(join(fx.root, result.locator), { fileMustExist: true, readonly: true })
      expect(backup.prepare('SELECT scope_id FROM claim_scope ORDER BY scope_id').pluck().all()).toEqual([SCOPE_A, SCOPE_B])
      backup.close()
    } finally {
      if (reopened?.open) reopened.close()
      fx.cleanup()
    }
  })

  it.each([
    ['intentCommitted', 'final'] as const,
    ['manifestTempDurable', 'manifestTemp'] as const,
    ['sqliteFinalLinked', 'final'] as const,
  ])('preserves a conflicting staged path after %s', async (stage, endpoint) => {
    const fx = await fixture()
    try {
      const input = { db: fx.db, root: createStorageV3ArtifactRoot(fx.root), backupAt: '2026-08-06T12:36:56Z', artifactId: `art-${'7'.repeat(64)}`, ownerScopeIds: [SCOPE_A, SCOPE_B], installationKey: fx.key }
      await expect(createStorageV3MigrationBackup({ ...input, failAfterStage: (seen) => { if (seen === stage) throw new Error('injected') } })).rejects.toBeInstanceOf(StorageV3BackupError)
      const locator = 'migration-backup-20260806T123656Z.sqlite'
      const collisionPath = endpoint === 'manifestTemp'
        ? join(fx.root, `${locator}.tmp.manifest.json`)
        : join(fx.root, locator)
      if (existsSync(collisionPath)) unlinkSync(collisionPath)
      const collision = Buffer.from('invented staged collision', 'utf8')
      writeFileSync(collisionPath, collision, { flag: 'wx', mode: 0o600 })
      await expect(recoverStorageV3MigrationBackup(input)).rejects.toBeInstanceOf(StorageV3BackupError)
      expect(readFileSync(collisionPath).equals(collision)).toBe(true)
    } finally { fx.cleanup() }
  })

  it.each(STORAGE_V3_BACKUP_STAGES)('deletes a revoked-scope backup interrupted after %s', async (stage) => {
    const fx = await fixture()
    try {
      const input = { db: fx.db, root: createStorageV3ArtifactRoot(fx.root), backupAt: '2026-08-06T12:37:56Z', artifactId: `art-${'8'.repeat(64)}`, ownerScopeIds: [SCOPE_A, SCOPE_B], installationKey: fx.key }
      await expect(createStorageV3MigrationBackup({ ...input, failAfterStage: (seen) => { if (seen === stage) throw new Error('injected') } })).rejects.toBeInstanceOf(StorageV3BackupError)
      deleteStorageV3Scope({
        db: fx.db,
        scopeId: SCOPE_B,
        asOf: '2026-08-13T12:37:56.000Z',
        randomBytes: () => Buffer.alloc(32, 9),
      })
      const retryAfterPending = {
        db: fx.db,
        root: createStorageV3ArtifactRoot(fx.root),
        backupAt: '2026-08-06T12:37:57Z',
        artifactId: `art-${'9'.repeat(64)}`,
        ownerScopeIds: [SCOPE_A],
        installationKey: fx.key,
      }
      await expect(createStorageV3MigrationBackup(retryAfterPending)).rejects.toBeInstanceOf(StorageV3BackupError)
      expect(fx.db.prepare('SELECT state FROM app_artifact WHERE artifact_id = ?').pluck().get(input.artifactId)).toBe('pending')
      expect(() => completeStorageV3DeletionMaintenance(fx.db, {
        failAfterArtifactStage: (stage) => { if (stage === 'markedDeleting') throw new Error('injected') },
      })).toThrow()
      await expect(createStorageV3MigrationBackup(retryAfterPending)).rejects.toBeInstanceOf(StorageV3BackupError)
      expect(fx.db.prepare('SELECT state FROM app_artifact WHERE artifact_id = ?').pluck().get(input.artifactId)).toBe('deleting')
      expect(completeStorageV3DeletionMaintenance(fx.db)).toMatchObject({ maintenance: 'complete', artifactsDeleted: 1 })
      const locator = 'migration-backup-20260806T123756Z.sqlite'
      for (const suffix of ['', '.tmp', '.manifest.json', '.tmp.manifest.json']) {
        expect(existsSync(join(fx.root, `${locator}${suffix}`))).toBe(false)
      }
      expect(fx.db.prepare('SELECT 1 FROM app_artifact WHERE artifact_id = ?').get(input.artifactId)).toBeUndefined()
      const recreated = await createStorageV3MigrationBackup(retryAfterPending)
      expect(recreated.locator).toBe('migration-backup-20260806T123757Z.sqlite')
      expect(fx.db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(1)
    } finally { fx.cleanup() }
  })

  it('catalogues a crash attempt with closed, idempotent identity and hash bindings', async () => {
    const fx = await fixture()
    try {
      const artifactId = `art-${'a'.repeat(64)}`
      const finalLocator = 'migration-backup-20260806T124000Z.sqlite'
      beginStorageV3MigrationBackupArtifact({
        db: fx.db, artifactId, finalLocator, scopeIds: [SCOPE_A, SCOPE_B], installationKey: fx.key,
      })
      const context = { db: fx.db, artifactId, finalLocator, installationKey: fx.key }
      expect(readStorageV3MigrationBackupAttempt(context)).toEqual({
        artifactId, sqliteDev: null, sqliteIno: null, manifestDev: null, manifestIno: null, sqliteContentSha256: null,
      })
      expect(() => recordStorageV3MigrationBackupAttemptContentSha256({ ...context, contentSha256: 'b'.repeat(64) }))
        .toThrow(StorageV3ArtifactError)
      const bound = bindStorageV3MigrationBackupAttemptIdentity({ ...context, file: 'sqlite', dev: 12n, ino: 34n })
      expect(bound).toMatchObject({ sqliteDev: '12', sqliteIno: '34' })
      expect(bindStorageV3MigrationBackupAttemptIdentity({ ...context, file: 'sqlite', dev: 12n, ino: 34n })).toEqual(bound)
      expect(() => bindStorageV3MigrationBackupAttemptIdentity({ ...context, file: 'sqlite', dev: 12n, ino: 35n }))
        .toThrow(StorageV3ArtifactError)
      expect(readStorageV3MigrationBackupAttempt(context)).toEqual(bound)

      const hash = recordStorageV3MigrationBackupAttemptContentSha256({ ...context, contentSha256: 'b'.repeat(64) })
      expect(hash.sqliteContentSha256).toBe('b'.repeat(64))
      expect(recordStorageV3MigrationBackupAttemptContentSha256({ ...context, contentSha256: 'b'.repeat(64) })).toEqual(hash)
      expect(() => recordStorageV3MigrationBackupAttemptContentSha256({ ...context, contentSha256: 'c'.repeat(64) }))
        .toThrow(StorageV3ArtifactError)
      expect(fx.db.prepare('SELECT sqlite_dev, sqlite_ino, sqlite_content_sha256 FROM migration_backup_attempt').get())
        .toEqual({ sqlite_dev: '12', sqlite_ino: '34', sqlite_content_sha256: 'b'.repeat(64) })
    } finally { fx.cleanup() }
  })

  it('binds the manifest identity and rejects wrong or forged installation handles before mutation', async () => {
    const left = await fixture('attempt-left')
    const right = await fixture('attempt-right')
    try {
      const artifactId = `art-${'d'.repeat(64)}`
      const finalLocator = 'migration-backup-20260806T124001Z.sqlite'
      beginStorageV3MigrationBackupArtifact({
        db: left.db, artifactId, finalLocator, scopeIds: [SCOPE_A, SCOPE_B], installationKey: left.key,
      })
      const context = { db: left.db, artifactId, finalLocator, installationKey: left.key }
      expect(bindStorageV3MigrationBackupAttemptIdentity({ ...context, file: 'manifest', dev: 56n, ino: 78n }))
        .toMatchObject({ manifestDev: '56', manifestIno: '78' })
      expect(() => bindStorageV3MigrationBackupAttemptIdentity({ ...context, installationKey: right.key, file: 'sqlite', dev: 1n, ino: 2n }))
        .toThrow(StorageV3ArtifactError)
      expect(() => bindStorageV3MigrationBackupAttemptIdentity({ ...context, installationKey: Object.freeze({ ...left.key }), file: 'sqlite', dev: 1n, ino: 2n }))
        .toThrow(StorageV3ArtifactError)
      writeFileSync(join(left.workspaceRoot, '.developer-lens', 'activation', left.taskId, 'installation-key.bin'), Buffer.alloc(32, 12), { mode: 0o600 })
      const replaced = await loadTaskInstallationKey({ workspaceRoot: left.workspaceRoot, taskId: left.taskId })
      expect(() => bindStorageV3MigrationBackupAttemptIdentity({ ...context, installationKey: replaced, file: 'sqlite', dev: 1n, ino: 2n }))
        .toThrow(StorageV3ArtifactError)
      expect(left.db.prepare('SELECT sqlite_dev, sqlite_ino, manifest_dev, manifest_ino FROM migration_backup_attempt').get())
        .toEqual({ sqlite_dev: null, sqlite_ino: null, manifest_dev: '56', manifest_ino: '78' })
    } finally { left.cleanup(); right.cleanup() }
  })

  it('rejects accessors, missing keys, and extra keys without invoking getters or changing the row', async () => {
    const fx = await fixture()
    try {
      const artifactId = `art-${'e'.repeat(64)}`
      const finalLocator = 'migration-backup-20260806T124002Z.sqlite'
      beginStorageV3MigrationBackupArtifact({
        db: fx.db, artifactId, finalLocator, scopeIds: [SCOPE_A, SCOPE_B], installationKey: fx.key,
      })
      const base = { db: fx.db, artifactId, finalLocator, installationKey: fx.key }
      let getterCalled = false
      const accessor = { ...base, file: 'sqlite', dev: 1n, ino: 2n } as Record<string, unknown>
      Object.defineProperty(accessor, 'db', { enumerable: true, get: () => { getterCalled = true; return fx.db } })
      expect(() => bindStorageV3MigrationBackupAttemptIdentity(accessor as never)).toThrow(StorageV3ArtifactError)
      expect(getterCalled).toBe(false)
      expect(() => bindStorageV3MigrationBackupAttemptIdentity({ ...base, file: 'sqlite', dev: 1n, ino: 2n, extra: true } as never))
        .toThrow(StorageV3ArtifactError)
      expect(() => readStorageV3MigrationBackupAttempt({ db: fx.db, artifactId, finalLocator } as never))
        .toThrow(StorageV3ArtifactError)
      expect(() => recordStorageV3MigrationBackupAttemptContentSha256({ ...base, contentSha256: 'a'.repeat(64), extra: true } as never))
        .toThrow(StorageV3ArtifactError)
      expect(fx.db.prepare('SELECT sqlite_dev, sqlite_ino, manifest_dev, manifest_ino, sqlite_content_sha256 FROM migration_backup_attempt').get())
        .toEqual({ sqlite_dev: null, sqlite_ino: null, manifest_dev: null, manifest_ino: null, sqlite_content_sha256: null })
    } finally { fx.cleanup() }
  })

  it('refuses a staged row whose placeholder is not the PR159 v2 intent before mutation', async () => {
    const fx = await fixture()
    try {
      const artifactId = `art-${'f'.repeat(64)}`
      const finalLocator = 'migration-backup-20260806T124003Z.sqlite'
      beginStorageV3MigrationBackupArtifact({
        db: fx.db, artifactId, finalLocator, scopeIds: [SCOPE_A, SCOPE_B], installationKey: fx.key,
      })
      const context = { db: fx.db, artifactId, finalLocator, installationKey: fx.key }
      const wrongIntent = { ...context, finalLocator: 'migration-backup-20260806T124004Z.sqlite' }
      expect(() => readStorageV3MigrationBackupAttempt(wrongIntent)).toThrow(StorageV3ArtifactError)
      expect(() => bindStorageV3MigrationBackupAttemptIdentity({ ...wrongIntent, file: 'sqlite', dev: 1n, ino: 2n }))
        .toThrow(StorageV3ArtifactError)
      expect(fx.db.prepare('SELECT sqlite_dev, sqlite_ino FROM migration_backup_attempt').get())
        .toEqual({ sqlite_dev: null, sqlite_ino: null })
    } finally { fx.cleanup() }
  })
})
