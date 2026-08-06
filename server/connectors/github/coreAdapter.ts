import {
  GITHUB_CORE_QUERY_VERSION,
  GITHUB_CORE_REST_API_VERSION,
  classifyGithubCoreRetry,
  githubCoreManifest,
  reconcileGithubCoreReceipts,
  type GithubCoreCheckpoint,
  type GithubCoreCheckpointTransition,
  type GithubCoreFailureKind,
  type GithubCoreReceipt,
  type GithubCoreRetryClassification,
} from './core.js'

const OPAQUE_ID = /^[A-Za-z0-9:._-]+$/
const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const LOWERCASE_SHA_256 = /^[0-9a-f]{64}$/
const CONTENT_FREE_COVERAGE_ID = /^cov-[0-9a-f]{64}$/
export const GITHUB_CORE_SYNTHETIC_MAX_PAGE_CAP = 1_000 as const
const FAILURE_KINDS = new Set<GithubCoreFailureKind>([
  'rate_limited',
  'transient',
  'permission',
  'unsupported',
  'schema',
  'unknown',
])

export interface GithubCoreSyntheticPageRequest {
  readonly execution: 'invented_fixture'
  readonly capabilityId: 'github.core'
  readonly scopeAlias: string
  readonly consentRevision: string
  readonly queryVersion: typeof GITHUB_CORE_QUERY_VERSION
  readonly sourceApiVersion: typeof GITHUB_CORE_REST_API_VERSION
  readonly rangeStart: string
  readonly rangeEnd: string
  readonly pageNumber: number
  readonly cursor: string | null
}

export interface GithubCoreSyntheticPage {
  readonly kind: 'page'
  readonly request: GithubCoreSyntheticPageRequest
  readonly receipt: GithubCoreReceipt
}

export interface GithubCoreSyntheticFailure {
  readonly kind: 'failure'
  readonly request: GithubCoreSyntheticPageRequest
  readonly failure: {
    readonly kind: GithubCoreFailureKind
    readonly attempt: number
    readonly retryAfterMs?: number
  }
}

export type GithubCoreSyntheticPageResult = GithubCoreSyntheticPage | GithubCoreSyntheticFailure
export type GithubCoreSyntheticPageAcquirer = (
  request: GithubCoreSyntheticPageRequest,
) => GithubCoreSyntheticPageResult | Promise<GithubCoreSyntheticPageResult>

export interface GithubCoreSyntheticCollectionInput {
  readonly execution: 'invented_fixture'
  readonly capabilityId: 'github.core'
  /** Caller-owned content-free coverage key (#86); see `GithubCoreReconciliationInput`. */
  readonly coverageId: string
  readonly scopeAlias: string
  readonly consentRevision: string
  readonly queryVersion: typeof GITHUB_CORE_QUERY_VERSION
  readonly sourceApiVersion: typeof GITHUB_CORE_REST_API_VERSION
  readonly rangeStart: string
  readonly rangeEnd: string
  readonly observedAt: string
  readonly jobId: string
  readonly pageCap: number
  readonly checkpoint: GithubCoreCheckpoint | null
  readonly snapshotHash?: string
}

