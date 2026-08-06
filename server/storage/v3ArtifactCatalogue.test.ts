import {
  mkdirSync,
  copyFileSync,
  existsSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  assertPublishedStorageV3ArtifactCatalogue,
  bindStorageV3ArtifactRoot,
  createStorageV3ArtifactRoot,
  openStorageV3ArtifactRoot,
  registerSelectedStorageV3Artifact,
  registerStorageV3Artifact,
  STORAGE_V3_ARTIFACT_DELETION_STAGES,
  STORAGE_V3_ARTIFACT_LOCATORS,
  STORAGE_V3_USER_DIRECTED_ARTIFACTS,
  StorageV3ArtifactError,
  storageV3MaintenanceStatus,
  syncStorageV3ArtifactDirectory,
} from './v3ArtifactCatalogue.js'
import {
  completeStorageV3DeletionMaintenance,
  deleteStorageV3Scope,
  readStorageV3DeletionLineage,
  STORAGE_V3_DELETION_MAINTENANCE_STAGES,
  StorageV3DeletionError,
} from './v3Deletion.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import { openSelectedStorageV3Store, StorageV3StoreFileError } from './v3StoreFiles.js'

const SCOPE_A = `scope-${'a'.repeat(64)}`
const SCOPE_B = `scope-${'b'.repeat(64)}`
const DELETE_AT = '2026-03-02T00:00:00.000Z'

interface FileFixture {
  readonly root: string
  readonly store: Database.Database
  cleanup(): void
}

function freshSelectedStore(): FileFixture {
  const root = mkdtempSync(join(tmpdir(), 'developer-lens-b4-'))
  const rootHandle = createStorageV3ArtifactRoot(root)
  const path = join(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
  const db = new Database(path)
  installStorageV3ShadowSchema(db)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_A)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_B)
  registerSelectedStorageV3Artifact(db, rootHandle, () => Buffer.alloc(32, 1))
  db.close()
  const store = openSelectedStorageV3Store(root)
  return {
    root,
    store,
    cleanup(): void {
      if (store.open) store.close()
      rmSync(root, { recursive: true, force: true })
    },
  }
}

function writeInventedSqlite(path: string): void {
  const db = new Database(path)
  db.exec('CREATE TABLE invented_fixture (value INTEGER) STRICT')
  db.prepare('INSERT INTO invented_fixture (value) VALUES (1)').run()
  db.close()
}

function registerFixture(
  fixture: FileFixture,
  locator: string,
  scopeIds: readonly string[],
  byte: number,
  kind: 'invented_fixture_store' | 'migration_backup_v1' = 'invented_fixture_store',
): string {
  writeInventedSqlite(join(fixture.root, locator))
  return registerStorageV3Artifact({
    db: fixture.store,
    kind,
    relativeLocator: locator,
    scopeIds,
    randomBytes: () => Buffer.alloc(32, byte),
  }).artifactId
}

function expectArtifactError(run: () => unknown): void {
  try {
    run()
    throw new Error('expected artifact refusal')
  } catch (error) {
    expect(error).toBeInstanceOf(StorageV3ArtifactError)
    expect(error).toMatchObject({
      code: 'STORAGE_V3_ARTIFACT_INVALID',
      message: 'STORAGE_V3_ARTIFACT_INVALID',
    })
  }
}

function expectMaintenanceFailure(run: () => unknown): void {
  try {
    run()
    throw new Error('expected maintenance failure')
  } catch (error) {
    expect(error).toBeInstanceOf(StorageV3DeletionError)
    expect(error).toMatchObject({ code: 'MAINTENANCE_FAILED', message: 'MAINTENANCE_FAILED' })
  }
}

