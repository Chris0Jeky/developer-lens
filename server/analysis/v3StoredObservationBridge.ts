import type Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { isoWeekLabel } from '../../shared/presentationGrain.js'
import {
  assertExposableMetricResult,
  evaluateDisplayEligibility,
  getMetricDefinition,
  validateMetricResult,
  type MetricResult,
} from '../../shared/metrics.js'
import {
  assertRenderableFinding,
  validateFinding,
  type Finding,
} from '../../shared/findings.js'
import { computeIntegrationIntervalResult, type PullRequestLifecycle } from '../../shared/conformance.js'
import {
  ChangeBatchIntegrationTailPresentationSchema,
  partitionChangeBatchValueThirds,
  type ChangeBatchStratum,
  type ChangeBatchStratumSummary,
  type ChangeBatchWindowSummary,
  type ChangeBatchIntegrationTailPresentation,
  type IntegrationShapeProvenance,
} from '../../shared/changeBatchIntegrationTail.js'

export const V3_STORED_OBSERVATION_ABSTENTION_CODES = [
  'REQUIRED_TABLE_MISSING',
  'COVERAGE_NOT_COMPLETE',
  'COVERAGE_AMBIGUOUS',
  'COVERAGE_BINDING_MISMATCH',
  'READY_COLUMNS_MISSING',
  'READY_FACT_MISSING',
  'INVALID_LIFECYCLE_TIMESTAMP',
  'SUPPORT_BELOW_MINIMUM',
] as const
export type V3StoredObservationAbstentionCode = typeof V3_STORED_OBSERVATION_ABSTENTION_CODES[number]

export interface HalfOpenWindow {
  readonly start: string
  readonly end: string
}

export interface V3StoredObservationBridgeInput {
  readonly db: Database.Database
  readonly scopeId: string
  readonly capabilityId: 'github.core'
  readonly consentRevision: string
  readonly currentWindow: HalfOpenWindow
  readonly baselineWindow: HalfOpenWindow
  readonly asOf: string
}

interface CoverageProof {
  readonly coverageId: string
  readonly rangeStart: string
  readonly rangeEnd: string
  readonly jobId: string
  readonly snapshotId: string
  readonly expectedUnits: number
  readonly observedUnits: number
  readonly observedAt: string
  readonly jobStartedAt: string
  readonly jobCompletedAt: string
  readonly snapshotObservedAt: string
  readonly queryVersion: string
  readonly sourceApiVersion: string
}

interface FactRow {
  factId: string
  createdAt: string | null
  readyAt: string | null
  readyBasis: string | null
  mergedAt: string | null
  closedAt: string | null
  additions: number | null
  deletions: number | null
  changedFiles: number | null
}

interface PreparedWindow {
  readonly facts: readonly FactRow[]
  readonly proof: CoverageProof
  readonly eligibleRows: readonly FactRow[]
  readonly sizedRows: readonly FactRow[]
  readonly missingSizeExcluded: number
  readonly excludedReady: number
}

interface MetricBundle {
  readonly result: MetricResult
  readonly display: ReturnType<typeof evaluateDisplayEligibility>
}

export interface V3StoredObservationComplete {
  readonly status: 'complete'
  readonly envelope: ChangeBatchIntegrationTailPresentation
  readonly finding: Finding
  readonly metrics: readonly MetricBundle[]
  readonly limitation: 'pull_request_fact_has_no_job_provenance'
}

export interface V3StoredObservationAbstained {
  readonly status: 'abstained'
  readonly code: V3StoredObservationAbstentionCode
  readonly envelope: null
  readonly finding: Finding
  readonly metrics: readonly MetricBundle[]
}

export type V3StoredObservationBridgeResult = V3StoredObservationComplete | V3StoredObservationAbstained

const METRIC_REFERENCE = { metricId: 'pull_request.integration_interval', metricVersion: '1.1.0' } as const
const ALLOWED_READY_BASES = new Set(['timeline_event', 'creation_observed_never_draft'])

