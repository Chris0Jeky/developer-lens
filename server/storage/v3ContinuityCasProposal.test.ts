import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyV3ContinuityCasProposal,
  applyV3ContinuityCasProposalWithTestHooks,
  installV3ContinuityCasProposal,
  V3_CONTINUITY_CAS_PROPOSAL_APPLICATION_ID,
  V3_CONTINUITY_CAS_PROPOSAL_SCHEMA_FINGERPRINT,
  V3_CONTINUITY_CAS_PROPOSAL_TABLES,
  V3_CONTINUITY_CAS_PROPOSAL_USER_VERSION,
  V3ContinuityCasProposalError,
  type V3ContinuityCasProposalInput,
} from './v3ContinuityCasProposal.js'

const scope = (character = 'a'): string => `scope-${character.repeat(64)}`
const operation = (character = 'a'): string => `op-${character.repeat(64)}`
const payload = (character = 'a'): string => character.repeat(64)
const request = (
  overrides: Partial<V3ContinuityCasProposalInput> = {},
): V3ContinuityCasProposalInput => ({
  scopeId: scope(),
  expectedRevision: 0,
  operationId: operation(),
  payloadSha256: payload(),
  ...overrides,
})

const openFixture = (): Database.Database => {
  const db = new Database(':memory:')
  installV3ContinuityCasProposal(db)
  return db
}

const seedScope = (db: Database.Database, scopeId = scope()): void => {
  db.prepare(
    'INSERT INTO continuity_cas_state_proposal (scope_id, revision) VALUES (?, 0)',
  ).run(scopeId)
}

const stateRevision = (db: Database.Database, scopeId = scope()): number | undefined => (
  db.prepare('SELECT revision FROM continuity_cas_state_proposal WHERE scope_id = ?')
    .pluck().get(scopeId) as number | undefined
)

const operationCount = (db: Database.Database): number => Number(
  db.prepare('SELECT COUNT(*) FROM continuity_cas_operation_proposal').pluck().get(),
)

