import { z } from 'zod'
import {
  C1CoverageStatusSchema,
  C1EvidenceSchema,
  C1FeatureIdSchema,
  C1UnitCodeSchema,
  type C1Evidence,
} from './c1Contract.js'

const MAX_FACTS = 128
const MAX_FILTERS = 16
const FactIdSchema = z.string().regex(/^fact_\d{3}$/)

export const C1RetrievalFactSchema = C1EvidenceSchema.extend({
  fact_id: FactIdSchema,
}).strict()

export const C1RetrievalRequestSchema = z.object({
  feature_ids: z.array(C1FeatureIdSchema).max(MAX_FILTERS).optional(),
  units: z.array(C1UnitCodeSchema).max(MAX_FILTERS).optional(),
  coverage_statuses: z.array(C1CoverageStatusSchema).max(MAX_FILTERS).optional(),
  limit: z.number().int().positive().max(MAX_FACTS),
}).strict().superRefine((request, context) => {
  for (const key of ['feature_ids', 'units', 'coverage_statuses'] as const) {
    const values = request[key]
    if (values && new Set(values).size !== values.length) {
      context.addIssue({ code: 'custom', path: [key], message: 'duplicate_filter' })
    }
  }
})

export type C1RetrievalFact = z.infer<typeof C1RetrievalFactSchema>
export type C1RetrievalRequest = z.infer<typeof C1RetrievalRequestSchema>

export class C1RetrievalValidationError extends Error {
  readonly code = 'C1_RETRIEVAL_INVALID' as const

  constructor() {
    super('C1_RETRIEVAL_INVALID')
    this.name = 'C1RetrievalValidationError'
  }
}

/**
 * Deterministic, local-only selection. Callers inject already-approved C1 facts;
 * this function performs no I/O and accepts only controlled code filters.
 */
export function retrieveLocalC1Facts(
  facts: readonly C1RetrievalFact[],
  request: C1RetrievalRequest,
): C1RetrievalFact[] {
  const parsedFacts = z.array(C1RetrievalFactSchema).max(MAX_FACTS).safeParse(facts)
  const parsedRequest = C1RetrievalRequestSchema.safeParse(request)
  if (!parsedFacts.success || !parsedRequest.success) throw new C1RetrievalValidationError()
  const factIds = parsedFacts.data.map((fact) => fact.fact_id)
  const evidenceIds = parsedFacts.data.map((fact) => fact.evidence_id)
  if (new Set(factIds).size !== factIds.length || new Set(evidenceIds).size !== evidenceIds.length) {
    throw new C1RetrievalValidationError()
  }

  const { feature_ids, units, coverage_statuses, limit } = parsedRequest.data
  const featureSet = feature_ids ? new Set(feature_ids) : undefined
  const unitSet = units ? new Set(units) : undefined
  const coverageSet = coverage_statuses ? new Set(coverage_statuses) : undefined
  return parsedFacts.data
    .filter((fact) => !featureSet || featureSet.has(fact.feature_id))
    .filter((fact) => !unitSet || unitSet.has(fact.unit))
    .filter((fact) => !coverageSet || coverageSet.has(fact.coverage.status))
    .sort((left, right) => {
      if (left.feature_id !== right.feature_id) return left.feature_id < right.feature_id ? -1 : 1
      if (left.fact_id !== right.fact_id) return left.fact_id < right.fact_id ? -1 : 1
      return 0
    })
    .slice(0, limit)
}

export const retrieveC1Facts = retrieveLocalC1Facts

// Keep the retrieval return type visibly tied to the C1 contract.
export type RetrievedC1Fact = C1Evidence & Pick<C1RetrievalFact, 'fact_id'>
