# Developer Lens continuation prompt

This is a copy-ready launcher, not a source of live project state. Open a fresh Codex task at the
repository root with the strongest available reasoning model, then paste the block below. The task
must read the tracked sources it names; do not expand this file into a duplicate ledger or policy
manual.

```text
Continue Developer Lens autonomously from live repository evidence.

STARTUP

1. Read AGENTS.md completely and invoke $developer-lens-continuation.
2. Refresh .agent-harness/tier.json, HUMAN_TODO.md, git status/upstream/worktrees, open PRs, checks,
   reviews, and docs/IMPLEMENTATION_LEDGER.md. Live Git/GitHub evidence outranks prose.
3. Read docs/data-charter.md and docs/source-capability-matrix.md before any persistence,
   migration, connector, sensitive-source, export, or private-data change.
4. Read only the architecture/code/tests required by the next bounded slice. Do not execute a
   historical prompt or treat an old task card as current state.

OWNER AUTHORITY

- G1 and G2 are approved. Use the retention and copy-based migration protocol in HUMAN_TODO.md and
  docs/data-charter.md; approval does not waive the migration prerequisites or proving tests.
- G3 standing authorization covers the named sources and reviewed future additions within
  docs/source-capability-matrix.md. Each runtime capability remains never_authorized until a
  bounded task implements and tests explicit activation for selected repositories with existing
  read-only least-privilege access.
- G4 remains open and is not approved. Do not add or run an external-model provider, SDK,
  transport, payload, cache, telemetry, or spend path.
- The exact public route may contain only code, tests, docs, and invented synthetic assets. Never
  track or publish private/generated runtime data, credentials, browser state, caches, or paths.

MISSION

Take the first dependency-safe incomplete product slice in docs/IMPLEMENTATION_LEDGER.md. Prefer a
working vertical behavior and focused proof over broad scaffolding. G2/G3 approval removes the
owner-policy wait, but it does not automatically activate collection or authorize credential
changes, provider writes, broad filesystem scans, or publication of private output.

Before any real/private read, write a task card with exact selected paths/repositories, purpose,
fields/classes, coverage behavior, retention, deletion, rollback, failure tests, and narrow proof.
Use invented fixtures before touching the approved real route. Treat missing permission, censored
history, and failures as explicit coverage rather than zero activity.

COLLABORATION

Keep exactly one writer per checkout. Use small read-only mapping/review tasks when they materially
shorten the critical path; keep architecture, privacy, integration, publication and merge judgment
with the primary agent. Do not manufacture tasks to keep agents busy.

PROVING AND PUBLICATION

- Run the seam-specific command from AGENTS.md, then npm run check for a code/config milestone.
- Run npm run verify:context for authority, instructions, prompts, or skills.
- Run npm run build:showcase only when the changed seam can reach public/demo/export data or its
  privacy verifier.
- Update docs/IMPLEMENTATION_LEDGER.md at a milestone with exact changed/verified/NOT verified state.
- Use a codex/ branch, small present-tense commits, one bounded review cycle, and the repository's
  exact-head check/aging/merge gate. Preserve commits.

STOP CONDITION

Continue while a safe dependency-ready task exists. When no such task remains, leave a factual
handoff containing changed, verified, NOT verified, failures/workarounds, docs-state sync, residual
risk, human actions, exact branch/HEAD/PR/check/worktree state, and the next bounded slice. Do not
finish with a generic offer or ask the owner to repeat a decision already recorded in HUMAN_TODO.md.
```
