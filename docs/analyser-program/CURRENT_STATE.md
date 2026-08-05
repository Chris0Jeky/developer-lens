# Current state (compact resume artifact — DL-CONTEXT-01)

Machine-readable summary for agent resume. Updated at every phase boundary and merge. History
lives in `docs/IMPLEMENTATION_LEDGER.md` (archive); durable decisions live in the ADRs. If this
file disagrees with Git, CI, or the ledger's live evidence, those win.

```yaml
updated: 2026-08-05
phase: 'R4 active horizon OPEN — DL-LIFE-01 and DL-EVQ-03 are merged; DL-LIFE-02 is the only active card; R1-R3 remains complete'
head: see `git log -1 origin/main` — live Git outranks the merge SHAs recorded below
merged: ['DL-OPS-CI-01 #70/6cd30d1 (+#77/08fca14)', 'DL-SPINE-04 #73/090dd48',
  'DL-SPINE-01 #74/75e7c39', 'DL-BRIDGE-01 #72/a6fcae1', 'DL-METRIC-01 #75/d1e29dd',
  'DL-SPINE-02 #84/b52c458', 'DL-SPINE-03 #85/610188c', 'DL-UX-ED #87/4c3f476',
  'DL-FINDING-01 #88/2208fcf', 'DL-COMPARE-01 #89/d407cb1',
  'DL-VALIDATE-01 #92/df59bbc', 'DL-VALUE-01 #94/c632093',
  'DL-LIFE-01 #100/41a1804', 'DL-EVQ-03 #99/cad0a11'] # R1-R3 complete; 2 of 3 R4 cards merged
active_slice: 'DL-LIFE-02 — registry-derived descendant deletion; slice A proves the registered
  SQLite graph and domain-separated content-free tombstone IDs, slice B must complete scope
  binding, the C2 sweep, and non-SQL adapters'
next_task: DL-LIFE-02 slice A first, then slice B; do not mark the card DONE or unblock sensitive
  connectors until both slices satisfy the full card and issue #80 boundary
next_value_slice: 'DL-EVQ-03 is DONE; no second value card is admitted while the deletion critical
  path remains active'
active_horizon: # <= 12, dependency-closed, horizon:active labels; 07_DELIVERY_ROADMAP.md §0a
  [DL-LIFE-02]
blockers: 'No dependency or owner gate blocks invented-fixture LIFE-02 work. Slice A alone is
  intentionally incomplete; issue #80 scope binding/sweeper and declared non-SQL adapters bind slice B.'
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
  30970482370 passed. Local combined proof at the follow-up head was 59 files/900 tests plus
  typecheck/build.
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
  - '#80 carries binding constraints on DL-LIFE-02 (open): the registered SQLite cascade is only
     slice A and must reject C2/C3 aliases in domain-separated tombstone IDs; scope binding, the C2
     sweep, and V2/filesystem/index adapters remain mandatory in slice B'
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
