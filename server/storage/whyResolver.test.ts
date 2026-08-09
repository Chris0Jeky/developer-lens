import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { CLAIM_EDGE_ROLES, type ClaimEdgeRole } from '../../shared/claims.js'
import { reconcileGithubCoreReceipts } from '../connectors/github/core.js'
import { openStorageDatabase } from './database.js'
import {
  installIncrementalGithubCoreStorage,
  persistIncrementalGithubCoreTransition,
} from './incremental.js'
import {
  claimScopeTestSeams,
  clearClaimScopeAlias,
  installClaimGraphStorage,
  registerClaim,
  registerClaimScope,
  registerEvidenceAnchor,
  registerLineageEvent,
  supersedeClaim,
} from './claims.js'
import {
  WHY_DEFAULT_DEPTH_BOUND,
  WHY_MAX_DEPTH_BOUND,
  WHY_RESOLVER_VERSION,
  resolveWhy,
  type WhyEdgeGroup,
  type WhyExplanationTree,
  type WhyExplanation,
  type WhyMissingLink,
  type WhyUnresolvable,
} from './whyResolver.js'

/**
 * Every value in this file is invented. No real, private, or generated data is read, no
 * network call is made, and no person metric exists anywhere in the fixture.
 */
const WINDOW_START = '2026-01-05T00:00:00.000Z'
const WINDOW_END = '2026-04-06T00:00:00.000Z'
const CREATED_AT = '2026-04-06T12:00:00.000Z'
const LINKED_AT = '2026-01-05T00:00:00.000Z'
const REVOKED_AT = '2026-05-01T00:00:00.000Z'

/**
 * Post-#84 the writer MINTS the C1 surrogate (`scope-` + 64 hex) from entropy and returns
 * it; a caller can no longer choose one. These hold whatever the current fixture minted,
 * assigned by `whyFixture()` before any claim is registered, and are also returned on the
 * fixture so a test never has to reach for module state.
 */
let ALPHA_SCOPE = ''
let GAMMA_SCOPE = ''

/** C2 alias VALUES held in `claim_scope`. The contract: neither ever reaches a tree. */
const ALPHA_ALIAS = 'repo-a7'
const GAMMA_ALIAS = 'repo-g2'

/**
 * The OTHER alias namespace: `collection_job.scope_alias` / `coverage_ledger.scope_alias`.
 * Deliberately different values from the two above, because a canary set that only knew
 * the `claim_scope` aliases was blind to the connector baking these into `coverage_id`
 * (issue #86, since closed at both the connector and the ledger CHECK). Both namespaces
 * stay pinned: the canary defends the boundary, not the key's current shape.
 *
 * These were `scope-a` / `-b` / `-c` until #84 landed. They cannot be, any more: the
 * writer now mints surrogates as `scope-` + 64 hex, so a minted `scope-a1b2…` CONTAINS
 * the literal `scope-a` — a one-in-sixteen chance per scope of a false canary hit on a
 * value that is not an alias at all. The prefix is now unambiguous, which keeps the pin
 * exactly as strong while removing an accidental collision with an unrelated identifier.
 */
const COVERAGE_SCOPE_ALIASES = ['alias-alpha', 'alias-beta', 'alias-gamma'] as const

/** Prose, paths, and names a caller might hand the resolver as a claim id. */
const CANARIES = [
  'why is this number so low',
  'C:/Synthetic/fixture/secret.txt',
  'server/storage/whyResolver.ts',
  'Chris Jeky',
  'jeky.tck@gmail.com',
] as const

/** 100 supersession links: long enough to overrun the default bound, and to hang a naive walk. */
const DEEP_CHAIN_LINKS = 100

const databases: Database.Database[] = []

afterEach(() => {
  for (const db of databases.splice(0)) {
    if (db.open) db.close()
  }
})

interface CoverageRow {
  readonly coverage_id: string
  readonly range_start: string
  readonly job_id: string
}

interface CoverageKey {
  readonly coverageId: string
  readonly rangeStart: string
  readonly jobId: string
}

function bareDatabase(): Database.Database {
  const db = openStorageDatabase(':memory:')
  databases.push(db)
  return db
}

/**
 * A store that has been damaged the way a real one can be: DL-LIFE-02 (issue #80) still
 * owns deletion order and the tombstone cascade, so today's `evidence` and
 * `claim_evidence_edge` foreign keys are deliberately NO ACTION. Dropping the pragma is
 * how this file produces the half-cascaded shapes the resolver must survive without
 * asking the writer to be able to produce them.
 */
function withoutForeignKeys(db: Database.Database, mutate: () => void): void {
  db.pragma('foreign_keys = OFF')
  try {
    mutate()
  } finally {
    db.pragma('foreign_keys = ON')
  }
}

