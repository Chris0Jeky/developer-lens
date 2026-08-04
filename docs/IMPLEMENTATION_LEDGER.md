# Developer Lens implementation ledger

Last updated: **2026-08-04**

Architecture: [`docs/DEVELOPER_LENS_V2_ARCHITECTURE.md`](./DEVELOPER_LENS_V2_ARCHITECTURE.md),
evidence/design version 2026-08-03.

Current phase: **D1-D3, the synthetic P2 SQLite/importer proof, the bounded synthetic P3
analysis-pack foundation, and the durable continuation/context-verifier foundation are published.
The public synthetic V2 demo now includes an accessible observed-to-derived-to-hypothesis story
path over its existing validated C0 insight payload. The published P4 foundation includes an inert
protocol, opt-in incremental storage bridge, invented-fixture page adapter, closed activation-card
parser, injected public-unauthenticated GET transport with immediate projection, closed-world
incremental-schema validation, and a confined descriptor-bound, duplicate-key-rejecting, 64 KiB
ignored-card loader. The current publication candidate adds frozen alias-only membership to every
accepted REST page receipt. A shared installation-
scoped alias factory now preserves the existing migration identities and adds closed, domain-
separated repository, issue, pull-request, and page aliases. The opt-in store now records restricted
coverage as explicitly noncomplete without advancing a checkpoint or creating a snapshot. P4
remains default-off and
adds no credential, live read, storage composition,
legacy-collector switch, or public/private output path. G4 is now provider-specifically approved,
while a strict C1 evidence/output contract, deterministic local retrieval, and a credentialless
OpenAI Responses request boundary remain default-off. The external-model capability is still
`never_authorized`; there is no environment read, authorization-bearing transport, network/provider
execution, raw response, cache, telemetry, persistence, or presentation path**.

This is the durable factual checkpoint, not a transcript. Git, executable checks, hosted CI, and
unresolved review threads outrank it whenever they disagree.

## Live state

