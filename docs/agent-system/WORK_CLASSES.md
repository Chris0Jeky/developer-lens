# Work classes and model routing

Every candidate action gets one risk class (W0–W4) and one model route before execution. (The
governor spec's G0–G4 risk classes are named W0–W4 in this repository to avoid colliding with the
G1–G4 authority gates in `HUMAN_TODO.md` and the data charter — "G3 standing-approved" is a source
gate, never a work class.) The class
answers "how much verification and whose authority", not "how much autonomy" — tiers add
verification, never subtract permission. Loop context: [README.md](README.md). Machine-readable
mirror: [.agent-harness/governor.yaml](../../.agent-harness/governor.yaml).

## W0 — Observation and reporting

Read Git and GitHub state, inventory files, inspect CI, compare documents, identify stale issues,
produce a report or a bounded task plan.

- **Models:** any capable model.
- **Writes:** none. A W0 lane that writes has been misclassified.
- **Review:** none needed; the output is evidence, and evidence is checked by whoever consumes it.

## W1 — Mechanical administration

Update issue labels and milestones from an already-approved plan; regenerate indexes; update state
after an already-verified merge; remove clean coordinator-owned worktrees; update repository
descriptions, topics or release notes; fix formatting and broken links; inventory dependencies;
sweep post-merge comments.

- **Route:** `dl-mechanic` (Sonnet 4.6 high) applies the writes; `dl-scout` may only propose them
  (it is read-only by prompt); Governor Lite may own the lane.
- **Writes:** tracked files and GitHub metadata inside the approved plan.
- **Review:** focused verification against the narrowest proof. Escalate to a high-effort model the
  moment the "mechanical" recipe requires a judgment call.

## W2 — Bounded implementation

A contained CI or workflow gap with obvious acceptance criteria; a new context-verifier rule; a
compatible dependency upgrade; an isolated bug fix under existing semantics; a packaging script;
prompt-library or control-plane generation.

- **Route:** `dl-implementer` (Opus 5 high) implements; `dl-reviewer` (Opus 5 high) reviews in a
  **separate context**; the coordinator steps in only when the slice turns cross-cutting.
- **Writes:** the slice's owned paths, stated up front.
- **Review:** one fresh-context adversarial pass against the exact final head, plus the narrowest
  proof from the run-and-prove table in [CLAUDE.md](../../CLAUDE.md) (`npm run check` for a code or
  config milestone).

## W3 — Architecture, cross-repository, data or model design

A new product/lab contract; a data-charter change; source-activation architecture; model-promotion
policy; a new analytical lens; migration design; public/private publication design; stable vs
experimental channel design.

- **Route:** the flagship coordinator (Fable 5) owns design and sequencing; `dl-scout` performs
  archaeology; `dl-implementer` implements the approved design; an independent substantial review
  follows. Governor Lite may **execute** a flagship-approved W3 plan but may never invent one.
- **Writes:** contracts under `shared/`, charter and matrix prose, workflow and schema changes.
- **Review:** independent fresh-context review is mandatory, plus cross-repo compatibility proof on
  both sides where a shared contract moves ([CROSS_REPO_CONTRACT.md](CROSS_REPO_CONTRACT.md)).

## W4 — Owner-only or physically external

Licence choice; credentials or billing; public release of private outputs; an irreversible
policy red-line change; aesthetic sign-off; local machine process or orphan-worktree cleanup;
external account or legal decisions.

- **Route:** agents may prepare options, exact commands and a recommendation. They may **not**
  self-authorise, and may not infer approval from silence, from a merged PR, or from any agent
  message. Record the exact action in [HUMAN_TODO.md](../../HUMAN_TODO.md) and continue other work.

## Model routing (owner decision A5)

