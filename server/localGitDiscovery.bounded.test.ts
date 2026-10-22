import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { describe, it } from 'vitest'
import { COLLECTION_WARNINGS } from './collectionWarnings.js'
import {
  discoverLocalGitCandidates,
  MAX_LOCAL_DISCOVERY_ENTRIES,
  MAX_LOCAL_DISCOVERY_ENTRIES_PER_DIRECTORY,
} from './localGitDiscovery.js'

const directory = { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }
const file = { isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
// Absolute invented paths are used only by mocks, independent of the checkout.
const root = resolve('/', 'invented-root')

/** Yields `count` invented entries one at a time and records how many the walker pulled. */
function stream(count: number, pulled: { value: number }, first: ReadonlyArray<{ name: string }> = []) {
  const filler = { name: 'invented-file', ...file }
  return (async function* () {
    for (let index = 0; index < count; index++) {
      pulled.value++
      yield index < first.length ? { ...first[index], ...directory } : filler
    }
  })()
}

describe('bounded local discovery entry reads', () => {
  it('stops pulling a flat directory at the per-directory ceiling and reports it count-only', async () => {
    const pulled = { value: 0 }
    const result = await discoverLocalGitCandidates([root], {
      lstat: async () => directory,
      readDirectory: async () => stream(250_000, pulled),
    })
    assert.ok(pulled.value <= MAX_LOCAL_DISCOVERY_ENTRIES_PER_DIRECTORY + 1, `pulled ${pulled.value}`)
    assert.equal(result.cappedDirectories, 1)
    assert.equal(result.failedLocations, 1)
    assert.deepEqual(result.candidates, [])
  })

  it('stops across directories at the global ceiling', async () => {
    const pulled = { value: 0 }
    const names = Array.from({ length: 12 }, (_, index) => ({ name: `d${index}` }))
    const result = await discoverLocalGitCandidates([root], {
      lstat: async () => directory,
      readDirectory: async (path) => path === root
        ? stream(names.length, { value: 0 }, names)
        : stream(MAX_LOCAL_DISCOVERY_ENTRIES_PER_DIRECTORY - 1, pulled),
    })
    assert.ok(pulled.value <= MAX_LOCAL_DISCOVERY_ENTRIES, `pulled ${pulled.value}`)
    assert.ok(pulled.value >= MAX_LOCAL_DISCOVERY_ENTRIES - MAX_LOCAL_DISCOVERY_ENTRIES_PER_DIRECTORY)
    assert.equal(result.cappedDirectories, 1)
    assert.ok(result.failedLocations >= 1)
  })

  it('still finds a .git marker in a small streamed directory, with no cap reported', async () => {
    const result = await discoverLocalGitCandidates([root], {
      lstat: async () => directory,
      readDirectory: async (path) => (async function* () {
        if (path !== root) return
        yield { name: 'zeta', ...directory }
        yield { name: '.git', ...directory }
        yield { name: 'alpha', ...directory }
      })(),
    })
    assert.deepEqual(result, { candidates: [root], failedLocations: 0 })
  })

  it('names nothing in the count-only warning', () => {
    const text = COLLECTION_WARNINGS.localDiscoveryEntryLimit(3)
    assert.match(text, /^3 /)
    assert.doesNotMatch(text, /invented|[\\/]/)
  })
})
