import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, vi } from 'vitest'
import { collectLocalGit } from './localGit.js'

// Pretend the walker hit one entry ceiling; the real walker is covered by localGitDiscovery.bounded.test.ts.
vi.mock('./localGitDiscovery.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./localGitDiscovery.js')>()
  return {
    ...actual,
    discoverLocalGitCandidates: async (roots: readonly string[]) => ({
      ...(await actual.discoverLocalGitCandidates(roots)),
      failedLocations: 1,
      cappedDirectories: 1,
    }),
  }
})

describe('local Git entry-ceiling coverage', () => {
  it('turns a capped directory into partial coverage with a count-only warning', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'lens-cap-'))
    try {
      const path = join(parent, 'invented-private-name')
      execFileSync('git', ['-c', 'init.templateDir=', 'init', '--quiet', path])
      const author = 'invented@example.invalid'
      execFileSync('git', ['-C', path, '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '--no-verify', '-m', 'test: invented fixture'], {
        env: { ...process.env, GIT_AUTHOR_NAME: 'Invented', GIT_AUTHOR_EMAIL: author, GIT_COMMITTER_NAME: 'Invented', GIT_COMMITTER_EMAIL: author,
          GIT_AUTHOR_DATE: '2026-01-10T12:00:00Z', GIT_COMMITTER_DATE: '2026-01-10T12:00:00Z' },
      })
      const result = await collectLocalGit([path], '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', { emails: ['invented@example.invalid'] })
      assert.equal(result.coverage.status, 'partial')
      assert.equal(result.warnings.length, 1)
      assert.match(result.warnings[0], /^1 /)
      assert.doesNotMatch(result.warnings[0], /invented-private-name/)
    } finally { rmSync(parent, { recursive: true, force: true }) }
  })
})
