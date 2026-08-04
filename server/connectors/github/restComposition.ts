import { createHash } from 'node:crypto'
import {
  GITHUB_CORE_QUERY_VERSION,
  GITHUB_CORE_REST_API_VERSION,
  reconcileGithubCoreNonComplete,
  reconcileGithubCoreReceipts,
  type GithubCoreCheckpointTransition,
  type GithubCoreNonCompleteCheckpointTransition,
  type GithubCoreNonCompleteReconciliationInput,
  type GithubCoreReceipt,
  type GithubCoreReconciliationInput,
} from './core.js'
import type {
  GithubCoreRestCompleteResult,
  GithubCoreRestPageReceipt,
  GithubCoreRestUnit,
  GithubCoreRestNonCompleteResult,
} from './restTransport.js'

const SNAPSHOT_MARKER = 'developer-lens/github-core/rest-complete/v1' as const
const SNAPSHOT_ID_MARKER = 'developer-lens/github-core/source-snapshot-id/v1' as const
const OPAQUE_ID = /^[A-Za-z0-9:._-]{1,128}$/
const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export type GithubCoreRestCompositionContext = Omit<
  GithubCoreReconciliationInput,
  'receipts' | 'snapshotHash' | 'failure'
>

export interface GithubCoreRestCompleteCompositionInput extends GithubCoreRestCompositionContext {
  readonly result: GithubCoreRestCompleteResult
}

export interface GithubCoreRestCompleteCompositionResult {
  readonly transition: GithubCoreCheckpointTransition
  readonly receipts: readonly GithubCoreReceipt[]
  readonly snapshotHash: string
  readonly sourceSnapshotId: string
}

export interface GithubCoreRestNonCompleteCompositionInput extends GithubCoreRestCompositionContext {
  readonly result: GithubCoreRestNonCompleteResult
  readonly attempt: number
  readonly retryAfterMs?: number
}

export interface GithubCoreRestNonCompleteCompositionResult {
  readonly transition: GithubCoreNonCompleteCheckpointTransition
}

interface ValidatedProjection {
  readonly receipts: readonly GithubCoreReceipt[]
  readonly canonicalSnapshot: unknown
}

function fail(): never {
  throw new Error('REST_COMPLETE_COMPOSITION_INVALID')
}

function assertPlainRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail()
  return value as Record<string, unknown>
}

function assertKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const allowed = new Set(expected)
  if (Object.keys(value).some((key) => !allowed.has(key))) fail()
}

function assertOpaque(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !OPAQUE_ID.test(value)) fail()
}

function assertCanonicalTimestamp(value: unknown): Date {
  if (typeof value !== 'string' || !CANONICAL_UTC_TIMESTAMP.test(value)) fail()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) fail()
  return parsed
}

function assertBoolean(value: unknown): asserts value is boolean {
  if (typeof value !== 'boolean') fail()
}

function assertSafeCount(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail()
}

function assertRateLimit(value: unknown): void {
  const rateLimit = assertPlainRecord(value)
  assertKeys(rateLimit, ['remaining', 'reset'])
  for (const field of ['remaining', 'reset'] as const) {
    const candidate = rateLimit[field]
    if (candidate !== null && (!Number.isSafeInteger(candidate) || (candidate as number) < 0)) fail()
  }
}

function assertAttempt(value: unknown): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 3) fail()
}

function assertRetryAfter(value: unknown): asserts value is number | undefined {
  if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < 0)) fail()
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function validateUnit(
  value: unknown,
  rangeStart: Date,
  rangeEnd: Date,
): GithubCoreRestUnit {
  const unit = assertPlainRecord(value)
  assertKeys(unit, ['alias', 'kind', 'updatedAt'])
  assertOpaque(unit.alias)
  if (unit.kind !== 'issue' && unit.kind !== 'pull_request') fail()
  const updatedAt = assertCanonicalTimestamp(unit.updatedAt)
  if (updatedAt < rangeStart || updatedAt >= rangeEnd) fail()
  return { alias: unit.alias as string, kind: unit.kind, updatedAt: unit.updatedAt as string }
}

