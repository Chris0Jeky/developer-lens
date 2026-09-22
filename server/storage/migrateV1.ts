import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, rename, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { z } from 'zod'
import { openStorageDatabase, runStorageChecks, StorageDatabaseError } from './database.js'
import { createInstallationAliases, InstallationKeyError, type InstallationAliases } from './installationAliases.js'
import { IMPORT_KEY_BINDING_SQL, IMPORT_KEY_BINDING_VERSION, STORAGE_SCHEMA_VERSION } from './schema.js'
import {
  assertTaskInstallationKeyHandleCurrent,
  type TaskInstallationKeyHandle,
} from './taskInstallationKey.js'

export { InstallationKeyError } from './installationAliases.js'

const dateTime = z.string().datetime({ offset: true })
const opaqueIdentifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9:._-]+$/)
/**
 * #5: the local collector emits fallback basenames and remote-derived names that may carry spaces
 * or Unicode. Those raw names are accepted here only as in-memory reference keys: they are resolved
 * to installation-HMAC identities before the ASCII storage boundary and never persisted. Control
 * characters and lone surrogates are refused because they cannot be a stable canonical identity.
 */
const LOCAL_NAME_MAX_LENGTH = 1024
const UNSTABLE_NAME_CHARACTER = /[\p{Cc}\p{Cs}]/u
const localRepositoryName = z
  .string()
  .min(1)
  .max(LOCAL_NAME_MAX_LENGTH)
  .refine((value) => !UNSTABLE_NAME_CHARACTER.test(value))
const repositoryReference = localRepositoryName
const LOCAL_REPOSITORY_PREFIX = 'local:'
const localRepositoryIdentifier = z
  .string()
  .max(LOCAL_REPOSITORY_PREFIX.length + LOCAL_NAME_MAX_LENGTH)
  .refine((value) => value.startsWith(LOCAL_REPOSITORY_PREFIX)
    && localRepositoryName.safeParse(value.slice(LOCAL_REPOSITORY_PREFIX.length)).success)
// A `local:` id is judged only by the local rules: `local:` alone must not pass as an opaque id.
const repositoryProviderIdentifier = z.string().refine((value) => (
  value.startsWith(LOCAL_REPOSITORY_PREFIX)
    ? localRepositoryIdentifier.safeParse(value).success
    : opaqueIdentifier.safeParse(value).success
))
const featureType = z.enum([
  'feat',
  'fix',
  'docs',
  'test',
  'refactor',
  'chore',
  'perf',
  'build',
  'ci',
  'revert',
  'other',
])
const coverageStatus = z.enum(['complete', 'partial', 'unavailable'])

