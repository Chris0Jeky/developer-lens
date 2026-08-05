import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { V2_API_CONTRACT_VERSION } from '../../server/api/v2/contract'
import { WHY_RESOLVER_VERSION } from '../../shared/whyContract'
import { CLAIM_IDS, EVIDENCE_IDS } from '../../shared/integrationShape'
import {
  INTEGRATION_SHAPE_REFERENCES,
  resolveIntegrationShapeEvidence,
} from '../../shared/integrationShapeEvidence'
import type { AnalyticReference } from '../../shared/findings'
import { useIntegrationShapeEvidenceResolver } from './evidenceApiResolver'

/**
 * The PR #131 late-review boundary: the hook fetches from a local port any process can
 * squat, so a 200 response is accepted ONLY when it parses the shared resolve contract
 * AND answers the exact reference the drawer asked about. Everything else must fall back
 * to the deterministic offline composition without caching anything.
 *
 * Path discrimination: `resolveIntegrationShapeEvidence` returns STABLE module fixture
 * objects for every rendered reference, while an accepted response is a freshly parsed
 * wire copy — so `toBe(fixture)` proves the fallback ran and `not.toBe(fixture)` proves
 * the served value was accepted, even when the two are deep-equal by contract.
 */

const P50: AnalyticReference = { kind: 'claim', claimId: CLAIM_IDS.p50, claimLayer: 'deterministic' }
const OPEN_TAIL: AnalyticReference = { kind: 'observation', evidenceId: EVIDENCE_IDS.openTailCurrent }

/** A contract-valid projection that is visibly NOT the offline composition for P50. */
const SERVED_UNRESOLVABLE = {
  kind: 'unresolvable',
  resolverVersion: WHY_RESOLVER_VERSION,
  reason: 'STORAGE_UNAVAILABLE',
  claimId: CLAIM_IDS.p50,
  lineage: [],
}

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    apiContractVersion: V2_API_CONTRACT_VERSION,
    analysisVersion: '1.0.0',
    reference: { kind: 'claim', claimId: CLAIM_IDS.p50, claimLayer: 'deterministic' },
    projection: SERVED_UNRESOLVABLE,
    ...overrides,
  }
}

function respondWith(body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => body }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function wireCopy(reference: AnalyticReference): unknown {
  return JSON.parse(JSON.stringify(resolveIntegrationShapeEvidence(reference)))
}

function wireReference(reference: AnalyticReference): Record<string, unknown> {
  return reference.kind === 'observation'
    ? { kind: 'observation', evidenceId: reference.evidenceId }
    : { kind: 'claim', claimId: reference.claimId, claimLayer: reference.claimLayer }
}

