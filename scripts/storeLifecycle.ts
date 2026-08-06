import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { CLAIM_SCHEMA_VERSION, computeClaimId } from '../shared/claims.js'
import { CANONICAL_ENVELOPE_SCHEMA_VERSION } from '../shared/provenance.js'
import { SYNTHETIC_STORE_MARKER } from '../server/api/v2/contract.js'
import { installV2BridgeStore } from '../server/api/v2/store.js'
import { installClaimGraphStorage } from '../server/storage/claims.js'
import { openStorageDatabase } from '../server/storage/database.js'
import { installIncrementalGithubCoreStorage } from '../server/storage/incremental.js'
import { createInstallationAliases } from '../server/storage/installationAliases.js'
import {
  applyContinuityCasOperation,
  initializeContinuityCasScope,
  readContinuityCasState,
  type ContinuityCasStatus,
} from '../server/storage/v3ContinuityCasProposal.js'
import {
  completeStorageV3DeletionMaintenance,
  deleteStorageV3Scope,
  readStorageV3DeletionLineage,
} from '../server/storage/v3Deletion.js'
import {
  orchestrateStorageV3ShadowMigration,
  STORAGE_V3_SHADOW_TABLES,
  type StorageV3ShadowMigrationOptions,
} from '../server/storage/v3ShadowMigration.js'
import { sweepStorageV3C2 } from '../server/storage/v3ShadowSweep.js'
import {
  createStorageV3TargetFactory,
  openSelectedStorageV3Store,
  registerStorageV3Artifact,
  type StorageV3ArtifactDeletionStage,
  type StorageV3PublicationFailureStage,
} from '../server/storage/v3StoreFiles.js'

/**
 * Owner-controlled, default-off local entrypoint for the storage-v3 lifecycle.
 *
 * It operates only on data it invents inside an explicitly supplied directory:
 * no network, no capability activation, no real store, and never a default
 * directory. Every printed line is counts and statuses only.
 */
export const STORE_LIFECYCLE_ENV_FLAG = 'DEVELOPER_LENS_STORE_LIFECYCLE'
export const STORE_LIFECYCLE_VERBS = ['demo', 'migrate', 'sweep', 'status'] as const
export type StoreLifecycleVerb = typeof STORE_LIFECYCLE_VERBS[number]

export const STORE_LIFECYCLE_HELP = [
  'store:lifecycle — invented-data proof of the storage-v3 lifecycle (default off).',
  `usage: ${STORE_LIFECYCLE_ENV_FLAG}=1 npm run store:lifecycle -- <verb> --dir <path> [--as-of <timestamp>]`,
  `verbs: ${STORE_LIFECYCLE_VERBS.join(', ')}`,
  'boundary: it reads and writes only files inside --dir (creating --dir and any',
  'missing parent directories), all of them built from invented data by this',
  'command. It never defaults to a directory, never opens a real store, performs',
  'no network call, and activates no capability.',
].join('\n')

export const INVENTED_SOURCE_FILE_NAME = 'invented-v2-source.sqlite'

/**
 * The invented timeline. The aged cohort crosses the inclusive 13-month C2
 * boundary exactly at `sweepAsOf`; the recent cohort stays well inside it, so
 * one sweep has both something to clear and something it must not touch.
 */
export const STORE_LIFECYCLE_TIMELINE = Object.freeze({
  agedRangeStart: '2025-02-01T00:00:00.000Z',
  agedObservedAt: '2025-03-01T00:00:00.000Z',
  recentRangeStart: '2025-12-01T00:00:00.000Z',
  recentObservedAt: '2026-01-01T00:00:00.000Z',
  deletedObservedAt: '2026-01-15T00:00:00.000Z',
  migrationAsOf: '2026-02-01T00:00:00.000Z',
  sweepAsOf: '2026-04-01T00:00:00.000Z',
  deletionAsOf: '2026-04-02T00:00:00.000Z',
})

export interface InventedCohort {
  readonly label: 'aged' | 'recent' | 'deletable'
  readonly rawProviderId: string
  readonly rangeStart: string
  readonly observedAt: string
}

