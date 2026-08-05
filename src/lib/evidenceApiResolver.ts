import { useCallback, useEffect, useRef, useState } from 'react'
import { V2EvidenceResolveResponseSchema } from '../../server/api/v2/contract.js'
import type { AnalyticReference } from '../../shared/findings'
import {
  resolveIntegrationShapeEvidence,
  type IntegrationShapeEvidenceResolution,
} from '../../shared/integrationShapeEvidence'

/**
 * The Evidence Drawer's first live client (DL-VALUE-01).
 *
 * `/api/v2/evidence/resolve` has existed with no caller: the Atlas resolved every reference from
 * the same invented C1 composition the endpoint serves. This hook prefers the endpoint when it
 * answers and falls back to that composition when it does not — which is the ordinary case, not
 * an error path. The public showcase is a static Pages artifact with no API at all, and it must
 * keep working offline and identically.
 *
 * A response is accepted only when it parses the shared `V2EvidenceResolveResponseSchema` — the
 * exact contract the endpoint asserts before sending — AND its `reference` deep-equals the
 * reference this client asked for. The fetch trusts a local port, so a stale or squatting process
 * returning 200 JSON must be able to do exactly nothing: a partial `unresolvable`, an unknown
 * reason code, malformed lineage, or a valid walk for a DIFFERENT claim all fall back to the local
 * composition without caching anything (PR #131 late review). What the drawer renders is the
 * PARSED value, so no field outside the contract can reach it.
 *
 * The failure path is deliberately silent. There is no degraded state to report: the served
 * projection and the local composition are the same data, so a user who cannot reach the API sees
 * exactly the same walk. Saying "the API is unavailable" would be noise about an implementation
 * detail with no bearing on what is on screen.
 */

/** Short on purpose: a slow answer is worth less than the local composition available now. */
export const EVIDENCE_REQUEST_TIMEOUT_MS = 1_500

export function evidenceReferenceKey(reference: AnalyticReference): string {
  return reference.kind === 'observation'
    ? `observation:${reference.evidenceId}`
    : `claim:${reference.claimId}`
}

export function evidenceResolvePath(reference: AnalyticReference): string {
  const query = new URLSearchParams(
    reference.kind === 'observation'
      ? { kind: 'observation', id: reference.evidenceId }
      : { kind: 'claim', id: reference.claimId },
  )
  // Respect Vite's base so the showcase never requests outside its deployment root.
  const base = import.meta.env.BASE_URL ?? '/'
  return `${base.endsWith('/') ? base.slice(0, -1) : base}/api/v2/evidence/resolve?${query.toString()}`
}

/** True only when the served reference names exactly the reference this client requested. */
function referenceMatches(requested: AnalyticReference, served: AnalyticReference): boolean {
  if (requested.kind === 'observation') {
    return served.kind === 'observation' && served.evidenceId === requested.evidenceId
  }
  return (
    served.kind === 'claim'
    && served.claimId === requested.claimId
    && served.claimLayer === requested.claimLayer
  )
}

/**
 * Anything other than a contract-conformant resolution FOR THE REQUESTED REFERENCE falls
 * back to the local composition rather than reaching the drawer. Returns the parsed
 * value, never the raw body, so the drawer renders only schema-declared fields.
 */
function servedProjection(
  body: unknown,
  requested: AnalyticReference,
): IntegrationShapeEvidenceResolution {
  const parsed = V2EvidenceResolveResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error('evidence response does not satisfy the shared resolve contract')
  }
  if (!referenceMatches(requested, parsed.data.reference)) {
    throw new Error('evidence response answers a different reference than requested')
  }
  return parsed.data.projection
}

/**
 * Returns the drawer's synchronous `resolve` callback. The reference currently open is fetched
 * once, cached for the session, and the callback's identity changes when a served result arrives
 * so the drawer's `useMemo` recomputes. After the first failure nothing is attempted again.
 */
export function useIntegrationShapeEvidenceResolver(
  reference: AnalyticReference | null,
): (reference: AnalyticReference) => IntegrationShapeEvidenceResolution {
  const requested = useRef(new Set<string>())
  const unreachable = useRef(false)
  const [served, setServed] = useState<ReadonlyMap<string, IntegrationShapeEvidenceResolution>>(
    () => new Map(),
  )

  useEffect(() => {
    if (reference === null || unreachable.current) return
    const key = evidenceReferenceKey(reference)
    if (requested.current.has(key)) return
    requested.current.add(key)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), EVIDENCE_REQUEST_TIMEOUT_MS)

    void fetch(evidenceResolvePath(reference), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('the V2 evidence endpoint refused this reference')
        return servedProjection((await response.json()) as unknown, reference)
      })
      .then((projection) => {
        setServed((current) => new Map(current).set(key, projection))
      })
      .catch(() => {
        unreachable.current = true
      })
      .finally(() => {
        clearTimeout(timeout)
      })
  }, [reference])

  return useCallback(
    (requestedReference: AnalyticReference) =>
      served.get(evidenceReferenceKey(requestedReference)) ??
      resolveIntegrationShapeEvidence(requestedReference),
    [served],
  )
}
