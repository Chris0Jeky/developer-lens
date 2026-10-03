import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { toSurvivalRow, type PullRequestObservation } from '../docs/acceleration-bundles/2026-09-09-developer-lens/snippets/integration-tail-method'

const hour = 3_600_000
const observation: PullRequestObservation = {
  id: 'invented-pr', createdAt: 0, mergedAt: null, closedAt: null,
  additions: null, deletions: null, changedFiles: null,
}

describe('acceleration lifecycle ordering (#335)', () => {
  for (const [name, closedAt, mergedAt] of [
    ['both events inside the window', hour, 2 * hour],
    ['merge at the exclusive end', hour, 3 * hour],
    ['merge after the exclusive end', hour, 4 * hour],
    ['both events outside the window', 3 * hour, 4 * hour],
    ['closure at creation', 0, hour],
  ] as const) {
    it(`rejects a merge after closure: ${name}`, () => {
      assert.throws(() => toSurvivalRow({ ...observation, closedAt, mergedAt }, 3 * hour), {
        name: 'RangeError', message: 'A merge cannot occur after closure',
      })
    })
  }

  for (const [name, instant, outcome, durationHours] of [
    ['ordinary simultaneous merge and closure', hour, 'merged', 1],
    ['genuine zero-duration merge', 0, 'merged', 0],
    ['simultaneous events at the exclusive end', 3 * hour, 'right_censored', 3],
  ] as const) {
    it(`preserves ${name}`, () => {
      const row = toSurvivalRow({ ...observation, mergedAt: instant, closedAt: instant }, 3 * hour)
      assert.equal(row.outcome, outcome)
      assert.equal(row.durationHours, durationHours)
      assert.equal(row.batchPrimary, null)
      assert.equal(row.batchSensitivity, null)
    })
  }

  it('does not invent closure when only a merge is observed', () => {
    assert.equal(toSurvivalRow({ ...observation, mergedAt: hour }, 3 * hour).outcome, 'merged')
  })

  it('keeps closure without a merge as a competing outcome', () => {
    assert.equal(toSurvivalRow({ ...observation, closedAt: hour }, 3 * hour).outcome, 'closed_without_merge')
  })
})
