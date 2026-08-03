import { z } from 'zod'
import { CapabilityIdSchema } from './capabilities.js'
import { CoverageStatusSchema } from './coverage.js'
import {
  DataClassSchema,
  PayloadFamilySchema,
  type FieldClasses,
  type PayloadFamily,
  type RegisteredPayload,
} from './privacy.js'

export const PROVENANCE_CONTRACT_VERSION = '1.0.0' as const
export const CANONICAL_ENVELOPE_SCHEMA_VERSION = '2.0.0' as const

export const EVIDENCE_LAYERS = ['observed', 'deterministic', 'modelled', 'hypothesis'] as const
export const EvidenceLayerSchema = z.enum(EVIDENCE_LAYERS)
export type EvidenceLayer = z.infer<typeof EvidenceLayerSchema>

const UtcTimestampSchema = z.string().datetime({ offset: true })
const OpaqueIdentifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const EvidenceTimesSchema = z
  .object({
    occurredAt: UtcTimestampSchema.optional(),
    authorAt: UtcTimestampSchema.optional(),
    committerAt: UtcTimestampSchema.optional(),
    observedAt: UtcTimestampSchema,
    collectedAt: UtcTimestampSchema,
  })
  .strict()
  .superRefine((times, context) => {
    const observedAt = Date.parse(times.observedAt)
    const collectedAt = Date.parse(times.collectedAt)
    if (observedAt > collectedAt) {
      context.addIssue({ code: 'custom', message: 'observedAt cannot be after collectedAt', path: ['collectedAt'] })
    }
    for (const key of ['occurredAt', 'authorAt', 'committerAt'] as const) {
      if (times[key] && Date.parse(times[key]) > observedAt) {
        context.addIssue({ code: 'custom', message: `${key} cannot be after observedAt`, path: [key] })
      }
    }
  })

export const SourceProvenanceSchema = z
  .object({
    sourceKind: z.enum(['github_rest', 'github_graphql', 'local_git', 'local_source']),
    sourceHostId: OpaqueIdentifierSchema,
    sourceSnapshotId: OpaqueIdentifierSchema,
    queryTemplateId: OpaqueIdentifierSchema,
    queryFingerprint: Sha256Schema,
    connectorVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/),
    sourceApiVersion: z.string().regex(/^[A-Za-z0-9._-]+$/).optional(),
    gitVersion: z.string().regex(/^\d+(?:\.\d+){1,3}$/).optional(),
  })
  .strict()
  .superRefine((provenance, context) => {
    const isGitHub = provenance.sourceKind === 'github_rest' || provenance.sourceKind === 'github_graphql'
    if (isGitHub && !provenance.sourceApiVersion) {
      context.addIssue({ code: 'custom', message: 'GitHub provenance requires sourceApiVersion', path: ['sourceApiVersion'] })
    }
    if (isGitHub && provenance.gitVersion) {
      context.addIssue({ code: 'custom', message: 'GitHub provenance cannot carry gitVersion', path: ['gitVersion'] })
    }
    if (provenance.sourceKind === 'local_git' && !provenance.gitVersion) {
      context.addIssue({ code: 'custom', message: 'Local Git provenance requires gitVersion', path: ['gitVersion'] })
    }
    if (!isGitHub && provenance.sourceApiVersion) {
      context.addIssue({ code: 'custom', message: 'Local provenance cannot carry sourceApiVersion', path: ['sourceApiVersion'] })
    }
  })

export type EvidenceTimes = z.infer<typeof EvidenceTimesSchema>
export type SourceProvenance = z.infer<typeof SourceProvenanceSchema>

const envelopeBaseShape = {
  evidenceId: OpaqueIdentifierSchema,
  schemaVersion: z.literal(CANONICAL_ENVELOPE_SCHEMA_VERSION),
  layer: EvidenceLayerSchema,
  restrictedSourceKey: OpaqueIdentifierSchema,
  analyticalKey: OpaqueIdentifierSchema,
  repositoryId: OpaqueIdentifierSchema.optional(),
  times: EvidenceTimesSchema,
  provenance: SourceProvenanceSchema,
  capabilityId: CapabilityIdSchema,
  consentRevision: OpaqueIdentifierSchema,
  coverageId: OpaqueIdentifierSchema,
  redactionRevision: OpaqueIdentifierSchema,
  sourceRevision: OpaqueIdentifierSchema.optional(),
  supersedesEvidenceId: OpaqueIdentifierSchema.optional(),
  tombstone: z
    .object({ reasonCode: z.string().regex(/^[A-Z0-9_]+$/), observedAt: UtcTimestampSchema })
    .strict()
    .optional(),
}

export function canonicalEnvelopeSchema<T extends z.ZodRawShape>(
  registered: RegisteredPayload<T>,
) {
  const payloadKeys = Object.keys(registered.schema.shape)
  const fieldClasses = z.record(z.string(), DataClassSchema).superRefine((classes, context) => {
    const classKeys = Object.keys(classes)
    if (payloadKeys.length !== classKeys.length || payloadKeys.some((key) => !Object.hasOwn(classes, key))) {
      context.addIssue({ code: 'custom', message: 'fieldClasses must exactly match payload keys' })
    }
  })

  return z
    .object({
      ...envelopeBaseShape,
      payloadFamily: PayloadFamilySchema.refine((family) => family === registered.family),
      payload: registered.schema,
      fieldClasses,
    })
    .strict()
    .superRefine((envelope, context) => {
      for (const [field, dataClass] of Object.entries(registered.fieldClasses as FieldClasses<T>)) {
        if (envelope.fieldClasses[field] !== dataClass) {
          context.addIssue({ code: 'custom', message: `fieldClasses.${field} must use the registered class`, path: ['fieldClasses', field] })
        }
      }
    })
}

export interface CanonicalEnvelope<T extends z.ZodRawShape> {
  readonly payloadFamily: PayloadFamily
  readonly payload: z.output<z.ZodObject<T>>
  readonly fieldClasses: FieldClasses<T>
  readonly schemaVersion: typeof CANONICAL_ENVELOPE_SCHEMA_VERSION
}

export function buildCanonicalEnvelope<T extends z.ZodRawShape>(
  registered: RegisteredPayload<T>,
  envelope: unknown,
) {
  return canonicalEnvelopeSchema(registered).parse(envelope)
}

export { CoverageStatusSchema }
