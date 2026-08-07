import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { renderMethodTrialViewSchema, schemaSha256 } from '../scripts/generateMethodTrialView.js'
import {
  METHOD_TRIAL_EVIDENCE_LABEL,
  METHOD_TRIAL_QUESTION,
  METHOD_TRIAL_TITLE,
  MethodTrialViewSchema,
} from './methodTrialView.js'

const schemaPath = resolve('research-contracts', 'method-trial-view', 'v1', 'schema.json')
const fixturePath = resolve('research-contracts', 'method-trial-view', 'v1', 'wbc1.fixture.json')
const digest = `sha256:${'a'.repeat(64)}`
const commit = 'b'.repeat(40)

function measured(value: number) {
  return { status: 'measured' as const, value }
}

function unavailable(
  reason: 'insufficient_support' | 'not_applicable' | 'not_measured' | 'warmup' | 'missing_observation' = 'not_measured',
) {
  return { status: 'unavailable' as const, reason }
}

type TestMeasurement = ReturnType<typeof measured> | ReturnType<typeof unavailable>
type MutableGate = {
  outcome: 'pass' | 'fail' | 'not_applicable'
  relevant_values?: { baseline: TestMeasurement; candidate: TestMeasurement }
}

function point(index: number, scenario: 'control' | 'planted' | 'confound') {
  const missing = index === 2
  return {
    relative_week_index: index,
    relative_week_label: `week-${String(index).padStart(3, '0')}`,
    observed: missing
      ? ({ state: 'missing', reason: 'not_collected' } as const)
      : ({ state: 'observed', value: 10 + index / 10 } as const),
    planted_marker: scenario === 'planted' && index === 4 ? ('level' as const) : ('none' as const),
    confound_marker:
      scenario === 'confound' && index === 4 ? ('parser_shift' as const) : ('none' as const),
    baseline: {
      alert: !missing && index === 5,
      score: missing ? unavailable() : measured(0.2),
      threshold: measured(2.5),
    },
    candidate: {
      probability: missing ? unavailable() : measured(0.2),
      alert: !missing && index === 6,
      threshold: measured(0.05),
    },
    pelt_marker: {
      evaluation_mode: 'offline_descriptive' as const,
      boundary: scenario !== 'control' && index === 4,
    },
  }
}

function representativeCase(
  order: 1 | 2 | 3,
  scenario: 'no_change_control' | 'planted_change' | 'instrumentation_confound',
) {
  const kind =
    scenario === 'planted_change'
      ? ('planted' as const)
      : scenario === 'instrumentation_confound'
        ? ('confound' as const)
        : ('control' as const)
  const selectionCode =
    scenario === 'no_change_control'
      ? ('fixed_first_window' as const)
      : scenario === 'planted_change'
        ? ('fixed_change_window' as const)
        : ('fixed_confound_window' as const)
  return {
    order,
    selection_rule: {
      code: selectionCode,
      label: 'Final holdout series selected by the declared deterministic rule',
      deterministic: true as const,
    },
    role: scenario,
    scenario_code: scenario === 'no_change_control' ? 'no_change' : scenario === 'planted_change' ? 'level' : 'parser_shift',
    title: scenario.replaceAll('_', ' '),
    summary: 'A bounded invented window selected by a declared deterministic rule.',
    points: Array.from({ length: 104 }, (_, index) => point(index, kind)),
  }
}

