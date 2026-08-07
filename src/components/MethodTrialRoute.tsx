import type { MethodTrialRepresentativeCase, MethodTrialView } from '../../shared/methodTrialView'
import './MethodTrialRoute.css'

type Measurement =
  | { readonly status: 'measured'; readonly value: number }
  | { readonly status: 'unavailable'; readonly reason: 'insufficient_support' | 'not_applicable' | 'not_measured' }

function numberLabel(measurement: Measurement, digits = 4): string {
  if (measurement.status === 'unavailable') {
    return `Unavailable · ${measurement.reason.replaceAll('_', ' ')}`
  }
  return measurement.value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

function percentLabel(measurement: Measurement): string {
  if (measurement.status === 'unavailable') return numberLabel(measurement)
  return `${(measurement.value * 100).toFixed(1)}%`
}

function statusLabel(outcome: 'pass' | 'fail' | 'not_applicable'): string {
  return outcome === 'not_applicable' ? 'Not applicable' : outcome === 'pass' ? 'Pass' : 'Fail'
}

function markerLabel(point: MethodTrialRepresentativeCase['points'][number]): string {
  const markers = []
  if (point.planted_marker !== 'none') markers.push(`planted ${point.planted_marker}`)
  if (point.confound_marker !== 'none') markers.push(`confound ${point.confound_marker}`)
  if (point.pelt_marker.boundary) markers.push('PELT boundary')
  return markers.length > 0 ? markers.join(', ') : 'no marker'
}

function TimelineFigure({ representativeCase }: { representativeCase: MethodTrialRepresentativeCase }) {
  const width = 760
  const height = 190
  const left = 36
  const right = width - 20
  const top = 20
  const bottom = height - 34
  const x = (index: number) => left + (index / Math.max(1, representativeCase.points.length - 1)) * (right - left)
  const y = (value: number) => bottom - Math.max(0, Math.min(1, value)) * (bottom - top)
  const baselinePoints = representativeCase.points
    .flatMap((point) => point.baseline.score.status === 'measured' ? [`${x(point.relative_week_index)},${y(point.baseline.score.value / 1.2)}`] : [])
    .join(' ')
  const candidatePoints = representativeCase.points
    .flatMap((point) => point.candidate.probability.status === 'measured' ? [`${x(point.relative_week_index)},${y(point.candidate.probability.value)}`] : [])
    .join(' ')

  return (
    <figure
      className="method-trial-timeline"
      data-testid="method-trial-timeline"
      aria-label={`${representativeCase.title}: baseline and candidate timeline with ${representativeCase.points.filter((point) => point.observed.state === 'missing').length} missing observation(s); ${representativeCase.points.filter((point) => point.pelt_marker.boundary).length} PELT offline descriptive boundary marker(s).`}
    >
      <figcaption>
        <strong>{representativeCase.title}</strong>
        <span>{representativeCase.summary}</span>
      </figcaption>
      <svg className="method-trial-timeline__svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${representativeCase.title} score overlay. Solid baseline and dashed candidate; marker labels are repeated in text below.`}>
        <line x1={left} x2={right} y1={bottom} y2={bottom} className="timeline-axis" />
        <polyline points={baselinePoints} className="timeline-line timeline-line--baseline" fill="none" />
        <polyline points={candidatePoints} className="timeline-line timeline-line--candidate" fill="none" />
        {representativeCase.points.map((point) => {
          const pointX = x(point.relative_week_index)
          const baselineScore = point.baseline.score
          const candidateProbability = point.candidate.probability
          return (
            <g key={point.relative_week_index}>
              {point.observed.state === 'missing' && (
                <text x={pointX} y={top + 10} className="timeline-missing" textAnchor="middle">×</text>
              )}
              {baselineScore.status === 'measured' && <circle cx={pointX} cy={y(baselineScore.value / 1.2)} r="3.5" className="timeline-dot timeline-dot--baseline" />}
              {candidateProbability.status === 'measured' && <circle cx={pointX} cy={y(candidateProbability.value)} r="3.5" className="timeline-dot timeline-dot--candidate" />}
              {point.pelt_marker.boundary && <line x1={pointX} x2={pointX} y1={top} y2={bottom} className="timeline-pelt" />}
              {(point.baseline.alert || point.candidate.alert) && <text x={pointX} y={bottom + 18} className="timeline-alert" textAnchor="middle">alert</text>}
            </g>
          )
        })}
        <text x={left} y={height - 8} className="timeline-axis-label">earlier</text>
        <text x={right} y={height - 8} className="timeline-axis-label" textAnchor="end">later</text>
      </svg>
      <div className="method-trial-timeline__legend" aria-label="Timeline legend">
        <span><i className="timeline-key timeline-key--baseline" /> Baseline score (solid)</span>
        <span><i className="timeline-key timeline-key--candidate" /> Candidate probability (dashed)</span>
        <span><i className="timeline-key timeline-key--pelt" /> PELT · offline descriptive</span>
      </div>
      <ul className="method-trial-timeline__states" aria-label={`${representativeCase.title} timeline states`}>
        {representativeCase.points.map((point) => (
          <li key={point.relative_week_index}>
            <strong>{point.relative_week_label}</strong>: {point.observed.state === 'missing' ? `missing (${point.observed.reason.replaceAll('_', ' ')})` : 'observed'}; {markerLabel(point)}
          </li>
        ))}
      </ul>
    </figure>
  )
}

export function MethodTrialViewPanel({ view }: { view: MethodTrialView }) {
  const baselineAlerts = view.scorecard.baseline.false_alerts_per_year
  const candidateAlerts = view.scorecard.candidate.false_alerts_per_year
  const additionalAlerts =
    baselineAlerts.status === 'measured' && candidateAlerts.status === 'measured'
      ? candidateAlerts.value - baselineAlerts.value
      : null
  const excessPercent =
    additionalAlerts !== null && baselineAlerts.status === 'measured'
      ? (additionalAlerts / baselineAlerts.value) * 100
      : null

  return (
    <article className="method-trial-panel" data-testid="method-trial-panel">
      <header className="method-trial-panel__header">
        <span className="method-trial-eyebrow">Method trial · C0 invented evidence</span>
        <span className="method-trial-eyebrow method-trial-eyebrow--detail">{view.trial.evidence_label}</span>
        <div className="method-trial-verdict"><span>Verdict</span><strong>REJECTED</strong></div>
        <h1>{view.trial.title}</h1>
        <p className="method-trial-headline">
          Equal detection at {percentLabel(view.scorecard.baseline.detection_rate)}; the candidate produced{' '}
          {excessPercent === null ? 'more' : `~${excessPercent.toFixed(1)}% more`} candidate false alerts per year
          ({numberLabel(candidateAlerts)} vs {numberLabel(baselineAlerts)}). This is invented C0 evidence only:
          it does not establish validity on real repositories.
        </p>
        <p className="method-trial-question"><strong>Question:</strong> {view.trial.question}</p>
      </header>

      <section className="method-trial-section" aria-labelledby="method-trial-methods">
        <div className="method-trial-section__heading"><span>01 · Methods</span><h2 id="method-trial-methods">Baseline, candidate, and the offline cue</h2></div>
        <div className="method-trial-method-grid">
          {[view.methods.baseline, view.methods.candidate, view.methods.offline_pelt].map((method) => (
            <article className="method-trial-card" key={method.method_code}>
              <span className="method-trial-card__role">{method.role === 'offline_descriptive' ? 'Offline descriptive' : method.role}</span>
              <h3>{method.display_name}</h3>
              <p>{method.description}</p>
              <small>{method.parameter_summary}</small>
              {method.method_code === 'pelt' && <strong className="method-trial-note">PELT is labelled offline descriptive, never online promotion.</strong>}
            </article>
          ))}
        </div>
      </section>

      <section className="method-trial-section" aria-labelledby="method-trial-scorecard">
        <div className="method-trial-section__heading"><span>02 · Paired scorecard</span><h2 id="method-trial-scorecard">What the bounded benchmark measured</h2></div>
        <div className="method-trial-table-wrap">
          <table className="method-trial-table">
            <caption>Baseline and candidate values; unavailable values remain unavailable.</caption>
            <thead><tr><th scope="col">Metric</th><th scope="col">Baseline</th><th scope="col">Candidate</th></tr></thead>
            <tbody>
              <tr><th scope="row">False alerts / year</th><td>{numberLabel(view.scorecard.baseline.false_alerts_per_year)}</td><td>{numberLabel(view.scorecard.candidate.false_alerts_per_year)}</td></tr>
              <tr><th scope="row">Detection</th><td>{percentLabel(view.scorecard.baseline.detection_rate)}</td><td>{percentLabel(view.scorecard.candidate.detection_rate)}</td></tr>
              <tr><th scope="row">Detection delay</th><td>{numberLabel(view.scorecard.baseline.detection_delay_weeks)}</td><td>{numberLabel(view.scorecard.candidate.detection_delay_weeks)}</td></tr>
              <tr><th scope="row">Brier calibration</th><td>{numberLabel(view.scorecard.baseline.calibration_brier)}</td><td>{numberLabel(view.scorecard.candidate.calibration_brier)}</td></tr>
              <tr><th scope="row">Threshold viability</th><td>{view.scorecard.threshold_selection.baseline.viable ? 'Viable' : 'Not viable'} · {view.scorecard.threshold_selection.baseline.reason_code.replaceAll('_', ' ')}</td><td>{view.scorecard.threshold_selection.candidate.viable ? 'Viable' : 'Not viable'} · {view.scorecard.threshold_selection.candidate.reason_code.replaceAll('_', ' ')}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="method-trial-section" aria-labelledby="method-trial-timelines">
        <div className="method-trial-section__heading"><span>03 · Representative windows</span><h2 id="method-trial-timelines">Three timelines, with missingness and markers intact</h2></div>
        <div className="method-trial-timelines">{view.representative_cases.map((representativeCase) => <TimelineFigure key={representativeCase.scenario_code} representativeCase={representativeCase} />)}</div>
      </section>

      <section className="method-trial-section" aria-labelledby="method-trial-gates">
        <div className="method-trial-section__heading"><span>04 · Acceptance ladder</span><h2 id="method-trial-gates">Every gate leaves a reason code</h2></div>
        <ol className="method-trial-gates" aria-label="Ordered acceptance gates">
          {view.acceptance_gates.map((gate) => <li key={gate.code} data-outcome={gate.outcome}><div><strong>{gate.order}. {gate.label}</strong><span className="method-trial-gate-status">{statusLabel(gate.outcome)}</span></div><p><code>{gate.reason_code}</code> · {gate.reason}</p></li>)}
        </ol>
      </section>

      <section className="method-trial-section method-trial-section--decision" aria-labelledby="method-trial-decision">
        <div className="method-trial-section__heading"><span>05 · Decision</span><h2 id="method-trial-decision">Why the simple baseline won</h2></div>
        <p>{view.decision.why_simple_baseline_won}</p>
        <p className="method-trial-emphasis">The candidate added exactly {additionalAlerts === null ? '1.2333' : additionalAlerts.toFixed(4)} false alerts per year, with no detection gain. Neither threshold selection was viable, so the deterministic baseline stays the safe fallback.</p>
      </section>

      <section className="method-trial-section" aria-labelledby="method-trial-claims">
        <div className="method-trial-section__heading"><span>06 · Boundaries</span><h2 id="method-trial-claims">Supported, unsupported, and limitations</h2></div>
        <div className="method-trial-claims-grid">
          <ClaimList title="Supported" items={view.claims.supported} />
          <ClaimList title="Unsupported" items={view.claims.unsupported} />
          <ClaimList title="Limitations" items={view.claims.limitations} />
        </div>
      </section>

      <details className="method-trial-repro">
        <summary>Reproducibility disclosure · commits, run, digests, commands, and statuses</summary>
        <div className="method-trial-repro__body">
          <dl>
            <div><dt>Run</dt><dd>{view.reproducibility.run_id} · {view.reproducibility.recipe_code}</dd></div>
            <div><dt>Commits</dt><dd>contract {view.reproducibility.product_contract_commit} · research pack {view.reproducibility.product_research_pack_commit} · lab {view.reproducibility.lab_commit}</dd></div>
            {Object.entries(view.reproducibility.digests).map(([name, digest]) => <div key={name}><dt>{name} digest</dt><dd>{digest}</dd></div>)}
            {Object.entries(view.reproducibility.commands).map(([name, command]) => <div key={name}><dt>{name} command</dt><dd><code>{command}</code></dd></div>)}
            <div><dt>Verification</dt><dd>local {view.reproducibility.verification.local} · product hosted {view.reproducibility.verification.product_hosted} · lab hosted {view.reproducibility.verification.lab_hosted}</dd></div>
          </dl>
        </div>
      </details>
    </article>
  )
}

function ClaimList({ title, items }: { title: string; items: readonly { readonly code: string; readonly display_text: string }[] }) {
  return <div className="method-trial-claim"><h3>{title}</h3><ul>{items.map((item) => <li key={item.code}><strong>{item.code}</strong> · {item.display_text}</li>)}</ul></div>
}

export function MethodTrialRoute({ view }: { view: MethodTrialView }) {
  return <main className="method-trial-route"><MethodTrialViewPanel view={view} /></main>
}
