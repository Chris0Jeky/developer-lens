import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  uninstrumentedBuildViolations,
  usageInstrumentationViolations,
} from './usageInstrumentationGuard.js'

const roots: string[] = []

async function buildOutput(files: Record<string, string | Buffer>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dl-uninstrumented-'))
  roots.push(root)
  for (const [name, content] of Object.entries(files)) {
    const path = join(root, name)
    await mkdir(resolve(path, '..'), { recursive: true })
    await writeFile(path, content)
  }
  return root
}

describe('local/private build instrumentation guard', () => {
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('accepts a local build with no SDK, tag, placeholder or collector origin', async () => {
    const root = await buildOutput({
      'index.html': '<!doctype html><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body>',
      'assets/app.js': 'console.log("local lens")',
    })
    expect(await uninstrumentedBuildViolations(root)).toEqual({ scanned: 2, violations: [] })
  })

  it('rejects every way the showcase SDK could leak into a local build', async () => {
    const root = await buildOutput({
      'index.html': '<body><div data-pulseboard-bar style="min-height:2.5rem"></div><script defer src="/pulseboard.js"></script>',
      'assets/app.js': 'globalThis.Pulseboard?.track("share.requested",{channel:"copy"})',
      'assets/chunk.js': 'fetch("https://pulseboard-observatory.commit-atlas.workers.dev/v1/consent/developer-lens")',
      'observatory.js': 'window.PulseboardUsage=null',
      'social-card.png': Buffer.from('\x89PNG pulseboard', 'latin1'),
    })
    const { violations } = await uninstrumentedBuildViolations(root)
    expect(violations).toEqual(
      expect.arrayContaining([
        'Pulseboard SDK or global in index.html',
        'Pulseboard SDK or global in assets/app.js',
        'Pulseboard collector origin in assets/chunk.js',
        'legacy Observatory adapter in file name observatory.js',
        'Pulseboard SDK or global in social-card.png',
      ]),
    )
  })

  it('flags an instrumented portable or share artifact string', () => {
    expect(usageInstrumentationViolations('report', '<script src="pulseboard.js"></script>')).toEqual([
      'Pulseboard SDK or global in report',
    ])
    expect(usageInstrumentationViolations('report', '<main>synthetic</main>')).toEqual([])
  })

  it('verifies the locked Pulseboard SDK artifact (observatory/check.mjs)', () => {
    const output = execFileSync(process.execPath, [resolve('observatory', 'check.mjs')], {
      encoding: 'utf8',
    })
    expect(output).toContain('Pulseboard SDK 3.1.0 artifact')
  })
})
