import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  createStorageV3ArtifactRoot,
  openStorageV3ArtifactRoot,
  registerSelectedStorageV3Artifact,
  storageV3WriterLeasePath,
  STORAGE_V3_ARTIFACT_LOCATORS,
} from './v3ArtifactCatalogue.js'
import {
  v3BackupTestSeams,
  type StorageV3BackupInput,
} from './v3Backup.js'
import {
  selectStorageV3Reader,
  v3ReaderSelectionTestSeams,
  type StorageV3ReaderSelectionInput,
} from './v3ReaderSelection.js'
import {
  completeStorageV3DeletionMaintenance,
  deleteStorageV3Scope,
} from './v3Deletion.js'
import { readStorageV3MigrationSelection } from './v3SelectionReceipt.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import { openSelectedStorageV3Store } from './v3StoreFiles.js'
import {
  taskInstallationKeyTestSeams,
  type TaskInstallationKeyHandle,
} from './taskInstallationKey.js'
import { withStorageV3WriterLease } from './v3WriterLease.js'

const SCOPE_A = `scope-${'a'.repeat(64)}`
const SCOPE_B = `scope-${'b'.repeat(64)}`
const BACKUP_ARTIFACT_ID = `art-${'1'.repeat(64)}`
const LEGACY_SOURCE_ID = `legacy-${'2'.repeat(64)}`
const BACKUP_AT = '2026-08-06T12:34:56Z'
const SUCCESS_AT = '2026-08-06T12:35:00.000Z'

type Fixture = Readonly<{
  workspaceRoot: string
  root: string
  key: TaskInstallationKeyHandle
  input: StorageV3ReaderSelectionInput
  selectedArtifactId: string
  cleanup(): void
}>

async function fixture(): Promise<Fixture> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'developer-lens-life03-selection-'))
  const taskId = 'invented-selection-task'
  const root = join(workspaceRoot, '.developer-lens', 'activation', taskId)
  mkdirSync(root, { recursive: true })
  const rootHandle = createStorageV3ArtifactRoot(root)
  const db = new Database(join(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
  try {
    installStorageV3ShadowSchema(db)
    db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_A)
    db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_B)
    registerSelectedStorageV3Artifact(db, rootHandle, () => Buffer.alloc(32, 3))
    const selectedArtifactId = db.prepare(
      "SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store' AND state = 'active'",
    ).pluck().get() as string
    const key = await taskInstallationKeyTestSeams.setupWithRandomBytes(
      { workspaceRoot, taskId },
      () => Buffer.alloc(32, 7),
    )
    const backupInput: StorageV3BackupInput = {
      db,
      root: rootHandle,
      backupAt: BACKUP_AT,
      artifactId: BACKUP_ARTIFACT_ID,
      ownerScopeIds: [SCOPE_A, SCOPE_B],
      installationKey: key,
    }
    await v3BackupTestSeams.createWithDirectorySynchronizer(backupInput, () => {})
    db.close()
    return Object.freeze({
      workspaceRoot,
      root,
      key,
      selectedArtifactId,
      input: Object.freeze({
        directory: root,
        legacySourceId: LEGACY_SOURCE_ID,
        successfulReportAt: SUCCESS_AT,
        backupArtifactId: BACKUP_ARTIFACT_ID,
        backupAt: BACKUP_AT,
        installationKey: key,
      }),
      cleanup: () => rmSync(workspaceRoot, { recursive: true, force: true }),
    })
  } catch (error) {
    if (db.open) db.close()
    rmSync(workspaceRoot, { recursive: true, force: true })
    throw error
  }
}

function expectSelected(result: ReturnType<typeof selectStorageV3Reader>): Extract<
  ReturnType<typeof selectStorageV3Reader>,
  { reader: 'sqlite-v3' }
> {
  if (result.reader !== 'sqlite-v3') {
    throw new Error(`expected invented v3 selection, received ${JSON.stringify(result)}`)
  }
  expect(result.reader).toBe('sqlite-v3')
  return result
}

