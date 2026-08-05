import type Database from 'better-sqlite3'
import {
  CLAIM_GRAPH_TABLE_REGISTRY,
  assertClaimGraphStorageSchema,
} from './claims.js'
import { runStorageChecks } from './database.js'
import {
  INCREMENTAL_GITHUB_CORE_TABLE_REGISTRY,
  assertIncrementalGithubCoreStorageSchema,
} from './incremental.js'

/**
 * DL-LIFE-02 slice A is deliberately limited to the two installed SQLite families below.
 * It is not a complete-product deletion API: V2, legacy tables, packs, backups, caches, and
 * indexes have no registered lifecycle adapter in this slice.
 */
export const REGISTERED_GITHUB_CORE_DELETION_TABLES = [
  ...INCREMENTAL_GITHUB_CORE_TABLE_REGISTRY,
  ...CLAIM_GRAPH_TABLE_REGISTRY,
] as const

type RegisteredDeletionTable = typeof REGISTERED_GITHUB_CORE_DELETION_TABLES[number]

export const INCOMPLETE_REGISTERED_DOMAIN_EXCLUSIONS = [
  'v2_store',
  'legacy_schema',
  'filesystem_packs',
  'backups',
  'caches',
  'indexes',
] as const

/** Existing V2 storage that is explicitly outside slice A, never silently covered. */
const EXCLUDED_DATABASE_TABLES = new Set(['coverage_observation'])

export type DeletionPlannerErrorCode =
  | 'DELETION_REGISTRY_DUPLICATE_TABLE'
  | 'DELETION_REGISTRY_UNKNOWN_TABLE'
  | 'DELETION_REGISTRY_MISSING_CAPABILITY_LINEAGE'
  | 'DELETION_REGISTRY_UNKNOWN_DEPENDENCY'
  | 'DELETION_REGISTRY_SCHEMA_DRIFT'
  | 'DELETION_REGISTRY_CYCLE'
  | 'DELETION_REGISTRY_UNREGISTERED_MANAGED_TABLE'
  | 'DELETION_REQUEST_INVALID'
  | 'DELETION_PLAN_INVALID'
  | 'DELETION_TOMBSTONE_CONFLICT'
  | 'DELETION_SCOPE_BINDING_INCOMPLETE'
  | 'DELETION_CROSS_SCOPE_DEPENDENCY'
  | 'DELETION_TRANSACTION_FAILED'

export class DeletionPlannerError extends Error {
  public readonly code: DeletionPlannerErrorCode

  constructor(code: DeletionPlannerErrorCode) {
    super(code)
    this.name = 'DeletionPlannerError'
    this.code = code
  }
}

export interface RegisteredGithubCoreDeletionRequest {
  readonly capabilityId: 'github.core'
  readonly scopeAlias: string
  /** An independently minted C1-safe token; never derive this from the C2 alias. */
  readonly tombstoneSubjectId: string
  readonly occurredAt: string
}

interface Selector {
  readonly sql: string
  readonly args: readonly string[]
}

interface PlannedDeletionStep {
  readonly tableName: string
  readonly deletionRole: RegisteredDeletionTable['deletionRole']
}

export interface RegisteredGithubCoreDeletionPlan {
  readonly capabilityId: 'github.core'
  readonly scopeAlias: string
  readonly tombstoneSubjectId: string
  readonly occurredAt: string
  readonly deletionOrder: readonly PlannedDeletionStep[]
  readonly completeProduct: false
  readonly excludedDomains: readonly (typeof INCOMPLETE_REGISTERED_DOMAIN_EXCLUSIONS)[number][]
  readonly alreadyTombstoned: boolean
  readonly registrySignature: string
}

export interface RegisteredGithubCoreDeletionResult {
  /** Static registry names only; deletion counts are intentionally never retained. */
  readonly deletedTables: readonly string[]
  readonly tombstoneWritten: boolean
  readonly alreadyTombstoned: boolean
  readonly completeProduct: false
  readonly excludedDomains: readonly (typeof INCOMPLETE_REGISTERED_DOMAIN_EXCLUSIONS)[number][]
}

interface ForeignKeyRow {
  readonly id: number
  readonly seq: number
  readonly table: string
  readonly from: string
  readonly to: string
}

