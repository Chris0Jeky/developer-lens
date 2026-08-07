import { z } from 'zod'

export const METHOD_TRIAL_VIEW_SCHEMA_VERSION = 'DeveloperLensMethodTrialView.v1' as const
export const METHOD_TRIAL_VIEW_CLASSIFICATION = 'C0' as const
export const METHOD_TRIAL_TITLE = 'WB-C1 method trial: why the simple baseline won' as const
export const METHOD_TRIAL_QUESTION =
  'Can the BOCPD candidate reduce false alerts per year versus the rolling median and MAD baseline without worsening detection or calibration?' as const
export const METHOD_TRIAL_EVIDENCE_LABEL =
  'Invented weekly system series only; no real repositories, people, providers, URLs, paths, or production effect.' as const

const boundedNumber = z.number().finite().min(-1_000_000).max(1_000_000)
const boundedCount = z.number().int().min(0).max(100_000)
const unitInterval = z.number().finite().min(0).max(1)
const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const commit = z.string().regex(/^[0-9a-f]{40}$/)
const safeRunId = z.string().regex(/^[a-z0-9][a-z0-9_-]{7,63}$/)
const safeCommand = z.string().min(16).max(240).regex(/^uv run dllab(?: [A-Za-z0-9_.:@=_-]+)+$/)
const SAFE_TEXT_PATTERN = /^(?!.*(?:https?:\/\/|ftp:\/\/|[A-Za-z]:\\|\\\\|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b[A-Za-z0-9_.-]{2,}\/[A-Za-z0-9_.-]{2,}\b))[\s\S]*$/i
const safeText = (min: number, max: number) => z.string().min(min).max(max).regex(SAFE_TEXT_PATTERN)

export const ScenarioCodeSchema = z.enum([
  'no_change_control',
  'planted_change',
  'instrumentation_confound',
])

export const SupportedClaimCodeSchema = z.enum([
  'same_detection_on_c0',
  'candidate_more_false_alerts_on_c0',
  'deterministic_case_windows',
  'offline_pelt_descriptive',
])
export const UnsupportedClaimCodeSchema = z.enum([
  'real_repository_validity',
  'person_level_inference',
  'model_promotion',
  'online_pelt_performance',
])
export const LimitationCodeSchema = z.enum([
  'c0_synthetic_only',
  'bounded_three_case_selection',
  'missingness_and_confound',
  'thresholds_nonviable',
])

const UnavailableReasonSchema = z.enum([
  'insufficient_support',
  'not_applicable',
  'not_measured',
])

const MeasurementSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('measured'), value: boundedNumber }),
  z.strictObject({ status: z.literal('unavailable'), reason: UnavailableReasonSchema }),
])

const ProbabilityMeasurementSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('measured'), value: unitInterval }),
  z.strictObject({ status: z.literal('unavailable'), reason: UnavailableReasonSchema }),
])

const DatasetSchema = z
  .strictObject({
    system_count: boundedCount.min(1),
    weekly_opportunity_count: boundedCount.min(1),
    observed_count: boundedCount,
    absent_count: boundedCount,
    scenario_codes: z.tuple([
      z.literal('no_change_control'),
      z.literal('planted_change'),
      z.literal('instrumentation_confound'),
    ]),
    limitations: z.array(safeText(3, 180)).min(1).max(4),
  })
  .superRefine((value, ctx) => {
    if (value.observed_count + value.absent_count !== value.weekly_opportunity_count) {
      ctx.addIssue({
        code: 'custom',
        path: ['weekly_opportunity_count'],
        message: 'observed + absent must equal weekly opportunities',
      })
    }
  })

const MethodCardSchema = z.strictObject({
  role: z.enum(['baseline', 'candidate', 'offline_descriptive']),
  method_code: z.enum(['rolling_median_mad', 'bocpd', 'pelt']),
  display_name: safeText(3, 80),
  description: safeText(3, 180),
  deterministic: z.boolean(),
  parameter_summary: safeText(3, 180),
})

const ThresholdSelectionSchema = z
  .strictObject({
    viable: z.boolean(),
    selected_value: MeasurementSchema,
    reason_code: z.enum(['selected', 'no_stable_selection', 'insufficient_support']),
    summary: safeText(3, 180),
  })
  .superRefine((value, ctx) => {
    if (value.viable !== (value.selected_value.status === 'measured')) {
      ctx.addIssue({
        code: 'custom',
        path: ['selected_value'],
        message: 'viable selections require a measured value and nonviable selections require unavailable',
      })
    }
  })

const MethodScoreSchema = z.strictObject({
  false_alerts_per_year: MeasurementSchema,
  detection_rate: ProbabilityMeasurementSchema,
  detection_delay_weeks: MeasurementSchema,
  calibration_brier: ProbabilityMeasurementSchema,
})

