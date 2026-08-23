import { readFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DashboardData, RangeKey } from '../shared/types.js'
import { dashboardPath } from '../server/dataStore.js'
import {
  createPortableExportPayload,
  createPortableExportSeed,
  type PortableArtifact,
  type RepositoryRedaction,
} from '../src/lib/portableExportPayload.js'
import { buildPortableExperienceReport } from '../src/lib/portableExportReport.js'
import { buildShareCardSvg } from '../src/lib/shareCardMarkup.js'
import {
  createShareCaption,
  createSharePayload,
  WRAPPED_CHAPTER_IDS,
  type ShareTone,
} from '../src/lib/sharePayload.js'
import { buildStandaloneReport } from '../src/lib/standaloneReport.js'
import { createPublicShowcaseDashboard, SHOWCASE_RANGES } from './exportDemo.js'
import {
  createForbiddenPatterns,
  dashboardRepositoryIdentities,
  forbiddenPatternViolations,
  portableBoundaryViolations,
  scanDirectoryForForbiddenPatterns,
  shareBoundaryViolations,
  type ForbiddenPattern,
} from './exportPrivacyGuards.js'

/**
 * Headless artifact export.
 *
 * The share, report, and portable-experience builders in `src/lib/` are pure string functions
 * with no DOM dependency, so the same artifacts a browser downloads from Share Studio can be
 * produced in Node. This command does that, then runs the showcase privacy scanner
 * (`exportPrivacyGuards.ts`, shared with `verifyShowcase.ts`) over everything before and after it
 * touches the disk.
 *
 * Two boundaries are deliberate:
 *
 * - Synthetic is the default and the only unattended mode. It is C0 invented data and safe to
 *   publish, exactly like `public/data`.
 * - Local export is gated. Share Studio disables every export action until the operator
 *   acknowledges a redacted preview (`exportAllowed = publicDemo || confirmed`), and a headless
 *   caller must not be able to slip past that. `--source local` therefore also requires
 *   `--acknowledge-redaction`, defaults to the stronger `all-aliases` redaction, and never writes
 *   the raw dashboard JSON: `docs/data-charter.md` binds the Export sink to a pre-redacted
 *   `ExportView`, and the local dashboard record is not one.
 */

export const ACKNOWLEDGE_REDACTION_FLAG = '--acknowledge-redaction'
export const DEFAULT_ARTIFACT_DIRECTORY = 'artifacts'
export const EXPORT_MANIFEST_FILE = 'export-manifest.json'

const SHARE_TONES: readonly ShareTone[] = Object.freeze(['story', 'professional', 'compact'])
const PORTABLE_ARTIFACTS: readonly PortableArtifact[] = Object.freeze(['dashboard', 'wrapped'])

export type ExportSource = 'synthetic' | 'local'

export type ArtifactKind =
  | 'share-card'
  | 'caption'
  | 'standalone-report'
  | 'portable-experience'
  | 'dashboard-data'
  | 'manifest'

export interface ExportedArtifact {
  file: string
  kind: ArtifactKind
  range: RangeKey | null
  bytes: number
}

export interface ExportArtifactsResult {
  source: ExportSource
  scope: 'public-demo' | 'redacted-local'
  outputDirectory: string
  artifacts: ExportedArtifact[]
  privacyScan: {
    patternCount: number
    filesScanned: number
    status: 'passed'
  }
}

export interface ExportArtifactsOptions {
  outputDirectory: string
  source: ExportSource
  ranges: readonly RangeKey[]
  repositoryRedaction: RepositoryRedaction
  /** Injected so tests can drive the pipeline without reading `.developer-lens/`. */
  loadDashboard: (range: RangeKey) => Promise<DashboardData>
  /** Fixed per range for a reproducible synthetic export; random for a local one. */
  aliasSeed?: (range: RangeKey) => string
  env?: Readonly<Record<string, string | undefined>>
}

/** A refusal or a tripped privacy boundary. Never carries a private value in its message. */
export class ArtifactExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArtifactExportError'
  }
}

interface PendingArtifact extends ExportedArtifact {
  content: string
}

function pending(
  file: string,
  kind: ArtifactKind,
  range: RangeKey | null,
  content: string,
): PendingArtifact {
  return { file, kind, range, bytes: Buffer.byteLength(content, 'utf8'), content }
}

