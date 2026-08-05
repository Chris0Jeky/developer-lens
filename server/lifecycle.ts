import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  CAPABILITY_REGISTRY,
  CapabilityIdSchema,
  CapabilityLifecycleStateSchema,
  CapabilityScopeAliasSchema,
  LowercaseSha256Schema,
  createNeverAuthorizedCapabilityLifecycleSnapshot,
  type CapabilityId,
} from '../shared/capabilities.js'

export const CAPABILITY_LIFECYCLE_ERROR_CODES = [
  'INVALID_LIFECYCLE_SNAPSHOT',
  'INVALID_LIFECYCLE_EVENT',
  'EVENT_COLLISION',
  'CAPABILITY_MISMATCH',
  'SCOPE_MISMATCH',
  'EPOCH_MISMATCH',
  'ILLEGAL_TRANSITION',
  'CARD_REVISION_MISMATCH',
  'PREVIEW_MISMATCH',
  'EXACT_HEAD_PROOF_MISMATCH',
  'REVOCATION_RECEIPT_MISMATCH',
  'REVOKED_REVISION_TERMINAL',
] as const
export type CapabilityLifecycleErrorCode = typeof CAPABILITY_LIFECYCLE_ERROR_CODES[number]

export class CapabilityLifecycleError extends Error {
  readonly code: CapabilityLifecycleErrorCode

  constructor(code: CapabilityLifecycleErrorCode) {
    super(code)
    this.name = 'CapabilityLifecycleError'
    this.code = code
  }
}

const EventIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const GateSchema = z.enum(['G2', 'G3', 'G4'])
const EventRecordSchema = z.object({
  eventId: EventIdSchema,
  digest: LowercaseSha256Schema,
}).strict()

const eventBase = z.object({
  eventId: EventIdSchema,
  capabilityId: CapabilityIdSchema,
  scopeAlias: CapabilityScopeAliasSchema,
  epoch: z.number().int().min(0),
}).strict()

export const CapabilityLifecycleEventSchema = z.discriminatedUnion('type', [
  eventBase.extend({ type: z.literal('bind_card'), cardSha256: LowercaseSha256Schema }),
  eventBase.extend({
    type: z.literal('record_preview'),
    cardSha256: LowercaseSha256Schema,
    previewSha256: LowercaseSha256Schema,
  }),
  eventBase.extend({
    type: z.literal('activate'),
    cardSha256: LowercaseSha256Schema,
    previewSha256: LowercaseSha256Schema,
    exactHeadProofSha256: LowercaseSha256Schema,
  }),
  eventBase.extend({
    type: z.literal('suspend'),
    cardSha256: LowercaseSha256Schema,
    previewSha256: LowercaseSha256Schema,
    exactHeadProofSha256: LowercaseSha256Schema,
  }),
  eventBase.extend({
    type: z.literal('resume'),
    cardSha256: LowercaseSha256Schema,
    previewSha256: LowercaseSha256Schema,
    exactHeadProofSha256: LowercaseSha256Schema,
  }),
  eventBase.extend({
    type: z.literal('request_revocation'),
    cardSha256: LowercaseSha256Schema,
    deletionIntentId: EventIdSchema,
    deletionIntentSha256: LowercaseSha256Schema,
  }),
  eventBase.extend({
    type: z.literal('record_deletion_receipt'),
    cardSha256: LowercaseSha256Schema,
    deletionIntentId: EventIdSchema,
    deletionIntentSha256: LowercaseSha256Schema,
    receiptSha256: LowercaseSha256Schema,
    successful: z.literal(true),
  }),
])
export type CapabilityLifecycleEvent = z.infer<typeof CapabilityLifecycleEventSchema>

