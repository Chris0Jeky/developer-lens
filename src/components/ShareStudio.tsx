import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LockKeyhole,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import type { DashboardData } from '../../shared/types'
import { buildShareCardSvg, createShareCardPng } from '../lib/shareCard'
import {
  createShareCaption,
  createSharePayload,
  PUBLIC_SHOWCASE_URL,
  type ShareContext,
  type ShareTone,
} from '../lib/sharePayload'
import { buildStandaloneReport } from '../lib/standaloneReport'
import {
  createPortableExportPayload,
  createPortableExportSeed,
  type PortableArtifact,
  type RepositoryRedaction,
} from '../lib/portableExportPayload'
import { buildPortableExperienceReport } from '../lib/portableExportReport'

interface ShareStudioProps {
  context: ShareContext
  data: DashboardData
  onClose: () => void
  open: boolean
}

const TONES: Array<{ id: ShareTone; label: string }> = [
  { id: 'story', label: 'Story' },
  { id: 'professional', label: 'Professional' },
  { id: 'compact', label: 'Compact' },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

async function copyText(value: string): Promise<void> {
  if (window.navigator.clipboard?.writeText) {
    await window.navigator.clipboard.writeText(value)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Clipboard access is unavailable.')
}

export function ShareStudio({ context, data, onClose, open }: ShareStudioProps) {
  const payload = useMemo(() => createSharePayload(data, context), [context, data])
  const [tone, setTone] = useState<ShareTone>('story')
  const [confirmed, setConfirmed] = useState(false)
  const [portableArtifact, setPortableArtifact] = useState<PortableArtifact>(
    context.kind === 'wrapped' ? 'wrapped' : 'dashboard',
  )
  const [repositoryRedaction, setRepositoryRedaction] =
    useState<RepositoryRedaction>('private-aliases')
  const [aliasSeed, setAliasSeed] = useState(createPortableExportSeed)
  const [cardBlob, setCardBlob] = useState<Blob | null>(null)
  const [cardError, setCardError] = useState('')
  const [status, setStatus] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const caption = useMemo(() => createShareCaption(payload, tone), [payload, tone])
  const publicDemo = payload.scope === 'public-demo'
  const exportAllowed = publicDemo || confirmed
  const portablePayload = useMemo(
    () => createPortableExportPayload(data, {
      aliasSeed,
      artifact: portableArtifact,
      repositoryRedaction,
    }),
    [aliasSeed, data, portableArtifact, repositoryRedaction],
  )

  useEffect(() => {
    if (!open) return
    setTone('story')
    setConfirmed(false)
    setPortableArtifact(context.kind === 'wrapped' ? 'wrapped' : 'dashboard')
    setRepositoryRedaction('private-aliases')
    setAliasSeed(createPortableExportSeed())
    setStatus('')
    setCardBlob(null)
    setCardError('')
    let active = true
    createShareCardPng(payload)
      .then((blob) => {
        if (active) setCardBlob(blob)
      })
      .catch((error: unknown) => {
        if (active) setCardError(error instanceof Error ? error.message : 'Image export is unavailable.')
      })
    return () => {
      active = false
    }
  }, [context.kind, open, payload])

  useEffect(() => {
    if (!open) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-share-close]')?.focus()
    })
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    window.addEventListener('keydown', handleKey)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus()
    }
  }, [onClose, open])

  if (!open) return null

  const handleCopy = async () => {
    if (!exportAllowed) return
    try {
      await copyText(caption)
      setStatus('Post copy copied to your clipboard.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Copy failed. Select the text manually.')
    }
  }

  const handleCopyLink = async () => {
    try {
      await copyText(PUBLIC_SHOWCASE_URL)
      setStatus('Public showcase link copied.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Link copy failed.')
    }
  }

  const handleDownloadImage = () => {
    if (!exportAllowed) return
    if (cardBlob) {
      downloadBlob(cardBlob, `${payload.fileStem}.png`)
      setStatus('Social card downloaded as a 1200 × 630 PNG.')
      return
    }
    const svg = new Blob([buildShareCardSvg(payload)], { type: 'image/svg+xml;charset=utf-8' })
    downloadBlob(svg, `${payload.fileStem}.svg`)
    setStatus(cardError ? 'PNG rendering was unavailable, so an SVG card was downloaded.' : 'SVG card downloaded.')
  }

  const handleDownloadReport = () => {
    if (!exportAllowed) return
    const report = new Blob([buildStandaloneReport(payload)], { type: 'text/html;charset=utf-8' })
    downloadBlob(report, `${payload.fileStem}-report.html`)
    setStatus('Self-contained HTML report downloaded. Nothing was uploaded.')
  }

  const choosePortableArtifact = (artifact: PortableArtifact) => {
    setPortableArtifact(artifact)
    setStatus('')
    if (!publicDemo) setConfirmed(false)
  }

  const chooseRepositoryRedaction = (redaction: RepositoryRedaction) => {
    setRepositoryRedaction(redaction)
    setAliasSeed(createPortableExportSeed())
    setStatus('')
    if (!publicDemo) setConfirmed(false)
  }

  const portableFile = () => {
    const report = buildPortableExperienceReport(portablePayload)
    return new File([report], `${portablePayload.fileStem}.html`, {
      type: 'text/html;charset=utf-8',
    })
  }

  const handleDownloadPortable = () => {
    if (!exportAllowed) return
    const file = portableFile()
    downloadBlob(file, file.name)
    setStatus(
      `${portableArtifact === 'dashboard' ? 'Full dashboard' : 'Complete Wrapped'} downloaded as a self-contained HTML file. Nothing was uploaded.`,
    )
  }

  const handleSharePortable = async () => {
    if (!exportAllowed) return
    const file = portableFile()
    let canShareFile = false
    try {
      canShareFile = Boolean(window.navigator.canShare?.({ files: [file] }))
    } catch {
      canShareFile = false
    }
    const text = publicDemo
      ? 'Explore the complete synthetic Developer Lens experience.'
      : `My ${portablePayload.rangeLabel.toLowerCase()} Developer Lens, shared as a deliberately redacted portable file.`

    if (window.navigator.share && (canShareFile || publicDemo)) {
      try {
        await window.navigator.share({
          files: canShareFile ? [file] : undefined,
          text,
          title: portablePayload.title,
          url: publicDemo ? portablePayload.canonicalUrl : undefined,
        })
        setStatus(
          canShareFile
            ? 'The full experience was sent to the system share sheet as a file.'
            : 'The public interactive experience was sent to the system share sheet.',
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setStatus('Share cancelled. Nothing was sent.')
        } else {
          setStatus(error instanceof Error ? error.message : 'The system share sheet could not open.')
        }
      }
      return
    }

    downloadBlob(file, file.name)
    setStatus('File sharing is unavailable in this browser, so the full experience was downloaded instead.')
  }

  const handleNativeShare = async () => {
    if (!exportAllowed) return
    if (!window.navigator.share) {
      await handleCopy()
      setStatus('Native sharing is unavailable here, so the post copy was copied instead.')
      return
    }

    const file = cardBlob
      ? new File([cardBlob], `${payload.fileStem}.png`, { type: 'image/png' })
      : null
    const canShareFile = Boolean(file && window.navigator.canShare?.({ files: [file] }))
    try {
      await window.navigator.share({
        title: payload.title,
        text: caption,
        url: payload.canonicalUrl,
        files: canShareFile && file ? [file] : undefined,
      })
      setStatus(canShareFile ? 'Share card sent to the system share sheet.' : 'Post sent to the system share sheet.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('Share cancelled. Nothing was sent.')
      } else {
        setStatus(error instanceof Error ? error.message : 'The system share sheet could not open.')
      }
    }
  }

  return createPortal(
    <div className="share-studio" role="presentation">
      <button aria-label="Close share studio" className="share-studio__backdrop" onClick={onClose} type="button" />
      <div
        aria-describedby="share-studio-description"
        aria-labelledby="share-studio-title"
        aria-modal="true"
        className="share-studio__dialog"
        ref={dialogRef}
        role="dialog"
      >
        <header className="share-studio__header">
          <div>
            <span className="eyebrow">Share studio</span>
            <h2 id="share-studio-title">Turn the lens into something worth sharing.</h2>
          </div>
          <button aria-label="Close share studio" data-share-close onClick={onClose} type="button">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <p className="sr-only" id="share-studio-description">
          Preview and export a privacy-aware social card, post caption, summary report, full dashboard,
          or complete Wrapped story.
        </p>

        <div className="share-studio__layout">
          <section className="share-preview" aria-label="Share card preview">
            <div
              className="share-preview__card"
              style={
                {
                  '--share-one': payload.accent[0],
                  '--share-two': payload.accent[1],
                } as React.CSSProperties
              }
            >
              <div className="share-preview__brand">
                <span><i /> Developer Lens</span>
                <small>{payload.rangeLabel}</small>
              </div>
              <span className="share-preview__eyebrow">{payload.eyebrow}</span>
              <h3>{payload.title}</h3>
              <p>{payload.description}</p>
              <div className="share-preview__metrics">
                {payload.metrics.slice(0, 3).map((metric) => (
                  <span key={metric.label}>
                    <strong>{metric.value}</strong>
                    <small>{metric.label}</small>
                  </span>
                ))}
              </div>
              <div className="share-preview__orbit" aria-hidden="true"><i /><i /><i /></div>
              <small className="share-preview__privacy">{payload.privacyNote}</small>
            </div>
            <div className={`share-boundary${publicDemo ? ' share-boundary--public' : ''}`}>
              {publicDemo ? <Sparkles size={17} aria-hidden="true" /> : <LockKeyhole size={17} aria-hidden="true" />}
              <span>
                <strong>{publicDemo ? 'Ready for the public web' : 'Private source, redacted output'}</strong>
                {publicDemo
                  ? 'This card and link describe the fully synthetic showcase.'
                  : 'The card uses six allowlisted metrics. Full files use a separate aggregate-only schema with fresh project aliases.'}
              </span>
            </div>
          </section>

          <section className="share-controls">
            <div className="share-controls__intro">
              <span>{context.kind === 'wrapped' ? 'Share this chapter' : 'Share the overview'}</span>
              <strong>{publicDemo ? 'Synthetic and externally shareable' : 'Nothing uploads automatically'}</strong>
            </div>

            {!publicDemo && (
              <label className="share-confirm">
                <input
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>I have reviewed this redacted preview</strong>
                  I understand the aggregate numbers can still describe my activity, even though names,
                  titles, identities, exact dates, and raw events are excluded. Public repository names
                  remain visible unless I choose to alias every project below.
                </span>
              </label>
            )}

            <div className="share-tone" aria-label="Post style" role="group">
              {TONES.map((option) => (
                <button
                  aria-pressed={tone === option.id}
                  className={tone === option.id ? 'is-active' : ''}
                  key={option.id}
                  onClick={() => setTone(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="share-copy">
              <span>Post copy</span>
              <textarea readOnly rows={6} value={caption} />
            </label>

            <div className="share-actions">
              <button className="share-action share-action--primary" disabled={!exportAllowed} onClick={handleNativeShare} type="button">
                <Send size={17} aria-hidden="true" /> Share externally
              </button>
              <button className="share-action" disabled={!exportAllowed} onClick={handleCopy} type="button">
                <Clipboard size={17} aria-hidden="true" /> Copy post
              </button>
              <button className="share-action" disabled={!exportAllowed} onClick={handleDownloadImage} type="button">
                <ImageIcon size={17} aria-hidden="true" /> Download image
              </button>
              <button className="share-action" disabled={!exportAllowed} onClick={handleDownloadReport} type="button">
                <FileText size={17} aria-hidden="true" /> Export summary
              </button>
            </div>

            <section className="share-full" aria-labelledby="share-full-title">
              <header>
                <span><Sparkles size={15} aria-hidden="true" /> Full experience</span>
                <strong id="share-full-title">Share the whole lens, not only the snapshot.</strong>
                <p>One polished HTML file opens in any modern browser, works offline, prints cleanly,
                  and includes no app bundle or private source dataset.</p>
              </header>

              <div className="share-full__label">Choose the experience</div>
              <div className="share-full__choices" aria-label="Full export type" role="group">
                <button
                  aria-pressed={portableArtifact === 'dashboard'}
                  className={portableArtifact === 'dashboard' ? 'is-active' : ''}
                  onClick={() => choosePortableArtifact('dashboard')}
                  type="button"
                >
                  <strong>Full dashboard</strong>
                  <span>Seven guided sections with charts, project gravity, methods, and limits.</span>
                </button>
                <button
                  aria-pressed={portableArtifact === 'wrapped'}
                  className={portableArtifact === 'wrapped' ? 'is-active' : ''}
                  onClick={() => choosePortableArtifact('wrapped')}
                  type="button"
                >
                  <strong>Complete Wrapped</strong>
                  <span>All nine scrollable chapters with reveals and evidence.</span>
                </button>
              </div>

              {!publicDemo && (
                <>
                  <div className="share-full__label">Repository names</div>
                  <div className="share-full__redaction" aria-label="Repository name redaction" role="group">
                    <button
                      aria-pressed={repositoryRedaction === 'private-aliases'}
                      className={repositoryRedaction === 'private-aliases' ? 'is-active' : ''}
                      onClick={() => chooseRepositoryRedaction('private-aliases')}
                      type="button"
                    >
                      <strong>Alias private</strong>
                      <span>Recommended · retain public names</span>
                    </button>
                    <button
                      aria-pressed={repositoryRedaction === 'all-aliases'}
                      className={repositoryRedaction === 'all-aliases' ? 'is-active' : ''}
                      onClick={() => chooseRepositoryRedaction('all-aliases')}
                      type="button"
                    >
                      <strong>Alias every project</strong>
                      <span>Maximum portfolio privacy</span>
                    </button>
                  </div>
                </>
              )}

              <details className="share-full__details">
                <summary>What crosses the boundary?</summary>
                <p>
                  Included: aggregate totals, relative week and weekday buckets, project-level counts,
                  language shares, fixed analysis templates, DNA axes, theme counts, and coverage status totals.
                </p>
                <p>
                  Excluded: identity, URLs, descriptions, topics, PR titles, exact dates, raw events,
                  filenames, paths, warnings, and arbitrary source insight prose.
                </p>
                <p>Fresh aliases reduce direct identification but are not an anonymity guarantee when
                  a project’s aggregate activity pattern is distinctive.</p>
              </details>

              <div className="share-full__actions">
                <button className="share-action share-action--primary" disabled={!exportAllowed} onClick={handleSharePortable} type="button">
                  <Share2 size={17} aria-hidden="true" /> Share full experience
                </button>
                <button className="share-action" disabled={!exportAllowed} onClick={handleDownloadPortable} type="button">
                  <Download size={17} aria-hidden="true" /> Download full file
                </button>
              </div>
            </section>

            {publicDemo ? (
              <div className="share-link-row">
                <a href={PUBLIC_SHOWCASE_URL} rel="noreferrer" target="_blank">
                  <ExternalLink size={15} aria-hidden="true" /> Open public link
                </a>
                <button onClick={handleCopyLink} type="button">
                  <Share2 size={15} aria-hidden="true" /> Copy link
                </button>
              </div>
            ) : (
              <a className="share-public-route" href={PUBLIC_SHOWCASE_URL} rel="noreferrer" target="_blank">
                <ShieldCheck size={16} aria-hidden="true" /> Prefer a zero-personal-data link? Share the
                synthetic showcase instead. <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}

            <p aria-live="polite" className="share-status" role="status">
              {status && <Check size={15} aria-hidden="true" />} {status || 'Choose an action when the preview looks right.'}
            </p>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
