import { describe, expect, it } from 'vitest'
import { analyzeDataset } from '../../server/analytics'
import { createDemoDataset } from '../../server/demo'
import {
  createPortableExportPayload,
  type PortableArtifact,
  type RepositoryRedaction,
} from './portableExportPayload'
import { buildPortableExperienceReport } from './portableExportReport'

function createPayload(
  artifact: PortableArtifact = 'dashboard',
  repositoryRedaction: RepositoryRedaction = 'private-aliases',
) {
  const dashboard = analyzeDataset(createDemoDataset('6m'))
  return createPortableExportPayload(dashboard, {
    aliasSeed: 'fixed-test-seed',
    artifact,
    repositoryRedaction,
  })
}

describe('portable full-experience exports', () => {
  it('renders a complete dashboard and all nine Wrapped chapters from the allowlist', () => {
    const dashboard = buildPortableExperienceReport(createPayload('dashboard'))
    const wrapped = buildPortableExperienceReport(createPayload('wrapped'))

    for (const section of [
      'id="rhythm"',
      'id="portfolio"',
      'id="landscape"',
      'id="delivery"',
      'id="signature"',
      'id="connections"',
      'id="limits"',
    ]) {
      expect(dashboard).toContain(section)
    }
    for (let chapter = 1; chapter <= 9; chapter += 1) {
      expect(wrapped).toContain(`data-chapter="${chapter}"`)
    }
    expect(dashboard).toContain('Repository constellation')
    expect(wrapped).toContain('All nine chapters')
  })

  it('aliases private names before rendering and excludes poisoned source prose', () => {
    const dashboard = analyzeDataset(createDemoDataset('6m'))
    dashboard.meta = {
      ...dashboard.meta,
      mode: 'private',
      privacy: 'local-only',
      from: '2042-01-02T00:00:00.000Z',
      to: '2042-07-02T00:00:00.000Z',
      generatedAt: '2042-07-02T12:34:56.000Z',
      subject: {
        login: 'SECRET_LOGIN',
        name: 'SECRET_PERSON',
        avatarUrl: 'https://private.example/avatar.png',
      },
      warnings: ['SECRET_WARNING'],
      coverage: dashboard.meta.coverage.map((source) => ({
        ...source,
        label: 'SECRET_SOURCE_LABEL',
        detail: 'SECRET_COVERAGE_DETAIL',
      })),
    }
    dashboard.repositories = dashboard.repositories.map((repository, index) => ({
      ...repository,
      isPrivate: index !== 0,
      displayName: index === 0 ? 'safe-public-project' : `SECRET_PRIVATE_REPO_${index}`,
      nameWithOwner: `SECRET_OWNER/SECRET_REPO_${index}`,
      description: 'SECRET_DESCRIPTION',
      topics: ['SECRET_TOPIC'],
      url: 'https://private.example/repository',
    }))
    dashboard.pullRequests = dashboard.pullRequests.map((pullRequest) => ({
      ...pullRequest,
      repository: 'SECRET_REPOSITORY_REFERENCE',
      title: 'SECRET_PR_TITLE',
      url: 'https://private.example/pull/1',
    }))
    dashboard.signals = dashboard.signals.map((signal) => ({
      ...signal,
      title: 'SECRET_SIGNAL_TITLE',
      explanation: 'SECRET_SIGNAL_EXPLANATION',
      basis: 'SECRET_SIGNAL_BASIS',
    }))
    dashboard.insights = dashboard.insights.map((insight) => ({
      ...insight,
      title: 'SECRET_INSIGHT_TITLE',
      body: 'SECRET_INSIGHT_BODY',
      evidence: ['SECRET_INSIGHT_EVIDENCE'],
      caveat: 'SECRET_INSIGHT_CAVEAT',
    }))
    dashboard.archetype = {
      name: 'SECRET_ARCHETYPE',
      shortName: 'SECRET_ARCHETYPE',
      description: 'SECRET_ARCHETYPE_DESCRIPTION',
      signals: ['SECRET_ARCHETYPE_SIGNAL'],
    }

    const payload = createPortableExportPayload(dashboard, {
      aliasSeed: 'privacy-test-seed',
      artifact: 'wrapped',
      repositoryRedaction: 'private-aliases',
    })
    const output = `${JSON.stringify(payload)}\n${buildPortableExperienceReport(payload)}`

    expect(payload.scope).toBe('redacted-local')
    expect(payload.canonicalUrl).toBeUndefined()
    expect(payload.repositories[0].label).toBe('safe-public-project')
    expect(payload.repositories.slice(1).every((repository) => repository.label.startsWith('Project '))).toBe(true)
    for (const forbidden of [
      'SECRET_LOGIN',
      'SECRET_PERSON',
      'SECRET_PRIVATE_REPO',
      'SECRET_OWNER',
      'SECRET_DESCRIPTION',
      'SECRET_TOPIC',
      'SECRET_PR_TITLE',
      'SECRET_REPOSITORY_REFERENCE',
      'SECRET_WARNING',
      'SECRET_COVERAGE',
      'SECRET_SOURCE_LABEL',
      'SECRET_SIGNAL',
      'SECRET_INSIGHT',
      'SECRET_ARCHETYPE',
      'private.example',
      '2042-01-02',
      '2042-07-02',
    ]) {
      expect(output).not.toContain(forbidden)
    }
  })

  it('can alias every repository name and keeps aliases stable only for the chosen seed', () => {
    const dashboard = analyzeDataset(createDemoDataset('6m'))
    dashboard.meta = {
      ...dashboard.meta,
      mode: 'private',
      privacy: 'local-only',
    }
    const options = {
      artifact: 'dashboard' as const,
      repositoryRedaction: 'all-aliases' as const,
    }
    const first = createPortableExportPayload(dashboard, { ...options, aliasSeed: 'seed-one' })
    const repeated = createPortableExportPayload(dashboard, { ...options, aliasSeed: 'seed-one' })
    const second = createPortableExportPayload(dashboard, { ...options, aliasSeed: 'seed-two' })
    const originalNames = dashboard.repositories.map((repository) => repository.displayName)
    const output = buildPortableExperienceReport(first)

    expect(first.repositories.map((repository) => repository.label)).toEqual(
      repeated.repositories.map((repository) => repository.label),
    )
    expect(first.repositories.map((repository) => repository.label)).not.toEqual(
      second.repositories.map((repository) => repository.label),
    )
    expect(first.repositories.every((repository) => repository.disclosure === 'masked-alias')).toBe(true)
    for (const name of originalNames) expect(output).not.toContain(name)
  })

  it('escapes retained public names and stays self-contained and script-free', () => {
    const dashboard = analyzeDataset(createDemoDataset('12m'))
    dashboard.meta = {
      ...dashboard.meta,
      mode: 'private',
      privacy: 'local-only',
    }
    dashboard.repositories[0] = {
      ...dashboard.repositories[0],
      isPrivate: false,
      displayName: '<img src=x onerror="alert(1)">',
    }
    const payload = createPortableExportPayload(dashboard, {
      aliasSeed: 'markup-seed',
      artifact: 'dashboard',
      repositoryRedaction: 'private-aliases',
    })
    const report = buildPortableExperienceReport(payload)

    expect(report).not.toMatch(/<script\b/i)
    expect(report).not.toMatch(/<(?:img|link)\b/i)
    expect(report).not.toMatch(/url\(["']?https?:/i)
    expect(report).not.toContain('<img src=x')
    expect(report).toContain('&lt;img src=x')
    expect(report).not.toContain(dashboard.meta.generatedAt)
  })
})
