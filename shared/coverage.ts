import { z } from 'zod'
import { CapabilityIdSchema } from './capabilities.js'

export const COVERAGE_CONTRACT_VERSION = '1.0.0' as const

export const COVERAGE_STATUSES = [
  'never_authorized',
  'refused',
  'unavailable',
  'restricted',
  'truncated',
  'stale',
  'failed',
  'deleted',
  'censored',
  'complete',
] as const
export const CoverageStatusSchema = z.enum(COVERAGE_STATUSES)
export type CoverageStatus = z.infer<typeof CoverageStatusSchema>

const UtcTimestampSchema = z.string().datetime({ offset: true })
const NonnegativeCountSchema = z.number().int().nonnegative()

export const CoverageRecordSchema = z
  .object({
    coverageId: z.string().min(1),
    capabilityId: CapabilityIdSchema,
    scopeAlias: z.string().min(1),
    rangeStart: UtcTimestampSchema,
    rangeEnd: UtcTimestampSchema,
    status: CoverageStatusSchema,
    expectedUnits: NonnegativeCountSchema.nullable(),
    observedUnits: NonnegativeCountSchema,
    omittedUnits: NonnegativeCountSchema.nullable(),
    saturationReason: z.string().regex(/^[A-Z0-9_]+$/).optional(),
    retryable: z.boolean(),
    observedAt: UtcTimestampSchema,
    limitationCode: z.string().regex(/^[A-Z0-9_]+$/),
  })
  .strict()
  .superRefine((coverage, context) => {
    if (Date.parse(coverage.rangeStart) >= Date.parse(coverage.rangeEnd)) {
      context.addIssue({ code: 'custom', message: 'Coverage ranges must be half-open and increasing', path: ['rangeEnd'] })
    }
    if (coverage.status === 'complete' && coverage.expectedUnits === null) {
      context.addIssue({ code: 'custom', message: 'Complete coverage requires expectedUnits', path: ['expectedUnits'] })
    }
    if (coverage.status === 'complete' && coverage.expectedUnits !== null && coverage.observedUnits !== coverage.expectedUnits) {
      context.addIssue({ code: 'custom', message: 'Complete coverage requires all expected units to be observed', path: ['observedUnits'] })
    }
    if (coverage.status === 'complete' && coverage.omittedUnits !== 0) {
      context.addIssue({ code: 'custom', message: 'Complete coverage requires zero omitted units', path: ['omittedUnits'] })
    }
    if (coverage.expectedUnits !== null && coverage.observedUnits > coverage.expectedUnits) {
      context.addIssue({ code: 'custom', message: 'observedUnits cannot exceed expectedUnits', path: ['observedUnits'] })
    }
    if (
      coverage.expectedUnits !== null && coverage.omittedUnits !== null &&
      coverage.observedUnits + coverage.omittedUnits !== coverage.expectedUnits
    ) {
      context.addIssue({ code: 'custom', message: 'Observed and omitted units must account for expected units', path: ['omittedUnits'] })
    }
    if (coverage.status === 'truncated' && !coverage.saturationReason) {
      context.addIssue({ code: 'custom', message: 'Truncated coverage requires a saturation reason', path: ['saturationReason'] })
    }
    if (coverage.status !== 'truncated' && coverage.saturationReason) {
      context.addIssue({ code: 'custom', message: 'Only truncated coverage may have a saturation reason', path: ['saturationReason'] })
    }
  })

export type CoverageRecord = z.infer<typeof CoverageRecordSchema>

/** A missing or restricted state never becomes a numeric zero in a derived view. */
export function completeObservedUnits(coverage: CoverageRecord): number | null {
  return coverage.status === 'complete' ? coverage.observedUnits : null
}

// ---------------------------------------------------------------------------
// Coverage vector 2.0 — registered, versioned dimension set (ADR-02, DL-SPINE-04)
//
// Wire spelling is load-bearing and deliberately differs from the camelCase
// CoverageRecord fields above: dimension keys and `limiting_reason` are snake_case on every
// wire and SQL surface, and `limiting_reason` is the one canonical spelling. Do not
// "harmonise" them to camelCase.
//
// This card ships the registry, the shapes, and the EvidenceConfidence mapping only.
// Per-claim-family minimum vector requirements and monotone abstention are DL-SPINE-05;
// nothing here evaluates a gate or ranks dimensions by severity.
// ---------------------------------------------------------------------------

/**
 * Registry version of the dimension set. Distinct from COVERAGE_CONTRACT_VERSION above,
 * which versions the CoverageRecord contract and is unchanged by this card.
 */
