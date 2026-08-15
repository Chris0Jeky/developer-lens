import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import {
  COMMON_PROMPT_IDS,
  CONTINUOUS_SECTION_MARKERS,
  FLAGSHIP_OVERNIGHT_DELIVERY_CONTRACT,
  PRODUCT_CLAUDE_ROUTING_CLAUSE,
  PRODUCT_CLAUDE_ROUTING_TOKENS,
  RETIRED_PROMPT_SENTINEL,
  extractMarkdownLinkTargets,
  containsWindowsUserHomePath,
  findBareHumanRefs,
  isTrackedTextPathEligible,
  normalizeSharedText,
  parsePromptLibrary,
  parseSkillFrontmatter,
  resolveRepositoryLinkTarget,
  sharedBlockDigest,
  validateAgentFrictionParity,
  validateContinuousWorkProtocol,
  validateContinuationSkillParity,
  validateCurrentStateDocument,
  validatePromptLibrary,
  validatePromptParityManifest,
  validatePromptSource,
  validateTierDeclaration,
  validateTrackedTextForWindowsUserHomePaths,
} from './projectContextValidation.js'

describe('project context validation', () => {
  it('separates Markdown destinations from optional titles', () => {
    expect(
      extractMarkdownLinkTargets(
        '[guide](docs/guide.md "Guide") [spaced](<docs/another guide.md> \'Another\')',
      ),
    ).toEqual(['docs/guide.md', 'docs/another guide.md'])
    expect(extractMarkdownLinkTargets('[architecture\nnotes](docs/architecture.md)')).toEqual([
      'docs/architecture.md',
    ])
    expect(extractMarkdownLinkTargets('[architecture\n\nnotes](docs/architecture.md)')).toEqual([])
  })

  it('rejects local paths outside the checkout before filesystem access', () => {
    const root = resolve('fixture-repository')

    expect(resolveRepositoryLinkTarget(root, 'docs/guide.md', '../../private.txt')).toEqual({
      kind: 'invalid',
      reason: 'target escapes repository root: ../../private.txt',
    })
    expect(resolveRepositoryLinkTarget(root, 'docs/guide.md', '..%2F..%2Fprivate.txt')).toEqual({
      kind: 'invalid',
      reason: 'target escapes repository root: ..%2F..%2Fprivate.txt',
    })
    expect(resolveRepositoryLinkTarget(root, 'docs/guide.md', 'C:\\private.txt').kind).toBe('invalid')
  })

  it('resolves repository-local links and skips web destinations', () => {
    const root = resolve('fixture-repository')

    expect(resolveRepositoryLinkTarget(root, 'docs/guide.md', '../README.md')).toEqual({
      kind: 'local',
      target: resolve(root, 'README.md'),
    })
    expect(resolveRepositoryLinkTarget(root, 'docs/guide.md', 'https://example.com')).toEqual({
      kind: 'skip',
    })
    expect(resolveRepositoryLinkTarget(root, 'docs/guide.md', 'part%231.md#section')).toEqual({
      kind: 'local',
      target: resolve(root, 'docs', 'part#1.md'),
    })
  })

  it('rejects Windows user-home paths in tracked text without exposing the matched literal', () => {
    const forwardHome = ['C:', 'Users', 'FixtureUser', 'workspace'].join('/')
    const backwardHome = ['c:', 'USERS', 'FixtureUser', 'workspace'].join('\\')
    expect(containsWindowsUserHomePath(`source: ${forwardHome}`)).toBe(true)
    expect(containsWindowsUserHomePath(`source: ${backwardHome}`)).toBe(true)
    expect(containsWindowsUserHomePath('source: C:/Synthetic/FixtureUser/workspace')).toBe(false)

    const errors = validateTrackedTextForWindowsUserHomePaths(
      ['docs/guide.md'],
      () => `source: ${forwardHome}`,
    )
    expect(errors).toEqual(['docs/guide.md: contains a Windows user-home path'])
    expect(errors.join('\n')).not.toContain('FixtureUser')
  })

  it('excludes protected and generated tracked paths before a text read', () => {
    const reads: string[] = []
    const errors = validateTrackedTextForWindowsUserHomePaths(
      [
        '.developer-lens/private.md',
        '.developer-lens-synthetic/fixture.md',
        '.agent-harness/runtime/cache.md',
        '.claude/worktrees/temporary.md',
        'coverage/report.md',
        'dist/index.html',
        'dist-ssr/index.js',
        'node_modules/package/readme.md',
        'public/data/dashboard-fixture.json',
        'docs/guide.md',
      ],
      (path) => {
        reads.push(path)
        return 'C:/Synthetic/FixtureUser/workspace'
      },
    )

    expect(errors).toEqual([])
    expect(reads).toEqual(['docs/guide.md'])
    expect(isTrackedTextPathEligible('PUBLIC\\DATA\\dashboard.json')).toBe(false)
  })

  it('requires complete, closed skill frontmatter with only supported keys', () => {
    const valid = [
      '---',
      'name: developer-lens-continuation',
      'description: Resume Developer Lens safely.',
      '---',
      '',
      '# Workflow',
    ].join('\n')

    expect(parseSkillFrontmatter(valid).errors).toEqual([])
    expect(parseSkillFrontmatter(valid.replace('\n---\n\n# Workflow', '\n# Workflow')).errors).toContain(
      'frontmatter must have a closing --- delimiter',
    )
    expect(parseSkillFrontmatter(valid.replace('description:', 'unsupported:')).errors).toContain(
      'unsupported frontmatter key: unsupported',
    )
    expect(parseSkillFrontmatter(valid.replace('Resume Developer Lens safely.', '"unterminated')).errors).toContain(
      'unterminated quoted scalar: "unterminated',
    )
    for (const typedScalar of ['[]', '{}', 'true', '42', '.5', '2026-08-04', '? foo']) {
      expect(
        parseSkillFrontmatter(valid.replace('Resume Developer Lens safely.', typedScalar)).errors,
      ).toContain(`plain scalar must remain a string: ${typedScalar}`)
    }
    expect(parseSkillFrontmatter(valid.replace('Resume Developer Lens safely.', '2026-08-04 release workflow'))).toEqual({
      value: { name: 'developer-lens-continuation', description: '2026-08-04 release workflow' },
      errors: [],
    })
  })

  it('detects drift in security and publication authority', () => {
    const tier = {
      tier: 2,
      name: 'daily-driver',
      authority: { push: 'free', merge: 'free' },
      public_synthetic_publication: {
        remote: 'origin',
        repository: 'Chris0Jeky/developer-lens',
      },
      flags: {
        sensitive_data: true,
        wave_mode: false,
        dormant_production: false,
        relaxed_work_loss_guards: false,
      },
      human_todo: 'HUMAN_TODO.md',
    }

    expect(validateTierDeclaration(tier)).toEqual([])
    expect(validateTierDeclaration({ ...tier, flags: { ...tier.flags, sensitive_data: false } })).toEqual([
      'flags.sensitive_data must be true (received false)',
    ])
  })

  it('validates the single machine-readable current state YAML block', () => {
    const state = (yaml: string): string => `# Current state\n\n\`\`\`yaml\n${yaml}\n\`\`\`\n`
    const validYaml = [
      "updated: '2026-08-10'",
      "active_slice: 'current: # safe'",
      "next_value_slice: 'next: it''s safe'",
      'blockers: >-',
      '  none: # quoted prose is not a mapping',
      "last_verified_checks: 'focused test'",
      'active_horizon:',
      "  - 'first: # item'",
      "  - 'second''s item'",
    ].join('\n')
    const semanticYaml = [
      "updated: '2026-08-10'",
      "active_slice: 'current'",
      "next_value_slice: 'next'",
      "blockers: 'none'",
      "last_verified_checks: 'focused test'",
      "active_horizon: ['first: # item', 'second''s item']",
    ].join('\n')

    expect(validateCurrentStateDocument(state(validYaml))).toEqual([])
    expect(validateCurrentStateDocument(state(validYaml).replaceAll('\n', '\r\n'))).toEqual([])
    const currentState = readFileSync(resolve('docs/analyser-program/CURRENT_STATE.md'), 'utf8')
    const currentStateYaml = currentState.match(/^```yaml\r?\n([\s\S]*?)^```\r?$/m)?.[1] ?? ''
    expect(validateCurrentStateDocument(currentState)).toEqual([])
    expect(parseDocument(currentStateYaml, { version: '1.2', schema: 'core' }).toJS().active_horizon).toEqual([
      'P0 governor bootstrap PR #206 — delivered',
      'P0.5 v0.1.0 release programme #200 — active, product-only release preparation',
    ])
    expect(
      validateCurrentStateDocument(state(semanticYaml.replace("updated: '2026-08-10'", "updated: '2024-02-29'"))),
    ).toEqual([])
    expect(validateCurrentStateDocument('# Current state\n')).toContain(
      'line 1: expected exactly one root-level ```yaml fenced block',
    )
    expect(validateCurrentStateDocument(`${state(validYaml)}\n\`\`\`yaml\nextra: true\n\`\`\``)).toEqual(
      expect.arrayContaining([expect.stringContaining('expected exactly one root-level fenced block')]),
    )
    expect(validateCurrentStateDocument('# Current state\n\n```json\n{}\n```\n')).toEqual(
      expect.arrayContaining([expect.stringContaining('must be exactly ```yaml')]),
    )
    expect(validateCurrentStateDocument('# Current state\n\n```yaml\nupdated: nope\n')).toEqual(
      expect.arrayContaining([expect.stringContaining('unterminated')]),
    )
    expect(validateCurrentStateDocument(state(`${validYaml}\nnot: [closed`))).toEqual(
      expect.arrayContaining([expect.stringContaining('line')]),
    )
    expect(validateCurrentStateDocument(state(`${validYaml}\nupdated: '2026-08-11'`))).toEqual(
      expect.arrayContaining([expect.stringContaining('line'), expect.stringContaining('unique')]),
    )
    expect(validateCurrentStateDocument('# Current state\n\n```yaml\n- item\n```\n')).toEqual([
      'YAML root must be a mapping',
    ])
    for (const [key, replacement, expected] of [
      ['updated', 'updated: 2026-8-10', 'updated must be a YYYY-MM-DD string'],
      ['updated', "updated: '2026-02-30'", 'updated must be a YYYY-MM-DD string'],
      ['updated', "updated: '2023-02-29'", 'updated must be a YYYY-MM-DD string'],
      ['active_slice', "active_slice: ' '", 'active_slice must be a nonblank string'],
      ['next_value_slice', 'next_value_slice: [wrong]', 'next_value_slice must be a nonblank string'],
      ['blockers', 'blockers: false', 'blockers must be a nonblank string'],
      ['last_verified_checks', 'last_verified_checks: 42', 'last_verified_checks must be a nonblank string'],
    ] as const) {
      expect(
        validateCurrentStateDocument(state(semanticYaml.replace(new RegExp(`^${key}:.*$`, 'm'), replacement))),
      ).toEqual(expect.arrayContaining([expected]))
    }
    expect(
      validateCurrentStateDocument(
        state(
          semanticYaml.replace(
            "active_horizon: ['first: # item', 'second''s item']",
            'active_horizon: []',
          ),
        ),
      ),
    ).toEqual(expect.arrayContaining(['active_horizon must be a nonempty array of nonblank strings']))

    const flow = state(validYaml.replace("active_horizon:\n  - 'first: # item'\n  - 'second''s item'", "active_horizon: ['first: # item', 'second''s item']"))
    expect(validateCurrentStateDocument(flow)).toEqual([])
    expect(
      parseDocument(validYaml, { version: '1.2', schema: 'core' }).toJS().active_horizon,
    ).toEqual(parseDocument(flow.match(/```yaml\n([\s\S]*?)\n```/)?.[1] ?? '', { version: '1.2', schema: 'core' }).toJS().active_horizon)
  })
})

