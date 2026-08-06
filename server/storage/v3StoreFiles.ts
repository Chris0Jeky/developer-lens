import {
  closeSync,
  constants,
  linkSync,
  lstatSync,
  openSync,
  realpathSync,
  rmSync,
  type BigIntStats,
} from 'node:fs'
import Database from 'better-sqlite3'
import { assertContinuityCasConsistency } from './v3ContinuityCasProposal.js'
import {
  assertPublishedStorageV3ArtifactCatalogue,
  assertStorageV3ArtifactFileProof,
  bindStorageV3ArtifactRoot,
  createStorageV3ArtifactRoot,
  openStorageV3ArtifactRoot,
  proveStorageV3ArtifactFile,
  registerSelectedStorageV3Artifact,
  registerStorageV3Artifact,
  removeStorageV3DatabaseFamily,
  removeStorageV3DatabaseSidecars,
  STORAGE_V3_ARTIFACT_LOCATORS,
  storageV3ArtifactFilePath,
  type StorageV3ArtifactRoot,
} from './v3ArtifactCatalogue.js'

export { registerStorageV3Artifact }
export type { StorageV3ArtifactDeletionStage } from './v3ArtifactCatalogue.js'
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

const NO_FOLLOW = constants.O_NOFOLLOW ?? 0

export const STORAGE_V3_PUBLICATION_FAILURE_STAGES = [
  'link',
  'primary-unlink',
  'selected-proof',
  'rollback-unlink',
] as const
export type StorageV3PublicationFailureStage = typeof STORAGE_V3_PUBLICATION_FAILURE_STAGES[number]
export type StorageV3RecoveryFailureStage = 'primary-unlink'

export interface StorageV3TargetFactoryOptions {
  /** Synthetic crash seam; never configured by production callers. */
  readonly failAtPublicationStage?: StorageV3PublicationFailureStage
}

export interface StorageV3StoreOpenOptions {
  /** Synthetic repeated-reopen crash seam; never configured by production callers. */
  readonly failAtRecoveryStage?: StorageV3RecoveryFailureStage
}

function injectPublicationFailure(
  configured: StorageV3PublicationFailureStage | undefined,
  stage: StorageV3PublicationFailureStage,
): void {
  if (configured === stage) throw new Error('invented publication interruption')
}

