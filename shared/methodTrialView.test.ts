import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { renderMethodTrialViewSchema } from '../scripts/generateMethodTrialView.js'
import { METHOD_TRIAL_EVIDENCE, METHOD_TRIAL_QUESTION, MethodTrialViewSchema } from './methodTrialView.js'

const schemaPath = resolve('research-contracts', 'method-trial-view', 'v1', 'schema.json')
const sha = `sha256:${'a'.repeat(64)}`
const commit = 'b'.repeat(40)

function point(index: number, scenario: 'none' | 'planted' | 'confound') {
  const observed = index % 13 !== 0
  return {
    week_index: index,
    week_label: `week-${String(index).padStart(2, '0')}`,
    observed,
    value: observed ? 10 + index / 10 : null,
    baseline_score: observed ? 0.2 : null,
    baseline_threshold: observed ? 3 : null,
    baseline_alert: observed && index === 26,
    candidate_probability: observed ? 0.2 : null,
    candidate_threshold: observed ? 0.8 : null,
    candidate_alert: observed && index === 27,
    planted_marker: scenario === 'planted' && index === 26 ? 'level' : 'none',
    confound_marker: scenario === 'confound' && index === 26 ? 'permission_loss' : 'none',
  }
}

function timeline(order: 1 | 2 | 3, scenario: 'no_change_control' | 'planted_change' | 'instrumentation_confound') {
  const marker = scenario === 'planted_change' ? 'planted' : scenario === 'instrumentation_confound' ? 'confound' : 'none'
  return {
    order,
    scenario_code: scenario,
    title: scenario.replaceAll('_', ' '),
    points: Array.from({ length: 52 }, (_, index) => point(index, marker)),
    pelt: { evaluation_mode: 'offline_descriptive', boundary_index: scenario === 'no_change_control' ? null : 26 },
  }
}

function sample() {
  return {
    schema_version: 'DeveloperLensMethodTrialView.v1',
    classification: 'C0',
    trial: { trial_code: 'WB-C1', question: METHOD_TRIAL_QUESTION, evidence: METHOD_TRIAL_EVIDENCE },
    dataset: { system_code: 'WB-C1', opportunity_count: 156, observed_count: 144, absent_count: 12, scenario_codes: ['no_change_control', 'planted_change', 'instrumentation_confound'] },
    methods: {
      baseline: { method_code: 'rolling_median_mad', label: 'Rolling median/MAD baseline', family: 'deterministic_baseline', evaluation_mode: 'online', role: 'baseline', threshold: 3, promotion_eligible: false },
      candidate: { method_code: 'bocpd', label: 'BOCPD candidate', family: 'online_candidate', evaluation_mode: 'online', role: 'candidate', threshold: 0.8, promotion_eligible: false },
      offline_descriptive: { method_code: 'pelt', label: 'PELT offline boundary description', family: 'offline_descriptive', evaluation_mode: 'offline_descriptive', role: 'offline_descriptive', threshold: null, promotion_eligible: false },
    },
    scorecard: {
      primary_metric: 'false_alarms_per_year',
      metrics: [
        ['false_alarms_per_year', 1.2, 'alerts_per_year'], ['onset_to_alert_delay_weeks', 3, 'weeks'], ['interval_coverage', 0.7, 'proportion'],
        ['localisation_error_weeks', 2, 'weeks'], ['segment_count_error', 1, 'count'], ['coverage_confound_false_alert_rate', 0.2, 'proportion'],
      ].map(([code, value, unit]) => ({ code, value, unit, canonical: true })),
      threshold_selection: {
        baseline: { method_code: 'rolling_median_mad', selected_threshold: null, viable: false, reason_code: 'NO_STABLE_SELECTION' },
        candidate: { method_code: 'bocpd', selected_threshold: null, viable: false, reason_code: 'NO_STABLE_SELECTION' },
      },
    },
    gates: [
      ['support', 'pass', 'SUPPORT_SUFFICIENT'], ['threshold_selection', 'fail', 'BOTH_SELECTIONS_NONVIABLE'], ['online_primary', 'fail', 'BASELINE_WINS_PRIMARY'],
      ['coverage_confound', 'fail', 'COVERAGE_CONFOUND_LIMIT'], ['calibration', 'fail', 'CALIBRATION_LIMIT'], ['promotion', 'not_run', 'CANDIDATE_NOT_PROMOTED'],
    ].map(([gate_code, outcome, reason_code], index) => ({ order: index + 1, gate_code, outcome, reason_code })),
    decision: { outcome: 'reject', reason_codes: ['BOTH_SELECTIONS_NONVIABLE', 'BASELINE_WINS_PRIMARY'], fallback: { method_code: 'rolling_median_mad', retained: true }, candidate_promoted: false },
    supported_codes: ['weekly_relative_grain', 'online_baseline_candidate_comparison', 'offline_pelt_localisation'],
    unsupported_codes: ['real_world_effect', 'person_or_provider_identity', 'online_pelt_promotion'],
    limitation_codes: ['missingness_limits_interpretation', 'instrumentation_confound_caveat', 'pelt_offline_only', 'synthetic_c0_no_real_world_effect'],
    claim_codes: ['baseline_fewer_false_alerts', 'both_threshold_selections_nonviable', 'bocpd_not_promoted', 'c0_synthetic_only_no_real_world_effect'],
    selector: { query_key: 'view', selected_view: 'method-trial', allowed_views: ['method-trial'], default_scenario: 'planted_change' },
    reproducibility: { safe_run_id: 'run-method-trial-01', product_research_pack_commit: commit, product_schema_source_commit: commit, lab_code_commit: commit, sha256_digests: { method_trial_schema: sha, research_pack: sha, lab_fixture: sha }, normalized_path_free_commands: ['npm run check:method-trial-view'] },
    timelines: [timeline(1, 'no_change_control'), timeline(2, 'planted_change'), timeline(3, 'instrumentation_confound')],
  }
}

describe('DeveloperLensMethodTrialView.v1', () => {
  it('accepts the invented C0 presentation sample at runtime and as standalone Draft 2020-12 JSON Schema', async () => {
    const value = sample()
    expect(MethodTrialViewSchema.safeParse(value).success).toBe(true)
    const schemaText = await readFile(schemaPath, 'utf8')
    expect(schemaText).toBe(renderMethodTrialViewSchema())
    const ajv = new Ajv2020({ allErrors: true, strict: true })
    const validate = ajv.compile(JSON.parse(schemaText))
    expect(validate(value)).toBe(true)
  })

  it('rejects unknown fields, count drift, and observed-false values in both validators', async () => {
    const base = sample()
    const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)
    const unknown = { ...base, unexpected: true }
    expect(MethodTrialViewSchema.safeParse(unknown).success).toBe(false)
    expect(validate(unknown)).toBe(false)

    const countDrift = structuredClone(base)
    countDrift.dataset.absent_count = 11
    expect(MethodTrialViewSchema.safeParse(countDrift).success).toBe(false)

    const missingness = structuredClone(base)
    missingness.timelines[0].points[0].value = 1
    missingness.timelines[0].points[0].baseline_alert = true
    expect(MethodTrialViewSchema.safeParse(missingness).success).toBe(false)
    expect(validate(missingness)).toBe(false)
  })
})
