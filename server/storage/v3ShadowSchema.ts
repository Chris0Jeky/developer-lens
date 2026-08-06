import type Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import {
  CLAIM_ABSTENTION_STATEMENT_CODE,
  CLAIM_EDGE_ROLES,
  CLAIM_EVIDENCE_EDGE_ROLES,
  CLAIM_LAYERS,
  CLAIM_LIMITATION_CODES,
  CLAIM_LIMITATION_DIMENSIONS,
  CLAIM_SCHEMA_VERSION,
  CLAIM_STATEMENT_CODES,
} from '../../shared/claims.js'
import { COVERAGE_STATUSES } from '../../shared/coverage.js'
import { CANONICAL_ENVELOPE_SCHEMA_VERSION, EVIDENCE_LAYERS } from '../../shared/provenance.js'
import {
  C1_KEY_PREFIXES,
  CLAIM_MATERIAL_V3_PROPOSAL_VERSION,
  LINEAGE_V3_DELETION_EVENT_KINDS,
  LINEAGE_V3_EVENT_KINDS,
  LINEAGE_V3_SUBJECT_KINDS,
  STORAGE_V3_DISPOSITIONS,
  STORAGE_V3_TABLES,
  type StorageV3Table,
  validateStorageV3Dispositions,
} from './v3Proposal.js'

/**
 * B2a's target is deliberately a shadow database.  It is not the v2 store,
 * and this module contains no reader, writer, or migration caller.
 */
export const STORAGE_V3_SHADOW_SCHEMA_VERSION = '3.2.1-shadow-life03-backup' as const
export const STORAGE_V3_SHADOW_APPLICATION_ID = 0x444c5633
export const STORAGE_V3_SHADOW_USER_VERSION = 308

/**
 * B4's closed app-owned artifact domain.  Analysis packs are deliberately absent:
 * their caller-selected output directory makes them user-directed exports, not
 * application-controlled recall targets.
 */
export const STORAGE_V3_ARTIFACT_KINDS = [
  'selected_store',
  'migration_primary_temp',
  'migration_replay_temp',
  'migration_backup_v1',
  'invented_fixture_store',
] as const
export type StorageV3ArtifactKind = typeof STORAGE_V3_ARTIFACT_KINDS[number]
export const STORAGE_V3_ARTIFACT_LOCATORS = Object.freeze({
  selectedStore: 'v3-store.sqlite',
  migrationPrimary: 'v3-target-primary.tmp.sqlite',
  migrationReplay: 'v3-target-replay.tmp.sqlite',
})
export const STORAGE_V3_ARTIFACT_MANIFEST_DOMAIN =
  'developer-lens.storage-v3-artifact-manifest.v1' as const
export const STORAGE_V3_SELECTED_STORE_CONTENT_DOMAIN =
  'developer-lens.storage-v3-selected-store-logical-content.v1' as const

export function storageV3ArtifactManifestSha256(
  kind: StorageV3ArtifactKind,
  locator: string,
): string {
  return createHash('sha256')
    .update(`${STORAGE_V3_ARTIFACT_MANIFEST_DOMAIN}\0${kind}\0${locator}`, 'utf8')
    .digest('hex')
}

/**
 * The selected database is mutable and contains its own catalogue, so a physical
 * self-hash cannot be stable. This controlled logical-content hash binds the
 * SQLite application/schema identity; every separate deletable file uses its
 * physical byte hash instead.
 */
export function storageV3SelectedStoreContentSha256(): string {
  return createHash('sha256')
    .update(
      `${STORAGE_V3_SELECTED_STORE_CONTENT_DOMAIN}\0${STORAGE_V3_SHADOW_SCHEMA_VERSION}`
      + `\0${STORAGE_V3_SHADOW_APPLICATION_ID}\0${STORAGE_V3_SHADOW_USER_VERSION}`,
      'utf8',
    )
    .digest('hex')
}

export const STORAGE_V3_ARTIFACT_STATES = ['active', 'pending', 'deleting'] as const
export type StorageV3ArtifactState = typeof STORAGE_V3_ARTIFACT_STATES[number]

export const STORAGE_V3_ARTIFACT_TABLES = [
  'app_artifact',
  'app_artifact_scope',
  'storage_maintenance_state',
] as const
export type StorageV3ArtifactTable = typeof STORAGE_V3_ARTIFACT_TABLES[number]
export const STORAGE_V3_ARTIFACT_TRIGGER_NAMES = Object.freeze([
  'storage_v3_artifact_insert_guard',
  'storage_v3_artifact_delete_guard',
  'storage_v3_artifact_identity_immutable',
  'storage_v3_artifact_scope_delete_guard',
  'storage_v3_artifact_scope_no_update',
  'storage_v3_artifact_state_transition',
  'storage_v3_maintenance_insert_guard',
  'storage_v3_maintenance_no_delete',
  'storage_v3_maintenance_transition',
] as const)

/**
 * Continuity CAS state lives in the store it guards.  These two tables are
 * new-store state, never migration output: no v2 source carries them, the
 * rewrite never writes them, and acceptance requires them empty.
 */
export const STORAGE_V3_CONTINUITY_CAS_TABLES = [
  'continuity_cas_operation',
  'continuity_cas_state',
] as const
export type StorageV3ContinuityCasTable = typeof STORAGE_V3_CONTINUITY_CAS_TABLES[number]
/** One content-free abort code shared by the CAS triggers and their module. */
export const STORAGE_V3_CONTINUITY_CAS_ERROR = 'STORAGE_V3_CONTINUITY_CAS_INVALID' as const
const CONTINUITY_CAS_MAX_REVISION = Number.MAX_SAFE_INTEGER

/**
 * Canonical identity columns are immutable after insertion.  This registry is
 * the single source for both the generated triggers and the schema inventory
 * fingerprint; keeping it declarative prevents trigger drift between tables.
 */
export const STORAGE_V3_SHADOW_IMMUTABLE_TRIGGERS = [
  { tableName: 'claim_scope', columns: ['scope_id'] },
  { tableName: 'repository_identity', columns: ['scope_id'] },
  { tableName: 'commit_observation', columns: ['scope_id', 'observation_id'] },
  { tableName: 'pull_request_fact', columns: ['scope_id', 'fact_id'] },
  { tableName: 'coverage_observation', columns: ['scope_id', 'coverage_id'] },
  { tableName: 'dated_event_observation', columns: ['scope_id', 'event_id'] },
  { tableName: 'collection_job', columns: ['scope_id', 'job_id'] },
  { tableName: 'collection_checkpoint', columns: ['scope_id', 'checkpoint_id', 'job_id', 'snapshot_id'] },
  { tableName: 'source_snapshot', columns: ['scope_id', 'snapshot_id', 'job_id'] },
  { tableName: 'coverage_ledger', columns: ['scope_id', 'coverage_id', 'job_id', 'snapshot_id'] },
  { tableName: 'evidence', columns: ['scope_id', 'evidence_id', 'coverage_id'] },
  { tableName: 'claim', columns: ['scope_id', 'claim_id'] },
  {
    tableName: 'claim_evidence_edge',
    columns: ['scope_id', 'claim_id', 'role', 'target_evidence_id', 'target_claim_id', 'target_coverage_id'],
  },
  { tableName: 'limitation_instance', columns: ['scope_id', 'claim_id', 'limitation_code', 'dimension', 'copy_key'] },
  {
    tableName: 'lineage_event',
    columns: ['scope_id', 'subject_kind', 'subject_id', 'operation_id', 'capability_id', 'caused_by', 'event_kind', 'event_week'],
  },
] as const

export type StorageV3ShadowImmutableTrigger = (typeof STORAGE_V3_SHADOW_IMMUTABLE_TRIGGERS)[number]

const immutableInsertLocators = {
  claim_scope: ['scope_id'],
  repository_identity: ['scope_id'],
  commit_observation: ['scope_id', 'observation_id'],
  pull_request_fact: ['scope_id', 'fact_id'],
  coverage_observation: ['scope_id', 'coverage_id'],
  dated_event_observation: ['scope_id', 'event_id'],
  collection_job: ['scope_id', 'job_id'],
  collection_checkpoint: ['scope_id', 'checkpoint_id'],
  source_snapshot: ['scope_id', 'snapshot_id'],
  coverage_ledger: ['scope_id', 'coverage_id'],
  evidence: ['scope_id', 'evidence_id'],
  claim: ['scope_id', 'claim_id'],
  claim_evidence_edge: [
    'scope_id',
    'claim_id',
    'role',
    'target_evidence_id',
    'target_claim_id',
    'target_coverage_id',
  ],
  limitation_instance: ['scope_id', 'claim_id', 'limitation_code', 'dimension', 'copy_key'],
  lineage_event: ['subject_kind', 'subject_id', 'event_kind', 'operation_id', 'event_week'],
} as const satisfies Record<StorageV3ShadowImmutableTrigger['tableName'], readonly string[]>

