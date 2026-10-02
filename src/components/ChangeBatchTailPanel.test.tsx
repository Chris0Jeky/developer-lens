import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangeBatchTailPanel } from './ChangeBatchTailPanel'
import { IntegrationShapeAtlasRoute } from './IntegrationShapeAtlas'
import { buildChangeBatchTailView } from '../../shared/changeBatchTailView'
import { buildSyntheticChangeBatchTailView, syntheticChangeBatchInput } from '../../shared/changeBatchTailSynthetic'
import { acceptServedChangeBatchTail, useChangeBatchTailView } from '../lib/changeBatchTailSource'

/**
 * Phase E (#174) — the second-lens UI consumer: every rendered number opens the Evidence Drawer on
 * its own walk, withheld strata render no number, abstention renders the reason, and the panel
 * accepts a served view only when it passes the shared gate.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ChangeBatchTailPanel', () => {
  it('renders the synthetic lens with decisions, counts, strata, rank and coverage, all as marks', () => {
    const view = buildSyntheticChangeBatchTailView()
    render(<ChangeBatchTailPanel view={view} />)
    const panel = screen.getByTestId('change-batch-tail')
    expect(panel).toHaveAttribute('data-source', 'synthetic')
    expect(screen.getByTestId('change-batch-source')).toHaveTextContent(/synthetic/i)
    expect(screen.getByTestId('change-batch-unsupported')).toHaveTextContent(/person/)
    expect(screen.getByTestId('change-batch-readiness')).toHaveTextContent(/ready-for-review/)
    const primary = screen.getByTestId('change-batch-primary')
    expect(within(primary).getAllByRole('row')).toHaveLength(4)
    const markButtons = panel.querySelectorAll('button[data-mark-id]')
    const markIds = new Set(view.marks.map((mark) => mark.markId))
    expect(markButtons.length).toBeGreaterThan(40)
    for (const button of markButtons) expect(markIds.has(button.getAttribute('data-mark-id') ?? '')).toBe(true)
    expect(panel.textContent).not.toMatch(/\bnot shown\b/)
  })

  it('opens the drawer on the walk of exactly the clicked number', () => {
    const view = buildSyntheticChangeBatchTailView()
    render(<ChangeBatchTailPanel view={view} />)
    const mark = view.marks.find((entry) => entry.subject.measure === 'p90' && entry.subject.binningId === 'declared_thresholds' && entry.subject.basisId === 'lines_changed' && entry.subject.stratumId === 's3')
    if (!mark) throw new Error('p90 mark missing')
    const button = screen.getByTestId('change-batch-tail').querySelector(`button[data-mark-id="${mark.markId}"]`) as HTMLButtonElement
    fireEvent.click(button)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('ev.cbt.lines_changed.declared_thresholds.s3.merged')
    expect(dialog).not.toHaveTextContent('ev.cbt.lines_changed.declared_thresholds.s1.merged')
    expect(dialog).toHaveTextContent('coverage-2')
  })

  it('renders an abstention with no quantile and a coverage-basis walk', () => {
    const base = syntheticChangeBatchInput()
    const view = buildChangeBatchTailView({ ...base, units: base.units.slice(0, 4) })
    render(<ChangeBatchTailPanel view={view} />)
    expect(screen.getByTestId('change-batch-tail')).toHaveAttribute('data-state', 'abstained')
    expect(screen.getByTestId('change-batch-abstention')).toHaveAttribute('data-reason', 'BELOW_MINIMUM_SUPPORT')
    expect(screen.queryByTestId('change-batch-primary')).toBeNull()
    expect(screen.getByTestId('change-batch-tail').textContent).not.toMatch(/\d+\.\d d/)
    fireEvent.click(screen.getByRole('button', { name: /coverage basis/i }))
    expect(screen.getByRole('dialog')).toHaveTextContent('ev.cbt.all.coverage')
  })

  it('marks a below-support stratum withheld instead of showing a number', () => {
    const base = syntheticChangeBatchInput()
    const units = base.units.filter((unit) => !((unit.additions ?? 0) + (unit.deletions ?? 0) >= 50 && (unit.additions ?? 0) + (unit.deletions ?? 0) < 400 && unit.mergedAt !== null && Date.parse(unit.createdAt ?? '') > Date.parse('2026-06-05T00:00:00.000Z')))
    const view = buildChangeBatchTailView({ ...base, units })
    render(<ChangeBatchTailPanel view={view} />)
    const row = screen.getByTestId('change-batch-primary').querySelector('tr[data-stratum="s2"]') as HTMLElement
    expect(row).toHaveAttribute('data-displayed', 'false')
    expect(within(row).getByText(/withheld \(BELOW_MINIMUM_SUPPORT\)/)).toBeInTheDocument()
  })
})

describe('Atlas route consumer', () => {
  it('renders the second lens beneath integration shape on the existing route without a network call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<IntegrationShapeAtlasRoute />)
    expect(screen.getByTestId('integration-shape-atlas')).toBeInTheDocument()
    expect(await screen.findByTestId('change-batch-tail', undefined, { timeout: 10_000 })).toHaveAttribute('data-source', 'synthetic')
    expect(screen.getByTestId('change-batch-stored-control')).toHaveAttribute('data-status', 'synthetic')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('change-batch view source', () => {
  it('accepts only a gated stored view', () => {
    const synthetic = buildSyntheticChangeBatchTailView()
    expect(acceptServedChangeBatchTail({ apiContractVersion: '1.0.0', view: synthetic })).toBeNull()
    const stored = buildChangeBatchTailView({ ...syntheticChangeBatchInput(), source: { kind: 'selected_v3_store' } })
    expect(acceptServedChangeBatchTail({ apiContractVersion: '1.0.0', view: JSON.parse(JSON.stringify(stored)) })?.source.kind).toBe('selected_v3_store')
    expect(acceptServedChangeBatchTail({ apiContractVersion: '9.9.9', view: stored })).toBeNull()
    expect(acceptServedChangeBatchTail({ apiContractVersion: '1.0.0', view: { ...stored, question: `job-${'b'.repeat(64)}` } })).toBeNull()
  })

  it('keeps the synthetic view when a served body contradicts its primary counts (#386)', async () => {
    const stored = JSON.parse(JSON.stringify(buildChangeBatchTailView({
      ...syntheticChangeBatchInput(), source: { kind: 'selected_v3_store' },
    })))
    stored.finding.sampleSummary.counts.eligible += 7
    stored.cohort.eligible += 11
    const body = { apiContractVersion: '1.0.0', view: stored }
    expect(acceptServedChangeBatchTail(body)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
    const source = renderHook(() => useChangeBatchTailView())
    act(() => source.result.current.requestStored())
    await waitFor(() => expect(source.result.current.status).toBe('not_served'))
    expect(source.result.current.view.source.kind).toBe('synthetic')
  })

  it.each(['counts', 'quantiles', 'lower-bound'] as const)('retains the synthetic view for contradictory stratum %s (#388)', async (field) => {
    const stored = JSON.parse(JSON.stringify(buildChangeBatchTailView({
      ...syntheticChangeBatchInput(), source: { kind: 'selected_v3_store' },
    })))
    const row = stored.binnings[0].strata.find((entry: { displayed: boolean }) => entry.displayed)
    if (field === 'counts') row.eligible += 11
    if (field === 'quantiles') row.quantiles[0].seconds += 123
    if (field === 'lower-bound') row.lowerBoundP90 += 123
    const body = { apiContractVersion: '1.0.0', view: stored }
    expect(acceptServedChangeBatchTail(body)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
    const source = renderHook(() => useChangeBatchTailView())
    act(() => source.result.current.requestStored())
    await waitFor(() => expect(source.result.current.status).toBe('not_served'))
    expect(source.result.current.view.source.kind).toBe('synthetic')
  })

  it('keeps the synthetic view when a served primary cohort is redirected to a stratum', async () => {
    const view = JSON.parse(JSON.stringify(buildChangeBatchTailView({
      ...syntheticChangeBatchInput(), source: { kind: 'selected_v3_store' },
    })))
    const row = view.binnings[0].strata[0]
    const result = view.results.find((entry: { resultId: string }) => entry.resultId === row.resultId)
    for (const reference of view.finding.metricResults) reference.role = reference.resultId === row.resultId ? 'primary' : 'supporting'
    view.finding.sampleSummary = { resultId: result.resultId, state: result.state, counts: result.counts }
    view.finding.coverage = result.coverage
    view.cohort = { eligible: row.eligible, merged: row.merged, censored: row.censored, competing: row.competing, excluded: result.counts.excluded, draftsStillOpen: 0 }
    const body = { apiContractVersion: '1.0.0', view }
    expect(acceptServedChangeBatchTail(body)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
    const source = renderHook(() => useChangeBatchTailView())
    act(() => source.result.current.requestStored())
    await waitFor(() => expect(source.result.current.status).toBe('not_served'))
    expect(source.result.current.view.source.kind).toBe('synthetic')
  })

  it('never fetches on render, keeps the synthetic view on a default-off 404, and swaps in a served stored view on request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"code":"V2_NOT_FOUND"}}', { status: 404 })))
    const off = renderHook(() => useChangeBatchTailView())
    expect(fetch).not.toHaveBeenCalled()
    act(() => off.result.current.requestStored())
    await waitFor(() => expect(off.result.current.status).toBe('not_served'))
    expect(off.result.current.view.source.kind).toBe('synthetic')

    const stored = buildChangeBatchTailView({ ...syntheticChangeBatchInput(), source: { kind: 'selected_v3_store' } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ apiContractVersion: '1.0.0', view: stored }), { status: 200 })))
    const on = renderHook(() => useChangeBatchTailView())
    act(() => on.result.current.requestStored())
    await waitFor(() => expect(on.result.current.view.source.kind).toBe('selected_v3_store'))
    expect(on.result.current.status).toBe('stored')
  })
})
