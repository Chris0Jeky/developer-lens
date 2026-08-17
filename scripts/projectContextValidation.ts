import { createHash } from 'node:crypto'
import { dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path'
import { isMap, parseDocument } from 'yaml'
import { z } from 'zod'

export type LinkResolution =
  | { kind: 'skip' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'local'; target: string }

export interface SkillFrontmatter {
  name: string
  description: string
}

const markdownLinkPattern =
  /!?\[(?:[^\]\r\n]|\r?\n(?!\r?\n))*\]\(\s*(?:<([^>\r\n]+)>|([^\s)\r\n]+))(?:\s+(?:"[^"\r\n]*"|'[^'\r\n]*'|\([^\r\n)]*\)))?\s*\)/g

export function extractMarkdownLinkTargets(contents: string): string[] {
  return [...contents.matchAll(markdownLinkPattern)].map((match) => match[1] ?? match[2] ?? '')
}

export function resolveRepositoryLinkTarget(
  root: string,
  sourcePath: string,
  rawTarget: string,
): LinkResolution {
  if (rawTarget.startsWith('#')) {
    return { kind: 'skip' }
  }

  const rawPathTarget = rawTarget.split('#', 1)[0]
  if (!rawPathTarget) {
    return { kind: 'skip' }
  }

  let decodedTarget: string
  try {
    decodedTarget = decodeURIComponent(rawPathTarget)
  } catch {
    return { kind: 'invalid', reason: `invalid URL encoding: ${rawPathTarget}` }
  }

  if (isAbsolute(decodedTarget) || win32.isAbsolute(decodedTarget)) {
    return { kind: 'invalid', reason: `absolute local path: ${rawTarget}` }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(decodedTarget)) {
    return { kind: 'skip' }
  }

  const target = resolve(root, dirname(sourcePath), decodedTarget)
  const rootRelativeTarget = relative(root, target)
  if (
    rootRelativeTarget === '..' ||
    rootRelativeTarget.startsWith(`..${sep}`) ||
    isAbsolute(rootRelativeTarget)
  ) {
    return { kind: 'invalid', reason: `target escapes repository root: ${rawTarget}` }
  }

  return { kind: 'local', target }
}

const protectedTrackedPathRoots = [
  '.developer-lens',
  '.developer-lens-synthetic',
  '.agent-harness/runtime',
  '.claude/worktrees',
  'coverage',
  'dist',
  'dist-ssr',
  'node_modules',
  'public/data',
] as const

const windowsUserHomePathPattern = /(?:^|[^a-z0-9_])[a-z]:[\\/]+users[\\/]+[^\\/\r\n]+/i

/**
 * Normalize a Git-index pathname only for protected-root classification. Git stores path bytes;
 * this deliberately does not resolve dot segments or access the working tree.
 */
export function normalizeTrackedPathForRootClassification(path: string): string {
  let normalized = path.replaceAll('\\', '/').replace(/\/+/g, '/').toLowerCase()
  while (normalized.startsWith('./') || normalized.startsWith('/')) {
    normalized = normalized.startsWith('./') ? normalized.slice(2) : normalized.slice(1)
  }
  return normalized
}

/** True when a tracked pathname names a protected/generated root or one of its descendants. */
export function isProtectedTrackedPath(path: string): boolean {
  const normalized = normalizeTrackedPathForRootClassification(path)
  return protectedTrackedPathRoots.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`),
  )
}

/** Keep the prior eligibility predicate for callers that only need root classification. */
export function isTrackedTextPathEligible(path: string): boolean {
  return !isProtectedTrackedPath(path)
}

/** Detect a Windows user-home prefix without retaining or reporting its private segment. */
export function containsWindowsUserHomePath(contents: string): boolean {
  return windowsUserHomePathPattern.test(contents)
}

function escapeDiagnosticPath(path: string): string {
  // oxlint-disable-next-line no-control-regex -- control ranges are intentionally sanitized
  return path.replace(/[\\\u0000-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g, (character) => {
    if (character === '\\') {
      return '\\\\'
    }
    return `\\u${character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`
  })
}

export interface GitIndexEntry {
  mode: string
  objectId: string
  stage: string
  path: string
}

export interface TrackedTextValidationAccess {
  listPaths: () => readonly string[]
  listEntries: (paths: readonly string[]) => readonly GitIndexEntry[]
  readBlob: (objectId: string) => Uint8Array
}

export type GitIndexCommandExecutor = (args: readonly string[]) => Uint8Array

/** Parse NUL-delimited Git pathnames without treating a path as shell text. */
export function parseGitTrackedPaths(raw: Uint8Array): string[] {
  const paths: string[] = []
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  let start = 0
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== 0) {
      continue
    }
    const path = decoder.decode(raw.slice(start, index))
    if (!path) {
      throw new Error('invalid Git tracked path')
    }
    paths.push(path)
    start = index + 1
  }
  if (start !== raw.length) {
    throw new Error('unterminated Git tracked path')
  }
  return paths
}

/** Build literal Git pathspec arguments so Git metadata cannot expand an eligible path. */
export function buildGitIndexMetadataArgs(paths: readonly string[]): string[] {
  return ['--literal-pathspecs', 'ls-files', '--stage', '-z', '--', ...paths]
}

/** Build an injected Git-index adapter whose metadata reads occur only after name classification. */
export function createGitIndexTrackedTextValidationAccess(
  execute: GitIndexCommandExecutor,
): TrackedTextValidationAccess {
  return {
    listPaths: () => parseGitTrackedPaths(execute(['ls-files', '-z'])),
    listEntries: (paths) => {
      if (paths.length === 0) {
        return []
      }
      return parseGitIndexEntries(execute(buildGitIndexMetadataArgs(paths)))
    },
    readBlob: (objectId) => execute(['cat-file', 'blob', objectId]),
  }
}

/** Parse NUL-delimited Git index records without treating a path as shell text. */
export function parseGitIndexEntries(raw: Uint8Array): GitIndexEntry[] {
  const entries: GitIndexEntry[] = []
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  let start = 0
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== 0) {
      continue
    }
    const record = decoder.decode(raw.slice(start, index))
    start = index + 1
    const match = /^([0-7]{6}) ([0-9a-f]{40}|[0-9a-f]{64}) ([0-3])\t([\s\S]+)$/i.exec(record)
    if (!match) {
      throw new Error('invalid Git index record')
    }
    const [, mode = '', objectId = '', stage = '', path = ''] = match
    entries.push({ mode, objectId, stage, path })
  }
  if (start !== raw.length) {
    throw new Error('unterminated Git index record')
  }
  return entries
}

interface ReconciledGitIndexEntry {
  entry: GitIndexEntry
  path: string
}

function reconcileGitIndexEntriesByPath(
  expectedPaths: readonly string[],
  entries: readonly GitIndexEntry[],
): ReconciledGitIndexEntry[] | undefined {
  if (expectedPaths.length !== entries.length) {
    return undefined
  }
  const expected = new Set(expectedPaths)
  if (expected.size !== expectedPaths.length) {
    return undefined
  }
  const seen = new Set<string>()
  const reconciled: ReconciledGitIndexEntry[] = []
  for (const entry of entries) {
    const path = entry.path
    if (!expected.has(path) || seen.has(path)) {
      return undefined
    }
    seen.add(path)
    reconciled.push({ entry, path })
  }
  return reconciled
}

function materializeReconciledGitIndexEntries(
  reconciled: readonly ReconciledGitIndexEntry[],
): GitIndexEntry[] {
  return reconciled.map(({ entry, path }) => ({
    path,
    mode: entry.mode,
    objectId: entry.objectId,
    stage: entry.stage,
  }))
}

function pathsMatchExactly(first: readonly string[], second: readonly string[]): boolean {
  if (first.length !== second.length) {
    return false
  }
  const firstPaths = new Set(first)
  if (firstPaths.size !== first.length || new Set(second).size !== second.length) {
    return false
  }
  return second.every((path) => firstPaths.has(path))
}

function metadataSnapshotsMatch(
  first: readonly GitIndexEntry[],
  second: readonly GitIndexEntry[],
): boolean {
  if (first.length !== second.length) {
    return false
  }
  const firstByPath = new Map<string, GitIndexEntry>()
  for (const entry of first) {
    if (firstByPath.has(entry.path)) {
      return false
    }
    firstByPath.set(entry.path, entry)
  }
  for (const entry of second) {
    const original = firstByPath.get(entry.path)
    if (
      !original ||
      original.mode !== entry.mode ||
      original.objectId !== entry.objectId ||
      original.stage !== entry.stage
    ) {
      return false
    }
  }
  return true
}

/**
 * Validate Git-index blobs without reading working-tree content or following symlinks. Protected
 * paths fail before stage, mode, object-ID, or blob access so they cannot reach any content read.
 */
export function validateTrackedTextForWindowsUserHomePaths(
  access: TrackedTextValidationAccess,
): string[] {
  const errors: string[] = []
  let paths: readonly string[]
  try {
    paths = access.listPaths()
  } catch {
    return ['unable to enumerate Git-tracked paths']
  }
  const eligiblePaths: string[] = []
  for (const path of paths) {
    if (isProtectedTrackedPath(path)) {
      errors.push('protected Git-tracked path is not allowed')
      continue
    }
    eligiblePaths.push(path)
  }
  if (eligiblePaths.length === 0) {
    return errors
  }
  let entries: readonly GitIndexEntry[]
  try {
    entries = access.listEntries(eligiblePaths)
  } catch {
    errors.push('unable to enumerate eligible Git-tracked metadata')
    return errors
  }
  let reconciled: ReconciledGitIndexEntry[] | undefined
  try {
    reconciled = reconcileGitIndexEntriesByPath(eligiblePaths, entries)
  } catch {
    reconciled = undefined
  }
  if (!reconciled) {
    errors.push('eligible Git-tracked metadata does not match enumerated paths')
    return errors
  }
  let initialSnapshot: GitIndexEntry[]
  try {
    initialSnapshot = materializeReconciledGitIndexEntries(reconciled)
  } catch {
    errors.push('eligible Git-tracked metadata snapshot changed during validation')
    return errors
  }
  let finalPaths: readonly string[]
  try {
    finalPaths = access.listPaths()
  } catch {
    errors.push('unable to re-enumerate Git-tracked paths')
    return errors
  }
  const finalEligiblePaths = finalPaths.filter((path) => !isProtectedTrackedPath(path))
  if (
    !pathsMatchExactly(paths, finalPaths) ||
    !pathsMatchExactly(eligiblePaths, finalEligiblePaths)
  ) {
    errors.push('Git-tracked path snapshot changed during validation')
    return errors
  }
  let finalEntries: readonly GitIndexEntry[]
  try {
    finalEntries = access.listEntries(finalEligiblePaths)
  } catch {
    errors.push('unable to re-enumerate eligible Git-tracked metadata')
    return errors
  }
  let finalReconciled: ReconciledGitIndexEntry[] | undefined
  try {
    finalReconciled = reconcileGitIndexEntriesByPath(finalEligiblePaths, finalEntries)
  } catch {
    finalReconciled = undefined
  }
  if (!finalReconciled) {
    errors.push('eligible Git-tracked metadata does not match enumerated paths')
    return errors
  }
  let finalSnapshot: GitIndexEntry[]
  try {
    finalSnapshot = materializeReconciledGitIndexEntries(finalReconciled)
    if (!metadataSnapshotsMatch(initialSnapshot, finalSnapshot)) {
      errors.push('eligible Git-tracked metadata snapshot changed during validation')
      return errors
    }
  } catch {
    errors.push('eligible Git-tracked metadata snapshot changed during validation')
    return errors
  }
  for (const entry of finalSnapshot) {
    const diagnosticPath = escapeDiagnosticPath(entry.path)
    if (entry.stage !== '0') {
      errors.push(`${diagnosticPath}: unmerged Git index entry`)
      continue
    }
    if (entry.mode !== '100644' && entry.mode !== '100755' && entry.mode !== '120000') {
      errors.push(`${diagnosticPath}: unsupported Git index mode`)
      continue
    }
    try {
      const contents = new TextDecoder().decode(access.readBlob(entry.objectId))
      if (containsWindowsUserHomePath(contents)) {
        errors.push(`${diagnosticPath}: contains a Windows user-home path`)
      }
    } catch {
      errors.push(`${diagnosticPath}: unable to read Git index blob`)
    }
  }
  return errors
}

function parseScalar(value: string): { value?: string; error?: string } {
  if (value.startsWith('"')) {
    if (!value.endsWith('"')) {
      return { error: `unterminated quoted scalar: ${value}` }
    }
    try {
      return { value: JSON.parse(value) as string }
    } catch {
      return { error: `invalid double-quoted scalar: ${value}` }
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'")) {
      return { error: `unterminated quoted scalar: ${value}` }
    }
    return { value: value.slice(1, -1).replaceAll("''", "'") }
  }
  if (value.includes(': ') || value.includes(' #')) {
    return { error: `unsupported plain scalar: ${value}` }
  }
  if (
    value.startsWith('[') ||
    value.startsWith('{') ||
    /^[&*!|>@`#]/.test(value) ||
    /^-\s/.test(value) ||
    /^(?:~|null|true|false|yes|no|on|off|[-+]?\.(?:inf|nan))$/i.test(value) ||
    /^[+-]?(?:0[xob][0-9a-f_]+|[0-9][0-9_]*(?:\.[0-9_]*)?(?:e[+-]?[0-9]+)?|\.[0-9_]+(?:e[+-]?[0-9]+)?)$/i.test(value) ||
    /^\d{4}-\d{1,2}-\d{1,2}(?:$|[Tt]\d| \d)/i.test(value) ||
    /^\?\s/.test(value)
  ) {
    return { error: `plain scalar must remain a string: ${value}` }
  }
  return { value }
}

export function parseSkillFrontmatter(contents: string):
  | { value: SkillFrontmatter; errors: [] }
  | { value?: undefined; errors: string[] } {
  const normalized = contents.replaceAll('\r\n', '\n')
  if (!normalized.startsWith('---\n')) {
    return { errors: ['frontmatter must start with ---'] }
  }

  const closingDelimiter = normalized.indexOf('\n---\n', 4)
  if (closingDelimiter === -1) {
    return { errors: ['frontmatter must have a closing --- delimiter'] }
  }

  const fields = new Map<string, string>()
  const errors: string[] = []
  for (const line of normalized.slice(4, closingDelimiter).split('\n')) {
    if (line.trim() === '') {
      continue
    }
    const match = /^([a-z][a-z0-9_-]*):\s+(.+)$/i.exec(line)
    if (!match) {
      errors.push(`unsupported frontmatter syntax: ${line}`)
      continue
    }
    const [, key = '', rawValue = ''] = match
    if (!['name', 'description'].includes(key)) {
      errors.push(`unsupported frontmatter key: ${key}`)
      continue
    }
    if (fields.has(key)) {
      errors.push(`duplicate frontmatter key: ${key}`)
      continue
    }
    const parsedValue = parseScalar(rawValue.trim())
    if (parsedValue.error || parsedValue.value === undefined) {
      errors.push(parsedValue.error ?? `invalid frontmatter value for ${key}`)
      continue
    }
    fields.set(key, parsedValue.value)
  }

  const name = fields.get('name')
  const description = fields.get('description')
  if (name !== 'developer-lens-continuation') {
    errors.push('frontmatter name must be developer-lens-continuation')
  }
  if (!description) {
    errors.push('frontmatter description must be non-empty')
  }

  if (errors.length > 0 || !name || !description) {
    return { errors }
  }
  return { value: { name, description }, errors: [] }
}

function valueAtPath(value: unknown, path: readonly string[]): unknown {
  let current = value
  for (const segment of path) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

export function validateTierDeclaration(value: unknown): string[] {
  const expectedValues: ReadonlyArray<readonly [readonly string[], unknown]> = [
    [['tier'], 2],
    [['name'], 'daily-driver'],
    [['authority', 'push'], 'free'],
    [['authority', 'merge'], 'free'],
    [['public_synthetic_publication', 'remote'], 'origin'],
    [['public_synthetic_publication', 'repository'], 'Chris0Jeky/developer-lens'],
    [['flags', 'sensitive_data'], true],
    [['flags', 'wave_mode'], false],
    [['flags', 'dormant_production'], false],
    [['flags', 'relaxed_work_loss_guards'], false],
    [['human_todo'], 'HUMAN_TODO.md'],
  ]

  return expectedValues.flatMap(([path, expected]) => {
    const actual = valueAtPath(value, path)
    return actual === expected
      ? []
      : [`${path.join('.')} must be ${JSON.stringify(expected)} (received ${JSON.stringify(actual)})`]
  })
}

export function formatCurrentStateValidationErrors(errors: readonly string[]): string[] {
  return errors.map((error) => `current state: ${error}`)
}

export function validateCurrentStateDocument(contents: string): string[] {
  const normalized = contents.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const lines = normalized.split('\n')
  const rootFences = lines
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.startsWith('```'))
  const errors: string[] = []

  if (rootFences.length === 0) {
    return ['line 1: expected exactly one root-level ```yaml fenced block']
  }

  const opener = rootFences.find(({ line }) => /^```yaml[\t ]*$/.test(line))
  for (const fence of rootFences) {
    if (fence.line === '```' || /^```yaml[\t ]*$/.test(fence.line)) {
      continue
    }
    errors.push(
      `line ${fence.number}: root-level fenced block opener must be exactly \`\`\`yaml (received ${fence.line})`,
    )
  }
  if (!opener) {
    errors.push('line 1: expected a root-level ```yaml fenced block opener')
    return errors
  }

  const closer = rootFences.find(
    ({ line, number }) => number > opener.number && line === '```',
  )
  if (!closer) {
    errors.push(`line ${opener.number}: YAML fenced block is unterminated`)
    return errors
  }
  if (rootFences.length !== 2) {
    errors.push(
      `line ${rootFences[2]?.number ?? opener.number}: expected exactly one root-level fenced block; found ${rootFences.length} fence lines`,
    )
  }
  if (errors.length > 0) {
    return errors
  }

  const document = parseDocument(lines.slice(opener.number, closer.number - 1).join('\n'), {
    version: '1.2',
    schema: 'core',
    uniqueKeys: true,
  })
  for (const error of document.errors) {
    const location = (error as { linePos?: Array<{ line: number; col: number }> }).linePos?.[0]
    const prefix = location ? `line ${opener.number + location.line}, column ${location.col}` : 'YAML parse error'
    errors.push(`${prefix}: ${error.message}`)
  }
  if (errors.length > 0) {
    return errors
  }
  if (!isMap(document.contents)) {
    return ['YAML root must be a mapping']
  }

  let state: Record<string, unknown>
  try {
    state = document.toJS() as Record<string, unknown>
  } catch {
    return ['YAML materialization failed']
  }
  const requiredStrings = [
    'active_slice',
    'next_value_slice',
    'blockers',
    'last_verified_checks',
  ] as const
  const updated = state.updated
  if (typeof updated !== 'string' || !isGregorianCalendarDate(updated)) {
    errors.push('updated must be a YYYY-MM-DD string')
  }
  const remoteRefsLastObservedAt = state.remote_refs_last_observed_at
  if (
    typeof remoteRefsLastObservedAt !== 'string' ||
    !isStrictUtcSecondsTimestamp(remoteRefsLastObservedAt)
  ) {
    errors.push(
      'remote_refs_last_observed_at must be a YYYY-MM-DDTHH:mm:ssZ UTC timestamp',
    )
  }
  for (const key of requiredStrings) {
    const value = state[key]
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`${key} must be a nonblank string`)
    }
  }
  const activeHorizon = state.active_horizon
  if (
    !Array.isArray(activeHorizon) ||
    activeHorizon.length === 0 ||
    activeHorizon.some((value) => typeof value !== 'string' || value.trim() === '')
  ) {
    errors.push('active_horizon must be a nonempty array of nonblank strings')
  }
  return errors
}

function isGregorianCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return false
  }
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1]
}

function isStrictUtcSecondsTimestamp(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(value)
  if (!match || !isGregorianCalendarDate(match[1] ?? '')) {
    return false
  }
  const hour = Number(match[2])
  const minute = Number(match[3])
  const second = Number(match[4])
  return hour <= 23 && minute <= 59 && second <= 59
}

/*
 * Prompt operating system (issue #214 / lab #33).
 *
 * The prompt library is the single executable prompt surface. Everything below exists so that a
 * silent drift — a deleted common ID, an edited shared block in one prompt only, a stale prompt
 * document that still reads as runnable, a bare cross-repository `q-N` — fails a check instead of
 * surviving into a pasted session.
 *
 * The common-ID set is pinned HERE as well as in `.agent-harness/prompt-parity.json` on purpose:
 * deleting an ID from both the prompt library and the manifest must still fail.
 */

export const COMMON_PROMPT_IDS = [
  'DL-P01-FLAGSHIP-GOVERNOR',
  'DL-P02-GOVERNOR-LITE',
  'DL-P03-OVERNIGHT-CONTINUOUS',
  'DL-P04-RESUME-RECONCILE',
  'DL-P05-BOUNDED-IMPLEMENTER',
  'DL-P06-INDEPENDENT-REVIEWER',
  'DL-P07-MECHANICAL-SWEEP',
  'DL-P08-CI-REVIEW-RECOVERY',
  'DL-P09-RELEASE-CURATOR',
  'DL-P10-CROSS-REPO-COORDINATOR',
  'DL-P11-DISCOVERY-IDEA-MINER',
  'DL-P12-FRICTION-BURNDOWN',
] as const