interface PlannerRegistryEntry {
  readonly tableName: string
  readonly capabilityId: string
  readonly deletionRole: 'scope-root' | 'dependent' | 'lineage'
  readonly dependsOn: readonly string[]
  readonly selfReferentialForeignKeys: boolean
  readonly lineageSubjectColumn?: string
}

const OPAQUE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const TOMBSTONE_SUBJECT = /^scope_tombstone_[0-9a-f]{64}$/
const CAPABILITY_TOMBSTONE_CAUSE = 'cap_github_core'
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

function quotedIdentifier(identifier: string): string {
  if (!IDENTIFIER.test(identifier)) throw new DeletionPlannerError('DELETION_REGISTRY_SCHEMA_DRIFT')
  return `"${identifier}"`
}

function canonicalTimestamp(value: string): boolean {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
}

function registrySignature(registry: readonly PlannerRegistryEntry[]): string {
  return JSON.stringify(registry.map((entry) => ({
    tableName: entry.tableName,
    capabilityId: entry.capabilityId,
    deletionRole: entry.deletionRole,
    dependsOn: [...entry.dependsOn].sort(),
    selfReferentialForeignKeys: entry.selfReferentialForeignKeys,
    lineageSubjectColumn: entry.lineageSubjectColumn ?? null,
  })).sort((left, right) => left.tableName.localeCompare(right.tableName)))
}

function metadataMap(registry: readonly PlannerRegistryEntry[]): Map<string, PlannerRegistryEntry> {
  const entries = new Map<string, PlannerRegistryEntry>()
  for (const entry of registry) {
    if (entries.has(entry.tableName)) throw new DeletionPlannerError('DELETION_REGISTRY_DUPLICATE_TABLE')
    if (entry.capabilityId !== 'github.core') {
      throw new DeletionPlannerError('DELETION_REGISTRY_MISSING_CAPABILITY_LINEAGE')
    }
    entries.set(entry.tableName, entry)
  }
  return entries
}

function orderedDeletionEntries(registry: readonly PlannerRegistryEntry[]): readonly PlannerRegistryEntry[] {
  const entries = metadataMap(registry)
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const parentFirst: PlannerRegistryEntry[] = []

  const visit = (tableName: string): void => {
    const entry = entries.get(tableName)
    if (!entry) throw new DeletionPlannerError('DELETION_REGISTRY_UNKNOWN_TABLE')
    if (visited.has(tableName)) return
    if (visiting.has(tableName)) throw new DeletionPlannerError('DELETION_REGISTRY_CYCLE')
    visiting.add(tableName)
    for (const dependency of entry.dependsOn) {
      if (dependency === tableName) continue
      if (!entries.has(dependency)) throw new DeletionPlannerError('DELETION_REGISTRY_UNKNOWN_DEPENDENCY')
      visit(dependency)
    }
    visiting.delete(tableName)
    visited.add(tableName)
    parentFirst.push(entry)
  }

  for (const tableName of [...entries.keys()].sort()) visit(tableName)
  const lineage = parentFirst.filter((entry) => entry.deletionRole === 'lineage')
  return [...lineage, ...parentFirst.filter((entry) => entry.deletionRole !== 'lineage').reverse()]
}

function foreignKeys(db: Database.Database, tableName: string): readonly ForeignKeyRow[] {
  return db.prepare(`PRAGMA foreign_key_list(${quotedIdentifier(tableName)})`).all() as ForeignKeyRow[]
}

function tableColumns(db: Database.Database, tableName: string, schema = 'main'): readonly string[] {
  if (schema !== 'main' && schema !== 'temp') throw new DeletionPlannerError('DELETION_REGISTRY_SCHEMA_DRIFT')
  return (db.prepare(`PRAGMA ${schema}.table_info(${quotedIdentifier(tableName)})`).all() as { name: string }[])
    .map(({ name }) => name)
}

function knownTableNames(db: Database.Database, schema: 'sqlite_schema' | 'sqlite_temp_schema'): readonly string[] {
  return (db.prepare(`SELECT name FROM ${schema} WHERE type = 'table' AND name NOT GLOB 'sqlite_*'`)
    .all() as { name: string }[]).map(({ name }) => name)
}

