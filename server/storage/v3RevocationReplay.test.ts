import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  createStorageV3ArtifactRoot,
  openStorageV3ArtifactRoot,
  registerSelectedStorageV3Artifact,
  STORAGE_V3_ARTIFACT_LOCATORS,
} from './v3ArtifactCatalogue.js'
import { v3BackupTestSeams } from './v3Backup.js'
import { readStorageV3DeletionLineage } from './v3Deletion.js'
import {
  STORAGE_V3_REVOCATION_REPLAY_NAMES,
  StorageV3RevocationReplayError,
  assertStorageV3RevocationReplayApplied,
  resumeStorageV3RevocationReplay,
  v3RevocationReplayTestSeams,
  verifyStorageV3RevocationReplay,
} from './v3RevocationReplay.js'
import {
  recordStorageV3MigrationSelection,
  storageV3MigrationRootBinding,
  v3SelectionReceiptTestSeams,
  type StorageV3MigrationSelection,
} from './v3SelectionReceipt.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import { openSelectedStorageV3Store } from './v3StoreFiles.js'
import {
  taskInstallationKeyTestSeams,
  type TaskInstallationKeyHandle,
} from './taskInstallationKey.js'
import { withStorageV3WriterLease } from './v3WriterLease.js'

const SCOPE_A = `scope-${'a'.repeat(64)}`
const SCOPE_B = `scope-${'b'.repeat(64)}`
const BACKUP = `art-${'4'.repeat(64)}`
const BACKUP_AT = '2026-08-06T12:35:05Z'
const SUCCESS_AT = '2026-08-06T12:40:00.000Z'
const DELETE_AT = '2026-08-06T13:00:00.000Z'

type Fixture = Readonly<{
  workspaceRoot: string
  root: string
  taskId: string
  key: TaskInstallationKeyHandle
  selection: StorageV3MigrationSelection
  close(): void
}>

async function fixture(): Promise<Fixture> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'developer-lens-life03-revocation-'))
  const taskId = 'invented-repository-label'
  const root = join(workspaceRoot, '.developer-lens', 'activation', taskId)
  mkdirSync(root, { recursive: true })
  const rootHandle = createStorageV3ArtifactRoot(root)
  const db = new Database(join(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
  try {
    installStorageV3ShadowSchema(db)
    db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_A)
    db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_B)
    db.prepare(`INSERT INTO commit_observation (
      scope_id, observation_id, sha, occurred_at, source, c2_expires_at,
      additions, deletions, files, parent_count, feature_type, is_revert, is_fixup, message_length
    ) VALUES (?, ?, NULL, NULL, NULL, NULL, 5, 2, 1, 1, 'docs', 0, 0, 12)`).run(
      SCOPE_A,
      `obs-${'1'.repeat(64)}`,
    )
    const selectedArtifactId = registerSelectedStorageV3Artifact(db, rootHandle, () => Buffer.alloc(32, 3))
    const key = await taskInstallationKeyTestSeams.setupWithRandomBytes(
      { workspaceRoot, taskId },
      () => Buffer.alloc(32, 7),
    )
    const backup = await v3BackupTestSeams.createWithDirectorySynchronizer({
      db,
      root: rootHandle,
      backupAt: BACKUP_AT,
      artifactId: BACKUP,
      ownerScopeIds: [SCOPE_A, SCOPE_B],
      installationKey: key,
    }, () => {})
    const reportInput = Object.freeze({
      legacySourceId: `legacy-${'5'.repeat(64)}`,
      selectedArtifactId,
      backupArtifactId: backup.artifactId,
      backupAt: BACKUP_AT,
      taskId,
      taskFingerprint: key.fingerprint,
      rootBinding: storageV3MigrationRootBinding(root),
    })
    const selection = recordStorageV3MigrationSelection(db, {
      ...reportInput,
      successReportProof: v3SelectionReceiptTestSeams.issueSuccessReportAt(
        reportInput,
        SUCCESS_AT,
      ),
    }).selection
    db.close()
    return Object.freeze({
      workspaceRoot,
      root,
      taskId,
      key,
      selection,
      close: () => rmSync(workspaceRoot, { recursive: true, force: true }),
    })
  } catch (error) {
    if (db.open) db.close()
    rmSync(workspaceRoot, { recursive: true, force: true })
    throw error
  }
}