export const SHARED_BLOCK_IDS = ['runtime-bootstrap-v1', 'friction-tasking-v1'] as const

/** Exact clauses each shared block must carry, checked independently of its digest. */
export const SHARED_BLOCK_REQUIRED_CLAUSES: Readonly<Record<string, readonly string[]>> = {
  'runtime-bootstrap-v1': [
    'Claude runtimes read CLAUDE.md and use the repository\'s named Claude agent files for read-only',
    'discovery, bounded implementation, fresh-context adversarial review, and mechanical sweeps. The',
    "prompt's repository-specific routing clause names those agents exactly",
    'Codex runtimes read AGENTS.md first, then the shared CLAUDE.md canon it references',
    'repository continuation skill, and follow Sol/Terra/Luna routing',
    'Cross-repository human actions are cited as fully qualified refs',
  ],
  'friction-tasking-v1': [
    'docs/agent-system/FRICTION_LOG.md in the SAME hop',
    'Capture is not permission to detour',
    'At the second independent occurrence',
  ],
}

/** Exact unpinned clause every active Product prompt carries outside the shared blocks. */
export const PRODUCT_CLAUDE_ROUTING_CLAUSE = [
  'CLAUDE ROUTING: read CLAUDE.md; delegate large/discovery reads to Opus 5 low `dl-scout`,',
  'bounded implementation to Opus 5 high `dl-implementer`, fresh-context review to Opus 5 high',
  '`dl-reviewer`, and mechanical sweeps to Sonnet 4.6 high `dl-mechanic`.',
].join('\n')

