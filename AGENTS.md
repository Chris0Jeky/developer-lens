# Developer Lens repository guide

Developer Lens is a private, local-first GitHub/Git retrospective with a separate public synthetic
showcase. Its product target is a humane system retrospective, never person scoring or workplace
surveillance. Global working agreements still apply; this file contains only repository-specific
facts and commands.

## Cold start

1. Read `.agent-harness/tier.json` and `HUMAN_TODO.md` on every resume.
2. Read `docs/IMPLEMENTATION_LEDGER.md` for current phase/evidence; refresh Git and GitHub because
   live state outranks it.
3. Invoke `$developer-lens-continuation` for implementation, migration, sensitive-source,
   architecture, or handoff work.
4. Read `docs/data-charter.md` and `docs/source-capability-matrix.md` before any persistence,
   migration, collector, export, or private-source change.
5. Consult the full architecture only for design decisions; do not read historical prompts as live
   authority.

## Source-of-truth map

| Surface | Authority |
|---|---|
| `.agent-harness/tier.json` | T2 authority, overlays, publication route, human-action alias |
| `HUMAN_TODO.md` | Owner decisions and genuinely open owner gates |
| `docs/data-charter.md` | Product boundary, data classes, retention, migration and sinks |
| `docs/source-capability-matrix.md` | Per-source purpose, class, consent, deletion and refusal |
| `docs/DEVELOPER_LENS_V2_ARCHITECTURE.md` | Stable design and phase dependencies |
| `docs/IMPLEMENTATION_LEDGER.md` | Current implementation evidence and exact resume point |
| `README.md` | User-facing product, run and verification instructions |

## Current authority boundary

- G1 and G2 are owner-approved. The existing charter's 36m/13m/90d/process lifetimes and
  copy-based seven-day migration protocol bind.
- G3 is standing-approved for the named, reviewed sources in the capability matrix. Current
  executable definitions stay `never_authorized` until a bounded task implements and tests an
  activation path for explicitly selected repositories with existing read-only credentials.
- G4 is open and not approved. Do not add an external-model provider, SDK, transport, payload,
  telemetry, cache, or spend path without a new explicit owner decision.
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

`npm run dev` starts API plus Vite; `npm run dev:web` serves the offline demo at
`http://127.0.0.1:5173/?demo=v2`. The API binds to `127.0.0.1:4141`.

## Repository map and pitfalls

- `scripts/`: collection, analysis and synthetic showcase generation/verification.
- `server/`: GitHub/local-Git ingestion, storage, analytics, API and analysis packs.
- `shared/`: closed privacy, capability, coverage, provenance and presentation contracts.
- `src/`: dashboard, Wrapped story and offline V2 demo.
- Vitest always loads `src/test/setup.ts`; a Node-only environment directive breaks that setup.
- Pull requests have no dedicated CI workflow. `main` pushes run the full gate, showcase privacy
  verification and Pages deployment through `.github/workflows/pages.yml`.
- `COMPLETE` packs are immutable by contract. A future activated reader must address the recorded
  concurrent-mutation snapshot risk before claiming hostile local-writer integrity.

## Continuation discipline

Use one writer per checkout and small present-tense commits. Keep volatile SHAs, PR/check state and
next-slice evidence in the implementation ledger, not this file or the architecture. Update
`HUMAN_TODO.md` only for explicit owner decisions. Close under changed / verified / NOT verified /
failures and workarounds / docs-state sync / residual risk / human actions / exact resume point.
