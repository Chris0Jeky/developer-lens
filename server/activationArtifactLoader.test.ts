import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ACTIVATION_ARTIFACT_LOAD_ERROR_CODE,
  activationArtifactLoaderTestSeams,
  loadHashBoundActivationLastRunReport,
} from './activationArtifactLoader.js'

const taskId = 'fixture-report-01'
let roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })))
  roots = []
})

async function fixtureRoot(content = '{"schemaVersion":"fixture-report.v1","status":"complete"}'): Promise<{ root: string; reportPath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'developer-lens-report-loader-'))
  roots.push(root)
  const directory = join(root, '.developer-lens', 'activation', taskId)
  const reportPath = join(directory, 'last-run-report.json')
  await mkdir(directory, { recursive: true })
  await writeFile(reportPath, content, 'utf8')
  return { root, reportPath }
}

async function expectInvalid(input: unknown): Promise<void> {
  await expect(loadHashBoundActivationLastRunReport(input)).rejects.toMatchObject({
    code: ACTIVATION_ARTIFACT_LOAD_ERROR_CODE,
    message: ACTIVATION_ARTIFACT_LOAD_ERROR_CODE,
  })
}

describe('fixed activation report artifact seam', () => {
  it('loads only the fixed report filename and binds its exact bytes to the supplied SHA', async () => {
    const fixture = await fixtureRoot()
    const bytes = await readFile(fixture.reportPath)
    const expectedSha256 = createHash('sha256').update(bytes).digest('hex')
    await expect(loadHashBoundActivationLastRunReport({ workspaceRoot: fixture.root, taskId, expectedSha256 }))
      .resolves.toEqual({ taskId, parsed: { schemaVersion: 'fixture-report.v1', status: 'complete' } })

    await writeFile(join(fixture.root, '.developer-lens', 'activation', taskId, 'report.json'), bytes)
    await rm(fixture.reportPath)
    await expectInvalid({ workspaceRoot: fixture.root, taskId, expectedSha256 })
  })

  it('keeps the fixed 64 KiB cap and closed hash input boundary', async () => {
    const fixture = await fixtureRoot(' '.repeat(64 * 1024 + 1))
    await expectInvalid({ workspaceRoot: fixture.root, taskId, expectedSha256: '0'.repeat(64) })
    await expectInvalid({ workspaceRoot: fixture.root, taskId, expectedSha256: 'A'.repeat(64) })
    await expectInvalid({ workspaceRoot: fixture.root, taskId, expectedSha256: '0'.repeat(64), maxBytes: 1 })
  })

  it('rejects a task-directory replacement between the two fixed-path reads', async () => {
    const fixture = await fixtureRoot()
    const bytes = await readFile(fixture.reportPath)
    const expectedSha256 = createHash('sha256').update(bytes).digest('hex')
    const taskDirectory = join(fixture.root, '.developer-lens', 'activation', taskId)
    await expect(activationArtifactLoaderTestSeams.loadReportWithHooks(
      { workspaceRoot: fixture.root, taskId, expectedSha256 },
      {
        afterFirstRead: async () => {
          const replacement = `${taskDirectory}-replacement`
          await rename(taskDirectory, replacement)
          await mkdir(taskDirectory, { recursive: true })
          await writeFile(join(taskDirectory, 'last-run-report.json'), bytes)
        },
      },
    )).rejects.toMatchObject({ code: ACTIVATION_ARTIFACT_LOAD_ERROR_CODE })
  })
})
