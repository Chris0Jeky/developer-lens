import { z } from 'zod'

export const METHOD_TRIAL_VIEW_SCHEMA_VERSION = 'DeveloperLensMethodTrialView.v1' as const
export const METHOD_TRIAL_VIEW_CLASSIFICATION = 'C0' as const

export const METHOD_TRIAL_QUESTION =
  'Can the BOCPD candidate reduce false alerts per year versus the rolling median/MAD baseline on the online arm without worsening coverage-confound alerts or interval calibration?' as const
export const METHOD_TRIAL_EVIDENCE =
  'Invented weekly system series only; no real repositories, people, providers, URLs, paths, or production effect.' as const

const boundedNumber = z.number().finite().min(-1_000_000).max(1_000_000)
const boundedCount = z.number().int().min(0).max(10_000)
const unitInterval = z.number().finite().min(0).max(1)
const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const commit = z.string().regex(/^[0-9a-f]{40}$/)

export const ScenarioCodeSchema = z.enum(['no_change_control', 'planted_change', 'instrumentation_confound'])
export type ScenarioCode = z.infer<typeof ScenarioCodeSchema>

export const ClaimCodeSchema = z.enum([
  'baseline_fewer_false_alerts',
  'both_threshold_selections_nonviable',
  'bocpd_not_promoted',
  'c0_synthetic_only_no_real_world_effect',
])
export const LimitationCodeSchema = z.enum([
  'missingness_limits_interpretation',
  'instrumentation_confound_caveat',
  'pelt_offline_only',
  'synthetic_c0_no_real_world_effect',
])
export const SupportedCodeSchema = z.enum(['weekly_relative_grain', 'online_baseline_candidate_comparison', 'offline_pelt_localisation'])
export const UnsupportedCodeSchema = z.enum(['real_world_effect', 'person_or_provider_identity', 'online_pelt_promotion'])

const DatasetSchema = z
  .strictObject({
    system_code: z.literal('WB-C1'),
    opportunity_count: boundedCount,
    observed_count: boundedCount,
    absent_count: boundedCount,
    scenario_codes: z.tuple([z.literal('no_change_control'), z.literal('planted_change'), z.literal('instrumentation_confound')]),
  })
  .superRefine((value, ctx) => {
    if (value.observed_count + value.absent_count !== value.opportunity_count) {
      ctx.addIssue({ code: 'custom', path: ['opportunity_count'], message: 'observed + absent must equal opportunities' })
    }
  })

const MethodCardSchema = z.strictObject({
  method_code: z.enum(['rolling_median_mad', 'bocpd', 'pelt']),
  label: z.string().min(3).max(96),
  family: z.enum(['deterministic_baseline', 'online_candidate', 'offline_descriptive']),
  evaluation_mode: z.enum(['online', 'offline_descriptive']),
  role: z.enum(['baseline', 'candidate', 'offline_descriptive']),
  threshold: boundedNumber.nullable(),
  promotion_eligible: z.boolean(),
})

const MetricSchema = z.strictObject({
  code: z.enum([
    'false_alarms_per_year',
    'onset_to_alert_delay_weeks',
    'interval_coverage',
    'localisation_error_weeks',
    'segment_count_error',
    'coverage_confound_false_alert_rate',
  ]),
  value: boundedNumber.nullable(),
  unit: z.enum(['alerts_per_year', 'weeks', 'proportion', 'count']),
  canonical: z.literal(true),
})

const ThresholdSelectionSchema = z.strictObject({
  method_code: z.enum(['rolling_median_mad', 'bocpd']),
  selected_threshold: boundedNumber.nullable(),
  viable: z.boolean(),
  reason_code: z.enum(['INSUFFICIENT_SUPPORT', 'NO_STABLE_SELECTION', 'PRIMARY_GATE_FAILED', 'SELECTED']),
})

const ScorecardSchema = z.strictObject({
  primary_metric: z.literal('false_alarms_per_year'),
  metrics: z.array(MetricSchema).min(6).max(6),
  threshold_selection: z.strictObject({
    baseline: ThresholdSelectionSchema,
    candidate: ThresholdSelectionSchema,
  }),
})