- Checkout: the repository root for this task; no absolute local path is persisted here.
- Published implementation baseline before the current restricted-storage milestone:
  `origin/main` merge `4ee986ed1e65cd58a56799391827359224ce1f14`.
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
  gate, synthetic-showcase privacy verification, artifact upload, and deployment. Its Node 20
  action-runtime deprecation annotation is tracked separately in
  [#31](https://github.com/Chris0Jeky/developer-lens/issues/31).
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
- Desktop and 390 px in-app browser inspection found no horizontal overflow; the rail changes from
  three columns to a vertical connected path. The existing Observed filter remained keyboard/ARIA
  addressable and changed the live status from 3/3 to 1/3 with exactly one visible insight card.

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
  stateful conversation, background job, cache, telemetry, or initially persisted output is allowed.
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
- This foundation does not activate `cap.external.model` and includes no environment read,
  credential/Authorization surface, SDK, HTTP implementation, provider response parser/body/ID,
  timeout, cache, telemetry, persistence, presentation, export, or public path. A later activation
  slice must bind a separately reviewed task card, freshly revalidated model/price/data terms, the
  one named environment credential, a body-discarding transport, and a user-reviewable exact payload
  preview before any real request.

## Verification

- P4 page-membership candidate [PR #35](https://github.com/Chris0Jeky/developer-lens/pull/35)
  was rebased onto restricted-storage merge `e0ed726`; the focused REST suite passed 1 file / 9
  tests. `npm run check` passed Oxlint, context verification, 34 test files / 163 tests, TypeScript
  project builds, and the production Vite build; `git diff --check` passed. A fresh-context review
  found no CRITICAL/HIGH range-filtering, deduplication, alias-only membership, determinism, or
  mutation-safety defect.
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
- No REST result is composed into the incremental store. Page-local alias membership and restricted
  persistence are proved only with invented input; canonical composition/hash/replay is not yet
  implemented, and the real task card, Taskdeck scope, network, and task-owned database remain unread.
- Production adoption by existing collectors, storage, API, exporters, or Pages beyond the local
  synthetic route and showcase verifier.
- No pull-request CI lane exists; the exact-merge Pages build/deploy is the verified hosted gate.
- G2/G3 runtime behavior is not verified merely by approval: no real-data migration, retention
  cleanup, backup, deletion, or named sensitive connector ran in this slice. G4 is now approved
  only for the recorded OpenAI/Luna boundary; the C1, local-retrieval, and credentialless request
  foundations remain process-local and no credential-bearing adapter, external transport, or real
  provider request has run.

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
- The P12 request seam validates caller-injected pricing shape and freshness but cannot authenticate
  that the caller actually rechecked the official pages. It deliberately has no credential reader,
  HTTP timeout/body parser, usage receipt, activation card, output retention, or presentation path;
  those remain separate reviewed boundaries before a real call.
- The P4 synthetic adapter and public REST transport are both injected seams with no runtime call
  site. The loader reads only the canonical task-owned card but no production caller composes it
  with transport or the opt-in storage bridge. Application-controlled backup/restore, installation-
  key lifecycle and mismatch enforcement, snapshot stability, parity/fallback, tombstoned deletion/
  re-consent, and legacy
  collector compatibility remain reviewed activation seams. The opened-handle proof closes path-
  replacement redirection, but same-size in-place card writes can still race content bytes; a
  composed runner must bind an owner-reviewed payload hash/snapshot rather than claiming hostile
  concurrent-writer content integrity from this loader alone.
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
  key creation, persistence, mismatch, rotation/recovery, and deletion behavior remain tracked in
  [#6](https://github.com/Chris0Jeky/developer-lens/issues/6) before real migration.
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
  half-open time range prove the bounded observed response, but a composed real runner must use
  replay/stability evidence and report a non-complete coverage state if concurrent mutation makes
  the observed snapshot unstable.

## Exact resume point

1. Refresh Git/GitHub before mutation. The published baseline before the current page-membership
   candidate is merge `e0ed72656fbf900b21620ac5a442e12c1d5415a0`; live evidence still outranks
   this checkpoint.
2. Invoke `$developer-lens-continuation` and preserve P3 as an immutable, unactivated C1 coverage
   pack. Its current reader verifies the Parquet hash after replay; do not expand that proof into an
   activated hostile-writer claim without an immutable snapshot or equivalent boundary.
3. G2 and standing G3 are approved, but no real path is automatically active. Reconcile issue #6's
   duplicate-identity/key-continuity acceptance and issue #5's local-name/identity-vault boundary
   before a real v1 migration. Use invented fixtures and a new bounded task card first.
4. The exact repository is owner-selected in an ignored local task card; its parser, confined
   descriptor-bound loader, and injected public-unauthenticated transport expose no identity or
   operational values in tracked state. The shared alias factory now preserves existing repository
   identities and defines closed unit/page domains; the opt-in store now preserves restricted
   coverage without a snapshot or checkpoint advance. Page-local alias membership is the current
   publication candidate. Next add pure canonical alias/hash/replay composition, then issue #6 key-
   lifecycle/mismatch enforcement,
   backup/restore, scoped deletion/tombstone, re-consent, and snapshot-stability proof. Keep runtime
   default-off and make no real request until that composition, focused failure tests, review, and
   the exact hosted gate pass.
5. G4 is approved only for the exact OpenAI/Luna contract, but `cap.external.model` remains
   `never_authorized`. The strict C1 payload/output and deterministic local-retrieval foundation is
   present, and the credentialless request boundary now enforces native strict output, standard
   service tier, serialized byte/cost ceilings, `store:false`, and one call/no retry. Next add a
   separately reviewed task card and exact payload preview plus an authorization-bearing transport
   that reads only the approved environment variable at call time, applies a finite timeout,
   extracts only structured output, and discards raw provider bodies/IDs. Make no live request until
   that implementation, review, exact hosted gate, and task-card authorization pass.
