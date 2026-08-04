import { createHash } from 'node:crypto'
import { z } from 'zod'
import { EVIDENCE_LAYERS } from './provenance.js'

export const CLAIM_CONTRACT_VERSION = '1.0.0' as const

/** Schema version carried by every `claim` row; part of the stability key and the claim ID. */
export const CLAIM_SCHEMA_VERSION = '1.0.0' as const

/**
 * Every canonicalisation version this schema can STORE, append-only and never reordered. The
 * storage CHECK and the row contract are both generated from this list, so the day a v3 lands
 * the two v-values coexist in one table by construction rather than by migration.
 *
 * v1 (DL-SPINE-01) hashed only evidence target IDs and is absent deliberately: it was never
 * released, so no store contains v1 rows and admitting the value would only invite one.
 */
export const CLAIM_ID_MATERIAL_VERSIONS = ['claim-id.v2'] as const
export const ClaimIdMaterialVersionSchema = z.enum(CLAIM_ID_MATERIAL_VERSIONS)
export type ClaimIdMaterialVersion = z.infer<typeof ClaimIdMaterialVersionSchema>

/**
 * The version the CURRENT writer derives IDs under (ADR-01 failure clause: the function is
 * versioned so a cross-platform instability is a migration, never a silent re-identification).
 * Every `claim` row records the version its ID was derived under, so a replay that reproduces
 * an ID is only comparable against a row derived under the same rule — a row at any other
 * listed version is a typed mismatch, never a content comparison.
 *
 * v2 (DL-SPINE-02) adds `layer` and the canonical-ordered set of *all* typed basis edges, so a
 * claim differing only in what it derives from — or only in its layer — is a different claim
 * rather than a collision.
 */
export const CLAIM_ID_MATERIAL_VERSION: ClaimIdMaterialVersion = 'claim-id.v2'

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

/**
 * The C1 scope surrogate. Minted by the storage writer from 32 random bytes and never
 * derived from — or otherwise a function of — the C2 alias value, so the shape alone
 * bounds what a `scope_id` can be: `scope-` plus exactly 64 lowercase hex digits.
 */
const CLAIM_SCOPE_ID_PATTERN = /^scope-[0-9a-f]{64}$/
export const CLAIM_SCOPE_ID_PREFIX = 'scope-' as const
export const CLAIM_SCOPE_ID_ENTROPY_BYTES = 32 as const

/** The canonical UTC form the storage layer accepts: `new Date(value).toISOString()`. */
const CANONICAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export const OpaqueTokenSchema = z.string().regex(OPAQUE_TOKEN_PATTERN)
export const LongOpaqueTokenSchema = z.string().regex(LONG_OPAQUE_TOKEN_PATTERN)
export const ClaimIdSchema = z.string().regex(CLAIM_ID_PATTERN)
export const ClaimScopeIdSchema = z.string().regex(CLAIM_SCOPE_ID_PATTERN)
/** Bounded to 64 characters so the contract and the `method_version` CHECK reject the same strings. */
export const MethodVersionSchema = z.string().max(64).regex(SEMANTIC_VERSION_PATTERN)
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
    scopeId: ClaimScopeIdSchema,
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
    scopeId: ClaimScopeIdSchema,
    schemaVersion: z.literal(CLAIM_SCHEMA_VERSION),
    /**
     * Any storable version, not just the current writer's — a row derived under an older listed
     * version must still PARSE, or a v3 writer could not even read a v2 row to report the
     * mismatch. Acting on a non-current row is what the writer refuses, not reading it.
     */
    claimIdMaterialVersion: ClaimIdMaterialVersionSchema,
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

/**
 * Dependency order over the layer ladder (ADR-26 relabelling guard). A claim may only rest
 * on inputs at least as strong as itself: a *weaker* target would let a modelled or
 * hypothesis input be rendered with deterministic styling. Coverage targets are ledger
 * facts and sit at the `observed` end of the ladder.
 */
const LAYER_WEAKNESS: Readonly<Record<'observed' | 'deterministic' | 'modelled' | 'hypothesis', number>> =
  Object.freeze({ observed: 0, deterministic: 1, modelled: 2, hypothesis: 3 })

export type CitableLayer = ClaimLayer | typeof EVIDENCE_LAYERS[number]

/**
 * Abstention is special-cased in both directions, and deliberately so:
 * - an abstention claim states only "coverage was insufficient", so it asserts nothing that
 *   could be strengthened by its inputs and may cite any layer;
 * - nothing except another abstention may derive from an abstention, because turning
 *   "we do not know" into a positive claim is exactly the relabelling ADR-26 forbids.
 */
