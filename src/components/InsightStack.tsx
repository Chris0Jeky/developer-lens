import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, FlaskConical, Layers3 } from 'lucide-react'
import type { Insight, InsightOrder } from '../../shared/types'

const ORDER_LABELS: Record<InsightOrder, string> = {
  1: 'Observed',
  2: 'Derived',
  3: 'Hypotheses',
}

const ORDER_ICONS = {
  1: CheckCircle2,
  2: Layers3,
  3: FlaskConical,
}

export function InsightStack({ insights }: { insights: Insight[] }) {
  const [filter, setFilter] = useState<'all' | InsightOrder>('all')
  const visible = useMemo(
    () => (filter === 'all' ? insights : insights.filter((insight) => insight.order === filter)),
    [filter, insights],
  )

  return (
    <div className="insight-stack">
      <div className="insight-filter" aria-label="Filter insights">
        <button
          className={filter === 'all' ? 'is-active' : ''}
          onClick={() => setFilter('all')}
          type="button"
        >
          All connections <span>{insights.length}</span>
        </button>
        {([1, 2, 3] as InsightOrder[]).map((order) => (
          <button
            className={filter === order ? 'is-active' : ''}
            key={order}
            onClick={() => setFilter(order)}
            type="button"
          >
            {ORDER_LABELS[order]}{' '}
            <span>{insights.filter((insight) => insight.order === order).length}</span>
          </button>
        ))}
      </div>
      <div className="insight-grid">
        {visible.map((insight, index) => {
          const Icon = ORDER_ICONS[insight.order]
          return (
            <motion.article
              className={`insight-card insight-card--${insight.order}`}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: Math.min(index, 5) * 0.055 }}
              key={insight.id}
            >
              <div className="insight-card__meta">
                <span>
                  <Icon size={14} aria-hidden="true" /> {insight.eyebrow}
                </span>
                <span className={`confidence confidence--${insight.confidence}`}>
                  {insight.confidence} confidence
                </span>
              </div>
              <h3>{insight.title}</h3>
              <p>{insight.body}</p>
              <div className="insight-card__evidence">
                <span>Evidence trail</span>
                {insight.evidence.map((evidence) => (
                  <div key={evidence}>
                    <ArrowRight size={13} aria-hidden="true" /> {evidence}
                  </div>
                ))}
              </div>
              {insight.caveat && <p className="insight-card__caveat">Lens limit · {insight.caveat}</p>}
            </motion.article>
          )
        })}
      </div>
    </div>
  )
}
