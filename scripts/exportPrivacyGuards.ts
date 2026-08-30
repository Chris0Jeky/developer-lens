import { readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { DashboardData } from '../shared/types.js'
import type { PortableExportPayload } from '../src/lib/portableExportPayload.js'
import type { SharePayload } from '../src/lib/sharePayload.js'

/**
 * One shared privacy scanner for every generated artifact.
 *
 * `scripts/verifyShowcase.ts` owned this pattern set and these structural boundary
 * assertions inline; `scripts/exportArtifacts.ts` needs exactly the same scan over the
 * files it writes. Duplicating the patterns would let the two copies drift, so both
 * callers now import this module. Nothing here is new policy — it is the existing
 * showcase policy, factored out.
 */

export interface ForbiddenPattern {
  label: string
  pattern: RegExp
}

/** Text artifacts worth scanning; binary output (PNG) is checked structurally instead. */
export const SCANNED_TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.svg',
  '.txt',
])

const STATIC_FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = Object.freeze([
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
])

const BEARER_VARIABLES = ['VITE_DEVELOPER_LENS_V2_TOKEN', 'DEVELOPER_LENS_V2_TOKEN'] as const

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

export function createForbiddenPatterns(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ForbiddenPattern[] {
  const patterns = [...STATIC_FORBIDDEN_PATTERNS]
  for (const variable of BEARER_VARIABLES) {
    const value = env[variable]
    if (value && value.length >= 8) {
      patterns.push({ label: `${variable} value`, pattern: new RegExp(escapeForRegExp(value)) })
    }
  }
  return patterns
}

/** Returns one `<label> found in <where>` message per tripped pattern. */
export function forbiddenPatternViolations(
  where: string,
  content: string,
  patterns: readonly ForbiddenPattern[],
): string[] {
  return patterns
    .filter((forbidden) => forbidden.pattern.test(content))
    .map((forbidden) => `${forbidden.label} found in ${where}`)
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

export interface DirectoryScanResult {
  filesScanned: number
  violations: string[]
}

/** Reads every scannable text file below `directory` and applies the pattern set. */
export async function scanDirectoryForForbiddenPatterns(
  directory: string,
  patterns: readonly ForbiddenPattern[],
): Promise<DirectoryScanResult> {
  const violations: string[] = []
  let filesScanned = 0
  for (const path of await filesBelow(directory)) {
    if (!SCANNED_TEXT_EXTENSIONS.has(extname(path))) continue
    filesScanned += 1
    violations.push(
      ...forbiddenPatternViolations(path, await readFile(path, 'utf8'), patterns),
    )
  }
  return { filesScanned, violations }
}

export interface PrivacyControlOptions {
  repositoryIdentities?: boolean
  pullRequestTitles?: boolean
  subjectLogin?: boolean
  generatedAt?: boolean
}

/**
 * Clone a dashboard for differential export-boundary checks. Each selected source field gets a
 * distinct, content-free canary. The clone deliberately changes no aggregate or unrelated field:
 * a payload that does not emit the selected source values must remain identical to the control.
 */
export function createPrivacyControlDashboard(
  dashboard: DashboardData,
  options: PrivacyControlOptions,
): DashboardData {
  const control = structuredClone(dashboard)
  if (options.repositoryIdentities) {
    control.repositories = control.repositories.map((repository, index) => ({
      ...repository,
      nameWithOwner: `__developer_lens_export_control_repository_name_${index}__`,
      displayName: `__developer_lens_export_control_repository_display_${index}__`,
    }))
  }
  if (options.pullRequestTitles) {
    control.pullRequests = control.pullRequests.map((pullRequest, index) => ({
      ...pullRequest,
      title: `__developer_lens_export_control_pull_request_title_${index}__`,
    }))
  }
  if (options.subjectLogin) {
    control.meta.subject = {
      ...control.meta.subject,
      login: '__developer_lens_export_control_subject_login__',
    }
  }
  if (options.generatedAt) {
    control.meta.generatedAt = '__developer_lens_export_control_generated_at__'
  }
  return control
}

function payloadsDiffer(actual: object, control: object): boolean {
  return JSON.stringify(actual) !== JSON.stringify(control)
}

/** Compares structured share payloads so fixed copy cannot trigger a source-value false positive. */
export function sharePayloadBoundaryViolations(
  where: string,
  actual: SharePayload,
  control: SharePayload,
): string[] {
  return payloadsDiffer(actual, control)
    ? [`${where}: share payload depends on a prohibited repository identity or pull-request title`]
    : []
}

/** Compares structured portable payloads; full aliasing also makes repository identities invariant. */
export function portablePayloadBoundaryViolations(
  where: string,
  actual: PortableExportPayload,
  control: PortableExportPayload,
  allAliases: boolean,
): string[] {
  if (!payloadsDiffer(actual, control)) return []
  return [
    allAliases
      ? `${where}: portable payload depends on a prohibited identity, title, subject, or generation time`
      : `${where}: portable payload depends on a prohibited title, subject, or generation time`,
  ]
}

/** Rendered-output checks that remain necessary for executable or remotely loaded content. */
export function renderedShareBoundaryViolations(where: string, output: string): string[] {
  return /<script\b/i.test(output) ? [`${where}: share output contains a script`] : []
}

export function renderedPortableBoundaryViolations(where: string, output: string): string[] {
  const violations: string[] = []
  if (/<script\b/i.test(output)) violations.push(`${where}: portable output contains a script`)
  if (/<(?:img|link)\b/i.test(output)) {
    violations.push(`${where}: portable output references an external asset`)
  }
  return violations
}