function persistJob(
  db: Database.Database,
  jobId: string,
  scopeAlias: string,
  consentRevision: string,
  rangeStart: string,
  rangeEnd: string,
  snapshotDigit: string,
): CoverageKey {
  persistIncrementalGithubCoreTransition(db, {
    jobId,
    scopeAlias,
    consentRevision,
    sourceSnapshotId: `snapshot-${jobId}`,
    startedAt: '2026-04-06T00:00:01.000Z',
    completedAt: '2026-04-06T00:00:02.000Z',
    transition: reconcileGithubCoreReceipts({
      checkpoint: null,
      // #86: the connector now takes a caller-owned content-free key instead of minting an
      // alias-bearing one. The per-job digit keeps these distinct without deriving anything.
      coverageId: `cov-${snapshotDigit.repeat(64)}`,
      scopeAlias,
      rangeStart,
      rangeEnd,
      observedAt: rangeEnd,
      jobId,
      consentRevision,
      pageCap: 2,
      snapshotHash: snapshotDigit.repeat(64),
      receipts: [{ receiptId: `receipt-${jobId}`, pageNumber: 1, unitIds: [], nextCursor: null }],
    }),
  })
  const row = db.prepare(
    'SELECT coverage_id, range_start, job_id FROM coverage_ledger WHERE job_id = ?',
  ).get(jobId) as CoverageRow
  return { coverageId: row.coverage_id, rangeStart: row.range_start, jobId: row.job_id }
}

function claimInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    layer: 'deterministic',
    statementCode: 'COVERAGE_GAP',
    methodId: 'det.base',
    methodVersion: '1.0.0',
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    scopeId: ALPHA_SCOPE,
    createdAt: CREATED_AT,
    // #84 enforces edges.min(1) — an unsupported statement has no walk and cannot enter.
    // Every fixture overrides this, but the default must be legal on its own.
    edges: [{ role: 'supports', targetEvidenceId: 'ev-a1' }],
    limitations: [],
    ...overrides,
  }
}

/**
 * The coverage identifiers this store recorded. Asserted absent from every tree, so the resolver
 * cannot regress into transporting them — that holds after #86 made them content-free too: a
 * storage identifier is not presentation material regardless of what it does or does not embed.
 */
function MINTED_COVERAGE_IDS(fixture: Fixture): string[] {
  return [fixture.coverageA, fixture.coverageB, fixture.coverageC].map((key) => key.coverageId)
}

interface Fixture {
  readonly db: Database.Database
  readonly coverageA: CoverageKey
  readonly coverageB: CoverageKey
  readonly coverageC: CoverageKey
  /** Minted by the writer, not chosen — see ALPHA_SCOPE/GAMMA_SCOPE above. */
  readonly alphaScopeId: string
  readonly gammaScopeId: string
  /** hypothesis claim carrying supports + contradicts + coverage_basis + limitation */
  readonly demoClaimId: string
  readonly tombstonedEvidenceClaimId: string
  readonly missingEvidenceClaimId: string
  readonly missingCoverageClaimId: string
  readonly partialCoverageClaimId: string
  readonly revokedAncestorClaimId: string
  readonly revokedBaseClaimId: string
  readonly clearedAliasClaimId: string
  readonly supersessionCycleClaimId: string
  readonly ancestryCycleClaimId: string
  readonly deepChainOriginClaimId: string
  readonly deepChainHeadClaimId: string
}

/**
 * One store carrying every fixture family the card names, so the termination proof can
 * sweep all of them at once rather than proving it per scenario.
 */
