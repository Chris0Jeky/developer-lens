import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  createGithubCoreContinuityReviewSignatureMaterial,
  GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ALGORITHM,
  GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_DOMAIN,
  GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ERROR_CODE,
  GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_SCHEMA_VERSION,
  GithubCoreContinuityReviewSignatureProposalError,
  type GithubCoreContinuityReviewSignatureProposalInput,
  verifyGithubCoreContinuityReviewSignatureProposal,
} from './v3ContinuityReviewSignatureProposal.js'

let publicKey: KeyObject
let privateKey: KeyObject

beforeAll(() => {
  const pair = generateKeyPairSync('ed25519')
  publicKey = pair.publicKey
  privateKey = pair.privateKey
})

const sha256 = (value: Buffer): string => createHash('sha256').update(value).digest('hex')

function publicSpki(key: KeyObject = publicKey): Buffer {
  const exported = key.export({ format: 'der', type: 'spki' })
  if (!Buffer.isBuffer(exported)) throw new Error('invented fixture export failed')
  return exported
}

function fixture(
  overrides: Readonly<{
    anchorBytes?: Buffer
    signingKey?: KeyObject
    verificationKey?: KeyObject
    signingMaterial?: Buffer
  }> = {},
): GithubCoreContinuityReviewSignatureProposalInput {
  const anchorBytes = Buffer.from(
    overrides.anchorBytes ?? Buffer.from('{"invented":"continuity-review"}', 'utf8'),
  )
  const verificationSpki = publicSpki(overrides.verificationKey)
  const anchorSha256 = sha256(anchorBytes)
  const publicKeySpkiSha256 = sha256(verificationSpki)
  const material = overrides.signingMaterial ?? createGithubCoreContinuityReviewSignatureMaterial(
    anchorSha256,
    publicKeySpkiSha256,
  )
  const signature = sign(null, material, overrides.signingKey ?? privateKey)
  return {
    anchorBytesBase64: anchorBytes.toString('base64'),
    candidatePublicKeySpkiBase64: verificationSpki.toString('base64'),
    signatureEnvelope: {
      schemaVersion: GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_SCHEMA_VERSION,
      algorithm: GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ALGORITHM,
      anchorSha256,
      publicKeySpkiSha256,
      signatureBase64: signature.toString('base64'),
    },
  }
}

function expectInvalid(input: unknown): void {
  expect(() => verifyGithubCoreContinuityReviewSignatureProposal(input)).toThrow(
    GithubCoreContinuityReviewSignatureProposalError,
  )
  try {
    verifyGithubCoreContinuityReviewSignatureProposal(input)
  } catch (error) {
    expect(error).toMatchObject({
      code: GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ERROR_CODE,
      message: GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ERROR_CODE,
    })
    expect(JSON.stringify(error)).not.toMatch(/continuity-review|BEGIN|PRIVATE|PUBLIC|signatureBase64/)
  }
}

function withEnvelope(
  input: GithubCoreContinuityReviewSignatureProposalInput,
  changes: Readonly<Record<string, unknown>>,
): GithubCoreContinuityReviewSignatureProposalInput {
  return {
    ...input,
    signatureEnvelope: {
      ...(input.signatureEnvelope as Record<string, unknown>),
      ...changes,
    },
  }
}

