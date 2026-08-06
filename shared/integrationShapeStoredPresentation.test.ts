import { describe, expect, it } from 'vitest'
import { buildIntegrationShapePresentation } from './integrationShape.js'
import { resolveIntegrationShapeEvidence } from './integrationShapeEvidence.js'
import {
  INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION,
  parseIntegrationShapePresentationEnvelope,
} from './integrationShapeStoredPresentation.js'

describe('stored Integration Shape presentation envelope', () => {
  it('accepts an explicit synthetic bundle with contract-valid evidence furniture', () => {
    const presentation = buildIntegrationShapePresentation()
    const reference = presentation.finding.marks[0]?.reference
    expect(reference).toBeDefined()
    if (!reference) return

    const parsed = parseIntegrationShapePresentationEnvelope({
      presentationContractVersion: INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION,
      mode: 'synthetic',
      presentation,
      resolutions: {
        [reference.kind === 'claim' ? reference.claimId : reference.evidenceId]:
          resolveIntegrationShapeEvidence(reference),
      },
    })

    expect(parsed.mode).toBe('synthetic')
  })

  it('rejects unknown transport fields and malformed nested presentations', () => {
    const presentation = buildIntegrationShapePresentation()
    expect(() =>
      parseIntegrationShapePresentationEnvelope({
        presentationContractVersion: INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION,
        mode: 'selected_store',
        presentation: { ...presentation, scopeAliasIsStripped: false },
        resolutions: {},
      }),
    ).toThrow()
    expect(() =>
      parseIntegrationShapePresentationEnvelope({
        presentationContractVersion: INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION,
        mode: 'selected_store',
        presentation,
        resolutions: {},
        storePath: 'forbidden',
      }),
    ).toThrow()
  })
})
