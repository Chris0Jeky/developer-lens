# Implementation Launcher

Transient pointer — contains no policy, architecture, or gate text of its own.
Reconciled 2026-08-05 after the mandatory roadmap reassessment. R1–R3 remains complete (12/12
cards); the bounded **R4 active horizon is now open** with exactly three dependency-closed cards:
**DL-LIFE-01**, **DL-LIFE-02**, and **DL-EVQ-03**. Evidence and the admission rationale live in
[`../IMPLEMENTATION_LEDGER.md`](../IMPLEMENTATION_LEDGER.md).

**Exact next action — implement DL-LIFE-01.**

1. Build the pure, immutable capability-lifecycle contract and the approval-never-activates
   invariant. Keep every registry entry and the P4/P12 runners inert; do not add persistence,
   connector wiring, credential access, real-data reads, or an external request. The exact card and
   ADR-03 define the transitions and invented tamper/replay fixtures.
2. **DL-EVQ-03 is READY and disjoint.** It may advance in a separate worktree while DL-LIFE-01 is
   in flight. Preserve version ordinals and ISO-week grain; never introduce exact collection
   timestamps or raw scope aliases.
3. **DL-LIFE-02 remains dependency-blocked.** Start it only after DL-LIFE-01 merges and live base,
   issue #80, storage lineage, checks, and review evidence are refreshed. It owns schema-derived
   descendant enumeration, transactional deletion, the missing-lineage canary, and the content-free
   tombstone; DL-LIFE-01 must not pre-build those storage mechanics.

**Separate hygiene lanes.** Issue #93 (two vacuous conformance tests) and issue #71 (Pages Node 24
alignment) remain self-contained candidates. Give either its own diff, proof, PR, and review; do not
bundle it into a lifecycle or EVQ fix batch.

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
