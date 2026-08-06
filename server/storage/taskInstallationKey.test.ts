import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import {
  mkdir,
  link,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { githubCoreActivationGrantTestSeam } from '../connectors/github/activationGrant.js'
import {
  bindTaskInstallationKeyBody,
  loadTaskInstallationKey,
  loadTaskInstallationKeyForGithubCoreGrant,
  setupTaskInstallationKey,
  TASK_INSTALLATION_KEY_ERROR_CODE,
  taskInstallationKeyTestSeams,
  type TaskInstallationKeyLoadInput,
} from './taskInstallationKey.js'

const TASK_ID = 'fixture-key-01'
const KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1))
const OTHER_KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => 255 - index))
const RAW_REPOSITORY_ID = 'invented-repository-101'
const CARD_SHA256 = 'a'.repeat(64)
const SCOPE_ALIAS = `repo-${'c'.repeat(64)}`

let roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })))
  roots = []
})

function keyDirectory(root: string, taskId = TASK_ID): string {
  return join(root, '.developer-lens', 'activation', taskId)
}

function keyPath(root: string, taskId = TASK_ID): string {
  return join(keyDirectory(root, taskId), 'installation-key.bin')
}

async function fixtureRoot(taskId = TASK_ID): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'developer-lens-task-key-'))
  roots.push(root)
  await mkdir(keyDirectory(root, taskId), { recursive: true })
  return root
}

async function setupWithKey(root: string, bytes = KEY): ReturnType<
  typeof taskInstallationKeyTestSeams.setupWithRandomBytes
> {
  return taskInstallationKeyTestSeams.setupWithRandomBytes(
    { workspaceRoot: root, taskId: TASK_ID },
    () => Buffer.from(bytes),
  )
}

function inventedGrant(fingerprint: string, taskId = TASK_ID) {
  return githubCoreActivationGrantTestSeam.issueInventedGrant({
    fixture: 'invented',
    capabilityId: 'github.core',
    taskId,
    taskCardSha256: CARD_SHA256,
    installationKeyFingerprint: fingerprint,
    scopeAlias: SCOPE_ALIAS,
  })
}

async function expectInvalid(
  operation: Promise<unknown>,
  forbidden: readonly string[] = [],
): Promise<void> {
  const error = await operation.catch((caught: unknown) => caught)
  expect(error).toMatchObject({
    code: TASK_INSTALLATION_KEY_ERROR_CODE,
    message: TASK_INSTALLATION_KEY_ERROR_CODE,
  })
  const visible = JSON.stringify(error)
  expect(String(error)).toBe(`TaskInstallationKeyError: ${TASK_INSTALLATION_KEY_ERROR_CODE}`)
  for (const value of forbidden) expect(visible).not.toContain(value)
}

