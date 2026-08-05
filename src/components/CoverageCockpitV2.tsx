import { useEffect, useState, type ReactNode } from 'react'
import { CircleDashed, Lock, Sparkles } from 'lucide-react'
import type { CoverageStatus } from '../../shared/coverage'
import type {
  CoveragePresentationView,
  V2CapabilitiesResponse,
  V2CoverageResponse,
} from '../../server/api/v2/contract'
import {
  cockpitStateForStatus,
  omittedLabel,
  refusalCode,
  type CoverageCockpitProblemKind,
  type CoverageCockpitState,
} from '../lib/coverageCockpit'
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

interface ProblemView {
  readonly banner: string
  readonly eyebrow: string
  readonly heading: string
  readonly body: ReactNode
}

const PROBLEM_VIEWS: Readonly<Record<CoverageCockpitProblemKind, ProblemView>> = {
  unauthorized: {
    banner: 'The V2 bridge did not accept this request.',
    eyebrow: 'Coverage cockpit · request not authenticated',
    heading: 'The bridge could not tell that this was a same-origin page request.',
    body: (
      <p>
        This page holds no credential by design. It is authenticated by the browser’s own
        same-origin fetch metadata, which something between the page and the API stripped —
        typically a proxy or extension that rewrites <code>Sec-Fetch-*</code> headers. Reach the
        cockpit directly through <code>npm run dev</code> rather than through another hop.
      </p>
    ),
  },
  'guard-refused': {
    banner: 'The V2 bridge rejected where this request came from.',
    eyebrow: 'Coverage cockpit · origin refused',
    heading: 'The bridge did not recognise this request’s host or origin.',
    body: (
      <p>
        The V2 endpoints answer only on loopback, against an exact Host and Origin allowlist with no
        CORS. Reach the cockpit through <code>http://127.0.0.1:5173</code> or the API’s own origin,
        not through another hostname, alias, or tunnel.
      </p>
    ),
  },
  'provenance-refused': {
    banner: 'The V2 bridge refused this store.',
    eyebrow: 'Coverage cockpit · store refused',
    heading: 'The bridge declined to serve this store.',
    body: (
      <p>
        The V2 read path serves only a store carrying explicit synthetic provenance, and it fails
        closed rather than guessing. Reseed it with <code>npm run seed:v2</code>.
      </p>
    ),
  },
  'store-unavailable': {
    banner: 'The V2 bridge found no store to read.',
    eyebrow: 'Coverage cockpit · no store',
    heading: 'There is no synthetic store here yet.',
    body: (
      <p>
        Run <code>npm run seed:v2</code> to write the invented coverage fixtures, then reload. The
        bridge serves nothing rather than inventing a store to fill the page.
      </p>
    ),
  },
  'transport-error': {
    banner: 'The local API did not answer.',
    eyebrow: 'Coverage cockpit · service unreachable',
    heading: 'The local service is not responding.',
    body: (
      <p>
        Start it with <code>npm run dev</code>. Nothing is claimed about coverage while the service
        is unreachable — an unanswered request is not an empty result.
      </p>
    ),
  },
  error: {
    banner: 'The V2 bridge returned an unexpected outcome.',
    eyebrow: 'Coverage cockpit · unexpected outcome',
    heading: 'The bridge returned an outcome this page does not model.',
    body: (
      <p>
        This is reported rather than absorbed, so the surface never shows a confident empty state it
        cannot justify.
      </p>
    ),
  },
}

function CockpitProblem({ view, code }: { view: ProblemView; code?: string }) {
  const headingId = 'cockpit-problem-heading'
  return (
    <CockpitShell
      banner={
        <>
          <CircleDashed size={15} aria-hidden="true" />
          <span>{view.banner}</span>
        </>
      }
    >
      <section className="section-block" aria-labelledby={headingId}>
        <span className="eyebrow">{view.eyebrow}</span>
        <h1 id={headingId}>{view.heading}</h1>
        {view.body}
        {code !== undefined && (
          <p>
            Refusal code: <strong data-testid="cockpit-refusal-code">{code}</strong>
          </p>
        )}
      </section>
    </CockpitShell>
  )
}

/**
 * One projected coverage row (#79). Everything it can render arrives already projected: the
 * window labels are ISO-week strings computed server-side, and `observedUnits` is already null
 * for every non-complete state. There is no scope alias and no coverage identifier to render,
 * and the test hooks hang off the projection-local `rowKey` rather than a storage id.
 */
function CoverageRow({ record }: { record: CoveragePresentationView }) {
  const presentation = STATUS_PRESENTATION[record.status]

  return (
    <li className="cockpit-coverage__row" data-status={record.status}>
      <div className="cockpit-coverage__identity">
        <span className="cockpit-coverage__status">{presentation.label}</span>
        <strong>{record.capabilityId}</strong>
      </div>
      <p className="cockpit-coverage__observed" data-testid={`observed-${record.rowKey}`}>
        {record.observedUnits === null
          ? presentation.absence
          : `${record.observedUnits.toLocaleString('en-GB')} observed units`}
      </p>
      <dl className="cockpit-coverage__facts">
        <div>
          <dt>Limitation</dt>
          <dd data-testid={`limitation-${record.rowKey}`}>{record.limitationCode}</dd>
        </div>
        <div>
          <dt>Omitted</dt>
          <dd data-testid={`omitted-${record.rowKey}`}>{omittedLabel(record.omittedUnits)}</dd>
        </div>
        <div>
          <dt>Window</dt>
          <dd>
            {record.windowStartLabel} → {record.windowEndLabel}
          </dd>
        </div>
        <div>
          <dt>Observed</dt>
          <dd>{record.observedAtLabel}</dd>
        </div>
        <div>
          <dt>Retryable</dt>
          <dd>{record.retryable ? 'yes' : 'no'}</dd>
        </div>
        {record.saturationReason !== null && (
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

  if (state.kind !== 'ready') {
    return (
      <CockpitProblem
        view={PROBLEM_VIEWS[state.kind]}
        code={'code' in state ? state.code : undefined}
      />
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
              <CoverageRow key={record.rowKey} record={record} />
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

export function CoverageCockpitV2Route() {
  const [state, setState] = useState<CoverageCockpitState>({ kind: 'loading' })

  useEffect(() => {
    // #78: no credential lives in this page. The requests are same-origin, so the browser sends
    // the `Sec-Fetch-*` proof the guard authenticates on and no `Authorization` header exists to
    // be inlined into a bundle.
    const controller = new AbortController()
    const init = { signal: controller.signal }

    Promise.all([fetch('/api/v2/coverage', init), fetch('/api/v2/capabilities', init)])
      .then(async ([coverageResponse, capabilitiesResponse]) => {
        const failed = !coverageResponse.ok
          ? coverageResponse
          : !capabilitiesResponse.ok
            ? capabilitiesResponse
            : null
        if (failed) {
          const code = refusalCode(await failed.json().catch(() => null))
          setState(cockpitStateForStatus(failed.status, code))
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
        // The request never produced a response at all — that is a transport
        // failure, not a refusal the bridge issued.
        setState({ kind: 'transport-error' })
      })

    return () => controller.abort()
  }, [])

  return <CoverageCockpitV2 state={state} />
}
