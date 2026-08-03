import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  extractMarkdownLinkTargets,
  parseSkillFrontmatter,
  resolveRepositoryLinkTarget,
  validateTierDeclaration,
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
    for (const typedScalar of ['[]', '{}', 'true', '42', '2026-08-04']) {
      expect(
        parseSkillFrontmatter(valid.replace('Resume Developer Lens safely.', typedScalar)).errors,
      ).toContain(`plain scalar must remain a string: ${typedScalar}`)
    }
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
})
