import {
  parseGithubCoreActivationTaskCard,
  type GithubCoreActivationTaskCard,
} from './activationTask.js'

export const GITHUB_CORE_REST_USER_AGENT = 'developer-lens-public-transport/1' as const
export const GITHUB_CORE_REST_MAX_RESPONSE_BYTES = 2_097_152 as const

type RestHeaderValue = string | undefined

export interface GithubCoreRestResponse {
  readonly status: number
  readonly headers: {
    get(name: string): RestHeaderValue
  }
  text(): Promise<string>
}

export type GithubCoreRestFetch = (
  input: string,
  init: {
    readonly method: 'GET'
    readonly headers: Readonly<Record<string, string>>
    readonly redirect: 'error'
  },
) => Promise<GithubCoreRestResponse>

export type GithubCoreRestAliasDomain = 'repository' | 'issue' | 'pull_request' | 'page'
export type GithubCoreRestAlias = (
  domain: GithubCoreRestAliasDomain,
  rawProviderId: string,
) => string

export interface GithubCoreRestTransportInput {
  readonly card: GithubCoreActivationTaskCard
  readonly rangeEnd: string
  readonly fetch: GithubCoreRestFetch
  readonly alias: GithubCoreRestAlias
}

export interface GithubCoreRestRateLimit {
  readonly remaining: number | null
  readonly reset: number | null
}

export interface GithubCoreRestUnit {
  readonly alias: string
  readonly kind: 'issue' | 'pull_request'
  readonly updatedAt: string
}

export interface GithubCoreRestPageReceipt {
  readonly pageNumber: number
  readonly receiptAlias: string
  readonly unitCount: number
  readonly nextPage: number | null
}

interface GithubCoreRestBase {
  readonly repositoryAlias: string
  readonly rateLimit: GithubCoreRestRateLimit
}

interface GithubCoreRestObserved {
  readonly repositoryFlags: {
    readonly public: true
    readonly archived: boolean
    readonly disabled: boolean
    readonly fork: boolean
  }
  readonly units: readonly GithubCoreRestUnit[]
  readonly pages: readonly GithubCoreRestPageReceipt[]
  readonly observedUnitCount: number
  readonly observedPageCount: number
}

export interface GithubCoreRestCompleteResult extends GithubCoreRestBase, GithubCoreRestObserved {
  readonly kind: 'complete'
  readonly status: 'complete'
  readonly total: number
}

export interface GithubCoreRestTruncatedResult extends GithubCoreRestBase {
  readonly kind: 'truncated'
  readonly status: 'truncated'
  readonly total: null
  readonly code: 'REQUEST_BUDGET_EXHAUSTED' | 'RATE_LIMITED'
  readonly repositoryFlags: GithubCoreRestObserved['repositoryFlags'] | null
  readonly units: GithubCoreRestObserved['units'] | null
  readonly pages: GithubCoreRestObserved['pages'] | null
  readonly observedUnitCount: number | null
  readonly observedPageCount: number | null
}

export interface GithubCoreRestRestrictedResult extends GithubCoreRestBase {
  readonly kind: 'restricted'
  readonly status: 'restricted'
  readonly code: 'REPOSITORY_ID_MISMATCH' | 'REPOSITORY_NOT_PUBLIC' | 'PERMISSION_DENIED' | 'NOT_FOUND'
}

export interface GithubCoreRestFailedResult extends GithubCoreRestBase {
  readonly kind: 'failed'
  readonly status: 'failed'
  readonly code: 'SCHEMA_INVALID' | 'TRANSIENT' | 'UNSUPPORTED' | 'RATE_LIMITED'
}

export type GithubCoreRestTransportResult =
  | GithubCoreRestCompleteResult
  | GithubCoreRestTruncatedResult
  | GithubCoreRestRestrictedResult
  | GithubCoreRestFailedResult

const FIXED_HEADERS = Object.freeze({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2026-03-10',
  'User-Agent': GITHUB_CORE_REST_USER_AGENT,
})

const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const PROVIDER_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const SAFE_OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const SAFE_REPOSITORY = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/
const OPAQUE_ALIAS = /^[A-Za-z0-9:._-]{1,128}$/

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child)
  }
  return value
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !CANONICAL_UTC_TIMESTAMP.test(value)) return false
  const date = new Date(value)
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value
}

function normalizeProviderTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !PROVIDER_UTC_TIMESTAMP.test(value)) return null
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return null
  const normalized = date.toISOString()
  const expected = value.endsWith('.000Z') || value.includes('.')
    ? value
    : value.replace(/Z$/, '.000Z')
  return normalized === expected ? normalized : null
}

function rangeIsValid(card: GithubCoreActivationTaskCard, rangeEnd: string): boolean {
  if (!canonicalTimestamp(rangeEnd)) return false
  return Date.parse(card.readBoundary.rangeStart) < Date.parse(rangeEnd)
}

function opaqueAlias(value: unknown): value is string {
  return typeof value === 'string' && OPAQUE_ALIAS.test(value)
}

function responseHeader(response: GithubCoreRestResponse, name: string): string | undefined {
  try {
    return response.headers.get(name) ?? response.headers.get(name.toLowerCase())
  } catch {
    return undefined
  }
}

function numericHeader(response: GithubCoreRestResponse, name: string): number | null {
  const raw = responseHeader(response, name)
  if (raw === undefined || raw === '') return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

function rateLimit(response: GithubCoreRestResponse): GithubCoreRestRateLimit {
  return Object.freeze({
    remaining: numericHeader(response, 'x-ratelimit-remaining'),
    reset: numericHeader(response, 'x-ratelimit-reset'),
  })
}

function safeRequestUrl(card: GithubCoreActivationTaskCard, resource: 'metadata' | 'issues', page = 1): string {
  const owner = encodeURIComponent(card.selectedRepository.owner)
  const repository = encodeURIComponent(card.selectedRepository.name)
  const base = `https://api.github.com/repos/${owner}/${repository}`
  if (resource === 'metadata') return base
  const query = new URLSearchParams({
    state: 'open',
    since: card.readBoundary.rangeStart,
    per_page: String(card.readBoundary.pageSize),
    page: String(page),
    sort: 'updated',
    direction: 'asc',
  })
  return `${base}/issues?${query.toString()}`
}

function observedProjection(
  metadata: { archived: boolean; disabled: boolean; fork: boolean },
  units: readonly GithubCoreRestUnit[],
  pages: readonly GithubCoreRestPageReceipt[],
): GithubCoreRestObserved {
  return {
    repositoryFlags: Object.freeze({ public: true, archived: metadata.archived, disabled: metadata.disabled, fork: metadata.fork }),
    units: Object.freeze([...units]),
    pages: Object.freeze([...pages]),
    observedUnitCount: units.length,
    observedPageCount: pages.length,
  }
}

function restrictedResult(
  repositoryAlias: string,
  code: GithubCoreRestRestrictedResult['code'],
  rate: GithubCoreRestRateLimit,
): GithubCoreRestRestrictedResult {
  return freezeDeep({
    kind: 'restricted',
    status: 'restricted',
    code,
    repositoryAlias,
    rateLimit: rate,
  }) as GithubCoreRestRestrictedResult
}

function failedResult(
  repositoryAlias: string,
  code: GithubCoreRestFailedResult['code'],
  rate: GithubCoreRestRateLimit,
): GithubCoreRestFailedResult {
  return freezeDeep({
    kind: 'failed',
    status: 'failed',
    code,
    repositoryAlias,
    rateLimit: rate,
  }) as GithubCoreRestFailedResult
}

function truncatedResult(
  repositoryAlias: string,
  code: GithubCoreRestTruncatedResult['code'],
  metadata: { archived: boolean; disabled: boolean; fork: boolean } | null,
  units: readonly GithubCoreRestUnit[] | null,
  pages: readonly GithubCoreRestPageReceipt[] | null,
  rate: GithubCoreRestRateLimit,
): GithubCoreRestTruncatedResult {
  return freezeDeep({
    kind: 'truncated',
    status: 'truncated',
    total: null,
    code,
    repositoryAlias,
    rateLimit: rate,
    repositoryFlags: metadata
      ? Object.freeze({ public: true as const, archived: metadata.archived, disabled: metadata.disabled, fork: metadata.fork })
      : null,
    units: units ? Object.freeze([...units]) : null,
    pages: pages ? Object.freeze([...pages]) : null,
    observedUnitCount: units?.length ?? null,
    observedPageCount: pages?.length ?? null,
  }) as GithubCoreRestTruncatedResult
}

function completeResult(
  repositoryAlias: string,
  metadata: { archived: boolean; disabled: boolean; fork: boolean },
  units: readonly GithubCoreRestUnit[],
  pages: readonly GithubCoreRestPageReceipt[],
  rate: GithubCoreRestRateLimit,
): GithubCoreRestCompleteResult {
  return freezeDeep({
    ...observedProjection(metadata, units, pages),
    kind: 'complete',
    status: 'complete',
    total: units.length,
    repositoryAlias,
    rateLimit: rate,
  }) as GithubCoreRestCompleteResult
}

function parseRepositoryMetadata(value: unknown): { id: string; archived: boolean; disabled: boolean; fork: boolean; private: boolean } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!Number.isSafeInteger(record.id) || (record.id as number) <= 0) return null
  if (typeof record.private !== 'boolean' || typeof record.archived !== 'boolean' || typeof record.disabled !== 'boolean' || typeof record.fork !== 'boolean') return null
  return { id: String(record.id), private: record.private, archived: record.archived, disabled: record.disabled, fork: record.fork }
}

