# Current state (compact resume artifact — DL-CONTEXT-01)

Machine-readable summary for agent resume. Updated at every phase boundary and merge. History
lives in `docs/IMPLEMENTATION_LEDGER.md` (archive); durable decisions live in the ADRs. If this
file disagrees with live Git or CI, those win. The ledger never overrides this artifact: it is
the historical record of how past slices were proven, and a fresh agent following it over this
file can resume deleted work (PR #127 late review).

```yaml
updated: 2026-08-08
current_slice_override: 'GOVERNOR BOOTSTRAP (PR #206, branch `claude/governor-bootstrap`): the
  owner mandate v2 + governor spec v1 (received 2026-08-08) were unpacked into
  docs/OWNER_CONSTITUTION.md (binding owner policy; layered subject policy supersedes the absolute
  person-scoring prohibition; locked invariants preserved), .agent-harness/governor.yaml,
  docs/agent-system/ (governor loop, work classes G0-G4, maintenance/idea protocols, 7-prompt
  library incl. Governor Lite, cross-repo contract), docs/PROGRAMME_ROADMAP.md (P0-P4 + v0.1.0
  release sequence + issue dispositions), Opus 5 model pins (owner decision A5 supersedes q-9;
  runtime-verified), new dl-scout agent, verify:context enforcement of the control plane, and
  GitHub taxonomy (14 labels; issues #200-#205). Reconciled without redoing: #193 already fixed
  (PR #194 `24f55d4`); this file was already truthful re Method Trial. NO product feature work in
  this programme; #174 does not start before the P0.5 v0.1.0 baseline.'
phase: 'P0 control-plane reconciliation (governor bootstrap) shipping via PR #206. Prior
  programme state: WB-C1 Method Trial demo complete on both sides (product #187/#190, lab PR #8),
  #189 rendering subset shipped, dual-runtime harness merged (#191/#192). Next phases:
  P0.5 v0.1.0 release programme (#200), then P1 #174 integrated vertical. No real migration,
  source activation, private output, external model call, or model promotion is part of this
  programme.'
head: see `git log -1 origin/main` — live Git outranks anything recorded here
merged: ['R1-R3 cards DL-OPS-CI-01 #70, DL-SPINE-04 #73, DL-SPINE-01 #74, DL-BRIDGE-01 #72,
  DL-METRIC-01 #75, DL-SPINE-02 #84, DL-SPINE-03 #85, DL-UX-ED #87, DL-FINDING-01 #88,
  DL-COMPARE-01 #89, DL-VALIDATE-01 #92, DL-VALUE-01 #94, DL-LIFE-01 #100, DL-EVQ-03 #99',
  'DL-LIFE-02 chain PRs #103, #105, #107-#125 (slice A, B1a+repairs, B1b-i..iii, B2a-i..iii,
  B2b-i, B2b-ii-a..j) — B2b-i..ii-j artifacts were deleted by the §7 simplification;
  their engineering record stays in the ledger', 'DL-LIFE-02 B3 #136 and B4 #141',
  'wait-window hardening #144/#145, mint-order hardening #148, post-B4 hardening #146,
  lifecycle safety #149, tracked-source activation enforcement #150, single-writer lease #152,
  selected-store backup #153, migration-backup singleton #158, task-key continuity #156/PR #159,
  activation default-deny/assert-only PR #160, crash durability #154/#155/PR #161,
  atomic reader selection/grace #162/PR #164, rollback floor #166/PR #167,
  external immutable selection marker PR #169, restore PR #171, success/grace proof PR #175,
  selection-proof durability PR #176, tombstone replay #172/PR #179,
  large-scope replay repair #180/PR #184, physical expiry cleanup #173/PR #185,
  Linux storage-gate repair PR #186, ResearchPack v1 producer PR #178 (`be9c2451`)',
  'state syncs #126']
active_slice: 'Governor bootstrap PR #206 (control plane only; see current_slice_override). Lane
  record: coordinator-owned single writer in the main checkout; owned paths were the new
  control-plane files + CLAUDE.md/AGENTS.md/HUMAN_TODO.md/this file/ledger; stop condition: merge
  under the standard gate. Previous session record (2026-08-07 parallel-lanes) merged three PRs:
  #196 (`63354ef`, #189 accessible-missing-state RENDERING subset), #197 (`41fe76a`, WB-C1 close-out
  ledger/state sync), and #198 (`73cb31e`, #181 ResearchPack standalone Draft-2020-12 schema parity —
  pin relation-specific schema_id, document runtime-only invariants). The two CODE PRs (#196, #198):
  full `npm run check` green, one fresh-context dl-reviewer pass, exact-head Codex triaged (two rounds
  on #196, one on #198); #197 was docs-only (verify:context green, merged via the review-timing window,
  no full check / dl-reviewer). All merged with merge commits. Shared validators untouched; #196 left
  committed fixtures untouched, #198
  regenerated `invented.fixture.json` (only `provenance.contract_sha256` repinned). Lab side: lab #6
  preserved as `developer-lens-lab` PR #24 (parked — q-8 concurrent-writer), lab #7 dispositioned as
  tracked cross-repo debt. Prior product-repo slice before this session: PR #194 (`24f55d4`).'
next_value_slice: 'NEXT WAVE after PR #206 merges: the P0.5 v0.1.0 release programme (#200 —
  AGPL-3.0-only + community scaffolding + dependency triage + C0 release assets + visual QA with
  owner sign-off; labels release/now). After the v0.1.0 tag: P1 = #174 integrated vertical with
  #181/#182 contract semantics (H1), folding #135/#76/#80-resolver where touched. Data Charter v2 +
  capability profiles = #201 (next, before any real activation). Lab-side lanes (lab #5/#6/#7/#23,
  lab PR #24, lab release prep, lab governor seeding) ALL stay human-gated behind q-8. Older
  post-WB-C1 debt map retained below for context: the bounded WB-C1 programme is COMPLETE, the
  product/lab pair is demonstrated green on both sides, and product #189''s rendering subset shipped.
  Remaining tracked post-programme debt is independent (none dependency-forced). Recommended next
  bounded slice: the product #189 validator-parity subset (deferred-caveat uniqueness, all-seven-gates
  on rejection, alert-evidence, viable-selection reason). Note it is a cross-repo product+lab validator
  change — the shared `methodTrialView` contract must move in lockstep across both repos, so run it
  from the coordinating session via the `developer-lens-continuation` skill (there is no committed
  cross-repo-contract skill in this repo) and re-generate the committed fixture only through the
  producer. GATE (q-8): a competing writer was active in the lab checkout this session. Merging lab
  PR #24 — or ANY lab merge — stays blocked until a HUMAN terminates the leaked session; an isolated
  worktree does NOT make a merge safe while the competing writer can still race the remote. Separately,
  do NOT begin WRITE work in the affected lab checkout until q-8 is resolved or a verified isolated
  worktree is used. The validator-parity subset and #182 are cross-repo (lab-touching), so both their
  lab write-work and their eventual merge fall under these two gates. Other tracked debt, pick by owner priority: product #189''s accessible-rendering follow-ups
  (the timeline text alternative should mark where each missing/marked run ends/resumes — Codex #196
  round 2; and the unavailable-metric page-coherence gap, whose real fix is the validator-parity subset
  above) plus its two DEFERRED bullets (future-v2 wire dedup + closed-copy/source-identity canary);
  #181 SHIPPED (PR #198 `73cb31e`; #181 stays open as the schema-parity parent that #182 defers to)
  and #182 (ResearchPack semantic hardening — cross-repo, one contract slice) remains; lab #6 — 4/6
  reproducer-backed fixes delivered as `developer-lens-lab` PR #24, PARKED pending q-8 concurrent-writer
  resolution (findings 1 and 3 mapped as digest-moving); lab #7
  (fallback case labels — CROSS-REPO: blocked on relaxing the product method-trial-view schema
  title/summary/scenario_code first, and the fallback path is currently unreachable — see the plan on
  lab #7). The separate #174/#80 Phase E stored-observation bridge is out of this demo programme. Do
  not turn any follow-up into a generic research dashboard or EvaluationBundle parser.'
active_horizon: # dependency-closed focused wave; opportunity backlog = GitHub issues (governor.yaml queues)
  [P0 governor bootstrap PR #206 — this slice, 'P0.5 v0.1.0 release programme #200 — next, after #206 merges']
blockers: 'No owner blocker for invented-fixture or CI/gate/docs work. Governor bootstrap PR #206
  is the in-flight slice. The binding review-timing gate stated below (`review_timing_defect`) governs any merge:
  exact-head hosted Prove green, one fresh-context review, the 3-minute aging floor, AND either the
  exact-final-head Codex review triaged or 15 minutes since the last push with a fresh clean sweep —
  any fix push restarts that clock. Lab PR #3 merged without the exporter due to concurrent external
  action; this is a sequencing deviation, not evidence that the exporter landed. A real
  migration/connector still requires #168 and a separately reviewed production grant issuer/caller.
  #80/#174 remain outside this demo programme.'
open_owner_gates: 'HUMAN_TODO.md q-6 (a-h) unchanged and non-blocking; q-8 (leaked-session/
  concurrent-writer cleanup — human; gates ALL lab merges and lab-checkout write work) remains
  open; q-9 SUPERSEDED by owner decision A5 (Opus 5 routing); q-10 (owner/manual action register
  from mandate v2) added, none blocking; q-7 verified complete'
frozen_by_reassessment: horizon:frozen label (WB candidates except the owner-directed WB-C1 Method
  Trial demonstration, vector retrieval, GOV/SEC/PORT-02/PROV-01 sources, ATLAS-03 parsers,
  EVQ-09/10, TRACE-03) — 07 §0a
authority_order: [CLAUDE.md, AGENTS.md, .agent-harness/tier.json, OWNER_CONSTITUTION.md,
  HUMAN_TODO.md, governor.yaml + docs/agent-system/, data-charter.md,
  source-capability-matrix.md, DEVELOPER_LENS_V2_ARCHITECTURE.md (incl. Appendix I.1-I.4)]
  # data-charter binds day-to-day persistence until Charter v2 (#201) lands, except where
  # OWNER_CONSTITUTION.md records an explicit supersession (constitution §6.1)
last_verified_checks: 'Exact heads, run IDs, test counts, and review outcomes live in docs/IMPLEMENTATION_LEDGER.md. Refresh live Git and CI, then rerun the relevant gate before relying on prior proof.'
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
  fresh sweep showing no new review; any fix push restarts that clock. Two fix rounds are the
  ceiling: later findings are still triaged, but post-ceiling defects are tracked/rejected and the
  sound slice ships; only a NEW CRITICAL introduced by the fixes reopens once. After merge, sweep
  again beyond the measured delay before calling the review clean.'
capabilities: registry and API definitions remain never_authorized; cap.external.model is uncalled.
  The github.core runner is grant-gated: assertGithubCoreActivationGrant is now assert-only /
  default-deny. The production grant module exports NO issuer; every grant object is
  refused until a separately reviewed issuer is added. Test success paths inject a test-owned
  validator via vitest module mocking. A TypeScript-AST import boundary plus an export regression in
  activationGrant.test.ts prove the production module ships no issuer or runner caller.
card_source: docs/analyser-program/taskdeck/tools/cards.mjs (generate with tools/generate.mjs;
  `node generate.mjs --check` is the non-mutating drift gate; never edit the manifest
  or 07 §6 index by hand)
local_board: seeded Taskdeck board outside Git; restart runbook in untracked RESUME.md beside its
  database (06_TASKDECK_DEMO_PLAN.md §1 describes it without paths)
residual_risks:
  - 'q-7 protection has strict=false and enforce_admins=false; repository law still forbids
     privileged merges with red or stale exact-head CI'
  - 'PR #161 is an explicit owner-directed exception during GitHub''s declared Actions incident.
     Local/full and independent review proof were green; hosted exact-head proof was NOT green and
     is not inferred retroactively. Exact merge, run, and incident evidence lives in the ledger.'
  - 'PRs #164, #167, #169, #171, #175, and #176 continued the owner-directed pre-release Actions
     exception. Their local/fresh-review evidence is recorded, but absent, queued, skipped, or red
     hosted results are never represented as green. Refresh live checks before relying on them.'
  - '#172 revocation replay is retained local C1 integrity state, not source data or fallback
     authority. It survives seven-day legacy/backup cleanup to defeat stale-backup resurrection and
     must be removed by the 36-month C1 boundary or whole-task-root deletion; #173 owns physical
     grace cleanup without deleting this family early.'
  - 'PR #179 merged under the owner-directed pre-release Actions exception. Its delayed exact-head
     connector finding became #180; PR #184 fixed the hard publication ceiling and its own delayed
     connector ambiguity in the applied-lineage query, then merged as `a53b467`. Both original
     threads are resolved and the immediate post-merge sweep is clean. Exact local/full and fresh
     review proof is green; hosted exact-head proof remains NOT verified during the declared Actions
     incident.'
  - '#183 tracks a separate throughput result from #180: a 100,002-subject invented intent publishes
     25 bounded records before SQL in about 19 seconds, but the existing full SQL tombstone deletion
     remained CPU-active beyond a 10-minute bound. Complete deletion/replay is proven across the
     production 4,096-subject chunk boundary; no claim of timely 100k SQL deletion is made.'
  - 'The #180 event shape adds mandatory chunk metadata while retaining the pre-activation v1 family.
     Older invented v1 bytes therefore fail closed. This is accepted only because activation remains
     never_authorized and no real store exists; #168 still owns explicit marker versioning and
     stranded-preflight recovery before activation.'
  - '#173 merged through PR #185 and remains default-off with no scheduler or activation caller. Windows production
     deliberately refuses before its first unlink because exact containing-directory sync is not
     available through the current primitive; hosted POSIX durability remains NOT verified during
     the Actions incident. Hostile same-user pathname ABA remains #142.'
  - '#173/PR #185 preserves the immutable C2 receipt/proof and C1 replay family. Before a future C2 expiry
     removes the receipt/proof, that separate transition must add a durable committed-family
     discriminator and refuse anchor-only/truncated C1 state; this merged slice does not claim C1/C2
     terminal expiry.'
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
  - '#80 remains open after B4: the whyResolver coverage/job deletion-lineage joins belong to the
     Phase-E v3 stored-observation bridge, and scope-unbound deletion lineage still needs the
     charter''s 36-month C1 expiry path (natural LIFE-03 retention work). B3 already resolved the
     v1 FK/planner, executable C2 sweep, and lineage-ID-class conditions. The Ed25519 low-order
     condition is discharged as moot by §7 and reattaches only if signatures return'
  - 'late Codex findings from PRs #105/#109/#110/#112 are batch-triaged into tracking issues
     #128/#129 (2026-08-05); two #109 findings were fixed directly (coverage_ledger empty-code
     CHECKs — the preserved v2_coverage_record bridge table deliberately keeps byte-parity with
     its v2 source; delete-disposition tables must be empty at acceptance). PR #138 completed every
     original #128/#129 verification with discriminating fixtures; #128 is CLOSED by PR #144,
     which captures the CAS clock under the writer lock. #137 is CLOSED by PR #145: alias expiry
     now clears same-scope identity under the same sweep transaction while identity-first expiry
     remains independent. The PR #130 post-merge findings are FIXED by B3: phantom CAS scope
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
     total with 4.1-4.2 s migration, i.e. ~19-21x headroom — the mint-order proof is near-linear (sort-bound) in
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
  - 'RESOLVED by PR B-2: graphColours and both alpha-rename digests are DELETED — the mint-order
     equivalence proof (rewrite reports created identifiers through a private collector channel;
     digest index-encodes them, everything else literal) is near-linear (sort-bound O(R log R), #139), closes the #133 preserved-id
     escape, and is measured: 25,469 source rows through the full journey in ~6.3 s on this box,
     budgets asserted in the opt-in DEVELOPER_LENS_SCALE lane plus an always-on smoke variant'
  - '#135 tracks eight residual semantic-coherence refinements to the evidence resolve contract
     (PR #132 round-three review) — MEDIUM defense-in-depth, natural slice when the contract is
     next touched'
  - 'B4 completion only unblocks LIFE-03; a first real migration/connector also requires LIFE-03
     selection/grace/restore/tombstone-replay/cleanup proof and the activation-enforcement alignment. The
     #86 storage half is CLOSED by PR B-2 (cov- registry CHECK + UNIQUE(coverage_id) + fixture
     migration); both halves of #86 now hold'
  - '#147 is CLOSED by PR #149: retained-publication CAS recovery, cause-aware artifact lineage cleanup, survivor ownership/lineage snapshots, and exclusive invented fixture claims merged with exact-head and exact-merge gates. No real store or production caller was added.'
  - '#142 criteria 1/2 merged through PR #152: fixed-root exclusive creation, descriptor lifetime
     through async work, content-free contention, and crash-held manual-only recovery. Hostile
     same-user ABA/native VFS criteria 3/4 remain open; no stronger claim is made.'
  - 'PR #152 merged before its binding connector-or-15-minute floor: exact-head CI was green, but
     only about four minutes elapsed after the final push and no exact-head connector result had
     arrived. A later empty thread sweep and green merge deployment do not retroactively satisfy
     that pre-merge gate; this is retained as a process defect, not recast as compliant evidence.'
  - 'PR #153 merged the selected-store backup after exact-head CI, three Terra lenses, exact-head
     connector triage, and a clean delayed post-merge sweep. Connector findings are executable
     follow-ups: #154 parent-directory durability, #155 pre-durable temp recovery, #156 canonical
     task-ID/key continuity, and #157 singleton backup identity. None authorizes real activation.'
  - 'Merged PR #161 addresses process-crash ordering and owned provisional recovery only.
     Userspace fault injection cannot reproduce host power loss; hosted POSIX proof is still owed.
     The O_EXCL-name-to-attempt-bind gap deliberately fails closed and may require trusted manual
     reconciliation. Same-user ABA/native-VFS strength stays #142, and sidecar/WAL identity plus
     expiry cleanup remain later LIFE-03 slices.'
  - '#76 carries binding constraints on DL-SPINE-05: the source_diversity clamp decision,
     producer-absence limiting codes, canonical coverage-code registration'
  - '#86 RESOLVED at the connector on fable/boundary-and-reachability: coverageId is a required
     caller input validated as cov- plus 64 lowercase hex, minted from fresh entropy by
     mintGithubCoreCoverageId() and never derived from an alias, provider id, timestamp, or range.
     The replay-determinism constraint still binds and is now the CALLER''s: a replayed job must
     supply the same (jobId, coverageId, jobStartedAt) it supplied the first time, or the storage
     payload hash changes and persistIncrementalGithubCoreTransition fails closed on
     COLLECTION_JOB_ID_COLLISION. The storage half is CLOSED by PR B-2: the incremental.ts
     coverage_id CHECK admits only the cov- registry with UNIQUE(coverage_id), every fixture is
     migrated, and a pre-#86 on-disk store deliberately fails closed at schema validation'
  - 'LIFE-01 transcript replay proves structural lineage only; external authenticity of opaque
     digests remains a future trusted-adapter boundary, with no runtime caller'
  - 'frozen or tracked-only: #68, #69'
```
