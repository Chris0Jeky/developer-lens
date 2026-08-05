# Implementation Launcher

Transient pointer — contains no policy, architecture, or gate text of its own.
Reconciled 2026-08-05 after DL-LIFE-02 slice A. R1–R3 remains complete (12/12 cards),
**DL-LIFE-01** and **DL-EVQ-03** are DONE, and **DL-LIFE-02** remains the only `horizon:active`
card.

**Exact next action:** implement B1a from
[`10_LIFE_02B_DECISION.md` §5](./10_LIFE_02B_DECISION.md#5-reviewable-execution-sequence), then
follow that record's B1b–B4 sequence. Slice-A evidence and the durable resume point live in
[`../IMPLEMENTATION_LEDGER.md`](../IMPLEMENTATION_LEDGER.md).

Issues #71 and #93 are closed by their separate merged hygiene PRs. They are no longer execution
lanes; any late review feedback is triaged once under the repository's post-merge rule.

**Do not unfreeze on your own.** R7/R8 and every `horizon:frozen` card remain frozen by the current
reassessment. Owner gates in `HUMAN_TODO.md` q-6 and `08_OPEN_QUESTIONS.md` §1 are unchanged; q-7
is admin-only and q-8 is human-only cleanup.

**Authorities to read before starting** (in this order):

1. `AGENTS.md`, `.agent-harness/tier.json`, `HUMAN_TODO.md`
2. `docs/analyser-program/CURRENT_STATE.md`, then `docs/IMPLEMENTATION_LEDGER.md`
3. `docs/data-charter.md`, `docs/source-capability-matrix.md`
4. `docs/DEVELOPER_LENS_V2_ARCHITECTURE.md` Appendix I and
   `docs/analyser-program/01_REFERENCE_ARCHITECTURE.md` ADR-03
5. The exact admitted card in `taskdeck/tools/cards.mjs` and its current code/tests
