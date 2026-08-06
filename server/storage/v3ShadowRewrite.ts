import { createHash, randomBytes as cryptoRandomBytes } from 'node:crypto'
import Database from 'better-sqlite3'
import {
  CLAIM_ID_MATERIAL_VERSION,
  CanonicalTimestampSchema,
  ClaimEvidenceEdgeSchema,
  ClaimRecordSchema,
  ClaimScopeSchema,
  LimitationInstanceSchema,
  claimMayCiteLayer,
  computeClaimId,
  type ClaimEvidenceEdge,
  type ClaimRecord,
  type ClaimScope,
} from '../../shared/claims.js'
import { CoverageRecordSchema, type CoverageRecord } from '../../shared/coverage.js'
import { EvidenceLayerSchema, type EvidenceLayer } from '../../shared/provenance.js'
import {
  assertServableProvenance,
  installV2BridgeStore,
  readCoverageRecords,
  readStoreProvenance,
} from '../api/v2/store.js'
import {
  assertClaimGraphStorageSchema,
  installClaimGraphStorage,
} from './claims.js'
import { openStorageDatabase } from './database.js'
import {
  assertIncrementalGithubCoreStorageSchema,
  installIncrementalGithubCoreStorage,
} from './incremental.js'
import { createInstallationAliases } from './installationAliases.js'
import { SQLITE_APPLICATION_ID, SQLITE_USER_VERSION } from './schema.js'
import {
  installStorageV3ShadowSchema,
  STORAGE_V3_SHADOW_MIGRATED_TABLES,
  STORAGE_V3_SHADOW_RESULT,
  STORAGE_V3_SHADOW_TABLES,
} from './v3ShadowSchema.js'

export {
  STORAGE_V3_SHADOW_APPLICATION_ID,
  STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT,
  STORAGE_V3_SHADOW_TABLES,
  STORAGE_V3_SHADOW_USER_VERSION,
  storageV3ShadowSchemaFingerprint,
} from './v3ShadowSchema.js'

export type StorageV3ShadowRewriteErrorCode =
  | 'SOURCE_SCHEMA_REFUSED'
  | 'SOURCE_BRIDGE_REFUSED'
  | 'SOURCE_GRAPH_REFUSED'
  | 'TARGET_REFUSED'
  | 'IDENTITY_BINDING_UNVERIFIABLE'
  | 'IDENTITY_BINDING_MISMATCH'
  | 'IDENTITY_BINDING_AMBIGUOUS'
  | 'INVALID_TIMESTAMP'
  | 'GRAPH_REFUSED'
  | 'REWRITE_FAILED'
  | 'KEY_COLLISION'

export class StorageV3ShadowRewriteError extends Error {
  public readonly code: StorageV3ShadowRewriteErrorCode

  constructor(code: StorageV3ShadowRewriteErrorCode) {
    super(code)
    this.name = 'StorageV3ShadowRewriteError'
    this.code = code
  }
}

export interface ShadowIdentityBinding {
  readonly rawProviderId: string
}

/** Closed mutation checkpoints for the B1b-iii rollback seam. */
export const STORAGE_V3_SHADOW_REWRITE_STAGES = [
  'scopes',
  'identities',
  'bridge',
  'commitObservations',
  'pullRequestFacts',
  'datedEvents',
  'jobs',
  'snapshots',
  'coverage',
  'checkpoints',
  'evidence',
  'claims',
  'claimEdges',
  'limitations',
  'lineage',
  'finalValidation',
] as const

export type StorageV3ShadowRewriteStage = typeof STORAGE_V3_SHADOW_REWRITE_STAGES[number]

export interface StorageV3ShadowRewriteOptions {
  readonly sourceDb: Database.Database
  readonly targetDb: Database.Database
  readonly identityBindings: readonly ShadowIdentityBinding[]
  readonly installationKey: Buffer
  readonly asOf: string
  readonly randomBytes?: (size: number) => Buffer
  /** Test-only failure injection. The callback receives no source/target values. */
  readonly failAfterStage?: (stage: StorageV3ShadowRewriteStage) => void
}

export interface StorageV3ShadowRewriteResult {
  readonly completeB1b: false
  readonly selectable: false
  readonly status: 'incomplete'
  readonly schemaVersion: typeof STORAGE_V3_SHADOW_RESULT.schemaVersion
  readonly copiedScopes: number
  readonly copiedClaims: number
  readonly copiedLineageEvents: number
  readonly omittedExpiredIdentities: number
  readonly omittedUnclassifiedLineageEvents: number
  /**
   * Every identifier this run created that a second run over the same source would
   * create DIFFERENTLY, in creation order: entropy-minted C1 keys plus reminted
   * claim ids (deterministic functions of minted scope ids). Preserved source
   * identifiers and derived legacy deletion ids are deliberately absent — both
   * targets must agree on those literally. Consumed ONLY by the orchestrator's
   * equivalence proof (#133); the values are content-free C1 keys, never persisted
   * as a list, and never exposed past the migration boundary.
   */
  readonly mintedIdentifiers: readonly string[]
}

type Row = Record<string, unknown>
type Provenance = ReturnType<typeof readStoreProvenance>

interface SourceImage {
  readonly tables: Record<string, Row[]>
  readonly provenance: Provenance
  readonly bridgeCoverage: CoverageRecord[]
}

interface IdentityState {
  readonly providerId: string
  readonly analyticalKey: string
  readonly row: Row
  readonly anchor: string | undefined
  readonly expiresAt: string | undefined
  readonly eligible: boolean
  readonly existingScopeId: string | undefined
  targetScopeId: string | undefined
}

type LineageSubjectKind =
  | 'scope'
  | 'claim'
  | 'job'
  | 'snapshot'
  | 'checkpoint'
  | 'coverage'
  | 'evidence'

interface OwnedTarget {
  readonly kind: LineageSubjectKind
  readonly targetId: string
  readonly scopeId: string
}

interface SourceCoverageTarget {
  readonly coverageId: string
  readonly rangeStart: string
  readonly jobId: string
}

interface SourceEdge {
  readonly claimId: string
  readonly edge: ClaimEvidenceEdge
}

const LEGACY_TOMBSTONE_PREFIX = 'scope_tombstone_'
const LEGACY_TOMBSTONE_CAUSE = 'cap_github_core'
const DELETION_EVENT_KINDS = new Set(['tombstone_cascade', 'index_deleted'])
const RESERVED_C1_KEY = /^(?:scope-|cl_|job-|snap-|ckpt-|cov-|ev-|art-|op-|del-)[0-9a-f]{64}$/

const fail = (code: StorageV3ShadowRewriteErrorCode): never => {
  throw new StorageV3ShadowRewriteError(code)
}

const canonical = (value: unknown): value is string =>
  typeof value === 'string' && CanonicalTimestampSchema.safeParse(value).success

const parseTime = (value: unknown): string => canonical(value) ? value : fail('INVALID_TIMESTAMP')

const requiredText = (
  value: unknown,
  code: StorageV3ShadowRewriteErrorCode = 'GRAPH_REFUSED',
): string => typeof value === 'string' && value.length > 0 ? value : fail(code)

const nullableText = (value: unknown): string | null =>
  value === null || value === undefined ? null : requiredText(value)

const tableRows = (db: Database.Database, tableName: string): Row[] =>
  db.prepare(`SELECT * FROM ${tableName}`).all() as Row[]

const sourceRows = (source: SourceImage, tableName: string): Row[] => {
  const values = source.tables[tableName]
  return values ?? fail('SOURCE_SCHEMA_REFUSED')
}