function buildRangeArtifacts(
  dashboard: DashboardData,
  range: RangeKey,
  options: {
    source: ExportSource
    repositoryRedaction: RepositoryRedaction
    aliasSeed: string
  },
): { artifacts: PendingArtifact[]; violations: string[] } {
  const artifacts: PendingArtifact[] = []
  const violations: string[] = []

  const overview = createSharePayload(dashboard)
  const shareOutputs: PendingArtifact[] = [
    pending(`${overview.fileStem}.svg`, 'share-card', range, buildShareCardSvg(overview)),
    pending(
      `${overview.fileStem}-report.html`,
      'standalone-report',
      range,
      buildStandaloneReport(overview),
    ),
    ...SHARE_TONES.map((tone) =>
      pending(
        `${overview.fileStem}-caption-${tone}.txt`,
        'caption',
        range,
        `${createShareCaption(overview, tone)}\n`,
      ),
    ),
  ]

  for (const [index, chapterId] of WRAPPED_CHAPTER_IDS.entries()) {
    const chapter = createSharePayload(dashboard, {
      kind: 'wrapped',
      chapterId,
      chapterNumber: index + 1,
    })
    shareOutputs.push(
      pending(`${chapter.fileStem}.svg`, 'share-card', range, buildShareCardSvg(chapter)),
    )
  }

  for (const artifact of shareOutputs) {
    violations.push(...shareBoundaryViolations(artifact.file, dashboard, artifact.content))
  }
  artifacts.push(...shareOutputs)

  for (const artifact of PORTABLE_ARTIFACTS) {
    const payload = createPortableExportPayload(dashboard, {
      aliasSeed: options.aliasSeed,
      artifact,
      repositoryRedaction: options.repositoryRedaction,
    })
    const output = buildPortableExperienceReport(payload)
    const file = `${payload.fileStem}.html`
    violations.push(...portableBoundaryViolations(file, dashboard, output))
    if (payload.repositoryRedaction === 'all-aliases') {
      // The EFFECTIVE redaction, not the requested one: a public-demo payload resolves to
      // `synthetic` and legitimately keeps its approved invented names, and `private-aliases`
      // legitimately keeps public repository names. Only full aliasing promises no survivors.
      for (const identity of dashboardRepositoryIdentities(dashboard)) {
        if (output.includes(identity)) {
          violations.push(`${file}: a repository identity survived full aliasing`)
          break
        }
      }
    }
    if (artifact === 'wrapped' && !output.includes('data-chapter="9"')) {
      violations.push(`${file}: portable Wrapped does not contain all nine chapters`)
    }
    artifacts.push(pending(file, 'portable-experience', range, output))
  }

  if (options.source === 'synthetic') {
    // C0 invented data only. A local dashboard record is a source record, not an `ExportView`,
    // so the local lane deliberately has no equivalent file.
    artifacts.push(
      pending(
        `dashboard-${range}.json`,
        'dashboard-data',
        range,
        `${JSON.stringify(dashboard, null, 2)}\n`,
      ),
    )
  }

  return { artifacts, violations }
}

async function assertWritableOutputDirectory(directory: string): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(directory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  if (entries.length === 0 || entries.includes(EXPORT_MANIFEST_FILE)) return
  throw new ArtifactExportError(
    `refused: the output directory is not empty and holds no ${EXPORT_MANIFEST_FILE}; ` +
      'point --out at a dedicated export directory',
  )
}

