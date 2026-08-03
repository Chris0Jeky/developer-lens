import Database from 'better-sqlite3'
import {
  SQLITE_APPLICATION_ID,
  SQLITE_USER_VERSION,
  STORAGE_SCHEMA_SQL,
} from './schema.js'

export class StorageDatabaseError extends Error {
  public readonly code: 'STORAGE_TARGET_MISMATCH'

  constructor(code: 'STORAGE_TARGET_MISMATCH') {
    super(code)
    this.name = 'StorageDatabaseError'
    this.code = code
  }
}

function pragmaInteger(db: Database.Database, name: string): number {
  return Number(db.prepare(`PRAGMA ${name}`).pluck().get())
}

function hasUserTables(db: Database.Database): boolean {
  return db
    .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1")
    .get() !== undefined
}

export function openStorageDatabase(path: string): Database.Database {
  const db = new Database(path)
  db.pragma('foreign_keys = ON')

  const applicationId = pragmaInteger(db, 'application_id')
  const userVersion = pragmaInteger(db, 'user_version')
  const isFreshDatabase = applicationId === 0 && userVersion === 0
  const isV2Database =
    applicationId === SQLITE_APPLICATION_ID && userVersion === SQLITE_USER_VERSION
  if ((isFreshDatabase && hasUserTables(db)) || (!isFreshDatabase && !isV2Database)) {
    db.close()
    throw new StorageDatabaseError('STORAGE_TARGET_MISMATCH')
  }

  db.pragma(`application_id = ${SQLITE_APPLICATION_ID}`)
  db.exec(STORAGE_SCHEMA_SQL)
  db.pragma(`user_version = ${SQLITE_USER_VERSION}`)
  return db
}

export interface StorageChecks {
  integrity: string
  quick: string
  foreignKeys: unknown[]
}

export function runStorageChecks(db: Database.Database): StorageChecks {
  return {
    integrity: String(db.prepare('PRAGMA integrity_check').pluck().get()),
    quick: String(db.prepare('PRAGMA quick_check').pluck().get()),
    foreignKeys: db.prepare('PRAGMA foreign_key_check').all(),
  }
}
