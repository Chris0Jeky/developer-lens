import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface HostingManifestTask {
  readonly id: string
  readonly acceptance: string
}

interface HostingManifest {
  readonly tasks: readonly HostingManifestTask[]
}

const expectedDl2Acceptance =
  'No .developer-lens data, tokens, private or source-derived repository URLs or local paths enter the deploy output; the deliberate public source-code link remains allowed'

describe('hosted showcase deployment contract', () => {
  it('narrows DL2 without banning the deliberate public source-code link', () => {
    const manifest = JSON.parse(
      readFileSync(resolve('.hosting', 'manifest.json'), 'utf8'),
    ) as HostingManifest
    const dl2 = manifest.tasks.find((task) => task.id === 'DL2')

    expect(dl2?.acceptance).toBe(expectedDl2Acceptance)
  })

  it('verifies the locked Observatory artifact after the showcase build and before upload', () => {
    const workflow = readFileSync(resolve('.github', 'workflows', 'pages.yml'), 'utf8')
    const showcaseBuild = workflow.indexOf('run: npm run build:showcase')
    const observatoryCheck = workflow.indexOf('run: node observatory/check.mjs')
    const pagesUpload = workflow.indexOf('uses: actions/upload-pages-artifact@v5')

    expect(showcaseBuild).toBeGreaterThanOrEqual(0)
    expect(observatoryCheck).toBeGreaterThan(showcaseBuild)
    expect(pagesUpload).toBeGreaterThan(observatoryCheck)
    expect(workflow.match(/run: node observatory\/check\.mjs/g)).toHaveLength(1)
  })
})
