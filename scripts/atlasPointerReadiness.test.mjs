import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { waitForStablePointerTarget } from './atlasPointerReadiness.mjs'

const target = (x = 40, y = 30) => ({ count: 1, connected: true, disabled: false,
  mark: 'm.invented', hit: 'm.invented', x, y, left: x - 30, top: y - 20,
  width: 60, height: 40, viewportWidth: 390, viewportHeight: 844 })

function fixture(snapshots) {
  let time = 0
  let reads = 0
  const traces = []
  return {
    read: async () => snapshots[Math.min(reads++, snapshots.length - 1)],
    record: (snapshot) => traces.push(snapshot),
    clock: { now: () => time, pause: async (milliseconds) => { time += milliseconds } },
    state: () => ({ time, reads, traces }),
  }
}

describe('bounded pointer readiness without input retries (#397)', () => {
  it('observes 200ms of stable geometry before returning the first click coordinate', async () => {
    const f = fixture([target()])
    assert.deepEqual(await waitForStablePointerTarget(f.read, f.record, f.clock), { x: 40, y: 30, mark: 'm.invented' })
    assert.equal(f.state().time, 200)
    assert.equal(f.state().reads, 5)
  })
  it('retains and waits out the observed seven-pixel post-dismissal motion', async () => {
    const f = fixture([target(40, 501), target(40, 494), target(40, 490), target(40, 490)])
    const result = await waitForStablePointerTarget(f.read, f.record, f.clock)
    assert.equal(result.y, 490)
    assert.equal(f.state().time, 300)
    assert.deepEqual(f.state().traces.slice(0, 3).map((sample) => sample.y), [501, 494, 490])
  })
  it('does not mistake slow cumulative movement for a stable target', async () => {
    const f = fixture(Array.from({ length: 50 }, (_, index) => target(40, 30 + index * 0.3)))
    await assert.rejects(waitForStablePointerTarget(f.read, f.record, f.clock), /did not settle/)
    assert.ok(f.state().time <= 2000)
  })
  it('refuses a target that never settles within two seconds', async () => {
    const f = fixture(Array.from({ length: 50 }, (_, index) => target(40 + index, 30)))
    await assert.rejects(waitForStablePointerTarget(f.read, f.record, f.clock), /did not settle/)
    assert.ok(f.state().reads <= 41)
  })
  it('also requires stable dimensions when the center does not change', async () => {
    const f = fixture([target(), { ...target(), width: 80 }])
    await waitForStablePointerTarget(f.read, f.record, f.clock)
    assert.equal(f.state().time, 250)
  })
  for (const [name, patch] of [
    ['absent', { count: 0 }], ['obscured', { hit: null }], ['disabled', { disabled: true }],
    ['detached', { connected: false }], ['ambiguous', { count: 2 }],
  ]) {
    it(`fails immediately for a ${name} target rather than retrying it into a pass`, async () => {
      const f = fixture([{ ...target(), ...patch }, target()])
      await assert.rejects(waitForStablePointerTarget(f.read, f.record, f.clock))
      assert.equal(f.state().reads, 1)
      assert.equal(f.state().traces.length, 1)
    })
  }
  it('does not follow a different mark into an eventual passing witness', async () => {
    const f = fixture([target(), { ...target(), mark: 'm.other', hit: 'm.other' }])
    await assert.rejects(waitForStablePointerTarget(f.read, f.record, f.clock), /identity changed/)
  })
})
