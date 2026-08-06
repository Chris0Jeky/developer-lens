import { existsSync, renameSync } from 'node:fs'
import Database from 'better-sqlite3'
import { assertContinuityCasConsistency } from './v3ContinuityCasProposal.js'
import {
  assertPublishedStorageV3ArtifactCatalogue,
  bindStorageV3ArtifactRoot,
  createStorageV3ArtifactRoot,
  openStorageV3ArtifactRoot,
  registerSelectedStorageV3Artifact,
  registerStorageV3Artifact,
  removeStorageV3DatabaseFamily,
  removeStorageV3DatabaseSidecars,
  STORAGE_V3_ARTIFACT_LOCATORS,
  storageV3ArtifactFilePath,
  type StorageV3ArtifactRoot,
} from './v3ArtifactCatalogue.js'
import {
  assertSelectableStorageV3Target,
  type StorageV3ShadowTargetAttempt,
  type StorageV3ShadowTargetFactory,
} from './v3ShadowMigration.js'

/**
 * File ownership for the shadow migration. Both attempts are temporary files in
 * one owner-supplied directory, so an interrupted run can only ever leave those
 * temporary files behind: the next run removes them before it writes, and the
 * selected store appears only when the orchestrator has completed every proof.
 */
export const STORAGE_V3_STORE_FILE_NAME = STORAGE_V3_ARTIFACT_LOCATORS.selectedStore
export const STORAGE_V3_TARGET_FILE_NAMES = Object.freeze({
  primary: STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary,
  replay: STORAGE_V3_ARTIFACT_LOCATORS.migrationReplay,
})

const STORE_FILE_ERROR = 'STORAGE_V3_STORE_FILE_REFUSED' as const

/** Content-free: no filesystem path ever reaches a message, proof, or log. */
export class StorageV3StoreFileError extends Error {
  public readonly code = STORE_FILE_ERROR

  constructor() {
    super(STORE_FILE_ERROR)
    this.name = 'StorageV3StoreFileError'
  }
}

function fail(): never {
  throw new StorageV3StoreFileError()
}

class FileTargetAttempt implements StorageV3ShadowTargetAttempt {
  public readonly db: Database.Database
  public readonly path: string
  private readonly root: StorageV3ArtifactRoot
  private readonly locator: string

  constructor(root: StorageV3ArtifactRoot, locator: string) {
    this.root = root
    this.locator = locator
    this.path = storageV3ArtifactFilePath(root, locator as typeof STORAGE_V3_TARGET_FILE_NAMES[keyof typeof STORAGE_V3_TARGET_FILE_NAMES])
    this.db = new Database(this.path)
  }

  // Windows refuses to unlink or rename a file an open handle still holds, so
  // every filesystem operation below closes its handle first.
  close(): void {
    if (this.db.open) this.db.close()
  }

  reopen(): StorageV3ShadowTargetAttempt {
    this.close()
    return new FileTargetAttempt(this.root, this.locator)
  }

  discard(): void {
    this.close()
    removeStorageV3DatabaseFamily(this.root, this.locator)
  }
}

/**
 * Publish the proven primary under the store name. Both names are fixed children
 * of the same canonical, single-owner root, so a closed-handle rename is atomic.
 */
function claimStorePath(
  root: StorageV3ArtifactRoot,
  attempt: string,
  store: string,
): void {
  if (existsSync(store)) fail()
  try {
    removeStorageV3DatabaseSidecars(root, STORAGE_V3_TARGET_FILE_NAMES.primary)
    removeStorageV3DatabaseSidecars(root, STORAGE_V3_STORE_FILE_NAME)
    renameSync(attempt, store)
  } catch { fail() }
}

/** Real files for the two shadow attempts, plus acceptance of the proven one. */
export function createStorageV3TargetFactory(directory: string): StorageV3ShadowTargetFactory {
  const root = createStorageV3ArtifactRoot(directory)
  const attemptPaths = {
    primary: storageV3ArtifactFilePath(root, STORAGE_V3_TARGET_FILE_NAMES.primary),
    replay: storageV3ArtifactFilePath(root, STORAGE_V3_TARGET_FILE_NAMES.replay),
  }
  const storePath = storageV3ArtifactFilePath(root, STORAGE_V3_STORE_FILE_NAME)
  return {
    create(kind: 'primary' | 'replay'): StorageV3ShadowTargetAttempt {
      const locator = kind === 'primary'
        ? STORAGE_V3_TARGET_FILE_NAMES.primary
        : STORAGE_V3_TARGET_FILE_NAMES.replay
      // Interruption recovery: whatever a crashed run left here is not a target.
      removeStorageV3DatabaseFamily(root, locator)
      try {
        return new FileTargetAttempt(root, locator)
      } catch {
        return fail()
      }
    },
    prepareAcceptance(
      primary: StorageV3ShadowTargetAttempt,
      replay: StorageV3ShadowTargetAttempt,
    ): void {
      if (
        !(primary instanceof FileTargetAttempt)
        || !(replay instanceof FileTargetAttempt)
        || primary.path !== attemptPaths.primary
        || replay.path !== attemptPaths.replay
      ) fail()
      for (const [attempt, kind, locator] of [
        [primary, 'migration_primary_temp', STORAGE_V3_TARGET_FILE_NAMES.primary],
        [replay, 'migration_replay_temp', STORAGE_V3_TARGET_FILE_NAMES.replay],
      ] as const) {
        bindStorageV3ArtifactRoot(attempt.db, root)
        const scopeIds = attempt.db.prepare(
          'SELECT scope_id FROM claim_scope ORDER BY scope_id',
        ).pluck().all() as string[]
        registerStorageV3Artifact({
          db: attempt.db,
          kind,
          relativeLocator: locator,
          scopeIds,
        })
      }
    },
    accept(primary: StorageV3ShadowTargetAttempt): void {
      if (!(primary instanceof FileTargetAttempt) || primary.path !== attemptPaths.primary) fail()
      registerSelectedStorageV3Artifact(primary.db, root)
      primary.close()
      claimStorePath(root, attemptPaths.primary, storePath)
    },
  }
}

/**
 * Open the selected store, re-running the acceptance proof it was selected under
 * plus the CAS consistency it accumulates in service. A store that fails any of
 * them is never handed back to a caller.
 */
export function openSelectedStorageV3Store(directory: string): Database.Database {
  const root = openStorageV3ArtifactRoot(directory)
  const path = storageV3ArtifactFilePath(root, STORAGE_V3_STORE_FILE_NAME)
  if (!existsSync(path)) fail()
  let db: Database.Database | undefined
  try {
    db = new Database(path, { fileMustExist: true })
    bindStorageV3ArtifactRoot(db, root)
    assertSelectableStorageV3Target(db, { allowContinuityCasState: true })
    assertContinuityCasConsistency(db)
    assertPublishedStorageV3ArtifactCatalogue(db)
    return db
  } catch {
    if (db?.open) db.close()
    return fail()
  }
}
