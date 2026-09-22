import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { describe, expect, it, vi } from 'vitest'

import {
  TEST_TEMP_DIRECTORY_ERROR,
  canonicalizeWindowsTestTempEnvironment,
} from './canonicalTestTempEnvironment.js'

describe('canonicalizeWindowsTestTempEnvironment', () => {
  it('rebinds both Windows temporary-directory variables to the canonical path', () => {
    const shortPath = 'C:\\TESTRO~1\\Temp'
    const longPath = 'C:\\TestRoot\\Temp'
    const environment: NodeJS.ProcessEnv = {
      TEMP: shortPath,
      TMP: shortPath,
    }
    const canonicalize = vi.fn(() => longPath)

    expect(
      canonicalizeWindowsTestTempEnvironment({
        canonicalize,
        environment,
        platform: 'win32',
        temporaryDirectory: shortPath,
      }),
    ).toBe(longPath)
    expect(canonicalize).toHaveBeenCalledOnce()
    expect(canonicalize).toHaveBeenCalledWith(shortPath)
    expect(environment).toMatchObject({ TEMP: longPath, TMP: longPath })
  })

  it('does not touch temporary-directory state on other platforms', () => {
    const environment: NodeJS.ProcessEnv = {
      TEMP: '/tmp/original',
      TMP: '/tmp/original',
    }
    const canonicalize = vi.fn(() => '/tmp/canonical')

    expect(
      canonicalizeWindowsTestTempEnvironment({
        canonicalize,
        environment,
        platform: 'linux',
        temporaryDirectory: '/tmp/original',
      }),
    ).toBeNull()
    expect(canonicalize).not.toHaveBeenCalled()
    expect(environment).toMatchObject({ TEMP: '/tmp/original', TMP: '/tmp/original' })
  })

  it('fails without partially mutating or disclosing the temporary path', () => {
    const shortPath = 'C:\\PRIVATE~1\\Temp'
    const environment: NodeJS.ProcessEnv = {
      TEMP: shortPath,
      TMP: shortPath,
    }

    expect(() =>
      canonicalizeWindowsTestTempEnvironment({
        canonicalize: () => { throw new Error(shortPath) },
        environment,
        platform: 'win32',
        temporaryDirectory: shortPath,
      }),
    ).toThrow(TEST_TEMP_DIRECTORY_ERROR)
    expect(environment).toMatchObject({ TEMP: shortPath, TMP: shortPath })
  })

  it.runIf(process.platform === 'win32')(
    'starts Windows fixtures from the canonical temporary directory',
    () => {
      expect(tmpdir()).toBe(realpathSync.native(tmpdir()))
    },
  )
})
