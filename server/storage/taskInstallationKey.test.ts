import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import {
  lstat,
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
import { basename, dirname, join, sep } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GithubCoreActivationGrant } from '../connectors/github/activationGrant.js'

// #151: production ships no grant issuer. Negative paths (forged grant, accessor grant) keep hitting
// the real default-deny validator; the one grant-backed continuity success path opts in by flipping
// `acceptTestGrants` to inject a test-owned validator.
const grantValidation = vi.hoisted(() => ({ acceptTestGrants: false, validatorCalls: 0 }))
vi.mock('../connectors/github/activationGrant.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../connectors/github/activationGrant.js')>()
  return {
    ...actual,
    assertGithubCoreActivationGrant: (input: unknown): GithubCoreActivationGrant => {
      grantValidation.validatorCalls += 1
      return grantValidation.acceptTestGrants
        ? input as GithubCoreActivationGrant
        : actual.assertGithubCoreActivationGrant(input)
    },
  }
})
import {
  bindTaskInstallationKeyBody,
  loadTaskInstallationKey,
  loadTaskInstallationKeyForGithubCoreGrant,
  recoverTaskInstallationKeyPublication,
  setupTaskInstallationKey,
  TASK_INSTALLATION_KEY_ERROR_CODE,
  taskInstallationKeyTestSeams,
  type TaskInstallationKeyLoadInput,
  type TaskInstallationKeySetupCheckpoint,
} from './taskInstallationKey.js'

const TASK_ID = 'fixture-key-01'
const KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1))
const OTHER_KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => 255 - index))
const RAW_REPOSITORY_ID = 'invented-repository-101'
const CARD_SHA256 = 'a'.repeat(64)
const SCOPE_ALIAS = `repo-${'c'.repeat(64)}`

let roots: string[] = []

