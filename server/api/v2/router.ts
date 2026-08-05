import express from 'express'
import { z } from 'zod'
import { CAPABILITY_CONTRACT_VERSION } from '../../../shared/capabilities.js'
import { COVERAGE_CONTRACT_VERSION } from '../../../shared/coverage.js'
import { resolveV2RuntimeConfig, type V2RuntimeConfig } from './config.js'
import { PresentationLeakError, assertPresentationSafe } from '../../analysis/integrationShape.js'
import {
  buildCapabilityViews,
  buildCoveragePresentationViews,
  V2_API_CONTRACT_VERSION,
  V2CapabilitiesResponseSchema,
  V2CoverageRecordSchema,
  V2CoverageResponseSchema,
} from './contract.js'
import { V2Error, v2ErrorBody } from './errors.js'
import { registerEvidenceRoutes } from './evidence.js'
import { assertV2Request } from './guard.js'
import { readSyntheticCoverageStore } from './store.js'

/**
 * The `/api/v2` bootstrap router (card DL-BRIDGE-01, ADR-04).
 *
 * This module is reached only through the lazy dynamic import in `mount.ts`, so
 * `better-sqlite3` never loads in the demo, dev-web, or showcase paths. Both
 * endpoints are read-only: `capabilities` reports registry lifecycle state and
 * performs no transition, and `coverage` serves only a synthetic-marked store.
 */
export function createV2Router(config: V2RuntimeConfig): express.Router {
  const router = express.Router()

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'private, no-store')
    response.setHeader('Vary', 'Origin')
    next()
  })

  router.use((request, _response, next) => {
    try {
      assertV2Request(request.headers, config)
      next()
    } catch (error) {
      next(error)
    }
  })

  router.get('/capabilities', (_request, response, next) => {
    try {
      const { provenance } = readSyntheticCoverageStore(config.storePath)
      const body = V2CapabilitiesResponseSchema.safeParse({
        apiContractVersion: V2_API_CONTRACT_VERSION,
        capabilityContractVersion: CAPABILITY_CONTRACT_VERSION,
        activation: 'reporting_only',
        provenance,
        capabilities: buildCapabilityViews(),
      })
      if (!body.success) throw new V2Error('V2_RESPONSE_CONTRACT_VIOLATION')
      response.json(body.data)
    } catch (error) {
      next(error)
    }
  })

  // #79: the canonical `CoverageRecord` is validated on the way IN and projected before it is
  // served. The charter's frontend sink admits a `PresentationView` only, and the canonical shape
  // would fail `assertPresentationSafe` on its `coverageId` alone — the projection is what makes
  // the response servable, not a relaxation of the check.
  router.get('/coverage', (_request, response, next) => {
    try {
      const { provenance, coverage } = readSyntheticCoverageStore(config.storePath)
      const canonical = z.array(V2CoverageRecordSchema).safeParse(coverage)
      if (!canonical.success) throw new V2Error('V2_RESPONSE_CONTRACT_VIOLATION')
      const body = V2CoverageResponseSchema.safeParse({
        apiContractVersion: V2_API_CONTRACT_VERSION,
        coverageContractVersion: COVERAGE_CONTRACT_VERSION,
        provenance,
        records: buildCoveragePresentationViews(canonical.data),
      })
      if (!body.success) throw new V2Error('V2_RESPONSE_CONTRACT_VIOLATION')
      try {
        assertPresentationSafe(body.data, 'coverage response')
      } catch (leak) {
        if (leak instanceof PresentationLeakError) throw new V2Error('V2_RESPONSE_CONTRACT_VIOLATION')
        throw leak
      }
      response.json(body.data)
    } catch (error) {
      next(error)
    }
  })

  // DL-VALUE-01: the minimal evidence endpoint. Native-dependency free and presentation-safe; it
  // inherits the guard middleware registered above.
  registerEvidenceRoutes(router)

  router.use((_request, _response, next) => {
    next(new V2Error('V2_NOT_FOUND'))
  })

  router.use((
    error: Error,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof V2Error) {
      response.status(error.status).json(v2ErrorBody(error.code))
      return
    }
    console.error('V2 bridge request failed')
    response.status(500).json(v2ErrorBody('V2_UNAVAILABLE'))
  })

  return router
}

export function createV2RouterForLaunch(token: string): express.Router {
  return createV2Router(resolveV2RuntimeConfig(token))
}
