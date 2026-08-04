# Developer Lens

Developer Lens turns an authenticated GitHub history into a private, local-first development retrospective. It combines an interactive dashboard with a nine-part Wrapped story, then moves from observable counts to deterministic patterns and explicitly labelled hypotheses.

It is designed for a question that ordinary contribution graphs cannot answer: **what kind of development system did this body of work become?**

**[Explore the live synthetic showcase](https://chris0jeky.github.io/developer-lens/)** · no account or private-repository data is present in the hosted artifact.

## What it shows

- Six-month and twelve-month views of commits, pull requests, merges, reviews, issues, active days, streaks, languages, and repository concentration.
- A selectable project constellation sized by attention, pull-request flow, or continuity, including private repositories available to the authenticated GitHub CLI.
- Development rhythm, burst periods, cross-repository waves, delivery loops, emerging projects, and quiet craft such as tests, docs, refactors, and fixes.
- A six-axis development DNA and a plain-language builder archetype.
- A deterministic Signal Lab for integration predictability, change-batch shape, coordination regularity, feedback surface, cadence concentration, and portfolio transitions.
- Observed facts, derived patterns, and higher-order hypotheses kept visually and semantically distinct; the hypothesis closes with a question about what evidence could change the interpretation, never a score or prescribed action.
- Evidence trails, confidence labels, coverage limitations, and a local-only privacy boundary on every analytical layer.
- A share studio for social cards, platform-ready post copy, native share sheets, and self-contained HTML reports.
- Hover, focus, and touch inspectors for activity days, language weighting, repository bubbles, headline metrics, and chart context.
- An explorable Wrapped story with swipe navigation, a chapter map, per-chapter deeper reads, and chapter-specific sharing.
- Authored line-change totals in Wrapped, with additions and deletions kept distinct from code-only or productivity claims.

The deterministic engine in `server/analytics.ts` is the durable product: the initial narrative was shaped with an LLM-assisted analysis pass, then generalized into thresholds and cross-signal rules that can rerun without sending data to an LLM.

## Public showcase versus private lens

The GitHub Pages site is built from eight invented repositories and deterministic synthetic events. Its deployment job regenerates that data, verifies every subject and repository uses a synthetic identity, rejects repository and pull-request URLs, and scans the built artifact for credential and local-path patterns before upload.

The hosted site cannot connect to a GitHub account. Private analysis is a separate local runtime:

| Surface | Data | Network boundary |
| --- | --- | --- |
| Public showcase | Deterministic synthetic events only | Static GitHub Pages files |
| Local lens | Your authenticated public and private GitHub activity, plus explicitly selected local Git roots | API bound to `127.0.0.1` |

This split keeps the full interface publicly explorable without making a personal dataset part of the repository, frontend bundle, or Pages artifact.

## Sharing and export

The public showcase can share its canonical URL immediately. Its social preview, downloadable
1200 × 630 card, captions, compact report, full dashboard, and complete nine-chapter Wrapped are
generated from synthetic aggregates only.

The local lens uses a stricter route. Opening Share Studio does not upload anything, and every
export action stays disabled until you review and acknowledge a redacted preview. The exporter is
allowlist-based and has two deliberately separate paths:

- Cards, captions, and compact reports receive six aggregate counts and fixed copy.
- Portable full experiences receive aggregate rhythm, repository, language, delivery, theme, DNA,
  coverage, and fixed narrative fields through a separate versioned schema. They never serialize
  the live dashboard, its DOM, its raw insight prose, or the private source dataset.

A portable export can contain the full seven-section dashboard or all nine Wrapped chapters in one
self-contained, offline HTML file. It uses relative week labels instead of dates, removes identity,
URLs, descriptions, topics, pull-request titles, source warnings, paths, and raw events, and creates
a fresh alias map before rendering. By default, public repository names remain visible while private
names become aliases such as `Project Aurora`; the stronger option aliases every repository name.
Changing the artifact or redaction choice requires reviewing the export boundary again.

The generated PNG and HTML files stay on your device until you deliberately download, copy, or send
them through the operating system share sheet. Where a browser cannot share HTML files directly,
Developer Lens downloads the complete file instead. Aliases reduce direct identification but are
not an anonymity guarantee: distinctive aggregate activity can still be recognisable.

Developer Lens does not provide a hosted URL for a private dashboard. The public link always opens
the separate synthetic showcase, so it cannot be mistaken for a published version of local data.

## Private by construction

Developer Lens uses your existing `gh` authentication but never reads or persists the token. The API binds to `127.0.0.1`, and collected data stays in the gitignored `.developer-lens/` directory.

The collector deliberately does not retain:

- repository file contents or diffs;
- issue or pull-request bodies;
- filenames;
- raw commit subjects;
- Git credentials or tokens.

Pull-request titles and repository names are retained in the local dataset because they power the activity stream and project views. Do not publish `.developer-lens/`, screenshots, or exported browser data without reviewing them first.

Local Git history is opt-in. Only roots supplied with `--local-root` or `DEV_LENS_LOCAL_ROOTS` are scanned, and only aggregated commit features are written. The scanner never searches the machine by default.

## Run it

Prerequisites: Node.js 20+, Git, and an authenticated [GitHub CLI](https://cli.github.com/) session with access to the private repositories you want included.

```powershell
npm install
gh auth status
npm run collect -- --local-root "C:\path\to\repos"
npm run dev
```

Open the Vite URL shown in the terminal. The API stays on `http://127.0.0.1:4141`; Vite proxies `/api` during development.

### Try the offline V2 demo

The repeatable synthetic journey needs no API server, GitHub authentication, account, repository, or local-history data:

```powershell
npm run dev:web
```

Open <http://127.0.0.1:5173/?demo=v2>. To run its focused smoke coverage without starting a server:

```powershell
npm run test:demo:v2
```

### Try the V2 coverage cockpit

Run `npm run seed:v2` to write the invented coverage fixtures into
`.developer-lens-synthetic/` (a gitignored directory kept separate from the private
`.developer-lens/` runtime data), then export the same value as `DEVELOPER_LENS_V2_TOKEN` and
`VITE_DEVELOPER_LENS_V2_TOKEN`, start `npm run dev`, and open
<http://127.0.0.1:5173/?view=cockpit-v2>; without both variables the cockpit reports that it holds
no bearer instead of rendering an empty panel.

For a prepared 3-5 minute walkthrough, use the
[`showcase demo runbook`](docs/SHOWCASE_DEMO.md). It gives the exact hosted and local routes, a short
talk track, the privacy boundary to state aloud, and the unfinished activation paths that must not
be presented as live.

By default, `collect` produces both the six-month and twelve-month lenses. To refresh only one range:

```powershell
npm run collect -- --range 6m --local-root "C:\path\to\repos"
```

Multiple roots can be supplied repeatedly or through the semicolon-separated environment variable documented in `.env.example`:

```powershell
npm run collect -- --local-root "C:\work" --local-root "D:\projects"
```

Local attribution uses `git config --global user.email` only—never an ambiguous author-name match. If you have used additional email identities, list them explicitly in `DEV_LENS_GIT_EMAILS` as shown in `.env.example`.

To run the built application locally:

```powershell
npm run build
npm start
```

When no private dataset exists, the UI intentionally falls back to a clearly labelled synthetic demo rather than failing or silently pretending that demo data is real.

To build exactly the privacy-checked artifact used by GitHub Pages:

```powershell
npm run build:showcase
```

The generated JSON stays ignored and is rebuilt during deployment.

## Analysis model

The pipeline has four layers:

GitHub line totals use authenticated contributor additions and deletions from weekly statistics for default-branch commits. Boundary weeks are included, and the metric covers changed lines across code, tests, docs, configuration, and generated files.

1. **Collection** — contribution connections, authenticated repository enumeration, per-repository commit history, GitHub search enrichment, and optional local Git refs.
2. **Normalization** — exact repository-and-SHA commit deduplication, activity calendars, weekly series, language shares, delivery timings, and effective-repository concentration.
3. **Inference** — deterministic rules combine independent signals into observed, derived, and hypothesis-level insights. Every rule emits evidence, confidence, and a limitation.
4. **Presentation** — the local API serves the dashboard and Wrapped narrative without embedding the private dataset in the frontend bundle.

GitHub has important visibility limits. Search endpoints cap some result sets at 1,000, contribution connections can group or omit restricted activity, review depth can exceed nested pagination, and deleted or force-pushed history may no longer be observable. Developer Lens lowers its source-coverage score and shows the exact warning when one of those edges is encountered.

This is a reflection on attention and integration patterns—not a productivity score, quality judgment, or measure of human value.

## Verification

```powershell
npm run check
npm run build:showcase
```

`check` runs Oxlint, the analytics/API/UI test suite, TypeScript project builds, and the production Vite build. `build:showcase` additionally exports both synthetic ranges, builds with the GitHub Pages base path, verifies the public-data identity boundary, and scans the artifact for secret and local-path patterns. The API tests also prove localhost-only binding behavior and that demo fallback remains explicit.

## Continuing development

Start with [`AGENTS.md`](AGENTS.md), then invoke the tracked
[`$developer-lens-continuation`](.agents/skills/developer-lens-continuation/SKILL.md) skill. Those
surfaces tell a fresh agent how to refresh live state and route information without reading every
historical document.

Owner decisions live only in [`HUMAN_TODO.md`](HUMAN_TODO.md). G1/G2 are approved and G3 has
standing approval within the named capability boundaries; runtime activation still needs a bounded,
tested task. G4 is approved only for the default-off OpenAI `gpt-5.6-luna` contract in the data
charter; `cap.external.model` remains `never_authorized`. The request builder and HTTP adapter are
published but uncalled, so external-model transmission stays absent until a separately reviewed
activation task binds the card, payload preview, credential, and one-call wrapper.

The durable document roles are deliberately separate:

- [`docs/data-charter.md`](docs/data-charter.md) — product/data boundary, classes, retention,
  migration, deletion, and sinks.
- [`docs/source-capability-matrix.md`](docs/source-capability-matrix.md) — source-specific purpose,
  consent, class, retention, deletion, and refusal behavior.
- [`docs/DEVELOPER_LENS_V2_ARCHITECTURE.md`](docs/DEVELOPER_LENS_V2_ARCHITECTURE.md) — stable design
  and phase dependencies.
- [`docs/IMPLEMENTATION_LEDGER.md`](docs/IMPLEMENTATION_LEDGER.md) — current evidence, residual
  risks, and exact resume point.
- [`docs/SHOWCASE_DEMO.md`](docs/SHOWCASE_DEMO.md) — the concise synthetic-demo talk track,
  verification commands, and honest claim boundary.
- [`docs/POST_DEMO_HARDENING.md`](docs/POST_DEMO_HARDENING.md) — deferred security, privacy,
  resilience, and distribution work.
- [`docs/analyser-program/`](docs/analyser-program/00_PRODUCT_BRIEF.md) — the 2026-08-04
  intelligence-platform planning programme (non-authoritative proposal space): product brief,
  ADRs, catalogs, delivery roadmap, Taskdeck starter pack, and the implementation launcher naming
  the next bounded slice. Accepted stable deltas live in the architecture document's Appendix I.
- [`docs/OVERNIGHT_EXECUTION_PROMPT.md`](docs/OVERNIGHT_EXECUTION_PROMPT.md) — a copy-ready Sol
  Ultra dynamic-swarm launcher that saturates useful Luna lanes and replenishes them without
  becoming a competing policy/state file.
- [`docs/SOL_ULTRA_DEEP_DISCOVERY_PROMPT.md`](docs/SOL_ULTRA_DEEP_DISCOVERY_PROMPT.md) — historical
  research input only; do not use it as live continuation authority.

Validate this context map, internal links, instruction budget, skill metadata, and gate-state parity
with:

```powershell
npm run verify:context
```

## Code map

- `scripts/collect.ts` — collection orchestration and private dataset writes.
- `scripts/exportDemo.ts` — deterministic public showcase generation.
- `scripts/verifyShowcase.ts` — structural privacy assertions and artifact scanning.
- `server/github.ts` — authenticated GitHub ingestion.
- `server/localGit.ts` — explicitly scoped local Git enrichment.
- `server/storage/` — V2 SQLite contracts and synthetic importer proof.
- `server/analysisPack/` — deterministic C1 Parquet pack/replay foundation.
- `server/analytics.ts` — deterministic statistics, classifications, and higher-order rules.
- `server/index.ts` — localhost-only API and production host.
- `src/` — responsive dashboard, Wrapped experience, and offline V2 demo.
- `shared/` — raw/presentation plus privacy, capability, coverage, and provenance contracts.
- `.github/workflows/pages.yml` — full gate, privacy-checked showcase build, and Pages deployment.
