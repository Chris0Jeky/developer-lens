import {
  BASELINE_WINDOW,
  CLAIM_IDS,
  CURRENT_WINDOW,
  EVIDENCE_IDS,
  INTEGRATION_SHAPE_AS_OF,
  INTEGRATION_SHAPE_SCOPE_ID,
} from './integrationShape.js'
import type {
  AnalyticReference,
} from './findings.js'
import type {
  WhyCapabilityNode,
  WhyClaimReferenceNode,
  WhyClaimSummary,
  WhyCollectionJobNode,
  WhyCoverageNode,
  WhyEdge,
  WhyEdgeGroup,
  WhyEvidenceNode,
  WhyExplanationTree,
  WhyLimitation,
  WhyLineageEvent,
  WhyMissingLink,
  WhyScopeNode,
  WhyUnresolvable,
  WhyWalk,
  WhyWalkStep,
} from '../server/storage/whyResolver.js'

/**
 * DL-VALUE-01 evidence-walk projection. This is what the Evidence Drawer resolves and what the
 * minimal `/api/v2/evidence` endpoint serves: PRESENTATION-SHAPED projections in the whyResolver's
 * node vocabulary, never canonical records (#79). The C2 boundary holds by construction — every
 * node carries the content-free `scope_id` surrogate and names a coverage row by `(rangeStart,
 * jobId)`, never a `coverage_id` that would carry the alias verbatim (#86). No `node:crypto`, no
 * SQLite, no I/O: the trees are invented C1 fixtures typed against the resolver contract, so a
 * resolver-contract change breaks the build here rather than drifting.
 */
export const INTEGRATION_SHAPE_EVIDENCE_VERSION = '1.0.0' as const

/** The union the drawer's `resolve` callback returns (mirrors `EvidenceDrawer.EvidenceResolution`). */
export type IntegrationShapeEvidenceResolution =
  | WhyExplanationTree
  | WhyUnresolvable
  | WhyEvidenceNode
  | WhyMissingLink

const RESOLVER_VERSION = '1.0.0' as const
const SCHEMA_VERSION = '1.0.0' as const
const CONSENT_REVISION = 'consent-2026-06-01'
const JOB_STATUS = 'succeeded'

const CREATED_AT = INTEGRATION_SHAPE_AS_OF
const LINKED_AT = '2026-05-25T00:00:00.000Z'
const OBSERVED_AT = '2026-07-26T00:00:00.000Z'
const CORRECTION_AT = '2026-07-27T00:00:00.000Z'

/** github.core, exactly as `shared/capabilities.ts` registers it. */
const GITHUB_CORE: WhyCapabilityNode = {
  kind: 'capability',
  capabilityId: 'github.core',
  purposeCode: 'REPOSITORY_LIFECYCLE',
  classCeiling: 'C2',
  requiredGates: ['G2'],
  refusalStatus: 'never_authorized',
}

function lineageEvent(subjectId: string, eventKind: string, causedBy: string | null, occurredAt: string): WhyLineageEvent {
  return { kind: 'lineage_event', subjectId, eventKind, causedBy, occurredAt }
}

function job(jobId: string): WhyCollectionJobNode {
  return { kind: 'collection_job', jobId, status: JOB_STATUS, consentRevision: CONSENT_REVISION, capability: GITHUB_CORE }
}

function coverage(rangeStart: string, rangeEnd: string, jobId: string): WhyCoverageNode {
  return {
    kind: 'coverage',
    coverageKey: { rangeStart, jobId },
    rangeEnd,
    status: 'complete',
    limitationCode: 'COMPLETE',
    retryable: false,
    expectedUnits: 12,
    observedUnits: 12,
    omittedUnits: 0,
    saturationReason: null,
    observedAt: OBSERVED_AT,
    job: job(jobId),
  }
}

