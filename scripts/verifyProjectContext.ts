import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import fg from 'fast-glob'
import {
  extractMarkdownLinkTargets,
  parseSkillFrontmatter,
  resolveRepositoryLinkTarget,
  validateTierDeclaration,
} from './projectContextValidation.js'

const root = process.cwd()
const failures: string[] = []

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n')
}

function requireFile(path: string): void {
  if (!existsSync(resolve(root, path))) {
    failures.push(`missing required context file: ${path}`)
  }
}

const requiredFiles = [
  '.agent-harness/tier.json',
  '.agents/skills/developer-lens-continuation/SKILL.md',
  '.agents/skills/developer-lens-continuation/agents/openai.yaml',
  'AGENTS.md',
  'HUMAN_TODO.md',
  'README.md',
  'docs/DEVELOPER_LENS_V2_ARCHITECTURE.md',
  'docs/IMPLEMENTATION_LEDGER.md',
  'docs/data-charter.md',
  'docs/source-capability-matrix.md',
] as const

requiredFiles.forEach(requireFile)

if (failures.length === 0) {
  try {
    const tier = JSON.parse(read('.agent-harness/tier.json')) as unknown
    for (const error of validateTierDeclaration(tier)) {
      failures.push(`tier declaration drift: ${error}`)
    }
  } catch (error) {
    failures.push(`tier declaration is not valid JSON: ${String(error)}`)
  }

  const agentLines = read('AGENTS.md').split('\n').length
  if (agentLines > 100) {
    failures.push(`AGENTS.md exceeds the T2 context budget: ${agentLines} lines (maximum 100)`)
  }

  const skill = read('.agents/skills/developer-lens-continuation/SKILL.md')
  const parsedSkill = parseSkillFrontmatter(skill)
  for (const error of parsedSkill.errors) {
    failures.push(`continuation skill frontmatter is invalid: ${error}`)
  }
  if (skill.includes('[TODO') || skill.includes('TODO:')) {
    failures.push('continuation skill still contains template TODO text')
  }

  const skillInterface = read('.agents/skills/developer-lens-continuation/agents/openai.yaml')
  if (!skillInterface.includes('$developer-lens-continuation')) {
    failures.push('continuation skill default prompt must mention $developer-lens-continuation')
  }
}

const authorityMarkers: Record<string, readonly string[]> = {
  'AGENTS.md': ['G1 and G2 are owner-approved', 'G3 is standing-approved', 'G4 is open and not approved'],
  'HUMAN_TODO.md': ['G1 and G2 are owner-approved', 'G3 standing authorization is owner-approved', 'G4 remains open and is not approved'],
  'docs/data-charter.md': ['G1 and G2 are approved', 'standing G3 authorization', 'G4 is open and not approved'],
  'docs/source-capability-matrix.md': ['G2 is satisfied', 'Standing G3 authorization', 'G4 is open and not approved'],
  'docs/DEVELOPER_LENS_V2_ARCHITECTURE.md': ['G2 is approved', 'G3 sources have standing authorization', 'G4 is open and not approved'],
  'docs/IMPLEMENTATION_LEDGER.md': ['G1 and G2 are owner-approved', 'G3 standing authorization', 'G4 remains open and unapproved'],
  'docs/OVERNIGHT_EXECUTION_PROMPT.md': ['G1 and G2 are approved', 'G3 standing authorization', 'G4 remains open and is not approved'],
}

for (const [path, markers] of Object.entries(authorityMarkers)) {
  if (!existsSync(resolve(root, path))) {
    continue
  }
  const contents = read(path).replace(/\s+/g, ' ')
  for (const marker of markers) {
    if (!contents.includes(marker)) {
      failures.push(`${path} is missing authority marker: ${marker}`)
    }
  }
}

const liveAuthorityFiles = Object.keys(authorityMarkers)
for (const path of liveAuthorityFiles) {
  if (!existsSync(resolve(root, path))) {
    continue
  }
  const contents = read(path)
  if (/G4 (?:is )?refused|G4 refusal/i.test(contents)) {
    failures.push(`${path} still describes the open G4 gate as refused`)
  }
}

const markdownFiles = await fg(['*.md', 'docs/**/*.md', '.agents/**/*.md'], {
  cwd: root,
  dot: true,
  onlyFiles: true,
})

for (const path of markdownFiles) {
  const contents = read(path)
  for (const rawTarget of extractMarkdownLinkTargets(contents)) {
    const resolution = resolveRepositoryLinkTarget(root, path, rawTarget)
    if (resolution.kind === 'skip') {
      continue
    }
    if (resolution.kind === 'invalid') {
      failures.push(`${path} contains an invalid local link (${resolution.reason})`)
      continue
    }
    if (!existsSync(resolution.target)) {
      failures.push(`${path} contains a missing local link target: ${rawTarget}`)
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`CONTEXT_VERIFY: ${failure}`)
  }
  process.exitCode = 1
} else {
  console.log(`Context verification passed (${markdownFiles.length} Markdown files, ${requiredFiles.length} required files).`)
}