function whyFixture(): Fixture {
  const db = bareDatabase()
  installIncrementalGithubCoreStorage(db)
  const [aliasAlpha, aliasBeta, aliasGamma] = COVERAGE_SCOPE_ALIASES
  const coverageA = persistJob(
    db, 'job-a1', aliasAlpha, 'consent-a',
    '2026-01-05T00:00:00.000Z', '2026-01-06T00:00:00.000Z', 'a',
  )
  const coverageB = persistJob(
    db, 'job-b1', aliasBeta, 'consent-b',
    '2026-01-05T00:00:00.000Z', '2026-01-07T00:00:00.000Z', 'b',
  )
  const coverageC = persistJob(
    db, 'job-c1', aliasGamma, 'consent-c',
    '2026-01-05T00:00:00.000Z', '2026-01-08T00:00:00.000Z', 'c',
  )
  installClaimGraphStorage(db)

  // The surrogate is minted and returned; the caller supplies only the alias.
  ALPHA_SCOPE = registerClaimScope(db, { scopeAlias: ALPHA_ALIAS, linkedAt: LINKED_AT }).scopeId
  GAMMA_SCOPE = registerClaimScope(db, { scopeAlias: GAMMA_ALIAS, linkedAt: LINKED_AT }).scopeId

  const anchor = (evidenceId: string, coverage: CoverageKey): void => {
    registerEvidenceAnchor(db, { evidenceId, layer: 'deterministic', coverage })
  }
  anchor('ev-a1', coverageA)
  anchor('ev-a2', coverageA)
  anchor('ev-b1', coverageB)
  anchor('ev-c1', coverageC)
  anchor('ev-tomb-1', coverageA)
  anchor('ev-gone', coverageA)
  for (let index = 0; index <= DEEP_CHAIN_LINKS; index += 1) anchor(`ev-deep-${index}`, coverageA)

  const demo = registerClaim(db, claimInput({
    layer: 'hypothesis',
    statementCode: 'CI_RERUN_PATTERN',
    methodId: 'hyp.composer',
    edges: [
      { role: 'supports', targetEvidenceId: 'ev-a1' },
      { role: 'contradicts', targetEvidenceId: 'ev-a2' },
      { role: 'coverage_basis', targetCoverage: coverageA },
    ],
    limitations: [
      { limitationCode: 'RERUN_NOT_FLAKE', dimension: 'completeness', copyKey: 'hyp.ci_shift.truncated' },
    ],
  }))

  const tombstoned = registerClaim(db, claimInput({
    methodId: 'det.tombstoned',
    edges: [{ role: 'supports', targetEvidenceId: 'ev-tomb-1' }],
  }))
  const missingEvidence = registerClaim(db, claimInput({
    methodId: 'det.dangling',
    edges: [{ role: 'supports', targetEvidenceId: 'ev-gone' }],
  }))
  const missingCoverage = registerClaim(db, claimInput({
    methodId: 'det.nocoverage',
    edges: [{ role: 'supports', targetEvidenceId: 'ev-c1' }],
  }))
  const partialCoverage = registerClaim(db, claimInput({
    methodId: 'det.nojob',
    edges: [{ role: 'supports', targetEvidenceId: 'ev-b1' }],
  }))
  const revokedBase = registerClaim(db, claimInput({
    methodId: 'det.revoked_base',
    edges: [{ role: 'supports', targetEvidenceId: 'ev-a1' }],
  }))
  const revokedChild = registerClaim(db, claimInput({
    methodId: 'det.revoked_child',
    edges: [{ role: 'derives_from', targetClaimId: revokedBase.claimId }],
  }))
  const clearedAlias = registerClaim(db, claimInput({
    methodId: 'det.gamma',
    scopeId: GAMMA_SCOPE,
    edges: [{ role: 'supports', targetEvidenceId: 'ev-a1' }],
  }))

  // Same stability key, different evidence sets => two distinct ids in one series.
  const cycleFirst = registerClaim(db, claimInput({
    methodId: 'det.cycle',
    edges: [{ role: 'supports', targetEvidenceId: 'ev-a1' }],
  }))
  const cycleSecond = registerClaim(db, claimInput({
    methodId: 'det.cycle',
    edges: [{ role: 'supports', targetEvidenceId: 'ev-a2' }],
  }))

  const ancestryFirst = registerClaim(db, claimInput({
    methodId: 'det.ancestry_cycle',
    edges: [{ role: 'supports', targetEvidenceId: 'ev-a1' }],
  }))
  const ancestrySecond = registerClaim(db, claimInput({
    methodId: 'det.ancestry_cycle',
    edges: [
      { role: 'supports', targetEvidenceId: 'ev-a2' },
      { role: 'derives_from', targetClaimId: ancestryFirst.claimId },
    ],
  }))

  const deepChain: string[] = []
  for (let index = 0; index <= DEEP_CHAIN_LINKS; index += 1) {
    deepChain.push(registerClaim(db, claimInput({
      statementCode: 'DELIVERY_FLOW',
      methodId: 'det.delivery',
      edges: [{ role: 'supports', targetEvidenceId: `ev-deep-${index}` }],
    })).claimId)
  }
  for (let index = 0; index < DEEP_CHAIN_LINKS; index += 1) {
    supersedeClaim(db, { claimId: deepChain[index], supersededBy: deepChain[index + 1] })
  }

  registerLineageEvent(db, {
    subjectId: 'ev-tomb-1', eventKind: 'tombstone_cascade', causedBy: null, occurredAt: REVOKED_AT,
  })
  registerLineageEvent(db, {
    subjectId: revokedBase.claimId,
    eventKind: 'tombstone_cascade',
    causedBy: null,
    occurredAt: REVOKED_AT,
  })
  registerLineageEvent(db, {
    subjectId: demo.claimId, eventKind: 'correction', causedBy: revokedBase.claimId, occurredAt: CREATED_AT,
  })

  withoutForeignKeys(db, () => {
    // Tombstoned evidence: the cascade log outlives the row it names.
    db.prepare('DELETE FROM evidence WHERE evidence_id = ?').run('ev-tomb-1')
    // A dangling target with no lineage at all — a different, unexplained failure.
    db.prepare('DELETE FROM evidence WHERE evidence_id = ?').run('ev-gone')
    // Coverage row erased under a live evidence anchor.
    db.prepare('DELETE FROM coverage_ledger WHERE job_id = ?').run(coverageC.jobId)
    // Partial coverage: the ledger row survives, the capability/consent binding does not.
    db.prepare('DELETE FROM collection_job WHERE job_id = ?').run(coverageB.jobId)
    // Revoked ancestor.
    db.prepare('DELETE FROM claim WHERE claim_id = ?').run(revokedBase.claimId)
    // Supersession cycle. The writer forbids this today only by accident of ordering, and
    // DL-SPINE-02 is adding an explicit guard; the resolver must not depend on either.
    const supersede = db.prepare('UPDATE claim SET superseded_by = ? WHERE claim_id = ?')
    supersede.run(cycleSecond.claimId, cycleFirst.claimId)
    supersede.run(cycleFirst.claimId, cycleSecond.claimId)
    // derives_from cycle: the writer cannot mint it, because the second claim of the pair
    // must already exist before the first can point at it.
    db.prepare(
      'INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id, target_claim_id, target_coverage_id, target_coverage_range_start, target_coverage_job_id) VALUES (?, ?, NULL, ?, NULL, NULL, NULL)',
    ).run(ancestryFirst.claimId, 'derives_from', ancestrySecond.claimId)
  })

  clearClaimScopeAlias(db, GAMMA_SCOPE)

  return {
    db,
    coverageA,
    coverageB,
    coverageC,
    alphaScopeId: ALPHA_SCOPE,
    gammaScopeId: GAMMA_SCOPE,
    demoClaimId: demo.claimId,
    tombstonedEvidenceClaimId: tombstoned.claimId,
    missingEvidenceClaimId: missingEvidence.claimId,
    missingCoverageClaimId: missingCoverage.claimId,
    partialCoverageClaimId: partialCoverage.claimId,
    revokedAncestorClaimId: revokedChild.claimId,
    revokedBaseClaimId: revokedBase.claimId,
    clearedAliasClaimId: clearedAlias.claimId,
    supersessionCycleClaimId: cycleFirst.claimId,
    ancestryCycleClaimId: ancestryFirst.claimId,
    deepChainOriginClaimId: deepChain[0],
    deepChainHeadClaimId: deepChain[DEEP_CHAIN_LINKS],
  }
}

