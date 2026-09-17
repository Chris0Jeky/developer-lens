import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  validateIssueTemplateConfig,
  validateIssueTemplateFrontmatter,
} from './issueTemplateValidation.js'

const issueTemplate = (labels: string): string => `---
name: Fixture
about: Fixture issue template
title: ''
labels: ${labels}
assignees: ''
---

## Fixture
`

describe('GitHub issue-template YAML validation', () => {
  it('accepts the committed config and template frontmatter against the known repository labels', () => {
    const labels = new Set(['bug', 'enhancement', 'idea'])
    const config = readFileSync(resolve('.github', 'ISSUE_TEMPLATE', 'config.yml'), 'utf8')
    const bug = readFileSync(resolve('.github', 'ISSUE_TEMPLATE', 'bug_report.md'), 'utf8')
    const feature = readFileSync(resolve('.github', 'ISSUE_TEMPLATE', 'feature_request.md'), 'utf8')
    const contact = readFileSync(
      resolve('.github', 'ISSUE_TEMPLATE', 'private_contact_request.md'),
      'utf8',
    )

    expect(validateIssueTemplateConfig(config)).toEqual([])
    expect(validateIssueTemplateFrontmatter('bug_report.md', bug, labels)).toEqual([])
    expect(validateIssueTemplateFrontmatter('feature_request.md', feature, labels)).toEqual([])
    expect(validateIssueTemplateFrontmatter('private_contact_request.md', contact, labels)).toEqual([])
  })

  it('fails closed on malformed config YAML that retains the expected key spellings', () => {
    const malformed = [
      'blank_issues_enabled: false',
      'contact_links: [',
      '  - name: Fixture',
      '    url: https://example.test',
      '    about: Fixture',
    ].join('\n')

    expect(validateIssueTemplateConfig(malformed)).toContain(
      'issue-template config is not valid YAML',
    )
  })

  it('requires disabled blank issues and complete contact links', () => {
    const weakened = [
      'blank_issues_enabled: true',
      'contact_links:',
      '  - name: Fixture',
      '    url: https://example.test',
    ].join('\n')

    expect(validateIssueTemplateConfig(weakened)).toEqual(expect.arrayContaining([
      'issue-template config must keep blank_issues_enabled false',
      'issue-template contact link 1 must declare non-empty about',
    ]))
  })

  it('rejects malformed frontmatter and labels that do not exist in the repository', () => {
    const malformed = issueTemplate('bug').replace('labels: bug', 'labels: [bug')
    expect(validateIssueTemplateFrontmatter('bug_report.md', malformed, new Set(['bug']))).toContain(
      'bug_report.md frontmatter is not valid YAML',
    )

    expect(
      validateIssueTemplateFrontmatter(
        'feature_request.md',
        issueTemplate('enhancement, missing-label'),
        new Set(['enhancement']),
      ),
    ).toContain('feature_request.md references missing repository label: missing-label')
  })
})
