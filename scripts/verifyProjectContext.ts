import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import fg from 'fast-glob'
import {
  extractMarkdownLinkTargets,
  parsePromptLibrary,
  parseSkillFrontmatter,
  parseGitIndexEntries,
  resolveRepositoryLinkTarget,
  validateTrackedTextForWindowsUserHomePaths,
  validateAgentFrictionParity,
  validateContinuousWorkProtocol,
  validateContinuationSkillParity,
  validatePromptLibrary,
  validatePromptParityManifest,
  validatePromptSource,
  validateCurrentStateDocument,
  validateTierDeclaration,
  type PromptSourceClassification,
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
  '.agent-harness/governor.yaml',
  '.agent-harness/prompt-parity.json',
  '.agent-harness/tier.json',
  '.agents/skills/developer-lens-continuation/SKILL.md',
  '.agents/skills/developer-lens-continuation/agents/openai.yaml',
  '.claude/agents/dl-implementer.md',
  '.claude/agents/dl-mechanic.md',
  '.claude/agents/dl-reviewer.md',
  '.claude/agents/dl-scout.md',
  '.claude/settings.json',
  '.claude/skills/developer-lens-continuation/SKILL.md',
  'AGENTS.md',
  'CLAUDE.md',
  'HUMAN_TODO.md',
  'README.md',
  'docs/DEVELOPER_LENS_V2_ARCHITECTURE.md',
  'docs/IMPLEMENTATION_LEDGER.md',
  'docs/OWNER_CONSTITUTION.md',
  'docs/PROGRAMME_ROADMAP.md',
  'docs/agent-system/CONTINUOUS_WORK_PROTOCOL.md',
  'docs/agent-system/CROSS_REPO_CONTRACT.md',
  'docs/agent-system/FRICTION_LOG.md',
  'docs/agent-system/IDEA_PROTOCOL.md',
  'docs/agent-system/MAINTENANCE_PROTOCOL.md',
  'docs/agent-system/PROMPT_LIBRARY.md',
  'docs/agent-system/README.md',
  'docs/agent-system/WORK_CLASSES.md',
  'docs/analyser-program/CURRENT_STATE.md',
  'docs/analyser-program/07_DELIVERY_ROADMAP.md',
  'docs/data-charter.md',
  'docs/source-capability-matrix.md',
] as const

requiredFiles.forEach(requireFile)

