import { describe, expect, it } from 'vitest'

import { CLAIM_EDGE_ROLES } from './claims.js'
import {
  INTEGRATION_SHAPE_REFERENCES,
  resolveIntegrationShapeEvidence,
} from './integrationShapeEvidence.js'
import {
  WHY_MISSING_LINK_REASONS,
  WHY_RESOLVER_VERSION,
  WHY_TARGET_KINDS,
  WhyResolutionSchema,
  type WhyMissingLinkReason,
  type WhyTargetKind,
} from './whyContract.js'

const CLAIM_ID = `cl_${'a'.repeat(64)}`

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function explanationWire() {
  const reference = INTEGRATION_SHAPE_REFERENCES.find((candidate) => candidate.kind === 'claim')
  if (!reference) throw new Error('Expected a claim reference fixture')
  const resolution = resolveIntegrationShapeEvidence(reference)
  if (resolution.kind !== 'explanation') throw new Error('Expected an explanation fixture')
  return clone(resolution)
}

function evidenceWire() {
  const reference = INTEGRATION_SHAPE_REFERENCES.find((candidate) => candidate.kind === 'observation')
  if (!reference) throw new Error('Expected an observation reference fixture')
  const resolution = resolveIntegrationShapeEvidence(reference)
  if (resolution.kind !== 'evidence') throw new Error('Expected an evidence fixture')
  return clone(resolution)
}

const TARGET_KIND_BY_REASON = {
  CYCLE_DETECTED: 'claim',
  DEPTH_LIMIT_REACHED: 'claim',
  MALFORMED_EDGE: 'edge',
  MISSING_CAPABILITY_BINDING: 'collection_job',
  MISSING_CLAIM: 'claim',
  MISSING_COVERAGE: 'coverage',
  MISSING_EVIDENCE: 'evidence',
  MISSING_SCOPE: 'scope',
  SCOPE_ALIAS_CLEARED: 'scope',
  TOMBSTONED_CLAIM: 'claim',
  TOMBSTONED_EVIDENCE: 'evidence',
  UNREGISTERED_CAPABILITY: 'capability',
} as const satisfies Record<WhyMissingLinkReason, WhyTargetKind>

