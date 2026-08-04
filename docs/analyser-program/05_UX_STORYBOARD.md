# System Atlas UX Storyboard — Developer Lens Intelligence Platform

Status: **Draft (planning artifact)** · 2026-08-04 · Elaborates **ADR-23** and the UX obligations of
ADR-01/02/03/04/07/09/11/12/14/16/17/21/22/24. Non-authoritative proposal space: canonical contracts
live in `../DEVELOPER_LENS_V2_ARCHITECTURE.md`, `../data-charter.md`, `../source-capability-matrix.md`.
Where this file disagrees with those, they win.

Labels: **V** verified repository fact · **D** documented platform fact · **R** recommendation ·
**I** inference · **A** assumption (with reversal path) · **REJ** rejected · **G** owner gate.

No React, CSS, component code, or route wiring is produced here. Everything below is a view model, a
layout contract, and an acceptance description for a later UX card.

---

## 1. Binding constraints this storyboard inherits

| # | Constraint | Source | UX consequence |
|---|---|---|---|
| C-1 | Subject is the software system, never a person | Brief §3.1, charter | No person avatars; no reviewer/author dimension in any control, filter, legend, axis, or tooltip. The schema has no such dimension (ADR-12), so the UI cannot offer one. |
| C-2 | `observed → deterministic → modelled → hypothesis/abstention` is one-way | Brief §3.3, canonical §6, ADR-01 | Layer is a rendered property of every claim, not a user preference. A modelled figure can never inherit fact styling. |
| C-3 | Absence is never zero | Brief §3.4, ADR-02 | No chart draws a zero point for an uncovered window. Gaps render as coverage furniture (§3.4). |
| C-4 | No persuasive single confidence scalar | Brief §3.7, canonical §7 | The V1 scalar (**V**: `shared/v2Demo.ts` `insightConfidences: high\|medium\|low`) renders only in legacy views. V2 renders the coverage vector plus the limiting dimension — and no total. |
| C-5 | Every insight resolves every cited evidence ID | Brief §5, ADR-01 | Rule **VG-R1** (§3.5): a number that cannot resolve to a `claim_id` may not render as an analytic number. |
| C-6 | Deterministic analysis is the complete product | Brief §3.2 | With every modelled/hypothesis layer disabled, no primary panel is empty. Each wireframe marks its deterministic floor. |
| C-7 | Time-grain floor is ISO week for cadence surfaces | ADR-14 | No calendar heat-grid, no hour-of-day, no day-of-week axis. Day grain only inside CI queue/exec distributions where the subject is provider infrastructure. |
| C-8 | Copy dictionary bans normative framing | ADR-09/13/14/15/16 | Banned strings: "top", "best", "healthiest", "most mature", "actively owned", "responsible team", "stewardship", "fast"/"busy" as goods, "flaky" from rerun, "secure" from alert counts. |
| C-9 | Public showcase is invented C0 on a structurally separate path | Brief §3.9, canonical §11 | Every surface has a C0 twin fed only by synthetic constructors; the invented-data banner (**V**: `src/components/V2Demo.tsx`) is permanent and non-dismissible. |
| C-10 | G4 = OpenAI `gpt-5.6-luna`, C1-only; `cap.external.model` is `never_authorized` | charter §G4, matrix | No surface here requires a model call. Every modelled/hypothesis element has a deterministic-composer origin (ADR-21) and renders identically whether or not an external step ever runs. |

**REJ (UX-level).** Score dials, grade letters, leaderboards, streak ribbons, DNA radars, archetype
badges, "productivity" sparklines, celebratory superlatives, and any control whose axis is a person —
exactly the V1 surfaces ADR-04 §6 retires first.

---

## 2. Information architecture — the ten surfaces

Nav model: a persistent **surface rail** (left on desktop, bottom sheet on mobile) with ten items,
plus two overlay destinations — the **Evidence Drawer** (ADR-01/`UX-ED`) and the **Open Questions
Observatory** (ADR-24/`OPEN-02`), the latter rendered as an Atlas-home rail and its own route.
**R:** keep Open Questions off the rail so the rail stays at ten.

| # | Surface | Card | Purpose | Primary questions | Entry | Exit |
|---|---|---|---|---|---|---|
| S1 | **Evidence Atlas** (home) | `UX-EA` *(proposed)* | Orient: what system, what window, what is known, missing, open | "What kind of system is this, and how much of it can I see?" | Launch; logo; `Esc Esc` | Any rail surface; Open Questions; claim → Drawer |
| S2 | **Architecture Time Machine** | `UX-TM` | Structure across comparable snapshots | "How is this built, and how did its shape change?" | Rail; Atlas structure tile; Comparator "inspect era" | Comparator; Change River (a wave); Drawer |
| S3 | **Change River** | `UX-CR` | Change families over ISO weeks | "What kinds of change recur, and what moved together?" | Rail; Atlas change tile; Pattern Lens "show in context" | Time Machine; Delivery Map (a batch); Drawer |
| S4 | **Delivery / Traceability Map** | `UX-DM` | issue → PR → commit → release → deployment | "How does intent become integrated, released change?" | Rail; Atlas flow tile; River batch | Time Machine; Drawer; Open Questions |
| S5 | **Pattern Lens** | `UX-PL` | Change-points, motifs, residual alerts | "Which shifts are real, and which are coverage moving?" | Rail; any timeline's "explain this shift" | Change River; Comparator; Drawer |
| S6 | **Era Comparator** | `UX-EC` | Two pinned eras, one honest diff | "What materially changed between these periods?" | Rail; Time Machine seam; accepted change-point | Time Machine; System Story; Drawer |
| S7 | **Evidence Drawer** | `UX-ED` | Universal claim inspector; "why am I seeing this" | "What supports this, what contradicts it, what would change it?" | Any number, badge, or mark | Returns focus to the invoking element; may pin |
| S8 | **Coverage / Privacy Cockpit** | `UX-CC` + `UX-PC` | Lifecycle, coverage vector, retention clocks, deletion preview | "What did I consent to, what is retained, what would be deleted?" | Rail; every furniture element's "see coverage" | Back to the invoking surface, capability pre-selected |
| S9 | **Query Lab** | `UX-QL` | DuckDB-WASM over a user-selected completed pack | "Can I check this myself, without trusting the app?" | Rail; Drawer "query this claim's tables"; pack build | Copy result; back to rail |
| S10 | **System Story** | `UX-SS` | Guided ten-beat narration of one era of one system | "Tell me what this became — honestly." | Rail; Atlas "narrate this era"; Comparator | Ends on a question → Open Questions; never a score |

### 2.1 Empty and degraded-coverage states

Never an empty region; never a zero.

| Surface | Empty | Degraded | Blocked (capability inactive) |
|---|---|---|---|
| S1 | "No analysis has run in this window" + one action: open Cockpit; coverage strip all `never_authorized` | Tiles that can render do; the rest render `cov.absent-panel` naming capability + limiting dimension | Tile keeps its grid slot and shows the lifecycle state and the exact scope its card would ask for |
| S2 | "No comparable snapshot pair exists" + what a snapshot needs (ref OID, `parser_bundle_version`, config revision) | Incomparable pairs render as separate eras across a seam, never as a delta (ADR-07); `parser_coverage` shown per language | `cap.source.structure` state card; composition panel may still render from `GH-LANG-01` |
| S3 | "No eligible weeks" + the gates (≥20 subjects, ≥80% parser completion) | Sub-gate weeks render `cov.gap-band`; `unknown` category always drawn | Intent band absent; release-batch band still renders from `github.core` |
| S4 | "No observed closing edges in window" | Suggested edges render modelled and are excluded from `DL.FLOW.ISSUE_PR_RELEASE_RATIO.v1`; open/abandoned tails get a censor bracket + count | Deployment lane collapses to a lifecycle card; `GH_DEPLOY_STATUS_90D_CENSOR` shown even when active |
| S5 | "No series has ≥52 eligible weekly observations" | Candidates coincident with a coverage shift render `coverage_shift_candidate`, demoted but visible | Deterministic transition/frequency counts still render (ADR-17 rung 1) |
| S6 | "Pin two eras to compare" | Incomparable pins → diff refuses and names the failed dimension; eras shown side by side without arithmetic | Absent repositories are listed as absent, not omitted from the portfolio strip |
| S7 | n/a | An unresolvable evidence ID renders a data-quality finding, and the invoking number is demoted to chrome | Revoked source shows the content-free tombstone and its `lineage_event` |
| S8 | Ten-row lifecycle table, all `never_authorized` — the correct first-run screen | Retention clocks show age vs horizon; over-horizon rows show pending expiry, not an error | n/a — this is the surface that renders blocked states |
| S9 | "No completed pack selected" + how to build one | Stale pack shows a ribbon with `pack_schema_version` and build time | Failed checksum or missing `COMPLETE` **refuses to open** (ADR-22); no partial rows |
| S10 | "Not enough evidence to narrate an era" + the Open Questions that would unlock one | Gated beats become abstention beats of equal weight (§5); the story never shortens silently | B8/B9 drop to abstention; B1–B7 and B10 still run |

