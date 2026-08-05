import type {
  CoveragePresentationView,
  V2CapabilityView,
  V2StoreProvenance,
} from '../../server/api/v2/contract'

/**
 * Pure state and formatting helpers for the Coverage Cockpit. They live outside
 * the component file so they can be tested directly and so the component module
 * exports only components.
 */

/**
 * Every way this surface can fail is its own state. Collapsing them into one
 * "refused" would tell a user whose bearer went stale to go looking at store
 * provenance, which is exactly the wrong repair.
 */
export type CoverageCockpitState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unconfigured' }
  | { readonly kind: 'unauthorized'; readonly code: string }
  | { readonly kind: 'guard-refused'; readonly code: string }
  | { readonly kind: 'provenance-refused'; readonly code: string }
  | { readonly kind: 'store-unavailable'; readonly code: string }
  | { readonly kind: 'transport-error' }
  | { readonly kind: 'error'; readonly code: string }
  | {
      readonly kind: 'ready'
      readonly provenance: V2StoreProvenance
      /**
       * The projected view, never the canonical record (#79). The cockpit cannot render a scope
       * alias, a coverage identifier, or an exact timestamp because it is never given one.
       */
      readonly coverage: readonly CoveragePresentationView[]
      readonly capabilities: readonly V2CapabilityView[]
    }

export type CoverageCockpitProblemKind = Exclude<
  CoverageCockpitState['kind'],
  'loading' | 'ready'
>

/**
 * The ISO-week grain floor (Appendix I.1) now lives in `shared/presentationGrain.ts` so the
 * server projection behind `/api/v2/coverage` and the client surfaces that still receive raw
 * instants (the Evidence Drawer's resolver output) apply the identical function. Re-exported
 * here because this module remains the drawer's import site.
 */
export { isoWeekLabel } from '../../shared/presentationGrain'

export function omittedLabel(omittedUnits: number | null): string {
  if (omittedUnits === null) return 'unknown'
  if (omittedUnits === 0) return 'none'
  return `${omittedUnits.toLocaleString('en-GB')} units`
}

/**
 * Each HTTP outcome maps to the state whose remediation actually fixes it: a
 * rejected bearer is a restart, a rejected origin is a different URL, a refused
 * store is a reseed, and a missing store is a first seed.
 */
export function cockpitStateForStatus(status: number, code: string): CoverageCockpitState {
  if (status === 401) return { kind: 'unauthorized', code }
  if (status === 403) return { kind: 'guard-refused', code }
  if (status === 409) return { kind: 'provenance-refused', code }
  if (status === 503) return { kind: 'store-unavailable', code }
  return { kind: 'error', code }
}

export function refusalCode(body: unknown): string {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code
  return typeof code === 'string' ? code : 'V2_UNAVAILABLE'
}
