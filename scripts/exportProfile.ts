import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZodError } from 'zod'
import { PublicLensProjectionSchema, type PublicLensProjection } from '../shared/lensProjection.js'
import { stableJson } from '../shared/researchFinding.js'
import type { DashboardData, RangeKey } from '../shared/types.js'
import { createPortableExportSeed, type RepositoryRedaction } from '../src/lib/portableExportPayload.js'
import { createPublicLensProjectionFromDashboard } from '../src/lib/publicLensProjection.js'
import {
  ACKNOWLEDGE_REDACTION_FLAG,
  ArtifactExportError,
  loadLocalDashboard,
  pending,
  planOutputDirectory,
  writeExportSet,
} from './exportArtifacts.js'
import { createPublicShowcaseDashboard } from './exportDemo.js'
import { lensProducerVersion } from './generateLensProjection.js'
import {
  createForbiddenPatterns,
  createPrivacyControlDashboard,
  scanDirectoryForForbiddenPatterns,
} from './exportPrivacyGuards.js'
import { isApprovedShowcaseRepositoryName } from './showcasePrivacyPolicy.js'

/**
 * Headless `PublicLensProjection.v1` export (`npm run export:profile`).
 *
 * The projection goes through the same Export sink as `export:artifacts`: built in memory,
 * validated against the full contract (schema, semantics, projectionHash, denied content),
 * differentially checked against canary-substituted source identities, pattern-scanned, written
 * with a manifest, replaced only where a previous manifest owns the file, and rescanned after the
 * write. `--source showcase` is C0 invented data. `--source local` is the owner's C1
 * `redacted-local` projection: it requires `--acknowledge-redaction`, defaults to
 * `private-aliases`, and is never a Pages artifact.
 */

export const DEFAULT_PROFILE_DIRECTORY = 'profile-export'
export const PROFILE_ARTIFACT_FILE = 'lens-profile.v1.json'

export type ProfileSource = 'showcase' | 'local'

export interface ExportProfileOptions {
  outputDirectory: string
  source: ProfileSource
  range: RangeKey
  repositoryRedaction: RepositoryRedaction
  acknowledgeRedaction?: boolean
  /** Injected so tests never read `.developer-lens/`. */
  loadDashboard: (range: RangeKey) => Promise<DashboardData>
  aliasSeed?: string
  /** The 40-hex commit the projection names; resolved only after every refusal check. */
  resolveProducerCommit: () => string
  producerVersion: string
  env?: Readonly<Record<string, string | undefined>>
  postWriteScanner?: typeof scanDirectoryForForbiddenPatterns
  removeFile?: (path: string) => Promise<void>
}

export interface ExportProfileResult {
  source: ProfileSource
  scope: 'public-demo' | 'redacted-local'
  dataClass: 'C0' | 'C1'
  outputDirectory: string
  file: string
  projectionHash: string
  artifacts: Array<{ file: string; bytes: number }>
  privacyScan: { patternCount: number; filesScanned: number; status: 'passed' }
}

/** Issue paths and codes only: a contract failure message must never echo a source value. */
function contractFailure(error: unknown): ArtifactExportError {
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => {
      const where = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      return issue.code === 'custom' ? `${where}: ${issue.message}` : `${where}: ${issue.code}`
    })
    return new ArtifactExportError(`refused: the projection failed PublicLensProjection.v1: ${[...new Set(issues)].join('; ')}`)
  }
  return new ArtifactExportError('refused: the projection could not be built')
}

/**
 * Replace every identity the projection must not carry with a content-free canary. A projection
 * that does not depend on those source values is byte-identical to the one built from the control.
 * Under `private-aliases` only private repositories are canaried, because public names are
 * disclosed by design; under `all-aliases` every repository is.
 */
function profileControlDashboard(dashboard: DashboardData, redaction: RepositoryRedaction, local: boolean): DashboardData {
  const control = createPrivacyControlDashboard(dashboard, { pullRequestTitles: true, subjectLogin: true })
  if (local) {
    control.repositories = control.repositories.map((repository, index) =>
      redaction === 'all-aliases' || repository.isPrivate
        ? {
            ...repository,
            nameWithOwner: `__developer_lens_profile_control_repository_name_${index}__`,
            displayName: `__developer_lens_profile_control_repository_display_${index}__`,
          }
        : repository,
    )
  }
  return control
}

function readProjection(dashboard: DashboardData, options: ExportProfileOptions, aliasSeed: string, producerCommit: string): PublicLensProjection {
  try {
    return createPublicLensProjectionFromDashboard(dashboard, {
      aliasSeed,
      repositoryRedaction: options.repositoryRedaction,
      producerCommit,
      producerVersion: options.producerVersion,
    }).projection
  } catch (error) {
    throw contractFailure(error)
  }
}

