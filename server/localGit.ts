import { execFile } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import { basename, isAbsolute, normalize, relative, sep } from 'node:path'
import { promisify } from 'node:util'
import { discoverLocalGitCandidates, isProtectedLocalGitPath } from './localGitDiscovery.js'
import type {
  CoverageSource,
  RawCommit,
  RawRepository,
} from '../shared/types.js'
import { COLLECTION_WARNINGS } from './collectionWarnings.js'
import { classifyCommit } from './github.js'

const execFileAsync = promisify(execFile)

// Metadata lookups should be quick, but allow slow local disks. Walking every ref with
// numstat is substantially more expensive, so logs get two minutes before coverage fails.
const LOCAL_GIT_METADATA_TIMEOUT_MS = 30_000
const LOCAL_GIT_LOG_TIMEOUT_MS = 120_000

class LocalGitExecutionLimitError extends Error {}

export interface LocalGitResult {
  commits: RawCommit[]
  repositories: RawRepository[]
  coverage: CoverageSource
  warnings: string[]
}

export function matchesConfiguredIdentity(
  author: { authorName: string; authorEmail: string },
  configuredEmails: ReadonlySet<string>,
): boolean {
  return configuredEmails.has(author.authorEmail.trim().toLowerCase())
}

interface ParsedCommit {
  sha: string
  occurredAt: string
  authorName: string
  authorEmail: string
  subject: string
  parentCount: number
  additions: number
  deletions: number
  files: number
}

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
      timeout: args[0] === 'log' ? LOCAL_GIT_LOG_TIMEOUT_MS : LOCAL_GIT_METADATA_TIMEOUT_MS,
      // A graceful signal can be ignored; deadline expiry must terminate the Git process.
      killSignal: 'SIGKILL',
    })
    return stdout.trim()
  } catch (error) {
    const failure = error as { killed?: boolean; code?: string } | undefined
    if (failure?.killed === true || failure?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      // Discard partial stdout, stderr, arguments and paths; retain no upstream cause.
      throw new LocalGitExecutionLimitError('LOCAL_GIT_EXECUTION_LIMIT')
    }
    throw error
  }
}

function normalizeRepoName(remote: string, fallback: string): string {
  const trimmed = remote.trim().replace(/\.git$/i, '')
  const sshMatch = trimmed.match(/^[^@]+@[^:]+:(.+)$/)
  if (sshMatch) return sshMatch[1]

  try {
    const url = new URL(trimmed)
    return url.pathname.replace(/^\//, '') || fallback
  } catch {
    return fallback
  }
}

function parseGitLog(output: string): ParsedCommit[] {
  const commits: ParsedCommit[] = []
  let current: ParsedCommit | undefined

  const finishCurrent = () => {
    if (current) commits.push(current)
    current = undefined
  }

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('@@DL@@')) {
      finishCurrent()
      const [sha, occurredAt, authorName, authorEmail, subject, parents = ''] = line
        .slice('@@DL@@'.length)
        .split('\u001f')
      current = {
        sha,
        occurredAt,
        authorName,
        authorEmail,
        subject,
        parentCount: parents ? parents.split(' ').length : 0,
        additions: 0,
        deletions: 0,
        files: 0,
      }
      continue
    }

    if (!current || !line.includes('\t')) continue
    const [additions, deletions] = line.split('\t', 3)
    current.files += 1
    if (additions !== '-') current.additions += Number(additions) || 0
    if (deletions !== '-') current.deletions += Number(deletions) || 0
  }

  finishCurrent()
  return commits
}

/**
 * Repository identity for discovery dedupe (#410). Two paths are one Git common directory exactly
 * when the filesystem says so (device + inode; `stat` follows symlinks), which stays case-insensitive
 * on default Windows/macOS volumes and keeps `Repo` and `repo` apart on case-sensitive ones. When
 * the filesystem gives no usable identity the key falls back to the previous case-folded path.
 */
async function filesystemIdentity(directory: string): Promise<string> {
  const { dev, ino } = await stat(directory, { bigint: true })
  if (ino === 0n) throw new Error('no inode')
  return `fs:${dev}:${ino}`
}

