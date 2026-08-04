import { useEffect, useState, type ReactNode } from 'react'
import { getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
import { CircleDashed, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import {
  completeObservedUnits,
  type CoverageRecord,
  type CoverageStatus,
} from '../../shared/coverage'
import type {
  V2CapabilitiesResponse,
  V2CapabilityView,
  V2CoverageResponse,
  V2StoreProvenance,
} from '../../server/api/v2/contract'
import { LensLogo } from './LensLogo'

/**
 * Coverage Cockpit V2 — the first user-visible V2 surface (card DL-BRIDGE-01).
 *
 * It renders all ten coverage states over the synthetic store. Its one hard rule
 * comes from the coverage contract: a missing, refused, or restricted state is
 * rendered as a coverage state and never as a numeric zero. The capability table
 * reports lifecycle state only — nothing on this surface transitions anything.
 */
interface StatusPresentation {
  readonly label: string
  /** Rendered instead of a count whenever the state is not `complete`. */
  readonly absence: string
}

const STATUS_PRESENTATION: Readonly<Record<CoverageStatus, StatusPresentation>> = {
  never_authorized: {
    label: 'Never authorized',
    absence: 'Never authorized — nothing was ever collected here',
  },
  refused: {
    label: 'Refused',
    absence: 'Refused — the owner declined this source',
  },
  unavailable: {
    label: 'Unavailable',
    absence: 'Unavailable — the source could not be reached',
  },
  restricted: {
    label: 'Restricted',
    absence: 'Restricted — permission bounded what could be seen',
  },
  truncated: {
    label: 'Truncated',
    absence: 'Truncated — the result window saturated before the end',
  },
  stale: {
    label: 'Stale',
    absence: 'Stale — the last observation predates this window',
  },
  failed: {
    label: 'Failed',
    absence: 'Failed — collection did not complete',
  },
  deleted: {
    label: 'Deleted',
    absence: 'Deleted — records were removed on request',
  },
  censored: {
    label: 'Censored',
    absence: 'Censored — redaction removed part of the record',
  },
  complete: {
    label: 'Complete',
    absence: 'Complete — every expected unit was observed',
  },
}

/** Operational timestamps render at ISO-week grain or coarser (Appendix I.1). */
function isoWeekLabel(timestamp: string): string {
  const parsed = parseISO(timestamp)
  if (Number.isNaN(parsed.getTime())) return 'unknown'
  return `${getISOWeekYear(parsed)}-W${String(getISOWeek(parsed)).padStart(2, '0')}`
}

function omittedLabel(omittedUnits: number | null): string {
  if (omittedUnits === null) return 'unknown'
  if (omittedUnits === 0) return 'none'
  return `${omittedUnits.toLocaleString('en-GB')} units`
}

export type CoverageCockpitState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unconfigured' }
  | { readonly kind: 'refused'; readonly code: string }
  | {
      readonly kind: 'ready'
      readonly provenance: V2StoreProvenance
      readonly coverage: readonly CoverageRecord[]
      readonly capabilities: readonly V2CapabilityView[]
    }

function CoverageRow({ record }: { record: CoverageRecord }) {
  const presentation = STATUS_PRESENTATION[record.status]
  const observed = completeObservedUnits(record)

  return (
    <li className="cockpit-coverage__row" data-status={record.status}>
      <div className="cockpit-coverage__identity">
        <span className="cockpit-coverage__status">{presentation.label}</span>
        <strong>{record.capabilityId}</strong>
        <small>{record.scopeAlias}</small>
      </div>
      <p className="cockpit-coverage__observed" data-testid={`observed-${record.coverageId}`}>
        {observed === null
          ? presentation.absence
          : `${observed.toLocaleString('en-GB')} observed units`}
      </p>
      <dl className="cockpit-coverage__facts">
        <div>
          <dt>Limitation</dt>
          <dd data-testid={`limitation-${record.coverageId}`}>{record.limitationCode}</dd>
        </div>
        <div>
          <dt>Omitted</dt>
          <dd data-testid={`omitted-${record.coverageId}`}>{omittedLabel(record.omittedUnits)}</dd>
        </div>
        <div>
          <dt>Window</dt>
          <dd>
            {isoWeekLabel(record.rangeStart)} → {isoWeekLabel(record.rangeEnd)}
          </dd>
        </div>
        <div>
          <dt>Observed</dt>
          <dd>{isoWeekLabel(record.observedAt)}</dd>
        </div>
        <div>
          <dt>Retryable</dt>
          <dd>{record.retryable ? 'yes' : 'no'}</dd>
        </div>
        {record.saturationReason && (
          <div>
            <dt>Saturation</dt>
            <dd>{record.saturationReason}</dd>
          </div>
        )}
      </dl>
    </li>
  )
}

function CockpitShell({ children, banner }: { children: ReactNode; banner: ReactNode }) {
  return (
    <div className="app" id="top">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />
      <header className="app-header">
        <a className="brand-link" href="#top">
          <LensLogo />
        </a>
        <div className="app-header__actions">
          <span className="local-pill">
            <Lock size={12} aria-hidden="true" /> Local only · V2 bridge
          </span>
        </div>
      </header>
      <div className="demo-banner">{banner}</div>
      <main>{children}</main>
    </div>
  )
}

export function CoverageCockpitV2({ state }: { state: CoverageCockpitState }) {
  if (state.kind === 'loading') {
    return (
      <CockpitShell
        banner={
          <>
            <Sparkles size={15} aria-hidden="true" />
            <span>Resolving the synthetic V2 store.</span>
          </>
        }
      >
        <section className="section-block">
          <span className="eyebrow">Coverage cockpit</span>
          <h1>Bringing the coverage boundary into focus…</h1>
        </section>
      </CockpitShell>
    )
  }

  if (state.kind === 'unconfigured') {
    return (
      <CockpitShell
        banner={
          <>
            <ShieldCheck size={15} aria-hidden="true" />
            <span>The V2 bridge is mounted but this page holds no launch bearer.</span>
          </>
        }
      >
        <section className="section-block" aria-labelledby="cockpit-unconfigured">
          <span className="eyebrow">Coverage cockpit · not authorized</span>
          <h1 id="cockpit-unconfigured">This page cannot see the V2 store yet.</h1>
          <p>
            The API generates a bearer secret once per launch and prints it on the local launch
            banner. Set the same value as <code>DEVELOPER_LENS_V2_TOKEN</code> and{' '}
            <code>VITE_DEVELOPER_LENS_V2_TOKEN</code> to let this surface read it. Until then the
            cockpit reports its own blindness rather than an empty result.
          </p>
        </section>
      </CockpitShell>
    )
  }

  if (state.kind === 'refused') {
    return (
      <CockpitShell
        banner={
          <>
            <CircleDashed size={15} aria-hidden="true" />
            <span>The V2 bridge refused this request.</span>
          </>
        }
      >
        <section className="section-block" aria-labelledby="cockpit-refused">
          <span className="eyebrow">Coverage cockpit · refused</span>
          <h1 id="cockpit-refused">The bridge declined to serve this store.</h1>
          <p>
            Refusal code: <strong data-testid="cockpit-refusal-code">{state.code}</strong>. The V2
            read path serves only a store carrying explicit synthetic provenance, and it fails
            closed rather than guessing.
          </p>
        </section>
      </CockpitShell>
    )
  }

  return (
    <CockpitShell
      banner={
        <>
          <Sparkles size={15} aria-hidden="true" />
          <span>
            Synthetic store · marker {state.provenance.syntheticMarker ?? 'absent'} · importer{' '}
            {state.provenance.importerVersion}. No account, repository, or local-history input.
          </span>
        </>
      }
    >
      <section className="section-block" aria-labelledby="cockpit-heading">
        <span className="eyebrow">Coverage cockpit · V2 bootstrap slice</span>
        <h1 id="cockpit-heading">What this lens cannot see is part of what it reports.</h1>
        <p>
          Every row below is a recorded coverage state. Absence is rendered as the state that caused
          it — never as a zero, and never as a blank cell.
        </p>
      </section>

      <section className="section-block" aria-labelledby="cockpit-coverage-heading">
        <h2 id="cockpit-coverage-heading">Coverage states</h2>
        {state.coverage.length === 0 ? (
          <p data-testid="cockpit-coverage-empty">
            The synthetic store recorded no coverage rows. Nothing is claimed for this window.
          </p>
        ) : (
          <ol className="cockpit-coverage" aria-label="Recorded coverage states">
            {state.coverage.map((record) => (
              <CoverageRow key={record.coverageId} record={record} />
            ))}
          </ol>
        )}
      </section>

      <section className="section-block" aria-labelledby="cockpit-capability-heading">
        <h2 id="cockpit-capability-heading">Capability lifecycle</h2>
        <p>This table reports lifecycle state. Nothing on this surface transitions a capability.</p>
        <table className="cockpit-capabilities">
          <caption>Capability lifecycle — reported, never transitioned</caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Lifecycle state</th>
              <th scope="col">Purpose</th>
              <th scope="col">Class ceiling</th>
              <th scope="col">Required gates</th>
              <th scope="col">Refusal state</th>
            </tr>
          </thead>
          <tbody>
            {state.capabilities.map((capability) => (
              <tr key={capability.id}>
                <th scope="row">{capability.id}</th>
                <td data-testid={`lifecycle-${capability.id}`}>{capability.lifecycleState}</td>
                <td>{capability.purposeCode}</td>
                <td>{capability.classCeiling}</td>
                <td>{capability.requiredGates.join(', ')}</td>
                <td>{capability.refusalStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </CockpitShell>
  )
}

function refusalCode(body: unknown): string {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code
  return typeof code === 'string' ? code : 'V2_UNAVAILABLE'
}

export function CoverageCockpitV2Route() {
  const [state, setState] = useState<CoverageCockpitState>({ kind: 'loading' })

  useEffect(() => {
    const token: unknown = import.meta.env.VITE_DEVELOPER_LENS_V2_TOKEN
    if (typeof token !== 'string' || token.length === 0) {
      setState({ kind: 'unconfigured' })
      return
    }

    const controller = new AbortController()
    const init = {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }

    Promise.all([fetch('/api/v2/coverage', init), fetch('/api/v2/capabilities', init)])
      .then(async ([coverageResponse, capabilitiesResponse]) => {
        const failed = !coverageResponse.ok
          ? coverageResponse
          : !capabilitiesResponse.ok
            ? capabilitiesResponse
            : null
        if (failed) {
          setState({ kind: 'refused', code: refusalCode(await failed.json().catch(() => null)) })
          return
        }
        const coverage = (await coverageResponse.json()) as V2CoverageResponse
        const capabilities = (await capabilitiesResponse.json()) as V2CapabilitiesResponse
        setState({
          kind: 'ready',
          provenance: coverage.provenance,
          coverage: coverage.records,
          capabilities: capabilities.capabilities,
        })
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') return
        setState({ kind: 'refused', code: 'V2_UNAVAILABLE' })
      })

    return () => controller.abort()
  }, [])

  return <CoverageCockpitV2 state={state} />
}
