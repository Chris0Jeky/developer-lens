import { createHash } from 'node:crypto'
import type { ChangeBatchTailInput } from '../../shared/changeBatchTail.js'
import {
  acceptChangeBatchTailView,
  assertChangeBatchTailViewPresentationSafe,
  buildChangeBatchTailView,
  type ChangeBatchTailView,
} from '../../shared/changeBatchTailView.js'
import { buildSyntheticChangeBatchTailView } from '../../shared/changeBatchTailSynthetic.js'
import { assertRenderableFinding } from '../../shared/findings.js'
import { assertExposableMetricResult } from '../../shared/metrics.js'
import {
  readStoredObservations,
  type StoredObservationRefusalCode,
  type StoredObservationRequest,
  type StoredObservationSet,
} from '../storage/v3ObservationBridge.js'
import type { StorageV3SelectedReader } from '../storage/v3ReaderSelection.js'
import { assertPresentationSafe } from './integrationShape.js'

/**
 * Phase E (#174) — the server half of the change-batch lens. It owns the ONE path from a proven
 * selected v3 reader to a served PresentationView:
 *
 *   selected reader → `readStoredObservations` (bridge) → presentation-local labels →
 *   shared pure analysis → gates → view.
 *
 * The gates are the existing contracts, not a parallel model: `acceptChangeBatchTailView`
 * (strict view schema, `validateFinding`, `validateMetricResult` on every result, a
 * contract-valid drawer walk answering every mark), `assertRenderableFinding` for the
 * `api_v2` surface, `assertExposableMetricResult` on every result for the `api` sink with the
 * display gate honoured, the existing `assertPresentationSafe` canary, and a stored-read canary
 * that no storage key or exact operational instant the bridge touched reaches a served byte.
 */

export class ChangeBatchTailGateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChangeBatchTailGateError'
  }
}

export type StoredChangeBatchTailResult =
  | { readonly status: 'view'; readonly view: ChangeBatchTailView }
  | { readonly status: 'refused'; readonly code: StoredObservationRefusalCode }

/**
 * The presentation scope surrogate: a one-way, versioned derivation of the storage scope key, so
 * the view never transports the key itself. It is not a secret and does not claim to be one.
 */
export function presentationScopeSurrogate(scopeId: string): string {
  return `lens-scope-${createHash('sha256').update(`developer-lens/phase-e/presentation-scope/v1:${scopeId}`).digest('hex').slice(0, 24)}`
}

/** Replace every storage identity with an ordinal label; the analysis never sees a storage key. */
export function toChangeBatchInput(observation: StoredObservationSet): ChangeBatchTailInput {
  return {
    source: { kind: 'selected_v3_store' },
    scopeSurrogate: presentationScopeSurrogate(observation.request.scopeId),
    scope: { hasAlias: observation.scope.hasAlias, linkedAt: observation.scope.linkedAt },
    window: { start: observation.request.window.start, end: observation.request.window.end },
    asOf: observation.request.asOf,
    units: observation.pullRequests.map((row) => ({
      createdAt: row.createdAt,
      mergedAt: row.mergedAt,
      closedAt: row.closedAt,
      state: row.state,
      isDraft: row.isDraft,
      additions: row.additions,
      deletions: row.deletions,
      changedFiles: row.changedFiles,
      retention: row.retention,
    })),
    coverage: observation.coverage.map((row) => ({
      label: `coverage-${row.ordinal}`,
      jobLabel: `job-${row.jobOrdinal}`,
      consentLabel: `consent-${row.consentOrdinal}`,
      instrumentLabel: `instrument-${row.instrumentOrdinal}`,
      status: row.status,
      jobStatus: row.jobStatus,
      snapshotClosed: row.snapshotClosed,
      expectedUnits: row.expectedUnits,
      observedUnits: row.observedUnits,
      omittedUnits: row.omittedUnits,
      saturationReason: row.saturationReason,
      limitationCode: row.limitationCode,
      retryable: row.retryable,
      rangeStart: row.rangeStart,
      rangeEnd: row.rangeEnd,
      observedAt: row.observedAt,
      retention: row.retention,
    })),
    lineage: observation.lineage.map((event) => ({
      subjectKind: event.subjectKind,
      eventKind: event.eventKind,
      eventWeek: event.eventWeek,
      coverageLabel: event.linkedCoverageOrdinal === null ? null : `coverage-${event.linkedCoverageOrdinal}`,
      jobLabel: event.linkedJobOrdinal === null ? null : `job-${event.linkedJobOrdinal}`,
    })),
  }
}

/** Run every serving gate over a composed view. Throws `ChangeBatchTailGateError` on any failure. */
export function gateChangeBatchTailView(candidate: ChangeBatchTailView, forbiddenValues: readonly string[] = []): ChangeBatchTailView {
  try {
    const view = acceptChangeBatchTailView(candidate)
    assertRenderableFinding(view.finding, 'api_v2')
    const displayById = new Map(view.results.map((result) => [result.resultId, assertExposableMetricResult(result, 'api').displayEligibility]))
    for (const binning of view.binnings) {
      for (const stratum of binning.strata) {
        const display = displayById.get(stratum.resultId)
        // Minimum-support abstention: a stratum is rendered with numbers only when the registry's
        // display gate says so; below-gate and truncated strata carry no quantile at all.
        if (display === undefined || (stratum.displayed && !display.display) || (!stratum.displayed && stratum.quantiles !== null)) {
          throw new ChangeBatchTailGateError('a stratum renders numbers its display gate withholds')
        }
      }
    }
    assertPresentationSafe(view, 'change-batch view')
    assertChangeBatchTailViewPresentationSafe(view, forbiddenValues)
    return view
  } catch (error) {
    if (error instanceof ChangeBatchTailGateError) throw error
    throw new ChangeBatchTailGateError(`change-batch view failed a serving gate: ${(error as Error).name}`)
  }
}

/** Compose the stored reading for one scope/window from a PROVEN selected reader only. */
export function composeStoredChangeBatchTailView(
  selection: StorageV3SelectedReader,
  request: StoredObservationRequest,
): StoredChangeBatchTailResult {
  const read = readStoredObservations(selection, request)
  if (read.status === 'refused') return read
  const view = buildChangeBatchTailView(toChangeBatchInput(read.observation))
  return { status: 'view', view: gateChangeBatchTailView(view, read.observation.internal.forbiddenValues) }
}

/** The explicitly synthetic public view, through the same gates. */
export function composeSyntheticChangeBatchTailView(): ChangeBatchTailView {
  return gateChangeBatchTailView(buildSyntheticChangeBatchTailView())
}
