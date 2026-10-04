import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { lstat, readdir } from 'node:fs/promises'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, it } from 'vitest'
import { collectLocalGit } from './localGit.js'
import { discoverLocalGitCandidates, MAX_LOCAL_DISCOVERY_DEPTH, MAX_LOCAL_DISCOVERY_DIRECTORIES } from './localGitDiscovery.js'

const directory = { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }
const file = { isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
const symlink = { isDirectory: () => false, isFile: () => false, isSymbolicLink: () => true }
const actualAccess = { lstat, readDirectory: (path: string) => readdir(path, { withFileTypes: true }) }
async function fixture(run: (root: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'lens-discovery-'))
  try { await run(root) } finally { rmSync(root, { recursive: true, force: true }) }
}
function marker(root: string, path: string, kind: 'directory' | 'file' = 'directory') {
  const repository = join(root, path)
  mkdirSync(repository, { recursive: true })
  if (kind === 'directory') mkdirSync(join(repository, '.git'))
  else writeFileSync(join(repository, '.git'), 'gitdir: invented-metadata-location\n')
  return repository
}
const dates = ['2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'] as const
const identity = { emails: ['invented@example.invalid'] }
function committedRepository(root: string, name: string) {
  const path = join(root, name)
  execFileSync('git', ['-c', 'init.templateDir=', 'init', '--quiet', path])
  writeFileSync(join(path, 'invented.txt'), 'invented fixture\n')
  const hooks = join(path, '.git', 'empty-hooks')
  mkdirSync(hooks)
  execFileSync('git', ['-C', path, 'add', '--', 'invented.txt'])
  execFileSync('git', ['-C', path, '-c', `core.hooksPath=${hooks}`, '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'test: invented fixture'], {
    env: { ...process.env, GIT_AUTHOR_NAME: 'Invented', GIT_AUTHOR_EMAIL: identity.emails[0],
      GIT_COMMITTER_NAME: 'Invented', GIT_COMMITTER_EMAIL: identity.emails[0],
      GIT_AUTHOR_DATE: '2026-01-10T12:00:00Z', GIT_COMMITTER_DATE: '2026-01-10T12:00:00Z' },
  })
  return path
}

