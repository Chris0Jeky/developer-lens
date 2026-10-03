import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { deriveWindowCoverage, type ChangeBatchTailInput } from './changeBatchTail.js'

const start = '2026-06-03T12:00:00.000Z'
const end = '2026-06-26T12:00:00.000Z'
function fixture(rangeStart: string, rangeEnd: string, window = { start, end }): ChangeBatchTailInput {
  return {
    source: { kind: 'synthetic', marker: 'developer-lens.phase-e.synthetic-change-batch.v1' },
    scopeSurrogate: 'lens-scope-0123456789abcdef01234567',
    scope: { hasAlias: false, linkedAt: null },
    window,
    asOf: '2026-07-06T00:00:00.000Z',
    units: [],
    lineage: [],
    coverage: [{
      label: 'coverage-1', jobLabel: 'job-1', consentLabel: 'consent-1', instrumentLabel: 'instrument-1',
      status: 'complete', jobStatus: 'complete', snapshotClosed: true,
      expectedUnits: 0, observedUnits: 0, omittedUnits: 0,
      saturationReason: null, limitationCode: 'COMPLETE', retryable: false,
      rangeStart, rangeEnd, observedAt: '2026-07-06T00:00:00.000Z', retention: 'live',
    }],
  }
}

describe('coverage display stays inside the selected window (#374)', () => {
  it('clamps week-rounded start and end without inflating exact completeness', () => {
    const input = fixture('2026-06-04T00:00:00.000Z', '2026-06-25T00:00:00.000Z')
    const coverage = deriveWindowCoverage(input, [])
    assert.equal(coverage.rows[0].rangeStartWeek, start)
    assert.equal(coverage.rows[0].rangeEndWeek, end)
    assert.equal(coverage.completeness.value, Math.floor(21 / 23 * 10_000) / 10_000)
    assert.equal(coverage.rows[0].vouches, true)
  })
  it('clamps numerically equivalent boundary spellings, not just equal strings', () => {
    const input = fixture('2026-06-01T00:00:00.000Z', '2026-06-29T00:00:00.000Z', {
      start: '2026-06-03T12:00:00+00:00', end: '2026-06-26T12:00:00+00:00',
    })
    const coverage = deriveWindowCoverage(input, [])
    assert.equal(coverage.rows[0].rangeStartWeek, start)
    assert.equal(coverage.rows[0].rangeEndWeek, end)
    assert.equal(coverage.completeness.value, 1)
  })
  it('retains week grain for interior row boundaries', () => {
    const coverage = deriveWindowCoverage(fixture('2026-06-10T12:00:00.000Z', '2026-06-18T12:00:00.000Z'), [])
    assert.equal(coverage.rows[0].rangeStartWeek, '2026-06-08T00:00:00.000Z')
    assert.equal(coverage.rows[0].rangeEndWeek, '2026-06-22T00:00:00.000Z')
    assert.equal(coverage.completeness.value, Math.floor(8 / 23 * 10_000) / 10_000)
  })
  it('handles a selected window shorter than one week', () => {
    const shortEnd = '2026-06-05T12:00:00.000Z'
    const coverage = deriveWindowCoverage(fixture('2026-06-04T12:00:00.000Z', '2026-06-04T13:00:00.000Z', { start, end: shortEnd }), [])
    assert.equal(coverage.rows[0].rangeStartWeek, start)
    assert.equal(coverage.rows[0].rangeEndWeek, shortEnd)
    assert.equal(coverage.completeness.value, 0.0208)
  })
  it('does not invent a displayed interval for non-overlapping rows', () => {
    const coverage = deriveWindowCoverage(fixture('2026-05-25T00:00:00.000Z', '2026-06-01T00:00:00.000Z'), [])
    assert.equal(coverage.rows[0].rangeStartWeek, null)
    assert.equal(coverage.rows[0].rangeEndWeek, null)
    assert.equal(coverage.rows[0].overlapsWindow, false)
    assert.equal(coverage.completeness.value, 0)
  })
  it('preserves aligned window boundaries and exact complete coverage', () => {
    const window = { start: '2026-06-01T00:00:00.000Z', end: '2026-06-29T00:00:00.000Z' }
    const coverage = deriveWindowCoverage(fixture(window.start, window.end, window), [])
    assert.equal(coverage.rows[0].rangeStartWeek, window.start)
    assert.equal(coverage.rows[0].rangeEndWeek, window.end)
    assert.equal(coverage.completeness.value, 1)
  })
})
