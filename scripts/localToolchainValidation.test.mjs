import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  formatLocalToolchainFailure,
  validateLocalToolchain,
} from './localToolchainValidation.mjs'

const createdRoots = []

const tools = [
  { command: 'tsc', packageName: 'typescript' },
  { command: 'tsx', packageName: 'tsx' },
]

function createRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'developer-lens-toolchain-'))
  createdRoots.push(root)
  mkdirSync(path.join(root, 'node_modules', '.bin'), { recursive: true })
  return root
}

function addLocalTool(root, { command, packageName }, platform = 'linux') {
  const extension = platform === 'win32' ? '.cmd' : ''
  const shim = path.join(root, 'node_modules', '.bin', `${command}${extension}`)
  const manifest = path.join(root, 'node_modules', packageName, 'package.json')

  mkdirSync(path.dirname(manifest), { recursive: true })
  writeFileSync(shim, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  writeFileSync(manifest, JSON.stringify({ name: packageName }))
  return { shim, manifest }
}

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

describe('validateLocalToolchain', () => {
  it('accepts repository-local package manifests and shims', () => {
    const root = createRoot()
    for (const tool of tools) addLocalTool(root, tool)

    expect(validateLocalToolchain({ root, platform: 'linux', tools })).toEqual({
      invalidResolutions: [],
      missingPackages: [],
      missingShims: [],
      ok: true,
    })
  })

  it('rejects a missing local shim before PATH can fall through to another checkout', () => {
    const root = createRoot()
    addLocalTool(root, tools[1])
    const manifest = path.join(root, 'node_modules', 'typescript', 'package.json')
    mkdirSync(path.dirname(manifest), { recursive: true })
    writeFileSync(manifest, JSON.stringify({ name: 'typescript' }))

    const result = validateLocalToolchain({ root, platform: 'linux', tools })

    expect(result).toEqual({
      invalidResolutions: [],
      missingPackages: [],
      missingShims: ['tsc'],
      ok: false,
    })
    const diagnostic = formatLocalToolchainFailure(result)
    expect(diagnostic).toContain('Affected tools: tsc')
    expect(diagnostic).toContain('npm ci')
    expect(diagnostic).not.toContain(root)
  })

  it('rejects a shim whose real path escapes the repository node_modules tree', () => {
    const root = createRoot()
    addLocalTool(root, tools[0])
    const foreignPath = path.join(path.dirname(root), 'foreign', 'node_modules', '.bin', 'tsc')

    const result = validateLocalToolchain({
      root,
      platform: 'linux',
      tools: [tools[0]],
      realpath: () => foreignPath,
    })

    expect(result).toEqual({
      invalidResolutions: ['tsc'],
      missingPackages: [],
      missingShims: [],
      ok: false,
    })
    expect(formatLocalToolchainFailure(result)).not.toContain(foreignPath)
  })

  it('recognises Windows command shims', () => {
    const root = createRoot()
    addLocalTool(root, tools[0], 'win32')

    expect(
      validateLocalToolchain({ root, platform: 'win32', tools: [tools[0]] }).ok,
    ).toBe(true)
  })

  it.skipIf(process.platform === 'win32')('rejects a non-executable POSIX shim', () => {
    const root = createRoot()
    const { shim } = addLocalTool(root, tools[0])
    chmodSync(shim, 0o644)

    const result = validateLocalToolchain({ root, platform: 'linux', tools: [tools[0]] })
    expect(result.ok).toBe(false)
    expect(result.invalidResolutions).toEqual(['tsc'])
    expect(formatLocalToolchainFailure(result)).not.toContain(root)
  })

  it.each(['linux', 'win32'])('rejects a directory-shaped %s shim', (platform) => {
    const root = createRoot()
    const { shim } = addLocalTool(root, tools[0], platform)
    rmSync(shim)
    mkdirSync(shim)

    const result = validateLocalToolchain({ root, platform, tools: [tools[0]] })
    expect(result.ok).toBe(false)
    expect(result.invalidResolutions).toEqual(['tsc'])
  })

  it('rejects a directory-shaped package manifest', () => {
    const root = createRoot()
    const { manifest } = addLocalTool(root, tools[0])
    rmSync(manifest)
    mkdirSync(manifest)

    const result = validateLocalToolchain({ root, platform: 'linux', tools: [tools[0]] })
    expect(result.ok).toBe(false)
    expect(result.invalidResolutions).toEqual(['tsc'])
  })

  it.skipIf(process.platform === 'win32')('accepts an executable repository-local symlink', () => {
    const root = createRoot()
    const { shim, manifest } = addLocalTool(root, tools[0])
    const target = path.join(path.dirname(manifest), 'cli')
    writeFileSync(target, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    rmSync(shim)
    symlinkSync(target, shim)

    expect(validateLocalToolchain({ root, platform: 'linux', tools: [tools[0]] }).ok).toBe(true)
  })

  it.skipIf(process.platform === 'win32')('rejects a non-executable symlink target', () => {
    const root = createRoot()
    const { shim, manifest } = addLocalTool(root, tools[0])
    const target = path.join(path.dirname(manifest), 'cli')
    writeFileSync(target, '#!/bin/sh\nexit 0\n', { mode: 0o644 })
    rmSync(shim)
    symlinkSync(target, shim)

    const result = validateLocalToolchain({ root, platform: 'linux', tools: [tools[0]] })
    expect(result.ok).toBe(false)
    expect(result.invalidResolutions).toEqual(['tsc'])
  })
})
