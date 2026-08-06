import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyContinuityCasOperation,
  applyContinuityCasOperationWithTestHooks,
  assertContinuityCasConsistency,
  ContinuityCasError,
  initializeContinuityCasScope,
  readContinuityCasState,
  type ContinuityCasInput,
} from './v3ContinuityCasProposal.js'
import {
  installStorageV3ShadowSchema,
  STORAGE_V3_CONTINUITY_CAS_ERROR,
  STORAGE_V3_CONTINUITY_CAS_TABLES,
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_TABLES,
  STORAGE_V3_SHADOW_USER_VERSION,
} from './v3ShadowSchema.js'

const scope = (character = 'a'): string => `scope-${character.repeat(64)}`
const operation = (character = 'a'): string => `op-${character.repeat(64)}`
const payload = (character = 'a'): string => character.repeat(64)
const request = (
  overrides: Partial<ContinuityCasInput> = {},
): ContinuityCasInput => ({
  scopeId: scope(),
  expectedRevision: 0,
  operationId: operation(),
  payloadSha256: payload(),
  ...overrides,
})

const openStore = (path = ':memory:'): Database.Database => {
  const db = new Database(path)
  installStorageV3ShadowSchema(db)
  return db
}

/** CAS scopes must exist in claim_scope (#128); the fixture migrates that minimum. */
const seedScope = (db: Database.Database, scopeId: string): void => {
  db.prepare('INSERT OR IGNORE INTO claim_scope (scope_id) VALUES (?)').run(scopeId)
}

const openFixture = (): Database.Database => {
  const db = openStore()
  seedScope(db, scope())
  initializeContinuityCasScope(db, scope())
  return db
}

const stateRevision = (db: Database.Database, scopeId = scope()): number | undefined => (
  db.prepare('SELECT revision FROM continuity_cas_state WHERE scope_id = ?')
    .pluck().get(scopeId) as number | undefined
)

const operationCount = (db: Database.Database): number => Number(
  db.prepare('SELECT COUNT(*) FROM continuity_cas_operation').pluck().get(),
)

