import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { completeObservedUnits } from '../../shared/coverage.js'
import {
  reconcileGithubCoreReceipts,
  type GithubCoreCheckpoint,
  type GithubCoreReceipt,
} from '../connectors/github/core.js'
import { openStorageDatabase, runStorageChecks } from './database.js'
import {
  INCREMENTAL_GITHUB_CORE_STORAGE_VERSION,
  INCREMENTAL_GITHUB_CORE_STORAGE_SCHEMA_FINGERPRINT,
  INCREMENTAL_GITHUB_CORE_TABLES,
  deleteIncrementalGithubCoreScope,
  installIncrementalGithubCoreStorage,
  readIncrementalGithubCoreStorageSchemaFingerprint,
  persistIncrementalGithubCoreTransition,
  readIncrementalGithubCoreCheckpoint,
  type RestrictedGithubCoreCheckpointTransition,
  type PersistGithubCoreTransitionInput,
} from './incremental.js'

const databases: Database.Database[] = []
const firstRangeStart = '2026-01-01T00:00:00.000Z'
const firstRangeEnd = '2026-01-02T00:00:00.000Z'
const observedAt = '2026-01-05T00:00:00.000Z'
const startedAt = '2026-01-05T00:00:01.000Z'
const completedAt = '2026-01-05T00:00:02.000Z'
/**
 * Invented content-free coverage keys (#86). The connector and the storage CHECK now agree on
 * one shape — `cov-` plus 64 lowercase hex — and `UNIQUE(coverage_id)` pins one logical window
 * per key, so every fixture job below derives its own key from its job id: a replay of the same
 * job reuses its exact key, and a different job over any window gets a different one.
 */
const coverageKey = (seed: string): string =>
  `cov-${createHash('sha256').update(`incremental-fixture/${seed}`).digest('hex')}`
/** The legacy alias-bearing form the ledger must now refuse outright. */
const aliasBearingCoverageId = 'github.core:scope-a:2026-01-02T00:00:00.000Z'

afterEach(() => {
  for (const db of databases.splice(0)) {
    if (db.open) db.close()
  }
})

function database(): Database.Database {
  const db = openStorageDatabase(':memory:')
  databases.push(db)
  return db
}

interface CompleteOptions {
  scopeAlias?: string
  consentRevision?: string
  jobId?: string
  coverageId?: string
  snapshotId?: string
  snapshotHash?: string
  rangeStart?: string
  rangeEnd?: string
  previous?: GithubCoreCheckpoint | null
  highWatermark?: string
}

function completeInput(options: CompleteOptions = {}): PersistGithubCoreTransitionInput {
  const scopeAlias = options.scopeAlias ?? 'scope-a'
  const consentRevision = options.consentRevision ?? 'consent-a'
  const jobId = options.jobId ?? 'job-a1'
  const rangeStart = options.rangeStart ?? firstRangeStart
  const rangeEnd = options.rangeEnd ?? firstRangeEnd
  const receipt: GithubCoreReceipt = {
    receiptId: 'receipt-' + jobId,
    pageNumber: 1,
    unitIds: [],
    nextCursor: null,
    ...(options.highWatermark ? { highWatermark: options.highWatermark } : {}),
  }
  return {
    jobId,
    scopeAlias,
    consentRevision,
    sourceSnapshotId: options.snapshotId ?? 'snapshot-' + jobId,
    startedAt,
    completedAt,
    transition: reconcileGithubCoreReceipts({
      checkpoint: options.previous ?? null,
      coverageId: options.coverageId ?? coverageKey(jobId),
      scopeAlias,
      rangeStart,
      rangeEnd,
      observedAt,
      jobId,
      consentRevision,
      pageCap: 2,
      snapshotHash: options.snapshotHash ?? 'a'.repeat(64),
      receipts: [receipt],
    }),
  }
}

