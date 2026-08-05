import { createHash, randomBytes as cryptoRandomBytes } from 'node:crypto'
import Database from 'better-sqlite3'
import {
  rewriteStorageV3Shadow,
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  STORAGE_V3_SHADOW_TABLES,
  STORAGE_V3_SHADOW_USER_VERSION,
  storageV3ShadowSchemaFingerprint,
  type ShadowIdentityBinding,
  type StorageV3ShadowRewriteStage,
} from './v3ShadowRewrite.js'

/** A caller-owned target attempt. No filesystem path crosses this boundary. */
export interface StorageV3ShadowTargetAttempt {
  readonly db: Database.Database
  close(): void
  reopen(): StorageV3ShadowTargetAttempt
  discard(): void
}

export interface StorageV3ShadowTargetFactory {
  create(kind: 'primary' | 'replay'): StorageV3ShadowTargetAttempt
  /** Accept ownership only after the orchestrator has completed every proof. */
  accept(primary: StorageV3ShadowTargetAttempt): void
}

export interface StorageV3ShadowMigrationOptions {
  readonly sourceDb: Database.Database
  readonly identityBindings: readonly ShadowIdentityBinding[]
  readonly installationKey: Buffer
  readonly asOf: string
  readonly targetFactory: StorageV3ShadowTargetFactory
  readonly primaryRandomBytes?: (size: number) => Buffer
  readonly replayRandomBytes?: (size: number) => Buffer
  readonly failAfterStage?: (kind: 'primary' | 'replay', stage: StorageV3ShadowRewriteStage) => void
}

export interface StorageV3ShadowMigrationResult {
  readonly completeB1b: true
  readonly selectable: true
  readonly status: 'complete'
  readonly checksum: string
}

export class StorageV3ShadowMigrationError extends Error {
  public readonly code = 'ORCHESTRATION_FAILED' as const

  constructor() {
    super('ORCHESTRATION_FAILED')
    this.name = 'StorageV3ShadowMigrationError'
  }
}

const RANDOM_KEY = /^(?:scope-|cl_|job-|snap-|ckpt-|cov-|ev-|art-|op-|del-|obs-|pr-|event-)[0-9a-f]{64}$/
const C1_ID_COLUMNS = new Set([
  'scope_id',
  'coverage_id',
  'job_id',
  'checkpoint_id',
  'snapshot_id',
  'evidence_id',
  'claim_id',
  'superseded_by',
  'target_evidence_id',
  'target_claim_id',
  'target_coverage_id',
  'subject_id',
  'operation_id',
  'caused_by',
])

type ShadowTable = typeof STORAGE_V3_SHADOW_TABLES[number]

/**
 * Versioned allowlist for the retained C1 graph. Empty bridge/import entries are
 * deliberate. A newly added shadow table cannot silently enter the checksum.
 */