afterEach(async () => {
  grantValidation.acceptTestGrants = false
  grantValidation.validatorCalls = 0
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

function inventedGrant(fingerprint: string, taskId = TASK_ID): GithubCoreActivationGrant {
  return Object.freeze({
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
    grantValidation.acceptTestGrants = true
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
    expect(() => bindTaskInstallationKeyBody(created, body)).toThrow(TASK_INSTALLATION_KEY_ERROR_CODE)
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

  it('invokes the default-deny validator before inspecting a workspace-root accessor', async () => {
    let workspaceRootReads = 0
    const input = { grant: inventedGrant('b'.repeat(64)) } as Record<string, unknown>
    Object.defineProperty(input, 'workspaceRoot', {
      enumerable: true,
      get: () => {
        workspaceRootReads += 1
        throw new Error('workspace root must stay unread')
      },
    })

    await expectInvalid(loadTaskInstallationKeyForGithubCoreGrant(
      input as unknown as Parameters<typeof loadTaskInstallationKeyForGithubCoreGrant>[0],
    ))
    expect(grantValidation.validatorCalls).toBe(1)
    expect(workspaceRootReads).toBe(0)
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

type SetupCheckpoint = TaskInstallationKeySetupCheckpoint
type CheckpointPaths = Readonly<{ stagingPath: string; keyPath: string }>

const PRE_PUBLICATION_CHECKPOINTS: readonly SetupCheckpoint[] = [
  'after-staging-open',
  'after-partial-write',
  'after-sync',
  'after-verify',
  'after-close',
  'before-publish',
]
const POST_PUBLICATION_CHECKPOINTS: readonly SetupCheckpoint[] = [
  'after-publish',
  'after-staging-unlink',
  'after-directory-sync',
]

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

async function stagingEntries(root: string): Promise<string[]> {
  return (await readdir(keyDirectory(root)))
    .filter((name) => taskInstallationKeyTestSeams.stagingNamePattern.test(name))
}

function failAt(target: SetupCheckpoint, before?: (paths: CheckpointPaths) => Promise<void>) {
  return {
    checkpoint: async (name: SetupCheckpoint, paths: CheckpointPaths) => {
      if (name !== target) return
      if (before) await before(paths)
      throw new Error(`INJECTED_${name}_${KEY.toString('hex')}`)
    },
  }
}

describe('#59 task-owned incomplete-creation recovery', () => {
  it('publishes through a confined, task-owned staging name and leaves exactly one key link', async () => {
    const root = await fixtureRoot()
    const seen: Array<{ name: SetupCheckpoint; stagingPath: string; keyPath: string }> = []
    const created = await taskInstallationKeyTestSeams.setupWithFaults(
      { workspaceRoot: root, taskId: TASK_ID },
      () => Buffer.from(KEY),
      { checkpoint: (name, paths) => { seen.push({ name, ...paths }) } },
    )

    expect(seen.map(({ name }) => name)).toEqual([...PRE_PUBLICATION_CHECKPOINTS, ...POST_PUBLICATION_CHECKPOINTS])
    const stagingPaths = new Set(seen.map(({ stagingPath }) => stagingPath))
    expect(stagingPaths.size).toBe(1)
    const [stagingPath] = [...stagingPaths]
    expect(dirname(stagingPath!)).toBe(keyDirectory(root))
    expect(basename(stagingPath!)).toMatch(taskInstallationKeyTestSeams.stagingNamePattern)
    expect(seen.every(({ keyPath: path }) => path === keyPath(root))).toBe(true)

    expect(await readdir(keyDirectory(root))).toEqual(['installation-key.bin'])
    expect((await lstat(keyPath(root), { bigint: true })).nlink).toBe(1n)
    expect(await readFile(keyPath(root))).toEqual(KEY)
    expect(created.fingerprint).toBe(sha256(KEY))
  })

  it('fails closed before publication at every checkpoint, zeroes owned bytes, and a retry starts clean', async () => {
    const cases: Array<Readonly<{ label: string; faults: Parameters<typeof taskInstallationKeyTestSeams.setupWithFaults>[2] }>> = [
      ...PRE_PUBLICATION_CHECKPOINTS.map((name) => ({ label: name, faults: failAt(name) })),
      { label: 'close reports failure', faults: { closeFails: true } },
    ]
    for (const { label, faults } of cases) {
      const root = await fixtureRoot()
      const generated = Buffer.from(KEY)
      await expectInvalid(
        taskInstallationKeyTestSeams.setupWithFaults({ workspaceRoot: root, taskId: TASK_ID }, () => generated, faults),
        [KEY.toString('hex'), sha256(KEY), root, label],
      )
      expect(generated, label).toEqual(Buffer.alloc(32))
      expect(existsSync(keyPath(root)), label).toBe(false)
      expect(await stagingEntries(root), label).toEqual([])

      const retried = await setupWithKey(root, OTHER_KEY)
      expect(retried.fingerprint, label).toBe(sha256(OTHER_KEY))
      expect(await readFile(keyPath(root))).toEqual(OTHER_KEY)
      expect(await readdir(keyDirectory(root))).toEqual(['installation-key.bin'])
    }
  }, 60_000)

  it('refuses a staging file whose bytes change before read-back verification', async () => {
    const root = await fixtureRoot()
    await expectInvalid(taskInstallationKeyTestSeams.setupWithFaults(
      { workspaceRoot: root, taskId: TASK_ID },
      () => Buffer.from(KEY),
      {
        checkpoint: async (name, paths) => {
          if (name === 'after-sync') await writeFile(paths.stagingPath, OTHER_KEY)
        },
      },
    ), [KEY.toString('hex'), OTHER_KEY.toString('hex')])
    expect(existsSync(keyPath(root))).toBe(false)
    expect(await stagingEntries(root)).toEqual([])
  })

  it('never publishes or deletes a replacement found at the staging name before the identity check', async () => {
    const root = await fixtureRoot()
    let foreignPath = ''
    await expectInvalid(taskInstallationKeyTestSeams.setupWithFaults(
      { workspaceRoot: root, taskId: TASK_ID },
      () => Buffer.from(KEY),
      {
        checkpoint: async (name, paths) => {
          if (name !== 'after-close') return
          foreignPath = paths.stagingPath
          await rename(paths.stagingPath, join(keyDirectory(root), 'moved-own-staging.bin'))
          await writeFile(paths.stagingPath, OTHER_KEY, { mode: 0o600 })
        },
      },
    ))
    expect(existsSync(keyPath(root))).toBe(false)
    // The replacement is not this invocation's file, so it is left exactly as found.
    expect(await readFile(foreignPath)).toEqual(OTHER_KEY)
  })

  it('fails closed without unlinking the key path when the staging name is swapped inside the link window', async () => {
    const root = await fixtureRoot()
    await expectInvalid(taskInstallationKeyTestSeams.setupWithFaults(
      { workspaceRoot: root, taskId: TASK_ID },
      () => Buffer.from(KEY),
      {
        checkpoint: async (name, paths) => {
          if (name !== 'before-publish') return
          await rename(paths.stagingPath, join(keyDirectory(root), 'moved-own-staging.bin'))
          await writeFile(paths.stagingPath, OTHER_KEY, { mode: 0o600 })
        },
      },
    ))
    // Check-then-link is not atomic in Node, so the swapped file may gain the key name; it is never
    // accepted (post-link identity check) and never unlinked, and every reader refuses it.
    expect(await readFile(keyPath(root))).toEqual(OTHER_KEY)
    await expectInvalid(loadTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID }))
  })

  it('never overwrites a key raced into place before publication and removes only its own staging file', async () => {
    const root = await fixtureRoot()
    await expectInvalid(taskInstallationKeyTestSeams.setupWithFaults(
      { workspaceRoot: root, taskId: TASK_ID },
      () => Buffer.from(KEY),
      {
        checkpoint: async (name) => {
          if (name === 'before-publish') await writeFile(keyPath(root), OTHER_KEY, { mode: 0o600, flag: 'wx' })
        },
      },
    ))
    expect(await readFile(keyPath(root))).toEqual(OTHER_KEY)
    expect(await stagingEntries(root)).toEqual([])
    const raced = await loadTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID })
    expect(raced.fingerprint).toBe(sha256(OTHER_KEY))
  })

  it('leaves one complete verified key after a post-publication failure and never re-creates it', async () => {
    for (const name of POST_PUBLICATION_CHECKPOINTS) {
      const root = await fixtureRoot()
      const generated = Buffer.from(KEY)
      await expectInvalid(
        taskInstallationKeyTestSeams.setupWithFaults({ workspaceRoot: root, taskId: TASK_ID }, () => generated, failAt(name)),
        [KEY.toString('hex'), sha256(KEY)],
      )
      expect(generated, name).toEqual(Buffer.alloc(32))
      expect(await readdir(keyDirectory(root)), name).toEqual(['installation-key.bin'])
      expect(await readFile(keyPath(root)), name).toEqual(KEY)

      // Retry never overwrites; the caller recovers the fingerprint through an ordinary load.
      await expectInvalid(setupWithKey(root, OTHER_KEY))
      await expect(recoverTaskInstallationKeyPublication({ workspaceRoot: root, taskId: TASK_ID })).resolves.toBeUndefined()
      const loaded = await loadTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID })
      expect(loaded.fingerprint, name).toBe(sha256(KEY))
    }
  }, 60_000)

  it('recovers a publication interrupted between the link and the staging unlink, touching nothing else', async () => {
    const root = await fixtureRoot()
    await setupWithKey(root)
    // A crash after the no-clobber link leaves the staging name as a second link of the key.
    const interrupted = join(keyDirectory(root), `.installation-key.bin.${'ab'.repeat(16)}.staging`)
    await link(keyPath(root), interrupted)
    // Unpublished debris from an older crashed invocation is not provably ours.
    const debris = join(keyDirectory(root), `.installation-key.bin.${'cd'.repeat(16)}.staging`)
    await writeFile(debris, OTHER_KEY.subarray(0, 16), { mode: 0o600 })
    await expectInvalid(loadTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID }))

    await recoverTaskInstallationKeyPublication({ workspaceRoot: root, taskId: TASK_ID })
    expect(existsSync(interrupted)).toBe(false)
    expect(await readFile(debris)).toEqual(OTHER_KEY.subarray(0, 16))
    expect((await lstat(keyPath(root), { bigint: true })).nlink).toBe(1n)
    const loaded = await loadTaskInstallationKey({ workspaceRoot: root, taskId: TASK_ID, expectedFingerprint: sha256(KEY) })
    expect(loaded.fingerprint).toBe(sha256(KEY))
    // Recovery never creates a key and is a no-op once exactly one link remains.
    await recoverTaskInstallationKeyPublication({ workspaceRoot: root, taskId: TASK_ID })
    expect(await readFile(keyPath(root))).toEqual(KEY)
  })

  it('refuses to recover a key with a foreign alternate link and never creates a missing key', async () => {
    const root = await fixtureRoot()
    await expect(recoverTaskInstallationKeyPublication({ workspaceRoot: root, taskId: TASK_ID })).resolves.toBeUndefined()
    expect(existsSync(keyPath(root))).toBe(false)

    await setupWithKey(root)
    const foreignLink = join(keyDirectory(root), 'not-a-staging-name.bin')
    await link(keyPath(root), foreignLink)
    await expectInvalid(recoverTaskInstallationKeyPublication({ workspaceRoot: root, taskId: TASK_ID }), [root])
    expect(await readFile(keyPath(root))).toEqual(KEY)
    expect(await readFile(foreignLink)).toEqual(KEY)
  })
})
