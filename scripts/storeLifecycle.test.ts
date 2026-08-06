import {
  existsSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInstallationAliases } from '../server/storage/installationAliases.js'
import {
  assertSelectableStorageV3Target,
  StorageV3ShadowMigrationError,
} from '../server/storage/v3ShadowMigration.js'
import { completeStorageV3DeletionMaintenance } from '../server/storage/v3Deletion.js'
import {
  openSelectedStorageV3Store,
  STORAGE_V3_STORE_FILE_NAME,
  STORAGE_V3_TARGET_FILE_NAMES,
  STORAGE_V3_PUBLICATION_FAILURE_STAGES,
} from '../server/storage/v3StoreFiles.js'
import {
  INVENTED_COHORTS,
  INVENTED_INSTALLATION_KEY_BYTE,
  INVENTED_SOURCE_FILE_NAME,
  createInventedV2Source,
  migrateInventedSource,
  runStoreLifecycleCli,
  runStoreLifecycleDemo,
  STORE_LIFECYCLE_ENV_FLAG,
} from './storeLifecycle.js'

const enabled = { [STORE_LIFECYCLE_ENV_FLAG]: '1' }

const entries = (directory: string): string[] => readdirSync(directory).sort()

const storePath = (directory: string): string => join(directory, STORAGE_V3_STORE_FILE_NAME)

const isTemporaryArtifact = (name: string): boolean =>
  name.startsWith(INVENTED_SOURCE_FILE_NAME)
  || name.startsWith(STORAGE_V3_TARGET_FILE_NAMES.primary)
  || name.startsWith(STORAGE_V3_TARGET_FILE_NAMES.replay)

