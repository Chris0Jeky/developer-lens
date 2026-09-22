import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PublicLensProjectionSchema } from '../shared/lensProjection.js'
import type { DashboardData, RangeKey } from '../shared/types.js'
import { ACKNOWLEDGE_REDACTION_FLAG, ArtifactExportError, EXPORT_MANIFEST_FILE } from './exportArtifacts.js'
import { createPublicShowcaseDashboard } from './exportDemo.js'
import { PROFILE_ARTIFACT_FILE, exportProfile, runExportProfileCli, type ExportProfileOptions } from './exportProfile.js'

const COMMIT = 'a'.repeat(40)
const PRIVATE_NAME = 'invented-private-ledger'

const showcase = (range: RangeKey): Promise<DashboardData> => Promise.resolve(createPublicShowcaseDashboard(range))

/** Invented stand-in for a local dashboard: never reads `.developer-lens/`. */
function inventedLocal(range: RangeKey): Promise<DashboardData> {
  const dashboard = createPublicShowcaseDashboard(range)
  dashboard.meta.privacy = 'local-only'
  dashboard.meta.mode = 'private'
  dashboard.meta.subject = { login: 'invented-owner' }
  dashboard.repositories = dashboard.repositories.map((repository, index) =>
    index === 0
      ? { ...repository, isPrivate: true, nameWithOwner: `invented-owner/${PRIVATE_NAME}`, displayName: PRIVATE_NAME }
      : { ...repository, isPrivate: index % 2 === 0 },
  )
  dashboard.meta.warnings = [`${PRIVATE_NAME} could not be read; it was excluded from local enrichment.`]
  return Promise.resolve(dashboard)
}