---

## 3. The seven-way visual grammar (`UX-VG`)

Seven token families cover every mark the Atlas draws. **A-UX-2:** `abstention` is *not* an eighth
token — it is a claim `layer` (ADR-01) rendered as a claim-sized card using the limitation plus
question tokens. Reversal: add `vg.meta.abstention` if testing shows abstention reads as an error.

### 3.1 Token table (proposed IDs)

| Token ID | Meaning | Badge shape | Glyph | Label | Border / connector | Area fill | SR prefix |
|---|---|---|---|---|---|---|---|
| `vg.layer.fact` | Observed: an allowed source field seen at a snapshot | square, sharp corners | `■` | `OBS` | 2px solid | solid | "Observed fact." |
| `vg.layer.derivation` | Deterministic: versioned pure calculation | rounded square | `▤` | `DET` | 2px double rule | horizontal hatch | "Deterministic derivation." |
| `vg.layer.model` | Modelled: estimate with dataset, seed, evaluation, uncertainty | hexagon | `⬡` | `MOD` | 2px dashed (6-3) | diagonal hatch | "Modelled estimate." |
| `vg.layer.hypothesis` | Hypothesis: non-authoritative interpretation | diamond | `◇` | `HYP` | 2px dotted (2-3) | stipple | "Hypothesis, not a fact." |
| `vg.rel.contradiction` | An edge with `role = contradicts` | circle with slash | `✕` | `CTR` | solid with mid-span cross-ticks | outline only | "Contradicting evidence." |
| `vg.meta.limitation` | A `limitation_instance` bound to a claim | pennant / clipped rect | `▨` | `LIM` | 1px solid + 4px left rule | cross-hatch | "Limitation." |
| `vg.meta.question` | A `question` claim (ADR-24) | open-ended tag | `?` | `OPN` | 1px solid, open right edge | none | "Open question." |

### 3.2 Color-independent encoding (mandatory, not a fallback)

Four redundant channels ship together, so a grayscale screenshot is a valid `UX-VG` acceptance artifact:

1. **Shape** — the seven silhouettes are distinct at 16 px and in a 1-bit render.
2. **Glyph** — one character inside the badge at every size; never the only channel.
3. **Text label** — the three-letter code always renders; on dense marks it moves to the leader line,
   it does not disappear, and it is never replaced by a color chip.
4. **Position** — the layer badge holds a fixed leftmost slot in every claim header and a fixed
   legend order (`OBS · DET · MOD · HYP`), so ordinal position encodes the ladder. Relation/meta
   tokens (`CTR`, `LIM`, `OPN`) hold a separate right-aligned slot and never mix in.

Line work repeats the distinction: solid = fact, double = derivation, dashed = modelled, dotted =
hypothesis, solid-with-cross-ticks = contradiction, hatched band = limitation-affected region,
open-ended arrow terminating in `?` = question. All seven pass WCAG 2.2 non-text contrast (3:1)
against both backgrounds; correctness never depends on hue.

### 3.3 Composition rules

- **No promotion.** Card styling derives from the claim's `layer` column by a total function over the
  enum; there is no path that renders a `modelled` claim with `vg.layer.fact`.
- **Contradiction is never hidden.** A claim with ≥1 `contradicts` edge shows `CTR` even in the most
  compact card variant. Compaction may reduce `LIM` to a count, never `CTR`.
- **Limitations are counted, never summed away.** `LIM ×3` expands in the Drawer to three
  `limitation_code` rows, each with its triggering dimension and claim-family copy.
- **A hypothesis card without a question does not render.** ADR-21 makes the falsifier mandatory; a
  missing question is a data-quality finding and the finding renders instead.

### 3.4 Coverage furniture (proposed IDs) → `CoverageStatus` / dimension

| Furniture | Renders as | For |
|---|---|---|
| `cov.absent-panel` | Panel-sized card: `LIM` token, capability, lifecycle state, one action | `never_authorized`, `refused`, `unavailable` / `permission` |
| `cov.gap-band` | Hatched band over the uncovered interval; the series is **interrupted, not zeroed** | `truncated`, `failed` / `completeness` |
| `cov.censor-bracket` | `⟩` at the censored end + eligible/censored counts | `censored` / `censoring` |
| `cov.suppressed-cell` | Cross-hatched cell naming the gate (sample, size-band, sparse pair) | display gate / `sample` |
| `cov.incomparable-seam` | Double vertical seam; no delta arithmetic crosses it | ADR-07 / `comparability` |
| `cov.stale-ribbon` | Ribbon with `DL.COV.FRESHNESS_AGE_H.v1` and its SLO | `stale` / `freshness` |
| `cov.conflict-chip` | `CTR`-marked chip with `DL.DQ.CONFLICT_RATIO.v1` and the source pair | conflicts / `conflict` |
| `cov.parser-share` | Stacked share of parsed vs abstained languages | ADR-06 / `parser_coverage` |
| `cov.tombstone-slot` | Content-free tombstone + the causing `lineage_event` | `deleted` |
| `cov.abstention-card` | Claim-sized card: what was attempted, which floor failed, what would lift it | monotone abstention (ADR-02) |

Every furniture element deep-links to S8 with the capability and dimension pre-selected.

### 3.5 VG-R1 — every number resolves to a claim

> A figure is **analytic** if it asserts something about the system. Every analytic figure carries a
> `claim_id`, is focusable, is announced with "opens evidence", and opens the Evidence Drawer on
> activation. A figure that cannot resolve a `claim_id` **must not render as an analytic figure**: it
> renders as chrome (different type ramp, no underline, not focusable) or not at all.

Chrome numbers are a closed list: UI collection counts, pagination positions, pinned-claim counts,
story beat index. Every ratio, duration, quantile, count of system objects, share, distance, lift,
and delta is analytic. Acceptance: a crawler over the C0 twin asserts every numeric text node is
either inside a chrome-classed element from that list or carries a resolvable `claim_id` — the
UI-side counterpart of the Brief §5 evidence-integrity metric.

---

## 4. Annotated wireframes

Desktop assumes ≥1280 px; mobile 360–430 px. Callouts explain component placement and **what data
binds where**.

### 4.1 S1 — Evidence Atlas (home) · `UX-EA` *(proposed)*

```text
DESKTOP ─────────────────────────────────────────────────────────────────────────
┌────┬──────────────────────────────────────────────────────────────┬───────────┐
│ ①  │ ② System <alias>  Window [2026-W05 … 2026-W31] ▾   ③ [Pins 2]│ ⑨ OPEN    │
│rail├──────────────────────────────────────────────────────────────┤ QUESTIONS │
│ EA │ ④ COVERAGE STRIP                                             │ ⑩ ? OPN   │
│ TM │  perm ▓▓▓▓░ compl ▓▓▓░░ fresh ▓▓▓▓▓ cens ▓▓░░░ conf ▓▓▓▓▓    │  evidence │
│ CR │  samp ▓▓▓░░ divers ▓░░░░ parser n/a  compar ▓▓▓▓░ drift n/a   │  _gap ×4  │
│ DM │  calib n/a      [limiting: parser_coverage → see coverage]    │  contra-  │
│ PL ├───────────────┬───────────────┬───────────────┬──────────────┤  diction  │
│ EC │ ⑤ STRUCTURE   │ ⑤ CHANGE      │ ⑤ FLOW        │ ⑤ FEEDBACK   │  ×1       │
│ CC │ OBS ■ 42 mods │ DET ▤ mix     │ DET ▤ 0.60    │ DET ▤ mix    │  untested │
│ QL │ LIM ▨ ×2      │  ▁▃▅▂▁ ⧅gap   │ ⟩ 4 censored  │ CTR ✕ 1      │  _alt ×2  │
│ SS │ parser 38%    │ W12–W14       │ LIM ▨ ×1      │ stale 31h    │ ⑪[surprise│
│    ├───────────────┴───────────────┴───────────────┴──────────────┤   me →]   │
│    │ ⑥ SINCE LAST RUN · 3 claims superseded · 1 correction        │           │
│    │ ⑦ [cov.absent-panel] cap.github.deployments · never_authorized│           │
│    │ ⑧ [ Narrate this era → S10 ]        [ Compare eras → S6 ]     │           │
└────┴──────────────────────────────────────────────────────────────┴───────────┘
```