function parseIssues(value: unknown): readonly Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null
  const result: Record<string, unknown>[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const record = item as Record<string, unknown>
    const updatedAt = normalizeProviderTimestamp(record.updated_at)
    if (
      typeof record.node_id !== 'string' ||
      record.node_id.length < 1 ||
      record.node_id.length > 256 ||
      updatedAt === null
    ) return null
    if (Object.hasOwn(record, 'pull_request') && (typeof record.pull_request !== 'object' || record.pull_request === null)) return null
    result.push(Object.hasOwn(record, 'pull_request')
      ? { node_id: record.node_id, updated_at: updatedAt, pull_request: {} }
      : { node_id: record.node_id, updated_at: updatedAt })
  }
  return result
}

function parseNextPage(
  link: string | undefined,
  currentPage: number,
  expectedUrl: string,
  providerRepositoryId: string,
): number | null {
  if (link === undefined) return null
  if (link.trim().length === 0) throw new Error('schema')
  const segments = link.split(',').map((segment) => segment.trim()).filter(Boolean)
  const relations = new Map<'first' | 'prev' | 'next' | 'last', number>()
  for (const segment of segments) {
    const match = /^<([^>]+)>\s*;\s*rel="([^"]+)"$/.exec(segment)
    if (!match) throw new Error('schema')
    if (!['first', 'prev', 'next', 'last'].includes(match[2])) throw new Error('schema')
    const relation = match[2] as 'first' | 'prev' | 'next' | 'last'
    if (relations.has(relation)) throw new Error('schema')
    let candidate: URL
    try {
      candidate = new URL(match[1])
    } catch {
      throw new Error('schema')
    }
    const expected = new URL(expectedUrl)
    const canonicalRepositoryPath = `/repositories/${providerRepositoryId}/issues`
    if (
      candidate.origin !== expected.origin ||
      (candidate.pathname !== expected.pathname && candidate.pathname !== canonicalRepositoryPath)
    ) throw new Error('schema')
    const candidateParams = [...candidate.searchParams.entries()]
    const expectedParams = [...expected.searchParams.entries()]
    const page = Number(candidate.searchParams.get('page'))
    if (!Number.isSafeInteger(page) || page < 1 || candidateParams.length !== expectedParams.length) throw new Error('schema')
    for (const [key, value] of expectedParams) {
      if (key === 'page') {
        if (candidate.searchParams.get(key) !== String(page)) throw new Error('schema')
      } else if (candidate.searchParams.get(key) !== value) {
        throw new Error('schema')
      }
    }
    relations.set(relation, page)
  }
  const next = relations.get('next')
  const previous = relations.get('prev')
  const first = relations.get('first')
  const last = relations.get('last')
  if (next === undefined) {
    if (
      currentPage === 1 ||
      previous !== currentPage - 1 ||
      first !== 1 ||
      last !== undefined ||
      relations.size !== 2
    ) throw new Error('schema')
    return null
  }
  if (next !== currentPage + 1 || last === undefined || last < next) throw new Error('schema')
  if (currentPage === 1) {
    if (previous !== undefined || first !== undefined || relations.size !== 2) throw new Error('schema')
  } else if (previous !== currentPage - 1 || first !== 1 || relations.size !== 4) {
    throw new Error('schema')
  }
  return next
}

