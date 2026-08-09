# Developer Lens implementation ledger

Last updated: **2026-08-08, late evening** (P0.5 first batch — PRs #209/#210/#211/#212. A
Codex-side session authored #209/#210/#211, went silent at 21:51Z; the Claude-side flagship
coordinator adopted the lanes via PR-thread claim comments and ran the gate. **#211** nanoid
3.3.16→3.3.18 lockfile-only, merge `8ec605e` 22:33Z: the connector MISSED the PR entirely (zero
reviews in 60+ min), so the 15-minute fallback + one fresh-context dl-reviewer pass carried the
gate; npm-registry integrity hash verified byte-identical; GHSA-2v37-7h3g-55p8 (HIGH, <3.3.17)
closed; post-merge sweeps at T+8 and T+13 min: zero connector activity. **#209** AGPL-3.0-only
baseline (canonical 661-line LICENSE verified section-by-section, SPDX in package.json + lockfile
root, README notice, COMMERCIAL_OPTION intent-only — q-10(a) untouched), merge `3493e26` 22:34Z:
connector round covered only superseded `d9bca02` and its P2 was fixed at head `1324ef9`;
dl-reviewer MERGE-SOUND; A9 base-move re-proof after #211 via local merge-preview (`npm ci` — 0
vulnerabilities — plus verify:context on the combined lockfile); post-merge sweeps clean; LOW
follow-ups tracked on #200 (0.1.0 version bump at tag time, README→COMMERCIAL_OPTION link, AGPL
§5(d)/§13 visible source-offer for the Pages app). **#210** CURRENT_STATE reconciliation, merge
`3195040` 22:47Z, final head `b3a0b59`: three connector rounds — round-1 fixed by the authoring
session (`331400b`), round-2 by this session (serialized-lockfile lane record; H7=BOTH joint-tag
wording verified against OWNER_CONSTITUTION §4/O2/H7 — a product-only tag needs a NEW recorded
owner decision; mandate step-order record; post-sibling reconciliation + live lab-#24
observation), round-3 at the exact final head triaged at the two-round ceiling (nanoid-version
finding DECLINED as out-of-diff misreading; sweep finding RESOLVED with T+13 evidence; ledger
finding TRACKED → this entry). **#212** community scaffolding (CONTRIBUTING, Contributor Covenant
2.1, public ROADMAP, issue/PR templates; Discussions enabled first so its contact links resolve):
Codex round-1 (7 findings incl. blank-issue bypass and CoC confidential route) + independent
dl-reviewer (MERGE-SOUND + 3 accuracy LOWs) consolidated into ONE fix round, head `1dd4433`
(all ten applied; the CoC confidential email is the maintainer address already public in every
commit's author metadata — no new exposure; owner may veto). Round-2 at `1dd4433` (5 findings):
4 applied in the final fix round `bdd2f58` (feature-template invented-details warning + `idea`
label, three-dot merge-base diff range, both hosted-only commands named); the stale no-LICENSE P1
declined with merge evidence. Round-3 at the exact final head (6 findings, post-ceiling): all
tracked with dispositions — Discussions-link warning, cockpit seed-fixture wording, and
invented-vs-C0 terminology on #200; bug queue-label mechanism and PR-template governor surfaces
on #208; .github template verifier coverage on #207. MERGED 23:15:01Z, merge commit `1859ddc`,
after Prove green at `bdd2f58` and the exact-final-head review triaged; post-merge sweep clean
through 23:28Z (T+13).
Session also: lab squash-merge DISABLED (estate standing decision 2026-07-18); lab
dependency-alert triage posted on lab #5 read-only (pyarrow CVE-2026-25087 ×2 HIGH — one advisory,
C++ path not exposed to Python bindings, batch constraint bump >=23.0.1,<24; pytest
CVE-2025-71176 MEDIUM dev-only — batch pytest-9 bump); product Dependabot alerts verified a REAL
ZERO (HTTP 200 empty array); hygiene removed 12 clean merged-branch worktrees + the session's own
lane worktrees and ~35 merged local branches while preserving every unmerged/unpushed branch
(notably local-only `codex/researchpack-v1-steward-20260807` and
`fable/life03-backup-crash-durability`); 41 stale remote branches remain tracked (not swept).
LIVE OBSERVATION: lab PR #24 — parked behind q-8 — was merged 22:14:27Z by account Chris0Jeky
with lab Check green at `ef57045`; human-vs-agent authorship unverifiable, no approval inferred,
q-8 treated as fully binding throughout (see HUMAN_TODO). Learnings promoted: the connector can
MISS a PR outright — after 15 min launch the independent review instead of waiting; pushes from
INSIDE any worktree of this repo are floor-denied — publish refs via `git -C <main-checkout> push
origin <branch>`; instruct licence-text reviewers to verify structurally, never quote at length
(a verbatim AGPL ingest tripped an API content filter once).
Prior: 2026-08-08 — governor bootstrap — owner mandate v2 + governor spec v1 received and
unpacked via PR #206: `docs/OWNER_CONSTITUTION.md` (binding owner policy v2; layered subject policy
supersedes the absolute person-scoring line; locked invariants R2+R3+R6 preserved; secrets stay
absolute X), `.agent-harness/governor.yaml`, `docs/agent-system/` (governor loop, W0–W4 work
classes, maintenance/idea protocols, 7-prompt library incl. Governor Lite, cross-repo contract —
lab side QUEUED behind q-8), `docs/PROGRAMME_ROADMAP.md` (P0–P4; v0.1.0 = #200 before #174), Opus 5
pins per owner decision A5 superseding q-9 (runtime-verified: Agent runtime resolves `opus` →
`claude-opus-5`, live launch succeeded 2026-08-08), new `dl-scout`, verify:context control-plane
enforcement, GitHub taxonomy (14 labels, issues #200–#205; milestone creation skipped — the
2026-08-03 floor guard blocks arbitrary `gh api` mutations on this sensitive_data repo).
Reconciled-not-redone: #193 was already fixed by PR #194 `24f55d4`; CURRENT_STATE was already
truthful about Method Trial completion. Exact heads/checks recorded at merge in the PR thread.
Prior: 2026-08-07 — ResearchPack standalone-schema parity — #181, PR #198 merge `73cb31e`;
MethodTrialView accessible-missing-state rendering — #189 rendering subset, PR #196 merge `63354ef`;
the bounded WB-C1 programme is closed — lab PR #8 merged and the product/lab pair demonstrated green on
both sides. Prior same day: hosted PR gate drift steps — PR #194 / issue #193; dual-runtime Claude
harness — see the dated sections at the end)

Architecture: [`docs/DEVELOPER_LENS_V2_ARCHITECTURE.md`](./DEVELOPER_LENS_V2_ARCHITECTURE.md),
evidence/design version 2026-08-03 + Appendix I.1–I.4.

**Fast resume:** agents should read the compact state artifact
[`docs/analyser-program/CURRENT_STATE.md`](./analyser-program/CURRENT_STATE.md) first (DL-CONTEXT-01);
this ledger's phase narratives below are the **archive** — consult them for history and audit, not
for the next task. Current phase in one line: R1–R3 is complete; the LIFE-02 chain through
B2b-ii-j is merged, and the 2026-08-05 simplification
(`docs/analyser-program/10_LIFE_02B_DECISION.md` §7) deleted the inert continuity/owner-PKI
artifacts and replaced the B2b-ii-k trust-root plan with an executable core (target factory,
selector, CAS-in-store, owner-controlled default-off entrypoint), then B3/B4 — without marking the
card DONE or unblocking sensitive connectors between slices.

**Correction (2026-08-05, standing):** the per-slice sentences below claiming an "empty
late-comment sweep" for PRs #104–#125 were measured before the Codex connector posted — it
consistently posts 3–10 minutes **after** merge — and are not evidence of clean reviews. Twenty
late Codex comments across PRs #104–#112 sat untriaged until the 2026-08-05 batch triage (tracking
issues are linked from each PR thread; two live #109 findings were fixed directly). Merges now wait
for the Codex review to arrive or a 15-minute post-ready window, whichever is first.

Archived phase narrative (2026-08-03/04, pre-reconciliation): **D1-D3, the synthetic P2 SQLite/importer proof, the bounded synthetic P3
analysis-pack foundation, and the durable continuation/context-verifier foundation are published.
The public synthetic V2 demo now includes an accessible observed-to-derived-to-hypothesis story
path over its existing validated C0 insight payload. The published P4 foundation includes an inert
protocol, opt-in incremental storage bridge, invented-fixture page adapter, closed activation-card
parser, injected public-unauthenticated GET transport with immediate projection, closed-world
incremental-schema validation, and a confined descriptor-bound, duplicate-key-rejecting, 64 KiB
ignored-card loader plus frozen alias-only membership on every accepted REST page receipt. A shared
installation-
scoped alias factory now preserves the existing migration identities and adds closed, domain-
separated repository, issue, pull-request, and page aliases. The opt-in store now records restricted
coverage as explicitly noncomplete without advancing a checkpoint or creating a snapshot. Published
complete composition now maps only validated complete REST results into a canonical,
deeply frozen snapshot proposal with exact range/page/membership proof, a content-stable hash, and a
job-unique opaque source-snapshot ID. Published D1 now adds visible evidence-fit confidence
and lens-limit cues to every story-path step without turning confidence into a person score. P4
remains default-off and adds no credential, live read,
storage write/integration,
legacy-collector switch, or public/private output path. G4 is now provider-specifically approved,
while a strict C1 evidence/output contract, deterministic local retrieval, and a credentialless
OpenAI Responses request boundary remain default-off. The published P12 activation slice adds a
strict, review-chronology-bound activation-card parser without reading its future card. A bounded
follow-up now rejects calendar-invalid pricing timestamps that JavaScript would otherwise normalize
into a different date. Published P12 now applies the same calendar-component boundary to C1
bundle ranges while preserving supported fractional UTC forms and half-open range limits. The
Published P4 now range-binds every composable noncomplete REST outcome, adds a pure core transition
that preserves the prior checkpoint without terminal-receipt, snapshot, or completion fiction, and
validates/composes restricted, failed, and truncated results into frozen noncomplete transitions
only. Published P4 feeds only those reviewed complete/noncomplete composition outputs into the opt-in
store and proves replay, per-job snapshot identity, and checkpoint preservation with invented in-
memory fixtures. Published P4 accepts the coherent post-metadata zero-page truncation that occurs
when the request budget or rate limit is exhausted before the first unit page, while preserving
noncomplete coverage with no cursor, snapshot, or checkpoint movement. Published P4 cross-checks
every supplied failure kind against one canonical limitation code before retry
classification. Published P12
extracts the proven confined activation-card reader,
cross-binds the task ID and strict current-time parser, builds one exact credentialless request
preview, and binds the reviewed bundle ID plus SHA-256 digests of its exact UTF-8 bundle JSON and
request body. Published P12 adds the first authorization-bearing HTTP adapter: a genuine
bound preview is revalidated before the one named environment lookup, one finite-timeout fetch, and
strict body/output/usage projection. It remains uncalled and default-off. Published D1
adds one static, sink-validated question to carry forward on the invented hypothesis card so the
story ends with evidence that could change the interpretation rather than a score or prescribed
action. The closeout documentation links a 3-5 minute synthetic walkthrough, exact local/hosted
routes, achieved foundations, and explicit claims to avoid; it changes no product or activation
behavior. The external-
model capability is still
`never_authorized`; there is no task-card/runtime caller, actual environment read, network/provider
execution, cache, telemetry, persistence, export, or presentation path**.

**2026-08-04 planning session:** the intelligence-platform planning-and-seeding session published
`docs/analyser-program/` (product brief, 24 ADRs, feature/ML/RAG/UX catalogs, Taskdeck demo plan,
delivery roadmap with 118 dependency-complete cards, open-questions/frontier ledger, schema
proposals, and a validated Taskdeck starter pack), appended the accepted stable deltas as
Appendix I of the canonical architecture, and seeded a real local Taskdeck planning board
("Developer Lens — Intelligence Platform", 118 cards / 58 labels / 6 columns) in a fresh dedicated
database in a workstation-local dogfood folder outside both repositories (exact path and restart
runbook only in the untracked `RESUME.md` beside the database) using only the
already-built Taskdeck Release binary run from a scratchpad copy (validate → dry-run → apply all
green, zero blocking conflicts; idempotent re-apply proven; one MCP-created card proposal left
honestly `PendingReview` for the human; lossy board export + local credentials kept outside Git).
No product implementation, real collection, external model call, or capability activation
occurred; `cap.external.model` and every other executable capability remain `never_authorized`.

**2026-08-04 reconciliation (post-PR #62, owner directive; DL-RECON-01/DL-CONTEXT-01, both
completed docs-only):** the owner's reconciliation directive and the late-arriving automated
review on merged PR #62 (29 findings; 26 still valid on `main` at `afb026a`, verified individually)
were integrated in a follow-up docs/planning-only PR. Delivered: the analytical core became
load-bearing (new ADR-25 metric-definition registry + ADR-26 finding contract / AnalyticReference /
matched-comparison semantics; canonical Appendix I.4 addendum with the V1-primitive retirement map
and Investigate/Narrate model); every still-valid review finding was corrected across
01/02/03/04/05, the schema proposals (typed FK edge targets, C2 scope split, pack claim-ID
re-mint, one canonical coverage-dimension shape), the charter (Query Lab PresentationView
clarification), and the matrix (manifest-body consent split, deletion-planner ordering note); the
card programme grew 118 → **126** (new DL-RECON-01, DL-METRIC-01, DL-FINDING-01, DL-COMPARE-01,
DL-VALIDATE-01, DL-VALUE-01, DL-OPS-CI-01, DL-CONTEXT-01 under `epic:analytics-core`) with the
card source now **tracked** at `docs/analyser-program/taskdeck/tools/` (generator regenerates the
manifest and the 07 §6 index — drift structurally impossible); the execution model gained waves
R0–R8, a ≤12-card dependency-closed **active horizon** (`horizon:active`), and a freeze list
(`horizon:frozen`) parking ML/vector/GOV/SEC/rulesets/parsers work until DL-VALUE-01 is accepted;
DL-BRIDGE-01 was renamed the **bootstrap slice** with DL-VALUE-01 as the first analytical value
slice; high-sensitivity connectors now depend on the deletion planner (DL-LIFE-02); DL-PACK-03
lost exact-graph/GraphML export (banded summaries only); DL-QL-01 became
PresentationView-projected; DL-HYP-02 dropped confidence bands for eligibility states; the
frontier-closure wording was softened to "backlog expansion closed for this planning cycle". Still
no product implementation, real collection, external model call, or capability activation.
A post-merge follow-up PR then triaged the late-arriving automated review of the reconciliation
itself (14 findings: 2 already fixed pre-merge, 12 corrected — notably DL-PROV-01 rebound to gate
G-d, observed-zero weeks vs null in cadence, saturation-as-truncation (never censoring) for
Actions runs, role-pool reservation before the retrieval cap, snapshot-copy deletion lifecycle,
BH family re-evaluation on growth, DL-VALUE-01 gated on DL-VALIDATE-01, the DL-Q-GRAIN question
card (127 cards), role→target CHECKs, and a non-mutating `generate.mjs --check` drift gate).

Published P4 adds an inert, no-caller composition runner. It binds the exact opened task-
card bytes to a caller-supplied lowercase SHA-256, derives the repository alias before any request,
splits the declared request ceiling across two independent probes, persists only an actual
noncomplete outcome or two hash-equal complete observations, and records fixed noncomplete coverage
when two complete observations disagree. It returns only frozen stability, coverage, and numeric
request facts. No production module imports it; every verification call used only invented cards,
keys, in-memory databases, and injected responses, with no real network or protected-output read. A
trusted card/report anchor, task-owned key fingerprint and database,
backup/restore, revocation/re-consent, and caller-clock binding remain mandatory before any future
real caller or GET.

Published P4 adds explicit task-owned installation-key creation and continuity loading.
It creates one exact 32-byte key at the canonical ignored task path with exclusive no-overwrite
semantics, returns only a frozen fingerprint/alias handle, and reopens only a confined, regular,
single-link key whose exact bigint file and directory identities remain stable across two reads.
Every owned temporary key buffer is zeroed. The default-off public loader permits an omitted expected
fingerprint only for setup/inspection; a future runtime remains blocked until a durable reviewed
report supplies and enforces that fingerprint. No real key, card, database, or protected input was
read.

This is the durable factual checkpoint, not a transcript. Git, executable checks, hosted CI, and
unresolved review threads outrank it whenever they disagree.

## Live state

- Checkout: the repository root for this task; no absolute local path is persisted here.
- Published product baseline before this documentation-only closeout:
  `origin/main` merge `57eef928a64f5c99e17eba1390dbe95d5878391a`.
