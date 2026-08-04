// Starter-pack generator — planning tooling only, never shipped as product code.
// Single structured source: cards.mjs (directive §8: card descriptions are generated from one
// canonical source, never hand-duplicated across roadmap and Taskdeck).
// Emits: ../developer-lens-intelligence-platform.taskdeck.json (Taskdeck starter pack)
//        and rewrites the generated card index section of ../../07_DELIVERY_ROADMAP.md.
// Run: node generate.mjs   (from this directory; no dependencies beyond Node >= 18)
import { CARDS, EPICS } from './cards.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_JSON = join(HERE, '..', 'developer-lens-intelligence-platform.taskdeck.json');
const ROADMAP = join(HERE, '..', '..', '07_DELIVERY_ROADMAP.md');
const INDEX_MARKER = '## 6. Card index (generated from the single card source)';

const COLUMNS = [
  { name: 'Open Questions', position: 0 },
  { name: 'Proposed', position: 1 },
  { name: 'Ready', position: 2 },
  { name: 'In Progress', position: 3 },
  { name: 'Review', position: 4 },
  { name: 'Done', position: 5 },
];

const STATUS_COLUMN = {
  READY: 'Ready',
  BLOCKED_BY_DEPENDENCY: 'Proposed',
  RESEARCH: 'Proposed',
  PARKED: 'Proposed',
  OWNER_GATED: 'Proposed',
  QUESTION: 'Open Questions',
  DONE: 'Done',
};

const STATUS_LABEL = {
  READY: 'status:ready',
  BLOCKED_BY_DEPENDENCY: 'status:blocked',
  RESEARCH: 'status:research',
  PARKED: 'status:parked',
  OWNER_GATED: 'status:owner-gated',
  QUESTION: 'status:question',
  DONE: 'status:done',
};

const LABELS = [
  // status
  ['status:ready', '#2E7D32'], ['status:blocked', '#9E9E9E'], ['status:research', '#6A1B9A'],
  ['status:parked', '#795548'], ['status:owner-gated', '#C62828'], ['status:question', '#00838F'],
  ['status:done', '#1B5E20'],
  // execution horizon (reconciliation 2026-08-04: bounded active queue + freeze list)
  ['horizon:active', '#00C853'], ['horizon:frozen', '#37474F'],
  // type
  ['type:contract', '#1565C0'], ['type:implementation', '#0277BD'], ['type:research', '#7B1FA2'],
  ['type:ux', '#EF6C00'], ['type:evaluation', '#5E35B1'], ['type:process', '#455A64'],
  ['type:spec', '#00695C'],
  // privacy class ceiling
  ['privacy:C0', '#66BB6A'], ['privacy:C1', '#43A047'], ['privacy:C1-C3', '#F9A825'],
  ['privacy:C4-ephemeral', '#EF5350'],
  // authority
  ['gate:G2', '#8D6E63'], ['gate:G3-standing', '#D84315'], ['gate:G4-luna', '#AD1457'],
  ['gate:owner-decision', '#B71C1C'],
  // risk
  ['risk:low', '#A5D6A7'], ['risk:medium', '#FFE082'], ['risk:high', '#EF9A9A'],
  // milestones
  ['M1-spine', '#90CAF9'], ['M2-first-slice', '#64B5F6'], ['M3-structure', '#42A5F5'],
  ['M4-flow', '#2196F3'], ['M5-feedback-pack', '#1E88E5'], ['M6-time-graph-wb', '#1976D2'],
  ['M7-interpretation', '#1565C0'], ['M8-story-frontier', '#0D47A1'],
  // epics (kept short, <=30 chars)
  ...Object.entries(EPICS).map(([k, v]) => [`epic:${k}`, v.color]),
  // demo relevance
  ['demo:showcase', '#FFB300'],
];

function buildDescription(c) {
  const head = `[${c.id} | epic:${c.epic} | ${c.type} | ${c.status} | risk:${c.risk} | effort:${c.effort} | ${c.milestone}]`;
  const lines = [head];
  if (c.question) lines.push(`Question: ${c.question}`);
  lines.push(
    `Outcome: ${c.outcome}`,
    `Deps: ${c.deps || 'none'} | Unlock: ${c.unlock || '-'}`,
    `Paths: ${c.paths}`,
    `Authority: ${c.authority}`,
    `Prohibited: ${c.prohibited}`,
    `Behavior: ${c.behavior}`,
    `Accept: ${c.accept}`,
    `Prove: ${c.prove}`,
    `Fixtures: ${c.fixtures}`,
    `Rollback: ${c.rollback}`,
    `Demo: ${c.demo}`,
  );
  if (c.constraints) lines.push(`Constraints: ${c.constraints}`);
  return lines.join('\n');
}

function depIds(c) {
  return (c.deps || '').split(/[,;]/).map(s => s.trim()).filter(d => /^DL-[A-Z0-9-]+$/.test(d));
}

