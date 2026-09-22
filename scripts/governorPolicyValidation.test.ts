import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateGovernorPolicyYaml } from './governorPolicyValidation.js'

const committedPolicy = readFileSync(
  resolve('.agent-harness', 'governor.yaml'),
  'utf8',
)

describe('governor policy YAML validation', () => {
  it('accepts the committed governor policy', () => {
    expect(validateGovernorPolicyYaml(committedPolicy)).toEqual([])
  })

  it('fails closed on syntactically malformed YAML that retains required key spellings', () => {
    const malformed = committedPolicy.replace(
      'focus_weights: { research: 7, story_product: 5, distribution: 3, community: 2, realdata_standalone: 0 }',
      'focus_weights: [research: 7',
    )

    expect(validateGovernorPolicyYaml(malformed)).toContain(
      'governor policy is not valid YAML',
    )
  })

  it('rejects missing model-role and risk-tier subtrees', () => {
    const withoutModelRoles = committedPolicy.replace(
      /^model_roles:/m,
      'unrecognised_model_roles:',
    )
    const withoutRiskTiers = committedPolicy.replace(
      /^risk_tiers:/m,
      'unrecognised_risk_tiers:',
    )

    expect(validateGovernorPolicyYaml(withoutModelRoles)).toContain(
      'governor policy must declare object subtree: model_roles',
    )
    expect(validateGovernorPolicyYaml(withoutRiskTiers)).toContain(
      'governor policy must declare object subtree: risk_tiers',
    )
  })

  it('rejects incomplete nested role and risk declarations', () => {
    const withoutReviewer = committedPolicy.replace(
      /^  reviewer:/m,
      '  unrecognised_reviewer:',
    )
    const withoutW4 = committedPolicy.replace(/^  W4:/m, '  W5:')

    expect(validateGovernorPolicyYaml(withoutReviewer)).toContain(
      'governor policy model_roles must declare key: reviewer',
    )
    expect(validateGovernorPolicyYaml(withoutW4)).toContain(
      'governor policy risk_tiers must declare key: W4',
    )
  })
})
