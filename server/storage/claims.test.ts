import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CLAIM_EDGE_ROLES,
  CLAIM_EDGE_ROLE_TARGET_KIND,
  CLAIM_EVIDENCE_EDGE_ROLES,
  CLAIM_LIMITATION_CODES,
  CLAIM_SCHEMA_VERSION,
  CLAIM_STATEMENT_CODES,
  claimStabilityKey,
  claimStabilityKeyToken,
  computeClaimId,
} from '../../shared/claims.js'
import { C1_LIMITATION_CODES, C1_STATEMENT_CODES } from '../externalModel/c1Contract.js'
import { reconcileGithubCoreReceipts } from '../connectors/github/core.js'
import { openStorageDatabase } from './database.js'
import {
  installIncrementalGithubCoreStorage,
  persistIncrementalGithubCoreTransition,
} from './incremental.js'
import {
  CLAIM_GRAPH_TABLES,
  ClaimStorageError,
  clearClaimScopeAlias,
  installClaimGraphStorage,
  readClaim,
  readClaimScopeAlias,
  registerClaim,
  registerClaimScope,
  registerEvidenceAnchor,
  registerLineageEvent,
  supersedeClaim,
} from './claims.js'

const databases: Database.Database[] = []

const windowStart = '2026-01-05T00:00:00.000Z'
const windowEnd = '2026-04-06T00:00:00.000Z'
const createdAt = '2026-04-06T12:00:00.000Z'

/** Every value below is invented. No real, private, or generated-data read happens here. */
const ALPHA_SCOPE = 'sc-alpha'
const BETA_SCOPE = 'sc-beta'
const CANARIES = [
  'the repository was renamed last April',
  'C:/Users/jekyt/Desktop/Printer Config/secret.txt',
  'server/storage/claims.ts',
  'Chris Jeky',
  'jeky.tck@gmail.com',
] as const

afterEach(() => {
  for (const db of databases.splice(0)) {
    if (db.open) db.close()
  }
})

interface CoverageTargetRow {
  coverage_id: string
  range_start: string
  job_id: string
}

function bareDatabase(): Database.Database {
  const db = openStorageDatabase(':memory:')
  databases.push(db)
  return db
}

/** A P2 store with the existing collection/coverage tables populated, then the claim graph. */
function claimGraphDatabase(): { db: Database.Database; coverage: CoverageTargetRow } {
  const db = bareDatabase()
  installIncrementalGithubCoreStorage(db)
  persistIncrementalGithubCoreTransition(db, {
    jobId: 'job-a1',
    scopeAlias: 'scope-a',
    consentRevision: 'consent-a',
    sourceSnapshotId: 'snapshot-job-a1',
    startedAt: '2026-04-06T00:00:01.000Z',
    completedAt: '2026-04-06T00:00:02.000Z',
    transition: reconcileGithubCoreReceipts({
      checkpoint: null,
      scopeAlias: 'scope-a',
      rangeStart: '2026-01-05T00:00:00.000Z',
      rangeEnd: '2026-01-06T00:00:00.000Z',
      observedAt: '2026-01-06T00:00:00.000Z',
      jobId: 'job-a1',
      consentRevision: 'consent-a',
      pageCap: 2,
      snapshotHash: 'a'.repeat(64),
      receipts: [{ receiptId: 'receipt-job-a1', pageNumber: 1, unitIds: [], nextCursor: null }],
    }),
  })
  installClaimGraphStorage(db)
  const coverage = db.prepare(
    'SELECT coverage_id, range_start, job_id FROM coverage_ledger',
  ).get() as CoverageTargetRow
  registerClaimScope(db, { scopeId: ALPHA_SCOPE, scopeAlias: 'repo-a7' })
  registerClaimScope(db, { scopeId: BETA_SCOPE, scopeAlias: 'repo-b3' })
  for (const evidenceId of ['ev-det-4', 'ev-det-5', 'ev-det-6']) {
    registerEvidenceAnchor(db, {
      evidenceId,
      layer: 'deterministic',
      coverage: {
        coverageId: coverage.coverage_id,
        rangeStart: coverage.range_start,
        jobId: coverage.job_id,
      },
    })
  }
  return { db, coverage }
}

function claimInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    layer: 'hypothesis',
    statementCode: 'CI_RERUN_PATTERN',
    methodId: 'hyp.composer',
    methodVersion: '1.0.0',
    windowStart,
    windowEnd,
    scopeId: ALPHA_SCOPE,
    createdAt,
    edges: [
      { role: 'supports', targetEvidenceId: 'ev-det-4' },
      { role: 'contradicts', targetEvidenceId: 'ev-det-5' },
    ],
    limitations: [
      { limitationCode: 'RERUN_NOT_FLAKE', dimension: 'completeness', copyKey: 'hyp.ci_shift.truncated' },
    ],
    ...overrides,
  }
}

function errorCode(operation: () => unknown): string {
  try {
    operation()
  } catch (error) {
    if (error instanceof ClaimStorageError) return error.code
    return `UNEXPECTED:${String(error)}`
  }
  return 'NO_ERROR'
}

describe('claim graph contracts', () => {
  it('keeps the closed registries in step with the existing C1 vocabularies', () => {
    for (const code of C1_STATEMENT_CODES) {
      expect(CLAIM_STATEMENT_CODES as readonly string[]).toContain(code)
    }
    for (const code of C1_LIMITATION_CODES) {
      expect(CLAIM_LIMITATION_CODES as readonly string[]).toContain(code)
    }
    const evidenceRoles = CLAIM_EDGE_ROLES.filter(
      (role) => CLAIM_EDGE_ROLE_TARGET_KIND[role] === 'evidence',
    )
    expect([...evidenceRoles].sort()).toEqual([...CLAIM_EVIDENCE_EDGE_ROLES].sort())
  })

  it('derives a stable claim ID that is order-insensitive and input-sensitive', () => {
    const identity = {
      statementCode: 'CI_RERUN_PATTERN',
      methodId: 'hyp.composer',
      methodVersion: '1.0.0',
      evidenceIds: ['ev-det-4', 'ev-det-5'],
      windowStart,
      windowEnd,
      scopeId: ALPHA_SCOPE,
      schemaVersion: CLAIM_SCHEMA_VERSION,
    } as const
    const claimId = computeClaimId(identity)
    expect(claimId).toMatch(/^cl_[0-9a-f]{64}$/)
    expect(computeClaimId({ ...identity, evidenceIds: ['ev-det-5', 'ev-det-4'] })).toBe(claimId)
    expect(computeClaimId({ ...identity, evidenceIds: ['ev-det-4', 'ev-det-5', 'ev-det-6'] }))
      .not.toBe(claimId)
    expect(computeClaimId({ ...identity, scopeId: BETA_SCOPE })).not.toBe(claimId)
  })
})

describe('claim graph installation', () => {
  it('refuses to install without the existing coverage table', () => {
    expect(errorCode(() => installClaimGraphStorage(bareDatabase())))
      .toBe('CLAIM_GRAPH_PRECONDITION_MISSING')
  })

  it('installs every table exactly once and is idempotent', () => {
    const { db } = claimGraphDatabase()
    for (const table of CLAIM_GRAPH_TABLES) {
      expect(
        db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").pluck().get(table),
      ).toBe(1)
    }
    expect(() => installClaimGraphStorage(db)).not.toThrow()
  })

  it('fails closed when an incompatible table already owns a claim-graph name', () => {
    const db = bareDatabase()
    installIncrementalGithubCoreStorage(db)
    db.exec('CREATE TABLE evidence (sentinel TEXT NOT NULL) STRICT;')
    expect(errorCode(() => installClaimGraphStorage(db))).toBe('CLAIM_GRAPH_SCHEMA_MISMATCH')
  })
})

