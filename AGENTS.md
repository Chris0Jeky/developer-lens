# Developer Lens — Codex adapter

`CLAUDE.md` is the shared repository canon: identity, cold start, source-of-truth map, authority
boundary, protected-data rule, run/prove table, and repository map live there. Read it first and
treat it as binding; this file adds only Codex-runtime deltas. `npm run verify:context` enforces
parity between the two.

## Authority summary (full text in `CLAUDE.md` and `HUMAN_TODO.md`)

- G1 and G2 are owner-approved; the existing charter lifetimes and copy-based seven-day migration
  protocol bind.
- G3 is standing-approved for the named, reviewed sources in the capability matrix; executable
  definitions stay `never_authorized` until a bounded activation task implements and tests them.
- G4 is owner-approved only for OpenAI `gpt-5.6-luna` inside the exact data-charter boundary;
  `cap.external.model` stays `never_authorized` until a bounded default-off implementation and
  exact-head gate pass.
- The public `origin` route carries code, tests, docs, and invented synthetic assets only.

## Codex continuation

Invoke `$developer-lens-continuation` for implementation, migration, sensitive-source,
architecture, documentation-reconciliation, or handoff work.

## Codex swarm routing

For decomposable work, discover the live collaboration ceiling and keep every useful Luna slot
occupied from a deduplicated queue of disjoint bounded lanes; replenish slots as results arrive and
never hard-code a smaller normal fleet. Use one writer per checkout; parallel writers require
separate coordinator-owned worktrees and non-overlapping paths. Escalate judgment-heavy
implementation or review to Terra/Sol.

## Prove and close

Use the run-and-prove table in `CLAUDE.md`. Close under changed / verified / NOT verified /
failures and workarounds / docs-state sync / residual risk / human actions / exact resume point.