describe('v3 continuity CAS in the shadow store', () => {
  it('owns two tables inside the installed shadow store contract', () => {
    const db = openStore()
    try {
      expect(Number(db.prepare('PRAGMA application_id').pluck().get()))
        .toBe(STORAGE_V3_SHADOW_APPLICATION_ID)
      expect(Number(db.prepare('PRAGMA user_version').pluck().get()))
        .toBe(STORAGE_V3_SHADOW_USER_VERSION)
      expect(db.prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
      ).pluck().all()).toEqual([...STORAGE_V3_SHADOW_TABLES].sort())
      for (const table of STORAGE_V3_CONTINUITY_CAS_TABLES) {
        expect(Number(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get())).toBe(0)
      }
      expect(readContinuityCasState(db)).toEqual({ scopes: 0, operations: 0, revisions: [] })
      expect(String(db.prepare('PRAGMA integrity_check').pluck().get())).toBe('ok')
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  it('initializes one scope idempotently and validates the scope shape', () => {
    const db = openStore()
    try {
      seedScope(db, scope())
      seedScope(db, scope('b'))
      expect(initializeContinuityCasScope(db, scope())).toBe('created')
      expect(initializeContinuityCasScope(db, scope())).toBe('existing')
      expect(initializeContinuityCasScope(db, scope('b'))).toBe('created')
      for (const invalid of ['scope-', scope('A'), `scope-${'a'.repeat(63)}`, `cl_${'a'.repeat(64)}`]) {
        expect(() => initializeContinuityCasScope(db, invalid)).toThrow(ContinuityCasError)
      }
      expect(readContinuityCasState(db)).toEqual({ scopes: 2, operations: 0, revisions: [0, 0] })
    } finally {
      db.close()
    }
  })

  it('refuses a caller transaction and collapses store drift to one error', () => {
    const nested = openStore()
    const identityDrift = openFixture()
    const schemaDrift = openFixture()
    const foreignStore = new Database(':memory:')
    try {
      nested.exec('BEGIN IMMEDIATE')
      expect(() => initializeContinuityCasScope(nested, scope())).toThrow(ContinuityCasError)
      expect(() => applyContinuityCasOperation(nested, request())).toThrow(ContinuityCasError)
      nested.exec('ROLLBACK')
      identityDrift.pragma('user_version = 2')
      schemaDrift.exec('DROP TRIGGER continuity_cas_operation_no_update')
      expect(() => applyContinuityCasOperation(identityDrift, request()))
        .toThrow(ContinuityCasError)
      expect(() => applyContinuityCasOperation(schemaDrift, request()))
        .toThrow(ContinuityCasError)
      expect(() => initializeContinuityCasScope(foreignStore, scope()))
        .toThrow(ContinuityCasError)
    } finally {
      if (nested.inTransaction) nested.exec('ROLLBACK')
      nested.close()
      identityDrift.close()
      schemaDrift.close()
      foreignStore.close()
    }
  })

  it('refuses a temp object that could shadow a CAS table', () => {
    const db = openFixture()
    try {
      db.exec('CREATE TEMP TABLE continuity_cas_state (scope_id TEXT, revision INTEGER)')
      expect(() => applyContinuityCasOperation(db, request())).toThrow(ContinuityCasError)
      expect(() => initializeContinuityCasScope(db, scope('b'))).toThrow(ContinuityCasError)
    } finally {
      db.close()
    }
  })

  it('accepts only a closed own-data request and reserves the final safe revision', () => {
    const db = openFixture()
    let accessorReads = 0
    try {
      const accessor = {
        get scopeId() {
          accessorReads += 1
          return scope()
        },
        expectedRevision: 0,
        operationId: operation(),
        payloadSha256: payload(),
      }
      const invalid: unknown[] = [
        { ...request(), extra: 'x' },
        { ...request(), scopeId: scope('A') },
        { ...request(), operationId: operation('A') },
        { ...request(), payloadSha256: payload('A') },
        { ...request(), expectedRevision: Number.MAX_SAFE_INTEGER },
        { ...request(), expectedRevision: -1 },
        accessor,
      ]
      for (const candidate of invalid) {
        expect(() => applyContinuityCasOperation(
          db,
          candidate as ContinuityCasInput,
        )).toThrow(ContinuityCasError)
      }
      const symbolBearing = request() as ContinuityCasInput & { [key: symbol]: string }
      symbolBearing[Symbol('hidden')] = 'x'
      expect(() => applyContinuityCasOperation(db, symbolBearing))
        .toThrow(ContinuityCasError)
      expect(accessorReads).toBe(0)
      expect(operationCount(db)).toBe(0)
    } finally {
      db.close()
    }
  })

  it('does not bootstrap an unknown scope', () => {
    const db = openStore()
    try {
      expect(applyContinuityCasOperation(db, request())).toEqual({
        kind: 'v3_continuity_cas',
        status: 'stale',
      })
      expect(stateRevision(db)).toBeUndefined()
      expect(operationCount(db)).toBe(0)
    } finally {
      db.close()
    }
  })

  it('applies monotonic operations and returns only frozen static status', () => {
    const db = openFixture()
    try {
      const first = applyContinuityCasOperation(db, request())
      const second = applyContinuityCasOperation(db, request({
        expectedRevision: 1,
        operationId: operation('b'),
        payloadSha256: payload('b'),
      }))
      expect(first).toEqual({ kind: 'v3_continuity_cas', status: 'applied' })
      expect(second).toEqual({ kind: 'v3_continuity_cas', status: 'applied' })
      expect(Object.isFrozen(first)).toBe(true)
      expect(Object.isFrozen(second)).toBe(true)
      expect(JSON.stringify([first, second])).not.toMatch(/scope-|op-|[a-f0-9]{64}|revision|payload/i)
      expect(stateRevision(db)).toBe(2)
      expect(operationCount(db)).toBe(2)
      expect(readContinuityCasState(db)).toEqual({ scopes: 1, operations: 2, revisions: [2] })
    } finally {
      db.close()
    }
  })

  it('replays an exact immutable operation after the state advances', () => {
    const db = openFixture()
    try {
      const firstRequest = request()
      expect(applyContinuityCasOperation(db, firstRequest).status).toBe('applied')
      expect(applyContinuityCasOperation(db, request({
        expectedRevision: 1,
        operationId: operation('b'),
        payloadSha256: payload('b'),
      })).status).toBe('applied')
      expect(applyContinuityCasOperation(db, firstRequest).status).toBe('replayed')
      expect(stateRevision(db)).toBe(2)
      expect(operationCount(db)).toBe(2)
    } finally {
      db.close()
    }
  })

  it('classifies every immutable operation-identity mismatch as conflict before stale', () => {
    const db = openFixture()
    try {
      seedScope(db, scope('b'))
      initializeContinuityCasScope(db, scope('b'))
      expect(applyContinuityCasOperation(db, request()).status).toBe('applied')
      const conflicts = [
        request({ scopeId: scope('b') }),
        request({ expectedRevision: 1 }),
        request({ payloadSha256: payload('b') }),
      ]
      for (const candidate of conflicts) {
        expect(applyContinuityCasOperation(db, candidate).status).toBe('conflict')
      }
      expect(stateRevision(db)).toBe(1)
      expect(stateRevision(db, scope('b'))).toBe(0)
      expect(operationCount(db)).toBe(1)
    } finally {
      db.close()
    }
  })

  it('returns stale for a new operation at the wrong revision without writing', () => {
    const db = openFixture()
    try {
      expect(applyContinuityCasOperation(db, request()).status).toBe('applied')
      expect(applyContinuityCasOperation(db, request({
        expectedRevision: 0,
        operationId: operation('b'),
        payloadSha256: payload('b'),
      })).status).toBe('stale')
      expect(stateRevision(db)).toBe(1)
      expect(operationCount(db)).toBe(1)
    } finally {
      db.close()
    }
  })

  it('rolls back failures after the state mutation and after the operation insert', () => {
    for (const stage of ['afterStateMutation', 'afterOperationInsert'] as const) {
      const db = openFixture()
      try {
        expect(() => applyContinuityCasOperationWithTestHooks(db, request(), {
          [stage]: () => {
            throw new Error('invented fixture failure')
          },
        })).toThrow(ContinuityCasError)
        expect(db.inTransaction).toBe(false)
        expect(stateRevision(db)).toBe(0)
        expect(operationCount(db)).toBe(0)
      } finally {
        db.close()
      }
    }
  })

  it('fails closed under a second-connection immediate lock and retries cleanly', () => {
    const directory = mkdtempSync(join(tmpdir(), 'developer-lens-cas-'))
    const path = resolve(directory, 'store.sqlite')
    const holder = openStore(path)
    const contender = new Database(path)
    try {
      seedScope(holder, scope())
      initializeContinuityCasScope(holder, scope())
      holder.pragma('busy_timeout = 0')
      contender.pragma('busy_timeout = 0')
      holder.exec('BEGIN IMMEDIATE')
      expect(() => applyContinuityCasOperation(contender, request()))
        .toThrow(ContinuityCasError)
      expect(stateRevision(contender)).toBe(0)
      expect(operationCount(contender)).toBe(0)
      holder.exec('ROLLBACK')
      expect(applyContinuityCasOperation(contender, request()).status).toBe('applied')
      expect(stateRevision(holder)).toBe(1)
      expect(operationCount(holder)).toBe(1)
    } finally {
      if (holder.inTransaction) holder.exec('ROLLBACK')
      holder.close()
      contender.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('refuses direct history mutation and detects state/history divergence', () => {
    const immutable = openFixture()
    const divergent = openFixture()
    try {
      expect(applyContinuityCasOperation(immutable, request()).status).toBe('applied')
      expect(() => immutable.prepare(
        'UPDATE continuity_cas_operation SET payload_sha256 = ? WHERE operation_id = ?',
      ).run(payload('b'), operation())).toThrow(STORAGE_V3_CONTINUITY_CAS_ERROR)
      expect(() => immutable.prepare(
        'DELETE FROM continuity_cas_operation WHERE operation_id = ?',
      ).run(operation())).toThrow(STORAGE_V3_CONTINUITY_CAS_ERROR)
      expect(() => immutable.prepare(
        'DELETE FROM continuity_cas_state WHERE scope_id = ?',
      ).run(scope())).toThrow(STORAGE_V3_CONTINUITY_CAS_ERROR)
      expect(() => immutable.prepare(
        'UPDATE continuity_cas_state SET revision = 9 WHERE scope_id = ?',
      ).run(scope())).toThrow(STORAGE_V3_CONTINUITY_CAS_ERROR)

      divergent.prepare(
        'UPDATE continuity_cas_state SET revision = 1 WHERE scope_id = ?',
      ).run(scope())
      expect(() => assertContinuityCasConsistency(divergent)).toThrow(ContinuityCasError)
      expect(() => applyContinuityCasOperation(divergent, request({ expectedRevision: 1 })))
        .toThrow(ContinuityCasError)
    } finally {
      immutable.close()
      divergent.close()
    }
  })

  it('persists exact replay identity across a store reopen', () => {
    const directory = mkdtempSync(join(tmpdir(), 'developer-lens-cas-reopen-'))
    const path = resolve(directory, 'store.sqlite')
    let db = openStore(path)
    try {
      seedScope(db, scope())
      initializeContinuityCasScope(db, scope())
      expect(applyContinuityCasOperation(db, request()).status).toBe('applied')
      db.close()
      db = new Database(path)
      expect(initializeContinuityCasScope(db, scope())).toBe('existing')
      expect(applyContinuityCasOperation(db, request()).status).toBe('replayed')
      expect(stateRevision(db)).toBe(1)
      expect(operationCount(db)).toBe(1)
    } finally {
      if (db.open) db.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('refuses to initialize a phantom scope that claim_scope does not hold (#128)', () => {
    const db = openStore()
    try {
      // Well-formed scope id, no claim_scope row: exactly the PR #130 late finding.
      expect(() => initializeContinuityCasScope(db, scope('b'))).toThrow(ContinuityCasError)
      expect(stateRevision(db, scope('b'))).toBeUndefined()
      seedScope(db, scope('b'))
      expect(initializeContinuityCasScope(db, scope('b'))).toBe('created')
    } finally {
      db.close()
    }
  })

  it('fails a replay closed once the sweep cleared its receipt, without weakening conflicts', () => {
    const db = openFixture()
    try {
      expect(applyContinuityCasOperation(db, request()).status).toBe('applied')
      // The clear-only trigger permits exactly this write — the sweep's path.
      db.prepare('UPDATE continuity_cas_operation SET payload_sha256 = NULL WHERE operation_id = ?')
        .run(operation())
      const replay = applyContinuityCasOperation(db, request())
      expect(replay.status).toBe('receipt_expired')
      // Identity mismatches still conflict ahead of the receipt check.
      expect(applyContinuityCasOperation(db, request({ scopeId: scope('b') })).status).toBe('conflict')
      expect(stateRevision(db)).toBe(1)
      expect(operationCount(db)).toBe(1)
    } finally {
      db.close()
    }
  })

  it('replays across a week boundary — applied_week is a retention record, not replay identity', () => {
    const db = openFixture()
    try {
      expect(applyContinuityCasOperation(db, request(), () => '2026-03-01T00:00:00.000Z').status)
        .toBe('applied')
      // A crash-restart retry of the byte-identical operation next week still replays.
      expect(applyContinuityCasOperation(db, request(), () => '2026-03-09T00:00:00.000Z').status)
        .toBe('replayed')
      expect(db.prepare('SELECT applied_week FROM continuity_cas_operation').pluck().get())
        .toBe('2026-W09')
    } finally {
      db.close()
    }
  })

  it('refuses to advance an orphaned CAS scope whose claim_scope row is gone (PR #136 review)', () => {
    const db = openFixture()
    try {
      expect(applyContinuityCasOperation(db, request()).status).toBe('applied')
      db.prepare('DELETE FROM claim_scope WHERE scope_id = ?').run(scope())
      expect(() => assertContinuityCasConsistency(db)).toThrow(ContinuityCasError)
      expect(() => applyContinuityCasOperation(db, request({
        expectedRevision: 1,
        operationId: operation('c'),
      }))).toThrow(ContinuityCasError)
      expect(() => initializeContinuityCasScope(db, scope())).toThrow(ContinuityCasError)
      expect(stateRevision(db)).toBe(1)
      expect(operationCount(db)).toBe(1)
    } finally {
      db.close()
    }
  })

  it('permits no receipt update other than clearing it', () => {
    const db = openFixture()
    try {
      expect(applyContinuityCasOperation(db, request()).status).toBe('applied')
      expect(() => db.prepare(
        'UPDATE continuity_cas_operation SET payload_sha256 = ? WHERE operation_id = ?',
      ).run(payload('b'), operation())).toThrow(/STORAGE_V3_CONTINUITY_CAS_INVALID/)
      expect(() => db.prepare(
        'UPDATE continuity_cas_operation SET applied_week = ? WHERE operation_id = ?',
      ).run('2026-W20', operation())).toThrow(/STORAGE_V3_CONTINUITY_CAS_INVALID/)
    } finally {
      db.close()
    }
  })
})