async function readJson(response: GithubCoreRestResponse): Promise<unknown> {
  const declaredBytes = numericHeader(response, 'content-length')
  if (declaredBytes !== null && declaredBytes > GITHUB_CORE_REST_MAX_RESPONSE_BYTES) {
    throw new Error('schema')
  }
  let text: string
  try {
    text = await response.text()
  } catch {
    throw new Error('transient')
  }
  if (new TextEncoder().encode(text).byteLength > GITHUB_CORE_REST_MAX_RESPONSE_BYTES) throw new Error('schema')
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('schema')
  }
}

function classifyHttp(response: GithubCoreRestResponse): GithubCoreRestFailedResult['code'] | GithubCoreRestRestrictedResult['code'] | GithubCoreRestTruncatedResult['code'] {
  if (response.status === 429) return 'RATE_LIMITED'
  if (response.status === 401) return 'PERMISSION_DENIED'
  if (response.status === 403) {
    return numericHeader(response, 'x-ratelimit-remaining') === 0 ||
      numericHeader(response, 'retry-after') !== null
      ? 'RATE_LIMITED'
      : 'PERMISSION_DENIED'
  }
  if (response.status === 404) return 'NOT_FOUND'
  if (response.status >= 500 && response.status <= 599) return 'TRANSIENT'
  if (response.status >= 400 && response.status <= 499) return 'UNSUPPORTED'
  return 'SCHEMA_INVALID'
}

function isRateLimited(code: string): boolean { return code === 'RATE_LIMITED' }

