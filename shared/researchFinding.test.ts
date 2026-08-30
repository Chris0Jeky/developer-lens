import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { createForbiddenPatterns, forbiddenPatternViolations } from '../scripts/exportPrivacyGuards.js'
import { fixtureSha256, renderResearchFindingSchema, renderResearchFindingFixture } from '../scripts/generateResearchFinding.js'
import {
  GATES,
  LIMITATIONS,
  METRICS,
  METHODS,
  RESEARCH_FINDING_PUBLIC_URL,
  ResearchFindingSchema,
  UNSUPPORTED_CLAIMS,
  assertResearchFindingPrivacy,
  canonicalizeJson,
  computeResearchFindingBundleHash,
  researchFindingPrivacyViolations,
} from './researchFinding.js'

const root = resolve('research-contracts', 'research-finding', 'v1')
const fixturePath = resolve(root, 'wbc1.fixture.json')
const schemaPath = resolve(root, 'schema.json')
const readFixture = async () => JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, any>

type TableRow = string[]
function registryTable(readme: string, heading: string): TableRow[] {
  const start = readme.indexOf(`### ${heading}`)
  if (start < 0) throw new Error(`missing README registry table: ${heading}`)
  const end = readme.indexOf('\n### ', start + 5)
  const section = readme.slice(start, end < 0 ? undefined : end)
  return section.split('\n')
    .filter((line) => /^\| `[^`]+` \|/.test(line))
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim().replace(/^`|`$/g, '')))
}

function schemaConstPairs(value: unknown, codeKey: string, textKeys: string[]): string[][] {
  const found: string[][] = []
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const object = node as Record<string, unknown>
    const properties = object.properties as Record<string, unknown> | undefined
    if (properties && typeof properties === 'object') {
      const code = (properties[codeKey] as Record<string, unknown> | undefined)?.const
      const texts = textKeys.map((key) => (properties[key] as Record<string, unknown> | undefined)?.const)
      if (typeof code === 'string' && texts.every((text) => typeof text === 'string')) found.push([code, ...texts as string[]])
    }
    Object.values(object).forEach(visit)
  }
  visit(value)
  return [...new Map(found.map((pair) => [JSON.stringify(pair), pair])).values()]
}

function assertExactRows(actual: TableRow[], expected: TableRow[], label: string): void {
  expect(actual, `${label} rows`).toHaveLength(expected.length)
  expect(new Set(actual.map(([code]) => code)).size, `${label} duplicate codes`).toBe(expected.length)
  expect([...actual].sort(), `${label} exact registry`).toEqual([...expected].sort())
}

describe('ResearchFindingProjection.v1', () => {
  it('round-trips the deterministic C0 fixture and recomputes its bundle hash', async () => {
    const fixtureText = await readFile(fixturePath, 'utf8')
    const parsed = ResearchFindingSchema.parse(JSON.parse(fixtureText))
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(JSON.parse(fixtureText))
    expect(parsed.classification).toBe('C0')
    expect(parsed.subject_class).toBe('software-system')
    expect(parsed.finding).toEqual({ id: 'wbc1', title: 'WB-C1 method trial: why the simple baseline won', question: 'Can the BOCPD candidate reduce false alerts per year versus the rolling median and MAD baseline without worsening detection or calibration?' })
    expect(parsed.provenance.bundle_hash).toBe(computeResearchFindingBundleHash(parsed))
    expect(fixtureSha256(fixtureText)).toBe(`sha256:${createHash('sha256').update(fixtureText, 'utf8').digest('hex')}`)
  })

  it('validates the generated standalone schema and pins generator drift', async () => {
    expect(await readFile(schemaPath, 'utf8')).toBe(renderResearchFindingSchema())
    expect(await readFile(fixturePath, 'utf8')).toBe(renderResearchFindingFixture())
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(JSON.parse(await readFile(schemaPath, 'utf8')))
    const fixture = await readFixture()
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true)
  })

  it('rejects structural and semantic contract violations', async () => {
    const fixture = await readFixture()
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(JSON.parse(await readFile(schemaPath, 'utf8')))
    for (const [name, invalid] of Object.entries({
      extra: { ...fixture, unexpected: true },
      unknown_limitation: { ...fixture, limitations: [{ code: 'ship', display_text: 'ship' }] },
      ship: { ...fixture, decision: { ...fixture.decision, outcome: 'ship' } },
      no_metrics: { ...fixture, metrics: [] },
      seven_metrics: { ...fixture, metrics: [...fixture.metrics, ...fixture.metrics, ...fixture.metrics, ...fixture.metrics].slice(0, 7) },
      non_z_date: { ...fixture, generated_at: '2026-08-30T00:00:00+01:00' },
      bad_url: { ...fixture, provenance: { ...fixture.provenance, public_url: 'https://example.invalid/finding' } },
    })) {
      expect(validate(invalid), `${name}: ${JSON.stringify(validate.errors)}`).toBe(false)
    }
    expect(() => ResearchFindingSchema.parse({ ...fixture, methods: { baseline: fixture.methods.baseline, candidate: fixture.methods.baseline } })).toThrow()
    expect(() => ResearchFindingSchema.parse({ ...fixture, metrics: [fixture.metrics[0], fixture.metrics[0]] })).toThrow()
    expect(() => ResearchFindingSchema.parse({ ...fixture, gates: [fixture.gates[1], fixture.gates[0]] })).toThrow()
    expect(() => ResearchFindingSchema.parse({ ...fixture, decision: { ...fixture.decision, retained_fallback: 'bocpd_gaussian' } })).toThrow()
    expect(() => ResearchFindingSchema.parse({ ...fixture, decision: { ...fixture.decision, outcome: 'benchmarked', retained_fallback: 'rolling_median_mad' } })).toThrow()
  })

  it('publishes registries consistently in the README', async () => {
    const readme = await readFile(resolve(root, 'README.md'), 'utf8')
    assertExactRows(registryTable(readme, 'MethodCode'), Object.entries(METHODS).map(([code, label]) => [code, label]), 'MethodCode')
    assertExactRows(registryTable(readme, 'MetricCode'), Object.entries(METRICS).map(([code, metric]) => [code, metric.label, metric.unit, metric.better_when]), 'MetricCode')
    assertExactRows(registryTable(readme, 'GateCode (registry order)'), Object.entries(GATES).map(([code, label]) => [code, label]), 'GateCode')
    assertExactRows(registryTable(readme, 'LimitationCode'), Object.entries(LIMITATIONS).map(([code, label]) => [code, label]), 'LimitationCode')
    assertExactRows(registryTable(readme, 'UnsupportedClaimCode'), Object.entries(UNSUPPORTED_CLAIMS).map(([code, label]) => [code, label]), 'UnsupportedClaimCode')
    const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
    assertExactRows(schemaConstPairs(schema, 'method_code', ['display_name']), Object.entries(METHODS).map(([code, label]) => [code, label]), 'schema MethodCode')
    assertExactRows(schemaConstPairs(schema, 'key', ['label', 'unit', 'better_when']), Object.entries(METRICS).map(([code, metric]) => [code, metric.label, metric.unit, metric.better_when]), 'schema MetricCode')
    assertExactRows(schemaConstPairs(schema, 'code', ['label']), Object.entries(GATES).map(([code, label]) => [code, label]), 'schema GateCode')
    assertExactRows(schemaConstPairs(schema, 'code', ['display_text']), [...Object.entries(LIMITATIONS), ...Object.entries(UNSUPPORTED_CLAIMS)].map(([code, label]) => [code, label]), 'schema claim registries')
    expect(readme).toContain('Consumers must render an unavailable metric as `NOT MEASURED`')
    expect(readme).toContain('consumers must also run the')
    const fixtureText = await readFile(fixturePath, 'utf8')
    const fixtureShaLine = readme.match(/complete fixture file SHA-256 \(including its trailing\nnewline\) is:\s*\n\s*`([^`]+)`/)
    expect(fixtureShaLine?.[1]).toBe(fixtureSha256(fixtureText))
    const fixture = JSON.parse(fixtureText)
    const bundleHashLine = readme.match(/The fixture's\nbundle hash is `([^`]+)`/)
    expect(bundleHashLine?.[1]).toBe(fixture.provenance.bundle_hash)
    expect(fixture.provenance.bundle_hash).toBe(computeResearchFindingBundleHash(fixture))
  })

  it('implements the RFC 8785 canonical JSON rules and rejects invalid values', () => {
    expect(canonicalizeJson({ numbers: [Number('333333333.33333329'), 1e30, 4.5, 2e-3, 0.000001, 5e-324], literals: [null, true, false] })).toBe('{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,0.000001,5e-324]}')
    const orderedKeys = [String.fromCharCode(13), '1', String.fromCharCode(0x80), String.fromCharCode(0xf6), String.fromCharCode(0x20ac), String.fromCodePoint(0x1f600), String.fromCharCode(0xfb33)]
    expect(canonicalizeJson(Object.fromEntries(orderedKeys.map((key, index) => [key, index + 1])))).toBe(`{${orderedKeys.map((key, index) => `${JSON.stringify(key)}:${index + 1}`).join(',')}}`)
    expect(canonicalizeJson({ '\u00e9': 1, e: 2, '\u00c5': 3 })).toBe('{"e":2,"Å":3,"é":1}')
    expect(canonicalizeJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}')
    expect(() => canonicalizeJson(NaN)).toThrow()
    expect(() => canonicalizeJson(undefined)).toThrow()
    const sparse: unknown[] = []
    sparse[1] = 1
    expect(() => canonicalizeJson(sparse)).toThrow()
    expect(() => canonicalizeJson(new Date(0))).toThrow()
    expect(() => canonicalizeJson({ toJSON: () => ({}) })).toThrow()
    expect(() => canonicalizeJson('\ud800')).toThrow()
  })

  it('rejects planted privacy boundary violations while allowing the exact provenance URL', async () => {
    const fixture = await readFixture()
    assertResearchFindingPrivacy(fixture)
    const fixtureText = await readFile(fixturePath, 'utf8')
    expect(forbiddenPatternViolations(fixturePath, fixtureText, createForbiddenPatterns({}))).toEqual([])
    const planted = { ...fixture, generated_at: fixture.generated_at, finding: { ...fixture.finding, title: 'owner/repository @person email@example.com /private/path 2026-01-01' } }
    expect(researchFindingPrivacyViolations(planted)).toEqual(expect.arrayContaining(['denied identity, email, path, or repository token', 'date outside generated_at']))
    expect(() => assertResearchFindingPrivacy(planted)).toThrow()
    expect(researchFindingPrivacyViolations({ ...fixture, provenance: { ...fixture.provenance, public_url: RESEARCH_FINDING_PUBLIC_URL } })).toEqual([])
    expect(researchFindingPrivacyViolations({ ...fixture, provenance: { ...fixture.provenance, public_url: 'https://evil.example/finding' } })).toContain('non-allowlisted public_url')
  })
})
