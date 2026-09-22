import { accessSync, closeSync, constants, existsSync, fstatSync, openSync, realpathSync, statSync } from 'node:fs'
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

const DEFAULT_WINDOWS_EXTENSIONS = ['.com', '.exe', '.bat', '.cmd']

function shimCandidates(root, command, platform, pathExt) {
  const binDirectory = path.join(root, 'node_modules', '.bin')
  if (platform !== 'win32') {
    const candidates = [path.join(binDirectory, command)]
    return { selectable: candidates, inspect: candidates }
  }
  const extensions = pathExt.split(';').map((value) => value.trim().toLowerCase()).filter(Boolean)
  if (extensions.length === 0 || extensions.some((value) => !/^\.[a-z0-9]+$/.test(value))) {
    throw new Error('Invalid command-extension configuration')
  }
  const candidates = (values) => [...new Set(values)].map((extension) =>
    path.join(binDirectory, `${command}${extension}`),
  )
  return {
    selectable: candidates(extensions),
    // Validate every possible sibling, not the first .cmd: lookup can prefer another extension.
    inspect: candidates([...DEFAULT_WINDOWS_EXTENSIONS, ...extensions]),
  }
}

function isUsableFile(file, nodeModulesRoot, realpath, executable) {
  if (!isWithin(nodeModulesRoot, realpath(file)) || !statSync(file).isFile()) return false
  // Opening checks Windows ACLs, unlike access(R_OK). Never consume the file's contents.
  const descriptor = openSync(file, 'r')
  try {
    if (!fstatSync(descriptor).isFile()) return false
    if (executable) accessSync(file, constants.X_OK)
    return true
  } finally {
    closeSync(descriptor)
  }
}

function uniqueInToolOrder(values) {
  return [...new Set(values)]
}

export function validateLocalToolchain({
  root,
  platform = process.platform,
  pathExt = process.env.PATHEXT ?? DEFAULT_WINDOWS_EXTENSIONS.join(';'),
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
    try {
      const candidates = shimCandidates(repositoryRoot, command, platform, pathExt)
      if (!candidates.selectable.some(pathExists)) missingShims.push(command)
      for (const shim of candidates.inspect.filter(pathExists)) {
        if (!isUsableFile(shim, nodeModulesRoot, realpath, platform !== 'win32')) {
          invalidResolutions.push(command)
        }
      }
    } catch {
      invalidResolutions.push(command)
    }

    const manifest = path.join(nodeModulesRoot, packageName, 'package.json')
    if (!pathExists(manifest)) {
      missingPackages.push(command)
    } else {
      try {
        if (!isUsableFile(manifest, nodeModulesRoot, realpath, false)) {
          invalidResolutions.push(command)
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
