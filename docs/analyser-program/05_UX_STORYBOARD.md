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
| C-2 | `observed → deterministic → modelled → hypothesis/abstention` is one-way | Brief §3.3, canonical §6, ADR-01 | Layer is a rendered property of every claim, not a user preference. A modelled figure can never inherit fact or derivation styling. A modelled claim that misses its floor **abstains** — it never degrades into a deterministic claim (§6.5). |
| C-3 | Absence is never zero | Brief §3.4, ADR-02 | No chart draws a zero point for an uncovered window. Gaps render as coverage furniture (§3.4). |
| C-4 | No persuasive single confidence scalar and no confidence band | Brief §3.7, canonical §7 | The V1 scalar (**V**: `shared/v2Demo.ts` `insightConfidences: high\|medium\|low`) renders only in legacy views. **No V2 surface renders a low/medium/high confidence band anywhere.** A V2 claim's state is `eligible` / `limited` / `abstained`, rendered with its coverage vector and its limiting dimensions — and no total. |
| C-5 | Every insight resolves every cited evidence ID | Brief §5, ADR-01 | Rule **VG-R1** (§3.5): every analytic number carries an `AnalyticReference` = `ObservationReference \| ClaimReference`. A number that resolves to neither may not render as an analytic number. |
| C-6 | Deterministic analysis is the complete product | Brief §3.2 | With every modelled/hypothesis layer disabled, no primary panel is empty. Each wireframe marks its deterministic floor. |
| C-7 | Time-grain floor is ISO week for cadence surfaces | ADR-14 | No calendar heat-grid, no hour-of-day, no day-of-week axis. Day grain only inside CI queue/exec distributions where the subject is provider infrastructure. |
| C-8 | Copy dictionary bans normative framing | ADR-09/13/14/15/16 | Banned strings: "top", "best", "healthiest", "most mature", "actively owned", "responsible team", "stewardship", "fast"/"busy" as goods, "flaky" from rerun, "secure" from alert counts. |
| C-9 | Public showcase is invented C0 on a structurally separate path | Brief §3.9, canonical §11 | Every surface has a C0 twin fed only by synthetic constructors; the invented-data banner (**V**: `src/components/V2Demo.tsx`) is permanent and non-dismissible. |
| C-10 | G4 = OpenAI `gpt-5.6-luna`, C1-only; `cap.external.model` is `never_authorized` | charter §G4, matrix | No surface here requires a model call. Every modelled/hypothesis element has a deterministic-composer origin (ADR-21) and renders identically whether or not an external step ever runs. |
| C-11 | Operational timing renders at ISO-week grain or coarser | ADR-14, charter (operational-date minimisation) | Collection-run times, claim/pack version times, and "last collected" values render as an ISO week (`2026-W31`) or coarser (month, quarter) on **every** surface and in **every** export — never an exact calendar day such as `2026-08-03`, never a wall-clock time. Applies to the Cockpit lifecycle table, the Query Lab pack header, the correction lane, and any date a wireframe below draws. |

**REJ (UX-level).** Score dials, grade letters, leaderboards, streak ribbons, DNA radars, archetype
badges, "productivity" sparklines, celebratory superlatives, and any control whose axis is a person —
exactly the V1 surfaces ADR-04 §6 retires first.

---

## 2. Information architecture — the ten-surface Atlas vision

### 2.1 Staging contract — what actually ships, and when (binding)

The ten surfaces in §2.3 are the **Atlas vision**: the destination this storyboard designs toward.
They are **not a build order and not a shell to scaffold**. A surface exists when the evidence that
fills it exists, and not one card earlier.

**The initial product surface is exactly four things:**

| Ships first | Surface | Why it can ship |
|---|---|---|
| 1 | **Coverage / Privacy Cockpit** (S8) | Depends only on the capability lifecycle and the coverage ledger — both real before any analysis runs |
| 2 | **One comparative System Atlas panel** (one panel of S1, not the S1 grid) | One lens, one system-or-portfolio, current window against a baseline window |
| 3 | **Evidence Drawer** (S7) | The resolver is the product's spine; nothing above it is trustworthy without it |
| 4 | **Deterministic System Story** (S10, deterministic beats only) | Unlocked **once the first finding is accepted** — not before, and modelled/hypothesis beats stay dark |

**Everything else is staged behind its evidence producer.** Architecture Time Machine (S2), Change
River (S3), Delivery / Traceability Map (S4), Pattern Lens (S5), Era Comparator (S6), Query Lab (S9),
and the Open Questions Observatory ship **only as their evidence producers become real** — the
producer lands, its claims pass their floors, and only then does the surface that reads them appear.
§7 gives the producer order; this contract governs when the *surface* becomes reachable.

**No ten-route shell is implemented before the first analytical value slice (`DL-VALUE-01`).** There
is no ten-item rail, no placeholder route, no greyed "coming soon" nav item, and no empty-state page
standing in for an unbuilt surface at first ship. The rail renders only the staged surfaces and grows
as producers land; an unstaged surface is **absent from navigation**, not present-and-disabled. This
is the one place where absence is correct furniture-free behaviour: an unbuilt surface is not a
coverage gap, and rendering it as one would misreport the product as the system.

**A-UX-6.** Rail-item count is therefore a function of stage, not a fixed ten. Reversal: if every
producer lands, the rail converges on the §2.3 order.

### 2.2 Entry contract — question-first and comparison-first

The entry surface is not a dashboard of everything known; it is **a question asked of a comparison**.
Whatever is staged, the primary entry renders these controls, in this order:

1. **Selected system or portfolio** — repository alias or portfolio alias; never a person, never a
   provider ID.
2. **Current window and baseline window** — both half-open `[start, end)`, both always visible. A
   single window with no baseline is not a valid entry state: the product's unit of meaning is a
   comparison, so the baseline is a first-class control rather than a setting.
3. **Lens / question** — the analytical question being asked (the lens), selected from the registered
   set. The lens, not the surface, is what the reader chooses; surfaces are where a lens renders.
4. **Coverage state** — the coverage furniture for this lens over these two windows, including the
   limiting dimensions, before any finding is read.
5. **Findings, ordered by evidence relevance** — how directly the evidence bears on the selected lens
   and windows. **Ordering is never by a blended engagement, interest, importance, severity, or
   priority weight**, and no such composite is computed, stored, or exposed anywhere; that ordering
   is the readmission path for the scalar C-4 forbids.
6. **Filters** — the allowlisted set: repository alias, capability, finding family, layer, evidence
   status. (§6.1 binds the filter semantics.)
7. **`show contradicting evidence`** — a first-class control, not a Drawer-only affordance: it
   surfaces the `contradicts` edges of the findings on screen.
8. **`show sensitivity`** — a first-class control that re-renders each finding against its stated
   robustness checks (window shifts, gate thresholds, matched subwindows), so a reader can see which
   findings survive their own assumptions without leaving the surface.

Nav model: overlay destinations are the **Evidence Drawer** (ADR-01/`UX-ED`) and, once its producers
are real, the **Open Questions Observatory** (ADR-24/`OPEN-02`), the latter rendered as an Atlas-home
rail and its own route. **R:** keep Open Questions off the surface rail.

### 2.3 The ten surfaces (Atlas vision)