describe('LIFE-02 B4 app-owned artifact catalogue', { timeout: 30_000 }, () => {
  it('catalogues the selected store without persisting an absolute path', () => {
    const fixture = freshSelectedStore()
    try {
      assertPublishedStorageV3ArtifactCatalogue(fixture.store)
      const artifact = fixture.store.prepare(
        `SELECT artifact_id, kind, state, manifest_sha256, content_sha256, relative_locator,
                deletion_operation_id, deletion_scope_id, deletion_week
         FROM app_artifact`,
      ).get() as Record<string, unknown>
      expect(artifact).toMatchObject({
        kind: 'selected_store',
        state: 'active',
        relative_locator: STORAGE_V3_ARTIFACT_LOCATORS.selectedStore,
        deletion_operation_id: null,
        deletion_scope_id: null,
        deletion_week: null,
      })
      expect(artifact.artifact_id).toMatch(/^art-[0-9a-f]{64}$/)
      expect(artifact.manifest_sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(artifact.content_sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(JSON.stringify(artifact)).not.toContain(fixture.root)
      expect(fixture.store.prepare(
        'SELECT scope_id FROM app_artifact_scope ORDER BY scope_id',
      ).pluck().all()).toEqual([SCOPE_A, SCOPE_B])
    } finally { fixture.cleanup() }
  })

  it('binds one database to one immutable reviewed root', () => {
    const rootA = mkdtempSync(join(tmpdir(), 'developer-lens-b4-bind-a-'))
    const rootB = mkdtempSync(join(tmpdir(), 'developer-lens-b4-bind-b-'))
    const db = new Database(join(rootA, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
    try {
      installStorageV3ShadowSchema(db)
      const handleA = openStorageV3ArtifactRoot(rootA)
      const handleA2 = openStorageV3ArtifactRoot(rootA)
      const handleB = openStorageV3ArtifactRoot(rootB)
      bindStorageV3ArtifactRoot(db, handleA)
      expect(() => bindStorageV3ArtifactRoot(db, handleA2)).not.toThrow()
      expectArtifactError(() => bindStorageV3ArtifactRoot(db, handleB))
      writeInventedSqlite(join(rootB, 'invented-b-only.sqlite'))
      expect(() => registerStorageV3Artifact({
        db,
        kind: 'invented_fixture_store',
        relativeLocator: 'invented-b-only.sqlite',
        scopeIds: [SCOPE_A],
      })).toThrow()
      expect(existsSync(join(rootB, 'invented-b-only.sqlite'))).toBe(true)
      expect(db.prepare(
        'SELECT 1 FROM app_artifact WHERE relative_locator = ?',
      ).get('invented-b-only.sqlite')).toBeUndefined()
    } finally {
      db.close()
      rmSync(rootA, { recursive: true, force: true })
      rmSync(rootB, { recursive: true, force: true })
    }
  })

  it('rejects INSERT OR REPLACE from deleting catalogue rows or ownership', () => {
    const fixture = freshSelectedStore()
    try {
      const selected = fixture.store.prepare(
        `SELECT artifact_id, manifest_sha256, content_sha256, relative_locator
         FROM app_artifact WHERE kind = 'selected_store'`,
      ).get() as Record<string, string>
      expect(() => fixture.store.prepare(
        `INSERT OR REPLACE INTO app_artifact (
          artifact_id, kind, state, manifest_sha256, content_sha256, relative_locator
        ) VALUES (?, 'selected_store', 'active', ?, ?, ?)`
      ).run(selected.artifact_id, selected.manifest_sha256, selected.content_sha256, selected.relative_locator))
        .toThrow(/STORAGE_V3_ARTIFACT_INVALID/)
      expect(fixture.store.prepare('SELECT COUNT(*) FROM app_artifact').pluck().get()).toBe(1)
      expect(fixture.store.prepare('SELECT COUNT(*) FROM app_artifact_scope').pluck().get()).toBe(2)

      const artifactId = registerFixture(fixture, 'invented-replace.sqlite', [SCOPE_A, SCOPE_B], 15)
      deleteStorageV3Scope({
        db: fixture.store,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 16),
      })
      const pending = fixture.store.prepare(
        `SELECT artifact_id, kind, state, manifest_sha256, content_sha256, relative_locator,
                deletion_operation_id, deletion_scope_id, deletion_week
         FROM app_artifact WHERE artifact_id = ?`,
      ).get(artifactId) as Record<string, string>
      expect(() => fixture.store.prepare(
        `INSERT OR REPLACE INTO app_artifact (
          artifact_id, kind, state, manifest_sha256, content_sha256, relative_locator,
          deletion_operation_id, deletion_scope_id, deletion_week
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        pending.artifact_id, pending.kind, pending.state, pending.manifest_sha256,
        pending.content_sha256, pending.relative_locator, pending.deletion_operation_id,
        pending.deletion_scope_id, pending.deletion_week,
      )).toThrow(/STORAGE_V3_ARTIFACT_INVALID/)
      expect(fixture.store.prepare('SELECT state FROM app_artifact WHERE artifact_id = ?').pluck().get(artifactId))
        .toBe('pending')
      expect(storageV3MaintenanceStatus(fixture.store)).toBe('pending')
    } finally { fixture.cleanup() }
  })

  it('deletes a shared artifact whole, preserves other scopes artifacts, and compacts the selected store', () => {
    const fixture = freshSelectedStore()
    try {
      const sharedLocator = 'invented-backup-20260302T000000Z.sqlite'
      const otherLocator = 'invented-b-only.sqlite'
      const sharedId = registerFixture(
        fixture,
        sharedLocator,
        [SCOPE_A, SCOPE_B],
        2,
      )
      const otherId = registerFixture(fixture, otherLocator, [SCOPE_B], 3)
      const sharedFamily = [
        join(fixture.root, sharedLocator),
        ...['-wal', '-shm', '-journal'].map((suffix) => join(fixture.root, `${sharedLocator}${suffix}`)),
      ]
      for (const sidecar of sharedFamily.slice(1)) writeFileSync(sidecar, 'invented sidecar')
      const result = deleteStorageV3Scope({
        db: fixture.store,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 4),
      })
      expect(result.maintenance).toBe('pending')
      expect(storageV3MaintenanceStatus(fixture.store)).toBe('pending')
      expect(fixture.store.prepare(
        'SELECT state FROM app_artifact WHERE artifact_id = ?',
      ).pluck().get(sharedId)).toBe('pending')
      expect(fixture.store.prepare(
        'SELECT state FROM app_artifact WHERE artifact_id = ?',
      ).pluck().get(otherId)).toBe('active')

      const completed = completeStorageV3DeletionMaintenance(fixture.store)
      expect(completed).toEqual({ maintenance: 'complete', artifactsDeleted: 1 })
      expect(sharedFamily.every((path) => !existsSync(path))).toBe(true)
      expect(existsSync(join(fixture.root, otherLocator))).toBe(true)
      expect(fixture.store.prepare(
        'SELECT 1 FROM app_artifact WHERE artifact_id = ?',
      ).get(sharedId)).toBeUndefined()
      expect(fixture.store.prepare(
        'SELECT 1 FROM app_artifact WHERE artifact_id = ?',
      ).get(otherId)).toBeDefined()
      expect(fixture.store.prepare(
        `SELECT scope_id FROM app_artifact_scope
         WHERE artifact_id IN (SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store')
         ORDER BY scope_id`,
      ).pluck().all()).toEqual([SCOPE_B])
      expect(readStorageV3DeletionLineage(fixture.store)).toContainEqual(expect.objectContaining({
        subjectKind: 'artifact',
        subjectId: sharedId,
        operationId: result.operationId,
        causedBy: SCOPE_A,
        eventKind: 'index_deleted',
        eventWeek: '2026-W10',
      }))
      expect(storageV3MaintenanceStatus(fixture.store)).toBe('complete')
    } finally { fixture.cleanup() }
  })

  it('reconciles shared-artifact subjects and causes across a crash-reopen', () => {
    const fixture = freshSelectedStore()
    try {
      const locator = 'migration-backup-20260302T000001Z.sqlite'
      const artifactId = registerFixture(fixture, locator.replace('migration-backup-', 'invented-backup-'), [SCOPE_A, SCOPE_B], 13)
      const survivorId = registerFixture(fixture, 'invented-survivor-cause.sqlite', [SCOPE_B], 15)
      fixture.store.prepare(`INSERT INTO lineage_event (
        scope_id, subject_kind, subject_id, operation_id, capability_id,
        caused_by, event_kind, event_week
      ) VALUES (?, 'artifact', ?, ?, 'github.core', NULL, 'index_built', '2026-W09')`)
        .run(SCOPE_B, survivorId, `op-${'1'.repeat(64)}`)
      fixture.store.prepare(`INSERT INTO lineage_event (
        scope_id, subject_kind, subject_id, operation_id, capability_id,
        caused_by, event_kind, event_week
      ) VALUES (?, 'artifact', ?, ?, 'github.core', ?, 'index_built', '2026-W09')`)
        .run(SCOPE_B, survivorId, `op-${'2'.repeat(64)}`, artifactId)
      deleteStorageV3Scope({
        db: fixture.store,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 14),
      })
      expectMaintenanceFailure(() => completeStorageV3DeletionMaintenance(fixture.store, {
        failAfterArtifactStage: (stage) => {
          if (stage === 'sidecarsDeleted') throw new Error('invented crash')
        },
      }))
      fixture.store.close()
      const reopened = openSelectedStorageV3Store(fixture.root)
      try {
        expect(completeStorageV3DeletionMaintenance(reopened).maintenance).toBe('complete')
        expect(reopened.prepare(
          'SELECT 1 FROM lineage_event WHERE caused_by = ?',
        ).get(artifactId)).toBeUndefined()
        expect(reopened.prepare(
          `SELECT 1 FROM lineage_event
           WHERE subject_kind = 'artifact' AND subject_id = ? AND event_kind = 'index_built'`,
        ).get(survivorId)).toBeDefined()
        expect(reopened.prepare(
          "SELECT 1 FROM app_artifact WHERE state = 'deleting'",
        ).get()).toBeUndefined()
        expect(reopened.prepare(
          `SELECT scope_id, event_kind FROM lineage_event
           WHERE subject_kind = 'artifact' AND subject_id = ?`,
        ).get(artifactId)).toEqual({ scope_id: null, event_kind: 'index_deleted' })
      } finally { reopened.close() }
    } finally { fixture.cleanup() }
  })

  it.each(STORAGE_V3_ARTIFACT_DELETION_STAGES)(
    'resumes an injected %s interruption without resurrecting the artifact',
    (stage) => {
      const fixture = freshSelectedStore()
      const locator = `invented-${stage}.sqlite`
      try {
        const artifactId = registerFixture(fixture, locator, [SCOPE_A, SCOPE_B], 5)
        deleteStorageV3Scope({
          db: fixture.store,
          scopeId: SCOPE_A,
          asOf: DELETE_AT,
          randomBytes: () => Buffer.alloc(32, 6),
        })
        expectMaintenanceFailure(() => completeStorageV3DeletionMaintenance(fixture.store, {
          failAfterArtifactStage: (actual) => {
            if (actual === stage) throw new Error('invented crash')
          },
        }))
        expect(storageV3MaintenanceStatus(fixture.store)).toBe('pending')
        fixture.store.close()
        const reopened = openSelectedStorageV3Store(fixture.root)
        try {
          expect(storageV3MaintenanceStatus(reopened)).toBe('pending')
          expect(completeStorageV3DeletionMaintenance(reopened).maintenance).toBe('complete')
          expect(existsSync(join(fixture.root, locator))).toBe(false)
          expect(reopened.prepare(
            'SELECT 1 FROM app_artifact WHERE artifact_id = ?',
          ).get(artifactId)).toBeUndefined()
          expect(storageV3MaintenanceStatus(reopened)).toBe('complete')
          expect(reopened.prepare(
            'SELECT 1 FROM claim_scope WHERE scope_id = ?',
          ).get(SCOPE_A)).toBeUndefined()
          expect(reopened.prepare(
            'SELECT 1 FROM claim_scope WHERE scope_id = ?',
          ).get(SCOPE_B)).toBeDefined()
        } finally { reopened.close() }
      } finally { fixture.cleanup() }
    },
  )

  it.each(STORAGE_V3_DELETION_MAINTENANCE_STAGES)(
    'resumes an injected %s maintenance interruption across a real reopen',
    (stage) => {
      const fixture = freshSelectedStore()
      try {
        deleteStorageV3Scope({
          db: fixture.store,
          scopeId: SCOPE_A,
          asOf: DELETE_AT,
          randomBytes: () => Buffer.alloc(32, 7),
        })
        expectMaintenanceFailure(() => completeStorageV3DeletionMaintenance(fixture.store, {
          failAfterStage: (actual) => {
            if (actual === stage) throw new Error('invented crash')
          },
        }))
        const expectedInterruptedState = stage === 'markerCompleted' || stage === 'checkpointed'
          ? 'complete'
          : 'pending'
        expect(storageV3MaintenanceStatus(fixture.store)).toBe(expectedInterruptedState)
        fixture.store.close()

        const reopened = openSelectedStorageV3Store(fixture.root)
        try {
          expect(storageV3MaintenanceStatus(reopened)).toBe(expectedInterruptedState)
          expect(completeStorageV3DeletionMaintenance(reopened).maintenance).toBe('complete')
          expect(reopened.prepare(
            'SELECT 1 FROM claim_scope WHERE scope_id = ?',
          ).get(SCOPE_A)).toBeUndefined()
          expect(reopened.prepare(
            'SELECT 1 FROM claim_scope WHERE scope_id = ?',
          ).get(SCOPE_B)).toBeDefined()
          expect(storageV3MaintenanceStatus(reopened)).toBe('complete')
        } finally { reopened.close() }
      } finally { fixture.cleanup() }
    },
  )

  it('refuses traversal, hard links, unknown kinds, and mutable catalogue identity', () => {
    const fixture = freshSelectedStore()
    const outside = join(tmpdir(), `developer-lens-b4-outside-${process.pid}.sqlite`)
    try {
      writeInventedSqlite(outside)
      expectArtifactError(() => registerStorageV3Artifact({
        db: fixture.store,
        kind: 'invented_fixture_store',
        relativeLocator: '../outside.sqlite',
        scopeIds: [SCOPE_A],
      }))
      const linked = join(fixture.root, 'invented-linked.sqlite')
      linkSync(outside, linked)
      expectArtifactError(() => registerStorageV3Artifact({
        db: fixture.store,
        kind: 'invented_fixture_store',
        relativeLocator: 'invented-linked.sqlite',
        scopeIds: [SCOPE_A],
      }))
      writeInventedSqlite(join(fixture.root, 'invented-ownerless.sqlite'))
      expectArtifactError(() => registerStorageV3Artifact({
        db: fixture.store,
        kind: 'invented_fixture_store',
        relativeLocator: 'invented-ownerless.sqlite',
        scopeIds: [],
      }))
      expect(fixture.store.prepare(
        'SELECT 1 FROM app_artifact WHERE relative_locator = ?',
      ).get('invented-ownerless.sqlite')).toBeUndefined()
      expect(() => assertPublishedStorageV3ArtifactCatalogue(fixture.store)).not.toThrow()

      const deletedArtifactId = `art-${'e'.repeat(64)}`
      fixture.store.prepare(`INSERT INTO lineage_event (
        scope_id, subject_kind, subject_id, operation_id, capability_id,
        caused_by, event_kind, event_week
      ) VALUES (NULL, 'artifact', ?, ?, 'github.core', NULL, 'index_deleted', '2026-W10')`)
        .run(deletedArtifactId, `del-${'d'.repeat(64)}`)
      writeInventedSqlite(join(fixture.root, 'invented-reused-id.sqlite'))
      expectArtifactError(() => registerStorageV3Artifact({
        db: fixture.store,
        kind: 'invented_fixture_store',
        relativeLocator: 'invented-reused-id.sqlite',
        scopeIds: [SCOPE_A],
        artifactId: deletedArtifactId,
      }))
      expect(fixture.store.prepare(
        'SELECT 1 FROM app_artifact WHERE artifact_id = ?',
      ).get(deletedArtifactId)).toBeUndefined()
      expect(() => fixture.store.prepare(
        `INSERT INTO app_artifact (
          artifact_id, kind, state, manifest_sha256, content_sha256, relative_locator
        ) VALUES (?, 'future_domain', 'active', ?, ?, 'future.sqlite')`,
      ).run(`art-${'f'.repeat(64)}`, '0'.repeat(64), '0'.repeat(64))).toThrow()

      const id = registerFixture(fixture, 'invented-immutable.sqlite', [SCOPE_A], 7)
      expectArtifactError(() => registerStorageV3Artifact({
        db: fixture.store,
        kind: 'invented_fixture_store',
        relativeLocator: 'invented-immutable.sqlite',
        scopeIds: [SCOPE_B],
      }))
      expect(() => fixture.store.prepare(
        'UPDATE app_artifact SET manifest_sha256 = ? WHERE artifact_id = ?',
      ).run('9'.repeat(64), id)).toThrow(/STORAGE_V3_ARTIFACT_INVALID/)
      expect(() => fixture.store.prepare(
        'UPDATE app_artifact SET content_sha256 = ? WHERE artifact_id = ?',
      ).run('8'.repeat(64), id)).toThrow(/STORAGE_V3_ARTIFACT_INVALID/)
      expect(existsSync(outside)).toBe(true)
    } finally {
      fixture.cleanup()
      rmSync(outside, { force: true })
    }
  })

  it('refuses a hard-linked selected-store child even when its schema is valid', () => {
    const fixture = freshSelectedStore()
    const outside = join(tmpdir(), `developer-lens-b4-selected-outside-${process.pid}.sqlite`)
    try {
      fixture.store.close()
      const selected = join(fixture.root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
      renameSync(selected, outside)
      linkSync(outside, selected)
      expect(() => openSelectedStorageV3Store(fixture.root)).toThrow(StorageV3StoreFileError)
      expect(existsSync(outside)).toBe(true)
    } finally {
      fixture.cleanup()
      rmSync(outside, { force: true })
    }
  })

  it.skipIf(process.platform === 'win32')('refuses a dangling selected sidecar without following it', () => {
    const fixture = freshSelectedStore()
    const outside = join(tmpdir(), `developer-lens-b4-dangling-sidecar-${process.pid}`)
    const locator = 'invented-dangling-sidecar.sqlite'
    try {
      writeInventedSqlite(join(fixture.root, locator))
      symlinkSync(outside, `${join(fixture.root, locator)}-wal`, 'file')
      expectArtifactError(() => registerStorageV3Artifact({
        db: fixture.store,
        kind: 'invented_fixture_store',
        relativeLocator: locator,
        scopeIds: [SCOPE_A],
      }))
      expect(existsSync(outside)).toBe(false)
    } finally {
      fixture.cleanup()
      rmSync(outside, { force: true })
    }
  })

  it('quiesces a valid WAL family before hashing so a later checkpoint cannot strand it', () => {
    const fixture = freshSelectedStore()
    const source = join(fixture.root, 'invented-wal-source.sqlite')
    const locator = 'invented-wal-copy.sqlite'
    const target = join(fixture.root, locator)
    const writer = new Database(source)
    try {
      writer.pragma('journal_mode = WAL')
      writer.pragma('wal_autocheckpoint = 0')
      writer.exec('CREATE TABLE invented_wal (value INTEGER) STRICT')
      writer.prepare('INSERT INTO invented_wal (value) VALUES (1)').run()
      copyFileSync(source, target)
      copyFileSync(`${source}-wal`, `${target}-wal`)
      writer.close()

      registerStorageV3Artifact({
        db: fixture.store,
        kind: 'invented_fixture_store',
        relativeLocator: locator,
        scopeIds: [SCOPE_A],
        randomBytes: () => Buffer.alloc(32, 11),
      })
      const checkpoint = new Database(target)
      expect(checkpoint.prepare('SELECT value FROM invented_wal').pluck().get()).toBe(1)
      checkpoint.pragma('wal_checkpoint(TRUNCATE)')
      checkpoint.close()

      deleteStorageV3Scope({
        db: fixture.store,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 12),
      })
      expect(completeStorageV3DeletionMaintenance(fixture.store).maintenance).toBe('complete')
      expect(existsSync(target)).toBe(false)
      expect(existsSync(source)).toBe(true)
    } finally {
      if (writer.open) writer.close()
      fixture.cleanup()
    }
  })

  it('refuses a junction or directory symlink as the reviewed artifact root', () => {
    const outside = mkdtempSync(join(tmpdir(), 'developer-lens-b4-root-target-'))
    const junction = join(tmpdir(), `developer-lens-b4-root-link-${process.pid}`)
    try {
      symlinkSync(outside, junction, 'junction')
      expectArtifactError(() => createStorageV3ArtifactRoot(junction))
    } finally {
      rmSync(junction, { force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('uses the explicit native directory-sync policy for an invented reviewed root', () => {
    const root = mkdtempSync(join(tmpdir(), 'developer-lens-b4-directory-sync-'))
    try {
      const handle = createStorageV3ArtifactRoot(root)
      if (process.platform === 'win32') {
        expectArtifactError(() => syncStorageV3ArtifactDirectory(handle))
      } else {
        expect(() => syncStorageV3ArtifactDirectory(handle)).not.toThrow()
      }
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it.skipIf(process.platform === 'win32')('refuses directory sync after the reviewed root identity is replaced', () => {
    const container = mkdtempSync(join(tmpdir(), 'developer-lens-b4-directory-replace-'))
    const root = join(container, 'root')
    const moved = join(container, 'moved')
    try {
      const handle = createStorageV3ArtifactRoot(root)
      renameSync(root, moved)
      mkdirSync(root)
      expectArtifactError(() => syncStorageV3ArtifactDirectory(handle))
    } finally { rmSync(container, { recursive: true, force: true }) }
  })

  it('leaves kind or content-hash mismatches pending and recovers only after exact repair', () => {
    const fixture = freshSelectedStore()
    const locator = 'invented-kind-mismatch.sqlite'
    try {
      registerFixture(fixture, locator, [SCOPE_A], 8)
      const path = join(fixture.root, locator)
      const registeredBytes = readFileSync(path)
      rmSync(path)
      writeFileSync(path, 'not a sqlite artifact', 'utf8')
      deleteStorageV3Scope({
        db: fixture.store,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 9),
      })
      expectMaintenanceFailure(() => completeStorageV3DeletionMaintenance(fixture.store))
      expect(storageV3MaintenanceStatus(fixture.store)).toBe('pending')
      expect(existsSync(path)).toBe(true)
      rmSync(path)
      writeInventedSqlite(path)
      const changed = new Database(path)
      changed.prepare('UPDATE invented_fixture SET value = 2').run()
      changed.close()
      expectMaintenanceFailure(() => completeStorageV3DeletionMaintenance(fixture.store))
      expect(existsSync(path)).toBe(true)
      rmSync(path)
      writeFileSync(path, registeredBytes)
      expect(completeStorageV3DeletionMaintenance(fixture.store).maintenance).toBe('complete')
      expect(existsSync(path)).toBe(false)
    } finally { fixture.cleanup() }
  })

  it('does not scan or recall a user-directed analysis-pack COMPLETE artifact', () => {
    const fixture = freshSelectedStore()
    try {
      const pack = join(fixture.root, 'user-directed-pack')
      mkdirSync(pack)
      writeFileSync(join(pack, 'COMPLETE'), '', 'utf8')
      writeFileSync(join(pack, 'manifest.json'), '{"invented":true}', 'utf8')
      expect(STORAGE_V3_USER_DIRECTED_ARTIFACTS.analysisPack).toEqual({
        classification: 'user-directed',
        recalled: false,
      })
      deleteStorageV3Scope({
        db: fixture.store,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 10),
      })
      completeStorageV3DeletionMaintenance(fixture.store)
      expect(existsSync(join(pack, 'COMPLETE'))).toBe(true)
      expect(existsSync(join(pack, 'manifest.json'))).toBe(true)
    } finally { fixture.cleanup() }
  })
})