const normalizeSchemaSql = (sql: string | null): string => (sql ?? '')
  .replace(/\bIF\s+NOT\s+EXISTS\b/g, '')
  .replace(/;\s*$/, '')
  .replace(/\s+/g, ' ')
  .trim()

function readSchemaCatalog(db: Database.Database, catalog = 'sqlite_schema'): string[] {
  return (db.prepare(
    `SELECT type, name, tbl_name, sql FROM ${catalog}
     WHERE name NOT GLOB 'sqlite_*'
     ORDER BY type, name`,
  ).all() as Array<{ type: string; name: string; tbl_name: string; sql: string | null }>)
    .map((row) => [row.type, row.name, row.tbl_name, normalizeSchemaSql(row.sql)].join('|'))
}

function expectedSourceCatalog(): string[] {
  const reference = openStorageDatabase(':memory:')
  try {
    installIncrementalGithubCoreStorage(reference)
    installClaimGraphStorage(reference)
    installV2BridgeStore(reference)
    return readSchemaCatalog(reference)
  } finally {
    reference.close()
  }
}

function preflightSource(db: Database.Database): void {
  try {
    const applicationId = Number(db.prepare('PRAGMA application_id').pluck().get())
    const userVersion = Number(db.prepare('PRAGMA user_version').pluck().get())
    if (applicationId !== SQLITE_APPLICATION_ID || userVersion !== SQLITE_USER_VERSION) {
      fail('SOURCE_SCHEMA_REFUSED')
    }

    const actualTables = db.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
    ).pluck().all() as string[]
    const expectedTables = [...STORAGE_V3_SHADOW_MIGRATED_TABLES].sort()
    if (JSON.stringify(actualTables) !== JSON.stringify(expectedTables)) {
      fail('SOURCE_SCHEMA_REFUSED')
    }
    if (readSchemaCatalog(db, 'sqlite_temp_schema').length > 0) {
      fail('SOURCE_SCHEMA_REFUSED')
    }

    assertIncrementalGithubCoreStorageSchema(db)
    assertClaimGraphStorageSchema(db)
    if (JSON.stringify(readSchemaCatalog(db)) !== JSON.stringify(expectedSourceCatalog())) {
      fail('SOURCE_SCHEMA_REFUSED')
    }
  } catch (error) {
    if (error instanceof StorageV3ShadowRewriteError) throw error
    fail('SOURCE_SCHEMA_REFUSED')
  }
}

function readSourceImage(db: Database.Database): SourceImage {
  try {
    return db.transaction((): SourceImage => {
      preflightSource(db)
      let provenance: Provenance
      let bridgeCoverage: CoverageRecord[]
      try {
        provenance = readStoreProvenance(db)
        assertServableProvenance(provenance)
        bridgeCoverage = readCoverageRecords(db)
      } catch {
        return fail('SOURCE_BRIDGE_REFUSED')
      }

      const tables: Record<string, Row[]> = {}
      for (const tableName of STORAGE_V3_SHADOW_MIGRATED_TABLES) {
        tables[tableName] = tableRows(db, tableName)
      }
      return { tables, provenance, bridgeCoverage }
    })()
  } catch (error) {
    if (error instanceof StorageV3ShadowRewriteError) throw error
    return fail('SOURCE_SCHEMA_REFUSED')
  }
}

function preflightTarget(db: Database.Database): void {
  try {
    installStorageV3ShadowSchema(db)
    for (const tableName of STORAGE_V3_SHADOW_TABLES) {
      if (Number(db.prepare(`SELECT COUNT(*) FROM ${tableName}`).pluck().get()) !== 0) {
        fail('TARGET_REFUSED')
      }
    }
  } catch (error) {
    if (error instanceof StorageV3ShadowRewriteError) throw error
    fail('TARGET_REFUSED')
  }
}

/** Add exact UTC calendar months, clamping the day and refusing a non-canonical overflow. */
export function addUtcMonthsClamped(timestamp: string, months = 13): string {
  const parsed = parseTime(timestamp)
  if (!Number.isInteger(months) || months < 0) fail('INVALID_TIMESTAMP')
  const date = new Date(parsed)
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + months
  const year = Math.floor(totalMonths / 12)
  const month = totalMonths % 12
  if (year < 0 || year > 9999) fail('INVALID_TIMESTAMP')

  const lastDay = new Date(0)
  lastDay.setUTCHours(0, 0, 0, 0)
  lastDay.setUTCFullYear(year, month + 1, 0)
  const day = Math.min(date.getUTCDate(), lastDay.getUTCDate())

  const result = new Date(0)
  result.setUTCHours(
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  )
  result.setUTCFullYear(year, month, day)
  return parseTime(result.toISOString())
}

export function isoWeekFromCanonicalTimestamp(timestamp: string): string {
  const date = new Date(parseTime(timestamp))
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const isoYear = date.getUTCFullYear()
  const yearStart = new Date(0)
  yearStart.setUTCHours(0, 0, 0, 0)
  yearStart.setUTCFullYear(isoYear, 0, 1)
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)
  return `${String(isoYear).padStart(4, '0')}-W${String(week).padStart(2, '0')}`
}

function mint(
  prefix: string,
  used: Set<string>,
  entropy: (size: number) => Buffer,
): string {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const bytes = entropy(32)
    if (!Buffer.isBuffer(bytes) || bytes.length !== 32) fail('KEY_COLLISION')
    const value = `${prefix}${bytes.toString('hex')}`
    if (!used.has(value)) {
      used.add(value)
      return value
    }
  }
  return fail('KEY_COLLISION')
}

function coverageKey(target: SourceCoverageTarget): string {
  return [target.coverageId, target.rangeStart, target.jobId].join('\0')
}

function parseIncrementalCoverage(row: Row): CoverageRecord {
  const retryable = row.retryable === 0 ? false : row.retryable === 1 ? true : fail('GRAPH_REFUSED')
  const rangeStart = parseTime(row.range_start)
  const rangeEnd = parseTime(row.range_end)
  const observedAt = parseTime(row.observed_at)
  const parsed = CoverageRecordSchema.safeParse({
    coverageId: row.coverage_id,
    capabilityId: row.capability_id,
    scopeAlias: row.scope_alias,
    rangeStart,
    rangeEnd,
    status: row.status,
    expectedUnits: row.expected_units,
    observedUnits: row.observed_units,
    omittedUnits: row.omitted_units,
    saturationReason: row.saturation_reason ?? undefined,
    retryable,
    observedAt,
    limitationCode: row.limitation_code,
  })
  return parsed.success ? parsed.data : fail('GRAPH_REFUSED')
}

function parseClaim(row: Row): ClaimRecord {
  const parsed = ClaimRecordSchema.safeParse({
    claimId: row.claim_id,
    layer: row.layer,
    statementCode: row.statement_code,
    methodId: row.method_id,
    methodVersion: row.method_version,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    scopeId: row.scope_id,
    schemaVersion: row.schema_version,
    claimIdMaterialVersion: row.claim_id_material_version,
    createdAt: row.created_at,
    supersededBy: row.superseded_by,
  })
  if (!parsed.success || parsed.data.claimIdMaterialVersion !== CLAIM_ID_MATERIAL_VERSION) {
    return fail('GRAPH_REFUSED')
  }
  return parsed.data
}

