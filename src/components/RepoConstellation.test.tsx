import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { RepositoryMetric } from '../../shared/types'
import { RepoConstellation } from './RepoConstellation'
import { RepoLedger } from './RepoLedger'

function repository(index: number): RepositoryMetric {
  return {
    key: `repo-${index}`,
    nameWithOwner: `example/repo-${index}`,
    displayName: `Repository ${index}`,
    isPrivate: index % 2 === 0,
    isArchived: false,
    isFork: false,
    commits: 50 - index,
    localCommits: index,
    pullRequests: 20 - index,
    mergedPullRequests: 18 - index,
    reviews: 12 + index,
    issues: 3,
    activeDays: 20,
    activeWeeks: 12 - Math.floor(index / 2),
    firstHalfActivity: 10,
    secondHalfActivity: 20 - index,
    momentum: 2,
    engagement: 100 - index * 4,
    primaryLanguage: 'TypeScript',
    languageColor: '#3178c6',
    topics: [],
  }
}

describe('repository exploration', () => {
  afterEach(cleanup)

  it('makes the constellation selectable and honest about hidden systems', async () => {
    const user = userEvent.setup()
    const repositories = Array.from({ length: 13 }, (_, index) => repository(index + 1))
    render(<RepoConstellation repositories={repositories} />)

    expect(screen.getByText(/12 mapped · 13 observed/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /\+1 more in the ledger/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /repository 2;.*select for details/i }))
    const detail = document.querySelector('.constellation__detail')
    expect(detail).not.toBeNull()
    expect(within(detail as HTMLElement).getByText('Repository 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'PR flow' }))
    expect(screen.getByRole('button', { name: 'PR flow' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/size reflects authored pull requests/i)).toBeInTheDocument()
  })

  it('expands the repository ledger without creating inert links', async () => {
    const user = userEvent.setup()
    const repositories = Array.from({ length: 11 }, (_, index) => repository(index + 1))
    render(<RepoLedger repositories={repositories} />)

    expect(screen.queryByText('Repository 11')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Reveal all 11' }))
    expect(screen.getByText('Repository 11')).toBeInTheDocument()
    expect(screen.getByText(/showing 11 of 11 observed/i)).toBeInTheDocument()
  })
})