| # | Surface | Card | Purpose | Primary questions | Entry | Exit |
|---|---|---|---|---|---|---|
| S1 | **Evidence Atlas** (home) | `UX-EA` *(proposed)* | Orient: which system or portfolio, which lens, current window against a baseline window, what is known, missing, open | "What kind of system is this, how has it moved against its baseline, and how much of it can I see?" | Launch; logo; `Esc Esc` | Any staged surface; Open Questions; claim → Drawer |
| S2 | **Architecture Time Machine** | `UX-TM` | Structure across comparable snapshots | "How is this built, and how did its shape change?" | Rail; Atlas structure tile; Comparator "inspect era" | Comparator; Change River (a wave); Drawer |
| S3 | **Change River** | `UX-CR` | Change families over ISO weeks | "What kinds of change recur, and what moved together?" | Rail; Atlas change tile; Pattern Lens "show in context" | Time Machine; Delivery Map (a batch); Drawer |
| S4 | **Delivery / Traceability Map** | `UX-DM` | issue → PR → commit → release → deployment | "How does intent become integrated, released change?" | Rail; Atlas flow tile; River batch | Time Machine; Drawer; Open Questions |
| S5 | **Pattern Lens** | `UX-PL` | Change-points, motifs, residual alerts | "Which shifts are real, and which are coverage moving?" | Rail; any timeline's "explain this shift" | Change River; Comparator; Drawer |
| S6 | **Era Comparator** | `UX-EC` | Two pinned eras, one honest diff | "What materially changed between these periods?" | Rail; Time Machine seam; accepted change-point | Time Machine; System Story; Drawer |
| S7 | **Evidence Drawer** | `UX-ED` | Universal claim inspector; "why am I seeing this" | "What supports this, what contradicts it, what would change it?" | Any number, badge, or mark | Returns focus to the invoking element; may pin |
| S8 | **Coverage / Privacy Cockpit** | `UX-CC` + `UX-PC` | Lifecycle, coverage vector, retention clocks, deletion preview | "What did I consent to, what is retained, what would be deleted?" | Rail; every furniture element's "see coverage" | Back to the invoking surface, capability pre-selected |
| S9 | **Query Lab** | `UX-QL` | DuckDB-WASM over a user-selected completed pack | "Can I check this myself, without trusting the app?" | Rail; Drawer "query this claim's tables"; pack build | Copy result; back to rail |
| S10 | **System Story** | `UX-SS` | Guided ten-beat narration of one era of one system | "Tell me what this became — honestly." | Rail; Atlas "narrate this era"; Comparator | Ends on an open question → Open Questions, **or** on the honest no-open-question ending (§5, B10); never a score |

### 2.4 Empty and degraded-coverage states

Never an empty region; never a zero.

| Surface | Empty | Degraded | Blocked (capability inactive) |
|---|---|---|---|
| S1 | "No analysis has run in this window" + one action: open Cockpit; coverage strip all `never_authorized` | Tiles that can render do; the rest render `cov.absent-panel` naming capability + limiting dimension | Tile keeps its grid slot and shows the lifecycle state and the exact scope its card would ask for |
| S2 | "No comparable snapshot pair exists" + what a snapshot needs (ref OID, `parser_bundle_version`, config revision) | Incomparable pairs render as separate eras across a seam, never as a delta (ADR-07); `parser_coverage` shown per language | `cap.source.structure` state card; composition panel may still render from `GH-LANG-01` |
| S3 | "No eligible weeks" + the gates (≥20 subjects, ≥80% parser completion) | Sub-gate weeks render `cov.gap-band`; `unknown` category always drawn | Intent band absent; release-batch band still renders from `github.core` |
| S4 | "No observed closing edges in window" | Suggested edges render modelled and are excluded from `DL.FLOW.ISSUE_PR_RELEASE_RATIO.v1`; open/abandoned tails get a censor bracket + count | Deployment lane collapses to a lifecycle card; `GH_DEPLOY_STATUS_90D_CENSOR` shown even when active |
| S5 | "No series has ≥52 eligible weekly observations" | Candidates coincident with a coverage shift render `coverage_shift_candidate`, demoted but visible | Deterministic transition/frequency counts still render (ADR-17 rung 1) |
| S6 | "Pin two eras to compare" | `MATCHED_PARTIAL` pins → arithmetic runs only over the proven instrument-matched subwindows, with the matched fraction and a selection-bias limitation shown on the diff; `INCOMPARABLE` pins → the diff refuses and names the failed dimension, eras shown side by side without arithmetic | Absent repositories are listed as absent, not omitted from the portfolio strip |
| S7 | n/a | An unresolvable evidence ID renders a data-quality finding, and the invoking number is demoted to chrome | Revoked source shows the content-free tombstone and its `lineage_event` |
| S8 | Ten-row lifecycle table, all `never_authorized` — the correct first-run screen | Retention clocks show age vs horizon; over-horizon rows show pending expiry, not an error | n/a — this is the surface that renders blocked states |
| S9 | "No completed pack selected" + how to build one | Stale pack shows a ribbon with `pack_schema_version` and build time | Failed checksum or missing `COMPLETE` **refuses to open** (ADR-22); no partial rows |
| S10 | "Not enough evidence to narrate an era" + the Open Questions that would unlock one | Gated beats become abstention beats of equal weight (§5); the story never shortens silently | B8/B9 drop to abstention; B1–B7 still run, and B10 renders either a genuine open question or the honest no-open-question ending |

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

- **No promotion, and no sideways demotion into determinism.** Card styling derives from the claim's
  `layer` column by a total function over the enum; there is no path that renders a `modelled` claim
  with `vg.layer.fact` or `vg.layer.derivation`. When a modelled claim misses a floor it renders
  `cov.abstention-card`, never `DET` (§6.5).
- **No confidence band.** No card, tooltip, legend, or export renders a low/medium/high confidence
  label (C-4). A claim renders its **state** — `eligible` / `limited` / `abstained` — beside its
  coverage vector and limiting dimensions; a modelled claim additionally renders its numeric
  uncertainty interval, which is an interval, not a band label.
- **Contradiction is never hidden.** A claim with ≥1 `contradicts` edge shows `CTR` even in the most
  compact card variant. Compaction may reduce `LIM` to a count, never `CTR`.
- **Limitations are counted, never summed away.** `LIM ×3` expands in the Drawer to three
  `limitation_code` rows, each with its triggering dimension and claim-family copy.
- **A hypothesis card without a question does not render.** ADR-21 makes the falsifier mandatory; a
  missing question is a data-quality finding and the finding renders instead.
- **Position and proximity must encode a measured relationship — or be labelled decoration.** Any
  visual in which marks are placed relative to one another (graph, spine, strip, and any future
  constellation-style layout) either (a) encodes a real, resolvable relationship — dependency,
  co-change, release coupling, shared workflow — with the relationship named in the legend and each
  edge drawer-resolvable, or (b) carries a visible `Story presentation — layout is decorative`
  label and draws no edges at all. **Hard-coded proximity presented as structure is prohibited**, as
  is any numbering, ordering, or sorting of repositories or modules on a surface that claims not to
  be a ranking: an ordered list *is* a ranking regardless of what the caption says. Where an order is
  unavoidable (keyboard traversal, table rows), it is an explicitly declared, non-analytic order —
  alias-alphabetical or window-chronological — stated on the surface.

### 3.4 Coverage furniture (proposed IDs) → `CoverageStatus` / dimension

