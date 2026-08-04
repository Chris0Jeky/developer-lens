import { createHash } from 'node:crypto'
import { z } from 'zod'
import { EVIDENCE_LAYERS } from './provenance.js'

export const CLAIM_CONTRACT_VERSION = '1.0.0' as const

/** Schema version carried by every `claim` row; part of the stability key and the claim ID. */
export const CLAIM_SCHEMA_VERSION = '1.0.0' as const

/** ADR-01: claims live at one of four layers above `observed`. */
export const CLAIM_LAYERS = ['deterministic', 'modelled', 'hypothesis', 'abstention'] as const
export const ClaimLayerSchema = z.enum(CLAIM_LAYERS)
export type ClaimLayer = z.infer<typeof ClaimLayerSchema>

/**
 * Closed statement-code registry. Seeded from the model-facing C1 vocabulary
 * (`server/externalModel/c1Contract.ts`) so the two never diverge; a code that is
 * not listed here fails closed in both the contract and the SQLite CHECK.
 */
export const CLAIM_STATEMENT_CODES = [
  'ABSTAIN_LOW_COVERAGE',
  'CI_RERUN_PATTERN',
  'COVERAGE_GAP',
  'DELIVERY_FLOW',
  'OWNERSHIP_COVERAGE',
] as const
export const ClaimStatementCodeSchema = z.enum(CLAIM_STATEMENT_CODES)
export type ClaimStatementCode = z.infer<typeof ClaimStatementCodeSchema>

/** The abstention layer and this code imply each other, at contract and table level. */
export const CLAIM_ABSTENTION_STATEMENT_CODE = 'ABSTAIN_LOW_COVERAGE' as const

export const CLAIM_EDGE_ROLES = [
  'supports',
  'contradicts',
  'contextualizes',
  'derives_from',
  'coverage_basis',
  'limitation_basis',
] as const
export const ClaimEdgeRoleSchema = z.enum(CLAIM_EDGE_ROLES)
export type ClaimEdgeRole = z.infer<typeof ClaimEdgeRoleSchema>

export const CLAIM_EDGE_TARGET_KINDS = ['evidence', 'claim', 'coverage'] as const
export const ClaimEdgeTargetKindSchema = z.enum(CLAIM_EDGE_TARGET_KINDS)
export type ClaimEdgeTargetKind = z.infer<typeof ClaimEdgeTargetKindSchema>

/**
 * Role -> target kind. An FK-valid edge with a semantically wrong target kind must
 * not exist, so this map is mirrored by a CHECK on `claim_evidence_edge`.
 */
export const CLAIM_EDGE_ROLE_TARGET_KIND: Readonly<Record<ClaimEdgeRole, ClaimEdgeTargetKind>> = {
  supports: 'evidence',
  contradicts: 'evidence',
  contextualizes: 'evidence',
  limitation_basis: 'evidence',
  derives_from: 'claim',
  coverage_basis: 'coverage',
}

/** The subset of roles whose target is an evidence anchor. Kept in step with the map above. */
export const CLAIM_EVIDENCE_EDGE_ROLES = [
  'supports',
  'contradicts',
  'contextualizes',
  'limitation_basis',
] as const

/** The existing limitation dictionary (C1 contract), kept closed. */
export const CLAIM_LIMITATION_CODES = [
  'COVERAGE_INCOMPLETE',
  'COVERAGE_RESTRICTED',
  'COVERAGE_SPARSE',
  'COVERAGE_UNITS_DIFFER',
  'DECLARED_OWNERSHIP_NOT_STEWARDSHIP',
  'LINKAGE_NOT_CAUSAL',
  'OBSERVABILITY_CHANGED',
  'RERUN_NOT_FLAKE',
  'SAMPLE_TOO_SMALL',
] as const
export const ClaimLimitationCodeSchema = z.enum(CLAIM_LIMITATION_CODES)
export type ClaimLimitationCode = z.infer<typeof ClaimLimitationCodeSchema>

/**
 * ADR-02 coverage-vector dimension names. DL-SPINE-04 owns the authoritative registry
 * (values, direction, per-tier gates); this card needs only the closed name set so a
 * `limitation_instance` can record which dimension triggered it.
 */
export const CLAIM_LIMITATION_DIMENSIONS = [
  'permission',
  'completeness',
  'eligibility',
  'freshness',
  'censoring_freedom',
  'consistency',
  'sample',
  'source_diversity',
  'parser_coverage',
  'comparability',
  'drift_stability',
  'calibration',
] as const
export const ClaimLimitationDimensionSchema = z.enum(CLAIM_LIMITATION_DIMENSIONS)
export type ClaimLimitationDimension = z.infer<typeof ClaimLimitationDimensionSchema>

export const LINEAGE_EVENT_KINDS = [
  'correction',
  'tombstone_cascade',
  'export_included',
  'reconsent',
  'index_built',
  'index_deleted',
] as const
export const LineageEventKindSchema = z.enum(LINEAGE_EVENT_KINDS)
export type LineageEventKind = z.infer<typeof LineageEventKindSchema>

