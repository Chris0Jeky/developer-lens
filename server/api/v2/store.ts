import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'
import { CoverageRecordSchema, type CoverageRecord } from '../../../shared/coverage.js'
import { SQLITE_APPLICATION_ID, SQLITE_USER_VERSION } from '../../storage/schema.js'
import { V2StoreProvenanceSchema, type V2StoreProvenance } from './contract.js'
import { V2Error } from './errors.js'

/**
 * The V2 bridge tables. They are additive to the existing V2 storage schema
 * (`server/storage/schema.ts`) and are installed only by the synthetic importer.
 *
 * The SQL CHECK constraints are deliberately weaker than `CoverageRecordSchema`:
 * storage integrity and the served contract are separate gates, and the read
 * path re-validates every row against the shared contract before it is served.
 *
 * Honest guarantee of the provenance gate — it proves that the store *claims*
 * synthetic provenance, not that its rows are synthetic. A local writer who
 * already holds the file could stamp the synthetic marker onto real rows and
 * this gate would serve them. It defends against accident — a store swapped in
 * by mistake, a real-collection target pointed at the bridge, a foreign SQLite
 * file — and not against a local attacker who already has the data.
 */
export const V2_BRIDGE_STORE_TABLES = ['v2_store_provenance', 'v2_coverage_record'] as const

const OPAQUE_COLUMN = (column: string) =>
  `length(${column}) BETWEEN 1 AND 256 AND ${column} NOT GLOB '*[^A-Za-z0-9:._-]*'`

const COVERAGE_STATUS_LIST =
  "'never_authorized', 'refused', 'unavailable', 'restricted', 'truncated', 'stale', 'failed', 'deleted', 'censored', 'complete'"

export const V2_BRIDGE_STORE_SQL = `
  CREATE TABLE IF NOT EXISTS v2_store_provenance (
    singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
    mode TEXT NOT NULL CHECK (mode IN ('synthetic', 'activation_card')),
    synthetic_marker TEXT,
    activation_card_id TEXT CHECK (activation_card_id IS NULL OR (${OPAQUE_COLUMN('activation_card_id')})),
    importer_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK (
      (mode = 'synthetic' AND synthetic_marker IS NOT NULL AND activation_card_id IS NULL)
      OR (mode = 'activation_card' AND synthetic_marker IS NULL AND activation_card_id IS NOT NULL)
    )
  ) STRICT;

  CREATE TABLE IF NOT EXISTS v2_coverage_record (
    coverage_id TEXT PRIMARY KEY NOT NULL CHECK (${OPAQUE_COLUMN('coverage_id')}),
    capability_id TEXT NOT NULL CHECK (${OPAQUE_COLUMN('capability_id')}),
    scope_alias TEXT NOT NULL CHECK (${OPAQUE_COLUMN('scope_alias')}),
    range_start TEXT NOT NULL,
    range_end TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (${COVERAGE_STATUS_LIST})),
    expected_units INTEGER CHECK (expected_units IS NULL OR expected_units >= 0),
    observed_units INTEGER NOT NULL CHECK (observed_units >= 0),
    omitted_units INTEGER CHECK (omitted_units IS NULL OR omitted_units >= 0),
    saturation_reason TEXT CHECK (saturation_reason IS NULL OR saturation_reason NOT GLOB '*[^A-Z0-9_]*'),
    retryable INTEGER NOT NULL CHECK (retryable IN (0, 1)),
    observed_at TEXT NOT NULL,
    limitation_code TEXT NOT NULL CHECK (limitation_code NOT GLOB '*[^A-Z0-9_]*'),
    CHECK (range_start < range_end)
  ) STRICT;
`

export function installV2BridgeStore(db: Database.Database): void {
  db.exec(V2_BRIDGE_STORE_SQL)
}

interface ProvenanceRow {
  readonly mode: string
  readonly synthetic_marker: string | null
  readonly activation_card_id: string | null
  readonly importer_version: string
  readonly created_at: string
}

interface CoverageRow {
  readonly coverage_id: string
  readonly capability_id: string
  readonly scope_alias: string
  readonly range_start: string
  readonly range_end: string
  readonly status: string
  readonly expected_units: number | null
  readonly observed_units: number
  readonly omitted_units: number | null
  readonly saturation_reason: string | null
  /** Untrusted: a store whose CHECK was lost can hold anything here. */
  readonly retryable: number | string | null
  readonly observed_at: string
  readonly limitation_code: string
}