/** Renders the hook, lets its single fetch fully settle, and returns the rendered host. */
async function settled(reference: AnalyticReference, fetchMock: ReturnType<typeof vi.fn>) {
  const rendered = renderHook(() => useIntegrationShapeEvidenceResolver(reference))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  await act(async () => {})
  await act(async () => {})
  return rendered
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('evidence API resolver — accepting only contract-conformant matching responses', () => {
  it('accepts and caches a valid response for the requested reference', async () => {
    const { result } = await settled(P50, respondWith(envelope()))
    await waitFor(() => expect(result.current(P50)).toEqual(SERVED_UNRESOLVABLE))
  })

  it('accepts a valid observation response and serves the parsed wire copy, not the fallback', async () => {
    const body = envelope({ reference: wireReference(OPEN_TAIL), projection: wireCopy(OPEN_TAIL) })
    const { result } = await settled(OPEN_TAIL, respondWith(body))
    await waitFor(() =>
      expect(result.current(OPEN_TAIL)).not.toBe(resolveIntegrationShapeEvidence(OPEN_TAIL)),
    )
    expect(result.current(OPEN_TAIL)).toEqual(wireCopy(OPEN_TAIL))
  })

  it.each([
    ['an unresolvable missing its reason', { projection: { kind: 'unresolvable', resolverVersion: WHY_RESOLVER_VERSION, claimId: null, lineage: [] } }],
    ['an unresolvable with an unknown reason code', { projection: { ...SERVED_UNRESOLVABLE, reason: 'NOT_A_REASON' } }],
    ['an unresolvable missing its lineage', { projection: { kind: 'unresolvable', resolverVersion: WHY_RESOLVER_VERSION, reason: 'UNKNOWN_CLAIM', claimId: null } }],
    ['an unresolvable with malformed lineage entries', { projection: { ...SERVED_UNRESOLVABLE, lineage: [{ kind: 'lineage_event' }] } }],
    ['an unresolvable with a wrong resolver version', { projection: { ...SERVED_UNRESOLVABLE, resolverVersion: '9.9.9' } }],
    ['an explanation missing its claim', { projection: { kind: 'explanation', resolverVersion: WHY_RESOLVER_VERSION, bound: 64, element: null, edges: [], limitations: [], lineage: [], unresolvedEdges: [] } }],
    ['an evidence node missing its coverage', { projection: { kind: 'evidence', evidenceId: 'ev-x', layer: 'observed', schemaVersion: 'evidence.v2', lineage: [] } }],
    ['a missing_link with an unknown reason', { projection: { kind: 'missing_link', reason: 'NOT_A_REASON', targetKind: 'evidence', targetId: null, coverageKey: null, lineage: [] } }],
    ['a projection with an unknown discriminant', { projection: { kind: 'surprise' } }],
    ['a body with no projection at all', { projection: undefined } as Record<string, unknown>],
    ['a wrong api contract version', { apiContractVersion: '9.9.9' }],
  ])('falls back to the offline composition for %s', async (_label, overrides) => {
    const { result } = await settled(P50, respondWith(envelope(overrides)))
    expect(result.current(P50)).toBe(resolveIntegrationShapeEvidence(P50))
  })

  it('rejects an envelope that ECHOES the requested reference but attaches another claim\'s walk', async () => {
    // The Codex PR #132 finding: reference echo and schema validity alone are not
    // enough — the projection identity must answer the echoed reference too.
    const other: AnalyticReference = { kind: 'claim', claimId: CLAIM_IDS.p75, claimLayer: 'deterministic' }
    const body = envelope({ projection: wireCopy(other) })
    const { result } = await settled(P50, respondWith(body))
    expect(result.current(P50)).toBe(resolveIntegrationShapeEvidence(P50))
  })

  it('rejects an unresolvable that names a different claim than the echoed reference', async () => {
    const body = envelope({ projection: { ...SERVED_UNRESOLVABLE, claimId: CLAIM_IDS.p75 } })
    const { result } = await settled(P50, respondWith(body))
    expect(result.current(P50)).toBe(resolveIntegrationShapeEvidence(P50))
  })

  it('rejects a projection carrying an undeclared nested field instead of stripping it', async () => {
    const body = envelope({ projection: { ...SERVED_UNRESOLVABLE, surprise: 'undeclared' } })
    const { result } = await settled(P50, respondWith(body))
    expect(result.current(P50)).toBe(resolveIntegrationShapeEvidence(P50))
  })

  it('rejects a VALID projection served for a different claim than requested, without caching it', async () => {
    const other: AnalyticReference = { kind: 'claim', claimId: CLAIM_IDS.p75, claimLayer: 'deterministic' }
    const body = envelope({ reference: wireReference(other), projection: wireCopy(other) })
    const { result } = await settled(P50, respondWith(body))
    // The clicked mark must never show another claim's walk: the requested key resolves
    // offline, and the foreign projection was not cached under any key.
    expect(result.current(P50)).toBe(resolveIntegrationShapeEvidence(P50))
    expect(result.current(other)).toBe(resolveIntegrationShapeEvidence(other))
  })

  it('rejects a VALID observation walk served for a different observation than requested', async () => {
    const other: AnalyticReference = { kind: 'observation', evidenceId: EVIDENCE_IDS.mergeCurrent }
    const body = envelope({ reference: wireReference(other), projection: wireCopy(other) })
    const { result } = await settled(OPEN_TAIL, respondWith(body))
    expect(result.current(OPEN_TAIL)).toBe(resolveIntegrationShapeEvidence(OPEN_TAIL))
  })

  it('rejects a claim response whose layer disagrees with the requested reference', async () => {
    const body = envelope({
      reference: { kind: 'claim', claimId: CLAIM_IDS.p50, claimLayer: 'statistical' },
    })
    const { result } = await settled(P50, respondWith(body))
    expect(result.current(P50)).toBe(resolveIntegrationShapeEvidence(P50))
  })

  it('rejects a claim response answering an observation request', async () => {
    const { result } = await settled(OPEN_TAIL, respondWith(envelope()))
    expect(result.current(OPEN_TAIL)).toBe(resolveIntegrationShapeEvidence(OPEN_TAIL))
  })

  it('accepts every rendered reference round-tripped through the wire format', async () => {
    // The served and offline projections are the same data by contract; every reference
    // the Atlas renders must parse the shared schema and be ACCEPTED (not fallen back).
    for (const reference of INTEGRATION_SHAPE_REFERENCES) {
      const body = envelope({ reference: wireReference(reference), projection: wireCopy(reference) })
      const fetchMock = respondWith(body)
      const rendered = await settled(reference, fetchMock)
      await waitFor(() =>
        expect(rendered.result.current(reference)).not.toBe(resolveIntegrationShapeEvidence(reference)),
      )
      expect(rendered.result.current(reference)).toEqual(wireCopy(reference))
      rendered.unmount()
    }
  })
})
