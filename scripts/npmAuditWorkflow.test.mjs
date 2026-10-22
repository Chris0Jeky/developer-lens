import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'vitest'
import { parse } from 'yaml'

const workflow = readFileSync(resolve('.github/workflows/dependency-audit-evidence.yml'), 'utf8')
const prGate = readFileSync(resolve('.github/workflows/pr-gate.yml'), 'utf8')

// Pin the GitHub expression to the already-proven required gate. Hosted retarget
// acceptance exercises GitHub's evaluator; these tests do not reimplement it.
const guard = "github.event.action != 'edited' || github.event.changes.base"

function assertReadOnlyPrExecution(source) {
  const normalized = source.replace(/\r\n/g, '\n')
  assert.match(normalized, /^  pull_request:\s*$/m)
  assert.doesNotMatch(normalized, /^  pull_request_target:/m)
  assert.match(normalized, /^permissions:\n  contents: read\s*$/m)
  assert.deepEqual(parse(normalized).permissions, { contents: 'read' })
  assert.doesNotMatch(normalized, /secrets\.|contents: write/)
}

describe('audit collection event coverage (#402)', () => {
  it('subscribes to dependency PR base retargets', () => {
    const events = workflow.match(/^    types: \[([^\]]+)\]$/m)?.[1].split(',').map((event) => event.trim())
    assert.ok(events?.includes('edited'))
    for (const event of ['opened', 'synchronize', 'reopened']) assert.ok(events.includes(event))
  })
  it('uses the required gate predicate to exclude title/body-only edits', () => {
    assert.ok(prGate.includes(`    if: ${guard}`))
    assert.ok(workflow.includes(`    if: ${guard}`))
  })
  it('retains manual collection and declares its own regression as an input', () => {
    assert.match(workflow, /^  workflow_dispatch:\s*$/m)
    assert.match(workflow, /^      - scripts\/npmAuditWorkflow\.test\.mjs$/m)
  })
  it('cannot cancel a proving run through an unguarded edit concurrency group', () => {
    assert.doesNotMatch(workflow, /^concurrency:/m)
  })
  it('keeps read-only PR execution rather than privileged target execution', () => {
    assertReadOnlyPrExecution(workflow)
  })
})

describe('audit workflow line endings and permissions', () => {
  for (const [label, newline] of [['LF', '\n'], ['CRLF', '\r\n']]) {
    const fixture = ['on:', '  pull_request:', 'permissions:', '  contents: read', ''].join(newline)
    it(`accepts read-only PR permissions with ${label}`, () => {
      assertReadOnlyPrExecution(fixture)
    })
    for (const [name, permissions] of [
      ['contents write', 'permissions:\n  contents: write'],
      ['additional write scope', 'permissions:\n  contents: read\n  issues: write'],
      ['write-all', 'permissions: write-all'],
    ]) {
      it(`rejects ${name} with ${label}`, () => {
        const expanded = fixture.replace(
          ['permissions:', '  contents: read'].join(newline),
          permissions.replace(/\n/g, newline),
        )
        assert.throws(() => assertReadOnlyPrExecution(expanded), assert.AssertionError)
      })
    }
  }
})
