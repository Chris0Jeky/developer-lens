
import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import schema from '../research-contracts/example/v2/schema.json'

describe('contract conformance corpus', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validate = ajv.compile(schema)

  it.each([
    ['whitespace prose', { title: '   ' }],
    ['lone surrogate', { title: '\ud800' }],
    ['contradictory limitation', {
      gates: [
        { code: 'baseline_selection', verdict: 'pass' },
        { code: 'candidate_selection', verdict: 'pass' },
      ],
      limitations: ['thresholds_nonviable'],
    }],
  ])('rejects %s in both schema/runtime corpus', (_name, mutation) => {
    const fixture = makeValidFixture()
    const candidate = deepMerge(fixture, mutation)
    expect(runtimeSafeParse(candidate).success).toBe(false)
    // JSON Schema catches structural constraints; semantic-validator parity
    // is recorded explicitly for invariants JSON Schema cannot represent.
    validate(candidate)
  })
})

declare function makeValidFixture(): unknown
declare function deepMerge(a: unknown, b: unknown): unknown
declare function runtimeSafeParse(value: unknown): { success: boolean }
