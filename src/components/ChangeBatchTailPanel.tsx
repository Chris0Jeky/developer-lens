import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { EvidenceDrawer } from './EvidenceDrawer'
import {
  resolveChangeBatchTailReference,
  type ChangeBatchTailView,
} from '../../shared/changeBatchTailView'
import type { AnalyticReference } from '../../shared/findings.js'
import { isoWeekLabel } from '../../shared/presentationGrain'
import type { ChangeBatchTailSource } from '../lib/changeBatchTailSource'
import './IntegrationShapeAtlas.css'

/**
 * Phase E (#174) — the second evidence-aware lens on the Atlas surface: change-batch size versus
 * the opened-to-merge tail. It renders a gated `ChangeBatchTailView` — the explicitly synthetic
 * one offline and in the showcase, or a stored one when the default-off local endpoint serves a
 * view that passed every gate. Every rendered number is a mark whose claim reference opens the
 * Evidence Drawer on a walk resolved from the same view; a withheld stratum renders no number.
 * Copy stays on the queue and the cohort — never on a person, never on a cause.
 */

type Subject = ChangeBatchTailView['marks'][number]['subject']

const QUANTILE_LABELS: Readonly<Record<'p50' | 'p75' | 'p90', string>> = { p50: 'p50', p75: 'p75', p90: 'p90 (tail)' }

function days(seconds: number): string {
  return `${(seconds / 86_400).toFixed(1)} d`
}

function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

