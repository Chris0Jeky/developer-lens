import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import fixtureText from '../../research-contracts/method-trial-view/v1/wbc1.fixture.json?raw'
import { MethodTrialViewSchema, type MethodTrialView } from '../../shared/methodTrialView'
import { MethodTrialViewPanel } from './MethodTrialRoute'

const fixture = MethodTrialViewSchema.parse(JSON.parse(fixtureText))
type RunKind = 'missing' | 'planted' | 'confound'

function addRun(view: MethodTrialView, caseIndex: number, start: number, end: number, kind: RunKind) {
  for (let index = start; index <= end; index += 1) {
    const point = view.representative_cases[caseIndex].points[index]
    if (kind === 'missing') {
      point.observed = { state: 'missing', reason: 'not_collected' }
      point.baseline.alert = false
      point.candidate.alert = false
      point.baseline.score = { status: 'unavailable', reason: 'missing_observation' }
      point.baseline.threshold = { status: 'unavailable', reason: 'missing_observation' }
      point.candidate.probability = { status: 'unavailable', reason: 'missing_observation' }
      point.candidate.threshold = { status: 'unavailable', reason: 'missing_observation' }
    } else if (kind === 'planted') {
      point.planted_marker = 'level'
    } else {
      point.confound_marker = 'parser_shift'
    }
  }
}

function statesFor(caseIndex: number) {
  return within(screen.getAllByTestId('method-trial-timeline')[caseIndex]).getByRole('list')
}

describe('Method Trial text alternatives retain run endings (#189)', () => {
  afterEach(cleanup)

  it.each([
    ['missing', 0], ['planted', 1], ['confound', 2],
  ] as const)('announces the first ordinary week after a %s run', (kind, caseIndex) => {
    const view = structuredClone(fixture)
    addRun(view, caseIndex, 10, 12, kind)
    render(<MethodTrialViewPanel view={MethodTrialViewSchema.parse(view)} />)

    const states = within(statesFor(caseIndex))
    expect(states.getByText('week-010')).toBeInTheDocument()
    expect(states.getByText('week-013').closest('li')).toHaveTextContent('observed; no marker')
    expect(states.queryByText('week-011')).not.toBeInTheDocument()
    expect(states.queryByText('week-012')).not.toBeInTheDocument()
    expect(states.queryByText('week-014')).not.toBeInTheDocument()
    expect(states.getByText('2 more declared missing/marker events remain in the validated fixture.')).toBeInTheDocument()
  })

  it('retains each resume point across multiple missing runs', () => {
    const view = structuredClone(fixture)
    addRun(view, 0, 10, 12, 'missing')
    addRun(view, 0, 20, 21, 'missing')
    render(<MethodTrialViewPanel view={MethodTrialViewSchema.parse(view)} />)

    const states = within(statesFor(0))
    for (const week of ['week-010', 'week-013', 'week-020', 'week-022']) {
      expect(states.getByText(week)).toBeInTheDocument()
    }
    expect(states.getByText('3 more declared missing/marker events remain in the validated fixture.')).toBeInTheDocument()
  })

  it('retains an offline PELT boundary inside a run as well as its end', () => {
    const view = structuredClone(fixture)
    addRun(view, 0, 10, 12, 'missing')
    view.representative_cases[0].points[11].pelt_marker.boundary = true
    render(<MethodTrialViewPanel view={MethodTrialViewSchema.parse(view)} />)

    const states = within(statesFor(0))
    expect(states.getByText('week-011').closest('li')).toHaveTextContent('PELT boundary')
    expect(states.getByText('week-013').closest('li')).toHaveTextContent('observed; no marker')
    expect(states.getByText('1 more declared missing/marker events remain in the validated fixture.')).toBeInTheDocument()
  })

  it('does not turn ordinary continuation weeks into notable states', () => {
    render(<MethodTrialViewPanel view={fixture} />)
    const figure = screen.getAllByTestId('method-trial-timeline')[0]
    expect(within(figure).queryByRole('list')).not.toBeInTheDocument()
  })

  it('does not invent recovery after a run reaches the end of the window', () => {
    const view = structuredClone(fixture)
    addRun(view, 0, 102, 103, 'missing')
    render(<MethodTrialViewPanel view={MethodTrialViewSchema.parse(view)} />)

    const states = within(statesFor(0))
    expect(states.getByText('week-102')).toBeInTheDocument()
    expect(states.queryByText('week-103')).not.toBeInTheDocument()
    expect(states.queryByText('week-104')).not.toBeInTheDocument()
    expect(states.getAllByRole('listitem')).toHaveLength(2)
  })
})
