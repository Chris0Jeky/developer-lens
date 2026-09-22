import { z } from 'zod'
import { CAPABILITY_REGISTRY } from './capabilities.js'
import {
  analyzeChangeBatchTail,
  buildChangeBatchFinding,
  buildChangeBatchMarks,
  CHANGE_BATCH_BASES,
  CHANGE_BATCH_BINNINGS,
  CHANGE_BATCH_COHORT_STATEMENT,
  CHANGE_BATCH_DECISIONS,
  CHANGE_BATCH_QUESTION,
  CHANGE_BATCH_TAIL_METHOD_ID,
  CHANGE_BATCH_TAIL_METHOD_VERSION,
  CHANGE_BATCH_TAIL_METRIC_REFERENCE,
  CHANGE_BATCH_TAIL_SYNTHETIC_MARKER,
  CHANGE_BATCH_TAIL_VIEW_VERSION,
  ceilToWeek,
  evidenceIdFor,
  floorToWeek,
  isoWeekStart,
  isWeekAlignedInstant,
  type ChangeBatchMark,
  type ChangeBatchTailAnalysis,
  type ChangeBatchTailInput,
} from './changeBatchTail.js'
import { FindingSchema, validateFinding, type AnalyticReference, type Finding } from './findings.js'
import { MetricResultSchema, validateMetricResult, type MetricResult } from './metrics.js'
import {
  WhyCoverageNodeSchema,
  WhyMissingLinkSchema,
  WhyResolutionSchema,
  whyResolutionAnswersReference,
} from './whyContract.js'
import type {
  WhyCapabilityNode,
  WhyClaimReferenceNode,
  WhyClaimSummary,
  WhyCoverageNode,
  WhyEdge,
  WhyEdgeGroup,
  WhyEvidenceNode,
  WhyExplanationTree,
  WhyLineageEvent,
  WhyMissingLink,
  WhyUnresolvable,
  WhyWalk,
} from '../server/storage/whyResolver.js'

/**
 * Phase E (#174) — the change-batch lens PresentationView, its Evidence Drawer resolver, and the
 * acceptance gate the API runs before serving and the browser runs on every served body.
 *
 * The view is presentation-shaped by construction: aggregate counts and quantiles, coverage rows
 * named by ordinal labels (`coverage-1`, `job-1`) at ISO-week grain, lineage at its stored week,
 * and presentation-minted claim ids. It carries no pull-request row, no storage key, no scope key
 * or alias, and no exact operational instant — only the caller-chosen window and asOf.
 *
 * Every number the panel renders is a `ChangeBatchMark`; `resolveChangeBatchTailReference` turns
 * its claim reference into a `WhyExplanationTree` over the SAME served data (stratum evidence, the
 * coverage rows that vouch for the window, retention and tombstone lineage), so the drawer walk is
 * a pure function of the validated view and cannot drift from the numbers beside it.
 */

export type ChangeBatchResolution = WhyExplanationTree | WhyUnresolvable | WhyEvidenceNode | WhyMissingLink

const GITHUB_CORE = CAPABILITY_REGISTRY.find((entry) => entry.id === 'github.core')
if (GITHUB_CORE === undefined) throw new Error('github.core must be registered')
const CAPABILITY_NODE: WhyCapabilityNode = {
  kind: 'capability',
  capabilityId: GITHUB_CORE.id,
  purposeCode: GITHUB_CORE.purposeCode,
  classCeiling: GITHUB_CORE.classCeiling,
  requiredGates: [...GITHUB_CORE.requiredGates],
  refusalStatus: GITHUB_CORE.refusalStatus,
}

/* ------------------------------------------------------------------------------------------ *
 * View schema
 * ------------------------------------------------------------------------------------------ */

