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
 * and this module contains no reader, writer, selector, or migration caller.
 */
export const STORAGE_V3_SHADOW_SCHEMA_VERSION = '3.0.0-shadow-b2a' as const
export const STORAGE_V3_SHADOW_APPLICATION_ID = 0x444c5633
export const STORAGE_V3_SHADOW_USER_VERSION = 303

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

const lineageSubjectMismatch = lineageOwnerRegistry.map(({ subjectKind, tableName, idColumn }) =>
  `(NEW.subject_kind = '${subjectKind}' AND EXISTS (
    SELECT 1 FROM ${tableName} AS owner
    WHERE owner.${idColumn} = NEW.subject_id AND owner.scope_id IS NOT NEW.scope_id
  ))`).join('\n  OR ')

const lineageSubjectHistoryMismatch = [...new Set(lineageOwnerRegistry.map(({ subjectKind }) => subjectKind))]
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

const lineageCauseHistoryMismatch = [...new Set(lineageOwnerRegistry.map(({ prefix }) => prefix))]
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

const key = (column: string, prefix: string): string =>
  `length(${column}) = ${prefix.length + 64} AND ${column} GLOB '${prefix}*' AND substr(${column}, ${prefix.length + 1}) NOT GLOB '*[^0-9a-f]*'`
const c1 = (column: string): string => key(column, 'scope-')
const token = (column: string, max = 256): string =>
  `length(${column}) BETWEEN 1 AND ${max} AND ${column} NOT GLOB '*[^A-Za-z0-9:._-]*'`
const quoted = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ')

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
  singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
  mode TEXT NOT NULL CHECK (mode = 'synthetic'),
  synthetic_marker TEXT NOT NULL,
  importer_version TEXT NOT NULL,
  created_at TEXT NOT NULL
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
  FOREIGN KEY (scope_id, snapshot_id) REFERENCES source_snapshot(scope_id, snapshot_id),
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
  saturation_reason TEXT CHECK (saturation_reason IS NULL OR saturation_reason NOT GLOB '*[^A-Z0-9_]*'),
  retryable INTEGER NOT NULL CHECK (retryable IN (0, 1)),
  limitation_code TEXT NOT NULL CHECK (limitation_code NOT GLOB '*[^A-Z0-9_]*'),
  source_coverage_id TEXT CHECK (source_coverage_id IS NULL OR ${token('source_coverage_id')}),
  range_start TEXT, range_end TEXT, observed_at TEXT, c2_expires_at TEXT,
  PRIMARY KEY (scope_id, coverage_id),
  FOREIGN KEY (scope_id, job_id) REFERENCES collection_job(scope_id, job_id),
  FOREIGN KEY (scope_id, snapshot_id) REFERENCES source_snapshot(scope_id, snapshot_id),
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
  window_start TEXT NOT NULL, window_end TEXT NOT NULL,
  schema_version TEXT NOT NULL CHECK (schema_version = '${CLAIM_SCHEMA_VERSION}'),
  claim_id_material_version TEXT NOT NULL CHECK (claim_id_material_version = '${CLAIM_MATERIAL_V3_PROPOSAL_VERSION}'),
  created_at TEXT NOT NULL,
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
  event_week TEXT NOT NULL CHECK (
    length(event_week) = 8
    AND event_week GLOB '[0-9][0-9][0-9][0-9]-W[0-5][0-9]'
    AND substr(event_week, 7, 2) BETWEEN '01' AND '53'
    AND (
      substr(event_week, 7, 2) <> '53'
      OR strftime('%w', substr(event_week, 1, 4) || '-01-01') = '4'
      OR (
        strftime('%w', substr(event_week, 1, 4) || '-01-01') = '3'
        AND (
          CAST(substr(event_week, 1, 4) AS INTEGER) % 400 = 0
          OR (
            CAST(substr(event_week, 1, 4) AS INTEGER) % 4 = 0
            AND CAST(substr(event_week, 1, 4) AS INTEGER) % 100 <> 0
          )
        )
      )
    )
  ),
  PRIMARY KEY (subject_kind, subject_id, event_kind, operation_id, event_week),
  CHECK ((event_kind IN (${quoted(LINEAGE_V3_DELETION_EVENT_KINDS)}) AND ${key('operation_id', 'del-')}) OR (event_kind NOT IN (${quoted(LINEAGE_V3_DELETION_EVENT_KINDS)}) AND ${key('operation_id', 'op-')})),
  CHECK ((subject_kind = 'scope' AND ${c1('subject_id')}) OR (subject_kind = 'claim' AND ${key('subject_id', 'cl_')}) OR (subject_kind = 'job' AND ${key('subject_id', 'job-')}) OR (subject_kind = 'snapshot' AND ${key('subject_id', 'snap-')}) OR (subject_kind = 'checkpoint' AND ${key('subject_id', 'ckpt-')}) OR (subject_kind = 'coverage' AND ${key('subject_id', 'cov-')}) OR (subject_kind = 'evidence' AND ${key('subject_id', 'ev-')}) OR (subject_kind = 'artifact' AND ${key('subject_id', 'art-')}) OR (subject_kind = 'deletion' AND ${key('subject_id', 'del-')})),
  CHECK (caused_by IS NULL OR ${c1('caused_by')} OR ${key('caused_by', 'cl_')} OR ${key('caused_by', 'job-')} OR ${key('caused_by', 'snap-')} OR ${key('caused_by', 'ckpt-')} OR ${key('caused_by', 'cov-')} OR ${key('caused_by', 'ev-')} OR ${key('caused_by', 'art-')} OR ${key('caused_by', 'op-')} OR ${key('caused_by', 'del-')}),
  CHECK ((event_kind = 'scope_alias_expired' AND subject_kind = 'scope') OR (event_kind <> 'scope_alias_expired')),
  CHECK ((event_kind = 'scope_series_restarted' AND subject_kind = 'scope') OR (event_kind <> 'scope_series_restarted')),
  CHECK ((event_kind = 'legacy_deletion_operation' AND subject_kind = 'deletion' AND operation_id = subject_id) OR (event_kind <> 'legacy_deletion_operation')),
  CHECK ((event_kind = 'legacy_deletion_operation' AND scope_id IS NULL) OR (event_kind <> 'legacy_deletion_operation' AND scope_id IS NOT NULL AND ${c1('scope_id')})),
  CHECK (event_kind <> 'scope_series_restarted' OR caused_by IS NULL)
) STRICT;
${immutableTriggerSqlBlock}
${immutableInsertTriggerSqlBlock}
${identityBindingTriggerSqlBlock}
${lineageScopeTriggerSql}
${lineageOwnerTriggerSqlBlock}
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
  const tablePlaceholders = STORAGE_V3_TABLES.map(() => '?').join(', ')
  return db.prepare(
    `SELECT 1 FROM sqlite_temp_schema
     WHERE name COLLATE NOCASE IN (${objectPlaceholders})
        OR (
          tbl_name COLLATE NOCASE IN (${tablePlaceholders})
          AND type IN ('index', 'trigger')
          AND name NOT GLOB 'sqlite_autoindex_*'
        )
     LIMIT 1`,
  ).get(...shadowSchemaObjectNames, ...STORAGE_V3_TABLES) !== undefined
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
    const expected = [...STORAGE_V3_TABLES].sort()
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

export const STORAGE_V3_SHADOW_TABLES: readonly StorageV3Table[] = STORAGE_V3_TABLES
export const STORAGE_V3_SHADOW_DISPOSITIONS = STORAGE_V3_DISPOSITIONS
