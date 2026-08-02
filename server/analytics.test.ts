import { describe, expect, it } from 'vitest'
import type { RawDataset } from '../shared/types.js'
import { analyzeDataset } from './analytics.js'
import { createDemoDataset } from './demo.js'

describe('analyzeDataset', () => {
  it('turns normalized facts into layered, evidence-backed dashboard data', () => {
    const dashboard = analyzeDataset(createDemoDataset('6m'))

    expect(dashboard.meta.mode).toBe('demo')
    expect(dashboard.summary.commits).toBeGreaterThan(0)
    expect(dashboard.summary.mergedPullRequests).toBeGreaterThan(0)
    expect(dashboard.repositories).toHaveLength(4)
    expect(dashboard.languages[0]?.share).toBeGreaterThan(0)
    expect(dashboard.languages[0]?.footprintShare).toBeGreaterThan(0)
    expect(dashboard.languages.reduce((sum, language) => sum + language.share, 0)).toBeCloseTo(1, 2)
    expect(
      dashboard.languages.reduce((sum, language) => sum + language.footprintShare, 0),
    ).toBeCloseTo(1, 2)
    expect(dashboard.insights.some((insight) => insight.order === 1)).toBe(true)
    expect(dashboard.insights.some((insight) => insight.order === 2)).toBe(true)
    expect(dashboard.archetype.signals).toHaveLength(3)
  })

  it('deduplicates the same GitHub and local commit by repository plus SHA', () => {
    const raw: RawDataset = {
      schemaVersion: 1,
      range: '6m',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
      collectedAt: '2026-02-01T00:00:00.000Z',
      subject: { login: 'test-builder' },
      contributionCalendar: Array.from({ length: 31 }, (_, index) => ({
        date: `2026-01-${String(index + 1).padStart(2, '0')}`,
        count: index === 0 ? 1 : 0,
      })),
      contributionTotal: 1,
      restrictedContributions: 0,
      repositories: [
        {
          id: 'repo-1',
          nameWithOwner: 'test/project',
          name: 'project',
          isPrivate: true,
          isArchived: false,
          isFork: false,
          languages: [{ name: 'TypeScript', size: 100 }],
          topics: [],
        },
      ],
      commits: [
        {
          sha: 'same',
          repository: 'test/project',
          occurredAt: '2026-01-01T12:00:00.000Z',
          source: 'github',
          features: { type: 'feat', isRevert: false, isFixup: false, subjectLength: 12 },
        },
        {
          sha: 'same',
          repository: 'test/project',
          occurredAt: '2026-01-01T12:00:00.000Z',
          source: 'local-git',
          additions: 10,
          deletions: 2,
          files: 2,
          features: { type: 'feat', isRevert: false, isFixup: false, subjectLength: 12 },
        },
        {
          sha: 'local-only',
          repository: 'test/project',
          occurredAt: '2026-01-02T12:00:00.000Z',
          source: 'local-git',
          features: { type: 'test', isRevert: false, isFixup: false, subjectLength: 12 },
        },
      ],
      commitDaysByRepository: [
        { repository: 'test/project', date: '2026-01-01', count: 1 },
      ],
      pullRequests: [],
      reviews: [],
      issues: [],
      coverage: [
        {
          id: 'github',
          label: 'GitHub',
          status: 'complete',
          detail: 'Test fixture',
        },
        {
          id: 'local-git',
          label: 'Local Git',
          status: 'complete',
          detail: 'Test fixture',
        },
      ],
      warnings: [],
    }

    const dashboard = analyzeDataset(raw)
    expect(dashboard.summary.localOnlyCommits).toBe(1)
    expect(dashboard.summary.commits).toBe(2)
    expect(dashboard.repositories[0]?.localCommits).toBe(1)
  })

  it('lowers coverage for partial GitHub enrichment without penalizing unrequested local data', () => {
    const raw = createDemoDataset('6m')
    raw.coverage = [
      {
        id: 'github-contributions',
        label: 'GitHub contribution graph',
        status: 'complete',
        detail: 'Complete fixture source',
      },
      {
        id: 'github-private-repositories',
        label: 'Private repository enrichment',
        status: 'partial',
        detail: 'Search cap fixture',
      },
      {
        id: 'local-git',
        label: 'Local Git enrichment',
        status: 'unavailable',
        detail: 'Not requested',
      },
    ]

    expect(analyzeDataset(raw).meta.coverageScore).toBe(83)
  })

  it('preserves a real language share below one tenth of one percent', () => {
    const raw = createDemoDataset('6m')
    raw.repositories[0].languages = [
      { name: 'TypeScript', color: '#3178c6', size: 99_999 },
      { name: 'TeX', color: '#3d6117', size: 1 },
    ]

    const tiny = analyzeDataset(raw).languages.find((language) => language.name === 'TeX')
    expect(tiny?.share).toBeGreaterThan(0)
    expect(tiny?.footprintShare).toBeGreaterThan(0)
  })
})