const C1_GRAPH_VERSION = 'storage-v3-c1-graph.v1'
const C1_GRAPH_COLUMNS = {
  import_run: [],
  claim_scope: ['scope_id'],
  repository_identity: ['scope_id', 'is_private', 'is_archived', 'is_fork'],
  commit_observation: [
    'scope_id', 'additions', 'deletions', 'files', 'parent_count', 'feature_type',
    'is_revert', 'is_fixup', 'message_length',
  ],
  pull_request_fact: [
    'scope_id', 'state', 'is_draft', 'additions', 'deletions', 'changed_files',
    'comments', 'reviews',
  ],
  coverage_observation: [
    'scope_id', 'coverage_id', 'capability_id', 'status', 'limitation_code', 'observed_units',
  ],
  dated_event_observation: ['scope_id', 'event_kind'],
  v2_store_provenance: [],
  v2_coverage_record: [],
  collection_job: [
    'scope_id', 'job_id', 'capability_id', 'storage_contract_version', 'query_version',
    'source_api_version', 'consent_revision', 'status',
  ],
  collection_checkpoint: [
    'scope_id', 'checkpoint_id', 'job_id', 'snapshot_id', 'capability_id', 'query_version',
    'source_api_version', 'consent_revision', 'coverage_state', 'deletion_order',
    'lineage_coverage',
  ],
  source_snapshot: ['scope_id', 'snapshot_id', 'job_id', 'capability_id', 'status'],
  coverage_ledger: [
    'scope_id', 'coverage_id', 'job_id', 'snapshot_id', 'capability_id', 'status',
    'expected_units', 'observed_units', 'omitted_units', 'saturation_reason', 'retryable',
    'limitation_code',
  ],
  evidence: ['scope_id', 'evidence_id', 'coverage_id', 'layer', 'schema_version'],
  claim: [
    'scope_id', 'claim_id', 'layer', 'statement_code', 'method_id', 'method_version',
    'window_start', 'window_end', 'schema_version', 'claim_id_material_version', 'superseded_by',
  ],
  claim_evidence_edge: [
    'scope_id', 'claim_id', 'role', 'target_evidence_id', 'target_claim_id',
    'target_coverage_id',
  ],
  limitation_instance: ['scope_id', 'claim_id', 'limitation_code', 'dimension', 'copy_key'],
  lineage_event: [
    'scope_id', 'subject_kind', 'subject_id', 'operation_id', 'capability_id', 'caused_by',
    'event_kind', 'event_week',
  ],
  // New-store state, never migration output: empty at acceptance and outside the
  // replayed C1 graph, so neither target's CAS rows can enter the checksum.
  continuity_cas_state: [],
  continuity_cas_operation: [],
} as const satisfies Record<ShadowTable, readonly string[]>

const lengthPrefix = (value: string): string => `${value.length}:${value}`

function typedValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return `string${lengthPrefix(value)}`
  if (typeof value === 'number') return `number${lengthPrefix(String(value))}`
  if (typeof value === 'bigint') return `bigint${lengthPrefix(String(value))}`
  if (Buffer.isBuffer(value)) return `bytes${lengthPrefix(value.toString('hex'))}`
  throw new Error()
}

interface C1Cell {
  readonly column: string
  readonly value: unknown
  readonly id: string | undefined
}

interface C1Row {
  readonly table: ShadowTable
  readonly cells: readonly C1Cell[]
}

function c1Rows(db: Database.Database): C1Row[] {
  const projected: C1Row[] = []
  for (const table of [...STORAGE_V3_SHADOW_TABLES].sort()) {
    const columns = C1_GRAPH_COLUMNS[table]
    if (columns.length === 0) continue
    const installed = new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(({ name }) => name),
    )
    if (columns.some((column) => !installed.has(column))) throw new Error()
    const rows = db.prepare(`SELECT ${columns.join(', ')} FROM ${table}`).all() as Array<Record<string, unknown>>
    for (const row of rows) {
      projected.push({
        table,
        cells: columns.map((column) => {
          const value = row[column]
          return {
            column,
            value,
            id: C1_ID_COLUMNS.has(column) && typeof value === 'string' && RANDOM_KEY.test(value)
              ? value
              : undefined,
          }
        }),
      })
    }
  }
  return projected
}

function randomPrefix(value: string): string {
  return value.startsWith('cl_') ? 'cl_' : value.slice(0, value.indexOf('-') + 1)
}

