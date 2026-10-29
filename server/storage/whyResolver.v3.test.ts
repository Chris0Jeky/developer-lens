import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { WhyResolutionSchema } from '../../shared/whyContract.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import { sweepStorageV3C2 } from './v3ShadowSweep.js'
import { deleteStorageV3Scope } from './v3Deletion.js'
import { resolveWhy, type WhyExplanationTree, type WhyEdgeTarget } from './whyResolver.js'

// Invented in-memory rows only. The production schema, sweep and deletion paths stay real.
const key = (prefix: string, character: string) => `${prefix}${character.repeat(64)}`
const SCOPE = key('scope-', 'a')
const OTHER_SCOPE = key('scope-', 'b')
const CLAIM = key('cl_', '1')
const ANCESTOR = key('cl_', '2')
const SUCCESSOR = key('cl_', '3')
const FOREIGN_CLAIM = key('cl_', '4')
const EVIDENCE = key('ev-', '5')
const FOREIGN_EVIDENCE = key('ev-', '6')
const COVERAGE = key('cov-', '7')
const FOREIGN_COVERAGE = key('cov-', '8')
const JOB = key('job-', '9')
const FOREIGN_JOB = key('job-', 'c')
const SNAPSHOT = key('snap-', 'd')
const FOREIGN_SNAPSHOT = key('snap-', 'e')
const START = '2025-01-01T00:00:00.000Z'
const END = '2025-02-01T00:00:00.000Z'
const CREATED = '2025-02-02T12:00:00.000Z'
const EXPIRES = '2026-03-02T12:00:00.000Z'
const ALIAS = 'invented-alias-canary-native-why'
const SOURCE = 'invented-source-canary-native-why'
const FOREIGN_METHOD = 'invented-foreign-method-canary'
const databases: Database.Database[] = []
afterEach(() => { for (const db of databases.splice(0)) db.close() })

function seedClaim(db: Database.Database, scope: string, claim: string, method = 'native-method') {
  db.prepare(`INSERT INTO claim (scope_id, claim_id, layer, statement_code, method_id,
    method_version, window_start, window_end, schema_version, claim_id_material_version, created_at)
    VALUES (?, ?, 'modelled', 'DELIVERY_FLOW', ?, '1.0.0', ?, ?, '1.0.0', 'claim-id.v3', ?)`)
    .run(scope, claim, method, START, END, CREATED)
}

