import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  validateIssueTemplateConfig,
  validateIssueTemplateFrontmatter,
} from './issueTemplateValidation.js'

const root = process.cwd()
const templateDirectory = resolve(root, '.github', 'ISSUE_TEMPLATE')

async function repositoryLabels(): Promise<ReadonlySet<string> | undefined> {
  if (process.env['GITHUB_ACTIONS'] !== 'true') return undefined

  const repository = process.env['GITHUB_REPOSITORY']
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY is missing or invalid')
  }
  const apiBase = process.env['GITHUB_API_URL'] ?? 'https://api.github.com'
  const token = process.env['GITHUB_TOKEN']
  if (!token) {
    throw new Error('GITHUB_TOKEN is missing; refusing unauthenticated label lookup')
  }
  const labels = new Set<string>()

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      `${apiBase}/repos/${repository}/labels?per_page=100&page=${page}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'developer-lens-context-verifier',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )
    if (!response.ok) {
      throw new Error(`GitHub labels request failed with status ${response.status}`)
    }
    const payload = await response.json() as unknown
    if (!Array.isArray(payload)) throw new Error('GitHub labels response is not an array')

    for (const entry of payload) {
      if (
        entry !== null &&
        typeof entry === 'object' &&
        typeof (entry as { name?: unknown }).name === 'string'
      ) {
        labels.add((entry as { name: string }).name)
      }
    }
    if (payload.length < 100) return labels
  }

  throw new Error('GitHub label pagination exceeded the verifier ceiling')
}

const failures: string[] = []
const config = await readFile(resolve(templateDirectory, 'config.yml'), 'utf8')
failures.push(...validateIssueTemplateConfig(config))

let labels: ReadonlySet<string> | undefined
try {
  labels = await repositoryLabels()
} catch (error) {
  failures.push(`issue-template label lookup failed: ${String(error)}`)
}

const templates = (await readdir(templateDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => entry.name)
  .sort()

for (const template of templates) {
  const source = await readFile(resolve(templateDirectory, template), 'utf8')
  failures.push(...validateIssueTemplateFrontmatter(template, source, labels))
}

if (failures.length > 0) {
  console.error('Issue-template verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  const labelProof = labels
    ? `${labels.size} live repository labels`
    : 'frontmatter structure (live labels are checked by GitHub Actions)'
  console.log(`Verified ${templates.length} issue templates, config YAML, and ${labelProof}.`)
}
