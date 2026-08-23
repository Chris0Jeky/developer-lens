import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DashboardData, RangeKey } from '../shared/types.js'
import { WRAPPED_CHAPTER_IDS } from '../src/lib/sharePayload.js'
import {
  ACKNOWLEDGE_REDACTION_FLAG,
  ArtifactExportError,
  EXPORT_MANIFEST_FILE,
  exportArtifacts,
  runExportArtifactsCli,
} from './exportArtifacts.js'
import { createPublicShowcaseDashboard } from './exportDemo.js'
import {
  createForbiddenPatterns,
  portableBoundaryViolations,
  scanDirectoryForForbiddenPatterns,
  shareBoundaryViolations,
} from './exportPrivacyGuards.js'

interface Manifest {
  source: string
  scope: string
  repositoryRedaction: string
  privacyScan: { scanner: string; patternCount: number }
  artifacts: { file: string; kind: string; range: string | null; bytes: number }[]
}

const syntheticDashboard = (range: RangeKey): Promise<DashboardData> =>
  Promise.resolve(createPublicShowcaseDashboard(range))

describe('headless artifact export', () => {
  let directory: string
  let output: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'developer-lens-export-artifacts-'))
    output = join(directory, 'artifacts')
  })

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true })
  })

  it('writes every synthetic artifact for one range and records the privacy scan', async () => {
    const result = await exportArtifacts({
      outputDirectory: output,
      source: 'synthetic',
      ranges: ['6m'],
      repositoryRedaction: 'all-aliases',
      loadDashboard: syntheticDashboard,
      aliasSeed: () => 'synthetic-showcase-6m',
      env: {},
    })

    expect(result.scope).toBe('public-demo')
    expect(result.privacyScan.status).toBe('passed')
    expect(result.privacyScan.patternCount).toBeGreaterThan(0)
    expect(result.privacyScan.filesScanned).toBe(result.artifacts.length)

    const written = readdirSync(output).sort()
    expect(written).toContain('developer-lens-6m-overview.svg')
    expect(written).toContain('developer-lens-6m-overview-report.html')
    expect(written).toContain('developer-lens-6m-overview-caption-story.txt')
    expect(written).toContain('developer-lens-6m-overview-caption-professional.txt')
    expect(written).toContain('developer-lens-6m-overview-caption-compact.txt')
    expect(written).toContain('developer-lens-6m-dashboard-portable.html')
    expect(written).toContain('developer-lens-6m-wrapped-portable.html')
    expect(written).toContain('dashboard-6m.json')
    expect(written).toContain(EXPORT_MANIFEST_FILE)
    for (const chapterId of WRAPPED_CHAPTER_IDS) {
      expect(written).toContain(`developer-lens-6m-wrapped-${chapterId}.svg`)
    }
    expect(WRAPPED_CHAPTER_IDS).toHaveLength(9)

    const read = (file: string): string => readFileSync(join(output, file), 'utf8')
    expect(read('developer-lens-6m-overview.svg')).toMatch(/^<svg[\s\S]*<\/svg>$/)
    expect(read('developer-lens-6m-overview.svg')).toContain('viewBox="0 0 1200 630"')
    expect(read('developer-lens-6m-overview-report.html')).toMatch(/^<!doctype html>/)
    expect(read('developer-lens-6m-wrapped-portable.html')).toContain('data-chapter="9"')
    expect(
      new Set([
        read('developer-lens-6m-overview-caption-story.txt'),
        read('developer-lens-6m-overview-caption-professional.txt'),
        read('developer-lens-6m-overview-caption-compact.txt'),
      ]).size,
    ).toBe(3)

    const dashboard = JSON.parse(read('dashboard-6m.json')) as DashboardData
    expect(dashboard.meta.privacy).toBe('public-demo')
    expect(dashboard.meta.subject.login).toBe('synthetic-builder')

    const manifest = JSON.parse(read(EXPORT_MANIFEST_FILE)) as Manifest
    expect(manifest.source).toBe('synthetic')
    expect(manifest.privacyScan.scanner).toBe('scripts/exportPrivacyGuards.ts')
    // The manifest lists every artifact except itself; its own size is not self-referential.
    expect(manifest.artifacts.map((artifact) => artifact.file).sort()).toEqual(
      written.filter((file) => file !== EXPORT_MANIFEST_FILE),
    )
    for (const artifact of manifest.artifacts) {
      expect(artifact.bytes).toBeGreaterThan(0)
    }
  })

  it('covers both supported ranges by default through the CLI', async () => {
    const lines: string[] = []
    const code = await runExportArtifactsCli(['--out', output], {}, (line) => {
      lines.push(line)
    })

    expect(code).toBe(0)
    const written = readdirSync(output)
    expect(written).toContain('dashboard-6m.json')
    expect(written).toContain('dashboard-12m.json')
    expect(written).toContain('developer-lens-12m-wrapped-portable.html')
    expect(lines.join('\n')).toContain('Privacy scan passed')
  })

  it('refuses a local export without the redaction acknowledgement and writes nothing', async () => {
    const lines: string[] = []
    const code = await runExportArtifactsCli(['--out', output, '--source', 'local'], {}, (line) => {
      lines.push(line)
    })

    expect(code).toBe(1)
    expect(lines.join('\n')).toContain(ACKNOWLEDGE_REDACTION_FLAG)
    expect(lines.join('\n')).toContain('docs/data-charter.md')
    expect(() => readdirSync(output)).toThrow()
  })

  it('refuses --repository-redaction on the synthetic lane', async () => {
    const lines: string[] = []
    const code = await runExportArtifactsCli(
      ['--out', output, '--repository-redaction', 'private-aliases'],
      {},
      (line) => {
        lines.push(line)
      },
    )

    expect(code).toBe(1)
    expect(lines.join('\n')).toContain('applies only to --source local')
  })

  it('refuses to overwrite a directory that is not a previous export', async () => {
    writeFileSync(join(directory, 'unrelated.txt'), 'keep me', 'utf8')
    await expect(
      exportArtifacts({
        outputDirectory: directory,
        source: 'synthetic',
        ranges: ['6m'],
        repositoryRedaction: 'all-aliases',
        loadDashboard: syntheticDashboard,
        env: {},
      }),
    ).rejects.toBeInstanceOf(ArtifactExportError)
    expect(readdirSync(directory)).toContain('unrelated.txt')
  })

  it('fails closed and writes nothing when a forbidden pattern reaches an artifact', async () => {
    const poisoned = (range: RangeKey): Promise<DashboardData> => {
      const dashboard = createPublicShowcaseDashboard(range)
      // A leaked local path inside a rendered field. The share card renders the archetype-free
      // title, so poison a field the portable report is known to render: the language name.
      dashboard.languages[0].name = 'C:\\Users\\canary\\lens'
      return Promise.resolve(dashboard)
    }

    await expect(
      exportArtifacts({
        outputDirectory: output,
        source: 'synthetic',
        ranges: ['6m'],
        repositoryRedaction: 'private-aliases',
        loadDashboard: poisoned,
        env: {},
      }),
    ).rejects.toThrow(/privacy scan failed[\s\S]*Windows user path/)
    expect(() => readdirSync(output)).toThrow()
  })

  it('rejects a synthetic run whose dashboard lost its public-demo marker', async () => {
    await expect(
      exportArtifacts({
        outputDirectory: output,
        source: 'synthetic',
        ranges: ['6m'],
        repositoryRedaction: 'all-aliases',
        loadDashboard: (range) => {
          const dashboard = createPublicShowcaseDashboard(range)
          dashboard.meta.privacy = 'local-only'
          return Promise.resolve(dashboard)
        },
        env: {},
      }),
    ).rejects.toThrow(/not marked public-demo/)
  })
})

