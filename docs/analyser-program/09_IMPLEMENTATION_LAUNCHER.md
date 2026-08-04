# Implementation Launcher

Transient pointer — contains no policy, architecture, or gate text of its own.
Reconciled 2026-08-04 after R1 wave 3 (DL-VALIDATE-01 and DL-VALUE-01 merged): the bounded
**R1–R3 active horizon is COMPLETE — all 12 active-horizon cards are DONE** (evidence in
[`../IMPLEMENTATION_LEDGER.md`](../IMPLEMENTATION_LEDGER.md), the R1 wave 3 section, including the
DL-VALUE-01 PRODUCT PROOF).

**Done — the whole active horizon.** Across R1 waves 1–3: the spine and analytics-core kernel
(**DL-BRIDGE-01** #72, **DL-METRIC-01** #75, **DL-SPINE-01..04** #74/#84/#85/#73, **DL-FINDING-01**
#88, **DL-COMPARE-01** #89, **DL-UX-ED** #87, **DL-OPS-CI-01** #70), the conformance instrument
(**DL-VALIDATE-01** #92), and the value slice that proved the analytical product thesis
(**DL-VALUE-01** #94 — the first deterministic comparative finding). There is **no next
active-horizon implementation card**; the active queue is spent.

**Exact next action — roadmap reassessment, not an implementation slice.**

1. **Reassess the roadmap.** Read [`07_DELIVERY_ROADMAP.md`](./07_DELIVERY_ROADMAP.md) §0a and
   [`CURRENT_STATE.md`](./CURRENT_STATE.md) against current capacity, the open owner gates
   (`HUMAN_TODO.md` q-6/q-7), and the still-open residual risks (#86 is a q-5 precondition; #93 is
   conformance-suite hygiene; #71/#76/#78/#79/#80 stand). Decide whether to open the **R4 stretch**
   and promote its first card into a fresh active horizon. Confirm capacity **before** promoting
   anything.
2. **Standing R4 preference — a preference, not an authorization to start.** When the reassessment
   opens R4, the recorded stretch order is **DL-LIFE-01** (the capability-lifecycle state machine
   with the approval-never-activates invariant) first, then **DL-LIFE-02** (the schema-registry
   deletion cascade, which closes most of
   [#80](https://github.com/Chris0Jeky/developer-lens/issues/80)). **R4 begins only after the
   reassessment confirms capacity** — do not start DL-LIFE-01 straight from this pointer.

**Do not unfreeze on your own.** **R7/R8 stay frozen**, and the `horizon:frozen` set in
[`07_DELIVERY_ROADMAP.md`](./07_DELIVERY_ROADMAP.md) §0a — mirrored as `frozen_until_value_slice`
in [`CURRENT_STATE.md`](./CURRENT_STATE.md) — stays frozen until the reassessment explicitly reopens
it. Owner gates in `HUMAN_TODO.md` q-6 and [`08_OPEN_QUESTIONS.md`](./08_OPEN_QUESTIONS.md) §1 are
unchanged.

**Authorities to read before starting** (in this order):

1. `AGENTS.md`, `.agent-harness/tier.json`, `HUMAN_TODO.md`
2. `docs/analyser-program/CURRENT_STATE.md` (compact state), then
   `docs/IMPLEMENTATION_LEDGER.md` (exact resume point + the R1 wave 3 horizon-exit evidence)
3. `docs/data-charter.md`, `docs/source-capability-matrix.md`
4. `docs/DEVELOPER_LENS_V2_ARCHITECTURE.md` (stable design + 2026-08-04 addenda)
5. `docs/analyser-program/01_REFERENCE_ARCHITECTURE.md` ADR-03 (capability lifecycle) and the card
   itself, once the reassessment opens R4
