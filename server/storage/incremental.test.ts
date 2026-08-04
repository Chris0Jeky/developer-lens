import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import {
  reconcileGithubCoreReceipts,
  type GithubCoreCheckpoint,
  type GithubCoreReceipt,
} from '../connectors/github/core.js'
import { openStorageDatabase, runStorageChecks } from './database.js'
import {
  INCREMENTAL_GITHUB_CORE_STORAGE_VERSION,
  INCREMENTAL_GITHUB_CORE_TABLES,
  deleteIncrementalGithubCoreScope,
  installIncrementalGithubCoreStorage,
  persistIncrementalGithubCoreTransition,
  readIncrementalGithubCoreCheckpoint,
  type PersistGithubCoreTransitionInput,
} from './incremental.js'

const databases: Database.Database[] = []
const firstRangeStart = '2026-01-01T00:00:00.000Z'
const firstRangeEnd = '2026-01-02T00:00:00.000Z'
const observedAt = '2026-01-05T00:00:00.000Z'
const startedAt = '2026-01-05T00:00:01.000Z'
const completedAt = '2026-01-05T00:00:02.000Z'

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

  it('replays identical jobs without writes and keeps rangeStart in coverage identity', () => {
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
    expect(second.transition.coverage.coverageId).toBe(first.transition.coverage.coverageId)
    persistIncrementalGithubCoreTransition(db, second)

    expect(db.prepare(
      'SELECT range_start FROM coverage_ledger ORDER BY range_start',
    ).pluck().all()).toEqual([
      firstRangeStart,
      '2026-01-01T06:00:00.000Z',
    ])
    expect(count(db, 'collection_job')).toBe(2)
    expect(count(db, 'coverage_ledger')).toBe(2)
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

    expect(recovered.transition.coverage.coverageId).toBe(
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
      collection_job: 1,
      collection_checkpoint: 1,
      source_snapshot: 1,
      coverage_ledger: 1,
    })
    for (const table of INCREMENTAL_GITHUB_CORE_TABLES) {
      expect(count(db, table, ' WHERE scope_alias = ?', 'scope-a')).toBe(0)
      expect(count(db, table, ' WHERE scope_alias = ?', 'scope-b')).toBe(1)
    }
    expect(runStorageChecks(db)).toEqual({ integrity: 'ok', quick: 'ok', foreignKeys: [] })
  })
})
