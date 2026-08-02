import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeDataset } from '../server/analytics'
import { createDemoDataset } from '../server/demo'
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
    expect(screen.getByText(/you didn’t just write code/i)).toBeInTheDocument()

    await user.keyboard('{ArrowRight}')
    expect(await screen.findByText(/repositories\./i)).toBeInTheDocument()

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
})