describe('literal selected-root Git marker discovery', () => {
  it('does no filesystem work without explicit roots', async () => {
    const result = await discoverLocalGitCandidates([], {
      lstat: async () => { throw new Error('unexpected stat') },
      readDirectory: async () => { throw new Error('unexpected read') },
    })
    assert.deepEqual(result, { candidates: [], failedLocations: 0 })
  })
  it('finds the root marker, nested marker and worktree marker file deterministically', () => fixture(async (root) => {
    const first = marker(root, '')
    const second = marker(root, 'a/nested')
    const third = marker(root, 'z/worktree', 'file')
    assert.deepEqual(await discoverLocalGitCandidates([root]), { candidates: [first, second, third], failedLocations: 0 })
  }))
  for (const name of ['repo[one]', 'repo{two}', 'repo!three', 'space name', '.hidden', 'repo-😀']) {
    it(`treats ${name} as a literal selected directory`, () => fixture(async (root) => {
      const path = marker(root, name)
      assert.deepEqual(await discoverLocalGitCandidates([path]), { candidates: [path], failedLocations: 0 })
    }))
  }
  it('deduplicates overlapping roots without rescanning identical directories', () => fixture(async (root) => {
    const child = marker(root, 'nested')
    const reads: string[] = []
    const result = await discoverLocalGitCandidates([root, child, root], {
      ...actualAccess, readDirectory: async (path) => { reads.push(path); return actualAccess.readDirectory(path) },
    })
    assert.deepEqual(result.candidates, [child])
    assert.equal(new Set(reads).size, reads.length)
  }))
  it('retains the marker-at-level-six cutoff without reading deeper directories', () => fixture(async (root) => {
    const allowed = marker(root, Array.from({ length: MAX_LOCAL_DISCOVERY_DEPTH }, () => 'level').join('/'))
    marker(allowed, 'too-deep')
    const reads: string[] = []
    const result = await discoverLocalGitCandidates([root], {
      ...actualAccess, readDirectory: async (path) => { reads.push(path); return actualAccess.readDirectory(path) },
    })
    assert.deepEqual(result.candidates, [allowed])
    assert.ok(reads.every((path) => !path.endsWith('too-deep')))
  }))
  for (const name of ['node_modules', '.venv', 'vendor', '.cache', 'dist', 'build', '.developer-lens', '.developer-lens-synthetic', 'coverage']) {
    it(`prunes ${name} without reading its children`, () => fixture(async (root) => {
      marker(root, `${name}/private-child`)
      const visible = marker(root, 'visible')
      const reads: string[] = []
      const result = await discoverLocalGitCandidates([root], {
        ...actualAccess, readDirectory: async (path) => { reads.push(path); return actualAccess.readDirectory(path) },
      })
      assert.deepEqual(result.candidates, [visible])
      assert.ok(reads.every((path) => !path.startsWith(join(root, name))))
    }))
  }
  it('never traverses Git metadata or nested protected output roots', () => fixture(async (root) => {
    marker(root, '.git/objects/fake')
    marker(root, 'public/data/fake')
    marker(root, '.claude/worktrees/fake')
    marker(root, '.agent-harness/runtime/fake')
    const visited: string[] = []
    const result = await discoverLocalGitCandidates([root], {
      ...actualAccess, readDirectory: async (path) => { visited.push(path); return actualAccess.readDirectory(path) },
    })
    assert.deepEqual(result.candidates, [root])
    for (const relative of ['.git', 'public/data', '.claude/worktrees', '.agent-harness/runtime']) {
      assert.ok(visited.every((path) => !path.startsWith(join(root, relative))))
    }
  }))
  it('counts missing and non-directory selected roots instead of a complete empty scan', () => fixture(async (root) => {
    const path = join(root, 'ordinary-file')
    writeFileSync(path, 'invented')
    assert.deepEqual(await discoverLocalGitCandidates([join(root, 'missing'), path]), { candidates: [], failedLocations: 2 })
  }))
  it('refuses empty and NUL roots before filesystem access', async () => {
    let calls = 0
    const result = await discoverLocalGitCandidates(['', 'a\0b'], {
      lstat: async () => { calls++; return directory }, readDirectory: async () => { calls++; return [] },
    })
    assert.equal(result.failedLocations, 2)
    assert.equal(calls, 0)
  })
  it('does not follow symlink children or a symlink selected root', async () => {
    const root = resolve('invented-root')
    const link = resolve('invented-link')
    const reads: string[] = []
    const result = await discoverLocalGitCandidates([root, link], {
      lstat: async (path) => path === link ? symlink : directory,
      readDirectory: async (path) => { reads.push(path); return [{ name: 'escape', ...symlink }] },
    })
    assert.deepEqual(reads, [root])
    assert.equal(result.failedLocations, 1)
  })
  it('rechecks directory type before traversal when an entry was replaced by a symlink', async () => {
    const root = resolve('invented-root')
    const reads: string[] = []
    const result = await discoverLocalGitCandidates([root], {
      lstat: async (path) => path === root ? directory : symlink,
      readDirectory: async (path) => { reads.push(path); return [{ name: 'changed', ...directory }] },
    })
    assert.deepEqual(reads, [root])
    assert.equal(result.failedLocations, 1)
  })
  it('counts a symlink Git marker rather than treating it as a selected repository', async () => {
    const result = await discoverLocalGitCandidates([resolve('invented-root')], {
      lstat: async () => directory,
      readDirectory: async () => [{ name: '.git', ...symlink }],
    })
    assert.deepEqual(result, { candidates: [], failedLocations: 1 })
  })
  it('retains successful candidates while counting an unreadable sibling', async () => {
    const root = resolve('invented-root')
    const result = await discoverLocalGitCandidates([root], {
      lstat: async () => directory,
      readDirectory: async (path) => {
        if (path.endsWith('blocked')) throw new Error('invented permission failure')
        return path === root ? [{ name: '.git', ...file }, { name: 'blocked', ...directory }] : []
      },
    })
    assert.deepEqual(result, { candidates: [root], failedLocations: 1 })
  })
  it('honors a deeper explicit root without rescanning cached parent entries', () => fixture(async (root) => {
    const child = join(root, 'selected')
    const deep = marker(child, Array.from({ length: MAX_LOCAL_DISCOVERY_DEPTH }, () => 'level').join('/'))
    const reads: string[] = []
    const result = await discoverLocalGitCandidates([root, child], {
      ...actualAccess, readDirectory: async (path) => { reads.push(path); return actualAccess.readDirectory(path) },
    })
    assert.deepEqual(result.candidates, [deep])
    assert.equal(reads.length, new Set(reads).size)
  }))
  it('does not follow an actual directory symlink or Windows junction outside the selected root', () => fixture(async (root) => {
    const selected = join(root, 'selected')
    mkdirSync(selected)
    const outside = marker(root, 'outside')
    symlinkSync(outside, join(selected, 'link'), process.platform === 'win32' ? 'junction' : 'dir')
    assert.deepEqual(await discoverLocalGitCandidates([selected]), { candidates: [], failedLocations: 0 })
  }))
  it('caps directory enumeration across the whole request and reports truncation', async () => {
    const root = resolve('invented-root')
    let reads = 0
    const result = await discoverLocalGitCandidates([root], {
      lstat: async () => directory,
      readDirectory: async (path) => {
        reads++
        return path === root ? Array.from({ length: MAX_LOCAL_DISCOVERY_DIRECTORIES + 10 }, (_, index) => ({ name: `child-${index}`, ...directory })) : []
      },
    })
    assert.equal(reads, MAX_LOCAL_DISCOVERY_DIRECTORIES)
    assert.equal(result.failedLocations, 1)
  })
})

