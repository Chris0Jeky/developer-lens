import type Database from 'better-sqlite3'
import { z } from 'zod'
import {
  CLAIM_EDGE_ROLES,
  CLAIM_EDGE_ROLE_TARGET_KIND,
  ClaimIdSchema,
  OpaqueTokenSchema,
  type ClaimEdgeRole,
  type ClaimEdgeTargetKind,
} from '../../shared/claims.js'
import { CAPABILITY_REGISTRY } from '../../shared/capabilities.js'

/**
 * "Why am I seeing this number?" — the ADR-01 walk as one deterministic, read-only
 * resolver: UI element -> claim -> edges -> evidence -> coverage -> capability ->
 * consent revision. This module is the data half of the Evidence Drawer; it renders
 * nothing and writes nothing.
 *
 * Four properties the Drawer depends on, all proven in `whyResolver.test.ts`:
 *
 * 1. **Missing links are furniture, never silence.** A dangling, tombstoned, or absent
 *    target resolves to a typed `WhyMissingLink` with a reason code. Nothing is dropped
 *    and nothing is invented: an unresolvable input ID yields `WhyUnresolvable`, never a
 *    partial tree that reads as a successful walk.
 * 2. **Termination is guaranteed.** The two transitive relations — `superseded_by` chains
 *    and `derives_from` ancestry — are walked with an explicit depth bound AND a
 *    visited/on-path set. DL-SPINE-02 adds a write-time cycle guard; this resolver does
 *    not rely on it, because a legacy or hostile store must not be able to hang a read.
 * 3. **Determinism.** Same store, same request => deep-equal tree. Every collection is
 *    ordered by a documented rule (see ORDERING below); no ordering anywhere depends on
 *    SQLite row order, insertion order, or locale.
 * 4. **The C2 boundary holds.** The tree carries the content-free `scope_id` surrogate
 *    only. `claim_scope.scope_alias` and `coverage_ledger.scope_alias` /
 *    `collection_job.scope_alias` are never selected — the scope node reports
 *    `hasAlias` computed inside SQLite (`scope_alias IS NOT NULL`), so the alias value
 *    never crosses into JavaScript at all. `coverage_id` is likewise never emitted: the
 *    connector mints it as `github.core:${scopeAlias}:${rangeEnd}`, so the identifier
 *    itself carries the alias verbatim (issue #86). A coverage row is referenced here by
 *    `(rangeStart, jobId)` instead — `coverage_ledger.job_id` is UNIQUE, so that pair
 *    identifies the row exactly. The durable fix is the connector re-minting a
 *    content-free `coverage_id`; until then the resolver simply refuses to transport the
 *    tainted identifier, which keeps this property true rather than merely asserted.
 *
 * WHAT THIS MODULE DOES NOT BOUND. The depth bound and per-claim de-duplication cap the
 * two transitive walks, not the tree's total size: a claim may carry arbitrarily many
 * edges, limitations, and lineage events, and there is no node or expansion budget over
 * the whole result. A consumer that renders this (UX-ED) must bound its own output.
 *
 * ORDERING (the determinism rule, in full):
 * - Edge groups: the fixed `CLAIM_EDGE_ROLES` declaration order. All six groups are
 *   always present, empty ones included — "no contradicting evidence" is a fact the
 *   Drawer must be able to render.
 * - Edges within a group: ascending by `targetRef` (evidence id, claim id, or
 *   `rangeStart|jobId`).
 * - Limitations: ascending by `limitationCode|dimension` (the table's primary key).
 * - Lineage events: ascending by `occurredAt|eventKind|causedBy`.
 * - Walk steps: supersession in chain order; ancestry in depth-first pre-order, each
 *   node's ancestors expanded in ascending id order.
 * - Missing links inside a walk: de-duplicated, then ascending by
 *   `targetKind|targetId|reason`.
 * All comparisons use UTF-16 code-unit order (the `Array.prototype.sort` default),
 * never `localeCompare`, which is locale-dependent and would break replay.
 *
 * READ-ONLY CONSUMER: every statement here is a SELECT against the tables installed by
 * `server/storage/claims.ts` and `server/storage/incremental.ts`. This module imports
 * only closed registries and validators from the shared contracts, never a writer
 * helper, so the claim-writer rewrite in DL-SPINE-02 cannot silently change what a
 * "why" answer means.
 */
export const WHY_RESOLVER_VERSION = '1.0.0' as const

/** Depth applied when a request does not name one. */
export const WHY_DEFAULT_DEPTH_BOUND = 64

/** Hard clamp. No request can ask the resolver to walk further than this. */
export const WHY_MAX_DEPTH_BOUND = 512

