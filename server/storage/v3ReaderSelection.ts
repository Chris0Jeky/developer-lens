import Database from 'better-sqlite3'
import { lstatSync, readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  assertStorageV3ArtifactRootInstallationKey,
  openStorageV3ArtifactRoot,
  storageV3ArtifactFilePath,
  STORAGE_V3_ARTIFACT_LOCATORS,
} from './v3ArtifactCatalogue.js'
import {
  StorageV3BackupError,
  verifyStorageV3MigrationBackup,
} from './v3Backup.js'
import {
  recordStorageV3MigrationSelection,
  issueStorageV3MigrationSuccessReport,
  storageV3MigrationRootBinding,
  readStorageV3MigrationSelection,
  StorageV3MigrationSelectionError,
  v3SelectionReceiptTestSeams,
  type StorageV3MigrationSelection,
  type StorageV3MigrationSuccessReportProof,
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
  type StorageV3WriterLease,
} from './v3WriterLease.js'
import {
  publishStorageV3MigrationSelectionProof,
  assertStorageV3SelectionProofDurability,
  STORAGE_V3_SELECTION_PROOF_NAMES,
  v3SelectionProofTestSeams,
  type StorageV3MigrationSelectionProofPublication,
  type StorageV3SelectionProofPublicationStage,
} from './v3SelectionProof.js'
import {
  STORAGE_V3_REVOCATION_REPLAY_NAMES,
  assertStorageV3RevocationReplayApplied,
  ensureStorageV3RevocationReplayAnchor,
  v3RevocationReplayTestSeams,
  verifyStorageV3RevocationReplay,
  type StorageV3RevocationReplayState,
} from './v3RevocationReplay.js'

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
  | Readonly<{
      reader: 'unavailable'
      code: 'v3-selection-selected-refused'
    }>

type ClosedSelectionInput = StorageV3ReaderSelectionInput
type SelectionStage = 'request' | 'root' | 'lease' | 'store' | 'backup' | 'receipt' | 'proof' | 'revocation'
type SelectionProofPublisher = (
  db: Database.Database,
  root: ReturnType<typeof openStorageV3ArtifactRoot>,
  installationKey: TaskInstallationKeyHandle,
) => StorageV3MigrationSelectionProofPublication
type SelectionProofPreflight = (root: ReturnType<typeof openStorageV3ArtifactRoot>) => void
type RevocationReplayEnsurer = (
  root: ReturnType<typeof openStorageV3ArtifactRoot>,
  installationKey: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
  lease: StorageV3WriterLease,
) => StorageV3RevocationReplayState

const fallback = (code: StorageV3ReaderSelectionCode): StorageV3ReaderSelection =>
  Object.freeze({ reader: 'legacy-json' as const, code })

const selectedUnavailable = (): StorageV3ReaderSelection =>
  Object.freeze({ reader: 'unavailable' as const, code: 'v3-selection-selected-refused' as const })

class StorageV3SelectedRefusalError extends Error {
  constructor() {
    super('STORAGE_V3_SELECTED_REFUSED')
    this.name = 'StorageV3SelectedRefusalError'
  }
}

type ReceiptPresence = 'absent' | 'present' | 'ambiguous'

function probeSelectionProofMarker(root: ReturnType<typeof openStorageV3ArtifactRoot>): ReceiptPresence {
  const finalPath = storageV3ArtifactFilePath(root, STORAGE_V3_SELECTION_PROOF_NAMES.final)
  let names: string[]
  try { names = readdirSync(dirname(finalPath)) } catch { return 'ambiguous' }
  const reservedPrefix = STORAGE_V3_SELECTION_PROOF_NAMES.final.toLowerCase()
  return names.some((name) => name.toLowerCase().startsWith(reservedPrefix))
    ? 'present'
    : 'absent'
}

function probeRevocationReplay(root: ReturnType<typeof openStorageV3ArtifactRoot>): ReceiptPresence {
  const anchorPath = storageV3ArtifactFilePath(root, STORAGE_V3_REVOCATION_REPLAY_NAMES.anchor)
  let names: string[]
  try { names = readdirSync(dirname(anchorPath)) } catch { return 'ambiguous' }
  return names.some((name) => name.toLowerCase().startsWith(
    STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix,
  )) ? 'present' : 'absent'
}