function validatePage(value: unknown): GithubCoreRestPageReceipt {
  const page = assertPlainRecord(value)
  assertKeys(page, ['pageNumber', 'receiptAlias', 'unitCount', 'unitAliases', 'nextPage'])
  if (!Number.isSafeInteger(page.pageNumber) || (page.pageNumber as number) < 1) fail()
  assertOpaque(page.receiptAlias)
  assertSafeCount(page.unitCount)
  if (!Array.isArray(page.unitAliases) || page.unitAliases.some((alias) => typeof alias !== 'string')) fail()
  const unitAliases = page.unitAliases as string[]
  if (new Set(unitAliases).size !== unitAliases.length) fail()
  for (const alias of unitAliases) assertOpaque(alias)
  if (page.unitCount !== unitAliases.length) fail()
  if (page.nextPage !== null && (!Number.isSafeInteger(page.nextPage) || (page.nextPage as number) < 1)) fail()
  return {
    pageNumber: page.pageNumber as number,
    receiptAlias: page.receiptAlias as string,
    unitCount: page.unitCount as number,
    unitAliases: [...unitAliases],
    nextPage: page.nextPage as number | null,
  }
}

function validateCompleteResult(input: GithubCoreRestCompleteCompositionInput): ValidatedProjection {
  const result = assertPlainRecord(input.result)
  assertKeys(result, [
    'kind', 'status', 'total', 'rangeStart', 'rangeEnd', 'repositoryAlias', 'rateLimit', 'repositoryFlags', 'units', 'pages',
    'observedUnitCount', 'observedPageCount',
  ])
  if (result.kind !== 'complete' || result.status !== 'complete') fail()
  assertOpaque(input.scopeAlias)
  assertOpaque(input.jobId)
  assertOpaque(input.consentRevision)
  if (result.repositoryAlias !== input.scopeAlias) fail()
  const rangeStart = assertCanonicalTimestamp(input.rangeStart)
  const rangeEnd = assertCanonicalTimestamp(input.rangeEnd)
  if (rangeStart >= rangeEnd) fail()
  if (result.rangeStart !== input.rangeStart || result.rangeEnd !== input.rangeEnd) fail()
  assertCanonicalTimestamp(input.observedAt)
  if (!Number.isSafeInteger(input.pageCap) || input.pageCap < 1) fail()
  if (input.checkpoint !== null) {
    const checkpoint = assertPlainRecord(input.checkpoint)
    assertKeys(checkpoint, [
      'capabilityId', 'scopeAlias', 'queryVersion', 'sourceApiVersion', 'highWatermark',
      'cursorHint', 'boundedOverlapStart', 'lastCompleteSnapshotHash', 'consentRevision', 'committedJobId',
    ])
  }
  assertRateLimit(result.rateLimit)
  const flags = assertPlainRecord(result.repositoryFlags)
  assertKeys(flags, ['public', 'archived', 'disabled', 'fork'])
  if (flags.public !== true) fail()
  assertBoolean(flags.archived)
  assertBoolean(flags.disabled)
  assertBoolean(flags.fork)
  assertSafeCount(result.total)
  assertSafeCount(result.observedUnitCount)
  assertSafeCount(result.observedPageCount)
  if (!Array.isArray(result.units) || !Array.isArray(result.pages)) fail()
  const units = result.units.map((unit) => validateUnit(unit, rangeStart, rangeEnd))
  const pages = result.pages.map(validatePage)
  if (result.total !== units.length || result.observedUnitCount !== units.length || result.observedPageCount !== pages.length) fail()
  if (pages.length < 1 || pages.length > input.pageCap) fail()

  const unitByAlias = new Map<string, GithubCoreRestUnit>()
  for (const unit of units) {
    if (unit.alias === input.scopeAlias || unitByAlias.has(unit.alias)) fail()
    unitByAlias.set(unit.alias, unit)
  }
  const receiptAliases = new Set<string>()
  const memberships = new Map<string, number>()
  const pageByNumber = [...pages].sort((left, right) => left.pageNumber - right.pageNumber)
  for (const [index, page] of pageByNumber.entries()) {
    if (page.pageNumber !== index + 1 || receiptAliases.has(page.receiptAlias)) fail()
    if (unitByAlias.has(page.receiptAlias) || page.receiptAlias === input.scopeAlias) fail()
    receiptAliases.add(page.receiptAlias)
    const expectedNext = index === pageByNumber.length - 1 ? null : page.pageNumber + 1
    if (page.nextPage !== expectedNext) fail()
    for (const alias of page.unitAliases) {
      if (!unitByAlias.has(alias)) fail()
      memberships.set(alias, (memberships.get(alias) ?? 0) + 1)
    }
  }
  if (memberships.size !== unitByAlias.size || [...unitByAlias.keys()].some((alias) => memberships.get(alias) !== 1)) fail()

  const receipts = pageByNumber.map((page, index) => {
    const unitIds = [...page.unitAliases].sort(compareText)
    const highWatermark = unitIds
      .map((alias) => unitByAlias.get(alias)!.updatedAt)
      .sort(compareText)
      .at(-1)
    return {
      receiptId: page.receiptAlias,
      pageNumber: page.pageNumber,
      unitIds,
      ...(highWatermark ? { highWatermark } : {}),
      nextCursor: index === pageByNumber.length - 1 ? null : pageByNumber[index + 1]!.receiptAlias,
    }
  })

  const canonicalSnapshot = {
    marker: SNAPSHOT_MARKER,
    queryVersion: GITHUB_CORE_QUERY_VERSION,
    sourceApiVersion: GITHUB_CORE_REST_API_VERSION,
    scopeAlias: input.scopeAlias,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    repositoryFlags: {
      public: true,
      archived: flags.archived,
      disabled: flags.disabled,
      fork: flags.fork,
    },
    units: [...units]
      .sort((left, right) => compareText(left.alias, right.alias))
      .map(({ alias, kind, updatedAt }) => ({ alias, kind, updatedAt })),
    pages: pageByNumber.map((page) => ({
      pageNumber: page.pageNumber,
      receiptAlias: page.receiptAlias,
      unitAliases: [...page.unitAliases].sort(compareText),
      nextPage: page.nextPage,
    })),
  }
  return { receipts, canonicalSnapshot }
}