| Furniture | Renders as | For |
|---|---|---|
| `cov.absent-panel` | Panel-sized card: `LIM` token, capability, lifecycle state, one action | `never_authorized`, `refused`, `unavailable` / `permission` |
| `cov.gap-band` | Hatched band over the uncovered interval; the series is **interrupted, not zeroed** | `truncated`, `failed` / `completeness` |
| `cov.censor-bracket` | `⟩` at the censored end + eligible/censored counts | `censored` / `censoring_freedom` |
| `cov.suppressed-cell` | Cross-hatched cell naming the gate (sample, size-band, sparse pair) | display gate / `sample`, `eligibility` |
| `cov.ineligible-count` | Count of in-window subjects excluded by a stated eligibility rule, beside the eligible denominator | eligibility gate / `eligibility` |
| `cov.incomparable-seam` | Double vertical seam; no delta arithmetic crosses it. In `MATCHED_PARTIAL` the seam is drawn around each unmatched subwindow instead, leaving the matched subwindows joinable | ADR-07 / `comparability` |
| `cov.stale-ribbon` | Ribbon with `DL.COV.FRESHNESS_AGE_H.v1` and its SLO | `stale` / `freshness` |
| `cov.conflict-chip` | `CTR`-marked chip with `DL.DQ.CONFLICT_RATIO.v1` and the source pair. The raw conflict ratio is a **diagnostic**, not a coverage dimension; the dimension it moves is `consistency` (higher-is-better) | source disagreement / `consistency` |
| `cov.parser-share` | Stacked share of parsed vs abstained languages | ADR-06 / `parser_coverage` |
| `cov.tombstone-slot` | Content-free tombstone + the causing `lineage_event` | `deleted` |
| `cov.abstention-card` | Claim-sized card: what was attempted, which floor failed, what would lift it | monotone abstention (ADR-02) |

Every furniture element deep-links to S8 with the capability and dimension pre-selected.

### 3.4.1 The twelve coverage dimensions, and where each may render

The ADR-02 vector has **twelve** dimensions, every one of them **higher-is-better**, every one
`number | null`:

`permission` · `completeness` · `eligibility` · `freshness` · `censoring_freedom` · `consistency` ·
`sample` · `source_diversity` · `parser_coverage` · `comparability` · `drift_stability` ·
`calibration`

Three naming rules are load-bearing, because the retired names inverted their polarity:

- **`censoring_freedom`**, not "censoring": 1.00 means the window is free of censoring, 0.20 means it
  is heavily censored. There is no lower-is-better "censoring" value in the UI.
- **`consistency`**, not "conflict": 1.00 means the sources agree. Raw conflict counts and
  `DL.DQ.CONFLICT_RATIO.v1` may still render as a **diagnostic** beside the finding, clearly separate
  from the dimension.
- **`drift_stability`**, not "drift": 1.00 means the instrument held steady across the window.

**Where the vector renders.**

- **The Coverage / Privacy Cockpit (S8) may render all twelve**, vertically, with `null` shown as
  `null` plus its reason.
- **An individual finding never renders the full vector.** A finding card foregrounds only: its
  claim family's **required dimensions**; its **limiting dimensions**; its **sample / eligibility /
  censoring counts**; its **source disagreement**; and its **robustness** (which checks it survives).
  Everything else is one hop away in the Drawer, not on the card.
- **No aggregate, total, average, weighted blend, or percentage-of-dimensions-passed renders
  anywhere** — not on a surface, not in a tooltip, not in an export, not in the DOM (C-4). A *count*
  of how many dimensions are measured is chrome (§3.5) and is not an aggregate of their values.

### 3.5 VG-R1 — every number resolves to a typed analytic reference

> A figure is **analytic** if it asserts something about the system. Every analytic figure carries an
> **`AnalyticReference`**, is focusable, is announced with "opens evidence", and opens the Evidence
> Drawer on activation. A figure that resolves to neither arm of the union **must not render as an
> analytic figure**: it renders as chrome (different type ramp, no underline, not focusable) or not
> at all.

```text
AnalyticReference = ObservationReference | ClaimReference
```

| Arm | Carries | Used by | Resolves to |
|---|---|---|---|
| `ObservationReference` | `observation_id` (equivalently the evidence ID that wraps it) | A **raw allowed fact** rendered as-is: an allowed source field seen at a snapshot, an observed provider edge, a capability lifecycle state | the observation row → its coverage record → capability → consent revision |
| `ClaimReference` | `claim_id` | Every **derived** number: counts, ratios, quantiles, durations, shares, graph statistics, deltas, lifts, distances — i.e. every deterministic, modelled, hypothesis, or abstention claim | the claim → `claim_evidence_edge` rows → evidence → coverage → capability → consent revision |

Raw allowed facts therefore do **not** need a synthesised claim wrapper to render; they resolve via
their observation/evidence ID. Anything computed from them is a deterministic claim and carries a
`claim_id`. **The Evidence Drawer resolver accepts either arm** and walks the same way to source,
coverage, capability, and consent — the arm chosen determines where the walk starts, never whether
the walk exists.

Chrome numbers are a closed list: UI collection counts, pagination positions, pinned-claim counts,
story beat index, the count of coverage dimensions measured. Every ratio, duration, quantile, count
of system objects, share, distance, lift, and delta is analytic. Acceptance: a crawler over the C0
twin asserts every numeric text node is either inside a chrome-classed element from that list or
carries a resolvable `AnalyticReference` of either arm — the UI-side counterpart of the Brief §5
evidence-integrity metric.

---

## 4. Annotated wireframes

Desktop assumes ≥1280 px; mobile 360–430 px. Callouts explain component placement and **what data
binds where**.

### 4.1 S1 — Evidence Atlas (home) · `UX-EA` *(proposed)*

```text
DESKTOP (Atlas vision — §2.1 governs what actually ships first) ──────────────────
┌────┬──────────────────────────────────────────────────────────────┬───────────┐
│ ①  │ ② <alias> · lens: integration latency ▾            ③ [Pins 2]│ ⑨ OPEN    │
│rail│    window [2026-W05, 2026-W31)  baseline [2025-W31, 2026-W05)│ QUESTIONS │
│ EA ├──────────────────────────────────────────────────────────────┤ ⑩ ? OPN   │
│ TM │ ④ COVERAGE STRIP · 12 dimensions · no total                  │  evidence │
│ CR │  perm ▓▓▓▓░ compl ▓▓▓░░ elig ▓▓▓▓░ fresh ▓▓▓▓▓               │  _gap ×4  │
│ DM │  cens_free ▓▓░░░ consist ▓▓▓▓▓ samp ▓▓▓░░ divers ▓░░░░       │  contra-  │
│ PL │  parser n/a  compar ▓▓▓▓░  drift_stab n/a  calib n/a         │  diction  │
│ EC │  [limiting: parser_coverage, sample → see coverage]          │  ×1       │
│ CC ├───────────────┬───────────────┬───────────────┬──────────────┤  untested │
│ QL │ ⑤ STRUCTURE   │ ⑤ CHANGE      │ ⑤ FLOW        │ ⑤ FEEDBACK   │  _alt ×2  │
│ SS │ DET ▤ 42 mods │ DET ▤ mix     │ DET ▤ 0.60    │ DET ▤ mix    │           │
│    │ LIM ▨ ×2      │  ▁▃▅▂▁ ⧅gap   │ ⟩ 4 censored  │ CTR ✕ 1      │ ⑪[surprise│
│    │ parser 38%    │ W12–W14       │ LIM ▨ ×1      │ stale 31h    │   me →]   │
│    ├───────────────┴───────────────┴───────────────┴──────────────┤           │
│    │ ⑫ FINDINGS — ordered by evidence relevance to this lens      │           │
│    │    [ show contradicting evidence ]   [ show sensitivity ]    │           │
│    │ ⑥ SINCE LAST RUN · 3 claims superseded · 1 correction        │           │
│    │ ⑦ [cov.absent-panel] cap.github.deployments · never_authorized│           │
│    │ ⑧ [ Narrate this era → S10 ]        [ Compare eras → S6 ]     │           │
└────┴──────────────────────────────────────────────────────────────┴───────────┘
```