export const WHY_MISSING_LINK_REASONS = [
  'CYCLE_DETECTED',
  'DEPTH_LIMIT_REACHED',
  'MALFORMED_EDGE',
  'MISSING_CAPABILITY_BINDING',
  'MISSING_CLAIM',
  'MISSING_COVERAGE',
  'MISSING_EVIDENCE',
  'MISSING_SCOPE',
  'SCOPE_ALIAS_CLEARED',
  'TOMBSTONED_CLAIM',
  'TOMBSTONED_EVIDENCE',
  'UNREGISTERED_CAPABILITY',
] as const
export type WhyMissingLinkReason = typeof WHY_MISSING_LINK_REASONS[number]

export const WHY_TARGET_KINDS = [
  'capability',
  'claim',
  'collection_job',
  'coverage',
  'edge',
  'evidence',
  'scope',
] as const
export type WhyTargetKind = typeof WHY_TARGET_KINDS[number]

export const WHY_UNRESOLVABLE_REASONS = [
  'INVALID_REQUEST',
  'MALFORMED_CLAIM_ID',
  'STORAGE_UNAVAILABLE',
  'UNKNOWN_CLAIM',
] as const
export type WhyUnresolvableReason = typeof WHY_UNRESOLVABLE_REASONS[number]

export const WHY_WALK_TERMINATIONS = [
  'terminal',
  'cycle_detected',
  'depth_limit_reached',
  'missing_link',
] as const
export type WhyWalkTermination = typeof WHY_WALK_TERMINATIONS[number]

/**
 * How the tree names a `coverage_ledger` row. Deliberately NOT the row's `coverage_id`:
 * the connector mints that as `github.core:${scopeAlias}:${rangeEnd}`, so it carries the
 * C2 alias value verbatim (issue #86 — the connector-side re-mint is the durable fix).
 * `job_id` is UNIQUE in `coverage_ledger`, so `(rangeStart, jobId)` identifies the row
 * exactly while staying content-free.
 */
export interface WhyCoverageKey {
  readonly rangeStart: string
  readonly jobId: string
}

/**
 * The full composite primary key, used only to look the row up. It never leaves this
 * module — every emitted reference is narrowed to `WhyCoverageKey` first.
 */
interface CoverageLookup extends WhyCoverageKey {
  readonly coverageId: string
}

function emittedCoverageKey(lookup: CoverageLookup): WhyCoverageKey {
  return { rangeStart: lookup.rangeStart, jobId: lookup.jobId }
}

export interface WhyLineageEvent {
  readonly kind: 'lineage_event'
  readonly subjectId: string
  readonly eventKind: string
  readonly causedBy: string | null
  readonly occurredAt: string
}

/**
 * The explicit stand-in for a link the walk could not follow. It carries why, what kind
 * of thing is missing, and which identifier was expected — plus any lineage recorded
 * against that identifier, which is how a tombstone explains itself after its row is gone.
 */
export interface WhyMissingLink {
  readonly kind: 'missing_link'
  readonly reason: WhyMissingLinkReason
  readonly targetKind: WhyTargetKind
  readonly targetId: string | null
  readonly coverageKey: WhyCoverageKey | null
  readonly lineage: readonly WhyLineageEvent[]
}

/** Where the walk terminates: the declared capability, from the closed registry. */
export interface WhyCapabilityNode {
  readonly kind: 'capability'
  readonly capabilityId: string
  readonly purposeCode: string
  readonly classCeiling: string
  readonly requiredGates: readonly string[]
  readonly refusalStatus: string
}

/** The consent revision under which the evidence behind this claim was collected. */
export interface WhyCollectionJobNode {
  readonly kind: 'collection_job'
  readonly jobId: string
  readonly status: string
  readonly consentRevision: string
  readonly capability: WhyCapabilityNode | WhyMissingLink
}

export interface WhyCoverageNode {
  readonly kind: 'coverage'
  readonly coverageKey: WhyCoverageKey
  readonly rangeEnd: string
  readonly status: string
  readonly limitationCode: string
  readonly retryable: boolean
  readonly expectedUnits: number | null
  readonly observedUnits: number
  readonly omittedUnits: number | null
  readonly saturationReason: string | null
  readonly observedAt: string
  readonly job: WhyCollectionJobNode | WhyMissingLink
}

export interface WhyEvidenceNode {
  readonly kind: 'evidence'
  readonly evidenceId: string
  readonly layer: string
  readonly schemaVersion: string
  readonly coverage: WhyCoverageNode | WhyMissingLink
  readonly lineage: readonly WhyLineageEvent[]
}

