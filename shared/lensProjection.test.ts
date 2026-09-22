import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import {
  createShowcaseLensProjection,
  lensFixtureSha256,
  renderLensProjectionFixture,
  renderLensProjectionSchema,
  withPinnedUtc,
} from '../scripts/generateLensProjection.js'
import { createPublicShowcaseDashboard } from '../scripts/exportDemo.js'
import { createPortableExportPayload } from '../src/lib/portableExportPayload.js'
import {
  apportionThousandths,
  disambiguateLabels,
  momentumScore,
  truncateText,
  createPublicLensProjection,
  createPublicLensProjectionFromDashboard,
} from '../src/lib/publicLensProjection.js'
import {
  COVERAGE_WARNINGS,
  LENS_PROJECTION_FIXTURE_GENERATED_AT,
  LENS_PROJECTION_FIXTURE_PRODUCER_COMMIT,
  PublicLensProjectionSchema,
  computeLensProjectionHash,
  coverageScorePercentCandidates,
  coverageWarningCode,
  mapCoverageWarnings,
  type CoverageWarningCode,
  type PublicLensProjection,
} from './lensProjection.js'
import { stableJson } from './researchFinding.js'
import type { DashboardData } from './types.js'
import { COLLECTION_WARNINGS, type CollectionWarningTemplate } from '../server/collectionWarnings.js'

const root = resolve('research-contracts', 'lens-projection', 'v1')
const fixturePath = resolve(root, 'showcase.fixture.json')
const schemaPath = resolve(root, 'schema.json')