export function claimMayCiteLayer(citer: ClaimLayer, target: CitableLayer): boolean {
  if (target === 'abstention') return citer === 'abstention'
  if (citer === 'abstention') return true
  return LAYER_WEAKNESS[target] <= LAYER_WEAKNESS[citer]
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
    scopeId: ClaimScopeIdSchema,
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

export const ClaimIdentitySchema = z
  .object({
    layer: ClaimLayerSchema,
    statementCode: ClaimStatementCodeSchema,
    methodId: OpaqueTokenSchema,
    methodVersion: MethodVersionSchema,
    basis: z.array(ClaimEvidenceEdgeSchema).min(1).readonly(),
    windowStart: CanonicalTimestampSchema,
    windowEnd: CanonicalTimestampSchema,
    scopeId: ClaimScopeIdSchema,
    schemaVersion: z.literal(CLAIM_SCHEMA_VERSION),
  })
  .strict()
export type ClaimIdentity = z.infer<typeof ClaimIdentitySchema>

/**
 * Field separator inside one basis token. Every component of a token is a validated opaque
 * token, a canonical timestamp, or a closed enum value, and none of those alphabets contains
 * `|` or `,` — so joining is injective and no length prefixes are needed.
 */
const BASIS_FIELD_SEPARATOR = '|'
const BASIS_TOKEN_SEPARATOR = ','
const MATERIAL_FIELD_SEPARATOR = '\n'

/**
 * One typed basis edge as a canonical string. The target *kind* leads, so a token can never
 * be read as a token of another kind, and the whole typed target is included: a claim that
 * derives from a different predecessor produces a different token and therefore a different
 * claim ID (the v1 material hashed only evidence IDs, which made a re-derived successor
 * collide with its own predecessor).
 */
export function claimBasisToken(edge: ClaimEvidenceEdge): string {
  const parsed = ClaimEvidenceEdgeSchema.parse(edge)
  if ('targetEvidenceId' in parsed) {
    return ['evidence', parsed.role, parsed.targetEvidenceId].join(BASIS_FIELD_SEPARATOR)
  }
  if ('targetClaimId' in parsed) {
    return ['claim', parsed.role, parsed.targetClaimId].join(BASIS_FIELD_SEPARATOR)
  }
  return [
    'coverage',
    parsed.role,
    parsed.targetCoverage.coverageId,
    parsed.targetCoverage.rangeStart,
    parsed.targetCoverage.jobId,
  ].join(BASIS_FIELD_SEPARATOR)
}

/**
 * Canonicalisation for the deterministic claim ID, version `CLAIM_ID_MATERIAL_VERSION`.
 *
 * Determinism rules, all of which the replay proof in `server/storage/claimReplay.test.ts`
 * exercises directly:
 * - **No numbers.** Every component is a string that has already passed a regex-bounded
 *   schema. Floating point never reaches the material, so there is no float-to-string rule
 *   to be platform- or locale-sensitive; a numeric input fails the contract instead.
 * - **No locale.** Ordering is `Array.prototype.sort()`'s default — comparison by UTF-16
 *   code unit. `localeCompare`, `Intl.Collator`, and `toLocaleString` are never used here
 *   or anywhere on the write path.
 * - **No clock and no local time.** Window bounds are carried through byte-for-byte as the
 *   caller's already-canonical UTC strings; nothing re-derives them from a `Date`, so the
 *   ambient timezone cannot reach the digest. `created_at` is deliberately absent: replay
 *   at a later wall-clock reproduces the same ID.
 * - **Set semantics.** Basis tokens are de-duplicated and sorted, so insertion order and
 *   duplicate edges cannot change the ID.
 * - **Content-free scope.** Only the minted `scope-…` surrogate enters, never the C2 alias.
 */
export function claimIdMaterial(identity: ClaimIdentity): string {
  const parsed = ClaimIdentitySchema.parse(identity)
  const basis = [...new Set(parsed.basis.map(claimBasisToken))].sort()
  return [
    CLAIM_ID_MATERIAL_VERSION,
    parsed.layer,
    parsed.statementCode,
    `${parsed.methodId}@${parsed.methodVersion}`,
    basis.join(BASIS_TOKEN_SEPARATOR),
    `${parsed.windowStart}/${parsed.windowEnd}`,
    parsed.scopeId,
    parsed.schemaVersion,
  ].join(MATERIAL_FIELD_SEPARATOR)
}

/** `cl_` + SHA-256 over the canonical material. */
export function computeClaimId(identity: ClaimIdentity): string {
  const digest = createHash('sha256').update(claimIdMaterial(identity), 'utf8').digest('hex')
  return `cl_${digest}`
}