function explanation(result: WhyExplanation): WhyExplanationTree {
  expect(result.kind).toBe('explanation')
  return result as WhyExplanationTree
}

function group(tree: WhyExplanationTree, role: ClaimEdgeRole): WhyEdgeGroup {
  const found = tree.edges.find((candidate) => candidate.role === role)
  expect(found, `edge group ${role} must always be present`).toBeDefined()
  return found as WhyEdgeGroup
}

function soleTarget(tree: WhyExplanationTree, role: ClaimEdgeRole): unknown {
  const edges = group(tree, role).edges
  expect(edges).toHaveLength(1)
  return edges[0].target
}

function missing(value: unknown): WhyMissingLink {
  expect((value as { kind?: string }).kind).toBe('missing_link')
  return value as WhyMissingLink
}

/**
 * Every node the resolver may emit. A node kind absent from this set is a leaf the
 * termination sweep cannot reason about, which is itself a failure.
 */
const NODE_KINDS = new Set([
  'capability',
  'claim',
  'claim_reference',
  'collection_job',
  'coverage',
  'edge',
  'edge_group',
  'evidence',
  'explanation',
  'limitation',
  'lineage_event',
  'missing_link',
  'scope',
  'ui_element',
  'walk',
  'walk_step',
])

/** The one untagged object in the tree: a composite coverage_ledger primary key. */
const UNTAGGED_SLOTS = new Set(['coverageKey'])

/**
 * The card's acceptance criterion as an executable assertion: walk the returned tree and
 * require that every object is a tagged node, and that every hop which can fail has
 * either resolved or been replaced by a typed missing-link marker. Nothing may be a bare
 * `null`, a bare `undefined`, or an untagged shape standing in for a link.
 */
function assertTerminates(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertTerminates(item, `${path}[${index}]`))
    return
  }
  if (value === null || typeof value !== 'object') return
  const node = value as Record<string, unknown>
  expect(NODE_KINDS, `${path} is not a tagged resolver node`).toContain(node.kind)

  const resolvedOrMissing = (slot: string, ...resolvedKinds: string[]): void => {
    const child = node[slot] as { kind?: string } | null
    expect(child, `${path}.${slot} must not be absent`).toBeTruthy()
    expect(
      [...resolvedKinds, 'missing_link'],
      `${path}.${slot} must resolve or be an explicit missing link`,
    ).toContain(child?.kind)
  }

  if (node.kind === 'evidence') resolvedOrMissing('coverage', 'coverage')
  if (node.kind === 'coverage') resolvedOrMissing('job', 'collection_job')
  if (node.kind === 'collection_job') resolvedOrMissing('capability', 'capability')
  // The closed set of kinds an edge target may take — never the target's own kind, which
  // would make this assertion true by construction.
  if (node.kind === 'edge') resolvedOrMissing('target', 'evidence', 'claim_reference', 'coverage')
  if (node.kind === 'explanation') resolvedOrMissing('scope', 'scope')
  if (node.kind === 'missing_link') {
    expect(node.reason, `${path} must carry a reason code`).toEqual(expect.any(String))
  }

  for (const [key, child] of Object.entries(node)) {
    if (UNTAGGED_SLOTS.has(key)) continue
    if (typeof child === 'object' && child !== null) assertTerminates(child, `${path}.${key}`)
  }
}

function allClaimIds(db: Database.Database): string[] {
  return db.prepare('SELECT claim_id FROM claim ORDER BY claim_id').pluck().all() as string[]
}

