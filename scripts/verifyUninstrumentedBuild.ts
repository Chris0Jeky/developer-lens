import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { uninstrumentedBuildViolations } from './usageInstrumentationGuard.js'

/**
 * Post-build privacy canary for the PLAIN (local/private) build.
 *
 * Pulseboard ENGINEERING.md: "Developer Lens remains public-showcase-only; no local dataset or
 * portable export is instrumented." Only `npm run build:showcase` (`--mode showcase`) may emit the
 * Pulseboard SDK, its script tag, its bar placeholder or the collector origin. This script runs at
 * the end of `npm run build` and fails when any of them reached the local `dist`.
 */

const dist = resolve('dist')
if (!existsSync(dist)) throw new Error('dist is missing; run the plain build first')

const { scanned, violations } = await uninstrumentedBuildViolations(dist)
if (scanned === 0) throw new Error('no build output was scanned; dist is empty')
if (violations.length > 0) {
  throw new Error(`The local/private build is instrumented:\n${violations.join('\n')}`)
}
console.log(`Verified that ${scanned} local build output files carry no Pulseboard SDK, tag, placeholder or collector origin.`)
