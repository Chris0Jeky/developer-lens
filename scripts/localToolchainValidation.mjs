import { accessSync, constants, existsSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'

export const DEFAULT_LOCAL_TOOLS = [
  { command: 'tsc', packageName: 'typescript' },
  { command: 'tsx', packageName: 'tsx' },
  { command: 'vite', packageName: 'vite' },
  { command: 'vitest', packageName: 'vitest' },
  { command: 'oxlint', packageName: 'oxlint' },
]

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  )
}

function shimCandidates(root, command, platform) {
  const binDirectory = path.join(root, 'node_modules', '.bin')
  if (platform === 'win32') {
    return ['.cmd', '.exe', '.bat', ''].map((extension) =>
      path.join(binDirectory, `${command}${extension}`),
    )
  }
  return [path.join(binDirectory, command)]
}

function uniqueInToolOrder(values) {
  return [...new Set(values)]
}

export function validateLocalToolchain({
  root,
  platform = process.platform,
  tools = DEFAULT_LOCAL_TOOLS,
  pathExists = existsSync,
  realpath = realpathSync,
} = {}) {
  if (!root) throw new TypeError('root is required')

  const repositoryRoot = path.resolve(root)
  const nodeModulesRoot = path.join(repositoryRoot, 'node_modules')
  const missingShims = []
  const missingPackages = []
  const invalidResolutions = []

  for (const { command, packageName } of tools) {
    const shim = shimCandidates(repositoryRoot, command, platform).find(pathExists)
    if (!shim) {
      missingShims.push(command)
    } else {
      try {
        if (!isWithin(nodeModulesRoot, realpath(shim)) || !statSync(shim).isFile()) {
          invalidResolutions.push(command)
        } else {
          // POSIX shells skip non-executable PATH entries; existence alone is unsafe.
          accessSync(shim, platform === 'win32' ? constants.R_OK : constants.X_OK)
        }
      } catch {
        invalidResolutions.push(command)
      }
    }

    const manifest = path.join(nodeModulesRoot, packageName, 'package.json')
    if (!pathExists(manifest)) {
      missingPackages.push(command)
    } else {
      try {
        if (!isWithin(nodeModulesRoot, realpath(manifest)) || !statSync(manifest).isFile()) {
          invalidResolutions.push(command)
        } else {
          accessSync(manifest, constants.R_OK)
        }
      } catch {
        invalidResolutions.push(command)
      }
    }
  }

  const result = {
    invalidResolutions: uniqueInToolOrder(invalidResolutions),
    missingPackages: uniqueInToolOrder(missingPackages),
    missingShims: uniqueInToolOrder(missingShims),
    ok: false,
  }
  result.ok =
    result.invalidResolutions.length === 0 &&
    result.missingPackages.length === 0 &&
    result.missingShims.length === 0
  return result
}

export function formatLocalToolchainFailure(result) {
  const affectedTools = uniqueInToolOrder([
    ...result.missingShims,
    ...result.missingPackages,
    ...result.invalidResolutions,
  ])

  return [
    'Local npm toolchain preflight failed.',
    `Affected tools: ${affectedTools.join(', ') || 'unknown'}.`,
    'A required package or node_modules/.bin shim is missing, unusable, or resolves outside this checkout.',
    'Run npm ci in this checkout before trusting npm-script failures.',
  ].join('\n')
}
