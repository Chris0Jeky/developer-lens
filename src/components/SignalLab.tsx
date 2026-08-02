import {
  Activity,
  Boxes,
  Gauge,
  GitPullRequest,
  MessageSquare,
  Network,
} from 'lucide-react'
import type { SignalMetric } from '../../shared/types'

const ICONS = {
  flow: Gauge,
  scope: GitPullRequest,
  coordination: Network,
  feedback: MessageSquare,
  cadence: Activity,
  portfolio: Boxes,
}

export function SignalLab({ signals }: { signals: SignalMetric[] }) {
  return (
    <div className="signal-lab">
      <div className="signal-lab__guide">
        <span><i className="signal-order signal-order--1" /> Observed summaries use direct event fields</span>
        <span><i className="signal-order signal-order--2" /> Derived signals combine multiple observations</span>
      </div>
      <div className="signal-grid">
        {signals.map((signal) => {
          const Icon = ICONS[signal.category]
          return (
            <article className={`signal-card signal-card--${signal.category}`} key={signal.id}>
              <div className="signal-card__topline">
                <span><Icon size={14} aria-hidden="true" /> {signal.label}</span>
                <span>{signal.order === 1 ? 'Observed' : 'Derived'} · {signal.confidence}</span>
              </div>
              <div className="signal-card__value">
                <strong>{signal.value}</strong>
                <span>{signal.title}</span>
              </div>
              <p className="signal-card__context">{signal.context}</p>
              <p className="signal-card__meaning">{signal.explanation}</p>
              <div className="signal-card__basis">Based on {signal.basis}</div>
              <details>
                <summary>Method & lens limit</summary>
                <p><strong>Formula:</strong> {signal.formula}</p>
                <p><strong>Limit:</strong> {signal.caveat}</p>
              </details>
            </article>
          )
        })}
      </div>
    </div>
  )
}