① Rail — **only staged surfaces render** (§2.1). The nine shown here are the Atlas vision, not first
ship: at `DL-VALUE-01` the rail carries the Cockpit, the one comparative Atlas panel, and (once the
first finding is accepted) the deterministic Story. Fixed order, non-color current indicator (left bar
+ bold weight); an unbuilt surface is absent, never a greyed or placeholder item.
② Scope header binds repository or portfolio **alias** only (the identity vault never reaches the UI)
and renders the **lens** — the question being asked — beside **both** windows: the current window and
the baseline it is read against, each half-open `[start, end)` and each echoed verbatim into every
claim opened here (§2.2). A current window with no baseline is not a valid entry state.
③ Pin tray (§6.3), max 4, persistent.
④ Binds `GET /api/v2/coverage` → the twelve ADR-02 dimensions (§3.4.1); each `number | null`, with
`null` rendering `n/a` plus its `limiting_reason` — never an empty bar, never 0. Every dimension is
higher-is-better, so a short bar always means less coverage and never the reverse. The strip names the
limiting dimensions and deliberately shows **no aggregate** (C-4).
⑤ Four tiles from `GET /api/v2/features`, each rendering its own deterministic floor — Structure:
`DL.ARCH.CYCLE.v1` + composition; Change: `DL.CHANGE.INTENT_MIX.v1`, `DL.REL.CHANGE_BATCH.v1`; Flow:
`DL.FLOW.ISSUE_PR_RELEASE_RATIO.v1`, `DL.PR.INTEGRATION_DURATION_H.v1`; Feedback:
`DL.CI.OUTCOME_MIX.v1`, `DL.CI.RECOVERY_TRANSITION_RATIO.v1`. Every figure is analytic (VG-R1).
**Structure carries `DET`, not `OBS`:** `42 mods` is a parser-derived count — a deterministic claim
computed over observations, not a field anybody saw — so it renders `DET ▤` with its
`parser_coverage` limitation on the tile face (`parser 38%`, `LIM ▨ ×2`).
⑥ Correction lane: claims with non-null `superseded_by` since the last run plus `lineage_event` kind —
ADR-11's "history is never rewritten", made visible; run and claim-version times render at ISO-week
grain (C-11). ⑦ A capability that would fill a tile renders
`cov.absent-panel` **inside the tile grid**, keeping the grid the same size: the missing thing occupies
space. ⑧ The only two calls to action; neither recommends anything about the system. ⑨–⑩ Open Questions
rail (ADR-24) grouped by `kind`; counts are chrome, rows analytic. ⑪ "Surprise me" runs the
coverage-weighted walk with its deterministic seed displayed.
⑫ Findings are ordered by **evidence relevance** to the selected lens and window pair — how directly
the evidence bears on the question asked. **No blended engagement, interest, importance, severity, or
priority weight orders this list**, and no such composite exists to be exposed (C-4, §2.2).
`show contradicting evidence` and `show sensitivity` are surface-level controls: contradiction and
robustness are readable without opening a single Drawer.

```text
MOBILE ───────────────────────────
┌─────────────────────────────────┐
│ ② <alias> · lens: integ latency │
│   now [W05,W31) base [W31,W05)  │
│ ④ COVERAGE  limiting: parser    │
│   [9 of 12 dimensions measured] │
│   ⓐ tap → full vector sheet     │
├─────────────────────────────────┤
│ ⑤ STRUCTURE  DET ▤ 42 · LIM ▨×2 │
│ ⑤ CHANGE     DET ▤ ▁▃▅▂▁ ⧅W12-14│
│ ⑤ FLOW       DET ▤ .60  ⟩4 cens │
│ ⑤ FEEDBACK   DET ▤  CTR ✕1      │
│ ⑫ [contradicting] [sensitivity] │
├─────────────────────────────────┤
│ ⑦ cap.github.deployments        │
│    never_authorized  [Cockpit →]│
│ ⑨ OPEN QUESTIONS (7)         →  │
│ ⑧ [Narrate this era]            │
├─────────────────────────────────┤
│ ⓑ EA  CC  SS   ⋯ (staged only)  │
└─────────────────────────────────┘
```

ⓐ The vector does not collapse to one number on mobile either; it collapses to *how many dimensions
are measured* (a count, i.e. chrome) plus the limiting code — never to an average of the twelve.
ⓑ The rail sheet lists **only the staged surfaces** (§2.1), in the §2.3 order, and grows as producers
land; it never lists an unbuilt surface, so the sheet is not a ten-item promise.
⑫ Both evidence controls survive the breakpoint: contradiction and sensitivity are not desktop
luxuries. **Degraded:** if every tile is blocked the grid renders four
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
│    │    claim state: limited (§6.5)    │                                      │
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
⑥ Continuity/split/merge is **modelled** (ADR-07): hexagon, dashed, **claim state**
(`eligible` / `limited` / `abstained`) plus the match's numeric uncertainty interval — never a
low/medium/high confidence band (C-4) — and a Drawer path to the matching method and its planted
split/merge fixture. If the match misses its floor the card **abstains** (`cov.abstention-card`); it
never re-renders as a `DET` structural fact, and any deterministic fallback (e.g. exact-path identity)
is a separately defined claim with its own method and its own `claim_id` (§6.5).
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
│    │ ⑤ RELEASE BATCHES        DET ▤    │ ⑦ COUPLING WAVES            DET ▤     │
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
⑤ `DL.REL.CHANGE_BATCH.v1` on first-parent intervals; each tick analytic. The lane carries `DET`, not
`OBS`: a batch size is a **count over** observed merges walked along a computed first-parent chain, so
it is a deterministic claim even though every input is an observation. ⑥ The trailing open
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
② Edge badges are audited per edge, not per lane: `closes` and `merge` are fields the provider
reported, so they render `OBS`; `release_ancestor` is **computed** by walking the commit graph, so it
renders `DET`. Both draw solid line work — the line encodes "not suggested", the badge encodes the
layer, and the two are independent channels.
③ `suggested_assoc`, `revert_candidate`, `backport_candidate` are modelled → dotted, badge, calibrated
**uncertainty interval** (never a low/medium/high band, C-4), alternatives, falsifier in the Drawer.
A suggested edge that misses its floor **abstains** and the lane shows no edge at all; it is never
redrawn as a solid observed or deterministic edge.
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
│ ② i-118  OBS ■ closes · DET ▤   │
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
│rail│ ① ERA A [E-2025H2 ▾]  ⇄  ② ERA B [E-2026H1 ▾]  ③ MATCHED_PARTIAL        │
│    │   origin: accepted change-point c-1     origin: user annotation           │
│    │   matched fraction 0.62 of eligible weeks · unmatched weeks excluded      │
│    ├───────────────────────────────────┬──────────────────────────────────────┤
│    │ ④ ERA A                           │ ④ ERA B                              │
│    │   modules 31 · SCC 2              │   modules 42 · SCC 3                 │
│    │   API total 214                   │   API total 261                      │
│    │   intent mix ▓▒░                  │   intent mix ▓▓▒                     │
│    │   flow ratio 0.48 (observed)      │   flow ratio 0.60 (observed)         │
│    │   parser_coverage 0.61            │   parser_coverage 0.38  ⑤ LIM ▨      │
│    ├───────────────────────────────────┴──────────────────────────────────────┤
│    │ ⑥ WHAT MATERIALLY CHANGED — deterministic diff over matched subwindows   │
│    │   DET ▤ +11 modules      DET ▤ +47 public declarations                   │
│    │   MOD ⬡ 2 continuity splits, 1 merge (claim state: limited)              │
│    │   LIM ▨ selection bias — arithmetic covers matched subwindows only       │
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
③ The comparability gate runs *before* the diff renders and has **three outcomes, never two** —
there is no PASS/FAIL binary on this surface, because a binary forces a real middle case into one of
two lies ("fully comparable" or "nothing can be said"):

