import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CoverageRecord } from '../../../shared/coverage.js'
import { openStorageDatabase } from '../../storage/database.js'
import type { V2StoreProvenance } from './contract.js'
import {
  SYNTHETIC_COVERAGE_RECORDS,
  SYNTHETIC_STORE_PROVENANCE,
} from './syntheticCoverageFixtures.js'
import { installV2BridgeStore } from './store.js'

/**
 * The synthetic importer for the DL-BRIDGE-01 bootstrap slice.
 *
 * It writes invented C0 coverage fixtures into a V2 SQLite store under an
 * explicit synthetic-mode provenance marker. It reads no account, repository,
 * local Git history, or generated artifact, and it never transitions a
 * capability.
 */
export interface SeedSyntheticCoverageStoreOptions {
  readonly provenance?: V2StoreProvenance
  readonly records?: readonly CoverageRecord[]
}

export function seedSyntheticCoverageStore(
  path: string,
  options: SeedSyntheticCoverageStoreOptions = {},
): void {
  const provenance = options.provenance ?? SYNTHETIC_STORE_PROVENANCE
  const records = options.records ?? SYNTHETIC_COVERAGE_RECORDS

  mkdirSync(dirname(resolve(path)), { recursive: true })
  const db = openStorageDatabase(path)
  try {
    installV2BridgeStore(db)
    db.transaction(() => {
      db.prepare('DELETE FROM v2_coverage_record').run()
      db.prepare('DELETE FROM v2_store_provenance').run()
      db.prepare(
        'INSERT INTO v2_store_provenance (singleton, mode, synthetic_marker, activation_card_id, importer_version, created_at) VALUES (1, ?, ?, ?, ?, ?)',
      ).run(
        provenance.mode,
        provenance.syntheticMarker,
        provenance.activationCardId,
        provenance.importerVersion,
        provenance.createdAt,
      )

      const insertCoverage = db.prepare(
        'INSERT INTO v2_coverage_record (coverage_id, capability_id, scope_alias, range_start, range_end, status, expected_units, observed_units, omitted_units, saturation_reason, retryable, observed_at, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      for (const record of records) {
        insertCoverage.run(
          record.coverageId,
          record.capabilityId,
          record.scopeAlias,
          record.rangeStart,
          record.rangeEnd,
          record.status,
          record.expectedUnits,
          record.observedUnits,
          record.omittedUnits,
          record.saturationReason ?? null,
          Number(record.retryable),
          record.observedAt,
          record.limitationCode,
        )
      }
    })()
  } finally {
    db.close()
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (invokedDirectly) {
  const target = process.argv[2] ?? process.env.DEVELOPER_LENS_V2_STORE
  if (!target) {
    console.error('Usage: tsx server/api/v2/syntheticImporter.ts <store-path>')
    process.exitCode = 1
  } else {
    seedSyntheticCoverageStore(target)
    console.log(`Seeded the synthetic V2 bridge store at ${resolve(target)}`)
  }
}