function Stage({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: ReactNode }) {
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

function sameSubject(left: Subject, right: Subject): boolean {
  return left.basisId === right.basisId
    && left.binningId === right.binningId
    && left.stratumId === right.stratumId
    && left.measure === right.measure
    && left.detail === right.detail
}

export function ChangeBatchTailPanel({ view, source }: { view: ChangeBatchTailView; source?: ChangeBatchTailSource }) {
  const [reference, setReference] = useState<AnalyticReference | null>(null)
  const resolve = useCallback((target: AnalyticReference) => resolveChangeBatchTailReference(view, target), [view])

  /** A number is rendered ONLY through its mark; a subject without a mark renders nothing. */
  const Mark = ({ subject, value }: { subject: Subject; value: string }) => {
    const mark = view.marks.find((candidate) => sameSubject(candidate.subject, subject))
    if (mark === undefined) return <span className="atlas-note">not shown</span>
    return (
      <button
        type="button"
        className="atlas-mark"
        data-mark-kind="claim"
        data-mark-id={mark.markId}
        aria-label={`${mark.statement} Value ${value}. Open the evidence walk.`}
        onClick={() => setReference({ kind: 'claim', claimId: mark.claimId, claimLayer: 'deterministic' })}
      >
        <span className="atlas-mark__value">{value}</span>
        <span className="atlas-mark__hint" aria-hidden="true">why?</span>
      </button>
    )
  }

  const all = (measure: Subject['measure'], detail: string | null = null): Subject => ({ basisId: 'all', binningId: 'all', stratumId: null, measure, detail })
  const finding = view.finding
  const synthetic = view.source.kind === 'synthetic'

  return (
    <article className="atlas-panel" data-testid="change-batch-tail" data-source={view.source.kind} data-state={view.state}>
      <header className="atlas-panel__head">
        <span className="atlas-panel__eyebrow">Second lens · change-batch size versus integration tail</span>
        <p className="atlas-panel__observation" data-testid="change-batch-observation">{finding.observation}</p>
        <div className="atlas-panel__meta">
          <span className="atlas-outcome" data-testid="change-batch-source">
            {synthetic ? 'Invented C1 · synthetic public view' : 'Selected v3 store · stored observations'}
          </span>
          {source?.canRequestStored && (
            <span className="atlas-scope" data-testid="change-batch-stored-control" data-status={source.status}>
              {source.status === 'stored' ? 'serving the selected local store' : (
                <>
                  <button type="button" className="atlas-mark" onClick={source.requestStored} disabled={source.status === 'loading'}>
                    <span className="atlas-mark__value">read the selected local store</span>
                  </button>
                  {source.status === 'not_served' && ' — no stored reading is served (the endpoint is off by default); showing the synthetic view'}
                </>
              )}
            </span>
          )}
          <span className="atlas-scope">scope surrogate {view.scopeSurrogate.slice(0, 18)}… · window {isoWeekLabel(view.window.start)} to {isoWeekLabel(view.window.end)}</span>
        </div>
      </header>

      <Stage id="cbt-question" kicker="Question" title="What is asked of this queue">
        <p>{view.question}</p>
        <p>{view.cohortStatement}</p>
        <p className="atlas-note" data-testid="change-batch-readiness">{view.readiness.statement}</p>
      </Stage>

      <Stage id="cbt-decisions" kicker="Decisions" title="What this reading can and cannot decide">
        <div className="atlas-counts">
          <h4>Supported</h4>
          <ul className="atlas-list" data-testid="change-batch-supported">
            {view.decisions.supported.map((entry) => <li key={entry}>{entry}</li>)}
          </ul>
          <h4>Not supported</h4>
          <ul className="atlas-list" data-testid="change-batch-unsupported">
            {view.decisions.unsupported.map((entry) => <li key={entry}>{entry}</li>)}
          </ul>
        </div>
      </Stage>

      <Stage id="cbt-cohort" kicker="Counts" title="Opened · merged · still open · closed without merge · excluded">
        <dl className="atlas-facts" data-testid="change-batch-cohort">
          <div><dt>Opened in window (eligible)</dt><dd><Mark subject={all('eligible')} value={String(view.cohort.eligible)} /></dd></div>
          <div><dt>Merged before the window end</dt><dd><Mark subject={all('merged')} value={String(view.cohort.merged)} /></dd></div>
          <div><dt>Still open at the end (right-censored)</dt><dd><Mark subject={all('censored')} value={String(view.cohort.censored)} /></dd></div>
          <div><dt>Closed without merge (competing outcome)</dt><dd><Mark subject={all('competing')} value={String(view.cohort.competing)} /></dd></div>
          <div>
            <dt>Excluded by reason</dt>
            <dd>
              {view.cohort.excluded.length === 0 ? 'none' : (
                <ul className="atlas-inline-list">
                  {view.cohort.excluded.map((entry) => (
                    <li key={entry.reasonCode} data-reason={entry.reasonCode}>
                      {entry.reasonCode}: <Mark subject={all('excluded', entry.reasonCode)} value={String(entry.count)} />
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      </Stage>

      {view.abstention !== null ? (
        <Stage id="cbt-abstention" kicker="Abstention" title="Why this reading is withheld">
          <p data-testid="change-batch-abstention" data-reason={view.abstention.reasonCode}>
            <strong>{view.abstention.reasonCode}</strong> ({view.abstention.floorCode}, {view.abstention.dimension}: {view.abstention.limitingReason}) — {view.abstention.statement}
          </p>
          <button
            type="button"
            className="atlas-mark"
            data-mark-kind="observation"
            onClick={() => setReference({ kind: 'observation', evidenceId: 'ev.cbt.all.coverage' })}
          >
            <span className="atlas-mark__value">coverage basis</span>
            <span className="atlas-mark__hint" aria-hidden="true">why?</span>
          </button>
        </Stage>
      ) : (
        <>
          <Stage id="cbt-distribution" kicker="Distribution / tail" title="Opened-to-merge quantiles per change-size stratum">
            {view.binnings.filter((binning) => binning.role === 'primary').map((binning) => (
              <table className="atlas-table" data-testid="change-batch-primary" key={`${binning.basisId}.${binning.binningId}`}>
                <caption>{binning.basisLabel} · {binning.binningLabel}</caption>
                <thead>
                  <tr>
                    <th scope="col">Stratum</th>
                    <th scope="col">Opened</th>
                    <th scope="col">Merged</th>
                    <th scope="col">Still open</th>
                    <th scope="col">Closed unmerged</th>
                    {(['p50', 'p75', 'p90'] as const).map((measure) => <th scope="col" key={measure}>{QUANTILE_LABELS[measure]}</th>)}
                    <th scope="col">p90 with open at lower bound</th>
                  </tr>
                </thead>
                <tbody>
                  {binning.strata.map((stratum) => {
                    const subject = (measure: Subject['measure']): Subject => ({ basisId: binning.basisId, binningId: binning.binningId, stratumId: stratum.stratumId, measure, detail: null })
                    return (
                      <tr key={stratum.stratumId} data-stratum={stratum.stratumId} data-displayed={stratum.displayed}>
                        <th scope="row">{stratum.label}</th>
                        <td><Mark subject={subject('eligible')} value={String(stratum.eligible)} /></td>
                        <td><Mark subject={subject('merged')} value={String(stratum.merged)} /></td>
                        <td><Mark subject={subject('censored')} value={String(stratum.censored)} /></td>
                        <td><Mark subject={subject('competing')} value={String(stratum.competing)} /></td>
                        {stratum.quantiles === null ? (
                          <td colSpan={4} className="atlas-note" data-withheld={stratum.displayReasonCode}>
                            withheld ({stratum.displayReasonCode}); a stratum needs five merged pull requests before any quantile is shown
                          </td>
                        ) : (
                          <>
                            {stratum.quantiles.map((entry) => {
                              const measure = entry.quantile === 0.5 ? 'p50' : entry.quantile === 0.75 ? 'p75' : 'p90'
                              return <td key={entry.quantile}><Mark subject={subject(measure)} value={days(entry.seconds)} /></td>
                            })}
                            <td>{stratum.lowerBoundP90 === null ? '—' : <Mark subject={subject('lower_bound_p90')} value={days(stratum.lowerBoundP90)} />}</td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ))}
            <p className="atlas-note">
              The distribution covers merged pull requests only; still-open and closed-without-merge counts sit beside it and
              are part of the reading. The interval starts at opening, so any draft time is inside it.
            </p>
          </Stage>

          <Stage id="cbt-rank" kicker="Continuous rank" title="Does batch size track time to merge across the whole cohort?">
            <ul className="atlas-list" data-testid="change-batch-concordance">
              {view.concordance.map((entry) => (
                <li key={entry.basisId} data-basis={entry.basisId} data-reason={entry.reasonCode}>
                  {entry.basisId === 'lines_changed' ? 'Lines added plus deleted' : 'Changed files'}:{' '}
                  {entry.shown && entry.value !== null
                    ? <Mark subject={{ basisId: entry.basisId, binningId: 'all', stratumId: null, measure: 'concordance', detail: null }} value={entry.value.toFixed(3)} />
                    : <span className="atlas-note">withheld ({entry.reasonCode})</span>}
                </li>
              ))}
            </ul>
            <p className="atlas-note">
              Harrell concordance: the share of comparable pairs in which the smaller batch merged first. 0.5 means no rank
              association; still-open and closed-without-merge pull requests end observation rather than count as merged.
            </p>
          </Stage>

          <Stage id="cbt-sensitivity" kicker="Sensitivity" title="Does the tail ordering survive other bases and bins?">
            <table className="atlas-table" data-testid="change-batch-sensitivity">
              <thead>
                <tr>
                  <th scope="col">Basis · bins</th>
                  <th scope="col">Stratum p90 (smallest → largest)</th>
                  <th scope="col">Largest vs smallest tail</th>
                </tr>
              </thead>
              <tbody>
                {view.binnings.map((binning) => (
                  <tr key={`${binning.basisId}.${binning.binningId}`} data-role={binning.role}>
                    <th scope="row">{binning.basisLabel} · {binning.binningLabel}</th>
                    <td>
                      {binning.strata.map((stratum) => {
                        const p90 = stratum.quantiles?.find((entry) => entry.quantile === 0.9)
                        return (
                          <span key={stratum.stratumId} className="atlas-inline-list">
                            {stratum.label}:{' '}
                            {p90 === undefined
                              ? <span className="atlas-note">withheld</span>
                              : <Mark subject={{ basisId: binning.basisId, binningId: binning.binningId, stratumId: stratum.stratumId, measure: 'p90', detail: null }} value={days(p90.seconds)} />}
                            {' '}
                          </span>
                        )
                      })}
                    </td>
                    <td data-ordering={binning.tailOrdering ?? 'none'}>
                      {binning.tailOrdering === null ? 'not computable' : binning.tailOrdering > 0 ? 'longer' : binning.tailOrdering < 0 ? 'shorter' : 'equal'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p data-testid="change-batch-robustness" data-status={finding.robustness.status}>Robustness: <strong>{finding.robustness.status}</strong>.</p>
            <ul className="atlas-list">
              {finding.robustness.checks.map((check) => (
                <li key={check.checkId} data-check={check.checkId} data-outcome={check.outcome}>
                  <strong>{check.checkId}</strong> ({check.outcome}) — {check.statement}
                </li>
              ))}
            </ul>
          </Stage>
        </>
      )}

      <Stage id="cbt-coverage" kicker="Coverage" title="What the coverage ledger vouches for">
        <ul className="atlas-coverage" data-testid="change-batch-coverage">
          {view.results[0].coverage.map((entry) => (
            <li key={entry.dimension} data-dimension={entry.dimension} data-limited={entry.limiting_reason !== null}>
              <span className="atlas-coverage__dim">{entry.dimension}</span>
              <span className="atlas-coverage__val">{entry.value === null ? '—' : <Mark subject={all('coverage', entry.dimension)} value={percent(entry.value)} />}</span>
              {entry.limiting_reason !== null && <span className="atlas-coverage__reason">{entry.limiting_reason}</span>}
            </li>
          ))}
        </ul>
        <ul className="atlas-list" data-testid="change-batch-coverage-rows">
          {view.coverage.rows.map((row) => (
            <li key={row.label} data-vouches={row.vouches} data-retention={row.retention}>
              <strong>{row.label}</strong> ({row.jobLabel}, {row.status}) ·{' '}
              {row.rangeStartWeek === null || row.rangeEndWeek === null
                ? 'range cleared at its retention boundary'
                : `${isoWeekLabel(row.rangeStartWeek)} to ${isoWeekLabel(row.rangeEndWeek)}`}
              {' · '}{row.vouches ? 'vouches for the window' : `does not vouch (${row.notVouchingReason ?? 'outside the window'})`}
            </li>
          ))}
        </ul>
        {view.coverage.lineage.length > 0 && (
          <ul className="atlas-list" data-testid="change-batch-lineage" aria-label="Deletion and retention lineage">
            {view.coverage.lineage.map((event, index) => (
              <li key={`${event.eventKind}:${event.eventWeek}:${index}`} data-event={event.eventKind}>
                {event.eventKind} · {event.subjectKind}{event.coverageLabel ? ` ${event.coverageLabel}` : ''}{event.jobLabel ? ` ${event.jobLabel}` : ''} · {event.eventWeek}
              </li>
            ))}
          </ul>
        )}
      </Stage>

      <Stage id="cbt-alternatives" kicker="Alternatives" title="What else could produce this pattern">
        {finding.alternativeExplanations.length === 0 ? <p className="atlas-note">No reading is offered, so no alternative is weighed.</p> : (
          <ul className="atlas-list" data-testid="change-batch-alternatives">
            {finding.alternativeExplanations.map((entry) => <li key={entry.code} data-code={entry.code}><strong>{entry.code}</strong> — {entry.statement}</li>)}
          </ul>
        )}
        {finding.discriminatingEvidence !== null && (
          <p className="atlas-discriminating"><strong>What would discriminate:</strong> {finding.discriminatingEvidence.statement}</p>
        )}
      </Stage>

      <Stage id="cbt-limitations" kicker="Limitations" title="Every limitation, and what this must never mean">
        <ul className="atlas-list" data-testid="change-batch-limitations">
          {finding.limitations.map((entry) => (
            <li key={`${entry.limitationCode}:${entry.dimension}`} data-limitation={entry.limitationCode}>
              <strong>{entry.limitationCode}</strong> · {entry.dimension}
            </li>
          ))}
        </ul>
        <div className="atlas-never" data-testid="change-batch-prohibited">
          <h4>What this must never mean</h4>
          <ul className="atlas-list">
            {finding.prohibitedInterpretations.map((entry) => <li key={entry.code} data-code={entry.code}>{entry.statement}</li>)}
          </ul>
        </div>
      </Stage>

      <EvidenceDrawer
        open={reference !== null}
        reference={reference ?? { kind: 'claim', claimId: '', claimLayer: 'deterministic' }}
        resolve={resolve}
        onClose={() => setReference(null)}
        discriminatingQuestion={finding.discriminatingEvidence?.statement ?? null}
      />
    </article>
  )
}
