import { describe, expect, it } from 'vitest'
import {
  C1EvidenceBundleSchema,
  C1ContractValidationError,
  ModelClaimSchema,
  ModelOutputSchema,
  parseC1EvidenceBundle,
  parseModelOutput,
  type C1EvidenceBundle,
} from './c1Contract.js'

const bundle = {
  schema_version: '1.0.0',
  bundle_id: 'req_00000000000000000000000000000001',
  range: { start: '2026-01-01T00:00:00Z', end: '2026-03-01T00:00:00Z' },
  consent_revision: 'consent-v3',
  redaction_revision: 'redaction-v2',
  budget: { max_input_tokens: 12000, max_output_tokens: 1500 },
  evidence: [{
    evidence_id: 'ev_001',
    layer: 'deterministic',
    feature_id: 'DL.CI.RERUN_RATIO.v1',
    value: 0.08,
    unit: 'ratio',
    coverage: { status: 'complete', sample: 75 },
    limitation_code: 'RERUN_NOT_FLAKE',
  }],
} as unknown as C1EvidenceBundle

const claim = {
  claim_id: 'claim_01',
  kind: 'hypothesis',
  statement_code: 'CI_RERUN_PATTERN',
  evidence_ids: ['ev_001'],
  contradicting_evidence_ids: [],
  alternative_codes: ['SEASONALITY'],
  confidence_band: 'low',
  limitation_codes: ['RERUN_NOT_FLAKE'],
} as const

