import { describe, expect, it } from 'vitest'
import {
  COVERAGE_DIMENSIONS,
  COVERAGE_DIMENSION_REGISTRY,
  COVERAGE_LIMITING_REASONS,
  COVERAGE_VECTOR_V1_DIMENSIONS,
  COVERAGE_VECTOR_V2_ONLY_DIMENSIONS,
  COVERAGE_VECTOR_VERSION,
  CoverageDimensionValueSchema,
  CoverageVectorV2Schema,
  EVIDENCE_CONFIDENCE_DIMENSIONS,
  EVIDENCE_CONFIDENCE_FIELDS,
  EvidenceConfidenceSchema,
  UNIVERSAL_LIMITING_REASONS,
  coverageVectorV2ToEvidenceConfidence,
  evidenceConfidenceToCoverageVectorV2,
  isLimitingReasonRegistered,
  limitingReasonsFor,
  listLimitingDimensions,
  projectCoverageVectorToVersion1,
  type CoverageDimension,
  type CoverageLimitingReason,
  type CoverageVectorV2,
  type EvidenceConfidence,
} from './coverage.js'

/** A fully covered control vector: every dimension measured at 1, nothing limiting. */
function fullyCoveredVector(): CoverageVectorV2 {
  const draft: Record<string, { value: number | null; limiting_reason: CoverageLimitingReason | null }> = {}
  for (const dimension of COVERAGE_DIMENSIONS) {
    draft[dimension] = { value: 1, limiting_reason: null }
  }
  return draft as CoverageVectorV2
}

/** The first code registered specifically for a dimension (never a universal fallback). */
function ownReason(dimension: CoverageDimension): CoverageLimitingReason {
  const own = COVERAGE_DIMENSION_REGISTRY[dimension].limitingReasons[0]
  if (!own) throw new Error(`Dimension ${dimension} has no registered limiting reason`)
  return own
}

function withDimension(
  dimension: CoverageDimension,
  entry: { value: number | null; limiting_reason: CoverageLimitingReason | null },
): CoverageVectorV2 {
  return { ...fullyCoveredVector(), [dimension]: entry } as CoverageVectorV2
}

const newDimensionReasons = {
  permission: 'SCOPE_NOT_GRANTED',
  censoring_freedom: 'GH_DEPLOY_STATUS_90D_CENSOR',
  parser_coverage: 'NO_PARSER_FOR_LANGUAGE',
  comparability: 'NO_SNAPSHOT_PAIR',
  drift_stability: 'NO_RECOLLECTION_SERIES',
  calibration: 'NO_RESOLVED_QUESTIONS',
} as const

