import { describe, expect, it } from 'vitest'
import { analyticReferenceId } from '../../shared/findings.js'
import { ChangeBatchIntegrationTailPresentationSchema } from '../../shared/changeBatchIntegrationTail.js'
import { whyResolutionAnswersReference } from '../../shared/whyContract.js'
import { buildSyntheticV3StoredObservation } from './syntheticV3StoredObservation.js'
import { buildV3StoredObservationEvidence } from './v3StoredObservationEvidence.js'

describe('stored-observation presentation evidence', () => {
  it('answers every rendered mark and observation with a contract-valid aggregate walk', () => {
    const stored = buildSyntheticV3StoredObservation()
    const evidence = buildV3StoredObservationEvidence(stored.envelope, stored.finding)
    expect(evidence.references.length).toBe(stored.finding.marks.length + stored.finding.evidence.length)
    for (const reference of evidence.references) {
      const resolution = evidence.resolve(reference)
      expect(whyResolutionAnswersReference(reference, resolution), analyticReferenceId(reference)).toBe(true)
    }
  })

  it('keeps raw storage identifiers, paths, aliases and exact operational clocks out of the bundle', () => {
    const stored = buildSyntheticV3StoredObservation()
    const evidence = buildV3StoredObservationEvidence(stored.envelope, stored.finding)
    const wire = JSON.stringify(evidence.resolutions)
    for (const forbidden of [
      'coverageId',
      'coverage_id',
      'snapshotId',
      'scopeAlias',
      'scope_alias',
      'storePath',
      'selectedArtifactId',
      'C:\\Users\\',
    ]) expect(wire).not.toContain(forbidden)
    expect(wire).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/)
  })

  it('carries retained tombstones only as content-free scope aggregates at week grain', () => {
    const stored = buildSyntheticV3StoredObservation()
    const presentation = ChangeBatchIntegrationTailPresentationSchema.parse({
      ...stored.envelope,
      deletionLineage: {
        status: 'present',
        eventCount: 2,
        events: [{ subjectKind: 'coverage', eventKind: 'tombstone_cascade', week: '2026-W31', count: 2 }],
      },
    })
    const evidence = buildV3StoredObservationEvidence(presentation, stored.finding)
    const observation = stored.finding.evidence[0]
    expect(observation?.kind).toBe('observation')
    if (observation?.kind !== 'observation') return
    const resolution = evidence.resolve(observation)
    expect(resolution.kind).toBe('evidence')
    if (resolution.kind === 'evidence') {
      expect(resolution.lineage).toEqual([{
        kind: 'lineage_event',
        subjectId: presentation.scopeId,
        eventKind: 'tombstone_cascade:coverage:count-2',
        causedBy: null,
        occurredAt: '2026-W31',
      }])
    }
  })
})
