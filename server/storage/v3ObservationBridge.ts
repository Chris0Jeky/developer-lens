import { SYNTHETIC_STORE_MARKER } from '../api/v2/contract.js'
import { isProvenStorageV3SelectedReader, type StorageV3SelectedReader } from './v3ReaderSelection.js'

/**
 * Phase E (#174) — the generic stored-observation bridge.
 *
 * Reads `pull_request_fact` plus the coverage, collection-job, source-snapshot and lineage rows
 * a window reading needs from an ACCEPTED, SELECTED storage-v3 store, over an explicit scope and
 * half-open window at an injected asOf. It is read-only and returns raw-but-bounded rows to the
 * server-side analysis; it never serves anything itself.
 *
 * Boundaries this module holds by construction:
 * - Selected-store proof path only. The input is the reader selection returned by
 *   `selectStorageV3Reader` (receipt, backup, cleanup, revocation replay and a read-only reopen
 *   through `openSelectedStorageV3StoreReadonly`). A selection-shaped object built anywhere else
 *   — for example around a handle opened on an arbitrary schema-valid SQLite path — is refused
 *   through `isProvenStorageV3SelectedReader`, so this module never opens a path itself and never
 *   imports the store opener (the storage-v3 import boundary stays exactly as it was).
 * - Synthetic provenance only. No capability is activated, so a store whose preserved provenance
 *   is anything but the synthetic importer's marker is refused, not read.
 * - Content-free outward shape. Storage identifiers stay inside the returned `internal` handles
 *   only so the analysis can link lineage to rows; the presentation layer replaces every one of
 *   them with an ordinal surrogate before anything can be served.
 * - No imputation. `readyForReviewAt` is reported as `not_recorded` for every row, because the
 *   stored schema carries no readiness instant; nothing here substitutes `createdAt` for it.
 */
export const STORED_OBSERVATION_BRIDGE_VERSION = '1.0.0' as const

export const STORED_OBSERVATION_REFUSAL_CODES = [
  'NOT_A_PROVEN_SELECTED_READER',
  'READER_NOT_READ_ONLY',
  'REQUEST_INVALID',
  'WINDOW_NOT_COMPLETE_AT_AS_OF',
  'STORE_PROVENANCE_NOT_SYNTHETIC',
  'UNKNOWN_SCOPE',
  'STORE_READ_FAILED',
] as const
export type StoredObservationRefusalCode = typeof STORED_OBSERVATION_REFUSAL_CODES[number]

export interface StoredObservationRequest {
  /** The content-free C1 scope key (`scope-` + 64 hex). Never an alias. */
  readonly scopeId: string
  readonly window: { readonly start: string; readonly end: string }
  readonly asOf: string
}

export type StoredRetentionState = 'live' | 'expired' | 'cleared'

export interface StoredPullRequestRow {
  /** Bridge-local ordinal (1-based, stable by storage key order). Never the storage key. */
  readonly ordinal: number
  readonly createdAt: string | null
  readonly mergedAt: string | null
  readonly closedAt: string | null
  readonly state: 'OPEN' | 'CLOSED' | 'MERGED'
  readonly isDraft: boolean
  readonly additions: number | null
  readonly deletions: number | null
  readonly changedFiles: number | null
  readonly retention: StoredRetentionState
  /** The stored schema has no readiness instant; this is explicit missingness, never createdAt. */
  readonly readyForReviewAt: { readonly status: 'not_recorded' }
}

export type StoredCoverageStatus = 'complete' | 'truncated' | 'failed' | 'restricted'

export interface StoredCoverageRow {
  readonly ordinal: number
  readonly status: StoredCoverageStatus
  readonly jobOrdinal: number
  readonly jobStatus: StoredCoverageStatus
  readonly consentOrdinal: number
  readonly instrumentOrdinal: number
  readonly snapshotClosed: boolean
  readonly expectedUnits: number | null
  readonly observedUnits: number
  readonly omittedUnits: number | null
  readonly saturationReason: string | null
  readonly limitationCode: string
  readonly retryable: boolean
  /** Null when the row's C2 range was cleared at its retention boundary. */
  readonly rangeStart: string | null
  readonly rangeEnd: string | null
  readonly observedAt: string | null
  readonly retention: StoredRetentionState
}

export interface StoredLineageRow {
  readonly subjectKind: string
  readonly eventKind: string
  readonly eventWeek: string
  /** The coverage/job ordinal the event names, or null when it names the scope or another subject. */
  readonly linkedCoverageOrdinal: number | null
  readonly linkedJobOrdinal: number | null
}