function sample() {
  return {
    schema_version: 'DeveloperLensMethodTrialView.v1' as const,
    trial: {
      trial_id: 'trial-wbc1c0v1',
      title: METHOD_TRIAL_TITLE,
      question: METHOD_TRIAL_QUESTION,
      classification: 'C0' as const,
      evidence_label: METHOD_TRIAL_EVIDENCE_LABEL,
    },
    dataset: {
      system_count: 54,
      weekly_opportunity_count: 5_616,
      observed_count: 5_346,
      absent_count: 270,
      scenario_codes: [
        'no_change',
        'level',
        'variance',
        'slope',
        'seasonal_amplitude',
        'heavy_tailed_no_change',
        'coverage_gap',
        'permission_shift',
        'parser_shift',
      ] as const,
      limitations: [
        'Invented systems demonstrate mechanics rather than real-world validity.',
        'Three deterministic windows summarize a larger synthetic benchmark.',
      ],
    },
    methods: {
      baseline: {
        role: 'baseline' as const,
        method_code: 'rolling_median_mad' as const,
        display_name: 'Rolling median and MAD baseline',
        description: 'A deterministic robust weekly baseline with a complete fallback.',
        deterministic: true,
        parameter_summary: 'Rolling window with a median absolute deviation threshold.',
      },
      candidate: {
        role: 'candidate' as const,
        method_code: 'bocpd_gaussian' as const,
        display_name: 'Gaussian BOCPD candidate',
        description: 'A deterministic online posterior change-probability candidate.',
        deterministic: true,
        parameter_summary: 'Fixed-prior Gaussian online change probability.',
      },
      offline_pelt: {
        role: 'offline_descriptive' as const,
        method_code: 'pelt' as const,
        display_name: 'PELT offline description',
        description: 'Offline boundary evidence for explanation only, never online promotion.',
        deterministic: true,
        parameter_summary: 'Offline descriptive boundary localization.',
      },
    },
    scorecard: {
      baseline: {
        false_alerts_per_year: measured(2.966666666666667),
        detection_rate: measured(0.75),
        median_detection_delay_weeks: measured(2),
        coverage_confound_false_alert_rate: measured(0.5),
        calibration_brier: unavailable('not_applicable'),
      },
      candidate: {
        false_alerts_per_year: measured(4.2),
        detection_rate: measured(0.75),
        median_detection_delay_weeks: measured(1),
        coverage_confound_false_alert_rate: measured(0.5),
        calibration_brier: measured(0.017341137335170863),
      },
      threshold_selection: {
        baseline: {
          viable: false,
          selected_value: measured(2.5),
          reason_code: 'frozen_best_available' as const,
          summary: 'No stable baseline configuration met the declared selection gate.',
        },
        candidate: {
          viable: false,
          selected_value: measured(0.05),
          reason_code: 'frozen_best_available' as const,
          summary: 'No stable candidate configuration met the declared selection gate.',
        },
      },
    },
    acceptance_gates: [
      {
        order: 1,
        code: 'baseline_selection',
        label: 'Baseline selection viable',
        outcome: 'fail',
        reason_code: 'BASELINE_SELECTION_VIABLE',
        reason: 'The baseline threshold is frozen best available but not viable.',
      },
      {
        order: 2,
        code: 'candidate_selection',
        label: 'Candidate selection viable',
        outcome: 'fail',
        reason_code: 'CANDIDATE_SELECTION_VIABLE',
        reason: 'The candidate threshold is frozen best available but not viable.',
      },
      {
        order: 3,
        code: 'detection_floor',
        label: 'Candidate detection floor',
        outcome: 'pass',
        reason_code: 'CANDIDATE_DETECTION_FLOOR',
        reason: 'The candidate reaches the preregistered detection floor.',
        relevant_values: { baseline: measured(0.75), candidate: measured(0.75) },
      },
      {
        order: 4,
        code: 'delay_budget',
        label: 'Candidate delay budget',
        outcome: 'pass',
        reason_code: 'CANDIDATE_DELAY_BUDGET',
        reason: 'The candidate median delay remains inside the declared budget.',
        relevant_values: { baseline: measured(2), candidate: measured(1) },
      },
      {
        order: 5,
        code: 'false_alert_improvement',
        label: 'Candidate false-alert improvement',
        outcome: 'fail',
        reason_code: 'CANDIDATE_FALSE_ALERT_IMPROVEMENT',
        reason: 'The candidate produced more false alerts per year than the baseline.',
        relevant_values: {
          baseline: measured(2.966666666666667),
          candidate: measured(4.2),
        },
      },
      {
        order: 6,
        code: 'not_worse_detection',
        label: 'Candidate not-worse detection',
        outcome: 'pass',
        reason_code: 'CANDIDATE_NOT_WORSE_DETECTION',
        reason: 'Candidate detection is not worse than baseline.',
        relevant_values: { baseline: measured(0.75), candidate: measured(0.75) },
      },
      {
        order: 7,
        code: 'confound_guard',
        label: 'Candidate confound guard',
        outcome: 'pass',
        reason_code: 'CANDIDATE_CONFOUND_GUARD',
        reason: 'Candidate coverage-confound false-alert rate does not exceed the baseline.',
        relevant_values: { baseline: measured(0.5), candidate: measured(0.5) },
      },
    ] as const,
    decision: {
      outcome: 'reject' as const,
      candidate_promoted: false,
      fallback: { method_code: 'rolling_median_mad' as const, retained: true },
      reason_codes: [
        'BASELINE_SELECTION_VIABLE',
        'CANDIDATE_SELECTION_VIABLE',
        'CANDIDATE_FALSE_ALERT_IMPROVEMENT',
      ] as const,
      summary: 'Reject Gaussian BOCPD for this bounded C0 trial and retain the deterministic fallback.',
      why_simple_baseline_won:
        'Detection was equal, the candidate produced more false alerts, and neither selected configuration was viable.',
    },
    representative_cases: [
      representativeCase(1, 'no_change_control'),
      representativeCase(2, 'planted_change'),
      representativeCase(3, 'instrumentation_confound'),
    ],
    representative_selection: {
      version: 'wbc1-final-holdout-v1' as const,
      partition: 'final_holdout' as const,
      planted_preference: ['level', 'slope', 'variance', 'seasonal_amplitude'] as const,
      confound_preference: ['parser_shift', 'coverage_gap', 'permission_shift'] as const,
      tie_break: 'lexicographically_lowest_stable_opaque_alias' as const,
      missing_role_policy: 'fail_export' as const,
      aliases_not_exposed: true as const,
    },
    claims: {
      supported: [
        {
          code: 'same_detection_on_c0' as const,
          display_text: 'Both online methods reached 0.75 detection on this invented benchmark.',
        },
        {
          code: 'candidate_more_false_alerts_on_c0' as const,
          display_text: 'The candidate produced more false alerts per year than the baseline.',
        },
      ],
      unsupported: [
        {
          code: 'real_repository_validity' as const,
          display_text: 'The result does not establish validity on real repositories.',
        },
        {
          code: 'model_promotion' as const,
          display_text: 'The result does not authorize model promotion.',
        },
      ],
      limitations: [
        {
          code: 'c0_synthetic_only' as const,
          display_text: 'All evidence is invented C0 material.',
        },
        {
          code: 'bounded_three_case_selection' as const,
          display_text: 'Three declared deterministic windows illustrate the larger run.',
        },
      ],
    },
    deferred_caveats: [
      { code: 'missingness_confound_observability', display_text: 'Missingness and confounds limit observability.' },
      { code: 'validation_artifact_lifecycle', display_text: 'Validation artifacts require explicit lifecycle handling.' },
      { code: 'threshold_selection_workload_counts', display_text: 'Threshold workload counts remain bounded to this run.' },
      { code: 'corrupt_manifest_failure', display_text: 'Corrupt manifests must fail export closed.' },
      { code: 'primary_domain_metric_enforcement', display_text: 'The primary domain metric remains explicitly enforced.' },
      { code: 'zero_delay_fallback_ordering', display_text: 'Zero-delay fallback ordering remains a known caveat.' },
    ],
    reproducibility: {
      product_contract_commit: commit,
      product_research_pack_commit: commit,
      lab_commit: commit,
      run_id: 'wbc1_demo',
      recipe_code: 'wbc1-smoke-c0-v1' as const,
      digests: {
        schema: digest,
        evaluation_bundle: digest,
        custody: digest,
        research_pack: digest,
      },
      commands: {
        benchmark: 'uv run dllab benchmark wb-c1 --smoke --run-id wbc1_demo',
        reproduce: 'uv run dllab run reproduce wbc1_demo',
        export: 'uv run dllab export method-trial wbc1_demo',
        report: 'uv run dllab report build wbc1_demo',
      },
      verification: {
        local: 'passed' as const,
        product_hosted: 'not_run' as const,
        lab_hosted: 'not_run' as const,
      },
    },
  }
}

