import { createHash } from 'node:crypto'
import { z } from 'zod'

export const RESEARCH_FINDING_SCHEMA_VERSION = 'ResearchFindingProjection.v1' as const
export const RESEARCH_FINDING_PUBLIC_URL = 'https://chris0jeky.github.io/developer-lens/?view=method-trial' as const
export const RESEARCH_FINDING_PRODUCER = 'developer-lens-lab' as const
export const RESEARCH_FINDING_LAB_COMMIT = '0ef193070a9b80b81cef5a1710a1d65e0b271c15' as const
export const RESEARCH_FINDING_PRODUCT_COMMIT = 'b48fea579936671397a0486ae7a0342197ee6e4b' as const

export const METHODS = {
  rolling_median_mad: 'Rolling median and MAD',
  bocpd_gaussian: 'Gaussian BOCPD',
  pelt_offline: 'PELT descriptive marker',
} as const
export type MethodCode = keyof typeof METHODS

export const METRICS = {
  detection_rate: { label: 'Detection rate', unit: 'rate', better_when: 'higher' },
  false_alerts_per_year: { label: 'False alerts per year', unit: 'count_per_year', better_when: 'lower' },
} as const
export type MetricCode = keyof typeof METRICS

export const GATES = {
  baseline_selection: 'Baseline selection is viable',
  candidate_selection: 'Candidate selection is viable',
  detection_floor: 'Candidate meets detection floor',
  delay_budget: 'Candidate meets delay budget',
  false_alert_improvement: 'Candidate false alerts improve',
  not_worse_detection: 'Candidate detection is not worse',
  confound_guard: 'Candidate confound guard is measured',
} as const
export type GateCode = keyof typeof GATES

export const LIMITATIONS = {
  c0_synthetic_only: 'Evidence is limited to invented C0 weekly system series.',
  bounded_three_case_selection: 'Only three bounded representative windows are exported.',
  missingness_and_confound: 'Missing observations and instrumentation confounds are explicit.',
  thresholds_nonviable: 'Both threshold selections are nonviable.',
} as const
export type LimitationCode = keyof typeof LIMITATIONS

export const UNSUPPORTED_CLAIMS = {
  real_repository_validity: 'This result does not establish validity on real repositories.',
  person_level_inference: 'No person-level inference is supported or attempted.',
  model_promotion: 'This rejected trial cannot promote a model.',
  online_pelt_performance: 'Offline PELT markers do not establish online performance.',
} as const
export type UnsupportedClaimCode = keyof typeof UNSUPPORTED_CLAIMS

const methodCode = z.enum(Object.keys(METHODS) as [MethodCode, ...MethodCode[]])
const boundedText = z.string().min(1).max(240)
const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const commit = z.string().regex(/^[0-9a-f]{40}$/)

const canonicalUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/).superRefine((value, ctx) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.toISOString().replace(/\.\d{3}Z$/, 'Z') !== value.replace(/\.\d{1,6}Z$/, 'Z')) {
    ctx.addIssue({ code: 'custom', message: 'generated_at must be a valid canonical UTC instant' })
  }
})

