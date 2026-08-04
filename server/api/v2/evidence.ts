import type express from 'express'
import { z } from 'zod'
import {
  INTEGRATION_SHAPE_ANALYSIS_VERSION,
  INTEGRATION_SHAPE_FINDING,
  INTEGRATION_SHAPE_REFERENCES,
  PresentationLeakError,
  assertPresentationSafe,
  resolveIntegrationShapeEvidenceSafe,
} from '../../analysis/integrationShape.js'
import type { AnalyticReference } from '../../../shared/findings.js'
import { V2_API_CONTRACT_VERSION } from './contract.js'
import { V2Error } from './errors.js'

/**
 * DL-VALUE-01's minimal evidence endpoint (the card ships this when BRIDGE-02 is absent). It is the
 * live-product counterpart of the offline drawer resolver: it serves the validated finding and the
 * per-reference evidence-walk projection, and nothing else. It is deliberately native-dependency
 * free — it never imports `store.ts` / `better-sqlite3` — and every response is proven
 * presentation-safe (#79/#86: no canonical record, no scope alias, no `coverage_id`) before it is
 * sent, with a leak becoming a `V2_RESPONSE_CONTRACT_VIOLATION` rather than a served byte.
 *
 * The guard middleware (`assertV2Request`: per-launch bearer + exact Host allowlist + same-origin
 * fetch-metadata) is applied by `createV2Router` before these routes run, so they inherit it.
 */

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/

const EvidenceQuerySchema = z
  .object({
    kind: z.enum(['claim', 'observation']),
    id: z.string().regex(OPAQUE_ID),
  })
  .strict()

function toReference(query: z.infer<typeof EvidenceQuerySchema>): AnalyticReference {
  return query.kind === 'observation'
    ? { kind: 'observation', evidenceId: query.id }
    : { kind: 'claim', claimId: query.id, claimLayer: 'deterministic' }
}

function send(response: express.Response, body: unknown, label: string): void {
  try {
    assertPresentationSafe(body, label)
  } catch (error) {
    if (error instanceof PresentationLeakError) throw new V2Error('V2_RESPONSE_CONTRACT_VIOLATION')
    throw error
  }
  response.json(body)
}

/**
 * Registers the evidence routes onto an already-guarded V2 router:
 *   GET /evidence/finding              — the validated finding plus its rendered references
 *   GET /evidence/resolve?kind&id      — the evidence-walk projection for one reference
 */
export function registerEvidenceRoutes(router: express.Router): void {
  router.get('/evidence/finding', (_request, response, next) => {
    try {
      send(
        response,
        {
          apiContractVersion: V2_API_CONTRACT_VERSION,
          analysisVersion: INTEGRATION_SHAPE_ANALYSIS_VERSION,
          finding: INTEGRATION_SHAPE_FINDING,
          references: INTEGRATION_SHAPE_REFERENCES,
        },
        'evidence finding response',
      )
    } catch (error) {
      next(error)
    }
  })

  router.get('/evidence/resolve', (request, response, next) => {
    try {
      const parsed = EvidenceQuerySchema.safeParse(request.query)
      if (!parsed.success) throw new V2Error('V2_NOT_FOUND')
      const reference = toReference(parsed.data)
      send(
        response,
        {
          apiContractVersion: V2_API_CONTRACT_VERSION,
          analysisVersion: INTEGRATION_SHAPE_ANALYSIS_VERSION,
          reference,
          projection: resolveIntegrationShapeEvidenceSafe(reference),
        },
        'evidence resolve response',
      )
    } catch (error) {
      next(error)
    }
  })
}
