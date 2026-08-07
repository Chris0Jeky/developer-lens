import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  METHOD_TRIAL_EVIDENCE_LABEL,
  METHOD_TRIAL_QUESTION,
  METHOD_TRIAL_TITLE,
  type MethodTrialView,
} from '../../shared/methodTrialView'
import { MethodTrialViewPanel } from './MethodTrialRoute'

const digest = `sha256:${'a'.repeat(64)}`
const commit = 'b'.repeat(40)

function trialView(): MethodTrialView {
  const point = (index: number, scenario: 'control' | 'planted' | 'confound'): MethodTrialView['representative_cases'][number]['points'][number] => {
    const missing = index === 2
    return {
      relative_week_index: index,
      relative_week_label: `week-${String(index).padStart(2, '0')}`,
      observed: missing ? { state: 'missing', reason: 'not_collected' } : { state: 'observed', value: 10 + index / 10 },
      planted_marker: scenario === 'planted' && index === 4 ? 'level' : 'none',
      confound_marker: scenario === 'confound' && index === 4 ? 'parser_major_change' : 'none',
      baseline: { alert: !missing && index === 5, score: missing ? { status: 'unavailable', reason: 'not_measured' } : { status: 'measured', value: 0.2 } },
      candidate: { probability: missing ? { status: 'unavailable', reason: 'not_measured' } : { status: 'measured', value: 0.2 }, alert: !missing && index === 6 },
      pelt_marker: { evaluation_mode: 'offline_descriptive', boundary: scenario !== 'control' && index === 4 },
    }
  }
  const representativeCase = (order: 1 | 2 | 3, scenario_code: 'no_change_control' | 'planted_change' | 'instrumentation_confound'): MethodTrialView['representative_cases'][number] => ({
    order,
    scenario_code,
    selection_rule: { code: order === 1 ? 'fixed_first_window' : order === 2 ? 'fixed_change_window' : 'fixed_confound_window', label: 'Fixed deterministic eight-week window', deterministic: true },
    title: scenario_code.replaceAll('_', ' '),
    summary: 'A bounded invented window selected by a declared deterministic rule.',
    points: Array.from({ length: 8 }, (_, index) => point(index, order === 1 ? 'control' : order === 2 ? 'planted' : 'confound')),
  })

  return {
    schema_version: 'DeveloperLensMethodTrialView.v1',
    trial: { trial_id: 'trial-wbc1c0v1', title: METHOD_TRIAL_TITLE, question: METHOD_TRIAL_QUESTION, classification: 'C0', evidence_label: METHOD_TRIAL_EVIDENCE_LABEL },
    dataset: { system_count: 54, weekly_opportunity_count: 5616, observed_count: 5400, absent_count: 216, scenario_codes: ['no_change_control', 'planted_change', 'instrumentation_confound'] as const, limitations: ['Invented systems demonstrate mechanics rather than real-world validity.'] },
    methods: {
      baseline: { role: 'baseline', method_code: 'rolling_median_mad', display_name: 'Rolling median and MAD baseline', description: 'A deterministic robust weekly baseline with a complete fallback.', deterministic: true, parameter_summary: 'Rolling window with a median absolute deviation threshold.' },
      candidate: { role: 'candidate', method_code: 'bocpd', display_name: 'Gaussian BOCPD candidate', description: 'A deterministic online posterior change-probability candidate.', deterministic: true, parameter_summary: 'Fixed-prior Gaussian online change probability.' },
      offline_pelt: { role: 'offline_descriptive', method_code: 'pelt', display_name: 'PELT offline description', description: 'Offline boundary evidence for explanation only, never online promotion.', deterministic: true, parameter_summary: 'Offline descriptive boundary localization.' },
    },
    scorecard: {
      baseline: { false_alerts_per_year: { status: 'measured', value: 2.966666666666667 }, detection_rate: { status: 'measured', value: 0.75 }, detection_delay_weeks: { status: 'unavailable', reason: 'not_measured' }, calibration_brier: { status: 'unavailable', reason: 'not_applicable' } },
      candidate: { false_alerts_per_year: { status: 'measured', value: 4.2 }, detection_rate: { status: 'measured', value: 0.75 }, detection_delay_weeks: { status: 'unavailable', reason: 'not_measured' }, calibration_brier: { status: 'measured', value: 0.017341137335170863 } },
      threshold_selection: { baseline: { viable: false, selected_value: { status: 'unavailable', reason: 'insufficient_support' }, reason_code: 'no_stable_selection', summary: 'No stable baseline configuration met the declared selection gate.' }, candidate: { viable: false, selected_value: { status: 'unavailable', reason: 'insufficient_support' }, reason_code: 'no_stable_selection', summary: 'No stable candidate configuration met the declared selection gate.' } },
    },
    acceptance_gates: [
      { order: 1, code: 'support', label: 'Synthetic support', outcome: 'pass', reason_code: 'support_sufficient', reason: 'The invented benchmark completed with explicit missingness.' },
      { order: 2, code: 'threshold_viability', label: 'Threshold viability', outcome: 'fail', reason_code: 'both_selections_nonviable', reason: 'Neither method produced a viable selected configuration.' },
      { order: 3, code: 'false_alerts', label: 'False alerts per year', outcome: 'fail', reason_code: 'candidate_false_alerts_higher', reason: 'The candidate produced more false alerts than the baseline.' },
      { order: 4, code: 'detection', label: 'Detection', outcome: 'fail', reason_code: 'same_detection_no_gain', reason: 'Both methods detected the same share of planted changes.' },
      { order: 5, code: 'calibration', label: 'Candidate calibration', outcome: 'pass', reason_code: 'candidate_brier_reported', reason: 'The candidate Brier score is reported without inventing a baseline value.' },
      { order: 6, code: 'promotion', label: 'Promotion', outcome: 'not_applicable', reason_code: 'candidate_rejected', reason: 'A rejected candidate cannot be promoted.' },
    ],
    decision: { outcome: 'reject', reason_codes: ['both_thresholds_nonviable', 'candidate_more_false_alerts', 'no_detection_gain', 'candidate_not_promoted'], summary: 'Reject Gaussian BOCPD for this bounded C0 trial and retain the deterministic fallback.', why_simple_baseline_won: 'Detection was equal, the candidate added 1.2333 false alerts per year, and neither selected configuration was viable.' },
    representative_cases: [representativeCase(1, 'no_change_control'), representativeCase(2, 'planted_change'), representativeCase(3, 'instrumentation_confound')],
    claims: { supported: [{ code: 'same_detection_on_c0', display_text: 'Both online methods reached 0.75 detection on this invented benchmark.' }], unsupported: [{ code: 'real_repository_validity', display_text: 'The result does not establish validity on real repositories.' }], limitations: [{ code: 'c0_synthetic_only', display_text: 'All evidence is invented C0 material.' }] },
    reproducibility: { product_contract_commit: commit, product_research_pack_commit: commit, lab_commit: commit, run_id: 'wbc1_method_trial_v1', recipe_code: 'wbc1-smoke-c0-v1', digests: { schema: digest, evaluation_bundle: digest, custody: digest, report: digest }, commands: { benchmark: 'uv run dllab benchmark wb-c1 --smoke --run-id wbc1_method_trial_v1', reproduce: 'uv run dllab run reproduce wbc1_method_trial_v1', export: 'uv run dllab export method-trial wbc1_method_trial_v1', report: 'uv run dllab report build wbc1_method_trial_v1' }, verification: { local: 'passed', product_hosted: 'not_run', lab_hosted: 'not_run' } },
  }
}

