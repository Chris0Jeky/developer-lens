import { useCallback, useMemo, useState } from 'react'
import {
  acceptChangeBatchTailView,
  type ChangeBatchTailView,
} from '../../shared/changeBatchTailView'
import { buildSyntheticChangeBatchTailView } from '../../shared/changeBatchTailSynthetic'

/**
 * Phase E (#174) — where the change-batch panel's view comes from.
 *
 * The explicitly synthetic view is always available and renders first; it is the whole story in
 * the public showcase (a static artifact with no API, so no request is attempted there). The
 * Atlas renders without any network call; only an explicit user action asks the local
 * `/api/v2/lenses/change-batch-tail`. That endpoint is default-off and answers 404 unless a
 * selected v3 store was deliberately wired, so "not served" is the ordinary answer.
 *
 * A served body replaces the synthetic view only when it passes `acceptChangeBatchTailView` — the
 * same gate the server ran — AND declares the stored source. What renders is the PARSED view, so
 * a stale or squatting local process can do nothing but be ignored.
 */
export const CHANGE_BATCH_REQUEST_TIMEOUT_MS = 1_500

export function changeBatchTailPath(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return `${base.endsWith('/') ? base.slice(0, -1) : base}/api/v2/lenses/change-batch-tail`
}

/** Accept a served body only if it is a gated stored view; otherwise return null. */
export function acceptServedChangeBatchTail(body: unknown): ChangeBatchTailView | null {
  if (typeof body !== 'object' || body === null) return null
  const candidate = body as { apiContractVersion?: unknown; view?: unknown }
  if (candidate.apiContractVersion !== '1.0.0') return null
  try {
    const view = acceptChangeBatchTailView(candidate.view)
    return view.source.kind === 'selected_v3_store' ? view : null
  } catch {
    return null
  }
}

export type ChangeBatchTailSourceStatus = 'synthetic' | 'loading' | 'stored' | 'not_served'

export interface ChangeBatchTailSource {
  readonly view: ChangeBatchTailView
  readonly status: ChangeBatchTailSourceStatus
  /** False in the static showcase, which has no API to ask. */
  readonly canRequestStored: boolean
  /** Ask the local endpoint once, on an explicit user action; never on render. */
  readonly requestStored: () => void
}

export function useChangeBatchTailView(): ChangeBatchTailSource {
  const synthetic = useMemo(() => buildSyntheticChangeBatchTailView(), [])
  const [served, setServed] = useState<ChangeBatchTailView | null>(null)
  const [status, setStatus] = useState<ChangeBatchTailSourceStatus>('synthetic')
  const canRequestStored = import.meta.env.MODE !== 'showcase' && typeof fetch === 'function'

  const requestStored = useCallback(() => {
    if (!canRequestStored) return
    setStatus('loading')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CHANGE_BATCH_REQUEST_TIMEOUT_MS)
    void fetch(changeBatchTailPath(), { signal: controller.signal })
      .then(async (response) => (response.ok ? acceptServedChangeBatchTail(await response.json()) : null))
      .catch(() => null)
      .then((view) => {
        if (view === null) {
          setStatus('not_served')
          return
        }
        setServed(view)
        setStatus('stored')
      })
      .finally(() => clearTimeout(timeout))
  }, [canRequestStored])

  return { view: served ?? synthetic, status, canRequestStored, requestStored }
}
