import { describe, expect, it } from 'vitest'
import {
  contributionCoverageStatus,
  dedupeDatedEvents,
  mergeRepositoryData,
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
})
