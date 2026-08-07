import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import {
  evaluateStorageV3MigrationGrace,
  readStorageV3MigrationSelection,
  recordStorageV3MigrationSelection,
  recordStorageV3MigrationSelectionWithInitialization,

  StorageV3MigrationSelectionError,
  v3SelectionReceiptTestSeams,
} from './v3SelectionReceipt.js'

const artifact = (letter: string): string => `art-${letter.repeat(64)}`
const reportInput = {
  legacySourceId: `legacy-${'a'.repeat(64)}`,
  selectedArtifactId: artifact('b'),
  backupArtifactId: artifact('c'),
  backupAt: '2026-08-06T12:34:55Z',
  taskId: 'task-invented',
  taskFingerprint: 'fp-invented',
  rootBinding: 'root-invented',

} as const

function fixture(): Database.Database {
  const db = new Database(':memory:')
  installStorageV3ShadowSchema(db)
  return db
}

describe('LIFE-03 migration selection receipt', () => {
  const input = {
    ...reportInput,
    successReportProof: v3SelectionReceiptTestSeams.issueSuccessReportAt(
      reportInput, '2026-08-06T12:34:56.789Z',
    ),
  } as const


  it('records once, replays exact values, and never extends the deadline', () => {
    const db = fixture()
    try {
      const first = recordStorageV3MigrationSelection(db, input)
      expect(first.status).toBe('recorded')
      expect(first.selection).toEqual({
        readerState: 'v3_selected',
        legacySourceId: reportInput.legacySourceId,
        selectedArtifactId: reportInput.selectedArtifactId,
        backupArtifactId: reportInput.backupArtifactId,
        successfulReportAt: '2026-08-06T12:34:56.789Z',

        graceDeadlineAt: '2026-08-13T12:34:56.789Z',
      })
      expect(recordStorageV3MigrationSelection(db, input)).toEqual({
        kind: 'v3_migration_selection', status: 'replayed', selection: first.selection,
      })
      expect(readStorageV3MigrationSelection(db)).toEqual(first.selection)
      expect(() => recordStorageV3MigrationSelection(db, {
        ...input,
        successReportProof: v3SelectionReceiptTestSeams.issueSuccessReportAt(
          reportInput, '2026-08-07T12:34:56.789Z',
        ),

      })).toThrow(StorageV3MigrationSelectionError)
    } finally { db.close() }
  })

  it('keeps the receipt independent of the artifact foreign-key lifecycle', () => {
    const db = fixture()
    try {
      expect(db.prepare('PRAGMA foreign_key_list(migration_selection_state)').all()).toEqual([])
    } finally { db.close() }
  })

  it('runs one initialization inside the new receipt transaction only', () => {
    const db = fixture()
    try {
      let initialized = 0
      const recorded = recordStorageV3MigrationSelectionWithInitialization(
        db,
        input,
        (selection, grant) => {
          expect(db.inTransaction).toBe(true)
          expect(selection.successfulReportAt).toBe('2026-08-06T12:34:56.789Z')
          expect(grant).toBeDefined()
          initialized += 1
        },
      )
      expect(recorded.status).toBe('recorded')
      expect(initialized).toBe(1)
      const replayed = recordStorageV3MigrationSelectionWithInitialization(
        db,
        input,
        () => { initialized += 1 },
      )
      expect(replayed.status).toBe('replayed')
      expect(initialized).toBe(1)
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
      ).run(input.legacySourceId, input.selectedArtifactId, input.backupArtifactId, '2026-08-06T12:34:56.789Z', '2026-08-13T12:34:56.789Z'))

        .toThrow('STORAGE_V3_SELECTION_INVALID')
      expect(() => db.prepare('UPDATE migration_selection_state SET reader_state = ?').run('v3_selected'))
        .toThrow('STORAGE_V3_SELECTION_INVALID')
      expect(() => db.prepare('DELETE FROM migration_selection_state').run())
        .toThrow('STORAGE_V3_SELECTION_INVALID')
    } finally { db.close() }
  })

  it('requires an opaque report proof bound to the backup and task/root boundary', () => {
    const db = fixture()
    try {
      expect(() => v3SelectionReceiptTestSeams.issueSuccessReportAt(
        reportInput, '2026-08-06T12:34:54.999Z',
      )).toThrow(StorageV3MigrationSelectionError)
      expect(() => recordStorageV3MigrationSelection(db, {
        ...input,
        taskId: 'different-task',
      })).toThrow(StorageV3MigrationSelectionError)
      expect(() => recordStorageV3MigrationSelection(db, {
        ...input,
        successReportProof: {} as never,
      })).toThrow(StorageV3MigrationSelectionError)
    } finally { db.close() }
  })

  it('rejects a direct row whose seven-day calculation overflows to SQLite NULL', () => {
    const db = fixture()
    try {
      expect(() => db.prepare(
        `INSERT INTO migration_selection_state
         (singleton, reader_state, legacy_source_id, selected_artifact_id, backup_artifact_id, successful_report_at, grace_deadline_at)
         VALUES (1, 'v3_selected', ?, ?, ?, '9999-12-31T23:59:59.999Z', '9999-12-31T23:59:59.999Z')`,
      ).run(input.legacySourceId, input.selectedArtifactId, input.backupArtifactId))
        .toThrow(/CHECK constraint failed/)
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
