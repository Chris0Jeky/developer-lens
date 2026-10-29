import { existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
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
  withStorageV3MigrationSelectionRestoreAuthority,
  type StorageV3MigrationSelectionReplayAuthority,
} from './v3SelectionProof.js'
import { taskInstallationKeyTestSeams } from './taskInstallationKey.js'
import {
  recordStorageV3MigrationSelection,
  issueStorageV3MigrationSuccessReport,
  replayStorageV3MigrationSuccessReport,
  StorageV3MigrationSelectionError,
  storageV3MigrationRootBinding,
  type StorageV3MigrationSelection,
} from './v3SelectionReceipt.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'

function issueSuccessReportAt(input: Parameters<typeof issueStorageV3MigrationSuccessReport>[0], at: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    vi.setSystemTime(at)
    return issueStorageV3MigrationSuccessReport(input)
  } finally { vi.useRealTimers() }
}

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
    successReportProof: issueSuccessReportAt({
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

function reportContext(fx: Awaited<ReturnType<typeof fixture>>) {
  return {
    legacySourceId: selection.legacySourceId,
    selectedArtifactId: selection.selectedArtifactId,
    backupArtifactId: selection.backupArtifactId,
    backupAt: '2026-08-06T12:34:55Z',
    taskId: fx.key.taskId,
    taskFingerprint: fx.key.fingerprint,
    rootBinding: storageV3MigrationRootBinding(fx.rootPath),
  }
}

function publishAndVerify(fx: Awaited<ReturnType<typeof fixture>>) {
  v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, noop)
  return verifyStorageV3MigrationSelectionProof(fx.root, fx.key)
}

describe('LIFE-03 durable migration selection proof', () => {
  it('refuses forged, cloned, fresh and ordinarily consumed handles as replay authority', async () => {
    const fx = await fixture()
    try {
      const handle = publishAndVerify(fx)
      const replay = (authority: unknown) => replayStorageV3MigrationSuccessReport(
        reportContext(fx), authority as StorageV3MigrationSelectionReplayAuthority, fx.root, fx.key,
      )
      expect(() => replay({})).toThrow(StorageV3MigrationSelectionError)
      expect(() => replay({ ...handle })).toThrow(StorageV3MigrationSelectionError)
      expect(() => replay(handle)).toThrow(StorageV3MigrationSelectionError)
      expect(consumeStorageV3MigrationSelectionProof(handle, fx.root, fx.key)).toEqual(selection)
      expect(() => replay(handle)).toThrow(StorageV3MigrationSelectionError)
      expect(() => withStorageV3MigrationSelectionRestoreAuthority(handle, fx.root, fx.key, noop))
        .toThrow(StorageV3SelectionProofError)
    } finally { fx.cleanup() }
  })

  it('binds all replay context before spending authority and preserves original report and grace time', async () => {
    const fx = await fixture()
    const other = await fixture('invented-replay-other')
    const target = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(target)
      const handle = publishAndVerify(fx)
      expect(() => withStorageV3MigrationSelectionRestoreAuthority(handle, other.root, fx.key, noop))
        .toThrow(StorageV3SelectionProofError)
      expect(() => withStorageV3MigrationSelectionRestoreAuthority(handle, fx.root, other.key, noop))
        .toThrow(StorageV3SelectionProofError)
      const originalMarker = readFileSync(fx.finalPath)
      withStorageV3MigrationSelectionRestoreAuthority(handle, fx.root, fx.key, (original, authority) => {
        expect(original).toEqual(selection)
        const context = reportContext(fx)
        const replay = (overrides: Partial<typeof context> = {}, root = fx.root, key = fx.key) =>
          replayStorageV3MigrationSuccessReport({ ...context, ...overrides }, authority, root, key)
        for (const overrides of [
          { legacySourceId: `legacy-${'d'.repeat(64)}` },
          { selectedArtifactId: `art-${'d'.repeat(64)}` },
          { backupArtifactId: `art-${'d'.repeat(64)}` },
          { taskId: 'wrong-task' },
          { taskFingerprint: 'wrong-fingerprint' },
          { rootBinding: 'root-wrong' },
          { backupAt: '2026-08-06T12:34:57Z' },
          { backupAt: 'not-a-timestamp' },
        ]) expect(() => replay(overrides)).toThrow(StorageV3MigrationSelectionError)
        expect(() => replay({}, other.root)).toThrow(StorageV3MigrationSelectionError)
        expect(() => replay({}, fx.root, other.key)).toThrow(StorageV3MigrationSelectionError)
        writeFileSync(fx.finalPath, Buffer.from('invented replaced marker\n'))
        expect(() => replay()).toThrow(StorageV3MigrationSelectionError)
        writeFileSync(fx.finalPath, originalMarker)
        vi.useFakeTimers({ toFake: ['Date'] })
        try {
          vi.setSystemTime('2027-01-01T00:00:00.000Z')
          const proof = replay()
          expect(() => replay()).toThrow(StorageV3MigrationSelectionError)
          expect(recordStorageV3MigrationSelection(target, { ...context, successReportProof: proof }).selection)
            .toEqual(selection)
        } finally { vi.useRealTimers() }
      })
      expect(readFileSync(fx.finalPath)).toEqual(originalMarker)
    } finally { target.close(); fx.cleanup(); other.cleanup() }
  })

  it('invalidates returned authority and expires async use after await', async () => {
    const fx = await fixture()
    try {
      const escaped = withStorageV3MigrationSelectionRestoreAuthority(
        publishAndVerify(fx), fx.root, fx.key, (_original, authority) => authority,
      )
      expect(() => replayStorageV3MigrationSuccessReport(reportContext(fx), escaped, fx.root, fx.key))
        .toThrow(StorageV3MigrationSelectionError)
      await withStorageV3MigrationSelectionRestoreAuthority(
        verifyStorageV3MigrationSelectionProof(fx.root, fx.key), fx.root, fx.key,
        async (_original, authority) => {
          await Promise.resolve()
          expect(() => replayStorageV3MigrationSuccessReport(reportContext(fx), authority, fx.root, fx.key))
            .toThrow(StorageV3MigrationSelectionError)
        },
      )
    } finally { fx.cleanup() }
  })

  it('expires authority on callback failure and permits a fresh verified retry of the same original time', async () => {
    const fx = await fixture()
    let escaped: StorageV3MigrationSelectionReplayAuthority | undefined
    try {
      const handle = publishAndVerify(fx)
      expect(() => withStorageV3MigrationSelectionRestoreAuthority(handle, fx.root, fx.key, (_original, authority) => {
        escaped = authority
        throw new Error('invented restore failure')
      })).toThrow('invented restore failure')
      expect(() => replayStorageV3MigrationSuccessReport(reportContext(fx), escaped!, fx.root, fx.key))
        .toThrow(StorageV3MigrationSelectionError)
      expect(() => withStorageV3MigrationSelectionRestoreAuthority(handle, fx.root, fx.key, noop))
        .toThrow(StorageV3SelectionProofError)
      const proof = withStorageV3MigrationSelectionRestoreAuthority(
        verifyStorageV3MigrationSelectionProof(fx.root, fx.key), fx.root, fx.key,
        (_original, authority) => replayStorageV3MigrationSuccessReport(reportContext(fx), authority, fx.root, fx.key),
      )
      const target = new Database(':memory:')
      try {
        installStorageV3ShadowSchema(target)
        expect(recordStorageV3MigrationSelection(target, { ...reportContext(fx), successReportProof: proof }).selection)
          .toEqual(selection)
      } finally { target.close() }
    } finally { fx.cleanup() }
  })

  it('cannot publish and verify a caller-chosen selection instead of the committed database receipt', async () => {
    const fx = await fixture()
    try {
      const publish = (v3SelectionProofTestSeams as unknown as Record<string, unknown>).publishWithDirectorySynchronizer
      let accepted: StorageV3MigrationSelection | undefined
      if (typeof publish === 'function') {
        publish(fx.root, {
          ...selection,
          successfulReportAt: '2026-09-01T00:00:00.000Z',
          graceDeadlineAt: '2026-09-08T00:00:00.000Z',
        }, fx.key, noop)
        accepted = consumeStorageV3MigrationSelectionProof(
          verifyStorageV3MigrationSelectionProof(fx.root, fx.key), fx.root, fx.key,
        )
      }
      expect(accepted).toBeUndefined()
      expect(v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(
        fx.db, fx.root, fx.key, noop,
      )).toMatchObject({ status: 'published', selection })
    } finally { fx.cleanup() }
  })

  it('publishes, verifies an opaque handle, consumes exact immutable selection, and replays', async () => {
    const fx = await fixture()
    try {
      expect(v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, noop)).toMatchObject({ status: 'published', selection })
      expect(readFileSync(fx.finalPath).toString('utf8').endsWith('\n')).toBe(true)
      const marker = JSON.parse(readFileSync(fx.finalPath, 'utf8')) as Record<string, unknown>
      expect(marker).not.toHaveProperty('taskId')
      expect(readFileSync(fx.finalPath, 'utf8')).not.toContain('invented-selection-proof-task')
      expect(typeof marker.taskFingerprint).toBe('string')
      expect(marker.taskFingerprint).not.toBe(fx.key.fingerprint)
      const handle = verifyStorageV3MigrationSelectionProof(fx.root, fx.key)
      expect(Object.keys(handle)).toEqual([])
      expect(consumeStorageV3MigrationSelectionProof(handle, fx.root, fx.key)).toEqual(selection)
      expect(() => consumeStorageV3MigrationSelectionProof(handle, fx.root, fx.key)).toThrow(StorageV3SelectionProofError)
      expect(v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, noop)).toMatchObject({ status: 'replayed', selection })
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
      expect(() => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, sync, 'finalLink')).toThrow(StorageV3SelectionProofError)
      expect(lstatSync(fx.tempPath).nlink).toBe(2)
      expect(lstatSync(fx.finalPath).nlink).toBe(2)
      const handle = v3SelectionProofTestSeams.verifyWithDirectorySynchronizer(fx.root, fx.key, sync)
      expect(consumeStorageV3MigrationSelectionProof(handle, fx.root, fx.key)).toEqual(selection)
      expect(existsSync(fx.tempPath)).toBe(false)
      expect(stages).toEqual(['tempClaim', 'tempDurable', 'finalLink', 'finalLink', 'tempRemoval'])
      expect(v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, noop)).toMatchObject({ status: 'replayed' })
    } finally { fx.cleanup() }
  })

  it('closes and recovers a reserved empty temp provisional across restart', async () => {
    const fx = await fixture()
    const foreign = await fixture('invented-selection-proof-foreign-empty')
    try {
      expect(() => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(
        fx.db, fx.root, fx.key, noop, 'tempClaim',
      )).toThrow(StorageV3SelectionProofError)
      expect(lstatSync(fx.tempPath).size).toBe(0)
      expect(v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, noop)).toMatchObject({ status: 'published' })
      expect(existsSync(fx.tempPath)).toBe(false)

      writeFileSync(foreign.tempPath, Buffer.alloc(0), { mode: 0o600 })
      expect(v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(foreign.db, foreign.root, foreign.key, noop)).toMatchObject({ status: 'published' })
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
      expect(() => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, sync)).toThrow(StorageV3SelectionProofError)
      expect(existsSync(fx.finalPath)).toBe(true)
      expect(existsSync(fx.tempPath)).toBe(false)
      expect(() => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, sync)).toThrow(StorageV3SelectionProofError)
      allowRemovalSync = true
      expect(v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, sync)).toMatchObject({ status: 'replayed' })
    } finally { fx.cleanup() }
  })

  it('refuses wrong key/root, deadline extension, symlinks, hardlinks, sidecars, and foreign bytes untouched', async () => {
    const fx = await fixture()
    const other = await fixture('invented-selection-proof-other')
    try {
      v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, noop)
      const extended = Buffer.from(`${JSON.stringify({
        ...JSON.parse(readFileSync(fx.finalPath, 'utf8')),
        graceDeadlineAt: '2026-08-14T12:34:56.789Z',
      })}\n`)
      writeFileSync(fx.finalPath, extended)
      expect(() => verifyStorageV3MigrationSelectionProof(fx.root, fx.key)).toThrow(StorageV3SelectionProofError)
      expect(readFileSync(fx.finalPath)).toEqual(extended)
      rmSync(fx.finalPath)
      expect(() => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, other.key, noop)).toThrow(StorageV3SelectionProofError)
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
          successReportProof: issueSuccessReportAt({
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
      expect(() => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, noop)).toThrow(StorageV3SelectionProofError)
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
      expect(() => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, noop)).toThrow(StorageV3SelectionProofError)
      rmSync(join(fx.rootPath, `${STORAGE_V3_SELECTION_PROOF_NAMES.final}.sidecar`))
      const caseVariant = join(fx.rootPath, 'Migration-Selection-V1.JSON')
      writeFileSync(caseVariant, Buffer.from('invented foreign case variant\n'))
      expect(() => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(fx.db, fx.root, fx.key, noop)).toThrow(StorageV3SelectionProofError)
      expect(readFileSync(caseVariant, 'utf8')).toBe('invented foreign case variant\n')
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
