import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  activationArtifactLoaderTestSeams,
} from '../activationArtifactLoader.js'
import {
  GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_LOAD_ERROR_CODE,
  loadHashBoundGithubCoreContinuityReviewAnchor,
} from './v3ContinuityReviewAnchorLoader.js'
import { GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_SCHEMA_VERSION } from './v3ContinuityReviewAnchor.js'

const taskId = 'fixture-anchor-01'
const digest = '0123456789abcdef'.repeat(4)
const anchor = {
  schemaVersion: GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_SCHEMA_VERSION,
  capabilityId: 'github.core',
  taskId,
  reviewDecision: 'approve_continuity_renewal',
  reviewedReportSha256: digest,
  reviewedTaskCardSha256: 'a'.repeat(64),
  reviewedInstallationKeyFingerprint: 'b'.repeat(64),
  reviewedLifecycleState: 'active',
  reviewedLifecycleEpoch: 7,
  reviewedPreviewSha256: 'c'.repeat(64),
  reviewedExactHeadProofSha256: 'd'.repeat(64),
  reviewedDeletionIntentId: null,
  reviewedDeletionIntentSha256: null,
  reviewedDeletionReceiptSha256: null,
  reviewedContinuityEpoch: 11,
  reviewedAt: '2026-08-05T12:34:56.789Z',
} as const

let roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })))
  roots = []
})

async function fixtureRoot(content = JSON.stringify(anchor)): Promise<{ root: string; anchorPath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'developer-lens-anchor-loader-'))
  roots.push(root)
  const directory = join(root, '.developer-lens', 'activation', taskId)
  const anchorPath = join(directory, 'continuity-review-anchor.json')
  await mkdir(directory, { recursive: true })
  await writeFile(anchorPath, content)
  return { root, anchorPath }
}

