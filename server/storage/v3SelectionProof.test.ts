import { existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  createStorageV3ArtifactRoot,
  registerSelectedStorageV3Artifact,
  storageV3ArtifactFilePath,
  STORAGE_V3_ARTIFACT_LOCATORS,
} from './v3ArtifactCatalogue.js'
import {
  consumeStorageV3MigrationSelectionProof,
  publishStorageV3MigrationSelectionProof,
  readStorageV3MigrationSelectionProof,
  StorageV3SelectionProofError,
  STORAGE_V3_SELECTION_PROOF_NAMES,
  v3SelectionProofTestSeams,
  verifyStorageV3MigrationSelectionProof,
} from './v3SelectionProof.js'
import { taskInstallationKeyTestSeams } from './taskInstallationKey.js'
import {
  recordStorageV3MigrationSelection,
  replayStorageV3MigrationSuccessReport,
  storageV3MigrationRootBinding,
  type StorageV3MigrationSelection,
} from './v3SelectionReceipt.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'

const selection: StorageV3MigrationSelection = Object.freeze({
  readerState: 'v3_selected',
  legacySourceId: `legacy-${'a'.repeat(64)}`,
  selectedArtifactId: `art-${'b'.repeat(64)}`,
  backupArtifactId: `art-${'c'.repeat(64)}`,
  successfulReportAt: '2026-08-06T12:34:56.789Z',
  graceDeadlineAt: '2026-08-13T12:34:56.789Z',
})

