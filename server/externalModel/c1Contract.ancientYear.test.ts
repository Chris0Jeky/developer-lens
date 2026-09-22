import { describe, expect, it } from 'vitest'
import { C1RangeSchema } from './c1Contract.js'

describe('C1 ancient-year range arithmetic', () => {
  it('applies the three-year ceiling without the Date.UTC 1900 offset', () => {
    expect(C1RangeSchema.safeParse({
      start: '0090-01-01T00:00:00Z',
      end: '0093-01-01T00:00:00Z',
    }).success).toBe(true)

    expect(C1RangeSchema.safeParse({
      start: '0090-01-01T00:00:00Z',
      end: '0093-01-01T00:00:00.001Z',
    }).success).toBe(false)

    expect(C1RangeSchema.safeParse({
      start: '0090-01-01T00:00:00Z',
      end: '0100-01-01T00:00:00Z',
    }).success).toBe(false)
  })

  it('keeps the existing end-of-month clamp for ancient leap days', () => {
    expect(C1RangeSchema.safeParse({
      start: '0096-02-29T12:34:56.789Z',
      end: '0099-02-28T12:34:56.789Z',
    }).success).toBe(true)

    expect(C1RangeSchema.safeParse({
      start: '0096-02-29T12:34:56.789Z',
      end: '0099-03-01T12:34:56.789Z',
    }).success).toBe(false)
  })
})
