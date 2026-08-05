import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type Database from 'better-sqlite3'
import { CLAIM_SCHEMA_VERSION, computeClaimId } from '../shared/claims.js'
import { CANONICAL_ENVELOPE_SCHEMA_VERSION } from '../shared/provenance.js'
import { SYNTHETIC_STORE_MARKER } from '../server/api/v2/contract.js'
import { installV2BridgeStore } from '../server/api/v2/store.js'
import { installClaimGraphStorage } from '../server/storage/claims.js'
import { openStorageDatabase } from '../server/storage/database.js'
import {
  executeRegisteredGithubCoreDeletion,
  planRegisteredGithubCoreDeletion,
  REGISTERED_GITHUB_CORE_DELETION_TABLES,
} from '../server/storage/deletionPlanner.js'
import { installIncrementalGithubCoreStorage } from '../server/storage/incremental.js'
import { createInstallationAliases } from '../server/storage/installationAliases.js'
import {
  applyContinuityCasOperation,
  initializeContinuityCasScope,
  readContinuityCasState,
  type ContinuityCasScopeStatus,
  type ContinuityCasStatus,
} from '../server/storage/v3ContinuityCasProposal.js'
import {
  orchestrateStorageV3ShadowMigration,
  STORAGE_V3_SHADOW_TABLES,
  type StorageV3ShadowMigrationOptions,
} from '../server/storage/v3ShadowMigration.js'
import { sweepStorageV3C2 } from '../server/storage/v3ShadowSweep.js'
import {
  createStorageV3TargetFactory,
  openSelectedStorageV3Store,
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
})

export interface InventedCohort {
  readonly label: 'aged' | 'recent'
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

/** A fixed invented installation key: this command never reads a real one. */
export const INVENTED_INSTALLATION_KEY_BYTE = 0x5b

const hex = (value: string): string => createHash('sha256').update(`invented/${value}`).digest('hex')
const token = (value: string): string => `invented-${value}`

export interface InventedV2Source {
  readonly db: Database.Database
  readonly path: string
  readonly installationKey: Buffer
  readonly identityBindings: readonly { readonly rawProviderId: string }[]
  readonly deletedScopeAlias: string
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
  const coverageId = token(`${label}-coverage`)
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

/** Build a complete invented v2 store: two live cohorts plus one deletable scope. */
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
    const installationKey = Buffer.alloc(32, INVENTED_INSTALLATION_KEY_BYTE)
    const aliases = createInstallationAliases(installationKey)
    for (const cohort of INVENTED_COHORTS) {
      insertCohort(
        db,
        cohort,
        aliases.repositoryProviderId(cohort.rawProviderId),
        aliases.repositoryAnalyticalKey(cohort.rawProviderId),
      )
    }
    const deletedScopeAlias = token('deletable-scope')
    insertScopeGraph(
      db,
      'deletable',
      deletedScopeAlias,
      STORE_LIFECYCLE_TIMELINE.deletedObservedAt,
      STORE_LIFECYCLE_TIMELINE.recentRangeStart,
    )
    return {
      db,
      path,
      installationKey,
      identityBindings: INVENTED_COHORTS.map(({ rawProviderId }) => ({ rawProviderId })),
      deletedScopeAlias,
      tombstoneSubjectId: `scope_tombstone_${hex('deletable-tombstone')}`,
      scopes: INVENTED_COHORTS.length + 1,
      claims: INVENTED_COHORTS.length + 1,
    }
  } catch (error) {
    db.close()
    throw error
  }
}

/**
 * Install the C0 bridge the migration requires.
 *
 * It is deliberately installed after the registered deletion has run: the slice-A
 * planner refuses any store carrying an unregistered table with a capability or
 * scope column, and `v2_coverage_record` is exactly that, so the two seams cannot
 * both be exercised on one store in the other order.
 */
