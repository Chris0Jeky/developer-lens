import type { SharePayload } from './sharePayload.js'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function wrapText(value: string, maximum = 34): string[] {
  const words = value.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length > maximum && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

export function buildShareCardSvg(payload: SharePayload): string {
  const titleLines = wrapText(payload.title)
  const descriptionLines = wrapText(payload.description, 72)
  const metrics = payload.metrics.slice(0, 3)
  const title = titleLines
    .map((line, index) => `<tspan x="82" dy="${index === 0 ? 0 : 66}">${escapeXml(line)}</tspan>`)
    .join('')
  const descriptionStart = 276 + Math.max(0, titleLines.length - 1) * 66
  const description = descriptionLines
    .map((line, index) => `<tspan x="84" dy="${index === 0 ? 0 : 30}">${escapeXml(line)}</tspan>`)
    .join('')
  const statCells = metrics
    .map((metric, index) => {
      const x = 82 + index * 265
      return `<g transform="translate(${x} 468)">
        <text class="stat-value" x="0" y="0">${escapeXml(metric.value)}</text>
        <text class="stat-label" x="0" y="31">${escapeXml(metric.label.toUpperCase())}</text>
      </g>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(payload.title)}">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#090a13"/>
      <stop offset="0.56" stop-color="#101020"/>
      <stop offset="1" stop-color="#080a11"/>
    </linearGradient>
    <radialGradient id="glowOne">
      <stop offset="0" stop-color="${payload.accent[0]}" stop-opacity=".82"/>
      <stop offset="1" stop-color="${payload.accent[0]}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowTwo">
      <stop offset="0" stop-color="${payload.accent[1]}" stop-opacity=".64"/>
      <stop offset="1" stop-color="${payload.accent[1]}" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="42"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="14"/></filter>
    <style>
      text { font-family: Inter, "Segoe UI", Arial, sans-serif; fill: #f7f5ff; }
      .eyebrow { font-size: 16px; font-weight: 700; letter-spacing: 3.2px; fill: #b7bdd0; }
      .title { font-size: 58px; font-weight: 720; letter-spacing: -2.2px; }
      .description { font-size: 21px; fill: #b8bdcf; }
      .stat-value { font-size: 42px; font-weight: 720; }
      .stat-label { font-size: 12px; font-weight: 700; letter-spacing: 2px; fill: #838ba5; }
      .range { font-size: 14px; font-weight: 650; fill: #ddd5ff; }
      .footer { font-size: 13px; fill: #8e95aa; }
      .brand { font-size: 18px; font-weight: 720; letter-spacing: .2px; }
    </style>
  </defs>
  <rect width="1200" height="630" rx="0" fill="url(#background)"/>
  <circle cx="1080" cy="92" r="300" fill="url(#glowOne)" filter="url(#blur)" opacity=".55"/>
  <circle cx="990" cy="570" r="270" fill="url(#glowTwo)" filter="url(#blur)" opacity=".42"/>
  <circle cx="1035" cy="300" r="134" fill="none" stroke="${payload.accent[0]}" stroke-opacity=".5" stroke-width="1.5"/>
  <circle cx="1035" cy="300" r="91" fill="none" stroke="${payload.accent[1]}" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="5 10"/>
  <circle cx="1035" cy="300" r="52" fill="${payload.accent[0]}" fill-opacity=".78" filter="url(#soft)"/>
  <circle cx="1035" cy="300" r="38" fill="#17142b" stroke="#ece5ff" stroke-opacity=".5"/>
  <circle cx="1160" cy="218" r="11" fill="${payload.accent[1]}"/>
  <circle cx="906" cy="420" r="8" fill="${payload.accent[0]}"/>
  <rect x="48" y="40" width="1104" height="550" rx="34" fill="none" stroke="#ffffff" stroke-opacity=".09"/>
  <g transform="translate(82 78)">
    <circle cx="13" cy="13" r="12" fill="none" stroke="${payload.accent[1]}" stroke-width="2"/>
    <circle cx="13" cy="13" r="4" fill="${payload.accent[0]}"/>
    <text class="brand" x="36" y="20">Developer Lens</text>
  </g>
  <rect x="860" y="72" width="248" height="38" rx="19" fill="#ffffff" fill-opacity=".07" stroke="#ffffff" stroke-opacity=".12"/>
  <text class="range" x="984" y="97" text-anchor="middle">${escapeXml(payload.rangeLabel)}</text>
  <text class="eyebrow" x="82" y="168">${escapeXml(payload.eyebrow.toUpperCase())}</text>
  <text class="title" x="82" y="236">${title}</text>
  <text class="description" x="84" y="${descriptionStart}">${description}</text>
  <line x1="82" y1="430" x2="826" y2="430" stroke="#ffffff" stroke-opacity=".11"/>
  ${statCells}
  <text class="footer" x="82" y="565">${escapeXml(payload.privacyNote)}</text>
  <text class="footer" x="1108" y="565" text-anchor="end">developer-lens</text>
</svg>`
}
