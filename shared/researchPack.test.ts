import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  RELATION_NAMES,
  RESEARCH_PACK_INTERPRETATION_CODES,
  ResearchPackSchema,
  TimeWindowSchema,
} from './researchPack.js'
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

  it('keeps person-scoring prohibition case-insensitive in the standalone JSON Schema', async () => {
    const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as Record<string, any>
    const pattern = schema.properties.feature_registry.items.properties.feature_id.pattern as string
    const featureId = new RegExp(pattern)

    expect(featureId.test('DL.PERSON.PRODUCTIVITY.v1')).toBe(false)
    expect(featureId.test('DL.DEVELOPER.OUTPUT.v1')).toBe(false)
    expect(featureId.test('DL.CONTRIBUTOR.OUTPUT.v1')).toBe(false)
    expect(featureId.test('DL.AUTHOR.OUTPUT.v1')).toBe(false)
    expect(featureId.test('DL.REVIEWER.OUTPUT.v1')).toBe(false)
    expect(featureId.test('DL.INDIVIDUAL.OUTPUT.v1')).toBe(false)
    expect(featureId.test('DL.DEVELOPERS.OUTPUT.v1')).toBe(false)
    expect(featureId.test('DL.developerOutput.v1')).toBe(false)
    expect(featureId.test('DL.developerURL.v1')).toBe(false)
    expect(featureId.test('DL.DEVELOPERURL.v1')).toBe(false)
    expect(featureId.test('DL.AUTHORURL.v1')).toBe(false)
    expect(featureId.test('DL.AUTHORSURL.v1')).toBe(false)
    expect(featureId.test('DL.ENGINEERURL.v1')).toBe(false)
    expect(featureId.test('DL.ENGINEERSURL.v1')).toBe(false)
    expect(featureId.test('DL.SENIORITIESURL.v1')).toBe(false)
    expect(featureId.test('DL.TEAM_MEMBERURL.v1')).toBe(false)
    expect(featureId.test('DL.USER_LOGINURL.v1')).toBe(false)
    expect(featureId.test('DL.reviewersResponseHours.v1')).toBe(false)
    expect(featureId.test('DL.TEAM_MEMBERS.OUTPUT.v1')).toBe(false)
    expect(featureId.test('DL.userLoginCount.v1')).toBe(false)
    expect(featureId.test('DL.REPO.HEALTH.SCORE.v1')).toBe(false)
    expect(featureId.test('DL.healthURL.v1')).toBe(false)
    expect(featureId.test('DL.HEALTHURL.v1')).toBe(false)
    expect(featureId.test('DL.PORT.ENGAGEMENT.v1')).toBe(false)
    expect(featureId.test('DL.engagementURL.v1')).toBe(false)
    expect(featureId.test('DL.ENGAGEMENTURL.v1')).toBe(false)
    expect(featureId.test('DL.WEEK.HOURS.WORKED.v1')).toBe(false)
    expect(featureId.test('DL.WEEK.BUS.FACTOR.v1')).toBe(false)
    expect(featureId.test('DL.WEEK.CHANGE_COUNT.v1')).toBe(true)
    expect(featureId.test('DL.WEEK.AUTHORIZATION_STATE.v1')).toBe(true)
    expect(featureId.test('DL.WEEK.INACTIVITY_SPAN.v1')).toBe(true)
    expect(featureId.test('DL.PULL_REQUEST.INTEGRATING_WINDOW.v1')).toBe(true)
  })

  it('rejects person-oriented feature tokens in every separator and requires a recognized no-person code', async () => {
    const fixture = await fixtureValue()
    const feature = fixture.feature_registry[0]

    for (const featureId of [
      'DL.DEVELOPER.OUTPUT.v1',
      'DL.CONTRIBUTOR.OUTPUT.v1',
      'DL.AUTHOR.OUTPUT.v1',
      'DL.REVIEWER.OUTPUT.v1',
      'DL.INDIVIDUAL.OUTPUT.v1',
      'DL.DEVELOPERS.OUTPUT.v1',
      'DL.developerOutput.v1',
      'DL.developerURL.v1',
      'DL.DEVELOPERURL.v1',
      'DL.AUTHORURL.v1',
      'DL.AUTHORSURL.v1',
      'DL.ENGINEERURL.v1',
      'DL.ENGINEERSURL.v1',
      'DL.SENIORITIESURL.v1',
      'DL.TEAM_MEMBERURL.v1',
      'DL.USER_LOGINURL.v1',
      'DL.reviewersResponseHours.v1',
      'DL.TEAM_MEMBERS.OUTPUT.v1',
      'DL.userLoginCount.v1',
      'DL.REPO.HEALTH.SCORE.v1',
      'DL.healthURL.v1',
      'DL.HEALTHURL.v1',
      'DL.PORT.ENGAGEMENT.v1',
      'DL.engagementURL.v1',
      'DL.ENGAGEMENTURL.v1',
      'DL.WEEK.HOURS.WORKED.v1',
      'DL.WEEK.BUS.FACTOR.v1',
    ]) {
      expect(() =>
        ResearchPackSchema.parse({
          ...fixture,
          feature_registry: [{ ...feature, feature_id: featureId }],
        }),
      ).toThrow()
    }

    expect(() =>
      ResearchPackSchema.parse({
        ...fixture,
        feature_registry: [{ ...feature, feature_id: 'DL.WEEK.AUTHORIZATION_STATE.v1' }],
      }),
    ).not.toThrow()
    for (const featureId of [
      'DL.WEEK.INACTIVITY_SPAN.v1',
      'DL.PULL_REQUEST.INTEGRATING_WINDOW.v1',
    ]) {
      expect(() =>
        ResearchPackSchema.parse({
          ...fixture,
          feature_registry: [{ ...feature, feature_id: featureId }],
        }),
      ).not.toThrow()
    }
    expect(() =>
      ResearchPackSchema.parse({
        ...fixture,
        feature_registry: [{ ...feature, prohibited_interpretation_codes: ['ALLOW_PERSON_RANKING'] }],
      }),
    ).toThrow()
    expect(() =>
      ResearchPackSchema.parse({
        ...fixture,
        feature_registry: [
          { ...feature, prohibited_interpretation_codes: ['NOT_PRODUCTIVITY', 'NOT_EFFORT'] },
        ],
      }),
    ).toThrow()
  })

  it('publishes the closed interpretation-code vocabulary and required no-person code in JSON Schema', async () => {
    const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as Record<string, any>
    const codes = schema.properties.feature_registry.items.properties.prohibited_interpretation_codes

    expect(codes.items.enum).toEqual([...RESEARCH_PACK_INTERPRETATION_CODES])
    expect(codes.contains).toEqual({ const: 'NOT_PERSON_MEASURE' })
  })

  it('anchors C1 generated_at to the UTC Monday start of its ISO week', async () => {
    const fixture = await fixtureValue()

    expect(() =>
      ResearchPackSchema.parse({
        ...fixture,
        classification: 'C1',
        generated_at: '2026-08-03T00:00:00Z',
      }),
    ).not.toThrow()
    for (const generatedAt of ['2026-08-03T12:00:00Z', '2026-08-04T00:00:00Z']) {
      expect(() =>
        ResearchPackSchema.parse({
          ...fixture,
          classification: 'C1',
          generated_at: generatedAt,
        }),
      ).toThrow()
    }

    const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as Record<string, any>
    expect(schema.allOf[0].then.properties.generated_at.pattern).toBe(
      '^\\d{4}-\\d{2}-\\d{2}T00:00:00Z$',
    )
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