function parseSourceEdge(row: Row): SourceEdge {
  const claimId = requiredText(row.claim_id)
  let candidate: unknown
  if (row.target_evidence_id !== null && row.target_evidence_id !== undefined) {
    candidate = { role: row.role, targetEvidenceId: row.target_evidence_id }
  } else if (row.target_claim_id !== null && row.target_claim_id !== undefined) {
    candidate = { role: row.role, targetClaimId: row.target_claim_id }
  } else if (row.target_coverage_id !== null && row.target_coverage_id !== undefined) {
    candidate = {
      role: row.role,
      targetCoverage: {
        coverageId: row.target_coverage_id,
        rangeStart: row.target_coverage_range_start,
        jobId: row.target_coverage_job_id,
      },
    }
  } else {
    return fail('GRAPH_REFUSED')
  }
  const parsed = ClaimEvidenceEdgeSchema.safeParse(candidate)
  return parsed.success ? { claimId, edge: parsed.data } : fail('GRAPH_REFUSED')
}

function claimV3Id(claim: ClaimRecord, scopeId: string, basisTokens: readonly string[]): string {
  const basis = [...new Set(basisTokens)].sort()
  if (basis.length === 0) fail('GRAPH_REFUSED')
  const material = [
    'claim-id.v3',
    claim.layer,
    claim.statementCode,
    claim.methodId,
    claim.methodVersion,
    claim.windowStart,
    claim.windowEnd,
    scopeId,
    claim.schemaVersion,
    basis.join(','),
  ].join('\n')
  return `cl_${createHash('sha256').update(material, 'utf8').digest('hex')}`
}

function sameSupersessionSeries(claim: ClaimRecord, successor: ClaimRecord): boolean {
  return claim.layer === successor.layer
    && claim.statementCode === successor.statementCode
    && claim.methodId === successor.methodId
    && claim.methodVersion === successor.methodVersion
    && claim.windowStart === successor.windowStart
    && claim.windowEnd === successor.windowEnd
    && claim.scopeId === successor.scopeId
    && claim.schemaVersion === successor.schemaVersion
}

function validateSupersession(claims: Map<string, ClaimRecord>): void {
  for (const claim of claims.values()) {
    if (claim.supersededBy === null) continue
    const successor = claims.get(claim.supersededBy)
    if (!successor || !sameSupersessionSeries(claim, successor)) fail('GRAPH_REFUSED')
  }

  const state = new Map<string, 'visiting' | 'complete'>()
  const visit = (claimId: string): void => {
    const current = state.get(claimId)
    if (current === 'visiting') fail('GRAPH_REFUSED')
    if (current === 'complete') return
    state.set(claimId, 'visiting')
    const successor = claims.get(claimId)?.supersededBy
    if (successor !== null && successor !== undefined) visit(successor)
    state.set(claimId, 'complete')
  }
  for (const claimId of claims.keys()) visit(claimId)
  state.clear()
}

function addOwnership(
  ownership: Map<string, OwnedTarget[]>,
  sourceId: string,
  target: OwnedTarget,
): void {
  const entries = ownership.get(sourceId) ?? []
  if (!entries.some((entry) =>
    entry.kind === target.kind
    && entry.targetId === target.targetId
    && entry.scopeId === target.scopeId)) {
    entries.push(target)
  }
  ownership.set(sourceId, entries)
}

function resolveOwnership(
  ownership: Map<string, OwnedTarget[]>,
  sourceId: string,
): OwnedTarget | undefined {
  const entries = ownership.get(sourceId)
  if (!entries || entries.length === 0) {
    if (RESERVED_C1_KEY.test(sourceId)) fail('GRAPH_REFUSED')
    return undefined
  }
  if (entries.length !== 1) fail('GRAPH_REFUSED')
  return entries[0]
}

function clearSourceImage(source: SourceImage | undefined): void {
  if (!source) return
  for (const values of Object.values(source.tables)) values.length = 0
  source.bridgeCoverage.length = 0
}

