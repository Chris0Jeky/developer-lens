import type {
  PortableExportPayload,
  PortableNarrative,
  PortableRepository,
} from './portableExportPayload.js'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value)
}

function percentage(value: number, digits = 0): string {
  return `${(Math.max(0, Math.min(1, value)) * 100).toFixed(digits)}%`
}

function hours(value: number | null): string {
  if (value === null) return 'Not eligible'
  if (value < 1) return `${Math.max(1, Math.round(value * 60))}m`
  if (value < 48) return `${value < 10 ? value.toFixed(1) : Math.round(value)}h`
  return `${(value / 24).toFixed(1)}d`
}

function metric(
  value: string,
  label: string,
  explanation: string,
  accent = 'violet',
): string {
  return `
    <article class="metric metric--${accent}" tabindex="0">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(explanation)}</p>
    </article>`
}

function disclosureLabel(repository: PortableRepository): string {
  if (repository.disclosure === 'synthetic') return 'Synthetic project'
  if (repository.disclosure === 'public-name') return 'Public name retained'
  if (repository.disclosure === 'private-alias') return 'Private name aliased'
  return 'Name aliased'
}

function weeklyBars(payload: PortableExportPayload, limit = payload.weeks.length): string {
  const weeks = payload.weeks.slice(-limit)
  const maximum = Math.max(1, ...weeks.map((week) => week.total))
  return weeks
    .map((week) => {
      const height = 12 + Math.round((week.total / maximum) * 88)
      const label = `${week.label}: ${formatNumber(week.total)} signals, ${week.activeDays} active days`
      return `<span class="week-bar" style="--bar:${height}%" tabindex="0" aria-label="${escapeHtml(label)}"><i></i><small>${escapeHtml(week.label.replace('Week ', 'W'))}</small><b>${escapeHtml(label)}</b></span>`
    })
    .join('')
}

function weekdayBars(payload: PortableExportPayload): string {
  const maximum = Math.max(1, ...payload.weekdays.map((day) => day.contributions))
  return payload.weekdays
    .map(
      (day) => `
        <div class="hbar" tabindex="0">
          <span>${escapeHtml(day.label.slice(0, 3))}</span>
          <i><b style="width:${Math.round((day.contributions / maximum) * 100)}%"></b></i>
          <strong>${formatNumber(day.contributions)}</strong>
          <em>${day.activeDays} active days</em>
        </div>`,
    )
    .join('')
}

function constellation(payload: PortableExportPayload): string {
  const repositories = payload.repositories.slice(0, 14)
  const maximum = Math.max(1, ...repositories.map((repository) => repository.engagement))
  const planets = repositories
    .map((repository, index) => {
      const angle = index * 2.399963
      const orbit = 48 + Math.sqrt(index + 1) * 54
      const x = Math.max(48, Math.min(732, 390 + Math.cos(angle) * orbit))
      const y = Math.max(48, Math.min(392, 220 + Math.sin(angle) * orbit * 0.56))
      const radius = 15 + Math.sqrt(repository.engagement / maximum) * 37
      const label = repository.label.length > 18
        ? `${repository.label.slice(0, 16)}…`
        : repository.label
      const detail = `${repository.label}: ${repository.commits} commits, ${repository.mergedPullRequests} merged pull requests, ${repository.activeWeeks} active weeks`
      return `
        <g class="planet" tabindex="0" aria-label="${escapeHtml(detail)}">
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" style="--planet:${escapeHtml(repository.color)}"></circle>
          <text x="${x.toFixed(1)}" y="${(y + radius + 17).toFixed(1)}">${escapeHtml(label)}</text>
          <title>${escapeHtml(detail)}</title>
        </g>`
    })
    .join('')
  return `
    <figure class="constellation">
      <svg viewBox="0 0 780 440" role="img" aria-label="Repository constellation sized by aggregate engagement">
        <ellipse cx="390" cy="220" rx="300" ry="145"></ellipse>
        <ellipse cx="390" cy="220" rx="220" ry="105"></ellipse>
        <ellipse cx="390" cy="220" rx="135" ry="66"></ellipse>
        ${planets}
      </svg>
      <figcaption>Hover or focus a project to inspect its aggregate activity. Position is decorative; size follows the existing engagement blend.</figcaption>
    </figure>`
}

function repositoryLedger(payload: PortableExportPayload): string {
  return payload.repositories
    .map(
      (repository, index) => `
        <details class="repo-row">
          <summary>
            <span class="repo-rank">${String(index + 1).padStart(2, '0')}</span>
            <span class="repo-name"><strong>${escapeHtml(repository.label)}</strong><small>${escapeHtml(disclosureLabel(repository))} · ${escapeHtml(repository.primaryLanguage)}</small></span>
            <span class="repo-gravity"><i style="width:${Math.max(3, Math.round(repository.attentionShare * 100))}%"></i></span>
            <span class="repo-value">${percentage(repository.attentionShare, 1)}</span>
          </summary>
          <dl>
            <div><dt>Commit signals</dt><dd>${formatNumber(repository.commits)}</dd></div>
            <div><dt>Merged PRs</dt><dd>${formatNumber(repository.mergedPullRequests)}</dd></div>
            <div><dt>Reviews</dt><dd>${formatNumber(repository.reviews)}</dd></div>
            <div><dt>Issues</dt><dd>${formatNumber(repository.issues)}</dd></div>
            <div><dt>Active weeks</dt><dd>${formatNumber(repository.activeWeeks)}</dd></div>
            <div><dt>Momentum</dt><dd>${repository.momentum > 0 ? '+' : ''}${repository.momentum}%</dd></div>
          </dl>
        </details>`,
    )
    .join('')
}