function timestamp(value: string | null): number | null {
  if (value === null) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function assertWindow(window: HalfOpenWindow): void {
  const start = timestamp(window.start)
  const end = timestamp(window.end)
  if (start === null || end === null || start >= end) throw new Error('INVALID_WINDOW')
}

function tableExists(db: Database.Database, table: string): boolean {
  return db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ? LIMIT 1").get(table) !== undefined
}

function columns(db: Database.Database, table: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name))
}

function coverageProof(db: Database.Database, input: V3StoredObservationBridgeInput, window: HalfOpenWindow): CoverageProof {
  const rows = db.prepare(`
    SELECT
      c.coverage_id AS coverageId, c.range_start AS coverageStart, c.range_end AS coverageEnd,
      c.job_id AS jobId, c.snapshot_id AS snapshotId, c.expected_units AS expectedUnits,
      c.observed_units AS observedUnits, c.omitted_units AS omittedUnits, c.observed_at AS coverageObservedAt,
      c.limitation_code AS limitationCode, c.saturation_reason AS saturationReason,
      j.scope_id AS jobScopeId, j.capability_id AS jobCapabilityId, j.consent_revision AS consentRevision,
      j.query_version AS queryVersion, j.source_api_version AS sourceApiVersion,
      j.status AS jobStatus, j.range_start AS jobStart, j.range_end AS jobEnd,
      j.started_at AS jobStartedAt, j.completed_at AS jobCompletedAt,
      s.scope_id AS snapshotScopeId, s.job_id AS snapshotJobId, s.capability_id AS snapshotCapabilityId,
      s.status AS snapshotStatus, s.range_start AS snapshotStart, s.range_end AS snapshotEnd,
      s.observed_at AS snapshotObservedAt
    FROM coverage_ledger c
    JOIN collection_job j ON j.scope_id = c.scope_id AND j.job_id = c.job_id
    JOIN source_snapshot s ON s.scope_id = c.scope_id AND s.snapshot_id = c.snapshot_id AND s.job_id = c.job_id
    WHERE c.scope_id = ? AND c.capability_id = ? AND j.capability_id = ? AND j.consent_revision = ?
      AND c.status = 'complete' AND j.status = 'complete' AND s.status = 'closed'
      AND c.expected_units IS NOT NULL AND c.expected_units = c.observed_units AND c.omitted_units = 0
      AND c.range_start IS NOT NULL AND c.range_end IS NOT NULL AND c.saturation_reason IS NULL AND c.limitation_code = 'COMPLETE'
      AND j.range_start IS NOT NULL AND j.range_end IS NOT NULL
      AND s.range_start IS NOT NULL AND s.range_end IS NOT NULL
      AND c.range_start <= ? AND c.range_end >= ?
      AND j.range_start <= ? AND j.range_end >= ?
      AND s.range_start <= ? AND s.range_end >= ?
    ORDER BY c.coverage_id
  `).all(
    input.scopeId,
    input.capabilityId,
    input.capabilityId,
    input.consentRevision,
    window.start,
    window.end,
    window.start,
    window.end,
    window.start,
    window.end,
  ) as Array<Record<string, unknown>>

  if (rows.length === 0) throw Object.assign(new Error('COVERAGE_NOT_COMPLETE'), { code: 'COVERAGE_NOT_COMPLETE' })
  if (rows.length !== 1) throw Object.assign(new Error('COVERAGE_AMBIGUOUS'), { code: 'COVERAGE_AMBIGUOUS' })
  const row = rows[0]
  if (
    row.jobScopeId !== input.scopeId || row.snapshotScopeId !== input.scopeId || row.snapshotJobId !== row.jobId
    || row.jobCapabilityId !== input.capabilityId || row.snapshotCapabilityId !== input.capabilityId
    || row.consentRevision !== input.consentRevision || row.expectedUnits !== row.observedUnits || row.omittedUnits !== 0
    || row.limitationCode !== 'COMPLETE' || row.saturationReason !== null
  ) throw Object.assign(new Error('COVERAGE_BINDING_MISMATCH'), { code: 'COVERAGE_BINDING_MISMATCH' })
  if (
    typeof row.coverageId !== 'string' || typeof row.coverageStart !== 'string' || typeof row.coverageEnd !== 'string'
    || typeof row.jobId !== 'string' || typeof row.snapshotId !== 'string' || typeof row.expectedUnits !== 'number'
    || typeof row.observedUnits !== 'number' || typeof row.coverageObservedAt !== 'string'
    || typeof row.jobStartedAt !== 'string' || typeof row.jobCompletedAt !== 'string' || typeof row.snapshotObservedAt !== 'string'
    || typeof row.queryVersion !== 'string' || typeof row.sourceApiVersion !== 'string'
  ) throw Object.assign(new Error('COVERAGE_BINDING_MISMATCH'), { code: 'COVERAGE_BINDING_MISMATCH' })
  return {
    coverageId: row.coverageId,
    rangeStart: row.coverageStart,
    rangeEnd: row.coverageEnd,
    jobId: row.jobId,
    snapshotId: row.snapshotId,
    expectedUnits: row.expectedUnits,
    observedUnits: row.observedUnits,
    observedAt: row.coverageObservedAt,
    jobStartedAt: row.jobStartedAt,
    jobCompletedAt: row.jobCompletedAt,
    snapshotObservedAt: row.snapshotObservedAt,
    queryVersion: row.queryVersion,
    sourceApiVersion: row.sourceApiVersion,
  }
}

