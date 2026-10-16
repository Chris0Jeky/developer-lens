import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { validateFastUriCandidate } from './fastUriCandidateValidation.mjs'

const metadata = { name: 'fast-uri', version: '3.1.8', dist: {
  tarball: 'https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.8.tgz',
  integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
} }
function pair() {
  const before = { lockfileVersion: 3, packages: { '': { name: 'invented' },
    'node_modules/fast-uri': { version: '3.1.7', resolved: 'old', integrity: 'old', dev: true },
    'node_modules/other': { version: '1.0.0' } } }
  const after = structuredClone(before)
  Object.assign(after.packages['node_modules/fast-uri'], { version: metadata.version,
    resolved: metadata.dist.tarball, integrity: metadata.dist.integrity })
  return { before, after }
}

describe('bounded fast-uri candidate scope (#398)', () => {
  it('accepts only the three registry-derived fields and preserves its inputs', () => {
    const { before, after } = pair()
    const original = structuredClone({ before, after, metadata })
    assert.equal(validateFastUriCandidate(before, after, metadata).afterVersion, '3.1.8')
    assert.deepEqual({ before, after, metadata }, original)
  })
  for (const [name, mutate] of [
    ['other package', (lock) => { lock.packages['node_modules/other'].version = '2.0.0' }],
    ['root manifest', (lock) => { lock.packages[''].dependencies = { 'fast-uri': '3.1.8' } }],
    ['dev classification', (lock) => { delete lock.packages['node_modules/fast-uri'].dev }],
    ['additional field', (lock) => { lock.packages['node_modules/fast-uri'].unexpected = true }],
    ['wrong version', (lock) => { lock.packages['node_modules/fast-uri'].version = '3.2.0' }],
    ['wrong integrity', (lock) => { lock.packages['node_modules/fast-uri'].integrity = 'wrong' }],
  ]) {
    it(`refuses a changed ${name}`, () => {
      const { before, after } = pair(); mutate(after)
      assert.throws(() => validateFastUriCandidate(before, after, metadata))
    })
  }
  it('refuses a different registry host', () => {
    const { before, after } = pair()
    assert.throws(() => validateFastUriCandidate(before, after, { ...metadata,
      dist: { ...metadata.dist, tarball: 'https://example.invalid/fast-uri.tgz' } }))
  })
  it('refuses malformed registry integrity', () => {
    const { before, after } = pair()
    assert.throws(() => validateFastUriCandidate(before, after, { ...metadata,
      dist: { ...metadata.dist, integrity: 'sha512-invented' } }))
  })
  it('refuses an unexpected source version rather than replaying stale work', () => {
    const { before, after } = pair(); before.packages['node_modules/fast-uri'].version = '3.1.8'
    assert.throws(() => validateFastUriCandidate(before, after, metadata))
  })
})
