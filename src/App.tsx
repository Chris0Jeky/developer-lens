import { Suspense, lazy, useCallback, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { PullRequestMetric, RangeKey } from '../shared/types'
import './App.css'
import { ActivityHeatmap } from './components/ActivityHeatmap'
import { CoveragePanel } from './components/CoveragePanel'
import { DnaPanel } from './components/DnaPanel'
import { InsightStack } from './components/InsightStack'
import { JourneyNav } from './components/JourneyNav'
import { LanguageLandscape } from './components/LanguageLandscape'
import { LensLogo } from './components/LensLogo'
import { MetricCard } from './components/MetricCard'
import { PulseChart } from './components/PulseChart'
import { RepoConstellation } from './components/RepoConstellation'
import { RepoLedger } from './components/RepoLedger'
import { ShareStudio } from './components/ShareStudio'
import { SignalLab } from './components/SignalLab'
import { WrappedExperience } from './components/WrappedExperience'
import { useDashboard } from './hooks/useDashboard'
import {
  compactNumber,
  formatDuration,
  formatRange,
  percentage,
} from './lib/format'
import type { ShareContext } from './lib/sharePayload'

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

function PullRequestRow({ pullRequest }: { pullRequest: PullRequestMetric }) {
  const content = (
    <>
      <span className={pullRequest.mergedAt ? 'pr-status pr-status--merged' : 'pr-status'}>
        <GitPullRequest size={14} aria-hidden="true" />
      </span>
      <span>
        <strong>{pullRequest.title}</strong>
        <small>
          {pullRequest.repository} · #{pullRequest.number}
        </small>
      </span>
      <span className="change-stream__stats">
        {pullRequest.changedFiles !== undefined && <small>{pullRequest.changedFiles} files</small>}
        <strong>{pullRequest.mergedAt ? 'Merged' : pullRequest.state.toLowerCase()}</strong>
      </span>
    </>
  )

  if (!pullRequest.url) return <div className="change-stream__item">{content}</div>
  return (
    <a
      className="change-stream__item"
      href={pullRequest.url}
      rel="noreferrer"
      target="_blank"
    >
      {content}
    </a>
  )
}

function DashboardApp() {
  const [range, setRange] = useState<RangeKey>('6m')
  const [wrappedOpen, setWrappedOpen] = useState(false)
  const [shareContext, setShareContext] = useState<ShareContext | null>(null)
  const closeWrapped = useCallback(() => setWrappedOpen(false), [])
  const closeShare = useCallback(() => setShareContext(null), [])
  const followDashboardPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return
    event.currentTarget.style.setProperty('--spotlight-x', `${event.clientX}px`)
    event.currentTarget.style.setProperty('--spotlight-y', `${event.clientY}px`)
  }, [])
  const { data, error, loading } = useDashboard(range)
  const publicShowcase =
    data?.meta.privacy === 'public-demo' || import.meta.env.VITE_STATIC_DEMO === 'true'

  return (
    <div className="app" id="top" onPointerMove={followDashboardPointer}>
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />
      <header className="app-header">
        <a className="brand-link" href="#top">
          <LensLogo />
        </a>
        {data && <JourneyNav />}
        <div className="app-header__actions">
          <RangeSwitch onChange={setRange} range={range} />
          <span className={`local-pill${publicShowcase ? ' local-pill--public' : ''}`}>
            {publicShowcase ? (
              <Sparkles size={12} aria-hidden="true" />
            ) : (
              <Lock size={12} aria-hidden="true" />
            )}
            {publicShowcase ? 'Public demo' : 'Local only'}
          </span>
        </div>
      </header>

      {loading && !data && <LoadingState />}
      {error && !data && (
        <main className="error-state">
          <ShieldCheck size={34} aria-hidden="true" />
          <span className="eyebrow">
            {publicShowcase ? 'The showcase file is unavailable' : 'The private API is offline'}
          </span>
          <h1>
            {publicShowcase
              ? 'The synthetic showcase could not come into focus.'
              : 'Your data stayed private. The viewer needs its local service.'}
          </h1>
          <p>{error}</p>
        </main>
      )}

      {data && (
        <>
          {data.meta.mode === 'demo' && (
            <div className="demo-banner">
              <Sparkles size={15} aria-hidden="true" />
              {publicShowcase ? (
                <span>
                  Public showcase · every event and repository below is synthetic. No GitHub account
                  data is hosted.
                </span>
              ) : (
                <span>
                  Illustrative lens active. Run <code>npm run collect</code> for your private story.
                </span>
              )}
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
                  <button
                    className="share-launch"
                    onClick={() => setShareContext({ kind: 'overview' })}
                    type="button"
                  >
                    <Share2 size={16} aria-hidden="true" /> Share or export
                  </button>
                  <a className="text-button" href="#rhythm">
                    Follow the signal trail <ArrowRight size={16} aria-hidden="true" />
                  </a>
                </div>
                <div className="hero-trust">
                  <span>
                    <ShieldCheck size={14} aria-hidden="true" /> {data.meta.coverageScore}%{' '}
                    {publicShowcase ? 'synthetic dataset coverage' : 'source coverage'}
                  </span>
                  <span>
                    {publicShowcase ? (
                      <Sparkles size={13} aria-hidden="true" />
                    ) : (
                      <Lock size={13} aria-hidden="true" />
                    )}
                    {publicShowcase
                      ? 'No personal GitHub data'
                      : `${data.summary.privateRepositories} private repos included`}
                  </span>
                </div>
              </div>
              <button
                aria-label={`Open Wrapped for ${data.archetype.name}`}
                className="hero-lens"
                onClick={() => setWrappedOpen(true)}
                type="button"
              >
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
                <span className="hero-lens__hint">Enter the story <ArrowRight size={13} aria-hidden="true" /></span>
              </button>
            </section>

            <section className="metric-grid" aria-label="Headline development statistics">
              <MetricCard
                accent="#b79bff"
                basis="Authored GitHub commits plus deduplicated local-only commits."
                detail="GitHub-qualified plus local-only commits"
                href="#rhythm"
                icon={<GitCommit size={19} />}
                insight="Continuity signal—not effort or output."
                label="Observed commits"
                value={compactNumber(data.summary.commits)}
              />
              <MetricCard
                accent="#5be5bb"
                basis="Authored pull requests with an observed merged timestamp."
                detail={`${percentage(data.summary.mergeRate)} of authored PRs are merged`}
                href="#delivery"
                icon={<GitMerge size={19} />}
                insight="Integration outcomes across the visible system."
                label="Merged pull requests"
                value={compactNumber(data.summary.mergedPullRequests)}
              />
              <MetricCard
                accent="#6fd7ff"
                basis="Submitted pull-request reviews visible to the authenticated account."
                detail={`${Math.round(data.summary.reviews / Math.max(1, data.summary.pullRequests) * 10) / 10} reviews per authored PR`}
                href="#delivery"
                icon={<MessageSquare size={19} />}
                insight="A collaboration surface, not a quality score."
                label="Submitted reviews"
                value={compactNumber(data.summary.reviews)}
              />
              <MetricCard
                accent="#ffd166"
                basis="Calendar days with at least one deduplicated visible event."
                detail={`${data.summary.longestStreak}-day longest visible run`}
                href="#rhythm"
                icon={<Calendar size={19} />}
                insight="Cadence shape without guessing hours worked."
                label="Active development days"
                value={String(data.summary.activeDays)}
              />
              <MetricCard
                accent="#ff91a4"
                basis="Repositories attached to commits, PRs, reviews, or issues in range."
                detail={`${data.summary.privateRepositories} private · ${data.summary.effectiveRepositories} effective`}
                href="#projects"
                icon={<Boxes size={19} />}
                insight="Portfolio breadth before sustained-attention weighting."
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
                  {publicShowcase
                    ? 'The hosted constellation uses invented systems. Private markers demonstrate the local experience without exposing a real portfolio.'
                    : 'Repository size reflects sustained observable engagement. Private systems are present, because leaving them out would tell the wrong story.'}
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
                    {publicShowcase
                      ? 'These titles and repositories are invented to demonstrate delivery flow without publishing personal activity.'
                      : 'Titles stay on this device. Bodies, diffs, filenames, and reviewer identities are not collected.'}
                  </p>
                </div>
                <div className="change-stream__list">
                  {data.pullRequests.slice(0, 6).map((pr) => (
                    <PullRequestRow key={pr.id} pullRequest={pr} />
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
                  {publicShowcase
                    ? 'The hosted artifact keeps its synthetic boundary as visible as its results.'
                    : 'Private data is useful only if its boundary is as visible as its result.'}
                </p>
              </div>
              <article className="panel coverage-wrap">
                <CoveragePanel meta={data.meta} />
              </article>
              {/*
                The Atlas and the cockpit were reachable only by typing a query string, which
                meant the deepest evidence surfaces in the product were, in practice, unreachable.
                They belong under coverage: both are about what the lens can and cannot see.
              */}
              <nav className="section-links" aria-label="Evidence surfaces">
                <a href="?view=integration-shape">
                  <Layers3 size={13} aria-hidden="true" /> Integration Shape Atlas — one finding,
                  every number traced to its evidence
                </a>
                <a href="?view=method-trial">
                  <Sparkles size={13} aria-hidden="true" /> Method Trial — why the more complex detector was rejected
                </a>
                {!publicShowcase && (
                  <a href="?view=cockpit-v2">
                    <ShieldCheck size={13} aria-hidden="true" /> Coverage cockpit — the V2 coverage
                    and capability boundary
                  </a>
                )}
              </nav>
            </section>
          </main>

          <footer className="app-footer">
            <LensLogo />
            <p>
              A local reflection on development—not a measure of productivity, quality, or human value.
            </p>
            <a
              href={
                publicShowcase
                  ? 'https://github.com/Chris0Jeky/developer-lens'
                  : 'https://github.com'
              }
              rel="noreferrer"
              target="_blank"
            >
              <CodeXml size={15} aria-hidden="true" />{' '}
              {publicShowcase
                ? 'View the source and generate your private lens'
                : 'Data sourced through your authenticated GitHub CLI'}
            </a>
          </footer>

          <WrappedExperience
            data={data}
            onClose={closeWrapped}
            onShare={setShareContext}
            open={wrappedOpen}
            suspended={Boolean(shareContext)}
          />
          <ShareStudio
            context={shareContext ?? { kind: 'overview' }}
            data={data}
            onClose={closeShare}
            open={Boolean(shareContext)}
          />
        </>
      )}
    </div>
  )
}

/**
 * The three non-default routes are lazy so the dashboard's chunk carries only the dashboard.
 * Each is a whole surface with its own dependency subtree — the V2 story, the coverage cockpit,
 * and the Atlas with the Evidence Drawer behind it — and a visitor loads exactly one of the four.
 * Statically importing all of them put every surface in one chunk that everyone downloaded.
 */
const V2Demo = lazy(() => import('./components/V2Demo').then((module) => ({ default: module.V2Demo })))
const CoverageCockpitV2Route = lazy(() =>
  import('./components/CoverageCockpitV2').then((module) => ({ default: module.CoverageCockpitV2Route })),
)
const IntegrationShapeAtlasRoute = lazy(() =>
  import('./components/IntegrationShapeAtlas').then((module) => ({ default: module.IntegrationShapeAtlasRoute })),
)

/**
 * Deliberately blank rather than a spinner. Each route renders its own honest loading state once
 * its chunk arrives, and a second, different loading treatment in front of that would be a claim
 * about progress this boundary cannot make.
 */
function RouteFallback() {
  return <div className="app" id="top" aria-busy="true" />
}

function App() {
  const route = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
  const lazyRoute =
    route?.get('demo') === 'v2' ? (
      <V2Demo />
    ) : route?.get('view') === 'cockpit-v2' ? (
      <CoverageCockpitV2Route />
    ) : route?.get('view') === 'integration-shape' ? (
      <IntegrationShapeAtlasRoute />
    ) : null

  if (lazyRoute === null) return <DashboardApp />
  return <Suspense fallback={<RouteFallback />}>{lazyRoute}</Suspense>
}

export default App