describe('coverage dimension registry v2', () => {
  it('registers exactly the twelve ADR-02 dimensions', () => {
    expect(COVERAGE_VECTOR_VERSION).toBe(2)
    expect([...COVERAGE_DIMENSIONS]).toEqual([
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
    ])
    expect(Object.keys(COVERAGE_DIMENSION_REGISTRY).sort()).toEqual([...COVERAGE_DIMENSIONS].sort())
  })

  it.each([...COVERAGE_DIMENSIONS])('registers %s as higher_is_better with a stated meaning of 1', (dimension) => {
    const definition = COVERAGE_DIMENSION_REGISTRY[dimension]
    expect(definition.dimension).toBe(dimension)
    expect(definition.direction).toBe('higher_is_better')
    expect(definition.meaningOfOne).toMatch(/^1 = \S/)
    expect(definition.limitingReasons.length).toBeGreaterThan(0)
  })

  it('splits the registry into six carried and six version-2 dimensions', () => {
    const carried = COVERAGE_DIMENSIONS.filter((d) => COVERAGE_DIMENSION_REGISTRY[d].introducedIn === 1)
    const introduced = COVERAGE_DIMENSIONS.filter((d) => COVERAGE_DIMENSION_REGISTRY[d].introducedIn === 2)
    expect([...carried].sort()).toEqual([...COVERAGE_VECTOR_V1_DIMENSIONS].sort())
    expect([...introduced].sort()).toEqual([...COVERAGE_VECTOR_V2_ONLY_DIMENSIONS].sort())
    expect(carried).toHaveLength(6)
    expect(introduced).toHaveLength(6)
    // Exactly the carried six have an EvidenceConfidence source; the new six have none.
    for (const dimension of carried) {
      expect(COVERAGE_DIMENSION_REGISTRY[dimension].evidenceConfidenceField).not.toBeNull()
    }
    for (const dimension of introduced) {
      expect(COVERAGE_DIMENSION_REGISTRY[dimension].evidenceConfidenceField).toBeNull()
    }
  })

  it('keeps the limiting-reason code list closed and fully attributed', () => {
    const attributed = new Set<string>(UNIVERSAL_LIMITING_REASONS)
    for (const dimension of COVERAGE_DIMENSIONS) {
      for (const reason of COVERAGE_DIMENSION_REGISTRY[dimension].limitingReasons) {
        expect(attributed.has(reason), `${reason} is registered to more than one dimension`).toBe(false)
        attributed.add(reason)
      }
    }
    // No orphan codes in the enum, and no code registered that the enum does not declare.
    expect([...attributed].sort()).toEqual([...COVERAGE_LIMITING_REASONS].sort())
    expect(COVERAGE_LIMITING_REASONS.every((code) => /^[A-Z0-9_]+$/.test(code))).toBe(true)
  })

  it('allows universal absence codes on every dimension', () => {
    for (const dimension of COVERAGE_DIMENSIONS) {
      for (const universal of UNIVERSAL_LIMITING_REASONS) {
        expect(isLimitingReasonRegistered(dimension, universal)).toBe(true)
      }
      expect(limitingReasonsFor(dimension)).toEqual(
        expect.arrayContaining([...COVERAGE_DIMENSION_REGISTRY[dimension].limitingReasons]),
      )
    }
  })
})

