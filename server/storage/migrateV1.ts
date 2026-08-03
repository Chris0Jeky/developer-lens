import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, rename, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { z } from 'zod'
import { openStorageDatabase, runStorageChecks, StorageDatabaseError } from './database.js'
import { STORAGE_SCHEMA_VERSION } from './schema.js'

const dateTime = z.string().datetime({ offset: true })
const opaqueIdentifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9:._-]+$/)
const repositoryReference = z.string().min(1).max(256).regex(/^[A-Za-z0-9:._/-]+$/)
const localRepositoryIdentifier = z.string().min(1).max(262).regex(/^local:[A-Za-z0-9:._/-]+$/)
const repositoryProviderIdentifier = z.union([opaqueIdentifier, localRepositoryIdentifier])
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

export type MigrationFailurePoint = 'after-repository-upsert'

export interface ImportV1Options {
  sourcePath: string
  targetPath: string
  failAt?: MigrationFailurePoint
}

export interface ImportProof {
  checksum: string
  integrity: 'ok'
  foreignKeyViolations: 0
}

export type StorageFailureCode =
  | 'storage-disabled'
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

function validateReferences(dataset: V1Dataset): void {
  const repositoryNames = new Set(dataset.repositories.map((repository) => repository.nameWithOwner))
  const references = [
    ...dataset.commits.map((commit) => commit.repository),
    ...dataset.commitDaysByRepository.map((event) => event.repository),
    ...dataset.pullRequests.map((pullRequest) => pullRequest.repository),
    ...dataset.reviews.map((event) => event.repository),
    ...dataset.issues.map((event) => event.repository),
  ]
  if (references.some((repository) => !repositoryNames.has(repository))) {
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

function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function repositoryKey(providerId: string): string {
  return `repo-${digest(providerId).slice(0, 24)}`
}

function storageRepositoryProviderId(providerId: string): string {
  return providerId.startsWith('local:')
    ? `local-${digest(providerId).slice(0, 24)}`
    : providerId
}

function assertStorageChecks(db: ReturnType<typeof openStorageDatabase>): void {
  const checks = runStorageChecks(db)
  if (checks.integrity !== 'ok' || checks.quick !== 'ok' || checks.foreignKeys.length !== 0) {
    throw new Error('STORAGE_CHECK_FAILED')
  }
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
  dataset: V1Dataset,
  sourceChecksum: string,
  failAt?: MigrationFailurePoint,
): ImportProof {
  const repositoryProviderIds = new Map(
    dataset.repositories.map((repository) => [
      repository.nameWithOwner,
      storageRepositoryProviderId(repository.id),
    ]),
  )
  const transaction = db.transaction(() => {
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

    assertStorageChecks(db)
    db.exec(`
      DELETE FROM dated_event_observation;
      DELETE FROM pull_request_fact;
      DELETE FROM commit_observation;
      DELETE FROM coverage_observation;
      DELETE FROM repository_identity;
      DELETE FROM import_run;
    `)
    insertRun.run(sourceChecksum, STORAGE_SCHEMA_VERSION)
    for (const repository of dataset.repositories) {
      const providerId = storageRepositoryProviderId(repository.id)
      insertRepository.run(providerId, repositoryKey(providerId), Number(repository.isPrivate), Number(repository.isArchived), Number(repository.isFork))
    }
    if (failAt === 'after-repository-upsert') throw new Error('INJECTED_FAILURE')
    for (const commit of dataset.commits) {
      insertCommit.run(repositoryProviderIds.get(commit.repository), commit.sha, commit.occurredAt, commit.source, commit.additions ?? null, commit.deletions ?? null, commit.files ?? null, commit.parentCount ?? null, commit.features.type, Number(commit.features.isRevert), Number(commit.features.isFixup), commit.features.subjectLength)
    }
    for (const pullRequest of dataset.pullRequests) {
      insertPullRequest.run(pullRequest.id, repositoryProviderIds.get(pullRequest.repository), pullRequest.number, pullRequest.createdAt, pullRequest.mergedAt ?? null, pullRequest.closedAt ?? null, pullRequest.state, Number(pullRequest.isDraft), pullRequest.additions ?? null, pullRequest.deletions ?? null, pullRequest.changedFiles ?? null, pullRequest.comments, pullRequest.reviews)
    }
    for (const mapped of aggregateCoverage(dataset.coverage)) {
      insertCoverage.run(mapped.capabilityId, mapped.status, mapped.limitationCode, mapped.observedUnits)
    }
    for (const event of dataset.reviews) insertEvent.run(event.id, repositoryProviderIds.get(event.repository), event.occurredAt, 'review')
    for (const event of dataset.issues) insertEvent.run(event.id, repositoryProviderIds.get(event.repository), event.occurredAt, 'issue')
    assertStorageChecks(db)
  })
  transaction()
  return { checksum: canonicalState(db), integrity: 'ok', foreignKeyViolations: 0 }
}

export async function importV1Json(options: ImportV1Options): Promise<ImportProof> {
  const source = await readFile(options.sourcePath)
  const dataset = parseV1Dataset(source.toString('utf8'))
  const sourceChecksum = digest(source)
  const existingTarget = existsSync(options.targetPath)
  const workingPath = existingTarget
    ? options.targetPath
    : join(dirname(options.targetPath), `.${basename(options.targetPath)}.${randomUUID()}.tmp`)
  let db: ReturnType<typeof openStorageDatabase> | undefined
  try {
    db = openStorageDatabase(workingPath)
    const result = importIntoDatabase(db, dataset, sourceChecksum, options.failAt)
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
    if (error instanceof V1ValidationError) return { reader: 'legacy-json', code: 'v1-validation-failed' }
    if (error instanceof StorageDatabaseError) return { reader: 'legacy-json', code: 'storage-target-mismatch' }
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') return { reader: 'legacy-json', code: 'source-read-failed' }
    return { reader: 'legacy-json', code: 'storage-import-failed' }
  }
}