function deleteScope(
  fx: Fixture,
  failAfterStage?: Parameters<typeof v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer>[2],
) {
  return v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
    directory: fx.root,
    installationKey: fx.key,
    scopeId: SCOPE_A,
    asOf: DELETE_AT,
    randomBytes: () => Buffer.alloc(32, 9),
  }, () => {}, failAfterStage)
}

describe('LIFE-03 external revocation replay', { timeout: 30_000 }, () => {
  it('publishes content-free intent before deletion and replays exactly', async () => {
    const fx = await fixture()
    try {
      const first = deleteScope(fx)
      expect(first).toMatchObject({ replayEntries: 1, maintenance: 'complete' })
      const files = readdirSync(fx.root)
        .filter((name) => name.startsWith(STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix))
        .sort()
      expect(files).toEqual([
        STORAGE_V3_REVOCATION_REPLAY_NAMES.anchor,
        'revocation-replay-v1-00000001.json',
      ])
      const serialized = files.map((name) => readFileSync(join(fx.root, name), 'utf8')).join('\n')
      expect(serialized).not.toContain(fx.taskId)
      expect(serialized).not.toContain('repository-label')
      expect(serialized).not.toContain(fx.root)

      const selected = openSelectedStorageV3Store(fx.root)
      try {
        expect(selected.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A)).toBeUndefined()
        expect(selected.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_B)).toBeDefined()
        expect(selected.prepare('SELECT 1 FROM commit_observation WHERE scope_id = ?').get(SCOPE_A)).toBeUndefined()
        const lineage = readStorageV3DeletionLineage(selected)
        expect(lineage).toContainEqual(expect.objectContaining({
          subjectKind: 'scope',
          subjectId: SCOPE_A,
          eventKind: 'tombstone_cascade',
          eventWeek: '2026-W32',
        }))
        withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => {
          const state = verifyStorageV3RevocationReplay(
            openStorageV3ArtifactRoot(fx.root),
            fx.key,
            fx.selection,
            lease,
          )
          assertStorageV3RevocationReplayApplied(selected, state)
        })
      } finally { selected.close() }

      const replay = deleteScope(fx)
      expect(replay.deletion.status).toBe('replayed')
      expect(readdirSync(fx.root).filter((name) => name.startsWith(
        STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix,
      ))).toHaveLength(2)
    } finally { fx.close() }
  })

  it('resumes a durable intent after interruption before SQL deletion', async () => {
    const fx = await fixture()
    try {
      expect(() => deleteScope(fx, (stage) => {
        if (stage === 'intentDurable') throw new Error('invented process crash')
      })).toThrow('invented process crash')
      const before = openSelectedStorageV3Store(fx.root)
      expect(before.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A)).toBeDefined()
      before.close()

      expect(resumeStorageV3RevocationReplay(fx.root, fx.key)).toBe(1)
      const after = openSelectedStorageV3Store(fx.root)
      try {
        expect(after.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A)).toBeUndefined()
        expect(after.prepare(
          "SELECT 1 FROM lineage_event WHERE subject_kind = 'scope' AND subject_id = ? AND event_kind = 'tombstone_cascade'",
        ).get(SCOPE_A)).toBeDefined()
      } finally { after.close() }
    } finally { fx.close() }
  })

  it('recovers the exact hard-link pair and refuses foreign reserved names', async () => {
    const fx = await fixture()
    try {
      withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => {
        v3RevocationReplayTestSeams.ensureWithDirectorySynchronizer(
          openStorageV3ArtifactRoot(fx.root), fx.key, fx.selection, lease, () => {},
        )
      })
      let interrupted = false
      expect(() => v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: fx.root,
        installationKey: fx.key,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 9),
      }, (_root, stage) => {
        if (stage === 'finalLink' && !interrupted) {
          interrupted = true
          throw new Error('invented final-link interruption')
        }
      })).toThrow('invented final-link interruption')
      expect(existsSync(join(fx.root, 'revocation-replay-v1-00000001.json.tmp'))).toBe(true)
      expect(deleteScope(fx).maintenance).toBe('complete')
      expect(existsSync(join(fx.root, 'revocation-replay-v1-00000001.json.tmp'))).toBe(false)

      const poison = join(fx.root, 'Revocation-replay-v1-00000002.json')
      writeFileSync(poison, 'foreign')
      const bytes = readFileSync(poison)
      expect(() => resumeStorageV3RevocationReplay(fx.root, fx.key))
        .toThrowError(new StorageV3RevocationReplayError())
      expect(readFileSync(poison)).toEqual(bytes)
    } finally { fx.close() }
  })
})
