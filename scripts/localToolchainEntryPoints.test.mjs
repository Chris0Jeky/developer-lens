import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateLocalToolchain, formatLocalToolchainFailure } from './localToolchainValidation.mjs'

// npm invokes these scripts from the package root; Vitest may transform import.meta.url.
const { scripts } = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'))
const guardedCommands = /(?:^|&&\s*)(?:tsx|tsc|vite|vitest|oxlint)(?:\s|$)/
const entrypoints = Object.entries(scripts).filter(([, command]) => guardedCommands.test(command))
const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('local toolchain command entrypoints', () => {
  it.each(entrypoints)('guards %s before launching an npm-installed tool', (_name, command) => {
    expect(command).toMatch(/^(?:node scripts\/verifyLocalToolchain\.mjs|npm run verify:toolchain) && /)
  })

  it.each(['.com', '.exe', '.bat', '.cmd', '.py'])('rejects a root-level Windows %s command shadow', (extension) => {
    const root = mkdtempSync(path.join(tmpdir(), 'lens-command-shadow-'))
    roots.push(root)
    const bin = path.join(root, 'node_modules', '.bin')
    const pkg = path.join(root, 'node_modules', 'typescript')
    mkdirSync(bin, { recursive: true })
    mkdirSync(pkg, { recursive: true })
    writeFileSync(path.join(bin, 'tsc.cmd'), '@exit /b 0\r\n')
    writeFileSync(path.join(pkg, 'package.json'), '{"name":"typescript"}')
    const options = {
      root,
      platform: 'win32',
      pathExt: '.COM;.EXE;.BAT;.CMD;.PY',
      tools: [{ command: 'tsc', packageName: 'typescript' }],
    }
    expect(validateLocalToolchain(options).ok).toBe(true)
    const shadow = path.join(root, `tsc${extension}`)
    writeFileSync(shadow, 'inert fixture; never executed')
    const result = validateLocalToolchain(options)
    expect(result.ok).toBe(false)
    expect(result.invalidResolutions).toEqual(['tsc'])
    expect(formatLocalToolchainFailure(result)).not.toContain(root)
    rmSync(shadow)
    expect(validateLocalToolchain(options).ok).toBe(true)
  })
})
