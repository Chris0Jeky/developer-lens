import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { validateAuditEvidence } from './npmAuditEvidence.mjs'

function report(total = 0) {
  return {
    auditReportVersion: 2,
    vulnerabilities: total ? { 'invented-package': { severity: 'high', via: ['invented-advisory'] } } : {},
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: total, critical: 0, total } },
  }
}

describe('npm audit evidence collection (#398)', () => {
  it('retains a valid clean report and exit status without changing its contents', () => {
    const input = report()
    assert.deepEqual(validateAuditEvidence(input, 0), { auditExitCode: 0, vulnerabilityCount: 0, report: input })
  })
  it('collects a vulnerability report without representing it as audit-clean', () => {
    const input = report(1)
    const before = structuredClone(input)
    assert.deepEqual(validateAuditEvidence(input, 1), { auditExitCode: 1, vulnerabilityCount: 1, report: input })
    assert.deepEqual(input, before)
  })
  it.each([2, -1, NaN, Infinity, '1', null])('refuses unsupported npm exit status %s', (status) => {
    assert.throws(() => validateAuditEvidence(report(1), status))
  })
  it.each([[null], [[]], [{}], [{ error: { code: 'invented-network-error' } }]])('refuses an absent or malformed report %s', (input) => {
    assert.throws(() => validateAuditEvidence(input, 1))
  })
  it('refuses an error even alongside otherwise plausible report fields', () => {
    assert.throws(() => validateAuditEvidence({ ...report(1), error: { code: 'invented-error' } }, 1))
  })
  it('refuses an unrecognized report format', () => {
    assert.throws(() => validateAuditEvidence({ ...report(1), auditReportVersion: 99 }, 1))
  })
  it.each([-1, 0.5, NaN, Infinity, '1'])('refuses a non-count total %s', (total) => {
    assert.throws(() => validateAuditEvidence(report(total), 1))
  })
  it('refuses totals inconsistent with the severity counts', () => {
    const input = report(1)
    input.metadata.vulnerabilities.total = 2
    assert.throws(() => validateAuditEvidence(input, 1))
  })
  it('refuses missing severity counts', () => {
    const input = report(1)
    delete input.metadata.vulnerabilities.low
    assert.throws(() => validateAuditEvidence(input, 1))
  })
  it('refuses a zero exit status paired with vulnerabilities', () => {
    assert.throws(() => validateAuditEvidence(report(1), 0))
  })
  it('refuses a nonzero vulnerability exit paired with a clean report', () => {
    assert.throws(() => validateAuditEvidence(report(), 1))
  })
  it('refuses positive counts without advisory/package details', () => {
    assert.throws(() => validateAuditEvidence({ ...report(1), vulnerabilities: {} }, 1))
  })
  it('refuses a claimed clean report with vulnerability entries', () => {
    assert.throws(() => validateAuditEvidence({ ...report(), vulnerabilities: { invented: {} } }, 0))
  })
})