function failedInput(
  previous: GithubCoreCheckpoint | null,
  jobId = 'job-failed',
): PersistGithubCoreTransitionInput {
  return {
    jobId,
    scopeAlias: 'scope-a',
    consentRevision: 'consent-a',
    startedAt,
    completedAt,
    transition: reconcileGithubCoreReceipts({
      checkpoint: previous,
      coverageId: coverageKey(jobId),
      scopeAlias: 'scope-a',
      rangeStart: '2026-01-02T00:00:00.000Z',
      rangeEnd: '2026-01-03T00:00:00.000Z',
      observedAt,
      jobId,
      consentRevision: 'consent-a',
      pageCap: 2,
      receipts: [],
      failure: { kind: 'transient', attempt: 1 },
    }),
  }
}

function truncatedInput(
  previous: GithubCoreCheckpoint | null,
  jobId = 'job-truncated',
): PersistGithubCoreTransitionInput {
  return {
    jobId,
    scopeAlias: 'scope-a',
    consentRevision: 'consent-a',
    startedAt,
    completedAt,
    transition: reconcileGithubCoreReceipts({
      checkpoint: previous,
      coverageId: coverageKey(jobId),
      scopeAlias: 'scope-a',
      rangeStart: '2026-01-03T00:00:00.000Z',
      rangeEnd: '2026-01-04T00:00:00.000Z',
      observedAt,
      jobId,
      consentRevision: 'consent-a',
      pageCap: 1,
      receipts: [{
        receiptId: 'receipt-' + jobId,
        pageNumber: 1,
        unitIds: ['unit-a'],
        nextCursor: 'cursor-next',
      }],
    }),
  }
}

function restrictedInput(
  previous: GithubCoreCheckpoint | null,
  jobId = 'job-restricted',
  coverageId = coverageKey(jobId),
): PersistGithubCoreTransitionInput {
  const transition: RestrictedGithubCoreCheckpointTransition = {
    status: 'restricted',
    coverage: {
      coverageId,
      capabilityId: 'github.core',
      scopeAlias: 'scope-a',
      rangeStart: '2026-01-02T00:00:00.000Z',
      rangeEnd: '2026-01-03T00:00:00.000Z',
      status: 'restricted',
      expectedUnits: null,
      observedUnits: 0,
      omittedUnits: null,
      retryable: false,
      observedAt,
      limitationCode: 'REPOSITORY_NOT_PUBLIC',
    },
    checkpoint: previous,
    appliedReceiptIds: [],
  }
  return {
    jobId,
    scopeAlias: 'scope-a',
    consentRevision: 'consent-a',
    startedAt,
    completedAt,
    transition,
  }
}

function count(db: Database.Database, table: string, where = '', value?: string): number {
  const statement = db.prepare('SELECT COUNT(*) FROM ' + table + where).pluck()
  return Number(value === undefined ? statement.get() : statement.get(value))
}

function ownedValues(db: Database.Database): string {
  return JSON.stringify(INCREMENTAL_GITHUB_CORE_TABLES.flatMap(
    (table) => db.prepare('SELECT * FROM ' + table).all(),
  ))
}

