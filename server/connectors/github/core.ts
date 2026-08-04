import { getCapabilityDefinition } from '../../../shared/capabilities.js'
import { CoverageRecordSchema, type CoverageRecord } from '../../../shared/coverage.js'

export const GITHUB_CORE_REST_API_VERSION = '2026-03-10' as const
export const GITHUB_CORE_QUERY_VERSION = 'github.core.v1' as const
export const GITHUB_CORE_MAX_ATTEMPTS = 3 as const
export const GITHUB_CORE_OVERLAP_MS = 86_400_000 as const

const OPAQUE_ID = /^[A-Za-z0-9:._-]+$/

export interface GithubCoreCheckpoint {
  readonly capabilityId: 'github.core'
  readonly scopeAlias: string
  readonly queryVersion: typeof GITHUB_CORE_QUERY_VERSION
  readonly sourceApiVersion: typeof GITHUB_CORE_REST_API_VERSION
  readonly highWatermark?: string
  readonly cursorHint?: string
  readonly boundedOverlapStart: string
  readonly lastCompleteSnapshotHash?: string
  readonly consentRevision: string
  readonly committedJobId: string
}

export interface GithubCoreManifest {
  readonly capability: ReturnType<typeof getCapabilityDefinition>
  readonly restApiVersion: typeof GITHUB_CORE_REST_API_VERSION
  readonly queryVersion: typeof GITHUB_CORE_QUERY_VERSION
  readonly maxAttempts: typeof GITHUB_CORE_MAX_ATTEMPTS
  readonly overlapMs: typeof GITHUB_CORE_OVERLAP_MS
  readonly execution: 'inert'
}

export interface GithubCorePlan {
  readonly state: 'denied'
  readonly reasonCode: 'NEVER_AUTHORIZED'
  readonly manifest: GithubCoreManifest
  readonly coverage: CoverageRecord
  readonly checkpoint: GithubCoreCheckpoint | null
  readonly boundedOverlapStart: string
}

export interface GithubCoreReceipt {
  readonly receiptId: string
  readonly pageNumber: number
  readonly unitIds: readonly string[]
  readonly highWatermark?: string
}

export type GithubCoreFailureKind =
  | 'rate_limited'
  | 'transient'
  | 'permission'
  | 'unsupported'
  | 'schema'
  | 'unknown'

export interface GithubCoreRetryClassification {
  readonly kind: GithubCoreFailureKind
  readonly attempt: number
  readonly retryable: boolean
  readonly retry: boolean
  readonly maximumAttempts: typeof GITHUB_CORE_MAX_ATTEMPTS
}

export interface GithubCoreReconciliationInput {
  readonly checkpoint: GithubCoreCheckpoint | null
  readonly scopeAlias: string
  readonly rangeStart: string
  readonly rangeEnd: string
  readonly observedAt: string
  readonly jobId: string
  readonly consentRevision: string
  readonly pageCap: number
  readonly receipts: readonly GithubCoreReceipt[]
  readonly snapshotHash?: string
  readonly failure?: {
    readonly kind: GithubCoreFailureKind
    readonly attempt: number
  }
}

export interface GithubCoreCheckpointTransition {
  readonly status: 'complete' | 'truncated' | 'failed'
  readonly coverage: CoverageRecord
  readonly checkpoint: GithubCoreCheckpoint | null
  readonly appliedReceiptIds: readonly string[]
}

function assertOpaqueId(value: string, field: string): void {
  if (!OPAQUE_ID.test(value)) {
    throw new Error(`${field} must be an opaque identifier`)
  }
}

function parseTimestamp(value: string, field: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`${field} must be an ISO timestamp`)
  }
  return date
}

function assertRange(rangeStart: string, rangeEnd: string): void {
  if (parseTimestamp(rangeStart, 'rangeStart') >= parseTimestamp(rangeEnd, 'rangeEnd')) {
    throw new Error('rangeStart must be earlier than rangeEnd')
  }
}

function assertCompatibleCheckpoint(checkpoint: GithubCoreCheckpoint): void {
  assertOpaqueId(checkpoint.scopeAlias, 'checkpoint.scopeAlias')
  assertOpaqueId(checkpoint.consentRevision, 'checkpoint.consentRevision')
  assertOpaqueId(checkpoint.committedJobId, 'checkpoint.committedJobId')
  if (checkpoint.queryVersion !== GITHUB_CORE_QUERY_VERSION || checkpoint.sourceApiVersion !== GITHUB_CORE_REST_API_VERSION) {
    throw new Error('CHECKPOINT_VERSION_MISMATCH')
  }
  parseTimestamp(checkpoint.boundedOverlapStart, 'checkpoint.boundedOverlapStart')
  if (checkpoint.highWatermark) parseTimestamp(checkpoint.highWatermark, 'checkpoint.highWatermark')
}

