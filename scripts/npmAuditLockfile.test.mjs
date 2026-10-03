import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'vitest'

const workflow = readFileSync(new URL('../.github/workflows/dependency-audit-evidence.yml', import.meta.url), 'utf8')
const runBlock = workflow.split('        run: |\n')[1]
assert.ok(runBlock, 'Expected the audit workflow shell step')
const command = runBlock.split('\n').map((line) => line.replace(/^          /, '')).join('\n')

function runAudit(files, mutation = '') {
  const root = mkdtempSync(join(tmpdir(), 'audit-lock-fixture-'))
  try {
    mkdirSync(join(root, 'scripts'))
    mkdirSync(join(root, 'bin'))
    copyFileSync(new URL('./npmAuditEvidence.mjs', import.meta.url), join(root, 'scripts/npmAuditEvidence.mjs'))
    writeFileSync(join(root, 'package.json'), '{"name":"invented-audit-fixture","private":true}\n')
    for (const [name, content] of Object.entries(files)) writeFileSync(join(root, name), content)
    execFileSync('git', ['init', '-q', root])
    execFileSync('git', ['-C', root, 'add', '--', 'package.json', ...Object.keys(files)])
    execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Invented input'])
    // Only npm is stubbed: run the real workflow shell, validator, hashes and Git guard.
    const npm = join(root, 'bin/npm')
    writeFileSync(npm, '#!/bin/sh\n' +
      'touch npm-invoked\n' +
      (mutation ? `printf "changed\\n" >> "${mutation}"\n` : '') +
      'printf \'%s\\n\' \'{"auditReportVersion":2,"vulnerabilities":{},"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}}}\'\n')
    chmodSync(npm, 0o755)
    return spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', command], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
      env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, RUNNER_TEMP: root },
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const digest = (text) => createHash('sha256').update(text).digest('hex')
const lock = '{"name":"invented-lock"}\n'
const shrinkwrap = '{"name":"invented-shrinkwrap"}\n'

describe('audit workflow lockfile identity (#402)', () => {
  it('triggers for shrinkwrap-only changes and the workflow regression itself', () => {
    assert.match(workflow, /^      - npm-shrinkwrap\.json$/m)
    assert.match(workflow, /^      - scripts\/npmAuditLockfile\.test\.mjs$/m)
  })

  // The production workflow runs Bash on Linux; no Windows shell proof is claimed.
  const shellIt = process.platform === 'win32' ? it.skip : it
  shellIt('hashes package-lock when there is no shrinkwrap', () => {
    const result = runAudit({ 'package-lock.json': lock })
    assert.equal(result.status, 0, result.stderr)
    assert.ok(result.stdout.includes(`${digest(lock)}  package-lock.json`))
  })
  shellIt('supports shrinkwrap without package-lock', () => {
    const result = runAudit({ 'npm-shrinkwrap.json': shrinkwrap })
    assert.equal(result.status, 0, result.stderr)
    assert.ok(result.stdout.includes(`${digest(shrinkwrap)}  npm-shrinkwrap.json`))
  })
  shellIt('hashes npm-preferred shrinkwrap when both files exist', () => {
    const result = runAudit({ 'package-lock.json': lock, 'npm-shrinkwrap.json': shrinkwrap })
    assert.equal(result.status, 0, result.stderr)
    assert.ok(result.stdout.includes(`${digest(shrinkwrap)}  npm-shrinkwrap.json`))
    assert.ok(!result.stdout.includes(`${digest(lock)}  package-lock.json`))
  })
  shellIt('refuses successful collection when the shrinkwrap changed', () => {
    const result = runAudit({ 'package-lock.json': lock, 'npm-shrinkwrap.json': shrinkwrap }, 'npm-shrinkwrap.json')
    assert.notEqual(result.status, 0)
    assert.ok(result.stdout.includes('diff --git a/npm-shrinkwrap.json'))
  })
  shellIt('still refuses mutations of the ignored package-lock', () => {
    const result = runAudit({ 'package-lock.json': lock, 'npm-shrinkwrap.json': shrinkwrap }, 'package-lock.json')
    assert.notEqual(result.status, 0)
    assert.ok(result.stdout.includes('diff --git a/package-lock.json'))
  })
  shellIt('still refuses package manifest mutations', () => {
    const result = runAudit({ 'package-lock.json': lock }, 'package.json')
    assert.notEqual(result.status, 0)
    assert.ok(result.stdout.includes('diff --git a/package.json'))
  })
  shellIt('fails before collecting evidence when neither lockfile exists', () => {
    const result = runAudit({})
    assert.notEqual(result.status, 0)
    assert.ok(!result.stdout.includes('Audit evidence collected'))
  })
})
