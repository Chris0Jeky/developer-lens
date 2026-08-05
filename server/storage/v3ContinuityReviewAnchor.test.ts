import { describe, expect, it } from 'vitest'
import {
  GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_ERROR_CODE,
  GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_SCHEMA_VERSION,
  parseGithubCoreContinuityReviewAnchor,
} from './v3ContinuityReviewAnchor.js'

const digest = '0123456789abcdef'.repeat(4)
const completeAnchor = {
  schemaVersion: GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_SCHEMA_VERSION,
  capabilityId: 'github.core',
  taskId: 'fixture-card-01',
  reviewDecision: 'approve_continuity_renewal',
  reviewedReportSha256: digest,
  reviewedTaskCardSha256: 'a'.repeat(64),
  reviewedInstallationKeyFingerprint: 'b'.repeat(64),
  reviewedLifecycleState: 'active',
  reviewedLifecycleEpoch: 7,
  reviewedPreviewSha256: 'c'.repeat(64),
  reviewedExactHeadProofSha256: 'd'.repeat(64),
  reviewedDeletionIntentId: null,
  reviewedDeletionIntentSha256: null,
  reviewedDeletionReceiptSha256: null,
  reviewedContinuityEpoch: 11,
  reviewedAt: '2026-08-05T12:34:56.789Z',
} as const

function expectInvalid(value: unknown): void {
  expect(() => parseGithubCoreContinuityReviewAnchor(value)).toThrow(
    GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_ERROR_CODE,
  )
  try {
    parseGithubCoreContinuityReviewAnchor(value)
  } catch (error) {
    expect(error).toMatchObject({
      code: GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_ERROR_CODE,
      message: GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_ERROR_CODE,
      name: 'GithubCoreContinuityReviewAnchorError',
    })
    expect(String(error)).not.toContain('poison')
  }
}

