import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, it } from 'vitest'
import {
  createBatchedGitIndexTrackedTextValidationAccess,
  MAX_METADATA_ARGUMENT_UNITS,
  MAX_METADATA_PATHS,
  planGitIndexMetadataBatches,
} from './gitIndexMetadata.js'
import {
  buildGitIndexMetadataArgs,
  validateTrackedTextForWindowsUserHomePaths,
} from './projectContextValidation.js'

const encode = (value: string) => new TextEncoder().encode(value)
const record = (path: string, oid = 'a'.repeat(40)) => `100644 ${oid} 0\t${path}\0`
// Conservative Windows quoting/UTF-16 estimate, including a fixed executable allowance.
const units = (args: readonly string[]) => 1024 + args.reduce((sum, arg) => sum + 2 * arg.length + 3, 0)
const many = (count = 600) => Array.from({ length: count }, (_, index) => `docs/fixture-${index}-${'x'.repeat(80)}.md`)

describe('bounded Git index metadata planning (#257)', () => {
  it('never turns an empty selection into an unfiltered metadata command', () => {
    assert.deepEqual(planGitIndexMetadataBatches([]), [])
    const access = createBatchedGitIndexTrackedTextValidationAccess(() => { throw new Error('unexpected command') })
    assert.deepEqual(access.listEntries([]), [])
  })
  it('preserves small literal selections without mutating the input', () => {
    const input = Object.freeze(['docs/a.md', 'docs/name with space.md'])
    assert.deepEqual(planGitIndexMetadataBatches(input), [[...input]])
  })
  it('bounds both path count and encoded argv cost for a large selection', () => {
    const input = many(3000)
    const batches = planGitIndexMetadataBatches(input)
    assert.ok(batches.length > 1)
    assert.deepEqual(batches.flat(), input)
    for (const batch of batches) {
      assert.ok(batch.length > 0 && batch.length <= MAX_METADATA_PATHS)
      assert.ok(units(buildGitIndexMetadataArgs(batch)) <= MAX_METADATA_ARGUMENT_UNITS)
    }
  })
  it('splits short names at the declared count cap', () => {
    const batches = planGitIndexMetadataBatches(Array.from({ length: MAX_METADATA_PATHS + 1 }, (_, i) => `${i}`))
    assert.deepEqual(batches.map((batch) => batch.length), [MAX_METADATA_PATHS, 1])
  })
  for (const name of ['docs/*?.md', 'docs/[ab]{cd}.md', ':(exclude)docs/all.md', '-n', '--', 'docs/quote"tail\\', 'docs/emoji-😀.md', 'docs/line\nbreak.md']) {
    it(`keeps literal path bytes for ${JSON.stringify(name)}`, () => {
      assert.deepEqual(planGitIndexMetadataBatches([name]), [[name]])
      assert.deepEqual(buildGitIndexMetadataArgs([name]), ['--literal-pathspecs', 'ls-files', '--stage', '-z', '--', name])
    })
  }
  for (const invalid of ['', 'docs/null\0tail', 'x'.repeat(7000)]) {
    it(`refuses an invalid or oversized path of length ${invalid.length} without exposing it`, () => {
      assert.throws(() => planGitIndexMetadataBatches(['docs/good.md', invalid]), (error: unknown) => {
        assert.equal((error as Error).message, 'Git metadata selection exceeds the bounded argument contract')
        return true
      })
    })
  }
  it('preflights the entire selection before executing the first metadata read', () => {
    let calls = 0
    const access = createBatchedGitIndexTrackedTextValidationAccess(() => { calls++; return encode('') })
    assert.throws(() => access.listEntries([...many(), 'x'.repeat(7000)]))
    assert.equal(calls, 0)
  })
  it('refuses duplicate selection paths before a command is run', () => {
    let calls = 0
    const access = createBatchedGitIndexTrackedTextValidationAccess(() => { calls++; return encode('') })
    assert.throws(() => access.listEntries(['docs/a.md', 'docs/a.md']))
    assert.equal(calls, 0)
  })
})

