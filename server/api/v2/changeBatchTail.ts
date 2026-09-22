import type express from 'express'
import {
  ChangeBatchTailGateError,
  composeStoredChangeBatchTailView,
} from '../../analysis/changeBatchTail.js'
import type { StoredObservationRequest } from '../../storage/v3ObservationBridge.js'
import type { StorageV3ReaderSelection } from '../../storage/v3ReaderSelection.js'
import { V2_API_CONTRACT_VERSION } from './contract.js'
import { V2Error } from './errors.js'

/**
 * Phase E (#174) — `GET /api/v2/lenses/change-batch-tail`.
 *
 * DEFAULT-OFF. The route answers `V2_NOT_FOUND` unless the router was built with a stored source,
 * and the launch router (`createV2RouterForLaunch`) never passes one: no activation path exists,
 * so a running local service cannot reach a stored reading. The source seam is how an invented
 * selected store (and, only after a bounded owner-gated activation task, a real one) is wired.
 *
 * With a source, every request re-runs the selected-store proof path through `select()`, reads one
 * explicit scope/window through the bridge, and serves only a view that passed every gate in
 * `server/analysis/changeBatchTail.ts`. The handle is always closed. Refusals are content-free.
 */
export interface ChangeBatchTailStoredSource {
  /** Runs `selectStorageV3Reader` (or its invented-fixture seam) and returns its selection. */
  readonly select: () => StorageV3ReaderSelection
  readonly request: StoredObservationRequest
}

export const CHANGE_BATCH_TAIL_ROUTE = '/lenses/change-batch-tail' as const

export function registerChangeBatchTailRoute(router: express.Router, source?: ChangeBatchTailStoredSource): void {
  router.get(CHANGE_BATCH_TAIL_ROUTE, (_request, response, next) => {
    if (source === undefined) {
      next(new V2Error('V2_NOT_FOUND'))
      return
    }
    let selection: StorageV3ReaderSelection | undefined
    try {
      selection = source.select()
      if (selection.reader !== 'sqlite-v3') throw new V2Error('V2_STORE_UNAVAILABLE')
      const composed = composeStoredChangeBatchTailView(selection, source.request)
      if (composed.status === 'refused') {
        throw new V2Error(composed.code === 'STORE_PROVENANCE_NOT_SYNTHETIC' ? 'V2_STORE_PROVENANCE_REFUSED' : 'V2_STORE_UNAVAILABLE')
      }
      response.json({ apiContractVersion: V2_API_CONTRACT_VERSION, view: composed.view })
    } catch (error) {
      if (error instanceof ChangeBatchTailGateError) {
        next(new V2Error('V2_RESPONSE_CONTRACT_VIOLATION'))
        return
      }
      if (error instanceof V2Error) {
        next(error)
        return
      }
      next(new V2Error('V2_STORE_UNAVAILABLE'))
    } finally {
      if (selection?.reader === 'sqlite-v3' && selection.db.open) selection.db.close()
    }
  })
}
