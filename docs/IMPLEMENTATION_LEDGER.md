# Developer Lens implementation ledger

Last updated: **2026-08-05** (DL-LIFE-02 B1b-ii authenticated rewrite)

Architecture: [`docs/DEVELOPER_LENS_V2_ARCHITECTURE.md`](./DEVELOPER_LENS_V2_ARCHITECTURE.md),
evidence/design version 2026-08-03 + Appendix I.1–I.4.

**Fast resume:** agents should read the compact state artifact
[`docs/analyser-program/CURRENT_STATE.md`](./analyser-program/CURRENT_STATE.md) first (DL-CONTEXT-01);
this ledger's phase narratives below are the **archive** — consult them for history and audit, not
for the next task. Current phase in one line: R1–R3 is complete; DL-LIFE-02A, B1a, its late repairs,
and B1b-i are merged; the current head contains inert B1b-ii, while B1b-iii then B2–B4
remain without marking the card DONE or unblocking sensitive connectors between slices.

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
card bytes to a caller-reviewed lowercase SHA-256, derives the repository alias before any request,
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
  collector compatibility remain reviewed activation seams. The opened-handle proof closes path-
  replacement redirection, but same-size in-place card writes can still race content bytes; a
  published runner binds the exact opened card bytes to a supplied reviewed hash but a future caller
  must source that hash from durable owner-reviewed state rather than claiming hostile concurrent-
  writer integrity from the loader alone.
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

## Exact resume point

**Current 2026-08-05 (B1b-i merged; B1b-ii in the current head).** Finish the
invented-fixture-only authenticated rewrite: accept the ephemeral raw provider ID explicitly,
recompute and byte-check both stored aliases, match scope continuity only against the provider-
domain alias, populate the shadow target transactionally with an in-memory old/new map, rewrite the
complete base/incremental/claim/lineage graph, remint every affected `claim-id.v3`, prove closure,
destroy the map, and still return `completeB1b: false` / `selectable: false`. Merge only after the
exact local/hosted/fresh-review gates. B1b-iii then owns rollback
injection, post-close reopen/integrity/privacy proof, replay-normalized checksums, and the first
transactionally selected target. Do not reuse the existing in-place target path,
add a real-store/source-selection caller, persist identity input/mapping, or enter LIFE-03 backup/
grace work. Then continue B2-B4 exactly as
`docs/analyser-program/10_LIFE_02B_DECISION.md` defines. No intermediate slice may mark LIFE-02
DONE or close #80. B4 only unblocks LIFE-03; the first real migration/connector additionally needs
LIFE-03's backup/grace/restore/tombstone-replay proof and #86's alias-bearing V2 coverage remint.
Carry LIFE-01's pending-revocation suspension/resume invariant into the first caller boundary.
R7/R8 remain frozen; q-6/q-7/q-8 remain open; protected data remains out of scope.

**Superseded 2026-08-04 (R1 wave 3 — active horizon COMPLETE).** DL-VALIDATE-01 (`df59bbc`, PR #92)
and DL-VALUE-01 (`c632093`, PR #94) have merged, completing all 12 active-horizon cards. There is no
next active-horizon implementation slice; the live resume point is the **roadmap reassessment** that
decides whether the R4 stretch opens — standing preference DL-LIFE-01 (capability lifecycle state
machine), then DL-LIFE-02 (deletion cascade, closes most of
[#80](https://github.com/Chris0Jeky/developer-lens/issues/80)) — and only after the reassessment
confirms capacity. R7/R8 stay frozen. See `docs/analyser-program/09_IMPLEMENTATION_LAUNCHER.md` and
`docs/analyser-program/CURRENT_STATE.md`. Items 1–6 below stay valid for the dormant P4/P12 lanes.

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
   Read `docs/analyser-program/CURRENT_STATE.md` first, then start from
   `docs/analyser-program/09_IMPLEMENTATION_LAUNCHER.md`; the full card contract lives in the
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
   request.
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
