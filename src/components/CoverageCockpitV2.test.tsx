import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCapabilityViews, buildCoveragePresentationViews } from '../../server/api/v2/contract'
import {
  SYNTHETIC_COVERAGE_RECORDS,
  SYNTHETIC_STORE_PROVENANCE,
} from '../../server/api/v2/syntheticCoverageFixtures'
import { COVERAGE_STATUSES, type CoverageStatus } from '../../shared/coverage'
import { cockpitStateForStatus, isoWeekLabel } from '../lib/coverageCockpit'
import { CoverageCockpitV2, CoverageCockpitV2Route } from './CoverageCockpitV2'

const capabilities = buildCapabilityViews()

/**
 * The cockpit now consumes the projection the API serves (#79), not the canonical record. The
 * test builds it through the same function the router uses, so a projection change that dropped
 * a field the surface renders would fail here rather than only in production.
 */
const COVERAGE_VIEWS = buildCoveragePresentationViews(SYNTHETIC_COVERAGE_RECORDS)

/** Each synthetic fixture carries a distinct status, so status addresses exactly one row. */
function rowKey(status: CoverageStatus): string {
  const view = COVERAGE_VIEWS.find((entry) => entry.status === status)
  if (!view) throw new Error(`no synthetic coverage row for status ${status}`)
  return view.rowKey
}

function renderReady(coverage = COVERAGE_VIEWS) {
  return render(
    <CoverageCockpitV2
      state={{
        kind: 'ready',
        provenance: SYNTHETIC_STORE_PROVENANCE,
        coverage,
        capabilities,
      }}
    />,
  )
}

const STATUS_LABELS: Record<string, string> = {
  never_authorized: 'Never authorized',
  refused: 'Refused',
  unavailable: 'Unavailable',
  restricted: 'Restricted',
  truncated: 'Truncated',
  stale: 'Stale',
  failed: 'Failed',
  deleted: 'Deleted',
  censored: 'Censored',
  complete: 'Complete',
}