/** Public, unauthenticated, GET-only transport. It is inert until explicitly called by a caller. */
export async function collectGithubCoreRest(input: GithubCoreRestTransportInput): Promise<GithubCoreRestTransportResult> {
  let card: GithubCoreActivationTaskCard
  try {
    card = parseGithubCoreActivationTaskCard(input?.card)
  } catch {
    return failedResult('invalid', 'SCHEMA_INVALID', { remaining: null, reset: null })
  }
  const { rangeEnd, fetch, alias } = input
  if (!rangeIsValid(card, rangeEnd) || !SAFE_OWNER.test(card.selectedRepository.owner) || !SAFE_REPOSITORY.test(card.selectedRepository.name) || typeof fetch !== 'function' || typeof alias !== 'function') {
    return failedResult('invalid', 'SCHEMA_INVALID', { remaining: null, reset: null })
  }
  let repositoryAlias: string
  try {
    repositoryAlias = alias('repository', card.selectedRepository.providerRepositoryId)
    if (!opaqueAlias(repositoryAlias)) throw new Error('schema')
  } catch {
    return failedResult('invalid', 'SCHEMA_INVALID', { remaining: null, reset: null })
  }
  const aliasSources = new Map<string, string>([[
    repositoryAlias,
    `repository\0${card.selectedRepository.providerRepositoryId}`,
  ]])
  let metadataResponse: GithubCoreRestResponse
  try {
    metadataResponse = await fetch(safeRequestUrl(card, 'metadata'), { method: 'GET', headers: FIXED_HEADERS, redirect: 'error' })
  } catch {
    return failedResult(repositoryAlias, 'TRANSIENT', { remaining: null, reset: null })
  }
  let rate = rateLimit(metadataResponse)
  if (metadataResponse.status !== 200) {
    const code = classifyHttp(metadataResponse)
    if (isRateLimited(code)) return truncatedResult(repositoryAlias, 'RATE_LIMITED', null, null, null, rate)
    if (code === 'PERMISSION_DENIED' || code === 'NOT_FOUND') return restrictedResult(repositoryAlias, code, rate)
    return failedResult(repositoryAlias, code === 'TRANSIENT' ? 'TRANSIENT' : code === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'SCHEMA_INVALID', rate)
  }
  let metadata: ReturnType<typeof parseRepositoryMetadata>
  try { metadata = parseRepositoryMetadata(await readJson(metadataResponse)) } catch (error) { return failedResult(repositoryAlias, error instanceof Error && error.message === 'transient' ? 'TRANSIENT' : 'SCHEMA_INVALID', rate) }
  if (!metadata) return failedResult(repositoryAlias, 'SCHEMA_INVALID', rate)
  if (metadata.id !== card.selectedRepository.providerRepositoryId) return restrictedResult(repositoryAlias, 'REPOSITORY_ID_MISMATCH', rate)
  if (metadata.private) return restrictedResult(repositoryAlias, 'REPOSITORY_NOT_PUBLIC', rate)
  const flags = { archived: metadata.archived, disabled: metadata.disabled, fork: metadata.fork }
  const units: GithubCoreRestUnit[] = []
  const pages: GithubCoreRestPageReceipt[] = []
  let page = 1
  for (;;) {
    if (pages.length + 1 >= card.readBoundary.maximumRequests) return truncatedResult(repositoryAlias, 'REQUEST_BUDGET_EXHAUSTED', flags, units, pages, rate)
    const requestUrl = safeRequestUrl(card, 'issues', page)
    let response: GithubCoreRestResponse
    try { response = await fetch(requestUrl, { method: 'GET', headers: FIXED_HEADERS, redirect: 'error' }) } catch { return failedResult(repositoryAlias, 'TRANSIENT', rate) }
    rate = rateLimit(response)
    if (response.status !== 200) {
      const code = classifyHttp(response)
      if (isRateLimited(code)) return truncatedResult(repositoryAlias, 'RATE_LIMITED', flags, units, pages, rate)
      if (code === 'PERMISSION_DENIED' || code === 'NOT_FOUND') return restrictedResult(repositoryAlias, code, rate)
      return failedResult(repositoryAlias, code === 'TRANSIENT' ? 'TRANSIENT' : code === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'SCHEMA_INVALID', rate)
    }
    let parsed: readonly Record<string, unknown>[] | null
    try { parsed = parseIssues(await readJson(response)) } catch (error) { return failedResult(repositoryAlias, error instanceof Error && error.message === 'transient' ? 'TRANSIENT' : 'SCHEMA_INVALID', rate) }
    if (!parsed) return failedResult(repositoryAlias, 'SCHEMA_INVALID', rate)
    const start = Date.parse(card.readBoundary.rangeStart)
    const end = Date.parse(rangeEnd)
    let pageUnitCount = 0
    for (const item of parsed) {
      const updated = item.updated_at as string
      const updatedMs = Date.parse(updated)
      if (updatedMs < start || updatedMs >= end) continue
      const kind = Object.hasOwn(item, 'pull_request') ? 'pull_request' : 'issue'
      try {
        const rawProviderId = item.node_id as string
        const itemAlias = alias(kind, rawProviderId)
        if (!opaqueAlias(itemAlias)) throw new Error('schema')
        const aliasSource = `${kind}\0${rawProviderId}`
        const existing = aliasSources.get(itemAlias)
        if (existing !== undefined && existing !== aliasSource) throw new Error('schema')
        if (existing === aliasSource) continue
        aliasSources.set(itemAlias, aliasSource)
        units.push(Object.freeze({ alias: itemAlias, kind, updatedAt: updated }))
        pageUnitCount += 1
      } catch { return failedResult(repositoryAlias, 'SCHEMA_INVALID', rate) }
    }
    let next: number | null
    try {
      next = parseNextPage(
        responseHeader(response, 'link'),
        page,
        requestUrl,
        card.selectedRepository.providerRepositoryId,
      )
    } catch { return failedResult(repositoryAlias, 'SCHEMA_INVALID', rate) }
    let receiptAlias: string
    try {
      receiptAlias = alias('page', `${card.selectedRepository.providerRepositoryId}:${page}`)
      if (!opaqueAlias(receiptAlias)) throw new Error('schema')
      const receiptSource = `page\0${card.selectedRepository.providerRepositoryId}:${page}`
      const existing = aliasSources.get(receiptAlias)
      if (existing !== undefined && existing !== receiptSource) throw new Error('schema')
      aliasSources.set(receiptAlias, receiptSource)
    } catch { return failedResult(repositoryAlias, 'SCHEMA_INVALID', rate) }
    pages.push(Object.freeze({ pageNumber: page, receiptAlias, unitCount: pageUnitCount, nextPage: next }))
    if (next === null) return completeResult(repositoryAlias, flags, units, pages, rate)
    page = next
  }
}

export const collectGithubCoreRestTransport = collectGithubCoreRest
export const runGithubCoreRestTransport = collectGithubCoreRest