function evidenceNode(
  evidenceId: string,
  window: { start: string; end: string },
  jobId: string,
  opts: { layer?: string; lineage?: readonly WhyLineageEvent[] } = {},
): WhyEvidenceNode {
  return {
    kind: 'evidence',
    evidenceId,
    layer: opts.layer ?? 'observed',
    schemaVersion: 'evidence.v2',
    coverage: coverage(window.start, window.end, jobId),
    lineage: opts.lineage ?? [],
  }
}

/** The five raw evidence anchors behind the finding: ready/merge event streams and the open tail. */
const EVIDENCE_NODES: Readonly<Record<string, WhyEvidenceNode>> = {
  [EVIDENCE_IDS.readyCurrent]: evidenceNode(EVIDENCE_IDS.readyCurrent, CURRENT_WINDOW, 'job-current-01'),
  [EVIDENCE_IDS.mergeCurrent]: evidenceNode(EVIDENCE_IDS.mergeCurrent, CURRENT_WINDOW, 'job-current-01'),
  [EVIDENCE_IDS.readyBaseline]: evidenceNode(EVIDENCE_IDS.readyBaseline, BASELINE_WINDOW, 'job-baseline-01'),
  [EVIDENCE_IDS.mergeBaseline]: evidenceNode(EVIDENCE_IDS.mergeBaseline, BASELINE_WINDOW, 'job-baseline-01'),
  [EVIDENCE_IDS.openTailCurrent]: evidenceNode(EVIDENCE_IDS.openTailCurrent, CURRENT_WINDOW, 'job-current-01'),
}

function summary(claimId: string): WhyClaimSummary {
  return {
    claimId,
    layer: 'deterministic',
    statementCode: 'DELIVERY_FLOW',
    methodId: 'integration_shape_matched',
    methodVersion: '1.0.0',
    windowStart: CURRENT_WINDOW.start,
    windowEnd: CURRENT_WINDOW.end,
    scopeId: INTEGRATION_SHAPE_SCOPE_ID,
    schemaVersion: SCHEMA_VERSION,
    createdAt: CREATED_AT,
    supersededBy: null,
  }
}

function claimReferenceNode(claimId: string): WhyClaimReferenceNode {
  return { kind: 'claim_reference', ...summary(claimId), expandsWith: 'resolveWhy' }
}

function scope(): WhyScopeNode {
  return { kind: 'scope', scopeId: INTEGRATION_SHAPE_SCOPE_ID, hasAlias: true, linkedAt: LINKED_AT, aliasLink: null }
}

function limitation(limitationCode: string, dimension: string, copyKey: string): WhyLimitation {
  return { kind: 'limitation', limitationCode, dimension, copyKey }
}

function evidenceEdge(role: 'supports' | 'contradicts' | 'contextualizes' | 'limitation_basis', node: WhyEvidenceNode): WhyEdge {
  return { kind: 'edge', role, targetRef: node.evidenceId, target: node }
}

function claimEdge(node: WhyClaimReferenceNode): WhyEdge {
  return { kind: 'edge', role: 'derives_from', targetRef: node.claimId, target: node }
}

function coverageEdge(node: WhyCoverageNode): WhyEdge {
  return { kind: 'edge', role: 'coverage_basis', targetRef: `${node.coverageKey.rangeStart}|${node.coverageKey.jobId}`, target: node }
}

function group(role: WhyEdgeGroup['role'], targetKind: WhyEdgeGroup['targetKind'], edges: readonly WhyEdge[]): WhyEdgeGroup {
  return { kind: 'edge_group', role, targetKind, edges }
}

