#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_LOCAL_TOOLS,
  formatLocalToolchainFailure,
  validateLocalToolchain,
} from './localToolchainValidation.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const result = validateLocalToolchain({ root: repositoryRoot })

if (!result.ok) {
  console.error(formatLocalToolchainFailure(result))
  process.exitCode = 1
} else {
  console.log(
    `Local npm toolchain preflight passed: ${DEFAULT_LOCAL_TOOLS.map(({ command }) => command).join(', ')}.`,
  )
}
