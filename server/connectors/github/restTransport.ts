import type { GithubCoreActivationTaskCard } from './activationTask.js'

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

interface GithubCoreRestCommon {
  readonly kind: 'complete' | 'truncated' | 'restricted' | 'failed'
  readonly repositoryAlias: string
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
  readonly rateLimit: GithubCoreRestRateLimit
}

export interface GithubCoreRestCompleteResult extends GithubCoreRestCommon {
  readonly kind: 'complete'
  readonly status: 'complete'
  readonly total: number
}

export interface GithubCoreRestTruncatedResult extends GithubCoreRestCommon {
  readonly kind: 'truncated'
  readonly status: 'truncated'
  readonly total: null
  readonly code: 'REQUEST_BUDGET_EXHAUSTED' | 'RATE_LIMITED'
}

export interface GithubCoreRestRestrictedResult extends GithubCoreRestCommon {
  readonly kind: 'restricted'
  readonly status: 'restricted'
  readonly code: 'REPOSITORY_ID_MISMATCH' | 'REPOSITORY_NOT_PUBLIC' | 'PERMISSION_DENIED' | 'NOT_FOUND'
}

export interface GithubCoreRestFailedResult extends GithubCoreRestCommon {
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

function baseProjection(
  repositoryAlias: string,
  metadata: { archived: boolean; disabled: boolean; fork: boolean },
  units: readonly GithubCoreRestUnit[],
  pages: readonly GithubCoreRestPageReceipt[],
  rate: GithubCoreRestRateLimit,
): GithubCoreRestCommon {
  return {
    kind: 'complete',
    repositoryAlias,
    repositoryFlags: Object.freeze({ public: true, archived: metadata.archived, disabled: metadata.disabled, fork: metadata.fork }),
    units: Object.freeze([...units]),
    pages: Object.freeze([...pages]),
    observedUnitCount: units.length,
    observedPageCount: pages.length,
    rateLimit: rate,
  }
}

function restrictedResult(
  repositoryAlias: string,
  code: GithubCoreRestRestrictedResult['code'],
  rate: GithubCoreRestRateLimit,
): GithubCoreRestRestrictedResult {
  return freezeDeep({
    ...baseProjection(repositoryAlias, { archived: false, disabled: false, fork: false }, [], [], rate),
    kind: 'restricted',
    status: 'restricted',
    code,
  }) as GithubCoreRestRestrictedResult
}

function failedResult(
  repositoryAlias: string,
  code: GithubCoreRestFailedResult['code'],
  rate: GithubCoreRestRateLimit,
): GithubCoreRestFailedResult {
  return freezeDeep({
    ...baseProjection(repositoryAlias, { archived: false, disabled: false, fork: false }, [], [], rate),
    kind: 'failed',
    status: 'failed',
    code,
  }) as GithubCoreRestFailedResult
}

function truncatedResult(
  repositoryAlias: string,
  code: GithubCoreRestTruncatedResult['code'],
  metadata: { archived: boolean; disabled: boolean; fork: boolean },
  units: readonly GithubCoreRestUnit[],
  pages: readonly GithubCoreRestPageReceipt[],
  rate: GithubCoreRestRateLimit,
): GithubCoreRestTruncatedResult {
  return freezeDeep({
    ...baseProjection(repositoryAlias, metadata, units, pages, rate),
    kind: 'truncated',
    status: 'truncated',
    total: null,
    code,
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
    ...baseProjection(repositoryAlias, metadata, units, pages, rate),
    kind: 'complete',
    status: 'complete',
    total: units.length,
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
    if (typeof record.node_id !== 'string' || !canonicalTimestamp(record.updated_at)) return null
    if (Object.hasOwn(record, 'pull_request') && (typeof record.pull_request !== 'object' || record.pull_request === null)) return null
    result.push(record)
  }
  return result
}

function parseNextPage(link: string | undefined, currentPage: number, expectedUrl: string): number | null {
  if (!link) return null
  const segments = link.split(',').map((segment) => segment.trim()).filter(Boolean)
  let next: number | null = null
  for (const segment of segments) {
    const match = /^<([^>]+)>\s*;\s*rel="([^"]+)"$/.exec(segment)
    if (!match) throw new Error('schema')
    if (match[2] !== 'next') continue
    if (next !== null) throw new Error('schema')
    let candidate: URL
    try {
      candidate = new URL(match[1])
    } catch {
      throw new Error('schema')
    }
    const expected = new URL(expectedUrl)
    if (candidate.origin !== expected.origin || candidate.pathname !== expected.pathname) throw new Error('schema')
    const candidateParams = [...candidate.searchParams.entries()]
    const expectedParams = [...expected.searchParams.entries()]
    const page = Number(candidate.searchParams.get('page'))
    if (page !== currentPage + 1 || candidateParams.length !== expectedParams.length) throw new Error('schema')
    for (const [key, value] of expectedParams) {
      if (key === 'page') {
        if (candidate.searchParams.get(key) !== String(page)) throw new Error('schema')
      } else if (candidate.searchParams.get(key) !== value) {
        throw new Error('schema')
      }
    }
    next = page
  }
  return next
}

