import { useCallback, useEffect, useRef, useState } from 'react'
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
 * Shape check, not a schema. The endpoint returns
 * `{ apiContractVersion, analysisVersion, reference, projection }`, and `projection` is the same
 * `IntegrationShapeEvidenceResolution` union the drawer renders — already proven presentation-safe
 * server-side by `assertPresentationSafe` before a byte is sent. Only the discriminant is checked
 * here; anything else falls back rather than rendering something the drawer cannot switch on.
 *
 * The failure path is deliberately silent. There is no degraded state to report: the served
 * projection and the local composition are the same data, so a user who cannot reach the API sees
 * exactly the same walk. Saying "the API is unavailable" would be noise about an implementation
 * detail with no bearing on what is on screen.
 */

/** Short on purpose: a slow answer is worth less than the local composition available now. */
export const EVIDENCE_REQUEST_TIMEOUT_MS = 1_500

const RESOLUTION_KINDS = new Set(['explanation', 'unresolvable', 'evidence', 'missing_link'])

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
  return `/api/v2/evidence/resolve?${query.toString()}`
}

function servedProjection(body: unknown): IntegrationShapeEvidenceResolution {
  const projection = (body as { projection?: unknown } | null)?.projection
  const kind = (projection as { kind?: unknown } | null)?.kind
  if (typeof kind !== 'string' || !RESOLUTION_KINDS.has(kind)) {
    throw new Error('evidence projection is not a resolution the drawer can render')
  }
  return projection as IntegrationShapeEvidenceResolution
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
        return servedProjection((await response.json()) as unknown)
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