/** C1 claim content. No alias value, by construction: `scope_alias` is never selected. */
export interface WhyClaimSummary {
  readonly claimId: string
  readonly layer: string
  readonly statementCode: string
  readonly methodId: string
  readonly methodVersion: string
  readonly windowStart: string
  readonly windowEnd: string
  readonly scopeId: string
  readonly schemaVersion: string
  readonly createdAt: string
  readonly supersededBy: string | null
}

export interface WhyClaimNode extends WhyClaimSummary {
  readonly kind: 'claim'
}

/**
 * A `derives_from` target resolved exactly one level. Deeper recursion is deliberately
 * not inlined — the caller re-enters `resolveWhy` with this `claimId`, which is what
 * keeps a single answer bounded regardless of graph shape. The transitive shape is
 * still summarised, without full sub-trees, by the `ancestry` walk.
 */
export interface WhyClaimReferenceNode extends WhyClaimSummary {
  readonly kind: 'claim_reference'
  readonly expandsWith: 'resolveWhy'
}

/**
 * C2 boundary node. `hasAlias` says whether the installation-scoped alias link still
 * exists; the alias VALUE is never read out of SQLite. Invariant, asserted in tests:
 * `hasAlias === (aliasLink === null)`.
 *
 * `linkedAt` is exported at the millisecond precision the C2 partition table stores,
 * while ADR-01's grain rule renders derived surfaces at ISO-week grain or coarser. That
 * is deliberate: the resolver exposes the raw value and the RENDER layer (UX-ED) owns
 * applying the grain floor — a data module that pre-rounded would leave a retention
 * sweeper unable to compute the 13-month alias-link boundary.
 */
export interface WhyScopeNode {
  readonly kind: 'scope'
  readonly scopeId: string
  readonly hasAlias: boolean
  readonly linkedAt: string
  readonly aliasLink: WhyMissingLink | null
}

export type WhyEdgeTarget =
  | WhyEvidenceNode
  | WhyClaimReferenceNode
  | WhyCoverageNode
  | WhyMissingLink

export interface WhyEdge {
  readonly kind: 'edge'
  readonly role: ClaimEdgeRole
  readonly targetRef: string
  readonly target: WhyEdgeTarget
}

export interface WhyEdgeGroup {
  readonly kind: 'edge_group'
  readonly role: ClaimEdgeRole
  readonly targetKind: ClaimEdgeTargetKind
  readonly edges: readonly WhyEdge[]
}

export interface WhyLimitation {
  readonly kind: 'limitation'
  readonly limitationCode: string
  readonly dimension: string
  readonly copyKey: string
}

export interface WhyWalkStep extends WhyClaimSummary {
  readonly kind: 'walk_step'
  readonly depth: number
}

/**
 * A bounded transitive walk. `termination` summarises the walk with a fixed precedence —
 * `cycle_detected` > `depth_limit_reached` > `missing_link` > `terminal` — while
 * `missingLinks` carries every individual marker, so no truncation is invisible.
 *
 * `depth_limit_reached` is conservative: in a re-convergent DAG a node first reached at
 * depth >= bound latches the marker even if a later, shorter path would have completed
 * the walk within the bound. The walk therefore may report truncation it did not
 * ultimately suffer — it fails safe, and never under-reports a walk that really was cut.
 */
export interface WhyWalk {
  readonly kind: 'walk'
  readonly relation: 'supersession' | 'derives_from_ancestry'
  readonly bound: number
  readonly steps: readonly WhyWalkStep[]
  readonly termination: WhyWalkTermination
  readonly missingLinks: readonly WhyMissingLink[]
}

/** The first hop: the rendered element the question was asked about. */
export interface WhyElementRef {
  readonly kind: 'ui_element'
  readonly elementId: string
}

export interface WhyExplanationTree {
  readonly kind: 'explanation'
  readonly resolverVersion: typeof WHY_RESOLVER_VERSION
  readonly bound: number
  readonly element: WhyElementRef | null
  readonly claim: WhyClaimNode
  readonly scope: WhyScopeNode | WhyMissingLink
  readonly edges: readonly WhyEdgeGroup[]
  readonly limitations: readonly WhyLimitation[]
  readonly lineage: readonly WhyLineageEvent[]
  readonly supersession: WhyWalk
  readonly ancestry: WhyWalk
  /**
   * Edge rows the table's CHECKs should make impossible (unknown role, or a target
   * column set that disagrees with the role). Empty for every store this codebase
   * creates; non-empty rather than silently dropped for one it inherits.
   */
  readonly unresolvedEdges: readonly WhyMissingLink[]
}