function readFacts(db: Database.Database, scopeId: string): { rows: FactRow[]; readyColumns: boolean } {
  const available = columns(db, 'pull_request_fact')
  const readyColumns = available.has('ready_for_review_at') && available.has('ready_for_review_basis')
  if (!readyColumns) return { rows: [], readyColumns: false }
  const rows = db.prepare(`
    SELECT fact_id AS factId, created_at AS createdAt, ready_for_review_at AS readyAt, ready_for_review_basis AS readyBasis,
           merged_at AS mergedAt, closed_at AS closedAt, additions, deletions, changed_files AS changedFiles
    FROM pull_request_fact WHERE scope_id = ? ORDER BY fact_id
  `).all(scopeId) as FactRow[]
  return { rows, readyColumns: true }
}

function prepareWindow(db: Database.Database, input: V3StoredObservationBridgeInput, window: HalfOpenWindow): PreparedWindow {
  const proof = coverageProof(db, input, window)
  const read = readFacts(db, input.scopeId)
  if (!read.readyColumns) throw Object.assign(new Error('READY_COLUMNS_MISSING'), { code: 'READY_COLUMNS_MISSING' })
  const start = timestamp(window.start) as number
  const end = timestamp(window.end) as number
  const potentiallyMissing = read.rows.some((row) => {
    const created = timestamp(row.createdAt)
    return (row.readyAt === null || row.readyBasis === null || !ALLOWED_READY_BASES.has(row.readyBasis ?? '')) && created !== null && created < end
  })
  if (potentiallyMissing) throw Object.assign(new Error('READY_FACT_MISSING'), { code: 'READY_FACT_MISSING' })
  const eligibleRows: FactRow[] = []
  let excludedReady = 0
  for (const row of read.rows) {
    const ready = timestamp(row.readyAt)
    if (ready === null || row.readyBasis === null || !ALLOWED_READY_BASES.has(row.readyBasis)
      || (row.readyBasis === 'creation_observed_never_draft' && timestamp(row.createdAt) !== ready)
      || (row.readyBasis === 'timeline_event' && (timestamp(row.createdAt) === null || ready < (timestamp(row.createdAt) as number)))) {
      excludedReady += 1
      continue
    }
    if (ready >= start && ready < end) eligibleRows.push(row)
    else excludedReady += 1
  }
  const sizedRows = eligibleRows.filter((row) => row.additions !== null && row.deletions !== null && row.additions >= 0 && row.deletions >= 0)
  return { facts: read.rows, proof, eligibleRows, sizedRows, missingSizeExcluded: eligibleRows.length - sizedRows.length, excludedReady }
}

