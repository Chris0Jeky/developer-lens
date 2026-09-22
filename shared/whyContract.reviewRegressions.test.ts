import { describe, expect, it } from 'vitest'

import {
  INTEGRATION_SHAPE_REFERENCES,
  resolveIntegrationShapeEvidence,
} from './integrationShapeEvidence.js'
import { WHY_RESOLVER_VERSION, WhyResolutionSchema } from './whyContract.js'

const CLAIM_ID = `cl_${'a'.repeat(64)}`
const OTHER_CLAIM_ID = `cl_${'b'.repeat(64)}`

function lineage(subjectId: string) {
  return [{
    kind: 'lineage_event',
    subjectId,
    eventKind: 'tombstone_cascade',
    causedBy: null,
    occurredAt: '2026-08-05T00:00:00.000Z',
  }]
}

function explanation() {
  const reference = INTEGRATION_SHAPE_REFERENCES.find((candidate) => candidate.kind === 'claim')
  if (!reference) throw new Error('Expected an invented claim reference')
  const resolution = resolveIntegrationShapeEvidence(reference)
  if (resolution.kind !== 'explanation') throw new Error('Expected an invented explanation')
  return resolution
}

function scopeLink(reason: 'MISSING_SCOPE' | 'SCOPE_ALIAS_CLEARED', scopeId: string) {
  return {
    kind: 'missing_link',
    reason,
    targetKind: 'scope',
    targetId: scopeId,
    coverageKey: null,
    lineage: [],
  }
}

describe('why contract reviewed identity boundaries', () => {
  it.each(['UNKNOWN_CLAIM', 'STORAGE_UNAVAILABLE'])('%s rejects foreign lineage', (reason) => {
    expect(WhyResolutionSchema.safeParse({
      kind: 'unresolvable',
      resolverVersion: WHY_RESOLVER_VERSION,
      reason,
      claimId: CLAIM_ID,
      lineage: lineage(OTHER_CLAIM_ID),
    }).success).toBe(false)
  })

  it.each(['UNKNOWN_CLAIM', 'STORAGE_UNAVAILABLE'])('%s retains its own lineage', (reason) => {
    expect(WhyResolutionSchema.safeParse({
      kind: 'unresolvable',
      resolverVersion: WHY_RESOLVER_VERSION,
      reason,
      claimId: CLAIM_ID,
      lineage: lineage(CLAIM_ID),
    }).success).toBe(true)
  })

  it.each(['INVALID_REQUEST', 'MALFORMED_CLAIM_ID'])('%s cannot carry claim lineage', (reason) => {
    const projection = {
      kind: 'unresolvable',
      resolverVersion: WHY_RESOLVER_VERSION,
      reason,
      claimId: null,
      lineage: [],
    }
    expect(WhyResolutionSchema.safeParse(projection).success).toBe(true)
    expect(WhyResolutionSchema.safeParse({ ...projection, lineage: lineage(CLAIM_ID) }).success).toBe(false)
  })

  it('accepts an absent scope row with the correct MISSING_SCOPE furniture', () => {
    const tree = explanation()
    expect(WhyResolutionSchema.safeParse({
      ...tree,
      scope: scopeLink('MISSING_SCOPE', tree.claim.scopeId),
    }).success).toBe(true)
  })

  it('rejects alias-cleared furniture in place of the entire scope row', () => {
    const tree = explanation()
    expect(WhyResolutionSchema.safeParse({
      ...tree,
      scope: scopeLink('SCOPE_ALIAS_CLEARED', tree.claim.scopeId),
    }).success).toBe(false)
  })

  it('still accepts a retained scope row whose alias has been cleared', () => {
    const tree = explanation()
    if (tree.scope.kind !== 'scope') throw new Error('Expected a retained scope row')
    expect(WhyResolutionSchema.safeParse({
      ...tree,
      scope: {
        ...tree.scope,
        hasAlias: false,
        aliasLink: scopeLink('SCOPE_ALIAS_CLEARED', tree.claim.scopeId),
      },
    }).success).toBe(true)
  })
})