const Instant = z.string().datetime({ offset: true })
const Label = z.string().regex(/^[a-z]+-\d{1,4}$/)
const Code = z.string().regex(/^[A-Z][A-Z0-9_]*$/)
const Count = z.number().int().nonnegative()
const Seconds = z.number().nonnegative()
const Ordering = z.union([z.literal(-1), z.literal(0), z.literal(1)]).nullable()
const BasisId = z.enum(['lines_changed', 'changed_files'])
const BinningId = z.enum(['declared_thresholds', 'value_thirds'])
const StratumId = z.enum(['s1', 's2', 's3'])
const CoverageStatus = z.enum(['complete', 'truncated', 'failed', 'restricted'])

const MarkSchema = z.strictObject({
  markId: z.string().regex(/^m\.[A-Za-z0-9._:-]{1,120}$/),
  claimId: z.string().regex(/^cl_[0-9a-f]{64}$/),
  valueCategory: z.enum(['count', 'quantile', 'ratio', 'share']),
  subject: z.strictObject({
    basisId: z.union([BasisId, z.literal('all')]),
    binningId: z.union([BinningId, z.literal('all')]),
    stratumId: StratumId.nullable(),
    measure: z.enum(['eligible', 'merged', 'censored', 'competing', 'excluded', 'p50', 'p75', 'p90', 'lower_bound_p90', 'concordance', 'coverage']),
    detail: z.string().regex(/^[a-z_A-Z]+$/).nullable(),
  }),
  statement: z.string().min(12).max(400),
})

const StratumViewSchema = z.strictObject({
  stratumId: StratumId,
  label: z.string().min(1).max(80),
  lower: z.number().nonnegative().nullable(),
  upper: z.number().nonnegative().nullable(),
  resultId: z.string().regex(/^cbt\.[a-z_]+\.[a-z_]+\.s[123]$/),
  state: z.string(),
  displayed: z.boolean(),
  displayReasonCode: Code,
  eligible: Count,
  merged: Count,
  censored: Count,
  competing: Count,
  quantiles: z.array(z.strictObject({ quantile: z.number(), seconds: Seconds })).nullable(),
  lowerBoundP90: Seconds.nullable(),
})

const BinningViewSchema = z.strictObject({
  basisId: BasisId,
  binningId: BinningId,
  role: z.enum(['primary', 'sensitivity']),
  basisLabel: z.string(),
  binningLabel: z.string(),
  tailOrdering: Ordering,
  lowerBoundTailOrdering: Ordering,
  strata: z.array(StratumViewSchema).length(3),
})

const ConcordanceSchema = z.strictObject({
  basisId: BasisId,
  shown: z.boolean(),
  reasonCode: z.enum(['SHOWN', 'BELOW_MINIMUM_SUPPORT', 'TOO_FEW_COMPARABLE_PAIRS', 'WINDOW_NOT_DISPLAYABLE']),
  value: z.number().min(0).max(1).nullable(),
  comparablePairs: Count,
  concordantPairs: Count,
  tiedSizePairs: Count,
  mergedEvents: Count,
})

const CoverageRowViewSchema = z.strictObject({
  label: Label,
  jobLabel: Label,
  status: CoverageStatus,
  jobStatus: CoverageStatus,
  retention: z.enum(['live', 'expired', 'cleared']),
  rangeStartWeek: Instant.nullable(),
  rangeEndWeek: Instant.nullable(),
  overlapsWindow: z.boolean().nullable(),
  vouches: z.boolean(),
  notVouchingReason: Code.nullable(),
})

const LineageViewSchema = z.strictObject({
  subjectKind: z.string().regex(/^[a-z_]+$/),
  eventKind: z.string().regex(/^[a-z0-9_]+$/),
  eventWeek: z.string().regex(/^\d{4}-W\d{2}$/),
  coverageLabel: Label.nullable(),
  jobLabel: Label.nullable(),
})

