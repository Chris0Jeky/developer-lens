import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { formatLocalToolchainFailure, validateLocalToolchain } from './localToolchainValidation.mjs'

const roots = []
const tools = [{ command: 'tsc', packageName: 'typescript' }]
const pathExt = '.COM;.EXE;.BAT;.CMD;.PY'
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'lens-windows-toolchain-'))
  roots.push(root)
  const bin = path.join(root, 'node_modules', '.bin')
  const manifest = path.join(root, 'node_modules', 'typescript', 'package.json')
  mkdirSync(bin, { recursive: true })
  mkdirSync(path.dirname(manifest), { recursive: true })
  const shim = path.join(bin, 'tsc.cmd')
  writeFileSync(shim, '@exit /b 0\r\n')
  writeFileSync(manifest, '{"name":"typescript"}')
  return { root, bin, shim, manifest }
}
function validate(root, extensions = pathExt) {
  return validateLocalToolchain({ root, platform: 'win32', tools, pathExt: extensions })
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

// Use the same native ESM boundary as the Node-only preflight, outside Vitest's
// transformed module bindings. Paths are argv values, never interpolated code.
const readDenialProbe = `
  import fs from 'node:fs'
  import { syncBuiltinESMExports } from 'node:module'
  import { pathToFileURL } from 'node:url'
  const [modulePath, root, deniedPath] = process.argv.slice(1)
  const { validateLocalToolchain, formatLocalToolchainFailure } = await import(pathToFileURL(modulePath).href)
  const options = { root, platform: 'win32', pathExt: '.COM;.EXE;.BAT;.CMD;.PY', tools: [{ command: 'tsc', packageName: 'typescript' }] }
  const before = validateLocalToolchain(options).ok
  const originalOpen = fs.openSync
  let deniedAttempts = 0
  let result
  fs.openSync = (...args) => {
    if (args[0] === deniedPath) {
      deniedAttempts += 1
      throw new Error('private ACL denial: ' + args[0])
    }
    return originalOpen(...args)
  }
  syncBuiltinESMExports()
  try {
    result = validateLocalToolchain(options)
  } finally {
    fs.openSync = originalOpen
    syncBuiltinESMExports()
  }
  console.log(JSON.stringify({ before, result, deniedAttempts, diagnostic: formatLocalToolchainFailure(result), after: validateLocalToolchain(options).ok }))
`

describe('Windows local toolchain admission', () => {
  it.each(['.com', '.exe', '.bat', '.py'])('does not hide an unusable %s sibling behind a valid .cmd', (extension) => {
    const { root, bin } = fixture()
    mkdirSync(path.join(bin, `tsc${extension}`))
    const result = validate(root)
    expect(result.ok).toBe(false)
    expect(result.invalidResolutions).toEqual(['tsc'])
    expect(formatLocalToolchainFailure(result)).not.toContain(root)
  })

  it('accepts ordinary readable .cmd shims under a case-insensitive extension list', () => {
    const { root } = fixture()
    expect(validate(root, '.com;.ExE;.Bat;.CmD').ok).toBe(true)
  })

  it('does not count a .cmd shim that PATHEXT cannot select', () => {
    const { root } = fixture()
    expect(validate(root, '.EXE').ok).toBe(false)
  })

  it.each(['', '.CMD;../escape', '.CMD;C:\\private'])('fails closed for an unusable extension list %j', (extensions) => {
    const { root } = fixture()
    const result = validate(root, extensions)
    expect(result.ok).toBe(false)
    expect(formatLocalToolchainFailure(result)).not.toContain('private')
  })

  it.each(['shim', 'manifest'])('rejects a metadata-visible but read-denied %s without disclosing its path', (entry) => {
    const files = fixture()
    const child = spawnSync(process.execPath, [
      '--input-type=module', '--eval', readDenialProbe,
      path.resolve('scripts/localToolchainValidation.mjs'), files.root, files[entry],
    ], { encoding: 'utf8', timeout: 10_000, shell: false })
    expect(child.error).toBeUndefined()
    expect(child.status, child.stderr).toBe(0)
    const proof = JSON.parse(child.stdout)
    expect(proof.before).toBe(true)
    expect(proof.deniedAttempts).toBeGreaterThan(0)
    expect(proof.result.ok).toBe(false)
    expect(proof.result.invalidResolutions).toEqual(['tsc'])
    expect(proof.diagnostic).not.toContain(files.root)
    expect(proof.diagnostic).not.toContain('ACL denial')
    expect(proof.after).toBe(true)
  })
})
