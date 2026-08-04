import { getCapabilityDefinition } from '../../../shared/capabilities.js'
import { CoverageRecordSchema, type CoverageRecord } from '../../../shared/coverage.js'

export const GITHUB_CORE_REST_API_VERSION = '2026-03-10' as const
export const GITHUB_CORE_QUERY_VERSION = 'github.core.v1' as const
export const GITHUB_CORE_MAX_ATTEMPTS = 3 as const
export const GITHUB_CORE_OVERLAP_MS = 86_400_000 as const
export const GITHUB_CORE_RETRY_BASE_DELAY_MS = 1_000 as const
export const GITHUB_CORE_MAX_COMPUTED_BACKOFF_MS = 60_000 as const
export const GITHUB_CORE_MAX_OPAQUE_ID_LENGTH = 128 as const

const OPAQUE_ID = /^[A-Za-z0-9:._-]+$/
const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const LOWERCASE_SHA_256 = /^[0-9a-f]{64}$/

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
  readonly nextCursor: string | null
}

export const GITHUB_CORE_FAILURE_KINDS = [
  'rate_limited',
  'transient',
  'permission',
  'unsupported',
  'schema',
  'unknown',
] as const
export type GithubCoreFailureKind = typeof GITHUB_CORE_FAILURE_KINDS[number]

export interface GithubCoreRetryClassification {
  readonly kind: GithubCoreFailureKind
  readonly attempt: number
  readonly retryable: boolean
  readonly retry: boolean
  readonly delayMs: number | null
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
    readonly retryAfterMs?: number
  }
}

export interface GithubCoreCheckpointTransition {
  readonly status: 'complete' | 'truncated' | 'failed'
  readonly coverage: CoverageRecord
  readonly checkpoint: GithubCoreCheckpoint | null
  readonly appliedReceiptIds: readonly string[]
  readonly cursorHint?: string
}

function assertOpaqueId(value: string, field: string): void {
  if (
    typeof value !== 'string' ||
    value.length > GITHUB_CORE_MAX_OPAQUE_ID_LENGTH ||
    !OPAQUE_ID.test(value)
  ) {
    throw new Error(`${field} must be an opaque identifier of at most ${GITHUB_CORE_MAX_OPAQUE_ID_LENGTH} characters`)
  }
}

function assertLowercaseSha256(value: string, field: string): void {
  if (typeof value !== 'string' || !LOWERCASE_SHA_256.test(value)) {
    throw new Error(`${field} must be a canonical lowercase SHA-256`)
  }
}

function parseFailureKind(value: unknown): GithubCoreFailureKind {
  if (typeof value !== 'string' || !(GITHUB_CORE_FAILURE_KINDS as readonly string[]).includes(value)) {
    throw new Error('failure kind is unsupported')
  }
  return value as GithubCoreFailureKind
}

function parseCanonicalTimestamp(value: string, field: string): Date {
  if (typeof value !== 'string' || !CANONICAL_UTC_TIMESTAMP.test(value)) {
    throw new Error(`${field} must be a canonical UTC timestamp`)
  }
  const date = new Date(value)
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== value) {
    throw new Error(`${field} must be a canonical UTC timestamp`)
  }
  return date
}

function assertRange(rangeStart: string, rangeEnd: string): { readonly start: Date; readonly end: Date } {
  const start = parseCanonicalTimestamp(rangeStart, 'rangeStart')
  const end = parseCanonicalTimestamp(rangeEnd, 'rangeEnd')
  if (start >= end) {
    throw new Error('rangeStart must be earlier than rangeEnd')
  }
  return { start, end }
}

function assertWatermarkInRange(watermark: string, rangeStart: string, rangeEnd: string, field: string): Date {
  const { start, end } = assertRange(rangeStart, rangeEnd)
  const parsed = parseCanonicalTimestamp(watermark, field)
  if (parsed < start || parsed >= end) throw new Error(`${field} must fall within the half-open collection range`)
  return parsed
}

