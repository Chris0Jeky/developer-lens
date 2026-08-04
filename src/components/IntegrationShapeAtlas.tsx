import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { EvidenceDrawer } from './EvidenceDrawer'
import { resolveIntegrationShapeEvidence } from '../../shared/integrationShapeEvidence'
import {
  buildIntegrationShapePresentation,
  secondsToDayLabel,
  type IntegrationShapeOutcomeRow,
  type IntegrationShapePresentation,
} from '../../shared/integrationShape'
import type { AnalyticReference } from '../../shared/findings.js'
import type { ComparisonResult } from '../../shared/comparison.js'
import type { Finding } from '../../shared/findings.js'
import type { MetricResult } from '../../shared/metrics.js'
import './IntegrationShapeAtlas.css'

/**
 * DL-VALUE-01 — the comparative integration-shape Atlas panel. It renders the first deterministic
 * comparative finding end to end: the question, the cohort, the matched-window comparison with its
 * three-outcome honesty, the distribution/tail (never a bare mean), every honest count, the
 * metric-specific coverage, the alternatives and the contradicting evidence, what would
 * discriminate them, a censoring-aware sensitivity variant, and every limitation. Every rendered
 * analytic number is a button that opens the Evidence Drawer and resolves the complete walk.
 *
 * All facts are the invented C1 composition in `shared/integrationShape.ts`; the panel never
 * fetches. The finding it renders is the same object `server/analysis/integrationShape.ts` proves
 * renderable through `validateFinding`/`assertRenderableFinding`.
 */

const QUANTILE_LABEL: Readonly<Record<number, string>> = { 0.5: 'p50 (median)', 0.75: 'p75', 0.9: 'p90 (tail)' }

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
            <tr key={row.key} data-outcome={comparison.outcome}>
              <th scope="row">{row.label}</th>
              <td>{comparison.matchedFraction === null ? '—' : `${Math.round(comparison.matchedFraction * 1000) / 10}%`}</td>
              <td>{reading}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function IntegrationShapeAtlasPanel({ presentation }: { presentation: IntegrationShapePresentation }) {
  const [drawerReference, setDrawerReference] = useState<AnalyticReference | null>(null)
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
        resolve={resolveIntegrationShapeEvidence}
        onClose={() => setDrawerReference(null)}
        discriminatingQuestion={finding.discriminatingEvidence?.statement ?? null}
      />
    </article>
  )
}

/** The route entry: computes the composition once and renders the panel. Never fetches. */
export function IntegrationShapeAtlasRoute() {
  const presentation = useMemo(() => buildIntegrationShapePresentation(), [])
  return (
    <div className="app atlas-route" id="top">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />
      <header className="app-header">
        <span className="atlas-route__brand">Developer Lens · integration shape</span>
        <span className="local-pill local-pill--public">Invented C1 · offline</span>
      </header>
      <main className="atlas-route__main">
        <IntegrationShapeAtlasPanel presentation={presentation} />
      </main>
    </div>
  )
}