const method = z.discriminatedUnion('method_code', [
  z.strictObject({ method_code: z.literal('rolling_median_mad'), display_name: z.literal(METHODS.rolling_median_mad) }),
  z.strictObject({ method_code: z.literal('bocpd_gaussian'), display_name: z.literal(METHODS.bocpd_gaussian) }),
  z.strictObject({ method_code: z.literal('pelt_offline'), display_name: z.literal(METHODS.pelt_offline) }),
])
const unavailable = z.strictObject({ status: z.literal('unavailable') })
const metric = z.discriminatedUnion('key', [
  z.strictObject({
    key: z.literal('detection_rate'), label: z.literal(METRICS.detection_rate.label), unit: z.literal('rate'),
    better_when: z.literal('higher'), baseline: z.union([z.strictObject({ status: z.literal('measured'), value: z.number().finite().min(0).max(1) }), unavailable]),
    candidate: z.union([z.strictObject({ status: z.literal('measured'), value: z.number().finite().min(0).max(1) }), unavailable]),
  }),
  z.strictObject({
    key: z.literal('false_alerts_per_year'), label: z.literal(METRICS.false_alerts_per_year.label), unit: z.literal('count_per_year'),
    better_when: z.literal('lower'), baseline: z.union([z.strictObject({ status: z.literal('measured'), value: z.number().finite().min(0).max(10_000) }), unavailable]),
    candidate: z.union([z.strictObject({ status: z.literal('measured'), value: z.number().finite().min(0).max(10_000) }), unavailable]),
  }),
])
const gate = z.discriminatedUnion('code', [
  z.strictObject({ code: z.literal('baseline_selection'), label: z.literal(GATES.baseline_selection), passed: z.boolean().nullable() }),
  z.strictObject({ code: z.literal('candidate_selection'), label: z.literal(GATES.candidate_selection), passed: z.boolean().nullable() }),
  z.strictObject({ code: z.literal('detection_floor'), label: z.literal(GATES.detection_floor), passed: z.boolean().nullable() }),
  z.strictObject({ code: z.literal('delay_budget'), label: z.literal(GATES.delay_budget), passed: z.boolean().nullable() }),
  z.strictObject({ code: z.literal('false_alert_improvement'), label: z.literal(GATES.false_alert_improvement), passed: z.boolean().nullable() }),
  z.strictObject({ code: z.literal('not_worse_detection'), label: z.literal(GATES.not_worse_detection), passed: z.boolean().nullable() }),
  z.strictObject({ code: z.literal('confound_guard'), label: z.literal(GATES.confound_guard), passed: z.boolean().nullable() }),
])
const limitation = z.discriminatedUnion('code', [
  z.strictObject({ code: z.literal('c0_synthetic_only'), display_text: z.literal(LIMITATIONS.c0_synthetic_only) }),
  z.strictObject({ code: z.literal('bounded_three_case_selection'), display_text: z.literal(LIMITATIONS.bounded_three_case_selection) }),
  z.strictObject({ code: z.literal('missingness_and_confound'), display_text: z.literal(LIMITATIONS.missingness_and_confound) }),
  z.strictObject({ code: z.literal('thresholds_nonviable'), display_text: z.literal(LIMITATIONS.thresholds_nonviable) }),
])
const unsupportedClaim = z.discriminatedUnion('code', [
  z.strictObject({ code: z.literal('real_repository_validity'), display_text: z.literal(UNSUPPORTED_CLAIMS.real_repository_validity) }),
  z.strictObject({ code: z.literal('person_level_inference'), display_text: z.literal(UNSUPPORTED_CLAIMS.person_level_inference) }),
  z.strictObject({ code: z.literal('model_promotion'), display_text: z.literal(UNSUPPORTED_CLAIMS.model_promotion) }),
  z.strictObject({ code: z.literal('online_pelt_performance'), display_text: z.literal(UNSUPPORTED_CLAIMS.online_pelt_performance) }),
])

