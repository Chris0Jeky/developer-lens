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
5. **Patch mutable entry fields with their identity.** Change one existing entry per patch and keep
   its unique `### FR-NNN` heading in the same hunk as every `status`, `occurrences`, `task`, or
   `promotion` edit. Inspect that heading-bounded diff immediately before the next patch.

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
- **status:** `promoted`
- **severity:** `LOW (review-noise risk)`
- **symptom:** Git warned that LF would be replaced by CRLF for the four edited Markdown files.
  `core.autocrlf=true`, no file-specific `text` or `eol` attribute applies, and `git ls-files --eol`
  reported an LF index with mixed working-tree endings.
- **impact:** Repeated warnings can obscure a real diff problem or invite an unnecessary bulk
  normalization. The intended index remains LF and `git diff --check` is clean.
- **workaround:** Stage only the named files, inspect the cached diff, and run
  `git diff --cached --check`; do not normalize unrelated lines or files in this slice.
- **occurrences:** 2 independent occurrences — the four-file #200 documentation reconciliation on
  2026-08-09 and the three-file #222/#233 state reconciliation on 2026-08-10.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns the bounded
  pre-QA documentation reconciliation.
- **promotion:** Promoted at the second occurrence to a scoped repository `.gitattributes` policy,
  proved against representative Markdown and source files without a bulk normalization commit.
  #200 owns that bounded hardening; this #222 branch keeps the cached-diff workaround and does not
  detour into line-ending policy.

  **2026-08-10 promotion note:** The second slice again kept an LF index and passed
  `git diff --check`; only the Windows working-tree warning recurred. A repository attribute plus a
  focused index/checkout test is the cheapest layer that can make the intended normalization
  executable without rewriting unrelated files.

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
- **occurrences:** 1 cleanup-predicate occurrence — the 2026-08-09 canonical 468/440 report,
  timed-out first cleanup pass, bounded successful retry, and later stale-location correction. The
  approximately 20:38 BST Docker-unavailable report is a distinct evidence-availability predicate
  and is not counted as a second cleanup occurrence.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns durable Windows-safe
  governor maintenance helpers; its bounded GitHub-evidence helper does not implement an MCP
  cleanup wrapper.
- **promotion:** Deliberately NOT promoted because the Docker-unavailable measurement is not a
  second occurrence of the cleanup-timeout predicate. Retain the reviewed bounded retry and
  report-only fail-closed behavior; a second matching cleanup occurrence must select a separate
  checked MCP-hygiene layer rather than widening the GitHub-evidence helper.

  **2026-08-09 truth-correction note:** The entry's first draft inverted the initial canonical
  468/440 report and the stale-location failure, which happened only during the later re-measure.
  The corrected fields above preserve the measured cleanup sequence and the later 56/0 result.

  **2026-08-09 second-measurement note (approximately 20:38 BST):** The reviewed report-only MCP
  hygiene path measured 9,651 MB free and 0 orphan MCP processes. Docker was unreachable because
  either the daemon was down or the CLI was unavailable, so the container count was explicitly
  **unknown**, not measured zero, and the sweep was skipped. No restart or cleanup was warranted
  from the available evidence. Issue #222 still owns the selected helper above; it is not
  implemented by this documentation update.

  **2026-08-10 recurrence correction:** Product issue #222 comment `5234075441` establishes that the
  Docker-unavailable/unknown report ran no cleanup and needed no retry, so it cannot satisfy the
  second-occurrence threshold for the earlier cleanup-timeout predicate. The allowed occurrence,
  task and promotion fields now preserve those distinct failure classes. The issue #222 slice
  implements only the independently recurring GitHub command-boundary helper.

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
- **promotion:** Do not create a Product copy of the Lab-specific release/package helper. The
  cheapest enforcing layers remain the checked Lab snapshot/launcher tasks on #29/#34, with the
  current workarounds retained until those tasks land. Product #222 separately implements the
  governor's generic report-only PR snapshot boundary; it does not satisfy or replace those Lab
  checks.

  **2026-08-10 scope note:** The Product #222 helper accepts either public repository as an explicit
  read-only snapshot target, but no Lab wrapper, release rule or package-smoke behavior moved. Lab
  #29/#34 remain authoritative for their repository-specific checked snapshot and launcher tasks.

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
- **status:** `resolved`
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
- **occurrences:** 3 independent occurrences — run `31112768523` exposed immediate inode reuse in
  the sibling artifact-catalogue fixture on 2026-08-06; runs `31339262700` and `31345468111`
  independently exposed the corresponding `v3Backup` fixture on 2026-08-09 and 2026-08-10.