export async function exportProfile(options: ExportProfileOptions): Promise<ExportProfileResult> {
  if (options.source === 'local' && !options.acknowledgeRedaction) {
    throw new ArtifactExportError(`refused: a local profile export requires ${ACKNOWLEDGE_REDACTION_FLAG}`)
  }
  const patterns = createForbiddenPatterns(options.env ?? process.env)
  const outputDirectory = resolve(options.outputDirectory)
  const plan = await planOutputDirectory(outputDirectory)

  const dashboard = await options.loadDashboard(options.range)
  const publicDemo = dashboard.meta.privacy === 'public-demo'
  if (options.source === 'showcase' && !publicDemo) {
    throw new ArtifactExportError(`refused: the ${options.range} showcase dashboard is not marked public-demo`)
  }
  if (options.source === 'local' && publicDemo) {
    throw new ArtifactExportError(`refused: the ${options.range} local dashboard is marked public-demo; use --source showcase`)
  }

  let producerCommit: string
  try {
    producerCommit = options.resolveProducerCommit().trim()
  } catch {
    producerCommit = ''
  }
  if (!/^[0-9a-f]{40}$/.test(producerCommit)) {
    throw new ArtifactExportError('refused: the producer commit is unavailable; run from a Developer Lens Git checkout')
  }

  const aliasSeed = options.aliasSeed ?? `synthetic-showcase-${options.range}`
  const projection = readProjection(dashboard, options, aliasSeed, producerCommit)
  const control = readProjection(
    profileControlDashboard(dashboard, options.repositoryRedaction, options.source === 'local'),
    options,
    aliasSeed,
    producerCommit,
  )

  const violations: string[] = []
  if (JSON.stringify(projection) !== JSON.stringify(control)) {
    violations.push(`${PROFILE_ARTIFACT_FILE}: projection depends on a prohibited repository identity, title, or subject`)
  }
  const expectedClass = options.source === 'showcase' ? 'C0' : 'C1'
  if (projection.dataClass !== expectedClass) {
    violations.push(`${PROFILE_ARTIFACT_FILE}: ${options.source} export must be ${expectedClass}`)
  }
  if (
    options.source === 'showcase' &&
    !projection.repositories.every((repository) => repository.disclosure === 'synthetic' && isApprovedShowcaseRepositoryName(repository.label))
  ) {
    violations.push(`${PROFILE_ARTIFACT_FILE}: a showcase repository is not a canonical synthetic identity`)
  }

  const artifact = pending(PROFILE_ARTIFACT_FILE, 'lens-projection', options.range, stableJson(projection))
  const baseScanner = options.postWriteScanner ?? scanDirectoryForForbiddenPatterns
  // The post-write pass also re-reads the written projection and re-runs the full contract on the
  // bytes that actually landed, so a write-path corruption cannot leave an invalid file behind.
  const postWriteScanner: typeof scanDirectoryForForbiddenPatterns = async (directory, scanPatterns) => {
    const scan = await baseScanner(directory, scanPatterns)
    let valid = false
    try {
      valid = PublicLensProjectionSchema.safeParse(JSON.parse(await readFile(join(directory, PROFILE_ARTIFACT_FILE), 'utf8'))).success
    } catch {
      valid = false
    }
    return valid
      ? scan
      : { ...scan, violations: [...scan.violations, `${PROFILE_ARTIFACT_FILE}: written projection failed PublicLensProjection.v1`] }
  }

  const written = await writeExportSet({
    outputDirectory,
    plan,
    artifacts: [artifact],
    violations,
    patterns,
    manifest: {
      source: options.source,
      scope: projection.scope,
      ranges: [options.range],
      repositoryRedaction: projection.repositoryRedaction,
    },
    postWriteScanner,
    removeFile: options.removeFile,
  })

  return {
    source: options.source,
    scope: projection.scope,
    dataClass: projection.dataClass,
    outputDirectory,
    file: PROFILE_ARTIFACT_FILE,
    projectionHash: projection.provenance.projectionHash,
    artifacts: written.artifacts.map(({ file, bytes }) => ({ file, bytes })),
    privacyScan: { patternCount: patterns.length, filesScanned: written.filesScanned, status: 'passed' },
  }
}

export const EXPORT_PROFILE_HELP = [
  'usage: npm run export:profile -- [options]',
  '',
  `  --out <dir>                  output directory (default: ${DEFAULT_PROFILE_DIRECTORY})`,
  '  --source <showcase|local>    showcase = C0 synthetic; local = C1 redacted-local (default: showcase)',
  '  --range <6m|12m>             one range (default: 12m)',
  '  --repository-redaction <private-aliases|all-aliases>',
  '                               local only; defaults to private-aliases',
  `  ${ACKNOWLEDGE_REDACTION_FLAG}     required for --source local`,
  '',
  `Writes ${PROFILE_ARTIFACT_FILE} (PublicLensProjection.v1) plus an export manifest. The showcase`,
  'projection is invented data. A local projection describes private activity in aggregate: review',
  'it before committing it anywhere; aliases reduce identification but are not anonymity.',
].join('\n')

interface ParsedInvocation {
  outputDirectory: string
  source: ProfileSource
  range: RangeKey
  repositoryRedaction: RepositoryRedaction
  acknowledgedRedaction: boolean
}

