import { timingSafeEqual } from 'node:crypto'
import { V2Error } from './errors.js'

/**
 * Exact Host and Origin allowlists plus ONE of two authentication channels for `/api/v2`
 * (ADR-04: the V2 endpoints ship with this from birth; legacy endpoints are
 * unchanged until their own retirement cards).
 *
 * Every check is exact-match and fail-closed: a missing, duplicated, or
 * malformed header is a rejection, never a fallback.
 *
 * Reviewed posture change (#78). The bearer used to be required on every request, including
 * from the browser, which forced the cockpit to read `VITE_DEVELOPER_LENS_V2_TOKEN` — a value
 * Vite statically inlines into built JavaScript, so the delivery channel could put the token in
 * a public bundle. It bought nothing: as `mount.ts` already conceded, any local process can read
 * that asset, so the bearer was never a secret against a local requester.
 *
 * What actually defends the browser drive-by surface is the exact Host allowlist plus the
 * `Sec-Fetch-*` triple, which a page on another origin cannot forge — `Sec-Fetch-*` are
 * forbidden header names, so a cross-site request always reports `sec-fetch-site: cross-site`.
 * A request that PROVES it is a same-origin browser fetch on an allowlisted Host is therefore
 * authenticated by that proof, and no token needs to exist in page JavaScript at all.
 *
 * The bearer remains the channel for non-browser callers (curl, scripts, tests), which cannot
 * be distinguished from a hostile local process either way. Both channels are equally weak
 * against a local attacker and neither is claimed otherwise; the change removes a bundle-leak
 * path without removing a defence.
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
  const sameOriginBrowserFetch = provesSameOriginFetch(headers)
  if (origin === null) {
    if (!sameOriginBrowserFetch) throw new V2Error('V2_ORIGIN_NOT_ALLOWED')
  } else if (!options.allowedOrigins.includes(origin)) {
    throw new V2Error('V2_ORIGIN_NOT_ALLOWED')
  }

  // Channel one: a proven same-origin browser fetch on an allowlisted Host. The page holds no
  // credential, so no credential can leak through the bundle it is served from.
  if (sameOriginBrowserFetch) return

  // Channel two: an explicit bearer, for callers that are not a browser and therefore cannot
  // produce the `Sec-Fetch-*` proof honestly.
  const authorization = exactHeader(headers.authorization)
  if (authorization === null || !authorization.startsWith(BEARER_PREFIX)) {
    throw new V2Error('V2_UNAUTHORIZED')
  }
  if (!constantTimeEquals(authorization.slice(BEARER_PREFIX.length), options.token)) {
    throw new V2Error('V2_UNAUTHORIZED')
  }
}
