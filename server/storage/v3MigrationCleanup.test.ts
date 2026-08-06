import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
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
  storageV3WriterLeasePath,
  STORAGE_V3_ARTIFACT_LOCATORS,
} from './v3ArtifactCatalogue.js'
import { v3BackupTestSeams } from './v3Backup.js'
import {
  cleanupExpiredStorageV3Migration,
  registerStorageV3MigrationCleanup,
  STORAGE_V3_LEGACY_SOURCE_LOCATOR,
  STORAGE_V3_MIGRATION_CLEANUP_STAGES,
  StorageV3MigrationCleanupError,
  v3MigrationCleanupTestSeams,
  type StorageV3MigrationCleanupStage,
} from './v3MigrationCleanup.js'
import {
  v3ReaderSelectionTestSeams,
  type StorageV3ReaderSelectionInput,
} from './v3ReaderSelection.js'
import { STORAGE_V3_REVOCATION_REPLAY_NAMES } from './v3RevocationReplay.js'
import { STORAGE_V3_SELECTION_PROOF_NAMES } from './v3SelectionProof.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import { taskInstallationKeyTestSeams, type TaskInstallationKeyHandle } from './taskInstallationKey.js'
import { withStorageV3WriterLease } from './v3WriterLease.js'

const SCOPE_A = `scope-${'a'.repeat(64)}`
const SCOPE_B = `scope-${'b'.repeat(64)}`
const BACKUP_ID = `art-${'c'.repeat(64)}`
const LEGACY_ID = `legacy-${'d'.repeat(64)}`
const BACKUP_AT = '2026-08-06T12:34:56Z'
const SUCCESS_AT = '2026-08-06T12:35:00.000Z'
const DEADLINE = '2026-08-13T12:35:00.000Z'
const BEFORE_DEADLINE = '2026-08-13T12:34:59.999Z'
const BACKUP_LOCATOR = 'migration-backup-20260806T123456Z.sqlite'
const BACKUP_MANIFEST = `${BACKUP_LOCATOR}.manifest.json`

type Fixture = Readonly<{
  workspaceRoot: string
  root: string
  key: TaskInstallationKeyHandle
  input: Readonly<{ directory: string; installationKey: TaskInstallationKeyHandle }>
  selectionInput: StorageV3ReaderSelectionInput
  selectedArtifactId: string
  markerBytes(): ReadonlyMap<string, Buffer>
  cleanup(): void
}>

async function fixture(options: Readonly<{
  register?: boolean
  select?: boolean
  legacySidecars?: boolean
  backupAt?: string
  successAt?: string
}> = {}): Promise<Fixture> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'developer-lens-life03-expiry-'))
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
      "SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store'",
    ).pluck().get() as string
    const key = await taskInstallationKeyTestSeams.setupWithRandomBytes(
      { workspaceRoot, taskId },
      () => Buffer.alloc(32, 7),
    )
    const backupAt = options.backupAt ?? BACKUP_AT
    await v3BackupTestSeams.createWithDirectorySynchronizer({
      db,
      root: rootHandle,
      backupAt,
      artifactId: BACKUP_ID,
      ownerScopeIds: [SCOPE_A, SCOPE_B],
      installationKey: key,
    }, () => {})
    writeFileSync(join(root, STORAGE_V3_LEGACY_SOURCE_LOCATOR), '{"invented":true}\n', { flag: 'wx' })
    if (options.legacySidecars !== false) {
      for (const suffix of ['-wal', '-shm', '-journal']) {
        writeFileSync(join(root, `${STORAGE_V3_LEGACY_SOURCE_LOCATOR}${suffix}`), `invented${suffix}\n`, { flag: 'wx' })
      }
    }
    if (options.register !== false) {
      registerStorageV3MigrationCleanup({ db, root: rootHandle, legacySourceId: LEGACY_ID, installationKey: key })
    }
    db.close()
    const selectionInput = Object.freeze({
      directory: root,
      legacySourceId: LEGACY_ID,
      backupArtifactId: BACKUP_ID,
      backupAt,
      installationKey: key,
    })
    if (options.select !== false) {
      const selected = v3ReaderSelectionTestSeams.selectWithProofDirectorySynchronizer(
        selectionInput,
        () => {},
        options.successAt ?? SUCCESS_AT,
      )
      if (selected.reader !== 'sqlite-v3') throw new Error(`invented selection refused: ${selected.code}`)
      selected.db.close()
    }
    const markerBytes = (): ReadonlyMap<string, Buffer> => new Map(
      readdirSync(root)
        .filter((name) => name.startsWith('migration-selection-v1') || name.startsWith('revocation-replay-v1'))
        .sort()
        .map((name) => [name, readFileSync(join(root, name))]),
    )
    return Object.freeze({
      workspaceRoot,
      root,
      key,
      input: Object.freeze({ directory: root, installationKey: key }),
      selectionInput,
      selectedArtifactId,
      markerBytes,
      cleanup: () => rmSync(workspaceRoot, {
        recursive: true, force: true, maxRetries: 3, retryDelay: 50,
      }),
    })
  } catch (error) {
    if (db.open) db.close()
    rmSync(workspaceRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })
    throw error
  }
}

