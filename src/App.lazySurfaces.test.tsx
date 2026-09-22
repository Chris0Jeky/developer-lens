import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeDataset } from '../server/analytics'
import { createDemoDataset } from '../server/demo'
import App from './App'

// ShareStudio and WrappedExperience are React.lazy surfaces (#354): their first open waits on a
// dynamic import that Vitest transforms on demand, which can exceed findBy*'s 1 s default on a
// loaded machine. Lookups that wait on a lazy surface's first render get an explicit budget.
const LAZY_SURFACE = { timeout: 8_000 }

const evaluated = vi.hoisted(() => [] as string[])

vi.mock('./components/ShareStudio', async (importOriginal) => {
  evaluated.push('ShareStudio')
  return importOriginal()
})

vi.mock('./components/WrappedExperience', async (importOriginal) => {
  evaluated.push('WrappedExperience')
  return importOriginal()
})

const demo = analyzeDataset(createDemoDataset('6m'))

describe('deferred dashboard surfaces stay unevaluated until interaction', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
  })

  it('evaluates neither optional module initially, Share after Share opens, Wrapped after its launcher', { timeout: 30_000 }, async () => {
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

    expect(evaluated).toEqual([])

    await user.click(screen.getByRole('button', { name: /share or export/i }))
    await screen.findByRole('dialog', { name: /turn the lens into something/i }, LAZY_SURFACE)
    expect(evaluated).toEqual(['ShareStudio'])

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /start your wrapped/i }))
    await screen.findByRole('dialog', { name: /developer lens wrapped/i }, LAZY_SURFACE)
    expect(evaluated).toEqual(['ShareStudio', 'WrappedExperience'])
  })
})
