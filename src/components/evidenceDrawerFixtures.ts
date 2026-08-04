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
  WhyMissingLinkReason,
  WhyScopeNode,
  WhyTargetKind,
  WhyUnresolvable,
  WhyUnresolvableReason,
  WhyWalk,
  WhyWalkStep,
} from '../../server/storage/whyResolver.js'
import type { AnalyticReference, ClaimReference, EvidenceResolution, ObservationReference } from './EvidenceDrawer'

/**
 * Hand-authored fixtures for the Evidence Drawer, typed against `whyResolver.ts` exactly (every
 * value is checked by the imported types, so a resolver contract change breaks the build here).
 *
 * Privacy: every identifier below is invented (C0). No account, repository, person, or private
 * value appears; the trees exercise the SHAPE of a real walk, not real data.
 *
 * Ordering: each fixture is authored already sorted the way `whyResolver.ts` documents — edge
 * groups in `CLAIM_EDGE_ROLES` order, edges within a group ascending by `targetRef`, limitations
 * by `code|dimension`, lineage by `occurredAt|kind|causedBy`, ancestry pre-order ascending id.
 */

const RESOLVER_VERSION = '1.0.0' as const
const SCHEMA_VERSION = '1.0.0' as const

const WINDOW_START = '2026-06-01T00:00:00.000Z' // 2026-W23
const WINDOW_END = '2026-06-29T00:00:00.000Z' // 2026-W27
const CREATED_AT = '2026-08-03T12:34:56.789Z' // 2026-W32 — millisecond precision on purpose
const LINKED_AT = '2026-07-06T08:00:00.000Z' // 2026-W28
const OBSERVED_AT = '2026-06-28T23:59:59.999Z' // 2026-W26
const RANGE_END = '2026-06-29T00:00:00.000Z' // 2026-W27
const OCCURRED_AT = '2026-07-13T00:00:00.000Z' // 2026-W29

const SCOPE_ID = 'scope-0000000000000000000000000000000000000000000000000000000000000001'
const CLEARED_SCOPE_ID = 'scope-00000000000000000000000000000000000000000000000000000000000000c2'

