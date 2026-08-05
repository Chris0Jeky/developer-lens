import { isAbsolute, resolve } from 'node:path'
import { loadHashBoundGithubCoreActivationReport } from '../connectors/github/activationReportLoader.js'
import { loadHashBoundGithubCoreActivationTaskCard } from '../connectors/github/activationTaskLoader.js'
import {
  replayValidateCapabilityLifecycleSnapshot,
  type CapabilityLifecycleSnapshot,
} from '../lifecycle.js'
import { captureTrustedProcessWallTime } from '../trustedProcessClock.js'
import { loadTaskInstallationKey } from './taskInstallationKey.js'
import { loadHashBoundGithubCoreContinuityReviewAnchor } from './v3ContinuityReviewAnchorLoader.js'

export const GITHUB_CORE_CONTINUITY_STRUCTURAL_COMPOSITION_ERROR_CODE =
  'INVALID_GITHUB_CORE_CONTINUITY_STRUCTURAL_COMPOSITION' as const

export class GithubCoreContinuityStructuralCompositionError extends Error {
  readonly code = GITHUB_CORE_CONTINUITY_STRUCTURAL_COMPOSITION_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_CONTINUITY_STRUCTURAL_COMPOSITION_ERROR_CODE)
    this.name = 'GithubCoreContinuityStructuralCompositionError'
  }
}

export type GithubCoreContinuityStructuralCompositionInput = Readonly<{
  workspaceRoot: string
  taskId: string
  expectedAnchorSha256: string
  lifecycleSnapshot: unknown
}>

export type GithubCoreContinuityStructuralComposition = Readonly<{
  kind: 'github_core_continuity_structural_composition'
  status: 'structurally_consistent'
}>

const INPUT_FIELDS = [
  'workspaceRoot',
  'taskId',
  'expectedAnchorSha256',
  'lifecycleSnapshot',
] as const
const TASK_ID = /^[A-Za-z0-9_-]{1,128}$/
const SHA256 = /^[0-9a-f]{64}$/
const MAX_LIFECYCLE_ARRAY_ITEMS = 1_024
const MAX_LIFECYCLE_DEPTH = 8
const MAX_LIFECYCLE_NODES = 8_192
const MAX_LIFECYCLE_OBJECT_FIELDS = 32
const MAX_LIFECYCLE_STRING_UNITS = 256 * 1_024
const STRUCTURALLY_CONSISTENT = Object.freeze({
  kind: 'github_core_continuity_structural_composition' as const,
  status: 'structurally_consistent' as const,
})

function invalidComposition(): never {
  throw new GithubCoreContinuityStructuralCompositionError()
}

type SnapshotBudget = {
  nodes: number
  stringUnits: number
  seen: WeakSet<object>
}

function snapshotLifecycleValue(
  value: unknown,
  budget: SnapshotBudget,
  depth = 0,
): unknown {
  if (depth > MAX_LIFECYCLE_DEPTH) invalidComposition()
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || value === undefined) {
    return value
  }
  if (typeof value === 'string') {
    budget.stringUnits += value.length
    if (budget.stringUnits > MAX_LIFECYCLE_STRING_UNITS) invalidComposition()
    return value
  }
  if (typeof value !== 'object') invalidComposition()
  if (budget.seen.has(value)) invalidComposition()
  budget.seen.add(value)
  budget.nodes += 1
  if (budget.nodes > MAX_LIFECYCLE_NODES) invalidComposition()

  const prototype = Object.getPrototypeOf(value)
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) invalidComposition()
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length')
    if (
      !lengthDescriptor ||
      !Object.hasOwn(lengthDescriptor, 'value') ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > MAX_LIFECYCLE_ARRAY_ITEMS
    ) invalidComposition()
    const length = lengthDescriptor.value
    const keys = Reflect.ownKeys(value)
    if (
      keys.length !== length + 1 ||
      keys.some((key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/.test(key)))
    ) invalidComposition()
    const output: unknown[] = []
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalidComposition()
      output.push(snapshotLifecycleValue(descriptor.value, budget, depth + 1))
    }
    return output
  }

  if (prototype !== Object.prototype && prototype !== null) invalidComposition()
  const output = Object.create(null) as Record<string, unknown>
  const keys = Reflect.ownKeys(value)
  if (keys.length > MAX_LIFECYCLE_OBJECT_FIELDS) invalidComposition()
  for (const key of keys) {
    if (typeof key !== 'string' || key === '__proto__') invalidComposition()
    budget.stringUnits += key.length
    if (budget.stringUnits > MAX_LIFECYCLE_STRING_UNITS) invalidComposition()
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalidComposition()
    output[key] = snapshotLifecycleValue(descriptor.value, budget, depth + 1)
  }
  return output
}

