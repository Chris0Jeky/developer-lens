import { z } from 'zod'
import { CapabilityScopeAliasSchema, LowercaseSha256Schema } from '../../../shared/capabilities.js'
import { isCanonicalTaskId } from '../../taskId.js'

export const GITHUB_CORE_ACTIVATION_GRANT_ERROR_CODE =
  'GITHUB_CORE_ACTIVATION_GRANT_DENIED' as const

const inventedGrantInputSchema = z
  .object({
    fixture: z.literal('invented'),
    capabilityId: z.literal('github.core'),
    taskId: z.string().refine(isCanonicalTaskId),
    taskCardSha256: LowercaseSha256Schema,
    installationKeyFingerprint: LowercaseSha256Schema,
    scopeAlias: CapabilityScopeAliasSchema,
  })
  .strict()

/**
 * An opaque, process-local github.core execution grant. Its fields bind execution inputs, while
 * membership in the private WeakSet below makes a lookalike object insufficient at runtime.
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

const issuedGrants = new WeakSet<object>()

function deny(): never {
  throw new GithubCoreActivationGrantError()
}

function ownDataSnapshot(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) deny()
  if (Object.getPrototypeOf(value) !== Object.prototype) deny()
  const snapshot: Record<string, unknown> = {}
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') deny()
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) deny()
    snapshot[key] = descriptor.value
  }
  return snapshot
}

function issueInventedGrant(input: unknown): GithubCoreActivationGrant {
  const parsed = inventedGrantInputSchema.safeParse(ownDataSnapshot(input))
  if (!parsed.success) deny()
  const grant = {} as GithubCoreActivationGrant
  Object.defineProperties(grant, {
    capabilityId: { value: 'github.core' },
    taskId: { value: parsed.data.taskId },
    taskCardSha256: { value: parsed.data.taskCardSha256 },
    installationKeyFingerprint: { value: parsed.data.installationKeyFingerprint },
    scopeAlias: { value: parsed.data.scopeAlias },
  })
  Object.freeze(grant)
  issuedGrants.add(grant)
  return grant
}

/** Validate private issuance without echoing or serializing any binding value. */
export function assertGithubCoreActivationGrant(input: unknown): GithubCoreActivationGrant {
  if (!input || typeof input !== 'object' || !issuedGrants.has(input)) deny()
  return input as GithubCoreActivationGrant
}

/** @internal Invented-fixture issuer only; production import is forbidden by an AST boundary. */
export const githubCoreActivationGrantTestSeam = Object.freeze({ issueInventedGrant })
