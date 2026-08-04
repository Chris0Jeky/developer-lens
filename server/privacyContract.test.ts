import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { CAPABILITY_IDS, CAPABILITY_REGISTRY, getCapabilityDefinition } from '../shared/capabilities.js'
import { COVERAGE_STATUSES, CoverageRecordSchema, completeObservedUnits } from '../shared/coverage.js'
import {
  CANONICAL_ENVELOPE_SCHEMA_VERSION,
  EvidenceTimesSchema,
  SourceProvenanceSchema,
  buildCanonicalEnvelope,
} from '../shared/provenance.js'
import {
  NON_PUBLIC_PRIVACY_SINKS,
  PRIVACY_SINKS,
  payloadForSink,
  registerPayload,
  registerPublicPayload,
  serializeForSink,
} from '../shared/privacy.js'

const canaries = {
  token: 'P1_CANARY_TOKEN_9e3b',
  key: 'P1_CANARY_KEY_7a2d',
  windowsPath: 'C:\\P1_CANARY\\private',
  posixPath: '/P1_CANARY/private',
  identity: 'P1_CANARY_IDENTITY',
  repository: 'P1_CANARY_REPOSITORY',
  title: 'P1_CANARY_TITLE',
  label: 'P1_CANARY_LABEL',
  body: 'P1_CANARY_BODY',
  review: 'P1_CANARY_REVIEW',
  subject: 'P1_CANARY_SUBJECT',
  workflow: 'P1_CANARY_WORKFLOW',
  job: 'P1_CANARY_JOB',
  step: 'P1_CANARY_STEP',
  artifact: 'P1_CANARY_ARTIFACT',
  cache: 'P1_CANARY_CACHE',
  dependency: 'P1_CANARY_DEPENDENCY',
  source: 'P1_CANARY_SOURCE',
  symbol: 'P1_CANARY_SYMBOL',
  import: 'P1_CANARY_IMPORT',
  security: 'P1_CANARY_SECURITY',
} as const

const canarySchema = z.object(
  Object.fromEntries(Object.keys(canaries).map((key) => [key, z.string()])) as Record<keyof typeof canaries, z.ZodString>,
)
const canaryPayload = registerPayload('repository_observed.v1', canarySchema, Object.fromEntries(
  Object.keys(canaries).map((key) => [key, 'X']),
) as { [K in keyof typeof canaries]: 'X' }, NON_PUBLIC_PRIVACY_SINKS)

const aggregatePayload = registerPayload(
  'pull_request_fact.v1',
  z.object({ count: z.number().int().nonnegative(), state: z.enum(['open', 'closed']) }),
  { count: 'C1', state: 'C1' },
  ['persistence', 'log', 'api', 'frontend', 'export', 'model'],
)

const exportOnlyPayload = registerPayload(
  'release_fact.v1',
  z.object({ count: z.number().int().nonnegative() }),
  { count: 'C1' },
  ['export'],
)

const syntheticPayload = registerPublicPayload(
  'public_showcase.v1',
  z.object({ demoCount: z.number().int().nonnegative() }),
  { demoCount: 'C0' },
)

