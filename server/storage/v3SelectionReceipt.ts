import type Database from 'better-sqlite3'
import { isCanonicalTaskId } from '../taskId.js'

import {
  addGrace, assertStore, canonicalBackupTimestamp, canonicalTimestamp,
  readRow, readStorageV3MigrationSelection, StorageV3MigrationSelectionError,
  type StorageV3MigrationSelection,
  type StorageV3MigrationReportContext as SuccessReportInput,
} from './v3SelectionReceiptState.js'
import {
  consumeStorageV3MigrationSelectionReplayAuthority,
  type StorageV3MigrationSelectionReplayAuthority,
} from './v3SelectionProof.js'
import type { StorageV3ArtifactRoot } from './v3ArtifactCatalogue.js'
import type { TaskInstallationKeyHandle } from './taskInstallationKey.js'

export {
  readStorageV3MigrationSelection, storageV3MigrationRootBinding, StorageV3MigrationSelectionError,
  type StorageV3MigrationSelection,
} from './v3SelectionReceiptState.js'

const ARTIFACT_ID = /^art-[0-9a-f]{64}$/
const LEGACY_SOURCE_ID = /^legacy-[0-9a-f]{64}$/
const OPAQUE_BINDING = /^[a-z0-9][a-z0-9._:-]{0,127}$/


export type StorageV3MigrationSelectionStatus = 'recorded' | 'replayed'

export interface StorageV3MigrationSelectionInput {
  readonly legacySourceId: string
  readonly selectedArtifactId: string
  readonly backupArtifactId: string
  readonly backupAt: string
  readonly taskId: string
  readonly taskFingerprint: string
  readonly rootBinding: string
  readonly successReportProof: StorageV3MigrationSuccessReportProof
}

/** Runtime-opaque proof issued after an invented migration report succeeds. */
export interface StorageV3MigrationSuccessReportProof {
  readonly __storageV3MigrationSuccessReportProof: never
}

interface SuccessReport {
  readonly legacySourceId: string
  readonly selectedArtifactId: string
  readonly backupArtifactId: string
  readonly backupAt: string
  readonly taskId: string
  readonly taskFingerprint: string
  readonly rootBinding: string
  readonly successfulReportAt: string
  readonly graceDeadlineAt: string
}

const SUCCESS_REPORTS = new WeakMap<StorageV3MigrationSuccessReportProof, SuccessReport>()

export interface StorageV3MigrationSelectionResult {
  readonly kind: 'v3_migration_selection'
  readonly status: StorageV3MigrationSelectionStatus
  readonly selection: StorageV3MigrationSelection
}

/** Runtime-only, single-use authority to initialize replay state for a newly committed receipt. */
export interface StorageV3MigrationSelectionInitializationGrant {
  readonly __storageV3MigrationSelectionInitializationGrant: never
}

const INITIALIZATION_GRANTS = new WeakMap<
  StorageV3MigrationSelectionInitializationGrant,
  StorageV3MigrationSelection
>()

export type StorageV3MigrationSelectionInitializer = (
  selection: StorageV3MigrationSelection,
  grant: StorageV3MigrationSelectionInitializationGrant,
) => void

export type StorageV3MigrationGraceStatus = 'active' | 'expired' | 'absent'

const fail = (): never => { throw new StorageV3MigrationSelectionError() }

function opaque(value: unknown): string {
  if (typeof value !== 'string' || !OPAQUE_BINDING.test(value)) return fail()
  return value
}

function canonicalTaskId(value: unknown): string {
  if (!isCanonicalTaskId(value)) return fail()
  return value
}

function closeSuccessReportInput(input: SuccessReportInput): SuccessReportInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return fail()
  if (!LEGACY_SOURCE_ID.test(input.legacySourceId)
    || !ARTIFACT_ID.test(input.selectedArtifactId)
    || !ARTIFACT_ID.test(input.backupArtifactId)) return fail()
  return Object.freeze({
    legacySourceId: input.legacySourceId,
    selectedArtifactId: input.selectedArtifactId,
    backupArtifactId: input.backupArtifactId,
    backupAt: canonicalBackupTimestamp(input.backupAt),
    taskId: canonicalTaskId(input.taskId),
    taskFingerprint: opaque(input.taskFingerprint),
    rootBinding: opaque(input.rootBinding),
  })
}

