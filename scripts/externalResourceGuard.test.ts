import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanDirectoryForExternalResources } from './externalResourceGuard.js'

const temporaryRoots: string[] = []

async function fixture(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'developer-lens-external-resources-'))
  temporaryRoots.push(root)
  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, contents, 'utf8')
  }
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('dist-wide external resource guard', () => {
  it('rejects network-loaded HTML and SVG resources while preserving outbound anchors', async () => {
    const root = await fixture({
      'index.html': `<!doctype html>
        <a href="https://example.test/docs">Allowed navigation</a>
        <img src="https://cdn.example.test/image.png">
        <script src="//cdn.example.test/app.js"></script>
        <source srcset="/local.webp 1x, https://cdn.example.test/remote.webp 2x">
        <link rel="stylesheet" href="https://cdn.example.test/site.css">
        <object data="https://cdn.example.test/object.bin"></object>
        <video poster="https://cdn.example.test/poster.jpg"></video>`,
      'icons/mark.svg': `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <image xlink:href="https://cdn.example.test/mark.png" />
      </svg>`,
    })

    const violations = await scanDirectoryForExternalResources(root)

    expect(violations).toEqual(expect.arrayContaining([
      expect.stringContaining('index.html: img src'),
      expect.stringContaining('index.html: script src'),
      expect.stringContaining('index.html: source srcset'),
      expect.stringContaining('index.html: link href'),
      expect.stringContaining('index.html: object data'),
      expect.stringContaining('index.html: video poster'),
      expect.stringContaining('icons/mark.svg: image xlink:href'),
    ]))
    expect(violations.some((violation) => violation.includes('anchor'))).toBe(false)
  })

  it('decodes markup character references before classifying resource URLs', async () => {
    const root = await fixture({
      'index.html': `<img src="https&#58;//cdn.example.test/encoded.png">
        <script src="&#x2f;&#x2f;cdn.example.test/encoded.js"></script>`,
    })

    const violations = await scanDirectoryForExternalResources(root)

    expect(violations).toEqual(expect.arrayContaining([
      expect.stringContaining('index.html: img src'),
      expect.stringContaining('index.html: script src'),
    ]))
  })

  it('rejects external URLs in SVG presentation attributes', async () => {
    const root = await fixture({
      'icons/paint.svg': `<svg xmlns="http://www.w3.org/2000/svg">
        <rect fill="url(https://cdn.example.test/paint.svg#p)"
          filter="url(&#x2f;&#x2f;cdn.example.test/filter.svg#f)" />
      </svg>`,
    })

    const violations = await scanDirectoryForExternalResources(root)

    expect(violations).toEqual(expect.arrayContaining([
      expect.stringContaining('icons/paint.svg: rect fill'),
      expect.stringContaining('icons/paint.svg: rect filter'),
    ]))
  })

  it('rejects remote CSS imports and URLs in CSS files and inline styles', async () => {
    const root = await fixture({
      'assets/site.css': `@import "//cdn.example.test/base.css";
        .remote { background-image: url(https://cdn.example.test/background.png); }
        .local { mask-image: url('/assets/mask.svg#shape'); }`,
      'index.html': `<style>.remote { src: url('https://cdn.example.test/font.woff2'); }</style>`,
    })

    const violations = await scanDirectoryForExternalResources(root)

    expect(violations).toEqual(expect.arrayContaining([
      expect.stringContaining('assets/site.css: css @import'),
      expect.stringContaining('assets/site.css: css url()'),
      expect.stringContaining('index.html: css url()'),
    ]))
  })

  it('allows local, fragment, and deliberately inlined data assets', async () => {
    const root = await fixture({
      'index.html': `<img src="./image.png"><img src="/assets/root.png">
        <img src="data:image/png;base64,AAAA"><svg><use href="#symbol"></use></svg>
        <a href="https://example.test/source">Public source</a>`,
      'assets/site.css': `.local { background: url(../image.png); }
        .inline { background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E"); }`,
    })

    await expect(scanDirectoryForExternalResources(root)).resolves.toEqual([])
  })
})