export interface WhyUnresolvable {
  readonly kind: 'unresolvable'
  readonly resolverVersion: typeof WHY_RESOLVER_VERSION
  readonly reason: WhyUnresolvableReason
  /** Echoed only when the requested id is well-formed; a malformed id is never echoed. */
  readonly claimId: string | null
  readonly lineage: readonly WhyLineageEvent[]
}

export type WhyExplanation = WhyExplanationTree | WhyUnresolvable

/**
 * `maxDepth` is deliberately not capped by the schema: an over-large request is clamped
 * to `WHY_MAX_DEPTH_BOUND` rather than refused, so a caller can never talk the resolver
 * out of being bounded, and never has to know the bound to get an answer.
 */
export const WhyRequestSchema = z
  .object({
    claimId: z.string(),
    elementId: OpaqueTokenSchema.optional(),
    maxDepth: z.number().int().min(1).optional(),
  })
  .strict()
export type WhyRequest = z.infer<typeof WhyRequestSchema>

const TOMBSTONE_EVENT_KIND = 'tombstone_cascade'

const CAPABILITY_BY_ID = new Map<string, typeof CAPABILITY_REGISTRY[number]>(
  CAPABILITY_REGISTRY.map((definition) => [definition.id, definition]),
)

const EDGE_ROLE_SET = new Set<string>(CLAIM_EDGE_ROLES)

interface ClaimRow {
  readonly claim_id: string
  readonly layer: string
  readonly statement_code: string
  readonly method_id: string
  readonly method_version: string
  readonly window_start: string
  readonly window_end: string
  readonly scope_id: string
  readonly schema_version: string
  readonly created_at: string
  readonly superseded_by: string | null
}

interface ScopeRow {
  readonly scope_id: string
  readonly linked_at: string
  readonly has_alias: number
}

interface EdgeRow {
  readonly role: string
  readonly target_evidence_id: string | null
  readonly target_claim_id: string | null
  readonly target_coverage_id: string | null
  readonly target_coverage_range_start: string | null
  readonly target_coverage_job_id: string | null
}

interface EvidenceRow {
  readonly evidence_id: string
  readonly layer: string
  readonly schema_version: string
  readonly coverage_id: string
  readonly coverage_range_start: string
  readonly coverage_job_id: string
}

interface CoverageRow {
  readonly coverage_id: string
  readonly range_start: string
  readonly job_id: string
  readonly range_end: string
  readonly status: string
  readonly expected_units: number | null
  readonly observed_units: number
  readonly omitted_units: number | null
  readonly saturation_reason: string | null
  readonly retryable: number
  readonly observed_at: string
  readonly limitation_code: string
}

interface JobRow {
  readonly job_id: string
  readonly status: string
  readonly consent_revision: string
  readonly capability_id: string
}

interface LimitationRow {
  readonly limitation_code: string
  readonly dimension: string
  readonly copy_key: string
}

interface LineageRow {
  readonly subject_id: string
  readonly event_kind: string
  readonly caused_by: string | null
  readonly occurred_at: string
}

interface AncestorRow {
  readonly target_claim_id: string
}

interface WhyStatements {
  readonly claim: Database.Statement
  readonly scope: Database.Statement
  readonly edges: Database.Statement
  readonly ancestors: Database.Statement
  readonly evidence: Database.Statement
  readonly coverage: Database.Statement
  readonly job: Database.Statement
  readonly limitations: Database.Statement
  readonly lineage: Database.Statement
}

/**
 * Prepared once per request and reused by every hop, so a 100-link chain costs 100 binds
 * rather than 100 compilations. Note what the scope statement does NOT select: the C2
 * alias value is reduced to a boolean inside SQLite.
 */
function prepareStatements(db: Database.Database): WhyStatements {
  return {
    claim: db.prepare(
      'SELECT claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, created_at, superseded_by FROM claim WHERE claim_id = ?',
    ),
    scope: db.prepare(
      'SELECT scope_id, linked_at, (scope_alias IS NOT NULL) AS has_alias FROM claim_scope WHERE scope_id = ?',
    ),
    edges: db.prepare(
      'SELECT role, target_evidence_id, target_claim_id, target_coverage_id, target_coverage_range_start, target_coverage_job_id FROM claim_evidence_edge WHERE claim_id = ?',
    ),
    ancestors: db.prepare(
      "SELECT target_claim_id FROM claim_evidence_edge WHERE claim_id = ? AND role = 'derives_from' AND target_claim_id IS NOT NULL",
    ),
    evidence: db.prepare(
      'SELECT evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id FROM evidence WHERE evidence_id = ?',
    ),
    coverage: db.prepare(
      'SELECT coverage_id, range_start, job_id, range_end, status, expected_units, observed_units, omitted_units, saturation_reason, retryable, observed_at, limitation_code FROM coverage_ledger WHERE coverage_id = ? AND range_start = ? AND job_id = ?',
    ),
    job: db.prepare(
      'SELECT job_id, status, consent_revision, capability_id FROM collection_job WHERE job_id = ?',
    ),
    limitations: db.prepare(
      'SELECT limitation_code, dimension, copy_key FROM limitation_instance WHERE claim_id = ?',
    ),
    lineage: db.prepare(
      'SELECT subject_id, event_kind, caused_by, occurred_at FROM lineage_event WHERE subject_id = ?',
    ),
  }
}