const clone = <T>(value: T): T => structuredClone(value)
const rehash = (projection: PublicLensProjection): PublicLensProjection => {
  projection.provenance.projectionHash = computeLensProjectionHash(projection)
  return projection
}
const issuesOf = (value: unknown): string[] => {
  const result = PublicLensProjectionSchema.safeParse(value)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

function showcaseDashboard(): DashboardData {
  return withPinnedUtc(() => createPublicShowcaseDashboard('12m', new Date(LENS_PROJECTION_FIXTURE_GENERATED_AT)))
}

/** Invented local-looking dashboard: the synthetic showcase with alternate repositories marked private. */
function inventedLocalDashboard(): DashboardData {
  const dashboard = showcaseDashboard()
  dashboard.meta.privacy = 'local-only'
  dashboard.meta.mode = 'private'
  dashboard.repositories = dashboard.repositories.map((repository, index) => ({ ...repository, isPrivate: index % 2 === 0 }))
  return dashboard
}

function c1Projection(): PublicLensProjection {
  return createPublicLensProjectionFromDashboard(inventedLocalDashboard(), {
    aliasSeed: 'invented-local-seed',
    repositoryRedaction: 'private-aliases',
    producerCommit: LENS_PROJECTION_FIXTURE_PRODUCER_COMMIT,
    producerVersion: '0.0.0',
    generatedAt: LENS_PROJECTION_FIXTURE_GENERATED_AT,
  }).projection
}

describe('PublicLensProjection.v1 contract', () => {
  it('round-trips build -> serialize -> JSON Schema -> parse -> deep-equal', async () => {
    const built = createShowcaseLensProjection()
    const serialized = stableJson(built)
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(JSON.parse(await readFile(schemaPath, 'utf8')))
    const reparsed = JSON.parse(serialized) as unknown
    expect(validate(reparsed), JSON.stringify(validate.errors)).toBe(true)
    const parsed = PublicLensProjectionSchema.parse(reparsed)
    expect(parsed).toEqual(built)
    expect(parsed.provenance.projectionHash).toBe(computeLensProjectionHash(parsed))
  })

  it('pins the tracked schema and C0 fixture to the generator', async () => {
    const normalize = (text: string) => text.replaceAll('\r\n', '\n')
    expect(normalize(await readFile(schemaPath, 'utf8'))).toBe(renderLensProjectionSchema())
    expect(normalize(await readFile(fixturePath, 'utf8'))).toBe(renderLensProjectionFixture())
    const fixture = PublicLensProjectionSchema.parse(JSON.parse(await readFile(fixturePath, 'utf8')))
    expect(fixture).toMatchObject({ dataClass: 'C0', scope: 'public-demo', repositoryRedaction: 'synthetic', generatedAt: LENS_PROJECTION_FIXTURE_GENERATED_AT })
    expect(fixture.provenance.producerCommit).toBe(LENS_PROJECTION_FIXTURE_PRODUCER_COMMIT)
    expect(fixture.repositories.every((repository) => repository.disclosure === 'synthetic')).toBe(true)
  })

  it('validates a C1 redacted-local projection from invented data, aliasing only private repositories', () => {
    const projection = c1Projection()
    expect(projection).toMatchObject({ dataClass: 'C1', scope: 'redacted-local', repositoryRedaction: 'private-aliases' })
    expect(projection.provenance.showcaseUrl).toBeUndefined()
    const aliased = projection.repositories.filter((repository) => repository.disclosure === 'private-alias')
    expect(aliased.length).toBeGreaterThan(0)
    for (const repository of aliased) expect(repository.label).toMatch(/^Project [A-Z][a-z]+/)
    expect(projection.repositories.some((repository) => repository.disclosure === 'public-name')).toBe(true)
  })

  it('rejects unknown fields, unknown codes, class/scope disagreement and a stale projectionHash', () => {
    const fixture = createShowcaseLensProjection()
    expect(issuesOf(rehash({ ...clone(fixture), extra: true } as PublicLensProjection)).length).toBeGreaterThan(0)
    expect(issuesOf(rehash({ ...clone(fixture), schemaVersion: 'PublicLensProjection.v2' } as unknown as PublicLensProjection)).length).toBeGreaterThan(0)
    const unknownCode = clone(fixture) as unknown as { coverage: { warnings: Array<{ code: string; displayText: string }> } }
    unknownCode.coverage.warnings = [{ code: 'range_truncated', displayText: 'Range truncated.' }]
    expect(issuesOf(rehash(unknownCode as unknown as PublicLensProjection)).length).toBeGreaterThan(0)
    const relabelled = clone(fixture)
    relabelled.coverage.warnings = [{ code: 'synthetic_showcase', displayText: 'Different words.' } as unknown as PublicLensProjection['coverage']['warnings'][number]]
    expect(issuesOf(rehash(relabelled)).length).toBeGreaterThan(0)
    expect(issuesOf(rehash({ ...clone(fixture), dataClass: 'C1' }))).toContain('dataClass C0 requires scope public-demo and C1 requires redacted-local')
    const aliasInC0 = clone(fixture)
    aliasInC0.repositories[0].disclosure = 'private-alias'
    expect(issuesOf(rehash(aliasInC0)).join(' ')).toContain('not admitted under synthetic')
    const stale = clone(fixture)
    stale.summary.commits += 1
    expect(issuesOf(stale)).toContain('projectionHash does not match the canonical projection body')
    const shortDna = clone(fixture) as unknown as { dna: unknown[] }
    shortDna.dna = shortDna.dna.slice(0, 5)
    expect(issuesOf(rehash(shortDna as unknown as PublicLensProjection)).length).toBeGreaterThan(0)
  })
})

describe('PublicLensProjection.v1 denied content', () => {
  const narrativeWith = (text: string, field: 'title' | 'body' | 'limitation' = 'body'): string[] => {
    const projection = clone(createShowcaseLensProjection())
    projection.narratives[0][field] = text
    return issuesOf(rehash(projection))
  }

  it('rejects a real-looking private repository name presented as an alias', () => {
    const projection = c1Projection()
    const index = projection.repositories.findIndex((repository) => repository.disclosure === 'private-alias')
    projection.repositories[index].label = 'acme-payments-internal'
    expect(issuesOf(rehash(projection))).toContain('an aliased repository label must match the alias pattern')
  })

  it('rejects an owner/repository token anywhere', () => {
    const projection = c1Projection()
    const index = projection.repositories.findIndex((repository) => repository.disclosure === 'public-name')
    projection.repositories[index].label = 'acme-corp/payments'
    expect(issuesOf(rehash(projection)).join(' ')).toContain('privacy boundary: denied identity')
  })

  it.each([
    ['a URL', 'Read more at https://example.test/pull for context.'],
    ['a bare www host', 'Read more at www.example.test for context.'],
    ['a #number reference', 'The replay gap closed in #412 after review.'],
  ])('rejects %s in a narrative', (_label, text) => {
    expect(narrativeWith(text).some((message) => message.startsWith('privacy boundary:'))).toBe(true)
  })

  it.each([
    ['an ISO date', 'Activity peaked on 2026-03-14 before the release.'],
    ['a worded date', 'Activity peaked on 14 March 2026 before the release.'],
    ['a month and year', 'Activity peaked in March 2026 before the release.'],
  ])('rejects %s outside generatedAt', (_label, text) => {
    expect(narrativeWith(text)).toContain('privacy boundary: absolute date outside generatedAt')
  })

  it.each([
    ['an email', 'Feedback from dev@example.test shaped the period.'],
    ['a handle', 'Feedback from @octo-reviewer shaped the period.'],
    ['an underscore-leading handle', 'Feedback from @_bot shaped the period.'],
    ['a digit-leading handle', 'Feedback from @1reviewer shaped the period.'],
    ['a non-ASCII handle', 'Feedback from @Ünïcode shaped the period.'],
    ['a non-ASCII email', 'Feedback from dev@exämple.test shaped the period.'],
    ['a Windows path', 'Scanned C:\\work\\private-repo during collection.'],
  ])('rejects %s (reusing the ResearchFinding DENIED_TOKEN)', (_label, text) => {
    expect(narrativeWith(text)).toContain('privacy boundary: denied identity, email, handle, path, URL, or repository token')
  })

  it('admits only the literal showcase URL and only on C0', () => {
    const projection = clone(createShowcaseLensProjection())
    ;(projection.provenance as { showcaseUrl: string }).showcaseUrl = 'https://example.test/'
    expect(issuesOf(rehash(projection)).length).toBeGreaterThan(0)
    const c1 = c1Projection()
    ;(c1.provenance as { showcaseUrl?: string }).showcaseUrl = 'https://chris0jeky.github.io/developer-lens/'
    expect(issuesOf(rehash(c1))).toContain('showcaseUrl is admitted only on the C0 showcase projection')
  })
})

describe('PublicLensProjection.v1 coverage scale', () => {
  // Published in README.md; the README test below pins that table to this one.
  const vectors: Array<[number, number, number, number, number[]]> = [
    [2, 0, 0, 2, [100]],
    [1, 1, 1, 3, [55, 83]],
    [3, 1, 0, 4, [91]],
    [1, 0, 1, 2, [50, 100]],
    [0, 0, 0, 0, [0]],
  ]

  it.each(vectors)('complete %i, partial %i, unavailable %i, total %i admit %j', (complete, partial, unavailable, total, expected) => {
    expect(coverageScorePercentCandidates({ complete, partial, unavailable, total })).toEqual(expected)
  })

  const withCoverage = (coverage: Partial<PublicLensProjection['coverage']>): string[] => {
    const projection = clone(createShowcaseLensProjection())
    Object.assign(projection.coverage, coverage)
    return issuesOf(rehash(projection))
  }

  it('accepts the integer percent the counts admit', () => {
    expect(withCoverage({ complete: 1, partial: 1, unavailable: 1, total: 3, scorePercent: 83 })).toEqual([])
    expect(withCoverage({ complete: 1, partial: 1, unavailable: 1, total: 3, scorePercent: 55 })).toEqual([])
  })

  it('rejects the historical 0..1 scale for the same coverage', () => {
    expect(withCoverage({ complete: 1, partial: 1, unavailable: 1, total: 3, scorePercent: 0.83 }).length).toBeGreaterThan(0)
    expect(withCoverage({ complete: 2, partial: 0, unavailable: 0, total: 2, scorePercent: 1 })).toContain('scorePercent is not the integer 0..100 percent the coverage counts admit')
  })

  it('rejects a score the counts do not admit and counts that do not sum to total', () => {
    expect(withCoverage({ complete: 1, partial: 1, unavailable: 1, total: 3, scorePercent: 90 })).toContain('scorePercent is not the integer 0..100 percent the coverage counts admit')
    expect(withCoverage({ complete: 1, partial: 1, unavailable: 1, total: 4 })).toContain('coverage total must equal complete + partial + unavailable')
  })

  it('carries an 83% dashboard as 83 through the portable payload, not the clamped 100', () => {
    const dashboard = inventedLocalDashboard()
    dashboard.meta.coverageScore = 83
    dashboard.meta.coverage = [
      { id: 'github-public', label: 'Public', status: 'complete', detail: 'Invented.' },
      { id: 'github-private-repositories', label: 'Private', status: 'partial', detail: 'Invented.' },
      { id: 'local-git', label: 'Local Git', status: 'unavailable', detail: 'Invented.' },
    ]
    const { payload, projection } = createPublicLensProjectionFromDashboard(dashboard, {
      aliasSeed: 'invented-local-seed',
      repositoryRedaction: 'private-aliases',
      producerCommit: LENS_PROJECTION_FIXTURE_PRODUCER_COMMIT,
      producerVersion: '0.0.0',
    })
    expect(payload.summary.coverageScore).toBe(83)
    expect(projection.coverage).toMatchObject({ complete: 1, partial: 1, unavailable: 1, total: 3, scorePercent: 83 })
  })

  it('refuses to project a payload that carries a 0..1 coverage score', () => {
    const payload = createPortableExportPayload(showcaseDashboard(), { artifact: 'dashboard', aliasSeed: 'x', repositoryRedaction: 'private-aliases' })
    payload.summary.coverageScore = 1
    expect(() => createPublicLensProjection(payload, { generatedAt: LENS_PROJECTION_FIXTURE_GENERATED_AT, producerCommit: LENS_PROJECTION_FIXTURE_PRODUCER_COMMIT, producerVersion: '0.0.0', warnings: [] })).toThrow()
  })
})

describe('PublicLensProjection.v1 projection rules', () => {
  const basePayload = () => createPortableExportPayload(showcaseDashboard(), { artifact: 'dashboard', aliasSeed: 'x', repositoryRedaction: 'private-aliases' })
  const project = (payload = basePayload(), extra: { openAtRangeEnd?: number; warnings?: string[] } = {}) =>
    createPublicLensProjection(payload, {
      generatedAt: LENS_PROJECTION_FIXTURE_GENERATED_AT,
      producerCommit: LENS_PROJECTION_FIXTURE_PRODUCER_COMMIT,
      producerVersion: '0.0.0',
      warnings: extra.warnings ?? [],
      openAtRangeEnd: extra.openAtRangeEnd,
    })

  it('folds every theme key outside the eight named keys into other', () => {
    const payload = basePayload()
    payload.themes = [
      { key: 'feat', label: 'Building', color: '#b99cff', count: 40, share: 0.4 },
      { key: 'style', label: 'Other', color: '#8b95aa', count: 20, share: 0.2 },
      { key: 'wip', label: 'Other', color: '#8b95aa', count: 15, share: 0.15 },
      { key: 'deps', label: 'Other', color: '#8b95aa', count: 5, share: 0.05 },
      { key: 'other', label: 'Other', color: '#8b95aa', count: 20, share: 0.2 },
    ]
    const projection = project(payload)
    expect(projection.themes).toEqual([
      { key: 'other', share: 0.6 },
      { key: 'feat', share: 0.4 },
    ])
  })

  it('keeps shares within the 1.0001 bound where independent rounding would exceed it', () => {
    const weights = [1, 1, 1, 1, 1, 1]
    const naive = weights.map((weight) => Math.round((weight / 6) * 1_000) / 1_000)
    expect(naive.reduce((sum, value) => sum + value, 0)).toBeGreaterThan(1.0001)
    const shares = apportionThousandths(weights)
    expect(shares).toEqual([0.167, 0.167, 0.167, 0.167, 0.166, 0.166])
    expect(shares.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(1.0001)
    expect(apportionThousandths(Array.from({ length: 9 }, () => 1)).reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(1.0001)
  })

  it('keeps at most twelve repositories ordered by attentionShare', () => {
    const payload = basePayload()
    payload.repositories = Array.from({ length: 20 }, (_, index) => ({ ...payload.repositories[index % payload.repositories.length], label: `synthetic-${index}`, attentionShare: Math.round(((index + 1) / 210) * 1_000) / 1_000 }))
    const projection = project(payload)
    expect(projection.repositories).toHaveLength(12)
    expect(projection.repositories.map((repository) => repository.label)).toEqual(Array.from({ length: 12 }, (_, index) => `synthetic-${19 - index}`))
    // Apportioned over the exported twelve, so the published invariant (sum exactly 1) holds.
    const sum = projection.repositories.reduce((total, repository) => total + repository.attentionShare, 0)
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9)
    const top = 20 / (9 + 10 + 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19 + 20)
    expect(projection.repositories[0].attentionShare).toBeCloseTo(top, 2)
  })

  it.each([
    [1, 0],
    [2, 0.333],
    [0.5, -0.333],
    [3, 0.5],
    [10, 0.818],
    [21, 0.909],
    [0, -1],
  ])('maps a late/early momentum ratio of %d to the score %d', (ratio, score) => {
    expect(momentumScore(ratio)).toBe(score)
  })

  it('exports a stable 1x repository at momentum 0 and a doubled one at +1/3, not ratio / 100', () => {
    const payload = basePayload()
    payload.repositories = [
      { ...payload.repositories[0], label: 'synthetic-steady', attentionShare: 0.5, momentum: 1 },
      { ...payload.repositories[1], label: 'synthetic-rising', attentionShare: 0.3, momentum: 2 },
      { ...payload.repositories[2], label: 'synthetic-fading', attentionShare: 0.2, momentum: 0.5 },
    ]
    expect(project(payload).repositories.map((repository) => [repository.label, repository.momentum])).toEqual([
      ['synthetic-steady', 0],
      ['synthetic-rising', 0.333],
      ['synthetic-fading', -0.333],
    ])
  })

  it('keeps the analytics ratio through the portable payload instead of rounding it to an integer', () => {
    const dashboard = showcaseDashboard()
    dashboard.repositories = dashboard.repositories.map((repository, index) => ({ ...repository, momentum: [1.4, 0.6, 1][index % 3] }))
    const payload = createPortableExportPayload(dashboard, { artifact: 'dashboard', aliasSeed: 'x', repositoryRedaction: 'private-aliases' })
    expect(payload.repositories.slice(0, 3).map((repository) => repository.momentum)).toEqual([1.4, 0.6, 1])
  })

  it('de-duplicates labels that collide after 40-character truncation, deterministically', () => {
    const payload = basePayload()
    const prefix = 'synthetic-shared-prefix-for-a-very-long-'
    payload.repositories = [
      { ...payload.repositories[0], label: `${prefix}alpha`, attentionShare: 0.4 },
      { ...payload.repositories[1], label: `${prefix}beta`, attentionShare: 0.35 },
      { ...payload.repositories[2], label: `${prefix}gamma`, attentionShare: 0.25 },
    ]
    const labels = project(payload).repositories.map((repository) => repository.label)
    expect(labels).toEqual([prefix.slice(0, 40), `${prefix.slice(0, 36)} (2)`, `${prefix.slice(0, 36)} (3)`])
    expect(labels.every((label) => label.length <= 40)).toBe(true)
    expect(project(payload).repositories.map((repository) => repository.label)).toEqual(labels)
    expect(disambiguateLabels(['a', 'a', 'a (2)', 'a'])).toEqual(['a', 'a (2)', 'a (2) (2)', 'a (3)'])
  })

  it('truncates without splitting a surrogate pair', () => {
    expect(truncateText(`${'x'.repeat(39)}😀tail`, 40)).toBe('x'.repeat(39))
  })

  it('exports delivery only when the median and open-work count are both available', () => {
    expect(project(basePayload()).delivery).toBeUndefined()
    const payload = basePayload()
    expect(project(payload, { openAtRangeEnd: 0 }).delivery).toEqual({ mergedSamples: payload.summary.mergedPullRequests, medianMergeHours: payload.summary.medianMergeHours, openAtRangeEnd: 0, censored: false })
    const unavailable = basePayload()
    unavailable.summary.medianMergeHours = null
    expect(project(unavailable, { openAtRangeEnd: 3 }).delivery).toBeUndefined()
  })

  it('keeps one narrative per order', () => {
    const payload = basePayload()
    expect(payload.narratives.map((narrative) => narrative.order)).toEqual([1, 2, 2, 3])
    expect(project(payload).narratives.map((narrative) => narrative.order)).toEqual([1, 2, 3])
  })
})

describe('CoverageWarningCode mapping', () => {
  // Every producer template, rendered through the builder the producer itself calls. The Record
  // type makes this table exhaustive: a new template without an expected code fails to compile.
  const EXPECTED_CODES: Record<CollectionWarningTemplate, Exclude<CoverageWarningCode, 'unrecognized_warning'>> = {
    commitDaysGrouped: 'commit_detail_partial',
    authoredPullRequestSearchCapped: 'search_detail_capped',
    reviewRecordsTruncated: 'review_detail_partial',
    reviewedPullRequestSearchCapped: 'review_detail_partial',
    authoredIssueSearchCapped: 'search_detail_capped',
    commitDetailQueryFailed: 'commit_detail_partial',
    lineStatisticsQueryFailed: 'line_changes_partial',
    restrictedContributions: 'private_activity_aggregated',
    localGitIdentityMissing: 'local_git_partial',
    localRepositoryUnreadable: 'local_git_partial',
    demoIllustrativeData: 'synthetic_showcase',
    hostedShowcase: 'synthetic_showcase',
  }
  const render = (template: CollectionWarningTemplate): string => {
    const build = COLLECTION_WARNINGS[template] as (...args: Array<string | number>) => string
    return build(...Array.from({ length: build.length }, (_, index) => (index % 2 === 0 ? 'invented-owner/invented-repo' : 7)))
  }

  it.each(Object.keys(EXPECTED_CODES) as CollectionWarningTemplate[])('maps the producer template %s to its registry code', (template) => {
    expect(coverageWarningCode(render(template))).toBe(EXPECTED_CODES[template])
  })

  it('maps an unregistered warning to unrecognized_warning', () => {
    expect(coverageWarningCode('A future warning nobody has registered yet about invented-private-repo.')).toBe('unrecognized_warning')
  })

  it('finds no inline warning text in the producers', async () => {
    const producers = ['server/github.ts', 'server/localGit.ts', 'server/demo.ts', 'scripts/exportDemo.ts']
    for (const producer of producers) {
      const source = await readFile(resolve(producer), 'utf8')
      // The first token after `warnings.push(` or `warnings: [` / `warnings = [`, across newlines.
      const sites = [...source.matchAll(/warnings(?:\.push\(|\s*[:=]\s*\[)\s*([^\s(]+)/g)].map((match) => match[1])
      for (const site of sites) {
        expect(site.startsWith('COLLECTION_WARNINGS.') || site.startsWith(']'), `${producer}: ${site}`).toBe(true)
      }
      if (producer !== 'server/demo.ts' && producer !== 'scripts/exportDemo.ts') expect(sites.length, producer).toBeGreaterThan(0)
    }
  })

  it('de-duplicates into registry order and never copies warning text', () => {
    const warnings = [
      'invented-private-repo could not be read; it was excluded from local enrichment.',
      'Something new about invented-private-repo.',
      'GitHub search capped authored issue detail at 1,000; contribution totals retain the larger public count.',
      'Another new thing about invented-private-repo.',
    ]
    const mapped = mapCoverageWarnings(warnings)
    expect(mapped.map((entry) => entry.code)).toEqual(['search_detail_capped', 'local_git_partial', 'unrecognized_warning'])
    expect(JSON.stringify(mapped)).not.toContain('invented-private-repo')
    expect(mapCoverageWarnings(Object.keys(COVERAGE_WARNINGS).flatMap(() => warnings)).length).toBeLessThanOrEqual(8)
  })
})

describe('PublicLensProjection.v1 README', () => {
  it('publishes the registry, coverage vectors, and fixture hashes consistently', async () => {
    const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).replaceAll('\r\n', '\n')
    const section = (heading: string) => {
      const start = readme.indexOf(`### ${heading}`)
      expect(start, heading).toBeGreaterThanOrEqual(0)
      const end = readme.indexOf('\n### ', start + 5)
      return readme.slice(start, end < 0 ? undefined : end)
    }
    const rows = (text: string) => text.split('\n').filter((line) => /^\| `?[^-\s|]/.test(line) && !/^\| (?:code|complete) \|/.test(line)).map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim().replace(/^`|`$/g, '')))
    expect(rows(section('CoverageWarningCode'))).toEqual(Object.entries(COVERAGE_WARNINGS))
    const vectorRows = rows(section('Coverage score vectors')).map(([complete, partial, unavailable, total, admitted]) => [Number(complete), Number(partial), Number(unavailable), Number(total), admitted.split(',').map((value) => Number(value.trim()))])
    for (const [complete, partial, unavailable, total, admitted] of vectorRows as Array<[number, number, number, number, number[]]>) {
      expect(coverageScorePercentCandidates({ complete, partial, unavailable, total })).toEqual(admitted)
    }
    expect(vectorRows.length).toBeGreaterThanOrEqual(5)
    const momentumStart = readme.indexOf('## Repository momentum')
    const momentumRows = readme.slice(momentumStart, readme.indexOf('\n## ', momentumStart + 5)).split('\n').filter((line) => /^\| -?\d/.test(line)).map((line) => line.slice(1, -1).split('|').map((cell) => Number(cell.trim())))
    expect(momentumRows.length).toBeGreaterThanOrEqual(5)
    for (const [ratio, score] of momentumRows) expect(momentumScore(ratio), `ratio ${ratio}`).toBe(score)
    const fixtureText = (await readFile(fixturePath, 'utf8')).replaceAll('\r\n', '\n')
    const fixture = JSON.parse(fixtureText) as PublicLensProjection
    expect(readme).toContain(`\`${lensFixtureSha256(fixtureText)}\``)
    expect(readme).toContain(`\`${fixture.provenance.projectionHash}\``)
    expect(readme).toContain(`\`${fixture.provenance.inputHash}\``)
  })
})
