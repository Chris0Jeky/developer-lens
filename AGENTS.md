# Developer Lens — Codex adapter

`CLAUDE.md` is the shared repository canon: identity, cold start, source-of-truth map, authority
boundary, protected-data rule, run/prove table, and repository map live there. Read it first and
treat it as binding; this file adds only Codex-runtime deltas. `npm run verify:context` enforces
required files, authority markers, links, and budgets in both (not full-text parity).

## Authority summary (full text in `CLAUDE.md` and `HUMAN_TODO.md`)

- G1 and G2 are owner-approved; the existing charter lifetimes and copy-based seven-day migration
  protocol bind.
- G3 is standing-approved for the named, reviewed sources in the capability matrix; executable
  definitions stay `never_authorized` until a bounded activation task implements and tests them.
- G4 is owner-approved only for OpenAI `gpt-5.6-luna` inside the exact data-charter boundary;
  `cap.external.model` stays `never_authorized` until a bounded default-off implementation and
  exact-head gate pass.
- The public `origin` route carries code, tests, docs, and invented synthetic assets only.

## Protected data (full rule in `CLAUDE.md`)

Default to invented fixtures. Never inspect `.developer-lens/`, generated `public/data/`, `dist/`,
credentials, browser profiles, caches, or real/private inputs during ordinary work; never track or
publish them.

## Codex continuation

Invoke `$developer-lens-continuation` for implementation, migration, sensitive-source,
architecture, documentation-reconciliation, or handoff work.

## Governor operating system

The repository governor (sense → reconcile → classify → prioritise → select → delegate → prove →
merge → learn), work classes W0–W4, prompt library (including Governor Lite for non-flagship
orchestrators), and cross-repo contract live under `docs/agent-system/` with machine-readable
policy in `.agent-harness/governor.yaml`. Binding owner policy: `docs/OWNER_CONSTITUTION.md`.
Codex Sol/Luna/Terra specialisation maps onto the same work classes.

## Prompt operating system

`docs/agent-system/PROMPT_LIBRARY.md` is the **only** executable prompt surface. Every other
prompt-shaped document in the repository is classified `redirect` or `historical` and must not be
pasted into a session; `npm run verify:context` enforces the classification. The twelve common
`DL-P01`…`DL-P12` IDs are shared byte-for-byte with `Chris0Jeky/developer-lens-lab`, and the two
shared blocks (`runtime-bootstrap-v1`, `friction-tasking-v1`) are hash-pinned in
`.agent-harness/prompt-parity.json` — edit a block once in the library, recompute its digest, and
update every prompt plus the manifest in the same commit.

Foundation rules that bind every runtime:

- **Cite human actions as fully qualified refs** — `<owner>/<repo>::HUMAN_TODO.md::q-N`. A bare
  `q-N` is ambiguous because product `q-8` and lab `q-8` are different gates, and the verifier
  rejects one inside an active prompt body.
- **No silent workarounds.** Log every material workaround, tooling hiccup, repeated friction or
  surprising divergence in `docs/agent-system/FRICTION_LOG.md` in the SAME hop, linked to an
  existing issue or a durable follow-up task, with no process ID, absolute path or private
  identifier. Capture is not permission to detour: log it, link it, continue the slice. At the
  second independent occurrence, choose the cheapest layer that actually enforces the fix, or
  record why it stays task debt.
- **Continuous runs follow `docs/agent-system/CONTINUOUS_WORK_PROTOCOL.md`** — deterministic queue
  hopping, the anti-manufacture legitimacy test, work-while-waiting during passive review windows,
  fan-out bounded by useful disjoint work rather than a target agent count, and the four explicit
  stop conditions. An unattended session never activates real-data collection, an external model,
  telemetry or credential handling, and terminates factually rather than inventing work.

## Codex swarm routing

For decomposable work, discover the live collaboration ceiling and keep every useful Luna slot
occupied from a deduplicated queue of disjoint bounded lanes; replenish slots as results arrive and
never hard-code a smaller normal fleet. Use one writer per checkout; parallel writers require
separate coordinator-owned worktrees and non-overlapping paths. Escalate judgment-heavy
implementation or review to Terra/Sol.

## Prove and close

Use the run-and-prove table in `CLAUDE.md`. Close under changed / verified / NOT verified /
failures and workarounds / docs-state sync / residual risk / human actions / exact resume point.
