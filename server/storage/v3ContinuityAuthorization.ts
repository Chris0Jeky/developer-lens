import { createHash } from 'node:crypto'
import { CanonicalTimestampSchema } from '../../shared/claims.js'
import { LowercaseSha256Schema } from '../../shared/capabilities.js'
import {
  replayValidateCapabilityLifecycleSnapshot,
  type CapabilityLifecycleSnapshot,
} from '../lifecycle.js'

/** Stable refusal codes for the caller-free B2b-i structural seam. */
export const V3_CONTINUITY_CANDIDATE_ERROR_CODES = [
  'INVALID_REQUEST',
  'INVALID_LIFECYCLE_SNAPSHOT',
  'UNSUPPORTED_CAPABILITY',
  'CAPABILITY_NOT_ACTIVE',
  'CARD_CONSENT_MISMATCH',
  'MISSING_REVIEWED_PREVIEW_OR_PROOF',
  'PENDING_REVOCATION',
  'DELETION_RECEIPT_PRESENT',
  'INVALID_REVIEW_DIGEST',
  'INVALID_REVIEWED_AT',
  'INVALID_CONTINUITY_EPOCH',
  'INVALID_CONTINUITY_REVISION',
  'INVALID_OPERATION_ID',
] as const
export type V3ContinuityCandidateErrorCode = typeof V3_CONTINUITY_CANDIDATE_ERROR_CODES[number]

export interface V3ContinuityCandidateRequest {
  readonly snapshot: unknown
  readonly reviewedReportSha256: unknown
  readonly reviewedAt: unknown
  readonly continuityEpoch: unknown
  readonly expectedContinuityRevision: unknown
  readonly operationId: unknown
}

/** This is an internal structural candidate, never an authorization or authentication result. */
export interface V3ContinuityCandidate {
  readonly kind: 'structural_continuity_candidate'
  readonly status: 'structurally_eligible'
  readonly capabilityId: 'github.core'
  readonly lifecycleEpoch: number
  readonly continuityEpoch: number
  readonly expectedContinuityRevision: number
  readonly operationId: string
  /** Local C2 receipt only; never a proof, retained key, log, API, export, or public value. */
  readonly receiptDigest: string
}

export type V3ContinuityCandidateResult =
  | Readonly<{ ok: true; candidate: V3ContinuityCandidate }>
  | Readonly<{ ok: false; code: V3ContinuityCandidateErrorCode }>

const OPERATION_ID_PATTERN = /^op-[0-9a-f]{64}$/
const CANDIDATE_DOMAIN = 'developer-lens:b2b-i:structural-continuity:v1\u0000'
const REQUEST_FIELDS = [
  'snapshot',
  'reviewedReportSha256',
  'reviewedAt',
  'continuityEpoch',
  'expectedContinuityRevision',
  'operationId',
] as const

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child)
  }
  return value
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function failure(code: V3ContinuityCandidateErrorCode): V3ContinuityCandidateResult {
  return Object.freeze({ ok: false as const, code })
}

function closedRequest(input: unknown): V3ContinuityCandidateRequest | null {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null
    const keys = Reflect.ownKeys(input)
    if (
      keys.length !== REQUEST_FIELDS.length
      || keys.some((key) => typeof key !== 'string' || !(REQUEST_FIELDS as readonly string[]).includes(key))
    ) return null
    const request: Record<string, unknown> = {}
    for (const field of REQUEST_FIELDS) {
      const descriptor = Object.getOwnPropertyDescriptor(input, field)
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null
      request[field] = descriptor.value
    }
    return request as unknown as V3ContinuityCandidateRequest
  } catch {
    return null
  }
}

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function receiptDigest(
  candidate: Omit<V3ContinuityCandidate, 'receiptDigest'>,
  snapshot: CapabilityLifecycleSnapshot,
  reviewedReportSha256: string,
  reviewedAt: string,
): string {
  return createHash('sha256')
    .update(CANDIDATE_DOMAIN + stableJson({ candidate, snapshot, reviewedReportSha256, reviewedAt }), 'utf8')
    .digest('hex')
}

/**
 * Build a deterministic, caller-free continuity candidate after replaying and checking the
 * existing lifecycle transcript. The result only claims structural eligibility and a claimed
 * review digest/time; it never authorizes, authenticates, verifies review, or permits renewal.
 */
export function proposeV3ContinuityCandidate(input: unknown): V3ContinuityCandidateResult {
  const request = closedRequest(input)
  if (!request) return failure('INVALID_REQUEST')
  let replay: ReturnType<typeof replayValidateCapabilityLifecycleSnapshot>
  try {
    replay = replayValidateCapabilityLifecycleSnapshot(request.snapshot)
  } catch {
    return failure('INVALID_LIFECYCLE_SNAPSHOT')
  }
  if (!replay.ok) return failure('INVALID_LIFECYCLE_SNAPSHOT')
  const snapshot: CapabilityLifecycleSnapshot = replay.snapshot

  if (snapshot.capabilityId !== 'github.core') return failure('UNSUPPORTED_CAPABILITY')
  if (snapshot.state !== 'active') return failure('CAPABILITY_NOT_ACTIVE')
  if (snapshot.cardSha256 === null || snapshot.consentRevision === null || snapshot.cardSha256 !== snapshot.consentRevision) {
    return failure('CARD_CONSENT_MISMATCH')
  }
  if (snapshot.previewSha256 === null || snapshot.exactHeadProofSha256 === null) {
    return failure('MISSING_REVIEWED_PREVIEW_OR_PROOF')
  }
  if (snapshot.deletionIntentId !== null || snapshot.deletionIntentSha256 !== null) {
    return failure('PENDING_REVOCATION')
  }
  if (snapshot.deletionReceiptSha256 !== null) return failure('DELETION_RECEIPT_PRESENT')

  const reviewedReportSha256 = LowercaseSha256Schema.safeParse(request.reviewedReportSha256)
  if (!reviewedReportSha256.success) return failure('INVALID_REVIEW_DIGEST')
  const reviewedAt = CanonicalTimestampSchema.safeParse(request.reviewedAt)
  if (!reviewedAt.success) return failure('INVALID_REVIEWED_AT')
  if (!isSafePositiveInteger(request.continuityEpoch)) return failure('INVALID_CONTINUITY_EPOCH')
  if (!isSafeNonNegativeInteger(request.expectedContinuityRevision)) return failure('INVALID_CONTINUITY_REVISION')
  if (typeof request.operationId !== 'string' || !OPERATION_ID_PATTERN.test(request.operationId)) {
    return failure('INVALID_OPERATION_ID')
  }

  const base = {
    kind: 'structural_continuity_candidate' as const,
    status: 'structurally_eligible' as const,
    capabilityId: 'github.core' as const,
    lifecycleEpoch: snapshot.epoch,
    continuityEpoch: request.continuityEpoch,
    expectedContinuityRevision: request.expectedContinuityRevision,
    operationId: request.operationId,
  }
  const candidate = freezeDeep({
    ...base,
    receiptDigest: receiptDigest(base, snapshot, reviewedReportSha256.data, reviewedAt.data),
  })
  return Object.freeze({ ok: true as const, candidate })
}