export const ChangeBatchTailViewSchema = z.strictObject({
  viewVersion: z.literal(CHANGE_BATCH_TAIL_VIEW_VERSION),
  lensId: z.literal(CHANGE_BATCH_TAIL_METHOD_ID),
  source: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('synthetic'), marker: z.literal(CHANGE_BATCH_TAIL_SYNTHETIC_MARKER) }),
    z.strictObject({ kind: z.literal('selected_v3_store') }),
  ]),
  question: z.string(),
  cohortStatement: z.string(),
  metricReference: z.literal(CHANGE_BATCH_TAIL_METRIC_REFERENCE),
  decisions: z.strictObject({ supported: z.array(z.string()).min(1), unsupported: z.array(z.string()).min(1) }),
  scopeSurrogate: z.string().regex(/^lens-scope-[0-9a-f]{24}$/),
  scope: z.strictObject({ hasAlias: z.boolean(), linkedWeek: Instant.nullable() }),
  window: z.strictObject({ start: Instant, end: Instant }),
  asOf: Instant,
  readiness: z.strictObject({ status: z.literal('not_recorded'), statement: z.string() }),
  state: z.enum(['presentable', 'abstained']),
  abstention: z.strictObject({
    reasonCode: Code,
    floorCode: Code,
    dimension: z.string(),
    limitingReason: Code,
    statement: z.string(),
  }).nullable(),
  cohort: z.strictObject({
    eligible: Count,
    merged: Count,
    censored: Count,
    competing: Count,
    excluded: z.array(z.strictObject({ reasonCode: Code, count: z.number().int().positive() })),
    draftsStillOpen: Count,
  }),
  coverage: z.strictObject({
    rows: z.array(CoverageRowViewSchema),
    nodes: z.array(z.union([WhyCoverageNodeSchema, WhyMissingLinkSchema])),
    lineage: z.array(LineageViewSchema),
    consentRevisions: Count,
    instrumentRevisions: Count,
  }),
  binnings: z.array(BinningViewSchema),
  concordance: z.array(ConcordanceSchema),
  results: z.array(MetricResultSchema).min(1),
  finding: FindingSchema,
  marks: z.array(MarkSchema),
})

export type ChangeBatchTailView = z.infer<typeof ChangeBatchTailViewSchema>

/* ------------------------------------------------------------------------------------------ *
 * View construction
 * ------------------------------------------------------------------------------------------ */

function coverageNodeFor(
  row: ChangeBatchTailAnalysis['coverage']['rows'][number],
  source: ChangeBatchTailInput['coverage'][number],
  input: ChangeBatchTailInput,
): WhyCoverageNode | WhyMissingLink {
  const lineage = lineageFor(input, (event) => event.coverageLabel === row.label, row.label)
  const missing: WhyMissingLink = {
    kind: 'missing_link',
    reason: 'MISSING_COVERAGE',
    targetKind: 'coverage',
    targetId: row.label,
    coverageKey: null,
    lineage,
  }
  if (row.rangeStartWeek === null || row.rangeEndWeek === null || source.observedAt === null) return missing
  let rangeEnd = row.rangeEndWeek
  if (Date.parse(rangeEnd) <= Date.parse(row.rangeStartWeek)) rangeEnd = ceilToWeek(new Date(Date.parse(row.rangeStartWeek) + 1).toISOString())
  const candidate: WhyCoverageNode = {
    kind: 'coverage',
    coverageKey: { rangeStart: row.rangeStartWeek, jobId: row.jobLabel },
    rangeEnd,
    status: source.status,
    limitationCode: source.limitationCode,
    retryable: source.retryable,
    expectedUnits: source.expectedUnits,
    observedUnits: source.observedUnits,
    omittedUnits: source.omittedUnits,
    saturationReason: source.saturationReason,
    observedAt: floorToWeek(source.observedAt),
    job: { kind: 'collection_job', jobId: row.jobLabel, status: source.jobStatus, consentRevision: source.consentLabel, capability: CAPABILITY_NODE },
  }
  // A stored row that violates the canonical coverage-record invariants is shown as missing
  // furniture rather than silently repaired into a valid-looking node.
  return WhyCoverageNodeSchema.safeParse(candidate).success ? candidate : missing
}