async function expectedSha(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function expectInvalid(input: unknown): Promise<void> {
  await expect(loadHashBoundGithubCoreContinuityReviewAnchor(input)).rejects.toMatchObject({
    code: GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_LOAD_ERROR_CODE,
    message: GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_LOAD_ERROR_CODE,
    name: 'GithubCoreContinuityReviewAnchorLoadError',
  })
}

describe('fixed hash-bound continuity review-anchor loader', () => {
  it('loads a valid frozen sixteen-field anchor and returns its observed SHA', async () => {
    const fixture = await fixtureRoot()
    const sha256 = await expectedSha(fixture.anchorPath)
    const loaded = await loadHashBoundGithubCoreContinuityReviewAnchor({
      workspaceRoot: fixture.root,
      taskId,
      expectedSha256: sha256,
    })
    expect(loaded).toEqual({ taskId, sha256, anchor })
    expect(Object.isFrozen(loaded)).toBe(true)
    expect(Object.isFrozen(loaded.anchor)).toBe(true)
    expect(Object.keys(loaded.anchor)).toHaveLength(16)
  })

  it('requires the code-fixed filename and exact lowercase external SHA', async () => {
    const fixture = await fixtureRoot()
    const bytes = await readFile(fixture.anchorPath)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    await writeFile(join(fixture.root, '.developer-lens', 'activation', taskId, 'anchor.json'), bytes)
    await rm(fixture.anchorPath)
    await expectInvalid({ workspaceRoot: fixture.root, taskId, expectedSha256: sha256 })

    const restored = await fixtureRoot()
    const restoredSha = await expectedSha(restored.anchorPath)
    await expectInvalid({ workspaceRoot: restored.root, taskId, expectedSha256: restoredSha.toUpperCase() })
    await expectInvalid({ workspaceRoot: restored.root, taskId, expectedSha256: '0'.repeat(64) })
  })

  it('enforces the closed 64 KiB artifact and input boundaries', async () => {
    const fixture = await fixtureRoot(' '.repeat(64 * 1024 + 1))
    await expectInvalid({ workspaceRoot: fixture.root, taskId, expectedSha256: '0'.repeat(64) })
    await expectInvalid({ workspaceRoot: fixture.root, taskId, expectedSha256: '0'.repeat(64), maxBytes: 1 })

    const valid = await fixtureRoot()
    const sha256 = await expectedSha(valid.anchorPath)
    const snapshotInput = { workspaceRoot: valid.root, taskId, expectedSha256: sha256 }
    const pending = loadHashBoundGithubCoreContinuityReviewAnchor(snapshotInput)
    snapshotInput.taskId = '../escape'
    await expect(pending).resolves.toMatchObject({ taskId })
    await expectInvalid({ workspaceRoot: valid.root, taskId, expectedSha256: sha256, extra: true })
    let accessorCalled = false
    const accessor = Object.create(null) as Record<string, unknown>
    Object.defineProperty(accessor, 'workspaceRoot', { enumerable: true, get: () => { accessorCalled = true; return valid.root } })
    Object.defineProperty(accessor, 'taskId', { enumerable: true, value: taskId })
    Object.defineProperty(accessor, 'expectedSha256', { enumerable: true, value: sha256 })
    await expectInvalid(accessor)
    expect(accessorCalled).toBe(false)
    await expectInvalid({ workspaceRoot: valid.root, taskId: '../escape', expectedSha256: sha256 })
    await expectInvalid({ workspaceRoot: valid.root, taskId: 'x'.repeat(129), expectedSha256: sha256 })
  })

  it('rejects byte/hash changes, task mismatch, invalid UTF-8, duplicate keys, and parser poison', async () => {
    const fixture = await fixtureRoot()
    const sha256 = await expectedSha(fixture.anchorPath)
    await writeFile(fixture.anchorPath, JSON.stringify({ ...anchor, reviewedAt: '2026-08-05T12:34:56.790Z' }))
    await expectInvalid({ workspaceRoot: fixture.root, taskId, expectedSha256: sha256 })

    const mismatch = await fixtureRoot(JSON.stringify({ ...anchor, taskId: 'other-task' }))
    await expectInvalid({ workspaceRoot: mismatch.root, taskId, expectedSha256: await expectedSha(mismatch.anchorPath) })

    const invalidUtf8 = await fixtureRoot()
    await writeFile(invalidUtf8.anchorPath, Buffer.from([0xc3, 0x28]))
    await expectInvalid({ workspaceRoot: invalidUtf8.root, taskId, expectedSha256: await expectedSha(invalidUtf8.anchorPath) })

    const duplicate = await fixtureRoot('{"schemaVersion":"github-core-continuity-review-anchor.v1","schemaVersion":"poison"}')
    await expectInvalid({ workspaceRoot: duplicate.root, taskId, expectedSha256: await expectedSha(duplicate.anchorPath) })

    const poison = await fixtureRoot('{"taskId":"poison"}')
    await expectInvalid({ workspaceRoot: poison.root, taskId, expectedSha256: await expectedSha(poison.anchorPath) })
    try {
      await loadHashBoundGithubCoreContinuityReviewAnchor({ workspaceRoot: poison.root, taskId, expectedSha256: await expectedSha(poison.anchorPath) })
    } catch (error) {
      expect(String(error)).not.toContain('poison')
    }
  })

  it('rejects replacement of the task directory between stable reads', async () => {
    const fixture = await fixtureRoot()
    const bytes = await readFile(fixture.anchorPath)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const taskDirectory = join(fixture.root, '.developer-lens', 'activation', taskId)
    await expect(activationArtifactLoaderTestSeams.loadAnchorWithHooks(
      { workspaceRoot: fixture.root, taskId, expectedSha256: sha256 },
      {
        afterFirstRead: async () => {
          const replacement = `${taskDirectory}-replacement`
          await rename(taskDirectory, replacement)
          await mkdir(taskDirectory, { recursive: true })
          await writeFile(join(taskDirectory, 'continuity-review-anchor.json'), bytes)
        },
      },
    )).rejects.toMatchObject({ code: 'INVALID_ACTIVATION_ARTIFACT_LOAD' })
  })
})
