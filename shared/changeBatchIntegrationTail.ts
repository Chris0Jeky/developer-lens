import { z } from 'zod'

/**
 * Phase E's second lens.  This contract deliberately contains aggregates only: change values,
 * cohort counts, and integration-tail quantiles.  Fact identifiers, aliases, paths, and source
 * prose never cross this boundary.
 */
export const CHANGE_BATCH_INTEGRATION_TAIL_PRESENTATION_VERSION = '1.0.0' as const

export const CHANGE_BATCH_INTEGRATION_TAIL_ABSTENTION_CODES = [
  'REQUIRED_TABLE_MISSING',
  'COVERAGE_NOT_COMPLETE',
  'COVERAGE_AMBIGUOUS',
  'COVERAGE_BINDING_MISMATCH',
  'READY_COLUMNS_MISSING',
  'READY_FACT_MISSING',
  'INVALID_LIFECYCLE_TIMESTAMP',
  'RETENTION_EXPIRED',
  'SOURCE_NOT_AUTHORIZED',
  'ALL_CENSORED',
  'SUPPORT_BELOW_MINIMUM',
] as const
export const ChangeBatchIntegrationTailAbstentionCodeSchema = z.enum(
  CHANGE_BATCH_INTEGRATION_TAIL_ABSTENTION_CODES,
)
export type ChangeBatchIntegrationTailAbstentionCode = z.infer<
  typeof ChangeBatchIntegrationTailAbstentionCodeSchema
>

export const CHANGE_BATCH_STRATA = ['lower', 'middle', 'upper'] as const
export const ChangeBatchStratumSchema = z.enum(CHANGE_BATCH_STRATA)
export type ChangeBatchStratum = z.infer<typeof ChangeBatchStratumSchema>
export const ChangeBatchScopeIdSchema = z.string().regex(/^scope-[0-9a-f]{64}$/)

const WeekLabelSchema = z.string().regex(/^\d{4}-W\d{2}$/)
const CountSchema = z.number().int().nonnegative()
const NonnegativeNumberSchema = z.number().nonnegative()

export const IntegrationTailQuantileSchema = z
  .object({ quantile: z.number().gt(0).lt(1), value: NonnegativeNumberSchema })
  .strict()
export type IntegrationTailQuantile = z.infer<typeof IntegrationTailQuantileSchema>

export const IntegrationTailSummarySchema = z
  .object({
    sampleSize: CountSchema,
    quantiles: z.array(IntegrationTailQuantileSchema).nullable(),
  })
  .strict()
  .superRefine((summary, context) => {
    if ((summary.sampleSize === 0) !== (summary.quantiles === null)) {
      context.addIssue({ code: 'custom', message: 'An empty integration tail has no quantiles', path: ['quantiles'] })
    }
    if (summary.quantiles !== null) {
      const quantiles = summary.quantiles.map((entry) => entry.quantile)
      if (
        quantiles.length !== 3
        || !([0.5, 0.75, 0.9] as const).every((quantile) => quantiles.filter((value) => value === quantile).length === 1)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'A rendered integration tail carries exactly p50, p75, and p90 once each',
          path: ['quantiles'],
        })
      }
    }
  })
export type IntegrationTailSummary = z.infer<typeof IntegrationTailSummarySchema>

/** One value-third projection. Ties are retained as a unit when assigning thirds. */
export const ChangeBatchStratumSummarySchema = z
  .object({
    stratum: ChangeBatchStratumSchema,
    minChange: NonnegativeNumberSchema.nullable(),
    maxChange: NonnegativeNumberSchema.nullable(),
    n: CountSchema,
    excluded: CountSchema,
    censored: CountSchema,
    competing: CountSchema,
    missingSizeExcluded: CountSchema,
    tiesKeptTogether: z.literal(true),
    integrationTail: IntegrationTailSummarySchema,
  })
  .strict()
export type ChangeBatchStratumSummary = z.infer<typeof ChangeBatchStratumSummarySchema>

export const ChangeBatchWindowSummarySchema = z
  .object({
    weekLabels: z.object({ start: WeekLabelSchema, end: WeekLabelSchema }).strict(),
    eligible: CountSchema,
    excluded: CountSchema,
    censored: CountSchema,
    competing: CountSchema,
    missingSizeExcluded: CountSchema,
    strata: z.array(ChangeBatchStratumSummarySchema),
  })
  .strict()
  .superRefine((summary, context) => {
    const order = summary.strata.map((entry) => entry.stratum)
    if (
      order.length !== CHANGE_BATCH_STRATA.length
      || !CHANGE_BATCH_STRATA.every((stratum, index) => order[index] === stratum)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A change-batch window carries exactly the lower, middle, and upper strata in order',
        path: ['strata'],
      })
    }
  })
export type ChangeBatchWindowSummary = z.infer<typeof ChangeBatchWindowSummarySchema>

export const StoredDeletionLineageEventSchema = z
  .object({
    subjectKind: z.enum(['scope', 'claim', 'job', 'snapshot', 'checkpoint', 'coverage', 'evidence', 'artifact', 'deletion']),
    eventKind: z.enum(['tombstone_cascade', 'index_deleted', 'legacy_deletion_operation']),
    week: WeekLabelSchema,
    count: CountSchema.min(1),
  })
  .strict()
