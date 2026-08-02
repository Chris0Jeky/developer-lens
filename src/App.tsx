import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  Boxes,
  Calendar,
  CodeXml,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Layers3,
  Lock,
  MessageSquare,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { RangeKey } from '../shared/types'
import './App.css'
import { ActivityHeatmap } from './components/ActivityHeatmap'
import { CoveragePanel } from './components/CoveragePanel'
import { DnaPanel } from './components/DnaPanel'
import { InsightStack } from './components/InsightStack'
import { LanguageLandscape } from './components/LanguageLandscape'
import { LensLogo } from './components/LensLogo'
import { MetricCard } from './components/MetricCard'
import { PulseChart } from './components/PulseChart'
import { RepoConstellation } from './components/RepoConstellation'
import { RepoLedger } from './components/RepoLedger'
import { SignalLab } from './components/SignalLab'
import { WrappedExperience } from './components/WrappedExperience'
import { useDashboard } from './hooks/useDashboard'
import {
  compactNumber,
  formatDuration,
  formatRange,
  percentage,
} from './lib/format'

function RangeSwitch({ range, onChange }: { range: RangeKey; onChange: (range: RangeKey) => void }) {
  return (
    <div className="range-switch" aria-label="Analysis range">
      <button
        aria-pressed={range === '6m'}
        className={range === '6m' ? 'is-active' : ''}
        onClick={() => onChange('6m')}
        type="button"
      >
        6 months
      </button>
      <button
        aria-pressed={range === '12m'}
        className={range === '12m' ? 'is-active' : ''}
        onClick={() => onChange('12m')}
        type="button"
      >
        1 year
      </button>
    </div>
  )
}

function LoadingState() {
  return (
    <main className="loading-state">
      <div className="loading-lens" aria-hidden="true"><span /></div>
      <span className="eyebrow">Resolving your development trace</span>
      <h1>Bringing the pattern into focus…</h1>
    </main>
  )
}