export const COVERAGE_VECTOR_VERSION = 2 as const

/** Closed dimension set. Anything outside it fails closed. */
export const COVERAGE_DIMENSIONS = [
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
export const CoverageDimensionSchema = z.enum(COVERAGE_DIMENSIONS)
export type CoverageDimension = z.infer<typeof CoverageDimensionSchema>

/**
 * Registered polarity. Every dimension is `higher_is_better`, but the direction is stored per
 * dimension rather than assumed globally so no implementer ever has to guess a sign: monotone
 * abstention (DL-SPINE-05) inverts on any dimension read with the wrong polarity.
 */
export const COVERAGE_DIMENSION_DIRECTIONS = ['higher_is_better'] as const
export const CoverageDimensionDirectionSchema = z.enum(COVERAGE_DIMENSION_DIRECTIONS)
export type CoverageDimensionDirection = z.infer<typeof CoverageDimensionDirectionSchema>

/** Closed set of limiting-reason codes. An unregistered code fails closed. */
export const COVERAGE_LIMITING_REASONS = [
  // Universal absence codes — one per CoverageStatus that denotes absent or withheld
  // evidence, so a coverage record's status always has a dimension-level spelling.
  'NEVER_AUTHORIZED',
  'REFUSED',
  'UNAVAILABLE',
  'RESTRICTED',
  'FAILED',
  'DELETED',
  // permission
  'SCOPE_NOT_GRANTED',
  'CONSENT_REVOKED',
  // completeness
  'EXPECTED_UNITS_UNKNOWN',
  'SATURATION_CAP_REACHED',
  // eligibility
  'ELIGIBILITY_RULE_UNRESOLVED',
  // freshness
  'NO_COLLECTION_TIMESTAMP',
  'STALE_BEYOND_SLO',
  // censoring_freedom
  'GH_DEPLOY_STATUS_90D_CENSOR',
  'HISTORY_REWRITTEN',
  'SHALLOW_CLONE_ANCESTRY',
  // consistency
  'NO_COMPARISONS',
  // sample
  'DISPLAY_TARGET_UNDEFINED',
  'SAMPLE_BELOW_MINIMUM',
  // source_diversity
  'SINGLE_SOURCE_ONLY',
  'REQUIRED_SOURCES_UNDECLARED',
  // parser_coverage
  'NO_PARSER_FOR_LANGUAGE',
  'PARSER_TIER_UNSUPPORTED',
  // comparability
  'NO_SNAPSHOT_PAIR',
  'PARSER_MAJOR_CHANGED',
  'CONFIG_REVISION_CHANGED',
  // drift_stability
  'NO_RECOLLECTION_SERIES',
  'RECOLLECTION_SERIES_TOO_SHORT',
  // calibration
  'NO_RESOLVED_QUESTIONS',
  'CALIBRATION_PRODUCER_UNAVAILABLE',
] as const
export const CoverageLimitingReasonSchema = z.enum(COVERAGE_LIMITING_REASONS)
export type CoverageLimitingReason = z.infer<typeof CoverageLimitingReasonSchema>

/** Absence codes every dimension may cite, in addition to its own registered codes. */
export const UNIVERSAL_LIMITING_REASONS = [
  'NEVER_AUTHORIZED',
  'REFUSED',
  'UNAVAILABLE',
  'RESTRICTED',
  'FAILED',
  'DELETED',
] as const satisfies readonly CoverageLimitingReason[]

/** The six canonical EvidenceConfidence components (registry version 1). */
export const EVIDENCE_CONFIDENCE_FIELDS = [
  'freshness',
  'sample',
  'eligibility',
  'sourceDiversity',
  'consistency',
  'completeness',
] as const
export type EvidenceConfidenceField = (typeof EVIDENCE_CONFIDENCE_FIELDS)[number]

/** Every dimension and every EvidenceConfidence component is a ratio in [0, 1]. */
const RatioSchema = z.number().min(0).max(1)

export const EvidenceConfidenceSchema = z
  .object({
    freshness: RatioSchema.nullable(),
    sample: RatioSchema.nullable(),
    eligibility: RatioSchema.nullable(),
    sourceDiversity: RatioSchema.nullable(),
    consistency: RatioSchema.nullable(),
    completeness: RatioSchema.nullable(),
  })
  .strict()
export type EvidenceConfidence = z.infer<typeof EvidenceConfidenceSchema>

/** Explicit EvidenceConfidence → dimension mapping (ADR-02; not a 1:1 rename). */
export const EVIDENCE_CONFIDENCE_DIMENSIONS = {
  freshness: 'freshness',
  sample: 'sample',
  eligibility: 'eligibility',
  sourceDiversity: 'source_diversity',
  consistency: 'consistency',
  completeness: 'completeness',
} as const satisfies Record<EvidenceConfidenceField, CoverageDimension>

/** Dimensions carried from registry version 1, i.e. those an EvidenceConfidence can fill. */
export const COVERAGE_VECTOR_V1_DIMENSIONS = [
  'completeness',
  'eligibility',
  'freshness',
  'consistency',
  'sample',
  'source_diversity',
] as const satisfies readonly CoverageDimension[]
export type CoverageVectorV1Dimension = (typeof COVERAGE_VECTOR_V1_DIMENSIONS)[number]

/** Dimensions introduced by registry version 2. They have no v1 producer and start null. */
export const COVERAGE_VECTOR_V2_ONLY_DIMENSIONS = [
  'permission',
  'censoring_freedom',
  'parser_coverage',
  'comparability',
  'drift_stability',
  'calibration',
] as const satisfies readonly CoverageDimension[]
export type CoverageVectorV2OnlyDimension = (typeof COVERAGE_VECTOR_V2_ONLY_DIMENSIONS)[number]

export interface CoverageDimensionDefinition {
  readonly dimension: CoverageDimension
  readonly direction: CoverageDimensionDirection
  /** Registry version that introduced the dimension. Version-1 readers ignore version-2 entries. */
  readonly introducedIn: 1 | 2
  /** EvidenceConfidence component carried into this dimension, or null for a version-2 dimension. */
  readonly evidenceConfidenceField: EvidenceConfidenceField | null
  /** What a value of 1 means, so polarity is never inferred from the dimension's name. */
  readonly meaningOfOne: string
  /** Codes specific to this dimension. UNIVERSAL_LIMITING_REASONS are additionally allowed. */
  readonly limitingReasons: readonly CoverageLimitingReason[]
}

export const COVERAGE_DIMENSION_REGISTRY = {
  permission: {
    dimension: 'permission',
    direction: 'higher_is_better',
    introducedIn: 2,
    evidenceConfidenceField: null,
    meaningOfOne: '1 = every scope this claim needs is authorised',
    limitingReasons: ['SCOPE_NOT_GRANTED', 'CONSENT_REVOKED'],
  },
  completeness: {
    dimension: 'completeness',
    direction: 'higher_is_better',
    introducedIn: 1,
    evidenceConfidenceField: 'completeness',
    meaningOfOne: '1 = observed expected units / expected units, all expected units observed',
    limitingReasons: ['EXPECTED_UNITS_UNKNOWN', 'SATURATION_CAP_REACHED'],
  },
  eligibility: {
    dimension: 'eligibility',
    direction: 'higher_is_better',
    introducedIn: 1,
    evidenceConfidenceField: 'eligibility',
    meaningOfOne: '1 = eligible / expected, every expected unit is eligible',
    limitingReasons: ['ELIGIBILITY_RULE_UNRESOLVED'],
  },
  freshness: {
    dimension: 'freshness',
    direction: 'higher_is_better',
    introducedIn: 1,
    evidenceConfidenceField: 'freshness',
    meaningOfOne: '1 = 1 - age/SLO clamped, evidence is at the head of its freshness budget',
    limitingReasons: ['NO_COLLECTION_TIMESTAMP', 'STALE_BEYOND_SLO'],
  },
  censoring_freedom: {
    dimension: 'censoring_freedom',
    direction: 'higher_is_better',
    introducedIn: 2,
    evidenceConfidenceField: null,
    // Named for its freedom, not its censoring: there is no lower-is-better "censoring" value.
    meaningOfOne: '1 = no censoring in the window',
    limitingReasons: ['GH_DEPLOY_STATUS_90D_CENSOR', 'HISTORY_REWRITTEN', 'SHALLOW_CLONE_ANCESTRY'],
  },
  consistency: {
    dimension: 'consistency',
    direction: 'higher_is_better',
    introducedIn: 1,
    evidenceConfidenceField: 'consistency',
    // Kept as consistency, not conflict, so the canonical formula reads higher-is-better.
    meaningOfOne: '1 = 1 - conflicts/comparisons, sources agree',
    limitingReasons: ['NO_COMPARISONS'],
  },
  sample: {
    dimension: 'sample',
    direction: 'higher_is_better',
    introducedIn: 1,
    evidenceConfidenceField: 'sample',
    meaningOfOne: '1 = min(1, eligibleN/displayTargetN), the display target is met',
    limitingReasons: ['DISPLAY_TARGET_UNDEFINED', 'SAMPLE_BELOW_MINIMUM'],
  },
  source_diversity: {
    dimension: 'source_diversity',
    direction: 'higher_is_better',
    introducedIn: 1,
    evidenceConfidenceField: 'sourceDiversity',
    meaningOfOne: '1 = observed independent sources / required, every required source observed',
    limitingReasons: ['SINGLE_SOURCE_ONLY', 'REQUIRED_SOURCES_UNDECLARED'],
  },
  parser_coverage: {
    dimension: 'parser_coverage',
    direction: 'higher_is_better',
    introducedIn: 2,
    evidenceConfidenceField: null,
    meaningOfOne: '1 = admitted files or bytes / eligible, per language x parser tier',
    limitingReasons: ['NO_PARSER_FOR_LANGUAGE', 'PARSER_TIER_UNSUPPORTED'],
  },
  comparability: {
    dimension: 'comparability',
    direction: 'higher_is_better',
    introducedIn: 2,
    evidenceConfidenceField: null,
    meaningOfOne: '1 = every compared snapshot pair shares parser major and config revision',
    limitingReasons: ['NO_SNAPSHOT_PAIR', 'PARSER_MAJOR_CHANGED', 'CONFIG_REVISION_CHANGED'],
  },
  drift_stability: {
    dimension: 'drift_stability',
    direction: 'higher_is_better',
    introducedIn: 2,
    evidenceConfidenceField: null,
    // Named for its stability, not its drift: 1 is the good end.
    meaningOfOne: '1 = stable, the instrument held steady across re-collections',
    limitingReasons: ['NO_RECOLLECTION_SERIES', 'RECOLLECTION_SERIES_TOO_SHORT'],
  },
  calibration: {
    dimension: 'calibration',
    direction: 'higher_is_better',
    introducedIn: 2,
    evidenceConfidenceField: null,
    meaningOfOne: '1 = predictions are perfectly calibrated against resolved questions',
    limitingReasons: ['NO_RESOLVED_QUESTIONS', 'CALIBRATION_PRODUCER_UNAVAILABLE'],
  },
} as const satisfies Record<CoverageDimension, CoverageDimensionDefinition>

/** Every code this dimension may cite: its registered codes plus the universal absence codes. */
export function limitingReasonsFor(dimension: CoverageDimension): readonly CoverageLimitingReason[] {
  return [...COVERAGE_DIMENSION_REGISTRY[dimension].limitingReasons, ...UNIVERSAL_LIMITING_REASONS]
}

export function isLimitingReasonRegistered(dimension: CoverageDimension, reason: CoverageLimitingReason): boolean {
  return limitingReasonsFor(dimension).includes(reason)
}

/**
 * The one canonical dimension-value shape. A bare number or a bare null is not a valid
 * encoding, and a null value always carries a limiting reason — absence is never a default.
 *
 * A present value MAY also carry a limiting reason: that is how a degraded-but-measured
 * dimension (say completeness 0.62 under a saturation cap) reports why it is low.
 */
export const CoverageDimensionValueSchema = z
  .object({
    value: RatioSchema.nullable(),
    limiting_reason: CoverageLimitingReasonSchema.nullable(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.value === null && entry.limiting_reason === null) {
      context.addIssue({
        code: 'custom',
        message: 'A null dimension value must carry a limiting reason; absence is never a default',
        path: ['limiting_reason'],
      })
    }
  })
export type CoverageDimensionValue = z.infer<typeof CoverageDimensionValueSchema>

/**
 * The closed twelve-dimension vector. Every dimension is required and unknown keys are
 * rejected, so a payload can neither smuggle a dimension in nor quietly drop one.
 */
export const CoverageVectorV2Schema = z
  .object({
    permission: CoverageDimensionValueSchema,
    completeness: CoverageDimensionValueSchema,
    eligibility: CoverageDimensionValueSchema,
    freshness: CoverageDimensionValueSchema,
    censoring_freedom: CoverageDimensionValueSchema,
    consistency: CoverageDimensionValueSchema,
    sample: CoverageDimensionValueSchema,
    source_diversity: CoverageDimensionValueSchema,
    parser_coverage: CoverageDimensionValueSchema,
    comparability: CoverageDimensionValueSchema,
    drift_stability: CoverageDimensionValueSchema,
    calibration: CoverageDimensionValueSchema,
  })
  .strict()
  .superRefine((vector, context) => {
    for (const dimension of COVERAGE_DIMENSIONS) {
      const reason = vector[dimension].limiting_reason
      if (reason !== null && !isLimitingReasonRegistered(dimension, reason)) {
        context.addIssue({
          code: 'custom',
          message: `Limiting reason ${reason} is not registered for dimension ${dimension}`,
          path: [dimension, 'limiting_reason'],
        })
      }
    }
  })
export type CoverageVectorV2 = z.infer<typeof CoverageVectorV2Schema>

/** Limiting reasons the six version-2 dimensions cite until their producers exist. */
export type CoverageVectorV2OnlyReasons = Readonly<Record<CoverageVectorV2OnlyDimension, CoverageLimitingReason>>

export interface CoverageVectorLift {
  /** Required: the six version-2 dimensions have no v1 producer, so they start null with a reason. */
  readonly newDimensionReasons: CoverageVectorV2OnlyReasons
  /** Required for every EvidenceConfidence component that is null; optional for present ones. */
  readonly nullFieldReasons?: Partial<Readonly<Record<EvidenceConfidenceField, CoverageLimitingReason>>>
}

/**
 * Lift a v1 EvidenceConfidence into the v2 vector. Values are carried unchanged; the six
 * version-2 dimensions start null and must be given a limiting reason by the caller. Fails
 * closed on a null component with no reason and on any code not registered for its dimension.
 */
export function evidenceConfidenceToCoverageVectorV2(
  confidence: EvidenceConfidence,
  lift: CoverageVectorLift,
): CoverageVectorV2 {
  const parsed = EvidenceConfidenceSchema.parse(confidence)
  const draft: Record<string, CoverageDimensionValue> = {}

  for (const field of EVIDENCE_CONFIDENCE_FIELDS) {
    const dimension = EVIDENCE_CONFIDENCE_DIMENSIONS[field]
    const value = parsed[field]
    const reason = lift.nullFieldReasons?.[field] ?? null
    if (value === null && reason === null) {
      throw new Error(
        `EvidenceConfidence.${field} is null and needs a limiting reason for dimension ${dimension}`,
      )
    }
    draft[dimension] = { value, limiting_reason: reason }
  }

  for (const dimension of COVERAGE_VECTOR_V2_ONLY_DIMENSIONS) {
    const reason = lift.newDimensionReasons[dimension]
    if (!reason) {
      throw new Error(`Dimension ${dimension} starts null and needs a limiting reason`)
    }
    draft[dimension] = { value: null, limiting_reason: reason }
  }

  return CoverageVectorV2Schema.parse(draft)
}

/**
 * Rollback path: read a v2 vector as the six v1 components. Values are returned unchanged
 * and the six version-2 dimensions are ignored, so a reader pinned to registry version 1
 * is unaffected by them.
 */
export function coverageVectorV2ToEvidenceConfidence(vector: CoverageVectorV2): EvidenceConfidence {
  const parsed = CoverageVectorV2Schema.parse(vector)
  return EvidenceConfidenceSchema.parse({
    freshness: parsed.freshness.value,
    sample: parsed.sample.value,
    eligibility: parsed.eligibility.value,
    sourceDiversity: parsed.source_diversity.value,
    consistency: parsed.consistency.value,
    completeness: parsed.completeness.value,
  })
}

/**
 * Rollback path for readers that want the six carried dimensions with their limiting reasons
 * intact — EvidenceConfidence cannot carry a reason, this can.
 */
export function projectCoverageVectorToVersion1(
  vector: CoverageVectorV2,
): Readonly<Record<CoverageVectorV1Dimension, CoverageDimensionValue>> {
  const parsed = CoverageVectorV2Schema.parse(vector)
  const projection: Record<string, CoverageDimensionValue> = {}
  for (const dimension of COVERAGE_VECTOR_V1_DIMENSIONS) {
    projection[dimension] = parsed[dimension]
  }
  return projection as Record<CoverageVectorV1Dimension, CoverageDimensionValue>
}

/**
 * Which dimensions currently cite a limiting reason, in registry order. Descriptive only:
 * it applies no threshold, ranks nothing, and decides no claim tier. Choosing *the* limiting
 * dimension for a claim family is monotone abstention — DL-SPINE-05.
 */
export function listLimitingDimensions(vector: CoverageVectorV2): readonly CoverageDimension[] {
  return COVERAGE_DIMENSIONS.filter((dimension) => vector[dimension].limiting_reason !== null)
}
