import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanDirectoryForExternalResources } from './externalResourceGuard.js'

const roots: string[] = []
async function fixture(filename: string, contents: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'lens-resource-syntax-'))
  roots.push(root)
  await writeFile(join(root, filename), contents, 'utf8')
  return root
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

const cases = [
  ['CSS escaped scheme', 'site.css', String.raw`.remote { background: url(\68 ttps://cdn.example.test/image.png); }`],
  ['CSS escaped function', 'site.css', String.raw`.remote { background: u\72l(https://cdn.example.test/image.png); }`],
  ['CSS escaped import', 'site.css', String.raw`@\69mport "https://cdn.example.test/site.css";`],
  ['URL tab normalization', 'index.html', '<img src="ht&#x09;tps://cdn.example.test/image.png">'],
  ['special URL backslashes', 'index.html', String.raw`<img src="https:\\cdn.example.test\image.png">`],
  ['quoted angle bracket', 'index.html', '<img alt="a > b" src="https://cdn.example.test/image.png">'],
  ['CSS escaped quote inside url()', 'site.css', String.raw`.remote { background: url("https://cdn.example.test/x\22 suffix"); }`],
  ['scheme-relative backslashes', 'index.html', String.raw`<img src="\\cdn.example.test\image.png">`],
] as const

describe('external resource browser-syntax regressions', () => {
  it.each(cases)('rejects %s without fetching the resource', async (_label, filename, contents) => {
    const root = await fixture(filename, contents)
    const violations = await scanDirectoryForExternalResources(root)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('preserves local resources, outbound anchors, and an inlined SVG namespace', async () => {
    const root = await fixture('index.html', `<a href="https://example.test/docs">Docs</a>
      <img src="./image.png" alt="a > b"><svg><use href="#shape" /></svg>
      <style>.local { background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E"); }</style>`)
    expect(await scanDirectoryForExternalResources(root)).toEqual([])
  })
})