| Outcome | What the arithmetic does | What the UI must show |
|---|---|---|
| `FULL` | Diff runs over the whole of both eras | The diff, its `DET` badges, and the instrument key (bundle, config revision) both eras share |
| `MATCHED_PARTIAL` | Diff runs **only over subwindows proven instrument-matched** — same parser bundle major, same config revision, same capability set — and never over the remainder | The **matched fraction** (here `0.62` of eligible weeks) beside the diff, plus a standing **selection-bias limitation**: the matched subwindows are not a random sample of either era, so the diff describes the matched part and is not generalised to the whole. Unmatched subwindows render `cov.incomparable-seam` in place and are counted, never dropped |
| `INCOMPARABLE` | No arithmetic at all | Block ⑥ is replaced by a `cov.incomparable-seam` explanation naming the failed dimension; the era columns stay side by side with no delta |

The matched fraction is analytic (it resolves to a claim); it is **not** a comparability score, and no
surface renders it as a rating, a percentage-complete, or a substitute for the coverage vector.
④ Symmetric columns, identical row order, every figure independently drawer-resolvable.
⑤ Asymmetric coverage is called out on the weaker side, never averaged.
⑥ Deterministic aggregate diffs carry `DET`; continuity split/merge carries `MOD`, and the two never
share a row style, so a structural change and an inferred identity change cannot be confused.
⑦ Dimensions that cannot be compared are listed as *not compared* with their gate; omission would
imply "no change". ⑧ Enforced by the copy dictionary (C-8).
⑨–⑩ ADR-16 portfolio comparison as a distribution strip. A repository's place along the strip **is**
its measured value on the plotted dimension — a real relationship, resolvable in the Drawer — and
nothing else: repositories are never numbered, never sorted by a composite, and never positioned by
hand-tuned proximity (§3.3). **REJ:** any sorted repository ranking, including one captioned "not a
ranking".

```text
MOBILE ───────────────────────────
┌─────────────────────────────────┐
│ ① A E-2025H2  ⇄  ② B E-2026H1   │
│ ③ comparability MATCHED_PARTIAL │
│   matched 0.62 · LIM ▨ sel bias │
│ ⓕ [ A | B | Δ ] segmented       │
├─────────────────────────────────┤
│ Δ  DET ▤ +11 modules            │
│    DET ▤ +47 declarations       │
│    MOD ⬡ 2 splits, 1 merge      │
│ ⑦ not compared: intent mix      │
│ ⑨ portfolio JS 0.22 · N_eff 3.4 │
└─────────────────────────────────┘
```

ⓕ The three-state segment replaces side-by-side columns. On `MATCHED_PARTIAL` the Δ tab renders with
the matched fraction and the selection-bias limitation pinned above the first delta, so the caveat
cannot be scrolled past. On `INCOMPARABLE` the Δ tab is **disabled with an explanation**, not hidden.

### 4.7 S7 — Evidence Drawer · `UX-ED`

```text
DESKTOP — right overlay, 420–520 px, host surface stays mounted ──────────────────
                         ┌──────────────────────────────────────────────────────┐
                         │ ① HYP ◇  cl_7c31…            ✕  ⑩ [pin] [compare]    │
                         │ ② "Integration duration widened in E-2026H1"         │
                         │    method HYP.TEMPLATE.v3 · window [W05, W31)        │
                         ├──────────────────────────────────────────────────────┤
                         │ ③ WHY AM I SEEING THIS                               │
                         │   AnalyticReference → 6 edges → 14 evidence →        │
                         │   coverage → cap.github.core → consent revision v3   │
                         │   [ walk it step by step ▾ ]                         │
                         ├──────────────────────────────────────────────────────┤
                         │ ④ SUPPORTS (4)          ⑤ CONTRADICTS (1)     CTR ✕  │
                         │  ev_0a DET ▤ p90 122h    ev_0f DET ▤ batch size fell │
                         │  ev_0b DET ▤ 34 eligible        in W20               │
                         │ ⑥ COVERAGE BASIS (2)    ⑦ LIMITATIONS (3)     LIM ▨  │
                         │  ev_0c completeness .74  GH_PR_FILES_3000_CAP        │
                         │  ev_0d cens_free .82     RERUN_NOT_FLAKE · …         │
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
chain; this is the single "why am I seeing this" implementation and every surface links here. **The
resolver accepts either arm of `AnalyticReference` (§3.5):** given a `ClaimReference` the walk starts
at the claim and traverses `claim_evidence_edge` rows; given an `ObservationReference` it starts at
the observation itself. Both walks continue through coverage → capability → consent revision, so a
raw allowed fact is inspectable without a synthesised claim wrapper, and a derived number is never
inspectable without one.
④–⑦ The four edge roles that matter to a reader, each with a count. **Sections render even when
empty** ("no contradicting evidence was retrieved") — because ADR-20 mandates counter-evidence
quotas, an empty contradiction section is itself information. Layer badges are audited **per row**:
`ev_0a` (a quantile) and `ev_0b` (an eligible-subject count) are both computed, so both render `DET`
— a row renders `OBS` only when it is a provider or local field shown as observed, such as a
`merged_at` value or a capability lifecycle state. ⑥ names the coverage dimensions this claim
requires, not the whole vector (§3.4.1), and uses the canonical polarity — `cens_free .82` means the
window is 82% free of censoring.
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
│  ev_0b DET ▤ 34 eligible     →  │
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
│    │  github.core           active          C2, C1   11m / 13m    2026-W31     │
│    │  cap.local.git         previewed       —        —            —            │
│    │  cap.source.structure  card_bound      —        —            —            │
│    │  cap.github.security   never_authorized —       —            —            │
│    │  cap.external.model    never_authorized —       —            —  ② G4 note │
│    ├───────────────────────────────────┬──────────────────────────────────────┤
│    │ ③ COVERAGE VECTOR (selected cap)  │ ⑥ WHAT WOULD BE DELETED              │
│    │  permission        1.00           │  source observations     1,204 rows  │
│    │  completeness      0.74 ← limiting│  facts / features          412 / 96  │
│    │  eligibility       0.88           │  claims                         58   │
│    │  freshness         0.91           │  graph projections               3   │
│    │  censoring_freedom 0.82           │  retrieval indexes               1   │
│    │  consistency       1.00           │  packs under app control         2   │
│    │  sample            0.60           │ ⑦ leaves: a content-free tombstone   │
│    │  source_diversity  null (single)  │ ⑧ [preview deletion] [revoke]        │
│    │  parser_coverage   null (n/a)     │                                      │
│    │  comparability     1.00           │ ⑨ CANNOT BE RECALLED                 │
│    │  drift_stability   null           │  user-copied exports · provider-held │
│    │  calibration       null           │  copies · filesystem snapshots ·     │
│    │ ④ limiting reason GH_SEARCH_1000_ │  physical media                      │
│    │   CAP  ⑤ (no total, no average)   │                                      │
│    ├───────────────────────────────────┴──────────────────────────────────────┤
│    │ ⑩ TRANSITION HISTORY (lineage_event)  ⑪ gate approval performs no        │
│    │   transition — G2/G3/G4 never activate a capability                      │
└────┴──────────────────────────────────────────────────────────────────────────┘
```

