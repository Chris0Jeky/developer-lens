import { describe, expect, it } from 'vitest'
import { CAPABILITY_REGISTRY } from '../../shared/capabilities.js'
import {
  createCapabilityLifecycleSnapshot,
  reduceCapabilityLifecycle,
  type CapabilityLifecycleSnapshot,
} from '../lifecycle.js'
import {
  proposeV3ContinuityCandidate,
  type V3ContinuityCandidateRequest,
} from './v3ContinuityAuthorization.js'

const scopeAlias = 'scope-continuity-fixture'
const card = 'a'.repeat(64)
const preview = 'b'.repeat(64)
const proof = 'c'.repeat(64)
const report = 'd'.repeat(64)
const operationId = `op-${'e'.repeat(64)}`

function event(type: string, eventId: string, fields: Record<string, unknown> = {}): Record<string, unknown> {
  return { type, eventId, capabilityId: 'github.core', scopeAlias, epoch: 1, ...fields }
}

function apply(snapshot: CapabilityLifecycleSnapshot, candidate: unknown): CapabilityLifecycleSnapshot {
  const result = reduceCapabilityLifecycle(snapshot, candidate)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.code)
  return result.snapshot
}

function activeSnapshot(hashes: { card: string; preview: string; proof: string } = { card, preview, proof }): CapabilityLifecycleSnapshot {
  let snapshot = createCapabilityLifecycleSnapshot('github.core', scopeAlias)
  snapshot = apply(snapshot, event('bind_card', 'bind', { cardSha256: hashes.card }))
  snapshot = apply(snapshot, event('record_preview', 'preview', {
    cardSha256: hashes.card,
    previewSha256: hashes.preview,
  }))
  return apply(snapshot, event('activate', 'activate', {
    cardSha256: hashes.card,
    previewSha256: hashes.preview,
    exactHeadProofSha256: hashes.proof,
  }))
}

function request(snapshot: unknown, overrides: Partial<V3ContinuityCandidateRequest> = {}): V3ContinuityCandidateRequest {
  return {
    snapshot,
    reviewedReportSha256: report,
    reviewedAt: '2026-08-05T12:00:00.000Z',
    continuityEpoch: 1,
    expectedContinuityRevision: 0,
    operationId,
    ...overrides,
  }
}

