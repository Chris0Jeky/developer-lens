import { createHash } from 'node:crypto'
import { dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path'
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

/** Non-shared Product-only clauses that keep the overnight launcher delivery-led. */
export const FLAGSHIP_OVERNIGHT_DELIVERY_REQUIRED_CLAUSES = [
  'FLAGSHIP OVERNIGHT DELIVERY GOVERNOR',
  'tangible product/research value',
  'IMPACT CONTRACT',
  'MISSION DELIVERY',
  'FINISH-BEFORE-EXPAND',
  'Pure docs/admin work is eligible only when it corrects a safety-relevant false operational claim, satisfies an explicit request, or directly unblocks delivery.',
  'You own authority, architecture, orchestration, sequencing,',
  'conflict resolution and final merge judgment.',
  'You do not write implementation code yourself.',
  'experiment and evaluation work within Product authority and existing tracked/pre-approved',
  'bounds; Lab owns novel methodology.',
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
        for (const clause of FLAGSHIP_OVERNIGHT_DELIVERY_REQUIRED_CLAUSES) {
          if (!body.includes(clause)) {
            errors.push(`flagship overnight prompt is missing required delivery clause: ${clause}`)
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