describe('local Git discovery coverage integration', () => {
  it('does not inspect roots when no author identity is configured', async () => {
    const result = await collectLocalGit(['\0'], ...dates, { emails: [] })
    assert.equal(result.coverage.status, 'unavailable')
    assert.equal(result.warnings.length, 1)
  })
  it('reports missing-root discovery as unavailable rather than complete zero activity', () => fixture(async (root) => {
    const result = await collectLocalGit([join(root, 'missing')], ...dates, identity)
    assert.equal(result.coverage.status, 'unavailable')
    assert.match(result.coverage.detail, /1 discovery check/)
  }))
  it('reports invalid Git markers as incomplete rather than silently complete', () => fixture(async (root) => {
    const path = marker(root, 'invalid', 'file')
    const result = await collectLocalGit([path], ...dates, identity)
    assert.equal(result.coverage.status, 'unavailable')
    assert.match(result.coverage.detail, /1 discovery check/)
  }))
  it('retains complete zero activity for a successfully inspected repository outside the window', () => fixture(async (root) => {
    const path = committedRepository(root, 'repo')
    const result = await collectLocalGit([path], '2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z', identity)
    assert.equal(result.coverage.status, 'complete')
    assert.equal(result.commits.length, 0)
  }))
  it('keeps valid invented commits while reporting an incomplete selected-root scan', () => fixture(async (root) => {
    const path = committedRepository(root, 'repo[one]')
    const result = await collectLocalGit([path, join(root, 'missing')], ...dates, identity)
    assert.equal(result.coverage.status, 'partial')
    assert.equal(result.commits.length, 1)
    assert.equal(result.repositories.length, 1)
    assert.match(result.coverage.detail, /1 discovery check/)
    assert.equal(result.commits[0].features?.type, 'test')
  }))
  it('deduplicates repeated roots after Git validation', () => fixture(async (root) => {
    const path = committedRepository(root, 'repo')
    const result = await collectLocalGit([root, path, root], ...dates, identity)
    assert.equal(result.coverage.status, 'complete')
    assert.equal(result.commits.length, 1)
  }))

})
