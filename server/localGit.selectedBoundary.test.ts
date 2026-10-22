import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative } from 'node:path'
import { describe, it } from 'vitest'
import { collectLocalGit } from './localGit.js'

let gitTrace = ''
const email = 'invented@example.invalid'
const window = ['2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'] as const
async function fixture(run: (root: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'lens-selected-boundary-'))
  try { await run(root) } finally { rmSync(root, { recursive: true, force: true }) }
}
function git(path: string, ...args: string[]): string {
  return execFileSync('git', ['-C', path, ...args], { encoding: 'utf8', windowsHide: true }).trim()
}
function repository(path: string, metadata?: string): string {
  mkdirSync(path, { recursive: true })
  git(path, '-c', 'init.templateDir=', 'init', '--quiet', ...(metadata ? [`--separate-git-dir=${metadata}`] : []))
  const hooks = join(metadata ?? join(path, '.git'), 'empty-hooks')
  mkdirSync(hooks)
  execFileSync('git', ['-C', path, '-c', `core.hooksPath=${hooks}`, '-c', 'commit.gpgsign=false',
    'commit', '--quiet', '--allow-empty', '-m', `test: invented boundary fixture ${basename(path)}`], {
    windowsHide: true,
    env: { ...process.env, GIT_AUTHOR_NAME: 'Invented', GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: 'Invented', GIT_COMMITTER_EMAIL: email,
      GIT_AUTHOR_DATE: '2026-01-10T12:00:00Z', GIT_COMMITTER_DATE: '2026-01-10T12:00:00Z' },
  })
  return git(path, 'rev-parse', 'HEAD')
}
function marker(checkout: string, target: string) {
  // Git makes marker files hidden on Windows; replace the fixture file before rewriting it.
  rmSync(join(checkout, '.git'), { force: true })
  writeFileSync(join(checkout, '.git'), `gitdir: ${target}\n`)
}
async function collect(roots: string[]) {
  const traceDirectory = mkdtempSync(join(tmpdir(), 'lens-boundary-trace-'))
  const traceFile = join(traceDirectory, 'git-trace.txt')
  const previousTrace = process.env.GIT_TRACE
  try {
    // Trace only invented collection calls, never fixture setup or real repositories.
    process.env.GIT_TRACE = traceFile
    const result = await collectLocalGit(roots, ...window, { emails: [email] })
    gitTrace = readFileSync(traceFile, 'utf8')
    return result
  } finally {
    if (previousTrace === undefined) delete process.env.GIT_TRACE
    else process.env.GIT_TRACE = previousTrace
    rmSync(traceDirectory, { recursive: true, force: true })
  }
}
function assertRefused(result: Awaited<ReturnType<typeof collect>>, ...privateValues: string[]) {
  assert.deepEqual(result.commits, [])
  assert.deepEqual(result.repositories, [])
  assert.equal(result.coverage.itemCount, 0)
  assert.equal(result.coverage.status, 'unavailable')
  assert.match(result.coverage.detail, /LOCAL_GIT_BOUNDARY_REFUSED/)
  assert.match(result.coverage.detail, /incomplete/)
  const serialized = JSON.stringify(result)
  for (const value of privateValues) assert.ok(!serialized.includes(value), 'refusal must be content-free')
  assert.match(gitTrace, /built-in: git rev-parse\b/)
  assert.doesNotMatch(gitTrace, /built-in: git (remote|log)\b/, 'refuse before remote or log')
}

