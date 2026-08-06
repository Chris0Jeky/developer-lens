import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { createStorageV3ArtifactRoot, STORAGE_V3_ARTIFACT_LOCATORS } from './v3ArtifactCatalogue.js'
import { createStorageV3MigrationBackup, StorageV3BackupError } from './v3Backup.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import { setupTaskInstallationKey, taskInstallationKeyTestSeams } from './taskInstallationKey.js'

const SCOPE_A = `scope-${'a'.repeat(64)}`
const SCOPE_B = `scope-${'b'.repeat(64)}`

async function fixture(): Promise<{ root: string; db: Database.Database; key: Awaited<ReturnType<typeof setupTaskInstallationKey>>; cleanup(): void }> {
  const root = mkdtempSync(join(tmpdir(), 'developer-lens-life03-backup-'))
  const rootHandle = createStorageV3ArtifactRoot(root)
  const db = new Database(join(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
  installStorageV3ShadowSchema(db)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_A)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_B)
  const { registerSelectedStorageV3Artifact } = await import('./v3ArtifactCatalogue.js')
  registerSelectedStorageV3Artifact(db, rootHandle, () => Buffer.alloc(32, 3))
  const taskId = 'invented-backup-task'
  mkdirSync(join(root, '.developer-lens', 'activation', taskId), { recursive: true })
  const key = await taskInstallationKeyTestSeams.setupWithRandomBytes({ workspaceRoot: root, taskId }, () => Buffer.alloc(32, 7))
  return { root, db, key, cleanup: () => { if (db.open) db.close(); rmSync(root, { recursive: true, force: true }) } }
}

describe('LIFE-03 timestamped selected-store backup', { timeout: 30_000 }, () => {
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
    } finally { fx.cleanup() }
  })

  it('refuses malformed timestamps and conflicting pre-existing files without exposing details', async () => {
    const fx = await fixture()
    try {
      const input = { db: fx.db, root: createStorageV3ArtifactRoot(fx.root), backupAt: '2026-08-06T12:34:56.000Z', artifactId: `art-${'2'.repeat(64)}`, ownerScopeIds: [SCOPE_A, SCOPE_B], installationKey: fx.key }
      await expect(createStorageV3MigrationBackup(input)).rejects.toBeInstanceOf(StorageV3BackupError)
      await expect(createStorageV3MigrationBackup({ ...input, backupAt: '2026-08-06T12:34:56Z', artifactId: `art-${'3'.repeat(64)}` })).resolves.toBeDefined()
      await expect(createStorageV3MigrationBackup({ ...input, backupAt: '2026-08-06T12:34:56Z', artifactId: `art-${'4'.repeat(64)}` })).rejects.toBeInstanceOf(StorageV3BackupError)
    } finally { fx.cleanup() }
  })
})
