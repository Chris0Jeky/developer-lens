import type Database from 'better-sqlite3'
import type express from 'express'
import { analyticReferenceId, type AnalyticReference } from '../../../shared/findings.js'
import {
  INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION,
  parseIntegrationShapePresentationEnvelope,
  type IntegrationShapePresentationEnvelope,
} from '../../../shared/integrationShapeStoredPresentation.js'
import type { IntegrationShapeEvidenceResolution } from '../../../shared/integrationShapeEvidence.js'
import { PresentationLeakError, assertPresentationSafe } from '../../analysis/integrationShape.js'
import {
  bridgeV3StoredObservation,
  type V3StoredObservationBridgeInput,
  type V3StoredObservationBridgeResult,
} from '../../analysis/v3StoredObservationBridge.js'
import { buildV3StoredObservationEvidence } from '../../analysis/v3StoredObservationEvidence.js'
import { openSelectedStorageV3StoreReadonly } from '../../storage/v3StoreFiles.js'
import type { PhaseEStoredAnalysisConfig } from './config.js'
import type { V2EvidenceSnapshot, V2EvidenceSource } from './evidence.js'
import { V2Error } from './errors.js'

export interface SelectedStoredObservationSnapshot {
  readonly envelope: IntegrationShapePresentationEnvelope
  readonly evidence: V2EvidenceSnapshot
}

export interface SelectedStoredObservationSource {
  readonly load: () => SelectedStoredObservationSnapshot
  readonly evidenceSource: V2EvidenceSource
}

type StoreOpener = (directory: string) => Database.Database
type Analyzer = (input: V3StoredObservationBridgeInput) => V3StoredObservationBridgeResult

function unavailableResolution(reference: AnalyticReference): IntegrationShapeEvidenceResolution {
  return reference.kind === 'claim'
    ? {
        kind: 'unresolvable',
        resolverVersion: '1.0.0',
        reason: 'STORAGE_UNAVAILABLE',
        claimId: reference.claimId,
        lineage: [],
      }
    : {
        kind: 'missing_link',
        reason: 'MISSING_EVIDENCE',
        targetKind: 'evidence',
        targetId: reference.evidenceId,
        coverageKey: null,
        lineage: [],
      }
}

function safeEnvelope(candidate: unknown): IntegrationShapePresentationEnvelope {
  const envelope = parseIntegrationShapePresentationEnvelope(candidate)
  try {
    assertPresentationSafe(envelope, 'selected stored-observation presentation')
  } catch (error) {
    if (error instanceof PresentationLeakError) throw new V2Error('V2_RESPONSE_CONTRACT_VIOLATION')
    throw error
  }
  return envelope
}

/**
 * One freshly proved snapshot per request. Opening is by the accepted storage-v3 ROOT only; the
 * opener re-proves the selected artefact before returning a read-only handle. No process-lifetime
 * cache may outlive revocation, retention deletion, or a newly selected artefact. Presentation and
 * Evidence Drawer data are still composed together from the same read-only handle. All driver/path
 * failures collapse to one content-free error.
 */
export function createSelectedStoredObservationSource(
  config: PhaseEStoredAnalysisConfig,
  openStore: StoreOpener = openSelectedStorageV3StoreReadonly,
  analyze: Analyzer = bridgeV3StoredObservation,
): SelectedStoredObservationSource {
  const load = (): SelectedStoredObservationSnapshot => {
    let db: Database.Database | undefined
    try {
      db = openStore(config.selectedStoreDirectory)
      const result = analyze({
        db,
        scopeId: config.scopeId,
        capabilityId: 'github.core',
        consentRevision: config.consentRevision,
        baselineWindow: config.baselineWindow,
        currentWindow: config.currentWindow,
        asOf: config.asOf,
      })
      if (result.status === 'complete') {
        const evidence = buildV3StoredObservationEvidence(result.envelope, result.finding)
        return {
          envelope: safeEnvelope({
            presentationContractVersion: INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION,
            mode: 'selected_store',
            presentation: null,
            storedObservation: {
              status: 'complete',
              presentation: result.envelope,
              finding: result.finding,
            },
            resolutions: evidence.resolutions,
          }),
          evidence,
        }
      } else {
        const evidence: V2EvidenceSnapshot = {
          finding: result.finding,
          references: [],
          resolve: unavailableResolution,
        }
        return {
          envelope: safeEnvelope({
            presentationContractVersion: INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION,
            mode: 'selected_store',
            presentation: null,
            storedObservation: {
              status: 'abstained',
              code: result.code,
              finding: result.finding,
              deletionLineage: result.deletionLineage,
            },
            resolutions: {},
          }),
          evidence,
        }
      }
    } catch (error) {
      if (error instanceof V2Error) throw error
      throw new V2Error('V2_STORE_UNAVAILABLE')
    } finally {
      if (db?.open) db.close()
    }
  }

  return {
    load,
    evidenceSource: () => load().evidence,
  }
}

export function registerIntegrationShapeRoute(
  router: express.Router,
  source: Pick<SelectedStoredObservationSource, 'load'>,
): void {
  router.get('/analysis/integration-shape', (_request, response, next) => {
    try {
      response.json(source.load().envelope)
    } catch (error) {
      next(error)
    }
  })
}

/** Exact references exported for route tests without exposing storage identifiers. */
export function selectedStoredObservationReferenceIds(snapshot: SelectedStoredObservationSnapshot): string[] {
  return snapshot.evidence.references.map(analyticReferenceId)
}