describe('task-owned installation-key continuity', () => {
  it('creates exactly once and reopens stable aliases with a lowercase fingerprint', async () => {
    const root = await fixtureRoot()
    let generated = Buffer.from(KEY)
    let randomCalls = 0
    const created = await taskInstallationKeyTestSeams.setupWithRandomBytes(
      { workspaceRoot: root, taskId: TASK_ID },
      (size) => {
        randomCalls += 1
        expect(size).toBe(32)
        return generated
      },
    )
    const fingerprint = createHash('sha256').update(KEY).digest('hex')

    expect(randomCalls).toBe(1)
    expect(generated).toEqual(Buffer.alloc(32))
    generated = Buffer.alloc(0)
    expect(created.taskId).toBe(TASK_ID)
    expect(created.fingerprint).toBe(fingerprint)
    expect(created.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(Reflect.ownKeys(created)).toEqual(['taskId', 'fingerprint', 'aliases'])
    expect(Object.values(Object.getOwnPropertyDescriptors(created)).every((descriptor) => 'value' in descriptor)).toBe(true)
    expect(Object.isFrozen(created)).toBe(true)
    expect(Object.isFrozen(created.aliases)).toBe(true)
    expect(Object.values(created.aliases).every(Object.isFrozen)).toBe(true)
    expect(await readFile(keyPath(root))).toEqual(KEY)
    expect(await readdir(keyDirectory(root))).toEqual(['installation-key.bin'])

    const reopened = await loadTaskInstallationKey({
      workspaceRoot: root,
      taskId: TASK_ID,
      expectedFingerprint: fingerprint,
    })
    expect(reopened.fingerprint).toBe(created.fingerprint)
    expect(reopened.aliases.repositoryProviderId(RAW_REPOSITORY_ID)).toBe(
      created.aliases.repositoryProviderId(RAW_REPOSITORY_ID),
    )
    expect(reopened.aliases.repositoryAnalyticalKey(RAW_REPOSITORY_ID)).toBe(
      created.aliases.repositoryAnalyticalKey(RAW_REPOSITORY_ID),
    )
    expect(reopened.aliases.githubCoreAlias('issue', 'invented-unit-1')).toBe(
      created.aliases.githubCoreAlias('issue', 'invented-unit-1'),
    )

    if (process.platform !== 'win32') {
      expect((await stat(keyPath(root))).mode & 0o077).toBe(0)
    }
  })

  it('fails closed for missing, short, oversized, changed, or mismatched keys', async () => {
    const root = await fixtureRoot()
    await expectInvalid(loadTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID }), [root])
    expect(await readdir(keyDirectory(root))).toEqual([])

    await writeFile(keyPath(root), Buffer.alloc(31, 0x31), { mode: 0o600 })
    await expectInvalid(loadTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID }))

    await writeFile(keyPath(root), Buffer.alloc(33, 0x32), { mode: 0o600 })
    await expectInvalid(loadTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID }))

    await writeFile(keyPath(root), KEY, { mode: 0o600 })
    const expectedFingerprint = createHash('sha256').update(KEY).digest('hex')
    await writeFile(keyPath(root), OTHER_KEY, { mode: 0o600 })
    await expectInvalid(loadTaskInstallationKey({
      workspaceRoot: root,
      taskId: TASK_ID,
      expectedFingerprint,
    }), [OTHER_KEY.toString('hex'), root])

    await expectInvalid(loadTaskInstallationKey({
      workspaceRoot: root,
      taskId: TASK_ID,
      expectedFingerprint: 'A'.repeat(64),
    }))
  })

  it('uses the public cryptographic setup wrapper without exposing its generated bytes', async () => {
    const root = await fixtureRoot()
    const created = await setupTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID })
    expect((await stat(keyPath(root))).size).toBe(32)
    expect(created.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(Reflect.ownKeys(created)).toEqual(['taskId', 'fingerprint', 'aliases'])
    expect(JSON.stringify(created)).not.toContain((await readFile(keyPath(root))).toString('hex'))
  })

  it('rejects invalid random-source sizes and zeroes owned candidate buffers on failure', async () => {
    const root = await fixtureRoot()
    for (const size of [31, 33]) {
      const candidate = Buffer.alloc(size, 0x5a)
      await expectInvalid(taskInstallationKeyTestSeams.setupWithRandomBytes(
        { workspaceRoot: root, taskId: TASK_ID },
        () => candidate,
      ))
      expect(candidate).toEqual(Buffer.alloc(size))
      expect(await readdir(keyDirectory(root))).toEqual([])
    }
  })

  it('uses exclusive creation and never overwrites or silently rotates an existing key', async () => {
    const root = await fixtureRoot()
    const created = await setupWithKey(root)
    let replacement = Buffer.from(OTHER_KEY)
    await expectInvalid(taskInstallationKeyTestSeams.setupWithRandomBytes(
      { workspaceRoot: root, taskId: TASK_ID },
      () => replacement,
    ))
    expect(replacement).toEqual(OTHER_KEY)
    replacement.fill(0)

    const reopened = await loadTaskInstallationKey({
      workspaceRoot: root,
      taskId: TASK_ID,
      expectedFingerprint: created.fingerprint,
    })
    expect(await readFile(keyPath(root))).toEqual(KEY)
    expect(reopened.aliases.githubCoreAlias('page', 'invented-page-1')).toBe(
      created.aliases.githubCoreAlias('page', 'invented-page-1'),
    )
  })

  it('authorizes backup signing only for setup or an opaque grant-backed fingerprint', async () => {
    const root = await fixtureRoot()
    const created = await setupWithKey(root)
    const body = 'a'.repeat(64)
    const setupBinding = bindTaskInstallationKeyBody(created, body)

    const ordinary = await loadTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID })
    expect(() => bindTaskInstallationKeyBody(ordinary, body)).toThrow(TASK_INSTALLATION_KEY_ERROR_CODE)
    const matchingInspection = await loadTaskInstallationKey({
      workspaceRoot: root,
      taskId: TASK_ID,
      expectedFingerprint: created.fingerprint,
    })
    expect(() => bindTaskInstallationKeyBody(matchingInspection, body))
      .toThrow(TASK_INSTALLATION_KEY_ERROR_CODE)
    const anchored = await loadTaskInstallationKeyForGithubCoreGrant({
      workspaceRoot: root,
      grant: inventedGrant(created.fingerprint),
    })
    expect(bindTaskInstallationKeyBody(anchored, body)).toBe(setupBinding)

    const forged = Object.freeze({ ...anchored })
    expect(() => bindTaskInstallationKeyBody(forged, body)).toThrow(TASK_INSTALLATION_KEY_ERROR_CODE)

    await writeFile(keyPath(root), OTHER_KEY, { mode: 0o600 })
    const replacement = await loadTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID })
    expect(() => bindTaskInstallationKeyBody(replacement, body)).toThrow(TASK_INSTALLATION_KEY_ERROR_CODE)
    const copiedFingerprint = await loadTaskInstallationKey({
      workspaceRoot: root,
      taskId: TASK_ID,
      expectedFingerprint: replacement.fingerprint,
    })
    expect(() => bindTaskInstallationKeyBody(copiedFingerprint, body))
      .toThrow(TASK_INSTALLATION_KEY_ERROR_CODE)
    await expectInvalid(loadTaskInstallationKeyForGithubCoreGrant({
      workspaceRoot: root,
      grant: inventedGrant(created.fingerprint),
    }), [root, OTHER_KEY.toString('hex')])
    await expectInvalid(loadTaskInstallationKey({
      workspaceRoot: root,
      taskId: TASK_ID,
      expectedFingerprint: created.fingerprint,
    }), [root, OTHER_KEY.toString('hex')])
  })

  it('closes the source-grant adapter before awaiting and rejects forged or accessor grants', async () => {
    const root = await fixtureRoot()
    const created = await setupWithKey(root)
    const forged = Object.freeze({ ...inventedGrant(created.fingerprint) })
    await expectInvalid(loadTaskInstallationKeyForGithubCoreGrant({ workspaceRoot: root, grant: forged }))

    let getterCalled = false
    const accessor = { workspaceRoot: root } as Record<string, unknown>
    Object.defineProperty(accessor, 'grant', {
      enumerable: true,
      get: () => { getterCalled = true; return inventedGrant(created.fingerprint) },
    })
    await expectInvalid(loadTaskInstallationKeyForGithubCoreGrant(
      accessor as unknown as Parameters<typeof loadTaskInstallationKeyForGithubCoreGrant>[0],
    ))
    expect(getterCalled).toBe(false)
  })

  it('snapshots closed data properties before awaiting and rejects accessors or mutations', async () => {
    const root = await fixtureRoot()
    await setupWithKey(root)
    const input: TaskInstallationKeyLoadInput & { taskId: string } = {
      workspaceRoot: root,
      taskId: TASK_ID,
    }
    const pending = loadTaskInstallationKey(input)
    input.taskId = '../outside'
    await expect(pending).resolves.toMatchObject({ taskId: TASK_ID })

    let getterCalled = false
    const accessorInput = {} as Record<string, unknown>
    Object.defineProperty(accessorInput, 'workspaceRoot', {
      get: () => {
        getterCalled = true
        throw new Error('getter must not run')
      },
      enumerable: true,
    })
    Object.defineProperty(accessorInput, 'taskId', { value: TASK_ID, enumerable: true })
    await expectInvalid(loadTaskInstallationKey(accessorInput as never), [root])
    expect(getterCalled).toBe(false)
  })

  it('rejects traversal, noncanonical roots, alternate-root fields, and absent task directories', async () => {
    const root = await fixtureRoot()
    const inputs: unknown[] = [
      { workspaceRoot: root, taskId: '../outside' },
      { workspaceRoot: root, taskId: 'C:\\outside' },
      { workspaceRoot: root, taskId: '/outside' },
      { workspaceRoot: root, taskId: `${TASK_ID}/alternate` },
      { workspaceRoot: '.', taskId: TASK_ID },
      { workspaceRoot: `${root}${sep}missing${sep}..`, taskId: TASK_ID },
      { workspaceRoot: root, taskId: TASK_ID, extra: 'closed' },
      { workspaceRoot: root, taskId: TASK_ID, workspace: 'alternate-root' },
    ]
    for (const input of inputs) await expectInvalid(loadTaskInstallationKey(input as never), [root])

    const absentTaskRoot = await mkdtemp(join(tmpdir(), 'developer-lens-task-key-'))
    roots.push(absentTaskRoot)
    await mkdir(join(absentTaskRoot, '.developer-lens', 'activation'), { recursive: true })
    let randomCalled = false
    await expectInvalid(taskInstallationKeyTestSeams.setupWithRandomBytes(
      { workspaceRoot: absentTaskRoot, taskId: TASK_ID },
      () => {
        randomCalled = true
        return Buffer.from(KEY)
      },
    ))
    expect(randomCalled).toBe(false)
  })

  it('rejects task-directory symlink or junction escapes without reading the outside key', async () => {
    const root = await mkdtemp(join(tmpdir(), 'developer-lens-task-key-'))
    roots.push(root)
    const outside = await mkdtemp(join(tmpdir(), 'developer-lens-task-key-outside-'))
    roots.push(outside)
    await mkdir(join(root, '.developer-lens', 'activation'), { recursive: true })
    await mkdir(join(outside, TASK_ID), { recursive: true })
    await writeFile(join(outside, TASK_ID, 'installation-key.bin'), KEY, { mode: 0o600 })
    try {
      await symlink(join(outside, TASK_ID), keyDirectory(root), 'junction')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'EACCES') return
      throw error
    }

    await expectInvalid(loadTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID }), [outside, root])
    expect(await readFile(join(outside, TASK_ID, 'installation-key.bin'))).toEqual(KEY)
  })

  it('rejects alternate hard links to the key where link identity is portable', async () => {
    const root = await fixtureRoot()
    const created = await setupWithKey(root)
    const outside = await mkdtemp(join(tmpdir(), 'developer-lens-task-key-link-'))
    roots.push(outside)
    try {
      await link(keyPath(root), join(outside, 'alternate-installation-key.bin'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'EACCES') return
      throw error
    }
    await expectInvalid(loadTaskInstallationKey({
      workspaceRoot: root,
      taskId: TASK_ID,
      expectedFingerprint: created.fingerprint,
    }), [outside, root])
  })

  it('fails closed when a canonical directory is replaced between validation and open', async () => {
    const root = await fixtureRoot()
    await setupWithKey(root)
    const originalDirectory = keyDirectory(root)
    const displacedDirectory = `${originalDirectory}-displaced`

    await expectInvalid(taskInstallationKeyTestSeams.loadWithHooks(
      { workspaceRoot: root, taskId: TASK_ID },
      {
        beforeOpen: async () => {
          await rename(originalDirectory, displacedDirectory)
          await mkdir(originalDirectory)
          await writeFile(keyPath(root), OTHER_KEY, { mode: 0o600 })
        },
      },
    ), [root, OTHER_KEY.toString('hex')])
    expect(await readFile(join(displacedDirectory, 'installation-key.bin'))).toEqual(KEY)
  })

  it('fails closed when key bytes mutate between stable opened-handle reads', async () => {
    const root = await fixtureRoot()
    await setupWithKey(root)
    await expectInvalid(taskInstallationKeyTestSeams.loadWithHooks(
      { workspaceRoot: root, taskId: TASK_ID },
      {
        afterFirstRead: async () => {
          await writeFile(keyPath(root), OTHER_KEY, { mode: 0o600 })
        },
      },
    ), [root, OTHER_KEY.toString('hex')])
  })

  it('fails closed when portable file identity is absent or changes', () => {
    expect(taskInstallationKeyTestSeams.portableIdentityMatches(
      { dev: 0n, ino: 0n },
      { dev: 0n, ino: 0n },
    )).toBe(false)
    expect(taskInstallationKeyTestSeams.portableIdentityMatches(
      { dev: 7n, ino: 11n },
      { dev: 7n, ino: 12n },
    )).toBe(false)
    expect(taskInstallationKeyTestSeams.portableIdentityMatches(
      { dev: 7n, ino: 11n },
      { dev: 7n, ino: 11n },
    )).toBe(true)
    const unsafeNumericIdentity = 2n ** 60n
    expect(Number(unsafeNumericIdentity)).toBe(Number(unsafeNumericIdentity + 1n))
    expect(taskInstallationKeyTestSeams.portableIdentityMatches(
      { dev: 7n, ino: unsafeNumericIdentity },
      { dev: 7n, ino: unsafeNumericIdentity + 1n },
    )).toBe(false)
  })
})
