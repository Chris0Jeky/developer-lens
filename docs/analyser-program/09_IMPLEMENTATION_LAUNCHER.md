# Implementation Launcher

Transient pointer — contains no policy, architecture, or gate text of its own.
Reconciled 2026-08-04 after PR #62 (owner directive; DL-RECON-01).

**Exact next implementation card:** Taskdeck card **DL-BRIDGE-01** — "V2 bootstrap slice:
/api/v2 coverage+capabilities over synthetic store + Coverage Cockpit panel" — in the generated
starter pack
[`taskdeck/developer-lens-intelligence-platform.taskdeck.json`](./taskdeck/developer-lens-intelligence-platform.taskdeck.json)
(source of truth: `taskdeck/tools/cards.mjs`; also on the seeded local board when present). The
card body carries the complete contract: question, outcome, owned paths, authority, prohibitions,
acceptance, proving checks, fixtures, rollback, demo proof.

**What this card is — and is not:** DL-BRIDGE-01 is the **bootstrap slice**. It proves the V2
runtime seam and privacy boundary (authenticated lazy `/api/v2` over an explicitly synthetic
store) and turns the caller-less V2 subsystems into a load-bearing path, per ADR-04 in
[`01_REFERENCE_ARCHITECTURE.md`](./01_REFERENCE_ARCHITECTURE.md). It does **not** prove the
analytical product thesis.

**Immediate successor (the point of the programme):** **DL-VALUE-01** — the first deterministic
comparative finding (PR integration shape across matched windows, censoring-aware, with
contradiction, limitations, and sensitivity), reached through the analytics-core contracts
DL-METRIC-01 → DL-FINDING-01/DL-COMPARE-01 (ADR-25/26). The bounded queue between here and there
is the `horizon:active` set in [`07_DELIVERY_ROADMAP.md`](./07_DELIVERY_ROADMAP.md) §0a.

**Authorities to read before starting** (in this order):

1. `AGENTS.md`, `.agent-harness/tier.json`, `HUMAN_TODO.md`
2. `docs/analyser-program/CURRENT_STATE.md` (compact state), then
   `docs/IMPLEMENTATION_LEDGER.md` (exact resume point)
3. `docs/data-charter.md`, `docs/source-capability-matrix.md`
4. `docs/DEVELOPER_LENS_V2_ARCHITECTURE.md` (stable design + 2026-08-04 addenda)
5. `docs/analyser-program/01_REFERENCE_ARCHITECTURE.md` ADR-04/25/26 and the card itself
