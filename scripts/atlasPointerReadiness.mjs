import { setTimeout as pause } from 'node:timers/promises'
import { requirePointerTarget } from './atlasPointerContract.mjs'

/** Observe settling before any input; never retry a click or relax its in-gesture guard. */
export async function waitForStablePointerTarget(read, record, clock = { now: Date.now, pause }) {
  const deadline = clock.now() + 2000
  let anchor
  let stableSince
  for (let attempt = 0; attempt < 41; attempt += 1) {
    const sample = await read()
    record(sample)
    const point = requirePointerTarget(sample)
    const now = clock.now()
    if (anchor && sample.mark !== anchor.mark) throw new Error('Pointer target identity changed while settling')
    if (!anchor || ['x', 'y', 'width', 'height'].some((key) => Math.abs(sample[key] - anchor[key]) > 0.5)) {
      anchor = sample
      stableSince = now
    }
    if (now > deadline) break
    if (now - stableSince >= 200) return point
    if (now >= deadline) break
    await clock.pause(50)
  }
  throw new Error('Pointer target did not settle within the readiness bound')
}