function assertCompatibleCheckpoint(
  checkpoint: GithubCoreCheckpoint,
  expected?: {
    readonly scopeAlias: string
    readonly consentRevision: string
    readonly rangeStart: string
    readonly rangeEnd: string
  },
): void {
  if (checkpoint.capabilityId !== 'github.core') throw new Error('CHECKPOINT_CAPABILITY_MISMATCH')
  assertOpaqueId(checkpoint.scopeAlias, 'checkpoint.scopeAlias')
  assertOpaqueId(checkpoint.consentRevision, 'checkpoint.consentRevision')
  assertOpaqueId(checkpoint.committedJobId, 'checkpoint.committedJobId')
  if (checkpoint.queryVersion !== GITHUB_CORE_QUERY_VERSION || checkpoint.sourceApiVersion !== GITHUB_CORE_REST_API_VERSION) {
    throw new Error('CHECKPOINT_VERSION_MISMATCH')
  }
  if (Object.hasOwn(checkpoint, 'cursorHint')) {
    assertOpaqueId(checkpoint.cursorHint as string, 'checkpoint.cursorHint')
  }
  if (Object.hasOwn(checkpoint, 'lastCompleteSnapshotHash')) {
    assertLowercaseSha256(
      checkpoint.lastCompleteSnapshotHash as string,
      'checkpoint.lastCompleteSnapshotHash',
    )
  }
  const overlapStart = parseCanonicalTimestamp(checkpoint.boundedOverlapStart, 'checkpoint.boundedOverlapStart')
  const highWatermark = Object.hasOwn(checkpoint, 'highWatermark')
    ? parseCanonicalTimestamp(checkpoint.highWatermark as string, 'checkpoint.highWatermark')
    : undefined
  if (highWatermark && overlapStart > highWatermark) throw new Error('CHECKPOINT_WINDOW_INVERTED')
  if (!expected) return
  if (checkpoint.scopeAlias !== expected.scopeAlias) throw new Error('CHECKPOINT_SCOPE_MISMATCH')
  if (checkpoint.consentRevision !== expected.consentRevision) throw new Error('CHECKPOINT_CONSENT_MISMATCH')
  if (highWatermark) {
    assertWatermarkInRange(
      highWatermark.toISOString(),
      expected.rangeStart,
      expected.rangeEnd,
      'checkpoint.highWatermark',
    )
  }
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
  parseCanonicalTimestamp(input.observedAt, 'observedAt')
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

export function boundedGithubCoreOverlapStart(
  rangeStart: string,
  rangeEnd: string,
  checkpoint: GithubCoreCheckpoint | null,
): string {
  const { start: floor } = assertRange(rangeStart, rangeEnd)
  if (checkpoint) assertCompatibleCheckpoint(checkpoint)
  if (!checkpoint?.highWatermark) return floor.toISOString()
  const watermark = assertWatermarkInRange(
    checkpoint.highWatermark,
    rangeStart,
    rangeEnd,
    'checkpoint.highWatermark',
  )
  const overlap = new Date(watermark.valueOf() - GITHUB_CORE_OVERLAP_MS)
  return new Date(Math.max(floor.valueOf(), overlap.valueOf())).toISOString()
}

/** Planning is fail-closed until an activation path explicitly changes the capability contract. */
export function planGithubCoreCollection(
  input: Pick<
    GithubCoreReconciliationInput,
    'checkpoint' | 'scopeAlias' | 'rangeStart' | 'rangeEnd' | 'observedAt' | 'consentRevision'
  >,
): GithubCorePlan {
  assertRange(input.rangeStart, input.rangeEnd)
  assertOpaqueId(input.consentRevision, 'consentRevision')
  if (input.checkpoint) {
    assertCompatibleCheckpoint(input.checkpoint, input)
  }
  return {
    state: 'denied',
    reasonCode: 'NEVER_AUTHORIZED',
    manifest: githubCoreManifest(),
    coverage: coverage(input, 'never_authorized', null, 0, null, 'NEVER_AUTHORIZED', false),
    checkpoint: input.checkpoint,
    boundedOverlapStart: boundedGithubCoreOverlapStart(input.rangeStart, input.rangeEnd, input.checkpoint),
  }
}

/** Retry choice is pure and capped; scheduling/backoff and transport remain outside this module. */
export function classifyGithubCoreRetry(
  kind: GithubCoreFailureKind,
  attempt: number,
  retryAfterMs?: number,
): GithubCoreRetryClassification {
  const parsedKind = parseFailureKind(kind)
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > GITHUB_CORE_MAX_ATTEMPTS) {
    throw new Error(`attempt must be between 1 and ${GITHUB_CORE_MAX_ATTEMPTS}`)
  }
  if (retryAfterMs !== undefined && (!Number.isSafeInteger(retryAfterMs) || retryAfterMs < 0)) {
    throw new Error('retryAfterMs must be a nonnegative safe integer')
  }
  const retryable = parsedKind === 'rate_limited' || parsedKind === 'transient'
  const retry = retryable && attempt < GITHUB_CORE_MAX_ATTEMPTS
  let delayMs: number | null = null
  if (retry) {
    if (retryAfterMs !== undefined) {
      delayMs = retryAfterMs
    } else {
      const exponential = Math.min(
        GITHUB_CORE_RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)),
        GITHUB_CORE_MAX_COMPUTED_BACKOFF_MS,
      )
      let hash = 2_166_136_261
      for (const character of `${parsedKind}:${attempt}`) {
        hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
      }
      const jitterWindow = Math.max(1, Math.floor(exponential / 4))
      const jitter = (hash >>> 0) % jitterWindow
      delayMs = Math.min(exponential + jitter, GITHUB_CORE_MAX_COMPUTED_BACKOFF_MS)
    }
  }
  return {
    kind: parsedKind,
    attempt,
    retryable,
    retry,
    delayMs,
    maximumAttempts: GITHUB_CORE_MAX_ATTEMPTS,
  }
}

