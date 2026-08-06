import type Database from 'better-sqlite3'
import {
  openStorageV3ArtifactRoot,
} from './v3ArtifactCatalogue.js'
import {
  StorageV3BackupError,
  verifyStorageV3MigrationBackup,
} from './v3Backup.js'
import {
  recordStorageV3MigrationSelection,
  readStorageV3MigrationSelection,
  StorageV3MigrationSelectionError,
  v3SelectionReceiptTestSeams,
  type StorageV3MigrationSelection,
} from './v3SelectionReceipt.js'
import {
  openSelectedStorageV3Store,
  openSelectedStorageV3StoreReadonly,
  StorageV3StoreFileError,
} from './v3StoreFiles.js'
import type { TaskInstallationKeyHandle } from './taskInstallationKey.js'
import {
  StorageV3WriterLeaseError,
  withStorageV3WriterLease,
} from './v3WriterLease.js'

export const STORAGE_V3_READER_SELECTION_CODES = [
  'v3-selection-request-invalid',
  'v3-selection-root-refused',
  'v3-selection-lease-refused',
  'v3-selection-store-refused',
  'v3-selection-backup-refused',
  'v3-selection-receipt-refused',
] as const
export type StorageV3ReaderSelectionCode = typeof STORAGE_V3_READER_SELECTION_CODES[number]

export type StorageV3ReaderSelectionInput = Readonly<{
  directory: string
  legacySourceId: string
  successfulReportAt: string
  backupArtifactId: string
  backupAt: string
  installationKey: TaskInstallationKeyHandle
}>

export type StorageV3ReaderSelection =
  | Readonly<{
      reader: 'sqlite-v3'
      db: Database.Database
      selection: StorageV3MigrationSelection
    }>
  | Readonly<{
      reader: 'legacy-json'
      code: StorageV3ReaderSelectionCode
    }>

type ClosedSelectionInput = StorageV3ReaderSelectionInput
type SelectionStage = 'request' | 'root' | 'lease' | 'store' | 'backup' | 'receipt'

const fallback = (code: StorageV3ReaderSelectionCode): StorageV3ReaderSelection =>
  Object.freeze({ reader: 'legacy-json' as const, code })

function closeInput(input: unknown): ClosedSelectionInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype) throw new Error('INVALID')
  const expected = [
    'directory',
    'legacySourceId',
    'successfulReportAt',
    'backupArtifactId',
    'backupAt',
    'installationKey',
  ] as const
  const keys = Reflect.ownKeys(input)
  if (keys.length !== expected.length
    || keys.some((key) => typeof key !== 'string' || !expected.includes(key as typeof expected[number]))) {
    throw new Error('INVALID')
  }
  const value = (key: typeof expected[number]): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new Error('INVALID')
    return (descriptor as PropertyDescriptor & { value: unknown }).value
  }
  const directory = value('directory')
  const legacySourceId = value('legacySourceId')
  const successfulReportAt = value('successfulReportAt')
  const backupArtifactId = value('backupArtifactId')
  const backupAt = value('backupAt')
  const installationKey = value('installationKey')
  if (typeof directory !== 'string' || directory.length === 0
    || typeof legacySourceId !== 'string'
    || typeof successfulReportAt !== 'string'
    || typeof backupArtifactId !== 'string'
    || typeof backupAt !== 'string'
    || !installationKey || typeof installationKey !== 'object') throw new Error('INVALID')
  return Object.freeze({
    directory,
    legacySourceId,
    successfulReportAt,
    backupArtifactId,
    backupAt,
    installationKey: installationKey as TaskInstallationKeyHandle,
  })
}

function codeForFailure(error: unknown, stage: SelectionStage): StorageV3ReaderSelectionCode {
  if (error instanceof StorageV3WriterLeaseError) return 'v3-selection-lease-refused'
  if (error instanceof StorageV3StoreFileError) return 'v3-selection-store-refused'
  if (error instanceof StorageV3BackupError) return 'v3-selection-backup-refused'
  if (error instanceof StorageV3MigrationSelectionError) return 'v3-selection-receipt-refused'
  switch (stage) {
    case 'request': return 'v3-selection-request-invalid'
    case 'root': return 'v3-selection-root-refused'
    case 'lease': return 'v3-selection-lease-refused'
    case 'store': return 'v3-selection-store-refused'
    case 'backup': return 'v3-selection-backup-refused'
    case 'receipt': return 'v3-selection-receipt-refused'
  }
}

function selectStorageV3ReaderInternal(
  input: StorageV3ReaderSelectionInput,
  beforeReceiptCommit?: () => void,
): StorageV3ReaderSelection {
  let stage: SelectionStage = 'request'
  let openedDb: Database.Database | undefined
  try {
    const closed = closeInput(input)
    stage = 'root'
    const root = openStorageV3ArtifactRoot(closed.directory)
    stage = 'lease'
    const selected = withStorageV3WriterLease(root, () => {
      stage = 'store'
      const db = openSelectedStorageV3Store(closed.directory)
      openedDb = db
      stage = 'backup'
      const backup = verifyStorageV3MigrationBackup({
        db,
        root,
        backupAt: closed.backupAt,
        artifactId: closed.backupArtifactId,
        installationKey: closed.installationKey,
      })
      stage = 'receipt'
      const receiptInput = Object.freeze({
        legacySourceId: closed.legacySourceId,
        selectedArtifactId: backup.selectedArtifactId,
        backupArtifactId: backup.artifactId,
        successfulReportAt: closed.successfulReportAt,
      })
      const receipt = beforeReceiptCommit === undefined
        ? recordStorageV3MigrationSelection(db, receiptInput)
        : v3SelectionReceiptTestSeams.recordWithBeforeCommit(db, receiptInput, beforeReceiptCommit)
      db.close()
      openedDb = undefined
      stage = 'store'
      const readerDb = openSelectedStorageV3StoreReadonly(closed.directory)
      openedDb = readerDb
      stage = 'receipt'
      const durableSelection = readStorageV3MigrationSelection(readerDb)
      if (durableSelection === undefined
        || durableSelection.legacySourceId !== receipt.selection.legacySourceId
        || durableSelection.selectedArtifactId !== receipt.selection.selectedArtifactId
        || durableSelection.backupArtifactId !== receipt.selection.backupArtifactId
        || durableSelection.successfulReportAt !== receipt.selection.successfulReportAt
        || durableSelection.graceDeadlineAt !== receipt.selection.graceDeadlineAt) {
        throw new StorageV3MigrationSelectionError()
      }
      return Object.freeze({ reader: 'sqlite-v3' as const, db: readerDb, selection: durableSelection })
    })
    openedDb = undefined
    return selected
  } catch (error) {
    if (openedDb?.open) openedDb.close()
    return fallback(codeForFailure(error, stage))
  }
}

/**
 * Choose an already-published v3 store without accepting, reading, rewriting,
 * or deleting a legacy path. The caller retains the legacy reader on every
 * content-free refusal result.
 */
export function selectStorageV3Reader(input: StorageV3ReaderSelectionInput): StorageV3ReaderSelection {
  return selectStorageV3ReaderInternal(input)
}

/** @internal invented-fixture interruption seam; production selection retains no hook. */
export const v3ReaderSelectionTestSeams = Object.freeze({
  selectWithBeforeReceiptCommit(
    input: StorageV3ReaderSelectionInput,
    beforeReceiptCommit: () => void,
  ): StorageV3ReaderSelection {
    if (typeof beforeReceiptCommit !== 'function') return fallback('v3-selection-request-invalid')
    return selectStorageV3ReaderInternal(input, beforeReceiptCommit)
  },
})