① One row per capability from `GET /api/v2/capabilities`, states from the ADR-03 machine
(`never_authorized → card_bound → previewed → active ⇄ suspended → revoked`). **`last collect`
renders an ISO week (`2026-W31`), never a calendar day** (C-11); `age/horizon` is already coarser
than a week and stays in months. The same rule binds the retention clocks, the transition history in
⑩, and every export of this table.
② The G4 row states the exact approved boundary (OpenAI `gpt-5.6-luna`, C1-only, one request) **and**
that the capability remains `never_authorized`; no control here can activate it.
③–⑤ **The Cockpit is the one surface that may render all twelve ADR-02 dimensions** (§3.4.1), listed
vertically, `null` shown as `null` with its reason. All twelve are higher-is-better: `0.82` on
`censoring_freedom` means the window is 82% free of censoring, and `consistency 1.00` means the
sources agree — neither is a defect count, and no lower-is-better dimension exists. There is
deliberately **no aggregate row, no average, and no dimensions-passed percentage**: the absence of a
total is a designed feature (C-4). An individual finding elsewhere in the product still shows only
its required and limiting dimensions plus its counts — the full vector lives here, not on cards.
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
│  elig 0.88  fresh 0.91          │
│  cens_free 0.82  consist 1.00   │
│  ⓗ show all 12 dimensions    ▾  │
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

ⓗ Collapsing the twelve to the required and limiting ones is allowed; collapsing to one number is
not, in either breakpoint or any export.

### 4.9 S9 — Query Lab · `UX-QL`

```text
DESKTOP ─────────────────────────────────────────────────────────────────────────
┌────┬──────────────────────────────────────────────────────────────────────────┐
│rail│ ① PACK pack_2026W31_a1 · schema 1.0.0 · COMPLETE ✓ · checksums 14/14 ✓    │
│    │   ② [choose another pack directory]   ③ built 2026-W31 (1 week old)      │
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
enumerates the private store. ③ Build time renders as an ISO week and its age in whole weeks
(C-11) — never a calendar day and never "2 days ago", in the header or in any row the Lab exports.
Build age drives `cov.stale-ribbon` when the pack predates the current analysis. ④–⑤ Read-only schema browser plus the versioned limitation dictionary shipped
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
│    │   ●●●●●◉○○○○  ④ layer rail OBS DET DET DET DET DET DET MOD HYP OPN        │
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
lists all ten beats with their layers, so the arc is legible before it is walked; when B10 resolves
to the no-open-question ending the map shows that ending in the tenth slot rather than an `OPN`
promise the story cannot keep. ③ Exit returns to
the Atlas with the era still pinned. ④ The layer rail is the story's spine: the reader sees the
ladder being climbed and sees when a beat has abstained (the rail shows `ABS`). Only B1 carries
`OBS` — window bounds and capability states are observed; B2's counts and B3's coverage mix are
computed, so both carry `DET` (§5). A beat's rail token is never softened: an abstained modelled
beat shows `ABS`, never the `DET` of a nearby deterministic beat.
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
question`, and it **ends on the honest state of the evidence**: an open question when a genuine one
exists, and an explicit no-open-question ending when none does (B10). There is no summary beat, no
score, no superlative.

| # | Beat | Layer | Binds to | Abstains when | Framing rule |
|---|---|---|---|---|---|
| B1 | **Where we are looking** | observed | scope alias, window `[start,end)`, baseline window, active capabilities | never | States what is *excluded* as prominently as what is included; no claim is made yet. The only genuinely `OBS` beat: capability states and window bounds are observed, not computed |
| B2 | **What was seen** | deterministic | `source_observation_*` counts, `DL.COV.COMPLETE_RATIO.v1` | never | Counts are system objects, not output; no per-unit-of-time framing. **`DET`, not `OBS`** — a count over observations is a deterministic claim; the individual observations behind it stay `OBS` in the Drawer |
| B3 | **What is missing** | deterministic (coverage) | coverage ledger, `CoverageStatus` mix, limitation codes | never — this beat cannot be skipped | Missing evidence gets a full beat of the same size as any other; absence is content. The `CoverageStatus` **mix** is a computed share, so the beat carries `DET`; each underlying lifecycle state resolves to its own `OBS` record |
| B4 | **How change arrived** | deterministic | `DL.PR.INTEGRATION_DURATION_H.v1`, `DL.REL.CHANGE_BATCH.v1` | <5 eligible PRs / <3 intervals | Durations are queue/system properties; "fast" and "slow" are never goods |
| B5 | **What the machines said back** | deterministic | `DL.CI.OUTCOME_MIX.v1`, `DL.CI.RECOVERY_TRANSITION_RATIO.v1` | <10 eligible attempts | Rerun ≠ flake; failure ≠ poor quality — both sentences appear in the beat |
| B6 | **What moved together** | deterministic | `DL.ARCH.TEMPORAL_COUPLING.v1`, ADR-09 waves | support gate unmet | Association, never dependency, ownership, or design quality |
| B7 | **How the shape changed** | deterministic (+ modelled inset) | ADR-07 era diff, `DL.ARCH.API_SURFACE_DELTA.v1` | `INCOMPARABLE` → the beat becomes "these eras cannot be compared, and here is why"; `MATCHED_PARTIAL` → the beat renders the matched-subwindow diff with its matched fraction and selection-bias limitation | Structural deltas are described, never graded; continuity is a modelled inset with its own badge |
| B8 | **A pattern worth naming** | modelled | ADR-17 change-point / motif candidates | <52 weekly observations, or `coverage_shift_candidate` → "the instrument moved". The beat **abstains**; it does not fall back to a deterministic reading of the same series | The coverage alternative is named in the same breath as the pattern |
| B9 | **One interpretation — and its counter** | hypothesis | ADR-21 composer output with counter-evidence quota | any coverage floor unmet → **abstains**, never demoted to `DET` | Hypothesis and counter-hypothesis render as **equal-weight siblings**, same size, side by side; neither is styled as the conclusion |
| B10 | **A question to carry forward — or an honest ending** | question, **or** the no-question ending state | ADR-24 `question` claim + cheapest resolving evidence | never skipped, but **conditional in content** (see below) | The story ends here: no action item, no recommendation, no next-step nudge — and no invented question |

**B10 is conditional, and inventing a question is a defect.** The beat renders an ADR-24 `question`
claim **only when a genuine open question exists** — a real evidence gap that a named, costed
collection would close; a live contradiction between sources; or an untested alternative that the
current evidence cannot separate from the reading on screen. When the registry holds no such
question for this era, B10 renders the **no-open-question ending state**:

