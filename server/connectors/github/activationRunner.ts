import type Database from 'better-sqlite3'
import { completeObservedUnits, type CoverageRecord } from '../../../shared/coverage.js'
import {
  boundedGithubCoreOverlapStart,
  githubCoreManifest,
  reconcileGithubCoreNonComplete,
  type GithubCoreCheckpoint,
  type GithubCoreNonCompleteCheckpointTransition,
} from './core.js'
import {
  parseGithubCoreActivationTaskCard,
  type GithubCoreActivationTaskCard,
} from './activationTask.js'
import { loadHashBoundGithubCoreActivationTaskCard } from './activationTaskLoader.js'
import {
  assertGithubCoreActivationGrant,
  type GithubCoreActivationGrant,
} from './activationGrant.js'
import {
  composeGithubCoreRestComplete,
  composeGithubCoreRestNoncomplete,
  type GithubCoreRestCompositionContext,
} from './restComposition.js'
import {
  collectGithubCoreRest,
  type GithubCoreRestFetch,
  type GithubCoreRestNonCompleteResult,
} from './restTransport.js'
import {
  persistIncrementalGithubCoreTransition,
  readIncrementalGithubCoreCheckpoint,
  type PersistedGithubCoreCheckpointTransition,
} from '../../storage/incremental.js'
import { loadTaskInstallationKey } from '../../storage/taskInstallationKey.js'

export const GITHUB_CORE_ACTIVATION_RUNNER_ERROR_CODE =
  'GITHUB_CORE_ACTIVATION_RUNNER_FAILED' as const

const LOWERCASE_SHA_256 = /^[0-9a-f]{64}$/
const OPAQUE_ID = /^[A-Za-z0-9:._-]{1,128}$/
const CONTENT_FREE_COVERAGE_ID = /^cov-[0-9a-f]{64}$/
const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export class GithubCoreActivationRunnerError extends Error {
  readonly code = GITHUB_CORE_ACTIVATION_RUNNER_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_ACTIVATION_RUNNER_ERROR_CODE)
    this.name = 'GithubCoreActivationRunnerError'
  }
}

export interface GithubCoreActivationRunnerInput {
  readonly grant: GithubCoreActivationGrant
  readonly workspaceRoot: string
  readonly taskId: string
  readonly expectedTaskCardSha256: string
  /** Lazy, caller-owned handle factory; the runner invokes it only after exact grant/card/key binding. */
  readonly openStore: () => Database.Database
  readonly fetch: GithubCoreRestFetch
  readonly jobId: string
  /**
   * Content-free coverage key for this run's collection window (#86): `cov-` plus 64 lowercase
   * hex, minted from fresh entropy by `mintGithubCoreCoverageId()` and never derived from the
   * alias, provider ID, or range. It is part of the job identity the caller owns, alongside
   * `jobId` and `jobStartedAt`: replaying a job supplies the same three values, which is what
   * keeps the storage payload hash — and therefore replay idempotency — stable.
   */
  readonly coverageId: string
  /** Canonical logical observation time and range end, not a wall-clock duration measurement. */
  readonly jobStartedAt: string
}

export type GithubCoreActivationRunnerStability = 'not_observed' | 'stable' | 'unstable'

export interface GithubCoreActivationRunnerCoverageFacts {
  readonly status: CoverageRecord['status']
  readonly expectedUnits: number | null
  readonly observedUnits: number
  readonly omittedUnits: number | null
  readonly completeObservedUnits: number | null
  readonly saturationReason: string | null
  readonly retryable: boolean
  readonly limitationCode: string
}

export interface GithubCoreActivationRunnerRequestFacts {
  readonly maximumRequests: number
  readonly firstProbeMaximumRequests: number
  readonly secondProbeMaximumRequests: number
  readonly firstProbeRequests: number
  readonly secondProbeRequests: number
  readonly totalRequests: number
}

export interface GithubCoreActivationRunnerResult {
  readonly stability: GithubCoreActivationRunnerStability
  readonly coverage: GithubCoreActivationRunnerCoverageFacts
  readonly requests: GithubCoreActivationRunnerRequestFacts
}

