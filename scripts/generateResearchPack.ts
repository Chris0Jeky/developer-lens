import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  RELATION_NAMES,
  RELATION_SCHEMA_IDS,
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

// Runtime-validation-only invariants (see research-contracts/research-pack/v1/README.md).
// The standalone Draft 2020-12 schema is necessary-but-not-sufficient: several ResearchPack
// `superRefine` rules cannot be faithfully expressed in standard Draft 2020-12 because they
// require comparing or de-duplicating values across sibling fields, which the vocabulary has
// no keyword for. External Draft 2020-12 consumers MUST still run the authoritative TypeScript
// validator (shared/researchPack.ts) to reject:
//   1. Reversed temporal windows — TimeWindowSchema requires window.start strictly before
//      window.end; comparing two sibling instant strings has no standard keyword.
//   2. Distinct artifact digests — present relations must not share one artifact.sha256;
//      cross-property uniqueness over separately named relations is not expressible.
//   3. Unique feature_id — feature_registry entries must be unique by feature_id (not by whole
//      object), which `uniqueItems` cannot express.
//   4. The C1 ISO-week Monday-ness of each floored boundary and the rolling 36-calendar-month
//      cutoff relative to generated_at; the schema only floors the `T00:00:00Z` midnight via a
//      pattern (the surrounding $comment records the residual runtime obligation).
// What the standalone schema DOES encode toward parity: present/non-present relation and
// availability field-presence, the relation-specific schema_id const (a present relation must
// carry exactly its own schema_id), the Parquet artifact media_type, the nonempty-coverage
// dependency, the closed interpretation-code vocabulary with the required no-person code, and
// the person/productivity feature_id prohibition pattern.
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
  const mondayMidnightPattern = '^\\d{4}-\\d{2}-\\d{2}T00:00:00Z$'
  const availabilityWindowProperties = Object.fromEntries(
    (['event', 'collection', 'feature'] as const).map((name) => [
      name,
      {
        properties: {
          window: {
            properties: {
              start: { pattern: mondayMidnightPattern },
              end: { pattern: mondayMidnightPattern },
            },
          },
        },
      },
    ]),
  )
  const allOf: JsonSchemaObject[] = [
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
    {
      if: {
        properties: { classification: { const: 'C1' } },
        required: ['classification'],
      },
      then: {
        $comment:
          'Runtime and typed consumers additionally require every present operational availability boundary to be a UTC Monday ISO-week floor and the start to be within 36 UTC calendar months of generated_at.',
        properties: {
          temporal_availability: { properties: availabilityWindowProperties },
        },
      },
    },
  ]
  const nonPresentStates = ['absent', 'unsupported', 'intentionally_omitted']
  const notNull = { not: { const: null } }
  for (const availabilityName of ['event', 'collection', 'feature'] as const) {
    allOf.push({
      if: {
        properties: {
          temporal_availability: {
            properties: {
              [availabilityName]: {
                properties: { state: { const: 'present' } },
                required: ['state'],
              },
            },
          },
        },
        required: ['temporal_availability'],
      },
      then: {
        $comment: 'Present availability requires a window and no reason_code.',
        properties: {
          temporal_availability: {
            properties: {
              [availabilityName]: {
                properties: { window: notNull, reason_code: { const: null } },
                required: ['window', 'reason_code'],
              },
            },
          },
        },
      },
    })
    allOf.push({
      if: {
        properties: {
          temporal_availability: {
            properties: {
              [availabilityName]: {
                properties: { state: { enum: nonPresentStates } },
                required: ['state'],
              },
            },
          },
        },
        required: ['temporal_availability'],
      },
      then: {
        $comment: 'Non-present availability requires a reason_code and no window.',
        properties: {
          temporal_availability: {
            properties: {
              [availabilityName]: {
                properties: { window: { const: null }, reason_code: notNull },
                required: ['window', 'reason_code'],
              },
            },
          },
        },
      },
    })
  }
  for (const relationName of RELATION_NAMES) {
    const relationPath = {
      properties: {
        relations: {
          properties: {
            [relationName]: {
              properties: { state: { const: 'present' } },
              required: ['state'],
            },
          },
        },
      },
      required: ['relations'],
    }
    allOf.push({
      if: relationPath,
      then: {
        $comment:
          'Present relations require the relation-specific schema_id, row_count, Parquet artifact, and no reason_code.',
        properties: {
          relations: {
            properties: {
              [relationName]: {
                properties: {
                  schema_id: { const: RELATION_SCHEMA_IDS[relationName] },
                  row_count: notNull,
                  artifact: {
                    ...notNull,
                    properties: { media_type: { const: 'application/x-parquet' } },
                  },
                  reason_code: { const: null },
                },
                required: ['schema_id', 'row_count', 'artifact', 'reason_code'],
              },
            },
          },
        },
      },
    })
    allOf.push({
      if: {
        properties: {
          relations: {
            properties: {
              [relationName]: {
                properties: { state: { enum: nonPresentStates } },
                required: ['state'],
              },
            },
          },
        },
        required: ['relations'],
      },
      then: {
        $comment: 'Non-present relations require a reason_code and no schema, count, or artifact.',
        properties: {
          relations: {
            properties: {
              [relationName]: {
                properties: {
                  schema_id: { const: null },
                  row_count: { const: null },
                  artifact: { const: null },
                  reason_code: notNull,
                },
                required: ['schema_id', 'row_count', 'artifact', 'reason_code'],
              },
            },
          },
        },
      },
    })
  }
  for (const relationName of RELATION_NAMES.filter((name) => name !== 'coverage')) {
    allOf.push({
      if: {
        properties: {
          relations: {
            properties: {
              [relationName]: {
                properties: {
                  state: { const: 'present' },
                  row_count: { exclusiveMinimum: 0 },
                },
                required: ['state', 'row_count'],
              },
            },
          },
        },
        required: ['relations'],
      },
      then: {
        $comment: 'Any nonempty analytical relation requires a nonempty present coverage relation.',
        properties: {
          relations: {
            properties: {
              coverage: {
                properties: {
                  state: { const: 'present' },
                  row_count: { exclusiveMinimum: 0 },
                },
                required: ['state', 'row_count'],
              },
            },
            required: ['coverage'],
          },
        },
      },
    })
  }
  schema.allOf = allOf
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
