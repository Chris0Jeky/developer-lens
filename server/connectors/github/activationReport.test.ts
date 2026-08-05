import { describe, expect, it } from 'vitest'
import {
  GITHUB_CORE_ACTIVATION_REPORT_ERROR_CODE,
  GITHUB_CORE_ACTIVATION_REPORT_SCHEMA_VERSION,
  parseGithubCoreActivationReport,
} from './activationReport.js'
import {
  GITHUB_CORE_ACTIVATION_RESULT_SCHEMA_VERSION,
  parseGithubCoreActivationResult,
} from './activationResult.js'

const completeResult = {
  schemaVersion: GITHUB_CORE_ACTIVATION_RESULT_SCHEMA_VERSION,
  capabilityId: 'github.core',
  stability: 'stable',
  coverage: {
    status: 'complete',
    expectedUnits: 0,
    observedUnits: 0,
    omittedUnits: 0,
    completeObservedUnits: 0,
    saturationReason: null,
    retryable: false,
    limitationCode: 'COMPLETE',
  },
  requests: {
    maximumRequests: 5,
    firstProbeMaximumRequests: 2,
    secondProbeMaximumRequests: 3,
    firstProbeRequests: 2,
    secondProbeRequests: 2,
    totalRequests: 4,
  },
} as const

const completeReport = {
  schemaVersion: GITHUB_CORE_ACTIVATION_REPORT_SCHEMA_VERSION,
  taskId: 'task_01-A',
  jobId: 'job:2026-08-05T1',
  jobStartedAt: '2026-08-05T12:34:56.789Z',
  result: completeResult,
} as const

function expectInvalid(value: unknown): void {
  expect(() => parseGithubCoreActivationReport(value)).toThrow(GITHUB_CORE_ACTIVATION_REPORT_ERROR_CODE)
  try { parseGithubCoreActivationReport(value) } catch (error) {
    expect(error).toMatchObject({
      code: GITHUB_CORE_ACTIVATION_REPORT_ERROR_CODE,
      message: GITHUB_CORE_ACTIVATION_REPORT_ERROR_CODE,
    })
  }
}

function reportWithResult(result: unknown): Record<string, unknown> {
  return { ...completeReport, result }
}

