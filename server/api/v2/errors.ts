/**
 * Stable, redacted error codes for the V2 bridge surface (ADR-04 local-API contract).
 * A V2 response never carries a raw message, path, or driver string.
 */
export const V2_ERROR_CODES = [
  'V2_UNAUTHORIZED',
  'V2_HOST_NOT_ALLOWED',
  'V2_ORIGIN_NOT_ALLOWED',
  'V2_STORE_UNAVAILABLE',
  'V2_STORE_PROVENANCE_REFUSED',
  'V2_ACTIVATION_CARD_NOT_REVIEWED',
  'V2_RESPONSE_CONTRACT_VIOLATION',
  'V2_NOT_FOUND',
  'V2_UNAVAILABLE',
] as const

export type V2ErrorCode = typeof V2_ERROR_CODES[number]

const V2_ERROR_STATUS: Readonly<Record<V2ErrorCode, number>> = {
  V2_UNAUTHORIZED: 401,
  V2_HOST_NOT_ALLOWED: 403,
  V2_ORIGIN_NOT_ALLOWED: 403,
  V2_STORE_UNAVAILABLE: 503,
  V2_STORE_PROVENANCE_REFUSED: 409,
  V2_ACTIVATION_CARD_NOT_REVIEWED: 409,
  V2_RESPONSE_CONTRACT_VIOLATION: 500,
  V2_NOT_FOUND: 404,
  V2_UNAVAILABLE: 503,
}

export class V2Error extends Error {
  public readonly code: V2ErrorCode
  public readonly status: number

  constructor(code: V2ErrorCode) {
    super(code)
    this.name = 'V2Error'
    this.code = code
    this.status = V2_ERROR_STATUS[code]
  }
}

export function v2ErrorBody(code: V2ErrorCode): { error: { code: V2ErrorCode } } {
  return { error: { code } }
}