① Rail, ten items, fixed order, non-color current indicator (left bar + bold weight). ② Scope header
binds repository **alias** only (the identity vault never reaches the UI); the half-open window
`[start, end)` is echoed verbatim into every claim opened here. ③ Pin tray (§6.3), max 4, persistent.
④ Binds `GET /api/v2/coverage` → the eleven ADR-02 dimensions; each `number | null`, with `null`
rendering `n/a` plus its `limiting_reason` — never an empty bar, never 0. The strip names the single
limiting dimension and deliberately shows **no aggregate** (C-4).
⑤ Four tiles from `GET /api/v2/features`, each rendering its own deterministic floor — Structure:
`DL.ARCH.CYCLE.v1` + composition; Change: `DL.CHANGE.INTENT_MIX.v1`, `DL.REL.CHANGE_BATCH.v1`; Flow:
`DL.FLOW.ISSUE_PR_RELEASE_RATIO.v1`, `DL.PR.INTEGRATION_DURATION_H.v1`; Feedback:
`DL.CI.OUTCOME_MIX.v1`, `DL.CI.RECOVERY_TRANSITION_RATIO.v1`. Every figure is analytic (VG-R1).
⑥ Correction lane: claims with non-null `superseded_by` since the last run plus `lineage_event` kind —
ADR-11's "history is never rewritten", made visible. ⑦ A capability that would fill a tile renders
`cov.absent-panel` **inside the tile grid**, keeping the grid the same size: the missing thing occupies
space. ⑧ The only two calls to action; neither recommends anything about the system. ⑨–⑩ Open Questions
rail (ADR-24) grouped by `kind`; counts are chrome, rows analytic. ⑪ "Surprise me" runs the
coverage-weighted walk with its deterministic seed displayed.

```text
MOBILE ───────────────────────────
┌─────────────────────────────────┐
│ ② <alias> · 2026-W05…W31    ▾   │
│ ④ COVERAGE  limiting: parser    │
│   [4 of 11 dimensions measured] │
│   ⓐ tap → full vector sheet     │
├─────────────────────────────────┤
│ ⑤ STRUCTURE  OBS ■ 42 · LIM ▨×2 │
│ ⑤ CHANGE     DET ▤ ▁▃▅▂▁ ⧅W12-14│
│ ⑤ FLOW       DET ▤ .60  ⟩4 cens │
│ ⑤ FEEDBACK   DET ▤  CTR ✕1      │
├─────────────────────────────────┤
│ ⑦ cap.github.deployments        │
│    never_authorized  [Cockpit →]│
│ ⑨ OPEN QUESTIONS (7)         →  │
│ ⑧ [Narrate this era]            │
├─────────────────────────────────┤
│ ⓑ EA  TM  CR  DM   ⋯ (sheet)    │
└─────────────────────────────────┘
```

ⓐ The vector does not collapse to one number on mobile either; it collapses to *how many dimensions
are measured* (a count, i.e. chrome) plus the limiting code. ⓑ Four rail items plus `⋯` for the full
ten-item sheet, same order as desktop. **Degraded:** if every tile is blocked the grid renders four
`cov.absent-panel`s and the primary action becomes "Open Coverage Cockpit" — never blank.

### 4.2 S2 — Architecture Time Machine · `UX-TM`

```text
DESKTOP ─────────────────────────────────────────────────────────────────────────
┌────┬──────────────────────────────────────────────────────────────────────────┐
│rail│ ① SPINE  ●──●──●──╫──●──●──────●    ② [pin A] [pin B]                     │
│    │          s1 s2 s3 ⑽ s4 s5      s6   ③ focus: ref-OID alias · bundle 3.0   │
│    ├───────────────────────────────────┬──────────────────────────────────────┤
│    │ ④ MODULE GRAPH (opaque nodes)     │ ⑦ SNAPSHOT AGGREGATES                │
│    │   ┌───┐        ┌───┐              │  DET ▤ SCC count            3        │
│    │   │m17│═══════>│m04│  ══ typed    │  DET ▤ largest SCC          9 nodes  │
│    │   └───┘        └─┬─┘  ── co-change│  DET ▤ nodes in cycles      0.21     │
│    │     ^            │    ┈┈ MOD      │  DET ▤ API surface Δ    +5 / −2      │
│    │     └────────────┘       continuity│ ⑧ LIM ▨ parser_coverage 0.38        │
│    │ ⑤ [cov.suppressed-cell] 12 sparse │    cov.parser-share: TS 1.00 ·       │
│    │    pairs hidden by support gate   │    py 0.61 · go null → abstained     │
│    │ ⑥ MOD ⬡ split candidate m04→m04a  │ ⑨ [ Diff against pin B → S6 ]        │
│    │    match confidence band: medium  │                                      │
│    ├───────────────────────────────────┴──────────────────────────────────────┤
│    │ ⑽ ╫ COMPARABILITY SEAM: bundle major 2→3 between s3 and s4. No delta is  │
│    │   computed across this seam; the two sides render as separate eras.      │
└────┴──────────────────────────────────────────────────────────────────────────┘
```

① Spine binds ADR-07 snapshots keyed by (repository alias, ref OID, `parser_bundle_version`, config
revision); each dot is analytic. ② Pin slots feed S6 using the same mechanism as claim pinning.
③ Focus card shows the key, never a branch or tag name (`GIT-REF-01` prohibits ref names).
④ Graph from `GET /api/v2/graphs/module`, HMAC nodes only. Typed structural edges (ADR-06) draw as
double lines; temporal co-change (`DL.ARCH.TEMPORAL_COUPLING.v1`) draws as single solid lines whose
tooltip carries the ADR-09 rule: association, not dependency.
⑤ Sparse pairs below support gates appear as a *count of hidden things*, never silently dropped.
⑥ Continuity/split/merge is **modelled** (ADR-07): hexagon, dashed, confidence band, Drawer path to
the matching method and its planted split/merge fixture.
⑦ `DL.ARCH.CYCLE.v1`, `DL.ARCH.API_SURFACE_DELTA.v1`; cycles are described, never called defects (C-8).
⑧ `parser_coverage` is a first-class panel; a null-share language is listed as **abstained**, so its
absence cannot read as "no code in that language". ⑨ Hands the pinned pair to the Comparator.
⑽ `cov.incomparable-seam` drawn *on the spine*, so a cross-seam pair cannot be selected without
seeing why the diff will refuse.

```text
MOBILE ───────────────────────────
┌─────────────────────────────────┐
│ ① ●─●─●─╫─●─●──●  (h-scroll)    │
│   selected: s5 · bundle 3.0     │
├─────────────────────────────────┤
│ ⑦ SCC 3 · largest 9 · cyc .21   │
│    API Δ +5 / −2         DET ▤  │
│ ⑧ LIM ▨ parser 0.38             │
│    TS 1.00 · py 0.61 · go n/a   │
├─────────────────────────────────┤
│ ④ [graph — tap for full screen, │
│    or ⓒ switch to node list]    │
│ ⑥ MOD ⬡ 1 split candidate    →  │
│ ⑽ ╫ seam before s4 — no deltas  │
└─────────────────────────────────┘
```

ⓒ The node list is not a mobile compromise: it is the accessible equivalent required on both
breakpoints (§8.1). **Degraded:** with `cap.source.structure` inactive the graph is a
`cov.absent-panel` and the spine renders composition-only snapshots if `GH-LANG-01` is active.

### 4.3 S3 — Change River · `UX-CR`

```text
DESKTOP ─────────────────────────────────────────────────────────────────────────
┌────┬──────────────────────────────────────────────────────────────────────────┐
│rail│ ① FILTERS  family [all ▾] · repo alias [all ▾] · grain ISO week (fixed 🔒)│
│    ├──────────────────────────────────────────────────────────────────────────┤
│    │ ② CHANGE FAMILY BANDS — stacked share per ISO week            DET ▤       │
│    │  feature   ▓▓▓▓▓▓▓▓▓▒▒▒░░░░░⧅⧅⧅▒▒▒▒▓▓▓▓▓                                 │
│    │  fix       ▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓⧅⧅⧅▓▓▓▓▓▒▒▒                                 │
│    │  migration ░░░░░░░░░▓▓▓▓░░░░░⧅⧅⧅░░░░░░░░░                                │
│    │  unknown   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒⧅⧅⧅▒▒▒▒▒▒▒▒▒  ③ unknown is always drawn      │
│    │            W05 ──────────────  W12–W14 ─────────────────── W31           │
│    │                    ④ cov.gap-band: parser completion < 0.80              │
│    ├───────────────────────────────────┬──────────────────────────────────────┤
│    │ ⑤ RELEASE BATCHES        OBS ■    │ ⑦ COUPLING WAVES            DET ▤     │
│    │   ┃3  ┃7   ┃2  ┃11   ┃4  ⑥ ⟩open │  wave w-03 · W18–W21 · 6 modules     │
│    │   (PRs per first-parent interval) │  LIM ▨ association only — not        │
│    │                                   │  dependency, ownership, or quality   │
│    │                                   │  ⑧ [ show modules in S2 → ]          │
│    ├───────────────────────────────────┴──────────────────────────────────────┤
│    │ ⑨ CROSS-REPO WAVE LIFT  DET ▤  pairs with ≥12 eligible weeks only ·      │
│    │   [cov.suppressed-cell] 5 sparse pairs suppressed                        │
└────┴──────────────────────────────────────────────────────────────────────────┘
```

