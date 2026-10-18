import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'vitest'
import { collectLocalGit } from './localGit.js'

const identity = { emails: ['invented@example.invalid'] }
const emptyWindow = ['2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z'] as const
async function fixture(run: (root: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'lens-empty-coverage-'))
  try { await run(root) } finally { rmSync(root, { recursive: true, force: true }) }
}
function repository(root: string, name: string, broken = false): string {
  const path = join(root, name)
  execFileSync('git', ['-c', 'init.templateDir=', 'init', '--quiet', path])
  const hooks = join(path, '.git', 'empty-hooks')
  mkdirSync(hooks)
  execFileSync('git', ['-C', path, '-c', `core.hooksPath=${hooks}`, '-c', 'commit.gpgsign=false',
    'commit', '--quiet', '--allow-empty', '-m', 'test: invented coverage fixture'], {
    env: { ...process.env, GIT_AUTHOR_NAME: 'Invented', GIT_AUTHOR_EMAIL: identity.emails[0],
      GIT_COMMITTER_NAME: 'Invented', GIT_COMMITTER_EMAIL: identity.emails[0],
      GIT_AUTHOR_DATE: '2026-01-10T12:00:00Z', GIT_COMMITTER_DATE: '2026-01-10T12:00:00Z' },
  })
  if (broken) writeFileSync(join(path, '.git', 'refs', 'heads', 'broken'), `${'1'.repeat(40)}\n`)
  return path
}

describe('successful empty local inspections remain observable (#411 review)', () => {
  it('reports partial for an inspected zero-activity repository plus a missing root', () => fixture(async (root) => {
    const result = await collectLocalGit([repository(root, 'healthy'), join(root, 'missing')], ...emptyWindow, identity)
    assert.equal(result.commits.length, 0)
    assert.equal(result.coverage.itemCount, 0)
    assert.equal(result.coverage.status, 'partial')
    assert.match(result.coverage.detail, /^1 explicitly selected repositories successfully inspected/)
  }))
  it('reports partial when author filtering finds no commits and another marker is invalid', () => fixture(async (root) => {
    const invalid = join(root, 'invalid')
    mkdirSync(invalid)
    writeFileSync(join(invalid, '.git'), 'gitdir: nonexistent-invented-directory\n')
    const result = await collectLocalGit([repository(root, 'healthy'), invalid],
      '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', { emails: ['other@example.invalid'] })
    assert.equal(result.commits.length, 0)
    assert.equal(result.coverage.status, 'partial')
    assert.match(result.coverage.detail, /1 discovery check/)
  }))
  it('does not count a Git-log failure as a successful inspection', () => fixture(async (root) => {
    const result = await collectLocalGit([repository(root, 'broken', true)], ...emptyWindow, identity)
    assert.equal(result.coverage.status, 'unavailable')
    assert.equal(result.warnings.length, 1)
    assert.match(result.coverage.detail, /^0 explicitly selected repositories successfully inspected/)
  }))
  it('retains an empty successful inspection when another repository log fails', () => fixture(async (root) => {
    const result = await collectLocalGit([repository(root, 'healthy'), repository(root, 'broken', true)], ...emptyWindow, identity)
    assert.equal(result.commits.length, 0)
    assert.equal(result.warnings.length, 1)
    assert.equal(result.coverage.status, 'partial')
    assert.match(result.coverage.detail, /^1 explicitly selected repositories successfully inspected/)
  }))
  it('keeps a wholly successful zero-activity inspection complete', () => fixture(async (root) => {
    const result = await collectLocalGit([repository(root, 'healthy')], ...emptyWindow, identity)
    assert.equal(result.commits.length, 0)
    assert.equal(result.coverage.status, 'complete')
    assert.equal(result.warnings.length, 0)
  }))
})