function coverage(
  input: Pick<GithubCoreReconciliationInput, 'scopeAlias' | 'rangeStart' | 'rangeEnd' | 'observedAt'>,
  status: CoverageRecord['status'],
  expectedUnits: number | null,
  observedUnits: number,
  omittedUnits: number | null,
  limitationCode: string,
  retryable: boolean,
  saturationReason?: string,
): CoverageRecord {
  assertOpaqueId(input.scopeAlias, 'scopeAlias')
  assertRange(input.rangeStart, input.rangeEnd)
  parseTimestamp(input.observedAt, 'observedAt')
  return CoverageRecordSchema.parse({
    coverageId: `github.core:${input.scopeAlias}:${input.rangeEnd}`,
    capabilityId: 'github.core',
    scopeAlias: input.scopeAlias,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    status,
    expectedUnits,
    observedUnits,
    omittedUnits,
    ...(saturationReason ? { saturationReason } : {}),
    retryable,
    observedAt: input.observedAt,
    limitationCode,
  })
}

/** This describes the pinned protocol; it deliberately does not create a client or a transport. */
export function githubCoreManifest(): GithubCoreManifest {
  return {
    capability: getCapabilityDefinition('github.core'),
    restApiVersion: GITHUB_CORE_REST_API_VERSION,
    queryVersion: GITHUB_CORE_QUERY_VERSION,
    maxAttempts: GITHUB_CORE_MAX_ATTEMPTS,
    overlapMs: GITHUB_CORE_OVERLAP_MS,
    execution: 'inert',
  }
}

export function boundedGithubCoreOverlapStart(rangeStart: string, checkpoint: GithubCoreCheckpoint | null): string {
  const floor = parseTimestamp(rangeStart, 'rangeStart')
  if (!checkpoint?.highWatermark) return floor.toISOString()
  assertCompatibleCheckpoint(checkpoint)
  const overlap = new Date(parseTimestamp(checkpoint.highWatermark, 'checkpoint.highWatermark').valueOf() - GITHUB_CORE_OVERLAP_MS)
  return new Date(Math.max(floor.valueOf(), overlap.valueOf())).toISOString()
}

/** Planning is fail-closed until an activation path explicitly changes the capability contract. */
export function planGithubCoreCollection(input: Omit<GithubCoreReconciliationInput, 'pageCap' | 'receipts' | 'jobId' | 'consentRevision'>): GithubCorePlan {
  assertRange(input.rangeStart, input.rangeEnd)
  if (input.checkpoint) assertCompatibleCheckpoint(input.checkpoint)
  return {
    state: 'denied',
    reasonCode: 'NEVER_AUTHORIZED',
    manifest: githubCoreManifest(),
    coverage: coverage(input, 'never_authorized', null, 0, null, 'NEVER_AUTHORIZED', false),
    checkpoint: input.checkpoint,
    boundedOverlapStart: boundedGithubCoreOverlapStart(input.rangeStart, input.checkpoint),
  }
}

/** Retry choice is pure and capped; scheduling/backoff and transport remain outside this module. */
export function classifyGithubCoreRetry(kind: GithubCoreFailureKind, attempt: number): GithubCoreRetryClassification {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error('attempt must be a positive integer')
  const retryable = kind === 'rate_limited' || kind === 'transient'
  return {
    kind,
    attempt,
    retryable,
    retry: retryable && attempt < GITHUB_CORE_MAX_ATTEMPTS,
    maximumAttempts: GITHUB_CORE_MAX_ATTEMPTS,
  }
}

