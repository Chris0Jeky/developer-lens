import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validateCurrentStateFenceContract } from './currentStateFenceValidation.js'

const path = resolve('docs', 'analyser-program', 'CURRENT_STATE.md')
const violations = validateCurrentStateFenceContract(await readFile(path, 'utf8'))

if (violations.length > 0) {
  for (const violation of violations) console.error(`current state: ${violation}`)
  process.exitCode = 1
} else {
  console.log('Verified root-level current-state Markdown fence contract.')
}
