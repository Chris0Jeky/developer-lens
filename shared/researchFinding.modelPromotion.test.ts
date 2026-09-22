import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ResearchFindingSchema,
  UNSUPPORTED_CLAIMS,
  computeResearchFindingBundleHash,
  type ResearchFinding,
} from './researchFinding.js'

const fixturePath = resolve('research-contracts', 'research-finding', 'v1', 'wbc1.fixture.json')
const outcomeNeutralDisclaimer = 'This trial does not promote a model.'

describe('ResearchFinding model-promotion disclaimer', () => {
  it('stays outcome-neutral for every admissible decision outcome', async () => {
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as ResearchFinding
    expect(UNSUPPORTED_CLAIMS.model_promotion).toBe(outcomeNeutralDisclaimer)
    expect(fixture.unsupported_claims.find(({ code }) => code === 'model_promotion')).toEqual({
      code: 'model_promotion',
      display_text: outcomeNeutralDisclaimer,
    })

    for (const outcome of ['reject', 'revise_once', 'benchmarked'] as const) {
      const finding = structuredClone(fixture)
      finding.decision.outcome = outcome
      finding.decision.retained_fallback = outcome === 'reject'
        ? finding.methods.baseline.method_code
        : null
      finding.provenance.bundle_hash = computeResearchFindingBundleHash(finding)

      const parsed = ResearchFindingSchema.parse(finding)
      expect(parsed.unsupported_claims.find(({ code }) => code === 'model_promotion')).toEqual({
        code: 'model_promotion',
        display_text: outcomeNeutralDisclaimer,
      })
    }
  })
})