> **No unresolved question under the current evidence.** Nothing in this era's claims is contradicted,
> and no alternative reading survives the evidence collected. This is a statement about the evidence,
> not about the system: a later collection may open a question that does not exist today.

The ending state keeps B10's full visual weight and the story's beat count. It carries a link to the
Open Questions Observatory (which will legitimately be empty for this era) and to the Cockpit, so the
reader can see *why* nothing is open.

A question **may not be synthesised from a coverage gap alone.** A coverage gap becomes a B10 question
only when closing it would change a claim on screen — the gap must be attached to a specific claim, a
specific dimension below its floor, and a costed resolving action. A gap with no claim depending on it
is coverage information, already told honestly in B3, and re-dressing it as a question is filler. The
same bar applies to the Observatory's harvest: an abstention becomes a question only when its floor
is nameable and its lift is costed.

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
7. The last thing the reader sees is either a question they could answer, with its cost class, or the
   plain statement that no question is open under the current evidence — curiosity without obligation
   and **without fabrication**. A manufactured question would be a recommendation in disguise, and it
   would teach the reader that the product's questions are decoration rather than evidence.

---

## 6. Interaction rules

### 6.1 Filtering

- Filters are the API's allowlisted set (canonical §11): current window, baseline window, repository
  alias, capability, finding/claim family, layer, **evidence status**, feature ID. **No free-form
  predicate builder** outside the Query Lab, which operates on the pack rather than the store.
- **Ordering is not a filter, and it is not a weight.** Findings order by evidence relevance to the
  selected lens and window pair (§2.2). No control, URL parameter, or stored preference selects an
  ordering by engagement, interest, importance, severity, or priority, and no such composite is
  computed anywhere in the view model — a sort key is a scalar, and a blended sort key is the scalar
  C-4 forbids wearing a different hat.
- **`show contradicting evidence`** and **`show sensitivity`** are surface-level controls, not
  filters: they *add* information rather than removing rows. The first reveals the `contradicts`
  edges of the findings on screen; the second re-renders each finding against its stated robustness
  checks. Neither ever hides a finding, and both persist across surface navigation.
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
- Pinning runs the comparability check immediately and shows its **three-valued** outcome —
  `FULL` / `MATCHED_PARTIAL` / `INCOMPARABLE` — **before** navigation, so the result is attributable
  to the pin rather than to the comparator.
- A `MATCHED_PARTIAL` pair carries its matched fraction on the pin itself, so the reader knows before
  navigating that any arithmetic will cover only the instrument-matched subwindows.
- An `INCOMPARABLE` pair may still exist: the eras render side by side with arithmetic disabled and
  `cov.incomparable-seam` naming the failed dimension.
- Era pins survive surface navigation and are echoed in the System Story subject line.

### 6.3 Claim pinning and comparison

- The tray holds up to 4 claims (**A-UX-3**: a legibility budget, reversible by measurement).
- Comparison renders claims × (layer, claim state, required and limiting coverage dimensions,
  limitations, alternatives). **No composite score column and no confidence-band column may exist in
  that matrix** — either is the readmission path for the scalar C-4 forbids.
- Claims of different layers may be pinned together; the comparison labels the mismatch rather than
  normalising it.
- If a pinned claim is superseded mid-session, the tray shows the correction inline (`superseded_by`
  + `lineage_event`) and keeps the old claim visible. History is not rewritten.
- Pins are exportable only through the ordinary pack/export path with its preview and acknowledgement.

### 6.4 "Why am I seeing this"

- Present on **every** analytic figure, badge, and coverage-furniture element: a visible control on
  hover/focus on desktop, an always-visible `why?` affordance on mobile.
- Resolves the single ADR-01 walk from the element's `AnalyticReference` (§3.5): a `ClaimReference`
  walks `claim_id` → `claim_evidence_edge` rows → evidence → coverage record → capability → consent
  revision; an `ObservationReference` starts at the observation and joins the same chain at its
  coverage record. Each hop is displayed and individually openable.
- If a hop fails to resolve, the Drawer renders a **data-quality finding** naming the broken hop and
  the arm that failed, and the invoking figure is demoted to chrome on the next render (VG-R1's
  enforcement path).
- Keyboard: `?` on a focused analytic figure opens the Drawer directly at that section.

### 6.5 Abstention rendering, and what a failed modelled claim does

- An abstention is a **claim with `layer = abstention`** (ADR-01) and occupies a claim-shaped card of
  ordinary size — never smaller, never grey-only, never collapsed by default.
- The card states, in order: what was attempted (claim family), which dimension fell below its floor
  and by how much, what the floor is, and what would lift it (ADR-24 cheapest resolving evidence with
  its cost class).
- Monotone abstention (ADR-02) is made visible: the card says that no other dimension can compensate,
  so a reader cannot expect a different dimension to make up for the missing one.
- Abstentions are countable and filterable; the Open Questions Observatory harvests them, so an era
  full of abstentions is a legible fact about coverage rather than a silence.

**A modelled claim that misses its floor abstains. It does not degrade to deterministic.**

- There is no "degrade", "downgrade", "fall back to DET", or "render the deterministic version
  instead" path for a modelled claim. Missing a floor means the modelled claim has **no output**: it
  renders `cov.abstention-card` and its number does not appear anywhere on the surface.
- A **deterministic fallback is a different claim**, not the same claim in a lower costume. Where a
  family wants one, it is defined separately in the registry with its own method, its own inputs,
  its own floors, and its own `claim_id`; it renders under that identity with `DET` styling because
  it *is* deterministic, and it renders whether or not the modelled claim abstained. Two claims, two
  IDs, two Drawer walks — never one claim that changed layer.
- **Model output never inherits deterministic styling.** No code path maps a `modelled` row to
  `vg.layer.derivation` (§3.3); the layer→style function is total over the enum and the modelled arm
  has exactly one image.
- Claim state is **`eligible` / `limited` / `abstained`** — three values, rendered as text beside the
  claim, with the coverage vector's required and limiting dimensions visible. There is **no low /
  medium / high confidence band** on any card, tooltip, legend, table column, story beat, or export
  (C-4). A modelled claim may render a numeric uncertainty interval; an interval with units is not a
  band label, and the two are never substituted for one another.
- Acceptance: a fixture drives one modelled family below its floor and asserts (a) an abstention card
  renders, (b) no `DET`-styled node carries that claim's ID, (c) any deterministic fallback that
  renders carries a *different* `claim_id`, and (d) no node in the DOM matches a
  low/medium/high confidence label.

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
| **B1** | ADR-04 §7 smallest vertical slice = the `DL-VALUE-01` analytical value slice | **S8** (coverage half) + **S7** (one claim end to end) + **one comparative S1 panel** (one lens, current vs baseline window) + **S10 deterministic beats** once the first finding is accepted — and nothing else (§2.1) | `/api/v2/coverage`, `/api/v2/features`, SPINE-01…03 | V2 routes stay unlinked from primary nav until the UX acceptance card passes; the legacy dashboard remains the landing surface |
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
6. **Stage order is surface order, not shell order.** This table is a sequence of surfaces becoming
   real as their producers land; it is not a licence to scaffold all ten routes at B1 and fill them
   later. Until `DL-VALUE-01` ships, the only navigable V2 destinations are the four in §2.1. A route
   that exists but cannot render a claim is worse than an absent route: it reads as a coverage
   failure of the system under study rather than as an unbuilt part of the product.