export async function dedupeByIdentity(
  entries: ReadonlyArray<{ topLevel: string; commonDirectory: string }>,
  identify: (directory: string) => Promise<string> = filesystemIdentity,
): Promise<string[]> {
  const kept = new Map<string, { topLevel: string; order: string }>()
  for (const { topLevel, commonDirectory } of entries) {
    const normalized = normalize(commonDirectory)
    const key = await identify(commonDirectory).catch(() => `path:${normalized.toLowerCase()}`)
    kept.set(key, { topLevel, order: normalized })
  }
  // Code-unit order, so which repository wins an identity collision never depends on discovery order.
  return [...kept.values()]
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    .map((entry) => entry.topLevel)
}

async function discoverRepositories(roots: string[]): Promise<{ repositories: string[]; failedLocations: number; refusedLocations: number; cappedDirectories: number }> {
  const discovery = await discoverLocalGitCandidates(roots)
  let failedLocations = discovery.failedLocations
  let refusedLocations = 0
  const selectedRoots: string[] = []
  for (const root of roots) {
    if (typeof root !== 'string' || !root.trim() || root.includes('\0') || isProtectedLocalGitPath(root)) continue
    try {
      const canonical = await realpath(root)
      if (!isProtectedLocalGitPath(canonical)) selectedRoots.push(canonical)
    } catch { /* Discovery already counts inaccessible selected roots. */ }
  }
  const insideSelectedRoot = (path: string): boolean => selectedRoots.some((root) => {
    // path.relative uses path components and Windows case rules, including different drives.
    const within = relative(root, path)
    return !isAbsolute(within) && within.split(sep)[0] !== '..'
  })

  const entries: Array<{ topLevel: string; commonDirectory: string }> = []
  for (const candidate of discovery.candidates) {
    try {
      const topLevel = await git(candidate, ['rev-parse', '--show-toplevel'])
      const gitDirectory = await git(candidate, ['rev-parse', '--path-format=absolute', '--git-dir'])
      const commonDirectory = await git(candidate, [
        'rev-parse',
        '--path-format=absolute',
        '--git-common-dir',
      ])
      const [resolvedTopLevel, resolvedGitDirectory, resolvedCommonDirectory] = await Promise.all(
        [topLevel, gitDirectory, commonDirectory].map((path) => realpath(path)),
      )
      // Marker files do not extend consent. Linked worktrees with shared metadata outside every
      // selected root are refused too; explicitly select its containing root to include it.
      if (![resolvedTopLevel, resolvedGitDirectory, resolvedCommonDirectory].every(insideSelectedRoot) ||
          isProtectedLocalGitPath(resolvedTopLevel) ||
          isProtectedLocalGitPath(resolvedGitDirectory, true) ||
          isProtectedLocalGitPath(resolvedCommonDirectory, true)) {
        refusedLocations++
        continue
      }
      // remote and log run from topLevel, which re-discovers its repository: it must resolve to the metadata checked above.
      const executedGitDirectory = await realpath(await git(topLevel, ['rev-parse', '--path-format=absolute', '--git-dir']))
      if (executedGitDirectory !== resolvedGitDirectory) {
        refusedLocations++
        continue
      }
      entries.push({ topLevel, commonDirectory })
    } catch {
      // Preserve incomplete discovery without retaining paths or exception text.
      failedLocations++
    }
  }

  return { repositories: await dedupeByIdentity(entries), failedLocations, refusedLocations, cappedDirectories: discovery.cappedDirectories ?? 0 }
}