type SnapshottedRunnerInput = GithubCoreActivationRunnerInput

interface RequestCounter {
  total: number
  first: number
  second: number
}

function fail(): never {
  throw new GithubCoreActivationRunnerError()
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child)
  }
  return value
}

function dataProperty(record: object, key: keyof GithubCoreActivationRunnerInput): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail()
  return descriptor.value
}

function isCanonicalTimestamp(value: string): boolean {
  if (!CANONICAL_UTC_TIMESTAMP.test(value)) return false
  const parsed = new Date(value)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value
}

function snapshotRunnerInput(value: unknown): SnapshottedRunnerInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail()
  const expectedKeys: readonly (keyof GithubCoreActivationRunnerInput)[] = [
    'grant',
    'workspaceRoot',
    'taskId',
    'expectedTaskCardSha256',
    'openStore',
    'fetch',
    'jobId',
    'coverageId',
    'jobStartedAt',
  ]
  const keys = Reflect.ownKeys(value)
  if (keys.length !== expectedKeys.length || expectedKeys.some((key) => !keys.includes(key))) fail()

  const grant = assertGithubCoreActivationGrant(dataProperty(value, 'grant'))
  const workspaceRoot = dataProperty(value, 'workspaceRoot')
  const taskId = dataProperty(value, 'taskId')
  const expectedTaskCardSha256 = dataProperty(value, 'expectedTaskCardSha256')
  const openStore = dataProperty(value, 'openStore')
  const fetch = dataProperty(value, 'fetch')
  const jobId = dataProperty(value, 'jobId')
  const coverageId = dataProperty(value, 'coverageId')
  const jobStartedAt = dataProperty(value, 'jobStartedAt')
  if (
    typeof workspaceRoot !== 'string' ||
    typeof taskId !== 'string' ||
    typeof expectedTaskCardSha256 !== 'string' ||
    !LOWERCASE_SHA_256.test(expectedTaskCardSha256) ||
    taskId !== grant.taskId ||
    expectedTaskCardSha256 !== grant.taskCardSha256 ||
    typeof openStore !== 'function' ||
    typeof fetch !== 'function' ||
    typeof jobId !== 'string' || !OPAQUE_ID.test(jobId) ||
    typeof coverageId !== 'string' || !CONTENT_FREE_COVERAGE_ID.test(coverageId) ||
    typeof jobStartedAt !== 'string' || !isCanonicalTimestamp(jobStartedAt)
  ) fail()

  return {
    grant,
    workspaceRoot,
    taskId,
    expectedTaskCardSha256,
    openStore: openStore as () => Database.Database,
    fetch: fetch as GithubCoreRestFetch,
    jobId,
    coverageId,
    jobStartedAt,
  }
}

function probeCard(
  card: GithubCoreActivationTaskCard,
  maximumRequests: number,
): GithubCoreActivationTaskCard {
  return parseGithubCoreActivationTaskCard({
    ...card,
    readBoundary: { ...card.readBoundary, maximumRequests },
  })
}

function compositionContext(
  input: SnapshottedRunnerInput,
  card: GithubCoreActivationTaskCard,
  scopeAlias: string,
  checkpoint: GithubCoreCheckpoint | null,
  pageCap: number,
): GithubCoreRestCompositionContext {
  return freezeDeep({
    checkpoint,
    coverageId: input.coverageId,
    scopeAlias,
    rangeStart: card.readBoundary.rangeStart,
    rangeEnd: input.jobStartedAt,
    observedAt: input.jobStartedAt,
    jobId: input.jobId,
    consentRevision: input.expectedTaskCardSha256,
    pageCap,
  })
}

function countedFetch(
  fetch: GithubCoreRestFetch,
  counters: RequestCounter,
  probe: 'first' | 'second',
  probeMaximumRequests: number,
  totalMaximumRequests: number,
): GithubCoreRestFetch {
  return async (url, init) => {
    if (counters[probe] >= probeMaximumRequests || counters.total >= totalMaximumRequests) fail()
    counters[probe] += 1
    counters.total += 1
    return fetch(url, init)
  }
}

