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
 * Bearer delivery: the token is generated once per launch and printed on the
 * local launch banner (out-of-band, never in a URL). A dev session that wants
 * the Coverage Cockpit to reach the API sets the same value as
 * `DEVELOPER_LENS_V2_TOKEN` (server) and `VITE_DEVELOPER_LENS_V2_TOKEN` (Vite),
 * which is the existing `.env` / `import.meta.env` channel the dev UI already
 * uses for `VITE_STATIC_DEMO`. With no token configured the cockpit renders an
 * explicit unauthorized state — the surface fails closed, never open.
 */
const SUPPLIED_TOKEN_PATTERN = /^[A-Za-z0-9._-]{32,256}$/

function resolveLaunchToken(): string {
  const supplied = process.env.DEVELOPER_LENS_V2_TOKEN
  if (supplied !== undefined && SUPPLIED_TOKEN_PATTERN.test(supplied)) return supplied

  const generated = randomBytes(32).toString('hex')
  if (process.env.NODE_ENV !== 'test') {
    if (supplied !== undefined) {
      console.warn(
        'DEVELOPER_LENS_V2_TOKEN was ignored: it must be 32-256 characters of [A-Za-z0-9._-].',
      )
    }
    console.log(`Developer Lens V2 bridge bearer (this launch only): ${generated}`)
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
