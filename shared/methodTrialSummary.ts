import { z } from 'zod'
import {
  METHOD_TRIAL_QUESTION,
  METHOD_TRIAL_TITLE,
} from './methodTrialView.js'

export const METHOD_TRIAL_SUMMARY_SCHEMA_VERSION = 'DeveloperLensMethodTrialSummary.v1' as const
export const METHOD_TRIAL_PUBLIC_URL = 'https://chris0jeky.github.io/developer-lens/?view=method-trial' as const

const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const commit = z.string().regex(/^[0-9a-f]{40}$/)

const limitationText = z.enum([
  'Evidence is limited to invented C0 weekly system series.',
  'Only three bounded representative windows are exported.',
  'Missing observations and instrumentation confounds are explicit.',
  'Both threshold selections are nonviable.',
])

const unsupportedClaimText = z.enum([
  'This result does not establish validity on real repositories.',
  'No person-level inference is supported or attempted.',
  'This rejected trial cannot promote a model.',
  'Offline PELT markers do not establish online performance.',
])

const measured = z.strictObject({
  status: z.literal('measured'),
  value: z.number().finite().min(0).max(1_000_000),
})

const metricPair = z.strictObject({
  baseline: measured,
  candidate: measured,
})

const limitation = z.strictObject({
  code: z.enum([
    'c0_synthetic_only',
    'bounded_three_case_selection',
    'missingness_and_confound',
    'thresholds_nonviable',
  ]),
  display_text: limitationText,
})

const unsupportedClaim = z.strictObject({
  code: z.enum([
    'real_repository_validity',
    'person_level_inference',
    'model_promotion',
    'online_pelt_performance',
  ]),
  display_text: unsupportedClaimText,
})

/**
 * A compact, public projection of the frozen C0 method-trial view.
 *
 * This is deliberately not a second research result: the producer derives it only after
 * MethodTrialViewSchema.parse succeeds. Consumers can display this small artifact without
 * copying the 100KB+ timeline fixture or exposing its representative points.
 */
export const MethodTrialSummarySchema = z
  .strictObject({
  schema_version: z.literal(METHOD_TRIAL_SUMMARY_SCHEMA_VERSION),
  classification: z.literal('C0'),
  trial: z.strictObject({
    title: z.literal(METHOD_TRIAL_TITLE),
    question: z.literal(METHOD_TRIAL_QUESTION),
    verdict: z.literal('reject'),
    verdict_summary: z.literal('The candidate is rejected because both selections are nonviable and false alerts are higher.'),
  }),
  methods: z.strictObject({
    baseline: z.strictObject({
      method_code: z.literal('rolling_median_mad'),
      display_name: z.literal('Rolling median and MAD'),
    }),
    candidate: z.strictObject({
      method_code: z.literal('bocpd_gaussian'),
      display_name: z.literal('Gaussian BOCPD'),
    }),
  }),
  metrics: z.strictObject({
    false_alerts_per_year: metricPair,
    detection_rate: metricPair,
  }),
  threshold_viability: z.strictObject({
    baseline: z.literal(false),
    candidate: z.literal(false),
  }),
  retained_fallback: z.strictObject({
    method_code: z.literal('rolling_median_mad'),
    retained: z.literal(true),
  }),
  limitations: z.array(limitation).length(4),
  unsupported_claims: z.array(unsupportedClaim).length(4),
    provenance: z.strictObject({
      source_fixture_sha256: sha256,
      source_contract_schema_sha256: sha256,
      source_lab_commit: commit,
      source_product_contract_commit: commit,
      run_id: z.literal('wbc1_demo'),
      public_url: z.literal(METHOD_TRIAL_PUBLIC_URL),
      derivation: z.literal('MethodTrialViewSchema.parse'),
    }),
  })
  .superRefine((value, ctx) => {
    const baselineFalseAlerts = value.metrics.false_alerts_per_year.baseline.value
    const candidateFalseAlerts = value.metrics.false_alerts_per_year.candidate.value
    const baselineDetection = value.metrics.detection_rate.baseline.value
    const candidateDetection = value.metrics.detection_rate.candidate.value
    if (candidateFalseAlerts <= baselineFalseAlerts) {
      ctx.addIssue({
        code: 'custom',
        path: ['metrics', 'false_alerts_per_year', 'candidate'],
        message: 'the rejected candidate must have more false alerts than baseline',
      })
    }
    if (candidateDetection !== baselineDetection) {
      ctx.addIssue({
        code: 'custom',
        path: ['metrics', 'detection_rate', 'candidate'],
        message: 'the frozen trial records equal baseline and candidate detection',
      })
    }
    const codes = value.limitations.map(({ code }) => code)
    if (new Set(codes).size !== codes.length || codes.length !== 4) {
      ctx.addIssue({ code: 'custom', path: ['limitations'], message: 'limitations must be unique and complete' })
    }
    const limitationDisplayText: Record<(typeof codes)[number], string> = {
      c0_synthetic_only: 'Evidence is limited to invented C0 weekly system series.',
      bounded_three_case_selection: 'Only three bounded representative windows are exported.',
      missingness_and_confound: 'Missing observations and instrumentation confounds are explicit.',
      thresholds_nonviable: 'Both threshold selections are nonviable.',
    }
    value.limitations.forEach((item, index) => {
      if (item.display_text !== limitationDisplayText[item.code]) {
        ctx.addIssue({ code: 'custom', path: ['limitations', index], message: 'limitation text must match its code' })
      }
    })
    const unsupportedCodes = value.unsupported_claims.map(({ code }) => code)
    if (new Set(unsupportedCodes).size !== unsupportedCodes.length || unsupportedCodes.length !== 4) {
      ctx.addIssue({
        code: 'custom',
        path: ['unsupported_claims'],
        message: 'unsupported claims must be unique and complete',
      })
    }
    const unsupportedDisplayText: Record<(typeof unsupportedCodes)[number], string> = {
      real_repository_validity: 'This result does not establish validity on real repositories.',
      person_level_inference: 'No person-level inference is supported or attempted.',
      model_promotion: 'This rejected trial cannot promote a model.',
      online_pelt_performance: 'Offline PELT markers do not establish online performance.',
    }
    value.unsupported_claims.forEach((item, index) => {
      if (item.display_text !== unsupportedDisplayText[item.code]) {
        ctx.addIssue({
          code: 'custom',
          path: ['unsupported_claims', index],
          message: 'unsupported claim text must match its code',
        })
      }
    })
  })

export type MethodTrialSummary = z.infer<typeof MethodTrialSummarySchema>