/** Refine identifier colours from their complete typed graph neighbourhoods. */
function graphColours(rows: readonly C1Row[]): ReadonlyMap<string, string> {
  const ids = [...new Set(rows.flatMap(({ cells }) => cells.flatMap(({ id }) => id ? [id] : [])))]
  let colours = new Map(ids.map((id) => [id, randomPrefix(id)]))
  for (let iteration = 0; iteration <= ids.length; iteration += 1) {
    const signatures = new Map<string, string>()
    for (const id of ids) {
      const occurrences: string[] = []
      for (const row of rows) {
        for (const cell of row.cells) {
          if (cell.id !== id) continue
          const encodedCells = row.cells.map((candidate) => {
            const encoded = candidate.id === id
              ? 'self'
              : candidate.id
                ? `colour${lengthPrefix(colours.get(candidate.id) ?? randomPrefix(candidate.id))}`
                : typedValue(candidate.value)
            return `${lengthPrefix(candidate.column)}${lengthPrefix(encoded)}`
          }).join('')
          occurrences.push(
            `${lengthPrefix(row.table)}${lengthPrefix(cell.column)}${lengthPrefix(encodedCells)}`,
          )
        }
      }
      signatures.set(id, `${lengthPrefix(randomPrefix(id))}${occurrences.sort().map(lengthPrefix).join('')}`)
    }
    const ranked = new Map<string, string>()
    for (const prefix of [...new Set(ids.map(randomPrefix))].sort()) {
      const unique = [...new Set(ids
        .filter((id) => randomPrefix(id) === prefix)
        .map((id) => signatures.get(id)!))].sort()
      unique.forEach((signature, index) => ranked.set(`${prefix}\0${signature}`, `${prefix}#${index + 1}`))
    }
    const next = new Map(ids.map((id) => [id, ranked.get(`${randomPrefix(id)}\0${signatures.get(id)!}`)!]))
    if (ids.every((id) => next.get(id) === colours.get(id))) return next
    colours = next
  }
  return colours
}

export interface StorageV3SelectableTargetOptions {
  /**
   * Acceptance proves a virgin store, so every never-written table must be empty.
   * A store already in owner service carries CAS revision state; only that opens.
   */
  readonly allowContinuityCasState?: boolean
}

/**
 * Every structural proof acceptance runs. Exported so the selector re-proves an
 * on-disk store with the same code path the orchestrator accepted it under.
 */