function parseInvocation(argv: readonly string[]): { ok: true; invocation: ParsedInvocation } | { ok: false; message: string } {
  let outputDirectory = DEFAULT_PROFILE_DIRECTORY
  let source: ProfileSource = 'showcase'
  let range: RangeKey | undefined
  let repositoryRedaction: RepositoryRedaction | undefined
  let acknowledgedRedaction = false

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const matches = (name: string): boolean => argument === name || argument.startsWith(`${name}=`)
    const value = (name: string): string | undefined => (argument === name ? argv[index + 1] : argument.slice(`${name}=`.length))
    const consume = (name: string): void => {
      if (argument === name) index += 1
    }

    if (argument === ACKNOWLEDGE_REDACTION_FLAG) {
      acknowledgedRedaction = true
    } else if (matches('--out')) {
      const directory = value('--out')
      if (!directory) return { ok: false, message: 'refused: --out needs a directory' }
      outputDirectory = directory
      consume('--out')
    } else if (matches('--source')) {
      const selected = value('--source')
      if (selected !== 'showcase' && selected !== 'local') return { ok: false, message: 'refused: --source must be showcase or local' }
      source = selected
      consume('--source')
    } else if (matches('--range')) {
      const selected = value('--range')
      if (selected !== '6m' && selected !== '12m') return { ok: false, message: 'refused: --range must be 6m or 12m' }
      if (range && range !== selected) return { ok: false, message: 'refused: a profile export takes exactly one --range' }
      range = selected
      consume('--range')
    } else if (matches('--repository-redaction')) {
      const selected = value('--repository-redaction')
      if (selected !== 'private-aliases' && selected !== 'all-aliases') {
        return { ok: false, message: 'refused: --repository-redaction must be private-aliases or all-aliases' }
      }
      repositoryRedaction = selected
      consume('--repository-redaction')
    } else {
      // Echo only an option name followed by `=`; anything else is reported by position.
      const optionName = /^--[a-z0-9][a-z0-9-]*(?==)/i.exec(argument)?.[0]
      return {
        ok: false,
        message: optionName ? `refused: unknown option ${optionName}` : `refused: unexpected argument at position ${index + 1}`,
      }
    }
  }

  if (source === 'local' && !acknowledgedRedaction) {
    return {
      ok: false,
      message:
        'refused: a local profile export is the C1 redacted-local projection of private Developer ' +
        `Lens data. Re-run with ${ACKNOWLEDGE_REDACTION_FLAG} once you accept that aggregate numbers ` +
        'can still describe your activity. See docs/data-charter.md and the README "Export deliberately" section.',
    }
  }
  if (source === 'showcase' && repositoryRedaction) {
    return { ok: false, message: 'refused: --repository-redaction applies only to --source local' }
  }
  return {
    ok: true,
    invocation: {
      outputDirectory,
      source,
      range: range ?? '12m',
      repositoryRedaction: repositoryRedaction ?? 'private-aliases',
      acknowledgedRedaction,
    },
  }
}

function gitHeadCommit(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

/** Returns the process exit code; never throws for a refused invocation. */
export async function runExportProfileCli(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  log: (line: string) => void,
  seams: {
    loadDashboard?: (range: RangeKey) => Promise<DashboardData>
    resolveProducerCommit?: () => string
    producerVersion?: string
  } = {},
): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    log(EXPORT_PROFILE_HELP)
    return 0
  }
  const parsed = parseInvocation(argv)
  if (!parsed.ok) {
    log(parsed.message)
    log(EXPORT_PROFILE_HELP)
    return 1
  }
  const { invocation } = parsed
  const local = invocation.source === 'local'
  try {
    const result = await exportProfile({
      outputDirectory: invocation.outputDirectory,
      source: invocation.source,
      range: invocation.range,
      repositoryRedaction: invocation.repositoryRedaction,
      acknowledgeRedaction: invocation.acknowledgedRedaction,
      loadDashboard:
        seams.loadDashboard ??
        (local ? loadLocalDashboard : (range) => Promise.resolve(createPublicShowcaseDashboard(range))),
      aliasSeed: local ? createPortableExportSeed() : `synthetic-showcase-${invocation.range}`,
      resolveProducerCommit: seams.resolveProducerCommit ?? gitHeadCommit,
      producerVersion: seams.producerVersion ?? lensProducerVersion(),
      env,
    })
    for (const artifact of result.artifacts) log(`${artifact.file}\t${artifact.bytes} bytes`)
    log(`Wrote a ${result.dataClass} ${result.scope} PublicLensProjection.v1 to ${result.outputDirectory}`)
    log(`projectionHash ${result.projectionHash}`)
    log(`Privacy scan passed: ${result.privacyScan.patternCount} forbidden patterns over ${result.privacyScan.filesScanned} written files.`)
    if (local) {
      log('This projection describes private activity in aggregate. Review it before committing it anywhere; it is never a Pages artifact.')
    }
    return 0
  } catch (error) {
    log(error instanceof ArtifactExportError ? error.message : `failed: ${(error as Error).name}`)
    return 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runExportProfileCli(process.argv.slice(2), process.env, (line) => {
    console.log(line)
  })
}