const ScorecardSchema = z.strictObject({
  baseline: MethodScoreSchema,
  candidate: MethodScoreSchema,
  threshold_selection: z.strictObject({
    baseline: ThresholdSelectionSchema,
    candidate: ThresholdSelectionSchema,
  }),
})

const AcceptanceGateSchema = z.strictObject({
  order: z.number().int().min(1).max(6),
  code: z.enum([
    'support',
    'threshold_viability',
    'false_alerts',
    'detection',
    'calibration',
    'promotion',
  ]),
  label: safeText(3, 80),
  outcome: z.enum(['pass', 'fail', 'not_applicable']),
  reason_code: z.enum([
    'support_sufficient',
    'both_selections_nonviable',
    'candidate_false_alerts_higher',
    'same_detection_no_gain',
    'candidate_brier_reported',
    'candidate_rejected',
  ]),
  reason: safeText(3, 200),
  relevant_values: z
    .strictObject({
      baseline: MeasurementSchema,
      candidate: MeasurementSchema,
    })
    .optional(),
})

const DecisionSchema = z.strictObject({
  outcome: z.literal('reject'),
  reason_codes: z
    .array(
      z.enum([
        'both_thresholds_nonviable',
        'candidate_more_false_alerts',
        'no_detection_gain',
        'candidate_not_promoted',
      ]),
    )
    .min(1)
    .max(4),
  summary: safeText(3, 260),
  why_simple_baseline_won: safeText(3, 260),
})

const PointSchema = z
  .strictObject({
    relative_week_index: z.number().int().min(0).max(23),
    relative_week_label: z.string().regex(/^week-[0-9]{2}$/),
    observed: z.discriminatedUnion('state', [
      z.strictObject({ state: z.literal('observed'), value: boundedNumber }),
      z.strictObject({
        state: z.literal('missing'),
        reason: z.enum(['not_collected', 'permission_gap', 'instrumentation_gap']),
      }),
    ]),
    planted_marker: z.enum(['none', 'level', 'variance', 'trend', 'seasonal']),
    confound_marker: z.enum([
      'none',
      'permission_loss',
      'actions_cap',
      'shallow_boundary',
      'parser_major_change',
    ]),
    baseline: z.strictObject({ alert: z.boolean(), score: MeasurementSchema }),
    candidate: z.strictObject({
      probability: ProbabilityMeasurementSchema,
      alert: z.boolean(),
    }),
    pelt_marker: z.strictObject({
      evaluation_mode: z.literal('offline_descriptive'),
      boundary: z.boolean(),
    }),
  })
  .superRefine((value, ctx) => {
    if (value.relative_week_label !== `week-${String(value.relative_week_index).padStart(2, '0')}`) {
      ctx.addIssue({
        code: 'custom',
        path: ['relative_week_label'],
        message: 'week label must match index',
      })
    }
    if (value.observed.state === 'missing') {
      if (value.baseline.alert || value.candidate.alert) {
        ctx.addIssue({ code: 'custom', message: 'missing observations cannot alert' })
      }
      if (
        value.baseline.score.status === 'measured' ||
        value.candidate.probability.status === 'measured'
      ) {
        ctx.addIssue({ code: 'custom', message: 'missing observations cannot have scores' })
      }
    }
    if (value.planted_marker !== 'none' && value.confound_marker !== 'none') {
      ctx.addIssue({ code: 'custom', message: 'markers are mutually exclusive' })
    }
  })

const RepresentativeCaseSchema = z
  .strictObject({
    order: z.number().int().min(1).max(3),
    scenario_code: ScenarioCodeSchema,
    selection_rule: z.strictObject({
      code: z.enum(['fixed_first_window', 'fixed_change_window', 'fixed_confound_window']),
      label: safeText(3, 100),
      deterministic: z.literal(true),
    }),
    title: safeText(3, 96),
    summary: safeText(3, 220),
    points: z.array(PointSchema).min(8).max(24),
  })
  .superRefine((value, ctx) => {
    const expectedScenarios = [
      'no_change_control',
      'planted_change',
      'instrumentation_confound',
    ] as const
    const expectedRules = [
      'fixed_first_window',
      'fixed_change_window',
      'fixed_confound_window',
    ] as const
    if (value.scenario_code !== expectedScenarios[value.order - 1]) {
      ctx.addIssue({ code: 'custom', path: ['scenario_code'], message: 'scenario order is fixed' })
    }
    if (value.selection_rule.code !== expectedRules[value.order - 1]) {
      ctx.addIssue({
        code: 'custom',
        path: ['selection_rule', 'code'],
        message: 'selection rule is fixed by case order',
      })
    }
    if (value.points.some((point, index) => point.relative_week_index !== index)) {
      ctx.addIssue({ code: 'custom', path: ['points'], message: 'points must be sequential' })
    }
    const planted = value.points.some((point) => point.planted_marker !== 'none')
    const confounded = value.points.some((point) => point.confound_marker !== 'none')
    if (value.scenario_code === 'no_change_control' && (planted || confounded)) {
      ctx.addIssue({ code: 'custom', path: ['points'], message: 'control has no markers' })
    }
    if (value.scenario_code === 'planted_change' && !planted) {
      ctx.addIssue({ code: 'custom', path: ['points'], message: 'planted case needs a marker' })
    }
    if (value.scenario_code === 'instrumentation_confound' && !confounded) {
      ctx.addIssue({ code: 'custom', path: ['points'], message: 'confound case needs a marker' })
    }
  })