/** UTF-16 code-unit comparison. Deliberately not `localeCompare`. */
function byKey<T>(key: (value: T) => string): (left: T, right: T) => number {
  return (left, right) => {
    const a = key(left)
    const b = key(right)
    if (a < b) return -1
    return a > b ? 1 : 0
  }
}

function coverageRef(key: WhyCoverageKey): string {
  return `${key.rangeStart}|${key.jobId}`
}

function missingLink(
  reason: WhyMissingLinkReason,
  targetKind: WhyTargetKind,
  targetId: string | null,
  extra: { coverageKey?: WhyCoverageKey; lineage?: readonly WhyLineageEvent[] } = {},
): WhyMissingLink {
  return {
    kind: 'missing_link',
    reason,
    targetKind,
    targetId,
    coverageKey: extra.coverageKey ?? null,
    lineage: extra.lineage ?? [],
  }
}

function missingLinkKey(link: WhyMissingLink): string {
  return [
    link.targetKind,
    link.targetId ?? '',
    link.coverageKey ? coverageRef(link.coverageKey) : '',
    link.reason,
  ].join('|')
}

/**
 * De-duplicates identical markers and orders them. Two markers with the same key are the
 * same fact reached twice, so collapsing them loses nothing; a different reason for the
 * same target keeps its own entry because `reason` is part of the key.
 */
function normalizeMissingLinks(links: readonly WhyMissingLink[]): WhyMissingLink[] {
  const unique = new Map<string, WhyMissingLink>()
  for (const link of links) {
    const key = missingLinkKey(link)
    if (!unique.has(key)) unique.set(key, link)
  }
  return [...unique.values()].sort(byKey(missingLinkKey))
}

function readClaimRow(statements: WhyStatements, claimId: string): ClaimRow | null {
  return (statements.claim.get(claimId) as ClaimRow | undefined) ?? null
}

function readLineage(statements: WhyStatements, subjectId: string): WhyLineageEvent[] {
  const rows = statements.lineage.all(subjectId) as LineageRow[]
  return rows
    .map((row): WhyLineageEvent => ({
      kind: 'lineage_event',
      subjectId: row.subject_id,
      eventKind: row.event_kind,
      causedBy: row.caused_by,
      occurredAt: row.occurred_at,
    }))
    .sort(byKey((event) => `${event.occurredAt}|${event.eventKind}|${event.causedBy ?? ''}`))
}

function isTombstoned(lineage: readonly WhyLineageEvent[]): boolean {
  return lineage.some((event) => event.eventKind === TOMBSTONE_EVENT_KIND)
}

function claimSummary(row: ClaimRow): WhyClaimSummary {
  return {
    claimId: row.claim_id,
    layer: row.layer,
    statementCode: row.statement_code,
    methodId: row.method_id,
    methodVersion: row.method_version,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    scopeId: row.scope_id,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    supersededBy: row.superseded_by,
  }
}

/** An absent claim is either a recorded revocation or an unexplained dangling reference. */
function absentClaimLink(statements: WhyStatements, claimId: string): WhyMissingLink {
  const lineage = readLineage(statements, claimId)
  return missingLink(
    isTombstoned(lineage) ? 'TOMBSTONED_CLAIM' : 'MISSING_CLAIM',
    'claim',
    claimId,
    { lineage },
  )
}

function resolveCapability(capabilityId: string): WhyCapabilityNode | WhyMissingLink {
  const definition = CAPABILITY_BY_ID.get(capabilityId)
  if (!definition) return missingLink('UNREGISTERED_CAPABILITY', 'capability', capabilityId)
  return {
    kind: 'capability',
    capabilityId: definition.id,
    purposeCode: definition.purposeCode,
    classCeiling: definition.classCeiling,
    requiredGates: [...definition.requiredGates],
    refusalStatus: definition.refusalStatus,
  }
}

