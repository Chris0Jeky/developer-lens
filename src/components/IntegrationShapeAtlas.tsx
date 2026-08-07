import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { EvidenceDrawer } from './EvidenceDrawer'
import { useIntegrationShapeEvidenceResolver } from '../lib/evidenceApiResolver'
import {
  secondsToDayLabel,
  type IntegrationShapeOutcomeRow,
  type IntegrationShapePresentation,
} from '../../shared/integrationShape'
import {
  parseIntegrationShapePresentationEnvelope,
  type IntegrationShapePresentationEnvelope,
} from '../../shared/integrationShapeStoredPresentation.js'
import type { AnalyticReference } from '../../shared/findings.js'
import type { ComparisonResult, ResidualSegment } from '../../shared/comparison.js'
import type { Finding } from '../../shared/findings.js'
import type { MetricResult } from '../../shared/metrics.js'
import type { IntegrationShapeEvidenceResolution } from '../../shared/integrationShapeEvidence.js'
import type {
  ChangeBatchIntegrationTailPresentation,
  ChangeBatchStratum,
  ChangeBatchStratumSummary,
  ChangeBatchWindowSummary,
  StoredDeletionLineageSummary,
} from '../../shared/changeBatchIntegrationTail.js'
import './IntegrationShapeAtlas.css'

/**
 * DL-VALUE-01 — the comparative integration-shape Atlas panel. It renders the first deterministic
 * comparative finding end to end: the question, the cohort, the matched-window comparison with its
 * three-outcome honesty, the distribution/tail (never a bare mean), every honest count, the
 * metric-specific coverage, the alternatives and the contradicting evidence, what would
 * discriminate them, a censoring-aware sensitivity variant, and every limitation. Every rendered
 * analytic number is a button that opens the Evidence Drawer and resolves the complete walk.
 *
 * All rendered facts are the invented C1 composition in `shared/integrationShape.ts`. The finding
 * it renders is the same object `server/analysis/integrationShape.ts` proves renderable through
 * `validateFinding`/`assertRenderableFinding`.
 *
 * The one network touch is the Evidence Drawer's resolver: when a mark is opened, the panel tries
 * `/api/v2/evidence/resolve` for that reference and falls back to the identical local composition
 * when the endpoint does not answer (see `lib/evidenceApiResolver.ts`). Nothing else fetches, and
 * the offline public showcase renders exactly the same walk.
 */

const QUANTILE_LABEL: Readonly<Record<number, string>> = { 0.5: 'p50 (median)', 0.75: 'p75', 0.9: 'p90 (tail)' }

/** Window offsets are carried in milliseconds; the panel reads them back as day positions. */
const DAY_MS = 86_400_000

/** A clickable analytic mark: shows its value and opens the drawer on its reference. */
function Mark({
  value,
  reference,
  onOpen,
  label,
}: {
  value: string
  reference: AnalyticReference
  onOpen: (reference: AnalyticReference) => void
  label: string
}) {
  return (
    <button
      type="button"
      className="atlas-mark"
      data-mark-kind={reference.kind}
      aria-label={`${label}: ${value}. Open the evidence walk.`}
      onClick={() => onOpen(reference)}
    >
      <span className="atlas-mark__value">{value}</span>
      <span className="atlas-mark__hint" aria-hidden="true">why?</span>
    </button>
  )
}

function OutcomeBadge({ comparison }: { comparison: ComparisonResult }) {
  const fraction = comparison.matchedFraction === null ? '—' : `${Math.round(comparison.matchedFraction * 1000) / 10}%`
  return (
    <span className="atlas-outcome" data-outcome={comparison.outcome}>
      {comparison.outcome} · matched {fraction}
    </span>
  )
}

