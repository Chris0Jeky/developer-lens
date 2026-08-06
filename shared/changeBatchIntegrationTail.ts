import { z } from 'zod'

/**
 * Phase E's second lens.  This contract deliberately contains aggregates only: change values,
 * cohort counts, and integration-tail quantiles.  Fact identifiers, aliases, paths, and source
 * prose never cross this boundary.
 */
export const CHANGE_BATCH_INTEGRATION_TAIL_PRESENTATION_VERSION = '1.0.0' as const

export const CHANGE_BATCH_STRATA = ['lower', 'middle', 'upper'] as const
export const ChangeBatchStratumSchema = z.enum(CHANGE_BATCH_STRATA)
export type ChangeBatchStratum = z.infer<typeof ChangeBatchStratumSchema>

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
export type ChangeBatchWindowSummary = z.infer<typeof ChangeBatchWindowSummarySchema>

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
    scopeId: z.string().min(1),
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
  const ordered = [...groups].sort((left, right) => left.value - right.value)
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