function fixture() {
  const db = new Database(':memory:')
  databases.push(db)
  installStorageV3ShadowSchema(db)
  for (const [scope, job, snapshot, coverage, evidence, alias] of [
    [SCOPE, JOB, SNAPSHOT, COVERAGE, EVIDENCE, ALIAS],
    [OTHER_SCOPE, FOREIGN_JOB, FOREIGN_SNAPSHOT, FOREIGN_COVERAGE, FOREIGN_EVIDENCE, 'other-alias-canary'],
  ]) {
    db.prepare('INSERT INTO claim_scope VALUES (?, ?, ?, ?)').run(scope, alias, CREATED, EXPIRES)
    db.prepare(`INSERT INTO collection_job (scope_id, job_id, capability_id, storage_contract_version,
      query_version, source_api_version, consent_revision, status, source_job_id, payload_hash,
      range_start, range_end, observed_at, started_at, completed_at, c2_expires_at)
      VALUES (?, ?, 'github.core', '2.2.0', 'github.core.v1', '2026-03-10', 'consent-native',
      'complete', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(scope, job, SOURCE + job, 'f'.repeat(64), START, END, CREATED, CREATED, CREATED, EXPIRES)
    db.prepare(`INSERT INTO source_snapshot (scope_id, snapshot_id, job_id, capability_id,
      source_snapshot_id, snapshot_hash, range_start, range_end, observed_at, c2_expires_at, status)
      VALUES (?, ?, ?, 'github.core', ?, ?, ?, ?, ?, ?, 'closed')`)
      .run(scope, snapshot, job, SOURCE + snapshot, 'f'.repeat(64), START, END, CREATED, EXPIRES)
    db.prepare(`INSERT INTO coverage_ledger (scope_id, coverage_id, job_id, snapshot_id, capability_id,
      status, expected_units, observed_units, omitted_units, retryable, limitation_code,
      source_coverage_id, range_start, range_end, observed_at, c2_expires_at)
      VALUES (?, ?, ?, ?, 'github.core', 'complete', 3, 3, 0, 0, 'NONE', ?, ?, ?, ?, ?)`)
      .run(scope, coverage, job, snapshot, SOURCE + coverage, START, END, CREATED, EXPIRES)
    db.prepare(`INSERT INTO evidence VALUES (?, ?, ?, 'observed', '2.0.0')`).run(scope, evidence, coverage)
  }
  seedClaim(db, SCOPE, CLAIM)
  seedClaim(db, SCOPE, ANCESTOR)
  seedClaim(db, SCOPE, SUCCESSOR)
  seedClaim(db, OTHER_SCOPE, FOREIGN_CLAIM, FOREIGN_METHOD)
  db.prepare('UPDATE claim SET superseded_by = ? WHERE claim_id = ?').run(SUCCESSOR, CLAIM)
  for (const role of ['supports', 'contradicts', 'contextualizes', 'limitation_basis']) {
    db.prepare(`INSERT INTO claim_evidence_edge (scope_id, claim_id, role, target_evidence_id)
      VALUES (?, ?, ?, ?)`).run(SCOPE, CLAIM, role, EVIDENCE)
  }
  db.prepare(`INSERT INTO claim_evidence_edge (scope_id, claim_id, role, target_claim_id)
    VALUES (?, ?, 'derives_from', ?)`).run(SCOPE, CLAIM, ANCESTOR)
  db.prepare(`INSERT INTO claim_evidence_edge (scope_id, claim_id, role, target_coverage_id)
    VALUES (?, ?, 'coverage_basis', ?)`).run(SCOPE, CLAIM, COVERAGE)
  db.prepare(`INSERT INTO limitation_instance VALUES (?, ?, 'SAMPLE_TOO_SMALL', 'sample', 'native.copy')`)
    .run(SCOPE, CLAIM)
  return db
}

function tree(db: Database.Database): WhyExplanationTree {
  const result = resolveWhy(db, { claimId: CLAIM })
  expect(result.kind).toBe('explanation')
  if (result.kind !== 'explanation') throw new Error('expected native explanation')
  expect(WhyResolutionSchema.parse(JSON.parse(JSON.stringify(result)))).toEqual(result)
  return result
}

function target(result: WhyExplanationTree, role: string): WhyEdgeTarget {
  const edges = result.edges.find((group) => group.role === role)!.edges
  expect(edges).toHaveLength(1)
  return edges[0].target
}

function tombstone(db: Database.Database, subjectKind: string, subject: string, scope = SCOPE) {
  db.prepare(`INSERT INTO lineage_event (scope_id, subject_kind, subject_id, operation_id,
    capability_id, caused_by, event_kind, event_week)
    VALUES (NULL, ?, ?, ?, 'github.core', ?, 'tombstone_cascade', '2026-W10')`)
    .run(subjectKind, subject, key('del-', 'f'), scope)
}

// Damage is intentional: read-time scope checks must defend stores inherited without FK enforcement.
function hostile(db: Database.Database) {
  db.pragma('foreign_keys = OFF')
  for (const row of db.prepare("SELECT name FROM sqlite_schema WHERE type = 'trigger'").all() as { name: string }[]) {
    db.exec(`DROP TRIGGER "${row.name}"`)
  }
}

describe('native-v3 why walks', () => {
  it('resolves evidence, claim and direct coverage edges through capability and consent', () => {
    const db = fixture()
    const result = tree(db)
    expect(result.unresolvedEdges).toEqual([])
    expect(result.edges.map((group) => group.edges.length)).toEqual([1, 1, 1, 1, 1, 1])
    expect(target(result, 'supports')).toMatchObject({ kind: 'evidence', evidenceId: EVIDENCE,
      coverage: { kind: 'coverage', observedUnits: 3, coverageKey: { rangeStart: START, jobId: JOB },
        job: { kind: 'collection_job', consentRevision: 'consent-native', capability: { capabilityId: 'github.core' } } } })
    expect(target(result, 'coverage_basis')).toMatchObject({ kind: 'coverage', observedUnits: 3 })
    expect(target(result, 'derives_from')).toMatchObject({ kind: 'claim_reference', claimId: ANCESTOR })
    expect(result.ancestry.steps.map((step) => step.claimId)).toEqual([ANCESTOR])
    expect(result.supersession.steps.map((step) => step.claimId)).toEqual([SUCCESSOR])
    expect(result.limitations).toEqual([{ kind: 'limitation', limitationCode: 'SAMPLE_TOO_SMALL', dimension: 'sample', copyKey: 'native.copy' }])
    const serialized = JSON.stringify(result)
    for (const canary of [ALIAS, SOURCE, FOREIGN_METHOD, COVERAGE, FOREIGN_COVERAGE]) expect(serialized).not.toContain(canary)
    expect(resolveWhy(db, { claimId: CLAIM })).toEqual(result)
  })

  it('refuses an explicit scope mismatch without disclosing another scope lineage', () => {
    const db = fixture()
    expect(resolveWhy(db, { claimId: CLAIM, scopeId: OTHER_SCOPE })).toMatchObject({
      kind: 'unresolvable', reason: 'UNKNOWN_CLAIM', claimId: CLAIM, lineage: [],
    })
    expect(resolveWhy(db, { claimId: CLAIM, scopeId: 'invented malformed scope' })).toMatchObject({
      kind: 'unresolvable', reason: 'INVALID_REQUEST', claimId: null,
    })
  })

  it('never follows foreign-scope evidence, coverage, claim, supersession or limitations', () => {
    const db = fixture()
    hostile(db)
    db.prepare("UPDATE claim_evidence_edge SET target_evidence_id = ? WHERE role = 'supports'").run(FOREIGN_EVIDENCE)
    db.prepare("UPDATE claim_evidence_edge SET target_claim_id = ? WHERE role = 'derives_from'").run(FOREIGN_CLAIM)
    db.prepare("UPDATE claim_evidence_edge SET target_coverage_id = ? WHERE role = 'coverage_basis'").run(FOREIGN_COVERAGE)
    db.prepare('UPDATE claim SET superseded_by = ? WHERE claim_id = ?').run(FOREIGN_CLAIM, CLAIM)
    db.prepare(`INSERT INTO limitation_instance VALUES (?, ?, 'COVERAGE_INCOMPLETE', 'completeness', 'foreign.copy')`)
      .run(OTHER_SCOPE, CLAIM)
    // An event owned by the other scope must not explain this scope's dangling target.
    tombstone(db, 'claim', FOREIGN_CLAIM, OTHER_SCOPE)
    const result = tree(db)
    expect(target(result, 'supports')).toMatchObject({ kind: 'missing_link', reason: 'MISSING_EVIDENCE', lineage: [] })
    expect(target(result, 'derives_from')).toMatchObject({ kind: 'missing_link', reason: 'MISSING_CLAIM', lineage: [] })
    expect(target(result, 'coverage_basis')).toMatchObject({ kind: 'missing_link', reason: 'MISSING_COVERAGE', lineage: [] })
    expect(result.ancestry.steps).toEqual([])
    expect(result.supersession.steps).toEqual([])
    expect(result.ancestry.termination).toBe('missing_link')
    expect(result.supersession.termination).toBe('missing_link')
    expect(JSON.stringify(result)).not.toContain(FOREIGN_METHOD)
    expect(JSON.stringify(result)).not.toContain('foreign.copy')
  })

  it('does not follow a foreign job or foreign coverage behind local evidence', () => {
    const db = fixture()
    hostile(db)
    db.prepare('UPDATE evidence SET coverage_id = ? WHERE evidence_id = ?').run(FOREIGN_COVERAGE, EVIDENCE)
    expect(target(tree(db), 'supports')).toMatchObject({ kind: 'evidence', coverage: { kind: 'missing_link', reason: 'MISSING_COVERAGE' } })
    db.prepare('UPDATE evidence SET coverage_id = ? WHERE evidence_id = ?').run(COVERAGE, EVIDENCE)
    db.prepare('UPDATE coverage_ledger SET job_id = ? WHERE coverage_id = ?').run(FOREIGN_JOB, COVERAGE)
    expect(target(tree(db), 'coverage_basis')).toMatchObject({ kind: 'coverage', job: { kind: 'missing_link', reason: 'MISSING_CAPABILITY_BINDING', lineage: [] } })
  })

  it('distinguishes missing and deleted evidence and claims without subject-kind collisions', () => {
    const db = fixture()
    hostile(db)
    db.prepare('DELETE FROM evidence WHERE evidence_id = ?').run(EVIDENCE)
    db.prepare('DELETE FROM claim WHERE claim_id = ?').run(ANCESTOR)
    expect(target(tree(db), 'supports')).toMatchObject({ reason: 'MISSING_EVIDENCE' })
    tombstone(db, 'evidence', EVIDENCE)
    tombstone(db, 'claim', ANCESTOR)
    // A hostile record with the same id but another subject kind must not reach the result.
    db.pragma('ignore_check_constraints = ON')
    db.prepare(`INSERT INTO lineage_event VALUES (NULL, 'job', ?, ?, 'github.core', ?, 'tombstone_cascade', '2026-W09')`)
      .run(EVIDENCE, key('del-', 'e'), SCOPE)
    const result = tree(db)
    expect(target(result, 'supports')).toMatchObject({ reason: 'TOMBSTONED_EVIDENCE', lineage: [
      { subjectId: EVIDENCE, occurredAt: null, eventWeek: '2026-W10' },
    ] })
    expect(target(result, 'derives_from')).toMatchObject({ reason: 'TOMBSTONED_CLAIM', lineage: [
      { subjectId: ANCESTOR, occurredAt: null, eventWeek: '2026-W10' },
    ] })
  })

  it('carries scoped tombstone lineage for missing coverage and collection jobs', () => {
    const db = fixture()
    hostile(db)
    db.prepare('DELETE FROM collection_job WHERE job_id = ?').run(JOB)
    tombstone(db, 'job', JOB)
    expect(target(tree(db), 'coverage_basis')).toMatchObject({ kind: 'coverage', job: {
      kind: 'missing_link', reason: 'MISSING_CAPABILITY_BINDING', lineage: [{ subjectId: JOB, occurredAt: null, eventWeek: '2026-W10' }],
    } })
    db.prepare('DELETE FROM coverage_ledger WHERE coverage_id = ?').run(COVERAGE)
    tombstone(db, 'coverage', COVERAGE)
    const result = tree(db)
    expect(target(result, 'coverage_basis')).toMatchObject({ kind: 'missing_link', reason: 'MISSING_COVERAGE', lineage: [
      { subjectId: COVERAGE, occurredAt: null, eventWeek: '2026-W10' },
    ] })
    expect(target(result, 'supports')).toMatchObject({ kind: 'evidence', coverage: {
      reason: 'MISSING_COVERAGE', lineage: [{ subjectId: COVERAGE, eventWeek: '2026-W10' }],
    } })
  })

  it('preserves C1 coverage and consent after the real C2 sweep removes all exact dates', () => {
    const db = fixture()
    expect(sweepStorageV3C2({ targetDb: db, asOf: EXPIRES }).status).toBe('complete')
    const result = tree(db)
    expect(result.claim.createdAt).toBeNull()
    expect(result.scope).toMatchObject({ kind: 'scope', hasAlias: false, linkedAt: null, aliasLink: { reason: 'SCOPE_ALIAS_CLEARED' } })
    expect(target(result, 'coverage_basis')).toMatchObject({ kind: 'coverage', observedUnits: 3,
      expectedUnits: 3, omittedUnits: 0, coverageKey: { rangeStart: null, jobId: JOB }, rangeEnd: null, observedAt: null,
      job: { consentRevision: 'consent-native' } })
    expect(JSON.stringify(result)).not.toContain(ALIAS)
    expect(JSON.stringify(result)).not.toContain(CREATED)
  })

  it('explains a root removed by the real scope deletion with only its retained ISO-week lineage', () => {
    const db = fixture()
    expect(deleteStorageV3Scope({ db, scopeId: SCOPE, asOf: '2026-03-02T12:00:00.000Z' }).status).toBe('deleted')
    const result = resolveWhy(db, { claimId: CLAIM, scopeId: SCOPE })
    expect(result).toMatchObject({ kind: 'unresolvable', reason: 'UNKNOWN_CLAIM', lineage: [
      { subjectId: CLAIM, eventKind: 'tombstone_cascade', occurredAt: null, eventWeek: '2026-W10', causedBy: SCOPE },
    ] })
    expect(WhyResolutionSchema.parse(JSON.parse(JSON.stringify(result)))).toEqual(result)
    expect(resolveWhy(db, { claimId: CLAIM, scopeId: OTHER_SCOPE })).toMatchObject({ lineage: [] })
  })

  it('bounds native ancestry and supersession and terminates hostile cycles', () => {
    const db = fixture()
    hostile(db)
    seedClaim(db, SCOPE, key('cl_', 'a'))
    db.prepare('UPDATE claim SET superseded_by = ? WHERE claim_id = ?').run(key('cl_', 'a'), SUCCESSOR)
    const limited = resolveWhy(db, { claimId: CLAIM, maxDepth: 1 }) as WhyExplanationTree
    expect(limited.supersession.steps.map((step) => step.claimId)).toEqual([SUCCESSOR])
    expect(limited.supersession.termination).toBe('depth_limit_reached')
    db.prepare('UPDATE claim SET superseded_by = ? WHERE claim_id = ?').run(CLAIM, SUCCESSOR)
    db.prepare(`INSERT INTO claim_evidence_edge (scope_id, claim_id, role, target_claim_id)
      VALUES (?, ?, 'derives_from', ?)`).run(SCOPE, ANCESTOR, CLAIM)
    const result = tree(db)
    expect(result.supersession.termination).toBe('cycle_detected')
    expect(result.ancestry.termination).toBe('cycle_detected')
    expect(result.ancestry.steps.map((step) => step.claimId)).toEqual([ANCESTOR])
  })
})
