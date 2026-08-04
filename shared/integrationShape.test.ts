import { describe, expect, it } from 'vitest'
import {
  ABSTENTION_COMPARISON,
  BASELINE_RESULT,
  CURRENT_GOLDEN,
  CURRENT_RESULT,
  EMPTY_COMPARISON,
  FULL_COMPARISON,
  INCOMPARABLE_COMPARISON,
  INTEGRATION_SHAPE_SCOPE_ALIAS,
  INTEGRATION_SHAPE_SCOPE_ID,
  MATCHED_PARTIAL_COMPARISON,
  buildIntegrationShapeFinding,
  buildIntegrationShapePresentation,
  compositionConformsToGolden,
  secondsToDayLabel,
} from './integrationShape.js'
import { constructSignature } from './conformance.js'
import { validateMetricResult } from './metrics.js'

/**
 * DL-VALUE-01 composition suite. Proves the invented fixtures produce exactly the hand-verified,
 * registry-conformant results, that the three-outcome comparison behaves, and that the alias is
 * carried by the metric layer but never by the finding.
 */

describe('integration-shape composition — registry-conformant metric results', () => {
  it('reproduces the hand-verified golden construct signature for the current window', () => {
    expect(compositionConformsToGolden()).toBe(true)
    expect(constructSignature(CURRENT_RESULT)).toEqual(CURRENT_GOLDEN)
  })

  it('computes the current window: 10 eligible, 3 censored, a merged sample of 6 below eligible − censored', () => {
    expect(CURRENT_RESULT.state).toBe('observed')
    expect(CURRENT_RESULT.counts.eligible).toBe(10)
    expect(CURRENT_RESULT.counts.censored).toBe(3)
    // A close without merge (competing outcome) keeps the sample strictly below eligible − censored.
    expect(CURRENT_RESULT.value.kind).toBe('quantiles')
    if (CURRENT_RESULT.value.kind === 'quantiles') {
      expect(CURRENT_RESULT.value.sampleSize).toBe(6)
      expect(CURRENT_RESULT.value.sampleSize).toBeLessThan(CURRENT_RESULT.counts.eligible - CURRENT_RESULT.counts.censored)
      expect(CURRENT_RESULT.value.quantiles).toEqual([
        { quantile: 0.5, value: 172800 },
        { quantile: 0.75, value: 345600 },
        { quantile: 0.9, value: 432000 },
      ])
    }
    expect(CURRENT_RESULT.counts.excluded).toEqual([
      { reasonCode: 'BECAME_READY_OUTSIDE_WINDOW', count: 1 },
      { reasonCode: 'MISSING_CREATION_TIMESTAMP', count: 1 },
    ])
  })

  it('computes the baseline window: 8 eligible, 2 censored, a longer merged distribution', () => {
    expect(BASELINE_RESULT.counts.eligible).toBe(8)
    expect(BASELINE_RESULT.counts.censored).toBe(2)
    if (BASELINE_RESULT.value.kind === 'quantiles') {
      expect(BASELINE_RESULT.value.quantiles).toEqual([
        { quantile: 0.5, value: 345600 },
        { quantile: 0.75, value: 604800 },
        { quantile: 0.9, value: 864000 },
      ])
    }
  })

  it('carries both declared sensitivity variants and still passes the registry result gate', () => {
    expect(() => validateMetricResult(CURRENT_RESULT)).not.toThrow()
    const variants = CURRENT_RESULT.sensitivity.map((entry) => entry.variantId).sort()
    expect(variants).toEqual(['EXCLUDE_LONG_TAIL', 'OPEN_TREATED_AS_CENSORED'])
  })
})

