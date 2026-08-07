import fixtureText from '../../research-contracts/method-trial-view/v1/wbc1.fixture.json?raw'
import {
  MethodTrialViewSchema,
  type MethodTrialRepresentativeCase,
  type MethodTrialView,
} from '../../shared/methodTrialView'
import './MethodTrialRoute.css'

const committedMethodTrialView = MethodTrialViewSchema.parse(JSON.parse(fixtureText))

type Measurement = MethodTrialView['scorecard']['baseline']['false_alerts_per_year']
type TimelinePoint = MethodTrialRepresentativeCase['points'][number]

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

function selectionLabel(selection: MethodTrialView['scorecard']['threshold_selection']['baseline']): string {
  return `${selection.viable ? 'Viable' : 'Not viable'} · ${selection.reason_code.replaceAll('_', ' ')} · ${numberLabel(selection.selected_value)}`
}

function normalizeSeriesValue(value: number, values: readonly number[]): number {
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  return maximum === minimum ? 0.5 : (value - minimum) / (maximum - minimum)
}

function markerLabel(point: MethodTrialRepresentativeCase['points'][number]): string {
  const markers = []
  if (point.planted_marker !== 'none') markers.push(`planted ${point.planted_marker}`)
  if (point.confound_marker !== 'none') markers.push(`confound ${point.confound_marker}`)
  if (point.pelt_marker.boundary) markers.push('PELT boundary')
  return markers.length > 0 ? markers.join(', ') : 'no marker'
}

function toSeriesSegments(
  points: readonly TimelinePoint[],
  toCoord: (point: TimelinePoint, position: number) => string | null,
): string[] {
  const segments: string[] = []
  let run: string[] = []
  points.forEach((point, position) => {
    const coord = toCoord(point, position)
    if (coord === null) {
      if (run.length > 0) {
        segments.push(run.join(' '))
        run = []
      }
      return
    }
    run.push(coord)
  })
  if (run.length > 0) segments.push(run.join(' '))
  return segments
}

function pointStateTuple(point: TimelinePoint): string {
  const state = point.observed.state === 'missing' ? `missing:${point.observed.reason}` : 'observed'
  return `${state}|${point.planted_marker}|${point.confound_marker}`
}

function selectNotablePoints(points: readonly TimelinePoint[]): {
  visible: TimelinePoint[]
  collapsedCount: number
} {
  const visible: TimelinePoint[] = []
  let collapsedCount = 0
  points.forEach((point, index) => {
    const isNotable =
      point.observed.state === 'missing' ||
      point.planted_marker !== 'none' ||
      point.confound_marker !== 'none' ||
      point.pelt_marker.boundary
    if (!isNotable) return
    const isDistinctTransition = index === 0 || pointStateTuple(point) !== pointStateTuple(points[index - 1])
    if (isDistinctTransition || point.pelt_marker.boundary) {
      visible.push(point)
    } else {
      collapsedCount += 1
    }
  })
  return { visible, collapsedCount }
}

function detectionHeadline(baseline: Measurement, candidate: Measurement): string {
  if (baseline.status !== 'measured' || candidate.status !== 'measured') {
    return 'Detection comparison unavailable'
  }
  if (baseline.value === candidate.value) {
    return `Equal detection at ${percentLabel(baseline)}`
  }
  return `Detection: baseline ${percentLabel(baseline)} vs candidate ${percentLabel(candidate)}`
}

function falseAlertHeadline(
  baselineAlerts: Measurement,
  candidateAlerts: Measurement,
  excessPercent: number | null,
): string {
  if (
    baselineAlerts.status !== 'measured' ||
    candidateAlerts.status !== 'measured' ||
    excessPercent === null ||
    !Number.isFinite(excessPercent)
  ) {
    return 'the candidate false-alert comparison is unavailable'
  }
  const magnitude = Math.abs(excessPercent).toFixed(1)
  const comparison =
    excessPercent > 0 ? `~${magnitude}% more` : excessPercent < 0 ? `~${magnitude}% fewer` : 'the same number of'
  return `the candidate produced ${comparison} candidate false alerts per year (${numberLabel(candidateAlerts)} vs ${numberLabel(baselineAlerts)})`
}

function detectionGainClause(baseline: Measurement, candidate: Measurement): string {
  if (baseline.status !== 'measured' || candidate.status !== 'measured') return 'with detection not directly comparable'
  if (candidate.value > baseline.value) return 'with a candidate detection gain'
  if (candidate.value < baseline.value) return 'with lower candidate detection'
  return 'with no detection gain'
}

