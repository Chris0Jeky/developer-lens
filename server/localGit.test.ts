import { describe, expect, it } from 'vitest'
import { collectLocalGit, matchesConfiguredIdentity } from './localGit.js'

describe('local Git attribution', () => {
  it('matches email only and excludes a collaborator with the same author name', () => {
    const emails = new Set(['owner@example.com'])
    const owner = {
      authorName: 'Shared Name',
      authorEmail: 'OWNER@example.com',
    }
    const collaborator = {
      authorName: 'Shared Name',
      authorEmail: 'collaborator@example.com',
    }

    expect(matchesConfiguredIdentity(owner, emails)).toBe(true)
    expect(matchesConfiguredIdentity(collaborator, emails)).toBe(false)
  })

  it('reports local enrichment unavailable when no author email is configured', async () => {
    const result = await collectLocalGit(
      ['C:\\explicit-root'],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      { emails: [] },
    )

    expect(result.coverage.status).toBe('unavailable')
    expect(result.warnings).toHaveLength(1)
  })
})
