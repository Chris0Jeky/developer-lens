import { readFile, readdir } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import type { DashboardData, RangeKey } from '../shared/types.js'
import { buildShareCardSvg } from '../src/lib/shareCardMarkup.js'
import { createPortableExportPayload } from '../src/lib/portableExportPayload.js'
import { buildPortableExperienceReport } from '../src/lib/portableExportReport.js'
import { createShareCaption, createSharePayload } from '../src/lib/sharePayload.js'
import { buildStandaloneReport } from '../src/lib/standaloneReport.js'
import {
  APPROVED_SHOWCASE_REPOSITORY_NAMES,
  isApprovedShowcaseRepositoryIdentity,
  isApprovedShowcaseRepositoryName,
} from './showcasePrivacyPolicy.js'

const publicData = resolve('public', 'data')
const dist = resolve('dist')
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt'])
const forbiddenPatterns: { label: string; pattern: RegExp }[] = [
  { label: 'GitHub token prefix', pattern: /\b(?:github_pat_|gh[pousr]_)\w+/i },
  { label: 'private key material', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: 'Windows user path', pattern: /[A-Z]:\\Users\\/i },
  { label: 'local file URL', pattern: /file:\/\/\/[A-Z]:\//i },
  { label: 'V2 bridge bearer variable', pattern: /(?:VITE_)?DEVELOPER_LENS_V2_TOKEN/ },
]

/**
 * Vite inlines `import.meta.env.VITE_*` at build time, so a showcase built on a
 * machine that has the V2 bridge bearer exported would ship the literal token
 * in its JavaScript. When such a value is present in this environment, its
 * exact text becomes a forbidden pattern too — the name-based rule above cannot
 * catch an inlined value, because the name is what the inlining removes.
 */
function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\-]/g, '\\$&')
}

for (const variable of ['VITE_DEVELOPER_LENS_V2_TOKEN', 'DEVELOPER_LENS_V2_TOKEN'] as const) {
  const value = process.env[variable]
  if (value && value.length >= 8) {
    forbiddenPatterns.push({
      label: `${variable} value`,
      pattern: new RegExp(escapeForRegExp(value)),
    })
  }
}

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
  const dashboardRepositoryNames = dashboard.repositories.map(
    (repository) => repository.displayName,
  )
  assert(
    dashboard.repositories.length === APPROVED_SHOWCASE_REPOSITORY_NAMES.length &&
      new Set(dashboardRepositoryNames).size === APPROVED_SHOWCASE_REPOSITORY_NAMES.length &&
      dashboard.repositories.every(
        (repository) =>
          isApprovedShowcaseRepositoryIdentity(
            repository.nameWithOwner,
            repository.displayName,
          ) && !repository.url,
      ),
    `${range}: repository identities do not exactly match the canonical synthetic showcase set`,
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

  for (const artifact of ['dashboard', 'wrapped'] as const) {
    const portablePayload = createPortableExportPayload(dashboard, {
      aliasSeed: `synthetic-showcase-${range}`,
      artifact,
      repositoryRedaction: 'private-aliases',
    })
    const portableOutput = buildPortableExperienceReport(portablePayload)
    const portableRepositoryNames = portablePayload.repositories.map(
      (repository) => repository.label,
    )
    assert(portablePayload.scope === 'public-demo', `${range}: portable scope is not public-demo`)
    assert(
      portablePayload.repositories.length === APPROVED_SHOWCASE_REPOSITORY_NAMES.length &&
        new Set(portableRepositoryNames).size === APPROVED_SHOWCASE_REPOSITORY_NAMES.length &&
        portablePayload.repositories.every(
          (repository) =>
            repository.disclosure === 'synthetic' &&
            isApprovedShowcaseRepositoryName(repository.label),
        ),
      `${range}: a portable repository is not a canonical synthetic showcase identity`,
    )
    assert(
      !dashboard.pullRequests.some((pullRequest) => portableOutput.includes(pullRequest.title)),
      `${range}: a pull request title escaped into the portable ${artifact}`,
    )
    assert(
      !portableOutput.includes(dashboard.meta.subject.login) &&
        !portableOutput.includes(dashboard.meta.generatedAt),
      `${range}: identity or exact generation time escaped into the portable ${artifact}`,
    )
    assert(!/<script\b/i.test(portableOutput), `${range}: portable ${artifact} contains a script`)
    assert(!/<(?:img|link)\b/i.test(portableOutput), `${range}: portable ${artifact} references an asset`)
    if (artifact === 'wrapped') {
      assert(
        portableOutput.includes('data-chapter="9"'),
        `${range}: portable Wrapped does not contain all nine chapters`,
      )
    }
  }
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
  'Verified synthetic identities, summary and full-experience export boundaries, social card dimensions, and secret/path patterns in showcase output.',
)
