import assert from 'node:assert/strict'

/** Only the existing transitive fast-uri lock entry may change, using registry metadata. */
export function validateFastUriCandidate(before, after, metadata) {
  assert.equal(metadata?.name, 'fast-uri')
  assert.equal(metadata?.version, '3.1.8')
  assert.equal(metadata?.dist?.tarball, 'https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.8.tgz')
  assert.match(metadata?.dist?.integrity ?? '', /^sha512-[A-Za-z0-9+/]{86}==$/)
  const path = 'node_modules/fast-uri'
  assert.equal(before?.packages?.[path]?.version, '3.1.7')
  const expected = structuredClone(before)
  Object.assign(expected.packages[path], {
    version: metadata.version, resolved: metadata.dist.tarball, integrity: metadata.dist.integrity,
  })
  assert.deepEqual(after, expected, 'Candidate changed more than the three pinned fast-uri fields')
  return { beforeVersion: '3.1.7', afterVersion: '3.1.8', resolved: metadata.dist.tarball, integrity: metadata.dist.integrity }
}
