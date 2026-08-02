import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeDataset } from '../server/analytics'
import { createDemoDataset } from '../server/demo'
import App from './App'

const demo = analyzeDataset(createDemoDataset('6m'))

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
    await user.click(screen.getByRole('button', { name: /start your wrapped/i }))
    expect(screen.getByRole('dialog', { name: /developer lens wrapped/i })).toBeInTheDocument()
    expect(screen.getByText(/you didn’t just write code/i)).toBeInTheDocument()

    await user.keyboard('{ArrowRight}')
    expect(await screen.findByText(/repositories\./i)).toBeInTheDocument()
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
})
