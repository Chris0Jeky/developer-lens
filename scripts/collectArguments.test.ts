import { afterEach, describe, expect, it, vi } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { collectGithub } from '../server/github.js'
import { collectLocalGit } from '../server/localGit.js'
import { parseArguments } from './collectArguments.js'

vi.mock('node:child_process', () => {
  const mock = { execFile: vi.fn() }
  return { ...mock, default: mock }
})
vi.mock('node:fs/promises', () => {
  const mock = { mkdir: vi.fn(), writeFile: vi.fn() }
  return { ...mock, default: mock }
})
vi.mock('../server/analytics.js', () => ({ analyzeDataset: vi.fn() }))
vi.mock('../server/dataStore.js', () => ({
  PRIVATE_DATA_DIRECTORY: 'invented-unused-data',
  rawPath: vi.fn(),
  dashboardPath: vi.fn(),
}))
vi.mock('../server/github.js', () => ({ collectGithub: vi.fn() }))
vi.mock('../server/localGit.js', () => ({ collectLocalGit: vi.fn() }))

const invalidArguments = [
  ['--range', '6mm'],
  ['--range=6mm'],
  ['--range', '6M'],
  ['--range', '6m', '--range', 'invalid'],
  ['--range=invalid', '--range=12m'],
  ['--range'],
  ['--local-root'],
  ['--range='],
  ['--local-root='],
  ['--range', ''],
  ['--local-root', ''],
  ['--local-root', '   '],
  ['--local-root=   '],
  ['--range', '--local-root', 'invented-repos'],
  ['--local-root', '--range', '6m'],
  ['--local-root', '--range=6m'],
  ['--local-root=--range'],
  ['--range=--local-root'],
  ['--local-root', '-x'],
  ['--range', '-x'],
  ['--unknown'],
  ['--unknown=6m'],
  ['-r', '6m'],
  ['invented-positional'],
  ['--'],
]

describe('collection arguments', () => {
  it('defaults to both ranges only when no range is supplied', () => {
    expect(parseArguments([])).toEqual({ roots: [], ranges: ['6m', '12m'] })
    expect(parseArguments(['--local-root', 'invented-repos'])).toEqual({
      roots: ['invented-repos'], ranges: ['6m', '12m'],
    })
  })

  it.each(['6m', '12m'])('accepts the %s range in both value forms', (range) => {
    expect(parseArguments(['--range', range])).toEqual({ roots: [], ranges: [range] })
    expect(parseArguments([`--range=${range}`])).toEqual({ roots: [], ranges: [range] })
  })

  it('preserves ordering and deduplicates repeated ranges and roots', () => {
    const argv = [
      '--local-root', 'C:\\invented repos', '--range=12m',
      '--local-root=other=repo', '--range', '6m',
      '--local-root=C:\\invented repos', '--range=12m',
    ]
    const original = [...argv]
    expect(parseArguments(argv, ' ; other=repo ; environment-repos; environment-repos ; '))
      .toEqual({
        roots: ['C:\\invented repos', 'other=repo', 'environment-repos'],
        ranges: ['12m', '6m'],
      })
    expect(argv).toEqual(original)
  })

  it.each(invalidArguments.map((argv) => [argv]))('rejects malformed arguments %j', (argv) => {
    expect(() => parseArguments(argv)).toThrow(Error)
  })

  it('gives clear option errors without echoing supplied values', () => {
    expect(() => parseArguments(['--range', 'invented-private-value']))
      .toThrow('--range must be 6m or 12m.')
    expect(() => parseArguments(['--local-root', '--range']))
      .toThrow('--local-root requires a value.')
    expect(() => parseArguments(['--invented-private-value']))
      .toThrow('Unknown collection argument.')
  })
})

describe('collection CLI validation order', () => {
  const originalArgv = process.argv
  const originalExitCode = process.exitCode

  afterEach(() => {
    process.argv = originalArgv
    process.exitCode = originalExitCode
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it.each([
    [['--range', '6mm'], '--range must be 6m or 12m.'],
    [['--local-root', '--range', '6m'], '--local-root requires a value.'],
    [['--unknown'], 'Unknown collection argument.'],
  ])('fails before filesystem, identity or collector calls for %j', async (argv, message) => {
    vi.resetModules()
    vi.stubEnv('DEV_LENS_LOCAL_ROOTS', '')
    process.argv = ['node', 'collect.ts', ...argv]
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await import('./collect.js')
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith(`Collection failed: ${message}`))

    expect(process.exitCode).toBe(1)
    expect(mkdir).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
    expect(execFile).not.toHaveBeenCalled()
    expect(collectGithub).not.toHaveBeenCalled()
    expect(collectLocalGit).not.toHaveBeenCalled()
  })
})