export function readStoreProvenance(db: Database.Database): V2StoreProvenance {
  let rows: ProvenanceRow[]
  try {
    rows = db
      .prepare(
        'SELECT mode, synthetic_marker, activation_card_id, importer_version, created_at FROM v2_store_provenance',
      )
      .all() as ProvenanceRow[]
  } catch {
    throw new V2Error('V2_STORE_PROVENANCE_REFUSED')
  }
  if (rows.length !== 1) throw new V2Error('V2_STORE_PROVENANCE_REFUSED')

  const parsed = V2StoreProvenanceSchema.safeParse({
    mode: rows[0].mode,
    syntheticMarker: rows[0].synthetic_marker,
    activationCardId: rows[0].activation_card_id,
    importerVersion: rows[0].importer_version,
    createdAt: rows[0].created_at,
  })
  if (!parsed.success) throw new V2Error('V2_STORE_PROVENANCE_REFUSED')
  return parsed.data
}

/**
 * The ADR-04 provenance gate. Synthetic stores are servable. A store that
 * records `activation_card` provenance is refused by this slice: no reviewed
 * activation card exists while every capability is `never_authorized`, so the
 * bridge cannot silently become a real-data path.
 */
export function assertServableProvenance(provenance: V2StoreProvenance): void {
  if (provenance.mode !== 'synthetic') throw new V2Error('V2_ACTIVATION_CARD_NOT_REVIEWED')
}

export function readCoverageRecords(db: Database.Database): CoverageRecord[] {
  let rows: CoverageRow[]
  try {
    rows = db
      .prepare(
        'SELECT coverage_id, capability_id, scope_alias, range_start, range_end, status, expected_units, observed_units, omitted_units, saturation_reason, retryable, observed_at, limitation_code FROM v2_coverage_record ORDER BY coverage_id',
      )
      .all() as CoverageRow[]
  } catch {
    throw new V2Error('V2_STORE_PROVENANCE_REFUSED')
  }

  return rows.map((row) => {
    // `retryable` is a boolean carried as an integer. A store whose schema lost
    // its CHECK constraint could hold 2, NULL, or text; converting that with a
    // truthiness test would silently invent a value, so anything other than
    // exactly 0 or 1 takes the fail-closed path.
    if (row.retryable !== 0 && row.retryable !== 1) {
      throw new V2Error('V2_RESPONSE_CONTRACT_VIOLATION')
    }
    const parsed = CoverageRecordSchema.safeParse({
      coverageId: row.coverage_id,
      capabilityId: row.capability_id,
      scopeAlias: row.scope_alias,
      rangeStart: row.range_start,
      rangeEnd: row.range_end,
      status: row.status,
      expectedUnits: row.expected_units,
      observedUnits: row.observed_units,
      omittedUnits: row.omitted_units,
      ...(row.saturation_reason === null ? {} : { saturationReason: row.saturation_reason }),
      retryable: row.retryable === 1,
      observedAt: row.observed_at,
      limitationCode: row.limitation_code,
    })
    if (!parsed.success) throw new V2Error('V2_RESPONSE_CONTRACT_VIOLATION')
    return parsed.data
  })
}

function openReadOnlyStore(path: string): Database.Database {
  if (!existsSync(path)) throw new V2Error('V2_STORE_UNAVAILABLE')

  let db: Database.Database
  try {
    db = new Database(path, { readonly: true, fileMustExist: true })
  } catch {
    throw new V2Error('V2_STORE_UNAVAILABLE')
  }

  try {
    const applicationId = Number(db.prepare('PRAGMA application_id').pluck().get())
    const userVersion = Number(db.prepare('PRAGMA user_version').pluck().get())
    if (applicationId !== SQLITE_APPLICATION_ID || userVersion !== SQLITE_USER_VERSION) {
      throw new V2Error('V2_STORE_PROVENANCE_REFUSED')
    }
  } catch (error) {
    db.close()
    throw error instanceof V2Error ? error : new V2Error('V2_STORE_PROVENANCE_REFUSED')
  }

  return db
}

export interface V2StoreReadResult {
  readonly provenance: V2StoreProvenance
  readonly coverage: CoverageRecord[]
}

/**
 * Opens the store read-only, proves its provenance, then reads and closes.
 *
 * The provenance proof and the rows it authorises are read inside ONE deferred
 * read transaction, so they come from a single SQLite snapshot: a concurrent
 * local writer cannot swap synthetic provenance in front of the first SELECT
 * and different rows behind the second. This closes the read race; it does not
 * change the honest guarantee above about a writer who already holds the file.
 */
export function readSyntheticCoverageStore(path: string): V2StoreReadResult {
  const db = openReadOnlyStore(path)
  try {
    return db.transaction((): V2StoreReadResult => {
      const provenance = readStoreProvenance(db)
      assertServableProvenance(provenance)
      return { provenance, coverage: readCoverageRecords(db) }
    })()
  } finally {
    db.close()
  }
}
