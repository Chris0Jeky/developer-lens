import type Database from 'better-sqlite3'
import {
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  STORAGE_V3_SHADOW_USER_VERSION,
  storageV3ShadowSchemaFingerprint,
} from './v3ShadowSchema.js'

const CANONICAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ARTIFACT_ID = /^art-[0-9a-f]{64}$/
const LEGACY_SOURCE_ID = /^legacy-[0-9a-f]{64}$/
const GRACE_MILLISECONDS = 7 * 24 * 60 * 60 * 1000

export type StorageV3MigrationSelectionStatus = 'recorded' | 'replayed'

export interface StorageV3MigrationSelection {
  readonly readerState: 'v3_selected'
  readonly legacySourceId: string
  readonly selectedArtifactId: string
  readonly backupArtifactId: string
  readonly successfulReportAt: string
  readonly graceDeadlineAt: string
}

export interface StorageV3MigrationSelectionInput {
  readonly legacySourceId: string
  readonly selectedArtifactId: string
  readonly backupArtifactId: string
  readonly successfulReportAt: string
}

export interface StorageV3MigrationSelectionResult {
  readonly kind: 'v3_migration_selection'
  readonly status: StorageV3MigrationSelectionStatus
  readonly selection: StorageV3MigrationSelection
}

export type StorageV3MigrationGraceStatus = 'active' | 'expired' | 'absent'

export class StorageV3MigrationSelectionError extends Error {
  public readonly code = 'STORAGE_V3_SELECTION_INVALID' as const

  constructor() {
    super('STORAGE_V3_SELECTION_INVALID')
    this.name = 'StorageV3MigrationSelectionError'
  }
}

const fail = (): never => { throw new StorageV3MigrationSelectionError() }

function canonicalTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !CANONICAL_TIMESTAMP.test(value)) return fail()
  const time = Date.parse(value)
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) return fail()
  return value
}

function addGrace(timestamp: string): string {
  const time = Date.parse(timestamp)
  const deadline = new Date(time + GRACE_MILLISECONDS)
  if (!Number.isFinite(deadline.getTime())) return fail()
  const result = deadline.toISOString()
  if (!CANONICAL_TIMESTAMP.test(result)) return fail()
  return result
}

function parseInput(raw: unknown): StorageV3MigrationSelectionInput {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return fail()
  const input = raw as object
  const prototype = Object.getPrototypeOf(input)
  if (prototype !== Object.prototype && prototype !== null) return fail()
  const expected = ['backupArtifactId', 'legacySourceId', 'selectedArtifactId', 'successfulReportAt']
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
  const successfulReportAt = read('successfulReportAt')
  if (typeof legacySourceId !== 'string' || !LEGACY_SOURCE_ID.test(legacySourceId)) return fail()
  if (typeof selectedArtifactId !== 'string' || !ARTIFACT_ID.test(selectedArtifactId)) return fail()
  if (typeof backupArtifactId !== 'string' || !ARTIFACT_ID.test(backupArtifactId)) return fail()
  const reportAt = canonicalTimestamp(successfulReportAt)
  return Object.freeze({ legacySourceId, selectedArtifactId, backupArtifactId, successfulReportAt: reportAt })
}

function parseRow(row: Record<string, unknown>): StorageV3MigrationSelection {
  if (row.singleton !== 1 || row.reader_state !== 'v3_selected') return fail()
  if (typeof row.legacy_source_id !== 'string' || !LEGACY_SOURCE_ID.test(row.legacy_source_id)) return fail()
  if (typeof row.selected_artifact_id !== 'string' || !ARTIFACT_ID.test(row.selected_artifact_id)) return fail()
  if (typeof row.backup_artifact_id !== 'string' || !ARTIFACT_ID.test(row.backup_artifact_id)) return fail()
  const successfulReportAt = canonicalTimestamp(row.successful_report_at)
  const graceDeadlineAt = canonicalTimestamp(row.grace_deadline_at)
  if (addGrace(successfulReportAt) !== graceDeadlineAt) return fail()
  return Object.freeze({
    readerState: 'v3_selected',
    legacySourceId: row.legacy_source_id,
    selectedArtifactId: row.selected_artifact_id,
    backupArtifactId: row.backup_artifact_id,
    successfulReportAt,
    graceDeadlineAt,
  })
}

function assertStore(db: Database.Database): void {
  db.pragma('foreign_keys = ON')
  if (Number(db.prepare('PRAGMA foreign_keys').pluck().get()) !== 1
    || Number(db.prepare('PRAGMA application_id').pluck().get()) !== STORAGE_V3_SHADOW_APPLICATION_ID
    || Number(db.prepare('PRAGMA user_version').pluck().get()) !== STORAGE_V3_SHADOW_USER_VERSION
    || storageV3ShadowSchemaFingerprint(db) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT
    || db.prepare("SELECT 1 FROM sqlite_temp_schema WHERE name NOT GLOB 'sqlite_*' LIMIT 1").get() !== undefined) return fail()
}

function readRow(db: Database.Database): StorageV3MigrationSelection | undefined {
  const row = db.prepare(
    `SELECT singleton, reader_state, legacy_source_id, selected_artifact_id,
            backup_artifact_id, successful_report_at, grace_deadline_at
     FROM migration_selection_state WHERE singleton = 1`,
  ).get() as Record<string, unknown> | undefined
  return row === undefined ? undefined : parseRow(row)
}

function executeRecord(
  db: Database.Database,
  rawInput: unknown,
  beforeCommit?: () => void,
): StorageV3MigrationSelectionResult {
  const input = parseInput(rawInput)
  if (db.inTransaction) return fail()
  const record = db.transaction((): StorageV3MigrationSelectionResult => {
    assertStore(db)
    const graceDeadlineAt = addGrace(input.successfulReportAt)
    const existing = readRow(db)
    const expected = Object.freeze({
      readerState: 'v3_selected' as const,
      legacySourceId: input.legacySourceId,
      selectedArtifactId: input.selectedArtifactId,
      backupArtifactId: input.backupArtifactId,
      successfulReportAt: input.successfulReportAt,
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
      input.successfulReportAt,
      graceDeadlineAt,
    )
    if (inserted.changes !== 1) return fail()
    const selection = readRow(db)
    if (selection === undefined) return fail()
    beforeCommit?.()
    return Object.freeze({ kind: 'v3_migration_selection' as const, status: 'recorded' as const, selection })
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

export function readStorageV3MigrationSelection(
  db: Database.Database,
): StorageV3MigrationSelection | undefined {
  try {
    if (db.inTransaction) return fail()
    assertStore(db)
    return readRow(db)
  } catch (error) {
    if (error instanceof StorageV3MigrationSelectionError) throw error
    return fail()
  }
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
  recordWithBeforeCommit: executeRecord,
})
