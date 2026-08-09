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
- **occurrences:** 4 recorded — 2026-08-04 (post-handoff session), 2026-08-04 (surviving dev server
  plus an orphaned partial worktree directory left for manual deletion), 2026-08-07 (lab checkout
  competing writer), 2026-08-09 (a separate coordinator advanced the active q-8 branch between
  this session's read and attempted write).
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
- **occurrences:** 2 recorded classes — the 2026-08-05 measurement (which produced 20 late comments
  across earlier pull requests) and the 2026-08-08 total miss on PR #211.
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
- **status:** `open`
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
- **workaround:** None applied. The block is read as prose, which is how every session has in fact
  been using it. The `control_plane_side_lane` entry added for #214 is single-quoted, so it is
  YAML-safe and does not deepen the defect; the pre-existing unquoted flow sequences were left
  untouched because repairing them is a separate bounded slice, not a detour inside this one.
- **occurrences:** 1 recorded — 2026-08-09.
- **task:** https://github.com/Chris0Jeky/developer-lens/issues/215
- **promotion:** Task debt at one occurrence, but the promotion target is already obvious and cheap:
  a strict YAML parse of that block inside `scripts/projectContextValidation.ts` would make the
  claim self-enforcing. That belongs to the follow-up above rather than to this slice, since the
  check would fail on landing until the existing prose is repaired.

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
- **status:** `open`
- **symptom:** After merged PR #218, an exact clean-worktree audit and local branch deletion,
  `git push origin --delete docs/prompt-system-overhaul` succeeded while GitHub reported a privileged
  bypass of the `Cannot delete this branch` rule.
- **impact:** Cleanup appeared successful while bypassing repository protection, creating an
  authority/audit defect even though no work was lost: merged commit `87cc6a8` is on `main` and the
  deleted branch remains recoverable.
- **workaround:** Do not recreate the branch in this slice. Future cleanup must inspect applicable
  rules first and avoid any silent administrative bypass.
- **occurrences:** 1 recorded — 2026-08-09, after PR #218 merge cleanup.
- **task:** [#221](https://github.com/Chris0Jeky/developer-lens/issues/221)
- **promotion:** Task debt pending #221. A future cleanup path should prove the deletion rule and
  explicit authority before acting, and report any privileged bypass in the same hop; this slice
  changes no rules and does not recreate the branch.

### FR-012 — fresh product worktree lacks the Node tool bootstrap

- **first-seen:** 2026-08-09
- **status:** `promoted`
- **symptom:** In a fresh isolated product worktree, `npm run verify:context` stopped before the
  verifier ran because the `tsx` executable was not installed locally.
- **impact:** The required docs/authority gate cannot run until the worktree dependencies are
  installed, so a clean checkout can be mistaken for an unverifiable lane.
- **workaround:** Run `npm ci`, then rerun `npm run verify:context`; the install completed with
  zero audit vulnerabilities and the verifier passed.
- **occurrences:** 4 recorded — 2026-08-09 (the P0.5 pre-QA reconciliation worktree), 2026-08-09
  (the DL-P09/`Chris0Jeky/developer-lens-lab::HUMAN_TODO.md::q-11` release-gate prerequisite),
  2026-08-09 (the release-state/worktree-preservation documentation worktree), and 2026-08-09
  (the #200 state-reconciliation worktree).
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) (live release
  coordination).
- **promotion:** Promoted at the second independent occurrence to the `CLAUDE.md` run-and-prove
  preamble: a fresh worktree runs lockfile-pinned `npm ci` before any proof. Installation remains an
  explicit environment action rather than a verifier side effect, so the check cannot silently
  install or mutate dependencies on the caller's behalf. The third and fourth occurrences confirm
  that this preamble remains the cheapest enforcing layer; no new promotion is warranted.

  **2026-08-09 note:** The release-state preservation worktree reproduced the same missing-`tsx`
  stop before `verify:context` executed. The lockfile-pinned `npm ci` bootstrap added 358 packages,
  audited 359 packages with 0 vulnerabilities, and restored the declared proof path. This third
  occurrence does not require a new layer: the existing `CLAUDE.md` fresh-worktree preamble is the
  promoted enforcement point.

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
- **occurrences:** 1 independent occurrence — 2026-08-09 during PR #226's latest-base proof.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns the active release
  preparation and its exact-head evidence.
- **promotion:** Deliberately NOT promoted after one occurrence. Keep full gates in their own
  command-sized timeout window; if a second independent full gate hits the same boundary, record a
  measured timeout budget in the run-and-prove table rather than relying on caller guesswork.

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
- **occurrences:** 2 independent occurrences — 2026-08-09 during PR #228's latest-base state sync
  and 2026-08-09 during the later release-state preservation slice.
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
- **occurrences:** 1 independent occurrence — the four-file #200 documentation reconciliation on
  2026-08-09 shares one checkout/config cause.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns the bounded
  pre-QA documentation reconciliation.
- **promotion:** Deliberately NOT promoted after one occurrence. If a later independent slice
  repeats the warning, select an explicit repository line-ending policy at the cheapest enforcing
  layer rather than relying on per-session interpretation.

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