export function installInventedV2Bridge(source: InventedV2Source): void {
  installV2BridgeStore(source.db)
  source.db.prepare(`INSERT INTO v2_store_provenance (
    singleton, mode, synthetic_marker, importer_version, created_at
  ) VALUES (1, 'synthetic', ?, '1.0.0', ?)`)
    .run(SYNTHETIC_STORE_MARKER, STORE_LIFECYCLE_TIMELINE.agedRangeStart)
  source.db.prepare(`INSERT INTO v2_coverage_record (
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
}

export interface DeletionProof {
  readonly tables: number
  readonly rowsBefore: number
  readonly rowsAfter: number
  /** Net across the registered tables: the cascade removes rows and adds one tombstone. */
  readonly netRowsRemoved: number
  readonly tombstoneWritten: boolean
}

const registeredRowCount = (db: Database.Database): number => REGISTERED_GITHUB_CORE_DELETION_TABLES
  .reduce(
    (total, { tableName }) =>
      total + Number(db.prepare(`SELECT COUNT(*) FROM ${tableName}`).pluck().get()),
    0,
  )

/** Plan and execute the registered v2-domain deletion for the deletable scope. */
export function proveRegisteredDeletion(source: InventedV2Source): DeletionProof {
  const rowsBefore = registeredRowCount(source.db)
  const plan = planRegisteredGithubCoreDeletion(source.db, {
    capabilityId: 'github.core',
    scopeAlias: source.deletedScopeAlias,
    tombstoneSubjectId: source.tombstoneSubjectId,
    occurredAt: STORE_LIFECYCLE_TIMELINE.deletedObservedAt,
  })
  const result = executeRegisteredGithubCoreDeletion(source.db, plan)
  const rowsAfter = registeredRowCount(source.db)
  return {
    tables: plan.deletionOrder.length,
    rowsBefore,
    rowsAfter,
    netRowsRemoved: rowsBefore - rowsAfter,
    tombstoneWritten: result.tombstoneWritten,
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
): MigrationProof {
  const result = orchestrateStorageV3ShadowMigration({
    sourceDb: source.db,
    identityBindings: source.identityBindings,
    installationKey: source.installationKey,
    asOf: STORE_LIFECYCLE_TIMELINE.migrationAsOf,
    targetFactory: createStorageV3TargetFactory(directory),
    failAfterStage,
  })
  return { status: result.status, checksumLength: result.checksum.length }
}

export interface ContinuityCasProof {
  readonly scope: ContinuityCasScopeStatus
  readonly firstApply: ContinuityCasStatus
  readonly replayApply: ContinuityCasStatus
  readonly revisions: readonly number[]
}

/**
 * Initialize the CAS scope for one migrated scope and apply the same operation
 * twice: a restart that repeats its last operation must replay, never re-apply.
 */
export function proveContinuityCasRestart(store: Database.Database): ContinuityCasProof {
  const scopeId = store.prepare('SELECT scope_id FROM claim_scope ORDER BY scope_id LIMIT 1')
    .pluck().get() as string | undefined
  if (typeof scopeId !== 'string') throw new Error('STORE_LIFECYCLE_NO_SCOPE')
  const scope = initializeContinuityCasScope(store, scopeId)
  const request = {
    scopeId,
    expectedRevision: 0,
    operationId: `op-${randomBytes(32).toString('hex')}`,
    payloadSha256: hex('cas-receipt'),
  }
  const firstApply = applyContinuityCasOperation(store, request).status
  const replayApply = applyContinuityCasOperation(store, request).status
  return {
    scope,
    firstApply,
    replayApply,
    revisions: readContinuityCasState(store).revisions,
  }
}

export interface SweepProof {
  readonly status: 'complete' | 'noop'
  readonly cleared: Readonly<Record<string, number>>
  readonly clearedTotal: number
  readonly lineageEvents: number
}

export function sweepSelectedStore(store: Database.Database, asOf: string): SweepProof {
  const result = sweepStorageV3C2({ targetDb: store, asOf })
  return {
    status: result.status,
    cleared: result.cleared,
    clearedTotal: Object.values(result.cleared).reduce((total, count) => total + count, 0),
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
  readonly sweepAsOf?: string
}

export interface StoreLifecycleDemoResult {
  readonly deletion: DeletionProof
  readonly migration: MigrationProof
  readonly cas: ContinuityCasProof
  readonly sweep: SweepProof
  readonly report: StoreReport
  readonly lines: readonly string[]
}

const counts = (values: Readonly<Record<string, number>>): string =>
  Object.entries(values)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}=${count}`)
    .join(' ')

/**
 * The full journey on invented data: build, delete, migrate, select, restart the
 * CAS, sweep, and re-validate.
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
  let deletion: DeletionProof
  let migration: MigrationProof
  try {
    emit(`source: invented scopes=${source.scopes} claims=${source.claims} cohorts=${INVENTED_COHORTS.length}`)
    deletion = proveRegisteredDeletion(source)
    emit(`deletion: tables=${deletion.tables} rows-before=${deletion.rowsBefore} rows-after=${deletion.rowsAfter} net-removed=${deletion.netRowsRemoved} tombstone=${deletion.tombstoneWritten ? 'written' : 'absent'}`)
    installInventedV2Bridge(source)
    migration = migrateInventedSource(source, options.directory, options.failAfterStage)
    emit(`migration: status=${migration.status} checksum-digits=${migration.checksumLength}`)
  } finally {
    source.db.close()
  }

  const store = openSelectedStorageV3Store(options.directory)
  let cas: ContinuityCasProof
  let sweep: SweepProof
  try {
    emit(`selection: proven tables=${STORAGE_V3_SHADOW_TABLES.length}`)
    cas = proveContinuityCasRestart(store)
    emit(`cas: scope=${cas.scope} first=${cas.firstApply} restart=${cas.replayApply} revisions=${cas.revisions.join(',')}`)
    sweep = sweepSelectedStore(store, options.sweepAsOf ?? STORE_LIFECYCLE_TIMELINE.sweepAsOf)
    emit(`sweep: status=${sweep.status} cleared=${sweep.clearedTotal} lineage=${sweep.lineageEvents} ${counts(sweep.cleared)}`)
  } finally {
    store.close()
  }

  const revalidated = openSelectedStorageV3Store(options.directory)
  try {
    const report = reportSelectedStore(revalidated)
    emit(`store: rows=${report.rows} cas-scopes=${report.casScopes} cas-operations=${report.casOperations} ${counts(report.tableCounts)}`)
    return { deletion, migration, cas, sweep, report, lines }
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
      installInventedV2Bridge(source)
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