function lineageFor(
  input: ChangeBatchTailInput,
  match: (event: ChangeBatchTailInput['lineage'][number]) => boolean,
  subjectId: string,
): WhyLineageEvent[] {
  return input.lineage.filter(match).map((event) => ({
    kind: 'lineage_event',
    subjectId,
    eventKind: event.eventKind,
    causedBy: event.jobLabel !== null && event.jobLabel !== subjectId ? event.jobLabel : null,
    occurredAt: isoWeekStart(event.eventWeek),
  }))
}

function stratumView(reading: ChangeBatchTailAnalysis['binnings'][number]['strata'][number]) {
  const value = reading.result.value
  const shown = reading.display.display && reading.result.state === 'observed' && value.kind === 'quantiles' && value.quantiles !== null
  return {
    stratumId: reading.stratum?.stratumId ?? 's1',
    label: reading.stratum?.label ?? '',
    lower: reading.stratum?.lower ?? null,
    upper: reading.stratum?.upper ?? null,
    resultId: reading.result.resultId,
    state: reading.result.state,
    displayed: shown,
    displayReasonCode: reading.display.reasonCode,
    eligible: reading.result.counts.eligible,
    merged: reading.merged,
    censored: reading.censored,
    competing: reading.competing,
    // A withheld stratum carries no quantile at all, so nothing below the support gate can render.
    quantiles: shown && value.kind === 'quantiles' && value.quantiles !== null
      ? value.quantiles.map((entry) => ({ quantile: entry.quantile, seconds: entry.value }))
      : null,
    lowerBoundP90: shown ? reading.lowerBoundP90 : null,
  }
}

export function buildChangeBatchTailView(input: ChangeBatchTailInput): ChangeBatchTailView {
  const analysis = analyzeChangeBatchTail(input)
  const marks = buildChangeBatchMarks(analysis)
  const finding = buildChangeBatchFinding(analysis, marks)
  const abstained = analysis.abstention !== null
  const results: MetricResult[] = [analysis.all.result]
  if (!abstained) for (const binning of analysis.binnings) for (const reading of binning.strata) results.push(reading.result)
  return {
    viewVersion: CHANGE_BATCH_TAIL_VIEW_VERSION,
    lensId: CHANGE_BATCH_TAIL_METHOD_ID,
    source: input.source.kind === 'synthetic'
      ? { kind: 'synthetic', marker: CHANGE_BATCH_TAIL_SYNTHETIC_MARKER }
      : { kind: 'selected_v3_store' },
    question: CHANGE_BATCH_QUESTION,
    cohortStatement: CHANGE_BATCH_COHORT_STATEMENT,
    metricReference: CHANGE_BATCH_TAIL_METRIC_REFERENCE,
    decisions: { supported: [...CHANGE_BATCH_DECISIONS.supported], unsupported: [...CHANGE_BATCH_DECISIONS.unsupported] },
    scopeSurrogate: input.scopeSurrogate,
    scope: { hasAlias: input.scope.hasAlias, linkedWeek: input.scope.linkedAt === null ? null : floorToWeek(input.scope.linkedAt) },
    window: { start: input.window.start, end: input.window.end },
    asOf: input.asOf,
    readiness: {
      status: 'not_recorded',
      statement: 'Stored observations record no ready-for-review instant, so every interval here starts at opening; the ready-to-merge integration interval is not derived and opening time is never substituted for it.',
    },
    state: abstained ? 'abstained' : 'presentable',
    abstention: finding.abstention === null || analysis.abstention === null
      ? null
      : {
          reasonCode: analysis.abstention,
          floorCode: finding.abstention.floorCode,
          dimension: finding.abstention.dimension,
          limitingReason: finding.abstention.limitingReason,
          statement: finding.abstention.statement,
        },
    cohort: {
      eligible: analysis.all.result.counts.eligible,
      merged: analysis.all.merged,
      censored: analysis.all.censored,
      competing: analysis.all.competing,
      excluded: analysis.all.result.counts.excluded.map((entry) => ({ reasonCode: entry.reasonCode, count: entry.count })),
      draftsStillOpen: analysis.draftsStillOpen,
    },
    coverage: {
      rows: analysis.coverage.rows.map((row) => ({ ...row })),
      nodes: analysis.coverage.rows.map((row, index) => coverageNodeFor(row, input.coverage[index], input)) as unknown as ChangeBatchTailView['coverage']['nodes'],
      lineage: input.lineage.map((event) => ({ ...event })),
      consentRevisions: analysis.coverage.consentRevisions,
      instrumentRevisions: analysis.coverage.instrumentRevisions,
    },
    binnings: abstained
      ? []
      : analysis.binnings.map((binning) => ({
          basisId: binning.basisId,
          binningId: binning.binningId,
          role: binning.role,
          basisLabel: CHANGE_BATCH_BASES[binning.basisId].label,
          binningLabel: CHANGE_BATCH_BINNINGS[binning.binningId],
          tailOrdering: binning.tailOrdering,
          lowerBoundTailOrdering: binning.lowerBoundTailOrdering,
          strata: binning.strata.map(stratumView),
        })),
    concordance: abstained ? [] : analysis.concordance.map((entry) => ({ ...entry })),
    results,
    finding,
    marks: marks.map((mark) => ({ ...mark, subject: { ...mark.subject } })),
  }
}

