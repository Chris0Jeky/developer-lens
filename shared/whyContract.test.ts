import { describe, expect, it } from 'vitest'
import {
  WHY_MISSING_LINK_REASONS,
  WHY_RESOLVER_VERSION,
  WHY_TARGET_KINDS,
  WHY_UNRESOLVABLE_REASONS,
  WHY_WALK_TERMINATIONS,
  WhyResolutionSchema,
  whyResolutionAnswersReference,
} from './whyContract.js'
import * as whyResolver from '../server/storage/whyResolver.js'
import {
  INTEGRATION_SHAPE_REFERENCES,
  resolveIntegrationShapeEvidence,
} from './integrationShapeEvidence.js'

describe('why contract — the runtime schema mirrors the resolver projection exactly', () => {
  it('parses every rendered resolution unchanged after a wire round-trip', () => {
    // Deep equality after parse proves the schema DECLARES every emitted field: a field
    // the schema forgot would be stripped by z.object and break this comparison, so the
    // browser client can never silently lose data the drawer renders.
    for (const reference of INTEGRATION_SHAPE_REFERENCES) {
      const resolution = resolveIntegrationShapeEvidence(reference)
      const wire = JSON.parse(JSON.stringify(resolution))
      const parsed = WhyResolutionSchema.safeParse(wire)
      expect(parsed.success, JSON.stringify(reference)).toBe(true)
      expect(parsed.data).toEqual(wire)
    }
  })

  it('re-exports the identical vocabulary objects through whyResolver', () => {
    // One source of truth: the resolver's server-side import site must hand back the
    // exact arrays this contract is built from, not copies that could drift.
    expect(whyResolver.WHY_MISSING_LINK_REASONS).toBe(WHY_MISSING_LINK_REASONS)
    expect(whyResolver.WHY_TARGET_KINDS).toBe(WHY_TARGET_KINDS)
    expect(whyResolver.WHY_UNRESOLVABLE_REASONS).toBe(WHY_UNRESOLVABLE_REASONS)
    expect(whyResolver.WHY_WALK_TERMINATIONS).toBe(WHY_WALK_TERMINATIONS)
    expect(whyResolver.WHY_RESOLVER_VERSION).toBe(WHY_RESOLVER_VERSION)
  })

  it('rejects undeclared fields anywhere in the projection instead of stripping them', () => {
    for (const reference of INTEGRATION_SHAPE_REFERENCES) {
      const wire = JSON.parse(JSON.stringify(resolveIntegrationShapeEvidence(reference))) as Record<string, unknown>
      wire.surprise = 'undeclared'
      expect(WhyResolutionSchema.safeParse(wire).success, JSON.stringify(reference)).toBe(false)
    }
  })

  it('binds a projection to the reference it answers', () => {
    for (const reference of INTEGRATION_SHAPE_REFERENCES) {
      const resolution = resolveIntegrationShapeEvidence(reference)
      expect(whyResolutionAnswersReference(reference, resolution), JSON.stringify(reference)).toBe(true)
      for (const other of INTEGRATION_SHAPE_REFERENCES) {
        if (other === reference) continue
        expect(
          whyResolutionAnswersReference(other, resolution),
          `${JSON.stringify(other)} must not be answered by ${JSON.stringify(reference)}'s walk`,
        ).toBe(false)
      }
    }
  })

  it('rejects truncated and mislabelled projections', () => {
    expect(WhyResolutionSchema.safeParse({ kind: 'unresolvable' }).success).toBe(false)
    expect(WhyResolutionSchema.safeParse({ kind: 'surprise' }).success).toBe(false)
    expect(
      WhyResolutionSchema.safeParse({
        kind: 'unresolvable',
        resolverVersion: WHY_RESOLVER_VERSION,
        reason: 'NOT_A_REASON',
        claimId: null,
        lineage: [],
      }).success,
    ).toBe(false)
  })
})