const GateSchema = z.strictObject({
  order: z.number().int().min(1).max(8),
  gate_code: z.enum(['support', 'threshold_selection', 'online_primary', 'coverage_confound', 'calibration', 'promotion']),
  outcome: z.enum(['pass', 'fail', 'not_run']),
  reason_code: z.enum([
    'SUPPORT_SUFFICIENT',
    'SUPPORT_INSUFFICIENT',
    'BOTH_SELECTIONS_NONVIABLE',
    'BASELINE_WINS_PRIMARY',
    'COVERAGE_CONFOUND_LIMIT',
    'CALIBRATION_LIMIT',
    'PELT_OFFLINE_ONLY',
    'CANDIDATE_NOT_PROMOTED',
  ]),
})

const DecisionSchema = z.strictObject({
  outcome: z.literal('reject'),
  reason_codes: z.array(z.enum(['BOTH_SELECTIONS_NONVIABLE', 'BASELINE_WINS_PRIMARY', 'COVERAGE_CONFOUND_LIMIT', 'CALIBRATION_LIMIT'])).min(1),
  fallback: z.strictObject({
    method_code: z.literal('rolling_median_mad'),
    retained: z.literal(true),
  }),
  candidate_promoted: z.literal(false),
})

const PointSchema = z
  .strictObject({
    week_index: z.number().int().min(0).max(103),
    week_label: z.string().regex(/^week-[0-9]{2}$/),
    observed: z.boolean(),
    value: boundedNumber.nullable(),
    baseline_score: boundedNumber.nullable(),
    baseline_threshold: boundedNumber.nullable(),
    baseline_alert: z.boolean(),
    candidate_probability: unitInterval.nullable(),
    candidate_threshold: unitInterval.nullable(),
    candidate_alert: z.boolean(),
    planted_marker: z.enum(['none', 'level', 'variance', 'trend', 'seasonal']),
    confound_marker: z.enum(['none', 'permission_loss', 'actions_cap', 'shallow_boundary', 'parser_major_change']),
  })
  .superRefine((value, ctx) => {
    const expected = `week-${String(value.week_index).padStart(2, '0')}`
    if (value.week_label !== expected) ctx.addIssue({ code: 'custom', path: ['week_label'], message: 'week label must be deterministic' })
    if (!value.observed) {
      for (const key of ['value', 'baseline_score', 'baseline_threshold', 'candidate_probability', 'candidate_threshold'] as const) {
        if (value[key] !== null) ctx.addIssue({ code: 'custom', path: [key], message: 'unobserved points must be null' })
      }
      if (value.baseline_alert || value.candidate_alert) ctx.addIssue({ code: 'custom', message: 'unobserved points cannot alert' })
    }
    if (value.planted_marker !== 'none' && value.confound_marker !== 'none') {
      ctx.addIssue({ code: 'custom', message: 'a point cannot be both planted and confounded' })
    }
  })

const TimelineSchema = z
  .strictObject({
    order: z.number().int().min(1).max(3),
    scenario_code: ScenarioCodeSchema,
    title: z.string().min(3).max(96),
    points: z.array(PointSchema).min(52).max(104),
    pelt: z.strictObject({
      evaluation_mode: z.literal('offline_descriptive'),
      boundary_index: z.number().int().min(0).max(103).nullable(),
    }),
  })
  .superRefine((value, ctx) => {
    for (let index = 0; index < value.points.length; index += 1) {
      if (value.points[index].week_index !== index) {
        ctx.addIssue({ code: 'custom', path: ['points', index, 'week_index'], message: 'point indices must be sequential' })
      }
    }
    const planted = value.points.filter((point) => point.planted_marker !== 'none')
    const confounded = value.points.filter((point) => point.confound_marker !== 'none')
    if (value.scenario_code === 'no_change_control' && (planted.length || confounded.length)) {
      ctx.addIssue({ code: 'custom', path: ['scenario_code'], message: 'no-change control has no markers' })
    }
    if (value.scenario_code === 'planted_change' && planted.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['points'], message: 'planted scenario requires a planted marker' })
    }
    if (value.scenario_code === 'instrumentation_confound' && confounded.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['points'], message: 'confound scenario requires an instrumentation marker' })
    }
    if (value.pelt.boundary_index !== null && value.pelt.boundary_index >= value.points.length) {
      ctx.addIssue({ code: 'custom', path: ['pelt', 'boundary_index'], message: 'PELT boundary must be within the timeline' })
    }
  })

