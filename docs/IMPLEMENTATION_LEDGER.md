# Developer Lens implementation ledger

Last updated: **2026-08-03**

Architecture: [`docs/DEVELOPER_LENS_V2_ARCHITECTURE.md`](./DEVELOPER_LENS_V2_ARCHITECTURE.md),
evidence/design version 2026-08-03.

Current phase: **P0 complete; P1 task card prepared**.

This file is the current factual checkpoint, not a transcript. Git and executable evidence outrank
it whenever they disagree.

## Live state

- Checkout: the repository root for this task; no absolute local path is persisted here.
- Branch/head: `codex/persist-deep-signal-architecture` at
  `92cb78237f0950908a224545575ed593793e0555` after the P0 authority/charter commit.
- Base: `origin/main` at `7f937547220e6160889eb96a7a72e2ef2c425b95`; branch was one commit
  ahead at orientation and is now two commits ahead with no upstream.
- Pull request: none at orientation; current head was not published.
- Worktrees: the primary checkout was the only registered Developer Lens worktree and was clean.
- Branch commits: `4abb2c5` persists the architecture, research provenance, and orchestrator
  handoff; `92cb782` establishes T2 authority, the data charter, capability matrix, and human gates.

## Authority and owner gates

- G1: explicitly approved in the 2026-08-03 initiating request.
- Repository declaration: T2 `daily-driver`, `sensitive_data=true`, `push=free`, `merge=free`,
  human-action alias `HUMAN_TODO.md`.
- The `sensitive_data` public-push deny still binds over the free authority dial. Because the remote
  is public, publication is owner-gated under `HUMAN_TODO.md` q-4; local implementation may proceed.
- Canonical estate registration: being prepared as an independent claude-config PR; the
  repository tier file is the machine-readable authority.
- G2: unapproved. No real private-data read, retention, migration, backup, or deletion work.
- G3: unapproved separately for Actions, deployments, dependencies, security, Projects,
  ownership, and source structure.
- G4: unapproved. No external model SDK, transport, cache, telemetry, or payload.

## P0 result

- Commit `92cb78237f0950908a224545575ed593793e0555` adds the T2 authority declaration,
  data charter, source/capability matrix, and human-action file. This ledger is the next isolated
  documentation commit so it can name that exact head.
- Data schema: unchanged. Capability/contract version: human-readable `1.0.0`; no runtime behavior.
- Private-data reads or migrations: none.
- Proving checks: canonical `harness.validate_tier` returned `[]`; JSON parsing, four required flag
  booleans, 13 unique capability rows, G2 on every capability row, human-gate/link/path checks,
  cross-repository authority parity, Markdown table columns, and diff whitespace checks passed.
- Audit exception: the broader canonical `harness.py audit` is not green because Developer Lens has
  no root `AGENTS.md` and the owner-approved `sensitive_data=true` declaration intentionally
  coexists with a public remote. No unrequested harness bootstrap or remote-visibility change was
  made. The public-push policy consequence is q-4.
- Review: one bounded fresh-context review found a HIGH consent ambiguity where `github.core` could
  be read as active before G2; fixed to `never_authorized` with no P1 activation. The same fix batch
  made G2 prerequisite to every real/private read and removed a newly persisted absolute path.
  Non-blocking identity/sink/deletion observations are tracked below. Fresh fix verification found
  no direct CRITICAL/HIGH privacy or correctness defect.

## Task card P1-CONTRACT-001

- **Phase / objective:** P1 executable privacy contract v1. Implement the smallest dependency-safe
  seam that makes data classes, capability consent, coverage, provenance, and the analysis-pack
  manifest fail closed before storage or collection work.
- **Why next:** P2 and every later source/sink depend on executable classification, consent,
  coverage, and provenance semantics. This slice requires no G2/G3/G4 approval and reads no real
  data.
- **Writer / checkout:** one Terra writer owns the primary Developer Lens checkout for the duration
  of implementation. Sol and all Luna agents remain read-only until handoff.
