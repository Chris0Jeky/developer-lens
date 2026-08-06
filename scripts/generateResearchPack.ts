import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  RELATION_NAMES,
  RESEARCH_PACK_PRODUCER_CODE,
  REQUIRED_NO_PERSON_INTERPRETATION,
  ResearchPackSchema,
  type ResearchPack,
} from '../shared/researchPack.js'

const CONTRACT_ROOT = ['research-contracts', 'research-pack', 'v1'] as const

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

type JsonSchemaObject = Record<string, unknown>

function schemaObject(value: unknown, label: string): JsonSchemaObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`generated ResearchPack schema is missing ${label}`)
  }
  return value as JsonSchemaObject
}

function enrichStandaloneSchema(value: unknown): JsonSchemaObject {
  const schema = schemaObject(value, 'root object')
  const properties = schemaObject(schema.properties, 'root properties')
  const featureRegistry = schemaObject(properties.feature_registry, 'feature_registry')
  const feature = schemaObject(featureRegistry.items, 'feature_registry items')
  const featureProperties = schemaObject(feature.properties, 'feature properties')
  const interpretationCodes = schemaObject(
    featureProperties.prohibited_interpretation_codes,
    'prohibited_interpretation_codes',
  )

  interpretationCodes.contains = { const: REQUIRED_NO_PERSON_INTERPRETATION }
  schema.allOf = [
    {
      if: {
        properties: { classification: { const: 'C1' } },
        required: ['classification'],
      },
      then: {
        $comment: 'Runtime and typed consumers additionally require this UTC midnight to be a Monday.',
        properties: { generated_at: { pattern: '^\\d{4}-\\d{2}-\\d{2}T00:00:00Z$' } },
        required: ['generated_at'],
      },
    },
  ]
  return schema
}

function omittedRelation() {
  return {
    state: 'intentionally_omitted' as const,
    schema_id: null,
    row_count: null,
    artifact: null,
    reason_code: 'NOT_IN_FIXTURE',
  }
}

export function createInventedResearchPack(contractSha256: string): ResearchPack {
  const relation = omittedRelation()
  return ResearchPackSchema.parse({
    schema_version: 'DeveloperLensResearchPack.v1',
    pack_id: 'pack_demo',
    generated_at: '2026-08-06T12:00:00Z',
    classification: 'C0',
    provenance: {
      product_commit: 'dddddddddddddddddddddddddddddddddddddddd',
      contract_sha256: contractSha256,
      producer_code: RESEARCH_PACK_PRODUCER_CODE,
      fixture_revision: 'invented.v1',
    },
    temporal_availability: {
      event: {
        state: 'present',
        window: { start: '2025-01-06T00:00:00Z', end: '2025-12-29T00:00:00Z' },
        reason_code: null,
      },
      collection: {
        state: 'present',
        window: { start: '2025-01-06T00:00:00Z', end: '2025-12-29T00:00:00Z' },
        reason_code: null,
      },
      feature: {
        state: 'present',
        window: { start: '2025-01-06T00:00:00Z', end: '2025-12-29T00:00:00Z' },
        reason_code: null,
      },
    },
    relations: Object.fromEntries(RELATION_NAMES.map((name) => [name, relation])),
    feature_registry: [
      {
        feature_id: 'DL.WEEK.CHANGE_COUNT.v1',
        relation: 'repository_week',
        value_kind: 'count',
        unit_code: 'count',
        evidence_layer: 'deterministic',
        prohibited_interpretation_codes: ['NOT_PRODUCTIVITY', 'NOT_EFFORT', 'NOT_PERSON_MEASURE'],
      },
    ],
  })
}

export function renderResearchPackFiles(): { schema: string; fixture: string } {
  const schema = enrichStandaloneSchema(z.toJSONSchema(ResearchPackSchema))
  const schemaText = stableJson(schema)
  const contractSha256 = `sha256:${createHash('sha256').update(schemaText, 'utf8').digest('hex')}`
  const fixtureText = stableJson(createInventedResearchPack(contractSha256))
  return { schema: schemaText, fixture: fixtureText }
}

export async function generateResearchPack(root = process.cwd(), check = false): Promise<void> {
  const outputRoot = resolve(root, ...CONTRACT_ROOT)
  const rendered = renderResearchPackFiles()
  const outputs = new Map([
    ['schema.json', rendered.schema],
    ['invented.fixture.json', rendered.fixture],
  ])
  if (!check) await mkdir(outputRoot, { recursive: true })
  for (const [name, contents] of outputs) {
    const path = resolve(outputRoot, name)
    if (check) {
      let existing: string
      try {
        existing = await readFile(path, 'utf8')
      } catch {
        throw new Error(`research-pack output is missing: ${path}`)
      }
      if (existing !== contents) throw new Error(`research-pack output drift: ${path}`)
    } else {
      await writeFile(path, contents, 'utf8')
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await generateResearchPack(process.cwd(), process.argv.includes('--check'))
}