function receiptsAreEquivalent(left: GithubCoreReceipt, right: GithubCoreReceipt): boolean {
  const rightUnitIds = new Set(right.unitIds)
  return left.receiptId === right.receiptId &&
    left.pageNumber === right.pageNumber &&
    left.highWatermark === right.highWatermark &&
    left.nextCursor === right.nextCursor &&
    left.unitIds.length === right.unitIds.length &&
    left.unitIds.every((unitId) => rightUnitIds.has(unitId))
}

function normalizedReceipts(
  receipts: readonly GithubCoreReceipt[],
  rangeStart: string,
  rangeEnd: string,
): GithubCoreReceipt[] {
  const accepted = new Map<string, GithubCoreReceipt>()
  for (const receipt of receipts) {
    assertOpaqueId(receipt.receiptId, 'receipt.receiptId')
    if (!Number.isInteger(receipt.pageNumber) || receipt.pageNumber < 1) throw new Error('receipt.pageNumber must be positive')
    if (!Array.isArray(receipt.unitIds)) throw new Error('receipt.unitIds must be an array')
    if (new Set(receipt.unitIds).size !== receipt.unitIds.length) throw new Error('receipt.unitIds must be unique within a page')
    for (const unitId of receipt.unitIds) assertOpaqueId(unitId, 'receipt.unitId')
    if (Object.hasOwn(receipt, 'highWatermark')) {
      assertWatermarkInRange(
        receipt.highWatermark as string,
        rangeStart,
        rangeEnd,
        'receipt.highWatermark',
      )
    }
    if (receipt.nextCursor !== null) assertOpaqueId(receipt.nextCursor, 'receipt.nextCursor')
    const existing = accepted.get(receipt.receiptId)
    if (existing && !receiptsAreEquivalent(existing, receipt)) throw new Error('RECEIPT_ID_COLLISION')
    if (!existing) accepted.set(receipt.receiptId, receipt)
  }
  const normalized = [...accepted.values()].sort(
    (left, right) => left.pageNumber - right.pageNumber || left.receiptId.localeCompare(right.receiptId),
  )
  normalized.forEach((receipt, index) => {
    if (receipt.pageNumber !== index + 1) throw new Error('RECEIPT_PAGE_SEQUENCE_INVALID')
    if (index < normalized.length - 1 && receipt.nextCursor === null) throw new Error('TERMINAL_PAGE_NOT_LAST')
  })
  return normalized
}

function distinctUnits(receipts: readonly GithubCoreReceipt[]): number {
  return new Set(receipts.flatMap((receipt) => receipt.unitIds)).size
}

function latestWatermark(receipts: readonly GithubCoreReceipt[], previous?: string): string | undefined {
  let latest = previous
  for (const receipt of receipts) {
    if (!receipt.highWatermark) continue
    if (!latest || parseCanonicalTimestamp(receipt.highWatermark, 'receipt.highWatermark') >
      parseCanonicalTimestamp(latest, 'checkpoint.highWatermark')) {
      latest = receipt.highWatermark
    }
  }
  return latest
}

/**
 * Pure synthetic reconciliation model. It accepts caller-supplied opaque receipts only; it does
 * not read a provider, persist anything, or bypass the denied collection plan.
 */
