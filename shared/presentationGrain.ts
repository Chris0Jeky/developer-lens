import { getISOWeek, getISOWeekYear, parseISO } from 'date-fns'

/**
 * The presentation grain floor (ADR-01 / ADR-14, Appendix I.1): operational timestamps render at
 * ISO-week grain or coarser on single-owner installations.
 *
 * This lives in `shared/` rather than in the client bundle because the floor belongs to the
 * projection, not to the renderer. A `PresentationView` built on the server (`/api/v2/coverage`)
 * and a client-side drawer must apply the SAME function, or the two surfaces disagree about what
 * week an instant belongs to — and a server projection that shipped exact timestamps for the
 * client to round would have already crossed the boundary the floor exists to hold.
 *
 * It is deliberately free of native and server-only dependencies so both halves can import it.
 */

/**
 * `getISOWeek`/`getISOWeekYear` read the LOCAL calendar fields of a Date, so passing a parsed
 * instant straight in would make the rendered week depend on the viewer's timezone —
 * `2026-08-03T00:00:00Z` is still 2026-08-02 in any negative-offset zone, which is a different
 * ISO week. The UTC calendar date is therefore rebuilt as a local date first, so every viewer —
 * and the server projection — sees the same week for the same instant.
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

/** The shape every ISO-week label matches, or the honest `unknown` an unparseable instant gets. */
export const ISO_WEEK_LABEL_PATTERN = /^(?:\d{4}-W\d{2}|unknown)$/
