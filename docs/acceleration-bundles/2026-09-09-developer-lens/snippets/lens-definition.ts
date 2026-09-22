
import type { CoverageVector, EvidenceRef, Finding } from '../../shared/types.js'

export type LensSupport =
  | { status: 'supported'; sampleSize: number; eventCount: number }
  | { status: 'abstain'; code: AbstentionCode; details: Record<string, number | string> }

export type AbstentionCode =
  | 'INSUFFICIENT_ELIGIBLE_OBSERVATIONS'
  | 'INSUFFICIENT_EVENTS'
  | 'INSUFFICIENT_GROUP_SUPPORT'
  | 'COVERAGE_NOT_COMPARABLE'
  | 'CAPABILITY_NOT_ACTIVE'
  | 'WINDOW_NOT_OBSERVABLE'

export interface ObservationQuery<TRow> {
  scopeId: string
  window: { start: string; endExclusive: string }
  read(signal?: AbortSignal): Promise<{
    rows: readonly TRow[]
    coverage: CoverageVector
    evidence: readonly EvidenceRef[]
  }>
}

export interface LensDefinition<TRow, TParams, TResult> {
  readonly id: string
  readonly version: string
  readonly requiredCapabilities: readonly string[]
  readonly parameterSchema: unknown
  assessSupport(rows: readonly TRow[], params: TParams): LensSupport
  analyse(rows: readonly TRow[], params: TParams): TResult
  toFinding(result: TResult, context: {
    support: Extract<LensSupport, { status: 'supported' }>
    coverage: CoverageVector
    evidence: readonly EvidenceRef[]
  }): Finding
}

/**
 * Keep this registry compile-time and Product-owned initially.
 * Runtime third-party plugins create a new code-execution and data-access boundary.
 */
export const LENS_REGISTRY = new Map<string, LensDefinition<unknown, unknown, unknown>>()
