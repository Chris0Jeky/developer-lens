import { z } from 'zod'
import {
  CAPABILITY_CONTRACT_VERSION,
  CAPABILITY_IDS,
  CAPABILITY_REGISTRY,
  CapabilityIdSchema,
} from '../../../shared/capabilities.js'
import {
  COVERAGE_CONTRACT_VERSION,
  CoverageRecordSchema,
  CoverageStatusSchema,
  completeObservedUnits,
  type CoverageRecord,
} from '../../../shared/coverage.js'
import { ISO_WEEK_LABEL_PATTERN, isoWeekLabel } from '../../../shared/presentationGrain.js'
import { DataClassSchema } from '../../../shared/privacy.js'

/**
 * Response contracts for the `/api/v2` bootstrap slice (card DL-BRIDGE-01, ADR-04).
 *
 * This module is deliberately free of native dependencies so the read path, the
 * synthetic importer, the focused tests, and the browser-side cockpit can all
 * share one contract without pulling `better-sqlite3` into any bundle.
 */
export const V2_API_CONTRACT_VERSION = '1.0.0' as const

/** The explicit synthetic-mode marker required by the ADR-04 provenance rule. */
export const SYNTHETIC_STORE_MARKER = 'developer-lens.synthetic-importer.v1' as const

export const V2_STORE_PROVENANCE_MODES = ['synthetic', 'activation_card'] as const
export const V2StoreProvenanceModeSchema = z.enum(V2_STORE_PROVENANCE_MODES)
export type V2StoreProvenanceMode = z.infer<typeof V2StoreProvenanceModeSchema>

const OpaqueIdentifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
const UtcTimestampSchema = z.string().datetime({ offset: true })
const SemanticVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/)
const UpperSnakeCodeSchema = z.string().regex(/^[A-Z0-9_]+$/)

/**
 * Recorded provenance of the served store. A store is servable only when it was
 * produced by the synthetic importer; `activation_card` provenance is modelled so
 * a store can record it, but this slice refuses to serve it (no reviewed
 * activation card exists while every capability is `never_authorized`).
 */
export const V2StoreProvenanceSchema = z
  .object({
    mode: V2StoreProvenanceModeSchema,
    syntheticMarker: z.literal(SYNTHETIC_STORE_MARKER).nullable(),
    activationCardId: OpaqueIdentifierSchema.nullable(),
    importerVersion: SemanticVersionSchema,
    createdAt: UtcTimestampSchema,
  })
  .strict()
  .superRefine((provenance, context) => {
    if (provenance.mode === 'synthetic') {
      if (provenance.syntheticMarker !== SYNTHETIC_STORE_MARKER) {
        context.addIssue({ code: 'custom', message: 'Synthetic provenance requires the synthetic marker', path: ['syntheticMarker'] })
      }
      if (provenance.activationCardId !== null) {
        context.addIssue({ code: 'custom', message: 'Synthetic provenance cannot carry an activation card', path: ['activationCardId'] })
      }
      return
    }
    if (provenance.activationCardId === null) {
      context.addIssue({ code: 'custom', message: 'Activation-card provenance requires a bound card', path: ['activationCardId'] })
    }
    if (provenance.syntheticMarker !== null) {
      context.addIssue({ code: 'custom', message: 'Activation-card provenance cannot carry the synthetic marker', path: ['syntheticMarker'] })
    }
  })

export type V2StoreProvenance = z.infer<typeof V2StoreProvenanceSchema>

/**
 * Read-only projection of one `shared/capabilities.ts` registry entry. The
 * literal `never_authorized` fields make it structurally impossible for this
 * endpoint to report — or perform — an activation.
 */
export const V2CapabilityViewSchema = z
  .object({
    id: CapabilityIdSchema,
    authorization: z.literal('never_authorized'),
    lifecycleState: z.literal('never_authorized'),
    purposeCode: UpperSnakeCodeSchema,
    classCeiling: DataClassSchema,
    requiredGates: z.array(z.enum(['G2', 'G3', 'G4'])),
    phase: z.string().regex(/^P\d+(?:\/P\d+)?$/),
    retentionCode: UpperSnakeCodeSchema,
    deletionCode: UpperSnakeCodeSchema,
    refusalStatus: z.enum(['never_authorized', 'refused', 'unavailable', 'restricted']),
  })
  .strict()

export type V2CapabilityView = z.infer<typeof V2CapabilityViewSchema>

export const V2CapabilitiesResponseSchema = z
  .object({
    apiContractVersion: z.literal(V2_API_CONTRACT_VERSION),
    capabilityContractVersion: z.literal(CAPABILITY_CONTRACT_VERSION),
    activation: z.literal('reporting_only'),
    provenance: V2StoreProvenanceSchema,
    capabilities: z.array(V2CapabilityViewSchema).length(CAPABILITY_IDS.length),
  })
  .strict()

export type V2CapabilitiesResponse = z.infer<typeof V2CapabilitiesResponseSchema>

/**
 * The canonical coverage record as READ FROM THE STORE. It is server-side only and is never
 * served: the charter's frontend sink accepts a `PresentationView` and denies canonical records.
 *
 * `CoverageRecordSchema` accepts any non-empty string for `coverageId` and `scopeAlias`; at this
 * boundary both must also be opaque identifiers, so prose, a path, or a person-shaped label
 * cannot even reach the projection step. The authority for that property is this boundary, not
 * the storage CHECK constraint.
 */