/*
 * Prompt operating system (issue #214 / lab #33).
 *
 * Every fixture below is invented. The point of these tests is that each way the prompt surface can
 * silently diverge — a dropped ID, a block edited in one prompt only, a bare cross-repository q-N,
 * a retired prompt that still reads as runnable — produces a NAMED failure rather than passing.
 */

const PRODUCT_SLUG = 'Chris0Jeky/developer-lens'
const LAB_SLUG = 'Chris0Jeky/developer-lens-lab'
const PRODUCT_EXTENSIONS = ['DL-PX01-PRODUCT-DEEP-DISCOVERY', 'DL-PX02-PRODUCT-ANALYTICAL-VERTICAL']
const LAB_EXTENSIONS = ['DL-LX01-LAB-EXPERIMENT-HARNESS', 'DL-LX02-LAB-EVALUATION-REPRODUCIBILITY']

/** Carries every clause `SHARED_BLOCK_REQUIRED_CLAUSES` demands of `runtime-bootstrap-v1`. */
const BOOTSTRAP_BLOCK = [
  'RUNTIME BOOTSTRAP (runtime-bootstrap-v1)',
  'Claude runtimes read CLAUDE.md and use the repository\'s named Claude agent files for read-only',
  'discovery, bounded implementation, fresh-context adversarial review, and mechanical sweeps. The',
  "prompt's repository-specific routing clause names those agents exactly.",
  'Codex runtimes read AGENTS.md first, then the shared CLAUDE.md canon it references, invoke the',
  'repository continuation skill, and follow Sol/Terra/Luna routing.',
  'Cross-repository human actions are cited as fully qualified refs, never a bare ref.',
].join('\n')

