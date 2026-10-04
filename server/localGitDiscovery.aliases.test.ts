import assert from 'node:assert/strict'
import { resolve, win32 } from 'node:path'
import { describe, it } from 'vitest'
import { discoverLocalGitCandidates, type LocalDiscoveryAccess } from './localGitDiscovery.js'

const directory = { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }
const marker = { name: '.git', ...directory }
const aliases = [
  '.developer-lens.', '.developer-lens ', 'DIST. ', 'dist ',
  'public./data', 'Public /Data.', '.claude./worktrees', '.claude/worktrees ',
  '.agent-harness /runtime.', '.git.', 'ordinary /repository', 'Public/. /Data',
]

describe('ambiguous trailing-dot and space components fail closed (#413 review)', () => {
  it('records why path resolution alone does not reject Win32 spellings', () => {
    assert.equal(win32.resolve('C:/Invented', '.developer-lens.'), 'C:\\Invented\\.developer-lens.')
    assert.equal(win32.resolve('C:/Invented', 'dist '), 'C:\\Invented\\dist ')
  })
  for (const alias of aliases) {
    for (const suffix of ['', 'nested']) {
      it(`rejects selected ${alias}/${suffix} before any filesystem call`, async () => {
        const calls: string[] = []
        const access: LocalDiscoveryAccess = {
          lstat: async (path) => { calls.push(path); return directory },
          readDirectory: async (path) => { calls.push(path); return [marker] },
        }
        const selected = resolve('InventedAliasRoot', alias, suffix)
        assert.deepEqual(await discoverLocalGitCandidates([selected], access), { candidates: [], failedLocations: 1 })
        assert.deepEqual(calls, [])
      })
    }
  }
  it('prunes discovered ambiguous directory components without accessing them', async () => {
    const root = resolve('InventedAliasRoot')
    const safe = resolve(root, 'Safe.Repo')
    const calls: string[] = []
    const result = await discoverLocalGitCandidates([root], {
      lstat: async (path) => { calls.push(path); return directory },
      readDirectory: async (path) => {
        calls.push(path)
        return path === root
          ? ['.developer-lens.', 'dist ', 'Public ', 'Safe.Repo'].map((name) => ({ name, ...directory }))
          : [marker]
      },
    })
    assert.deepEqual(result, { candidates: [safe], failedLocations: 0 })
    assert.deepEqual(calls, [root, root, safe, safe])
  })
  for (const ordinary of ['Repo Name', 'Version1.2', '.dot-folder']) {
    it(`preserves unambiguous spelling ${ordinary}`, async () => {
      const root = resolve('InventedAliasRoot', ordinary)
      assert.deepEqual(await discoverLocalGitCandidates([root], {
        lstat: async () => directory, readDirectory: async () => [marker],
      }), { candidates: [root], failedLocations: 0 })
    })
  }
})
