import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCapabilityViews } from '../../server/api/v2/contract'
import {
  SYNTHETIC_COVERAGE_RECORDS,
  SYNTHETIC_STORE_PROVENANCE,
} from '../../server/api/v2/syntheticCoverageFixtures'
import { COVERAGE_STATUSES } from '../../shared/coverage'
import { CoverageCockpitV2, CoverageCockpitV2Route } from './CoverageCockpitV2'

const capabilities = buildCapabilityViews()

function renderReady(coverage = SYNTHETIC_COVERAGE_RECORDS) {
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

    for (const coverageId of [
      'synthetic-coverage-never-authorized',
      'synthetic-coverage-refused',
      'synthetic-coverage-unavailable',
      'synthetic-coverage-failed',
    ]) {
      const observed = screen.getByTestId(`observed-${coverageId}`)
      expect(observed.textContent).not.toMatch(/\d/)
    }

    expect(screen.getByTestId('observed-synthetic-coverage-never-authorized')).toHaveTextContent(
      /never authorized — nothing was ever collected/i,
    )
    expect(screen.getByTestId('observed-synthetic-coverage-refused')).toHaveTextContent(
      /refused — the owner declined this source/i,
    )
    // A deleted row holds zero observed units in the store and must still read as a state.
    expect(screen.getByTestId('observed-synthetic-coverage-deleted')).toHaveTextContent(
      /deleted — records were removed on request/i,
    )
    expect(screen.getByTestId('observed-synthetic-coverage-deleted').textContent).not.toMatch(/\d/)
    // A restricted row observed some units, but a partial state is never a rendered count.
    expect(screen.getByTestId('observed-synthetic-coverage-restricted').textContent).not.toMatch(
      /\d/,
    )
  })

  it('renders a count only for complete coverage and names the limitation everywhere else', () => {
    renderReady()

    expect(screen.getByTestId('observed-synthetic-coverage-complete')).toHaveTextContent(
      '128 observed units',
    )
    expect(screen.getByTestId('limitation-synthetic-coverage-never-authorized')).toHaveTextContent(
      'CAPABILITY_NEVER_AUTHORIZED',
    )
    expect(screen.getByTestId('omitted-synthetic-coverage-never-authorized')).toHaveTextContent(
      'unknown',
    )
    expect(screen.getByTestId('omitted-synthetic-coverage-stale')).toHaveTextContent('none')
    expect(screen.getByTestId('omitted-synthetic-coverage-restricted')).toHaveTextContent(
      '28 units',
    )
    expect(screen.getByText('RESULT_WINDOW_SATURATED')).toBeInTheDocument()
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

  it('reports its own blindness when no launch bearer reached the page', () => {
    render(<CoverageCockpitV2 state={{ kind: 'unconfigured' }} />)

    expect(
      screen.getByRole('heading', { name: /cannot see the v2 store yet/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/reports its own blindness/i)).toBeInTheDocument()
  })

  it('surfaces a typed refusal code instead of an empty result', () => {
    render(<CoverageCockpitV2 state={{ kind: 'refused', code: 'V2_STORE_PROVENANCE_REFUSED' }} />)

    expect(screen.getByTestId('cockpit-refusal-code')).toHaveTextContent(
      'V2_STORE_PROVENANCE_REFUSED',
    )
  })

  it('never calls the API without a configured launch bearer', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<CoverageCockpitV2Route />)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /cannot see the v2 store yet/i })).toBeInTheDocument(),
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