/* ------------------------------------------------------------------------------------------ *
 * The Evidence Drawer resolver over a validated view
 * ------------------------------------------------------------------------------------------ */

const WALK_BOUND = 64

function summary(view: ChangeBatchTailView, claimId: string): WhyClaimSummary {
  return {
    claimId,
    layer: 'deterministic',
    statementCode: 'DELIVERY_FLOW',
    methodId: CHANGE_BATCH_TAIL_METHOD_ID,
    methodVersion: CHANGE_BATCH_TAIL_METHOD_VERSION,
    windowStart: view.window.start,
    windowEnd: view.window.end,
    scopeId: view.scopeSurrogate,
    schemaVersion: '1.0.0',
    createdAt: view.asOf,
    supersededBy: null,
  }
}

function walk(relation: WhyWalk['relation'], steps: WhyWalk['steps'] = []): WhyWalk {
  return { kind: 'walk', relation, bound: WALK_BOUND, steps, termination: 'terminal', missingLinks: [] }
}

function coverageNodeFirst(view: ChangeBatchTailView): WhyCoverageNode | WhyMissingLink {
  const vouching = view.coverage.rows.findIndex((row) => row.vouches)
  if (vouching >= 0) return view.coverage.nodes[vouching] as WhyCoverageNode | WhyMissingLink
  if (view.coverage.nodes.length > 0) return view.coverage.nodes[0] as WhyCoverageNode | WhyMissingLink
  return { kind: 'missing_link', reason: 'MISSING_COVERAGE', targetKind: 'coverage', targetId: null, coverageKey: null, lineage: [] }
}

const EVIDENCE_ID = /^ev\.cbt\.(?:all|(lines_changed|changed_files)\.(declared_thresholds|value_thirds)\.(s[123]))\.(opened|merged|open_tail|competing|coverage)$/

function evidenceNode(view: ChangeBatchTailView, evidenceId: string): WhyEvidenceNode | WhyMissingLink {
  const match = EVIDENCE_ID.exec(evidenceId)
  const knownStratum = match === null
    ? false
    : match[1] === undefined || view.binnings.some((binning) => binning.basisId === match[1] && binning.binningId === match[2])
  if (!match || !knownStratum || (match[4] === 'coverage' && match[1] !== undefined)) {
    return { kind: 'missing_link', reason: 'MISSING_EVIDENCE', targetKind: 'evidence', targetId: evidenceId, coverageKey: null, lineage: [] }
  }
  const coverage = coverageNodeFirst(view)
  const coverageLabel = coverage.kind === 'coverage'
    ? view.coverage.rows[(view.coverage.nodes as unknown[]).indexOf(coverage)]?.label ?? null
    : coverage.targetId
  return {
    kind: 'evidence',
    evidenceId,
    layer: 'observed',
    schemaVersion: 'evidence.v2',
    coverage,
    lineage: view.coverage.lineage
      .filter((event) => event.coverageLabel !== null && event.coverageLabel === coverageLabel)
      .map((event) => ({
        kind: 'lineage_event' as const,
        subjectId: event.coverageLabel as string,
        eventKind: event.eventKind,
        causedBy: event.jobLabel,
        occurredAt: isoWeekStart(event.eventWeek),
      })),
  }
}

