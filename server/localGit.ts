import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import { basename, dirname, join, normalize, resolve } from 'node:path'
import { promisify } from 'node:util'
import fg from 'fast-glob'
import type {
  CoverageSource,
  RawCommit,
  RawRepository,
} from '../shared/types.js'
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

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
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

async function discoverRepositories(roots: string[]): Promise<string[]> {
  const candidates = new Set<string>()

  for (const rootInput of roots) {
    const root = resolve(rootInput)
    if (!(await exists(root))) continue
    if (await exists(join(root, '.git'))) candidates.add(root)

    const matches = await fg('**/.git', {
      cwd: root,
      absolute: true,
      dot: true,
      onlyFiles: false,
      followSymbolicLinks: false,
      deep: 6,
      suppressErrors: true,
      ignore: [
        '**/node_modules/**',
        '**/.venv/**',
        '**/vendor/**',
        '**/.cache/**',
        '**/dist/**',
        '**/build/**',
      ],
    })
    for (const match of matches) candidates.add(dirname(match))
  }

  const repositories = new Map<string, string>()
  for (const candidate of candidates) {
    try {
      const topLevel = await git(candidate, ['rev-parse', '--show-toplevel'])
      const commonDirectory = await git(candidate, [
        'rev-parse',
        '--path-format=absolute',
        '--git-common-dir',
      ])
      repositories.set(normalize(commonDirectory).toLowerCase(), topLevel)
    } catch {
      // A stale or inaccessible .git marker is ignored and reported by count.
    }
  }

  return [...repositories.values()]
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
      warnings: [
        'Local Git enrichment was skipped because no unambiguous author email identity was configured.',
      ],
    }
  }

  const repositories = await discoverRepositories(roots)
  const rawRepositories: RawRepository[] = []
  const commits: RawCommit[] = []
  const warnings: string[] = []

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
      if (matched.length === 0) continue

      rawRepositories.push({
        id: `local:${nameWithOwner.toLowerCase()}`,
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
      warnings.push(
        `${basename(repositoryPath)} could not be read; it was excluded from local enrichment.`,
      )
    }
  }

  return {
    commits,
    repositories: rawRepositories,
    coverage: {
      id: 'local-git',
      label: 'Local Git enrichment',
      status:
        warnings.length === 0
          ? 'complete'
          : commits.length > 0
            ? 'partial'
            : 'unavailable',
      detail: `${repositories.length} explicitly selected repositories inspected; only aggregate commit features are retained.`,
      itemCount: commits.length,
    },
    warnings,
  }
}
