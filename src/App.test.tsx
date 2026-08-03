import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeDataset } from '../server/analytics'
import { createDemoDataset } from '../server/demo'
import { payloadForSink } from '../shared/privacy'
import { V2_DEMO_INSIGHTS, V2_DEMO_PAYLOAD, V2_DEMO_REGISTRATION } from '../shared/v2Demo'
import App from './App'

const demo = analyzeDataset(createDemoDataset('6m'))
const publicDemo = {
  ...demo,
  meta: { ...demo.meta, privacy: 'public-demo' as const },
}

describe('Developer Lens app', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
  })

  it('renders the dashboard and opens the immersive Wrapped story', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => demo,
      }),
    )
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('Your development trail,')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /go past totals/i })).toBeInTheDocument()
    const wrappedTrigger = screen.getByRole('button', { name: /start your wrapped/i })
    await user.click(wrappedTrigger)
    expect(screen.getByRole('dialog', { name: /developer lens wrapped/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /you didn’t just write code/i })).toBeInTheDocument()

    await user.keyboard('{ArrowRight}')
    expect(
      await screen.findByRole('heading', { name: /repositories.*held the gravity/i }),
    ).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(wrappedTrigger).toHaveFocus())
  })

  it('requests a fresh dataset when the range changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => demo,
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Your development trail,')

    await user.click(screen.getByRole('button', { name: '1 year' }))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard?range=12m',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('shares the active Wrapped chapter without losing story position', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => demo,
      }),
    )
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Your development trail,')

    await user.click(screen.getByRole('button', { name: /start your wrapped/i }))
    await user.keyboard('{ArrowRight}')
    await user.click(screen.getByRole('button', { name: /share chapter 2/i }))

    expect(screen.getByRole('dialog', { name: /turn the lens into something/i })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /turn the lens into something/i })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /developer lens wrapped.*repositories/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /developer lens wrapped/i })).not.toBeInTheDocument()
  })

  it('keeps the hosted showcase explicitly synthetic and avoids inert PR links', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => publicDemo,
      }),
    )
    render(<App />)

    expect(await screen.findByText('Public demo')).toBeInTheDocument()
    expect(screen.getByText(/every event and repository below is synthetic/i)).toBeInTheDocument()
    expect(screen.getByText(/no personal github data/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /shape the signal pipeline/i }),
    ).not.toBeInTheDocument()
  })

  it('renders the offline V2 story, filters every evidence level, and never fetches', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/?demo=v2')
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findByText(/invented c0 story/i)).toBeInTheDocument()
    expect(screen.getAllByText(/no account, repository, or local-history input/i)).toHaveLength(2)
    expect(screen.getByRole('heading', { name: /short, repeatable waves/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /small batches keep/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /optimized for deliberate coordination/i })).toBeInTheDocument()
    expect(screen.getByText(/synthetic timestamps describe/i)).toBeInTheDocument()
    expect(Object.values(V2_DEMO_REGISTRATION.fieldClasses).every((fieldClass) => fieldClass === 'C0')).toBe(true)
    expect(() => V2_DEMO_REGISTRATION.schema.parse({ ...V2_DEMO_PAYLOAD, unexpected: true })).toThrow()
    expect(payloadForSink('public', V2_DEMO_REGISTRATION, V2_DEMO_PAYLOAD)).toEqual(V2_DEMO_PAYLOAD)
    for (const insight of V2_DEMO_INSIGHTS) {
      expect(screen.getByRole('heading', { name: insight.title })).toBeInTheDocument()
      expect(screen.getByText(insight.body)).toBeInTheDocument()
      for (const evidence of insight.evidence) expect(screen.getByText(evidence)).toBeInTheDocument()
      expect(insight.caveat).toBeTruthy()
      if (insight.caveat) expect(screen.getByText(insight.caveat, { exact: false })).toBeInTheDocument()
    }

    await user.click(screen.getByRole('button', { name: /observed/i }))
    expect(screen.getByRole('heading', { name: /short, repeatable waves/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /small batches keep/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /derived/i }))
    expect(screen.getByRole('heading', { name: /small batches keep/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /short, repeatable waves/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /hypothesis/i }))
    expect(screen.getByRole('heading', { name: /optimized for deliberate coordination/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /small batches keep/i })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