const v1DatasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    range: z.enum(['6m', '12m']),
    from: dateTime,
    to: dateTime,
    collectedAt: dateTime,
    subject: z.object({ login: z.string(), name: z.string().optional(), avatarUrl: z.string().optional() }).strict(),
    contributionCalendar: z.array(z.object({ date: z.string(), count: z.number().int().nonnegative() }).strict()),
    contributionTotal: z.number().int().nonnegative(),
    restrictedContributions: z.number().int().nonnegative(),
    repositories: z.array(
      z.object({
        id: repositoryProviderIdentifier,
        nameWithOwner: repositoryReference,
        name: repositoryReference,
        url: z.string().optional(),
        description: z.string().optional(),
        isPrivate: z.boolean(),
        isArchived: z.boolean(),
        isFork: z.boolean(),
        pushedAt: dateTime.optional(),
        primaryLanguage: z.object({ name: z.string(), color: z.string().optional() }).strict().optional(),
        languages: z.array(z.object({ name: z.string(), color: z.string().optional(), size: z.number().int().nonnegative() }).strict()),
        topics: z.array(z.string()),
      }).strict(),
    ),
    commits: z.array(
      z.object({
        sha: opaqueIdentifier,
        repository: repositoryReference,
        occurredAt: dateTime,
        source: z.enum(['github', 'local-git']),
        additions: z.number().int().nonnegative().optional(),
        deletions: z.number().int().nonnegative().optional(),
        files: z.number().int().nonnegative().optional(),
        parentCount: z.number().int().nonnegative().optional(),
        features: z.object({ type: featureType, isRevert: z.boolean(), isFixup: z.boolean(), subjectLength: z.number().int().nonnegative() }).strict(),
      }).strict(),
    ),
    lineChanges: z.object({ additions: z.number().int().nonnegative(), deletions: z.number().int().nonnegative(), commits: z.number().int().nonnegative(), repositories: z.number().int().nonnegative() }).strict().optional(),
    commitDaysByRepository: z.array(z.object({ repository: repositoryReference, date: z.string(), count: z.number().int().nonnegative() }).strict()),
    pullRequests: z.array(
      z.object({
        id: opaqueIdentifier,
        repository: repositoryReference,
        number: z.number().int().positive(),
        title: z.string(),
        url: z.string().optional(),
        createdAt: dateTime,
        mergedAt: dateTime.optional(),
        closedAt: dateTime.optional(),
        state: z.enum(['OPEN', 'CLOSED', 'MERGED']),
        isDraft: z.boolean(),
        additions: z.number().int().nonnegative().optional(),
        deletions: z.number().int().nonnegative().optional(),
        changedFiles: z.number().int().nonnegative().optional(),
        comments: z.number().int().nonnegative(),
        reviews: z.number().int().nonnegative(),
      }).strict(),
    ),
    reviews: z.array(z.object({ id: opaqueIdentifier, repository: repositoryReference, occurredAt: dateTime }).strict()),
    issues: z.array(z.object({ id: opaqueIdentifier, repository: repositoryReference, occurredAt: dateTime }).strict()),
    coverage: z.array(z.object({ id: opaqueIdentifier, label: z.string(), status: coverageStatus, detail: z.string(), itemCount: z.number().int().nonnegative().optional() }).strict()),
    warnings: z.array(z.string()),
  })
  .strict()

type V1Dataset = z.infer<typeof v1DatasetSchema>

export class V1ValidationError extends Error {
  constructor() {
    super('V1_VALIDATION_FAILED')
    this.name = 'V1ValidationError'
  }
}

export type ImportKeyBindingErrorCode = 'STORAGE_KEY_MISMATCH' | 'STORAGE_KEY_UNBOUND'

/**
 * #6: a target pinned to one installation key refuses every other key instead of silently rekeying
 * all repository aliases, and a populated target without a pin is never adopted. Content-free: the
 * error never carries a fingerprint, a path, or key bytes.
 */
export class ImportKeyBindingError extends Error {
  public readonly code: ImportKeyBindingErrorCode

  constructor(code: ImportKeyBindingErrorCode) {
    super(code)
    this.name = 'ImportKeyBindingError'
    this.code = code
  }
}

export type MigrationFailurePoint = 'after-key-binding' | 'after-repository-upsert'

export interface ImportV1Options {
  sourcePath: string
  targetPath: string
  /** Raw installation key material for invented fixtures; mutually exclusive with the handle. */
  installationKey?: Buffer
  /** Opaque task-owned key handle; its key bytes never leave `taskInstallationKey.ts`. */
  installationKeyHandle?: TaskInstallationKeyHandle
  failAt?: MigrationFailurePoint
}

export interface ImportProof {
  checksum: string
  integrity: 'ok'
  foreignKeyViolations: 0
}

export type StorageFailureCode =
  | 'storage-disabled'
  | 'storage-key-missing'
  | 'storage-key-invalid'
  | 'storage-key-mismatch'
  | 'storage-key-unbound'
  | 'source-read-failed'
  | 'v1-validation-failed'
  | 'storage-target-mismatch'
  | 'storage-import-failed'

export type StorageSelection =
  | { reader: 'legacy-json'; code: StorageFailureCode }
  | { reader: 'sqlite-v2'; checksum: string }

export function parseV1Dataset(source: string): V1Dataset {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new V1ValidationError()
  }
  const parsed = v1DatasetSchema.safeParse(value)
  if (!parsed.success) throw new V1ValidationError()
  validateReferences(parsed.data)
  return parsed.data
}

/**
 * One canonical form per identity: the same collector name emitted in NFC and in NFD (a macOS
 * basename, say) is one repository, never two. NFC leaves every ASCII identifier unchanged, so
 * existing opaque and ASCII local aliases are stable.
 */
