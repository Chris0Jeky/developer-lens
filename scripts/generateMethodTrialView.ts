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

function enrichStandaloneSchema(value: unknown): JsonObject {
  const schema = value as JsonObject
  schema.$schema = 'https://json-schema.org/draft/2020-12/schema'
  const root = schema.properties as JsonObject
  const scenarioCodes = root.dataset.properties.scenario_codes as JsonObject
  scenarioCodes.minItems = 3
  scenarioCodes.maxItems = 3
  scenarioCodes.items = false
  const methods = root.methods.properties as JsonObject
  methods.baseline.properties = { ...methods.baseline.properties, method_code: { const: 'rolling_median_mad' }, role: { const: 'baseline' }, evaluation_mode: { const: 'online' }, family: { const: 'deterministic_baseline' }, promotion_eligible: { const: false } }
  methods.candidate.properties = { ...methods.candidate.properties, method_code: { const: 'bocpd' }, role: { const: 'candidate' }, evaluation_mode: { const: 'online' }, family: { const: 'online_candidate' }, promotion_eligible: { const: false } }
  methods.offline_descriptive.properties = { ...methods.offline_descriptive.properties, method_code: { const: 'pelt' }, role: { const: 'offline_descriptive' }, evaluation_mode: { const: 'offline_descriptive' }, family: { const: 'offline_descriptive' }, promotion_eligible: { const: false } }

  const timeline = root.timelines.items as JsonObject
  const points = timeline.properties.points.items as JsonObject
  const pointProps = points.properties as JsonObject
  points.allOf = [
    {
      if: { properties: { observed: { const: false } }, required: ['observed'] },
      then: {
        properties: {
          value: { const: null },
          baseline_score: { const: null },
          baseline_threshold: { const: null },
          baseline_alert: { const: false },
          candidate_probability: { const: null },
          candidate_threshold: { const: null },
          candidate_alert: { const: false },
        },
      },
    },
  ]
  // Keep the explicit relationship visible to standalone consumers while Zod
  // remains the executable source for sequential labels and scenario markers.
  pointProps.week_label.description = 'Relative week label week-NN; NN is the zero-padded week_index.'
  timeline.allOf = [
    { if: { properties: { order: { const: 1 } }, required: ['order'] }, then: { properties: { scenario_code: { const: 'no_change_control' } } } },
    { if: { properties: { order: { const: 2 } }, required: ['order'] }, then: { properties: { scenario_code: { const: 'planted_change' } } } },
    { if: { properties: { order: { const: 3 } }, required: ['order'] }, then: { properties: { scenario_code: { const: 'instrumentation_confound' } } } },
    { properties: { pelt: { type: 'object', properties: { evaluation_mode: { const: 'offline_descriptive' } }, required: ['evaluation_mode'] } } },
    { if: { properties: { scenario_code: { const: 'planted_change' } }, required: ['scenario_code'] }, then: { properties: { points: { type: 'array', contains: { type: 'object', properties: { planted_marker: { enum: ['level', 'variance', 'trend', 'seasonal'] } }, required: ['planted_marker'] } } } } },
    { if: { properties: { scenario_code: { const: 'instrumentation_confound' } }, required: ['scenario_code'] }, then: { properties: { points: { type: 'array', contains: { type: 'object', properties: { confound_marker: { enum: ['permission_loss', 'actions_cap', 'shallow_boundary', 'parser_major_change'] } }, required: ['confound_marker'] } } } } },
    { if: { properties: { scenario_code: { const: 'no_change_control' } }, required: ['scenario_code'] }, then: { properties: { points: { type: 'array', items: { type: 'object', properties: { planted_marker: { const: 'none' }, confound_marker: { const: 'none' } }, required: ['planted_marker', 'confound_marker'] } } } } },
  ]
  const gates = root.gates as JsonObject
  gates.prefixItems = ['support', 'threshold_selection', 'online_primary', 'coverage_confound', 'calibration', 'promotion'].map((gate_code, index) => ({
    type: 'object',
    properties: { order: { const: index + 1 }, gate_code: { const: gate_code } },
    required: ['order', 'gate_code'],
  }))
  schema.allOf = [
    { properties: { schema_version: { const: 'DeveloperLensMethodTrialView.v1' }, classification: { const: 'C0' } } },
    { properties: { timelines: { type: 'array', minItems: 3, maxItems: 3 } } },
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