- **Owned paths:** `shared/privacy.ts`, `shared/capabilities.ts`, `shared/coverage.ts`,
  `shared/provenance.ts`, `docs/analysis-pack/manifest.schema.json`, and
  `server/privacyContract.test.ts`. The already-authored P0 docs/authority/ledger are read-only to
  the writer.
- **Non-goals:** no collector, storage, SQLite, migration, API, UI, frontend, exporter, retention
  execution, network, model, telemetry, public-showcase behavior, dependency install, or edits to
  existing runtime types. Do not inspect `.developer-lens/`, `public/data`, `dist`, caches, browser
  profiles, credentials, real account activity, untracked private inputs, or generated data.
- **Versions:** privacy/capability/coverage/provenance contract `1.0.0`; canonical envelope schema
  fixed to architecture version `2.0.0`; analysis-pack manifest `1.0.0`. Unknown versions fail.
- **Semantics:** encode C0/C1/C2/C3/C4/X; the exact ten coverage states; the fixed capability IDs
  and metadata in `source-capability-matrix.md`; observed/deterministic/modelled/hypothesis layers;
  strict source provenance; and a manifest with no arbitrary text/provider payload fields.
  Every capability definition starts `never_authorized`; registry membership is not consent and P1
  exposes no activation path. Registered field policy—not caller assertion—decides class and sink
  access. Unknown fields,
  classes, capabilities, statuses, payload families, evidence layers, source kinds, and export
  classifications reject.
- **Acceptance:** strict schemas reject extra keys and invalid counts/times; coverage preserves
  missing/refused/restricted/truncated/stale/failed/deleted/censored states rather than zero; field
  class maps match payload keys; manifest objects use `additionalProperties: false`, controlled
  IDs/enums, relative allowlisted table paths, SHA-256 shapes, and only exportable class ceilings.
- **Invented privacy proof:** unique canaries cover token/key, Windows/POSIX path, identity/repository,
  title/label/body/review/subject, workflow/job/artifact/cache, dependency, source/symbol/import, and
  security detail classes. Assert rejection independently for persistence, log/error, API/frontend,
  export, model, and public sinks; no rejected canary may appear in accepted/golden serialization.
- **Focused proof:** `npm test -- server/privacyContract.test.ts`; then `npm run check`. Do not run
  collection, analysis, app startup, or a Pages build because P1 cannot affect those runtime seams.
- **Rollback / deletion:** remove the six new contract/test/schema paths. There is no database,
  retained data, migration, external call, or deletion side effect.
- **Dependencies / gates:** G1 declared and P0 docs fixed; G2/G3/G4 remain closed. Any semantic
  ambiguity returns to Sol before implementation expands scope.
- **Expected handoff:** changed / verified / NOT verified / failures and workarounds / residual
  privacy-correctness risk / exact next point, including exact diff and commands.

## Checkpoint

- **Changed:** P0 authority/charter commit `92cb782`; this ledger is prepared as a second docs-only
  commit. No runtime source is changed yet.
- **Verified:** read-only orientation proved branch/head/base, one clean worktree, initial absence of
  authority files, public/unprotected GitHub repository, no open PR/issues, and successful recent
  Pages runs on merged `main`; P0 schema/parity/fix checks are listed above.
- **NOT verified:** application tests/build, current-head hosted CI or connector review, public branch
  publication, a runtime deny canary (no project Codex adapter exists), and every product runtime
  behavior.
- **Residual risk:** existing JSON, API errors, late export sanitization, and person-shaped analytics
  retain the v1 risks documented by the architecture until later phases replace them.
- **Exact resume point:** commit this ledger, then delegate `P1-CONTRACT-001` to one Terra writer.

## Tracked non-blocking review findings

- P6 task design must restate the higher-level identity invariant explicitly: compare verified
  owner email only ephemerally, emit only `is_self`, and never retain identity or per-person output.
- P3/P12 task design must restate ordinary-export and model class ceilings even though the charter
  and capability row already exclude C2/C3 from an external model and ordinary export.
- P2 schema/deletion tests must enumerate collection jobs/checkpoints, source snapshots, coverage,
  data-quality findings, and export-build metadata explicitly; the charter's descendant-deletion
  rule remains authoritative in the interim.
