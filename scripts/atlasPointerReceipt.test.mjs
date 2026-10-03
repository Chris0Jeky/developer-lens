import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { finishPointerReceipt } from './atlasPointerReceipt.mjs'

const receipt = (phase = 'complete') => ({ phase, status: 'failed', traces: [] })
describe('pointer receipt finalization (#407 review)', () => {
  it('publishes a pass only after awaited cleanup and isolation validation', async () => {
    const value = receipt()
    const order = []
    await finishPointerReceipt(value, async () => {
      assert.equal(value.status, 'failed')
      await Promise.resolve()
      order.push('closed')
    }, (json) => { order.push('emitted'); assert.equal(JSON.parse(json).status, 'passed') })
    assert.deepEqual(order, ['closed', 'emitted'])
  })
  it('records cleanup failure rather than emitting a contradictory pass', async () => {
    const value = receipt()
    const emitted = []
    await assert.rejects(finishPointerReceipt(value, async () => { throw new Error('invented cleanup error') },
      (json) => emitted.push(JSON.parse(json))))
    assert.equal(emitted.length, 1)
    assert.equal(emitted[0].status, 'failed')
    assert.equal(emitted[0].phase, 'cleanup')
    assert.equal(emitted[0].cleanup, 'failed')
  })
  it('preserves the original failure phase when cleanup also fails', async () => {
    const value = receipt('drawer-column-7')
    const emitted = []
    await assert.rejects(finishPointerReceipt(value, async () => { throw new Error('invented') },
      (json) => emitted.push(JSON.parse(json))))
    assert.equal(emitted[0].phase, 'drawer-column-7')
    assert.equal(emitted[0].status, 'failed')
    assert.equal(emitted[0].cleanup, 'failed')
  })
  it('does not promote an earlier input failure when cleanup succeeds', () => {
    const value = receipt('pointer-column-8')
    const emitted = []
    return finishPointerReceipt(value, async () => {}, (json) => emitted.push(JSON.parse(json))).then(() => {
      assert.equal(emitted[0].status, 'failed')
      assert.equal(emitted[0].phase, 'pointer-column-8')
    })
  })
})
