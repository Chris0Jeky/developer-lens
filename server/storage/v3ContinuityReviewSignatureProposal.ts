import { createHash, createPublicKey, verify } from 'node:crypto'

/**
 * B2b-ii-j is a process-only cryptographic proposal over invented fixtures.
 *
 * A match proves only that one signature covers the supplied anchor bytes and
 * candidate public key under this fixed domain. It does not prove that the key
 * belongs to the owner or an approved reviewer. This module has no signer, key
 * generation, key enrollment, filesystem, storage, clock, lifecycle, CAS,
 * retention, network, production caller, or capability effect.
 */
export const GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_SCHEMA_VERSION =
  'github-core-continuity-review-signature.v1' as const
export const GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ALGORITHM = 'Ed25519' as const
export const GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_DOMAIN =
  'developer-lens:github-core-continuity-review-signature:v1' as const
export const GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ERROR_CODE =
  'INVALID_V3_CONTINUITY_REVIEW_SIGNATURE_PROPOSAL' as const

const SHA256 = /^[0-9a-f]{64}$/
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const MAX_ANCHOR_BYTES = 64 * 1024
const MAX_ANCHOR_BASE64_CHARACTERS = Math.ceil(MAX_ANCHOR_BYTES / 3) * 4
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
const ED25519_SPKI_BYTES = 44
const ED25519_SIGNATURE_BYTES = 64
const ED25519_ORDER_LITTLE_ENDIAN = Buffer.from(
  'edd3f55c1a631258d69cf7a2def9de1400000000000000000000000000000010',
  'hex',
)

const INPUT_FIELDS = [
  'anchorBytesBase64',
  'candidatePublicKeySpkiBase64',
  'signatureEnvelope',
] as const
const ENVELOPE_FIELDS = [
  'schemaVersion',
  'algorithm',
  'anchorSha256',
  'publicKeySpkiSha256',
  'signatureBase64',
] as const

export class GithubCoreContinuityReviewSignatureProposalError extends Error {
  readonly code = GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ERROR_CODE)
    this.name = 'GithubCoreContinuityReviewSignatureProposalError'
  }
}

function invalid(): never {
  throw new GithubCoreContinuityReviewSignatureProposalError()
}

export interface GithubCoreContinuityReviewSignatureEnvelopeProposal {
  readonly schemaVersion: typeof GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_SCHEMA_VERSION
  readonly algorithm: typeof GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ALGORITHM
  /** Local-C2 digest of the exact stable anchor bytes. */
  readonly anchorSha256: string
  /** Local-C2 digest of the exact canonical 44-byte Ed25519 SPKI DER. */
  readonly publicKeySpkiSha256: string
  /** Process-only in this proposal; local C2 if a later contract persists it. */
  readonly signatureBase64: string
}

export interface GithubCoreContinuityReviewSignatureProposalInput {
  /** Exact anchor bytes, base64 encoded and bounded to the anchor loader's 64 KiB limit. */
  readonly anchorBytesBase64: string
  /** Caller-supplied candidate key, never a trusted or owner-authenticated key in this seam. */
  readonly candidatePublicKeySpkiBase64: string
  readonly signatureEnvelope: unknown
}

export interface GithubCoreContinuityReviewSignatureProposalResult {
  readonly kind: 'github_core_continuity_review_signature_proposal'
  readonly status: 'signature_matches'
}

const SIGNATURE_MATCHES = Object.freeze({
  kind: 'github_core_continuity_review_signature_proposal',
  status: 'signature_matches',
} as const satisfies GithubCoreContinuityReviewSignatureProposalResult)

function ownDataRecord(
  value: unknown,
  fields: readonly string[],
): Readonly<Record<string, unknown>> {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) invalid()
    const keys = Reflect.ownKeys(value)
    if (
      keys.length !== fields.length
      || keys.some((key) => typeof key !== 'string' || !fields.includes(key))
    ) invalid()
    const snapshot = Object.create(null) as Record<string, unknown>
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(value, field)
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalid()
      snapshot[field] = descriptor.value
    }
    return Object.freeze(snapshot)
  } catch (error) {
    if (error instanceof GithubCoreContinuityReviewSignatureProposalError) throw error
    return invalid()
  }
}

function lowercaseSha256(value: unknown): string {
  if (typeof value !== 'string' || !SHA256.test(value)) invalid()
  return value
}

function canonicalBase64(
  value: unknown,
  maximumCharacters: number,
  expectedBytes?: number,
): Buffer {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maximumCharacters
    || !CANONICAL_BASE64.test(value)
  ) invalid()
  const decoded = Buffer.from(value, 'base64')
  if (
    decoded.length === 0
    || (expectedBytes !== undefined && decoded.length !== expectedBytes)
    || decoded.toString('base64') !== value
  ) {
    decoded.fill(0)
    invalid()
  }
  return decoded
}

