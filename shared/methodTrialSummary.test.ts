import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import {
  deriveMethodTrialSummary,
  normalizeGeneratedText,
  renderMethodTrialSummarySchema,
  summarySha256,
} from '../scripts/generateMethodTrialView.js'
import { MethodTrialSummarySchema } from './methodTrialSummary.js'
import { MethodTrialViewSchema } from './methodTrialView.js'

const fixturePath = resolve('research-contracts', 'method-trial-view', 'v1', 'wbc1.fixture.json')
const summaryPath = resolve('research-contracts', 'method-trial-summary', 'v1', 'wbc1.summary.json')
const schemaPath = resolve('research-contracts', 'method-trial-summary', 'v1', 'schema.json')

function measuredValue(measurement: { status: string; value?: number }): number {
  if (measurement.status !== 'measured' || measurement.value === undefined) throw new Error('expected measured value')
  return measurement.value
}

async function standaloneValidator() {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema)
}

describe('DeveloperLensMethodTrialSummary.v1', () => {
  it('is a compact projection derived from the semantically parsed view', async () => {
    const fixtureText = await readFile(fixturePath, 'utf8')
    const view = MethodTrialViewSchema.parse(JSON.parse(fixtureText))
    const summaryText = await deriveMethodTrialSummary(process.cwd())
    const summary = MethodTrialSummarySchema.parse(JSON.parse(summaryText))

    expect(summary.trial.title).toBe(view.trial.title)
    expect(summary.trial.verdict).toBe(view.decision.outcome)
    expect(measuredValue(summary.metrics.false_alerts_per_year.baseline)).toBe(
      measuredValue(view.scorecard.baseline.false_alerts_per_year),
    )
    expect(measuredValue(summary.metrics.false_alerts_per_year.candidate)).toBe(
      measuredValue(view.scorecard.candidate.false_alerts_per_year),
    )
    expect(measuredValue(summary.metrics.detection_rate.baseline)).toBe(measuredValue(view.scorecard.baseline.detection_rate))
    expect(measuredValue(summary.metrics.detection_rate.candidate)).toBe(measuredValue(view.scorecard.candidate.detection_rate))
    expect(summary.threshold_viability.baseline).toBe(false)
    expect(summary.threshold_viability.candidate).toBe(false)
    expect(summary.retained_fallback).toEqual(view.decision.fallback)
    expect(summary.provenance.source_fixture_sha256).toBe(
      `sha256:${createHash('sha256').update(fixtureText, 'utf8').digest('hex')}`,
    )
    expect(summaryText).toBe(normalizeGeneratedText(await readFile(summaryPath, 'utf8')))
    expect(summaryText.length).toBeLessThan(10_000)
    expect(summaryText).not.toContain('representative_cases')
    expect(summaryText).not.toContain('week-000')
  })

  it('pins generated schema and artifact drift', async () => {
    expect(normalizeGeneratedText(await readFile(schemaPath, 'utf8'))).toBe(renderMethodTrialSummarySchema())
    expect(normalizeGeneratedText('first\r\nsecond\nthird\rfourth')).toBe('first\nsecond\nthird\rfourth')
    expect(MethodTrialSummarySchema.parse(JSON.parse(await readFile(summaryPath, 'utf8')))).toBeTruthy()
    expect(summarySha256(await readFile(summaryPath, 'utf8'))).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('rejects extra fields and contradictory metric claims', async () => {
    const summary = JSON.parse(await readFile(summaryPath, 'utf8')) as Record<string, any>
    expect(() => MethodTrialSummarySchema.parse({ ...summary, representative_cases: [] })).toThrow()

    const contradictory = structuredClone(summary)
    contradictory.metrics.false_alerts_per_year.candidate.value = 2
    expect(() => MethodTrialSummarySchema.parse(contradictory)).toThrow()

    const impossibleDetection = structuredClone(summary)
    impossibleDetection.metrics.detection_rate.candidate.value = 1.01
    expect(MethodTrialSummarySchema.safeParse(impossibleDetection).success).toBe(false)
    const validate = await standaloneValidator()
    expect(validate(impossibleDetection), JSON.stringify(validate.errors)).toBe(false)

    const duplicatedLimitation = structuredClone(summary)
    duplicatedLimitation.limitations[1] = duplicatedLimitation.limitations[0]
    expect(() => MethodTrialSummarySchema.parse(duplicatedLimitation)).toThrow()

    const mismatchedClaim = structuredClone(summary)
    mismatchedClaim.unsupported_claims[0].display_text = mismatchedClaim.unsupported_claims[1].display_text
    expect(() => MethodTrialSummarySchema.parse(mismatchedClaim)).toThrow()
  })
})