function assertInstalledSchemas(db: Database.Database): void {
  try {
    assertIncrementalGithubCoreStorageSchema(db)
    assertClaimGraphStorageSchema(db)
  } catch {
    throw new DeletionPlannerError('DELETION_REGISTRY_SCHEMA_DRIFT')
  }
}

function assertNoUnregisteredManagedTables(
  db: Database.Database,
  registry: readonly PlannerRegistryEntry[],
): void {
  const known = new Set(registry.map(({ tableName }) => tableName))
  for (const schema of ['sqlite_schema', 'sqlite_temp_schema'] as const) {
    for (const tableName of knownTableNames(db, schema)) {
      if (known.has(tableName)) {
        if (schema === 'sqlite_temp_schema') {
          throw new DeletionPlannerError('DELETION_REGISTRY_SCHEMA_DRIFT')
        }
        continue
      }
      if (schema === 'sqlite_schema' && EXCLUDED_DATABASE_TABLES.has(tableName)) continue
      const columns = tableColumns(db, tableName, schema === 'sqlite_schema' ? 'main' : 'temp')
      if (columns.includes('capability_id') || columns.includes('scope_alias')) {
        throw new DeletionPlannerError('DELETION_REGISTRY_UNREGISTERED_MANAGED_TABLE')
      }
    }
  }
}

function assertRegistryMatchesSchema(db: Database.Database, registry: readonly PlannerRegistryEntry[]): void {
  const entries = metadataMap(registry)
  assertInstalledSchemas(db)
  assertNoUnregisteredManagedTables(db, registry)

  for (const entry of entries.values()) {
    const allForeignKeys = foreignKeys(db, entry.tableName)
    const externalParents = new Set(
      allForeignKeys.map((foreignKey) => foreignKey.table).filter((parent) => parent !== entry.tableName),
    )
    const declaredParents = new Set(entry.dependsOn)
    const hasUnknownParent = [...externalParents].some((parent) => !entries.has(parent))
    const dependencyMismatch =
      hasUnknownParent || externalParents.size !== declaredParents.size ||
      [...externalParents].some((parent) => !declaredParents.has(parent))
    const hasSelfForeignKey = allForeignKeys.some((foreignKey) => foreignKey.table === entry.tableName)
    if (dependencyMismatch || hasSelfForeignKey !== entry.selfReferentialForeignKeys) {
      throw new DeletionPlannerError('DELETION_REGISTRY_SCHEMA_DRIFT')
    }
  }
}

function buildSelectors(
  db: Database.Database,
  ordered: readonly PlannerRegistryEntry[],
  scopeAlias: string,
): ReadonlyMap<string, Selector> {
  const entries = new Map(ordered.map((entry) => [entry.tableName, entry]))
  const selectors = new Map<string, Selector>()

  const selectorFor = (tableName: string, alias: string, ancestors: ReadonlySet<string>): Selector => {
    const entry = entries.get(tableName)
    if (!entry) throw new DeletionPlannerError('DELETION_REGISTRY_UNKNOWN_TABLE')
    if (ancestors.has(tableName)) throw new DeletionPlannerError('DELETION_REGISTRY_CYCLE')
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(tableName)
    const columns = tableColumns(db, tableName)
    let selector: Selector
    if (entry.deletionRole === 'scope-root') {
      if (!columns.includes('scope_alias')) throw new DeletionPlannerError('DELETION_REGISTRY_SCHEMA_DRIFT')
      const predicates = [`${alias}."scope_alias" = ?`]
      const args = [scopeAlias]
      if (columns.includes('capability_id')) {
        predicates.push(`${alias}."capability_id" = 'github.core'`)
      }
      selector = { sql: predicates.join(' AND '), args }
    } else if (entry.deletionRole === 'dependent') {
      const clauses: string[] = []
      const args: string[] = []
      const groups = new Map<number, ForeignKeyRow[]>()
      for (const foreignKey of foreignKeys(db, tableName)) {
        if (foreignKey.table === tableName) continue
        const group = groups.get(foreignKey.id) ?? []
        group.push(foreignKey)
        groups.set(foreignKey.id, group)
      }
      for (const group of groups.values()) {
        const parentAlias = `${alias}_${group[0].table}_${group[0].id}`
        const parentSelector = selectorFor(group[0].table, parentAlias, nextAncestors)
        const joins = group.map((foreignKey) =>
          `${alias}.${quotedIdentifier(foreignKey.from)} = ${parentAlias}.${quotedIdentifier(foreignKey.to)}`,
        )
        clauses.push(`EXISTS (SELECT 1 FROM ${quotedIdentifier(group[0].table)} AS ${parentAlias} WHERE ${parentSelector.sql} AND ${joins.join(' AND ')})`)
        args.push(...parentSelector.args)
      }
      if (clauses.length === 0) throw new DeletionPlannerError('DELETION_REGISTRY_SCHEMA_DRIFT')
      selector = { sql: `(${clauses.join(' OR ')})`, args }
    } else {
      selector = { sql: '0', args: [] }
    }
    return selector
  }

  for (const entry of ordered) {
    if (entry.deletionRole !== 'lineage') {
      selectors.set(entry.tableName, selectorFor(entry.tableName, 'target', new Set()))
    }
  }
  return selectors
}

