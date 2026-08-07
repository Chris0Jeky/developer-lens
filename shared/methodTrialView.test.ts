import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { renderMethodTrialViewSchema } from '../scripts/generateMethodTrialView.js'
import {
  METHOD_TRIAL_EVIDENCE_LABEL,
  METHOD_TRIAL_QUESTION,
  METHOD_TRIAL_TITLE,
  MethodTrialViewSchema,
} from './methodTrialView.js'

const schemaPath = resolve('research-contracts', 'method-trial-view', 'v1', 'schema.json')
const digest = `sha256:${'a'.repeat(64)}`
const commit = 'b'.repeat(40)

function measured(value: number) {
  return { status: 'measured' as const, value }
}

function unavailable(
  reason: 'insufficient_support' | 'not_applicable' | 'not_measured' = 'not_measured',
) {
  return { status: 'unavailable' as const, reason }
}

function point(index: number, scenario: 'control' | 'planted' | 'confound') {
  const missing = index === 2
  return {
    relative_week_index: index,
    relative_week_label: `week-${String(index).padStart(2, '0')}`,
    observed: missing
      ? ({ state: 'missing', reason: 'not_collected' } as const)
      : ({ state: 'observed', value: 10 + index / 10 } as const),
    planted_marker: scenario === 'planted' && index === 4 ? ('level' as const) : ('none' as const),
    confound_marker:
      scenario === 'confound' && index === 4 ? ('parser_major_change' as const) : ('none' as const),
    baseline: {
      alert: !missing && index === 5,
      score: missing ? unavailable() : measured(0.2),
    },
    candidate: {
      probability: missing ? unavailable() : measured(0.2),
      alert: !missing && index === 6,
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
    scenario_code: scenario,
    selection_rule: {
      code: selectionCode,
      label: 'Fixed deterministic eight-week window',
      deterministic: true as const,
    },
    title: scenario.replaceAll('_', ' '),
    summary: 'A bounded invented window selected by a declared deterministic rule.',
    points: Array.from({ length: 8 }, (_, index) => point(index, kind)),
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
      observed_count: 5_400,
      absent_count: 216,
      scenario_codes: [
        'no_change_control',
        'planted_change',
        'instrumentation_confound',
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
        method_code: 'bocpd' as const,
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
        detection_delay_weeks: unavailable('not_measured'),
        calibration_brier: unavailable('not_applicable'),
      },
      candidate: {
        false_alerts_per_year: measured(4.2),
        detection_rate: measured(0.75),
        detection_delay_weeks: unavailable('not_measured'),
        calibration_brier: measured(0.017341137335170863),
      },
      threshold_selection: {
        baseline: {
          viable: false,
          selected_value: unavailable('insufficient_support'),
          reason_code: 'no_stable_selection' as const,
          summary: 'No stable baseline configuration met the declared selection gate.',
        },
        candidate: {
          viable: false,
          selected_value: unavailable('insufficient_support'),
          reason_code: 'no_stable_selection' as const,
          summary: 'No stable candidate configuration met the declared selection gate.',
        },
      },
    },
    acceptance_gates: [
      {
        order: 1,
        code: 'support',
        label: 'Synthetic support',
        outcome: 'pass',
        reason_code: 'support_sufficient',
        reason: 'The invented benchmark completed with explicit missingness.',
      },
      {
        order: 2,
        code: 'threshold_viability',
        label: 'Threshold viability',
        outcome: 'fail',
        reason_code: 'both_selections_nonviable',
        reason: 'Neither method produced a viable selected configuration.',
      },
      {
        order: 3,
        code: 'false_alerts',
        label: 'False alerts per year',
        outcome: 'fail',
        reason_code: 'candidate_false_alerts_higher',
        reason: 'The candidate produced more false alerts than the baseline.',
        relevant_values: {
          baseline: measured(2.966666666666667),
          candidate: measured(4.2),
        },
      },
      {
        order: 4,
        code: 'detection',
        label: 'Detection',
        outcome: 'fail',
        reason_code: 'same_detection_no_gain',
        reason: 'Both methods detected the same share of planted changes.',
        relevant_values: { baseline: measured(0.75), candidate: measured(0.75) },
      },
      {
        order: 5,
        code: 'calibration',
        label: 'Candidate calibration',
        outcome: 'pass',
        reason_code: 'candidate_brier_reported',
        reason: 'The candidate Brier score is reported without inventing a baseline value.',
        relevant_values: {
          baseline: unavailable('not_applicable'),
          candidate: measured(0.017341137335170863),
        },
      },
      {
        order: 6,
        code: 'promotion',
        label: 'Promotion',
        outcome: 'not_applicable',
        reason_code: 'candidate_rejected',
        reason: 'A rejected candidate cannot be promoted.',
      },
    ] as const,
    decision: {
      outcome: 'reject' as const,
      reason_codes: [
        'both_thresholds_nonviable',
        'candidate_more_false_alerts',
        'no_detection_gain',
        'candidate_not_promoted',
      ] as const,
      summary: 'Reject Gaussian BOCPD for this bounded C0 trial and retain the deterministic fallback.',
      why_simple_baseline_won:
        'Detection was equal, the candidate added 1.2333 false alerts per year, and neither selected configuration was viable.',
    },
    representative_cases: [
      representativeCase(1, 'no_change_control'),
      representativeCase(2, 'planted_change'),
      representativeCase(3, 'instrumentation_confound'),
    ],
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
    reproducibility: {
      product_contract_commit: commit,
      product_research_pack_commit: commit,
      lab_commit: commit,
      run_id: 'wbc1_method_trial_v1',
      recipe_code: 'wbc1-smoke-c0-v1' as const,
      digests: {
        schema: digest,
        evaluation_bundle: digest,
        custody: digest,
        report: digest,
      },
      commands: {
        benchmark: 'uv run dllab benchmark wb-c1 --smoke --run-id wbc1_method_trial_v1',
        reproduce: 'uv run dllab run reproduce wbc1_method_trial_v1',
        export: 'uv run dllab export method-trial wbc1_method_trial_v1',
        report: 'uv run dllab report build wbc1_method_trial_v1',
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

describe('DeveloperLensMethodTrialView.v1', () => {
  it('accepts the invented presentation sample in runtime and standalone validators', async () => {
    const value = sample()
    expect(MethodTrialViewSchema.safeParse(value).success).toBe(true)
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

  it('rejects count drift, oversized cases, and reordered scenarios', async () => {
    const validate = await standaloneValidator()

    const countDrift = structuredClone(sample())
    countDrift.dataset.absent_count -= 1
    expect(MethodTrialViewSchema.safeParse(countDrift).success).toBe(false)

    const oversized = structuredClone(sample())
    oversized.representative_cases[0].points = Array.from({ length: 25 }, (_, index) =>
      point(index, 'control'),
    )
    expect(MethodTrialViewSchema.safeParse(oversized).success).toBe(false)
    expect(validate(oversized)).toBe(false)

    const reordered = structuredClone(sample())
    reordered.representative_cases[0].scenario_code = 'planted_change'
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
})