describe('claim registration fails closed', () => {
  it('rejects an unknown statement code in the contract and in the table', () => {
    const { db } = claimGraphDatabase()
    expect(errorCode(() => registerClaim(db, claimInput({ statementCode: 'MADE_UP_CODE' }))))
      .toBe('CLAIM_CONTRACT_INVALID')
    expect(() =>
      db.prepare(
        'INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, created_at, superseded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
      ).run(
        `cl_${'a'.repeat(64)}`, 'hypothesis', 'MADE_UP_CODE', 'hyp.composer', '1.0.0',
        windowStart, windowEnd, ALPHA_SCOPE, CLAIM_SCHEMA_VERSION, createdAt,
      ),
    ).toThrow(/CHECK constraint failed/)
  })

  it('rejects an unknown edge role in the contract and in the table', () => {
    const { db } = claimGraphDatabase()
    expect(errorCode(() => registerClaim(db, claimInput({
      edges: [{ role: 'refutes', targetEvidenceId: 'ev-det-4' }],
    })))).toBe('CLAIM_CONTRACT_INVALID')

    const { claimId } = registerClaim(db, claimInput())
    expect(() =>
      db.prepare(
        'INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id, target_claim_id, target_coverage_id, target_coverage_range_start, target_coverage_job_id) VALUES (?, ?, ?, NULL, NULL, NULL, NULL)',
      ).run(claimId, 'refutes', 'ev-det-4'),
    ).toThrow(/CHECK constraint failed/)
  })

  it('rejects an edge whose evidence target does not exist', () => {
    const { db } = claimGraphDatabase()
    expect(errorCode(() => registerClaim(db, claimInput({
      edges: [{ role: 'supports', targetEvidenceId: 'ev-missing' }],
    })))).toBe('CLAIM_GRAPH_CONSTRAINT_FAILED')
    expect(db.prepare('SELECT COUNT(*) FROM claim').pluck().get()).toBe(0)
  })

  it('rejects an edge whose coverage target does not exist', () => {
    const { db, coverage } = claimGraphDatabase()
    expect(errorCode(() => registerClaim(db, claimInput({
      edges: [{
        role: 'coverage_basis',
        targetCoverage: {
          coverageId: coverage.coverage_id,
          rangeStart: coverage.range_start,
          jobId: 'job-never-collected',
        },
      }],
    })))).toBe('CLAIM_GRAPH_CONSTRAINT_FAILED')
  })

  it('rejects an edge with two targets set and an edge with none', () => {
    const { db, coverage } = claimGraphDatabase()
    const { claimId } = registerClaim(db, claimInput())
    const insert = db.prepare(
      'INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id, target_claim_id, target_coverage_id, target_coverage_range_start, target_coverage_job_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    expect(() =>
      insert.run(claimId, 'supports', 'ev-det-4', null, coverage.coverage_id, coverage.range_start, coverage.job_id),
    ).toThrow(/CHECK constraint failed/)
    expect(() => insert.run(claimId, 'supports', null, null, null, null, null))
      .toThrow(/CHECK constraint failed/)
  })

  it('rejects a role whose target kind is semantically wrong', () => {
    const { db } = claimGraphDatabase()
    const { claimId } = registerClaim(db, claimInput())
    expect(() =>
      db.prepare(
        'INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id, target_claim_id, target_coverage_id, target_coverage_range_start, target_coverage_job_id) VALUES (?, ?, ?, NULL, NULL, NULL, NULL)',
      ).run(claimId, 'derives_from', 'ev-det-4'),
    ).toThrow(/CHECK constraint failed/)
  })

  it('rejects an abstention layer that does not carry the abstention statement code', () => {
    const { db } = claimGraphDatabase()
    expect(errorCode(() => registerClaim(db, claimInput({ layer: 'abstention' }))))
      .toBe('CLAIM_CONTRACT_INVALID')
    expect(() =>
      db.prepare(
        'INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, created_at, superseded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
      ).run(
        `cl_${'b'.repeat(64)}`, 'abstention', 'CI_RERUN_PATTERN', 'hyp.composer', '1.0.0',
        windowStart, windowEnd, ALPHA_SCOPE, CLAIM_SCHEMA_VERSION, createdAt,
      ),
    ).toThrow(/CHECK constraint failed/)
  })

  it('rejects a second claim that collides on a derived ID with different content', () => {
    const { db } = claimGraphDatabase()
    const first = registerClaim(db, claimInput())
    expect(first.applied).toBe(true)
    expect(registerClaim(db, claimInput()).applied).toBe(false)
    expect(errorCode(() => registerClaim(db, claimInput({ layer: 'modelled' }))))
      .toBe('CLAIM_ID_COLLISION')
  })
})