describe('Coverage Cockpit V2', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders every one of the ten coverage states from the synthetic importer output', () => {
    renderReady()

    const list = screen.getByRole('list', { name: /recorded coverage states/i })
    expect(within(list).getAllByRole('listitem')).toHaveLength(COVERAGE_STATUSES.length)
    for (const status of COVERAGE_STATUSES) {
      expect(within(list).getByText(STATUS_LABELS[status])).toBeInTheDocument()
    }
    expect(screen.getByText(/synthetic store/i)).toHaveTextContent(
      SYNTHETIC_STORE_PROVENANCE.syntheticMarker ?? 'absent',
    )
  })

  it('renders absence as a coverage state and never as a numeric zero', () => {
    renderReady()

    for (const status of ['never_authorized', 'refused', 'unavailable', 'failed'] as const) {
      const observed = screen.getByTestId(`observed-${rowKey(status)}`)
      expect(observed.textContent).not.toMatch(/\d/)
    }

    expect(screen.getByTestId(`observed-${rowKey('never_authorized')}`)).toHaveTextContent(
      /never authorized — nothing was ever collected/i,
    )
    expect(screen.getByTestId(`observed-${rowKey('refused')}`)).toHaveTextContent(
      /refused — the owner declined this source/i,
    )
    // A deleted row holds zero observed units in the store and must still read as a state.
    expect(screen.getByTestId(`observed-${rowKey('deleted')}`)).toHaveTextContent(
      /deleted — records were removed on request/i,
    )
    expect(screen.getByTestId(`observed-${rowKey('deleted')}`).textContent).not.toMatch(/\d/)
    // A restricted row observed some units, but a partial state is never a rendered count.
    expect(screen.getByTestId(`observed-${rowKey('restricted')}`).textContent).not.toMatch(/\d/)
  })

  it('renders a count only for complete coverage and names the limitation everywhere else', () => {
    renderReady()

    expect(screen.getByTestId(`observed-${rowKey('complete')}`)).toHaveTextContent(
      '128 observed units',
    )
    expect(screen.getByTestId(`limitation-${rowKey('never_authorized')}`)).toHaveTextContent(
      'CAPABILITY_NEVER_AUTHORIZED',
    )
    expect(screen.getByTestId(`omitted-${rowKey('never_authorized')}`)).toHaveTextContent('unknown')
    expect(screen.getByTestId(`omitted-${rowKey('stale')}`)).toHaveTextContent('none')
    expect(screen.getByTestId(`omitted-${rowKey('restricted')}`)).toHaveTextContent('28 units')
    expect(screen.getByText('RESULT_WINDOW_SATURATED')).toBeInTheDocument()
  })

  it('renders the projection only — no alias, no coverage id, no exact timestamp (#79)', () => {
    const { container } = renderReady()
    const rendered = container.textContent ?? ''

    for (const record of SYNTHETIC_COVERAGE_RECORDS) {
      expect(rendered).not.toContain(record.scopeAlias)
      expect(rendered).not.toContain(record.coverageId)
      for (const instant of [record.rangeStart, record.rangeEnd, record.observedAt]) {
        expect(rendered).not.toContain(instant)
      }
    }
    // What it does render is the week label the server computed.
    const complete = SYNTHETIC_COVERAGE_RECORDS.find((record) => record.status === 'complete')!
    expect(rendered).toContain(isoWeekLabel(complete.rangeStart))
    expect(rendered).toContain(isoWeekLabel(complete.rangeEnd))
    // The row key names nothing outside this response: it is a per-response ordinal.
    expect(COVERAGE_VIEWS.map((view) => view.rowKey)).toEqual(
      COVERAGE_VIEWS.map((_view, index) => `coverage-row-${index + 1}`),
    )
  })

  it('reports capability lifecycle without offering any transition', () => {
    renderReady()

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(capabilities.length + 1)
    for (const capability of capabilities) {
      expect(screen.getByTestId(`lifecycle-${capability.id}`)).toHaveTextContent('never_authorized')
    }
    expect(screen.getByText(/nothing on this surface transitions a capability/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('states an empty store explicitly rather than rendering a blank panel', () => {
    renderReady([])

    expect(screen.getByTestId('cockpit-coverage-empty')).toHaveTextContent(
      /recorded no coverage rows/i,
    )
  })

  it('never names a bearer variable the page no longer holds (#78)', () => {
    const { container } = render(
      <CoverageCockpitV2 state={{ kind: 'unauthorized', code: 'V2_UNAUTHORIZED' }} />,
    )

    expect(container.textContent).not.toMatch(/VITE_DEVELOPER_LENS_V2_TOKEN|DEVELOPER_LENS_V2_TOKEN/)
    expect(screen.getByText(/holds no credential by design/i)).toBeInTheDocument()
  })

  it('surfaces a typed refusal code instead of an empty result', () => {
    render(
      <CoverageCockpitV2 state={{ kind: 'provenance-refused', code: 'V2_STORE_PROVENANCE_REFUSED' }} />,
    )

    expect(screen.getByTestId('cockpit-refusal-code')).toHaveTextContent(
      'V2_STORE_PROVENANCE_REFUSED',
    )
    expect(screen.getByRole('heading', { name: /declined to serve this store/i })).toBeInTheDocument()
  })

  it('maps each failure to the state whose remediation actually fixes it', () => {
    expect(cockpitStateForStatus(401, 'V2_UNAUTHORIZED')).toEqual({
      kind: 'unauthorized',
      code: 'V2_UNAUTHORIZED',
    })
    expect(cockpitStateForStatus(403, 'V2_HOST_NOT_ALLOWED')).toEqual({
      kind: 'guard-refused',
      code: 'V2_HOST_NOT_ALLOWED',
    })
    expect(cockpitStateForStatus(409, 'V2_STORE_PROVENANCE_REFUSED')).toEqual({
      kind: 'provenance-refused',
      code: 'V2_STORE_PROVENANCE_REFUSED',
    })
    expect(cockpitStateForStatus(503, 'V2_STORE_UNAVAILABLE')).toEqual({
      kind: 'store-unavailable',
      code: 'V2_STORE_UNAVAILABLE',
    })
    expect(cockpitStateForStatus(418, 'V2_UNAVAILABLE')).toEqual({
      kind: 'error',
      code: 'V2_UNAVAILABLE',
    })
  })

  it('tells an unauthenticated request to check the hop, not to inspect the store', () => {
    render(<CoverageCockpitV2 state={{ kind: 'unauthorized', code: 'V2_UNAUTHORIZED' }} />)

    expect(
      screen.getByRole('heading', { name: /same-origin page request/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/proxy or extension that rewrites/i)).toBeInTheDocument()
    expect(screen.getByText('Sec-Fetch-*')).toBeInTheDocument()
    expect(screen.getByTestId('cockpit-refusal-code')).toHaveTextContent('V2_UNAUTHORIZED')
    expect(screen.queryByText(/synthetic provenance/i)).not.toBeInTheDocument()
  })

  it('tells a rejected origin about the host allowlist, not about provenance', () => {
    render(<CoverageCockpitV2 state={{ kind: 'guard-refused', code: 'V2_ORIGIN_NOT_ALLOWED' }} />)

    expect(
      screen.getByRole('heading', { name: /did not recognise this request/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/exact Host and Origin allowlist/i)).toBeInTheDocument()
    expect(screen.getByTestId('cockpit-refusal-code')).toHaveTextContent('V2_ORIGIN_NOT_ALLOWED')
  })

  it('separates a missing store and an unreachable service', () => {
    render(<CoverageCockpitV2 state={{ kind: 'store-unavailable', code: 'V2_STORE_UNAVAILABLE' }} />)
    expect(screen.getByText(/npm run seed:v2/i)).toBeInTheDocument()
    cleanup()

    render(<CoverageCockpitV2 state={{ kind: 'transport-error' }} />)
    expect(screen.getByRole('heading', { name: /not responding/i })).toBeInTheDocument()
    expect(screen.getByText(/an unanswered request is not an empty result/i)).toBeInTheDocument()
    expect(screen.queryByTestId('cockpit-refusal-code')).not.toBeInTheDocument()
  })

  it('derives ISO weeks from the UTC calendar date, not the viewer timezone', () => {
    // 2026-08-03T00:00:00Z is a Monday in UTC and 2026-08-02 (the previous ISO
    // week) in every negative-offset zone. Both ends of the UTC day must agree.
    expect(isoWeekLabel('2026-08-03T00:00:00.000Z')).toBe('2026-W32')
    expect(isoWeekLabel('2026-08-03T23:59:59.999Z')).toBe('2026-W32')
    expect(isoWeekLabel('2026-08-02T23:59:59.999Z')).toBe('2026-W31')
    // ISO year boundary: 2026-01-01 belongs to ISO week 1 of 2026.
    expect(isoWeekLabel('2026-01-01T00:00:00.000Z')).toBe('2026-W01')
    expect(isoWeekLabel('not-a-timestamp')).toBe('unknown')

    const originalTimezone = process.env.TZ
    try {
      for (const timezone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
        process.env.TZ = timezone
        expect(isoWeekLabel('2026-08-03T00:00:00.000Z')).toBe('2026-W32')
      }
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ
      else process.env.TZ = originalTimezone
    }
  })

  it('renders the stale row observed before the window it describes', () => {
    renderReady()

    const stale = SYNTHETIC_COVERAGE_RECORDS.find((record) => record.status === 'stale')
    expect(stale).toBeDefined()
    expect(Date.parse(stale!.observedAt)).toBeLessThan(Date.parse(stale!.rangeStart))
  })

  it('fetches same-origin and sends no credential at all (#78)', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<CoverageCockpitV2Route />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls.map((call) => (call as unknown as [string])[0])).toEqual([
      '/api/v2/coverage',
      '/api/v2/capabilities',
    ])
    for (const call of fetchMock.mock.calls) {
      const init = (call as unknown as [string, RequestInit | undefined])[1]
      expect(init).toBeDefined()
      expect(Object.keys(init!)).toEqual(['signal'])
      expect(init).not.toHaveProperty('headers')
    }
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /no synthetic store here yet/i })).toBeInTheDocument(),
    )
  })
})