/**
 * Every identifier-shaped claim field is an opaque token: no whitespace, no path
 * separators, no punctuation beyond `._:-`. Prose, filesystem paths, and human names
 * are therefore rejected structurally rather than by a denylist.
 */
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const LONG_OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/
const CLAIM_ID_PATTERN = /^cl_[0-9a-f]{64}$/
const SEMANTIC_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/

/** The canonical UTC form the storage layer accepts: `new Date(value).toISOString()`. */
const CANONICAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export const OpaqueTokenSchema = z.string().regex(OPAQUE_TOKEN_PATTERN)
export const LongOpaqueTokenSchema = z.string().regex(LONG_OPAQUE_TOKEN_PATTERN)
export const ClaimIdSchema = z.string().regex(CLAIM_ID_PATTERN)
export const MethodVersionSchema = z.string().regex(SEMANTIC_VERSION_PATTERN)
export const CanonicalTimestampSchema = z.string().regex(CANONICAL_TIMESTAMP_PATTERN).refine(
  (value) => {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
  },
  'Timestamp must use canonical UTC form',
)

/**
 * C2 partition. The installation-scoped alias VALUE lives here, never in the C1 claim
 * row. `linkedAt` records when the alias link was first established, which is the input
 * a sweeper needs to compute the charter's 13-month alias-link boundary; re-registering
 * a scope keeps the original link time (first link wins).
 *
 * No sweeper exists yet — the retention mechanism itself is future work, tracked as
 * issue #80. What is proven today is only that clearing the alias leaves every C1 claim
 * row and its `scope_id` series grouping intact.
 */
export const ClaimScopeSchema = z
  .object({
    scopeId: OpaqueTokenSchema,
    scopeAlias: OpaqueTokenSchema.nullable(),
    linkedAt: CanonicalTimestampSchema,
  })
  .strict()
export type ClaimScope = z.infer<typeof ClaimScopeSchema>

/** C1 claim content. Note the absence of any alias value: only the content-free surrogate. */
export const ClaimRecordSchema = z
  .object({
    claimId: ClaimIdSchema,
    layer: ClaimLayerSchema,
    statementCode: ClaimStatementCodeSchema,
    methodId: OpaqueTokenSchema,
    methodVersion: MethodVersionSchema,
    windowStart: CanonicalTimestampSchema,
    windowEnd: CanonicalTimestampSchema,
    scopeId: OpaqueTokenSchema,
    schemaVersion: z.literal(CLAIM_SCHEMA_VERSION),
    createdAt: CanonicalTimestampSchema,
    supersededBy: ClaimIdSchema.nullable(),
  })
  .strict()
  .superRefine((claim, context) => {
    if (Date.parse(claim.windowStart) >= Date.parse(claim.windowEnd)) {
      context.addIssue({ code: 'custom', path: ['windowEnd'], message: 'claim_window_not_half_open' })
    }
    const abstains = claim.layer === 'abstention'
    if (abstains !== (claim.statementCode === CLAIM_ABSTENTION_STATEMENT_CODE)) {
      context.addIssue({ code: 'custom', path: ['statementCode'], message: 'abstention_statement_mismatch' })
    }
    if (claim.supersededBy === claim.claimId) {
      context.addIssue({ code: 'custom', path: ['supersededBy'], message: 'claim_supersedes_itself' })
    }
  })
export type ClaimRecord = z.infer<typeof ClaimRecordSchema>

/**
 * A coverage target is the composite primary key of the existing `coverage_ledger`
 * table: `coverage_id` alone is not unique there, so the edge carries the whole key
 * and SQLite enforces it as one FK.
 */
export const CoverageTargetSchema = z
  .object({
    coverageId: LongOpaqueTokenSchema,
    rangeStart: CanonicalTimestampSchema,
    jobId: OpaqueTokenSchema,
  })
  .strict()
export type CoverageTarget = z.infer<typeof CoverageTargetSchema>

const EvidenceTargetEdgeSchema = z
  .object({
    role: z.enum(CLAIM_EVIDENCE_EDGE_ROLES),
    targetEvidenceId: OpaqueTokenSchema,
  })
  .strict()

const ClaimTargetEdgeSchema = z
  .object({
    role: z.literal('derives_from'),
    targetClaimId: ClaimIdSchema,
  })
  .strict()

const CoverageTargetEdgeSchema = z
  .object({
    role: z.literal('coverage_basis'),
    targetCoverage: CoverageTargetSchema,
  })
  .strict()

/**
 * Exactly one typed target per edge, chosen by role. The union makes an
 * unconstrained polymorphic target unrepresentable in the contract; the table's
 * CHECKs make it unrepresentable in SQLite for callers that bypass the contract.
 */
export const ClaimEvidenceEdgeSchema = z.union([
  EvidenceTargetEdgeSchema,
  ClaimTargetEdgeSchema,
  CoverageTargetEdgeSchema,
])
export type ClaimEvidenceEdge = z.infer<typeof ClaimEvidenceEdgeSchema>

export function claimEdgeTargetKind(edge: ClaimEvidenceEdge): ClaimEdgeTargetKind {
  return CLAIM_EDGE_ROLE_TARGET_KIND[edge.role]
}

