import { link, mkdir, mkdtemp, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ACTIVATION_TASK_CARD_LOAD_ERROR_CODE,
  activationTaskCardLoaderTestSeams,
  loadActivationTaskCard,
} from './activationTaskCardLoader.js'

const taskId = 'fixture-card-stability'
let roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })))
  roots = []
})

async function fixtureRoot(content = '{"stable":"alpha"}'): Promise<{
  root: string
  cardPath: string
  taskDirectory: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'developer-lens-card-stability-'))
  roots.push(root)
  const taskDirectory = join(root, '.developer-lens', 'activation', taskId)
  const cardPath = join(taskDirectory, 'task-card.json')
  await mkdir(taskDirectory, { recursive: true })
  await writeFile(cardPath, content, 'utf8')
  return { root, cardPath, taskDirectory }
}

async function expectInvalid(operation: Promise<unknown>): Promise<void> {
  await expect(operation).rejects.toMatchObject({
    code: ACTIVATION_TASK_CARD_LOAD_ERROR_CODE,
    message: ACTIVATION_TASK_CARD_LOAD_ERROR_CODE,
  })
}

describe('activation task-card stable bounded reads', () => {
  it('rejects a same-size in-place mutation between the two descriptor reads', async () => {
    const fixture = await fixtureRoot()
    await expectInvalid(activationTaskCardLoaderTestSeams.loadWithHooks(
      { workspaceRoot: fixture.root, taskId },
      {
        afterFirstRead: () => writeFile(fixture.cardPath, '{"stable":"omega"}', 'utf8'),
      },
    ))
  })

  it('rejects a parent-directory replacement between the two descriptor reads', async () => {
    const fixture = await fixtureRoot()
    const replacementDirectory = `${fixture.taskDirectory}-replacement`
    await expectInvalid(activationTaskCardLoaderTestSeams.loadWithHooks(
      { workspaceRoot: fixture.root, taskId },
      {
        afterFirstRead: async () => {
          await rename(fixture.taskDirectory, replacementDirectory)
          await mkdir(fixture.taskDirectory, { recursive: true })
          await writeFile(join(fixture.taskDirectory, 'task-card.json'), '{"stable":"alpha"}', 'utf8')
        },
      },
    ))
  })

  it('rejects a hard-linked card that escapes the task-owned file boundary', async () => {
    const fixture = await fixtureRoot()
    const linkedSource = join(fixture.root, 'outside-card.json')
    await writeFile(linkedSource, '{"stable":"alpha"}', 'utf8')
    await unlink(fixture.cardPath)
    try {
      await link(linkedSource, fixture.cardPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'EACCES') return
      throw error
    }
    await expectInvalid(loadActivationTaskCard({ workspaceRoot: fixture.root, taskId }))
  })

  it('still loads an unchanged card through the public closed-input boundary', async () => {
    const fixture = await fixtureRoot()
    await expect(loadActivationTaskCard({ workspaceRoot: fixture.root, taskId }))
      .resolves.toEqual({ taskId, parsed: { stable: 'alpha' } })
  })
})
