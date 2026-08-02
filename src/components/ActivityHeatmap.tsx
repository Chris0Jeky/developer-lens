import { getDay, parseISO } from 'date-fns'
import type { ActivityDay } from '../../shared/types'
import { formatDay, fullNumber } from '../lib/format'

interface ActivityHeatmapProps {
  activity: ActivityDay[]
}

function intensity(value: number, maximum: number): number {
  if (value <= 0) return 0
  const normalized = Math.log1p(value) / Math.log1p(Math.max(1, maximum))
  if (normalized < 0.22) return 1
  if (normalized < 0.42) return 2
  if (normalized < 0.62) return 3
  if (normalized < 0.8) return 4
  return 5
}

export function ActivityHeatmap({ activity }: ActivityHeatmapProps) {
  const valueForDay = (day: ActivityDay) =>
    Math.max(
      day.contributions + day.localCommits,
      day.commits + day.localCommits + day.pullRequests + day.reviews + day.issues,
    )
  const values = activity.map(valueForDay)
  const maximum = Math.max(...values, 1)
  const firstWeekday = activity[0]
    ? (getDay(parseISO(activity[0].date)) + 6) % 7
    : 0
  const cells: Array<ActivityDay | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...activity,
  ]

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-labels" aria-hidden="true">
        <span>Mon</span>
        <span>Wed</span>
        <span>Fri</span>
      </div>
      <div className="heatmap-scroll">
        <div
          className="heatmap"
          role="img"
          aria-label={`${activity.filter((day) => valueForDay(day) > 0).length} active days across the selected period`}
        >
          {cells.map((day, index) => {
            if (!day) return <span className="heatmap__cell heatmap__cell--empty" key={`empty-${index}`} />
            const value = valueForDay(day)
            return (
              <span
                className="heatmap__cell"
                data-level={intensity(value, maximum)}
                key={day.date}
                title={`${formatDay(day.date)} · ${fullNumber(value)} contribution signals`}
              />
            )
          })}
        </div>
      </div>
      <div className="heatmap-legend" aria-hidden="true">
        <span>Quiet</span>
        {[0, 1, 2, 3, 4, 5].map((level) => (
          <i data-level={level} key={level} />
        ))}
        <span>Intense</span>
      </div>
    </div>
  )
}
