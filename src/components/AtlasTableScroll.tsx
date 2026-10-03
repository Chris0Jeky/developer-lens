import type { ReactNode } from 'react'

/** Keep wide evidence tables reachable by pointer and keyboard without scrolling their prose. */
export function AtlasTableScroll({ label, children }: { label: string; children: ReactNode }) {
  return <div className="atlas-table-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>
}
