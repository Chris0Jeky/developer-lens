import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { completeObservedUnits } from '../../shared/coverage.js'
import {
  composeGithubCoreRestComplete,
  composeGithubCoreRestNoncomplete,
  type GithubCoreRestCompositionContext,
} from '../connectors/github/restComposition.js'
import type { GithubCoreRestCompleteResult, GithubCoreRestNonCompleteResult } from '../connectors/github/restTransport.js'
import { openStorageDatabase } from './database.js'
import {
  installIncrementalGithubCoreStorage,
  persistIncrementalGithubCoreTransition,
  readIncrementalGithubCoreCheckpoint,
} from './incremental.js'

const rangeStart = '2026-07-01T00:00:00.000Z'
const rangeEnd = '2026-08-01T00:00:00.000Z'
const observedAt = '2026-08-04T00:00:00.000Z'
const startedAt = '2026-08-04T00:00:01.000Z'
const completedAt = '2026-08-04T00:00:02.000Z'
const scopeAlias = 'repo-alias'
const consentRevision = 'consent-replay-1'

const databases: Database.Database[] = []

afterEach(() => {
  for (const db of databases.splice(0)) {
    if (db.open) db.close()
  }
})

function database(): Database.Database {
  const db = openStorageDatabase(':memory:')
  installIncrementalGithubCoreStorage(db)
  databases.push(db)
  return db
}

const context = (jobId: string, checkpoint: Parameters<typeof composeGithubCoreRestComplete>[0]['checkpoint'] = null): GithubCoreRestCompositionContext => ({
  checkpoint,
  scopeAlias,
  rangeStart,
  rangeEnd,
  observedAt,
  jobId,
  consentRevision,
  pageCap: 5,
})

function completeResult(): GithubCoreRestCompleteResult {
  return {
    kind: 'complete',
    status: 'complete',
    total: 1,
    rangeStart,
    rangeEnd,
    repositoryAlias: scopeAlias,
    rateLimit: { remaining: 10, reset: 1234 },
    repositoryFlags: { public: true, archived: false, disabled: false, fork: false },
    units: [{ alias: 'issue-a', kind: 'issue', updatedAt: '2026-07-03T00:00:00.000Z' }],
    pages: [{ pageNumber: 1, receiptAlias: 'page-1', unitCount: 1, unitAliases: ['issue-a'], nextPage: null }],
    observedUnitCount: 1,
    observedPageCount: 1,
  }
}

function noncompleteResult(kind: 'restricted' | 'failed' | 'metadata' | 'partial'): GithubCoreRestNonCompleteResult {
  if (kind === 'restricted') {
    return {
      kind: 'restricted',
      status: 'restricted',
      code: 'REPOSITORY_NOT_PUBLIC',
      repositoryAlias: scopeAlias,
      rateLimit: { remaining: null, reset: null },
      rangeStart,
      rangeEnd,
    }
  }
  if (kind === 'failed') {
    return {
      kind: 'failed',
      status: 'failed',
      code: 'SCHEMA_INVALID',
      repositoryAlias: scopeAlias,
      rateLimit: { remaining: null, reset: null },
      rangeStart,
      rangeEnd,
    }
  }
  if (kind === 'metadata') {
    return {
      kind: 'truncated',
      status: 'truncated',
      total: null,
      code: 'RATE_LIMITED',
      repositoryAlias: scopeAlias,
      rateLimit: { remaining: 0, reset: 1234 },
      repositoryFlags: null,
      units: null,
      pages: null,
      observedUnitCount: null,
      observedPageCount: null,
      rangeStart,
      rangeEnd,
    }
  }
  return {
    kind: 'truncated',
    status: 'truncated',
    total: null,
    code: 'REQUEST_BUDGET_EXHAUSTED',
    repositoryAlias: scopeAlias,
    rateLimit: { remaining: 2, reset: 1234 },
    repositoryFlags: { public: true, archived: false, disabled: false, fork: false },
    units: [{ alias: 'issue-a', kind: 'issue', updatedAt: '2026-07-03T00:00:00.000Z' }],
    pages: [{ pageNumber: 1, receiptAlias: 'page-1', unitCount: 1, unitAliases: ['issue-a'], nextPage: 2 }],
    observedUnitCount: 1,
    observedPageCount: 1,
    rangeStart,
    rangeEnd,
  }
}