function missing(
  reason: WhyMissingLinkReason,
  targetKind: WhyTargetKind,
  targetId: string | null,
  extra: { coverageKey?: { rangeStart: string; jobId: string }; lineage?: readonly WhyLineageEvent[] } = {},
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

function lineageEvent(
  subjectId: string,
  eventKind: string,
  causedBy: string | null,
  occurredAt: string,
): WhyLineageEvent {
  return { kind: 'lineage_event', subjectId, eventKind, causedBy, occurredAt }
}

function capability(capabilityId: string): WhyCapabilityNode {
  return {
    kind: 'capability',
    capabilityId,
    purposeCode: 'PRODUCT_ANALYTICS',
    classCeiling: 'C1',
    requiredGates: ['G2'],
    refusalStatus: 'never_authorized',
  }
}

function job(
  jobId: string,
  capabilityNode: WhyCapabilityNode | WhyMissingLink,
): WhyCollectionJobNode {
  return {
    kind: 'collection_job',
    jobId,
    status: 'succeeded',
    consentRevision: 'consent-2026-07-01',
    capability: capabilityNode,
  }
}

function coverage(
  rangeStart: string,
  jobId: string,
  jobNode: WhyCollectionJobNode | WhyMissingLink,
): WhyCoverageNode {
  return {
    kind: 'coverage',
    coverageKey: { rangeStart, jobId },
    rangeEnd: RANGE_END,
    status: 'complete',
    limitationCode: 'COVERAGE_INCOMPLETE',
    retryable: false,
    expectedUnits: 128,
    observedUnits: 128,
    omittedUnits: 0,
    saturationReason: null,
    observedAt: OBSERVED_AT,
    job: jobNode,
  }
}

function evidence(
  evidenceId: string,
  coverageNode: WhyCoverageNode | WhyMissingLink,
  opts: { layer?: string; lineage?: readonly WhyLineageEvent[] } = {},
): WhyEvidenceNode {
  return {
    kind: 'evidence',
    evidenceId,
    layer: opts.layer ?? 'observed',
    schemaVersion: 'evidence.v2',
    coverage: coverageNode,
    lineage: opts.lineage ?? [],
  }
}

function summary(
  claimId: string,
  layer: string,
  statementCode: string,
  opts: { methodId?: string; methodVersion?: string; supersededBy?: string | null; scopeId?: string } = {},
): WhyClaimSummary {
  return {
    claimId,
    layer,
    statementCode,
    methodId: opts.methodId ?? 'rerun-detector',
    methodVersion: opts.methodVersion ?? '2.1.0',
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    scopeId: opts.scopeId ?? SCOPE_ID,
    schemaVersion: SCHEMA_VERSION,
    createdAt: CREATED_AT,
    supersededBy: opts.supersededBy ?? null,
  }
}

function claimReference(claimSummary: WhyClaimSummary): WhyClaimReferenceNode {
  return { kind: 'claim_reference', ...claimSummary, expandsWith: 'resolveWhy' }
}

function scope(scopeId: string, hasAlias: boolean): WhyScopeNode {
  return {
    kind: 'scope',
    scopeId,
    hasAlias,
    linkedAt: LINKED_AT,
    aliasLink: hasAlias ? null : missing('SCOPE_ALIAS_CLEARED', 'scope', scopeId),
  }
}

function limitation(limitationCode: string, dimension: string, copyKey: string): WhyLimitation {
  return { kind: 'limitation', limitationCode, dimension, copyKey }
}

function evidenceEdge(
  role: 'supports' | 'contradicts' | 'contextualizes' | 'limitation_basis',
  target: WhyEvidenceNode | WhyMissingLink,
): WhyEdge {
  const targetRef = target.kind === 'evidence' ? target.evidenceId : target.targetId ?? ''
  return { kind: 'edge', role, targetRef, target }
}

function claimEdge(target: WhyClaimReferenceNode | WhyMissingLink): WhyEdge {
  const targetRef = target.kind === 'claim_reference' ? target.claimId : target.targetId ?? ''
  return { kind: 'edge', role: 'derives_from', targetRef, target }
}

function coverageEdge(rangeStart: string, jobId: string, target: WhyCoverageNode | WhyMissingLink): WhyEdge {
  return { kind: 'edge', role: 'coverage_basis', targetRef: `${rangeStart}|${jobId}`, target }
}

function group(role: WhyEdgeGroup['role'], targetKind: WhyEdgeGroup['targetKind'], edges: readonly WhyEdge[]): WhyEdgeGroup {
  return { kind: 'edge_group', role, targetKind, edges }
}

/** Six groups in the fixed `CLAIM_EDGE_ROLES` order; empty groups are still present. */
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

function walk(
  relation: WhyWalk['relation'],
  steps: readonly WhyWalkStep[],
  termination: WhyWalk['termination'],
  missingLinks: readonly WhyMissingLink[] = [],
): WhyWalk {
  return { kind: 'walk', relation, bound: 64, steps, termination, missingLinks }
}

function walkStep(claimSummary: WhyClaimSummary, depth: number): WhyWalkStep {
  return { kind: 'walk_step', depth, ...claimSummary }
}

function tree(fields: {
  claim: WhyClaimSummary
  edges: readonly WhyEdgeGroup[]
  scope: WhyScopeNode | WhyMissingLink
  limitations?: readonly WhyLimitation[]
  lineage?: readonly WhyLineageEvent[]
  supersession?: WhyWalk
  ancestry?: WhyWalk
  unresolvedEdges?: readonly WhyMissingLink[]
}): WhyExplanationTree {
  return {
    kind: 'explanation',
    resolverVersion: RESOLVER_VERSION,
    bound: 64,
    element: null,
    claim: { kind: 'claim', ...fields.claim },
    scope: fields.scope,
    edges: fields.edges,
    limitations: fields.limitations ?? [],
    lineage: fields.lineage ?? [],
    supersession: fields.supersession ?? walk('supersession', [], 'terminal'),
    ancestry: fields.ancestry ?? walk('derives_from_ancestry', [], 'terminal'),
    unresolvedEdges: fields.unresolvedEdges ?? [],
  }
}

function unresolvable(
  reason: WhyUnresolvableReason,
  claimId: string | null,
  lineage: readonly WhyLineageEvent[] = [],
): WhyUnresolvable {
  return { kind: 'unresolvable', resolverVersion: RESOLVER_VERSION, reason, claimId, lineage }
}

// --- THE DEMO: a hypothesis claim with supports + contradicts + a limitation ----------------

const DEMO_PARENT = summary('cl_demo_parent', 'deterministic', 'DELIVERY_FLOW', {
  methodId: 'flow-window',
  methodVersion: '1.4.0',
})

export const HYPOTHESIS_TREE: WhyExplanationTree = tree({
  claim: summary('cl_demo_hypothesis', 'hypothesis', 'CI_RERUN_PATTERN'),
  edges: sixGroups({
    supports: [
      evidenceEdge(
        'supports',
        evidence('ev_supp_ci_rerun', coverage('2026-06-01T00:00:00.000Z', 'job-ci-01', job('job-ci-01', capability('github.ci.core')))),
      ),
    ],
    contradicts: [
      evidenceEdge(
        'contradicts',
        evidence('ev_contra_flake', coverage('2026-06-08T00:00:00.000Z', 'job-ci-02', job('job-ci-02', capability('github.ci.core')))),
      ),
    ],
    derives_from: [claimEdge(claimReference(DEMO_PARENT))],
    coverage_basis: [
      coverageEdge('2026-05-25T00:00:00.000Z', 'job-ci-00', coverage('2026-05-25T00:00:00.000Z', 'job-ci-00', job('job-ci-00', capability('github.ci.core')))),
    ],
  }),
  scope: scope(SCOPE_ID, true),
  limitations: [limitation('COVERAGE_SPARSE', 'completeness', 'copy.coverage.sparse')],
  lineage: [lineageEvent('cl_demo_hypothesis', 'correction', 'review-round-3', OCCURRED_AT)],
  ancestry: walk('derives_from_ancestry', [walkStep(DEMO_PARENT, 1)], 'terminal'),
})

// --- A clean deterministic claim -------------------------------------------------------------

export const DETERMINISTIC_TREE: WhyExplanationTree = tree({
  claim: summary('cl_deterministic_flow', 'deterministic', 'DELIVERY_FLOW', {
    methodId: 'flow-window',
    methodVersion: '1.4.0',
  }),
  edges: sixGroups({
    supports: [
      evidenceEdge(
        'supports',
        evidence('ev_flow_merges', coverage('2026-06-01T00:00:00.000Z', 'job-flow-01', job('job-flow-01', capability('github.core'))), { layer: 'deterministic' }),
      ),
    ],
    coverage_basis: [
      coverageEdge('2026-06-01T00:00:00.000Z', 'job-flow-01', coverage('2026-06-01T00:00:00.000Z', 'job-flow-01', job('job-flow-01', capability('github.core')))),
    ],
  }),
  scope: scope(SCOPE_ID, true),
})

// --- Tombstoned evidence, cleared alias scope, and most missing-link codes -------------------

export const TOMBSTONED_TREE: WhyExplanationTree = tree({
  claim: summary('cl_tombstoned_subject', 'modelled', 'OWNERSHIP_COVERAGE', {
    methodId: 'ownership-model',
    methodVersion: '3.0.0',
  }),
  edges: sixGroups({
    supports: [
      evidenceEdge(
        'supports',
        missing('TOMBSTONED_EVIDENCE', 'evidence', 'ev_tombstoned_1', {
          lineage: [lineageEvent('ev_tombstoned_1', 'tombstone_cascade', 'deletion-request-42', OCCURRED_AT)],
        }),
      ),
    ],
    contradicts: [
      evidenceEdge(
        'contradicts',
        evidence(
          'ev_contra_nocov',
          missing('MISSING_COVERAGE', 'coverage', 'job-x-09', {
            coverageKey: { rangeStart: '2026-06-15T00:00:00.000Z', jobId: 'job-x-09' },
          }),
        ),
      ),
    ],
    contextualizes: [
      evidenceEdge(
        'contextualizes',
        evidence('ev_ctx_unreg', coverage('2026-06-08T00:00:00.000Z', 'job-ctx-03', job('job-ctx-03', missing('UNREGISTERED_CAPABILITY', 'capability', 'cap.unlisted.experimental')))),
      ),
    ],
    derives_from: [
      claimEdge(
        missing('TOMBSTONED_CLAIM', 'claim', 'cl_tombstoned_parent', {
          lineage: [lineageEvent('cl_tombstoned_parent', 'tombstone_cascade', 'cascade-7', OCCURRED_AT)],
        }),
      ),
    ],
    coverage_basis: [
      coverageEdge('2026-05-18T00:00:00.000Z', 'job-cov-11', coverage('2026-05-18T00:00:00.000Z', 'job-cov-11', missing('MISSING_CAPABILITY_BINDING', 'collection_job', 'job-cov-11'))),
    ],
    limitation_basis: [evidenceEdge('limitation_basis', missing('MISSING_EVIDENCE', 'evidence', 'ev_absent_lim'))],
  }),
  scope: scope(CLEARED_SCOPE_ID, false),
  limitations: [limitation('COVERAGE_RESTRICTED', 'permission', 'copy.coverage.restricted')],
  ancestry: walk(
    'derives_from_ancestry',
    [],
    'missing_link',
    [
      missing('TOMBSTONED_CLAIM', 'claim', 'cl_tombstoned_parent', {
        lineage: [lineageEvent('cl_tombstoned_parent', 'tombstone_cascade', 'cascade-7', OCCURRED_AT)],
      }),
    ],
  ),
  unresolvedEdges: [missing('MALFORMED_EDGE', 'edge', 'ev_malformed_target')],
})

// --- A cycle in the ancestry, a missing scope, and a missing parent claim --------------------

export const CYCLE_TREE: WhyExplanationTree = tree({
  claim: summary('cl_cycle_subject', 'modelled', 'COVERAGE_GAP', {
    methodId: 'coverage-gap',
    methodVersion: '2.0.0',
  }),
  edges: sixGroups({
    supports: [
      evidenceEdge(
        'supports',
        evidence('ev_cycle_ok', coverage('2026-06-01T00:00:00.000Z', 'job-cyc-01', job('job-cyc-01', capability('github.core')))),
      ),
    ],
    derives_from: [claimEdge(missing('MISSING_CLAIM', 'claim', 'cl_absent_parent'))],
  }),
  scope: missing('MISSING_SCOPE', 'scope', SCOPE_ID),
  ancestry: walk(
    'derives_from_ancestry',
    [walkStep(summary('cl_cycle_node_a', 'modelled', 'COVERAGE_GAP'), 1)],
    'cycle_detected',
    [missing('CYCLE_DETECTED', 'claim', 'cl_cycle_node_a')],
  ),
})

// --- A depth-limited ancestry ----------------------------------------------------------------

export const DEPTH_LIMITED_TREE: WhyExplanationTree = tree({
  claim: summary('cl_depth_subject', 'deterministic', 'DELIVERY_FLOW', {
    methodId: 'flow-window',
    methodVersion: '1.4.0',
  }),
  edges: sixGroups({
    supports: [
      evidenceEdge(
        'supports',
        evidence('ev_depth_ok', coverage('2026-06-01T00:00:00.000Z', 'job-dep-01', job('job-dep-01', capability('github.core'))), { layer: 'deterministic' }),
      ),
    ],
  }),
  scope: scope(SCOPE_ID, true),
  ancestry: walk(
    'derives_from_ancestry',
    [
      walkStep(summary('cl_depth_a', 'deterministic', 'DELIVERY_FLOW'), 1),
      walkStep(summary('cl_depth_b', 'deterministic', 'DELIVERY_FLOW'), 2),
    ],
    'depth_limit_reached',
    [missing('DEPTH_LIMIT_REACHED', 'claim', 'cl_depth_beyond')],
  ),
})

// --- A deep ancestry (100 nodes) for bounded rendering ---------------------------------------

const DEEP_STEPS: readonly WhyWalkStep[] = Array.from({ length: 100 }, (_unused, index) =>
  walkStep(summary(`cl_ancestor_${String(index).padStart(3, '0')}`, 'deterministic', 'DELIVERY_FLOW'), index + 1),
)

export const DEEP_ANCESTRY_TREE: WhyExplanationTree = tree({
  claim: summary('cl_deep_ancestry', 'deterministic', 'DELIVERY_FLOW', {
    methodId: 'flow-window',
    methodVersion: '1.4.0',
  }),
  edges: sixGroups({
    supports: [
      evidenceEdge(
        'supports',
        evidence('ev_deep_ok', coverage('2026-06-01T00:00:00.000Z', 'job-deep-01', job('job-deep-01', capability('github.core'))), { layer: 'deterministic' }),
      ),
    ],
  }),
  scope: scope(SCOPE_ID, true),
  ancestry: walk('derives_from_ancestry', DEEP_STEPS, 'terminal'),
})

// --- Unresolvable results, one per reason ----------------------------------------------------

export const UNKNOWN_CLAIM_RESULT: WhyUnresolvable = unresolvable('UNKNOWN_CLAIM', 'cl_unknown_revoked', [
  lineageEvent('cl_unknown_revoked', 'tombstone_cascade', 'revocation-request-9', OCCURRED_AT),
])
export const STORAGE_UNAVAILABLE_RESULT: WhyUnresolvable = unresolvable('STORAGE_UNAVAILABLE', 'cl_storage_probe')
export const INVALID_REQUEST_RESULT: WhyUnresolvable = unresolvable('INVALID_REQUEST', null)
export const MALFORMED_CLAIM_ID_RESULT: WhyUnresolvable = unresolvable('MALFORMED_CLAIM_ID', null)

// --- Observation-reference resolutions --------------------------------------------------------

export const OBSERVATION_ANCHOR: WhyEvidenceNode = evidence(
  'ev_observation_anchor',
  coverage('2026-06-01T00:00:00.000Z', 'job-obs-01', job('job-obs-01', capability('github.core'))),
  { layer: 'observed' },
)
export const OBSERVATION_TOMBSTONED: WhyMissingLink = missing('TOMBSTONED_EVIDENCE', 'evidence', 'ev_observation_tombstoned', {
  lineage: [lineageEvent('ev_observation_tombstoned', 'tombstone_cascade', 'deletion-request-88', OCCURRED_AT)],
})

// --- The resolve registry the drawer calls ----------------------------------------------------

const MALFORMED_CLAIM_REFERENCE_ID = 'this is prose, not a claim id'

const CLAIM_FIXTURES = new Map<string, EvidenceResolution>([
  ['cl_demo_hypothesis', HYPOTHESIS_TREE],
  ['cl_deterministic_flow', DETERMINISTIC_TREE],
  ['cl_tombstoned_subject', TOMBSTONED_TREE],
  ['cl_cycle_subject', CYCLE_TREE],
  ['cl_depth_subject', DEPTH_LIMITED_TREE],
  ['cl_deep_ancestry', DEEP_ANCESTRY_TREE],
  ['cl_unknown_revoked', UNKNOWN_CLAIM_RESULT],
  ['cl_storage_probe', STORAGE_UNAVAILABLE_RESULT],
  ['cl_invalid_request_probe', INVALID_REQUEST_RESULT],
  [MALFORMED_CLAIM_REFERENCE_ID, MALFORMED_CLAIM_ID_RESULT],
])

const OBSERVATION_FIXTURES = new Map<string, EvidenceResolution>([
  ['ev_observation_anchor', OBSERVATION_ANCHOR],
  ['ev_observation_tombstoned', OBSERVATION_TOMBSTONED],
])

/**
 * The pure resolve callback the drawer receives in place of the future V2 endpoint. An unknown
 * claim id resolves to an honest `UNKNOWN_CLAIM` (echoing the well-formed id); an unknown
 * observation id resolves to `MISSING_EVIDENCE`. Nothing here fetches or touches storage.
 */
export function resolveFixture(reference: AnalyticReference): EvidenceResolution {
  if (reference.kind === 'observation') {
    return (
      OBSERVATION_FIXTURES.get(reference.evidenceId) ??
      missing('MISSING_EVIDENCE', 'evidence', reference.evidenceId)
    )
  }
  return (
    CLAIM_FIXTURES.get(reference.claimId) ??
    unresolvable('UNKNOWN_CLAIM', reference.claimId)
  )
}

// --- Reference constants + catalogues for tests ----------------------------------------------

export const HYPOTHESIS_REFERENCE: ClaimReference = { kind: 'claim', claimId: 'cl_demo_hypothesis' }
export const DETERMINISTIC_REFERENCE: ClaimReference = { kind: 'claim', claimId: 'cl_deterministic_flow' }
export const TOMBSTONED_REFERENCE: ClaimReference = { kind: 'claim', claimId: 'cl_tombstoned_subject' }
export const CYCLE_REFERENCE: ClaimReference = { kind: 'claim', claimId: 'cl_cycle_subject' }
export const DEPTH_LIMITED_REFERENCE: ClaimReference = { kind: 'claim', claimId: 'cl_depth_subject' }
export const DEEP_ANCESTRY_REFERENCE: ClaimReference = { kind: 'claim', claimId: 'cl_deep_ancestry' }

export const UNKNOWN_CLAIM_REFERENCE: ClaimReference = { kind: 'claim', claimId: 'cl_unknown_revoked' }
export const STORAGE_UNAVAILABLE_REFERENCE: ClaimReference = { kind: 'claim', claimId: 'cl_storage_probe' }
export const INVALID_REQUEST_REFERENCE: ClaimReference = { kind: 'claim', claimId: 'cl_invalid_request_probe' }
export const MALFORMED_REFERENCE: ClaimReference = { kind: 'claim', claimId: MALFORMED_CLAIM_REFERENCE_ID }

export const OBSERVATION_ANCHOR_REFERENCE: ObservationReference = { kind: 'observation', evidenceId: 'ev_observation_anchor' }
export const OBSERVATION_TOMBSTONED_REFERENCE: ObservationReference = { kind: 'observation', evidenceId: 'ev_observation_tombstoned' }

export const CLAIM_TREE_FIXTURES: readonly { readonly name: string; readonly reference: ClaimReference }[] = [
  { name: 'hypothesis (demo)', reference: HYPOTHESIS_REFERENCE },
  { name: 'deterministic', reference: DETERMINISTIC_REFERENCE },
  { name: 'tombstoned', reference: TOMBSTONED_REFERENCE },
  { name: 'cycle', reference: CYCLE_REFERENCE },
  { name: 'depth-limited', reference: DEPTH_LIMITED_REFERENCE },
  { name: 'deep-ancestry', reference: DEEP_ANCESTRY_REFERENCE },
]

export const UNRESOLVABLE_FIXTURES: readonly {
  readonly name: string
  readonly reference: ClaimReference
  readonly reason: WhyUnresolvableReason
}[] = [
  { name: 'unknown claim', reference: UNKNOWN_CLAIM_REFERENCE, reason: 'UNKNOWN_CLAIM' },
  { name: 'storage unavailable', reference: STORAGE_UNAVAILABLE_REFERENCE, reason: 'STORAGE_UNAVAILABLE' },
  { name: 'invalid request', reference: INVALID_REQUEST_REFERENCE, reason: 'INVALID_REQUEST' },
  { name: 'malformed claim id', reference: MALFORMED_REFERENCE, reason: 'MALFORMED_CLAIM_ID' },
]

/** The claim id passed for the malformed case — asserted absent from the DOM. */
export const MALFORMED_INPUT_STRING = MALFORMED_CLAIM_REFERENCE_ID
