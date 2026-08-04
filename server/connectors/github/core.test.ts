import { describe, expect, it } from 'vitest'
import {
  GITHUB_CORE_MAX_ATTEMPTS,
  GITHUB_CORE_QUERY_VERSION,
  GITHUB_CORE_REST_API_VERSION,
  boundedGithubCoreOverlapStart,
  classifyGithubCoreRetry,
  githubCoreManifest,
  planGithubCoreCollection,
  reconcileGithubCoreReceipts,
  type GithubCoreCheckpoint,
} from './core.js'

const rangeStart = '2026-01-01T00:00:00.000Z'
const rangeEnd = '2026-01-02T00:00:00.000Z'
const observedAt = '2026-01-03T00:00:00.000Z'

function checkpoint(overrides: Partial<GithubCoreCheckpoint> = {}): GithubCoreCheckpoint {
  return {
    capabilityId: 'github.core',
    scopeAlias: 'scope-01',
    queryVersion: GITHUB_CORE_QUERY_VERSION,
    sourceApiVersion: GITHUB_CORE_REST_API_VERSION,
    highWatermark: '2026-01-01T12:00:00.000Z',
    boundedOverlapStart: rangeStart,
    consentRevision: 'consent-01',
    committedJobId: 'job-01',
    ...overrides,
  }
}

function input(overrides: Parameters<typeof reconcileGithubCoreReceipts>[0] = {
  checkpoint: checkpoint(),
  scopeAlias: 'scope-01',
  rangeStart,
  rangeEnd,
  observedAt,
  jobId: 'job-02',
  consentRevision: 'consent-01',
  pageCap: 3,
  receipts: [],
}) {
  return overrides
}

describe('github.core inert protocol foundation', () => {
  it('pins protocol versions and exposes the still-denied capability manifest and plan coverage', () => {
    const manifest = githubCoreManifest()
    const plan = planGithubCoreCollection(input())

    expect(manifest.restApiVersion).toBe('2026-03-10')
    expect(manifest.queryVersion).toBe('github.core.v1')
    expect(manifest.capability.authorization).toBe('never_authorized')
    expect(plan).toMatchObject({
      state: 'denied',
      reasonCode: 'NEVER_AUTHORIZED',
      coverage: { status: 'never_authorized', retryable: false, observedUnits: 0 },
    })
  })

  it('uses a bounded 24-hour overlap without extending before the requested range', () => {
    expect(boundedGithubCoreOverlapStart(rangeStart, checkpoint())).toBe('2026-01-01T00:00:00.000Z')
    expect(boundedGithubCoreOverlapStart('2026-01-01T11:00:00.000Z', checkpoint())).toBe('2026-01-01T11:00:00.000Z')
    expect(boundedGithubCoreOverlapStart(rangeStart, checkpoint({ highWatermark: '2026-01-03T12:00:00.000Z' }))).toBe('2026-01-02T12:00:00.000Z')
  })

  it('classifies retries deterministically and never schedules a fourth attempt', () => {
    expect(classifyGithubCoreRetry('transient', 2)).toMatchObject({ retryable: true, retry: true, maximumAttempts: GITHUB_CORE_MAX_ATTEMPTS })
    expect(classifyGithubCoreRetry('rate_limited', 3)).toMatchObject({ retryable: true, retry: false })
    expect(classifyGithubCoreRetry('permission', 1)).toMatchObject({ retryable: false, retry: false })
  })

  it('deduplicates identical receipts and advances a checkpoint only after complete coverage', () => {
    const result = reconcileGithubCoreReceipts(input({
      ...input(),
      receipts: [
        { receiptId: 'receipt-01', pageNumber: 1, unitIds: ['unit-01', 'unit-02'], highWatermark: '2026-01-01T13:00:00.000Z' },
        { receiptId: 'receipt-01', pageNumber: 1, unitIds: ['unit-01', 'unit-02'], highWatermark: '2026-01-01T13:00:00.000Z' },
      ],
      snapshotHash: 'snapshot-01',
    }))

    expect(result).toMatchObject({
      status: 'complete',
      appliedReceiptIds: ['receipt-01'],
      coverage: { status: 'complete', expectedUnits: 2, observedUnits: 2, omittedUnits: 0 },
      checkpoint: { highWatermark: '2026-01-01T13:00:00.000Z', lastCompleteSnapshotHash: 'snapshot-01', committedJobId: 'job-02' },
    })
  })

  it('marks page-cap saturation as truncated and preserves the previous complete checkpoint', () => {
    const previous = checkpoint()
    const result = reconcileGithubCoreReceipts(input({
      ...input(),
      checkpoint: previous,
      pageCap: 1,
      receipts: [
        { receiptId: 'receipt-01', pageNumber: 1, unitIds: ['unit-01'] },
        { receiptId: 'receipt-02', pageNumber: 2, unitIds: ['unit-02'], highWatermark: '2026-01-01T20:00:00.000Z' },
      ],
    }))

    expect(result.coverage).toMatchObject({ status: 'truncated', saturationReason: 'PAGE_CAP', observedUnits: 1, omittedUnits: 1 })
    expect(result.checkpoint).toBe(previous)
    expect(result.appliedReceiptIds).toEqual(['receipt-01'])
  })

  it('keeps the checkpoint untouched when a failure is reported', () => {
    const previous = checkpoint()
    const result = reconcileGithubCoreReceipts(input({ ...input(), checkpoint: previous, failure: { kind: 'transient', attempt: 1 } }))

    expect(result).toMatchObject({ status: 'failed', coverage: { status: 'failed', retryable: true, limitationCode: 'FAILURE_TRANSIENT' } })
    expect(result.checkpoint).toBe(previous)
  })
})