/**
 * The capability + consent-revision terminus of the walk. A coverage row whose owning
 * job is gone is exactly the "partial coverage" case: the numbers survive, the binding
 * that authorised them does not, and the Drawer must say so.
 */
function resolveJob(
  statements: WhyStatements,
  jobId: string,
): WhyCollectionJobNode | WhyMissingLink {
  const row = statements.job.get(jobId) as JobRow | undefined
  if (!row) return missingLink('MISSING_CAPABILITY_BINDING', 'collection_job', jobId)
  return {
    kind: 'collection_job',
    jobId: row.job_id,
    status: row.status,
    consentRevision: row.consent_revision,
    capability: resolveCapability(row.capability_id),
  }
}

/**
 * Looks the row up by its full composite primary key — so a store whose foreign keys were
 * not enforced cannot pass off a mismatched triple as present — and then emits only the
 * content-free part of that key. `targetId` is the job id for the same reason.
 */
function resolveCoverage(
  statements: WhyStatements,
  lookup: CoverageLookup,
): WhyCoverageNode | WhyMissingLink {
  const row = statements.coverage.get(lookup.coverageId, lookup.rangeStart, lookup.jobId) as
    | CoverageRow
    | undefined
  if (!row) {
    return missingLink('MISSING_COVERAGE', 'coverage', lookup.jobId, {
      coverageKey: emittedCoverageKey(lookup),
    })
  }
  return {
    kind: 'coverage',
    coverageKey: { rangeStart: row.range_start, jobId: row.job_id },
    rangeEnd: row.range_end,
    status: row.status,
    limitationCode: row.limitation_code,
    retryable: row.retryable !== 0,
    expectedUnits: row.expected_units,
    observedUnits: row.observed_units,
    omittedUnits: row.omitted_units,
    saturationReason: row.saturation_reason,
    observedAt: row.observed_at,
    job: resolveJob(statements, row.job_id),
  }
}

function resolveEvidence(
  statements: WhyStatements,
  evidenceId: string,
): WhyEvidenceNode | WhyMissingLink {
  const row = statements.evidence.get(evidenceId) as EvidenceRow | undefined
  const lineage = readLineage(statements, evidenceId)
  if (!row) {
    return missingLink(
      isTombstoned(lineage) ? 'TOMBSTONED_EVIDENCE' : 'MISSING_EVIDENCE',
      'evidence',
      evidenceId,
      { lineage },
    )
  }
  return {
    kind: 'evidence',
    evidenceId: row.evidence_id,
    layer: row.layer,
    schemaVersion: row.schema_version,
    coverage: resolveCoverage(statements, {
      coverageId: row.coverage_id,
      rangeStart: row.coverage_range_start,
      jobId: row.coverage_job_id,
    }),
    lineage,
  }
}

function resolveClaimReference(
  statements: WhyStatements,
  claimId: string,
): WhyClaimReferenceNode | WhyMissingLink {
  const row = readClaimRow(statements, claimId)
  if (!row) return absentClaimLink(statements, claimId)
  return { kind: 'claim_reference', ...claimSummary(row), expandsWith: 'resolveWhy' }
}

function resolveScope(
  statements: WhyStatements,
  scopeId: string,
): WhyScopeNode | WhyMissingLink {
  const row = statements.scope.get(scopeId) as ScopeRow | undefined
  if (!row) return missingLink('MISSING_SCOPE', 'scope', scopeId)
  const hasAlias = row.has_alias !== 0
  return {
    kind: 'scope',
    scopeId: row.scope_id,
    hasAlias,
    linkedAt: row.linked_at,
    aliasLink: hasAlias ? null : missingLink('SCOPE_ALIAS_CLEARED', 'scope', row.scope_id),
  }
}

interface ResolvedEdgeTarget {
  readonly targetRef: string
  readonly target: WhyEdgeTarget
}

/**
 * Resolves one edge row by the target kind its role declares, not by whichever column
 * happens to be populated. A row where the two disagree — which the table's CHECKs
 * already make unreachable for stores this codebase creates — is reported, not read
 * loosely and not skipped.
 */
