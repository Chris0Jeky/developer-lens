import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { LanguageLandscape } from './LanguageLandscape'

describe('LanguageLandscape', () => {
  afterEach(cleanup)

  it('keeps tiny nonzero shares visible and lets the basis change', async () => {
    const user = userEvent.setup()
    render(
      <LanguageLandscape
        languages={[
          {
            name: 'Alpha',
            color: '#ffffff',
            bytes: 10,
            activityWeight: 9996,
            repositoryCount: 2,
            share: 0.9996,
            footprintShare: 0.1,
          },
          {
            name: 'Tiny',
            color: '#55b4d4',
            bytes: 90,
            activityWeight: 4,
            repositoryCount: 1,
            share: 0.0004,
            footprintShare: 0.9,
          },
        ]}
      />,
    )

    expect(screen.getByText('<0.1%')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Code footprint' }))
    expect(screen.getByRole('button', { name: 'Code footprint' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('90%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /tiny/i }))
    expect(screen.getByText(/occupies more of the current footprint/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tiny/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
