import type { NextFunction, Request, Response } from 'express'
import { resolveV2RuntimeConfig } from './api/v2/config.js'
import { V2Error, v2ErrorBody } from './api/v2/errors.js'
import { assertV2Request } from './api/v2/guard.js'
import { V2_LAUNCH_BEARER_TOKEN } from './api/v2/mount.js'

/**
 * #416: the legacy private reads (`/api/dashboard`, `/api/status`) take the exact `/api/v2`
 * Host/Origin/Fetch-Metadata boundary, so a page on another origin (DNS rebinding, foreign Host)
 * cannot read them. No new policy: same allowlists, same launch bearer, same error bodies.
 */
const config = resolveV2RuntimeConfig(V2_LAUNCH_BEARER_TOKEN)

export function legacyGuard(request: Request, response: Response, next: NextFunction): void {
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('Vary', 'Origin')
  try {
    assertV2Request(request.headers, config)
  } catch (error) {
    if (!(error instanceof V2Error)) throw error
    response.status(error.status).json(v2ErrorBody(error.code))
    return
  }
  next()
}
