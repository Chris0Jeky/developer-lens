import { z } from 'zod'
import { CAPABILITY_REGISTRY } from './capabilities.js'
import {
  CLAIM_EDGE_ROLES,
  CLAIM_EDGE_ROLE_TARGET_KIND,
  ClaimEdgeRoleSchema,
  ClaimEdgeTargetKindSchema,
} from './claims.js'
import { CoverageRecordSchema, CoverageStatusSchema } from './coverage.js'
import type { AnalyticReference } from './findings.js'
import type {
  WhyCapabilityNode,
  WhyClaimNode,
  WhyClaimReferenceNode,
  WhyCollectionJobNode,
  WhyCoverageKey,
  WhyCoverageNode,
  WhyEdge,
  WhyEdgeGroup,
  WhyElementRef,
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
 * The evidence-walk projection as a RUNTIME contract (PR #131 late review).
 *
 * `server/storage/whyResolver.ts` defines the projection as TypeScript interfaces, which
 * protect the server and the drawer at compile time but protect nobody at the network
 * boundary: the Atlas fetches `/api/v2/evidence/resolve` from a local port that any
 * process can squat, so the browser client must prove a 200 body is really this shape
 * before the drawer dereferences it. These schemas are that proof, shared by the
 * endpoint (asserted before a byte is sent) and the browser client (parsed before a
 * projection is cached), so the two cannot drift apart.
 *
 * Every field of every resolver interface is declared here and each schema is
 * `satisfies`-checked against its interface, so a resolver-contract change that adds a
 * required field breaks this module's build rather than silently stripping the field
 * from parsed responses. The reason/termination vocabularies live here as the single
 * source; `whyResolver.ts` re-exports them.
 */

export const WHY_RESOLVER_VERSION = '1.0.0' as const

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

const WHY_MISSING_LINK_TARGET_KIND = {
  CYCLE_DETECTED: 'claim',
  DEPTH_LIMIT_REACHED: 'claim',
  MALFORMED_EDGE: 'edge',
  MISSING_CAPABILITY_BINDING: 'collection_job',
  MISSING_CLAIM: 'claim',
  MISSING_COVERAGE: 'coverage',
  MISSING_EVIDENCE: 'evidence',
  MISSING_SCOPE: 'scope',
  SCOPE_ALIAS_CLEARED: 'scope',
  TOMBSTONED_CLAIM: 'claim',
  TOMBSTONED_EVIDENCE: 'evidence',
  UNREGISTERED_CAPABILITY: 'capability',
} as const satisfies Record<WhyMissingLinkReason, WhyTargetKind>

export const WhyCoverageKeySchema = z.strictObject({
  rangeStart: z.string().nullable(),
  jobId: z.string(),
}) satisfies z.ZodType<WhyCoverageKey>

// Client-safe mirror of the native SQLite calendar-valid ISO-week rule. A week stays a
// week: the resolver never reconstructs an exact instant from retained lineage.
const WhyIsoWeekSchema = z.string().regex(/^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/).refine((value) => {
  const match = /^(\d{4})-W(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const januaryFirst = new Date(0)
  januaryFirst.setUTCHours(0, 0, 0, 0)
  januaryFirst.setUTCFullYear(year, 0, 1)
  const firstDay = januaryFirst.getUTCDay()
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return Number(match[2]) <= (firstDay === 4 || (firstDay === 3 && leap) ? 53 : 52)
}, 'Week must exist in the ISO week-year')

export const WhyLineageEventSchema = z.strictObject({
  kind: z.literal('lineage_event'),
  subjectId: z.string(),
  eventKind: z.string(),
  causedBy: z.string().nullable(),
  occurredAt: z.string().nullable(),
  eventWeek: WhyIsoWeekSchema.optional(),
}).superRefine((event, context) => {
  if ((event.occurredAt === null) !== (event.eventWeek !== undefined)) {
    context.addIssue({ code: 'custom', message: 'Lineage must carry either its exact legacy timestamp or its retained native week' })
  }
}) satisfies z.ZodType<WhyLineageEvent>

export const WhyMissingLinkSchema = z.strictObject({
  kind: z.literal('missing_link'),
  reason: z.enum(WHY_MISSING_LINK_REASONS),
  targetKind: z.enum(WHY_TARGET_KINDS),
  targetId: z.string().nullable(),
  coverageKey: WhyCoverageKeySchema.nullable(),
  lineage: z.array(WhyLineageEventSchema),
}).superRefine((link, context) => {
  if (WHY_MISSING_LINK_TARGET_KIND[link.reason] !== link.targetKind) {
    context.addIssue({
      code: 'custom',
      path: ['targetKind'],
      message: 'missing-link target kind disagrees with its reason',
    })
  }
}) satisfies z.ZodType<WhyMissingLink>

/**
 * A capability node must BE a registry entry, not merely look like one: the drawer
 * renders these fields verbatim under "Capability & consent terms", so a malformed
 * response must not be able to claim weaker gates or an active refusal state than
 * `CAPABILITY_REGISTRY` declares (PR #132 review).
 */
export const WhyCapabilityNodeSchema = z.strictObject({
  kind: z.literal('capability'),
  capabilityId: z.string(),
  purposeCode: z.string(),
  classCeiling: z.string(),
  requiredGates: z.array(z.string()),
  refusalStatus: z.string(),
}).superRefine((node, ctx) => {
  const definition = CAPABILITY_REGISTRY.find((candidate) => candidate.id === node.capabilityId)
  if (
    !definition
    || definition.purposeCode !== node.purposeCode
    || definition.classCeiling !== node.classCeiling
    || definition.refusalStatus !== node.refusalStatus
    || definition.requiredGates.length !== node.requiredGates.length
    || definition.requiredGates.some((gate, index) => node.requiredGates[index] !== gate)
  ) {
    ctx.addIssue({ code: 'custom', message: 'capability node does not match the closed registry' })
  }
}) satisfies z.ZodType<WhyCapabilityNode>

export const WhyCollectionJobNodeSchema = z.strictObject({
  kind: z.literal('collection_job'),
  jobId: z.string(),
  status: z.string(),
  consentRevision: z.string(),
  capability: z.union([WhyCapabilityNodeSchema, WhyMissingLinkSchema]),
}) satisfies z.ZodType<WhyCollectionJobNode>

export const WhyCoverageNodeSchema = z.strictObject({
  kind: z.literal('coverage'),
  coverageKey: WhyCoverageKeySchema,
  rangeEnd: z.string().nullable(),
  status: z.string(),
  limitationCode: z.string(),
  retryable: z.boolean(),
  expectedUnits: z.number().int().nonnegative().nullable(),
  observedUnits: z.number().int().nonnegative(),
  omittedUnits: z.number().int().nonnegative().nullable(),
  saturationReason: z.string().nullable(),
  observedAt: z.string().nullable(),
  job: z.discriminatedUnion('kind', [WhyCollectionJobNodeSchema, WhyMissingLinkSchema]),
}).superRefine((node, context) => {
  const capabilityId = node.job.kind === 'collection_job' && node.job.capability.kind === 'capability'
    ? node.job.capability.capabilityId
    : CAPABILITY_REGISTRY[0].id
  const dates = [node.coverageKey.rangeStart, node.rangeEnd, node.observedAt]
  if (dates.every((date) => date === null)) {
    // C2 erasure removes only temporal provenance. Retained C1 values still obey
    // every status, limitation and accounting rule of CoverageRecordSchema.
    const reject = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })
    if (!CoverageStatusSchema.safeParse(node.status).success) reject('status', 'Unknown coverage status')
    if (!/^[A-Z0-9_]+$/.test(node.limitationCode)) reject('limitationCode', 'Invalid limitation code')
    if (node.saturationReason !== null && !/^[A-Z0-9_]+$/.test(node.saturationReason)) reject('saturationReason', 'Invalid saturation reason')
    if (node.status === 'complete' && node.expectedUnits === null) reject('expectedUnits', 'Complete coverage requires expectedUnits')
    if (node.status === 'complete' && node.expectedUnits !== null && node.observedUnits !== node.expectedUnits) reject('observedUnits', 'Complete coverage requires all expected units')
    if (node.status === 'complete' && node.omittedUnits !== 0) reject('omittedUnits', 'Complete coverage requires zero omitted units')
    if (node.expectedUnits !== null && node.observedUnits > node.expectedUnits) reject('observedUnits', 'Observed units exceed expected units')
    if (node.expectedUnits !== null && node.omittedUnits !== null && node.observedUnits + node.omittedUnits !== node.expectedUnits) reject('omittedUnits', 'Counts do not account for expected units')
    if (node.status === 'truncated' && !node.saturationReason) reject('saturationReason', 'Truncated coverage requires a saturation reason')
    if (node.status !== 'truncated' && node.saturationReason) reject('saturationReason', 'Only truncated coverage may have a saturation reason')
  } else if (dates.some((date) => date === null)) {
    context.addIssue({ code: 'custom', message: 'Coverage temporal provenance must be wholly present or wholly expired' })
  } else {
    const coverage = CoverageRecordSchema.safeParse({
      coverageId: 'why-contract-projection',
      capabilityId,
      scopeAlias: 'why-contract-projection',
      rangeStart: node.coverageKey.rangeStart,
      rangeEnd: node.rangeEnd,
      status: node.status,
      expectedUnits: node.expectedUnits,
      observedUnits: node.observedUnits,
      omittedUnits: node.omittedUnits,
      ...(node.saturationReason === null ? {} : { saturationReason: node.saturationReason }),
      retryable: node.retryable,
      observedAt: node.observedAt,
      limitationCode: node.limitationCode,
    })
    if (!coverage.success) {
      for (const issue of coverage.error.issues) {
        context.addIssue({
          code: 'custom',
          path: issue.path,
          message: `coverage record invariant: ${issue.message}`,
        })
      }
    }
  }

  const projectedJobId = node.job.kind === 'collection_job'
    ? node.job.jobId
    : node.job.targetKind === 'collection_job'
      ? node.job.targetId
      : null
  if (projectedJobId !== node.coverageKey.jobId) {
    context.addIssue({
      code: 'custom',
      path: ['job'],
      message: 'coverage job does not name the coverage key job id',
    })
  }
}) satisfies z.ZodType<WhyCoverageNode>

export const WhyEvidenceNodeSchema = z.strictObject({
  kind: z.literal('evidence'),
  evidenceId: z.string(),
  layer: z.string(),
  schemaVersion: z.string(),
  coverage: z.discriminatedUnion('kind', [WhyCoverageNodeSchema, WhyMissingLinkSchema]),
  lineage: z.array(WhyLineageEventSchema),
}) satisfies z.ZodType<WhyEvidenceNode>

const whyClaimSummaryFields = {
  claimId: z.string(),
  layer: z.string(),
  statementCode: z.string(),
  methodId: z.string(),
  methodVersion: z.string(),
  windowStart: z.string(),
  windowEnd: z.string(),
  scopeId: z.string(),
  schemaVersion: z.string(),
  createdAt: z.string().nullable(),
  supersededBy: z.string().nullable(),
}

export const WhyClaimNodeSchema = z.strictObject({
  kind: z.literal('claim'),
  ...whyClaimSummaryFields,
}) satisfies z.ZodType<WhyClaimNode>

export const WhyClaimReferenceNodeSchema = z.strictObject({
  kind: z.literal('claim_reference'),
  expandsWith: z.literal('resolveWhy'),
  ...whyClaimSummaryFields,
}) satisfies z.ZodType<WhyClaimReferenceNode>

/**
 * The resolver invariant `hasAlias === (aliasLink === null)` is part of the contract:
 * a response reporting the alias both linked and cleared would render contradictory
 * retention state in the drawer. When the alias is gone, the link must be the exact
 * furniture the resolver emits: a `SCOPE_ALIAS_CLEARED` missing-link naming the scope.
 */
export const WhyScopeNodeSchema = z.strictObject({
  kind: z.literal('scope'),
  scopeId: z.string(),
  hasAlias: z.boolean(),
  linkedAt: z.string().nullable(),
  aliasLink: WhyMissingLinkSchema.nullable(),
}).superRefine((node, ctx) => {
  if (node.hasAlias !== (node.aliasLink === null)) {
    ctx.addIssue({ code: 'custom', message: 'scope alias state contradicts its alias link' })
    return
  }
  if (
    node.aliasLink !== null
    && (node.aliasLink.reason !== 'SCOPE_ALIAS_CLEARED' || node.aliasLink.targetKind !== 'scope')
  ) {
    ctx.addIssue({ code: 'custom', message: 'cleared alias link must be SCOPE_ALIAS_CLEARED furniture' })
  }
}) satisfies z.ZodType<WhyScopeNode>

export const WhyEdgeSchema = z.strictObject({
  kind: z.literal('edge'),
  role: ClaimEdgeRoleSchema,
  targetRef: z.string(),
  target: z.discriminatedUnion('kind', [
    WhyEvidenceNodeSchema,
    WhyClaimReferenceNodeSchema,
    WhyCoverageNodeSchema,
    WhyMissingLinkSchema,
  ]),
}) satisfies z.ZodType<WhyEdge>

/**
 * The drawer labels each section from the GROUP role and renders every nested edge
 * beneath it, so a group must be internally coherent: its target kind is the closed
 * role mapping's, and every member edge carries the group's role with a target of the
 * declared kind (or missing-link furniture). Contradicting evidence must not be
 * renderable under a "supports" heading (PR #132 review).
 */
export const WhyEdgeGroupSchema = z.strictObject({
  kind: z.literal('edge_group'),
  role: ClaimEdgeRoleSchema,
  targetKind: ClaimEdgeTargetKindSchema,
  edges: z.array(WhyEdgeSchema),
}).superRefine((group, ctx) => {
  if (CLAIM_EDGE_ROLE_TARGET_KIND[group.role] !== group.targetKind) {
    ctx.addIssue({ code: 'custom', message: 'edge group target kind disagrees with its role' })
  }
  for (const edge of group.edges) {
    if (edge.role !== group.role) {
      ctx.addIssue({ code: 'custom', message: 'edge role disagrees with its group' })
      return
    }
    const target = edge.target
    const coherent = target.kind === 'missing_link'
      || (group.targetKind === 'evidence' && target.kind === 'evidence')
      || (group.targetKind === 'claim' && target.kind === 'claim_reference')
      || (group.targetKind === 'coverage' && target.kind === 'coverage')
    if (!coherent) {
      ctx.addIssue({ code: 'custom', message: 'edge target kind disagrees with its group' })
      return
    }
  }
}) satisfies z.ZodType<WhyEdgeGroup>

const WhyEdgeGroupsSchema = z.array(WhyEdgeGroupSchema).superRefine((groups, context) => {
  for (const role of CLAIM_EDGE_ROLES) {
    const occurrences = groups.filter((group) => group.role === role).length
    if (occurrences !== 1) {
      context.addIssue({
        code: 'custom',
        message: `edge role ${role} must occur exactly once`,
      })
    }
  }
})

export const WhyLimitationSchema = z.strictObject({
  kind: z.literal('limitation'),
  limitationCode: z.string(),
  dimension: z.string(),
  copyKey: z.string(),
}) satisfies z.ZodType<WhyLimitation>

export const WhyWalkStepSchema = z.strictObject({
  kind: z.literal('walk_step'),
  depth: z.number(),
  ...whyClaimSummaryFields,
}) satisfies z.ZodType<WhyWalkStep>

export const WhyWalkSchema = z.strictObject({
  kind: z.literal('walk'),
  relation: z.enum(['supersession', 'derives_from_ancestry']),
  bound: z.number(),
  steps: z.array(WhyWalkStepSchema),
  termination: z.enum(WHY_WALK_TERMINATIONS),
  missingLinks: z.array(WhyMissingLinkSchema),
}) satisfies z.ZodType<WhyWalk>

export const WhyElementRefSchema = z.strictObject({
  kind: z.literal('ui_element'),
  elementId: z.string(),
}) satisfies z.ZodType<WhyElementRef>

export const WhyExplanationTreeSchema = z.strictObject({
  kind: z.literal('explanation'),
  resolverVersion: z.literal(WHY_RESOLVER_VERSION),
  bound: z.number(),
  element: WhyElementRefSchema.nullable(),
  claim: WhyClaimNodeSchema,
  scope: z.union([WhyScopeNodeSchema, WhyMissingLinkSchema]),
  edges: WhyEdgeGroupsSchema,
  limitations: z.array(WhyLimitationSchema),
  lineage: z.array(WhyLineageEventSchema),
  supersession: WhyWalkSchema,
  ancestry: WhyWalkSchema,
  unresolvedEdges: z.array(WhyMissingLinkSchema),
}).superRefine((tree, context) => {
  const projectedScopeId = tree.scope.kind === 'scope'
    ? tree.scope.scopeId
    : tree.scope.targetKind === 'scope' && tree.scope.reason === 'MISSING_SCOPE'
      ? tree.scope.targetId
      : null
  if (projectedScopeId !== tree.claim.scopeId) {
    context.addIssue({
      code: 'custom',
      path: ['scope'],
      message: 'explanation scope does not name the root claim scope',
    })
  }
  if (tree.supersession.relation !== 'supersession') {
    context.addIssue({
      code: 'custom',
      path: ['supersession', 'relation'],
      message: 'supersession slot must carry the supersession walk',
    })
  }
  if (tree.ancestry.relation !== 'derives_from_ancestry') {
    context.addIssue({
      code: 'custom',
      path: ['ancestry', 'relation'],
      message: 'ancestry slot must carry the derives-from ancestry walk',
    })
  }
  for (const [index, event] of tree.lineage.entries()) {
    if (event.subjectId !== tree.claim.claimId) {
      context.addIssue({
        code: 'custom',
        path: ['lineage', index, 'subjectId'],
        message: 'root lineage event does not name the root claim',
      })
    }
  }
}) satisfies z.ZodType<WhyExplanationTree>

export const WhyUnresolvableSchema = z.strictObject({
  kind: z.literal('unresolvable'),
  resolverVersion: z.literal(WHY_RESOLVER_VERSION),
  reason: z.enum(WHY_UNRESOLVABLE_REASONS),
  claimId: z.string().nullable(),
  lineage: z.array(WhyLineageEventSchema),
}).superRefine((projection, context) => {
  const requiresNullClaimId = projection.reason === 'INVALID_REQUEST'
    || projection.reason === 'MALFORMED_CLAIM_ID'
  if (requiresNullClaimId !== (projection.claimId === null)) {
    context.addIssue({
      code: 'custom',
      path: ['claimId'],
      message: 'unresolvable claim id disagrees with its reason',
    })
  }
  for (const [index, event] of projection.lineage.entries()) {
    if (projection.claimId === null || event.subjectId !== projection.claimId) {
      context.addIssue({
        code: 'custom',
        path: ['lineage', index, 'subjectId'],
        message: 'unresolvable lineage event does not name its claim',
      })
    }
  }
}) satisfies z.ZodType<WhyUnresolvable>

/** The union the drawer renders — exactly `IntegrationShapeEvidenceResolution`. */
export const WhyResolutionSchema = z.discriminatedUnion('kind', [
  WhyExplanationTreeSchema,
  WhyUnresolvableSchema,
  WhyEvidenceNodeSchema,
  WhyMissingLinkSchema,
]) satisfies z.ZodType<WhyExplanationTree | WhyUnresolvable | WhyEvidenceNode | WhyMissingLink>

/**
 * True only when the projection actually ANSWERS the reference: schema validity and an
 * echoed reference are not enough, because a stale or squatting service can echo the
 * requested reference while attaching another claim's contract-valid walk. A claim
 * reference is answered by an explanation whose claim carries the same id and layer, or
 * by an unresolvable echoing the same id; an observation reference by its own evidence
 * anchor or a missing-link naming exactly that evidence id. Everything else is a
 * mismatch, whatever it parses as. Typed against the readonly resolver interfaces so
 * both parsed values and fixture compositions can be checked.
 */
export function whyResolutionAnswersReference(
  reference: AnalyticReference,
  projection: WhyExplanationTree | WhyUnresolvable | WhyEvidenceNode | WhyMissingLink,
): boolean {
  if (reference.kind === 'observation') {
    if (projection.kind === 'evidence') return projection.evidenceId === reference.evidenceId
    if (projection.kind === 'missing_link') {
      return projection.targetKind === 'evidence' && projection.targetId === reference.evidenceId
    }
    return false
  }
  if (projection.kind === 'explanation') {
    return (
      projection.claim.claimId === reference.claimId
      && projection.claim.layer === reference.claimLayer
    )
  }
  if (projection.kind === 'unresolvable') return projection.claimId === reference.claimId
  return false
}