function canonicalIdentity(value: string): string {
  return value.normalize('NFC')
}

function validateReferences(dataset: V1Dataset): void {
  // #6: duplicate provider IDs or duplicate repository references would collapse distinct
  // repositories through the reference map and the provider upsert, so refuse them before any
  // target is opened.
  const repositoryIds = new Set<string>()
  const repositoryNames = new Set<string>()
  for (const repository of dataset.repositories) {
    const id = canonicalIdentity(repository.id)
    const name = canonicalIdentity(repository.nameWithOwner)
    if (repositoryIds.has(id) || repositoryNames.has(name)) throw new V1ValidationError()
    repositoryIds.add(id)
    repositoryNames.add(name)
  }
  const references = [
    ...dataset.commits.map((commit) => commit.repository),
    ...dataset.commitDaysByRepository.map((event) => event.repository),
    ...dataset.pullRequests.map((pullRequest) => pullRequest.repository),
    ...dataset.reviews.map((event) => event.repository),
    ...dataset.issues.map((event) => event.repository),
  ]
  if (references.some((repository) => !repositoryNames.has(canonicalIdentity(repository)))) {
    throw new V1ValidationError()
  }
  const coverageIds = dataset.coverage.map((coverage) => coverage.id)
  if (new Set(coverageIds).size !== coverageIds.length) throw new V1ValidationError()
  for (const coverage of dataset.coverage) mapCoverage(coverage)
}

interface MappedCoverage {
  capabilityId: 'github.core' | 'cap.local.git'
  status: 'unavailable' | 'censored'
  limitationCode: 'V1_UNAVAILABLE' | 'V1_PARTIAL_COVERAGE' | 'V1_COMPLETENESS_UNVERIFIED'
  observedUnits: number
}

function mapCoverage(coverage: V1Dataset['coverage'][number]): MappedCoverage {
  const capabilityId = coverage.id.startsWith('github-')
    ? 'github.core'
    : coverage.id === 'local-git'
      ? 'cap.local.git'
      : undefined
  if (!capabilityId) throw new V1ValidationError()
  if (coverage.status === 'unavailable') {
    return {
      capabilityId,
      status: 'unavailable',
      limitationCode: 'V1_UNAVAILABLE',
      observedUnits: coverage.itemCount ?? 0,
    }
  }
  if (coverage.status === 'partial') {
    return {
      capabilityId,
      status: 'censored',
      limitationCode: 'V1_PARTIAL_COVERAGE',
      observedUnits: coverage.itemCount ?? 0,
    }
  }
  return {
    capabilityId,
    status: 'censored',
    limitationCode: 'V1_COMPLETENESS_UNVERIFIED',
    observedUnits: coverage.itemCount ?? 0,
  }
}

function aggregateCoverage(coverageRecords: V1Dataset['coverage']): MappedCoverage[] {
  // Legacy item counts use different units, so summing them would invent a total.
  // Keep the least-favorable component and the lowest count when statuses tie.
  const priority: Record<MappedCoverage['limitationCode'], number> = {
    V1_COMPLETENESS_UNVERIFIED: 0,
    V1_PARTIAL_COVERAGE: 1,
    V1_UNAVAILABLE: 2,
  }
  const byCapability = new Map<MappedCoverage['capabilityId'], MappedCoverage>()
  for (const coverage of coverageRecords) {
    const mapped = mapCoverage(coverage)
    const current = byCapability.get(mapped.capabilityId)
    if (
      !current ||
      priority[mapped.limitationCode] > priority[current.limitationCode] ||
      (priority[mapped.limitationCode] === priority[current.limitationCode] &&
        mapped.observedUnits < current.observedUnits)
    ) {
      byCapability.set(mapped.capabilityId, mapped)
    }
  }
  return [...byCapability.values()]
}

interface CanonicalRepository {
  readonly providerId: string
  readonly analyticalKey: string
  readonly isPrivate: number
  readonly isArchived: number
  readonly isFork: number
}

interface CanonicalCommit {
  readonly repositoryProviderId: string
  readonly sha: string
  readonly occurredAt: string
  readonly source: 'github' | 'local-git'
  readonly additions: number | null
  readonly deletions: number | null
  readonly files: number | null
  readonly parentCount: number | null
  readonly featureType: string
  readonly isRevert: number
  readonly isFixup: number
  readonly messageLength: number
}