const immutableTriggerName = (tableName: string): string => `storage_v3_immutable_${tableName}`
const immutableInsertTriggerName = (tableName: string): string => `storage_v3_immutable_insert_${tableName}`
export const STORAGE_V3_SHADOW_IMMUTABLE_INSERT_TRIGGER_NAMES = Object.freeze(
  STORAGE_V3_SHADOW_IMMUTABLE_TRIGGERS.map(({ tableName }) => immutableInsertTriggerName(tableName)),
)
const immutableTriggerSql = ({ tableName, columns }: StorageV3ShadowImmutableTrigger): string => {
  const changes = columns.map((column) => `OLD.${column} IS NOT NEW.${column}`).join(' OR ')
  return `CREATE TRIGGER IF NOT EXISTS ${immutableTriggerName(tableName)}
BEFORE UPDATE OF ${columns.join(', ')} ON ${tableName}
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_SHADOW_IMMUTABLE_KEY') WHERE ${changes};
END;`
}

const immutableInsertTriggerSql = ({ tableName, columns }: StorageV3ShadowImmutableTrigger): string => {
  const locator = immutableInsertLocators[tableName]
    .map((column) => `existing.${column} IS NEW.${column}`)
    .join(' AND ')
  const changes = columns.map((column) => `existing.${column} IS NOT NEW.${column}`).join(' OR ')
  return `CREATE TRIGGER IF NOT EXISTS ${immutableInsertTriggerName(tableName)}
BEFORE INSERT ON ${tableName}
WHEN EXISTS (
  SELECT 1 FROM ${tableName} AS existing
  WHERE ${locator}
    AND (${changes})
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_SHADOW_IMMUTABLE_KEY');
END;`
}

const immutableTriggerSqlBlock = STORAGE_V3_SHADOW_IMMUTABLE_TRIGGERS.map(immutableTriggerSql).join('\n')
const immutableInsertTriggerSqlBlock = STORAGE_V3_SHADOW_IMMUTABLE_TRIGGERS.map(immutableInsertTriggerSql).join('\n')

export const STORAGE_V3_SHADOW_IDENTITY_BINDING_TRIGGER_NAMES = Object.freeze([
  'storage_v3_scope_alias_binding',
  'storage_v3_repository_identity_binding',
] as const)

const identityBindingTriggerSqlBlock = `CREATE TRIGGER IF NOT EXISTS storage_v3_scope_alias_binding
BEFORE INSERT ON claim_scope
WHEN NEW.scope_alias IS NOT NULL AND EXISTS (
  SELECT 1 FROM claim_scope AS existing
  WHERE existing.scope_alias = NEW.scope_alias AND existing.scope_id IS NOT NEW.scope_id
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY');
END;
CREATE TRIGGER IF NOT EXISTS storage_v3_repository_identity_binding
BEFORE INSERT ON repository_identity
WHEN EXISTS (
  SELECT 1 FROM repository_identity AS existing
  WHERE existing.scope_id IS NOT NEW.scope_id
    AND (
      (NEW.provider_id IS NOT NULL AND existing.provider_id = NEW.provider_id)
      OR (NEW.analytical_key IS NOT NULL AND existing.analytical_key = NEW.analytical_key)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY');
END;`

export const STORAGE_V3_SHADOW_LINEAGE_SCOPE_TRIGGER_NAME = 'storage_v3_lineage_scope_guard'
export const STORAGE_V3_SHADOW_C2_RETENTION_OWNER_TRIGGER_NAME = 'storage_v3_c2_retention_owner_guard'
export const STORAGE_V3_SHADOW_SOURCE_SNAPSHOT_GUARD_TRIGGER_NAME = 'storage_v3_source_snapshot_closed_job_guard'

/**
 * The partial unique index is REPLACE-bypassable: a new snapshot id for the
 * same closed (scope, job) can otherwise delete the old parent and cascade its
 * children. This BEFORE INSERT guard runs before SQLite conflict resolution.
 */
const sourceSnapshotGuardSql = `CREATE TRIGGER IF NOT EXISTS ${STORAGE_V3_SHADOW_SOURCE_SNAPSHOT_GUARD_TRIGGER_NAME}
BEFORE INSERT ON source_snapshot
WHEN NEW.status = 'closed' AND EXISTS (
  SELECT 1 FROM source_snapshot AS existing
  WHERE existing.scope_id = NEW.scope_id
    AND existing.job_id = NEW.job_id
    AND existing.status = 'closed'
    AND existing.snapshot_id IS NOT NEW.snapshot_id
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_SHADOW_CLOSED_SNAPSHOT_REPLACE');
END;`

const lineageOwnerRegistry = [
  { subjectKind: 'scope', prefix: 'scope-', tableName: 'claim_scope', idColumn: 'scope_id' },
  { subjectKind: 'claim', prefix: 'cl_', tableName: 'claim', idColumn: 'claim_id' },
  { subjectKind: 'job', prefix: 'job-', tableName: 'collection_job', idColumn: 'job_id' },
  { subjectKind: 'snapshot', prefix: 'snap-', tableName: 'source_snapshot', idColumn: 'snapshot_id' },
  { subjectKind: 'checkpoint', prefix: 'ckpt-', tableName: 'collection_checkpoint', idColumn: 'checkpoint_id' },
  { subjectKind: 'coverage', prefix: 'cov-', tableName: 'coverage_ledger', idColumn: 'coverage_id' },
  { subjectKind: 'coverage', prefix: 'cov-', tableName: 'coverage_observation', idColumn: 'coverage_id' },
  { subjectKind: 'evidence', prefix: 'ev-', tableName: 'evidence', idColumn: 'evidence_id' },
] as const

const lineageOwnerTriggerName = (tableName: string): string => `storage_v3_lineage_owner_${tableName}`
export const STORAGE_V3_SHADOW_LINEAGE_OWNER_TRIGGER_NAMES = Object.freeze(
  lineageOwnerRegistry.map(({ tableName }) => lineageOwnerTriggerName(tableName)),
)

const lineageOwnerTriggerSql = ({ subjectKind, tableName, idColumn }: (typeof lineageOwnerRegistry)[number]): string =>
  `CREATE TRIGGER IF NOT EXISTS ${lineageOwnerTriggerName(tableName)}
BEFORE INSERT ON ${tableName}
WHEN EXISTS (
  SELECT 1 FROM lineage_event AS reference
  WHERE reference.scope_id IS NOT NEW.scope_id
    AND (
      (reference.subject_kind = '${subjectKind}' AND reference.subject_id = NEW.${idColumn})
      OR reference.caused_by = NEW.${idColumn}
    )
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE');
END;`

const lineageOwnerTriggerSqlBlock = lineageOwnerRegistry.map(lineageOwnerTriggerSql).join('\n')

/**
 * A C1 subject id belongs to exactly ONE scope.  The lineage-owner triggers above
 * derive that from existing lineage rows, so they cannot fire for a duplicate owner
 * inserted BEFORE any lineage references the id (#128, PR #112 late review).  These
 * indexes make single-scope ownership hold from the first owner INSERT; the composite
 * `(scope_id, <id>)` primary keys only make the id unique WITHIN a scope.
 * `claim_scope` is absent because its id column is already the whole primary key.
 */
const ownerIdentityRegistry = lineageOwnerRegistry.filter(({ tableName }) => tableName !== 'claim_scope')
const ownerIdentityIndexName = (tableName: string): string => `storage_v3_owner_identity_${tableName}`
export const STORAGE_V3_SHADOW_OWNER_IDENTITY_INDEX_NAMES = Object.freeze(
  ownerIdentityRegistry.map(({ tableName }) => ownerIdentityIndexName(tableName)),
)
const ownerIdentityIndexSqlBlock = ownerIdentityRegistry
  .map(({ tableName, idColumn }) =>
    `CREATE UNIQUE INDEX IF NOT EXISTS ${ownerIdentityIndexName(tableName)} ON ${tableName} (${idColumn});`)
  .join('\n')

/**
 * The unique index alone is REPLACE-bypassable: INSERT OR REPLACE satisfies it by
 * DELETING the other scope's row, silently moving a C1 identity across scopes (PR #138
 * review). A BEFORE INSERT trigger fires before conflict resolution deletes anything,
 * so the cross-scope insert aborts regardless of the caller's conflict clause.
 */
const ownerIdentityTriggerName = (tableName: string): string => `storage_v3_owner_identity_guard_${tableName}`
export const STORAGE_V3_SHADOW_OWNER_IDENTITY_TRIGGER_NAMES = Object.freeze(
  ownerIdentityRegistry.map(({ tableName }) => ownerIdentityTriggerName(tableName)),
)
const ownerIdentityTriggerSqlBlock = ownerIdentityRegistry
  .map(({ tableName, idColumn }) =>
    `CREATE TRIGGER IF NOT EXISTS ${ownerIdentityTriggerName(tableName)}
BEFORE INSERT ON ${tableName}
WHEN EXISTS (
  SELECT 1 FROM ${tableName} AS other
  WHERE other.${idColumn} = NEW.${idColumn} AND other.scope_id IS NOT NEW.scope_id
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY');
END;`)
  .join('\n')

/**
 * `coverage_ledger` and `coverage_observation` share the `cov-` id space (both are
 * registered lineage owners of subject kind `coverage`), so a per-table unique index
 * cannot see a duplicate that lands in the other table.
 */
