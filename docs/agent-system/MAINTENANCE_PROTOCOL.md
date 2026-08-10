# Maintenance protocol

Recurring repository, GitHub, administration and release checks. "Recurring" means every relevant
fresh session, every pre-release session, or an explicitly scheduled GitHub Actions run — nothing
here executes on its own. Loop context: [README.md](README.md). Routing:
[WORK_CLASSES.md](WORK_CLASSES.md).

## Git and GitHub hygiene

- **Branches.** List merged remote branches and delete only branches whose PR is merged and which
  are not a base of an open stacked PR. Never `--delete-branch` a stacked base — it cascade-closes
  children unreopenably.
- **Worktrees.** Inventory with `git worktree list`. Removal is **coordinator-owned**: a session
  cannot delete its own working directory, and only clean coordinator-created worktrees may be
  removed (plain `git worktree remove`, never `--force` — a refusal means work is still inside).
  Before removal run `git status --porcelain --ignored` and copy anything that must survive out
  first, since removal deletes gitignored files.
- **Leaked local processes and orphan directories are human actions.** The q-8 class of hazard —
  a leaked agent session still executing, a surviving dev server blocking a worktree removal, an
  orphaned partial worktree directory outside the project, a concurrent writer in the sibling lab
  checkout — cannot be verified or closed by an agent. Record the exact observation in
  [HUMAN_TODO.md](../../HUMAN_TODO.md) under q-8 and continue other work. **While q-8 says so, all
  write work and all merges in the `developer-lens-lab` checkout stay human-gated**; a competing
  writer in the same working directory can corrupt a branch mid-slice.
- **Repository settings.** Verify branch protection still requires `Prove the pull request` on
  `main`; verify squash-merge stays disabled. Record what was read; never infer a setting.
- **Structured pull-request evidence.** Use the report-only default
  `npm run governor:github -- snapshot --repo <owner/repo> --pr <N>` instead of embedding GraphQL or
  `jq` string literals in a PowerShell native-command argument. Add `--expect-head <full-sha>`,
  `--expect-base <full-sha>`, `--require-check <exact-name>`, `--require-no-unresolved`, and
  `--require-no-closing-issues` when those are actual gates. The helper passes GraphQL variables as
  JSON through stdin, launches `gh` without a shell, validates typed response fields, and fails
  closed if any bounded comment/review/check connection is paginated. It is strictly report-only:
  GitHub's review-thread reply mutation has no expected-head/base operand, so a preflight snapshot
  cannot make that later write exact-revision safe. Perform legitimate review replies through the
  normal reviewed GitHub workflow; this helper never writes.

## PR lifecycle and aging

Aligned with the `review_timing_defect` block in
[docs/analyser-program/CURRENT_STATE.md](../analyser-program/CURRENT_STATE.md), which is the
binding statement; this section is its operational form.

1. Publish ready-for-review, never parked in draft; draft only while the work is still being
   written.
2. Every pushed head ages **at least 3 minutes** before merge. This is a merge-eligibility floor,
   not a polling schedule.
3. Measured 2026-08-05: the Codex connector consistently posts review comments **3–10 minutes
   after** a push, including after merge. So do not merge until either (a) the Codex review for the
   **exact final head** has arrived and every finding is fixed, tracked or rejected, or (b) **15
   minutes** have passed since the LAST push with a fresh sweep showing no new review.
4. **Any fix push restarts that 15-minute clock** and re-scopes the proof: re-run the checks that
   exercise what changed. A base change (retarget, or a landed stack base) counts as a head change.
5. **Two fix rounds are the ceiling.** Later findings are still triaged, but post-ceiling defects
   are tracked or declined and the sound slice ships; only a NEW CRITICAL introduced by the fixes
   reopens the pipeline, once.
6. **Post-merge sweep is mandatory.** After merge, wait past the measured delay and re-read the
   thread. An "empty late-comment sweep" performed before the bot posts is not evidence of a clean
   review. Confirmed defects get the smallest follow-up PR, linked from the original thread;
   non-blocking feedback gets a reply or an issue.
7. Merge with a merge commit, never squash. In a stack, merge the oldest first and confirm each
   retarget via the API before merging children.

## Issue taxonomy upkeep

Labels in use: `now` · `next` · `later` · `idea` · `agent-generated` · `owner-gated` ·
`human-action` · `product` · `lab` · `cross-repo` · `release` · `experimental` ·
`horizon:active` · `horizon:frozen` (14 total). Milestone creation is currently blocked by the
floor guard on `gh api` mutations; labels plus `docs/PROGRAMME_ROADMAP.md` carry phase structure.

