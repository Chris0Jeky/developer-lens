import { readFile, readdir } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import type { DashboardData, RangeKey } from '../shared/types.js'
import { buildShareCardSvg } from '../src/lib/shareCardMarkup.js'
import { createShareCaption, createSharePayload } from '../src/lib/sharePayload.js'
import { buildStandaloneReport } from '../src/lib/standaloneReport.js'

const publicData = resolve('public', 'data')
const dist = resolve('dist')
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt'])
const forbiddenPatterns = [
  { label: 'GitHub token prefix', pattern: /\b(?:github_pat_|gh[pousr]_)\w+/i },
  { label: 'private key material', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: 'Windows user path', pattern: /[A-Z]:\\Users\\/i },
  { label: 'local file URL', pattern: /file:\/\/\/[A-Z]:\//i },
]

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? filesBelow(path) : Promise.resolve([path])
    }),
  )
  return files.flat()
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

for (const range of ['6m', '12m'] as RangeKey[]) {
  const path = join(publicData, `dashboard-${range}.json`)
  const dashboard = JSON.parse(await readFile(path, 'utf8')) as DashboardData
  assert(dashboard.meta.privacy === 'public-demo', `${range}: privacy marker is not public-demo`)
  assert(dashboard.meta.mode === 'demo', `${range}: mode is not demo`)
  assert(dashboard.meta.subject.login === 'synthetic-builder', `${range}: subject is not synthetic`)
  assert(
    dashboard.repositories.every(
      (repository) => repository.nameWithOwner.startsWith('local/') && !repository.url,
    ),
    `${range}: a repository contains a non-synthetic owner or URL`,
  )
  assert(
    dashboard.pullRequests.every((pullRequest) => !pullRequest.url),
    `${range}: a pull request contains a URL`,
  )

  const sharePayload = createSharePayload(dashboard)
  const shareOutput = [
    JSON.stringify(sharePayload),
    createShareCaption(sharePayload, 'professional'),
    buildShareCardSvg(sharePayload),
    buildStandaloneReport(sharePayload),
  ].join('\n')
  assert(sharePayload.scope === 'public-demo', `${range}: share scope is not public-demo`)
  assert(
    !dashboard.repositories.some(
      (repository) =>
        shareOutput.includes(repository.nameWithOwner) || shareOutput.includes(repository.displayName),
    ),
    `${range}: a repository identity escaped into the public share output`,
  )
  assert(
    !dashboard.pullRequests.some((pullRequest) => shareOutput.includes(pullRequest.title)),
    `${range}: a pull request title escaped into the public share output`,
  )
  assert(!/<script\b/i.test(shareOutput), `${range}: public share output contains a script`)
}

const socialCard = await readFile(join(dist, 'social-card.png'))
assert(
  socialCard.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'social card is not a PNG',
)
assert(socialCard.readUInt32BE(16) === 1200, 'social card width is not 1200px')
assert(socialCard.readUInt32BE(20) === 630, 'social card height is not 630px')

for (const path of await filesBelow(dist)) {
  if (!textExtensions.has(extname(path))) continue
  const content = await readFile(path, 'utf8')
  for (const forbidden of forbiddenPatterns) {
    assert(!forbidden.pattern.test(content), `${forbidden.label} found in ${path}`)
  }
}

console.log(
  'Verified synthetic identities, share/export boundaries, social card dimensions, and secret/path patterns in showcase output.',
)
