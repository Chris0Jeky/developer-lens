import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'

export const TEST_TEMP_DIRECTORY_ERROR = 'TEST_TEMP_DIRECTORY_INVALID' as const

interface CanonicalTestTempEnvironmentOptions {
  readonly canonicalize?: (path: string) => string
  readonly environment?: NodeJS.ProcessEnv
  readonly platform?: NodeJS.Platform
  readonly temporaryDirectory?: string
}

/**
 * Windows may expose TEMP/TMP through an 8.3 short path while native realpath
 * returns the long form. Storage-v3 intentionally requires callers to supply a
 * canonical artifact root, so the test runner normalizes its own inherited
 * temporary-directory environment before any fixture creates a workspace.
 */
export function canonicalizeWindowsTestTempEnvironment({
  canonicalize = realpathSync.native,
  environment = process.env,
  platform = process.platform,
  temporaryDirectory = tmpdir(),
}: CanonicalTestTempEnvironmentOptions = {}): string | null {
  if (platform !== 'win32') return null

  let canonicalDirectory: string
  try {
    canonicalDirectory = canonicalize(temporaryDirectory)
  } catch {
    throw new Error(TEST_TEMP_DIRECTORY_ERROR)
  }

  if (canonicalDirectory.length === 0) throw new Error(TEST_TEMP_DIRECTORY_ERROR)
  environment.TEMP = canonicalDirectory
  environment.TMP = canonicalDirectory
  return canonicalDirectory
}