Each sweep: every open issue carries exactly one queue-position label (`now`/`next`/`later`/`idea`);
`agent-generated` accompanies `idea` for agent-originated proposals
([IDEA_PROTOCOL.md](IDEA_PROTOCOL.md)); `owner-gated` and `human-action` items have a matching entry
in `HUMAN_TODO.md` and vice versa; `cross-repo` items name their counterpart
([CROSS_REPO_CONTRACT.md](CROSS_REPO_CONTRACT.md)); closed-but-stale acceptance criteria are
reconciled against [docs/PROGRAMME_ROADMAP.md](../PROGRAMME_ROADMAP.md) rather than re-litigated.
Milestones track roadmap phases, not individual slices.

## Prompt-parity and friction burn-down

Both are cheap to check and expensive to discover late.

- **Prompt parity.** `npm run verify:context` is the whole check: it parses
  [PROMPT_LIBRARY.md](PROMPT_LIBRARY.md), confirms the twelve common IDs and this repository's
  extension IDs are present exactly once and in manifest order, recomputes each shared block's
  SHA-256 against [.agent-harness/prompt-parity.json](../../.agent-harness/prompt-parity.json),
  confirms every active body carries exactly one copy of each block, rejects a bare `q-N`, and
  rejects an executable `prompt-id` marker in any document other than the library. A digest
  mismatch means a block was edited in one place — fix the divergence, do not re-pin the manifest
  to whatever the library happens to say.
- **Cross-repository parity.** The manifest is repo-neutral and byte-identical on both sides. A
  shared-block edit is a `cross-repo` change: it lands with the same bytes in
  `Chris0Jeky/developer-lens-lab` under [CROSS_REPO_CONTRACT.md](CROSS_REPO_CONTRACT.md), and while
  `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-8` stays open the lab side is prepared and parked,
  never merged by an agent.
- **Friction burn-down.** Each sweep, read [FRICTION_LOG.md](FRICTION_LOG.md) end to end and check
  that every `open` and `workaround-documented` entry still has a live linked task, that no entry
  was marked `resolved` by inference (age, a merged PR and a quiet session are not proof), and that
  any entry now at two independent occurrences has had its promotion decision recorded — the
  cheapest enforcing layer, or the reason it stays task debt. The burn-down prompt is
  `DL-P12-FRICTION-BURNDOWN`. Human-only friction stays `owner-gated` and keeps its `HUMAN_TODO.md`
  link live.

## Dependency-alert triage

For each open alert: identify the vulnerable package and version, determine whether the vulnerable
path is **reachable** in this repository (runtime, build-only, or test-only), assess release
impact, and choose one of upgrade now / upgrade with the next release batch / not reachable, record
why. Every outcome becomes a bounded issue or a one-line disposition — never a silent dismissal.
Bounded triage of all outstanding alerts is a release precondition (owner decision H6).

## Release and packaging checklist

Version comes from [docs/PROGRAMME_ROADMAP.md](../PROGRAMME_ROADMAP.md), not from ad-hoc judgment.

1. Roadmap phase and version number confirmed; both repositories agree on sequencing.
2. Full gate green at the exact tag head (`npm run check`), plus `npm run build:showcase` when any
   public, demo or export seam moved.
3. Changelog and release notes written from merged PRs, with the user-visible result stated and no
   claim the evidence does not support.
4. **Public release assets are C0 invented-only.** Verify every published JSON/HTML asset against
   the showcase privacy path; private outputs stay local, always.
5. Generated-contract drift checks clean (`npm run check:research-pack`,
   `npm run check:method-trial-view`).
6. Rollback notes: how to un-publish or supersede the release, what a consumer should pin instead,
   and what deletion or retention behaviour the release changed.
7. Repository descriptions, topics and social preview updated; owner-only items (profile pins,
   portfolio, aesthetic sign-off) recorded in `HUMAN_TODO.md`.
8. Post-release: watch for issues, sweep the release PR threads past the measured review delay.

## Session health report

Emit at any point in a session; twelve lines, no narrative:

1. `main` head and latest release/tag.
2. Active focused wave (lanes, owners, stop conditions).
3. Open PRs with check state and aging position.
4. Late-review watch: heads inside the window, heads swept.
5. Stale state or docs found, and whether repaired.
6. Generated-contract drift status.
7. Outstanding dependency alerts.
8. Release readiness against the roadmap.
9. Open owner actions in `HUMAN_TODO.md`.
10. Cross-repo status and any pending handshake.
11. Top blockers.
12. Top three recommended next moves.