async function standaloneValidator() {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema)
}

function replaceAtPath(root: unknown, path: readonly PropertyKey[], replacement: string): void {
  let cursor = root as Record<PropertyKey, unknown>
  for (const segment of path.slice(0, -1)) {
    cursor = cursor[segment] as Record<PropertyKey, unknown>
  }
  cursor[path.at(-1)!] = replacement
}

describe('DeveloperLensMethodTrialView.v1', () => {
  it('accepts the exact committed lab fixture in runtime and standalone validators', async () => {
    const fixtureText = await readFile(fixturePath, 'utf8')
    const fixture = JSON.parse(fixtureText)
    const parsed = MethodTrialViewSchema.parse(fixture)
    const validate = await standaloneValidator()

    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true)
    expect(createHash('sha256').update(fixtureText, 'utf8').digest('hex')).toBe(
      'afcc1ed9535d9b22fb399375027792489ce6b97949f8f684682943c11152b5f9',
    )
    expect(fixtureText.endsWith('\n')).toBe(true)
    expect(fixtureText.endsWith('\n\n')).toBe(false)
    expect(fixtureText).not.toContain('"system_alias"')
    expect(fixtureText).not.toContain('"generator_seed"')
    expect(parsed.reproducibility.product_contract_commit).toBe(
      'b48fea579936671397a0486ae7a0342197ee6e4b',
    )
    expect(parsed.reproducibility.lab_commit).toBe('0ef193070a9b80b81cef5a1710a1d65e0b271c15')
    expect(parsed.reproducibility.run_id).toBe('wbc1_demo')
    expect(parsed.reproducibility.verification.local).toBe('not_run')
    expect(parsed.reproducibility.digests.schema).toBe(
      'sha256:634b0cc7a0c3dbcefe8b9cf258e157695beae06d08cc9d02bb781a4267f633ef',
    )
    expect(parsed.reproducibility.digests.schema).toBe(schemaSha256())
    expect(parsed.reproducibility.digests.evaluation_bundle).toBe(
      'sha256:e925c8ac44d914ce0003ef218d90187535eedfef3eb8d436a3c9a135e3d1a3a9',
    )
    expect(parsed.dataset).toMatchObject({
      system_count: 54,
      weekly_opportunity_count: 5616,
      observed_count: 5346,
      absent_count: 270,
    })
    expect(parsed.scorecard.baseline.false_alerts_per_year).toEqual(measured(2.966666666666667))
    expect(parsed.scorecard.candidate.false_alerts_per_year).toEqual(measured(4.2))
    expect(parsed.scorecard.baseline.detection_rate).toEqual(measured(0.75))
    expect(parsed.scorecard.candidate.detection_rate).toEqual(measured(0.75))
    expect(parsed.scorecard.baseline.median_detection_delay_weeks).toEqual(measured(2))
    expect(parsed.scorecard.candidate.median_detection_delay_weeks).toEqual(measured(1))
    expect(parsed.scorecard.baseline.coverage_confound_false_alert_rate).toEqual(measured(0.5))
    expect(parsed.scorecard.candidate.coverage_confound_false_alert_rate).toEqual(measured(0.5))
    expect(parsed.scorecard.candidate.calibration_brier).toEqual(measured(0.017341137335170863))
    expect(parsed.scorecard.threshold_selection).toMatchObject({
      baseline: { viable: false, selected_value: measured(2.5) },
      candidate: { viable: false, selected_value: measured(0.05) },
    })
    expect(parsed.acceptance_gates.map((gate) => gate.outcome)).toEqual([
      'fail',
      'fail',
      'pass',
      'pass',
      'fail',
      'pass',
      'pass',
    ])
    expect(parsed.decision.outcome).toBe('reject')
    expect(parsed.decision.candidate_promoted).toBe(false)
    expect(parsed.decision.fallback).toEqual({ method_code: 'rolling_median_mad', retained: true })
    expect(parsed.decision.reason_codes).toEqual([
      'BASELINE_SELECTION_VIABLE',
      'CANDIDATE_SELECTION_VIABLE',
      'CANDIDATE_FALSE_ALERT_IMPROVEMENT',
    ])
    expect(parsed.representative_selection).toMatchObject({
      version: 'wbc1-final-holdout-v1',
      partition: 'final_holdout',
      planted_preference: ['level', 'slope', 'variance', 'seasonal_amplitude'],
      confound_preference: ['parser_shift', 'coverage_gap', 'permission_shift'],
      tie_break: 'lexicographically_lowest_stable_opaque_alias',
      missing_role_policy: 'fail_export',
      aliases_not_exposed: true,
    })
    expect(parsed.representative_cases.map((representativeCase) => representativeCase.role)).toEqual([
      'no_change_control',
      'planted_change',
      'instrumentation_confound',
    ])
    expect(
      parsed.representative_cases.map(({ scenario_code, points }) => [
        scenario_code,
        points.length,
        points[0]?.relative_week_label,
        points.at(-1)?.relative_week_label,
      ]),
    ).toEqual([
      ['no_change', 104, 'week-000', 'week-103'],
      ['level', 104, 'week-000', 'week-103'],
      ['parser_shift', 104, 'week-000', 'week-103'],
    ])
    expect(parsed.representative_cases[2].summary).toBe(
      'The full 104-week holdout series exposes an instrument shift explicitly.',
    )
  })

  it('accepts the invented presentation sample in runtime and standalone validators', async () => {
    const value = sample()
    const parsed = MethodTrialViewSchema.safeParse(value)
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true)
    const schemaText = await readFile(schemaPath, 'utf8')
    expect(schemaText).toBe(renderMethodTrialViewSchema())
    expect((await standaloneValidator())(value)).toBe(true)
  })

  it('rejects unknown fields, missing-state inconsistencies, and unavailable fake zeroes', async () => {
    const validate = await standaloneValidator()

    const unknown = { ...sample(), unexpected: true }
    expect(MethodTrialViewSchema.safeParse(unknown).success).toBe(false)
    expect(validate(unknown)).toBe(false)

    const missing = structuredClone(sample())
    missing.representative_cases[0].points[2].candidate.alert = true
    expect(MethodTrialViewSchema.safeParse(missing).success).toBe(false)
    expect(validate(missing)).toBe(false)

    const missingScore = structuredClone(sample())
    missingScore.representative_cases[0].points[2].baseline.score = measured(0.1)
    expect(MethodTrialViewSchema.safeParse(missingScore).success).toBe(false)
    expect(validate(missingScore)).toBe(false)

    const noFallback = structuredClone(sample())
    delete (noFallback.decision as { fallback?: unknown }).fallback
    expect(MethodTrialViewSchema.safeParse(noFallback).success).toBe(false)
    expect(validate(noFallback)).toBe(false)

    const wrongCandidate = structuredClone(sample())
    ;(wrongCandidate.methods.candidate as { method_code: string }).method_code = 'bocpd'
    expect(MethodTrialViewSchema.safeParse(wrongCandidate).success).toBe(false)
    expect(validate(wrongCandidate)).toBe(false)

    const fakeZero = structuredClone(sample())
    const candidateScore = fakeZero.scorecard.candidate as unknown as Record<string, unknown>
    candidateScore.calibration_brier = {
      status: 'unavailable',
      reason: 'not_measured',
      value: 0,
    }
    expect(MethodTrialViewSchema.safeParse(fakeZero).success).toBe(false)
    expect(validate(fakeZero)).toBe(false)
  })

  it('treats Draft 2020-12 as structural and runtime validation as normative semantics', async () => {
    const validate = await standaloneValidator()

    const mismatchedCommand = structuredClone(sample())
    mismatchedCommand.reproducibility.commands.export =
      'uv run dllab export method-trial wbc1_other'

    const mismatchedGate = structuredClone(sample())
    ;(mismatchedGate.acceptance_gates[5] as unknown as MutableGate).outcome = 'fail'

    const mismatchedRelevantValue = structuredClone(sample())
    ;(
      mismatchedRelevantValue.acceptance_gates[4] as unknown as MutableGate
    ).relevant_values!.candidate = measured(1)

    const mismatchedDecision = structuredClone(sample())
    ;(mismatchedDecision.decision as unknown as { reason_codes: string[] }).reason_codes = [
      'CANDIDATE_FALSE_ALERT_IMPROVEMENT',
    ]

    const unavailableViableThreshold = structuredClone(sample())
    ;(
      unavailableViableThreshold.scorecard.threshold_selection.candidate as unknown as {
        viable: boolean
        selected_value: TestMeasurement
      }
    ).viable = true
    ;(
      unavailableViableThreshold.scorecard.threshold_selection.candidate as unknown as {
        selected_value: TestMeasurement
      }
    ).selected_value = unavailable('not_measured')

    const mismatchedWeekLabel = structuredClone(sample())
    mismatchedWeekLabel.representative_cases[0].points[0].relative_week_label = 'week-001'

    const nonSequentialWeek = structuredClone(sample())
    nonSequentialWeek.representative_cases[0].points[1].relative_week_index = 2

    const markedControl = structuredClone(sample())
    markedControl.representative_cases[0].points[0].planted_marker = 'level'

    const structuralOnlyMutations = [
      ['run-bound command', mismatchedCommand],
      ['derived gate outcome', mismatchedGate],
      ['mirrored gate value', mismatchedRelevantValue],
      ['derived decision reasons', mismatchedDecision],
      ['threshold viability', unavailableViableThreshold],
      ['week label', mismatchedWeekLabel],
      ['sequential week index', nonSequentialWeek],
      ['case-role marker', markedControl],
    ] as const

    for (const [name, value] of structuralOnlyMutations) {
      expect(validate(value), `${name} remains structurally valid`).toBe(true)
      expect(MethodTrialViewSchema.safeParse(value).success, `${name} fails semantics`).toBe(false)
    }

    const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as { $comment?: string }
    expect(schema.$comment).toContain('Structural transport validation only')
    expect(schema.$comment).toContain('before this artifact is accepted or displayed')
  })

  it('rejects permissive or mismatched reproducibility commands', () => {
    for (const field of ['benchmark', 'reproduce', 'export', 'report'] as const) {
      const inlinePassword = structuredClone(sample())
      inlinePassword.reproducibility.commands[field] = `${inlinePassword.reproducibility.commands[field]} --password=secret`
      expect(MethodTrialViewSchema.safeParse(inlinePassword).success).toBe(false)

      const extraFlag = structuredClone(sample())
      extraFlag.reproducibility.commands[field] = `${extraFlag.reproducibility.commands[field]} --extra`
      expect(MethodTrialViewSchema.safeParse(extraFlag).success).toBe(false)

      const mismatchedRun = structuredClone(sample())
      mismatchedRun.reproducibility.commands[field] = mismatchedRun.reproducibility.commands[field].replace(
        'wbc1_demo',
        'wbc1_other',
      )
      expect(MethodTrialViewSchema.safeParse(mismatchedRun).success).toBe(false)
    }
  })

  it('rejects negative measured rates, delays, and thresholds while allowing signed observations', () => {
    const negativeRate = structuredClone(sample())
    negativeRate.scorecard.candidate.false_alerts_per_year = measured(-1)
    expect(MethodTrialViewSchema.safeParse(negativeRate).success).toBe(false)

    const negativeDelay = structuredClone(sample())
    negativeDelay.scorecard.candidate.median_detection_delay_weeks = measured(-1)
    expect(MethodTrialViewSchema.safeParse(negativeDelay).success).toBe(false)

    const negativeThreshold = structuredClone(sample())
    negativeThreshold.scorecard.threshold_selection.candidate.selected_value = measured(-1)
    expect(MethodTrialViewSchema.safeParse(negativeThreshold).success).toBe(false)

    const signedObservation = structuredClone(sample())
    signedObservation.representative_cases[0].points[0].observed = { state: 'observed', value: -1 }
    expect(MethodTrialViewSchema.safeParse(signedObservation).success).toBe(true)
  })

  it('derives gate outcomes and relevant values from WB-C1 evidence', () => {
    const selectionMismatch = structuredClone(sample())
    ;(selectionMismatch.acceptance_gates[0] as unknown as MutableGate).outcome = 'pass'
    expect(MethodTrialViewSchema.safeParse(selectionMismatch).success).toBe(false)

    const outcomeMismatch = structuredClone(sample())
    ;(outcomeMismatch.acceptance_gates[5] as unknown as MutableGate).outcome = 'fail'
    expect(MethodTrialViewSchema.safeParse(outcomeMismatch).success).toBe(false)

    const relevantMismatch = structuredClone(sample())
    ;(relevantMismatch.acceptance_gates[4] as unknown as MutableGate).relevant_values!.candidate = measured(1)
    expect(MethodTrialViewSchema.safeParse(relevantMismatch).success).toBe(false)

    const unavailableMetric = structuredClone(sample())
    const unavailableScorecard = unavailableMetric.scorecard as unknown as {
      candidate: { median_detection_delay_weeks: TestMeasurement }
      baseline: { median_detection_delay_weeks: TestMeasurement }
    }
    unavailableScorecard.candidate.median_detection_delay_weeks = unavailable('not_measured')
    unavailableScorecard.baseline.median_detection_delay_weeks = unavailable('not_measured')
    const unavailableGate = unavailableMetric.acceptance_gates[3] as unknown as MutableGate
    unavailableGate.outcome = 'not_applicable'
    const unavailableValues = {
      baseline: unavailable('not_measured'),
      candidate: unavailable('not_measured'),
    } as unknown as MutableGate['relevant_values']
    unavailableGate.relevant_values = unavailableValues
    expect(MethodTrialViewSchema.safeParse(unavailableMetric).success).toBe(true)
  })

  it('rejects count drift, oversized cases, and reordered scenarios', async () => {
    const validate = await standaloneValidator()

    const countDrift = structuredClone(sample())
    countDrift.dataset.absent_count -= 1
    expect(MethodTrialViewSchema.safeParse(countDrift).success).toBe(false)
    expect(validate(countDrift)).toBe(false)

    const oversized = structuredClone(sample())
    oversized.representative_cases[0].points = Array.from({ length: 105 }, (_, index) =>
      point(index, 'control'),
    )
    expect(MethodTrialViewSchema.safeParse(oversized).success).toBe(false)
    expect(validate(oversized)).toBe(false)

    const short = structuredClone(sample())
    short.representative_cases[0].points = Array.from({ length: 51 }, (_, index) => point(index, 'control'))
    expect(MethodTrialViewSchema.safeParse(short).success).toBe(false)
    expect(validate(short)).toBe(false)

    const reordered = structuredClone(sample())
    reordered.representative_cases[0].role = 'planted_change'
    expect(MethodTrialViewSchema.safeParse(reordered).success).toBe(false)
    expect(validate(reordered)).toBe(false)
  })

  it('rejects path, URL, and email leakage in runtime and standalone validators', async () => {
    const validate = await standaloneValidator()
    for (const leaked of [
      'See https://example.invalid for details.',
      'Stored at C:\\private\\trial.json.',
      'Contact analyst@example.invalid.',
      'Copied from owner/repository.',
    ]) {
      const invalid = structuredClone(sample())
      invalid.dataset.limitations[0] = leaked
      expect(MethodTrialViewSchema.safeParse(invalid).success).toBe(false)
      expect(validate(invalid)).toBe(false)
    }
  })

  it('rejects unapproved source prose across every public narrative shape', async () => {
    const validate = await standaloneValidator()
    const narrativePaths: ReadonlyArray<readonly PropertyKey[]> = [
      ['dataset', 'limitations', 0],
      ['methods', 'baseline', 'display_name'],
      ['methods', 'baseline', 'description'],
      ['methods', 'baseline', 'parameter_summary'],
      ['scorecard', 'threshold_selection', 'baseline', 'summary'],
      ['acceptance_gates', 0, 'label'],
      ['acceptance_gates', 0, 'reason'],
      ['decision', 'summary'],
      ['decision', 'why_simple_baseline_won'],
      ['representative_cases', 0, 'selection_rule', 'label'],
      ['representative_cases', 0, 'title'],
      ['representative_cases', 0, 'summary'],
      ['claims', 'supported', 0, 'display_text'],
      ['claims', 'unsupported', 0, 'display_text'],
      ['claims', 'limitations', 0, 'display_text'],
      ['deferred_caveats', 0, 'display_text'],
    ]

    for (const path of narrativePaths) {
      const invalid = structuredClone(sample())
      replaceAtPath(invalid, path, 'Chris0Jeky owner review title')
      expect(MethodTrialViewSchema.safeParse(invalid).success, path.join('.')).toBe(false)
      expect(validate(invalid), path.join('.')).toBe(false)
    }
  })
})