function closedInput(input: unknown): GithubCoreContinuityStructuralCompositionInput {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalidComposition()
    const prototype = Object.getPrototypeOf(input)
    if (prototype !== Object.prototype && prototype !== null) invalidComposition()
    const keys = Reflect.ownKeys(input)
    if (
      keys.length !== INPUT_FIELDS.length ||
      keys.some((key) => typeof key !== 'string' || !(INPUT_FIELDS as readonly string[]).includes(key))
    ) invalidComposition()

    const values = Object.create(null) as Record<string, unknown>
    for (const field of INPUT_FIELDS) {
      const descriptor = Object.getOwnPropertyDescriptor(input, field)
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalidComposition()
      values[field] = descriptor.value
    }
    if (
      typeof values.workspaceRoot !== 'string' ||
      values.workspaceRoot.length === 0 ||
      !isAbsolute(values.workspaceRoot) ||
      resolve(values.workspaceRoot) !== values.workspaceRoot
    ) invalidComposition()
    if (typeof values.taskId !== 'string' || !TASK_ID.test(values.taskId)) invalidComposition()
    if (typeof values.expectedAnchorSha256 !== 'string' || !SHA256.test(values.expectedAnchorSha256)) {
      invalidComposition()
    }
    return {
      workspaceRoot: values.workspaceRoot,
      taskId: values.taskId,
      expectedAnchorSha256: values.expectedAnchorSha256,
      lifecycleSnapshot: values.lifecycleSnapshot,
    }
  } catch (error) {
    if (error instanceof GithubCoreContinuityStructuralCompositionError) throw error
    invalidComposition()
  }
}

function replaySnapshot(input: unknown): CapabilityLifecycleSnapshot {
  try {
    const snapshot = snapshotLifecycleValue(input, {
      nodes: 0,
      stringUnits: 0,
      seen: new WeakSet(),
    })
    const replay = replayValidateCapabilityLifecycleSnapshot(snapshot)
    if (!replay.ok) invalidComposition()
    return replay.snapshot
  } catch (error) {
    if (error instanceof GithubCoreContinuityStructuralCompositionError) throw error
    invalidComposition()
  }
}

function timestamp(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : invalidComposition()
}

/**
 * Compose fixed task-local continuity inputs into one structural-only consistency result.
 *
 * The external anchor digest and the anchor's review fields remain caller claims. This seam does
 * not authenticate an owner, read same-scope C1/CAS state, prove lifecycle freshness under a
 * concurrent revocation, advance an epoch, extend retention, or authorize a caller. It has no
 * production caller and returns none of the local-C2 values it compares.
 */
export async function composeGithubCoreContinuityStructuralConsistency(
  input: unknown,
): Promise<GithubCoreContinuityStructuralComposition> {
  try {
    const request = closedInput(input)

    // Detach and replay the caller-held transcript before the first asynchronous boundary.
    const snapshot = replaySnapshot(request.lifecycleSnapshot)
    const loadedAnchor = await loadHashBoundGithubCoreContinuityReviewAnchor({
      workspaceRoot: request.workspaceRoot,
      taskId: request.taskId,
      expectedSha256: request.expectedAnchorSha256,
    })
    const { anchor } = loadedAnchor
    const card = await loadHashBoundGithubCoreActivationTaskCard({
      workspaceRoot: request.workspaceRoot,
      taskId: request.taskId,
      expectedSha256: anchor.reviewedTaskCardSha256,
    })
    const report = await loadHashBoundGithubCoreActivationReport({
      workspaceRoot: request.workspaceRoot,
      taskId: request.taskId,
      expectedSha256: anchor.reviewedReportSha256,
    })
    const key = await loadTaskInstallationKey({
      workspaceRoot: request.workspaceRoot,
      taskId: request.taskId,
      expectedFingerprint: anchor.reviewedInstallationKeyFingerprint,
    })

    if (
      loadedAnchor.taskId !== request.taskId ||
      anchor.taskId !== request.taskId ||
      card.taskId !== request.taskId ||
      report.taskId !== request.taskId ||
      key.taskId !== request.taskId ||
      key.fingerprint !== anchor.reviewedInstallationKeyFingerprint
    ) invalidComposition()

    const selectedScopeAlias = key.aliases.githubCoreAlias(
      'repository',
      card.selectedRepository.providerRepositoryId,
    )
    if (
      snapshot.capabilityId !== 'github.core' ||
      snapshot.scopeAlias !== selectedScopeAlias ||
      snapshot.state !== 'active' ||
      anchor.reviewedLifecycleState !== snapshot.state ||
      anchor.reviewedLifecycleEpoch !== snapshot.epoch ||
      snapshot.cardSha256 !== anchor.reviewedTaskCardSha256 ||
      snapshot.consentRevision !== anchor.reviewedTaskCardSha256 ||
      snapshot.previewSha256 !== anchor.reviewedPreviewSha256 ||
      snapshot.exactHeadProofSha256 !== anchor.reviewedExactHeadProofSha256 ||
      snapshot.deletionIntentId !== null ||
      snapshot.deletionIntentSha256 !== null ||
      snapshot.deletionReceiptSha256 !== null ||
      anchor.reviewedDeletionIntentId !== null ||
      anchor.reviewedDeletionIntentSha256 !== null ||
      anchor.reviewedDeletionReceiptSha256 !== null
    ) invalidComposition()

    if (report.result.requests.maximumRequests !== card.readBoundary.maximumRequests) {
      invalidComposition()
    }
    const authorizedAt = timestamp(card.authorizedAt)
    const rangeStart = timestamp(card.readBoundary.rangeStart)
    const jobStartedAt = timestamp(report.jobStartedAt)
    const reviewedAt = timestamp(anchor.reviewedAt)
    const trustedNow = timestamp(captureTrustedProcessWallTime())
    if (
      authorizedAt > jobStartedAt ||
      rangeStart >= jobStartedAt ||
      jobStartedAt > reviewedAt ||
      reviewedAt > trustedNow
    ) invalidComposition()

    return STRUCTURALLY_CONSISTENT
  } catch (error) {
    if (error instanceof GithubCoreContinuityStructuralCompositionError) throw error
    invalidComposition()
  }
}
