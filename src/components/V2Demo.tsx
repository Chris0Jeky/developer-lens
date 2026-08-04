import { Sparkles, ShieldCheck } from 'lucide-react'
import { InsightStack } from './InsightStack'
import { LensLogo } from './LensLogo'
import { V2StoryPath } from './V2StoryPath'
import { V2_DEMO_INSIGHTS, V2_DEMO_PAYLOAD } from '../../shared/v2Demo'

export function V2Demo() {
  return (
    <div className="app" id="top">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />
      <header className="app-header">
        <a className="brand-link" href="#top">
          <LensLogo />
        </a>
        <div className="app-header__actions">
          <span className="local-pill local-pill--public">
            <Sparkles size={12} aria-hidden="true" /> Public V2 demo
          </span>
        </div>
      </header>

      <div className="demo-banner">
        <Sparkles size={15} aria-hidden="true" />
        <span>
          Invented C0 story · public_showcase.v1 · no account, repository, or local-history input.
        </span>
      </div>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <span className="eyebrow hero-eyebrow"><span className="status-dot" /> Synthetic evidence lab</span>
            <h1>{V2_DEMO_PAYLOAD.title}</h1>
            <p className="hero-lede">{V2_DEMO_PAYLOAD.summary}</p>
            <div className="hero-trust">
              <span><ShieldCheck size={14} aria-hidden="true" /> Strict C0 fields only</span>
              <span><Sparkles size={13} aria-hidden="true" /> No private history is read</span>
            </div>
          </div>
        </section>

        <section className="section-block insights-section" id="insights">
          <div className="section-heading section-heading--split">
            <div>
              <span className="eyebrow">V2 · Evidence layers</span>
              <h2>Follow one story from fact to hypothesis.</h2>
            </div>
            <p>{V2_DEMO_PAYLOAD.boundary}</p>
          </div>
          <V2StoryPath insights={V2_DEMO_INSIGHTS} />
          <InsightStack insights={V2_DEMO_INSIGHTS} />
          <p className="section-heading__note">{V2_DEMO_PAYLOAD.closingCaveat}</p>
        </section>
      </main>
    </div>
  )
}
