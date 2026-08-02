import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ExternalLink, Lock, Radio } from 'lucide-react'
import type { RepositoryMetric } from '../../shared/types'
import { compactNumber } from '../lib/format'

interface RepoConstellationProps {
  repositories: RepositoryMetric[]
}

type ConstellationLens = 'attention' | 'flow' | 'continuity'

const POSITIONS = [
  [340, 205],
  [152, 126],
  [528, 118],
  [526, 292],
  [151, 294],
  [70, 210],
  [610, 211],
  [340, 70],
  [340, 346],
  [78, 66],
  [604, 63],
  [606, 357],
] as const

const LENSES: Record<
  ConstellationLens,
  {
    label: string
    value: (repo: RepositoryMetric) => number
    unit: string
    explanation: string
  }
> = {
  attention: {
    label: 'Attention',
    value: (repo) => repo.engagement,
    unit: 'engagement points',
    explanation:
      'Size blends observed commits, authored changes, reviews, and issues. It maps attention—not impact.',
  },
  flow: {
    label: 'PR flow',
    value: (repo) => repo.pullRequests,
    unit: 'authored pull requests',
    explanation:
      'Size reflects authored pull requests in the window. More proposals do not imply more value.',
  },
  continuity: {
    label: 'Continuity',
    value: (repo) => repo.activeWeeks,
    unit: 'active weeks',
    explanation:
      'Size reflects weeks with visible activity. It reveals sustained rhythm—not intensity or quality.',
  },
}

function momentumLabel(repo: RepositoryMetric) {
  if (repo.firstHalfActivity < 1 && repo.secondHalfActivity > 0) return 'New this period'
  if (repo.momentum >= 10) return '10×+ late-window activity'
  return `${repo.momentum}× late / early activity`
}

function shortName(name: string) {
  return name.length > 20 ? `${name.slice(0, 18)}…` : name
}

