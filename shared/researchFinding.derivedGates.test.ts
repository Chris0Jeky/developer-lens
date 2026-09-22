import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GATES,
  RESEARCH_FINDING_DELAY_BUDGET_WEEKS,
  RESEARCH_FINDING_DETECTION_FLOOR,
  ResearchFindingSchema,
  computeResearchFindingBundleHash,
} from './researchFinding.js'

const fixturePath = resolve('research-contracts', 'research-finding', 'v1', 'wbc1.fixture.json')
const sourceFixturePath = resolve('research-contracts', 'method-trial-view', 'v1', 'wbc1.fixture.json')
const readFixture = async () => JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, any>

// A forged projection recomputes bundle_hash, so integrity alone never catches a verdict that the
// artifact's own evidence contradicts. Every case below reseals the artifact before parsing.
function reseal(finding: Record<string, any>): Record<string, any> {
  finding.provenance.bundle_hash = computeResearchFindingBundleHash(finding as any)
  return finding
}
const gateOf = (finding: Record<string, any>, code: string) => finding.gates.find((gate: any) => gate.code === code)
const metricOf = (finding: Record<string, any>, key: string) => finding.metrics.find((metric: any) => metric.key === key)
const issues = (finding: Record<string, any>): string[] => {
  const result = ResearchFindingSchema.safeParse(finding)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('ResearchFindingProjection.v1 derived gates (#319, #321, #327)', () => {
  it('rejects every forged gate from the #319 reproduction', async () => {
    const fixture = await readFixture()
    const mutate = (change: (finding: Record<string, any>) => void) => {
      const finding = structuredClone(fixture)
      change(finding)
      return reseal(finding)
    }
    const cases: Array<[string, (finding: Record<string, any>) => void, RegExp]> = [
      ['baseline_selection flipped false->true', (f) => { gateOf(f, 'baseline_selection').passed = true }, /baseline_selection must derive from the projected threshold viability/],
      ['candidate_selection flipped false->true', (f) => { gateOf(f, 'candidate_selection').passed = true }, /candidate_selection must derive from the projected threshold viability/],
      ['delay_budget flipped true->false', (f) => { gateOf(f, 'delay_budget').passed = false }, /delay_budget must derive from the projected metric evidence/],
      ['confound_guard flipped true->false', (f) => { gateOf(f, 'confound_guard').passed = false }, /confound_guard must derive from the projected metric evidence/],
    ]
    for (const [label, change, message] of cases) {
      expect(issues(mutate(change)).join('\n'), label).toMatch(message)
    }
    const allNull = issues(mutate((f) => {
      for (const code of ['baseline_selection', 'candidate_selection', 'delay_budget', 'confound_guard']) gateOf(f, code).passed = null
    }))
    for (const code of ['baseline_selection', 'candidate_selection', 'delay_budget', 'confound_guard']) {
      expect(allNull.some((message) => message.startsWith(`${code} must derive`)), `all four null: ${code}`).toBe(true)
    }
  })

  it('derives delay_budget and confound_guard exactly as the source contract scores them', async () => {
    const fixture = await readFixture()
    const mutate = (change: (finding: Record<string, any>) => void) => {
      const finding = structuredClone(fixture)
      change(finding)
      return reseal(finding)
    }
    expect(RESEARCH_FINDING_DELAY_BUDGET_WEEKS).toBe(8)
    for (const [candidate, passed] of [[8, true], [8.5, false]] as const) {
      const derived = mutate((f) => {
        metricOf(f, 'median_detection_delay_weeks').candidate = { status: 'measured', value: candidate }
        gateOf(f, 'delay_budget').passed = passed
      })
      expect(ResearchFindingSchema.safeParse(derived).success, `delay ${candidate}`).toBe(true)
      gateOf(derived, 'delay_budget').passed = !passed
      expect(ResearchFindingSchema.safeParse(reseal(derived)).success, `delay ${candidate} forged`).toBe(false)
    }
    // The delay budget is a candidate-only rule, so an unavailable baseline still yields a verdict.
    const noDelayBaseline = mutate((f) => { metricOf(f, 'median_detection_delay_weeks').baseline = { status: 'unavailable' } })
    expect(ResearchFindingSchema.safeParse(noDelayBaseline).success).toBe(true)
    for (const [candidate, passed] of [[0.5, true], [0.51, false]] as const) {
      const derived = mutate((f) => {
        metricOf(f, 'coverage_confound_false_alert_rate').candidate = { status: 'measured', value: candidate }
        gateOf(f, 'confound_guard').passed = passed
      })
      expect(ResearchFindingSchema.safeParse(derived).success, `confound ${candidate}`).toBe(true)
    }

    // An unavailable or absent supporting measurement requires null, never a boolean verdict.
    for (const [gateCode, metricKey, side] of [
      ['delay_budget', 'median_detection_delay_weeks', 'candidate'],
      ['confound_guard', 'coverage_confound_false_alert_rate', 'candidate'],
      ['confound_guard', 'coverage_confound_false_alert_rate', 'baseline'],
    ] as const) {
      for (const forged of [true, false]) {
        const artifact = mutate((f) => {
          metricOf(f, metricKey)[side] = { status: 'unavailable' }
          gateOf(f, gateCode).passed = forged
        })
        expect(issues(artifact).join('\n'), `${gateCode}/${side}/${forged}`).toMatch(new RegExp(`${gateCode} must be null when its supporting measurement is unavailable`))
      }
      const nulled = mutate((f) => {
        metricOf(f, metricKey)[side] = { status: 'unavailable' }
        gateOf(f, gateCode).passed = null
      })
      expect(ResearchFindingSchema.safeParse(nulled).success, `${gateCode}/${side}/null`).toBe(true)
    }
    for (const [gateCode, metricKey] of [['delay_budget', 'median_detection_delay_weeks'], ['confound_guard', 'coverage_confound_false_alert_rate']] as const) {
      const absent = mutate((f) => { f.metrics = f.metrics.filter((metric: any) => metric.key !== metricKey) })
      expect(issues(absent).join('\n'), `${metricKey} absent`).toMatch(new RegExp(`${gateCode} must be null`))
    }
  })

  it('derives the selection gates from threshold_viability and nulls them when it is absent', async () => {
    const fixture = await readFixture()
    const bothViable = structuredClone(fixture)
    bothViable.threshold_viability = { baseline: true, candidate: true }
    gateOf(bothViable, 'baseline_selection').passed = true
    gateOf(bothViable, 'candidate_selection').passed = true
    bothViable.limitations = bothViable.limitations.filter((item: any) => item.code !== 'thresholds_nonviable')
    expect(ResearchFindingSchema.safeParse(reseal(bothViable)).success).toBe(true)

    const noViability = structuredClone(fixture)
    delete noViability.threshold_viability
    expect(issues(reseal(noViability)).join('\n')).toMatch(/baseline_selection must be null when threshold_viability is absent/)
    gateOf(noViability, 'baseline_selection').passed = null
    gateOf(noViability, 'candidate_selection').passed = null
    noViability.limitations = noViability.limitations.filter((item: any) => item.code !== 'thresholds_nonviable')
    expect(ResearchFindingSchema.safeParse(reseal(noViability)).success).toBe(true)
  })

  it('binds thresholds_nonviable to both selection gates failing, in both directions', async () => {
    const fixture = await readFixture()
    const requires = /thresholds_nonviable requires both selection gates to have failed/
    const required = /thresholds_nonviable is required when both selection gates have failed/

    const oneViable = structuredClone(fixture)
    oneViable.threshold_viability.candidate = true
    gateOf(oneViable, 'candidate_selection').passed = true
    expect(issues(reseal(oneViable)).join('\n')).toMatch(requires)
    oneViable.limitations = oneViable.limitations.filter((item: any) => item.code !== 'thresholds_nonviable')
    expect(ResearchFindingSchema.safeParse(reseal(oneViable)).success).toBe(true)

    const bothViable = structuredClone(fixture)
    bothViable.threshold_viability = { baseline: true, candidate: true }
    gateOf(bothViable, 'baseline_selection').passed = true
    gateOf(bothViable, 'candidate_selection').passed = true
    expect(issues(reseal(bothViable)).join('\n')).toMatch(requires)

    const noGates = structuredClone(fixture)
    delete noGates.gates
    expect(issues(reseal(noGates)).join('\n')).toMatch(requires)

    const missing = structuredClone(fixture)
    missing.limitations = missing.limitations.filter((item: any) => item.code !== 'thresholds_nonviable')
    expect(issues(reseal(missing)).join('\n')).toMatch(required)
  })

  it('pins the weaker false_alert_improvement rule at the source-divergence interval (#321)', async () => {
    const fixture = await readFixture()
    expect(GATES.false_alert_improvement).toBe('Candidate false alerts are lower than baseline')
    const divergent = structuredClone(fixture)
    metricOf(divergent, 'false_alerts_per_year').baseline = { status: 'measured', value: 3.0 }
    metricOf(divergent, 'false_alerts_per_year').candidate = { status: 'measured', value: 2.9 }
    // The source view scores this interval `fail` (2.9 <= 3.0 * 0.8 is false); the projection's
    // gate states only that candidate false alerts are lower, so it must pass here.
    gateOf(divergent, 'false_alert_improvement').passed = true
    const parsed = ResearchFindingSchema.parse(reseal(divergent))
    expect(parsed.gates?.find((gate) => gate.code === 'false_alert_improvement')?.passed).toBe(true)
    gateOf(divergent, 'false_alert_improvement').passed = false
    expect(issues(reseal(divergent)).join('\n')).toMatch(/false_alert_improvement must derive from the projected metric evidence/)
  })

  it('carries the source view evidence and verdicts for the WB-C1 fixture', async () => {
    const fixture = await readFixture()
    const source = JSON.parse(await readFile(sourceFixturePath, 'utf8')) as Record<string, any>
    const project = (measurement: Record<string, any>) => measurement.status === 'measured' ? { status: 'measured', value: measurement.value } : { status: 'unavailable' }
    for (const metric of fixture.metrics) {
      expect(metric.baseline, `${metric.key} baseline`).toEqual(project(source.scorecard.baseline[metric.key]))
      expect(metric.candidate, `${metric.key} candidate`).toEqual(project(source.scorecard.candidate[metric.key]))
    }
    expect(fixture.threshold_viability).toEqual({
      baseline: source.scorecard.threshold_selection.baseline.viable,
      candidate: source.scorecard.threshold_selection.candidate.viable,
    })
    const verdict = { pass: true, fail: false, not_applicable: null } as Record<string, boolean | null>
    expect(fixture.gates.map((gate: any) => [gate.code, gate.passed])).toEqual(source.acceptance_gates.map((gate: any) => [gate.code, verdict[gate.outcome]]))
    // The hand-copied preregistered constants must still appear in the source contract's rules.
    const sourceContract = await readFile(resolve('shared', 'methodTrialView.ts'), 'utf8')
    expect(sourceContract).toContain(`evaluate: (_baseline: number, candidate: number) => candidate >= ${RESEARCH_FINDING_DETECTION_FLOOR},`)
    expect(sourceContract).toContain(`evaluate: (_baseline: number, candidate: number) => candidate <= ${RESEARCH_FINDING_DELAY_BUDGET_WEEKS},`)
    expect(sourceContract).toContain('evaluate: (baseline: number, candidate: number) => candidate <= baseline,')
  })
})