interface CanonicalPullRequest {
  readonly providerId: string
  readonly repositoryProviderId: string
  readonly number: number
  readonly createdAt: string
  readonly mergedAt: string | null
  readonly closedAt: string | null
  readonly state: 'OPEN' | 'CLOSED' | 'MERGED'
  readonly isDraft: number
  readonly additions: number | null
  readonly deletions: number | null
  readonly changedFiles: number | null
  readonly comments: number
  readonly reviews: number
}

interface CanonicalEvent {
  readonly providerId: string
  readonly repositoryProviderId: string
  readonly occurredAt: string
  readonly kind: 'review' | 'issue'
}

/** Everything the storage transaction may write; by construction it holds no repository name. */
interface CanonicalV1Import {
  readonly repositories: readonly CanonicalRepository[]
  readonly commits: readonly CanonicalCommit[]
  readonly pullRequests: readonly CanonicalPullRequest[]
  readonly events: readonly CanonicalEvent[]
  readonly coverage: readonly MappedCoverage[]
}

/**
 * The isolated local identity boundary (#5/#6). Raw repository provider IDs and repository names
 * enter here and leave only as installation-HMAC identities that satisfy the ASCII storage
 * alphabet. The result is an explicit field allowlist, so the storage transaction receives no
 * repository name, title, or URL field at all. Scope of the claim: pull-request and event provider
 * IDs and commit SHAs still pass through unaliased, as before, as opaque ASCII C2 identifiers
 * validated by the opaque alphabet. Distinct repositories that would share an alias fail closed.
 */
function bindCanonicalImport(dataset: V1Dataset, aliases: InstallationAliases): CanonicalV1Import {
  const providerIdByReference = new Map<string, string>()
  const providerIds = new Set<string>()
  const analyticalKeys = new Set<string>()
  const repositories = dataset.repositories.map((repository): CanonicalRepository => {
    const canonicalId = canonicalIdentity(repository.id)
    const providerId = aliases.repositoryProviderId(canonicalId)
    const analyticalKey = aliases.repositoryAnalyticalKey(canonicalId)
    if (providerIds.has(providerId) || analyticalKeys.has(analyticalKey)) throw new V1ValidationError()
    providerIds.add(providerId)
    analyticalKeys.add(analyticalKey)
    providerIdByReference.set(canonicalIdentity(repository.nameWithOwner), providerId)
    return {
      providerId,
      analyticalKey,
      isPrivate: Number(repository.isPrivate),
      isArchived: Number(repository.isArchived),
      isFork: Number(repository.isFork),
    }
  })
  const resolve = (reference: string): string => {
    const providerId = providerIdByReference.get(canonicalIdentity(reference))
    if (providerId === undefined) throw new V1ValidationError()
    return providerId
  }
  return {
    repositories,
    commits: dataset.commits.map((commit): CanonicalCommit => ({
      repositoryProviderId: resolve(commit.repository),
      sha: commit.sha,
      occurredAt: commit.occurredAt,
      source: commit.source,
      additions: commit.additions ?? null,
      deletions: commit.deletions ?? null,
      files: commit.files ?? null,
      parentCount: commit.parentCount ?? null,
      featureType: commit.features.type,
      isRevert: Number(commit.features.isRevert),
      isFixup: Number(commit.features.isFixup),
      messageLength: commit.features.subjectLength,
    })),
    pullRequests: dataset.pullRequests.map((pullRequest): CanonicalPullRequest => ({
      providerId: pullRequest.id,
      repositoryProviderId: resolve(pullRequest.repository),
      number: pullRequest.number,
      createdAt: pullRequest.createdAt,
      mergedAt: pullRequest.mergedAt ?? null,
      closedAt: pullRequest.closedAt ?? null,
      state: pullRequest.state,
      isDraft: Number(pullRequest.isDraft),
      additions: pullRequest.additions ?? null,
      deletions: pullRequest.deletions ?? null,
      changedFiles: pullRequest.changedFiles ?? null,
      comments: pullRequest.comments,
      reviews: pullRequest.reviews,
    })),
    events: [
      ...dataset.reviews.map((event): CanonicalEvent => ({
        providerId: event.id,
        repositoryProviderId: resolve(event.repository),
        occurredAt: event.occurredAt,
        kind: 'review',
      })),
      ...dataset.issues.map((event): CanonicalEvent => ({
        providerId: event.id,
        repositoryProviderId: resolve(event.repository),
        occurredAt: event.occurredAt,
        kind: 'issue',
      })),
    ],
    coverage: aggregateCoverage(dataset.coverage),
  }
}

