import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  METHOD_TRIAL_PUBLIC_URL,
  MethodTrialSummarySchema,
} from '../shared/methodTrialSummary.js'
import { MethodTrialViewSchema } from '../shared/methodTrialView.js'

const CONTRACT_ROOT = ['research-contracts', 'method-trial-view', 'v1'] as const
const SUMMARY_ROOT = ['research-contracts', 'method-trial-summary', 'v1'] as const
const METHOD_TRIAL_FIXTURE = [...CONTRACT_ROOT, 'wbc1.fixture.json'] as const

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, stableValue(nested)]),
    )
  }
  return value
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`
}

type JsonObject = Record<string, any>

function fixedObject(properties: JsonObject): JsonObject {
  return { type: 'object', properties, required: Object.keys(properties) }
}

function enrichStandaloneSchema(value: unknown): JsonObject {
  const schema = value as JsonObject
  schema.$schema = 'https://json-schema.org/draft/2020-12/schema'
  schema.$comment =
    'Structural transport validation only. Semantic acceptance requires shared/methodTrialView.ts#MethodTrialViewSchema, or an equivalent implementation of its cross-field rules, before this artifact is accepted or displayed.'
  const root = schema.properties as JsonObject

  const scenarioCodes = root.dataset.properties.scenario_codes as JsonObject
  scenarioCodes.minItems = 9
  scenarioCodes.maxItems = 9
  scenarioCodes.items = false
  const representativeSelection = root.representative_selection.properties as JsonObject
  for (const [key, length] of [['planted_preference', 4], ['confound_preference', 3]] as const) {
    representativeSelection[key].minItems = length
    representativeSelection[key].maxItems = length
    representativeSelection[key].items = false
  }
  for (const [key, value] of Object.entries({
    system_count: 54,
    weekly_opportunity_count: 5616,
    observed_count: 5346,
    absent_count: 270,
  })) {
    root.dataset.properties[key] = { const: value }
  }

  const methods = root.methods.properties as JsonObject
  methods.baseline.allOf = [
    fixedObject({
      role: { const: 'baseline' },
      method_code: { const: 'rolling_median_mad' },
      deterministic: { const: true },
    }),
  ]
  methods.candidate.allOf = [
    fixedObject({
      role: { const: 'candidate' },
      method_code: { const: 'bocpd_gaussian' },
      deterministic: { const: true },
    }),
  ]
  methods.offline_pelt.allOf = [
    fixedObject({
      role: { const: 'offline_descriptive' },
      method_code: { const: 'pelt' },
      deterministic: { const: true },
    }),
  ]

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
  const gates = root.acceptance_gates as JsonObject
  const gateItem = gates.items as JsonObject
  gates.minItems = gateCodes.length
  gates.maxItems = gateCodes.length
  gates.prefixItems = gateCodes.map((code, index) => ({
    allOf: [
      gateItem,
      fixedObject({ order: { const: index + 1 }, code: { const: code }, reason_code: { const: gateReasons[index] } }),
      ...(index >= 2 ? [{ type: 'object', required: ['relevant_values'] }] : []),
    ],
  }))
  gates.items = false

  const scenarios = [
    ['no_change_control', 'no_change', 'fixed_first_window'],
    ['planted_change', 'level', 'fixed_change_window'],
    ['instrumentation_confound', 'parser_shift', 'fixed_confound_window'],
  ] as const
  const representativeCases = root.representative_cases as JsonObject
  const representativeCaseItem = representativeCases.items as JsonObject
  representativeCases.minItems = scenarios.length
  representativeCases.maxItems = scenarios.length
  representativeCases.prefixItems = scenarios.map(([role, scenarioCode, selectionCode], index) => ({
    allOf: [
      representativeCaseItem,
      fixedObject({
        order: { const: index + 1 },
        role: { const: role },
        scenario_code: { const: scenarioCode },
        selection_rule: fixedObject({
          code: { const: selectionCode },
          deterministic: { const: true },
        }),
      }),
    ],
  }))
  representativeCases.items = false

  const point = representativeCaseItem.properties.points.items as JsonObject
  point.allOf = [
    {
      if: {
        properties: {
          observed: fixedObject({ state: { const: 'missing' } }),
        },
        required: ['observed'],
      },
      then: {
        properties: {
          baseline: fixedObject({
            alert: { const: false },
            score: fixedObject({ status: { const: 'unavailable' } }),
          }),
          candidate: fixedObject({
            alert: { const: false },
            probability: fixedObject({ status: { const: 'unavailable' } }),
          }),
        },
        required: ['baseline', 'candidate'],
      },
    },
  ]

  return schema
}

export function renderMethodTrialViewSchema(): string {
  return stableJson(enrichStandaloneSchema(z.toJSONSchema(MethodTrialViewSchema)))
}

export function renderMethodTrialSummarySchema(): string {
  const schema = z.toJSONSchema(MethodTrialSummarySchema) as JsonObject
  schema.$schema = 'https://json-schema.org/draft/2020-12/schema'
  schema.$comment =
    'Structural transport validation only. The producer derives this projection only after MethodTrialViewSchema.parse succeeds; consumers must still treat it as invented C0 evidence and preserve its limitations.'
  return stableJson(schema)
}

export function summarySha256(summaryText: string): string {
  return `sha256:${createHash('sha256').update(summaryText, 'utf8').digest('hex')}`
}

export async function deriveMethodTrialSummary(root = process.cwd()): Promise<string> {
  const fixturePath = resolve(root, ...METHOD_TRIAL_FIXTURE)
  const fixtureText = await readFile(fixturePath, 'utf8')
  const view = MethodTrialViewSchema.parse(JSON.parse(fixtureText))
  const sourceFixtureSha256 = `sha256:${createHash('sha256').update(fixtureText, 'utf8').digest('hex')}`
  const summary = MethodTrialSummarySchema.parse({
    schema_version: 'DeveloperLensMethodTrialSummary.v1',
    classification: view.trial.classification,
    trial: {
      title: view.trial.title,
      question: view.trial.question,
      verdict: view.decision.outcome,
      verdict_summary: view.decision.summary,
    },
    methods: {
      baseline: {
        method_code: view.methods.baseline.method_code,
        display_name: view.methods.baseline.display_name,
      },
      candidate: {
        method_code: view.methods.candidate.method_code,
        display_name: view.methods.candidate.display_name,
      },
    },
    metrics: {
      false_alerts_per_year: {
        baseline: view.scorecard.baseline.false_alerts_per_year,
        candidate: view.scorecard.candidate.false_alerts_per_year,
      },
      detection_rate: {
        baseline: view.scorecard.baseline.detection_rate,
        candidate: view.scorecard.candidate.detection_rate,
      },
    },
    threshold_viability: {
      baseline: view.scorecard.threshold_selection.baseline.viable,
      candidate: view.scorecard.threshold_selection.candidate.viable,
    },
    retained_fallback: view.decision.fallback,
    limitations: view.claims.limitations,
    unsupported_claims: view.claims.unsupported,
    provenance: {
      source_fixture_sha256: sourceFixtureSha256,
      source_contract_schema_sha256: schemaSha256(),
      source_lab_commit: view.reproducibility.lab_commit,
      source_product_contract_commit: view.reproducibility.product_contract_commit,
      run_id: view.reproducibility.run_id,
      public_url: METHOD_TRIAL_PUBLIC_URL,
      derivation: 'MethodTrialViewSchema.parse',
    },
  })
  return stableJson(summary)
}

export function normalizeGeneratedText(text: string): string {
  return text.replaceAll('\r\n', '\n')
}

async function checkOrWrite(path: string, content: string, check: boolean, label: string): Promise<void> {
  if (check) {
    let existing: string
    try {
      existing = await readFile(path, 'utf8')
    } catch {
      throw new Error(`${label} is missing: ${path}`)
    }
    if (normalizeGeneratedText(existing) !== normalizeGeneratedText(content)) {
      throw new Error(`${label} drift: ${path}`)
    }
  } else {
    await writeFile(path, content, 'utf8')
  }
}

export async function generateMethodTrialView(root = process.cwd(), check = false): Promise<void> {
  const outputRoot = resolve(root, ...CONTRACT_ROOT)
  const schemaText = renderMethodTrialViewSchema()
  if (!check) await mkdir(outputRoot, { recursive: true })
  await checkOrWrite(resolve(outputRoot, 'schema.json'), schemaText, check, 'method-trial-view schema')

  const summaryRoot = resolve(root, ...SUMMARY_ROOT)
  if (!check) await mkdir(summaryRoot, { recursive: true })
  await checkOrWrite(
    resolve(summaryRoot, 'schema.json'),
    renderMethodTrialSummarySchema(),
    check,
    'method-trial-summary schema',
  )
  await checkOrWrite(
    resolve(summaryRoot, 'wbc1.summary.json'),
    await deriveMethodTrialSummary(root),
    check,
    'method-trial-summary fixture',
  )
}

export function schemaSha256(schemaText = renderMethodTrialViewSchema()): string {
  return `sha256:${createHash('sha256').update(schemaText, 'utf8').digest('hex')}`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await generateMethodTrialView(process.cwd(), process.argv.includes('--check'))
}
