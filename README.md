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
- Observed facts, derived patterns, and higher-order hypotheses kept visually and semantically distinct.
- Evidence trails, confidence labels, coverage limitations, and a local-only privacy boundary on every analytical layer.
- A share studio for social cards, platform-ready post copy, native share sheets, and self-contained HTML reports.
- Hover, focus, and touch inspectors for activity days, language weighting, repository bubbles, headline metrics, and chart context.
- An explorable Wrapped story with swipe navigation, a chapter map, per-chapter deeper reads, and chapter-specific sharing.

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
1200 × 630 card, captions, and standalone report are generated from synthetic aggregates only.

The local lens uses a stricter route. Opening Share Studio does not upload anything, and every
export action stays disabled until you review and acknowledge a redacted preview. The exporter is
allowlist-based: it can receive aggregate counts and a fixed narrative, but not identity fields,
repository names or URLs, pull-request titles, exact dates, coverage warnings, or raw events. The
generated PNG and self-contained HTML file stay on your device until you deliberately download,
copy, or send them through the operating system share sheet.

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

## Project map

- `scripts/collect.ts` — collection orchestration and private dataset writes.
- `scripts/exportDemo.ts` — deterministic public showcase generation.
- `scripts/verifyShowcase.ts` — structural privacy assertions and artifact scanning.
- `server/github.ts` — authenticated GitHub ingestion.
- `server/localGit.ts` — explicitly scoped local Git enrichment.
- `server/analytics.ts` — deterministic statistics, classifications, and higher-order rules.
- `server/index.ts` — localhost-only API and production host.
- `src/` — responsive dashboard and Wrapped experience.
- `shared/types.ts` — raw and presentation contracts.
- `.github/workflows/pages.yml` — tested, privacy-checked GitHub Pages deployment.
