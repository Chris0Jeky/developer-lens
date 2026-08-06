# Current state (compact resume artifact — DL-CONTEXT-01)

Machine-readable summary for agent resume. Updated at every phase boundary and merge. History
lives in `docs/IMPLEMENTATION_LEDGER.md` (archive); durable decisions live in the ADRs. If this
file disagrees with live Git or CI, those win. The ledger never overrides this artifact: it is
the historical record of how past slices were proven, and a fresh agent following it over this
file can resume deleted work (PR #127 late review).

```yaml
updated: 2026-08-05
current_slice_override: 'LIFE-02 B3 core (10_LIFE_02B_DECISION.md §5 item 4): complete v3-domain
  scope deletion in server/storage/v3Deletion.ts — one IMMEDIATE transaction over a closed
  20-table registry, child-first deletes, CAS no-delete triggers dropped and byte-identically
  recreated in-transaction, scope-unbound per-subject tombstone_cascade lineage under one del-
  operation, replay idempotence, conflict fail-closed, injected-failure rollback at every stage,
  and the WAL-checkpoint/VACUUM completion saga. Schema v3.1.0-shadow-b3 (user_version 306):
  deletion-kind lineage may be scope-unbound; continuity_cas_operation gains applied_week and a
  nullable clear-only payload receipt. CAS scope init refuses phantom scopes; the sweep clears
  receipts at the 13-month boundary; replay of a cleared receipt fails closed as
  receipt_expired. v2_coverage_record flipped to delete disposition (the v2 reader refuses v3
  stores, so the preserved copy was unreadable dead weight) — the bridge/planner workaround is
  gone and the CLI journey runs the product order: build (bridge present) -> migrate -> select
  -> CAS restart -> sweep -> delete one scope -> explain tombstones -> reopen intact.'
phase: 'R4 active horizon OPEN — B3 core delivered on fable/life02-b3-deletion. Remaining before
  LIFE-02 close: PR B-2 (#86 storage half, remaining #128/#129 discriminating verifications,
  v2_store_provenance drift, generated scale corpus + equivalence budget incl. #133) and B4
  app-owned artifacts per §5 item 5. LIFE-02/#80 remain incomplete.'
head: see `git log -1 origin/main` — live Git outranks anything recorded here
merged: ['R1-R3 cards DL-OPS-CI-01 #70, DL-SPINE-04 #73, DL-SPINE-01 #74, DL-BRIDGE-01 #72,
  DL-METRIC-01 #75, DL-SPINE-02 #84, DL-SPINE-03 #85, DL-UX-ED #87, DL-FINDING-01 #88,
  DL-COMPARE-01 #89, DL-VALIDATE-01 #92, DL-VALUE-01 #94, DL-LIFE-01 #100, DL-EVQ-03 #99',
  'DL-LIFE-02 chain PRs #103, #105, #107-#125 (slice A, B1a+repairs, B1b-i..iii, B2a-i..iii,
  B2b-i, B2b-ii-a..j) — B2b-i..ii-j artifacts were deleted by the §7 simplification;
  their engineering record stays in the ledger', 'state syncs #126']
active_slice: 'DL-LIFE-02 PR B-2 — #86 storage half (tighten incremental.ts coverage_id CHECK to
  the cov- registry + migrate alias-bearing fixtures), discriminating verification of every open
  #128/#129 finding, v2_store_provenance drift resolution, and the generated scale corpus with an
  equivalence budget (fold in the #133 remint-metadata redesign) — then B4 app-owned artifacts.
  Resolver deletion-lineage scoping decision (recorded on #80): B3 ships the v3 deletion-lineage
  reader consumed by the CLI; the whyResolver coverage/job lineage joins land with the Phase-4
  stored-observation bridge, because v2 stores carry no per-subject tombstones for such joins to
  find. Inert-code budget stays zero: every new module lands with its consumer in the same PR.'
next_value_slice: 'change-batch size vs integration tail is the selected second lens (cheapest
  honest lens: additions/deletions/changedFiles + lifecycle timestamps are already collected,
  stored in pull_request_fact, and computed by analytics.ts); it follows the stored-observation
  bridge, not another fixture module. The reachability half is done on
  fable/boundary-and-reachability: the Atlas is linked from the dashboard coverage section and its
  Evidence Drawer is /api/v2/evidence''s first client (served projection preferred, local
  composition the silent offline fallback), so the second lens extends a surface users can reach
  rather than adding another unreachable route'
active_horizon: # <= 12, dependency-closed, horizon:active labels; 07_DELIVERY_ROADMAP.md §0a
  [DL-LIFE-02]
blockers: 'None for B3. A real migration/connector still requires LIFE-03
  backup/grace/restore/tombstone-replay proof plus the #86 storage half (tighten the
  incremental.ts coverage_id CHECK to the cov- registry and migrate alias-bearing fixture
  stores); the #86 connector mint, #79 PresentationView, and #78 credential/launch surface are
  resolved on fable/boundary-and-reachability.'
open_owner_gates: 'HUMAN_TODO.md q-6 (a-h) unchanged and non-blocking; q-8 (process/orphan-directory
  cleanup — human) remains open; q-7 verified complete (Prove the pull request is required on main,
  strict mode and admin enforcement off)'
frozen_by_reassessment: horizon:frozen label (WB candidates, vector retrieval, GOV/SEC/PORT-02/
  PROV-01 sources, ATLAS-03 parsers, EVQ-09/10, TRACE-03) — 07 §0a
authority_order: [AGENTS.md, .agent-harness/tier.json, HUMAN_TODO.md, data-charter.md,
  source-capability-matrix.md, DEVELOPER_LENS_V2_ARCHITECTURE.md (incl. Appendix I.1-I.4)]
last_verified_checks: 'Every merged R1-R4 head above passed the hosted PR gate at its exact head,
  and every merge passed the exact-merge Pages/privacy run; per-slice run IDs and focused-test
  counts are recorded per slice in docs/IMPLEMENTATION_LEDGER.md. Before the simplification the
  full local gate was 77 files / 1,137 tests plus context verification, lint, typecheck, build,
  and diff checking.'
review_timing_defect: 'Measured 2026-08-05: the Codex connector consistently posts review comments
  3-10 minutes AFTER merge. The ledger sentences claiming an "empty late-comment sweep" for PRs
  #104-#125 were measured before the bot posted and are not evidence of clean reviews; 20 late
  comments across PRs #104-#112 were untriaged until the 2026-08-05 batch triage (see the linked
  tracking issues on each thread). The defect recurred the same day it was measured: PRs #127 and
  #131 merged minutes before their next Codex review, leaving four untriaged post-merge findings
  (legacy deletion-ID equivalence escape, ledger-override authority sentence, evidence-client
  validation, requested-reference binding) — all four fixed by the late-review truth-repair PR.
  Binding protocol: do not merge until the Codex review for the exact final head has arrived and
  every finding is fixed/tracked/rejected, OR 15 minutes have passed since the LAST push with a
  fresh sweep showing no new review; any fix push restarts that clock, and a later exact-head
  finding is still a finding — there is no two-rounds-means-ship exception for it. After merge,
  sweep again beyond the measured delay before calling the review clean.'
capabilities: every executable capability remains never_authorized; cap.external.model uncalled.
  Note the enforcement inversion measured 2026-08-05 - the registry literal gates only the /api/v2
  reporting surface; the real collection boundary is the ignored task card + installation key +
  the absence of any activationRunner caller (activationRunner.ts asserts the registry still says
  never_authorized and would otherwise proceed)
card_source: docs/analyser-program/taskdeck/tools/cards.mjs (generate with tools/generate.mjs;
  `node generate.mjs --check` is the non-mutating drift gate; never edit the manifest
  or 07 §6 index by hand)
local_board: seeded Taskdeck board outside Git; restart runbook in untracked RESUME.md beside its
  database (06_TASKDECK_DEMO_PLAN.md §1 describes it without paths)
residual_risks:
  - 'q-7 protection has strict=false and enforce_admins=false; repository law still forbids
     privileged merges with red or stale exact-head CI'
  - '#78 RESOLVED on fable/boundary-and-reachability: the browser holds no bearer at all (the guard
     accepts a proven same-origin Sec-Fetch triple on an allowlisted Host OR a bearer for
     non-browser callers), the launch token and importer store path are no longer printed,
     vite.config.ts pins strictPort and derives the proxy target from DEVELOPER_LENS_PORT, and the
     plain build now ends in a dist credential canary. Reviewed posture change - read that branch
     head before any real-data surface'
  - '#79 RESOLVED on fable/boundary-and-reachability: /api/v2/coverage serves
     CoveragePresentationViewSchema (status/codes, ISO-week window labels computed server-side,
     complete-only observed units, per-response row key), enforced by the strict projection schema
     plus the assertPresentationSafe key/alias canary (which checks leaked key names and the demo
     alias only — the schema is the real gate) and a direct alias-absence test;
     the canonical record is validated on the way in and never served. /api/v2/evidence grain is
     NOT in scope and stays as it was'
  - '#80 remains open: v1 deletion-seam FK decision, C2 sweeper on the live path, lineage ID class
     separation, whyResolver lineage joins. The Ed25519 low-order condition is discharged as moot
     by the §7 deletion and reattaches only if signatures return'
  - 'late Codex findings from PRs #105/#109/#110/#112 are batch-triaged into tracking issues
     #128/#129 (2026-08-05); two #109 findings were fixed directly (coverage_ledger empty-code
     CHECKs — the preserved v2_coverage_record bridge table deliberately keeps byte-parity with
     its v2 source; delete-disposition tables must be empty at acceptance), the rest await
     verification there. The PR #130 post-merge findings are FIXED by B3: phantom CAS scope
     initialization refuses (claim_scope existence rule inside the init transaction) and CAS
     payload receipts expire at the 13-month boundary via the sweep with fail-closed
     receipt_expired replay. The PR #127/#131 post-merge findings were fixed by PR #132
     (row-kind-aware equivalence classifier + shared runtime evidence contract in
     shared/whyContract.ts with requested-reference binding). Also fixed by B3 from the #128
     list: duplicate deletion identities per subject fail closed (OPERATION_CONFLICT)'
  - 'v2_store_provenance drift RESOLVED by SUPPORTING activation_card provenance: the v3 shadow
     DDL now mirrors the v2 source shape (both modes, nullable marker, opaque activation_card_id,
     same XOR CHECK), the rewrite copies either mode verbatim, and migration validates provenance
     STRUCTURE only — the ADR-04 serving refusal (V2_ACTIVATION_CARD_NOT_REVIEWED) stays on the v2
     read path via assertServableProvenance, which the rewrite no longer calls. The upcoming real
     q-5 activation_card store is therefore migratable and still unservable'
  - 'Phase-1c scale corpus landed: server/storage/v3ScalePerformance.test.ts generates a
     deterministic invented v2 source (3 scopes, ~10k commits, ~10k PR facts, ~2k dated events,
     150 jobs with per-job snapshot/coverage, 600 evidence, 600 claims, 603 lineage rows incl. 3
     legacy tombstones, C0 bridge present) and times build -> migration -> sweep -> B3 deletion ->
     reopen. Budget: 120 s total / 90 s migration; measured on one Windows dev box at 6.2-6.4 s
     total with 4.1-4.2 s migration, i.e. ~19-21x headroom — the mint-order proof is linear in
     practice, not only on paper. `npm test` runs only the always-on ~1/20 smoke lane; the full
     lane is gated on DEVELOPER_LENS_SCALE=1'
  - 'closed by the executable core: the C2 sweep now runs against a real rewrite output in
     server/storage/v3ShadowSweepIntegration.test.ts (migrate through the file factory, sweep the
     accepted store, expired cohort NULLed with its retention events, live cohort byte-identical).
     The CAS is no longer a separate database either — it is two tables inside the shadow store,
     empty at acceptance and asserted against the shadow application_id, user_version and schema
     fingerprint'
  - 'RESOLVED by B3: the bridge/planner conflict is gone at the root — v2_coverage_record is
     delete-disposition in the v3 target (empty at acceptance, asserted), the v3 deletion
     registry closes over all 20 shadow tables, and the CLI exercises bridge-present migration
     followed by selected-store deletion. The slice-A v2 planner remains only as the v2-era seam
     under its own unit tests'
  - 'graphColours refinement is super-linear in identifier count, and the acceptance-time
     fullEquivalenceShadowChecksum (PR #127) is now the dominant term because it colours every
     minted identity column across all tables; fine for fixtures, a practical hang risk at
     multi-year scale — measure and budget in PR B-2 before any real migration, folding in the
     #133 preserved-scope-id remint-metadata redesign (confirmed digest escape, reproduced
     2026-08-05)'
  - '#135 tracks eight residual semantic-coherence refinements to the evidence resolve contract
     (PR #132 round-three review) — MEDIUM defense-in-depth, natural slice when the contract is
     next touched'
  - 'B4 completion only unblocks LIFE-03; a first real migration/connector also requires LIFE-03
     backup/grace/restore/tombstone-replay proof and #86 V2 alias-bearing coverage remint'
  - '#76 carries binding constraints on DL-SPINE-05: the source_diversity clamp decision,
     producer-absence limiting codes, canonical coverage-code registration'
  - '#86 RESOLVED at the connector on fable/boundary-and-reachability: coverageId is a required
     caller input validated as cov- plus 64 lowercase hex, minted from fresh entropy by
     mintGithubCoreCoverageId() and never derived from an alias, provider id, timestamp, or range.
     The replay-determinism constraint still binds and is now the CALLER''s: a replayed job must
     supply the same (jobId, coverageId, jobStartedAt) it supplied the first time, or the storage
     payload hash changes and persistIncrementalGithubCoreTransition fails closed on
     COLLECTION_JOB_ID_COLLISION. STILL OPEN: the incremental.ts coverage_id CHECK is deliberately
     unchanged and existing fixture stores keep alias-bearing ids, so the migration remains owed
     before the q-5 github.core real-collection runs'
  - 'LIFE-01 transcript replay proves structural lineage only; external authenticity of opaque
     digests remains a future trusted-adapter boundary, with no runtime caller'
  - 'frozen or tracked-only: #68, #69'
```
