import { describe, expect, it } from 'vitest'
import { buildSyntheticV3StoredObservation } from '../server/analysis/syntheticV3StoredObservation.js'
import { buildV3StoredObservationEvidence } from '../server/analysis/v3StoredObservationEvidence.js'
import { analyticReferenceId } from './findings.js'
import { buildIntegrationShapePresentation } from './integrationShape.js'
import {
  INTEGRATION_SHAPE_REFERENCES,
  resolveIntegrationShapeEvidence,
} from './integrationShapeEvidence.js'
import {
  INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION,
  parseIntegrationShapePresentationEnvelope,
} from './integrationShapeStoredPresentation.js'

function syntheticEnvelope() {
  const presentation = buildIntegrationShapePresentation()
  const stored = buildSyntheticV3StoredObservation()
  const storedEvidence = buildV3StoredObservationEvidence(stored.envelope, stored.finding)
  return {
    presentationContractVersion: INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION,
    mode: 'synthetic' as const,
    presentation,
    storedObservation: {
      status: 'complete' as const,
      presentation: stored.envelope,
      finding: stored.finding,
    },
    resolutions: {
      ...Object.fromEntries(INTEGRATION_SHAPE_REFERENCES.map((reference) => [
        analyticReferenceId(reference),
        resolveIntegrationShapeEvidence(reference),
      ])),
      ...storedEvidence.resolutions,
    },
  }
}

describe('stored Integration Shape presentation envelope', () => {
  it('accepts the explicit synthetic bundle and proves every rendered reference is answered', () => {
    const parsed = parseIntegrationShapePresentationEnvelope(syntheticEnvelope())
    expect(parsed.mode).toBe('synthetic')
    expect(parsed.storedObservation.status).toBe('complete')
    expect(Object.keys(parsed.resolutions).length).toBeGreaterThan(10)
  })

  it('rejects a missing or mismatched evidence walk instead of serving an unsupported mark', () => {
    const envelope = syntheticEnvelope()
    const reference = envelope.storedObservation.finding.marks[0].reference
    const id = analyticReferenceId(reference)
    const { [id]: _removed, ...withoutOne } = envelope.resolutions
    expect(() => parseIntegrationShapePresentationEnvelope({ ...envelope, resolutions: withoutOne })).toThrow()
    expect(() => parseIntegrationShapePresentationEnvelope({
      ...envelope,
      resolutions: { ...envelope.resolutions, [id]: resolveIntegrationShapeEvidence(INTEGRATION_SHAPE_REFERENCES[0]) },
    })).toThrow()
  })

  it('keeps synthetic and selected-store branches structurally distinct', () => {
    const envelope = syntheticEnvelope()
    expect(() => parseIntegrationShapePresentationEnvelope({
      ...envelope,
      mode: 'selected_store',
    })).toThrow()
    expect(() => parseIntegrationShapePresentationEnvelope({
      ...envelope,
      storePath: 'forbidden',
    })).toThrow()
    expect(() => parseIntegrationShapePresentationEnvelope({
      ...envelope,
      storedObservation: {
        ...envelope.storedObservation,
        presentation: { ...envelope.storedObservation.presentation, scopeId: 'private/repository' },
      },
    })).toThrow()
  })
})
