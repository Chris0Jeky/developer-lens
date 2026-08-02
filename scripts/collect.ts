import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { subMonths } from 'date-fns'
import type { RangeKey, RawDataset } from '../shared/types.js'
import { analyzeDataset } from '../server/analytics.js'
import {
  dashboardPath,
  PRIVATE_DATA_DIRECTORY,
  rawPath,
} from '../server/dataStore.js'
import { collectGithub } from '../server/github.js'
import { collectLocalGit } from '../server/localGit.js'

const execFileAsync = promisify(execFile)

function parseArguments(argv: string[]) {
  const roots: string[] = []
  const ranges = new Set<RangeKey>()
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--local-root' && argv[index + 1]) {
      roots.push(argv[index + 1])
      index += 1
    } else if (argument.startsWith('--local-root=')) {
      roots.push(argument.slice('--local-root='.length))
    } else if (argument === '--range' && argv[index + 1]) {
      const value = argv[index + 1]
      if (value === '6m' || value === '12m') ranges.add(value)
      index += 1
    } else if (argument.startsWith('--range=')) {
      const value = argument.slice('--range='.length)
      if (value === '6m' || value === '12m') ranges.add(value)
    }
  }

  const environmentRoots = (process.env.DEV_LENS_LOCAL_ROOTS ?? '')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
  return {
    roots: [...new Set([...roots, ...environmentRoots])],
    ranges: ranges.size > 0 ? [...ranges] : (['6m', '12m'] as RangeKey[]),
  }
}

async function gitConfig(key: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['config', '--global', key], {
      encoding: 'utf8',
      windowsHide: true,
    })
    return stdout.trim()
  } catch {
    return ''
  }
}

function mergeLocal(raw: RawDataset, local: Awaited<ReturnType<typeof collectLocalGit>>) {
  const repositories = new Map(
    raw.repositories.map((repository) => [repository.nameWithOwner.toLowerCase(), repository]),
  )
  for (const repository of local.repositories) {
    if (!repositories.has(repository.nameWithOwner.toLowerCase())) {
      repositories.set(repository.nameWithOwner.toLowerCase(), repository)
    }
  }
  return {
    ...raw,
    repositories: [...repositories.values()],
    commits: [...raw.commits, ...local.commits],
    coverage: [...raw.coverage, local.coverage],
    warnings: [...raw.warnings, ...local.warnings],
  }
}

async function collectRange(
  range: RangeKey,
  roots: string[],
  identities: { emails: string[] },
) {
  const months = range === '6m' ? 6 : 12
  const to = new Date().toISOString()
  const from = subMonths(new Date(to), months).toISOString()
  console.log(`Collecting the ${months}-month GitHub lens…`)
  const github = await collectGithub(range, from, to)
  console.log(
    `GitHub returned ${github.contributionTotal} contribution signals across ${github.repositories.length} repositories.`,
  )

  const local = await collectLocalGit(roots, from, to, identities)
  if (roots.length > 0) {
    console.log(`Local enrichment found ${local.commits.length} attributed commits.`)
  }

  const raw = mergeLocal(github, local)
  const dashboard = analyzeDataset(raw)
  await writeFile(rawPath(range), JSON.stringify(raw, null, 2), 'utf8')
  await writeFile(dashboardPath(range), JSON.stringify(dashboard, null, 2), 'utf8')
  console.log(
    `Saved a local-only ${range} dashboard with ${dashboard.insights.length} evidence-backed insights.`,
  )
}

async function main() {
  const { roots, ranges } = parseArguments(process.argv.slice(2))
  await mkdir(PRIVATE_DATA_DIRECTORY, { recursive: true })
  const email = await gitConfig('user.email')
  const configuredEmails = (process.env.DEV_LENS_GIT_EMAILS ?? '')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
  const identities = {
    emails: [...new Set([email, ...configuredEmails].filter(Boolean))],
  }

  for (const range of ranges) {
    await collectRange(range, roots, identities)
  }

  console.log(
    'Collection complete. No credential, diff, body, filename, or raw commit subject was stored.',
  )
}

main().catch((error: Error) => {
  console.error(`Collection failed: ${error.message}`)
  process.exitCode = 1
})
