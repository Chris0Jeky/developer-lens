import { z } from 'zod'

export const METHOD_TRIAL_VIEW_SCHEMA_VERSION = 'DeveloperLensMethodTrialView.v1' as const
export const METHOD_TRIAL_VIEW_CLASSIFICATION = 'C0' as const
export const METHOD_TRIAL_TITLE = 'WB-C1 method trial: why the simple baseline won' as const
export const METHOD_TRIAL_QUESTION =
  'Can the BOCPD candidate reduce false alerts per year versus the rolling median and MAD baseline without worsening detection or calibration?' as const
export const METHOD_TRIAL_EVIDENCE_LABEL =
  'Invented weekly system series only; no real repositories, people, providers, URLs, paths, or production effect.' as const

const boundedNumber = z.number().finite().min(0).max(1_000_000)
const signedBoundedNumber = z.number().finite().min(-1_000_000).max(1_000_000)
const boundedCount = z.number().int().min(0).max(100_000)
const unitInterval = z.number().finite().min(0).max(1)
const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const commit = z.string().regex(/^[0-9a-f]{40}$/)
const safeRunId = z.string().regex(/^[a-z0-9][a-z0-9_-]{7,63}$/)
const benchmarkCommand = z.string().regex(/^uv run dllab benchmark wb-c1 --smoke --run-id [a-z0-9][a-z0-9_-]{7,63}$/)
const reproduceCommand = z.string().regex(/^uv run dllab run reproduce [a-z0-9][a-z0-9_-]{7,63}$/)
const exportCommand = z.string().regex(/^uv run dllab export method-trial [a-z0-9][a-z0-9_-]{7,63}$/)
const reportCommand = z.string().regex(/^uv run dllab report build [a-z0-9][a-z0-9_-]{7,63}$/)
const SAFE_TEXT_PATTERN = /^(?!.*(?:https?:\/\/|ftp:\/\/|[A-Za-z]:\\|\\\\|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b[A-Za-z0-9_.-]{2,}\/[A-Za-z0-9_.-]{2,}\b))[\s\S]*$/i
const safeText = (min: number, max: number) => z.string().min(min).max(max).regex(SAFE_TEXT_PATTERN)

export const GeneratorScenarioCodeSchema = z.enum([
  'no_change',
  'level',
  'variance',
  'slope',
  'seasonal_amplitude',
  'heavy_tailed_no_change',
  'coverage_gap',
  'permission_shift',
  'parser_shift',
])
export const RepresentativeRoleSchema = z.enum([
  'no_change_control',
  'planted_change',
  'instrumentation_confound',
])
export const ScenarioCodeSchema = RepresentativeRoleSchema

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
  'warmup',
  'missing_observation',
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
      z.literal('no_change'),
      z.literal('level'),
      z.literal('variance'),
      z.literal('slope'),
      z.literal('seasonal_amplitude'),
      z.literal('heavy_tailed_no_change'),
      z.literal('coverage_gap'),
      z.literal('permission_shift'),
      z.literal('parser_shift'),
    ]),
    limitations: z.array(safeText(3, 180)).min(1).max(4),
  })
  .superRefine((value, ctx) => {
    if (value.system_count !== 54 || value.weekly_opportunity_count !== 5616 || value.observed_count !== 5346 || value.absent_count !== 270) {
      ctx.addIssue({ code: 'custom', path: ['system_count'], message: 'canonical sample counts are fixed' })
    }
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
  method_code: z.enum(['rolling_median_mad', 'bocpd_gaussian', 'pelt']),
  display_name: safeText(3, 80),
  description: safeText(3, 180),
  deterministic: z.boolean(),
  parameter_summary: safeText(3, 180),
})

const ThresholdSelectionSchema = z
  .strictObject({
    viable: z.boolean(),
    selected_value: MeasurementSchema,
    reason_code: z.enum(['selected', 'frozen_best_available', 'no_stable_selection', 'insufficient_support']),
    summary: safeText(3, 180),
  })
  .superRefine((value, ctx) => {
    if (value.viable && value.selected_value.status !== 'measured') {
      ctx.addIssue({ code: 'custom', path: ['selected_value'], message: 'viable selections require a measured value' })
    }
    if (!value.viable && value.reason_code === 'selected') {
      ctx.addIssue({ code: 'custom', path: ['reason_code'], message: 'nonviable selections need a reason separate from selected' })
    }
  })

