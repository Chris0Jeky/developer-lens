import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, it } from 'vitest'

// Exercise the actual transitive implementation selected for Ajv, not a substitute.
const require = createRequire(resolve('package.json'))
const ajvRequire = createRequire(require.resolve('ajv/package.json'))
const uri = ajvRequire('fast-uri')

describe('Ajv URI normalization regression (GHSA-hrr3-gc8f-f4qj / #398)', () => {
  for (const [encoded, canonical] of [['%41', 'a'], ['%5A', 'z'], ['%4a', 'j']]) {
    it(`normalizes encoded host octet ${encoded} consistently`, () => {
      assert.equal(uri.parse(`//${encoded}.example`).host, `${canonical}.example`)
      assert.equal(uri.equal(`//${encoded}.example`, `//${canonical}.example`), true)
    })
  }
  it('retains literal ASCII host normalization', () => {
    assert.equal(uri.parse('//A.EXAMPLE').host, 'a.example')
    assert.equal(uri.equal('//A.EXAMPLE', '//a.example'), true)
  })
  it('does not make case-sensitive paths equivalent', () => {
    assert.equal(uri.equal('https://example.invalid/A', 'https://example.invalid/a'), false)
  })
})