function languageLandscape(payload: PortableExportPayload): string {
  const stack = payload.languages
    .filter((language) => language.share > 0)
    .map(
      (language) =>
        `<i style="width:${Math.max(0.35, language.share * 100)}%;background:${escapeHtml(language.color)}" title="${escapeHtml(language.name)} · ${percentage(language.share, 1)}"></i>`,
    )
    .join('')
  const rows = payload.languages
    .map(
      (language, index) => `
        <div class="language-row" tabindex="0">
          <span class="language-index">${String(index + 1).padStart(2, '0')}</span>
          <i style="background:${escapeHtml(language.color)}"></i>
          <span><strong>${escapeHtml(language.name)}</strong><small>${language.repositoryCount} repositories</small></span>
          <span class="language-meter"><b style="width:${language.share * 100}%"></b></span>
          <strong>${percentage(language.share, 1)}</strong>
          <em>Footprint ${percentage(language.footprintShare, 1)}</em>
        </div>`,
    )
    .join('')
  return `
    <div class="language-stack" aria-label="Activity-weighted language composition">${stack}</div>
    <div class="language-list">${rows || '<p class="empty">No eligible language metadata.</p>'}</div>`
}

function themeGrid(payload: PortableExportPayload): string {
  return payload.themes
    .map(
      (theme) => `
        <article class="theme-card" style="--theme:${escapeHtml(theme.color)}" tabindex="0">
          <span>${escapeHtml(theme.label)}</span>
          <strong>${percentage(theme.share, 1)}</strong>
          <i><b style="width:${theme.share * 100}%"></b></i>
          <small>${formatNumber(theme.count)} classified commit signals</small>
        </article>`,
    )
    .join('')
}

function dnaGrid(payload: PortableExportPayload): string {
  return payload.dna
    .map(
      (dimension) => `
        <article class="dna-axis" tabindex="0">
          <header><span>${escapeHtml(dimension.label)}</span><strong>${dimension.value}</strong></header>
          <i><b style="width:${dimension.value}%"></b></i>
          <p>${escapeHtml(dimension.explanation)}</p>
        </article>`,
    )
    .join('')
}

function narrativeCard(narrative: PortableNarrative): string {
  return `
    <article class="narrative narrative--${narrative.order}">
      <span>${narrative.order === 1 ? 'Observed shape' : narrative.order === 2 ? 'Derived pattern' : 'Bounded hypothesis'}</span>
      <h3>${escapeHtml(narrative.title)}</h3>
      <p>${escapeHtml(narrative.body)}</p>
      <details>
        <summary>Open the evidence</summary>
        <ul>${narrative.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        <small>${escapeHtml(narrative.limitation)}</small>
      </details>
    </article>`
}

function boundary(payload: PortableExportPayload): string {
  const repositoryRule =
    payload.repositoryRedaction === 'synthetic'
      ? 'Every project in this file is synthetic.'
      : payload.repositoryRedaction === 'all-aliases'
        ? 'Every repository name was replaced by a fresh alias for this export.'
        : 'Private repository names were replaced by fresh aliases; public repository names were retained.'
  return `
    <aside class="boundary">
      <span>Portable privacy boundary</span>
      <strong>${escapeHtml(payload.privacyNote)}</strong>
      <p>${escapeHtml(repositoryRule)} Identity, repository URLs and descriptions, pull-request titles and URLs, exact dates, raw events, warnings, paths, and source prose are not present. Aliases reduce direct identification, but distinctive aggregate patterns can still be recognisable.</p>
    </aside>`
}

function reportLink(payload: PortableExportPayload): string {
  return payload.canonicalUrl
    ? `<a class="live-link" href="${escapeHtml(payload.canonicalUrl)}">Open the interactive synthetic showcase ↗</a>`
    : '<span class="local-file">Local file · nothing was uploaded by Developer Lens</span>'
}

