import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { DeveloperArchetype, DnaMetric, ThemeMetric } from '../../shared/types'
import { compactNumber } from '../lib/format'

interface DnaPanelProps {
  archetype: DeveloperArchetype
  dna: DnaMetric[]
  themes: ThemeMetric[]
}

export function DnaPanel({ archetype, dna, themes }: DnaPanelProps) {
  const gradient = themes.length
    ? `conic-gradient(${themes
        .reduce<{ stops: string[]; cursor: number }>(
          (state, theme) => {
            const end = state.cursor + theme.share * 100
            state.stops.push(`${theme.color} ${state.cursor}% ${end}%`)
            state.cursor = end
            return state
          },
          { stops: [], cursor: 0 },
        )
        .stops.join(', ')})`
    : 'conic-gradient(#6f5dcc 0 100%)'

  return (
    <div className="dna-layout">
      <div className="dna-radar">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={dna} outerRadius="68%">
            <defs>
              <linearGradient id="dnaFill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#cfbaff" stopOpacity={0.78} />
                <stop offset="100%" stopColor="#55e7be" stopOpacity={0.23} />
              </linearGradient>
            </defs>
            <PolarGrid stroke="rgba(192, 203, 230, .13)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fill: '#9ca7bb', fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => [`${value}%`, 'Signature']}
              contentStyle={{
                background: '#151726',
                border: '1px solid rgba(255,255,255,.12)',
                borderRadius: 12,
                color: '#fff',
              }}
            />
            <Radar
              dataKey="value"
              stroke="#c8b2ff"
              fill="url(#dnaFill)"
              fillOpacity={0.72}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="dna-copy">
        <span className="eyebrow">Your developer archetype</span>
        <h3>{archetype.name}</h3>
        <p>{archetype.description}</p>
        <ul>
          {archetype.signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      </div>
      <div className="theme-ring-panel">
        <div className="theme-ring" style={{ background: gradient }}>
          <span>
            <strong>{compactNumber(themes.reduce((sum, theme) => sum + theme.count, 0))}</strong>
            classified
          </span>
        </div>
        <div className="theme-legend">
          <span className="eyebrow">The work beneath the work</span>
          {themes.slice(0, 5).map((theme) => (
            <div key={theme.key}>
              <i style={{ background: theme.color }} />
              <span>{theme.label}</span>
              <strong>{Math.round(theme.share * 100)}%</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
