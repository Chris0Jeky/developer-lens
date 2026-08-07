import { cleanup, render, screen, within } from '@testing-library/react'
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
    expect(screen.getAllByTestId('baseline-alert-marker')).toHaveLength(
      fixture.representative_cases.flatMap((representativeCase) =>
        representativeCase.points.filter((point) => point.baseline.alert),
      ).length,
    )
    expect(screen.getAllByTestId('candidate-alert-marker')).toHaveLength(
      fixture.representative_cases.flatMap((representativeCase) =>
        representativeCase.points.filter((point) => point.candidate.alert),
      ).length,
    )
    expect(screen.getAllByText('Baseline alert (square)')).toHaveLength(3)
    expect(screen.getAllByText('Candidate alert (diamond)')).toHaveLength(3)
    expect(screen.getByText('CANDIDATE_FALSE_ALERT_IMPROVEMENT')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Supported' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Unsupported' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Limitations' })).toBeInTheDocument()
    const disclosure = screen.getByText(/Reproducibility disclosure/i).closest('details')
    expect(disclosure).not.toHaveAttribute('open')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders exactly one continuous timeline segment per series for the benign committed fixture', () => {
    render(<MethodTrialViewPanel view={fixture} />)

    screen.getAllByTestId('method-trial-timeline').forEach((figure) => {
      expect(within(figure).getAllByTestId('timeline-segment-baseline')).toHaveLength(1)
      expect(within(figure).getAllByTestId('timeline-segment-candidate')).toHaveLength(1)
    })
  })

  it('breaks timeline segments at an interior missing observation instead of bridging measured neighbors', () => {
    const view = structuredClone(fixture)
    const gap = view.representative_cases[0].points[50]
    gap.observed = { state: 'missing', reason: 'not_collected' }
    gap.baseline.alert = false
    gap.candidate.alert = false
    gap.baseline.score = { status: 'unavailable', reason: 'missing_observation' }
    gap.baseline.threshold = { status: 'unavailable', reason: 'missing_observation' }
    gap.candidate.probability = { status: 'unavailable', reason: 'missing_observation' }
    gap.candidate.threshold = { status: 'unavailable', reason: 'missing_observation' }
    const parsed = MethodTrialViewSchema.parse(view)

    render(<MethodTrialViewPanel view={parsed} />)

    const figure = screen.getAllByTestId('method-trial-timeline')[0]
    const baselineSegments = within(figure).getAllByTestId('timeline-segment-baseline')
    const candidateSegments = within(figure).getAllByTestId('timeline-segment-candidate')
    // One measured run before the gap (weeks 0-49) and one after (weeks 51-103).
    expect(baselineSegments).toHaveLength(2)
    expect(candidateSegments).toHaveLength(2)
    const pairCount = (polyline: Element) => polyline.getAttribute('points')!.trim().split(/\s+/).length
    expect(pairCount(baselineSegments[0])).toBe(50)
    expect(pairCount(baselineSegments[1])).toBe(53)
    // No single segment bridges the missing index: the gap x-coordinate is absent from both runs.
    const gapX = 36 + (50 / (view.representative_cases[0].points.length - 1)) * (740 - 36)
    for (const segment of baselineSegments) {
      for (const pair of segment.getAttribute('points')!.trim().split(/\s+/)) {
        expect(Number(pair.split(',')[0])).not.toBeCloseTo(gapX, 6)
      }
    }
  })

  it('retains distinct transitions and PELT boundaries while collapsing a persistent missing run', () => {
    const view = structuredClone(fixture)
    const points = view.representative_cases[1].points // planted_change
    for (let index = 10; index <= 30; index += 1) {
      const point = points[index]
      point.observed = { state: 'missing', reason: 'not_collected' }
      point.planted_marker = 'none'
      point.confound_marker = 'none'
      point.pelt_marker = { evaluation_mode: 'offline_descriptive', boundary: false }
      point.baseline.alert = false
      point.candidate.alert = false
      point.baseline.score = { status: 'unavailable', reason: 'missing_observation' }
      point.baseline.threshold = { status: 'unavailable', reason: 'missing_observation' }
      point.candidate.probability = { status: 'unavailable', reason: 'missing_observation' }
      point.candidate.threshold = { status: 'unavailable', reason: 'missing_observation' }
    }
    // A PELT boundary at week 60 and a planted level transition at week 61 must both survive.
    points[60].planted_marker = 'none'
    points[60].confound_marker = 'none'
    points[60].pelt_marker = { evaluation_mode: 'offline_descriptive', boundary: true }
    points[61].planted_marker = 'level'
    points[61].confound_marker = 'none'
    points[61].pelt_marker = { evaluation_mode: 'offline_descriptive', boundary: false }
    const parsed = MethodTrialViewSchema.parse(view)

    render(<MethodTrialViewPanel view={parsed} />)

    const figure = screen.getAllByTestId('method-trial-timeline')[1]
    // Onset of the missing run, plus the later distinct events, are all present.
    expect(within(figure).getByText('week-010')).toBeInTheDocument()
    expect(within(figure).getByText('week-060')).toBeInTheDocument()
    expect(within(figure).getByText('week-061')).toBeInTheDocument()
    // Persistent continuation weeks are collapsed, not listed individually.
    expect(within(figure).queryByText('week-015')).not.toBeInTheDocument()
    expect(within(figure).queryByText('week-030')).not.toBeInTheDocument()
    // Exactly the 20 collapsed persistent weeks (11..30) are summarized.
    expect(
      within(figure).getByText('20 more declared missing/marker events remain in the validated fixture.'),
    ).toBeInTheDocument()
  })

  it('keeps every fixture distinct transition/PELT boundary without a truncation summary', () => {
    render(<MethodTrialViewPanel view={fixture} />)

    const case2 = screen.getAllByTestId('method-trial-timeline')[1]
    expect(within(case2).getByText('week-060')).toBeInTheDocument()
    expect(within(case2).getByText('week-061')).toBeInTheDocument()
    expect(within(case2).getByText('week-078')).toBeInTheDocument()
    expect(within(case2).queryByText(/more declared missing\/marker events/)).not.toBeInTheDocument()
  })

  it('renders neutral factual detection copy when detection rates are measured but unequal', () => {
    const view = structuredClone(fixture)
    view.scorecard.candidate.detection_rate = { status: 'measured', value: 0.8 }
    // Mirror the new candidate detection into the two gates that reference it.
    view.acceptance_gates[2].relevant_values!.candidate = { status: 'measured', value: 0.8 }
    view.acceptance_gates[5].relevant_values!.candidate = { status: 'measured', value: 0.8 }
    const parsed = MethodTrialViewSchema.parse(view)

    render(<MethodTrialViewPanel view={parsed} />)

    const headline = document.querySelector('.method-trial-headline')!
    expect(headline).not.toHaveTextContent(/Equal detection/i)
    expect(headline).toHaveTextContent('Detection: baseline 75.0% vs candidate 80.0%')
    // The decision paragraph derives the same detection claim rather than asserting "no detection gain".
    const emphasis = document.querySelector('.method-trial-emphasis')!
    expect(emphasis).toHaveTextContent('with a candidate detection gain')
    expect(emphasis).not.toHaveTextContent('with no detection gain')
  })

  it('renders neutral copy when the candidate false-alert measurement is unavailable', () => {
    const view = structuredClone(fixture)
    view.scorecard.candidate.false_alerts_per_year = { status: 'unavailable', reason: 'not_measured' }
    // The false-alert improvement gate becomes not_applicable and drops out of the failed reasons.
    view.acceptance_gates[4].outcome = 'not_applicable'
    view.acceptance_gates[4].relevant_values!.candidate = { status: 'unavailable', reason: 'not_measured' }
    view.decision.reason_codes = ['BASELINE_SELECTION_VIABLE', 'CANDIDATE_SELECTION_VIABLE']
    const parsed = MethodTrialViewSchema.parse(view)

    render(<MethodTrialViewPanel view={parsed} />)

    const headline = document.querySelector('.method-trial-headline')!
    expect(headline).toHaveTextContent('the candidate false-alert comparison is unavailable')
    expect(headline).not.toHaveTextContent(/% more/)
    expect(headline).not.toHaveTextContent(/% fewer/)
    const emphasis = document.querySelector('.method-trial-emphasis')!
    expect(emphasis).toHaveTextContent(
      'The candidate added an unavailable number of additional false alerts per year',
    )
    expect(emphasis).not.toHaveTextContent(/added exactly/)
  })
})
