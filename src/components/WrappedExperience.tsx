import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  GitMerge,
  Lock,
  Sparkles,
  X,
} from 'lucide-react'
import type { DashboardData } from '../../shared/types'
import { compactNumber, formatDuration, percentage, precisePercentage } from '../lib/format'
import { LensLogo } from './LensLogo'

interface WrappedExperienceProps {
  data: DashboardData
  open: boolean
  onClose: () => void
}

interface Story {
  id: string
  chapter: string
  variant: string
  content: ReactNode
}

function OrbitStory({ data }: { data: DashboardData }) {
  const visible = data.repositories.slice(0, 9)
  return (
    <div className="wrapped-orbit" aria-hidden="true">
      {visible.map((repo, index) => {
        const angle = (index / visible.length) * Math.PI * 2 - Math.PI / 2
        const distance = index === 0 ? 0 : 95 + (index % 3) * 38
        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance
        const size = index === 0 ? 96 : 32 + Math.min(34, Math.sqrt(repo.engagement) / 2.8)
        return (
          <motion.span
            key={repo.key}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1, x, y }}
            transition={{ delay: 0.08 * index, type: 'spring' }}
            style={{
              width: size,
              height: size,
              background: repo.languageColor ?? 'rgba(181,150,255,.72)',
              borderStyle: repo.isPrivate ? 'dashed' : 'solid',
            }}
            title={repo.displayName}
          />
        )
      })}
    </div>
  )
}

