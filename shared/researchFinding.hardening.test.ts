import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ResearchFindingSchema,
  computeResearchFindingBundleHash,
  researchFindingPrivacyViolations,
} from './researchFinding.js'

const fixturePath = resolve('research-contracts', 'research-finding', 'v1', 'wbc1.fixture.json')
const readFixture = async () => JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, any>

function reseal(finding: Record<string, any>): Record<string, any> {
  finding.provenance.bundle_hash = computeResearchFindingBundleHash(finding as any)
  return finding
}

describe('ResearchFindingProjection.v1 hardening', () => {
  it('rejects whitespace-only required finding prose without rewriting the hashed value', async () => {
    const fixture = await readFixture()
    const cases: Array<[string, (finding: Record<string, any>) => void]> = [
      ['finding.title', (finding) => { finding.finding.title = ' \t\n' }],
      ['finding.question', (finding) => { finding.finding.question = '\r\n\t' }],
      ['decision.summary', (finding) => { finding.decision.summary = '   ' }],
    ]

    for (const [label, mutate] of cases) {
      const finding = structuredClone(fixture)
      mutate(finding)
      const result = ResearchFindingSchema.safeParse(reseal(finding))
      expect(result.success, label).toBe(false)
    }
  })

  it('returns a validation failure instead of throwing when canonical JSON rejects a lone surrogate', async () => {
    const fixture = await readFixture()
    const malformed = structuredClone(fixture)
    malformed.finding.title = '\ud800'

    const parse = () => ResearchFindingSchema.safeParse(malformed)
    expect(parse).not.toThrow()
    expect(parse().success).toBe(false)
  })

  it('rejects address literals and symbol-domain emails at the public privacy boundary', async () => {
    const fixture = await readFixture()
    const denied = 'denied identity, email, path, or repository token'

    for (const token of ['me@[192.168.0.1]', 'me@💩.la']) {
      const finding = { ...fixture, finding: { ...fixture.finding, title: `reported by ${token}` } }
      expect(researchFindingPrivacyViolations(finding), token).toContain(denied)
    }
  })

  it('pins research-contract markdown to LF for Windows registry checks', async () => {
    const attributes = await readFile(resolve('.gitattributes'), 'utf8')
    expect(attributes.split(/\r?\n/)).toContain('research-contracts/**/*.md text eol=lf')
  })
})
