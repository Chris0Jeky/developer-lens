import { z } from 'zod'
import { ClaimEdgeRoleSchema, ClaimEdgeTargetKindSchema } from './claims.js'
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

export const WhyCoverageKeySchema = z.object({
  rangeStart: z.string(),
  jobId: z.string(),
}) satisfies z.ZodType<WhyCoverageKey>

export const WhyLineageEventSchema = z.object({
  kind: z.literal('lineage_event'),
  subjectId: z.string(),
  eventKind: z.string(),
  causedBy: z.string().nullable(),
  occurredAt: z.string(),
}) satisfies z.ZodType<WhyLineageEvent>

export const WhyMissingLinkSchema = z.object({
  kind: z.literal('missing_link'),
  reason: z.enum(WHY_MISSING_LINK_REASONS),
  targetKind: z.enum(WHY_TARGET_KINDS),
  targetId: z.string().nullable(),
  coverageKey: WhyCoverageKeySchema.nullable(),
  lineage: z.array(WhyLineageEventSchema),
}) satisfies z.ZodType<WhyMissingLink>

export const WhyCapabilityNodeSchema = z.object({
  kind: z.literal('capability'),
  capabilityId: z.string(),
  purposeCode: z.string(),
  classCeiling: z.string(),
  requiredGates: z.array(z.string()),
  refusalStatus: z.string(),
}) satisfies z.ZodType<WhyCapabilityNode>

export const WhyCollectionJobNodeSchema = z.object({
  kind: z.literal('collection_job'),
  jobId: z.string(),
  status: z.string(),
  consentRevision: z.string(),
  capability: z.discriminatedUnion('kind', [WhyCapabilityNodeSchema, WhyMissingLinkSchema]),
}) satisfies z.ZodType<WhyCollectionJobNode>

export const WhyCoverageNodeSchema = z.object({
  kind: z.literal('coverage'),
  coverageKey: WhyCoverageKeySchema,
  rangeEnd: z.string(),
  status: z.string(),
  limitationCode: z.string(),
  retryable: z.boolean(),
  expectedUnits: z.number().nullable(),
  observedUnits: z.number(),
  omittedUnits: z.number().nullable(),
  saturationReason: z.string().nullable(),
  observedAt: z.string(),
  job: z.discriminatedUnion('kind', [WhyCollectionJobNodeSchema, WhyMissingLinkSchema]),
}) satisfies z.ZodType<WhyCoverageNode>

export const WhyEvidenceNodeSchema = z.object({
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
  createdAt: z.string(),
  supersededBy: z.string().nullable(),
}

export const WhyClaimNodeSchema = z.object({
  kind: z.literal('claim'),
  ...whyClaimSummaryFields,
}) satisfies z.ZodType<WhyClaimNode>

export const WhyClaimReferenceNodeSchema = z.object({
  kind: z.literal('claim_reference'),
  expandsWith: z.literal('resolveWhy'),
  ...whyClaimSummaryFields,
}) satisfies z.ZodType<WhyClaimReferenceNode>

export const WhyScopeNodeSchema = z.object({
  kind: z.literal('scope'),
  scopeId: z.string(),
  hasAlias: z.boolean(),
  linkedAt: z.string(),
  aliasLink: WhyMissingLinkSchema.nullable(),
}) satisfies z.ZodType<WhyScopeNode>

export const WhyEdgeSchema = z.object({
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

export const WhyEdgeGroupSchema = z.object({
  kind: z.literal('edge_group'),
  role: ClaimEdgeRoleSchema,
  targetKind: ClaimEdgeTargetKindSchema,
  edges: z.array(WhyEdgeSchema),
}) satisfies z.ZodType<WhyEdgeGroup>

export const WhyLimitationSchema = z.object({
  kind: z.literal('limitation'),
  limitationCode: z.string(),
  dimension: z.string(),
  copyKey: z.string(),
}) satisfies z.ZodType<WhyLimitation>

export const WhyWalkStepSchema = z.object({
  kind: z.literal('walk_step'),
  depth: z.number(),
  ...whyClaimSummaryFields,
}) satisfies z.ZodType<WhyWalkStep>

export const WhyWalkSchema = z.object({
  kind: z.literal('walk'),
  relation: z.enum(['supersession', 'derives_from_ancestry']),
  bound: z.number(),
  steps: z.array(WhyWalkStepSchema),
  termination: z.enum(WHY_WALK_TERMINATIONS),
  missingLinks: z.array(WhyMissingLinkSchema),
}) satisfies z.ZodType<WhyWalk>

export const WhyElementRefSchema = z.object({
  kind: z.literal('ui_element'),
  elementId: z.string(),
}) satisfies z.ZodType<WhyElementRef>

export const WhyExplanationTreeSchema = z.object({
  kind: z.literal('explanation'),
  resolverVersion: z.literal(WHY_RESOLVER_VERSION),
  bound: z.number(),
  element: WhyElementRefSchema.nullable(),
  claim: WhyClaimNodeSchema,
  scope: z.discriminatedUnion('kind', [WhyScopeNodeSchema, WhyMissingLinkSchema]),
  edges: z.array(WhyEdgeGroupSchema),
  limitations: z.array(WhyLimitationSchema),
  lineage: z.array(WhyLineageEventSchema),
  supersession: WhyWalkSchema,
  ancestry: WhyWalkSchema,
  unresolvedEdges: z.array(WhyMissingLinkSchema),
}) satisfies z.ZodType<WhyExplanationTree>

export const WhyUnresolvableSchema = z.object({
  kind: z.literal('unresolvable'),
  resolverVersion: z.literal(WHY_RESOLVER_VERSION),
  reason: z.enum(WHY_UNRESOLVABLE_REASONS),
  claimId: z.string().nullable(),
  lineage: z.array(WhyLineageEventSchema),
}) satisfies z.ZodType<WhyUnresolvable>

/** The union the drawer renders — exactly `IntegrationShapeEvidenceResolution`. */
export const WhyResolutionSchema = z.discriminatedUnion('kind', [
  WhyExplanationTreeSchema,
  WhyUnresolvableSchema,
  WhyEvidenceNodeSchema,
  WhyMissingLinkSchema,
]) satisfies z.ZodType<WhyExplanationTree | WhyUnresolvable | WhyEvidenceNode | WhyMissingLink>
