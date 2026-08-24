import { readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { DashboardData } from '../shared/types.js'

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

function meaningful(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0)
}

/** Repository identities as they appear in the source dashboard, never in an export. */
export function dashboardRepositoryIdentities(dashboard: DashboardData): string[] {
  return meaningful(
    dashboard.repositories.flatMap((repository) => [
      repository.nameWithOwner,
      repository.displayName,
    ]),
  )
}

/**
 * Summary-share invariants: cards, captions, and the compact report carry six allowlisted
 * aggregates and fixed copy, so no repository identity or pull-request title can legitimately
 * appear in them for ANY scope — synthetic or local.
 */
export function shareBoundaryViolations(
  where: string,
  dashboard: DashboardData,
  output: string,
): string[] {
  const violations: string[] = []
  for (const identity of dashboardRepositoryIdentities(dashboard)) {
    if (output.includes(identity)) {
      violations.push(`${where}: a repository identity escaped into the share output`)
      break
    }
  }
  for (const title of meaningful(dashboard.pullRequests.map((pullRequest) => pullRequest.title))) {
    if (output.includes(title)) {
      violations.push(`${where}: a pull request title escaped into the share output`)
      break
    }
  }
  if (/<script\b/i.test(output)) violations.push(`${where}: share output contains a script`)
  return violations
}

/**
 * Portable-experience invariants that hold for every scope. Repository labels are deliberately
 * NOT checked here: the synthetic showcase publishes its approved invented names, and a local
 * export under `private-aliases` keeps public repository names by design. Callers that require
 * full aliasing add `dashboardRepositoryIdentities` on top.
 */
export function portableBoundaryViolations(
  where: string,
  dashboard: DashboardData,
  output: string,
): string[] {
  const violations: string[] = []
  for (const title of meaningful(dashboard.pullRequests.map((pullRequest) => pullRequest.title))) {
    if (output.includes(title)) {
      violations.push(`${where}: a pull request title escaped into the portable output`)
      break
    }
  }
  const login = dashboard.meta.subject.login.trim()
  if (login.length > 0 && output.includes(login)) {
    violations.push(`${where}: subject identity escaped into the portable output`)
  }
  const generatedAt = dashboard.meta.generatedAt.trim()
  if (generatedAt.length > 0 && output.includes(generatedAt)) {
    violations.push(`${where}: exact generation time escaped into the portable output`)
  }
  if (/<script\b/i.test(output)) violations.push(`${where}: portable output contains a script`)
  if (/<(?:img|link)\b/i.test(output)) {
    violations.push(`${where}: portable output references an external asset`)
  }
  return violations
}