describe('github.core continuity review anchor parser', () => {
  it('accepts a valid anchor, reconstructs fixed order, and freezes output', () => {
    const parsed = parseGithubCoreContinuityReviewAnchor(completeAnchor)
    expect(Object.keys(parsed)).toEqual([
      'schemaVersion', 'capabilityId', 'taskId', 'reviewDecision',
      'reviewedReportSha256', 'reviewedTaskCardSha256', 'reviewedInstallationKeyFingerprint',
      'reviewedLifecycleState', 'reviewedLifecycleEpoch', 'reviewedPreviewSha256',
      'reviewedExactHeadProofSha256', 'reviewedDeletionIntentId', 'reviewedDeletionIntentSha256',
      'reviewedDeletionReceiptSha256', 'reviewedContinuityEpoch', 'reviewedAt',
    ])
    expect(parsed).toEqual(completeAnchor)
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(() => { (parsed as { taskId: string }).taskId = 'poison' }).toThrow()
  })

  it('normalizes key permutations to deterministic JSON and detaches source mutation', () => {
    const permuted = {
      reviewedAt: completeAnchor.reviewedAt,
      reviewedContinuityEpoch: completeAnchor.reviewedContinuityEpoch,
      reviewedExactHeadProofSha256: completeAnchor.reviewedExactHeadProofSha256,
      reviewedPreviewSha256: completeAnchor.reviewedPreviewSha256,
      reviewedLifecycleEpoch: completeAnchor.reviewedLifecycleEpoch,
      reviewedLifecycleState: completeAnchor.reviewedLifecycleState,
      reviewedDeletionReceiptSha256: completeAnchor.reviewedDeletionReceiptSha256,
      reviewedDeletionIntentSha256: completeAnchor.reviewedDeletionIntentSha256,
      reviewedDeletionIntentId: completeAnchor.reviewedDeletionIntentId,
      reviewedInstallationKeyFingerprint: completeAnchor.reviewedInstallationKeyFingerprint,
      reviewedTaskCardSha256: completeAnchor.reviewedTaskCardSha256,
      reviewedReportSha256: completeAnchor.reviewedReportSha256,
      reviewDecision: completeAnchor.reviewDecision,
      taskId: completeAnchor.taskId,
      capabilityId: completeAnchor.capabilityId,
      schemaVersion: completeAnchor.schemaVersion,
    }
    const first = parseGithubCoreContinuityReviewAnchor(completeAnchor)
    const second = parseGithubCoreContinuityReviewAnchor(permuted)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    const source: Record<string, unknown> = { ...completeAnchor }
    const detached = parseGithubCoreContinuityReviewAnchor(source)
    source.taskId = 'mutated'
    expect(detached.taskId).toBe(completeAnchor.taskId)
  })

  it('rejects malformed values for every field and forbidden authority fields', () => {
    const malformed: Record<string, unknown> = { ...completeAnchor }
    const cases: Array<[string, unknown]> = [
      ['schemaVersion', 'poison'], ['capabilityId', 'poison'], ['taskId', 'has.dot'],
      ['reviewDecision', 'approved'], ['reviewedReportSha256', 'A'.repeat(64)],
      ['reviewedTaskCardSha256', 'short'], ['reviewedInstallationKeyFingerprint', 'g'.repeat(64)],
      ['reviewedLifecycleState', 'expired'], ['reviewedLifecycleEpoch', 0],
      ['reviewedPreviewSha256', 'e'.repeat(63)], ['reviewedExactHeadProofSha256', 'f'.repeat(65)],
      ['reviewedDeletionIntentId', 'poison'], ['reviewedDeletionIntentSha256', 'poison'],
      ['reviewedDeletionReceiptSha256', 'poison'],
      ['reviewedContinuityEpoch', Number.MAX_SAFE_INTEGER + 1],
      ['reviewedAt', '2026-02-29T12:34:56.789Z'],
    ]
    for (const [field, value] of cases) expectInvalid({ ...malformed, [field]: value })
    for (const field of [
      'scopeAlias', 'rawKey', 'provider', 'repository', 'reportSha256', 'expectedRevision',
      'operationId', 'trustedNow', 'asOf', 'expiresAt', 'owner', 'signature', 'authorization',
    ]) expectInvalid({ ...completeAnchor, [field]: 'poison' })
    for (const field of [
      'reviewedDeletionIntentId', 'reviewedDeletionIntentSha256', 'reviewedDeletionReceiptSha256',
    ]) {
      const omitted: Record<string, unknown> = { ...completeAnchor }
      delete omitted[field]
      expectInvalid(omitted)
    }
    expectInvalid({ ...completeAnchor, taskId: 'a/b' })
    expectInvalid({ ...completeAnchor, taskId: 'x'.repeat(129) })
  })

  it('rejects inherited, symbols, accessors, proxies, cycles, and __proto__ poison without getters', () => {
    const inherited = Object.create({ poison: true })
    Object.assign(inherited, completeAnchor)
    expectInvalid(inherited)
    expectInvalid({ ...completeAnchor, [Symbol('poison')]: true })
    let getterCalled = false
    const accessor = { ...completeAnchor }
    Object.defineProperty(accessor, 'taskId', {
      enumerable: true,
      get: () => { getterCalled = true; return completeAnchor.taskId },
    })
    expectInvalid(accessor)
    expect(getterCalled).toBe(false)
    expectInvalid(new Proxy(completeAnchor, { ownKeys: () => { throw new Error('poison') } }))
    const cyclic: Record<string, unknown> = { ...completeAnchor }
    cyclic.self = cyclic
    expectInvalid(cyclic)
    const protoPoison = { ...completeAnchor }
    Object.defineProperty(protoPoison, '__proto__', { enumerable: true, value: { poison: true } })
    expectInvalid(protoPoison)
  })

  it('keeps parser errors content-free for malformed objects', () => {
    const error = (() => {
      try { parseGithubCoreContinuityReviewAnchor({ ...completeAnchor, taskId: 'poison!' }) } catch (caught) { return caught }
      return undefined
    })()
    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({
      name: 'GithubCoreContinuityReviewAnchorError',
      message: GITHUB_CORE_CONTINUITY_REVIEW_ANCHOR_ERROR_CODE,
    })
    expect(String(error)).not.toContain('taskId')
    expect(String(error)).not.toContain('poison')
  })
})