describe('canary rejection', () => {
  it('rejects prose, paths, and names from every claim field, and never echoes them', () => {
    const { db } = claimGraphDatabase()
    const mutations: ((canary: string) => Record<string, unknown>)[] = [
      (canary) => claimInput({ statementCode: canary }),
      (canary) => claimInput({ methodId: canary }),
      (canary) => claimInput({ methodVersion: canary }),
      (canary) => claimInput({ scopeId: canary }),
      (canary) => claimInput({ windowStart: canary }),
      (canary) => claimInput({ createdAt: canary }),
      (canary) => claimInput({ edges: [{ role: 'supports', targetEvidenceId: canary }] }),
      (canary) => claimInput({
        limitations: [{ limitationCode: canary, dimension: 'completeness', copyKey: 'k.a' }],
      }),
      (canary) => claimInput({
        limitations: [{ limitationCode: 'RERUN_NOT_FLAKE', dimension: canary, copyKey: 'k.a' }],
      }),
      (canary) => claimInput({
        limitations: [{ limitationCode: 'RERUN_NOT_FLAKE', dimension: 'completeness', copyKey: canary }],
      }),
    ]
    for (const canary of CANARIES) {
      for (const mutate of mutations) {
        let thrown: unknown
        try {
          registerClaim(db, mutate(canary))
        } catch (error) {
          thrown = error
        }
        expect(thrown).toBeInstanceOf(ClaimStorageError)
        expect((thrown as ClaimStorageError).code).toBe('CLAIM_CONTRACT_INVALID')
        expect((thrown as Error).message).not.toContain(canary)
      }
    }
    expect(db.prepare('SELECT COUNT(*) FROM claim').pluck().get()).toBe(0)
  })

  it('rejects canaries from the scope, evidence, and lineage contracts too', () => {
    const { db, coverage } = claimGraphDatabase()
    for (const canary of CANARIES) {
      expect(errorCode(() => registerClaimScope(db, { scopeId: canary, scopeAlias: 'repo-a7' })))
        .toBe('CLAIM_CONTRACT_INVALID')
      expect(errorCode(() => registerClaimScope(db, { scopeId: ALPHA_SCOPE, scopeAlias: canary })))
        .toBe('CLAIM_CONTRACT_INVALID')
      expect(errorCode(() => registerEvidenceAnchor(db, {
        evidenceId: canary,
        layer: 'deterministic',
        coverage: {
          coverageId: coverage.coverage_id,
          rangeStart: coverage.range_start,
          jobId: coverage.job_id,
        },
      }))).toBe('CLAIM_CONTRACT_INVALID')
      expect(errorCode(() => registerLineageEvent(db, {
        subjectId: canary,
        eventKind: 'correction',
        causedBy: null,
        occurredAt: createdAt,
      }))).toBe('CLAIM_CONTRACT_INVALID')
      expect(errorCode(() => registerLineageEvent(db, {
        subjectId: 'cl-subject',
        eventKind: canary,
        causedBy: null,
        occurredAt: createdAt,
      }))).toBe('CLAIM_CONTRACT_INVALID')
    }
  })
})