function lifecycle(row: FactRow): PullRequestLifecycle {
  const ready = timestamp(row.readyAt)
  const merged = timestamp(row.mergedAt)
  const closed = timestamp(row.closedAt)
  if (ready !== null && merged !== null && merged < ready) throw Object.assign(new Error('INVALID_LIFECYCLE_TIMESTAMP'), { code: 'INVALID_LIFECYCLE_TIMESTAMP' })
  if (ready !== null && closed !== null && closed < ready) throw Object.assign(new Error('INVALID_LIFECYCLE_TIMESTAMP'), { code: 'INVALID_LIFECYCLE_TIMESTAMP' })
  return {
    opaqueId: row.factId,
    createdAt: ready === null ? null : row.createdAt,
    readyForReviewAt: row.readyAt,
    mergedAt: row.mergedAt,
    closedAt: row.closedAt,
  }
}

function checkedMetric(result: MetricResult): MetricBundle {
  const validated = validateMetricResult(result).result
  const definition = getMetricDefinition(`${validated.metricId}@${validated.metricVersion}`)
  const display = evaluateDisplayEligibility(definition, validated)
  assertExposableMetricResult(validated, 'api')
  return { result: validated, display }
}

function metricForRows(rows: readonly FactRow[], window: HalfOpenWindow, asOf: string, scopeId: string, resultId: string, proof: CoverageProof, comparable: boolean): MetricBundle {
  const computed = computeIntegrationIntervalResult(
    rows.map(lifecycle),
    { windowStart: window.start, windowEnd: window.end, asOf, scopeAlias: scopeId, resultId },
    'becameReady',
  )
  const sampleSize = computed.value.kind === 'quantiles' ? computed.value.sampleSize : 0
  const eligible = computed.counts.eligible
  const coverage = getMetricDefinition('pull_request.integration_interval@1.1.0').coverageDimensions.map((dimension) => {
    if (dimension === 'permission') return { dimension, value: 1, limiting_reason: null }
    if (dimension === 'completeness') return { dimension, value: proof.expectedUnits === 0 ? 0 : proof.observedUnits / proof.expectedUnits, limiting_reason: proof.expectedUnits === proof.observedUnits ? null : 'EXPECTED_UNITS_UNKNOWN' as const }
    if (dimension === 'eligibility') return { dimension, value: 1, limiting_reason: null }
    if (dimension === 'freshness') return { dimension, value: Date.parse(proof.observedAt) <= Date.parse(asOf) ? 1 : null, limiting_reason: Date.parse(proof.observedAt) <= Date.parse(asOf) ? null : 'STALE_BEYOND_SLO' as const }
    if (dimension === 'censoring_freedom') return { dimension, value: eligible === 0 ? 1 : 1 - computed.counts.censored / eligible, limiting_reason: null }
    if (dimension === 'sample') return { dimension, value: Math.min(1, sampleSize / 5), limiting_reason: sampleSize >= 5 ? null : 'SAMPLE_BELOW_MINIMUM' as const }
    return { dimension, value: comparable ? 1 : null, limiting_reason: comparable ? null : 'NO_SNAPSHOT_PAIR' as const }
  })
  const result: MetricResult = { ...computed, coverage }
  return checkedMetric(result)
}

function unavailableMetric(window: HalfOpenWindow, scopeId: string, resultId: string): MetricBundle {
  const dimensions = getMetricDefinition('pull_request.integration_interval@1.1.0').coverageDimensions.map((dimension) => ({ dimension, value: null, limiting_reason: 'UNAVAILABLE' as const }))
  const result: MetricResult = {
    resultId,
    metricId: 'pull_request.integration_interval',
    metricVersion: '1.1.0',
    scopeAlias: scopeId,
    window,
    asOf: window.end,
    state: 'unavailable',
    stateReasonCode: 'UNAVAILABLE',
    counts: { eligible: 0, censored: 0, excluded: [] },
    value: { kind: 'no_value', reasonCode: 'UNAVAILABLE' },
    coverage: dimensions,
    evidenceIds: [],
    calculation: { procedureId: 'pull_request.interval_quantiles_v2', metricContractVersion: '1.1.0', engineVersion: '1.0.0' },
    sensitivity: [],
  }
  return checkedMetric(result)
}

