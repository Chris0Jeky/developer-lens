import { describe, expect, it } from 'vitest'
import { analyzeDataset } from '../../server/analytics'
import { createDemoDataset } from '../../server/demo'
import { buildShareCardSvg } from './shareCard'
import {
  createShareCaption,
  createSharePayload,
  PUBLIC_SHOWCASE_URL,
} from './sharePayload'
import { buildStandaloneReport } from './standaloneReport'

describe('privacy-safe share payloads', () => {
  it('creates a canonical public payload for the synthetic showcase', () => {
    const dashboard = analyzeDataset(createDemoDataset('6m'))
    dashboard.meta.privacy = 'public-demo'

    const payload = createSharePayload(dashboard, {
      kind: 'wrapped',
      chapterId: 'rhythm',
      chapterNumber: 4,
    })

    expect(payload.scope).toBe('public-demo')
    expect(payload.canonicalUrl).toBe(PUBLIC_SHOWCASE_URL)
    expect(payload.title).toMatch(/weeks lit up/i)
    expect(createShareCaption(payload, 'compact')).toContain(PUBLIC_SHOWCASE_URL)
  })

  it('allowlists local aggregates and excludes every poisoned private string', () => {
    const dashboard = analyzeDataset(createDemoDataset('6m'))
    dashboard.meta = {
      ...dashboard.meta,
      mode: 'private',
      privacy: 'local-only',
      subject: {
        login: 'SECRET_LOGIN',
        name: 'SECRET_PERSON',
        avatarUrl: 'https://private.example/avatar.png',
      },
      warnings: ['SECRET_WARNING'],
      coverage: dashboard.meta.coverage.map((source) => ({
        ...source,
        detail: 'SECRET_COVERAGE_PATH',
      })),
    }
    dashboard.repositories = dashboard.repositories.map((repository) => ({
      ...repository,
      nameWithOwner: 'SECRET_OWNER/SECRET_REPO',
      displayName: 'SECRET_REPO',
      description: 'SECRET_DESCRIPTION',
      topics: ['SECRET_TOPIC'],
      url: 'https://private.example/repository',
    }))
    dashboard.pullRequests = dashboard.pullRequests.map((pullRequest) => ({
      ...pullRequest,
      repository: 'SECRET_REPO',
      title: 'SECRET_PR_TITLE',
      url: 'https://private.example/pull/1',
    }))
    dashboard.insights = dashboard.insights.map((insight) => ({
      ...insight,
      title: 'SECRET_INSIGHT',
      body: 'SECRET_INSIGHT_BODY',
      evidence: ['SECRET_EVIDENCE'],
    }))
    dashboard.archetype = {
      ...dashboard.archetype,
      name: 'SECRET_ARCHETYPE',
      shortName: 'SECRET_ARCHETYPE',
      description: 'SECRET_ARCHETYPE_DESCRIPTION',
      signals: ['SECRET_ARCHETYPE_SIGNAL'],
    }

    const payload = createSharePayload(dashboard)
    const exported = [
      JSON.stringify(payload),
      createShareCaption(payload, 'professional'),
      buildShareCardSvg(payload),
      buildStandaloneReport(payload),
    ].join('\n')

    expect(payload.scope).toBe('redacted-local')
    expect(payload.canonicalUrl).toBeUndefined()
    expect(payload.archetype).toBe('Development Explorer')
    for (const forbidden of [
      'SECRET_LOGIN',
      'SECRET_PERSON',
      'SECRET_REPO',
      'SECRET_PR_TITLE',
      'SECRET_WARNING',
      'SECRET_COVERAGE_PATH',
      'SECRET_TOPIC',
      'SECRET_INSIGHT',
      'private.example',
    ]) {
      expect(exported).not.toContain(forbidden)
    }
  })

  it('escapes generated SVG and standalone HTML markup', () => {
    const dashboard = analyzeDataset(createDemoDataset('12m'))
    dashboard.meta.privacy = 'public-demo'
    const payload = {
      ...createSharePayload(dashboard),
      title: '<script>alert("no")</script>',
      description: '<img src=x onerror=alert(1)>',
    }

    const svg = buildShareCardSvg(payload)
    const report = buildStandaloneReport(payload)

    expect(svg).not.toContain('<script>alert')
    expect(svg).toContain('&lt;script&gt;')
    expect(report).not.toContain('<script>alert')
    expect(report).not.toContain('<img src=x')
    expect(report).toContain('&lt;script&gt;')
  })

  it('keeps standalone reports self-contained and script-free', () => {
    const dashboard = analyzeDataset(createDemoDataset('6m'))
    dashboard.meta.privacy = 'public-demo'
    const report = buildStandaloneReport(createSharePayload(dashboard))

    expect(report).not.toMatch(/<script\b/i)
    expect(report).not.toMatch(/<(?:img|link)\b/i)
    expect(report).not.toMatch(/url\(["']?https?:/i)
    expect(report).toContain('Synthetic showcase · no personal GitHub data')
  })
})
