import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import {
  createStorageV3ArtifactRoot,
  registerSelectedStorageV3Artifact,
  STORAGE_V3_ARTIFACT_LOCATORS,
} from './v3ArtifactCatalogue.js'
import { v3BackupTestSeams } from './v3Backup.js'
import {
  registerStorageV3MigrationCleanup,
  STORAGE_V3_LEGACY_SOURCE_LOCATOR,
} from './v3MigrationCleanup.js'
import {
  v3ReaderSelectionTestSeams,
  type StorageV3ReaderSelection,
  type StorageV3ReaderSelectionInput,
} from './v3ReaderSelection.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import { taskInstallationKeyTestSeams } from './taskInstallationKey.js'

/**
 * Phase E (#174) invented selected-store fixtures. TEST SUPPORT ONLY — the `.test.` infix keeps
 * this file outside the storage-v3 import-boundary scan and outside the Vitest include set, and
 * nothing in production imports it.
 *
 * Every row is invented: fabricated content-free keys (`<prefix>-` + sha256 of a fixture tag),
 * fabricated instants, no account, repository, person or private history. The store is built in
 * an OS temp directory and published through the real selected-store path (artifact catalogue,
 * installation key, backup, cleanup registration, then `selectStorageV3Reader`'s proof seam), so
 * the bridge under test only ever receives a genuinely proven selection.
 */

export const FIXTURE_SCOPE = `scope-${'5'.repeat(64)}`
export const FIXTURE_OTHER_SCOPE = `scope-${'6'.repeat(64)}`
const BACKUP_ARTIFACT_ID = `art-${'1'.repeat(64)}`
const LEGACY_SOURCE_ID = `legacy-${'2'.repeat(64)}`
const BACKUP_AT = '2026-08-06T12:34:56Z'
const SUCCESS_AT = '2026-08-06T12:35:00.000Z'
export const FIXTURE_SYNTHETIC_MARKER = 'developer-lens.synthetic-importer.v1'

export const fixtureKey = (prefix: string, tag: string): string =>
  `${prefix}-${createHash('sha256').update(`phase-e-fixture/${prefix}/${tag}`).digest('hex')}`

export interface FixturePullRequest {
  readonly tag: string
  readonly scopeId?: string
  readonly createdAt: string | null
  readonly mergedAt?: string | null
  readonly closedAt?: string | null
  readonly state?: 'OPEN' | 'CLOSED' | 'MERGED'
  readonly isDraft?: boolean
  readonly additions?: number | null
  readonly deletions?: number | null
  readonly changedFiles?: number | null
  /** Defaults to far in the future (live). */
  readonly c2ExpiresAt?: string | null
}

export interface FixtureCoverage {
  readonly tag: string
  readonly scopeId?: string
  readonly rangeStart: string | null
  readonly rangeEnd: string | null
  readonly status?: 'complete' | 'truncated' | 'failed' | 'restricted'
  readonly jobStatus?: 'complete' | 'truncated' | 'failed' | 'restricted'
  readonly observedAt?: string
  readonly consentRevision?: string
  readonly expectedUnits?: number | null
  readonly observedUnits?: number
  readonly omittedUnits?: number | null
  readonly c2ExpiresAt?: string
}

export interface FixtureLineage {
  readonly scopeId?: string | null
  readonly subjectKind: string
  readonly subjectId: string
  readonly eventKind: string
  readonly eventWeek: string
  readonly causedBy?: string | null
  readonly operationTag: string
}

export interface InventedStoreSeed {
  readonly provenance?: 'synthetic' | 'activation_card' | 'absent'
  readonly pullRequests?: readonly FixturePullRequest[]
  readonly coverage?: readonly FixtureCoverage[]
  readonly lineage?: readonly FixtureLineage[]
}

export interface InventedSelectedStore {
  readonly root: string
  readonly input: StorageV3ReaderSelectionInput
  /** Run the real selected-store proof path and return its selection. */
  select(): StorageV3ReaderSelection
  cleanup(): void
}

const FAR_FUTURE = '2030-01-01T00:00:00.000Z'

function inferredState(pr: FixturePullRequest): 'OPEN' | 'CLOSED' | 'MERGED' {
  if (pr.state) return pr.state
  if (pr.mergedAt) return 'MERGED'
  if (pr.closedAt) return 'CLOSED'
  return 'OPEN'
}

