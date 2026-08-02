import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  Clipboard,
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
  const [cardBlob, setCardBlob] = useState<Blob | null>(null)
  const [cardError, setCardError] = useState('')
  const [status, setStatus] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const caption = useMemo(() => createShareCaption(payload, tone), [payload, tone])
  const publicDemo = payload.scope === 'public-demo'
  const exportAllowed = publicDemo || confirmed

  useEffect(() => {
    if (!open) return
    setTone('story')
    setConfirmed(false)
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
  }, [open, payload])

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
          Preview and export a privacy-aware social card, post caption, or standalone report.
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
                  : 'The exporter receives only six allowlisted aggregate metrics and a fixed narrative.'}
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
                  titles, identities, dates, and raw events are excluded.
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
                <FileText size={17} aria-hidden="true" /> Export report
              </button>
            </div>

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
