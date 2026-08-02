import type { LanguageMetric } from '../../shared/types'

export function LanguageLandscape({ languages }: { languages: LanguageMetric[] }) {
  return (
    <div className="language-landscape">
      <div className="language-stripe" aria-hidden="true">
        {languages.slice(0, 8).map((language) => (
          <span
            key={language.name}
            style={{
              background: language.color,
              flexGrow: Math.max(language.share, 0.015),
            }}
          />
        ))}
      </div>
      <div className="language-list">
        {languages.slice(0, 8).map((language, index) => (
          <div className="language-row" key={language.name}>
            <span className="language-row__rank">{String(index + 1).padStart(2, '0')}</span>
            <i style={{ background: language.color }} />
            <div>
              <strong>{language.name}</strong>
              <span>{language.repositoryCount} repositories</span>
            </div>
            <span className="language-row__share">{Math.round(language.share * 100)}%</span>
            <span className="language-row__bar">
              <i style={{ width: `${Math.max(3, language.share * 100)}%`, background: language.color }} />
            </span>
          </div>
        ))}
      </div>
      <p className="module-note">
        Activity-weighted current repository composition—a technical landscape proxy, not authored
        language share.
      </p>
    </div>
  )
}