function summaryForMetric(stratum: ChangeBatchStratum, rows: readonly FactRow[], metric: MetricBundle, valueBasis: 'change' | 'files', missingSizeExcluded = 0): ChangeBatchStratumSummary {
  const values = rows.map((row) => valueBasis === 'change' ? (row.additions as number) + (row.deletions as number) : (row.changedFiles as number))
  const integrationTail = metric.result.value.kind === 'quantiles'
    ? { sampleSize: metric.result.value.sampleSize, quantiles: metric.result.value.quantiles }
    : { sampleSize: 0, quantiles: null }
  const competing = metric.result.counts.eligible - metric.result.counts.censored - integrationTail.sampleSize
  return {
    stratum,
    minChange: values.length === 0 ? null : Math.min(...values),
    maxChange: values.length === 0 ? null : Math.max(...values),
    n: metric.result.counts.eligible,
    excluded: metric.result.counts.excluded.reduce((sum, entry) => sum + entry.count, 0),
    censored: metric.result.counts.censored,
    competing: Math.max(0, competing),
    missingSizeExcluded,
    tiesKeptTogether: true,
    integrationTail,
  }
}

function windowSummary(prepared: PreparedWindow, window: HalfOpenWindow, asOf: string, scopeId: string, resultPrefix: string, comparable: boolean, valueBasis: 'change' | 'files' = 'change'): { summary: ChangeBatchWindowSummary; metric: MetricBundle; strataMetrics: MetricBundle[] } {
  const groups = new Map<number, FactRow[]>()
  for (const row of prepared.sizedRows) {
    const value = valueBasis === 'change' ? (row.additions as number) + (row.deletions as number) : (row.changedFiles as number)
    groups.set(value, [...(groups.get(value) ?? []), row])
  }
  const thirds = partitionChangeBatchValueThirds([...groups.entries()].map(([value, rows]) => ({ value, rows })))
  const strata = (['lower', 'middle', 'upper'] as const).map((stratum) => {
    const metric = metricForRows(thirds[stratum], window, asOf, scopeId, `${resultPrefix}-${stratum}`, prepared.proof, comparable)
    return { stratum, rows: thirds[stratum], metric }
  })
  const metric = metricForRows(prepared.sizedRows, window, asOf, scopeId, `${resultPrefix}-all`, prepared.proof, comparable)
  const summary: ChangeBatchWindowSummary = {
    weekLabels: { start: isoWeekLabel(window.start), end: isoWeekLabel(window.end) },
    eligible: metric.result.counts.eligible,
    excluded: prepared.excludedReady + prepared.missingSizeExcluded + metric.result.counts.excluded.reduce((sum, entry) => sum + entry.count, 0),
    censored: metric.result.counts.censored,
    competing: Math.max(0, metric.result.counts.eligible - metric.result.counts.censored - (metric.result.value.kind === 'quantiles' ? metric.result.value.sampleSize : 0)),
    missingSizeExcluded: prepared.missingSizeExcluded,
    strata: strata.map(({ stratum, rows, metric: item }) => summaryForMetric(stratum, rows, item, valueBasis)),
  }
  return { summary, metric, strataMetrics: strata.map(({ metric: item }) => item) }
}

function provenance(prepared: PreparedWindow, consentRevision: string): IntegrationShapeProvenance {
  return {
    facts: { table: 'pull_request_fact', rowCount: prepared.facts.length, jobProvenance: 'unavailable_current_schema' },
    coverage: {
      status: 'complete', expectedUnits: prepared.proof.expectedUnits, observedUnits: prepared.proof.observedUnits,
      omittedUnits: 0,
    },
    job: {
      status: 'complete', capabilityId: 'github.core', consentRevision,
    },
    snapshot: { status: 'closed' },
  }
}

function claimId(scopeId: string, window: HalfOpenWindow, role: string): string {
  return `cl_${createHash('sha256').update(`stored-change-batch.v1\0${scopeId}\0${window.start}\0${window.end}\0${role}`).digest('hex')}`
}