export interface StoredObservationSet {
  readonly bridgeVersion: typeof STORED_OBSERVATION_BRIDGE_VERSION
  readonly source: 'selected_v3_store'
  readonly request: StoredObservationRequest
  readonly scope: { readonly hasAlias: boolean; readonly linkedAt: string | null }
  readonly capabilityId: 'github.core'
  readonly pullRequests: readonly StoredPullRequestRow[]
  readonly coverage: readonly StoredCoverageRow[]
  readonly lineage: readonly StoredLineageRow[]
  /**
   * Every storage identifier and exact operational instant this read touched. Server-only: the
   * presentation canary asserts that none of these strings reaches a served byte.
   */
  readonly internal: { readonly forbiddenValues: readonly string[] }
}

export type StoredObservationBridgeResult =
  | { readonly status: 'refused'; readonly code: StoredObservationRefusalCode }
  | { readonly status: 'read'; readonly observation: StoredObservationSet }

const SCOPE_ID_PATTERN = /^scope-[0-9a-f]{64}$/
const CANONICAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** Content-free deletion/retention lineage kinds; no other kind is read. */
const LINEAGE_KINDS = [
  'tombstone_cascade',
  'index_deleted',
  'legacy_deletion_operation',
  'scope_alias_expired',
  'c2_retention_expired',
  'scope_series_restarted',
] as const

function refused(code: StoredObservationRefusalCode): StoredObservationBridgeResult {
  return Object.freeze({ status: 'refused' as const, code })
}

function validRequest(request: unknown): request is StoredObservationRequest {
  if (typeof request !== 'object' || request === null) return false
  const candidate = request as Partial<StoredObservationRequest>
  const window = candidate.window as { start?: unknown; end?: unknown } | undefined
  return typeof candidate.scopeId === 'string'
    && SCOPE_ID_PATTERN.test(candidate.scopeId)
    && typeof candidate.asOf === 'string' && CANONICAL_INSTANT.test(candidate.asOf)
    && typeof window === 'object' && window !== null
    && typeof window.start === 'string' && CANONICAL_INSTANT.test(window.start)
    && typeof window.end === 'string' && CANONICAL_INSTANT.test(window.end)
    && Date.parse(window.start) < Date.parse(window.end)
}

function retentionOf(expiresAt: string | null, cleared: boolean, asOf: string): StoredRetentionState {
  if (cleared) return 'cleared'
  if (expiresAt !== null && Date.parse(expiresAt) <= Date.parse(asOf)) return 'expired'
  return 'live'
}

interface PullRequestRecord {
  readonly fact_id: string
  readonly number: number | null
  readonly created_at: string | null
  readonly merged_at: string | null
  readonly closed_at: string | null
  readonly c2_expires_at: string | null
  readonly state: 'OPEN' | 'CLOSED' | 'MERGED'
  readonly is_draft: number
  readonly additions: number | null
  readonly deletions: number | null
  readonly changed_files: number | null
}

interface CoverageRecord {
  readonly coverage_id: string
  readonly job_id: string
  readonly snapshot_id: string | null
  readonly status: StoredCoverageStatus
  readonly expected_units: number | null
  readonly observed_units: number
  readonly omitted_units: number | null
  readonly saturation_reason: string | null
  readonly retryable: number
  readonly limitation_code: string
  readonly source_coverage_id: string | null
  readonly range_start: string | null
  readonly range_end: string | null
  readonly observed_at: string | null
  readonly c2_expires_at: string | null
  readonly job_status: StoredCoverageStatus
  readonly consent_revision: string
  readonly instrument: string
  readonly job_c2_expires_at: string | null
  readonly job_source_id: string | null
  readonly job_completed_at: string | null
  readonly job_started_at: string | null
  readonly job_observed_at: string | null
  readonly snapshot_status: string | null
  readonly snapshot_c2_expires_at: string | null
  readonly snapshot_observed_at: string | null
}

interface LineageRecord {
  readonly subject_kind: string
  readonly subject_id: string
  readonly event_kind: string
  readonly event_week: string
  readonly caused_by: string | null
  readonly operation_id: string
}

const WEEK_MS = 7 * 86_400_000
/** 1970-01-05 was a Monday: an instant at Monday 00:00Z is already at the ISO-week grain floor. */
const MONDAY_EPOCH_MS = Date.UTC(1970, 0, 5)

function isWeekAligned(value: string): boolean {
  const at = Date.parse(value)
  return CANONICAL_INSTANT.test(value) && !Number.isNaN(at) && (at - MONDAY_EPOCH_MS) % WEEK_MS === 0
}

/**
 * The request's own bounds are caller-chosen, not operational, and a week-aligned instant is
 * already at the allowed grain, so neither is a leak when it appears in a served projection.
 */
