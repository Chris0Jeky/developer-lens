import Database from 'better-sqlite3'
import {
  ChangeBatchIntegrationTailPresentationSchema,
} from '../../shared/changeBatchIntegrationTail.js'
import { SYNTHETIC_STORE_MARKER } from '../../shared/storeProvenance.js'
import { installStorageV3ShadowSchema } from '../storage/v3ShadowSchema.js'
import {
  bridgeV3StoredObservation,
  type V3StoredObservationComplete,
} from './v3StoredObservationBridge.js'

export const SYNTHETIC_STORED_OBSERVATION_SCOPE = `scope-${'7'.repeat(64)}`
export const SYNTHETIC_STORED_OBSERVATION_CONSENT = 'invented-consent-v1'
export const SYNTHETIC_STORED_OBSERVATION_BASELINE = {
  start: '2026-06-05T00:00:00.000Z',
  end: '2026-07-03T00:00:00.000Z',
} as const
export const SYNTHETIC_STORED_OBSERVATION_CURRENT = {
  start: '2026-07-03T00:00:00.000Z',
  end: '2026-07-31T00:00:00.000Z',
} as const
export const SYNTHETIC_STORED_OBSERVATION_AS_OF = '2026-08-01T00:00:00.000Z'

const expiresAt = '2027-08-01T00:00:00.000Z'
const payloadHash = 'a'.repeat(64)
const id = (prefix: string, value: number): string => `${prefix}${String(value).padStart(64, '0')}`