function evidenceEdge(view: ChangeBatchTailView, role: 'supports' | 'contradicts' | 'contextualizes' | 'limitation_basis', evidenceId: string): WhyEdge {
  const target = evidenceNode(view, evidenceId)
  return { kind: 'edge', role, targetRef: evidenceId, target }
}

function group(role: WhyEdgeGroup['role'], targetKind: WhyEdgeGroup['targetKind'], edges: readonly WhyEdge[]): WhyEdgeGroup {
  return { kind: 'edge_group', role, targetKind, edges }
}

function stratumCounts(view: ChangeBatchTailView, mark: ChangeBatchMark): { censored: number; competing: number } {
  if (mark.subject.stratumId === null) return { censored: view.cohort.censored, competing: view.cohort.competing }
  const binning = view.binnings.find((entry) => entry.basisId === mark.subject.basisId && entry.binningId === mark.subject.binningId)
  const stratum = binning?.strata.find((entry) => entry.stratumId === mark.subject.stratumId)
  return { censored: stratum?.censored ?? 0, competing: stratum?.competing ?? 0 }
}

function claimTree(view: ChangeBatchTailView, mark: ChangeBatchMark): WhyExplanationTree {
  const { basisId, binningId, stratumId, measure } = mark.subject
  const ev = (facet: 'opened' | 'merged' | 'open_tail' | 'competing' | 'coverage'): string =>
    facet === 'coverage' || basisId === 'all' || binningId === 'all'
      ? evidenceIdFor('all', 'all', null, facet)
      : evidenceIdFor(basisId, binningId, stratumId, facet)
  const { censored, competing } = stratumCounts(view, mark)
  const supports: string[] = []
  const contradicts: string[] = []
  const contextualizes: string[] = []
  const limitationBasis: string[] = []
  const derives: ChangeBatchMark[] = []
  switch (measure) {
    case 'eligible':
    case 'excluded':
      supports.push(ev('opened'))
      break
    case 'merged':
      supports.push(ev('merged'))
      break
    case 'censored':
      supports.push(ev('open_tail'))
      break
    case 'competing':
      supports.push(ev('competing'))
      break
    case 'coverage':
      supports.push(ev('coverage'))
      break
    case 'p50':
    case 'p75':
    case 'p90':
    case 'lower_bound_p90':
    case 'concordance': {
      supports.push(ev('merged'))
      if (measure === 'lower_bound_p90' || measure === 'concordance') supports.push(ev('open_tail'))
      if (censored > 0 && measure !== 'lower_bound_p90' && measure !== 'concordance') {
        contradicts.push(ev('open_tail'))
        limitationBasis.push(ev('open_tail'))
      }
      if (competing > 0) contextualizes.push(ev('competing'))
      const base = view.marks.find((candidate) =>
        candidate.subject.measure === 'merged'
        && candidate.subject.basisId === (measure === 'concordance' ? 'all' : basisId)
        && candidate.subject.binningId === (measure === 'concordance' ? 'all' : binningId)
        && candidate.subject.stratumId === (measure === 'concordance' ? null : stratumId))
      if (base !== undefined) derives.push(base)
      break
    }
  }
  const referenceNode = (target: ChangeBatchMark): WhyClaimReferenceNode => ({ kind: 'claim_reference', ...summary(view, target.claimId), expandsWith: 'resolveWhy' })
  const coverageEdges: WhyEdge[] = view.coverage.nodes.map((node, index) => ({
    kind: 'edge',
    role: 'coverage_basis',
    targetRef: view.coverage.rows[index]?.label ?? `coverage-${index + 1}`,
    target: node as WhyCoverageNode | WhyMissingLink,
  }))
  const scopeLineage: WhyLineageEvent[] = view.coverage.lineage
    .filter((event) => event.coverageLabel === null && event.jobLabel === null)
    .map((event) => ({
      kind: 'lineage_event',
      subjectId: mark.claimId,
      eventKind: event.eventKind,
      causedBy: event.subjectKind,
      occurredAt: isoWeekStart(event.eventWeek),
    }))
  return {
    kind: 'explanation',
    resolverVersion: '1.0.0',
    bound: WALK_BOUND,
    element: { kind: 'ui_element', elementId: mark.markId },
    claim: { kind: 'claim', ...summary(view, mark.claimId) },
    scope: {
      kind: 'scope',
      scopeId: view.scopeSurrogate,
      hasAlias: view.scope.hasAlias,
      linkedAt: view.scope.linkedWeek ?? 'unknown',
      aliasLink: view.scope.hasAlias
        ? null
        : { kind: 'missing_link', reason: 'SCOPE_ALIAS_CLEARED', targetKind: 'scope', targetId: view.scopeSurrogate, coverageKey: null, lineage: [] },
    },
    edges: [
      group('supports', 'evidence', supports.map((id) => evidenceEdge(view, 'supports', id))),
      group('contradicts', 'evidence', contradicts.map((id) => evidenceEdge(view, 'contradicts', id))),
      group('contextualizes', 'evidence', contextualizes.map((id) => evidenceEdge(view, 'contextualizes', id))),
      group('derives_from', 'claim', derives.map((target) => ({ kind: 'edge', role: 'derives_from', targetRef: target.claimId, target: referenceNode(target) }))),
      group('coverage_basis', 'coverage', coverageEdges),
      group('limitation_basis', 'evidence', limitationBasis.map((id) => evidenceEdge(view, 'limitation_basis', id))),
    ],
    limitations: view.finding.limitations.map((limitation) => ({ kind: 'limitation', ...limitation })),
    lineage: scopeLineage,
    supersession: walk('supersession'),
    ancestry: walk('derives_from_ancestry', derives.map((target) => ({ kind: 'walk_step', depth: 1, ...summary(view, target.claimId) }))),
    unresolvedEdges: [],
  }
}

