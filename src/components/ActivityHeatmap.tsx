import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
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

function valueForDay(day: ActivityDay): number {
  return Math.max(
    day.contributions + day.localCommits,
    day.commits + day.localCommits + day.pullRequests + day.reviews + day.issues,
  )
}

export function ActivityHeatmap({ activity }: ActivityHeatmapProps) {
  const values = activity.map(valueForDay)
  const maximum = Math.max(...values, 1)
  const peakDay = useMemo(
    () =>
      activity.reduce<ActivityDay | undefined>(
        (peak, day) => (!peak || valueForDay(day) > valueForDay(peak) ? day : peak),
        undefined,
      ),
    [activity],
  )
  const [selectedDate, setSelectedDate] = useState(peakDay?.date)
  const cellRefs = useRef(new Map<string, HTMLButtonElement>())
  const selected = activity.find((day) => day.date === selectedDate) ?? peakDay
  const firstWeekday = activity[0]
    ? (getDay(parseISO(activity[0].date)) + 6) % 7
    : 0
  const cells: Array<ActivityDay | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...activity,
  ]

  useEffect(() => {
    setSelectedDate(peakDay?.date)
  }, [peakDay?.date])

  const moveSelection = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const current = activity.findIndex((day) => day.date === date)
    let target = current
    if (event.key === 'ArrowRight') target += 1
    else if (event.key === 'ArrowLeft') target -= 1
    else if (event.key === 'ArrowDown') target += 7
    else if (event.key === 'ArrowUp') target -= 7
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = activity.length - 1
    else return
    event.preventDefault()
    const next = activity[Math.max(0, Math.min(activity.length - 1, target))]
    if (!next) return
    setSelectedDate(next.date)
    window.requestAnimationFrame(() => cellRefs.current.get(next.date)?.focus())
  }

  const selectedValue = selected ? valueForDay(selected) : 0
  const selectedMix = selected
    ? [
        ['Contributions', selected.contributions],
        ['Commits', selected.commits],
        ['Local-only', selected.localCommits],
        ['PRs', selected.pullRequests],
        ['Reviews', selected.reviews],
        ['Issues', selected.issues],
      ].filter((entry): entry is [string, number] => Number(entry[1]) > 0)
    : []

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
          role="group"
          aria-label={`${activity.filter((day) => valueForDay(day) > 0).length} active days across the selected period`}
        >
          {cells.map((day, index) => {
            if (!day) return <span className="heatmap__cell heatmap__cell--empty" key={`empty-${index}`} />
            const value = valueForDay(day)
            return (
              <button
                aria-label={`${formatDay(day.date)}. ${fullNumber(value)} contribution signals.`}
                aria-pressed={selected?.date === day.date}
                className="heatmap__cell"
                data-level={intensity(value, maximum)}
                key={day.date}
                onFocus={() => setSelectedDate(day.date)}
                onKeyDown={(event) => moveSelection(event, day.date)}
                onPointerEnter={() => setSelectedDate(day.date)}
                ref={(node) => {
                  if (node) cellRefs.current.set(day.date, node)
                  else cellRefs.current.delete(day.date)
                }}
                tabIndex={selected?.date === day.date ? 0 : -1}
                title={`${formatDay(day.date)} · ${fullNumber(value)} contribution signals`}
                type="button"
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
      {selected && (
        <div aria-live="polite" className="heatmap-inspector">
          <span>
            <small>{formatDay(selected.date)}</small>
            <strong>{selectedValue > 0 ? `${fullNumber(selectedValue)} visible signals` : 'Quiet day'}</strong>
          </span>
          <div>
            {selectedMix.length > 0 ? (
              selectedMix.map(([label, value]) => <i key={label}>{label} · {fullNumber(value)}</i>)
            ) : (
              <i>No observable activity</i>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