const ResearchFindingContentSchema = z.strictObject({
  schema_version: z.literal(RESEARCH_FINDING_SCHEMA_VERSION),
  classification: z.enum(['C0', 'C1']),
  subject_class: z.enum(['software-system', 'repository', 'instrument', 'aggregate-window']),
  generated_at: canonicalUtc,
  finding: z.strictObject({ id: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), title: boundedText, question: boundedText }),
  methods: z.strictObject({ baseline: method, candidate: method }),
  decision: z.strictObject({ outcome: z.enum(['reject', 'revise_once', 'benchmarked']), retained_fallback: methodCode.nullable(), summary: boundedText }),
  metrics: z.array(metric).min(1).max(6),
  gates: z.array(gate).max(8).optional(),
  limitations: z.array(limitation).min(1).max(8),
  unsupported_claims: z.array(unsupportedClaim).min(1).max(8),
  provenance: z.strictObject({ producer: z.literal(RESEARCH_FINDING_PRODUCER), source_lab_commit: commit, source_product_contract_commit: commit, bundle_hash: sha256, public_url: z.literal(RESEARCH_FINDING_PUBLIC_URL).optional() }),
}).superRefine((value, ctx) => {
  if (value.methods.baseline.method_code === value.methods.candidate.method_code) ctx.addIssue({ code: 'custom', path: ['methods'], message: 'baseline and candidate methods must be distinct' })
  if (value.methods.baseline.method_code === 'pelt_offline' || value.methods.candidate.method_code === 'pelt_offline') ctx.addIssue({ code: 'custom', path: ['methods'], message: 'pelt_offline is reserved for a future offline metric schema' })
  const metricKeys = value.metrics.map((item) => item.key)
  if (new Set(metricKeys).size !== metricKeys.length) ctx.addIssue({ code: 'custom', path: ['metrics'], message: 'metric keys must be unique' })
  if (value.gates) {
    const gateCodes = value.gates.map((item) => item.code)
    if (new Set(gateCodes).size !== gateCodes.length) ctx.addIssue({ code: 'custom', path: ['gates'], message: 'gate codes must be unique' })
    const expected = gateCodes.slice().sort((a, b) => Object.keys(GATES).indexOf(a) - Object.keys(GATES).indexOf(b))
    if (gateCodes.some((code, index) => code !== expected[index])) ctx.addIssue({ code: 'custom', path: ['gates'], message: 'gates must use registry order' })
  }
  const limitationCodes = value.limitations.map((item) => item.code)
  if (new Set(limitationCodes).size !== limitationCodes.length) ctx.addIssue({ code: 'custom', path: ['limitations'], message: 'limitation codes must be unique' })
  const unsupportedCodes = value.unsupported_claims.map((item) => item.code)
  if (new Set(unsupportedCodes).size !== unsupportedCodes.length) ctx.addIssue({ code: 'custom', path: ['unsupported_claims'], message: 'unsupported claim codes must be unique' })
  const worse = value.metrics.some((item) => item.baseline.status === 'measured' && item.candidate.status === 'measured' && (item.better_when === 'higher' ? item.candidate.value < item.baseline.value : item.candidate.value > item.baseline.value))
  const failedGate = value.gates?.some((item) => item.passed === false) ?? false
  const falseAlertMetric = value.metrics.find((item) => item.key === 'false_alerts_per_year')
  const detectionMetric = value.metrics.find((item) => item.key === 'detection_rate')
  const falseAlertGate = value.gates?.find((item) => item.code === 'false_alert_improvement')
  const detectionGate = value.gates?.find((item) => item.code === 'not_worse_detection')
  if (falseAlertMetric?.baseline.status === 'measured' && falseAlertMetric.candidate.status === 'measured' && falseAlertGate) {
    if (falseAlertGate.passed !== (falseAlertMetric.candidate.value < falseAlertMetric.baseline.value)) ctx.addIssue({ code: 'custom', path: ['gates'], message: 'false_alert_improvement must match measured metric values' })
  }
  if (detectionMetric?.baseline.status === 'measured' && detectionMetric.candidate.status === 'measured' && detectionGate) {
    if (detectionGate.passed !== (detectionMetric.candidate.value >= detectionMetric.baseline.value)) ctx.addIssue({ code: 'custom', path: ['gates'], message: 'not_worse_detection must match measured metric values' })
  }
  if (value.decision.outcome === 'reject') {
    if (value.decision.retained_fallback !== value.methods.baseline.method_code) ctx.addIssue({ code: 'custom', path: ['decision', 'retained_fallback'], message: 'reject must retain the baseline method' })
    if (!worse && !failedGate) ctx.addIssue({ code: 'custom', path: ['decision'], message: 'reject requires worse measured metric or failed gate' })
  } else if (value.decision.retained_fallback !== null) ctx.addIssue({ code: 'custom', path: ['decision', 'retained_fallback'], message: 'non-reject decisions cannot retain a fallback' })
})
export const ResearchFindingSchema = ResearchFindingContentSchema.superRefine((value, ctx) => {
  if (value.provenance.bundle_hash !== computeResearchFindingBundleHash(value)) ctx.addIssue({ code: 'custom', path: ['provenance', 'bundle_hash'], message: 'bundle_hash does not match the canonical artifact body' })
})
export { ResearchFindingContentSchema }
export type ResearchFinding = z.infer<typeof ResearchFindingSchema>
export const ResearchFindingProjectionSchema = ResearchFindingSchema
export type ResearchFindingProjection = ResearchFinding

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (index + 1 >= value.length || next < 0xdc00 || next > 0xdfff) return true
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) return true
  }
  return false
}

