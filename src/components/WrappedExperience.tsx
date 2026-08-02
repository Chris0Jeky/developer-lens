import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  GitMerge,
  LayoutGrid,
  Lightbulb,
  Lock,
  Share2,
  Sparkles,
  X,
} from 'lucide-react'
import type { DashboardData } from '../../shared/types'
import { compactNumber, formatDuration, percentage, precisePercentage } from '../lib/format'
import type { ShareContext } from '../lib/sharePayload'
import { LensLogo } from './LensLogo'

interface WrappedExperienceProps {
  data: DashboardData
  open: boolean
  onClose: () => void
  onShare?: (context: ShareContext) => void
  suspended?: boolean
}

interface Story {
  id: string
  chapter: string
  title: string
  variant: string
  content: ReactNode
  reveal: {
    label: string
    title: string
    body: string
    evidence: string[]
  }
}

const STORY_MOTION = {
  enter: (direction: number) => ({ opacity: 0, scale: 0.985, x: direction > 0 ? 64 : -64 }),
  center: { opacity: 1, scale: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, scale: 1.01, x: direction > 0 ? -64 : 64 }),
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

export function WrappedExperience({
  data,
  onClose,
  onShare,
  open,
  suspended = false,
}: WrappedExperienceProps) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [revealOpen, setRevealOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const reduceMotion = useReducedMotion()
  const publicDemo = data.meta.privacy === 'public-demo'
  const topRepo = data.repositories[0]
  const topLanguage = data.languages[0]
  const privateEngagement = data.repositories
    .filter((repo) => repo.isPrivate)
    .reduce((sum, repo) => sum + repo.engagement, 0)
  const totalEngagement = data.repositories.reduce((sum, repo) => sum + repo.engagement, 0)
  const finalInsight =
    data.insights.find((insight) => insight.order === 3) ?? data.insights.at(-1)
  const strongestDna = [...data.dna].sort((left, right) => right.value - left.value)[0]
  const contributionPerWeek = Math.round(
    data.summary.contributions / Math.max(1, data.summary.activeWeeks),
  )

  const stories = useMemo<Story[]>(
    () => [
      {
        id: 'opening',
        chapter: '01 · The opening frame',
        title: publicDemo ? 'A portfolio came into focus.' : 'You didn’t just write code.',
        variant: 'violet',
        content: (
          <div className="wrapped-copy wrapped-copy--center">
            <span className="wrapped-kicker">
              {publicDemo ? 'A synthetic' : 'Your'}{' '}
              {data.meta.range === '6m' ? 'six months' : 'year'} in development
            </span>
            <h2>{publicDemo ? 'A portfolio came into focus.' : 'You didn’t just write code.'}</h2>
            <p>
              {publicDemo
                ? 'Invented systems demonstrate how ideas, feedback, and work crossing the line become a story.'
                : 'You left a trace of systems changing, ideas converging, and work crossing the line.'}
            </p>
            <div className="wrapped-hero-number">
              <strong>{compactNumber(data.summary.contributions)}</strong>
              <span>visible contribution signals</span>
            </div>
          </div>
        ),
        reveal: {
          label: 'Read the density',
          title: `${compactNumber(contributionPerWeek)} signals per active week`,
          body:
            'This normalises the visible trace by weeks with activity. It describes density during active periods, not hours worked or productivity.',
          evidence: [
            `${compactNumber(data.summary.contributions)} visible contribution signals`,
            `${data.summary.activeWeeks} weeks with observable activity`,
          ],
        },
      },
      {
        id: 'constellation',
        chapter: '02 · The constellation',
        title: `${data.summary.repositories} repositories. ${data.summary.effectiveRepositories} held the gravity.`,
        variant: 'midnight',
        content: (
          <div className="wrapped-split">
            <OrbitStory data={data} />
            <div className="wrapped-copy">
            <span className="wrapped-kicker">
              {publicDemo ? 'The synthetic development universe' : 'Your development universe'}
            </span>
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
        reveal: {
          label: 'Why “effective” matters',
          title: 'Breadth and concentration can coexist.',
          body:
            'Effective repositories discounts the faintest traces, so one incidental commit cannot carry the same narrative weight as sustained work.',
          evidence: [
            `${data.summary.repositories} repositories were observed`,
            `${data.summary.effectiveRepositories} crossed the sustained-engagement threshold`,
          ],
        },
      },
      {
        id: 'archetype',
        chapter: '03 · Your signature',
        title: data.archetype.name,
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
        reveal: {
          label: 'Inspect the signature',
          title: `${strongestDna?.label ?? 'The leading dimension'} is the strongest visible axis.`,
          body:
            'The archetype is selected by transparent thresholds across the six DNA dimensions. It is a descriptive lens, never a composite performance score.',
          evidence: [
            `${strongestDna?.value ?? 0}% ${strongestDna?.label.toLowerCase() ?? 'leading'} signature`,
            ...data.archetype.signals.slice(0, 2),
          ],
        },
      },
      {
        id: 'rhythm',
        chapter: '04 · The rhythm',
        title: `${data.summary.activeWeeks} weeks lit up.`,
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
        reveal: {
          label: 'Read the cadence',
          title: `${data.summary.longestStreak} days formed the longest visible run.`,
          body:
            'Runs and waves show continuity, but they cannot distinguish deep work from small events. The dashboard keeps the event mix nearby for that reason.',
          evidence: [
            `${data.summary.activeDays} active days`,
            `${data.summary.strongestMonth?.month ?? 'No single month'} carried the strongest visible wave`,
          ],
        },
      },
      {
        id: 'delivery',
        chapter: '05 · Crossing the line',
        title: `${compactNumber(data.summary.mergedPullRequests)} changes crossed the line.`,
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
        reveal: {
          label: 'Interrogate the loop',
          title: `${formatDuration(data.summary.medianMergeHours)} median creation-to-merge`,
          body:
            'Merge timing is a system signal. Small batches, automation, review norms, queueing, and project risk can all move it—speed alone is not quality.',
          evidence: [
            `${percentage(data.summary.mergeRate)} observed merge rate`,
            `${compactNumber(data.summary.reviews)} submitted reviews`,
          ],
        },
      },
      {
        id: 'hidden',
        chapter: publicDemo ? '06 · The public boundary' : '06 · Beyond the public profile',
        title: publicDemo ? 'Zero personal repositories. One synthetic story.' : 'The hidden portfolio changed the picture.',
        variant: 'gold',
        content: (
          <div className="wrapped-copy wrapped-copy--wide">
            <Lock className="wrapped-icon" aria-hidden="true" />
            <span className="wrapped-kicker">
              {publicDemo ? 'The public boundary' : 'The hidden portfolio'}
            </span>
            {publicDemo ? (
              <>
                <h2>
                  Zero personal repositories. <em>One fully synthetic story.</em>
                </h2>
                <p>
                  Private markers demonstrate the local product’s visibility model, but no authenticated
                  GitHub or local Git data enters this public artifact.
                </p>
              </>
            ) : (
              <>
                <h2>
                  {data.summary.privateRepositories} private repositories carried{' '}
                  <em>
                    {Math.round((privateEngagement / Math.max(1, totalEngagement)) * 100)}% of attributed
                    engagement.
                  </em>
                </h2>
                <p>
                  Authenticated enrichment changed the story. This private surface remains on this device
                  and never enters the tracked application bundle.
                </p>
              </>
            )}
          </div>
        ),
        reveal: {
          label: 'See the boundary',
          title: publicDemo
            ? 'Synthetic in public, authenticated in private.'
            : `${data.summary.privateRepositories} private repositories are represented locally.`,
          body: publicDemo
            ? 'This hosted story is regenerated from invented events. Private markers demonstrate the product without publishing a person’s portfolio.'
            : 'Private systems inform the on-device analysis, but share exports cross a separate allowlist that removes names, titles, identities, dates, and raw events.',
          evidence: [
            publicDemo ? 'No authenticated GitHub data in the Pages artifact' : 'Local API bound to 127.0.0.1',
            publicDemo ? 'No repository or pull-request URLs' : 'Share actions require a reviewed redacted preview',
          ],
        },
      },
      {
        id: 'landscape',
        chapter: '07 · The technical landscape',
        title: `${topLanguage?.name ?? 'Multiple languages'} led the technical landscape.`,
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
        reveal: {
          label: 'Understand the weighting',
          title: 'Composition is weighted by work in motion.',
          body:
            'A language earns share through both its current repository footprint and the observable activity of those repositories. It is not authored-line share.',
          evidence: [
            `${data.languages.length} detected languages`,
            `${topLanguage ? precisePercentage(topLanguage.share) : 'No'} activity-weighted leading share`,
          ],
        },
      },
      {
        id: 'connection',
        chapter: '08 · The deeper connection',
        title: finalInsight?.title ?? 'The pattern is still forming.',
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
        reveal: {
          label: 'Audit the inference',
          title: finalInsight ? `${finalInsight.confidence} confidence · third-order hypothesis` : 'More evidence is needed.',
          body: finalInsight?.caveat ?? 'No higher-order claim is emitted until multiple independent signals align.',
          evidence: finalInsight?.evidence.slice(0, 3) ?? ['No convergent evidence trail yet'],
        },
      },
      {
        id: 'closing',
        chapter: '09 · The next lens',
        title: 'What will the next chapter make visible?',
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
        reveal: {
          label: 'Choose a next question',
          title: 'Turn reflection into a better question.',
          body:
            'Revisit a signal when you can name the decision it might change. The best next lens is usually about attention, flow, or collaboration—not a larger total.',
          evidence: [
            'Which project deserves sustained attention next?',
            'Which delivery tail is structural rather than incidental?',
            'Which quiet work is underrepresented by the visible trace?',
          ],
        },
      },
    ],
    [
      contributionPerWeek,
      data,
      finalInsight,
      onClose,
      privateEngagement,
      publicDemo,
      strongestDna?.label,
      strongestDna?.value,
      topLanguage,
      topRepo,
      totalEngagement,
    ],
  )

  const goTo = useCallback(
    (target: number) => {
      const bounded = Math.max(0, Math.min(stories.length - 1, target))
      if (bounded === index) {
        setOverviewOpen(false)
        return
      }
      setDirection(bounded > index ? 1 : -1)
      setIndex(bounded)
      setRevealOpen(false)
      setOverviewOpen(false)
    },
    [index, stories.length],
  )

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const intent = Math.abs(info.offset.x) > 70 || Math.abs(info.velocity.x) > 450
    if (!intent) return
    goTo(info.offset.x < 0 ? index + 1 : index - 1)
  }

  const followPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 22
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 16
    event.currentTarget.style.setProperty('--wrapped-shift-x', `${x}px`)
    event.currentTarget.style.setProperty('--wrapped-shift-y', `${y}px`)
  }

  const clearPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--wrapped-shift-x', '0px')
    event.currentTarget.style.setProperty('--wrapped-shift-y', '0px')
  }

  useEffect(() => {
    if (!open) return
    setIndex(0)
    setDirection(1)
    setOverviewOpen(false)
    setRevealOpen(false)
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-wrapped-close]')?.focus()
    })
    const handleKey = (event: KeyboardEvent) => {
      if (dialogRef.current?.dataset.suspended === 'true') return
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') {
        setDirection(1)
        setIndex((current) => Math.min(stories.length - 1, current + 1))
        setRevealOpen(false)
      }
      if (event.key === 'ArrowLeft') {
        setDirection(-1)
        setIndex((current) => Math.max(0, current - 1))
        setRevealOpen(false)
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
      aria-labelledby="wrapped-active-title"
      aria-describedby="wrapped-description"
      data-suspended={suspended}
      onPointerLeave={clearPointer}
      onPointerMove={followPointer}
      ref={dialogRef}
    >
      <p className="sr-only" id="wrapped-description">
        A nine-part interactive development retrospective. Use the arrow keys or the controls to
        move between chapters; press Escape to close.
      </p>
      <span aria-live="polite" className="sr-only">
        {story.chapter}. {story.title}. Story {index + 1} of {stories.length}.
      </span>
      <span className="sr-only" id="wrapped-active-title">Developer Lens Wrapped — {story.title}</span>
      <div className="wrapped__grain" aria-hidden="true" />
      <div className="wrapped__stars" aria-hidden="true">
        {Array.from({ length: 12 }, (_, starIndex) => <i key={starIndex} />)}
      </div>
      <header className="wrapped__header">
        <LensLogo />
        <button
          aria-expanded={overviewOpen}
          className="wrapped__chapter-trigger"
          onClick={() => setOverviewOpen((current) => !current)}
          type="button"
        >
          <LayoutGrid size={14} aria-hidden="true" /> <span>{story.chapter}</span>
        </button>
        <div className="wrapped__header-actions">
          {onShare && (
            <button
              aria-label={`Share chapter ${index + 1}: ${story.title}`}
              className="wrapped__share"
              onClick={() =>
                onShare({
                  kind: 'wrapped',
                  chapterId: story.id,
                  chapterNumber: index + 1,
                  chapterLabel: story.chapter,
                })
              }
              type="button"
            >
              <Share2 size={15} aria-hidden="true" /> <span>Share chapter</span>
            </button>
          )}
          <button aria-label="Close Wrapped" data-wrapped-close onClick={onClose} type="button">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>
      <AnimatePresence>
        {overviewOpen && (
          <motion.nav
            animate={{ opacity: 1, y: 0 }}
            aria-label="Wrapped chapters"
            className="wrapped__chapter-menu"
            exit={{ opacity: 0, y: -10 }}
            initial={{ opacity: 0, y: -10 }}
          >
            <div>
              <span>Story map</span>
              <strong>Jump to a signal</strong>
            </div>
            {stories.map((item, itemIndex) => (
              <button
                aria-current={itemIndex === index ? 'step' : undefined}
                className={itemIndex === index ? 'is-active' : ''}
                key={item.id}
                onClick={() => goTo(itemIndex)}
                type="button"
              >
                <span>{String(itemIndex + 1).padStart(2, '0')}</span>
                <strong>{item.chapter.replace(/^\d+ · /, '')}</strong>
                <small>{item.title}</small>
              </button>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
      <div className="wrapped__progress" aria-label={`Story ${index + 1} of ${stories.length}`}>
        {stories.map((item, itemIndex) => (
          <button
            aria-current={itemIndex === index ? 'step' : undefined}
            aria-label={`Go to ${item.chapter}`}
            className={itemIndex <= index ? 'is-active' : ''}
            data-chapter={item.chapter.replace(/^\d+ · /, '')}
            key={item.id}
            onClick={() => goTo(itemIndex)}
            type="button"
          >
            <span />
          </button>
        ))}
      </div>
      <main className="wrapped__stage">
        <AnimatePresence custom={direction} mode="wait">
          <motion.section
            animate={reduceMotion ? { opacity: 1 } : 'center'}
            className="wrapped-story"
            custom={direction}
            drag={reduceMotion ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            exit={reduceMotion ? { opacity: 1 } : 'exit'}
            key={story.id}
            initial={reduceMotion ? { opacity: 1 } : 'enter'}
            onDragEnd={handleDragEnd}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            variants={STORY_MOTION}
          >
            <div className="wrapped-story__content">{story.content}</div>
            <button
              aria-expanded={revealOpen}
              className="wrapped-reveal__trigger"
              onClick={() => setRevealOpen((current) => !current)}
              type="button"
            >
              <Lightbulb size={15} aria-hidden="true" />
              <span>{story.reveal.label}</span>
              <strong>{revealOpen ? 'Close' : 'Dig deeper'}</strong>
            </button>
            <AnimatePresence>
              {revealOpen && (
                <motion.aside
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  aria-label="Deeper chapter insight"
                  className="wrapped-reveal__panel"
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  role="region"
                >
                  <span><Sparkles size={13} aria-hidden="true" /> Deeper read</span>
                  <h3>{story.reveal.title}</h3>
                  <p>{story.reveal.body}</p>
                  <ul>
                    {story.reveal.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
                  </ul>
                </motion.aside>
              )}
            </AnimatePresence>
          </motion.section>
        </AnimatePresence>
      </main>
      <footer className="wrapped__controls">
        <button
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
          type="button"
        >
          <ArrowLeft size={17} aria-hidden="true" /> Previous
        </button>
        <div className="wrapped__position">
          <span>{String(index + 1).padStart(2, '0')} / {String(stories.length).padStart(2, '0')}</span>
          <small>Swipe · arrow keys · tap the story map</small>
        </div>
        <button
          disabled={index === stories.length - 1}
          onClick={() => goTo(index + 1)}
          type="button"
        >
          Next <ArrowRight size={17} aria-hidden="true" />
        </button>
      </footer>
    </div>,
    document.body,
  )
}