function TimelineFigure({ representativeCase }: { representativeCase: MethodTrialRepresentativeCase }) {
  const width = 760
  const height = 212
  const left = 36
  const right = width - 20
  const top = 20
  const bottom = height - 56
  const x = (position: number) => left + (position / Math.max(1, representativeCase.points.length - 1)) * (right - left)
  const y = (value: number) => bottom - Math.max(0, Math.min(1, value)) * (bottom - top)
  const baselineValues = representativeCase.points.flatMap((point) =>
    point.baseline.score.status === 'measured' ? [point.baseline.score.value] : [],
  )
  const baselineSegments = toSeriesSegments(representativeCase.points, (point, position) =>
    point.baseline.score.status === 'measured'
      ? `${x(position)},${y(normalizeSeriesValue(point.baseline.score.value, baselineValues))}`
      : null,
  )
  const candidateSegments = toSeriesSegments(representativeCase.points, (point, position) =>
    point.candidate.probability.status === 'measured' ? `${x(position)},${y(point.candidate.probability.value)}` : null,
  )
  const missingCount = representativeCase.points.filter((point) => point.observed.state === 'missing').length
  const baselineAlertCount = representativeCase.points.filter((point) => point.baseline.alert).length
  const candidateAlertCount = representativeCase.points.filter((point) => point.candidate.alert).length
  const peltBoundaryCount = representativeCase.points.filter((point) => point.pelt_marker.boundary).length
  const { visible: visibleNotablePoints, collapsedCount: collapsedNotableCount } = selectNotablePoints(
    representativeCase.points,
  )

  return (
    <figure
      className="method-trial-timeline"
      data-testid="method-trial-timeline"
      aria-label={`${representativeCase.title}: ${representativeCase.points.length} weekly points, ${missingCount} missing observations, ${baselineAlertCount} baseline alerts, ${candidateAlertCount} candidate alerts, and ${peltBoundaryCount} offline descriptive PELT boundaries.`}
    >
      <figcaption>
        <strong>{representativeCase.title}</strong>
        <span>{representativeCase.summary}</span>
      </figcaption>
      <svg className="method-trial-timeline__svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${representativeCase.title} score overlay. Solid baseline and dashed candidate; marker labels are repeated in text below.`}>
        <line x1={left} x2={right} y1={bottom} y2={bottom} className="timeline-axis" />
        {baselineSegments.map((segment, index) => (
          <polyline
            key={`baseline-${index}`}
            points={segment}
            className="timeline-line timeline-line--baseline"
            data-testid="timeline-segment-baseline"
            fill="none"
          />
        ))}
        {candidateSegments.map((segment, index) => (
          <polyline
            key={`candidate-${index}`}
            points={segment}
            className="timeline-line timeline-line--candidate"
            data-testid="timeline-segment-candidate"
            fill="none"
          />
        ))}
        {representativeCase.points.map((point, position) => {
          const pointX = x(position)
          const baselineScore = point.baseline.score
          const candidateProbability = point.candidate.probability
          return (
            <g key={point.relative_week_index}>
              {point.observed.state === 'missing' && (
                <text x={pointX} y={top + 10} className="timeline-missing" textAnchor="middle">×</text>
              )}
              {baselineScore.status === 'measured' && <circle cx={pointX} cy={y(normalizeSeriesValue(baselineScore.value, baselineValues))} r="3.5" className="timeline-dot timeline-dot--baseline" />}
              {candidateProbability.status === 'measured' && <circle cx={pointX} cy={y(candidateProbability.value)} r="3.5" className="timeline-dot timeline-dot--candidate" />}
              {point.pelt_marker.boundary && <line x1={pointX} x2={pointX} y1={top} y2={bottom} className="timeline-pelt" />}
              {point.baseline.alert && (
                <rect
                  x={pointX - 3.5}
                  y={bottom + 7.5}
                  width="7"
                  height="7"
                  className="timeline-alert-marker timeline-alert-marker--baseline"
                  data-testid="baseline-alert-marker"
                />
              )}
              {point.candidate.alert && (
                <polygon
                  points={`${pointX},${bottom + 21} ${pointX + 4.5},${bottom + 25.5} ${pointX},${bottom + 30} ${pointX - 4.5},${bottom + 25.5}`}
                  className="timeline-alert-marker timeline-alert-marker--candidate"
                  data-testid="candidate-alert-marker"
                />
              )}
            </g>
          )
        })}
        <text x={left} y={height - 8} className="timeline-axis-label">earlier</text>
        <text x={right} y={height - 8} className="timeline-axis-label" textAnchor="end">later</text>
      </svg>
      <div className="method-trial-timeline__legend" aria-label="Timeline legend">
        <span><i className="timeline-key timeline-key--baseline" /> Baseline score · own normalized scale (solid)</span>
        <span><i className="timeline-key timeline-key--candidate" /> Candidate probability · 0–1 scale (dashed)</span>
        <span><i className="timeline-key timeline-key--pelt" /> PELT · offline descriptive</span>
        <span><i className="timeline-key timeline-key--baseline-alert" /> Baseline alert (square)</span>
        <span><i className="timeline-key timeline-key--candidate-alert" /> Candidate alert (diamond)</span>
      </div>
      <p className="method-trial-timeline__summary">
        {representativeCase.points.length} weeks · {missingCount} missing · {baselineAlertCount} baseline alerts ·{' '}
        {candidateAlertCount} candidate alerts · {peltBoundaryCount} offline PELT boundaries
      </p>
      {visibleNotablePoints.length > 0 && <ul className="method-trial-timeline__states" aria-label={`${representativeCase.title} notable timeline states`}>
        {visibleNotablePoints.map((point) => (
          <li key={point.relative_week_index}>
            <strong>{point.relative_week_label}</strong>: {point.observed.state === 'missing' ? `missing (${point.observed.reason.replaceAll('_', ' ')})` : 'observed'}; {markerLabel(point)}
          </li>
        ))}
        {collapsedNotableCount > 0 && <li>{collapsedNotableCount} more declared missing/marker events remain in the validated fixture.</li>}
      </ul>}
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
          {detectionHeadline(view.scorecard.baseline.detection_rate, view.scorecard.candidate.detection_rate)};{' '}
          {falseAlertHeadline(baselineAlerts, candidateAlerts, excessPercent)}. This is invented C0 evidence only:
          it does not establish validity on real repositories.
        </p>
        <p className="method-trial-question"><strong>Question:</strong> {view.trial.question}</p>
        <dl className="method-trial-sample" aria-label="Invented benchmark sample">
          <div><dt>Systems</dt><dd>{view.dataset.system_count}</dd></div>
          <div><dt>Weekly opportunities</dt><dd>{view.dataset.weekly_opportunity_count.toLocaleString()}</dd></div>
          <div><dt>Observed</dt><dd>{view.dataset.observed_count.toLocaleString()}</dd></div>
          <div><dt>Explicitly absent</dt><dd>{view.dataset.absent_count.toLocaleString()}</dd></div>
        </dl>
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
              <tr><th scope="row">Median detection delay · weeks</th><td>{numberLabel(view.scorecard.baseline.median_detection_delay_weeks)}</td><td>{numberLabel(view.scorecard.candidate.median_detection_delay_weeks)}</td></tr>
              <tr><th scope="row">Coverage-confound false-alert rate</th><td>{percentLabel(view.scorecard.baseline.coverage_confound_false_alert_rate)}</td><td>{percentLabel(view.scorecard.candidate.coverage_confound_false_alert_rate)}</td></tr>
              <tr><th scope="row">Brier calibration</th><td>{numberLabel(view.scorecard.baseline.calibration_brier)}</td><td>{numberLabel(view.scorecard.candidate.calibration_brier)}</td></tr>
              <tr><th scope="row">Threshold selection</th><td>{selectionLabel(view.scorecard.threshold_selection.baseline)}</td><td>{selectionLabel(view.scorecard.threshold_selection.candidate)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="method-trial-section" aria-labelledby="method-trial-timelines">
        <div className="method-trial-section__heading"><span>03 · Representative windows</span><h2 id="method-trial-timelines">Three timelines, with missingness and markers intact</h2></div>
        <p className="method-trial-selection-note">
          Deterministic final-holdout selection · {view.representative_selection.version} · fixed preferences and{' '}
          {view.representative_selection.tie_break.replaceAll('_', ' ')} tie-break · aliases not exposed.
        </p>
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
        <p className="method-trial-emphasis">
          {additionalAlerts === null
            ? `The candidate added an unavailable number of additional false alerts per year, ${detectionGainClause(view.scorecard.baseline.detection_rate, view.scorecard.candidate.detection_rate)}.`
            : `The candidate added exactly ${additionalAlerts.toFixed(4)} false alerts per year, ${detectionGainClause(view.scorecard.baseline.detection_rate, view.scorecard.candidate.detection_rate)}.`}{' '}
          Neither threshold selection was viable, so the complete deterministic baseline remains the retained fallback.
        </p>
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
            <div><dt>Deferred caveats</dt><dd>{view.deferred_caveats.map((caveat) => `${caveat.code.replaceAll('_', ' ')}: ${caveat.display_text}`).join(' · ')}</dd></div>
          </dl>
        </div>
      </details>
    </article>
  )
}

function ClaimList({ title, items }: { title: string; items: readonly { readonly code: string; readonly display_text: string }[] }) {
  return <div className="method-trial-claim"><h3>{title}</h3><ul>{items.map((item) => <li key={item.code}><strong>{item.code}</strong> · {item.display_text}</li>)}</ul></div>
}

export function MethodTrialRoute() {
  return (
    <div className="app method-trial-shell" id="top">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />
      <header className="app-header">
        <a className="method-trial-route__brand" href="?">
          ← Developer Lens · method trial
        </a>
        <span className="local-pill local-pill--public">Invented C0 · offline</span>
      </header>
      <main className="method-trial-route">
        <MethodTrialViewPanel view={committedMethodTrialView} />
      </main>
    </div>
  )
}