function findingFor(metrics: { current: MetricResult; baseline: MetricResult }, scopeId: string, window: HalfOpenWindow, abstention: boolean): Finding {
  const current = metrics.current
  const coverage = current.coverage.map((entry) => ({ dimension: entry.dimension, value: entry.value, limiting_reason: entry.limiting_reason }))
  const base: Finding = {
    findingId: abstention ? 'stored_integration_tail_abstention' : 'stored_integration_tail',
    version: '1.0.0', schemaVersion: '1.0.0', questionId: 'q_change_batch_integration_tail',
    layer: abstention ? 'abstention' : 'deterministic',
    statementCode: abstention ? 'ABSTAIN_LOW_COVERAGE' : 'DELIVERY_FLOW',
    method: { methodId: 'stored_change_batch_integration_tail', methodVersion: '1.0.0' },
    scopeId,
    metricResults: [
      { metricId: METRIC_REFERENCE.metricId, metricVersion: METRIC_REFERENCE.metricVersion, resultId: current.resultId, role: 'primary' },
      { metricId: METRIC_REFERENCE.metricId, metricVersion: METRIC_REFERENCE.metricVersion, resultId: metrics.baseline.resultId, role: 'supporting' },
    ],
    observation: abstention ? 'The stored observation is withheld until its coverage and ready-event facts are unambiguous.' : 'The stored pull-request cohort carries a change-batch surface and an integration tail with explicit censoring and competing outcomes.',
    candidateInterpretation: null,
    marks: abstention ? [] : (['lower', 'middle', 'upper', 'changed_files'] as const).map((role) => ({
      markId: `mark_integration_tail_${role}`,
      valueCategory: role === 'changed_files' ? 'count' as const : 'quantile' as const,
      reference: { kind: 'claim' as const, claimId: claimId(scopeId, window, role), claimLayer: 'deterministic' as const },
    })),
    evidence: abstention ? [] : [{ kind: 'observation', evidenceId: `ev_${createHash('sha256').update(`stored-observation.v1\0${scopeId}\0${window.start}\0${window.end}`).digest('hex')}` }], counterEvidence: [], alternativeExplanations: [],
    limitations: abstention ? [{ limitationCode: 'COVERAGE_INCOMPLETE', dimension: 'completeness', copyKey: 'copy.stored_observation.coverage' }] : [{ limitationCode: 'COVERAGE_UNITS_DIFFER', dimension: 'censoring_freedom', copyKey: 'copy.stored_observation.censored' }],
    prohibitedInterpretations: [
      { code: 'NOT_PERSON_MEASURE', statement: 'This is a property of a pull-request cohort and never a measure of an individual.' },
      { code: 'NOT_CAUSAL', statement: 'The observed distribution does not establish a cause.' },
      { code: 'NOT_QUALITY', statement: 'Change size and integration interval do not describe the value of a change.' },
    ],
    sampleSummary: { resultId: current.resultId, state: current.state, counts: current.counts },
    coverage,
    robustness: { status: 'not-tested', checks: [] },
    discriminatingEvidence: null,
    presentationEligibility: { eligible: true, reasonCode: abstention ? 'PRESENTABLE_AS_ABSTENTION' : 'PRESENTABLE', surfaces: ['atlas', 'evidence_drawer', 'api_v2'] },
    abstention: abstention ? { floorCode: 'STORED_OBSERVATION_FLOOR', dimension: 'comparability', limitingReason: 'NO_SNAPSHOT_PAIR', statement: 'Coverage or ready-event facts are not sufficient for a stored observation.', fallbackFindingId: null } : null,
  }
  return assertRenderableFinding(validateFinding(base), 'atlas').finding
}

function abstained(input: V3StoredObservationBridgeInput, code: V3StoredObservationAbstentionCode): V3StoredObservationAbstained {
  const current = unavailableMetric(input.currentWindow, input.scopeId, 'stored-current-unavailable')
  const baseline = unavailableMetric(input.baselineWindow, input.scopeId, 'stored-baseline-unavailable')
  return { status: 'abstained', code, envelope: null, finding: findingFor({ current: current.result, baseline: baseline.result }, input.scopeId, input.currentWindow, true), metrics: [current, baseline] }
}