describe('why contract semantic coherence', () => {
  it('reuses the closed coverage record invariants', () => {
    const incompleteComplete = evidenceWire() as unknown as {
      coverage: {
        status: string
        expectedUnits: number | null
        observedUnits: number
        omittedUnits: number | null
        saturationReason: string | null
      }
    }
    incompleteComplete.coverage.status = 'complete'
    incompleteComplete.coverage.expectedUnits = 3
    incompleteComplete.coverage.observedUnits = 2
    incompleteComplete.coverage.omittedUnits = 1
    incompleteComplete.coverage.saturationReason = null

    const unexplainedTruncation = evidenceWire() as unknown as {
      coverage: {
        status: string
        expectedUnits: number | null
        observedUnits: number
        omittedUnits: number | null
        saturationReason: string | null
      }
    }
    unexplainedTruncation.coverage.status = 'truncated'
    unexplainedTruncation.coverage.expectedUnits = 3
    unexplainedTruncation.coverage.observedUnits = 2
    unexplainedTruncation.coverage.omittedUnits = 1
    unexplainedTruncation.coverage.saturationReason = null

    const impossibleSaturation = evidenceWire() as unknown as {
      coverage: { status: string; saturationReason: string | null }
    }
    impossibleSaturation.coverage.status = 'complete'
    impossibleSaturation.coverage.saturationReason = 'REQUEST_BUDGET_EXHAUSTED'

    expect(WhyResolutionSchema.safeParse(incompleteComplete).success).toBe(false)
    expect(WhyResolutionSchema.safeParse(unexplainedTruncation).success).toBe(false)
    expect(WhyResolutionSchema.safeParse(impossibleSaturation).success).toBe(false)
  })

  it('requires every edge role exactly once', () => {
    const omitted = explanationWire() as unknown as { edges: unknown[] }
    omitted.edges.pop()

    const duplicated = explanationWire() as unknown as { edges: unknown[] }
    duplicated.edges.push(clone(duplicated.edges[0]))

    expect(WhyResolutionSchema.safeParse(omitted).success).toBe(false)
    expect(WhyResolutionSchema.safeParse(duplicated).success).toBe(false)

    const canonical = explanationWire() as unknown as { edges: Array<{ role: string }> }
    expect(canonical.edges.map(({ role }) => role)).toEqual(CLAIM_EDGE_ROLES)
  })

  it('binds unresolvable claim-id nullability to the reason', () => {
    const base = {
      kind: 'unresolvable',
      resolverVersion: WHY_RESOLVER_VERSION,
      lineage: [],
    }

    expect(WhyResolutionSchema.safeParse({ ...base, reason: 'INVALID_REQUEST', claimId: CLAIM_ID }).success).toBe(false)
    expect(WhyResolutionSchema.safeParse({ ...base, reason: 'MALFORMED_CLAIM_ID', claimId: 'raw input' }).success).toBe(false)
    expect(WhyResolutionSchema.safeParse({ ...base, reason: 'STORAGE_UNAVAILABLE', claimId: null }).success).toBe(false)
    expect(WhyResolutionSchema.safeParse({ ...base, reason: 'UNKNOWN_CLAIM', claimId: null }).success).toBe(false)

    expect(WhyResolutionSchema.safeParse({ ...base, reason: 'INVALID_REQUEST', claimId: null }).success).toBe(true)
    expect(WhyResolutionSchema.safeParse({ ...base, reason: 'UNKNOWN_CLAIM', claimId: CLAIM_ID }).success).toBe(true)
  })

  it('binds every missing-link reason to its resolver target kind', () => {
    for (const reason of WHY_MISSING_LINK_REASONS) {
      const targetKind = TARGET_KIND_BY_REASON[reason]
      const valid = {
        kind: 'missing_link',
        reason,
        targetKind,
        targetId: 'target',
        coverageKey: null,
        lineage: [],
      }
      expect(WhyResolutionSchema.safeParse(valid).success, reason).toBe(true)

      const wrongKind = WHY_TARGET_KINDS.find((candidate) => candidate !== targetKind)
      if (!wrongKind) throw new Error('Expected a distinct target kind')
      expect(
        WhyResolutionSchema.safeParse({ ...valid, targetKind: wrongKind }).success,
        reason,
      ).toBe(false)
    }
  })

  it('binds coverage job furniture to the coverage key job id', () => {
    const mismatchedJob = evidenceWire() as unknown as {
      coverage: { coverageKey: { jobId: string }; job: { kind: string; jobId?: string } }
    }
    if (mismatchedJob.coverage.job.kind !== 'collection_job') {
      throw new Error('Expected a collection-job fixture')
    }
    mismatchedJob.coverage.job.jobId = `${mismatchedJob.coverage.coverageKey.jobId}-other`

    const mismatchedMissingLink = evidenceWire() as unknown as {
      coverage: {
        coverageKey: { jobId: string }
        job: unknown
      }
    }
    mismatchedMissingLink.coverage.job = {
      kind: 'missing_link',
      reason: 'MISSING_CAPABILITY_BINDING',
      targetKind: 'collection_job',
      targetId: `${mismatchedMissingLink.coverage.coverageKey.jobId}-other`,
      coverageKey: null,
      lineage: [],
    }

    expect(WhyResolutionSchema.safeParse(mismatchedJob).success).toBe(false)
    expect(WhyResolutionSchema.safeParse(mismatchedMissingLink).success).toBe(false)
  })

  it('binds the explanation scope to the root claim scope', () => {
    const mismatchedScope = explanationWire() as unknown as {
      claim: { scopeId: string }
      scope: { kind: string; scopeId?: string }
    }
    if (mismatchedScope.scope.kind !== 'scope') throw new Error('Expected a scope fixture')
    mismatchedScope.scope.scopeId = `${mismatchedScope.claim.scopeId}-other`

    const mismatchedMissingLink = explanationWire() as unknown as {
      claim: { scopeId: string }
      scope: unknown
    }
    mismatchedMissingLink.scope = {
      kind: 'missing_link',
      reason: 'MISSING_SCOPE',
      targetKind: 'scope',
      targetId: `${mismatchedMissingLink.claim.scopeId}-other`,
      coverageKey: null,
      lineage: [],
    }

    expect(WhyResolutionSchema.safeParse(mismatchedScope).success).toBe(false)
    expect(WhyResolutionSchema.safeParse(mismatchedMissingLink).success).toBe(false)
  })

  it('binds each transitive walk to its explanation slot', () => {
    const swapped = explanationWire() as unknown as {
      supersession: { relation: string }
      ancestry: { relation: string }
    }
    swapped.supersession.relation = 'derives_from_ancestry'
    swapped.ancestry.relation = 'supersession'

    expect(WhyResolutionSchema.safeParse(swapped).success).toBe(false)
  })

  it('binds root lineage events to the root claim', () => {
    const wire = explanationWire() as unknown as {
      claim: { claimId: string }
      lineage: unknown[]
    }
    wire.lineage.push({
      kind: 'lineage_event',
      subjectId: `${wire.claim.claimId}-other`,
      eventKind: 'tombstone_cascade',
      causedBy: null,
      occurredAt: '2026-08-05T00:00:00.000Z',
    })

    expect(WhyResolutionSchema.safeParse(wire).success).toBe(false)
  })
})