- **task:** [#233](https://github.com/Chris0Jeky/developer-lens/issues/233) owns the bounded durable
  fixture repair.
- **promotion:** The cheapest enforcing layer is the affected test fixture. PR #238 reused commit
  `1053cf8609108f1e7d0924bb42245185c6fce89e`'s established keep-original-inode-live pattern while
  allocating the replacement, preserved production identity checks, and proved the focused case,
  full backup file, and declared hosted gate. PR #232 took no production-code detour.

  **2026-08-10 third-occurrence note:** Product PR #237 exact head
  `b5ea92c05aa0d61225f0e7d05c6b3913a110f0eb` passed hosted context, generated-artifact and lint
  steps, then run `31345468111` failed only the same valid-replacement-inode fixture while all other
  1,505 tests passed with 2 declared skips. The PR range does not touch backup code or its fixture;
  #233 is now the active priority-one durable repair rather than another unbounded rerun.

  **2026-08-10 resolution note:** PR #238 final head
  `b08a4022550396b4da0aab877d942a433291253c` passed the focused collision case, the full backup
  file with 71 tests and 2 declared skips, lint, TypeScript build, diff hygiene, hosted run
  `31345932617`, and a clean fresh-context review. It merged without production changes as
  `e3ce2f879eee00f49e398116be428a6a7c7c8d2b`; the fixture now keeps the provisional inode live
  until a distinct replacement has been allocated.

### FR-022 — PowerShell inner-quote stripping blocked a PR232 latest-field query

- **first-seen:** 2026-08-09
- **status:** `resolved`
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
- **occurrences:** 4 independent command-boundary occurrences — 2026-08-09 during the initial PR232
  ISO-timestamp filter, the Lab PR59 commit projection/newline split, the PR232 exact-final-head
  review-thread snapshot, and the later Lab PR56 timestamp-filter projection recorded by issue #222
  comment `5234369568`.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns structured/JSON-input
  Windows-safe CLI helpers for recurring evidence queries; the checked implementation is
  `scripts/githubGovernorEvidence.ts` with `npm run governor:github`.
- **promotion:** Implemented at the selected command layer: the report-only helper launches `gh`
  without a shell, passes GraphQL values as JSON variables through stdin, performs direct typed
  gate comparisons, and fails closed on incomplete comment/review/thread/check evidence. GitHub
  writes remain outside this layer because its reply mutation cannot bind an expected revision.

  **2026-08-09 note:** The Lab PR59 commit projection/newline split is the second independently
  recorded occurrence (see #222 comment 5234236530); the PR232 exact-final-head thread snapshot is
  the third. Quote-safe projections and direct field reads succeeded without mutation. The three
  occurrences keep the path-set-order, UTC-switch, and patch-context predicates separate while
  selecting #222's structured-query helper as the durable enforcing layer.

  **2026-08-10 implementation note:** The focused synthetic suite proves hostile values remain
  GraphQL variables rather than shell text, pagination is refused, exact head/base plus exact named
  check/thread/closing-ref requirements use typed comparisons, and mutation-shaped commands fail
  before GitHub is called. A read-only Windows smoke against public Product PR #236 passed every
  exact-head requirement; no comment was manufactured for proof.

### FR-023 — Windows PowerShell lacked the requested UTC date switch

- **first-seen:** 2026-08-09
- **status:** `resolved`
- **severity:** `LOW (CLI evidence friction)`
- **symptom:** The installed Windows PowerShell rejected `Get-Date -AsUTC` while composing an
  exact-head PR evidence snapshot. The compound read-only command failed before any mutation.
- **impact:** A version-specific convenience switch can interrupt or omit the timestamp attached
  to an otherwise reproducible GitHub state snapshot.
- **workaround:** Use `(Get-Date).ToUniversalTime().ToString('o')`, which succeeded on the same
  shell without changing repository or GitHub state.
- **occurrences:** 3 independent occurrences — 2026-08-09 during the PR232 final review-thread
  snapshot, 2026-08-10 during the Lab PR60 delayed-sweep timestamp probe, and 2026-08-10 during the
  PR238/PR62 merge-boundary timestamp probe.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the bounded
  Windows-safe evidence helper and its explicit timestamp normalization.
- **promotion:** Implemented at the selected command layer after the second occurrence:
  `npm run governor:github` emits `observedAt` with JavaScript's UTC ISO serializer, removing the
  host-PowerShell date-switch dependency from PR evidence snapshots.

  **2026-08-10 implementation note:** The Lab recurrence failed before any GitHub query or mutation
  and was corrected with `[DateTime]::UtcNow.ToString('o')`. The issue #222 helper's deterministic
  UTC field is covered by a synthetic clock test and the public PR #236 read-only smoke.

  **2026-08-10 recurrence note:** A coordinator-side compound snapshot again used the unsupported
  switch and failed before the parallel read-only results were returned. Re-running with
  `(Get-Date).ToUniversalTime().ToString('o')` succeeded. The selected enforcement remains the
  repository helper for operational evidence; ad hoc shell timestamps retain this documented
  compatibility debt rather than widening the current slice into a machine-level wrapper.

### FR-024 — repeated-schema patch context selected the wrong friction entry

- **first-seen:** 2026-08-09
- **status:** `promoted`
- **severity:** `LOW (caught pre-commit content drift)`
- **symptom:** An `apply_patch` hunk that changed a common `status` field without carrying its
  `FR-022` heading matched the earlier `FR-015` entry. The mandatory immediate diff exposed the
  wrong edit before commit or push.
- **impact:** Repeated Markdown schemas make a syntactically successful patch unsafe evidence of
  the intended target; an unchecked hunk could corrupt an unrelated friction record.
- **workaround:** Restore the unrelated field and reapply the edit with the unique entry heading in
  the patch context, then inspect the complete file diff.
- **occurrences:** 2 independent occurrences — 2026-08-09 during PR232's second friction capture and
  2026-08-10 when a status-only issue #222 repair hunk selected FR-027 instead of FR-029.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the active helper
  repair and its factual friction reconciliation.
- **promotion:** Promoted at the second occurrence to this log's binding rule 5: every mutable-entry
  edit carries its unique `### FR-NNN` heading in the same hunk, changes one entry per patch, and is
  inspected before the next patch. This is the cheapest enforcing layer because `apply_patch` then
  fails on a missing identity instead of silently selecting another repeated field.

  **2026-08-10 promotion note:** Immediate diff inspection caught and restored FR-027 before commit
  or push, then the heading-bound patch correctly marked FR-029 resolved. No historical symptom,
  impact, or workaround text was rewritten.

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
- **occurrences:** 2 independent occurrences — 2026-08-10 during the Product #200 reconciliation,
  then during PR #237 review triage when `$item.id` reached `gh` as the hashtable string rather than
  the intended thread ID; GitHub rejected the unknown node before mutation.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the durable
  Windows-safe structured evidence helpers; the scalar tracked-file input remains a separate
  follow-up from the GitHub snapshot helper.
- **promotion:** Promoted at the second occurrence to the Product maintenance protocol: materialize
  file content, object properties and collection elements into explicit typed scalar variables
  before passing them as native-command arguments. This covers both observed expansion forms while
  leaving the report-only helper's deliberately narrower input contract unchanged.

  **2026-08-10 scope note:** The implemented issue #222 slice is intentionally allowlisted to
  report-only pull-request snapshots. FR-026 remains one-occurrence task debt rather than being
  silently closed by an unrelated structured-output path.

  **2026-08-10 promotion note:** The second occurrence failed before any review reply was created.
  The coordinator assigned the hashtable property to a string variable before retrying; the normal
  GitHub workflow, not the report-only helper, remains responsible for the legitimate write. This
  promotion supersedes the earlier one-occurrence task-debt scope note.

### FR-027 — worktree guard compared equivalent roots with different slash styles

- **first-seen:** 2026-08-10
- **status:** `workaround-documented`
- **severity:** `LOW (caught before worktree mutation)`
- **symptom:** The issue #222 worktree guard compared PowerShell's backslash `Resolve-Path` rendering
  with Git's forward-slash `rev-parse --show-toplevel` rendering and rejected the same repository as
  an unexpected root. The guard stopped before creating a directory, worktree or ref.
- **impact:** A correct safety preamble can block an otherwise valid isolated slice when equality is
  tested on display strings instead of canonical path values.
- **workaround:** Normalize both absolute roots to one slash style, trim only trailing separators,
  compare them, then repeat the complete guard before worktree creation.
- **occurrences:** 1 independent occurrence — 2026-08-10 while opening the issue #222 worktree.
- **task:** [#200](https://github.com/Chris0Jeky/developer-lens/issues/200) owns coordinator/worktree
  hardening and the existing worktree-lease debt.
- **promotion:** Deliberately NOT promoted after one occurrence because normalization in the guard
  is the cheapest safe workaround. A second independent occurrence should add a shared canonical
  path comparator to the coordinator preamble rather than another prose reminder.

### FR-028 — stale multi-entry patch context blocked the friction update

- **first-seen:** 2026-08-10
- **status:** `workaround-documented`
- **severity:** `LOW (fail-closed documentation tooling)`
- **symptom:** One combined `apply_patch` expected FR-022 to have status `promoted`, while live main
  still recorded `open`; patch verification rejected the whole multi-entry update before any file
  changed.
- **impact:** A broad patch built from a stale handoff can delay same-hop friction capture even when
  each intended field change is legitimate.
- **workaround:** Re-read the exact heading-bounded entries, split the update into small patches with
  unique headings and current field values, then inspect the complete diff.
- **occurrences:** 3 independent occurrences — 2026-08-10 during the issue #222 friction burn-down,
  then during its review-fix documentation reconciliation, and again while reconciling the merged
  PR #238 fixture repair when one copied multi-file hunk did not match. Every patch was rejected
  atomically before mutation.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns this bounded helper and
  its factual friction reconciliation.
- **promotion:** Retained as task debt after the second occurrence. `apply_patch` already enforces
  the safety property by rejecting the whole change before mutation; a field-aware Markdown updater
  would add a new parser without preventing copied-context mismatch. The cheapest proportional
  layer is one-file, heading-bounded patches from an immediate re-read plus the existing diff check.

  **2026-08-10 second-occurrence note:** The failed repair patch changed no file. The coordinator
  re-read the exact numbered lines, split subsequent changes by file and unique heading, and kept
  this as bounded workflow debt under #222 rather than detouring into speculative tooling.

  **2026-08-10 third-occurrence note:** The selected one-file, heading-bounded workaround succeeded
  after the failed combined patch. `apply_patch` continues to supply the correct fail-closed
  enforcement, so the proportional decision remains task debt rather than a new Markdown parser.

### FR-029 — preflighted review reply could not stay bound to the expected revision

- **first-seen:** 2026-08-10
- **status:** `resolved`
- **severity:** `HIGH (review-caught exact-revision write hazard)`
- **symptom:** Fresh-context review of the first issue #222 helper head found that it queried the
  expected PR head/base and thread membership, then issued a separate review-thread reply mutation.
  That mutation accepts only thread ID and body; a push or base move between calls could still write
  after the proved revision was no longer current. No live reply was used for proof.
- **impact:** The helper's operational exact-revision claim was false at the write boundary and
  could attach a coordinator response after the reviewed PR state changed.
- **workaround:** Remove the mutation, stdin-body and apply surfaces; keep the command strictly
  report-only and use the normal reviewed GitHub workflow for legitimate replies.
- **occurrences:** 1 independent occurrence — fresh-context review of Product PR #237 initial head
  `3af8c23e5122762f96116d170f8187d3934fcda2`.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) retains any future safe-
  write design and the remaining distinct command-boundary predicates.
- **promotion:** Enforced at the narrower executable contract: mutation-shaped operations are
  rejected before GitHub is called and the helper exposes only one bounded snapshot query. The
  focused 10-test run, server TypeScript compile, focused Oxlint, public read-only smoke, and full
  87-file `npm run check` gate passed after removal.

  **2026-08-10 resolution note:** The repair also replaced generic green-check acceptance with an
  exact required-check name plus all-observed-green condition and added top-level comments to the
  bounded snapshot. No GitHub write path remains in the helper.

  **2026-08-10 check-semantics correction:** Live PR #238 exposed one successful required run plus a
  duplicate same-named skipped run while GitHub's aggregate rollup and merge state were green. The
  raw all-observed condition was therefore a false-negative contract. The final requirement is one
  successful exact-named check plus GitHub's green aggregate rollup; FR-032 records the bounded fix.

### FR-030 — inferred full head SHA failed the exact snapshot guard

- **first-seen:** 2026-08-10
- **status:** `workaround-documented`
- **severity:** `LOW (fail-closed evidence input)`
- **symptom:** After the PR #237 documentation follow-up push, the coordinator expanded the visible
  short commit prefix into an unmeasured 40-character value instead of reading the full local head.
  The report-only helper observed the real remote head and rejected the mismatch before returning a
  gate snapshot or changing GitHub state.
- **impact:** An inferred identity wastes one evidence pass and can confuse final-head reporting if
  a fail-closed comparison is absent.
- **workaround:** Read the full local and remote SHAs with `git rev-parse`, compare them, assign the
  measured value to a typed scalar, and pass that value to `--expect-head`.
- **occurrences:** 1 independent occurrence — Product PR #237 final-head snapshot refresh after the
  scalar-boundary documentation push.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the checked exact-head
  evidence helper and this bounded input-use debt.
- **promotion:** Deliberately NOT promoted after one occurrence because the helper already enforces
  the safety property by failing closed. A second independent transcription occurrence should move
  local/remote SHA acquisition into a checked wrapper rather than add another prose reminder.

### FR-031 — a Jest-only flag made the focused Vitest review run no tests

- **first-seen:** 2026-08-10
- **status:** `workaround-documented`
- **severity:** `LOW (review proof command mismatch)`
- **symptom:** Fresh review of PR #238 first invoked the focused Vitest seam with unsupported
  `--runInBand`; the command rejected the option and executed no tests. The corrected repository-
  native invocation then passed the focused case and full backup test file.
- **impact:** Treating a familiar runner flag as portable can leave a review without the intended
  local proof until the command result is read and corrected.
- **workaround:** Use the repository's Vitest command shape (`npx vitest run <path> -t <name>`) and
  confirm the reported executed-test count before accepting the result.
- **occurrences:** 1 independent occurrence — Product PR #238 fresh-context review.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns recurring Windows-safe
  proof-command boundaries; PR #238 itself remains scoped to issue #233's fixture repair.
- **promotion:** Deliberately NOT promoted after one occurrence because the package script and
  existing run table already name Vitest. A second independent runner-flag mismatch should add an
  exact focused-test example to the Product run table rather than another prose-only workaround.

### FR-032 — a duplicate skipped run made a green GitHub rollup fail closed

- **first-seen:** 2026-08-10
- **status:** `resolved`
- **severity:** `HIGH (core evidence helper false negative)`
- **symptom:** Public PR #238 exposed two `Prove the pull request` check-run nodes on the same exact
  head: one `SKIPPED` and one `SUCCESS`. GitHub's aggregate rollup was `SUCCESS` and merge state was
  clean, but the helper's raw all-node-success predicate returned false and rejected the otherwise
  valid exact required-check snapshot.
- **impact:** The new governor evidence seam could not prove a normal green PR shape, blocking its
  primary consumer even though it remained fail-closed and performed no write.
- **workaround:** Require at least one successful exact-named check and require GitHub's aggregate
  `statusCheckRollup.state` to be `SUCCESS`; retain all raw nodes in the report for inspection.
- **occurrences:** 1 independent occurrence — Product PR #238 exact head
  `b08a4022550396b4da0aab877d942a433291253c`.
- **task:** [#222](https://github.com/Chris0Jeky/developer-lens/issues/222) owns the bounded helper and
  its exact check semantics.
- **promotion:** Enforced at the executable contract and covered with invented duplicate-check and
  disagreeing-rollup cases plus a public read-only PR #238 smoke. Focused tests, server TypeScript,
  focused Oxlint, and the full 87-file Product gate passed after the repair.

  **2026-08-10 resolution note:** The final contract still fails closed when the exact named check
  is absent or unsuccessful, or when GitHub's aggregate rollup is pending/failing. It ignores no
  raw evidence: every check node remains in the emitted snapshot for review.