describe('why resolver — the demo walk', () => {
  it('resolves a hypothesis claim to supports, contradicts, coverage basis, and limitation', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, {
      elementId: 'drawer.ci_rerun.headline',
      claimId: fixture.demoClaimId,
    }))

    expect(tree.resolverVersion).toBe(WHY_RESOLVER_VERSION)
    expect(tree.bound).toBe(WHY_DEFAULT_DEPTH_BOUND)
    expect(tree.element).toEqual({ kind: 'ui_element', elementId: 'drawer.ci_rerun.headline' })
    expect(tree.claim).toEqual({
      kind: 'claim',
      claimId: fixture.demoClaimId,
      layer: 'hypothesis',
      statementCode: 'CI_RERUN_PATTERN',
      methodId: 'hyp.composer',
      methodVersion: '1.0.0',
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      scopeId: ALPHA_SCOPE,
      schemaVersion: '1.0.0',
      createdAt: CREATED_AT,
      supersededBy: null,
    })

    // Every role is present, in the contract's declaration order, empty groups included.
    expect(tree.edges.map((entry) => entry.role)).toEqual([...CLAIM_EDGE_ROLES])
    expect(group(tree, 'contextualizes').edges).toEqual([])

    const supports = soleTarget(tree, 'supports') as Record<string, unknown>
    expect(supports.kind).toBe('evidence')
    expect(supports.evidenceId).toBe('ev-a1')
    const supportCoverage = supports.coverage as Record<string, unknown>
    expect(supportCoverage.kind).toBe('coverage')
    expect(supportCoverage.status).toBe('complete')
    expect(supportCoverage.limitationCode).toBe('COMPLETE')
    // The walk's terminus: capability + consent revision, reached through the owning job.
    expect(supportCoverage.job).toMatchObject({
      kind: 'collection_job',
      jobId: 'job-a1',
      status: 'complete',
      consentRevision: 'consent-a',
      capability: {
        kind: 'capability',
        capabilityId: 'github.core',
        purposeCode: 'REPOSITORY_LIFECYCLE',
        classCeiling: 'C2',
        requiredGates: ['G2'],
      },
    })

    expect((soleTarget(tree, 'contradicts') as Record<string, unknown>).evidenceId).toBe('ev-a2')
    expect(soleTarget(tree, 'coverage_basis')).toMatchObject({
      kind: 'coverage',
      coverageKey: { rangeStart: fixture.coverageA.rangeStart, jobId: fixture.coverageA.jobId },
      status: 'complete',
    })

    expect(tree.limitations).toEqual([{
      kind: 'limitation',
      limitationCode: 'RERUN_NOT_FLAKE',
      dimension: 'completeness',
      copyKey: 'hyp.ci_shift.truncated',
    }])
    expect(tree.lineage.map((event) => event.eventKind)).toEqual(['correction'])
    expect(tree.scope).toEqual({
      kind: 'scope',
      scopeId: ALPHA_SCOPE,
      hasAlias: true,
      linkedAt: LINKED_AT,
      aliasLink: null,
    })
    expect(tree.supersession.termination).toBe('terminal')
    expect(tree.supersession.steps).toEqual([])
    expect(tree.ancestry.termination).toBe('terminal')
    expect(tree.unresolvedEdges).toEqual([])
  })
})

describe('why resolver — determinism', () => {
  it('returns a deep-equal tree for repeated requests against the same store', () => {
    const fixture = whyFixture()
    for (const claimId of allClaimIds(fixture.db)) {
      const first = resolveWhy(fixture.db, { claimId })
      const second = resolveWhy(fixture.db, { claimId })
      expect(second).toEqual(first)
      expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    }
  })

  it('is insensitive to the order the edges were written in', () => {
    // Both stores must mint the SAME surrogate, or the two claim IDs cannot match: #84
    // hashes the scope component into the claim ID, and the surrogate is now random. The
    // writer's own invented-fixture seam injects the entropy, which is the only supported
    // way to make two independent stores agree — and it constrains the shape, not the
    // value, so the surrogate is still a real `scope-` + 64 hex minted from those bytes.
    const fixedEntropy = (size: number): Buffer => Buffer.alloc(size, 0x2a)
    const buildStore = (edges: readonly Record<string, unknown>[]): {
      db: Database.Database
      claimId: string
    } => {
      const db = bareDatabase()
      installIncrementalGithubCoreStorage(db)
      const coverage = persistJob(
        db, 'job-a1', COVERAGE_SCOPE_ALIASES[0], 'consent-a',
        '2026-01-05T00:00:00.000Z', '2026-01-06T00:00:00.000Z', 'a',
      )
      installClaimGraphStorage(db)
      const scope = claimScopeTestSeams.registerWithEntropy(
        db, { scopeAlias: ALPHA_ALIAS, linkedAt: LINKED_AT }, fixedEntropy,
      )
      for (const evidenceId of ['ev-a1', 'ev-a2']) {
        registerEvidenceAnchor(db, { evidenceId, layer: 'deterministic', coverage })
      }
      const registered = registerClaim(db, claimInput({
        layer: 'hypothesis',
        statementCode: 'CI_RERUN_PATTERN',
        methodId: 'hyp.composer',
        scopeId: scope.scopeId,
        edges: edges.map((edge) => (
          'targetCoverage' in edge ? { ...edge, targetCoverage: coverage } : edge
        )),
        limitations: [
          { limitationCode: 'RERUN_NOT_FLAKE', dimension: 'completeness', copyKey: 'hyp.ci_shift.truncated' },
        ],
      }))
      return { db, claimId: registered.claimId }
    }

    const forward = buildStore([
      { role: 'supports', targetEvidenceId: 'ev-a1' },
      { role: 'contradicts', targetEvidenceId: 'ev-a2' },
      { role: 'coverage_basis', targetCoverage: true },
    ])
    const reversed = buildStore([
      { role: 'coverage_basis', targetCoverage: true },
      { role: 'contradicts', targetEvidenceId: 'ev-a2' },
      { role: 'supports', targetEvidenceId: 'ev-a1' },
    ])
    // Same claim, written two ways — so any tree difference is ordering, not content.
    expect(reversed.claimId).toBe(forward.claimId)

    const forwardTree = explanation(resolveWhy(forward.db, { claimId: forward.claimId }))
    const reversedTree = explanation(resolveWhy(reversed.db, { claimId: reversed.claimId }))
    expect(reversedTree).toEqual(forwardTree)
    expect(JSON.stringify(reversedTree)).toBe(JSON.stringify(forwardTree))
  })
})

