import { describe, expect, it } from 'vitest'
import { precisePercentage } from './format'

describe('precisePercentage', () => {
  it('never renders a positive share as zero', () => {
    expect(precisePercentage(0)).toBe('0%')
    expect(precisePercentage(0.0004)).toBe('<0.1%')
    expect(precisePercentage(0.004)).toBe('0.4%')
    expect(precisePercentage(0.452)).toBe('45%')
  })
})
