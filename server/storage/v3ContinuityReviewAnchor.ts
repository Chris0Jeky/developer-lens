/**
 * Pure local-C2 syntax parser for a caller-supplied continuity review anchor.
 *
 * Parsing `reviewDecision` proves only a caller-claimed syntactic record. It does not prove
 * owner authentication or review, trusted time, card/report/key/lifecycle binding,
 * authorization, renewal, retention, or source completeness. This module has no caller,
 * clock, filesystem, key, network, or storage dependency. The three deletion fields are
 * reviewed claimed absences only. The later composer must bind this anchor to one caller-selected
 * task path and one same-scope C1 row; re-read report/card/key and replay lifecycle, requiring exact
 * digest/epoch/preview/proof/deletion-null equality. It must enforce
 * `report.jobStartedAt <= reviewedAt <= trustedNow` and
 * `reviewedContinuityEpoch === currentContinuityEpoch + 1` inside a CAS transaction. This parser
 * intentionally performs none of those checks, and its decision literal is not authorization.
 */

export const GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_SCHEMA_VERSION =
  'github-core-continuity-review-anchor.v1' as const
export const GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_ERROR_CODE =
  'INVALID_V3_CONTINUITY_REVIEW_ANCHOR' as const

export class GithubCoreContinuityReviewAnchorError extends Error {
  readonly code = GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_ERROR_CODE)
    this.name = 'GithubCoreContinuityReviewAnchorError'
  }
}

export interface GithubCoreContinuityReviewAnchor {
  readonly schemaVersion: typeof GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_SCHEMA_VERSION
  readonly capabilityId: 'github.core'
  readonly taskId: string
  readonly reviewDecision: 'approve_continuity_renewal'
  readonly reviewedReportSha256: string
  readonly reviewedTaskCardSha256: string
  readonly reviewedInstallationKeyFingerprint: string
  readonly reviewedLifecycleState: 'active'
  readonly reviewedLifecycleEpoch: number
  readonly reviewedPreviewSha256: string
  readonly reviewedExactHeadProofSha256: string
  readonly reviewedDeletionIntentId: null
  readonly reviewedDeletionIntentSha256: null
  readonly reviewedDeletionReceiptSha256: null
  readonly reviewedContinuityEpoch: number
  readonly reviewedAt: string
}

const ROOT_FIELDS = [
  'schemaVersion',
  'capabilityId',
  'taskId',
  'reviewDecision',
  'reviewedReportSha256',
  'reviewedTaskCardSha256',
  'reviewedInstallationKeyFingerprint',
  'reviewedLifecycleState',
  'reviewedLifecycleEpoch',
  'reviewedPreviewSha256',
  'reviewedExactHeadProofSha256',
  'reviewedDeletionIntentId',
  'reviewedDeletionIntentSha256',
  'reviewedDeletionReceiptSha256',
  'reviewedContinuityEpoch',
  'reviewedAt',
] as const

const TASK_ID = /^[A-Za-z0-9_-]{1,128}$/
const SHA256 = /^[0-9a-f]{64}$/
const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function invalid(): never {
  throw new GithubCoreContinuityReviewAnchorError()
}

/** Read own data properties only, recursively, and never invoke an accessor. */
function snapshotValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) invalid()
  seen.add(value)
  try {
    const prototype = Object.getPrototypeOf(value)
    if (Array.isArray(value) || (prototype !== Object.prototype && prototype !== null)) invalid()
    const keys = Reflect.ownKeys(value)
    const record = Object.create(null) as Record<string, unknown>
    for (const key of keys) {
      if (typeof key !== 'string' || key === '__proto__') invalid()
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalid()
      record[key] = snapshotValue(descriptor.value, seen)
    }
    return record
  } catch {
    invalid()
  }
}

function exactRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length !== ROOT_FIELDS.length || ROOT_FIELDS.some((field) => !Object.hasOwn(record, field))) invalid()
  return record
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !CANONICAL_UTC_TIMESTAMP.test(value)) return false
  const parsed = new Date(value)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function sha256Digest(value: unknown): string {
  if (typeof value !== 'string' || !SHA256.test(value)) invalid()
  return value
}

/**
 * Parse the closed local-C2 anchor. The fixed fields remain caller claims; no authority is
 * inferred from the decision literal or any digest/time/epoch value.
 */
export function parseGithubCoreContinuityReviewAnchor(
  input: unknown,
): GithubCoreContinuityReviewAnchor {
  let snapshot: unknown
  try {
    snapshot = snapshotValue(input)
  } catch {
    invalid()
  }
  const root = exactRecord(snapshot)
  if (root.schemaVersion !== GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_SCHEMA_VERSION) invalid()
  if (root.capabilityId !== 'github.core') invalid()
  if (typeof root.taskId !== 'string' || !TASK_ID.test(root.taskId)) invalid()
  if (root.reviewDecision !== 'approve_continuity_renewal') invalid()
  const reviewedReportSha256 = sha256Digest(root.reviewedReportSha256)
  const reviewedTaskCardSha256 = sha256Digest(root.reviewedTaskCardSha256)
  const reviewedInstallationKeyFingerprint = sha256Digest(root.reviewedInstallationKeyFingerprint)
  const reviewedPreviewSha256 = sha256Digest(root.reviewedPreviewSha256)
  const reviewedExactHeadProofSha256 = sha256Digest(root.reviewedExactHeadProofSha256)
  if (root.reviewedLifecycleState !== 'active') invalid()
  if (!isPositiveSafeInteger(root.reviewedLifecycleEpoch)) invalid()
  if (!isPositiveSafeInteger(root.reviewedContinuityEpoch)) invalid()
  if (root.reviewedDeletionIntentId !== null || root.reviewedDeletionIntentSha256 !== null ||
    root.reviewedDeletionReceiptSha256 !== null) invalid()
  if (!isCanonicalTimestamp(root.reviewedAt)) invalid()
  const reviewedLifecycleEpoch = root.reviewedLifecycleEpoch
  const reviewedContinuityEpoch = root.reviewedContinuityEpoch
  const reviewedAt = root.reviewedAt

  return Object.freeze({
    schemaVersion: GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_SCHEMA_VERSION,
    capabilityId: 'github.core',
    taskId: root.taskId,
    reviewDecision: 'approve_continuity_renewal',
    reviewedReportSha256,
    reviewedTaskCardSha256,
    reviewedInstallationKeyFingerprint,
    reviewedLifecycleState: 'active',
    reviewedLifecycleEpoch,
    reviewedPreviewSha256,
    reviewedExactHeadProofSha256,
    reviewedDeletionIntentId: null,
    reviewedDeletionIntentSha256: null,
    reviewedDeletionReceiptSha256: null,
    reviewedContinuityEpoch,
    reviewedAt,
  })
}
