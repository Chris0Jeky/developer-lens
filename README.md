# Developer Lens

Developer Lens turns an authenticated GitHub history into a private, local-first development retrospective. It combines an interactive dashboard with a nine-part Wrapped story, then moves from observable counts to deterministic patterns and explicitly labelled hypotheses.

It is designed for a question that ordinary contribution graphs cannot answer: **what kind of development system did this body of work become?**

## What it shows

- Six-month and twelve-month views of commits, pull requests, merges, reviews, issues, active days, streaks, languages, and repository concentration.
- A project constellation that includes private repositories available to the authenticated GitHub CLI.
- Development rhythm, burst periods, cross-repository waves, delivery loops, emerging projects, and quiet craft such as tests, docs, refactors, and fixes.
- A five-axis development DNA and a plain-language builder archetype.
- Observed facts, derived patterns, and higher-order hypotheses kept visually and semantically distinct.
- Evidence trails, confidence labels, coverage limitations, and a local-only privacy boundary on every analytical layer.

The deterministic engine in `server/analytics.ts` is the durable product: the initial narrative was shaped with an LLM-assisted analysis pass, then generalized into thresholds and cross-signal rules that can rerun without sending data to an LLM.

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
```

`check` runs Oxlint, the analytics/API/UI test suite, TypeScript project builds, and the production Vite build. The API tests also prove localhost-only binding behavior and that demo fallback remains explicit.

## Project map

- `scripts/collect.ts` — collection orchestration and private dataset writes.
- `server/github.ts` — authenticated GitHub ingestion.
- `server/localGit.ts` — explicitly scoped local Git enrichment.
- `server/analytics.ts` — deterministic statistics, classifications, and higher-order rules.
- `server/index.ts` — localhost-only API and production host.
- `src/` — responsive dashboard and Wrapped experience.
- `shared/types.ts` — raw and presentation contracts.
