import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, it } from 'vitest'
import { toSurvivalRow, type PullRequestObservation } from '../docs/acceleration-bundles/2026-09-09-developer-lens/snippets/integration-tail-method.js'
import { RESEARCH_RULES } from '../docs/acceleration-bundles/2026-09-09-developer-lens/snippets/rule-registry.js'

const observation: PullRequestObservation = {
  id: 'invented-pr', createdAt: 1000, mergedAt: null, closedAt: null,
  additions: 3, deletions: 4, changedFiles: 2,
}
const bundleAgent = resolve('docs/acceleration-bundles/2026-09-09-developer-lens/agent')

// Run the real CLI against a disposable copy: a failing regression must not destroy source indexes.
function withAgent(run: (root: string, agent: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'lens-acceleration-'))
  const agent = join(root, 'agent')
  try {
    cpSync(bundleAgent, agent, { recursive: true })
    run(root, agent)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
function materialize(agent: string, output?: string) {
  return spawnSync(process.execPath, [join(agent, 'materialize-manifests.mjs'), ...(output === undefined ? [] : ['--out', output])], { encoding: 'utf8' })
}

describe('acceleration bundle lifecycle examples', () => {
  for (const patch of [{ mergedAt: 999 }, { closedAt: 999 }, { mergedAt: 1200, closedAt: 999 }]) {
    it(`rejects negative lifecycle observations ${JSON.stringify(patch)}`, () => {
      assert.throws(() => toSurvivalRow({ ...observation, ...patch }, 2000), /lifecycle.*before creation/)
    })
  }
  for (const end of [999, 1000]) {
    it(`rejects a cohort observation not created before exclusive end ${end}`, () => {
      assert.throws(() => toSurvivalRow(observation, end), /window.*creation/)
    })
  }
  it('rejects non-finite timestamp inputs instead of manufacturing a duration', () => {
    for (const timestamp of [NaN, Infinity, -Infinity]) {
      for (const patch of [{ createdAt: timestamp }, { mergedAt: timestamp }, { closedAt: timestamp }]) {
        assert.throws(() => toSurvivalRow({ ...observation, ...patch }, 2000), /finite/)
      }
      assert.throws(() => toSurvivalRow(observation, timestamp), /finite/)
    }
  })
  it('retains a genuine zero-duration merge and its batch values', () => {
    assert.deepEqual(toSurvivalRow({ ...observation, mergedAt: 1000 }, 2000), {
      durationHours: 0, outcome: 'merged', batchPrimary: 2, batchSensitivity: Math.log1p(7),
    })
  })
  it('retains right censoring at the exclusive window end', () => {
    assert.equal(toSurvivalRow({ ...observation, mergedAt: 2000 }, 2000).outcome, 'right_censored')
    assert.equal(toSurvivalRow(observation, 3_601_000).durationHours, 1)
  })
})

describe('acceleration bundle percentage-improvement rule', () => {
  const evaluate = (baseline: number | null, candidate: number | null) =>
    RESEARCH_RULES.falseAlertTwentyPercentImprovement.evaluate({
      'baseline.false_alerts_per_year': baseline, 'candidate.false_alerts_per_year': candidate,
    })
  it('does not report percentage improvement from a zero baseline', () => {
    for (const candidate of [0, 1]) assert.equal(evaluate(0, candidate), 'not_applicable')
  })
  it('does not evaluate absent, negative or non-finite rates', () => {
    for (const invalid of [null, -1, NaN, Infinity, -Infinity]) {
      assert.equal(evaluate(invalid, 0), 'not_applicable')
      assert.equal(evaluate(1, invalid), 'not_applicable')
    }
  })
  it('retains the exact positive-baseline threshold', () => {
    assert.equal(evaluate(10, 8), 'pass')
    assert.equal(evaluate(10, 8.01), 'fail')
    assert.equal(evaluate(10, 0), 'pass')
  })
})

describe('acceleration manifest source protection', () => {
  for (const alias of ['direct', 'normalized', 'symlink'] as const) {
    it(`refuses ${alias} output aliases without changing either source index`, () => {
      withAgent((root, agent) => {
        let output = alias === 'normalized' ? join(agent, '..', 'agent') : agent
        if (alias === 'symlink') {
          output = join(root, 'alias')
          symlinkSync(agent, output, process.platform === 'win32' ? 'junction' : 'dir')
        }
        const names = ['decision-catalog.json', 'issue-manifest.json']
        const before = names.map((name) => readFileSync(join(agent, name)))
        const result = materialize(agent, output)
        assert.notEqual(result.status, 0)
        assert.match(result.stderr, /output directory.*source directory/)
        names.forEach((name, index) => assert.deepEqual(readFileSync(join(agent, name)), before[index]))
      })
    })
  }
  for (const alias of ['file-symlink', 'hard-link'] as const) {
    it(`refuses ${alias} targets before writing either output`, () => {
      withAgent((root, agent) => {
        const output = join(root, 'output')
        mkdirSync(output)
        const names = ['decision-catalog.json', 'issue-manifest.json']
        const before = names.map((name) => readFileSync(join(agent, name)))
        for (const name of names) {
          if (alias === 'hard-link') linkSync(join(agent, name), join(output, name))
          else symlinkSync(join(agent, name), join(output, name), 'file')
        }
        const result = materialize(agent, output)
        assert.notEqual(result.status, 0)
        assert.match(result.stderr, /output target.*source input|output target.*symlink/)
        names.forEach((name, index) => assert.deepEqual(readFileSync(join(agent, name)), before[index]))
      })
    })
  }
  for (const stem of ['decision-catalog', 'issue-manifest']) {
    it(`protects every ${stem} part from output hard-link aliases before any write`, () => {
      withAgent((root, agent) => {
        const index = JSON.parse(readFileSync(join(agent, `${stem}.json`), 'utf8'))
        for (const [partIndex, part] of index.parts.entries()) {
          const output = join(root, `output-${partIndex}`)
          mkdirSync(output)
          const source = join(agent, part.path)
          const before = readFileSync(source)
          // Put the alias at the second target so preflight must stop the first write too.
          linkSync(source, join(output, 'issue-manifest.json'))
          const result = materialize(agent, output)
          assert.notEqual(result.status, 0)
          assert.match(result.stderr, /output target.*source (?:index|input)/)
          assert.deepEqual(readFileSync(source), before)
          assert.equal(existsSync(join(output, 'decision-catalog.json')), false)
        }
      })
    })
  }
  it('materializes to a distinct directory and permits the same export to be rebuilt', () => {
    withAgent((root, agent) => {
      const output = join(root, 'output')
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = materialize(agent, output)
        assert.equal(result.status, 0, result.stderr)
        const summary = JSON.parse(result.stdout)
        for (const [stem, collection] of [['decision-catalog', 'decisions'], ['issue-manifest', 'issues']]) {
          const index = JSON.parse(readFileSync(join(agent, `${stem}.json`), 'utf8'))
          const exported = JSON.parse(readFileSync(join(output, `${stem}.json`), 'utf8'))
          assert.equal(exported[collection].length, index.totalCount)
          assert.equal(summary[collection], index.totalCount)
          assert.ok(Array.isArray(index.parts))
        }
      }
    })
  })
  it('keeps summary-only materialization read-only', () => {
    withAgent((_root, agent) => {
      const before = readFileSync(join(agent, 'decision-catalog.json'))
      assert.equal(materialize(agent).status, 0)
      assert.deepEqual(readFileSync(join(agent, 'decision-catalog.json')), before)
    })
  })
})