export const PRODUCT_CLAUDE_ROUTING_TOKENS = [
  'CLAUDE.md',
  'dl-scout',
  'dl-implementer',
  'dl-reviewer',
  'dl-mechanic',
] as const

/** Ordered, each exactly once, in `CONTINUOUS_WORK_PROTOCOL.md`. */
export const CONTINUOUS_SECTION_MARKERS = [
  'continuous-execution-begin',
  'continuous-impact-begin',
  'continuous-impact-end',
  'continuous-execution-end',
  'continuous-stop-begin',
  'continuous-stop-end',
] as const

/** Exact non-shared Product P03 contract clauses, ordered and checked outside shared blocks. */
export const FLAGSHIP_OVERNIGHT_DELIVERY_CONTRACT = [
  {
    label: 'FLAGSHIP OWNERSHIP',
    clause:
      'FLAGSHIP OWNERSHIP: You own authority, architecture, orchestration, sequencing, conflict resolution and final merge judgment. You do not write implementation code yourself.',
  },
  {
    label: 'SLICE IMPACT',
    clause:
      'SLICE IMPACT: Before selecting each slice, record consumer/question; tangible artifact/behaviour/decision; owned paths and non-goals; acceptance behaviour plus focused proof; risk/data/owner gate; evidence/docs update; and rollback/stop condition.',
  },
  {
    label: 'MISSION DELIVERY BEFORE MAINTENANCE',
    clause:
      'MISSION DELIVERY BEFORE MAINTENANCE: Deliver tangible product/research value through bounded implementation, behaviour tests, approved synthetic evaluation/reproduction, UX/story work, integration, packaging/distribution/release preparation, hardening, and documentation of evidence; select dependency-safe MISSION DELIVERY before maintenance/hardening.',
  },
  {
    label: 'SUPPORTING-WORK ELIGIBILITY',
    clause:
      'SUPPORTING-WORK ELIGIBILITY: Docs/governance are supporting outputs, not the default queue. Pure docs/admin work is eligible only when it corrects a safety-relevant false operational claim, satisfies an explicit request, directly unblocks delivery, or is an already-tracked maintenance/hardening item that passes provenance, consumer, and focused-proof legitimacy.',
  },
  {
    label: 'FINISH-BEFORE-EXPAND',
    clause:
      'FINISH-BEFORE-EXPAND: Drive existing writable lanes and PRs to merge/archive/park before accumulating new write lanes. During aging, start another writer only when work is genuinely disjoint and review/merge capacity exists; otherwise use read-only discovery or existing-lane work. This is not a fixed numeric cap.',
  },
  {
    label: 'REVIEW EVENTS ONLY',
    clause:
      'REVIEW EVENTS ONLY: Check review arrival at workflow boundaries (PR opened/ready, review completed, fixes pushed, milestone completed, PR merged, next work scan), never on a short timer.',
  },
  {
    label: 'PROTECTED BOUNDARY CLOSURE',
    clause:
      'PROTECTED BOUNDARY CLOSURE: Never open data-activation, model-activation, telemetry, or credential lanes in this mode; never self-activate data/model/telemetry/credentials. Those are W3/W4 and need the coordinator or the owner.',
  },
] as const

