# Developer Lens

**A private, local-first development retrospective for understanding how a body of work evolved.**

Developer Lens combines authenticated GitHub history with explicitly selected local Git roots, then turns observable activity into deterministic patterns, evidence walks, and clearly labelled hypotheses. It asks a question ordinary contribution graphs cannot answer:

> **What kind of development system did this body of work become?**

[Explore the live synthetic showcase](https://chris0jeky.github.io/developer-lens/) ·
[Product direction](docs/PRODUCT_DIRECTION.md) ·
[Roadmap](ROADMAP.md) ·
[Data charter](docs/data-charter.md) ·
[Showcase walkthrough](docs/SHOWCASE_DEMO.md)

The public site contains invented synthetic projects and events only. It cannot connect to a GitHub account and does not contain a private dashboard, local export, credential, or repository history.

## Product thesis

Developer Lens is not a productivity score, performance monitor, employee-ranking system, or hosted analytics service. It is an evidence-governed retrospective for a developer or team that wants to inspect attention, integration, rhythm, delivery, coverage, and change patterns without pretending those signals measure human worth.

The product keeps four layers separate:

1. **Observed evidence** — what an authenticated source or explicitly selected local repository actually exposed.
2. **Derived patterns** — deterministic calculations over those observations.
3. **Hypotheses** — higher-order interpretations with confidence, limitations, counter-evidence, and a question that could change the interpretation.
4. **Operator decisions** — explicit human choices about sources, capabilities, publication, models, and what to do next.

Missing, censored, stale, restricted, refused, or failed evidence is never silently converted to zero.

## What it shows

- six- and twelve-month activity views across commits, pull requests, merges, reviews, issues, active days, streaks, languages, and repository concentration;
- a selectable project constellation sized by attention, pull-request flow, or continuity;
- development rhythm, burst periods, cross-repository waves, delivery loops, emerging projects, and quiet craft such as tests, docs, refactors, and fixes;
- six-axis development DNA and a plain-language builder archetype;
- deterministic Signal Lab views for integration predictability, change-batch shape, coordination regularity, feedback surface, cadence concentration, and portfolio transitions;
- evidence drawers, confidence, source coverage, limitations, missingness, and counter-hypotheses;
- an interactive dashboard and nine-part Wrapped narrative with deeper reads and chapter-specific sharing;
- a V2 coverage cockpit, Integration Shape Atlas, and frozen Method Trial worked example;
- a Share Studio and headless exporter for cards, captions, compact reports, and self-contained portable experiences.

The durable analytical engine is deterministic. The original narrative was informed by an LLM-assisted analysis pass, then generalized into rerunnable thresholds and cross-signal rules. Optional future model assistance remains subordinate to the evidence model and deterministic fallback.

## Public showcase versus private lens

| Surface | Data | Boundary |
| --- | --- | --- |
| Public showcase | Invented C0 synthetic repositories and events | Static GitHub Pages artifact |
| Local lens | Authenticated public/private GitHub activity plus explicitly selected local Git roots | API bound to `127.0.0.1` |
| Portable export | Pre-redacted aggregate view selected and acknowledged by the operator | Self-contained local file |
| CommitAtlas projection | Small product-owned schema, explicitly reviewed for publication | Owner-gated tracked public artifact, never ambient sync |
| Developer Lens Lab | Separate research environment and method qualification | No automatic promotion into the product |

The showcase build regenerates its synthetic data, verifies synthetic identities, rejects repository/PR URLs, and scans the built artifact for credentials and local paths before deployment.

The authenticated collector remains local. There is no hosted service holding private history. Hosting-compatibility metadata and usage measurement apply only to the synthetic showcase.

### Usage measurement on the public showcase

The public showcase at chris0jeky.github.io/developer-lens loads the Pulseboard SDK (a first-party beta usage measurement shared by the owner's public sites). Local and private builds, your own datasets, share artifacts and portable exports never load it, and the build checks prove that ([observatory/README.md](observatory/README.md)).

- A one-line **Beta** bar at the top of the page names what is collected, with **Choose** and **OK**. Once you choose, it collapses to a small Beta button that reopens the switches.
- Three categories: **Usage counts** (daily aggregate counts of pages and events, with coarse context such as device class, referral category and country), **Diagnostics** (page-speed timings, JavaScript error summaries, visible time and scroll depth) and **Journeys and product data** (a random id for one browser tab and the ordered showcase events: which view opened, which share control was used, never what was shared).
- Outside the EEA all three are on by default, and you can turn any of them off. In the EEA, or when the region is unknown, only usage counts are on until you click OK, and nothing is stored on your device before then.
- Global Privacy Control or Do Not Track turns everything off, silently.
- No names, e-mail addresses, IP addresses, page URLs or content from any dataset are sent. The showcase data is synthetic.
- Detailed data (diagnostics and journeys) is kept for 90 days; aggregate counts are currently kept for 14 days.

## Current product surfaces

### Retrospective dashboard and Wrapped

The primary interface moves from high-level activity to project structure, integration behavior, development rhythm, themes, DNA, archetype, and evidence-backed narrative. Every analytical statement can carry its source trail and limitations.

### V2 evidence cockpit

The V2 path makes coverage and privacy first-class. It uses a local API with exact Host/Origin/fetch-metadata boundaries and a separate synthetic store. It does not turn localhost into a security boundary against other trusted local processes; it closes the browser drive-by surface it declares.

### Integration Shape Atlas

A deterministic comparative finding shows one matched-window integration question end to end: distribution, tail behavior, counts, limitations, and clickable evidence walks. The hosted version uses invented C1 composition only.

### Method Trial

The frozen synthetic Method Trial records a candidate method that matched the baseline’s detection rate but produced more false alerts, so the candidate was rejected and the deterministic baseline retained. It demonstrates how the product should present a negative research result without converting “benchmarked” into “shipped.”

### Share Studio and headless export

Cards, captions, reports, portable dashboards, and portable Wrapped files are generated from allowlisted aggregate schemas, not by serializing the live DOM or raw dataset.

Local export requires an explicit redaction acknowledgement. The stronger CLI default aliases every repository name. Files are built in memory, scanned before writing, scanned again after writing, and removed if a privacy guard fails. Aliases reduce identification risk but are not an anonymity guarantee.

## Private by construction

Developer Lens uses the existing `gh` authentication session but never reads or persists the token. Local data stays under the gitignored `.developer-lens/` directory.

The collector does not retain:

- repository file contents or diffs;
- issue or pull-request bodies;
- filenames;
- raw commit subjects;
- Git credentials or tokens.

Repository names and pull-request titles may remain in the private local dataset because they power project and activity views. Do not publish `.developer-lens/`, raw screenshots, or browser exports without reviewing them.

Local Git history is opt-in. Only roots supplied through `--local-root` or `DEV_LENS_LOCAL_ROOTS` are scanned, and only aggregate commit features are written. Developer Lens never searches the machine for repositories by default. Local attribution uses configured email identities, not ambiguous author-name matching.

The source/capability system is designed around explicit purpose, data class, consent, retention, deletion, sink, budget, and refusal behavior. “Available in code” does not mean active.

## Run the private local lens

Requirements: Node.js 20+, Git, and an authenticated GitHub CLI session with access to the repositories you want included.

```powershell
npm install
gh auth status
npm run collect -- --local-root "C:\path\to\repos"
npm run dev
```

Open `http://127.0.0.1:5173`.

- The web port is pinned; if 5173 is busy, Vite fails rather than silently moving outside the V2 Host allowlist.
- The API defaults to `http://127.0.0.1:4141`; `DEVELOPER_LENS_PORT` can move it and the development proxy follows.
- With no private dataset, the UI falls back to a clearly labelled synthetic demo rather than presenting synthetic evidence as real.

By default, collection produces six- and twelve-month lenses. Pass `--range 6m` to narrow a run. Multiple local roots may be repeated or set through `DEV_LENS_LOCAL_ROOTS` as documented in `.env.example`.

## Explore without private data

Run the offline V2 demo:

```powershell
npm run dev:web
```

Open `http://127.0.0.1:5173/?demo=v2`.

Other deterministic routes:

- `/?view=cockpit-v2` — V2 coverage and privacy cockpit after `npm run seed:v2`;
- `/?view=integration-shape` — invented comparative integration finding;
- `/?view=method-trial` — frozen candidate-versus-baseline decision story.

The Integration Shape and Method Trial routes also work in the hosted synthetic showcase. They require no API, account, local data, Lab process, or generated private artifact.

## Export deliberately

```powershell
npm run export:artifacts
```

With no flags, the command writes a complete synthetic showcase set into the gitignored `artifacts/` directory: overview/chapter cards, caption tones, report, portable dashboard, portable Wrapped, dashboard JSON, and a manifest for both ranges.

A local export refuses unless the operator supplies `--source local --acknowledge-redaction`. It defaults to aliasing every repository name and never writes the raw local dashboard record. Re-running an export removes only files named by its previous manifest and refuses to clear an unrelated populated directory.

The public URL always opens the separate synthetic showcase. Developer Lens does not create a hosted URL for a private dashboard.

### Profile projection

```powershell
npm run export:profile
npm run export:profile -- --source local --acknowledge-redaction --range 12m
```

`export:profile` writes one `PublicLensProjection.v1` file (`lens-profile.v1.json`) plus a manifest into the gitignored `profile-export/` directory, through the same scans and manifest-scoped replacement as `export:artifacts`. The default `--source showcase` is C0 synthetic data. `--source local` produces the owner's C1 `redacted-local` projection: it refuses without `--acknowledge-redaction`, defaults to `--repository-redaction private-aliases` (`all-aliases` is available), and is never published to Pages or committed as a fixture. The schema, C0 fixture, coverage-score scale and warning-code registry are in [`research-contracts/lens-projection/v1/`](research-contracts/lens-projection/v1/README.md).

## Analysis pipeline

1. **Collection** — authenticated repository enumeration, contribution connections, commit history, GitHub search enrichment, and optional local Git refs.
2. **Normalization** — repository/SHA deduplication, calendars, weekly series, language shares, delivery timings, line-change totals, and effective-repository concentration.
3. **Inference** — deterministic cross-signal rules emitting evidence, confidence, limitation, and counter-hypothesis.
4. **Presentation** — local API, dashboard, Wrapped, evidence drawers, and reviewed exports without embedding private data in the frontend bundle.

GitHub imposes real visibility limits: search caps, grouped or omitted restricted activity, nested pagination, deleted/force-pushed history, and default-branch-only statistics. Developer Lens lowers coverage and displays the exact warning when a source edge is encountered.

Line totals are additions and deletions observed through authenticated weekly contributor statistics. They include code, tests, docs, configuration, and generated files; they are not code-only output or productivity.

## Direction

### Now: release the truthful baseline

The first tagged baseline is built from the existing synthetic showcase, V2 cockpit, frozen Method Trial, local retrospective, export boundary, licensing, and release evidence. The repository currently has no public GitHub release; owner-controlled tag/publication gates remain authoritative.

### Next: one integrated evidence vertical

The first deeper vertical asks how long integration work takes to land and what the tail looks like. It combines survival analysis, censoring, competing outcomes, matched eras, uncertainty, evidence walks, and counter-hypotheses. A synthetic route can be public; local analysis stays local.

### Then: explicit capability profiles

Actions, Deployments, and Source Structure can form a core opt-in profile for selected repositories. Dependencies, security aggregates, discussions, text-rich inspection, model assistance, team mode, and external sinks remain separate capabilities with their own consent, budget, retention, deletion, and refusal rules.

### Later: recommendations and packaging

Deterministic local recommendations come first and trigger only when the analysis materially changes. Optional model-generated hypotheses remain labelled, bounded by cost/authority, and backed by deterministic operation. Packaging may later include Lab distribution, a thin `gh` launcher, CLI, and desktop shell; none is claimed today.

Read [PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md), [ROADMAP.md](ROADMAP.md), and [PROGRAMME_ROADMAP.md](docs/PROGRAMME_ROADMAP.md).

## Cross-project contracts

- Developer Lens owns analysis semantics and redaction.
- Developer Lens Lab owns method research and qualification; it cannot emit “ship” as a research decision.
- CommitAtlas consumes only pinned, product-owned, public-compatible projections and never fetches the private lens.
- Pulseboard measures usage of the synthetic public showcase only, through the locked SDK artifact the showcase build emits; it never receives private/local analysis, datasets or exports.
- Taskdeck integration remains a reviewed proposal/activation path rather than ambient task creation.

The `DeveloperLensMethodTrialSummary.v1`, `ResearchFindingProjection.v1` and `PublicLensProjection.v1` contracts demonstrate this producer-first model: the product defines semantic acceptance; producers satisfy it; consumers validate the pinned artifact.

## Verification

```powershell
npm run check
npm run build:showcase
```

`check` runs Oxlint, analytics/API/UI tests, TypeScript builds, and the production build. `build:showcase` exports synthetic ranges, builds for GitHub Pages, verifies the public identity boundary, and scans for secrets and local paths. External tags are rejected for the separately generated portable report; the repository does not yet claim a dist-wide external-resource scan for the complete showcase artifact.

For continued development, start with [CLAUDE.md](CLAUDE.md); [AGENTS.md](AGENTS.md) is the Codex adapter. The analyser programme’s `CURRENT_STATE.md` is the live resume artifact. `HUMAN_TODO.md` is the only source for owner decisions.

## Documentation map

- [Product direction](docs/PRODUCT_DIRECTION.md)
- [Roadmap](ROADMAP.md)
- [Programme roadmap](docs/PROGRAMME_ROADMAP.md)
- [Owner constitution](docs/OWNER_CONSTITUTION.md)
- [Data charter](docs/data-charter.md)
- [Source/capability matrix](docs/source-capability-matrix.md)
- [V2 architecture](docs/DEVELOPER_LENS_V2_ARCHITECTURE.md)
- [Current analyser state](docs/analyser-program/CURRENT_STATE.md)
- [Implementation ledger](docs/IMPLEMENTATION_LEDGER.md)
- [Showcase demo](docs/SHOWCASE_DEMO.md)

## License

Copyright (C) 2026 Cristian Tcaci. Developer Lens is licensed under [GNU AGPL v3.0 only](LICENSE) (`AGPL-3.0-only`).

For commercial conversations, see [COMMERCIAL_OPTION.md](COMMERCIAL_OPTION.md). It states intent only and does not establish commercial terms.
