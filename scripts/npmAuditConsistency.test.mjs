import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'vitest'
import { validateAuditEvidence } from './npmAuditEvidence.mjs'

function report(severities = ['high']) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: severities.length }
  const vulnerabilities = Object.fromEntries(severities.map((severity, index) => {
    counts[severity] += 1
    return [`invented-${index}`, { severity, via: ['invented-advisory'] }]
  }))
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts } }
}

describe('npm audit map consistency and threshold (#402 review)', () => {
  it('refuses metadata for two affected packages when only one entry exists', () => {
    const input = report(['high', 'high'])
    delete input.vulnerabilities['invented-1']
    assert.throws(() => validateAuditEvidence(input, 1))
  })
  it('refuses a different severity distribution even when totals match', () => {
    const input = report()
    input.vulnerabilities['invented-0'].severity = 'moderate'
    assert.throws(() => validateAuditEvidence(input, 1))
  })
  it.each([[null], [[]], [{}], [{ severity: 'unknown' }], [{ severity: '__proto__' }]])('refuses an invalid affected-package entry %s', (entry) => {
    const input = report()
    input.vulnerabilities['invented-0'] = entry
    assert.throws(() => validateAuditEvidence(input, 1))
  })
  it('preserves a consistent mixed report with every supported severity', () => {
    const input = report(['info', 'low', 'moderate', 'high', 'critical'])
    const before = structuredClone(input)
    assert.deepEqual(validateAuditEvidence(input, 1), { auditExitCode: 1, vulnerabilityCount: 5, report: input })
    assert.deepEqual(input, before)
  })
  it('counts affected packages rather than deduplicating shared advisory identifiers', () => {
    assert.equal(validateAuditEvidence(report(['high', 'high', 'high', 'moderate']), 1).vulnerabilityCount, 4)
  })
  it('accepts an info-only report under the explicit info threshold', () => {
    assert.equal(validateAuditEvidence(report(['info']), 1).vulnerabilityCount, 1)
  })
  it('rejects an info-only report with a status from a different threshold', () => {
    assert.throws(() => validateAuditEvidence(report(['info']), 0))
  })
  it('pins the hosted audit threshold rather than inheriting npm configuration', () => {
    const workflow = readFileSync(resolve('.github/workflows/dependency-audit-evidence.yml'), 'utf8')
    const command = workflow.split('\n').find((line) => line.includes('timeout 60s npm audit '))
    assert.ok(command)
    assert.match(command, /(?:^|\s)--audit-level=info(?:\s|$)/)
  })
})
