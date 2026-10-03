import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { repositoryLabels } from './githubRepositoryLabels.js'
import {
  validateIssueTemplateConfig,
  validateIssueTemplateFrontmatter,
} from './issueTemplateValidation.js'

const root = process.cwd()
const templateDirectory = resolve(root, '.github', 'ISSUE_TEMPLATE')

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