export async function exportArtifacts(
  options: ExportArtifactsOptions,
): Promise<ExportArtifactsResult> {
  const patterns: ForbiddenPattern[] = createForbiddenPatterns(options.env ?? process.env)
  const outputDirectory = resolve(options.outputDirectory)
  await assertWritableOutputDirectory(outputDirectory)

  const artifacts: PendingArtifact[] = []
  const violations: string[] = []
  const scopes = new Set<'public-demo' | 'redacted-local'>()

  for (const range of options.ranges) {
    const dashboard = await options.loadDashboard(range)
    const publicDemo = dashboard.meta.privacy === 'public-demo'
    if (options.source === 'synthetic' && !publicDemo) {
      throw new ArtifactExportError(
        `refused: the ${range} synthetic dashboard is not marked public-demo`,
      )
    }
    if (options.source === 'local' && publicDemo) {
      throw new ArtifactExportError(
        `refused: the ${range} local dashboard is marked public-demo; use --source synthetic`,
      )
    }
    scopes.add(publicDemo ? 'public-demo' : 'redacted-local')
    const built = buildRangeArtifacts(dashboard, range, {
      source: options.source,
      repositoryRedaction: options.repositoryRedaction,
      aliasSeed: options.aliasSeed?.(range) ?? `developer-lens-${range}`,
    })
    artifacts.push(...built.artifacts)
    violations.push(...built.violations)
  }

  if (artifacts.length === 0) {
    throw new ArtifactExportError('refused: no ranges were selected, so nothing would be written')
  }

  // Fail closed before a single byte reaches the disk.
  for (const artifact of artifacts) {
    violations.push(...forbiddenPatternViolations(artifact.file, artifact.content, patterns))
  }
  if (violations.length > 0) {
    throw new ArtifactExportError(`privacy scan failed: ${violations.join('; ')}`)
  }

  const scope = scopes.has('redacted-local') ? 'redacted-local' : 'public-demo'
  const manifest = {
    schemaVersion: 1,
    source: options.source,
    scope,
    ranges: [...options.ranges],
    repositoryRedaction: options.repositoryRedaction,
    privacyScan: {
      scanner: 'scripts/exportPrivacyGuards.ts',
      patternCount: patterns.length,
    },
    artifacts: artifacts.map(({ file, kind, range, bytes }) => ({ file, kind, range, bytes })),
  }
  const manifestArtifact = pending(
    EXPORT_MANIFEST_FILE,
    'manifest',
    null,
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  const manifestViolations = forbiddenPatternViolations(
    manifestArtifact.file,
    manifestArtifact.content,
    patterns,
  )
  if (manifestViolations.length > 0) {
    throw new ArtifactExportError(`privacy scan failed: ${manifestViolations.join('; ')}`)
  }
  artifacts.push(manifestArtifact)

  await rm(outputDirectory, { force: true, recursive: true })
  await mkdir(outputDirectory, { recursive: true })
  for (const artifact of artifacts) {
    await writeFile(join(outputDirectory, artifact.file), artifact.content, 'utf8')
  }

  // Second pass over what actually landed, using the same scanner the showcase build runs.
  const scan = await scanDirectoryForForbiddenPatterns(outputDirectory, patterns)
  if (scan.violations.length > 0) {
    await rm(outputDirectory, { force: true, recursive: true })
    throw new ArtifactExportError(
      `privacy scan failed after write: ${scan.violations.join('; ')}`,
    )
  }

  return {
    source: options.source,
    scope,
    outputDirectory,
    artifacts: artifacts.map(({ file, kind, range, bytes }) => ({ file, kind, range, bytes })),
    privacyScan: {
      patternCount: patterns.length,
      filesScanned: scan.filesScanned,
      status: 'passed',
    },
  }
}

async function loadLocalDashboard(range: RangeKey): Promise<DashboardData> {
  try {
    return JSON.parse(await readFile(dashboardPath(range), 'utf8')) as DashboardData
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // No path in the message: the logs/errors sink in docs/data-charter.md denies paths.
      throw new ArtifactExportError(
        `refused: no local ${range} dashboard exists; run npm run collect first`,
      )
    }
    throw new ArtifactExportError(`refused: the local ${range} dashboard could not be read`)
  }
}

export const EXPORT_ARTIFACTS_HELP = [
  'usage: npm run export:artifacts -- [options]',
  '',
  '  --out <dir>                  output directory (default: artifacts)',
  '  --source <synthetic|local>   dataset to export (default: synthetic)',
  '  --range <6m|12m>             repeatable; defaults to every supported range',
  '  --repository-redaction <private-aliases|all-aliases>',
  '                               local only; defaults to all-aliases',
  `  ${ACKNOWLEDGE_REDACTION_FLAG}     required for --source local`,
  '',
  'Synthetic is invented showcase data and safe to publish. A local export is derived from',
  'private data in the gitignored runtime directory: review every file before sharing it.',
].join('\n')

interface ParsedInvocation {
  outputDirectory: string
  source: ExportSource
  ranges: RangeKey[]
  repositoryRedaction: RepositoryRedaction
  acknowledgedRedaction: boolean
}

type ParseResult =
  | { ok: true; invocation: ParsedInvocation }
  | { ok: false; message: string }

