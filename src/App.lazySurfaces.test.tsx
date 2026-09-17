import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { analyzeDataset } from '../server/analytics'
import { createDemoDataset } from '../server/demo'

const surfaceLoads = vi.hoisted(() => ({ share: 0, wrapped: 0 }))

vi.mock('./components/ShareStudio', () => {
  surfaceLoads.share += 1
  return { ShareStudio: () => null }
})

vi.mock('./components/WrappedExperience', () => {
  surfaceLoads.wrapped += 1
  return { WrappedExperience: () => null }
})

const demo = analyzeDataset(createDemoDataset('6m'))

describe('dashboard optional surface loading', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
  })

  it('does not evaluate share or Wrapped modules until their launch controls are used', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => demo,
      }),
    )
    const user = userEvent.setup()
    const { default: App } = await import('./App')

    render(<App />)
    await screen.findByText('Your development trail,')

    expect(surfaceLoads).toEqual({ share: 0, wrapped: 0 })

    await user.click(screen.getByRole('button', { name: /share or export/i }))
    await waitFor(() => expect(surfaceLoads.share).toBe(1))
    expect(surfaceLoads.wrapped).toBe(0)

    await user.click(screen.getByRole('button', { name: /start your wrapped/i }))
    await waitFor(() => expect(surfaceLoads.wrapped).toBe(1))
  })
})
