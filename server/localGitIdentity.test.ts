import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'vitest'
import { collectLocalGit, dedupeByIdentity } from './localGit.js'

const email = 'invented@example.invalid'
const window = ['2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'] as const

async function fixture(run: (root: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'lens-identity-'))
  try { await run(root) } finally { rmSync(root, { recursive: true, force: true }) }
}
function repository(parent: string, name: string): string {
  const path = join(parent, name)
  mkdirSync(path, { recursive: true })
  execFileSync('git', ['-c', 'init.templateDir=', 'init', '--quiet', path])
  const hooks = join(path, '.git', 'empty-hooks')
  mkdirSync(hooks)
  execFileSync('git', ['-C', path, '-c', `core.hooksPath=${hooks}`, '-c', 'commit.gpgsign=false',
    'commit', '--quiet', '--allow-empty', '-m', `test: invented ${name}`], {
    env: { ...process.env, GIT_AUTHOR_NAME: 'Invented', GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: 'Invented', GIT_COMMITTER_EMAIL: email,
      GIT_AUTHOR_DATE: '2026-01-10T12:00:00Z', GIT_COMMITTER_DATE: '2026-01-10T12:00:00Z' },
  })
  return path
}
function caseSensitive(root: string): boolean {
  mkdirSync(join(root, 'probe'))
  return !existsSync(join(root, 'PROBE'))
}

describe('discovery identity is the filesystem identity (#410)', () => {
  // Simulated filesystems: an inode table keyed by the exact path string.
  const entries = [
    { topLevel: '/work/Repo', commonDirectory: '/work/Repo/.git' },
    { topLevel: '/work/repo', commonDirectory: '/work/repo/.git' },
  ]
  it('keeps Repo and repo apart when the filesystem says they are different directories', async () => {
    const inodes: Record<string, string> = { '/work/Repo/.git': 'dev1:10', '/work/repo/.git': 'dev1:11' }
    assert.deepEqual(await dedupeByIdentity(entries, async (dir) => inodes[dir]), ['/work/Repo', '/work/repo'])
  })
  it('still dedupes Windows-style case-insensitive spellings of one directory', async () => {
    const same = [
      { topLevel: 'C:/Work/Repo', commonDirectory: 'C:/Work/Repo/.git' },
      { topLevel: 'c:/work/repo', commonDirectory: 'c:/work/repo/.git' },
    ]
    assert.equal((await dedupeByIdentity(same, async () => 'dev1:10')).length, 1)
  })
  it('falls back to the case-folded path when the filesystem gives no identity', async () => {
    const failing = async () => { throw new Error('no stat') }
    assert.equal((await dedupeByIdentity(entries, failing)).length, 1)
  })
  it('orders survivors by common directory, independent of discovery order', async () => {
    const inodes: Record<string, string> = { '/work/Repo/.git': 'a', '/work/repo/.git': 'b' }
    const identify = async (dir: string) => inodes[dir]
    assert.deepEqual(await dedupeByIdentity([...entries].reverse(), identify), await dedupeByIdentity(entries, identify))
  })
  it('dedupes the real filesystem: repeated roots and a linked worktree are one repository', () => fixture(async (root) => {
    const main = repository(root, 'main')
    execFileSync('git', ['-C', main, 'worktree', 'add', '--quiet', '--detach', join(root, 'linked')])
    const result = await collectLocalGit([root, root, main], ...window, { emails: [email] })
    assert.equal(result.repositories.length, 1)
    assert.equal(result.warnings.length, 0)
    assert.equal(result.coverage.status, 'complete')
  }))
})

describe('colliding repository ids keep one repository and mark coverage partial (#410)', () => {
  it('keeps one of two no-remote repositories with the same basename, content-free warning', () => fixture(async (root) => {
    repository(join(root, 'a'), 'app')
    repository(join(root, 'b'), 'app')
    const result = await collectLocalGit([root], ...window, { emails: [email] })
    assert.equal(result.repositories.length, 1)
    assert.equal(result.commits.length, 1)
    assert.equal(result.coverage.status, 'partial')
    assert.equal(result.warnings.length, 1)
    assert.match(result.warnings[0], /^1 local repositories shared a repository identity/)
    assert.doesNotMatch(result.warnings[0], /app|invented|\\|\//)
  }))
  it('keeps the same repository whichever order the roots are given', () => fixture(async (root) => {
    const a = repository(join(root, 'a'), 'app')
    const b = repository(join(root, 'b'), 'app')
    const forward = await collectLocalGit([a, b], ...window, { emails: [email] })
    const reverse = await collectLocalGit([b, a], ...window, { emails: [email] })
    assert.deepEqual(forward.commits, reverse.commits)
  }))
  it.skipIf(process.platform === 'win32' || process.platform === 'darwin')(
    'discovers both Repo and repo on a case-sensitive filesystem but keeps one',
    () => fixture(async (root) => {
      if (!caseSensitive(root)) return
      repository(root, 'Repo')
      repository(root, 'repo')
      const result = await collectLocalGit([root], ...window, { emails: [email] })
      assert.equal(result.repositories.length, 1)
      assert.equal(result.coverage.status, 'partial')
      assert.equal(result.warnings.length, 1)
    }),
  )
})
