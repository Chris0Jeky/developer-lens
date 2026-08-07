import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  atlasPresentationEndpoint,
  ChangeBatchIntegrationTailPanel,
  IntegrationShapeAtlasPanel,
  IntegrationShapeAtlasRoute,
} from './IntegrationShapeAtlas'
import { UNRESOLVABLE_COPY } from './evidenceDrawerCopy'
import { CLAIM_IDS, buildIntegrationShapePresentation } from '../../shared/integrationShape'
import { analyticReferenceId, CAUSAL_OR_EVALUATIVE_TERMS } from '../../shared/findings'
import { ChangeBatchIntegrationTailPresentationSchema } from '../../shared/changeBatchIntegrationTail'
import {
  INTEGRATION_SHAPE_REFERENCES,
  resolveIntegrationShapeEvidence,
} from '../../shared/integrationShapeEvidence'
import {
  SYNTHETIC_STORED_OBSERVATION_CURRENT,
  buildSyntheticV3StoredObservation,
  createSyntheticV3StoredObservationDatabase,
} from '../../server/analysis/syntheticV3StoredObservation'
import { buildV3StoredObservationEvidence } from '../../server/analysis/v3StoredObservationEvidence'
import { bridgeV3StoredObservation } from '../../server/analysis/v3StoredObservationBridge'

const presentation = buildIntegrationShapePresentation()
const stored = buildSyntheticV3StoredObservation()
const storedEvidence = buildV3StoredObservationEvidence(stored.envelope, stored.finding)
const resolutions = {
  ...Object.fromEntries(INTEGRATION_SHAPE_REFERENCES.map((reference) => [
    analyticReferenceId(reference),
    resolveIntegrationShapeEvidence(reference),
  ])),
  ...storedEvidence.resolutions,
}
const envelope = {
  presentationContractVersion: '2.0.0' as const,
  mode: 'synthetic' as const,
  presentation,
  storedObservation: {
    status: 'complete' as const,
    presentation: stored.envelope,
    finding: stored.finding,
  },
  resolutions,
}
const selectedEnvelope = {
  ...envelope,
  mode: 'selected_store' as const,
  presentation: null,
  storedObservation: {
    ...envelope.storedObservation,
    presentation: { ...stored.envelope, mode: 'selected_store' as const },
  },
}
const abstained = (() => {
  const db = createSyntheticV3StoredObservationDatabase()
  try {
    db.prepare(`UPDATE pull_request_fact SET state = 'OPEN', merged_at = NULL, closed_at = NULL
      WHERE ready_for_review_at >= ? AND ready_for_review_at < ?`)
      .run(SYNTHETIC_STORED_OBSERVATION_CURRENT.start, SYNTHETIC_STORED_OBSERVATION_CURRENT.end)
    return bridgeV3StoredObservation({
      db,
      scopeId: stored.envelope.scopeId,
      capabilityId: 'github.core',
      consentRevision: stored.envelope.consentRevision,
      baselineWindow: { start: '2026-06-05T00:00:00.000Z', end: '2026-07-03T00:00:00.000Z' },
      currentWindow: SYNTHETIC_STORED_OBSERVATION_CURRENT,
      asOf: '2026-08-01T00:00:00.000Z',
    })
  } finally {
    db.close()
  }
})()
if (abstained.status !== 'abstained') throw new Error('expected invented abstention fixture')
const abstainedEnvelope = {
  ...selectedEnvelope,
  storedObservation: {
    status: 'abstained' as const,
    code: abstained.code,
    finding: abstained.finding,
    deletionLineage: abstained.deletionLineage,
  },
  resolutions: {},
}

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