describe('github.core activation report C2 parser', () => {
  it('accepts complete, restricted, failed, truncated, and unstable producer results', () => {
    const restricted = parseGithubCoreActivationResult({
      ...completeResult,
      stability: 'not_observed',
      coverage: {
        ...completeResult.coverage,
        status: 'restricted', expectedUnits: null, observedUnits: 0, omittedUnits: null,
        completeObservedUnits: null, limitationCode: 'NOT_FOUND',
      },
      requests: { ...completeResult.requests, firstProbeRequests: 1, secondProbeRequests: 0, totalRequests: 1 },
    })
    const failed = parseGithubCoreActivationResult({
      ...completeResult,
      stability: 'not_observed',
      coverage: {
        ...completeResult.coverage,
        status: 'failed', expectedUnits: null, observedUnits: 0, omittedUnits: null,
        completeObservedUnits: null, limitationCode: 'FAILURE_TRANSIENT', retryable: true,
      },
      requests: { ...completeResult.requests, firstProbeRequests: 1, secondProbeRequests: 0, totalRequests: 1 },
    })
    const truncated = parseGithubCoreActivationResult({
      ...completeResult,
      stability: 'not_observed',
      coverage: {
        ...completeResult.coverage,
        status: 'truncated', expectedUnits: null, observedUnits: 4, omittedUnits: null,
        completeObservedUnits: null, saturationReason: 'REQUEST_BUDGET_EXHAUSTED',
        limitationCode: 'REQUEST_BUDGET_EXHAUSTED', retryable: true,
      },
      requests: { ...completeResult.requests, firstProbeRequests: 2, secondProbeRequests: 0, totalRequests: 2 },
    })
    const unstable = parseGithubCoreActivationResult({
      ...completeResult,
      stability: 'unstable',
      coverage: {
        ...completeResult.coverage,
        status: 'truncated', expectedUnits: null, observedUnits: 0, omittedUnits: null,
        completeObservedUnits: null, saturationReason: 'SNAPSHOT_UNSTABLE',
        limitationCode: 'SNAPSHOT_UNSTABLE', retryable: true,
      },
    })
    for (const result of [completeResult, restricted, failed, truncated, unstable]) {
      expect(parseGithubCoreActivationReport(reportWithResult(result)).result).toEqual(result)
    }
  })

  it('reconstructs fixed order, freezes the envelope, and is deterministic under key permutation', () => {
    const result = parseGithubCoreActivationReport(completeReport)
    expect(Object.keys(result)).toEqual(['schemaVersion', 'taskId', 'jobId', 'jobStartedAt', 'result'])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.result)).toBe(true)
    const permuted = {
      result: completeResult,
      jobStartedAt: completeReport.jobStartedAt,
      taskId: completeReport.taskId,
      schemaVersion: completeReport.schemaVersion,
      jobId: completeReport.jobId,
    }
    expect(JSON.stringify(parseGithubCoreActivationReport(permuted))).toBe(JSON.stringify(result))
    expect(() => { (result as { taskId: string }).taskId = 'poison' }).toThrow()
  })

  it('rejects malformed ids, timestamps, extras, and forbidden authority fields', () => {
    for (const taskId of ['', '.', '..', 'has.dot', 'x'.repeat(129), 'a/b']) {
      expectInvalid({ ...completeReport, taskId })
    }
    for (const jobId of ['', 'has space', 'x'.repeat(129), 'a/b']) {
      expectInvalid({ ...completeReport, jobId })
    }
    for (const jobStartedAt of [
      '2026-08-05T12:34:56Z', '2026-02-29T12:34:56.789Z',
      '2026-08-05T12:34:56.78Z', '2026-08-05T12:34:56.789+00:00',
    ]) expectInvalid({ ...completeReport, jobStartedAt })
    for (const field of ['capabilityId', 'taskCardSha256', 'reportSha256', 'scopeAlias', 'keyFingerprint', 'provider', 'rangeStart', 'reviewedAt', 'continuityEpoch', 'authorization']) {
      expectInvalid({ ...completeReport, [field]: 'poison' })
    }
    expectInvalid({ ...completeReport, result: { ...completeResult, poison: true } })
  })

  it('rejects inherited, symbol, accessor, proxy, cycle, and mutation poison without invoking getters', () => {
    const inherited = Object.create({ poison: true })
    Object.assign(inherited, completeReport)
    expectInvalid(inherited)
    const symbolKey = { ...completeReport, [Symbol('poison')]: true }
    expectInvalid(symbolKey)
    let getterCalled = false
    const accessor = { ...completeReport }
    Object.defineProperty(accessor, 'taskId', { enumerable: true, get: () => { getterCalled = true; return 'task' } })
    expectInvalid(accessor)
    expect(getterCalled).toBe(false)
    expectInvalid(new Proxy(completeReport, { ownKeys: () => { throw new Error('trap') } }))
    const cyclic: Record<string, unknown> = { ...completeReport }
    cyclic.result = cyclic
    expectInvalid(cyclic)

    const source: Record<string, unknown> = { ...completeReport }
    const parsed = parseGithubCoreActivationReport(source)
    source.taskId = 'mutated'
    expect(parsed.taskId).toBe(completeReport.taskId)
  })

  it('keeps malformed nested results and parser errors content-free', () => {
    expectInvalid({ ...completeReport, result: null })
    expectInvalid({ ...completeReport, result: { ...completeResult, capabilityId: 'poison' } })
    const error = (() => {
      try { parseGithubCoreActivationReport({ ...completeReport, taskId: 42 }) } catch (caught) { return caught }
      return undefined
    })()
    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({ name: 'GithubCoreActivationReportError', message: GITHUB_CORE_ACTIVATION_REPORT_ERROR_CODE })
    expect(String(error)).not.toContain('taskId')
    expect(String(error)).not.toContain('poison')
  })
})