const coverageIdentityTriggerName = (tableName: string): string => `storage_v3_coverage_identity_${tableName}`
export const STORAGE_V3_SHADOW_COVERAGE_IDENTITY_TRIGGER_NAMES = Object.freeze([
  coverageIdentityTriggerName('coverage_ledger'),
  coverageIdentityTriggerName('coverage_observation'),
] as const)
const coverageIdentityTriggerSql = (tableName: string, otherTable: string): string =>
  `CREATE TRIGGER IF NOT EXISTS ${coverageIdentityTriggerName(tableName)}
BEFORE INSERT ON ${tableName}
WHEN EXISTS (
  SELECT 1 FROM ${otherTable} AS other
  WHERE other.coverage_id = NEW.coverage_id AND other.scope_id IS NOT NEW.scope_id
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_SHADOW_CROSS_SCOPE_IDENTITY');
END;`
const coverageIdentityTriggerSqlBlock = [
  coverageIdentityTriggerSql('coverage_ledger', 'coverage_observation'),
  coverageIdentityTriggerSql('coverage_observation', 'coverage_ledger'),
].join('\n')

const lineageSubjectMismatch = lineageOwnerRegistry.map(({ subjectKind, tableName, idColumn }) =>
  `(NEW.subject_kind = '${subjectKind}' AND EXISTS (
    SELECT 1 FROM ${tableName} AS owner
    WHERE owner.${idColumn} = NEW.subject_id AND owner.scope_id IS NOT NEW.scope_id
  ))`).join('\n  OR ')

/**
 * Derived from every subject kind, not from the owner registry: `artifact` and
 * `deletion` have no owner table, so a registry-derived guard silently skipped them
 * and two scopes could claim one `art-` history (#128, PR #112 late review).
 */
const lineageSubjectHistoryMismatch = LINEAGE_V3_SUBJECT_KINDS
  .map((subjectKind) => `(NEW.subject_kind = '${subjectKind}' AND EXISTS (
    SELECT 1 FROM lineage_event AS owner
    WHERE (
      (owner.subject_kind = '${subjectKind}' AND owner.subject_id = NEW.subject_id)
      OR owner.caused_by = NEW.subject_id
    )
      AND owner.scope_id IS NOT NEW.scope_id
  ))`).join('\n  OR ')

const lineageCauseMismatch = lineageOwnerRegistry.map(({ prefix, tableName, idColumn }) =>
  `(NEW.caused_by GLOB '${prefix}*' AND EXISTS (
    SELECT 1 FROM ${tableName} AS owner
    WHERE owner.${idColumn} = NEW.caused_by AND owner.scope_id IS NOT NEW.scope_id
  ))`).join('\n  OR ')

/**
 * The ownerless `art-` prefix joins the owned prefixes here for the same reason.
 * `op-`/`del-` causes are covered by the operation-cause guard below.
 */
const lineageCauseHistoryMismatch = [
  ...new Set([...lineageOwnerRegistry.map(({ prefix }) => prefix), C1_KEY_PREFIXES.artifact]),
]
  .map((prefix) => `(NEW.caused_by GLOB '${prefix}*' AND EXISTS (
    SELECT 1 FROM lineage_event AS owner
    WHERE (owner.subject_id = NEW.caused_by OR owner.caused_by = NEW.caused_by)
      AND owner.scope_id IS NOT NEW.scope_id
  ))`).join('\n  OR ')

const lineageOperationMismatch = `EXISTS (
    SELECT 1 FROM lineage_event AS owner
    WHERE (owner.subject_id = NEW.operation_id OR owner.operation_id = NEW.operation_id OR owner.caused_by = NEW.operation_id)
      AND owner.scope_id IS NOT NEW.scope_id
  )`

const lineageOperationCauseMismatch = `(
    (NEW.caused_by GLOB 'op-*' OR NEW.caused_by GLOB 'del-*')
    AND EXISTS (
      SELECT 1 FROM lineage_event AS owner
      WHERE (owner.subject_id = NEW.caused_by OR owner.operation_id = NEW.caused_by OR owner.caused_by = NEW.caused_by)
        AND owner.scope_id IS NOT NEW.scope_id
    )
  )`

/** Bind single-scope lineage keys while still allowing the first content-free tombstone. */
const lineageScopeTriggerSql = `CREATE TRIGGER IF NOT EXISTS ${STORAGE_V3_SHADOW_LINEAGE_SCOPE_TRIGGER_NAME}
BEFORE INSERT ON lineage_event
WHEN (
  ${lineageSubjectMismatch}
  OR ${lineageSubjectHistoryMismatch}
  OR ${lineageCauseMismatch}
  OR ${lineageCauseHistoryMismatch}
  OR ${lineageOperationMismatch}
  OR ${lineageOperationCauseMismatch}
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_SHADOW_CROSS_SCOPE_LINEAGE');
END;`

const c2RetentionOwnerTriggerSql = `CREATE TRIGGER IF NOT EXISTS ${STORAGE_V3_SHADOW_C2_RETENTION_OWNER_TRIGGER_NAME}
BEFORE INSERT ON lineage_event
WHEN NEW.event_kind = 'c2_retention_expired' AND NOT (
  (NEW.subject_kind = 'job' AND EXISTS (
    SELECT 1 FROM collection_job AS owner
    WHERE owner.scope_id = NEW.scope_id AND owner.job_id = NEW.subject_id
  ))
  OR (NEW.subject_kind = 'snapshot' AND EXISTS (
    SELECT 1 FROM source_snapshot AS owner
    WHERE owner.scope_id = NEW.scope_id AND owner.snapshot_id = NEW.subject_id
  ))
  OR (NEW.subject_kind = 'checkpoint' AND EXISTS (
    SELECT 1 FROM collection_checkpoint AS owner
    WHERE owner.scope_id = NEW.scope_id AND owner.checkpoint_id = NEW.subject_id
  ))
  OR (NEW.subject_kind = 'coverage' AND EXISTS (
    SELECT 1 FROM coverage_ledger AS owner
    WHERE owner.scope_id = NEW.scope_id AND owner.coverage_id = NEW.subject_id
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_SHADOW_C2_RETENTION_OWNER_REQUIRED');
END;`

const key = (column: string, prefix: string): string =>
  `length(${column}) = ${prefix.length + 64} AND ${column} GLOB '${prefix}*' AND substr(${column}, ${prefix.length + 1}) NOT GLOB '*[^0-9a-f]*'`
const c1 = (column: string): string => key(column, 'scope-')
const token = (column: string, max = 256): string =>
  `length(${column}) BETWEEN 1 AND ${max} AND ${column} NOT GLOB '*[^A-Za-z0-9:._-]*'`
/** A REAL ISO week: shape, range, and the leap-week rule (W53 only in long years). */
const isoWeek = (column: string): string => `
    length(${column}) = 8
    AND ${column} GLOB '[0-9][0-9][0-9][0-9]-W[0-5][0-9]'
    AND substr(${column}, 7, 2) BETWEEN '01' AND '53'
    AND (
      substr(${column}, 7, 2) <> '53'
      OR strftime('%w', substr(${column}, 1, 4) || '-01-01') = '4'
      OR (
        strftime('%w', substr(${column}, 1, 4) || '-01-01') = '3'
        AND (
          CAST(substr(${column}, 1, 4) AS INTEGER) % 400 = 0
          OR (
            CAST(substr(${column}, 1, 4) AS INTEGER) % 4 = 0
            AND CAST(substr(${column}, 1, 4) AS INTEGER) % 100 <> 0
          )
        )
      )
    )
  `
const canonicalTimestampShape = (column: string): string =>
  `length(${column}) = 24 AND ${column} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'`
const quoted = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ')

const casAbort = (name: string, timing: string): string =>
  `CREATE TRIGGER IF NOT EXISTS ${name}
${timing}
BEGIN
  SELECT RAISE(ABORT, '${STORAGE_V3_CONTINUITY_CAS_ERROR}');
END;`

/**
 * The two append-only guards, exported so the B3 scope-deletion saga can drop and
 * byte-identically recreate them inside its single transaction: scope revocation is
 * the ONE operation allowed to remove CAS rows, and recreating the identical text
 * keeps the schema fingerprint unchanged. Every other writer still hits the abort.
 */
export const STORAGE_V3_CAS_NO_DELETE_TRIGGERS = Object.freeze([
  Object.freeze({
    name: 'continuity_cas_state_no_delete',
    sql: casAbort('continuity_cas_state_no_delete', 'BEFORE DELETE ON continuity_cas_state'),
  }),
  Object.freeze({
    name: 'continuity_cas_operation_no_delete',
    sql: casAbort('continuity_cas_operation_no_delete', 'BEFORE DELETE ON continuity_cas_operation'),
  }),
])

/**
 * Single-row revision state plus its immutable operation history.  The triggers
 * make monotonic single-step revisions and append-only history table properties
 * rather than writer conventions.
 *
 * `applied_week` carries the ISO-week grain floor of the writer's process wall time
 * (ADR-01 grain rule); the writer computes it from a canonical timestamp, the CHECK
 * pins only the shape. `payload_sha256` is a LOCAL C2 receipt: the G2 13-month
 * lifetime binds it, so it is nullable and the sweep clears it in place — the
 * clear-only trigger below makes NULL the only value an update can ever write,
 * keeping the history append-only in every other respect (PR #130 late review).
 */
