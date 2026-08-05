import { describe, expect, it } from 'vitest'
import { CAPABILITY_REGISTRY } from '../shared/capabilities.js'
import {
  capabilityLifecycleEventDigest,
  createCapabilityLifecycleRegistrySnapshots,
  createCapabilityLifecycleSnapshot,
  reduceCapabilityLifecycle,
  simulateCapabilityGateApprovals,
  type CapabilityLifecycleSnapshot,
} from './lifecycle.js'

const scopeAlias = 'scope-fixture-01'
const cardA = 'a'.repeat(64)
const cardB = 'b'.repeat(64)
const preview = 'c'.repeat(64)
const proof = 'd'.repeat(64)
const intent = 'e'.repeat(64)
const receipt = 'f'.repeat(64)

function event(type: string, eventId: string, epoch: number, fields: Record<string, unknown> = {}): Record<string, unknown> {
  return { type, eventId, capabilityId: 'github.core', scopeAlias, epoch, ...fields }
}

function applied(snapshot: CapabilityLifecycleSnapshot, candidate: unknown): CapabilityLifecycleSnapshot {
  const result = reduceCapabilityLifecycle(snapshot, candidate)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.code)
  return result.snapshot
}

function activated(): CapabilityLifecycleSnapshot {
  let snapshot = createCapabilityLifecycleSnapshot('github.core', scopeAlias)
  snapshot = applied(snapshot, event('bind_card', 'bind-01', 1, { cardSha256: cardA }))
  snapshot = applied(snapshot, event('record_preview', 'preview-01', 1, { cardSha256: cardA, previewSha256: preview }))
  return applied(snapshot, event('activate', 'activate-01', 1, {
    cardSha256: cardA,
    previewSha256: preview,
    exactHeadProofSha256: proof,
  }))
}

