import { describe, expect, it } from 'vitest'
import {
  INTEGRATION_SHAPE_ABSTENTION_FINDING,
  INTEGRATION_SHAPE_FINDING,
  INTEGRATION_SHAPE_REFERENCES,
  INTEGRATION_SHAPE_WALK,
  PresentationLeakError,
  assertPresentationSafe,
  composeIntegrationShapePresentation,
  integrationShapeConformsToGolden,
  resolveIntegrationShapeEvidenceSafe,
} from './integrationShape.js'
import { assertRenderableFinding, buildFindingReferenceWalk } from '../../shared/findings.js'
import { INTEGRATION_SHAPE_SCOPE_ALIAS } from '../../shared/integrationShape.js'
import { CLAIM_IDS, EVIDENCE_IDS } from '../../shared/integrationShape.js'

/**
 * DL-VALUE-01 — the walkthrough proof. Walks the finding from question to evidence lineage,
 * asserting each stage's derived/validated content. This is the demo evidence the ledger cites.
 */

describe('integration-shape walkthrough — the finding is contract-valid and renderable', () => {
  it('validates and is renderable on the Atlas surface', () => {
    expect(() => assertRenderableFinding(INTEGRATION_SHAPE_FINDING, 'atlas')).not.toThrow()
    expect(INTEGRATION_SHAPE_FINDING.layer).toBe('deterministic')
    expect(INTEGRATION_SHAPE_FINDING.statementCode).toBe('DELIVERY_FLOW')
    expect(INTEGRATION_SHAPE_FINDING.presentationEligibility.reasonCode).toBe('PRESENTABLE')
  })

  it('the composition conforms to its golden and re-validates on demand', () => {
    expect(integrationShapeConformsToGolden()).toBe(true)
    expect(() => composeIntegrationShapePresentation()).not.toThrow()
  })

  it('names exactly one primary metric result and summarises it', () => {
    const primary = INTEGRATION_SHAPE_FINDING.metricResults.filter((reference) => reference.role === 'primary')
    expect(primary).toHaveLength(1)
    expect(INTEGRATION_SHAPE_FINDING.sampleSummary.resultId).toBe(primary[0].resultId)
  })
})

describe('integration-shape walkthrough — every derived number reads as a claim, raw facts as observations', () => {
  it('the reference walk visits result provenance, then marks (claims), then evidence and counter-evidence', () => {
    const walk = buildFindingReferenceWalk(INTEGRATION_SHAPE_FINDING)
    expect(walk).toEqual(INTEGRATION_SHAPE_WALK)

    const marks = walk.filter((entry) => entry.role === 'mark')
    // Every rendered mark is a DERIVED number and resolves through a deterministic claim, never an observation.
    expect(marks.length).toBeGreaterThanOrEqual(6)
    for (const mark of marks) {
      expect(mark.referenceKind).toBe('claim')
      expect(mark.claimLayer).toBe('deterministic')
    }

    const evidence = walk.filter((entry) => entry.role === 'evidence')
    expect(evidence.length).toBeGreaterThanOrEqual(1)
    for (const entry of evidence) expect(entry.referenceKind).toBe('observation')

    const counter = walk.filter((entry) => entry.role === 'counter_evidence')
    expect(counter).toHaveLength(1)
    expect(counter[0].referenceKind).toBe('observation')
  })
})

