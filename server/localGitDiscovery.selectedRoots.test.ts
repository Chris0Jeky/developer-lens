import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, it } from 'vitest'
import { discoverLocalGitCandidates, type LocalDiscoveryAccess } from './localGitDiscovery.js'

const directory = { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }
const marker = { name: '.git', ...directory }
const protectedPaths = [
  '.git', 'node_modules', '.venv', 'vendor', '.cache', 'dist', 'build',
  '.developer-lens', '.developer-lens-synthetic', 'coverage',
  'public/data', '.claude/worktrees', '.agent-harness/runtime',
  '.Developer-Lens', 'DIST', 'Public/Data', '.CLAUDE/Worktrees', '.Agent-Harness/RUNTIME',
]

function recordedAccess(): { access: LocalDiscoveryAccess; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    access: {
      lstat: async (path) => { calls.push(path); return directory },
      readDirectory: async (path) => { calls.push(path); return [marker] },
    },
  }
}

describe('explicit protected roots fail before filesystem access (#411 late review)', () => {
  for (const relative of protectedPaths) {
    for (const suffix of ['', 'nested/repository']) {
      it(`refuses selected ${relative}/${suffix} without stat or enumeration`, async () => {
        const { access, calls } = recordedAccess()
        const root = resolve('invented-selection', relative, suffix)
        assert.deepEqual(await discoverLocalGitCandidates([root], access), {
          candidates: [], failedLocations: 1,
        })
        assert.deepEqual(calls, [])
      })
    }
  }

  for (const relative of ['distribution', '.developer-lens-other', 'node_modules-copy', 'public/database', '.claude/worktrees-copy', '.agent-harness/runtime-old']) {
    it(`retains component-boundary lookalike ${relative}`, async () => {
      const { access, calls } = recordedAccess()
      const root = resolve('InventedSelection', relative)
      assert.deepEqual(await discoverLocalGitCandidates([root], access), {
        candidates: [root], failedLocations: 0,
      })
      assert.deepEqual(calls, [root, root])
    })
  }

  it('normalizes dot segments before checking the selected boundary', async () => {
    const { access, calls } = recordedAccess()
    const root = `${resolve('invented-selection')}/ordinary/../public/data/repository`
    assert.deepEqual(await discoverLocalGitCandidates([root], access), { candidates: [], failedLocations: 1 })
    assert.deepEqual(calls, [])
  })

  it('continues safe selections in either order without disclosing refused paths', async () => {
    const safe = resolve('InventedSelection', 'VisibleRepo')
    const refused = resolve('InventedSelection', '.developer-lens', 'private-canary')
    for (const roots of [[refused, safe], [safe, refused]]) {
      const { access, calls } = recordedAccess()
      const result = await discoverLocalGitCandidates(roots, access)
      assert.deepEqual(result, { candidates: [safe], failedLocations: 1 })
      assert.deepEqual(calls, [safe, safe])
      assert.equal(JSON.stringify(result).includes('private-canary'), false)
    }
  })

  it('applies the guard with the default filesystem adapter in an invented tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lens-selected-root-'))
    try {
      const refused = join(root, '.developer-lens', 'hidden')
      const safe = join(root, 'VisibleRepo')
      await mkdir(join(refused, '.git'), { recursive: true })
      await mkdir(join(safe, '.git'), { recursive: true })
      assert.deepEqual(await discoverLocalGitCandidates([refused, safe]), {
        candidates: [safe], failedLocations: 1,
      })
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
