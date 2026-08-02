import { AlertTriangle, Check, CircleDashed, LockKeyhole, ShieldCheck } from 'lucide-react'
import type { DashboardMeta } from '../../shared/types'

const STATUS_ICON = {
  complete: Check,
  partial: AlertTriangle,
  unavailable: CircleDashed,
}

export function CoveragePanel({ meta }: { meta: DashboardMeta }) {
  return (
    <div className="coverage-panel">
      <div className="coverage-score">
        <div
          className="coverage-score__ring"
          style={{ '--coverage': `${meta.coverageScore * 3.6}deg` } as React.CSSProperties}
        >
          <span>
            <strong>{meta.coverageScore}%</strong>
            source coverage
          </span>
        </div>
        <div>
          <span className="eyebrow">How sharp is this lens?</span>
          <h3>{meta.coverageScore >= 90 ? 'High-resolution evidence' : 'Some edges remain soft'}</h3>
          <p>
            Coverage measures completed collection sources—not how complete GitHub is as a record of
            real work.
          </p>
        </div>
      </div>
      <div className="coverage-sources">
        {meta.coverage.map((source) => {
          const Icon = STATUS_ICON[source.status]
          return (
            <div key={source.id}>
              <span className={`source-status source-status--${source.status}`}>
                <Icon size={14} aria-hidden="true" />
              </span>
              <div>
                <strong>{source.label}</strong>
                <p>{source.detail}</p>
              </div>
              {source.itemCount !== undefined && <span>{source.itemCount.toLocaleString()}</span>}
            </div>
          )
        })}
      </div>
      {meta.warnings.length > 0 && (
        <details className="coverage-warnings">
          <summary>
            <AlertTriangle size={15} aria-hidden="true" /> {meta.warnings.length} coverage notes
          </summary>
          <ul>
            {meta.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="privacy-contract">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <strong>Private by architecture</strong>
          <span>Bound to this device. No telemetry. No token storage. No tracked activity data.</span>
        </div>
        <LockKeyhole size={17} aria-hidden="true" />
      </div>
    </div>
  )
}
