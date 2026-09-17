import { describe, expect, it } from 'vitest'
import { validateCurrentStateFenceContract } from './currentStateFenceValidation.js'

const validYaml = [
  "updated: '2026-08-10'",
  "remote_refs_last_observed_at: '2026-08-10T12:34:56Z'",
  "active_slice: 'current'",
  "next_value_slice: 'next'",
  "blockers: 'none'",
  "last_verified_checks: 'focused test'",
  "active_horizon: ['first']",
].join('\n')

const state = (suffix = ''): string => [
  '# Current state',
  '',
  '```yaml',
  validYaml,
  '```',
  suffix,
].filter((line, index, lines) => line !== '' || index < lines.length - 1).join('\n') + '\n'

describe('current-state root-level Markdown fence contract', () => {
  it('accepts the one exact canonical YAML block with LF or CRLF', () => {
    expect(validateCurrentStateFenceContract(state())).toEqual([])
    expect(validateCurrentStateFenceContract(state().replaceAll('\n', '\r\n'))).toEqual([])
  })

  it('counts tilde, indented, and mixed-marker root-level fences as additional blocks', () => {
    const cases = [
      ['tilde', ['~~~text', 'extra', '~~~'].join('\n')],
      ['one-space backtick', [' ```text', 'extra', ' ```'].join('\n')],
      ['three-space tilde', ['   ~~~text', 'extra', '   ~~~'].join('\n')],
      ['mixed markers', ['~~~text', 'extra', '```'].join('\n')],
    ] as const

    for (const [label, suffix] of cases) {
      const errors = validateCurrentStateFenceContract(state(suffix))
      expect(errors, label).toEqual(expect.arrayContaining([
        expect.stringContaining('expected exactly one root-level fenced block'),
      ]))
      expect(errors.some((error) => /^line \d+:/u.test(error)), label).toBe(true)
    }
  })

  it('does not count inline marker prose or four-space-indented code', () => {
    const suffix = [
      'Ordinary prose may mention ``` or ~~~ without opening a block.',
      '',
      '    ```text',
      '    four-space-indented code',
      '    ```',
      '',
      '    ~~~text',
      '    four-space-indented code',
      '    ~~~',
    ].join('\n')

    expect(validateCurrentStateFenceContract(state(suffix))).toEqual([])
  })

  it('keeps line-aware diagnostics after CRLF normalization', () => {
    const document = state(['~~~text', 'extra', '~~~'].join('\n')).replaceAll('\n', '\r\n')
    const errors = validateCurrentStateFenceContract(document)

    expect(errors.some((error) => /^line \d+:/u.test(error))).toBe(true)
    expect(errors.join('\n')).toContain('expected exactly one root-level fenced block')
  })
})