export type StoredDeletionLineageEvent = z.infer<typeof StoredDeletionLineageEventSchema>

/** Content-free scope lineage: closed kinds, ISO-week grain, and aggregate counts only. */
export const StoredDeletionLineageSummarySchema = z
  .object({
    status: z.enum(['none_recorded', 'present', 'unavailable']),
    eventCount: CountSchema,
    events: z.array(StoredDeletionLineageEventSchema),
  })
  .strict()
  .superRefine((summary, context) => {
    const total = summary.events.reduce((sum, event) => sum + event.count, 0)
    if (total !== summary.eventCount) {
      context.addIssue({ code: 'custom', message: 'Deletion-lineage eventCount must equal its aggregate rows', path: ['eventCount'] })
    }
    if ((summary.status === 'present') !== (summary.eventCount > 0)) {
      context.addIssue({ code: 'custom', message: 'Only present deletion lineage carries retained events', path: ['status'] })
    }
  })
export type StoredDeletionLineageSummary = z.infer<typeof StoredDeletionLineageSummarySchema>

/**
 * Presentation-safe stored-observation envelope.  User-facing windows are ISO-week grain and
 * storage identifiers, exact operational timestamps, aliases, and filesystem paths are absent.
 */
export const IntegrationShapeProvenanceSchema = z
  .object({
    facts: z.object({
      table: z.literal('pull_request_fact'),
      rowCount: CountSchema,
      jobProvenance: z.literal('unavailable_current_schema'),
    }).strict(),
    coverage: z.object({
      status: z.literal('complete'),
      expectedUnits: CountSchema,
      observedUnits: CountSchema,
      omittedUnits: z.literal(0),
    }).strict(),
    job: z.object({
      status: z.literal('complete'),
      capabilityId: z.literal('github.core'),
      consentRevision: z.string().min(1),
    }).strict(),
    snapshot: z.object({
      status: z.literal('closed'),
    }).strict(),
  })
  .strict()
export type IntegrationShapeProvenance = z.infer<typeof IntegrationShapeProvenanceSchema>

/**
 * Domain-only envelope for the change-batch/integration-tail lens.  The dashboard may wrap this
 * in its own `presentation` object, but this parser is the strict server/shared boundary.
 */
export const ChangeBatchIntegrationTailPresentationSchema = z
  .object({
    presentationContractVersion: z.literal(CHANGE_BATCH_INTEGRATION_TAIL_PRESENTATION_VERSION),
    mode: z.enum(['selected_store', 'synthetic']),
    scopeId: ChangeBatchScopeIdSchema,
    capabilityId: z.literal('github.core'),
    consentRevision: z.string().min(1),
    current: ChangeBatchWindowSummarySchema,
    baseline: ChangeBatchWindowSummarySchema,
    sensitivity: z.object({
      primary: z.literal('additions_plus_deletions'),
      variant: z.literal('changed_files'),
      current: ChangeBatchWindowSummarySchema,
      baseline: ChangeBatchWindowSummarySchema,
    }).strict(),
    deletionLineage: StoredDeletionLineageSummarySchema,
    provenance: z.object({ current: IntegrationShapeProvenanceSchema, baseline: IntegrationShapeProvenanceSchema }).strict(),
    factProvenanceLimitation: z.literal('pull_request_fact_has_no_job_provenance'),
  })
  .strict()

export type ChangeBatchIntegrationTailPresentation = z.infer<typeof ChangeBatchIntegrationTailPresentationSchema>

export function parseChangeBatchIntegrationTailPresentation(candidate: unknown): ChangeBatchIntegrationTailPresentation {
  return ChangeBatchIntegrationTailPresentationSchema.parse(candidate)
}

/**
 * Partition already-sized cohort rows into value thirds.  A distinct change value is assigned to
 * one stratum as a whole, so equal values never straddle a boundary.  The input is aggregate-safe
 * and intentionally carries no row identifiers.
 */
export interface ChangeBatchValueGroup<T> {
  readonly value: number
  readonly rows: readonly T[]
}

export function partitionChangeBatchValueThirds<T>(groups: readonly ChangeBatchValueGroup<T>[]): Readonly<Record<ChangeBatchStratum, readonly T[]>> {
  const coalesced = new Map<number, T[]>()
  for (const group of groups) {
    coalesced.set(group.value, [...(coalesced.get(group.value) ?? []), ...group.rows])
  }
  const ordered = [...coalesced.entries()]
    .map(([value, rows]) => ({ value, rows }))
    .sort((left, right) => left.value - right.value)
  const total = ordered.reduce((sum, group) => sum + group.rows.length, 0)
  const targets = [total / 3, (2 * total) / 3]
  const output: Record<ChangeBatchStratum, T[]> = { lower: [], middle: [], upper: [] }
  let stratumIndex = 0
  let assigned = 0
  for (const group of ordered) {
    if (stratumIndex < 2) {
      const next = assigned + group.rows.length
      const distanceHere = Math.abs(next - targets[stratumIndex])
      const distanceNext = Math.abs(assigned - targets[stratumIndex])
      if (assigned > 0 && distanceNext < distanceHere) stratumIndex += 1
    }
    output[CHANGE_BATCH_STRATA[stratumIndex]].push(...group.rows)
    assigned += group.rows.length
  }
  return output
}