① The grain control is **fixed at ISO week** and rendered as a disabled, explained control, so the
ADR-14 floor is visible rather than merely absent. Filters are the API's allowlisted set only.
② Bands bind `DL.CHANGE.INTENT_MIX.v1`; shares are pattern-distinguished, with the pattern swatch
repeated inline in each band label. ③ `unknown` is permanent — hiding it would convert classifier
absence into category presence (C-3). ④ Weeks failing the ≥20-subject / ≥80%-completion gate render
`cov.gap-band`; the stack is interrupted, so no share sums to 1 across a gap.
⑤ `DL.REL.CHANGE_BATCH.v1` on first-parent intervals; each tick analytic. ⑥ The trailing open
interval carries `cov.censor-bracket` — an in-progress interval is not a small batch.
⑦ ADR-09 migration waves; the association-not-dependency limitation renders **on the card**, not only
in the Drawer, because this is the most misreadable panel in the product.
⑧ Handoff carries the wave's module set and window into S2. ⑨ `DL.CROSS.REPO_COOCCURRENCE_LIFT.v1`
with its support gates and sparse suppression made visible.

```text
MOBILE ───────────────────────────
┌─────────────────────────────────┐
│ ① week grain (fixed) · all fams │
│ ② ▓▓▒░⧅▒▓ (h-scroll, 12w page)  │
│   ⓓ tap a week → week sheet     │
├─────────────────────────────────┤
│  WEEK 2026-W19          DET ▤   │
│  feature .42  fix .31           │
│  migration .09  unknown .18     │
│  LIM ▨ text convention ≠ intent │
├─────────────────────────────────┤
│ ⑤ batches ┃3 ┃7 ┃2 ┃11  ⟩open  │
│ ⑦ wave w-03 · 6 modules      →  │
│    association only             │
└─────────────────────────────────┘
```

ⓓ The band becomes a scrubber; the week sheet is the readable form and is the same view model a
screen reader receives on desktop. **Degraded:** without `cap.commit.intent` the family bands become
a `cov.absent-panel`; the batch lane is this surface's deterministic floor and still renders.

### 4.4 S4 — Delivery / Traceability Map · `UX-DM`

```text
DESKTOP ─────────────────────────────────────────────────────────────────────────
┌────┬──────────────────────────────────────────────────────────────────────────┐
│rail│ ① LANES     issue → PR → commit → release → deployment                    │
│    ├──────────────────────────────────────────────────────────────────────────┤
│    │ ② i-118 ──closes──> pr-441 ──merge──> c-9f ──rel-anc──> r-14 ┈?┈> d-??    │
│    │        solid = provider-observed          ③ dotted + HYP = suggested      │
│    │ ② i-119 ┈suggested┈> pr-450 ═══════> c-2a ─────────────> r-14            │
│    │        ④ CTR ✕ superseded by a provider edge 2026-W22 (correction shown) │
│    │ ⑤ i-120 ─────────── no observed edge ──────────────────── ⟩ open/censored │
│    ├───────────────────────────────────┬──────────────────────────────────────┤
│    │ ⑥ FLOW RATIO          DET ▤ 0.60  │ ⑧ INTEGRATION SHAPE         DET ▤     │
│    │   12 linked of 20 eligible        │  ECDF ▁▂▄▆▇█  p50 30h  p90 122h      │
│    │ ⑦ observed edges only —           │  eligible 34 · ⟩ censored 6          │
│    │   suggested edges excluded from   │ ⑨ LIM ▨ queue/batching confound;     │
│    │   this denominator                │   this is a system property, not     │
│    │                                   │   a measure of anybody's speed       │
│    ├───────────────────────────────────┴──────────────────────────────────────┤
│    │ ⑩ REVIEW SURFACE  DET ▤ coverage 0.70 · rework episodes ▁▃▂▁             │
│    │ ⑪ DEPLOYMENT LANE  LIM ▨ GH_DEPLOY_STATUS_90D_CENSOR — earlier state is  │
│    │   unavailable, not absent                                               │
└────┴──────────────────────────────────────────────────────────────────────────┘
```

① Five fixed lanes from the `traceability.v2` projection (ADR-11). No swimlane is a person.
② Provider-observed edges (`closes`, `merge`, `release_ancestor`) render solid `OBS`/`DET`.
③ `suggested_assoc`, `revert_candidate`, `backport_candidate` are modelled → dotted, badge,
calibrated band, alternatives, falsifier in the Drawer.
④ When a provider edge supersedes a suggested claim the map renders the **correction** with `CTR`
plus a lineage link — ADR-11's "the Delivery Map shows the correction", made concrete.
⑤ Unlinked issues terminate in a censor bracket; an unlinked issue is not a failure and no copy
frames it as one. ⑥–⑦ `DL.FLOW.ISSUE_PR_RELEASE_RATIO.v1` renders its observed-only denominator
adjacent to the number, so the suggested edges above cannot be read into the ratio.
⑧–⑨ `DL.PR.INTEGRATION_DURATION_H.v1` as ECDF + quantiles + eligible/censored counts; no mean without
a distribution (ADR-12); system-property wording on the card.
⑩ `DL.REVIEW.COVERAGE_RATIO.v1`, `DL.PR.REWORK_EPISODES.v1`, with "head movement need not respond to
the review". ⑪ Censoring is a standing labelled property of the lane, present even when active.

```text
MOBILE ───────────────────────────
┌─────────────────────────────────┐
│ ① lane picker [issue→release ▾] │
├─────────────────────────────────┤
│ ② i-118  OBS ■                  │
│   closes→ pr-441 → c-9f → r-14  │
│ ② i-119  HYP ◇ suggested        │
│   ┈┈> pr-450        ⓔ why? →    │
│ ⑤ i-120  ⟩ no observed edge     │
├─────────────────────────────────┤
│ ⑥ 0.60 linked (12/20)   DET ▤   │
│   observed edges only           │
│ ⑧ p50 30h · p90 122h · ⟩6       │
│ ⑪ LIM ▨ deploy status > 90d     │
└─────────────────────────────────┘
```

ⓔ `why?` is the mobile affordance for "why am I seeing this" (§6.4) and opens the Drawer as a full
sheet. **Degraded:** with only `github.core` active, lanes 4–5 become `cov.absent-panel` rows that
keep their vertical position, so the chain visibly stops instead of appearing complete.

### 4.5 S5 — Pattern Lens · `UX-PL`

```text
DESKTOP ─────────────────────────────────────────────────────────────────────────
┌────┬──────────────────────────────────────────────────────────────────────────┐
│rail│ ① SERIES [DL.CI.RERUN_RATIO.v1 ▾]  W05–W31   ② false-alert budget:       │
│    │                                        ≤ 2 alerts per year of observation │
│    ├──────────────────────────────────────────────────────────────────────────┤
│    │ ③ SIGNAL   ▁▂▂▃▃▂▂▁▁▂▃▅▆▆▅▅▆▆▅▅▆▆▅   rolling median ─── MAD band ░░░      │
│    │ ④ COVERAGE ▓▓▓▓▓▓▓▓▓▓▓░░░░▓▓▓▓▓▓▓▓▓   ← same time axis, always co-plotted │
│    │                  ▲ c-2         ▲ c-1                                      │
│    ├───────────────────────────────────┬──────────────────────────────────────┤
│    │ ⑤ CANDIDATE c-1          MOD ⬡    │ ⑥ CANDIDATE c-2   MOD ⬡ (demoted)    │
│    │  location W16 ±2 · strength 1.8σ  │  location W12 ±1                     │
│    │  alternatives: seasonal, coverage │  classified coverage_shift_candidate  │
│    │  CTR ✕ 1 contradicting series     │  LIM ▨ coincides with a permission    │
│    │  ? OPN would a fully-covered      │    change — instrument, not system    │
│    │    subwindow still show it?       │  ⑦ [ show the coverage event → S8 ]  │
│    ├───────────────────────────────────┴──────────────────────────────────────┤
│    │ ⑧ MOTIFS (deterministic transition counts)   DET ▤                       │
│    │   fail → rerun → success  ×24    ⑨ LIM ▨ rerun is not evidence of flake  │
└────┴──────────────────────────────────────────────────────────────────────────┘
```

① Series selector is limited to registered feature IDs; there is no free-form metric builder.
② The preregistered false-alert budget (ADR-17) is a standing property of the surface, so an alert
reads against a declared error rate rather than as a discovery.
③–④ **The coverage series is co-plotted on the same axis, always.** This is the most important layout
decision on this surface: ADR-17's coverage-shift separation is only trustworthy if both series are
visible without a click. ⑤ Accepted candidates render as modelled cards with location interval,
strength, the closed alternative enum, contradicting evidence, and the mandatory falsifier.
⑥–⑦ `coverage_shift_candidate` is **demoted but present** — hiding it would hide the instrument's own
behaviour; the link resolves to the exact coverage/consent event in S8.
⑧–⑨ Deterministic motif/transition counts are the floor and render with modelled layers off.