describe('headless profile export', () => {
  let directory: string
  let output: string
  const base = (overrides: Partial<ExportProfileOptions> = {}): ExportProfileOptions => ({
    outputDirectory: output,
    source: 'showcase',
    range: '12m',
    repositoryRedaction: 'private-aliases',
    loadDashboard: showcase,
    resolveProducerCommit: () => COMMIT,
    producerVersion: '0.0.0',
    env: {},
    ...overrides,
  })
  const readProjection = () => JSON.parse(readFileSync(join(output, PROFILE_ARTIFACT_FILE), 'utf8')) as unknown

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'developer-lens-export-profile-'))
    output = join(directory, 'profile')
  })

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true })
  })

  it('writes a valid C0 showcase projection and a manifest naming exactly it', async () => {
    const result = await exportProfile(base())
    expect(result).toMatchObject({ source: 'showcase', scope: 'public-demo', dataClass: 'C0', file: PROFILE_ARTIFACT_FILE })
    expect(readdirSync(output).sort()).toEqual([EXPORT_MANIFEST_FILE, PROFILE_ARTIFACT_FILE].sort())
    const projection = PublicLensProjectionSchema.parse(readProjection())
    expect(projection).toMatchObject({ dataClass: 'C0', repositoryRedaction: 'synthetic' })
    expect(projection.provenance.producerCommit).toBe(COMMIT)
    const manifest = JSON.parse(readFileSync(join(output, EXPORT_MANIFEST_FILE), 'utf8')) as { source: string; scope: string; artifacts: Array<{ file: string; kind: string }> }
    expect(manifest).toMatchObject({ source: 'showcase', scope: 'public-demo', repositoryRedaction: 'synthetic' })
    expect(manifest.artifacts).toEqual([expect.objectContaining({ file: PROFILE_ARTIFACT_FILE, kind: 'lens-projection' })])
  })

  it('refuses a local export without the redaction acknowledgement and writes nothing', async () => {
    let loaded = false
    await expect(exportProfile(base({ source: 'local', loadDashboard: (range) => { loaded = true; return inventedLocal(range) } }))).rejects.toThrow(ArtifactExportError)
    expect(loaded).toBe(false)
    expect(() => readdirSync(output)).toThrow()

    const lines: string[] = []
    const code = await runExportProfileCli(['--source', 'local', '--out', output], {}, (line) => lines.push(line), {
      loadDashboard: (range) => { loaded = true; return inventedLocal(range) },
      resolveProducerCommit: () => COMMIT,
    })
    expect(code).toBe(1)
    expect(loaded).toBe(false)
    expect(lines[0]).toContain(`Re-run with ${ACKNOWLEDGE_REDACTION_FLAG}`)
    expect(() => readdirSync(output)).toThrow()
  })

  it('exports acknowledged local data as C1 redacted-local with private-aliases by default', async () => {
    const lines: string[] = []
    const code = await runExportProfileCli(['--source', 'local', ACKNOWLEDGE_REDACTION_FLAG, '--out', output], {}, (line) => lines.push(line), {
      loadDashboard: inventedLocal,
      resolveProducerCommit: () => COMMIT,
    })
    expect(code, lines.join('\n')).toBe(0)
    const text = readFileSync(join(output, PROFILE_ARTIFACT_FILE), 'utf8')
    const projection = PublicLensProjectionSchema.parse(JSON.parse(text))
    expect(projection).toMatchObject({ dataClass: 'C1', scope: 'redacted-local', repositoryRedaction: 'private-aliases' })
    expect(projection.provenance.showcaseUrl).toBeUndefined()
    expect(projection.repositories.some((repository) => repository.disclosure === 'private-alias')).toBe(true)
    expect(projection.repositories.some((repository) => repository.disclosure === 'public-name')).toBe(true)
    expect(projection.coverage.warnings.map((warning) => warning.code)).toEqual(['local_git_partial'])
    expect(text).not.toContain(PRIVATE_NAME)
    expect(text).not.toContain('invented-owner')
    expect(lines.join('\n')).toContain('never a Pages artifact')
  })

  it('honours all-aliases for a local export', async () => {
    await exportProfile(base({ source: 'local', acknowledgeRedaction: true, repositoryRedaction: 'all-aliases', loadDashboard: inventedLocal, aliasSeed: 'invented-seed' }))
    const projection = PublicLensProjectionSchema.parse(readProjection())
    expect(projection.repositoryRedaction).toBe('all-aliases')
    expect(projection.repositories.every((repository) => repository.disclosure === 'masked-alias')).toBe(true)
  })

  it('refuses mismatched sources, a showcase redaction flag, extra ranges, and a missing producer commit', async () => {
    await expect(exportProfile(base({ loadDashboard: inventedLocal }))).rejects.toThrow('is not marked public-demo')
    await expect(exportProfile(base({ source: 'local', acknowledgeRedaction: true }))).rejects.toThrow('use --source showcase')
    await expect(exportProfile(base({ resolveProducerCommit: () => { throw new Error('no git') } }))).rejects.toThrow('producer commit is unavailable')
    await expect(exportProfile(base({ resolveProducerCommit: () => 'HEAD' }))).rejects.toThrow('producer commit is unavailable')
    const lines: string[] = []
    expect(await runExportProfileCli(['--repository-redaction', 'all-aliases', '--out', output], {}, (line) => lines.push(line))).toBe(1)
    expect(lines[0]).toBe('refused: --repository-redaction applies only to --source local')
    expect(await runExportProfileCli(['--range', '6m', '--range', '12m', '--out', output], {}, (line) => lines.push(line))).toBe(1)
    expect(lines).toContain('refused: a profile export takes exactly one --range')
    expect(await runExportProfileCli(['--secret=value'], {}, (line) => lines.push(line))).toBe(1)
    expect(lines).toContain('refused: unknown option --secret')
    expect(lines.join('\n')).not.toContain('--secret=value')
    expect(() => readdirSync(output)).toThrow()
  })

  it('replaces only files its previous manifest owns and refuses an unrelated populated directory', async () => {
    await exportProfile(base())
    await exportProfile(base({ range: '6m' }))
    expect(readdirSync(output).sort()).toEqual([EXPORT_MANIFEST_FILE, PROFILE_ARTIFACT_FILE].sort())
    writeFileSync(join(output, 'owner-note.txt'), 'keep me\n')
    await expect(exportProfile(base())).rejects.toThrow('does not claim')
    expect(readFileSync(join(output, 'owner-note.txt'), 'utf8')).toBe('keep me\n')
    const unrelated = join(directory, 'unrelated')
    mkdirSync(unrelated)
    writeFileSync(join(unrelated, 'notes.txt'), 'x')
    await expect(exportProfile(base({ outputDirectory: unrelated }))).rejects.toThrow('holds no export-manifest.json')
  })

  it('removes everything it wrote when the post-write scan trips', async () => {
    await expect(
      exportProfile(base({ postWriteScanner: () => Promise.resolve({ filesScanned: 2, violations: ['canary found in written output'] }) })),
    ).rejects.toThrow('privacy scan failed after write: canary found in written output')
    expect(() => readdirSync(output)).toThrow()
  })

  it('refuses before writing when a forbidden pattern appears in the projection', async () => {
    // The env-derived bearer pattern matches the synthetic label, standing in for any leak.
    await expect(exportProfile(base({ env: { DEVELOPER_LENS_V2_TOKEN: 'relay-api' } }))).rejects.toThrow('privacy scan failed: DEVELOPER_LENS_V2_TOKEN value found in lens-profile.v1.json')
    expect(() => readdirSync(output)).toThrow()
  })
})
