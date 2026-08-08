# Agent-generated idea protocol

Agents are encouraged to notice opportunities. Not every idea becomes work, and the cost of
capturing one must stay far below the cost of reasoning about it. This protocol makes capture cheap
and promotion expensive. Routing: [WORK_CLASSES.md](WORK_CLASSES.md). Loop:
[README.md](README.md).

Ideas live as **GitHub issues labelled `idea` + `agent-generated`** — the opportunity backlog, not a
tracked file. Use the state names below as **headings inside the issue body**, not as extra labels;
the queue-position label (`now`/`next`/`later`/`idea`) stays the only status label.

## States

| State | Meaning |
|---|---|
| `INBOX` | Captured. Title, one-paragraph problem, originating agent. Nothing else required. |
| `DEDUPLICATED` | Checked against open and closed issues, parked research, and rejected ideas. Duplicates are closed pointing at the original; near-duplicates are merged into one record. |
| `EVIDENCE_NEEDED` | The idea is distinct but its value claim is unsupported. Names the cheapest discriminating evidence. |
| `PROPOSAL` | Full idea record (below) filled in, with a bounded first slice and acceptance criteria. |
| `CRITIC_REVIEW` | Handed to an **independent** agent — never the originator — to challenge value, duplication, evidence, feasibility and fit against owner focus. |
| `READY` | Critic verdict recorded and positive (or positive-with-conditions, conditions stated). Eligible for a focused wave. |
| `ACTIVE` | Promoted into the focused wave in `CURRENT_STATE.md`, with a lane. |
| `PARKED` | Sound but not now. Records the trigger that would unpark it. |
| `REJECTED` | Closed with the reason. Stays recorded. |
| `DELIVERED` | Merged and proven; the ledger carries the evidence. |

Forward motion is not required — most ideas legitimately stop at `PARKED` or `REJECTED`.

## Minimum idea record

A `PROPOSAL` states, briefly: title · originating agent and runtime · problem or opportunity ·
target user (individual developer / maintainer / researcher / engineering lead) · evidence ·
expected value · relation to the owner focus weights · duplicate or adjacent work · dependencies ·
data and model implications (classes touched, any new sink or capability) · estimated effort ·
reversibility · the cheapest discriminating experiment · reason to start now · reason not to start ·
critic verdict.

An `INBOX` capture needs only the first three fields. Do not spend a flagship's reasoning budget
promoting an idea nobody has asked for; capture it and move on.

## Promotion rules

1. **An independent critic reviews before promotion.** The critic is a separate context and, for
   anything above G1, a high-effort model. A `READY` state without a recorded critic verdict is
   invalid.
2. **An exploratory branch is not authority to merge.** A bounded exploratory branch or worktree is
   a legitimate way to resolve uncertainty cheaply (owner decision A6), but its output is evidence
   for the critic — merging it still requires a normal slice, review and gate.
3. **Rejected ideas stay recorded.** Closing without a reason guarantees the same idea returns
   under a new name next session. Check `REJECTED` records during `DEDUPLICATED`.
4. **`CURRENT_STATE.md` carries only wave-promoted ideas** — those at `ACTIVE`. Everything else
   stays in the backlog. The live resume artifact must remain compact enough to read cold.
5. **Data, model, cross-repo or publication implications escalate**, regardless of how small the
   idea looks: those are G3/G4 and belong to the coordinator or the owner
   ([WORK_CLASSES.md](WORK_CLASSES.md) mandatory escalation).
6. **Ideas never relax a boundary.** An idea whose value depends on weakening missingness honesty,
   the deterministic fallback, model-output labelling, private-output locality, the secret
   prohibition, or the merge/review gates is `REJECTED` at `CRITIC_REVIEW` — those need owner
   authority, not a better argument.