export const CapabilityLifecycleSnapshotSchema = z.object({
  capabilityId: CapabilityIdSchema,
  scopeAlias: CapabilityScopeAliasSchema,
  state: CapabilityLifecycleStateSchema,
  epoch: z.number().int().min(0),
  consentRevision: LowercaseSha256Schema.nullable(),
  cardSha256: LowercaseSha256Schema.nullable(),
  previewSha256: LowercaseSha256Schema.nullable(),
  exactHeadProofSha256: LowercaseSha256Schema.nullable(),
  deletionIntentId: EventIdSchema.nullable(),
  deletionIntentSha256: LowercaseSha256Schema.nullable(),
  deletionReceiptSha256: LowercaseSha256Schema.nullable(),
  eventHistory: z.array(EventRecordSchema),
}).strict().superRefine((snapshot, context) => {
  const hasCard = snapshot.cardSha256 !== null && snapshot.consentRevision === snapshot.cardSha256
  const hasPreview = snapshot.previewSha256 !== null
  const hasProof = snapshot.exactHeadProofSha256 !== null
  const hasIntent = snapshot.deletionIntentId !== null && snapshot.deletionIntentSha256 !== null
  const hasReceipt = snapshot.deletionReceiptSha256 !== null
  const eventIds = snapshot.eventHistory.map((event) => event.eventId)
  if (new Set(eventIds).size !== eventIds.length) context.addIssue({ code: 'custom' })
  if (snapshot.state === 'never_authorized') {
    if (snapshot.epoch !== 0 || hasCard || hasPreview || hasProof || hasIntent || hasReceipt) context.addIssue({ code: 'custom' })
    return
  }
  if (snapshot.epoch < 1) context.addIssue({ code: 'custom' })
  if (!hasCard) context.addIssue({ code: 'custom' })
  if (snapshot.state === 'card_bound') {
    if (hasPreview || hasProof || hasIntent || hasReceipt) context.addIssue({ code: 'custom' })
    return
  }
  if (snapshot.state === 'previewed') {
    if (!hasPreview || hasProof || hasIntent || hasReceipt) context.addIssue({ code: 'custom' })
    return
  }
  if (snapshot.state === 'active' || snapshot.state === 'suspended') {
    if (!hasPreview || !hasProof || hasReceipt) context.addIssue({ code: 'custom' })
    return
  }
  if (!hasPreview || !hasProof || !hasIntent || !hasReceipt) context.addIssue({ code: 'custom' })
})
export type CapabilityLifecycleSnapshot = z.infer<typeof CapabilityLifecycleSnapshotSchema>

export type CapabilityLifecycleReduction =
  | Readonly<{ ok: true; snapshot: CapabilityLifecycleSnapshot }>
  | Readonly<{ ok: false; code: CapabilityLifecycleErrorCode; snapshot?: CapabilityLifecycleSnapshot }>

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child)
  }
  return value
}

function isDeepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true
  if (!Object.isFrozen(value)) return false
  return Object.values(value as Record<string, unknown>).every(isDeepFrozen)
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function capabilityLifecycleEventDigest(event: CapabilityLifecycleEvent): string {
  return createHash('sha256').update(stableJson(event), 'utf8').digest('hex')
}

function validSnapshot(input: unknown): CapabilityLifecycleSnapshot | null {
  const parsed = CapabilityLifecycleSnapshotSchema.safeParse(input)
  if (!parsed.success) return null
  return isDeepFrozen(input)
    ? input as CapabilityLifecycleSnapshot
    : freezeDeep(parsed.data)
}

function success(snapshot: CapabilityLifecycleSnapshot): CapabilityLifecycleReduction {
  return Object.freeze({ ok: true as const, snapshot })
}

function failure(code: CapabilityLifecycleErrorCode, snapshot?: CapabilityLifecycleSnapshot): CapabilityLifecycleReduction {
  return Object.freeze(snapshot ? { ok: false as const, code, snapshot } : { ok: false as const, code })
}

function nextSnapshot(
  snapshot: CapabilityLifecycleSnapshot,
  event: CapabilityLifecycleEvent,
  changes: Partial<Omit<CapabilityLifecycleSnapshot, 'eventHistory'>>,
): CapabilityLifecycleSnapshot {
  return freezeDeep({
    ...snapshot,
    ...changes,
    eventHistory: [...snapshot.eventHistory, Object.freeze({ eventId: event.eventId, digest: capabilityLifecycleEventDigest(event) })],
  })
}