function sixGroups(edges: {
  supports?: readonly WhyEdge[]
  contradicts?: readonly WhyEdge[]
  contextualizes?: readonly WhyEdge[]
  derives_from?: readonly WhyEdge[]
  coverage_basis?: readonly WhyEdge[]
  limitation_basis?: readonly WhyEdge[]
}): readonly WhyEdgeGroup[] {
  return [
    group('supports', 'evidence', edges.supports ?? []),
    group('contradicts', 'evidence', edges.contradicts ?? []),
    group('contextualizes', 'evidence', edges.contextualizes ?? []),
    group('derives_from', 'claim', edges.derives_from ?? []),
    group('coverage_basis', 'coverage', edges.coverage_basis ?? []),
    group('limitation_basis', 'evidence', edges.limitation_basis ?? []),
  ]
}

function walk(relation: WhyWalk['relation'], steps: readonly WhyWalkStep[], termination: WhyWalk['termination']): WhyWalk {
  return { kind: 'walk', relation, bound: 64, steps, termination, missingLinks: [] }
}

function tree(fields: {
  claimId: string
  edges: readonly WhyEdgeGroup[]
  limitations?: readonly WhyLimitation[]
  lineage?: readonly WhyLineageEvent[]
  ancestry?: WhyWalk
}): WhyExplanationTree {
  return {
    kind: 'explanation',
    resolverVersion: RESOLVER_VERSION,
    bound: 64,
    element: null,
    claim: { kind: 'claim', ...summary(fields.claimId) },
    scope: scope(),
    edges: fields.edges,
    limitations: fields.limitations ?? [],
    lineage: fields.lineage ?? [],
    supersession: walk('supersession', [], 'terminal'),
    ancestry: fields.ancestry ?? walk('derives_from_ancestry', [], 'terminal'),
    unresolvedEdges: [],
  }
}

const CURRENT_COVERAGE = coverage(CURRENT_WINDOW.start, CURRENT_WINDOW.end, 'job-current-01')

/**
 * The rich distribution-shift tree. Supports rest on the current merge and ready event streams;
 * the open tail is CONTRADICTING evidence (the still-open pull requests whose eventual merge could
 * raise the current distribution); derivation ancestry reaches the baseline-window claim.
 */
function distributionTree(claimId: string): WhyExplanationTree {
  return tree({
    claimId,
    edges: sixGroups({
      supports: [
        evidenceEdge('supports', EVIDENCE_NODES[EVIDENCE_IDS.mergeCurrent]),
        evidenceEdge('supports', EVIDENCE_NODES[EVIDENCE_IDS.readyCurrent]),
      ],
      contradicts: [evidenceEdge('contradicts', EVIDENCE_NODES[EVIDENCE_IDS.openTailCurrent])],
      derives_from: [claimEdge(claimReferenceNode(CLAIM_IDS.baseline))],
      coverage_basis: [coverageEdge(CURRENT_COVERAGE)],
      limitation_basis: [evidenceEdge('limitation_basis', EVIDENCE_NODES[EVIDENCE_IDS.openTailCurrent])],
    }),
    limitations: [
      limitation('COVERAGE_UNITS_DIFFER', 'censoring_freedom', 'copy.integration_shape.censored_tails'),
      limitation('LINKAGE_NOT_CAUSAL', 'comparability', 'copy.integration_shape.not_causal'),
    ],
    lineage: [lineageEvent(claimId, 'correction', 'analytical-review', CORRECTION_AT)],
    ancestry: walk('derives_from_ancestry', [{ kind: 'walk_step', depth: 1, ...summary(CLAIM_IDS.baseline) }], 'terminal'),
  })
}

/** A count/ratio tree: fewer supports, still every section present so no drawer panel is blank. */
function countTree(claimId: string, supports: readonly WhyEvidenceNode[]): WhyExplanationTree {
  return tree({
    claimId,
    edges: sixGroups({
      supports: supports.map((node) => evidenceEdge('supports', node)),
      coverage_basis: [coverageEdge(CURRENT_COVERAGE)],
    }),
    limitations: [limitation('COVERAGE_UNITS_DIFFER', 'censoring_freedom', 'copy.integration_shape.censored_tails')],
  })
}

