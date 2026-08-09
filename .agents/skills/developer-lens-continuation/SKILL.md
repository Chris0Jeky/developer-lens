---
name: developer-lens-continuation
description: Resume and advance Developer Lens from live repository evidence while preserving its local-first privacy, owner gates, synthetic/public split, phase dependencies, and durable handoff. Use for implementation, migration, sensitive-source activation, architecture, documentation reconciliation, PR continuation, or choosing the next bounded Developer Lens slice.
---

# Developer Lens Continuation

Use the repository's tracked sources rather than caching project state in this skill.

## Resume from truth

1. Read `CLAUDE.md` (shared canon), `AGENTS.md`, `.agent-harness/tier.json`, and `HUMAN_TODO.md`
   completely.
2. Refresh Git status, upstream, worktrees, open PRs, checks, and unresolved review threads.
3. Read `docs/analyser-program/CURRENT_STATE.md` for the live state and exact resume point (the
   single resume artifact); `docs/IMPLEMENTATION_LEDGER.md` is the historical evidence archive.
4. Read only the objective-relevant charter, capability matrix, architecture, README, code, and
   tests. Do not recursively inspect generated or private paths.
5. Correct stale live-state or owner-gate prose in the same bounded slice when authorized.

## Route information correctly

- Put owner decisions and genuinely open gates in `HUMAN_TODO.md`.
- Put privacy classes, retention, migration and sink rules in `docs/data-charter.md`.
- Put source purpose, consent, retention, deletion and refusal in
  `docs/source-capability-matrix.md`.
- Put stable design and dependency order in `docs/DEVELOPER_LENS_V2_ARCHITECTURE.md`.
- Put current commits, verification, failures, residual risk and next slice in
  `docs/IMPLEMENTATION_LEDGER.md`.
- Put user-facing product/run instructions in `README.md`.
- Do not turn an execution prompt into a competing source of truth.

## Select and bound the slice

1. Prefer the first dependency-safe incomplete product slice in
   `docs/analyser-program/CURRENT_STATE.md`; the ledger is history, never the task source.
2. State objective, owned paths, non-goals, acceptance behavior, rollback and focused checks.
3. For a decomposable queue, discover the live collaboration ceiling, fill every useful Luna slot
   with a unique disjoint lane, and replenish slots as results arrive. Keep one writer per checkout;
   parallel write lanes require separate coordinator-owned worktrees and non-overlapping paths.
   Escalate judgment-heavy implementation or review to Terra/Sol.
4. Use invented fixtures first. An approved real migration or sensitive-source task must still
   define exact local scope, read-only credentials, retained fields, coverage behavior, deletion,
   rollback and failure tests before activation.
5. Treat missing permission or censored history as explicit coverage, never zero activity.
6. For external-model work, stay inside the approved OpenAI/Luna data-charter boundary and keep
   `cap.external.model` `never_authorized` until a bounded default-off implementation and exact-head
   proving gate pass. Approval never authorizes an unreviewed payload.

## Protect the boundaries

- Never inspect or publish `.developer-lens/`, generated/private datasets, credentials, browser
  profiles, caches, local paths, or real inputs unless a current task card explicitly authorizes
  the exact read boundary; never track them.
- Keep public Pages and showcase constructors C0-only. Run `npm run build:showcase` when a changed
  seam can reach public/demo/export data or verification.
- Preserve repository and person identities inside their declared local boundary. No person score,
  surveillance metric, raw source/prose, or prohibited capability may be introduced.
- Permission to implement a capability never implies automatic collection, credential changes,
  external writes, or public/private-data publication.

<!-- shared:continuation-friction-tasking-v1 start -->
Every material workaround, tooling hiccup, repeated friction or surprising divergence is logged in
docs/agent-system/FRICTION_LOG.md in the same hop and linked to an existing issue/card or durable
task. Capture is not permission to widen scope; never record PID, absolute local path, token, or
private identifier.
<!-- shared:continuation-friction-tasking-v1 end -->

## Prove and hand off

1. Run the narrow test from the `CLAUDE.md` run-and-prove table, then `npm run check` for a
   code/config milestone.
2. Run `npm run verify:context` for docs, authority, prompt, or skill changes.
3. Review the exact diff against the charter and matrix; use one fresh-context adversarial pass for
   non-trivial privacy or logic work.
4. Update the ledger at a milestone, not after every tool call. Keep live GitHub facts refreshable.
5. Report changed, verified, NOT verified, failures/workarounds, docs-state sync, residual risk,
   human actions, exact branch/HEAD/PR/check/worktree state, and the next bounded slice.
