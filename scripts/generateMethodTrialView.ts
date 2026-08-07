import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { MethodTrialViewSchema } from '../shared/methodTrialView.js'

const CONTRACT_ROOT = ['research-contracts', 'method-trial-view', 'v1'] as const

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
  const root = schema.properties as JsonObject

  const scenarioCodes = root.dataset.properties.scenario_codes as JsonObject
  scenarioCodes.minItems = 3
  scenarioCodes.maxItems = 3
  scenarioCodes.items = false

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
      method_code: { const: 'bocpd' },
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

  const thresholdSelection = root.scorecard.properties.threshold_selection.properties as JsonObject
  for (const method of ['baseline', 'candidate'] as const) {
    thresholdSelection[method].allOf = [
      fixedObject({ viable: { const: false } }),
      {
        properties: {
          selected_value: fixedObject({ status: { const: 'unavailable' } }),
        },
        required: ['selected_value'],
      },
    ]
  }

  const gateCodes = [
    'support',
    'threshold_viability',
    'false_alerts',
    'detection',
    'calibration',
    'promotion',
  ] as const
  const gates = root.acceptance_gates as JsonObject
  const gateItem = gates.items as JsonObject
  gates.minItems = gateCodes.length
  gates.maxItems = gateCodes.length
  gates.prefixItems = gateCodes.map((code, index) => ({
    allOf: [
      gateItem,
      fixedObject({ order: { const: index + 1 }, code: { const: code } }),
    ],
  }))
  gates.items = false

  const scenarios = [
    ['no_change_control', 'fixed_first_window'],
    ['planted_change', 'fixed_change_window'],
    ['instrumentation_confound', 'fixed_confound_window'],
  ] as const
  const representativeCases = root.representative_cases as JsonObject
  const representativeCaseItem = representativeCases.items as JsonObject
  representativeCases.minItems = scenarios.length
  representativeCases.maxItems = scenarios.length
  representativeCases.prefixItems = scenarios.map(([scenarioCode, selectionCode], index) => ({
    allOf: [
      representativeCaseItem,
      fixedObject({
        order: { const: index + 1 },
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

export async function generateMethodTrialView(root = process.cwd(), check = false): Promise<void> {
  const outputRoot = resolve(root, ...CONTRACT_ROOT)
  const schemaText = renderMethodTrialViewSchema()
  if (!check) await mkdir(outputRoot, { recursive: true })
  const path = resolve(outputRoot, 'schema.json')
  if (check) {
    let existing: string
    try {
      existing = await readFile(path, 'utf8')
    } catch {
      throw new Error(`method-trial-view schema is missing: ${path}`)
    }
    if (existing !== schemaText) throw new Error(`method-trial-view schema drift: ${path}`)
  } else {
    await writeFile(path, schemaText, 'utf8')
  }
}

export function schemaSha256(schemaText = renderMethodTrialViewSchema()): string {
  return `sha256:${createHash('sha256').update(schemaText, 'utf8').digest('hex')}`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await generateMethodTrialView(process.cwd(), process.argv.includes('--check'))
}