describe('v3 structural continuity candidate', () => {
  it('accepts a replay-valid active transcript and returns a deterministic frozen candidate', () => {
    const first = proposeV3ContinuityCandidate(request(activeSnapshot(), { continuityEpoch: 2 }))
    const second = proposeV3ContinuityCandidate(request(structuredClone(activeSnapshot()), { continuityEpoch: 2 }))
    expect(first).toEqual(second)
    expect(first).toMatchObject({ ok: true, candidate: {
      kind: 'structural_continuity_candidate', status: 'structurally_eligible',
      capabilityId: 'github.core', lifecycleEpoch: 1, continuityEpoch: 2,
      expectedContinuityRevision: 0, operationId,
    } })
    if (!first.ok) throw new Error(first.code)
    expect(first.candidate.receiptDigest).toMatch(/^[0-9a-f]{64}$/)
    const serialized = JSON.stringify(first)
    for (const localC2 of [scopeAlias, card, preview, proof, report, '2026-08-05T12:00:00.000Z']) {
      expect(serialized).not.toContain(localC2)
    }
    const otherTranscript = proposeV3ContinuityCandidate(request(activeSnapshot({
      card: '1'.repeat(64), preview: '2'.repeat(64), proof: '3'.repeat(64),
    }), { continuityEpoch: 2 }))
    expect(otherTranscript).toMatchObject({ ok: true })
    if (!otherTranscript.ok) throw new Error(otherTranscript.code)
    expect(otherTranscript.candidate.receiptDigest).not.toBe(first.candidate.receiptDigest)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.candidate)).toBe(true)
    expect(() => Object.assign(first.candidate, { operationId: 'changed' })).toThrow()
  })

  it('rejects every non-active state and pending revocation', () => {
    const initial = createCapabilityLifecycleSnapshot('github.core', scopeAlias)
    const bound = apply(initial, event('bind_card', 'bind', { cardSha256: card }))
    const previewed = apply(bound, event('record_preview', 'preview', { cardSha256: card, previewSha256: preview }))
    const active = apply(previewed, event('activate', 'activate', { cardSha256: card, previewSha256: preview, exactHeadProofSha256: proof }))
    const suspended = apply(active, event('suspend', 'suspend', { cardSha256: card, previewSha256: preview, exactHeadProofSha256: proof }))
    const revoked = apply(apply(active, event('request_revocation', 'intent', {
      cardSha256: card, deletionIntentId: 'delete-intent', deletionIntentSha256: 'f'.repeat(64),
    })), event('record_deletion_receipt', 'receipt', {
      cardSha256: card, deletionIntentId: 'delete-intent', deletionIntentSha256: 'f'.repeat(64),
      receiptSha256: '1'.repeat(64), successful: true,
    }))

    for (const snapshot of [initial, bound, previewed, suspended, revoked]) {
      expect(proposeV3ContinuityCandidate(request(snapshot))).toMatchObject({ ok: false, code: 'CAPABILITY_NOT_ACTIVE' })
    }
    expect(proposeV3ContinuityCandidate(request(active, {
      snapshot: apply(active, event('request_revocation', 'pending', {
        cardSha256: card, deletionIntentId: 'delete-intent', deletionIntentSha256: 'f'.repeat(64),
      })),
    }))).toMatchObject({ ok: false, code: 'PENDING_REVOCATION' })
  })

  it('fails closed for forged/tampered transcripts and malformed request fields', () => {
    const snapshot = activeSnapshot()
    expect(proposeV3ContinuityCandidate(request({ ...snapshot, state: 'suspended' }))).toMatchObject({ ok: false, code: 'INVALID_LIFECYCLE_SNAPSHOT' })
    expect(proposeV3ContinuityCandidate(request({ ...snapshot, eventHistory: [] }))).toMatchObject({ ok: false, code: 'INVALID_LIFECYCLE_SNAPSHOT' })
    const cases: Array<[keyof V3ContinuityCandidateRequest, unknown, string]> = [
      ['reviewedReportSha256', report.toUpperCase(), 'INVALID_REVIEW_DIGEST'],
      ['reviewedAt', '2026-08-05T12:00:00Z', 'INVALID_REVIEWED_AT'],
      ['continuityEpoch', 0, 'INVALID_CONTINUITY_EPOCH'],
      ['expectedContinuityRevision', -1, 'INVALID_CONTINUITY_REVISION'],
      ['operationId', `op-${'A'.repeat(64)}`, 'INVALID_OPERATION_ID'],
    ]
    for (const [field, value, code] of cases) {
      expect(proposeV3ContinuityCandidate(request(snapshot, { [field]: value }))).toMatchObject({ ok: false, code })
    }
  })

  it('rejects malformed request containers without evaluating accessors', () => {
    for (const input of [null, [], {}, { ...request(activeSnapshot()), extra: true }]) {
      expect(proposeV3ContinuityCandidate(input)).toEqual({ ok: false, code: 'INVALID_REQUEST' })
    }
    const accessor = { ...request(activeSnapshot()) }
    Object.defineProperty(accessor, 'reviewedAt', { enumerable: true, get: () => { throw new Error('must not run') } })
    expect(proposeV3ContinuityCandidate(accessor)).toEqual({ ok: false, code: 'INVALID_REQUEST' })
  })

  it('does not mutate inputs or the capability registry', () => {
    const snapshot = activeSnapshot()
    const input = request(structuredClone(snapshot))
    const before = JSON.stringify(input)
    const registryBefore = JSON.stringify(CAPABILITY_REGISTRY)
    expect(proposeV3ContinuityCandidate(input)).toMatchObject({ ok: true })
    expect(JSON.stringify(input)).toBe(before)
    expect(JSON.stringify(CAPABILITY_REGISTRY)).toBe(registryBefore)
    expect(CAPABILITY_REGISTRY.every((definition) => definition.authorization === 'never_authorized')).toBe(true)
  })
})