function issueSuccessReport(input: SuccessReportInput, reportAt: string): StorageV3MigrationSuccessReportProof {
  const closed = closeSuccessReportInput(input)
  const successfulReportAt = canonicalTimestamp(reportAt)
  if (Date.parse(successfulReportAt) < Date.parse(closed.backupAt)) return fail()
  const proof = Object.freeze({}) as StorageV3MigrationSuccessReportProof
  SUCCESS_REPORTS.set(proof, Object.freeze({
    ...closed,
    successfulReportAt,
    graceDeadlineAt: addGrace(successfulReportAt),
  }))
  return proof
}

/** Issue a proof using the current runtime clock; callers cannot choose report time. */
export function issueStorageV3MigrationSuccessReport(
  input: SuccessReportInput,
): StorageV3MigrationSuccessReportProof {
  return issueSuccessReport(input, new Date().toISOString())
}

/** Replay only the original time bound to the current, verified restore scope. */
export function replayStorageV3MigrationSuccessReport(
  input: SuccessReportInput,
  authority: StorageV3MigrationSelectionReplayAuthority,
  root: StorageV3ArtifactRoot,
  installationKey: TaskInstallationKeyHandle,
): StorageV3MigrationSuccessReportProof {
  try {
    const closed = closeSuccessReportInput(input)
    const selection = consumeStorageV3MigrationSelectionReplayAuthority(authority, root, installationKey, closed)
    return issueSuccessReport(closed, selection.successfulReportAt)
  } catch { return fail() }
}

function reportFor(proof: unknown): SuccessReport {
  if (!proof || typeof proof !== 'object' || SUCCESS_REPORTS.get(proof as StorageV3MigrationSuccessReportProof) === undefined) return fail()
  return SUCCESS_REPORTS.get(proof as StorageV3MigrationSuccessReportProof) as SuccessReport
}

function parseInput(raw: unknown): StorageV3MigrationSelectionInput {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return fail()
  const input = raw as object
  const prototype = Object.getPrototypeOf(input)
  if (prototype !== Object.prototype && prototype !== null) return fail()
  const expected = [
    'backupArtifactId', 'backupAt', 'legacySourceId', 'rootBinding',
    'selectedArtifactId', 'successReportProof', 'taskFingerprint', 'taskId',
  ]

  const keys = Reflect.ownKeys(input)
  if (keys.length !== expected.length || keys.some((key) => typeof key !== 'string')) return fail()
  if (keys.map((key) => String(key)).sort().some((key, index) => key !== expected[index])) return fail()
  const read = (key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return fail()
    return descriptor.value
  }
  const legacySourceId = read('legacySourceId')
  const selectedArtifactId = read('selectedArtifactId')
  const backupArtifactId = read('backupArtifactId')
  const backupAt = read('backupAt')
  const taskId = read('taskId')
  const taskFingerprint = read('taskFingerprint')
  const rootBinding = read('rootBinding')
  const successReportProof = read('successReportProof')
  if (typeof legacySourceId !== 'string' || !LEGACY_SOURCE_ID.test(legacySourceId)) return fail()
  if (typeof selectedArtifactId !== 'string' || !ARTIFACT_ID.test(selectedArtifactId)) return fail()
  if (typeof backupArtifactId !== 'string' || !ARTIFACT_ID.test(backupArtifactId)) return fail()
  const canonicalBackupAt = canonicalBackupTimestamp(backupAt)
  const report = reportFor(successReportProof)
  if (report.legacySourceId !== legacySourceId
    || report.selectedArtifactId !== selectedArtifactId
    || report.backupArtifactId !== backupArtifactId
    || report.backupAt !== canonicalBackupAt
    || report.taskId !== canonicalTaskId(taskId)
    || report.taskFingerprint !== opaque(taskFingerprint)
    || report.rootBinding !== opaque(rootBinding)) return fail()
  return Object.freeze({
    legacySourceId, selectedArtifactId, backupArtifactId, backupAt: canonicalBackupAt,
    taskId: report.taskId, taskFingerprint: report.taskFingerprint, rootBinding: report.rootBinding,
    successReportProof: successReportProof as StorageV3MigrationSuccessReportProof,
  })

}