describe('claim resolution', () => {
  it('resolves a contradiction pair on one claim', () => {
    const { db } = claimGraphDatabase()
    const { claimId } = registerClaim(db, claimInput())
    const roles = db.prepare(
      'SELECT role, target_evidence_id FROM claim_evidence_edge WHERE claim_id = ? ORDER BY role',
    ).all(claimId) as { role: string; target_evidence_id: string }[]
    expect(roles).toEqual([
      { role: 'contradicts', target_evidence_id: 'ev-det-5' },
      { role: 'supports', target_evidence_id: 'ev-det-4' },
    ])
  })

  it('groups a superseded chain by stability key and refuses to merge series across scopes', () => {
    const { db } = claimGraphDatabase()
    const first = registerClaim(db, claimInput())
    const second = registerClaim(db, claimInput({
      edges: [
        { role: 'supports', targetEvidenceId: 'ev-det-4' },
        { role: 'contradicts', targetEvidenceId: 'ev-det-5' },
        { role: 'supports', targetEvidenceId: 'ev-det-6' },
      ],
    }))
    const otherScope = registerClaim(db, claimInput({ scopeId: BETA_SCOPE }))
    expect(second.claimId).not.toBe(first.claimId)

    supersedeClaim(db, { claimId: first.claimId, supersededBy: second.claimId })
    const firstRecord = readClaim(db, first.claimId)
    const secondRecord = readClaim(db, second.claimId)
    const otherRecord = readClaim(db, otherScope.claimId)
    expect(firstRecord?.supersededBy).toBe(second.claimId)
    expect(secondRecord?.supersededBy).toBeNull()

    const series = claimStabilityKeyToken(claimStabilityKey(firstRecord!))
    expect(claimStabilityKeyToken(claimStabilityKey(secondRecord!))).toBe(series)
    expect(claimStabilityKeyToken(claimStabilityKey(otherRecord!))).not.toBe(series)

    expect(errorCode(() => supersedeClaim(db, {
      claimId: otherScope.claimId,
      supersededBy: second.claimId,
    }))).toBe('CLAIM_SUPERSESSION_SERIES_MISMATCH')

    const grouped = db.prepare(
      'SELECT COUNT(*) FROM claim WHERE statement_code = ? AND method_id = ? AND method_version = ? AND window_start = ? AND window_end = ? AND scope_id = ? AND schema_version = ?',
    ).pluck().get(
      'CI_RERUN_PATTERN', 'hyp.composer', '1.0.0', windowStart, windowEnd, ALPHA_SCOPE,
      CLAIM_SCHEMA_VERSION,
    )
    expect(grouped).toBe(2)
  })

  it('resolves a rendered statement to its full evidence, coverage, limitation, and lineage walk', () => {
    const { db, coverage } = claimGraphDatabase()
    const base = registerClaim(db, claimInput({
      edges: [
        { role: 'supports', targetEvidenceId: 'ev-det-4' },
        { role: 'contradicts', targetEvidenceId: 'ev-det-5' },
        {
          role: 'coverage_basis',
          targetCoverage: {
            coverageId: coverage.coverage_id,
            rangeStart: coverage.range_start,
            jobId: coverage.job_id,
          },
        },
      ],
    }))
    const derived = registerClaim(db, claimInput({
      layer: 'modelled',
      methodId: 'det.rerun_ratio',
      edges: [{ role: 'derives_from', targetClaimId: base.claimId }],
      limitations: [
        { limitationCode: 'SAMPLE_TOO_SMALL', dimension: 'sample', copyKey: 'det.rerun.sample' },
      ],
    }))
    registerLineageEvent(db, {
      subjectId: derived.claimId,
      eventKind: 'correction',
      causedBy: base.claimId,
      occurredAt: createdAt,
    })

    const walk = {
      claim: readClaim(db, derived.claimId),
      edges: db.prepare(
        'SELECT role, target_claim_id FROM claim_evidence_edge WHERE claim_id = ?',
      ).all(derived.claimId),
      evidence: db.prepare(`
        SELECT edge.role AS role,
               evidence.evidence_id AS evidence_id,
               evidence.layer AS evidence_layer,
               coverage_ledger.coverage_id AS coverage_id,
               coverage_ledger.status AS coverage_status,
               coverage_ledger.limitation_code AS coverage_limitation,
               collection_job.capability_id AS capability_id,
               collection_job.consent_revision AS consent_revision
        FROM claim_evidence_edge AS edge
        JOIN evidence ON evidence.evidence_id = edge.target_evidence_id
        JOIN coverage_ledger
          ON coverage_ledger.coverage_id = evidence.coverage_id
         AND coverage_ledger.range_start = evidence.coverage_range_start
         AND coverage_ledger.job_id = evidence.coverage_job_id
        JOIN collection_job ON collection_job.job_id = coverage_ledger.job_id
        WHERE edge.claim_id = ?
        ORDER BY edge.role, evidence.evidence_id
      `).all(base.claimId),
      coverageBasis: db.prepare(`
        SELECT coverage_ledger.status AS coverage_status,
               collection_job.capability_id AS capability_id,
               collection_job.consent_revision AS consent_revision
        FROM claim_evidence_edge AS edge
        JOIN coverage_ledger
          ON coverage_ledger.coverage_id = edge.target_coverage_id
         AND coverage_ledger.range_start = edge.target_coverage_range_start
         AND coverage_ledger.job_id = edge.target_coverage_job_id
        JOIN collection_job ON collection_job.job_id = coverage_ledger.job_id
        WHERE edge.claim_id = ? AND edge.role = 'coverage_basis'
      `).all(base.claimId),
      limitations: db.prepare(
        'SELECT limitation_code, dimension, copy_key FROM limitation_instance WHERE claim_id = ?',
      ).all(derived.claimId),
      lineage: db.prepare(
        'SELECT subject_id, event_kind, caused_by FROM lineage_event WHERE subject_id = ?',
      ).all(derived.claimId),
    }

    expect(walk.claim?.claimId).toBe(derived.claimId)
    expect(walk.edges).toEqual([{ role: 'derives_from', target_claim_id: base.claimId }])
    expect(walk.evidence).toEqual([
      {
        role: 'contradicts',
        evidence_id: 'ev-det-5',
        evidence_layer: 'deterministic',
        coverage_id: coverage.coverage_id,
        coverage_status: 'complete',
        coverage_limitation: 'COMPLETE',
        capability_id: 'github.core',
        consent_revision: 'consent-a',
      },
      {
        role: 'supports',
        evidence_id: 'ev-det-4',
        evidence_layer: 'deterministic',
        coverage_id: coverage.coverage_id,
        coverage_status: 'complete',
        coverage_limitation: 'COMPLETE',
        capability_id: 'github.core',
        consent_revision: 'consent-a',
      },
    ])
    expect(walk.coverageBasis).toEqual([
      { coverage_status: 'complete', capability_id: 'github.core', consent_revision: 'consent-a' },
    ])
    expect(walk.limitations).toEqual([
      { limitation_code: 'SAMPLE_TOO_SMALL', dimension: 'sample', copy_key: 'det.rerun.sample' },
    ])
    expect(walk.lineage).toEqual([
      { subject_id: derived.claimId, event_kind: 'correction', caused_by: base.claimId },
    ])
  })
})