const MethodScoreSchema = z.strictObject({
  false_alerts_per_year: MeasurementSchema,
  detection_rate: ProbabilityMeasurementSchema,
  median_detection_delay_weeks: MeasurementSchema,
  coverage_confound_false_alert_rate: ProbabilityMeasurementSchema,
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
  order: z.number().int().min(1).max(7),
  code: z.enum([
    'baseline_selection',
    'candidate_selection',
    'detection_floor',
    'delay_budget',
    'false_alert_improvement',
    'not_worse_detection',
    'confound_guard',
  ]),
  label: safeText(3, 80),
  outcome: z.enum(['pass', 'fail', 'not_applicable']),
  reason_code: z.enum([
    'BASELINE_SELECTION_VIABLE',
    'CANDIDATE_SELECTION_VIABLE',
    'CANDIDATE_DETECTION_FLOOR',
    'CANDIDATE_DELAY_BUDGET',
    'CANDIDATE_FALSE_ALERT_IMPROVEMENT',
    'CANDIDATE_NOT_WORSE_DETECTION',
    'CANDIDATE_CONFOUND_GUARD',
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
  candidate_promoted: z.literal(false),
  fallback: z.strictObject({ method_code: z.literal('rolling_median_mad'), retained: z.literal(true) }),
  reason_codes: z
    .array(
      z.enum([
        'BASELINE_SELECTION_VIABLE',
        'CANDIDATE_SELECTION_VIABLE',
        'CANDIDATE_DETECTION_FLOOR',
        'CANDIDATE_DELAY_BUDGET',
        'CANDIDATE_FALSE_ALERT_IMPROVEMENT',
        'CANDIDATE_NOT_WORSE_DETECTION',
        'CANDIDATE_CONFOUND_GUARD',
      ]),
    )
    .min(1)
    .max(4),
  summary: safeText(3, 260),
  why_simple_baseline_won: safeText(3, 260),
})

const PointSchema = z
  .strictObject({
    relative_week_index: z.number().int().min(0).max(103),
    relative_week_label: z.string().regex(/^week-[0-9]{3}$/),
    observed: z.discriminatedUnion('state', [
      z.strictObject({ state: z.literal('observed'), value: signedBoundedNumber }),
      z.strictObject({
        state: z.literal('missing'),
        reason: z.enum(['not_collected', 'permission_gap', 'instrumentation_gap']),
      }),
    ]),
    planted_marker: z.enum(['none', 'level', 'variance', 'slope', 'seasonal_amplitude']),
    confound_marker: z.enum(['none', 'parser_shift', 'coverage_gap', 'permission_shift']),
    baseline: z.strictObject({ alert: z.boolean(), score: MeasurementSchema, threshold: MeasurementSchema }),
    candidate: z.strictObject({
      probability: ProbabilityMeasurementSchema,
      alert: z.boolean(),
      threshold: ProbabilityMeasurementSchema,
    }),
    pelt_marker: z.strictObject({
      evaluation_mode: z.literal('offline_descriptive'),
      boundary: z.boolean(),
    }),
  })
  .superRefine((value, ctx) => {
    if (value.relative_week_label !== `week-${String(value.relative_week_index).padStart(3, '0')}`) {
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
    role: RepresentativeRoleSchema,
    scenario_code: GeneratorScenarioCodeSchema,
    selection_rule: z.strictObject({
      code: z.enum(['fixed_first_window', 'fixed_change_window', 'fixed_confound_window']),
      label: safeText(3, 100),
      deterministic: z.literal(true),
    }),
    title: safeText(3, 96),
    summary: safeText(3, 220),
    points: z.array(PointSchema).min(52).max(104),
  })
  .superRefine((value, ctx) => {
    const expectedRoles = ['no_change_control', 'planted_change', 'instrumentation_confound'] as const
    const expectedScenarios = ['no_change', 'level', 'parser_shift'] as const
    const expectedRules = [
      'fixed_first_window',
      'fixed_change_window',
      'fixed_confound_window',
    ] as const
    if (value.role !== expectedRoles[value.order - 1] || value.scenario_code !== expectedScenarios[value.order - 1]) {
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
    if (value.role === 'no_change_control' && (planted || confounded)) {
      ctx.addIssue({ code: 'custom', path: ['points'], message: 'control has no markers' })
    }
    if (value.role === 'planted_change' && !planted) {
      ctx.addIssue({ code: 'custom', path: ['points'], message: 'planted case needs a marker' })
    }
    if (value.role === 'instrumentation_confound' && !confounded) {
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

const RepresentativeSelectionSchema = z.strictObject({
  version: z.literal('wbc1-final-holdout-v1'),
  partition: z.literal('final_holdout'),
  planted_preference: z.tuple([
    z.literal('level'),
    z.literal('slope'),
    z.literal('variance'),
    z.literal('seasonal_amplitude'),
  ]),
  confound_preference: z.tuple([
    z.literal('parser_shift'),
    z.literal('coverage_gap'),
    z.literal('permission_shift'),
  ]),
  tie_break: z.literal('lexicographically_lowest_stable_opaque_alias'),
  missing_role_policy: z.literal('fail_export'),
  aliases_not_exposed: z.literal(true),
})

const DeferredCaveatSchema = z.strictObject({
  code: z.enum([
    'missingness_confound_observability',
    'validation_artifact_lifecycle',
    'threshold_selection_workload_counts',
    'corrupt_manifest_failure',
    'primary_domain_metric_enforcement',
    'zero_delay_fallback_ordering',
  ]),
  display_text: safeText(3, 180),
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
    research_pack: sha256,
  }),
  commands: z.strictObject({
    benchmark: benchmarkCommand,
    reproduce: reproduceCommand,
    export: exportCommand,
    report: reportCommand,
  }),
  verification: z.strictObject({
    local: z.enum(['passed', 'failed', 'not_run']),
    product_hosted: z.enum(['passed', 'failed', 'not_run']),
    lab_hosted: z.enum(['passed', 'failed', 'not_run']),
  }),
}).superRefine((value, ctx) => {
  const expected = {
    benchmark: `uv run dllab benchmark wb-c1 --smoke --run-id ${value.run_id}`,
    reproduce: `uv run dllab run reproduce ${value.run_id}`,
    export: `uv run dllab export method-trial ${value.run_id}`,
    report: `uv run dllab report build ${value.run_id}`,
  }
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (value.commands[key] !== expected[key]) {
      ctx.addIssue({ code: 'custom', path: ['commands', key], message: 'command must exactly use run_id' })
    }
  }
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
    acceptance_gates: z.array(AcceptanceGateSchema).length(7),
    decision: DecisionSchema,
    representative_cases: z.array(RepresentativeCaseSchema).length(3),
    representative_selection: RepresentativeSelectionSchema,
    claims: ClaimsSchema,
    deferred_caveats: z.array(DeferredCaveatSchema).length(6),
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
      value.methods.candidate.method_code !== 'bocpd_gaussian' ||
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
      'baseline_selection',
      'candidate_selection',
      'detection_floor',
      'delay_budget',
      'false_alert_improvement',
      'not_worse_detection',
      'confound_guard',
    ] as const
    const gateReasons = [
      'BASELINE_SELECTION_VIABLE',
      'CANDIDATE_SELECTION_VIABLE',
      'CANDIDATE_DETECTION_FLOOR',
      'CANDIDATE_DELAY_BUDGET',
      'CANDIDATE_FALSE_ALERT_IMPROVEMENT',
      'CANDIDATE_NOT_WORSE_DETECTION',
      'CANDIDATE_CONFOUND_GUARD',
    ] as const
    if (
      value.acceptance_gates.some(
        (gate, index) => gate.order !== index + 1 || gate.code !== gateCodes[index] || gate.reason_code !== gateReasons[index],
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
    const failedGateReasons = value.acceptance_gates
      .filter((gate) => gate.outcome === 'fail')
      .map((gate) => gate.reason_code)
    if (JSON.stringify(value.decision.reason_codes) !== JSON.stringify(failedGateReasons)) {
      ctx.addIssue({ code: 'custom', path: ['decision', 'reason_codes'], message: 'decision reasons derive from failed gates' })
    }

    const metricValue = (measurement: z.infer<typeof MeasurementSchema> | z.infer<typeof ProbabilityMeasurementSchema>) =>
      measurement.status === 'measured' ? measurement.value : null
    const sameMeasurement = (
      left: z.infer<typeof MeasurementSchema> | z.infer<typeof ProbabilityMeasurementSchema>,
      right: z.infer<typeof MeasurementSchema> | z.infer<typeof ProbabilityMeasurementSchema>,
    ) =>
      left.status === right.status &&
      (left.status === 'measured'
        ? left.value === (right.status === 'measured' ? right.value : null)
        : left.reason === (right.status === 'unavailable' ? right.reason : null))
    const selectionOutcomes = [
      value.scorecard.threshold_selection.baseline.viable,
      value.scorecard.threshold_selection.candidate.viable,
    ]
    const expectedOutcomes: Array<'pass' | 'fail' | 'not_applicable'> = [
      selectionOutcomes[0] ? 'pass' : 'fail',
      selectionOutcomes[1] ? 'pass' : 'fail',
    ]
    const scoredGates = [
      {
        baseline: value.scorecard.baseline.detection_rate,
        candidate: value.scorecard.candidate.detection_rate,
        requiresBaseline: false,
        evaluate: (_baseline: number, candidate: number) => candidate >= 0.75,
      },
      {
        baseline: value.scorecard.baseline.median_detection_delay_weeks,
        candidate: value.scorecard.candidate.median_detection_delay_weeks,
        requiresBaseline: false,
        evaluate: (_baseline: number, candidate: number) => candidate <= 8,
      },
      {
        baseline: value.scorecard.baseline.false_alerts_per_year,
        candidate: value.scorecard.candidate.false_alerts_per_year,
        requiresBaseline: true,
        evaluate: (baseline: number, candidate: number) => candidate <= baseline * 0.8,
      },
      {
        baseline: value.scorecard.baseline.detection_rate,
        candidate: value.scorecard.candidate.detection_rate,
        requiresBaseline: true,
        evaluate: (baseline: number, candidate: number) => candidate >= baseline,
      },
      {
        baseline: value.scorecard.baseline.coverage_confound_false_alert_rate,
        candidate: value.scorecard.candidate.coverage_confound_false_alert_rate,
        requiresBaseline: true,
        evaluate: (baseline: number, candidate: number) => candidate <= baseline,
      },
    ]
    scoredGates.forEach((rule, index) => {
      const gate = value.acceptance_gates[index + 2]
      const baseline = metricValue(rule.baseline)
      const candidate = metricValue(rule.candidate)
      const expectedOutcome = candidate === null || (rule.requiresBaseline && baseline === null)
        ? 'not_applicable'
        : rule.evaluate(baseline ?? 0, candidate) ? 'pass' : 'fail'
      expectedOutcomes.push(expectedOutcome)
      if (gate.outcome !== expectedOutcome) {
        ctx.addIssue({ code: 'custom', path: ['acceptance_gates', index + 2, 'outcome'], message: 'gate outcome must derive from scorecard evidence' })
      }
      if (
        !gate.relevant_values ||
        !sameMeasurement(gate.relevant_values.baseline, rule.baseline) ||
        !sameMeasurement(gate.relevant_values.candidate, rule.candidate)
      ) {
        ctx.addIssue({ code: 'custom', path: ['acceptance_gates', index + 2, 'relevant_values'], message: 'relevant values must mirror scorecard evidence' })
      }
    })
    expectedOutcomes.slice(0, 2).forEach((expectedOutcome, index) => {
      if (value.acceptance_gates[index].outcome !== expectedOutcome) {
        ctx.addIssue({ code: 'custom', path: ['acceptance_gates', index, 'outcome'], message: 'selection gate outcome must derive from viability' })
      }
    })
  })

export type MethodTrialView = z.infer<typeof MethodTrialViewSchema>
export type MethodTrialRepresentativeCase = z.infer<typeof RepresentativeCaseSchema>
export type ScenarioCode = z.infer<typeof ScenarioCodeSchema>
export type GeneratorScenarioCode = z.infer<typeof GeneratorScenarioCodeSchema>