describe('capability lifecycle', () => {
  it('keeps every registry definition and lifecycle snapshot byte-identical when gates are approved', () => {
    const registryBefore = JSON.stringify(CAPABILITY_REGISTRY)
    const snapshots = createCapabilityLifecycleRegistrySnapshots(scopeAlias)

    for (const snapshot of snapshots) {
      const before = JSON.stringify(snapshot)
      const result = simulateCapabilityGateApprovals(snapshot, ['G2', 'G3', 'G4'])
      expect(result).toMatchObject({ ok: true })
      if (!result.ok) throw new Error(result.code)
      expect(result.snapshot).toBe(snapshot)
      expect(JSON.stringify(result.snapshot)).toBe(before)
      expect(snapshot.state).toBe('never_authorized')
      expect(snapshot.consentRevision).toBeNull()
    }

    expect(JSON.stringify(CAPABILITY_REGISTRY)).toBe(registryBefore)
    expect(CAPABILITY_REGISTRY.every((definition) => definition.authorization === 'never_authorized')).toBe(true)
  })

  it('requires a reviewed revision, matching preview, and exact-head proof before activation', () => {
    let snapshot = createCapabilityLifecycleSnapshot('github.core', scopeAlias)
    const bound = event('bind_card', 'bind-01', 1, { cardSha256: cardA })
    snapshot = applied(snapshot, bound)
    expect(snapshot).toMatchObject({ state: 'card_bound', epoch: 1, consentRevision: cardA })

    const wrongRevision = reduceCapabilityLifecycle(snapshot, event('record_preview', 'preview-bad-card', 1, {
      cardSha256: cardB,
      previewSha256: preview,
    }))
    expect(wrongRevision).toMatchObject({ ok: false, code: 'CARD_REVISION_MISMATCH', snapshot })

    snapshot = applied(snapshot, event('record_preview', 'preview-01', 1, { cardSha256: cardA, previewSha256: preview }))
    expect(reduceCapabilityLifecycle(snapshot, event('activate', 'activate-bad-preview', 1, {
      cardSha256: cardA,
      previewSha256: cardB,
      exactHeadProofSha256: proof,
    }))).toMatchObject({ ok: false, code: 'PREVIEW_MISMATCH', snapshot })

    snapshot = applied(snapshot, event('activate', 'activate-01', 1, {
      cardSha256: cardA,
      previewSha256: preview,
      exactHeadProofSha256: proof,
    }))
    expect(snapshot.state).toBe('active')
    expect(reduceCapabilityLifecycle(snapshot, event('suspend', 'suspend-bad-proof', 1, {
      cardSha256: cardA,
      previewSha256: preview,
      exactHeadProofSha256: cardB,
    }))).toMatchObject({ ok: false, code: 'EXACT_HEAD_PROOF_MISMATCH', snapshot })
  })

  it('fails closed for malformed, unknown, mismatched, and colliding events while duplicate replays are idempotent', () => {
    const initial = createCapabilityLifecycleSnapshot('github.core', scopeAlias)
    expect(reduceCapabilityLifecycle(initial, { type: 'unknown' })).toMatchObject({ ok: false, code: 'INVALID_LIFECYCLE_EVENT', snapshot: initial })
    const malformedEpoch = Object.freeze({ ...initial, state: 'card_bound' as const, cardSha256: cardA, consentRevision: cardA })
    expect(reduceCapabilityLifecycle(malformedEpoch, event('record_preview', 'malformed-epoch', 0, {
      cardSha256: cardA,
      previewSha256: preview,
    }))).toMatchObject({ ok: false, code: 'INVALID_LIFECYCLE_SNAPSHOT' })
    expect(reduceCapabilityLifecycle(initial, event('bind_card', 'bad-hash', 1, { cardSha256: 'A'.repeat(64) }))).toMatchObject({ ok: false, code: 'INVALID_LIFECYCLE_EVENT', snapshot: initial })
    expect(reduceCapabilityLifecycle(initial, event('bind_card', 'bad-epoch', 0, { cardSha256: cardA }))).toMatchObject({ ok: false, code: 'EPOCH_MISMATCH', snapshot: initial })
    expect(reduceCapabilityLifecycle(initial, { ...event('bind_card', 'wrong-scope', 1, { cardSha256: cardA }), scopeAlias: 'scope-fixture-02' })).toMatchObject({ ok: false, code: 'SCOPE_MISMATCH', snapshot: initial })

    const boundEvent = event('bind_card', 'bind-01', 1, { cardSha256: cardA })
    const bound = applied(initial, boundEvent)
    const duplicate = reduceCapabilityLifecycle(bound, boundEvent)
    expect(duplicate).toMatchObject({ ok: true, snapshot: bound })
    if (!duplicate.ok) throw new Error(duplicate.code)
    expect(duplicate.snapshot).toBe(bound)
    expect(reduceCapabilityLifecycle(bound, event('bind_card', 'bind-01', 1, { cardSha256: cardB }))).toMatchObject({ ok: false, code: 'EVENT_COLLISION', snapshot: bound })
  })

  it('rejects forged non-genesis snapshots without a replayable transcript', () => {
    const initial = createCapabilityLifecycleSnapshot('github.core', scopeAlias)
    const forgedPreviewed = Object.freeze({
      ...initial,
      state: 'previewed' as const,
      epoch: 1,
      consentRevision: cardA,
      cardSha256: cardA,
      previewSha256: preview,
    })
    const forgedActive = Object.freeze({
      ...forgedPreviewed,
      state: 'active' as const,
      exactHeadProofSha256: proof,
    })

    expect(reduceCapabilityLifecycle(forgedPreviewed, event('activate', 'forged-activate', 1, {
      cardSha256: cardA,
      previewSha256: preview,
      exactHeadProofSha256: proof,
    }))).toMatchObject({ ok: false, code: 'INVALID_LIFECYCLE_SNAPSHOT' })
    expect(reduceCapabilityLifecycle(forgedActive, event('suspend', 'forged-suspend', 1, {
      cardSha256: cardA,
      previewSha256: preview,
      exactHeadProofSha256: proof,
    }))).toMatchObject({ ok: false, code: 'INVALID_LIFECYCLE_SNAPSHOT' })
  })

  it('rejects missing, reordered, tampered, and state-divergent transcripts while accepting legal replay', () => {
    const snapshot = activated()
    const [bindRecord, previewRecord, activateRecord] = snapshot.eventHistory
    if (!bindRecord || !previewRecord || !activateRecord || previewRecord.event.type !== 'record_preview') {
      throw new Error('invented transcript is incomplete')
    }
    const candidate = event('suspend', 'suspend-01', 1, {
      cardSha256: cardA,
      previewSha256: preview,
      exactHeadProofSha256: proof,
    })

    expect(reduceCapabilityLifecycle({ ...snapshot, eventHistory: [previewRecord, bindRecord, activateRecord] }, candidate)).toMatchObject({
      ok: false, code: 'INVALID_LIFECYCLE_SNAPSHOT',
    })
    expect(reduceCapabilityLifecycle({ ...snapshot, eventHistory: [bindRecord, activateRecord] }, candidate)).toMatchObject({
      ok: false, code: 'INVALID_LIFECYCLE_SNAPSHOT',
    })
    expect(reduceCapabilityLifecycle({
      ...snapshot,
      eventHistory: [bindRecord, { ...previewRecord, digest: cardB }, activateRecord],
    }, candidate)).toMatchObject({ ok: false, code: 'INVALID_LIFECYCLE_SNAPSHOT' })
    expect(reduceCapabilityLifecycle({
      ...snapshot,
      eventHistory: [
        bindRecord,
        { ...previewRecord, event: { ...previewRecord.event, previewSha256: cardB } },
        activateRecord,
      ],
    }, candidate)).toMatchObject({ ok: false, code: 'INVALID_LIFECYCLE_SNAPSHOT' })
    const tamperedPreview = { ...previewRecord.event, previewSha256: cardB }
    expect(reduceCapabilityLifecycle({
      ...snapshot,
      eventHistory: [
        bindRecord,
        { event: tamperedPreview, digest: capabilityLifecycleEventDigest(tamperedPreview) },
        activateRecord,
      ],
    }, candidate)).toMatchObject({ ok: false, code: 'INVALID_LIFECYCLE_SNAPSHOT' })
    expect(reduceCapabilityLifecycle({ ...snapshot, state: 'suspended' }, candidate)).toMatchObject({
      ok: false, code: 'INVALID_LIFECYCLE_SNAPSHOT',
    })

    const replayed = reduceCapabilityLifecycle(structuredClone(snapshot), candidate)
    expect(replayed).toMatchObject({ ok: true, snapshot: { state: 'suspended' } })
    if (!replayed.ok) throw new Error(replayed.code)
    expect(Object.isFrozen(replayed.snapshot)).toBe(true)
    expect(Object.isFrozen(replayed.snapshot.eventHistory.at(-1)?.event)).toBe(true)
  })

  it('requires a matching successful deletion receipt before revocation and makes that revision terminal', () => {
    let snapshot = activated()
    snapshot = applied(snapshot, event('request_revocation', 'intent-01', 1, {
      cardSha256: cardA,
      deletionIntentId: 'delete-intent-01',
      deletionIntentSha256: intent,
    }))
    expect(snapshot).toMatchObject({ state: 'active', deletionIntentId: 'delete-intent-01' })
    expect(reduceCapabilityLifecycle(snapshot, event('record_deletion_receipt', 'receipt-wrong', 1, {
      cardSha256: cardA,
      deletionIntentId: 'different-intent',
      deletionIntentSha256: intent,
      receiptSha256: receipt,
      successful: true,
    }))).toMatchObject({ ok: false, code: 'REVOCATION_RECEIPT_MISMATCH', snapshot })

    snapshot = applied(snapshot, event('record_deletion_receipt', 'receipt-01', 1, {
      cardSha256: cardA,
      deletionIntentId: 'delete-intent-01',
      deletionIntentSha256: intent,
      receiptSha256: receipt,
      successful: true,
    }))
    expect(snapshot.state).toBe('revoked')
    expect(reduceCapabilityLifecycle(snapshot, event('bind_card', 'same-card', 2, { cardSha256: cardA }))).toMatchObject({
      ok: false, code: 'REVOKED_REVISION_TERMINAL', snapshot,
    })

    const renewed = applied(snapshot, event('bind_card', 'new-card', 2, { cardSha256: cardB }))
    expect(renewed).toMatchObject({ state: 'card_bound', epoch: 2, consentRevision: cardB, previewSha256: null })
  })

  it('uses canonical digests and deep-frozen outputs without retaining mutable caller objects', () => {
    const first = event('bind_card', 'bind-01', 1, { cardSha256: cardA })
    const reordered = { cardSha256: cardA, epoch: 1, scopeAlias, capabilityId: 'github.core', eventId: 'bind-01', type: 'bind_card' }
    expect(capabilityLifecycleEventDigest(first as never)).toBe(capabilityLifecycleEventDigest(reordered as never))

    const snapshot = applied(createCapabilityLifecycleSnapshot('github.core', scopeAlias), first)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.eventHistory)).toBe(true)
    expect(Object.isFrozen(snapshot.eventHistory[0])).toBe(true)
    expect(Object.isFrozen(snapshot.eventHistory[0]?.event)).toBe(true)
    expect(Object.isFrozen(snapshot)).toBe(true)
  })
})