const FRICTION_BLOCK = [
  'FRICTION TASKING (friction-tasking-v1)',
  'Every material workaround is logged in docs/agent-system/FRICTION_LOG.md in the SAME hop, and',
  'linked to a durable task. Capture is not permission to detour: log it, link it, continue.',
  'At the second independent occurrence, choose the cheapest layer that enforces the fix.',
].join('\n')

const CONTINUATION_FRICTION_BLOCK = [
  '<!-- shared:continuation-friction-tasking-v1 start -->',
  'Every material workaround, tooling hiccup, repeated friction or surprising divergence is logged in',
  'docs/agent-system/FRICTION_LOG.md in the same hop and linked to an existing issue/card or durable',
  'task. Capture is not permission to widen scope; never record PID, absolute local path, token, or',
  'private identifier.',
  '<!-- shared:continuation-friction-tasking-v1 end -->',
].join('\n')

const AGENT_FRICTION_BLOCK = [
  '<!-- shared:agent-friction-tasking-v1 start -->',
  'FRICTION TASKING (agent-friction-tasking-v1)',
  'Every material workaround, tooling hiccup, repeated friction, or surprising divergence reaches',
  'docs/agent-system/FRICTION_LOG.md in the same hop and links to an existing issue, card, or durable',
  'task. A write-capable role appends it; a read-only role reports it as a required coordinator same-hop',
  'append. Capture never widens scope. Never record a PID, absolute local path, token, or private',
  'identifier.',
  '<!-- shared:agent-friction-tasking-v1 end -->',
].join('\n')

interface PromptSpec {
  id: string
  status?: string
  body?: string
  claudeRouting?: string | null
}

function fenced(body: string): string {
  return ['```text', body, '```'].join('\n')
}

function buildLibrary(
  options: {
    bootstrap?: string
    friction?: string
    prompts?: PromptSpec[]
    sharedBlockIds?: string[]
  } = {},
): string {
  const bootstrap = options.bootstrap ?? BOOTSTRAP_BLOCK
  const friction = options.friction ?? FRICTION_BLOCK
  const prompts: PromptSpec[] =
    options.prompts ?? [...COMMON_PROMPT_IDS, ...PRODUCT_EXTENSIONS].map((id) => ({ id }))
  const [bootstrapId = 'runtime-bootstrap-v1', frictionId = 'friction-tasking-v1'] =
    options.sharedBlockIds ?? []

  const lines = ['# Prompt library', '']
  lines.push(`<!-- shared-block: ${bootstrapId} -->`, '', fenced(bootstrap), '')
  lines.push(`<!-- shared-block: ${frictionId} -->`, '', fenced(friction), '')
  for (const prompt of prompts) {
    lines.push(`<!-- prompt-id: ${prompt.id} status: ${prompt.status ?? 'active'} -->`, '')
    const baseBody = prompt.body ?? [`PROMPT ${prompt.id}`, bootstrap, friction].join('\n')
    const flagshipDelivery =
      prompt.id === 'DL-P03-OVERNIGHT-CONTINUOUS'
        ? FLAGSHIP_OVERNIGHT_DELIVERY_CONTRACT.map((contract) => contract.clause).join('\n')
        : ''
    const body = [baseBody, flagshipDelivery].filter(Boolean).join('\n')
    const claudeRouting =
      prompt.claudeRouting === null
        ? []
        : [prompt.claudeRouting ?? PRODUCT_CLAUDE_ROUTING_CLAUSE]
    lines.push(
      fenced([body, ...claudeRouting].join('\n')),
      '',
    )
  }
  return lines.join('\n')
}

function buildManifest(
  options: {
    bootstrap?: string
    friction?: string
    commonIds?: readonly string[]
    continuousIds?: readonly string[]
    sharedBlocks?: ReadonlyArray<{ id: string; sha256: string }>
    productExtensions?: readonly string[]
  } = {},
): Record<string, unknown> {
  const bootstrap = options.bootstrap ?? BOOTSTRAP_BLOCK
  const friction = options.friction ?? FRICTION_BLOCK
  const repository = (slug: string, role: string, extensions: readonly string[]) => ({
    slug,
    role,
    prompt_library: 'docs/agent-system/PROMPT_LIBRARY.md',
    continuous_work_protocol: 'docs/agent-system/CONTINUOUS_WORK_PROTOCOL.md',
    friction_log: 'docs/agent-system/FRICTION_LOG.md',
    extension_prompt_ids: [...extensions],
  })

  return {
    manifest_schema_version: 1,
    description: 'Invented parity manifest fixture.',
    shared_block_normalization: 'CRLF normalized to LF, hashed as UTF-8 SHA-256, lowercase hex.',
    common_prompt_ids: [...(options.commonIds ?? COMMON_PROMPT_IDS)],
    continuous_prompt_ids: [...(options.continuousIds ?? ['DL-P03-OVERNIGHT-CONTINUOUS'])],
    shared_blocks: options.sharedBlocks ?? [
      { id: 'runtime-bootstrap-v1', sha256: sharedBlockDigest(bootstrap) },
      { id: 'friction-tasking-v1', sha256: sharedBlockDigest(friction) },
    ],
    repositories: [
      repository(PRODUCT_SLUG, 'product', options.productExtensions ?? PRODUCT_EXTENSIONS),
      repository(LAB_SLUG, 'lab', LAB_EXTENSIONS),
    ],
  }
}

