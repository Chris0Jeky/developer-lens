import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { matchesAtlasDrawer } from './atlasDrawerContract.mjs'

const mark = 'm.lines_changed.declared_thresholds.s1.p90.-'
const lower = 'm.lines_changed.declared_thresholds.s1.lower_bound_p90.-'
const merged = 'ev.cbt.lines_changed.declared_thresholds.s1.merged'
const open = 'ev.cbt.lines_changed.declared_thresholds.s1.open_tail'
const drawer = (supports = [merged]) => ({ count: 1, visible: true, referenceKind: 'claim',
  heading: 'Why this number: DELIVERY_FLOW', supports })

describe('Atlas drawer evidence identity (#397)', () => {
  it('matches the primary p90 evidence walk rather than unrendered mark prose', () => {
    assert.equal(matchesAtlasDrawer(drawer(), mark), true)
  })
  it('matches lower-bound p90 only when the open-tail basis also supports it', () => {
    assert.equal(matchesAtlasDrawer(drawer([merged, open]), lower), true)
    assert.equal(matchesAtlasDrawer(drawer(), lower), false)
    assert.equal(matchesAtlasDrawer(drawer([merged, open]), mark), false)
  })
  it('allows evidence order to vary without changing identity', () => {
    assert.equal(matchesAtlasDrawer(drawer([open, merged]), lower), true)
  })
  for (const [name, patch] of [
    ['missing', { count: 0 }], ['ambiguous', { count: 2 }], ['hidden', { visible: false }],
    ['unresolved', { heading: 'This reference could not be resolved' }],
    ['observation', { referenceKind: 'observation' }],
    ['wrong stratum', { supports: [merged.replace('.s1.', '.s2.')] }],
    ['wrong method', { supports: [merged.replace('lines_changed', 'changed_files')] }],
    ['missing evidence', { supports: [] }], ['duplicated evidence', { supports: [merged, merged] }],
  ]) {
    it(`rejects a ${name} drawer`, () => assert.equal(matchesAtlasDrawer({ ...drawer(), ...patch }, mark), false))
  }
  it('rejects an unknown mark instead of accepting a generic visible dialog', () => {
    assert.equal(matchesAtlasDrawer(drawer(), 'm.other'), false)
    assert.equal(matchesAtlasDrawer(null, mark), false)
  })
})