describe('privacy partition', () => {
  it('keeps the C2 scope alias out of the C1 claim row and out of every C1 read', () => {
    const { db } = claimGraphDatabase()
    const { claimId } = registerClaim(db, claimInput())
    const columns = (db.prepare('PRAGMA table_info(claim)').all() as { name: string }[])
      .map((column) => column.name)
    expect(columns).not.toContain('scope_alias')
    expect(columns).toContain('scope_id')

    const record = readClaim(db, claimId)
    expect(record).not.toBeNull()
    expect(Object.keys(record!)).not.toContain('scopeAlias')
    expect(JSON.stringify(record)).not.toContain('repo-a7')
    expect(readClaimScopeAlias(db, ALPHA_SCOPE)).toBe('repo-a7')
  })

  it('survives the C2 retention clock with the C1 series grouping intact', () => {
    const { db } = claimGraphDatabase()
    const { claimId } = registerClaim(db, claimInput())
    const before = claimStabilityKeyToken(claimStabilityKey(readClaim(db, claimId)!))

    expect(clearClaimScopeAlias(db, ALPHA_SCOPE)).toBe(1)
    expect(readClaimScopeAlias(db, ALPHA_SCOPE)).toBeNull()
    expect(claimStabilityKeyToken(claimStabilityKey(readClaim(db, claimId)!))).toBe(before)
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
})