function servedSafe(values: ReadonlySet<string>, request: StoredObservationRequest): string[] {
  const requestBounds = new Set([request.window.start, request.window.end, request.asOf])
  return [...values].filter((value) => !requestBounds.has(value) && !isWeekAligned(value))
}

function collectForbidden(values: readonly unknown[], into: Set<string>): void {
  for (const value of values) {
    if (typeof value === 'string' && value.length >= 6) into.add(value)
  }
}

/**
 * Read the stored observations for one scope and window. Total: every failure is a typed,
 * content-free refusal, never a thrown driver message or a partial set.
 */
export function readStoredObservations(
  selection: StorageV3SelectedReader,
  request: StoredObservationRequest,
): StoredObservationBridgeResult {
  if (!isProvenStorageV3SelectedReader(selection)) return refused('NOT_A_PROVEN_SELECTED_READER')
  const db = selection.db
  if (!db.open || !db.readonly) return refused('READER_NOT_READ_ONLY')
  if (!validRequest(request)) return refused('REQUEST_INVALID')
  if (Date.parse(request.asOf) < Date.parse(request.window.end)) return refused('WINDOW_NOT_COMPLETE_AT_AS_OF')

  try {
    const provenance = db.prepare(
      'SELECT mode, synthetic_marker, activation_card_id FROM v2_store_provenance WHERE singleton = 1',
    ).all() as Array<{ mode: string; synthetic_marker: string | null; activation_card_id: string | null }>
    if (
      provenance.length !== 1
      || provenance[0].mode !== 'synthetic'
      || provenance[0].synthetic_marker !== SYNTHETIC_STORE_MARKER
      || provenance[0].activation_card_id !== null
    ) return refused('STORE_PROVENANCE_NOT_SYNTHETIC')

    const scopeRow = db.prepare(
      'SELECT scope_alias IS NOT NULL AS has_alias, linked_at FROM claim_scope WHERE scope_id = ?',
    ).get(request.scopeId) as { has_alias: number; linked_at: string | null } | undefined
    if (scopeRow === undefined) return refused('UNKNOWN_SCOPE')

    const forbidden = new Set<string>([request.scopeId])
    if (scopeRow.linked_at !== null) forbidden.add(scopeRow.linked_at)

    const facts = db.prepare(
      `SELECT fact_id, number, created_at, merged_at, closed_at, c2_expires_at, state, is_draft,
              additions, deletions, changed_files
         FROM pull_request_fact WHERE scope_id = ? ORDER BY fact_id`,
    ).all(request.scopeId) as PullRequestRecord[]
    const pullRequests: StoredPullRequestRow[] = facts.map((fact, index) => {
      collectForbidden([fact.fact_id, fact.created_at, fact.merged_at, fact.closed_at, fact.c2_expires_at], forbidden)
      // The C2 sweep clears the number, timestamps and expiry together; a row without its
      // number has had its interval facts removed at the retention boundary.
      const cleared = fact.number === null
      return Object.freeze({
        ordinal: index + 1,
        createdAt: cleared ? null : fact.created_at,
        mergedAt: cleared ? null : fact.merged_at,
        closedAt: cleared ? null : fact.closed_at,
        state: fact.state,
        isDraft: fact.is_draft === 1,
        additions: fact.additions,
        deletions: fact.deletions,
        changedFiles: fact.changed_files,
        retention: retentionOf(fact.c2_expires_at, cleared, request.asOf),
        readyForReviewAt: Object.freeze({ status: 'not_recorded' as const }),
      })
    })

    const coverageRecords = db.prepare(
      `SELECT c.coverage_id, c.job_id, c.snapshot_id, c.status, c.expected_units, c.observed_units,
              c.omitted_units, c.saturation_reason, c.retryable, c.limitation_code, c.source_coverage_id,
              c.range_start, c.range_end, c.observed_at, c.c2_expires_at,
              j.status AS job_status, j.consent_revision,
              j.storage_contract_version || '|' || j.query_version || '|' || j.source_api_version AS instrument,
              j.c2_expires_at AS job_c2_expires_at, j.source_job_id AS job_source_id,
              j.completed_at AS job_completed_at, j.started_at AS job_started_at, j.observed_at AS job_observed_at,
              s.status AS snapshot_status, s.c2_expires_at AS snapshot_c2_expires_at, s.observed_at AS snapshot_observed_at
         FROM coverage_ledger AS c
         JOIN collection_job AS j ON j.scope_id = c.scope_id AND j.job_id = c.job_id
         LEFT JOIN source_snapshot AS s
           ON s.scope_id = c.scope_id AND s.snapshot_id = c.snapshot_id AND s.job_id = c.job_id
        WHERE c.scope_id = ? AND c.capability_id = 'github.core' AND j.capability_id = 'github.core'
        ORDER BY c.coverage_id`,
    ).all(request.scopeId) as CoverageRecord[]

    const jobOrdinals = new Map<string, number>()
    const consentOrdinals = new Map<string, number>()
    const instrumentOrdinals = new Map<string, number>()
    const ordinalOf = (map: Map<string, number>, key: string): number => {
      const existing = map.get(key)
      if (existing !== undefined) return existing
      const next = map.size + 1
      map.set(key, next)
      return next
    }
    const coverageOrdinals = new Map<string, number>()
    const coverage: StoredCoverageRow[] = coverageRecords.map((row, index) => {
      collectForbidden([
        row.coverage_id, row.job_id, row.snapshot_id, row.source_coverage_id, row.range_start, row.range_end,
        row.observed_at, row.c2_expires_at, row.consent_revision, row.job_c2_expires_at, row.job_source_id,
        row.job_completed_at, row.job_started_at, row.job_observed_at, row.snapshot_c2_expires_at,
        row.snapshot_observed_at,
      ], forbidden)
      coverageOrdinals.set(row.coverage_id, index + 1)
      const cleared = row.range_start === null || row.range_end === null
      // A row vouches only while the coverage row, its job AND its snapshot are all inside
      // retention; the earliest expiry of the three governs.
      const expiries = [row.c2_expires_at, row.job_c2_expires_at, row.snapshot_c2_expires_at]
        .filter((value): value is string => value !== null)
        .sort()
      return Object.freeze({
        ordinal: index + 1,
        status: row.status,
        jobOrdinal: ordinalOf(jobOrdinals, row.job_id),
        jobStatus: row.job_status,
        consentOrdinal: ordinalOf(consentOrdinals, row.consent_revision),
        instrumentOrdinal: ordinalOf(instrumentOrdinals, row.instrument),
        snapshotClosed: row.snapshot_status === 'closed',
        expectedUnits: row.expected_units,
        observedUnits: row.observed_units,
        omittedUnits: row.omitted_units,
        saturationReason: row.saturation_reason,
        limitationCode: row.limitation_code,
        retryable: row.retryable === 1,
        rangeStart: cleared ? null : row.range_start,
        rangeEnd: cleared ? null : row.range_end,
        observedAt: cleared ? null : row.observed_at,
        retention: retentionOf(expiries[0] ?? null, cleared, request.asOf),
      })
    })

    const kinds = LINEAGE_KINDS.map(() => '?').join(', ')
    const lineageRecords = db.prepare(
      `SELECT subject_kind, subject_id, event_kind, event_week, caused_by, operation_id
         FROM lineage_event
        WHERE (scope_id = ? OR (subject_kind = 'scope' AND subject_id = ?))
          AND event_kind IN (${kinds})
        ORDER BY event_week, event_kind, subject_kind, subject_id, operation_id`,
    ).all(request.scopeId, request.scopeId, ...LINEAGE_KINDS) as LineageRecord[]
    const lineage: StoredLineageRow[] = lineageRecords.map((row) => {
      collectForbidden([row.subject_id, row.caused_by, row.operation_id], forbidden)
      const linkedCoverage = coverageOrdinals.get(row.subject_id)
        ?? (row.caused_by !== null ? coverageOrdinals.get(row.caused_by) : undefined)
      const linkedJob = jobOrdinals.get(row.subject_id)
        ?? (row.caused_by !== null ? jobOrdinals.get(row.caused_by) : undefined)
      return Object.freeze({
        subjectKind: row.subject_kind,
        eventKind: row.event_kind,
        eventWeek: row.event_week,
        linkedCoverageOrdinal: linkedCoverage ?? null,
        linkedJobOrdinal: linkedJob ?? null,
      })
    })

    return Object.freeze({
      status: 'read' as const,
      observation: Object.freeze({
        bridgeVersion: STORED_OBSERVATION_BRIDGE_VERSION,
        source: 'selected_v3_store' as const,
        request: Object.freeze({
          scopeId: request.scopeId,
          window: Object.freeze({ start: request.window.start, end: request.window.end }),
          asOf: request.asOf,
        }),
        scope: Object.freeze({ hasAlias: scopeRow.has_alias === 1, linkedAt: scopeRow.linked_at }),
        capabilityId: 'github.core' as const,
        pullRequests: Object.freeze(pullRequests),
        coverage: Object.freeze(coverage),
        lineage: Object.freeze(lineage),
        internal: Object.freeze({ forbiddenValues: Object.freeze(servedSafe(forbidden, request)) }),
      }),
    })
  } catch {
    return refused('STORE_READ_FAILED')
  }
}