describe('integration-shape composition — matched comparison, three outcomes', () => {
  it('the headline is a FULL comparison with a lower current distribution at every quantile', () => {
    expect(FULL_COMPARISON.outcome).toBe('FULL')
    expect(FULL_COMPARISON.matchedFraction).toBe(1)
    if (FULL_COMPARISON.outcome === 'FULL' && FULL_COMPARISON.value.kind === 'quantile_delta') {
      expect(FULL_COMPARISON.value.quantiles.map((entry) => entry.delta)).toEqual([-172800, -259200, -432000])
      expect(FULL_COMPARISON.counts.eligibleDelta).toBe(2)
      expect(FULL_COMPARISON.counts.censoredDelta).toBe(1)
      expect(FULL_COMPARISON.limitations.map((entry) => entry.code)).toEqual([
        'CENSORED_TAILS_EXCLUDED',
        'UNEQUAL_CENSORING_BETWEEN_SIDES',
      ])
    }
  })

  it('a tail config-revision change yields MATCHED_PARTIAL carrying the mandatory selection-bias limitation', () => {
    expect(MATCHED_PARTIAL_COMPARISON.outcome).toBe('MATCHED_PARTIAL')
    if (MATCHED_PARTIAL_COMPARISON.outcome === 'MATCHED_PARTIAL') {
      expect(MATCHED_PARTIAL_COMPARISON.matchedFraction).toBeGreaterThan(0.8)
      expect(MATCHED_PARTIAL_COMPARISON.matchedFraction).toBeLessThan(1)
      expect(MATCHED_PARTIAL_COMPARISON.limitations.map((entry) => entry.code)).toContain('MATCHED_SUBWINDOW_SELECTION_BIAS')
      expect(MATCHED_PARTIAL_COMPARISON.residual.length).toBeGreaterThan(0)
    }
  })

  it('a large config-revision change is INCOMPARABLE, never a zero delta', () => {
    expect(INCOMPARABLE_COMPARISON.outcome).toBe('INCOMPARABLE')
    if (INCOMPARABLE_COMPARISON.outcome === 'INCOMPARABLE') {
      expect(INCOMPARABLE_COMPARISON.reasonCode).toBe('MATCHED_FRACTION_BELOW_MINIMUM')
      expect(INCOMPARABLE_COMPARISON).not.toHaveProperty('value')
    }
  })

  it('an empty current cohort is a real count difference and a typed absence of a distribution delta (#67)', () => {
    expect(EMPTY_COMPARISON.outcome).toBe('FULL')
    if (EMPTY_COMPARISON.outcome === 'FULL') {
      expect(EMPTY_COMPARISON.counts.current.eligible).toBe(0)
      expect(EMPTY_COMPARISON.counts.eligibleDelta).toBe(-8)
      expect(EMPTY_COMPARISON.value).toEqual({ kind: 'no_value', reasonCode: 'EMPTY_SIDE_NO_DISTRIBUTION' })
      expect(EMPTY_COMPARISON.limitations.map((entry) => entry.code)).toContain('EMPTY_COHORT_SIDE')
    }
  })

  it('a below-support current window refuses the delta rather than fabricating one', () => {
    expect(ABSTENTION_COMPARISON.outcome).toBe('FULL')
    if (ABSTENTION_COMPARISON.outcome === 'FULL') {
      expect(ABSTENTION_COMPARISON.value).toEqual({ kind: 'no_value', reasonCode: 'SUPPORT_GATE_FAILED' })
    }
  })
})

describe('integration-shape composition — censoring-aware sensitivity', () => {
  it('reverses the ninetieth-percentile direction when open pull requests are treated as observed-so-far', () => {
    const sensitivity = buildIntegrationShapePresentation().sensitivity
    expect(sensitivity.quantiles).toEqual([
      { quantile: 0.5, current: 345600, baseline: 345600, delta: 0 },
      { quantile: 0.75, current: 604800, baseline: 604800, delta: 0 },
      { quantile: 0.9, current: 1036800, baseline: 864000, delta: 172800 },
    ])
    // The headline p90 difference is negative; the sensitivity p90 difference is positive.
    if (FULL_COMPARISON.outcome === 'FULL' && FULL_COMPARISON.value.kind === 'quantile_delta') {
      expect(FULL_COMPARISON.value.quantiles[2].delta).toBeLessThan(0)
    }
    expect(sensitivity.quantiles[2].delta).toBeGreaterThan(0)
  })
})

describe('integration-shape composition — the alias→surrogate strip point', () => {
  it('carries the alias on the metric results but never on the finding', () => {
    expect(CURRENT_RESULT.scopeAlias).toBe(INTEGRATION_SHAPE_SCOPE_ALIAS)
    const finding = buildIntegrationShapeFinding()
    expect(finding.scopeId).toBe(INTEGRATION_SHAPE_SCOPE_ID)
    expect(JSON.stringify(finding)).not.toContain(INTEGRATION_SHAPE_SCOPE_ALIAS)
    expect(finding.scopeId).not.toBe(INTEGRATION_SHAPE_SCOPE_ALIAS)
  })
})

describe('integration-shape composition — copy discipline helpers', () => {
  it('formats day labels with an explicit sign and never a causal or evaluative word', () => {
    expect(secondsToDayLabel(-172800)).toBe('-2.0 d')
    expect(secondsToDayLabel(172800)).toBe('+2.0 d')
    expect(secondsToDayLabel(0)).toBe('0.0 d')
  })
})