function lineageSelector(
  ordered: readonly PlannerRegistryEntry[],
  selectors: ReadonlyMap<string, Selector>,
  scopeAlias: string,
): Selector {
  const selects: string[] = []
  const args: string[] = []
  for (const entry of ordered) {
    if (!entry.lineageSubjectColumn) continue
    const selector = selectors.get(entry.tableName)
    if (!selector) continue
    const column = quotedIdentifier(entry.lineageSubjectColumn)
    selects.push(
      `SELECT ${column} AS subject_id FROM ${quotedIdentifier(entry.tableName)} AS target WHERE ${selector.sql}`,
    )
    args.push(...selector.args)
  }
  if (selects.length === 0) {
    return { sql: 'subject_id = ? OR caused_by = ?', args: [scopeAlias, scopeAlias] }
  }
  const affectedIds = selects.join(' UNION ')
  return {
    sql: `(subject_id = ? OR caused_by = ? OR subject_id IN (${affectedIds}) OR caused_by IN (${affectedIds}))`,
    args: [scopeAlias, scopeAlias, ...args, ...args],
  }
}

function validateRequest(request: RegisteredGithubCoreDeletionRequest): void {
  if (
    request.capabilityId !== 'github.core' ||
    !OPAQUE_TOKEN.test(request.scopeAlias) ||
    !TOMBSTONE_SUBJECT.test(request.tombstoneSubjectId) ||
    !canonicalTimestamp(request.occurredAt)
  ) {
    throw new DeletionPlannerError('DELETION_REQUEST_INVALID')
  }
}

function hasTombstone(db: Database.Database, request: RegisteredGithubCoreDeletionRequest): boolean {
  return db.prepare(
    "SELECT 1 FROM lineage_event WHERE subject_id = ? AND event_kind = 'tombstone_cascade' AND caused_by = ?",
  ).get(request.tombstoneSubjectId, CAPABILITY_TOMBSTONE_CAUSE) !== undefined
}

function selectorHasRows(
  db: Database.Database,
  tableName: string,
  selector: Selector,
): boolean {
  return db.prepare(
    `SELECT 1 FROM ${quotedIdentifier(tableName)} AS target WHERE ${selector.sql} LIMIT 1`,
  ).get(...selector.args) !== undefined
}

function assertClaimScopeBindingsComplete(db: Database.Database): void {
  const unboundClaim = db.prepare(`
    SELECT 1
    FROM claim_scope AS scope
    WHERE scope.scope_alias IS NULL
      AND EXISTS (SELECT 1 FROM claim WHERE claim.scope_id = scope.scope_id)
    LIMIT 1
  `).get()
  if (unboundClaim !== undefined) {
    throw new DeletionPlannerError('DELETION_SCOPE_BINDING_INCOMPLETE')
  }
}