export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    if (typeof value === 'string' && hasLoneSurrogate(value)) throw new Error('JCS rejects lone surrogates')
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JCS rejects non-finite numbers')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) if (!(index in value)) throw new Error('JCS rejects sparse arrays')
    return `[${value.map(canonicalizeJson).join(',')}]`
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>
    const prototype = Object.getPrototypeOf(object)
    if (prototype !== Object.prototype && prototype !== null) throw new Error('JCS accepts plain objects only')
    if (Object.prototype.hasOwnProperty.call(object, 'toJSON')) throw new Error('JCS rejects toJSON')
    return `{${Object.keys(object).sort().map((key) => {
      if (hasLoneSurrogate(key)) throw new Error('JCS rejects lone surrogates')
      return `${JSON.stringify(key)}:${canonicalizeJson(object[key])}`
    }).join(',')}}`
  }
  throw new Error('JCS rejects unsupported values')
}
export const canonicalizeJcs = canonicalizeJson

export function computeResearchFindingBundleHash(value: Omit<ResearchFinding, 'provenance'> & { provenance: Omit<ResearchFinding['provenance'], 'bundle_hash'> & { bundle_hash?: string } }): string {
  const body = structuredClone(value) as Record<string, unknown>
  delete (body.provenance as Record<string, unknown>).bundle_hash
  return `sha256:${createHash('sha256').update(canonicalizeJson(body), 'utf8').digest('hex')}`
}

// The handle branch admits a leading digit: GitHub handles are alphanumeric-or-hyphen and may
// start with a digit, so a leading-letter-only class let @1 / @123 / @0xdeadbeef past every
// branch of this pattern and out through the public projection unredacted.
const DENIED_TOKEN = /(?:@[A-Za-z0-9][A-Za-z0-9_-]{0,38}|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|(?:[A-Za-z]:\\|\/|\\)[^\s"']+|\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b)/
const DATE_TOKEN = /\b\d{4}-\d{2}-\d{2}\b/

export function researchFindingPrivacyViolations(value: unknown): string[] {
  const violations: string[] = []
  const visit = (item: unknown, path: string): void => {
    if (typeof item === 'string') {
      if (path.endsWith('.public_url')) {
        if (item !== RESEARCH_FINDING_PUBLIC_URL) violations.push('non-allowlisted public_url')
        return
      }
      if (!path.endsWith('.generated_at') && DATE_TOKEN.test(item)) violations.push('date outside generated_at')
      if (DENIED_TOKEN.test(item)) violations.push('denied identity, email, path, or repository token')
    } else if (Array.isArray(item)) item.forEach((nested, index) => visit(nested, `${path}[${index}]`))
    else if (item && typeof item === 'object') Object.entries(item).forEach(([key, nested]) => visit(nested, `${path}.${key}`))
  }
  visit(value, '$')
  return [...new Set(violations)]
}

export function assertResearchFindingPrivacy(value: unknown): void {
  const violations = researchFindingPrivacyViolations(value)
  if (violations.length > 0) throw new Error(`research finding privacy boundary failed: ${violations.join('; ')}`)
}

export function stableJson(value: unknown): string {
  const sort = (item: unknown): unknown => Array.isArray(item) ? item.map(sort) : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, nested]) => [key, sort(nested)])) : item
  return `${JSON.stringify(sort(value), null, 2)}\n`
}