function normalizedReceipts(receipts: readonly GithubCoreReceipt[]): GithubCoreReceipt[] {
  const accepted = new Map<string, GithubCoreReceipt>()
  for (const receipt of receipts) {
    assertOpaqueId(receipt.receiptId, 'receipt.receiptId')
    if (!Number.isInteger(receipt.pageNumber) || receipt.pageNumber < 1) throw new Error('receipt.pageNumber must be positive')
    if (new Set(receipt.unitIds).size !== receipt.unitIds.length) throw new Error('receipt.unitIds must be unique within a page')
    for (const unitId of receipt.unitIds) assertOpaqueId(unitId, 'receipt.unitId')
    if (receipt.highWatermark) parseTimestamp(receipt.highWatermark, 'receipt.highWatermark')
    const existing = accepted.get(receipt.receiptId)
    if (existing && JSON.stringify(existing) !== JSON.stringify(receipt)) throw new Error('RECEIPT_ID_COLLISION')
    if (!existing) accepted.set(receipt.receiptId, receipt)
  }
  return [...accepted.values()].sort((left, right) => left.pageNumber - right.pageNumber || left.receiptId.localeCompare(right.receiptId))
}

function distinctUnits(receipts: readonly GithubCoreReceipt[]): number {
  return new Set(receipts.flatMap((receipt) => receipt.unitIds)).size
}

function latestWatermark(receipts: readonly GithubCoreReceipt[], previous?: string): string | undefined {
  return [...receipts.map((receipt) => receipt.highWatermark).filter((value): value is string => Boolean(value)), previous]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
}

/**
 * Pure synthetic reconciliation model. It accepts caller-supplied opaque receipts only; it does
 * not read a provider, persist anything, or bypass the denied collection plan.
 */
export function reconcileGithubCoreReceipts(input: GithubCoreReconciliationInput): GithubCoreCheckpointTransition {
  assertOpaqueId(input.jobId, 'jobId')
  assertOpaqueId(input.consentRevision, 'consentRevision')
  if (!Number.isInteger(input.pageCap) || input.pageCap < 1) throw new Error('pageCap must be a positive integer')
  if (input.checkpoint) assertCompatibleCheckpoint(input.checkpoint)

  if (input.failure) {
    const retry = classifyGithubCoreRetry(input.failure.kind, input.failure.attempt)
    return {
      status: 'failed',
      coverage: coverage(input, 'failed', null, 0, null, `FAILURE_${input.failure.kind.toUpperCase()}`, retry.retry),
      checkpoint: input.checkpoint,
      appliedReceiptIds: [],
    }
  }

  let receipts: GithubCoreReceipt[]
  try {
    receipts = normalizedReceipts(input.receipts)
  } catch {
    return {
      status: 'failed',
      coverage: coverage(input, 'failed', null, 0, null, 'RECEIPT_VALIDATION_FAILED', false),
      checkpoint: input.checkpoint,
      appliedReceiptIds: [],
    }
  }

  const processed = receipts.slice(0, input.pageCap)
  const expectedUnits = distinctUnits(receipts)
  const observedUnits = distinctUnits(processed)
  const truncated = receipts.length > input.pageCap
  if (truncated) {
    return {
      status: 'truncated',
      coverage: coverage(input, 'truncated', expectedUnits, observedUnits, expectedUnits - observedUnits, 'PAGE_CAP_REACHED', true, 'PAGE_CAP'),
      checkpoint: input.checkpoint,
      appliedReceiptIds: processed.map((receipt) => receipt.receiptId),
    }
  }

  const highWatermark = latestWatermark(processed, input.checkpoint?.highWatermark)
  const nextCheckpoint: GithubCoreCheckpoint = {
    capabilityId: 'github.core',
    scopeAlias: input.scopeAlias,
    queryVersion: GITHUB_CORE_QUERY_VERSION,
    sourceApiVersion: GITHUB_CORE_REST_API_VERSION,
    ...(highWatermark ? { highWatermark } : {}),
    boundedOverlapStart: boundedGithubCoreOverlapStart(input.rangeStart, highWatermark
      ? { ...input.checkpoint, highWatermark, capabilityId: 'github.core', scopeAlias: input.scopeAlias, queryVersion: GITHUB_CORE_QUERY_VERSION, sourceApiVersion: GITHUB_CORE_REST_API_VERSION, consentRevision: input.consentRevision, committedJobId: input.jobId, boundedOverlapStart: input.rangeStart }
      : input.checkpoint),
    ...(input.snapshotHash ? { lastCompleteSnapshotHash: input.snapshotHash } : {}),
    consentRevision: input.consentRevision,
    committedJobId: input.jobId,
  }
  return {
    status: 'complete',
    coverage: coverage(input, 'complete', expectedUnits, observedUnits, 0, 'COMPLETE', false),
    checkpoint: nextCheckpoint,
    appliedReceiptIds: processed.map((receipt) => receipt.receiptId),
  }
}