export const INVENTED_COHORTS: readonly InventedCohort[] = Object.freeze([
  Object.freeze({
    label: 'aged' as const,
    rawProviderId: 'invented-repository-aged',
    rangeStart: STORE_LIFECYCLE_TIMELINE.agedRangeStart,
    observedAt: STORE_LIFECYCLE_TIMELINE.agedObservedAt,
  }),
  Object.freeze({
    label: 'recent' as const,
    rawProviderId: 'invented-repository-recent',
    rangeStart: STORE_LIFECYCLE_TIMELINE.recentRangeStart,
    observedAt: STORE_LIFECYCLE_TIMELINE.recentObservedAt,
  }),
])

/**
 * The third full cohort exists to be DELETED: it migrates like the others and one
 * B3 scope deletion removes it from the SELECTED store — the product order, not
 * the old delete-the-source-first workaround.
 */
export const INVENTED_DELETABLE_COHORT: InventedCohort = Object.freeze({
  label: 'deletable' as const,
  rawProviderId: 'invented-repository-deletable',
  rangeStart: STORE_LIFECYCLE_TIMELINE.recentRangeStart,
  observedAt: STORE_LIFECYCLE_TIMELINE.deletedObservedAt,
})

/** A fixed invented installation key: this command never reads a real one. */
export const INVENTED_INSTALLATION_KEY_BYTE = 0x5b

const hex = (value: string): string => createHash('sha256').update(`invented/${value}`).digest('hex')
const token = (value: string): string => `invented-${value}`

export interface InventedV2Source {
  readonly db: Database.Database
  readonly path: string
  readonly installationKey: Buffer
  readonly identityBindings: readonly { readonly rawProviderId: string }[]
  /** The raw provider whose migrated scope the demo deletes on the SELECTED store. */
  readonly deletableRawProviderId: string
  /** A historical slice-A legacy tombstone the migration must carry forward. */
  readonly tombstoneSubjectId: string
  readonly scopes: number
  readonly claims: number
}

function insertCohort(
  db: Database.Database,
  cohort: InventedCohort,
  providerId: string,
  analyticalKey: string,
): void {
  const { label, observedAt, rangeStart } = cohort
  db.prepare(`INSERT INTO repository_identity (
    provider_id, analytical_key, is_private, is_archived, is_fork
  ) VALUES (?, ?, 0, 0, 0)`).run(providerId, analyticalKey)
  db.prepare(`INSERT INTO commit_observation (
    repository_provider_id, sha, occurred_at, source, additions, deletions, files,
    parent_count, feature_type, is_revert, is_fixup, message_length
  ) VALUES (?, ?, ?, 'github', 5, 2, 3, 1, 'feat', 0, 0, 24)`)
    .run(providerId, token(`${label}-commit`), observedAt)
  db.prepare(`INSERT INTO pull_request_fact (
    provider_id, repository_provider_id, number, created_at, merged_at, closed_at,
    state, is_draft, additions, deletions, changed_files, comments, reviews
  ) VALUES (?, ?, 7, ?, ?, ?, 'MERGED', 0, 5, 2, 3, 2, 1)`)
    .run(token(`${label}-pull-request`), providerId, observedAt, observedAt, observedAt)
  db.prepare(`INSERT INTO dated_event_observation (
    provider_id, repository_provider_id, occurred_at, event_kind
  ) VALUES (?, ?, ?, 'review')`).run(token(`${label}-event`), providerId, observedAt)
  insertScopeGraph(db, label, providerId, observedAt, rangeStart)
}

/**
 * One claim-graph and incremental scope: a completed job with exactly one
 * snapshot, one coverage row, one checkpoint, and a claim whose basis edge
 * cites that coverage through evidence.
 */