describe('github.core continuity review signature proposal', () => {
  it('freezes the exact versioned binary signing material', () => {
    const material = createGithubCoreContinuityReviewSignatureMaterial(
      '00'.repeat(32),
      'ff'.repeat(32),
    )
    expect(GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_DOMAIN)
      .toBe('developer-lens:github-core-continuity-review-signature:v1')
    expect(material.toString('hex')).toBe(
      '646576656c6f7065722d6c656e733a6769746875622d636f72652d636f6e74696e756974792d7265766965772d7369676e61747572653a763100' +
      '00'.repeat(32) +
      'ff'.repeat(32),
    )
    expect(material.length).toBe(
      Buffer.byteLength(GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_DOMAIN, 'ascii') + 1 + 32 + 32,
    )
    expect(() => createGithubCoreContinuityReviewSignatureMaterial('A'.repeat(64), 'f'.repeat(64)))
      .toThrow(GithubCoreContinuityReviewSignatureProposalError)
  })

  it('matches a process-only invented signature and returns no provenance values', () => {
    const input = fixture()
    const result = verifyGithubCoreContinuityReviewSignatureProposal(input)
    expect(result).toEqual({
      kind: 'github_core_continuity_review_signature_proposal',
      status: 'signature_matches',
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/sha256|publicKey|anchorBytes|owner|reviewer|approved|authorized/i)
  })

  it('rejects anchor, fingerprint, candidate-key, signature, and domain mutations', () => {
    const input = fixture()
    const envelope = input.signatureEnvelope as Record<string, unknown>
    expectInvalid({
      ...input,
      anchorBytesBase64: Buffer.from('{"invented":"changed-anchor"}', 'utf8').toString('base64'),
    })
    expectInvalid(withEnvelope(input, { anchorSha256: '0'.repeat(64) }))
    expectInvalid(withEnvelope(input, { publicKeySpkiSha256: '1'.repeat(64) }))
    const other = generateKeyPairSync('ed25519')
    expectInvalid({
      ...input,
      candidatePublicKeySpkiBase64: publicSpki(other.publicKey).toString('base64'),
    })
    const signature = Buffer.from(String(envelope.signatureBase64), 'base64')
    signature[0] ^= 1
    expectInvalid(withEnvelope(input, { signatureBase64: signature.toString('base64') }))
    const legacyMaterial = Buffer.concat([
      Buffer.from('developer-lens:github-core-continuity-review-signature:legacy\0', 'ascii'),
      Buffer.from(String(envelope.anchorSha256), 'hex'),
      Buffer.from(String(envelope.publicKeySpkiSha256), 'hex'),
    ])
    expectInvalid(fixture({ signingMaterial: legacyMaterial }))
  })

  it('rejects field swaps and a signature made by a different key', () => {
    const input = fixture()
    const envelope = input.signatureEnvelope as Record<string, unknown>
    expectInvalid(withEnvelope(input, {
      anchorSha256: envelope.publicKeySpkiSha256,
      publicKeySpkiSha256: envelope.anchorSha256,
    }))
    const other = generateKeyPairSync('ed25519')
    expectInvalid(fixture({ signingKey: other.privateKey }))
  })

  it('requires the exact Ed25519 SPKI DER prefix, OID, and length', () => {
    const input = fixture()
    const spki = Buffer.from(input.candidatePublicKeySpkiBase64, 'base64')
    for (const malformed of [
      spki.subarray(0, 43),
      Buffer.concat([spki, Buffer.from([0])]),
      Buffer.from(spki).fill(0, 0, 12),
      Buffer.from(spki).map((value, index) => index === 8 ? value ^ 1 : value),
      Buffer.from('-----BEGIN PUBLIC KEY-----\npoison\n-----END PUBLIC KEY-----', 'ascii'),
    ]) {
      expectInvalid({ ...input, candidatePublicKeySpkiBase64: malformed.toString('base64') })
    }
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const rsaDer = rsa.publicKey.export({ format: 'der', type: 'spki' })
    if (!Buffer.isBuffer(rsaDer)) throw new Error('invented fixture export failed')
    expectInvalid({ ...input, candidatePublicKeySpkiBase64: rsaDer.toString('base64') })
  })

  it('requires a canonical 64-byte Ed25519 signature with S below the group order', () => {
    const input = fixture()
    const envelope = input.signatureEnvelope as Record<string, unknown>
    const signature = Buffer.from(String(envelope.signatureBase64), 'base64')
    expectInvalid(withEnvelope(input, {
      signatureBase64: signature.subarray(0, 63).toString('base64'),
    }))
    expectInvalid(withEnvelope(input, {
      signatureBase64: Buffer.concat([signature, Buffer.from([0])]).toString('base64'),
    }))
    const highS = Buffer.from(signature)
    Buffer.from(
      'edd3f55c1a631258d69cf7a2def9de1400000000000000000000000000000010',
      'hex',
    ).copy(highS, 32)
    expectInvalid(withEnvelope(input, { signatureBase64: highS.toString('base64') }))
  })

  it('rejects noncanonical base64 and bounded-anchor violations', () => {
    const input = fixture()
    const envelope = input.signatureEnvelope as Record<string, unknown>
    expectInvalid({ ...input, anchorBytesBase64: '' })
    expectInvalid({ ...input, anchorBytesBase64: `${input.anchorBytesBase64}\n` })
    expectInvalid({ ...input, anchorBytesBase64: Buffer.alloc(65 * 1024).toString('base64') })
    expectInvalid({
      ...input,
      candidatePublicKeySpkiBase64: input.candidatePublicKeySpkiBase64.replace(/=$/, ''),
    })
    expectInvalid(withEnvelope(input, {
      signatureBase64: String(envelope.signatureBase64).replace(/==$/, ''),
    }))
  })

  it('rejects unknown fields, prototypes, symbols, and accessors without reading getters', () => {
    const input = fixture()
    expectInvalid({ ...input, owner: 'poison' })
    expectInvalid({ ...input, [Symbol('poison')]: true })
    expectInvalid(Object.assign(Object.create({ owner: 'poison' }), input))
    expectInvalid(withEnvelope(input, { authorization: 'poison' }))
    let getterReads = 0
    const accessor = { ...input }
    Object.defineProperty(accessor, 'anchorBytesBase64', {
      enumerable: true,
      get: () => {
        getterReads += 1
        return input.anchorBytesBase64
      },
    })
    expectInvalid(accessor)
    const envelopeAccessor = { ...(input.signatureEnvelope as Record<string, unknown>) }
    Object.defineProperty(envelopeAccessor, 'signatureBase64', {
      enumerable: true,
      get: () => {
        getterReads += 1
        return 'poison'
      },
    })
    expectInvalid({ ...input, signatureEnvelope: envelopeAccessor })
    expect(getterReads).toBe(0)
  })

  it('collapses malformed crypto and container failures to one content-free error', () => {
    for (const value of [null, [], {}, { ...fixture(), signatureEnvelope: null }]) expectInvalid(value)
  })
})
