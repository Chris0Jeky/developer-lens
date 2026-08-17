import { createHash } from 'node:crypto'
import { claimIdMaterial, type ClaimIdentity } from '../../shared/claims.js'

/** `cl_` + SHA-256 over the canonical material. */
export function computeClaimId(identity: ClaimIdentity): string {
  const digest = createHash('sha256').update(claimIdMaterial(identity), 'utf8').digest('hex')
  return `cl_${digest}`
}