export const RETIRED_PROMPT_SENTINEL =
  'RETIRED PROMPT - HISTORICAL RECORD ONLY - DO NOT EXECUTE.'

const promptIdPattern = /^DL-(?:P|PX|LX)\d{2}-[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/
const promptMarkerPattern = /^<!-- prompt-id: (\S+) status: (\S+) -->$/
const sharedBlockMarkerPattern = /^<!-- shared-block: (\S+) -->$/
const promptSourceMarkerPattern = /^<!-- prompt-source: (\S+) target: (\S+) -->$/
const qualifiedHumanRefPattern = /[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+::HUMAN_TODO\.md::q-\d+/g
const anyHumanRefPattern = /q-\d+/g

export type PromptStatus = 'active' | 'redirect' | 'historical'

export interface PromptLibraryEntry {
  id: string
  status: PromptStatus
  body: string
}

export interface ParsedPromptLibrary {
  sharedBlockIds: string[]
  sharedBlocks: Map<string, string>
  prompts: PromptLibraryEntry[]
  errors: string[]
}

export function normalizeSharedText(contents: string): string {
  return contents.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
}

export const CONTINUATION_FRICTION_MARKER_ID = 'continuation-friction-tasking-v1'
const continuationFrictionStart = `<!-- shared:${CONTINUATION_FRICTION_MARKER_ID} start -->`
const continuationFrictionEnd = `<!-- shared:${CONTINUATION_FRICTION_MARKER_ID} end -->`

interface ContinuationSkillSource {
  path: string
  contents: string
}

/**
 * The Claude and Codex continuation skills intentionally keep runtime-specific prose around one
 * shared task-capture block. Compare only the normalized bytes enclosed by its markers so the
 * surrounding adapters can evolve independently while the safety rule cannot silently drift.
 */
export function validateContinuationSkillParity(
  skills: readonly ContinuationSkillSource[],
): string[] {
  const errors: string[] = []
  const enclosedBlocks: Array<{ path: string; body: string }> = []

  for (const skill of skills) {
    const normalized = normalizeSharedText(skill.contents)
    const startCount = countOccurrences(normalized, continuationFrictionStart)
    const endCount = countOccurrences(normalized, continuationFrictionEnd)
    if (startCount !== 1) {
      errors.push(
        `${skill.path} must contain exactly one ${continuationFrictionStart} marker (found ${startCount})`,
      )
    }
    if (endCount !== 1) {
      errors.push(
        `${skill.path} must contain exactly one ${continuationFrictionEnd} marker (found ${endCount})`,
      )
    }
    if (startCount !== 1 || endCount !== 1) {
      continue
    }

    const start = normalized.indexOf(continuationFrictionStart)
    const end = normalized.indexOf(continuationFrictionEnd)
    if (end <= start) {
      errors.push(`${skill.path} continuation friction markers are out of order`)
      continue
    }
    enclosedBlocks.push({
      path: skill.path,
      body: normalized.slice(start + continuationFrictionStart.length, end),
    })
  }

  if (enclosedBlocks.length === skills.length && enclosedBlocks.length > 1) {
    const expected = enclosedBlocks[0]?.body
    for (const block of enclosedBlocks.slice(1)) {
      if (block.body !== expected) {
        errors.push(
          `continuation friction block bytes drift between ${enclosedBlocks[0]?.path} and ${block.path}`,
        )
      }
    }
  }

  return errors
}

export const AGENT_FRICTION_MARKER_ID = 'agent-friction-tasking-v1'
const agentFrictionStart = `<!-- shared:${AGENT_FRICTION_MARKER_ID} start -->`
const agentFrictionEnd = `<!-- shared:${AGENT_FRICTION_MARKER_ID} end -->`
const AGENT_FRICTION_REQUIRED_CLAUSES = [
  'docs/agent-system/FRICTION_LOG.md in the same hop and links to an existing issue, card, or durable',
  'A write-capable role appends it; a read-only role reports it as a required coordinator same-hop',
  'Capture never widens scope',
  'Never record a PID, absolute local path, token, or private',
] as const

/** Require one identical, role-aware friction block across the four product Claude agents. */
export function validateAgentFrictionParity(
  agents: readonly ContinuationSkillSource[],
): string[] {
  const errors: string[] = []
  const enclosedBlocks: Array<{ path: string; body: string }> = []

  for (const agent of agents) {
    const normalized = normalizeSharedText(agent.contents)
    const startCount = countOccurrences(normalized, agentFrictionStart)
    const endCount = countOccurrences(normalized, agentFrictionEnd)
    if (startCount !== 1) {
      errors.push(
        `${agent.path} must contain exactly one ${agentFrictionStart} marker (found ${startCount})`,
      )
    }
    if (endCount !== 1) {
      errors.push(
        `${agent.path} must contain exactly one ${agentFrictionEnd} marker (found ${endCount})`,
      )
    }
    if (startCount !== 1 || endCount !== 1) {
      continue
    }

    const start = normalized.indexOf(agentFrictionStart)
    const end = normalized.indexOf(agentFrictionEnd)
    if (end <= start) {
      errors.push(`${agent.path} agent friction markers are out of order`)
      continue
    }
    const body = normalized.slice(start + agentFrictionStart.length, end)
    enclosedBlocks.push({ path: agent.path, body })
    for (const clause of AGENT_FRICTION_REQUIRED_CLAUSES) {
      if (!body.includes(clause)) {
        errors.push(`${agent.path} agent friction block is missing required clause: ${clause}`)
      }
    }
  }

  if (enclosedBlocks.length === agents.length && enclosedBlocks.length > 1) {
    const expected = enclosedBlocks[0]?.body
    for (const block of enclosedBlocks.slice(1)) {
      if (block.body !== expected) {
        errors.push(
          `agent friction block bytes drift between ${enclosedBlocks[0]?.path} and ${block.path}`,
        )
      }
    }
  }

  return errors
}

export function sharedBlockDigest(body: string): string {
  return createHash('sha256').update(normalizeSharedText(body), 'utf8').digest('hex')
}

interface MarkerSection {
  kind: 'prompt' | 'shared-block'
  id: string
  status?: string
  line: number
  fences: string[]
}

function collectMarkerSections(contents: string): { sections: MarkerSection[]; errors: string[] } {
  const errors: string[] = []
  const sections: MarkerSection[] = []
  const lines = normalizeSharedText(contents).split('\n')

  let current: MarkerSection | undefined
  let fenceBuffer: string[] | undefined

  lines.forEach((line, index) => {
    if (line.startsWith('```')) {
      if (fenceBuffer) {
        current?.fences.push(fenceBuffer.join('\n'))
        fenceBuffer = undefined
      } else {
        fenceBuffer = []
      }
      return
    }
    if (fenceBuffer) {
      fenceBuffer.push(line)
      return
    }

    const promptMarker = promptMarkerPattern.exec(line)
    if (promptMarker) {
      current = {
        kind: 'prompt',
        id: promptMarker[1] ?? '',
        status: promptMarker[2] ?? '',
        line: index + 1,
        fences: [],
      }
      sections.push(current)
      return
    }
    const sharedMarker = sharedBlockMarkerPattern.exec(line)
    if (sharedMarker) {
      current = { kind: 'shared-block', id: sharedMarker[1] ?? '', line: index + 1, fences: [] }
      sections.push(current)
    }
  })

  if (fenceBuffer) {
    errors.push('prompt library contains an unterminated fenced block')
  }

  return { sections, errors }
}

export function parsePromptLibrary(contents: string): ParsedPromptLibrary {
  const { sections, errors } = collectMarkerSections(contents)
  const sharedBlocks = new Map<string, string>()
  const sharedBlockIds: string[] = []
  const prompts: PromptLibraryEntry[] = []
  const seenPromptIds = new Set<string>()

  for (const section of sections) {
    if (section.fences.length !== 1) {
      errors.push(
        `${section.kind} ${section.id} (line ${section.line}) must own exactly one fenced text block (found ${section.fences.length})`,
      )
      continue
    }
    const body = section.fences[0] ?? ''

    if (section.kind === 'shared-block') {
      if (sharedBlocks.has(section.id)) {
        errors.push(`duplicate shared block: ${section.id}`)
        continue
      }
      sharedBlockIds.push(section.id)
      sharedBlocks.set(section.id, body)
      continue
    }

    if (!promptIdPattern.test(section.id)) {
      errors.push(`malformed prompt id: ${section.id} (line ${section.line})`)
      continue
    }
    if (section.status !== 'active' && section.status !== 'redirect' && section.status !== 'historical') {
      errors.push(`prompt ${section.id} has unsupported status: ${String(section.status)}`)
      continue
    }
    if (seenPromptIds.has(section.id)) {
      errors.push(`duplicate prompt id: ${section.id}`)
      continue
    }
    seenPromptIds.add(section.id)
    prompts.push({ id: section.id, status: section.status, body })
  }

  return { sharedBlockIds, sharedBlocks, prompts, errors }
}

const PromptParityManifestSchema = z.strictObject({
  manifest_schema_version: z.literal(1),
  description: z.string().min(1),
  shared_block_normalization: z.string().min(1),
  common_prompt_ids: z.array(z.string().regex(promptIdPattern)).min(1),
  continuous_prompt_ids: z.array(z.string().regex(promptIdPattern)).min(1),
  shared_blocks: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
      }),
    )
    .min(1),
  repositories: z
    .array(
      z.strictObject({
        slug: z.string().regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/),
        role: z.enum(['product', 'lab']),
        prompt_library: z.string().min(1),
        continuous_work_protocol: z.string().min(1),
        friction_log: z.string().min(1),
        extension_prompt_ids: z.array(z.string().regex(promptIdPattern)),
      }),
    )
    .length(2),
})

