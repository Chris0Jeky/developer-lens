# Friction log

The repository's record of what keeps costing sessions time. It exists because a workaround that is
only remembered is a workaround that will be rediscovered — expensively — by the next session.

Foundational rule (`friction-tasking-v1`, carried verbatim by every active prompt in
[PROMPT_LIBRARY.md](PROMPT_LIBRARY.md)):

> Every material workaround, tooling hiccup, repeated friction or surprising divergence is logged
> here in the SAME hop, and linked to an existing issue or card or given a durable follow-up task.
> Capture is not permission to detour: log it, link it, continue the slice. At the second
> independent occurrence, choose or propose the cheapest layer that actually enforces the fix, or
> record why it stays task debt.

Burn-down prompt: `DL-P12-FRICTION-BURNDOWN`. Loop context: [README.md](README.md). Recurring
checks: [MAINTENANCE_PROTOCOL.md](MAINTENANCE_PROTOCOL.md). Continuous execution:
[CONTINUOUS_WORK_PROTOCOL.md](CONTINUOUS_WORK_PROTOCOL.md).

## Schema and rules

This log is **append-only**. New entries are added at the end with the next free `FR-NNN`. An
existing entry is never deleted or rewritten; only its `status`, `occurrences`, `task` and
`promotion` fields may change, and a substantive change adds a dated note under the entry.

Each entry carries the required fields below. `severity` is optional; when present it records the
bounded consequence of the observed friction without changing the status or promotion rules.

| Field | Meaning |
|---|---|
| `id` | `FR-NNN`, assigned in order, never reused. |
| `first-seen` | ISO date of the first recorded occurrence. |
| `status` | `open` · `workaround-documented` · `promoted` · `owner-gated` · `resolved`. |
| `severity` | Optional factual impact classification, including whether the effect is blocking. |
| `symptom` | What was observed, factually, without inference. |
| `impact` | What it costs a session when it happens. |
| `workaround` | What was actually done instead, or `none`. |
| `occurrences` | Count plus the dates or artifacts that record them. |
| `task` | The linked issue, card or owner action — a fully qualified ref for anything cross-repository or human-only. |
| `promotion` | The enforcement layer chosen, or the recorded reason it stays task debt. |

Rules that bind entries:

1. **Never mark an entry `resolved` by inference.** Age, a merged pull request, a quiet session, or
   another agent's prose are not proof. Resolution needs a passing check, an enforced rule, or an
   inspected setting, and the proof is named in `promotion`.
2. **Human-only friction stays `owner-gated`** — local machine hygiene, credentials, legal and
   aesthetic sign-off cannot be closed by an agent. Keep the `HUMAN_TODO.md` link live.
3. **No volatile detail.** No process IDs, absolute local paths, tokens, or private identifiers.
4. **One occurrence is task debt, not a pattern.** Promotion is considered at the second
   independent occurrence, using the cheapest layer that actually enforces the fix: session memory
   → canon prose → agent/skill definition → executable check → CI → structural change. Prune the
   superseded copy in the same commit.
5. **A recurrence updates its canonical mechanism.** When an observed event matches an existing
   entry's symptom and workaround, update that entry's permitted `occurrences`, `task`, or
   `promotion` fields and add a dated note. Preserve any superseded entry as an explicit
   consolidated pointer with its immutable event/ID; do not create a fresh single-occurrence
   mechanism that hides a promotion trigger.

## Entries

### FR-001 — concurrent or leaked agent session writing a live checkout

- **first-seen:** 2026-08-04
- **status:** `promoted`
- **symptom:** A handed-off session kept executing after handoff and merged a pull request itself,
  then collided in a worktree on another lane. Later, a lane worker's dev server survived its
  worker and blocked a worktree removal. Later still, a separate process ran `checkout main` plus
  `pull` inside the sibling `developer-lens-lab` working directory mid-slice (reflog-confirmed),
  briefly landing a worker's commits on `main` before the worker remediated them onto its branch.
- **impact:** A competing writer in the same working directory can corrupt a branch mid-slice. It
  also wastes RAM and usage, and it makes lane ownership unverifiable from inside a session.
- **workaround:** Product-side work continues normally; lab-side write work and **all** lab merges
  are treated as human-gated, and lab work is prepared and parked rather than merged. Isolated
  worktrees are used for preparation only — isolation does not make a *merge* safe while a
  competing writer can race the remote.
