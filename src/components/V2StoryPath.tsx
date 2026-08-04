import { ArrowRight, CheckCircle2, FlaskConical, Layers3 } from 'lucide-react'
import type { Insight, InsightOrder } from '../../shared/types'

const STORY_STEPS: ReadonlyArray<{
  order: InsightOrder
  label: string
  orientation: string
  Icon: typeof CheckCircle2
}> = [
  {
    order: 1,
    label: 'Observed',
    orientation: 'Start with what the visible signals show.',
    Icon: CheckCircle2,
  },
  {
    order: 2,
    label: 'Derived',
    orientation: 'Follow the connection that can be reproduced.',
    Icon: Layers3,
  },
  {
    order: 3,
    label: 'Hypothesis',
    orientation: 'Hold the open question without turning it into intent.',
    Icon: FlaskConical,
  },
]

export function V2StoryPath({ insights }: { insights: Insight[] }) {
  const steps = STORY_STEPS.map((step) => ({
    ...step,
    insight: insights.find((insight) => insight.order === step.order),
  })).filter((step): step is typeof step & { insight: Insight } => Boolean(step.insight))

  if (steps.length === 0) return null

  return (
    <section aria-labelledby="v2-story-path-heading" className="v2-story-path">
      <div className="v2-story-path__intro">
        <span className="eyebrow">Story path</span>
        <h3 id="v2-story-path-heading">Story path: read the signal in three careful moves.</h3>
        <p>
          Move from what is visible, through a reproducible connection, to a question worth holding
          open. The rail is a map, not another conclusion.
        </p>
      </div>
      <ol aria-label="Evidence story path" className="v2-story-path__rail">
        {steps.map(({ Icon, insight, label, order, orientation }, index) => (
          <li
            aria-label={`${String(order).padStart(2, '0')} ${label}: ${orientation}`}
            className={`v2-story-path__step v2-story-path__step--${order}`}
            key={order}
          >
            <div className="v2-story-path__marker" aria-hidden="true">
              <Icon size={15} />
              <span>{String(order).padStart(2, '0')}</span>
            </div>
            <div className="v2-story-path__copy">
              <span className="v2-story-path__label">{label}</span>
              <strong>{orientation}</strong>
              <span className="v2-story-path__evidence">
                <ArrowRight size={12} aria-hidden="true" />
                <span>Evidence headline · {insight.evidence[0]}</span>
              </span>
            </div>
            {index < steps.length - 1 && <span className="v2-story-path__connector" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </section>
  )
}