function assertNoCrossScopeClaimDependencies(
  db: Database.Database,
  selectors: ReadonlyMap<string, Selector>,
  scopeAlias: string,
): void {
  const edgeSelector = selectors.get('claim_evidence_edge')
  if (!edgeSelector) throw new DeletionPlannerError('DELETION_PLAN_INVALID')
  const externalEdge = db.prepare(`
    SELECT 1
    FROM claim_evidence_edge AS target
    WHERE ${edgeSelector.sql}
      AND NOT EXISTS (
        SELECT 1
        FROM claim AS owner
        JOIN claim_scope AS owner_scope ON owner_scope.scope_id = owner.scope_id
        WHERE owner.claim_id = target.claim_id
          AND owner_scope.scope_alias = ?
      )
    LIMIT 1
  `).get(...edgeSelector.args, scopeAlias)
  if (externalEdge !== undefined) {
    throw new DeletionPlannerError('DELETION_CROSS_SCOPE_DEPENDENCY')
  }

  const incomingSupersession = db.prepare(`
    SELECT 1
    FROM claim AS referencing
    JOIN claim_scope AS referencing_scope ON referencing_scope.scope_id = referencing.scope_id
    WHERE referencing.superseded_by IN (
      SELECT selected.claim_id
      FROM claim AS selected
      JOIN claim_scope AS selected_scope ON selected_scope.scope_id = selected.scope_id
      WHERE selected_scope.scope_alias = ?
    )
      AND referencing_scope.scope_alias <> ?
    LIMIT 1
  `).get(scopeAlias, scopeAlias)
  if (incomingSupersession !== undefined) {
    throw new DeletionPlannerError('DELETION_CROSS_SCOPE_DEPENDENCY')
  }
}

function assertCompleteRegisteredCascade(
  db: Database.Database,
  ordered: readonly PlannerRegistryEntry[],
  selectors: ReadonlyMap<string, Selector>,
  request: RegisteredGithubCoreDeletionRequest,
): boolean {
  assertClaimScopeBindingsComplete(db)
  assertNoCrossScopeClaimDependencies(db, selectors, request.scopeAlias)
  const lineage = lineageSelector(ordered, selectors, request.scopeAlias)
  const hasAffectedRows = ordered.some((entry) => {
    if (entry.deletionRole === 'lineage') {
      return selectorHasRows(db, entry.tableName, lineage)
    }
    const selector = selectors.get(entry.tableName)
    if (!selector) throw new DeletionPlannerError('DELETION_PLAN_INVALID')
    return selectorHasRows(db, entry.tableName, selector)
  })
  const tombstoneExists = hasTombstone(db, request)
  if (tombstoneExists && hasAffectedRows) {
    throw new DeletionPlannerError('DELETION_TOMBSTONE_CONFLICT')
  }
  return tombstoneExists
}

/**
 * Read-only preflight. It validates the closed registry and reports the complete-product
 * boundary without changing data or installing missing schemas.
 */
export function planRegisteredGithubCoreDeletion(
  db: Database.Database,
  request: RegisteredGithubCoreDeletionRequest,
): RegisteredGithubCoreDeletionPlan {
  validateRequest(request)
  const registry = REGISTERED_GITHUB_CORE_DELETION_TABLES as readonly PlannerRegistryEntry[]
  const ordered = orderedDeletionEntries(registry)
  assertRegistryMatchesSchema(db, registry)
  const selectors = buildSelectors(db, ordered, request.scopeAlias)
  const alreadyTombstoned = assertCompleteRegisteredCascade(db, ordered, selectors, request)
  return {
    capabilityId: 'github.core',
    scopeAlias: request.scopeAlias,
    tombstoneSubjectId: request.tombstoneSubjectId,
    occurredAt: request.occurredAt,
    deletionOrder: ordered.map(({ tableName, deletionRole }) => ({ tableName, deletionRole })),
    completeProduct: false,
    excludedDomains: INCOMPLETE_REGISTERED_DOMAIN_EXCLUSIONS,
    alreadyTombstoned,
    registrySignature: registrySignature(registry),
  }
}