describe('why resolver — missing links are explicit', () => {
  it('marks tombstoned evidence and carries the cascade that explains it', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.tombstonedEvidenceClaimId }))
    const link = missing(soleTarget(tree, 'supports'))
    expect(link.reason).toBe('TOMBSTONED_EVIDENCE')
    expect(link.targetKind).toBe('evidence')
    expect(link.targetId).toBe('ev-tomb-1')
    expect(link.lineage).toEqual([{
      kind: 'lineage_event',
      subjectId: 'ev-tomb-1',
      eventKind: 'tombstone_cascade',
      causedBy: null,
      occurredAt: REVOKED_AT,
    }])
  })

  it('distinguishes an unexplained dangling reference from a recorded tombstone', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.missingEvidenceClaimId }))
    const link = missing(soleTarget(tree, 'supports'))
    expect(link.reason).toBe('MISSING_EVIDENCE')
    expect(link.targetId).toBe('ev-gone')
    expect(link.lineage).toEqual([])
  })

  it('marks an evidence anchor whose coverage row is gone', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.missingCoverageClaimId }))
    const evidence = soleTarget(tree, 'supports') as Record<string, unknown>
    expect(evidence.kind).toBe('evidence')
    const link = missing(evidence.coverage)
    expect(link.reason).toBe('MISSING_COVERAGE')
    expect(link.targetKind).toBe('coverage')
    expect(link.coverageKey).not.toBeNull()
  })

  it('marks partial coverage: numbers present, capability and consent binding absent', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.partialCoverageClaimId }))
    const evidence = soleTarget(tree, 'supports') as Record<string, unknown>
    const coverage = evidence.coverage as Record<string, unknown>
    expect(coverage.kind).toBe('coverage')
    expect(coverage.status).toBe('complete')
    const link = missing(coverage.job)
    expect(link.reason).toBe('MISSING_CAPABILITY_BINDING')
    expect(link.targetKind).toBe('collection_job')
    expect(link.targetId).toBe(fixture.coverageB.jobId)
  })

  it('marks a revoked ancestor on the edge and on the ancestry walk', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.revokedAncestorClaimId }))
    const link = missing(soleTarget(tree, 'derives_from'))
    expect(link.reason).toBe('TOMBSTONED_CLAIM')
    expect(link.targetId).toBe(fixture.revokedBaseClaimId)
    expect(link.lineage.map((event) => event.eventKind)).toEqual(['tombstone_cascade'])

    expect(tree.ancestry.termination).toBe('missing_link')
    expect(tree.ancestry.steps).toEqual([])
    expect(tree.ancestry.missingLinks).toHaveLength(1)
    expect(tree.ancestry.missingLinks[0].reason).toBe('TOMBSTONED_CLAIM')
  })

  it('reports a cleared C2 alias as furniture, not as an absent scope', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.clearedAliasClaimId }))
    expect(tree.scope).toEqual({
      kind: 'scope',
      scopeId: GAMMA_SCOPE,
      hasAlias: false,
      linkedAt: LINKED_AT,
      aliasLink: {
        kind: 'missing_link',
        reason: 'SCOPE_ALIAS_CLEARED',
        targetKind: 'scope',
        targetId: GAMMA_SCOPE,
        coverageKey: null,
        lineage: [],
      },
    })
  })

  it('reports an edge whose role and target kind disagree instead of dropping it', () => {
    const fixture = whyFixture()
    // Only a store built outside this codebase can hold such a row: the table's CHECKs
    // reject it, so the pragma is the only way to prove the resolver does not skip it.
    fixture.db.pragma('ignore_check_constraints = ON')
    try {
      fixture.db.prepare(
        'INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id, target_claim_id, target_coverage_id, target_coverage_range_start, target_coverage_job_id) VALUES (?, ?, NULL, ?, NULL, NULL, NULL)',
      ).run(fixture.demoClaimId, 'supports', fixture.clearedAliasClaimId)
    } finally {
      fixture.db.pragma('ignore_check_constraints = OFF')
    }

    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.demoClaimId }))
    expect(group(tree, 'supports').edges).toHaveLength(1)
    expect(tree.unresolvedEdges).toHaveLength(1)
    expect(tree.unresolvedEdges[0].reason).toBe('MALFORMED_EDGE')
    expect(tree.unresolvedEdges[0].targetId).toBe(fixture.clearedAliasClaimId)
  })
})

