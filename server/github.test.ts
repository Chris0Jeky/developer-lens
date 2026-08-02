import { describe, expect, it } from 'vitest'
import {
  contributionCoverageStatus,
  dedupeDatedEvents,
  mergeRepositoryData,
  sumContributorLineStats,
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

  it('retains GraphQL language bytes when lower-fidelity REST data arrives later', () => {
    const detailed = {
      id: 'graph-id',
      nameWithOwner: 'example/project',
      name: 'project',
      isPrivate: false,
      isArchived: false,
      isFork: false,
      primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
      languages: [
        { name: 'TypeScript', size: 900 },
        { name: 'Shell', size: 100 },
      ],
      topics: ['tooling'],
    }
    const restFallback = {
      ...detailed,
      id: 'rest-id',
      primaryLanguage: { name: 'TypeScript' },
      languages: [],
      topics: [],
    }

    expect(mergeRepositoryData(detailed, restFallback).languages).toEqual(detailed.languages)
  })

  it('sums contributor line changes from weekly buckets overlapping the range', () => {
    expect(
      sumContributorLineStats(
        [
          {
            author: { login: 'test-builder' },
            weeks: [
              { w: 1769904000, a: 100, d: 20, c: 4 },
              { w: 1770508800, a: 40, d: 5, c: 2 },
              { w: 1785628800, a: 900, d: 90, c: 8 },
            ],
          },
        ],
        'test-builder',
        '2026-02-02T00:00:00.000Z',
        '2026-08-02T00:00:00.000Z',
      ),
    ).toEqual({ additions: 140, deletions: 25, commits: 6 })
  })
})