const ReproducibilitySchema = z.strictObject({
  safe_run_id: z.string().regex(/^run-[a-z0-9][a-z0-9-]{7,63}$/),
  product_research_pack_commit: commit,
  product_schema_source_commit: commit,
  lab_code_commit: commit,
  sha256_digests: z.strictObject({
    method_trial_schema: sha256,
    research_pack: sha256,
    lab_fixture: sha256,
  }),
  normalized_path_free_commands: z.array(z.string().regex(/^(?:npm|node|npx|python)(?: [A-Za-z0-9_.:@=-]+)*$/)).min(1).max(12),
})

const SelectorSchema = z.strictObject({
  query_key: z.literal('view'),
  selected_view: z.literal('method-trial'),
  allowed_views: z.array(z.literal('method-trial')).length(1),
  default_scenario: ScenarioCodeSchema,
})

export const MethodTrialViewSchema = z
  .strictObject({
    schema_version: z.literal(METHOD_TRIAL_VIEW_SCHEMA_VERSION),
    classification: z.literal(METHOD_TRIAL_VIEW_CLASSIFICATION),
    trial: z.strictObject({
      trial_code: z.literal('WB-C1'),
      question: z.literal(METHOD_TRIAL_QUESTION),
      evidence: z.literal(METHOD_TRIAL_EVIDENCE),
    }),
    dataset: DatasetSchema,
    methods: z.strictObject({
      baseline: MethodCardSchema,
      candidate: MethodCardSchema,
      offline_descriptive: MethodCardSchema,
    }),
    scorecard: ScorecardSchema,
    gates: z.array(GateSchema).length(6),
    decision: DecisionSchema,
    supported_codes: z.array(SupportedCodeSchema).min(1),
    unsupported_codes: z.array(UnsupportedCodeSchema).min(1),
    limitation_codes: z.array(LimitationCodeSchema).min(1),
    claim_codes: z.array(ClaimCodeSchema).min(1),
    selector: SelectorSchema,
    reproducibility: ReproducibilitySchema,
    timelines: z.array(TimelineSchema).length(3),
  })
  .superRefine((value, ctx) => {
    const expectedRoles = ['baseline', 'candidate', 'offline_descriptive'] as const
    const methods = [value.methods.baseline, value.methods.candidate, value.methods.offline_descriptive]
    methods.forEach((method, index) => {
      if (method.role !== expectedRoles[index]) ctx.addIssue({ code: 'custom', path: ['methods'], message: 'method roles are fixed' })
    })
    if (value.methods.baseline.method_code !== 'rolling_median_mad' || value.methods.candidate.method_code !== 'bocpd' || value.methods.offline_descriptive.method_code !== 'pelt') {
      ctx.addIssue({ code: 'custom', path: ['methods'], message: 'method codes are fixed' })
    }
    if (value.methods.offline_descriptive.promotion_eligible || value.methods.offline_descriptive.evaluation_mode !== 'offline_descriptive') {
      ctx.addIssue({ code: 'custom', path: ['methods', 'offline_descriptive'], message: 'PELT is offline descriptive only' })
    }
    const expectedGates = ['support', 'threshold_selection', 'online_primary', 'coverage_confound', 'calibration', 'promotion']
    if (value.gates.some((gate, index) => gate.order !== index + 1 || gate.gate_code !== expectedGates[index])) ctx.addIssue({ code: 'custom', path: ['gates'], message: 'gate order and codes are fixed' })
    if (value.timelines.some((timeline, index) => timeline.order !== index + 1)) ctx.addIssue({ code: 'custom', path: ['timelines'], message: 'timeline order must be 1..3' })
    if (value.timelines.map((timeline) => timeline.scenario_code).join('|') !== 'no_change_control|planted_change|instrumentation_confound') {
      ctx.addIssue({ code: 'custom', path: ['timelines'], message: 'timeline scenarios have a fixed order' })
    }
    if (value.scorecard.threshold_selection.baseline.viable || value.scorecard.threshold_selection.candidate.viable) {
      ctx.addIssue({ code: 'custom', path: ['scorecard', 'threshold_selection'], message: 'both threshold selections must be nonviable for this rejected trial' })
    }
  })

export type MethodTrialView = z.infer<typeof MethodTrialViewSchema>
export type MethodTrialTimeline = z.infer<typeof TimelineSchema>

export const METHOD_TRIAL_VIEW_CLAIM_CODES = ClaimCodeSchema.options
export const METHOD_TRIAL_VIEW_LIMITATION_CODES = LimitationCodeSchema.options
