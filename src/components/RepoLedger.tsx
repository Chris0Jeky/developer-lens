import { useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import type { RepositoryMetric } from '../../shared/types'
import { compactNumber } from '../lib/format'

function momentumValue(repo: RepositoryMetric) {
  if (repo.firstHalfActivity < 1 && repo.secondHalfActivity > 0) return 'New'
  return `${repo.momentum >= 10 ? '10+' : repo.momentum}×`
}

function RepositoryRow({ children, repo }: { children: ReactNode; repo: RepositoryMetric }) {
  if (!repo.url) return <div className="repo-row">{children}</div>

  return (
    <a className="repo-row" href={repo.url} rel="noreferrer" target="_blank">
      {children}
    </a>
  )
}

export function RepoLedger({ repositories }: { repositories: RepositoryMetric[] }) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = repositories.length > 10
  const visible = expanded ? repositories : repositories.slice(0, 10)

  return (
    <div className="repo-ledger" id="repo-ledger">
      <div className="repo-ledger__header">
        <span>Repository</span>
        <span>Visible rhythm</span>
        <span>Change flow</span>
        <span>Momentum</span>
      </div>
      {visible.map((repo, index) => (
        <RepositoryRow key={repo.key} repo={repo}>
          <span className="repo-row__identity">
            <i>{String(index + 1).padStart(2, '0')}</i>
            <span>
              <strong>{repo.displayName}</strong>
              <small>
                {repo.isPrivate && <Lock size={10} aria-label="Private" />}
                {repo.primaryLanguage ?? 'Mixed stack'}
              </small>
            </span>
          </span>
          <span>
            <strong>{repo.activeWeeks} weeks</strong>
            <small>{repo.activeDays} active days</small>
          </span>
          <span>
            <strong>{compactNumber(repo.commits + repo.localCommits)} commits</strong>
            <small>
              {repo.pullRequests} PRs · {repo.reviews} reviews
            </small>
          </span>
          <span className={repo.momentum >= 1 ? 'momentum-up' : 'momentum-down'}>
            <strong>{momentumValue(repo)}</strong>
            <small>second / first half</small>
          </span>
        </RepositoryRow>
      ))}
      <div className="repo-ledger__footer">
        <span>
          Showing {visible.length} of {repositories.length} observed repositories
        </span>
        {hasMore && (
          <button onClick={() => setExpanded((current) => !current)} type="button">
            {expanded ? 'Show the leading 10' : `Reveal all ${repositories.length}`}
          </button>
        )}
      </div>
    </div>
  )
}
