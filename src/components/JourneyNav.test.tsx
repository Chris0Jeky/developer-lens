import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { JourneyNav } from './JourneyNav'

describe('JourneyNav', () => {
  afterEach(() => {
    cleanup()
    window.history.replaceState({}, '', '/')
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
})