if (failures.length === 0) {
  for (const error of validateCurrentStateDocument(read('docs/analyser-program/CURRENT_STATE.md'))) {
    failures.push(`current state: ${error}`)
  }

  try {
    const tier = JSON.parse(read('.agent-harness/tier.json')) as unknown
    for (const error of validateTierDeclaration(tier)) {
      failures.push(`tier declaration drift: ${error}`)
    }
  } catch (error) {
    failures.push(`tier declaration is not valid JSON: ${String(error)}`)
  }

  const governorPolicy = read('.agent-harness/governor.yaml')
  const governorRequiredKeys = [
    'governor_schema_version',
    'owner_policy',
    'authority_files',
    'model_roles',
    'risk_tiers',
    'queues',
    'review_merge_protocol',
    'cross_repo',
  ] as const
  for (const key of governorRequiredKeys) {
    if (!new RegExp(`^${key}:`, 'm').test(governorPolicy)) {
      failures.push(`.agent-harness/governor.yaml must declare top-level key: ${key}`)
    }
  }
  if (/[0-9a-f]{40}/.test(governorPolicy)) {
    failures.push(
      '.agent-harness/governor.yaml must stay low-volatility; it must not embed a commit SHA',
    )
  }
  const expectedGovernorQueue = [
    'queue_hop_order: [truth-and-red-state, active-delivery-wave, unblockers, mission-delivery,',
    '                    maintenance-and-hardening, critic-approved-idea-or-polish]',
  ].join('\n')
  if (!governorPolicy.includes(expectedGovernorQueue)) {
    failures.push(
      '.agent-harness/governor.yaml queue_hop_order must match the six-step delivery-first continuous queue',
    )
  }
  if (
    !governorPolicy.includes('stable Product/Lab IDs, not full-body parity') ||
    !governorPolicy.includes('only shared blocks and the repo-neutral manifest are byte-identical')
  ) {
    failures.push(
      '.agent-harness/governor.yaml must distinguish stable common IDs from shared-block and manifest byte identity',
    )
  }

  for (const coldStartFile of ['AGENTS.md', 'CLAUDE.md'] as const) {
    const lines = read(coldStartFile).split('\n').length
    if (lines > 100) {
      failures.push(`${coldStartFile} exceeds the T2 context budget: ${lines} lines (maximum 100)`)
    }
  }

  const continuationSkills = [
    '.agents/skills/developer-lens-continuation/SKILL.md',
    '.claude/skills/developer-lens-continuation/SKILL.md',
  ] as const
  for (const skillPath of continuationSkills) {
    const skill = read(skillPath)
    const parsedSkill = parseSkillFrontmatter(skill)
    for (const error of parsedSkill.errors) {
      failures.push(`${skillPath} frontmatter is invalid: ${error}`)
    }
    if (skill.includes('[TODO') || skill.includes('TODO:')) {
      failures.push(`${skillPath} still contains template TODO text`)
    }
  }
  for (const error of validateContinuationSkillParity(
    continuationSkills.map((path) => ({ path, contents: read(path) })),
  )) {
    failures.push(`continuation skill parity: ${error}`)
  }
  const agentFrictionFiles = [
    '.claude/agents/dl-implementer.md',
    '.claude/agents/dl-mechanic.md',
    '.claude/agents/dl-reviewer.md',
    '.claude/agents/dl-scout.md',
  ] as const
  for (const error of validateAgentFrictionParity(
    agentFrictionFiles.map((path) => ({ path, contents: read(path) })),
  )) {
    failures.push(`agent friction parity: ${error}`)
  }

  try {
    const settings = JSON.parse(read('.claude/settings.json')) as Record<string, unknown>
    const settingsText = JSON.stringify(settings)
    if (settingsText.includes('bypassPermissions')) {
      failures.push(
        '.claude/settings.json must not commit bypassPermissions; it belongs in gitignored .claude/settings.local.json',
      )
    }
    const permissions = settings['permissions'] as Record<string, unknown> | undefined
    const deny = Array.isArray(permissions?.['deny']) ? (permissions['deny'] as unknown[]) : []
    const requiredDenies = [
      'Read(./.developer-lens/**)',
      'Read(./dist/**)',
      'Read(./public/data/**)',
    ]
    for (const rule of requiredDenies) {
      if (!deny.includes(rule)) {
        failures.push(`.claude/settings.json must keep the protected-path deny rule: ${rule}`)
      }
    }
  } catch (error) {
    failures.push(`.claude/settings.json is not valid JSON: ${String(error)}`)
  }

  try {
    const trackedLocalSettings = execFileSync(
      'git',
      ['ls-files', '--cached', '--', '.claude/settings.local.json'],
      { cwd: root, encoding: 'utf8' },
    ).trim()
    if (trackedLocalSettings.length > 0) {
      failures.push(
        '.claude/settings.local.json is tracked; machine-local trust settings must stay gitignored',
      )
    }
  } catch {
    // Not a git checkout (e.g. exported archive): the tracked-file guard cannot apply.
  }

  const skillInterface = read('.agents/skills/developer-lens-continuation/agents/openai.yaml')
  if (!skillInterface.includes('$developer-lens-continuation')) {
    failures.push('continuation skill default prompt must mention $developer-lens-continuation')
  }

  // Prompt operating system (#214 / lab #33): manifest, active sources, and the classification of
  // every prompt-shaped document that is NOT the canonical library.
  const promptSourceClassification: Record<string, PromptSourceClassification> = {
    'docs/OVERNIGHT_EXECUTION_PROMPT.md': { kind: 'redirect', target: 'DL-P03-OVERNIGHT-CONTINUOUS' },
    'docs/SOL_ULTRA_ORCHESTRATOR_PROMPT.md': { kind: 'redirect', target: 'DL-P01-FLAGSHIP-GOVERNOR' },
    'docs/SOL_ULTRA_DEEP_DISCOVERY_PROMPT.md': {
      kind: 'historical',
      target: 'DL-PX01-PRODUCT-DEEP-DISCOVERY',
    },
  }

  let manifestForLibrary: ReturnType<typeof validatePromptParityManifest>['manifest']
  try {
    const parsedManifest = validatePromptParityManifest(
      JSON.parse(read('.agent-harness/prompt-parity.json')) as unknown,
    )
    for (const error of parsedManifest.errors) {
      failures.push(`prompt parity manifest: ${error}`)
    }
    manifestForLibrary = parsedManifest.manifest
  } catch (error) {
    failures.push(`.agent-harness/prompt-parity.json is not valid JSON: ${String(error)}`)
  }

  const library = parsePromptLibrary(read('docs/agent-system/PROMPT_LIBRARY.md'))
  const activePromptIds = library.prompts
    .filter((prompt) => prompt.status === 'active')
    .map((prompt) => prompt.id)

  if (manifestForLibrary) {
    const localSlug = String(
      (
        (JSON.parse(read('.agent-harness/tier.json')) as Record<string, unknown>)[
          'public_synthetic_publication'
        ] as Record<string, unknown> | undefined
      )?.['repository'] ?? '',
    )
    for (const error of validatePromptLibrary(library, manifestForLibrary, localSlug)) {
      failures.push(`prompt library: ${error}`)
    }
  } else {
    for (const error of library.errors) {
      failures.push(`prompt library: ${error}`)
    }
  }

  for (const error of validateContinuousWorkProtocol(
    read('docs/agent-system/CONTINUOUS_WORK_PROTOCOL.md'),
  )) {
    failures.push(`continuous work protocol: ${error}`)
  }

  for (const [path, classification] of Object.entries(promptSourceClassification)) {
    if (!existsSync(resolve(root, path))) {
      failures.push(`missing classified prompt source: ${path}`)
      continue
    }
    for (const error of validatePromptSource(classification, read(path), activePromptIds)) {
      failures.push(`${path}: ${error}`)
    }
  }
}

