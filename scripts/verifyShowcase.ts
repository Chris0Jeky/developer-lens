import { readFile, readdir } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import type { DashboardData, RangeKey } from '../shared/types.js'
import { analyticReferenceId } from '../shared/findings.js'
import { INTEGRATION_SHAPE_SCOPE_ALIAS } from '../shared/integrationShape.js'
import {
  parseIntegrationShapePresentationEnvelope,
} from '../shared/integrationShapeStoredPresentation.js'
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
  {
    label: 'V2 bridge bearer environment object',
    pattern: /["'`]?(?:VITE_)?DEVELOPER_LENS_V2_TOKEN["'`]?\s*[:=]/,
  },
  // Native-dependency markers. The showcase bundle must stay native-free: server storage loads
  // `better-sqlite3` (and, in adjacent work, DuckDB) native bindings, and the client is meant to
  // import server code TYPE-ONLY so those never reach the browser bundle. If any of these strings
  // reach an emitted `dist` asset, a value-import of native server code slipped past `tsc -b`, and
  // this check fails the showcase build. Only literal package/binding/tool identifiers are used —
  // `better-sqlite3` (npm id), `better_sqlite3` (the compiled `.node` binding name), `duckdb`, and
  // `node-gyp` — none of which can legitimately appear in this app's emitted output. Deliberately
  // NOT included: generic words like `bindings` or `prebuild`, which risk false positives against
  // minified third-party JS in the bundle.
  { label: 'better-sqlite3 native driver', pattern: /better-sqlite3/i },
  { label: 'better_sqlite3 native binding', pattern: /better_sqlite3/i },
  { label: 'duckdb native driver', pattern: /duckdb/i },
  { label: 'node-gyp native build', pattern: /node-gyp/i },
]

/**
 * Vite inlines `import.meta.env.VITE_*` at build time, so a showcase built on a
 * machine that has the V2 bridge bearer exported ships the literal token inside
 * its JavaScript — measured: the value lands in the request headers, and the
 * variable name never survives. A bare name pattern would therefore detect
 * nothing while falsely matching the cockpit's own instructional copy, which
 * names both variables on screen; the rule above only matches an emitted env
 * object, and the real detector is the value itself. When a bearer is present
 * in this environment, its exact text becomes a forbidden pattern too.
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

const integrationShape = parseIntegrationShapePresentationEnvelope(
  JSON.parse(await readFile(join(publicData, 'integration-shape.json'), 'utf8')) as unknown,
)
assert(integrationShape.mode === 'synthetic', 'Integration Shape public bundle is not explicitly synthetic')
assert(integrationShape.storedObservation.status === 'complete', 'Stored observation public bundle abstained')
assert(
  integrationShape.storedObservation.presentation.mode === 'synthetic',
  'Stored observation public presentation is not explicitly synthetic',
)
const legacyReferences = [
  ...integrationShape.presentation.finding.marks.map((mark) => mark.reference),
  ...integrationShape.presentation.finding.evidence,
  ...integrationShape.presentation.finding.counterEvidence,
]
const storedObservationReferences = [
  ...integrationShape.storedObservation.finding.marks.map((mark) => mark.reference),
  ...integrationShape.storedObservation.finding.evidence,
  ...integrationShape.storedObservation.finding.counterEvidence,
]
const renderedReferences = [...legacyReferences, ...storedObservationReferences]
for (const reference of renderedReferences) {
  assert(
    integrationShape.resolutions[analyticReferenceId(reference)] !== undefined,
    `Integration Shape reference ${analyticReferenceId(reference)} has no exported resolution`,
  )
}
const integrationShapeText = JSON.stringify(integrationShape)
for (const forbidden of [
  'scope_alias',
  'coverage_id',
  'coverageId',
  'storePath',
  'selectedArtifactId',
  'snapshotId',
]) {
  assert(!integrationShapeText.includes(`"${forbidden}"`), `Integration Shape exports forbidden field ${forbidden}`)
}

function fieldOccurrences(
  candidate: unknown,
  field: string,
  path: readonly string[] = [],
): Array<{ readonly path: readonly string[]; readonly value: unknown }> {
  if (Array.isArray(candidate)) {
    return candidate.flatMap((value, index) => fieldOccurrences(value, field, [...path, String(index)]))
  }
  if (candidate === null || typeof candidate !== 'object') return []
  return Object.entries(candidate).flatMap(([key, value]) => [
    ...(key === field ? [{ path: [...path, key], value }] : []),
    ...fieldOccurrences(value, field, [...path, key]),
  ])
}

const legacyReferenceIds = new Set(legacyReferences.map(analyticReferenceId))
for (const occurrence of fieldOccurrences(integrationShape, 'scopeAlias')) {
  const [root, referenceId] = occurrence.path
  const allowedLegacySyntheticField = occurrence.value === INTEGRATION_SHAPE_SCOPE_ALIAS
    && (root === 'presentation' || (root === 'resolutions' && legacyReferenceIds.has(referenceId ?? '')))
  assert(
    allowedLegacySyntheticField,
    `Integration Shape exports scopeAlias outside the frozen invented Atlas fixture at ${occurrence.path.join('.')}`,
  )
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