export function assertSelectableStorageV3Target(
  db: Database.Database,
  options: StorageV3SelectableTargetOptions = {},
): void {
  if (db.inTransaction) throw new Error()
  db.pragma('foreign_keys = ON')
  if (Number(db.prepare('PRAGMA foreign_keys').pluck().get()) !== 1) throw new Error()
  // A caller-owned reopen() could hand back a connection whose CHECK enforcement or
  // schema writability is disabled; reset and read back before trusting any proof below.
  // Other connection state (defer_foreign_keys, recursive_triggers, query_only) stays
  // caller-owned: only CHECK enforcement and schema writability are proven here.
  db.pragma('ignore_check_constraints = OFF')
  if (Number(db.prepare('PRAGMA ignore_check_constraints').pluck().get()) !== 0) throw new Error()
  db.pragma('writable_schema = OFF')
  if (Number(db.prepare('PRAGMA writable_schema').pluck().get()) !== 0) throw new Error()
  if (Number(db.prepare('PRAGMA application_id').pluck().get()) !== STORAGE_V3_SHADOW_APPLICATION_ID) throw new Error()
  if (Number(db.prepare('PRAGMA user_version').pluck().get()) !== STORAGE_V3_SHADOW_USER_VERSION) throw new Error()
  const tables = (db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name").pluck().all() as string[])
  if (JSON.stringify(tables) !== JSON.stringify([...STORAGE_V3_SHADOW_TABLES].sort())) throw new Error()
  // A TEMP object with a shadow-table name would shadow the main table for every
  // unqualified read below, so any owned temp-schema object refuses the target.
  if (db.prepare("SELECT 1 FROM sqlite_temp_schema WHERE name NOT GLOB 'sqlite_*' LIMIT 1").get()) throw new Error()
  if (storageV3ShadowSchemaFingerprint(db) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT) throw new Error()
  if (String(db.prepare('PRAGMA integrity_check').pluck().get()) !== 'ok') throw new Error()
  if (String(db.prepare('PRAGMA quick_check').pluck().get()) !== 'ok') throw new Error()
  if (db.prepare('PRAGMA foreign_key_check').all().length !== 0) throw new Error()
  // Delete-disposition and CAS tables: the rewrite never writes them, so any row is injected.
  const empty = options.allowContinuityCasState
    ? ['import_run', 'coverage_observation']
    : ['import_run', 'coverage_observation', 'continuity_cas_state', 'continuity_cas_operation']
  for (const table of empty) {
    if (Number(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get()) !== 0) throw new Error()
  }
}

/**
 * Produce a deterministic C1-only graph digest. Random C1 identifiers are
 * alpha-renamed from typed graph neighbourhoods; C2 aliases, IDs, hashes and
 * exact operational times never enter the digest.
 */
export function replayNormalizedShadowChecksum(db: Database.Database): string {
  const rows = c1Rows(db)
  const colours = graphColours(rows)
  const pieces: string[] = []
  for (const { table, cells } of rows) {
    const row = cells.map(({ column, value, id }) => {
      const encoded = id ? `id${lengthPrefix(colours.get(id)!)}` : typedValue(value)
      return `${lengthPrefix(column)}${lengthPrefix(encoded)}`
    }).join('')
    pieces.push(`${lengthPrefix(table)}${lengthPrefix(row)}`)
  }
  pieces.sort()
  const payload = `${lengthPrefix(C1_GRAPH_VERSION)}${pieces.map(lengthPrefix).join('')}`
  return createHash('sha256').update(payload).digest('hex')
}

const FULL_EQUIVALENCE_VERSION = 'storage-v3-full-equivalence.v1'

/**
 * Columns whose values the rewrite mints from caller entropy. Only these are
 * alpha-renamed in the equivalence digest; a retained C2 value that merely has a
 * reminted-key shape (source_job_id, source_snapshot_id, source_coverage_id, and
 * any other source-opaque token) is compared literally, so a same-shaped
 * substitution in one target still refuses acceptance.
 */
const ENTROPY_ID_COLUMNS = new Set([...C1_ID_COLUMNS, 'observation_id', 'fact_id', 'event_id'])

function fullRows(db: Database.Database): C1Row[] {
  const projected: C1Row[] = []
  for (const table of [...STORAGE_V3_SHADOW_TABLES].sort()) {
    const columns = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
      .map(({ name }) => name)
      .sort()
    const rows = db.prepare(`SELECT ${columns.join(', ')} FROM ${table}`).all() as Array<Record<string, unknown>>
    for (const row of rows) {
      projected.push({
        table,
        cells: columns.map((column) => {
          const value = row[column]
          return {
            column,
            value,
            id: ENTROPY_ID_COLUMNS.has(column) && typeof value === 'string' && RANDOM_KEY.test(value)
              ? value
              : undefined,
          }
        }),
      })
    }
  }
  return projected
}

/**
 * Digest every column of every shadow table, with the minted identity columns
 * alpha-renamed from their graph neighbourhoods and every other column compared
 * literally. Retained C2 and preserved C0 bridge values are deterministic
 * functions of the source rows, asOf and installation key, so the primary and
 * replay targets must agree exactly; a target-side corruption of any alias,
 * source-provenance, hash or exact-time column refuses acceptance. The digest
 * binds alias-shaped material and must never enter the public result or any log.
 */
function fullEquivalenceShadowChecksum(db: Database.Database): string {
  const rows = fullRows(db)
  const colours = graphColours(rows)
  const pieces: string[] = []
  for (const { table, cells } of rows) {
    const row = cells.map(({ column, value, id }) => {
      const encoded = id ? `id${lengthPrefix(colours.get(id)!)}` : typedValue(value)
      return `${lengthPrefix(column)}${lengthPrefix(encoded)}`
    }).join('')
    pieces.push(`${lengthPrefix(table)}${lengthPrefix(row)}`)
  }
  pieces.sort()
  const payload = `${lengthPrefix(FULL_EQUIVALENCE_VERSION)}${pieces.map(lengthPrefix).join('')}`
  return createHash('sha256').update(payload).digest('hex')
}

function sourceFingerprint(db: Database.Database): Buffer {
  return createHash('sha256').update(db.serialize()).digest()
}

function assertProcessInputsAbsent(
  db: Database.Database,
  identityBindings: readonly ShadowIdentityBinding[],
  installationKey: Buffer,
): void {
  const forbiddenText = new Set([
    ...identityBindings.map(({ rawProviderId }) => rawProviderId),
    installationKey.toString('hex'),
    installationKey.toString('base64'),
  ])
  for (const table of STORAGE_V3_SHADOW_TABLES) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>
    for (const row of rows) {
      for (const value of Object.values(row)) {
        if (typeof value === 'string' && forbiddenText.has(value)) throw new Error()
        if (Buffer.isBuffer(value) && value.equals(installationKey)) throw new Error()
      }
    }
  }
}

