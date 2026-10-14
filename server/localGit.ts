import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { basename, normalize } from 'node:path'
import { promisify } from 'node:util'
import { discoverLocalGitCandidates } from './localGitDiscovery.js'
import type {
  CoverageSource,
  RawCommit,
  RawRepository,
} from '../shared/types.js'
import { COLLECTION_WARNINGS } from './collectionWarnings.js'
import { classifyCommit } from './github.js'

const execFileAsync = promisify(execFile)

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
  const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })
  return stdout.trim()
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

async function discoverRepositories(roots: string[]): Promise<{ repositories: string[]; failedLocations: number }> {
  const discovery = await discoverLocalGitCandidates(roots)
  let failedLocations = discovery.failedLocations

  const entries: Array<{ topLevel: string; commonDirectory: string }> = []
  for (const candidate of discovery.candidates) {
    try {
      const topLevel = await git(candidate, ['rev-parse', '--show-toplevel'])
      const commonDirectory = await git(candidate, [
        'rev-parse',
        '--path-format=absolute',
        '--git-common-dir',
      ])
      entries.push({ topLevel, commonDirectory })
    } catch {
      // Preserve incomplete discovery without retaining paths or exception text.
      failedLocations++
    }
  }

  return { repositories: await dedupeByIdentity(entries), failedLocations }
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

  const { repositories, failedLocations } = await discoverRepositories(roots)
  const rawRepositories: RawRepository[] = []
  const commits: RawCommit[] = []
  const warnings: string[] = []
  let successfulInspections = 0
  const seenIds = new Set<string>()
  let identityCollisions = 0

  for (const repositoryPath of repositories) {
    try {
      const remote = await git(repositoryPath, ['remote', 'get-url', 'origin']).catch(
        () => '',
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
    } catch {
      warnings.push(COLLECTION_WARNINGS.localRepositoryUnreadable(basename(repositoryPath)))
    }
  }

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
        warnings.length === 0 && failedLocations === 0
          ? 'complete'
          : successfulInspections > 0
            ? 'partial'
            : 'unavailable',
      detail: `${successfulInspections} explicitly selected repositories successfully inspected within the no-symlink, six-level discovery scope; only aggregate commit features are retained.${failedLocations > 0 ? ` ${failedLocations} discovery check(s) failed; discovery is incomplete.` : ''}`,
      itemCount: commits.length,
    },
    warnings,
  }
}