function executeRecord(
  db: Database.Database,
  rawInput: unknown,
  beforeCommit?: (selection: StorageV3MigrationSelection) => void,
): StorageV3MigrationSelectionResult {
  const input = parseInput(rawInput)
  const report = reportFor(input.successReportProof)
  if (db.inTransaction) return fail()
  const record = db.transaction((): StorageV3MigrationSelectionResult => {
    assertStore(db)
    const graceDeadlineAt = report.graceDeadlineAt

    const existing = readRow(db)
    const expected = Object.freeze({
      readerState: 'v3_selected' as const,
      legacySourceId: input.legacySourceId,
      selectedArtifactId: input.selectedArtifactId,
      backupArtifactId: input.backupArtifactId,
      successfulReportAt: report.successfulReportAt,

      graceDeadlineAt,
    })
    if (existing !== undefined) {
      if (existing.legacySourceId !== expected.legacySourceId
        || existing.selectedArtifactId !== expected.selectedArtifactId
        || existing.backupArtifactId !== expected.backupArtifactId
        || existing.successfulReportAt !== expected.successfulReportAt
        || existing.graceDeadlineAt !== expected.graceDeadlineAt) return fail()
      return Object.freeze({ kind: 'v3_migration_selection' as const, status: 'replayed' as const, selection: existing })
    }
    const inserted = db.prepare(
      `INSERT INTO migration_selection_state (
        singleton, reader_state, legacy_source_id, selected_artifact_id,
        backup_artifact_id, successful_report_at, grace_deadline_at
      ) VALUES (1, 'v3_selected', ?, ?, ?, ?, ?)`,
    ).run(
      input.legacySourceId,
      input.selectedArtifactId,
      input.backupArtifactId,
      report.successfulReportAt,

      graceDeadlineAt,
    )
    if (inserted.changes !== 1) return fail()
    const selection = readRow(db)
    if (selection === undefined) return fail()
    beforeCommit?.(selection)
    return Object.freeze({
      kind: 'v3_migration_selection' as const,
      status: 'recorded' as const,
      selection,
    })

  })
  return record.immediate()
}

export function recordStorageV3MigrationSelection(
  db: Database.Database,
  input: StorageV3MigrationSelectionInput,
): StorageV3MigrationSelectionResult {
  try {
    return executeRecord(db, input)
  } catch (error) {
    if (error instanceof StorageV3MigrationSelectionError) throw error
    return fail()
  }
}

/** Commit a new receipt only after its exact external initialization completes. */
export function recordStorageV3MigrationSelectionWithInitialization(
  db: Database.Database,
  input: StorageV3MigrationSelectionInput,
  initialize: StorageV3MigrationSelectionInitializer,
): StorageV3MigrationSelectionResult {
  if (typeof initialize !== 'function') return fail()
  return executeRecord(db, input, (selection) => {
    const grant = Object.freeze({}) as StorageV3MigrationSelectionInitializationGrant
    INITIALIZATION_GRANTS.set(grant, selection)
    try { initialize(selection, grant) } finally { INITIALIZATION_GRANTS.delete(grant) }
  })
}

/** Consume the exact grant; copied or replayed receipt values have no authority. */
export function consumeStorageV3MigrationSelectionInitialization(
  grant: StorageV3MigrationSelectionInitializationGrant,
  selection: StorageV3MigrationSelection,
): void {
  if (!grant || typeof grant !== 'object') return fail()
  const expected = INITIALIZATION_GRANTS.get(grant)
  INITIALIZATION_GRANTS.delete(grant)
  if (expected === undefined || expected !== selection) return fail()
}

export function evaluateStorageV3MigrationGrace(
  db: Database.Database,
  nowForTest?: string | (() => string),
): StorageV3MigrationGraceStatus {
  const selection = readStorageV3MigrationSelection(db)
  if (selection === undefined) return 'absent'
  const now = typeof nowForTest === 'function' ? nowForTest() : nowForTest ?? new Date().toISOString()
  const current = canonicalTimestamp(now)
  return current < selection.graceDeadlineAt ? 'active' : 'expired'
}

/** Test-only rollback seam. The production recorder has no callback or mutation bypass. */
export const v3SelectionReceiptTestSeams = Object.freeze({
  recordWithBeforeCommit(
    db: Database.Database,
    input: StorageV3MigrationSelectionInput,
    beforeCommit: () => void,
  ): StorageV3MigrationSelectionResult {
    return executeRecord(db, input, () => beforeCommit())
  },

})
