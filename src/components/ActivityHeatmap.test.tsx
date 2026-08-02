import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { ActivityDay } from '../../shared/types'
import { ActivityHeatmap } from './ActivityHeatmap'

const activity: ActivityDay[] = [
  {
    date: '2026-01-05',
    contributions: 1,
    commits: 1,
    pullRequests: 0,
    reviews: 0,
    issues: 0,
    localCommits: 0,
  },
  {
    date: '2026-01-06',
    contributions: 5,
    commits: 3,
    pullRequests: 1,
    reviews: 1,
    issues: 0,
    localCommits: 1,
  },
  {
    date: '2026-01-07',
    contributions: 2,
    commits: 0,
    pullRequests: 0,
    reviews: 2,
    issues: 0,
    localCommits: 0,
  },
]

describe('ActivityHeatmap', () => {
  afterEach(cleanup)

  it('turns hover, focus, and arrow movement into a persistent day inspector', async () => {
    const user = userEvent.setup()
    render(<ActivityHeatmap activity={activity} />)

    expect(screen.getByText('6 visible signals')).toBeInTheDocument()
    expect(screen.getByText('Local-only · 1')).toBeInTheDocument()

    await user.tab()
    expect(screen.getByRole('button', { name: /tuesday, 6 january 2026/i })).toHaveFocus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('button', { name: /wednesday, 7 january 2026/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Reviews · 2')).toBeInTheDocument()
  })
})
