import { randomBytes } from 'node:crypto'
import type { NextFunction, Request, Response, Router } from 'express'
import { v2ErrorBody } from './errors.js'

/**
 * The lazy `/api/v2` mount (card DL-BRIDGE-01, ADR-04).
 *
 * `server/index.ts` mounts this module and nothing else. The router — and with
 * it `better-sqlite3` — is pulled in through a dynamic `import()` on the first
 * `/api/v2` request, so the legacy API, the offline demo, and the showcase build
 * never load a native module.
 *
 * Credential boundary (#78, reviewed posture change). The browser holds NO credential. The
 * cockpit fetches `/api/v2/*` same-origin with no `Authorization` header at all, and `guard.ts`
 * authenticates it on the exact Host allowlist plus the unforgeable `Sec-Fetch-*` same-origin
 * proof. Nothing is read from `import.meta.env`, so there is no longer a delivery channel that
 * Vite could inline into a built bundle — the P1 finding this replaced.
 *
 * The bearer survives as one of two equivalent channels for callers that are not a browser. It
 * is generated per launch and deliberately NOT printed: the charter's log sink denies tokens,
 * and an unset `DEVELOPER_LENS_V2_TOKEN` therefore closes the bearer channel only — a local
 * caller can always present the same-origin fetch-metadata proof instead, exactly as the
 * paragraph below states.
 *
 * Honest security property — neither channel is a defence against a local attacker, and none is
 * claimed. A local process can set `Sec-Fetch-*` freely, just as it could previously read the
 * inlined token out of a served asset. What both channels defend is the browser drive-by
 * surface: together with the exact Host and Origin allowlists and no CORS headers anywhere, a
 * page on another origin cannot drive this API or read its responses.
 */
const SUPPLIED_TOKEN_PATTERN = /^[A-Za-z0-9._-]{32,256}$/

function resolveLaunchToken(): string {
  const supplied = process.env.DEVELOPER_LENS_V2_TOKEN
  if (supplied !== undefined && SUPPLIED_TOKEN_PATTERN.test(supplied)) return supplied

  // Never printed, written, or returned (#78): the charter's log sink denies tokens, and an
  // unreadable per-launch value is the fail-closed default for the non-browser channel.
  const generated = randomBytes(32).toString('hex')
  if (supplied !== undefined && process.env.NODE_ENV !== 'test') {
    console.warn(
      'DEVELOPER_LENS_V2_TOKEN was ignored: it must be 32-256 characters of [A-Za-z0-9._-].',
    )
  }
  return generated
}

export const V2_LAUNCH_BEARER_TOKEN = resolveLaunchToken()

export function mountV2(
  token: string = V2_LAUNCH_BEARER_TOKEN,
): (request: Request, response: Response, next: NextFunction) => void {
  let pending: Promise<Router> | null = null

  return function v2LazyMount(request, response, next) {
    pending ??= import('./router.js').then((module) => module.createV2RouterForLaunch(token))
    pending.then(
      (router) => {
        try {
          router(request, response, next)
        } catch (error) {
          next(error)
        }
      },
      () => {
        pending = null
        console.error('The Developer Lens V2 bridge could not be loaded.')
        response.setHeader('Cache-Control', 'private, no-store')
        response.status(503).json(v2ErrorBody('V2_UNAVAILABLE'))
      },
    )
  }
}
