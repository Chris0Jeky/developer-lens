import { describe, expect, it } from 'vitest'
import {
  contributionCoverageStatus,
  dedupeDatedEvents,
} from './github.js'

describe('GitHub normalization', () => {
  it('deduplicates a review observed through contribution and search sources', () => {
    const contribution = {
      id: 'review-42',
      repository: 'example/project',
      occurredAt: '2026-08-01T12:00:00.000Z',
    }
    const search = { ...contribution }

    expect(dedupeDatedEvents([contribution, search])).toEqual([search])
  })

  it('marks the contribution source partial when GitHub restricts attribution', () => {
    expect(contributionCoverageStatus(0)).toBe('complete')
    expect(contributionCoverageStatus(1)).toBe('partial')
  })
})
