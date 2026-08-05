# Current state (compact resume artifact — DL-CONTEXT-01)

Machine-readable summary for agent resume. Updated at every phase boundary and merge. History
lives in `docs/IMPLEMENTATION_LEDGER.md` (archive); durable decisions live in the ADRs. If this
file disagrees with live Git or CI, those win. The ledger never overrides this artifact: it is
the historical record of how past slices were proven, and a fresh agent following it over this
file can resume deleted work (PR #127 late review).

```yaml
updated: 2026-08-05
current_slice_override: 'LIFE-02 executable core (10_LIFE_02B_DECISION.md §7.6): the production
  StorageV3ShadowTargetFactory and store selector (server/storage/v3StoreFiles.ts), the CAS folded
  into the shadow store as continuity_cas_state/continuity_cas_operation with an exported scope
  initializer, and the owner-controlled default-off entrypoint (scripts/storeLifecycle.ts,
  npm run store:lifecycle) driving build -> delete -> migrate -> select -> CAS restart -> sweep ->
  re-validate on invented data only. Delivered on branch fable/life02-executable-core.'
phase: 'R4 active horizon OPEN — DL-LIFE-02 executable core delivered; the next LIFE-02 work is
  B3 (complete SQL deletion on the v3 domain) and then B4 (app-owned artifacts) per
  10_LIFE_02B_DECISION.md §5. LIFE-02/#80 remain incomplete.'
head: see `git log -1 origin/main` — live Git outranks anything recorded here
merged: ['R1-R3 cards DL-OPS-CI-01 #70, DL-SPINE-04 #73, DL-SPINE-01 #74, DL-BRIDGE-01 #72,
  DL-METRIC-01 #75, DL-SPINE-02 #84, DL-SPINE-03 #85, DL-UX-ED #87, DL-FINDING-01 #88,
  DL-COMPARE-01 #89, DL-VALIDATE-01 #92, DL-VALUE-01 #94, DL-LIFE-01 #100, DL-EVQ-03 #99',
  'DL-LIFE-02 chain PRs #103, #105, #107-#125 (slice A, B1a+repairs, B1b-i..iii, B2a-i..iii,
  B2b-i, B2b-ii-a..j) — B2b-i..ii-j artifacts were deleted by the §7 simplification;
  their engineering record stays in the ledger', 'state syncs #126']
active_slice: 'DL-LIFE-02 B3 — complete SQL deletion on the v3 domain (the executable core it
  depends on is delivered), then B4 app-owned artifacts per 10_LIFE_02B_DECISION.md §5. Inert-code
  budget stays zero: every new module lands with its consumer in the same PR.'
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
     verification there. The PR #130 post-merge findings (phantom CAS scope initialization, CAS
     payload_sha256 receipt retention) are tracked on #128 as B3 promotion conditions; the PR
     #127/#131 post-merge findings are fixed by the late-review truth-repair PR (row-kind-aware
     equivalence classifier + shared runtime evidence contract in shared/whyContract.ts with
     requested-reference binding)'
  - 'v2_store_provenance drift: api/v2/store.ts declares 6 columns including activation_card_id,
     v3ShadowSchema.ts declares 5 and pins mode=synthetic, yet v3Proposal.ts calls the table
     preserve — an activation_card-mode v2 store is unmigratable (SOURCE_BRIDGE_REFUSED)'
  - 'closed by the executable core: the C2 sweep now runs against a real rewrite output in
     server/storage/v3ShadowSweepIntegration.test.ts (migrate through the file factory, sweep the
     accepted store, expired cohort NULLed with its retention events, live cohort byte-identical).
     The CAS is no longer a separate database either — it is two tables inside the shadow store,
     empty at acceptance and asserted against the shadow application_id, user_version and schema
     fingerprint'
  - 'measured by the executable-core slice and binding on B3: planRegisteredGithubCoreDeletion
     refuses any store that carries an unregistered table with a capability_id or scope_alias
     column, and v2_coverage_record is exactly that, so the slice-A planner cannot run on a store
     with the C0 bridge installed (DELETION_REGISTRY_UNREGISTERED_MANAGED_TABLE). The CLI journey
     therefore deletes before it installs the bridge'
  - 'graphColours refinement is super-linear in identifier count, and the acceptance-time
     fullEquivalenceShadowChecksum (PR #127) is now the dominant term because it colours every
     minted identity column across all tables; fine for fixtures, a practical hang risk at
     multi-year scale — measure and budget in the executable-core slice before any real migration'
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