function insertScopeGraph(
  db: Database.Database,
  label: string,
  scopeAlias: string,
  observedAt: string,
  rangeStart: string,
): string {
  const scopeId = `scope-${hex(`${label}-scope`)}`
  const jobId = token(`${label}-job`)
  const snapshotId = token(`${label}-snapshot`)
  // #86: the ledger key is the content-free registry shape (`cov-` + 64 lowercase
  // hex), derived per label so each cohort owns a distinct key under UNIQUE.
  const coverageId = `cov-${hex(`${label}-coverage`)}`
  const evidenceId = token(`${label}-evidence`)
  db.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at) VALUES (?, ?, ?)')
    .run(scopeId, scopeAlias, observedAt)
  db.prepare(`INSERT INTO collection_job (
    job_id, storage_contract_version, payload_hash, capability_id, scope_alias,
    query_version, source_api_version, consent_revision, range_start, range_end,
    observed_at, started_at, completed_at, status
  ) VALUES (?, '2.2.0', ?, 'github.core', ?, 'github.core.v1', '2026-03-10',
    'invented-consent-v1', ?, ?, ?, ?, ?, 'complete')`)
    .run(
      jobId,
      hex(`${label}-payload`),
      scopeAlias,
      rangeStart,
      observedAt,
      observedAt,
      observedAt,
      observedAt,
    )
  db.prepare(`INSERT INTO source_snapshot (
    snapshot_id, job_id, capability_id, scope_alias, snapshot_hash,
    range_start, range_end, observed_at
  ) VALUES (?, ?, 'github.core', ?, ?, ?, ?, ?)`)
    .run(snapshotId, jobId, scopeAlias, hex(`${label}-snapshot`), rangeStart, observedAt, observedAt)
  db.prepare(`INSERT INTO coverage_ledger (
    coverage_id, range_start, job_id, snapshot_id, capability_id, scope_alias,
    range_end, status, expected_units, observed_units, omitted_units, retryable,
    observed_at, limitation_code
  ) VALUES (?, ?, ?, ?, 'github.core', ?, ?, 'complete', 3, 3, 0, 0, ?, 'NONE')`)
    .run(coverageId, rangeStart, jobId, snapshotId, scopeAlias, observedAt, observedAt)
  db.prepare(`INSERT INTO collection_checkpoint (
    capability_id, scope_alias, query_version, source_api_version, high_watermark,
    cursor_hint, bounded_overlap_start, last_complete_snapshot_hash, consent_revision,
    committed_job_id, source_snapshot_id
  ) VALUES ('github.core', ?, 'github.core.v1', '2026-03-10', ?, ?, ?, ?,
    'invented-consent-v1', ?, ?)`)
    .run(
      scopeAlias,
      observedAt,
      token(`${label}-cursor`),
      rangeStart,
      hex(`${label}-snapshot`),
      jobId,
      snapshotId,
    )
  db.prepare(`INSERT INTO evidence (
    evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id
  ) VALUES (?, 'observed', ?, ?, ?, ?)`)
    .run(evidenceId, CANONICAL_ENVELOPE_SCHEMA_VERSION, coverageId, rangeStart, jobId)
  const claimId = computeClaimId({
    layer: 'modelled',
    statementCode: 'DELIVERY_FLOW',
    methodId: 'invented.method',
    methodVersion: '1.0.0',
    basis: [{ role: 'supports', targetEvidenceId: evidenceId }],
    windowStart: rangeStart,
    windowEnd: observedAt,
    scopeId,
    schemaVersion: CLAIM_SCHEMA_VERSION,
  })
  db.prepare(`INSERT INTO claim (
    claim_id, layer, statement_code, method_id, method_version, window_start,
    window_end, scope_id, schema_version, claim_id_material_version, created_at
  ) VALUES (?, 'modelled', 'DELIVERY_FLOW', 'invented.method', '1.0.0', ?, ?, ?, ?, 'claim-id.v2', ?)`)
    .run(claimId, rangeStart, observedAt, scopeId, CLAIM_SCHEMA_VERSION, observedAt)
  db.prepare(`INSERT INTO claim_evidence_edge (
    claim_id, role, target_evidence_id
  ) VALUES (?, 'supports', ?)`).run(claimId, evidenceId)
  db.prepare(`INSERT INTO limitation_instance (
    claim_id, limitation_code, dimension, copy_key
  ) VALUES (?, 'SAMPLE_TOO_SMALL', 'sample', 'invented.copy')`).run(claimId)
  return scopeId
}

/**
 * Build a complete invented v2 store: three full cohorts (one destined for B3
 * deletion), the C0 bridge PRESENT from the start — the order the old slice-A
 * planner could not survive — and one historical slice-A legacy tombstone.
 */