describe('batch metadata adapter retains snapshot and privacy contracts', () => {
  it('reads every selected path exactly once through bounded literal commands', () => {
    const commands: string[][] = []
    const access = createBatchedGitIndexTrackedTextValidationAccess((args) => {
      assert.ok(units(args) <= MAX_METADATA_ARGUMENT_UNITS)
      assert.deepEqual(args.slice(0, 5), ['--literal-pathspecs', 'ls-files', '--stage', '-z', '--'])
      commands.push([...args])
      return encode(args.slice(5).map((path) => record(path)).join(''))
    })
    const input = many()
    assert.deepEqual(access.listEntries(input).map((entry) => entry.path), input)
    assert.ok(commands.length > 1)
    assert.deepEqual(commands.flatMap((args) => args.slice(5)), input)
  })
  for (const [name, reply] of [
    ['missing metadata', ''],
    ['foreign path', record('docs/other.md')],
    ['duplicate records', record('docs/a.md') + record('docs/a.md')],
    ['unterminated record', record('docs/a.md').slice(0, -1)],
    ['malformed mode', record('docs/a.md').replace('100644', 'garbage')],
  ]) {
    it(`fails closed on ${name}`, () => {
      const access = createBatchedGitIndexTrackedTextValidationAccess(() => encode(reply))
      assert.throws(() => access.listEntries(['docs/a.md']))
    })
  }
  it('decodes every batch with fatal UTF-8 rather than stitching partial records together', () => {
    const invalid = new Uint8Array([...encode('100644 ' + 'a'.repeat(40) + ' 0\tdocs/'), 0xff, 0])
    const access = createBatchedGitIndexTrackedTextValidationAccess(() => invalid)
    assert.throws(() => access.listEntries(['docs/a.md']))
  })
  it('does not read any blobs after an intermediate batch fails', () => {
    const paths = many()
    let batches = 0
    let blobs = 0
    const access = createBatchedGitIndexTrackedTextValidationAccess((args) => {
      if (args[0] === 'ls-files') return encode(paths.join('\0') + '\0')
      if (args[0] === 'cat-file') { blobs++; return encode('safe') }
      if (++batches === 2) throw new Error('injected metadata failure')
      return encode(args.slice(5).map((path) => record(path)).join(''))
    })
    assert.deepEqual(validateTrackedTextForWindowsUserHomePaths(access), ['unable to enumerate eligible Git-tracked metadata'])
    assert.equal(blobs, 0)
  })
  it('keeps protected paths out of every batch before metadata access', () => {
    const paths = [...many(), 'dist/forbidden.md', 'public/data/forbidden.json']
    const seen: string[] = []
    const access = createBatchedGitIndexTrackedTextValidationAccess((args) => {
      if (args[0] === 'ls-files') return encode(paths.join('\0') + '\0')
      if (args[0] === 'cat-file') return encode('safe')
      const selection = args.slice(5)
      seen.push(...selection)
      return encode(selection.map((path) => record(path)).join(''))
    })
    const errors = validateTrackedTextForWindowsUserHomePaths(access)
    assert.ok(errors.length > 0)
    assert.ok(seen.every((path) => !path.startsWith('dist/') && !path.startsWith('public/data/')))
  })
  it('rejects changed object IDs across the two complete metadata snapshots', () => {
    const paths = many()
    const count = planGitIndexMetadataBatches(paths).length
    let metadataCalls = 0
    const access = createBatchedGitIndexTrackedTextValidationAccess((args) => {
      if (args[0] === 'ls-files') return encode(paths.join('\0') + '\0')
      if (args[0] === 'cat-file') return encode('safe')
      const oid = metadataCalls++ < count ? 'a'.repeat(40) : 'b'.repeat(40)
      return encode(args.slice(5).map((path) => record(path, oid)).join(''))
    })
    assert.ok(validateTrackedTextForWindowsUserHomePaths(access).includes('eligible Git-tracked metadata snapshot changed during validation'))
  })
  it('rejects paths returned in the wrong batch even when their global union is correct', () => {
    const input = many(300)
    const batches = planGitIndexMetadataBatches(input)
    let index = 0
    const access = createBatchedGitIndexTrackedTextValidationAccess(() => {
      const wrong = batches[(index++ + 1) % batches.length]
      return encode(wrong.map((path) => record(path)).join(''))
    })
    assert.throws(() => access.listEntries(input))
  })
  it('pins the production verifier to the bounded adapter', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(resolve('scripts/verifyProjectContext.ts'), 'utf8')
    assert.match(source, /createBatchedGitIndexTrackedTextValidationAccess\(/)
    assert.doesNotMatch(source, /\bcreateGitIndexTrackedTextValidationAccess\(/)
  })
  it('replays real Git index metadata across batches and preserves literal filenames', () => {
    const root = mkdtempSync(join(tmpdir(), 'lens-metadata-'))
    try {
      execFileSync('git', ['init', '--quiet', root])
      mkdirSync(join(root, 'docs'))
      const paths = [...Array.from({ length: 150 }, (_, i) => `docs/fixture-${i}.md`), 'docs/space name.md', 'docs/[literal].md']
      for (const path of paths) writeFileSync(join(root, path), 'invented safe text\n')
      execFileSync('git', ['-C', root, 'add', '--', 'docs'])
      let batches = 0
      const access = createBatchedGitIndexTrackedTextValidationAccess((args) => {
        if (args[0] === '--literal-pathspecs') batches++
        return execFileSync('git', ['-C', root, ...args])
      })
      assert.deepEqual(new Set(access.listEntries(paths).map((entry) => entry.path)), new Set(paths))
      assert.ok(batches > 1)
      assert.deepEqual(validateTrackedTextForWindowsUserHomePaths(access), [])
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
