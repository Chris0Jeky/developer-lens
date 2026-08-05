import { performance as nodePerformance } from 'node:perf_hooks'

export const TRUSTED_PROCESS_CLOCK_ERROR_CODE = 'INVALID_TRUSTED_PROCESS_CLOCK' as const

export class TrustedProcessClockError extends Error {
  readonly code = TRUSTED_PROCESS_CLOCK_ERROR_CODE

  constructor() {
    super(TRUSTED_PROCESS_CLOCK_ERROR_CODE)
    this.name = 'TrustedProcessClockError'
  }
}

const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function invalidClock(): never {
  throw new TrustedProcessClockError()
}

function canonicalWallTime(milliseconds: number): string | null {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) return null
  try {
    const timestamp = new Date(milliseconds).toISOString()
    if (!CANONICAL_UTC_TIMESTAMP.test(timestamp)) return null
    return timestamp
  } catch {
    return null
  }
}

/**
 * Capture process-owned UTC wall time for persisted chronology.
 *
 * This is the only clock value in this boundary that may feed persisted chronology. The
 * returned value is a canonical, millisecond-precision UTC timestamp; callers cannot supply
 * or inject its source.
 */
export function captureTrustedProcessWallTime(): string {
  let milliseconds: number
  try {
    milliseconds = Date.now()
  } catch {
    return invalidClock()
  }
  const timestamp = canonicalWallTime(milliseconds)
  return timestamp ?? invalidClock()
}

/**
 * Capture process-local elapsed milliseconds from Node's monotonic performance clock.
 *
 * This value is an elapsed-budget input only. It must never be persisted or compared across
 * process restarts; use {@link captureTrustedProcessWallTime} for persisted chronology instead.
 */
export function captureTrustedProcessMonotonicMs(): number {
  let milliseconds: number
  try {
    milliseconds = nodePerformance.now()
  } catch {
    return invalidClock()
  }
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return invalidClock()
  return milliseconds
}