export function createInventedV2Source(directory: string): InventedV2Source {
  mkdirSync(directory, { recursive: true })
  const path = join(directory, INVENTED_SOURCE_FILE_NAME)
  for (const suffix of ['-shm', '-wal', '-journal', '']) {
    rmSync(`${path}${suffix}`, { force: true })
  }
  const db = openStorageDatabase(path)
  try {
    installIncrementalGithubCoreStorage(db)
    installClaimGraphStorage(db)
    installV2BridgeStore(db)
    const installationKey = Buffer.alloc(32, INVENTED_INSTALLATION_KEY_BYTE)
    const aliases = createInstallationAliases(installationKey)
    const cohorts = [...INVENTED_COHORTS, INVENTED_DELETABLE_COHORT]
    for (const cohort of cohorts) {
      insertCohort(
        db,
        cohort,
        aliases.repositoryProviderId(cohort.rawProviderId),
        aliases.repositoryAnalyticalKey(cohort.rawProviderId),
      )
    }
    db.prepare(`INSERT INTO v2_store_provenance (
      singleton, mode, synthetic_marker, importer_version, created_at
    ) VALUES (1, 'synthetic', ?, '1.0.0', ?)`)
      .run(SYNTHETIC_STORE_MARKER, STORE_LIFECYCLE_TIMELINE.agedRangeStart)
    db.prepare(`INSERT INTO v2_coverage_record (
      coverage_id, capability_id, scope_alias, range_start, range_end, status,
      expected_units, observed_units, omitted_units, retryable, observed_at, limitation_code
    ) VALUES (?, 'github.core', ?, ?, ?, 'complete', 3, 3, 0, 0, ?, 'NONE')`)
      .run(
        token('c0-coverage'),
        token('c0-scope'),
        STORE_LIFECYCLE_TIMELINE.agedRangeStart,
        STORE_LIFECYCLE_TIMELINE.agedObservedAt,
        STORE_LIFECYCLE_TIMELINE.agedObservedAt,
      )
    const tombstoneSubjectId = `scope_tombstone_${hex('historical-tombstone')}`
    db.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)')
      .run(tombstoneSubjectId, 'tombstone_cascade', 'cap_github_core', STORE_LIFECYCLE_TIMELINE.deletedObservedAt)
    return {
      db,
      path,
      installationKey,
      identityBindings: cohorts.map(({ rawProviderId }) => ({ rawProviderId })),
      deletableRawProviderId: INVENTED_DELETABLE_COHORT.rawProviderId,
      tombstoneSubjectId,
      scopes: cohorts.length,
      claims: cohorts.length,
    }
  } catch (error) {
    db.close()
    throw error
  }
}

export interface MigrationProof {
  readonly status: 'complete'
  readonly checksumLength: number
}

/** Migrate the invented source into a file target and accept the proven store. */
export function migrateInventedSource(
  source: InventedV2Source,
  directory: string,
  failAfterStage?: StorageV3ShadowMigrationOptions['failAfterStage'],
  failAtPublicationStage?: StorageV3PublicationFailureStage,
): MigrationProof {
  const result = orchestrateStorageV3ShadowMigration({
    sourceDb: source.db,
    identityBindings: source.identityBindings,
    installationKey: source.installationKey,
    asOf: STORE_LIFECYCLE_TIMELINE.migrationAsOf,
    targetFactory: createStorageV3TargetFactory(directory, { failAtPublicationStage }),
    failAfterStage,
  })
  return { status: result.status, checksumLength: result.checksum.length }
}

export interface ContinuityCasProof {
  readonly scopes: number
  readonly firstApply: ContinuityCasStatus
  readonly replayApply: ContinuityCasStatus
  readonly revisions: readonly number[]
}

/**
 * Initialize CAS state for EVERY migrated scope, then apply the same operation
 * twice on the named one: a restart that repeats its last operation must replay,
 * never re-apply. The named scope is the one the demo later deletes, so the B3
 * cascade is proven against live CAS rows while another scope's survive.
 */