function seedRows(db: Database.Database, seed: InventedStoreSeed): void {
  const provenance = seed.provenance ?? 'synthetic'
  if (provenance === 'synthetic') {
    db.prepare('INSERT INTO v2_store_provenance (singleton, mode, synthetic_marker, activation_card_id, importer_version, created_at) VALUES (1, ?, ?, NULL, ?, ?)')
      .run('synthetic', FIXTURE_SYNTHETIC_MARKER, '1.0.0', '2026-05-04T00:00:00.000Z')
  } else if (provenance === 'activation_card') {
    db.prepare('INSERT INTO v2_store_provenance (singleton, mode, synthetic_marker, activation_card_id, importer_version, created_at) VALUES (1, ?, NULL, ?, ?, ?)')
      .run('activation_card', 'invented-card-1', '1.0.0', '2026-05-04T00:00:00.000Z')
  }

  let number = 0
  for (const pr of seed.pullRequests ?? []) {
    number += 1
    const cleared = pr.createdAt === null
    db.prepare(
      `INSERT INTO pull_request_fact (scope_id, fact_id, number, created_at, merged_at, closed_at, c2_expires_at,
         state, is_draft, additions, deletions, changed_files, comments, reviews)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    ).run(
      pr.scopeId ?? FIXTURE_SCOPE,
      fixtureKey('pr', pr.tag),
      cleared ? null : number,
      pr.createdAt,
      cleared ? null : (pr.mergedAt ?? null),
      cleared ? null : (pr.closedAt ?? (pr.mergedAt ?? null)),
      cleared ? null : (pr.c2ExpiresAt ?? FAR_FUTURE),
      inferredState(pr),
      pr.isDraft ? 1 : 0,
      pr.additions === undefined ? 10 : pr.additions,
      pr.deletions === undefined ? 0 : pr.deletions,
      pr.changedFiles === undefined ? 1 : pr.changedFiles,
    )
  }

  for (const cov of seed.coverage ?? []) {
    const scopeId = cov.scopeId ?? FIXTURE_SCOPE
    const jobId = fixtureKey('job', cov.tag)
    const snapshotId = fixtureKey('snap', cov.tag)
    const status = cov.status ?? 'complete'
    const jobStatus = cov.jobStatus ?? 'complete'
    const cleared = cov.rangeStart === null || cov.rangeEnd === null
    const observedAt = cov.observedAt ?? cov.rangeEnd ?? null
    const expires = cov.c2ExpiresAt ?? FAR_FUTURE
    db.prepare(
      `INSERT INTO collection_job (scope_id, job_id, capability_id, storage_contract_version, query_version,
         source_api_version, consent_revision, status, source_job_id, payload_hash, range_start, range_end,
         observed_at, started_at, completed_at, c2_expires_at)
       VALUES (?, ?, 'github.core', '3.0.0', 'github.core.v1', '2026-03-10', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      scopeId, jobId, cov.consentRevision ?? 'consent-invented-1', jobStatus,
      cleared ? null : `source-job-${cov.tag}`,
      cleared ? null : 'a'.repeat(64),
      cov.rangeStart, cov.rangeEnd,
      cleared ? null : observedAt,
      cleared ? null : observedAt,
      cleared ? null : observedAt,
      cleared ? null : expires,
    )
    if (status === 'complete') {
      db.prepare(
        `INSERT INTO source_snapshot (scope_id, snapshot_id, job_id, capability_id, source_snapshot_id, snapshot_hash,
           range_start, range_end, observed_at, c2_expires_at, status)
         VALUES (?, ?, ?, 'github.core', ?, ?, ?, ?, ?, ?, 'closed')`,
      ).run(
        scopeId, snapshotId, jobId,
        cleared ? null : `source-snap-${cov.tag}`,
        cleared ? null : 'b'.repeat(64),
        cov.rangeStart, cov.rangeEnd,
        cleared ? null : observedAt,
        cleared ? null : expires,
      )
    }
    const expected = cov.expectedUnits === undefined ? 20 : cov.expectedUnits
    const observed = cov.observedUnits ?? (status === 'complete' ? (expected ?? 20) : 10)
    const omitted = cov.omittedUnits === undefined
      ? (expected === null ? null : expected - observed)
      : cov.omittedUnits
    db.prepare(
      `INSERT INTO coverage_ledger (scope_id, coverage_id, job_id, snapshot_id, capability_id, status, expected_units,
         observed_units, omitted_units, saturation_reason, retryable, limitation_code, source_coverage_id,
         range_start, range_end, observed_at, c2_expires_at)
       VALUES (?, ?, ?, ?, 'github.core', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
    ).run(
      scopeId, fixtureKey('cov', cov.tag), jobId,
      status === 'complete' ? snapshotId : null,
      status, expected, observed, omitted,
      status === 'truncated' ? 'SATURATION_CAP_REACHED' : null,
      status === 'complete' ? 'COMPLETE' : status.toUpperCase(),
      cleared ? null : `source-cov-${cov.tag}`,
      cov.rangeStart, cov.rangeEnd,
      cleared ? null : observedAt,
      cleared ? null : expires,
    )
  }

  for (const event of seed.lineage ?? []) {
    const deletionKind = ['tombstone_cascade', 'index_deleted', 'legacy_deletion_operation'].includes(event.eventKind)
    db.prepare(
      `INSERT INTO lineage_event (scope_id, subject_kind, subject_id, operation_id, capability_id, caused_by, event_kind, event_week)
       VALUES (?, ?, ?, ?, 'github.core', ?, ?, ?)`,
    ).run(
      event.scopeId === undefined ? FIXTURE_SCOPE : event.scopeId,
      event.subjectKind,
      event.subjectId,
      fixtureKey(deletionKind ? 'del' : 'op', event.operationTag),
      event.causedBy ?? null,
      event.eventKind,
      event.eventWeek,
    )
  }
}

/**
 * Build and publish an invented selected store. `selected: false` stops after seeding, leaving a
 * schema-valid SQLite file that was never accepted as the selected artifact (for refusal tests).
 */
export async function createInventedSelectedStore(
  seed: InventedStoreSeed,
  options: { readonly selected?: boolean } = {},
): Promise<InventedSelectedStore> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'developer-lens-phase-e-'))
  const taskId = 'DL-PHASE-E'
  const root = join(workspaceRoot, '.developer-lens', 'activation', taskId)
  mkdirSync(root, { recursive: true })
  const cleanup = (): void => rmSync(workspaceRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })
  const db = new Database(join(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
  try {
    installStorageV3ShadowSchema(db)
    db.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at, alias_expires_at) VALUES (?, ?, ?, ?)')
      .run(FIXTURE_SCOPE, 'invented-alias-phase-e', '2026-05-06T09:15:27.123Z', '2027-06-06T09:15:27.123Z')
    db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(FIXTURE_OTHER_SCOPE)
    seedRows(db, seed)
    const key = await taskInstallationKeyTestSeams.setupWithRandomBytes(
      { workspaceRoot, taskId },
      () => Buffer.alloc(32, 7),
    )
    const input: StorageV3ReaderSelectionInput = Object.freeze({
      directory: root,
      legacySourceId: LEGACY_SOURCE_ID,
      backupArtifactId: BACKUP_ARTIFACT_ID,
      backupAt: BACKUP_AT,
      installationKey: key,
    })
    if (options.selected !== false) {
      const rootHandle = createStorageV3ArtifactRoot(root)
      registerSelectedStorageV3Artifact(db, rootHandle, () => Buffer.alloc(32, 3))
      await v3BackupTestSeams.createWithDirectorySynchronizer({
        db,
        root: rootHandle,
        backupAt: BACKUP_AT,
        artifactId: BACKUP_ARTIFACT_ID,
        ownerScopeIds: [FIXTURE_SCOPE, FIXTURE_OTHER_SCOPE],
        installationKey: key,
      }, () => {})
      writeFileSync(join(root, STORAGE_V3_LEGACY_SOURCE_LOCATOR), '{"invented":true}\n', { flag: 'wx' })
      registerStorageV3MigrationCleanup({ db, root: rootHandle, legacySourceId: LEGACY_SOURCE_ID, installationKey: key })
    }
    db.close()
    return Object.freeze({
      root,
      input,
      select: () => v3ReaderSelectionTestSeams.selectWithProofDirectorySynchronizer(input, () => {}, SUCCESS_AT),
      cleanup,
    })
  } catch (error) {
    if (db.open) db.close()
    cleanup()
    throw error
  }
}
