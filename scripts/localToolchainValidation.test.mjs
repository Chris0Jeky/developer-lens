import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
  writeFileSync(shim, 'local shim\n')
  writeFileSync(manifest, JSON.stringify({ name: packageName }))
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
})