interface ValidatedNonCompleteFacts {
  readonly status: 'restricted' | 'failed' | 'truncated'
  readonly observedUnits: number
  readonly appliedReceiptAliases: readonly string[]
  readonly limitationCode: string
  readonly saturationReason?: string
  readonly failureKind?: 'rate_limited' | 'transient'
  readonly cursorHint?: string
}

function validateNonCompleteResult(
  input: GithubCoreRestNonCompleteCompositionInput,
): ValidatedNonCompleteFacts {
  const context = assertPlainRecord(input)
  assertKeys(context, [
    'checkpoint', 'scopeAlias', 'rangeStart', 'rangeEnd', 'observedAt', 'jobId', 'consentRevision',
    'pageCap', 'result', 'attempt', 'retryAfterMs',
  ])
  assertOpaque(input.scopeAlias)
  assertOpaque(input.jobId)
  assertOpaque(input.consentRevision)
  const rangeStart = assertCanonicalTimestamp(input.rangeStart)
  const rangeEnd = assertCanonicalTimestamp(input.rangeEnd)
  if (rangeStart >= rangeEnd) fail()
  assertCanonicalTimestamp(input.observedAt)
  if (!Number.isSafeInteger(input.pageCap) || input.pageCap < 1) fail()
  assertAttempt(input.attempt)
  assertRetryAfter(input.retryAfterMs)
  if (input.checkpoint !== null) {
    const checkpoint = assertPlainRecord(input.checkpoint)
    assertKeys(checkpoint, [
      'capabilityId', 'scopeAlias', 'queryVersion', 'sourceApiVersion', 'highWatermark',
      'cursorHint', 'boundedOverlapStart', 'lastCompleteSnapshotHash', 'consentRevision', 'committedJobId',
    ])
  }

  const result = assertPlainRecord(input.result)
  const status = result.kind
  if (status !== 'restricted' && status !== 'failed' && status !== 'truncated') fail()
  if (result.status !== status) fail()
  const expectedKeys = status === 'truncated'
    ? [
        'kind', 'status', 'total', 'code', 'repositoryAlias', 'rateLimit', 'repositoryFlags', 'units', 'pages',
        'observedUnitCount', 'observedPageCount', 'rangeStart', 'rangeEnd',
      ]
    : ['kind', 'status', 'code', 'repositoryAlias', 'rateLimit', 'rangeStart', 'rangeEnd']
  assertKeys(result, expectedKeys)
  assertOpaque(result.repositoryAlias)
  if (result.repositoryAlias !== input.scopeAlias) fail()
  assertRateLimit(result.rateLimit)
  if (result.rangeStart !== input.rangeStart || result.rangeEnd !== input.rangeEnd) fail()
  if (result.rangeStart === null || result.rangeEnd === null) fail()

  const code = result.code
  if (status === 'restricted') {
    if (!['REPOSITORY_ID_MISMATCH', 'REPOSITORY_NOT_PUBLIC', 'PERMISSION_DENIED', 'NOT_FOUND'].includes(code as string)) fail()
    return { status, observedUnits: 0, appliedReceiptAliases: [], limitationCode: code as string }
  }
  if (status === 'failed') {
    if (!['SCHEMA_INVALID', 'TRANSIENT', 'UNSUPPORTED'].includes(code as string)) fail()
    return {
      status,
      observedUnits: 0,
      appliedReceiptAliases: [],
      limitationCode: code === 'TRANSIENT' ? 'FAILURE_TRANSIENT' : code as string,
      ...(code === 'TRANSIENT' ? { failureKind: 'transient' as const } : {}),
    }
  }
  if (!['REQUEST_BUDGET_EXHAUSTED', 'RATE_LIMITED'].includes(code as string)) fail()
  if (result.total !== null) fail()
  const flags = result.repositoryFlags
  const unitsValue = result.units
  const pagesValue = result.pages
  const observedUnitCount = result.observedUnitCount
  const observedPageCount = result.observedPageCount
  const metadataOnly = flags === null && unitsValue === null && pagesValue === null && observedUnitCount === null && observedPageCount === null
  if (metadataOnly) {
    return {
      status,
      observedUnits: 0,
      appliedReceiptAliases: [],
      limitationCode: code as string,
      saturationReason: code as string,
      ...(code === 'RATE_LIMITED' ? { failureKind: 'rate_limited' as const } : {}),
    }
  }
  if (flags === null || unitsValue === null || pagesValue === null || observedUnitCount === null || observedPageCount === null) fail()
  if (!Array.isArray(unitsValue) || !Array.isArray(pagesValue)) fail()
  const repositoryFlags = assertPlainRecord(flags)
  assertKeys(repositoryFlags, ['public', 'archived', 'disabled', 'fork'])
  if (repositoryFlags.public !== true) fail()
  assertBoolean(repositoryFlags.archived)
  assertBoolean(repositoryFlags.disabled)
  assertBoolean(repositoryFlags.fork)
  assertSafeCount(observedUnitCount)
  assertSafeCount(observedPageCount)
  if (pagesValue.length === 0) {
    if (unitsValue.length !== 0 || observedUnitCount !== 0 || observedPageCount !== 0) fail()
    return {
      status,
      observedUnits: 0,
      appliedReceiptAliases: [],
      limitationCode: code as string,
      saturationReason: code as string,
      ...(code === 'RATE_LIMITED' ? { failureKind: 'rate_limited' as const } : {}),
    }
  }
  if (pagesValue.length > input.pageCap || observedPageCount !== pagesValue.length) fail()
  if (observedUnitCount !== unitsValue.length) fail()
  const units = unitsValue.map((unit) => validateUnit(unit, rangeStart, rangeEnd))
  const pages = pagesValue.map(validatePage)
  const unitByAlias = new Map<string, GithubCoreRestUnit>()
  for (const unit of units) {
    if (unit.alias === input.scopeAlias || unitByAlias.has(unit.alias)) fail()
    unitByAlias.set(unit.alias, unit)
  }
  const receiptAliases = new Set<string>()
  const memberships = new Map<string, number>()
  const pageByNumber = [...pages].sort((left, right) => left.pageNumber - right.pageNumber)
  for (const [index, page] of pageByNumber.entries()) {
    if (page.pageNumber !== index + 1 || receiptAliases.has(page.receiptAlias)) fail()
    if (page.receiptAlias === input.scopeAlias || unitByAlias.has(page.receiptAlias)) fail()
    receiptAliases.add(page.receiptAlias)
    if (page.nextPage !== page.pageNumber + 1) fail()
    for (const alias of page.unitAliases) {
      if (!unitByAlias.has(alias)) fail()
      memberships.set(alias, (memberships.get(alias) ?? 0) + 1)
    }
  }
  if (memberships.size !== unitByAlias.size || [...unitByAlias.keys()].some((alias) => memberships.get(alias) !== 1)) fail()
  return {
    status,
    observedUnits: observedUnitCount,
    appliedReceiptAliases: pageByNumber.map((page) => page.receiptAlias),
    limitationCode: code as string,
    saturationReason: code as string,
    ...(code === 'RATE_LIMITED' ? { failureKind: 'rate_limited' as const } : {}),
    cursorHint: String(pageByNumber.at(-1)!.nextPage),
  }
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child)
  }
  return value
}