export const V2CoverageRecordSchema = CoverageRecordSchema.superRefine((record, context) => {
  for (const field of ['coverageId', 'scopeAlias'] as const) {
    if (!OpaqueIdentifierSchema.safeParse(record[field]).success) {
      context.addIssue({
        code: 'custom',
        message: `${field} must be an opaque identifier at the V2 boundary`,
        path: [field],
      })
    }
  }
})

const IsoWeekLabelSchema = z.string().regex(ISO_WEEK_LABEL_PATTERN)

/**
 * The coverage `PresentationView` (#79, DL-BRIDGE-02).
 *
 * What it drops is the point. The canonical record's `coverageId` is a storage identifier,
 * `scopeAlias` is a C2 installation-scoped value, and `rangeStart`/`rangeEnd`/`observedAt` are
 * exact-millisecond operational timestamps — none of which the charter's frontend sink admits.
 * The projection therefore carries:
 *
 * - the coverage state and the codes that explain it, which is the whole product claim;
 * - ISO-week window LABELS computed server-side, so the grain floor is enforced at the
 *   projection rather than trusted to a renderer that was handed exact instants;
 * - `observedUnits` under the complete-only rule (`completeObservedUnits`): a missing, refused,
 *   or restricted state is `null`, never a numeric zero;
 * - `rowKey`, an ordinal that is stable only WITHIN one response. It exists so React can key a
 *   list without a storage identifier, and it is deliberately not addressable: it names nothing
 *   outside the response that produced it.
 */
export const CoveragePresentationViewSchema = z
  .object({
    rowKey: z.string().regex(/^coverage-row-\d+$/),
    capabilityId: CapabilityIdSchema,
    status: CoverageStatusSchema,
    limitationCode: UpperSnakeCodeSchema,
    saturationReason: UpperSnakeCodeSchema.nullable(),
    retryable: z.boolean(),
    expectedUnits: z.number().int().nonnegative().nullable(),
    /** Complete-only; `null` for every other state so absence never reads as zero. */
    observedUnits: z.number().int().nonnegative().nullable(),
    omittedUnits: z.number().int().nonnegative().nullable(),
    windowStartLabel: IsoWeekLabelSchema,
    windowEndLabel: IsoWeekLabelSchema,
    observedAtLabel: IsoWeekLabelSchema,
  })
  .strict()
  .superRefine((view, context) => {
    if (view.status !== 'complete' && view.observedUnits !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Only complete coverage may present an observed-unit count',
        path: ['observedUnits'],
      })
    }
    if (view.status === 'truncated' && view.saturationReason === null) {
      context.addIssue({
        code: 'custom',
        message: 'Truncated coverage requires a saturation reason',
        path: ['saturationReason'],
      })
    }
    if (view.status !== 'truncated' && view.saturationReason !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Only truncated coverage may have a saturation reason',
        path: ['saturationReason'],
      })
    }
  })

export type CoveragePresentationView = z.infer<typeof CoveragePresentationViewSchema>

/**
 * Projects validated canonical records into the served view. The ordinal is assigned here, from
 * the response's own ordering, so no storage identifier is needed to key a row.
 */
export function buildCoveragePresentationViews(
  records: readonly CoverageRecord[],
): CoveragePresentationView[] {
  return records.map((record, index) =>
    CoveragePresentationViewSchema.parse({
      rowKey: `coverage-row-${index + 1}`,
      capabilityId: record.capabilityId,
      status: record.status,
      limitationCode: record.limitationCode,
      saturationReason: record.saturationReason ?? null,
      retryable: record.retryable,
      expectedUnits: record.expectedUnits,
      observedUnits: completeObservedUnits(record),
      omittedUnits: record.omittedUnits,
      windowStartLabel: isoWeekLabel(record.rangeStart),
      windowEndLabel: isoWeekLabel(record.rangeEnd),
      observedAtLabel: isoWeekLabel(record.observedAt),
    }),
  )
}

export const V2CoverageResponseSchema = z
  .object({
    apiContractVersion: z.literal(V2_API_CONTRACT_VERSION),
    coverageContractVersion: z.literal(COVERAGE_CONTRACT_VERSION),
    provenance: V2StoreProvenanceSchema,
    records: z.array(CoveragePresentationViewSchema),
  })
  .strict()

export type V2CoverageResponse = z.infer<typeof V2CoverageResponseSchema>

/**
 * Reports the registry as data. There is deliberately no transition, credential,
 * or collection operation reachable from this function.
 */
export function buildCapabilityViews(): V2CapabilityView[] {
  return CAPABILITY_REGISTRY.map((definition) =>
    V2CapabilityViewSchema.parse({
      id: definition.id,
      authorization: definition.authorization,
      lifecycleState: definition.authorization,
      purposeCode: definition.purposeCode,
      classCeiling: definition.classCeiling,
      requiredGates: [...definition.requiredGates],
      phase: definition.phase,
      retentionCode: definition.retentionCode,
      deletionCode: definition.deletionCode,
      refusalStatus: definition.refusalStatus,
    }),
  )
}
