# Continuous work protocol

How an unattended Developer Lens session keeps producing finished, proven work across many waves
without inventing work, without nursing a blocked lane, and without running past a boundary it may
not move. This file is the operating loop that [PROMPT_LIBRARY.md](PROMPT_LIBRARY.md)'s
`DL-P03-OVERNIGHT-CONTINUOUS` launcher executes; the launcher is cold-start-complete, and this file
is the specification it points at.

It is a protocol, not a service: **nothing here runs by itself.** "Continuous" means repeated waves
inside one session, not background cognition between sessions.

Loop context: [README.md](README.md) · Routing: [WORK_CLASSES.md](WORK_CLASSES.md) · Recurring
checks: [MAINTENANCE_PROTOCOL.md](MAINTENANCE_PROTOCOL.md) · Ideas:
[IDEA_PROTOCOL.md](IDEA_PROTOCOL.md) · Friction debt: [FRICTION_LOG.md](FRICTION_LOG.md) ·
Cross-repository: [CROSS_REPO_CONTRACT.md](CROSS_REPO_CONTRACT.md).

<!-- continuous-execution-begin -->

## The wave

One wave is the nine-phase governor loop run to completion:

**SENSE → RECONCILE → CLASSIFY → PRIORITISE → SELECT → DELEGATE → PROVE → REVIEW →
MERGE/ARCHIVE/LEARN**

A continuous session repeats waves. The phases mean exactly what [README.md](README.md) says they
mean; this file adds only what changes when the loop repeats:

- **SENSE** is re-run at the top of every wave, not once per session. A wave that trusts the
  previous wave's snapshot will eventually merge against a moved base.
- **RECONCILE** compares live truth against the tracked record *including the artifacts the
  previous wave just wrote*. Your own last wave is a recorded claim like any other.
- **MERGE/ARCHIVE/LEARN** always terminates the wave: merge what is ready, archive what is parked
  with its unlocking event, and record what was learned in the ledger and, when it was friction, in
  [FRICTION_LOG.md](FRICTION_LOG.md).

<!-- continuous-impact-begin -->

## Impact and delivery contract

Each selected slice records an **IMPACT CONTRACT** before work starts:

1. **Consumer/question** — who needs the answer or behaviour, and the concrete question it resolves.
2. **Tangible result** — the artifact, observable behaviour, or decision that delivers value.
3. **Scope** — owned paths and explicit non-goals.
4. **Acceptance and proof** — the expected behaviour and one focused proving command that exercises it.
5. **Risk and authority** — work class, data boundary, and any owner gate; no gate is self-approved.
6. **Evidence and rollback** — ledger/docs update, safe rollback, and the condition that parks or stops the slice.

The governor repeatedly delivers tangible product/research value: bounded implementation, behaviour
tests, approved synthetic evaluation or reproduction, UX/story work, integration, packaging or
distribution/release preparation, hardening, and documentation of the resulting evidence. Docs and
governance support delivery; they are not the default queue. Pure docs/admin work is eligible only
when it corrects a safety-relevant false operational claim, satisfies an explicit request, or
directly unblocks delivery.

Keep experiment and evaluation work inside Product authority and existing tracked/pre-approved
bounds; Lab owns novel methodology. An unattended run never activates data, model, telemetry, or
credential work merely because it would improve a delivery contract.

<!-- continuous-impact-end -->

## Deterministic queue hopping

When the session needs work — at session start, after a merge, after a park, or while a review or
CI window is passively aging — it takes the **first non-empty step** of this ordered queue. The
order is fixed so that two different sessions reach the same next action from the same state.

| # | Step | Contents |
|---|---|---|
| 1 | **Truth and red state** | A false operational claim in a tracked file; a red, stale or missing required CI check; unresolved or untriaged review debt. |
| 2 | **Active delivery wave** | The next delivery step already in flight, per `CURRENT_STATE.md`. |
| 3 | **Unblockers** | Work that unblocks something already recorded as blocked. |
| 4 | **MISSION DELIVERY** | Dependency-safe tracked feature, code, test, evaluation, integration, UX, packaging, or release cards/issues, ranked by user/research value and unlock ratio. |
| 5 | **Maintenance and hardening** | Items already in the backlog or [MAINTENANCE_PROTOCOL.md](MAINTENANCE_PROTOCOL.md): drift repair, dependency triage, label/branch hygiene, friction burn-down. |
| 6 | **Critic-approved idea or polish** | An `idea`-labelled item that has passed [IDEA_PROTOCOL.md](IDEA_PROTOCOL.md) critic review, or a polish item that satisfies the legitimacy test below. |

A false claim in a tracked file outranks new feature work — step 1 is first for that reason, not as
ceremony.

**If every step is empty, the session terminates at a factual checkpoint.** It does not invent
work, widen a finished slice, or manufacture polish to stay busy. An idle slot is a valid outcome.

Bounded state repair must not monopolise a night: after a truth or red-state seam is repaired and
proven, return to the first non-empty delivery-oriented queue step.

## Anti-manufacture legitimacy test

A candidate may enter the queue only if **all three** hold:

1. **Provenance** — it is a pre-existing tracked task (issue, card, roadmap step, friction entry,
   review finding) **or** a concrete defect observed in the current work, with the observation
   recorded.
2. **Consumer** — it names the consumer it serves or the failure it prevents. "Improves quality",
   "adds coverage" and "modernises" are not consumers.
3. **Proving seam** — it has exactly one bounded proving seam: the narrowest command from the
   run-and-prove table in [CLAUDE.md](../../CLAUDE.md) that would actually exercise the change.

Anything failing the test is captured as a GitHub issue (labelled per
[IDEA_PROTOCOL.md](IDEA_PROTOCOL.md)) and left alone. Capture is cheap; promotion is expensive.

Never build control-plane infrastructure without a consumer that uses it in the same wave.

## Work while waiting

Post-push aging, hosted CI and connector review windows are **passive observation time**. During
them the session starts the next disjoint queue item.

- **Do not short-poll.** Review arrival is checked at workflow events — a PR opened or became ready,
  a review completed, fixes were pushed, a milestone completed, a PR merged, or the session scans
  for its next work — never on a timer loop.
- **Waiting is not a licence to invent work.** The legitimacy test still applies to whatever is
  started during the window; a waiting window does not lower the bar.
- **Do not strengthen a review concern with an expensive check that cannot exercise the changed
  seam.** That is manufactured work wearing a rigour costume.

## Parking, not nursing

One blocked lane is parked and the session continues. Parking records, in the lane's entry in
`CURRENT_STATE.md`:

- the exact blocker, as a verified fact rather than a guess;
- the unlocking event (a named external result, an owner decision as a fully qualified
  `<owner>/<repo>::HUMAN_TODO.md::q-N` ref, or a dependency merge);
- what is already proven, so the next session does not redo it.

Three genuinely different attempts at a red check, two review rounds, one re-measure of a disputed
fact, and roughly twice the estimate on a task are the ceilings. After a ceiling: ship what is
sound, park what is not, move on.

## Parallelism

There is **no fixed fleet size** and no target agent count. Parallelism is bounded by, in order:

1. **Useful disjoint work** — how many genuinely independent, dependency-ready lanes exist. If the
   answer is one, run one.
2. **Collision risk** — one writer per checkout, always. Parallel writers require separate
   coordinator-owned worktrees with non-overlapping owned paths. Two lanes touching the same
   contract, generated artifact or sequentially dependent behaviour become one writer plus
   read-only supporting lanes.
3. **Proof cost** — lanes whose proofs cannot run concurrently on this machine are serialised.
4. **Machine resources** — RAM, CPU and file-handle contention are real; measured contention lowers
   the active lane count, and the evidence is recorded when it does.

Pin branch and HEAD in every delegation prompt and re-verify both after each subagent returns —
subagents can move HEAD.

## Lanes this mode may never open

Regardless of queue state, a continuous unattended session does **not** open a lane that activates
or extends: real-data collection, an external model request, telemetry destinations, or credential
handling. Those are W3/W4 in [WORK_CLASSES.md](WORK_CLASSES.md) and belong to a coordinator session
or the owner. Encountering one is a queue item to record, not to execute.

Likewise it never self-relaxes a locked invariant from
[docs/OWNER_CONSTITUTION.md](../OWNER_CONSTITUTION.md) §1 or §7, and never infers an owner decision
from silence, from a merged pull request, or from another agent's message.

<!-- continuous-execution-end -->

<!-- continuous-stop-begin -->

## Stop conditions

The session stops — reports and ends, rather than working around — when any of these holds. Each is
explicit so that stopping is a decision with evidence, not a drift into silence.

### Policy stop

A locked invariant, an owner gate, the publication boundary, a `never_authorized` capability, or a
tier authority declaration would have to move for the work to proceed. Prepare options and a
recommendation; record the owner action as a fully qualified
`<owner>/<repo>::HUMAN_TODO.md::q-N` ref; do not self-authorise.

### Budget stop

The session's token or time budget is spent, or a single task has passed roughly twice its
estimate. Ship what is sound, park the rest with its unlocking event, and close with the standard
handoff headings.

### Tooling stop

A required tool, credential, network path or platform capability is unavailable and no in-scope
alternative exists. Log it under `friction-tasking-v1` in [FRICTION_LOG.md](FRICTION_LOG.md) in the
same hop, link it to an existing issue or a durable follow-up task, park the lane, and continue with
other queue items — or terminate if the queue is otherwise empty.

### Queue stop

Every step of the queue-hop table is empty. This is the normal, successful ending of a continuous
session. Terminate at a factual checkpoint:

- what changed, and what was verified with which exact command and result;
- what was NOT verified;
- failures and workarounds, with their friction-log entries;
- docs and state synchronisation performed;
- residual risk;
- human actions, as fully qualified refs;
- exact branch, HEAD, PR, check and worktree state;
- completed, blocked and ready queue items, and the next safe slice.

**Do not invent work to avoid a queue stop.** A session that finishes its queue and stops cleanly
has succeeded; a session that manufactures polish to keep running has failed the legitimacy test in
public.

<!-- continuous-stop-end -->