```text
MOBILE ───────────────────────────
┌─────────────────────────────────┐
│ ① DL.CI.RERUN_RATIO.v1      ▾   │
│ ② budget ≤ 2 alerts / year      │
├─────────────────────────────────┤
│ ③ ▁▂▃▅▆▅▆▅  signal              │
│ ④ ▓▓▓░░▓▓▓  coverage (same axis)│
├─────────────────────────────────┤
│ ⑤ c-1  W16±2  MOD ⬡  1.8σ       │
│    alt: seasonal · coverage     │
│    ? what would falsify this →  │
│ ⑥ c-2  W12  coverage_shift      │
│    _candidate — demoted      →  │
│ ⑧ fail→rerun→success ×24 DET ▤  │
│    rerun ≠ flake                │
└─────────────────────────────────┘
```

**Degraded:** below 52 eligible weekly observations the candidate panels are replaced by one
`cov.abstention-card` naming the gate and the count reached so far; motif counts still render.

### 4.6 S6 — Era Comparator · `UX-EC`

```text
DESKTOP ─────────────────────────────────────────────────────────────────────────
┌────┬──────────────────────────────────────────────────────────────────────────┐
│rail│ ① ERA A [E-2025H2 ▾]  ⇄  ② ERA B [E-2026H1 ▾]    ③ comparability: PASS   │
│    │   origin: accepted change-point c-1     origin: user annotation           │
│    ├───────────────────────────────────┬──────────────────────────────────────┤
│    │ ④ ERA A                           │ ④ ERA B                              │
│    │   modules 31 · SCC 2              │   modules 42 · SCC 3                 │
│    │   API total 214                   │   API total 261                      │
│    │   intent mix ▓▒░                  │   intent mix ▓▓▒                     │
│    │   flow ratio 0.48 (observed)      │   flow ratio 0.60 (observed)         │
│    │   parser_coverage 0.61            │   parser_coverage 0.38  ⑤ LIM ▨      │
│    ├───────────────────────────────────┴──────────────────────────────────────┤
│    │ ⑥ WHAT MATERIALLY CHANGED — deterministic diff of snapshot aggregates    │
│    │   DET ▤ +11 modules      DET ▤ +47 public declarations                   │
│    │   MOD ⬡ 2 continuity splits, 1 merge (match confidence: medium)          │
│    │ ⑦ NOT COMPARED: intent mix — era A below the parser gate [cov.abstention]│
│    │ ⑧ no ranking and no improved/degraded wording exists on this surface     │
│    ├──────────────────────────────────────────────────────────────────────────┤
│    │ ⑨ PORTFOLIO  DET ▤ distribution across 6 repository aliases              │
│    │   DL.PORT.TRANSITION_JS.v1 0.22 · DL.PORT.EFFECTIVE_REPOSITORIES.v1 3.4  │
│    │ ⑩ rendered as a distribution strip — never an ordered list               │
└────┴──────────────────────────────────────────────────────────────────────────┘
```

①–② Each era shows its **origin** (accepted change-point / policy transition / user annotation),
because an era is presentation and is deletable without touching facts (ADR-07).
③ The comparability gate runs *before* the diff renders; on FAIL block ⑥ is replaced by a
`cov.incomparable-seam` explanation and the era columns stay side by side with no arithmetic.
④ Symmetric columns, identical row order, every figure independently drawer-resolvable.
⑤ Asymmetric coverage is called out on the weaker side, never averaged.
⑥ Deterministic aggregate diffs carry `DET`; continuity split/merge carries `MOD`, and the two never
share a row style, so a structural change and an inferred identity change cannot be confused.
⑦ Dimensions that cannot be compared are listed as *not compared* with their gate; omission would
imply "no change". ⑧ Enforced by the copy dictionary (C-8).
⑨–⑩ ADR-16 portfolio comparison as a distribution strip. **REJ:** any sorted repository ranking.

```text
MOBILE ───────────────────────────
┌─────────────────────────────────┐
│ ① A E-2025H2  ⇄  ② B E-2026H1   │
│ ③ comparability PASS            │
│ ⓕ [ A | B | Δ ] segmented       │
├─────────────────────────────────┤
│ Δ  DET ▤ +11 modules            │
│    DET ▤ +47 declarations       │
│    MOD ⬡ 2 splits, 1 merge      │
│ ⑦ not compared: intent mix      │
│ ⑨ portfolio JS 0.22 · N_eff 3.4 │
└─────────────────────────────────┘
```

ⓕ The three-state segment replaces side-by-side columns; on comparability FAIL the Δ tab is
**disabled with an explanation**, not hidden.

### 4.7 S7 — Evidence Drawer · `UX-ED`

```text
DESKTOP — right overlay, 420–520 px, host surface stays mounted ──────────────────
                         ┌──────────────────────────────────────────────────────┐
                         │ ① HYP ◇  cl_7c31…            ✕  ⑩ [pin] [compare]    │
                         │ ② "Integration duration widened in E-2026H1"         │
                         │    method HYP.TEMPLATE.v3 · window [W05, W31)        │
                         ├──────────────────────────────────────────────────────┤
                         │ ③ WHY AM I SEEING THIS                               │
                         │   claim → 6 edges → 14 evidence → coverage →         │
                         │   cap.github.core → consent revision v3              │
                         │   [ walk it step by step ▾ ]                         │
                         ├──────────────────────────────────────────────────────┤
                         │ ④ SUPPORTS (4)          ⑤ CONTRADICTS (1)     CTR ✕  │
                         │  ev_0a DET ▤ p90 122h    ev_0f DET ▤ batch size fell │
                         │  ev_0b OBS ■ 34 eligible        in W20               │
                         │ ⑥ COVERAGE BASIS (2)    ⑦ LIMITATIONS (3)     LIM ▨  │
                         │  ev_0c completeness .74  GH_PR_FILES_3000_CAP        │
                         │  ev_0d censoring .82     RERUN_NOT_FLAKE · …         │
                         ├──────────────────────────────────────────────────────┤
                         │ ⑧ ALTERNATIVES (closed enum)                         │
                         │   coverage shift · seasonal · queue policy           │
                         │ ⑨ ? OPN WHAT WOULD CHANGE THIS                       │
                         │   "A fully-covered subwindow in W16–W22 that still   │
                         │    shows the widening."   cost class: re-collect     │
                         ├──────────────────────────────────────────────────────┤
                         │ ⑪ LINEAGE  superseded_by none · corrections 1        │
                         │ ⑫ [ open these tables in Query Lab → ]               │
                         └──────────────────────────────────────────────────────┘
```

① The layer badge precedes the statement: the reader learns *what kind of thing this is* before
*what it says*. ② The statement renders from the closed `statement_code` enum with slots filled,
never free prose. ③ The ADR-01 resolution walk, collapsed by default, expandable to the literal
chain; this is the single "why am I seeing this" implementation and every surface links here.
④–⑦ The four edge roles that matter to a reader, each with a count. **Sections render even when
empty** ("no contradicting evidence was retrieved") — because ADR-20 mandates counter-evidence
quotas, an empty contradiction section is itself information.
⑧ Alternatives come from the per-family closed enum (ADR-21), never generated text.
⑨ The falsifier plus its cheapest-resolving-evidence cost class (ADR-24); always present on `HYP`.
⑩ Feeds the pin tray (§6.3). ⑪ Corrections and supersession, so a claim's history is visible rather
than rewritten. ⑫ Deep-links into S9 with contributing table names pre-filled; read-only.

```text
MOBILE — full-screen sheet ───────
┌─────────────────────────────────┐
│ ① HYP ◇ cl_7c31…            ✕   │
│ ② Integration duration widened  │
│ ③ why am I seeing this?      ▾  │
├─────────────────────────────────┤
│ ⓖ [supports 4 | against 1 |     │
│    coverage 2 | limits 3]       │
│  ev_0a DET ▤ p90 122h        →  │
│  ev_0b OBS ■ 34 eligible     →  │
├─────────────────────────────────┤
│ ⑧ alternatives: coverage shift, │
│    seasonal, queue policy       │
│ ⑨ ? what would change this      │
│ ⑩ [pin]   ⑫ [query tables]      │
└─────────────────────────────────┘
```

ⓖ Tab counts are chrome; a zero-count tab renders "0" and is never removed.

### 4.8 S8 — Coverage / Privacy Cockpit · `UX-CC` + `UX-PC`