interface ImportKeyMaterial {
  readonly aliases: InstallationAliases
  /** SHA-256 of the installation key: the same fingerprint the task key foundation reports. */
  readonly fingerprint: string
}

function resolveImportKeyMaterial(options: ImportV1Options): ImportKeyMaterial {
  const handle = options.installationKeyHandle
  if (handle !== undefined) {
    if (options.installationKey !== undefined) throw new InstallationKeyError('INSTALLATION_KEY_INVALID')
    try {
      // A genuine handle whose key file still exists and still holds the same bytes: a deleted
      // or replaced task key can never mint aliases for a later import.
      assertTaskInstallationKeyHandleCurrent(handle)
    } catch {
      throw new InstallationKeyError('INSTALLATION_KEY_INVALID')
    }
    return { aliases: handle.aliases, fingerprint: handle.fingerprint }
  }
  // Read the key once: the aliases and the recorded pin must derive from the same bytes.
  const installationKey = options.installationKey
  const aliases = createInstallationAliases(installationKey)
  const fingerprint = createHash('sha256').update(installationKey as Buffer).digest('hex')
  return { aliases, fingerprint }
}

function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function assertStorageChecks(db: ReturnType<typeof openStorageDatabase>): void {
  const checks = runStorageChecks(db)
  if (checks.integrity !== 'ok' || checks.quick !== 'ok' || checks.foreignKeys.length !== 0) {
    throw new Error('STORAGE_CHECK_FAILED')
  }
}

function quotedIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`
}

/**
 * Every user table in the target, read from the live schema rather than a hand list, so a store
 * that also carries collector, claim-graph, or bridge tables (all holding key-derived aliases) is
 * covered by the adoption rule without this module knowing their names.
 */
function targetTableNames(db: ReturnType<typeof openStorageDatabase>): string[] {
  return db
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name")
    .pluck()
    .all() as string[]
}

function fingerprintsMatch(stored: unknown, expected: string): boolean {
  if (typeof stored !== 'string' || !/^[0-9a-f]{64}$/.test(stored)) return false
  return timingSafeEqual(Buffer.from(stored, 'ascii'), Buffer.from(expected, 'ascii'))
}

/**
 * #6 key continuity. Runs inside the import transaction, before any analytical row is deleted:
 * a pinned target accepts only the key that minted its aliases; an unpinned target is adopted only
 * while every one of its tables is empty, and an unpinned target holding any row is refused because
 * its aliases cannot be attributed to any key. Rotation is never in place: a new key needs a new
 * target.
 */
function bindTargetToInstallationKey(db: ReturnType<typeof openStorageDatabase>, fingerprint: string): void {
  const hasBindingTable = db
    .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'import_key_binding'")
    .get() !== undefined
  if (hasBindingTable) {
    const rows = db
      .prepare('SELECT singleton, binding_version, installation_key_fingerprint FROM import_key_binding')
      .all() as Array<{ singleton: unknown; binding_version: unknown; installation_key_fingerprint: unknown }>
    const [row] = rows
    if (rows.length === 1 && row !== undefined) {
      if (row.singleton !== 1 || row.binding_version !== IMPORT_KEY_BINDING_VERSION) {
        throw new ImportKeyBindingError('STORAGE_KEY_UNBOUND')
      }
      if (!fingerprintsMatch(row.installation_key_fingerprint, fingerprint)) {
        throw new ImportKeyBindingError('STORAGE_KEY_MISMATCH')
      }
      return
    }
    if (rows.length !== 0) throw new ImportKeyBindingError('STORAGE_KEY_UNBOUND')
  }
  for (const table of targetTableNames(db)) {
    if (db.prepare(`SELECT 1 FROM ${quotedIdentifier(table)} LIMIT 1`).get() !== undefined) {
      throw new ImportKeyBindingError('STORAGE_KEY_UNBOUND')
    }
  }
  db.exec(IMPORT_KEY_BINDING_SQL)
  db.prepare(
    'INSERT INTO import_key_binding (singleton, binding_version, installation_key_fingerprint) VALUES (1, ?, ?)',
  ).run(IMPORT_KEY_BINDING_VERSION, fingerprint)
}

function canonicalState(db: ReturnType<typeof openStorageDatabase>): string {
  const tables = {
    import_run: 'source_checksum',
    repository_identity: 'provider_id',
    commit_observation: 'repository_provider_id, sha',
    pull_request_fact: 'provider_id',
    coverage_observation: 'capability_id',
    dated_event_observation: 'provider_id',
  } as const
  const state = Object.fromEntries(
    Object.entries(tables).map(([table, order]) => [
      table,
      db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all(),
    ]),
  )
  return digest(JSON.stringify(state))
}

function importIntoDatabase(
  db: ReturnType<typeof openStorageDatabase>,
  canonical: CanonicalV1Import,
  sourceChecksum: string,
  keyFingerprint: string,
  failAt?: MigrationFailurePoint,
): ImportProof {
  const transaction = db.transaction(() => {
    assertStorageChecks(db)
    bindTargetToInstallationKey(db, keyFingerprint)
    if (failAt === 'after-key-binding') throw new Error('INJECTED_FAILURE')

    const insertRun = db.prepare(
      'INSERT INTO import_run (source_checksum, schema_version) VALUES (?, ?) ON CONFLICT(source_checksum) DO UPDATE SET schema_version = excluded.schema_version',
    )
    const insertRepository = db.prepare(
      'INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, ?, ?, ?) ON CONFLICT(provider_id) DO UPDATE SET analytical_key = excluded.analytical_key, is_private = excluded.is_private, is_archived = excluded.is_archived, is_fork = excluded.is_fork',
    )
    const insertCommit = db.prepare(
      'INSERT INTO commit_observation (repository_provider_id, sha, occurred_at, source, additions, deletions, files, parent_count, feature_type, is_revert, is_fixup, message_length) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(repository_provider_id, sha) DO UPDATE SET occurred_at = excluded.occurred_at, source = excluded.source, additions = excluded.additions, deletions = excluded.deletions, files = excluded.files, parent_count = excluded.parent_count, feature_type = excluded.feature_type, is_revert = excluded.is_revert, is_fixup = excluded.is_fixup, message_length = excluded.message_length',
    )
    const insertPullRequest = db.prepare(
      'INSERT INTO pull_request_fact (provider_id, repository_provider_id, number, created_at, merged_at, closed_at, state, is_draft, additions, deletions, changed_files, comments, reviews) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider_id) DO UPDATE SET repository_provider_id = excluded.repository_provider_id, number = excluded.number, created_at = excluded.created_at, merged_at = excluded.merged_at, closed_at = excluded.closed_at, state = excluded.state, is_draft = excluded.is_draft, additions = excluded.additions, deletions = excluded.deletions, changed_files = excluded.changed_files, comments = excluded.comments, reviews = excluded.reviews',
    )
    const insertCoverage = db.prepare(
      'INSERT INTO coverage_observation (capability_id, status, limitation_code, observed_units) VALUES (?, ?, ?, ?) ON CONFLICT(capability_id) DO UPDATE SET status = excluded.status, limitation_code = excluded.limitation_code, observed_units = excluded.observed_units',
    )
    const insertEvent = db.prepare(
      'INSERT INTO dated_event_observation (provider_id, repository_provider_id, occurred_at, event_kind) VALUES (?, ?, ?, ?) ON CONFLICT(provider_id) DO UPDATE SET repository_provider_id = excluded.repository_provider_id, occurred_at = excluded.occurred_at, event_kind = excluded.event_kind',
    )

    db.exec(`
      DELETE FROM dated_event_observation;
      DELETE FROM pull_request_fact;
      DELETE FROM commit_observation;
      DELETE FROM coverage_observation;
      DELETE FROM repository_identity;
      DELETE FROM import_run;
    `)
    insertRun.run(sourceChecksum, STORAGE_SCHEMA_VERSION)
    for (const repository of canonical.repositories) {
      insertRepository.run(repository.providerId, repository.analyticalKey, repository.isPrivate, repository.isArchived, repository.isFork)
    }
    if (failAt === 'after-repository-upsert') throw new Error('INJECTED_FAILURE')
    for (const commit of canonical.commits) {
      insertCommit.run(commit.repositoryProviderId, commit.sha, commit.occurredAt, commit.source, commit.additions, commit.deletions, commit.files, commit.parentCount, commit.featureType, commit.isRevert, commit.isFixup, commit.messageLength)
    }
    for (const pullRequest of canonical.pullRequests) {
      insertPullRequest.run(pullRequest.providerId, pullRequest.repositoryProviderId, pullRequest.number, pullRequest.createdAt, pullRequest.mergedAt, pullRequest.closedAt, pullRequest.state, pullRequest.isDraft, pullRequest.additions, pullRequest.deletions, pullRequest.changedFiles, pullRequest.comments, pullRequest.reviews)
    }
    for (const mapped of canonical.coverage) {
      insertCoverage.run(mapped.capabilityId, mapped.status, mapped.limitationCode, mapped.observedUnits)
    }
    for (const event of canonical.events) insertEvent.run(event.providerId, event.repositoryProviderId, event.occurredAt, event.kind)
    assertStorageChecks(db)
  })
  transaction()
  return { checksum: canonicalState(db), integrity: 'ok', foreignKeyViolations: 0 }
}

export async function importV1Json(options: ImportV1Options): Promise<ImportProof> {
  const keyMaterial = resolveImportKeyMaterial(options)
  const source = await readFile(options.sourcePath)
  // Every validation and identity derivation completes before any target is opened or created.
  const canonical = bindCanonicalImport(parseV1Dataset(source.toString('utf8')), keyMaterial.aliases)
  const sourceChecksum = digest(source)
  const existingTarget = existsSync(options.targetPath)
  const workingPath = existingTarget
    ? options.targetPath
    : join(dirname(options.targetPath), `.${basename(options.targetPath)}.${randomUUID()}.tmp`)
  let db: ReturnType<typeof openStorageDatabase> | undefined
  try {
    db = openStorageDatabase(workingPath)
    const result = importIntoDatabase(db, canonical, sourceChecksum, keyMaterial.fingerprint, options.failAt)
    db.close()
    db = undefined
    if (!existingTarget) await rename(workingPath, options.targetPath)
    return result
  } catch (error) {
    db?.close()
    if (!existingTarget) await unlink(workingPath).catch(() => undefined)
    throw error
  }
}

export function storageV2Enabled(value: boolean | string | undefined = process.env.DEVELOPER_LENS_STORAGE_V2): boolean {
  return value === true || value === '1'
}

export async function selectStorageReader(
  options: ImportV1Options & { enabled?: boolean | string },
): Promise<StorageSelection> {
  if (!storageV2Enabled(options.enabled)) return { reader: 'legacy-json', code: 'storage-disabled' }
  try {
    const proof = await importV1Json(options)
    return { reader: 'sqlite-v2', checksum: proof.checksum }
  } catch (error) {
    if (error instanceof InstallationKeyError) {
      return {
        reader: 'legacy-json',
        code: error.code === 'INSTALLATION_KEY_REQUIRED' ? 'storage-key-missing' : 'storage-key-invalid',
      }
    }
    if (error instanceof ImportKeyBindingError) {
      return {
        reader: 'legacy-json',
        code: error.code === 'STORAGE_KEY_MISMATCH' ? 'storage-key-mismatch' : 'storage-key-unbound',
      }
    }
    if (error instanceof V1ValidationError) return { reader: 'legacy-json', code: 'v1-validation-failed' }
    if (error instanceof StorageDatabaseError) return { reader: 'legacy-json', code: 'storage-target-mismatch' }
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') return { reader: 'legacy-json', code: 'source-read-failed' }
    return { reader: 'legacy-json', code: 'storage-import-failed' }
  }
}