export function WrappedExperience({ data, onClose, open }: WrappedExperienceProps) {
  const [index, setIndex] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const reduceMotion = useReducedMotion()
  const topRepo = data.repositories[0]
  const topLanguage = data.languages[0]
  const privateEngagement = data.repositories
    .filter((repo) => repo.isPrivate)
    .reduce((sum, repo) => sum + repo.engagement, 0)
  const totalEngagement = data.repositories.reduce((sum, repo) => sum + repo.engagement, 0)
  const finalInsight =
    data.insights.find((insight) => insight.order === 3) ?? data.insights.at(-1)

  const stories = useMemo<Story[]>(
    () => [
      {
        id: 'opening',
        chapter: '01 · The opening frame',
        variant: 'violet',
        content: (
          <div className="wrapped-copy wrapped-copy--center">
            <span className="wrapped-kicker">Your {data.meta.range === '6m' ? 'six months' : 'year'} in development</span>
            <h2>You didn’t just write code.</h2>
            <p>You left a trace of systems changing, ideas converging, and work crossing the line.</p>
            <div className="wrapped-hero-number">
              <strong>{compactNumber(data.summary.contributions)}</strong>
              <span>visible contribution signals</span>
            </div>
          </div>
        ),
      },
      {
        id: 'constellation',
        chapter: '02 · The constellation',
        variant: 'midnight',
        content: (
          <div className="wrapped-split">
            <OrbitStory data={data} />
            <div className="wrapped-copy">
              <span className="wrapped-kicker">Your development universe</span>
              <h2>
                {data.summary.repositories} repositories.{' '}
                <em>{data.summary.effectiveRepositories} held the gravity.</em>
              </h2>
              <p>
                {topRepo?.displayName ?? 'Your leading project'} became the strongest centre of visible
                attention—without erasing the systems moving around it.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'archetype',
        chapter: '03 · Your signature',
        variant: 'sunrise',
        content: (
          <div className="wrapped-copy wrapped-copy--wide">
            <span className="wrapped-kicker">Your builder archetype</span>
            <h2>{data.archetype.name}</h2>
            <p>{data.archetype.description}</p>
            <div className="wrapped-signal-row">
              {data.archetype.signals.map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'rhythm',
        chapter: '04 · The rhythm',
        variant: 'aqua',
        content: (
          <div className="wrapped-copy">
            <span className="wrapped-kicker">The pulse was sustained—not uniform</span>
            <h2>
              {data.summary.activeWeeks} weeks lit up.
              <em> {data.summary.longestStreak} days formed the longest run.</em>
            </h2>
            <div className="wrapped-rhythm-bars" aria-hidden="true">
              {data.weekly.slice(-26).map((week) => (
                <i
                  key={week.week}
                  style={{ height: `${12 + Math.log1p(week.total) * 12}px` }}
                />
              ))}
            </div>
            <p>
              {data.summary.strongestMonth?.month ?? 'The strongest month'} carried the clearest visible
              wave. Cadence is a shape, not a score.
            </p>
          </div>
        ),
      },
      {
        id: 'delivery',
        chapter: '05 · Crossing the line',
        variant: 'ember',
        content: (
          <div className="wrapped-copy wrapped-copy--center">
            <GitMerge className="wrapped-icon" aria-hidden="true" />
            <span className="wrapped-kicker">The integration loop</span>
            <h2>
              {compactNumber(data.summary.mergedPullRequests)} merges.{' '}
              <em>{percentage(data.summary.mergeRate)} observed merge rate.</em>
            </h2>
            <p>
              Median creation-to-merge: {formatDuration(data.summary.medianMergeHours)}. Fast can mean
              small batches, strong automation, or repository convention—not quality by itself.
            </p>
          </div>
        ),
      },
      {
        id: 'hidden',
        chapter: '06 · Beyond the public profile',
        variant: 'gold',
        content: (
          <div className="wrapped-copy wrapped-copy--wide">
            <Lock className="wrapped-icon" aria-hidden="true" />
            <span className="wrapped-kicker">The hidden portfolio</span>
            <h2>
              {data.summary.privateRepositories} private repositories carried{' '}
              <em>{Math.round((privateEngagement / Math.max(1, totalEngagement)) * 100)}% of attributed engagement.</em>
            </h2>
            <p>
              Authenticated enrichment changed the story. This private surface remains on this device
              and never enters the tracked application bundle.
            </p>
          </div>
        ),
      },
      {
        id: 'landscape',
        chapter: '07 · The technical landscape',
        variant: 'cobalt',
        content: (
          <div className="wrapped-copy">
            <span className="wrapped-kicker">The toolbox in motion</span>
            <h2>
              {topLanguage?.name ?? 'Multiple languages'} led a landscape of{' '}
              <em>{data.languages.length} detected languages.</em>
            </h2>
            <div className="wrapped-language-stack">
              {data.languages.slice(0, 6).map((language) => (
                <span
                  key={language.name}
                  style={{
                    borderColor: language.color,
                    flexGrow: language.share,
                  }}
                >
                  {language.name} · {precisePercentage(language.share)}
                </span>
              ))}
            </div>
            <p>Weighted by repository activity and current language composition—a proxy with its limits visible.</p>
          </div>
        ),
      },
      {
        id: 'connection',
        chapter: '08 · The deeper connection',
        variant: 'rose',
        content: (
          <div className="wrapped-copy wrapped-copy--wide">
            <Sparkles className="wrapped-icon" aria-hidden="true" />
            <span className="wrapped-kicker">A third-order hypothesis</span>
            <h2>{finalInsight?.title ?? 'The pattern is still forming'}</h2>
            <p>{finalInsight?.body ?? 'More evidence is needed before a higher-order pattern can be named.'}</p>
            {finalInsight && (
              <div className="wrapped-signal-row">
                {finalInsight.evidence.map((evidence) => (
                  <span key={evidence}>{evidence}</span>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'closing',
        chapter: '09 · The next lens',
        variant: 'finale',
        content: (
          <div className="wrapped-copy wrapped-copy--center">
            <CalendarDays className="wrapped-icon" aria-hidden="true" />
            <span className="wrapped-kicker">This is a reflection, not a verdict</span>
            <h2>What will the next chapter make visible?</h2>
            <p>
              Revisit the constellation, follow the evidence trails, and use the quiet work—not only the
              loud numbers—to decide what deserves your attention next.
            </p>
            <button className="wrapped-finish" onClick={onClose} type="button">
              Return to your lens <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ],
    [data, finalInsight, onClose, privateEngagement, topLanguage, topRepo, totalEngagement],
  )

  useEffect(() => {
    if (!open) return
    setIndex(0)
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-wrapped-close]')?.focus()
    })
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') {
        setIndex((current) => Math.min(stories.length - 1, current + 1))
      }
      if (event.key === 'ArrowLeft') {
        setIndex((current) => Math.max(0, current - 1))
      }
      if (event.key === 'Tab') {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable.at(-1) ?? first
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
      returnFocusRef.current?.focus()
    }
  }, [onClose, open, stories.length])

  if (!open) return null
  const story = stories[index]

  return createPortal(
    <div
      className={`wrapped wrapped--${story.variant}`}
      role="dialog"
      aria-modal="true"
      aria-label="Developer Lens Wrapped"
      aria-describedby="wrapped-description"
      ref={dialogRef}
    >
      <p className="sr-only" id="wrapped-description">
        A nine-part interactive development retrospective. Use the arrow keys or the controls to
        move between chapters; press Escape to close.
      </p>
      <span aria-live="polite" className="sr-only">
        {story.chapter}. Story {index + 1} of {stories.length}.
      </span>
      <div className="wrapped__grain" aria-hidden="true" />
      <header className="wrapped__header">
        <LensLogo />
        <span>{story.chapter}</span>
        <button aria-label="Close Wrapped" data-wrapped-close onClick={onClose} type="button">
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className="wrapped__progress" aria-label={`Story ${index + 1} of ${stories.length}`}>
        {stories.map((item, itemIndex) => (
          <button
            aria-current={itemIndex === index ? 'step' : undefined}
            aria-label={`Go to ${item.chapter}`}
            className={itemIndex <= index ? 'is-active' : ''}
            key={item.id}
            onClick={() => setIndex(itemIndex)}
            type="button"
          >
            <span />
          </button>
        ))}
      </div>
      <main className="wrapped__stage">
        <AnimatePresence mode="wait">
          <motion.section
            key={story.id}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.985, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 1.012, x: -24 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {story.content}
          </motion.section>
        </AnimatePresence>
      </main>
      <footer className="wrapped__controls">
        <button
          disabled={index === 0}
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
          type="button"
        >
          <ArrowLeft size={17} aria-hidden="true" /> Previous
        </button>
        <span>
          {String(index + 1).padStart(2, '0')} / {String(stories.length).padStart(2, '0')}
        </span>
        <button
          disabled={index === stories.length - 1}
          onClick={() => setIndex((current) => Math.min(stories.length - 1, current + 1))}
          type="button"
        >
          Next <ArrowRight size={17} aria-hidden="true" />
        </button>
      </footer>
    </div>,
    document.body,
  )
}