describe('IntegrationShapeAtlas — per-outcome honesty in the comparison table', () => {
  it('surfaces the matched-partial row limitation, residual, and matched-subwindow arithmetic basis', () => {
    renderPanel()
    const table = screen.getByTestId('atlas-outcome-table')
    const detail = table.querySelector('[data-outcome-detail="MATCHED_PARTIAL"]')
    expect(detail).not.toBeNull()
    // (c) The arithmetic basis makes the row visibly a recomputation over matched time, not the whole window.
    const basis = (detail as HTMLElement).querySelector('.atlas-outcome-basis')
    expect(basis).toHaveAttribute('data-arithmetic-basis', 'matched_subwindows_only')
    expect(basis).toHaveTextContent(/matched_subwindows_only/)
    // (a) The mandatory selection-bias limitation, with its statement text accessible on the row.
    const limitation = (detail as HTMLElement).querySelector('[data-limitation="MATCHED_SUBWINDOW_SELECTION_BIAS"]')
    expect(limitation).not.toBeNull()
    expect(limitation).toHaveTextContent(/non-random subsample/i)
    // (b) The residual: the unmatched stretch named by its disqualifying kind and coverage dimension.
    const residual = (detail as HTMLElement).querySelector('.atlas-outcome-residual [data-mismatch-kind="CONFIG_REVISION_CHANGED"]')
    expect(residual).not.toBeNull()
    expect(residual).toHaveAttribute('data-dimension', 'comparability')
    expect(residual).toHaveTextContent(/unmatched day 24\.0/)
    expect(residual).toHaveTextContent('28.0')
  })

  it('marks the FULL row as a whole-window computation with no unmatched residual', () => {
    renderPanel()
    const table = screen.getByTestId('atlas-outcome-table')
    const detail = table.querySelector('[data-outcome-detail="FULL"]')
    expect(detail).not.toBeNull()
    const basis = (detail as HTMLElement).querySelector('.atlas-outcome-basis')
    expect(basis).toHaveAttribute('data-arithmetic-basis', 'whole_window')
    // FULL is total coverage of the period, so it names no unmatched residual.
    expect((detail as HTMLElement).querySelector('.atlas-outcome-residual')).toBeNull()
    // The mandatory matched-partial limitation is not on a FULL row.
    expect((detail as HTMLElement).querySelector('[data-limitation="MATCHED_SUBWINDOW_SELECTION_BIAS"]')).toBeNull()
  })

  it('leaves the INCOMPARABLE row its reason, with no matched-only honesty detail', () => {
    renderPanel()
    const table = screen.getByTestId('atlas-outcome-table')
    const incomparableRow = table.querySelector('tr[data-outcome="INCOMPARABLE"]')
    expect(incomparableRow).toHaveTextContent(/no comparison: MATCHED_FRACTION_BELOW_MINIMUM/)
    // A refusal carries no arithmetic, so it emits no honesty detail row.
    expect(table.querySelector('[data-outcome-detail="INCOMPARABLE"]')).toBeNull()
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

describe('ChangeBatchIntegrationTail stored second lens', () => {
  function renderStored(sourceMode: 'synthetic' | 'selected_store' = 'synthetic') {
    return render(
      <ChangeBatchIntegrationTailPanel
        presentation={{ ...stored.envelope, mode: sourceMode }}
        finding={stored.finding}
        resolutions={storedEvidence.resolutions}
        sourceMode={sourceMode}
      />,
    )
  }

  it('renders cohort rules, value strata, sensitivity, alternatives and the decision boundary', () => {
    renderStored()
    expect(screen.getByTestId('stored-question')).toHaveTextContent(/larger change batches/i)
    expect(screen.getByTestId('stored-question')).toHaveTextContent(/right-censored/i)
    expect(screen.getByTestId('stored-counts')).toHaveTextContent(/close without merge/i)
    expect(screen.getByTestId('stored-primary-table')).toHaveTextContent(/upper/i)
    expect(screen.getByTestId('stored-sensitivity')).toHaveTextContent(/changed-file/i)
    expect(screen.getByTestId('stored-alternatives')).toHaveTextContent(/REVIEW_AVAILABILITY/)
    expect(screen.getByTestId('stored-decision')).toHaveTextContent(/cannot establish causality/i)
    expect(screen.getByTestId('stored-fact-provenance-limitation')).toHaveTextContent(/do not yet carry a per-fact job edge/i)
    expect(screen.getByTestId('stored-deletion-lineage')).toHaveTextContent(/no deletion or tombstone lineage/i)
  })

  it('renders retained tombstone counts as evidence marks at week grain', async () => {
    const presentationWithLineage = ChangeBatchIntegrationTailPresentationSchema.parse({
      ...stored.envelope,
      deletionLineage: {
        status: 'present',
        eventCount: 2,
        events: [{ subjectKind: 'coverage', eventKind: 'tombstone_cascade', week: '2026-W31', count: 2 }],
      },
    })
    const lineageEvidence = buildV3StoredObservationEvidence(presentationWithLineage, stored.finding)
    const user = userEvent.setup()
    render(
      <ChangeBatchIntegrationTailPanel
        presentation={presentationWithLineage}
        finding={stored.finding}
        resolutions={lineageEvidence.resolutions}
        sourceMode="synthetic"
      />,
    )
    const lineage = screen.getByTestId('stored-deletion-lineage')
    expect(lineage).toHaveTextContent(/tombstone_cascade.*coverage.*2026-W31/i)
    await user.click(within(lineage).getByRole('button', { name: /lineage events/i }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/why this number/i)
  })

  it('makes every displayed table number an evidence mark and opens its aggregate walk', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderStored('synthetic')
    for (const tableId of ['stored-primary-table', 'stored-sensitivity-table']) {
      const table = screen.getByTestId(tableId)
      for (const cell of within(table).getAllByRole('cell')) {
        expect(within(cell).getAllByRole('button').length).toBeGreaterThan(0)
      }
    }

    await user.click(screen.getByRole('button', { name: /current upper p90/i }))
    const drawer = screen.getByRole('dialog')
    expect(drawer).toHaveAccessibleName(/why this number/i)
    expect(within(drawer).getByTestId('edge-group-coverage_basis')).toHaveTextContent(/complete/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the selected-store evidence endpoint without substituting the authored Integration Shape walk', async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError('offline') })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderStored('selected_store')
    await user.click(screen.getByRole('button', { name: /current lower p50/i }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: /evidence ev_/i }))
    expect(within(drawer).getByText(/stored-observation\.v1/i)).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })
})

describe('IntegrationShapeAtlas — explicit presentation source', () => {
  it('uses the private analysis endpoint and renders the served presentation', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(selectedEnvelope), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<IntegrationShapeAtlasRoute />)

    expect(await screen.findByTestId('change-batch-integration-tail')).toBeInTheDocument()
    expect(screen.queryByTestId('integration-shape-atlas')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v2/analysis/integration-shape', expect.any(Object))
    expect(screen.getByText('Selected store')).toBeInTheDocument()
  })

  it('builds the Pages URL from the Vite base without changing the private endpoint', () => {
    expect(atlasPresentationEndpoint(true, '/developer-lens/')).toBe('/developer-lens/data/integration-shape.json')
    expect(atlasPresentationEndpoint(false, '/developer-lens/')).toBe('/api/v2/analysis/integration-shape')
  })

  it('renders explicit unavailable abstention furniture and never falls back to local composition', async () => {
    const fetchMock = vi.fn(async () => new Response('{"presentation":null}', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<IntegrationShapeAtlasRoute />)

    expect(await screen.findByTestId('integration-shape-unavailable')).toBeInTheDocument()
    expect(screen.getByText(/abstains rather than showing a local synthetic fallback/i)).toBeInTheDocument()
    expect(screen.queryByTestId('integration-shape-atlas')).not.toBeInTheDocument()
  })

  it('abstains when a successful response fails the stored-presentation contract', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    render(<IntegrationShapeAtlasRoute />)

    expect(await screen.findByTestId('integration-shape-unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('atlas-observation')).not.toBeInTheDocument()
  })

  it('renders the authored Integration Shape and stored second lens together in the synthetic bundle', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(envelope), { status: 200 })))
    render(<IntegrationShapeAtlasRoute />)

    expect(await screen.findByTestId('integration-shape-atlas')).toBeInTheDocument()
    expect(screen.getByTestId('change-batch-integration-tail')).toBeInTheDocument()
  })

  it('renders a typed stored-observation abstention without reviving either numeric panel', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(abstainedEnvelope), { status: 200 })))
    render(<IntegrationShapeAtlasRoute />)

    expect(await screen.findByTestId('stored-observation-abstention')).toHaveTextContent(/no change-batch reading/i)
    expect(screen.getByTestId('stored-observation-abstention-code')).toHaveTextContent('ALL_CENSORED')
    expect(screen.queryByTestId('integration-shape-atlas')).not.toBeInTheDocument()
    expect(screen.queryByTestId('change-batch-integration-tail')).not.toBeInTheDocument()
  })

  it('never substitutes the bundled local composition for missing selected-store evidence', async () => {
    const user = userEvent.setup()
    render(
      <IntegrationShapeAtlasPanel
        presentation={presentation}
        resolutions={{}}
        sourceMode="selected_store"
      />,
    )

    await user.click(screen.getByRole('button', { name: /p50 \(median\) difference: -2\.0 d/i }))
    expect(
      within(screen.getByRole('dialog')).getByText(UNRESOLVABLE_COPY.STORAGE_UNAVAILABLE),
    ).toBeInTheDocument()
  })
})