export function rewriteStorageV3Shadow(
  options: StorageV3ShadowRewriteOptions,
): StorageV3ShadowRewriteResult {
  const transient: Array<{ clear(): void }> = []
  const track = <T extends { clear(): void }>(value: T): T => {
    transient.push(value)
    return value
  }
  let source: SourceImage | undefined
  let aliases: ReturnType<typeof createInstallationAliases> | undefined

  try {
    if (
      !options
      || options.sourceDb === options.targetDb
      || !Buffer.isBuffer(options.installationKey)
      || !Array.isArray(options.identityBindings)
    ) {
      fail('TARGET_REFUSED')
    }
    const asOf = parseTime(options.asOf)
    source = readSourceImage(options.sourceDb)
    const sourceImage = source
    preflightTarget(options.targetDb)

    const entropy = options.randomBytes ?? cryptoRandomBytes
    const sourceScopeById = track(new Map<string, ClaimScope>())
    const sourceScopeByAlias = track(new Map<string, ClaimScope>())
    for (const row of sourceRows(sourceImage, 'claim_scope')) {
      const parsed = ClaimScopeSchema.safeParse({
        scopeId: row.scope_id,
        scopeAlias: row.scope_alias,
        linkedAt: row.linked_at,
      })
      if (!parsed.success) fail('SOURCE_GRAPH_REFUSED')
      const scope = parsed.data!
      if (sourceScopeById.has(scope.scopeId)) fail('SOURCE_GRAPH_REFUSED')
      sourceScopeById.set(scope.scopeId, scope)
      if (scope.scopeAlias !== null) {
        if (sourceScopeByAlias.has(scope.scopeAlias)) fail('IDENTITY_BINDING_AMBIGUOUS')
        sourceScopeByAlias.set(scope.scopeAlias, scope)
      }
    }
    const identityStates = track(new Map<string, IdentityState>())
    const identitiesByAnalyticalKey = track(new Map<string, Row>())
    for (const row of sourceRows(sourceImage, 'repository_identity')) {
      const providerId = requiredText(row.provider_id, 'SOURCE_SCHEMA_REFUSED')
      const analyticalKey = requiredText(row.analytical_key, 'SOURCE_SCHEMA_REFUSED')
      if (identityStates.has(providerId) || identitiesByAnalyticalKey.has(analyticalKey)) {
        fail('IDENTITY_BINDING_AMBIGUOUS')
      }
      identitiesByAnalyticalKey.set(analyticalKey, row)
      identityStates.set(providerId, {
        providerId,
        analyticalKey,
        row,
        anchor: undefined,
        expiresAt: undefined,
        eligible: false,
        existingScopeId: sourceScopeByAlias.get(providerId)?.scopeId,
        targetScopeId: undefined,
      })
    }
    for (const scope of sourceScopeById.values()) {
      if (scope.scopeAlias !== null && identitiesByAnalyticalKey.has(scope.scopeAlias)) {
        // Scope continuity is provider-domain only. An analytical-domain match is a
        // conflicting binding, never a reason to split the repository into a new series.
        fail('IDENTITY_BINDING_MISMATCH')
      }
    }

    const anchors = track(new Map<string, string[]>())
    const addAnchor = (providerId: unknown, value: unknown): void => {
      const provider = requiredText(providerId, 'SOURCE_SCHEMA_REFUSED')
      if (!identityStates.has(provider)) fail('SOURCE_SCHEMA_REFUSED')
      const values = anchors.get(provider) ?? []
      values.push(parseTime(value))
      anchors.set(provider, values)
    }
    for (const row of sourceRows(sourceImage, 'commit_observation')) {
      addAnchor(row.repository_provider_id, row.occurred_at)
    }
    for (const row of sourceRows(sourceImage, 'pull_request_fact')) {
      addAnchor(row.repository_provider_id, row.created_at)
      if (row.merged_at !== null && row.merged_at !== undefined) {
        addAnchor(row.repository_provider_id, row.merged_at)
      }
      if (row.closed_at !== null && row.closed_at !== undefined) {
        addAnchor(row.repository_provider_id, row.closed_at)
      }
    }
    for (const row of sourceRows(sourceImage, 'dated_event_observation')) {
      addAnchor(row.repository_provider_id, row.occurred_at)
    }
    for (const [providerId, state] of identityStates) {
      const anchor = (anchors.get(providerId) ?? []).sort().at(-1)
      const expiresAt = anchor === undefined ? undefined : addUtcMonthsClamped(anchor)
      identityStates.set(providerId, {
        ...state,
        anchor,
        expiresAt,
        eligible: expiresAt !== undefined && asOf < expiresAt,
      })
    }

    try {
      aliases = createInstallationAliases(options.installationKey)
    } catch {
      fail('IDENTITY_BINDING_UNVERIFIABLE')
    }
    const aliasFunctions = aliases ?? fail('IDENTITY_BINDING_UNVERIFIABLE')
    const rawBindings = track(new Set<string>())
    const computedProviders = track(new Set<string>())
    const computedAnalyticalKeys = track(new Set<string>())
    const providedProviders = track(new Set<string>())
    for (const binding of options.identityBindings) {
      if (
        !binding
        || typeof binding.rawProviderId !== 'string'
        || binding.rawProviderId.length === 0
        || rawBindings.has(binding.rawProviderId)
      ) {
        fail('IDENTITY_BINDING_AMBIGUOUS')
      }
      rawBindings.add(binding.rawProviderId)
      const providerId = aliasFunctions.repositoryProviderId(binding.rawProviderId)
      const analyticalKey = aliasFunctions.repositoryAnalyticalKey(binding.rawProviderId)
      if (computedProviders.has(providerId) || computedAnalyticalKeys.has(analyticalKey)) {
        fail('IDENTITY_BINDING_AMBIGUOUS')
      }
      computedProviders.add(providerId)
      computedAnalyticalKeys.add(analyticalKey)
      const state = identityStates.get(providerId)
      if (!state && identitiesByAnalyticalKey.has(analyticalKey)) fail('IDENTITY_BINDING_MISMATCH')
      const verifiedState = state ?? fail('IDENTITY_BINDING_AMBIGUOUS')
      if (verifiedState.analyticalKey !== analyticalKey) fail('IDENTITY_BINDING_MISMATCH')
      if (!verifiedState.eligible) fail('IDENTITY_BINDING_AMBIGUOUS')
      providedProviders.add(providerId)
    }
    for (const state of identityStates.values()) {
      if (state.eligible && !providedProviders.has(state.providerId)) {
        fail('IDENTITY_BINDING_UNVERIFIABLE')
      }
    }

    const scopeMap = track(new Map<string, string>())
    const jobMap = track(new Map<string, OwnedTarget>())
    const snapshotMap = track(new Map<string, OwnedTarget>())
    const checkpointMap = track(new Map<string, OwnedTarget>())
    const coverageMap = track(new Map<string, OwnedTarget>())
    const evidenceMap = track(new Map<string, OwnedTarget>())
    const claimMap = track(new Map<string, OwnedTarget>())
    const ownership = track(new Map<string, OwnedTarget[]>())
    const usedScopes = track(new Set(sourceScopeById.keys()))
    const usedKeys = track(new Set<string>())
    const newClaimOwners = track(new Map<string, string>())
    const sourceJobs = track(new Map<string, Row>())
    const sourceSnapshotCountByJob = track(new Map<string, number>())
    const sourceCoverageCountByJob = track(new Map<string, number>())
    const omittedJobs = track(new Map<string, string>())
    const omittedSnapshots = track(new Map<string, string>())
    const omittedCheckpoints = track(new Set<string>())
    const omittedCoverage = track(new Map<string, string>())
    const omittedEvidence = track(new Set<string>())
    const evidenceLayers = track(new Map<string, EvidenceLayer>())
    const claimsById = track(new Map<string, ClaimRecord>())
    const sourceEdges = track(new Map<string, SourceEdge[]>())
    const seenLineageRows = track(new Set<string>())
    const deletionEvents = track(new Map<string, string>())
    const legacyEvents = track(new Map<string, string>())

    let copiedScopes = 0
    let copiedClaims = 0
    let copiedLineageEvents = 0
    let omittedExpiredIdentities = 0
    let omittedUnclassifiedLineageEvents = 0
    const mintedInOrder: string[] = []

    options.targetDb.transaction(() => {
      const checkpoint = (stage: StorageV3ShadowRewriteStage): void => {
        try {
          options.failAfterStage?.(stage)
        } catch {
          // Failure injection is deliberately opaque and always aborts the target transaction.
          fail('REWRITE_FAILED')
        }
      }
      const recordMinted = (value: string): string => {
        mintedInOrder.push(value)
        return value
      }
      const mintId = (prefix: string): string => recordMinted(mint(prefix, usedKeys, entropy))
      const targetScopeForAlias = (scopeAlias: unknown): string | undefined => {
        const alias = requiredText(scopeAlias)
        const sourceScope = sourceScopeByAlias.get(alias)
        if (sourceScope) return scopeMap.get(sourceScope.scopeId) ?? fail('GRAPH_REFUSED')
        const state = identityStates.get(alias) ?? fail('GRAPH_REFUSED')
        if (!state.eligible) return undefined
        return state.targetScopeId ?? fail('GRAPH_REFUSED')
      }
      const retainAuthenticatedC2 = (scopeAlias: string, expiresAt: string): boolean =>
        asOf < expiresAt && identityStates.get(scopeAlias)?.eligible === true

      for (const scope of sourceScopeById.values()) {
        scopeMap.set(scope.scopeId, scope.scopeId)
        addOwnership(ownership, scope.scopeId, {
          kind: 'scope',
          targetId: scope.scopeId,
          scopeId: scope.scopeId,
        })
      }
      for (const state of identityStates.values()) {
        if (state.existingScopeId !== undefined) state.targetScopeId = state.existingScopeId
        else if (state.eligible) state.targetScopeId = recordMinted(mint('scope-', usedScopes, entropy))
      }

      const insertScope = options.targetDb.prepare(
        'INSERT INTO claim_scope (scope_id, scope_alias, linked_at, alias_expires_at) VALUES (?, ?, ?, ?)',
      )
      for (const scope of sourceScopeById.values()) {
        const state = scope.scopeAlias === null ? undefined : identityStates.get(scope.scopeAlias)
        const aliasExpiresAt = addUtcMonthsClamped(scope.linkedAt)
        const retainAlias = state?.eligible === true && asOf < aliasExpiresAt
        insertScope.run(
          scope.scopeId,
          retainAlias ? scope.scopeAlias : null,
          retainAlias ? scope.linkedAt : null,
          retainAlias ? aliasExpiresAt : null,
        )
        copiedScopes += 1
      }
      checkpoint('scopes')
      for (const state of identityStates.values()) {
        if (!state.eligible || state.existingScopeId !== undefined) continue
        if (!state.targetScopeId || !state.anchor || !state.expiresAt) fail('GRAPH_REFUSED')
        insertScope.run(
          state.targetScopeId,
          state.providerId,
          state.anchor,
          state.expiresAt,
        )
        copiedScopes += 1
      }

      const insertIdentity = options.targetDb.prepare(
        `INSERT INTO repository_identity (
          scope_id, provider_id, analytical_key, identity_expires_at,
          is_private, is_archived, is_fork
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const state of identityStates.values()) {
        if (!state.eligible) {
          omittedExpiredIdentities += 1
          if (state.targetScopeId === undefined) continue
          insertIdentity.run(
            state.targetScopeId,
            null,
            null,
            null,
            state.row.is_private,
            state.row.is_archived,
            state.row.is_fork,
          )
          continue
        }
        if (!state.targetScopeId || !state.expiresAt) fail('GRAPH_REFUSED')
        insertIdentity.run(
          state.targetScopeId,
          state.providerId,
          state.analyticalKey,
          state.expiresAt,
          state.row.is_private,
          state.row.is_archived,
          state.row.is_fork,
        )
      }
      checkpoint('identities')

      if (sourceImage.provenance.syntheticMarker === null) fail('SOURCE_BRIDGE_REFUSED')
      options.targetDb.prepare(
        `INSERT INTO v2_store_provenance (
          singleton, mode, synthetic_marker, importer_version, created_at
        ) VALUES (1, ?, ?, ?, ?)`,
      ).run(
        sourceImage.provenance.mode,
        sourceImage.provenance.syntheticMarker,
        sourceImage.provenance.importerVersion,
        sourceImage.provenance.createdAt,
      )
      // v2_coverage_record is delete-disposition since B3: the v2 reader refuses v3
      // stores by application_id/user_version, so a preserved copy could never be
      // read, while its verbatim scope_alias would carry C2 into a store whose
      // coverage truth is coverage_ledger. The SOURCE rows were still read and
      // contract-validated above (sourceImage.bridgeCoverage) — an unreadable or
      // provenance-less bridge still refuses migration; its rows are simply not
      // copied, and acceptance asserts the target table stays empty.
      checkpoint('bridge')

      const insertCommit = options.targetDb.prepare(
        `INSERT INTO commit_observation (
          scope_id, observation_id, sha, occurred_at, source, c2_expires_at,
          additions, deletions, files, parent_count, feature_type, is_revert,
          is_fixup, message_length
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const row of sourceRows(sourceImage, 'commit_observation')) {
        const providerId = requiredText(row.repository_provider_id)
        const state = identityStates.get(providerId) ?? fail('GRAPH_REFUSED')
        const occurredAt = parseTime(row.occurred_at)
        const expiresAt = addUtcMonthsClamped(occurredAt)
        const live = asOf < expiresAt
        if (live && !state.eligible) fail('IDENTITY_BINDING_UNVERIFIABLE')
        if (!state.targetScopeId) {
          if (live) fail('GRAPH_REFUSED')
          continue
        }
        insertCommit.run(
          state.targetScopeId,
          mintId('obs-'),
          live ? row.sha : null,
          live ? occurredAt : null,
          live ? row.source : null,
          live ? expiresAt : null,
          row.additions,
          row.deletions,
          row.files,
          row.parent_count,
          row.feature_type,
          row.is_revert,
          row.is_fixup,
          row.message_length,
        )
      }
      checkpoint('commitObservations')

      const insertPullRequest = options.targetDb.prepare(
        `INSERT INTO pull_request_fact (
          scope_id, fact_id, number, created_at, merged_at, closed_at, c2_expires_at,
          state, is_draft, additions, deletions, changed_files, comments, reviews
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const row of sourceRows(sourceImage, 'pull_request_fact')) {
        const providerId = requiredText(row.repository_provider_id)
        const state = identityStates.get(providerId) ?? fail('GRAPH_REFUSED')
        const timestamps = [
          parseTime(row.created_at),
          ...(row.merged_at === null || row.merged_at === undefined ? [] : [parseTime(row.merged_at)]),
          ...(row.closed_at === null || row.closed_at === undefined ? [] : [parseTime(row.closed_at)]),
        ].sort()
        const expiresAt = addUtcMonthsClamped(timestamps.at(-1)!)
        const live = asOf < expiresAt
        if (live && !state.eligible) fail('IDENTITY_BINDING_UNVERIFIABLE')
        if (!state.targetScopeId) {
          if (live) fail('GRAPH_REFUSED')
          continue
        }
        insertPullRequest.run(
          state.targetScopeId,
          mintId('pr-'),
          live ? row.number : null,
          live ? row.created_at : null,
          live ? row.merged_at : null,
          live ? row.closed_at : null,
          live ? expiresAt : null,
          row.state,
          row.is_draft,
          row.additions,
          row.deletions,
          row.changed_files,
          row.comments,
          row.reviews,
        )
      }
      checkpoint('pullRequestFacts')

      const insertDatedEvent = options.targetDb.prepare(
        `INSERT INTO dated_event_observation (
          scope_id, event_id, occurred_at, c2_expires_at, event_kind
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      for (const row of sourceRows(sourceImage, 'dated_event_observation')) {
        const providerId = requiredText(row.repository_provider_id)
        const state = identityStates.get(providerId) ?? fail('GRAPH_REFUSED')
        const occurredAt = parseTime(row.occurred_at)
        const expiresAt = addUtcMonthsClamped(occurredAt)
        const live = asOf < expiresAt
        if (live && !state.eligible) fail('IDENTITY_BINDING_UNVERIFIABLE')
        if (!state.targetScopeId) {
          if (live) fail('GRAPH_REFUSED')
          continue
        }
        insertDatedEvent.run(
          state.targetScopeId,
          mintId('event-'),
          live ? occurredAt : null,
          live ? expiresAt : null,
          row.event_kind,
        )
      }
      checkpoint('datedEvents')

      const insertJob = options.targetDb.prepare(
        `INSERT INTO collection_job (
          scope_id, job_id, capability_id, storage_contract_version, query_version,
          source_api_version, consent_revision, status, source_job_id, payload_hash,
          range_start, range_end, observed_at, started_at, completed_at, c2_expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const row of sourceRows(sourceImage, 'collection_job')) {
        const oldJobId = requiredText(row.job_id)
        if (sourceJobs.has(oldJobId)) fail('GRAPH_REFUSED')
        sourceJobs.set(oldJobId, row)
        const scopeAlias = requiredText(row.scope_alias)
        const targetScopeId = targetScopeForAlias(scopeAlias)
        const rangeStart = parseTime(row.range_start)
        const rangeEnd = parseTime(row.range_end)
        const observedAt = parseTime(row.observed_at)
        const startedAt = parseTime(row.started_at)
        const completedAt = parseTime(row.completed_at)
        if (rangeStart >= rangeEnd || startedAt > completedAt) fail('GRAPH_REFUSED')
        if (targetScopeId === undefined) {
          omittedJobs.set(oldJobId, scopeAlias)
          continue
        }
        const expiresAt = addUtcMonthsClamped(completedAt)
        const live = retainAuthenticatedC2(scopeAlias, expiresAt)
        const targetId = mintId('job-')
        const owner = { kind: 'job', targetId, scopeId: targetScopeId } as const
        jobMap.set(oldJobId, owner)
        addOwnership(ownership, oldJobId, owner)
        insertJob.run(
          targetScopeId,
          targetId,
          row.capability_id,
          row.storage_contract_version,
          row.query_version,
          row.source_api_version,
          row.consent_revision,
          row.status,
          live ? oldJobId : null,
          live ? row.payload_hash : null,
          live ? rangeStart : null,
          live ? rangeEnd : null,
          live ? observedAt : null,
          live ? startedAt : null,
          live ? completedAt : null,
          live ? expiresAt : null,
        )
      }
      checkpoint('jobs')

      const insertSnapshot = options.targetDb.prepare(
        `INSERT INTO source_snapshot (
          scope_id, snapshot_id, job_id, capability_id, source_snapshot_id,
          snapshot_hash, range_start, range_end, observed_at, c2_expires_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'closed')`,
      )
      for (const row of sourceRows(sourceImage, 'source_snapshot')) {
        const oldSnapshotId = requiredText(row.snapshot_id)
        if (snapshotMap.has(oldSnapshotId) || omittedSnapshots.has(oldSnapshotId)) fail('GRAPH_REFUSED')
        const scopeAlias = requiredText(row.scope_alias)
        const targetScopeId = targetScopeForAlias(scopeAlias)
        const oldJobId = requiredText(row.job_id)
        sourceSnapshotCountByJob.set(oldJobId, (sourceSnapshotCountByJob.get(oldJobId) ?? 0) + 1)
        const rangeStart = parseTime(row.range_start)
        const rangeEnd = parseTime(row.range_end)
        const observedAt = parseTime(row.observed_at)
        if (rangeStart >= rangeEnd) fail('GRAPH_REFUSED')
        if (targetScopeId === undefined) {
          if (omittedJobs.get(oldJobId) !== scopeAlias) fail('GRAPH_REFUSED')
          omittedSnapshots.set(oldSnapshotId, scopeAlias)
          continue
        }
        const job = jobMap.get(oldJobId) ?? fail('GRAPH_REFUSED')
        if (job.scopeId !== targetScopeId) fail('GRAPH_REFUSED')
        const expiresAt = addUtcMonthsClamped(observedAt)
        const live = retainAuthenticatedC2(scopeAlias, expiresAt)
        const targetId = mintId('snap-')
        const owner = { kind: 'snapshot', targetId, scopeId: targetScopeId } as const
        snapshotMap.set(oldSnapshotId, owner)
        addOwnership(ownership, oldSnapshotId, owner)
        insertSnapshot.run(
          targetScopeId,
          targetId,
          job.targetId,
          row.capability_id,
          live ? oldSnapshotId : null,
          live ? row.snapshot_hash : null,
          live ? rangeStart : null,
          live ? rangeEnd : null,
          live ? observedAt : null,
          live ? expiresAt : null,
        )
      }
      checkpoint('snapshots')

      const insertCoverage = options.targetDb.prepare(
        `INSERT INTO coverage_ledger (
          scope_id, coverage_id, job_id, snapshot_id, capability_id, status,
          expected_units, observed_units, omitted_units, saturation_reason, retryable,
          limitation_code, source_coverage_id, range_start, range_end, observed_at,
          c2_expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const row of sourceRows(sourceImage, 'coverage_ledger')) {
        const record = parseIncrementalCoverage(row)
        const targetScopeId = targetScopeForAlias(record.scopeAlias)
        const oldJobId = requiredText(row.job_id)
        sourceCoverageCountByJob.set(oldJobId, (sourceCoverageCountByJob.get(oldJobId) ?? 0) + 1)
        const oldSnapshotId = row.snapshot_id === null || row.snapshot_id === undefined
          ? undefined
          : requiredText(row.snapshot_id)
        const sourceTarget = {
          coverageId: record.coverageId,
          rangeStart: record.rangeStart,
          jobId: oldJobId,
        }
        const key = coverageKey(sourceTarget)
        if (coverageMap.has(key) || omittedCoverage.has(key)) fail('GRAPH_REFUSED')
        if (targetScopeId === undefined) {
          if (omittedJobs.get(oldJobId) !== record.scopeAlias) fail('GRAPH_REFUSED')
          if ((record.status === 'complete') !== (oldSnapshotId !== undefined)) fail('GRAPH_REFUSED')
          if (oldSnapshotId !== undefined && omittedSnapshots.get(oldSnapshotId) !== record.scopeAlias) {
            fail('GRAPH_REFUSED')
          }
          omittedCoverage.set(key, record.scopeAlias)
          continue
        }
        const targetJob = jobMap.get(oldJobId) ?? fail('GRAPH_REFUSED')
        if (targetJob.scopeId !== targetScopeId) fail('GRAPH_REFUSED')
        const snapshot = oldSnapshotId === undefined ? undefined : snapshotMap.get(oldSnapshotId)
        if ((record.status === 'complete') !== (snapshot !== undefined)) fail('GRAPH_REFUSED')
        if (snapshot && snapshot.scopeId !== targetScopeId) fail('GRAPH_REFUSED')
        const expiresAt = addUtcMonthsClamped(record.observedAt)
        const live = retainAuthenticatedC2(record.scopeAlias, expiresAt)
        const targetId = mintId('cov-')
        const owner = { kind: 'coverage', targetId, scopeId: targetScopeId } as const
        coverageMap.set(key, owner)
        addOwnership(ownership, record.coverageId, owner)
        insertCoverage.run(
          targetScopeId,
          targetId,
          targetJob.targetId,
          snapshot?.targetId ?? null,
          record.capabilityId,
          record.status,
          record.expectedUnits,
          record.observedUnits,
          record.omittedUnits,
          record.saturationReason ?? null,
          record.retryable ? 1 : 0,
          record.limitationCode,
          live ? record.coverageId : null,
          live ? record.rangeStart : null,
          live ? record.rangeEnd : null,
          live ? record.observedAt : null,
          live ? expiresAt : null,
        )
      }
      checkpoint('coverage')

      for (const [oldJobId, row] of sourceJobs) {
        const expectedSnapshots = row.status === 'complete' ? 1 : 0
        if (
          sourceCoverageCountByJob.get(oldJobId) !== 1
          || (sourceSnapshotCountByJob.get(oldJobId) ?? 0) !== expectedSnapshots
        ) {
          fail('GRAPH_REFUSED')
        }
      }

      const insertCheckpoint = options.targetDb.prepare(
        `INSERT INTO collection_checkpoint (
          scope_id, checkpoint_id, job_id, snapshot_id, capability_id, query_version,
          source_api_version, consent_revision, coverage_state, deletion_order,
          lineage_coverage, high_watermark, cursor_hint, bounded_overlap_start,
          last_complete_snapshot_hash, c2_expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const row of sourceRows(sourceImage, 'collection_checkpoint')) {
        const scopeAlias = requiredText(row.scope_alias)
        const targetScopeId = targetScopeForAlias(scopeAlias)
        const oldJobId = requiredText(row.committed_job_id)
        const oldSnapshotId = requiredText(row.source_snapshot_id)
        const sourceJob = sourceJobs.get(oldJobId) ?? fail('GRAPH_REFUSED')
        const completedAt = parseTime(sourceJob.completed_at)
        const boundedOverlapStart = parseTime(row.bounded_overlap_start)
        const highWatermark = row.high_watermark === null || row.high_watermark === undefined
          ? null
          : parseTime(row.high_watermark)
        const sourceCheckpointKey = [row.capability_id, scopeAlias].join('\0')
        if (checkpointMap.has(sourceCheckpointKey) || omittedCheckpoints.has(sourceCheckpointKey)) {
          fail('GRAPH_REFUSED')
        }
        if (targetScopeId === undefined) {
          if (
            omittedJobs.get(oldJobId) !== scopeAlias
            || omittedSnapshots.get(oldSnapshotId) !== scopeAlias
          ) {
            fail('GRAPH_REFUSED')
          }
          omittedCheckpoints.add(sourceCheckpointKey)
          continue
        }
        const job = jobMap.get(oldJobId) ?? fail('GRAPH_REFUSED')
        const snapshot = snapshotMap.get(oldSnapshotId) ?? fail('GRAPH_REFUSED')
        if (job.scopeId !== targetScopeId || snapshot.scopeId !== targetScopeId) fail('GRAPH_REFUSED')
        const expiresAt = addUtcMonthsClamped(completedAt)
        const live = retainAuthenticatedC2(scopeAlias, expiresAt)
        const targetId = mintId('ckpt-')
        checkpointMap.set(sourceCheckpointKey, {
          kind: 'checkpoint',
          targetId,
          scopeId: targetScopeId,
        })
        insertCheckpoint.run(
          targetScopeId,
          targetId,
          job.targetId,
          snapshot.targetId,
          row.capability_id,
          row.query_version,
          row.source_api_version,
          row.consent_revision,
          'complete',
          0,
          'mapped',
          live ? highWatermark : null,
          live ? row.cursor_hint : null,
          live ? boundedOverlapStart : null,
          live ? row.last_complete_snapshot_hash : null,
          live ? expiresAt : null,
        )
      }
      checkpoint('checkpoints')

      const insertEvidence = options.targetDb.prepare(
        `INSERT INTO evidence (scope_id, evidence_id, coverage_id, layer, schema_version)
         VALUES (?, ?, ?, ?, ?)`,
      )
      for (const row of sourceRows(sourceImage, 'evidence')) {
        const oldEvidenceId = requiredText(row.evidence_id)
        if (evidenceMap.has(oldEvidenceId) || omittedEvidence.has(oldEvidenceId)) fail('GRAPH_REFUSED')
        const target = {
          coverageId: requiredText(row.coverage_id),
          rangeStart: parseTime(row.coverage_range_start),
          jobId: requiredText(row.coverage_job_id),
        }
        const layer = EvidenceLayerSchema.safeParse(row.layer)
        if (!layer.success) fail('GRAPH_REFUSED')
        const evidenceLayer = layer.data!
        const key = coverageKey(target)
        const coverage = coverageMap.get(key)
        if (!coverage) {
          if (!omittedCoverage.has(key)) fail('GRAPH_REFUSED')
          omittedEvidence.add(oldEvidenceId)
          continue
        }
        const targetId = mintId('ev-')
        const owner = { kind: 'evidence', targetId, scopeId: coverage.scopeId } as const
        evidenceMap.set(oldEvidenceId, owner)
        evidenceLayers.set(oldEvidenceId, evidenceLayer)
        addOwnership(ownership, oldEvidenceId, owner)
        insertEvidence.run(
          coverage.scopeId,
          targetId,
          coverage.targetId,
          evidenceLayer,
          row.schema_version,
        )
      }
      checkpoint('evidence')

      for (const row of sourceRows(sourceImage, 'claim')) {
        const claim = parseClaim(row)
        if (claimsById.has(claim.claimId) || !scopeMap.has(claim.scopeId)) fail('GRAPH_REFUSED')
        claimsById.set(claim.claimId, claim)
      }
      for (const row of sourceRows(sourceImage, 'claim_evidence_edge')) {
        const parsed = parseSourceEdge(row)
        if (!claimsById.has(parsed.claimId)) fail('GRAPH_REFUSED')
        const values = sourceEdges.get(parsed.claimId) ?? []
        values.push(parsed)
        sourceEdges.set(parsed.claimId, values)
      }

      for (const claim of claimsById.values()) {
        const edges = sourceEdges.get(claim.claimId) ?? []
        try {
          const sourceId = computeClaimId({
            layer: claim.layer,
            statementCode: claim.statementCode,
            methodId: claim.methodId,
            methodVersion: claim.methodVersion,
            basis: edges.map(({ edge }) => edge),
            windowStart: claim.windowStart,
            windowEnd: claim.windowEnd,
            scopeId: claim.scopeId,
            schemaVersion: claim.schemaVersion,
          })
          if (sourceId !== claim.claimId) fail('GRAPH_REFUSED')
        } catch (error) {
          if (error instanceof StorageV3ShadowRewriteError) throw error
          fail('GRAPH_REFUSED')
        }

        for (const { edge } of edges) {
          if ('targetEvidenceId' in edge) {
            const evidence = evidenceMap.get(edge.targetEvidenceId) ?? fail('GRAPH_REFUSED')
            const layer = evidenceLayers.get(edge.targetEvidenceId) ?? fail('GRAPH_REFUSED')
            if (evidence.scopeId !== claim.scopeId || !claimMayCiteLayer(claim.layer, layer)) {
              fail('GRAPH_REFUSED')
            }
          } else if ('targetClaimId' in edge) {
            const targetClaim = claimsById.get(edge.targetClaimId) ?? fail('GRAPH_REFUSED')
            if (
              targetClaim.scopeId !== claim.scopeId
              || !claimMayCiteLayer(claim.layer, targetClaim.layer)
            ) {
              fail('GRAPH_REFUSED')
            }
          } else {
            const coverage = coverageMap.get(coverageKey(edge.targetCoverage)) ?? fail('GRAPH_REFUSED')
            if (coverage.scopeId !== claim.scopeId || !claimMayCiteLayer(claim.layer, 'observed')) {
              fail('GRAPH_REFUSED')
            }
          }
        }
      }
      validateSupersession(claimsById)

      const remintState = track(new Map<string, 'visiting' | 'complete'>())
      const remint = (oldClaimId: string): OwnedTarget => {
        const existing = claimMap.get(oldClaimId)
        if (existing) return existing
        if (remintState.get(oldClaimId) === 'visiting') fail('GRAPH_REFUSED')
        const claim = claimsById.get(oldClaimId) ?? fail('GRAPH_REFUSED')
        const scopeId = scopeMap.get(claim.scopeId) ?? fail('GRAPH_REFUSED')
        remintState.set(oldClaimId, 'visiting')
        const basisTokens: string[] = []
        for (const { edge } of sourceEdges.get(oldClaimId) ?? []) {
          if ('targetEvidenceId' in edge) {
            const evidence = evidenceMap.get(edge.targetEvidenceId) ?? fail('GRAPH_REFUSED')
            basisTokens.push(`evidence|${edge.role}|${evidence.targetId}`)
          } else if ('targetClaimId' in edge) {
            const targetClaim = remint(edge.targetClaimId)
            basisTokens.push(`claim|${edge.role}|${targetClaim.targetId}`)
          } else {
            const coverage = coverageMap.get(coverageKey(edge.targetCoverage)) ?? fail('GRAPH_REFUSED')
            basisTokens.push(`coverage|${edge.role}|${coverage.targetId}`)
          }
        }
        const targetId = claimV3Id(claim, scopeId, basisTokens)
        const previousOwner = newClaimOwners.get(targetId)
        if (previousOwner !== undefined && previousOwner !== oldClaimId) fail('KEY_COLLISION')
        newClaimOwners.set(targetId, oldClaimId)
        // Reminted claim ids are deterministic functions of MINTED scope ids: per-target
        // different but order-stable, so they join the minted list for the equivalence proof.
        recordMinted(targetId)
        const owner = { kind: 'claim', targetId, scopeId } as const
        claimMap.set(oldClaimId, owner)
        addOwnership(ownership, oldClaimId, owner)
        remintState.set(oldClaimId, 'complete')
        return owner
      }
      for (const claimId of claimsById.keys()) remint(claimId)

      const insertClaim = options.targetDb.prepare(
        `INSERT INTO claim (
          scope_id, claim_id, layer, statement_code, method_id, method_version,
          window_start, window_end, schema_version, claim_id_material_version,
          created_at, superseded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'claim-id.v3', ?, NULL)`,
      )
      for (const claim of claimsById.values()) {
        const targetClaim = claimMap.get(claim.claimId) ?? fail('GRAPH_REFUSED')
        const retainedCreatedAt = asOf < addUtcMonthsClamped(claim.createdAt)
          ? claim.createdAt
          : null
        insertClaim.run(
          targetClaim.scopeId,
          targetClaim.targetId,
          claim.layer,
          claim.statementCode,
          claim.methodId,
          claim.methodVersion,
          claim.windowStart,
          claim.windowEnd,
          claim.schemaVersion,
          retainedCreatedAt,
        )
        copiedClaims += 1
      }
      for (const claim of claimsById.values()) {
        if (claim.supersededBy === null) continue
        const targetClaim = claimMap.get(claim.claimId) ?? fail('GRAPH_REFUSED')
        const successor = claimMap.get(claim.supersededBy) ?? fail('GRAPH_REFUSED')
        const result = options.targetDb.prepare(
          'UPDATE claim SET superseded_by = ? WHERE scope_id = ? AND claim_id = ?',
        ).run(successor.targetId, targetClaim.scopeId, targetClaim.targetId)
        if (result.changes !== 1) fail('GRAPH_REFUSED')
      }
      checkpoint('claims')

      const insertEdge = options.targetDb.prepare(
        `INSERT INTO claim_evidence_edge (
          scope_id, claim_id, role, target_evidence_id, target_claim_id, target_coverage_id
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      for (const [oldClaimId, edges] of sourceEdges) {
        const claim = claimMap.get(oldClaimId) ?? fail('GRAPH_REFUSED')
        for (const { edge } of edges) {
          const evidence = 'targetEvidenceId' in edge
            ? evidenceMap.get(edge.targetEvidenceId) ?? fail('GRAPH_REFUSED')
            : undefined
          const targetClaim = 'targetClaimId' in edge
            ? claimMap.get(edge.targetClaimId) ?? fail('GRAPH_REFUSED')
            : undefined
          const coverage = 'targetCoverage' in edge
            ? coverageMap.get(coverageKey(edge.targetCoverage)) ?? fail('GRAPH_REFUSED')
            : undefined
          const target = evidence ?? targetClaim ?? coverage ?? fail('GRAPH_REFUSED')
          if (target.scopeId !== claim.scopeId) fail('GRAPH_REFUSED')
          insertEdge.run(
            claim.scopeId,
            claim.targetId,
            edge.role,
            evidence?.targetId ?? null,
            targetClaim?.targetId ?? null,
            coverage?.targetId ?? null,
          )
        }
      }
      checkpoint('claimEdges')

      const insertLimitation = options.targetDb.prepare(
        `INSERT INTO limitation_instance (
          scope_id, claim_id, limitation_code, dimension, copy_key
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      for (const row of sourceRows(sourceImage, 'limitation_instance')) {
        const claim = claimMap.get(requiredText(row.claim_id)) ?? fail('GRAPH_REFUSED')
        const parsed = LimitationInstanceSchema.safeParse({
          limitationCode: row.limitation_code,
          dimension: row.dimension,
          copyKey: row.copy_key,
        })
        if (!parsed.success) fail('GRAPH_REFUSED')
        const limitation = parsed.data!
        insertLimitation.run(
          claim.scopeId,
          claim.targetId,
          limitation.limitationCode,
          limitation.dimension,
          limitation.copyKey,
        )
      }
      checkpoint('limitations')

      const insertLineage = options.targetDb.prepare(
        `INSERT INTO lineage_event (
          scope_id, subject_kind, subject_id, operation_id, capability_id,
          caused_by, event_kind, event_week
        ) VALUES (?, ?, ?, ?, 'github.core', ?, ?, ?)`,
      )
      for (const row of sourceRows(sourceImage, 'lineage_event')) {
        const sourceSubjectId = requiredText(row.subject_id)
        const eventKind = requiredText(row.event_kind)
        const sourceCause = nullableText(row.caused_by)
        const occurredAt = parseTime(row.occurred_at)
        const eventWeek = isoWeekFromCanonicalTimestamp(occurredAt)

        if (sourceSubjectId.startsWith(LEGACY_TOMBSTONE_PREFIX)) {
          const suffix = sourceSubjectId.slice(LEGACY_TOMBSTONE_PREFIX.length)
          if (
            !/^[0-9a-f]{64}$/.test(suffix)
            || eventKind !== 'tombstone_cascade'
            || sourceCause !== LEGACY_TOMBSTONE_CAUSE
          ) {
            fail('GRAPH_REFUSED')
          }
          const signature = [sourceSubjectId, eventKind, sourceCause, occurredAt].join('\0')
          const existing = legacyEvents.get(suffix)
          if (existing !== undefined) {
            if (existing !== signature) fail('GRAPH_REFUSED')
            continue
          }
          legacyEvents.set(suffix, signature)
          const deletionId = `del-${suffix}`
          if (usedKeys.has(deletionId)) fail('KEY_COLLISION')
          usedKeys.add(deletionId)
          insertLineage.run(
            null,
            'deletion',
            deletionId,
            deletionId,
            null,
            'legacy_deletion_operation',
            eventWeek,
          )
          copiedLineageEvents += 1
          continue
        }

        const subject = resolveOwnership(ownership, sourceSubjectId)
        if (!subject) {
          omittedUnclassifiedLineageEvents += 1
          continue
        }
        let cause: OwnedTarget | undefined
        if (sourceCause !== null) {
          cause = resolveOwnership(ownership, sourceCause)
          if (!cause) {
            omittedUnclassifiedLineageEvents += 1
            continue
          }
          if (cause.scopeId !== subject.scopeId) fail('GRAPH_REFUSED')
        }

        const sourceSignature = [sourceSubjectId, eventKind, sourceCause ?? '', occurredAt].join('\0')
        if (seenLineageRows.has(sourceSignature)) continue
        seenLineageRows.add(sourceSignature)
        if (DELETION_EVENT_KINDS.has(eventKind)) {
          const conflictKey = [subject.kind, subject.targetId, eventKind].join('\0')
          const previous = deletionEvents.get(conflictKey)
          if (previous !== undefined && previous !== sourceSignature) fail('GRAPH_REFUSED')
          deletionEvents.set(conflictKey, sourceSignature)
        }

        insertLineage.run(
          subject.scopeId,
          subject.kind,
          subject.targetId,
          mintId(DELETION_EVENT_KINDS.has(eventKind) ? 'del-' : 'op-'),
          cause?.targetId ?? null,
          eventKind,
          eventWeek,
        )
        copiedLineageEvents += 1
      }
      checkpoint('lineage')

      if (
        jobMap.size + omittedJobs.size !== sourceRows(sourceImage, 'collection_job').length
        || snapshotMap.size + omittedSnapshots.size !== sourceRows(sourceImage, 'source_snapshot').length
        || checkpointMap.size + omittedCheckpoints.size !== sourceRows(sourceImage, 'collection_checkpoint').length
        || coverageMap.size + omittedCoverage.size !== sourceRows(sourceImage, 'coverage_ledger').length
        || evidenceMap.size + omittedEvidence.size !== sourceRows(sourceImage, 'evidence').length
        || claimMap.size !== sourceRows(sourceImage, 'claim').length
        || options.targetDb.prepare('PRAGMA foreign_key_check').all().length > 0
      ) {
        fail('GRAPH_REFUSED')
      }
      checkpoint('finalValidation')
    })()

    return Object.freeze({
      ...STORAGE_V3_SHADOW_RESULT,
      copiedScopes,
      copiedClaims,
      copiedLineageEvents,
      omittedExpiredIdentities,
      omittedUnclassifiedLineageEvents,
      mintedIdentifiers: Object.freeze([...mintedInOrder]),
    })
  } catch (error) {
    if (error instanceof StorageV3ShadowRewriteError) throw error
    return fail('REWRITE_FAILED')
  } finally {
    aliases = undefined
    for (const collection of transient.reverse()) collection.clear()
    transient.length = 0
    clearSourceImage(source)
    source = undefined
  }
}
