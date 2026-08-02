import { readFile, readdir } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import type { DashboardData, RangeKey } from '../shared/types.js'

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
}

for (const path of await filesBelow(dist)) {
  if (!textExtensions.has(extname(path))) continue
  const content = await readFile(path, 'utf8')
  for (const forbidden of forbiddenPatterns) {
    assert(!forbidden.pattern.test(content), `${forbidden.label} found in ${path}`)
  }
}

console.log('Verified synthetic identities, URL boundaries, and secret/path patterns in showcase output.')
