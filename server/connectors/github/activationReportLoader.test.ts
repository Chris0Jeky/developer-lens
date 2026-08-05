import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GITHUB_CORE_ACTIVATION_RESULT_SCHEMA_VERSION } from './activationResult.js'
import { GITHUB_CORE_ACTIVATION_REPORT_SCHEMA_VERSION } from './activationReport.js'
import {
  GITHUB_CORE_ACTIVATION_REPORT_LOAD_ERROR_CODE,
  loadHashBoundGithubCoreActivationReport,
} from './activationReportLoader.js'

const taskId = 'fixture-report-loader-01'
const validReport = () => ({
  schemaVersion: GITHUB_CORE_ACTIVATION_REPORT_SCHEMA_VERSION,
  taskId,
  jobId: 'job:fixture.01',
  jobStartedAt: '2026-08-05T12:34:56.789Z',
  result: {
    schemaVersion: GITHUB_CORE_ACTIVATION_RESULT_SCHEMA_VERSION,
    capabilityId: 'github.core',
    stability: 'stable',
    coverage: {
      status: 'complete', expectedUnits: 0, observedUnits: 0, omittedUnits: 0,
      completeObservedUnits: 0, saturationReason: null, retryable: false,
      limitationCode: 'COMPLETE',
    },
    requests: {
      maximumRequests: 5, firstProbeMaximumRequests: 2, secondProbeMaximumRequests: 3,
      firstProbeRequests: 2, secondProbeRequests: 2, totalRequests: 4,
    },
  },
})

let roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })))
  roots = []
})

async function fixtureRoot(report: unknown = validReport()): Promise<{
  root: string
  reportPath: string
  expectedSha256: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'developer-lens-github-report-'))
  roots.push(root)
  const directory = join(root, '.developer-lens', 'activation', taskId)
  const reportPath = join(directory, 'last-run-report.json')
  await mkdir(directory, { recursive: true })
  await writeFile(reportPath, JSON.stringify(report), 'utf8')
  const expectedSha256 = createHash('sha256').update(await readFile(reportPath)).digest('hex')
  return { root, reportPath, expectedSha256 }
}

async function expectInvalid(input: unknown): Promise<void> {
  await expect(loadHashBoundGithubCoreActivationReport(input as never)).rejects.toMatchObject({
    code: GITHUB_CORE_ACTIVATION_REPORT_LOAD_ERROR_CODE,
    message: GITHUB_CORE_ACTIVATION_REPORT_LOAD_ERROR_CODE,
  })
}

describe('github.core activation report loader', () => {
  it('loads the fixed stable report, binds its external digest, and returns the frozen parser shape', async () => {
    const fixture = await fixtureRoot()
    const report = await loadHashBoundGithubCoreActivationReport({
      workspaceRoot: fixture.root,
      taskId,
      expectedSha256: fixture.expectedSha256,
    })
    expect(report).toEqual(validReport())
    expect(Object.isFrozen(report)).toBe(true)
    expect(Object.isFrozen(report.result)).toBe(true)

    await expectInvalid({ workspaceRoot: fixture.root, taskId, expectedSha256: '0'.repeat(64) })
    await expectInvalid({
      workspaceRoot: fixture.root,
      taskId,
      expectedSha256: fixture.expectedSha256.toUpperCase(),
    })
  })

  it('rejects changed bytes, a wrong fixed filename, and a report/task path mismatch', async () => {
    const changed = await fixtureRoot()
    await writeFile(changed.reportPath, `${JSON.stringify(validReport())}\n`, 'utf8')
    await expectInvalid({ workspaceRoot: changed.root, taskId, expectedSha256: changed.expectedSha256 })

    const wrongName = await fixtureRoot()
    const bytes = await readFile(wrongName.reportPath)
    await rm(wrongName.reportPath)
    await writeFile(join(wrongName.root, '.developer-lens', 'activation', taskId, 'report.json'), bytes)
    await expectInvalid({ workspaceRoot: wrongName.root, taskId, expectedSha256: wrongName.expectedSha256 })

    const mismatch = await fixtureRoot({ ...validReport(), taskId: 'different-task' })
    await expectInvalid({ workspaceRoot: mismatch.root, taskId, expectedSha256: mismatch.expectedSha256 })
  })

  it('keeps the loader input closed and snapshots it before the first await', async () => {
    const fixture = await fixtureRoot()
    const input = { workspaceRoot: fixture.root, taskId, expectedSha256: fixture.expectedSha256 }
    const pending = loadHashBoundGithubCoreActivationReport(input)
    input.taskId = '../outside'
    await expect(pending).resolves.toMatchObject({ taskId })

    let invoked = false
    const accessor = { taskId, expectedSha256: fixture.expectedSha256 } as Record<string, unknown>
    Object.defineProperty(accessor, 'workspaceRoot', {
      enumerable: true,
      get: () => { invoked = true; return fixture.root },
    })
    await expectInvalid(accessor)
    expect(invoked).toBe(false)
    await expectInvalid({ workspaceRoot: fixture.root, taskId, expectedSha256: fixture.expectedSha256, extra: true })
    await expectInvalid({ workspaceRoot: fixture.root, taskId: '../outside', expectedSha256: fixture.expectedSha256 })
  })

  it('maps invalid UTF-8, duplicate keys, and schema poison to one content-free error', async () => {
    const fixture = await fixtureRoot()
    await writeFile(fixture.reportPath, Buffer.from([0xc3, 0x28]))
    await expectInvalid({ workspaceRoot: fixture.root, taskId, expectedSha256: fixture.expectedSha256 })

    const duplicate = await fixtureRoot()
    const serialized = JSON.stringify(validReport()).replace('{', `{"taskId":"${taskId}",`)
    await writeFile(duplicate.reportPath, serialized, 'utf8')
    const duplicateSha = createHash('sha256').update(await readFile(duplicate.reportPath)).digest('hex')
    await expectInvalid({ workspaceRoot: duplicate.root, taskId, expectedSha256: duplicateSha })

    const poisoned = await fixtureRoot({ ...validReport(), scopeAlias: 'private-fixture-poison' })
    const error = await loadHashBoundGithubCoreActivationReport({
        workspaceRoot: poisoned.root,
        taskId,
        expectedSha256: poisoned.expectedSha256,
      }).then(() => undefined, (caught: unknown) => caught)
    expect(error).toMatchObject({ message: GITHUB_CORE_ACTIVATION_REPORT_LOAD_ERROR_CODE })
    expect(String(error)).not.toContain('private-fixture-poison')
  })
})
