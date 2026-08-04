import {
  MetricResultSchema,
  formatMetricReference,
  getMetricDefinition,
  type MetricCoverageDimension,
  type MetricResult,
} from './metrics.js'

/**
 * DL-VALIDATE-01 — the analytical conformance instrument.
 *
 * The merged contracts (`shared/metrics.ts` et al.) close the DECLARATION of a metric: its schema
 * proves a definition is well-formed, and `validateMetricResult` proves a RESULT is structurally
 * consistent with the definition it pins. Neither can prove that the CODE behind an opaque
 * `procedureId` computes the construct the definition claims — metrics.ts says so in as many words
 * ("Binding a procedure to its declared formula is DL-VALIDATE-01's conformance job").
 *
 * This module is that binding. It holds deterministic REFERENCE PROCEDURES computed straight from
 * invented raw lifecycle facts, and a construct SIGNATURE used to compare a procedure's output to a
 * hand-verified golden. A procedure that is deterministic, private, and reproducible — yet measures
 * the WRONG CONSTRUCT — produces a structurally valid result that passes every schema and registry
 * check and still fails the golden. That gap is the whole point of the card.
 *
 * Everything here is fabricated. No fixture is derived from real, private, or generated data, and
 * no field names a person. There is no I/O, no network, and no clock read: every instant is a
 * caller-supplied ISO-8601 string parsed with `Date.parse`.
 */

export const CONFORMANCE_CONTRACT_VERSION = '1.0.0' as const

const INTEGRATION_INTERVAL_REFERENCE = 'pull_request.integration_interval@1.1.0' as const
const INTEGRATION_INTERVAL_PROCEDURE = 'pull_request.interval_quantiles_v2' as const
const DECLARED_QUANTILES = [0.5, 0.75, 0.9] as const

/**
 * An invented pull-request lifecycle fact. Every field is an aggregate-safe C1 timestamp or opaque
 * token; there is deliberately no author, login, or any other person field.
 */
export interface PullRequestLifecycle {
  /** A content-free surrogate for the pull request; never a person. */
  readonly opaqueId: string
  /** When the pull request was opened. Absent only for the missingness exemplar. */
  readonly createdAt: string | null
  /** When it left draft, or null when it was never a draft (becameReadyAt collapses to createdAt). */
  readonly readyForReviewAt: string | null
  /** The merge instant, or null when it never merged. */
  readonly mergedAt: string | null
  /** The close-without-merge instant — a competing terminal outcome (issue #82) — or null. */
  readonly closedAt: string | null
}

export interface IntervalWindowSpec {
  readonly windowStart: string
  readonly windowEnd: string
  readonly asOf: string
  readonly scopeAlias: string
  readonly resultId: string
}

/**
 * The two cohort-entry CONSTRUCTS.
 *
 * `becameReady` is the registered v1.1.0 construct: the cohort enters, and the interval starts,
 * when the pull request became ready for review. `created` is the SUPERSEDED v1.0.0 construct: the
 * cohort enters, and the interval starts, at creation. The registry's own
 * `COHORT_START_EVENT_CORRECTED` supersession is exactly this difference — so a procedure that
 * computes `created` while bound to the v1.1.0 definition is the planted wrong-construct metric.
 */
export type CohortEntryConstruct = 'becameReady' | 'created'

function epochMs(instant: string): number {
  const parsed = Date.parse(instant)
  if (Number.isNaN(parsed)) {
    throw new Error(`Conformance fixture instant "${instant}" is not a parseable ISO-8601 timestamp`)
  }
  return parsed
}

/** Half-open membership: `start <= instant < end`. */
function inWindow(instant: string, windowStart: string, windowEnd: string): boolean {
  const at = epochMs(instant)
  return at >= epochMs(windowStart) && at < epochMs(windowEnd)
}

/**
 * The reference quantile method: nearest-rank on the ascending sample. For quantile `q` over `n`
 * observations the rank is `ceil(q * n)`, clamped to `[1, n]`, and the value is the sample at that
 * 1-indexed rank. It is total and order-independent, and it is monotone in `q`, so the result is
 * always a non-decreasing distribution — exactly what `MetricResultSchema` requires.
 */
export function nearestRankQuantile(sortedAscending: readonly number[], quantile: number): number {
  if (sortedAscending.length === 0) {
    throw new Error('nearestRankQuantile requires a non-empty sample')
  }
  const rank = Math.ceil(quantile * sortedAscending.length)
  const index = Math.min(Math.max(rank, 1), sortedAscending.length) - 1
  return sortedAscending[index]
}

function cohortEntry(lifecycle: PullRequestLifecycle, construct: CohortEntryConstruct): string | null {
  if (construct === 'created') {
    return lifecycle.createdAt
  }
  // becameReady: readyForReviewAt when the pull request left draft, otherwise createdAt.
  return lifecycle.readyForReviewAt ?? lifecycle.createdAt
}

/** The full metric-specific coverage vector for the interval metric, complete on every dimension. */
function completeIntervalCoverage(): Array<{ dimension: MetricCoverageDimension; value: number; limiting_reason: null }> {
  const declared = getMetricDefinition(INTEGRATION_INTERVAL_REFERENCE).coverageDimensions
  return declared.map((dimension) => ({ dimension, value: 1, limiting_reason: null }))
}