describe('shared export privacy guards', () => {
  it('detects a planted secret in a written directory', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'developer-lens-export-scan-'))
    try {
      writeFileSync(join(directory, 'clean.svg'), '<svg></svg>', 'utf8')
      const clean = await scanDirectoryForForbiddenPatterns(directory, createForbiddenPatterns({}))
      expect(clean).toEqual({ filesScanned: 1, violations: [] })

      writeFileSync(join(directory, 'leak.txt'), 'token ghp_exampleCanaryValue', 'utf8')
      const dirty = await scanDirectoryForForbiddenPatterns(directory, createForbiddenPatterns({}))
      expect(dirty.filesScanned).toBe(2)
      expect(dirty.violations.join('\n')).toContain('GitHub token prefix')
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('adds an exported bridge bearer value to the pattern set', () => {
    const patterns = createForbiddenPatterns({ DEVELOPER_LENS_V2_TOKEN: 'canary-bearer-value' })
    expect(patterns.some((entry) => entry.label.includes('DEVELOPER_LENS_V2_TOKEN value'))).toBe(
      true,
    )
    expect(
      patterns.filter((entry) => entry.pattern.test('canary-bearer-value')).length,
    ).toBeGreaterThan(0)
  })

  it('flags a repository identity or pull-request title escaping a share artifact', () => {
    const dashboard = createPublicShowcaseDashboard('6m')
    const identity = dashboard.repositories[0].displayName
    const title = dashboard.pullRequests[0].title

    expect(shareBoundaryViolations('card.svg', dashboard, 'clean aggregate copy')).toEqual([])
    expect(shareBoundaryViolations('card.svg', dashboard, `built ${identity}`)).toContain(
      'card.svg: a repository identity escaped into the share output',
    )
    expect(shareBoundaryViolations('card.svg', dashboard, `about ${title}`)).toContain(
      'card.svg: a pull request title escaped into the share output',
    )
  })

  it('flags identity, timing, scripts, and remote assets escaping a portable artifact', () => {
    const dashboard = createPublicShowcaseDashboard('6m')

    expect(portableBoundaryViolations('p.html', dashboard, '<p>aggregates only</p>')).toEqual([])
    expect(
      portableBoundaryViolations('p.html', dashboard, `<p>${dashboard.meta.subject.login}</p>`),
    ).toContain('p.html: subject identity escaped into the portable output')
    expect(
      portableBoundaryViolations('p.html', dashboard, `<p>${dashboard.meta.generatedAt}</p>`),
    ).toContain('p.html: exact generation time escaped into the portable output')
    expect(portableBoundaryViolations('p.html', dashboard, '<script>x()</script>')).toContain(
      'p.html: portable output contains a script',
    )
    expect(portableBoundaryViolations('p.html', dashboard, '<img src="x">')).toContain(
      'p.html: portable output references an external asset',
    )
  })
})
