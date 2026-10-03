import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, it } from 'vitest'

const schema = JSON.parse(readFileSync(resolve('docs/acceleration-bundles/2026-09-09-developer-lens/agent/decisions.schema.json'), 'utf8'))
const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema)
const document = (status: string, selectedOptionId: string | null, confirmedByOwner: boolean) => ({
  schemaVersion: 'DeveloperLensDecisionExport.v1', project: 'Chris0Jeky/developer-lens',
  generatedAt: '2026-10-03T00:00:00Z',
  decisions: [{ decisionId: 'TEST-01', status, selectedOptionId, confirmedByOwner, rationale: 'Invented fixture.' }],
})

describe('acceleration decision export confirmation boundary', () => {
  it('rejects a confirmed decision without a nonblank selected option', () => {
    for (const selection of [null, '', ' \t\n']) assert.equal(validate(document('confirmed', selection, true)), false)
  })
  it('rejects confirmed status without explicit owner confirmation', () => {
    assert.equal(validate(document('confirmed', 'option-a', false)), false)
  })
  it('rejects owner-confirmed flags on every advisory status', () => {
    for (const status of ['proposed-default', 'changed-unconfirmed', 'deferred']) {
      for (const selection of [null, 'option-a']) {
        assert.equal(validate(document(status, selection, true)), false)
      }
    }
  })
  it('accepts an explicitly confirmed selection', () => {
    assert.equal(validate(document('confirmed', 'option-a', true)), true)
  })
  it('keeps unconfirmed and deferred proposals advisory', () => {
    for (const status of ['proposed-default', 'changed-unconfirmed', 'deferred']) {
      assert.equal(validate(document(status, null, false)), true)
      assert.equal(validate(document(status, 'option-a', false)), true)
    }
  })
})
