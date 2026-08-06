import { z } from 'zod'
import { ComparisonResultSchema } from './comparison.js'
import { FindingSchema } from './findings.js'
import {
  type IntegrationShapePresentation,
  type IntegrationShapeOutcomeRow,
} from './integrationShape.js'
import { MetricResultSchema } from './metrics.js'
import { WhyResolutionSchema } from './whyContract.js'

/**
 * The one browser-facing envelope for Integration Shape.
 *
 * `selected_store` is supplied by the guarded local API. `synthetic` is written by the public
 * showcase exporter. The browser never manufactures either mode, and a failed private request
 * must not silently cross the boundary into the invented public composition.
 */
export const INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION = '1.0.0' as const

const IntegrationShapeOutcomeRowSchema = z
  .object({
    key: z.enum(['full', 'matched_partial', 'incomparable']),
    label: z.string().min(1),
    comparison: ComparisonResultSchema,
  })
  .strict() satisfies z.ZodType<IntegrationShapeOutcomeRow>

/** Runtime proof for the existing Atlas presentation interface. */
export const IntegrationShapePresentationSchema = z
  .object({
    question: z.string().min(1),
    cohortStatement: z.string().min(1),
    scopeId: z.string().min(1),
    scopeAliasIsStripped: z.literal(true),
    finding: FindingSchema,
    abstentionFinding: FindingSchema,
    current: MetricResultSchema,
    baseline: MetricResultSchema,
    headline: ComparisonResultSchema,
    outcomes: z.array(IntegrationShapeOutcomeRowSchema),
    emptyCohort: z
      .object({ comparison: ComparisonResultSchema, current: MetricResultSchema })
      .strict(),
    abstention: z
      .object({ comparison: ComparisonResultSchema, current: MetricResultSchema })
      .strict(),
    sensitivity: z
      .object({
        variantId: z.literal('OPEN_TREATED_AS_CENSORED'),
        label: z.string().min(1),
        quantiles: z.array(
          z
            .object({
              quantile: z.number().gt(0).lt(1),
              current: z.number().nonnegative(),
              baseline: z.number().nonnegative(),
              delta: z.number(),
            })
            .strict(),
        ),
      })
      .strict(),
    conformsToGolden: z.boolean(),
  })
  .strict() satisfies z.ZodType<IntegrationShapePresentation>

export const IntegrationShapePresentationEnvelopeSchema = z
  .object({
    presentationContractVersion: z.literal(INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION),
    mode: z.enum(['selected_store', 'synthetic']),
    presentation: IntegrationShapePresentationSchema,
    resolutions: z.record(z.string().min(1), WhyResolutionSchema),
  })
  .strict()

export type IntegrationShapePresentationEnvelope = z.infer<
  typeof IntegrationShapePresentationEnvelopeSchema
>

export function parseIntegrationShapePresentationEnvelope(
  candidate: unknown,
): IntegrationShapePresentationEnvelope {
  return IntegrationShapePresentationEnvelopeSchema.parse(candidate)
}
