import { timingSafeEqual } from 'node:crypto'
import { V2Error } from './errors.js'

/**
 * Per-launch bearer plus exact Host and Origin allowlists for `/api/v2`
 * (ADR-04: the V2 endpoints ship with this from birth; legacy endpoints are
 * unchanged until their own retirement cards).
 *
 * Every check is exact-match and fail-closed: a missing, duplicated, or
 * malformed header is a rejection, never a fallback.
 */
export interface V2GuardOptions {
  readonly token: string
  readonly allowedHosts: readonly string[]
  readonly allowedOrigins: readonly string[]
}

export type V2GuardedHeaders = Readonly<Record<string, string | string[] | undefined>>

const BEARER_PREFIX = 'Bearer '

/**
 * Per the Fetch standard a same-origin `GET` carries no `Origin` header, so an
 * absent `Origin` is accepted only on this exact browser-set fetch-metadata
 * triple. A cross-origin page cannot forge it: `Sec-Fetch-*` are forbidden
 * header names, and a cross-site request reports `sec-fetch-site: cross-site`.
 * Any other combination is rejected.
 */
const SAME_ORIGIN_FETCH_METADATA: Readonly<Record<string, string>> = {
  'sec-fetch-site': 'same-origin',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
}

/** A repeated header arrives as an array; that is ambiguous, so it is rejected. */
function exactHeader(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function constantTimeEquals(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate, 'utf8')
  const expectedBytes = Buffer.from(expected, 'utf8')
  if (candidateBytes.length !== expectedBytes.length) {
    // Still compare something of equal length so the branch cost does not leak.
    timingSafeEqual(expectedBytes, expectedBytes)
    return false
  }
  return timingSafeEqual(candidateBytes, expectedBytes)
}

export function provesSameOriginFetch(headers: V2GuardedHeaders): boolean {
  return Object.entries(SAME_ORIGIN_FETCH_METADATA).every(
    ([header, expected]) => exactHeader(headers[header]) === expected,
  )
}

export function assertV2Request(headers: V2GuardedHeaders, options: V2GuardOptions): void {
  const host = exactHeader(headers.host)
  if (host === null || !options.allowedHosts.includes(host)) {
    throw new V2Error('V2_HOST_NOT_ALLOWED')
  }

  const origin = exactHeader(headers.origin)
  if (origin === null) {
    if (!provesSameOriginFetch(headers)) throw new V2Error('V2_ORIGIN_NOT_ALLOWED')
  } else if (!options.allowedOrigins.includes(origin)) {
    throw new V2Error('V2_ORIGIN_NOT_ALLOWED')
  }

  const authorization = exactHeader(headers.authorization)
  if (authorization === null || !authorization.startsWith(BEARER_PREFIX)) {
    throw new V2Error('V2_UNAUTHORIZED')
  }
  if (!constantTimeEquals(authorization.slice(BEARER_PREFIX.length), options.token)) {
    throw new V2Error('V2_UNAUTHORIZED')
  }
}
