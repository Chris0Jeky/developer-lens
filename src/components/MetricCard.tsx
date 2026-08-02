import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'

interface MetricCardProps {
  icon: ReactNode
  label: string
  value: string
  detail: string
  insight: string
  basis: string
  accent: string
  href?: string
}

export function MetricCard({
  accent,
  basis,
  detail,
  href,
  icon,
  insight,
  label,
  value,
}: MetricCardProps) {
  const content = (
    <>
      <div className="metric-card__top">
        <span className="metric-card__icon" style={{ color: accent }}>
          {icon}
        </span>
        {href && <ArrowUpRight size={16} aria-hidden="true" />}
      </div>
      <strong className="metric-card__value">{value}</strong>
      <span className="metric-card__label">{label}</span>
      <p>{detail}</p>
      <span className="metric-card__peek">
        <small>How to read it</small>
        <strong>{insight}</strong>
        <i>{basis}</i>
      </span>
    </>
  )

  if (href) {
    return (
      <a className="metric-card" href={href} style={{ '--metric-accent': accent } as React.CSSProperties}>
        {content}
      </a>
    )
  }
  return (
    <article className="metric-card" style={{ '--metric-accent': accent } as React.CSSProperties}>
      {content}
    </article>
  )
}
