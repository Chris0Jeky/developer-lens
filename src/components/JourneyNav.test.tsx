import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JourneyNav } from './JourneyNav'

const defaultMatchMedia = window.matchMedia
const defaultScrollIntoView = HTMLElement.prototype.scrollIntoView

describe('JourneyNav', () => {
  afterEach(() => {
    cleanup()
    window.history.replaceState({}, '', '/')
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: defaultMatchMedia })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: defaultScrollIntoView,
    })
  })

  it('keeps every dashboard stage reachable and marks the selected stop', async () => {
    const user = userEvent.setup()
    render(<JourneyNav />)

    expect(screen.getAllByRole('link')).toHaveLength(6)
    expect(screen.getByRole('link', { name: /01\s*rhythm/i })).toHaveAttribute(
      'aria-current',
      'location',
    )

    await user.click(screen.getByRole('link', { name: /03\s*signal lab/i }))
    expect(screen.getByRole('link', { name: /03\s*signal lab/i })).toHaveAttribute(
      'aria-current',
      'location',
    )
  })

  it('keeps the active mobile stop centred in the guided navigation', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query === '(max-width: 1100px)',
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
    const user = userEvent.setup()
    render(<JourneyNav />)

    await user.click(screen.getByRole('link', { name: /05\s*connections/i }))
    expect(scrollIntoView).toHaveBeenLastCalledWith(
      expect.objectContaining({ block: 'nearest', inline: 'center' }),
    )
  })
})
