# Developer Lens repository governor — operating model

The governor is how any capable orchestrator turns owner policy into finished, proven repository
work without inventing a second source of truth. It is a loop plus a routing table, not a service:
**nothing here runs by itself.** "Periodic" means every relevant fresh session, every pre-release
session, or an explicitly scheduled GitHub Actions run — never background cognition between
sessions.

Authority stack, strongest first: [docs/OWNER_CONSTITUTION.md](../OWNER_CONSTITUTION.md) (strategic
policy) · [.agent-harness/tier.json](../../.agent-harness/tier.json) (repository authority, T2 +
`sensitive_data`) · [HUMAN_TODO.md](../../HUMAN_TODO.md) (open owner gates only) ·
[CLAUDE.md](../../CLAUDE.md) / [AGENTS.md](../../AGENTS.md) (agent canon and Codex adapter) ·
[docs/analyser-program/CURRENT_STATE.md](../analyser-program/CURRENT_STATE.md) (the single live
resume artifact) · [docs/IMPLEMENTATION_LEDGER.md](../IMPLEMENTATION_LEDGER.md) (history).

Machine-readable policy: [.agent-harness/governor.yaml](../../.agent-harness/governor.yaml).
Companions: [WORK_CLASSES.md](WORK_CLASSES.md) (risk classes and model routing) ·
[PROMPT_LIBRARY.md](PROMPT_LIBRARY.md) (cold-start prompts) ·
[MAINTENANCE_PROTOCOL.md](MAINTENANCE_PROTOCOL.md) (recurring checks) ·
[IDEA_PROTOCOL.md](IDEA_PROTOCOL.md) (agent-generated ideas) ·
[CROSS_REPO_CONTRACT.md](CROSS_REPO_CONTRACT.md) (product/lab handshake) ·
[docs/PROGRAMME_ROADMAP.md](../PROGRAMME_ROADMAP.md) (phases and issue dispositions).

`.agent-harness/runtime/` is a **gitignored cache** — last refresh times, inspected heads, pending
review windows, temporary lane ownership. It is never authority. Losing it must leave the
repository fully resumable from the tracked files above; if a session ever depends on it, that
dependency is the bug.

## The loop

Nine phases. A short session may compress D–F, but A, B, G, H and I are never skipped.

**A — SENSE.** Refresh live evidence before reading any recorded claim: `git status`, branch,
remotes, worktrees, recent commits; `origin/main` head; open PRs with checks, changed files and
mergeability; unresolved and late review threads; recently merged PRs and their post-merge
comments; issues, labels, milestones, dependencies; Actions and Pages; releases, tags and package
version; dependency alerts; branch protection where readable; stale branches and abandoned
worktrees; generated-contract drift (`npm run check:research-pack`,
`npm run check:method-trial-view`); context integrity (`npm run verify:context`); cross-repo
compatibility state. Label every statement as **verified live fact**, **repository-recorded
claim**, **inference**, **owner decision**, or **recommendation** — and never silently promote one
to another.

**B — RECONCILE.** Compare live truth against constitution, tier, `HUMAN_TODO.md`, canon,
`CURRENT_STATE.md`, backlog, workflows, release metadata and cross-repo contracts. Produce a
compact list: contradictions needing immediate correction, blockers, stale records, completed work
still marked active, work marked complete but unmerged or unproven, owner decisions not yet
unpacked, untracked administrative obligations, newly arrived late-review findings. A false claim
in a tracked file outranks new feature work — repair it first.

**C — CLASSIFY.** Sort every candidate into product value · research support · cross-repo
compatibility · maintenance/correctness · administration/GitHub · release/distribution ·
dependency/supply chain · documentation/state · incident/CI repair · idea/proposal ·
owner/legal/physical. Then assign a risk class (G0–G4) and model route from
[WORK_CLASSES.md](WORK_CLASSES.md).

**D — PRIORITISE.** Bias by the owner focus weights (research 7, story/product 5, distribution 3,
community 2, standalone real-data activation 0), then score on user/research value, urgency,
dependency centrality, reversibility, evidence strength, effort, cross-repo leverage, release
impact, risk, owner interest, and whether the work closes a false or stale claim. Easy hardening is
easy to enumerate; do not let it crowd out visible value.

**E — SELECT A WAVE.** Two layers, always:

- **Opportunity backlog** — GitHub issues, unlimited, labelled `now`/`next`/`later`/`idea`/
  `agent-generated`/`owner-gated`/`human-action`/`product`/`lab`/`cross-repo`/`release`/
  `experimental`. Never paste it into a tracked file.
- **Focused wave** — the small set executing now, recorded in `CURRENT_STATE.md`. Each lane names
  mission, owner/model, checkout or worktree, owned paths, dependencies, merge order, acceptance
  checks and stop condition. No fixed numeric cap; parallelism is chosen from collision risk,
  proof cost and dependency structure, never from a wish to run more agents.

**F — DELEGATE AND EXECUTE.** One writer per checkout. Parallel writers get separate
coordinator-owned worktrees with non-overlapping paths. Pin the starting head and expected base in
every delegation prompt, and re-verify branch and HEAD after each subagent returns — subagents can
move HEAD. Separate discovery from implementation when uncertainty is material. Prefer vertical
batches with a direct consumer over ceremony-only micro-PR chains, and never build control-plane
infrastructure without a consumer that uses it.

