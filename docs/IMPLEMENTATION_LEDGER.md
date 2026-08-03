# Developer Lens implementation ledger

Last updated: **2026-08-03**

Architecture: [`docs/DEVELOPER_LENS_V2_ARCHITECTURE.md`](./DEVELOPER_LENS_V2_ARCHITECTURE.md),
evidence/design version 2026-08-03.

Current phase: **P0 and P1 complete locally; D1 synthetic working-demo slice is next**.

This is the durable factual checkpoint, not a transcript. Git, executable checks, hosted CI, and
unresolved review threads outrank it whenever they disagree.

## Live state

- Checkout: the repository root for this task; no absolute local path is persisted here.
- Branch: `codex/persist-deep-signal-architecture`, no upstream.
- Exact executable P1 head: `8809289657d260eb099cac755dd150d6c9f4b335`. The live branch's
  documentation predecessor for this gate-decision update is
  `2878ff15e1f7675e0131316adc4113c057a7254d`; verify current HEAD from Git before acting.
- Base: `origin/main` at `7f937547220e6160889eb96a7a72e2ef2c425b95`. At documentation
  predecessor `2878ff1`, the local branch was seven commits ahead; refresh the count from Git after
  this successor is committed.
- Pull request: none. q-4 is resolved through a human-relayed code-only/synthetic public branch;
  agents still do not push or merge Developer Lens.
- Worktrees: the primary checkout was the only registered Developer Lens worktree at the
  documentation predecessor. Refresh cleanliness and occupancy from Git before editing.
- Local branch commits before this gate-decision successor: `4abb2c5` architecture/handoff;
  `92cb782` G1 authority/charter; `2ea18a1` initial ledger/task card; `8809289` P1 executable
  contracts; `26aefe9` P1 checkpoint; `b40be09` demo-first policy; then the historical P1-handoff
  redirect.

## Authority and owner gates

- G1: approved in the 2026-08-03 initiating request.
- Repository declaration: T2 `daily-driver`, `sensitive_data=true`, `push=free`,
  `merge=free`, human-action alias `HUMAN_TODO.md`.
- The sensitive-data public-push deny binds over the free authority dial. q-4 is now closed: keep
  the public remote and synthetic Pages, but publish Developer Lens only through a human-relayed,
  code-only/synthetic branch after exact diff/canary review. Agents prepare local commits and relay
  evidence but do not push or merge this repository.
