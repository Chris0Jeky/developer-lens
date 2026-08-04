import { describe, expect, it } from 'vitest'
import { C1RetrievalValidationError, retrieveLocalC1Facts, type C1RetrievalRequest } from './localRetrieval.js'

const facts = [
  {
    fact_id: 'fact_003', evidence_id: 'ev_003', layer: 'deterministic' as const,
    feature_id: 'DL.CI.RERUN_RATIO.v1' as const, value: 0.3, unit: 'ratio' as const,
    coverage: { status: 'complete' as const, sample: 40 }, limitation_code: 'RERUN_NOT_FLAKE' as const,
  },
  {
    fact_id: 'fact_001', evidence_id: 'ev_001', layer: 'deterministic' as const,
    feature_id: 'DL.CI.RERUN_RATIO.v1' as const, value: null, unit: 'ratio' as const,
    coverage: { status: 'censored' as const, sample: 2 }, limitation_code: 'COVERAGE_INCOMPLETE' as const,
  },
  {
    fact_id: 'fact_002', evidence_id: 'ev_002', layer: 'deterministic' as const,
    feature_id: 'DL.COV.COMPLETE_RATIO.v1' as const, value: 0.8, unit: 'ratio' as const,
    coverage: { status: 'complete' as const, sample: 10 }, limitation_code: 'COVERAGE_UNITS_DIFFER' as const,
  },
]

describe('local C1 retrieval', () => {
  it('filters only controlled codes and applies fixed ordering and limit', () => {
    const request: C1RetrievalRequest = { feature_ids: ['DL.CI.RERUN_RATIO.v1'], coverage_statuses: ['complete'], limit: 8 }
    expect(retrieveLocalC1Facts([facts[0], facts[1]], request).map((fact) => fact.fact_id)).toEqual(['fact_003'])
    expect(retrieveLocalC1Facts([facts[2], facts[0], facts[1]], { limit: 2 }).map((fact) => fact.fact_id)).toEqual(['fact_001', 'fact_003'])
  })

  it('is deterministic for input permutations and returns an empty relevant set', () => {
    const request: C1RetrievalRequest = { feature_ids: ['DL.CI.RERUN_RATIO.v1'], limit: 8 }
    const first = retrieveLocalC1Facts(facts, request)
    const second = retrieveLocalC1Facts([...facts].reverse(), request)
    expect(second).toEqual(first)
    expect(retrieveLocalC1Facts(facts, { feature_ids: ['DL.OWN.COVERAGE_RATIO.v1'], limit: 8 })).toEqual([])
  })

  it('rejects prose, unknown codes and oversized inputs with stable errors', () => {
    expect(() => retrieveLocalC1Facts(facts, { query: 'find private repository' } as never)).toThrowError(new C1RetrievalValidationError())
    expect(() => retrieveLocalC1Facts([{ ...facts[0], fact_id: 'fact_private_repo' }], { limit: 8 } as never)).toThrow('C1_RETRIEVAL_INVALID')
    expect(() => retrieveLocalC1Facts(facts, { feature_ids: ['UNKNOWN'], limit: 8 } as never)).toThrow('C1_RETRIEVAL_INVALID')
    expect(() => retrieveLocalC1Facts([facts[0], { ...facts[1], fact_id: facts[0].fact_id }], { limit: 8 })).toThrow('C1_RETRIEVAL_INVALID')
    expect(() => retrieveLocalC1Facts([facts[0], { ...facts[1], evidence_id: facts[0].evidence_id }], { limit: 8 })).toThrow('C1_RETRIEVAL_INVALID')
    expect(() => retrieveLocalC1Facts([...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts, ...facts], { limit: 8 })).toThrow('C1_RETRIEVAL_INVALID')
  })
})