function lessThanLittleEndian(left: Buffer, right: Buffer): boolean {
  if (left.length !== right.length) invalid()
  for (let index = left.length - 1; index >= 0; index -= 1) {
    if (left[index] < right[index]) return true
    if (left[index] > right[index]) return false
  }
  return false
}

function assertCanonicalEd25519Signature(signature: Buffer): void {
  if (
    signature.length !== ED25519_SIGNATURE_BYTES
    || !lessThanLittleEndian(signature.subarray(32), ED25519_ORDER_LITTLE_ENDIAN)
  ) invalid()
}

function assertCanonicalEd25519Spki(spki: Buffer): void {
  if (
    spki.length !== ED25519_SPKI_BYTES
    || !spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) invalid()
}

/**
 * Build the exact versioned signing bytes: ASCII domain, NUL, binary anchor
 * digest, then binary canonical-SPKI digest. Both digests remain local C2.
 */
export function createGithubCoreContinuityReviewSignatureMaterial(
  anchorSha256: unknown,
  publicKeySpkiSha256: unknown,
): Buffer {
  const anchorDigest = Buffer.from(lowercaseSha256(anchorSha256), 'hex')
  const keyDigest = Buffer.from(lowercaseSha256(publicKeySpkiSha256), 'hex')
  try {
    return Buffer.concat([
      Buffer.from(GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_DOMAIN, 'ascii'),
      Buffer.from([0]),
      anchorDigest,
      keyDigest,
    ])
  } finally {
    anchorDigest.fill(0)
    keyDigest.fill(0)
  }
}

function parseEnvelope(input: unknown): GithubCoreContinuityReviewSignatureEnvelopeProposal {
  const envelope = ownDataRecord(input, ENVELOPE_FIELDS)
  if (envelope.schemaVersion !== GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_SCHEMA_VERSION) invalid()
  if (envelope.algorithm !== GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ALGORITHM) invalid()
  if (typeof envelope.signatureBase64 !== 'string') invalid()
  return Object.freeze({
    schemaVersion: GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_SCHEMA_VERSION,
    algorithm: GITHUB_CORE_CONTINUITY_REVIEW_SIGNATURE_ALGORITHM,
    anchorSha256: lowercaseSha256(envelope.anchorSha256),
    publicKeySpkiSha256: lowercaseSha256(envelope.publicKeySpkiSha256),
    signatureBase64: envelope.signatureBase64,
  })
}

/**
 * Verify only cryptographic consistency against a caller-supplied candidate
 * public key. No result from this function is owner authentication or approval.
 */
export function verifyGithubCoreContinuityReviewSignatureProposal(
  input: unknown,
): GithubCoreContinuityReviewSignatureProposalResult {
  let anchorBytes: Buffer | undefined
  let spki: Buffer | undefined
  let signature: Buffer | undefined
  let material: Buffer | undefined
  try {
    const request = ownDataRecord(input, INPUT_FIELDS)
    const envelope = parseEnvelope(request.signatureEnvelope)
    anchorBytes = canonicalBase64(
      request.anchorBytesBase64,
      MAX_ANCHOR_BASE64_CHARACTERS,
    )
    if (anchorBytes.length > MAX_ANCHOR_BYTES) invalid()
    spki = canonicalBase64(request.candidatePublicKeySpkiBase64, 60, ED25519_SPKI_BYTES)
    signature = canonicalBase64(envelope.signatureBase64, 88, ED25519_SIGNATURE_BYTES)
    assertCanonicalEd25519Spki(spki)
    assertCanonicalEd25519Signature(signature)

    const observedAnchorSha256 = createHash('sha256').update(anchorBytes).digest('hex')
    const observedPublicKeySpkiSha256 = createHash('sha256').update(spki).digest('hex')
    if (
      observedAnchorSha256 !== envelope.anchorSha256
      || observedPublicKeySpkiSha256 !== envelope.publicKeySpkiSha256
    ) invalid()

    material = createGithubCoreContinuityReviewSignatureMaterial(
      observedAnchorSha256,
      observedPublicKeySpkiSha256,
    )
    const publicKey = createPublicKey({ key: spki, format: 'der', type: 'spki' })
    if (publicKey.type !== 'public' || publicKey.asymmetricKeyType !== 'ed25519') invalid()
    const exported = publicKey.export({ format: 'der', type: 'spki' })
    if (!Buffer.isBuffer(exported) || !exported.equals(spki)) invalid()
    if (!verify(null, material, publicKey, signature)) invalid()
    return SIGNATURE_MATCHES
  } catch (error) {
    if (error instanceof GithubCoreContinuityReviewSignatureProposalError) throw error
    return invalid()
  } finally {
    anchorBytes?.fill(0)
    spki?.fill(0)
    signature?.fill(0)
    material?.fill(0)
  }
}