/** Total: an unknown claim is an honest `UNKNOWN_CLAIM`, an unknown observation a missing link. */
export function resolveChangeBatchTailReference(view: ChangeBatchTailView, reference: AnalyticReference): ChangeBatchResolution {
  if (reference.kind === 'observation') return evidenceNode(view, reference.evidenceId)
  const mark = view.marks.find((candidate) => candidate.claimId === reference.claimId)
  if (mark === undefined || reference.claimLayer !== 'deterministic') {
    return { kind: 'unresolvable', resolverVersion: '1.0.0', reason: 'UNKNOWN_CLAIM', claimId: reference.claimId, lineage: [] }
  }
  return claimTree(view, mark)
}

/* ------------------------------------------------------------------------------------------ *
 * Acceptance: the gate both the server (before sending) and the browser (before rendering) run
 * ------------------------------------------------------------------------------------------ */

export class ChangeBatchTailViewError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChangeBatchTailViewError'
  }
}

const STORAGE_KEY_PATTERN = /(?:scope|job|snap|ckpt|cov|pr|ev|obs|event|del|op|art|legacy)-[0-9a-f]{64}/
const ISO_INSTANT_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g
const FORBIDDEN_KEYS = ['coverageId', 'coverage_id', 'factId', 'fact_id', 'snapshotId', 'snapshot_id', 'scope_id', 'number', 'mergedAt', 'closedAt', 'additions', 'deletions']

/**
 * Content-free presentation canary: no storage-shaped key, no forbidden field, and every instant
 * is either one of the caller's own bounds or already at ISO-week grain. `extraForbidden` carries
 * the exact identifiers and instants the stored read touched (server side only).
 */