/** Parse + validate in one step, the way `verifyProjectContext` does. */
function checkLibrary(
  library: string,
  manifestInput: Record<string, unknown> = buildManifest(),
  slug: string = PRODUCT_SLUG,
): string[] {
  const { manifest, errors } = validatePromptParityManifest(manifestInput)
  if (!manifest) {
    return errors
  }
  return validatePromptLibrary(parsePromptLibrary(library), manifest, slug)
}

function buildContinuousProtocol(markers: readonly string[] = CONTINUOUS_SECTION_MARKERS): string {
  return markers.map((marker) => `<!-- ${marker} -->\n\nSection body for ${marker}.\n`).join('\n')
}

describe('prompt operating system parity', () => {
  it('accepts a well-formed library, manifest and continuous protocol', () => {
    const manifest = buildManifest()
    expect(validatePromptParityManifest(manifest).errors).toEqual([])

    const parsed = parsePromptLibrary(buildLibrary())
    expect(parsed.errors).toEqual([])
    expect(parsed.prompts).toHaveLength(COMMON_PROMPT_IDS.length + PRODUCT_EXTENSIONS.length)
    expect(parsed.sharedBlockIds).toEqual(['runtime-bootstrap-v1', 'friction-tasking-v1'])
    expect(checkLibrary(buildLibrary(), manifest)).toEqual([])
    expect(validateContinuousWorkProtocol(buildContinuousProtocol())).toEqual([])
  })

  it('resolves each repository against its own slug and rejects an unlisted one', () => {
    // The lab's extension IDs are not valid active prompts in the product library.
    const productLibrary = buildLibrary()
    expect(checkLibrary(productLibrary, buildManifest(), LAB_SLUG)).toEqual([
      expect.stringContaining('prompt library active prompt ids is missing: DL-LX01'),
      expect.stringContaining('has unexpected entries: DL-PX01'),
    ])
    expect(checkLibrary(productLibrary, buildManifest(), 'Chris0Jeky/unknown-repo')).toEqual([
      'prompt parity manifest declares no entry for this repository slug: Chris0Jeky/unknown-repo',
    ])
  })

  it('rejects a malformed manifest before any library comparison', () => {
    expect(validatePromptParityManifest({ manifest_schema_version: 1 }).errors.length).toBeGreaterThan(0)
    expect(validatePromptParityManifest(buildManifest({ commonIds: [] })).errors).toContain(
      'common_prompt_ids: Too small: expected array to have >=1 items',
    )

    const badDigest = validatePromptParityManifest(
      buildManifest({ sharedBlocks: [{ id: 'runtime-bootstrap-v1', sha256: 'not-a-digest' }] }),
    ).errors
    expect(badDigest.some((error) => error.startsWith('shared_blocks.0.sha256'))).toBe(true)

    // A strict object: an unknown key is drift, not a harmless annotation.
    expect(
      validatePromptParityManifest({ ...buildManifest(), unexpected_key: true }).errors.length,
    ).toBeGreaterThan(0)
    expect(validatePromptParityManifest({ ...buildManifest(), manifest_schema_version: 2 }).errors.length)
      .toBeGreaterThan(0)
    expect(validatePromptParityManifest('not an object').errors.length).toBeGreaterThan(0)
  })

  it('detects missing, extra, duplicate and reordered prompt ids', () => {
    const missing = checkLibrary(
      buildLibrary({
        prompts: [...COMMON_PROMPT_IDS.slice(0, -1), ...PRODUCT_EXTENSIONS].map((id) => ({ id })),
      }),
    )
    expect(missing).toEqual([
      'prompt library active prompt ids is missing: DL-P12-FRICTION-BURNDOWN',
    ])

    const extra = checkLibrary(
      buildLibrary({
        prompts: [...COMMON_PROMPT_IDS, ...PRODUCT_EXTENSIONS, 'DL-P13-UNDECLARED'].map((id) => ({
          id,
        })),
      }),
    )
    expect(extra).toEqual([
      'prompt library active prompt ids has unexpected entries: DL-P13-UNDECLARED',
    ])

    const duplicated = parsePromptLibrary(
      buildLibrary({
        prompts: [...COMMON_PROMPT_IDS, ...COMMON_PROMPT_IDS.slice(0, 1), ...PRODUCT_EXTENSIONS].map(
          (id) => ({ id }),
        ),
      }),
    )
    expect(duplicated.errors).toEqual(['duplicate prompt id: DL-P01-FLAGSHIP-GOVERNOR'])

    const reordered: string[] = [...COMMON_PROMPT_IDS]
    ;[reordered[0], reordered[1]] = [reordered[1] as string, reordered[0] as string]
    expect(
      checkLibrary(buildLibrary({ prompts: [...reordered, ...PRODUCT_EXTENSIONS].map((id) => ({ id })) })),
    ).toEqual([expect.stringContaining('prompt library active prompt ids is out of manifest order')])

    // Deleting an ID from BOTH the library and the manifest must still fail, because
    // COMMON_PROMPT_IDS is pinned in code as well.
    expect(
      validatePromptParityManifest(buildManifest({ commonIds: COMMON_PROMPT_IDS.slice(0, -1) })).errors,
    ).toEqual(['manifest common_prompt_ids is missing: DL-P12-FRICTION-BURNDOWN'])
  })

  it('rejects malformed ids, unsupported statuses and prompts without exactly one body', () => {
    const malformed = parsePromptLibrary(buildLibrary({ prompts: [{ id: 'dl-p01-lowercase' }] }))
    expect(malformed.errors).toEqual([expect.stringContaining('malformed prompt id: dl-p01-lowercase')])

    const badStatus = parsePromptLibrary(
      buildLibrary({ prompts: [{ id: 'DL-P01-FLAGSHIP-GOVERNOR', status: 'draft' }] }),
    )
    expect(badStatus.errors).toEqual([
      'prompt DL-P01-FLAGSHIP-GOVERNOR has unsupported status: draft',
    ])

    const noBody = [
      '# Prompt library',
      '',
      '<!-- prompt-id: DL-P01-FLAGSHIP-GOVERNOR status: active -->',
      '',
      'Prose but no fenced block.',
      '',
    ].join('\n')
    expect(parsePromptLibrary(noBody).errors).toEqual([
      expect.stringContaining('must own exactly one fenced text block (found 0)'),
    ])

    const unterminated = ['<!-- shared-block: runtime-bootstrap-v1 -->', '', '```text', 'body'].join('\n')
    expect(parsePromptLibrary(unterminated).errors).toContain(
      'prompt library contains an unterminated fenced block',
    )
  })

  it('detects shared-block digest drift and a block edited in one prompt only', () => {
    // The manifest still pins the original digest, so an edited library block is caught.
    const editedBlock = BOOTSTRAP_BLOCK.replace(
      'RUNTIME BOOTSTRAP (runtime-bootstrap-v1)',
      'RUNTIME BOOTSTRAP (runtime-bootstrap-v1, locally tweaked)',
    )
    const drifted = checkLibrary(buildLibrary({ bootstrap: editedBlock }), buildManifest())
    expect(drifted).toEqual([
      expect.stringContaining('shared block runtime-bootstrap-v1 digest drift'),
    ])
    expect(drifted[0]).toContain(sharedBlockDigest(editedBlock))
    expect(drifted[0]).toContain(sharedBlockDigest(BOOTSTRAP_BLOCK))

    // One prompt quietly carrying a different copy of the block.
    const tampered = buildLibrary({
      prompts: [...COMMON_PROMPT_IDS, ...PRODUCT_EXTENSIONS].map((id, index) => ({
        id,
        body:
          index === 3
            ? [`PROMPT ${id}`, editedBlock, FRICTION_BLOCK].join('\n')
            : [`PROMPT ${id}`, BOOTSTRAP_BLOCK, FRICTION_BLOCK].join('\n'),
      })),
    })
    expect(checkLibrary(tampered)).toEqual([
      'prompt DL-P04-RESUME-RECONCILE must contain exactly one copy of shared block runtime-bootstrap-v1 (found 0)',
    ])

    // A duplicated block is drift too — two copies can diverge later.
    const doubled = buildLibrary({
      prompts: [{ id: 'DL-P01-FLAGSHIP-GOVERNOR', body: [BOOTSTRAP_BLOCK, BOOTSTRAP_BLOCK, FRICTION_BLOCK].join('\n') }],
    })
    expect(checkLibrary(doubled)).toContain(
      'prompt DL-P01-FLAGSHIP-GOVERNOR must contain exactly one copy of shared block runtime-bootstrap-v1 (found 2)',
    )

    const missingBlock = buildLibrary({ sharedBlockIds: ['runtime-bootstrap-v1', 'renamed-block'] })
    expect(checkLibrary(missingBlock)).toContain(
      'prompt library shared blocks is missing: friction-tasking-v1',
    )
  })

  it('hashes shared blocks identically across LF, CRLF and CR line endings', () => {
    const crlf = BOOTSTRAP_BLOCK.replaceAll('\n', '\r\n')
    const cr = BOOTSTRAP_BLOCK.replaceAll('\n', '\r')

    expect(sharedBlockDigest(crlf)).toBe(sharedBlockDigest(BOOTSTRAP_BLOCK))
    expect(sharedBlockDigest(cr)).toBe(sharedBlockDigest(BOOTSTRAP_BLOCK))
    expect(normalizeSharedText(crlf)).toBe(BOOTSTRAP_BLOCK)

    // A whole library checked out with CRLF endings must validate exactly as the LF one does,
    // otherwise the check would fail on Windows only.
    const library = buildLibrary()
    const crlfLibrary = library.replaceAll('\n', '\r\n')
    expect(parsePromptLibrary(crlfLibrary).prompts).toEqual(parsePromptLibrary(library).prompts)
    expect(checkLibrary(crlfLibrary)).toEqual([])
  })

  it('requires the Claude and Codex bootstrap clauses independently of the digest', () => {
    // Re-pin the manifest to the mutated block so ONLY the missing clause can fail: the clause
    // check must not be a side effect of digest comparison.
    const withoutCodex = BOOTSTRAP_BLOCK.split('\n')
      .filter((line) => !line.startsWith('Codex runtimes read AGENTS.md first'))
      .join('\n')
    expect(
      checkLibrary(
        buildLibrary({ bootstrap: withoutCodex }),
        buildManifest({ bootstrap: withoutCodex }),
      ),
    ).toEqual([
      'shared block runtime-bootstrap-v1 is missing required clause: Codex runtimes read AGENTS.md first, then the shared CLAUDE.md canon it references',
    ])

    const withoutClaude = BOOTSTRAP_BLOCK.replace(
      "Claude runtimes read CLAUDE.md and use the repository's named Claude agent files for read-only",
      'Claude runtimes improvise',
    )
    expect(
      checkLibrary(
        buildLibrary({ bootstrap: withoutClaude }),
        buildManifest({ bootstrap: withoutClaude }),
      ),
    ).toEqual([
      'shared block runtime-bootstrap-v1 is missing required clause: Claude runtimes read CLAUDE.md and use the repository\'s named Claude agent files for read-only',
    ])

    const withoutSameHop = FRICTION_BLOCK.replace(
      'docs/agent-system/FRICTION_LOG.md in the SAME hop',
      'the friction log eventually',
    )
    expect(
      checkLibrary(
        buildLibrary({ friction: withoutSameHop }),
        buildManifest({ friction: withoutSameHop }),
      ),
    ).toEqual([
      'shared block friction-tasking-v1 is missing required clause: docs/agent-system/FRICTION_LOG.md in the SAME hop',
    ])
  })

  it('requires one exact Product Claude routing clause in every active prompt', () => {
    const activeIds = [...COMMON_PROMPT_IDS, ...PRODUCT_EXTENSIONS]
    const expectedError = (id: string, count: number) =>
      `prompt ${id} must contain exactly one Product Claude routing clause naming ${PRODUCT_CLAUDE_ROUTING_TOKENS.join(', ')} (found ${count})`

    for (const targetId of activeIds) {
      const omitted = buildLibrary({
        prompts: activeIds.map((id) =>
          id === targetId ? { id, claudeRouting: null } : { id },
        ),
      })
      expect(checkLibrary(omitted)).toContain(expectedError(targetId, 0))

      for (const token of PRODUCT_CLAUDE_ROUTING_TOKENS) {
        const missingToken = buildLibrary({
          prompts: activeIds.map((id) =>
            id === targetId
              ? { id, claudeRouting: PRODUCT_CLAUDE_ROUTING_CLAUSE.replace(token, '') }
              : { id },
          ),
        })
        expect(checkLibrary(missingToken)).toContain(expectedError(targetId, 0))
      }
    }

    const duplicated = buildLibrary({
      prompts: activeIds.map((id, index) =>
        index === 0
          ? {
              id,
              claudeRouting: [
                PRODUCT_CLAUDE_ROUTING_CLAUSE,
                PRODUCT_CLAUDE_ROUTING_CLAUSE,
              ].join('\n'),
            }
          : { id },
      ),
    })
    expect(checkLibrary(duplicated)).toContain(expectedError(activeIds[0] as string, 2))
  })

  it('requires the continuous stop markers exactly once and in order', () => {
    expect(validateContinuousWorkProtocol(buildContinuousProtocol())).toEqual([])

    expect(
      validateContinuousWorkProtocol(
        buildContinuousProtocol(
          CONTINUOUS_SECTION_MARKERS.filter((marker) => marker !== 'continuous-stop-end'),
        ),
      ),
    ).toEqual(['continuous work protocol is missing marker: continuous-stop-end'])

    const reversedStops = [
      'continuous-execution-begin',
      'continuous-impact-begin',
      'continuous-impact-end',
      'continuous-execution-end',
      'continuous-stop-end',
      'continuous-stop-begin',
    ]
    expect(validateContinuousWorkProtocol(buildContinuousProtocol(reversedStops))).toEqual([
      expect.stringContaining('markers are out of order'),
    ])

    const duplicated = [...CONTINUOUS_SECTION_MARKERS, 'continuous-stop-begin']
    expect(validateContinuousWorkProtocol(buildContinuousProtocol(duplicated))).toEqual([
      'continuous work protocol repeats marker continuous-stop-begin 2 times (expected exactly one)',
    ])

    expect(validateContinuousWorkProtocol('No markers at all.')).toHaveLength(
      CONTINUOUS_SECTION_MARKERS.length,
    )

    // CRLF must not hide a marker.
    expect(validateContinuousWorkProtocol(buildContinuousProtocol().replaceAll('\n', '\r\n'))).toEqual([])
  })

  it('requires the continuous impact contract markers exactly once and in order', () => {
    const withoutImpactEnd = CONTINUOUS_SECTION_MARKERS.filter(
      (marker) => marker !== 'continuous-impact-end',
    )
    expect(validateContinuousWorkProtocol(buildContinuousProtocol(withoutImpactEnd))).toEqual([
      'continuous work protocol is missing marker: continuous-impact-end',
    ])

    const duplicatedImpact = [...CONTINUOUS_SECTION_MARKERS, 'continuous-impact-begin']
    expect(validateContinuousWorkProtocol(buildContinuousProtocol(duplicatedImpact))).toEqual([
      'continuous work protocol repeats marker continuous-impact-begin 2 times (expected exactly one)',
    ])
  })

  it('requires every ordered delivery contract clause exactly once only in the Product overnight launcher', () => {
    const complete = buildLibrary()
    expect(checkLibrary(complete)).toEqual([])

    for (const contract of FLAGSHIP_OVERNIGHT_DELIVERY_CONTRACT) {
      const expected = `flagship overnight prompt must contain exactly one Product P03 delivery clause "${contract.label}"`
      expect(checkLibrary(complete.replace(contract.clause, ''))).toContain(`${expected} (found 0)`)
      expect(
        checkLibrary(complete.replace(contract.clause, `${contract.clause}\n${contract.clause}`)),
      ).toContain(`${expected} (found 2)`)
    }

    const [first, second] = FLAGSHIP_OVERNIGHT_DELIVERY_CONTRACT
    const reversedAdjacent = complete.replace(
      `${first?.clause}\n${second?.clause}`,
      `${second?.clause}\n${first?.clause}`,
    )
    expect(checkLibrary(reversedAdjacent)).toContain(
      `flagship overnight Product P03 delivery clauses are out of order; expected ${FLAGSHIP_OVERNIGHT_DELIVERY_CONTRACT.map((contract) => contract.label).join(' -> ')}`,
    )

    const p02Only = buildLibrary({
      prompts: [{ id: 'DL-P02-GOVERNOR-LITE' }],
      sharedBlockIds: ['runtime-bootstrap-v1', 'friction-tasking-v1'],
    })
    expect(
      checkLibrary(p02Only).some((error) => error.includes('Product P03 delivery clause')),
    ).toBe(false)
  })

  it('rejects a bare q-N and accepts a fully qualified cross-repository human ref', () => {
    expect(findBareHumanRefs('Blocked on q-8 until the owner replies.')).toEqual(['q-8'])
    expect(findBareHumanRefs(`Blocked on ${PRODUCT_SLUG}::HUMAN_TODO.md::q-8.`)).toEqual([])
    expect(findBareHumanRefs(`See ${PRODUCT_SLUG}::HUMAN_TODO.md::q-8 and also q-12.`)).toEqual(['q-12'])
    expect(findBareHumanRefs(`${LAB_SLUG}::HUMAN_TODO.md::q-3 differs from ${PRODUCT_SLUG}::HUMAN_TODO.md::q-3`))
      .toEqual([])

    const bare = buildLibrary({
      prompts: [
        {
          id: 'DL-P01-FLAGSHIP-GOVERNOR',
          body: ['PROMPT', 'LAB RULE: blocked while q-8 is open.', BOOTSTRAP_BLOCK, FRICTION_BLOCK].join('\n'),
        },
      ],
    })
    expect(checkLibrary(bare)).toContain(
      'prompt DL-P01-FLAGSHIP-GOVERNOR cites a bare human action "q-8"; use <owner>/<repo>::HUMAN_TODO.md::q-8',
    )

    const qualified = buildLibrary({
      prompts: [...COMMON_PROMPT_IDS, ...PRODUCT_EXTENSIONS].map((id) => ({
        id,
        body: [
          `PROMPT ${id}`,
          `LAB RULE: blocked while ${PRODUCT_SLUG}::HUMAN_TODO.md::q-8 is open.`,
          BOOTSTRAP_BLOCK,
          FRICTION_BLOCK,
        ].join('\n'),
      })),
    })
    expect(checkLibrary(qualified)).toEqual([])
  })

  it('classifies active, redirect and historical prompt documents', () => {
    const activeIds = [...COMMON_PROMPT_IDS, ...PRODUCT_EXTENSIONS]

    const redirect = [
      '# Overnight execution prompt',
      '',
      '<!-- prompt-source: redirect target: DL-P03-OVERNIGHT-CONTINUOUS -->',
      '',
      'This prompt moved into the library. Paste DL-P03-OVERNIGHT-CONTINUOUS instead.',
      '',
    ].join('\n')
    expect(
      validatePromptSource({ kind: 'redirect', target: 'DL-P03-OVERNIGHT-CONTINUOUS' }, redirect, activeIds),
    ).toEqual([])

    // A redirect that kept a runnable copy is the exact failure this classification exists to stop.
    const redirectWithBody = [redirect, fenced('You are the overnight agent...'), ''].join('\n')
    expect(
      validatePromptSource(
        { kind: 'redirect', target: 'DL-P03-OVERNIGHT-CONTINUOUS' },
        redirectWithBody,
        activeIds,
      ),
    ).toEqual([
      'a redirect must not keep a competing executable copy: found 1 fenced block(s)',
    ])

    const historicalBody = [
      RETIRED_PROMPT_SENTINEL,
      'You are the deep discovery agent...',
      RETIRED_PROMPT_SENTINEL,
    ].join('\n')
    const historical = [
      '# Deep discovery prompt (retired)',
      '',
      '<!-- prompt-source: historical target: DL-PX01-PRODUCT-DEEP-DISCOVERY -->',
      '',
      RETIRED_PROMPT_SENTINEL,
      '',
      fenced(historicalBody),
      '',
    ].join('\n')
    expect(
      validatePromptSource(
        { kind: 'historical', target: 'DL-PX01-PRODUCT-DEEP-DISCOVERY' },
        historical,
        activeIds,
      ),
    ).toEqual([])

    // Sentinel must WRAP the body, so a copy-paste carries its own retirement notice.
    const unwrapped = historical.replace(
      [RETIRED_PROMPT_SENTINEL, 'You are the deep discovery agent...', RETIRED_PROMPT_SENTINEL].join('\n'),
      'You are the deep discovery agent...',
    )
    expect(
      validatePromptSource(
        { kind: 'historical', target: 'DL-PX01-PRODUCT-DEEP-DISCOVERY' },
        unwrapped,
        activeIds,
      ),
    ).toEqual([
      'historical fenced block 1 must OPEN with the retirement sentinel',
      'historical fenced block 1 must CLOSE with the retirement sentinel',
    ])

    // Wrong kind, unknown target, missing marker, and a smuggled executable marker.
    expect(
      validatePromptSource({ kind: 'historical', target: 'DL-P03-OVERNIGHT-CONTINUOUS' }, redirect, activeIds),
    ).toEqual([
      'prompt-source marker declares "redirect" but this document is classified "historical"',
      expect.stringContaining('a historical prompt document must carry the sentinel'),
    ])
    // Mismatch against the expected classification. The liveness check reads the DOCUMENT's target,
    // which is still an active ID here, so only the mismatch is reported.
    expect(
      validatePromptSource({ kind: 'redirect', target: 'DL-P99-RETIRED' }, redirect, activeIds),
    ).toEqual([
      'prompt-source target is "DL-P03-OVERNIGHT-CONTINUOUS" but the classification expects "DL-P99-RETIRED"',
    ])

    // A redirect pointing at a prompt that no longer exists — a dangling signpost.
    const danglingRedirect = redirect.replaceAll('DL-P03-OVERNIGHT-CONTINUOUS', 'DL-P99-RETIRED')
    expect(
      validatePromptSource({ kind: 'redirect', target: 'DL-P99-RETIRED' }, danglingRedirect, activeIds),
    ).toEqual([
      'prompt-source redirects to "DL-P99-RETIRED", which is not an active prompt id',
    ])
    expect(
      validatePromptSource(
        { kind: 'redirect', target: 'DL-P03-OVERNIGHT-CONTINUOUS' },
        '# No marker here',
        activeIds,
      ),
    ).toEqual([
      'expected exactly one prompt-source marker declaring "redirect" (found 0)',
    ])
    const smuggled = redirect.replace(
      'This prompt moved into the library. Paste DL-P03-OVERNIGHT-CONTINUOUS instead.',
      '<!-- prompt-id: DL-P03-OVERNIGHT-CONTINUOUS status: active -->',
    )
    expect(
      validatePromptSource(
        { kind: 'redirect', target: 'DL-P03-OVERNIGHT-CONTINUOUS' },
        smuggled,
        activeIds,
      ),
    ).toEqual([
      'a redirect or historical document must not declare an executable prompt-id marker',
    ])
  })

  it('keeps the continuous prompt id inside the common set and active in the library', () => {
    expect(
      validatePromptParityManifest(buildManifest({ continuousIds: ['DL-PX01-PRODUCT-DEEP-DISCOVERY'] }))
        .errors,
    ).toContain('manifest continuous prompt id is not a common prompt id: DL-PX01-PRODUCT-DEEP-DISCOVERY')

    const historicalContinuous = buildLibrary({
      prompts: [...COMMON_PROMPT_IDS, ...PRODUCT_EXTENSIONS].map((id) => ({
        id,
        status: id === 'DL-P03-OVERNIGHT-CONTINUOUS' ? 'historical' : 'active',
      })),
    })
    expect(checkLibrary(historicalContinuous)).toEqual([
      'prompt library active prompt ids is missing: DL-P03-OVERNIGHT-CONTINUOUS',
      'continuous prompt DL-P03-OVERNIGHT-CONTINUOUS is not an active prompt in the library',
    ])
  })

  it('rejects manifest ids duplicated across the common and extension sets', () => {
    expect(
      validatePromptParityManifest(
        buildManifest({ productExtensions: ['DL-P01-FLAGSHIP-GOVERNOR', 'DL-PX02-PRODUCT-ANALYTICAL-VERTICAL'] }),
      ).errors,
    ).toContain(
      'manifest prompt ids must be unique across common and extension sets: DL-P01-FLAGSHIP-GOVERNOR',
    )
  })
})

