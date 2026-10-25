import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DashboardData, RangeKey } from '../shared/types.js'
import {
  ArtifactExportError,
  exportArtifacts,
  runExportArtifactsCli,
} from './exportArtifacts.js'
import { createPublicShowcaseDashboard } from './exportDemo.js'
import { scanDirectoryForForbiddenPatterns } from './exportPrivacyGuards.js'

const syntheticDashboard = (range: RangeKey): Promise<DashboardData> =>
  Promise.resolve(createPublicShowcaseDashboard(range))

const postWriteViolation = async (): Promise<{
  filesScanned: number
  violations: string[]
}> => ({
  filesScanned: 1,
  violations: ['fixture post-write violation'],
})

function exportOptions(outputDirectory: string): Parameters<typeof exportArtifacts>[0] {
  return {
    outputDirectory,
    source: 'synthetic',
    ranges: ['6m'],
    repositoryRedaction: 'all-aliases',
    loadDashboard: syntheticDashboard,
    aliasSeed: () => 'synthetic-showcase-6m',
    env: {},
    postWriteScanner: postWriteViolation,
  } as Parameters<typeof exportArtifacts>[0]
}

describe('headless export post-write cleanup', () => {
  let root: string
  let output: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'developer-lens-export-cleanup-'))
    output = join(root, 'artifacts')
  })

  afterEach(() => {
    rmSync(root, { force: true, recursive: true })
  })

  it('removes the directory it created when the written-artifact scan fails', async () => {
    await expect(exportArtifacts(exportOptions(output))).rejects.toThrow(
      /privacy scan failed after write: fixture post-write violation/,
    )
    expect(() => readdirSync(output)).toThrow()
  })

  it('keeps a pre-existing output directory but removes every written artifact', async () => {
    mkdirSync(output)

    await expect(exportArtifacts(exportOptions(output))).rejects.toThrow(
      /privacy scan failed after write: fixture post-write violation/,
    )
    expect(readdirSync(output)).toEqual([])
  })

  it('does not report incomplete cleanup when the output was already removed', async () => {
    await expect(exportArtifacts({
      ...exportOptions(output),
      postWriteScanner: async (directory) => {
        await rm(directory, { force: true, recursive: true })
        return postWriteViolation()
      },
    })).rejects.toThrow(/^privacy scan failed after write: fixture post-write violation$/)
    expect(() => readdirSync(output)).toThrow()
  })

  for (const entry of ['file', 'directory'] as const) {
    it(`preserves an unrelated ${entry} created during a failed export`, async () => {
      const unowned = join(output, entry === 'file' ? 'operator-note.md' : 'operator-drafts')
      const note = entry === 'file' ? unowned : join(unowned, 'note.md')
      await expect(exportArtifacts({
        ...exportOptions(output),
        postWriteScanner: async (directory, patterns) => {
          // Simulate the operator saving work while export and verification are in flight.
          if (entry === 'directory') mkdirSync(unowned)
          writeFileSync(note, 'invented operator work to preserve', 'utf8')
          writeFileSync(join(directory, 'developer-lens-6m-overview.svg'), 'ghp_inventedExportCleanupCanary', 'utf8')
          return scanDirectoryForForbiddenPatterns(directory, patterns)
        },
      })).rejects.toThrow(/^privacy scan failed after write: GitHub token prefix found in /)

      expect(readFileSync(note, 'utf8')).toBe('invented operator work to preserve')
      expect(readdirSync(output)).toEqual([entry === 'file' ? 'operator-note.md' : 'operator-drafts'])
    })
  }

  it('attempts every cleanup removal and keeps the privacy failure primary', async () => {
    mkdirSync(output)
    const attempted: string[] = []
    let plantedFailure = true
    const options = {
      ...exportOptions(output),
      removeFile: async (path: string): Promise<void> => {
        attempted.push(path)
        if (plantedFailure) {
          plantedFailure = false
          throw Object.assign(new Error('fixture locked file'), { code: 'EBUSY' })
        }
        await rm(path, { force: true })
      },
    } as Parameters<typeof exportArtifacts>[0]

    let error: unknown
    try {
      await exportArtifacts(options)
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(ArtifactExportError)
    expect((error as Error).message).toMatch(
      /^privacy scan failed after write: fixture post-write violation/,
    )
    expect((error as Error).message).toContain('cleanup incomplete')
    expect((error as Error).message).not.toContain('fixture locked file')
    expect(attempted.length).toBeGreaterThan(2)
    expect(readdirSync(output)).toHaveLength(1)
  })
})

describe('headless export argument redaction', () => {
  it('does not echo an undelimited dash-shaped argument', async () => {
    for (const argument of [
      '--tokenghp_secretCanary',
      '--Authorization-Bearer-secret-canary',
    ]) {
      const lines: string[] = []
      const code = await runExportArtifactsCli([argument], {}, (line) => lines.push(line))
      const logged = lines.join('\n')

      expect(code, argument).toBe(1)
      expect(logged, argument).toContain('unexpected argument at position 1')
      expect(logged, argument).not.toContain('secretCanary')
      expect(logged, argument).not.toContain('Authorization-Bearer')
    }
  })
})
