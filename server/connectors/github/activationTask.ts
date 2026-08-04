import { z } from 'zod'

export const GITHUB_CORE_ACTIVATION_TASK_CARD_SCHEMA_VERSION =
  'github-core-activation-task-card.v1' as const
export const GITHUB_CORE_ACTIVATION_TASK_CARD_ERROR_CODE =
  'INVALID_GITHUB_CORE_ACTIVATION_TASK_CARD' as const

const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const OPAQUE_ID = /^[A-Za-z0-9_-]{1,128}$/
const GITHUB_OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const GITHUB_REPOSITORY = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/
const GITHUB_BRANCH = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,127})$/
const SAFE_DECLARATION = /^[A-Za-z0-9][A-Za-z0-9 .,'()/_:-]{0,255}$/

const ALLOWED_RESOURCES = [
  'current repository lifecycle metadata',
  'open issue and pull-request lifecycle units updated inside the bounded range',
  'pagination and rate-limit headers',
] as const

const PROHIBITED_SURFACES = [
  'repository owner or name',
  'raw provider repository or node ids',
  'URLs',
  'titles, bodies, labels, milestones, comments, review text, or commit subjects',
  'people, users, assignees, reviewers, or contributor dimensions',
  'source, paths, diffs, patches, logs, artifacts, caches, Actions, Projects, ownership, or security data',
  'raw upstream objects or response bytes',
] as const

const ALLOWED_EPHEMERAL_PROVIDER_FIELDS = [
  'repository id',
  'repository public/private, archived, disabled, and fork flags',
  'issue or pull-request node id',
  'issue or pull-request kind',
  'updated_at',
  'pagination relation',
  'rate-limit remaining and reset',
] as const

const RETAINED_FIELDS = [
  'installation-scoped repository alias',
  'installation-scoped unit aliases',
  'job and receipt aliases',
  'snapshot hash',
  'observed unit and page counts',
  'coverage status and stable limitation code',
  'bounded checkpoint timestamps',
] as const

const canonicalTimestamp = z.string().regex(CANONICAL_UTC_TIMESTAMP).superRefine((value, context) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    context.addIssue({ code: 'custom', message: 'timestamp is not canonical' })
  }
})

const opaqueId = z.string().regex(OPAQUE_ID).refine((value) => value !== '.' && value !== '..')
const declaration = z.string().regex(SAFE_DECLARATION)

function strictObject<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
  return z.object(shape).strict()
}

const selectedRepositorySchema = strictObject({
  owner: z.string().regex(GITHUB_OWNER),
  name: z.string().regex(GITHUB_REPOSITORY),
  providerRepositoryId: opaqueId,
  expectedVisibility: z.literal('public'),
  defaultBranch: z.string().regex(GITHUB_BRANCH),
})

const readBoundarySchema = strictObject({
  provider: z.literal('github.com'),
  apiBase: z.literal('https://api.github.com'),
  apiVersion: z.literal('2026-03-10'),
  credentialMode: z.literal('public_unauthenticated'),
  credentialMutation: z.literal('forbidden'),
  allowedResources: z.array(z.enum(ALLOWED_RESOURCES)).length(ALLOWED_RESOURCES.length),
  rangeStart: canonicalTimestamp,
  rangeEndPolicy: z.literal('freeze_at_job_start'),
  pageSize: z.number().int().min(1).max(100),
  maximumRequests: z.number().int().min(1).max(20),
  localCheckout: z.literal('forbidden'),
  localDatabase: z.literal('forbidden'),
  workingTree: z.literal('forbidden'),
})

const strictProjectionSchema = strictObject({
  allowedEphemeralProviderFields: z.array(z.enum(ALLOWED_EPHEMERAL_PROVIDER_FIELDS)).length(ALLOWED_EPHEMERAL_PROVIDER_FIELDS.length),
  retainedFields: z.array(z.enum(RETAINED_FIELDS)).length(RETAINED_FIELDS.length),
  prohibitedSinks: z.array(z.enum(PROHIBITED_SURFACES)).length(PROHIBITED_SURFACES.length),
  providerResponseRule: z.literal('allowlisted_fields_only_and_raw_responses_never_persisted'),
})

const localBoundarySchema = strictObject({
  root: z.string().min(1).max(256),
  taskCard: z.string().min(1).max(512),
  database: z.string().min(1).max(512),
  installationKey: z.string().min(1).max(512),
  backupDirectory: z.string().min(1).max(512),
  report: z.string().min(1).max(512),
  trackedOrPublished: z.literal(false),
})

const retentionSchema = strictObject({
  c1Aggregates: z.literal('36 rolling months'),
  c2AliasesAndExactTimestamps: z.literal('13 months'),
  c4SourceBytes: z.literal('process lifetime only'),
  rawResponses: z.literal('never persisted'),
  packsOrExports: z.literal('none authorized'),
})

const coverageSchema = strictObject({
  terminalPaginationRequiredForComplete: z.literal(true),
  missingRestrictedFailedStaleOrTruncatedNeverMeansZero: z.literal(true),
  rateOrRequestBudgetExhaustion: z.literal('truncated'),
  permissionOrVisibilityMismatch: z.literal('restricted'),
  schemaMismatch: z.literal('failed'),
})