describe('P4 composed incremental storage replay', () => {
  it('persists complete composition, makes exact replay write-free, and keeps equivalent jobs distinct', () => {
    const db = database()
    const first = composeGithubCoreRestComplete({ ...context('job-complete-1'), result: completeResult() })
    const firstInput = {
      jobId: 'job-complete-1', scopeAlias, consentRevision, sourceSnapshotId: first.sourceSnapshotId,
      startedAt, completedAt, transition: first.transition,
    }
    expect(persistIncrementalGithubCoreTransition(db, firstInput)).toMatchObject({ applied: true })
    const before = db.prepare('SELECT COUNT(*) AS count FROM collection_job').get() as { count: number }
    expect(persistIncrementalGithubCoreTransition(db, firstInput)).toMatchObject({ applied: false })
    expect((db.prepare('SELECT COUNT(*) AS count FROM collection_job').get() as { count: number }).count).toBe(before.count)

    const previous = readIncrementalGithubCoreCheckpoint(db, scopeAlias)
    const second = composeGithubCoreRestComplete({
      ...context('job-complete-2', previous),
      observedAt: '2026-08-04T01:00:00.000Z',
      result: completeResult(),
    })
    expect(second.snapshotHash).toBe(first.snapshotHash)
    expect(second.sourceSnapshotId).not.toBe(first.sourceSnapshotId)
    persistIncrementalGithubCoreTransition(db, {
      jobId: 'job-complete-2', scopeAlias, consentRevision, sourceSnapshotId: second.sourceSnapshotId,
      startedAt, completedAt: '2026-08-04T01:00:02.000Z', transition: second.transition,
    })
    expect(db.prepare('SELECT snapshot_id, snapshot_hash FROM source_snapshot ORDER BY job_id').all()).toEqual([
      { snapshot_id: first.sourceSnapshotId, snapshot_hash: first.snapshotHash },
      { snapshot_id: second.sourceSnapshotId, snapshot_hash: second.snapshotHash },
    ])
    expect(readIncrementalGithubCoreCheckpoint(db, scopeAlias)).toMatchObject({ committedJobId: 'job-complete-2' })
    expect(readIncrementalGithubCoreCheckpoint(db, scopeAlias)?.highWatermark).toBe(previous?.highWatermark)
  })

  it('persists every composed noncomplete outcome without snapshots or checkpoint movement', () => {
    const db = database()
    const complete = composeGithubCoreRestComplete({ ...context('job-anchor'), result: completeResult() })
    persistIncrementalGithubCoreTransition(db, {
      jobId: 'job-anchor', scopeAlias, consentRevision, sourceSnapshotId: complete.sourceSnapshotId,
      startedAt, completedAt, transition: complete.transition,
    })
    const previous = readIncrementalGithubCoreCheckpoint(db, scopeAlias)
    const kinds = ['restricted', 'failed', 'metadata', 'partial'] as const
    for (const [index, kind] of kinds.entries()) {
      const jobId = `job-noncomplete-${index + 1}`
      const composed = composeGithubCoreRestNoncomplete({
        ...context(jobId, previous),
        attempt: 1,
        result: noncompleteResult(kind),
      })
      expect(composed.transition.checkpoint).toEqual(previous)
      expect(completeObservedUnits(composed.transition.coverage)).toBeNull()
      if (kind === 'partial') expect(composed.transition.cursorHint).toBe('2')
      expect(persistIncrementalGithubCoreTransition(db, {
        jobId, scopeAlias, consentRevision, startedAt, completedAt, transition: composed.transition,
      })).toMatchObject({ applied: true })
      expect(persistIncrementalGithubCoreTransition(db, {
        jobId, scopeAlias, consentRevision, startedAt, completedAt, transition: composed.transition,
      })).toMatchObject({ applied: false })
      expect(readIncrementalGithubCoreCheckpoint(db, scopeAlias)).toEqual(previous)
    }
    expect(db.prepare('SELECT status, snapshot_id FROM coverage_ledger ORDER BY job_id').all()).toEqual([
      { status: 'complete', snapshot_id: complete.sourceSnapshotId },
      { status: 'restricted', snapshot_id: null },
      { status: 'failed', snapshot_id: null },
      { status: 'truncated', snapshot_id: null },
      { status: 'truncated', snapshot_id: null },
    ])
    expect(db.prepare('SELECT COUNT(*) AS count FROM source_snapshot').get()).toEqual({ count: 1 })
    expect(db.prepare('SELECT COUNT(*) AS count FROM collection_checkpoint').get()).toEqual({ count: 1 })
  })
})