export type PromptParityManifest = z.infer<typeof PromptParityManifestSchema>

function sameOrderedIds(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((id, index) => id === expected[index])
}

function describeSetDrift(
  label: string,
  actual: readonly string[],
  expected: readonly string[],
): string[] {
  const missing = expected.filter((id) => !actual.includes(id))
  const extra = actual.filter((id) => !expected.includes(id))
  const errors: string[] = []
  if (missing.length > 0) {
    errors.push(`${label} is missing: ${missing.join(', ')}`)
  }
  if (extra.length > 0) {
    errors.push(`${label} has unexpected entries: ${extra.join(', ')}`)
  }
  if (errors.length === 0 && !sameOrderedIds(actual, expected)) {
    errors.push(`${label} is out of manifest order: expected ${expected.join(', ')}`)
  }
  return errors
}

export function validatePromptParityManifest(
  value: unknown,
): { manifest?: PromptParityManifest; errors: string[] } {
  const parsed = PromptParityManifestSchema.safeParse(value)
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`,
      ),
    }
  }

  const manifest = parsed.data
  const errors: string[] = []

  errors.push(
    ...describeSetDrift('manifest common_prompt_ids', manifest.common_prompt_ids, COMMON_PROMPT_IDS),
  )
  errors.push(
    ...describeSetDrift(
      'manifest shared_blocks',
      manifest.shared_blocks.map((block) => block.id),
      SHARED_BLOCK_IDS,
    ),
  )

  for (const id of manifest.continuous_prompt_ids) {
    if (!manifest.common_prompt_ids.includes(id)) {
      errors.push(`manifest continuous prompt id is not a common prompt id: ${id}`)
    }
  }

  const roles = manifest.repositories.map((repository) => repository.role)
  if (!roles.includes('product') || !roles.includes('lab')) {
    errors.push('manifest repositories must declare exactly one product and one lab entry')
  }
  const slugs = manifest.repositories.map((repository) => repository.slug)
  if (new Set(slugs).size !== slugs.length) {
    errors.push('manifest repositories must have distinct slugs')
  }

  const allIds = [
    ...manifest.common_prompt_ids,
    ...manifest.repositories.flatMap((repository) => repository.extension_prompt_ids),
  ]
  const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index)
  if (duplicates.length > 0) {
    errors.push(`manifest prompt ids must be unique across common and extension sets: ${[...new Set(duplicates)].join(', ')}`)
  }

  return errors.length > 0 ? { manifest, errors } : { manifest, errors: [] }
}

export function findBareHumanRefs(body: string): string[] {
  const normalized = normalizeSharedText(body)
  const qualifiedRanges: Array<[number, number]> = []
  for (const match of normalized.matchAll(qualifiedHumanRefPattern)) {
    const start = match.index ?? 0
    qualifiedRanges.push([start, start + match[0].length])
  }

  const bare: string[] = []
  for (const match of normalized.matchAll(anyHumanRefPattern)) {
    const start = match.index ?? 0
    const covered = qualifiedRanges.some(([from, to]) => start >= from && start + match[0].length <= to)
    if (!covered) {
      bare.push(match[0])
    }
  }
  return bare
}

export function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) {
    return 0
  }
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

export function validatePromptLibrary(
  library: ParsedPromptLibrary,
  manifest: PromptParityManifest,
  localSlug: string,
): string[] {
  const errors = [...library.errors]

  const localRepository = manifest.repositories.find((repository) => repository.slug === localSlug)
  if (!localRepository) {
    return [
      ...errors,
      `prompt parity manifest declares no entry for this repository slug: ${localSlug}`,
    ]
  }

  errors.push(...describeSetDrift('prompt library shared blocks', library.sharedBlockIds, SHARED_BLOCK_IDS))

  for (const declared of manifest.shared_blocks) {
    const body = library.sharedBlocks.get(declared.id)
    if (body === undefined) {
      continue
    }
    const digest = sharedBlockDigest(body)
    if (digest !== declared.sha256) {
      errors.push(
        `shared block ${declared.id} digest drift: prompt library is ${digest}, manifest pins ${declared.sha256}`,
      )
    }
    for (const clause of SHARED_BLOCK_REQUIRED_CLAUSES[declared.id] ?? []) {
      if (!body.includes(clause)) {
        errors.push(`shared block ${declared.id} is missing required clause: ${clause}`)
      }
    }
  }

  const activePrompts = library.prompts.filter((prompt) => prompt.status === 'active')
  const expectedActiveIds = [...manifest.common_prompt_ids, ...localRepository.extension_prompt_ids]
  errors.push(
    ...describeSetDrift(
      'prompt library active prompt ids',
      activePrompts.map((prompt) => prompt.id),
      expectedActiveIds,
    ),
  )

  for (const id of manifest.continuous_prompt_ids) {
    if (!activePrompts.some((prompt) => prompt.id === id)) {
      errors.push(`continuous prompt ${id} is not an active prompt in the library`)
    }
  }

  for (const prompt of activePrompts) {
    const body = normalizeSharedText(prompt.body)
    if (localRepository.role === 'product') {
      const routingOccurrences = countOccurrences(body, PRODUCT_CLAUDE_ROUTING_CLAUSE)
      if (routingOccurrences !== 1) {
        errors.push(
          `prompt ${prompt.id} must contain exactly one Product Claude routing clause naming ${PRODUCT_CLAUDE_ROUTING_TOKENS.join(', ')} (found ${routingOccurrences})`,
        )
      }
      if (prompt.id === 'DL-P03-OVERNIGHT-CONTINUOUS') {
        const bodyOutsideSharedBlocks = SHARED_BLOCK_IDS.reduce((outside, blockId) => {
          const block = library.sharedBlocks.get(blockId)
          return block === undefined ? outside : outside.replaceAll(normalizeSharedText(block), '')
        }, body)
        const contractPositions: number[] = []
        for (const contract of FLAGSHIP_OVERNIGHT_DELIVERY_CONTRACT) {
          const occurrences = countOccurrences(bodyOutsideSharedBlocks, contract.clause)
          if (occurrences !== 1) {
            errors.push(
              `flagship overnight prompt must contain exactly one Product P03 delivery clause "${contract.label}" (found ${occurrences})`,
            )
            continue
          }
          contractPositions.push(bodyOutsideSharedBlocks.indexOf(contract.clause))
        }
        if (contractPositions.length === FLAGSHIP_OVERNIGHT_DELIVERY_CONTRACT.length) {
          const ordered = contractPositions.every(
            (position, index) => index === 0 || position > (contractPositions[index - 1] ?? -1),
          )
          if (!ordered) {
            errors.push(
              `flagship overnight Product P03 delivery clauses are out of order; expected ${FLAGSHIP_OVERNIGHT_DELIVERY_CONTRACT.map((contract) => contract.label).join(' -> ')}`,
            )
          }
        }
      }
    }
    for (const blockId of SHARED_BLOCK_IDS) {
      const blockBody = library.sharedBlocks.get(blockId)
      if (blockBody === undefined) {
        continue
      }
      const occurrences = countOccurrences(body, normalizeSharedText(blockBody))
      if (occurrences !== 1) {
        errors.push(
          `prompt ${prompt.id} must contain exactly one copy of shared block ${blockId} (found ${occurrences})`,
        )
      }
    }
    for (const bare of new Set(findBareHumanRefs(body))) {
      errors.push(
        `prompt ${prompt.id} cites a bare human action "${bare}"; use <owner>/<repo>::HUMAN_TODO.md::${bare}`,
      )
    }
  }

  return errors
}

export function validateContinuousWorkProtocol(contents: string): string[] {
  const normalized = normalizeSharedText(contents)
  const errors: string[] = []
  const positions: Array<{ marker: string; index: number }> = []

  for (const marker of CONTINUOUS_SECTION_MARKERS) {
    const token = `<!-- ${marker} -->`
    const occurrences = countOccurrences(normalized, token)
    if (occurrences === 0) {
      errors.push(`continuous work protocol is missing marker: ${marker}`)
      continue
    }
    if (occurrences > 1) {
      errors.push(`continuous work protocol repeats marker ${marker} ${occurrences} times (expected exactly one)`)
      continue
    }
    positions.push({ marker, index: normalized.indexOf(token) })
  }

  if (positions.length === CONTINUOUS_SECTION_MARKERS.length) {
    const ordered = positions.every(
      (entry, index) => index === 0 || entry.index > (positions[index - 1]?.index ?? -1),
    )
    if (!ordered) {
      errors.push(
        `continuous work protocol markers are out of order; expected ${CONTINUOUS_SECTION_MARKERS.join(' -> ')}`,
      )
    }
  }

  return errors
}

export interface PromptSourceClassification {
  kind: 'redirect' | 'historical'
  target: string
}

/**
 * A prompt-shaped document outside the library must declare itself a redirect or a historical
 * record, and must name a live prompt ID. A redirect carries no fenced body at all; a historical
 * record's fenced bodies are sentinel-wrapped so a copy-paste carries its own retirement notice.
 */
export function validatePromptSource(
  expected: PromptSourceClassification,
  contents: string,
  activePromptIds: readonly string[],
): string[] {
  const errors: string[] = []
  const normalized = normalizeSharedText(contents)
  const lines = normalized.split('\n')

  const markers = lines
    .map((line) => promptSourceMarkerPattern.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)

  if (markers.length !== 1) {
    errors.push(
      `expected exactly one prompt-source marker declaring "${expected.kind}" (found ${markers.length})`,
    )
    return errors
  }

  const [, kind = '', target = ''] = markers[0] as RegExpExecArray
  if (kind !== expected.kind) {
    errors.push(`prompt-source marker declares "${kind}" but this document is classified "${expected.kind}"`)
  }
  if (target !== expected.target) {
    errors.push(`prompt-source target is "${target}" but the classification expects "${expected.target}"`)
  }
  if (!activePromptIds.includes(target)) {
    errors.push(`prompt-source redirects to "${target}", which is not an active prompt id`)
  }

  if (lines.some((line) => promptMarkerPattern.test(line))) {
    errors.push('a redirect or historical document must not declare an executable prompt-id marker')
  }

  const fenceBodies: string[] = []
  let buffer: string[] | undefined
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (buffer) {
        fenceBodies.push(buffer.join('\n'))
        buffer = undefined
      } else {
        buffer = []
      }
      continue
    }
    buffer?.push(line)
  }
  if (buffer) {
    errors.push('document contains an unterminated fenced block')
  }

  if (expected.kind === 'redirect') {
    if (fenceBodies.length > 0) {
      errors.push(
        `a redirect must not keep a competing executable copy: found ${fenceBodies.length} fenced block(s)`,
      )
    }
    return errors
  }

  if (!normalized.includes(RETIRED_PROMPT_SENTINEL)) {
    errors.push(`a historical prompt document must carry the sentinel: ${RETIRED_PROMPT_SENTINEL}`)
  }
  fenceBodies.forEach((body, index) => {
    const bodyLines = body.split('\n')
    if (bodyLines[0] !== RETIRED_PROMPT_SENTINEL) {
      errors.push(`historical fenced block ${index + 1} must OPEN with the retirement sentinel`)
    }
    if (bodyLines[bodyLines.length - 1] !== RETIRED_PROMPT_SENTINEL) {
      errors.push(`historical fenced block ${index + 1} must CLOSE with the retirement sentinel`)
    }
  })

  return errors
}
