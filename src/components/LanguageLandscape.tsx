import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import type { LanguageMetric } from '../../shared/types'
import { precisePercentage } from '../lib/format'

type LanguageLens = 'activity' | 'footprint'

const LENS_COPY: Record<LanguageLens, { label: string; description: string }> = {
  activity: {
    label: 'Activity mix',
    description:
      'Each repository’s language-byte mix is weighted by its observed commits, pull requests, reviews, and issues.',
  },
  footprint: {
    label: 'Code footprint',
    description:
      'GitHub-reported language bytes are added across the active repositories in this lens.',
  },
}

function shareFor(language: LanguageMetric, lens: LanguageLens): number {
  return lens === 'activity' ? language.share : language.footprintShare
}

export function LanguageLandscape({ languages }: { languages: LanguageMetric[] }) {
  const [lens, setLens] = useState<LanguageLens>('activity')
  const ordered = useMemo(
    () => [...languages].sort((a, b) => shareFor(b, lens) - shareFor(a, lens)),
    [languages, lens],
  )

  return (
    <div className="language-landscape">
      <div className="language-lens" aria-label="Language percentage basis">
        {(Object.keys(LENS_COPY) as LanguageLens[]).map((key) => (
          <button
            aria-pressed={lens === key}
            className={lens === key ? 'is-active' : ''}
            key={key}
            onClick={() => setLens(key)}
            type="button"
          >
            {LENS_COPY[key].label}
          </button>
        ))}
      </div>
      <p className="language-definition">{LENS_COPY[lens].description}</p>
      <div className="language-stripe" aria-label={`${LENS_COPY[lens].label} distribution`}>
        {ordered.map((language) => {
          const share = shareFor(language, lens)
          return (
            <span
              aria-label={`${language.name} ${precisePercentage(share)}`}
              key={language.name}
              style={{
                background: language.color,
                flexBasis: `${share * 100}%`,
              }}
              title={`${language.name} · ${precisePercentage(share)}`}
            />
          )
        })}
      </div>
      <div className="language-list">
        {ordered.slice(0, 8).map((language, index) => {
          const share = shareFor(language, lens)
          return (
            <div className="language-row" key={language.name}>
              <span className="language-row__rank">{String(index + 1).padStart(2, '0')}</span>
              <i style={{ background: language.color, color: language.color }} />
              <div>
                <strong>{language.name}</strong>
                <span>
                  {language.repositoryCount} {language.repositoryCount === 1 ? 'repository' : 'repositories'}
                </span>
              </div>
              <span className="language-row__share">{precisePercentage(share)}</span>
              <span className="language-row__bar" aria-hidden="true">
                <i
                  style={{
                    width: `${share * 100}%`,
                    minWidth: share > 0 ? '1px' : 0,
                    background: language.color,
                  }}
                />
              </span>
            </div>
          )
        })}
      </div>
      <details className="language-method">
        <summary><Info size={13} aria-hidden="true" /> What does this percentage mean?</summary>
        <p>
          Activity mix is an attention proxy; code footprint is a current repository-composition
          proxy. Neither estimates authored lines, time, proficiency, or project importance. GitHub
          reports only the ten largest languages per repository.
        </p>
      </details>
    </div>
  )
}
