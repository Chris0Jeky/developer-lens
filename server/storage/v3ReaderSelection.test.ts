import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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
  selectStorageV3Reader as selectStorageV3ReaderNative,
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
import { STORAGE_V3_SELECTION_PROOF_NAMES } from './v3SelectionProof.js'
import {
  STORAGE_V3_REVOCATION_REPLAY_NAMES,
  resumeStorageV3RevocationReplay,
  v3RevocationReplayTestSeams,
} from './v3RevocationReplay.js'

const SCOPE_A = `scope-${'a'.repeat(64)}`
const SCOPE_B = `scope-${'b'.repeat(64)}`
const BACKUP_ARTIFACT_ID = `art-${'1'.repeat(64)}`
const LEGACY_SOURCE_ID = `legacy-${'2'.repeat(64)}`
const BACKUP_AT = '2026-08-06T12:34:56Z'
const SUCCESS_AT = '2026-08-06T12:35:00.000Z'

const selectStorageV3Reader = (input: StorageV3ReaderSelectionInput) =>
  v3ReaderSelectionTestSeams.selectWithProofDirectorySynchronizer(input, () => {}, SUCCESS_AT)

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
  const taskId = 'DL-LIFE-03'
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
      expect(existsSync(join(fx.root, STORAGE_V3_SELECTION_PROOF_NAMES.final))).toBe(true)
      expect(existsSync(join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.anchor))).toBe(true)

      const replay = expectSelected(selectStorageV3Reader(fx.input))
      expect(replay.selection).toEqual(first.selection)
      expect(replay.db.prepare('SELECT COUNT(*) FROM migration_selection_state').pluck().get()).toBe(1)
      replay.db.close()

      expect(selectStorageV3Reader({
        ...fx.input,
        installationKey: Object.freeze({}) as TaskInstallationKeyHandle,
      })).toEqual({ reader: 'unavailable', code: 'v3-selection-selected-refused' })
    } finally { fx.cleanup() }
  })

  it('refuses reads with a durable unapplied revocation and resumes before service', async () => {
    const fx = await fixture()
    try {
      const selected = expectSelected(selectStorageV3Reader(fx.input))
      selected.db.close()
      expect(() => v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: fx.root,
        installationKey: fx.key,
        scopeId: SCOPE_A,
        asOf: '2026-08-06T13:00:00.000Z',
        randomBytes: () => Buffer.alloc(32, 9),
      }, () => {}, (stage) => {
        if (stage === 'intentDurable') throw new Error('invented process interruption')
      })).toThrow('invented process interruption')

      expect(selectStorageV3Reader(fx.input))
        .toEqual({ reader: 'unavailable', code: 'v3-selection-selected-refused' })
      expect(resumeStorageV3RevocationReplay(fx.root, fx.key)).toBe(1)
      const replay = expectSelected(selectStorageV3Reader(fx.input))
      expect(replay.db.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A))
        .toBeUndefined()
      replay.db.close()
    } finally { fx.cleanup() }
  })

  it('refuses reads while a physically head-matched chunk group is incomplete', async () => {
    const fx = await fixture()
    try {
      const selected = expectSelected(selectStorageV3Reader(fx.input))
      selected.db.close()
      let interrupted = false
      expect(() => v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: fx.root,
        installationKey: fx.key,
        scopeId: SCOPE_A,
        asOf: '2026-08-06T13:00:00.000Z',
        randomBytes: () => Buffer.alloc(32, 9),
      }, (_root, stage) => {
        if (stage === 'headReplace' && !interrupted) {
          interrupted = true
          throw new Error('invented partial chunk interruption')
        }
      }, undefined, 1)).toThrow('invented partial chunk interruption')

      expect(selectStorageV3Reader(fx.input))
        .toEqual({ reader: 'unavailable', code: 'v3-selection-selected-refused' })
      expect(v3RevocationReplayTestSeams.resumeWithDirectorySynchronizer(
        fx.root,
        fx.key,
        () => {},
      )).toBe(1)
      const replay = expectSelected(selectStorageV3Reader(fx.input))
      expect(replay.db.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A))
        .toBeUndefined()
      replay.db.close()
    } finally { fx.cleanup() }
  })

  it.each([
    'tempDurable',
    'finalLink',
    'tempRemoval',
    'headTempDurable',
    'headReplace',
  ] as const)('rolls back the receipt and resumes empty-family initialization after %s', async (stage) => {
    const fx = await fixture()
    try {
      let interrupted = false
      const first = v3ReaderSelectionTestSeams.selectWithRevocationDirectorySynchronizer(
        fx.input,
        (_root, current) => {
          if (current === stage && !interrupted) {
            interrupted = true
            throw new Error(`invented ${stage} initialization crash`)
          }
        },
        SUCCESS_AT,
      )
      expect(first).toEqual({ reader: 'unavailable', code: 'v3-selection-selected-refused' })
      const rolledBack = openSelectedStorageV3Store(fx.root)
      try { expect(readStorageV3MigrationSelection(rolledBack)).toBeUndefined() } finally { rolledBack.close() }
      expect(readdirSync(fx.root).some((name) => name.startsWith(
        STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix,
      ))).toBe(true)

      const retrySuccessAt = '2026-08-06T12:36:00.000Z'
      const resumed = expectSelected(
        v3ReaderSelectionTestSeams.selectWithRevocationDirectorySynchronizer(
          fx.input,
          () => {},
          retrySuccessAt,
        ),
      )
      expect(resumed.selection.successfulReportAt).toBe(retrySuccessAt)
      resumed.db.close()
      expect(existsSync(join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.anchor))).toBe(true)
      expect(existsSync(join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head))).toBe(true)
      expect(readdirSync(fx.root).some((name) => name.startsWith(
        STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix,
      ) && name.endsWith('.tmp'))).toBe(false)
    } finally { fx.cleanup() }
  })

  it.each(['headTempDurable', 'headReplace'] as const)(
    'resumes a committed receipt after initialization finalization fails at %s',
    async (stage) => {
      const fx = await fixture()
      try {
        let occurrences = 0
        const first = v3ReaderSelectionTestSeams.selectWithRevocationDirectorySynchronizer(
          fx.input,
          (_root, current) => {
            if (current === stage) {
              occurrences += 1
              if (occurrences === 2) throw new Error(`invented committed ${stage} crash`)
            }
          },
          SUCCESS_AT,
        )
        expect(first).toEqual({ reader: 'unavailable', code: 'v3-selection-selected-refused' })
        const committed = openSelectedStorageV3Store(fx.root)
        try {
          expect(readStorageV3MigrationSelection(committed)).toMatchObject({
            successfulReportAt: SUCCESS_AT,
          })
        } finally { committed.close() }

        const resumed = expectSelected(selectStorageV3Reader(fx.input))
        resumed.db.close()
        expect(readFileSync(join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head), 'utf8'))
          .toContain('"phase":"committed"')
      } finally { fx.cleanup() }
    },
  )

  it('never recreates a missing replay family for a committed selection', async () => {
    const fx = await fixture()
    try {
      const selected = expectSelected(selectStorageV3Reader(fx.input))
      selected.db.close()
      expect(() => v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: fx.root,
        installationKey: fx.key,
        scopeId: SCOPE_A,
        asOf: '2026-08-06T13:00:00.000Z',
        randomBytes: () => Buffer.alloc(32, 9),
      }, () => {}, (stage) => {
        if (stage === 'intentDurable') throw new Error('invented process interruption')
      })).toThrow('invented process interruption')
      for (const name of readdirSync(fx.root)) {
        if (name.startsWith(STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix)) {
          rmSync(join(fx.root, name))
        }
      }
      expect(readdirSync(fx.root).some((name) => name.startsWith(
        STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix,
      ))).toBe(false)

      expect(selectStorageV3Reader(fx.input))
        .toEqual({ reader: 'unavailable', code: 'v3-selection-selected-refused' })
      expect(readdirSync(fx.root).some((name) => name.startsWith(
        STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix,
      ))).toBe(false)
      const store = openSelectedStorageV3Store(fx.root)
      try {
        expect(store.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A)).toBeDefined()
      } finally { store.close() }
    } finally { fx.cleanup() }
  })

  it('reconstructs a missing proof only from the exact committed receipt', async () => {
    const fx = await fixture()
    try {
      const first = expectSelected(selectStorageV3Reader(fx.input))
      first.db.close()
      const proofPath = join(fx.root, STORAGE_V3_SELECTION_PROOF_NAMES.final)
      rmSync(proofPath)
      expect(existsSync(proofPath)).toBe(false)

      const replay = expectSelected(selectStorageV3Reader(fx.input))
      replay.db.close()
      expect(existsSync(proofPath)).toBe(true)
    } finally { fx.cleanup() }
  })

  it('protects a committed receipt when proof publication fails and resumes exactly', async () => {
    const fx = await fixture()
    try {
      const refused = v3ReaderSelectionTestSeams.selectWithProofDirectorySynchronizer(
        fx.input,
        (_root, stage) => {
          if (stage === 'tempDurable') throw new Error('invented proof sync failure')
        },
        SUCCESS_AT,
      )
      expect(refused).toEqual({ reader: 'unavailable', code: 'v3-selection-selected-refused' })
      const selected = openSelectedStorageV3Store(fx.root)
      expect(readStorageV3MigrationSelection(selected)).toMatchObject({ successfulReportAt: SUCCESS_AT })
      selected.close()

      const resumed = expectSelected(selectStorageV3Reader(fx.input))
      resumed.db.close()
    } finally { fx.cleanup() }
  })

  it('leaves a foreign proof marker untouched and never falls back after receipt commit', async () => {
    const fx = await fixture()
    try {
      const proofPath = join(fx.root, STORAGE_V3_SELECTION_PROOF_NAMES.final)
      const foreign = Buffer.from('invented foreign selection proof\n')
      writeFileSync(proofPath, foreign, { flag: 'wx', mode: 0o600 })
      expect(v3ReaderSelectionTestSeams.selectWithProofPreflight(fx.input, () => {
        throw new Error('invented proof preflight failure')
      }, SUCCESS_AT)).toEqual({ reader: 'unavailable', code: 'v3-selection-selected-refused' })
      const beforeReceipt = openSelectedStorageV3Store(fx.root)
      expect(readStorageV3MigrationSelection(beforeReceipt)).toBeUndefined()
      beforeReceipt.close()
      expect(selectStorageV3Reader(fx.input)).toEqual({
        reader: 'unavailable', code: 'v3-selection-selected-refused',
      })
      expect(readFileSync(proofPath)).toEqual(foreign)
      const selected = openSelectedStorageV3Store(fx.root)
      expect(readStorageV3MigrationSelection(selected)).toBeUndefined()
      selected.close()
      expect(existsSync(storageV3WriterLeasePath(openStorageV3ArtifactRoot(fx.root)))).toBe(false)
    } finally { fx.cleanup() }
  })

  it('leaves a foreign head-only namespace untouched without creating an anchor', async () => {
    const fx = await fixture()
    try {
      const headPath = join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head)
      const foreign = Buffer.from('invented foreign revocation head\n')
      writeFileSync(headPath, foreign, { flag: 'wx', mode: 0o600 })

      expect(selectStorageV3Reader(fx.input))
        .toEqual({ reader: 'unavailable', code: 'v3-selection-selected-refused' })
      expect(readFileSync(headPath)).toEqual(foreign)
      expect(existsSync(join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.anchor))).toBe(false)
      const store = openSelectedStorageV3Store(fx.root)
      try { expect(readStorageV3MigrationSelection(store)).toBeUndefined() } finally { store.close() }
    } finally { fx.cleanup() }
  })

  it('preflights native durability before committing a receipt when unsupported', async () => {
    if (process.platform !== 'win32') return
    const fx = await fixture()
    try {
      expect(selectStorageV3ReaderNative(fx.input)).toEqual({
        reader: 'legacy-json', code: 'v3-selection-receipt-refused',
      })
      const selected = openSelectedStorageV3Store(fx.root)
      expect(readStorageV3MigrationSelection(selected)).toBeUndefined()
      selected.close()
    } finally { fx.cleanup() }
  })

  it('refuses case-variant reserved marker names before receipt commit', async () => {
    const fx = await fixture()
    try {
      const caseVariant = join(fx.root, 'Migration-Selection-V1.JSON')
      const foreign = Buffer.from('invented case-variant marker\n')
      writeFileSync(caseVariant, foreign, { flag: 'wx', mode: 0o600 })
      expect(selectStorageV3Reader(fx.input)).toEqual({
        reader: 'unavailable', code: 'v3-selection-selected-refused',
      })
      expect(readFileSync(caseVariant)).toEqual(foreign)
      const selected = openSelectedStorageV3Store(fx.root)
      expect(readStorageV3MigrationSelection(selected)).toBeUndefined()
      selected.close()
    } finally { fx.cleanup() }
  })

  it('runs the exact-root durability preflight under the writer lease before receipt commit', async () => {
    const fx = await fixture()
    try {
      let calls = 0
      let leaseVisible = false
      const selected = expectSelected(v3ReaderSelectionTestSeams.selectWithProofPreflight(fx.input, (root) => {
        calls += 1
        leaseVisible = existsSync(storageV3WriterLeasePath(root))
      }, SUCCESS_AT))
      expect(calls).toBe(1)
      expect(leaseVisible).toBe(true)
      expect(readStorageV3MigrationSelection(selected.db)).toMatchObject({
        successfulReportAt: SUCCESS_AT,
      })
      selected.db.close()
    } finally { fx.cleanup() }
  })

  it('rolls back an interrupted receipt commit, closes the provisional handle, and resumes', async () => {
    const fx = await fixture()
    try {
      const interrupted = v3ReaderSelectionTestSeams.selectWithBeforeReceiptCommit(fx.input, () => {
        throw new Error('invented pre-commit interruption')
      }, SUCCESS_AT)
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

  it('owns the production success time and preserves its deadline on replay', async () => {
    const fx = await fixture()
    try {
      expect(v3ReaderSelectionTestSeams.selectWithRuntimeSuccessReport({
        ...fx.input,
        successfulReportAt: SUCCESS_AT,
      } as unknown as StorageV3ReaderSelectionInput)).toEqual({
        reader: 'legacy-json', code: 'v3-selection-request-invalid',
      })

      const before = Date.now()
      const first = expectSelected(v3ReaderSelectionTestSeams.selectWithRuntimeSuccessReport(fx.input))
      const after = Date.now()
      expect(Date.parse(first.selection.successfulReportAt)).toBeGreaterThanOrEqual(before)
      expect(Date.parse(first.selection.successfulReportAt)).toBeLessThanOrEqual(after)
      const originalSelection = first.selection
      first.db.close()

      const exact = expectSelected(v3ReaderSelectionTestSeams.selectWithRuntimeSuccessReport(fx.input))
      expect(exact.selection).toEqual(originalSelection)
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

  it('returns unavailable when lease contention races receipt visibility', async () => {
    const fx = await fixture()
    try {
      withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), () => {
        expect(selectStorageV3Reader(fx.input)).toEqual({
          reader: 'unavailable',
          code: 'v3-selection-selected-refused',
        })
      })
      const winner = expectSelected(selectStorageV3Reader(fx.input))
      winner.db.close()
    } finally { fx.cleanup() }
  })

  it('returns content-free fallback codes for request, root, store, and backup refusal', async () => {
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

  it('refuses legacy fallback when the selected store disappears after durable selection', async () => {
    const fx = await fixture()
    try {
      const selected = expectSelected(selectStorageV3Reader(fx.input))
      selected.db.close()

      rmSync(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))

      expect(selectStorageV3Reader(fx.input)).toEqual({
        reader: 'unavailable',
        code: 'v3-selection-selected-refused',
      })
    } finally { fx.cleanup() }
  })
})