function executePlan(
  db: Database.Database,
  plan: RegisteredGithubCoreDeletionPlan,
  injectFailureAfterTable?: string,
): RegisteredGithubCoreDeletionResult {
  const request: RegisteredGithubCoreDeletionRequest = {
    capabilityId: plan.capabilityId,
    scopeAlias: plan.scopeAlias,
    tombstoneSubjectId: plan.tombstoneSubjectId,
    occurredAt: plan.occurredAt,
  }
  validateRequest(request)
  const registry = REGISTERED_GITHUB_CORE_DELETION_TABLES as readonly PlannerRegistryEntry[]
  if (plan.registrySignature !== registrySignature(registry)) {
    throw new DeletionPlannerError('DELETION_PLAN_INVALID')
  }
  const ordered = orderedDeletionEntries(registry)
  const plannedOrder = plan.deletionOrder.map(({ tableName }) => tableName)
  if (JSON.stringify(plannedOrder) !== JSON.stringify(ordered.map(({ tableName }) => tableName))) {
    throw new DeletionPlannerError('DELETION_PLAN_INVALID')
  }

  try {
    return db.transaction((): RegisteredGithubCoreDeletionResult => {
      assertRegistryMatchesSchema(db, registry)
      const selectors = buildSelectors(db, ordered, request.scopeAlias)
      if (assertCompleteRegisteredCascade(db, ordered, selectors, request)) {
        return {
          deletedTables: [],
          tombstoneWritten: false,
          alreadyTombstoned: true,
          completeProduct: false,
          excludedDomains: INCOMPLETE_REGISTERED_DOMAIN_EXCLUSIONS,
        }
      }

      const oldLineage = lineageSelector(ordered, selectors, request.scopeAlias)
      const deletedTables: string[] = []
      for (const entry of ordered) {
        if (entry.deletionRole === 'lineage') {
          db.prepare(
            `DELETE FROM ${quotedIdentifier(entry.tableName)} WHERE ${oldLineage.sql}`,
          ).run(...oldLineage.args)
        } else {
          const selector = selectors.get(entry.tableName)
          if (!selector) throw new DeletionPlannerError('DELETION_PLAN_INVALID')
          db.prepare(
            `DELETE FROM ${quotedIdentifier(entry.tableName)} AS target WHERE ${selector.sql}`,
          ).run(...selector.args)
        }
        deletedTables.push(entry.tableName)
        if (injectFailureAfterTable === entry.tableName) {
          throw new DeletionPlannerError('DELETION_TRANSACTION_FAILED')
        }
      }
      db.prepare(
        "INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, 'tombstone_cascade', ?, ?)",
      ).run(request.tombstoneSubjectId, CAPABILITY_TOMBSTONE_CAUSE, request.occurredAt)
      const checks = runStorageChecks(db)
      if (checks.integrity !== 'ok' || checks.quick !== 'ok' || checks.foreignKeys.length > 0) {
        throw new DeletionPlannerError('DELETION_TRANSACTION_FAILED')
      }
      return {
        deletedTables,
        tombstoneWritten: true,
        alreadyTombstoned: false,
        completeProduct: false,
        excludedDomains: INCOMPLETE_REGISTERED_DOMAIN_EXCLUSIONS,
      }
    })()
  } catch (error) {
    if (error instanceof DeletionPlannerError) throw error
    throw new DeletionPlannerError('DELETION_TRANSACTION_FAILED')
  }
}

/** Executes a previously inspected plan in one SQLite transaction. */
export function executeRegisteredGithubCoreDeletion(
  db: Database.Database,
  plan: RegisteredGithubCoreDeletionPlan,
): RegisteredGithubCoreDeletionResult {
  return executePlan(db, plan)
}

/** @internal Test-only seams for registry and transactional failure canaries. */
export const deletionPlannerTestSeams = {
  orderedDeletionEntries,
  validateRegistryMetadata(registry: readonly PlannerRegistryEntry[]): void {
    orderedDeletionEntries(registry)
  },
  validateRegistryAgainstSchema(db: Database.Database, registry: readonly PlannerRegistryEntry[]): void {
    assertRegistryMatchesSchema(db, registry)
  },
  executeWithFailureAfterTable(
    db: Database.Database,
    plan: RegisteredGithubCoreDeletionPlan,
    tableName: string,
  ): RegisteredGithubCoreDeletionResult {
    return executePlan(db, plan, tableName)
  },
}