const continuityCasSqlBlock = `CREATE TABLE IF NOT EXISTS continuity_cas_state (
  scope_id TEXT PRIMARY KEY NOT NULL CHECK (${c1('scope_id')}),
  revision INTEGER NOT NULL CHECK (revision >= 0 AND revision <= ${CONTINUITY_CAS_MAX_REVISION})
) STRICT;
CREATE TABLE IF NOT EXISTS continuity_cas_operation (
  operation_id TEXT PRIMARY KEY NOT NULL CHECK (${key('operation_id', 'op-')}),
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  expected_revision INTEGER NOT NULL
    CHECK (expected_revision >= 0 AND expected_revision < ${CONTINUITY_CAS_MAX_REVISION}),
  applied_revision INTEGER NOT NULL
    CHECK (
      applied_revision > 0
      AND applied_revision <= ${CONTINUITY_CAS_MAX_REVISION}
      AND applied_revision = expected_revision + 1
    ),
  payload_sha256 TEXT
    CHECK (payload_sha256 IS NULL OR (length(payload_sha256) = 64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*')),
  applied_week TEXT NOT NULL CHECK (${isoWeek('applied_week')}),
  UNIQUE (scope_id, applied_revision),
  FOREIGN KEY (scope_id) REFERENCES continuity_cas_state(scope_id) ON DELETE RESTRICT
) STRICT;
${casAbort('continuity_cas_state_scope_immutable', 'BEFORE UPDATE OF scope_id ON continuity_cas_state')}
${casAbort(
  'continuity_cas_state_revision_step',
  `BEFORE UPDATE OF revision ON continuity_cas_state
WHEN NEW.revision != OLD.revision + 1`,
)}
${STORAGE_V3_CAS_NO_DELETE_TRIGGERS[0].sql}
${casAbort(
  'continuity_cas_operation_matches_state',
  `BEFORE INSERT ON continuity_cas_operation
WHEN NOT EXISTS (
  SELECT 1 FROM continuity_cas_state AS state
  WHERE state.scope_id = NEW.scope_id
    AND state.revision = NEW.applied_revision
)`,
)}
${casAbort(
  'continuity_cas_operation_no_update',
  `BEFORE UPDATE ON continuity_cas_operation
WHEN NOT (
  NEW.operation_id = OLD.operation_id
  AND NEW.scope_id = OLD.scope_id
  AND NEW.expected_revision = OLD.expected_revision
  AND NEW.applied_revision = OLD.applied_revision
  AND NEW.applied_week = OLD.applied_week
  AND NEW.payload_sha256 IS NULL
)`,
)}
${STORAGE_V3_CAS_NO_DELETE_TRIGGERS[1].sql}`

const artifactLifecycleSqlBlock = `CREATE TABLE IF NOT EXISTS app_artifact (
  artifact_id TEXT PRIMARY KEY NOT NULL CHECK (${key('artifact_id', 'art-')}),
  kind TEXT NOT NULL CHECK (kind IN (${quoted(STORAGE_V3_ARTIFACT_KINDS)})),
  state TEXT NOT NULL CHECK (state IN (${quoted(STORAGE_V3_ARTIFACT_STATES)})),
  manifest_sha256 TEXT NOT NULL
    CHECK (length(manifest_sha256) = 64 AND manifest_sha256 NOT GLOB '*[^0-9a-f]*'),
  content_sha256 TEXT NOT NULL
    CHECK (length(content_sha256) = 64 AND content_sha256 NOT GLOB '*[^0-9a-f]*'),
  relative_locator TEXT NOT NULL UNIQUE CHECK (
    length(relative_locator) BETWEEN 1 AND 128
    AND relative_locator GLOB '[A-Za-z0-9]*'
    AND relative_locator NOT GLOB '*[^A-Za-z0-9._-]*'
    AND relative_locator NOT IN ('.', '..')
  ),
  deletion_operation_id TEXT CHECK (
    deletion_operation_id IS NULL OR ${key('deletion_operation_id', 'del-')}
  ),
  deletion_scope_id TEXT CHECK (deletion_scope_id IS NULL OR ${c1('deletion_scope_id')}),
  deletion_week TEXT CHECK (deletion_week IS NULL OR ${isoWeek('deletion_week')}),
  CHECK (
    (state = 'active' AND deletion_operation_id IS NULL AND deletion_scope_id IS NULL AND deletion_week IS NULL)
    OR
    (state IN ('pending', 'deleting') AND deletion_operation_id IS NOT NULL AND deletion_scope_id IS NOT NULL AND deletion_week IS NOT NULL)
  )
) STRICT;
CREATE TABLE IF NOT EXISTS app_artifact_scope (
  artifact_id TEXT NOT NULL CHECK (${key('artifact_id', 'art-')}),
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  PRIMARY KEY (artifact_id, scope_id),
  FOREIGN KEY (artifact_id) REFERENCES app_artifact(artifact_id) ON DELETE CASCADE,
  FOREIGN KEY (scope_id) REFERENCES claim_scope(scope_id) ON DELETE RESTRICT
) STRICT;
CREATE TABLE IF NOT EXISTS storage_maintenance_state (
  singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
  state TEXT NOT NULL CHECK (state IN ('complete', 'pending')),
  operation_id TEXT CHECK (operation_id IS NULL OR ${key('operation_id', 'del-')}),
  scope_id TEXT CHECK (scope_id IS NULL OR ${c1('scope_id')}),
  event_week TEXT CHECK (event_week IS NULL OR ${isoWeek('event_week')}),
  CHECK (
    (state = 'complete' AND operation_id IS NULL AND scope_id IS NULL AND event_week IS NULL)
    OR
    (state = 'pending' AND operation_id IS NOT NULL AND scope_id IS NOT NULL AND event_week IS NOT NULL)
  )
) STRICT;
CREATE TRIGGER IF NOT EXISTS storage_v3_maintenance_insert_guard
BEFORE INSERT ON storage_maintenance_state
WHEN EXISTS (
  SELECT 1 FROM storage_maintenance_state WHERE singleton = NEW.singleton
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_ARTIFACT_INVALID');
END;
CREATE TRIGGER IF NOT EXISTS storage_v3_artifact_insert_guard
BEFORE INSERT ON app_artifact
WHEN EXISTS (
  SELECT 1 FROM app_artifact AS existing
  WHERE existing.artifact_id = NEW.artifact_id
     OR existing.relative_locator = NEW.relative_locator
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_ARTIFACT_INVALID');
END;
CREATE TRIGGER IF NOT EXISTS storage_v3_artifact_identity_immutable
BEFORE UPDATE OF artifact_id, kind, manifest_sha256, content_sha256, relative_locator ON app_artifact
WHEN OLD.artifact_id IS NOT NEW.artifact_id
  OR (
    (OLD.kind IS NOT NEW.kind OR OLD.manifest_sha256 IS NOT NEW.manifest_sha256
      OR OLD.content_sha256 IS NOT NEW.content_sha256 OR OLD.relative_locator IS NOT NEW.relative_locator)
    AND NOT (
      OLD.kind = 'migration_primary_temp'
      AND OLD.state = 'active'
      AND OLD.relative_locator = '${STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary}'
      AND OLD.manifest_sha256 = '${storageV3ArtifactManifestSha256('migration_primary_temp', STORAGE_V3_ARTIFACT_LOCATORS.migrationPrimary)}'
      AND NEW.kind = 'selected_store'
      AND NEW.state = 'active'
      AND NEW.relative_locator = '${STORAGE_V3_ARTIFACT_LOCATORS.selectedStore}'
      AND NEW.manifest_sha256 = '${storageV3ArtifactManifestSha256('selected_store', STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)}'
      AND NEW.content_sha256 = '${storageV3SelectedStoreContentSha256()}'
      AND NEW.deletion_operation_id IS NULL
      AND NEW.deletion_scope_id IS NULL
      AND NEW.deletion_week IS NULL
      OR (
      OLD.kind = 'migration_backup_v1'
      AND OLD.state = 'active'
      AND OLD.relative_locator GLOB 'migration-backup-????????T??????Z.sqlite.tmp'
      AND NEW.kind = 'migration_backup_v1'
      AND NEW.state = 'active'
      AND NEW.relative_locator = replace(OLD.relative_locator, '.tmp', '')
      AND NEW.deletion_operation_id IS NULL
      AND NEW.deletion_scope_id IS NULL
      AND NEW.deletion_week IS NULL
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_ARTIFACT_INVALID');
END;
CREATE TRIGGER IF NOT EXISTS storage_v3_artifact_state_transition
BEFORE UPDATE OF state, deletion_operation_id, deletion_scope_id, deletion_week ON app_artifact
WHEN NOT (
  (OLD.state = 'active' AND NEW.state = 'pending'
    AND OLD.deletion_operation_id IS NULL AND OLD.deletion_scope_id IS NULL AND OLD.deletion_week IS NULL
    AND NEW.deletion_operation_id IS NOT NULL AND NEW.deletion_scope_id IS NOT NULL AND NEW.deletion_week IS NOT NULL)
  OR
  (OLD.state = 'pending' AND NEW.state = 'deleting'
    AND OLD.deletion_operation_id IS NEW.deletion_operation_id
    AND OLD.deletion_scope_id IS NEW.deletion_scope_id
    AND OLD.deletion_week IS NEW.deletion_week)
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_ARTIFACT_INVALID');
END;
CREATE TRIGGER IF NOT EXISTS storage_v3_artifact_delete_guard
BEFORE DELETE ON app_artifact
WHEN OLD.state <> 'deleting'
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_ARTIFACT_INVALID');
END;
CREATE TRIGGER IF NOT EXISTS storage_v3_artifact_scope_no_update
BEFORE UPDATE ON app_artifact_scope
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_ARTIFACT_INVALID');
END;
CREATE TRIGGER IF NOT EXISTS storage_v3_artifact_scope_delete_guard
BEFORE DELETE ON app_artifact_scope
WHEN NOT EXISTS (
  SELECT 1 FROM app_artifact AS artifact
  WHERE artifact.artifact_id = OLD.artifact_id AND artifact.state = 'deleting'
)
AND NOT EXISTS (
  SELECT 1
  FROM app_artifact AS artifact
  JOIN storage_maintenance_state AS maintenance ON maintenance.singleton = 1
  WHERE artifact.artifact_id = OLD.artifact_id
    AND maintenance.state = 'pending'
    AND maintenance.scope_id = OLD.scope_id
    AND (
      artifact.kind = 'selected_store'
      OR (
        artifact.state IN ('pending', 'deleting')
        AND artifact.deletion_scope_id = OLD.scope_id
      )
    )
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_ARTIFACT_INVALID');
END;
CREATE TRIGGER IF NOT EXISTS storage_v3_maintenance_no_delete
BEFORE DELETE ON storage_maintenance_state
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_ARTIFACT_INVALID');
END;
CREATE TRIGGER IF NOT EXISTS storage_v3_maintenance_transition
BEFORE UPDATE ON storage_maintenance_state
WHEN NOT (
  (OLD.state = 'complete' AND NEW.state = 'pending'
    AND OLD.operation_id IS NULL AND OLD.scope_id IS NULL AND OLD.event_week IS NULL
    AND NEW.operation_id IS NOT NULL AND NEW.scope_id IS NOT NULL AND NEW.event_week IS NOT NULL)
  OR
  (OLD.state = 'pending' AND NEW.state = 'complete'
    AND OLD.operation_id IS NOT NULL AND OLD.scope_id IS NOT NULL AND OLD.event_week IS NOT NULL
    AND NEW.operation_id IS NULL AND NEW.scope_id IS NULL AND NEW.event_week IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'STORAGE_V3_ARTIFACT_INVALID');
END;`