describe('P4 opt-in incremental github.core storage', () => {
  it('installs four additive tables without changing P2 version or existing rows', () => {
    const db = database()
    db.prepare(
      'INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, 0, 0, 0)',
    ).run('repo-provider-a', 'repo-a')
    const userVersion = db.pragma('user_version', { simple: true })
    const before = db.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
    ).pluck().all() as string[]
    expect(before).not.toEqual(expect.arrayContaining([...INCREMENTAL_GITHUB_CORE_TABLES]))

    installIncrementalGithubCoreStorage(db)
    installIncrementalGithubCoreStorage(db)

    const after = db.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
    ).pluck().all() as string[]
    expect(after.filter((name) => INCREMENTAL_GITHUB_CORE_TABLES.includes(
      name as typeof INCREMENTAL_GITHUB_CORE_TABLES[number],
    ))).toEqual([...INCREMENTAL_GITHUB_CORE_TABLES].sort())
    expect(db.pragma('user_version', { simple: true })).toBe(userVersion)
    expect(db.prepare('SELECT provider_id, analytical_key FROM repository_identity').get()).toEqual({
      provider_id: 'repo-provider-a',
      analytical_key: 'repo-a',
    })
    expect(readIncrementalGithubCoreStorageSchemaFingerprint(db)).toBe(
      INCREMENTAL_GITHUB_CORE_STORAGE_SCHEMA_FINGERPRINT,
    )
    expect(INCREMENTAL_GITHUB_CORE_STORAGE_VERSION).toBe('2.2.0')
  })

  it('fails closed on the prior 2.1.0 extension contract without partial DDL', () => {
    const db = database()
    db.exec([
      'CREATE TABLE collection_job (',
      '  job_id TEXT PRIMARY KEY NOT NULL,',
      "  storage_contract_version TEXT NOT NULL CHECK (storage_contract_version = '2.1.0'),",
      "  status TEXT NOT NULL CHECK (status IN ('complete', 'truncated', 'failed'))",
      ') STRICT;',
      "INSERT INTO collection_job (job_id, storage_contract_version, status) VALUES ('legacy-job', '2.1.0', 'failed');",
    ].join('\n'))

    expect(() => installIncrementalGithubCoreStorage(db)).toThrow(
      'INCREMENTAL_STORAGE_SCHEMA_MISMATCH',
    )
    expect(db.prepare('SELECT job_id, storage_contract_version, status FROM collection_job').all()).toEqual([
      { job_id: 'legacy-job', storage_contract_version: '2.1.0', status: 'failed' },
    ])
    for (const table of INCREMENTAL_GITHUB_CORE_TABLES.slice(1)) {
      expect(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?").get(table)).toBeUndefined()
    }
    expect(readIncrementalGithubCoreStorageSchemaFingerprint(db)).not.toBe(
      INCREMENTAL_GITHUB_CORE_STORAGE_SCHEMA_FINGERPRINT,
    )
  })

  it('fails closed on a conflicting pre-existing table without partial owned DDL', () => {
    const db = database()
    const userVersion = db.pragma('user_version', { simple: true })
    db.exec([
      'CREATE TABLE collection_job (sentinel TEXT NOT NULL);',
      "INSERT INTO collection_job (sentinel) VALUES ('sentinel');",
    ].join('\n'))

    expect(() => installIncrementalGithubCoreStorage(db)).toThrow(
      'INCREMENTAL_STORAGE_SCHEMA_MISMATCH',
    )
    expect(db.prepare('SELECT sentinel FROM collection_job').pluck().all()).toEqual(['sentinel'])
    expect(db.pragma('user_version', { simple: true })).toBe(userVersion)
    const ownedObjects = db.prepare(
      `SELECT type, name FROM sqlite_schema WHERE name IN (${[
        ...INCREMENTAL_GITHUB_CORE_TABLES,
        'collection_job_immutable_update',
        'source_snapshot_complete_job',
        'coverage_ledger_job_match',
        'collection_checkpoint_complete_job_insert',
        'collection_checkpoint_complete_job_update',
      ].map(() => '?').join(', ')}) ORDER BY type, name`,
    ).all(
      ...INCREMENTAL_GITHUB_CORE_TABLES,
      'collection_job_immutable_update',
      'source_snapshot_complete_job',
      'coverage_ledger_job_match',
      'collection_checkpoint_complete_job_insert',
      'collection_checkpoint_complete_job_update',
    )
    expect(ownedObjects).toEqual([{ type: 'table', name: 'collection_job' }])
  })

  it('rejects a missing or tampered owned object without repairing or mutating it', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    db.exec('DROP TRIGGER collection_job_immutable_update;')
    const before = db.prepare(
      "SELECT name FROM sqlite_schema WHERE type IN ('table', 'trigger') AND name NOT GLOB 'sqlite_*' ORDER BY type, name",
    ).pluck().all()

    expect(() => installIncrementalGithubCoreStorage(db)).toThrow(
      'INCREMENTAL_STORAGE_SCHEMA_MISMATCH',
    )
    expect(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'trigger' AND name = 'collection_job_immutable_update'").get()).toBeUndefined()
    expect(db.prepare(
      "SELECT name FROM sqlite_schema WHERE type IN ('table', 'trigger') AND name NOT GLOB 'sqlite_*' ORDER BY type, name",
    ).pluck().all()).toEqual(before)

    const dbWithTamperedTable = database()
    installIncrementalGithubCoreStorage(dbWithTamperedTable)
    dbWithTamperedTable.exec([
      'DROP TABLE source_snapshot;',
      'CREATE TABLE source_snapshot (sentinel TEXT NOT NULL);',
    ].join('\n'))
    expect(() => installIncrementalGithubCoreStorage(dbWithTamperedTable)).toThrow(
      'INCREMENTAL_STORAGE_SCHEMA_MISMATCH',
    )
    expect(dbWithTamperedTable.prepare('SELECT sentinel FROM source_snapshot').all()).toEqual([])
    expect(dbWithTamperedTable.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'collection_checkpoint'",
    ).get()).not.toBeUndefined()
  })

  it('rejects unexpected triggers or indexes attached to owned tables', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    db.exec([
      'CREATE TRIGGER unexpected_checkpoint_insert',
      'AFTER INSERT ON collection_checkpoint',
      'BEGIN',
      '  DELETE FROM collection_job WHERE job_id = NEW.committed_job_id;',
      'END;',
    ].join('\n'))

    expect(() => installIncrementalGithubCoreStorage(db)).toThrow(
      'INCREMENTAL_STORAGE_SCHEMA_MISMATCH',
    )
    expect(db.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'trigger' AND name = 'unexpected_checkpoint_insert'",
    ).pluck().get()).toBe('unexpected_checkpoint_insert')
    expect(readIncrementalGithubCoreStorageSchemaFingerprint(db)).not.toBe(
      INCREMENTAL_GITHUB_CORE_STORAGE_SCHEMA_FINGERPRINT,
    )

    const dbWithIndex = database()
    installIncrementalGithubCoreStorage(dbWithIndex)
    dbWithIndex.exec('CREATE INDEX unexpected_scope_index ON collection_job(scope_alias);')
    expect(() => installIncrementalGithubCoreStorage(dbWithIndex)).toThrow(
      'INCREMENTAL_STORAGE_SCHEMA_MISMATCH',
    )
  })

  it('rejects temporary objects that shadow or mutate owned tables', () => {
    const dbWithShadow = database()
    installIncrementalGithubCoreStorage(dbWithShadow)
    dbWithShadow.exec('CREATE TEMP TABLE collection_job (sentinel TEXT NOT NULL);')

    expect(() => installIncrementalGithubCoreStorage(dbWithShadow)).toThrow(
      'INCREMENTAL_STORAGE_SCHEMA_MISMATCH',
    )
    expect(dbWithShadow.prepare(
      "SELECT name FROM sqlite_temp_schema WHERE type = 'table' AND name = 'collection_job'",
    ).pluck().get()).toBe('collection_job')
    expect(readIncrementalGithubCoreStorageSchemaFingerprint(dbWithShadow)).not.toBe(
      INCREMENTAL_GITHUB_CORE_STORAGE_SCHEMA_FINGERPRINT,
    )

    const dbWithTrigger = database()
    installIncrementalGithubCoreStorage(dbWithTrigger)
    dbWithTrigger.exec([
      'CREATE TEMP TRIGGER unexpected_temp_checkpoint_insert',
      'AFTER INSERT ON main.collection_checkpoint',
      'BEGIN',
      '  DELETE FROM collection_job WHERE job_id = NEW.committed_job_id;',
      'END;',
    ].join('\n'))
    expect(() => installIncrementalGithubCoreStorage(dbWithTrigger)).toThrow(
      'INCREMENTAL_STORAGE_SCHEMA_MISMATCH',
    )
  })

  it('atomically stores an empty complete snapshot and a checkpoint without a watermark', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    const input = completeInput()

    expect(persistIncrementalGithubCoreTransition(db, input)).toMatchObject({ applied: true })
    const checkpoint = readIncrementalGithubCoreCheckpoint(db, 'scope-a')

    expect(checkpoint).toMatchObject({
      capabilityId: 'github.core',
      scopeAlias: 'scope-a',
      consentRevision: 'consent-a',
      committedJobId: 'job-a1',
      lastCompleteSnapshotHash: 'a'.repeat(64),
    })
    expect(Object.hasOwn(checkpoint!, 'highWatermark')).toBe(false)
    for (const table of INCREMENTAL_GITHUB_CORE_TABLES) expect(count(db, table)).toBe(1)
    expect(db.prepare(
      'SELECT storage_contract_version, status FROM collection_job WHERE job_id = ?',
    ).get('job-a1')).toEqual({
      storage_contract_version: INCREMENTAL_GITHUB_CORE_STORAGE_VERSION,
      status: 'complete',
    })
    expect(() => db.prepare(
      'UPDATE collection_job SET completed_at = ? WHERE job_id = ?',
    ).run('2026-01-05T00:00:03.000Z', 'job-a1')).toThrow('COLLECTION_JOB_IMMUTABLE')
    expect(runStorageChecks(db)).toEqual({ integrity: 'ok', quick: 'ok', foreignKeys: [] })
  })

  it('rejects unknown fields at every persisted boundary before writing a canary', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    const base = completeInput()
    const checkpoint = base.transition.checkpoint!
    const candidates: unknown[] = [
      { ...base, privateCanary: 'private-canary' },
      { ...base, transition: { ...base.transition, privateCanary: 'private-canary' } },
      {
        ...base,
        transition: {
          ...base.transition,
          coverage: { ...base.transition.coverage, privateCanary: 'private-canary' },
        },
      },
      {
        ...base,
        transition: {
          ...base.transition,
          checkpoint: { ...checkpoint, privateCanary: 'private-canary' },
        },
      },
    ]

    for (const candidate of candidates) {
      expect(() => persistIncrementalGithubCoreTransition(db, candidate)).toThrow()
    }
    for (const table of INCREMENTAL_GITHUB_CORE_TABLES) expect(count(db, table)).toBe(0)
    expect(ownedValues(db)).not.toContain('private-canary')
  })

  it('replays identical jobs without writes and keeps a distinct key per stored window', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    const first = completeInput()
    persistIncrementalGithubCoreTransition(db, first)

    expect(persistIncrementalGithubCoreTransition(db, first)).toMatchObject({ applied: false })
    expect(() => persistIncrementalGithubCoreTransition(db, {
      ...first,
      completedAt: '2026-01-05T00:00:03.000Z',
    })).toThrow('COLLECTION_JOB_ID_COLLISION')

    const previous = readIncrementalGithubCoreCheckpoint(db, 'scope-a')
    const second = completeInput({
      previous,
      jobId: 'job-a2',
      snapshotId: 'snapshot-job-a2',
      snapshotHash: 'b'.repeat(64),
      rangeStart: '2026-01-01T06:00:00.000Z',
      rangeEnd: firstRangeEnd,
    })
    // #86: the key is caller-owned and UNIQUE, so a second job over a second window
    // must arrive with its own key — the store cannot hold two windows under one.
    expect(second.transition.coverage.coverageId).not.toBe(first.transition.coverage.coverageId)
    persistIncrementalGithubCoreTransition(db, second)

    expect(db.prepare(
      'SELECT range_start, coverage_id FROM coverage_ledger ORDER BY range_start',
    ).all()).toEqual([
      { range_start: firstRangeStart, coverage_id: first.transition.coverage.coverageId },
      { range_start: '2026-01-01T06:00:00.000Z', coverage_id: second.transition.coverage.coverageId },
    ])
    expect(count(db, 'collection_job')).toBe(2)
    expect(count(db, 'coverage_ledger')).toBe(2)
  })

  it('refuses an alias-bearing key and a key already spent on another window (#86)', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    const first = completeInput()
    persistIncrementalGithubCoreTransition(db, first)

    // The legacy alias-bearing shape carried the scope alias verbatim; it is no longer storable.
    expect(() => persistIncrementalGithubCoreTransition(
      db,
      restrictedInput(readIncrementalGithubCoreCheckpoint(db, 'scope-a'), 'job-alias', aliasBearingCoverageId),
    )).toThrow()
    // Nor may a fresh window silently reuse a key another window already holds.
    expect(() => persistIncrementalGithubCoreTransition(db, completeInput({
      jobId: 'job-a2',
      coverageId: first.transition.coverage.coverageId,
      snapshotId: 'snapshot-job-a2',
      snapshotHash: 'b'.repeat(64),
      rangeStart: '2026-01-02T00:00:00.000Z',
      rangeEnd: '2026-01-03T00:00:00.000Z',
      previous: readIncrementalGithubCoreCheckpoint(db, 'scope-a'),
    }))).toThrow()

    expect(count(db, 'coverage_ledger')).toBe(1)
    expect(count(db, 'collection_job')).toBe(1)
    expect(runStorageChecks(db)).toEqual({ integrity: 'ok', quick: 'ok', foreignKeys: [] })
  })

  it('records failed and truncated coverage without advancing the durable checkpoint', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    persistIncrementalGithubCoreTransition(db, completeInput())
    const previous = readIncrementalGithubCoreCheckpoint(db, 'scope-a')

    persistIncrementalGithubCoreTransition(db, failedInput(previous))
    expect(readIncrementalGithubCoreCheckpoint(db, 'scope-a')).toEqual(previous)
    const truncated = truncatedInput(previous)
    expect(truncated.transition.cursorHint).toBe('cursor-next')
    persistIncrementalGithubCoreTransition(db, truncated)
    expect(readIncrementalGithubCoreCheckpoint(db, 'scope-a')).toEqual(previous)

    expect(count(db, 'collection_job')).toBe(3)
    expect(count(db, 'coverage_ledger')).toBe(3)
    expect(count(db, 'source_snapshot')).toBe(1)
    expect(db.prepare(
      'SELECT status FROM coverage_ledger ORDER BY status',
    ).pluck().all()).toEqual(['complete', 'failed', 'truncated'])
  })

  it('records restricted coverage without an observational zero or checkpoint advance', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    persistIncrementalGithubCoreTransition(db, completeInput())
    const previous = readIncrementalGithubCoreCheckpoint(db, 'scope-a')
    const restricted = restrictedInput(previous)

    expect(completeObservedUnits(restricted.transition.coverage)).toBeNull()
    expect(persistIncrementalGithubCoreTransition(db, restricted)).toMatchObject({ applied: true })
    expect(readIncrementalGithubCoreCheckpoint(db, 'scope-a')).toEqual(previous)
    expect(db.prepare(
      'SELECT status, snapshot_id, expected_units, observed_units, omitted_units, limitation_code FROM coverage_ledger WHERE job_id = ?',
    ).get('job-restricted')).toEqual({
      status: 'restricted',
      snapshot_id: null,
      expected_units: null,
      observed_units: 0,
      omitted_units: null,
      limitation_code: 'REPOSITORY_NOT_PUBLIC',
    })
    expect(count(db, 'collection_job')).toBe(2)
    expect(count(db, 'coverage_ledger')).toBe(2)
    expect(count(db, 'source_snapshot')).toBe(1)
    expect(persistIncrementalGithubCoreTransition(db, restricted)).toMatchObject({ applied: false })
    expect(count(db, 'collection_job')).toBe(2)
    expect(runStorageChecks(db)).toEqual({ integrity: 'ok', quick: 'ok', foreignKeys: [] })
  })

  it('rejects restricted snapshot, cursor, and coverage-status mismatches before writing', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    const restricted = restrictedInput(null)

    expect(() => persistIncrementalGithubCoreTransition(db, {
      ...restricted,
      sourceSnapshotId: 'forbidden-snapshot',
    })).toThrow('NONCOMPLETE_SNAPSHOT_FORBIDDEN')
    expect(() => persistIncrementalGithubCoreTransition(db, {
      ...restricted,
      transition: { ...restricted.transition, cursorHint: 'forbidden-cursor' },
    })).toThrow('CURSOR_HINT_STATUS_MISMATCH')
    expect(() => persistIncrementalGithubCoreTransition(db, {
      ...restricted,
      transition: {
        ...restricted.transition,
        coverage: { ...restricted.transition.coverage, status: 'failed' },
      },
    } as unknown as PersistGithubCoreTransitionInput)).toThrow('COVERAGE_STATUS_MISMATCH')
    for (const table of INCREMENTAL_GITHUB_CORE_TABLES) expect(count(db, table)).toBe(0)
  })

  it('rolls back a restricted transition when coverage persistence fails', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    persistIncrementalGithubCoreTransition(db, completeInput())
    const previous = readIncrementalGithubCoreCheckpoint(db, 'scope-a')
    db.exec([
      'CREATE TRIGGER injected_restricted_failure BEFORE INSERT ON coverage_ledger',
      'BEGIN',
      "  SELECT RAISE(ABORT, 'INJECTED_RESTRICTED_FAILURE');",
      'END;',
    ].join('\n'))

    expect(() => persistIncrementalGithubCoreTransition(db, restrictedInput(previous))).toThrow(
      'INJECTED_RESTRICTED_FAILURE',
    )
    expect(readIncrementalGithubCoreCheckpoint(db, 'scope-a')).toEqual(previous)
    expect(count(db, 'collection_job')).toBe(1)
    expect(count(db, 'coverage_ledger')).toBe(1)
    expect(count(db, 'source_snapshot')).toBe(1)
    expect(runStorageChecks(db)).toEqual({ integrity: 'ok', quick: 'ok', foreignKeys: [] })
  })

  it('records recovery after a failed attempt over the same range', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    const failed = failedInput(null, 'job-failed-same-range')
    persistIncrementalGithubCoreTransition(db, failed)
    const recovered = completeInput({
      jobId: 'job-recovered',
      snapshotId: 'snapshot-recovered',
      snapshotHash: 'c'.repeat(64),
      rangeStart: failed.transition.coverage.rangeStart,
      rangeEnd: failed.transition.coverage.rangeEnd,
    })

    // #86: recovery is a NEW job, so it carries its own key even over the same range —
    // only a replay of the identical job reuses one.
    expect(recovered.transition.coverage.coverageId).not.toBe(
      failed.transition.coverage.coverageId,
    )
    persistIncrementalGithubCoreTransition(db, recovered)

    expect(count(db, 'coverage_ledger')).toBe(2)
    expect(db.prepare(
      'SELECT status FROM coverage_ledger ORDER BY status',
    ).pluck().all()).toEqual(['complete', 'failed'])
    expect(readIncrementalGithubCoreCheckpoint(db, 'scope-a')?.committedJobId).toBe(
      'job-recovered',
    )
  })

  it.each(['source_snapshot', 'coverage_ledger', 'collection_checkpoint'])(
    'rolls back every write when %s insertion fails',
    (table) => {
      const db = database()
      installIncrementalGithubCoreStorage(db)
      db.exec([
        'CREATE TRIGGER injected_failure BEFORE INSERT ON ' + table,
        'BEGIN',
        "  SELECT RAISE(ABORT, 'INJECTED_STORAGE_FAILURE');",
        'END;',
      ].join('\n'))

      expect(() => persistIncrementalGithubCoreTransition(db, completeInput())).toThrow(
        'INJECTED_STORAGE_FAILURE',
      )
      for (const ownedTable of INCREMENTAL_GITHUB_CORE_TABLES) {
        expect(count(db, ownedTable)).toBe(0)
      }
      expect(runStorageChecks(db)).toEqual({ integrity: 'ok', quick: 'ok', foreignKeys: [] })
    },
  )

  it('rejects consent mismatch and non-monotonic checkpoint replacement', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    persistIncrementalGithubCoreTransition(db, completeInput({
      highWatermark: '2026-01-01T12:00:00.000Z',
    }))
    const previous = readIncrementalGithubCoreCheckpoint(db, 'scope-a')
    const next = completeInput({
      previous,
      jobId: 'job-a2',
      snapshotId: 'snapshot-job-a2',
      snapshotHash: 'b'.repeat(64),
      highWatermark: '2026-01-01T13:00:00.000Z',
    })

    expect(() => persistIncrementalGithubCoreTransition(db, {
      ...next,
      consentRevision: 'consent-other',
    })).toThrow('CHECKPOINT_CONSENT_MISMATCH')
    expect(() => persistIncrementalGithubCoreTransition(db, {
      ...next,
      transition: {
        ...next.transition,
        checkpoint: {
          ...next.transition.checkpoint!,
          highWatermark: '2026-01-01T11:00:00.000Z',
        },
      },
    })).toThrow('CHECKPOINT_WATERMARK_REGRESSION')
    expect(() => persistIncrementalGithubCoreTransition(db, {
      ...next,
      transition: {
        ...next.transition,
        checkpoint: {
          ...next.transition.checkpoint!,
          highWatermark: '2026-01-03T00:00:00.000Z',
        },
      },
    })).toThrow('CHECKPOINT_HIGH_WATERMARK_OUT_OF_RANGE')
    expect(count(db, 'collection_job')).toBe(1)
    expect(readIncrementalGithubCoreCheckpoint(db, 'scope-a')).toEqual(previous)
  })

  it('deletes all owned rows for one scope while preserving another scope', () => {
    const db = database()
    installIncrementalGithubCoreStorage(db)
    persistIncrementalGithubCoreTransition(db, completeInput())
    persistIncrementalGithubCoreTransition(db, restrictedInput(
      readIncrementalGithubCoreCheckpoint(db, 'scope-a'),
      'job-restricted-a',
    ))
    persistIncrementalGithubCoreTransition(db, completeInput({
      scopeAlias: 'scope-b',
      consentRevision: 'consent-b',
      jobId: 'job-b1',
      snapshotId: 'snapshot-job-b1',
      snapshotHash: 'b'.repeat(64),
    }))

    expect(() => db.prepare(
      'UPDATE coverage_ledger SET snapshot_id = ? WHERE job_id = ?',
    ).run('snapshot-job-a1', 'job-b1')).toThrow('FOREIGN KEY')
    expect(() => db.prepare(
      'UPDATE collection_checkpoint SET source_snapshot_id = ? WHERE scope_alias = ?',
    ).run('snapshot-job-a1', 'scope-b')).toThrow()

    const deleted = deleteIncrementalGithubCoreScope(db, 'scope-a')

    expect(Object.keys(deleted).sort()).toEqual([...INCREMENTAL_GITHUB_CORE_TABLES].sort())
    expect(deleted).toEqual({
      collection_job: 2,
      collection_checkpoint: 1,
      source_snapshot: 1,
      coverage_ledger: 2,
    })
    for (const table of INCREMENTAL_GITHUB_CORE_TABLES) {
      expect(count(db, table, ' WHERE scope_alias = ?', 'scope-a')).toBe(0)
      expect(count(db, table, ' WHERE scope_alias = ?', 'scope-b')).toBe(1)
    }
    expect(runStorageChecks(db)).toEqual({ integrity: 'ok', quick: 'ok', foreignKeys: [] })
  })
})
