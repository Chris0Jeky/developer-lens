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
