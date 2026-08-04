import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { IntegrationShapeAtlasPanel } from './IntegrationShapeAtlas'
import { buildIntegrationShapePresentation } from '../../shared/integrationShape'
import { CAUSAL_OR_EVALUATIVE_TERMS } from '../../shared/findings'

const presentation = buildIntegrationShapePresentation()

function renderPanel() {
  return render(<IntegrationShapeAtlasPanel presentation={presentation} />)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

/**
 * DL-VALUE-01 — the rendered walkthrough proof. Walks the running panel question → cohort → matched
 * comparison → distribution/tail → counts → coverage → alternative/counter-evidence → limitation →
 * sensitivity → evidence lineage, asserting each stage's rendered content and that every mark opens
 * the Evidence Drawer onto the complete walk.
 */

describe('IntegrationShapeAtlas — every stage of the walk renders', () => {
  it('renders the question, cohort, and matched-comparison stages', () => {
    renderPanel()
    expect(screen.getByTestId('stage-question')).toHaveTextContent(/how did pr integration shape differ/i)
    expect(screen.getByTestId('stage-cohort')).toHaveTextContent(/became ready for review inside each matched/i)
    const comparison = screen.getByTestId('stage-comparison')
    expect(comparison).toHaveTextContent(/FULL/)
    // The three-outcome table shows all three outcomes for honesty.
    const outcomeRows = within(screen.getByTestId('atlas-outcome-table')).getAllByRole('row')
    const outcomes = outcomeRows.map((row) => row.getAttribute('data-outcome')).filter(Boolean)
    expect(outcomes).toEqual(['FULL', 'MATCHED_PARTIAL', 'INCOMPARABLE'])
  })

  it('renders the distribution/tail as quantiles, never a bare mean', () => {
    renderPanel()
    const table = screen.getByTestId('atlas-distribution-table')
    expect(within(table).getByText(/p50 \(median\)/i)).toBeInTheDocument()
    expect(within(table).getByText(/p90 \(tail\)/i)).toBeInTheDocument()
    // Signed day deltas as marks.
    expect(within(table).getByRole('button', { name: /p50 \(median\) difference: -2\.0 d/i })).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: /p90 \(tail\) difference: -5\.0 d/i })).toBeInTheDocument()
  })

  it('renders every honest count including the empty-cohort variant', () => {
    renderPanel()
    const counts = screen.getByTestId('atlas-counts')
    expect(within(counts).getByRole('button', { name: /current eligible cohort: 10/i })).toBeInTheDocument()
    expect(within(counts).getByRole('button', { name: /current right-censored: 3/i })).toBeInTheDocument()
    expect(counts).toHaveTextContent('BECAME_READY_OUTSIDE_WINDOW: 1')
    expect(counts).toHaveTextContent('MISSING_CREATION_TIMESTAMP: 1')
    expect(screen.getByTestId('atlas-empty-cohort')).toHaveTextContent(/eligible 0 vs baseline 8/i)
  })

  it('renders the metric-specific coverage vector', () => {
    renderPanel()
    const coverage = screen.getByTestId('atlas-coverage')
    for (const dimension of ['permission', 'completeness', 'eligibility', 'freshness', 'censoring_freedom', 'sample', 'comparability']) {
      expect(coverage.querySelector(`[data-dimension="${dimension}"]`)).not.toBeNull()
    }
  })

  it('renders alternatives, what would discriminate, and the contradicting evidence', () => {
    renderPanel()
    const alternatives = screen.getByTestId('atlas-alternatives')
    expect(alternatives).toHaveTextContent('CENSORING_ARTIFACT')
    expect(alternatives).toHaveTextContent('RELEASE_FREEZE')
    expect(screen.getByTestId('atlas-discriminating')).toHaveTextContent(/would separate a genuine distribution difference/i)
    expect(within(screen.getByTestId('atlas-counter-evidence')).getByRole('button', { name: /contradicting evidence/i })).toBeInTheDocument()
  })

  it('renders the censoring-aware sensitivity, showing the tail reversal, and every limitation', () => {
    renderPanel()
    expect(screen.getByTestId('atlas-robustness')).toHaveAttribute('data-status', 'fragile')
    const sensitivity = screen.getByTestId('atlas-sensitivity')
    // The p90 sensitivity delta is positive (reversed) while the headline was negative.
    const reversed = sensitivity.querySelector('td[data-reversed="true"]')
    expect(reversed).not.toBeNull()
    expect(reversed?.textContent).toContain('+2.0 d')
    const limitations = screen.getByTestId('atlas-limitations')
    expect(limitations).toHaveTextContent('CENSORED_TAILS_EXCLUDED')
    expect(limitations).toHaveTextContent('UNEQUAL_CENSORING_BETWEEN_SIDES')
    expect(limitations).toHaveTextContent('LINKAGE_NOT_CAUSAL')
    expect(screen.getByTestId('atlas-prohibited')).toHaveTextContent(/never a measure of any individual person/i)
  })

  it('renders the abstention variant honestly', () => {
    renderPanel()
    expect(screen.getByTestId('atlas-abstention')).toHaveTextContent(/SUPPORT_GATE_FAILED|withheld/i)
  })
})

describe('IntegrationShapeAtlas — evidence lineage opens from every mark', () => {
  it('opens the drawer on a derived quantile mark and resolves the full claim walk', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: /p50 \(median\) difference: -2\.0 d/i }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName(/why this number/i)
    // The supports edge to the current merge-event stream, and the contradicting open-tail edge.
    expect(within(dialog).getByText(/evidence ev_merge_events_current/i)).toBeInTheDocument()
    expect(within(dialog).getByTestId('edge-group-contradicts')).toHaveTextContent(/ev_open_tail_current/i)
    // The falsifying question the finding carries.
    expect(within(dialog).getByTestId('falsifying-question')).toHaveTextContent(/would separate a genuine distribution difference/i)
  })

  it('walks a supporting edge to its coverage, collection job, and capability terminus', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /p75 difference/i }))

    // Reveal the collapsed chain; the capability + consent revision become reachable.
    for (let pass = 0; pass < 25; pass += 1) {
      const collapsed = screen.queryAllByRole('button', { expanded: false })
      if (collapsed.length === 0) break
      for (const button of collapsed) await user.click(button)
    }
    expect(screen.getAllByText('github.core').length).toBeGreaterThan(0)
    expect(screen.getAllByText('consent-2026-06-01').length).toBeGreaterThan(0)
  })

  it('opens an observation anchor from the contradicting-evidence mark', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(within(screen.getByTestId('atlas-counter-evidence')).getByRole('button', { name: /contradicting evidence/i }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-reference-kind', 'observation')
    expect(dialog).toHaveAccessibleName(/observation ev_open_tail_current/i)
  })
})

describe('IntegrationShapeAtlas — copy discipline', () => {
  it('the observation carries no causal, evaluative, or confidence-scalar wording', () => {
    renderPanel()
    const observation = screen.getByTestId('atlas-observation').textContent ?? ''
    const tokens = observation.toLowerCase().split(/[^a-z0-9]+/)
    for (const term of CAUSAL_OR_EVALUATIVE_TERMS) {
      if (!term.includes('_')) expect(tokens).not.toContain(term)
    }
    expect(observation.toLowerCase()).not.toContain('confidence')
  })
})

describe('IntegrationShapeAtlas — routed in App and never fetches', () => {
  it('renders at ?view=integration-shape without a network call', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/?view=integration-shape')
    render(<App />)
    expect(screen.getByTestId('integration-shape-atlas')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
