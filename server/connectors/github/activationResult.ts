/**
 * Pure parser for the C1 github.core activation result.
 *
 * This seam intentionally has no runner, storage, clock, key, or reporting dependency. It
 * validates the already-produced runner facts and returns a deterministic, closed C1 shape.
 * `stable` means equal bounded probe hashes only, never review, authority, or source completeness.
 */

export const GITHUB_CORE_ACTIVATION_RESULT_SCHEMA_VERSION =
  'github-core-activation-result.v1' as const
export const GITHUB_CORE_ACTIVATION_RESULT_ERROR_CODE =
  'INVALID_GITHUB_CORE_ACTIVATION_RESULT' as const

export class GithubCoreActivationResultError extends Error {
  readonly code = GITHUB_CORE_ACTIVATION_RESULT_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_ACTIVATION_RESULT_ERROR_CODE)
    this.name = 'GithubCoreActivationResultError'
  }
}

export type GithubCoreActivationResultStability = 'not_observed' | 'stable' | 'unstable'
export type GithubCoreActivationResultStatus = 'complete' | 'restricted' | 'failed' | 'truncated'
export type GithubCoreActivationResultRestrictedCode =
  | 'REPOSITORY_ID_MISMATCH'
  | 'REPOSITORY_NOT_PUBLIC'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
export type GithubCoreActivationResultFailedCode =
  | 'SCHEMA_INVALID'
  | 'UNSUPPORTED'
  | 'FAILURE_TRANSIENT'
export type GithubCoreActivationResultTruncatedCode =
  | 'REQUEST_BUDGET_EXHAUSTED'
  | 'RATE_LIMITED'
  | 'SNAPSHOT_UNSTABLE'
export type GithubCoreActivationResultLimitationCode =
  | 'COMPLETE'
  | GithubCoreActivationResultRestrictedCode
  | GithubCoreActivationResultFailedCode
  | GithubCoreActivationResultTruncatedCode

export interface GithubCoreActivationResultCoverage {
  readonly status: GithubCoreActivationResultStatus
  readonly expectedUnits: number | null
  readonly observedUnits: number
  readonly omittedUnits: number | null
  readonly completeObservedUnits: number | null
  readonly saturationReason: GithubCoreActivationResultTruncatedCode | null
  readonly retryable: boolean
  readonly limitationCode: GithubCoreActivationResultLimitationCode
}

export interface GithubCoreActivationResultRequests {
  readonly maximumRequests: number
  readonly firstProbeMaximumRequests: number
  readonly secondProbeMaximumRequests: number
  readonly firstProbeRequests: number
  readonly secondProbeRequests: number
  readonly totalRequests: number
}

export interface GithubCoreActivationResult {
  readonly schemaVersion: typeof GITHUB_CORE_ACTIVATION_RESULT_SCHEMA_VERSION
  readonly capabilityId: 'github.core'
  readonly stability: GithubCoreActivationResultStability
  readonly coverage: GithubCoreActivationResultCoverage
  readonly requests: GithubCoreActivationResultRequests
}

const ROOT_FIELDS = ['schemaVersion', 'capabilityId', 'stability', 'coverage', 'requests'] as const
const COVERAGE_FIELDS = [
  'status',
  'expectedUnits',
  'observedUnits',
  'omittedUnits',
  'completeObservedUnits',
  'saturationReason',
  'retryable',
  'limitationCode',
] as const
const REQUEST_FIELDS = [
  'maximumRequests',
  'firstProbeMaximumRequests',
  'secondProbeMaximumRequests',
  'firstProbeRequests',
  'secondProbeRequests',
  'totalRequests',
] as const

const RESTRICTED_CODES = [
  'REPOSITORY_ID_MISMATCH',
  'REPOSITORY_NOT_PUBLIC',
  'PERMISSION_DENIED',
  'NOT_FOUND',
] as const
const FAILED_CODES = ['SCHEMA_INVALID', 'UNSUPPORTED', 'FAILURE_TRANSIENT'] as const
const TRUNCATED_CODES = [
  'REQUEST_BUDGET_EXHAUSTED',
  'RATE_LIMITED',
  'SNAPSHOT_UNSTABLE',
] as const

function invalid(): never {
  throw new GithubCoreActivationResultError()
}

/** Read own data properties only, recursively, without invoking accessors. */
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
      if (typeof key !== 'string') invalid()
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalid()
      record[key] = snapshotValue(descriptor.value, seen)
    }
    return record
  } catch {
    invalid()
  }
}

function exactRecord(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length !== fields.length || fields.some((field) => !Object.hasOwn(record, field))) invalid()
  return record
}

function safeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function assertCoverage(value: unknown): GithubCoreActivationResultCoverage {
  const coverage = exactRecord(value, COVERAGE_FIELDS)
  if (
    coverage.status !== 'complete' && coverage.status !== 'restricted' &&
    coverage.status !== 'failed' && coverage.status !== 'truncated'
  ) invalid()
  if (!safeCount(coverage.observedUnits)) invalid()
  if (coverage.saturationReason !== null && typeof coverage.saturationReason !== 'string') invalid()
  if (typeof coverage.retryable !== 'boolean' || typeof coverage.limitationCode !== 'string') invalid()

  const code = coverage.limitationCode
  if (coverage.status === 'complete') {
    if (code !== 'COMPLETE' || coverage.expectedUnits !== coverage.observedUnits ||
      coverage.completeObservedUnits !== coverage.observedUnits || coverage.omittedUnits !== 0 ||
      coverage.saturationReason !== null || coverage.retryable !== false) invalid()
  } else {
    if (coverage.expectedUnits !== null || coverage.omittedUnits !== null ||
      coverage.completeObservedUnits !== null) invalid()
    if ((coverage.status === 'restricted' || coverage.status === 'failed') && coverage.observedUnits !== 0) invalid()
    if (coverage.status === 'restricted' && !RESTRICTED_CODES.includes(code as typeof RESTRICTED_CODES[number])) invalid()
    if (coverage.status === 'failed' && !FAILED_CODES.includes(code as typeof FAILED_CODES[number])) invalid()
    if (coverage.status === 'truncated' && !TRUNCATED_CODES.includes(code as typeof TRUNCATED_CODES[number])) invalid()
    if (coverage.status !== 'truncated' && coverage.saturationReason !== null) invalid()
    if (coverage.status === 'truncated' && coverage.saturationReason !== code) invalid()
    const expectedRetryable = coverage.status === 'truncated' || code === 'FAILURE_TRANSIENT'
    if (coverage.retryable !== expectedRetryable) invalid()
  }
  return {
    status: coverage.status,
    expectedUnits: coverage.expectedUnits as number | null,
    observedUnits: coverage.observedUnits,
    omittedUnits: coverage.omittedUnits as number | null,
    completeObservedUnits: coverage.completeObservedUnits as number | null,
    saturationReason: coverage.saturationReason as GithubCoreActivationResultTruncatedCode | null,
    retryable: coverage.retryable,
    limitationCode: code as GithubCoreActivationResultLimitationCode,
  }
}

function assertRequests(value: unknown, stability: GithubCoreActivationResultStability): GithubCoreActivationResultRequests {
  const requests = exactRecord(value, REQUEST_FIELDS)
  for (const field of REQUEST_FIELDS) if (!safeCount(requests[field])) invalid()
  const maximumRequests = requests.maximumRequests as number
  const firstProbeMaximumRequests = requests.firstProbeMaximumRequests as number
  const secondProbeMaximumRequests = requests.secondProbeMaximumRequests as number
  const firstProbeRequests = requests.firstProbeRequests as number
  const secondProbeRequests = requests.secondProbeRequests as number
  const totalRequests = requests.totalRequests as number
  if (maximumRequests < 2 || maximumRequests > 20) invalid()
  if (firstProbeMaximumRequests !== Math.floor(maximumRequests / 2) ||
    secondProbeMaximumRequests !== maximumRequests - firstProbeMaximumRequests) invalid()
  if (firstProbeRequests > firstProbeMaximumRequests || secondProbeRequests > secondProbeMaximumRequests) invalid()
  if (totalRequests !== firstProbeRequests + secondProbeRequests || totalRequests > maximumRequests) invalid()
  if (firstProbeRequests < 1 || (secondProbeRequests > 0 && firstProbeRequests < 2)) invalid()
  if ((stability === 'stable' || stability === 'unstable') &&
    (firstProbeRequests < 2 || secondProbeRequests < 2)) invalid()
  return {
    maximumRequests,
    firstProbeMaximumRequests,
    secondProbeMaximumRequests,
    firstProbeRequests,
    secondProbeRequests,
    totalRequests,
  }
}

function assertRequestCoverageCoupling(
  coverage: GithubCoreActivationResultCoverage,
  requests: GithubCoreActivationResultRequests,
): void {
  if (coverage.status !== 'truncated') return
  const secondProbeRan = requests.secondProbeRequests > 0
  const activeProbeRequests = secondProbeRan
    ? requests.secondProbeRequests
    : requests.firstProbeRequests
  const activeProbeMaximumRequests = secondProbeRan
    ? requests.secondProbeMaximumRequests
    : requests.firstProbeMaximumRequests

  // The transport emits budget exhaustion only at its pre-request ceiling.
  if (
    coverage.limitationCode === 'REQUEST_BUDGET_EXHAUSTED' &&
    activeProbeRequests !== activeProbeMaximumRequests
  ) invalid()

  // A one-request probe fetched metadata only. A rate-limited probe needs one
  // additional failed request after at least one successful page to observe units.
  if (coverage.observedUnits > 0 && activeProbeRequests < 2) invalid()
  if (coverage.limitationCode === 'RATE_LIMITED' && coverage.observedUnits > 0 && activeProbeRequests < 3) invalid()
}

/** Parse a caller-supplied versioned projection of runner facts into the closed C1 contract. */
export function parseGithubCoreActivationResult(input: unknown): GithubCoreActivationResult {
  let snapshot: unknown
  try {
    snapshot = snapshotValue(input)
  } catch {
    invalid()
  }
  const root = exactRecord(snapshot, ROOT_FIELDS)
  if (root.schemaVersion !== GITHUB_CORE_ACTIVATION_RESULT_SCHEMA_VERSION || root.capabilityId !== 'github.core') invalid()
  if (root.stability !== 'not_observed' && root.stability !== 'stable' && root.stability !== 'unstable') invalid()
  const stability = root.stability as GithubCoreActivationResultStability
  const coverage = assertCoverage(root.coverage)
  if (stability === 'stable' && (coverage.status !== 'complete' || coverage.limitationCode !== 'COMPLETE')) invalid()
  if (stability === 'unstable' &&
    (coverage.status !== 'truncated' || coverage.limitationCode !== 'SNAPSHOT_UNSTABLE' || coverage.observedUnits !== 0)) invalid()
  if (stability === 'not_observed' &&
    (coverage.status === 'complete' || coverage.limitationCode === 'SNAPSHOT_UNSTABLE')) invalid()
  const requests = assertRequests(root.requests, stability)
  assertRequestCoverageCoupling(coverage, requests)
  return Object.freeze({
    schemaVersion: GITHUB_CORE_ACTIVATION_RESULT_SCHEMA_VERSION,
    capabilityId: 'github.core',
    stability,
    coverage: Object.freeze(coverage),
    requests: Object.freeze(requests),
  })
}
