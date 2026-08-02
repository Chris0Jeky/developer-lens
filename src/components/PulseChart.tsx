import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WeeklyActivity } from '../../shared/types'
import { fullNumber } from '../lib/format'

interface PulseChartProps {
  weekly: WeeklyActivity[]
}

interface TooltipEntry {
  color?: string
  dataKey?: string
  name?: string
  value?: number
}

function PulseTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string
  payload?: TooltipEntry[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <span>Week of {label}</span>
      {payload
        .filter((entry) => (entry.value ?? 0) > 0)
        .map((entry) => (
          <div key={entry.dataKey}>
            <i style={{ background: entry.color }} />
            <strong>{entry.name}</strong>
            <span>{fullNumber(entry.value ?? 0)}</span>
          </div>
        ))}
    </div>
  )
}

export function PulseChart({ weekly }: PulseChartProps) {
  const stride = Math.max(1, Math.floor(weekly.length / 7))
  return (
    <div className="pulse-chart" role="img" aria-label="Weekly commits, pull requests, and reviews">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={weekly} margin={{ top: 18, right: 2, bottom: 0, left: -26 }}>
          <defs>
            <linearGradient id="commitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a884ff" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#a884ff" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="reviewGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#54e5c1" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#54e5c1" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(177, 190, 222, .08)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={stride - 1}
            tick={{ fill: '#8490a8', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#657087', fontSize: 10 }}
            tickFormatter={(value: number) =>
              value > 999 ? `${Math.round(value / 1000)}k` : String(value)
            }
          />
          <Tooltip content={<PulseTooltip />} cursor={{ stroke: 'rgba(255,255,255,.16)' }} />
          <Area
            type="monotone"
            dataKey="commits"
            name="Commits"
            stroke="#b99cff"
            fill="url(#commitGradient)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#d8c7ff', strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="reviews"
            name="Reviews"
            stroke="#54e5c1"
            fill="url(#reviewGradient)"
            strokeWidth={1.5}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="pullRequests"
            name="Pull requests"
            stroke="#ffcc66"
            fill="transparent"
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
