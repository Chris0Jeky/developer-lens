import { performance as nodePerformance } from 'node:perf_hooks'
import { describe, expect, it, vi } from 'vitest'
import {
  captureTrustedProcessMonotonicMs,
  captureTrustedProcessWallTime,
  TRUSTED_PROCESS_CLOCK_ERROR_CODE,
  TrustedProcessClockError,
} from './trustedProcessClock.js'

function expectClockFailure(run: () => unknown): void {
  let caught: unknown
  try {
    run()
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(TrustedProcessClockError)
  expect(caught).toMatchObject({
    code: TRUSTED_PROCESS_CLOCK_ERROR_CODE,
    name: 'TrustedProcessClockError',
    message: TRUSTED_PROCESS_CLOCK_ERROR_CODE,
  })
  expect(String(caught)).toBe(`TrustedProcessClockError: ${TRUSTED_PROCESS_CLOCK_ERROR_CODE}`)
  expect(String(caught)).not.toContain('poison')
}

describe('trusted process clock boundary', () => {
  it('exposes separate zero-argument capture functions', () => {
    expect(captureTrustedProcessWallTime.length).toBe(0)
    expect(captureTrustedProcessMonotonicMs.length).toBe(0)
  })

  it('captures canonical millisecond UTC wall time from the process', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 7, 5, 12, 34, 56, 789))

    expect(captureTrustedProcessWallTime()).toBe('2026-08-05T12:34:56.789Z')
  })

  it('rejects invalid or out-of-range wall values', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, Number.MAX_SAFE_INTEGER + 1]) {
      vi.spyOn(Date, 'now').mockReturnValue(value)
      expectClockFailure(captureTrustedProcessWallTime)
      vi.restoreAllMocks()
    }
  })

  it('fails closed when the wall clock throws', () => {
    vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('poison wall source') })

    expectClockFailure(captureTrustedProcessWallTime)
  })

  it('captures finite nonnegative monotonic milliseconds from Node performance', () => {
    vi.spyOn(nodePerformance, 'now').mockReturnValue(1234.5)

    expect(captureTrustedProcessMonotonicMs()).toBe(1234.5)
  })

  it('rejects invalid monotonic values', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -0.1, -1]) {
      vi.spyOn(nodePerformance, 'now').mockReturnValue(value)
      expectClockFailure(captureTrustedProcessMonotonicMs)
      vi.restoreAllMocks()
    }
  })

  it('fails closed when the monotonic clock throws', () => {
    vi.spyOn(nodePerformance, 'now').mockImplementation(() => { throw new Error('poison monotonic source') })

    expectClockFailure(captureTrustedProcessMonotonicMs)
  })
})