function resolveEdgeTarget(
  statements: WhyStatements,
  row: EdgeRow,
): ResolvedEdgeTarget | null {
  if (!EDGE_ROLE_SET.has(row.role)) return null
  const expected = CLAIM_EDGE_ROLE_TARGET_KIND[row.role as ClaimEdgeRole]
  if (expected === 'evidence') {
    if (row.target_evidence_id === null) return null
    return {
      targetRef: row.target_evidence_id,
      target: resolveEvidence(statements, row.target_evidence_id),
    }
  }
  if (expected === 'claim') {
    if (row.target_claim_id === null) return null
    return {
      targetRef: row.target_claim_id,
      target: resolveClaimReference(statements, row.target_claim_id),
    }
  }
  if (
    row.target_coverage_id === null ||
    row.target_coverage_range_start === null ||
    row.target_coverage_job_id === null
  ) {
    return null
  }
  const lookup: CoverageLookup = {
    coverageId: row.target_coverage_id,
    rangeStart: row.target_coverage_range_start,
    jobId: row.target_coverage_job_id,
  }
  return {
    targetRef: coverageRef(emittedCoverageKey(lookup)),
    target: resolveCoverage(statements, lookup),
  }
}

/** Names the job id rather than `target_coverage_id`, which would carry the C2 alias (#86). */
function malformedEdgeLink(row: EdgeRow): WhyMissingLink {
  const targetId = row.target_evidence_id ?? row.target_claim_id ?? row.target_coverage_job_id
  return missingLink('MALFORMED_EDGE', 'edge', targetId ?? null)
}

interface ResolvedEdges {
  readonly groups: readonly WhyEdgeGroup[]
  readonly unresolved: readonly WhyMissingLink[]
}

function resolveEdges(statements: WhyStatements, claimId: string): ResolvedEdges {
  const rows = statements.edges.all(claimId) as EdgeRow[]
  const byRole = new Map<ClaimEdgeRole, WhyEdge[]>()
  const unresolved: WhyMissingLink[] = []

  for (const row of rows) {
    const resolved = resolveEdgeTarget(statements, row)
    if (!resolved) {
      unresolved.push(malformedEdgeLink(row))
      continue
    }
    const role = row.role as ClaimEdgeRole
    const bucket = byRole.get(role)
    const edge: WhyEdge = {
      kind: 'edge',
      role,
      targetRef: resolved.targetRef,
      target: resolved.target,
    }
    if (bucket) bucket.push(edge)
    else byRole.set(role, [edge])
  }

  const groups = CLAIM_EDGE_ROLES.map((role): WhyEdgeGroup => ({
    kind: 'edge_group',
    role,
    targetKind: CLAIM_EDGE_ROLE_TARGET_KIND[role],
    edges: (byRole.get(role) ?? []).sort(byKey((edge) => edge.targetRef)),
  }))

  return { groups, unresolved: normalizeMissingLinks(unresolved) }
}

function resolveLimitations(statements: WhyStatements, claimId: string): WhyLimitation[] {
  const rows = statements.limitations.all(claimId) as LimitationRow[]
  return rows
    .map((row): WhyLimitation => ({
      kind: 'limitation',
      limitationCode: row.limitation_code,
      dimension: row.dimension,
      copyKey: row.copy_key,
    }))
    .sort(byKey((limitation) => `${limitation.limitationCode}|${limitation.dimension}`))
}

function terminationOf(cycle: boolean, limited: boolean, missing: boolean): WhyWalkTermination {
  if (cycle) return 'cycle_detected'
  if (limited) return 'depth_limit_reached'
  if (missing) return 'missing_link'
  return 'terminal'
}

/**
 * Follows `superseded_by` to the head of the series. Three defences, any one of which is
 * enough on its own: a visited set (a cycle cannot be re-entered), the depth bound (a
 * chain longer than the bound stops with a marker), and the missing-row check (a
 * successor that does not exist ends the walk instead of throwing).
 */
function walkSupersession(
  statements: WhyStatements,
  origin: ClaimRow,
  bound: number,
): WhyWalk {
  const steps: WhyWalkStep[] = []
  const links: WhyMissingLink[] = []
  const visited = new Set<string>([origin.claim_id])
  let cycle = false
  let limited = false
  let missing = false
  let current = origin
  let depth = 0

  for (;;) {
    const nextId = current.superseded_by
    if (nextId === null) break
    if (visited.has(nextId)) {
      links.push(missingLink('CYCLE_DETECTED', 'claim', nextId))
      cycle = true
      break
    }
    if (depth >= bound) {
      links.push(missingLink('DEPTH_LIMIT_REACHED', 'claim', nextId))
      limited = true
      break
    }
    const row = readClaimRow(statements, nextId)
    if (!row) {
      links.push(absentClaimLink(statements, nextId))
      missing = true
      break
    }
    depth += 1
    visited.add(nextId)
    steps.push({ kind: 'walk_step', depth, ...claimSummary(row) })
    current = row
  }

  return {
    kind: 'walk',
    relation: 'supersession',
    bound,
    steps,
    termination: terminationOf(cycle, limited, missing),
    missingLinks: normalizeMissingLinks(links),
  }
}

