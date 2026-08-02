import type { SharePayload } from './sharePayload.js'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function buildStandaloneReport(payload: SharePayload): string {
  const metricCards = payload.metrics
    .map(
      (metric) => `<article><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.label)}</span></article>`,
    )
    .join('')
  const link = payload.canonicalUrl
    ? `<a href="${escapeHtml(payload.canonicalUrl)}">Open the interactive synthetic showcase</a>`
    : '<p>This redacted report is a local file. It does not recreate or upload the private dashboard.</p>'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(payload.title)} · Developer Lens</title>
  <style>
    :root { color-scheme: dark; font-family: "Segoe UI", Inter, system-ui, sans-serif; background:#080911; color:#f6f4ff; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; background:radial-gradient(circle at 90% 5%, ${payload.accent[0]}44, transparent 35rem),radial-gradient(circle at 15% 100%, ${payload.accent[1]}2f, transparent 30rem),#080911; }
    main { width:min(1040px,calc(100% - 40px)); margin:0 auto; padding:72px 0; }
    header { border:1px solid #ffffff1c; border-radius:32px; padding:clamp(32px,6vw,72px); background:#11131ee8; box-shadow:0 28px 90px #0008; }
    .brand { display:flex; align-items:center; justify-content:space-between; margin-bottom:84px; color:#c4c8d6; font-size:14px; }
    .brand strong { color:#fff; font-size:19px; }
    .eyebrow { color:${payload.accent[1]}; text-transform:uppercase; letter-spacing:.2em; font-size:12px; font-weight:750; }
    h1 { max-width:780px; margin:18px 0 20px; font-size:clamp(46px,7vw,80px); line-height:.98; letter-spacing:-.055em; }
    .lede { max-width:720px; margin:0; color:#b6bbcc; font-size:clamp(18px,2.5vw,24px); line-height:1.55; }
    .metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin:22px 0; }
    article { min-height:150px; padding:26px; border:1px solid #ffffff17; border-radius:22px; background:#121521d9; }
    article strong { display:block; font-size:38px; letter-spacing:-.04em; }
    article span { display:block; margin-top:32px; color:#9299ad; font-size:12px; text-transform:uppercase; letter-spacing:.13em; }
    footer { display:flex; gap:20px; align-items:flex-start; justify-content:space-between; margin-top:22px; padding:24px 4px; color:#969daf; font-size:13px; line-height:1.6; }
    footer p { margin:0; max-width:670px; }
    a { color:#ddceff; }
    @media (max-width:700px) { main{width:min(100% - 24px,1040px);padding:20px 0}.brand{margin-bottom:54px}.metrics{grid-template-columns:1fr 1fr}header{border-radius:24px}footer{display:block} }
    @media print { :root,body{background:#fff;color:#111}main{width:100%;padding:0}header,article{background:#fff;border-color:#ddd;box-shadow:none}.lede,article span,footer{color:#444}a{color:#111} }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand"><strong>Developer Lens</strong><span>${escapeHtml(payload.rangeLabel)}</span></div>
      <span class="eyebrow">${escapeHtml(payload.eyebrow)}</span>
      <h1>${escapeHtml(payload.title)}</h1>
      <p class="lede">${escapeHtml(payload.description)}</p>
    </header>
    <section class="metrics" aria-label="Shareable aggregate metrics">${metricCards}</section>
    <footer>
      <p>${escapeHtml(payload.privacyNote)}. This reflection is not a measure of productivity, quality, or human value.</p>
      <div>${link}</div>
    </footer>
  </main>
</body>
</html>`
}