**G — PROVE.** Narrowest first, from the run-and-prove table in [CLAUDE.md](../../CLAUDE.md):
`npm run test:demo:v2` for the offline V2 UI, `npm test -- <explicit-test-path>` for a server or
contract seam, `npm run verify:context` plus `git diff --check` for docs/authority/skills,
`npm run build:showcase` for the public/demo/export seam, and `npm run check` for any code or
config milestone. Also verify: generated artifacts regenerate clean, protected-data canaries hold,
public showcase output stays C0 invented-only when touched, cross-repo compatibility when a shared
contract moved, no unrelated worktree or user change was lost, and no background process was left
running.

**H — REVIEW AND MERGE.** One fresh-context adversarial review against the **exact final head** for
non-trivial work; documentation-only or very-low-risk work may rest on a clean connector outcome.
Two fix rounds are the ceiling. Timing gates are binding and stated once in
[MAINTENANCE_PROTOCOL.md](MAINTENANCE_PROTOCOL.md). Merge only after refreshing base and head,
confirming the required `Prove the pull request` check green at that head, resolving conflicts,
reviewing the changed-file list, dispositioning every review thread, honouring dependency and merge
order, proving contract compatibility, and confirming repository authority permits it. Merge with a
merge commit — never squash. After merge: refresh `main`, sweep for late comments, open the
smallest follow-up PR only for a confirmed defect, remove clean coordinator-owned worktrees, and
preserve dirty or unrelated ones.

**I — RECONCILE AND LEARN.** Update `CURRENT_STATE.md` (wave, lanes, blockers, exact next action),
append evidence to the ledger, update issues and labels, update release notes or version when
relevant, record failures and workarounds, and stop background agents and servers. Then look at
where the session was surprised: repeated review findings, stale-state causes, PR collisions,
unnecessary micro-PRs, failed delegations, over- or under-specified prompts, wasted tool calls,
unhelpful generated ideas, work that produced little value. Turn a **recurring** pattern into one
small reviewed governor revision — never rewrite the system after a single anecdote.

## Trigger matrix

| Trigger | Required governor action |
|---|---|
| New session | Full Sense + Reconcile pass before any write |
| PR opened or updated | Re-check scope, dependencies, CI, review state and aging |
| PR merged | Refresh `main`, watch for late comments, reconcile state and ledger |
| CI failure | Classify regression vs environment vs stale generated output; seed a bounded repair |
| Review comment after merge | Validate, then fix in the smallest follow-up PR or track — never silently drop |
| New dependency alert | Triage reachability and release impact; create or update one bounded issue |
| New owner decision | Update the constitution and reconcile every conflicting surface |
| Contract or schema change | Run the cross-repo compatibility lane before merging either side |
| Release requested | Run the release/admin/packaging/security/community checklist |
| No active wave | Maintenance, admin and idea triage — do not invent high-risk architecture |
| Backlog growth | Deduplicate, cluster and critic-review ideas; keep `CURRENT_STATE.md` compact |
| External API/model assumption used | Verify the current official identifier, terms and pricing before execution |
| Dirty or stale worktree found | Preserve it; classify owner vs coordinator ownership before any cleanup |
| Human-only task encountered | Record the exact action in `HUMAN_TODO.md` and continue independent work |

## Self-evolution and its boundaries

The governor may evolve, through ordinary reviewed changes: prompts, routing heuristics, risk
examples, checklists, issue taxonomies, generated indexes, maintenance triggers, report formats,
model fallback mappings, context budgets, parity checks, and its own orchestration efficiency.

Without new owner authority it may **not** weaken: the secret prohibition; missingness honesty
(missing, censored, refused, stale or deleted evidence is never zero); the deterministic-fallback
requirement; model-output labelling; private-output locality; the merge and review gates;
owner-only decision classes; or the public/private publication rules. Those are locked in
[docs/OWNER_CONSTITUTION.md](../OWNER_CONSTITUTION.md) §1 and §7. A governor change that relaxes
any of them is out of scope for every agent, at every tier, and must be escalated to the owner
instead.

Changes to `governor.yaml`'s `governor_schema_version` ride the normal review gate, never a
drive-by edit.

## Session health report

Every governor session should be able to emit this, cheaply, at any point:

1. Current `main` head and latest release/tag.
2. Active focused wave — lanes, owners, stop conditions.
3. Open PRs with check state and aging position.
4. Late-review watch: which heads are inside the window, which were swept.
5. Stale state or docs found, and whether repaired.
6. Generated-contract drift status.
7. Dependency alerts outstanding.
8. Release readiness against [docs/PROGRAMME_ROADMAP.md](../PROGRAMME_ROADMAP.md).
9. Open owner actions in `HUMAN_TODO.md`.
10. Cross-repo status and any pending handshake.
11. Top blockers.
12. Top three recommended next moves.

Close every session under the repository's standard headings: changed / verified / NOT verified /
failures and workarounds / docs-state sync / residual risk / human actions / exact resume point.
