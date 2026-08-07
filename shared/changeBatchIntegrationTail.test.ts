import { describe, expect, it } from 'vitest'
import {
  ChangeBatchIntegrationTailPresentationSchema,
  parseChangeBatchIntegrationTailPresentation,
  partitionChangeBatchValueThirds,
} from './changeBatchIntegrationTail.js'

describe('change-batch/integration-tail contract', () => {
  it('keeps equal change values together when assigning thirds', () => {
    const groups = partitionChangeBatchValueThirds([
      { value: 1, rows: ['a', 'b'] },
      { value: 2, rows: ['c', 'd', 'e'] },
      { value: 3, rows: ['f', 'g'] },
      { value: 4, rows: ['h', 'i', 'j'] },
    ])
    expect(groups.lower).toEqual(expect.arrayContaining(['a', 'b']))
    expect(groups.middle).toEqual(expect.arrayContaining(['c', 'd', 'e']))
    expect(groups.upper).toEqual(expect.arrayContaining(['h', 'i', 'j']))
    expect(Object.values(groups).flat()).toHaveLength(10)
    expect(new Set(groups.lower).has('c')).toBe(false)
    expect(new Set(groups.middle).has('f')).toBe(new Set(groups.middle).has('g'))

    const duplicateGroups = partitionChangeBatchValueThirds([
      { value: 1, rows: ['left-a', 'left-b', 'left-c'] },
      { value: 1, rows: ['left-d', 'left-e', 'left-f'] },
      { value: 2, rows: ['right-a', 'right-b', 'right-c'] },
    ])
    expect(Object.values(duplicateGroups).filter((rows) => rows.includes('left-a'))[0])
      .toEqual(expect.arrayContaining(['left-a', 'left-b', 'left-c', 'left-d', 'left-e', 'left-f']))
  })

  it('parses a strict week-labelled envelope and refuses scope aliases', () => {
    const emptyStratum = (stratum: 'lower' | 'middle' | 'upper') => ({
      stratum,
      minChange: null,
      maxChange: null,
      n: 0,
      excluded: 0,
      censored: 0,
      competing: 0,
      missingSizeExcluded: 0,
      tiesKeptTogether: true,
      integrationTail: { sampleSize: 0, quantiles: null },
    })
    const window = {
      weekLabels: { start: '2026-W27', end: '2026-W31' },
      eligible: 0, excluded: 0, censored: 0, competing: 0, missingSizeExcluded: 0,
      strata: [emptyStratum('lower'), emptyStratum('middle'), emptyStratum('upper')],
    }
    const envelope = {
      presentationContractVersion: '1.0.0', mode: 'selected_store', scopeId: `scope-${'a'.repeat(64)}`, capabilityId: 'github.core', consentRevision: 'consent-v3',
      current: window, baseline: window,
      sensitivity: { primary: 'additions_plus_deletions', variant: 'changed_files', current: window, baseline: window },
      deletionLineage: { status: 'none_recorded', eventCount: 0, events: [] },
      provenance: {
        current: { facts: { table: 'pull_request_fact', rowCount: 0, jobProvenance: 'unavailable_current_schema' }, coverage: { status: 'complete', expectedUnits: 0, observedUnits: 0, omittedUnits: 0 }, job: { status: 'complete', capabilityId: 'github.core', consentRevision: 'consent-v3' }, snapshot: { status: 'closed' } },
        baseline: { facts: { table: 'pull_request_fact', rowCount: 0, jobProvenance: 'unavailable_current_schema' }, coverage: { status: 'complete', expectedUnits: 0, observedUnits: 0, omittedUnits: 0 }, job: { status: 'complete', capabilityId: 'github.core', consentRevision: 'consent-v3' }, snapshot: { status: 'closed' } },
      },
      factProvenanceLimitation: 'pull_request_fact_has_no_job_provenance',
    }
    expect(parseChangeBatchIntegrationTailPresentation(envelope).scopeId).toBe(`scope-${'a'.repeat(64)}`)
    expect(() => ChangeBatchIntegrationTailPresentationSchema.parse({ ...envelope, scopeAlias: 'private-alias' })).toThrow()
    expect(() => ChangeBatchIntegrationTailPresentationSchema.parse({ ...envelope, scopeId: 'private/repository' })).toThrow()
    expect(() => ChangeBatchIntegrationTailPresentationSchema.parse({
      ...envelope,
      current: { ...window, strata: [emptyStratum('lower'), emptyStratum('lower'), emptyStratum('upper')] },
    })).toThrow(/lower, middle, and upper/)
    expect(() => ChangeBatchIntegrationTailPresentationSchema.parse({
      ...envelope,
      current: {
        ...window,
        strata: [
          {
            ...emptyStratum('lower'),
            n: 1,
            integrationTail: { sampleSize: 1, quantiles: [] },
          },
          emptyStratum('middle'),
          emptyStratum('upper'),
        ],
      },
    })).toThrow(/p50, p75, and p90/)
  })
})
