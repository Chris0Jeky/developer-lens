export const GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE =
  'GITHUB_CORE_ACTIVATION_GRANT_DENIED' as const

/**
 * An opaque, process-local github.core execution grant. Its fields bind execution inputs, while
 * membership in the private registry below makes a lookalike object insufficient at runtime.
 */
export interface GithubCoreActivationGrant {
  readonly capabilityId: 'github.core'
  readonly taskId: string
  readonly taskCardSha256: string
  readonly installationKeyFingerprint: string
  readonly scopeAlias: string
}

export class GithubCoreActivationGrantError extends Error {
  readonly code = GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE)
    this.name = 'GithubCoreActivationGrantError'
  }
}

/**
 * Private registry of issued grants. #151: this module ships NO issuer, so nothing ever adds to
 * this set and every input is refused — the capability is assert-only / default-deny. A separately
 * reviewed production issuer would register grants here; until one exists, no grant validates.
 * Test success paths supply a test-owned validator via vitest module mocking (see the consumer
 * test files), never a production issuer callable by arbitrary local code. That this module exports
 * no issuer is enforced by the TypeScript-AST import boundary and export regression in
 * `activationGrant.test.ts`.
 */
const issuedGrants = new WeakSet<object>()

function deny(): never {
  throw new GithubCoreActivationGrantError()
}

/** Validate private issuance without echoing or serializing any binding value. Default-deny (#151). */
export function assertGithubCoreActivationGrant(input: unknown): GithubCoreActivationGrant {
  if (!input || typeof input !== 'object' || !issuedGrants.has(input)) deny()
  return input as GithubCoreActivationGrant
}