/**
 * Depth-first `derives_from` ancestry. Two sets, doing two different jobs: `onPath` is
 * the cycle defence (an ancestor that is its own descendant), while `expanded` stops a
 * re-convergent DAG from being walked — or reported — twice. Ancestors are expanded in
 * ascending id order, so pre-order is stable across runs.
 */
function walkAncestry(statements: WhyStatements, origin: ClaimRow, bound: number): WhyWalk {
  const steps: WhyWalkStep[] = []
  const links: WhyMissingLink[] = []
  const expanded = new Set<string>()
  const onPath = new Set<string>()
  let cycle = false
  let limited = false
  let missing = false

  const ancestorIds = (claimId: string): string[] => {
    const rows = statements.ancestors.all(claimId) as AncestorRow[]
    return [...new Set(rows.map((row) => row.target_claim_id))].sort()
  }

  const visit = (row: ClaimRow, depth: number): void => {
    onPath.add(row.claim_id)
    expanded.add(row.claim_id)
    for (const ancestorId of ancestorIds(row.claim_id)) {
      if (onPath.has(ancestorId)) {
        links.push(missingLink('CYCLE_DETECTED', 'claim', ancestorId))
        cycle = true
        continue
      }
      if (expanded.has(ancestorId)) continue
      if (depth >= bound) {
        links.push(missingLink('DEPTH_LIMIT_REACHED', 'claim', ancestorId))
        limited = true
        continue
      }
      const ancestor = readClaimRow(statements, ancestorId)
      if (!ancestor) {
        links.push(absentClaimLink(statements, ancestorId))
        expanded.add(ancestorId)
        missing = true
        continue
      }
      steps.push({ kind: 'walk_step', depth: depth + 1, ...claimSummary(ancestor) })
      visit(ancestor, depth + 1)
    }
    onPath.delete(row.claim_id)
  }

  visit(origin, 0)

  return {
    kind: 'walk',
    relation: 'derives_from_ancestry',
    bound,
    steps,
    termination: terminationOf(cycle, limited, missing),
    missingLinks: normalizeMissingLinks(links),
  }
}

function unresolvable(
  reason: WhyUnresolvableReason,
  claimId: string | null,
  lineage: readonly WhyLineageEvent[] = [],
): WhyUnresolvable {
  return { kind: 'unresolvable', resolverVersion: WHY_RESOLVER_VERSION, reason, claimId, lineage }
}

/**
 * Resolves one "why am I seeing this?" question against a canonical store.
 *
 * Read-only and total: it never writes, never throws for a bad request or a broken
 * reference, and never returns a tree it could not complete. A store without the claim
 * graph installed answers `STORAGE_UNAVAILABLE`; a malformed id answers
 * `MALFORMED_CLAIM_ID` WITHOUT echoing the id back (a caller could have passed prose);
 * a well-formed id with no row answers `UNKNOWN_CLAIM`, carrying any lineage recorded
 * against it so a revoked claim can explain its own absence.
 */
export function resolveWhy(db: Database.Database, request: unknown): WhyExplanation {
  const parsed = WhyRequestSchema.safeParse(request)
  if (!parsed.success) return unresolvable('INVALID_REQUEST', null)
  if (!ClaimIdSchema.safeParse(parsed.data.claimId).success) {
    return unresolvable('MALFORMED_CLAIM_ID', null)
  }

  const claimId = parsed.data.claimId
  const bound = Math.min(parsed.data.maxDepth ?? WHY_DEFAULT_DEPTH_BOUND, WHY_MAX_DEPTH_BOUND)

  let statements: WhyStatements
  try {
    statements = prepareStatements(db)
  } catch {
    return unresolvable('STORAGE_UNAVAILABLE', claimId)
  }

  const row = readClaimRow(statements, claimId)
  if (!row) return unresolvable('UNKNOWN_CLAIM', claimId, readLineage(statements, claimId))

  const edges = resolveEdges(statements, claimId)
  return {
    kind: 'explanation',
    resolverVersion: WHY_RESOLVER_VERSION,
    bound,
    element: parsed.data.elementId
      ? { kind: 'ui_element', elementId: parsed.data.elementId }
      : null,
    claim: { kind: 'claim', ...claimSummary(row) },
    scope: resolveScope(statements, row.scope_id),
    edges: edges.groups,
    limitations: resolveLimitations(statements, claimId),
    lineage: readLineage(statements, claimId),
    supersession: walkSupersession(statements, row, bound),
    ancestry: walkAncestry(statements, row, bound),
    unresolvedEdges: edges.unresolved,
  }
}