export async function collectLocalGit(
  roots: string[],
  from: string,
  to: string,
  identities: { emails: string[] },
): Promise<LocalGitResult> {
  if (roots.length === 0) {
    return {
      commits: [],
      repositories: [],
      coverage: {
        id: 'local-git',
        label: 'Local Git enrichment',
        status: 'unavailable',
        detail: 'Not requested. Pass explicit --local-root paths to include local-only refs.',
      },
      warnings: [],
    }
  }

  const emails = new Set(
    identities.emails.map((value) => value.trim().toLowerCase()).filter(Boolean),
  )
  if (emails.size === 0) {
    return {
      commits: [],
      repositories: [],
      coverage: {
        id: 'local-git',
        label: 'Local Git enrichment',
        status: 'unavailable',
        detail:
          'Explicit roots were provided, but no author email identity was configured. Set git user.email or DEV_LENS_GIT_EMAILS.',
      },
      warnings: [COLLECTION_WARNINGS.localGitIdentityMissing()],
    }
  }

  const { repositories, failedLocations, refusedLocations, cappedDirectories } = await discoverRepositories(roots)
  const rawRepositories: RawRepository[] = []
  const commits: RawCommit[] = []
  const warnings: string[] = []
  let successfulInspections = 0
  const seenIds = new Set<string>()
  let identityCollisions = 0

  for (const repositoryPath of repositories) {
    try {
      const remote = await git(repositoryPath, ['remote', 'get-url', 'origin']).catch(
        (error: unknown) => {
          // A missing origin may use the local name; an execution limit is failed coverage.
          if (error instanceof LocalGitExecutionLimitError) throw error
          return ''
        },
      )
      const fallback = basename(repositoryPath)
      const nameWithOwner = normalizeRepoName(remote, fallback)
      const output = await git(repositoryPath, [
        'log',
        '--all',
        `--since=${from}`,
        `--until=${to}`,
        '--date=iso-strict',
        '--pretty=format:@@DL@@%H%x1f%aI%x1f%an%x1f%ae%x1f%s%x1f%P',
        '--numstat',
      ])

      const matched = parseGitLog(output).filter(
        (commit) => matchesConfiguredIdentity(commit, emails),
      )
      // Zero-activity repositories were inspected; a collision skipped below is not counted.
      if (matched.length === 0) {
        successfulInspections++
        continue
      }

      // Ids and downstream joins stay case-folded, so two repositories sharing one cannot both be
      // kept (the storage import refuses duplicates). Repositories arrive in a fixed order: the
      // first wins and the rest are counted, never named.
      const id = `local:${nameWithOwner.toLowerCase()}`
      const idKey = id.normalize('NFC')
      if (seenIds.has(idKey)) {
        identityCollisions++
        continue
      }
      seenIds.add(idKey)
      successfulInspections++
      rawRepositories.push({
        id,
        nameWithOwner,
        name: nameWithOwner.split('/').at(-1) ?? fallback,
        isPrivate: true,
        isArchived: false,
        isFork: false,
        languages: [],
        topics: [],
      })
      commits.push(
        ...matched.map((commit) => ({
          sha: commit.sha,
          repository: nameWithOwner,
          occurredAt: commit.occurredAt,
          source: 'local-git' as const,
          additions: commit.additions,
          deletions: commit.deletions,
          files: commit.files,
          parentCount: commit.parentCount,
          features: classifyCommit(commit.subject),
        })),
      )
    } catch (error) {
      warnings.push(COLLECTION_WARNINGS.localRepositoryUnreadable(
        error instanceof LocalGitExecutionLimitError ? 'A selected repository' : basename(repositoryPath),
      ))
    }
  }

  if (cappedDirectories > 0) warnings.push(COLLECTION_WARNINGS.localDiscoveryEntryLimit(cappedDirectories))
  if (identityCollisions > 0) {
    warnings.push(COLLECTION_WARNINGS.localRepositoryIdentityCollision(identityCollisions))
  }

  return {
    commits,
    repositories: rawRepositories,
    coverage: {
      id: 'local-git',
      label: 'Local Git enrichment',
      status:
        warnings.length === 0 && failedLocations === 0 && refusedLocations === 0
          ? 'complete'
          : successfulInspections > 0
            ? 'partial'
            : 'unavailable',
      detail: `${successfulInspections} explicitly selected repositories successfully inspected within the no-symlink, six-level discovery scope; only aggregate commit features are retained.${failedLocations > 0 ? ` ${failedLocations} discovery check(s) failed; discovery is incomplete.` : ''}${refusedLocations > 0 ? ` ${refusedLocations} candidate(s) refused (LOCAL_GIT_BOUNDARY_REFUSED); discovery is incomplete.` : ''}`,
      itemCount: commits.length,
    },
    warnings,
  }
}
