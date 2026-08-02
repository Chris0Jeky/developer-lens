import { motion } from 'framer-motion'
import { Lock, Radio } from 'lucide-react'
import type { RepositoryMetric } from '../../shared/types'
import { compactNumber } from '../lib/format'

interface RepoConstellationProps {
  repositories: RepositoryMetric[]
}

const POSITIONS = [
  [306, 188],
  [170, 124],
  [452, 108],
  [454, 268],
  [176, 286],
  [75, 197],
  [556, 194],
  [306, 48],
  [305, 338],
  [90, 70],
  [540, 65],
  [550, 330],
] as const

export function RepoConstellation({ repositories }: RepoConstellationProps) {
  const visible = repositories.slice(0, POSITIONS.length)
  const maximum = Math.max(...visible.map((repo) => repo.engagement), 1)
  const privateCount = repositories.filter((repo) => repo.isPrivate).length

  return (
    <div className="constellation">
      <div className="constellation__legend">
        <span>
          <Radio size={13} aria-hidden="true" /> {repositories.length} observed
        </span>
        <span>
          <Lock size={12} aria-hidden="true" /> {privateCount} private
        </span>
      </div>
      <svg
        viewBox="0 0 620 390"
        role="img"
        aria-label="Repository constellation sized by activity engagement"
      >
        <defs>
          <radialGradient id="repoGlow" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#eadfff" stopOpacity=".96" />
            <stop offset="38%" stopColor="#9c79ee" stopOpacity=".83" />
            <stop offset="100%" stopColor="#5d36b5" stopOpacity=".45" />
          </radialGradient>
          <filter id="softGlow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="constellation__orbits" aria-hidden="true">
          <ellipse cx="306" cy="190" rx="226" ry="111" />
          <ellipse cx="306" cy="190" rx="150" ry="168" transform="rotate(48 306 190)" />
          <ellipse cx="306" cy="190" rx="96" ry="266" transform="rotate(82 306 190)" />
        </g>
        {visible.map((repo, index) => {
          const [x, y] = POSITIONS[index]
          const radius = 15 + Math.sqrt(repo.engagement / maximum) * 47
          const labelVisible = index < 8
          const node = (
            <motion.g
              key={repo.key}
              className="constellation__node"
              initial={{ opacity: 0, scale: 0.4 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.045, type: 'spring', stiffness: 140 }}
              style={{ transformOrigin: `${x}px ${y}px` }}
              tabIndex={repo.url ? 0 : undefined}
              role={repo.url ? 'link' : undefined}
              aria-label={`${repo.displayName}, ${compactNumber(repo.engagement)} engagement points${repo.isPrivate ? ', private' : ''}`}
              onClick={() => {
                if (repo.url) window.open(repo.url, '_blank', 'noopener,noreferrer')
              }}
              onKeyDown={(event) => {
                if (repo.url && (event.key === 'Enter' || event.key === ' ')) {
                  window.open(repo.url, '_blank', 'noopener,noreferrer')
                }
              }}
            >
              <circle
                className="constellation__halo"
                cx={x}
                cy={y}
                r={radius + 7}
                style={{ opacity: 0.12 + (radius / 70) * 0.2 }}
              />
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={repo.languageColor ?? 'url(#repoGlow)'}
                fillOpacity={repo.languageColor ? 0.72 : 1}
                stroke={repo.isPrivate ? '#ffd166' : 'rgba(236,231,255,.72)'}
                strokeWidth={repo.isPrivate ? 1.6 : 0.8}
                strokeDasharray={repo.isPrivate ? '4 3' : undefined}
                filter={index < 3 ? 'url(#softGlow)' : undefined}
              />
              {repo.isPrivate && (
                <path
                  d={`M ${x - 3.4} ${y - 1} v-3.2 a3.4 3.4 0 0 1 6.8 0 v3.2 M ${x - 5} ${y - 1} h10 v8 h-10 z`}
                  fill="none"
                  stroke="#fff5ca"
                  strokeWidth="1.4"
                />
              )}
              {labelVisible && (
                <>
                  <text x={x} y={y + radius + 17} textAnchor="middle">
                    {repo.displayName.length > 22
                      ? `${repo.displayName.slice(0, 20)}…`
                      : repo.displayName}
                  </text>
                  <text
                    className="constellation__metric"
                    x={x}
                    y={y + radius + 31}
                    textAnchor="middle"
                  >
                    {compactNumber(repo.commits + repo.localCommits)} commits ·{' '}
                    {repo.pullRequests} PRs
                  </text>
                </>
              )}
            </motion.g>
          )
          return node
        })}
      </svg>
      <p className="constellation__note">
        Size blends sustained activity across commits, authored changes, reviews, and issues. It is
        a map of attention—not impact.
      </p>
    </div>
  )
}