```text
DESKTOP ─────────────────────────────────────────────────────────────────────────
┌────┬──────────────────────────────────────────────────────────────────────────┐
│rail│ ① CAPABILITY LIFECYCLE                                                    │
│    │  capability            state           classes  age/horizon  last collect │
│    │  github.core           active          C2, C1   11m / 13m    2026-08-03   │
│    │  cap.local.git         previewed       —        —            —            │
│    │  cap.source.structure  card_bound      —        —            —            │
│    │  cap.github.security   never_authorized —       —            —            │
│    │  cap.external.model    never_authorized —       —            —  ② G4 note │
│    ├───────────────────────────────────┬──────────────────────────────────────┤
│    │ ③ COVERAGE VECTOR (selected cap)  │ ⑥ WHAT WOULD BE DELETED              │
│    │  permission        1.00           │  source observations     1,204 rows  │
│    │  completeness      0.74 ← limiting│  facts / features          412 / 96  │
│    │  freshness         0.91           │  claims                         58   │
│    │  censoring         0.82           │  graph projections               3   │
│    │  conflict          1.00           │  retrieval indexes               1   │
│    │  sample            0.60           │  packs under app control         2   │
│    │  source_diversity  null (single)  │ ⑦ leaves: a content-free tombstone   │
│    │  parser_coverage   null (n/a)     │ ⑧ [preview deletion] [revoke]        │
│    │  comparability     1.00           │                                      │
│    │  drift             null           │ ⑨ CANNOT BE RECALLED                 │
│    │  calibration       null           │  user-copied exports · provider-held │
│    │ ④ limiting reason GH_SEARCH_1000_ │  copies · filesystem snapshots ·     │
│    │   CAP  ⑤ (no average is shown)    │  physical media                      │
│    ├───────────────────────────────────┴──────────────────────────────────────┤
│    │ ⑩ TRANSITION HISTORY (lineage_event)  ⑪ gate approval performs no        │
│    │   transition — G2/G3/G4 never activate a capability                      │
└────┴──────────────────────────────────────────────────────────────────────────┘
```

① One row per capability from `GET /api/v2/capabilities`, states from the ADR-03 machine
(`never_authorized → card_bound → previewed → active ⇄ suspended → revoked`).
② The G4 row states the exact approved boundary (OpenAI `gpt-5.6-luna`, C1-only, one request) **and**
that the capability remains `never_authorized`; no control here can activate it.
③–⑤ The eleven ADR-02 dimensions listed vertically, `null` shown as `null` with its reason. There is
deliberately **no aggregate row**: the absence of a total is a designed feature (C-4).
⑥–⑦ Deletion preview enumerated from the schema registry (ADR-03), not a curated list.
⑧ Revoke calls `POST /api/v2/capabilities/:id/revoke`; preview-then-confirm is mandatory and the
confirm control stays disabled until the preview has been rendered and scrolled to its end.
⑨ Standing disclosure, always visible, never inside a collapsed section — a charter obligation.
⑩ `lineage_event` history including `reconsent` and `tombstone_cascade`. ⑪ A permanent statement
mirroring the registry-snapshot invariant test.

```text
MOBILE ───────────────────────────
┌─────────────────────────────────┐
│ ① CAPABILITIES                  │
│  github.core         active  →  │
│  cap.local.git       previewed→ │
│  cap.external.model  never_a. → │
├─────────────────────────────────┤
│ ③ github.core · vector          │
│  perm 1.00  compl 0.74 ← limit  │
│  fresh 0.91 cens 0.82           │
│  ⓗ show all 11 dimensions    ▾  │
│  ⑤ (no combined score)          │
├─────────────────────────────────┤
│ ⑥ would delete 1,204 obs · 412  │
│    facts · 58 claims · 2 packs  │
│ ⑧ [preview deletion]            │
│ ⑨ cannot be recalled: exports   │
│    you copied · provider-held   │
│    copies · snapshots · media   │
└─────────────────────────────────┘
```

ⓗ Collapsing to four dimensions is allowed; collapsing to one number is not.

### 4.9 S9 — Query Lab · `UX-QL`

```text
DESKTOP ─────────────────────────────────────────────────────────────────────────
┌────┬──────────────────────────────────────────────────────────────────────────┐
│rail│ ① PACK pack_2026W31_a1 · schema 1.0.0 · COMPLETE ✓ · checksums 14/14 ✓    │
│    │   ② [choose another pack directory]   ③ built 2026-08-03 (2 days ago)     │
│    ├───────────────────────────┬──────────────────────────────────────────────┤
│    │ ④ SCHEMA BROWSER (read)   │ ⑥ QUERY                                       │
│    │  facts/                   │   SELECT window, value                        │
│    │   pr_lifecycle   412 rows │   FROM features                               │
│    │   release_interval  38    │   WHERE feature_id =                          │
│    │  features/          96    │     'DL.PR.INTEGRATION_DURATION_H.v1'         │
│    │  claims/            58    │  ⑦ [ run in browser · DuckDB-WASM ]           │
│    │  coverage/          22    │  ⑧ RESULT 48 rows  [copy] [download CSV]      │
│    │  questions/          7    │  ⑨ these are pack rows: pack-scoped aliases   │
│    │ ⑤ dictionary/            │     and suppression were applied at build time │
│    │   limitation codes        │                                               │
│    ├───────────────────────────┴──────────────────────────────────────────────┤
│    │ ⑩ EXAMPLE QUERIES from the pack's own queries/ directory (not authored by │
│    │   the UI): coverage by capability · censored tails · claim lineage        │
│    │ ⑪ No server SQL endpoint exists. This runs entirely in the browser.       │
└────┴──────────────────────────────────────────────────────────────────────────┘
```

① The integrity header is the first element: a pack failing checksum or lacking `COMPLETE` never
opens (ADR-22), and this line explains the refusal. ② User-selected directory; the Lab never
enumerates the private store. ③ Build age drives `cov.stale-ribbon` when the pack predates the
current analysis. ④–⑤ Read-only schema browser plus the versioned limitation dictionary shipped
inside the pack. ⑥–⑦ DuckDB-WASM, in-browser, no network, no write path. ⑧–⑨ Results are pack rows,
so the Lab cannot reveal more than the pack already contains. ⑩ Examples come from the pack, keeping
the Lab honest across pack schema versions. ⑪ Standing statement — the charter forbids a generic SQL
endpoint on the private API.

```text
MOBILE ───────────────────────────
┌─────────────────────────────────┐
│ ① pack_2026W31_a1 · COMPLETE ✓  │
│ ⓘ [ examples | schema | query ] │
├─────────────────────────────────┤
│ ⑩ coverage by capability     →  │
│    censored tails            →  │
│    claim lineage             →  │
│ ⑧ result 48 rows  [copy]        │
│    (horizontally scrolling)     │
│ ⑪ runs in this browser only     │
└─────────────────────────────────┘
```

ⓘ Mobile leads with examples rather than an editor. **Degraded (ADR-22 rollback):** if the
DuckDB-WASM bundle is dropped, the Lab renders the same examples as copyable SQL plus external-tool
instructions; the schema browser and dictionary still render from the manifest.

### 4.10 S10 — System Story · `UX-SS`

```text
DESKTOP ─────────────────────────────────────────────────────────────────────────
┌────┬──────────────────────────────────────────────────────────────────────────┐
│rail│ ① BEAT 6 of 10 · era E-2026H1 · <alias>     ② [beat map ▾]  ③ [exit]      │
│    │   ●●●●●◉○○○○  ④ layer rail OBS OBS OBS DET DET DET DET MOD HYP OPN        │
│    ├──────────────────────────────────────────────────────────────────────────┤
│    │ ⑤ DET ▤   What moved together                                            │
│    │                                                                          │
│    │  ⑥ [ one visual: coupling wave w-03 · six opaque modules · W18–W21 ]      │
│    │                                                                          │
│    │  ⑦ Six modules changed together across four weeks. Co-change is           │
│    │     association; it is not dependency, ownership, or design quality.      │
│    │  ⑧ LIM ▨ 3 oversize commits excluded · pair support gate ≥ 3              │
│    │  ⑨ [ inspect this claim → S7 ]      [ see it in Change River → S3 ]       │
│    ├──────────────────────────────────────────────────────────────────────────┤
│    │ ⑩ [ ← previous ]   ⑪ auto-advance: OFF (always)   [ next → ]              │
└────┴──────────────────────────────────────────────────────────────────────────┘
```

① The beat index is chrome; the era and alias are the subject line of every beat. ② The beat map
lists all ten beats with their layers, so the arc is legible before it is walked. ③ Exit returns to
the Atlas with the era still pinned. ④ The layer rail is the story's spine: the reader sees the
ladder being climbed and sees when a beat has been demoted (the rail shows `ABS`).
⑤ One beat = one layer = one claim family. ⑥ One visual per beat, reused from the surface that owns
it; there are no story-only chart types. ⑦ Body copy from the closed statement enum with slots
filled; the domain's wording rule is part of the beat, not a footnote. ⑧ Limitations render inside
the beat. ⑨ Every beat is escapable into the evidence and into its home surface.
⑩–⑪ Manual advance only. **No auto-advance, no timer, no confetti, no score reveal.**