/**
 * The reference procedure for `pull_request.integration_interval@1.1.0`, parametrised only by which
 * cohort-entry CONSTRUCT it measures. `becameReady` is the correct procedure; `created` is the
 * planted wrong-construct procedure. Everything else — the risk-set membership by entry, the
 * right-censoring at the window end, the competing-outcome exclusion of a close-without-merge, and
 * the nearest-rank quantiles — is identical between the two, which is what makes the counterexample
 * "right code, wrong cohort" rather than merely a different implementation.
 *
 * The returned result is parsed by `MetricResultSchema`, so the procedure can never emit a
 * schema-invalid row; a caller then applies the registry-level `validateMetricResult` to it.
 */
export function computeIntegrationIntervalResult(
  lifecycles: readonly PullRequestLifecycle[],
  spec: IntervalWindowSpec,
  construct: CohortEntryConstruct,
): MetricResult {
  const windowEndMs = epochMs(spec.windowEnd)

  let eligible = 0
  let censored = 0
  const durations: number[] = []
  const excludedCounts = new Map<string, number>()
  const addExcluded = (reasonCode: string): void => {
    excludedCounts.set(reasonCode, (excludedCounts.get(reasonCode) ?? 0) + 1)
  }

  for (const lifecycle of lifecycles) {
    const entry = cohortEntry(lifecycle, construct)
    if (entry === null) {
      // No derivable cohort entry point: excluded, never imputed and never counted as a zero.
      addExcluded('MISSING_CREATION_TIMESTAMP')
      continue
    }
    if (!inWindow(entry, spec.windowStart, spec.windowEnd)) {
      addExcluded('BECAME_READY_OUTSIDE_WINDOW')
      continue
    }
    eligible += 1
    const entryMs = epochMs(entry)
    const mergedBeforeEnd = lifecycle.mergedAt !== null && epochMs(lifecycle.mergedAt) < windowEndMs
    const closedBeforeEnd = lifecycle.closedAt !== null && epochMs(lifecycle.closedAt) < windowEndMs
    if (mergedBeforeEnd) {
      // The interval metric's unit is `seconds`; epoch differences are milliseconds.
      durations.push((epochMs(lifecycle.mergedAt as string) - entryMs) / 1000)
    } else if (closedBeforeEnd) {
      // Competing terminal outcome (issue #82): eligible, excluded from the merged-duration sample,
      // and NOT right-censored — so sampleSize falls below eligible - censored.
      continue
    } else {
      // Still running at the window end (or resolved only after it): right-censored at the boundary.
      censored += 1
    }
  }

  const excluded = [...excludedCounts.entries()].map(([reasonCode, count]) => ({ reasonCode, count }))
  const sorted = [...durations].sort((left, right) => left - right)
  const sampleSize = sorted.length

  const base = {
    metricId: 'pull_request.integration_interval',
    metricVersion: '1.1.0',
    scopeAlias: spec.scopeAlias,
    window: { start: spec.windowStart, end: spec.windowEnd },
    asOf: spec.asOf,
    coverage: completeIntervalCoverage(),
    evidenceIds: [] as string[],
    calculation: {
      procedureId: INTEGRATION_INTERVAL_PROCEDURE,
      metricContractVersion: '1.1.0',
      engineVersion: '1.0.0',
    },
    sensitivity: [] as unknown[],
  }

  if (eligible === 0) {
    return MetricResultSchema.parse({
      ...base,
      resultId: spec.resultId,
      state: 'empty_eligible_cohort',
      stateReasonCode: 'EMPTY_ELIGIBLE_COHORT',
      counts: { eligible: 0, censored: 0, excluded },
      value: { kind: 'quantiles', sampleSize: 0, quantiles: null },
    })
  }

  if (censored === eligible) {
    return MetricResultSchema.parse({
      ...base,
      resultId: spec.resultId,
      state: 'censored_only',
      stateReasonCode: 'ALL_ELIGIBLE_EVENTS_CENSORED',
      counts: { eligible, censored, excluded },
      value: { kind: 'no_value', reasonCode: 'ALL_ELIGIBLE_EVENTS_CENSORED' },
    })
  }

  const quantiles = sampleSize === 0
    ? null
    : DECLARED_QUANTILES.map((quantile) => ({ quantile, value: nearestRankQuantile(sorted, quantile) }))

  return MetricResultSchema.parse({
    ...base,
    resultId: spec.resultId,
    state: 'observed',
    stateReasonCode: 'OBSERVED',
    counts: { eligible, censored, excluded },
    value: { kind: 'quantiles', sampleSize, quantiles },
  })
}

/**
 * The construct SIGNATURE of a result: state plus the numbers a wrong cohort actually perturbs.
 * Two results with the same signature agree on what was measured; a mismatch is a construct-validity
 * failure, which is what the golden comparison is for. The `resultId`, coverage, and provenance are
 * deliberately excluded — they are not the construct.
 */
export interface ConstructSignature {
  readonly reference: string
  readonly state: MetricResult['state']
  readonly eligible: number
  readonly censored: number
  readonly value: MetricResult['value']
}

export function constructSignature(result: MetricResult): ConstructSignature {
  return {
    reference: formatMetricReference({ metricId: result.metricId, version: result.metricVersion }),
    state: result.state,
    eligible: result.counts.eligible,
    censored: result.counts.censored,
    value: result.value,
  }
}

/**
 * Does a procedure's output measure the same construct as the golden? A stable serialisation of the
 * two construct signatures. The correct procedure conforms; the wrong-cohort procedure does not,
 * even though both pass every schema and registry check.
 */
export function conformsToGolden(candidate: MetricResult, golden: MetricResult): boolean {
  return JSON.stringify(constructSignature(candidate)) === JSON.stringify(constructSignature(golden))
}