describe('Git metadata stays inside explicitly selected roots (#414)', () => {
  for (const absolute of [false, true]) {
    it(`refuses a ${absolute ? 'absolute' : 'relative'} marker target outside the selected root`, () => fixture(async (root) => {
      const selected = join(root, 'selected')
      // A sibling with the same prefix must not pass a lexical prefix comparison.
      const metadata = join(root, 'selected-external-canary')
      const checkout = join(selected, 'visible')
      const sha = repository(checkout, metadata)
      marker(checkout, absolute ? metadata : relative(checkout, metadata).split('\\').join('/'))
      assertRefused(await collect([selected]), metadata, 'selected-external-canary', sha)
    }))
  }
  for (const protectedPath of ['.developer-lens', 'public/data', '.claude/worktrees', '.agent-harness/runtime']) {
    it(`refuses metadata in protected ${protectedPath} even inside a selected root`, () => fixture(async (root) => {
      const metadata = join(root, protectedPath, 'private-metadata-canary')
      mkdirSync(metadata, { recursive: true })
      const sha = repository(join(root, 'visible'), metadata)
      assertRefused(await collect([root]), metadata, 'private-metadata-canary', sha)
    }))
  }
  it('refuses a core.worktree top-level outside the selected root', () => fixture(async (root) => {
    const selected = join(root, 'selected')
    const sha = repository(selected)
    const outside = join(root, 'outside-worktree-canary')
    mkdirSync(outside)
    git(selected, 'config', 'core.worktree', outside)
    assert.equal(git(selected, 'rev-parse', '--show-toplevel').replaceAll('\\', '/'), outside.replaceAll('\\', '/'))
    assertRefused(await collect([selected]), outside, 'outside-worktree-canary', sha)
  }))
  it('refuses a linked worktree whose common directory is outside every selected root', () => fixture(async (root) => {
    const main = join(root, 'external-common-canary')
    const sha = repository(main)
    const linked = join(root, 'selected')
    git(main, 'worktree', 'add', '--quiet', '--detach', linked)
    assertRefused(await collect([linked]), main, 'external-common-canary', sha)
  }))
  it('checks commondir indirection even when the git directory is inside the root', () => fixture(async (root) => {
    const outside = join(root, 'external-common-canary')
    const sha = repository(outside)
    const selected = join(root, 'selected')
    const checkout = join(selected, 'visible')
    const metadata = join(selected, 'metadata')
    repository(checkout, metadata)
    writeFileSync(join(metadata, 'commondir'), `${join(outside, '.git')}\n`)
    assert.equal(git(checkout, 'rev-parse', 'HEAD'), sha)
    assertRefused(await collect([selected]), outside, 'external-common-canary', sha)
  }))
  it('realpaths metadata before comparing it to the roots', () => fixture(async (root) => {
    const selected = join(root, 'selected')
    const checkout = join(selected, 'visible')
    const outside = join(root, 'outside-alias-canary')
    repository(checkout, outside)
    const alias = join(selected, 'metadata-alias')
    symlinkSync(outside, alias, process.platform === 'win32' ? 'junction' : 'dir')
    marker(checkout, alias)
    assertRefused(await collect([selected]), outside, 'outside-alias-canary')
  }))
  it('collects an in-root separate Git directory', () => fixture(async (root) => {
    const sha = repository(join(root, 'visible'), join(root, 'metadata'))
    const result = await collect([root])
    assert.equal(result.coverage.status, 'complete')
    assert.deepEqual(result.commits.map((commit) => commit.sha), [sha])
  }))
  it('collects and deduplicates an in-root linked worktree', () => fixture(async (root) => {
    const main = join(root, 'main')
    const sha = repository(main)
    git(main, 'worktree', 'add', '--quiet', '--detach', join(root, 'linked'))
    const result = await collect([root, root])
    assert.equal(result.coverage.status, 'complete')
    assert.equal(result.repositories.length, 1)
    assert.deepEqual(result.commits.map((commit) => commit.sha), [sha])
  }))
  it('accepts metadata authorized by another explicitly selected root', () => fixture(async (root) => {
    const selected = join(root, 'selected')
    const metadata = join(root, 'metadata')
    const sha = repository(selected, metadata)
    const result = await collect([selected, metadata])
    assert.equal(result.coverage.status, 'complete')
    assert.deepEqual(result.commits.map((commit) => commit.sha), [sha])
  }))
  it('reports partial coverage while preserving an independently selected healthy repository', () => fixture(async (root) => {
    const selected = join(root, 'selected')
    repository(join(selected, 'refused'), join(root, 'external-canary'))
    const sha = repository(join(selected, 'healthy'))
    const result = await collect([selected])
    assert.equal(result.coverage.status, 'partial')
    assert.deepEqual(result.commits.map((commit) => commit.sha), [sha])
    assert.match(result.coverage.detail, /LOCAL_GIT_BOUNDARY_REFUSED/)
    assert.ok(!JSON.stringify(result).includes('external-canary'))
    assert.equal(gitTrace.match(/built-in: git remote\b/g)?.length, 1)
    assert.equal(gitTrace.match(/built-in: git log\b/g)?.length, 1)
  }))
  it.skipIf(process.platform !== 'win32')('accepts different Windows casing of a selected root', () => fixture(async (root) => {
    const sha = repository(join(root, 'visible'), join(root, 'metadata'))
    const result = await collect([root.toUpperCase()])
    assert.equal(result.coverage.status, 'complete')
    assert.deepEqual(result.commits.map((commit) => commit.sha), [sha])
  }))
})