- **occurrences:** 9 recorded — 2026-08-04 (post-handoff session), 2026-08-04 (surviving dev server
  plus an orphaned partial worktree directory left for manual deletion), 2026-08-07 (lab checkout
  competing writer), 2026-08-09 (a separate coordinator advanced the active q-8 branch between
  this session's read and attempted write), 2026-08-10 (a concurrent post-merge comment assigned
  the PR #238 merge to an external context after this coordinator had issued it), 2026-08-10 (two
  later PR #237 P2 threads were replied to and resolved after this coordinator parked the PR).
  2026-08-15 (guarded delegate observed a pre-existing friction-log modification and relinquished
  the occupied worktree after the intended correction appeared at a new remote head).
- **task:** `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-8` (closed owner decision) and
  [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) (live release coordination).
- **promotion:** The physical process-cleanup half remains owner-only (W4); the owner confirmed its
  clean sweep and closed q-8 on 2026-08-09. The collision half is promoted to the one-writer,
  pinned-head, and refresh-before-mutation rules in the canon and continuous-work protocol. The
  append-only `workaround` field above records the historical product-q-8 posture and is not a
  current parking instruction. Current guidance is one writer per checkout, separate
  coordinator-owned worktrees for non-overlapping parallel lanes, live refresh before mutation,
  and relinquishment on unexpected ownership or head movement. The original Lab gate was also stated in
  [MAINTENANCE_PROTOCOL.md](MAINTENANCE_PROTOCOL.md), [CROSS_REPO_CONTRACT.md](CROSS_REPO_CONTRACT.md)
  and every active prompt's LAB RULE line while q-8 was open; it no longer binds after the owner's
  closure.

  **2026-08-09 note:** During the q-8 pull-request fix round, an owner-account review comment appeared
  that neither read-only delegated reviewer had posted. A separate coordinator then advanced the
  active q-8 branch between this session's read and attempted patch. The patch failed on its context
  check before writing, this session relinquished that worktree, and no work was overwritten. This
  does not reopen q-8 or prove a leaked process; it proves that active PR ownership was not visible
  across coordinators. The enforced response is to treat an unexpected head/write event as foreign
  ownership, refresh live state, and never race the writer. Issue #200 carries the live release-wave
  coordination context.

  **2026-08-09 note (post-merge wording review):** The original `workaround` is retained verbatim
  because this log is append-only. Its all-Lab-parking instruction applied only while
  `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-8` was open and is superseded by the current
  `promotion` guidance after that gate's confirmed closure.

  **2026-08-10 note (PR #238 operation context):** This coordinator issued the exact-head REST
  merge for `b08a4022550396b4da0aab877d942a433291253c` and GitHub returned merge commit
  `e3ce2f879eee00f49e398116be428a6a7c7c8d2b`. A later owner-account comment called the merge
  external; comment `5235026214` corrects that claim without inferring which process wrote the
  earlier comment. Its independently measured T+10m22 clean sweep remains valid. The selected
  ownership/context enforcement stays on #200; no duplicate taxonomy or ref rewrite is needed.

  **2026-08-10 note (parked PR #237 thread triage):** Two late connector P2s appeared after PR #237
  was closed; the next live read found owner-account replies and both threads resolved even though
  this coordinator had not issued those replies. Their classifications are sound and do not reopen
  the parked PR. The process identity remains unobservable, so the record preserves only the
  operation divergence and the same #200 ownership/context enforcement.

  **2026-08-15 note (overlapping friction worktree):** The initial clean fast-forward was read-only
  cold-start context only. The countable event was the later primary Product advance while an
  overlapping friction worktree was present after PR #265 merged. The coordinator relinquished the
  primary and overlap role; no tracked work was lost. It is recorded by
  [Product issue #222 comment 5303399568](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303399568).

  **2026-08-15 ownership note:** A guarded delegate at
  `docs/record-post268-friction-20260815` / `6e90dec` found a pre-existing `FRICTION_LOG.md`
  modification, made no write, and stopped. Immediate refresh found clean new commit `934ed23`
  with the intended one-line correction; the remote branch later advanced to that exact head before
  this governor's guarded push. Ownership cannot be inferred, no work was lost, and the occupied
  worktree was relinquished. This complete chain is one new occurrence, recorded by
  [Product #200 comment 5304291181](https://github.com/Chris0Jeky/developer-lens/issues/200#issuecomment-5304291181)
  and [Product #200 comment 5304325128](https://github.com/Chris0Jeky/developer-lens/issues/200#issuecomment-5304325128).
  It does not prove a leaked process: `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-8` remains
  closed and normal Lab gates remain in force.

  **2026-08-15 moved-base integration note:** A guarded fetch observed PR #274 main movement
  before any push, pull-request body, or reply mutation. No work was lost, ownership is not
  inferred, and q-8 does not reopen; explicit main integration and reproof followed. This ninth
  occurrence is recorded by [Product #200 comment
  5304579614](https://github.com/Chris0Jeky/developer-lens/issues/200#issuecomment-5304579614).

### FR-002 — review connector misses or lands late on an exact head

- **first-seen:** 2026-08-05
- **status:** `promoted`
- **symptom:** Measured 2026-08-05: the Codex connector consistently posts review comments 3–10
  minutes after a push, including after merge, so an immediate post-merge sweep can read as clean
  when no review has been posted yet. Observed again 2026-08-08 on PR #211, where the connector
  produced no review at all within 60+ minutes.
- **impact:** Either untriaged findings after merge, or an indefinite wait on a review that never
  arrives.
- **workaround:** Merge only after the exact-final-head connector review is triaged **or** 15
  minutes have passed since the last push with a fresh clean sweep; any fix push restarts that
  clock. One fresh-context independent review carries the gate when the connector is silent. Sweep
  each merged thread again past the measured delay.
- **occurrences:** 3 recorded classes — the 2026-08-05 measurement (which produced 20 late comments
  across earlier pull requests), the 2026-08-08 total miss on PR #211, and the 2026-08-15 late
  review on PR #266.
- **task:** [#208](https://github.com/Chris0Jeky/developer-lens/issues/208) (review-surface
  follow-ups) and [#214](https://github.com/Chris0Jeky/developer-lens/issues/214) (this prompt
  operating system).
- **promotion:** Promoted to policy and machine-readable config —
  `review_merge_protocol.late_review_fallback_minutes: 15` in
  [.agent-harness/governor.yaml](../../.agent-harness/governor.yaml), the PR-lifecycle section of
  [MAINTENANCE_PROTOCOL.md](MAINTENANCE_PROTOCOL.md), the binding `review_timing_defect` block in
  [CURRENT_STATE.md](../analyser-program/CURRENT_STATE.md), and the merge clauses of
  `DL-P01`/`DL-P03`/`DL-P08`. Not `resolved`: the connector behaviour itself is external and
  unchanged.

  **2026-08-15 late-review note:** Product PR #266 merged at
  `2026-08-15T17:47:37Z`; its exact-head Codex review for
  `3d1ffb0af5929ef2af51759dcc99d9349f492ecc` arrived at `2026-08-15T17:48:49Z` with a P2 split
  finding. The thread was replied to and left open for the bounded successor. This records a third
  late-review occurrence only; no runtime, data, or release harm is claimed. Product issue #222
  owns the connector follow-up.

### FR-003 — pull-request keywords auto-closed a live programme issue

- **first-seen:** 2026-08-08
- **status:** `open`
- **symptom:** Issue #200, the active P0.5 release programme, was closed automatically by a
  closing keyword in a pull-request body that referenced it for context rather than to complete it.
- **impact:** The active release programme briefly read as delivered; a session resuming from the
  issue list alone would have drawn the wrong conclusion about phase state.
- **workaround:** #200 was reopened; its open state is directly verified as of this entry.
- **occurrences:** 1 recorded — 2026-08-08.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) (reopened, still the
  active release programme).
- **promotion:** Task debt at one occurrence. Global law already warns that `Closes #N` fires even
  quoted or negated and requires verifying issue links after body edits; a second independent
  occurrence promotes it to an explicit pull-request-body review step in
  [MAINTENANCE_PROTOCOL.md](MAINTENANCE_PROTOCOL.md).

### FR-004 — pushes from inside a worktree are refused by the floor guard

- **first-seen:** 2026-08-08
- **status:** `workaround-documented`
- **symptom:** A `git push` issued from inside a registered worktree is denied by the repository
  floor guard, even for an ordinary scoped feature branch.
- **impact:** A worktree lane that is otherwise finished cannot publish its own branch, which can
  read as a failed lane rather than a tooling boundary.
- **workaround:** Publish the ref from the primary checkout instead — run the push with the primary
  checkout as the working directory, targeting the branch the worktree created. The commits already
  exist in the shared object store, so nothing needs to be copied.
- **occurrences:** 1 recorded.
- **task:** [#214](https://github.com/Chris0Jeky/developer-lens/issues/214) — recorded with this
  prompt operating system; a durable follow-up is opened if it recurs.
- **promotion:** Task debt at one occurrence; the publication route is documented here rather than
  encoded, because the guard is machine-level and correct — it is the publication *route* that
  needed writing down, not the guard that needed changing.

### FR-005 — `gh api` mutations are blocked, so milestones cannot be created

- **first-seen:** 2026-08-08
- **status:** `workaround-documented`
- **symptom:** Milestone creation requires a `gh api` mutation, which the floor guard blocks.
  Milestone structure therefore cannot be created by an agent.
- **impact:** Roadmap phase structure cannot be expressed as GitHub milestones during release and
  administration sweeps.
- **workaround:** Labels plus [docs/PROGRAMME_ROADMAP.md](../PROGRAMME_ROADMAP.md) carry phase
  structure; sweeps report the limitation explicitly rather than reporting an empty milestone list
  as an omission.
- **occurrences:** 1 recorded standing limitation, already noted in the issue-taxonomy section of
  [MAINTENANCE_PROTOCOL.md](MAINTENANCE_PROTOCOL.md) and in `DL-P09-RELEASE-CURATOR`.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) — release/administration
  programme that would consume milestones.
- **promotion:** Already promoted to prompt and protocol prose so a sweep cannot misreport it as an
  omission. Not `resolved`: the underlying capability is unchanged.

### FR-006 — long licence text tripped a content filter during the AGPL baseline

- **first-seen:** 2026-08-08
- **status:** `workaround-documented`
- **symptom:** Handling the full canonical AGPL-3.0-only licence body in one piece hit a content
  filter, so the licence could not be processed as a single block.
- **impact:** Licence verification is slower and easier to get subtly wrong, and an unverified
  licence body is not an acceptable release artifact.
- **workaround:** The committed 661-line canonical body was verified section by section rather than
  as one block, and the SPDX identifiers in the package manifest and lockfile root were checked
  separately.
- **occurrences:** 1 recorded — during the PR #209 AGPL baseline.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) — the release programme
  that owns licence artifacts.
- **promotion:** Task debt at one occurrence. The licence body is now committed and stable, so the
  cheapest future enforcement is a byte-level check of the committed file rather than re-deriving
  the text; that is only worth building if the licence is ever changed.

### FR-007 — delegated implementer hit a runtime timeout before writing a handoff

- **first-seen:** 2026-08-09
- **status:** `workaround-documented`
- **symptom:** A delegated `dl-implementer` lane on this prompt-operating-system slice reached a
  15-minute runtime execution limit and was cut off mid-slice. It had already written a coherent
  partial diff — six modified files and three new ones — but produced **no** handoff message, so
  none of the standard closing headings existed: no changed/verified list, no statement of what was
  left, no next step. The working tree was the only record of what the lane had done.
- **impact:** The coordinator inherits an undescribed dirty checkout. The tempting reactions are
  both wrong and both expensive: discarding the work throws away sound design, and blindly
  continuing risks building on a half-applied contract. The real cost is the audit needed to tell
  which of the two applies.
- **workaround:** Terminate the surviving owned process first so the checkout has exactly one
  writer, then **audit the dirty checkpoint before touching it** — read the full diff and each new
  file, run the repository's own verifier against the working tree, and only then decide. Here the
  checkpoint proved sound and passing, so it was preserved and committed as its own increment
  before new work continued, which keeps the timed-out lane's contribution separable in history.
  Resume with exactly one replacement writer on the same branch and HEAD; never reset, rebase or
  restart the design to reclaim a clean slate.
- **occurrences:** 1 recorded — 2026-08-09, during the #214 prompt operating system.
- **task:** [#214](https://github.com/Chris0Jeky/developer-lens/issues/214) — recorded with this
  prompt operating system; a durable follow-up is opened if it recurs.
- **promotion:** Task debt at one occurrence, and the enforceable half is small: a runtime limit is
  external and cannot be lengthened by an agent, so the fix is delegation shape, not tooling. The
  cheapest layer is prompt prose already present in `DL-P05-BOUNDED-IMPLEMENTER` — bound a delegated
  slice small enough to close, and commit in increments so a cut-off lane leaves committed work
  rather than an unexplained working tree. A second independent occurrence promotes it to an
  explicit checkpoint-audit step in [MAINTENANCE_PROTOCOL.md](MAINTENANCE_PROTOCOL.md).

### FR-008 — the runtime refuses writes to its own `.claude/` definition tree

- **first-seen:** 2026-08-09
- **status:** `promoted`
- **symptom:** During the #214 prompt operating system, edits to `.claude/agents/dl-*.md` and
  `.claude/skills/developer-lens-continuation/SKILL.md` were refused by the runtime permission layer
  with a write-permission error, in a non-interactive session where permission cannot be granted.
  Sibling paths outside that tree — including `.agents/skills/developer-lens-continuation/SKILL.md`,
  the Codex-side copy of the same skill — were writable in the same session. The repository's own
  `.claude/settings.json` denies only three read paths and nothing under `.claude/`, so the refusal
  comes from the runtime, not from repository configuration.
- **impact:** Agent and skill *definitions* cannot be revised by a non-interactive agent session,
  even though they are ordinary tracked C0 files the review gate would cover normally. Worse, the
  two continuation-skill copies are split across the writable and non-writable trees, so a partial
  edit silently breaks their parity — the executable parity check added by this slice now fails
  loudly if the marker pair or enclosed bytes drift.
- **workaround:** None that is legitimate. Reaching the same bytes through a shell redirect would
  route around a deliberate permission boundary, which is precisely the silent workaround this slice
  exists to forbid, so it was not attempted. The one-sided `.agents/` edit that had already been
  made was reverted so the two skill copies stay consistent, and the whole agent/skill item was
  parked as a unit rather than landed half-applied. The first non-interactive Claude context
  stopped after ordinary Edit was refused; the second non-interactive Claude context reproduced the
  same refusal and stopped with zero edits. This Codex mechanic fallback performed ordinary tracked
  edits without shell redirect or a hidden route. The runtime write limitation remains documented;
  it is not resolved here.
- **occurrences:** 2 recorded — 2026-08-09 non-interactive Claude context A (ordinary Edit denied
  for `.claude/**`) and context B (same denial reproduced; zero edits).
- **task:** [#214](https://github.com/Chris0Jeky/developer-lens/issues/214) — bounded fallback
  implemented; future `.claude` definition edits route through an authorized interactive or
  otherwise write-permitted session.
- **promotion:** Promoted and implemented in this bounded fallback: all four `dl-*` definitions
  carry the same-hop friction/task-link rule, both continuation skills carry an identical
  marker-delimited block, and `scripts/projectContextValidation.ts` plus
  `scripts/projectContextValidation.test.ts` enforce exactly one ordered marker pair per skill,
  CRLF-to-LF normalization, and byte equality of the enclosed block. Future `.claude` definition
  edits route through an authorized interactive or otherwise write-permitted session; the runtime
  restriction itself remains open and is not marked resolved.

### FR-009 — `CURRENT_STATE.md`'s "machine-readable" YAML block does not parse

- **first-seen:** 2026-08-09
- **status:** `resolved`
- **symptom:** [CURRENT_STATE.md](../analyser-program/CURRENT_STATE.md) opens a fenced ` ```yaml `
  block described as a "machine-readable summary for agent resume", but the block is not valid
  YAML. Measured 2026-08-09 with a strict parser against both the working tree and the committed
  `HEAD` — both fail identically, so this is long-standing, not a regression. The cause is
  unquoted issue references inside a flow sequence: in `active_horizon`, a space followed by `#`
  begins a YAML comment, so `PR #206 — delivered, ...]` is swallowed as a comment and the `[`
  sequence is never closed.
- **impact:** The file's own framing is a false operational claim — the surface advertised as
  machine-readable cannot be machine-read. A resuming agent that tries to parse it rather than read
  it as prose gets a parse error, not the state. `npm run verify:context` does not catch this
  because it checks required files, markers and links, never the YAML body.
- **workaround:** None. The state block is now parsed under YAML 1.2 Core semantics and given a
  narrow resume-field schema by the enforced `npm run verify:context` seam.
- **occurrences:** 1 recorded — 2026-08-09.
- **task:** https://github.com/Chris0Jeky/developer-lens/issues/215
- **promotion:** Resolved by Product #215: `scripts/projectContextValidation.ts` validates the one
  root-level YAML fence, strict parser result, mapping root, and resume-critical field types; the
  `verify:context` entrypoint prefixes every diagnostic as current-state evidence.
- **2026-08-10 note:** Repaired only tracked YAML scalar/sequence syntax, added synthetic parser
  coverage, and promoted the former prose workaround into fail-closed context verification.

### FR-010 — read-only scout capability drift remains in prompt and work-class prose

- **first-seen:** 2026-08-09
- **status:** `open`
- **severity:** `MEDIUM (non-blocking residual)`
- **symptom:** The #219 agent tool-capability tightening removed Bash from the `dl-scout` definition,
  but `DL-P11` in `PROMPT_LIBRARY.md` and the corresponding `WORK_CLASSES.md` prose still restate
  Bash, live Git, and GitHub inspection capabilities that the definition no longer grants.
- **impact:** A coordinator or pasted prompt can request capabilities the read-only scout cannot
  exercise, creating an instruction-surface mismatch even though the immediate agent behavior is
  safe when it refuses the unavailable action.
- **workaround:** Immediate safe behavior is refusal. This is a non-blocking residual for the
  review round; capture is not permission to fix it in this review round.
- **occurrences:** 1 recorded — 2026-08-09, during issue #219 capability tightening.
- **task:** [#216](https://github.com/Chris0Jeky/developer-lens/issues/216) and
  [#219](https://github.com/Chris0Jeky/developer-lens/issues/219).
- **promotion:** If this drift recurs, add a `verify:context` rule tying read-only agent frontmatter
  tools to the documented capabilities in the prompt and work-class surfaces. Do not broaden this
  entry into a prompt/work-class edit without the bounded follow-up.

### FR-011 — branch cleanup bypassed a protected deletion rule after merge

- **first-seen:** 2026-08-09
- **status:** `promoted`
- **symptom:** After merged PR #218, an exact clean-worktree audit and local branch deletion,
  `git push origin --delete docs/prompt-system-overhaul` succeeded while GitHub reported a privileged
  bypass of the `Cannot delete this branch` rule.
- **impact:** Cleanup appeared successful while bypassing repository protection, creating an
  authority/audit defect even though no work was lost: merged commit `87cc6a8` is on `main` and the
  deleted branch remains recoverable.
- **workaround:** Do not recreate the branch in this slice. Future cleanup must inspect applicable
  rules first and avoid any silent administrative bypass.
- **occurrences:** 3 recorded — 2026-08-09, after PR #218 merge cleanup, 2026-08-15 after
  Product PR #258 cleanup, and 2026-08-15 after PR #268 cleanup.
- **task:** [#221](https://github.com/Chris0Jeky/developer-lens/issues/221)
- **promotion:** Promoted at the second occurrence: Product #221 owns a checked cleanup helper or
  contract that queries applicable branch rules before deletion and refuses any required privileged
  bypass. Until it exists, leave a merged remote branch rather than delete it. This slice changes no
  rules and does not recreate a branch.

  **2026-08-15 Product PR #258 cleanup recurrence note:** After a clean merged-branch audit found
  no open child pull request, remote deletion succeeded but GitHub reported a privileged bypass of
  `Cannot delete this branch`. The branch remains merged; no replacement branch or retry is selected.

  **2026-08-15 PR #268 cleanup recurrence note:** Remote deletion of
  `docs/reconcile-post-266-friction-20260815` succeeded while GitHub reported a privileged bypass
  of `Cannot delete this branch`, as recorded by [Product #221 comment 5303683130](https://github.com/Chris0Jeky/developer-lens/issues/221#issuecomment-5303683130).
  Merged commit `fdd60c2cf9289140f4adc2c778aeb7e20dec8e5a` remains on `main` and recoverable, so no
  work was lost. Do not recreate or retry the deletion. The existing stop rule remains binding:
  leave merged remote branches when deletion requires a bypass. The checked helper/contract remains
  unimplemented.

### FR-012 — fresh product worktree lacks the Node tool bootstrap

- **first-seen:** 2026-08-09
- **status:** `promoted`
- **symptom:** In a fresh isolated product worktree, `npm run verify:context` stopped before the
  verifier ran because the `tsx` executable was not installed locally.
- **impact:** The required docs/authority gate cannot run until the worktree dependencies are
  installed, so a clean checkout can be mistaken for an unverifiable lane.
- **workaround:** Run `npm ci`, then rerun `npm run verify:context`; the install completed with
  zero audit vulnerabilities and the verifier passed.
- **occurrences:** 9 recorded — 2026-08-09 (the P0.5 pre-QA reconciliation worktree), 2026-08-09
  (the DL-P09/`Chris0Jeky/developer-lens-lab::HUMAN_TODO.md::q-11` release-gate prerequisite),
  2026-08-09 (the release-state/worktree-preservation documentation worktree), and 2026-08-09
  (the #200 state-reconciliation worktree), plus 2026-08-10 (the PR #238/#237/Lab #62 factual
  reconciliation worktree), plus 2026-08-14 (the immutable FR-037 fresh-reconciliation-worktree
  event), plus 2026-08-15 (the Product #246 verification worktree missing `fast-glob`).
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) (live release
  coordination).
- **promotion:** Promoted at the second independent occurrence to the `CLAUDE.md` run-and-prove
  preamble: a fresh worktree runs lockfile-pinned `npm ci` before any proof. Installation remains an
  explicit environment action rather than a verifier side effect, so the check cannot silently
  install or mutate dependencies on the caller's behalf. The third through fifth occurrences confirm
  that this preamble remains the cheapest enforcing layer; no new promotion is warranted.

  **2026-08-09 note:** The release-state preservation worktree reproduced the same missing-`tsx`
  stop before `verify:context` executed. The lockfile-pinned `npm ci` bootstrap added 358 packages,
  audited 359 packages with 0 vulnerabilities, and restored the declared proof path. This third
  occurrence does not require a new layer: the existing `CLAUDE.md` fresh-worktree preamble is the
  promoted enforcement point.

  **2026-08-10 note:** The fifth worktree again stopped before `tsx` could launch. A trailing
  read-only status command initially masked that subcommand's nonzero exit, so the retry uses an
  explicit fail-fast boundary, performs the already-selected `npm ci` bootstrap, and runs the
  verifier alone. No generated dependency content is inspected.

  **2026-08-15 consolidation note:** FR-037's 2026-08-14 event matches this already-promoted
  fresh-worktree bootstrap predicate, raising the canonical total from five to six. FR-037 remains
  as an immutable-ID consolidated pointer; no second bootstrap mechanism or enforcement layer is
  created.

  **2026-08-15 recurrence note:** Product #246's required context verifier again stopped before its
  first check because the fresh worktree lacked `fast-glob`. The canonical lockfile-pinned `npm ci`
  bootstrap is rerun before proof; no new mechanism or enforcement layer is warranted.

  **2026-08-15 browser-preflight note:** The fresh docs-only worktree lacked `fast-glob`, so
  `verify:context` stopped before its first test. The promoted lockfile-pinned `npm ci` bootstrap
  was then authorized and selected before rerunning the verifier.

  **2026-08-15 friction-worktree note:** This fresh worktree lacked `node_modules` and `tsx`, so
  `npm.cmd run verify:context` stopped before the verifier ran. The lockfile-pinned `npm.cmd ci`
  bootstrap restored dependencies, after which the unchanged verifier passed. This ninth occurrence
  retains FR-012's existing preamble and is recorded by
  [Product #200 comment 5303393508](https://github.com/Chris0Jeky/developer-lens/issues/200#issuecomment-5303393508).

### FR-013 — full product gate exceeded a compound shell timeout

- **first-seen:** 2026-08-09
- **status:** `workaround-documented`
- **symptom:** After PR #226 integrated the latest product base, a compound proving invocation gave
  the full `npm run check` plus its later commands one 120-second shell window. The shell terminated
  before the full gate returned a result, so the later context, diff and push steps never ran.
- **impact:** A sound gate can lose its result near the timeout boundary, leaving the exact head
  unproven and making later steps appear absent without identifying whether the gate failed.
- **workaround:** Confirm that no Node process owned by the worktree remained, then rerun only
  `npm run check` with a 300-second boundary. It passed in 114.7 seconds (86 files, 1,487 passed, 10
  skipped, build and 17-file credential scan green); the narrow docs checks were then rerun after
  this log entry.
- **occurrences:** 3 independent occurrences — 2026-08-09 during PR #226's latest-base proof and
  2026-08-15 during Product PR #251 fix-round proof.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns the active release
  preparation and its exact-head evidence.
- **promotion:** The second occurrence selects a 300-second command-sized timeout boundary for the
  full gate. Record the measured result in the same-hop evidence before deciding whether a future
  run-and-prove-table revision is justified; do not rely on a compound caller timeout.

  **2026-08-15 recurrence note:** The combined focused/context/full-check invocation was terminated
  at its 120-second shell boundary before `npm.cmd run check` returned. The full check is rerun
  alone with the selected 300-second boundary; Product issue #222 comment `5300160711` retains the
  command-transport context.

  **2026-08-15 Product #242 recurrence note:** The local standalone `npm.cmd run check` exceeded
  its 124-second execution window before returning a result. It is the third instance of this
  timeout predicate, not an FR-050 storage-v3 result. The selected 300-second command-sized
  boundary remains the correct future proving boundary; [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222)
  retains the command-boundary debt and [Product #242](https://github.com/Chris0Jeky/developer-lens/issues/242)
  records the validator slice.

### FR-014 — implicit PowerShell decoding corrupted patch context

- **first-seen:** 2026-08-09
- **status:** `promoted`
- **severity:** `LOW (bounded tooling interruption)`
- **symptom:** A `Get-Content` read without an explicit encoding rendered UTF-8 punctuation in the
  live state artifact as mojibake. Reusing that rendered text as an `apply_patch` context made the
  patch fail its exact-match check before any file changed.
- **impact:** A correct state reconciliation can be delayed or aimed at the wrong text when shell
  rendering is mistaken for repository bytes; the failed patch itself left the worktree unchanged.
- **workaround:** Re-read the tracked file with `Get-Content -Encoding utf8`, then use bounded,
  heading-anchored patch contexts and inspect the exact diff immediately.
- **occurrences:** 4 independent occurrences — 2026-08-09 during PR #228's latest-base state sync
  and 2026-08-09 during the later release-state preservation slice; 2026-08-14 (the immutable
  FR-036 recurrence); 2026-08-15 during this issue #200 resume-artifact repair.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns the active release
  coordination and factual cross-repository resume artifact.
- **promotion:** Promoted at the second occurrence to the PowerShell tracked-Markdown read path:
  use `Get-Content -Encoding utf8` for direct reads, or the cheapest existing tracked-Markdown
  wrapper where one already applies. Do not add a parallel wrapper merely to restate the same
  encoding rule; [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) carries the live
  release-state consumer.

  **2026-08-09 note:** A second independent mojibake occurrence during release-state preservation
  triggered the promotion above. The durable response is explicit UTF-8 PowerShell reads, routed
  through the cheapest existing tracked-Markdown wrapper where applicable; the failed-context
  behavior remained fail-closed and no repository file was changed by the failed read-derived
  patch.

  **2026-08-15 recurrence note:** A default-decoded state read again rendered UTF-8 punctuation
  incorrectly; copying that rendered context caused an atomic patch mismatch before any change.
  An explicit UTF-8 reread supplied the successful bounded patch. This reuses the promoted rule;
  Product #222 remains the durable command-boundary task.

  **2026-08-15 consolidation note:** FR-036's 2026-08-14 immutable event is this same
  default-decoding/patch-context mechanism. The canonical total is four: the two 2026-08-09 events,
  the FR-036 recurrence, and the 2026-08-15 event. The promoted explicit-UTF-8 rule remains the
  selected layer; the duplicate ID is retained only as a consolidated pointer.

### FR-015 — retained merged #200 worktree collided with the new lane name

- **first-seen:** 2026-08-09
- **status:** `workaround-documented`
- **severity:** `LOW (bounded lane-selection friction)`
- **symptom:** While selecting a fresh exact-main branch for the active #200 documentation lane,
  the retained worktree/branch `developer-lens-preqa-200/release-preqa-copy-pass` was still
  registered. Its tracked tree was clean at exact head `d5fb742b6d941e51f2660345654580eeb8a6f528`,
  the head is the merged PR #224 head, and it is an ancestor of current `origin/main`
  `7ae4b31861ad5403587adf8fefb90a085598bd57`.
- **impact:** A semantic task-name collision can make a merged lane look active or invite edits to
  an already-merged branch, weakening one-writer and exact-head evidence for the new #200 slice.
- **workaround:** The retained tree was verified clean and no ignored contents were inspected. The
  collision was resolved by using the new exact-main branch `docs/product-200-preqa-20260809` for
  the bounded reconciliation; no retained worktree was removed.
- **occurrences:** 1 independent occurrence — 2026-08-09 during #200 lane selection.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns the active release
  preparation and its exact-head evidence.
- **promotion:** Deliberately NOT promoted after one occurrence. Keep exact worktree/branch
  inventory and ancestor checks in the lane-selection step; consider a named-worktree collision
  check if the same friction recurs.

### FR-016 — Windows working-tree edits produced mixed line-ending warnings

- **first-seen:** 2026-08-09
- **status:** `workaround-documented`
- **severity:** `LOW (review-noise risk)`
- **symptom:** Git warned that LF would be replaced by CRLF for the four edited Markdown files.
  `core.autocrlf=true`, no file-specific `text` or `eol` attribute applies, and `git ls-files --eol`
  reported an LF index with mixed working-tree endings.
- **impact:** Repeated warnings can obscure a real diff problem or invite an unnecessary bulk
  normalization. The intended index remains LF and `git diff --check` is clean.
- **workaround:** Stage only the named files, inspect the cached diff, and run
  `git diff --cached --check`; do not normalize unrelated lines or files in this slice.
- **occurrences:** 4 independent occurrences — the four-file #200 documentation reconciliation on
  2026-08-09 shares one checkout/config cause; the Product #246 one-file consolidation emitted the
  same warning on 2026-08-15; and the 2026-08-15 DL-CONTEXT-01 generator run emitted it again.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns the bounded
  pre-QA documentation reconciliation.
- **promotion:** At the second independent occurrence, Product #222 owns the cheapest checked
  repository line-ending policy/verification decision. Until it exists, stage only the named file,
  inspect the cached diff, and run `git diff --cached --check`; do not normalize unrelated content.

  **2026-08-15 recurrence note:** The one-file #246 scan emitted the same LF/CRLF warning. This
  selects the existing #222 enforcement debt without a bulk line-ending rewrite in this slice.

  **2026-08-15 DL-CONTEXT-01 recurrence note:** LF/CRLF warnings affected the canonical card
  source, generated Taskdeck manifest, and generated delivery roadmap, as recorded by [Product #222 comment 5303623855](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303623855).
  The roadmap HEAD and worktree blob were both
  `592e92982ed0e4b82a2514b777c6e39aca222b68`; raw/content diffs were empty, and a bounded index
  refresh cleared the false status. No semantic or bulk-normalization change was made. The
  existing policy/verification debt remains unimplemented.

  **2026-08-15 browser-preflight state-sync recurrence note:** The scoped documentation update
  emitted the same LF/CRLF warning. The existing Product #222 policy/verification debt remains
  selected but unimplemented; no bulk normalization was made, as recorded by [Product #222 comment
  5304288086](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5304288086).

### FR-017 — MCP hygiene cleanup needed a canonical-location retry and bounded second pass

- **first-seen:** 2026-08-09
- **status:** `workaround-documented`
- **symptom:** The canonical reviewed report first measured 468 running MCP containers, 440
  provably unowned. The first reviewed cleanup wrapper then timed out after 64 seconds, leaving 249
  running containers, 221 provably unowned. Only the later report-only re-measure was first launched
  from a stale remembered checkout location; that attempt failed before the hygiene script executed.
- **impact:** The bounded cleanup timeout left a large regenerable unowned set consuming memory
  after the first pass. The later stale-location lookup delayed a trustworthy re-measure but did not
  invalidate the already completed cleanup.
- **workaround:** Use one bounded retry of the same reviewed cleanup after the timed-out first pass.
  It completed with an immediate post-clean measurement of 36 running containers, 0 provably
  unowned, 0 orphan MCP processes, and about 1.8 GB free. For the later report-only re-measure,
  resolve the canonical checkout from the repository registry after the stale-location attempt
  fails, then run the reviewed report there. That re-measure at about 13:40 BST found 56 running
  containers, 0 provably unowned, 0 orphan MCP processes, and 5,023 MB free, so no additional cleanup
  was warranted. The cleanup predicate spared live-owned containers; the unowned containers it
  removed were regenerable.
- **occurrences:** 2 independent occurrences — 2026-08-09 canonical 468/440 report, timed-out first
  cleanup pass, bounded successful retry, later stale-location correction and live-owned re-measure;
  then the 2026-08-09 approximately 20:38 BST report-only measurement with Docker unavailable.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns durable Windows-safe
  governor maintenance helpers for recurrent proof and cleanup checks.
- **promotion:** Promotion selected at the second independent occurrence, but not yet implemented:
  #222 owns the cheapest durable layer, a Windows-safe executable helper that distinguishes
  Docker-unavailable or unknown from a measured zero-container result and retains fail-closed,
  report-only semantics. It must not infer a safe sweep from missing Docker evidence.

  **2026-08-09 truth-correction note:** The entry's first draft inverted the initial canonical
  468/440 report and the stale-location failure, which happened only during the later re-measure.
  The corrected fields above preserve the measured cleanup sequence and the later 56/0 result.

  **2026-08-09 second-measurement note (approximately 20:38 BST):** The reviewed report-only MCP
  hygiene path measured 9,651 MB free and 0 orphan MCP processes. Docker was unreachable because
  either the daemon was down or the CLI was unavailable, so the container count was explicitly
  **unknown**, not measured zero, and the sweep was skipped. No restart or cleanup was warranted
  from the available evidence. Issue #222 still owns the selected helper above; it is not
  implemented by this documentation update.

### FR-018 — active Product prompts did not all carry their named Claude routing

- **first-seen:** 2026-08-09
- **status:** `resolved`
- **symptom:** A prompt-parity closeout audit found that 11 of the 14 active Product prompt bodies
  left the literal `dl-scout`, `dl-implementer`, `dl-reviewer`, and `dl-mechanic` routing implicit in
  shared or general prose instead of carrying the named Product routing in each copy-ready body.
- **impact:** A pasted Product prompt could omit the repository's concrete Claude role mapping even
  though the agent definitions and surrounding canon named it, leaving the Product prompt surface
  weaker than the already-explicit Lab counterpart.
- **workaround:** No temporary workaround. The bounded #216 slice added one canonical Product-only
  routing clause to every active Product body and extended the existing context validator with
  omission, duplication, and required-role-token tests.
- **occurrences:** 1 audited repository-wide gap — 2026-08-09 prompt-parity closeout.
- **task:** [#216](https://github.com/Chris0Jeky/developer-lens/issues/216), fixed and enforced by
  [PR #229](https://github.com/Chris0Jeky/developer-lens/pull/229).
- **promotion:** Resolved by the existing executable context-verifier layer at exact merge head
  `7ae4b31861ad5403587adf8fefb90a085598bd57`: all 14 active Product bodies name all four roles;
  focused tests, `npm run verify:context`, and the full gate passed. Shared blocks, hashes, prompt
  IDs, and the overnight stop protocol were unchanged. No capability was activated.

### FR-019 — Lab closeout friction could disappear from the Product resume boundary

- **first-seen:** 2026-08-09
- **status:** `workaround-documented`
- **symptom:** The final cross-repository release reconciliation reached Lab main with seven new Lab
  friction entries, FR-025 through FR-031. Without a compact Product-side pointer, a Product resume
  could treat the Lab wave as unconditionally merge-proven or lose the selected workflow hardening.
- **impact:** Repeating the documented snapshot, age, UTC, optional-path, GraphQL, or interpreter
  failures would consume another release session; omitting FR-028 would also misstate two completed
  merges as satisfying the binding Lab 15-minute exact-head gate.
- **workaround:** Keep the Lab friction log authoritative and retain this compact mapping only:
  FR-025 adds top-level comments to the final snapshot (#34); FR-026 uses `DateTimeOffset` for UTC
  thresholds (#34); FR-027 filters optional paths before search (#34); FR-028 selects a checked,
  event-driven 15-minute all-surface snapshot (#29); FR-029 archives stale PR #53 unmerged and
  preserved (#29, resolved); FR-030 uses REST only for representable evidence and waits for GraphQL
  before the final snapshot (#34); FR-031 passes one validated confined `uv` route explicitly
  (#29/#34). None of the selected helpers is implemented by this Product reconciliation.
- **occurrences:** 1 cross-repository reconciliation — Lab PRs #52-#54 on 2026-08-09, representing
  the seven independently counted Lab entries rather than seven new Product occurrences.
- **task:** [Lab #29](https://github.com/Chris0Jeky/developer-lens-lab/issues/29) owns release/package
  hardening; [Lab #34](https://github.com/Chris0Jeky/developer-lens-lab/issues/34) owns external
  GitHub and Windows command-boundary hardening.
- **promotion:** Do not create a parallel Product helper. The cheapest enforcing layers remain the
  checked Lab snapshot/launcher tasks on #29/#34, with the current workarounds retained until those
  tasks land. Product #222 remains a separate selected-but-unimplemented hygiene helper.

### FR-020 — public-tip audit found machine-specific local-path literals

- **first-seen:** 2026-08-09
- **status:** `workaround-documented`
- **severity:** `MEDIUM (public-path privacy risk)`
- **symptom:** A tracked-tip audit found one machine-specific local path in the owner-action history
  and the same machine-specific prefix in two synthetic storage-test canaries. The audit did not
  inspect the referenced worktree or any ignored, generated, private, or protected content.
- **impact:** Publishing those literals would disclose a workstation layout and weaken the public
  synthetic-only boundary, even though the test canaries are intentionally redaction probes.
- **workaround:** Redacted the current tip to a content-free `value01` owner-review/delete reference
  and clearly invented generic Windows fixture paths, then searched tracked current-tip files for both
  slash forms. Historical Git still contains the prior string; no history rewrite is authorized.
- **occurrences:** 1 bounded public-tip audit and repair — 2026-08-09.
- **task:** [#234](https://github.com/Chris0Jeky/developer-lens/issues/234) owns the durable tracked-text
  lint/check follow-up; this repair does not implement that broader check.
- **promotion:** The durable prevention remains #234’s narrow tracked-text check. Until it lands,
  repeat the two-form tracked-only search during public-tip review and keep historical-Git findings
  separate from current-tip proof.

### FR-021 — immediate inode reuse makes replacement fixtures nondeterministic

- **first-seen:** 2026-08-06
- **status:** `workaround-documented`
- **symptom:** Exact-head hosted run `31339262700` failed only the `v3Backup` valid-replacement-inode
  case. Its fixture unlinked the provisional path and immediately wrote a replacement; Linux reused
  the original inode, so production recovery correctly observed the still-bound identity and
  resolved. This is a pre-existing nondeterministic, platform-sensitive fixture defect, not a PR
  #232 range regression and not a generic flaky-test label.
- **impact:** An unrelated documentation PR can lose its required hosted gate even though production
  behavior remains fail-closed and the changed range does not touch the fixture. Unbounded reruns
  would hide the deterministic test-construction defect rather than repair it.
- **workaround:** One focused local collision case and the full `v3Backup.test.ts` file passed after
  the hosted failure; adjacent hosted run `31337964825` also passed the same file. That evidence
  justifies exactly one rerun for PR #232, without treating the rerun as a repair or claiming its
  result in this documentation hop.
- **occurrences:** 2 independent occurrences — run `31112768523` exposed immediate inode reuse in
  the sibling artifact-catalogue fixture on 2026-08-06; run `31339262700` exposed the corresponding
  `v3Backup` fixture on 2026-08-09.
- **task:** [#233](https://github.com/Chris0Jeky/developer-lens/issues/233) owns the bounded durable
  fixture repair.
- **promotion:** The cheapest enforcing layer is the affected test fixture: reuse commit
  `1053cf8609108f1e7d0924bb42245185c6fce89e`'s established keep-original-inode-live pattern while
  allocating the replacement, preserve production identity checks, and prove the focused case,
  full backup file, and declared gate. #233 tracks that repair; PR #232 takes no production-code
  detour.

### FR-022 — PowerShell inner-quote stripping blocked a PR232 latest-field query

- **first-seen:** 2026-08-09
- **status:** `open`
- **severity:** `LOW (CLI evidence friction)`
- **symptom:** Three read-only `gh api --jq` projections used from PowerShell stripped inner quoting
  before the request could be evaluated: the initial PR232 ISO-timestamp filter, the Lab PR59 commit
  projection with a quoted-newline split, and the externally recorded PR232 exact-final-thread
  snapshot. Each failed before mutation; no GitHub write occurred.
- **impact:** A latest-field comparison can be delayed or misread if shell quoting is mistaken for
  API evidence, weakening exact-head PR proof without changing repository state.
- **workaround:** Use quote-safe projections and separate direct field reads, preserving the
  path-set-order assertion as a distinct predicate rather than conflating it with inner-quote
  parsing. The Lab PR59 recurrence is recorded by [#222 comment 5234236530](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5234236530).
- **occurrences:** 14 independent command-boundary occurrences — 2026-08-09 during the initial PR232
  ISO-timestamp filter, the Lab PR59 commit projection/newline split, and the externally recorded
  PR232 exact-final-head review-thread snapshot; 2026-08-15 during this Product #200 YAML
  inspection attempt; plus 2026-08-14 and 2026-08-15 (the immutable FR-039 malformed GraphQL
  argument events), the Product PR #258 inline reproduction, and the Product PR #261 review.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns structured/JSON-input
  Windows-safe CLI helpers for recurring evidence queries.
- **promotion:** The cheapest enforcing layer is the Windows-safe structured-query helper already
  owned by [#222](https://github.com/Chris0Jeky/developer-lens/issues/222): pass GraphQL values as
  variables or JSON input rather than embedding quoted literals in a PowerShell native-command
  argument. Keep direct field comparison until that helper lands.

  **2026-08-09 note:** The Lab PR59 commit projection/newline split is the second independently
  recorded occurrence (see #222 comment 5234236530); the PR232 exact-final-head thread snapshot is
  the third. Quote-safe projections and direct field reads succeeded without mutation. The three

  **2026-08-15 recurrence note:** PowerShell stripped Markdown fence backticks from a double-quoted
  `node -e` YAML-inspection argument, so the read-only inspection reported a missing fence. The
  enforced context verifier had already parsed the same state successfully. Use a single-quoted or
  file-backed Node argument for an optional direct inspection; Product #222 remains the selected
  structured-command-boundary debt.
  occurrences keep the path-set-order, UTC-switch, and patch-context predicates separate while
  selecting #222's structured-query helper as the durable enforcing layer.

  **2026-08-15 consolidation note:** FR-039's 2026-08-14 malformed-field episode and 2026-08-15
  inline-query failure match this quoted/native-argument mechanism and use the same JSON-stdin
  remedy. They raise the canonical total from four to six. FR-026 remains a related explicit-scalar
  serialization boundary, but its object-expansion predicate did not occur in these two events.

  **2026-08-15 PR #258 recurrence note:** An optional inline production reproduction used `npx`
  through PowerShell, which stripped native-command quoting before the command could evaluate;
  static code composition supplied the decisive review evidence instead. This is one FR-022
  occurrence; the distinct pre-native multiline-body parse failure is FR-065. Product
  [#222](https://github.com/Chris0Jeky/developer-lens/issues/222)'s existing structured-query helper
  promotion and task ownership remain unchanged.

  **2026-08-15 PR #261 review note:** An optional inline `npx tsx -e` probe and a quote-safe
  environment attempt both lost native-command quoting before execution, then stopped. Production
  test and static-diff composition supplied decisive evidence without mutation. The two stopped
  attempts are one review occurrence, raising the canonical total to eight.

  **2026-08-15 Product PR #263 review notes:** Three independent pre-collection nested-quote losses
  occurred without mutation: a Lab final-state thread query and two GraphQL query-document attempts,
  including quoting the whole form field, each produced malformed `-lens`. Typed owner, name, and
  number variables supplied with `-F` completed the bounded query. These ninth through eleventh
  occurrences retain FR-022's promotion and Product #222 ownership.

  **2026-08-15 recurrence note:** A malformed inline `gh pr view` jq projection stopped before
  execution; plain structured JSON fields completed the bounded read without mutation. Product
  #222's existing structured-query/direct-field contract remains selected but is NOT implemented,
  as recorded by [Product #222 comment 5303708410](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303708410).

  **2026-08-15 recurrence note:** A PowerShell double-quoted `node -e` probe consumed JavaScript
  template backticks/interpolation and raised `SyntaxError: Unexpected token |`. A concatenation
  retry returned description length 1478 without mutation; the existing direct-field/structured
  command contract remains selected but unimplemented, as recorded by [Product #222 comment 5303735953](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303735953).

  **2026-08-15 recurrence note:** A PowerShell quoted-literal GraphQL query received malformed
  `-lens`; typed owner, name, and number variables completed the same read without mutation. The
  existing Product #222 structured-query contract remains selected and unimplemented, as recorded
  by [Product #222 comment 5304365805](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5304365805).

### FR-023 — Windows PowerShell lacked the requested UTC date switch

- **first-seen:** 2026-08-09
- **status:** `promoted`
- **severity:** `LOW (CLI evidence friction)`
- **symptom:** The installed Windows PowerShell rejected `Get-Date -AsUTC` while composing an
  exact-head PR evidence snapshot. The compound read-only command failed before any mutation.
- **impact:** A version-specific convenience switch can interrupt or omit the timestamp attached
  to an otherwise reproducible GitHub state snapshot.
- **workaround:** Use `(Get-Date).ToUniversalTime().ToString('o')`, which succeeded on the same
  shell without changing repository or GitHub state.
- **occurrences:** 5 independent occurrences — 2026-08-09 during the PR232 final review-thread
  snapshot, plus 2026-08-13 and 2026-08-14 (the immutable FR-032 Windows PowerShell UTC-switch
  recurrences).
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the bounded
  Windows-safe evidence helper and its explicit timestamp normalization.
- **promotion:** Promoted to Product #222's typed UTC-normalization contract; retain the compatible
  expression until that helper is implemented. The fifth recurrence confirms the selected contract,
  but the helper is NOT implemented and no parallel PowerShell framework is warranted.

  **2026-08-15 consolidation note:** FR-032's immutable Product events contain the same rejected
  `Get-Date -AsUTC` predicate and compatible expression. Its ID remains a consolidated pointer;
  the canonical total is three.

  **2026-08-15 recurrence note:** PowerShell 5.1 again rejected `Get-Date -AsUTC`; the compatible
  `DateTime` UTC expression completed the read-only timestamp step. This raises this canonical
  mechanism's total to four. FR-032 remains its immutable historical pointer, so no disputed
  duplicate arithmetic or second UTC framework is revived; Product #222 retains the selected helper.

  **2026-08-15 fifth-occurrence note:** PowerShell 5.1 again rejected `Get-Date -AsUTC`; the
  compatible `[DateTime]::UtcNow.ToString('o')` expression completed the read-only timestamp step.
  This fifth event is recorded by [Product issue #222 comment 5303376604](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303376604).
  Product #222's typed UTC-normalization contract remains selected, but its helper is NOT implemented.

### FR-024 — repeated-schema patch context selected the wrong friction entry

- **first-seen:** 2026-08-09
- **status:** `workaround-documented`
- **severity:** `LOW (caught pre-commit content drift)`
- **symptom:** An `apply_patch` hunk that changed a common `status` field without carrying its
  `FR-022` heading matched the earlier `FR-015` entry. The mandatory immediate diff exposed the
  wrong edit before commit or push.
- **impact:** Repeated Markdown schemas make a syntactically successful patch unsafe evidence of
  the intended target; an unchecked hunk could corrupt an unrelated friction record.
- **workaround:** Restore the unrelated field and reapply the edit with the unique entry heading in
  the patch context, then inspect the complete file diff.
- **occurrences:** 4 independent occurrences — 2026-08-09 during PR232's second friction capture,
  and 2026-08-15 during Product #234 FR-050 promotion.
- **task:** [#234](https://github.com/Chris0Jeky/developer-lens/issues/234) owns the current
  remediation; [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) retains the historical
  release-reconciliation context.
- **promotion:** At the second independent occurrence, the selected guard is a mandatory
  heading-bounded field edit followed by immediate `git diff --cached` review before commit. A
  general verifier cannot infer which historical entry an agent intended to patch and would not
  prevent target selection, so no structural checker is chosen in this code slice.

  **2026-08-15 recurrence note:** A broad FR-050 status hunk matched FR-004 because the field is
  repeated. Immediate staged-diff review caught the wrong field before commit; a unique-heading
  patch restored FR-004 and updated FR-050. No source behavior or unrelated committed record changed.

  **2026-08-15 browser-preflight note:** A repeated `status` field hunk targeting FR-044 matched
  FR-004 instead. Exact diff review caught the unintended change after the first local commit; the
  correction restored FR-004 and applied FR-044's promotion. This recurrence retains the promoted
  heading-bounded edit and immediate diff review.

  **2026-08-15 browser-preflight state-sync recurrence note:** A repeated-schema patch context
  first selected FR-057's `status` field. Immediate diff inspection restored it, and the
  heading-scoped patch then completed the intended update. This fourth actual wrong-target
  recurrence retains the existing heading-bounded/diff rule; no structural checker was added, as
  recorded by [Product #222 comment 5304288086](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5304288086).

### FR-025 — occupied PR232 worktree entered a concurrent main merge

- **first-seen:** 2026-08-10
- **status:** `open`
- **severity:** `LOW (one-writer coordination evidence)`
- **symptom:** An occupied PR232 worktree unexpectedly entered a concurrent merge of moved main.
  Conflict and status evidence then raced, and two read-only 30-second status probes timed out
  before another writer completed and pushed the correct merge.
- **impact:** One-writer ownership was ambiguous during the merge/status window, weakening the
  trustworthiness of intermediate conflict evidence. No work was lost.
- **workaround:** Preserve the raced evidence, wait for the current writer to complete, and refresh
  the exact merge and status state from the resulting head. This documentation slice takes no
  detour into the occupied worktree.
- **occurrences:** 1 independent occurrence — 2026-08-10 during the Product #200 reconciliation.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns the active release
  coordination and worktree ownership evidence.
- **promotion:** The cheapest enforcing layer is a coordinator-owned worktree lease or explicit
  handoff recorded before a moved-main merge. Task debt at one occurrence; no additional repair is
  selected in this hop.

### FR-026 — PowerShell object expansion obscured a scalar merge message

- **first-seen:** 2026-08-10
- **status:** `promoted`
- **severity:** `LOW (CLI evidence formatting)`
- **symptom:** Embedding `Get-Content` output directly in a PowerShell object expanded verbose
  FileInfo/provider metadata instead of preserving a scalar merge-message string.
- **impact:** Evidence serialization became noisy and could obscure the exact merge message needed
  for a factual state record, without changing repository or GitHub state.
- **workaround:** Join the content as a scalar with `[string]::Join` or read it with `-Raw` before
  placing it in the object. The corrected evidence path completed without mutation.
- **occurrences:** 10 independent occurrences — 2026-08-10 during the Product #200 reconciliation
  and during PR #239's multiline review-triage comment; 2026-08-15 during PR #249 thread
  resolution, recorded by
  [Product issue #222 comment 5299759496](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5299759496).
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the durable
  Windows-safe structured evidence helpers.
- **promotion:** Promoted at the second occurrence to structured JSON stdin for multiline native
  payloads and explicit scalar conversion for single-value arguments. Product #222's successor
  owns that command boundary; ad hoc PowerShell must not pass multiline bodies positionally.

  **2026-08-10 promotion note:** `gh pr comment --body` split one multiline PowerShell scalar into
  three native arguments and failed before any GitHub write. Serialising `{body: <text>}` with
  `ConvertTo-Json` and sending it through `gh api --input -` created the intended public PR comment
  without exposing a path or private value.

  **2026-08-15 recurrence note:** Passing `-F thread=$item.Thread` to `gh api graphql` expanded the
  PowerShell object followed by the literal `.Thread`, so the mutation refused the malformed node
  ID before changing thread state. Building the field from an explicit scalar thread ID succeeded.
  This recurrence confirms the promoted explicit-scalar native-argument boundary; Product #222
  retains that enforcement direction rather than adding a second helper.

  **2026-08-15 recurrence note:** An unquoted `$base..$head` Git range expanded incorrectly and
  `git diff` printed usage before reading evidence. Passing the intended range as one explicit
  scalar variable completed the bounded diff. This is the promoted single-value native-argument
  boundary; Product #222 remains the selected enforcement rather than adding a range-specific rule.

  **2026-08-15 Product PR #258 coordinator note:** The first review-thread mutation passed
  `-F thread=$item.Thread`, which PowerShell expanded as `System.Collections.Hashtable.Thread`.
  GraphQL refused the malformed node ID with `NOT_FOUND` before any mutation. Retrying with the
  explicit scalar `$threadId` completed all three replies and resolutions. This fifth occurrence
  retains FR-026's promoted explicit-scalar native-boundary mechanism and Product #222 ownership.

  **2026-08-15 Product PR #260 review note:** `$expectedBase..$expectedHead` misexpanded, so both
  review diffs printed usage before reading their ranges. Passing the range through the explicit
  scalar `$range` completed both bounded diffs. This sixth occurrence retains FR-026's promoted
  explicit-scalar native-boundary mechanism and Product #222 ownership.

  **2026-08-15 Product PR #262 review note:** An unquoted PowerShell `@{upstream}` revspec parsed
  as a hash literal before Git executed. Passing the revision through a quoted explicit scalar
  completed the bounded read. This seventh occurrence retains FR-026's promoted explicit-scalar
  native-boundary mechanism and Product #222 ownership.

  **2026-08-15 Product PR #263 review note:** An unquoted revision-range composition produced Git
  usage before the range was read. Explicit scalar revisions completed the bounded diff. This eighth
  occurrence retains FR-026's promoted explicit-scalar boundary and Product #222 ownership.

  **2026-08-15 Product friction-worktree note:** A literal single-quoted `$target` was rejected by
  `git worktree remove`; passing the already-resolved and validated target as an expanded scalar
  succeeded. This independent occurrence is recorded by
  [Product issue #222 comment 5303376604](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303376604).

  **2026-08-15 Product collector note:** `gh issue comment --body $body` split one multiline
  PowerShell scalar into seven native arguments (`accepts 1 arg(s), received 7`) and was rejected
  before a GitHub write. Sending JSON through `gh api --input -` succeeded. This separate occurrence
  is recorded by [Product issue #222 comment 5303399568](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303399568).

### FR-027 — stale multi-entry patch context failed closed

- **first-seen:** 2026-08-10
- **status:** `promoted`
- **severity:** `LOW (fail-closed documentation tooling)`
- **symptom:** Combined Markdown patches copied from an earlier read no longer matched one target
  section after nearby state moved. `apply_patch` rejected each whole patch before any file changed.
- **impact:** Same-hop factual reconciliation pauses for an exact re-read; retrying the broad patch
  without narrowing it could aim a repeated field at the wrong historical entry.
- **workaround:** Re-read the exact section, apply one file and one unique heading at a time, then
  inspect the complete diff before staging.
- **occurrences:** 5 independent occurrences — four on 2026-08-10: the #222 friction burn-down, its
  review-fix state reconciliation, the merged PR #238 fixture-evidence reconciliation on parked PR
  #237, and that Product/Lab state correction; one on 2026-08-15 during PR #250 fix round 1.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns live release-state
  reconciliation; [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) retains the parked
  helper branch and its earlier unmerged occurrence evidence.
- **promotion:** The enforcing layer is the existing atomic patch verification plus immediate
  heading-bounded re-read and diff inspection. A new Markdown parser would not prevent stale copied
  context and is disproportionate task debt; do not retry multi-entry patches in the same hop.

_Note 2026-08-10 (main-line consolidation):_ Parked PR #237 recorded its first three occurrences as
unmerged FR-028. This main-line entry preserves those observed facts under the next available ID
without importing the blocked helper or reopening its exhausted review pipeline. The fourth failed
patch changed no file and the one-section retry succeeded.

_Note 2026-08-15 (PR #250 fix round 1):_ A multi-hunk FR-039 patch lacked the unique entry heading,
so atomic patch verification rejected it before any file changed. The exact FR-039 section was
re-read and the heading-bounded retry succeeded. FR-027's existing atomic-verification plus
heading-bounded-retry enforcement remains selected; no new parser or structure is warranted.

### FR-028 — bundled thread helper treats `--help` as a live current-branch lookup

- **first-seen:** 2026-08-10
- **status:** `workaround-documented`
- **severity:** `LOW (CLI helper contract friction)`
- **symptom:** Invoking the bundled PR-thread helper with `--help` did not expose a conventional
  help path. It instead performed a live lookup for the current branch and failed when that branch
  had no pull request.
- **impact:** A supposed read-only usage check can create misleading branch-dependent failure
  evidence and cannot safely establish the helper's invocation contract from an arbitrary checkout.
- **workaround:** Run the helper only from the exact PR worktree after pinning branch and HEAD; use
  the recorded command-boundary evidence rather than treating `--help` as a side-effect-free probe.
- **occurrences:** 1 independent occurrence — 2026-08-10 during Product issue #222 evidence review.
- **task:** [Product #222 comment 5235237268](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5235237268)
  records this helper-hardening input under [#222](https://github.com/Chris0Jeky/developer-lens/issues/222).
- **promotion:** Do not borrow FR-026's object-expansion remedy. The bounded #222 successor must
  give this helper an explicit non-live help contract and prove it against the no-PR current-branch
  seam before this entry can close.

### FR-029 — default Windows decoding corrupts UTF-8 review content

- **first-seen:** 2026-08-10
- **status:** `workaround-documented`
- **severity:** `LOW (review-evidence decoding friction)`
- **symptom:** Default Windows text decoding failed on UTF-8 review content, making review evidence
  unreadable or incorrectly rendered before it could be classified.
- **impact:** Review findings can be misread or omitted, weakening exact-head thread triage even
  though no repository or GitHub mutation occurs.
- **workaround:** Invoke the affected Python helper with `py -3 -X utf8 ...`; this is the observed
  safe route that exercises the helper's decoding path. `Get-Content -Encoding utf8` does not
  exercise this helper failure. Retain the original source response as the authority for review
  classification.
- **evidence:** The exact helper failed on GitHub review JSON through the Windows default code page,
  then `py -3 -X utf8 ...` returned complete PR/review/thread JSON without a repository or GitHub
  mutation.
- **occurrences:** 2 independent occurrences — 2026-08-10 during Product issue #222 review evidence
  handling.
- **task:** [Product #222 comment 5235389219](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5235389219)
  proves this distinct UTF-8 helper route under [#222](https://github.com/Chris0Jeky/developer-lens/issues/222).
- **promotion:** Do not conflate this with FR-026's PowerShell object-expansion mechanism. The
  bounded #222 successor must define and prove an explicit UTF-8 decoding path for review content
  before this entry can close.

  **2026-08-15 recurrence note:** A second Windows Python default-`cp1252`/UTF-8 review-helper
  occurrence was recorded by [Product issue #222 comment 5303418489](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303418489).
  At recurrence two, the selected contract is an explicit `py -3 -X utf8 ...` helper invocation;
  Product #222 owns it, and it is NOT implemented. No broader decoding framework is warranted.

### FR-030 — delayed review sweep cast a null `submittedAt` timestamp

- **first-seen:** 2026-08-10
- **status:** `workaround-documented`
- **severity:** `LOW (review-sweep evidence friction)`
- **symptom:** A delayed review sweep attempted to cast a null `submittedAt` value to
  `DateTimeOffset` before distinguishing a pending or incomplete review record.
- **impact:** The sweep can stop before completing its time comparison, delaying factual late-review
  evidence without changing repository or GitHub state.
- **workaround:** Guard for a non-null `submittedAt` value before `DateTimeOffset` conversion; treat
  a null value as an explicit incomplete-record branch rather than as a timestamp.
- **occurrences:** 1 independent occurrence — 2026-08-10 during Product issue #222 delayed-sweep
  evidence handling.
- **task:** [Product #222 comment 5235299373](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5235299373)
  records this separate review-sweep hardening input under [#222](https://github.com/Chris0Jeky/developer-lens/issues/222).
- **promotion:** This is distinct from FR-026 object expansion and FR-029 UTF-8 decoding. The
  bounded #222 successor must prove the non-null guard against pending and completed review records
  before this entry can close.

### FR-031 — canonical estate registry diverged from the active Developer Lens pair

- **first-seen:** 2026-08-13
- **status:** `workaround-documented`
- **severity:** `LOW (routing and authority discoverability)`
- **symptom:** The canonical estate registry retained stale Developer Lens routing/authority detail
  and omitted the sibling Lab row, despite live Product/Lab work continuing under the paired policy.
- **impact:** A new coordinator could route from stale canonical metadata rather than the live
  repository canon and tier declarations.
- **workaround:** Reconciled the canonical rows through
  [Chris0Jeky/claude-config#134](https://github.com/Chris0Jeky/claude-config/pull/134) (`2d9c047`);
  refreshed the active Product state from live Git/GitHub rather than trusting the earlier registry claim.
- **occurrences:** 1 independent occurrence — 2026-08-13 governor sense/reconcile.
- **task:** [Chris0Jeky/claude-config#133](https://github.com/Chris0Jeky/claude-config/issues/133)
  owns remaining deployed MACHINE/REPOS routing drift;
  [Chris0Jeky/claude-config#135](https://github.com/Chris0Jeky/claude-config/issues/135) separately
  owns permission-blocked stale-worktree metadata.
- **promotion:** The canonical-row repair is complete. Deployment/routing drift stays durable tracked
  debt until [Chris0Jeky/claude-config#133](https://github.com/Chris0Jeky/claude-config/issues/133)
  proves the deployed map; do not duplicate its implementation in this repository.

### FR-032 — Windows command boundaries rejected common npm and UTC conveniences

- **first-seen:** 2026-08-13
- **status:** `workaround-documented`
- **severity:** `LOW (local proof evidence friction)`
- **symptom:** Windows PowerShell refused `npm.ps1` under execution policy, requiring `npm.cmd`; the
  installed PowerShell 5.1 also rejected `Get-Date -AsUTC` during a later UTC-evidence repeat and
  rejected `||` syntax before a read-only command could run.
- **impact:** Standard proof or timestamp commands can fail before reading the intended seam, delaying
  factual evidence without changing repository or GitHub state.
- **workaround:** Use `npm.cmd` for repository scripts, `(Get-Date).ToUniversalTime().ToString('o')`
  for UTC timestamps, and PowerShell-compatible conditional flow rather than `||`. Lab FR-069
  records the corresponding Lab-side observation; this entry does not duplicate its Lab details.
- **occurrences:** 4 immutable Product-session command-boundary events — initial evidence on
  2026-08-13 and the PowerShell 5.1 UTC/`||` repeat during the 2026-08-14 Lab review
  reconciliation, plus the two later PowerShell 5.1 `&&`/`||` parse stops recorded by Product
  issue #222 comment 5303367870. Consolidated pointer: rejected `Get-Date -AsUTC` predicates are
  counted in canonical FR-023; the historical `npm.cmd` and conditional-flow context remains here
  without a second UTC mechanism.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns Windows-safe
  command-boundary helpers; [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246)
  records this consolidation.
- **promotion:** Selected, without implementation, as Product #222's PowerShell-compatible
  conditional-flow contract. FR-023 remains the separate typed UTC-normalization contract; do not
  create a second PowerShell UTC framework.

  **2026-08-15 consolidation note:** This immutable ID preserves the two observed sessions. Its
  duplicate UTC mechanism is accounted for by FR-023, whose occurrence total now includes both.

  **2026-08-15 conditional-flow correction:** The two later `&&`/`||` parse stops from Product
  issue #222 comment 5303367870 are included in this canonical FR-032 total. The selected
  PowerShell-compatible conditional-flow contract is a #222 task only; no helper implementation is
  claimed, and FR-023's separate UTC arithmetic is unchanged.

### FR-033 — GitHub label mutation returned a timeout after succeeding remotely

- **first-seen:** 2026-08-13
- **status:** `workaround-documented`
- **severity:** `LOW (unknown mutation result)`
- **symptom:** A Product #234 label update timed out at the connector, but an immediate live reread
  showed that the intended `later` and `product` labels had been applied.
- **impact:** Treating a timeout as a definitive failure could cause duplicate mutation attempts or
  an incorrect issue-state claim.
- **workaround:** For an unknown mutation result, stop and reread the exact remote state before any
  retry; record the reread rather than assuming failure or success from the transport result alone.
- **occurrences:** 1 independent occurrence — 2026-08-13.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns durable
  evidence/mutation-boundary hardening.
- **promotion:** One occurrence; retain mandatory reread as the lightweight guard until #222 can
  provide a tested helper contract.

### FR-034 — outbound human-action references were abbreviated before correction

- **first-seen:** 2026-08-13
- **status:** `workaround-documented`
- **severity:** `MEDIUM (owner-gate reference ambiguity)`
- **symptom:** Outbound GitHub writing abbreviated human-action references twice, including a
  claude-config PR #134 review comment, before correction to the exact
  `<owner>/<repo>::HUMAN_TODO.md::q-N` form.
- **impact:** An abbreviated q-N can bind the wrong repository's owner gate in a cross-repository
  programme record.
- **workaround:** Correct the affected public text and preserve the fully qualified form in current
  state/ledger evidence.
- **occurrences:** 2 independent occurrences — 2026-08-13.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  structured GitHub write-boundary preflight.
- **promotion:** At the second occurrence, the selected enforcement layer is a structured GitHub
  write preflight that rejects any human-action reference not exactly
  `<owner>/<repo>::HUMAN_TODO.md::q-N` before submission. That layer is selected but not yet
  implemented — Product #222 owns it — so this entry stays `workaround-documented` per the FR-017
  precedent until the preflight exists.

### FR-035 — coordinator temporarily misbound the fully qualified Lab Rule reference

- **first-seen:** 2026-08-13
- **status:** `workaround-documented`
- **severity:** `MEDIUM (owner-gate interpretation risk)`
- **symptom:** The coordinator temporarily read the explicit Lab Rule key
  `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-8` as the open sibling
  `Chris0Jeky/developer-lens-lab::HUMAN_TODO.md::q-8`, and drafted a false Lab write/merge
  interlock before Product publication.
- **impact:** The misread paused the Lab merge decision and created unpushed false Product state.
  No Lab rollback, merge, tag, data/model/telemetry action, protected-input inspection, or private
  action resulted from the misread.
- **workaround:** Re-read the exact `<owner>/<repo>::HUMAN_TODO.md::q-N` reference, verify
  `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-8` is CLOSED, correct the unpushed Product state,
  and resume normal Lab proof/review/aging/merge gates.
- **occurrences:** 1 independent occurrence — 2026-08-13.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  structured exact-reference write preflight;
  [Chris0Jeky/developer-lens-lab#29](https://github.com/Chris0Jeky/developer-lens-lab/issues/29)
  retains the release slice.
- **promotion:** This is another manifestation of FR-034. Use its selected structured exact-ref
  preflight under Product #222; do not claim unauthorized prior Lab writes or introduce a second
  enforcement layer.

### FR-036 — Windows default decoding obscured a state-patch target

- **first-seen:** 2026-08-14
- **status:** `workaround-documented`
- **severity:** `LOW (documentation reconciliation tooling)`
- **symptom:** Reading UTF-8 state text through the default Windows PowerShell decoding produced
  mojibake in an em-dash-containing patch target, causing several fail-closed patch mismatches.
- **impact:** A narrow reconciliation can pause while exact source text is recovered; no incorrect
  file change was applied by the rejected patches.
- **workaround:** Re-read the target with `Get-Content -Encoding utf8`, then use the exact
  heading-bounded patch and inspect the resulting diff.
- **occurrences:** 1 immutable occurrence — 2026-08-14. Consolidated pointer: this
  default-decoding patch-context mechanism is counted in promoted FR-014; FR-029 (review-content
  decoding) and FR-027 (stale patch context) remain related but distinct.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns Windows-safe
  text/evidence helper hardening;
  [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246) owns the
  occurrence-consolidation sweep for this recurrence cluster.
- **promotion:** Consolidated pointer to FR-014's promoted explicit UTF-8 decoding rule and Product
  #222's selected command-boundary hardening. Do not create a second Markdown tool.

  **2026-08-15 consolidation note:** The event and ID remain immutable. FR-014 now counts this
  recurrence, so this entry no longer carries a separate mechanism total.

### FR-037 — fresh reconciliation worktree lacked installed Node dependencies

- **first-seen:** 2026-08-14
- **status:** `workaround-documented`
- **severity:** `LOW (local proving bootstrap)`
- **symptom:** `npm.cmd run verify:context` failed before reading repository context because the
  isolated worktree had no `fast-glob` installation.
- **impact:** The required documentation proof cannot start in a fresh worktree until its declared
  local dependency bootstrap completes; no repository or GitHub state changed.
- **workaround:** Run the canon-required `npm ci` in the isolated worktree, then rerun the exact
  verifier and diff checks. `npm.cmd` remains required by FR-032's execution-policy workaround.
- **occurrences:** 1 immutable occurrence — 2026-08-14. Consolidated pointer: this fresh-worktree
  dependency-bootstrap predicate is counted in promoted FR-012.
- **task:** [Product #200](https://github.com/Chris0Jeky/developer-lens/issues/200) retains this
  release-governor worktree proof context; [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246)
  records this consolidation.
- **promotion:** Consolidated pointer to FR-012's canon-required `npm ci` preamble. No new
  enforcement is selected.

  **2026-08-15 consolidation note:** The event and ID remain immutable; FR-012 now counts this
  sixth occurrence.

### FR-038 — folded YAML state text required single-quote escaping

- **first-seen:** 2026-08-14
- **status:** `workaround-documented`
- **severity:** `LOW (state-artifact syntax)`
- **symptom:** A reconciliation edit inserted apostrophes into a single-quoted folded YAML scalar,
  so `verify:context` correctly rejected the state artifact before accepting the update.
- **impact:** The live-state verifier failed closed; no invalid state was committed or published.
- **workaround:** Double apostrophes inside single-quoted YAML scalars and rerun the exact context
  verifier before staging.
- **occurrences:** 1 independent occurrence — 2026-08-14.
- **task:** [Product #200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns current
  release-state reconciliation.
- **promotion:** One authoring occurrence; retain the existing parser gate and focused verifier as
  the proportional enforcement layer.

### FR-039 — malformed PowerShell GraphQL field forms failed before read-only review evidence

- **first-seen:** 2026-08-14
- **status:** `workaround-documented`
- **severity:** `LOW (read-only GitHub evidence friction)`
- **symptom:** Two malformed PowerShell `gh api graphql` field forms failed before the review query
  could execute.
- **impact:** Exact-head review evidence was delayed, but neither attempt mutated GitHub or repository
  state.
- **workaround:** Serialize GraphQL variables as JSON through stdin; the equivalent read succeeded
  without mutation.
- **occurrences:** 2 immutable independent occurrences — one episode comprising two malformed field
  forms on 2026-08-14; one inline-query argument failure on 2026-08-15, recorded by
  [Product issue #222 comment 5299863958](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5299863958).
  Consolidated pointer: both are counted in canonical FR-022's quoted/native-argument mechanism.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe structured GitHub command boundary.
- **promotion:** Consolidated pointer to FR-022's Product #222 structured-query/JSON-stdin boundary.
  FR-026 remains related only where its explicit-scalar object-expansion predicate is present; no
  new GraphQL mechanism or structure is selected.

  **2026-08-15 recurrence note:** An inline GraphQL query with escaped repository strings was
  distorted at the PowerShell/native argument boundary; GraphQL received `developer-lens` as an
  expression and rejected the malformed `-lens` number. The successful read moved owner, repository
  name, and integer PR number into structured GraphQL variables and passed the query as one scalar,
  returning an empty, complete review-thread list. The failed call mutated neither GitHub nor the
  repository.

  **2026-08-15 consolidation note:** This immutable ID preserves the two observed GraphQL events.
  FR-022's total now includes both; this pointer avoids hiding the existing canonical promotion.

### FR-040 — concurrent duplicate Lane-P merge invalidated old-base eligibility evidence

- **first-seen:** 2026-08-14
- **status:** `workaround-documented`
- **severity:** `MEDIUM (cross-repository concurrent-lane evidence)`
- **symptom:** A duplicate Lane-P PR #75 merged while PR #74 was under exact review, advancing the
  base and invalidating the older PR #74 eligibility snapshot.
- **impact:** The obsolete PR could not be safely merged from its old base. This is a recurrence of
  Lab FR-070, not a Product defect.
- **workaround:** Stop the obsolete merge decision, re-sense live state, mechanically blob-compare
  the C0 artifacts, preserve the unique docs/friction branch history, and close the duplicate as
  superseded. The concurrent record is preserved by
  [Chris0Jeky/developer-lens-lab#73 comment 5290683157](https://github.com/Chris0Jeky/developer-lens-lab/issues/73#issuecomment-5290683157).
- **occurrences:** 1 recurrence observed during the 2026-08-14 Lane-P final review.
- **task:** [Chris0Jeky/developer-lens-lab#73](https://github.com/Chris0Jeky/developer-lens-lab/issues/73)
  owns the recurrence record; [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222)
  retains shared command-boundary debt.
- **promotion:** A per-worktree lease is insufficient against repository-wide duplicate lanes.
  Select/propose a repository-wide issue-and-owned-path lane claim before future concurrent
  cross-repository release slices.

### FR-041 — Windows long-path failure interrupted clean Lab Lane-P worktree removal

- **first-seen:** 2026-08-14
- **status:** `workaround-documented`
- **severity:** `LOW (safe cleanup boundary)`
- **symptom:** Plain removal of the clean coordinator-owned Lab Lane-P worktree failed partway with
  Windows `Filename too long`.
- **impact:** Git removed the worktree registration, but the directory remains with a stale `.git`
  marker pointing to missing metadata; some ignored regenerable content may have been deleted.
- **workaround:** The pre-removal audit showed zero nonignored changes and preserved remote branch
  `37f1974a`. Only top-level regenerable ignored runtime/build/test/cache outputs and an ignored
  generated view were listed; their contents were not inspected. No force removal, manual recursive
  deletion, cache inspection, or branch deletion occurred.
- **occurrences:** 1 independent occurrence — 2026-08-14.
- **task:** [Chris0Jeky/developer-lens-lab#77](https://github.com/Chris0Jeky/developer-lens-lab/issues/77)
  owns durable safe-cleanup follow-up.
- **promotion:** Exact resume is a human or next bounded cleanup using a verified Windows
  long-path-aware native route. Do not retry broad cleanup from this Product reconciliation.

### FR-042 — exact-head adversarial review was commissioned without an inline diff patch

- **first-seen:** 2026-08-14
- **status:** `workaround-documented`
- **severity:** `LOW (review evidence cost and scope assurance)`
- **symptom:** A fresh-context adversarial review was tasked with only a worktree path, a base SHA,
  and a changed-file list; the read-only reviewer runs no Git commands, so it had to reconstruct
  the diff by comparing base-checkout and branch-worktree file copies.
- **impact:** Review cost rises and the diff scope is asserted rather than mechanically proven
  inside the review context, so an out-of-scope hunk could in principle pass unseen; the reviewer
  also cannot confirm the worktree HEAD it was reading.
- **workaround:** The reviewer compared base and branch copies file by file and verified the
  ledger/friction changes were pure appends; the coordinator separately proved the three-file diff
  scope and the exact HEAD mechanically before and after the review.
- **occurrences:** 1 independent occurrence — 2026-08-14.
- **task:** [Product #216](https://github.com/Chris0Jeky/developer-lens/issues/216) owns
  review-prompt hardening: review-commissioning prompts should carry the unified diff or a
  mechanically generated patch artifact inline.
- **promotion:** One occurrence; at a second occurrence fold the inline-patch requirement into the
  DL-P review prompt bodies rather than adding a new mechanism.

### FR-043 — bounded Product queue scout overran and was interrupted

- **first-seen:** 2026-08-14
- **status:** `promoted`
- **severity:** `LOW (queue-observation cost)`
- **symptom:** A bounded Product #200 queue scout exceeded its intended observation window and was
  interrupted before producing a complete, directly usable snapshot.
- **impact:** The release-truth repair needed a fresh structured reread instead of relying on the
  incomplete scout output; no repository or GitHub mutation occurred.
- **workaround:** Use a direct structured snapshot of the named Product/Lab refs, checks, review
  state, and issue state before making a release-truth claim.
- **occurrences:** 2 independent occurrences — Product #200 comment `5298981016` on 2026-08-14 and the 2026-08-15 recursive estate-registry search timeout.
- **task:** [Product #200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns the bounded
  release-governor queue; [Chris0Jeky/claude-config#133](https://github.com/Chris0Jeky/claude-config/issues/133)
  owns the affected registry/fallback route.
- **promotion:** Promoted at the second independent occurrence to a direct named-path snapshot plus
  one fallback-map read. A recursive broad search is not an acceptable prerequisite for a routing
  claim; retain an incomplete/timed-out search as explicit coverage and use the bounded direct route.

  **2026-08-15 promotion note:** A recursive estate-registry search timed out before completing.
  The exact canonical-path absence and fallback-map omission were then checked directly, so the
  timeout did not create an evidence gap. This is a scout-timeout recurrence, distinct from and
  additionally counted by FR-053's registry-absence predicate; #133 owns the fallback route.

### FR-044 — mandated browser-client discovery found no available browser

- **first-seen:** 2026-08-15
- **status:** `promoted`
- **severity:** `LOW (visual-QA tooling availability)`
- **symptom:** The Product #200 visual-QA executor initialized the mandated browser-client surface
  and followed bootstrap troubleshooting, but browser discovery returned no available browsers.
- **impact:** Agent browser/visual QA could not produce the required proof, so the owner handoff at
  `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c)` cannot yet begin.
- **workaround:** Park safely. Do not use standalone Playwright or an alternate-browser fallback;
  the required browser skill already enforces that stop.
- **occurrences:** 5 independent occurrences — Product #200 comment `5299321093` and the
  2026-08-15 Product #200/public-showcase browser-client preflight.
- **task:** [Product #200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns release
  preparation and the parked QA lane.
- **promotion:** Promoted at the second independent occurrence: Product #200 lane selection must
  confirm at least one connected browser before allocating visual QA; otherwise park the lane.
  Connector provisioning remains external task debt because repository code cannot create a connected
  browser. No standalone or alternate-browser fallback is authorized; the
  `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c)` gate remains parked pending required proof.

  **2026-08-15 Product #200 recurrence note:** The mandated browser client was loaded for public
  showcase QA, `getForUrl` found no browser, bootstrap troubleshooting was read, and the one permitted
  browser list was empty. No navigation, proof, mutation, or protected-data access occurred.

  **2026-08-15 third-preflight note:** The mandated browser preflight again found no available
  browser after troubleshooting and an empty permitted inventory (`[]`). No navigation, server,
  npm, screenshot, alternate-browser fallback, mutation, or protected-data access occurred. This
  third occurrence is recorded by [Product issue #222 comment 5303399568](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303399568)
  and remains owned by [Product #200](https://github.com/Chris0Jeky/developer-lens/issues/200).

  **2026-08-15 fourth-preflight note:** The required in-app-browser selector returned exactly
  `Browser is not available: iab` before tab, navigation, screenshot, server, or protected-data
  access. No alternate browser was attempted. [Product #200 comment 5304336245](https://github.com/Chris0Jeky/developer-lens/issues/200#issuecomment-5304336245)
  records this fourth occurrence. QA remains parked until an in-app browser is connected, and
  `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c)` remains downstream.

  **2026-08-15 fifth-preflight note:** Connected in-app browser setup and troubleshooting
  completed, but the one permitted inventory read returned `[]`. No navigation, fallback browser,
  server, protected-data access, or visual proof occurred. This independent fifth occurrence is
  recorded by [Product #200 comment 5304287388](https://github.com/Chris0Jeky/developer-lens/issues/200#issuecomment-5304287388)
  and [Product #222 comment 5304288086](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5304288086).

### FR-045 — `$Args` parameter shadowed PowerShell's automatic `$args`

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only GitHub helper reliability)`
- **symptom:** A PR #249 review helper declared a parameter named `$Args`, shadowing PowerShell's
  automatic `$args` variable. `gh` therefore ran without the intended arguments and emitted help
  text; `ConvertFrom-Json` then failed with `Invalid JSON primitive: Work.`
- **impact:** The intended read-only GitHub snapshot was not collected by that invocation and had to
  be repeated; no repository or GitHub mutation occurred.
- **workaround:** Rename the parameter to `$GhArguments`, capture the command output as one scalar
  string through `Out-String`, and pass that scalar to `ConvertFrom-Json`.
- **occurrences:** 1 independent occurrence — Product PR #249 exact-head review, recorded by Product
  issue #222 comment `5299611271` on 2026-08-15.
- **task:** [Product issue #222 comment 5299611271](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5299611271)
  owns the Windows-safe governor-helper debt.
- **promotion:** One occurrence; no new enforcement layer is justified yet. On recurrence, Product
  #222 is the selected task-debt layer for the cheapest checked Windows-safe helper rather than
  another ad hoc workaround.

### FR-046 — GitHub database IDs overflowed Int32 while PowerShell errors left exit zero

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `MEDIUM (GitHub evidence false-success risk)`
- **symptom:** PR #249 thread-triage reporting cast 10-digit GitHub review-comment database IDs to
  `System.Int32`. Each overflow raised a non-terminating PowerShell error, but the compound command
  still exited 0.
- **impact:** A governor helper can omit or corrupt result identifiers while reporting a successful
  command, weakening the evidence used to decide whether review debt is resolved.
- **workaround:** Treat the compound result as unproven and perform a separate pagination-complete
  read. That read verified all four threads resolved; no duplicate reply or mutation retry was
  issued.
- **occurrences:** 1 independent occurrence — Product issue #222 comment `5299759496` on
  2026-08-15.
- **task:** [Product issue #222 comment 5299759496](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5299759496)
  owns the Windows-safe governor-helper debt.
- **promotion:** One occurrence; keep this `workaround-documented`. Product #222 owns the cheapest
  future enforcement: retain GitHub database IDs as strings or Int64 and make a helper fail when
  PowerShell emits error records, not only when a native process returns a nonzero exit code.

### FR-047 — Git path rendering caused a false guard mismatch

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (worktree guard evidence)`
- **symptom:** The guard compared Git's forward-slash top-level path rendering with a Windows
  backslash path literal and reported a mismatch although the worktree, branch, exact HEAD, and
  clean status matched.
- **impact:** A safe pinned-worktree task can pause before orientation despite no actual state
  mismatch.
- **workaround:** Normalize both resolved paths before comparing them, then separately prove branch,
  HEAD, and porcelain status.
- **occurrences:** 3 independent occurrences — 2026-08-15 during Product #200 resume repair,
  during Product #246's pinned-worktree guard, and during the scoped branch preflight.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe evidence-helper boundary.
- **promotion:** At the second occurrence, Product #222 owns the cheapest checked normalized-path
  guard helper. Until it exists, retain explicit normalization before comparing top-level paths and
  separately prove branch, HEAD, and porcelain status.

  **2026-08-15 recurrence note:** Git again rendered the same top-level path with forward slashes,
  while the guard's literal used Windows separators. No state mismatch existed; a normalized
  comparison is required before treating the guard as failed.

  **2026-08-15 third-occurrence note:** A forward-slash/backslash false root mismatch stopped
  before branch creation, as recorded by [Product issue #222 comment 5303605491](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303605491).
  Resolved-path case-insensitive comparison plus separate HEAD and porcelain checks passed; only
  then was the scoped branch created. The checked normalized-path helper remains unimplemented.

### FR-048 — PowerShell loop syntax typo stopped a read-only state inventory

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only authoring interruption)`
- **symptom:** A PowerShell inventory used an invalid loop form and stopped with an unexpected-token
  parser error before it read or changed repository state.
- **impact:** The state-structure inventory had to be reissued, delaying a bounded documentation
  repair without weakening any evidence.
- **workaround:** Use PowerShell's `foreach (...)` form and rerun the same read-only command.
- **occurrences:** 1 independent occurrence — 2026-08-15 during Product #200 resume repair.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe helper and command-boundary debt.
- **promotion:** One invalid-loop-form occurrence; no new enforcement layer is justified. Keep the
  command bounded and parse-fail-closed; reconsider a checked helper only if this exact invalid-loop
  form recurs independently.

### FR-049 — failed CI log transport truncated before complete retrieval

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (hosted-failure evidence coverage)`
- **symptom:** `gh run view --log-failed` returned enough of the failed Product PR #251 run to
  identify the single current-state assertion, but the 405-line response exceeded the transport's
  10,024-token output limit and was truncated.
- **impact:** A session cannot claim a complete failed-log inspection from that response, even
  though the run metadata and the decisive assertion are available.
- **workaround:** Treat the full log as NOT VERIFIED; retain the run metadata and exact failed test
  as bounded evidence, make no second log fetch or filtered retrieval, and prove the correction with
  the focused test plus the hosted rerun.
- **occurrences:** 8 independent occurrences — Product issue #222 comment `5300160711`, the
  2026-08-15 PR #251 post-merge discussion-timeline transport truncation recorded by
  [Product issue #222 comment 5300291636](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5300291636),
  the 2026-08-15 combined memory/skill read transport truncation, and the 2026-08-15 PR #256
  combined-source review read transport truncation, plus the 2026-08-15 PR #256 bounded reread
  after a transport truncation.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns bounded
  retrieval that retains completeness status; [Product #252](https://github.com/Chris0Jeky/developer-lens/issues/252)
  records this mandatory evidence fix.
- **promotion:** At the second occurrence, #222 owns a completeness-aware bounded retrieval
  contract: record a surface as complete or transport-truncated, preserve only decisive observed
  facts, and refuse totals not completely collected. Do not retry, filter, or recollect merely to
  fill a truncated response.

  **2026-08-15 recurrence note:** The required PR #251 delayed sweep at T+10m07 proved the exact
  merge SHA, 8/8 resolved threads, zero late Codex findings, and zero closing refs, but its merged
  discussion timeline was transport-truncated. The collector correctly refused to assert a total
  comment count and did not retry, filter, or recollect; the truncation changes no PR #251 verdict.

  **2026-08-15 Product #257 UTF-8 review note:** The combined exact base-to-head code and
  documentation diff was transport-truncated before review was complete. Bounded per-file diffs
  were required for the textual review; this recurrence preserves FR-049's completeness-aware
  promotion and Product #222 ownership.

  **2026-08-15 Product PR #263 review note:** A fresh reviewer tool call transport-truncated the
  same combined four-file diff before review was complete. Bounded per-file reads completed the
  review; this independent call retains FR-049's completeness-aware promotion and Product #222
  ownership.

  **2026-08-15 recurrence note:** A combined memory/skill read transport-truncated. The combined
  response was not treated as complete; bounded individual reads recovered only the exact policy
  facts needed for the review. This remains current canonical transport-truncation coverage and does
  not settle whether a future broader-source class should be separate.

  **2026-08-15 recurrence note:** A PR #256 combined-source review read transport-truncated. The
  response was not treated as complete; only bounded relevant sections were reissued, with no total
  or inference asserted from the truncated response. This is the fourth canonical occurrence.

  **2026-08-15 recurrence note:** A PR #256 final-fix combined source response transport-truncated.
  It was not treated as complete; only bounded relevant sections were reread for the snapshot
  reconciliation, with no total or completeness claim. This is the fifth canonical occurrence.

  **2026-08-15 Product PR #260 review note:** A combined five-file high-context diff transport
  truncated. The response was not treated as complete; bounded separate code, test, log, and ledger
  diffs completed the review. This sixth occurrence retains FR-049's completeness-aware promotion
  and Product #222 ownership.

### FR-050 — local Windows full gate rejects invented storage-v3 artifact roots

- **first-seen:** 2026-08-15
- **status:** `promoted`
- **severity:** `MEDIUM (local full-gate limitation)`
- **symptom:** On a documentation-only Product PR #251 fix round, `npm.cmd run check` reached its
  full Vitest stage but failed broadly in unrelated storage/activation suites with
  `StorageV3ArtifactError: STORAGE_V3_ARTIFACT_INVALID`. The representative first-failing suite,
  `npm.cmd test -- server/storage/v3ShadowSweepIntegration.test.ts`, reproduced all four failures
  at `createStorageV3ArtifactRoot` before the changed documentation seam.
- **impact:** The local full gate is NOT VERIFIED for this head. Its red result cannot disprove the
  focused current-state correction or be represented as a regression from the docs-only range.
- **workaround:** Do not change code or tests in this documentation fix round. Retain the passing
  focused state contract and context proofs, record the exact local signature, and rely on the
  required hosted rerun for the corrected head.
- **occurrences:** 2 diagnosed local-gate episodes — 2026-08-15 during Product PR #251 fix round,
  and 2026-08-15 during the independent Product #234 tracked-path guard worktree.
- **task:** [Product #234](https://github.com/Chris0Jeky/developer-lens/issues/234) owns the current
  exact-head proof; [Product #200](https://github.com/Chris0Jeky/developer-lens/issues/200) retains
  the release proof boundary.
- **promotion:** Promoted at the second independent occurrence to an exact-head hosted-CI requirement
  whenever this local full gate reaches the same `STORAGE_V3_ARTIFACT_INVALID` root. The local
  gate remains mandatory and is attempted once; do not weaken it or label it flaky. A bounded Windows
  storage-test compatibility task still needs a reproduction independent of the delivery range before
  selecting a local remediation.

  **2026-08-15 promotion note:** In the fresh Product #234 tracked-path guard worktree, `npm.cmd ci`,
  the focused 36-test validator suite, and context verification passed. The one declared `npm.cmd run
  check` attempt passed lint, context, and generated-view checks, then failed broadly in storage
  and activation tests at the exact storage-v3 root; the build stage did not run. No retry was made.
  Hosted CI for the eventual exact #234 head is mandatory.

### FR-051 — `gh pr checks` rejected an unsupported JSON field before a snapshot read

- **first-seen:** 2026-08-15
- **status:** `promoted`
- **severity:** `LOW (read-only CLI query-shape friction)`
- **symptom:** A bounded `gh pr checks --json` query requested unsupported field `conclusion` and
  failed before returning check evidence.
- **impact:** A mechanical merge snapshot can pause before collecting its stated fields, without
  changing GitHub or repository state.
- **workaround:** Reissue the query with supported fields, then confirm the exact run through
  `gh run view`; the corrected read supplied the required evidence.
- **occurrences:** 4 independent occurrences — 2026-08-15 PR #251 merge snapshot, recorded by
  [Product issue #222 comment 5300251294](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5300251294),
  plus the exact-final PR #254 `closingIssues` field rejection and unsupported `gh pr diff` path
  arguments, plus the `gh api --slurp` and `--jq` command-shape incompatibility.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns typed
  Windows-safe query-shape helpers; [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246)
  records this bounded classification.
- **promotion:** Promoted at the second independent occurrence: Product #222 owns a checked CLI
  command-shape contract that admits only supported JSON fields and command arguments before a
  read-only snapshot. Use a bounded local Git diff when the requested `gh` command has no path
  argument surface; do not retry unsupported invocation shapes.

  **2026-08-15 promotion note:** `gh pr view --json closingIssues` failed before evidence was read;
  `closingIssuesReferences` completed the bounded read. Separately, `gh pr diff` rejected path
  arguments, and the bounded local Git diff completed the required inspection. Both are the same
  CLI command-shape mechanism and select the existing #222 checked contract.

  **2026-08-15 split correction:** The installed `gh api` rejected the combined `--slurp` and
  `--jq` shape during comment collection, recorded by [Product issue #222 comment 5303399568](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303399568).
  This is the fourth CLI command-shape occurrence under FR-051 and remains covered by the selected
  #222 checked contract. The separate Python module-interface mismatch remains canonical under
  FR-071 and is not counted here.

### FR-052 — mechanical review-thread summary disagreed with its complete source

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `MEDIUM (merge-snapshot count integrity)`
- **symptom:** A mechanical snapshot reported seven review threads while its pagination-complete
  source surface contained eight.
- **impact:** A merge snapshot can misstate review-debt coverage even when the underlying source is
  complete; no merge judgment relied on the incorrect count.
- **workaround:** Use the one permitted bounded remeasure. Pagination-complete GraphQL established
  total 8, resolved 8, unresolved 0, outdated 1.
- **occurrences:** 1 independent occurrence — 2026-08-15 PR #251 merge snapshot, recorded by
  [Product issue #222 comment 5300251294](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5300251294).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns small typed
  count assertions; [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246) records
  this bounded classification.
- **promotion:** One count-integrity occurrence. On recurrence, #222 must add a checked source-total
  assertion; do not reopen PR #251 or create a second documentation patch.

### FR-053 — estate-registry absence left no Developer Lens fallback route

- **first-seen:** 2026-08-15
- **status:** `promoted`
- **severity:** `LOW (cold-start routing coverage)`
- **symptom:** A review-hop lookup found the canonical estate registry absent and its fallback REPOS
  map missing the Developer Lens row.
- **impact:** A cold-start coordinator lacks the expected routing fallback and must rely on the
  repository's local canon rather than treating the absent external surface as current authority.
- **workaround:** Re-read the local `AGENTS.md`, `CLAUDE.md`, tier declaration, and live Git state;
  retain the missing external registry/fallback result as explicit coverage, not a safe default.
- **occurrences:** 3 independent occurrences — 2026-08-15 PR #251 review hop, recorded by
  [Product issue #222 comment 5300234735](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5300234735),
  the 2026-08-15 exact-final PR #254 review hop, and its recursive estate-registry search.
- **task:** [Chris0Jeky/claude-config#133](https://github.com/Chris0Jeky/claude-config/issues/133)
  owns deployed registry/fallback routing; [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246)
  records this bounded classification.
- **promotion:** Promoted at the second independent occurrence: [Chris0Jeky/claude-config#133](https://github.com/Chris0Jeky/claude-config/issues/133)
  owns the cheapest checked fallback-presence contract for the canonical estate registry and its
  Developer Lens fallback row. Do not conflate it with FR-031's stale deployed-row predicate.

  **2026-08-15 promotion note:** The exact-final PR #254 review again found the canonical estate
  registry absent and the fallback REPOS map without a Developer Lens row. Bounded local canon and
  live-Git inspection completed successfully, so the absence remains explicit coverage rather than
  an evidence gap. This second independent event selects the existing #133 fallback-presence
  contract; no duplicate Product helper or retry mechanism is introduced.

  **2026-08-15 recurrence note:** The later recursive search again found the canonical registry
  absent and the fallback REPOS map without a Developer Lens row. Its timeout is recorded separately
  under FR-043; the confirmed absence is this entry's third independent occurrence and remains
  owned by [Chris0Jeky/claude-config#133](https://github.com/Chris0Jeky/claude-config/issues/133).

### FR-054 — unspecified PowerShell parse failure interrupted a read-only audit

- **first-seen:** 2026-08-15
- **status:** `promoted`
- **severity:** `LOW (read-only command authoring interruption)`
- **symptom:** A read-only PowerShell audit command stopped with a parser error and was reissued
  successfully; the available evidence does not establish FR-048's specific invalid-loop form.
- **impact:** The audit had to be repeated before it could produce evidence, without changing
  repository or GitHub state.
- **workaround:** Reissue the bounded read-only command after correcting its syntax; preserve the
  parse failure as distinct coverage rather than guessing a loop-specific cause.
- **occurrences:** 3 independent occurrences — 2026-08-15 PR #251 review hop, the later
  branch/target preflight recurrence, and the inline object-literal branch/target preflight parser
  stop, recorded by
  [Product issue #222 comment 5300234735](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5300234735).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe command-boundary helper debt; [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246)
  records this bounded classification.
- **promotion:** Promoted at the second independent occurrence to Product #222's checked parse-safe
  command contract. Do not merge it into FR-048 without the exact loop-form evidence; the #222 helper
  is not implemented.

  **2026-08-15 recurrence note:** The read-only branch/target preflight produced a second parser
  error. Explicit intermediate variables completed the bounded read. This recurrence selects the
  #222 parse-safe contract but does not claim that its helper is implemented, as recorded by
  [Product issue #222 comment 5303399568](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303399568).

  **2026-08-15 third-occurrence note:** An inline object-literal branch/target preflight produced
  a third parser stop. Explicit intermediate variables completed the bounded retry; no repository
  or GitHub mutation occurred. The existing Product #222 parse-safe contract remains selected but
  is NOT implemented, as recorded by [Product issue #222 comment 5303591137](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303591137).

### FR-055 — PowerShell variable interpolation made a field-count scan unparsable

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only proof authoring interruption)`
- **symptom:** A PowerShell mechanical-scan pattern placed `$field:` inside an interpolated string,
  which the parser rejected before the scan read the friction log.
- **impact:** The bounded proof had to be reissued with an explicitly delimited variable reference;
  no repository or GitHub state changed.
- **workaround:** Use `${field}` where a variable is immediately followed by a colon in an
  interpolated PowerShell string, then rerun the exact read-only scan.
- **occurrences:** 1 independent occurrence — 2026-08-15 Product #246 mechanical-log proof.
- **task:** [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246) owns this
  one-file consolidation proof; [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222)
  retains the broader Windows-safe helper debt.
- **promotion:** One exact interpolation predicate. Do not merge it into FR-048 or FR-054; a
  recurrence would make #222's checked command-construction helper the cheapest enforcement layer.

### FR-056 — hand-built GraphQL closing syntax failed before a thread snapshot

- **first-seen:** 2026-08-15
- **status:** `promoted`
- **severity:** `LOW (read-only query authoring interruption)`
- **symptom:** A fresh reviewer hand-built a GraphQL query with malformed closing syntax; it failed
  before returning review-thread evidence.
- **impact:** The exact-head thread snapshot had to be reissued, without changing GitHub or
  repository state.
- **workaround:** Correct the query syntax and use the pagination-complete read; the corrected
  query returned zero threads.
- **occurrences:** 5 independent occurrences — PR #252 fresh review at
  `3fd004fec41ff96a03ef63e7a7802fa429841c00`, recorded by
  [Product issue #222 comment 5300314833](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5300314833),
  and the 2026-08-15 exact-final PR #254 review.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns typed
  query-shape helpers; [Product #252](https://github.com/Chris0Jeky/developer-lens/issues/252)
  records this mandatory evidence classification.
- **promotion:** Promoted at the second independent occurrence to Product #222's checked
  query-construction contract. Do not merge it into FR-039's malformed PowerShell field-form
  predicate or FR-054/FR-055's PowerShell parser predicates; use a syntactically complete formatted
  query before the bounded read.

  **2026-08-15 promotion note:** A hand-built GraphQL query again omitted its closing brace and
  failed before it returned evidence; the formatted complete query succeeded. This second event
  selects #222's existing query-construction contract without introducing another GraphQL mechanism.

  **2026-08-15 Product PR #258 review note:** The first direct-node GraphQL review-thread query
  had a closing-brace syntax error. The corrected bounded query succeeded, so no GitHub mutation or
  evidence gap resulted. This third occurrence retains Product #222's promoted query-construction
  mechanism and ownership.

  **2026-08-15 Product PR #262 review note:** The first bounded GraphQL thread query had an extra
  closing brace. The corrected query returned zero threads, with no GitHub mutation or evidence gap.
  This fourth occurrence retains FR-056's promoted query-construction mechanism and Product #222
  ownership.

  **2026-08-15 Product PR #263 triage note:** A bounded review-thread GraphQL query had one extra
  closing brace and failed at GraphQL syntax before collection or mutation. The corrected checked
  multiline query succeeded. This fifth occurrence retains FR-056's promoted query-construction
  mechanism and Product #222 ownership.

### FR-057 — `rg` discovery named a nonexistent `tests/` directory

- **first-seen:** 2026-08-15
- **status:** `promoted`
- **severity:** `LOW (read-only discovery interruption)`
- **symptom:** A read-only fresh-context review invocation named a nonexistent `tests/` directory,
  so `rg` exited 1 before it could inspect that target.
- **impact:** The bounded discovery step had to select existing paths before it could complete,
  without a repository mutation or evidence gap.
- **workaround:** Inspect only the bounded existing paths relevant to the review; that follow-up
  read completed successfully.
- **occurrences:** 2 independent occurrences — 2026-08-15 exact-head review hop and the guessed
  absent taskdeck/README.md target.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe command/discovery boundary.
- **promotion:** Promoted at the second independent occurrence: Product #222 owns the checked
  existing-path preflight for bounded discovery commands. It is not implemented. Keep it distinct
  from FR-058's skill paths and FR-073's glob parsing; do not add a generic retry.

  **2026-08-15 recurrence note:** A guessed absent `taskdeck/README.md` discovery target stopped
  the bounded read; other explicit paths completed it without mutation, as recorded by [Product #222 comment 5303704285](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303704285).

### FR-058 — continuation-skill discovery assumed an absent path

- **first-seen:** 2026-08-15
- **status:** `promoted`
- **severity:** `LOW (read-only skill-discovery interruption)`
- **symptom:** A superseder scout first named an absent continuation-skill path before locating the
  repository-local `.agents/skills/developer-lens-continuation/SKILL.md`.
- **impact:** The first bounded discovery read failed closed and delayed orientation, without a
  repository mutation or missing final skill evidence.
- **workaround:** Check the named repository-local skill path before reading it; the corrected
  bounded read supplied the applicable continuation instructions.
- **occurrences:** 3 independent occurrences — 2026-08-15 PR #254 superseder-scout hop and the
  2026-08-15 Product PR #256 final-fix orientation hop.
- **task:** [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246) records this
  bounded classification; [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222)
  retains the shared command/discovery hardening debt.
- **promotion:** Promoted at the second direct skill-path occurrence: Product #222 owns a checked
  repository-local continuation-skill-path preflight before planned skill reads. Do not change
  FR-057's reviewed `rg` exit-status scalar or merge this into its command-specific mechanism.

  **2026-08-15 Product PR #260 review note:** The first memory-skill path returned `PathNotFound`.
  The repository-local `.agents/skills/developer-lens-continuation/SKILL.md` path succeeded. This
  third occurrence retains FR-058's promotion and Product #222 ownership.

### FR-059 — guessed review-thread node ID failed before resolution

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (review-thread identity evidence)`
- **symptom:** A GraphQL resolution call used a guessed review-thread node ID after a reply and
  returned `NOT_FOUND`; a bounded pagination-complete mapping then identified the correct PRRT ID.
- **impact:** A thread can remain unresolved or be reported without an exact identity binding if a
  guessed identifier is trusted.
- **workaround:** Derive the thread node ID from a pagination-complete exact-PR mapping before the
  resolution call, then reread the resolved thread state. The failed guessed-ID call made no partial
  resolution mutation; the correctly mapped resolution completed.
- **occurrences:** 1 independent occurrence — 2026-08-15 exact-final PR #254 thread-resolution hop.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns typed
  GitHub evidence and command-boundary helpers.
- **promotion:** One review-thread identity predicate. If it recurs independently, Product #222
  should add a checked exact-PR thread-ID binding before a resolution mutation; do not conflate it
  with FR-026 scalar serialization, FR-052 count integrity, or FR-056 query syntax.

### FR-060 — expected non-success read state aborted a combined read batch

- **first-seen:** 2026-08-15
- **status:** `promoted`
- **severity:** `LOW (read-only check-state collection)`
- **symptom:** A read-only `gh pr checks` invocation returned exit 1 while checks were pending, and
  a later combined inventory batch contained an unhandled no-match search. Each expected
  non-success read state ran in a fail-fast batch and stopped later unrelated reads; no GitHub or
  repository mutation occurred.
- **impact:** An expected pending or no-match state can be mistaken for a command failure and leave
  a bounded evidence batch incomplete.
- **workaround:** Query structured PR/check and inventory status separately, or explicitly handle
  pending and no-match states without allowing them to abort unrelated reads.
- **occurrences:** 2 independent occurrences — 2026-08-15 during the Product PR #256 review/fix
  hop, and the later no-match inventory batch recorded below.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns
  Windows-safe, status-aware read helpers.
- **promotion:** At the second independent occurrence, Product #222 selects the cheapest checked
  status-aware read helper that explicitly handles pending and no-match states without aborting
  unrelated reads. Keep distinct from FR-013's timeout, FR-051's unsupported query-shape predicate,
  and FR-079's detached-branch report wrapper.

  **2026-08-15 no-match recurrence note:** A combined read-only inventory batch contained an
  unhandled no-match search and stopped before emitting lane results. Separated retries handled
  no-match explicitly and completed; no repository or GitHub mutation occurred. This second
  occurrence is recorded by [Product #222 comment
  5304288086](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5304288086).

### FR-062 — fresh-worktree full gate fails untouched storage and activation seams

- **first-seen:** 2026-08-15
- **status:** `promoted`
- **severity:** `MEDIUM (local full-gate limitation)`
- **symptom:** Product #259's standalone 300-second `npm.cmd run check` passed lint, context, and
  generated-view checks, then failed broadly in untouched storage-v3 and activation suites with
  `INVALID_TASK_INSTALLATION_KEY` and `INVALID_GITHUB_CORE_ACTIVATION_TASK_CARD_LOAD` errors.
- **impact:** The full suite and build are NOT VERIFIED for this exact head, while the focused
  current-state validator proof remains separate evidence.
- **workaround:** Preserve the one full-gate result and its exact signatures; do not change the
  unrelated storage or activation seams in this slice. A later exact-head gate must classify its own
  outcome before any publication decision.
- **occurrences:** 4 independent occurrences — 2026-08-15 Product #259 and Product #257
  fresh-worktree proofs, plus Product #257 diagnostic-path escaping.
- **task:** [Product #259](https://github.com/Chris0Jeky/developer-lens/issues/259) records this
  bounded validator delivery; [Product #200](https://github.com/Chris0Jeky/developer-lens/issues/200)
  retains the release-proof boundary.
- **promotion:** Promoted at the second independent occurrence: Product #200 owns a checked
  fresh-worktree prerequisite contract that identifies this signature before unrelated full-suite
  results are interpreted. Do not conflate it with FR-050's `STORAGE_V3_ARTIFACT_INVALID` predicate
  or change storage and activation seams in a delivery slice; exact-head hosted CI remains required.

  **2026-08-15 Product #257 recurrence note:** The standalone 300-second full gate again passed
  lint, context, and generated-view checks before failing in the same untouched storage-v3 and
  activation seams. The result is not flaky and was not retried.

  **2026-08-15 Product #257 diagnostic-path note:** The standalone gate again reached the same
  untouched storage-v3 and activation failures after lint, context, and generated-view checks. The
  build did not run; the result is not flaky and was not retried. No new mechanism is selected.

  **2026-08-15 Product #257 UTF-8 metadata note:** The standalone gate again reached the same
  untouched storage-v3 and activation failures after lint, context, and generated-view checks; build
  did not run. The result is not flaky and was not retried.

### FR-063 — PowerShell direct-after-foreach pipeline rejected a metadata inventory

- **first-seen:** 2026-08-15
- **status:** `promoted`
- **severity:** `LOW (read-only inventory authoring interruption)`
- **symptom:** A read-only file-metadata helper piped directly after a valid `foreach` form and
  stopped with `An empty pipe element is not allowed` before the inventory completed.
- **impact:** The bounded inventory had to be reissued, without a mutation or evidence gap.
- **workaround:** Collect `foreach` output into an intermediate array before piping it to the
  metadata helper; the corrected bounded inventory completes without mutation.
- **occurrences:** 2 independent occurrences — 2026-08-15 Product PR #258 final review and Product
  PR #260 review.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe inventory-helper boundary.
- **promotion:** Promoted at the second occurrence: Product #222 owns a checked inventory helper
  that captures loop output before piping while preserving bounded fail-closed behavior. Do not
  conflate this valid-foreach pipeline predicate with FR-048's invalid-loop-form predicate.

### FR-064 — tracked-text guard self-triggered on ledger evidence

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (hosted context-gate interruption)`
- **symptom:** Hosted `Verify project context` stopped because the Git-index guard recognized a
  drive-rooted user-home-path example embedded in the Product #257 implementation ledger.
- **impact:** The hosted context gate stopped before its remaining steps; no repository or external
  mutation occurred.
- **workaround:** Describe the guarded structure without reproducing a guard-matching value in
  tracked evidence, then stage documentation before running context verification because it scans
  Git-index blobs.
- **occurrences:** 1 independent occurrence — 2026-08-15 Product #257 hosted-red fix round.
- **task:** [Product #257](https://github.com/Chris0Jeky/developer-lens/issues/257) owns this
  consumer-context delivery; [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222)
  retains shared Windows-safe command and evidence-boundary debt.
- **promotion:** One self-triggering-evidence occurrence. Do not promote until an independent
  recurrence establishes that a checked authoring safeguard is warranted.

### FR-065 — PowerShell single-quoted multiline issue body stopped before native execution

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (pre-mutation command-authoring interruption)`
- **symptom:** A coordinator's multiline single-quoted PowerShell issue body contained an apostrophe,
  so parsing stopped before the native issue-creation command ran.
- **impact:** The intended issue body was not submitted; no GitHub or repository mutation occurred.
- **workaround:** Use structured JSON or standard input for multiline bodies, or a quote-safe scalar
  when the payload is short. This outer PowerShell parse predicate is distinct from FR-022's
  native-command inner-quote stripping.
- **occurrences:** 1 independent occurrence — 2026-08-15 Product PR #258 coordinator hop, recorded
  by [Product #222 comment 5301096382](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5301096382).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe command-construction boundary.
- **promotion:** One pre-native multiline-body parse occurrence. Do not promote until an independent
  recurrence establishes that a checked body-construction safeguard is warranted.

### FR-066 — canonical estate lookup was absent without fallback coverage

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (external routing-evidence coverage)`
- **symptom:** The required canonical ESTATE lookup returned `PathNotFound`. The reviewer stopped
  without inspecting a fallback registry and relied on the supplied repository/worktree identity and
  repository-local canon.
- **impact:** External registry and fallback state remain NOT VERIFIED, while the exact repository
  evidence is complete; no repository or external mutation occurred.
- **workaround:** Explicitly report the missing and uninspected external routing surfaces, then use
  pinned repository-local and live-Git evidence for the bounded review.
- **occurrences:** 1 independent occurrence — 2026-08-15 Product PR #262 review.
- **task:** [Chris0Jeky/claude-config#133](https://github.com/Chris0Jeky/claude-config/issues/133)
  owns deployed registry/fallback routing; [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246)
  records this bounded review classification.
- **promotion:** One incomplete-external-routing-coverage occurrence. Do not promote until an
  independent recurrence establishes that a checked coverage safeguard is warranted.

### FR-067 — delegated SHA payload diverged from live branch evidence

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (coordination-range evidence interruption)`
- **symptom:** A delivered task SHA literal had 41 characters, while the coordinator's recorded
  request and the live branch showed the corresponding 40-character head. The first bounded range
  failed before reading; fetching and live-branch inspection supplied the actual head, and the
  corrected bounded range succeeded.
- **impact:** Delivery and source payload divergence remains unresolved, but no mutation or evidence
  gap occurred after the live head supplied the corrected range.
- **workaround:** Validate delegated SHA length and existence against live Git before issuing range
  commands; report any source-payload divergence without attributing its origin as settled fact.
- **occurrences:** 1 independent occurrence — 2026-08-15 Product PR #262 coordination review.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) and
  [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246) own shared command and
  review-evidence hardening.
- **promotion:** One delegated-SHA divergence occurrence. Do not promote until an independent
  recurrence establishes that a checked payload-validation safeguard is warranted.

### FR-068 — UTC/local timestamp-kind mismatch produced a false age

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only evidence-timing calculation)`
- **symptom:** A PR #264 reviewer mixed a UTC timestamp with local `DateTime` semantics in an age
  calculation and obtained an impossible negative age. One bounded `DateTimeOffset` remeasure
  produced valid pull-request and head ages.
- **impact:** An uncorrected timestamp-kind mismatch can make an age-floor judgment wrong, without
  changing repository or GitHub state.
- **workaround:** Use `DateTimeOffset` for both operands in the age calculation, then retain the
  bounded remeasure as evidence.
- **occurrences:** 1 independent occurrence — 2026-08-15 Product PR #264 review.
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe evidence helper boundary.
- **promotion:** One timestamp-kind occurrence. A second independent occurrence selects a checked
  `DateTimeOffset`-only age helper under Product #222.

### FR-069 — Windows PowerShell parse stops interrupted two command boundaries

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (pre-execution command-authoring interruption)`
- **symptom:** Windows PowerShell 5.1 stopped parsing a coordinator command containing `&&`, and
  an independent read-only scout command containing `||`, before either native command executed.
- **impact:** Both bounded observations stopped before execution; no repository, Git, or GitHub
  mutation occurred.
- **workaround:** Use PowerShell-compatible statement sequencing and explicit conditional forms at
  the command boundary rather than relying on unsupported `&&` or `||` syntax.
- **occurrences:** 2 independent occurrences — the coordinator `&&` parse stop and the read-only
  scout `||` parse stop, both recorded by [Product issue #222 comment 5303367870](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303367870).
- **task:** [Product issue #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  cheapest checked Windows-safe command-boundary layer.
- **promotion:** Consolidated pointer to canonical FR-032's Product #222 conditional-flow contract;
  this ID is not an independently promoted mechanism and does not claim helper implementation.

  **2026-08-15 consolidation correction:** The two events in this immutable FR-069 pointer are
  included in FR-032's canonical four-event arithmetic. The prior promotion wording is retained by
  this dated correction only; FR-032 owns the selected PowerShell-compatible conditional-flow
  contract, while FR-069 remains a historical/consolidated pointer.

### FR-070 — Product resume state retained a merged Lab delivery as parked

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (cross-repository resume-state drift)`
- **symptom:** Product `CURRENT_STATE.md` still described merged Lab PR #87 as parked until the
  Product reconciliation PR #265 corrected the state against live Git and GitHub evidence.
- **impact:** A stale cross-repository resume claim could misroute the active delivery queue or
  preserve an obsolete blocker, even though the Lab merge was already complete.
- **workaround:** Reconcile cross-repository resume state from live Git, CI, and pull-request
  evidence before selecting work; treat recorded state as a lead rather than proof.
- **occurrences:** 1 independent occurrence — merged Lab PR #87 remained parked in Product
  `CURRENT_STATE.md` until PR #265 reconciled it, recorded by [Product #200 truth-repair contract
  comment 5303317321](https://github.com/Chris0Jeky/developer-lens/issues/200#issuecomment-5303317321).
- **task:** [Product #200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns the
  release-proof resume boundary.
- **promotion:** One-occurrence task debt; retain mandatory live SENSE and reconciliation as the
  workaround before queue selection, but do not promote this distinct event. FR-019 remains the
  separate historical predicate, and this entry does not claim a new automated reconciliation helper.

### FR-071 — collector interface and capability boundaries interrupted comment collection

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only collection interface friction)`
- **symptom:** The installed `gh` rejected `--slurp` combined with `--jq`, and the bundled
  `fetch_comments.py` rejected a positional pull-request argument, inferred `main`, and stopped
  before the delayed read-only sweep completed.
- **impact:** The first comment-collection interface attempts returned no usable collection, without
  changing repository or GitHub state.
- **workaround:** Parse raw JSON locally, and call the module's explicit
  `fetch_all(owner, repo, number)` entry point with the intended pull-request number.
- **occurrences:** 1 independent module-interface event, recorded by [Product issue #222
  comment 5303399568](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303399568).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  checked command-shape and capability contract.
- **promotion:** One module-interface occurrence remains task debt under Product #222. This is
  separate from FR-051's CLI command-shape taxonomy; the helper is NOT implemented and this entry
  does not authorize a new collector mechanism.

  **2026-08-15 split correction:** The prior combined classification grouped the `gh api
  --slurp`/`--jq` CLI shape with the Python `fetch_comments.py` positional-argument mismatch. The
  CLI event is now canonical under FR-051; this FR-071 record remains one Python module-interface
  occurrence and is not promoted. The earlier combined wording is preserved above as historical
  evidence rather than silently rewritten.

### FR-072 — review helper result-shape assumption raised a `KeyError`

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only review-evidence shape friction)`
- **symptom:** A review helper assumed a returned field shape and raised `KeyError` while reading
  comment evidence before the bounded classification completed.
- **impact:** The helper can stop a read-only evidence pass before the returned fields are inspected;
  no repository or GitHub mutation occurred.
- **workaround:** Use only documented returned fields from the project helper and preserve the raw
  response as the read authority.
- **occurrences:** 1 independent occurrence, recorded by [Product issue #222 comment 5303418489](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303418489).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the bounded
  review-evidence helper contract.
- **promotion:** One helper result-shape occurrence. Keep distinct from FR-052 count integrity and
  FR-071's positional-argument input interface; do not promote until an independent recurrence.

### FR-073 — `rg test*` was parsed as an invalid Windows positional path

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only path-selection friction)`
- **symptom:** A bounded Windows `rg test*` invocation treated the glob text as an invalid
  positional path before the intended test-file search ran.
- **impact:** A read-only search can stop before reading the intended files, without changing
  repository or GitHub state.
- **workaround:** Use explicit test paths for the bounded search; the explicit-path invocation
  succeeded.
- **occurrences:** 1 independent occurrence, recorded by [Product issue #222 comment 5303422698](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303422698).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the bounded
  Windows-safe evidence command contract.
- **promotion:** One path-selection occurrence. Keep distinct from FR-051's CLI query-shape events;
  do not create a glob framework or promote until an independent recurrence.

### FR-074 — PowerShell `-split` inside `git show` native arguments interrupted proof

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only command-boundary interruption)`
- **symptom:** PowerShell `-split` was placed inside `git show` native arguments; Git reported that
  switch `l` expects a numerical value, and the wrapper stopped before later proof.
- **impact:** A bounded read-only proof can stop before its later checks, without changing the
  repository or GitHub state.
- **workaround:** Capture native output in a scalar first, then apply `-split` in PowerShell.
- **occurrences:** 1 independent occurrence — the `git show`/`-split` proof stop recorded by
  [Product #222 comment 5303704285](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303704285).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe command-boundary helper.
- **promotion:** One occurrence remains task debt under Product #222; do not create or promote an
  operator framework. Keep distinct from FR-054's parser errors, FR-026's object expansion, and
  FR-022's quoting.

  **2026-08-15 classification-correction note:** The exact-head connector review thread [PR #270
  `PRRT_kwDOTrfxUM6ZiQes`](https://github.com/Chris0Jeky/developer-lens/pull/270) showed that the
  `Sort-Object`/`-Join` reviewer count event does not match FR-074's native symptom/workaround.
  It is not counted here and is canonical under FR-078.

### FR-075 — Markdown backticks terminated a JavaScript command template

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only command composition interruption)`
- **symptom:** Markdown backticks inside the JavaScript template used to compose a PowerShell
  command terminated the template and raised `SyntaxError: Unexpected identifier 'docs'` before
  shell, tool, or GitHub execution.
- **impact:** The composed read-only command cannot reach execution, without changing the
  repository or GitHub state.
- **workaround:** Remove delimiter-sensitive formatting from the template and keep JSON on stdin.
- **occurrences:** 1 independent occurrence, recorded by [Product #222 comment 5303704285](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303704285).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  bounded command-composition contract.
- **promotion:** One occurrence remains task debt; do not create or promote a generic templating
  framework.

### FR-076 — issue-scoped direct-comment REST paths returned HTTP 404

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only comment lookup friction)`
- **symptom:** Issue-scoped direct-comment REST paths returned HTTP 404, while repository-level
  `issues/comments/<id>` paths succeeded.
- **impact:** A bounded read-only comment lookup can stop before collecting its evidence, without
  changing repository or GitHub state.
- **workaround:** Use the repository-level `issues/comments/<id>` path for direct comment lookup.
- **occurrences:** 1 independent occurrence, recorded by [Product #222 comment 5303708410](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303708410).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  bounded comment-lookup contract.
- **promotion:** One occurrence remains task debt. Keep distinct from FR-051's unsupported-field
  and query-shape events; do not promote until an independent recurrence.

### FR-077 — a trailing digit corrupted an exact review reference

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (exact-ref evidence friction)`
- **symptom:** The final scoped review added a trailing `3` to parent SHA
  `1bbb280ef53edec44accc63a601102bee0fd290f`, so Git returned `fatal: bad revision` before reading
  the diff.
- **impact:** Exact-head review paused before the bounded diff could be read, without changing the
  repository or GitHub state.
- **workaround:** Copy and reverify exact refs, then rerun the bounded range; the corrected range
  succeeded.
- **occurrences:** 1 independent occurrence, recorded by [Product #222 comment 5303753398](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303753398).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  exact-reference evidence boundary.
- **promotion:** One occurrence remains task debt. Keep distinct from moved-HEAD ownership, path
  normalization, and unsupported fields; do not create a reference-validation framework.

### FR-078 — PowerShell cmdlet pipeline placed `-Join` as a `Sort-Object` parameter

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (cmdlet-pipeline evidence friction)`
- **symptom:** The final reviewer placed PowerShell `-Join` as if it were a `Sort-Object`
  parameter, so the read-only unique-ID count stopped.
- **impact:** Review proof was delayed, without changing the repository or GitHub state.
- **workaround:** Capture or parenthesize sorted pipeline output before applying `-join`; the
  bounded retry passed.
- **occurrences:** 1 independent occurrence, recorded by [Product #222 comment 5303735953](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5303735953)
  and [PR #270 review thread `PRRT_kwDOTrfxUM6ZiQes`](https://github.com/Chris0Jeky/developer-lens/pull/270).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  bounded cmdlet-pipeline evidence contract.
- **promotion:** One occurrence remains task debt. Keep distinct from FR-074's native arguments
  and FR-054's parser failures; no helper is implemented.

### FR-079 — report wrapper stopped on empty detached-branch output

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (reporting/command-boundary reliability)`
- **symptom:** Fresh worktree creation succeeded at detached `origin/main`, then report-only
  `.Trim()` on empty `git branch --show-current` output stopped the wrapper.
- **impact:** The wrapper stopped before reporting the intended checkout; re-sense proved the exact
  intended checkout; after successful creation, the report-only failure caused no further
  repository or GitHub mutation.
- **workaround:** Handle null or whitespace branch output explicitly before trimming, then re-sense
  the exact intended checkout.
- **occurrences:** 1 independent occurrence, recorded by [Product #222 comment 5304293054](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5304293054).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns this
  reporting/command boundary.
- **promotion:** One occurrence remains task debt; do not promote. This is distinct from FR-030's
  timestamp nulls and FR-026's object expansion.

### FR-080 — PowerShell/.NET runtime lacked `[Convert]::ToHexString` for SHA-256 proof

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only hash-proof compatibility/command-boundary)`
- **symptom:** `[Convert]::ToHexString(...)` was unavailable in the active PowerShell/.NET
  runtime during the read-only per-block SHA-256 proof. The exact error was:
  `Method invocation failed because [System.Convert] does not contain a method named
  'ToHexString'.`
- **impact:** The bounded hash proof was delayed, without changing the repository or GitHub state.
- **workaround:** Use a compatible per-byte `ToString('x2')` plus join formatter; the proof
  succeeded.
- **occurrences:** 1 independent occurrence, recorded by [Product #222 comment 5304506947](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5304506947).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe evidence-command contract.
- **promotion:** One occurrence remains task debt; do not promote or add a helper. Keep distinct
  from other formatting and PowerShell entries.

### FR-081 — unbraced native Git diff range lost the intended revision boundary

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only revision/command-boundary friction)`
- **symptom:** An unbraced `$base..HEAD` in native `git diff` arguments did not form the
  intended revision range, and Git printed usage.
- **impact:** The bounded read-only diff proof was delayed, without changing the repository or
  GitHub state.
- **workaround:** Build one scalar range as `"${base}..HEAD"` before passing it to native Git.
- **occurrences:** 1 independent occurrence, recorded by [Product #222 comment 5304526664](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5304526664).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe revision/evidence-command boundary.
- **promotion:** One occurrence remains task debt; do not promote or add a framework.

### FR-082 — terminal block comparator counted its trailing separator as content

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (read-only proof-predicate friction)`
- **symptom:** A block comparator treated a terminal entry's trailing separator CR/LF as content,
  so appending FR-080 falsely reported FR-079 changed.
- **impact:** The bounded raw-block comparison proof was delayed, without changing the repository
  or GitHub state.
- **workaround:** Normalize only the boundary trailing CR/LF after extraction before comparing
  block content; preserve all internal content and separators.
- **occurrences:** 1 independent occurrence, recorded by [Product #222 comment 5304526664](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5304526664).
- **task:** [Product #246](https://github.com/Chris0Jeky/developer-lens/issues/246) owns the
  bounded proof-predicate contract.
- **promotion:** One occurrence remains task debt; do not promote or add a framework.

### FR-083 — inline PowerShell replacement was parsed as a second method argument

- **first-seen:** 2026-08-15
- **status:** `workaround-documented`
- **severity:** `LOW (PowerShell expression/method-argument boundary proof reliability)`
- **symptom:** Inline `[Text.Encoding]::UTF8.GetBytes((Boundary $s) -replace "\r\n","\n")`
  raised `Cannot find an overload for "GetBytes" and the argument count: "2"` because
  PowerShell parsed the comma-separated `-replace` operands as separate method arguments.
- **impact:** The bounded read-only proof stopped and was delayed, without changing the repository
  or GitHub state.
- **workaround:** Assign the replacement output to a scalar before calling `GetBytes`; the
  corrected proof succeeded.
- **occurrences:** 1 independent occurrence, recorded by [Product #222 comment 5304533668](https://github.com/Chris0Jeky/developer-lens/issues/222#issuecomment-5304533668).
- **task:** [Product #222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the
  Windows-safe expression/method-argument evidence boundary.
- **promotion:** One occurrence remains task debt; do not promote or add a framework. Keep distinct
  from FR-081's native Git range, FR-080's missing API, and other PowerShell formatting entries.
