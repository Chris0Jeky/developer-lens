import { describe, expect, it } from 'vitest'
import {
  GITHUB_CORE_ACTIVATION_RESULT_ERROR_CODE,
  GITHUB_CORE_ACTIVATION_RESULT_SCHEMA_VERSION,
  parseGithubCoreActivationResult,
} from './activationResult.js'

const complete = {
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

function expectInvalid(value: unknown): void {
  expect(() => parseGithubCoreActivationResult(value)).toThrow(GITHUB_CORE_ACTIVATION_RESULT_ERROR_CODE)
  try { parseGithubCoreActivationResult(value) } catch (error) {
    expect(error).toMatchObject({ code: GITHUB_CORE_ACTIVATION_RESULT_ERROR_CODE, message: GITHUB_CORE_ACTIVATION_RESULT_ERROR_CODE })
  }
}

describe('github.core activation result C1 parser', () => {
  it('accepts complete zero and keeps the exact closed C1 key order', () => {
    const result = parseGithubCoreActivationResult(complete)
    expect(Object.keys(result)).toEqual(['schemaVersion', 'capabilityId', 'stability', 'coverage', 'requests'])
    expect(Object.keys(result.coverage)).toEqual([
      'status', 'expectedUnits', 'observedUnits', 'omittedUnits', 'completeObservedUnits',
      'saturationReason', 'retryable', 'limitationCode',
    ])
    expect(Object.keys(result.requests)).toEqual([
      'maximumRequests', 'firstProbeMaximumRequests', 'secondProbeMaximumRequests',
      'firstProbeRequests', 'secondProbeRequests', 'totalRequests',
    ])
    expect(result).toEqual(complete)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.coverage)).toBe(true)
    expect(Object.isFrozen(result.requests)).toBe(true)
  })

  it('accepts each restricted, terminal-failure, and truncated truth-table branch', () => {
    const cases = [
      ['restricted', 'REPOSITORY_ID_MISMATCH', false, 0, 1],
      ['restricted', 'REPOSITORY_NOT_PUBLIC', false, 0, 1],
      ['restricted', 'PERMISSION_DENIED', false, 0, 1],
      ['restricted', 'NOT_FOUND', false, 0, 1],
      ['failed', 'SCHEMA_INVALID', false, 0, 1],
      ['failed', 'UNSUPPORTED', false, 0, 1],
      ['failed', 'FAILURE_TRANSIENT', true, 0, 1],
      ['truncated', 'REQUEST_BUDGET_EXHAUSTED', true, 4, 2],
      ['truncated', 'RATE_LIMITED', true, 0, 1],
    ] as const
    for (const [status, limitationCode, retryable, observedUnits, firstProbeRequests] of cases) {
      const result = parseGithubCoreActivationResult({
        ...complete,
        stability: 'not_observed',
        coverage: {
          ...complete.coverage,
          status,
          expectedUnits: null,
          observedUnits,
          omittedUnits: null,
          completeObservedUnits: null,
          saturationReason: status === 'truncated' ? limitationCode : null,
          retryable,
          limitationCode,
        },
        requests: { ...complete.requests, firstProbeRequests, secondProbeRequests: 0, totalRequests: firstProbeRequests },
      })
      expect(result.coverage.limitationCode).toBe(limitationCode)
    }
    const unstable = parseGithubCoreActivationResult({
      ...complete,
      stability: 'unstable',
      coverage: {
        ...complete.coverage,
        status: 'truncated', expectedUnits: null, observedUnits: 0, omittedUnits: null,
        completeObservedUnits: null, saturationReason: 'SNAPSHOT_UNSTABLE', retryable: true,
        limitationCode: 'SNAPSHOT_UNSTABLE',
      },
    })
    expect(unstable.stability).toBe('unstable')
    expectInvalid({
      ...complete,
      stability: 'not_observed',
      coverage: {
        ...complete.coverage, status: 'restricted', expectedUnits: null, observedUnits: 1,
        omittedUnits: null, completeObservedUnits: null, saturationReason: null,
        retryable: false, limitationCode: 'NOT_FOUND',
      },
      requests: { ...complete.requests, firstProbeRequests: 1, secondProbeRequests: 0, totalRequests: 1 },
    })
  })

  it('validates odd request budgets, sub-budget use, and stable/unstable probe minima', () => {
    const odd = parseGithubCoreActivationResult({ ...complete, requests: {
      maximumRequests: 7, firstProbeMaximumRequests: 3, secondProbeMaximumRequests: 4,
      firstProbeRequests: 2, secondProbeRequests: 3, totalRequests: 5,
    } })
    expect(odd.requests.totalRequests).toBe(5)
    expectInvalid({ ...complete, requests: { ...odd.requests, firstProbeRequests: 1, secondProbeRequests: 1, totalRequests: 2 } })
    expectInvalid({ ...complete, requests: { ...odd.requests, firstProbeRequests: 2, secondProbeRequests: 1, totalRequests: 3 } })

    const truncated = {
      ...complete,
      stability: 'not_observed',
      coverage: {
        ...complete.coverage, status: 'truncated', expectedUnits: null, observedUnits: 0,
        omittedUnits: null, completeObservedUnits: null, saturationReason: 'REQUEST_BUDGET_EXHAUSTED',
        retryable: true, limitationCode: 'REQUEST_BUDGET_EXHAUSTED',
      },
    }
    expectInvalid({ ...truncated, requests: { ...complete.requests, firstProbeRequests: 1, secondProbeRequests: 0, totalRequests: 1 } })
    expectInvalid({ ...truncated, requests: { ...complete.requests, firstProbeRequests: 2, secondProbeRequests: 1, totalRequests: 3 } })
    expect(parseGithubCoreActivationResult({
      ...truncated,
      requests: { ...complete.requests, firstProbeRequests: 2, secondProbeRequests: 3, totalRequests: 5 },
    }).requests.secondProbeRequests).toBe(3)

    const rateLimited = {
      ...truncated,
      coverage: {
        ...truncated.coverage, observedUnits: 1, saturationReason: 'RATE_LIMITED', limitationCode: 'RATE_LIMITED',
      },
    }
    expectInvalid({ ...rateLimited, requests: { ...complete.requests, firstProbeRequests: 1, secondProbeRequests: 0, totalRequests: 1 } })
    expectInvalid({ ...rateLimited, requests: { ...complete.requests, firstProbeRequests: 2, secondProbeRequests: 0, totalRequests: 2 } })
    expect(parseGithubCoreActivationResult({
      ...rateLimited,
      requests: {
        maximumRequests: 7, firstProbeMaximumRequests: 3, secondProbeMaximumRequests: 4,
        firstProbeRequests: 3, secondProbeRequests: 0, totalRequests: 3,
      },
    }).coverage.observedUnits).toBe(1)
  })

  it('rejects malformed codes, inconsistent fields, and impossible stability', () => {
    const bad = [
      { coverage: { ...complete.coverage, limitationCode: 'NOT_FOUND' } },
      { coverage: { ...complete.coverage, expectedUnits: 1 } },
      { coverage: { ...complete.coverage, omittedUnits: 1 } },
      { coverage: { ...complete.coverage, saturationReason: 'COMPLETE' } },
      { coverage: { ...complete.coverage, retryable: true } },
      { stability: 'not_observed' },
      { stability: 'unstable', coverage: { ...complete.coverage, status: 'truncated', expectedUnits: null, observedUnits: 1, omittedUnits: null, completeObservedUnits: null, saturationReason: 'SNAPSHOT_UNSTABLE', retryable: true, limitationCode: 'SNAPSHOT_UNSTABLE' } },
      { stability: 'stable', coverage: { ...complete.coverage, status: 'failed', expectedUnits: null, observedUnits: 1, omittedUnits: null, completeObservedUnits: null, limitationCode: 'SCHEMA_INVALID' } },
    ]
    for (const patch of bad) expectInvalid({ ...complete, ...patch })
    expectInvalid({ ...complete, requests: { ...complete.requests, maximumRequests: 21 } })
    expectInvalid({ ...complete, requests: { ...complete.requests, firstProbeMaximumRequests: 3 } })
    expectInvalid({ ...complete, requests: { ...complete.requests, totalRequests: 99 } })
  })

  it('rejects extras, inherited values, accessors, proxies, and input mutation', () => {
    expectInvalid({ ...complete, scopeAlias: 'poison' })
    const inherited = Object.create({ capabilityId: 'github.core' })
    Object.assign(inherited, { ...complete, capabilityId: undefined })
    delete inherited.capabilityId
    expectInvalid(inherited)
    const accessor = { ...complete, capabilityId: 'github.core' }
    Object.defineProperty(accessor, 'schemaVersion', { get: () => GITHUB_CORE_ACTIVATION_RESULT_SCHEMA_VERSION, enumerable: true })
    expectInvalid(accessor)
    const trapped = new Proxy(complete, { ownKeys: () => { throw new Error('trap') } })
    expectInvalid(trapped)
    const protoExtra = { ...complete }
    Object.defineProperty(protoExtra, '__proto__', { enumerable: true, value: { poisoned: true } })
    expectInvalid(protoExtra)
    const source = structuredClone(complete)
    const result = parseGithubCoreActivationResult(source)
    Reflect.set(source.coverage, 'observedUnits', 99)
    expect(result.coverage.observedUnits).toBe(0)
    expectInvalid({ ...complete, coverage: { ...complete.coverage, observedUnits: Number.MAX_SAFE_INTEGER + 1 } })
  })

  it('rejects numeric non-counts, request split/sum/cap mismatches, and status truth mismatches', () => {
    for (const value of [NaN, Infinity, -Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expectInvalid({ ...complete, coverage: { ...complete.coverage, observedUnits: value } })
      expectInvalid({ ...complete, requests: { ...complete.requests, totalRequests: value } })
    }
    const requestMismatches = [
      { maximumRequests: 1 },
      { maximumRequests: 20, firstProbeMaximumRequests: 9 },
      { maximumRequests: 5, secondProbeMaximumRequests: 2 },
      { firstProbeRequests: 3, secondProbeRequests: 2, totalRequests: 4 },
      { firstProbeRequests: 3, secondProbeRequests: 3, totalRequests: 6 },
    ]
    for (const patch of requestMismatches) expectInvalid({ ...complete, requests: { ...complete.requests, ...patch } })
    const noncomplete = {
      ...complete,
      stability: 'not_observed',
      coverage: {
        ...complete.coverage, status: 'truncated', expectedUnits: null, observedUnits: 3,
        omittedUnits: null, completeObservedUnits: null, saturationReason: 'RATE_LIMITED',
        retryable: true, limitationCode: 'RATE_LIMITED',
      },
      requests: { ...complete.requests, firstProbeRequests: 1, secondProbeRequests: 0, totalRequests: 1 },
    }
    expectInvalid({ ...noncomplete, coverage: { ...noncomplete.coverage, saturationReason: null } })
    expectInvalid({ ...noncomplete, coverage: { ...noncomplete.coverage, retryable: false } })
    expectInvalid({ ...noncomplete, coverage: { ...noncomplete.coverage, limitationCode: 'NOT_FOUND' } })
    expectInvalid({ ...noncomplete, stability: 'stable' })
    expectInvalid({ ...noncomplete, stability: 'unstable', coverage: { ...noncomplete.coverage, limitationCode: 'RATE_LIMITED' } })
  })

  it('rejects nested accessors, proxy traps, and cycles without invoking getters', () => {
    let invoked = false
    const nestedAccessor = { ...complete, coverage: { ...complete.coverage } }
    Object.defineProperty(nestedAccessor.coverage, 'status', {
      enumerable: true,
      get: () => { invoked = true; return 'complete' },
    })
    expectInvalid(nestedAccessor)
    expect(invoked).toBe(false)
    const nestedProxy = { ...complete, requests: new Proxy(complete.requests, { ownKeys: () => { throw new Error('trap') } }) }
    expectInvalid(nestedProxy)
    const cycle = { ...complete, coverage: { ...complete.coverage } as Record<string, unknown> }
    cycle.coverage.self = cycle.coverage
    expectInvalid(cycle)
  })

  it('normalizes key permutations to byte-identical fixed JSON and freezes every output object', () => {
    const permuted = {
      requests: {
        totalRequests: 4, secondProbeRequests: 2, firstProbeRequests: 2,
        secondProbeMaximumRequests: 3, firstProbeMaximumRequests: 2, maximumRequests: 5,
      },
      coverage: {
        limitationCode: 'COMPLETE', retryable: false, saturationReason: null,
        completeObservedUnits: 0, omittedUnits: 0, observedUnits: 0, expectedUnits: 0, status: 'complete',
      },
      stability: 'stable', capabilityId: 'github.core', schemaVersion: GITHUB_CORE_ACTIVATION_RESULT_SCHEMA_VERSION,
    }
    const left = parseGithubCoreActivationResult(complete)
    const right = parseGithubCoreActivationResult(permuted)
    expect(JSON.stringify(left)).toBe(JSON.stringify(right))
    const assertFrozen = (value: unknown): void => {
      if (!value || typeof value !== 'object') return
      expect(Object.isFrozen(value)).toBe(true)
      for (const child of Object.values(value)) assertFrozen(child)
    }
    assertFrozen(right)
  })

  it('accepts a null-prototype own-data fixture but still rejects inherited values', () => {
    const nullPrototype = Object.create(null) as Record<string, unknown>
    for (const [key, value] of Object.entries(complete)) nullPrototype[key] = value
    expect(parseGithubCoreActivationResult(nullPrototype).capabilityId).toBe('github.core')
  })
})