async function readJson(response: GithubCoreRestResponse): Promise<unknown> {
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
  if (response.status === 403) return numericHeader(response, 'x-ratelimit-remaining') === 0 ? 'RATE_LIMITED' : 'PERMISSION_DENIED'
  if (response.status === 404) return 'NOT_FOUND'
  if (response.status >= 500 && response.status <= 599) return 'TRANSIENT'
  if (response.status >= 400 && response.status <= 499) return 'UNSUPPORTED'
  return 'SCHEMA_INVALID'
}

function isRateLimited(code: string): boolean { return code === 'RATE_LIMITED' }

/** Public, unauthenticated, GET-only transport. It is inert until explicitly called by a caller. */
export async function collectGithubCoreRest(input: GithubCoreRestTransportInput): Promise<GithubCoreRestTransportResult> {
  const { card, rangeEnd, fetch, alias } = input
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
  let metadataResponse: GithubCoreRestResponse
  try {
    metadataResponse = await fetch(safeRequestUrl(card, 'metadata'), { method: 'GET', headers: FIXED_HEADERS, redirect: 'error' })
  } catch {
    return failedResult(repositoryAlias, 'TRANSIENT', { remaining: null, reset: null })
  }
  let rate = rateLimit(metadataResponse)
  if (metadataResponse.status !== 200) {
    const code = classifyHttp(metadataResponse)
    if (isRateLimited(code)) return failedResult(repositoryAlias, 'RATE_LIMITED', rate)
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
    for (const item of parsed) {
      const updated = item.updated_at as string
      const updatedMs = Date.parse(updated)
      if (updatedMs < start || updatedMs >= end) continue
      const kind = Object.hasOwn(item, 'pull_request') ? 'pull_request' : 'issue'
      try {
        const itemAlias = alias(kind, item.node_id as string)
        if (!opaqueAlias(itemAlias)) throw new Error('schema')
        units.push(Object.freeze({ alias: itemAlias, kind, updatedAt: updated }))
      } catch { return failedResult(repositoryAlias, 'SCHEMA_INVALID', rate) }
    }
    let next: number | null
    try { next = parseNextPage(responseHeader(response, 'link'), page, requestUrl) } catch { return failedResult(repositoryAlias, 'SCHEMA_INVALID', rate) }
    const receiptAlias = `${repositoryAlias}:page:${page}`
    if (!opaqueAlias(receiptAlias)) return failedResult(repositoryAlias, 'SCHEMA_INVALID', rate)
    pages.push(Object.freeze({ pageNumber: page, receiptAlias, unitCount: parsed.length, nextPage: next }))
    if (next === null) return completeResult(repositoryAlias, flags, units, pages, rate)
    page = next
  }
}

export const collectGithubCoreRestTransport = collectGithubCoreRest
export const runGithubCoreRestTransport = collectGithubCoreRest
