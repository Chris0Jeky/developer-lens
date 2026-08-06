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
  })

  it('parses a strict week-labelled envelope and refuses scope aliases', () => {
    const window = {
      weekLabels: { start: '2026-W27', end: '2026-W31' },
      eligible: 0, excluded: 0, censored: 0, competing: 0, missingSizeExcluded: 0, strata: [],
    }
    const envelope = {
      presentationContractVersion: '1.0.0', mode: 'selected_store', scopeId: 'scope-a', capabilityId: 'github.core', consentRevision: 'consent-v3',
      current: window, baseline: window,
      sensitivity: { primary: 'additions_plus_deletions', variant: 'changed_files', current: window, baseline: window },
      provenance: {
        current: { facts: { table: 'pull_request_fact', rowCount: 0, jobProvenance: 'unavailable_current_schema' }, coverage: { status: 'complete', expectedUnits: 0, observedUnits: 0, omittedUnits: 0 }, job: { status: 'complete', capabilityId: 'github.core', consentRevision: 'consent-v3' }, snapshot: { status: 'closed' } },
        baseline: { facts: { table: 'pull_request_fact', rowCount: 0, jobProvenance: 'unavailable_current_schema' }, coverage: { status: 'complete', expectedUnits: 0, observedUnits: 0, omittedUnits: 0 }, job: { status: 'complete', capabilityId: 'github.core', consentRevision: 'consent-v3' }, snapshot: { status: 'closed' } },
      },
      factProvenanceLimitation: 'pull_request_fact_has_no_job_provenance',
    }
    expect(parseChangeBatchIntegrationTailPresentation(envelope).scopeId).toBe('scope-a')
    expect(() => ChangeBatchIntegrationTailPresentationSchema.parse({ ...envelope, scopeAlias: 'private-alias' })).toThrow()
  })
})