describe('v3 continuity CAS proposal', () => {
  it('installs an exact, separate, strict fixture database contract', () => {
    const db = openFixture()
    try {
      expect(Number(db.prepare('PRAGMA application_id').pluck().get()))
        .toBe(V3_CONTINUITY_CAS_PROPOSAL_APPLICATION_ID)
      expect(Number(db.prepare('PRAGMA user_version').pluck().get()))
        .toBe(V3_CONTINUITY_CAS_PROPOSAL_USER_VERSION)
      expect(Number(db.prepare('PRAGMA foreign_keys').pluck().get())).toBe(1)
      expect(Number(db.prepare('PRAGMA recursive_triggers').pluck().get())).toBe(1)
      expect(db.prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
      ).all().map((row) => (row as { name: string }).name)).toEqual(V3_CONTINUITY_CAS_PROPOSAL_TABLES)
      expect(V3_CONTINUITY_CAS_PROPOSAL_SCHEMA_FINGERPRINT).toMatch(/^[0-9a-f]{64}$/)
      expect(String(db.prepare('PRAGMA integrity_check').pluck().get())).toBe('ok')
      expect(String(db.prepare('PRAGMA quick_check').pluck().get())).toBe('ok')
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  it('installs only into a strictly empty main and temporary schema', () => {
    const main = new Database(':memory:')
    const temp = new Database(':memory:')
    const installed = openFixture()
    try {
      main.exec('CREATE TABLE unrelated (id INTEGER)')
      temp.exec('CREATE TEMP TABLE unrelated (id INTEGER)')
      expect(() => installV3ContinuityCasProposal(main)).toThrow(V3ContinuityCasProposalError)
      expect(() => installV3ContinuityCasProposal(temp)).toThrow(V3ContinuityCasProposalError)
      expect(() => installV3ContinuityCasProposal(installed)).toThrow(V3ContinuityCasProposalError)
    } finally {
      main.close()
      temp.close()
      installed.close()
    }
  })

  it('rejects nested transactions and collapses target drift to one error', () => {
    const nested = new Database(':memory:')
    const identityDrift = openFixture()
    const schemaDrift = openFixture()
    try {
      nested.exec('BEGIN IMMEDIATE')
      expect(() => installV3ContinuityCasProposal(nested)).toThrow(V3ContinuityCasProposalError)
      nested.exec('ROLLBACK')
      identityDrift.pragma('user_version = 2')
      schemaDrift.exec('DROP TRIGGER continuity_cas_operation_no_update')
      expect(() => applyV3ContinuityCasProposal(identityDrift, request()))
        .toThrow(V3ContinuityCasProposalError)
      expect(() => applyV3ContinuityCasProposal(schemaDrift, request()))
        .toThrow(V3ContinuityCasProposalError)
    } finally {
      if (nested.inTransaction) nested.exec('ROLLBACK')
      nested.close()
      identityDrift.close()
      schemaDrift.close()
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
        expect(() => applyV3ContinuityCasProposal(
          db,
          candidate as V3ContinuityCasProposalInput,
        )).toThrow(V3ContinuityCasProposalError)
      }
      const symbolBearing = request() as V3ContinuityCasProposalInput & { [key: symbol]: string }
      symbolBearing[Symbol('hidden')] = 'x'
      expect(() => applyV3ContinuityCasProposal(db, symbolBearing))
        .toThrow(V3ContinuityCasProposalError)
      expect(accessorReads).toBe(0)
      expect(operationCount(db)).toBe(0)
    } finally {
      db.close()
    }
  })

  it('does not bootstrap an unknown scope', () => {
    const db = openFixture()
    try {
      expect(applyV3ContinuityCasProposal(db, request())).toEqual({
        kind: 'v3_continuity_cas_proposal',
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
      seedScope(db)
      const first = applyV3ContinuityCasProposal(db, request())
      const second = applyV3ContinuityCasProposal(db, request({
        expectedRevision: 1,
        operationId: operation('b'),
        payloadSha256: payload('b'),
      }))
      expect(first).toEqual({ kind: 'v3_continuity_cas_proposal', status: 'applied' })
      expect(second).toEqual({ kind: 'v3_continuity_cas_proposal', status: 'applied' })
      expect(Object.isFrozen(first)).toBe(true)
      expect(Object.isFrozen(second)).toBe(true)
      expect(JSON.stringify([first, second])).not.toMatch(/scope-|op-|[a-f0-9]{64}|revision|payload/i)
      expect(stateRevision(db)).toBe(2)
      expect(operationCount(db)).toBe(2)
    } finally {
      db.close()
    }
  })

  it('replays an exact immutable operation after the state advances', () => {
    const db = openFixture()
    try {
      seedScope(db)
      const firstRequest = request()
      expect(applyV3ContinuityCasProposal(db, firstRequest).status).toBe('applied')
      expect(applyV3ContinuityCasProposal(db, request({
        expectedRevision: 1,
        operationId: operation('b'),
        payloadSha256: payload('b'),
      })).status).toBe('applied')
      expect(applyV3ContinuityCasProposal(db, firstRequest).status).toBe('replayed')
      expect(stateRevision(db)).toBe(2)
      expect(operationCount(db)).toBe(2)
    } finally {
      db.close()
    }
  })

  it('classifies every immutable operation-identity mismatch as conflict before stale', () => {
    const db = openFixture()
    try {
      seedScope(db)
      seedScope(db, scope('b'))
      expect(applyV3ContinuityCasProposal(db, request()).status).toBe('applied')
      const conflicts = [
        request({ scopeId: scope('b') }),
        request({ expectedRevision: 1 }),
        request({ payloadSha256: payload('b') }),
      ]
      for (const candidate of conflicts) {
        expect(applyV3ContinuityCasProposal(db, candidate).status).toBe('conflict')
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
      seedScope(db)
      expect(applyV3ContinuityCasProposal(db, request()).status).toBe('applied')
      expect(applyV3ContinuityCasProposal(db, request({
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
        seedScope(db)
        expect(() => applyV3ContinuityCasProposalWithTestHooks(db, request(), {
          [stage]: () => {
            throw new Error('invented fixture failure')
          },
        })).toThrow(V3ContinuityCasProposalError)
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
    const path = resolve(directory, 'proposal.sqlite')
    const holder = new Database(path)
    const contender = new Database(path)
    try {
      installV3ContinuityCasProposal(holder)
      seedScope(holder)
      holder.pragma('busy_timeout = 0')
      contender.pragma('busy_timeout = 0')
      holder.exec('BEGIN IMMEDIATE')
      expect(() => applyV3ContinuityCasProposal(contender, request()))
        .toThrow(V3ContinuityCasProposalError)
      expect(stateRevision(contender)).toBe(0)
      expect(operationCount(contender)).toBe(0)
      holder.exec('ROLLBACK')
      expect(applyV3ContinuityCasProposal(contender, request()).status).toBe('applied')
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
      seedScope(immutable)
      expect(applyV3ContinuityCasProposal(immutable, request()).status).toBe('applied')
      expect(() => immutable.prepare(
        'UPDATE continuity_cas_operation_proposal SET payload_sha256 = ? WHERE operation_id = ?',
      ).run(payload('b'), operation())).toThrow(ERROR)
      expect(() => immutable.prepare(
        'DELETE FROM continuity_cas_operation_proposal WHERE operation_id = ?',
      ).run(operation())).toThrow(ERROR)

      seedScope(divergent)
      divergent.prepare(
        'UPDATE continuity_cas_state_proposal SET revision = 1 WHERE scope_id = ?',
      ).run(scope())
      expect(() => applyV3ContinuityCasProposal(divergent, request({ expectedRevision: 1 })))
        .toThrow(V3ContinuityCasProposalError)
    } finally {
      immutable.close()
      divergent.close()
    }
  })

  it('persists exact replay identity across a database reopen', () => {
    const directory = mkdtempSync(join(tmpdir(), 'developer-lens-cas-reopen-'))
    const path = resolve(directory, 'proposal.sqlite')
    let db = new Database(path)
    try {
      installV3ContinuityCasProposal(db)
      seedScope(db)
      expect(applyV3ContinuityCasProposal(db, request()).status).toBe('applied')
      db.close()
      db = new Database(path)
      expect(applyV3ContinuityCasProposal(db, request()).status).toBe('replayed')
      expect(stateRevision(db)).toBe(1)
      expect(operationCount(db)).toBe(1)
    } finally {
      if (db.open) db.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })
})

const ERROR = 'INVALID_V3_CONTINUITY_CAS_PROPOSAL'