export function assertChangeBatchTailViewPresentationSafe(view: unknown, extraForbidden: readonly string[] = []): void {
  const serialized = JSON.stringify(view)
  if (STORAGE_KEY_PATTERN.test(serialized)) throw new ChangeBatchTailViewError('view transports a storage-shaped identifier')
  for (const key of FORBIDDEN_KEYS) {
    if (serialized.includes(`"${key}"`)) throw new ChangeBatchTailViewError(`view transports a ${key} field`)
  }
  for (const value of extraForbidden) {
    if (value.length > 0 && serialized.includes(value)) throw new ChangeBatchTailViewError('view transports a stored identifier or exact operational instant')
  }
  const parsed = view as { window?: { start?: string; end?: string }; asOf?: string }
  const allowed = new Set([parsed.window?.start, parsed.window?.end, parsed.asOf].filter((value): value is string => typeof value === 'string'))
  for (const instant of serialized.match(ISO_INSTANT_PATTERN) ?? []) {
    if (!allowed.has(instant) && !isWeekAlignedInstant(instant)) {
      throw new ChangeBatchTailViewError('view transports an operational instant finer than ISO-week grain')
    }
  }
}

/**
 * Parse and prove a view: strict schema, registry validation of every metric result, the finding
 * contract, finding↔view mark agreement, and a contract-valid drawer resolution that ANSWERS every
 * mark and every finding reference. Returns the parsed value, never the raw body.
 */
export function acceptChangeBatchTailView(candidate: unknown): ChangeBatchTailView {
  const parsed = ChangeBatchTailViewSchema.safeParse(candidate)
  if (!parsed.success) throw new ChangeBatchTailViewError('view does not satisfy the change-batch view schema')
  const view = parsed.data
  assertChangeBatchTailViewPresentationSafe(view)
  let finding: Finding
  try {
    finding = validateFinding(view.finding)
    for (const result of view.results) validateMetricResult(result)
  } catch {
    throw new ChangeBatchTailViewError('view carries a finding or metric result the registry rejects')
  }
  const resultIds = new Set(view.results.map((result) => result.resultId))
  if (!finding.metricResults.every((reference) => resultIds.has(reference.resultId))) {
    throw new ChangeBatchTailViewError('finding names a metric result the view does not carry')
  }
  if ((finding.layer === 'abstention') !== (view.state === 'abstained')) {
    throw new ChangeBatchTailViewError('view state contradicts the finding layer')
  }
  const markIds = new Set(view.marks.map((mark) => mark.markId))
  const claimIds = new Set(view.marks.map((mark) => mark.claimId))
  if (markIds.size !== view.marks.length || claimIds.size !== view.marks.length) {
    throw new ChangeBatchTailViewError('view marks must be unique by mark and claim')
  }
  for (const mark of finding.marks) {
    const own = view.marks.find((candidateMark) => candidateMark.markId === mark.markId)
    if (own === undefined || mark.reference.kind !== 'claim' || own.claimId !== mark.reference.claimId) {
      throw new ChangeBatchTailViewError('finding mark does not match the view mark it renders')
    }
  }
  const references: AnalyticReference[] = [
    ...view.marks.map((mark) => ({ kind: 'claim' as const, claimId: mark.claimId, claimLayer: 'deterministic' as const })),
    ...finding.evidence,
    ...finding.counterEvidence,
  ]
  for (const reference of references) {
    const resolution = resolveChangeBatchTailReference(view, reference)
    if (!WhyResolutionSchema.safeParse(resolution).success || !whyResolutionAnswersReference(reference, resolution)) {
      throw new ChangeBatchTailViewError('a rendered reference does not resolve to a contract-valid walk')
    }
    if (resolution.kind === 'unresolvable' || resolution.kind === 'missing_link') {
      throw new ChangeBatchTailViewError('a rendered reference resolves to absence furniture')
    }
  }
  return view
}