- Canonical estate registration is published as ready
  [claude-config PR #121](https://github.com/Chris0Jeky/claude-config/pull/121). Its live head must be
  refreshed from GitHub; it remains unmerged until matching Developer Lens authority/policy commits
  are relayed so both records can land together.
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
  approved `sensitive_data=true` declaration intentionally coexists with a public remote. This
  did not authorize a harness bootstrap or visibility change; q-4 records the publication effect.
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
- Sequence: D1 visible synthetic vertical slice, D2 feedback iteration, D3 repeatable local demo
  milestone. If the owner is unavailable overnight, Sol performs the local browser/visual D2 pass,
  records subjective assumptions and next-day questions, and proceeds rather than waiting. P2-P11
  become the post-demo technical queue; P12 is excluded by the G4 refusal.
- Hardening rule: security, privacy hardening, resilience, and distribution concerns are recorded in
  [`POST_DEMO_HARDENING.md`](./POST_DEMO_HARDENING.md) and do not interrupt D1-D3 unless they cross
  the irreversible floor.
- Irreversible floor: no secret/private/generated-data exposure, destroyed user work,
  external/production mutation, or public publication outside the chosen code-only/synthetic human
  relay. T2 plus `sensitive_data` remains declared for that floor; it is not a mandate for pre-demo
  scaffolding.

## Verification

- Gate-decision review proof: `npm run check` passed with this documentation diff present — lint,
  20 test files / 48 tests, TypeScript project builds, and the Vite production build. Vite emitted
  only the existing >500 kB chunk-size advisory. No executable source changed in this slice.
- Documentation proof: `git diff --check`, relative/local link validation, the 13-row capability
  inventory, zero open `HUMAN_TODO.md` checkboxes, the two-fence copy-ready prompt check, and the
  seven-column estate-row check passed. Fresh narrow reviews found no CRITICAL/HIGH defect in the
  project policy/prompt or estate sync.
- Final focused proof: `npm test -- server/privacyContract.test.ts` passed 7/7.
- Final full proof: `npm run check` passed lint, 20 files / 48 tests, TypeScript, and Vite build.
  Vite emitted only the existing >500 kB chunk-size advisory.
- Synthetic Draft 2020-12 manifest proof accepted a valid redacted aggregate and rejected
  `synthetic_public` plus a C2 artifact.
- Exact six-file cached set and whitespace checks were clean before the implementation commit.
- Review round one found two HIGH blockers: a public-manifest ceiling bypass and a false-complete
  coverage state. Sol's privacy pass also found cross-sink schema reuse; the same bounded fix batch
  added public/private separation, sink binding, nested-object refusal, and coverage arithmetic.
- Fresh round-two review of those changed risk seams found no remaining CRITICAL/HIGH defect.

## Failures and workarounds

- The first ad hoc link check treated existing absolute Markdown links with `:line` suffixes as
  filenames, and the first estate-table check searched for the wrong header label. Both validation
  scripts were corrected and rerun green; neither failure came from a repository artifact.
- The writer's first `npm run check` found a generic-entry TypeScript error in
  `shared/privacy.ts`; it was corrected and rerun green.
- The coordinator's first post-review full check passed lint and all 48 tests, then found one
  TypeScript narrowing error in the new public/private canary test. The test was branched
  explicitly by boundary; the focused test and complete check were rerun green.

## NOT verified

- A D1-D3 V2 working demo; no demo implementation changed in this policy slice.
- Production adoption by existing collectors, storage, API, UI, exporters, or Pages.
- App, collector, analysis, API/start, or showcase runtime.
- Hosted CI or connector review for the unpublished Developer Lens head.
- Runtime deny canary; no repository-owned Codex adapter exists.
- The newly approved G2/G3 policy has no runtime activation path yet. No real-data migration,
  retention cleanup, backup, deletion, or named G3 connector ran in this decision slice.
- G4 behavior is intentionally not verified because the owner refused it and the external-model
  path must remain absent.

## Residual risk

- P1 is an inert contract foundation. Existing v1 runtime paths do not yet consume it.
- Existing JSON, raw API error behavior, late export sanitization, and person-shaped analytics
  retain the architecture's documented risks. They are intentionally deferred in
  `docs/POST_DEMO_HARDENING.md` until the D3 milestone unless they cross the irreversible floor.
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

## Exact resume point

1. Implement D1 in exactly four paths: add `shared/v2Demo.ts` and
   `src/components/V2Demo.tsx`; modify `src/App.tsx` and `src/App.test.tsx`.
2. Add an explicit `?demo=v2` client mode selected before `useDashboard` mounts. It renders a
   strict `public_showcase.v1` C0 fixture through the existing visual system and `InsightStack`,
   states that the content is invented, and makes no API request.
3. Do not touch `server/demo.ts`, `server/dataStore.ts`, `server/index.ts`,
   `scripts/exportDemo.ts`, collection, storage, migration, network, or hardening.
4. Run `npm test -- src/App.test.tsx`, then `npm run check`. Launch with `npm run dev:web` and open
   `http://127.0.0.1:5173/?demo=v2` for D2 feedback. If the owner is unavailable, Sol performs and
   records a local browser/visual pass, then continues to D3.
5. After D3, prove P2 with an invented v1 fixture first. G2 then permits a real copy-based migration
   under the recorded backup/new-target/seven-day-grace/rollback protocol without another owner
   question. Standing G3 authorization applies when P8-P10 prerequisites are reached; P12 is absent.
6. For an unattended continuation, paste
   [`docs/OVERNIGHT_EXECUTION_PROMPT.md`](./OVERNIGHT_EXECUTION_PROMPT.md) into a fresh GPT-5.6 Sol
   Ultra task. It is the current self-contained execution contract and aggressively routes bounded
   inventory, mapping, triage, slice-building, and narrow review to Luna agents.