function addCoverage(
  db: Database.Database,
  window: { readonly start: string; readonly end: string },
  ordinal: number,
): void {
  const jobId = id('job-', ordinal)
  const snapshotId = id('snap-', ordinal)
  db.prepare(`INSERT INTO collection_job (
    scope_id, job_id, capability_id, storage_contract_version, query_version,
    source_api_version, consent_revision, status, source_job_id, payload_hash,
    range_start, range_end, observed_at, started_at, completed_at, c2_expires_at
  ) VALUES (?, ?, 'github.core', '3.2.6', 'github.core.v1', '2026-03-10', ?, 'complete', ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      SYNTHETIC_STORED_OBSERVATION_SCOPE,
      jobId,
      SYNTHETIC_STORED_OBSERVATION_CONSENT,
      `invented-source-job-${ordinal}`,
      payloadHash,
      window.start,
      window.end,
      window.end,
      window.start,
      window.end,
      expiresAt,
    )
  db.prepare(`INSERT INTO source_snapshot (
    scope_id, snapshot_id, job_id, capability_id, source_snapshot_id, snapshot_hash,
    range_start, range_end, observed_at, c2_expires_at, status
  ) VALUES (?, ?, ?, 'github.core', ?, ?, ?, ?, ?, ?, 'closed')`)
    .run(
      SYNTHETIC_STORED_OBSERVATION_SCOPE,
      snapshotId,
      jobId,
      `invented-source-snapshot-${ordinal}`,
      payloadHash,
      window.start,
      window.end,
      window.end,
      expiresAt,
    )
  db.prepare(`INSERT INTO coverage_ledger (
    scope_id, coverage_id, job_id, snapshot_id, capability_id, status,
    expected_units, observed_units, omitted_units, retryable, limitation_code,
    source_coverage_id, range_start, range_end, observed_at, c2_expires_at
  ) VALUES (?, ?, ?, ?, 'github.core', 'complete', 24, 24, 0, 0, 'COMPLETE', ?, ?, ?, ?, ?)`)
    .run(
      SYNTHETIC_STORED_OBSERVATION_SCOPE,
      id('cov-', ordinal),
      jobId,
      snapshotId,
      `invented-source-coverage-${ordinal}`,
      window.start,
      window.end,
      window.end,
      expiresAt,
    )
}

function addFacts(
  db: Database.Database,
  window: { readonly start: string; readonly end: string },
  windowOrdinal: number,
): void {
  const insert = db.prepare(`INSERT INTO pull_request_fact (
    scope_id, fact_id, number, created_at, merged_at, closed_at, c2_expires_at,
    state, is_draft, additions, deletions, changed_files, comments, reviews,
    ready_for_review_at, ready_for_review_basis
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, 0, ?, 'creation_observed_never_draft')`)
  let ordinal = windowOrdinal * 100
  for (const [groupIndex, batchValue, changedFiles, baseDays] of [
    [0, 10, 1, 2],
    [1, 100, 5, 4],
    [2, 1_000, 12, windowOrdinal === 2 ? 9 : 7],
  ] as const) {
    for (let index = 0; index < 6; index += 1) {
      ordinal += 1
      const ready = new Date(Date.parse(window.start) + (index + 1) * 86_400_000).toISOString()
      const merged = new Date(Date.parse(ready) + (baseDays + (index % 2)) * 86_400_000).toISOString()
      insert.run(
        SYNTHETIC_STORED_OBSERVATION_SCOPE,
        id('pr-', ordinal),
        ordinal,
        ready,
        merged,
        null,
        expiresAt,
        'MERGED',
        Math.floor(batchValue / 2),
        Math.ceil(batchValue / 2),
        changedFiles,
        ready,
      )
    }
    ordinal += 1
    const openReady = new Date(Date.parse(window.start) + (8 + groupIndex) * 86_400_000).toISOString()
    insert.run(
      SYNTHETIC_STORED_OBSERVATION_SCOPE,
      id('pr-', ordinal),
      ordinal,
      openReady,
      null,
      null,
      expiresAt,
      'OPEN',
      Math.floor(batchValue / 2),
      Math.ceil(batchValue / 2),
      changedFiles,
      openReady,
    )
    ordinal += 1
    const closedReady = new Date(Date.parse(window.start) + (10 + groupIndex) * 86_400_000).toISOString()
    const closedAt = new Date(Date.parse(closedReady) + 2 * 86_400_000).toISOString()
    insert.run(
      SYNTHETIC_STORED_OBSERVATION_SCOPE,
      id('pr-', ordinal),
      ordinal,
      closedReady,
      null,
      closedAt,
      expiresAt,
      'CLOSED',
      Math.floor(batchValue / 2),
      Math.ceil(batchValue / 2),
      changedFiles,
      closedReady,
    )
  }
}

/** Caller-owned deterministic invented storage-v3 corpus for focused readers and fault fixtures. */
export function createSyntheticV3StoredObservationDatabase(): Database.Database {
  const db = new Database(':memory:')
  installStorageV3ShadowSchema(db)
  db.prepare(`INSERT INTO v2_store_provenance (
    singleton, mode, synthetic_marker, activation_card_id, importer_version, created_at
  ) VALUES (1, 'synthetic', ?, NULL, '1.0.0', ?)`)
    .run(SYNTHETIC_STORE_MARKER, SYNTHETIC_STORED_OBSERVATION_BASELINE.start)
  db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)')
    .run(SYNTHETIC_STORED_OBSERVATION_SCOPE)
  addCoverage(db, SYNTHETIC_STORED_OBSERVATION_BASELINE, 1)
  addCoverage(db, SYNTHETIC_STORED_OBSERVATION_CURRENT, 2)
  addFacts(db, SYNTHETIC_STORED_OBSERVATION_BASELINE, 1)
  addFacts(db, SYNTHETIC_STORED_OBSERVATION_CURRENT, 2)
  return db
}

/** Deterministic invented storage-v3 corpus used by the public exporter and focused proofs. */
export function buildSyntheticV3StoredObservation(): V3StoredObservationComplete {
  const db = createSyntheticV3StoredObservationDatabase()
  try {
    const result = bridgeV3StoredObservation({
      db,
      scopeId: SYNTHETIC_STORED_OBSERVATION_SCOPE,
      capabilityId: 'github.core',
      consentRevision: SYNTHETIC_STORED_OBSERVATION_CONSENT,
      baselineWindow: SYNTHETIC_STORED_OBSERVATION_BASELINE,
      currentWindow: SYNTHETIC_STORED_OBSERVATION_CURRENT,
      asOf: SYNTHETIC_STORED_OBSERVATION_AS_OF,
    })
    if (result.status !== 'complete') {
      throw new Error(`SYNTHETIC_STORED_OBSERVATION_${result.code}`)
    }
    return {
      ...result,
      envelope: ChangeBatchIntegrationTailPresentationSchema.parse({
        ...result.envelope,
        mode: 'synthetic',
      }),
    }
  } finally {
    db.close()
  }
}