function cleanupAt(
  fx: Fixture,
  at = DEADLINE,
  failAfterStage?: (stage: StorageV3MigrationCleanupStage) => void,
  synchronize: (phase: 'preflight' | 'legacy' | 'backup') => void = () => {},
) {
  return v3MigrationCleanupTestSeams.cleanupAtWithDirectorySynchronizer(
    fx.input,
    at,
    (_root, phase) => synchronize(phase),
    failAfterStage,
  )
}

function expectMarkersExact(fx: Fixture, expected: ReadonlyMap<string, Buffer>): void {
  const actual = fx.markerBytes()
  expect([...actual.keys()]).toEqual([...expected.keys()])
  for (const [name, bytes] of expected) expect(actual.get(name)).toEqual(bytes)
}

function readCleanupState(fx: Fixture): Record<string, unknown> {
  const db = new Database(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore), {
    fileMustExist: true, readonly: true,
  })
  try {
    return db.prepare(
      `SELECT phase, legacy_source_id, selected_artifact_id, backup_artifact_id,
              task_fingerprint, root_binding, completed_week
       FROM migration_cleanup_state`,
    ).get() as Record<string, unknown>
  } finally { db.close() }
}

describe('LIFE-03 seven-day migration cleanup', { timeout: 30_000 }, () => {
  it('is read-only one millisecond before deadline, cleans exactly at deadline, and replays complete', async () => {
    const fx = await fixture()
    try {
      const foreignPath = join(fx.root, 'invented-foreign-sentinel.txt')
      const foreign = Buffer.from('invented foreign sentinel\n')
      writeFileSync(foreignPath, foreign, { flag: 'wx' })
      const markers = fx.markerBytes()
      const beforeNames = readdirSync(fx.root).sort()
      const beforeState = readCleanupState(fx)

      expect(cleanupAt(fx, BEFORE_DEADLINE)).toEqual({ status: 'not_due' })
      expect(readdirSync(fx.root).sort()).toEqual(beforeNames)
      expect(readCleanupState(fx)).toEqual(beforeState)
      expect(existsSync(storageV3WriterLeasePath(openStorageV3ArtifactRoot(fx.root)))).toBe(false)
      expectMarkersExact(fx, markers)

      const phases: string[] = []
      expect(cleanupAt(fx, DEADLINE, undefined, (phase) => phases.push(phase))).toEqual({ status: 'complete' })
      expect(phases).toEqual(['preflight', 'legacy', 'backup'])
      for (const locator of [
        STORAGE_V3_LEGACY_SOURCE_LOCATOR,
        `${STORAGE_V3_LEGACY_SOURCE_LOCATOR}-wal`,
        `${STORAGE_V3_LEGACY_SOURCE_LOCATOR}-shm`,
        `${STORAGE_V3_LEGACY_SOURCE_LOCATOR}-journal`,
        BACKUP_LOCATOR,
        BACKUP_MANIFEST,
      ]) expect(existsSync(join(fx.root, locator)), locator).toBe(false)
      expect(readFileSync(foreignPath)).toEqual(foreign)
      expectMarkersExact(fx, markers)
      expect(readCleanupState(fx)).toMatchObject({
        phase: 'complete',
        legacy_source_id: null,
        selected_artifact_id: null,
        backup_artifact_id: null,
        completed_week: '2026-W33',
      })
      const db = new Database(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore), { readonly: true })
      try {
        expect(db.prepare('SELECT COUNT(*) FROM migration_cleanup_file').pluck().get()).toBe(0)
        expect(db.prepare("SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'").pluck().get()).toBe(0)
      } finally { db.close() }
      expect(cleanupAt(fx, DEADLINE)).toEqual({ status: 'replayed' })
      expectMarkersExact(fx, markers)
    } finally { fx.cleanup() }
  })

  it.each(STORAGE_V3_MIGRATION_CLEANUP_STAGES)(
    'resumes an invented process interruption after %s',
    async (target) => {
      const fx = await fixture()
      try {
        const markers = fx.markerBytes()
        let reached = false
        expect(() => cleanupAt(fx, DEADLINE, (stage) => {
          if (stage === target) {
            reached = true
            throw new Error('invented cleanup interruption')
          }
        })).toThrow()
        expect(reached).toBe(true)
        const resumed = cleanupAt(fx)
        expect(['complete', 'replayed']).toContain(resumed.status)
        expect(readCleanupState(fx).phase).toBe('complete')
        expectMarkersExact(fx, markers)
      } finally { fx.cleanup() }
    },
  )

  it.each(['legacy', 'backup'] as const)('resumes after a %s directory-sync failure', async (target) => {
    const fx = await fixture()
    try {
      let reached = false
      expect(() => cleanupAt(fx, DEADLINE, undefined, (phase) => {
        if (phase === target) {
          reached = true
          throw new Error('invented directory sync failure')
        }
      })).toThrow()
      expect(reached).toBe(true)
      expect(cleanupAt(fx).status).toBe('complete')
    } finally { fx.cleanup() }
  })

  it('refuses a missing, replaced, symlinked, or hard-linked legacy object before intent', async () => {
    for (const variant of ['missing', 'replaced', 'symlink', 'hardlink'] as const) {
      const fx = await fixture()
      try {
        const source = join(fx.root, STORAGE_V3_LEGACY_SOURCE_LOCATOR)
        const foreign = join(fx.root, `invented-${variant}.txt`)
        if (variant === 'missing') unlinkSync(source)
        if (variant === 'replaced') {
          unlinkSync(source)
          writeFileSync(source, 'invented replacement\n', { flag: 'wx' })
        }
        if (variant === 'symlink') {
          unlinkSync(source)
          writeFileSync(foreign, 'invented symlink target\n', { flag: 'wx' })
          try { symlinkSync(foreign, source, 'file') } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EPERM') continue
            throw error
          }
        }
        if (variant === 'hardlink') linkSync(source, foreign)
        expect(() => cleanupAt(fx)).toThrow(StorageV3MigrationCleanupError)
        expect(readCleanupState(fx).phase, variant).toBe('ready')
        expect(existsSync(join(fx.root, BACKUP_LOCATOR)), variant).toBe(true)
      } finally { fx.cleanup() }
    }
  })

  it('refuses an absent-at-registration role that appears later', async () => {
    const fx = await fixture({ legacySidecars: false })
    try {
      const foreignSidecar = join(fx.root, `${STORAGE_V3_LEGACY_SOURCE_LOCATOR}-wal`)
      const bytes = Buffer.from('invented foreign sidecar\n')
      writeFileSync(foreignSidecar, bytes, { flag: 'wx' })
      expect(() => cleanupAt(fx)).toThrow(StorageV3MigrationCleanupError)
      expect(readFileSync(foreignSidecar)).toEqual(bytes)
      expect(readCleanupState(fx).phase).toBe('ready')
    } finally { fx.cleanup() }
  })

  it('refuses a missing, replaced, symlinked, or hard-linked backup object before intent', async () => {
    for (const variant of ['missing', 'replaced', 'symlink', 'hardlink'] as const) {
      const fx = await fixture()
      try {
        const backup = join(fx.root, BACKUP_LOCATOR)
        const foreign = join(fx.root, `invented-backup-${variant}.sqlite`)
        if (variant === 'missing') unlinkSync(backup)
        if (variant === 'replaced') {
          unlinkSync(backup)
          writeFileSync(backup, 'invented replacement backup\n', { flag: 'wx' })
        }
        if (variant === 'symlink') {
          unlinkSync(backup)
          writeFileSync(foreign, 'invented backup symlink target\n', { flag: 'wx' })
          try { symlinkSync(foreign, backup, 'file') } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EPERM') continue
            throw error
          }
        }
        if (variant === 'hardlink') linkSync(backup, foreign)
        expect(() => cleanupAt(fx)).toThrow(StorageV3MigrationCleanupError)
        expect(readCleanupState(fx).phase, variant).toBe('ready')
        expect(existsSync(join(fx.root, STORAGE_V3_LEGACY_SOURCE_LOCATOR)), variant).toBe(true)
      } finally { fx.cleanup() }
    }
  })

  it('refuses wrong key, pending maintenance, and writer contention without unlinking', async () => {
    const fx = await fixture()
    try {
      expect(() => cleanupAt({ ...fx, input: {
        directory: fx.root,
        installationKey: Object.freeze({}) as TaskInstallationKeyHandle,
      } })).toThrow()
      expect(readCleanupState(fx).phase).toBe('ready')
      expect(() => cleanupAt({ ...fx, input: {
        directory: join(fx.root, 'invented-absent-root'),
        installationKey: fx.key,
      } })).toThrow()

      withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), () => {
        expect(() => cleanupAt(fx)).toThrow()
        expect(existsSync(join(fx.root, STORAGE_V3_LEGACY_SOURCE_LOCATOR))).toBe(true)
      })

      const db = new Database(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
      try {
        const operationId = `del-${'e'.repeat(64)}`
        if (db.prepare('SELECT 1 FROM storage_maintenance_state WHERE singleton = 1').get() === undefined) {
          db.prepare(
            `INSERT INTO storage_maintenance_state (
              singleton, state, operation_id, scope_id, event_week
            ) VALUES (1, 'pending', ?, ?, ?)`,
          ).run(operationId, SCOPE_A, '2026-W32')
        } else {
          db.prepare(
            `UPDATE storage_maintenance_state
             SET state = 'pending', operation_id = ?, scope_id = ?, event_week = ?
             WHERE singleton = 1 AND state = 'complete'`,
          ).run(operationId, SCOPE_A, '2026-W32')
        }
      } finally { db.close() }
      expect(() => cleanupAt(fx)).toThrow(StorageV3MigrationCleanupError)
      expect(existsSync(join(fx.root, STORAGE_V3_LEGACY_SOURCE_LOCATOR))).toBe(true)
    } finally { fx.cleanup() }
  })

  it.each(['anchor-only', 'missing-head', 'truncated-tail'] as const)(
    'refuses invalid committed replay state: %s',
    async (variant) => {
      const fx = await fixture()
      try {
        if (variant === 'anchor-only') {
          for (const name of readdirSync(fx.root).filter((name) => name.startsWith('revocation-replay-v1-')
            && name !== STORAGE_V3_REVOCATION_REPLAY_NAMES.anchor)) unlinkSync(join(fx.root, name))
        } else if (variant === 'missing-head') {
          unlinkSync(join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head))
        } else {
          writeFileSync(join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head), '{"invented":', { flag: 'w' })
        }
        expect(() => cleanupAt(fx)).toThrow()
        expect(readCleanupState(fx).phase).toBe('ready')
        expect(existsSync(join(fx.root, STORAGE_V3_LEGACY_SOURCE_LOCATOR))).toBe(true)
      } finally { fx.cleanup() }
    },
  )

  it('selection refuses until the fixed cleanup registry is ready', async () => {
    const fx = await fixture({ register: false, select: false })
    try {
      expect(v3ReaderSelectionTestSeams.selectWithProofDirectorySynchronizer(
        fx.selectionInput, () => {}, SUCCESS_AT,
      )).toEqual({ reader: 'legacy-json', code: 'v3-selection-cleanup-refused' })
      const db = new Database(join(fx.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
      try {
        registerStorageV3MigrationCleanup({
          db,
          root: openStorageV3ArtifactRoot(fx.root),
          legacySourceId: LEGACY_ID,
          installationKey: fx.key,
        })
      } finally { db.close() }
      const selected = v3ReaderSelectionTestSeams.selectWithProofDirectorySynchronizer(
        fx.selectionInput, () => {}, SUCCESS_AT,
      )
      expect(selected.reader).toBe('sqlite-v3')
      if (selected.reader === 'sqlite-v3') selected.db.close()
    } finally { fx.cleanup() }
  })

  it('Windows production refuses an expired cleanup before the first unlink', async () => {
    if (process.platform !== 'win32') return
    const fx = await fixture({
      backupAt: '2026-01-01T00:00:00Z',
      successAt: '2026-01-01T00:00:01.000Z',
    })
    try {
      expect(() => cleanupExpiredStorageV3Migration(fx.input)).toThrow(StorageV3MigrationCleanupError)
      expect(readCleanupState(fx).phase).toBe('ready')
      expect(existsSync(join(fx.root, STORAGE_V3_LEGACY_SOURCE_LOCATOR))).toBe(true)
      expect(existsSync(storageV3WriterLeasePath(openStorageV3ArtifactRoot(fx.root)))).toBe(false)
    } finally { fx.cleanup() }
  })

  it('keeps the external selection marker and committed replay family byte-exact', async () => {
    const fx = await fixture()
    try {
      const before = fx.markerBytes()
      expect(before.has(STORAGE_V3_SELECTION_PROOF_NAMES.final)).toBe(true)
      expect(before.has(STORAGE_V3_REVOCATION_REPLAY_NAMES.anchor)).toBe(true)
      expect(before.has(STORAGE_V3_REVOCATION_REPLAY_NAMES.head)).toBe(true)
      expect(cleanupAt(fx).status).toBe('complete')
      expectMarkersExact(fx, before)
    } finally { fx.cleanup() }
  })
})