function cardMatches(snapshot: CapabilityLifecycleSnapshot, cardSha256: string): boolean {
  return snapshot.consentRevision === cardSha256 && snapshot.cardSha256 === cardSha256
}

function previewAndProofMatch(
  snapshot: CapabilityLifecycleSnapshot,
  event: Extract<CapabilityLifecycleEvent, { previewSha256: string; exactHeadProofSha256: string }>,
): CapabilityLifecycleErrorCode | null {
  if (!cardMatches(snapshot, event.cardSha256)) return 'CARD_REVISION_MISMATCH'
  if (snapshot.previewSha256 !== event.previewSha256) return 'PREVIEW_MISMATCH'
  if (snapshot.exactHeadProofSha256 !== event.exactHeadProofSha256) return 'EXACT_HEAD_PROOF_MISMATCH'
  return null
}

/** Construct one immutable inert lifecycle instance. */
export function createCapabilityLifecycleSnapshot(
  capabilityId: CapabilityId,
  scopeAlias: string,
): CapabilityLifecycleSnapshot {
  try {
    const initial = createNeverAuthorizedCapabilityLifecycleSnapshot(capabilityId, scopeAlias)
    return freezeDeep({
      ...initial,
      cardSha256: null,
      previewSha256: null,
      exactHeadProofSha256: null,
      deletionIntentId: null,
      deletionIntentSha256: null,
      deletionReceiptSha256: null,
      eventHistory: [],
    })
  } catch {
    throw new CapabilityLifecycleError('INVALID_LIFECYCLE_SNAPSHOT')
  }
}

/** Instantiate every registry capability without changing registry authorization literals. */
export function createCapabilityLifecycleRegistrySnapshots(scopeAlias: string): readonly CapabilityLifecycleSnapshot[] {
  return freezeDeep(CAPABILITY_REGISTRY.map((definition) => createCapabilityLifecycleSnapshot(definition.id, scopeAlias)))
}

/**
 * Gate decisions are descriptive authority, never lifecycle events. This seam
 * intentionally returns the exact immutable snapshot unchanged.
 */
export function simulateCapabilityGateApprovals(
  input: unknown,
  approvedGates: unknown,
): CapabilityLifecycleReduction {
  const snapshot = validSnapshot(input)
  if (!snapshot) return failure('INVALID_LIFECYCLE_SNAPSHOT')
  const gates = z.array(GateSchema).safeParse(approvedGates)
  if (!gates.success || new Set(gates.data).size !== gates.data.length) return failure('INVALID_LIFECYCLE_EVENT', snapshot)
  return success(snapshot)
}

/**
 * Pure, database-free transition reducer. It records only opaque event and
 * evidence digests, so callers cannot use it as a persistence or activation path.
 */