export function proveContinuityCasRestart(
  store: Database.Database,
  operatedScopeId: string,
): ContinuityCasProof {
  const scopeIds = store.prepare('SELECT scope_id FROM claim_scope ORDER BY scope_id')
    .pluck().all() as string[]
  if (!scopeIds.includes(operatedScopeId)) throw new Error('STORE_LIFECYCLE_NO_SCOPE')
  for (const scopeId of scopeIds) initializeContinuityCasScope(store, scopeId)
  const request = {
    scopeId: operatedScopeId,
    expectedRevision: 0,
    operationId: `op-${randomBytes(32).toString('hex')}`,
    payloadSha256: hex('cas-receipt'),
  }
  const firstApply = applyContinuityCasOperation(store, request).status
  const replayApply = applyContinuityCasOperation(store, request).status
  return {
    scopes: scopeIds.length,
    firstApply,
    replayApply,
    revisions: readContinuityCasState(store).revisions,
  }
}

interface LifecycleArtifactFixture {
  readonly sharedLocator: string
  readonly sharedArtifactId: string
  readonly otherLocator: string
  readonly otherArtifactId: string
}

/** Add only invented, app-owned files for the B4 deletion proof. */
function addLifecycleArtifactFixture(
  store: Database.Database,
  directory: string,
  deletedScopeId: string,
): LifecycleArtifactFixture {
  const survivors = store.prepare(
    'SELECT scope_id FROM claim_scope WHERE scope_id <> ? ORDER BY scope_id',
  ).pluck().all(deletedScopeId) as string[]
  const survivor = survivors[0]
  if (typeof survivor !== 'string') throw new Error('STORE_LIFECYCLE_NO_SURVIVOR')
  const createArtifact = (locator: string): void => {
    const artifact = new Database(join(directory, locator))
    try {
      artifact.exec('CREATE TABLE invented_fixture (value INTEGER) STRICT')
      artifact.prepare('INSERT INTO invented_fixture (value) VALUES (1)').run()
    } finally { artifact.close() }
  }
  const sharedLocator = 'migration-backup-20260201T000000Z.sqlite'
  const otherLocator = 'invented-survivor-only.sqlite'
  createArtifact(sharedLocator)
  createArtifact(otherLocator)
  const shared = registerStorageV3Artifact({
    db: store,
    kind: 'migration_backup_v1',
    relativeLocator: sharedLocator,
    scopeIds: [deletedScopeId, survivor],
    artifactId: `art-${'a'.repeat(64)}`,
  }).artifactId
  const other = registerStorageV3Artifact({
    db: store,
    kind: 'invented_fixture_store',
    relativeLocator: otherLocator,
    scopeIds: [survivor],
    artifactId: `art-${'b'.repeat(64)}`,
  }).artifactId
  store.prepare(`INSERT INTO lineage_event (
    scope_id, subject_kind, subject_id, operation_id, capability_id,
    caused_by, event_kind, event_week
  ) VALUES (?, 'artifact', ?, ?, 'github.core', NULL, 'index_built', ?)`)
    .run(survivor, shared, `op-${'1'.repeat(64)}`, '2026-W05')
  return { sharedLocator, sharedArtifactId: shared, otherLocator, otherArtifactId: other }
}

export interface ScopeDeletionProof {
  readonly status: 'deleted'
  readonly replay: 'replayed'
  readonly rowsRemoved: number
  readonly tombstonesWritten: number
  readonly remainingScopes: number
  readonly otherScopesIntact: boolean
  readonly casScopesRemaining: number
  /** Deletion-kind lineage rows the store can explain itself with, by event kind. */
  readonly deletionRecords: Readonly<Record<string, number>>
  readonly maintenance: 'complete'
}

/**
 * B3 on the SELECTED store: delete one scope transactionally, replay it
 * idempotently, explain the erasure from the surviving tombstone lineage, and
 * complete the WAL/rebuild saga — while proving the other scopes' rows and CAS
 * state survive byte-for-byte.
 */