/**
 * A deliberately small, read-only probe used before any selector fallback. It does
 * not assert the full store contract (the real opener does that); it only answers
 * whether a durable selection row is plainly absent, plainly present, or ambiguous.
 * Any malformed state is protected rather than treated as a legacy store.
 */
function probeSelectionReceipt(root: ReturnType<typeof openStorageV3ArtifactRoot>): ReceiptPresence {
  const path = storageV3ArtifactFilePath(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
  let db: Database.Database | undefined
  try {
    const entry = lstatSync(path, { bigint: true })
    if (!entry.isFile() || entry.isSymbolicLink()) return 'ambiguous'
    db = new Database(path, { fileMustExist: true, readonly: true })
    const table = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'migration_selection_state'",
    ).get()
    if (table === undefined) return 'absent'
    const rows = db.prepare(
      `SELECT singleton, reader_state, legacy_source_id, selected_artifact_id,
              backup_artifact_id, successful_report_at, grace_deadline_at
       FROM migration_selection_state`,
    ).all() as Array<Record<string, unknown>>
    if (rows.length === 0) return 'absent'
    if (rows.length !== 1) return 'ambiguous'
    const row = rows[0]
    if (row === undefined || row.singleton !== 1 || row.reader_state !== 'v3_selected'
      || typeof row.legacy_source_id !== 'string'
      || typeof row.selected_artifact_id !== 'string'
      || typeof row.backup_artifact_id !== 'string'
      || typeof row.successful_report_at !== 'string'
      || typeof row.grace_deadline_at !== 'string') return 'ambiguous'
    return 'present'
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'ambiguous'
    // A present-but-unreadable selected artifact is not evidence of a legacy store.
    return 'ambiguous'
  } finally {
    if (db?.open) db.close()
  }
}

function activeSelectedArtifactId(db: Database.Database): string {
  const rows = db.prepare(
    "SELECT artifact_id FROM app_artifact WHERE kind = 'selected_store' AND state = 'active'",
  ).pluck().all() as unknown[]
  if (rows.length !== 1 || typeof rows[0] !== 'string') throw new StorageV3SelectedRefusalError()
  return rows[0]
}

function assertReplayRequest(
  selection: StorageV3MigrationSelection,
  input: ClosedSelectionInput,
  selectedArtifactId: string,
): void {
  if (selection.legacySourceId !== input.legacySourceId
    || selection.selectedArtifactId !== selectedArtifactId
    || selection.backupArtifactId !== input.backupArtifactId) {
    throw new StorageV3SelectedRefusalError()
  }
}