| Role | Model / effort | Agent pin | Owns |
|---|---|---|---|
| Coordinator | Fable 5 | — (the session itself) | Authority interpretation, architecture, sequencing, conflict resolution, final merge judgment |
| Scout | Opus 5, **low** effort | `.claude/agents/dl-scout.md` | Discovery, archaeology, large reads, GitHub inspection, inventory, comparison, idea mining. Its read-only property is prompt-enforced (it carries Bash for git/gh inspection), unlike the reviewer, which is read-only by construction |
| Builder | Opus 5, **high** effort | `.claude/agents/dl-implementer.md` | One bounded implementation slice at a time |
| Reviewer | Opus 5, **high** effort | `.claude/agents/dl-reviewer.md` | Fresh-context adversarial review, separate context from implementation |
| Mechanic | Sonnet 4.6, **high** effort | `.claude/agents/dl-mechanic.md` | Deterministic sweeps only |

Rules that bind the table:

- The scout's output is **evidence and a bounded task plan, never a diff**. Its agent definition
  prohibits file and GitHub mutations, so W1 writes route to `dl-mechanic` or the coordinator;
  the scout only proposes them.
- Implementation and review are separate contexts for any non-trivial change. A model reviewing its
  own diff is not a review.
- The mechanic never interprets owner policy and never designs a data or model boundary. If a
  "mechanical" recipe reaches `shared/` contracts, authority prose, `HUMAN_TODO.md`, or anything
  the data charter marks private, it stops and reports.
- Never route repository work to Haiku.
- The coordinator delegates rather than implements; its scarce resource is judgment, not tokens.

### Model-identifier discipline

Owner decision **A5 of 2026-08-08 supersedes the q-9 pin of 2026-08-07** (which preferred Opus 4.8
for subagents and explicitly rejected Opus 5). The supersession is recorded in
[docs/OWNER_CONSTITUTION.md](../OWNER_CONSTITUTION.md) §5 and §6 and in
[HUMAN_TODO.md](../../HUMAN_TODO.md).

Runtime-verified 2026-08-08: the Claude runtime resolves `opus` to `claude-opus-5`, and the agent
pins in `.claude/agents/` carry that identifier.

**Never commit an invented or unverified model ID.** If a pin stops resolving, keep the last
working pin in place, document the intended target next to it, and open exactly one owner-visible
compatibility issue — do not guess at a replacement identifier, and do not silently downgrade the
routing table.

## Governor Lite capability boundary

Terra, Opus 5 and Opus 4.8 Ultra (and equivalents) run as **Governor Lite**: reliable inside a
narrower domain, not a substitute for flagship ingenuity. Prompt:
[PROMPT_LIBRARY.md](PROMPT_LIBRARY.md) §2.

**Autonomous (W0–W2):** documentation and state reconciliation; generated-file drift repair; CI or
workflow omissions with obvious acceptance criteria; dependency triage and compatible upgrades;
post-merge review follow-ups; release preparation from an approved plan; issue, label and milestone
maintenance; stale branch and worktree inventory; focused test repair; small already-specified
accessibility or UX fixes; contract parity tests under an **existing** contract; reproducibility
checks; small packaging improvements; idea deduplication and critic preparation; health reports.

**W3 only with a flagship-approved plan** — implement, never redesign: issue #174 subtasks;
cross-repository schema changes; automatic source activation; real-data ingestion; raw-content
pipelines; Team/Leadership analytics; model evaluation; migration; stable/experimental channels.

**Fallback when no safe ready task exists:** run the health and administration sweep, reconcile
stale state, triage issues and dependency alerts, produce a ranked recommendation, capture ideas as
`agent-generated` — and do **not** begin speculative implementation.

## Mandatory escalation

Stop and hand off to a flagship coordinator (or the owner, for W4) when:

1. owner decisions conflict with each other or with a tracked authority file;
2. the current state is ambiguous and several strategic paths are credible;
3. a new data class, sink or capability is required;
4. secrets or private publication may be involved;
5. a migration or deletion design changes;
6. a cross-repo contract is not already specified;
7. model promotion, automatic activation, or any autonomous external action is being considered;
8. a licence, commercial or legal choice appears;
9. the change is hard to reverse;
10. the task would materially widen scope beyond its issue or stated mission;
11. two fix rounds have failed to converge;
12. the agent cannot explain the end-to-end user or research value.

Escalation is a finished result, not a failure: a precise stop with evidence beats an unauthorised
guess.