describe('store lifecycle command', () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'developer-lens-store-lifecycle-'))
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('runs the invented journey from source to swept, re-validated store', () => {
    const lines: string[] = []
    const result = runStoreLifecycleDemo({ directory, log: (line) => lines.push(line) })

    expect(result.migration).toEqual({ status: 'complete', checksumLength: 64 })
    expect(result.cas).toEqual({
      scopes: 3,
      firstApply: 'applied',
      replayApply: 'replayed',
      revisions: [0, 0, 1],
    })
    expect(result.sweep.status).toBe('complete')
    expect(result.sweep.clearedTotal).toBe(10)
    expect(result.sweep.lineageEvents).toBe(5)
    expect(result.deletion).toEqual({
      status: 'deleted',
      replay: 'replayed',
      rowsRemoved: 15,
      // scope + claim + job + snapshot + checkpoint + coverage + evidence
      tombstonesWritten: 7,
      remainingScopes: 2,
      otherScopesIntact: true,
      casScopesRemaining: 2,
      deletionRecords: { tombstone_cascade: 7, legacy_deletion_operation: 1 },
      maintenance: 'complete',
    })
    expect(result.report.tableCounts).toMatchObject({
      claim_scope: 2,
      repository_identity: 2,
      continuity_cas_state: 2,
      continuity_cas_operation: 0,
      import_run: 0,
      coverage_observation: 0,
      v2_coverage_record: 0,
      // 1 migrated legacy record + 5 sweep events + 7 B3 tombstones
      lineage_event: 13,
    })
    expect(result.report.casRevisions).toEqual([0, 0])
    expect(result.lines).toEqual(lines)
    expect(lines).toHaveLength(7)

    expect(existsSync(storePath(directory))).toBe(true)
    expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary))).toBe(false)
    expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.replay))).toBe(false)
    const catalogued = openSelectedStorageV3Store(directory)
    try {
      expect(catalogued.prepare(
        'SELECT kind, state, relative_locator FROM app_artifact ORDER BY kind',
      ).all()).toEqual([{
        kind: 'selected_store',
        state: 'active',
        relative_locator: STORAGE_V3_STORE_FILE_NAME,
      }])
      expect(catalogued.prepare(
        'SELECT COUNT(*) FROM app_artifact_scope',
      ).pluck().get()).toBe(2)
    } finally { catalogued.close() }
  })

  it('admits accumulated CAS state on selection while acceptance-mode validation refuses it', () => {
    runStoreLifecycleDemo({ directory })
    const store = openSelectedStorageV3Store(directory)
    try {
      expect(() => assertSelectableStorageV3Target(store)).toThrow()
      expect(() => assertSelectableStorageV3Target(store, { allowContinuityCasState: true })).not.toThrow()
    } finally {
      store.close()
    }
  })

  it('prints counts and statuses without any invented identifier or key material', () => {
    const lines: string[] = []
    runStoreLifecycleDemo({ directory, log: (line) => lines.push(line) })
    const key = Buffer.alloc(32, INVENTED_INSTALLATION_KEY_BYTE)
    const aliases = createInstallationAliases(key)
    const forbidden = [
      key.toString('hex'),
      key.toString('base64'),
      directory,
      ...INVENTED_COHORTS.flatMap(({ rawProviderId }) => [
        rawProviderId,
        aliases.repositoryProviderId(rawProviderId),
        aliases.repositoryAnalyticalKey(rawProviderId),
      ]),
    ]
    const output = lines.join('\n')
    for (const value of forbidden) expect(output).not.toContain(value)
    expect(output).not.toMatch(/[0-9a-f]{32}/)
    expect(output).not.toMatch(/scope-|cl_|op-|del-/)
  })

  it('leaves no store when the migration is interrupted and recovers over stale files', () => {
    expect(() => runStoreLifecycleDemo({
      directory,
      failAfterStage: (kind, stage) => {
        if (kind === 'primary' && stage === 'claims') throw new Error('invented interruption')
      },
    })).toThrow(StorageV3ShadowMigrationError)
    expect(existsSync(storePath(directory))).toBe(false)
    expect(entries(directory).every(isTemporaryArtifact)).toBe(true)

    // A crash that never unwinds leaves the temporary targets behind; the next
    // run must remove them rather than open whatever they contain.
    for (const name of Object.values(STORAGE_V3_TARGET_FILE_NAMES)) {
      writeFileSync(join(directory, name), 'invented stale bytes, not a database')
      for (const suffix of ['-wal', '-shm', '-journal']) {
        writeFileSync(join(directory, `${name}${suffix}`), 'invented stale sidecar')
      }
    }
    const recovered = runStoreLifecycleDemo({ directory })
    expect(recovered.migration.status).toBe('complete')
    expect(recovered.sweep.clearedTotal).toBe(10)
    expect(existsSync(storePath(directory))).toBe(true)
    expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary))).toBe(false)
    expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.replay))).toBe(false)
    expect(entries(directory).some((name) => name.includes('.tmp.sqlite-'))).toBe(false)
  })

  it.skipIf(process.platform === 'win32')(
    'refuses a dangling fixed-target symlink without writing outside the reviewed root',
    () => {
      const primary = join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary)
      const outside = join(tmpdir(), `developer-lens-dangling-target-${process.pid}.sqlite`)
      rmSync(outside, { force: true })
      symlinkSync(outside, primary, 'file')

      expect(() => runStoreLifecycleDemo({ directory })).toThrow(StorageV3ShadowMigrationError)
      expect(existsSync(outside)).toBe(false)
      expect(existsSync(storePath(directory))).toBe(false)
    },
  )

  it.skipIf(process.platform === 'win32')(
    'refuses a dangling selected-store WAL before publication without touching its outside target',
    () => {
      const outside = join(tmpdir(), `developer-lens-dangling-selected-wal-${process.pid}.sqlite`)
      const selectedWal = join(directory, `${STORAGE_V3_STORE_FILE_NAME}-wal`)
      rmSync(outside, { force: true })
      symlinkSync(outside, selectedWal, 'file')
      expect(() => runStoreLifecycleDemo({ directory })).toThrow(StorageV3ShadowMigrationError)
      expect(existsSync(outside)).toBe(false)
      expect(existsSync(storePath(directory))).toBe(false)
      expect(() => lstatSync(selectedWal)).toThrow()
    },
  )

  it('refuses to accept a second migration over an existing store', () => {
    runStoreLifecycleDemo({ directory })
    const before = readFileSync(storePath(directory))
    expect(() => runStoreLifecycleDemo({ directory })).toThrow(StorageV3ShadowMigrationError)
    expect(readFileSync(storePath(directory)).equals(before)).toBe(true)
    expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary))).toBe(false)
  })

  it('recovers publication interrupted between linking the store and unlinking the primary', () => {
    runStoreLifecycleDemo({ directory })
    const primary = join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary)
    linkSync(storePath(directory), primary)

    const recovered = openSelectedStorageV3Store(directory)
    try {
      expect(recovered.prepare('SELECT COUNT(*) FROM claim_scope').pluck().get()).toBe(2)
      expect(existsSync(storePath(directory))).toBe(true)
      expect(existsSync(primary)).toBe(false)
    } finally {
      recovered.close()
    }
  })

  it('proves shared-artifact deletion lineage and explicit survivor catalogue semantics', () => {
    const result = runStoreLifecycleDemo({ directory, includeSharedArtifactFixture: true })
    expect(result.deletion.deletionRecords.index_deleted).toBe(1)
    expect(result.deletion.otherScopesIntact).toBe(true)
    expect(existsSync(join(directory, 'migration-backup-20260201T000000Z.sqlite'))).toBe(false)
    expect(existsSync(join(directory, 'invented-survivor-only.sqlite'))).toBe(true)
    const store = openSelectedStorageV3Store(directory)
    try {
      expect(store.prepare(
        `SELECT COUNT(*) FROM app_artifact_scope
         WHERE artifact_id IN (
           SELECT artifact_id FROM app_artifact
           WHERE relative_locator = 'migration-backup-20260201T000000Z.sqlite'
         )`,
      ).pluck().get()).toBe(0)
      expect(store.prepare(
        `SELECT kind FROM app_artifact WHERE relative_locator = 'invented-survivor-only.sqlite'`,
      ).pluck().get()).toBe('invented_fixture_store')
      expect(store.prepare(
        `SELECT scope_id, event_kind FROM lineage_event
         WHERE subject_kind = 'artifact' AND event_kind = 'index_deleted'`,
      ).all()).toHaveLength(1)
    } finally { store.close() }
  })

  it('reopens an interrupted shared-artifact maintenance saga without stranded deletion state', () => {
    expect(() => runStoreLifecycleDemo({
      directory,
      includeSharedArtifactFixture: true,
      failAfterArtifactStage: (stage) => {
        if (stage === 'sidecarsDeleted') throw new Error('invented crash')
      },
    })).toThrow()
    const reopened = openSelectedStorageV3Store(directory)
    try {
      expect(completeStorageV3DeletionMaintenance(reopened).maintenance).toBe('complete')
      expect(reopened.prepare(
        `SELECT 1 FROM app_artifact
         WHERE relative_locator = 'migration-backup-20260201T000000Z.sqlite'`,
      ).get()).toBeUndefined()
      expect(reopened.prepare(
        `SELECT state FROM app_artifact WHERE state = 'deleting'`,
      ).get()).toBeUndefined()
      expect(reopened.prepare(
        `SELECT scope_id, event_kind FROM lineage_event
         WHERE subject_kind = 'artifact' AND subject_id = ?`,
      ).get(`art-${'a'.repeat(64)}`)).toEqual({ scope_id: null, event_kind: 'index_deleted' })
    } finally { reopened.close() }
  })

  it.each(STORAGE_V3_PUBLICATION_FAILURE_STAGES)(
    'leaves one unambiguous publication result after injected %s failure',
    (stage) => {
      if (stage === 'rollback-unlink') {
        const source = createInventedV2Source(directory)
        try {
          expect(migrateInventedSource(source, directory, undefined, stage).status).toBe('complete')
        } finally { source.db.close() }
        expect(existsSync(storePath(directory))).toBe(true)
        expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary))).toBe(true)
        const reopened = openSelectedStorageV3Store(directory, { failAtRecoveryStage: 'primary-unlink' })
        try {
          expect(reopened.prepare('SELECT COUNT(*) FROM claim_scope').pluck().get()).toBe(3)
        } finally { reopened.close() }
        expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary))).toBe(true)
        const reopenedAgain = openSelectedStorageV3Store(directory, { failAtRecoveryStage: 'primary-unlink' })
        try {
          expect(reopenedAgain.prepare('SELECT COUNT(*) FROM claim_scope').pluck().get()).toBe(3)
        } finally { reopenedAgain.close() }
        expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary))).toBe(true)
        const cleaned = openSelectedStorageV3Store(directory)
        cleaned.close()
        expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary))).toBe(false)
      } else {
        expect(() => runStoreLifecycleDemo({
          directory,
          failAtPublicationStage: stage,
        })).toThrow(StorageV3ShadowMigrationError)
        expect(existsSync(storePath(directory))).toBe(false)
        const reopened = () => openSelectedStorageV3Store(directory)
        expect(reopened).toThrow()
      }
    },
  )

  it('refuses every invocation without the environment flag and an explicit directory', () => {
    const lines: string[] = []
    const log = (line: string): void => { lines.push(line) }
    expect(runStoreLifecycleCli(['demo', '--dir', directory], {}, log)).toBe(1)
    expect(lines[0]).toContain(STORE_LIFECYCLE_ENV_FLAG)
    expect(runStoreLifecycleCli(['demo'], enabled, log)).toBe(1)
    expect(runStoreLifecycleCli([], enabled, log)).toBe(1)
    expect(runStoreLifecycleCli(['demo', '--dir'], enabled, log)).toBe(1)
    expect(runStoreLifecycleCli(['delete-everything', '--dir', directory], enabled, log)).toBe(1)
    expect(lines.some((line) => line.includes('never defaults to a directory'))).toBe(true)
    expect(entries(directory)).toEqual([])
  })

  it('reports and sweeps a selected store through the command surface', () => {
    const lines: string[] = []
    const log = (line: string): void => { lines.push(line) }
    expect(runStoreLifecycleCli(['demo', '--dir', directory], enabled, log)).toBe(0)
    lines.length = 0
    expect(runStoreLifecycleCli(['status', '--dir', directory], enabled, log)).toBe(0)
    expect(lines.join('\n')).toContain('cas-scopes=2')
    expect(lines.join('\n')).toContain('cas: revisions=0,0')

    lines.length = 0
    expect(runStoreLifecycleCli(
      ['sweep', '--dir', directory, '--as-of', '2027-02-01T00:00:00.000Z'],
      enabled,
      log,
    )).toBe(0)
    expect(lines[0]).toMatch(/^sweep: status=complete cleared=10 lineage=5 /)

    lines.length = 0
    expect(runStoreLifecycleCli(['sweep', '--dir', directory, '--as-of', 'not-a-timestamp'], enabled, log))
      .toBe(1)
    expect(lines[0]).toBe('failed: INVALID_TIMESTAMP')
  })

  it('refuses a status report when no store has been selected', () => {
    const lines: string[] = []
    expect(runStoreLifecycleCli(['status', '--dir', directory], enabled, (line) => lines.push(line)))
      .toBe(1)
    expect(lines[0]).toBe('failed: STORAGE_V3_STORE_FILE_REFUSED')
    expect(entries(directory)).toEqual([])
  })
})