export function reconcileGithubCoreReceipts(input: GithubCoreReconciliationInput): GithubCoreCheckpointTransition {
  assertOpaqueId(input.scopeAlias, 'scopeAlias')
  assertOpaqueId(input.jobId, 'jobId')
  assertOpaqueId(input.consentRevision, 'consentRevision')
  if (!Number.isInteger(input.pageCap) || input.pageCap < 1) throw new Error('pageCap must be a positive integer')
  assertRange(input.rangeStart, input.rangeEnd)
  parseCanonicalTimestamp(input.observedAt, 'observedAt')
  if (Object.hasOwn(input, 'snapshotHash')) {
    assertLowercaseSha256(input.snapshotHash as string, 'snapshotHash')
  }
  if (input.checkpoint) {
    assertCompatibleCheckpoint(input.checkpoint, input)
  }

  if (input.failure) {
    const retry = classifyGithubCoreRetry(input.failure.kind, input.failure.attempt, input.failure.retryAfterMs)
    return {
      status: 'failed',
      coverage: coverage(input, 'failed', null, 0, null, `FAILURE_${retry.kind.toUpperCase()}`, retry.retry),
      checkpoint: input.checkpoint,
      appliedReceiptIds: [],
    }
  }

  let receipts: GithubCoreReceipt[]
  try {
    receipts = normalizedReceipts(input.receipts, input.rangeStart, input.rangeEnd)
  } catch {
    return {
      status: 'failed',
      coverage: coverage(input, 'failed', null, 0, null, 'RECEIPT_VALIDATION_FAILED', false),
      checkpoint: input.checkpoint,
      appliedReceiptIds: [],
    }
  }

  const processed = receipts.slice(0, input.pageCap)
  const observedUnits = distinctUnits(processed)
  const lastProcessed = processed.at(-1)
  const truncated = receipts.length > input.pageCap ||
    (receipts.length === input.pageCap && lastProcessed?.nextCursor !== null)
  if (truncated) {
    return {
      status: 'truncated',
      coverage: coverage(input, 'truncated', null, observedUnits, null, 'PAGE_CAP_REACHED', true, 'PAGE_CAP'),
      checkpoint: input.checkpoint,
      appliedReceiptIds: processed.map((receipt) => receipt.receiptId),
      ...(lastProcessed?.nextCursor ? { cursorHint: lastProcessed.nextCursor } : {}),
    }
  }

  if (!lastProcessed || lastProcessed.nextCursor !== null) {
    return {
      status: 'failed',
      coverage: coverage(input, 'failed', null, observedUnits, null, 'TERMINAL_PAGE_MISSING', true),
      checkpoint: input.checkpoint,
      appliedReceiptIds: [],
    }
  }

  const highWatermark = latestWatermark(processed, input.checkpoint?.highWatermark)
  const overlapCheckpoint: GithubCoreCheckpoint | null = highWatermark
    ? {
        capabilityId: 'github.core',
        scopeAlias: input.scopeAlias,
        queryVersion: GITHUB_CORE_QUERY_VERSION,
        sourceApiVersion: GITHUB_CORE_REST_API_VERSION,
        highWatermark,
        boundedOverlapStart: input.rangeStart,
        consentRevision: input.consentRevision,
        committedJobId: input.jobId,
      }
    : null
  const nextCheckpoint: GithubCoreCheckpoint = {
    capabilityId: 'github.core',
    scopeAlias: input.scopeAlias,
    queryVersion: GITHUB_CORE_QUERY_VERSION,
    sourceApiVersion: GITHUB_CORE_REST_API_VERSION,
    ...(highWatermark ? { highWatermark } : {}),
    boundedOverlapStart: boundedGithubCoreOverlapStart(input.rangeStart, input.rangeEnd, overlapCheckpoint),
    ...(Object.hasOwn(input, 'snapshotHash') ? { lastCompleteSnapshotHash: input.snapshotHash } : {}),
    consentRevision: input.consentRevision,
    committedJobId: input.jobId,
  }
  return {
    status: 'complete',
    coverage: coverage(input, 'complete', observedUnits, observedUnits, 0, 'COMPLETE', false),
    checkpoint: nextCheckpoint,
    appliedReceiptIds: processed.map((receipt) => receipt.receiptId),
  }
}