describe('continuation skill friction parity', () => {
  const skill = (body: string): string => `runtime-specific preface\n${body}\nruntime-specific ending\n`

  it('accepts one ordered shared block in each skill and normalizes CRLF', () => {
    const codex = skill(CONTINUATION_FRICTION_BLOCK)
    const claude = skill(CONTINUATION_FRICTION_BLOCK).replaceAll('\n', '\r\n')

    expect(
      validateContinuationSkillParity([
        { path: '.agents/skills/developer-lens-continuation/SKILL.md', contents: codex },
        { path: '.claude/skills/developer-lens-continuation/SKILL.md', contents: claude },
      ]),
    ).toEqual([])
  })

  it('rejects drift in the enclosed block bytes', () => {
    const drifted = CONTINUATION_FRICTION_BLOCK.replace('widen scope', 'widen this scope')
    expect(
      validateContinuationSkillParity([
        { path: 'codex-skill.md', contents: skill(CONTINUATION_FRICTION_BLOCK) },
        { path: 'claude-skill.md', contents: skill(drifted) },
      ]),
    ).toEqual(['continuation friction block bytes drift between codex-skill.md and claude-skill.md'])
  })

  it('rejects a missing marker pair', () => {
    const missingEnd = CONTINUATION_FRICTION_BLOCK.replace(
      '\n<!-- shared:continuation-friction-tasking-v1 end -->',
      '',
    )
    expect(
      validateContinuationSkillParity([
        { path: 'codex-skill.md', contents: skill(missingEnd) },
        { path: 'claude-skill.md', contents: skill(CONTINUATION_FRICTION_BLOCK) },
      ]),
    ).toEqual([
      'codex-skill.md must contain exactly one <!-- shared:continuation-friction-tasking-v1 end --> marker (found 0)',
    ])
  })

  it('rejects duplicate markers', () => {
    const duplicateEnd = CONTINUATION_FRICTION_BLOCK.replace(
      '<!-- shared:continuation-friction-tasking-v1 end -->',
      '<!-- shared:continuation-friction-tasking-v1 end -->\n<!-- shared:continuation-friction-tasking-v1 end -->',
    )
    expect(
      validateContinuationSkillParity([
        { path: 'codex-skill.md', contents: skill(duplicateEnd) },
        { path: 'claude-skill.md', contents: skill(CONTINUATION_FRICTION_BLOCK) },
      ]),
    ).toEqual([
      'codex-skill.md must contain exactly one <!-- shared:continuation-friction-tasking-v1 end --> marker (found 2)',
    ])
  })
})

