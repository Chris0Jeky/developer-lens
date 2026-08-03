# Developer Lens implementation ledger

Last updated: **2026-08-03**

Architecture: [`docs/DEVELOPER_LENS_V2_ARCHITECTURE.md`](./DEVELOPER_LENS_V2_ARCHITECTURE.md),
evidence/design version 2026-08-03.

Current phase: **D1-D3 and the synthetic P2 SQLite/importer proof are complete locally; the
post-merge P2 migration-contract repair and its installation-HMAC blocker repair are implemented
locally, with the one fix-round commit pending publication**.

This is the durable factual checkpoint, not a transcript. Git, executable checks, hosted CI, and
unresolved review threads outrank it whenever they disagree.

## Live state

- Checkout: the repository root for this task; no absolute local path is persisted here.
- Branch: `codex/fix-v1-migration-contract`, tracking `origin/codex/fix-v1-migration-contract`.
- Exact reviewed pre-fix head: `270ec16ba46090673420328cee2159057a236b3b`.
  Pull request [#4](https://github.com/Chris0Jeky/developer-lens/pull/4) is open and ready for
  review at that head; this one fix-round commit is local and has not been pushed.
- Base: `origin/main` at merge `5df1a09eddb1d9c003d5749b82f7462126a78e07`. The reviewed branch was
  2 commits ahead and 0 behind at the pre-fix head above.
- Pull request: [#3](https://github.com/Chris0Jeky/developer-lens/pull/3) merged at the base above;
  follow-up [#4](https://github.com/Chris0Jeky/developer-lens/pull/4) carries the three migration
  repairs and this single HMAC blocker fix round.
- Worktrees: one registered Developer Lens worktree, the primary checkout; it was tracked-clean
  before this ledger edit. Refresh cleanliness and occupancy from Git before any further mutation.
- Local follow-up commit: `bb2a0d5` fixes producer coverage compatibility, local repository-ID
  compatibility, and transactional replacement semantics; the current local fix round adds the
  explicit installation-scoped HMAC key contract.

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
- `HUMAN_TODO.md` records the expanded q-4 authority and still has zero open owner decisions.
- G2: approved 2026-08-03. C1=36m, C2=13m, C3=90d, C4=process lifetime; repository names remain
  isolated locally and PR titles are absent from canonical analytics. Real migration is authorized
  after the invented P2 proof under the one-backup, new-target, untouched-JSON, seven-day-grace,
  rollback, and application-controlled deletion protocol in `HUMAN_TODO.md`.
- G3: standing authorization granted 2026-08-03 for Actions, deployments, dependencies,
  Dependabot/code-scanning security aggregates, Projects, ownership, and source structure within
  the source-capability matrix. Missing permission becomes `restricted`/`unavailable` coverage and
  does not reopen an owner gate.
- G4: refused for the current roadmap. `cap.external.model` remains `never_authorized`; P12 and all
  external model SDK/transport/cache/telemetry/payload work are excluded.

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
  and the first synthetic P2 SQLite/importer proof are complete locally. P3-P11 remain the post-demo
  technical queue and P12 is excluded by the G4 refusal. For future overnight work,
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
  paths, raw provider IDs, and actor metadata are not persisted; imports fail closed without a
  32-byte installation key.
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

## Verification

- P2 migration-contract follow-up at pre-fix head
  `270ec16ba46090673420328cee2159057a236b3b`: the focused migration proof passed 1 file / 15 tests;
  `npm run check` passed lint, 21 files / 64 tests, TypeScript, and the Vite build;
  `npm run build:showcase` passed synthetic export, social render, showcase build, identity/export
  boundary verification, and secret/path scans; `npm audit --omit=dev` reported zero vulnerabilities;
  and `git diff --check` passed. The source JSON byte-preservation assertions cover successful and
  failed replacement imports.
- The current local HMAC fix round adds synthetic missing/short-key failure, full
  domain-separated installation-key alias, plain-hash non-equivalence, key-scope, raw-ID absence,
  and transformed-ID collision regressions. Focused migration proof passed 1 file / 18 tests;
  `npm run check` passed lint, 21 files / 67 tests, TypeScript, and the Vite build; showcase,
  audit, and diff checks are recorded after this local commit before publication.
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

## NOT verified

- Node 20 Windows native install/load for `better-sqlite3@12.11.1`; local native behavior is proved
  only on Node v24.13.1 / npm 11.8.0.
- CLI, `dataStore`, collector, API, export, or Pages activation of SQLite; real/private JSON
  migration and the G2 backup/grace/deletion protocol remain deliberately unexercised.
- Production adoption by existing collectors, storage, API, exporters, or Pages beyond the local
  synthetic route and showcase verifier.
- Hosted CI or connector review for the local HMAC-fix head.
- Runtime deny canary; no repository-owned Codex adapter exists.
- The newly approved G2/G3 policy has no runtime activation path yet. No real-data migration,
  retention cleanup, backup, deletion, or named G3 connector ran in this decision slice.
- G4 behavior is intentionally not verified because the owner refused it and the external-model
  path must remain absent.

## Residual risk

- P1 remains largely an inert contract foundation for existing v1 runtime paths; the D1 demo consumes
  the registered public seam only.
- P2 is a synthetic proof seam, not a general compatibility framework. Exact V2 headers are the
  intended ownership boundary; no real/private source or production reader uses the new database.
- P2 remains a disabled, synthetic proof without CLI/`dataStore`/API wiring; its reviewed ownership
  boundary is not evidence for unimplemented real-data migration or production compatibility.
- The legacy local producer still permits spaces/Unicode in remote paths or fallback basenames while
  this bounded importer accepts only the registered ASCII repository-reference alphabet; that P2
  compatibility gap remains tracked for the future canonical local-UUID/P6 seam.
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
- P3 must restate the ordinary-export class ceiling. A future owner decision would have to reopen
  G4 before any P12/model class-ceiling work exists.
- P2 deletion tests must enumerate collection jobs/checkpoints, source snapshots, coverage,
  data-quality findings, and export-build metadata.
- A future `cap.github.security` activation contract must encode its separate storage decision
  as well as G2+G3. P1 remains safe because the capability is `never_authorized` and has no
  activation path.
- A future provider-expansion review must assert disjoint transformed repository IDs; current
  installation HMAC aliases remove the raw local-alias collision path for the bounded producer.

## Exact resume point

1. Treat `270ec16ba46090673420328cee2159057a236b3b` as the exact pre-fix P2 migration-contract
   head for PR #4; the one HMAC fix-round commit is local and must be pushed only after its checks,
   diff review, and publication route are refreshed. Leave merge to the top-routed Sol model.
2. Route the bounded P3 architecture/dependency decision to Sol/Terra before writing. Select and pin
   a Node 20/24 Windows-compatible DuckDB/Parquet path using current primary metadata plus a local
   native probe; do not claim Node 20 Windows behavior until directly tested.
3. Then implement one minimal synthetic `server/analysisPack/*` producer and replay test that reads
   only the safe P2 facts, emits C0/C1 redacted aggregates under the closed manifest schema, records
   checksums, writes `COMPLETE` last, and proves one deterministic replay query. Exclude notebooks,
   model/LLM artifacts, identity/repository names, C2/C3/C4/X, collectors, CLI/`dataStore`, API/UI,
   real data, and production activation.
4. G2 permits a later real copy-based migration under the recorded backup/new-target/
   seven-day-grace/rollback protocol without another owner question. Standing G3 authorization
   applies when P8-P10 prerequisites are reached; P12 is absent.
5. For an unattended continuation, paste
   [`docs/OVERNIGHT_EXECUTION_PROMPT.md`](./OVERNIGHT_EXECUTION_PROMPT.md) into a fresh GPT-5.6 Sol
   Ultra task. It is the current self-contained execution contract and aggressively routes bounded
   inventory, mapping, triage, slice-building, and narrow review to Luna agents.