describe('MethodTrialViewPanel', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('renders the rejected C0 decision, paired metrics, three accessible timelines, gates, and collapsed disclosure offline', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<MethodTrialViewPanel view={trialView()} />)
    expect(screen.getByRole('heading', { level: 2, name: /why the simple baseline won/i })).toBeInTheDocument()
    expect(screen.getByText('REJECTED')).toBeInTheDocument()
    expect(screen.getByText(/41\.6% more.*false alerts/i)).toBeInTheDocument()
    expect(screen.getByText(/no real repositories/i)).toBeInTheDocument()
    expect(screen.getByText(/candidate added exactly/i)).toHaveTextContent('1.2333 false alerts per year')
    expect(screen.getByText(/PELT is labelled offline descriptive/i)).toBeInTheDocument()
    expect(screen.getAllByTestId('method-trial-timeline')).toHaveLength(3)
    expect(screen.getAllByRole('figure')).toHaveLength(3)
    expect(screen.getByRole('figure', { name: /no change control/i })).toHaveTextContent(/missing/i)
    expect(screen.getByRole('figure', { name: /instrumentation confound/i })).toHaveTextContent(/PELT/i)
    expect(screen.getByText('both_selections_nonviable')).toBeInTheDocument()
    expect(screen.getByText('Not applicable')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Supported' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Unsupported' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Limitations' })).toBeInTheDocument()
    const disclosure = screen.getByText(/Reproducibility disclosure/i).closest('details')
    expect(disclosure).not.toHaveAttribute('open')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