```text
MOBILE — full-bleed, vertical ────
┌─────────────────────────────────┐
│ ① 6/10  E-2026H1          ③ ✕   │
│ ④ ●●●●●◉○○○○                    │
├─────────────────────────────────┤
│ ⑤ DET ▤  What moved together    │
│ ⑥ [ wave visual — tap to zoom ] │
│ ⑦ Six modules changed together  │
│    across four weeks. Co-change │
│    is association, not          │
│    dependency.                  │
│ ⑧ LIM ▨ 3 oversize commits      │
│    excluded                     │
├─────────────────────────────────┤
│ ⑨ [inspect claim] [see in river]│
│ ⑩ swipe ← → · ⓙ no auto-advance │
└─────────────────────────────────┘
```

ⓙ Swipe is horizontal and never time-driven; a reduced-motion reader gets paged transitions with no
translation (§8.2).

---

## 5. Narrative beats for the guided System Story

Ten beats, one era, one system. The arc is `observed → deterministic → modelled → hypothesis → open
question`, and it **ends on a question** — there is no summary beat, no score, no superlative.

| # | Beat | Layer | Binds to | Abstains when | Framing rule |
|---|---|---|---|---|---|
| B1 | **Where we are looking** | observed | scope alias, window `[start,end)`, active capabilities | never | States what is *excluded* as prominently as what is included; no claim is made yet |
| B2 | **What was seen** | observed | `source_observation_*` counts, `DL.COV.COMPLETE_RATIO.v1` | never | Counts are system objects, not output; no per-unit-of-time framing |
| B3 | **What is missing** | observed (coverage) | coverage ledger, `CoverageStatus` mix, limitation codes | never — this beat cannot be skipped | Missing evidence gets a full beat of the same size as any other; absence is content |
| B4 | **How change arrived** | deterministic | `DL.PR.INTEGRATION_DURATION_H.v1`, `DL.REL.CHANGE_BATCH.v1` | <5 eligible PRs / <3 intervals | Durations are queue/system properties; "fast" and "slow" are never goods |
| B5 | **What the machines said back** | deterministic | `DL.CI.OUTCOME_MIX.v1`, `DL.CI.RECOVERY_TRANSITION_RATIO.v1` | <10 eligible attempts | Rerun ≠ flake; failure ≠ poor quality — both sentences appear in the beat |
| B6 | **What moved together** | deterministic | `DL.ARCH.TEMPORAL_COUPLING.v1`, ADR-09 waves | support gate unmet | Association, never dependency, ownership, or design quality |
| B7 | **How the shape changed** | deterministic (+ modelled inset) | ADR-07 era diff, `DL.ARCH.API_SURFACE_DELTA.v1` | comparability = 0 → the beat becomes "these eras cannot be compared, and here is why" | Structural deltas are described, never graded; continuity is a modelled inset with its own badge |
| B8 | **A pattern worth naming** | modelled | ADR-17 change-point / motif candidates | <52 weekly observations, or `coverage_shift_candidate` → "the instrument moved" | The coverage alternative is named in the same breath as the pattern |
| B9 | **One interpretation — and its counter** | hypothesis | ADR-21 composer output with counter-evidence quota | any coverage floor unmet | Hypothesis and counter-hypothesis render as **equal-weight siblings**, same size, side by side; neither is styled as the conclusion |
| B10 | **A question to carry forward** | question | ADR-24 `question` claim + cheapest resolving evidence | never — a question can always be generated from a coverage gap | The story ends here: no action item, no recommendation, no next-step nudge |