- Pull requests: [#3](https://github.com/Chris0Jeky/developer-lens/pull/3) merged at
  `5df1a09eddb1d9c003d5749b82f7462126a78e07`; follow-up
  [#4](https://github.com/Chris0Jeky/developer-lens/pull/4) merged at
  `1171a42b988aae01121d74ce5f412b1a00fd4fc9`
  with the three migration repairs, installation-HMAC blocker fix, and exact ledger correction.
- Worktrees are live coordinator state rather than a durable count. Refresh registration,
  cleanliness, ignored output, and occupancy from Git before mutation or removal; never force
  cleanup of an uncertain tree.
- Follow-up commits: `bb2a0d5` repairs producer coverage/local repository-ID compatibility and
  transactional replacement; `9c8c3e9` adds the explicit installation-scoped HMAC key contract;
  `739e371` narrows the repository-identity persistence claim to its exact C2 boundary.
- P3 implementation commits: `51c30e2c2c77f9efa9e0d71326b9124f018bf1ff` adds the pinned
  DuckDB Node dependency and the synthetic analysis-pack producer/replay seam;
  `5acba15db7ee24bc73f291510908494d82995eba` derives the opaque pack ID from safe pack facts after
  review. [PR #8](https://github.com/Chris0Jeky/developer-lens/pull/8) merged with commit
  preservation at `cc08a2ecaa480660bda68bb40f4d2d2a02d5bbaf`; exact-merge Pages run
  [30858237376](https://github.com/Chris0Jeky/developer-lens/actions/runs/30858237376) passed the full
  gate, showcase privacy verification, artifact upload, and deployment.
- [PR #12](https://github.com/Chris0Jeky/developer-lens/pull/12) adds post-replay Parquet
  verification at `6eac3b3719ed6c4872fa72521bbc81fd23019055`; it merged with commit preservation at
  `218c2373ad8dc697b8c0a1e2575915de37a47160`. Exact-merge Pages run
  [30865334329](https://github.com/Chris0Jeky/developer-lens/actions/runs/30865334329) passed the full
  gate, showcase privacy verification, artifact upload, and deployment.
- [PR #13](https://github.com/Chris0Jeky/developer-lens/pull/13) scopes ignored-output cleanup to
  the task-card-owned boundary and parks uncertain worktrees at
  `bf582263895e2c82e844074316484911386bebc4`; it merged after a current-base refresh at the
  `ebb600852f409e29182c85b9a8d9c136b5e42890` baseline. Exact-merge Pages run
  [30865702054](https://github.com/Chris0Jeky/developer-lens/actions/runs/30865702054) passed both the
  full build/privacy gate and deployment. Late review follow-ups are tracked in
  [#14](https://github.com/Chris0Jeky/developer-lens/issues/14) and
  [#15](https://github.com/Chris0Jeky/developer-lens/issues/15).
- [PR #16](https://github.com/Chris0Jeky/developer-lens/pull/16) publishes the inert
  `github.core` protocol foundation at merge `b1c97d1bba3c9d184bf7ba41cf6627179db16d9a`.
  Exact-merge Pages run
  [30866650482](https://github.com/Chris0Jeky/developer-lens/actions/runs/30866650482) passed the full
  gate, synthetic showcase privacy verification, artifact upload, and deployment.
- [PR #17](https://github.com/Chris0Jeky/developer-lens/pull/17) publishes the opt-in incremental
  SQLite bridge at merge `daf318067cc6b9984e2bdf7a5601b4d5b7f3e198`. Exact-merge Pages run
  [30869532164](https://github.com/Chris0Jeky/developer-lens/actions/runs/30869532164) passed the full
  gate, synthetic showcase privacy verification, artifact upload, and deployment.
- [PR #18](https://github.com/Chris0Jeky/developer-lens/pull/18) publishes the strictly injected,
  invented-fixture `github.core` page adapter at merge
  `3a0d6bd1a564f09a661a1638960152dd368186ed`. Exact-merge Pages run
  [30871009468](https://github.com/Chris0Jeky/developer-lens/actions/runs/30871009468) passed the full
  gate, synthetic showcase privacy verification, artifact upload, and deployment.
- [PR #19](https://github.com/Chris0Jeky/developer-lens/pull/19) publishes the activation-card
  parser at merge `fd250ca3fc0c94a6c383a05e31ed5dd3eb4526bd`. Exact-merge Pages run
  [30873430263](https://github.com/Chris0Jeky/developer-lens/actions/runs/30873430263) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment. The selected
  repository and operational card remain ignored and local.
- [PR #20](https://github.com/Chris0Jeky/developer-lens/pull/20) is the smallest follow-up for the
  first late review finding: parsed cards now require the exact proving and stop-condition sets and
  reject omissions, substitutions, and duplicates. It merged at
  `dcaa305c1e9813ee97ad6262348fb670f9d9953e`; exact-merge Pages run
  [30873997951](https://github.com/Chris0Jeky/developer-lens/actions/runs/30873997951) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment.
- [PR #21](https://github.com/Chris0Jeky/developer-lens/pull/21) publishes the injected REST
  transport at merge `ee99457b1748fefe86892576e726171faa76df7c`; exact-merge Pages run
  [30875354872](https://github.com/Chris0Jeky/developer-lens/actions/runs/30875354872) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment. It adds no
  task-card loader, live request, storage composition, or private/public output.
- [PR #22](https://github.com/Chris0Jeky/developer-lens/pull/22) publishes closed-world incremental
  schema validation at merge `d0141009cb05210a00db5a3ae8b947f62041110c`; exact-merge Pages run
  [30876013819](https://github.com/Chris0Jeky/developer-lens/actions/runs/30876013819) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment.
- [PR #23](https://github.com/Chris0Jeky/developer-lens/pull/23) publishes the context-verifier
  Markdown/YAML edge-case repairs and closes issue #14 at merge
  `ceab73b1b57eb3bd7935b8caecc2c50dc6a3c3ff`; exact-merge Pages run
  [30876446311](https://github.com/Chris0Jeky/developer-lens/actions/runs/30876446311) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment.
- [PR #24](https://github.com/Chris0Jeky/developer-lens/pull/24) publishes the launcher fallback and
  generated-dataset boundary repair and closes issue #15 at merge
  `911069c88085a268dee033fba28034565ca45647`; exact-merge Pages run
  [30876708265](https://github.com/Chris0Jeky/developer-lens/actions/runs/30876708265) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment.
- [PR #25](https://github.com/Chris0Jeky/developer-lens/pull/25) records the bounded OpenAI/Luna G4
  authority at merge `94f00ae67e5c72c388698872ec5a706e9265f898`; exact-merge Pages run
  [30877247691](https://github.com/Chris0Jeky/developer-lens/actions/runs/30877247691) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment. Late review
  comments against its pre-fix head were reconciled once; all direct boundary findings were already
  closed in the merged head and the remaining retention-code naming ambiguity was non-blocking.
- [PR #26](https://github.com/Chris0Jeky/developer-lens/pull/26) publishes the confined ignored-card
  loader at merge `1d655cf64e91e6910fd79712f48d1abd64c61cdb`; exact-merge Pages run
  [30877836995](https://github.com/Chris0Jeky/developer-lens/actions/runs/30877836995) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment. It contains no
  tracked card identity/value, network, database, credential, runtime switch, or output path.
- [PR #27](https://github.com/Chris0Jeky/developer-lens/pull/27) publishes the accessible synthetic
  evidence-story path at merge `523899db4a975524316fc63707e52ec81ec4f3ba`; exact-merge Pages run
  [30878869800](https://github.com/Chris0Jeky/developer-lens/actions/runs/30878869800) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment.
- [PR #29](https://github.com/Chris0Jeky/developer-lens/pull/29) publishes the default-off C1
  contract/local-retrieval foundation at merge `6032394302f43717a8b0d9087aa0c5bbd4b20c49`;
  exact-merge Pages run
  [30879165749](https://github.com/Chris0Jeky/developer-lens/actions/runs/30879165749) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment.
- [PR #30](https://github.com/Chris0Jeky/developer-lens/pull/30) hardens the ignored-card loader and
  closes issue #28 at merge `0a8925a805ba5a4794824db521ead09dcf6360a6`; exact-merge Pages run
  [30879569412](https://github.com/Chris0Jeky/developer-lens/actions/runs/30879569412) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment. Its former Node 20
  action-runtime deprecation annotation is closed by the published Node 24 action refresh below.
- [PR #32](https://github.com/Chris0Jeky/developer-lens/pull/32) publishes the installation-scoped
  alias factory at merge `eae8370c8dbdad0fd0c6e49589c3cafd612e6ac9`; exact-merge Pages run
  [30880417283](https://github.com/Chris0Jeky/developer-lens/actions/runs/30880417283) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment. Issue #6 remains
  open for installation-key creation, persistence, mismatch, rotation/recovery, and deletion.
- [PR #33](https://github.com/Chris0Jeky/developer-lens/pull/33) publishes the bounded credentialless
  OpenAI/Luna request contract at merge `4ee986ed1e65cd58a56799391827359224ce1f14`;
  exact-merge Pages run
  [30880901044](https://github.com/Chris0Jeky/developer-lens/actions/runs/30880901044) passed the full
  gate, synthetic-showcase privacy verification, artifact upload, and deployment. It adds no
  credential read or provider/network execution.

## Authority and owner gates

- G1 and G2 are owner-approved. G2 adopts C1=36 rolling months, C2=13 months, C3=90 days,
  C4=process lifetime, repository-name isolation, canonical PR-title removal, and the copy-based
  backup/seven-day-grace/rollback/deletion protocol in `HUMAN_TODO.md` and the data charter.
- Repository declaration: T2 `daily-driver`, `sensitive_data=true`, `push=free`,
  `merge=free`, exact `public_synthetic_publication` route
  `origin` -> `Chris0Jeky/developer-lens`, human-action alias `HUMAN_TODO.md`.
- The `sensitive_data` content boundary still forbids private/generated data, credentials, browser
  state, caches, local paths, and private inputs from tracked/public output. The owner explicitly
  replaced q-4's actor restriction: agents may publish only the verified code, tests,
  documentation, and invented-synthetic branch through that exact route and normal repository
  gates; only the top-routed Sol model may merge.
- Any separate registry reconciliation is outside this public ledger. It follows the matching public
  Developer Lens authority/policy commit and its own normal gates. Never copy a private registry's
  URL, PR number, commit IDs, review/check state, or other live metadata into tracked public docs.
- G3 standing authorization is owner-approved for Actions, deployments, dependencies,
  Dependabot/code-scanning security aggregates, Projects, ownership, and source structure within
  the reviewed matrix. Future named sources may join only through a reviewed registry/matrix change
  that stays inside the charter and rejected-capability boundaries.
- G2/G3 approval is permission to implement bounded activation, not activation itself. Every
  executable definition remains `never_authorized` until a task selects exact local scope, uses
  existing read-only least-privilege access, and proves collection, coverage, retention, deletion,
  rollback, and failure behavior.
- The owner has now selected the first public repository through an ignored local task card. Public
  tracked state records only its abstract read/privacy boundary; repository identity, provider ID,
  task path, and runtime values remain local and untracked. The card authorizes public
  unauthenticated reads only and does not itself enable a network or persistence path.
- G4 is owner-approved only for OpenAI `gpt-5.6-luna` within the data charter's exact stateless
  Responses, C1 payload, local-retrieval, provider-retention, credential, spend, output, and deletion
  boundary. `cap.external.model` stays `never_authorized`; approval schedules bounded default-off
  implementation but does not itself read the credential or send a payload.

## P0 result

- Commit `92cb78237f0950908a224545575ed593793e0555` adds the T2 authority declaration,
  data charter, source/capability matrix, and human-action file.
- Commit `2ea18a14091db0eb8fc4e9d7bea9cc33a2869be2` adds the initial ledger and bounded
  P1 task card.
- Canonical tier validation returned no issues. Focused JSON, flag, 13-row capability, G2,
  human-gate, link/path, registry parity, Markdown table, and whitespace checks passed.
- The earlier repository-context audit found no root `AGENTS.md`. The durable-context milestone
  closes that documentation gap without adding a project hook or changing the declared tier/route.
- The bounded P0 review's consent ambiguity was fixed so every real/private source read requires
  G2 and all capability definitions remain `never_authorized`.

## P1-CONTRACT-001 result

- Commit / exact paths: `8809289657d260eb099cac755dd150d6c9f4b335` adds only
  `shared/privacy.ts`, `shared/capabilities.ts`, `shared/coverage.ts`,
  `shared/provenance.ts`, `docs/analysis-pack/manifest.schema.json`, and
  `server/privacyContract.test.ts`.
- Versions: privacy, capability, coverage, provenance, and manifest contracts are `1.0.0`;
  the canonical envelope schema is `2.0.0`.
- Privacy contract: C0-C4/X, seven named sinks, explicit private-schema sink binding, a distinct
  C0-only `public_showcase.v1` family, flat classified sink values, and denial before
  serialization. Canonical/private families cannot reach public, unlisted sinks reject, and
  permissive nested objects require a separately classified contract.
- Capability contract: 13 exact IDs, every definition `never_authorized`, every definition
  G2-gated, and additive G3/G4 metadata. There is no activation, source query, credential,
  collection, storage, or network operation.
- Coverage contract: the exact ten states. `complete` requires a known expected count, every
  expected unit observed, zero omitted units, and consistent observed-plus-omitted arithmetic.
  Other states never become an activity zero through `completeObservedUnits`.
- Provenance contract: the four evidence layers, strict time/source provenance, closed canonical
  payload families, exact registered field classes, and envelope schema `2.0.0`.
- Manifest: a closed private analysis-pack skeleton with allowlisted paths, C0/C1 artifact ceiling,
  SHA-256 shapes, and `redacted_aggregate` as the sole export classification. It is structurally
  separate from Pages/public data.
- Invented privacy proof: canaries cover credentials, Windows/POSIX paths, identities, repository
  metadata, titles/labels/bodies/reviews/subjects, CI names, dependencies, source/symbol/import
  strings, and security details. They reject at persistence, log, API, frontend, export, model,
  and public sinks and do not survive accepted serialization.
- Private-data behavior: no collector, analysis, app, Pages, API, storage, migration, retention,
  model, telemetry, or network command ran. No private/generated dataset was read. The mandated
  full check ran the ordinary Vite build; ignored build output was not inspected or added to Git.
- Rollback: revert the one P1 implementation commit. No database, migration, retained record,
  external call, or deletion side effect exists.

## Owner development policy

- Decision: on 2026-08-03 the owner replaced hardening-first sequencing with demo-first delivery.
- Priority: working local demo, speed/effectiveness/productivity, owner feedback, and focused tests.
- Sequence: D1 visible synthetic vertical slice, D2 feedback iteration, D3 repeatable local demo,
  the first synthetic P2 SQLite/importer proof, and the bounded P3 foundation are complete locally.
  P4-P11 remain unactivated. P12 is provider-specifically approved and now has a default-off C1
  contract/local-retrieval foundation plus a credentialless request/callback boundary, but no
  environment read, authorization-bearing HTTP transport, provider execution, or activation path.
  For future work,
  Sol performs bounded browser/visual passes when needed, records subjective assumptions and
  next-day questions, and proceeds rather than waiting.
- Hardening rule: security, privacy hardening, resilience, and distribution concerns are recorded in
  [`POST_DEMO_HARDENING.md`](./POST_DEMO_HARDENING.md) and do not interrupt D1-D3 unless they cross
  the irreversible floor.
- Irreversible floor: no secret/private/generated-data exposure, destroyed user work,
  external/production mutation, or public publication outside the chosen code-only/synthetic
  route. T2 plus `sensitive_data` remains declared for that floor; it is not a mandate for pre-demo
  scaffolding.

## D1-D3 result

- D1 implementation landed in `6f1b800f93952c88887f59f11ca92f4f5e3b789f`.
  `?demo=v2` branches before `useDashboard`; one strict flat `public_showcase.v1` payload carries
  all displayed metadata and insight fields as C0, validates through the public sink, and derives
  the `InsightStack` input. Observed, Derived, and Hypothesis filters render without a fetch. A
  fresh review found one HIGH boundary defect (insight fields originally bypassed registration); it
  was fixed once and the final review closed the finding.
- D2 browser proof used `npm run dev:web` and an in-app browser at
  `http://127.0.0.1:5173/?demo=v2` with an 846x698 viewport. The invented boundary, title, and
  evidence taxonomy were clear; each filter uniquely showed 1/3 with evidence and caveat text,
  All restored 3/3, document width was 831 versus viewport width 846, and no browser warning or
  error appeared. Subjective assumption: one filtered card retaining one-third width and whitespace
  is acceptable for D3 because comprehension remains clear and the CSS choice is reversible. Next-day
  questions: should a single filtered card expand, and which second synthetic story or decision would
  be most useful?
- D3 repeatability documentation landed in `4d8753383e38e4b744f85d46927d448ac824e145`.
  `npm run test:demo:v2` passed 1 file / 5 tests; `npm run check` passed lint, 20 files / 49 tests,
  TypeScript, and the Vite build; `npm run build:showcase` passed export, social render, build, and
  verifier. The only warning was the existing Vite >500 kB chunk advisory. A narrow D3 review found
  no CRITICAL/HIGH issue.

## P2 synthetic storage proof

- Commit `8c8f3090b31790e7038427c0a3015e0bfb2ba3d3` adds exact
  `better-sqlite3@12.11.1` / `@types/better-sqlite3@9.6.0` dependencies and the bounded
  `server/storage/` schema, database opener, v1 importer, fallback selector, and synthetic tests.
- The storage selector is disabled unless its value is exactly boolean `true` or string `1`.
  Disabled or failed selection returns a stable legacy-JSON code. There is no CLI, `dataStore`,
  collector, API, Pages, real-JSON, or production activation wiring.
- A genuinely empty SQLite target is initialized with the Developer Lens application ID, user
  version 2, strict tables, and foreign keys. A zero-header target with any non-internal schema
  object and every partial/mismatched header tuple is rejected before header or schema mutation.
  New imports use a temporary target and rename; existing-target inserts plus integrity, quick, and
  foreign-key checks share one transaction.
- The strict projection persists only bounded opaque identifiers, categorical states, counts,
  timestamps, booleans, and full installation-scoped HMAC-SHA-256 repository provider/analytical
  aliases with domain separation. Names, titles, URLs, descriptions, labels, warnings, subjects,
  paths, raw repository provider IDs, and actor metadata are not persisted; imports fail closed
  without a 32-byte installation key. Other bounded v1 object IDs remain restricted-store C2 keys.
- Legacy coverage maps conservatively into the executable ten-state V2 union: `unavailable` remains
  `unavailable`; `partial` and unverifiable legacy `complete` become `censored` with fixed limitation
  codes. Bounded legacy `github-*` IDs map to `github.core`, exact `local-git` maps to
  `cap.local.git`, and every other coverage ID is rejected. Distinct producer `github-*` entries are
  aggregated by their least-favorable state; ties retain the lowest observed count because the v1
  item-count units cannot safely be summed. Exact duplicate source IDs remain invalid.
- Collector-generated `local:<repository-reference>` provider IDs are accepted only within the same
  bounded repository-reference alphabet and are deterministically hashed before persistence. The
  raw local identifier and repository name do not enter the V2 target.
- An existing target is a single replaceable v1 snapshot. Its integrity and foreign keys are checked
  before mutation; all P2-owned snapshot rows and the superseded import checksum are cleared and
  rebuilt inside the same transaction; post-import checks run before commit. Any injected or
  integrity failure rolls the deletion and rebuild back to the previous canonical state.
- The first review found four HIGH defects in target ownership, transaction placement, projection
  bounds, and legacy coverage semantics. One bounded fix batch closed all four reviewed
  reproductions; coordinator review also caught and closed both partial-header tuples before the
  final fresh review found no remaining
  CRITICAL/HIGH issue.
- A later factual ledger review reproduced an unclosed view-only ownership variant and parked the
  original task. Separate follow-up commit `d13cab2a48c92cf0020ee783b785e296a1f923ac`
  rejects every non-internal schema object. Its first review found that `_` in `LIKE 'sqlite_%'`
  was a wildcard; the single fix batch changed the predicate and matching regression assertions to
  literal-prefix `GLOB 'sqlite_*'` semantics with an adversarial `sqliteXview`. The final bounded
  review confirmed the prior HIGH closed and found no new CRITICAL issue. P2 is locally complete
  and agent-publication-eligible through the gated q-4 path.
- After PR #3 merged, three late review threads exposed normal multi-record GitHub coverage
  rejection, collector-generated local-ID rejection, and stale rows surviving replacement imports;
  PR #4's late review additionally identified an unsalted local alias, which this fix round closes
  with domain-separated installation HMAC aliases.
  Commit `bb2a0d5a1adc922fb9dc5eed0c3f91ae5c546fe7` closes the three reproduced seams with invented
  producer-shaped fixtures only; real/private data was not read or migrated.

## P3 synthetic analysis-pack foundation

- Dependency decision: pin only `@duckdb/node-api@1.5.5-r.3`. As of 2026-08-03 it is the current
  DuckDB Node Neo package, pins the same-version native bindings, and declares a dedicated optional
  `win32-x64` binary. DuckDB provides Parquet `COPY` and `read_parquet` itself, so no second Parquet
  library or deprecated `duckdb` package is present. The package metadata has no Node `engines`
  declaration; compatibility is recorded from direct probes rather than inferred from that field.
- Input boundary: the producer opens an existing P2 SQLite file read-only, validates the exact
  application/user headers, integrity, foreign keys, and the closed `coverage_observation` table,
  then projects only `capability_id`, exact coverage `status`, and nonnegative `observed_units`.
  It never calls the mutating storage opener. `limitation_code`, repository/object IDs, names,
  identities, titles, and every other P2 table remain outside the pack projection.
- Pack boundary: the complete file set is `manifest.json`, `checksums.sha256`, `COMPLETE`, and
  `tables/coverage.parquet`. The strict runtime manifest fixes contract versions, the
  `redacted_aggregate` export class, the two safe P2 capability IDs, one C1 artifact, and no model
  evidence. Its opaque `pack-<digest>` ID is derived from the declared timestamp and safe Parquet
  checksum; callers cannot supply repository- or identity-shaped pack metadata. Replay also rejects
  extra files, unexpected Parquet columns/types/enums, duplicate capabilities, manifest/table
  disagreement, and checksum or marker mismatch.
- Publication protocol: generate in a sibling temporary directory, write and close the Parquet
  file, hash and validate the manifest/table, write `COMPLETE` last, then rename the directory.
  The source database remains byte-identical in the deterministic proof.
- Scope: no CLI, `dataStore`, collector, migration, API, UI, exporter, Pages path, notebook, query
  directory, external model, real input, or production activation was added.
- PR #12 rehashes the Parquet table after DuckDB replay and fails if the replayed file no longer
  matches the manifest checksum. The invented replacement regression swaps in a different valid
  Parquet file during replay; replay completes, the second hash detects the mutation, and the reader
  fails closed.

## P4 inert GitHub core protocol and storage foundations

- `server/connectors/github/core.ts` is a pure protocol seam for `github.core`. Its manifest pins
  REST `2026-03-10`, query contract `github.core.v1`, a 24-hour watermark overlap, and three retry
  attempts. The plan reads the executable capability registry and returns `never_authorized`; it
  cannot execute a request or turn G2/G3 approval into runtime consent.
- Strict runtime inputs bind checkpoints to capability, opaque scope, consent revision, query/API
  versions, canonical timestamps, and lowercase SHA-256 snapshot hashes. Opaque IDs are bounded,
  failure kinds are closed, explicit optional fields cannot bypass validation, exact `Retry-After`
  values are honored, and computed retry delay is deterministically capped.
- Synthetic page receipts prove pagination and terminal-page completeness. Equivalent receipt IDs
  replay idempotently; conflicting reuse fails closed. A complete bounded run alone advances the
  checkpoint. Failure, missing terminal proof, or page-cap truncation preserves the prior checkpoint;
  a truncation cursor remains a non-durable hint and unknown totals remain unknown.
- `server/connectors/github/core.test.ts` uses invented opaque scopes, jobs, pages, units, hashes,
  failures, and caps only. This foundation adds no `fetch`, `gh`, subprocess, token, credential,
  selected-repository, SQLite, API, legacy-collector, public-data, or external-model wiring.
- `server/storage/incremental.ts` is a separate opt-in `2.2.0` bridge over an already-owned P2
  SQLite handle. Its installer adds four STRICT tables—`collection_job`,
  `collection_checkpoint`, `source_snapshot`, and `coverage_ledger`—without changing the P2
  opener, schema SQL, application ID, user version, importer, or existing rows.
- A single transaction validates a strict scalar-only projection, writes an immutable final job and
  coverage, and advances the checkpoint only for a complete snapshot. Identical job payloads replay
  without writes; changed payloads, contract/consent mismatches, cross-scope links, out-of-range or
  regressing watermarks, and unknown nested fields fail closed. Failed, truncated, and restricted
  attempts remain auditable and can be followed by a successful retry over the same range without
  checkpoint loss.
- A restricted transition must carry restricted coverage, the exact prior checkpoint, no cursor,
  and no snapshot ID. It writes only the immutable job and coverage rows, replays idempotently, and
  remains nonnumeric through `completeObservedUnits`; its physical zero placeholder is never a
  complete observation. The contract/fingerprint bump deliberately rejects prior `2.1.0` or
  tampered extension schemas unchanged because this opt-in extension has no activated real store.
- Scope deletion explicitly enumerates all four owned tables, removes only the selected synthetic
  scope, preserves an unrelated scope, and finishes with integrity, quick, and foreign-key checks.
  No generic JSON, receipt payload, provider string, cursor resume path, staging table, observation
  fact, backup, pack, or runtime call site is added.
- `server/connectors/github/coreAdapter.ts` is an injected invented-fixture adapter only. It asserts
  the core manifest is inert and `never_authorized`, snapshots validated caller input, and accepts a
  closed callback result shape; it imports no HTTP client, SDK, token, subprocess, selected scope,
  storage bridge, legacy collector, API route, or runtime scheduler.
- Every request is frozen and bound to the exact opaque scope, consent revision, query/API version,
  range, page number, and cursor. Accepted receipts and their unit-ID arrays are snapshotted before
  another callback can run. Extra fields, hostile echoes, duplicate receipts, cursor cycles, and
  post-validation callback mutation fail closed or cannot alter reconciliation.
- Collection starts at a null cursor, follows only the prior validated next cursor, and stops at a
  terminal page or a finite caller cap bounded to 1..1000. It delegates checkpoint, coverage, and
  retry/refusal classification to the reviewed core transition functions, never sleeps or schedules
  a retry, preserves non-complete checkpoints, and marks every result `invented_fixture`.
- `server/connectors/github/coreAdapter.test.ts` uses invented opaque values only and proves strict
  marker/shape/checkpoint refusal, sequential pagination, terminal/cap behavior, closed failure
  classification, request/input/receipt mutation resistance, duplicate/cycle refusal, and no retry
  scheduling or callback-error leakage.
- `server/connectors/github/activationTask.ts` is the first task-scoped activation boundary. Its
  strict schema accepts one public repository, public unauthenticated access, three exact lifecycle
  resource classes, a 20-request ceiling, the charter lifetimes, explicit failure coverage,
  application-controlled rollback/deletion declarations, and task-owned ignored paths. Unknown or
  weakened fields fail with one stable content-free error; the parsed result is deeply frozen.
- The tracked parser contains no selected repository value, task path, provider response, token,
  network call, filesystem loader, database opener, or activation switch. Invented tests prove
  hostile extras, credentials, private visibility, unsafe budgets/timestamps/identifiers, path
  traversal, and weakened retention/coverage/rollback/deletion are rejected. The actual task card
  remains ignored and local.
- `server/connectors/github/activationTaskLoader.ts` accepts only snapshotted own data properties for
  an absolute workspace root and opaque task ID, derives the one canonical ignored `task-card.json`
  path, rejects static and raced symlink/junction or alternate-root escape, and binds path/ancestor
  rechecks plus portable device/inode identity to the same opened handle it reads. Accessors and
  caller mutation across awaits cannot redirect the task.
- The handle is nonblocking, must remain a regular file with stable size, and is read through a
  64 KiB ceiling before fatal UTF-8 decode. A bounded JSON scanner rejects duplicate object keys at
  every depth, including escape-equivalent keys, before ordinary parsing; all failures retain one
  content-free code and the strict parser still deep-freezes the card. Invented temporary fixtures
  prove accepted loading, accessor/mutation resistance, duplicate-key refusal, oversized/invalid-
  UTF-8 refusal, malformed/schema, traversal, wrong-root, and symlink cases. No production caller
  imports the loader, and no real ignored card was read. This is the bounded follow-up tracked by
  [#28](https://github.com/Chris0Jeky/developer-lens/issues/28).
- `server/connectors/github/restTransport.ts` is an injected public-unauthenticated GET-only seam.
  It constructs only the selected repository metadata and open issue/pull-request lifecycle URLs,
  fixes the API version, `Accept`, and non-identifying user-agent headers, disables redirects, and
  supplies no authorization or cookie surface. No caller, loader, scheduler, retry, sleep, token,
  environment, SDK, subprocess, filesystem, database, log, or output path is added.
- Metadata verifies the immutable numeric repository ID and public visibility before collection.
  Provider repository/node IDs are immediately passed through a caller-supplied domain-separated
  alias function; collisions fail closed. The returned frozen union contains only opaque aliases,
  repository flags, issue/pull-request kind, bounded timestamps, numeric page/unit observations,
  rate metadata, and content-free status codes. Restricted/failed results omit observational counts
  and flags so missing evidence cannot masquerade as zero or false.
- Pagination follows no provider URL. It validates a unique same-host/same-scope `rel="next"`,
  accepts GitHub's selected-name or immutable-ID path form, requires the next numeric page, and
  constructs its own request. A terminal page alone can complete; the card's total request budget
  and rate exhaustion truncate with an unknown total. Response bytes are size-bounded,
  process-lifetime only, and discarded after immediate field projection.
- Every accepted REST page receipt now snapshots the exact post-range-filter, post-global-dedup
  unit aliases projected from that page. Membership arrays are alias-only, sorted, freshly allocated,
  and frozen; each page's `unitCount` is derived from that exact array. This supplies deterministic
  page-local evidence for the next pure composition/hash/replay slice without retaining provider IDs
  or bodies.
- `server/connectors/github/restTransport.test.ts` uses invented fetch/response/alias fixtures. It
  proves exact headers and query construction, no authorization/cookie, identity/visibility
  refusal, poison-field excision, half-open range filtering, GitHub canonical pagination, terminal
  proof, request-cap and rate truncation, deduplication/collision refusal, response-size/schema and
  HTTP/network classification, content-free failures, and frozen result mutation resistance.
- `server/connectors/github/restComposition.ts` is a pure complete-only seam. It requires the exact
  selected scope and half-open card range, canonical range-bounded unit timestamps, one contiguous
  terminal page chain, exact counts, unique repository/unit/page aliases, and a one-to-one partition
  of every unit into frozen page-local membership before delegating to the existing core reconciler.
- Canonical serialization fixes the contract/query/API/scope/range flags and sorted unit/page
  evidence into a content-stable SHA-256 snapshot hash. The source-snapshot ID is separately derived
  from that hash plus the opaque collection job ID, so unchanged observations across distinct jobs
  replay with the same content hash without violating per-job snapshot identity. The frozen proposal
  includes sorted receipts, the terminal high watermark, and only the next page-receipt alias as its
  checkpoint cursor.
- Restricted, failed, truncated, rate-limited, or otherwise noncomplete REST results fail this seam
  closed. It performs no filesystem, network, environment, credential, database, scheduler, logging,
  export, or presentation action; complete and noncomplete entry points remain separate.
- The current pure noncomplete composer accepts only bound restricted, failed, metadata-only
  truncated, or coherent partial-page truncated results. Partial pages must be contiguous from one,
  partition every observed unit exactly once, and finish nonterminal with a real next-page alias;
  terminal pages, unbound failures, scope/range drift, count/member collisions, unknown facts, and
  out-of-range timestamps fail closed.
- It delegates only validated observations, actual page aliases, retry facts, and a transition-local
  cursor hint to the core noncomplete reconciler. Its frozen result contains only `{ transition }`:
  no content hash, source-snapshot ID, complete receipt fiction, checkpoint movement, filesystem,
  database, network, environment, scheduler, logger, export, or presentation path.
- The published storage-replay slice widens only the exported checkpoint-transition type to accept
  the already-validated noncomplete core union; SQL, schema version/fingerprint, and persistence
  runtime statements are unchanged. Invented in-memory composition tests feed complete and
  noncomplete REST composer outputs directly into the existing store. They prove same-job write-free
  replay, content-stable hashes with distinct job-bound snapshot IDs, complete checkpoint advance,
  and restricted/failed/metadata-only/partial truncation with no snapshot or checkpoint movement.
  Transition-local truncation cursors remain nondurable.
- `server/storage/installationAliases.ts` snapshots one caller-injected installation key of at
  least 32 bytes and exposes only closed repository, issue, pull-request, and page alias methods.
  The existing repository provider and analytical HMAC byte streams, domains, and `repo-` prefix
  remain exact; new GitHub-core domains are disjoint, and batch projection rejects duplicate
  identities or generated alias collisions without returning raw provider IDs.
- `server/storage/migrateV1.ts` now consumes that shared factory while preserving its exported
  `InstallationKeyError` contract. This does not create, load, persist, rotate, recover, or delete a
  key and does not wire aliases to REST collection; those issue #6 activation requirements remain
  open.

## D1 synthetic evidence-story path

- `src/components/V2StoryPath.tsx` maps the existing validated C0 insight array into one accessible
  ordered rail: observed, deterministic derived, then bounded hypothesis. Missing validated layers
  disappear instead of being invented, and each step repeats only its registered evidence headline.
- The rail adds no schema field, fetch, account/repository input, local-history read, model output,
  persistence, export, or generated dataset. `V2Demo` remains the only caller and keeps the existing
  public synthetic boundary copy visible above the story.
- Each step now names high, medium, or low confidence explicitly as evidence fit rather than a score
  about a person, and labels its existing caveat as a lens limit. Missing caveats stay missing instead
  of being invented; the exact material confidence and caveat text is included in the list item's
  accessible name as well as the visible rail.
- Desktop and 390 px in-app browser inspection found no horizontal overflow; the rail changes from
  three columns to a vertical connected path, with all three confidence/limit cues readable and no
  story-card clipping. Browser console errors and warnings were empty. The existing Observed filter
  remained keyboard/ARIA addressable and changed the live status from 3/3 to 1/3 with exactly one
  visible insight card.

## Durable continuation foundation

- `AGENTS.md` is the bounded cold-start contract: repository identity, source-of-truth map, current
  authority, protected-data task-card rule, exact seam checks, code map, Windows/native pitfalls,
  and handoff shape. Stable rules live there; volatile state remains in this ledger.
- `.agents/skills/developer-lens-continuation/` is the tracked resume workflow. It routes decisions,
  policy, architecture, user documentation and live evidence to their canonical files instead of
  loading or duplicating every historical prompt.
- `npm run verify:context` checks required context artifacts, the T2 `AGENTS.md` line budget, skill
  frontmatter/default prompt, internal Markdown links, and consistent G1/G2/G3/G4 markers across
  the live authority documents. It is part of `npm run check` because the gate drift recurred.
- Late automatic review of PR #9 found four direct gaps in that new verifier: a relative link could
  escape the checkout before `existsSync`, a valid optional Markdown link title was treated as part
  of the path, the tier file was checked only for presence, and incomplete skill frontmatter could
  pass the prefix check. The bounded follow-up rejects absolute/traversing paths before filesystem
  access, parses destinations separately from titles, asserts the declared T2/security/publication
  values, and validates the complete closed skill-frontmatter block with focused regressions.
- `docs/OVERNIGHT_EXECUTION_PROMPT.md` is reduced from a copied policy/queue snapshot to a thin
  launcher into `AGENTS.md`, the skill, owner decisions and live ledger. The deep-discovery prompt
  is explicitly historical.
- At that milestone G2/G3 were synchronized from the owner's then-current explicit instruction and
  G4 remained open: external
  transmission has separate provider terms, training/retention, telemetry, injection, spend,
  cache and deletion boundaries, so it cannot be inferred from local retention/source approval.
- No real/private input, generated dataset, credential, cache or browser profile was inspected.
  No collector, migration, runtime capability, external model or publication data path was
  activated by this documentation/control-plane slice.

## Dynamic swarm continuation

- `docs/OVERNIGHT_EXECUTION_PROMPT.md` now launches Sol Ultra as the sole coordinator over a
  dependency-aware lane queue. It discovers the runtime collaboration ceiling, fills every useful
  Luna slot, harvests results once, and replenishes immediately without imposing a smaller fixed
  fleet size or inventing work.
- Each lane has a unique ID, base HEAD, dependency state, exact path claim, worktree/writer,
  privacy/authority boundary, acceptance checks, rollback, and evidence handoff. Concurrent writers
  require separate coordinator-owned worktrees and non-overlapping paths; otherwise Luna remains a
  read-only inventory, mapping, triage, or review lane.
- Luna owns bounded mechanical work, Terra receives judgment-heavy implementation/review, and Sol
  retains architecture, privacy, owner gates, canonical context, integration, publication, and
  merge. At that milestone G2/G3 approval did not activate real sources and unapproved G4 remained
  a hard stop; the later 2026-08-04 provider-specific decision below supersedes only that G4 state.
- The prompt carries no volatile SHA, PR, or phase snapshot. It reads this ledger and live GitHub at
  startup and after each wave, so a larger future runtime ceiling is used automatically while the
  currently exposed ceiling remains a platform fact rather than repository policy.
- A fresh Sol Ultra forward run reconstructed the live four-slot scheduler without hidden expected
  output: primary Sol integration, Luna late-review triage, Luna P4 entry-point mapping, and Terra P4
  contract/test design. It respected the dirty checkout, produced unique queue cards, kept all first
  wave lanes read-only, preserved `never_authorized`, and left real migration/G4 blocked.
- That live refresh found three PR #10 comments which arrived after the prior closeout. Focused
  repairs now validate multiline Markdown labels, keep encoded `#` inside local filenames by
  splitting raw fragments before decoding, and reject YAML collection/implicit non-string scalars
  in skill metadata. No private path or file was used by the invented regressions.

## G4 OpenAI/Luna authority decision

- On 2026-08-04 the owner explicitly chose OpenAI as the provider, `gpt-5.6-luna` as the model, and
  `Llm__OpenAi__ApiKey` as the only credential environment variable. q-3 is closed with the exact
  provider contract in the data charter and capability matrix.
- The approved request is synchronous Responses API, standard tier, `store: false`, one request,
  no retry, at most 16,000 UTF-8 input bytes, at most 2,000 output tokens, and estimated cost at or
  below USD 0.01 after a fresh terms/pricing check. No hosted file/vector/embedding/search/tool,
  stateful conversation, background job, local cache, telemetry, or initially persisted output is
  allowed.
- Retrieval/RAG stays local over explicitly selected C1 analysis-pack facts. Only controlled codes,
  numeric values, bounded UTC intervals, coverage/limitation metadata, and request-scoped evidence
  IDs may cross the boundary. The provider response is a schema-validated C1 hypothesis and cannot
  reach presentation or export before local validation.
- Official OpenAI documentation checked on 2026-08-04 says API content is not used for training
  unless opted in, ordinary abuse-monitoring logs may contain prompts/responses by default for up
  to 30 days (with documented legal/service-protection exceptions), and encrypted prompt-cache
  state may remain for up to 24 hours. `store: false` avoids ordinary Responses application state
  but is not a Zero Data Retention claim.
- The capability registry contract advances to `1.1.0` with the provider/deletion metadata while
  retaining literal `never_authorized`. This authority slice adds no provider SDK, request code,
  credential read, payload, response, external call, local cache, telemetry, or model-output data.

## P12 default-off C1 contract, local retrieval, and OpenAI request foundation

- `server/externalModel/c1Contract.ts` accepts only four scalar ratio features from the architecture,
  request-scoped numeric evidence/claim IDs, the fixed consent/redaction revisions, exact V2
  coverage states, bounded UTC ranges, a 16,000-byte bundle ceiling, and closed statement,
  alternative, limitation, confidence, and unit vocabularies. Repository aliases/IDs, names, grain
  IDs, prose, paths, C2 values, actions, unknown fields/codes, and semantic identifiers fail closed.
- Feature-specific sample floors and complete coverage are required for a numeric value. Missing,
  restricted, censored, stale, or under-sampled facts carry `null`, never zero, and can support only
  a low-confidence `ABSTAIN_LOW_COVERAGE` claim. Non-abstaining claims must cite usable evidence of
  the exact feature associated with their statement code and may name only limitations present on
  that cited evidence.
- `server/externalModel/localRetrieval.ts` is a deterministic pure selector over caller-injected,
  already-approved C1 facts. It accepts only closed code filters plus a finite limit, rejects prose,
  unknown/duplicate IDs and oversized input, and sorts by feature then numeric opaque fact ID. It
  performs no filesystem, database, network, credential, environment, embedding, vector-store,
  hosted-tool, cache, telemetry, persistence, UI, export, or model operation.
- `server/externalModel/openaiResponses.ts` schema-validates a caller C1 bundle, a fresh injected
  price quote, a caller clock, and one injected callback. It builds only a synchronous standard-tier
  `POST https://api.openai.com/v1/responses` descriptor for `gpt-5.6-luna` with `store:false`, fixed
  instructions, no tools, and provider-native strict Structured Outputs derived from the closed
  local model-output schema.
- The full serialized body and C1 input are each limited to 16,000 UTF-8 bytes. Worst-case spend
  uses one token per body byte, the larger of standard input/cache-write prices, the requested output
  ceiling, an exact USD-per-million-token unit, and a price quote no older than 24 hours; estimates
  above USD 0.01 reject before the callback. The callback runs exactly once with no retry and may
  return only status plus structured output; all other fields, non-2xx status, unknown evidence, or
  semantic output mismatch fail with stable content-free errors.
- `server/externalModel/openaiActivationTask.ts` accepts only the owner-approved OpenAI/Luna
  boundary, named environment-variable identifier, standard tier, `store:false`, one request/no
  retry, finite timeout, exact byte/token/USD caps, strict output descriptor, and reviewed payload
  hash shapes. Model, pricing, data-control, and structured-output evidence must form one closed
  official-URL set, remain no more than 24 hours old, predate the exact review, and bind the price
  quote timestamp to the pricing evidence timestamp. Authorization must predate review; all accepted
  data is deeply frozen and every failure is content-free.
- The card explicitly distinguishes no local cache/telemetry/persistence from OpenAI's acknowledged
  provider-retention boundary. It authorizes no conversation/background mode, hosted tool/file/
  vector-store path, repository/source bytes, presentation, export, or public sink. Its bundle/body
  hashes are syntax-bound only until the next pure preview seam recomputes them.
- `server/activationTaskCardLoader.ts` extracts the already-proved confined JSON reader shared by
  task-scoped activation wrappers. It snapshots closed inputs, derives only the canonical ignored
  task-card path, rechecks real paths and portable opened-handle identity, requires one stable regular
  file no larger than 64 KiB, decodes UTF-8 fatally, rejects duplicate keys at every depth, and maps
  all failures to one content-free generic code. The GitHub wrapper preserves its existing API,
  local-boundary path, parser, freeze, error, and portable-identity export.
- The published `openaiActivationTaskLoader.ts` uses only that confined reader, the strict
  current-time OpenAI/Luna parser, and an exact `card.taskId` to requested-path cross-bind. It returns
  only the parser-frozen domain card and maps filesystem, JSON, schema, chronology, or task mismatch
  to one content-free OpenAI load error. It adds no arbitrary path, caller, environment, credential,
  network, provider, payload, cache, telemetry, persistence, log, export, or presentation surface.
- `buildOpenAiLunaRequestPreview` validates the C1 bundle once, returns the exact JSON string placed
  in the Responses body's `input` field with the same frozen credentialless descriptor, and is now
  the only implementation path used by `buildOpenAiLunaRequest`. This prevents the reviewed preview
  and eventual send descriptor from silently diverging.
- The published pure payload binder reparses the untrusted card at the supplied current time, builds
  the preview from its fresh price quote, hashes the exact UTF-8 bundle JSON and exact descriptor
  body, and requires the parsed bundle ID plus both lowercase SHA-256 values to equal the reviewed
  card. It returns one deeply frozen bound card/preview value and maps every parse, budget, freshness,
  or binding failure to one content-free code. It adds no filesystem, card read, environment,
  credential, network, provider, send callback, cache, telemetry, persistence, log, runtime caller,
  export, or presentation surface.
- The current candidate brands every bound preview with one module-private symbol plus process-local
  WeakSet membership, deep-freezes it, and revalidates card freshness, all three payload bindings,
  canonical bundle bytes, and the exact credentialless request immediately before credential access.
  The former exported callback sender is removed, so an unbound caller can no longer reach a send
  surface through `openaiResponses.ts`.
- `openaiHttpAdapter.ts` caps the complete response at 256 KiB, covers fetch and streamed body parsing
  with the reviewed finite timeout, disables redirects, performs exactly one fetch with no retry,
  requires a 2xx `application/json` terminal `completed` Luna response with one completed assistant
  `output_text`, and rejects refusal, nonterminal, duplicate-key, malformed UTF-8, oversize, unknown-
  output, invalid evidence, usage, or cost shapes with stable content-free errors. Raw bodies,
  provider IDs, metadata, errors, and the credential remain process-lifetime only; the frozen return
  contains only validated `ModelOutput` and four allowlisted numeric usage/cost fields.
- The production wrapper reads only `Llm__OpenAi__ApiKey` at invocation and uses global fetch. Its
  injected `@internal` proof seam still requires the genuine reviewed binding and passes only that
  exact credential identifier to the fake accessor. Tests use invented responses and a fake accessor;
  no real environment value, network, provider, cache, telemetry, persistence, log, export, or
  presentation path is touched. `cap.external.model` remains `never_authorized`, and there is no
  loader/task-card/runtime caller.

## Verification

- D1 reflection-question [PR #56](https://github.com/Chris0Jeky/developer-lens/pull/56) keeps its
  only new copy inside the registered C0
  public-demo payload and renders it as a static, accessible complementary region on the hypothesis
  card. The focused InsightStack/App suites passed 2 files / 6 tests; `npm run test:demo:v2` passed
  1 file / 5 tests. After rebasing onto key-continuity merge `4566448`, `npm run check` passed
  Oxlint, context verification, 42 test files / 240 tests, TypeScript project builds, and the
  production Vite build. `npm run build:showcase` passed invented
  export generation, social rendering, the showcase build, synthetic identity/export-boundary
  verification, and secret/path scans; `git diff --check` passed. In-app browser inspection at the
  normal desktop viewport and 390 x 844 found the question visible, readable, filter-preserving, and
  free of horizontal document overflow. Fresh exact-base review found no CRITICAL/HIGH correctness,
  public-sink, humane-copy, accessibility, responsive, or missing-test defect. Its nonblocking
  schema-layer coupling and unusually small-copy observations are tracked in
  [#55](https://github.com/Chris0Jeky/developer-lens/issues/55) rather than expanding this slice. The
  PR merged with commit preservation at `57eef92`; exact-merge hosted Pages run `30897542519`
  passed the full gate, synthetic showcase privacy verifier, artifact upload, and deployment. Both
  job annotation lists and the post-merge review sweep were empty.
- P4 key-continuity [PR #60](https://github.com/Chris0Jeky/developer-lens/pull/60) published logic
  commit `73c9e03` and evidence commit `0e90548` on activation-runner merge `cdae7c1`. The focused
  key suite passed 1 file / 12 tests. `npm run check` passed Oxlint, context
  verification, 42 test files / 240 tests, TypeScript project builds, and the production Vite build;
  `git diff --check origin/main..HEAD` passed. Tests cover exclusive creation, reopen continuity,
  exact fingerprint mismatch, short/oversized/changed keys, closed inputs and mutation, canonical
  path/directory confinement, junction/hard-link/race refusal, two stable reads, buffer zeroing,
  restrictive POSIX mode, and exact >2^53 Windows file identities. Fresh review found and fixed the
  unsafe numeric-inode comparison; final exact-rebased interaction review found no remaining
  CRITICAL/HIGH defect. That review also confirmed the published activation runner does not import
  or call this key API. Its separate raw-key/card-hash inputs, copied-key zeroing, and durable
  expected-fingerprint binding remain mandatory work for the future bound caller rather than an
  activation claim in this inert slice. The PR merged with commit preservation at `4566448`; exact-
  merge hosted Pages run `30896810539` passed the full gate, synthetic showcase privacy verifier,
  artifact upload, and deployment. Both job annotation lists and the post-merge review sweep were
  empty.
- P4 activation-runner [PR #58](https://github.com/Chris0Jeky/developer-lens/pull/58) published logic
  commit `59e0a2a` on HTTP-adapter merge
  `1f17095`. The focused hash-bound loader/runner suites passed 2 files / 16 tests. `npm run check`
  passed Oxlint, context verification, 41 test files / 228 tests, TypeScript project builds, and the
  production Vite build; `git diff --check origin/main..HEAD` passed. Direct regressions cover exact
  opened-byte card-hash mismatch, zero-fetch closed-input/alias/card/budget failures, odd request-
  ceiling splits, honest first/second noncomplete persistence, two-read stable completion, unequal-
  hash `SNAPSHOT_UNSTABLE`, checkpoint preservation, and prior card-consent mismatch. Fresh-context
  read-only review found no current CRITICAL/HIGH defect in the inert no-production-caller
  foundation. It classified trusted approval/hash anchoring, task-owned DB/key continuity, backup/
  report/restore, revocation/re-consent, and caller-clock binding as mandatory blockers before a
  future bound caller or first GET. The valid-card request-budget edge below four requests remains
  honestly truncated and capped; a future caller must either reject it before GET or document that
  it cannot support two metadata-plus-page probes. That nonblocking runtime-contract edge is tracked
  in [#57](https://github.com/Chris0Jeky/developer-lens/issues/57) rather than expanding this slice.
  The PR merged with commit preservation at `cdae7c1`; exact-merge hosted Pages run `30895851639`
  passed the full gate, synthetic showcase privacy verifier, artifact upload, and deployment. Both
  job annotation lists and the post-merge review sweep were empty, and issue #44 closed.
- P12 HTTP-adapter [PR #54](https://github.com/Chris0Jeky/developer-lens/pull/54) was rebased onto
  failure-pairing merge `8ca3a62`;
  `server/connectors/github/activationTaskLoader.test.ts`, the OpenAI card-loader, request, preview,
  and HTTP-adapter suites passed 5 files / 32 tests.
  `npm run check` passed Oxlint, context verification, 40 test files / 221 tests, TypeScript project
  builds, and the production Vite build; `git diff --check` passed. Tests injected only invented
  credentials/responses and never referenced the real process environment variable. Exact rebased-
  head adversarial review found no CRITICAL/HIGH credential, request-byte, timeout, response-shape,
  usage/cost, raw-discard, or API-surface defect. The PR merged with commit preservation at
  `1f17095`; exact-merge hosted Pages run `30892681308` passed the full gate, synthetic privacy
  verification, artifact upload, and deployment. Both job annotation lists were empty, and the
  post-merge sweep contained no finding.
- P4 failure-pairing [PR #53](https://github.com/Chris0Jeky/developer-lens/pull/53) merged as `8ca3a62`
  after rebasing onto zero-page merge `fa4e194`; it maps `rate_limited` only to `RATE_LIMITED` and
  every other closed failure kind only to `FAILURE_<KIND>`. Mismatches reject before a transition;
  the REST composer canonicalizes provider-facing `TRANSIENT` to `FAILURE_TRANSIENT` while preserving
  retry classification. The focused suites passed 4 files / 56 tests and `npm run check` passed 39
  files / 214 tests, Oxlint, context, TypeScript, and Vite; `git diff --check` passed. Exact review
  found no CRITICAL/HIGH defect. Exact-merge hosted Pages run `30891660795` passed the full gate,
  privacy verification, artifact upload, and deployment, closing
  [#42](https://github.com/Chris0Jeky/developer-lens/issues/42).
- Pages Node 24 actions [PR #51](https://github.com/Chris0Jeky/developer-lens/pull/51) merged as
  `97498b2` and advances `configure-pages` from v5 to v6,
  `upload-pages-artifact` from v4 to v5, and `deploy-pages` from v4 to v5. Their official releases
  move the JavaScript actions to Node 24 and the composite uploader to `upload-artifact` v7; build
  commands, permissions, artifact path, environment, triggers, concurrency, and public-data route are
  unchanged. `npm run check` passed Oxlint, context verification, 39 test files / 213 tests,
  TypeScript project builds, and the production Vite build. `npm run build:showcase` regenerated and
  verified only the invented synthetic artifact; `git diff --check` passed. Exact-merge hosted Pages
  run `30890398493` passed the full gate, privacy verification, artifact upload, and deployment. Both
  hosted job annotation lists were empty, directly closing
  [#31](https://github.com/Chris0Jeky/developer-lens/issues/31).
- P4 zero-page truncation [PR #52](https://github.com/Chris0Jeky/developer-lens/pull/52) merged as
  `fa4e194` and accepts only a fully observed public repository-metadata shape
  with empty unit/page arrays and exact zero counts after request-budget or rate-limit truncation.
  It produces frozen noncomplete coverage with no applied receipt, cursor, snapshot, or checkpoint
  movement; incoherent empty-page/count/unit combinations still fail closed. The focused core, REST
  transport/composition, and composition-to-storage suites passed 4 files / 55 tests, including
  invented in-memory persistence and write-free replay of the new outcome. Exact-merge hosted Pages
  run `30891084948` passed the full gate, privacy verification, artifact upload, and deployment; its
  post-merge sweep was empty, closing [#46](https://github.com/Chris0Jeky/developer-lens/issues/46).
- P4 storage-replay [PR #50](https://github.com/Chris0Jeky/developer-lens/pull/50) merged as `41df4fc`
  after rebasing onto payload-preview merge `2d4cdc7`; the focused core,
  REST composition, incremental storage, and cross-seam storage suites passed 4 files / 64 tests.
  `npm run check` passed Oxlint, context verification, 39 test files / 213 tests, TypeScript project
  builds, and the production Vite build; `git diff --check` passed. The pre-rebase exact-range review
  found no CRITICAL/HIGH replay, snapshot-identity, checkpoint, cursor-durability, or storage-boundary
  defect. Exact rebased-head interaction review likewise found no CRITICAL/HIGH correctness, privacy,
  data-loss, payload-preview interaction, or persistence-invariant defect. Exact-merge hosted Pages
  run `30889631382` completed successfully; its post-merge sweep contained no finding. Its Node 20
  action-runtime annotations were closed by PR #51.
- P12 payload-preview [PR #49](https://github.com/Chris0Jeky/developer-lens/pull/49) merged as
  `2d4cdc7` after rebasing onto confined-card-loader merge `277e2c3`; the focused C1, request,
  activation-card, and preview suites passed 4 files / 21 tests. `npm run check` passed Oxlint,
  context verification, 38 test files / 211 tests, TypeScript project builds, and the production Vite
  build; `git diff --check` passed. Exact rebased-head review found no CRITICAL/HIGH serialization-
  drift, UTF-8 hash, three-binding, freshness, freeze, error-content, or credential/network-surface
  defect. Exact-merge hosted Pages run `30888766166` completed successfully; its post-merge sweep
  contained no finding.
- P12 confined-card-loader [PR #48](https://github.com/Chris0Jeky/developer-lens/pull/48)
  merged as `277e2c3` after rebasing onto noncomplete-composition merge `7b97d31`; the
  focused GitHub loader, activation parser, and OpenAI loader suites passed 3 files / 20 tests. `npm
  run check` passed Oxlint, context verification, 37 test files / 206 tests, TypeScript project builds,
  and the production Vite build; `git diff --check` passed. Prior and exact-base fresh-context reviews
  found no CRITICAL/HIGH path-confinement, opened-handle, duplicate-key, task-cross-bind, freeze,
  error-content, or GitHub-compatibility defect. Exact-merge hosted Pages run `30887985029` completed
  successfully; its post-merge sweep contained no finding.
- P4 noncomplete-composition [PR #47](https://github.com/Chris0Jeky/developer-lens/pull/47)
  merged as `7b97d31` after rebasing onto noncomplete-foundation merge `2dcab1b`; the
  focused core/REST transport/composition suites passed 3 files / 53 tests. A first full check run
  concurrently with another repository-wide suite timed out only the unchanged DuckDB analysis-pack
  test at 5 seconds. The failed seam then passed alone in 529 ms (1 file / 5 tests), and the sequential
  `npm run check` passed Oxlint, context verification, 36 test files / 200 tests, TypeScript project
  builds, and the production Vite build; `git diff --check` passed. Exact rebased-head review found
  no CRITICAL/HIGH bound-result, outcome, pagination, membership, mutation, or false-snapshot/
  checkpoint defect. Exact-merge hosted Pages run `30887572753` completed successfully; its post-
  merge sweep contained no finding.
- P4 noncomplete-foundation [PR #45](https://github.com/Chris0Jeky/developer-lens/pull/45)
  merged as `2dcab1b` after rebasing onto C1-range-date merge `e239fed`; the focused
  core/REST transport suites passed 2 files / 28 tests. `npm run check` passed Oxlint, context
  verification, 36 test files / 197 tests, TypeScript project builds, and the production Vite build;
  `git diff --check` passed. Exact rebased-head fresh-context review found no CRITICAL/HIGH bound/
  unbound range, rate-limit, retry, checkpoint-preservation, mutation, or false-completion/snapshot
  defect. Exact-merge hosted Pages run `30887030243` completed successfully; its post-merge sweep
  contained no finding.
- P12 C1-range-date [PR #43](https://github.com/Chris0Jeky/developer-lens/pull/43)
  merged as `e239fed` after rebasing onto story-uncertainty merge `9cbfd1d`; the focused C1,
  request, and activation suites passed 3 files / 16 tests. `npm run check` passed Oxlint, context
  verification, 36 test files / 193 tests, TypeScript project builds, and the production Vite build;
  `git diff --check` passed. Exact rebased-head fresh-context review found no CRITICAL/HIGH calendar-
  validity, supported-format, range-limit, content-free-error, or request-integration defect. Exact-
  merge hosted Pages run `30886154361` completed successfully; its post-merge sweep contained no
  finding.
- D1 story-uncertainty [PR #40](https://github.com/Chris0Jeky/developer-lens/pull/40)
  merged as `9cbfd1d` after rebasing onto complete-composition merge `581cd58`; the focused
  story suite passed 1 file / 3 tests and `npm run test:demo:v2` passed 1 file / 5 tests. `npm run
  check` passed Oxlint, context verification, 36 test files / 191 tests, TypeScript project builds,
  and the production Vite build; `git diff --check` passed. Desktop and 390 x 844 in-app browser
  inspection found readable confidence/limit cues, correct wrapping, exact accessible names, and no
  console errors or warnings. Exact rebased-head fresh-context review found no CRITICAL/HIGH humane-
  copy, accessibility, missing-data, or responsive defect. Exact-merge hosted Pages run
  `30885521668` completed successfully; its post-merge sweep contained no finding.
- P4 complete-REST-composition [PR #39](https://github.com/Chris0Jeky/developer-lens/pull/39)
  merged as `581cd58` after rebasing onto canonical-price-date merge `f7aa9f4`;
  the focused REST transport/composition suites passed 2 files / 31 tests. `npm run check` passed
  Oxlint, context verification, 36 test files / 190 tests, TypeScript project builds, and the
  production Vite build; `git diff --check` passed. Exact rebased-head fresh-context review found
  no CRITICAL/HIGH range-binding, pagination, membership, hashing, per-job identity, freezing, or
  transport-regression defect. Exact-merge hosted Pages run `30884911163` completed successfully;
  its post-merge sweep contained no finding.
- P12 activation-card [PR #36](https://github.com/Chris0Jeky/developer-lens/pull/36)
  merged as `a2b7cab`; exact-merge hosted Pages run `30882690146` completed successfully. Its late
  automated review identified a direct evidence-gate defect: a textually shaped but impossible
  `priceQuote.verifiedAt` date could normalize to the pricing-evidence date. The bounded follow-up
  rejects normalization in both the exported quote schema and request parser; its focused activation/
  request suites passed 2 files / 10 tests, and `npm run check` passed Oxlint, context verification,
  35 test files / 168 tests, TypeScript project builds, and the production Vite build;
  `git diff --check` passed. Fresh-context review found no CRITICAL/HIGH canonical-date, accepted-
  format, schema-integration, or freshness defect.
- P12 activation-card candidate was rebased onto page-membership merge `5b19f28`; the activation and
  request suites passed 2 files / 10 tests. `npm run check` passed Oxlint, context verification, 35
  test files / 168 tests, TypeScript project builds, and the production Vite build; `git diff --check`
  passed. Exact final fresh-context review after the bounded provider-retention wording correction
  found no CRITICAL/HIGH authority, chronology, evidence, closed-set, privacy, freezing, error-
  content, or request-regression defect.
- P4 page-membership [PR #35](https://github.com/Chris0Jeky/developer-lens/pull/35)
  merged as `5b19f28` after rebasing onto restricted-storage merge `e0ed726`; the focused REST suite
  passed 1 file / 9 tests. `npm run check` passed Oxlint, context verification, 34 test files / 163 tests, TypeScript
  project builds, and the production Vite build; `git diff --check` passed. A fresh-context review
  found no CRITICAL/HIGH range-filtering, deduplication, alias-only membership, determinism, or
  mutation-safety defect. Exact-merge hosted Pages run `30881810351` completed successfully; its
  late automated review contained no finding.
- P4 restricted-storage [PR #34](https://github.com/Chris0Jeky/developer-lens/pull/34)
  merged as `e0ed726` after rebasing onto OpenAI request merge `4ee986e`; the focused incremental
  storage suite passed 1 file / 19 tests. `npm run check` passed Oxlint, context verification, 34 test files / 163 tests,
  TypeScript project builds, and the production Vite build; `git diff --check` passed. Direct
  regressions cover status alignment, prior-checkpoint preservation, no snapshot/cursor, nonnumeric
  derived observation, stable limitation, idempotent replay, rollback, scope deletion, exact
  version/fingerprint, and fail-closed prior-schema handling. Exact-merge hosted Pages run
  `30881367082` completed successfully; its late automated review contained no finding.
- P12 request-contract candidate [PR #33](https://github.com/Chris0Jeky/developer-lens/pull/33)
  was rebased onto installation-alias merge `eae8370`; the focused request suite passed 1 file / 5
  tests. `npm run check` passed Oxlint, context verification, 34 test files / 159 tests, TypeScript
  project builds, and the production Vite build; `git diff --check` passed. Final fresh-context fix
  review found no CRITICAL/HIGH provider-schema, service-tier, spend, privacy, or no-retry defect.
- P4 installation-alias candidate [PR #32](https://github.com/Chris0Jeky/developer-lens/pull/32)
  was rebased onto loader-hardening merge `0a8925a`; the focused alias and migration suites passed
  2 files / 23 tests. `npm run check` passed Oxlint, context verification, 33 test files / 154
  tests, TypeScript project builds, and the production Vite build; `git diff --check` passed. A
  fresh-context review found no CRITICAL/HIGH identity-continuity, migration-compatibility,
  collision, privacy, or raw-ID escape defect.
- P4 loader-hardening proof after rebasing onto C1 merge `6032394`: the focused loader suite passed
  1 file / 9 tests; `npm run check` passed Oxlint, context verification, 32 test files / 149 tests,
  TypeScript project builds, and the production Vite build; and `git diff --check` passed. Direct
  regressions cover snapshotted data properties, getter refusal, caller mutation across the first
  await, top-level/nested/escape-equivalent duplicate keys, the 64 KiB ceiling, fatal UTF-8 decode,
  canonical path confinement, unavailable/mismatched opened-file identity, and stable content-free
  errors.
- P12 C1 contract/retrieval proof after rebasing onto synthetic story merge `523899d`: the two
  focused suites passed 2 files / 7 tests; `npm run check` passed Oxlint, context verification,
  32 test files / 144 tests, TypeScript project builds, and the production Vite build; and
  `git diff --check` passed. The fix round added direct canaries for opaque IDs, forbidden identity/
  prose fields, exact V2 coverage, null-not-zero evidence, sample floors, mandatory abstention,
  statement/feature and limitation/evidence compatibility, byte budget, duplicate IDs, stable
  errors, deterministic permutations, and closed retrieval filters.
- D1 story-path proof after rebasing onto loader merge `1d655cf`: `npm run test:demo:v2` passed
  1 file / 5 tests; the focused story/App/insight suite passed 3 files / 8 tests; `npm run check` and
  `npm run build:showcase` passed; and `git diff --check` passed. Browser inspection covered the
  default desktop layout, a 390 x 844 responsive viewport, zero horizontal overflow, accessible
  observed/derived/hypothesis ordering, and the Observed filter's 1-of-3 result state.
- P4 protocol proof on the published PR #16 candidate: the focused invented-receipt suite passed
  1 file / 15 tests; `npm run check` passed Oxlint, context verification, 24 test files / 92 tests,
  TypeScript project builds, and the production Vite build after merging the current published
  baseline. `git diff --check` passed. Vite emitted only the existing >500 kB chunk-size advisory.
- P4 storage proof on the current publication candidate: the focused actual-SQLite suite passed
  1 file / 11 tests. It covers explicit additive installation, unchanged P2 rows/version, atomic
  complete/failed/truncated writes, empty-terminal snapshots, strict canaries, immutable replay,
  same-range recovery, half-open/monotonic checkpoints, three injected rollback boundaries,
  cross-scope FK refusal, full scoped deletion, and database health. `npm run check` passed Oxlint,
  context verification, 25 test files / 103 tests, TypeScript builds, and the production Vite build;
  `git diff --check` passed. Vite emitted only the existing >500 kB advisory.
- P4 adapter proof on the current publication candidate: the focused invented-fixture suite passed
  1 file / 10 tests; server TypeScript, scoped Oxlint, and `git diff --check` passed. The full
  `npm run check` gate passed Oxlint, context verification, 26 test files / 113 tests, TypeScript
  project builds, and the production Vite build. Vite emitted only the existing >500 kB advisory.
  The bounded review found one HIGH callback-ownership defect; the fix snapshots/freeze-copies each
  accepted receipt and unit-ID array. Its direct inter-page mutation regression passed, and the
  required fresh scoped fix review found no remaining CRITICAL/HIGH defect.
- Dynamic-swarm/context proof on `codex/sol-ultra-swarm-prompt`: both the tracked continuation skill
  and the updated user-global routing skill passed the official skill validator;
  `npm run verify:context` passed 12 Markdown files / 10 required files, including the new swarm
  markers; `npm run check` passed Oxlint, 23 test files / 76 tests, TypeScript project builds, and
  the production Vite build; `npm audit --omit=dev` reported zero vulnerabilities; and
  `git diff --check` passed. Vite emitted only the existing >500 kB chunk-size advisory.
- The focused context suite covers all three late PR #10 cases while remaining 1 file / 5 grouped
  tests: a multiline-label missing link is discoverable, `%23` remains part of the decoded filename,
  and YAML collections/booleans/numbers/dates reject as non-string frontmatter. The fresh Sol Ultra
  scheduler run reconstructed all four live slots and the correct P4-centered ready/blocked queue.
- Durable-context proof on `codex/durable-project-context`: the official skill validator accepted
  `.agents/skills/developer-lens-continuation`; `npm run verify:context` found all 10 required
  artifacts, kept `AGENTS.md` within its 100-line T2 budget, verified authority markers and 12
  Markdown files' local links; `npm audit --omit=dev` reported zero vulnerabilities; and
  `git diff --check` passed. `npm run check` passed Oxlint, context verification, 22 test files / 71
  tests, TypeScript project builds, and the production Vite build. Vite emitted only the existing
  >500 kB chunk-size advisory.
- A fresh-context forward test used only the tracked continuation skill and repository evidence. It
  recovered P4 as the next phase and produced the bounded synthetic `github.core` checkpoint,
  idempotency and coverage task card recorded below, while correctly excluding real reads,
  credentials, persistence, runtime wiring, public data and G4. It also surfaced that G2/G3 are not
  durable on the published baseline until this authority/context change lands; that is the intended
  publication gap, not an activation claim.
- `npm run build:showcase` was not rerun locally because this slice changes documentation, the
  repository continuation skill and the ordinary check gate only; it cannot alter showcase input,
  export, verifier or built public data. The merge-triggered Pages workflow remains the hosted
  exact-merge showcase proof.
- Context-verifier follow-up focused proof passed 1 file / 5 tests, including POSIX/encoded/Windows
  path-escape canaries, titled and angle-wrapped Markdown destinations, complete skill frontmatter,
  and sensitive-data authority drift. `npm run verify:context`, Oxlint,
  `npx tsc -p tsconfig.server.json --noEmit`, and `git diff --check` passed with the fix present.
  `npm run check` then passed 23 test files / 76 tests, TypeScript project builds, and the production
  Vite build; `npm audit --omit=dev` reported zero vulnerabilities. Vite emitted only the existing
  >500 kB chunk-size advisory.
- Dependency metadata/probes: `npm view` resolved `@duckdb/node-api@1.5.5-r.3`, its pinned
  `@duckdb/node-bindings@1.5.5-r.3`, and the exact `win32-x64` package. A local native probe loaded
  DuckDB `v1.5.5`, wrote a 315-byte deterministic Parquet fixture, and replayed ordered rows under
  Node `v24.13.1` / npm `11.8.0` and Node `v20.20.2`, both on Windows x64. The install audited 355
  packages with zero reported vulnerabilities; final `npm audit --omit=dev` also reported zero.
- P3 focused proof at reviewed fix commit
  `5acba15db7ee24bc73f291510908494d82995eba` passed 1 file / 4 tests. It builds two byte-identical
  packs through paths containing spaces/backslashes despite two different hostile caller `packId`
  properties, replays the same DuckDB summary repeatedly, proves the SQLite source bytes unchanged,
  excludes the caller values and invented C2/capability-policy canaries, and fails closed for missing
  `COMPLETE`, corrupt Parquet, and an internally re-checksummed model declaration.
  `npx tsc -p tsconfig.server.json --noEmit` passed.
- `npm run check` passed lint, 22 test files / 71 tests, TypeScript project builds, and the Vite
  production build. Vite emitted only the existing >500 kB chunk-size advisory. `git diff --check`
  passed before the implementation commit.

- P2 migration-contract follow-up at pre-fix head
  `270ec16ba46090673420328cee2159057a236b3b`: the focused migration proof passed 1 file / 15 tests;
  `npm run check` passed lint, 21 files / 64 tests, TypeScript, and the Vite build;
  `npm run build:showcase` passed synthetic export, social render, showcase build, identity/export
  boundary verification, and secret/path scans; `npm audit --omit=dev` reported zero vulnerabilities;
  and `git diff --check` passed. The source JSON byte-preservation assertions cover successful and
  failed replacement imports.
- The HMAC fix round adds synthetic missing/short-key failure, full
  domain-separated installation-key alias, plain-hash non-equivalence, key-scope, raw repository-ID
  absence, and transformed-ID collision regressions. Focused migration proof passed 1 file / 18 tests;
  `npm run check` passed lint, 21 files / 67 tests, TypeScript, and the Vite build;
  `npm run build:showcase`, `npm audit --omit=dev`, and `git diff --check` passed. Fresh-context
  exact-head review found no CRITICAL/HIGH blocker, and every PR #3/#4 review thread is resolved.
- Exact-merge Pages run
  [30808929258](https://github.com/Chris0Jeky/developer-lens/actions/runs/30808929258) passed the
  full gate, synthetic showcase privacy verifier, and deployment at `1171a42`; the published site
  returned HTTP 200.
- q-4 publication preflight with the current policy/declaration diff present: `npm run check` passed
  lint, 21 files / 61 tests, TypeScript, and the Vite build; `npm run build:showcase` passed export,
  social render, showcase build, synthetic identity/export-boundary checks, and secret/path scans;
  the focused migration proof passed 1 file / 12 tests; `npm audit --omit=dev` reported zero
  vulnerabilities; and `git diff --check` passed. The complete tracked range contains only source,
  tests, documentation, package metadata, the repository declaration, and invented synthetic
  fixtures; `git ls-files -ci --exclude-standard` returned no tracked ignored paths.
- The publication scan found zero credential/private-key patterns, zero machine-specific absolute
  paths after repair, zero private registry identifiers or live metadata, 62/62 valid repository-
  relative evidence links, and only public GitHub repository links. Canonical agent-harness 1.6.25
  source resolved the declared `origin` route to the exact public repository. The broader harness
  audit remains red only for the pre-existing missing root `AGENTS.md`; no harness bootstrap or
  runtime-hook activation was added as a publication detour.
- P2 ownership follow-up at executable head `d13cab2a48c92cf0020ee783b785e296a1f923ac`:
  `npm test -- server/storage/migration.test.ts` passed 1 file / 12 tests; `npm run check` passed
  lint, 21 files / 61 tests, TypeScript, and the Vite build; `npm run build:showcase` passed export,
  social render, showcase build, identity/export-boundary verification, and secret/path scanning;
  `npm audit --omit=dev` reported zero vulnerabilities; `git diff --check` passed. Final fresh review
  confirmed the wildcard-collision HIGH closed with no new CRITICAL defect.
- P2 executable checks at head `8c8f3090b31790e7038427c0a3015e0bfb2ba3d3`
  (green checks do not override the later ownership finding):
  `npm test -- server/storage/migration.test.ts` passed 1 file / 11 tests. `npm run check` passed
  lint, 21 files / 60 tests, TypeScript, and the Vite build. `npm audit --omit=dev` reported zero
  vulnerabilities; `git diff --check` passed. The local native probe loaded
  `better-sqlite3@12.11.1` with SQLite 3.53.2 on Node v24.13.1 / npm 11.8.0.

- Gate-decision review proof: `npm run check` passed with this documentation diff present — lint,
  20 test files / 48 tests, TypeScript project builds, and the Vite production build. Vite emitted
  only the existing >500 kB chunk-size advisory. No executable source changed in this slice.
- Documentation proof: `git diff --check`, relative/local link validation, the 13-row capability
  inventory, zero open `HUMAN_TODO.md` checkboxes, the two-fence copy-ready prompt check, and the
  seven-column estate-row check passed. Fresh narrow reviews found no CRITICAL/HIGH defect in the
  project policy/prompt or estate sync.
- P1 final focused proof: `npm test -- server/privacyContract.test.ts` passed 7/7.
- P1 final full proof: `npm run check` passed lint, 20 files / 48 tests, TypeScript, and Vite build.
  Vite emitted only the existing >500 kB chunk-size advisory.
- Synthetic Draft 2020-12 manifest proof accepted a valid redacted aggregate and rejected
  `synthetic_public` plus a C2 artifact.
- Exact six-file cached set and whitespace checks were clean before the implementation commit.
- Review round one found two HIGH blockers: a public-manifest ceiling bypass and a false-complete
  coverage state. Sol's privacy pass also found cross-sink schema reuse; the same bounded fix batch
  added public/private separation, sink binding, nested-object refusal, and coverage arithmetic.
- Fresh round-two review of those changed risk seams found no remaining CRITICAL/HIGH defect.

## Failures and workarounds

- Fresh key review proved that numeric `Stats.ino` on this Windows host exceeded JavaScript's safe-
  integer range, so distinct file identities could compare equal after rounding. Every file and
  directory identity read now uses `{ bigint: true }`, nanosecond timestamps, and exact bigint
  comparisons; a direct >2^53 collision regression and the unchanged focused/full gates passed.
- The key worktree had no local dependencies. After matching the lockfile hash and Node major, tests
  used a temporary ignored junction to the primary install. The junction was verified and removed
  nonrecursively after each run; the exact-rebased full gate then passed. After the exact merge gate,
  generated `dist/` was the only ignored entry and the coordinator removed the worktree without
  force.
- The isolated runner worktree initially had no local dependencies. The worker used a temporary
  ignored `node_modules` junction only after proving the package-lock hash and Node major matched the
  primary checkout. PowerShell junction removal then raised a `NullReferenceException`; the
  coordinator verified the exact worktree-local reparse point and its expected target, removed only
  the junction with nonrecursive .NET directory deletion, and proved the primary dependency target
  remained present. Generated `dist/` was the only ignored entry after the exact merge gate, and the
  coordinator removed the worktree without force.
- The first exact-head D1 reflection-question full gate passed 220 tests but the unchanged native
  analysis-pack determinism case exceeded its 5-second test timeout by 44 ms under concurrent work.
  It was not called flaky or treated as green: the exact analysis-pack file then passed 5/5 in
  1.92 seconds with 597 ms of test time, and the unchanged full gate passed 40 files / 221 tests on
  the bounded second attempt.
- Pre-publication inspection found that the first request draft omitted native Structured Outputs
  and an explicit standard service tier, and estimated input tokens as bytes divided by four. The
  fix adds the closed `text.format` JSON Schema, `service_tier: default`, cache-write pricing, and a
  one-token-per-byte upper bound; the focused and full gates passed.
- Fresh fix review then found Zod's Draft 7 conversion emitted unsupported `const` in the provider
  schema. The closed conversion now removes `$schema`, maps every `const` to a single-value `enum`,
  and recursively rejects unreviewed keywords or optional object properties before a request can be
  built. Direct regression, focused tests, TypeScript, lint, full gate, and final fix review passed.
- The first exact-head alias gate could not resolve `oxlint` because that isolated worktree had no
  local `node_modules`. A lockfile-pinned `npm ci` installed 354 packages with zero reported
  vulnerabilities; the unchanged full gate then passed 154/154 tests.
- The first complete adapter gate found 31 failures across the existing SQLite-dependent suites
  because this worktree's install lacked the `better-sqlite3` binding for Node ABI 137. No adapter
  assertion failed. `npm rebuild better-sqlite3` rebuilt the worktree-local native dependency; the
  three affected suites then passed 34/34 and the unchanged full gate passed 113/113.
- The first combined prompt/docs patch was rejected atomically because the shell-rendered README
  context showed mojibake in place of its real em dash. No partial edit landed; the same change was
  applied as smaller exact-context patches and all context checks passed.
- The first lint pass on the late-review scalar repair reported two unnecessary character-class
  escapes. The check was not treated as green; the expression was simplified and the full gate then
  passed without that warning.
- The first context-verifier run matched authority markers before collapsing wrapped Markdown
  whitespace, so a semantically present marker failed on a line break. The verifier now normalizes
  whitespace before exact marker checks and passed both directly and inside `npm run check`.
- The first late-review regression run passed four tests but correctly exposed that a Windows
  absolute target such as `C:\\private.txt` was classified as a URI scheme before the absolute-path
  guard. The guard now runs first; the focused suite then passed 5/5 without probing that path.
- The first exact publication scan caught 62 machine-specific evidence-link targets and live
  metadata copied from a private registry into the new public docs. The links were converted to
  repository-relative targets, the private URL/PR/SHA/check-state references were removed, and the
  complete tracked range was rescanned clean before any Developer Lens push.
- The first ad hoc link check treated existing absolute Markdown links with `:line` suffixes as
  filenames, and the first estate-table check searched for the wrong header label. Both validation
  scripts were corrected and rerun green; neither failure came from a repository artifact.
- The writer's first `npm run check` found a generic-entry TypeScript error in
  `shared/privacy.ts`; it was corrected and rerun green.
- The coordinator's first post-review full check passed lint and all 48 tests, then found one
  TypeScript narrowing error in the new public/private canary test. The test was branched
  explicitly by boundary; the focused test and complete check were rerun green.
- The first D1 review found one HIGH defect: visible insight fields were outside the registered
  public payload. A single bounded fix moved every displayed insight field into flat C0 arrays,
  validated the payload through the public sink, and reran the focused and full checks green.
- The first P2 writer check rejected a privacy-significant `subject_length` column name; it was
  renamed to `message_length`. A TypeScript parameter-property/unused-import failure was also fixed.
  Both were implementation regressions and the focused/full checks were rerun green.
- The first P2 review found four HIGH defects: unrelated SQLite ownership, post-commit integrity
  checks, unbounded persisted identifiers/categories, and invalid legacy `partial` coverage. One
  bounded fix batch moved checks inside the transaction, tightened ownership/projection, and mapped
  coverage conservatively. Coordinator inspection then found two partial-header tuples still
  accepted; the same batch closed them, 11 focused tests passed, and final fresh review was clean.
- The subsequent ledger review exercised the literal "non-empty" ownership claim and found that the
  guard queries only user tables. A view-only foreign zero-header database is therefore claimed and
  mutated. This is a P2 regression, not an environmental or pre-existing failure. The two-round
  ceiling parked the original slice; a separate smallest follow-up broadened the guard. Its first
  review then found the SQL `_` wildcard also hid `sqliteXview`; one fix batch switched both code and
  assertions to literal-prefix GLOB semantics. Focused/full/showcase checks and final review passed.
- The first focused run with the three new regressions failed exactly 3 of 15 tests: mapped GitHub
  coverage identities collided at validation, the producer local ID failed its slash check, and a
  replacement retained all six prior table populations plus both import checksums. After the bounded
  repair, all 15 focused tests and the full gate passed.
- The first P3 focused run used a Node-only Vitest environment directive, but the repository's
  unconditional shared setup accesses `window`; the suite stopped before collecting tests. The
  directive was removed, leaving the existing jsdom harness unchanged, and all four focused tests
  then passed.
- Running the whole P3 suite with a temporary Node 20 executable against the shared Node 24
  installation failed before the new producer ran: the existing `better-sqlite3` binary was built
  for ABI 137 while Node 20 requires ABI 115. The separate DuckDB/Parquet Node 20 native probe
  passed; the shared install was not rebuilt back and forth merely to manufacture a mixed-ABI run.
- The first fresh-context P3 review found one HIGH privacy defect: a caller-controlled `packId`
  could serialize a repository or identity label even though the table projection was C1-safe. The
  bounded fix removed that input, derived an opaque ID only from the declared timestamp and Parquet
  checksum, and added hostile extra-property regression coverage before rerunning the focused proof.
- The automatic old-head review found one HIGH policy defect: the required human-action file still
  described generated G2/G3/G4 decisions as binding. `HUMAN_TODO.md` now records those gates as open
  and keeps only the separately reaffirmed synthetic publication route checked.
- That repair was correct for the authority available at the time. The owner later explicitly
  approved G2 real migration/retention and standing G3 for named sensitive sources; the durable
  context slice records the newer decision without inventing an external-model decision.

## NOT verified

- A write-capable multi-worktree swarm was not launched merely to demonstrate concurrency. The
  forward test was read-only and proved queue construction, slot use, role escalation, ownership,
  and stop conditions without creating branches, worktrees, commits, or private-data reads.
- The active collaboration surface exposes four total slots including the coordinator. No editable
  numeric limit exists in the inspected Codex config/agent profiles, and behavior under a future
  larger platform ceiling is not locally executable; the prompt discovers that ceiling rather than
  persisting four as policy.
- A clean Node 20 install of the complete P2+P3 suite. DuckDB/Parquet itself is directly verified
  on Node v20.20.2 and v24.13.1 Windows x64, but this checkout's `better-sqlite3@12.11.1` binary is
  the Node 24 build and cannot be reused by Node 20.
- A local `npm run build:showcase` for P3; the server-only module had no public data path. The
  exact-merge hosted workflow later ran and passed that showcase/privacy gate.
- CLI, `dataStore`, collector, API, export, or Pages activation of SQLite; real/private JSON
  migration and the now-approved backup/grace/deletion protocol remain deliberately unexercised.
  Issues #5/#6 and a bounded migration task still precede a real read or reader switch.
- No real REST result is written into the incremental store. Complete and noncomplete
  composition-to-storage plus same-job/distinct-job replay are proved only with invented in-memory
  input; hostile-provider two-read stability, the real task card, Taskdeck scope, network, and task-
  owned database remain unread or unimplemented.
- Production adoption by existing collectors, storage, API, exporters, or Pages beyond the local
  synthetic route and showcase verifier.
- No pull-request CI lane exists; the exact-merge Pages build/deploy is the verified hosted gate.
- G2/G3 runtime behavior is not verified merely by approval: no real-data migration, retention
  cleanup, backup, deletion, or named sensitive connector ran in this slice. G4 is now approved
  only for the recorded OpenAI/Luna boundary. The C1/retrieval/request/adapter candidate remains
  process-local and default-off; no production wrapper, real environment value, external request, or
  provider response has run.
- The story-uncertainty slice was inspected in normal desktop and 390 x 844 viewport screenshots,
  but CSS-disabled and print rendering were not separately verified. Caveat text remains available in
  accessible names and the existing insight cards if the decorative rail cue is unavailable.

## Residual risk

- The user-global `$route-codex-work` skill now removes its one-or-two-reviewer soft cap, but that
  file is outside this repository and is not versioned by this PR. The tracked prompt, continuation
  skill, root instructions, and context markers independently carry the dynamic-saturation policy
  for Developer Lens; another machine's global router may still differ.
- Maximum concurrency can become counterproductive under measured RAM, test-process, or worktree
  contention. The scheduler defaults to the discovered ceiling, lowers active load only on evidence,
  and never trades away task deduplication, one-writer ownership, or privacy gates to fill a slot.
- P1 remains largely an inert contract foundation for existing v1 runtime paths; the D1 demo consumes
  the registered public seam only.
- P2 is a synthetic proof seam, not a general compatibility framework. Exact V2 headers are the
  intended ownership boundary; no real/private source or production reader uses the new database.
- P2 remains a disabled, synthetic proof without CLI/`dataStore`/API wiring; its reviewed ownership
  boundary is not evidence for unimplemented real-data migration or production compatibility.
- P3 is one deterministic C1 coverage table, not a general pack framework. It is unactivated and
  accepts only the two closed P2 capability IDs; future facts/tables need a separately reviewed
  class ceiling and schema. Native deployment must retain the platform binding/DLL selected by the
  optional dependency.
- PR #12 now detects a completed Parquet replacement that persists through replay by hashing the
  replayed file again before accepting it. Completed packs remain immutable by contract; an
  activated hostile-writer claim would still need an immutable snapshot or an equivalent stronger
  boundary to exclude an adversarial replace-read-restore sequence.
- The P12 request seam, activation-card parser, and confined loader validate caller-injected
  canonical pricing/evidence timestamps, freshness, and review chronology but cannot authenticate
  page content. The published pure preview recomputes and requires the reviewed bundle/body bindings.
  The published adapter adds credential/HTTP/output handling but deliberately has no card loader or
  runtime caller, provider request proof, output persistence, or presentation path; those remain
  separate reviewed boundaries before a real call.
- The exported `@internal` adapter core permits invented credential/fetch injection solely so tests
  never inspect the real process environment. It has no production import; the production wrapper
  alone reads the approved variable and native fetch. A malicious injected body could ignore
  `AbortSignal` and continue after the caller receives a timeout, so the future runtime runner must
  import only the production wrapper and must not expose injected dependencies as activation input.
- The shared reader returns mutable parsed `unknown` before domain validation. Its only production
  wrappers immediately parse and return deeply frozen GitHub/OpenAI cards; no generic value has a
  runtime consumer, and widening that surface would require a separate review.
- The published P4 runner composes the confined card loader, injected public REST transport, and
  opt-in storage bridge, but it has no production call site and still accepts its card hash, raw key,
  and database as separate caller inputs. The current key foundation can create and reopen an exact
  task-owned fingerprint but does not yet bind it to a durable reviewed report. Application-
  controlled backup/restore, installation-key lifecycle and mismatch enforcement, task-owned
  database binding, parity/fallback, tombstoned deletion/re-consent, and legacy
  collector compatibility remain reviewed activation seams. The published opened-handle proof
  closes path-replacement redirection, but its single byte read allowed a same-size in-place card
  write to race content bytes. B2b-ii-a closes that observed seam with two exact reads from one
  descriptor plus stable file and confined-directory identities. A future caller must still source
  the expected hash from durable owner-reviewed state; snapshot stability is not owner authority or
  a claim of atomicity against every hostile concurrent writer.
- The legacy local producer still permits spaces/Unicode in remote paths or fallback basenames while
  this bounded importer accepts only the registered ASCII repository-reference alphabet; that P2
  compatibility gap remains tracked in
  [#5](https://github.com/Chris0Jeky/developer-lens/issues/5) for the future canonical local-UUID/P6 seam.
- A P2 target represents one complete v1 snapshot. Atomic whole-snapshot replacement is now proved;
  multiple independent v1 sources sharing one target are unsupported and would need explicit row
  provenance/scoping before such a mode could be introduced.
- Existing JSON, raw API error behavior, late export sanitization, and person-shaped analytics
  retain the architecture's documented risks. They remain deferred in
  `docs/POST_DEMO_HARDENING.md` unless they cross the irreversible floor.
- Future producers must use the registered schemas and sink helpers; P1 has no production call
  sites by design.
- The repository now has a bounded Codex instruction/skill surface, but the separate estate row
  remains a live external registry fact and must be refreshed independently after this public
  authority change; do not copy private registry metadata here.

## Tracked non-blocking review findings

- The published C1 range-date repair closed
  [#37](https://github.com/Chris0Jeky/developer-lens/issues/37) by component-checking parsed UTC
  calendar fields. JavaScript's legacy year `0000`-`0099` arithmetic can still weaken the three-year
  cap for ancient ranges; current-era behavior is unaffected and the residual remains separately
  tracked in [#41](https://github.com/Chris0Jeky/developer-lens/issues/41).
- Published noncomplete reconciliation cross-checks every caller-provided failure kind and limitation
  code as a closed semantic pair; exact merge proof closed
  [#42](https://github.com/Chris0Jeky/developer-lens/issues/42).
- The published activation runner precomputes the repository alias and exact card consent before any
  injected fetch, closing [#44](https://github.com/Chris0Jeky/developer-lens/issues/44).
- A valid rate-limit or request-budget truncation can occur after repository metadata but before the
  first unit page. Published composition accepts only that coherent zero-page shape and its direct
  composition/storage regressions closed [#46](https://github.com/Chris0Jeky/developer-lens/issues/46).
- P6 must compare verified owner email only ephemerally, emit only `is_self`, and never retain
  identity or per-person output.
- P2 deletion tests must enumerate collection jobs/checkpoints, source snapshots, coverage,
  data-quality findings, and export-build metadata.
- A future `cap.github.security` activation contract must encode its separate storage decision
  as well as G2+G3. P1 remains safe because the capability is `never_authorized` and has no
  activation path.
- A future provider-expansion review must assert disjoint transformed repository IDs; current
  installation HMAC aliases remove the raw local-alias collision path for the bounded producer.
  The shared alias factory preserves those identities and rejects duplicate batch identities, but
  exact task-owned key creation/loading is now proved, while durable report binding, mismatch,
  rotation, recovery, and deletion behavior remain tracked in
  [#6](https://github.com/Chris0Jeky/developer-lens/issues/6) before real migration. A failed post-
  create write/sync/verify can leave a partial fail-closed key that blocks retry; the bounded
  recovery decision is separately tracked in
  [#59](https://github.com/Chris0Jeky/developer-lens/issues/59).
- The opt-in incremental installer has an exact schema fingerprint and atomically fails closed on
  prior or mismatched extension objects. It intentionally does not migrate an existing `2.1.0`
  extension to `2.2.0`; any activated store requiring that transition needs a separately reviewed
  application-controlled backup, migration, integrity proof, and rollback path.
- The exported storage bridge has no production import and accepts only the closed typed projection,
  but it does not itself consult the `never_authorized` registry or require a synthetic-mode marker.
  The current adapter never imports that bridge. Any future composition must preserve the adapter's
  explicit inert/`never_authorized` check rather than treating either synthetic seam as active.
- A caller-constructed complete checkpoint can carry a persisted `cursorHint`; no current code
  schedules or resumes from it. The synthetic adapter always starts from a null cursor and binds
  requests independently; a real activation must keep pagination cursors non-durable.
- The first-card parser intentionally supports only its reviewed single-segment ASCII default-branch
  form. A later selected repository with a hierarchical or wider valid Git ref requires a bounded
  grammar change and invented regression before its card can parse.
- The REST endpoint is not an immutable provider snapshot. Terminal pagination and a frozen
  half-open time range prove the bounded observed response; the published inert runner now compares
  two observations and persists `SNAPSHOT_UNSTABLE` without advancing the checkpoint when their
  canonical hashes differ. Equal hashes prove equivalent accepted content, not hostile provider
  stability.

## 2026-08-04 — R1 wave 1 (autonomous execution run)

Five active-horizon cards merged in one wave. Per-card evidence below; the compact live pointer is
`docs/analyser-program/CURRENT_STATE.md`.

- **DL-OPS-CI-01 — hosted PR gate.** [PR #70](https://github.com/Chris0Jeky/developer-lens/pull/70),
  merge `6cd30d1`, final head `9c29f5f`. Born: `.github/workflows/pr-gate.yml` mirroring the local
  proving commands including the generated-artifact drift check. Proof is red-then-green on the
  introduction PR itself: run `30926412757` at `69fa9c8` failed on exactly the drift step, run
  `30926490123` at `74ce44a` passed. Fix rounds added the honest Node-runtime comment (`72ff7f5`)
  and the retarget guard (`9c29f5f`). Follow-up
  [PR #77](https://github.com/Chris0Jeky/developer-lens/pull/77) (merge `08fca14`) isolated no-op
  `edited` events in their own concurrency group after a measured cancellation on PR #75.
  Issue [#71](https://github.com/Chris0Jeky/developer-lens/issues/71) tracks the pages.yml Node
  22→24 alignment. `HUMAN_TODO.md` q-7 — marking the check required in repository settings — was
  added by this PR and is an admin action that remains open; until it is done the gate is advisory.
- **DL-SPINE-04 — coverage registry v2.** [PR #73](https://github.com/Chris0Jeky/developer-lens/pull/73),
  merge `090dd48`, final head `92114a3`. `shared/coverage.ts` v2: closed 12-dimension registry, the
  canonical `{ value, limiting_reason }` shape on every dimension, the six-carried/six-new-null
  `EvidenceConfidence` mapping, and two rollback readers. 143 focused tests; full `npm run check`
  383/383. Review lens: contract/privacy adversarial read — no blockers. Issue
  [#76](https://github.com/Chris0Jeky/developer-lens/issues/76) tracks registry finishing work (the
  `source_diversity` clamp decision, producer-absence limiting codes, canonical coverage-code
  registration).
- **DL-SPINE-01 — claim graph tables.** [PR #74](https://github.com/Chris0Jeky/developer-lens/pull/74),
  merge `75e7c39`, final head `bfddf98`. `shared/claims.ts` + `server/storage/claims.ts` + tests:
  four STRICT table families, typed FK targets with an exactly-one-target CHECK, the C2
  `claim_scope` partition with `linked_at` (first-link-wins), the stability key, and structural
  canary rejection. Accepted design expansion: a minimal `evidence` anchor table, because the P2
  store had no evidence table and the composite FK into `coverage_ledger`'s
  `(coverage_id, range_start, job_id)` primary key is required — a single-column FK could never have
  worked. 22 focused tests. Issues opened:
  [#80](https://github.com/Chris0Jeky/developer-lens/issues/80) (the DL-LIFE-02 deletion seam —
  NO ACTION FKs abort scope erasure, scope binding, the C2 sweeper, content-free lineage IDs) and
  [#81](https://github.com/Chris0Jeky/developer-lens/issues/81) (seven binding DL-SPINE-02
  constraints, including ID-material claim targets, the cycle guard, replay clock semantics, the
  minted scope surrogate, layer order, and the basis-edge minimum).
- **DL-BRIDGE-01 — V2 bootstrap slice.** [PR #72](https://github.com/Chris0Jeky/developer-lens/pull/72),
  merge `a6fcae1`, final head `8990d85`. Lazy authenticated `/api/v2` (per-launch-or-env bearer plus
  exact Host and the Origin/sec-fetch triple), a synthetic-provenance-gated SQLite store
  (single-snapshot read), coverage and capabilities endpoints, and Coverage Cockpit V2
  (`?view=cockpit-v2`) rendering all ten coverage states with absence-as-coverage never rendered as
  zero, UTC ISO weeks, and distinct auth/guard/provenance/transport error states. Native deps are
  scan-proven absent from the showcase bundles and the value-based token canary in `verify:showcase`
  was proven in both directions; `seed:v2` and a README walkthrough ship with it. Review lens:
  security — verdict that the absent-Origin/sec-fetch deviation is SOUND, because exact-Host closes
  DNS rebinding and the two are load-bearing together. Accepted deviation recorded: the usable
  configuration is a fixed `.env` token, with "per-launch" applying only where the cockpit cannot
  run. Issues opened: [#78](https://github.com/Chris0Jeky/developer-lens/issues/78) (bundle-safe
  bearer channel, no token or path logging, port-drift-proof allowlist — binds before any real-data
  surface) and [#79](https://github.com/Chris0Jeky/developer-lens/issues/79) (BRIDGE-02 must serve a
  PresentationView, not the canonical record shape).
- **DL-METRIC-01 — versioned metric-definition registry.**
  [PR #75](https://github.com/Chris0Jeky/developer-lens/pull/75), merge `d1e29dd`, final head
  `81f8441`. 32 focused tests; full `npm run check` 415/415 at the fix head. Review lens:
  analytical validity — and unlike the other four cards it returned **eight blocking findings**
  (risk-set cohorts, the `becameReadyAt` construct, three separate #67 holes, proportion bounds,
  person-path scan closure, kind-keyed support gates). All eight were fixed in a single round and
  independently CONFIRMED-CLOSED by a verification pass scoped to the fix diff. Canonical
  coverage-dimension aliasing to `shared/coverage.ts` landed with it, so the dimension set stays
  single-sourced rather than re-declared per contract. Remaining hardening is tracked on
  [#82](https://github.com/Chris0Jeky/developer-lens/issues/82).
- Carried from the PR #65 late-review triage: issue
  [#67](https://github.com/Chris0Jeky/developer-lens/issues/67) (typed empty cohorts) had its
  registry-side semantics land with DL-METRIC-01's PR #75, and stays an active constraint on
  DL-COMPARE-01/DL-VALIDATE-01/DL-VALUE-01;
  [#68](https://github.com/Chris0Jeky/developer-lens/issues/68) and
  [#69](https://github.com/Chris0Jeky/developer-lens/issues/69) stay frozen;
  [#82](https://github.com/Chris0Jeky/developer-lens/issues/82) tracks metric-result hardening for
  DL-VALIDATE-01/DL-VALUE-01.
- In flight at the time of writing and not complete: DL-SPINE-02 (PR #84 open, carrying the #81
  constraints), DL-SPINE-03 (lane open), and the DL-FINDING-01/DL-COMPARE-01 lanes now unblocked by
  the DL-METRIC-01 merge.

## 2026-08-04 — R1 wave 2 (analytics-core kernel completion)

The rest of the active-horizon analytics-core kernel merged in a second autonomous wave, closing
the spine lanes and both remaining contracts plus the Evidence Drawer. Ten of the twelve
active-horizon cards are now DONE; DL-VALIDATE-01 is in flight and DL-VALUE-01 is the only card
after it. Per-card evidence below; the compact live pointer stays
`docs/analyser-program/CURRENT_STATE.md`.

- **DL-SPINE-02 — deterministic claim canonicalisation + replay.**
  [PR #84](https://github.com/Chris0Jeky/developer-lens/pull/84), merge `b52c458`. Landed the v2
  claim-ID material and replay proof carrying the seven
  [#81](https://github.com/Chris0Jeky/developer-lens/issues/81) constraints (ID-material claim
  targets, the supersession cycle guard, replay clock semantics, the internally minted scope
  surrogate, layer order, and the basis-edge minimum). The ADR-01 privacy-effect text was corrected
  in its fix round. Full per-card review evidence is on the PR.
- **DL-SPINE-03 — why-am-I-seeing-this resolver.**
  [PR #85](https://github.com/Chris0Jeky/developer-lens/pull/85), merge `610188c`. The deterministic
  UI → claim → edges → evidence → coverage → capability → consent walk; the resolver fixtures were
  adapted to the #84 minted scope surrogate (`37ca17f`). Read-only module; full evidence on the PR.
- **DL-UX-ED — Evidence Drawer (universal claim inspector).**
  [PR #87](https://github.com/Chris0Jeky/developer-lens/pull/87), merge `4c3f476`. Every analytic
  mark opens the SPINE-03 walk (supports, contradicts, coverage, limitations, method version,
  correction lineage, falsifying question), resolving the typed AnalyticReference union
  (ObservationReference | ClaimReference). Its fix commit `1de8a94` extended the `verifyShowcase`
  native-dependency canary. Review lens: one independent adversarial round. This card was reviewed
  and merged by the prior session; this state-sync session performed a post-merge compliance check
  confirming the merge and the canary extension.
- **DL-FINDING-01 — finding contract.**
  [PR #88](https://github.com/Chris0Jeky/developer-lens/pull/88), merge `2208fcf`. The versioned
  finding contract (metric-result refs, evidence + counter-evidence, alternative explanations,
  limitations, sample/eligibility/censoring summary, robustness status, discriminating-evidence
  statement, presentation eligibility) plus the typed AnalyticReference union. Review lens: one
  independent adversarial round returned two HIGH findings, both fixed in one round and verified —
  the fix round closed a withdrawn-metric bypass and completed the sample-summary state mirror.
  A parallel prior-session review surfaced a third HIGH in a "do not merge" note that raced the
  merge by seconds and was never seen pre-merge: robustness check statements are exempt from the
  causal-copy scan (`copyScanTargets` passes them with `scanCausal: false`). Confirmed against
  merged main post-merge, tracked as issue #91, and folded into the in-flight DL-VALIDATE-01 lane
  with the PR's other findings.ts hardening items.
- **DL-COMPARE-01 — matched-period comparison + censoring semantics.**
  [PR #89](https://github.com/Chris0Jeky/developer-lens/pull/89), merge `d407cb1`. The reusable
  comparison contract (canonical injected asOf, equal-duration half-open UTC windows,
  instrument-matched subwindows with FULL / MATCHED_PARTIAL / INCOMPARABLE, matched fraction as a
  first-class number, right-censoring at boundaries, explicit cohort choice, explicit no-comparison
  outcomes). Review lens: two independent parallel adversarial reviews consolidated into a single
  fix round of four findings, all fixed + verified — empty-cohort value-class classification,
  matched-window binding with `MATCHED_SET_NONCONTIGUOUS` / `MATCHED_WINDOW_MISMATCH` refusals,
  matched-side state checks, and a censoring check on effective sides; the redundant
  `WINDOW_SHAPE_MISMATCH` code was removed. Advances
  [#67](https://github.com/Chris0Jeky/developer-lens/issues/67) — the comparison half of the
  typed-empty-cohort semantics landed; the issue stays open for DL-VALIDATE-01/DL-VALUE-01.
- **Cross-session coordination.** The prior autonomous session stood down mid-run after handing off.
  Its partial fix work on this wave was reimplemented cleanly in the surviving lanes and its stash
  was dropped, so no partial state from it remains in the merged heads above. This state-sync
  closeout is a separate documentation-only lane.
- Carry-forward: [#82](https://github.com/Chris0Jeky/developer-lens/issues/82) (metric-result
  hardening — the N1 sample-dimension-on-empty-cohort question and the M-a/M-b/M-c items) folds into
  DL-VALIDATE-01's remit; [#68](https://github.com/Chris0Jeky/developer-lens/issues/68) and
  [#69](https://github.com/Chris0Jeky/developer-lens/issues/69) stay frozen.

## 2026-08-04 — R1 wave 3 (conformance instrument + first analytical value slice)

The final two active-horizon cards merged in a third autonomous wave, **completing the bounded
R1–R3 active horizon — 12 of 12 active-horizon cards are DONE.** DL-VALIDATE-01 supplied the
analytical conformance instrument; DL-VALUE-01 proved the product thesis with the first
deterministic comparative finding. Full suite: **884 tests green at the lane head.** Per-card
evidence below; the compact live pointer stays `docs/analyser-program/CURRENT_STATE.md`.

- **DL-VALIDATE-01 — analytical conformance and counterexample suite.**
  [PR #92](https://github.com/Chris0Jeky/developer-lens/pull/92), merge `df59bbc`. The
  analytics-grade fixture corpus (goldens, counterexamples, null/unknown, truncation,
  right-censoring, alternative windows, alternative cohort definitions, parameter sensitivity,
  contradiction, source disagreement, and permutation/null baselines) that the analytical-review
  lane uses as its instrument. It landed the three
  [#82](https://github.com/Chris0Jeky/developer-lens/issues/82) metric-result-hardening items
  **M-a / M-b / M-c**, **settled N1** (sample=1 is vacuously complete on empty cohorts), registered
  a real withdrawn-metric fixture, and hardened `findings.ts` with a coverage-dimension cross-check,
  a truncated-completeness cross-check, and the robustness-check causal scan that closes
  [#91](https://github.com/Chris0Jeky/developer-lens/issues/91). Review lens: one independent
  analytical review, round 1 **MERGEABLE-WITH-TRACKED-ISSUES** — both conformance goldens were
  hand-recomputed and confirmed, and two non-blocking vacuous-test findings were tracked as issue
  [#93](https://github.com/Chris0Jeky/developer-lens/issues/93) rather than fixed in-loop.
- **DL-VALUE-01 — first deterministic comparative finding (integration shape, matched windows).**
  [PR #94](https://github.com/Chris0Jeky/developer-lens/pull/94), merge `c632093`. The active
  horizon's exit slice and the point of the programme. Review lens: **dual independent reviews.**
  The implementation/security review returned **MERGEABLE** — guard coverage complete, the
  alias / `coverage_id` leak boundary held under active probing, presentation projections only,
  bundle separation clean. The analytical review **BLOCKED on one HIGH**: MATCHED_PARTIAL's
  mandatory selection-bias limitation and its residual were never rendered while its headline number
  equalled FULL's. Fixed in one bounded round (commit `4843753` — per-outcome-row limitations,
  residual, and arithmetic-basis disclosure); scoped verification **VERIFIED** with hand-recomputed
  limitation sets. The analytical review hand-recomputed every headline number and confirmed them
  exact. The full walkthrough evidence — the horizon's exit proof — is recorded under **PRODUCT
  PROOF** below.
- **Issue closures.** [#67](https://github.com/Chris0Jeky/developer-lens/issues/67) (typed empty
  cohorts) is **CLOSED** with a four-part disposition spanning the waves: registry-side semantics in
  PR #75, the comparison half in PR #89, conformance exemplars in PR #92, and visible
  eligible/censored/excluded counts in PR #94.
  [#82](https://github.com/Chris0Jeky/developer-lens/issues/82) (metric-result hardening — the N1
  sample-dimension-on-empty-cohort question and the M-a/M-b/M-c items) is **CLOSED** by PR #92.
  [#91](https://github.com/Chris0Jeky/developer-lens/issues/91) (robustness-check statements exempt
  from the causal-copy scan) is **CLOSED** by PR #92's causal scan.
  [#93](https://github.com/Chris0Jeky/developer-lens/issues/93) (conformance-suite hygiene — the two
  vacuous self-verification tests) remains **OPEN** and non-blocking.

### PRODUCT PROOF — DL-VALUE-01 walkthrough evidence (R1–R3 horizon exit)

The first deterministic comparative finding, proven end-to-end on invented facts through `/api/v2`,
one comparative Atlas panel, and the Evidence Drawer. This block is the horizon's exit evidence.

- **Question.** "How did PR integration shape differ between this window and the preceding matched
  window?"
- **Risk-set metric.** `pull_request.integration_interval@1.1.0`.
- **Cohort entry.** `becameReadyAt = readyForReviewAt ?? createdAt`.
- **Event.** merge.
- **Censoring.** open PRs are right-censored — 3 of 10 eligible on the current side.
- **Competing outcome.** close-without-merge is a competing outcome: in the eligible set, out of the
  sample, and explicitly not censored.
- **Exclusions.** typed.
- **Windows.** equal 28-day windows, complete at the injected `asOf`.
- **Headline (FULL).** p50 -2.0d / p75 -3.0d / p90 -5.0d — quantiles, never a bare mean.
- **MATCHED_PARTIAL.** matched fraction 0.857, with the selection-bias limitation, the residual, and
  the matched-subwindows-only arithmetic basis rendered **per outcome row** (the one-HIGH fix).
- **INCOMPARABLE.** rendered as its reason, never as a zero delta.
- **Empty-cohort variant.** 0 vs 8, rendered as an observed zero.
- **Coverage.** the seven-dimension metric coverage vector is visible.
- **Alternatives + contradiction.** three alternative explanations, discriminating evidence, and a
  contradicting open-tail mark.
- **Sensitivity.** the `OPEN_TREATED_AS_CENSORED` variant reverses the p90 sign (+2.0d) — robustness
  is honestly reported as fragile.
- **Abstention variant.** rendered under support gating.
- **Evidence Drawer.** resolves every mark: claim -> supports/contradicts -> coverage -> collection
  job -> `github.core` capability -> consent revision.
- **Tests.** a ten-stage walkthrough is asserted by tests; the full suite is 884 green at the lane
  head; the alias->surrogate strip at the finding boundary is enforced with a leak guard.

## 2026-08-05 — roadmap reassessment and R4 admission

The mandatory horizon-exit reassessment completed before any new implementation. It admitted a
three-card, dependency-closed R4 horizon: **DL-LIFE-01**, **DL-LIFE-02**, and **DL-EVQ-03**. This is
small enough to finish through focused proof, hosted gate, high-risk review, merge, and state sync;
it pairs the lifecycle/deletion critical path with one disjoint analytical-value lane. R7/R8 and
every `horizon:frozen` card remain frozen.

- **Live baseline.** After `git fetch --prune origin main`, clean `main == origin/main ==
  e5e54923f782f160b13be38842324d4884ebe9b4` (PR #95 merge). Git registered only the primary
  worktree. The q-8 directory `dl-worktrees/value01` still exists but is not registered; its
  contents were not inspected. There were zero open PRs. PR #94 merged as `c632093` with the hosted
  PR gate green after its one-HIGH review fix; PR #95 merged as `e5e5492` with the hosted PR gate
  green. Its later edited-event run was skipped and is not the proof run.
- **GitHub constraints.** Main branch protection was absent (`branches/main/protection` returned
  404; rulesets were empty), so q-7 remains open and the hosted `PR gate / Prove the pull request`
  success must be enforced manually at every exact head. Open issues were #5, #6, #41, #55, #57,
  #59, #66, #68, #69, #71, #76, #78, #79, #80, #86, and #93. #86 remains a q-5 prerequisite;
  #80 binds DL-LIFE-02; #71 and #93 are separate hygiene lanes; #66/#68/#69 remain frozen.
- **Dependency proof.** The generated planning artifacts matched all 127 canonical cards. Both
  declared DL-EVQ-03 dependencies (DL-SPINE-01 and DL-SPINE-02) are DONE, so its old
  `BLOCKED_BY_DEPENDENCY` status was stale and is now `READY`. DL-LIFE-01 has no dependencies;
  DL-LIFE-02 remains blocked only on DL-LIFE-01 and is dependency-closed inside the new horizon.
- **Lifecycle admission boundary.** A Sol/Luna/Terra design pass found no owner or architecture
  blocker. DL-LIFE-01 is a pure immutable contract: every registry definition and P4/P12 runner
  stays inert/`never_authorized`; approvals perform no transition; invented cards, tampered hashes,
  replay, exact-head proofs, suspension, revocation intent, and lifecycle epochs are tested without
  persistence or a runtime activation path. DL-LIFE-02 alone owns schema-derived deletion,
  transactionality, lineage/tombstone persistence, and issue #80's storage constraints.
- **Analytical lane boundary.** DL-EVQ-03 uses the existing claim stability key and supersession
  chain. It may run disjointly from lifecycle work, but emits only version ordinals and ISO-week
  grain, never exact collection timestamps or raw scope aliases. Its five-job late-event replay and
  honest static zero-churn output are acceptance conditions.
- **Authority contradiction recorded.** The estate registry's dated 2026-08-03 Developer Lens row
  still says G1-only. The repository's newer 2026-08-04 `HUMAN_TODO.md`, data charter, and capability
  matrix explicitly approve G2/G3 and the bounded G4 design while keeping all executable
  capabilities inactive. The project authorities bind this work; no estate-law edit was admitted
  as a product detour.

## 2026-08-05 — R4 wave 1 delivery and LIFE-02 execution decision

R4's first delivery wave is merged. The lifecycle contract and claim-stability value lane landed
without activating a capability, wiring a production caller, reading protected data, or expanding
the public synthetic boundary. The remaining active card is **DL-LIFE-02**.

- **Horizon and hygiene.** [PR #96](https://github.com/Chris0Jeky/developer-lens/pull/96) admitted
  the three-card R4 horizon at head `165e9e6` and merged as `404d27d`; hosted PR gate run
  `30967803953` passed. [PR #97](https://github.com/Chris0Jeky/developer-lens/pull/97) aligned Pages
  to Node 24, closed #71, passed hosted run `30968041166`, and merged as `3f208a0`; exact-merge
  Pages run `30968376450` passed. [PR #98](https://github.com/Chris0Jeky/developer-lens/pull/98)
  replaced the two vacuous conformance checks, closed #93, passed hosted run `30968434615`, and
  merged as `0f38660`. Its four connector comments were classified and resolved as non-blocking.
- **DL-LIFE-01 — immutable lifecycle contract.** [PR #100](https://github.com/Chris0Jeky/developer-lens/pull/100)
  landed final head `25326bf` as merge `41a1804`; hosted PR gate run `30969544413` and exact-merge
  Pages run `30969712337` passed. The exact head passed 22 focused tests, the full 58-file/894-test
  suite, 29 P4 review checks, typecheck, and build. Independent review found one HIGH: a forged
  non-genesis transcript snapshot could be replayed without structural lineage. The bounded fix
  validates snapshot ancestry and both fresh-context reviews were clean. Opaque card, preview, and
  proof digests still require a future trusted adapter for external authenticity; there is no
  caller. A late connector P2 also showed that `request_revocation` leaves the lifecycle active and
  permits resume while revocation intent is pending. With no caller this is tracked as non-blocking,
  but the first caller must suspend on intent and reject resume until the pending intent resolves.
- **DL-EVQ-03 — claim stability across re-collections.** [PR #99](https://github.com/Chris0Jeky/developer-lens/pull/99)
  landed final head `2f1909d` as merge `cad0a11`; hosted run `30969742520` and exact-merge Pages run
  `30969909632` passed. The exact head passed 5 focused tests, the full 59-file/899-test suite,
  typecheck, and build. Review found and fixed one HIGH supersession-cycle gap before merge. Late
  review then confirmed a replay defect: a later observation with the same immutable claim ID was
  rejected solely because `createdAt` advanced, although that clock is not claim-ID material.
  [PR #101](https://github.com/Chris0Jeky/developer-lens/pull/101) removed that comparison and added
  the later-clock zero-churn regression; final head `c6ff6b5` passed 6 claim-stability tests, 34
  claim-replay tests, the full 59-file/900-test suite, typecheck, build, fresh-context review, and
  hosted run `30970321092`, then merged as `d2dfb36`; exact-merge Pages run `30970482370` passed.
  The original HIGH thread was linked to the landed fix and resolved, and the post-merge sweep found
  no late review threads. Lower-severity week-label/order contract notes were classified once and
  left non-blocking.
- **DL-LIFE-02 decision — preserve the full acceptance boundary through two PRs.** One M-sized card
  cannot honestly prove the registered SQLite graph, migrate scope bindings, implement the C2
  retention sweep, and cover every declared app-controlled non-SQL descendant in one reviewable
  change. Slice A therefore owns a fail-closed, registry-derived, transactional planner over the
  existing incremental + claim tables, including children-before-parents order, the current
  `NO ACTION` seam, rollback, idempotence, a missing-lineage canary, and a content-free tombstone.
  The tombstone's `subject_id` and `caused_by` must be class-appropriate, domain-separated lineage
  IDs (for example `cl_`, `ev_`, or `scope_`), with a regression proving a caller cannot retain a
  C2/C3 alias indefinitely by placing it in either field.
  Slice B owns the scope-binding migration, issue #80's C2 sweep, and explicit V2/filesystem
  pack/backup/cache/index adapters. Slice A remains deliberately incomplete: it cannot mark the
  card DONE, close #80, or unblock sensitive connectors. Both slices use invented in-memory
  fixtures only and claim neither physical erasure nor deletion of provider-held copies.
- **Owner and protected-data boundary.** q-6, q-7, and q-8 remain open. Main protection was still
  absent at the wave's start, so every PR used the hosted exact-head gate manually. At final live
  refresh the legacy protection endpoint still returned 404; active ruleset `20425147` enforced
  branch deletion only and did not require `Prove the pull request`, so q-7 remains open. The q-8
  orphan directory and all protected/generated/private-data paths remained uninspected and
  unchanged.

## 2026-08-05 — DL-LIFE-02 slice A and binding B decision

- **State checkpoint.** [PR #102](https://github.com/Chris0Jeky/developer-lens/pull/102) recorded R4
  wave 1 and the two-slice deletion decision at final head `1a12c01`; hosted run `30970967410`
  passed, it merged as `62ea683`, and exact-merge Pages run `30971142650` passed. Independent review
  found and fixed one HIGH before publication: a vague content-free-tombstone acceptance could
  retain C2/C3 aliases in lineage IDs. The final review and post-merge sweep were clean.
- **Slice A.** [PR #103](https://github.com/Chris0Jeky/developer-lens/pull/103) landed final head
  `8e29f9e` as merge `5e6304e`; hosted run `30972206800` and exact-merge Pages run `30972364522`
  passed. Its exact local proof was 14 planner tests, 58 focused storage tests, and the full
  60-file/914-test suite plus context verification, typecheck, and build. Two bounded adversarial
  rounds reproduced and fixed four HIGH false-success paths: tombstone reuse across scopes;
  alias-cleared claim survivors; alias/`caused_by` lineage residue plus cross-scope dependencies;
  and an unbound no-claim scope survivor. The result remains `completeProduct:false`, has no caller,
  and fails closed on any unbound claim scope until B supplies durable binding.
- **B decision.** Sol/Luna/Terra mapping and adversarial review rejected a permanent legacy refusal,
  retained old/new identity maps, alias-derived C1 lineage, unowned pack deletion, and backup/restore
  scope creep. The binding implementation record is
  [`docs/analyser-program/10_LIFE_02B_DECISION.md`](./analyser-program/10_LIFE_02B_DECISION.md): B1a
  inert contracts, B1b copy migration, B2 retention/continuity/resolver, B3 complete SQL deletion,
  and B4 confined app-owned artifacts. The card and #80 remain open through B4.
- **B1a.** [PR #105](https://github.com/Chris0Jeky/developer-lens/pull/105) landed final head
  `38c85a4` as merge `f9cc008`; hosted run `30975235029` and exact-merge Pages run `30975430150`
  passed. Its exact proof was 7 focused proposal tests and the full 61-file/921-test suite plus
  context verification, typecheck, and build. Adversarial review found and fixed six direct
  lifecycle/compatibility defects: omitted V2 bridge tables; event/subject mismatches; random claim-
  ID conflation; missing slice-A tombstone compatibility; mismatched legacy operation identity;
  and restarted-series back-links. The result remains proposal-only and absent from every
  production import graph, live registry, installer, writer, resolver, and capability path. Review
  classified its `Date.UTC` handling of otherwise-valid ISO week-years 0000–0099 as LOW/MED and
  non-blocking because product operational timestamps are modern; proleptic support remains absent.
- **Late B1a review.** Three Codex P2 threads arrived after merge and the first sweep; live
  reconciliation recovered them at the next workflow checkpoint. All three are confirmed direct
  lifecycle/privacy defects under this repository's causal severity bar: base dispositions could
  C1-preserve C2 SHA/exact-time fields; every lineage event required a deletion-only `del-`
  operation; and unremintable/dangling/cross-scope claim-graph rows were described as deletions
  instead of target-aborting invalid states. The exact next slice is a two-file inert-proposal
  follow-up linked to PR #105. [PR #107](https://github.com/Chris0Jeky/developer-lens/pull/107)
  landed final head `d7acb10` as merge `263839d`; hosted run `30976889901` and exact-merge Pages run
  `30977063643` passed. Its exact proof was 8 focused tests and the full 61-file/922-test suite plus
  context verification, typecheck, and build. Its late sweep was empty.
- **Second late contract review.** A later sweep of the documentation correction in
  [PR #106](https://github.com/Chris0Jeky/developer-lens/pull/106) recovered three more Codex P2
  threads. Live code proves `claim_scope.scope_alias` is the repository-provider-domain alias, not
  `analytical_key`; the decision must allow the verified aliases only in expiring C2 identity/link
  rows while keeping the raw ID and installation key process-only; and `index_deleted` is a
  revocation-cascade event that must share the reviewed `del-` operation.
  [PR #108](https://github.com/Chris0Jeky/developer-lens/pull/108) landed final head `f05c5c3` as merge
  `7a270f4`; hosted run `30977894384` and exact-merge Pages run `30978065710` passed. Its exact proof
  was 8 focused tests and the full 61-file/922-test suite plus context verification, typecheck, and
  build. Its late sweep was empty.
- **B1b-i.** [PR #109](https://github.com/Chris0Jeky/developer-lens/pull/109) landed the strict
  isolated storage-v3 shadow installer at final head `eab066d` as merge `2a55b11`; hosted run
  `30980483640` and exact-merge Pages run `30980674556` passed, and the late review sweep was empty.
  It has a distinct application/schema identity, literal-preserving deterministic schema
  fingerprint, exact 18-table disposition inventory, marker-only and populated v2-target refusal,
  and an explicit `completeB1b: false` /
  `selectable: false` result. Invented in-memory proofs cover source immutability, C0 bridge rows,
  expiring C2 groups, canonical scope/claim FKs, valid v3 claim material and coverage edges, alias
  uniqueness, exact lineage operation/subject/week rules, idempotence, transactional schema
  rollback, TEMP shadow rejection, extra schema-object rejection, and tamper refusal. The exact local
  proof is 24 focused tests and the full 62-file/938-test suite plus context verification, typecheck,
  lint, and build. Only this inert
  module may import the B1a proposal; no production reader, selector, writer, capability, backup, or
  source-copy caller imports either module. The schema keeps `subject_id`/`caused_by` free of hard
  FKs because lineage must outlive deleted subjects; B1b-ii must use its transient ownership map to
  abort a mapped live subject/cause whose scope differs from the event scope. The `obs-`, `pr-`, and
  `event-` values are expiring C2 row IDs and are excluded from the closed C1 lineage registry.
- **B1b-ii active decisions.** The slice-A compatibility event has no legitimate repository scope:
  storage-v3 schema identity `3.0.0-shadow-b1b-ii` / user version 302 therefore permits a null
  `scope_id` only for `legacy_deletion_operation`; every other lineage event remains scope-bound.
  This preserves the required record without inventing a scope. The rewrite reads one exact,
  transactionally consistent 18-table v2 image, validates every C0 bridge row under the singleton
  synthetic provenance record, and refuses extra or shadow schema objects. Repository authentication uses the
  latest valid commit/PR/dated-event descendant only; a generated scope link uses that repository's
  own anchor. An unscoped identity without a live anchor cannot mint a scope: its validated
  incremental descendants are omitted with the typed identity absence. Retention remains
  field-specific: an existing alias link expires from first-link
  `linked_at`; a scope-bound identity retains only its C1 lifecycle flags after its alias pair
  expires, while each base or incremental operational C2 group expires from its own canonical row
  anchor. At or after the boundary only its content-free C1 anchor survives. A legacy complete
  checkpoint projects the new C1 fields as `coverage_state=complete`, `deletion_order=0`, and
  `lineage_coverage=mapped`; its watermark/cursor/range/hash group remains C2.

  A cleared legacy scope alias is never reconstructed from residual provider-bearing graph data.
  If that erased link would make retained claims cross the newly generated scope, the rewrite
  refuses the graph; B2 owns any future reviewed renewal or explicit series-restart path. Every
  legacy collection job must still have exactly one coverage row, and a complete job exactly one
  snapshot, including on an intentionally omitted unscoped descendant chain.

  Before reminting, every source claim must reproduce its exact `claim-id.v2` and closed graph.
  `claim-id.v3` is SHA-256 over the version plus B1a's exact ordered material fields, LF-separated;
  rewritten typed basis tokens are unique, default-sorted, and carry only C1 evidence, claim, or
  coverage targets. `created_at`, supersession, aliases, operational C2 ranges, and caller job IDs
  stay outside the digest; the claim's own window bounds remain material. Recognized lineage
  subjects and causes remap only through the transient ownership map;
  cross-scope, ambiguous, dangling, conflicting deletion, and slice-A compatibility states abort,
  while genuinely unclassified legacy events are omitted with a content-free count. The map and
  source image are cleared on every return or failure. The implementation remains caller-free,
  path-free, invented-fixture-only, incomplete, and non-selectable.

  Current local proof is 65 focused storage tests and the full 63-file/979-test gate including
  context verification, lint, typecheck, and build. Hosted and exact-merge evidence remain pending
  publication.
- **B1b identity correction.** Live-code feasibility proved the stored `provider_id` and
  `analytical_key` are independent domain-separated HMACs over the raw provider ID, so the original
  instruction to derive one from the other was impossible. The corrected binding requires an
  explicit ephemeral raw provider-ID input, recomputes both aliases with the installation key, and
  fails closed on missing/mismatched/ambiguous active identity. Invented tests inject it in memory;
  a real wrapper remains LIFE-03 work. No raw identity is retained or emitted.
- **Boundary.** No protected/generated/private data was inspected. Every capability remains
  `never_authorized`; q-6/q-7/q-8 and the q-8 orphan directory are unchanged.

## 2026-08-05 — DL-LIFE-02 B1b-iii orchestration (current slice)

PR #110 B1b-ii (`2cf2236`) merged as `ed413dc`; hosted run `30987156228` and exact-merge Pages
run `30987394372` passed, with an empty late-comment sweep. This slice adds the caller-free
`v3ShadowMigration` orchestration boundary, two caller-owned target attempts, close/reopen schema,
integrity, quick-check, foreign-key-enforcement, and process-input privacy proof, a versioned C1
allowlist with graph-normalized replay checksum, a private full-source mutation fingerprint, and
opaque per-stage rollback injection across the complete shadow rewrite. The target factory accepts
the freshly reopened primary only after every proof; the frozen public result contains no database
handle, path, alias, raw identity, key, or mapping. The rewrite and B1b-i/ii result remain incomplete/
non-selectable; only the orchestrator can return `completeB1b: true`. Invented tests prove all 16
rollback checkpoints in both target attempts, exact discard behavior, source immutability/mutation
refusal, independent entropy, C2-insensitive and C1-sensitive checksum behavior, row-order
normalization, schema/FK/replay refusal, and a deterministic two-writer lock. The exact local proof
is 88 focused tests and the full 64-file/1,019-test gate plus context verification, lint, typecheck,
and build. Fresh post-fix Luna checksum/privacy and lifecycle/concurrency lenses found no HIGH or
CRITICAL defect; the latter independently reran the full gate. The first full-gate attempt timed out
only because both exhaustive stage matrices were
inside two five-second Vitest cases; splitting them into one independently timed case per stage
made the unchanged assertions pass under full-suite load. No production source selector,
filesystem reader, identity mapping, or capability state changed. LIFE-02 remains incomplete;
B2-B4 remain mandatory and HUMAN_TODO q-6/q-7/q-8 are unchanged.

## 2026-08-05 — DL-LIFE-02 B2a-i shadow immutability enforcement (merged)

PR #111 B1b-iii head `e575059` merged as `202aebea`; hosted run `30990269529` and exact-merge
Pages run `30990502000` passed with an empty late-comment sweep. B2a-i advances the caller-free,
invented-fixture-only shadow schema to `3.0.0-shadow-b2a` / `user_version` 303 and adds a closed
registry of null-safe BEFORE UPDATE triggers plus locator-bound BEFORE INSERT guards for canonical
identity and parent keys. Dedicated alias-binding guards prevent SQLite `INSERT OR REPLACE` from
moving a scope alias or authenticated repository identity between scopes. Trigger DDL
is included in the object registry and fingerprint, with semicolon-safe parsing and fail-closed
missing, altered, extra-main, and case-insensitive owned-TEMP object checks. Composite foreign keys
enforce typed scope relationships; lineage-side history checks plus owner-side INSERT triggers bind
single-scope subjects, causes, and `op-`/`del-` operations in either insertion order while still
admitting the first content-free tombstone after an owner disappears. Claim supersession
remains the only mutable claim relationship. Existing mixed C1/C2 rows remain
transitional; B2a-ii will classify `claim.created_at` as C2 operational provenance and prove its
expiry/retained form, while physical anchor-table separation is unnecessary unless later
cardinality/lifecycle demands it. Invented tests cover the registry/fingerprint, hostile updates
across every trigger family, enclosing-transaction rollback, both lineage/owner insertion orders,
delete/rebind refusal while lineage survives, operation-cause binding, tombstone survival, and
main/TEMP mismatch refusal and replacement-style identity/parent rebinding. The focused four-file
storage seam passes 116 tests and the full local gate passes 64 files / 1,030 tests plus context
verification, lint, typecheck, build, and diff checking. Fresh post-fix lineage, schema, and final
replacement-focused lenses found no remaining HIGH/CRITICAL defect. Direct
deletion of lineage history is deliberately not claimed here; B3 owns complete SQL deletion and
tombstone replay. PR #112 head `1c771cc` passed hosted run `30994203412`, merged as `e0f3894`,
and passed exact-merge Pages/privacy run `30994446119` plus an empty late-comment sweep. LIFE-02
and #80 remain incomplete; B2a is not complete. HUMAN_TODO q-6/q-7/q-8 are unchanged.

## 2026-08-05 — DL-LIFE-02 B2a-ii claim-provenance retained form (merged)

B2a-ii advances only the caller-free shadow identity to `3.0.0-shadow-b2a-ii` / `user_version`
304. It classifies `claim.created_at` as exact C2 operational provenance, keeps the active v2
writer/parser/UI contract required and unchanged, and projects the target value with the existing
UTC calendar-clamped rule: retain only while `asOf < addUtcMonthsClamped(created_at, 13)`, then
write NULL at the inclusive boundary without deleting or reminting the C1 claim. A nullable field
on the retained claim row is the smallest sufficient representation; no separate physical table is
introduced before a second independently expiring claim field exists. `window_start` and
`window_end` remain C1 analytical claim material because they define the claim ID and supersession
series, rather than source-query provenance. The C1 checksum allowlist and claim-ID material remain
unchanged and exclude `created_at`. Invented tests prove canonically shaped-or-NULL target storage, exact
Jan-31 clamp behavior one millisecond before and at expiry, source immutability, retained claim/
edge/limitation graph, old-303 refusal, and checksum invariance across two timestamps and NULL while
still detecting a C1 claim change. The focused proposal/schema/rewrite/migration seam passes 120
tests; the full local gate passes 64 files / 1,034 tests plus context verification, lint, typecheck,
build, and diff checking. The target DDL deliberately enforces the exact UTC string shape only;
semantic calendar validity remains enforced by the required source `ClaimRecordSchema` parse before
the transactional rewrite. No direct target writer exists, and any future one must preserve that
parser boundary. Fresh reviews found no HIGH/CRITICAL defect and retained this bounded distinction
as a non-blocking residual. PR #113 head `d28bd9f` passed hosted run `30996013913`, merged as
`ad8ba9a`, and passed exact-merge Pages/privacy run `30996264276` plus an empty late-comment sweep.
No production caller, selector, capability state, or HUMAN_TODO item changes. LIFE-02/#80 and B2
remain incomplete.

## 2026-08-05 — DL-LIFE-02 B2a-iii ongoing C2 sweep (merged)

B2a-iii versions the caller-free shadow as `3.0.0-shadow-b2a-iii` / `user_version` 305 and adds the
separate target-only `sweepStorageV3C2` seam. The sweep first acquires an immediate SQLite write
transaction, then proves the exact application/user/schema fingerprint, table set, absence of TEMP
shadow objects, integrity, quick-check, and foreign keys before planning any mutation. Canonical UTC
expiry is inclusive. Stored expiry markers are parsed rather than passed to SQLite calendar
arithmetic; `claim.created_at` reuses the exact 13-month calendar-clamped helper. Malformed target
clocks fail before mutation. A competing writer returns the opaque `SWEEP_BUSY` result without
retry, and every planned stage plus final validation has rollback injection.

All ten declared C2 groups are monotone: scope alias/link/clock; repository aliases/clock; commit,
pull-request, and dated-event operational fields; job, checkpoint, snapshot, and coverage operational
fields; and claim creation provenance. The physical row remains only as the declared content-free C1
anchor. The decision/proposal now state this co-located representation precisely: deleting the whole
logical C2 observation means atomically clearing its complete nullable field group and expiry marker,
not deleting the physical row's C1 aggregate/classification fields. C0 bridge rows, C1 observations,
all anchor IDs/status/aggregates, claim/evidence edges, limitations, and supersession remain byte-for-
byte equivalent in the invented fixture snapshot. A successful replay sees no eligible C2 group,
does not call entropy, emits no second event, and cannot resurrect a value.

Alias expiry writes the existing C1 `scope_alias_expired` event. The previously unnamed required
incremental retention event is versioned as `c2_retention_expired`, accepts only retained job,
snapshot, checkpoint, and coverage anchors, requires the owner row in the same scope, and always
uses a neutral `op-` operation. It is emitted only for anchors reachable from a retained claim graph;
an expired unreferenced job clears without manufacturing lineage. One operation is minted per scope,
collisions retry against existing lineage keys, and a partial unique index prevents duplicate
retention semantics for the same subject/week. This is retention, never correction or deletion.

The focused proposal/schema/rewrite/migration/sweep seam passes 137 tests. The full local gate passes
65 files / 1,051 tests plus context verification, lint, typecheck, build, and diff checking. Fresh
authority, SQL/concurrency, and test-gap lenses found no remaining HIGH/CRITICAL defect after the
C1-anchor wording and claim-reachability corrections. The only runtime output is content-free
counts/status; the AST import gate proves no production module imports the sweep. No source reader,
selector, renewal path, resolver/UI, capability state, or HUMAN_TODO item changes. Authenticated
continuity renewal and coverage/job absence resolution remain the next B2 work. A fresh migration
can currently materialize an already-expired incremental anchor with a NULL C2 group and therefore
no sweep event; before any production migration/writer, the renewal/writer contract must explicitly
decide and prove whether that never-retained state needs an origin event. B3 deletion/lineage and B4
app-owned artifacts remain separate. LIFE-02/#80 and B2 remain incomplete.

PR #114 head `762f9f9` passed hosted run `30999010546`, merged as `6dad325`, and passed exact-merge
Pages/privacy run `30999228603` plus an empty late-comment sweep.

## 2026-08-05 — DL-LIFE-02 B2b-i structural continuity candidate (merged)

B2b-i adds only the caller-free structural continuity candidate: a replay-valid active
`github.core` transcript, matching card/consent, preview/proof presence, no receipt, and no pending
deletion intent are required alongside a claimed report digest/time, positive continuity epoch,
nonnegative compare-and-swap revision, and lowercase `op-` operation ID. The output is deterministic and deeply
frozen, with stable content-free refusal codes and a domain-separated C2 receipt digest. The
capability-lifecycle epoch and proposed continuity epoch remain separate values. It claims only
replay-valid, structurally eligible, claimed review digest/time; it never authorizes, authenticates,
verifies review, permits renewal, or extends retention. No raw provider ID or installation key is accepted or hashed,
no production caller imports the module, and capability registry/API values remain
`never_authorized`.

The candidate omits direct C2 identity, lifecycle-digest, report-digest, review-time, and transcript
fields. Its opaque receipt digest remains local C2 because it binds those ephemeral inputs; it is
neither a proof nor a retained C1 key and is forbidden from every log/API/export/model/public sink.
The next writer must revalidate its trusted ephemeral inputs instead of treating the candidate as
self-identifying.

The focused lifecycle/candidate/proposal seam passes 21 tests. The full local gate passes 66 files /
1,057 tests plus context verification, lint, typecheck, build, and diff checking; only the two
pre-existing Evidence Drawer Fast Refresh warnings and the existing bundle-size advisory remain.
Fresh authority, privacy/state, and narrow code lenses found no HIGH/CRITICAL defect after the
closed-request, separate-epoch, C2-output, exact-transcript-receipt, inherited-snapshot, and AST
guard corrections. PR #115 head `d4683c7` passed hosted run `31002017618`, merged as `bdf8e436`,
and passed exact-merge Pages/privacy run `31002333681` plus an empty late-comment sweep.

Continuity renewal remains next only through the prerequisite sequence recorded below, not through
a caller-claimed trusted-loader shortcut. For the later migration-origin disposition,
“never-retained” refers to the expired C2 payload: only a same-scope C1 anchor reachable
from a retained claim emits `c2_retention_expired` at the original expiry week. Reachability is
claim → coverage or claim → evidence → coverage, then that coverage's job/snapshot and a checkpoint
only when both owners are reachable; unreferenced, omitted, and base anchors emit no origin event.
Coverage/job absence resolution, B3 deletion, and B4 artifacts remain later dependencies.

## 2026-08-05 — DL-LIFE-02 B2b-ii-a stable task-card snapshot prerequisite (merged)

Post-B2b-i authority review found two blockers to honestly naming the next composition a trusted
loader. There is no independently anchored owner-reviewed report digest or trusted clock, and the
existing task-card reader sampled its opened descriptor only once. A same-size in-place write could
therefore leave size/path/identity checks green while changing the bytes. The dependency-safe next
slice hardens that existing reader before adding any continuity composition.

B2b-ii-a reads the bounded card twice at exact positions from the same opened descriptor, compares
the bytes, zeroes owned buffers, and only then decodes, hashes, and parses. It uses BigInt file
identity, requires one link, checks stable file metadata, requests no-follow opening where the
platform supports it, and pins the workspace, `.developer-lens`, activation, and task directories
by identity before, between, and after the reads. Invented fixtures prove same-size mutation,
parent-directory replacement, and hard-link refusal plus the unchanged-card path. The focused
generic/GitHub/OpenAI loader stack passes 3 files / 20 tests. The full local gate passes 67 files /
1,061 tests plus context verification, lint, typecheck, build, and diff checking; only the two
pre-existing Evidence Drawer Fast Refresh warnings and existing bundle-size advisory remain. A
fresh post-implementation file/race lens found no HIGH/CRITICAL defect. Hosted and exact-merge gates
then passed: PR #116 head `d939e1b` passed hosted run `31003641095`, merged as `8e8b0bc`, and
exact-merge Pages/privacy run `31003872271` plus the late-comment sweep were green and empty.

This is snapshot stability only. It neither authenticates a stable malicious card nor creates an
owner-reviewed report anchor, trusted review time, trusted clock, key binding, continuity authority,
database write, network call, lifecycle transition, retention extension, or capability activation.
All executable capabilities remain `never_authorized`.

The report work now splits at its privacy seam. B2b-ii-b first validates only the versioned C1
runner-result projection. B2b-ii-c then embeds that projection unchanged in a strict local-C2
`last-run-report.json` envelope and adds stable exact-byte loading whose expected digest remains
external to the report and is still not authority by itself. Only after that may a separately
owner-reviewed anchor bind report/card/key/lifecycle/time plus a trusted process clock. CAS revision
comes from the database transaction and its operation ID is writer-owned, never trusted from the
report.

## 2026-08-05 — DL-LIFE-02 B2b-ii-b strict C1 activation-result validator (merged)

B2b-ii-b is a pure, caller-free parser for the existing github.core runner's C1 result facts. Its
closed versioned object contains only capability/version literals, probe stability, the exact
coverage status/count/retry/limitation projection, and request-budget counters. It rejects every
task, job, scope, card, report, key, digest, timestamp, range, alias, URL, provider, or prose field.
`stable` means only that the two bounded probe hashes were equal; it never means complete source
truth, review, authentication, authorization, continuity, renewal permission, or retention extension.

The validator reconstructs own data properties before validation, rejects inherited, accessor,
symbol, or extra fields and fails closed on hostile inspection traps with one content-free error. It
enforces the exact reachable runner truth table, active-probe ceilings, metadata-only coverage, and
request arithmetic, then returns one deterministic deeply frozen shape. It has no filesystem,
database, network, clock, key, lifecycle, runner, retention, or capability dependency and no
production caller. The focused parser/proposal gate passes 2 files / 17 tests plus targeted lint,
server typecheck, and diff checking. The full local gate passes 68 files / 1,070 tests plus context
verification, lint, typecheck, build, and diff checking; only the two pre-existing Evidence Drawer
Fast Refresh warnings and existing bundle-size advisory remain. Fresh code, authority, and
transport-invariant reviews found no HIGH/CRITICAL defect after the strict producer-count fixes.
PR #117 head `f910137` passed hosted run `31005511635`, merged as `8aa19b3`, and exact-merge
Pages/privacy run `31005770546` plus the late-comment sweep were green and empty. All executable
capabilities remain `never_authorized`.

## 2026-08-05 — DL-LIFE-02 B2b-ii-c stable local-C2 activation report (merged)

B2b-ii-c defines the strict `github-core-activation-report.v1` envelope with only `schemaVersion`,
caller-claimed C2 `taskId`, `jobId`, and `jobStartedAt`, plus the unchanged B2b-ii-b C1 `result`.
The envelope deliberately omits a repeated capability discriminator, card/report hashes, scope/key/
provider/range fields, review or authorization claims, continuity state, operation IDs, and prose.
A report-carried card digest would still be caller-controlled and cannot prevent a card/report
confused deputy. The later anchor must instead cross-bind the freshly loaded card digest with its
external expected digest, the persisted transition consent revision, lifecycle card/consent state,
and the jointly reviewed external report digest.

The stable loader now shares one fixed-spec activation-artifact core with the existing task-card
loader. Callers cannot select filenames or byte limits: cards remain `task-card.json`, reports are
only `last-run-report.json`, and both retain the proven 64 KiB cap, closed input, confined canonical
ancestors, one-link descriptor/path identity, two exact reads, mutation checks, fatal UTF-8,
duplicate-key rejection, SHA binding, and buffer zeroing. The github.core wrapper maps every failure
to one content-free error, cross-checks the report task against the path-bound task, and has no
production caller. Its AST gate permits only report → C1 parser and loader → report edges. It adds no
runner, writer, database, network, key, clock, lifecycle, retention, public/export/model sink, or
capability activation.

The focused integrated loader/report/proposal proof passes 6 files / 34 tests; the full local gate
passes 71 files / 1,082 tests plus context verification, lint, typecheck, build, and diff checking.
Only the two pre-existing Evidence Drawer Fast Refresh warnings and existing bundle-size advisory
remain. Fresh artifact-core and integrated code, test, privacy, and authority reviews found no
HIGH/CRITICAL defect. PR #118 head `c393bd1` passed hosted run `31008061712`, merged as `cb9161c`,
and exact-merge Pages/privacy run `31008333181` plus the late-comment sweep were green and empty.
Stable bytes and a matching external report digest still prove neither origin nor owner authority.
Every executable capability remains `never_authorized`.

## 2026-08-05 — DL-LIFE-02 B2b-ii-d continuity review anchor (merged)

B2b-ii-d adds only the pure `github-core-continuity-review-anchor.v1` syntax boundary for a
caller-claimed local-C2 review record. Its closed shape binds the reviewed report, task card,
installation-key fingerprint, active lifecycle epoch, preview, exact-head proof, next continuity
epoch, and millisecond UTC review time to one task ID. It also requires all three reviewed deletion
intent/digest/receipt fields to be exactly null, because an `active` lifecycle can still have a
pending revocation. The decision literal is not owner authentication, review evidence, trusted
time, binding, authorization, renewal, retention, or completeness.

The parser has no imports, caller, filesystem, database, key, network, clock, lifecycle, writer, or
sink. The production AST gate rejects the direct ES import/export and literal
require/dynamic-import forms used by the repository's current source set, and the live tree has no
caller. The later composer must bind one path-selected task to one same-scope C1 row, freshly
re-read report/card/key bytes, and a replayed
lifecycle snapshot; require exact digest, consent revision, epoch, preview/proof, and deletion-null
equality; enforce `report.jobStartedAt <= reviewedAt <= trustedNow`; and consume
`reviewedContinuityEpoch === currentContinuityEpoch + 1` inside the writer's CAS transaction. This
slice intentionally performs none of those checks. All executable capabilities remain
`never_authorized`.

The focused anchor/proposal proof passes 2 files / 13 tests. The full local gate passes 72 files /
1,087 tests plus context verification, lint, typecheck, build, and diff checking; only the two
pre-existing Evidence Drawer Fast Refresh warnings and existing bundle-size advisory remain.
Fresh code, privacy/authority, and inertness reviews found no HIGH/CRITICAL defect. The one
non-blocking AST-form coverage note was explicitly triaged without overclaiming the gate. PR #119
head `02094d2` passed hosted run `31010122666`, merged as `8cabc53`, and exact-merge Pages/privacy
run `31010364274` plus the late-comment sweep were green and empty.

## 2026-08-05 — DL-LIFE-02 B2b-ii-e trusted process clock (merged)

B2b-ii-e adds two separate zero-argument process-owned captures. Wall time is validated as a
nonnegative safe-integer millisecond reading and returned only as canonical millisecond UTC for the
later persisted chronology check. Monotonic time comes from Node's performance clock, accepts only
a finite nonnegative reading, and is explicitly process-local: it may govern elapsed request
budgets but must never be persisted or compared across restarts. The API deliberately exposes no
caller-supplied time, injected runtime source, combined persistable record, or conversion between
the two domains.

Both sources fail closed through one content-free error if they throw or return invalid values.
The module imports only Node's monotonic clock and has no caller, anchor, artifact, lifecycle,
database, writer, network, retention, sink, or capability dependency. The no-caller AST gate keeps
the repository's current direct/literal dependency forms closed, and the live tree has no caller.
Capturing process time does not authenticate an owner
anchor or authorize continuity, renewal, retention, collection, or capability activation. Every
executable capability remains `never_authorized`.

The focused clock/proposal proof passes 2 files / 15 tests. The full local gate passes 73 files /
1,094 tests plus context verification, lint, typecheck, build, and diff checking; only the two
pre-existing Evidence Drawer Fast Refresh warnings and existing bundle-size advisory remain.
Fresh clock, privacy/authority, and inertness reviews found no HIGH/CRITICAL defect. The mutable
same-process clock and defense-in-depth range/AST notes were explicitly triaged as non-blocking;
there is still no production caller. PR #120 head `5a08fcf` passed hosted run `31011375033`, merged
as `cdaa083`, and exact-merge Pages/privacy run `31011609025` plus the late-comment sweep were green
and empty.

## 2026-08-05 — DL-LIFE-02 B2b-ii-f stable continuity-anchor loading (merged)

B2b-ii-f adds exactly one canonical ignored artifact path:
`.developer-lens/activation/<taskId>/continuity-review-anchor.json`. The shared loader applies the
same 64 KiB cap, closed hash-bound input, canonical ancestor and descriptor/path identity, one-link
rule, double exact read, mutation detection, fatal UTF-8, duplicate-key refusal, and buffer zeroing
as the card/report paths. Callers cannot select a filename or byte limit. A dedicated wrapper parses
the closed sixteen-field github.core anchor, cross-checks its task ID against the path-selected
task, returns the observed stable SHA-256 with the frozen anchor, and maps every failure to one
content-free error.

The observed digest remains ephemeral local binding material and the existing task-card/report
public result shapes stay unchanged. Matching a caller-supplied external digest proves only which
stable bytes were observed; it does not prove owner identity, review, approval, provenance, trusted
time, report/card/key/lifecycle/CAS binding, authorization, renewal, retention, activation, or
source completeness. The current task-card `localBoundary` schema does not declare the new anchor
filename; the first composition/caller boundary must resolve that closed contract explicitly rather
than infer it. The exact production chain is shared artifact loader -> anchor loader -> pure anchor
parser, with no caller above it and no writer, database, clock, network, lifecycle mutation, sink,
or capability activation. Every executable capability remains `never_authorized`.

The focused artifact/anchor-loader/proposal proof passes 3 files / 16 tests. The full local gate
passes 74 files / 1,099 tests plus context verification, lint, typecheck, build, and diff checking;
only the two pre-existing Evidence Drawer Fast Refresh warnings and existing bundle-size advisory
remain. Fresh loader-core, privacy/authority, and inertness reviews found no HIGH/CRITICAL defect.
PR #121 head `cad4d73` passed hosted run `31013045188`, merged as `1706df1`, and exact-merge
Pages/privacy run `31013362189` plus the late-comment sweep were green and empty.

## 2026-08-05 — DL-LIFE-02 B2b-ii-g task-card anchor-path contract (merged)

B2b-ii-g closes the path declaration that B2b-ii-f deliberately left unresolved. The strict
`github-core-activation-task-card.v1` local boundary now requires the exact literal
`continuityReviewAnchor: "continuity-review-anchor.json"` alongside its existing fixed card,
database, key, backup, and report paths. Omission, alternate names, absolute paths, traversal, and
extra fields fail closed through the existing parser. Invented card fixtures across the parser,
loader, runner, and REST transport adopt the new required field.

This is contract closure only. It reads or writes no anchor, changes no runtime default, and adds no
composer, writer, network call, database access, lifecycle transition, retention extension, sink,
or capability activation. The existing ignored task card was not inspected or updated; a later
deliberately scoped activation task must migrate and re-prove that protected file before any caller.
Every executable capability remains `never_authorized`.

The focused task-card/parser/loader/runner/transport proof passes 4 files / 31 tests. The full
local gate passes 74 files / 1,099 tests plus context verification, lint, typecheck, build, and diff
checking; only the two pre-existing Evidence Drawer Fast Refresh warnings and existing bundle-size
advisory remain. Fresh contract and authority reviews found no HIGH/CRITICAL defect. PR #122 head
`16f4c7d` passed hosted run `31014606288`, merged as `c66d602`, and exact-merge Pages/privacy run
`31014845736` plus the late-comment sweep were green and empty.

## 2026-08-05 — DL-LIFE-02 B2b-ii-h structural continuity composition (merged)

B2b-ii-h adds one caller-free composer with the exact own-data input
`workspaceRoot`, `taskId`, `expectedAnchorSha256`, and `lifecycleSnapshot`. Before its first async
boundary it recursively snapshots the lifecycle transcript without evaluating accessors and applies
closed depth, node, object-field, array-item, and string budgets, then replay-validates the detached
snapshot. The exact limits are depth 8, 8,192 object/array nodes, 32 own fields per object, 1,024
items per array, and 262,144 total string code units; any excess gets the same refusal. The first
fixed artifact load is the hash-bound anchor, and only its claimed card/report
digests and installation-key fingerprint for the existing stable loaders. No caller may select an
artifact filename, and the input exposes no separate time, scope, revision, operation, current
continuity epoch, or raw-key field.

Composition binds every artifact to one task; recomputes the runner's exact provider-domain
repository alias from the selected card repository with the task-owned key and matches it to the
lifecycle scope; matches card/consent, active lifecycle epoch, preview, exact-head proof, and all
three deletion-null fields; matches the report request ceiling to the card; and requires
`card.authorizedAt <= report.jobStartedAt`, `card.readBoundary.rangeStart < report.jobStartedAt`, and
`report.jobStartedAt <= anchor.reviewedAt <=` the internally captured process wall time. Pending
revocation refuses even while lifecycle state remains `active`. Every lower failure maps to one
content-free error, and success is only one frozen static `structurally_consistent` object containing
no task, path, alias, digest, key, epoch, time, operation, or revision.

This remains structural consistency, not trusted continuity. The expected anchor digest and review
literal are unowned claims; the report start is claimed; `Date.now()` is process-local and mutable;
the file snapshots are individually stable rather than cross-file atomic; and no same-scope C1 row,
owner-authenticated anchor origin, lifecycle-freshness lock, continuity epoch, CAS revision, writer
operation, renewal, retention extension, or production caller exists. The dependency gate makes the
composer's seven direct imports exact and rejects every production import of the composer. Every
executable capability remains `never_authorized`; protected and generated paths remain uninspected.

The focused composition/proposal proof passes 2 files / 23 tests. The full local gate passes 75
files / 1,114 tests plus context verification, lint, typecheck, build, and diff checking; only the
two pre-existing Evidence Drawer Fast Refresh warnings and existing bundle-size advisory remain.
The first full run exposed one over-bundled six-fixture test timeout; splitting it into independent
cases made all tests green. The second run then exposed only a readonly poison-fixture cast at
compile time; the cast was narrowed and the next full gate passed. Fresh review reproduced the same
load sensitivity in a remaining three-fixture case, so every filesystem-heavy adversarial scenario
was split into its own test instead of increasing the timeout; the final focused and full gates pass.
Fresh implementation and privacy/authority reviews found no HIGH/CRITICAL product defect; their only
actionable proving finding was that reproduced timeout, now fixed and re-proved.

PR #123 head `c5256bb` passed hosted run `31017359944`, merged as `65dfd155`, and exact-merge
Pages/privacy run `31017611856` plus the late-comment sweep were green and empty.

## 2026-08-05 — DL-LIFE-02 B2b-ii-i isolated continuity CAS proposal (merged)

B2b-ii-i deliberately implements the CAS mechanism without pretending the structural composition
is authority. A true renewal writer remains blocked by the unowned anchor origin, individually
stable rather than atomic artifacts, missing same-scope C1/lifecycle transaction, alias rebind risk,
and concurrent revocation. The new module therefore owns no path, artifact, source, identity input,
clock, lifecycle, continuity epoch, retention deadline, lineage event, API, network call, capability
state, or production caller.

The fixture-only database accepts one closed C1 `scope-` ID, safe expected revision, C1 `op-` ID,
and opaque lowercase receipt digest. The digest is local C2 and receives no production retention
claim; every fixture database is invented and disposable. The schema has a distinct application ID,
user version, exact fingerprint, strict revision and operation tables, immutable operation history,
monotonic state triggers, and cross-checks the current revision against a contiguous operation
history. Installation refuses a nonempty main or temporary schema. Every connection re-enables and
checks foreign keys and recursive triggers, and every target validates identity, DDL, integrity,
quick check, and foreign keys before use.

Apply uses one immediate transaction. Exact replay requires the same operation, scope,
expected/applied revisions, and digest; any operation reuse mismatch is `conflict`, while a new
operation at the wrong or absent scope revision is `stale`. The guarded state update must change one
row before the operation insert and final history check. Hooked failures after each mutation roll
back logical state; a real second-connection lock fails through the single generic error and retries
after release. Expected revision `Number.MAX_SAFE_INTEGER` is rejected before addition. The only
returned values are frozen static `applied`, `replayed`, `stale`, and `conflict` objects, and every
failure maps to one content-free error.

The focused CAS/proposal proof passes 2 files / 21 tests. The first full gate reproduced a
pre-existing composer-test timeout under suite load. Its fixture had redundantly run the
durability-heavy installation-key creation workflow before every composer scenario even though the
key seam has its own focused proof. Writing the invented 32-byte key fixture directly at mode 0600
reduced the focused composer suite to 16 tests in about 0.5 seconds and allowed preview/proof
mismatches to be covered separately, without raising the timeout. The final full local gate passes
76 files / 1,128 tests plus context verification, lint, typecheck, build, and diff checking; only
the two existing Evidence Drawer Fast Refresh warnings and bundle-size advisory remain. Fresh
SQL/concurrency, correctness, and privacy/authority reviews found no HIGH/CRITICAL defect.

PR #124 head `006728e` passed hosted run `31020379782`, merged as `34af993`, and exact-merge
Pages/privacy run `31020694799` plus the late-comment sweep were green and empty.

The proposal cannot seed a scope. Future promotion must first add owner-authenticated anchor
provenance, current same-scope retained C1 and lifecycle/revocation state under the writer lock,
continuity-epoch comparison, explicit receipt expiry/sweep, and the expired-alias/new-series
disposition. Only then may a bounded renewal writer exist. The production import graph rejects this
module, protected/generated paths remain uninspected, and every executable capability remains
`never_authorized`.

## 2026-08-05 — DL-LIFE-02 B2b-ii-j inert review-signature verification proposal (merged)

B2b-ii-j isolates the smallest cryptographic prerequisite without converting the review anchor
into authority. The caller supplies exact bounded anchor bytes and a candidate canonical Ed25519
public key plus a closed signature envelope. A successful result proves only that the signature
covers those bytes and that candidate key under the fixed versioned domain; it does not prove who
owns the key, who reviewed the anchor, or that anyone approved or authorized an operation.

The proposal recomputes the anchor and canonical-SPKI SHA-256 digests, constructs fixed signing
material from the ASCII domain, a NUL separator, and the two binary digests, and verifies an exact
64-byte Ed25519 signature. It rejects noncanonical base64, a noncanonical 44-byte Ed25519 SPKI DER
encoding, a high-S signature, digest or field substitution, unknown fields, inherited containers,
symbols, and accessors without reading their getters. Success is one frozen static
`signature_matches` value; every failure is the same content-free error.

The production module imports only `createHash`, `createPublicKey`, and `verify`. It owns no signer,
key generation, trusted-key registry, enrollment or rotation, path, artifact loader, source,
identity input, storage, clock, lifecycle, CAS, retention, network, API, production caller, or
capability effect. Tests create only ephemeral invented keys at runtime, and the AST import gate
rejects every production import of this module. The focused proposal/import proof passes 2 files /
17 tests. The full local gate passes 77 files / 1,137 tests plus context verification, lint,
typecheck, build, and diff checking; only the two existing Evidence Drawer Fast Refresh warnings
and bundle-size advisory remain. Fresh cryptographic/parser plus privacy/authority reviews found no
HIGH/CRITICAL defect.

PR #125 head `96957f4` passed hosted run `31022622947`, merged as `2afaa609`, and exact-merge
Pages/privacy run `31022859341` passed. A Codex P2 review comment arrived after merge and identified
low-order/noncanonical Ed25519 public-key and signature-`R` encodings as a future forgery boundary.
The current proposal has no production caller and treats the candidate key as untrusted, so the
finding is not a reachable activation defect. It is tracked on issue #80 and is now a mandatory
promotion condition: trust-root admission must reject low-order/noncanonical public keys, and any
future verifier integration must reject low-order/noncanonical `R` and prove the identity-point
key/`R` with `S = 0` forgery fails closed. The late review thread was replied to and resolved.

Future promotion must first add a separate process-owned, owner-controlled trust-root and credential
enrollment/rotation/revocation boundary that maps an approved key identity to canonical public-key
bytes and fixed-path parsed anchor bytes. Only after that authority exists may another bounded slice
bind current same-scope retained C1 identity, lifecycle/revocation, continuity epoch, C2 receipt
expiry/sweep, and CAS state under one writer lock. This proposal cannot seed a scope, renew a series,
extend retention, migrate the protected ignored card, authorize a capability, or establish owner
identity. Every executable capability remains `never_authorized`.

The owner completed HUMAN_TODO q-7 on 2026-08-05. Live REST and GraphQL reads prove classic `main`
protection requires `Prove the pull request`; `strict=false` and administrator enforcement remains
off, so the repository's no-red-CI law still binds privileged merges. At the pre-PR cleanup
checkpoint, repository cleanup removed 48 merged local branches and 58 merged remote branches so
only `main` remained registered locally and remotely. This transient state-sync branch/worktree is
removed after merge. The q-8 `dl-worktrees/value01` orphan remains unregistered and deliberately
untouched.

## Exact resume point

The next slice is stated in exactly one place:
[`docs/analyser-program/CURRENT_STATE.md`](./analyser-program/CURRENT_STATE.md). The 2026-08-05
simplification (`docs/analyser-program/10_LIFE_02B_DECISION.md` §7) superseded the previous
trust-root/credential resume prose that lived here.

**Superseded 2026-08-04 (R1 wave 3 — active horizon COMPLETE).** DL-VALIDATE-01 (`df59bbc`, PR #92)
and DL-VALUE-01 (`c632093`, PR #94) have merged, completing all 12 active-horizon cards. There is no
next active-horizon implementation slice; the live resume point is the **roadmap reassessment** that
decides whether the R4 stretch opens — standing preference DL-LIFE-01 (capability lifecycle state
machine), then DL-LIFE-02 (deletion cascade, closes most of
[#80](https://github.com/Chris0Jeky/developer-lens/issues/80)) — and only after the reassessment
confirms capacity. R7/R8 stay frozen. See `docs/analyser-program/CURRENT_STATE.md` (the launcher
file this text once named was deleted 2026-08-05). Items 1–6 below stay valid for the dormant
P4/P12 lanes.

**Superseded 2026-08-04 (R1 wave 2).** DL-SPINE-02 (`b52c458`), DL-SPINE-03 (`610188c`), DL-UX-ED
(`4c3f476`), DL-FINDING-01 (`2208fcf`) and DL-COMPARE-01 (`d407cb1`) have all merged, so the wave-1
resume pointer below is also history. The live resume point is DL-VALIDATE-01 (in flight) then
DL-VALUE-01 — the last active-horizon card — per the R1 wave 2 section above and
`docs/analyser-program/CURRENT_STATE.md`. Items 1–6 stay valid.

**Superseded 2026-08-04 (R1 wave 1).** DL-BRIDGE-01 and DL-METRIC-01 merged, so item 0's pointer
below is history. The live resume point is the rest of the analytics-core kernel — DL-SPINE-02
(PR #84), DL-SPINE-03, and the newly unblocked DL-FINDING-01/DL-COMPARE-01 — per
`docs/analyser-program/CURRENT_STATE.md` and the wave-1 section above. Items 1–6 stay valid.

0. **Next implementation slice (2026-08-04, reconciled): card DL-BRIDGE-01** — the V2
   **bootstrap** slice (authenticated lazy `/api/v2` coverage+capabilities over the synthetic
   store + Coverage Cockpit panel), with **DL-VALUE-01** (first deterministic comparative finding)
   as its named analytical-value successor through DL-METRIC-01/DL-FINDING-01/DL-COMPARE-01.
   Read `docs/analyser-program/CURRENT_STATE.md` first (the launcher file that once followed it
   was deleted 2026-08-05); the full card contract lives in the
   generated starter pack (source `docs/analyser-program/taskdeck/tools/cards.mjs`) and on the
   seeded local Taskdeck board (state summary in `docs/analyser-program/06_TASKDECK_DEMO_PLAN.md`
   §1; exact location, credentials, and restart runbook only in the untracked `RESUME.md` beside
   the database, outside Git). Scheduling follows the ≤12-card active horizon in
   `07_DELIVERY_ROADMAP.md` §0a, not the READY set. New owner gates are consolidated in
   `HUMAN_TODO.md` q-6 and `08_OPEN_QUESTIONS.md` §1. Items 1–6 below remain valid for the P4/P12
   lanes.
1. Refresh Git/GitHub before mutation. The published product baseline before this documentation-
   only closeout is merge `57eef928a64f5c99e17eba1390dbe95d5878391a`; live evidence still outranks
   this checkpoint.
2. The owner ended the autonomous continuation after the documentation/demo closeout. Do not start
   backup/restore, a real selected-repository read, or an OpenAI/Luna request without a new owner
   request. *(Superseded 2026-08-04 by HUMAN_TODO q-5: the owner has since selected one bounded
   public repository and delegated end-to-end execution within its recorded boundary; the LIFE-03
   and #86 preconditions still bind.)*
3. Invoke `$developer-lens-continuation` and preserve P3 as an immutable, unactivated C1 coverage
   pack. Its current reader verifies the Parquet hash after replay; do not expand that proof into an
   activated hostile-writer claim without an immutable snapshot or equivalent boundary.
4. G2 and standing G3 are approved, but no real path is automatically active. Reconcile issue #6's
   duplicate-identity/key-continuity acceptance and issue #5's local-name/identity-vault boundary
   before a real v1 migration. Use invented fixtures and a new bounded task card first.
5. The exact repository is owner-selected in an ignored local task card; its parser, confined
   descriptor-bound loader, and injected public-unauthenticated transport expose no identity or
   operational values in tracked state. The shared alias factory now preserves existing repository
   identities and defines closed unit/page domains; the opt-in store preserves restricted
   coverage without a snapshot or checkpoint advance, and published page receipts now expose frozen
   alias-only membership. Published complete composition now emits canonical hashes,
   receipts, and checkpoint proposals. Published noncomplete composition range-binds transport
   outcomes and produces frozen, checkpoint-preserving transitions without snapshot material. The
   published storage seam proves complete/noncomplete composition-to-storage and same-job/distinct-
   job replay with invented in-memory fixtures. Published composition closes the zero-page post-
   metadata gap and failure-kind/limitation pairing. The published inert runner now binds exact
   reviewed card bytes, enforces a total request ceiling, and requires two hash-equal complete
   observations before complete persistence. The published key-continuity foundation establishes
   an exact task-owned fingerprint without activating a caller. Next bind that fingerprint and the
   task-owned database through a durable reviewed report, then add backup/restore, scoped deletion/
   tombstone, revocation/re-consent, and caller-clock proof. Keep runtime default-off and make no
   real request until those controls, focused failure tests, review, and exact hosted gates pass.
6. G4 is approved only for the exact OpenAI/Luna contract, but `cap.external.model` remains
   `never_authorized`. The strict C1 payload/output and deterministic local-retrieval foundation is
   present, and the credentialless request boundary now enforces native strict output, standard
   service tier, serialized byte/cost ceilings, `store:false`, and one call/no retry. The published
   activation slice adds the strict reviewed-card parser and confined task-ID-bound loader.
   The published preview authenticates the exact credentialless bundle/body against all three
   reviewed payload bindings. The published adapter reads only the approved environment variable at
   call time, applies a whole-response timeout, extracts only validated structured output plus
   numeric usage, and discards raw provider bodies/IDs. It is hosted-green but remains uncalled. Next
   bind the confined card loader to one runtime invocation with an explicit user-reviewable preview.
   Make no live request until that runtime task-card authorization and its task-owned continuity/
   report controls pass.

## 2026-08-06 — late-review truth repair, LIFE-02 B3, and B-2 promotion hardening (PRs #132, #136, #138)

- **PR #132** (merge 6b60dce, heads 19eb4f7 (run 31053538930), 991f952 (run 31054656012), 5d64d30 (run 31055488517) all hosted-green; exact-merge Pages/privacy run 31056663209 green): shared runtime
  evidence contract shared/whyContract.ts (strict schemas, projection-reference coherence,
  pinned versions, capability-registry binding); the four untriaged post-merge findings from
  PRs #127/#131 fixed with discriminating tests (11 of 18 client tests fail against the old
  resolver; the legacy deletion-ID substitution was proven accepted pre-fix and refused
  post-fix). Round-three findings tracked on #135; the adversarially reproduced
  preserved-scope-id digest escape tracked as #133. Post-merge sweep clean.
- **PR #136** (merge 7633444, heads 80f7432 (run 31057203977: type-check FAIL, fixed next head), 5f2b071 (run 31058281133 green), 8e4257e (run 31059434729 green); exact-merge Pages/privacy run 31061095872 green): LIFE-02 B3 —
  server/storage/v3Deletion.ts complete scope deletion (closed 20-table registry, scope-unbound
  tombstones under one del- operation, replay/conflict fail-closed, per-stage rollback, CAS
  cascade via in-transaction trigger drop/recreate, WAL/VACUUM saga); schema v3.1.0-shadow-b3
  (user_version 306); CAS phantom-scope refusal + 13-month receipt expiry with receipt_expired
  replay; v2_coverage_record flipped to delete disposition, killing the bridge/planner
  workaround; the CLI journey runs the product order. 17 new deletion tests (nine plus the eight-stage rollback matrix); 124 across the
  affected suites. Round-three findings tracked on #80 (tombstone C1-window expiry) and #128
  (clock-read placement). Post-merge sweep clean.
- **PR #138** (merge 4770c57, heads 1ca9824 (run 31064891154 green), ce492b4 (run 31065982736 green); exact-merge Pages/privacy run 31066722824 green): mint-order equivalence proof
  replaces graph colouring (net -244 lines; #133 closed; private mintedCollector channel;
  REPLACE-proof owner guards); #86 storage half closed (cov- CHECK + UNIQUE(coverage_id),
  fixtures migrated, pre-#86 stores deliberately fail closed); all ten open #128/#129 findings
  dispositioned with discriminating fixtures (eight real, fixed; two disproved, pinned;
  adjacent hazard tracked as #137); activation_card provenance supported for migration with the
  serving gate untouched (superseding note in 10_LIFE_02B_DECISION.md section 2); Phase-1c
  scale corpus measured 25,469 source rows in ~6.3 s end-to-end (migration ~4.2 s) on the
  Windows dev box, budgets asserted in the opt-in DEVELOPER_LENS_SCALE=1 lane plus an always-on
  smoke lane. Full local gate at the final head: 72 files / 1,175 tests green. Post-merge
  findings triaged: state/ledger repairs in this follow-up PR, technical items tracked as #139.

## 2026-08-06 — LIFE-02 B4 app-owned artifact catalogue and deletion saga

- **Schema and confinement.** Schema `3.2.0-shadow-b4` (`user_version=307`) adds the closed
  `app_artifact`, `app_artifact_scope`, and `storage_maintenance_state` domain. Catalogue rows use
  random `art-` identities, controlled kind/state, manifest and content hashes, one confined
  UNIQUE relative locator, and every owning `scope-`; absolute roots exist only in opaque process-bound
  handles. Root and file identity are revalidated with `lstat`/`realpath`/descriptor identity,
  symlink/junction and hard-link inputs refuse, and errors/results remain content-free.
  Version 307 is deliberately a new copy target: a 306 B3 shadow refuses rather than upgrading
  in place and is rebuilt from the untouched v2 source. No real or production-selected B3 store
  exists; LIFE-03 owns the first-real-migration wrapper.
- **Artifact classification.** The selected store is a mutable app-owned artifact with a controlled
  logical schema-identity hash; separately deletable SQLite artifacts use stable physical SHA-256.
  Registration first checkpoints/TRUNCATEs WAL, requires rollback-journal mode, closes the file,
  and removes only exact inert sidecars; a later representation-only checkpoint cannot stale the
  hash. Temporary files are exclusively claimed, selected-store opens prove the child before and
  after SQLite opens it, and publication uses an atomic no-replace hard link rather than clobbering
  rename semantics. A restart recognizes only the exact two-link, same-inode primary/store state
  left between publication's link and unlink steps, removes the temporary name, and re-proves the
  selected store; every other multi-link state refuses.
  Primary/replay attempts use fixed locators, the registration-only `migration_backup_v1` domain
  admits timestamped backup locators for LIFE-03, and `invented_fixture_store` exists only for
  invented proving data. Exact `-wal`/`-shm`/`-journal` siblings are one registered SQLite family,
  never discovered by scan. The existing caller-directory analysis pack remains a user-directed,
  immutable `COMPLETE` export outside recall; the charter now says so explicitly.
- **Deletion saga.** B3 schedules all scope-owned artifacts and a durable maintenance-pending marker
  in the same IMMEDIATE deletion transaction. Completion validates kind/content, transitions each
  artifact through persisted pending/deleting state, removes only its exact family, records a
  scope-unbound `index_deleted` row under the same `del-` operation, finalizes selected-store
  ownership, checkpoints/TRUNCATEs WAL, VACUUMs, checkpoints again, and only then marks maintenance
  complete. Every artifact phase and all five maintenance phases have close/reopen crash fixtures;
  a shared multi-scope backup is deleted whole while another scope's artifact remains.
- **Proof.** Focused storage/analysis-pack proof: 9 files, 163 passed and 2 tests skipped
  (the opt-in scale corpus and the POSIX dangling-symlink regression on this Windows host).
  The full local gate passed: lint, context verification (27 Markdown / 12 required), 73 test files,
  1,195 passed with the same 2 skips, TypeScript/build, and credential scan over 13 build
  outputs. The first full-gate attempt correctly failed the storage-v3 AST boundary on the new
  catalogue; the final head narrows that gate to the catalogue's two runtime consumers and exact
  schema/proposal dependencies, and the rerun is green.
- **State truth and late-review repair.** B4 does not close LIFE-02 or #80: resolver deletion-lineage
  joins remain scoped to the Phase-E v3 bridge, and #80 still owns 36-month expiry of scope-unbound
  deletion lineage. PR #140's three late precision findings are repaired here: exact-merge
  Pages/privacy runs 31056663209 (#132), 31061095872 (#136), and 31066722824 (#138) are archived,
  and PR #138's exact final-head count is 1,175. PR #140 itself was hosted-green at run 31067873356
  and exact-merge Pages/privacy-green at run 31068019043.
- **Delivery and exact-merge proof.** PR #141 final head
  `9a875ae310d88e68644581a0fbcefcc5925cc8f1` passed exact-head hosted run `31071892180`, merged by
  merge commit `d77b24759fc9d80207f5da0a5ca2789b670a7e7e`, and passed exact-merge
  Pages/privacy/deploy run `31072706976`. The final local gate was 73 files / 1,195 passed / 2
  skipped; the focused proof was 9 files / 163 passed / the same 2 skips. Linux hosted CI executed
  the POSIX dangling-file-symlink discriminator skipped on Windows. A thread-aware post-merge sweep
  at 05:09Z, beyond the measured connector delay, found no new review and no unresolved thread.
- **Bounded review disposition.** Five first-pass connector findings were fixed with discriminating
  tests across the two allowed fix rounds. Three exact-final-head fresh-context lenses were clean
  for crash recovery and lifecycle semantics; the privacy lens found a hostile ABA pathname-
  replacement boundary that cannot be portably bound to the better-sqlite3 handle and is tracked
  as #142. The exact-final-head connector then reported seven further storage invariants after the
  ceiling; each was reproduced/refute-checked, documented with acceptance criteria in #143, replied
  to, and resolved on the PR. Issue #143 is the immediate prerequisite for LIFE-03 because its
  dangling selected-sidecar case is a future path-escape seam. This disposition does not claim
  hostile-writer safety and does not close LIFE-02 or #80.

## 2026-08-06 — #128 CAS clock capture under the writer lock (merged)

`applyContinuityCasOperation` now invokes its process-trusted clock only after `BEGIN IMMEDIATE`
owns the writer lock and after the exact-operation replay check. The stored ISO week therefore
describes the operation's commit opportunity rather than the time before a blocked writer acquired
the lock; replay still returns the immutable prior result without consulting the clock. A direct
fixture observes `db.inTransaction` from the injected clock and asserts the stored week.

Commits `d82607f` and `b6d9e03` passed focused CAS/shadow-sweep proof (2 files / 40 tests), the full
local gate (73 files / 1,196 tests / 2 existing skips), and a clean fresh-context transaction/
privacy review. PR #144 final head `b6d9e03ba4901a77bab7eee9f221cd3862f66ba3` passed exact-head
hosted run `31073068026`; after the exact-head connector-or-15-minute window remained empty, it
merged as `b007f968a736bbba9ce6055cd60b37ad6709f070` and exact-merge Pages/privacy/deploy run
`31073820158` passed. Issue #128 closed. No schema, retention, alias-clock, capability, source, or
activation boundary changed; #137 continued to own the distinct in-service alias-clock hazard.

## 2026-08-06 — #137 alias/identity retention coupling (merged)

When a `claim_scope` alias expires, the same IMMEDIATE sweep transaction now clears that scope's
`repository_identity` provider/analytical values and expiry clock. An identity whose own clock
expires first still clears independently without clearing the live alias; an exact replay mints no
lineage and is a no-op. The discriminator gives alias-first and identity-first invented scopes
different clocks, so the parent behavior fails its alias-boundary assertion.

Commits `defd350` and `ac416d5` passed 20 focused sweep tests, 4 migrated-store integration tests,
the full local gate (73 files / 1,197 tests / 2 existing skips), and a clean fresh-context retention/
transaction review. PR #145 final head `ac416d5271511c3b0ee9d1c9b0f14b954ddb6ab4` passed exact-head
hosted run `31074008009`; after its connector-or-15-minute window remained empty, it merged as
`f1a5e67db437ea2474a3928d97211a7951252d07` and exact-merge Pages/privacy/deploy run
`31074797477` passed. A 05:50Z thread-aware post-merge sweep found no late review or unresolved
thread, and issue #137 closed. No real migration, source, capability, or activation path changed.

## 2026-08-06 — #143 post-B4 storage invariants (candidate)

- **Identity and replacement.** A database's first app-artifact root binding is immutable by the
  reviewed root's path/device/inode identity; a separately opened handle to the same root is
  idempotent, while a distinct root refuses and cannot redirect later registration. A `BEFORE
  INSERT` guard stops `INSERT OR REPLACE` from replacing either an artifact identity or unique
  locator before SQLite can cascade ownership or cancel pending maintenance.
- **No-follow publication.** Every exact selected sidecar is tested with `lstat`, so a dangling
  `v3-store.sqlite-{wal,shm,journal}` entry refuses without following its outside target. A closed
  failure seam covers link, primary unlink, selected proof, and rollback unlink. Failure returns
  only after selected absence is proven; the sole success exception is the exact app-owned
  primary/selected two-link pair. That pair is revalidated by path/device/inode and selectable DB
  before and after every reopen, remains usable through repeated cleanup failure, and collapses to
  one selected link when cleanup later succeeds. Arbitrary hard links still refuse.
- **Lifecycle proof.** Artifact maintenance now completes before the CLI counts deletion lineage;
  ordinary survivor snapshots exclude only the explicitly catalogued lifecycle tables. A shared
  artifact's ordinary lineage transitions transactionally before unlink, both ownership rows and
  the file disappear, its scope-null `index_deleted` proof remains, another scope's ordinary graph
  and B-only artifact remain intact, and injected close/reopen maintenance cannot strand `deleting`.
- **Proof and review.** Rebased code heads `ffd3c08`, `bab29b9`, `0e4b41f`, and test-only precision
  head `9c0f7dc` pass 92 focused tests / 3 Windows skips. The full local gate passes lint, context
  verification (27 Markdown / 12 required), 73 files / 1,206 tests / 4 Windows-platform skips,
  TypeScript/build, and credential scanning over 13 outputs. Fresh lifecycle and privacy lenses
  were clean. The first crash lens found a repeat-unlink reopen defect; the final bounded fix makes
  the exact pair reopenable, and a fresh final crash verification is clean. Hosted Linux/POSIX
  execution, exact-head CI, and connector review remain before merge.

Issue #143 remains the immediate LIFE-03 prerequisite and stays open until merge. Issue #142 still
owns hostile concurrent ABA/native-handle containment; this slice makes no hostile-writer claim and
adds no real migration, protected-data read, capability activation, or production caller.

## 2026-08-06 â€” #146 post-B4 storage hardening (merged)

PR #146 merged as `eb67cb0c9b30a544b56844809db6cfe338641762`. It hardened the B4 storage seams with
immutable app-root binding, REPLACE-resistant artifact identity, no-follow selected-sidecar checks,
deterministic publication recovery, and shared-artifact lineage/lifecycle proof. The synthetic-only
runtime remains unactivated; LIFE-02 and #80 remain open. Exact-head PR run `31075653101` passed at
`150ba45076e7a1860b0eec8e2226e3dff0f0936c`; exact-merge Pages/privacy/deploy run `31076521103`
passed at the merge. Five late connector findings were triaged after the bounded review ceiling,
resolved as tracked in #147, and a post-merge sweep found no additional feedback.

## 2026-08-06 â€” #139 mint-order hardening (merged)

PR #148 merged as `a3fc0fbb98b3b0cc75eb0092b35a0523a84e4ec5` and closed #139. Head
`dfad9e4983cf99528d6fa0b12bcc193504e6a179` bound every closed minted identifier cell to its
semantic digest class, stopped `INSERT OR REPLACE` from bypassing source-snapshot identity guards,
and asserted the generated scale corpus against the documented row/runtime growth envelope. The
focused migration/schema suite passed 87 tests, the opt-in scale lane passed 2 tests, the full local
gate passed 73 files / 1,207 tests / 4 skips, exact-head run `31076874752` passed, the fresh Terra
review was clean, and exact-merge Pages/privacy/deploy run `31077746569` passed.

## 2026-08-06 â€” #147 lifecycle safety vertical (active)

Rebased commits `f0290543cb0962c4e92b205a8a6bf955728b02bd`,
`5d87bf139ec04fb2e629cccf398ac27dd21d157a`,
`ec2f3fb37dfcd10c09d543a4b09726b92e5266ba`, and
`13d45a3cbea185be9919e839169cb440a8ffed59` implement the bounded #147 slice over the #148 merge.
Retained publication recovery now accepts valid accumulated CAS state while the virgin target
acceptance proof stays strict. Synthetic lifecycle fixtures initialize CAS, force repeated
primary-unlink recovery, refuse malformed CAS, snapshot survivor artifact ownership and lineage,
and claim fixed fixture locators with exclusive no-follow creation. Artifact deletion removes
ordinary lineage when the deleting artifact is either its subject or cause, preserves only
tombstone/index_deleted/legacy deletion kinds, and the crash-reopen proof asserts no dangling
causes or stranded `deleting` rows.

Focused proof: `npm test -- scripts/storeLifecycle.test.ts server/storage/v3ArtifactCatalogue.test.ts`
passed 36 tests with 4 platform/scale skips on this Windows host. The exact rebased code/proof head
passed the full local gate: lint, context verification (27 Markdown / 12 required), 73 files / 1,208
tests / 5 skips, TypeScript/build, and credential scanning over 13 outputs. Separate Terra lifecycle
and crash/filesystem reviewers found no findings and refreshed against the rebased head/base. The
lifecycle Terra then completed a distinct clean privacy/authority follow-up because the live thread
ceiling refused a third fresh agent. Hosted Linux/POSIX proof, exact-head connector
review, and merge are not yet verified. #147 remains active until merged. No real store, connector,
capability activation, or private data was used.

## 2026-08-06 — #147 lifecycle safety vertical (merged) and LIFE-03 activation enforcement (candidate)

PR #149 merged as `5728f2f87b0d2d62c03d58ea4e5a724d170d8264` from final head
`83e7384987f0ad3ec76a18deb6add1af15b886e0` and closed #147. Exact-head hosted run
`31078394899` passed; exact-merge Pages/privacy/deploy run `31079336156` passed. The focused
lifecycle suite passed 36 tests with 4 declared skips, and the exact rebased full local gate passed
73 files / 1,208 tests / 5 skips plus lint, context, type/build, and credential checks. Fresh
lifecycle, crash/filesystem, and privacy/authority lenses were clean after two bounded documentation
accuracy fix rounds. The connector-or-15-minute window remained empty, and the post-merge sweep
found no late feedback. No real store, connector, activation caller, or private input was used.

The first LIFE-03 activation-enforcement candidate is code head `04c1219`. It replaces the
github.core runner's registry-literal precondition with a private `WeakSet` grant bound to the exact
task ID, reviewed card hash, installation-key fingerprint, and derived repository scope. Both the
runner and hash-bound card loader validate the grant before card/path/key/store/fetch/write access;
the runner loads only the opaque installation-key handle and opens its caller-owned store lazily.
Registry/API reporting remains `never_authorized`, planning remains denied, and an AST boundary
proves that no production module imports the invented issuer or calls the runner. Invented focused
tests passed 88 assertions; the rebased 46-test activation seam and `git diff --check` passed under
a fresh Terra review with no HIGH/CRITICAL finding. The exact final local/hosted gates, connector
window, and merge remain pending. A later production issuer/caller is a separate reviewed slice;
this candidate does not authorize live collection or any external-model call. Exact-head connector
review identified the exported invented issuer as a P2 local-code footgun: it is lookalike-resistant,
not inaccessible to arbitrary local modules. Issue #151 owns removing it before any production
caller; the operational claim here is only tracked-source default-off, never a local-code sandbox.

## 2026-08-06 — LIFE-03 activation enforcement merged; single-writer lease candidate

PR #150 merged final head `c25626022712b61da5afab2a33763153c8b7caa5` as
`442ec09dd1dc0bdd28e48d8a6e568d0bf2eb2d0b`. Exact-head hosted run `31081764006` passed, and the
exact-merge Pages/privacy/deploy run `31082780368` passed. The code/state head's full local gate
passed 74 files / 1,213 tests / 5 skips plus lint, context, type/build, and credential checks; the
final documentation-only claim correction passed context/diff checks and the hosted full gate.
Two fresh Terra authority/privacy lenses were clean. The exact-head connector P2 was reproduced,
classified nonblocking, tracked as #151, replied to, and resolved; the final 15-minute window was
empty. Registry/API state remains `never_authorized`, there is no tracked production caller, and
the exported invented issuer is not permission for live collection.

The single-writer candidate is rebased code head `46a2afd40dad6536b3dd0cebe1860007b013e7f8`.
It creates one fixed reviewed-root `v3-writer.lease` with exclusive no-follow `0600` creation,
keeps the descriptor and opaque WeakMap lease through synchronous or Promise work, refuses a
second compliant writer before its callback, and removes only its exact proven marker after normal
completion or failure. A crash leaves the marker; there is no programmatic breaker, and manual
removal is permitted only after the owner verifies every Developer Lens writer has stopped. The
invented lifecycle demo and every CLI verb enter through the lease. Focused proof passed 35 tests
with 4 Windows/POSIX skips; the exact rebased full local gate passed 74 files / 1,224 tests / 6
skips, build, and credential checks. Separate exact-base Terra filesystem and crash reviews were
clean. Hosted Linux/POSIX proof, connector review, and merge remain pending. Issue #142 stays open
for hostile same-user ABA/native-VFS criteria 3/4; this candidate claims only one compliant writer.

## 2026-08-06 — LIFE-03 single-writer lease merged; selected-store backup candidate

PR #152 merged final head `5c1e3085867026bfc971a62e5678dcafab3c596f` as
`ee20d63118072134508393616b896dc7b27dd7e5`. Exact-head `Prove the pull request` run
`31083302290` passed, and exact-merge Pages/privacy/deploy run `31083561314` passed. The lease owns
one fixed app-root marker through Promise settlement, prevents a second compliant writer from
reaching its callback, and leaves crash recovery manual-only after every writer is stopped. Issue
#142 remains open for hostile same-user ABA/native-VFS criteria 3/4.

The PR did **not** satisfy the binding pre-merge review-timing protocol. It merged at
08:06:46Z, less than four minutes after the final push/check dispatch, with no exact-head connector
result and before the required 15-minute fallback window. A later thread-aware sweep remained empty
and the merge deployment was green, but neither fact retroactively repairs the missed pre-merge
gate. This is a recorded process defect; it is not evidence that the gate passed.

The selected-store backup candidate is code head `98d3c95`. Schema `3.2.1-shadow-life03-backup`
(`user_version=308`) records a staged catalogue intent before any backup bytes. Under the merged
writer lease, the SQLite backup API produces one durable selected-store snapshot while leaving the
source untouched; a canonical manifest binds its exact content hash, selected artifact identity,
complete sorted owner set, reviewed task identity, and installation-key HMAC. The temporary and
final SQLite/manifest paths are an exact no-follow hard-link pair until a single-use private
publication proof revalidates the physical files, snapshot schema/integrity/foreign keys, owner
set, key-bound manifest bytes, and catalogue placeholder. A genuine key from another task root and
a forged publication object both fail before promotion.

Recovery is idempotent across all eight durable stages: intent commit, SQLite temp, manifest temp,
both final links, catalogue promotion, and the two distinct temp unlinks. It reuses the first
durable snapshot instead of silently refreshing it, refuses conflicting paths and sidecars, checks
descriptor/path/link identity plus selected-store lineage, and completes only the exact recorded
pair. Invented crash/reopen fixtures also prove a live writer marker blocks recovery and that
post-intent source mutation cannot alter the recovered snapshot.

The first bounded exact-base review round found two HIGH publication blockers: arbitrary hashes
could be promoted without physical files, and a genuine installation-key handle from another task
root was accepted. Both are fixed at `98d3c95` with the single-use physical publication proof and
private task-directory binding. Focused TypeScript plus backup/key/catalogue/proposal proof passes
4 files / 64 tests / 1 declared skip. The full local gate passes lint, context verification
(27 Markdown / 12 required), 76 files / 1,248 tests / 6 declared skips, TypeScript/build, and
credential scanning over 13 outputs. At code/review head `43d4259`, three fresh Terra lenses found
no CRITICAL/HIGH lifecycle/crash, manifest/recovery, or privacy/authority blocker; each independently
confirmed the two prior attack paths are closed. The range-level whitespace check is clean, and the
semantic-equivalent proposal allow-list cleanup passes its 8 focused tests. Hosted Linux/POSIX
proof, the connector-or-15-minute window, and merge remain pending. No real store, legacy source,
connector, activation caller, external-model request, or private input was inspected or used. The
next vertical after backup is atomic selection/fallback and the seven-day grace boundary;
restore/tombstone replay and cleanup remain separate slices.

## 2026-08-06 — LIFE-03 selected-store backup and singleton merged; task-key hardening candidate

PR #153 merged final head `982f6fbcb835526d9b0d13cdb9fc0469d84ce337` as
`d0bac814006bada9669d1e414cf741e883131df3`. Exact-head `Prove the pull request` run
`31087130112` passed; exact-merge Pages/privacy/deploy run `31088363673` passed. Three fresh Terra
lenses were clean at the final head after the bounded two fix rounds. The exact-head connector then
raised five findings. All were independently refute-tested with invented fixtures, replied to, and
resolved under the binding review ceiling: #154 tracks parent-directory durability ordering; #155
tracks zero/partial pre-durable SQLite and manifest recovery; #156 tracks uppercase canonical task
IDs plus continuity-authorized key handles; and #157 tracks the singular migration-backup identity.
The multiple-backup reproduction confirmed the cardinality defect, while current scope-revocation
maintenance successfully removed both pairs, so a cleanup wedge was not claimed. A thread-aware
sweep more than ten minutes after merge found no new or unresolved feedback.

The #157 candidate is code heads `343903a` and `d1e24d5`. Schema
`3.2.2-shadow-life03-backup-singleton` (`user_version=309`) adds a partial UNIQUE index for
`migration_backup_v1`, a `BEFORE INSERT` guard that prevents `INSERT OR REPLACE` from deleting the
existing row, and catalogue cardinality assertion. Public invented-fixture proof covers exact
same-identity replay, distinct timestamp/identity refusal with no second files, staged/pending/
deleting refusal, complete application-controlled deletion, and post-cleanup recreation. A direct
SQL fixture proves REPLACE cannot bypass the singleton or disturb the original row. Focused backup
proof passes 24 tests. The exact code/state working head passed the full local gate: 76 files / 1,248
tests / 6 declared skips, lint, context verification (27 Markdown / 12 required), TypeScript/build,
credential scanning over 13 outputs, and range whitespace checks. Three fresh Terra lenses at exact
candidate head `2574c28062b984dd36fcfe4bceb0a23c6fa68cd9` found no CRITICAL/HIGH schema/fingerprint,
lifecycle/crash-recovery, or privacy/authority defect. Their focused invented-fixture proofs covered
84 tests / 1 declared skip, 82 tests, and 24 tests respectively; all confirmed that #154-#156 stay
accurately tracked rather than being overclaimed by this singleton slice. All three rebound the same
conclusion to the docs-only final head. PR #158 final head
`994bb6e8e20a5c6cb6e16926b0eec7cd2ba8ac2c` passed exact-head `Prove the pull request` run
`31089644527`. No connector review arrived, so the immutable head remained open from its 09:34:00Z
ready creation through the 09:49:29Z final thread-aware sweep before merge. It merged as
`cafd699360f13902f04092b98603c0f7cb81a0a0`; exact-merge Pages/privacy/deploy run `31090730918`
passed. A 10:03:46Z thread-aware post-merge sweep found no late review or unresolved thread.

The #156 candidate began at code heads `103a2c8` and `708ba71`. A dependency-free shared validator
defines the exact case-preserving `[A-Za-z0-9_-]{1,128}` task-ID grammar for activation artifacts,
GitHub and OpenAI task cards, grants, task-owned installation keys, and backup input without Unicode
or case normalization. A private `WeakSet` capability authorizes current-session setup handles; an
existing key can join only through a process-local, privately issued github.core grant that binds
its exact task ID and fingerprint. Bare expected fingerprints remain integrity checks only. Backup
entry and direct-intent paths reject ordinary, replacement, copied, forged, cross-root, or stale
handles before a catalogue or file side effect; direct manifest and publication seams independently
reject the same handles.

PR #159 old head `6ff38d45d4506baf922eb84f89b8c81473e2493d` passed exact-head hosted run
`31091461170`. Its exact-head connector review then raised three P1 findings, all reproduced with
invented fixtures: a caller could copy an inspection fingerprint and self-authorize a second load;
deleting the key after staged intent allowed a new setup handle to publish that old intent; and an
accessor-swapped `db` could validate root A but register the intent in B. First fix head `6a672ac`
makes bare fingerprints non-authorizing, adds the opaque grant-backed loader used by the existing
runner without adding a production grant issuer or backup caller, binds the staged-intent digest to
the original key fingerprint, and snapshots the direct-intent input's own data properties once.
Fresh lifecycle review then reproduced one final HIGH: the retained original in-process handle could
survive deletion/recreation and recover the intent. Second and final fix head `337e964` reopens the
live confined key no-follow, proves stable descriptor/path state, reads it twice, and requires exact
key-byte continuity before every protected bind. The stale-original-handle recovery fixture now
fails before effects.

Final focused proof passes 88 tests / 1 declared skip; the full gate passes 77 files / 1,266 tests /
6 declared skips plus lint, context, TypeScript/build, credential scanning, and range whitespace
checks. Three fresh Terra lenses at exact code head
`337e964f5c6ffca9f8c8b1d87623896d09715574` found no CRITICAL/HIGH key-file, lifecycle, or
privacy/authority defect and no new CRITICAL introduced by the final fix. The same-user ABA/native
file-identity boundary remains tracked on #142, the test-only grant issuer remains tracked on #151,
and generic staged-row validation deliberately cannot recompute the fingerprint-bound intent without
the live handle; every operational recovery/publication path does recompute it before promotion.
Hosted proof for the final head, thread reconciliation, the connector-or-15-minute timing window,
and merge remain pending.

No real store, legacy source, connector, activation caller, external-model request, generated
output, or private input was inspected or used. Issues #154-#156 and the full grace/restore path
remain prerequisites to any real invocation.

## 2026-08-06 — activation default-deny merged; LIFE-03 crash durability candidate

PR #160 merged final head `e86c794` as merge commit
`b27a712303db1340106aee86475503087747f19b` at 2026-08-06T13:10:24Z and closed #151. Its exact
local gate passed 77 files / 1,269 tests / 6 declared skips plus lint, context, TypeScript/build,
credential scanning, and range whitespace checks. Exact-head hosted run `31103488291` passed. Five
connector threads were reproduced or scoped, fixed, replied to, and resolved within the bounded
review pipeline; two fresh Terra passes found no remaining CRITICAL/HIGH defect. The test-only final
head completed the binding 15-minute fallback window with a fresh thread sweep, and the delayed
post-merge sweep found no late connector feedback. Production exports no grant issuer and contains
no runner caller; registry/API capability state remains `never_authorized`.

The exact-merge Pages run `31104689598` passed build, full-gate, privacy, and artifact checks. Its
deployment job accepted the verified artifact but remained `deployment_queued` for the action's
600-second timeout. One bounded failed-job retry accepted the same artifact and repeated the same
queue timeout. Deployment IDs `5780048568` and `5780538785` are the support evidence. The Pages
environment had no wait timer/reviewer and the merge changed no workflow configuration; the queue
stall is parked as an external publication-service failure, not recast as a green deploy or a code
regression. No third blind retry is authorized without a distinct new condition.

The cohesive #154/#155 candidate is PR #161, with product code head
`4abe91d737dd2d7d25d81aba9a1d91f42c2e9544`. Schema
`3.2.3-shadow-life03-backup-attempt` (`user_version=310`) persists one strict provisional-attempt
row per staged backup. The row binds stable device/inode identities for SQLite and manifest plus the
first durable SQLite content hash; fields are one-way immutable and promotion consumes the row in
the same transaction that publishes the final catalogue locator.

Publication now makes both final hard-link names durable with an artifact-parent directory sync
before catalogue promotion, and makes each temporary unlink durable before reporting its cleanup
stage. Native directory sync fails closed on unsupported platforms. Invented ordering seams cover
every sync boundary; the Windows host exercises the injected ordering contract while hosted
Linux/POSIX proof remains required for the native primitive.

Recovery claims each provisional with exclusive no-follow creation, durably records the name, binds
its descriptor identity, and then operates on that same object. A proven owned zero, strict prefix,
or structurally incoherent pre-durable SQLite attempt is truncated and retried on the original
inode; a coherent snapshot is never silently refreshed. Manifest recovery accepts only exact bytes
or a strict expected prefix, rewrites on the original inode, and re-fsyncs/re-proves even an exact
reopened manifest before any final link. Wrong-inode, symlink, disallowed-link-count, foreign-byte,
unbound-name, and recorded-hash collisions remain untouched and fail closed. The production native
entry strips every fault hook before execution.

Partial SQLite recovery now recomputes and checks the complete live owner set immediately before
truncation and again after the last injected pre-backup boundary. Owner drift therefore fails before
the provisional inode, bytes, attempt row, or catalogue state changes. The invented regression adds
an owner after the crash and proves all of those surfaces remain unchanged.

Staged revocation now preflights every surviving SQLite/manifest pair member against the persisted
attempt identity and optional SQLite hash before artifact state, lineage, sidecars, or primary files
are mutated. A null-identity intent is removable only when both names are absent; a recorded identity
may be wholly absent only in `deleting`, the exact crash-after-unlink recovery state. Final catalogue
deletion cascades the attempt row. Published post-promotion backup cleanup keeps its existing hash
and manifest proof.

The exact product-code head passes the full local gate: lint, context verification (27 Markdown / 12
required), 77 files / 1,306 tests / 10 declared skips, TypeScript/build, credential scanning over 13
outputs, and range whitespace checks. Focused backup proof passed 81 tests / 4 skips; catalogue
proof passed 26 / 3 and deletion proof 18. A fresh Terra review found and caused the exact-manifest
re-fsync repair at `e790ded`; a fresh narrow review then found no CRITICAL/HIGH regression and
independently reran the full gate at 1,300 tests / 9 skips. A final exact-range Terra review
exercised 147 focused assertions / 5 platform skips at `e7727f8` and found no CRITICAL/HIGH
blocker. The first hosted PR run `31112768523` exposed a Linux-only nondeterministic fixture caused
by immediate inode reuse; test-only head `1053cf8` keeps the original inode live while allocating the
replacement and exact-head run `31113152030` passed 77 files / 1,313 tests / 2 skips plus build and
synthetic-showcase privacy proof. The connector then raised three findings: provisional metadata in
the backup snapshot is a restore-boundary requirement tracked by #163; the confirmed owner-drift
P1 is fixed at `4abe91d`; and conditional all-zero native identity availability is tracked by #142
as a P2. Hosted Linux/POSIX CI for the final pushed head, final review reconciliation, and merge are
pending.

The deliberately fail-closed interval after a durable exclusive temp-name claim but before durable
attempt-identity binding can require trusted manual reconciliation; blindly unlinking or adopting
that name would violate #155. Actual host-power-loss behavior is represented by ordering/failure
seams, not physically induced on this machine. Same-user ABA/native-VFS strength remains #142, and
sidecar/WAL identity, seven-day expiry cleanup, restore/reopen, and tombstone replay remain dependent
LIFE-03 slices. No real store, legacy source, connector, production issuer/caller, external-model
request, generated output, or private input was inspected or used.

## 2026-08-06 — crash-durability owner exception; atomic selection/grace candidate

PR #161 final head `7a23f62a7e01f49e7b052b6338f0f773d2da3cbf` merged as
`faa548cc2020def9bf363de8ccf65c1d553f3b67` at 2026-08-06T16:03:34Z and closed #154/#155 under an
explicit owner-directed gate exception. Exact-head hosted run `31115867132` never reached checkout
or repository code: attempts 1 and 2 each exhausted action-metadata download retries on `Service
Unavailable` during GitHub's declared Actions partial outage. The merge therefore has green local
full proof and fresh-context review, but **no green exact-head hosted proof**; this is recorded as a
deliberate exception, not recast as compliance. The delayed thread-aware sweep found no new connector
review and all three earlier threads remained resolved. Restore-bound provisional metadata stays
tracked by #163, and the conditional all-zero native identity boundary stays tracked by #142.

The #162 candidate advances schema `3.2.4-shadow-life03-selection` (`user_version=311`). A strict
singleton `migration_selection_state` records only `v3_selected`, an opaque `legacy-` identifier,
the selected and backup `art-` identifiers, a canonical successful-report timestamp, and its exact
seven-day deadline. It has no SQL foreign key to `app_artifact`, is registered `global` in the
exhaustive deletion inventory, survives scope revocation, and rejects replacement, update, or delete.
The recorder uses `BEGIN IMMEDIATE`; exact replay preserves the original time/deadline, while a
mismatch or injected pre-commit interruption fails closed without a row. Injected UTC proof covers
just-before, exact-boundary, just-after, clock rollback, and clock advance. This slice records expiry
eligibility only and performs no cleanup.

`verifyStorageV3MigrationBackup` is a dedicated synchronous read-only proof for the already-finalized
singleton backup. Under the selected-store writer lease it revalidates the live task key, maintenance
state, active final catalogue rows, selected and backup owner equality, absent provisional names and
SQLite sidecars, stable no-follow physical hashes, exact task-key HMAC manifest, and backup snapshot
application/schema/fingerprint/integrity/foreign-key/selected-ID state. It returns only values derived
from those re-proven rows/files and closes every descriptor/readonly snapshot handle on refusal.

`selectStorageV3Reader` accepts no legacy path and performs no legacy read, write, delete, or fallback
open. It validates closed own-data input, opens the reviewed v3 root, and uses a deliberately narrow
read-only receipt-presence probe before and inside the writer lease. First selection opens and proves
the selected store, proves the finalized backup, commits the receipt, closes the writable provisional
connection, then reopens read-only. Exact receipt replay revalidates the selected store and live
task-key/root continuity but skips backup revalidation because normal scope revocation may validly
delete that backup. Present or ambiguous durable-selection state returns only
`v3-selection-selected-refused` on failure; only a plainly absent receipt may retain the content-free
`legacy-json` fallback. The invented integration proves exact replay, pre-commit interruption/restart,
no grace extension, forged-handle refusal, lease contention, invalid root/store/backup fallback, no
legacy-path input, write refusal, and selection -> both-scope revocation -> backup deletion -> restart
without legacy resurrection.

The original product-code head `6bc1db2` passed `npm run check`: lint, context verification (27
Markdown / 12 required), 79 files / 1,323 tests / 10 declared skips, TypeScript/Vite build, and
credential scanning over 13 outputs. The combined focused selection/schema/backup/deletion/import-
boundary proof passed 145 assertions / 2 platform skips. Independent Luna reviews found no
CRITICAL/HIGH verifier or receipt/selector defect.

Fresh Terra review at published head `12cfd36` then reproduced one HIGH privacy/durability defect:
scope revocation validly deleted the finalized backup, restart re-ran backup proof before receipt
replay, and the refusal returned `legacy-json` while the seven-day source could still contain the
revoked scope. Fix head `dabbb10` makes durable or ambiguous selection state non-legacy and replays an
exact receipt without requiring the deleted backup. Integration review then found that skipping the
backup verifier also skipped its task-key/root continuity proof; `0c37ef2` restores that proof and
adds a forged-handle regression. The exact code head passes `npm run check`: lint, context verification
(27 Markdown / 12 required), 79 files / 1,324 tests / 10 declared skips, TypeScript/Vite build, and
credential scanning over 13 outputs. Focused selector proof passes 5 tests and range whitespace is
clean. Initial hosted run `31119973871` remained queued without a step start and was automatically
cancelled when the repaired head was pushed. Exact-head run `31121191791` is likewise queued without
a step start during GitHub's declared critical Actions incident; this is not green hosted proof.
Fresh fix review, merge, and post-merge sweep remain pending.

The exported backup verifier's selected-store structural assumptions remain bounded to its current
selector caller; #163 requires a separate standalone restore verifier rather than reusing it when the
selected store is absent. Connector review's lower findings on runtime-opaque success-report binding
and a NULL-producing upper timestamp boundary are tracked together by #165; neither is hidden or
treated as activation-ready. No real store, legacy source/path, connector, production issuer/caller,
external-model request, generated output, credential, or private input was inspected or used.
Success-report/grace hardening (#165), restore/reopen (#163), tombstone replay, and physical
legacy/backup/WAL/SHM/journal cleanup remain dependent LIFE-03 slices.

## 2026-08-06 — atomic selection merged; late rollback-floor follow-up

PR #164 final head `eca8e86d8d79d7b5ab41a5e32d1209132aa9826b` merged as
`fee152d5e458b5f9574521471ef0b23183a2ab77` at 2026-08-06T16:58:22Z and closed #162.
The exact code head passed `npm run check`: lint, context verification, 79 files / 1,324 tests / 10
declared skips, TypeScript/Vite build, and credential scanning over 13 outputs. Fresh Terra review at
the final head reran the 5-test selector proof and range whitespace check and found no remaining
CRITICAL/HIGH blocker. Five connector threads were triaged once: the post-commit and revoked-backup
P1s were fixed; the volatile-state P1 was fixed; and the two grace-contract P2s are tracked by #165.

Exact-head hosted run `31121328404` remained queued without a repository step while GitHub's official
status reported a critical Actions incident. The owner explicitly directed the program to document
the external gate gap and keep moving pre-release, so PR #164 merged under that exception. This is
not green hosted proof. Exact-merge showcase run `31121665220` also entered the outage queue; its
eventual result must be refreshed rather than inferred.

Two additional connector P1s posted at 16:57Z and were discovered by the immediate post-merge thread
sweep. A lease loser could return legacy immediately before the winner committed selection, and a
missing selected-store file was treated as an absent receipt even though the receipt lived inside the
missing file. Both are confirmed privacy rollback paths during the seven-day grace and are linked to
follow-up #166 from their original PR threads.

Follow-up commits `4fb0655` and `122b36a` make every writer-lease contention and every missing/moved
selected-store probe return only `v3-selection-selected-refused`. The invented race proves the loser
is unavailable and the winner then commits v3; the store-loss fixture proves a prior durable switch
cannot fall back after its file disappears. Focused selector proof passes 7 tests, TypeScript/Vite and
the credential scan pass, and range whitespace is clean. The exact candidate passes `npm run check`:
lint, context verification, 79 files / 1,326 tests / 10 declared skips, TypeScript/Vite build, and
credential scanning over 13 outputs. Hosted, fresh-review, PR, merge, and delayed post-merge proof
remain pending. Restore #163 is the recovery path behind this deliberate unavailable state; no real
source, legacy path, private/generated data, connector, or production caller was inspected or
activated.

## 2026-08-06 — rollback floor merged; external selection proof candidate

PR #167 final head `18d0c31eabe9fe206b44c9bbdfa788274abc54f8` merged as
`b1c75c52852af276cd913473d816b7a79123d260` at 2026-08-06T17:09:55Z and closed #166.
The final local gate passed 79 files / 1,326 tests / 10 declared skips, the focused race/store-loss
proof passed 7 tests, and a fresh Terra exact-head review found no CRITICAL/HIGH blocker. Hosted run
`31122116478` and exact-merge showcase run `31122305206` remained queued without repository steps
during the declared critical GitHub Actions incident. The owner explicitly continued the documented
pre-release outage exception; those runs are not represented as green hosted proof.

Issue #168 records the prerequisite discovered while implementing restore #163: the deliberately
pre-selection backup cannot authenticate the later success timestamp or grace deadline. Code head
`00e6161` therefore adds a canonical installation-key-bound local C2 marker, publishes it only
from the committed selected-store receipt under the writer lease, and returns unavailable after any
post-receipt failure. Exact replay reconstructs a missing marker from that immutable row; conflicting
bytes, wrong roots/keys, links, sidecars, and deadline extension fail closed. The standalone marker
survives process restart at every publication stage and re-synchronizes final-only recovery before
claiming replay. Its opaque single-use handle is reserved for restore; plain caller-supplied receipt
objects do not cross the production restore boundary.

Focused proof/selector/allowlist verification passes 25 tests. `npm run check` passes lint, context
verification, 80 files / 1,336 tests / 10 declared skips, TypeScript/Vite build, and credential
scanning over 13 outputs; range whitespace is clean. The first standalone review found and the bounded
fix round repaired restart-stuck empty provisionals and directory-sync replay laundering; the exact
standalone head `441f5cb` then received a clean CRITICAL/HIGH review. Fresh integration review found
and the fix head `00e6161` repaired two preflight/foreign-marker legacy-fallback paths; its final
17-test review, TypeScript check, and whitespace check found no remaining CRITICAL/HIGH blocker.
PR #169 final head `b8592ec343ba09df108a3e83d55736d89701545c` merged as
`93a342c85ba8a4bee96f18f71c0b269f5e536234` at 2026-08-06T18:04:46Z. The PR had no
reported hosted checks, connector review, comments, or review threads while GitHub Status continued
to classify Actions as a critical major outage. After more than three minutes at the pushed head,
the owner-directed pre-release outage exception carried the green local gate and independent reviews;
this is explicitly not hosted proof. A late connector review then raised five P2 marker-hardening
findings. They were triaged once, replied to, resolved on PR #169, and recorded in #170: task-ID
minimization, exact-root primitive probing, durable-publication/verification coordination,
case-variant reserved-name detection, and recovered-final re-sync ordering. Issue #168 remains open
because those follow-ups refine its original acceptance criteria; restore consumes the handle but does
not claim the complete marker contract or hosted proof.

Restore code head `90ff38f` composes standalone signed-backup verification, exact copied-snapshot
normalization, identity-safe publication/recovery, and opaque single-use proof consumption. A real
filesystem fixture deletes the selected store, restores only from the immutable backup plus marker,
preserves backup/manifest/marker bytes, removes only staged backup catalogue state in the copy,
records the exact original receipt, and reopens read-only. Caller-minted receipts, extra re-signed
catalogue artifacts, pre/post-link name replacement, and repeated directory-sync failure all refuse.
The focused storage chain passes 117 tests / 2 platform skips; restore itself passes 22 tests.
`npm run check` passes lint, context verification, 81 files / 1,362 tests / 10 declared skips,
TypeScript/Vite build, and credential scanning over 13 outputs. Fresh exact-head Terra review found no
CRITICAL/HIGH blocker within the declared single-owner boundary. It recorded two remaining pathname
TOCTOU windows under #142: a hostile same-user process can race the native path-only link/unlink APIs,
so this slice makes no hostile-writer containment claim; the writer lease excludes compliant writers,
post-link identity failure refuses without legacy fallback, and native handle/VFS binding remains the
tracked remedy. Hosted proof, PR/merge, issue closure, and post-merge sweep remain pending. #165 still
separately blocks authority for the initially supplied
successful-report timestamp. No real source, store, legacy path, private/generated data, connector,
credential, or production caller was inspected or activated.

## 2026-08-06 — restore/grace/marker hardening merged; revocation replay candidate

PR #171 final head `0dfdd02e5a05daf6b5b12e1eb7a8dd3e654bda10` merged as
`171b319f3ed740f398690c802258a5f1bdde0446` at 2026-08-06T18:24:29Z and closed #163. The
standalone restore consumes a fresh opaque selection-proof handle, independently verifies the signed
backup after selected-store loss, copies and normalizes only the provisional backup state, restores
the exact committed receipt/deadline, publishes durably, and reopens read-only. Invented fixtures
prove backup/manifest/marker immutability and stale-path refusal. The accepted single-owner boundary
still leaves native pathname ABA under #142.

PR #175 final head `7659be907d12a5c59bae26c14f4b97cab0424bd8` merged as
`eb69cc6d632df4984a0ce26624614b03fff75625` at 2026-08-06T19:02:04Z and closed #165.
Fresh review found and the fix head repaired two HIGH defects: production had committed a runtime
timestamp and then compared it with a caller timestamp, and lowercase-only validation rejected
canonical task IDs such as `DL-LIFE-03`. The public selector no longer accepts a success timestamp;
production owns the clock, replay preserves the committed time, and the changed storage seam passed
66 tests plus TypeScript, lint, build/no-secrets, and whitespace proof. Connector P2 proof-replay
capability hardening remains tracked by #177.

PR #176 final head `bbf8da004be691bfb06cc4901de4159a71f93615` merged as
`68473dcb01c457fa20ac9fdaa7f101d657e1102c` at 2026-08-06T19:23:36Z and closed #170.
It minimizes the local marker to a keyed task fingerprint, probes exact-root hard-link/directory-sync
support under the writer lease, rejects case-variant reserved names, and re-synchronizes recovered
publication. Delayed review exposed an authenticated temp/final pair that could block restore after
the selected database was lost; the final head re-verifies and finalizes that pair under the writer
lease before minting a handle. The full exact-head local gate passed 81 files / 1,367 tests / 10
declared skips, TypeScript/Vite, context, lint, credential scanning, and whitespace proof; a fresh
exact-head review reran 42 focused assertions and found no CRITICAL/HIGH blocker. #168 remains open
for pre-activation marker versioning, restart-safe fixed-probe recovery, and hosted proof.

All three PRs used the owner's explicit pre-release GitHub Actions outage exception. Hosted checks
were absent or unavailable and are **not** represented as green. Review findings were triaged once,
blocking defects were fixed, non-blocking residuals were tracked, and each pushed final head aged at
least three minutes before merge.

The #172 integrated candidate is branch `codex/life03-tombstone-replay-integrated`, exact code head
`47cc12e`. It adds `revocation-replay-v1-00000000.json`, a mandatory keyed
`revocation-replay-v1-head.json`, and chained immutable entries under the selected task root. Every
entry is published before SQL deletion with exclusive no-follow creation, file fsync, no-clobber
hard link, and directory-sync ordering. Its schema is content-free local C1: opaque
scope/subject/operation IDs, controlled capability and ISO-week values, selection/task/key bindings,
and integrity hashes only — no raw task ID, names, aliases, paths, prose, exact timestamps, or
observed values. Missing, truncated, foreign/case-variant, non-canonical, or unapplied state fails
closed and never enables legacy fallback.

Selected read and restore verify the complete family and keyed head, then replay every intent before
serving data. The invented stale-backup journey deletes a scope, reintroduces the old signed backup
bytes, restores, and proves the revoked scope/observation remain absent while the exact content-free
tombstone remains present. Crash fixtures cover interruption after durable intent and after SQL
deletion commit. Early review found that post-commit interruption could leave deletion maintenance
permanently pending; fix `a67d1c9` resumes the exact pending saga before replay and proves
catalogue/backup cleanup reaches complete.

Two later fresh reviews found initial-publication gaps. Fix `b333309` makes the keyed head mandatory,
refuses whole-family loss and tail truncation after a committed receipt, and prevents a committed
empty family from minting a new receipt. Fix `844e7a6` couples first-family publication to the
receipt transaction: a single-use opaque grant publishes only an empty `initializing` family inside
that transaction, the SQLite commit makes the receipt authoritative, and a durable head replacement
to `committed` must finish before proof publication or service. A crash before the SQLite commit
rolls the receipt back and may resume only the exact empty initializing family, even when the new
runtime success time differs; a crash after SQLite commit resumes only final head publication from
the exact receipt. Foreign head-only state is rejected before anchor mutation. Committed, missing,
or non-empty families with a surviving receipt/proof cannot enter this initialization path.

The first full gate on `844e7a6` correctly exposed a local binding defect: the reader declared replay
state `const` and reassigned it during readonly reopen verification, producing 19 fail-closed
selection refusals. Fix `47cc12e` changes only that binding to `let`. Its reader suite passes 23/23;
the exact-head `npm run check` passes lint, context verification, all 82 test files with 1,388 tests
passed and 10 declared skips, TypeScript/Vite build, and credential scanning over 13 outputs.
A fresh exact-head Terra crash/privacy review reran 65 focused assertions plus TypeScript and
whitespace proof and found no realistic CRITICAL/HIGH blocker. An independent exact-head Luna
review reran the 56-test replay/read/restore seam, audited publication/recovery ordering and
fail-closed boundaries, and likewise found no CRITICAL/HIGH blocker.

The replay family deliberately survives #173's seven-day old-source/backup cleanup so a stale
filesystem snapshot cannot resurrect revoked data. It remains local/unexported and must be removed
no later than the C1 36-month boundary or whole-task-root deletion. Coordinated rollback of both an
entry and its keyed head to an older mutually authenticated snapshot remains outside the declared
single-owner/#142 ABA boundary because no external monotonic witness exists. The raw
`deleteStorageV3Scope` primitive also remains exported for invented lifecycle composition; production
integration must use the replay-first wrapper and keep that boundary enforced.

The future C2-expiry transition needs an additional durable discriminator before it may remove the
receipt/proof. If that future cleanup is combined with a coordinated snapshot/fault that removes a
formerly committed head and all tail entries but leaves the valid anchor, the remaining bytes are
indistinguishable from an anchor-only rolled-back first attempt because the retry binding deliberately
excludes success/grace timestamps. This state is not reachable through today's immutable receipt or
normal crash ordering; the [#173 cleanup proof note](https://github.com/Chris0Jeky/developer-lens/issues/173#issuecomment-5208995872)
records the requirement that future cleanup refuse, not recreate, an anchor-only/truncated C1 family.

#172 closed when PR #179 merged. #173 owns physical expiry cleanup without early replay-family
removal. Phase E stored-observation bridge, resolver lineage, and the change-batch/integration-tail
second lens remain separate #174/#80 work. PR #179 merged during the owner-directed pre-release
Actions exception: hosted exact-head proof was unavailable and is not represented as green. No real
source/store, legacy path, private/generated data, connector, credential, production issuer/caller,
or external-model request was inspected or activated.

## 2026-08-06 — revocation replay merged; large-scope chunk repair (PR #184)

PR #179 carried code head `47cc12ebf9e9b807a7c26d35a6443dfff589596f` plus documentation
head `654261cd7d341fc13026b36dd54e2e2575a316e3`, merged as
`565efad47b543dbb2ae891b325d626b67dc4c630` at 2026-08-06T20:48:59Z, and closed #172.
The owner explicitly continued the pre-release GitHub Actions exception: the local exact-head gate
and independent reviews are recorded above, but hosted proof was unavailable and is **not** green.

A delayed exact-head connector review then confirmed that the 100,000-subject total publication
ceiling conflicted with the 16 MiB per-record ceiling and could make a sufficiently large selected
scope impossible to revoke. The finding is tracked by #180; the original PR #179 thread remains
open until this follow-up merges. PR #184 initial code head
`7da6804f6f1cc993d7bc8296c3dcaff0a416f647` replaces the total ceiling with deterministic bounded
chunks of at most 4,096 canonical subjects. Every record binds its chunk index/count, total subject
count, partition size, and a domain-separated digest of the complete logical subject set. The whole
publication plan, record sizes, and sequence capacity are validated before chunk zero; each record
and its physical keyed head is made durable before the next record or any SQL deletion.

Read, restore, and replay aggregate only contiguous complete chunk groups with one exact operation,
scope tombstone, subject count, and total digest. A head-matched partial tail is recoverable but is
never readable or restorable. Restart replans the still-live selected scope under the stored
operation/week, requires the same total digest/count/partition and exact already-published prefix,
and appends only the missing suffix. Selected-store reconciliation requires exact per-subject
lineage, while stale-backup replay may add the missing committed tombstones for subjects introduced
after the backup. One fresh review found that grouping deletion rows by event kind could ignore a
second conflicting deletion event for one subject; the fix requires exactly one deletion lineage
row across deletion event kinds and adds a discriminating test.

Two fresh exact-diff reviews reran the original 69-test replay/read/restore seam. One found and the
candidate fixed deletion-event-kind grouping that could otherwise ignore a conflicting row for the
same subject; neither found another realistic CRITICAL/HIGH blocker at that head. A delayed PR #184
connector review then found a second direct ambiguity: the set-based applied-lineage query selected
rows through the revoked scope, so a conflicting scope-unbound row for the same non-scope identity
could be hidden when its cause named another scope or was null. Fix head
`7533865d6052c6727a481468c3dd20be2a2e7e4c` now joins bounded 400-identity batches against the indexed
subject kind/ID prefix and evaluates every deletion row for each replay subject. A discriminating
fixture inserts the formerly hidden row and proves refusal.

The exact fix content passes `npm run check`: lint, context verification, 82 test files with 1,402
tests passed and 10 declared skips, TypeScript/Vite build, and credential scanning over 13 outputs.
The focused replay/read/restore seam passes 70 tests and range whitespace is clean. A fresh bounded
fix review confirmed that 400 identities use 800 bind parameters, every deletion row for those
identities is accumulated, and duplicate or mismatched operation/week/cause/kind/capability state
fails closed; it found no realistic CRITICAL/HIGH regression. Invented-fixture proof publishes a
100,002-subject intent as 25 bounded records before SQL in about 19 seconds, and the full
delete/replay journey passes across the production 4,096-subject boundary with 4,098 subjects.

Issue #183 separately records that the existing SQL tombstone deletion for the 100,002-subject
fixture remained CPU-active beyond a ten-minute bound. No failure, data exposure, or publication
rollback was observed, but timely 100k SQL deletion is **not** claimed. The complete production
boundary journey, not the 100k SQL tail, is the current executable proof. The mandatory chunk fields
also change the pre-activation event shape while retaining the v1 family name, so older invented v1
bytes fail closed. That is accepted only while activation remains `never_authorized` and no real
store exists; #168 still owns explicit marker/version evolution and stranded-preflight recovery
before activation.

Hosted exact-head Actions/POSIX proof remains NOT verified during the declared Actions incident.
Native hostile same-user pathname/ABA and coordinated rollback remain #142. No real source/store,
legacy path, private/generated data, credential, connector, production caller, or external-model
request was inspected or activated. After #184, the next bounded slice is #173 expiry cleanup,
already implemented in isolated commit `111881c`; #174/#80 remain the subsequent Phase E bridge.

## 2026-08-06 — durable seven-day migration expiry candidate (#173 / PR #185)

PR #184 merged as `a53b46772ebf257fa495c074e225100ca753a35a` at 2026-08-06T22:40:55Z
and closed #180. Its original #179 defect thread and its own applied-lineage thread were replied to
with exact fix/proof evidence and resolved; the immediate post-merge sweep found no later thread.
Hosted checks remained absent while GitHub Status continued to report an Actions major outage with
webhook triggers throttled, so the documented owner-directed pre-release exception is explicit and
is not represented as a green hosted gate. #183 separately retains the 100k SQL-throughput result.

The #173 implementation rebased cleanly onto that merge as code commit
`f623ba941aeb49c8fc6e1a8529ec1005ead7dfb3`. Schema 3.2.5 adds a monotonic cleanup singleton and an
immutable fixed file registry. Backup promotion transfers the exact final SQLite/manifest identity
before discarding its attempt row; pre-selection registration captures the fixed app-owned legacy
base and optional WAL/SHM/journal identities. Every present file is bound by confined locator,
content hash, device/inode/link count, selected artifact, task-key fingerprint, and exact root;
expected-absent sidecars/provisionals are recorded explicitly. Selection refuses until this registry
is complete, and verified restore reconstructs the same ready registry from the immutable external
backup proof rather than caller-supplied paths.

The production cleanup input contains only `{ directory, installationKey }`; its clock is owned by
the runtime. One millisecond before the exact committed grace deadline it is read-only. At or after
the deadline it re-verifies selected-store/root/key continuity, the immutable selection proof and
receipt, complete deletion maintenance, the full keyed replay family, and exact application of every
revocation under the single writer lease. Unsupported exact-root directory sync refuses in preflight
before the first unlink. The `ready -> legacy_deleting -> legacy_durable -> backup_deleting ->
complete` state machine records intent, unlinks only registered identities in reviewed sidecar/base
order, synchronizes the containing directory after each family, then finalizes the backup catalogue.
Every phase is restartable; absent already-unlinked registered files converge, while a replacement,
foreign link, unexpected file, wrong binding, incomplete maintenance, or invalid replay refuses.

The selection marker/receipt and complete content-free revocation anchor/events/head remain byte
exact through cleanup. The stale migration backup remains protected from ordinary scope deletion
until this grace cleanup owns it. Restore rebuilds the registry and reapplies replay before service.
Fix commit `6eb93f56462f53970b4dbcb51b98ba5e69fd9a17` adds the integrated chunk discriminator: a two-record
committed replay family loses record one while its durable head remains, cleanup refuses with phase
still `ready`, and every legacy/backup file remains present. This complements anchor-only,
missing-head, malformed-head, replaced-name, link, directory-sync, per-stage crash, repeated-cleanup,
selection-refusal, restore, and marker-preservation fixtures.

The exact integrated head passes `npm run check`: lint, context verification, 83 test files with
1,432 tests passed and 10 declared skips, TypeScript/Vite build, and credential scanning over 13
outputs. The cleanup/replay/read/restore seam passes 100 tests; cleanup alone passes 29; range
whitespace is clean. A fresh exact-code adversarial review reran six cleanup/selection/restore/replay/
catalogue/schema files with 167 passed and three declared skips, verified the irreversible ordering
and fixed-identity boundary, and found no realistic CRITICAL/HIGH defect. Invented temporary fixtures
only were used. No real source/store, private or generated operational data, credential, connector,
activation caller, scheduler, or external-model request was inspected or activated.

NOT verified: hosted Linux/POSIX directory-sync proof during the declared Actions incident. Windows
production intentionally refuses before the first unlink with the current primitive. Hostile
same-user pathname ABA remains #142. This slice preserves C1/C2 integrity files and does not implement
their terminal expiry; before future C2 receipt/proof removal, a durable committed-family
discriminator must refuse rather than recreate anchor-only/truncated C1 replay state. #168 still
owns pre-activation marker versioning/stranded preflight/hosted proof. After #173 is reviewed and
merged, the exact next product slice is the Phase E stored-observation bridge #174/#80.

## 2026-08-06 — ResearchPack v1 C0 producer contract

The product-owned additive producer seam lives in `shared/researchPack.ts` and
`scripts/generateResearchPack.ts`; it is intentionally separate from AnalysisPack 1.0/2.0. The
deterministic generator writes only `research-contracts/research-pack/v1/schema.json` and
`invented.fixture.json`, and `npm run check:research-pack` detects byte drift. The fixture is
invented C0 with all seven relation slots explicitly `intentionally_omitted`, path-free relation
artifact metadata, opaque bundle-local IDs, fixed synthetic provenance, and no private or Git
reads. The sibling lab sync path is `dllab contracts sync --from <checkout> --ref <40-hex-commit>`;
the generated files are the only producer boundary it may copy. Focused contract tests cover
round-trip, strict rejection, feature/person-scoring prohibitions, deterministic bytes, and the
fixture was validated by the lab's Pydantic consumer. No AnalysisPack or runtime source activation
was changed.

Late exact-head Codex review of PR #178 exposed five blocking contract defects. Commit
`9aeb60973d80e9c65d5ebe9b4f352a9663957f4e` closes them: feature identifiers now use the canonical
person-subject vocabulary and token-aware case folding across dot, underscore, and hyphen
separators; interpretation codes are a closed vocabulary and require `NOT_PERSON_MEASURE`; C1
`generated_at` is the UTC Monday ISO-week floor; and `.gitattributes` pins the two generated JSON
artifacts to LF. The standalone schema carries the closed enum, required-code `contains`, and C1
midnight conditional while typed consumers enforce the Monday rule. The exact code head passed
`npm run check`: 83 test files, 1,396 tests passed and 10 declared skips, plus lint, context,
generator drift, TypeScript/Vite build, credential scanning, and whitespace proof. The generated
schema SHA-256 is `dbeb7c88434dc0849567d3f756304ee25b9f4f0d4b7f985ca16232675bb788b0`.
Five non-blocking semantic refinements were consolidated in #182; broader standalone-schema/runtime
parity remains #181. Hosted proof remains absent during the declared GitHub Actions incident and is
not represented as green.

## 2026-08-07 — ResearchPack main refresh and identifier closure

The PR #178 branch merged current `origin/main` `095164896ed40ac0f2d0c521ad68d672e21e9987` through merge commit
`5f8ada64b01e7ccfbad8721277efa2983262aede`. The ledger conflict kept the merged #179/#184/#185
history and then retained this ResearchPack record; `CURRENT_STATE.md` now describes #184/#185 as
merged and the owner-directed Method Trial as the active synthetic value slice.

Code commit `47987f6521e95b257730eedf8e3d9d3aba81d317` closes the remaining demo-blocking identifier
bypasses without absorbing #181/#182. Runtime validation and the generated standalone schema reject
the shared prohibited construct vocabulary, plural person roles, lower-camel/acronym joins, and
bounded uppercase concatenations such as `DEVELOPERS`, `developerURL`, `AUTHORURL`, `ENGINEERURL`,
`TEAM_MEMBERURL`, `USER_LOGINURL`, `HEALTHURL`, and `ENGAGEMENTURL`. Explicit near-miss canaries keep
`authorization`, `inactivity`, `integrating`, `engineering`, `authority`, and `authoritative`
available. The generated schema SHA-256 is
`50f885d3901aac714b9b5599c6ff4a719a626ac4bcee600f523c0cc5758414d1`; the regenerated invented
fixture SHA-256 is `6a9af8471a847cc14434763e873d6ef86063251caba5deae4e5ae54f2973e9f1` and changes only its embedded
contract digest.

Focused ResearchPack proof passed 8 tests and the generator drift check. The final code tree passed
`npm run check`: lint, context verification, ResearchPack drift, 84 test files with 1,440 tests
passed and 10 declared skips, TypeScript/Vite build, and credential scanning over 13 outputs.
`npm run build:showcase` regenerated and verified the C0 dashboard, social card, export boundaries,
credential canaries, and local-path canaries. One bounded fresh review found an acronym-suffix gap;
the single repair round added the compact base/suffix boundary, and the final re-review found no
remaining realistic CRITICAL/HIGH defect. Hosted `Prove the pull request` remains pending after the
next push and is not represented as green; no current repository authority extends an outage
exception to PR #178.

The first refreshed hosted run, `31138305001`, checked out the exact PR merge ref for ResearchPack
head `5a498f02c81c92fd9db800b373a55acc8848994f` and exposed two inherited Linux storage failures rather
than a ResearchPack regression. The same failures were present on PRs #184/#185 and current main:
the selection-proof test created a simulated protected temp with the default POSIX mode instead of
`0600`, and restore publication released its original temp descriptor before link validation, which
let ext4 recycle the same device/inode for an unlink/recreate replacement. The deliberately isolated
prerequisite PR #186 retained that descriptor through link validation and corrected the test fixture.
Its commit `0a69d374eaff97d6408fe8f5ac3cf52bb0b84a69` passed the two exact tests 33/33 on Windows and on an
Ubuntu/ext4 checkout, passed the full local gate (83 files, 1,432 passed, 10 skipped), received a fresh
review with no CRITICAL/HIGH finding, and passed hosted run `31139652039`. It merged with commit
preservation as `f576fc4c234426e3ba737e4a7bd888ce0fd8f624`.

PR #178 then merged that repaired `origin/main` through merge commit
`7fb568c088b89ed11c72afe1115fcfbf92bbd75b`; the merge touched only the two already-proven storage
files and had no ResearchPack or state conflict. Exact refreshed ResearchPack proof and the required
hosted result remain owed after the final state push; no exception is claimed.

## 2026-08-07 — WB-C1 Method Trial product vertical (PR #187)

ResearchPack PR #178 ultimately merged at authoritative product main
`be9c2451e983e776850c4cd4700cc8c234ea5e14` after hosted run `31140838615` passed. The additive
product-owned `DeveloperLensMethodTrialView.v1` contract is fixed at commit
`3ac919f6129374acae564883ef9196c1d4aaf54c`. Its generated Draft 2020-12 schema is
`research-contracts/method-trial-view/v1/schema.json`, SHA-256
`86cf53a48660967c07329f02be01c05d773c16ac96c28ddcd8110aed3b827fdc`. It is a strict,
path-free C0 presentation projection, not a ResearchPack, generic research dashboard, stored-
observation export, product EvaluationBundle parser, or production evaluation result.

Developer Lens Lab PR #3 was merged concurrently at `0435c2f24af9359429a4e9dee8f744cd4d8049c1`
before the presentation exporter existed. That external ordering cannot be rewritten and is not
represented as an exporter merge. The bounded recovery preserves product ownership: PR #187 lands
the canonical consumer first, then one lab follow-up PR will add the exporter against the already-
merged WB-C1 vertical. Draft product PR #188 contains the same contract plus one two-line test-
threshold alignment; that alignment is preserved in PR #187 and #188 is superseded rather than
becoming a second product slice.

The lab exporter code is commit `5c0a8814bc3df94383d6b947898952a273c6c449`. From that exact code,
the fresh deterministic run `wbc1_method_trial_v1_exhibit` completed benchmark, reproduction,
report, export, and producer-schema validation. The exact exported bytes were copied without hand
editing to `research-contracts/method-trial-view/v1/wbc1.fixture.json`; both source and committed
file have SHA-256 `8a3f07f40b082b10632fc1fd777d5e020768156af7b67b4914a84d94769a55dd`.
The fixture names that lab commit and run, product contract commit `3ac919f`, ResearchPack product
commit `be9c2451`, EvaluationBundle digest
`sha256:5534294e303c9d622e264ebeabeef86a8fde14e9b4080c2a212b0bb3d825244e`, custody digest
`sha256:d5d33f19d437dfa47eff26cfe961d07cad241bce563b454aac5cdc2b0163a1f4`, ResearchPack digest
`sha256:bd96e45eed454b0ed42f37fa0c518f3b2883816aab876bd6e2e5718c9e24fb90`, and report digest
`sha256:aec5261e0b6764d8ddfb8f137980ab107a0222fec4e91343c74395af92782202`.

The committed C0 projection records 54 systems, 5,616 weekly opportunities, 5,346 observations,
270 explicit absences, and exactly three deterministic 104-week final-holdout windows: no-change,
planted level change, and parser-shift instrumentation confound. The corrected confound narrative
names the parser shift and never substitutes permission loss. The baseline records
`2.966666666666667` false alerts/year and `0.75` detection; the candidate records `4.2`, `0.75`, and
Brier `0.017341137335170863`. Both threshold selections are nonviable. Seven ordered gates retain
measured/unavailable/not-applicable distinctions, the candidate is rejected, and the complete
deterministic rolling-median/MAD baseline remains the fallback. PELT is only offline descriptive;
the three windows are fixed selections, not manually selected anecdotes.

The product route lazy-loads only for `?view=method-trial`, imports and runtime-validates the
committed fixture without a fetch, and leaves Dashboard, Wrapped, V2, Coverage Cockpit, Atlas, and
the default bundle path intact. A visible entry in the existing Evidence surfaces navigation reads
“Method Trial — why the more complex detector was rejected.” Desktop and 390-pixel browser checks
confirmed the rejection hierarchy, disclosure, three timelines, distinct square/diamond alert
markers, no stale permission-loss narrative, and no horizontal overflow. The collapsed
reproducibility disclosure expands to the exact run, commits, digests, commands, and statuses.

Exact local product proof after the final logic/fixture commits passed: the focused runtime,
standalone-schema, route, and fallback seam passed 15 tests; `npm run check:method-trial-view`,
TypeScript, lint, and whitespace checks passed; `npm run check` passed lint, context, both generator
drift checks, 86 test files with 1,451 passed and 10 declared skips, TypeScript/Vite build, and
credential scanning across 19 outputs. `npm run build:showcase` regenerated and verified synthetic
dashboard data, the social card, summary/full export boundaries, credential/local-path canaries,
and the Pages build. Vite retained the pre-existing large-main-chunk and browser-externalized
`node:crypto` warnings; the Method Trial itself remains a separate lazy chunk (about 194 kB, 23.7
kB gzip). One substantial fresh-context Terra review at product head `89d55b1` inspected route
reachability and preservation, story fidelity, responsive/non-color-only timelines, strict C0
boundaries, provenance, and the cross-repository ordering record. It reran the 15 focused tests,
the MethodTrial drift check, and range whitespace proof and found no realistic CRITICAL/HIGH merge
blocker or non-blocking finding. The hosted exact-head result is recorded by the publication
closeout after it exists; it is not inferred here.

No real/private input, `.developer-lens` state, private generated output, local path, credential,
provider/person identifier, source activation, external-model request, or production effect was
inspected, committed, or invoked. The evidence establishes only deterministic mechanics on invented
C0 data. #174/#80, #183, LIFE-03 hardening, real-source activation, and broader #181/#182 refinements
remain outside this bounded programme.

## 2026-08-07 — WB-C1 Method Trial exact-evidence repair

The exact-head connector review of product PR #187 found two realistic blocking contract defects:
the reproducibility command allowlist admitted inline credential-bearing variants, and the seven
displayed acceptance-gate outcomes were accepted as producer prose rather than derived from the
scorecard. Contract commit `b0c6c24ab487534b7853b59effd3bd50ec072382` closes both. Commands now
match the exact run identifier and reject extra flags or inline passwords; measurement domains are
nonnegative while signed observed signals remain separate; and runtime validation derives all seven
WB-C1 outcomes and their relevant values from the scorecard and threshold selections. The generated
schema SHA-256 is `a93616a0c6de82b0846fcd1346182d8aa77fa54a31a8413c623428375c5cf8f2`.
The remaining parity and accessible missing-state improvements are non-blocking for this fixed,
committed C0 fixture and are tracked together in #189 rather than expanding the vertical.

Developer Lens Lab repair head `307d1ad592791f57e25fd84b3d44b07600be20cf` synchronized that exact
product contract and made the exporter evidence-derived and smoke-only. A fresh deterministic
benchmark/reproduce/report/export run `wbc1_method_trial_v1_exhibit_v2` produced the committed bytes
without hand editing. The source export and product fixture both have SHA-256
`f2dadf79938b1a36248b7b5e0c69c25cc695d88711a351bba861c1deca5b6fda`. Its EvaluationBundle,
custody, ResearchPack, and report digests are respectively
`sha256:6817268480f4d313969080d5f78149d2c740d0dbaf94594cb3a5a5f69f306dad`,
`sha256:7da2400ec64e73f47a8fbcdc91ea03b566d364b1096b22654e93ad29a8723668`,
`sha256:bd96e45eed454b0ed42f37fa0c518f3b2883816aab876bd6e2e5718c9e24fb90`, and
`sha256:dec6764d75cf36e917b96e619ee921a48a121bfd929709097966fdfcd82b0d1b`.

The repaired projection still records the same honest rejection: baseline/candidate false alerts
`2.966666666666667`/`4.2`, detection `0.75`/`0.75`, median delay `2`/`1`, coverage-confound false-alert
rate `0.5`/`0.5`, candidate Brier `0.017341137335170863`, and frozen thresholds `2.5`/`0.05`.
The seven derived gate outcomes are fail, fail, pass, pass, fail, pass, pass; both selections are
nonviable and the deterministic baseline remains the fallback. The lab's final full local gate
passed 41 tests with one declared symlink skip plus Ruff, Pyright, contract, and whitespace checks.
On the product side, the repaired fixture/runtime/route seam passed 18 focused tests and the
MethodTrial generator drift check. Exact final full product and hosted proof are recorded by the
publication closeout after they exist and are not inferred here.

The integrated product code head `2da4c2cdff4b1d2711a30565df479631fd941070` also preserves remote
fixture-refresh commit `21e070b2dec881a16b13ba9d8e3543c6e3ae9f3d` and its useful byte,
privacy-key, dataset, decision, selector, and case-boundary assertions while retaining the reviewed
`f2dadf79...` exporter bytes. `npm run check` passed lint, context validation, both generator drift
checks, 86 test files with 1,454 passed and 10 declared skips, TypeScript/Vite build, and credential
scanning across 19 outputs. `npm run build:showcase` regenerated and verified the invented dashboard,
social card, summary/full export boundaries, credential/local-path canaries, and Pages build. The
Method Trial remains a separate lazy chunk (about 196.6 kB, 24.1 kB gzip); the pre-existing
browser-externalized `node:crypto` and large-main-chunk warnings remain.

The prior remote head `21e070b` failed hosted run `31147334095` only in the unchanged
`v3Backup.test.ts` replacement-inode collision fixture; all 1,458 other tests passed. The same
storage code passed on the preceding PR head and authoritative main, and the final integrated local
gate also passed it. That is evidence of an intermittent inherited test failure, not permission to
dismiss it or change the out-of-scope storage seam. The final pushed head still requires a fresh
hosted result. The docs-only publication closeout after this code proof is covered by context and
whitespace verification rather than represented as a second full code gate.

## 2026-08-07 — WB-C1 Method Trial final contract reconciliation

Product contract commit `b48fea579936671397a0486ae7a0342197ee6e4b` closes the remaining public
prose boundary: every narrative field now accepts only product-owned copy, and runtime Zod plus
standalone AJV reject adversarial identity/review prose across all narrative shapes. Lab commit
`5c79236beb0a0b25819f14510b79bb15813d7337` synchronizes that schema, records producer provenance
per run, confines check-only reads, verifies same-byte later commits without rewriting source
provenance, and materializes reports through the confined artifact writer.

A new clean-worktree `wbc1_demo` benchmark/reproduce/export/report flow produced the exact tracked
fixture without hand editing. Source and product bytes are identical at 167,935 bytes with SHA-256
`26c3a9184adfce4ff5756e702b36d6db7af7c5f2dab9eb3eb3081ca598eafd95`. The schema,
EvaluationBundle, custody, ResearchPack, Markdown, and HTML SHA-256 values are respectively
`634b0cc7a0c3dbcefe8b9cf258e157695beae06d08cc9d02bb781a4267f633ef`,
`cbd9415bf9e26683656259bcef5a402b1745570c2a31e5c44dbfee74cfaea75f`,
`036f62f5f9ade272eba907513e7ab0bbef4a888bb1d86f8ae6e401aebd5c8238`,
`bd96e45eed454b0ed42f37fa0c518f3b2883816aab876bd6e2e5718c9e24fb90`,
`8144410775717d8b280a41b95c18dd22a8de45c765186ecaeb1fd5c6745e30f0`, and
`fca7aac3e567f6de84b6dd60f476e77bf2a18f7a20cefde4563856e6ada99eec`.
The scientific result and no-promotion boundary are unchanged. Exact-head hosted gates and merge
state are recorded only after they complete.

### Structural-schema boundary and semantic acceptance closure

The final repair review proved that Draft 2020-12 accepted relationally false artifacts which the
product runtime rejected: mismatched run commands, gate outcomes/relevant values, decision reasons,
threshold viability, and timeline index/marker coherence. Product commit
`5c2cff834b2763aa5646a99c20f61abcba6943b4` makes the boundary explicit in the generated schema's
standard `$comment`, the contract README, the root README, and the showcase runbook. The standalone
schema is structural transport validation only; `MethodTrialViewSchema` is the normative product
semantic validator before acceptance or display. Regression tests deliberately demonstrate the
distinction across eight relational mutations. The product route already runtime-parses its fixture
before display, so there is no AJV-only product exposure.

The lab synchronized that exact contract and schema SHA-256
`f1511ca6f4bca7d770bf0e646825792b27144249ff86fcbccdee5fb24a75cbbe`, then added an equivalent
semantic validator in lab commit `aa21dbd68ec9cd759240f551948a8bdeb59df9aa`. Export now fails closed
after structural validation unless command/run binding, threshold viability, gate derivation and
mirrored evidence, decision reasons, timeline sequence, missing-state behavior, and case-role marker
coherence all hold. The contract sync also refuses a product schema that omits the structural-only
annotation. Focused lab proof passed seven tests with one declared Windows symlink skip, plus Ruff,
strict Pyright, and whitespace checks.

From that exact clean lab commit, fresh run `wbc1_method_trial_v1_exhibit_v3` completed benchmark,
reproduction, report, and semantic export. The generated source and mechanically copied product
fixture have SHA-256 `b5953543ca9ad8726c5fca0a0c808e2d874a713e8098c0dc440f9a4ab27fb29c`.
The EvaluationBundle and custody digests are
`sha256:181b08c280795222d7ef7b5f3a7272d2f397be6f3a59987913d4499e6045c6b4` and
`sha256:cc8e828efedc87e62cf9b3f45bee5f3118ff105ab93c6159996e1d1d2185a610`; the ResearchPack digest
remains `sha256:bd96e45eed454b0ed42f37fa0c518f3b2883816aab876bd6e2e5718c9e24fb90`.
The report digests are Markdown
`sha256:4c99d1df51e706e9044cbed8ad0382ffb726a97b4d2183e941ec47401e78826b` and HTML
`sha256:0f1b913a06a0ef37b7e6d6bb249c9d8b7608a8c3e154240cf3953e08b38e39aa`.
The result remains unchanged and honest: false alerts `2.966666666666667`/`4.2`, detection
`0.75`/`0.75`, delay `2`/`1`, confound rate `0.5`/`0.5`, candidate Brier
`0.017341137335170863`, thresholds `2.5`/`0.05`, and gates fail, fail, pass, pass, fail, pass, pass.
The repaired product fixture/runtime/route seam passes 19 focused tests. On exact code/evidence head
`bb92df0454fe9c5e46961074c455c6973bc4f04d`, `npm run check` passed lint, context, both generator
drift checks, 86 test files with 1,455 passed and 10 declared skips, TypeScript/Vite build, and the
credential scan across 19 outputs. `npm run build:showcase` passed the invented export, social-card,
boundary, path/credential, and Pages-build checks. Hosted proof remains pending and is not inferred.

## 2026-08-07 — Post-merge integrated-producer evidence correction

Product PR #187 merged as `7b22491b28acbe467e2facb85723a91fd37af52b`, preserving the product-owned
contract and lazy offline route. Its fixture came from semantic-only lab precursor `5c79236` and
claimed `verification.local: passed` before the later reproduction command could occur. The
scientific story was correct, but that provenance field was not.

Integrated lab producer `0ef193070a9b80b81cef5a1710a1d65e0b271c15` contains both semantic
acceptance and atomic final-path export with honest `local: not_run`. A fresh detached
benchmark/reproduce/export/report flow produced the mechanically copied product fixture: 167,936
bytes, SHA-256 `afcc1ed9535d9b22fb399375027792489ce6b97949f8f684682943c11152b5f9`.
EvaluationBundle, custody, ResearchPack, Markdown, and HTML digests are respectively
`sha256:e925c8ac44d914ce0003ef218d90187535eedfef3eb8d436a3c9a135e3d1a3a9`,
`sha256:036f62f5f9ade272eba907513e7ab0bbef4a888bb1d86f8ae6e401aebd5c8238`,
`sha256:bd96e45eed454b0ed42f37fa0c518f3b2883816aab876bd6e2e5718c9e24fb90`,
`sha256:f9173354e86b20ccabe91334136017ff03ae68b3ba4432666f6af72172fb11b8`, and
`sha256:22ca8c03e78c6185e527fa4c0f7312caf7d9077619d46f795f8d8dd25c530a29`.
The seven gates, rejection reasons, metrics, three 104-point cases, no-alias/no-seed boundary, and
deterministic fallback are byte-for-byte unchanged. This correction must pass its own product gate
and merge before lab PR #8; neither result is inferred by this entry.

## 2026-08-07 — Dual-runtime Claude harness

- PR #191 merged with merge commit `dcf5897b` after two bounded review rounds (one independent
  fresh-context adversarial pass, two Codex rounds triaged). `CLAUDE.md` became the shared canon
  (cold start, source-of-truth map, authority boundary, protected-data rule, run/prove table,
  Claude routing); `AGENTS.md` slimmed to a thin Codex adapter with an inline protected-data
  summary and the Luna swarm-routing deltas.
- Claude runtime added: committed `.claude/settings.json` (acceptEdits + protected-path Read
  denies on `.developer-lens/`, `dist/`, `public/data/`), the `developer-lens-continuation`
  skill, and pinned agents `dl-implementer`/`dl-reviewer` (Opus 4.8 high; owner decision recorded
  as HUMAN_TODO q-9) and `dl-mechanic` (Sonnet 4.6 high).
- `verify:context` now requires the Claude files and the three agent-pin files to exist
  (existence only — pin frontmatter is not parsed), enforces CLAUDE.md's 100-line
  budget and exact G4 markers (`gpt-5.6-luna`, `cap.external.model` `never_authorized`), scans
  `.claude/**` links (ignoring `node_modules` and `.claude/worktrees`), and fails on committed
  `bypassPermissions` or a tracked `settings.local.json`.
- Review rounds also fixed both continuation skills to resume and select slices from
  `docs/analyser-program/CURRENT_STATE.md` (the ledger is history, never the task source) and
  retargeted stale AGENTS.md pointers in the Codex skill, CURRENT_STATE `authority_order`,
  `pr-gate.yml`, and README.
- Verified: hosted `Prove the pull request` green at `2f0cc3e` and `b36fbe4`; local
  verify:context, oxlint, validation tests 5/5, `tsc -b`. NOT verified: the aggregate
  `npm run check` was not executed anywhere for these heads — the hosted gate runs its own step
  set, which omits `check:research-pack` and `check:method-trial-view`; `effort:` frontmatter key
  semantics (model pins are the enforced part). No capability, source, or publication boundary changed.

## 2026-08-07 — Hosted PR gate: explicit generated-artifact drift steps (#193)

PR #194 merged as merge commit `24f55d4d3685964dbf5edcf866e38a65d5e251a1` (branch
`claude/pr-gate-drift-checks`, final head `a593e1d`; three commits over `e97f17d..a593e1d` —
`93dc67a`, `e4d6903`, `a593e1d`). `.github/workflows/pr-gate.yml`
now runs `npm run check:research-pack` and `npm run check:method-trial-view` beside the existing
planning-artifact drift guard, so the branch-protection-required `Prove the pull request` job carries
the same explicit generated-artifact drift steps as the local `npm run check` aggregate. Both
`--check` commands are non-mutating and need no secrets, network, or real data. Issue #193 closed as
COMPLETED.

**Rationale correction (from the PR #195 review, verified here).** Issue #193's premise — that the
required job could stay green while a committed ResearchPack or MethodTrialView artifact drifted — was
inaccurate, and so was PR #194's original "strictly stricter / could stay green" wording. The gate
already ran `npm test` (`vitest run`, whose include covers `shared/**/*.test.ts`), and two
unconditional tests already failed closed on that drift: `shared/researchPack.test.ts` compares
`renderResearchPackFiles()` byte-for-byte against the committed schema and fixture, and
`shared/methodTrialView.test.ts` compares `renderMethodTrialViewSchema()` against the committed schema
and pins the committed fixture by SHA-256. The two new steps therefore add explicitness, earlier and
dedicated failure attribution, step-list parity with local `npm run check`, and defense-in-depth were
a drift test ever removed — but they do not close a previously-open hole. The change is benign and was
left merged; only the rationale is corrected.

The same slice reconciled `docs/analyser-program/CURRENT_STATE.md`, which still described the merged
PR #190 evidence correction as *in review* and pointed a resuming agent at the merged branch
`codex/method-trial-final-evidence`. It now records the WB-C1 Method Trial demo as product-side
complete (#187 `7b22491`, #190 `8de65a2`), the dual-runtime harness milestone as merged (#191
`dcf5897`, #192 `e97f17d`), and the cross-repo lab PR #8 close-out as the next value slice.

- Verified: hosted `Prove the pull request` green at both #194 heads — `e4d6903` (2m42s) and final
  `a593e1d` (2m47s); the two new steps confirmed `completed/success` in the run-31202386995 job step
  list (executed, not skipped). Local at base: `check:research-pack` and `check:method-trial-view`
  exit 0 (no drift), `verify:context` passed (32 md / 18 required), `git diff --check` clean,
  `pr-gate.yml` parses as valid YAML (11 steps). The pre-existing `shared/*` drift coverage was
  confirmed by reading both test files (unconditional `it()`s comparing render output to the committed
  bytes).
- Review: one fresh-context `dl-reviewer` adversarial pass on #194, no merge-blocking findings. Codex
  P2s: on #194 the reconciled `blockers` checklist understated the binding review-timing gate (fixed
  in `a593e1d`); #194 then merged on its pre-merge gates — CI green at `a593e1d`, the aging floor, and
  the 15-minute post-push window with a fresh pre-merge sweep showing no new review — and was followed
  by a clean post-merge sweep. On #195 the rationale overstatement above, plus the commit count and
  this same pre-merge/post-merge sweep distinction, were flagged by Codex and corrected in this entry.
- NOT verified: the aggregate `npm run check` was not run end-to-end for these heads (the hosted gate
  runs its own step set). No capability, source, or publication boundary changed;
  `cap.external.model` and registry/API capabilities remain `never_authorized`. Read-only,
  synthetic-only.

## 2026-08-07 — MethodTrialView accessible-missing-state rendering (#189 subset) + WB-C1 programme close-out

Branch `claude/method-trial-view-a11y-189` off `main` `e6ef6a6`. Rendering-layer hardening of the
Method Trial view (`src/components/MethodTrialRoute.tsx` + its test only); the shared validator
`shared/methodTrialView.ts` and the committed C0 fixture are untouched, so product↔lab validator
parity is trivially preserved. Three behaviors from the exact-head #189 review of PR #187:

- **SVG lines never bridge missing evidence.** The baseline and candidate series now render as maximal
  runs of consecutive `measured` positions (one `<polyline>` per run, split at any missing/unavailable
  point) instead of one polyline over all measured points, which silently connected a gap's neighbors.
- **The timeline text alternative retains every distinct transition and every offline PELT boundary**,
  collapsing only persistent-continuation notable weeks into the trailing summary count, replacing the
  blind `.slice(0, 8)` truncation that could bury later distinct events behind an early persistent run.
- **Headline and decision prose are derived from both measurements.** The detection phrase only says
  "Equal detection" when both rates are measured and equal (neutral factual copy when unequal,
  comparison-neutral when either is unavailable); the false-alert phrase is sign-aware and goes neutral
  when either value is unavailable; the decision section no longer prints a fabricated additional-alerts
  number when that measurement is unavailable, and its detection-gain clause is likewise derived from
  both detection rates (a candidate gain / lower detection / no gain, or "not directly comparable" when
  either is unavailable) instead of hardcoding "no detection gain" — a coherence gap the Codex round
  caught. A `Number.isFinite` guard also closes a latent divide-by-zero when baseline false-alerts are
  zero.

The committed C0 fixture (0 missing observations, ≤3 isolated notable points per case, both detection
rates measured and equal at 0.75) renders identically in every visible and textual respect — one
continuous segment per series, the same notable-states list, and the same headline and decision copy;
the only DOM delta is the added `data-testid` attributes on the timeline polylines (so the markup is
not byte-identical, but the rendered content is). Six new tests construct schema-valid variants
(deep-clone → mutate → `MethodTrialViewSchema.parse`) that exercise interior gaps, a long persistent
missing run with later distinct/PELT events, unequal-but-measured detection, and an unavailable
false-alert measurement.

**WB-C1 programme close-out.** The resume artifact's stale `next_value_slice` — "finish and merge lab
PR #8" — was corrected: lab PR #8 merged 2026-08-07T06:04Z (the lab has since advanced through PR #16),
and the product/lab pair was demonstrated green this session — product `check:method-trial-view` +
`check:research-pack` + `test:demo:v2`, and lab `pytest` over
contract-sync/method-trial-export/methods/report (25 passed, 2 host-symlink skips). The bounded WB-C1
programme is therefore complete on both sides; the remaining #189 bullets (future-v2 wire dedup,
closed-copy canary), the validator-parity subset, #181/#182, and lab #6/#7 are tracked post-programme
debt, none dependency-forced.

- Verified: full `npm run check` green at branch head — 1462 tests pass / 10 skipped, `tsc -b` + `vite
  build` + `verify:no-secrets` (19 files, no credential patterns); focused `MethodTrialRoute.test.tsx`
  7/7 and `test:demo:v2` 9/9 on independent coordinator re-run; `verify:context` green; `git diff
  --check` clean. Review: one fresh-context `dl-reviewer` adversarial pass — no CRITICAL/HIGH/MEDIUM
  findings; its two non-blocking observations (a degenerate 1-point polyline still renders its dot; the
  inherited "…in the validated fixture" string) warranted no change. The exact-head Codex connector
  (commit `dad2c0e`, review 21:07Z) returned five findings, all triaged and fixed in one round: the
  decision-paragraph detection-gain coherence gap (P2, code, above); the byte-identical overclaim (P2,
  corrected above); and three resume-artifact fixes on CURRENT_STATE — internal active-slice
  consistency, a recommended next bounded slice, and removing a reference to a `cross-repo-contract`
  skill that is not committed in this repo.
- Re-proved on the fix head `d805b8d`: full `npm run check` green (1462 tests pass / 10 skipped,
  `tsc -b` + `vite build` + `verify:no-secrets`), focused `MethodTrialRoute.test.tsx` 7/7,
  `verify:context` green, `git diff --check` clean, plus a scoped fresh-context `dl-reviewer` pass on
  the incremental fix diff (no CRITICAL/HIGH/MEDIUM; one LOW — the resume artifact's post-merge voice,
  accepted as the deliberate resolution of the internal-consistency finding). The exact-head Codex
  round on `d805b8d` (review 21:37Z) returned three P2s, all triaged under the two-round ceiling: the
  ledger post-fix-proof gap (fixed by this paragraph), plus two tracked, non-blocking follow-ups that
  affect only constructed schema-valid variants (the committed C0 fixture triggers neither) — (i) the
  timeline text alternative marks each missing/marked run's onset and a collapsed count but not where
  the run ends/resumes (folded into the #189 accessible-rendering follow-up), and (ii) an unavailable
  candidate false-alert measurement makes the neutralized headline/emphasis disagree with the fixed
  `publicCopy` gate reason / `decision.why_simple_baseline_won` / supported claim, whose real fix is the
  deferred #189 validator-parity subset because rendering must not override validated schema data. PR
  #196 merged as merge commit `63354ef` at 2026-08-07T21:44Z; both the immediate and the delayed
  post-merge sweeps were clean — rechecked at 22:02Z (~18 min after merge, beyond the measured 3–10 min
  Codex delay) with no late reviews or comments on #196.
- NOT verified: no browser/visual screenshot (the change is proven by segment-count and text
  assertions, not pixels); the hosted `Prove the pull request` result is green at both #196 heads
  (`dad2c0e` and final `d805b8d`, 2m27s) per the checks API. Live Git/CI still outrank. No capability, source, or publication boundary changed; `cap.external.model` and
  registry/API capabilities remain `never_authorized`. Rendering-only, synthetic-only, no fetch path.

## 2026-08-07 — ResearchPack standalone Draft 2020-12 schema parity (#181) + parallel-lanes closeout

PR #198 merged as merge commit `73cb31e` (branch `claude/researchpack-standalone-schema-181`, heads
`c8075f8` then doc-fix `ffa22e4`). Product-repo only: raises the GENERATED standalone Draft 2020-12
ResearchPack schema (`research-contracts/research-pack/v1/schema.json`, produced by
`scripts/generateResearchPack.ts`) toward the authoritative runtime `superRefine` in
`shared/researchPack.ts`, which is UNCHANGED — runtime validation stays the source of truth.

- Demonstrated gap 2 fixed: a present relation's `schema_id` is now pinned to its relation-specific
  `const` (`RELATION_SCHEMA_IDS[relation]`) instead of merely non-null, so a present relation carrying
  a nonexistent or another relation's `schema_id` is rejected by the standalone validator too, exactly
  mirroring the runtime rule. Gap 1 (omitted relation with `row_count:0`) was already covered by the
  non-present const-null rule; a confirming canary was added.
- Gap 3 (reversed temporal window) is genuinely NOT expressible in standard Draft 2020-12 (no
  cross-field comparison keyword; ajv's non-standard `$data` was deliberately avoided for portability).
  It, plus distinct-`artifact.sha256`, `feature_id` uniqueness, the C1 ISO-week Monday-ness / rolling
  36-month cutoff, and (from the Codex round) single-field CALENDAR VALIDITY (a shape-valid but
  impossible instant like `2026-02-30` that `CanonicalUtcSchema`/`canonicalUtcMicros` rejects) are
  documented as runtime-validation-only in a new `research-contracts/research-pack/v1/README.md` and a
  generator comment block. #181 stays open as the schema-parity parent that #182 defers to.
- Four standalone Draft 2020-12 canaries (ajv2020, already a devDependency): the three invalid-case
  canaries assert BOTH the standalone schema and the runtime Zod validator; the fixture-acceptance
  canary asserts the standalone validator (runtime acceptance of the committed fixture is covered by the
  pre-existing round-trip test). Committed `schema.json` regenerated; the only fixture delta is
  `provenance.contract_sha256`.
- Verified: full `npm run check` green (full suite 1466 tests / 10 skipped — 1462 prior + 4 new cases,
  as `shared/researchPack.test.ts` went 12→16 — plus `tsc -b` + `vite build` + `verify:no-secrets`);
  `check:research-pack` no drift; focused `shared/researchPack.test.ts` 16/16. Review: one fresh-context
  `dl-reviewer` pass (no CRITICAL/HIGH/MEDIUM — const faithfulness across all 7 relations, non-tautological
  tests, documentation honesty), plus the exact-head Codex round on `c8075f8` (one P2, the calendar-validity
  doc gap, fixed in `ffa22e4`). Merged via CI-green + 15-min-window (no round-2 review); immediate
  post-merge sweep clean.

**Parallel-lanes session note.** This session ran several bounded lanes concurrently (one writer per
checkout): product #196/#197/#198 merged; lab #7 investigated and dispositioned as tracked CROSS-REPO
debt (its case title/summary/scenario_code are const/enum-pinned by the vendored product
method-trial-view schema, and the fallback path is currently unreachable — two-repo plan posted on lab
#7); lab #6 delivered 4/6 reproducer-backed correctness fixes (findings 6,5,4,2; findings 1 and 3
mapped as they would move a recorded canonical digest) and was PRESERVED as `developer-lens-lab` PR #24
but NOT merged, because a concurrent/zombie writer was observed in the lab checkout (recorded under
HUMAN_TODO q-8). The product repo was verified unaffected. No capability, source, or publication
boundary changed anywhere; `cap.external.model` and registry/API capabilities remain `never_authorized`.

## 2026-08-09 — #214 prompt operating system (control-plane side lane, branch `docs/prompt-system-overhaul`)

**Additions-only record.** A control-plane side lane, not a phase advance: P0.5 #200 stays the
active programme, #174 stays unselected, and no gate, capability, schema, contract, methodology,
owner policy or release/tag state moved. C0 code and docs only.

**Changed.** Every executable prompt now lives behind a stable ID in
`docs/agent-system/PROMPT_LIBRARY.md` — the twelve common IDs `DL-P01-FLAGSHIP-GOVERNOR` through
`DL-P12-FRICTION-BURNDOWN`, shared with `Chris0Jeky/developer-lens-lab`, plus the product extensions
`DL-PX01-PRODUCT-DEEP-DISCOVERY` and `DL-PX02-PRODUCT-ANALYTICAL-VERTICAL`. Two repo-neutral shared
blocks — `runtime-bootstrap-v1` (Claude reads CLAUDE.md and routes through the named `dl-*` agents;
Codex reads AGENTS.md, then the shared CLAUDE.md canon, invokes the continuation skill and follows
Sol/Terra/Luna routing) and `friction-tasking-v1` (the no-silent-workaround rule) — are SHA-256
pinned in the new repo-neutral `.agent-harness/prompt-parity.json`, designed for byte-for-byte lab
reuse. New `docs/agent-system/CONTINUOUS_WORK_PROTOCOL.md` (queue hopping, anti-manufacture
legitimacy test, work-while-waiting, resource-bounded fan-out, four stop conditions, no
data/model/telemetry/credential activation, factual termination) and append-only
`docs/agent-system/FRICTION_LOG.md` (FR-001…FR-009). The three prompt-shaped documents outside the
library are reclassified: `OVERNIGHT_EXECUTION_PROMPT.md` and `SOL_ULTRA_ORCHESTRATOR_PROMPT.md` as
`redirect`, `SOL_ULTRA_DEEP_DISCOVERY_PROMPT.md` as `historical` with sentinel-wrapped bodies; their
bespoke authority/swarm marker checks were removed only where the manifest and classification fully
replace them, and link validation is untouched. Enforcement lives in
`scripts/projectContextValidation.ts` and `scripts/verifyProjectContext.ts`. `governor.yaml` gained
`prompt_system`, `continuous_work` and `friction` surfaces plus two recurring checks, with every
existing authority, model-role and risk value untouched. `docs/agent-system/README.md`,
`MAINTENANCE_PROTOCOL.md` and `CROSS_REPO_CONTRACT.md` document the surface; `CLAUDE.md` and
`AGENTS.md` carry the foundation rules.

**Verified.** Full `npm run check` GREEN end to end (exit 0): `verify:context` (47 Markdown files,
31 required files), `check:research-pack` and `check:method-trial-view` no drift, full suite **1479
passed / 10 skipped across 86 files** (up from 1466 — the 13 new prompt-OS cases), `tsc -b`,
`vite build`, and `verify:no-secrets` across 17 build outputs. Focused
`npm test -- scripts/projectContextValidation.test.ts` = 18/18. `git diff --check` clean. The new
suite was checked for vacuity by mutation: deleting the CRLF normalization in `normalizeSharedText`
fails exactly the line-ending case and nothing else.

**NOT verified.** No PR opened, nothing pushed or merged — the branch is local by instruction. No
browser or visual QA. `npm run build:showcase` was NOT run, because no public, demo or export seam
moved. The lab-side #33 counterpart was neither authored nor inspected here, so byte-for-byte lab
reuse of the shared blocks is a design property proven on the product side only.

**Failures and workarounds.** Two `npm run check` attempts, inside the three-attempt ceiling. The
first failed at `tsc -b` with four TS2339/TS2322 errors in the new test file: Vitest does not
typecheck, so the fixture-builder default `{ id }[]` and the reordered-ID array surfaced only in the
build; annotating `PromptSpec[]` and `string[]` fixed it and the second run was green. Friction
recorded in the same hop: **FR-007** — a delegated `dl-implementer` hit a 15-minute runtime limit
and left a coherent partial diff with no handoff; the workaround was to terminate the surviving
owned process, audit the dirty checkpoint against the repository verifier before touching it,
preserve the sound work as its own commit, and resume with one replacement writer on the same branch
and HEAD. **FR-008** — the runtime refused `.claude/**` writes in this non-interactive session, so
the agent/skill sub-item is PARKED rather than worked around. **FR-009** — `CURRENT_STATE.md`'s
declared `yaml` block does not parse, at `HEAD` as well as in the working tree, because unquoted
` #NNN` issue refs open YAML comments inside flow sequences; observed and logged, not repaired,
because repair is a separate bounded slice.

**Docs-state sync.** `CURRENT_STATE.md` gained a `control_plane_side_lane` entry — single-quoted and
therefore YAML-safe — recording the side-lane framing, the parked sub-item, and that #200 remains
active, #174 remains unselected and every gate is unchanged. This ledger entry is additions-only.

**Residual risk.** The parked sub-item (FR-008) means the four `dl-*` agent definitions and both
continuation-skill copies still lack the explicit no-silent-workaround rule, and the #208 item-3
locked-invariant reviewer lenses are not yet folded into `dl-reviewer`; the rule binds through
`CLAUDE.md`, `AGENTS.md` and every active prompt body in the meantime. Parity between the `.agents/`
and `.claude/` skill copies rests on review alone — `verify:context` compares required files,
frontmatter and markers, never the two bodies, which FR-008 names as the promotion target. The
prompt bodies are prose: the verifier proves structure, IDs, digests, classification and reference
form, never that a pasted prompt produces good work.

**Human actions.** `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-8` remains **OPEN** and continues to
block agent merge of the paired lab PR. It is not inferred closed from any merge, quiet session or
agent message. Explicit isolated preparation on the product side is allowed by the current owner
commission.

**2026-08-09 follow-up (bounded FR-008 fallback).** The exact files changed were `.claude/agents/dl-
scout.md`, `.claude/agents/dl-implementer.md`, `.claude/agents/dl-mechanic.md`,
`.claude/agents/dl-reviewer.md`, `.agents/skills/developer-lens-continuation/SKILL.md`,
`.claude/skills/developer-lens-continuation/SKILL.md`, `scripts/projectContextValidation.ts`,
`scripts/projectContextValidation.test.ts`, `scripts/verifyProjectContext.ts`,
`docs/agent-system/FRICTION_LOG.md`, `docs/analyser-program/CURRENT_STATE.md`, and this ledger.
FR-008 recurred in two 2026-08-09 non-interactive Claude contexts and was promoted here: the four
agent definitions and both skills now carry the same-hop friction/task-link rule, #208 item 3 is
folded into `dl-reviewer`, and the executable validator enforces the identical skill block. FR-008's
runtime write limitation remains documented, not resolved. FR-009 is now tracked at #215. Real
checks for this follow-up: focused test `npm test -- scripts/projectContextValidation.test.ts` passed
22/22; `npm run verify:context` passed (47 Markdown files, 31 required files); `git diff --check`
passed; and full `npm run check` passed (86 files, 1483 passed, 10 skipped; TypeScript/Vite build
and 17-file no-secrets verification green). The first full-check wrapper attempt timed out before
reporting output; the longer second attempt completed green.

## 2026-08-09 — Product q-8 owner-decision closeout

**Changed.** Recorded the owner's explicit 2026-08-09 decisions in `HUMAN_TODO.md` and reconciled
their active/current consequences in `CURRENT_STATE.md`, `CODE_OF_CONDUCT.md`, and the Current
status prose of the cross-repo contract: q-8 is closed; the v0.1.0 release remains joint; q-10(a)
CLA review and every other q-6/q-10 decision are deferred; and confidential CoC reports will use a
separate inbox once the owner supplies or approves its monitored address. The old personal address
was removed from `CODE_OF_CONDUCT.md`; until the dedicated inbox is approved, the document forbids
public sensitive details and supplies only a content-free route for arranging private contact. The
deregistered `value01` directory remains for the owner's manual review/delete, explicitly not a
blocker to the closed process gate. Current prompt-OS state records product PR #218, lab PR #35's
external merge at `bba0c18261c0a2b77332a0408f63b10c774c91f4` at 2026-08-09T04:06:29Z, and the
non-blocking hardening follow-ups product #216/lab #34 without assigning a GitHub operator identity.

**Evidence and decisions.** The owner said `q8 session: CLOSE IT`, confirmed `YES, I MERGED` for
lab PR #24, chose `SEPARATE INBOX` for confidential CoC reports, reaffirmed a JOINT release, deferred
the CLA strategy, and deferred every other q-6/q-10 decision. After that answer, `claude agents
--json --all` showed no active sessions; report-only MCP hygiene showed claude.exe 0, orphan MCP 0,
and Docker MCP containers 0. Product PRs #218/#220 were already merged; this product worktree began
from `main` `2cb35ea7f207314cad43a0a4263c45739e2232ee`. No capability, source, data, contract,
prompt, or release/tag state moved.

**Verified.** `npm run verify:context` and `git diff --check` run for this documentation/state
sync; the exact diff was inspected for the four owned files only.

**Next slice.** Resume product #200's pre-QA documentation batch, then advance Lab #29/#5 under
their normal gates before the joint tag; retain the q-10(c) five-minute aesthetic sign-off as the
other release-tag blocker. Publishing the owner-approved dedicated CoC inbox address remains a
separate owner/release follow-up; the interim Code of Conduct rewrite is complete.

## 2026-08-09 — P0.5 pre-QA release copy and q-8 late-review reconciliation

**Changed.** Completed issue #200's product pre-QA copy batch: the README links the intent-only
commercial option, the public footer names the AGPL-3.0-only source, the Discussions contact warns
that examples must be invented, the public roadmap names the cockpit's invented seed-fixture
requirement, and the contributing guide separates the invented-fixture rule from C0/C1 test labels.
The post-merge review of q-8 PR #223 was reconciled in the same bounded follow-up: the Code of
Conduct supplies a content-free request path without claiming the pending inbox is monitored, the
owner register and prior ledger entry match that interim rewrite, the programme roadmap removes the
closed product q-8 gate, and `CURRENT_STATE.md` keeps unfinished Lab #29/#5 ahead of the joint tag.
No source capability, data contract, fixture, generated artifact, version, tag, or release moved.

**Verified.** Starting from merged `origin/main` `877f1ca07ccee014c0adf50925f989815e6bc7f1`,
`npm test -- src/App.test.tsx` passed 9/9; `npm run verify:context` passed (47 Markdown files, 31
required files); `npm run check` passed (86 test files, 1,487 passed, 10 skipped, TypeScript/Vite
build and 19-file no-secrets verification green); `npm run build:showcase` regenerated and verified
the synthetic public boundary; and `git diff --check` passed. The build retained the existing
browser-externalized `node:crypto` and large-chunk warnings without failing.

**Failures and workarounds.** A separate coordinator advanced PR #223's checkout and branch between
this session's read and attempted fix. The patch failed its context check before writing, no work was
overwritten, and this session relinquished that checkout. PR #223 then merged externally as
`877f1ca` before its exact-head Codex review arrived; the later P2 findings are fixed by this
follow-up. FR-001 records the fourth occurrence and the refresh-and-relinquish response; issue #200
carries the live coordination note. The fresh worktree needed `npm ci` before its local Node tools
were available.

**NOT verified / next slice.** Browser visual QA, hosted CI/review for this branch, the dedicated CoC
inbox address, and the q-10(c) owner aesthetic sign-off remain unverified. Advance Lab #29/#5 under
its normal gates, then run the final browser/visual package and obtain q-10(c) before either
repository is tagged `v0.1.0`.

## 2026-08-09 — Lab dependency remediation closeout (Lab issue #5)

**Changed.** The sibling Lab repository raised pyarrow to 23.0.1 and pytest to 9.1.1 in PR #38,
then merged final head `4ebb1049ddb831dc7ff76f5a0050e52bdf37f40c` as
`f893f576f71202375fe93e8c7d9c02e54fbaf08a`. This product-side ledger entry records the
cross-repository release prerequisite only; it changes no product dependency or capability.

**Verified.** Lab Actions workflow run `31296773324` and its `Prove the lab` job `93203064984`
succeeded on that exact final head. A separate read-only fresh-context review was merge-sound (it
was not a hosted GitHub review object). After merge, the Dependabot API returned zero open alerts,
the post-merge PR sweep found no reviews or comments, and Lab issue #5 closed at 05:46Z with those
facts recorded.

**NOT verified / residual.** The release curator still owes a fresh Dependabot read at the eventual
release head. Lab #29 pre-tag deliverables, both owner aesthetic sign-offs, the joint tag, and every
publication step remain open. No real/private data, generated operational output, external model,
telemetry, credential, release, or tag lane was opened by this reconciliation.

## 2026-08-09 — Joint release-prompt product landing and Lab park

**Changed.** Product PR #227 repaired DL-P09 and the live resume order so the joint tag requires the
distinct product release sign-off at `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c)` and Lab
screenshot/video-package sign-off at
`Chris0Jeky/developer-lens-lab::HUMAN_TODO.md::q-11`. Final head
`b5d8f5867283c08e2cf3251f81e825aea2f498af` merged as
`408a5b8d22be2ab7d54838e3b36aeca807a99792`. The Lab counterpart did not merge: PR #37 was archived
at `4a044dcec134cda313cffb7087389f64d28fe8c9` after exhausting two fix rounds. Coordinator-owned
replacement PR #42 started from Lab main `f893f576f71202375fe93e8c7d9c02e54fbaf08a`, reached final
head `e290d1b94aff9f39de677fd80670f4f9e8f15227`, and merged as
`38ac2eb14c8c9ba742b5f269b7022c7e549b7a5d`.

**Verified.** Product Actions run `31298518409`, job `93207390318`, succeeded on the exact final
head. A fresh exact-final-head review found no causal CRITICAL/HIGH defect, all five connector
threads were resolved, and the delayed post-merge sweep remained clean. Lab run `31297994488`, job
`93206098872`, succeeded on PR #37's exact head, but its fresh final-head review confirmed a HIGH
ambiguity: the wording can let one owner approval satisfy both distinct gates. That thread remains
unresolved; its separate P2 worktree-command finding was tracked and resolved without a third fix
round. Lab PR #42's hosted run `31299725193`, job `93210447311`, succeeded on its exact one-file
head; fresh review found no causal CRITICAL/HIGH defect. Its only connector P2 (future bounded
dependency residual wording) was tracked on Lab #34 and resolved without a fix commit before merge.
A delayed post-merge sweep beyond the connector window found no new comments and no unresolved
thread debt.

**Reconciled live continuation.** Product community/contact PR #226 reached final head
`c716672c99c03013b65ed4e867bf24a95f0ad883`, passed hosted run `31300080534`, job `93211341394`,
and merged as `7bbb8ee6f9124424b3d8362170f0f4d738f5cb43`; its delayed sweep was clean. Lab friction PR #41
merged as `178bd6d695119b74294a8fd6fbe46f54577e49b2`. Its late proof-integrity review debt was repaired
through state PR #39, which reached final head `b36bbadd0365a8958ba741e27c2e36e9458237be` and merged as
`4f355f1e58e1eca1191f899f1fc4354af8a23a00` after hosted run `31300971426`, job `93213564502`.
Licence/package PR #40 then merged as `d203461c023e1661140a1fef38a0f4b68e3454b2`; community PR
#43 merged as `56c889141cd4575d12f80c3e0a16a574277e0ddd`; changelog PR #44 is the current Lab review lane.

**Still NOT verified / blocked.** Lab #29's remaining package-smoke/release-evidence deliverables,
both owner sign-offs, the joint tag, publication, protected/private data, model/data/telemetry
activation, and credentials remain untouched and open as applicable.
