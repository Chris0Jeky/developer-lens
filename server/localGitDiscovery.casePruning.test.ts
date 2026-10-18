import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import { describe, it } from 'vitest'
import { discoverLocalGitCandidates } from './localGitDiscovery.js'

const directory = { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }
const marker = { name: '.git', ...directory }

// Case variants are excluded conservatively on every platform. Keep the original
// path spelling for filesystem access; this is not repository identity folding.
describe('protected discovery names are pruned independent of case (#411 review)', () => {
  const protectedPaths = [
    '.GIT', 'NODE_MODULES', '.VENV', 'VENDOR', '.CACHE', 'DIST', 'BUILD',
    '.Developer-Lens', '.Developer-Lens-Synthetic', 'COVERAGE',
    'Public/data', 'public/Data', 'PUBLIC/DATA',
    '.Claude/worktrees', '.claude/Worktrees', '.CLAUDE/WORKTREES',
    '.Agent-Harness/runtime', '.agent-harness/Runtime', '.AGENT-HARNESS/RUNTIME',
  ]
  for (const relative of protectedPaths) {
    it(`prunes ${relative} before stat or enumeration of the protected location`, async () => {
      const root = resolve('invented-case-pruning-root')
      const forbidden = join(root, relative)
      const visible = join(root, 'VisibleRepo')
      const parts = relative.split('/')
      const accessed: string[] = []
      const result = await discoverLocalGitCandidates([root], {
        lstat: async (path) => { accessed.push(path); return directory },
        readDirectory: async (path) => {
          accessed.push(path)
          if (path === root) return [{ name: parts[0], ...directory }, { name: 'VisibleRepo', ...directory }]
          if (parts.length === 2 && path === join(root, parts[0])) return [{ name: parts[1], ...directory }]
          return [marker]
        },
      })
      assert.deepEqual(result, { candidates: [visible], failedLocations: 0 })
      assert.equal(accessed.includes(forbidden), false)
    })
  }
  it('retains the literal case of ordinary selected and child paths', async () => {
    const root = resolve('InventedCaseRoot')
    const child = join(root, 'OrdinaryRepo')
    const accessed: string[] = []
    const result = await discoverLocalGitCandidates([root], {
      lstat: async (path) => { accessed.push(path); return directory },
      readDirectory: async (path) => path === root ? [{ name: 'OrdinaryRepo', ...directory }] : [marker],
    })
    assert.deepEqual(result, { candidates: [child], failedLocations: 0 })
    assert.deepEqual(accessed, [root, child])
  })
})
