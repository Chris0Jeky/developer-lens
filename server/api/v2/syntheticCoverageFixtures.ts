import { COVERAGE_STATUSES, CoverageRecordSchema, type CoverageRecord } from '../../../shared/coverage.js'
import {
  SYNTHETIC_STORE_MARKER,
  V2StoreProvenanceSchema,
  type V2StoreProvenance,
} from './contract.js'

/**
 * Invented C0 coverage fixtures for the DL-BRIDGE-01 bootstrap slice.
 *
 * Every value here is made up. Nothing in this module reads an account, a
 * repository, local Git history, or any generated artifact. The set covers all
 * ten coverage states exactly once so the Coverage Cockpit can prove that
 * absence renders as a coverage state rather than as a numeric zero.
 */
export const SYNTHETIC_IMPORTER_VERSION = '1.0.0' as const

export const SYNTHETIC_STORE_PROVENANCE: V2StoreProvenance = V2StoreProvenanceSchema.parse({
  mode: 'synthetic',
  syntheticMarker: SYNTHETIC_STORE_MARKER,
  activationCardId: null,
  importerVersion: SYNTHETIC_IMPORTER_VERSION,
  createdAt: '2026-08-04T00:00:00.000Z',
})

const RANGE_START = '2026-01-01T00:00:00.000Z'
const RANGE_END = '2026-04-01T00:00:00.000Z'
const OBSERVED_AT = '2026-04-01T00:00:00.000Z'

const RAW_SYNTHETIC_COVERAGE_RECORDS = [
  {
    coverageId: 'synthetic-coverage-never-authorized',
    capabilityId: 'cap.github.dependencies',
    scopeAlias: 'synthetic-scope-alpha',
    status: 'never_authorized',
    expectedUnits: null,
    observedUnits: 0,
    omittedUnits: null,
    retryable: false,
    limitationCode: 'CAPABILITY_NEVER_AUTHORIZED',
  },
  {
    coverageId: 'synthetic-coverage-refused',
    capabilityId: 'cap.local.git',
    scopeAlias: 'synthetic-scope-beta',
    status: 'refused',
    expectedUnits: null,
    observedUnits: 0,
    omittedUnits: null,
    retryable: false,
    limitationCode: 'SOURCE_REFUSED_BY_OWNER',
  },
  {
    coverageId: 'synthetic-coverage-unavailable',
    capabilityId: 'cap.github.projects',
    scopeAlias: 'synthetic-scope-gamma',
    status: 'unavailable',
    expectedUnits: null,
    observedUnits: 0,
    omittedUnits: null,
    retryable: true,
    limitationCode: 'SOURCE_UNAVAILABLE',
  },
  {
    coverageId: 'synthetic-coverage-restricted',
    capabilityId: 'cap.github.security',
    scopeAlias: 'synthetic-scope-delta',
    status: 'restricted',
    expectedUnits: 40,
    observedUnits: 12,
    omittedUnits: 28,
    retryable: false,
    limitationCode: 'SCOPE_RESTRICTED',
  },
  {
    coverageId: 'synthetic-coverage-truncated',
    capabilityId: 'github.core',
    scopeAlias: 'synthetic-scope-epsilon',
    status: 'truncated',
    expectedUnits: 500,
    observedUnits: 300,
    omittedUnits: 200,
    saturationReason: 'RESULT_WINDOW_SATURATED',
    retryable: true,
    limitationCode: 'PAGE_LIMIT_REACHED',
  },
  {
    coverageId: 'synthetic-coverage-stale',
    capabilityId: 'cap.git.signatures',
    scopeAlias: 'synthetic-scope-zeta',
    status: 'stale',
    expectedUnits: 64,
    observedUnits: 64,
    omittedUnits: 0,
    retryable: true,
    limitationCode: 'CHECKPOINT_OLDER_THAN_WINDOW',
  },
  {
    coverageId: 'synthetic-coverage-failed',
    capabilityId: 'cap.github.actions',
    scopeAlias: 'synthetic-scope-eta',
    status: 'failed',
    expectedUnits: null,
    observedUnits: 0,
    omittedUnits: null,
    retryable: true,
    limitationCode: 'TRANSPORT_FAILURE',
  },
  {
    coverageId: 'synthetic-coverage-deleted',
    capabilityId: 'cap.github.deployments',
    scopeAlias: 'synthetic-scope-theta',
    status: 'deleted',
    expectedUnits: 18,
    observedUnits: 0,
    omittedUnits: 18,
    retryable: false,
    limitationCode: 'RECORDS_DELETED_ON_REQUEST',
  },
  {
    coverageId: 'synthetic-coverage-censored',
    capabilityId: 'cap.commit.intent',
    scopeAlias: 'synthetic-scope-iota',
    status: 'censored',
    expectedUnits: 25,
    observedUnits: 21,
    omittedUnits: 4,
    retryable: false,
    limitationCode: 'REDACTION_APPLIED',
  },
  {
    coverageId: 'synthetic-coverage-complete',
    capabilityId: 'cap.github.issue_taxonomy',
    scopeAlias: 'synthetic-scope-kappa',
    status: 'complete',
    expectedUnits: 128,
    observedUnits: 128,
    omittedUnits: 0,
    retryable: false,
    limitationCode: 'NONE',
  },
] as const

export const SYNTHETIC_COVERAGE_RECORDS: readonly CoverageRecord[] =
  RAW_SYNTHETIC_COVERAGE_RECORDS.map((record) =>
    CoverageRecordSchema.parse({
      ...record,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
      observedAt: OBSERVED_AT,
    }),
  )

// The fixture set is the proof surface for the ten-state cockpit: keep it total.
const fixtureStatuses = new Set(SYNTHETIC_COVERAGE_RECORDS.map((record) => record.status))
if (fixtureStatuses.size !== COVERAGE_STATUSES.length) {
  throw new Error('SYNTHETIC_COVERAGE_FIXTURES_INCOMPLETE')
}
