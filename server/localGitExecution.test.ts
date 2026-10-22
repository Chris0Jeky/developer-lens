import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it, vi } from 'vitest'
import { collectLocalGit } from './localGit.js'

interface GitOptions {
  encoding: string
  windowsHide: boolean
  maxBuffer: number
  timeout?: number
  killSignal?: string
}

const { execute, discover } = vi.hoisted(() => ({
  execute: vi.fn<(file: string, args: string[], options: GitOptions) => Promise<{ stdout: string; stderr: string }>>(),
  discover: vi.fn(),
}))

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  const { promisify } = await import('node:util')
  // Match execFile's custom promisified { stdout, stderr } result without spawning Git.
  const execFile = Object.assign(vi.fn(), { [promisify.custom]: execute })
  return { ...actual, default: { ...actual, execFile }, execFile }
})
vi.mock('./localGitDiscovery.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./localGitDiscovery.js')>()),
  discoverLocalGitCandidates: discover,
}))

const identity = { emails: ['invented@example.invalid'] }
const window = ['2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'] as const
const log = `@@DL@@${'a'.repeat(40)}\u001f2026-01-10T12:00:00Z\u001fInvented\u001f${identity.emails[0]}\u001ffeat: invented fixture\u001f\n1\t0\tinvented-source-canary.txt`
const phases = ['top-level', 'git-dir', 'common-dir', 'top-level recheck', 'remote', 'log'] as const
type Phase = typeof phases[number]
type Failure = 'timeout' | 'output limit'

afterEach(() => { vi.resetAllMocks() })

async function fixture(run: (root: string, first: string, later: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'lens-git-execution-'))
  try {
    const first = join(root, 'a-repository-path-canary')
    const later = join(root, 'z-healthy')
    await mkdir(join(first, '.git'), { recursive: true })
    await mkdir(join(later, '.git'), { recursive: true })
    discover.mockResolvedValue({ candidates: [first, later], failedLocations: 0, cappedDirectories: 0 })
    await run(root, first, later)
  } finally { await rm(root, { recursive: true, force: true }) }
}

function runner(first: string, failedPhase?: Phase, failure?: Failure, missingRemote = false) {
  const revParses = new Map<string, number>()
  execute.mockImplementation(async (_file, args) => {
    const [, cwd, command, option] = args
    let phase: Phase
    if (command === 'rev-parse') {
      const count = revParses.get(cwd) ?? 0
      phase = phases[count]
      revParses.set(cwd, count + 1)
    } else {
      assert.ok(command === 'remote' || command === 'log')
      phase = command
    }
    if (cwd === first && phase === failedPhase) {
      throw Object.assign(new Error('invented-stderr-canary at invented-error-path-canary'), {
        killed: failure === 'timeout',
        signal: failure === 'timeout' ? 'SIGKILL' : undefined,
        code: failure === 'output limit' ? 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' : null,
        stdout: log,
        stderr: 'invented-stderr-canary',
        path: 'invented-error-path-canary',
      })
    }
    if (missingRemote && command === 'remote') throw Object.assign(new Error('No such remote'), { code: 2 })
    const stdout = command === 'rev-parse'
      ? option === '--show-toplevel' ? cwd : join(cwd, '.git')
      : command === 'remote' ? `https://example.invalid/invented/${cwd === first ? 'first' : 'later'}.git` : log
    return { stdout, stderr: '' }
  })
}

describe('bounded, content-free local Git execution', () => {
  it('gives every invocation a command-specific deadline and a forceful kill signal', () => fixture(async (root, first) => {
    runner(first)
    const result = await collectLocalGit([root], ...window, identity)
    assert.equal(execute.mock.calls.length, 12)
    assert.equal(result.coverage.status, 'complete')
    for (const [file, args, options] of execute.mock.calls) {
      assert.equal(file, 'git')
      assert.equal(options.timeout, args[2] === 'log' ? 120_000 : 30_000)
      assert.equal(options.killSignal, 'SIGKILL')
      assert.equal(options.maxBuffer, 64 * 1024 * 1024)
      assert.equal(options.encoding, 'utf8')
      assert.equal(options.windowsHide, true)
    }
  }))

  for (const failure of ['timeout', 'output limit'] as const) {
    for (const phase of phases) {
      it(`counts ${phase} ${failure} as incomplete and still inspects the later repository`, () => fixture(async (root, first, later) => {
        runner(first, phase, failure)
        const result = await collectLocalGit([root], ...window, identity)
        assert.equal(result.coverage.status, 'partial')
        assert.match(result.coverage.detail, /^1 explicitly selected repositories successfully inspected/)
        assert.equal(result.coverage.itemCount, 1)
        assert.deepEqual(result.repositories.map((repository) => repository.nameWithOwner), ['invented/later'])
        assert.equal(result.commits.length, 1, 'discard even valid partial stdout from a failed call')
        assert.ok(execute.mock.calls.some(([, args]) => args[1] === later && args[2] === 'log'))
        const serialized = JSON.stringify(result)
        for (const canary of [root, 'a-repository-path-canary', 'invented-stderr-canary', 'invented-error-path-canary', 'invented-source-canary']) {
          assert.ok(!serialized.includes(canary), 'failure result must be content-free')
        }
        if (phase === 'remote' || phase === 'log') assert.equal(result.warnings.length, 1)
        else assert.match(result.coverage.detail, /1 discovery check\(s\) failed; discovery is incomplete/)
      }))

      it(`reports unavailable when the only repository has a ${phase} ${failure}`, () => fixture(async (root, first) => {
        discover.mockResolvedValue({ candidates: [first], failedLocations: 0, cappedDirectories: 0 })
        runner(first, phase, failure)
        const result = await collectLocalGit([root], ...window, identity)
        assert.equal(result.coverage.status, 'unavailable')
        assert.match(result.coverage.detail, /^0 explicitly selected repositories successfully inspected/)
        assert.equal(result.coverage.itemCount, 0)
        assert.deepEqual(result.commits, [])
        assert.deepEqual(result.repositories, [])
        assert.ok(!JSON.stringify(result).includes('canary'))
      }))
    }
  }

  it('keeps repositories without an origin remote inspectable', () => fixture(async (root, first) => {
    runner(first, undefined, undefined, true)
    const result = await collectLocalGit([root], ...window, identity)
    assert.equal(result.coverage.status, 'complete')
    assert.equal(result.commits.length, 2)
    assert.equal(result.warnings.length, 0)
  }))
})
