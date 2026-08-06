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

export { STORAGE_V3_SHADOW_TABLES } from './v3ShadowRewrite.js'

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

/**
 * The mint-order equivalence proof (#133): the rewrite reports every identifier it
 * created that a second run over the same source creates DIFFERENTLY (entropy-minted
 * C1 keys plus reminted claim ids), in creation order. Because both targets consume
 * the same source in the same deterministic order, position i in one run corresponds
 * to position i in the other — so the digest encodes each minted value as its mint
 * INDEX and every other cell literally. Two targets digest equally exactly when they
 * agree literally on all preserved, derived, and retained material and are related by
 * the order-bijection on minted identifiers.
 *
 * This replaces the earlier graph-colouring alpha-rename, which was super-linear in
 * identifier count and column-classified: a same-shaped substitution of a PRESERVED
 * scope id (or a consistently substituted minted id) could earn the same colour and
 * escape both digests. Here a substituted value simply is not in the mint list, is
 * encoded literally, and refuses acceptance. The digest binds alias-shaped material
 * and must never enter the public result or any log; the reported result checksum is
 * a domain-separated re-hash.
 */
const MINT_ORDER_EQUIVALENCE_VERSION = 'storage-v3-mint-order-equivalence.v1'

const lengthPrefix = (value: string): string => `${value.length}:${value}`

function mintOrderShadowDigest(
  db: Database.Database,
  mintedInOrder: readonly string[],
): string {
  const indexByValue = new Map<string, number>()
  mintedInOrder.forEach((value, index) => {
    // A duplicate mint would make the bijection ambiguous; refuse the run outright.
    if (indexByValue.has(value)) throw new Error()
    indexByValue.set(value, index)
  })
  const pieces: string[] = []
  for (const table of [...STORAGE_V3_SHADOW_TABLES].sort()) {
    const columns = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
      .map(({ name }) => name)
      .sort()
    const rows = db.prepare(`SELECT ${columns.join(', ')} FROM ${table}`).all() as Array<Record<string, unknown>>
    for (const row of rows) {
      const encoded = columns.map((column) => {
        const value = row[column]
        const index = typeof value === 'string' ? indexByValue.get(value) : undefined
        const cell = index === undefined ? typedValue(value) : `mint${lengthPrefix(String(index))}`
        return `${lengthPrefix(column)}${lengthPrefix(cell)}`
      }).join('')
      pieces.push(`${lengthPrefix(table)}${lengthPrefix(encoded)}`)
    }
  }
  pieces.sort()
  const payload = `${lengthPrefix(MINT_ORDER_EQUIVALENCE_VERSION)}${pieces.map(lengthPrefix).join('')}`
  return createHash('sha256').update(payload).digest('hex')
}

function typedValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return `string${lengthPrefix(value)}`
  if (typeof value === 'number') return `number${lengthPrefix(String(value))}`
  if (typeof value === 'bigint') return `bigint${lengthPrefix(String(value))}`
  if (Buffer.isBuffer(value)) return `bytes${lengthPrefix(value.toString('hex'))}`
  throw new Error()
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
    ? ['import_run', 'coverage_observation', 'v2_coverage_record']
    : ['import_run', 'coverage_observation', 'v2_coverage_record', 'continuity_cas_state', 'continuity_cas_operation']
  for (const table of empty) {
    if (Number(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get()) !== 0) throw new Error()
  }
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
    // The mint lists are proof material scoped to this call: collected through the
    // private channel, consumed by the digests below, never part of any result.
    const primaryMinted: string[] = []
    const replayMinted: string[] = []
    rewriteStorageV3Shadow({
      sourceDb: options.sourceDb,
      targetDb: primary.db,
      identityBindings: options.identityBindings,
      installationKey: options.installationKey,
      asOf: options.asOf,
      randomBytes: options.primaryRandomBytes ?? cryptoRandomBytes,
      failAfterStage: (stage) => options.failAfterStage?.('primary', stage),
      mintedCollector: (value) => { primaryMinted.push(value) },
    })
    rewriteStorageV3Shadow({
      sourceDb: options.sourceDb,
      targetDb: replay.db,
      identityBindings: options.identityBindings,
      installationKey: options.installationKey,
      asOf: options.asOf,
      randomBytes: options.replayRandomBytes ?? cryptoRandomBytes,
      failAfterStage: (stage) => options.failAfterStage?.('replay', stage),
      mintedCollector: (value) => { replayMinted.push(value) },
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
    // The mint-order equivalence proof: identical mint counts, then per-target
    // digests over every column of every table with minted values index-encoded.
    if (primaryMinted.length !== replayMinted.length) throw new Error()
    const digest = mintOrderShadowDigest(primary.db, primaryMinted)
    if (digest !== mintOrderShadowDigest(replay.db, replayMinted)) throw new Error()
    if (!sourceFingerprint(options.sourceDb).equals(sourceBefore)) throw new Error()
    // The digest binds alias-shaped material; the reported checksum is a
    // domain-separated re-hash that can name the run without exposing it.
    const checksum = createHash('sha256')
      .update(`${lengthPrefix('storage-v3-result.v1')}${lengthPrefix(digest)}`)
      .digest('hex')
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
