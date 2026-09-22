import fs, { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
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
    expect(validate(files.root).ok).toBe(true)
    const originalOpen = fs.openSync
    let deniedAttempts = 0
    // The Node-only .mjs preflight can be imported natively. Update the built-in
    // ESM binding as well as the fs object, rather than mocking only Vitest's view.
    fs.openSync = (...args) => {
      if (args[0] === files[entry]) {
        deniedAttempts += 1
        throw new Error(`private ACL denial: ${args[0]}`)
      }
      return originalOpen(...args)
    }
    syncBuiltinESMExports()
    try {
      const result = validate(files.root)
      expect(deniedAttempts).toBeGreaterThan(0)
      expect(result.ok).toBe(false)
      expect(result.invalidResolutions).toEqual(['tsc'])
      const diagnostic = formatLocalToolchainFailure(result)
      expect(diagnostic).not.toContain(files.root)
      expect(diagnostic).not.toContain('ACL denial')
    } finally {
      fs.openSync = originalOpen
      syncBuiltinESMExports()
    }
    expect(validate(files.root).ok).toBe(true)
  })
})