function parseInvocation(argv: readonly string[]): ParseResult {
  let outputDirectory = DEFAULT_ARTIFACT_DIRECTORY
  let source: ExportSource = 'synthetic'
  let repositoryRedaction: RepositoryRedaction | undefined
  let acknowledgedRedaction = false
  const ranges = new Set<RangeKey>()

  const readValue = (argument: string, name: string, index: number): string | undefined =>
    argument === name ? argv[index + 1] : argument.slice(`${name}=`.length)

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const matches = (name: string): boolean =>
      argument === name || argument.startsWith(`${name}=`)

    if (argument === ACKNOWLEDGE_REDACTION_FLAG) {
      acknowledgedRedaction = true
    } else if (matches('--out')) {
      const value = readValue(argument, '--out', index)
      if (!value) return { ok: false, message: 'refused: --out needs a directory' }
      outputDirectory = value
      if (argument === '--out') index += 1
    } else if (matches('--source')) {
      const value = readValue(argument, '--source', index)
      if (value !== 'synthetic' && value !== 'local') {
        return { ok: false, message: 'refused: --source must be synthetic or local' }
      }
      source = value
      if (argument === '--source') index += 1
    } else if (matches('--range')) {
      const value = readValue(argument, '--range', index)
      if (value !== '6m' && value !== '12m') {
        return { ok: false, message: 'refused: --range must be 6m or 12m' }
      }
      ranges.add(value)
      if (argument === '--range') index += 1
    } else if (matches('--repository-redaction')) {
      const value = readValue(argument, '--repository-redaction', index)
      if (value !== 'private-aliases' && value !== 'all-aliases') {
        return {
          ok: false,
          message: 'refused: --repository-redaction must be private-aliases or all-aliases',
        }
      }
      repositoryRedaction = value
      if (argument === '--repository-redaction') index += 1
    } else {
      return { ok: false, message: `refused: unknown argument ${argument}` }
    }
  }

  if (source === 'local' && !acknowledgedRedaction) {
    return {
      ok: false,
      message:
        'refused: a local export is derived from private Developer Lens data. Share Studio ' +
        'disables every export until you acknowledge its redacted preview, and this command ' +
        `will not bypass that. Re-run with ${ACKNOWLEDGE_REDACTION_FLAG} once you accept that ` +
        'aggregate numbers can still describe your activity. See docs/data-charter.md and the ' +
        'README "Sharing and export" section.',
    }
  }
  if (source === 'synthetic' && repositoryRedaction) {
    return {
      ok: false,
      message: 'refused: --repository-redaction applies only to --source local',
    }
  }

  return {
    ok: true,
    invocation: {
      outputDirectory,
      source,
      ranges: ranges.size > 0 ? [...ranges] : [...SHOWCASE_RANGES],
      repositoryRedaction: repositoryRedaction ?? 'all-aliases',
      acknowledgedRedaction,
    },
  }
}

/** Returns the process exit code; never throws for a refused invocation. */
export async function runExportArtifactsCli(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  log: (line: string) => void,
): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    log(EXPORT_ARTIFACTS_HELP)
    return 0
  }
  const parsed = parseInvocation(argv)
  if (!parsed.ok) {
    log(parsed.message)
    log(EXPORT_ARTIFACTS_HELP)
    return 1
  }
  const { invocation } = parsed

  try {
    const result = await exportArtifacts({
      outputDirectory: invocation.outputDirectory,
      source: invocation.source,
      ranges: invocation.ranges,
      repositoryRedaction: invocation.repositoryRedaction,
      loadDashboard:
        invocation.source === 'local'
          ? loadLocalDashboard
          : (range) => Promise.resolve(createPublicShowcaseDashboard(range)),
      aliasSeed:
        invocation.source === 'local'
          ? () => createPortableExportSeed()
          : (range) => `synthetic-showcase-${range}`,
      env,
    })
    for (const artifact of result.artifacts) {
      log(`${artifact.file}\t${artifact.bytes} bytes`)
    }
    log(
      `Wrote ${result.artifacts.length} ${result.scope} artifacts to ${result.outputDirectory}`,
    )
    log(
      `Privacy scan passed: ${result.privacyScan.patternCount} forbidden patterns over ` +
        `${result.privacyScan.filesScanned} written files.`,
    )
    if (result.scope === 'redacted-local') {
      log(
        'These files describe private activity in aggregate. Review each one before sharing it; ' +
          'aliases reduce identification but are not an anonymity guarantee.',
      )
    }
    return 0
  } catch (error) {
    log(error instanceof ArtifactExportError ? error.message : `failed: ${(error as Error).name}`)
    return 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runExportArtifactsCli(process.argv.slice(2), process.env, (line) => {
    console.log(line)
  })
}