function lstatEntry(path: string): BigIntStats | undefined {
  try {
    return lstatSync(path, { bigint: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    return fail()
  }
}

function assertExactPublishedPair(attempt: string, store: string): void {
  const source = lstatEntry(attempt)
  const selected = lstatEntry(store)
  if (
    source === undefined
    || selected === undefined
    || !selected.isFile()
    || selected.isSymbolicLink()
    || realpathSync.native(store) !== store
    || !source.isFile()
    || source.isSymbolicLink()
    || source.nlink !== 2n
    || selected.nlink !== 2n
    || source.dev !== selected.dev
    || source.ino !== selected.ino
    || realpathSync.native(attempt) !== attempt
  ) fail()
}

function assertDurableSelectedPublication(
  attempt: string,
  store: string,
  options: Readonly<{ allowContinuityCasState: boolean }>,
): void {
  assertExactPublishedPair(attempt, store)
  const selected = lstatEntry(store)
  if (selected === undefined) {
    fail()
  }
  const db = new Database(store, { fileMustExist: true })
  try {
    assertSelectableStorageV3Target(db, options)
  } finally { db.close() }
}

/** Resume the only partial state created by link-then-unlink publication. */
type PublishedRecoveryState = 'none' | 'cleaned' | 'retained'

function recoverPublishedPrimaryLink(
  attempt: string,
  store: string,
  failAtRecoveryStage?: StorageV3RecoveryFailureStage,
): PublishedRecoveryState {
  const sourceEntry = lstatEntry(attempt)
  const selectedEntry = lstatEntry(store)
  if (sourceEntry === undefined && selectedEntry === undefined) return 'none'
  if (sourceEntry?.isSymbolicLink() || selectedEntry?.isSymbolicLink()) fail()
  if (sourceEntry === undefined || selectedEntry === undefined) return 'none'
  try {
    assertExactPublishedPair(attempt, store)
    try {
      if (failAtRecoveryStage === 'primary-unlink') throw new Error('invented recovery interruption')
      rmSync(attempt)
      return 'cleaned'
    } catch {
      // The selected hard link is already durable; reopen can safely retain
      // and later retry removal of the exact primary name.
      // The selected link is already the durable publication during retained
      // recovery, so valid service CAS state is expected. The virgin rollback
      // validation call in claimStorePath keeps the strict default.
      assertDurableSelectedPublication(attempt, store, { allowContinuityCasState: true })
      return 'retained'
    }
  } catch (error) {
    if (error instanceof StorageV3StoreFileError) throw error
    return fail()
  }
}

class FileTargetAttempt implements StorageV3ShadowTargetAttempt {
  public readonly db!: Database.Database
  public readonly path: string
  private readonly root: StorageV3ArtifactRoot
  private readonly locator: string

  constructor(root: StorageV3ArtifactRoot, locator: string, claim = false) {
    this.root = root
    this.locator = locator
    this.path = storageV3ArtifactFilePath(root, locator as typeof STORAGE_V3_TARGET_FILE_NAMES[keyof typeof STORAGE_V3_TARGET_FILE_NAMES])
    const kind = locator === STORAGE_V3_TARGET_FILE_NAMES.primary
      ? 'migration_primary_temp'
      : 'migration_replay_temp'
    let claimed = false
    let opened: Database.Database | undefined
    try {
      if (claim) {
        const descriptor = openSync(
          this.path,
          constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | NO_FOLLOW,
          0o600,
        )
        closeSync(descriptor)
        claimed = true
      }
      const proof = proveStorageV3ArtifactFile(root, locator, kind)
      opened = new Database(this.path, { fileMustExist: true })
      assertStorageV3ArtifactFileProof(proof)
      this.db = opened
    } catch {
      if (opened?.open) opened.close()
      if (claimed) {
        try { removeStorageV3DatabaseFamily(root, locator) } catch { /* fail closed below */ }
      }
      return fail()
    }
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
 * Publish without replacement. A same-directory hard link is the portable
 * no-clobber primitive: it fails atomically if another process selected a store.
 */
function claimStorePath(
  root: StorageV3ArtifactRoot,
  attempt: string,
  store: string,
  failAtPublicationStage?: StorageV3PublicationFailureStage,
): void {
  if (['-shm', '-wal', '-journal'].some((suffix) => lstatEntry(`${store}${suffix}`) !== undefined)) fail()
  proveStorageV3ArtifactFile(
    root,
    STORAGE_V3_TARGET_FILE_NAMES.primary,
    'migration_primary_temp',
  )
  let linked = false
  try {
    removeStorageV3DatabaseSidecars(root, STORAGE_V3_TARGET_FILE_NAMES.primary)
    injectPublicationFailure(failAtPublicationStage, 'link')
    linkSync(attempt, store)
    linked = true
    injectPublicationFailure(failAtPublicationStage, 'primary-unlink')
    injectPublicationFailure(failAtPublicationStage, 'rollback-unlink')
    rmSync(attempt)
    injectPublicationFailure(failAtPublicationStage, 'selected-proof')
    proveStorageV3ArtifactFile(root, STORAGE_V3_STORE_FILE_NAME, 'selected_store')
  } catch {
    if (linked) {
      try {
        injectPublicationFailure(failAtPublicationStage, 'rollback-unlink')
        rmSync(store)
      } catch {
        // A valid selected hard link is a durable publication even when the
        // primary cleanup failed. Leave the exact source for reopen recovery.
        try {
          assertDurableSelectedPublication(attempt, store, { allowContinuityCasState: false })
          return
        } catch {
          return fail()
        }
      }
    }
    return fail()
  }
}

/** Real files for the two shadow attempts, plus acceptance of the proven one. */
export function createStorageV3TargetFactory(
  directory: string,
  options: StorageV3TargetFactoryOptions = {},
): StorageV3ShadowTargetFactory {
  const root = createStorageV3ArtifactRoot(directory)
  const attemptPaths = {
    primary: storageV3ArtifactFilePath(root, STORAGE_V3_TARGET_FILE_NAMES.primary),
    replay: storageV3ArtifactFilePath(root, STORAGE_V3_TARGET_FILE_NAMES.replay),
  }
  const storePath = storageV3ArtifactFilePath(root, STORAGE_V3_STORE_FILE_NAME)
  recoverPublishedPrimaryLink(attemptPaths.primary, storePath)
  return {
    create(kind: 'primary' | 'replay'): StorageV3ShadowTargetAttempt {
      // Refuse inside the orchestrator so callers retain its fail-closed public
      // error contract. Recheck on every attempt in case another owner won the
      // selected name after this factory was created.
      if (lstatEntry(storePath) !== undefined) fail()
      const locator = kind === 'primary'
        ? STORAGE_V3_TARGET_FILE_NAMES.primary
        : STORAGE_V3_TARGET_FILE_NAMES.replay
      // Interruption recovery: whatever a crashed run left here is not a target.
      removeStorageV3DatabaseFamily(root, locator)
      try {
        return new FileTargetAttempt(root, locator, true)
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
      claimStorePath(root, attemptPaths.primary, storePath, options.failAtPublicationStage)
    },
  }
}

/**
 * Open the selected store, re-running the acceptance proof it was selected under
 * plus the CAS consistency it accumulates in service. A store that fails any of
 * them is never handed back to a caller.
 */
export function openSelectedStorageV3Store(
  directory: string,
  options: StorageV3StoreOpenOptions = {},
): Database.Database {
  let db: Database.Database | undefined
  try {
    const root = openStorageV3ArtifactRoot(directory)
    const path = storageV3ArtifactFilePath(root, STORAGE_V3_STORE_FILE_NAME)
    const primaryPath = storageV3ArtifactFilePath(root, STORAGE_V3_TARGET_FILE_NAMES.primary)
    const recovery = recoverPublishedPrimaryLink(primaryPath, path, options.failAtRecoveryStage)
    if (recovery === 'retained') assertExactPublishedPair(primaryPath, path)
    const proof = recovery === 'retained'
      ? undefined
      : proveStorageV3ArtifactFile(root, STORAGE_V3_STORE_FILE_NAME, 'selected_store')
    db = new Database(path, { fileMustExist: true })
    if (proof !== undefined) assertStorageV3ArtifactFileProof(proof)
    bindStorageV3ArtifactRoot(db, root)
    assertSelectableStorageV3Target(db, { allowContinuityCasState: true })
    if (recovery === 'retained') assertExactPublishedPair(primaryPath, path)
    assertContinuityCasConsistency(db)
    assertPublishedStorageV3ArtifactCatalogue(db)
    return db
  } catch {
    if (db?.open) db.close()
    return fail()
  }
}