describe('C1 evidence and model-output contracts', () => {
  it('accepts the architecture-shaped invented bundle and claim', () => {
    expect(parseC1EvidenceBundle(bundle).bundle_id).toBe('req_00000000000000000000000000000001')
    expect(ModelClaimSchema.safeParse(claim).success).toBe(true)
    expect(ModelOutputSchema.safeParse({ schema_version: '1.0.0', request_id: bundle.bundle_id, claims: [claim] }).success).toBe(true)
  })

  it('rejects private/prose/unknown fields, codes, bounds, and non-UTC windows', () => {
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, repository_alias: 'private-name' }).success).toBe(false)
    for (const forbiddenField of ['repository_id', 'repository_name', 'grain_id', 'title', 'body', 'comment', 'source_prose', 'c2_fact']) {
      expect(C1EvidenceBundleSchema.safeParse({ ...bundle, [forbiddenField]: 'invented-canary' }).success).toBe(false)
    }
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, evidence: [{ ...bundle.evidence[0], source_path: 'C:\\secret\\file' }] }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, evidence: [{ ...bundle.evidence[0], feature_id: 'UNKNOWN' }] }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, evidence: [{ ...bundle.evidence[0], feature_id: 'DL.ARCH.CYCLE.v1' }] }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, evidence: [{ ...bundle.evidence[0], coverage: { status: 'partial', sample: 75 } }] }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, evidence: [{ ...bundle.evidence[0], value: -0.1 }] }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, evidence: [{ ...bundle.evidence[0], limitation_code: 'LINKAGE_NOT_CAUSAL' }] }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, bundle_id: 'req_private_repository' }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, consent_revision: 'consent-private-repo' }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, evidence: [{ ...bundle.evidence[0], evidence_id: 'ev_private_repo' }] }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, range: { ...bundle.range, start: '2026-01-01T00:00:00+01:00' } }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, budget: { max_input_tokens: 12001, max_output_tokens: 1 } }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, budget: { max_input_tokens: 12000, max_output_tokens: 0 } }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, range: { start: '2023-01-01T00:00:00Z', end: '2026-01-01T00:00:00Z' } }).success).toBe(true)
    expect(C1EvidenceBundleSchema.safeParse({ ...bundle, range: { start: '2023-01-01T00:00:00Z', end: '2026-01-01T00:00:00.001Z' } }).success).toBe(false)
    const oversized = {
      ...bundle,
      evidence: Array.from({ length: 128 }, (_, index) => ({
        ...bundle.evidence[0],
        evidence_id: `ev_${String(index + 1).padStart(3, '0')}`,
      })),
    }
    expect(Buffer.byteLength(JSON.stringify(oversized), 'utf8')).toBeGreaterThan(16_000)
    expect(C1EvidenceBundleSchema.safeParse(oversized).success).toBe(false)
  })

  it('rejects impossible calendar and clock components instead of normalized dates', () => {
    for (const timestamp of [
      '2026-02-30T00:00:00Z',
      '2024-02-30T00:00:00Z',
      '2026-01-01T24:00:00Z',
    ]) {
      expect(C1EvidenceBundleSchema.safeParse({
        ...bundle,
        range: { start: timestamp, end: '2026-03-01T00:00:00Z' },
      }).success).toBe(false)
    }
  })

  it('accepts canonical UTC timestamps with supported fractional precision', () => {
    for (const start of [
      '2026-01-01T00:00:00Z',
      '2026-01-01T00:00:00.1Z',
      '2026-01-01T00:00:00.01Z',
      '2026-01-01T00:00:00.001Z',
    ]) {
      expect(C1EvidenceBundleSchema.safeParse({
        ...bundle,
        range: { start, end: '2026-03-01T00:00:00Z' },
      }).success).toBe(true)
    }
  })

  it('cross-validates request-scoped IDs and emits content-free errors', () => {
    expect(() => parseModelOutput(bundle, {
      schema_version: '1.0.0', request_id: bundle.bundle_id,
      claims: [{ ...claim, evidence_ids: ['ev_999'] }],
    })).toThrowError(new C1ContractValidationError())
    expect(() => parseModelOutput(bundle, {
      schema_version: '1.0.0', request_id: 'req_00000000000000000000000000000002', claims: [claim],
    })).toThrow('C1_CONTRACT_INVALID')
    expect(() => parseModelOutput(bundle, {
      schema_version: '1.0.0', request_id: bundle.bundle_id, claims: [{ ...claim, action: 'publish it' }],
    })).toThrow('C1_CONTRACT_INVALID')
    expect(() => parseModelOutput(bundle, {
      schema_version: '1.0.0', request_id: bundle.bundle_id,
      claims: [{ ...claim, kind: 'abstention', statement_code: 'CI_RERUN_PATTERN', confidence_band: 'low' }],
    })).toThrow('C1_CONTRACT_INVALID')
    expect(() => parseModelOutput(bundle, {
      schema_version: '1.0.0', request_id: bundle.bundle_id,
      claims: [{ ...claim, alternative_codes: ['NONE', 'SEASONALITY'] }],
    })).toThrow('C1_CONTRACT_INVALID')
    expect(() => parseModelOutput(bundle, {
      schema_version: '1.0.0', request_id: bundle.bundle_id,
      claims: [{ ...claim, statement_code: 'COVERAGE_GAP' }],
    })).toThrow('C1_CONTRACT_INVALID')
    expect(() => parseModelOutput(bundle, {
      schema_version: '1.0.0', request_id: bundle.bundle_id,
      claims: [{ ...claim, limitation_codes: ['LINKAGE_NOT_CAUSAL'] }],
    })).toThrow('C1_CONTRACT_INVALID')
    try {
      parseC1EvidenceBundle({ ...bundle, api_key: 'synthetic-secret-canary' })
    } catch (error) {
      expect(error).toBeInstanceOf(C1ContractValidationError)
      expect((error as Error).message).toBe('C1_CONTRACT_INVALID')
      expect((error as Error).message).not.toContain('synthetic-secret-canary')
    }
  })

  it('represents unusable coverage as null and accepts only a low-confidence abstention', () => {
    const unavailableBundle = {
      ...bundle,
      bundle_id: 'req_00000000000000000000000000000002',
      evidence: [{
        ...bundle.evidence[0],
        value: null,
        coverage: { status: 'restricted', sample: 0 },
        limitation_code: 'COVERAGE_RESTRICTED',
      }],
    } as unknown as C1EvidenceBundle
    const abstention = {
      ...claim,
      kind: 'abstention',
      statement_code: 'ABSTAIN_LOW_COVERAGE',
      alternative_codes: ['NONE'],
      confidence_band: 'low',
      limitation_codes: ['COVERAGE_RESTRICTED'],
    } as const

    expect(parseModelOutput(unavailableBundle, {
      schema_version: '1.0.0', request_id: unavailableBundle.bundle_id, claims: [abstention],
    }).claims[0].kind).toBe('abstention')
    expect(C1EvidenceBundleSchema.safeParse({
      ...unavailableBundle,
      evidence: [{ ...unavailableBundle.evidence[0], value: 0 }],
    }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({
      ...bundle,
      evidence: [{ ...bundle.evidence[0], value: null }],
    }).success).toBe(false)
    expect(C1EvidenceBundleSchema.safeParse({
      ...bundle,
      evidence: [{
        ...bundle.evidence[0], value: 0.08, coverage: { status: 'complete', sample: 19 }, limitation_code: 'SAMPLE_TOO_SMALL',
      }],
    }).success).toBe(false)
    expect(() => parseModelOutput(unavailableBundle, {
      schema_version: '1.0.0', request_id: unavailableBundle.bundle_id,
      claims: [{ ...claim, limitation_codes: ['COVERAGE_RESTRICTED'] }],
    })).toThrow('C1_CONTRACT_INVALID')
    expect(() => parseModelOutput(bundle, {
      schema_version: '1.0.0', request_id: bundle.bundle_id,
      claims: [{ ...abstention, limitation_codes: ['RERUN_NOT_FLAKE'] }],
    })).toThrow('C1_CONTRACT_INVALID')
  })
})
