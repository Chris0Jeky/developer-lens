# Developer Lens repository canon

Developer Lens is a private, local-first GitHub/Git retrospective with a separate public synthetic
showcase. The default/public product stays system-first — engineering evidence without developer
surveillance; team/person analysis follows the layered subject policy in
`docs/OWNER_CONSTITUTION.md`. This file is the shared canon for every agent runtime; `AGENTS.md`
is the thin Codex adapter.
`npm run verify:context` enforces required files, markers, links, and budgets in both.

## Cold start

1. Read `.agent-harness/tier.json`, `.agent-harness/governor.yaml`, and `HUMAN_TODO.md` on every
   resume; the governor loop and prompts live under `docs/agent-system/`.
2. Read `docs/analyser-program/CURRENT_STATE.md` (the single resume artifact); refresh Git and
   GitHub because live state outranks it. `docs/IMPLEMENTATION_LEDGER.md` is the history archive.
3. Invoke the `developer-lens-continuation` skill for implementation, migration, sensitive-source,
   architecture, or handoff work (Codex form: `$developer-lens-continuation`).
4. Read `docs/data-charter.md` and `docs/source-capability-matrix.md` before any persistence,
   migration, collector, export, private-source, retrieval, or external-model change; consult
   `docs/DEVELOPER_LENS_V2_ARCHITECTURE.md` only for design decisions, never as live authority.

## Source-of-truth map

| Surface | Authority |
|---|---|
| `.agent-harness/tier.json` | T2 authority, overlays, publication route, human-action alias |
| `docs/OWNER_CONSTITUTION.md` | Binding owner policy (mandate v2); explicit supersessions |
| `.agent-harness/governor.yaml` + `docs/agent-system/` | Governor policy, work classes, prompts |
| `HUMAN_TODO.md` | Owner decisions and genuinely open owner gates |
| `docs/data-charter.md` | Product boundary, data classes, retention, migration and sinks |
| `docs/source-capability-matrix.md` | Per-source purpose, class, consent, deletion and refusal |
| `docs/DEVELOPER_LENS_V2_ARCHITECTURE.md` | Stable design and phase dependencies |
| `docs/analyser-program/CURRENT_STATE.md` | Live state and exact resume point (single artifact) |
| `docs/IMPLEMENTATION_LEDGER.md` | Historical evidence archive (per-slice proofs and run IDs) |
| `README.md` | User-facing product, run and verification instructions |

## Current authority boundary

- G1 and G2 are owner-approved. The existing charter's 36m/13m/90d/process lifetimes and
  copy-based seven-day migration protocol bind.
- G3 is standing-approved for the named, reviewed sources in the capability matrix. Current
  executable definitions stay `never_authorized` until a bounded task implements and tests an
  activation path for explicitly selected repositories with existing read-only credentials.
- G4 is owner-approved only for OpenAI `gpt-5.6-luna` within the exact charter/matrix boundary.
  `cap.external.model` remains `never_authorized` until a bounded default-off implementation and
  exact-head gate pass; approval never authorizes an unreviewed payload.
- The public `origin` route may carry code, tests, docs, and invented synthetic assets only.
  Authority to design or implement a source is not authority to publish its private output.

## Protected-data rule

Default to invented fixtures. Do not inspect `.developer-lens/`, generated `public/data/`, `dist/`,
credentials, browser profiles, caches, or real/private inputs during ordinary work. A deliberately
activated real-data task must first name its exact paths/scope, purpose, retained fields,
rollback/deletion behavior, and proving checks. Never track or publish those inputs or outputs.

## Run and prove

Use one Node major per installation because `better-sqlite3` is ABI-specific. On Windows use
PowerShell and quote paths; prefer explicit Vitest paths over shell globs.

| Seam | Narrow proof |
|---|---|
| Offline V2 UI | `npm run test:demo:v2` |
| Server or one contract | `npm test -- <explicit-test-path>` |
| Analysis pack | `npm test -- server/analysisPack/analysisPack.test.ts` |
| Storage/importer | `npm test -- server/storage/migration.test.ts` |
| Docs, authority or skills | `npm run verify:context` and `git diff --check` |
| Any code/config milestone | `npm run check` |
| Public/demo/export seam only | `npm run build:showcase` |

`npm run dev` = API (`127.0.0.1:4141`) + Vite; `npm run dev:web` = offline demo (`http://127.0.0.1:5173/?demo=v2`).

## Repository map and pitfalls

- `scripts/`: collection/analysis/showcase generation; `server/`: ingestion, storage, analytics,
  API, analysis packs.
- `shared/`: closed privacy/capability/coverage/provenance/presentation contracts; `src/`:
  dashboard, Wrapped story, offline V2 demo.
- Vitest always loads `src/test/setup.ts`; a Node-only environment directive breaks that setup.
- PRs run the hosted gate `.github/workflows/pr-gate.yml`; `main` branch protection requires its
  `Prove the pull request` job. `main` pushes rerun the full gate + Pages deploy via `pages.yml`.
- `COMPLETE` packs are immutable by contract. A future activated reader must address the recorded
  concurrent-mutation snapshot risk before claiming hostile local-writer integrity.

## Claude routing and delegation

- The coordinating session owns orchestration, decisions, and architecture: slice selection,
  authority interpretation, contract design, and final merge judgment stay with it.
- Delegate discovery to `dl-scout` (Opus 5 low), implementation to `dl-implementer`, adversarial
  review to `dl-reviewer` (both Opus 5 high; owner decision A5 of 2026-08-08 supersedes the q-9
  Opus 4.8 pin), mechanical sweeps to `dl-mechanic` (Sonnet 4.6 high). Never route work to Haiku.
- One writer per checkout; parallel writers require separate coordinator-owned worktrees and
  non-overlapping paths. Subagents can move HEAD — pin git state in prompts, re-verify after each.
- Keep volatile SHAs, PR/check state and next-slice evidence in the implementation ledger, not this
  file. Route owner decisions and genuinely open owner gates to `HUMAN_TODO.md`.
- `bypassPermissions` lives only in gitignored `.claude/settings.local.json`, never committed.
- Close under changed / verified / NOT verified / failures / docs-state sync / residual risk /
  human actions / exact resume point.