/** Strict, isolated DDL for every table named by the B1a disposition registry. */
export const STORAGE_V3_SHADOW_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS import_run (
  run_id TEXT PRIMARY KEY NOT NULL CHECK (${key('run_id', 'run-')}),
  schema_version TEXT NOT NULL CHECK (schema_version = '${STORAGE_V3_SHADOW_SCHEMA_VERSION}'),
  status TEXT NOT NULL CHECK (status IN ('started', 'complete', 'aborted'))
) STRICT;
CREATE TABLE IF NOT EXISTS claim_scope (
  scope_id TEXT PRIMARY KEY NOT NULL CHECK (${c1('scope_id')}),
  scope_alias TEXT UNIQUE CHECK (scope_alias IS NULL OR ${token('scope_alias')}),
  linked_at TEXT,
  alias_expires_at TEXT,
  CHECK ((scope_alias IS NULL) = (linked_at IS NULL)),
  CHECK ((scope_alias IS NULL) = (alias_expires_at IS NULL))
) STRICT;
CREATE TABLE IF NOT EXISTS repository_identity (
  scope_id TEXT PRIMARY KEY NOT NULL REFERENCES claim_scope(scope_id) CHECK (${c1('scope_id')}),
  provider_id TEXT UNIQUE CHECK (provider_id IS NULL OR ${token('provider_id')}),
  analytical_key TEXT UNIQUE CHECK (analytical_key IS NULL OR ${token('analytical_key')}),
  identity_expires_at TEXT,
  is_private INTEGER NOT NULL CHECK (is_private IN (0, 1)),
  is_archived INTEGER NOT NULL CHECK (is_archived IN (0, 1)),
  is_fork INTEGER NOT NULL CHECK (is_fork IN (0, 1)),
  CHECK ((provider_id IS NULL) = (analytical_key IS NULL)),
  CHECK ((provider_id IS NULL) = (identity_expires_at IS NULL))
) STRICT;
CREATE TABLE IF NOT EXISTS commit_observation (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  observation_id TEXT NOT NULL CHECK (${key('observation_id', 'obs-')}),
  sha TEXT CHECK (sha IS NULL OR ${token('sha')}),
  occurred_at TEXT,
  source TEXT CHECK (source IS NULL OR source IN ('github', 'local-git')),
  c2_expires_at TEXT,
  additions INTEGER, deletions INTEGER, files INTEGER, parent_count INTEGER,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('feat', 'fix', 'docs', 'test', 'refactor', 'chore', 'perf', 'build', 'ci', 'revert', 'other')),
  is_revert INTEGER NOT NULL CHECK (is_revert IN (0, 1)),
  is_fixup INTEGER NOT NULL CHECK (is_fixup IN (0, 1)),
  message_length INTEGER NOT NULL CHECK (message_length >= 0),
  PRIMARY KEY (scope_id, observation_id),
  FOREIGN KEY (scope_id) REFERENCES claim_scope(scope_id),
  CHECK ((sha IS NULL) = (occurred_at IS NULL)),
  CHECK ((sha IS NULL) = (source IS NULL)),
  CHECK ((sha IS NULL) = (c2_expires_at IS NULL))
) STRICT;
CREATE TABLE IF NOT EXISTS pull_request_fact (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  fact_id TEXT NOT NULL CHECK (${key('fact_id', 'pr-')}),
  number INTEGER CHECK (number IS NULL OR number > 0),
  created_at TEXT, merged_at TEXT, closed_at TEXT,
  c2_expires_at TEXT,
  state TEXT NOT NULL CHECK (state IN ('OPEN', 'CLOSED', 'MERGED')),
  is_draft INTEGER NOT NULL CHECK (is_draft IN (0, 1)),
  additions INTEGER, deletions INTEGER, changed_files INTEGER,
  comments INTEGER NOT NULL CHECK (comments >= 0), reviews INTEGER NOT NULL CHECK (reviews >= 0),
  PRIMARY KEY (scope_id, fact_id),
  FOREIGN KEY (scope_id) REFERENCES claim_scope(scope_id),
  CHECK ((number IS NULL) = (created_at IS NULL)),
  CHECK ((number IS NULL) = (c2_expires_at IS NULL)),
  CHECK (number IS NOT NULL OR (merged_at IS NULL AND closed_at IS NULL))
) STRICT;
CREATE TABLE IF NOT EXISTS coverage_observation (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  coverage_id TEXT NOT NULL CHECK (${key('coverage_id', 'cov-')}),
  capability_id TEXT NOT NULL CHECK (capability_id = 'github.core'),
  status TEXT NOT NULL CHECK (status IN (${quoted(COVERAGE_STATUSES)})),
  limitation_code TEXT NOT NULL CHECK (length(limitation_code) BETWEEN 1 AND 64 AND limitation_code NOT GLOB '*[^A-Z0-9_]*'),
  observed_units INTEGER NOT NULL CHECK (observed_units >= 0),
  PRIMARY KEY (scope_id, coverage_id),
  FOREIGN KEY (scope_id) REFERENCES claim_scope(scope_id)
) STRICT;
CREATE TABLE IF NOT EXISTS dated_event_observation (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  event_id TEXT NOT NULL CHECK (${key('event_id', 'event-')}),
  occurred_at TEXT,
  c2_expires_at TEXT,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('review', 'issue')),
  PRIMARY KEY (scope_id, event_id),
  FOREIGN KEY (scope_id) REFERENCES claim_scope(scope_id),
  CHECK ((occurred_at IS NULL) = (c2_expires_at IS NULL))
) STRICT;
CREATE TABLE IF NOT EXISTS v2_store_provenance (
  -- The C0 bridge row is PRESERVED verbatim, so this DDL mirrors the v2 source
  -- shape in server/api/v2/store.ts: both recorded modes, a nullable marker, the
  -- opaque activation_card_id, and the same mode/marker/card XOR. Narrowing it to
  -- synthetic-only would make a well-formed activation_card store unmigratable
  -- while the v2 writer can still produce one. Serving is a SEPARATE gate: the v2
  -- read path still refuses to SERVE activation_card provenance (ADR-04), and this
  -- store is refused by the v2 reader on application_id/user_version anyway.
  singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
  mode TEXT NOT NULL CHECK (mode IN ('synthetic', 'activation_card')),
  synthetic_marker TEXT,
  activation_card_id TEXT CHECK (activation_card_id IS NULL OR (${token('activation_card_id')})),
  importer_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (
    (mode = 'synthetic' AND synthetic_marker IS NOT NULL AND activation_card_id IS NULL)
    OR (mode = 'activation_card' AND synthetic_marker IS NULL AND activation_card_id IS NOT NULL)
  )
) STRICT;
CREATE TABLE IF NOT EXISTS v2_coverage_record (
  coverage_id TEXT PRIMARY KEY NOT NULL CHECK (${token('coverage_id')}),
  capability_id TEXT NOT NULL CHECK (${token('capability_id')}),
  scope_alias TEXT NOT NULL CHECK (${token('scope_alias')}),
  range_start TEXT NOT NULL,
  range_end TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (${quoted(COVERAGE_STATUSES)})),
  expected_units INTEGER CHECK (expected_units IS NULL OR expected_units >= 0),
  observed_units INTEGER NOT NULL CHECK (observed_units >= 0),
  omitted_units INTEGER CHECK (omitted_units IS NULL OR omitted_units >= 0),
  saturation_reason TEXT CHECK (saturation_reason IS NULL OR saturation_reason NOT GLOB '*[^A-Z0-9_]*'),
  retryable INTEGER NOT NULL CHECK (retryable IN (0, 1)),
  observed_at TEXT NOT NULL,
  limitation_code TEXT NOT NULL CHECK (limitation_code NOT GLOB '*[^A-Z0-9_]*'),
  CHECK (range_start < range_end)
) STRICT;
CREATE TABLE IF NOT EXISTS collection_job (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  job_id TEXT NOT NULL CHECK (${key('job_id', 'job-')}),
  capability_id TEXT NOT NULL CHECK (capability_id = 'github.core'),
  storage_contract_version TEXT NOT NULL CHECK (${token('storage_contract_version', 64)}),
  query_version TEXT NOT NULL CHECK (${token('query_version', 64)}),
  source_api_version TEXT NOT NULL CHECK (${token('source_api_version', 64)}),
  consent_revision TEXT NOT NULL CHECK (${token('consent_revision', 128)}),
  status TEXT NOT NULL CHECK (status IN ('complete', 'truncated', 'failed', 'restricted')),
  source_job_id TEXT CHECK (source_job_id IS NULL OR ${token('source_job_id', 128)}),
  payload_hash TEXT CHECK (payload_hash IS NULL OR (length(payload_hash) = 64 AND payload_hash NOT GLOB '*[^0-9a-f]*')),
  range_start TEXT, range_end TEXT, observed_at TEXT, started_at TEXT, completed_at TEXT, c2_expires_at TEXT,
  PRIMARY KEY (scope_id, job_id),
  FOREIGN KEY (scope_id) REFERENCES claim_scope(scope_id),
  UNIQUE (scope_id, job_id, capability_id),
  CHECK ((source_job_id IS NULL) = (payload_hash IS NULL)),
  CHECK ((source_job_id IS NULL) = (range_start IS NULL)),
  CHECK ((source_job_id IS NULL) = (range_end IS NULL)),
  CHECK ((source_job_id IS NULL) = (observed_at IS NULL)),
  CHECK ((source_job_id IS NULL) = (started_at IS NULL)),
  CHECK ((source_job_id IS NULL) = (completed_at IS NULL)),
  CHECK ((source_job_id IS NULL) = (c2_expires_at IS NULL)),
  CHECK (range_start IS NULL OR range_start < range_end),
  CHECK (started_at IS NULL OR started_at <= completed_at)
) STRICT;
CREATE TABLE IF NOT EXISTS collection_checkpoint (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  checkpoint_id TEXT NOT NULL CHECK (${key('checkpoint_id', 'ckpt-')}),
  job_id TEXT NOT NULL CHECK (${key('job_id', 'job-')}),
  snapshot_id TEXT NOT NULL CHECK (${key('snapshot_id', 'snap-')}),
  capability_id TEXT NOT NULL CHECK (capability_id = 'github.core'),
  query_version TEXT NOT NULL CHECK (${token('query_version', 64)}),
  source_api_version TEXT NOT NULL CHECK (${token('source_api_version', 64)}),
  consent_revision TEXT NOT NULL CHECK (${token('consent_revision', 128)}),
  coverage_state TEXT NOT NULL CHECK (${token('coverage_state', 64)}),
  deletion_order INTEGER NOT NULL CHECK (deletion_order >= 0),
  lineage_coverage TEXT NOT NULL CHECK (${token('lineage_coverage', 64)}),
  high_watermark TEXT,
  cursor_hint TEXT CHECK (cursor_hint IS NULL OR ${token('cursor_hint', 128)}),
  bounded_overlap_start TEXT,
  last_complete_snapshot_hash TEXT CHECK (last_complete_snapshot_hash IS NULL OR (length(last_complete_snapshot_hash) = 64 AND last_complete_snapshot_hash NOT GLOB '*[^0-9a-f]*')),
  c2_expires_at TEXT,
  PRIMARY KEY (scope_id, checkpoint_id),
  FOREIGN KEY (scope_id, job_id) REFERENCES collection_job(scope_id, job_id),
  -- The snapshot edge carries job_id so a checkpoint cannot select a snapshot
  -- produced by a DIFFERENT job in the same scope (#128 late review).
  FOREIGN KEY (scope_id, snapshot_id, job_id) REFERENCES source_snapshot(scope_id, snapshot_id, job_id),
  UNIQUE (scope_id, checkpoint_id, job_id),
  CHECK ((bounded_overlap_start IS NULL) = (last_complete_snapshot_hash IS NULL)),
  CHECK ((bounded_overlap_start IS NULL) = (c2_expires_at IS NULL)),
  CHECK (bounded_overlap_start IS NOT NULL OR (high_watermark IS NULL AND cursor_hint IS NULL))
) STRICT;
CREATE TABLE IF NOT EXISTS source_snapshot (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  snapshot_id TEXT NOT NULL CHECK (${key('snapshot_id', 'snap-')}),
  job_id TEXT NOT NULL CHECK (${key('job_id', 'job-')}),
  capability_id TEXT NOT NULL CHECK (capability_id = 'github.core'),
  source_snapshot_id TEXT CHECK (source_snapshot_id IS NULL OR ${token('source_snapshot_id', 128)}),
  snapshot_hash TEXT CHECK (snapshot_hash IS NULL OR (length(snapshot_hash) = 64 AND snapshot_hash NOT GLOB '*[^0-9a-f]*')),
  range_start TEXT, range_end TEXT, observed_at TEXT, c2_expires_at TEXT,
  status TEXT NOT NULL CHECK (status = 'closed'),
  PRIMARY KEY (scope_id, snapshot_id),
  FOREIGN KEY (scope_id, job_id) REFERENCES collection_job(scope_id, job_id),
  -- Parent key for the job-pinned snapshot edges of coverage_ledger and
  -- collection_checkpoint. On its own it constrains nothing (#128 late review).
  UNIQUE (scope_id, snapshot_id, job_id),
  CHECK ((source_snapshot_id IS NULL) = (snapshot_hash IS NULL)),
  CHECK ((source_snapshot_id IS NULL) = (range_start IS NULL)),
  CHECK ((source_snapshot_id IS NULL) = (range_end IS NULL)),
  CHECK ((source_snapshot_id IS NULL) = (observed_at IS NULL)),
  CHECK ((source_snapshot_id IS NULL) = (c2_expires_at IS NULL)),
  CHECK (range_start IS NULL OR range_start < range_end)
) STRICT;
CREATE TABLE IF NOT EXISTS coverage_ledger (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  coverage_id TEXT NOT NULL CHECK (${key('coverage_id', 'cov-')}),
  job_id TEXT NOT NULL CHECK (${key('job_id', 'job-')}),
  snapshot_id TEXT,
  capability_id TEXT NOT NULL CHECK (capability_id = 'github.core'),
  status TEXT NOT NULL CHECK (status IN ('complete', 'truncated', 'failed', 'restricted')),
  expected_units INTEGER CHECK (expected_units IS NULL OR expected_units >= 0),
  observed_units INTEGER NOT NULL CHECK (observed_units >= 0),
  omitted_units INTEGER CHECK (omitted_units IS NULL OR omitted_units >= 0),
  saturation_reason TEXT CHECK (saturation_reason IS NULL OR (length(saturation_reason) BETWEEN 1 AND 64 AND saturation_reason NOT GLOB '*[^A-Z0-9_]*')),
  retryable INTEGER NOT NULL CHECK (retryable IN (0, 1)),
  limitation_code TEXT NOT NULL CHECK (length(limitation_code) BETWEEN 1 AND 64 AND limitation_code NOT GLOB '*[^A-Z0-9_]*'),
  source_coverage_id TEXT CHECK (source_coverage_id IS NULL OR ${token('source_coverage_id')}),
  range_start TEXT, range_end TEXT, observed_at TEXT, c2_expires_at TEXT,
  PRIMARY KEY (scope_id, coverage_id),
  FOREIGN KEY (scope_id, job_id) REFERENCES collection_job(scope_id, job_id),
  -- Same job pinning as the checkpoint edge: a coverage row may only cite the
  -- snapshot of its OWN job. A NULL snapshot_id still satisfies the composite
  -- key (SQLite MATCH SIMPLE), so non-complete rows are unaffected.
  FOREIGN KEY (scope_id, snapshot_id, job_id) REFERENCES source_snapshot(scope_id, snapshot_id, job_id),
  CHECK ((status = 'complete' AND snapshot_id IS NOT NULL) OR (status <> 'complete' AND snapshot_id IS NULL)),
  CHECK ((source_coverage_id IS NULL) = (range_start IS NULL)),
  CHECK ((source_coverage_id IS NULL) = (range_end IS NULL)),
  CHECK ((source_coverage_id IS NULL) = (observed_at IS NULL)),
  CHECK ((source_coverage_id IS NULL) = (c2_expires_at IS NULL)),
  CHECK (range_start IS NULL OR range_start < range_end)
) STRICT;
CREATE TABLE IF NOT EXISTS evidence (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  evidence_id TEXT NOT NULL CHECK (${key('evidence_id', 'ev-')}),
  coverage_id TEXT NOT NULL CHECK (${key('coverage_id', 'cov-')}),
  layer TEXT NOT NULL CHECK (layer IN (${quoted(EVIDENCE_LAYERS)})),
  schema_version TEXT NOT NULL CHECK (schema_version = '${CANONICAL_ENVELOPE_SCHEMA_VERSION}'),
  PRIMARY KEY (scope_id, evidence_id),
  FOREIGN KEY (scope_id) REFERENCES claim_scope(scope_id),
  FOREIGN KEY (scope_id, coverage_id) REFERENCES coverage_ledger(scope_id, coverage_id)
) STRICT;
CREATE TABLE IF NOT EXISTS claim (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  claim_id TEXT NOT NULL CHECK (${key('claim_id', 'cl_')}),
  layer TEXT NOT NULL CHECK (layer IN (${quoted(CLAIM_LAYERS)})),
  statement_code TEXT NOT NULL CHECK (statement_code IN (${quoted(CLAIM_STATEMENT_CODES)})),
  method_id TEXT NOT NULL CHECK (${token('method_id', 128)}),
  method_version TEXT NOT NULL CHECK (${token('method_version', 64)}),
  window_start TEXT NOT NULL CHECK (${canonicalTimestampShape('window_start')}),
  window_end TEXT NOT NULL CHECK (${canonicalTimestampShape('window_end')}),
  schema_version TEXT NOT NULL CHECK (schema_version = '${CLAIM_SCHEMA_VERSION}'),
  claim_id_material_version TEXT NOT NULL CHECK (claim_id_material_version = '${CLAIM_MATERIAL_V3_PROPOSAL_VERSION}'),
  created_at TEXT CHECK (created_at IS NULL OR ${canonicalTimestampShape('created_at')}),
  superseded_by TEXT CHECK (superseded_by IS NULL OR ${key('superseded_by', 'cl_')}),
  PRIMARY KEY (scope_id, claim_id),
  FOREIGN KEY (scope_id) REFERENCES claim_scope(scope_id),
  FOREIGN KEY (scope_id, superseded_by) REFERENCES claim(scope_id, claim_id),
  CHECK (window_start < window_end),
  CHECK (superseded_by IS NULL OR superseded_by <> claim_id),
  CHECK ((layer = 'abstention') = (statement_code = '${CLAIM_ABSTENTION_STATEMENT_CODE}'))
) STRICT;
CREATE TABLE IF NOT EXISTS claim_evidence_edge (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  claim_id TEXT NOT NULL CHECK (${key('claim_id', 'cl_')}),
  role TEXT NOT NULL CHECK (role IN (${quoted(CLAIM_EDGE_ROLES)})),
  target_evidence_id TEXT CHECK (target_evidence_id IS NULL OR ${key('target_evidence_id', 'ev-')}),
  target_claim_id TEXT CHECK (target_claim_id IS NULL OR ${key('target_claim_id', 'cl_')}),
  target_coverage_id TEXT CHECK (target_coverage_id IS NULL OR ${key('target_coverage_id', 'cov-')}),
  FOREIGN KEY (scope_id, claim_id) REFERENCES claim(scope_id, claim_id),
  FOREIGN KEY (scope_id, target_evidence_id) REFERENCES evidence(scope_id, evidence_id),
  FOREIGN KEY (scope_id, target_claim_id) REFERENCES claim(scope_id, claim_id),
  FOREIGN KEY (scope_id, target_coverage_id) REFERENCES coverage_ledger(scope_id, coverage_id),
  CHECK ((target_evidence_id IS NOT NULL) + (target_claim_id IS NOT NULL) + (target_coverage_id IS NOT NULL) = 1),
  CHECK ((role = 'derives_from' AND target_claim_id IS NOT NULL) OR (role = 'coverage_basis' AND target_coverage_id IS NOT NULL) OR (role IN (${quoted(CLAIM_EVIDENCE_EDGE_ROLES)}) AND target_evidence_id IS NOT NULL)),
  CHECK (target_claim_id IS NULL OR target_claim_id <> claim_id)
) STRICT;
CREATE UNIQUE INDEX IF NOT EXISTS source_snapshot_closed_job_identity ON source_snapshot (
  scope_id, job_id
) WHERE status = 'closed';
CREATE UNIQUE INDEX IF NOT EXISTS claim_evidence_edge_identity ON claim_evidence_edge (
  scope_id, claim_id, role, COALESCE(target_evidence_id, target_claim_id, target_coverage_id)
);
CREATE TABLE IF NOT EXISTS limitation_instance (
  scope_id TEXT NOT NULL CHECK (${c1('scope_id')}),
  claim_id TEXT NOT NULL CHECK (${key('claim_id', 'cl_')}),
  limitation_code TEXT NOT NULL CHECK (limitation_code IN (${quoted(CLAIM_LIMITATION_CODES)})),
  dimension TEXT NOT NULL CHECK (dimension IN (${quoted(CLAIM_LIMITATION_DIMENSIONS)})),
  copy_key TEXT NOT NULL CHECK (${token('copy_key', 128)}),
  PRIMARY KEY (scope_id, claim_id, limitation_code, dimension, copy_key),
  FOREIGN KEY (scope_id, claim_id) REFERENCES claim(scope_id, claim_id)
) STRICT;
CREATE TABLE IF NOT EXISTS lineage_event (
  scope_id TEXT REFERENCES claim_scope(scope_id),
  subject_kind TEXT NOT NULL CHECK (subject_kind IN (${quoted(LINEAGE_V3_SUBJECT_KINDS)})),
  subject_id TEXT NOT NULL CHECK (${token('subject_id')}),
  operation_id TEXT NOT NULL CHECK (${token('operation_id')}),
  capability_id TEXT NOT NULL CHECK (capability_id = 'github.core'),
  caused_by TEXT CHECK (caused_by IS NULL OR ${token('caused_by')}),
  event_kind TEXT NOT NULL CHECK (event_kind IN (${quoted(LINEAGE_V3_EVENT_KINDS)})),
  event_week TEXT NOT NULL CHECK (${isoWeek('event_week')}),
  PRIMARY KEY (subject_kind, subject_id, event_kind, operation_id, event_week),
  CHECK ((event_kind IN (${quoted(LINEAGE_V3_DELETION_EVENT_KINDS)}) AND ${key('operation_id', 'del-')}) OR (event_kind NOT IN (${quoted(LINEAGE_V3_DELETION_EVENT_KINDS)}) AND ${key('operation_id', 'op-')})),
  CHECK ((subject_kind = 'scope' AND ${c1('subject_id')}) OR (subject_kind = 'claim' AND ${key('subject_id', 'cl_')}) OR (subject_kind = 'job' AND ${key('subject_id', 'job-')}) OR (subject_kind = 'snapshot' AND ${key('subject_id', 'snap-')}) OR (subject_kind = 'checkpoint' AND ${key('subject_id', 'ckpt-')}) OR (subject_kind = 'coverage' AND ${key('subject_id', 'cov-')}) OR (subject_kind = 'evidence' AND ${key('subject_id', 'ev-')}) OR (subject_kind = 'artifact' AND ${key('subject_id', 'art-')}) OR (subject_kind = 'deletion' AND ${key('subject_id', 'del-')})),
  CHECK (caused_by IS NULL OR ${c1('caused_by')} OR ${key('caused_by', 'cl_')} OR ${key('caused_by', 'job-')} OR ${key('caused_by', 'snap-')} OR ${key('caused_by', 'ckpt-')} OR ${key('caused_by', 'cov-')} OR ${key('caused_by', 'ev-')} OR ${key('caused_by', 'art-')} OR ${key('caused_by', 'op-')} OR ${key('caused_by', 'del-')}),
  CHECK ((event_kind = 'scope_alias_expired' AND subject_kind = 'scope') OR (event_kind <> 'scope_alias_expired')),
  CHECK ((event_kind = 'c2_retention_expired' AND subject_kind IN ('job', 'snapshot', 'checkpoint', 'coverage')) OR (event_kind <> 'c2_retention_expired')),
  CHECK ((event_kind = 'scope_series_restarted' AND subject_kind = 'scope') OR (event_kind <> 'scope_series_restarted')),
  CHECK ((event_kind = 'legacy_deletion_operation' AND subject_kind = 'deletion' AND operation_id = subject_id) OR (event_kind <> 'legacy_deletion_operation')),
  CHECK ((event_kind = 'legacy_deletion_operation' AND scope_id IS NULL) OR (event_kind IN (${quoted(LINEAGE_V3_DELETION_EVENT_KINDS.filter((kind) => kind !== 'legacy_deletion_operation'))}) AND (scope_id IS NULL OR ${c1('scope_id')})) OR (event_kind NOT IN (${quoted(LINEAGE_V3_DELETION_EVENT_KINDS)}) AND scope_id IS NOT NULL AND ${c1('scope_id')})),
  CHECK (event_kind <> 'scope_series_restarted' OR caused_by IS NULL)
) STRICT;
CREATE UNIQUE INDEX IF NOT EXISTS lineage_retention_event_identity ON lineage_event (
  scope_id, subject_kind, subject_id, event_kind, event_week
) WHERE event_kind IN ('scope_alias_expired', 'c2_retention_expired');
${ownerIdentityIndexSqlBlock}
${ownerIdentityTriggerSqlBlock}
${immutableTriggerSqlBlock}
${immutableInsertTriggerSqlBlock}
${identityBindingTriggerSqlBlock}
${coverageIdentityTriggerSqlBlock}
${lineageScopeTriggerSql}
${c2RetentionOwnerTriggerSql}
${sourceSnapshotGuardSql}
${lineageOwnerTriggerSqlBlock}
${continuityCasSqlBlock}
${artifactLifecycleSqlBlock}
`

export interface StorageV3ShadowResult {
  readonly completeB1b: false
  readonly selectable: false
  readonly status: 'incomplete'
  readonly schemaVersion: typeof STORAGE_V3_SHADOW_SCHEMA_VERSION
}

export const STORAGE_V3_SHADOW_RESULT: StorageV3ShadowResult = Object.freeze({
  completeB1b: false,
  selectable: false,
  status: 'incomplete',
  schemaVersion: STORAGE_V3_SHADOW_SCHEMA_VERSION,
})

interface ShadowSchemaObject {
  readonly type: 'table' | 'index' | 'trigger'
  readonly name: string
  readonly tableName: string
  readonly sql: string
}

interface ShadowSchemaRow {
  readonly type: string
  readonly name: string
  readonly tbl_name: string
  readonly sql: string | null
}

/** Normalize SQLite syntax while preserving the byte-exact contents of string literals. */
function normalizeSchemaSql(sql: string): string {
  const trimmed = sql.replace(/;\s*$/, '')
  const parts: string[] = []
  let index = 0
  while (index < trimmed.length) {
    const quote = trimmed.indexOf("'", index)
    const outside = quote === -1 ? trimmed.slice(index) : trimmed.slice(index, quote)
    parts.push(outside.replace(/\bIF\s+NOT\s+EXISTS\b/gi, '').replace(/\s+/g, ' ').toLowerCase())
    if (quote === -1) break
    let end = quote + 1
    while (end < trimmed.length && (trimmed[end] !== "'" || trimmed[end + 1] === "'")) {
      end += trimmed[end] === "'" ? 2 : 1
    }
    if (end >= trimmed.length) throw new Error('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
    parts.push(trimmed.slice(quote, end + 1))
    index = end + 1
  }
  return parts.join('').replace(/^ | $/g, '')
}

/** Split DDL while retaining semicolons inside trigger BEGIN/END bodies. */
function splitSchemaStatements(sql: string): string[] {
  const statements: string[] = []
  let start = 0
  let quote: "'" | null = null
  let beginDepth = 0
  let wordStart = -1
  const flushWord = (end: number): void => {
    if (wordStart < 0) return
    const word = sql.slice(wordStart, end).toUpperCase()
    if (word === 'BEGIN') beginDepth += 1
    else if (word === 'END' && beginDepth > 0) beginDepth -= 1
    wordStart = -1
  }
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]
    if (quote !== null) {
      if (character === quote) {
        if (sql[index + 1] === quote) {
          index += 1
        } else {
          quote = null
        }
      }
      continue
    }
    if (character === "'") {
      flushWord(index)
      quote = character
      continue
    }
    if (/[A-Za-z0-9_]/.test(character)) {
      if (wordStart < 0) wordStart = index
      continue
    }
    flushWord(index)
    if (character === ';' && beginDepth === 0) {
      const statement = sql.slice(start, index).trim()
      if (statement.length > 0) statements.push(statement)
      start = index + 1
    }
  }
  flushWord(sql.length)
  const trailing = sql.slice(start).trim()
  if (trailing.length > 0) statements.push(trailing)
  if (quote !== null || beginDepth !== 0) throw new Error('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
  return statements
}

function parseShadowSchemaObjects(): readonly ShadowSchemaObject[] {
  return splitSchemaStatements(STORAGE_V3_SHADOW_SCHEMA_SQL)
    .filter((statement) => /^\s*create\s+(?:unique\s+)?(?:table|index|trigger)\b/i.test(statement))
    .map((sql) => {
      const match = sql.match(
        /^\s*CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX|TRIGGER)\s+IF\s+NOT\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)/i,
      )
      if (!match) throw new Error('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
      const type = match[1].toLowerCase() as ShadowSchemaObject['type']
      const name = match[2]
      const tableName = type === 'table'
        ? name
        : sql.match(/\bON\s+([A-Za-z_][A-Za-z0-9_]*)/i)?.[1]
      if (!tableName) throw new Error('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
      return { type, name, tableName, sql }
    })
}

const shadowSchemaObjects = parseShadowSchemaObjects()
const shadowSchemaObjectNames = shadowSchemaObjects.map(({ name }) => name)
const fingerprintSchemaRows = (rows: readonly ShadowSchemaRow[]): string => createHash('sha256').update(
  rows
    .map(({ type, name, tbl_name: tableName, sql }) => {
      if (sql === null) throw new Error('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
      return [type, name, tableName, normalizeSchemaSql(sql)].join('|')
    })
    .sort()
    .join('\n'),
).digest('hex')

const schemaContractFingerprint = fingerprintSchemaRows(
  shadowSchemaObjects.map(({ type, name, tableName, sql }) => ({
    type,
    name,
    tbl_name: tableName,
    sql,
  })),
)
export const STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT = schemaContractFingerprint

/** Fingerprint the installed shadow DDL using the same normalization as the contract. */
export function storageV3ShadowSchemaFingerprint(db: Database.Database): string {
  return fingerprintSchemaRows(
    db.prepare(
      "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
    ).all() as ShadowSchemaRow[],
  )
}

function hasOwnedTempSchemaObject(db: Database.Database): boolean {
  const objectPlaceholders = shadowSchemaObjectNames.map(() => '?').join(', ')
  const tablePlaceholders = STORAGE_V3_SHADOW_TABLES.map(() => '?').join(', ')
  return db.prepare(
    `SELECT 1 FROM sqlite_temp_schema
     WHERE name COLLATE NOCASE IN (${objectPlaceholders})
        OR (
          tbl_name COLLATE NOCASE IN (${tablePlaceholders})
          AND type IN ('index', 'trigger')
          AND name NOT GLOB 'sqlite_autoindex_*'
        )
     LIMIT 1`,
  ).get(...shadowSchemaObjectNames, ...STORAGE_V3_SHADOW_TABLES) !== undefined
}

export function storageV3ShadowResult(): StorageV3ShadowResult {
  return STORAGE_V3_SHADOW_RESULT
}

export function installStorageV3ShadowSchema(db: Database.Database): StorageV3ShadowResult {
  validateStorageV3Dispositions()
  const applicationId = Number(db.prepare('PRAGMA application_id').pluck().get())
  const userVersion = Number(db.prepare('PRAGMA user_version').pluck().get())
  const existing = db.prepare("SELECT 1 FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' LIMIT 1").get() !== undefined
  const hasExpectedIdentity = applicationId === STORAGE_V3_SHADOW_APPLICATION_ID
    && userVersion === STORAGE_V3_SHADOW_USER_VERSION
  if ((applicationId !== 0 || userVersion !== 0) && !hasExpectedIdentity) {
    throw new Error('STORAGE_V3_SHADOW_TARGET_MISMATCH')
  }
  if (existing && !hasExpectedIdentity) {
    throw new Error('STORAGE_V3_SHADOW_TARGET_MISMATCH')
  }
  if (
    existing
    && hasExpectedIdentity
    && storageV3ShadowSchemaFingerprint(db) !== STORAGE_V3_SHADOW_SCHEMA_FINGERPRINT
  ) {
    throw new Error('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
  }
  if (hasOwnedTempSchemaObject(db)) throw new Error('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
  db.pragma('foreign_keys = ON')
  if (Number(db.prepare('PRAGMA foreign_keys').pluck().get()) !== 1) {
    throw new Error('STORAGE_V3_SHADOW_FOREIGN_KEY_MISMATCH')
  }
  return db.transaction(() => {
    if (!existing) {
      db.pragma(`application_id = ${STORAGE_V3_SHADOW_APPLICATION_ID}`)
      db.pragma(`user_version = ${STORAGE_V3_SHADOW_USER_VERSION}`)
    }
    db.exec(STORAGE_V3_SHADOW_SCHEMA_SQL)
    const installed = db.prepare(
      `SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    ).all() as Array<{ name: string }>
    const expected = [...STORAGE_V3_SHADOW_TABLES].sort()
    const actual = installed.map(({ name }) => name)
    if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
      throw new Error('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
    }
    const fingerprint = fingerprintSchemaRows(
      db.prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
      ).all() as ShadowSchemaRow[],
    )
    if (fingerprint !== schemaContractFingerprint) throw new Error('STORAGE_V3_SHADOW_SCHEMA_MISMATCH')
    if (db.prepare('PRAGMA foreign_key_check').get() !== undefined) {
      throw new Error('STORAGE_V3_SHADOW_FOREIGN_KEY_MISMATCH')
    }
    return STORAGE_V3_SHADOW_RESULT
  })()
}

/** The tables a v2 source also carries; the rewrite reads and writes only these. */
export const STORAGE_V3_SHADOW_MIGRATED_TABLES: readonly StorageV3Table[] = STORAGE_V3_TABLES
/** Every table the installed shadow store owns: migrated tables plus CAS state. */
export const STORAGE_V3_SHADOW_TABLES = [
  ...STORAGE_V3_TABLES,
  ...STORAGE_V3_CONTINUITY_CAS_TABLES,
  ...STORAGE_V3_ARTIFACT_TABLES,
] as const
export type StorageV3ShadowTable = typeof STORAGE_V3_SHADOW_TABLES[number]
export const STORAGE_V3_SHADOW_DISPOSITIONS = STORAGE_V3_DISPOSITIONS
