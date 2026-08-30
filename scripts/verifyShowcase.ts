import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { DashboardData, RangeKey } from '../shared/types.js'
import { buildShareCardSvg } from '../src/lib/shareCardMarkup.js'
import { createPortableExportPayload } from '../src/lib/portableExportPayload.js'
import { buildPortableExperienceReport } from '../src/lib/portableExportReport.js'
import { createShareCaption, createSharePayload } from '../src/lib/sharePayload.js'
import { buildStandaloneReport } from '../src/lib/standaloneReport.js'
import {
  createPrivacyControlDashboard,
  createForbiddenPatterns,
  portablePayloadBoundaryViolations,
  renderedPortableBoundaryViolations,
  renderedShareBoundaryViolations,
  scanDirectoryForForbiddenPatterns,
  sharePayloadBoundaryViolations,
} from './exportPrivacyGuards.js'
import {
  APPROVED_SHOWCASE_REPOSITORY_NAMES,
  isApprovedShowcaseRepositoryIdentity,
  isApprovedShowcaseRepositoryName,
} from './showcasePrivacyPolicy.js'

const publicData = resolve('public', 'data')
const dist = resolve('dist')

// The forbidden-pattern set and the structural share/portable boundary assertions live in
// `exportPrivacyGuards.ts` so the headless artifact exporter (`scripts/exportArtifacts.ts`)
// runs exactly this scan over exactly these invariants instead of a drifting second copy.
const forbiddenPatterns = createForbiddenPatterns()

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertNoViolations(violations: readonly string[]): void {
  assert(violations.length === 0, violations.join('; '))
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
  const shareControlDashboard = createPrivacyControlDashboard(dashboard, {
    repositoryIdentities: true,
    pullRequestTitles: true,
  })
  const shareControlPayload = createSharePayload(shareControlDashboard)
  assert(sharePayload.scope === 'public-demo', `${range}: share scope is not public-demo`)
  assertNoViolations(sharePayloadBoundaryViolations(range, sharePayload, shareControlPayload))
  assertNoViolations(renderedShareBoundaryViolations(range, shareOutput))

  for (const artifact of ['dashboard', 'wrapped'] as const) {
    const portablePayload = createPortableExportPayload(dashboard, {
      aliasSeed: `synthetic-showcase-${range}`,
      artifact,
      repositoryRedaction: 'private-aliases',
    })
    const portableOutput = buildPortableExperienceReport(portablePayload)
    const portableControlDashboard = createPrivacyControlDashboard(dashboard, {
      pullRequestTitles: true,
      subjectLogin: true,
      generatedAt: true,
    })
    const portableControlPayload = createPortableExportPayload(portableControlDashboard, {
      aliasSeed: `synthetic-showcase-${range}`,
      artifact,
      repositoryRedaction: 'private-aliases',
    })
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
    assertNoViolations(
      portablePayloadBoundaryViolations(
        `${range} portable ${artifact}`,
        portablePayload,
        portableControlPayload,
        false,
      ),
    )
    assertNoViolations(renderedPortableBoundaryViolations(`${range} portable ${artifact}`, portableOutput))
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

assertNoViolations((await scanDirectoryForForbiddenPatterns(dist, forbiddenPatterns)).violations)

console.log(
  'Verified synthetic identities, summary and full-experience export boundaries, social card dimensions, and secret/path patterns in showcase output.',
)
