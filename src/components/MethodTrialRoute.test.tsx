import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fixtureText from '../../research-contracts/method-trial-view/v1/wbc1.fixture.json?raw'
import { MethodTrialViewSchema } from '../../shared/methodTrialView'
import { MethodTrialViewPanel } from './MethodTrialRoute'

const fixture = MethodTrialViewSchema.parse(JSON.parse(fixtureText))

describe('MethodTrialViewPanel', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the validated rejected C0 story, three deterministic timelines, and disclosure offline', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<MethodTrialViewPanel view={fixture} />)

    expect(screen.getByText('Method trial · C0 invented evidence')).toBeInTheDocument()
    expect(screen.getByText('REJECTED')).toBeInTheDocument()
    expect(screen.getByText(/41\.6% more.*false alerts/i)).toBeInTheDocument()
    expect(screen.getByText(/candidate added exactly/i)).toHaveTextContent('1.2333 false alerts per year')
    expect(screen.getByText(/PELT is labelled offline descriptive/i)).toBeInTheDocument()
    expect(screen.getByText(/deterministic final-holdout selection/i)).toBeInTheDocument()
    expect(screen.getAllByTestId('method-trial-timeline')).toHaveLength(3)
    expect(screen.getAllByRole('figure')).toHaveLength(3)
    expect(screen.getByText('CANDIDATE_FALSE_ALERT_IMPROVEMENT')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Supported' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Unsupported' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Limitations' })).toBeInTheDocument()
    const disclosure = screen.getByText(/Reproducibility disclosure/i).closest('details')
    expect(disclosure).not.toHaveAttribute('open')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