describe('integration-shape walkthrough — the evidence lineage resolves end to end', () => {
  it('resolves the primary distribution claim to a full walk: supports, contradicts, coverage, job, capability', () => {
    const tree = resolveIntegrationShapeEvidenceSafe({ kind: 'claim', claimId: CLAIM_IDS.p50, claimLayer: 'deterministic' })
    expect(tree.kind).toBe('explanation')
    if (tree.kind !== 'explanation') return

    // The claim header carries the content-free scope surrogate, never the alias.
    expect(tree.claim.scopeId.startsWith('scope-')).toBe(true)
    expect(tree.claim.scopeId).not.toBe(INTEGRATION_SHAPE_SCOPE_ALIAS)

    const supports = tree.edges.find((group) => group.role === 'supports')
    const contradicts = tree.edges.find((group) => group.role === 'contradicts')
    expect(supports?.edges.length).toBeGreaterThanOrEqual(1)
    expect(contradicts?.edges.length).toBe(1)

    // Walk one supporting edge to its coverage, job and capability terminus.
    const support = supports?.edges[0]
    expect(support?.target.kind).toBe('evidence')
    if (support?.target.kind === 'evidence' && support.target.coverage.kind === 'coverage') {
      const coverage = support.target.coverage
      expect(coverage.coverageKey).toHaveProperty('rangeStart')
      expect(coverage.coverageKey).toHaveProperty('jobId')
      if (coverage.job.kind === 'collection_job') {
        expect(coverage.job.consentRevision).toBe('consent-2026-06-01')
        expect(coverage.job.capability.kind).toBe('capability')
        if (coverage.job.capability.kind === 'capability') {
          expect(coverage.job.capability.capabilityId).toBe('github.core')
        }
      }
    }

    // Derivation ancestry reaches the baseline-window claim.
    expect(tree.ancestry.steps.map((step) => step.claimId)).toContain(CLAIM_IDS.baseline)
    // The limitations the finding discloses are present on the claim.
    expect(tree.limitations.map((limitation) => limitation.limitationCode)).toContain('COVERAGE_UNITS_DIFFER')
  })

  it('resolves an observation reference to its evidence anchor', () => {
    const node = resolveIntegrationShapeEvidenceSafe({ kind: 'observation', evidenceId: EVIDENCE_IDS.openTailCurrent })
    expect(node.kind).toBe('evidence')
    if (node.kind === 'evidence') expect(node.evidenceId).toBe(EVIDENCE_IDS.openTailCurrent)
  })

  it('resolves an unknown reference to honest furniture, never a partial tree', () => {
    const unknownClaim = resolveIntegrationShapeEvidenceSafe({ kind: 'claim', claimId: 'cl_not_here', claimLayer: 'deterministic' })
    expect(unknownClaim.kind).toBe('unresolvable')
    const unknownObs = resolveIntegrationShapeEvidenceSafe({ kind: 'observation', evidenceId: 'ev_not_here' })
    expect(unknownObs.kind).toBe('missing_link')
  })

  it('resolves every reference the finding renders', () => {
    for (const reference of INTEGRATION_SHAPE_REFERENCES) {
      const resolution = resolveIntegrationShapeEvidenceSafe(reference)
      expect(['explanation', 'evidence']).toContain(resolution.kind)
    }
  })
})

describe('integration-shape walkthrough — abstention is honest', () => {
  it('the low-support finding abstains and presents as an abstention', () => {
    expect(INTEGRATION_SHAPE_ABSTENTION_FINDING.layer).toBe('abstention')
    expect(INTEGRATION_SHAPE_ABSTENTION_FINDING.presentationEligibility.reasonCode).toBe('PRESENTABLE_AS_ABSTENTION')
    expect(INTEGRATION_SHAPE_ABSTENTION_FINDING.marks).toHaveLength(0)
    expect(INTEGRATION_SHAPE_ABSTENTION_FINDING.abstention?.limitingReason).toBe('SAMPLE_BELOW_MINIMUM')
  })
})

describe('integration-shape walkthrough — presentation safety (#79 / #86)', () => {
  it('the finding and every projection are free of the alias value and of any coverage_id field', () => {
    assertPresentationSafe(INTEGRATION_SHAPE_FINDING, 'finding')
    for (const reference of INTEGRATION_SHAPE_REFERENCES) {
      expect(() => resolveIntegrationShapeEvidenceSafe(reference)).not.toThrow()
    }
  })

  it('the leak guard throws on a value carrying the alias or a coverage_id', () => {
    expect(() => assertPresentationSafe({ scope: INTEGRATION_SHAPE_SCOPE_ALIAS }, 'probe')).toThrow(PresentationLeakError)
    expect(() => assertPresentationSafe({ coverageId: 'github.core:scope:x' }, 'probe')).toThrow(PresentationLeakError)
    expect(() => assertPresentationSafe({ coverage_id: 'x' }, 'probe')).toThrow(PresentationLeakError)
  })
})