export function reduceCapabilityLifecycle(input: unknown, candidateEvent: unknown): CapabilityLifecycleReduction {
  const snapshot = validSnapshot(input)
  if (!snapshot) return failure('INVALID_LIFECYCLE_SNAPSHOT')
  const parsedEvent = CapabilityLifecycleEventSchema.safeParse(candidateEvent)
  if (!parsedEvent.success) return failure('INVALID_LIFECYCLE_EVENT', snapshot)
  const event = parsedEvent.data
  const digest = capabilityLifecycleEventDigest(event)
  const priorEvent = snapshot.eventHistory.find((record) => record.eventId === event.eventId)
  if (priorEvent) return priorEvent.digest === digest ? success(snapshot) : failure('EVENT_COLLISION', snapshot)
  if (event.capabilityId !== snapshot.capabilityId) return failure('CAPABILITY_MISMATCH', snapshot)
  if (event.scopeAlias !== snapshot.scopeAlias) return failure('SCOPE_MISMATCH', snapshot)
  const expectedEpoch = event.type === 'bind_card' && (snapshot.state === 'never_authorized' || snapshot.state === 'revoked')
    ? snapshot.epoch + 1
    : snapshot.epoch
  if (event.epoch !== expectedEpoch) return failure('EPOCH_MISMATCH', snapshot)

  if (event.type === 'bind_card') {
    if (snapshot.state === 'never_authorized') {
      return success(nextSnapshot(snapshot, event, {
        state: 'card_bound', epoch: 1, consentRevision: event.cardSha256, cardSha256: event.cardSha256,
      }))
    }
    if (snapshot.state === 'revoked') {
      if (snapshot.cardSha256 === event.cardSha256) return failure('REVOKED_REVISION_TERMINAL', snapshot)
      return success(nextSnapshot(snapshot, event, {
        state: 'card_bound', epoch: snapshot.epoch + 1, consentRevision: event.cardSha256, cardSha256: event.cardSha256,
        previewSha256: null, exactHeadProofSha256: null, deletionIntentId: null, deletionIntentSha256: null, deletionReceiptSha256: null,
      }))
    }
    return failure('ILLEGAL_TRANSITION', snapshot)
  }

  if (event.type === 'record_preview') {
    if (snapshot.state !== 'card_bound') return failure('ILLEGAL_TRANSITION', snapshot)
    if (!cardMatches(snapshot, event.cardSha256)) return failure('CARD_REVISION_MISMATCH', snapshot)
    return success(nextSnapshot(snapshot, event, { state: 'previewed', previewSha256: event.previewSha256 }))
  }

  if (event.type === 'activate') {
    if (snapshot.state !== 'previewed') return failure('ILLEGAL_TRANSITION', snapshot)
    if (!cardMatches(snapshot, event.cardSha256)) return failure('CARD_REVISION_MISMATCH', snapshot)
    if (snapshot.previewSha256 !== event.previewSha256) return failure('PREVIEW_MISMATCH', snapshot)
    return success(nextSnapshot(snapshot, event, { state: 'active', exactHeadProofSha256: event.exactHeadProofSha256 }))
  }

  if (event.type === 'suspend') {
    if (snapshot.state !== 'active') return failure('ILLEGAL_TRANSITION', snapshot)
    const mismatch = previewAndProofMatch(snapshot, event)
    return mismatch ? failure(mismatch, snapshot) : success(nextSnapshot(snapshot, event, { state: 'suspended' }))
  }

  if (event.type === 'resume') {
    if (snapshot.state !== 'suspended') return failure('ILLEGAL_TRANSITION', snapshot)
    const mismatch = previewAndProofMatch(snapshot, event)
    return mismatch ? failure(mismatch, snapshot) : success(nextSnapshot(snapshot, event, { state: 'active' }))
  }

  if (event.type === 'request_revocation') {
    if (snapshot.state !== 'active' && snapshot.state !== 'suspended') return failure('ILLEGAL_TRANSITION', snapshot)
    if (!cardMatches(snapshot, event.cardSha256)) return failure('CARD_REVISION_MISMATCH', snapshot)
    if (snapshot.deletionIntentId !== null || snapshot.deletionIntentSha256 !== null) return failure('ILLEGAL_TRANSITION', snapshot)
    return success(nextSnapshot(snapshot, event, {
      deletionIntentId: event.deletionIntentId,
      deletionIntentSha256: event.deletionIntentSha256,
    }))
  }

  if (snapshot.state !== 'active' && snapshot.state !== 'suspended') return failure('ILLEGAL_TRANSITION', snapshot)
  if (!cardMatches(snapshot, event.cardSha256)) return failure('CARD_REVISION_MISMATCH', snapshot)
  if (snapshot.deletionIntentId !== event.deletionIntentId || snapshot.deletionIntentSha256 !== event.deletionIntentSha256) {
    return failure('REVOCATION_RECEIPT_MISMATCH', snapshot)
  }
  return success(nextSnapshot(snapshot, event, { state: 'revoked', deletionReceiptSha256: event.receiptSha256 }))
}