---

## 8. Accessibility and delight

### 8.1 Keyboard paths

| Path | Behaviour |
|---|---|
| `Tab` order | Skip link → scope header (alias, lens, current window, baseline window) → coverage strip → evidence controls → findings → rail. The rail is late deliberately: orientation before navigation. |
| Rail | Roving tabindex; `↑`/`↓` move, `Enter` activates. The rail holds **only the staged surfaces** (§2.1) in a fixed order, so it is memorisable at every stage and never contains an unreachable item. |
| Evidence controls | `c` toggles `show contradicting evidence`; `s` toggles `show sensitivity`. Both announce their new state and the number of marks added, never removed. |
| Analytic figures | Focusable; `Enter`/`Space` open the Drawer; `?` opens it directly at "why am I seeing this". |
| Drawer | Focus moves to the drawer heading on open, is trapped while open, and **returns to the invoking element** on close; `Esc` closes. |
| Timelines / spines | `←`/`→` step one snapshot or week; `Home`/`End` jump to the ends; `Shift+←/→` extends a range; `p` pins the focused era or claim. |
| Story | `←`/`→` or `n`/`p` move beats; `m` opens the beat map; `Esc` exits to the Atlas with the era pinned. |
| Comparator | `[` / `]` switch the focused era; `d` focuses the diff block, its matched-fraction notice (`MATCHED_PARTIAL`), or its refusal explanation (`INCOMPARABLE`). |
| Global | Single-letter shortcuts are disabled while a text input has focus, are listed on one shortcuts sheet, and can be turned off entirely in one setting. |

Every graph, river, ECDF, and spine has an equivalent **table view** reachable by keyboard and exposed
to assistive technology by default — §4.2 ⓒ is the pattern. Charts are labelled regions with
`aria-describedby` pointing at a text summary generated from the same claim, so the description and
the drawn mark cannot diverge. Claim announcement template: `"<layer prefix>. <statement>. State
<eligible|limited|abstained>. <n> supporting, <n> contradicting. Coverage limited by
<limiting dimensions>. <n> limitations. <Question: <falsifier>. | No open question.>"` — layer always
first, state next, and the question slot always last, rendering the plain "No open question" clause
rather than being dropped when the claim has none. The announcement never speaks a confidence band
and never speaks an aggregate coverage number, because neither exists.

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
  answering one is the product's sense of progress, replacing streaks entirely. **An empty list is a
  legitimate, non-failing state** and reads as "no unresolved question under the current evidence" —
  the Observatory never manufactures a question to avoid looking empty, and no coverage gap is
  promoted to a question unless a claim on screen depends on closing it (§5, B10).
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
| `UX-VG` | grammar tokens | Grayscale render distinguishes all seven; layer→style mapping is total over the enum, with the modelled arm mapping to exactly one image; the VG-R1 crawler passes on the C0 twin with both `AnalyticReference` arms; no low/medium/high confidence label exists in the DOM |
| `UX-STAGE` *(proposed)* | staging contract (§2.1) | At `DL-VALUE-01` exactly four destinations are navigable; no route, rail item, or placeholder page exists for an unstaged surface; a crawl of the shipped nav finds no destination that cannot render a claim |
| `UX-EA` *(proposed)* | Evidence Atlas | Renders with zero active capabilities; entry shows alias, lens, current window **and** baseline window; coverage strip shows all twelve dimensions with nulls and reasons; findings order by evidence relevance and the view model contains no blended engagement/importance/priority weight; `show contradicting evidence` and `show sensitivity` present on both breakpoints; no aggregate score anywhere in the DOM |
| `UX-TM` | Time Machine | An incomparable pair produces a seam, not a delta; the `parser_coverage` panel lists abstained languages; a below-floor continuity match abstains rather than rendering as `DET` |
| `UX-CR` | Change River | `unknown` always drawn; sub-gate weeks render gap bands; no share sums across a gap; the release-batch lane carries `DET`, not `OBS` |
| `UX-DM` | Delivery Map | Suggested edges excluded from the flow ratio; supersession renders a correction; censored tails counted; `closes`/`merge` render `OBS` while the computed `release_ancestor` renders `DET` |
| `UX-PL` | Pattern Lens | Coverage series co-plotted by default; `coverage_shift_candidate` demoted but visible; the deterministic rung renders with models off, under its own claim ID rather than as the abstained modelled claim |
| `UX-EC` | Era Comparator | Comparability resolves to `FULL` / `MATCHED_PARTIAL` / `INCOMPARABLE` and no PASS/FAIL binary exists; `MATCHED_PARTIAL` computes only over proven instrument-matched subwindows and renders the matched fraction plus the selection-bias limitation; `INCOMPARABLE` disables arithmetic; "not compared" dimensions listed; no ranking and no normative comparatives |
| `UX-ED` | Evidence Drawer | The ADR-01 walk resolves end to end from **either** `AnalyticReference` arm; an empty contradiction section renders with text; an unresolvable reference yields a data-quality finding; the card shows required and limiting dimensions, never the full vector |
| `UX-CC` | Cockpit, coverage half | Twelve dimensions with nulls and reasons, all higher-is-better and canonically named (`censoring_freedom`, `consistency`, `drift_stability`, `eligibility` present); no aggregate row exists; `last collect` and every retention/transition timestamp render at ISO-week grain or coarser |
| `UX-PC` | Cockpit, privacy half | Deletion preview enumerated from the schema registry; approval-≠-activation statement present; cannot-recall disclosure always visible |
| `UX-QL` | Query Lab | A failed checksum refuses to open; no network request during a query; the pack header renders an ISO week and a whole-week age; the degraded copyable-SQL mode passes the same acceptance |
| `UX-SS` | System Story | Exactly ten beats with the declared layer arc; B2/B3 carry `DET` for their counts and mixes; abstention beats keep full weight; **B10 renders a registry-backed question when one exists and the "No unresolved question under the current evidence" ending when none does — a fixture with no open question must produce the ending state, never a generated question**; no auto-advance in either motion setting |

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

- **A-UX-1.** The Atlas vision converges on ten rail items, with Open Questions as a panel plus a
  route rather than an eleventh. This is the *destination*, not the shipped rail: §2.1 governs which
  of them exist at any moment. Reversal: promote the Observatory to the rail if it becomes a primary
  destination.
- **A-UX-6.** Rail-item count is a function of stage, not a fixed ten (§2.1). Reversal: if every
  evidence producer lands, the rail converges on the §2.3 order.
- **A-UX-7.** `MATCHED_PARTIAL` matching is proven at subwindow granularity (parser bundle major,
  config revision, capability set). Reversal: if subwindow matching proves too coarse to be
  meaningful, collapse the middle case back into `INCOMPARABLE` — never into `FULL`.
- **A-UX-2.** `abstention` uses existing tokens rather than an eighth. Reversal: add `vg.meta.abstention`.
- **A-UX-3.** Pin tray capacity 4; era pins 2. Reversal: measurement on the synthetic corpus.
- **A-UX-4.** Ten story beats — ADR-23 says "guided System Story" without a count. Reversal: beats are
  a registry, not code.
- **A-UX-5.** Beat B7 carries a modelled continuity inset, bending "one layer per beat" into a labelled
  inset. Reversal: split into B7a/B7b for eleven beats.
