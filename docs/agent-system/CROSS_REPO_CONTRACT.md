# Cross-repository governor contract

`developer-lens` is the **stable product and release side**: it owns presentation contracts,
compatibility, releases and the default runtime. `developer-lens-lab` is the **research and
experimental side**: experiments, corpora, methodological evaluation, candidate registries,
reproducibility and reports. This file is the agreement between the two governors. Loop context:
[README.md](README.md). Owner authority: [docs/OWNER_CONSTITUTION.md](../OWNER_CONSTITUTION.md) §2.2
and §5 (A7 — cross-repository compatibility checking is mandatory).

## What both governors must agree on

1. **Owner constitution version** — the same constitution version binds both sides; a version bump
   on one side is reconciled on the other before either merges dependent work.
2. **Responsibility split** — product owns stable contracts, compatibility, release and default
   runtime; the lab owns experimental pipelines, research UIs, fixture producers, evaluation and
   E2E research flows.
3. **Model routing** — the same table: flagship coordinator, Opus 5 low scout, Opus 5 high builder
   and reviewer, Sonnet 4.6 high mechanic ([WORK_CLASSES.md](WORK_CLASSES.md)).
4. **Risk tiers** — the same W0–W4 classes and the same mandatory-escalation list.
5. **Queue vocabulary** — the same labels (`now`/`next`/`later`/`idea`/`agent-generated`/
   `owner-gated`/`human-action`/`product`/`lab`/`cross-repo`/`release`/`experimental`) and the same
   two-layer model: unlimited GitHub-issue backlog plus a focused wave in each repository's live
   state file.
6. **Contract checks** — which shared surfaces are checked, by which command, on which side.
7. **Stable vs experimental channel** — the lab may auto-publish to the experimental channel after
   its declared gates; promotion into the stable channel is governed by product-owned compatibility
   checks and the owner-approved promotion policy. An experimental output may be shown locally
   without becoming a default product claim.
8. **Release sequencing** — both repositories tag together; product-owned schema changes release
   before or with the consumer that needs them, never after.
9. **Merge order** — stated explicitly per programme, before either side merges.
10. **Late-review protocol** — the same aging floor, the same 15-minute exact-head fallback, the
    same two-round ceiling and the same mandatory post-merge sweep
    ([MAINTENANCE_PROTOCOL.md](MAINTENANCE_PROTOCOL.md)).

## Compatibility rule

Any product-owned schema or presentation-contract change runs this sequence, in order:

1. **Product generation and check** — regenerate the artifact and run its drift gate
   (`npm run check:research-pack`, `npm run check:method-trial-view`).
2. **Lab check-only sync** — the lab validates as a consumer without redefining the contract.
3. **Fixture and export proof on both sides** — the lab proves its consumer path against the exact
   fixture bytes; the product proves its producer and rendering path.
4. **Explicit merge order** — written down before either merge; product-owned schema lands first
   unless a stated dependency inverts it, in which case the inversion is recorded.
5. **Post-merge byte and schema compatibility check** — re-verified after both merges, not
   inferred from the pre-merge run.

A change that skips a step is not compatible-by-assumption; it is unverified. Where the mechanism
is a workflow, dispatch or pinned checkout matrix, choose the smallest robust design after
archaeology — the requirement is the proof, not a particular automation shape.

## Current status

- **Product side: seeded 2026-08-08.** The governor operating system, work classes, prompts,
  maintenance and idea protocols and this contract exist in `developer-lens`.
- **Lab side: QUEUED.** Lab-side governor seeding is blocked behind [HUMAN_TODO.md](../../HUMAN_TODO.md)
  q-8: a concurrent writer was observed in the `developer-lens-lab` checkout, and a competing writer
  in the same working directory can corrupt a branch mid-slice. **While q-8 stays open, all lab-side
  write work in that checkout and ALL lab merges are human-gated.** Lab work may be prepared and
  parked as a pull request ONLY from a freshly created, verified isolated worktree — never from the
  affected checkout itself (the hazard is the working directory, and isolation does not make a
  MERGE safe while the competing writer can still race the remote); it may not be merged by an
  agent. Without a verified isolated worktree, preparation stays a non-writing plan.
- **Shared surfaces today:** the `methodTrialView` contract with C0 fixture parity, and the
  ResearchPack schema (issues #181/#182 — #181's schema slice has shipped). Both live under
  `shared/` on the product side with their generation and drift-check scripts in `scripts/`.
- **Next cross-repo programme:** the #174 research-input and presentation-contract pair, which is
  the first surface to exercise this rule end to end
  ([docs/PROGRAMME_ROADMAP.md](../PROGRAMME_ROADMAP.md) P1).
