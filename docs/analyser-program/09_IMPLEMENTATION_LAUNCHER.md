# Implementation Launcher

Transient pointer — contains no policy, architecture, or gate text of its own.
Reconciled 2026-08-04 after R1 wave 1 (DL-OPS-CI-01, DL-SPINE-04, DL-SPINE-01, DL-BRIDGE-01 and
DL-METRIC-01 merged; evidence in [`../IMPLEMENTATION_LEDGER.md`](../IMPLEMENTATION_LEDGER.md)).

**Done, no longer next cards:** **DL-BRIDGE-01** (PR #72) — the V2 bootstrap slice shipped, so the
authenticated lazy `/api/v2` seam and the Coverage Cockpit exist. It proved the V2 runtime seam and
privacy boundary per ADR-04 in [`01_REFERENCE_ARCHITECTURE.md`](./01_REFERENCE_ARCHITECTURE.md); it
did **not** prove the analytical product thesis. **DL-METRIC-01** (PR #75) — the versioned
metric-definition registry, which is what unblocks the two contracts below.

**Exact next implementation cards** — the rest of the analytics-core kernel:

1. **DL-SPINE-02** — deterministic claim canonicalisation and replay proof; in flight as PR #84,
   carrying the seven binding constraints tracked in issue #81, which are also on the card itself.
2. **DL-SPINE-03** — the why-am-I-seeing-this resolver; lane open.
3. **DL-FINDING-01** and **DL-COMPARE-01** — unblocked by the DL-METRIC-01 merge; starting now.

Those lead through **DL-VALIDATE-01** to
**DL-VALUE-01** — still the value slice and the point of the programme (first
deterministic comparative finding across matched windows, censoring-aware, with contradiction,
limitations, and sensitivity). The bounded queue is the `horizon:active` set in
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
