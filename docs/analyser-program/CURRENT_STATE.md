# Current state (compact resume artifact — DL-CONTEXT-01)

Machine-readable summary for agent resume. Updated at every phase boundary and merge. History
lives in `docs/IMPLEMENTATION_LEDGER.md` (archive); durable decisions live in the ADRs. If this
file disagrees with Git, CI, or the ledger's live evidence, those win.

```yaml
updated: 2026-08-05
phase: 'R4 active horizon OPEN — DL-LIFE-02 slice A, B1a, and both late contract repairs are merged; the current head contains inert B1b-i and the card remains incomplete'
head: see `git log -1 origin/main` — live Git outranks the merge SHAs recorded below
merged: ['DL-OPS-CI-01 #70/6cd30d1 (+#77/08fca14)', 'DL-SPINE-04 #73/090dd48',
  'DL-SPINE-01 #74/75e7c39', 'DL-BRIDGE-01 #72/a6fcae1', 'DL-METRIC-01 #75/d1e29dd',
  'DL-SPINE-02 #84/b52c458', 'DL-SPINE-03 #85/610188c', 'DL-UX-ED #87/4c3f476',
  'DL-FINDING-01 #88/2208fcf', 'DL-COMPARE-01 #89/d407cb1',
  'DL-VALIDATE-01 #92/df59bbc', 'DL-VALUE-01 #94/c632093',
  'DL-LIFE-01 #100/41a1804', 'DL-EVQ-03 #99/cad0a11',
  'DL-LIFE-02 slice A #103/5e6304e', 'DL-LIFE-02 B1a #105/f9cc008',
  'DL-LIFE-02 B1a late repair #107/263839d',
  'DL-LIFE-02 contract correction #108/7a270f4'] # card stays active through B4
active_slice: 'DL-LIFE-02 B1b-i in the current head — isolated, caller-free, non-selectable
  storage-v3 shadow schema over all 18 dispositions; no source copy or selector'
next_task: merge the current B1b-i head, then B1b-ii authenticated rewrite, B1b-iii orchestration,
  then B2 retention/continuity/resolver and B3
  complete SQL deletion, and B4 app-owned artifacts; only the B4 state refresh may mark DONE, and
  the first real migration/connector still requires LIFE-03 plus #86 coverage remint
next_value_slice: 'DL-EVQ-03 is DONE; no second value card is admitted while the deletion critical
  path remains active'
active_horizon: # <= 12, dependency-closed, horizon:active labels; 07_DELIVERY_ROADMAP.md §0a
  [DL-LIFE-02]
blockers: 'No dependency or owner gate blocks the current invented-fixture work. Active repository
  rows in B1b-ii require explicit
  invented raw provider-ID binding input; a v2 SQLite alias pair alone must fail closed.'
open_owner_gates: 'HUMAN_TODO.md q-6 (a-h) + 08_OPEN_QUESTIONS.md §1 unchanged; q-7 (mark the
  pr-gate check required — admin; active ruleset 20425147 currently enforces deletion only) and
  q-8 (process/orphan-directory cleanup — human) remain open'
frozen_by_reassessment: horizon:frozen label (WB candidates, vector retrieval, GOV/SEC/PORT-02/
  PROV-01 sources, ATLAS-03 parsers, EVQ-09/10, TRACE-03) — 07 §0a
authority_order: [AGENTS.md, .agent-harness/tier.json, HUMAN_TODO.md, data-charter.md,
  source-capability-matrix.md, DEVELOPER_LENS_V2_ARCHITECTURE.md (incl. Appendix I.1-I.4)]
last_verified_checks: hosted PR gate green at every merged R1-R3 head above; LIFE-01 head 25326bf
  passed run 30969544413 and merged as 41a1804; EVQ-03 final head 2f1909d passed run 30969742520
  and merged as cad0a11. Exact-merge Pages runs 30969712337 and 30969909632 passed. EVQ follow-up
  head c6ff6b5 passed hosted run 30970321092 and merged as d2dfb36; exact-merge Pages run
  30970482370 passed. LIFE-02A head 8e29f9e passed hosted run 30972206800 and merged as 5e6304e;
  exact-merge Pages run 30972364522 passed. Its final local proof was 14 planner tests, 58 focused
  storage tests, and 60 files/914 tests plus context/typecheck/build. B1a head 38c85a4 passed hosted
  run 30975235029 and merged as f9cc008; exact-merge Pages run 30975430150 passed. Its final proof
  was 7 focused tests and 61 files/921 tests plus context/typecheck/build. The first late repair head
  d7acb10 passed hosted run 30976889901 and merged as 263839d; exact-merge Pages run 30977063643
  passed. Its final proof was 8 focused tests and 61 files/922 tests plus context/typecheck/build.
  The second contract correction head f05c5c3 passed hosted run 30977894384 and merged as 7a270f4;
  exact-merge Pages run 30978065710 passed. Its proof was the same 8 focused tests and 61 files/922
  tests plus context/typecheck/build. The current B1b-i head passes 24 focused tests and the full
  62-file/938-test local gate including context verification, typecheck, lint, and build; hosted and
  exact-merge evidence remain pending until publication.
capabilities: every executable capability remains never_authorized; cap.external.model uncalled
card_source: docs/analyser-program/taskdeck/tools/cards.mjs (generate with tools/generate.mjs;
  127 cards; `node generate.mjs --check` is the non-mutating drift gate; never edit the manifest
  or 07 §6 index by hand)
local_board: seeded Taskdeck board outside Git; restart runbook in untracked RESUME.md beside its
  database (06_TASKDECK_DEMO_PLAN.md §1 describes it without paths)
residual_risks:
  - 'q-7: the hosted pr-gate check stays advisory until an admin marks it required'
  - '#78 dev-credential surface (bundle-safe bearer channel, no token/path logging, port-drift-proof
     allowlist) binds before any real-data surface'
  - '#79 BRIDGE-02 must serve a PresentationView, not the canonical record shape'
  - '#80 carries binding constraints on DL-LIFE-02 (open): PR #103 covers registered SQLite slice A,
     PR #105 covers inert B1a, and PRs #107/#108 correct its late contracts; B1b-B4 remain mandatory'
  - 'B1b must enforce the corrected PR #106 contract: match scope continuity against the provider-
     domain alias, retain aliases only in expiring C2 rows, and bind index_deleted to del-'
  - 'B1b-ii must use its transient ownership map to abort mapped live lineage subjects/causes whose
     scope differs from the event scope; hard lineage FKs are forbidden because tombstones outlive subjects'
  - 'stored provider_id and analytical_key are independent domain-separated HMACs; B1b must verify
     both from an ephemeral raw provider ID or fail closed, and must never derive one alias from the other'
  - 'B4 completion only unblocks LIFE-03; a first real migration/connector also requires LIFE-03
     backup/grace/restore/tombstone-replay proof and #86 V2 alias-bearing coverage remint'
  - '#76 carries binding constraints on DL-SPINE-05: the source_diversity clamp decision,
     producer-absence limiting codes, canonical coverage-code registration'
  - '#86 coverage_id embeds the collection scope_alias and now travels inside C1 claim-graph
     identifiers (surfaced by PR #85, flagged not fixed); re-mint content-free before the q-5
     github.core real-collection runs, or record a reviewed charter decision — a q-5 precondition'
  - 'LIFE-01 transcript replay proves structural lineage only; external authenticity of opaque
     card/preview/proof digests remains a future trusted-adapter boundary, with no runtime caller'
  - 'Before the first lifecycle caller, request_revocation must suspend an active capability and
     resume must fail while revocation intent remains pending (late PR #100 review; no caller today)'
  - 'EVQ-03 retains lower-severity input-contract notes from review; post-merge feedback is triaged
     once and any confirmed correctness defect takes the smallest linked follow-up PR'
  - '#71 and #93 are closed by PRs #97 and #98 respectively'
  - 'closed this wave (R1 wave 3): #67 typed empty cohorts — four-part disposition, PRs #75/#89/#92/#94;
     #82 metric-result hardening incl. N1 — PR #92; #91 robustness-scan exemption — PR #92 (evidence in
     the ledger R1 wave 3 section)'
  - 'frozen or tracked-only: #68, #69'
```