/** Bridge an already-proven, read-only native-v3 database handle. No path is accepted or opened. */
export function bridgeV3StoredObservation(input: V3StoredObservationBridgeInput): V3StoredObservationBridgeResult {
  try {
    assertWindow(input.currentWindow)
    assertWindow(input.baselineWindow)
    if (!tableExists(input.db, 'pull_request_fact') || !tableExists(input.db, 'coverage_ledger') || !tableExists(input.db, 'collection_job') || !tableExists(input.db, 'source_snapshot')) return abstained(input, 'REQUIRED_TABLE_MISSING')
    const prepared = input.db.transaction(() => ({
      current: prepareWindow(input.db, input, input.currentWindow),
      baseline: prepareWindow(input.db, input, input.baselineWindow),
    }))()
    const currentPrepared = prepared.current
    const baselinePrepared = prepared.baseline
    if (currentPrepared.proof.queryVersion !== baselinePrepared.proof.queryVersion || currentPrepared.proof.sourceApiVersion !== baselinePrepared.proof.sourceApiVersion) return abstained(input, 'COVERAGE_BINDING_MISMATCH')
    const comparable = currentPrepared.proof.queryVersion === baselinePrepared.proof.queryVersion && currentPrepared.proof.sourceApiVersion === baselinePrepared.proof.sourceApiVersion
    const current = windowSummary(currentPrepared, input.currentWindow, input.asOf, input.scopeId, 'stored-current', comparable)
    const baseline = windowSummary(baselinePrepared, input.baselineWindow, input.asOf, input.scopeId, 'stored-baseline', comparable)
    const currentChanged = currentPrepared.eligibleRows.filter((row) => row.changedFiles !== null && row.changedFiles >= 0)
    const baselineChanged = baselinePrepared.eligibleRows.filter((row) => row.changedFiles !== null && row.changedFiles >= 0)
    const changedCurrent = windowSummary({ ...currentPrepared, sizedRows: currentChanged, missingSizeExcluded: currentPrepared.eligibleRows.length - currentChanged.length }, input.currentWindow, input.asOf, input.scopeId, 'stored-current-files', comparable, 'files')
    const changedBaseline = windowSummary({ ...baselinePrepared, sizedRows: baselineChanged, missingSizeExcluded: baselinePrepared.eligibleRows.length - baselineChanged.length }, input.baselineWindow, input.asOf, input.scopeId, 'stored-baseline-files', comparable, 'files')
    if (![current.metric, baseline.metric, ...current.strataMetrics, ...baseline.strataMetrics].every((metric) => metric.display.display && (metric.result.state !== 'observed' || (metric.result.value.kind === 'quantiles' && metric.result.value.sampleSize >= 5)))) {
      return abstained(input, 'SUPPORT_BELOW_MINIMUM')
    }
    const envelope: ChangeBatchIntegrationTailPresentation = ChangeBatchIntegrationTailPresentationSchema.parse({
      presentationContractVersion: '1.0.0', mode: 'selected_store', scopeId: input.scopeId, capabilityId: input.capabilityId, consentRevision: input.consentRevision,
      current: current.summary, baseline: baseline.summary,
      sensitivity: { primary: 'additions_plus_deletions', variant: 'changed_files', current: changedCurrent.summary, baseline: changedBaseline.summary },
      provenance: { current: provenance(currentPrepared, input.consentRevision), baseline: provenance(baselinePrepared, input.consentRevision) },
      factProvenanceLimitation: 'pull_request_fact_has_no_job_provenance',
    })
    const finding = findingFor({ current: current.metric.result, baseline: baseline.metric.result }, input.scopeId, input.currentWindow, false)
    return { status: 'complete', envelope, finding, metrics: [current.metric, baseline.metric, ...current.strataMetrics, ...baseline.strataMetrics, changedCurrent.metric, changedBaseline.metric], limitation: 'pull_request_fact_has_no_job_provenance' }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
    const abstentionCode = (V3_STORED_OBSERVATION_ABSTENTION_CODES as readonly string[]).includes(code) ? code as V3StoredObservationAbstentionCode : 'COVERAGE_BINDING_MISMATCH'
    return abstained(input, abstentionCode)
  }
}

export const analyzeV3StoredObservation = bridgeV3StoredObservation
export const composeV3StoredObservation = bridgeV3StoredObservation