function Stage({ id, title, kicker, children }: { id: string; title: string; kicker: string; children: ReactNode }) {
  return (
    <section className="atlas-stage" data-testid={id} aria-label={title}>
      <div className="atlas-stage__head">
        <span className="atlas-stage__kicker">{kicker}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function markReference(finding: Finding, markId: string): AnalyticReference {
  const mark = finding.marks.find((entry) => entry.markId === markId)
  if (!mark) throw new Error(`integration-shape panel is missing mark ${markId}`)
  return mark.reference
}

function DistributionStage({
  comparison,
  finding,
  onOpen,
}: {
  comparison: ComparisonResult
  finding: Finding
  onOpen: (reference: AnalyticReference) => void
}) {
  if (comparison.outcome === 'INCOMPARABLE' || comparison.value.kind !== 'quantile_delta') {
    return <p className="atlas-note">No aligned distribution to difference for this outcome.</p>
  }
  const markIds: Record<number, string> = { 0.5: 'mark_p50_delta', 0.75: 'mark_p75_delta', 0.9: 'mark_p90_delta' }
  return (
    <table className="atlas-table" data-testid="atlas-distribution-table">
      <thead>
        <tr>
          <th scope="col">Quantile</th>
          <th scope="col">Baseline</th>
          <th scope="col">Current</th>
          <th scope="col">Difference</th>
        </tr>
      </thead>
      <tbody>
        {comparison.value.quantiles.map((entry) => (
          <tr key={entry.quantile}>
            <th scope="row">{QUANTILE_LABEL[entry.quantile] ?? `p${entry.quantile * 100}`}</th>
            <td>{secondsToDayLabel(entry.baseline).replace('+', '')}</td>
            <td>{secondsToDayLabel(entry.current).replace('+', '')}</td>
            <td>
              <Mark
                value={secondsToDayLabel(entry.delta)}
                reference={markReference(finding, markIds[entry.quantile] ?? '')}
                onOpen={onOpen}
                label={`${QUANTILE_LABEL[entry.quantile] ?? entry.quantile} difference`}
              />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4}>
            Samples: baseline {comparison.value.baselineSampleSize} merged · current {comparison.value.currentSampleSize} merged.
            The distribution covers merged units only; the censored counts below are part of the reading.
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

function CountsStage({
  current,
  baseline,
  comparison,
  finding,
  onOpen,
}: {
  current: MetricResult
  baseline: MetricResult
  comparison: ComparisonResult
  finding: Finding
  onOpen: (reference: AnalyticReference) => void
}) {
  const eligibleDelta = comparison.outcome === 'INCOMPARABLE' ? null : comparison.counts.eligibleDelta
  const merged = (result: MetricResult): number => (result.value.kind === 'quantiles' ? result.value.sampleSize : 0)
  const excludedTotal = (result: MetricResult): number => result.counts.excluded.reduce((sum, entry) => sum + entry.count, 0)
  return (
    <div className="atlas-counts" data-testid="atlas-counts">
      <dl className="atlas-facts">
        <div>
          <dt>Eligible (current)</dt>
          <dd>
            <Mark value={String(current.counts.eligible)} reference={markReference(finding, 'mark_eligible_current')} onOpen={onOpen} label="Current eligible cohort" />
            {eligibleDelta !== null && <span className="atlas-delta"> (baseline {baseline.counts.eligible}, Δ {eligibleDelta >= 0 ? '+' : ''}{eligibleDelta})</span>}
          </dd>
        </div>
        <div>
          <dt>Merged (in distribution)</dt>
          <dd>{merged(current)} current · {merged(baseline)} baseline</dd>
        </div>
        <div>
          <dt>Right-censored (still open)</dt>
          <dd>
            <Mark value={String(current.counts.censored)} reference={markReference(finding, 'mark_censored_current')} onOpen={onOpen} label="Current right-censored" />
            <span className="atlas-delta"> (baseline {baseline.counts.censored})</span>
          </dd>
        </div>
        <div>
          <dt>Excluded by reason (current)</dt>
          <dd>
            {excludedTotal(current) === 0 ? (
              'none'
            ) : (
              <ul className="atlas-inline-list">
                {current.counts.excluded.map((entry) => (
                  <li key={entry.reasonCode} data-reason={entry.reasonCode}>
                    {entry.reasonCode}: {entry.count}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function CoverageStage({ current }: { current: MetricResult }) {
  return (
    <ul className="atlas-coverage" data-testid="atlas-coverage" aria-label="Metric-specific coverage">
      {current.coverage.map((entry) => (
        <li key={entry.dimension} data-dimension={entry.dimension} data-limited={entry.limiting_reason !== null}>
          <span className="atlas-coverage__dim">{entry.dimension}</span>
          <span className="atlas-coverage__val">{entry.value === null ? '—' : `${Math.round(entry.value * 100)}%`}</span>
          {entry.limiting_reason !== null && <span className="atlas-coverage__reason">{entry.limiting_reason}</span>}
        </li>
      ))}
    </ul>
  )
}

/** The unmatched stretches of a comparable outcome, each naming what disqualified it. */
function ResidualList({ segments }: { segments: readonly ResidualSegment[] }) {
  return (
    <ul className="atlas-outcome-residual" aria-label="Unmatched stretches">
      {segments.map((segment, index) => (
        <li
          key={`${segment.startOffsetMs}:${segment.endOffsetMs}:${index}`}
          data-mismatch-kind={segment.mismatchKind}
          data-dimension={segment.disqualifyingDimension}
        >
          unmatched day {(segment.startOffsetMs / DAY_MS).toFixed(1)}–{(segment.endOffsetMs / DAY_MS).toFixed(1)} · {segment.mismatchKind} ·{' '}
          {segment.disqualifyingDimension}
          {segment.limitingReason !== null ? ` (${segment.limitingReason})` : ''}
        </li>
      ))}
    </ul>
  )
}

function OutcomeTable({ outcomes }: { outcomes: readonly IntegrationShapeOutcomeRow[] }) {
  return (
    <table className="atlas-table" data-testid="atlas-outcome-table">
      <thead>
        <tr>
          <th scope="col">Outcome</th>
          <th scope="col">Matched fraction</th>
          <th scope="col">Reading</th>
        </tr>
      </thead>
      <tbody>
        {outcomes.map((row) => {
          const comparison = row.comparison
          const reading =
            comparison.outcome === 'INCOMPARABLE'
              ? `no comparison: ${comparison.reasonCode}`
              : comparison.value.kind === 'quantile_delta'
                ? `tail difference ${secondsToDayLabel(comparison.value.quantiles[comparison.value.quantiles.length - 1].delta)}`
                : `no value: ${comparison.value.kind === 'no_value' ? comparison.value.reasonCode : comparison.value.kind}`
          return (
            <Fragment key={row.key}>
              <tr data-outcome={comparison.outcome}>
                <th scope="row">{row.label}</th>
                <td>{comparison.matchedFraction === null ? '—' : `${Math.round(comparison.matchedFraction * 1000) / 10}%`}</td>
                <td>{reading}</td>
              </tr>
              {comparison.outcome !== 'INCOMPARABLE' && (
                <tr className="atlas-outcome-detail" data-outcome-detail={comparison.outcome}>
                  <td colSpan={3}>
                    <div className="atlas-outcome-honesty">
                      <p className="atlas-outcome-basis" data-arithmetic-basis={comparison.arithmeticBasis}>
                        Arithmetic basis: <strong>{comparison.arithmeticBasis}</strong>
                        {comparison.arithmeticBasis === 'matched_subwindows_only'
                          ? ' — recomputed over matched subwindows only, not the whole window.'
                          : ' — computed over the whole window.'}
                      </p>
                      <ul className="atlas-outcome-limitations" aria-label="Limitations for this outcome">
                        {comparison.limitations.map((limitation) => (
                          <li key={limitation.code} data-limitation={limitation.code} title={limitation.statement}>
                            <strong>{limitation.code}</strong> — {limitation.statement}
                          </li>
                        ))}
                      </ul>
                      {comparison.residual.length > 0 && <ResidualList segments={comparison.residual} />}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

export function IntegrationShapeAtlasPanel({
  presentation,
  resolutions,
  sourceMode,
}: {
  presentation: IntegrationShapePresentation
  resolutions?: IntegrationShapePresentationEnvelope['resolutions']
  sourceMode?: IntegrationShapePresentationEnvelope['mode']
}) {
  const [drawerReference, setDrawerReference] = useState<AnalyticReference | null>(null)
  const resolveEvidence = useIntegrationShapeEvidenceResolver(drawerReference, resolutions, sourceMode)
  const finding = presentation.finding
  const headline = presentation.headline
  const open = drawerReference !== null

  return (
    <article className="atlas-panel" data-testid="integration-shape-atlas">
      <header className="atlas-panel__head">
        <span className="atlas-panel__eyebrow">Analytical value slice · deterministic finding</span>
        <p className="atlas-panel__observation" data-testid="atlas-observation">
          {finding.observation}
        </p>
        <div className="atlas-panel__meta">
          <OutcomeBadge comparison={headline} />
          <span className="atlas-scope" data-testid="atlas-scope">
            scope surrogate {presentation.scopeId.slice(0, 12)}… · alias stripped at the finding boundary
          </span>
          <span className="atlas-golden" data-golden={presentation.conformsToGolden}>
            {presentation.conformsToGolden ? 'composition conforms to golden' : 'GOLDEN MISMATCH'}
          </span>
        </div>
      </header>

      <Stage id="stage-question" kicker="Question" title="What was asked">
        <p>{presentation.question}</p>
      </Stage>

      <Stage id="stage-cohort" kicker="Cohort" title="Who is in the risk set">
        <p>{presentation.cohortStatement}</p>
      </Stage>

      <Stage id="stage-comparison" kicker="Matched comparison" title="This window vs the preceding matched window">
        <p>
          Two equal-duration, non-overlapping 28-day windows, both complete at the injected asOf. The comparison is{' '}
          <strong>{headline.outcome}</strong> with matched fraction{' '}
          <Mark
            value={headline.matchedFraction === null ? '—' : `${Math.round(headline.matchedFraction * 1000) / 10}%`}
            reference={markReference(finding, 'mark_matched_fraction')}
            onOpen={setDrawerReference}
            label="Matched fraction"
          />
          .
        </p>
        <OutcomeTable outcomes={presentation.outcomes} />
      </Stage>

      <Stage id="stage-distribution" kicker="Distribution / tail" title="Integration interval quantiles (no bare mean)">
        <DistributionStage comparison={headline} finding={finding} onOpen={setDrawerReference} />
      </Stage>

      <Stage id="stage-counts" kicker="Counts" title="Eligible · merged · censored · excluded">
        <CountsStage
          current={presentation.current}
          baseline={presentation.baseline}
          comparison={headline}
          finding={finding}
          onOpen={setDrawerReference}
        />
        <div className="atlas-empty" data-testid="atlas-empty-cohort">
          <h4>Empty-cohort variant (issue #67)</h4>
          <p>
            A fully covered current window that contained zero eligible pull requests reads as an observed zero:
            eligible {presentation.emptyCohort.current.counts.eligible} vs baseline {presentation.baseline.counts.eligible}
            {' '}— a real count difference, and{' '}
            {presentation.emptyCohort.comparison.outcome !== 'INCOMPARABLE' &&
            presentation.emptyCohort.comparison.value.kind === 'no_value'
              ? `no distribution to difference (${presentation.emptyCohort.comparison.value.reasonCode}).`
              : 'a typed absence of a distribution delta.'}
          </p>
        </div>
      </Stage>

      <Stage id="stage-coverage" kicker="Coverage" title="Metric-specific coverage vector">
        <CoverageStage current={presentation.current} />
      </Stage>

      <Stage id="stage-alternatives" kicker="Alternatives" title="What else could explain this">
        <ul className="atlas-list" data-testid="atlas-alternatives">
          {finding.alternativeExplanations.map((alternative) => (
            <li key={alternative.code} data-code={alternative.code}>
              <strong>{alternative.code}</strong> — {alternative.statement}
            </li>
          ))}
        </ul>
        {finding.discriminatingEvidence !== null && (
          <p className="atlas-discriminating" data-testid="atlas-discriminating">
            <strong>What would discriminate:</strong> {finding.discriminatingEvidence.statement}
          </p>
        )}
      </Stage>

      <Stage id="stage-counter-evidence" kicker="Contradicting evidence" title="Evidence that cuts the other way">
        <ul className="atlas-list" data-testid="atlas-counter-evidence">
          {finding.counterEvidence.map((reference) => (
            <li key={reference.kind === 'observation' ? reference.evidenceId : reference.claimId}>
              <Mark
                value="open-tail observation"
                reference={reference}
                onOpen={setDrawerReference}
                label="Contradicting evidence"
              />
              {' '}— the pull requests still open at the current boundary, whose eventual merge could raise the current distribution.
            </li>
          ))}
        </ul>
      </Stage>

      <Stage id="stage-sensitivity" kicker="Sensitivity" title="How stable is the reading">
        <p data-testid="atlas-robustness" data-status={finding.robustness.status}>
          Robustness: <strong>{finding.robustness.status}</strong>.
        </p>
        <table className="atlas-table" data-testid="atlas-sensitivity">
          <caption>{presentation.sensitivity.label}: open pull requests added at their observed lower bound.</caption>
          <thead>
            <tr>
              <th scope="col">Quantile</th>
              <th scope="col">Headline Δ</th>
              <th scope="col">Sensitivity Δ</th>
            </tr>
          </thead>
          <tbody>
            {presentation.sensitivity.quantiles.map((entry, index) => {
              const headlineDelta =
                headline.outcome !== 'INCOMPARABLE' && headline.value.kind === 'quantile_delta'
                  ? headline.value.quantiles[index]?.delta ?? 0
                  : 0
              return (
                <tr key={entry.quantile}>
                  <th scope="row">{QUANTILE_LABEL[entry.quantile] ?? `p${entry.quantile * 100}`}</th>
                  <td>{secondsToDayLabel(headlineDelta)}</td>
                  <td data-reversed={Math.sign(entry.delta) !== Math.sign(headlineDelta) && entry.delta !== 0}>
                    {secondsToDayLabel(entry.delta)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <ul className="atlas-list">
          {finding.robustness.checks.map((check) => (
            <li key={check.checkId} data-check={check.checkId} data-outcome={check.outcome}>
              <strong>{check.checkId}</strong> ({check.outcome}) — {check.statement}
            </li>
          ))}
        </ul>
      </Stage>

      <Stage id="stage-limitations" kicker="Limitations" title="Every limitation, rendered">
        <ul className="atlas-list" data-testid="atlas-limitations">
          {headline.outcome !== 'INCOMPARABLE' &&
            headline.limitations.map((limitation) => (
              <li key={limitation.code} data-limitation={limitation.code}>
                <strong>{limitation.code}</strong> — {limitation.statement}
              </li>
            ))}
          {finding.limitations.map((limitation) => (
            <li key={`${limitation.limitationCode}:${limitation.dimension}`} data-limitation={limitation.limitationCode}>
              <strong>{limitation.limitationCode}</strong> · {limitation.dimension}
            </li>
          ))}
        </ul>
        <div className="atlas-never" data-testid="atlas-prohibited">
          <h4>What this must never mean</h4>
          <ul className="atlas-list">
            {finding.prohibitedInterpretations.map((entry) => (
              <li key={entry.code} data-code={entry.code}>
                {entry.statement}
              </li>
            ))}
          </ul>
        </div>
      </Stage>

      <Stage id="stage-abstention" kicker="Abstention" title="When support forces a withheld reading">
        <p data-testid="atlas-abstention">
          A current window whose merged sample falls below the metric's minimum support does not render a range: the
          finding abstains ({presentation.abstentionFinding.presentationEligibility.reasonCode}). The comparison itself
          returns{' '}
          {presentation.abstention.comparison.outcome !== 'INCOMPARABLE' &&
          presentation.abstention.comparison.value.kind === 'no_value'
            ? presentation.abstention.comparison.value.reasonCode
            : 'a withheld value'}
          . {presentation.abstentionFinding.abstention?.statement}
        </p>
      </Stage>

      <EvidenceDrawer
        open={open}
        reference={drawerReference ?? { kind: 'claim', claimId: '', claimLayer: 'deterministic' }}
        resolve={resolveEvidence}
        onClose={() => setDrawerReference(null)}
        discriminatingQuestion={finding.discriminatingEvidence?.statement ?? null}
      />
    </article>
  )
}

function tailValue(summary: ChangeBatchStratumSummary, quantile: number): number | null {
  return summary.integrationTail.quantiles?.find((entry) => entry.quantile === quantile)?.value ?? null
}

function StoredNumber({
  value,
  reference,
  onOpen,
  label,
  duration = false,
}: {
  value: number | null
  reference: AnalyticReference
  onOpen: (reference: AnalyticReference) => void
  label: string
  duration?: boolean
}) {
  if (value === null) return <>â€”</>
  return (
    <Mark
      value={duration ? secondsToDayLabel(value) : String(value)}
      reference={reference}
      onOpen={onOpen}
      label={label}
    />
  )
}

function windowStratum(
  summary: ChangeBatchWindowSummary,
  stratum: ChangeBatchStratum,
): ChangeBatchStratumSummary {
  const row = summary.strata.find((entry) => entry.stratum === stratum)
  if (row === undefined) throw new Error(`stored observation is missing ${stratum} stratum`)
  return row
}

function StoredWindowCounts({
  label,
  summary,
  reference,
  onOpen,
}: {
  label: string
  summary: ChangeBatchWindowSummary
  reference: AnalyticReference
  onOpen: (reference: AnalyticReference) => void
}) {
  return (
    <div>
      <dt>{label} Â· {summary.weekLabels.start} â†’ {summary.weekLabels.end}</dt>
      <dd>
        ready and sized{' '}
        <StoredNumber value={summary.eligible} reference={reference} onOpen={onOpen} label={`${label} ready and sized`} />
        {' '}Â· excluded{' '}
        <StoredNumber value={summary.excluded} reference={reference} onOpen={onOpen} label={`${label} excluded`} />
        {' '}Â· open/censored{' '}
        <StoredNumber value={summary.censored} reference={reference} onOpen={onOpen} label={`${label} censored`} />
        {' '}Â· close without merge{' '}
        <StoredNumber value={summary.competing} reference={reference} onOpen={onOpen} label={`${label} competing outcomes`} />
        {' '}Â· missing batch size{' '}
        <StoredNumber value={summary.missingSizeExcluded} reference={reference} onOpen={onOpen} label={`${label} missing batch size`} />
      </dd>
    </div>
  )
}

function descriptiveDirection(summary: ChangeBatchWindowSummary): string {
  const lower = tailValue(windowStratum(summary, 'lower'), 0.9)
  const upper = tailValue(windowStratum(summary, 'upper'), 0.9)
  if (lower === null || upper === null || lower === upper) {
    return 'The upper and lower value thirds do not separate at the reported tail.'
  }
  return upper > lower
    ? 'The upper value third has the longer reported integration tail in this window.'
    : 'The lower value third has the longer reported integration tail in this window.'
}

/** Phase E's live/synthetic second lens, consuming one strict stored-observation presentation. */
export function ChangeBatchIntegrationTailPanel({
  presentation,
  finding,
  resolutions,
  sourceMode,
}: {
  presentation: ChangeBatchIntegrationTailPresentation
  finding: Finding
  resolutions: Readonly<Record<string, IntegrationShapeEvidenceResolution>>
  sourceMode: IntegrationShapePresentationEnvelope['mode']
}) {
  const [drawerReference, setDrawerReference] = useState<AnalyticReference | null>(null)
  const resolveEvidence = useIntegrationShapeEvidenceResolver(drawerReference, resolutions, sourceMode)
  const cohortReference = markReference(finding, 'mark_integration_tail_cohort')
  const stratumReference = (stratum: ChangeBatchStratum) =>
    markReference(finding, `mark_integration_tail_${stratum}`)
  const sensitivityReference = markReference(finding, 'mark_integration_tail_changed_files')

  return (
    <article className="atlas-panel" data-testid="change-batch-integration-tail">
      <header className="atlas-panel__head">
        <span className="atlas-panel__eyebrow">Stored observation Â· change batch / integration tail</span>
        <p className="atlas-panel__observation">{finding.observation}</p>
        <div className="atlas-panel__meta">
          <span className="atlas-scope">scope surrogate {presentation.scopeId.slice(0, 12)}â€¦</span>
          <span className="atlas-golden">{sourceMode === 'synthetic' ? 'invented public corpus' : 'accepted selected store'}</span>
        </div>
      </header>

      <Stage id="stored-question" kicker="Question" title="Do larger change batches carry a longer integration tail?">
        <p>
          Primary batch value is additions plus deletions. Changed-file count is the sensitivity basis.
          Pull requests enter when they became ready for review; open work is right-censored and a close
          without merge is a competing terminal outcome.
        </p>
        <p data-testid="stored-direction">{descriptiveDirection(presentation.current)}</p>
      </Stage>

      <Stage id="stored-counts" kicker="Cohort" title="Support, exclusions, censoring and missingness">
        <dl className="atlas-facts">
          <StoredWindowCounts label="Current" summary={presentation.current} reference={cohortReference} onOpen={setDrawerReference} />
          <StoredWindowCounts label="Baseline" summary={presentation.baseline} reference={cohortReference} onOpen={setDrawerReference} />
        </dl>
      </Stage>

      <Stage id="stored-deletion-lineage" kicker="Lineage" title="Deletion and tombstone history">
        {presentation.deletionLineage.status === 'present' ? (
          <ul className="atlas-list">
            {presentation.deletionLineage.events.map((event) => (
              <li key={`${event.week}:${event.eventKind}:${event.subjectKind}`}>
                {event.eventKind} for {event.subjectKind} in {event.week}:{' '}
                <StoredNumber
                  value={event.count}
                  reference={cohortReference}
                  onOpen={setDrawerReference}
                  label={`${event.eventKind} ${event.subjectKind} lineage events in ${event.week}`}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {presentation.deletionLineage.status === 'none_recorded'
              ? 'No deletion or tombstone lineage is recorded for this scope.'
              : 'Deletion and tombstone lineage is unavailable, so no clean absence is claimed.'}
          </p>
        )}
      </Stage>

      <Stage id="stored-primary" kicker="Primary basis" title="Additions plus deletions Â· value thirds with ties kept together">
        <table className="atlas-table" data-testid="stored-primary-table">
          <thead>
            <tr>
              <th scope="col">Window / third</th>
              <th scope="col">Batch range</th>
              <th scope="col">n</th>
              <th scope="col">excluded</th>
              <th scope="col">censored</th>
              <th scope="col">competing</th>
              <th scope="col">p50</th>
              <th scope="col">p75</th>
              <th scope="col">p90 tail</th>
            </tr>
          </thead>
          <tbody>
            {(['current', 'baseline'] as const).flatMap((windowKey) =>
              (['lower', 'middle', 'upper'] as const).map((stratum) => {
                const row = windowStratum(presentation[windowKey], stratum)
                const reference = stratumReference(stratum)
                const prefix = `${windowKey} ${stratum}`
                return (
                  <tr key={`${windowKey}:${stratum}`} data-window={windowKey} data-stratum={stratum}>
                    <th scope="row">{windowKey} Â· {stratum}</th>
                    <td>
                      <StoredNumber value={row.minChange} reference={reference} onOpen={setDrawerReference} label={`${prefix} minimum batch value`} />
                      {' '}â€“{' '}
                      <StoredNumber value={row.maxChange} reference={reference} onOpen={setDrawerReference} label={`${prefix} maximum batch value`} />
                    </td>
                    <td><StoredNumber value={row.n} reference={reference} onOpen={setDrawerReference} label={`${prefix} cohort`} /></td>
                    <td><StoredNumber value={row.excluded} reference={reference} onOpen={setDrawerReference} label={`${prefix} excluded`} /></td>
                    <td><StoredNumber value={row.censored} reference={reference} onOpen={setDrawerReference} label={`${prefix} censored`} /></td>
                    <td><StoredNumber value={row.competing} reference={reference} onOpen={setDrawerReference} label={`${prefix} competing`} /></td>
                    {[0.5, 0.75, 0.9].map((quantile) => (
                      <td key={quantile}>
                        <StoredNumber
                          value={tailValue(row, quantile)}
                          reference={reference}
                          onOpen={setDrawerReference}
                          label={`${prefix} p${quantile * 100}`}
                          duration
                        />
                      </td>
                    ))}
                  </tr>
                )
              }),
            )}
          </tbody>
        </table>
      </Stage>

      <Stage id="stored-sensitivity" kicker="Sensitivity" title="Changed-file value thirds">
        <p data-testid="stored-robustness" data-status={finding.robustness.status}>
          {finding.robustness.checks[0]?.statement} Outcome: <strong>{finding.robustness.checks[0]?.outcome}</strong>.
        </p>
        <table className="atlas-table" data-testid="stored-sensitivity-table">
          <thead>
            <tr><th scope="col">Third</th><th scope="col">Current p90</th><th scope="col">Baseline p90</th><th scope="col">Current n</th></tr>
          </thead>
          <tbody>
            {(['lower', 'middle', 'upper'] as const).map((stratum) => {
              const current = windowStratum(presentation.sensitivity.current, stratum)
              const baseline = windowStratum(presentation.sensitivity.baseline, stratum)
              return (
                <tr key={stratum}>
                  <th scope="row">{stratum}</th>
                  <td><StoredNumber value={tailValue(current, 0.9)} reference={sensitivityReference} onOpen={setDrawerReference} label={`${stratum} changed-files current tail`} duration /></td>
                  <td><StoredNumber value={tailValue(baseline, 0.9)} reference={sensitivityReference} onOpen={setDrawerReference} label={`${stratum} changed-files baseline tail`} duration /></td>
                  <td><StoredNumber value={current.n} reference={sensitivityReference} onOpen={setDrawerReference} label={`${stratum} changed-files current cohort`} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Stage>

      <Stage id="stored-provenance" kicker="Evidence" title="Coverage and provenance carried with the reading">
        <p>
          Capability <strong>{presentation.capabilityId}</strong> Â· consent revision <strong>{presentation.consentRevision}</strong>.
          Coverage is {presentation.provenance.current.coverage.status}: expected{' '}
          <StoredNumber value={presentation.provenance.current.coverage.expectedUnits} reference={cohortReference} onOpen={setDrawerReference} label="Current expected coverage units" />
          {' '}and observed{' '}
          <StoredNumber value={presentation.provenance.current.coverage.observedUnits} reference={cohortReference} onOpen={setDrawerReference} label="Current observed coverage units" />.
        </p>
        <p data-testid="stored-fact-provenance-limitation">
          Limitation: the current schema records aggregate job, snapshot and coverage proof, but pull-request facts do not yet carry a per-fact job edge.
        </p>
      </Stage>

      <Stage id="stored-alternatives" kicker="Alternatives" title="What else could shape the pattern">
        <ul className="atlas-list">
          {finding.alternativeExplanations.map((alternative) => (
            <li key={alternative.code}><strong>{alternative.code}</strong> â€” {alternative.statement}</li>
          ))}
        </ul>
        <p><strong>What would discriminate:</strong> {finding.discriminatingEvidence?.statement}</p>
      </Stage>

      <Stage id="stored-decision" kicker="Decision use" title="Useful for investigation, never for scoring">
        <p>
          This lens can support a decision to inspect review flow, release timing, or coordination around larger change batches.
          It cannot establish causality, rate quality, set a target, or evaluate a person.
        </p>
        <ul className="atlas-list">
          {finding.prohibitedInterpretations.map((entry) => <li key={entry.code}>{entry.statement}</li>)}
        </ul>
      </Stage>

      <EvidenceDrawer
        open={drawerReference !== null}
        reference={drawerReference ?? { kind: 'claim', claimId: '', claimLayer: 'deterministic' }}
        resolve={resolveEvidence}
        onClose={() => setDrawerReference(null)}
        discriminatingQuestion={finding.discriminatingEvidence?.statement ?? null}
      />
    </article>
  )
}

function StoredObservationAbstention({
  code,
  finding,
  deletionLineage,
}: {
  code: string
  finding: Finding
  deletionLineage: StoredDeletionLineageSummary
}) {
  return (
    <section className="atlas-route__status" data-testid="stored-observation-abstention" role="status">
      <span className="atlas-panel__eyebrow">Stored observation Â· abstained</span>
      <h1>No change-batch reading is shown.</h1>
      <p data-testid="stored-observation-abstention-code">{code}</p>
      <p>{finding.abstention?.statement ?? finding.observation}</p>
      <p>Deletion lineage: {deletionLineage.status.replaceAll('_', ' ')}.</p>
    </section>
  )
}

export function atlasPresentationEndpoint(
  staticDemo = import.meta.env.VITE_STATIC_DEMO === 'true',
  baseUrl = import.meta.env.BASE_URL,
): string {
  return staticDemo ? `${baseUrl}data/integration-shape.json` : '/api/v2/analysis/integration-shape'
}

function AtlasUnavailable() {
  return (
    <section className="atlas-route__status" data-testid="integration-shape-unavailable" role="status">
      <span className="atlas-panel__eyebrow">Integration shape Atlas · unavailable</span>
      <h1>The Atlas presentation is unavailable.</h1>
      <p>
        The selected presentation could not be loaded or did not satisfy its contract. This view abstains rather than
        showing a local synthetic fallback.
      </p>
    </section>
  )
}

function AtlasLoading() {
  return (
    <section className="atlas-route__status" data-testid="integration-shape-loading" role="status" aria-live="polite">
      <span className="atlas-panel__eyebrow">Integration shape Atlas · loading</span>
      <h1>Loading the stored Atlas presentation…</h1>
      <p>Reading the selected local presentation. No conclusion is shown until it is available.</p>
    </section>
  )
}

/** The route entry: fetches an explicit stored presentation and abstains on any failure. */
export function IntegrationShapeAtlasRoute() {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ready'; envelope: IntegrationShapePresentationEnvelope }
    | { kind: 'unavailable' }
  >({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    const staticDemo = import.meta.env.VITE_STATIC_DEMO === 'true'

    setState({ kind: 'loading' })
    fetch(atlasPresentationEndpoint(staticDemo), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`integration-shape presentation returned ${response.status}`)
        return parseIntegrationShapePresentationEnvelope(await response.json())
      })
      .then((envelope) => setState({ kind: 'ready', envelope }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setState({ kind: 'unavailable' })
      })

    return () => controller.abort()
  }, [])

  let content: ReactNode
  if (state.kind === 'loading') {
    content = <AtlasLoading />
  } else if (state.kind === 'unavailable') {
    content = <AtlasUnavailable />
  } else {
    const stored = state.envelope.storedObservation
    content = (
      <>
        {state.envelope.presentation !== null && (
          <IntegrationShapeAtlasPanel
            presentation={state.envelope.presentation}
            resolutions={state.envelope.resolutions}
            sourceMode={state.envelope.mode}
          />
        )}
        {stored.status === 'complete' ? (
          <ChangeBatchIntegrationTailPanel
            presentation={stored.presentation}
            finding={stored.finding}
            resolutions={state.envelope.resolutions}
            sourceMode={state.envelope.mode}
          />
        ) : (
          <StoredObservationAbstention code={stored.code} finding={stored.finding} deletionLineage={stored.deletionLineage} />
        )}
      </>
    )
  }

  return (
    <div className="app atlas-route" id="top">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />
      <header className="app-header">
        <a className="atlas-route__brand" href="?">
          ← Developer Lens · integration shape
        </a>
        <span className="local-pill local-pill--public">
          {state.kind === 'ready' && state.envelope.mode === 'selected_store' ? 'Selected store' : 'Stored presentation'}
        </span>
      </header>
      <main className="atlas-route__main">
        {content}
      </main>
    </div>
  )
}