export const LimitationInstanceSchema = z
  .object({
    limitationCode: ClaimLimitationCodeSchema,
    dimension: ClaimLimitationDimensionSchema,
    copyKey: OpaqueTokenSchema,
  })
  .strict()
export type LimitationInstance = z.infer<typeof LimitationInstanceSchema>

/**
 * Correction and revocation lineage. `subjectId` is deliberately not an FK: the log
 * outlives its subject (a tombstone cascade records rows that no longer exist), so it
 * is validated as an opaque token rather than joined.
 */
export const LineageEventSchema = z
  .object({
    subjectId: LongOpaqueTokenSchema,
    eventKind: LineageEventKindSchema,
    causedBy: LongOpaqueTokenSchema.nullable(),
    occurredAt: CanonicalTimestampSchema,
  })
  .strict()
export type LineageEvent = z.infer<typeof LineageEventSchema>

/** The evidence anchor a claim edge resolves to. See `server/storage/claims.ts`. */
export const EvidenceAnchorSchema = z
  .object({
    evidenceId: OpaqueTokenSchema,
    layer: z.enum(EVIDENCE_LAYERS),
    coverage: CoverageTargetSchema,
  })
  .strict()
export type EvidenceAnchor = z.infer<typeof EvidenceAnchorSchema>

/**
 * Stability key (ADR-01, frontier finding C-03): any new evidence mints a new claim
 * ID, so history groups by this tuple instead. The scope component is the opaque
 * `scope_id` surrogate, so per-scope series never merge and no C2 alias value is
 * needed to group them.
 */
export const ClaimStabilityKeySchema = z
  .object({
    statementCode: ClaimStatementCodeSchema,
    methodId: OpaqueTokenSchema,
    methodVersion: MethodVersionSchema,
    windowStart: CanonicalTimestampSchema,
    windowEnd: CanonicalTimestampSchema,
    scopeId: OpaqueTokenSchema,
    schemaVersion: z.literal(CLAIM_SCHEMA_VERSION),
  })
  .strict()
export type ClaimStabilityKey = z.infer<typeof ClaimStabilityKeySchema>

export function claimStabilityKey(claim: ClaimRecord): ClaimStabilityKey {
  return ClaimStabilityKeySchema.parse({
    statementCode: claim.statementCode,
    methodId: claim.methodId,
    methodVersion: claim.methodVersion,
    windowStart: claim.windowStart,
    windowEnd: claim.windowEnd,
    scopeId: claim.scopeId,
    schemaVersion: claim.schemaVersion,
  })
}

/** A grouping token for a supersession series. Not persisted; the index is the key. */
export function claimStabilityKeyToken(key: ClaimStabilityKey): string {
  const parsed = ClaimStabilityKeySchema.parse(key)
  return [
    parsed.statementCode,
    `${parsed.methodId}@${parsed.methodVersion}`,
    `${parsed.windowStart}/${parsed.windowEnd}`,
    parsed.scopeId,
    parsed.schemaVersion,
  ].join('|')
}

export const CLAIM_ID_MATERIAL_VERSION = 'claim-id.v1' as const

export const ClaimIdentitySchema = z
  .object({
    statementCode: ClaimStatementCodeSchema,
    methodId: OpaqueTokenSchema,
    methodVersion: MethodVersionSchema,
    evidenceIds: z.array(OpaqueTokenSchema).readonly(),
    windowStart: CanonicalTimestampSchema,
    windowEnd: CanonicalTimestampSchema,
    scopeId: OpaqueTokenSchema,
    schemaVersion: z.literal(CLAIM_SCHEMA_VERSION),
  })
  .strict()
export type ClaimIdentity = z.infer<typeof ClaimIdentitySchema>

/**
 * Reference canonicalisation for the deterministic claim ID. Evidence IDs are
 * de-duplicated and ordered by UTF-16 code unit (`Array.prototype.sort` default —
 * never `localeCompare`, which is locale-dependent). Only opaque tokens and the
 * content-free `scopeId` enter the material, so no C2 alias value is ever hashed
 * into a C1 claim ID.
 *
 * DL-SPINE-02 owns the hardened cross-platform canonicalisation function and the
 * replay proof; this is the format contract plus a straightforward implementation.
 */
export function claimIdMaterial(identity: ClaimIdentity): string {
  const parsed = ClaimIdentitySchema.parse(identity)
  return [
    CLAIM_ID_MATERIAL_VERSION,
    parsed.statementCode,
    `${parsed.methodId}@${parsed.methodVersion}`,
    [...new Set(parsed.evidenceIds)].sort().join(','),
    `${parsed.windowStart}/${parsed.windowEnd}`,
    parsed.scopeId,
    parsed.schemaVersion,
  ].join('\n')
}

/** `cl_` + SHA-256 over the canonical material. */
export function computeClaimId(identity: ClaimIdentity): string {
  const digest = createHash('sha256').update(claimIdMaterial(identity), 'utf8').digest('hex')
  return `cl_${digest}`
}