**Humane framing rules (binding on every beat's copy).**

1. The subject of every sentence is the system, a repository alias, a module alias, a queue, or the
   evidence itself — never a person, a team, or an implied actor ("someone", "the team", "you").
2. No score, index, grade, percentile, rank, or composite; no "out of 10", no dial, no gauge.
3. No prescription. The story says what is observed, what follows, what is uncertain, and what would
   settle it — never what to do.
4. No superlatives about the system's worth (C-8 banned strings). Descriptive comparatives about
   measured quantities are permitted only with their limitation attached.
5. Abstention beats keep the same visual weight and reading time as content beats, so a low-coverage
   era feels shorter only in reality, never by silent omission.
6. Every beat is exitable into evidence; the story is never the only place a claim appears.
7. The last thing the reader sees is a question they could answer, with its cost class — curiosity
   without obligation.

---

## 6. Interaction rules

### 6.1 Filtering

- Filters are the API's allowlisted set (canonical §11): window, repository alias, capability, claim
  family, layer, feature ID. **No free-form predicate builder** outside the Query Lab, which operates
  on the pack rather than the store.
- **Filtering never fabricates.** A window without coverage yields `cov.gap-band` plus a count of
  units excluded for coverage reasons — not an empty chart and not zeros.
- A layer filter **hides claims, it never restyles them.** Turning off `MOD` + `HYP` is exactly the
  deterministic-floor mode of C-6, is an explicit labelled toggle ("deterministic only"), and is the
  acceptance mode for the Brief §5 completeness metric.
- Filter state is URL-encoded for reproducibility using aliases and codes only — never a repository
  name, a person, or a raw provider ID.
- Every filter chip states how many units it removed **and** how many it removed for coverage
  reasons, keeping the two causes of a smaller number distinguishable.

### 6.2 Era pinning

- Two pin slots (A, B). Eras are named by the user or by their origin; renaming is presentation-only
  and deletable without affecting facts (ADR-07).
- Pinning runs the comparability check immediately and shows PASS/FAIL **before** navigation, so a
  failure is attributable to the pin rather than to the comparator.
- A FAIL pair may still exist: the eras render side by side with arithmetic disabled and
  `cov.incomparable-seam` naming the failed dimension.
- Era pins survive surface navigation and are echoed in the System Story subject line.

### 6.3 Claim pinning and comparison

- The tray holds up to 4 claims (**A-UX-3**: a legibility budget, reversible by measurement).
- Comparison renders claims × (layer, coverage dimensions, limitations, alternatives). **No composite
  score column may exist in that matrix** — that is the readmission path for the scalar C-4 forbids.
- Claims of different layers may be pinned together; the comparison labels the mismatch rather than
  normalising it.
- If a pinned claim is superseded mid-session, the tray shows the correction inline (`superseded_by`
  + `lineage_event`) and keeps the old claim visible. History is not rewritten.
- Pins are exportable only through the ordinary pack/export path with its preview and acknowledgement.

### 6.4 "Why am I seeing this"

- Present on **every** analytic figure, badge, and coverage-furniture element: a visible control on
  hover/focus on desktop, an always-visible `why?` affordance on mobile.
- Resolves the single ADR-01 walk: element → `claim_id` → `claim_evidence_edge` rows → evidence →
  coverage record → capability → consent revision. Each hop is displayed and individually openable.
- If a hop fails to resolve, the Drawer renders a **data-quality finding** naming the broken hop, and
  the invoking figure is demoted to chrome on the next render (VG-R1's enforcement path).
- Keyboard: `?` on a focused analytic figure opens the Drawer directly at that section.

### 6.5 Abstention rendering

- An abstention is a **claim with `layer = abstention`** (ADR-01) and occupies a claim-shaped card of
  ordinary size — never smaller, never grey-only, never collapsed by default.
- The card states, in order: what was attempted (claim family), which dimension fell below its floor
  and by how much, what the floor is, and what would lift it (ADR-24 cheapest resolving evidence with
  its cost class).
- Monotone abstention (ADR-02) is made visible: the card says that no other dimension can compensate,
  so a reader cannot expect a different dimension to make up for the missing one.
- Abstentions are countable and filterable; the Open Questions Observatory harvests them, so an era
  full of abstentions is a legible fact about coverage rather than a silence.

### 6.6 Suppressed-data furniture

- Suppression (sparse pairs, size bands, minimum groups, display gates) renders `cov.suppressed-cell`
  **in position**, with the count of suppressed units and the gate responsible.
- Suppression is never silent and never re-derivable: the UI shows *that* n cells were suppressed and
  never leaves residual totals that permit reconstruction by subtraction.
- Ownership and team-coverage panels suppress size-one groups by construction (ADR-13); the rule is
  stated as a standing property of the panel, not per incident.
- A suppressed region is never interpolated, smoothed, or bridged in any chart.

---

## 7. Progressive adoption map (ADR-04 bridge order)

Bridge stage IDs are proposed; the order is ADR-04 §4/§6/§7.

| Stage | Bridge content | Surfaces landing | Data dependency | Legacy fallback |
|---|---|---|---|---|
| **B0** | Freeze V1; mount `/api/v2/*` over synthetic-importer output | none (infrastructure) | P2 store, synthetic importer | `legacy-read-only` pins the whole app to V1 |
| **B1** | ADR-04 §7 smallest vertical slice | **S8** (coverage half) + **S7** (one claim end to end) + **S1** shell with the coverage strip and one flow tile | `/api/v2/coverage`, `/api/v2/features`, SPINE-01…03 | V2 routes stay unlinked from primary nav until the UX acceptance card passes; the legacy dashboard remains the landing surface |
| **B2** | Retire DNA / archetype / persona views | **S10** replaces Wrapped; **S1** becomes the landing surface | claim graph + already-available deterministic features | Legacy Wrapped gains a deprecation banner; removal is a separate card. **Person-shaped views are not ported** — their absence is the specified behaviour |
| **B3** | Retire scalar confidence | **S8** privacy half (`UX-PC`): lifecycle, retention clocks, deletion preview | ADR-03 state machine, schema-registry enumeration | The scalar renders only inside legacy views and is never computed from V2 data |
| **B4** | Retire the legacy insight stack | **S4**, **S3** | TRACE-01/02, OBSV-PR-01…03, SEM-01/02, GIT-01…03 | Legacy insight stack stays reachable per view until each replacement passes its card |
| **B5** | Structure lane | **S2**, **S6** | XRAY-01…03, ATLAS-01…06, TIME-01…03; `cap.source.structure` activation | Both ship *before* activation and render `cov.absent-panel` while the capability is inactive |
| **B6** | Retire legacy exporters | **S9** | PACK-01…05, QL-01/02 | ShareStudio moves to `ExportView`-fed builders; until then legacy exporters remain and the Lab is additive |
| **B7** | Research lane (gated) | **S5** | LAB-01/02 for the deterministic floor; WB-C1/C4 only after ADR-19 promotion | Ships at its deterministic rung; modelled candidates appear only when the registry marks them promoted and vanish automatically on demotion |
| **B8** | Legacy collector retires | none | real-migration protocol (G2) | Last step; nothing here depends on it |

**Legacy-fallback behaviour (binding).**

1. `legacy-read-only` pins the entire app to V1 rendering at any point during the bridge. It is an
   app-level rollback, not a per-panel fallback.
2. **A V2 surface never falls back to V1 data.** If a V2 resource is empty, unavailable, or degraded,
   the V2 surface renders coverage furniture. Mixing V1 and V2 in one view would silently reintroduce
   scalar confidence and person-shaped fields (ADR-04 §5).
3. A legacy route stays reachable until its replacement passes its UX acceptance card; then it gains
   a deprecation banner; removal is a separate card per view.
4. Parity is measured on safe aggregates only. Person-shaped V1 outputs are deliberately absent from
   parity, and a test asserts the V2 API exposes no such fields (ADR-04 §3).
5. The C0 public twin follows the same order one stage behind, so the showcase never demonstrates a
   surface whose private counterpart has not passed its card.

---

## 8. Accessibility and delight

### 8.1 Keyboard paths

| Path | Behaviour |
|---|---|
| `Tab` order | Skip link → scope header → coverage strip → primary content → rail. The rail is late deliberately: orientation before navigation. |
| Rail | Roving tabindex; `↑`/`↓` move, `Enter` activates. Ten fixed items, so the rail is memorisable. |
| Analytic figures | Focusable; `Enter`/`Space` open the Drawer; `?` opens it directly at "why am I seeing this". |
| Drawer | Focus moves to the drawer heading on open, is trapped while open, and **returns to the invoking element** on close; `Esc` closes. |
| Timelines / spines | `←`/`→` step one snapshot or week; `Home`/`End` jump to the ends; `Shift+←/→` extends a range; `p` pins the focused era or claim. |
| Story | `←`/`→` or `n`/`p` move beats; `m` opens the beat map; `Esc` exits to the Atlas with the era pinned. |
| Comparator | `[` / `]` switch the focused era; `d` focuses the diff block or its refusal explanation. |
| Global | Single-letter shortcuts are disabled while a text input has focus, are listed on one shortcuts sheet, and can be turned off entirely in one setting. |

Every graph, river, ECDF, and spine has an equivalent **table view** reachable by keyboard and exposed
to assistive technology by default — §4.2 ⓒ is the pattern. Charts are labelled regions with
`aria-describedby` pointing at a text summary generated from the same claim, so the description and
the drawn mark cannot diverge. Claim announcement template: `"<layer prefix>. <statement>. <n>
supporting, <n> contradicting. Coverage limited by <dimension>. <n> limitations. Question:
<falsifier>."` — layer always first, question always last.

### 8.2 Reduced motion

- `prefers-reduced-motion: reduce` removes story beat transitions (paged, no translation), river flow
  animation (static stacked bands), graph force settling (pre-computed static layout), drawer slide
  (instant), all parallax, and any auto-playing sparkline.
- Nothing that conveys information is animation-only: the river's "flow" is a static encoding, and
  any animation is decoration removable without information loss.
- No auto-advance exists anywhere in either motion setting — the System Story is manual by design,
  not by accommodation.

### 8.3 Inviting curiosity without judgement

- **Surprise me** (ADR-24): a coverage-weighted random walk over the claim graph toward under-visited
  evidence, with its deterministic seed displayed, so a surprise is reproducible and shareable as a
  seed rather than as data. This is the product's play mechanic and it rewards *looking*, not scoring.
- **Open Questions as a destination.** The question list is first-class, with counts and cost classes;
  answering one is the product's sense of progress, replacing streaks entirely.
- **Naming eras.** The user names eras; the system names nothing about the user. Naming is
  presentation-only and deletable — a low-stakes creative act inside a strict evidence product.
- **Delight through honesty.** Positive moments celebrate knowledge gained: "4 claims became
  answerable since the last pack", "this era is now fully comparable", "a contradiction was resolved
  by a provider edge". Never "you shipped more", never a personal best.
- **Tone.** Curious and specific; never congratulatory, admonishing, or urgent. Copy about missing
  evidence is neutral and actionable ("`parser_coverage` is null for Go; adding the grammar bundle
  would let this panel render"), never framed as the user's failing.
- The C0 twin keeps its permanent invented-data banner (**V**: `V2Demo.tsx`) at equal prominence on
  both breakpoints — honesty about the demo is part of the demo's delight.

---

## 9. UX acceptance cards (summary)

| Card | Surface | Acceptance highlights |
|---|---|---|
| `UX-VG` | grammar tokens | Grayscale render distinguishes all seven; layer→style mapping is total over the enum; the VG-R1 crawler passes on the C0 twin |
| `UX-EA` *(proposed)* | Evidence Atlas | Renders with zero active capabilities; coverage strip shows nulls with reasons; no aggregate score anywhere in the DOM |
| `UX-TM` | Time Machine | An incomparable pair produces a seam, not a delta; the `parser_coverage` panel lists abstained languages |
| `UX-CR` | Change River | `unknown` always drawn; sub-gate weeks render gap bands; no share sums across a gap |
| `UX-DM` | Delivery Map | Suggested edges excluded from the flow ratio; supersession renders a correction; censored tails counted |
| `UX-PL` | Pattern Lens | Coverage series co-plotted by default; `coverage_shift_candidate` demoted but visible; the deterministic rung renders with models off |
| `UX-EC` | Era Comparator | Comparability FAIL disables arithmetic; "not compared" dimensions listed; no ranking and no normative comparatives |
| `UX-ED` | Evidence Drawer | The ADR-01 walk resolves end to end; an empty contradiction section renders with text; an unresolvable ID yields a data-quality finding |
| `UX-CC` | Cockpit, coverage half | Eleven dimensions with nulls and reasons; no aggregate row exists |
| `UX-PC` | Cockpit, privacy half | Deletion preview enumerated from the schema registry; approval-≠-activation statement present; cannot-recall disclosure always visible |
| `UX-QL` | Query Lab | A failed checksum refuses to open; no network request during a query; the degraded copyable-SQL mode passes the same acceptance |
| `UX-SS` | System Story | Exactly ten beats with the declared layer arc; abstention beats keep full weight; the last beat is a question; no auto-advance in either motion setting |

---

## 10. Open items for the coordinator

**Owner gates (G) — flag, never assume.**

- **G-UX-1.** No surface here needs a new sink, provider, or transmission surface. If a future surface
  wants durable prose (PR/issue text in the story), that is ADR-10's Tier-2 owner gate, not a UX
  decision; this storyboard assumes it does not exist.
- **G-UX-2.** The Query Lab reads a user-selected pack directory from the local filesystem. If that
  browser file-access route counts as a new surface, it is an owner question; the ADR-22 degraded mode
  (copyable SQL) needs no such access.

**Assumptions (A) with reversal paths.**

- **A-UX-1.** Ten rail items; Open Questions is a panel plus a route, not an eleventh rail item.
  Reversal: promote it to the rail if the observatory becomes a primary destination.
- **A-UX-2.** `abstention` uses existing tokens rather than an eighth. Reversal: add `vg.meta.abstention`.
- **A-UX-3.** Pin tray capacity 4; era pins 2. Reversal: measurement on the synthetic corpus.
- **A-UX-4.** Ten story beats — ADR-23 says "guided System Story" without a count. Reversal: beats are
  a registry, not code.
- **A-UX-5.** Beat B7 carries a modelled continuity inset, bending "one layer per beat" into a labelled
  inset. Reversal: split into B7a/B7b for eleven beats.