export function RepoConstellation({ repositories }: RepoConstellationProps) {
  const [lens, setLens] = useState<ConstellationLens>('attention')
  const [selectedKey, setSelectedKey] = useState(repositories[0]?.key)
  const mapRef = useRef<SVGSVGElement>(null)
  const reduceMotion = useReducedMotion()
  const visible = repositories.slice(0, POSITIONS.length)
  const selected = visible.find((repo) => repo.key === selectedKey) ?? visible[0]
  const lensConfig = LENSES[lens]
  const maximum = Math.max(...visible.map(lensConfig.value), 1)
  const privateCount = repositories.filter((repo) => repo.isPrivate).length
  const hiddenCount = Math.max(0, repositories.length - visible.length)

  if (!selected) {
    return <p className="constellation__empty">No repositories were visible in this window.</p>
  }

  return (
    <div className="constellation">
      <div className="constellation__toolbar">
        <div className="constellation__legend">
          <span>
            <Radio size={13} aria-hidden="true" /> {visible.length} mapped · {repositories.length}{' '}
            observed
          </span>
          <span>
            <Lock size={12} aria-hidden="true" /> {privateCount} private
          </span>
        </div>
        <div className="constellation__lenses" aria-label="Size repository bubbles by">
          {(Object.keys(LENSES) as ConstellationLens[]).map((lensKey) => (
            <button
              aria-pressed={lens === lensKey}
              className={lens === lensKey ? 'is-active' : ''}
              key={lensKey}
              onClick={() => setLens(lensKey)}
              type="button"
            >
              {LENSES[lensKey].label}
            </button>
          ))}
        </div>
      </div>

      <div className="constellation__map">
        <svg
          ref={mapRef}
          viewBox="0 0 680 420"
          role="group"
          aria-label={`Repository constellation sized by ${lensConfig.label.toLowerCase()}`}
        >
          <defs>
            <filter id="softGlow" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {visible.map((repo, index) => (
              <radialGradient id={`repoGlow-${index}`} cx="34%" cy="27%" r="76%" key={repo.key}>
                <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
                <stop
                  offset="34%"
                  stopColor={repo.languageColor ?? '#a987f2'}
                  stopOpacity=".9"
                />
                <stop
                  offset="100%"
                  stopColor={repo.languageColor ?? '#5d36b5'}
                  stopOpacity=".38"
                />
              </radialGradient>
            ))}
          </defs>
          <g className="constellation__orbits" aria-hidden="true">
            <ellipse cx="340" cy="210" rx="250" ry="120" />
            <ellipse cx="340" cy="210" rx="164" ry="184" transform="rotate(48 340 210)" />
            <ellipse cx="340" cy="210" rx="104" ry="286" transform="rotate(82 340 210)" />
          </g>
          {visible.map((repo, index) => {
            const [x, y] = POSITIONS[index]
            const value = lensConfig.value(repo)
            const radius = 17 + Math.sqrt(value / maximum) * 42
            const isSelected = repo.key === selected.key
            const labelVisible = isSelected || index < 3
            const movement = repo.secondHalfActivity - repo.firstHalfActivity
            const movementColor = movement > 0 ? '#58e6be' : movement < 0 ? '#ff8ca3' : '#8a92a6'

            return (
              <motion.g
                aria-controls="constellation-detail"
                aria-label={`${repo.displayName}; ${compactNumber(value)} ${lensConfig.unit}; select for details`}
                aria-pressed={isSelected}
                className={`constellation__node${isSelected ? ' is-selected' : ''}`}
                data-node-index={index}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.45 }}
                key={repo.key}
                onClick={() => setSelectedKey(repo.key)}
                onFocus={() => setSelectedKey(repo.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedKey(repo.key)
                    return
                  }
                  let target = index
                  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target += 1
                  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target -= 1
                  else if (event.key === 'Home') target = 0
                  else if (event.key === 'End') target = visible.length - 1
                  else return
                  event.preventDefault()
                  const bounded = Math.max(0, Math.min(visible.length - 1, target))
                  const next = visible[bounded]
                  if (!next) return
                  setSelectedKey(next.key)
                  window.requestAnimationFrame(() =>
                    mapRef.current?.querySelector<SVGGElement>(`[data-node-index="${bounded}"]`)?.focus(),
                  )
                }}
                onPointerEnter={() => setSelectedKey(repo.key)}
                role="button"
                style={{ transformOrigin: `${x}px ${y}px` }}
                tabIndex={isSelected ? 0 : -1}
                transition={{
                  delay: reduceMotion ? 0 : index * 0.035,
                  duration: reduceMotion ? 0 : 0.35,
                }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
              >
                <circle
                  className="constellation__halo"
                  cx={x}
                  cy={y}
                  r={radius + 8}
                  style={{ opacity: 0.1 + (radius / 70) * 0.18 }}
                />
                {isSelected && (
                  <circle
                    className="constellation__selection"
                    cx={x}
                    cy={y}
                    fill="none"
                    r={radius + 9}
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  fill={`url(#repoGlow-${index})`}
                  filter={isSelected || index < 2 ? 'url(#softGlow)' : undefined}
                  r={radius}
                  stroke={repo.isPrivate ? '#ffd166' : 'rgba(236,231,255,.72)'}
                  strokeDasharray={repo.isPrivate ? '5 4' : undefined}
                  strokeWidth={repo.isPrivate ? 1.8 : 0.9}
                />
                <circle
                  aria-hidden="true"
                  cx={x + radius * 0.67}
                  cy={y - radius * 0.67}
                  fill={movementColor}
                  r={isSelected ? 4.2 : 3.2}
                  stroke="#0b0c15"
                  strokeWidth="2"
                />
                {repo.isPrivate && radius > 25 && (
                  <path
                    d={`M ${x - 3.4} ${y - 1} v-3.2 a3.4 3.4 0 0 1 6.8 0 v3.2 M ${x - 5} ${y - 1} h10 v8 h-10 z`}
                    fill="none"
                    stroke="#fff5ca"
                    strokeWidth="1.4"
                  />
                )}
                {labelVisible && (
                  <text
                    className="constellation__label"
                    x={x}
                    y={y + radius + 18}
                    textAnchor="middle"
                  >
                    {shortName(repo.displayName)}
                  </text>
                )}
              </motion.g>
            )
          })}
        </svg>
        {hiddenCount > 0 && (
          <a className="constellation__more" href="#repo-ledger">
            +{hiddenCount} more in the ledger
          </a>
        )}
      </div>

      <div className="constellation__detail" aria-live="polite" id="constellation-detail">
        <div className="constellation__identity">
          <span>Focused system</span>
          <strong>{selected.displayName}</strong>
          <small>
            {selected.primaryLanguage ?? 'Mixed stack'} · {selected.isPrivate ? 'Private' : 'Public'} ·{' '}
            {momentumLabel(selected)}
          </small>
        </div>
        <dl>
          <div>
            <dt>Commits</dt>
            <dd>{compactNumber(selected.commits + selected.localCommits)}</dd>
          </div>
          <div>
            <dt>PRs</dt>
            <dd>{compactNumber(selected.pullRequests)}</dd>
          </div>
          <div>
            <dt>Reviews</dt>
            <dd>{compactNumber(selected.reviews)}</dd>
          </div>
          <div>
            <dt>Active weeks</dt>
            <dd>{selected.activeWeeks}</dd>
          </div>
        </dl>
        {selected.url && (
          <a href={selected.url} rel="noreferrer" target="_blank">
            Open repository <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>
      <p className="constellation__note">{lensConfig.explanation}</p>
    </div>
  )
}