function closeInput(input: unknown): ClosedSelectionInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype) throw new Error('INVALID')
  const expected = [
    'directory',
    'legacySourceId',
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
  const backupArtifactId = value('backupArtifactId')
  const backupAt = value('backupAt')
  const installationKey = value('installationKey')
  if (typeof directory !== 'string' || directory.length === 0
    || typeof legacySourceId !== 'string'
    || typeof backupArtifactId !== 'string'
    || typeof backupAt !== 'string'
    || !installationKey || typeof installationKey !== 'object') throw new Error('INVALID')
  return Object.freeze({
    directory,
    legacySourceId,
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
    case 'proof': return 'v3-selection-receipt-refused'
    case 'revocation': return 'v3-selection-receipt-refused'
  }
}

function selectStorageV3ReaderInternal(
  input: StorageV3ReaderSelectionInput,
  beforeReceiptCommit?: () => void,
  publishProof: SelectionProofPublisher = publishStorageV3MigrationSelectionProof,
  preflightProof: SelectionProofPreflight = assertStorageV3SelectionProofDurability,
  issueSuccessReport: (input: {
    legacySourceId: string
    selectedArtifactId: string
    backupArtifactId: string
    backupAt: string
    taskId: string
    taskFingerprint: string
    rootBinding: string
  }) => StorageV3MigrationSuccessReportProof = issueStorageV3MigrationSuccessReport,
  ensureRevocationReplay: RevocationReplayEnsurer = ensureStorageV3RevocationReplayAnchor,
): StorageV3ReaderSelection {
  const rootBindingFor = storageV3MigrationRootBinding
  let stage: SelectionStage = 'request'
  let openedDb: Database.Database | undefined
  let root: ReturnType<typeof openStorageV3ArtifactRoot> | undefined
  let protectedSelection = false
  try {
    const closed = closeInput(input)
    stage = 'root'
    const artifactRoot = openStorageV3ArtifactRoot(closed.directory)
    root = artifactRoot
    const initialPresence = probeSelectionReceipt(artifactRoot)
    const initialProofPresence = probeSelectionProofMarker(artifactRoot)
    const initialRevocationPresence = probeRevocationReplay(artifactRoot)
    if (initialPresence === 'ambiguous' || initialProofPresence === 'ambiguous'
      || initialRevocationPresence === 'ambiguous') return selectedUnavailable()
    protectedSelection = initialPresence === 'present' || initialProofPresence === 'present'
      || initialRevocationPresence === 'present'
    stage = 'lease'
    const selected = withStorageV3WriterLease(artifactRoot, (lease) => {
      const leasePresence = probeSelectionReceipt(artifactRoot)
      const leaseProofPresence = probeSelectionProofMarker(artifactRoot)
      const leaseRevocationPresence = probeRevocationReplay(artifactRoot)
      if (leasePresence === 'ambiguous' || leaseProofPresence === 'ambiguous'
        || leaseRevocationPresence === 'ambiguous') {
        throw new StorageV3SelectedRefusalError()
      }
      if (leasePresence === 'present' || leaseProofPresence === 'present'
        || leaseRevocationPresence === 'present') protectedSelection = true
      if (leasePresence === 'absent' && leaseProofPresence === 'absent'
        && leaseRevocationPresence === 'absent') {
        stage = 'proof'
        preflightProof(artifactRoot)
      }
      stage = 'store'
      const db = openSelectedStorageV3Store(closed.directory)
      openedDb = db
      const existing = readStorageV3MigrationSelection(db)
      let receipt: StorageV3MigrationSelection
      if (existing !== undefined) {
        assertStorageV3ArtifactRootInstallationKey(artifactRoot, closed.installationKey)
        const selectedArtifactId = activeSelectedArtifactId(db)
        assertReplayRequest(existing, closed, selectedArtifactId)
        receipt = existing
      } else {
        if (protectedSelection) throw new StorageV3SelectedRefusalError()
        stage = 'backup'
        const backup = verifyStorageV3MigrationBackup({
          db,
          root: artifactRoot,
          backupAt: closed.backupAt,
          artifactId: closed.backupArtifactId,
          installationKey: closed.installationKey,
        })
        stage = 'receipt'
        const receiptInput = Object.freeze({
          legacySourceId: closed.legacySourceId,
          selectedArtifactId: backup.selectedArtifactId,
          backupArtifactId: backup.artifactId,
          backupAt: closed.backupAt,
          taskId: closed.installationKey.taskId,
          taskFingerprint: closed.installationKey.fingerprint,
          rootBinding: rootBindingFor(closed.directory),
          successReportProof: issueSuccessReport({
            legacySourceId: closed.legacySourceId,
            selectedArtifactId: backup.selectedArtifactId,
            backupArtifactId: backup.artifactId,
            backupAt: closed.backupAt,
            taskId: closed.installationKey.taskId,
            taskFingerprint: closed.installationKey.fingerprint,
            rootBinding: rootBindingFor(closed.directory),
          }),
        })
        const recorded = beforeReceiptCommit === undefined
          ? recordStorageV3MigrationSelection(db, receiptInput)
          : v3SelectionReceiptTestSeams.recordWithBeforeCommit(db, receiptInput, beforeReceiptCommit)
        receipt = recorded.selection
        // From this point on the durable receipt is the source of truth. Any later
        // open/revalidation failure must not hand control back to a legacy reader.
        protectedSelection = true
      }
      stage = 'proof'
      const proof = publishProof(db, artifactRoot, closed.installationKey)
      assertReplayRequest(proof.selection, closed, activeSelectedArtifactId(db))
      if (proof.selection.graceDeadlineAt !== receipt.graceDeadlineAt) {
        throw new StorageV3SelectedRefusalError()
      }
      stage = 'revocation'
      let revocations = ensureRevocationReplay(
        artifactRoot,
        closed.installationKey,
        receipt,
        lease,
      )
      assertStorageV3RevocationReplayApplied(db, revocations)
      db.close()
      openedDb = undefined
      stage = 'store'
      const readerDb = openSelectedStorageV3StoreReadonly(closed.directory)
      openedDb = readerDb
      stage = 'receipt'
      const durableSelection = readStorageV3MigrationSelection(readerDb)
      if (durableSelection === undefined) throw new StorageV3SelectedRefusalError()
      assertReplayRequest(durableSelection, closed, activeSelectedArtifactId(readerDb))
      if (durableSelection.graceDeadlineAt !== receipt.graceDeadlineAt) throw new StorageV3SelectedRefusalError()
      stage = 'revocation'
      revocations = verifyStorageV3RevocationReplay(
        artifactRoot,
        closed.installationKey,
        durableSelection,
        lease,
      )
      assertStorageV3RevocationReplayApplied(readerDb, revocations)
      return Object.freeze({ reader: 'sqlite-v3' as const, db: readerDb, selection: durableSelection })
    })
    openedDb = undefined
    return selected
  } catch (error) {
    if (openedDb?.open) openedDb.close()
    if (error instanceof StorageV3WriterLeaseError) return selectedUnavailable()
    if (protectedSelection || (root !== undefined
      && (probeSelectionReceipt(root) !== 'absent' || probeSelectionProofMarker(root) !== 'absent'
        || probeRevocationReplay(root) !== 'absent'))) {
      return selectedUnavailable()
    }
    if (error instanceof StorageV3SelectedRefusalError) return selectedUnavailable()
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
    successfulReportAt: string,
  ): StorageV3ReaderSelection {
    if (typeof beforeReceiptCommit !== 'function') return fallback('v3-selection-request-invalid')
    return selectStorageV3ReaderInternal(
      input,
      beforeReceiptCommit,
      (db, root, installationKey) => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(
        db, root, installationKey, () => {},
      ),
      () => {},
      (report) => v3SelectionReceiptTestSeams.issueSuccessReportAt(
        report,
        successfulReportAt,
      ),
      (root, installationKey, selection, lease) =>
        v3RevocationReplayTestSeams.ensureWithDirectorySynchronizer(
          root, installationKey, selection, lease, () => {},
        ),
    )
  },
  selectWithProofDirectorySynchronizer(
    input: StorageV3ReaderSelectionInput,
    synchronizer: (
      root: ReturnType<typeof openStorageV3ArtifactRoot>,
      stage: StorageV3SelectionProofPublicationStage,
    ) => void,
    successfulReportAt: string,
  ): StorageV3ReaderSelection {
    if (typeof synchronizer !== 'function') return fallback('v3-selection-request-invalid')
    return selectStorageV3ReaderInternal(
      input,
      undefined,
      (db, root, installationKey) => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(
        db, root, installationKey, synchronizer,
      ),
      () => {},
      (report) => v3SelectionReceiptTestSeams.issueSuccessReportAt(
        report,
        successfulReportAt,
      ),
      (root, installationKey, selection, lease) =>
        v3RevocationReplayTestSeams.ensureWithDirectorySynchronizer(
          root, installationKey, selection, lease, () => {},
        ),
    )
  },
  selectWithProofPreflight(
    input: StorageV3ReaderSelectionInput,
    preflight: SelectionProofPreflight,
    successfulReportAt: string,
  ): StorageV3ReaderSelection {
    if (typeof preflight !== 'function') return fallback('v3-selection-request-invalid')
    return selectStorageV3ReaderInternal(
      input,
      undefined,
      (db, root, installationKey) => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(
        db, root, installationKey, () => {},
      ),
      preflight,
      (report) => v3SelectionReceiptTestSeams.issueSuccessReportAt(
        report,
        successfulReportAt,
      ),
      (root, installationKey, selection, lease) =>
        v3RevocationReplayTestSeams.ensureWithDirectorySynchronizer(
          root, installationKey, selection, lease, () => {},
        ),
    )
  },
  selectWithRuntimeSuccessReport(input: StorageV3ReaderSelectionInput): StorageV3ReaderSelection {
    return selectStorageV3ReaderInternal(
      input,
      undefined,
      (db, root, installationKey) => v3SelectionProofTestSeams.publishCommittedWithDirectorySynchronizer(
        db, root, installationKey, () => {},
      ),
      () => {},
    )
  },
})