describe('LIFE-03 atomic v3 reader selection', { timeout: 30_000 }, () => {
  it('selects only after final-backup proof and replays the immutable receipt exactly', async () => {
    const fx = await fixture()
    try {
      const first = expectSelected(selectStorageV3Reader(fx.input))
      expect(first.db.open).toBe(true)
      expect(first.db.readonly).toBe(true)
      expect(() => first.db.prepare('DELETE FROM claim_scope').run()).toThrow()
      expect(first.selection).toEqual({
        readerState: 'v3_selected',
        legacySourceId: LEGACY_SOURCE_ID,
        selectedArtifactId: fx.selectedArtifactId,
        backupArtifactId: BACKUP_ARTIFACT_ID,
        successfulReportAt: SUCCESS_AT,
        graceDeadlineAt: '2026-08-13T12:35:00.000Z',
      })
      first.db.close()

      const replay = expectSelected(selectStorageV3Reader(fx.input))
      expect(replay.selection).toEqual(first.selection)
      expect(replay.db.prepare('SELECT COUNT(*) FROM migration_selection_state').pluck().get()).toBe(1)
      replay.db.close()
    } finally { fx.cleanup() }
  })

  it('rolls back an interrupted receipt commit, closes the provisional handle, and resumes', async () => {
    const fx = await fixture()
    try {
      const interrupted = v3ReaderSelectionTestSeams.selectWithBeforeReceiptCommit(fx.input, () => {
        throw new Error('invented pre-commit interruption')
      })
      expect(interrupted).toEqual({ reader: 'legacy-json', code: 'v3-selection-receipt-refused' })
      expect(existsSync(storageV3WriterLeasePath(openStorageV3ArtifactRoot(fx.root)))).toBe(false)

      const reopened = openSelectedStorageV3Store(fx.root)
      expect(readStorageV3MigrationSelection(reopened)).toBeUndefined()
      reopened.close()

      const resumed = expectSelected(selectStorageV3Reader(fx.input))
      expect(resumed.selection.successfulReportAt).toBe(SUCCESS_AT)
      resumed.db.close()
    } finally { fx.cleanup() }
  })

  it('preserves the original success time and deadline instead of extending grace', async () => {
    const fx = await fixture()
    try {
      const first = expectSelected(selectStorageV3Reader(fx.input))
      first.db.close()
      expect(selectStorageV3Reader({
        ...fx.input,
        successfulReportAt: '2026-08-06T12:35:01.000Z',
      })).toEqual({ reader: 'unavailable', code: 'v3-selection-selected-refused' })

      const exact = expectSelected(selectStorageV3Reader(fx.input))
      expect(exact.selection.successfulReportAt).toBe(SUCCESS_AT)
      expect(exact.selection.graceDeadlineAt).toBe('2026-08-13T12:35:00.000Z')
      exact.db.close()
    } finally { fx.cleanup() }
  })

  it('replays sqlite-v3 after scope revocation removes the finalized backup', async () => {
    const fx = await fixture()
    try {
      const first = expectSelected(selectStorageV3Reader(fx.input))
      first.db.close()

      for (const [scopeId, byte] of [[SCOPE_A, 8], [SCOPE_B, 9]] as const) {
        const db = openSelectedStorageV3Store(fx.root)
        expect(deleteStorageV3Scope({
          db,
          scopeId,
          asOf: '2026-08-06T12:40:00.000Z',
          randomBytes: () => Buffer.alloc(32, byte),
        }).maintenance).toBe('pending')
        expect(completeStorageV3DeletionMaintenance(db).maintenance).toBe('complete')
        db.close()
      }

      expect(existsSync(join(fx.root, 'migration-backup-20260806123456.sqlite'))).toBe(false)
      const replay = expectSelected(selectStorageV3Reader(fx.input))
      expect(replay.db.prepare('SELECT scope_id FROM claim_scope').pluck().all()).toEqual([])
      replay.db.close()
    } finally { fx.cleanup() }
  })

  it('returns content-free fallback codes for request, root, lease, store, and backup refusal', async () => {
    const fx = await fixture()
    try {
      const syntheticLegacy = join(fx.workspaceRoot, 'invented-legacy.json')
      writeFileSync(syntheticLegacy, '{"invented":true}', 'utf8')
      expect(selectStorageV3Reader({
        ...fx.input,
        legacyPath: syntheticLegacy,
      } as StorageV3ReaderSelectionInput)).toEqual({
        reader: 'legacy-json',
        code: 'v3-selection-request-invalid',
      })
      expect(readFileSync(syntheticLegacy, 'utf8')).toBe('{"invented":true}')

      expect(selectStorageV3Reader({ ...fx.input, directory: join(fx.root, 'absent') })).toEqual({
        reader: 'legacy-json',
        code: 'v3-selection-root-refused',
      })

      const rootHandle = openStorageV3ArtifactRoot(fx.root)
      withStorageV3WriterLease(rootHandle, () => {
        expect(selectStorageV3Reader(fx.input)).toEqual({
          reader: 'legacy-json',
          code: 'v3-selection-lease-refused',
        })
      })

      expect(selectStorageV3Reader({
        ...fx.input,
        backupArtifactId: `art-${'f'.repeat(64)}`,
      })).toEqual({ reader: 'legacy-json', code: 'v3-selection-backup-refused' })

      const selected = expectSelected(selectStorageV3Reader(fx.input))
      selected.db.close()
    } finally { fx.cleanup() }

    const storeFx = await fixture()
    try {
      const raw = new Database(join(storeFx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
      raw.pragma('user_version = 999')
      raw.close()
      expect(selectStorageV3Reader(storeFx.input)).toEqual({
        reader: 'legacy-json',
        code: 'v3-selection-store-refused',
      })
    } finally { storeFx.cleanup() }
  })
})
