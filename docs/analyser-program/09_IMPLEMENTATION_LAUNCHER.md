# Implementation Launcher

Transient pointer — contains no policy, architecture, or gate text of its own.
Reconciled 2026-08-04 after R1 wave 2 (DL-SPINE-02, DL-SPINE-03, DL-UX-ED, DL-FINDING-01 and
DL-COMPARE-01 merged, completing the spine lanes and the analytics-core contracts; evidence in
[`../IMPLEMENTATION_LEDGER.md`](../IMPLEMENTATION_LEDGER.md)).

**Done, no longer next cards:** the whole analytics-core kernel except the last two, merged across
R1 waves 1–2: **DL-BRIDGE-01** (PR #72, the V2 bootstrap seam + Coverage Cockpit per ADR-04 in
[`01_REFERENCE_ARCHITECTURE.md`](./01_REFERENCE_ARCHITECTURE.md)), **DL-METRIC-01** (PR #75, the
versioned metric registry), **DL-SPINE-02** (PR #84, deterministic claim canonicalisation +
replay), **DL-SPINE-03** (PR #85, why-am-I-seeing-this resolver), **DL-FINDING-01** (PR #88, the
finding contract + AnalyticReference), **DL-COMPARE-01** (PR #89, matched-period comparison +
censoring), and **DL-UX-ED** (PR #87, the Evidence Drawer). None of these proved the analytical
product thesis; **DL-VALUE-01** still does.

**Exact next implementation card** — the conformance instrument, then the value slice:

1. **DL-VALIDATE-01** — the analytical conformance and counterexample suite; **in flight now**. Its
   remit folds in the two tracked [#82](https://github.com/Chris0Jeky/developer-lens/issues/82)
   metric-result-hardening items — **N1** (the sample-dimension-on-empty-cohort question) and
   **M-a / M-b / M-c** — which are settled here before the value slice.
2. **DL-VALUE-01** — the final active-horizon card and the point of the programme: the first
   deterministic comparative finding across matched windows, censoring-aware, with contradiction,
   limitations, and sensitivity. Blocked only on DL-VALIDATE-01.

The bounded queue is the `horizon:active` set in
[`07_DELIVERY_ROADMAP.md`](./07_DELIVERY_ROADMAP.md) §0a; card contracts live in the generated
starter pack
[`taskdeck/developer-lens-intelligence-platform.taskdeck.json`](./taskdeck/developer-lens-intelligence-platform.taskdeck.json)
(source of truth: `taskdeck/tools/cards.mjs`).

**Authorities to read before starting** (in this order):

1. `AGENTS.md`, `.agent-harness/tier.json`, `HUMAN_TODO.md`
2. `docs/analyser-program/CURRENT_STATE.md` (compact state), then
   `docs/IMPLEMENTATION_LEDGER.md` (exact resume point)
3. `docs/data-charter.md`, `docs/source-capability-matrix.md`
4. `docs/DEVELOPER_LENS_V2_ARCHITECTURE.md` (stable design + 2026-08-04 addenda)
5. `docs/analyser-program/01_REFERENCE_ARCHITECTURE.md` ADR-04/25/26 and the card itself