const errors = [];
const seen = new Set();
const byId = new Map();
const cardsOut = [];
for (const c of CARDS) {
  if (seen.has(c.id)) errors.push(`duplicate id ${c.id}`);
  seen.add(c.id);
  byId.set(c.id, c);
  const title = `${c.id} - ${c.title}`;
  if (title.length > 200) errors.push(`${c.id}: title ${title.length} > 200`);
  const description = buildDescription(c);
  if (description.length > 2000) errors.push(`${c.id}: description ${description.length} > 2000`);
  if (description.length > 1900) console.warn(`WARN ${c.id}: description ${description.length} near limit`);
  const column = STATUS_COLUMN[c.status];
  if (!column) errors.push(`${c.id}: bad status ${c.status}`);
  const labels = [
    STATUS_LABEL[c.status],
    `type:${c.type}`,
    `privacy:${c.privacy}`,
    `risk:${c.risk}`,
    c.milestone === 'M1' ? 'M1-spine' : c.milestone === 'M2' ? 'M2-first-slice'
      : c.milestone === 'M3' ? 'M3-structure' : c.milestone === 'M4' ? 'M4-flow'
      : c.milestone === 'M5' ? 'M5-feedback-pack' : c.milestone === 'M6' ? 'M6-time-graph-wb'
      : c.milestone === 'M7' ? 'M7-interpretation' : 'M8-story-frontier',
    `epic:${c.epic}`,
  ];
  if (c.gate) labels.push(c.gate);
  if (c.demoRelevant) labels.push('demo:showcase');
  if (c.horizon === 'active') labels.push('horizon:active');
  if (c.horizon === 'frozen') labels.push('horizon:frozen');
  cardsOut.push({ title, description, columnName: column, labels });
}

// dependency references must name real card ids
for (const c of CARDS) for (const d of depIds(c)) if (!seen.has(d)) errors.push(`${c.id}: dep ${d} names no card`);

// active-horizon rules (reconciliation directive §8): bounded queue, dependency closure,
// every active card states the user question it enables, exactly one primary critical path.
const active = CARDS.filter(c => c.horizon === 'active');
if (active.length > 12) errors.push(`active horizon has ${active.length} cards (> 12)`);
for (const c of active) {
  if (!c.question) errors.push(`${c.id}: horizon:active card lacks a question`);
  for (const d of depIds(c)) {
    const dep = byId.get(d);
    if (dep && dep.horizon !== 'active' && dep.status !== 'DONE') {
      errors.push(`${c.id}: active card depends on ${d} which is neither active nor DONE (closure violation)`);
    }
  }
}
for (const c of CARDS) {
  if (c.horizon === 'frozen' && ['READY'].includes(c.status)) {
    errors.push(`${c.id}: frozen card must not be READY`);
  }
}

const labelNames = new Set(LABELS.map(([n]) => n.toLowerCase()));
for (const [n] of LABELS) if (n.length > 30) errors.push(`label ${n} > 30 chars`);
for (const c of cardsOut) for (const l of c.labels) if (!labelNames.has(l.toLowerCase())) errors.push(`undeclared label ${l}`);

if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }

const manifest = {
  schemaVersion: '1.0',
  packId: 'developer-lens-intelligence-platform',
  displayName: 'Developer Lens - Intelligence Platform',
  description: 'Planning board for the Developer Lens intelligence-platform programme (seeded 2026-08-04; reconciled after PR #62). Cards carry full task contracts in a keyed compact format; dependencies are encoded on the "Deps:" line of each card description because Taskdeck has no native dependency field. horizon:active marks the bounded execution queue; horizon:frozen marks work parked until the first analytical value slice (DL-VALUE-01) is accepted. Source of truth for stable design: docs/DEVELOPER_LENS_V2_ARCHITECTURE.md + docs/analyser-program/. Template declarations are deliberately absent: the current apply path validates but never persists or materialises templates (verified 2026-08-04), so this pack relies only on labels, columns, and seedCards.',
  compatibility: { minTaskdeckVersion: '0.1.0' },
  tags: ['developer-lens', 'planning', 'architecture'],
  labels: LABELS.map(([name, color]) => ({ name, color })),
  columns: COLUMNS,
  seedCards: cardsOut,
};

writeFileSync(OUT_JSON, JSON.stringify(manifest, null, 2) + '\n');

// regenerate the card index section of 07_DELIVERY_ROADMAP.md in place
let md = `${INDEX_MARKER}\n\n`;
md += `${CARDS.length} cards. Generated by \`taskdeck/tools/generate.mjs\` from \`taskdeck/tools/cards.mjs\` — edit the\nsource, never this table. Horizon: A = active queue, F = frozen until DL-VALUE-01 is accepted, blank = long-term programme.\n\n`;
md += '| ID | Title | Epic | Type | Status | Hz | Blocked by | Milestone | Risk/Effort |\n|---|---|---|---|---|---|---|---|---|\n';
for (const c of CARDS) {
  const hz = c.horizon === 'active' ? 'A' : c.horizon === 'frozen' ? 'F' : '';
  md += `| ${c.id} | ${c.title} | ${c.epic} | ${c.type} | ${c.status} | ${hz} | ${c.deps || '—'} | ${c.milestone} | ${c.risk}/${c.effort} |\n`;
}
const roadmap = readFileSync(ROADMAP, 'utf8');
const cut = roadmap.indexOf(INDEX_MARKER);
if (cut < 0) { console.error(`marker not found in ${ROADMAP}`); process.exit(1); }
// preserve any section added AFTER the generated index block (next '## ' heading past the marker)
const afterMarker = roadmap.slice(cut + INDEX_MARKER.length);
const tailAt = afterMarker.indexOf('\n## ');
const tail = tailAt >= 0 ? afterMarker.slice(tailAt + 1) : '';
writeFileSync(ROADMAP, roadmap.slice(0, cut) + md + (tail ? '\n' + tail : ''));

console.log(`OK: ${cardsOut.length} cards, ${LABELS.length} labels, ${COLUMNS.length} columns -> ${OUT_JSON}`);
console.log(`index: ${CARDS.length} rows -> ${ROADMAP}`);
console.log('active horizon:', active.map(c => c.id).join(', ') || '(none)');
console.log('max description length:', Math.max(...cardsOut.map(c => c.description.length)));