const rollbackSchema = strictObject({
  legacyCollectorAndJson: z.literal('untouched'),
  runtimeDefault: z.literal('off'),
  failedJob: z.literal('retain auditable failed coverage and leave the prior checkpoint unchanged'),
  repeatRun: z.literal('create an application-controlled SQLite backup before replacing retained state'),
  restore: z.literal('close the database, restore the task-owned backup, and re-open with integrity checks'),
  migrationGracePeriod: z.literal('not applicable because this task does not migrate or switch the legacy reader'),
})

const deletionSchema = strictObject({
  scope: z.literal('the selected repository alias only'),
  cascade: z.array(z.enum([
    'collection jobs',
    'checkpoints',
    'source snapshots',
    'coverage',
    'dependent facts, features, aliases, caches, packs, and backups if later introduced',
  ])).length(5),
  tombstone: z.literal('retain only capability id, opaque scope alias, revocation time, and content-free reason code'),
  idempotent: z.literal(true),
  externalCopies: z.literal('none created by this task'),
})

const taskCardSchema = strictObject({
  schemaVersion: z.literal(GITHUB_CORE_ACTIVATION_TASK_CARD_SCHEMA_VERSION),
  taskId: opaqueId,
  authorizedAt: canonicalTimestamp,
  authorizationBasis: declaration,
  selectedRepository: selectedRepositorySchema,
  purpose: declaration,
  readBoundary: readBoundarySchema,
  strictProjection: strictProjectionSchema,
  localBoundary: localBoundarySchema,
  retention: retentionSchema,
  coverage: coverageSchema,
  rollback: rollbackSchema,
  deletion: deletionSchema,
  provingChecks: z.array(declaration).min(1).max(32),
  stopConditions: z.array(declaration).min(1).max(16),
})

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length
}

function isContainedPath(value: string, root: string): boolean {
  if (!value.startsWith(root) || value === root) return false
  if (value.includes('\\') || value.includes('//') || value.includes(':')) return false
  if (value.startsWith('/') || value.startsWith('./') || value.includes('%')) return false
  let relative = value.slice(root.length)
  if (relative.endsWith('/')) relative = relative.slice(0, -1)
  if (!relative || relative.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return false
  }
  return true
}

const validatedTaskCardSchema = taskCardSchema.superRefine((card, context) => {
  if (hasDuplicates(card.readBoundary.allowedResources)) {
    context.addIssue({ code: 'custom', path: ['readBoundary', 'allowedResources'], message: 'resources must be unique' })
  }
  if (!ALLOWED_RESOURCES.every((resource) => card.readBoundary.allowedResources.includes(resource))) {
    context.addIssue({ code: 'custom', path: ['readBoundary', 'allowedResources'], message: 'resources are incomplete' })
  }
  if (hasDuplicates(card.strictProjection.allowedEphemeralProviderFields)) {
    context.addIssue({ code: 'custom', path: ['strictProjection', 'allowedEphemeralProviderFields'], message: 'fields must be unique' })
  }
  if (hasDuplicates(card.strictProjection.retainedFields)) {
    context.addIssue({ code: 'custom', path: ['strictProjection', 'retainedFields'], message: 'fields must be unique' })
  }
  if (hasDuplicates(card.strictProjection.prohibitedSinks) ||
    !PROHIBITED_SURFACES.every((surface) => card.strictProjection.prohibitedSinks.includes(surface))) {
    context.addIssue({ code: 'custom', path: ['strictProjection', 'prohibitedSinks'], message: 'all sinks must be prohibited' })
  }
  if (hasDuplicates(card.deletion.cascade)) {
    context.addIssue({ code: 'custom', path: ['deletion', 'cascade'], message: 'deletion targets must be unique' })
  }

  const expectedRoot = `.developer-lens/activation/${card.taskId}/`
  if (card.localBoundary.root !== expectedRoot) {
    context.addIssue({ code: 'custom', path: ['localBoundary', 'root'], message: 'root does not match task id' })
    return
  }
  for (const field of ['taskCard', 'database', 'installationKey', 'backupDirectory', 'report'] as const) {
    const child = card.localBoundary[field]
    if (child.startsWith('.') || child.startsWith('/') || !isContainedPath(`${expectedRoot}${child}`, expectedRoot)) {
      context.addIssue({ code: 'custom', path: ['localBoundary', field], message: 'path escapes local root' })
    }
  }
})

export const GithubCoreActivationTaskCardSchema = validatedTaskCardSchema
export type GithubCoreActivationTaskCardSchema = typeof validatedTaskCardSchema
type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T
export type GithubCoreActivationTaskCard = DeepReadonly<z.infer<typeof taskCardSchema>>

export class GithubCoreActivationTaskCardError extends Error {
  readonly code = GITHUB_CORE_ACTIVATION_TASK_CARD_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_ACTIVATION_TASK_CARD_ERROR_CODE)
    this.name = 'GithubCoreActivationTaskCardError'
  }
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child)
  }
  return value
}

/** Parse a closed activation card without echoing card values or paths in failures. */
export function parseGithubCoreActivationTaskCard(input: unknown): GithubCoreActivationTaskCard {
  const parsed = validatedTaskCardSchema.safeParse(input)
  if (!parsed.success) throw new GithubCoreActivationTaskCardError()
  return freezeDeep(parsed.data) as GithubCoreActivationTaskCard
}