const BASELINE_COVERAGE = coverage(BASELINE_WINDOW.start, BASELINE_WINDOW.end, 'job-baseline-01')

const CLAIM_TREES: Readonly<Record<string, WhyExplanationTree>> = {
  [CLAIM_IDS.p50]: distributionTree(CLAIM_IDS.p50),
  [CLAIM_IDS.p75]: distributionTree(CLAIM_IDS.p75),
  [CLAIM_IDS.p90]: distributionTree(CLAIM_IDS.p90),
  [CLAIM_IDS.eligible]: countTree(CLAIM_IDS.eligible, [EVIDENCE_NODES[EVIDENCE_IDS.readyCurrent]]),
  [CLAIM_IDS.censored]: countTree(CLAIM_IDS.censored, [EVIDENCE_NODES[EVIDENCE_IDS.openTailCurrent]]),
  [CLAIM_IDS.matchedFraction]: countTree(CLAIM_IDS.matchedFraction, [EVIDENCE_NODES[EVIDENCE_IDS.mergeCurrent]]),
  [CLAIM_IDS.baseline]: tree({
    claimId: CLAIM_IDS.baseline,
    edges: sixGroups({
      supports: [evidenceEdge('supports', EVIDENCE_NODES[EVIDENCE_IDS.mergeBaseline]), evidenceEdge('supports', EVIDENCE_NODES[EVIDENCE_IDS.readyBaseline])],
      coverage_basis: [coverageEdge(BASELINE_COVERAGE)],
    }),
  }),
}

function unresolvable(claimId: string): WhyUnresolvable {
  return { kind: 'unresolvable', resolverVersion: RESOLVER_VERSION, reason: 'UNKNOWN_CLAIM', claimId, lineage: [] }
}

function missingEvidence(evidenceId: string): WhyMissingLink {
  return { kind: 'missing_link', reason: 'MISSING_EVIDENCE', targetKind: 'evidence', targetId: evidenceId, coverageKey: null, lineage: [] }
}

/**
 * Resolves one analytic reference to its evidence-walk projection. Total and read-only: an unknown
 * claim resolves to an honest `UNKNOWN_CLAIM`, an unknown observation to a `MISSING_EVIDENCE` link —
 * never a partial tree that reads as a successful walk.
 */
export function resolveIntegrationShapeEvidence(reference: AnalyticReference): IntegrationShapeEvidenceResolution {
  if (reference.kind === 'observation') {
    return EVIDENCE_NODES[reference.evidenceId] ?? missingEvidence(reference.evidenceId)
  }
  return CLAIM_TREES[reference.claimId] ?? unresolvable(reference.claimId)
}

/** Every reference the finding renders, for the endpoint's enumerable projection and tests. */
export const INTEGRATION_SHAPE_REFERENCES: readonly AnalyticReference[] = [
  { kind: 'claim', claimId: CLAIM_IDS.p50, claimLayer: 'deterministic' },
  { kind: 'claim', claimId: CLAIM_IDS.p75, claimLayer: 'deterministic' },
  { kind: 'claim', claimId: CLAIM_IDS.p90, claimLayer: 'deterministic' },
  { kind: 'claim', claimId: CLAIM_IDS.eligible, claimLayer: 'deterministic' },
  { kind: 'claim', claimId: CLAIM_IDS.censored, claimLayer: 'deterministic' },
  { kind: 'claim', claimId: CLAIM_IDS.matchedFraction, claimLayer: 'deterministic' },
  { kind: 'observation', evidenceId: EVIDENCE_IDS.readyCurrent },
  { kind: 'observation', evidenceId: EVIDENCE_IDS.mergeCurrent },
  { kind: 'observation', evidenceId: EVIDENCE_IDS.readyBaseline },
  { kind: 'observation', evidenceId: EVIDENCE_IDS.mergeBaseline },
  { kind: 'observation', evidenceId: EVIDENCE_IDS.openTailCurrent },
]