const ClaimsSchema = z.strictObject({
  supported: z
    .array(
      z.strictObject({ code: SupportedClaimCodeSchema, display_text: safeText(3, 180) }),
    )
    .min(1)
    .max(4),
  unsupported: z
    .array(
      z.strictObject({ code: UnsupportedClaimCodeSchema, display_text: safeText(3, 180) }),
    )
    .min(1)
    .max(4),
  limitations: z
    .array(z.strictObject({ code: LimitationCodeSchema, display_text: safeText(3, 180) }))
    .min(1)
    .max(4),
})

const ReproducibilitySchema = z.strictObject({
  product_contract_commit: commit,
  product_research_pack_commit: commit,
  lab_commit: commit,
  run_id: safeRunId,
  recipe_code: z.literal('wbc1-smoke-c0-v1'),
  digests: z.strictObject({
    schema: sha256,
    evaluation_bundle: sha256,
    custody: sha256,
    report: sha256,
  }),
  commands: z.strictObject({
    benchmark: safeCommand,
    reproduce: safeCommand,
    export: safeCommand,
    report: safeCommand,
  }),
  verification: z.strictObject({
    local: z.enum(['passed', 'failed', 'not_run']),
    product_hosted: z.enum(['passed', 'failed', 'not_run']),
    lab_hosted: z.enum(['passed', 'failed', 'not_run']),
  }),
})

export const MethodTrialViewSchema = z
  .strictObject({
    schema_version: z.literal(METHOD_TRIAL_VIEW_SCHEMA_VERSION),
    trial: z.strictObject({
      trial_id: z.string().regex(/^trial-[a-z0-9]{8,32}$/),
      title: z.literal(METHOD_TRIAL_TITLE),
      question: z.literal(METHOD_TRIAL_QUESTION),
      classification: z.literal(METHOD_TRIAL_VIEW_CLASSIFICATION),
      evidence_label: z.literal(METHOD_TRIAL_EVIDENCE_LABEL),
    }),
    dataset: DatasetSchema,
    methods: z.strictObject({
      baseline: MethodCardSchema,
      candidate: MethodCardSchema,
      offline_pelt: MethodCardSchema,
    }),
    scorecard: ScorecardSchema,
    acceptance_gates: z.array(AcceptanceGateSchema).length(6),
    decision: DecisionSchema,
    representative_cases: z.array(RepresentativeCaseSchema).length(3),
    claims: ClaimsSchema,
    reproducibility: ReproducibilitySchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.methods.baseline.role !== 'baseline' ||
      value.methods.baseline.method_code !== 'rolling_median_mad' ||
      !value.methods.baseline.deterministic
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['methods', 'baseline'],
        message: 'baseline identity is fixed and deterministic',
      })
    }
    if (
      value.methods.candidate.role !== 'candidate' ||
      value.methods.candidate.method_code !== 'bocpd' ||
      !value.methods.candidate.deterministic
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['methods', 'candidate'],
        message: 'candidate identity is fixed and deterministic',
      })
    }
    if (
      value.methods.offline_pelt.role !== 'offline_descriptive' ||
      value.methods.offline_pelt.method_code !== 'pelt' ||
      !value.methods.offline_pelt.deterministic
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['methods', 'offline_pelt'],
        message: 'PELT identity is fixed, deterministic, and descriptive only',
      })
    }
    const gateCodes = [
      'support',
      'threshold_viability',
      'false_alerts',
      'detection',
      'calibration',
      'promotion',
    ] as const
    if (
      value.acceptance_gates.some(
        (gate, index) => gate.order !== index + 1 || gate.code !== gateCodes[index],
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['acceptance_gates'],
        message: 'gate order and codes are fixed',
      })
    }
    if (
      value.representative_cases.some(
        (representativeCase, index) => representativeCase.order !== index + 1,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['representative_cases'],
        message: 'representative cases must be ordered 1 through 3',
      })
    }
    if (
      value.scorecard.threshold_selection.baseline.viable ||
      value.scorecard.threshold_selection.candidate.viable
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['scorecard', 'threshold_selection'],
        message: 'both threshold selections are nonviable for this rejected trial',
      })
    }
  })

export type MethodTrialView = z.infer<typeof MethodTrialViewSchema>
export type MethodTrialRepresentativeCase = z.infer<typeof RepresentativeCaseSchema>
export type ScenarioCode = z.infer<typeof ScenarioCodeSchema>