function App() {
  const [range, setRange] = useState<RangeKey>('6m')
  const [wrappedOpen, setWrappedOpen] = useState(false)
  const { data, error, loading } = useDashboard(range)

  return (
    <div className="app" id="top">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />
      <header className="app-header">
        <a className="brand-link" href="#top">
          <LensLogo />
        </a>
        <nav aria-label="Main navigation">
          <a href="#rhythm">Rhythm</a>
          <a href="#projects">Projects</a>
          <a href="#insights">Insights</a>
          <a href="#sources">Sources</a>
        </nav>
        <div className="app-header__actions">
          <RangeSwitch onChange={setRange} range={range} />
          <span className="local-pill">
            <Lock size={12} aria-hidden="true" /> Local only
          </span>
        </div>
      </header>

      {loading && !data && <LoadingState />}
      {error && !data && (
        <main className="error-state">
          <ShieldCheck size={34} aria-hidden="true" />
          <span className="eyebrow">The private API is offline</span>
          <h1>Your data stayed private. The viewer needs its local service.</h1>
          <p>{error}</p>
        </main>
      )}

      {data && (
        <>
          {data.meta.mode === 'demo' && (
            <div className="demo-banner">
              <Sparkles size={15} aria-hidden="true" />
              <span>
                Illustrative lens active. Run <code>npm run collect</code> for your private story.
              </span>
            </div>
          )}
          <main>
            <section className="hero-section">
              <div className="hero-copy">
                <span className="eyebrow hero-eyebrow">
                  <span className="status-dot" /> {formatRange(data.meta.from, data.meta.to)}
                </span>
                <h1>
                  Your development trail,
                  <span> brought into focus.</span>
                </h1>
                <p className="hero-lede">{data.archetype.description}</p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => setWrappedOpen(true)} type="button">
                    <Play fill="currentColor" size={15} aria-hidden="true" />
                    Start your Wrapped
                  </button>
                  <a className="text-button" href="#insights">
                    Explore the connections <ArrowRight size={16} aria-hidden="true" />
                  </a>
                </div>
                <div className="hero-trust">
                  <span>
                    <ShieldCheck size={14} aria-hidden="true" /> {data.meta.coverageScore}% source coverage
                  </span>
                  <span>
                    <Lock size={13} aria-hidden="true" /> {data.summary.privateRepositories} private repos included
                  </span>
                </div>
              </div>
              <div className="hero-lens" aria-label={`${data.archetype.name} development archetype`}>
                <div className="hero-lens__orbit hero-lens__orbit--outer" />
                <div className="hero-lens__orbit hero-lens__orbit--inner" />
                <div className="hero-lens__core">
                  <span>Your signature</span>
                  <strong>{data.archetype.shortName}</strong>
                  <i />
                  <small>{data.summary.effectiveRepositories} effective repositories</small>
                </div>
                <div className="hero-lens__satellite hero-lens__satellite--one">
                  <strong>{compactNumber(data.summary.mergedPullRequests)}</strong>
                  <span>merged</span>
                </div>
                <div className="hero-lens__satellite hero-lens__satellite--two">
                  <strong>{data.summary.activeWeeks}</strong>
                  <span>active weeks</span>
                </div>
                <div className="hero-lens__satellite hero-lens__satellite--three">
                  <strong>{data.summary.repositories}</strong>
                  <span>repos</span>
                </div>
              </div>
            </section>

            <section className="metric-grid" aria-label="Headline development statistics">
              <MetricCard
                accent="#b79bff"
                detail="GitHub-qualified plus local-only commits"
                href="#rhythm"
                icon={<GitCommit size={19} />}
                label="Observed commits"
                value={compactNumber(data.summary.commits)}
              />
              <MetricCard
                accent="#5be5bb"
                detail={`${percentage(data.summary.mergeRate)} of authored PRs are merged`}
                href="#delivery"
                icon={<GitMerge size={19} />}
                label="Merged pull requests"
                value={compactNumber(data.summary.mergedPullRequests)}
              />
              <MetricCard
                accent="#6fd7ff"
                detail={`${Math.round(data.summary.reviews / Math.max(1, data.summary.pullRequests) * 10) / 10} reviews per authored PR`}
                href="#delivery"
                icon={<MessageSquare size={19} />}
                label="Submitted reviews"
                value={compactNumber(data.summary.reviews)}
              />
              <MetricCard
                accent="#ffd166"
                detail={`${data.summary.longestStreak}-day longest visible run`}
                href="#rhythm"
                icon={<Calendar size={19} />}
                label="Active development days"
                value={String(data.summary.activeDays)}
              />
              <MetricCard
                accent="#ff91a4"
                detail={`${data.summary.privateRepositories} private · ${data.summary.effectiveRepositories} effective`}
                href="#projects"
                icon={<Boxes size={19} />}
                label="Repositories in motion"
                value={String(data.summary.repositories)}
              />
            </section>

            <section className="section-block" id="rhythm">
              <div className="section-heading section-heading--split">
                <div>
                  <span className="eyebrow">01 · Development rhythm</span>
                  <h2>The topography of your attention</h2>
                </div>
                <p>
                  Visible activity rose and fell in waves. The logarithmic lens keeps singularly large
                  days from erasing the quieter continuity around them.
                </p>
              </div>
              <div className="rhythm-grid">
                <article className="panel panel--wide pulse-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-kicker">Weekly pulse</span>
                      <h3>Making, proposing, reviewing</h3>
                    </div>
                    <div className="chart-legend" aria-hidden="true">
                      <span><i className="legend-commit" /> Commits</span>
                      <span><i className="legend-pr" /> PRs</span>
                      <span><i className="legend-review" /> Reviews</span>
                    </div>
                  </div>
                  <PulseChart weekly={data.weekly} />
                </article>
                <article className="panel heatmap-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-kicker">Continuity map</span>
                      <h3>{data.summary.activeDays} days lit up</h3>
                    </div>
                    <Activity size={18} aria-hidden="true" />
                  </div>
                  <ActivityHeatmap activity={data.activity} />
                  <div className="heatmap-summary">
                    <div>
                      <span>Strongest month</span>
                      <strong>{data.summary.strongestMonth?.month ?? 'Not enough data'}</strong>
                    </div>
                    <div>
                      <span>Longest run</span>
                      <strong>{data.summary.longestStreak} days</strong>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <section className="section-block" id="projects">
              <div className="section-heading">
                <span className="eyebrow">02 · Project gravity</span>
                <h2>A constellation, not a leaderboard</h2>
                <p>
                  Repository size reflects sustained observable engagement. Private systems are present,
                  because leaving them out would tell the wrong story.
                </p>
              </div>
              <div className="project-grid">
                <article className="panel panel--constellation">
                  <RepoConstellation repositories={data.repositories} />
                </article>
                <article className="panel language-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-kicker">Technical landscape</span>
                      <h3>Languages around the lens</h3>
                    </div>
                    <Layers3 size={18} aria-hidden="true" />
                  </div>
                  <LanguageLandscape languages={data.languages} />
                </article>
              </div>
              <RepoLedger repositories={data.repositories} />
            </section>

            <section className="section-block" id="signals">
              <div className="section-heading section-heading--split">
                <div>
                  <span className="eyebrow">03 · Signal lab</span>
                  <h2>Go past totals. Inspect the shape of the system.</h2>
                </div>
                <p>
                  Six reproducible lenses expose integration tails, change-batch shape, feedback,
                  coordination, cadence, and portfolio motion. Open any method to see its formula.
                </p>
              </div>
              <SignalLab signals={data.signals} />
            </section>

            <section className="section-block" id="delivery">
              <div className="section-heading section-heading--split">
                <div>
                  <span className="eyebrow">04 · Developer DNA</span>
                  <h2>The shape behind the totals</h2>
                </div>
                <p>
                  Six interpretable signatures describe the trace. They are lenses into working patterns,
                  never a composite developer score.
                </p>
              </div>
              <article className="panel dna-panel">
                <DnaPanel archetype={data.archetype} dna={data.dna} themes={data.themes} />
              </article>
              <div className="change-stream">
                <div className="change-stream__intro">
                  <span className="eyebrow">Recent authored change</span>
                  <h3>A small window into the delivery stream</h3>
                  <p>
                    Titles stay on this device. Bodies, diffs, filenames, and reviewer identities are not
                    collected.
                  </p>
                </div>
                <div className="change-stream__list">
                  {data.pullRequests.slice(0, 6).map((pr) => (
                    <a href={pr.url} key={pr.id} rel="noreferrer" target="_blank">
                      <span className={pr.mergedAt ? 'pr-status pr-status--merged' : 'pr-status'}>
                        <GitPullRequest size={14} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{pr.title}</strong>
                        <small>{pr.repository} · #{pr.number}</small>
                      </span>
                      <span className="change-stream__stats">
                        {pr.changedFiles !== undefined && <small>{pr.changedFiles} files</small>}
                        <strong>{pr.mergedAt ? 'Merged' : pr.state.toLowerCase()}</strong>
                      </span>
                    </a>
                  ))}
                </div>
                <div className="delivery-badge">
                  <span>{formatDuration(data.summary.medianMergeHours)}</span>
                  <small>median observed creation → merge</small>
                </div>
              </div>
            </section>

            <section className="section-block insights-section" id="insights">
              <div className="section-heading section-heading--split">
                <div>
                  <span className="eyebrow">05 · Connections</span>
                  <h2>Facts become patterns. Patterns become hypotheses.</h2>
                </div>
                <p>
                  Each card keeps its evidence and limitation attached. Higher-order connections appear
                  only when independent signals align.
                </p>
              </div>
              <InsightStack insights={data.insights} />
            </section>

            <section className="section-block" id="sources">
              <div className="section-heading">
                <span className="eyebrow">06 · Coverage & privacy</span>
                <h2>Every insight should know what it cannot see</h2>
                <p>
                  Private data is useful only if its boundary is as visible as its result.
                </p>
              </div>
              <article className="panel coverage-wrap">
                <CoveragePanel meta={data.meta} />
              </article>
            </section>
          </main>

          <footer className="app-footer">
            <LensLogo />
            <p>
              A local reflection on development—not a measure of productivity, quality, or human value.
            </p>
            <a href="https://github.com" rel="noreferrer" target="_blank">
              <CodeXml size={15} aria-hidden="true" /> Data sourced through your authenticated GitHub CLI
            </a>
          </footer>

          <WrappedExperience data={data} onClose={() => setWrappedOpen(false)} open={wrappedOpen} />
        </>
      )}
    </div>
  )
}

export default App