describe('P1 privacy contract', () => {
  it('keeps the documented 13 capabilities registered but never authorized', () => {
    expect(CAPABILITY_REGISTRY).toHaveLength(13)
    expect(CAPABILITY_REGISTRY.map((capability) => capability.id)).toEqual([...CAPABILITY_IDS])
    expect(CAPABILITY_REGISTRY.every((capability) => capability.authorization === 'never_authorized')).toBe(true)
    expect(CAPABILITY_REGISTRY.every((capability) => capability.requiredGates.includes('G2'))).toBe(true)
    expect(getCapabilityDefinition('cap.external.model')).toMatchObject({
      authorization: 'never_authorized',
      requiredGates: ['G2', 'G4'],
      retentionCode: 'OPENAI_STORE_FALSE_DEFAULT_30D',
      deletionCode: 'DELETE_LOCAL_MODEL_DESCENDANTS',
    })
    expect(() => getCapabilityDefinition('unknown.capability')).toThrow()
  })

  it('uses the exact coverage union and preserves missing states instead of zero-filling', () => {
    expect(COVERAGE_STATUSES).toEqual([
      'never_authorized', 'refused', 'unavailable', 'restricted', 'truncated',
      'stale', 'failed', 'deleted', 'censored', 'complete',
    ])
    const refused = CoverageRecordSchema.parse({
      coverageId: 'cov-1', capabilityId: 'github.core', scopeAlias: 'scope-1',
      rangeStart: '2026-01-01T00:00:00.000Z', rangeEnd: '2026-02-01T00:00:00.000Z',
      status: 'refused', expectedUnits: null, observedUnits: 0, omittedUnits: null,
      retryable: false, observedAt: '2026-02-01T00:00:00.000Z', limitationCode: 'CONSENT_REFUSED',
    })
    expect(completeObservedUnits(refused)).toBeNull()
    expect(CoverageRecordSchema.safeParse({ ...refused, observedUnits: -1 }).success).toBe(false)
    expect(CoverageRecordSchema.safeParse({ ...refused, status: 'complete' }).success).toBe(false)
    expect(CoverageRecordSchema.safeParse({
      ...refused, status: 'complete', expectedUnits: 1, observedUnits: 1, omittedUnits: 99,
    }).success).toBe(false)
    expect(CoverageRecordSchema.safeParse({ ...refused, status: 'truncated' }).success).toBe(false)
    expect(CoverageRecordSchema.safeParse({ ...refused, unexpected: true }).success).toBe(false)
    const complete = CoverageRecordSchema.parse({
      ...refused, status: 'complete', expectedUnits: 1, observedUnits: 1, omittedUnits: 0,
    })
    expect(completeObservedUnits(complete)).toBe(1)
  })

  it('requires valid temporal ordering and exact source provenance', () => {
    expect(EvidenceTimesSchema.safeParse({
      observedAt: '2026-01-01T00:00:00.000Z', collectedAt: '2025-12-31T23:59:59.000Z',
    }).success).toBe(false)
    expect(SourceProvenanceSchema.safeParse({
      sourceKind: 'github_rest', sourceHostId: 'github-com', sourceSnapshotId: 'snap-1',
      queryTemplateId: 'repo-summary-v1', queryFingerprint: 'a'.repeat(64), connectorVersion: '1.0.0',
    }).success).toBe(false)
    expect(SourceProvenanceSchema.safeParse({
      sourceKind: 'local_git', sourceHostId: 'local', sourceSnapshotId: 'snap-1',
      queryTemplateId: 'git-log-v1', queryFingerprint: 'a'.repeat(64), connectorVersion: '1.0.0', gitVersion: '2.48.1',
      extra: 'P1_CANARY_PROVENANCE_EXTRA',
    }).success).toBe(false)
    expect(SourceProvenanceSchema.safeParse({
      sourceKind: 'provider_json', sourceHostId: 'local', sourceSnapshotId: 'snap-1',
      queryTemplateId: 'provider-v1', queryFingerprint: 'a'.repeat(64), connectorVersion: '1.0.0',
    }).success).toBe(false)
  })

  it('uses registered field classes and rejects unknown family, version, and payload keys', () => {
    const envelope = {
      evidenceId: 'ev-1', schemaVersion: CANONICAL_ENVELOPE_SCHEMA_VERSION,
      payloadFamily: 'pull_request_fact.v1', layer: 'observed', restrictedSourceKey: 'source-1', analyticalKey: 'analysis-1',
      payload: { count: 3, state: 'closed' }, fieldClasses: { count: 'C1', state: 'C1' },
      times: { observedAt: '2026-01-01T00:00:00.000Z', collectedAt: '2026-01-01T00:00:01.000Z' },
      provenance: {
        sourceKind: 'github_rest', sourceHostId: 'github-com', sourceSnapshotId: 'snap-1', queryTemplateId: 'pr-v1',
        queryFingerprint: 'a'.repeat(64), connectorVersion: '1.0.0', sourceApiVersion: '2026-03-10',
      },
      capabilityId: 'github.core', consentRevision: 'consent-1', coverageId: 'cov-1', redactionRevision: 'redaction-1',
    }
    expect(buildCanonicalEnvelope(aggregatePayload, envelope).payload).toEqual(envelope.payload)
    expect(() => buildCanonicalEnvelope(aggregatePayload, { ...envelope, schemaVersion: '1.0.0' })).toThrow()
    expect(() => buildCanonicalEnvelope(aggregatePayload, { ...envelope, payloadFamily: 'provider_json.v1' })).toThrow()
    expect(() => buildCanonicalEnvelope(aggregatePayload, { ...envelope, layer: 'promoted' })).toThrow()
    expect(() => buildCanonicalEnvelope(aggregatePayload, { ...envelope, payload: { ...envelope.payload, providerBlob: {} } })).toThrow()
    expect(() => buildCanonicalEnvelope(aggregatePayload, { ...envelope, fieldClasses: { count: 'C1' } })).toThrow()
  })

  it('rejects every invented prohibited canary at each named sink before serialization', () => {
    for (const sink of PRIVACY_SINKS) {
      if (sink === 'public') {
        const poisonedPublicPayload = { demoCount: 1, ...canaries }
        expect(() => payloadForSink(sink, syntheticPayload, poisonedPublicPayload), sink).toThrow()
        expect(() => serializeForSink(sink, syntheticPayload, poisonedPublicPayload), sink).toThrow()
      } else {
        expect(() => payloadForSink(sink, canaryPayload, canaries), sink).toThrow()
        expect(() => serializeForSink(sink, canaryPayload, canaries), sink).toThrow()
      }
    }
    const accepted = PRIVACY_SINKS.map((sink) =>
      sink === 'public'
        ? serializeForSink(sink, syntheticPayload, { demoCount: 2 })
        : serializeForSink(sink, aggregatePayload, { count: 2, state: 'open' }),
    )
    for (const serialized of accepted) {
      for (const canary of Object.values(canaries)) expect(serialized).not.toContain(canary)
    }
  })

  it('binds private schemas to named sinks and refuses permissive nested payloads', () => {
    expect(() => serializeForSink('api', exportOnlyPayload, { count: 1 })).toThrow()
    expect(() => serializeForSink('public', aggregatePayload, { count: 1, state: 'open' })).toThrow()
    expect(() => registerPublicPayload(
      'public_showcase.v1', z.object({ count: z.number() }), { count: 'C1' },
    )).toThrow()

    const nested = registerPayload(
      'repository_observed.v1',
      z.object({ meta: z.object({}).passthrough() }),
      { meta: 'C1' },
      ['export'],
    )
    expect(() => serializeForSink('export', nested, { meta: { secret: canaries.token } })).toThrow()
  })

  it('keeps the manifest strict, allowlisted, and capped below local/private classes', () => {
    const schema = JSON.parse(readFileSync('docs/analysis-pack/manifest.schema.json', 'utf8')) as {
      additionalProperties: boolean
      properties: { exportClassification: { const: string }; artifacts: { items: { additionalProperties: boolean; properties: { path: { enum: string[] }; classification: { enum: string[] } } } }; externalModelEvidence: { properties: { classification: { const: string } } } }
    }
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.exportClassification.const).toBe('redacted_aggregate')
    expect(schema.properties.artifacts.items.additionalProperties).toBe(false)
    expect(schema.properties.artifacts.items.properties.path.enum).not.toContain('../P1_CANARY_PATH')
    expect(schema.properties.artifacts.items.properties.classification.enum).toEqual(['C0', 'C1'])
    expect(schema.properties.externalModelEvidence.properties.classification.const).toBe('C1')
    expect(JSON.stringify(schema)).not.toContain('consentSecret')
    expect(JSON.stringify(schema)).not.toContain('identityAlias')
  })
})
