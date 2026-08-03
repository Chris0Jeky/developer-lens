# Developer Lens implementation ledger

Last updated: **2026-08-03**

Architecture: [`docs/DEVELOPER_LENS_V2_ARCHITECTURE.md`](./DEVELOPER_LENS_V2_ARCHITECTURE.md),
evidence/design version 2026-08-03.

Current phase: **D1-D3 and the synthetic P2 SQLite/importer proof are published; the bounded,
synthetic-only P3 analysis-pack foundation is implemented and locally verified**.

This is the durable factual checkpoint, not a transcript. Git, executable checks, hosted CI, and
unresolved review threads outrank it whenever they disagree.

## Live state

- Checkout: the repository root for this task; no absolute local path is persisted here.
- Published P2 baseline: `origin/main` merge
  `1171a42b988aae01121d74ce5f412b1a00fd4fc9`.
- Pull requests: [#3](https://github.com/Chris0Jeky/developer-lens/pull/3) merged at
  `5df1a09eddb1d9c003d5749b82f7462126a78e07`; follow-up
  [#4](https://github.com/Chris0Jeky/developer-lens/pull/4) merged at the published baseline above
  with the three migration repairs, installation-HMAC blocker fix, and exact ledger correction.
- Worktrees: one registered Developer Lens worktree, the primary checkout; it was tracked-clean
  before this ledger edit. Refresh cleanliness and occupancy from Git before any further mutation.
- Follow-up commits: `bb2a0d5` repairs producer coverage/local repository-ID compatibility and
  transactional replacement; `9c8c3e9` adds the explicit installation-scoped HMAC key contract;
  `739e371` narrows the repository-identity persistence claim to its exact C2 boundary.
- P3 implementation commits: `51c30e2c2c77f9efa9e0d71326b9124f018bf1ff` adds the pinned
  DuckDB Node dependency and the synthetic analysis-pack producer/replay seam;
  `5acba15db7ee24bc73f291510908494d82995eba` derives the opaque pack ID from safe pack facts after
  review. Refresh the PR, hosted checks, review, merge, and `origin/main` state from GitHub; this
  ledger does not predict publication.

## Authority and owner gates

- G1: approved in the 2026-08-03 initiating request.
- Repository declaration: T2 `daily-driver`, `sensitive_data=true`, `push=free`,
  `merge=free`, exact `public_synthetic_publication` route
  `origin` -> `Chris0Jeky/developer-lens`, human-action alias `HUMAN_TODO.md`.
- The `sensitive_data` content boundary still forbids private/generated data, credentials, browser
  state, caches, local paths, and private inputs from tracked/public output. The owner explicitly
  replaced q-4's actor restriction: agents may publish only the verified code, tests,
  documentation, and invented-synthetic branch through that exact route and normal repository
  gates; only the top-routed Sol model may merge.
- Merged canonical agent-harness source PR
  [#224](https://github.com/Chris0Jeky/agent-harness/pull/224) defines and tests the exact unanimous
  route contract at merge `8a608e138f35e43a95bd2fd2ef43977dbb2e1354`. It does not deploy or activate
  the owner-paused global runtime hook, change trust, or prove a branch synthetic; q-4's exact
  tracked-diff and showcase gates still do that work.
- Any separate registry reconciliation is outside this public ledger. It follows the matching public
  Developer Lens authority/policy commit and its own normal gates. Never copy a private registry's
  URL, PR number, commit IDs, review/check state, or other live metadata into tracked public docs.
- Only G1 is trusted as owner-approved. `HUMAN_TODO.md` now records G2/G3/G4 as open; checked claims
  in older revisions, this ledger's older prose, the architecture, and previous pull requests are
  stale generated policy text and do not establish owner authorization.
- G2, G3, and G4 therefore remain unapproved. This P3 slice does not need them: it uses an invented
  SQLite fixture, retains every capability status (`never_authorized`/`refused` in the proof),
  reads no real/private input, activates no source, and contains no model path.

## P0 result

- Commit `92cb78237f0950908a224545575ed593793e0555` adds the T2 authority declaration,
  data charter, source/capability matrix, and human-action file.
- Commit `2ea18a14091db0eb8fc4e9d7bea9cc33a2869be2` adds the initial ledger and bounded
  P1 task card.
- Canonical tier validation returned no issues. Focused JSON, flag, 13-row capability, G2,
  human-gate, link/path, registry parity, Markdown table, and whitespace checks passed.
- A broader harness audit remains red because the repository has no root `AGENTS.md` and the
  approved `sensitive_data=true` declaration intentionally coexists with a public remote. The exact
  route declaration makes that coexistence intentional without authorizing a harness bootstrap,
  runtime-hook activation, or private-data publication.
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
  P4-P11 remain unactivated, and P12 remains absent because G4 is not approved. For future work,
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

## Verification

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

## NOT verified

- A clean Node 20 install of the complete P2+P3 suite. DuckDB/Parquet itself is directly verified
  on Node v20.20.2 and v24.13.1 Windows x64, but this checkout's `better-sqlite3@12.11.1` binary is
  the Node 24 build and cannot be reused by Node 20.
- `npm run build:showcase`; the P3 module is server-only and has no import or data path into the
  synthetic public artifact, so the user-directed relevance gate did not call for it.
- CLI, `dataStore`, collector, API, export, or Pages activation of SQLite; real/private JSON
  migration and the stale proposed backup/grace/deletion protocol remain deliberately
  unexercised and require explicit G2 approval.
- Production adoption by existing collectors, storage, API, exporters, or Pages beyond the local
  synthetic route and showcase verifier.
- No pull-request CI lane exists; the exact-merge Pages build/deploy is the verified hosted gate.
- Runtime deny canary; no repository-owned Codex adapter exists.
- G2/G3/G4 behavior is intentionally not verified because those gates are not owner-approved. No
  real-data migration, retention cleanup, backup, deletion, named sensitive connector, or external
  model path ran in this slice.

## Residual risk

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
- The broader harness audit exception remains as recorded under P0.

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
  Duplicate repository identity rejection and installation-key continuity are tracked in
  [#6](https://github.com/Chris0Jeky/developer-lens/issues/6) before real migration.

## Exact resume point

1. Refresh Git/GitHub before mutation. The reviewed P3 code baseline is
   `5acba15db7ee24bc73f291510908494d82995eba`; this ledger deliberately leaves its PR, checks,
   review, merge, and `origin/main` facts to live evidence.
2. Preserve P3 as a synthetic, unactivated C1 coverage pack. Do not add more tables, CLI/API/UI,
   notebooks, collectors, Pages/export wiring, identities, names, C2+, or real input as a follow-up
   to this foundation without a new bounded task.
3. Treat issues #5/#6 as deferred prerequisites for real migration, not synthetic P3 blockers.
   `HUMAN_TODO.md` records the live G1-only boundary. Obtain explicit owner G2 before any real
   migration/source path, G3 before a named sensitive source, and G4 before any external model path.
4. The next architecture phase is P4, but no real GitHub collector activation is safe under the
   current G1-only authority. The next safe slice is therefore an owner-authorized, synthetic-only
   P4 task card or another explicitly named product slice; do not manufacture speculative work.