function unstableTransition(
  context: GithubCoreRestCompositionContext,
): GithubCoreNonCompleteCheckpointTransition {
  return reconcileGithubCoreNonComplete({
    checkpoint: context.checkpoint,
    coverageId: context.coverageId,
    scopeAlias: context.scopeAlias,
    rangeStart: context.rangeStart,
    rangeEnd: context.rangeEnd,
    observedAt: context.observedAt,
    jobId: context.jobId,
    consentRevision: context.consentRevision,
    status: 'truncated',
    expectedUnits: null,
    observedUnits: 0,
    omittedUnits: null,
    appliedReceiptAliases: [],
    limitationCode: 'SNAPSHOT_UNSTABLE',
    saturationReason: 'SNAPSHOT_UNSTABLE',
  })
}

function persistTransition(
  db: Database.Database,
  input: SnapshottedRunnerInput,
  scopeAlias: string,
  transition: PersistedGithubCoreCheckpointTransition,
  sourceSnapshotId?: string,
): void {
  persistIncrementalGithubCoreTransition(db, {
    jobId: input.jobId,
    scopeAlias,
    consentRevision: input.expectedTaskCardSha256,
    ...(sourceSnapshotId ? { sourceSnapshotId } : {}),
    // The foundation persists one frozen logical job/observation time. A later caller-owned report
    // may measure duration without changing this canonical collection boundary.
    startedAt: input.jobStartedAt,
    completedAt: input.jobStartedAt,
    transition,
  })
}

function resultFacts(
  transition: PersistedGithubCoreCheckpointTransition,
  stability: GithubCoreActivationRunnerStability,
  maximumRequests: number,
  firstProbeMaximumRequests: number,
  secondProbeMaximumRequests: number,
  counters: RequestCounter,
): GithubCoreActivationRunnerResult {
  const coverage = transition.coverage
  return freezeDeep({
    stability,
    coverage: {
      status: coverage.status,
      expectedUnits: coverage.expectedUnits,
      observedUnits: coverage.observedUnits,
      omittedUnits: coverage.omittedUnits,
      completeObservedUnits: completeObservedUnits(coverage),
      saturationReason: coverage.saturationReason ?? null,
      retryable: coverage.retryable,
      limitationCode: coverage.limitationCode,
    },
    requests: {
      maximumRequests,
      firstProbeMaximumRequests,
      secondProbeMaximumRequests,
      firstProbeRequests: counters.first,
      secondProbeRequests: counters.second,
      totalRequests: counters.total,
    },
  })
}