export function proveScopeDeletion(
  store: Database.Database,
  scopeId: string,
  options: Readonly<{
    failAfterArtifactStage?: (
      stage: StorageV3ArtifactDeletionStage,
      completedArtifacts: number,
    ) => void
  }> = {},
): ScopeDeletionProof {
  const otherScopes = (store.prepare('SELECT scope_id FROM claim_scope WHERE scope_id <> ? ORDER BY scope_id')
    .pluck().all(scopeId) as string[])
  const lifecycleTables = new Set(['app_artifact', 'app_artifact_scope', 'lineage_event', 'storage_maintenance_state'])
  const scopeTables = [...STORAGE_V3_SHADOW_TABLES].sort().filter((table) =>
    !lifecycleTables.has(table) &&
    (store.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
      .some(({ name }) => name === 'scope_id'))
  const snapshotOthers = (): string => JSON.stringify(otherScopes.map((other) =>
    scopeTables.map((table) =>
      store.prepare(`SELECT * FROM ${table} WHERE scope_id = ? ORDER BY rowid`).all(other))))
  const othersBefore = snapshotOthers()

  const result = deleteStorageV3Scope({
    db: store,
    scopeId,
    asOf: STORE_LIFECYCLE_TIMELINE.deletionAsOf,
  })
  const replay = deleteStorageV3Scope({
    db: store,
    scopeId,
    asOf: STORE_LIFECYCLE_TIMELINE.deletionAsOf,
    operationId: result.operationId,
  })
  const maintenance = completeStorageV3DeletionMaintenance(store, {
    failAfterArtifactStage: options.failAfterArtifactStage,
  })
  const deletionRecords: Record<string, number> = {}
  for (const entry of readStorageV3DeletionLineage(store)) {
    deletionRecords[entry.eventKind] = (deletionRecords[entry.eventKind] ?? 0) + 1
  }
  return {
    status: result.status as 'deleted',
    replay: replay.status as 'replayed',
    rowsRemoved: Object.values(result.deletedRows).reduce((total, count) => total + count, 0),
    tombstonesWritten: result.tombstonesWritten,
    remainingScopes: Number(store.prepare('SELECT COUNT(*) FROM claim_scope').pluck().get()),
    otherScopesIntact: snapshotOthers() === othersBefore,
    casScopesRemaining: readContinuityCasState(store).scopes,
    deletionRecords,
    maintenance: maintenance.maintenance,
  }
}

export interface SweepProof {
  readonly status: 'complete' | 'noop'
  readonly cleared: Readonly<Record<string, number>>
  readonly casReceiptsCleared: number
  readonly clearedTotal: number
  readonly lineageEvents: number
}

export function sweepSelectedStore(store: Database.Database, asOf: string): SweepProof {
  const result = sweepStorageV3C2({ targetDb: store, asOf })
  return {
    status: result.status,
    cleared: result.cleared,
    casReceiptsCleared: result.casReceiptsCleared,
    clearedTotal: Object.values(result.cleared).reduce((total, count) => total + count, 0)
      + result.casReceiptsCleared,
    lineageEvents: result.lineageEvents,
  }
}

export interface StoreReport {
  readonly tableCounts: Readonly<Record<string, number>>
  readonly rows: number
  readonly casScopes: number
  readonly casOperations: number
  readonly casRevisions: readonly number[]
}

/** Content-free store report: table names with counts, and CAS revisions. */
export function reportSelectedStore(store: Database.Database): StoreReport {
  const tableCounts: Record<string, number> = {}
  let rows = 0
  for (const table of [...STORAGE_V3_SHADOW_TABLES].sort()) {
    const count = Number(store.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get())
    tableCounts[table] = count
    rows += count
  }
  const cas = readContinuityCasState(store)
  return {
    tableCounts,
    rows,
    casScopes: cas.scopes,
    casOperations: cas.operations,
    casRevisions: cas.revisions,
  }
}

export interface StoreLifecycleDemoOptions {
  readonly directory: string
  readonly log?: (line: string) => void
  readonly failAfterStage?: StorageV3ShadowMigrationOptions['failAfterStage']
  readonly failAtPublicationStage?: StorageV3PublicationFailureStage
  readonly includeSharedArtifactFixture?: boolean
  readonly failAfterArtifactStage?: (
    stage: StorageV3ArtifactDeletionStage,
    completedArtifacts: number,
  ) => void
  readonly sweepAsOf?: string
}

export interface StoreLifecycleDemoResult {
  readonly migration: MigrationProof
  readonly cas: ContinuityCasProof
  readonly sweep: SweepProof
  readonly deletion: ScopeDeletionProof
  readonly report: StoreReport
  readonly lines: readonly string[]
}

const counts = (values: Readonly<Record<string, number>>): string =>
  Object.entries(values)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}=${count}`)
    .join(' ')

/**
 * The full journey on invented data, in the product order B3 makes possible:
 * build (bridge present) -> migrate -> select -> restart the CAS -> sweep ->
 * DELETE one scope on the selected store -> explain its tombstones -> reopen and
 * re-validate with the other scopes intact.
 */
export function runStoreLifecycleDemo(
  options: StoreLifecycleDemoOptions,
): StoreLifecycleDemoResult {
  const lines: string[] = []
  const emit = (line: string): void => {
    lines.push(line)
    options.log?.(line)
  }
  const source = createInventedV2Source(options.directory)
  let migration: MigrationProof
  let deletableAlias: string
  try {
    emit(`source: invented scopes=${source.scopes} claims=${source.claims} cohorts=${INVENTED_COHORTS.length + 1} bridge=present`)
    migration = migrateInventedSource(
      source,
      options.directory,
      options.failAfterStage,
      options.failAtPublicationStage,
    )
    emit(`migration: status=${migration.status} checksum-digits=${migration.checksumLength}`)
    deletableAlias = createInstallationAliases(source.installationKey)
      .repositoryProviderId(source.deletableRawProviderId)
  } finally {
    source.db.close()
  }

  const store = openSelectedStorageV3Store(options.directory)
  let cas: ContinuityCasProof
  let sweep: SweepProof
  let deletion: ScopeDeletionProof
  try {
    emit(`selection: proven tables=${STORAGE_V3_SHADOW_TABLES.length}`)
    const deletableScopeId = store.prepare('SELECT scope_id FROM claim_scope WHERE scope_alias = ?')
      .pluck().get(deletableAlias) as string | undefined
    if (typeof deletableScopeId !== 'string') throw new Error('STORE_LIFECYCLE_NO_SCOPE')
    cas = proveContinuityCasRestart(store, deletableScopeId)
    emit(`cas: scopes=${cas.scopes} first=${cas.firstApply} restart=${cas.replayApply} revisions=${cas.revisions.join(',')}`)
    sweep = sweepSelectedStore(store, options.sweepAsOf ?? STORE_LIFECYCLE_TIMELINE.sweepAsOf)
    emit(`sweep: status=${sweep.status} cleared=${sweep.clearedTotal} cas-receipts=${sweep.casReceiptsCleared} lineage=${sweep.lineageEvents} ${counts(sweep.cleared)}`)
    const artifactFixture = options.includeSharedArtifactFixture
      ? addLifecycleArtifactFixture(store, options.directory, deletableScopeId)
      : undefined
    deletion = proveScopeDeletion(store, deletableScopeId, {
      failAfterArtifactStage: options.failAfterArtifactStage,
    })
    if (artifactFixture !== undefined) {
      if (existsSync(join(options.directory, artifactFixture.sharedLocator))) {
        throw new Error('STORE_LIFECYCLE_SHARED_ARTIFACT_REMAINS')
      }
    }
    emit(`deletion: status=${deletion.status} replay=${deletion.replay} rows-removed=${deletion.rowsRemoved} tombstones=${deletion.tombstonesWritten} remaining-scopes=${deletion.remainingScopes} others-intact=${deletion.otherScopesIntact ? 'yes' : 'NO'} cas-remaining=${deletion.casScopesRemaining} maintenance=${deletion.maintenance} ${counts(deletion.deletionRecords)}`)
  } finally {
    store.close()
  }

  const revalidated = openSelectedStorageV3Store(options.directory)
  try {
    const report = reportSelectedStore(revalidated)
    emit(`store: rows=${report.rows} cas-scopes=${report.casScopes} cas-operations=${report.casOperations} ${counts(report.tableCounts)}`)
    return { migration, cas, sweep, deletion, report, lines }
  } finally {
    revalidated.close()
  }
}

export interface StoreLifecycleInvocation {
  readonly verb: StoreLifecycleVerb
  readonly directory: string
  readonly asOf: string
}

export type StoreLifecycleParse =
  | { readonly ok: true; readonly invocation: StoreLifecycleInvocation }
  | { readonly ok: false; readonly message: string }

/** The gate: an explicit opt-in environment flag and an explicit directory. */
export function parseStoreLifecycleInvocation(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): StoreLifecycleParse {
  if (env[STORE_LIFECYCLE_ENV_FLAG] !== '1') {
    return { ok: false, message: `refused: set ${STORE_LIFECYCLE_ENV_FLAG}=1 to run this owner-only command` }
  }
  const verb = argv[0]
  if (!verb || !(STORE_LIFECYCLE_VERBS as readonly string[]).includes(verb)) {
    return { ok: false, message: `refused: first argument must be one of ${STORE_LIFECYCLE_VERBS.join(', ')}` }
  }
  let directory: string | undefined
  let asOf: string = STORE_LIFECYCLE_TIMELINE.sweepAsOf
  let asOfExplicit = false
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dir' && argv[index + 1]) {
      directory = argv[index + 1]
      index += 1
    } else if (argument === '--as-of' && argv[index + 1]) {
      asOf = argv[index + 1]
      asOfExplicit = true
      index += 1
    } else {
      return { ok: false, message: `refused: unrecognized argument (expected --dir <path> [--as-of <timestamp>])` }
    }
  }
  if (!directory) {
    return { ok: false, message: 'refused: --dir <path> is required; this command never defaults to a directory' }
  }
  if (asOfExplicit && verb !== 'sweep' && verb !== 'demo') {
    return { ok: false, message: `refused: --as-of applies only to sweep and demo, not ${verb}` }
  }
  return { ok: true, invocation: { verb: verb as StoreLifecycleVerb, directory, asOf } }
}

function runVerb(
  invocation: StoreLifecycleInvocation,
  log: (line: string) => void,
): void {
  if (invocation.verb === 'demo') {
    runStoreLifecycleDemo({ directory: invocation.directory, log, sweepAsOf: invocation.asOf })
    return
  }
  if (invocation.verb === 'migrate') {
    const source = createInventedV2Source(invocation.directory)
    try {
      const migration = migrateInventedSource(source, invocation.directory)
      log(`migration: status=${migration.status} checksum-digits=${migration.checksumLength}`)
    } finally {
      source.db.close()
    }
    return
  }
  const store = openSelectedStorageV3Store(invocation.directory)
  try {
    if (invocation.verb === 'sweep') {
      const sweep = sweepSelectedStore(store, invocation.asOf)
      log(`sweep: status=${sweep.status} cleared=${sweep.clearedTotal} lineage=${sweep.lineageEvents} ${counts(sweep.cleared)}`)
      return
    }
    const report = reportSelectedStore(store)
    log(`store: rows=${report.rows} cas-scopes=${report.casScopes} cas-operations=${report.casOperations} ${counts(report.tableCounts)}`)
    log(`cas: revisions=${report.casRevisions.join(',') || 'none'}`)
  } finally {
    store.close()
  }
}

/** Returns the process exit code; never throws for a refused invocation. */
export function runStoreLifecycleCli(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  log: (line: string) => void,
): number {
  const parsed = parseStoreLifecycleInvocation(argv, env)
  if (!parsed.ok) {
    log(parsed.message)
    log(STORE_LIFECYCLE_HELP)
    return 1
  }
  try {
    runVerb(parsed.invocation, log)
    return 0
  } catch (error) {
    // Codes and error names only: no message from this chain reaches the owner,
    // because a library message may quote a path or a store value.
    const named = error instanceof Error
      ? (error as Error & { code?: unknown }).code ?? error.name
      : 'UNKNOWN'
    log(`failed: ${typeof named === 'string' ? named : 'UNKNOWN'}`)
    return 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runStoreLifecycleCli(
    process.argv.slice(2),
    process.env,
    (line) => { console.log(line) },
  )
}