describe('why resolver — termination', () => {
  it('breaks a supersession cycle with an explicit marker', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.supersessionCycleClaimId }))
    expect(tree.supersession.termination).toBe('cycle_detected')
    expect(tree.supersession.steps).toHaveLength(1)
    expect(tree.supersession.missingLinks).toEqual([{
      kind: 'missing_link',
      reason: 'CYCLE_DETECTED',
      targetKind: 'claim',
      targetId: fixture.supersessionCycleClaimId,
      coverageKey: null,
      lineage: [],
    }])
  })

  it('breaks a derives_from cycle with an explicit marker', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.ancestryCycleClaimId }))
    expect(tree.ancestry.termination).toBe('cycle_detected')
    expect(tree.ancestry.steps).toHaveLength(1)
    expect(tree.ancestry.missingLinks.map((link) => link.reason)).toEqual(['CYCLE_DETECTED'])
    expect(tree.ancestry.missingLinks[0].targetId).toBe(fixture.ancestryCycleClaimId)
  })

  it('stops a 100-link chain at the default bound and reports the truncation', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.deepChainOriginClaimId }))
    expect(tree.bound).toBe(WHY_DEFAULT_DEPTH_BOUND)
    expect(tree.supersession.steps).toHaveLength(WHY_DEFAULT_DEPTH_BOUND)
    expect(tree.supersession.steps[0].depth).toBe(1)
    expect(tree.supersession.steps.at(-1)?.depth).toBe(WHY_DEFAULT_DEPTH_BOUND)
    expect(tree.supersession.termination).toBe('depth_limit_reached')
    expect(tree.supersession.missingLinks.map((link) => link.reason)).toEqual(['DEPTH_LIMIT_REACHED'])
  })

  it('walks the whole 100-link chain when the request allows it', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, {
      claimId: fixture.deepChainOriginClaimId,
      maxDepth: DEEP_CHAIN_LINKS + 28,
    }))
    expect(tree.supersession.termination).toBe('terminal')
    expect(tree.supersession.steps).toHaveLength(DEEP_CHAIN_LINKS)
    expect(tree.supersession.missingLinks).toEqual([])
    expect(tree.supersession.steps.at(-1)?.claimId).toBe(fixture.deepChainHeadClaimId)
    expect(tree.supersession.steps.at(-1)?.supersededBy).toBeNull()
  })

  it('clamps an over-large depth request rather than refusing it', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, {
      claimId: fixture.deepChainOriginClaimId,
      maxDepth: 10_000,
    }))
    expect(tree.bound).toBe(WHY_MAX_DEPTH_BOUND)
    expect(tree.supersession.termination).toBe('terminal')
    expect(tree.supersession.steps).toHaveLength(DEEP_CHAIN_LINKS)
  })

  it('terminates every fixture claim with full lineage or explicit missing links', () => {
    const fixture = whyFixture()
    const claimIds = allClaimIds(fixture.db)
    expect(claimIds.length).toBeGreaterThan(DEEP_CHAIN_LINKS)
    for (const claimId of claimIds) {
      const tree = explanation(resolveWhy(fixture.db, { claimId }))
      assertTerminates(tree, `claim(${claimId})`)
    }
  })
})

describe('why resolver — unresolvable input never renders as resolvable', () => {
  it('refuses a well-formed id with no row, and carries any revocation lineage', () => {
    const fixture = whyFixture()
    const absent = `cl_${'f'.repeat(64)}`
    expect(resolveWhy(fixture.db, { claimId: absent })).toEqual({
      kind: 'unresolvable',
      resolverVersion: WHY_RESOLVER_VERSION,
      reason: 'UNKNOWN_CLAIM',
      claimId: absent,
      lineage: [],
    })

    const revoked = resolveWhy(fixture.db, { claimId: fixture.revokedBaseClaimId })
    expect(revoked).toMatchObject({ kind: 'unresolvable', reason: 'UNKNOWN_CLAIM' })
    expect((revoked as WhyUnresolvable).lineage.map((event) => event.eventKind))
      .toEqual(['tombstone_cascade'])
  })

  it('refuses a malformed id without echoing it back', () => {
    const fixture = whyFixture()
    for (const canary of CANARIES) {
      const result = resolveWhy(fixture.db, { claimId: canary })
      expect(result).toEqual({
        kind: 'unresolvable',
        resolverVersion: WHY_RESOLVER_VERSION,
        reason: 'MALFORMED_CLAIM_ID',
        claimId: null,
        lineage: [],
      })
      expect(JSON.stringify(result)).not.toContain(canary)
    }
  })

  it('refuses a malformed request shape', () => {
    const fixture = whyFixture()
    const badRequests: unknown[] = [
      undefined,
      null,
      'cl_deadbeef',
      { claimId: 7 },
      { claimId: fixture.demoClaimId, elementId: 'Chris Jeky' },
      { claimId: fixture.demoClaimId, maxDepth: 0 },
      { claimId: fixture.demoClaimId, maxDepth: -4 },
      { claimId: fixture.demoClaimId, maxDepth: 1.5 },
      { claimId: fixture.demoClaimId, unexpected: true },
    ]
    for (const request of badRequests) {
      expect(resolveWhy(fixture.db, request)).toEqual({
        kind: 'unresolvable',
        resolverVersion: WHY_RESOLVER_VERSION,
        reason: 'INVALID_REQUEST',
        claimId: null,
        lineage: [],
      })
    }
  })

  it('refuses a store with no claim graph instead of throwing', () => {
    const db = bareDatabase()
    const claimId = `cl_${'0'.repeat(64)}`
    expect(resolveWhy(db, { claimId })).toEqual({
      kind: 'unresolvable',
      resolverVersion: WHY_RESOLVER_VERSION,
      reason: 'STORAGE_UNAVAILABLE',
      claimId,
      lineage: [],
    })
  })
})

