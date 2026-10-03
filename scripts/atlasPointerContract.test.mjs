import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { requirePointerTarget, requirePointerEvents } from './atlasPointerContract.mjs'

function target() {
  return { count: 1, connected: true, disabled: false, mark: 'm.invented', hit: 'm.invented',
    x: 40, y: 30, left: 10, top: 10, width: 60, height: 40, viewportWidth: 390, viewportHeight: 844 }
}
const events = () => ['mousedown', 'mouseup', 'click'].map((type) => ({ type, mark: 'm.invented', trusted: true }))

describe('native pointer evidence contract (#397)', () => {
  it('accepts a visible unique hit target and returns its CSS-pixel center', () => {
    assert.deepEqual(requirePointerTarget(target()), { x: 40, y: 30, mark: 'm.invented' })
  })
  for (const [name, patch] of [
    ['absent', { count: 0 }], ['ambiguous', { count: 2 }], ['detached', { connected: false }],
    ['disabled', { disabled: true }], ['obscured', { hit: null }], ['wrong hit', { hit: 'm.other' }],
    ['empty identity', { mark: '', hit: '' }], ['zero width', { width: 0 }],
    ['invalid coordinate', { x: NaN }], ['outside viewport', { x: 391 }],
  ]) {
    it(`refuses ${name} before clicking`, () => assert.throws(() => requirePointerTarget({ ...target(), ...patch })))
  }
  it('refuses geometry movement after an accepted witness', () => {
    const before = requirePointerTarget(target())
    assert.throws(() => requirePointerTarget({ ...target(), x: 42 }, before))
  })
  it('accepts unchanged geometry before the next native event', () => {
    const before = requirePointerTarget(target())
    assert.deepEqual(requirePointerTarget(target(), before), before)
  })
  it('requires one trusted down/up/click sequence on the intended mark', () => {
    assert.equal(requirePointerEvents(events(), 'm.invented'), true)
  })
  for (const [name, input] of [
    ['missing click', events().slice(0, 2)], ['duplicate click', [...events(), events()[2]]],
    ['wrong target', events().map((event) => ({ ...event, mark: 'm.other' }))],
    ['synthetic dispatch', events().map((event) => ({ ...event, trusted: false }))],
    ['wrong ordering', events().reverse()],
  ]) {
    it(`refuses ${name} as native acceptance`, () => assert.throws(() => requirePointerEvents(input, 'm.invented')))
  }
})
