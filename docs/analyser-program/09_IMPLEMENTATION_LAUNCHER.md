# Implementation Launcher

Transient pointer — contains no policy, architecture, or gate text of its own.
Reconciled 2026-08-05 after R4 wave 1. R1–R3 remains complete (12/12 cards); **DL-LIFE-01** and
**DL-EVQ-03** are now DONE, leaving **DL-LIFE-02** as the only `horizon:active` card. Evidence and
the execution decision live in [`../IMPLEMENTATION_LEDGER.md`](../IMPLEMENTATION_LEDGER.md).

**Exact next action — finish DL-LIFE-02 in two reviewable slices without weakening its acceptance.**

1. **Slice A — registered SQLite graph.** Build a fail-closed registry-derived planner over the
   existing incremental + claim tables. Derive children-before-parents order, prove the current
   `NO ACTION` seam, transaction rollback, idempotence, a missing-lineage canary, and a content-free
   tombstone on invented in-memory rows. Require class-appropriate, domain-separated tombstone
   `subject_id`/`caused_by` values and prove a caller cannot retain a C2/C3 alias through either
   field. Keep the result explicitly incomplete: no production caller and no claim that V2, legacy
   tables, filesystem packs, backups, caches, or indexes are covered.
2. **Slice B — complete the declared deletion domain.** Add the scope-binding migration and C2
   retention sweep required by issue #80, then explicit fail-closed adapters for V2 and every
   app-controlled filesystem/index descendant named by the card. Only this slice may make the
   whole-card cascade claim, close the relevant #80 conditions, or unlock sensitive connectors.
3. Each slice gets its own exact-base proof, adversarial review, hosted gate, aging window, merge,
   and state update. Use invented fixtures only; never inspect real/generated data, and never claim
   physical erasure or provider-held-copy deletion.

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