const authorityMarkers: Record<string, readonly string[]> = {
  'AGENTS.md': ['CLAUDE.md', 'G1 and G2 are owner-approved', 'G3 is standing-approved', 'G4 is owner-approved only for OpenAI'],
  'CLAUDE.md': [
    'G1 and G2 are owner-approved',
    'G3 is standing-approved',
    'G4 is owner-approved only for OpenAI `gpt-5.6-luna`',
    '`cap.external.model` remains `never_authorized`',
    'Protected-data rule',
  ],
  'HUMAN_TODO.md': ['G1 and G2 are owner-approved', 'G3 standing authorization is owner-approved', 'G4 is owner-approved only for the OpenAI/GPT-5.6-Luna boundary'],
  'docs/data-charter.md': ['G1 and G2 are approved', 'standing G3 authorization', 'G4 is approved 2026-08-04 only for the bounded OpenAI'],
  'docs/source-capability-matrix.md': ['G2 is satisfied', 'Standing G3 authorization', 'G4 is satisfied only for the OpenAI'],
  'docs/DEVELOPER_LENS_V2_ARCHITECTURE.md': ['G2 is approved', 'G3 sources have standing authorization', 'G4 is approved only for the OpenAI'],
  'docs/OWNER_CONSTITUTION.md': [
    'Locked invariants (owner red lines R2+R3+R6',
    'A5 model routing (supersedes HUMAN_TODO q-9, runtime-verified 2026-08-08)',
    'Recorded supersessions and reconciliations',
  ],
  'docs/IMPLEMENTATION_LEDGER.md': ['G1 and G2 are owner-approved', 'G3 standing authorization', 'G4 is owner-approved only for OpenAI'],
  // docs/OVERNIGHT_EXECUTION_PROMPT.md no longer restates authority: it is a classified redirect to
  // DL-P03-OVERNIGHT-CONTINUOUS, whose body carries the authority reads. The prompt-parity manifest
  // and the prompt-source classification above replace its bespoke marker checks.
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
    failures.push(`${path} describes the approved G4 boundary as refused`)
  }
}

const swarmMarkers: Record<string, readonly string[]> = {
  'AGENTS.md': ['discover the live collaboration ceiling', 'keep every useful Luna slot occupied'],
  '.agents/skills/developer-lens-continuation/SKILL.md': [
    'discover the live collaboration ceiling',
    'replenish slots as results arrive',
  ],
}

for (const [path, markers] of Object.entries(swarmMarkers)) {
  const contents = read(path).replace(/\s+/g, ' ')
  for (const marker of markers) {
    if (!contents.includes(marker)) {
      failures.push(`${path} is missing swarm-routing marker: ${marker}`)
    }
  }
}

const markdownFiles = await fg(['*.md', 'docs/**/*.md', '.agents/**/*.md', '.claude/**/*.md'], {
  cwd: root,
  dot: true,
  onlyFiles: true,
  ignore: ['**/node_modules/**', '.claude/worktrees/**'],
})

if (existsSync(resolve(root, '.git'))) {
  for (const error of validateTrackedTextForWindowsUserHomePaths({
    listEntries: () => parseGitIndexEntries(execFileSync('git', ['ls-files', '--stage', '-z'], {
      cwd: root,
      encoding: 'buffer',
    })),
    readBlob: (objectId) => execFileSync('git', ['cat-file', 'blob', objectId], { cwd: root }),
  })) {
    failures.push(`tracked text: ${error}`)
  }
} else {
  // Not a git checkout (e.g. exported archive): the tracked-text guard cannot apply.
}

for (const path of markdownFiles) {
  const contents = read(path)
  if (
    path !== 'docs/agent-system/PROMPT_LIBRARY.md' &&
    /^<!-- prompt-id: /m.test(contents)
  ) {
    failures.push(
      `${path} declares an executable prompt-id marker; the only executable prompt surface is docs/agent-system/PROMPT_LIBRARY.md`,
    )
  }
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