describe('why resolver — the C2 boundary', () => {
  it('carries scope_id only and never lets any alias value cross', () => {
    const fixture = whyFixture()
    // BOTH alias namespaces, because they are different values and an earlier version of
    // this test checked only the first: the claim_scope C2 alias, AND the collection-side
    // scope_alias, which the connector once baked into coverage_id verbatim (issue #86,
    // now closed at both halves). The full stored coverage_id is asserted too, so a
    // regression cannot pass by emitting the identifier while the bare alias happens not
    // to appear.
    const forbidden = [
      ALPHA_ALIAS,
      GAMMA_ALIAS,
      ...COVERAGE_SCOPE_ALIASES,
      ...MINTED_COVERAGE_IDS(fixture),
      'scopeAlias',
      'scope_alias',
      'coverageId',
      'coverage_id',
    ]
    for (const claimId of allClaimIds(fixture.db)) {
      const serialized = JSON.stringify(resolveWhy(fixture.db, { claimId }))
      for (const needle of forbidden) {
        expect(serialized, `tree for ${claimId} must not carry ${needle}`).not.toContain(needle)
      }
    }
    // Both aliases are still there to be read on their own paths — the boundary is a
    // partition, not a deletion.
    expect(
      fixture.db.prepare('SELECT scope_alias FROM claim_scope WHERE scope_id = ?')
        .pluck().get(ALPHA_SCOPE),
    ).toBe(ALPHA_ALIAS)
    expect(
      fixture.db.prepare('SELECT scope_alias FROM collection_job WHERE job_id = ?')
        .pluck().get('job-a1'),
    ).toBe(COVERAGE_SCOPE_ALIASES[0])
  })

  it('names a coverage row by (rangeStart, jobId), never by the stored coverage_id', () => {
    const fixture = whyFixture()
    // #86 made the stored id content-free, so the alias is no longer IN it. The naming rule is
    // unchanged and independently defended: the resolver addresses a coverage row by its
    // (rangeStart, jobId) key, never by the storage identifier.
    expect(fixture.coverageA.coverageId).toMatch(/^cov-[0-9a-f]{64}$/)
    expect(fixture.coverageA.coverageId).not.toContain(COVERAGE_SCOPE_ALIASES[0])

    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.demoClaimId }))
    const coverageEdge = group(tree, 'coverage_basis').edges[0]
    expect(coverageEdge.targetRef)
      .toBe(`${fixture.coverageA.rangeStart}|${fixture.coverageA.jobId}`)
    expect(coverageEdge.target).toMatchObject({
      kind: 'coverage',
      coverageKey: { rangeStart: fixture.coverageA.rangeStart, jobId: fixture.coverageA.jobId },
    })
    expect(Object.keys((coverageEdge.target as { coverageKey: object }).coverageKey))
      .toEqual(['rangeStart', 'jobId'])
  })

  it('names an absent coverage row by its job id too', () => {
    const fixture = whyFixture()
    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.missingCoverageClaimId }))
    const evidence = soleTarget(tree, 'supports') as Record<string, unknown>
    const link = missing(evidence.coverage)
    expect(link.reason).toBe('MISSING_COVERAGE')
    expect(link.targetId).toBe(fixture.coverageC.jobId)
    expect(link.coverageKey).toEqual({
      rangeStart: fixture.coverageC.rangeStart,
      jobId: fixture.coverageC.jobId,
    })
  })

  it('reports the scope even when its C2 row was never registered', () => {
    const fixture = whyFixture()
    withoutForeignKeys(fixture.db, () => {
      fixture.db.prepare('DELETE FROM claim_scope WHERE scope_id = ?').run(GAMMA_SCOPE)
    })
    const tree = explanation(resolveWhy(fixture.db, { claimId: fixture.clearedAliasClaimId }))
    expect(tree.scope).toMatchObject({
      kind: 'missing_link',
      reason: 'MISSING_SCOPE',
      targetKind: 'scope',
      targetId: GAMMA_SCOPE,
    })
  })
})
