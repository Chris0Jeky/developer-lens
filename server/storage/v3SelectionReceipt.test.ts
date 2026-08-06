import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import {
  evaluateStorageV3MigrationGrace,
  readStorageV3MigrationSelection,
  recordStorageV3MigrationSelection,
  StorageV3MigrationSelectionError,
  v3SelectionReceiptTestSeams,
} from './v3SelectionReceipt.js'

const artifact = (letter: string): string => `art-${letter.repeat(64)}`
const input = {
  legacySourceId: `legacy-${'a'.repeat(64)}`,
  selectedArtifactId: artifact('b'),
  backupArtifactId: artifact('c'),
  successfulReportAt: '2026-08-06T12:34:56.789Z',
} as const

function fixture(): Database.Database {
  const db = new Database(':memory:')
  installStorageV3ShadowSchema(db)
  return db
}

describe('LIFE-03 migration selection receipt', () => {
  it('records once, replays exact values, and never extends the deadline', () => {
    const db = fixture()
    try {
      const first = recordStorageV3MigrationSelection(db, input)
      expect(first.status).toBe('recorded')
      expect(first.selection).toEqual({
        readerState: 'v3_selected',
        ...input,
        graceDeadlineAt: '2026-08-13T12:34:56.789Z',
      })
      expect(recordStorageV3MigrationSelection(db, input)).toEqual({
        kind: 'v3_migration_selection', status: 'replayed', selection: first.selection,
      })
      expect(readStorageV3MigrationSelection(db)).toEqual(first.selection)
      expect(() => recordStorageV3MigrationSelection(db, {
        ...input, successfulReportAt: '2026-08-07T12:34:56.789Z',
      })).toThrow(StorageV3MigrationSelectionError)
    } finally { db.close() }
  })

  it('keeps the receipt independent of the artifact foreign-key lifecycle', () => {
    const db = fixture()
    try {
      expect(db.prepare('PRAGMA foreign_key_list(migration_selection_state)').all()).toEqual([])
    } finally { db.close() }
  })

  it('closes direct INSERT OR REPLACE, UPDATE, and DELETE attempts', () => {
    const db = fixture()
    try {
      recordStorageV3MigrationSelection(db, input)
      expect(() => db.prepare(
        `INSERT OR REPLACE INTO migration_selection_state
         (singleton, reader_state, legacy_source_id, selected_artifact_id, backup_artifact_id, successful_report_at, grace_deadline_at)
         VALUES (1, 'v3_selected', ?, ?, ?, ?, ?)`,
      ).run(input.legacySourceId, input.selectedArtifactId, input.backupArtifactId, input.successfulReportAt, '2026-08-13T12:34:56.789Z'))
        .toThrow('STORAGE_V3_SELECTION_INVALID')
      expect(() => db.prepare('UPDATE migration_selection_state SET reader_state = ?').run('v3_selected'))
        .toThrow('STORAGE_V3_SELECTION_INVALID')
      expect(() => db.prepare('DELETE FROM migration_selection_state').run())
        .toThrow('STORAGE_V3_SELECTION_INVALID')
    } finally { db.close() }
  })

  it('evaluates just-before, exact, just-after, and clock rollback/advance', () => {
    const db = fixture()
    try {
      recordStorageV3MigrationSelection(db, input)
      const before = '2026-08-13T12:34:56.788Z'
      const exact = '2026-08-13T12:34:56.789Z'
      const after = '2026-08-13T12:34:56.790Z'
      expect(evaluateStorageV3MigrationGrace(db, before)).toBe('active')
      expect(evaluateStorageV3MigrationGrace(db, exact)).toBe('expired')
      expect(evaluateStorageV3MigrationGrace(db, () => after)).toBe('expired')
      expect(evaluateStorageV3MigrationGrace(db, () => before)).toBe('active')
    } finally { db.close() }
  })

  it('rejects malformed/excess input and does not invoke accessors', () => {
    const db = fixture()
    try {
      let getterCalled = false
      const accessor = { ...input } as Record<string, unknown>
      Object.defineProperty(accessor, 'legacySourceId', {
        enumerable: true,
        get: () => { getterCalled = true; throw new Error('getter') },
      })
      expect(() => recordStorageV3MigrationSelection(db, accessor as never)).toThrow(StorageV3MigrationSelectionError)
      expect(getterCalled).toBe(false)
      expect(() => recordStorageV3MigrationSelection(db, { ...input, extra: 'x' } as never))
        .toThrow(StorageV3MigrationSelectionError)
      expect(() => recordStorageV3MigrationSelection(db, { ...input, legacySourceId: 'legacy-source' } as never))
        .toThrow(StorageV3MigrationSelectionError)
    } finally { db.close() }
  })

  it('rolls back a pre-commit interruption under BEGIN IMMEDIATE', () => {
    const db = fixture()
    try {
      expect(() => v3SelectionReceiptTestSeams.recordWithBeforeCommit(
        db,
        input,
        () => { throw new Error('injected') },
      )).toThrow('injected')
      expect(readStorageV3MigrationSelection(db)).toBeUndefined()
      expect(recordStorageV3MigrationSelection(db, input).status).toBe('recorded')
    } finally { db.close() }
  })
})
