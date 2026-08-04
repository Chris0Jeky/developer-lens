import { getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
import type { CoverageRecord } from '../../shared/coverage'
import type {
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
      readonly coverage: readonly CoverageRecord[]
      readonly capabilities: readonly V2CapabilityView[]
    }

export type CoverageCockpitProblemKind = Exclude<
  CoverageCockpitState['kind'],
  'loading' | 'ready'
>

/**
 * Operational timestamps render at ISO-week grain or coarser (Appendix I.1).
 *
 * `getISOWeek`/`getISOWeekYear` read the LOCAL calendar fields of a Date, so
 * passing a parsed instant straight in would make the rendered week depend on
 * the viewer's timezone — `2026-08-03T00:00:00Z` is still 2026-08-02 in any
 * negative-offset zone, which is a different ISO week. The UTC calendar date is
 * therefore rebuilt as a local date first, so every viewer sees the same week
 * for the same instant.
 */
export function isoWeekLabel(timestamp: string): string {
  const parsed = parseISO(timestamp)
  if (Number.isNaN(parsed.getTime())) return 'unknown'
  const utcCalendarDate = new Date(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  )
  return `${getISOWeekYear(utcCalendarDate)}-W${String(getISOWeek(utcCalendarDate)).padStart(2, '0')}`
}

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
