import { describe, expect, it } from 'vitest'
import {
  GITHUB_CORE_MAX_ATTEMPTS,
  GITHUB_CORE_MAX_COMPUTED_BACKOFF_MS,
  GITHUB_CORE_QUERY_VERSION,
  GITHUB_CORE_REST_API_VERSION,
  boundedGithubCoreOverlapStart,
  classifyGithubCoreRetry,
  githubCoreManifest,
  planGithubCoreCollection,
  reconcileGithubCoreReceipts,
  reconcileGithubCoreNonComplete,
  type GithubCoreCheckpoint,
  type GithubCoreReceipt,
  type GithubCoreNonCompleteReconciliationInput,
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

type ReconciliationInput = Parameters<typeof reconcileGithubCoreReceipts>[0]
type NonCompleteInput = GithubCoreNonCompleteReconciliationInput

function input(overrides: Partial<ReconciliationInput> = {}): ReconciliationInput {
  return {
    checkpoint: checkpoint(),
    scopeAlias: 'scope-01',
    rangeStart,
    rangeEnd,
    observedAt,
    jobId: 'job-02',
    consentRevision: 'consent-01',
    pageCap: 3,
    receipts: [{ receiptId: 'receipt-01', pageNumber: 1, unitIds: [], nextCursor: null }],
    ...overrides,
  }
}

function unsafeCheckpoint(overrides: Record<string, unknown>): GithubCoreCheckpoint {
  return { ...checkpoint(), ...overrides } as unknown as GithubCoreCheckpoint
}

function nonCompleteInput(overrides: Partial<NonCompleteInput> = {}): NonCompleteInput {
  return {
    checkpoint: checkpoint(),
    scopeAlias: 'scope-01',
    rangeStart,
    rangeEnd,
    observedAt,
    jobId: 'job-02',
    consentRevision: 'consent-01',
    status: 'truncated',
    expectedUnits: null,
    observedUnits: 2,
    omittedUnits: null,
    appliedReceiptAliases: ['receipt-01'],
    limitationCode: 'RATE_LIMITED',
    saturationReason: 'RATE_LIMIT',
    ...overrides,
  }
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

  it('bounds overlap inside a canonical half-open collection window', () => {
    expect(boundedGithubCoreOverlapStart(rangeStart, rangeEnd, checkpoint())).toBe(rangeStart)
    expect(boundedGithubCoreOverlapStart(
      '2026-01-01T11:00:00.000Z',
      rangeEnd,
      checkpoint(),
    )).toBe('2026-01-01T11:00:00.000Z')
    expect(() => boundedGithubCoreOverlapStart(
      rangeStart,
      rangeEnd,
      checkpoint({ highWatermark: '2026-01-02T12:00:00.000Z' }),
    )).toThrow('half-open collection range')
    expect(() => boundedGithubCoreOverlapStart(rangeEnd, rangeStart, checkpoint())).toThrow(
      'rangeStart must be earlier',
    )
    expect(() => boundedGithubCoreOverlapStart(
      '2026-01-01T00:00:00Z',
      rangeEnd,
      checkpoint(),
    )).toThrow('canonical UTC timestamp')
  })

  it('honors bounded Retry-After and otherwise uses deterministic backoff with jitter', () => {
    const first = classifyGithubCoreRetry('transient', 1)
    const repeated = classifyGithubCoreRetry('transient', 1)
    const second = classifyGithubCoreRetry('transient', 2)

    expect(first.delayMs).toBe(repeated.delayMs)
    expect(first.delayMs).toBeGreaterThanOrEqual(1_000)
    expect(first.delayMs).toBeLessThanOrEqual(GITHUB_CORE_MAX_COMPUTED_BACKOFF_MS)
    expect(second.delayMs).toBeGreaterThan(first.delayMs!)
    expect(classifyGithubCoreRetry('rate_limited', 1, 90_000)).toMatchObject({
      retry: true,
      delayMs: 90_000,
    })
    expect(classifyGithubCoreRetry('rate_limited', 1, 0).delayMs).toBe(0)
  })

  it('caps retry scheduling at three attempts and never retries terminal failures', () => {
    expect(classifyGithubCoreRetry('rate_limited', 3)).toMatchObject({
      retryable: true,
      retry: false,
      delayMs: null,
      maximumAttempts: GITHUB_CORE_MAX_ATTEMPTS,
    })
    for (const kind of ['permission', 'unsupported', 'schema'] as const) {
      expect(classifyGithubCoreRetry(kind, 1, 50)).toMatchObject({ retryable: false, retry: false, delayMs: null })
    }
    expect(() => classifyGithubCoreRetry('transient', 4)).toThrow('between 1 and 3')
    for (const unsafeDelay of [-1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => classifyGithubCoreRetry('transient', 1, unsafeDelay)).toThrow('nonnegative safe integer')
    }
  })

  it('rejects unrecognized runtime failure kinds before constructing coverage codes', () => {
    const invalidKind = 'transient_with_untrusted_suffix' as 'transient'

    expect(() => classifyGithubCoreRetry(invalidKind, 1)).toThrow('failure kind is unsupported')
    expect(() => reconcileGithubCoreReceipts(input({
      failure: { kind: invalidKind, attempt: 1 },
    }))).toThrow('failure kind is unsupported')
  })

  it('does not fabricate complete zero activity without a terminal page receipt', () => {
    const previous = checkpoint()
    const missing = reconcileGithubCoreReceipts(input({ checkpoint: previous, receipts: [] }))
    const terminalEmpty = reconcileGithubCoreReceipts(input({
      checkpoint: previous,
      receipts: [{ receiptId: 'receipt-01', pageNumber: 1, unitIds: [], nextCursor: null }],
    }))

    expect(missing).toMatchObject({
      status: 'failed',
      coverage: { status: 'failed', limitationCode: 'TERMINAL_PAGE_MISSING', expectedUnits: null },
    })
    expect(missing.checkpoint).toBe(previous)
    expect(terminalEmpty).toMatchObject({
      status: 'complete',
      coverage: { status: 'complete', expectedUnits: 0, observedUnits: 0, omittedUnits: 0 },
      checkpoint: { committedJobId: 'job-02' },
    })
  })

  it('cannot complete when pagination is unfinished below the page cap', () => {
    const previous = checkpoint()
    const result = reconcileGithubCoreReceipts(input({
      checkpoint: previous,
      pageCap: 3,
      receipts: [{ receiptId: 'receipt-01', pageNumber: 1, unitIds: ['unit-01'], nextCursor: 'cursor-02' }],
    }))

    expect(result).toMatchObject({
      status: 'failed',
      coverage: { status: 'failed', limitationCode: 'TERMINAL_PAGE_MISSING', observedUnits: 1 },
    })
    expect(result.checkpoint).toBe(previous)
  })

  it('reports exact-cap continuation as unknown-total truncation with a non-durable cursor hint', () => {
    const previous = checkpoint()
    const result = reconcileGithubCoreReceipts(input({
      checkpoint: previous,
      pageCap: 1,
      receipts: [{ receiptId: 'receipt-01', pageNumber: 1, unitIds: ['unit-01'], nextCursor: 'cursor-02' }],
    }))

    expect(result).toMatchObject({
      status: 'truncated',
      cursorHint: 'cursor-02',
      coverage: {
        status: 'truncated',
        saturationReason: 'PAGE_CAP',
        expectedUnits: null,
        observedUnits: 1,
        omittedUnits: null,
      },
    })
    expect(result.checkpoint).toBe(previous)
    expect(result.checkpoint?.cursorHint).toBeUndefined()
  })

  it('deduplicates semantically identical receipts regardless of property or unit insertion order', () => {
    const first: GithubCoreReceipt = {
      receiptId: 'receipt-01',
      pageNumber: 1,
      unitIds: ['unit-01', 'unit-02'],
      highWatermark: '2026-01-01T18:00:00.000Z',
      nextCursor: 'cursor-02',
    }
    const sameDifferentOrder: GithubCoreReceipt = {
      nextCursor: 'cursor-02',
      highWatermark: '2026-01-01T18:00:00.000Z',
      unitIds: ['unit-02', 'unit-01'],
      pageNumber: 1,
      receiptId: 'receipt-01',
    }
    const result = reconcileGithubCoreReceipts(input({
      receipts: [
        first,
        sameDifferentOrder,
        {
          receiptId: 'receipt-02',
          pageNumber: 2,
          unitIds: ['unit-03'],
          highWatermark: '2026-01-01T13:00:00.000Z',
          nextCursor: null,
        },
      ],
    }))

    expect(result).toMatchObject({
      status: 'complete',
      appliedReceiptIds: ['receipt-01', 'receipt-02'],
      coverage: { expectedUnits: 3, observedUnits: 3 },
      checkpoint: { highWatermark: '2026-01-01T18:00:00.000Z' },
    })
  })

  it('fails conflicting receipt IDs without advancing the checkpoint', () => {
    const previous = checkpoint()
    const result = reconcileGithubCoreReceipts(input({
      checkpoint: previous,
      receipts: [
        { receiptId: 'receipt-01', pageNumber: 1, unitIds: ['unit-01'], nextCursor: null },
        { nextCursor: null, unitIds: ['unit-02'], pageNumber: 1, receiptId: 'receipt-01' },
      ],
    }))

    expect(result).toMatchObject({
      status: 'failed',
      coverage: { limitationCode: 'RECEIPT_VALIDATION_FAILED', retryable: false },
    })
    expect(result.checkpoint).toBe(previous)
  })

  it('validates checkpoint identity, scope, consent, versions, and timestamps at runtime', () => {
    expect(() => reconcileGithubCoreReceipts(input({
      checkpoint: unsafeCheckpoint({ capabilityId: 'cap.local.git' }),
    }))).toThrow('CHECKPOINT_CAPABILITY_MISMATCH')
    expect(() => reconcileGithubCoreReceipts(input({
      checkpoint: unsafeCheckpoint({ queryVersion: 'github.core.v0' }),
    }))).toThrow('CHECKPOINT_VERSION_MISMATCH')
    expect(() => reconcileGithubCoreReceipts(input({
      checkpoint: unsafeCheckpoint({ sourceApiVersion: '2022-11-28' }),
    }))).toThrow('CHECKPOINT_VERSION_MISMATCH')
    expect(() => reconcileGithubCoreReceipts(input({
      checkpoint: checkpoint({ scopeAlias: 'scope-02' }),
    }))).toThrow('CHECKPOINT_SCOPE_MISMATCH')
    expect(() => reconcileGithubCoreReceipts(input({
      checkpoint: checkpoint({ consentRevision: 'consent-02' }),
    }))).toThrow('CHECKPOINT_CONSENT_MISMATCH')
    expect(() => reconcileGithubCoreReceipts(input({
      checkpoint: checkpoint({ highWatermark: '2026-01-01T12:00:00Z' }),
    }))).toThrow('canonical UTC timestamp')
    expect(() => reconcileGithubCoreReceipts(input({
      checkpoint: checkpoint({ boundedOverlapStart: '2026-01-01T13:00:00.000Z' }),
    }))).toThrow('CHECKPOINT_WINDOW_INVERTED')
    expect(() => reconcileGithubCoreReceipts(input({
      checkpoint: checkpoint({ highWatermark: rangeEnd }),
    }))).toThrow('half-open collection range')
    expect(() => reconcileGithubCoreReceipts(input({
      checkpoint: checkpoint({ highWatermark: '' }),
    }))).toThrow('canonical UTC timestamp')
    expect(() => reconcileGithubCoreReceipts(input({
      checkpoint: checkpoint({ cursorHint: '' }),
    }))).toThrow('opaque identifier')
    expect(() => reconcileGithubCoreReceipts(input({
      checkpoint: checkpoint({ lastCompleteSnapshotHash: '' }),
    }))).toThrow('canonical lowercase SHA-256')
  })

  it('rejects out-of-range receipt watermarks as failed coverage', () => {
    const previous = checkpoint()
    const result = reconcileGithubCoreReceipts(input({
      checkpoint: previous,
      receipts: [{
        receiptId: 'receipt-01',
        pageNumber: 1,
        unitIds: [],
        highWatermark: rangeEnd,
        nextCursor: null,
      }],
    }))

    expect(result).toMatchObject({ status: 'failed', coverage: { limitationCode: 'RECEIPT_VALIDATION_FAILED' } })
    expect(result.checkpoint).toBe(previous)
  })

  it('validates provided receipt watermarks and snapshot hashes even when empty', () => {
    const invalidReceipt = reconcileGithubCoreReceipts(input({
      receipts: [{ receiptId: 'receipt-01', pageNumber: 1, unitIds: [], highWatermark: '', nextCursor: null }],
    }))

    expect(invalidReceipt).toMatchObject({
      status: 'failed',
      coverage: { limitationCode: 'RECEIPT_VALIDATION_FAILED' },
    })
    for (const invalidHash of ['', 'A'.repeat(64), 'a'.repeat(63)]) {
      expect(() => reconcileGithubCoreReceipts(input({ snapshotHash: invalidHash }))).toThrow(
        'canonical lowercase SHA-256',
      )
    }

    const snapshotHash = 'a'.repeat(64)
    expect(reconcileGithubCoreReceipts(input({ snapshotHash }))).toMatchObject({
      status: 'complete',
      checkpoint: { lastCompleteSnapshotHash: snapshotHash },
    })
  })

  it('rejects opaque identifiers longer than the conservative contract bound', () => {
    expect(() => reconcileGithubCoreReceipts(input({ scopeAlias: 'a'.repeat(129) }))).toThrow(
      'at most 128 characters',
    )
    expect(reconcileGithubCoreReceipts(input({
      receipts: [{ receiptId: 'r'.repeat(129), pageNumber: 1, unitIds: [], nextCursor: null }],
    }))).toMatchObject({ status: 'failed', coverage: { limitationCode: 'RECEIPT_VALIDATION_FAILED' } })
  })

  it('keeps the checkpoint untouched when collection fails', () => {
    const previous = checkpoint()
    const result = reconcileGithubCoreReceipts(input({
      checkpoint: previous,
      failure: { kind: 'transient', attempt: 1, retryAfterMs: 5_000 },
    }))

    expect(result).toMatchObject({
      status: 'failed',
      coverage: { status: 'failed', retryable: true, limitationCode: 'FAILURE_TRANSIENT' },
    })
    expect(result.checkpoint).toBe(previous)
  })

  it('reconciles restricted, failed, and truncated facts without receipts or snapshots', () => {
    for (const status of ['restricted', 'failed', 'truncated'] as const) {
      const previous = checkpoint()
      const result = reconcileGithubCoreNonComplete(nonCompleteInput({
        checkpoint: previous,
        status,
        limitationCode: status === 'restricted' ? 'NOT_FOUND' : status === 'failed' ? 'SCHEMA_INVALID' : 'RATE_LIMITED',
        ...(status === 'truncated' ? { saturationReason: 'RATE_LIMIT' } : { saturationReason: undefined }),
      }))
      expect(result.status).toBe(status)
      expect(result.coverage.status).toBe(status)
      expect(result.checkpoint).toEqual(previous)
      expect(result.checkpoint).not.toBe(previous)
      expect(result).not.toHaveProperty('snapshotHash')
      expect(result).not.toHaveProperty('sourceSnapshotId')
    }
  })

  it('classifies retry attempts and keeps rate limits truncated', () => {
    const first = reconcileGithubCoreNonComplete(nonCompleteInput({
      status: 'failed',
      limitationCode: 'FAILURE_TRANSIENT',
      failure: { kind: 'transient', attempt: 1, retryAfterMs: 50 },
      saturationReason: undefined,
    }))
    expect(first.status).toBe('failed')
    expect(first.coverage.retryable).toBe(true)
    const final = reconcileGithubCoreNonComplete(nonCompleteInput({
      status: 'failed',
      limitationCode: 'FAILURE_TRANSIENT',
      failure: { kind: 'transient', attempt: 3 },
      saturationReason: undefined,
    }))
    expect(final.coverage.retryable).toBe(false)
    const limited = reconcileGithubCoreNonComplete(nonCompleteInput({
      status: 'failed',
      limitationCode: 'RATE_LIMITED',
      saturationReason: 'RATE_LIMIT',
      failure: { kind: 'rate_limited', attempt: 1 },
    }))
    expect(limited.status).toBe('truncated')
    expect(limited.coverage.status).toBe('truncated')
  })

  it('rejects malformed noncomplete facts and snapshots caller state', () => {
    expect(() => reconcileGithubCoreNonComplete(nonCompleteInput({ observedUnits: -1 }))).toThrow('observedUnits')
    expect(() => reconcileGithubCoreNonComplete(nonCompleteInput({ status: 'truncated', saturationReason: undefined }))).toThrow('saturationReason')
    expect(() => reconcileGithubCoreNonComplete(nonCompleteInput({ appliedReceiptAliases: ['receipt-01', 'receipt-01'] }))).toThrow('unique')
    expect(() => reconcileGithubCoreNonComplete(nonCompleteInput({ cursorHint: 'cursor-1', status: 'failed', saturationReason: undefined }))).toThrow('cursorHint')
    const aliases = ['receipt-01']
    const previous = checkpoint()
    const result = reconcileGithubCoreNonComplete(nonCompleteInput({ appliedReceiptAliases: aliases, checkpoint: previous }))
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.appliedReceiptIds)).toBe(true)
    expect(Object.isFrozen(result.checkpoint)).toBe(true)
    aliases.push('receipt-02')
    ;(previous as { highWatermark?: string }).highWatermark = '2026-01-01T13:00:00.000Z'
    expect(result.appliedReceiptIds).toEqual(['receipt-01'])
    expect(result.checkpoint?.highWatermark).toBe('2026-01-01T12:00:00.000Z')
    expect(Object.isFrozen(previous)).toBe(false)
  })
})