async function fixture(taskId = 'invented-selection-proof-task') {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'developer-lens-selection-proof-'))
  const rootPath = join(workspaceRoot, '.developer-lens', 'activation', taskId)
  mkdirSync(rootPath, { recursive: true })
  const root = createStorageV3ArtifactRoot(rootPath)
  const key = await taskInstallationKeyTestSeams.setupWithRandomBytes({ workspaceRoot, taskId }, () => Buffer.alloc(32, 7))
  const db = new Database(join(rootPath, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
  installStorageV3ShadowSchema(db)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(`scope-${'a'.repeat(64)}`)
  const selectedArtifactId = registerSelectedStorageV3Artifact(db, root, () => Buffer.alloc(32, 0xbb))
  if (selectedArtifactId !== selection.selectedArtifactId) throw new Error('invented fixture identity mismatch')
  recordStorageV3MigrationSelection(db, {
    legacySourceId: selection.legacySourceId,
    selectedArtifactId,
    backupArtifactId: selection.backupArtifactId,
    backupAt: '2026-08-06T12:34:55Z',
    taskId: key.taskId,
    taskFingerprint: key.fingerprint,
    rootBinding: storageV3MigrationRootBinding(rootPath),
    successReportProof: replayStorageV3MigrationSuccessReport({
      legacySourceId: selection.legacySourceId,
      selectedArtifactId,
      backupArtifactId: selection.backupArtifactId,
      backupAt: '2026-08-06T12:34:55Z',
      taskId: key.taskId,
      taskFingerprint: key.fingerprint,
      rootBinding: storageV3MigrationRootBinding(rootPath),
    }, selection.successfulReportAt),
  })
  return {
    workspaceRoot,
    rootPath,
    root,
    db,
    key,
    finalPath: storageV3ArtifactFilePath(root, STORAGE_V3_SELECTION_PROOF_NAMES.final),
    tempPath: storageV3ArtifactFilePath(root, STORAGE_V3_SELECTION_PROOF_NAMES.temp),
    cleanup: () => { if (db.open) db.close(); rmSync(workspaceRoot, { recursive: true, force: true }) },
  }
}

const noop = () => {}

describe('LIFE-03 durable migration selection proof', () => {
  it('publishes, verifies an opaque handle, consumes exact immutable selection, and replays', async () => {
    const fx = await fixture()
    try {
      expect(v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, selection, fx.key, noop)).toMatchObject({ status: 'published', selection })
      expect(readFileSync(fx.finalPath).toString('utf8').endsWith('\n')).toBe(true)
      const handle = verifyStorageV3MigrationSelectionProof(fx.root, fx.key)
      expect(Object.keys(handle)).toEqual([])
      expect(consumeStorageV3MigrationSelectionProof(handle, fx.root, fx.key)).toEqual(selection)
      expect(() => consumeStorageV3MigrationSelectionProof(handle, fx.root, fx.key)).toThrow(StorageV3SelectionProofError)
      expect(v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, selection, fx.key, noop)).toMatchObject({ status: 'replayed', selection })
      expect(readStorageV3MigrationSelectionProof(fx.root, fx.key)).toBeDefined()
      const committed = await fixture('invented-selection-proof-committed')
      try {
        expect(v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(
          committed.db, committed.root, committed.key, noop,
        )).toMatchObject({ status: 'published', selection })
      } finally { committed.cleanup() }
    } finally { fx.cleanup() }
  })

  it('orders temp claim, bytes, final link, and temp removal, and recovers an exact pair', async () => {
    const fx = await fixture()
    try {
      const stages: string[] = []
      const sync = (_root: typeof fx.root, stage: string) => { stages.push(stage) }
      expect(() => v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, selection, fx.key, sync, 'finalLink')).toThrow(StorageV3SelectionProofError)
      expect(lstatSync(fx.tempPath).nlink).toBe(2)
      expect(lstatSync(fx.finalPath).nlink).toBe(2)
      expect(verifyStorageV3MigrationSelectionProof(fx.root, fx.key)).toBeDefined()
      expect(v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, selection, fx.key, sync)).toMatchObject({ status: 'replayed' })
      expect(existsSync(fx.tempPath)).toBe(false)
      expect(stages).toEqual(['tempClaim', 'tempDurable', 'finalLink', 'tempRemoval'])
    } finally { fx.cleanup() }
  })

  it('closes and recovers a reserved empty temp provisional across restart', async () => {
    const fx = await fixture()
    const foreign = await fixture('invented-selection-proof-foreign-empty')
    try {
      expect(() => v3SelectionProofTestSeams.publishWithDirectorySynchronizer(
        fx.root, selection, fx.key, noop, 'tempClaim',
      )).toThrow(StorageV3SelectionProofError)
      expect(lstatSync(fx.tempPath).size).toBe(0)
      expect(v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, selection, fx.key, noop)).toMatchObject({ status: 'published' })
      expect(existsSync(fx.tempPath)).toBe(false)

      writeFileSync(foreign.tempPath, Buffer.alloc(0))
      expect(v3SelectionProofTestSeams.publishWithDirectorySynchronizer(foreign.root, selection, foreign.key, noop)).toMatchObject({ status: 'published' })
      expect(existsSync(foreign.tempPath)).toBe(false)
    } finally { fx.cleanup(); foreign.cleanup() }
  })

  it('re-syncs a final-only replay after temp removal sync failure', async () => {
    const fx = await fixture()
    try {
      let allowRemovalSync = false
      const sync = (_root: typeof fx.root, stage: string) => {
        if (stage === 'tempRemoval' && !allowRemovalSync) throw new Error('invented directory sync interruption')
      }
      expect(() => v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, selection, fx.key, sync)).toThrow(StorageV3SelectionProofError)
      expect(existsSync(fx.finalPath)).toBe(true)
      expect(existsSync(fx.tempPath)).toBe(false)
      expect(() => v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, selection, fx.key, sync)).toThrow(StorageV3SelectionProofError)
      allowRemovalSync = true
      expect(v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, selection, fx.key, sync)).toMatchObject({ status: 'replayed' })
    } finally { fx.cleanup() }
  })

  it('refuses wrong key/root, deadline extension, symlinks, hardlinks, sidecars, and foreign bytes untouched', async () => {
    const fx = await fixture()
    const other = await fixture('invented-selection-proof-other')
    try {
      expect(() => v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, { ...selection, graceDeadlineAt: '2026-08-14T12:34:56.789Z' }, fx.key, noop)).toThrow(StorageV3SelectionProofError)
      expect(() => v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, selection, other.key, noop)).toThrow(StorageV3SelectionProofError)
      const forged = new Database(':memory:')
      try {
        installStorageV3ShadowSchema(forged)
        recordStorageV3MigrationSelection(forged, {
          legacySourceId: selection.legacySourceId,
          selectedArtifactId: selection.selectedArtifactId,
          backupArtifactId: selection.backupArtifactId,
          backupAt: '2026-08-06T12:34:55Z',
          taskId: fx.key.taskId,
          taskFingerprint: fx.key.fingerprint,
          rootBinding: storageV3MigrationRootBinding(fx.rootPath),
          successReportProof: replayStorageV3MigrationSuccessReport({
            legacySourceId: selection.legacySourceId,
            selectedArtifactId: selection.selectedArtifactId,
            backupArtifactId: selection.backupArtifactId,
            backupAt: '2026-08-06T12:34:55Z',
            taskId: fx.key.taskId,
            taskFingerprint: fx.key.fingerprint,
            rootBinding: storageV3MigrationRootBinding(fx.rootPath),
          }, selection.successfulReportAt),
        })
        expect(() => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(
          forged, fx.root, fx.key, noop,
        )).toThrow(StorageV3SelectionProofError)
      } finally { forged.close() }
      writeFileSync(fx.tempPath, Buffer.from('foreign\n'))
      const before = readFileSync(fx.tempPath)
      expect(() => v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, selection, fx.key, noop)).toThrow(StorageV3SelectionProofError)
      expect(readFileSync(fx.tempPath)).toEqual(before)
      rmSync(fx.tempPath)
      writeFileSync(fx.finalPath, Buffer.from('foreign\n'))
      expect(() => verifyStorageV3MigrationSelectionProof(fx.root, fx.key)).toThrow(StorageV3SelectionProofError)
      expect(readFileSync(fx.finalPath).toString()).toBe('foreign\n')
      rmSync(fx.finalPath)
      if (process.platform !== 'win32') {
        symlinkSync(join(fx.rootPath, 'outside'), fx.finalPath)
        expect(() => verifyStorageV3MigrationSelectionProof(fx.root, fx.key)).toThrow(StorageV3SelectionProofError)
        rmSync(fx.finalPath)
      }
      writeFileSync(fx.finalPath, Buffer.from('foreign\n'))
      linkSync(fx.finalPath, join(fx.rootPath, 'unexpected-hardlink'))
      expect(() => verifyStorageV3MigrationSelectionProof(fx.root, fx.key)).toThrow(StorageV3SelectionProofError)
      rmSync(join(fx.rootPath, 'unexpected-hardlink'))
      rmSync(fx.finalPath)
      writeFileSync(join(fx.rootPath, `${STORAGE_V3_SELECTION_PROOF_NAMES.final}.sidecar`), Buffer.from('x'))
      expect(() => v3SelectionProofTestSeams.publishWithDirectorySynchronizer(fx.root, selection, fx.key, noop)).toThrow(StorageV3SelectionProofError)
    } finally { fx.cleanup(); other.cleanup() }
  })

  it('keeps native entrypoint fail-closed when directory sync is unavailable', async () => {
    const fx = await fixture()
    try {
      if (process.platform === 'win32') {
        expect(() => publishStorageV3MigrationSelectionProof(fx.db, fx.root, fx.key)).toThrow(StorageV3SelectionProofError)
        expect(existsSync(fx.finalPath)).toBe(false)
      } else {
        expect(publishStorageV3MigrationSelectionProof(fx.db, fx.root, fx.key)).toMatchObject({
          status: 'published', selection,
        })
      }
    } finally { fx.cleanup() }
  })
})