describe('Claude agent friction parity', () => {
  const agent = (body: string): string => `---\nname: fixture\n---\nrole-specific text\n${body}\n`
  const paths = [
    '.claude/agents/dl-implementer.md',
    '.claude/agents/dl-mechanic.md',
    '.claude/agents/dl-reviewer.md',
    '.claude/agents/dl-scout.md',
  ]
  const sources = (body: string = AGENT_FRICTION_BLOCK) =>
    paths.map((path) => ({ path, contents: agent(body) }))

  it('accepts one ordered identical block in all four agents and normalizes CRLF', () => {
    const crlfSources = sources().map((source, index) => ({
      ...source,
      contents: index === 3 ? source.contents.replaceAll('\n', '\r\n') : source.contents,
    }))
    expect(validateAgentFrictionParity(crlfSources)).toEqual([])
  })

  it('rejects drift in one agent block', () => {
    const drifted = AGENT_FRICTION_BLOCK.replace('FRICTION TASKING', 'FRICTION HANDLING')
    expect(validateAgentFrictionParity([...sources().slice(0, 3), { path: paths[3] as string, contents: agent(drifted) }])).toEqual([
      'agent friction block bytes drift between .claude/agents/dl-implementer.md and .claude/agents/dl-scout.md',
    ])
  })

  it('rejects missing and duplicate marker pairs', () => {
    const missingEnd = AGENT_FRICTION_BLOCK.replace(
      '\n<!-- shared:agent-friction-tasking-v1 end -->',
      '',
    )
    expect(validateAgentFrictionParity([...sources().slice(0, 3), { path: paths[3] as string, contents: agent(missingEnd) }])).toContain(
      '.claude/agents/dl-scout.md must contain exactly one <!-- shared:agent-friction-tasking-v1 end --> marker (found 0)',
    )

    const duplicateEnd = AGENT_FRICTION_BLOCK.replace(
      '<!-- shared:agent-friction-tasking-v1 end -->',
      '<!-- shared:agent-friction-tasking-v1 end -->\n<!-- shared:agent-friction-tasking-v1 end -->',
    )
    expect(validateAgentFrictionParity([...sources().slice(0, 3), { path: paths[3] as string, contents: agent(duplicateEnd) }])).toContain(
      '.claude/agents/dl-scout.md must contain exactly one <!-- shared:agent-friction-tasking-v1 end --> marker (found 2)',
    )
  })

  it('rejects a block missing a required role-aware clause', () => {
    const missingRole = AGENT_FRICTION_BLOCK.replace(
      'a read-only role reports it as a required coordinator same-hop',
      'a read-only role reports it later',
    )
    expect(validateAgentFrictionParity([...sources().slice(0, 3), { path: paths[3] as string, contents: agent(missingRole) }])).toContain(
      '.claude/agents/dl-scout.md agent friction block is missing required clause: A write-capable role appends it; a read-only role reports it as a required coordinator same-hop',
    )
  })
})