export function composeGithubCoreRestComplete(
  input: GithubCoreRestCompleteCompositionInput,
): GithubCoreRestCompleteCompositionResult {
  try {
    const { receipts, canonicalSnapshot } = validateCompleteResult(input)
    const snapshotHash = createHash('sha256').update(JSON.stringify(canonicalSnapshot), 'utf8').digest('hex')
    const sourceSnapshotIdHash = createHash('sha256')
      .update(SNAPSHOT_ID_MARKER, 'utf8')
      .update('\0', 'utf8')
      .update(snapshotHash, 'utf8')
      .update('\0', 'utf8')
      .update(input.jobId, 'utf8')
      .digest('hex')
    const { result: _result, ...context } = input
    const transition = reconcileGithubCoreReceipts({
      ...context,
      receipts,
      snapshotHash,
    })
    if (transition.status !== 'complete') fail()
    return freezeDeep({
      transition,
      receipts,
      snapshotHash,
      sourceSnapshotId: `ghcore_${sourceSnapshotIdHash}`,
    })
  } catch {
    throw new Error('REST_COMPLETE_COMPOSITION_INVALID')
  }
}

/** Pure noncomplete REST composition. It never creates receipts, hashes, snapshots, or checkpoint movement. */
export function composeGithubCoreRestNoncomplete(
  input: GithubCoreRestNonCompleteCompositionInput,
): GithubCoreRestNonCompleteCompositionResult {
  try {
    const facts = validateNonCompleteResult(input)
    const failure = facts.failureKind
      ? {
          kind: facts.failureKind,
          attempt: input.attempt,
          ...(input.retryAfterMs !== undefined ? { retryAfterMs: input.retryAfterMs } : {}),
        }
      : undefined
    const transitionInput: GithubCoreNonCompleteReconciliationInput = {
      checkpoint: input.checkpoint,
      scopeAlias: input.scopeAlias,
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
      observedAt: input.observedAt,
      jobId: input.jobId,
      consentRevision: input.consentRevision,
      status: facts.status,
      expectedUnits: null,
      observedUnits: facts.observedUnits,
      omittedUnits: null,
      appliedReceiptAliases: facts.appliedReceiptAliases,
      limitationCode: facts.limitationCode,
      ...(facts.saturationReason ? { saturationReason: facts.saturationReason } : {}),
      ...(failure ? { failure } : {}),
      ...(facts.cursorHint ? { cursorHint: facts.cursorHint } : {}),
    }
    const transition = reconcileGithubCoreNonComplete(transitionInput)
    return freezeDeep({ transition })
  } catch {
    throw new Error('REST_NONCOMPLETE_COMPOSITION_INVALID')
  }
}

export const composeGithubCoreRestNonComplete = composeGithubCoreRestNoncomplete
