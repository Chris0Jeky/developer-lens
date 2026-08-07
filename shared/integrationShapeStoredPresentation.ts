import { z } from 'zod'
import { ComparisonResultSchema } from './comparison.js'
import { FindingSchema } from './findings.js'
import {
  type IntegrationShapePresentation,
  type IntegrationShapeOutcomeRow,
} from './integrationShape.js'
import { MetricResultSchema } from './metrics.js'
import { WhyResolutionSchema } from './whyContract.js'
import { whyResolutionAnswersReference } from './whyContract.js'
import {
  ChangeBatchIntegrationTailAbstentionCodeSchema,
  ChangeBatchIntegrationTailPresentationSchema,
  StoredDeletionLineageSummarySchema,
} from './changeBatchIntegrationTail.js'
import { analyticReferenceId } from './findings.js'

/**
 * The one browser-facing envelope for Integration Shape.
 *
 * `selected_store` is supplied by the guarded local API. `synthetic` is written by the public
 * showcase exporter. The browser never manufactures either mode, and a failed private request
 * must not silently cross the boundary into the invented public composition.
 */
export const INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION = '2.0.0' as const

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

const StoredObservationCompleteSchema = z
  .object({
    status: z.literal('complete'),
    presentation: ChangeBatchIntegrationTailPresentationSchema,
    finding: FindingSchema,
  })
  .strict()

const StoredObservationAbstainedSchema = z
  .object({
    status: z.literal('abstained'),
    code: ChangeBatchIntegrationTailAbstentionCodeSchema,
    finding: FindingSchema,
    deletionLineage: StoredDeletionLineageSummarySchema,
  })
  .strict()

const ResolutionMapSchema = z.record(z.string().min(1), WhyResolutionSchema)

const SyntheticPresentationEnvelopeSchema = z
  .object({
    presentationContractVersion: z.literal(INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION),
    mode: z.literal('synthetic'),
    presentation: IntegrationShapePresentationSchema,
    storedObservation: StoredObservationCompleteSchema,
    resolutions: ResolutionMapSchema,
  })
  .strict()

const SelectedStorePresentationEnvelopeSchema = z
  .object({
    presentationContractVersion: z.literal(INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION),
    mode: z.literal('selected_store'),
    presentation: z.null(),
    storedObservation: z.discriminatedUnion('status', [
      StoredObservationCompleteSchema,
      StoredObservationAbstainedSchema,
    ]),
    resolutions: ResolutionMapSchema,
  })
  .strict()

function findingReferences(finding: z.infer<typeof FindingSchema>) {
  return [
    ...finding.marks.map((mark) => mark.reference),
    ...finding.evidence,
    ...finding.counterEvidence,
  ]
}

export const IntegrationShapePresentationEnvelopeSchema = z
  .discriminatedUnion('mode', [
    SyntheticPresentationEnvelopeSchema,
    SelectedStorePresentationEnvelopeSchema,
  ])
  .superRefine((envelope, context) => {
    if (envelope.storedObservation.status === 'complete') {
      if (envelope.storedObservation.presentation.mode !== envelope.mode) {
        context.addIssue({
          code: 'custom',
          message: 'stored observation mode must match its presentation envelope',
          path: ['storedObservation', 'presentation', 'mode'],
        })
      }
    }
    const findings = [
      ...(envelope.presentation === null ? [] : [envelope.presentation.finding]),
      envelope.storedObservation.finding,
    ]
    for (const reference of findings.flatMap(findingReferences)) {
      const id = analyticReferenceId(reference)
      const resolution = envelope.resolutions[id]
      if (resolution === undefined || !whyResolutionAnswersReference(reference, resolution)) {
        context.addIssue({
          code: 'custom',
          message: `presentation reference ${id} is not answered by its bundled resolution`,
          path: ['resolutions', id],
        })
      }
    }
  })

export type IntegrationShapePresentationEnvelope = z.infer<
  typeof IntegrationShapePresentationEnvelopeSchema
>

export function parseIntegrationShapePresentationEnvelope(
  candidate: unknown,
): IntegrationShapePresentationEnvelope {
  return IntegrationShapePresentationEnvelopeSchema.parse(candidate)
}