const STYLES = `
  :root {
    color-scheme: dark;
    --ink:#f7f4ff;
    --soft:#b4b8c8;
    --muted:#7e849b;
    --line:rgba(255,255,255,.1);
    --line-strong:rgba(255,255,255,.18);
    --surface:rgba(17,19,31,.82);
    --violet:#a879ff;
    --aqua:#53e2bd;
    --gold:#ffd166;
    --ember:#ff756d;
    --rose:#ef73bd;
    font-family:"Segoe UI Variable","Segoe UI",Inter,system-ui,sans-serif;
    background:#070810;
    color:var(--ink);
  }
  * { box-sizing:border-box; }
  html { scroll-behavior:smooth; }
  body { margin:0; min-width:300px; background:
    radial-gradient(circle at 88% 4%,rgba(122,83,214,.24),transparent 34rem),
    radial-gradient(circle at 5% 52%,rgba(44,204,168,.1),transparent 28rem),
    #070810; }
  a { color:inherit; }
  button,summary,a { -webkit-tap-highlight-color:transparent; }
  :focus-visible { outline:2px solid var(--aqua); outline-offset:4px; }
  .skip { position:fixed; z-index:100; top:12px; left:12px; padding:10px 14px; border-radius:9px; background:#fff; color:#080910; transform:translateY(-180%); }
  .skip:focus { transform:none; }
  .shell { width:min(1220px,calc(100% - 42px)); margin:0 auto; }
  .topbar { display:flex; min-height:72px; align-items:center; justify-content:space-between; color:var(--soft); font-size:13px; }
  .brand { display:flex; align-items:center; gap:10px; font-weight:750; letter-spacing:-.02em; }
  .brand i { width:22px; height:22px; border:1px solid var(--aqua); border-radius:50%; background:radial-gradient(circle,var(--violet) 0 28%,transparent 30%); box-shadow:0 0 26px rgba(83,226,189,.3); }
  .topbar > span { padding:7px 11px; border:1px solid var(--line); border-radius:99px; color:var(--muted); }
  .hero { position:relative; min-height:620px; padding:96px clamp(28px,6vw,84px) 62px; border:1px solid var(--line); border-radius:34px; background:linear-gradient(145deg,rgba(16,17,29,.95),rgba(13,14,25,.72)); box-shadow:0 38px 110px rgba(0,0,0,.42); overflow:hidden; }
  .hero::before { position:absolute; width:510px; height:510px; top:-220px; right:-90px; border:1px solid rgba(168,121,255,.18); border-radius:50%; box-shadow:inset 0 0 90px rgba(168,121,255,.09),0 0 110px rgba(168,121,255,.12); content:""; }
  .hero::after { position:absolute; width:130px; height:130px; top:110px; right:120px; border:1px dashed rgba(83,226,189,.44); border-radius:50%; background:radial-gradient(circle at 34% 28%,#fff,var(--violet) 15%,#2d244a 52%,transparent 54%); box-shadow:0 0 55px rgba(168,121,255,.4); content:""; }
  .kicker { display:block; color:var(--aqua); font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; }
  h1 { position:relative; z-index:1; max-width:850px; margin:24px 0 22px; font-size:clamp(60px,8.5vw,112px); font-weight:600; letter-spacing:-.075em; line-height:.88; text-wrap:balance; }
  .lede { position:relative; z-index:1; max-width:720px; margin:0; color:var(--soft); font-size:clamp(18px,2vw,24px); line-height:1.55; }
  .hero-meta { display:flex; margin-top:56px; align-items:center; flex-wrap:wrap; gap:12px; }
  .hero-meta span,.hero-meta a,.local-file,.live-link { padding:9px 13px; border:1px solid var(--line); border-radius:99px; color:var(--muted); background:rgba(255,255,255,.025); font-size:11px; text-decoration:none; }
  .live-link:hover { border-color:rgba(83,226,189,.4); color:var(--aqua); }
  .metric-grid { display:grid; margin:18px 0 92px; grid-template-columns:repeat(6,1fr); }
  .metric { position:relative; min-height:205px; padding:28px 22px; border:1px solid var(--line); border-right:0; background:rgba(12,14,24,.74); overflow:hidden; }
  .metric:first-child { border-radius:22px 0 0 22px; }
  .metric:last-child { border-right:1px solid var(--line); border-radius:0 22px 22px 0; }
  .metric::after { position:absolute; right:-24px; bottom:-35px; width:90px; height:90px; border-radius:50%; background:var(--violet); filter:blur(45px); opacity:.08; content:""; transition:opacity .2s; }
  .metric:hover::after,.metric:focus::after { opacity:.24; }
  .metric strong { display:block; font-size:clamp(27px,3.4vw,43px); font-weight:620; letter-spacing:-.055em; }
  .metric > span { display:block; margin-top:40px; color:var(--soft); font-size:10px; font-weight:750; letter-spacing:.11em; text-transform:uppercase; }
  .metric p { margin:9px 0 0; color:var(--muted); font-size:10px; line-height:1.5; opacity:0; transform:translateY(8px); transition:.2s; }
  .metric:hover p,.metric:focus p { opacity:1; transform:none; }
  .journey { position:sticky; z-index:30; top:12px; display:flex; width:max-content; max-width:100%; margin:0 auto 92px; padding:6px; border:1px solid var(--line-strong); border-radius:16px; background:rgba(11,12,22,.82); box-shadow:0 14px 55px rgba(0,0,0,.35); backdrop-filter:blur(18px); overflow-x:auto; }
  .journey a { min-width:max-content; padding:10px 14px; border-radius:11px; color:var(--muted); font-size:10px; font-weight:700; text-decoration:none; }
  .journey a:hover,.journey a:focus { color:var(--ink); background:rgba(168,121,255,.11); }
  .section { margin-bottom:120px; scroll-margin-top:100px; }
  .section-heading { display:grid; margin-bottom:30px; grid-template-columns:130px minmax(0,1fr); gap:32px; }
  .section-heading > span { color:var(--muted); font-size:10px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
  .section-heading h2 { max-width:820px; margin:0; font-size:clamp(39px,5vw,68px); font-weight:580; letter-spacing:-.06em; line-height:.98; }
  .section-heading p { max-width:730px; margin:15px 0 0; color:var(--muted); font-size:14px; line-height:1.65; }
  .panel { padding:clamp(22px,4vw,46px); border:1px solid var(--line); border-radius:26px; background:var(--surface); box-shadow:inset 0 1px rgba(255,255,255,.025); }
  .split { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(260px,.5fr); gap:18px; }
  .week-strip { display:flex; height:260px; padding:30px 8px 0; align-items:flex-end; gap:4px; overflow-x:auto; }
  .week-bar { position:relative; display:flex; min-width:9px; height:100%; align-items:center; justify-content:flex-end; flex:1; flex-direction:column; }
  .week-bar i { display:block; width:100%; height:var(--bar); min-height:5px; border-radius:7px 7px 2px 2px; background:linear-gradient(to top,rgba(168,121,255,.24),var(--violet)); box-shadow:0 0 16px rgba(168,121,255,.08); transition:filter .16s,transform .16s; }
  .week-bar:hover i,.week-bar:focus i { filter:brightness(1.35); transform:scaleX(1.35); }
  .week-bar small { margin-top:8px; color:transparent; font-size:7px; }
  .week-bar:nth-child(4n + 1) small { color:var(--muted); }
  .week-bar b { position:absolute; z-index:4; left:50%; bottom:calc(var(--bar) + 22px); width:190px; padding:9px; border:1px solid var(--line-strong); border-radius:9px; color:var(--soft); background:#151725; box-shadow:0 12px 35px #0008; font-size:9px; font-weight:600; line-height:1.45; opacity:0; pointer-events:none; transform:translate(-50%,8px); transition:.16s; }
  .week-bar:hover b,.week-bar:focus b { opacity:1; transform:translate(-50%,0); }
  .weekday-list { display:flex; flex-direction:column; gap:17px; }
  .hbar { position:relative; display:grid; align-items:center; grid-template-columns:32px 1fr 42px; gap:9px; }
  .hbar > span,.hbar > strong { color:var(--muted); font-size:9px; }
  .hbar > strong { color:var(--soft); text-align:right; }
  .hbar i,.language-meter,.theme-card > i,.dna-axis > i { display:block; height:4px; border-radius:99px; background:rgba(255,255,255,.06); overflow:hidden; }
  .hbar b,.language-meter b,.theme-card > i b,.dna-axis > i b { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--violet),var(--aqua)); }
  .hbar em { position:absolute; right:0; bottom:-12px; color:var(--muted); font-size:7px; font-style:normal; opacity:0; }
  .hbar:hover em,.hbar:focus em { opacity:1; }
  .constellation { margin:0; }
  .constellation svg { display:block; width:100%; min-height:370px; }
  .constellation > svg > ellipse { fill:none; stroke:rgba(255,255,255,.055); stroke-dasharray:3 9; }
  .planet circle { fill:var(--planet); fill-opacity:.54; stroke:rgba(255,255,255,.58); stroke-width:1; filter:drop-shadow(0 0 13px var(--planet)); transition:.2s; }
  .planet text { fill:#aeb3c5; font-size:9px; text-anchor:middle; opacity:.8; }
  .planet:hover circle,.planet:focus circle { fill-opacity:.92; stroke:#fff; transform:scale(1.08); transform-box:fill-box; transform-origin:center; }
  .planet:hover text,.planet:focus text { fill:#fff; opacity:1; }
  figcaption { color:var(--muted); font-size:10px; line-height:1.5; }
  .repo-ledger { margin-top:18px; border:1px solid var(--line); border-radius:20px; background:rgba(10,11,19,.54); overflow:hidden; }
  .repo-row { border-bottom:1px solid var(--line); }
  .repo-row:last-child { border-bottom:0; }
  .repo-row summary { display:grid; min-height:72px; padding:14px 18px; align-items:center; grid-template-columns:40px minmax(170px,1fr) minmax(90px,.55fr) 58px; cursor:pointer; list-style:none; gap:16px; }
  .repo-row summary::-webkit-details-marker { display:none; }
  .repo-row:hover summary,.repo-row[open] summary { background:rgba(168,121,255,.055); }
  .repo-rank { color:#555c71; font-size:9px; }
  .repo-name { display:flex; min-width:0; flex-direction:column; gap:5px; }
  .repo-name strong { overflow:hidden; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
  .repo-name small { color:var(--muted); font-size:8px; }
  .repo-gravity { display:block; height:3px; background:rgba(255,255,255,.05); }
  .repo-gravity i { display:block; height:100%; background:linear-gradient(90deg,var(--violet),var(--aqua)); }
  .repo-value { color:var(--soft); font-size:10px; text-align:right; }
  .repo-row dl { display:grid; margin:0; padding:5px 18px 22px 74px; grid-template-columns:repeat(6,1fr); gap:12px; }
  .repo-row dl div { min-width:0; }
  dt { color:var(--muted); font-size:7px; text-transform:uppercase; }
  dd { margin:5px 0 0; font-size:13px; }
  .language-stack { display:flex; height:13px; margin-bottom:30px; border-radius:99px; background:rgba(255,255,255,.04); overflow:hidden; }
  .language-stack i { min-width:2px; transition:filter .18s,flex-grow .18s; }
  .language-stack i:hover { filter:brightness(1.5); flex-grow:.04; }
  .language-list { border-top:1px solid var(--line); }
  .language-row { position:relative; display:grid; min-height:68px; align-items:center; border-bottom:1px solid var(--line); grid-template-columns:30px 8px minmax(130px,1fr) minmax(80px,.75fr) 55px; gap:13px; }
  .language-row > i { width:7px; height:7px; border-radius:50%; box-shadow:0 0 12px currentColor; }
  .language-row > span:nth-child(3) { display:flex; flex-direction:column; gap:4px; }
  .language-row strong { font-size:11px; }
  .language-row small,.language-index { color:var(--muted); font-size:8px; }
  .language-row > em { position:absolute; right:0; bottom:7px; color:var(--muted); font-size:7px; font-style:normal; opacity:0; }
  .language-row:hover > em,.language-row:focus > em { opacity:1; }
  .delivery-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .delivery-grid .metric { min-height:185px; border:1px solid var(--line); border-radius:17px; }
  .theme-grid { display:grid; margin-top:16px; grid-template-columns:repeat(3,1fr); gap:10px; }
  .theme-card { padding:20px; border:1px solid var(--line); border-radius:16px; background:rgba(9,10,18,.48); }
  .theme-card > span { color:var(--soft); font-size:10px; }
  .theme-card > strong { display:block; margin:14px 0; font-size:27px; letter-spacing:-.04em; }
  .theme-card > i b { background:var(--theme); }
  .theme-card > small { display:block; margin-top:10px; color:var(--muted); font-size:8px; }
  .signature { display:grid; grid-template-columns:minmax(220px,.65fr) minmax(0,1.35fr); gap:18px; }
  .archetype { display:flex; min-height:370px; padding:36px; justify-content:flex-end; border:1px solid rgba(255,209,102,.2); border-radius:24px; flex-direction:column; background:radial-gradient(circle at 80% 10%,rgba(255,209,102,.24),transparent 48%),linear-gradient(155deg,#28172c,#171323); }
  .archetype span { color:var(--gold); font-size:9px; font-weight:800; letter-spacing:.15em; text-transform:uppercase; }
  .archetype h3 { margin:16px 0; font-size:38px; letter-spacing:-.055em; line-height:1; }
  .archetype p { margin:0; color:#c4b9c8; font-size:13px; line-height:1.6; }
  .dna-grid { display:grid; padding:26px; border:1px solid var(--line); border-radius:24px; background:var(--surface); grid-template-columns:1fr 1fr; gap:14px; }
  .dna-axis { padding:18px; border:1px solid var(--line); border-radius:14px; background:rgba(9,10,18,.4); }
  .dna-axis header { display:flex; align-items:center; justify-content:space-between; }
  .dna-axis header span { color:var(--soft); font-size:10px; }
  .dna-axis header strong { font-size:20px; }
  .dna-axis > i { margin:14px 0 12px; }
  .dna-axis p { margin:0; color:var(--muted); font-size:8px; line-height:1.5; }
  .narrative-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
  .narrative { min-height:310px; padding:30px; border:1px solid var(--line); border-radius:22px; background:linear-gradient(145deg,rgba(20,20,34,.9),rgba(11,12,20,.82)); }
  .narrative > span { color:var(--aqua); font-size:8px; font-weight:800; letter-spacing:.15em; text-transform:uppercase; }
  .narrative--3 > span { color:var(--rose); }
  .narrative h3 { margin:20px 0 12px; font-size:29px; font-weight:590; letter-spacing:-.045em; line-height:1.05; }
  .narrative > p { color:var(--soft); font-size:12px; line-height:1.65; }
  details summary { color:var(--soft); cursor:pointer; font-size:9px; font-weight:700; }
  .narrative details { margin-top:25px; padding-top:16px; border-top:1px solid var(--line); }
  .narrative ul { padding-left:18px; color:var(--soft); font-size:10px; line-height:1.7; }
  .narrative details small { display:block; color:var(--muted); line-height:1.55; }
  .boundary { padding:27px; border:1px solid rgba(255,209,102,.2); border-radius:20px; background:rgba(255,209,102,.035); }
  .boundary > span { display:block; color:var(--gold); font-size:8px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
  .boundary strong { display:block; margin:10px 0; font-size:17px; }
  .boundary p { max-width:890px; margin:0; color:#aaa491; font-size:11px; line-height:1.65; }
  footer { display:flex; padding:34px 0 52px; align-items:center; justify-content:space-between; color:var(--muted); font-size:10px; }
  footer a { color:var(--soft); }
  .story-nav { position:sticky; z-index:30; top:10px; display:flex; width:min-content; margin:18px auto; padding:6px; border:1px solid var(--line-strong); border-radius:99px; background:rgba(8,9,16,.82); backdrop-filter:blur(18px); }
  .story-nav a { display:grid; width:37px; height:37px; place-items:center; border-radius:50%; color:var(--muted); font-size:9px; text-decoration:none; }
  .story-nav a:hover,.story-nav a:focus { color:var(--ink); background:rgba(168,121,255,.18); }
  .story { scroll-snap-type:y proximity; }
  .chapter { position:relative; display:grid; min-height:86vh; margin:20px 0; padding:clamp(35px,6vw,82px); align-items:center; border:1px solid var(--line); border-radius:32px; background:linear-gradient(145deg,rgba(18,19,32,.94),rgba(9,10,18,.86)); scroll-margin-top:80px; scroll-snap-align:start; overflow:hidden; }
  .chapter:target { border-color:rgba(168,121,255,.42); box-shadow:0 0 90px rgba(168,121,255,.11); }
  .chapter::before { position:absolute; width:420px; height:420px; right:-190px; bottom:-210px; border-radius:50%; background:var(--chapter,var(--violet)); filter:blur(100px); opacity:.18; content:""; }
  .chapter-copy { position:relative; z-index:1; max-width:820px; }
  .chapter-copy > span { color:var(--chapter,var(--aqua)); font-size:10px; font-weight:800; letter-spacing:.17em; text-transform:uppercase; }
  .chapter h2 { margin:22px 0 20px; font-size:clamp(47px,7vw,88px); font-weight:580; letter-spacing:-.07em; line-height:.92; text-wrap:balance; }
  .chapter-copy > p { max-width:700px; color:var(--soft); font-size:clamp(15px,1.6vw,20px); line-height:1.6; }
  .chapter-stat { margin-top:45px; }
  .chapter-stat strong { display:block; font-size:clamp(74px,12vw,148px); font-weight:550; letter-spacing:-.08em; line-height:.78; }
  .chapter-stat span { display:block; margin-top:20px; color:var(--muted); font-size:10px; letter-spacing:.12em; text-transform:uppercase; }
  .chapter details { position:relative; z-index:2; max-width:700px; margin-top:38px; padding:18px; border:1px solid var(--line); border-radius:14px; background:rgba(0,0,0,.16); }
  .chapter details ul { color:var(--soft); font-size:11px; line-height:1.7; }
  .chapter details p { color:var(--muted); font-size:10px; line-height:1.55; }
  .chapter .constellation { width:min(820px,100%); margin:28px auto 0; }
  .chapter .language-list { max-width:850px; }
  .chapter .dna-grid { max-width:900px; margin-top:32px; }
  .chapter .week-strip { max-width:900px; height:220px; }
  .chapter .boundary { max-width:900px; margin-top:34px; }
  .connection-card { max-width:850px; margin-top:38px; padding:32px; border:1px solid rgba(239,115,189,.25); border-radius:20px; background:rgba(239,115,189,.045); }
  .connection-card strong { display:block; font-size:24px; letter-spacing:-.035em; }
  .connection-card p { color:var(--soft); line-height:1.65; }
  .closing-grid { display:grid; max-width:850px; margin-top:42px; grid-template-columns:repeat(3,1fr); gap:12px; }
  .closing-grid article { padding:22px; border:1px solid var(--line); border-radius:16px; }
  .closing-grid strong { display:block; font-size:26px; }
  .closing-grid span { color:var(--muted); font-size:8px; text-transform:uppercase; }
  .empty { color:var(--muted); }
  @media (max-width:980px) {
    .metric-grid { grid-template-columns:repeat(3,1fr); }
    .metric:nth-child(3) { border-right:1px solid var(--line); border-radius:0 22px 22px 0; }
    .metric:nth-child(4) { border-radius:22px 0 0 22px; }
    .split,.signature { grid-template-columns:1fr; }
    .delivery-grid { grid-template-columns:1fr 1fr; }
    .repo-row dl { grid-template-columns:repeat(3,1fr); }
  }
  @media (max-width:680px) {
    .shell { width:min(100% - 22px,1220px); }
    .topbar { min-height:58px; }
    .topbar > span { display:none; }
    .hero { min-height:570px; padding:70px 23px 40px; border-radius:24px; }
    .hero::after { top:70px; right:-20px; opacity:.55; }
    h1 { font-size:55px; }
    .metric-grid { grid-template-columns:1fr 1fr; }
    .metric,.metric:nth-child(3),.metric:nth-child(4) { min-height:180px; border:1px solid var(--line); border-radius:0; }
    .metric:nth-child(1) { border-radius:18px 0 0 0; }
    .metric:nth-child(2) { border-radius:0 18px 0 0; }
    .metric:nth-last-child(2) { border-radius:0 0 0 18px; }
    .metric:last-child { border-radius:0 0 18px 0; }
    .metric p { display:none; }
    .journey { margin-bottom:70px; justify-content:flex-start; }
    .section { margin-bottom:85px; }
    .section-heading { grid-template-columns:1fr; gap:10px; }
    .panel { padding:18px; border-radius:20px; }
    .week-strip { height:210px; }
    .week-bar { min-width:8px; }
    .constellation svg { min-height:240px; }
    .repo-row summary { grid-template-columns:28px minmax(0,1fr) 46px; }
    .repo-gravity { display:none; }
    .repo-row dl { padding-left:58px; grid-template-columns:1fr 1fr; }
    .language-row { grid-template-columns:20px 7px minmax(100px,1fr) 48px; }
    .language-meter { display:none; }
    .language-row > em { display:none; }
    .delivery-grid,.theme-grid,.dna-grid,.narrative-grid,.closing-grid { grid-template-columns:1fr; }
    .chapter { min-height:82vh; padding:55px 24px; border-radius:23px; }
    .chapter h2 { font-size:48px; }
    .story-nav { max-width:100%; overflow-x:auto; }
    .story-nav a { flex:0 0 34px; }
    footer { align-items:flex-start; flex-direction:column; gap:14px; }
  }
  @media (prefers-reduced-motion:reduce) { html { scroll-behavior:auto; } * { transition:none !important; } }
  @media print {
    :root,body { background:#fff; color:#111; }
    .hero,.panel,.metric,.repo-ledger,.theme-card,.archetype,.dna-grid,.dna-axis,.narrative,.chapter,.boundary { color:#111; background:#fff; border-color:#ccc; box-shadow:none; }
    .journey,.story-nav,.skip { display:none; }
    .section,.chapter { break-inside:avoid; margin-bottom:30px; }
    .chapter { min-height:0; page-break-after:always; }
    .chapter:last-child { page-break-after:auto; }
    .lede,.section-heading p,.chapter-copy > p,.narrative > p,.boundary p,figcaption,.repo-name small,.language-row small,.dna-axis p { color:#444; }
    .metric p { display:block; color:#555; opacity:1; transform:none; }
  }
`

