import type Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
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
const BACKUP_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

/** Read/validation leaf: no report issuance, capability minting, or durable writes. */
export interface StorageV3MigrationSelection {
  readonly readerState: 'v3_selected'
  readonly legacySourceId: string
  readonly selectedArtifactId: string
  readonly backupArtifactId: string
  readonly successfulReportAt: string
  readonly graceDeadlineAt: string
}

export class StorageV3MigrationSelectionError extends Error {
  public readonly code = 'STORAGE_V3_SELECTION_INVALID' as const

  constructor() {
    super('STORAGE_V3_SELECTION_INVALID')
    this.name = 'StorageV3MigrationSelectionError'
  }
}

const fail = (): never => { throw new StorageV3MigrationSelectionError() }

export function canonicalTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !CANONICAL_TIMESTAMP.test(value)) return fail()
  const time = Date.parse(value)
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) return fail()
  return value
}

export function addGrace(timestamp: string): string {
  const time = Date.parse(timestamp)
  const deadline = new Date(time + GRACE_MILLISECONDS)
  if (!Number.isFinite(deadline.getTime())) return fail()
  const result = deadline.toISOString()
  if (!CANONICAL_TIMESTAMP.test(result)) return fail()
  return result
}

export function canonicalBackupTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !BACKUP_TIMESTAMP.test(value)) return fail()
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value.replace('Z', '.000Z')) return fail()
  return value
}

export type StorageV3MigrationReportContext = Readonly<{
  legacySourceId: string
  selectedArtifactId: string
  backupArtifactId: string
  backupAt: string
  taskId: string
  taskFingerprint: string
  rootBinding: string
}>

export function storageV3MigrationRootBinding(directory: string): string {
  // The absolute root never enters the receipt; only this process-local digest does.
  return `root-${createHash('sha256').update(directory, 'utf8').digest('hex')}`
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

export function assertStore(db: Database.Database): void {
  db.pragma('foreign_keys = ON')
  if (Number(db.prepare('PRAGMA foreign_keys').pluck().get()) !== 1
    || Number(db.prepare('PRAGMA application_id').pluck().get()) !== STORAGE_V3_SHADOW_APPLICATION_ID
    || Number(db.prepare('PRAGMA user_version').pluck().get()) !== STORAGE_V3_SHADOW_USER_VERSION
    || storageV3ShadowSchemaFingerprint(db) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT
    || db.prepare("SELECT 1 FROM sqlite_temp_schema WHERE name NOT GLOB 'sqlite_*' LIMIT 1").get() !== undefined) return fail()
}

export function readRow(db: Database.Database): StorageV3MigrationSelection | undefined {
  const row = db.prepare(
    `SELECT singleton, reader_state, legacy_source_id, selected_artifact_id,
            backup_artifact_id, successful_report_at, grace_deadline_at
     FROM migration_selection_state WHERE singleton = 1`,
  ).get() as Record<string, unknown> | undefined
  return row === undefined ? undefined : parseRow(row)
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