async function run(
  input: SnapshottedRunnerInput,
): Promise<GithubCoreActivationRunnerResult> {
  const manifest = githubCoreManifest()
  if (manifest.execution !== 'grant_gated') fail()
  const card = await loadHashBoundGithubCoreActivationTaskCard({
    grant: input.grant,
    workspaceRoot: input.workspaceRoot,
    taskId: input.taskId,
    expectedSha256: input.expectedTaskCardSha256,
  })
  const maximumRequests = card.readBoundary.maximumRequests
  if (maximumRequests < 2 || Date.parse(card.readBoundary.rangeStart) >= Date.parse(input.jobStartedAt)) fail()

  const firstProbeMaximumRequests = Math.floor(maximumRequests / 2)
  const secondProbeMaximumRequests = maximumRequests - firstProbeMaximumRequests
  if (
    firstProbeMaximumRequests < 1 ||
    secondProbeMaximumRequests < 1 ||
    firstProbeMaximumRequests + secondProbeMaximumRequests !== maximumRequests
  ) fail()
  const firstCard = probeCard(card, firstProbeMaximumRequests)
  const secondCard = probeCard(card, secondProbeMaximumRequests)

  const installationKey = await loadTaskInstallationKey({
    workspaceRoot: input.workspaceRoot,
    taskId: input.taskId,
    expectedFingerprint: input.grant.installationKeyFingerprint,
  })
  const installationAliases = installationKey.aliases
  const scopeAlias = installationAliases.githubCoreAlias(
    'repository',
    card.selectedRepository.providerRepositoryId,
  )
  if (!OPAQUE_ID.test(scopeAlias) || scopeAlias !== input.grant.scopeAlias) fail()
  const db = input.openStore()
  if (!db || typeof db !== 'object') fail()
  const priorCheckpoint = freezeDeep(readIncrementalGithubCoreCheckpoint(db, scopeAlias))
  if (
    priorCheckpoint !== null &&
    priorCheckpoint.consentRevision !== input.expectedTaskCardSha256
  ) fail()
  boundedGithubCoreOverlapStart(card.readBoundary.rangeStart, input.jobStartedAt, priorCheckpoint)
  const counters: RequestCounter = { total: 0, first: 0, second: 0 }

  const firstResult = await collectGithubCoreRest({
    card: firstCard,
    rangeEnd: input.jobStartedAt,
    alias: installationAliases.githubCoreAlias,
    fetch: countedFetch(
      input.fetch,
      counters,
      'first',
      firstProbeMaximumRequests,
      maximumRequests,
    ),
  })
  const firstContext = compositionContext(
    input,
    card,
    scopeAlias,
    priorCheckpoint,
    Math.max(1, firstProbeMaximumRequests - 1),
  )
  if (firstResult.kind !== 'complete') {
    const composed = composeGithubCoreRestNoncomplete({
      ...firstContext,
      result: firstResult as GithubCoreRestNonCompleteResult,
      attempt: 1,
    })
    persistTransition(db, input, scopeAlias, composed.transition)
    return resultFacts(
      composed.transition,
      'not_observed',
      maximumRequests,
      firstProbeMaximumRequests,
      secondProbeMaximumRequests,
      counters,
    )
  }

  const firstComplete = composeGithubCoreRestComplete({ ...firstContext, result: firstResult })
  const secondResult = await collectGithubCoreRest({
    card: secondCard,
    rangeEnd: input.jobStartedAt,
    alias: installationAliases.githubCoreAlias,
    fetch: countedFetch(
      input.fetch,
      counters,
      'second',
      secondProbeMaximumRequests,
      maximumRequests,
    ),
  })
  const secondContext = compositionContext(
    input,
    card,
    scopeAlias,
    priorCheckpoint,
    Math.max(1, secondProbeMaximumRequests - 1),
  )
  if (secondResult.kind !== 'complete') {
    const composed = composeGithubCoreRestNoncomplete({
      ...secondContext,
      result: secondResult as GithubCoreRestNonCompleteResult,
      attempt: 2,
    })
    persistTransition(db, input, scopeAlias, composed.transition)
    return resultFacts(
      composed.transition,
      'not_observed',
      maximumRequests,
      firstProbeMaximumRequests,
      secondProbeMaximumRequests,
      counters,
    )
  }

  const secondComplete = composeGithubCoreRestComplete({ ...secondContext, result: secondResult })
  if (firstComplete.snapshotHash === secondComplete.snapshotHash) {
    persistTransition(db, input, scopeAlias, firstComplete.transition, firstComplete.sourceSnapshotId)
    return resultFacts(
      firstComplete.transition,
      'stable',
      maximumRequests,
      firstProbeMaximumRequests,
      secondProbeMaximumRequests,
      counters,
    )
  }

  const transition = unstableTransition(firstContext)
  persistTransition(db, input, scopeAlias, transition)
  return resultFacts(
    transition,
    'unstable',
    maximumRequests,
    firstProbeMaximumRequests,
    secondProbeMaximumRequests,
    counters,
  )
}

/**
 * Default-off github.core runner. No production module imports this entry point; callers must
 * inject an unforgeable grant plus lazy store access, exact card hash, time, job ID, and fetch.
 */
export async function runGithubCoreActivation(
  input: GithubCoreActivationRunnerInput,
): Promise<GithubCoreActivationRunnerResult> {
  try {
    return await run(snapshotRunnerInput(input))
  } catch (error) {
    if (error instanceof GithubCoreActivationRunnerError) throw error
    fail()
  }
}
