import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELATION_NAMES, ResearchPackSchema, TimeWindowSchema } from './researchPack.js'
import { renderResearchPackFiles } from '../scripts/generateResearchPack.js'

const fixturePath = resolve('research-contracts', 'research-pack', 'v1', 'invented.fixture.json')
const schemaPath = resolve('research-contracts', 'research-pack', 'v1', 'schema.json')

async function fixtureValue(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, any>
}

describe('ResearchPack v1 producer contract', () => {
  it('round-trips the deterministic invented C0 fixture with exactly seven relation slots', async () => {
    const parsed = ResearchPackSchema.parse(await fixtureValue())
    expect(parsed.schema_version).toBe('DeveloperLensResearchPack.v1')
    expect(parsed.classification).toBe('C0')
    expect(Object.keys(parsed.relations)).toEqual([...RELATION_NAMES])
    expect(parsed.relations.repository_week.state).toBe('intentionally_omitted')
  })

  it('rejects unknown fields, non-Z/provider/person/path values, zero-as-missing, and wrong IDs', async () => {
    const fixture = await fixtureValue()

    expect(() => ResearchPackSchema.parse({ ...fixture, unexpected: true })).toThrow()
    expect(() =>
      ResearchPackSchema.parse({
        ...fixture,
        generated_at: '2026-08-06T12:00:00+01:00',
      }),
    ).toThrow()
    expect(() =>
      ResearchPackSchema.parse({
        ...fixture,
        provenance: { ...fixture.provenance, producer_code: 'openai' },
      }),
    ).toThrow()
    expect(() =>
      ResearchPackSchema.parse({
        ...fixture,
        feature_registry: [
          { ...fixture.feature_registry[0], feature_id: 'DL.PERSON.PRODUCTIVITY.v1' },
        ],
      }),
    ).toThrow()
    expect(() =>
      ResearchPackSchema.parse({
        ...fixture,
        relations: {
          ...fixture.relations,
          repository_week: { ...fixture.relations.repository_week, row_count: 0 },
        },
      }),
    ).toThrow()
    expect(() =>
      ResearchPackSchema.parse({
        ...fixture,
        relations: {
          ...fixture.relations,
          repository_week: {
            state: 'present',
            schema_id: 'developer-lens.wrong.v1',
            row_count: 1,
            artifact: { sha256: `sha256:${'a'.repeat(64)}`, size_bytes: 1, media_type: 'application/x-parquet' },
            reason_code: null,
          },
        },
      }),
    ).toThrow()
    expect(() =>
      ResearchPackSchema.parse({
        ...fixture,
        relations: {
          ...fixture.relations,
          coverage: { ...fixture.relations.coverage, path: 'C:\\private.parquet' },
        },
      }),
    ).toThrow()
  })

  it('keeps generated schema and fixture bytes deterministic and drift-free', async () => {
    const rendered = renderResearchPackFiles()
    expect(rendered.schema).toBe(await readFile(schemaPath, 'utf8'))
    expect(rendered.fixture).toBe(await readFile(fixturePath, 'utf8'))
    expect(renderResearchPackFiles()).toEqual(rendered)
  })

  it('orders far-future microseconds exactly and rejects invalid calendar dates', () => {
    expect(() =>
      TimeWindowSchema.parse({
        start: '9999-12-31T23:59:59.000000Z',
        end: '9999-12-31T23:59:59.000001Z',
      }),
    ).not.toThrow()
    expect(() =>
      TimeWindowSchema.parse({
        start: '9999-02-29T00:00:00Z',
        end: '9999-03-01T00:00:00Z',
      }),
    ).toThrow()
  })
})
