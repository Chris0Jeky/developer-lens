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
11. **Prompt operating system** — the same twelve common prompt IDs (`DL-P01`…`DL-P12`), the same
    two shared blocks, and a byte-identical
    [.agent-harness/prompt-parity.json](../../.agent-harness/prompt-parity.json). See below.

## Prompt parity

The prompt library is per-repository, but its spine is shared. `.agent-harness/prompt-parity.json`
is **repo-neutral and byte-identical in both repositories**: each side resolves its own entry by
matching its declared repository slug, so the same file can be copied across without editing. It
pins the twelve common IDs, each side's extension IDs (`DL-PX…` product, `DL-LX…` lab), and the
SHA-256 of each shared block.

Two blocks are shared: `runtime-bootstrap-v1` (which canon each runtime reads first, how Claude
routes through named `dl-*` agents, how Codex routes through `AGENTS.md` → shared `CLAUDE.md` →
continuation skill → Sol/Terra/Luna, and the fully qualified human-ref form) and
`friction-tasking-v1` (log material friction in the same hop, link it to a durable task, and treat
capture as a record rather than a licence to detour). Both must be **byte-for-byte identical** in
both repositories, which is why the digest is pinned rather than the prose merely being "kept in
sync".

Editing a shared block is therefore a `cross-repo` change, and it runs like one:

1. Edit the block once in the product library, recompute its digest, and update every prompt that
   carries it plus the manifest **in the same commit** — `npm run verify:context` fails otherwise.
2. Copy the identical block body and the identical manifest to the lab side.
3. Prove on both sides with each repository's own context verifier.
4. Record the merge order before either merge.

While `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-8` stays open, step 2 may be **prepared and
parked only** — the lab side is not merged by an agent (see *Current status*). A parked lab branch
carrying a matching block is the correct outcome, not a failed lane.

Because the two repositories have independent human-action registers, every human ref inside an
active prompt body is written fully qualified — `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-8` is
a different gate from the lab's `q-8`, and a bare `q-N` fails the verifier for exactly that reason.

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

- **Product side: delivered.** The governor operating system, work classes, prompts, maintenance
  and idea protocols and this contract landed through product PR
  [#218](https://github.com/Chris0Jeky/developer-lens/pull/218).
- **Lab side: delivered.** The lab prompt operating-system counterpart landed through lab PR #35
  (merge commit `bba0c18261c0a2b77332a0408f63b10c774c91f4`). The product
  `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-8` closure is recorded in the current
  owner-decision slice; it no longer blocks normal lab work. The sibling
  `Chris0Jeky/developer-lens-lab::HUMAN_TODO.md::q-8` remains a separate open real-study
  publication gate and does not re-open or re-park normal lab work. A concurrent writer was
  previously observed in the `developer-lens-lab` checkout, and a competing writer in the same
  working directory can corrupt a branch mid-slice. **While the product q-8 stays open, all lab-side
  write work in that checkout and ALL lab merges are human-gated.** Lab work may be prepared and
  parked as a pull request ONLY from a freshly created, verified isolated worktree — never from the
  affected checkout itself (the hazard is the working directory, and isolation does not make a
  MERGE safe while the competing writer can still race the remote); it may not be merged by an
  agent. Without a verified isolated worktree, preparation stays a non-writing plan. That
  conditional protocol remains preserved; the product q-8 is now closed.
- **Shared surfaces today:** the `methodTrialView` contract with C0 fixture parity, and the
  ResearchPack schema (issues #181/#182 — #181's schema slice has shipped). Both live under
  `shared/` on the product side with their generation and drift-check scripts in `scripts/`.
- **Prompt operating system: merged on both sides.** Product PR #218 and lab PR #35 deliver the
  library, repo-neutral parity manifest, and shared blocks. Non-blocking hardening remains product
  #216 and lab #34; it does not change the delivered prompt-OS status or any capability boundary.
- **Next cross-repo programme:** the #174 research-input and presentation-contract pair, which is
  the first surface to exercise this rule end to end
  ([docs/PROGRAMME_ROADMAP.md](../PROGRAMME_ROADMAP.md) P1).