describe('IntegrationShapeAtlas — the evidence API is the drawer resolver, local composition is the fallback', () => {
  const P50_CLAIM_MARK = /p50 \(median\) difference: -2\.0 d/i

  it('asks the V2 evidence endpoint for the opened reference and renders what it served', async () => {
    // A projection the LOCAL composition would never produce for this claim, so what the drawer
    // renders can only have come from the endpoint.
    const served = {
      kind: 'unresolvable',
      resolverVersion: '1.0.0',
      reason: 'STORAGE_UNAVAILABLE',
      claimId: CLAIM_IDS.p50,
      lineage: [],
    }
    // The full shared-contract envelope: the client now rejects anything less — a bare
    // `{ projection }` body or a mismatched reference falls back to the local walk.
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            apiContractVersion: '1.0.0',
            analysisVersion: '1.0.0',
            reference: { kind: 'claim', claimId: CLAIM_IDS.p50, claimLayer: 'deterministic' },
            projection: served,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: P50_CLAIM_MARK }))

    await waitFor(() =>
      expect(screen.getByText(UNRESOLVABLE_COPY.STORAGE_UNAVAILABLE)).toBeInTheDocument(),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      `/api/v2/evidence/resolve?kind=claim&id=${encodeURIComponent(CLAIM_IDS.p50)}`,
    )
  })

  it('falls back silently to the identical local walk when the endpoint is absent', async () => {
    // The public showcase has no API at all. The drawer must be complete anyway, with nothing on
    // screen reporting a failure the reader cannot act on and that changed nothing they can see.
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: P50_CLAIM_MARK }))
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByText(/evidence ev_merge_events_current/i)).toBeInTheDocument()
    expect(within(dialog).getByTestId('edge-group-contradicts')).toHaveTextContent(
      /ev_open_tail_current/i,
    )
    expect(dialog.textContent).not.toMatch(/unavailable|offline|could not reach/i)

    // One failure retires the channel: opening a second mark does not try again.
    await user.click(screen.getByRole('button', { name: /p75 difference/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('ignores a served body that is not a resolution the drawer can render', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ projection: { kind: 'something_else' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: P50_CLAIM_MARK }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(
      within(screen.getByRole('dialog')).getByText(/evidence ev_merge_events_current/i),
    ).toBeInTheDocument()
  })
})