function closeDiscard(attempt: StorageV3ShadowTargetAttempt | undefined): void {
  if (!attempt) return
  try { attempt.close() } catch { /* caller owns cleanup */ }
  try { attempt.discard() } catch { /* caller owns cleanup */ }
}

/** Run two independent shadow rewrites and select only a fully proven primary. */
export function orchestrateStorageV3ShadowMigration(
  options: StorageV3ShadowMigrationOptions,
): Readonly<StorageV3ShadowMigrationResult> {
  let primary: StorageV3ShadowTargetAttempt | undefined
  let replay: StorageV3ShadowTargetAttempt | undefined
  try {
    if (!options || !options.sourceDb || !Buffer.isBuffer(options.installationKey)) throw new Error()
    const sourceBefore = sourceFingerprint(options.sourceDb)
    primary = options.targetFactory.create('primary')
    replay = options.targetFactory.create('replay')
    if (!primary || !replay || primary === replay) throw new Error()
    if (
      primary.db === replay.db
      || primary.db === options.sourceDb
      || replay.db === options.sourceDb
    ) throw new Error()
    rewriteStorageV3Shadow({
      sourceDb: options.sourceDb,
      targetDb: primary.db,
      identityBindings: options.identityBindings,
      installationKey: options.installationKey,
      asOf: options.asOf,
      randomBytes: options.primaryRandomBytes ?? cryptoRandomBytes,
      failAfterStage: (stage) => options.failAfterStage?.('primary', stage),
    })
    rewriteStorageV3Shadow({
      sourceDb: options.sourceDb,
      targetDb: replay.db,
      identityBindings: options.identityBindings,
      installationKey: options.installationKey,
      asOf: options.asOf,
      randomBytes: options.replayRandomBytes ?? cryptoRandomBytes,
      failAfterStage: (stage) => options.failAfterStage?.('replay', stage),
    })
    const closedPrimary = primary
    const closedReplay = replay
    const primaryDbBeforeReopen = primary.db
    const replayDbBeforeReopen = replay.db
    primary.close()
    replay.close()
    primary = closedPrimary.reopen()
    replay = closedReplay.reopen()
    if (
      !primary
      || !replay
      || primary === closedPrimary
      || replay === closedReplay
      || primary.db === primaryDbBeforeReopen
      || replay.db === replayDbBeforeReopen
      || primary.db === replay.db
      || primary.db === options.sourceDb
      || replay.db === options.sourceDb
    ) throw new Error()
    assertSelectableStorageV3Target(primary.db)
    assertSelectableStorageV3Target(replay.db)
    assertProcessInputsAbsent(primary.db, options.identityBindings, options.installationKey)
    assertProcessInputsAbsent(replay.db, options.identityBindings, options.installationKey)
    const checksum = replayNormalizedShadowChecksum(primary.db)
    if (checksum !== replayNormalizedShadowChecksum(replay.db)) throw new Error()
    if (fullEquivalenceShadowChecksum(primary.db) !== fullEquivalenceShadowChecksum(replay.db)) throw new Error()
    if (!sourceFingerprint(options.sourceDb).equals(sourceBefore)) throw new Error()
    replay.close()
    replay.discard()
    replay = undefined
    const result = Object.freeze({
      completeB1b: true as const,
      selectable: true as const,
      status: 'complete' as const,
      checksum,
    })
    options.targetFactory.accept(primary)
    primary = undefined
    return result
  } catch {
    if (primary?.db !== options?.sourceDb) closeDiscard(primary)
    if (replay?.db !== options?.sourceDb) closeDiscard(replay)
    throw new StorageV3ShadowMigrationError()
  }
}

// Naming aliases keep the migration boundary discoverable without adding another caller.
export const migrateStorageV3Shadow = orchestrateStorageV3ShadowMigration
export const runStorageV3ShadowMigration = orchestrateStorageV3ShadowMigration
