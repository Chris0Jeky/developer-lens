import { existsSync, linkSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { assertContinuityCasConsistency } from './v3ContinuityCasProposal.js'
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
export const STORAGE_V3_STORE_FILE_NAME = 'v3-store.sqlite'
export const STORAGE_V3_TARGET_FILE_NAMES = Object.freeze({
  primary: 'v3-target-primary.tmp.sqlite',
  replay: 'v3-target-replay.tmp.sqlite',
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

/** SQLite keeps its rollback journal and WAL beside the database file. */
function removeDatabaseFiles(path: string): void {
  for (const suffix of ['-shm', '-wal', '-journal', '']) {
    rmSync(`${path}${suffix}`, { force: true })
  }
}

class FileTargetAttempt implements StorageV3ShadowTargetAttempt {
  public readonly db: Database.Database
  public readonly path: string

  constructor(path: string) {
    this.path = path
    this.db = new Database(path)
  }

  // Windows refuses to unlink or rename a file an open handle still holds, so
  // every filesystem operation below closes its handle first.
  close(): void {
    if (this.db.open) this.db.close()
  }

  reopen(): StorageV3ShadowTargetAttempt {
    this.close()
    return new FileTargetAttempt(this.path)
  }

  discard(): void {
    this.close()
    removeDatabaseFiles(this.path)
  }
}

const alreadyExists = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error
  && (error as NodeJS.ErrnoException).code === 'EEXIST'

/**
 * Publish the proven primary under the store name. The hard link fails closed on
 * an existing destination without a check-then-write window; the rename fallback
 * covers filesystems without links and is guarded by an explicit check, which is
 * sound for a single-owner local store.
 */
function claimStorePath(attempt: string, store: string): void {
  if (existsSync(store)) fail()
  try {
    linkSync(attempt, store)
  } catch (error) {
    if (alreadyExists(error)) fail()
    if (existsSync(store)) fail()
    renameSync(attempt, store)
    return
  }
  // The store is published; a failure to unlink the tmp name must not turn a
  // successful migration into a reported failure. The stale link is inert and
  // the next run's create() removes it.
  try { removeDatabaseFiles(attempt) } catch { /* published; tmp link is inert */ }
}

/** Real files for the two shadow attempts, plus acceptance of the proven one. */
export function createStorageV3TargetFactory(directory: string): StorageV3ShadowTargetFactory {
  if (typeof directory !== 'string' || directory.length === 0) fail()
  mkdirSync(directory, { recursive: true })
  const attemptPaths = {
    primary: join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary),
    replay: join(directory, STORAGE_V3_TARGET_FILE_NAMES.replay),
  }
  const storePath = join(directory, STORAGE_V3_STORE_FILE_NAME)
  return {
    create(kind: 'primary' | 'replay'): StorageV3ShadowTargetAttempt {
      const path = kind === 'primary' ? attemptPaths.primary : attemptPaths.replay
      // Interruption recovery: whatever a crashed run left here is not a target.
      removeDatabaseFiles(path)
      try {
        return new FileTargetAttempt(path)
      } catch {
        return fail()
      }
    },
    accept(primary: StorageV3ShadowTargetAttempt): void {
      if (!(primary instanceof FileTargetAttempt) || primary.path !== attemptPaths.primary) fail()
      primary.close()
      claimStorePath(attemptPaths.primary, storePath)
    },
  }
}

/**
 * Open the selected store, re-running the acceptance proof it was selected under
 * plus the CAS consistency it accumulates in service. A store that fails any of
 * them is never handed back to a caller.
 */
export function openSelectedStorageV3Store(directory: string): Database.Database {
  if (typeof directory !== 'string' || directory.length === 0) fail()
  const path = join(directory, STORAGE_V3_STORE_FILE_NAME)
  if (!existsSync(path)) fail()
  let db: Database.Database | undefined
  try {
    db = new Database(path, { fileMustExist: true })
    assertSelectableStorageV3Target(db, { allowContinuityCasState: true })
    assertContinuityCasConsistency(db)
    return db
  } catch {
    if (db?.open) db.close()
    return fail()
  }
}
