import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'vitest'

const workflow = readFileSync(resolve('.github/workflows/dependency-audit-evidence.yml'), 'utf8')
const prGate = readFileSync(resolve('.github/workflows/pr-gate.yml'), 'utf8')

// Pin the GitHub expression to the already-proven required gate. Hosted retarget
// acceptance exercises GitHub's evaluator; these tests do not reimplement it.
const guard = "github.event.action != 'edited' || github.event.changes.base"

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
    assert.match(workflow, /^  pull_request:\s*$/m)
    assert.doesNotMatch(workflow, /^  pull_request_target:/m)
    assert.match(workflow, /^permissions:\n  contents: read\s*$/m)
    assert.doesNotMatch(workflow, /secrets\.|contents: write/)
  })
})