export interface GithubCoreSyntheticCollectionResult extends GithubCoreCheckpointTransition {
  readonly execution: 'invented_fixture'
  readonly requests: readonly GithubCoreSyntheticPageRequest[]
  readonly classifications: readonly GithubCoreRetryClassification[]
  readonly classification: GithubCoreRetryClassification | null
  readonly retryScheduled: false
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${field} must be a plain object`)
  }
  return value as Record<string, unknown>
}

function keys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const permitted = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!permitted.has(key)) throw new Error(`${field}.${key} is not permitted`)
  }
}

function opaque(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length > 128 || !OPAQUE_ID.test(value)) {
    throw new Error(`${field} must be an opaque identifier`)
  }
}

function timestamp(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !CANONICAL_UTC_TIMESTAMP.test(value)) throw new Error(`${field} must be a canonical UTC timestamp`)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) throw new Error(`${field} must be a canonical UTC timestamp`)
}

function range(rangeStart: string, rangeEnd: string): void {
  timestamp(rangeStart, 'rangeStart')
  timestamp(rangeEnd, 'rangeEnd')
  if (new Date(rangeStart) >= new Date(rangeEnd)) throw new Error('rangeStart must be earlier than rangeEnd')
}

function validateCheckpoint(value: GithubCoreCheckpoint | null): void {
  if (value === null) return
  const checkpoint = record(value, 'checkpoint')
  keys(checkpoint, [
    'capabilityId', 'scopeAlias', 'queryVersion', 'sourceApiVersion', 'highWatermark', 'cursorHint',
    'boundedOverlapStart', 'lastCompleteSnapshotHash', 'consentRevision', 'committedJobId',
  ], 'checkpoint')
  if (checkpoint.capabilityId !== 'github.core') throw new Error('checkpoint.capabilityId mismatch')
  if (checkpoint.queryVersion !== GITHUB_CORE_QUERY_VERSION || checkpoint.sourceApiVersion !== GITHUB_CORE_REST_API_VERSION) throw new Error('checkpoint version mismatch')
  opaque(checkpoint.scopeAlias, 'checkpoint.scopeAlias')
  opaque(checkpoint.consentRevision, 'checkpoint.consentRevision')
  opaque(checkpoint.committedJobId, 'checkpoint.committedJobId')
  timestamp(checkpoint.boundedOverlapStart, 'checkpoint.boundedOverlapStart')
  if (Object.hasOwn(checkpoint, 'highWatermark')) timestamp(checkpoint.highWatermark, 'checkpoint.highWatermark')
  if (Object.hasOwn(checkpoint, 'cursorHint')) opaque(checkpoint.cursorHint, 'checkpoint.cursorHint')
  if (Object.hasOwn(checkpoint, 'lastCompleteSnapshotHash') &&
      (typeof checkpoint.lastCompleteSnapshotHash !== 'string' || !LOWERCASE_SHA_256.test(checkpoint.lastCompleteSnapshotHash))) {
    throw new Error('checkpoint.lastCompleteSnapshotHash must be a canonical lowercase SHA-256')
  }
}

function validateInput(input: GithubCoreSyntheticCollectionInput): void {
  const value = record(input, 'input')
  keys(value, [
    'execution', 'capabilityId', 'coverageId', 'scopeAlias', 'consentRevision', 'queryVersion',
    'sourceApiVersion', 'rangeStart', 'rangeEnd', 'observedAt', 'jobId', 'pageCap', 'checkpoint',
    'snapshotHash',
  ], 'input')
  if (value.execution !== 'invented_fixture') throw new Error('input.execution must be invented_fixture')
  if (value.capabilityId !== 'github.core') throw new Error('input.capabilityId mismatch')
  if (typeof value.coverageId !== 'string' || !CONTENT_FREE_COVERAGE_ID.test(value.coverageId)) {
    throw new Error('coverageId must be a content-free coverage key of cov- plus 64 lowercase hex')
  }
  if (value.queryVersion !== GITHUB_CORE_QUERY_VERSION || value.sourceApiVersion !== GITHUB_CORE_REST_API_VERSION) throw new Error('input version mismatch')
  opaque(value.scopeAlias, 'scopeAlias')
  opaque(value.consentRevision, 'consentRevision')
  opaque(value.jobId, 'jobId')
  range(value.rangeStart as string, value.rangeEnd as string)
  timestamp(value.observedAt, 'observedAt')
  if (!Number.isSafeInteger(value.pageCap) || (value.pageCap as number) < 1 || (value.pageCap as number) > GITHUB_CORE_SYNTHETIC_MAX_PAGE_CAP) {
    throw new Error(`pageCap must be between 1 and ${GITHUB_CORE_SYNTHETIC_MAX_PAGE_CAP}`)
  }
  validateCheckpoint(value.checkpoint as GithubCoreCheckpoint | null)
  if (value.checkpoint !== null) {
    const checkpoint = value.checkpoint as GithubCoreCheckpoint
    if (checkpoint.scopeAlias !== value.scopeAlias) throw new Error('checkpoint scope mismatch')
    if (checkpoint.consentRevision !== value.consentRevision) throw new Error('checkpoint consent mismatch')
    if (checkpoint.highWatermark) {
      const highWatermark = new Date(checkpoint.highWatermark as string)
      if (highWatermark < new Date(value.rangeStart as string) || highWatermark >= new Date(value.rangeEnd as string)) {
        throw new Error('checkpoint.highWatermark must fall within the collection range')
      }
      if (new Date(checkpoint.boundedOverlapStart as string) > highWatermark) throw new Error('checkpoint window inverted')
    }
  }
  if (Object.hasOwn(value, 'snapshotHash') && (typeof value.snapshotHash !== 'string' || !LOWERCASE_SHA_256.test(value.snapshotHash))) {
    throw new Error('snapshotHash must be a canonical lowercase SHA-256')
  }
  const manifest = githubCoreManifest()
  if (manifest.execution !== 'grant_gated') throw new Error('github.core activation boundary changed')
}

function validateRequest(value: unknown, expected: GithubCoreSyntheticPageRequest): void {
  const request = record(value, 'page.request')
  keys(request, [
    'execution', 'capabilityId', 'scopeAlias', 'consentRevision', 'queryVersion', 'sourceApiVersion',
    'rangeStart', 'rangeEnd', 'pageNumber', 'cursor',
  ], 'page.request')
  for (const key of Object.keys(expected)) {
    if (request[key] !== expected[key as keyof GithubCoreSyntheticPageRequest]) throw new Error('PAGE_REQUEST_MISMATCH')
  }
  if (!Number.isSafeInteger(request.pageNumber) || (request.pageNumber as number) < 1) throw new Error('page.request.pageNumber is invalid')
  if (request.cursor !== null) opaque(request.cursor, 'page.request.cursor')
}

function validateReceipt(value: unknown, request: GithubCoreSyntheticPageRequest): GithubCoreReceipt {
  const receipt = record(value, 'page.receipt')
  keys(receipt, ['receiptId', 'pageNumber', 'unitIds', 'highWatermark', 'nextCursor'], 'page.receipt')
  opaque(receipt.receiptId, 'receipt.receiptId')
  if (receipt.pageNumber !== request.pageNumber) throw new Error('RECEIPT_PAGE_MISMATCH')
  if (!Array.isArray(receipt.unitIds) || receipt.unitIds.some((unitId) => typeof unitId !== 'string')) throw new Error('receipt.unitIds is invalid')
  for (const unitId of receipt.unitIds) opaque(unitId, 'receipt.unitId')
  if (Object.hasOwn(receipt, 'highWatermark')) timestamp(receipt.highWatermark, 'receipt.highWatermark')
  if (receipt.nextCursor !== null) opaque(receipt.nextCursor, 'receipt.nextCursor')
  return Object.freeze({
    receiptId: receipt.receiptId as string,
    pageNumber: receipt.pageNumber as number,
    unitIds: Object.freeze([...(receipt.unitIds as string[])]),
    ...(Object.hasOwn(receipt, 'highWatermark') ? { highWatermark: receipt.highWatermark as string } : {}),
    nextCursor: receipt.nextCursor as string | null,
  })
}

function validateFailure(value: unknown): GithubCoreSyntheticFailure['failure'] {
  const failure = record(value, 'failure')
  keys(failure, ['kind', 'attempt', 'retryAfterMs'], 'failure')
  if (!FAILURE_KINDS.has(failure.kind as GithubCoreFailureKind)) throw new Error('failure.kind is unsupported')
  if (!Number.isSafeInteger(failure.attempt) || (failure.attempt as number) < 1 || (failure.attempt as number) > 3) throw new Error('failure.attempt is invalid')
  if (Object.hasOwn(failure, 'retryAfterMs') && (!Number.isSafeInteger(failure.retryAfterMs) || (failure.retryAfterMs as number) < 0)) throw new Error('failure.retryAfterMs is invalid')
  return failure as GithubCoreSyntheticFailure['failure']
}

function transition(
  input: GithubCoreSyntheticCollectionInput,
  receipts: readonly GithubCoreReceipt[],
  requests: readonly GithubCoreSyntheticPageRequest[],
  failure: GithubCoreSyntheticFailure['failure'],
  classifications: readonly GithubCoreRetryClassification[],
): GithubCoreSyntheticCollectionResult {
  const classification = classifyGithubCoreRetry(failure.kind, failure.attempt, failure.retryAfterMs)
  const reconciled = reconcileGithubCoreReceipts({
    checkpoint: input.checkpoint,
    coverageId: input.coverageId,
    scopeAlias: input.scopeAlias,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    observedAt: input.observedAt,
    jobId: input.jobId,
    consentRevision: input.consentRevision,
    pageCap: input.pageCap,
    receipts,
    ...(input.snapshotHash ? { snapshotHash: input.snapshotHash } : {}),
    failure,
  })
  return {
    ...reconciled,
    execution: 'invented_fixture',
    requests,
    classifications: [...classifications, classification],
    classification,
    retryScheduled: false,
  }
}

function successfulTransition(
  input: GithubCoreSyntheticCollectionInput,
  receipts: readonly GithubCoreReceipt[],
  requests: readonly GithubCoreSyntheticPageRequest[],
): GithubCoreSyntheticCollectionResult {
  const reconciled = reconcileGithubCoreReceipts({
    checkpoint: input.checkpoint,
    coverageId: input.coverageId,
    scopeAlias: input.scopeAlias,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    observedAt: input.observedAt,
    jobId: input.jobId,
    consentRevision: input.consentRevision,
    pageCap: input.pageCap,
    receipts,
    ...(input.snapshotHash ? { snapshotHash: input.snapshotHash } : {}),
  })
  return { ...reconciled, execution: 'invented_fixture', requests, classifications: [], classification: null, retryScheduled: false }
}

/** Sequential invented-fixture adapter. It never schedules, sleeps, retries, or reaches a provider. */
export async function collectSyntheticGithubCorePages(
  input: GithubCoreSyntheticCollectionInput,
  acquire: GithubCoreSyntheticPageAcquirer,
): Promise<GithubCoreSyntheticCollectionResult> {
  validateInput(input)
  if (typeof acquire !== 'function') throw new Error('acquire must be a function')
  const stableInput: GithubCoreSyntheticCollectionInput = Object.freeze({
    ...input,
    checkpoint: input.checkpoint ? Object.freeze({ ...input.checkpoint }) : null,
  })
  const receipts: GithubCoreReceipt[] = []
  const requests: GithubCoreSyntheticPageRequest[] = []
  const seenCursors = new Set<string | null>([null])
  const seenReceipts = new Set<string>()
  let cursor: string | null = null

  for (let pageNumber = 1; pageNumber <= stableInput.pageCap; pageNumber += 1) {
    const request = Object.freeze({
      execution: 'invented_fixture',
      capabilityId: 'github.core',
      scopeAlias: stableInput.scopeAlias,
      consentRevision: stableInput.consentRevision,
      queryVersion: GITHUB_CORE_QUERY_VERSION,
      sourceApiVersion: GITHUB_CORE_REST_API_VERSION,
      rangeStart: stableInput.rangeStart,
      rangeEnd: stableInput.rangeEnd,
      pageNumber,
      cursor,
    })
    requests.push(request)
    let result: GithubCoreSyntheticPageResult
    try {
      result = await acquire(request)
    } catch (error) {
      if (typeof error === 'object' && error !== null && !Array.isArray(error) && Object.getPrototypeOf(error) === Object.prototype) {
        const thrown = error as Record<string, unknown>
        if (FAILURE_KINDS.has(thrown.kind as GithubCoreFailureKind) && Number.isSafeInteger(thrown.attempt)) {
          try {
            const failure = validateFailure(thrown)
            return transition(stableInput, [], requests, failure, [])
          } catch {
            return transition(stableInput, [], requests, { kind: 'schema', attempt: 1 }, [])
          }
        }
      }
      return transition(stableInput, [], requests, { kind: 'unknown', attempt: 1 }, [])
    }

    try {
      const envelope = record(result, 'page result')
      if (envelope.kind === 'failure') {
        keys(envelope, ['kind', 'request', 'failure'], 'page result')
        validateRequest(envelope.request, request)
        const failure = validateFailure(envelope.failure)
        return transition(stableInput, [], requests, failure, [])
      }
      if (envelope.kind !== 'page') throw new Error('page result kind is unsupported')
      keys(envelope, ['kind', 'request', 'receipt'], 'page result')
      validateRequest(envelope.request, request)
      const receipt = validateReceipt(envelope.receipt, request)
      if (seenReceipts.has(receipt.receiptId)) throw new Error('DUPLICATE_RECEIPT')
      seenReceipts.add(receipt.receiptId)
      if (receipt.nextCursor !== null && seenCursors.has(receipt.nextCursor)) throw new Error('CURSOR_CYCLE')
      receipts.push(receipt)
      if (receipt.nextCursor === null) return successfulTransition(stableInput, receipts, requests)
      seenCursors.add(receipt.nextCursor)
      cursor = receipt.nextCursor
    } catch {
      return transition(stableInput, [], requests, { kind: 'schema', attempt: 1 }, [])
    }
  }

  return successfulTransition(stableInput, receipts, requests)
}
