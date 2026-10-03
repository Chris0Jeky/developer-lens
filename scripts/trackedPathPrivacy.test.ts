import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  validateTrackedTextForWindowsUserHomePaths,
  type GitIndexEntry,
  type TrackedTextValidationAccess,
} from './projectContextValidation.js'

const refusal = 'Git-tracked pathname contains a Windows user-home path'
const inventedUser = 'InventedPathUser'
const home = (separator = '/') => ['C:', 'Users', inventedUser, 'note.md'].join(separator)
const entry = (path: string, overrides: Partial<GitIndexEntry> = {}): GitIndexEntry => ({
  path, mode: '100644', objectId: 'a'.repeat(40), stage: '0', ...overrides,
})
const bytes = (text: string) => new TextEncoder().encode(text)

function exercise(path: string, overrides: Partial<GitIndexEntry> = {}, failRead = false) {
  const metadataRequests: string[][] = []
  let reads = 0
  const access: TrackedTextValidationAccess = {
    listPaths: () => [path],
    listEntries: (paths) => {
      metadataRequests.push([...paths])
      return paths.map((name) => entry(name, overrides))
    },
    readBlob: () => {
      reads += 1
      if (failRead) throw new Error(`invented read failure ${path}`)
      return bytes('ordinary invented text')
    },
  }
  return { errors: validateTrackedTextForWindowsUserHomePaths(access), metadataRequests, reads }
}

function assertPrivateRefusal(result: ReturnType<typeof exercise>) {
  assert.deepEqual(result.errors, [refusal])
  assert.deepEqual(result.metadataRequests, [])
  assert.equal(result.reads, 0)
  assert.ok(!result.errors.join('\n').includes(inventedUser))
}

describe('tracked filename privacy (#257)', () => {
  for (const [name, path] of [
    ['forward separators', `docs/${home()}`],
    ['backward separators', `docs/${home('\\')}`],
    ['serialized separators', `docs/${home('\\\\')}`],
    ['case-insensitive segments', `docs/${home().toLowerCase()}`],
    ['bare drive path', home()],
    ['mixed separators', `docs/${['D:', 'USERS', inventedUser].join('\\')}/note.md`],
  ]) {
    it(`refuses ${name} before metadata or content access`, () => {
      assertPrivateRefusal(exercise(path))
    })
  }

  for (const [name, overrides, failRead] of [
    ['executable', { mode: '100755' }, false],
    ['symlink', { mode: '120000' }, false],
    ['unsupported mode', { mode: '160000' }, false],
    ['unmerged entry', { stage: '1' }, false],
    ['blob failure', {}, true],
  ] as const) {
    it(`does not expose a forbidden filename through the ${name} diagnostic`, () => {
      assertPrivateRefusal(exercise(`docs/${home()}`, overrides, failRead))
    })
  }

  it('still validates ordinary paths while excluding forbidden names from both metadata snapshots', () => {
    const unsafe = `docs/${home()}`
    const requests: string[][] = []
    let reads = 0
    const errors = validateTrackedTextForWindowsUserHomePaths({
      listPaths: () => [unsafe, 'README.md'],
      listEntries: (paths) => {
        requests.push([...paths])
        return paths.map((path) => entry(path))
      },
      readBlob: () => { reads += 1; return bytes('ordinary invented text') },
    })
    assert.deepEqual(errors, [refusal])
    assert.deepEqual(requests, [['README.md'], ['README.md']])
    assert.equal(reads, 1)
  })

  it('keeps protected-root rejection ahead of filename and metadata checks', () => {
    const result = exercise(`dist/${home()}`)
    assert.deepEqual(result.errors, ['protected Git-tracked path is not allowed'])
    assert.deepEqual(result.metadataRequests, [])
    assert.equal(result.reads, 0)
  })

  it('preserves the existing URI and non-boundary near misses', () => {
    for (const path of ['docs/basic:/users/current.md', `docs/prefix${home()}`, 'docs/C:/Synthetic/note.md']) {
      const result = exercise(path)
      assert.deepEqual(result.errors, [])
      assert.deepEqual(result.metadataRequests, [[path], [path]])
      assert.equal(result.reads, 1)
    }
  })

  it('preserves ordinary filename diagnostics for forbidden blob contents', () => {
    const errors = validateTrackedTextForWindowsUserHomePaths({
      listPaths: () => ['README.md'],
      listEntries: () => [entry('README.md')],
      readBlob: () => bytes(`invented source ${home()}`),
    })
    assert.deepEqual(errors, ['README.md: contains a Windows user-home path'])
    assert.ok(!errors.join('\n').includes(inventedUser))
  })

  it('fails closed if a forbidden filename appears in the final path snapshot', () => {
    let lists = 0
    let reads = 0
    const errors = validateTrackedTextForWindowsUserHomePaths({
      listPaths: () => ++lists === 1 ? ['README.md'] : ['README.md', `docs/${home()}`],
      listEntries: (paths) => paths.map((path) => entry(path)),
      readBlob: () => { reads += 1; return bytes('unused') },
    })
    assert.deepEqual(errors, ['Git-tracked path snapshot changed during validation'])
    assert.equal(reads, 0)
  })

  it('fails closed if a rejected filename disappears while ordinary paths remain', () => {
    let lists = 0
    let reads = 0
    const errors = validateTrackedTextForWindowsUserHomePaths({
      listPaths: () => ++lists === 1 ? [`docs/${home()}`, 'README.md'] : ['README.md'],
      listEntries: (paths) => paths.map((path) => entry(path)),
      readBlob: () => { reads += 1; return bytes('unused') },
    })
    assert.deepEqual(errors, [refusal, 'Git-tracked path snapshot changed during validation'])
    assert.equal(reads, 0)
  })

  it('does not expose forbidden names supplied only in mismatched metadata', () => {
    let reads = 0
    const errors = validateTrackedTextForWindowsUserHomePaths({
      listPaths: () => ['README.md'],
      listEntries: () => [entry(`docs/${home()}`)],
      readBlob: () => { reads += 1; return bytes('unused') },
    })
    assert.deepEqual(errors, ['eligible Git-tracked metadata does not match enumerated paths'])
    assert.equal(reads, 0)
    assert.ok(!errors.join('\n').includes(inventedUser))
  })
})