function documentShell(payload: PortableExportPayload, body: string, bodyClass: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(payload.title)} · Developer Lens</title>
  <style>${STYLES}</style>
</head>
<body class="${bodyClass}">
  <a class="skip" href="#content">Skip to the experience</a>
  <div class="shell">
    <header class="topbar" id="top">
      <span class="brand"><i aria-hidden="true"></i>Developer Lens</span>
      <span>${escapeHtml(payload.rangeLabel)} · portable ${escapeHtml(payload.artifact)}</span>
    </header>
    ${body}
    <footer>
      <span>Developer Lens · reflection, not productivity scoring</span>
      <a href="#top">Back to top ↑</a>
    </footer>
  </div>
</body>
</html>`
}

function dashboardReport(payload: PortableExportPayload): string {
  const strongestWeek = payload.weeks.reduce(
    (strongest, week) => (week.total > strongest.total ? week : strongest),
    payload.weeks[0] ?? {
      label: 'No eligible week',
      total: 0,
      commits: 0,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
      activeDays: 0,
      repositories: 0,
    },
  )
  const topLanguage = payload.languages[0]
  const narratives = payload.narratives.map(narrativeCard).join('')
  const body = `
    <section class="hero">
      <span class="kicker">Portable full dashboard</span>
      <h1>${escapeHtml(payload.title)}</h1>
      <p class="lede">${escapeHtml(payload.subtitle)}</p>
      <div class="hero-meta">
        <span>${escapeHtml(payload.rangeLabel)}</span>
        <span>${escapeHtml(payload.archetype.name)}</span>
        ${reportLink(payload)}
      </div>
    </section>

    <section class="metric-grid" aria-label="Headline aggregates">
      ${metric(formatNumber(payload.summary.commits), 'Commit signals', 'Deduplicated commit events visible to the collector.')}
      ${metric(formatNumber(payload.summary.mergedPullRequests), 'Merged PRs', 'Authored pull requests observed as merged.', 'aqua')}
      ${metric(formatNumber(payload.summary.reviews), 'Reviews', 'Submitted review events visible in the period.', 'gold')}
      ${metric(formatNumber(payload.summary.activeDays), 'Active days', 'Calendar days carrying at least one visible contribution signal.', 'ember')}
      ${metric(formatNumber(payload.summary.activeWeeks), 'Active weeks', 'Relative weeks carrying visible activity.', 'rose')}
      ${metric(formatNumber(payload.summary.repositories), 'Repositories', 'Repositories represented by sustained or incidental aggregate activity.')}
    </section>

    <nav class="journey" aria-label="Dashboard journey">
      <a href="#rhythm">Rhythm</a>
      <a href="#portfolio">Portfolio</a>
      <a href="#landscape">Languages</a>
      <a href="#delivery">Delivery</a>
      <a href="#signature">Signature</a>
      <a href="#connections">Connections</a>
      <a href="#limits">Limits</a>
    </nav>

    <main id="content">
      <section class="section" id="rhythm">
        <header class="section-heading">
          <span>01 · Rhythm</span>
          <div><h2>Continuity has a shape.</h2><p>Every date became a relative week or weekday bucket before export. Hover or focus a bar for its aggregate evidence.</p></div>
        </header>
        <div class="split">
          <div class="panel"><div class="week-strip">${weeklyBars(payload)}</div></div>
          <aside class="panel">
            <span class="kicker">Weekday distribution</span>
            <h3>${escapeHtml(strongestWeek.label)} held the strongest visible wave.</h3>
            <div class="weekday-list">${weekdayBars(payload)}</div>
          </aside>
        </div>
      </section>

      <section class="section" id="portfolio">
        <header class="section-heading">
          <span>02 · Portfolio</span>
          <div><h2>${payload.summary.effectiveRepositories} of ${payload.summary.repositories} repositories held sustained gravity.</h2><p>The constellation sizes aggregate engagement. Names follow the redaction choice made before this file was created.</p></div>
        </header>
        <div class="panel">${constellation(payload)}</div>
        <div class="repo-ledger">${repositoryLedger(payload)}</div>
      </section>

      <section class="section" id="landscape">
        <header class="section-heading">
          <span>03 · Landscape</span>
          <div><h2>${escapeHtml(topLanguage?.name ?? 'The language landscape')} led the technical mix.</h2><p>Activity-weighted share combines current repository composition with visible activity. The footprint measure remains available on hover.</p></div>
        </header>
        <div class="panel">${languageLandscape(payload)}</div>
      </section>

      <section class="section" id="delivery">
        <header class="section-heading">
          <span>04 · Delivery</span>
          <div><h2>Changes, feedback, and work crossing the line.</h2><p>These are system traces. They do not measure quality, effort, hours worked, or a person’s value.</p></div>
        </header>
        <div class="delivery-grid">
          ${metric(formatNumber(payload.summary.pullRequests), 'Authored PRs', 'Change proposals observed in the period.')}
          ${metric(percentage(payload.summary.mergeRate), 'Merge rate', 'Share of authored pull requests observed as merged.', 'aqua')}
          ${metric(hours(payload.summary.medianMergeHours), 'Median to merge', 'Creation-to-merge interval where eligible.', 'gold')}
          ${metric(formatNumber(payload.summary.issues), 'Issues', 'Authored issue events visible in the period.', 'ember')}
        </div>
        <div class="theme-grid">${themeGrid(payload)}</div>
      </section>

      <section class="section" id="signature">
        <header class="section-heading">
          <span>05 · Signature</span>
          <div><h2>A descriptive profile, never a composite score.</h2><p>Six independently labelled axes keep the shape inspectable instead of collapsing it into a ranking.</p></div>
        </header>
        <div class="signature">
          <article class="archetype"><span>Builder archetype</span><h3>${escapeHtml(payload.archetype.name)}</h3><p>${escapeHtml(payload.archetype.description)}</p></article>
          <div class="dna-grid">${dnaGrid(payload)}</div>
        </div>
      </section>

      <section class="section" id="connections">
        <header class="section-heading">
          <span>06 · Connections</span>
          <div><h2>From counts to bounded interpretation.</h2><p>Observed shapes, derived patterns, and hypotheses stay distinct. Open each card to audit its evidence and limitation.</p></div>
        </header>
        <div class="narrative-grid">${narratives}</div>
      </section>

      <section class="section" id="limits">
        <header class="section-heading">
          <span>07 · Evidence</span>
          <div><h2>Coverage travels with the story.</h2><p>A missing or unavailable source is not treated as zero activity. This portable view keeps only source-status counts, never raw warning text.</p></div>
        </header>
        <div class="delivery-grid">
          ${metric(`${payload.summary.coverageScore}%`, 'Coverage score', 'Aggregate source coverage for this snapshot.')}
          ${metric(formatNumber(payload.coverage.complete), 'Complete sources', 'Sources marked complete by the collector.', 'aqua')}
          ${metric(formatNumber(payload.coverage.partial), 'Partial sources', 'Sources that returned bounded or incomplete evidence.', 'gold')}
          ${metric(formatNumber(payload.coverage.unavailable), 'Unavailable sources', 'Sources absent or unavailable to the collector.', 'ember')}
        </div>
        <div style="margin-top:18px">${boundary(payload)}</div>
      </section>
    </main>`
  return documentShell(payload, body, 'dashboard-report')
}

function evidenceDetails(narrative: PortableNarrative): string {
  return `<details><summary>Open the evidence</summary><ul>${narrative.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p>${escapeHtml(narrative.limitation)}</p></details>`
}

function wrappedReport(payload: PortableExportPayload): string {
  const cadence = payload.narratives.find((item) => item.id === 'cadence') ?? payload.narratives[0]
  const delivery = payload.narratives.find((item) => item.id === 'delivery') ?? payload.narratives[0]
  const landscape = payload.narratives.find((item) => item.id === 'landscape') ?? payload.narratives[0]
  const connection = payload.narratives.find((item) => item.id === 'connection') ?? payload.narratives.at(-1)!
  const topLanguage = payload.languages[0]
  const body = `
    <section class="hero">
      <span class="kicker">Portable complete Wrapped</span>
      <h1>${escapeHtml(payload.title)}</h1>
      <p class="lede">${escapeHtml(payload.subtitle)}</p>
      <div class="hero-meta"><span>All nine chapters</span><span>${escapeHtml(payload.rangeLabel)}</span>${reportLink(payload)}</div>
    </section>
    <nav class="story-nav" aria-label="Wrapped chapters">
      ${Array.from({ length: 9 }, (_, index) => `<a href="#chapter-${index + 1}" aria-label="Chapter ${index + 1}">${String(index + 1).padStart(2, '0')}</a>`).join('')}
    </nav>
    <main class="story" id="content">
      <section class="chapter" id="chapter-1" data-chapter="1" style="--chapter:#a879ff">
        <div class="chapter-copy"><span>01 · The opening frame</span><h2>A development trail came into focus.</h2><p>Observable contribution events formed the opening picture. Density describes active periods, never time worked.</p><div class="chapter-stat"><strong>${formatNumber(payload.summary.contributions)}</strong><span>visible contribution signals</span></div>${evidenceDetails(cadence)}</div>
      </section>
      <section class="chapter" id="chapter-2" data-chapter="2" style="--chapter:#6e73ff">
        <div class="chapter-copy"><span>02 · The constellation</span><h2>${payload.summary.repositories} repositories. ${payload.summary.effectiveRepositories} held the gravity.</h2><p>Every project remains present as an aggregate node, with names governed by the chosen export boundary.</p></div>
        ${constellation(payload)}
        <details><summary>Why “effective” matters</summary><ul><li>${payload.summary.repositories} repositories were observed.</li><li>${payload.summary.effectiveRepositories} crossed the sustained-engagement threshold.</li></ul><p>Incidental and sustained traces should not carry identical narrative weight.</p></details>
      </section>
      <section class="chapter" id="chapter-3" data-chapter="3" style="--chapter:#ffd166">
        <div class="chapter-copy"><span>03 · The signature</span><h2>${escapeHtml(payload.archetype.name)}</h2><p>${escapeHtml(payload.archetype.description)}</p></div>
        <div class="dna-grid">${dnaGrid(payload)}</div>
        <details><summary>Inspect the signature</summary><p>The label is selected from transparent thresholds across six axes. It is descriptive, not a performance score.</p></details>
      </section>
      <section class="chapter" id="chapter-4" data-chapter="4" style="--chapter:#53e2bd">
        <div class="chapter-copy"><span>04 · The rhythm</span><h2>${payload.summary.activeWeeks} weeks lit up.</h2><p>${payload.summary.longestStreak} days formed the longest visible run. Cadence is a shape, not a score.</p><div class="week-strip">${weeklyBars(payload, 26)}</div>${evidenceDetails(cadence)}</div>
      </section>
      <section class="chapter" id="chapter-5" data-chapter="5" style="--chapter:#ff756d">
        <div class="chapter-copy"><span>05 · Crossing the line</span><h2>${formatNumber(payload.summary.mergedPullRequests)} changes crossed the line.</h2><p>${percentage(payload.summary.mergeRate)} observed merge rate · ${hours(payload.summary.medianMergeHours)} median creation-to-merge where eligible.</p><div class="closing-grid"><article><strong>${formatNumber(payload.summary.pullRequests)}</strong><span>Authored PRs</span></article><article><strong>${formatNumber(payload.summary.reviews)}</strong><span>Reviews</span></article><article><strong>${formatNumber(payload.summary.issues)}</strong><span>Issues</span></article></div>${evidenceDetails(delivery)}</div>
      </section>
      <section class="chapter" id="chapter-6" data-chapter="6" style="--chapter:#ffd166">
        <div class="chapter-copy"><span>06 · The privacy boundary</span><h2>The hidden work stayed hidden.</h2><p>${payload.scope === 'public-demo' ? 'This public story is built from invented events.' : `${payload.summary.privateRepositories} private repositories are represented only through aggregates and aliases.`}</p>${boundary(payload)}</div>
      </section>
      <section class="chapter" id="chapter-7" data-chapter="7" style="--chapter:#4ea7ff">
        <div class="chapter-copy"><span>07 · The technical landscape</span><h2>${escapeHtml(topLanguage?.name ?? 'Multiple languages')} led a landscape of ${payload.languages.length}.</h2><p>Composition is weighted by work in motion and stays visibly distinct from raw repository footprint.</p>${languageLandscape(payload)}${evidenceDetails(landscape)}</div>
      </section>
      <section class="chapter" id="chapter-8" data-chapter="8" style="--chapter:#ef73bd">
        <div class="chapter-copy"><span>08 · The deeper connection</span><h2>${escapeHtml(connection.title)}</h2><p>${escapeHtml(connection.body)}</p><div class="connection-card"><strong>Third-order, deliberately bounded</strong><p>Independent aggregate signals aligned strongly enough to name a hypothesis while keeping alternatives and limits attached.</p></div>${evidenceDetails(connection)}</div>
      </section>
      <section class="chapter" id="chapter-9" data-chapter="9" style="--chapter:#53e2bd">
        <div class="chapter-copy"><span>09 · The next lens</span><h2>A reflection, not a verdict.</h2><p>The useful ending is a better question: what deserves attention next, and what evidence would change the interpretation?</p><div class="closing-grid"><article><strong>${payload.summary.coverageScore}%</strong><span>Source coverage</span></article><article><strong>${payload.summary.activeWeeks}</strong><span>Active weeks</span></article><article><strong>${payload.summary.effectiveRepositories}</strong><span>Sustained systems</span></article></div><details><summary>Keep the limits close</summary><p>Counts describe observed traces, not quality, productivity, effort, or human value. Missing evidence remains missing rather than becoming zero.</p></details></div>
      </section>
    </main>`
  return documentShell(payload, body, 'wrapped-report')
}

export function buildPortableExperienceReport(payload: PortableExportPayload): string {
  return payload.artifact === 'wrapped' ? wrappedReport(payload) : dashboardReport(payload)
}