describe('coverage vector v2 schema — per-dimension degradation', () => {
  it.each([...COVERAGE_DIMENSIONS])('accepts %s null with its own limiting reason and round-trips', (dimension) => {
    const reason = ownReason(dimension)
    const vector = withDimension(dimension, { value: null, limiting_reason: reason })

    const parsed = CoverageVectorV2Schema.parse(vector)
    expect(parsed[dimension]).toEqual({ value: null, limiting_reason: reason })

    // Survives a wire round-trip byte for byte, including the snake_case spelling.
    const reparsed = CoverageVectorV2Schema.parse(JSON.parse(JSON.stringify(parsed)))
    expect(reparsed).toEqual(parsed)
    expect(JSON.stringify(reparsed)).toContain('"limiting_reason"')
    expect(listLimitingDimensions(parsed)).toEqual([dimension])
  })

  it.each([...COVERAGE_DIMENSIONS])('accepts %s degraded but measured, still citing a reason', (dimension) => {
    const reason = ownReason(dimension)
    const vector = withDimension(dimension, { value: 0.42, limiting_reason: reason })
    const parsed = CoverageVectorV2Schema.parse(vector)
    expect(parsed[dimension]).toEqual({ value: 0.42, limiting_reason: reason })
    expect(listLimitingDimensions(parsed)).toEqual([dimension])
  })

  it.each([...COVERAGE_DIMENSIONS])('rejects %s null without a limiting reason', (dimension) => {
    const vector = withDimension(dimension, { value: null, limiting_reason: null })
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it.each([...COVERAGE_DIMENSIONS])('rejects %s null with the limiting_reason key missing entirely', (dimension) => {
    const vector = { ...fullyCoveredVector(), [dimension]: { value: null } }
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it.each([...COVERAGE_DIMENSIONS])('rejects %s citing a code registered to another dimension', (dimension) => {
    const foreign = COVERAGE_DIMENSIONS.find(
      (other) => other !== dimension && COVERAGE_DIMENSION_REGISTRY[other].limitingReasons.length > 0,
    )
    if (!foreign) throw new Error('expected another dimension with its own codes')
    const vector = withDimension(dimension, { value: null, limiting_reason: ownReason(foreign) })
    expect(isLimitingReasonRegistered(dimension, ownReason(foreign))).toBe(false)
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it.each([...COVERAGE_DIMENSIONS])('rejects a vector missing %s entirely', (dimension) => {
    const vector: Record<string, unknown> = { ...fullyCoveredVector() }
    delete vector[dimension]
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it('accepts the fully covered control vector with nothing limiting', () => {
    const parsed = CoverageVectorV2Schema.parse(fullyCoveredVector())
    expect(listLimitingDimensions(parsed)).toEqual([])
  })
})

describe('coverage vector v2 schema — hostile payloads', () => {
  it('rejects an unknown dimension key', () => {
    const vector = { ...fullyCoveredVector(), velocity: { value: 1, limiting_reason: null } }
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it('rejects an unknown limiting code', () => {
    const vector = withDimension('completeness', {
      value: null,
      limiting_reason: 'TOTALLY_MADE_UP_CODE' as CoverageLimitingReason,
    })
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it.each([...COVERAGE_DIMENSIONS])('rejects a bare number as the %s value', (dimension) => {
    const vector = { ...fullyCoveredVector(), [dimension]: 0.5 }
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it.each([...COVERAGE_DIMENSIONS])('rejects a bare null as the %s value', (dimension) => {
    const vector = { ...fullyCoveredVector(), [dimension]: null }
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it.each([1.2, -0.1, Number.NaN, Number.POSITIVE_INFINITY])('rejects the out-of-range value %p', (value) => {
    const vector = { ...fullyCoveredVector(), sample: { value, limiting_reason: null } }
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it.each([['0.5'], [true], [{}], [[]]])('rejects the non-numeric value %p', (value) => {
    const vector = { ...fullyCoveredVector(), sample: { value, limiting_reason: null } }
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it('rejects an extra key inside a dimension value', () => {
    const vector = {
      ...fullyCoveredVector(),
      freshness: { value: 0.5, limiting_reason: null, note: 'why' },
    }
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it('rejects the retired camelCase limitingReason spelling', () => {
    const vector = { ...fullyCoveredVector(), calibration: { value: null, limitingReason: 'NO_RESOLVED_QUESTIONS' } }
    expect(CoverageVectorV2Schema.safeParse(vector).success).toBe(false)
  })

  it('rejects a vector that is not an object at all', () => {
    for (const payload of [null, 0.9, 'complete', []]) {
      expect(CoverageVectorV2Schema.safeParse(payload).success).toBe(false)
    }
  })

  it('rejects a bare number and a bare null as a standalone dimension value', () => {
    expect(CoverageDimensionValueSchema.safeParse(0.5).success).toBe(false)
    expect(CoverageDimensionValueSchema.safeParse(null).success).toBe(false)
    expect(CoverageDimensionValueSchema.safeParse({ value: null, limiting_reason: 'REFUSED' }).success).toBe(true)
  })
})

describe('EvidenceConfidence mapping', () => {
  it('maps all six components onto registered dimensions', () => {
    expect(Object.keys(EVIDENCE_CONFIDENCE_DIMENSIONS).sort()).toEqual([...EVIDENCE_CONFIDENCE_FIELDS].sort())
    for (const field of EVIDENCE_CONFIDENCE_FIELDS) {
      const dimension = EVIDENCE_CONFIDENCE_DIMENSIONS[field]
      expect(COVERAGE_DIMENSIONS).toContain(dimension)
      // The registry names the same edge in reverse; the mapping cannot drift one-sided.
      expect(COVERAGE_DIMENSION_REGISTRY[dimension].evidenceConfidenceField).toBe(field)
    }
    expect(EVIDENCE_CONFIDENCE_DIMENSIONS.sourceDiversity).toBe('source_diversity')
    expect(EVIDENCE_CONFIDENCE_DIMENSIONS.consistency).toBe('consistency')
  })

  const roundTripCases: ReadonlyArray<readonly [string, EvidenceConfidence]> = [
    [
      'all six measured',
      { freshness: 0.9, sample: 0.6, eligibility: 0.9, sourceDiversity: 0.5, consistency: 0.98, completeness: 0.82 },
    ],
    [
      'boundary values',
      { freshness: 0, sample: 1, eligibility: 0, sourceDiversity: 1, consistency: 0, completeness: 1 },
    ],
    [
      'awkward precision',
      {
        freshness: 0.1 + 0.2,
        sample: 1 / 3,
        eligibility: 0.123456789,
        sourceDiversity: 0.999999,
        consistency: 0.000001,
        completeness: 0.5,
      },
    ],
  ]

  it.each(roundTripCases)('round-trips %s through the v2 vector without value change', (_label, confidence) => {
    const vector = evidenceConfidenceToCoverageVectorV2(confidence, { newDimensionReasons })
    const returned = coverageVectorV2ToEvidenceConfidence(vector)
    expect(returned).toEqual(confidence)
    for (const field of EVIDENCE_CONFIDENCE_FIELDS) {
      // Identical value, not merely equal-ish: the carry must not clamp, round, or rescale.
      expect(returned[field]).toBe(confidence[field])
      expect(vector[EVIDENCE_CONFIDENCE_DIMENSIONS[field]].value).toBe(confidence[field])
    }
  })

  it('starts the six version-2 dimensions null with their limiting reasons', () => {
    const confidence = EvidenceConfidenceSchema.parse({
      freshness: 0.9,
      sample: 0.6,
      eligibility: 0.9,
      sourceDiversity: 0.5,
      consistency: 0.98,
      completeness: 0.82,
    })
    const vector = evidenceConfidenceToCoverageVectorV2(confidence, { newDimensionReasons })
    for (const dimension of COVERAGE_VECTOR_V2_ONLY_DIMENSIONS) {
      expect(vector[dimension].value).toBeNull()
      expect(vector[dimension].limiting_reason).toBe(newDimensionReasons[dimension])
    }
    expect(listLimitingDimensions(vector)).toEqual([...COVERAGE_DIMENSIONS].filter((d) =>
      (COVERAGE_VECTOR_V2_ONLY_DIMENSIONS as readonly CoverageDimension[]).includes(d),
    ))
  })

  it.each([...EVIDENCE_CONFIDENCE_FIELDS])('carries a null %s only with a limiting reason', (field) => {
    const confidence = EvidenceConfidenceSchema.parse({
      freshness: 0.9,
      sample: 0.6,
      eligibility: 0.9,
      sourceDiversity: 0.5,
      consistency: 0.98,
      completeness: 0.82,
      [field]: null,
    })

    // Fails closed when the caller supplies no reason for the null component.
    expect(() => evidenceConfidenceToCoverageVectorV2(confidence, { newDimensionReasons })).toThrow(
      new RegExp(`${field}.*null`),
    )

    const vector = evidenceConfidenceToCoverageVectorV2(confidence, {
      newDimensionReasons,
      nullFieldReasons: { [field]: 'UNAVAILABLE' },
    })
    const dimension = EVIDENCE_CONFIDENCE_DIMENSIONS[field]
    expect(vector[dimension]).toEqual({ value: null, limiting_reason: 'UNAVAILABLE' })
    expect(coverageVectorV2ToEvidenceConfidence(vector)[field]).toBeNull()
  })

  it('fails closed on a lift reason that is not registered for its dimension', () => {
    const confidence = EvidenceConfidenceSchema.parse({
      freshness: 0.9,
      sample: 0.6,
      eligibility: 0.9,
      sourceDiversity: 0.5,
      consistency: 0.98,
      completeness: 0.82,
    })
    expect(() =>
      evidenceConfidenceToCoverageVectorV2(confidence, {
        newDimensionReasons: { ...newDimensionReasons, calibration: 'NO_PARSER_FOR_LANGUAGE' },
      }),
    ).toThrow()
    expect(() =>
      evidenceConfidenceToCoverageVectorV2(confidence, {
        newDimensionReasons,
        nullFieldReasons: { completeness: 'NO_RESOLVED_QUESTIONS' },
      }),
    ).toThrow()
  })

  it('rejects an EvidenceConfidence with an unknown component or out-of-range value', () => {
    const base = {
      freshness: 0.9,
      sample: 0.6,
      eligibility: 0.9,
      sourceDiversity: 0.5,
      consistency: 0.98,
      completeness: 0.82,
    }
    expect(EvidenceConfidenceSchema.safeParse({ ...base, calibration: 0.5 }).success).toBe(false)
    expect(EvidenceConfidenceSchema.safeParse({ ...base, freshness: 1.5 }).success).toBe(false)
    expect(EvidenceConfidenceSchema.safeParse({ ...base, source_diversity: 0.5 }).success).toBe(false)
  })
})

describe('rollback path — readers pinned to registry version 1', () => {
  it('ignores the six version-2 dimensions entirely', () => {
    const confidence: EvidenceConfidence = {
      freshness: 0.9,
      sample: 0.6,
      eligibility: 0.9,
      sourceDiversity: 0.5,
      consistency: 0.98,
      completeness: 0.82,
    }
    const vector = evidenceConfidenceToCoverageVectorV2(confidence, { newDimensionReasons })

    // Change every version-2 dimension; a v1-pinned reader must see no difference at all.
    const shifted: CoverageVectorV2 = { ...vector }
    for (const dimension of COVERAGE_VECTOR_V2_ONLY_DIMENSIONS) {
      shifted[dimension] = { value: 0.01, limiting_reason: ownReason(dimension) }
    }
    expect(coverageVectorV2ToEvidenceConfidence(shifted)).toEqual(confidence)
    expect(projectCoverageVectorToVersion1(shifted)).toEqual(projectCoverageVectorToVersion1(vector))
  })

  it('projects the six carried dimensions with their limiting reasons intact', () => {
    const vector = CoverageVectorV2Schema.parse(
      withDimension('source_diversity', { value: null, limiting_reason: 'SINGLE_SOURCE_ONLY' }),
    )
    const projection = projectCoverageVectorToVersion1(vector)
    expect(Object.keys(projection).sort()).toEqual([...COVERAGE_VECTOR_V1_DIMENSIONS].sort())
    expect(projection.source_diversity).toEqual({ value: null, limiting_reason: 'SINGLE_SOURCE_ONLY' })
    // EvidenceConfidence cannot carry the reason, only the null.
    expect(coverageVectorV2ToEvidenceConfidence(vector).sourceDiversity).toBeNull()
  })
})

describe('demo — fixture vector rendering with limiting reasons', () => {
  it('renders a degraded vector with every null explained', () => {
    const vector = CoverageVectorV2Schema.parse({
      permission: { value: 1, limiting_reason: null },
      completeness: { value: 0.82, limiting_reason: null },
      eligibility: { value: 0.9, limiting_reason: null },
      freshness: { value: 0.9, limiting_reason: null },
      censoring_freedom: { value: null, limiting_reason: 'GH_DEPLOY_STATUS_90D_CENSOR' },
      consistency: { value: 0.98, limiting_reason: null },
      sample: { value: 0.6, limiting_reason: null },
      source_diversity: { value: 0.5, limiting_reason: 'SINGLE_SOURCE_ONLY' },
      parser_coverage: { value: 0.71, limiting_reason: null },
      comparability: { value: 1, limiting_reason: null },
      drift_stability: { value: null, limiting_reason: 'NO_RECOLLECTION_SERIES' },
      calibration: { value: null, limiting_reason: 'NO_RESOLVED_QUESTIONS' },
    })

    const rendered = COVERAGE_DIMENSIONS.map((dimension) => {
      const entry = vector[dimension]
      const shown = entry.value === null ? 'null' : entry.value.toFixed(2)
      const because = entry.limiting_reason === null ? '' : `  <- ${entry.limiting_reason}`
      return `${dimension.padEnd(18)} ${shown.padStart(5)}${because}`
    }).join('\n')

    expect(rendered).toMatchInlineSnapshot(`
      "permission          1.00
      completeness        0.82
      eligibility         0.90
      freshness           0.90
      censoring_freedom   null  <- GH_DEPLOY_STATUS_90D_CENSOR
      consistency         0.98
      sample              0.60
      source_diversity    0.50  <- SINGLE_SOURCE_ONLY
      parser_coverage     0.71
      comparability       1.00
      drift_stability     null  <- NO_RECOLLECTION_SERIES
      calibration         null  <- NO_RESOLVED_QUESTIONS"
    `)

    expect(listLimitingDimensions(vector)).toEqual([
      'censoring_freedom',
      'source_diversity',
      'drift_stability',
      'calibration',
    ])
    // Every null in the render is explained; no null is ever bare.
    for (const dimension of COVERAGE_DIMENSIONS) {
      if (vector[dimension].value === null) {
        expect(vector[dimension].limiting_reason).not.toBeNull()
      }
    }
  })
})
