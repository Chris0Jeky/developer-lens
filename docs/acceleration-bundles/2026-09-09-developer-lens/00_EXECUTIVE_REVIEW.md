
# Developer Lens — executive review

**Snapshot:** 2026-09-09 (original review generated 2026-09-04)
**Repository:** `Chris0Jeky/developer-lens`
**Reviewed head:** `6a59aa26eee939555dba1af9468c05b598a2be40`
**Scope:** public tracked source, documentation, public issues/pull requests, and hosted checks. No protected local dataset, credential, real-data activation, or private generated output was inspected.

## Bottom line

Developer Lens is no longer merely a GitHub statistics dashboard. It is becoming a **local-first engineering observatory and evidence system**: it collects bounded development metadata, preserves coverage and missingness, derives inspectable findings, separates fact from interpretation, and renders both a private retrospective and an invented public showcase.

The project has four unusually strong assets:

1. **A coherent product thesis.** It asks what kind of development system a body of work became, rather than reducing engineering to throughput or a leaderboard.
2. **A real evidence architecture.** Coverage, limitations, provenance, claims, counter-evidence, deletion lineage and abstention are treated as product data, not footnotes.
3. **A credible privacy posture.** Local binding, explicit sink rules, synthetic public data, denied-content checks, bounded activation cards and deletion work are implemented rather than promised.
4. **A disciplined Product/Lab split.** Product owns stable contracts and presentation; Lab owns experiments and model evaluation.

The principal weakness is now **programme shape**. The repository has accumulated more control-plane, storage and contract machinery than the user-visible analytical product presently consumes. The open portfolio is also not legible from GitHub alone: all 52 open issues lack milestones, 12 are unlabeled, and only one is marked `now`.

## Current state in one sentence

**The governed foundations are ahead of the product surface.** Release v0.1, publish the two bounded consumer contracts, then make issue #174 the flagship vertical that proves the stored-observation and evidence architecture produces a genuinely useful second lens.

## Recommended strategy

### 1. Finish, do not redesign, v0.1

- Reconcile stale live-state documentation after merged PR #309.
- Re-prove and merge the only open Product PR, security dependency PR #323.
- Generate one bounded current visual proof packet.
- Obtain Product `HUMAN_TODO.md::q-10(c)` sign-off.
- Recreate release metadata from current `main`; do not attempt to resurrect the lost branch tracked by #298.
- Tag Product and Lab together, with only approved invented C0 assets.

### 2. Unblock consumers, then prove the product thesis

- Publish **PublicLensProjection.v1** (#304) immediately after release.
- Harden ResearchFinding v1 robustness, then resolve semantic defects in an explicit v2.
- Introduce a small compile-time **LensDefinition** kernel.
- Deliver #174 end to end: selected-store observations → support assessment → integration-tail analysis → evidence graph → API/UI → Evidence Drawer.

### 3. Activate real data only after value exists

Use this order:

`#174 synthetic selected-store value → #201 Data Charter v2 → #202 readiness → one bounded public metadata canary`

This prevents the project from spending another major wave perfecting ingestion and deletion for analyses users cannot yet experience.

## Constructive assessment

| Dimension | Assessment | Why |
|---|---|---|
| Product thesis | Strong and differentiated | Humane, local-first, evidence-aware engineering retrospection is a clearer niche than generic GitHub analytics. |
| Architecture | Strong foundations, split data plane | Legacy whole-dashboard JSON and V2 SQLite/evidence systems coexist; new work should converge through a lens kernel. |
| Privacy/security | Unusually rigorous | The controls are executable, but packaged loopback authorization and first-real-activation proof remain future gates. |
| Analytical validity | Promising | The project understands missingness, censoring and unsupported inference; only one major stored-data lens is presently planned end to end. |
| Delivery discipline | Very strong | 213 merged PRs out of 222, bounded fix rounds, exact-head checks, public synthetic canaries and detailed provenance. |
| Programme efficiency | Needs correction | Governance and residual hardening can absorb unlimited effort; freeze new permanent governance for two product waves. |
| Release readiness | Near | The sole owner tag gate is visual sign-off; there are no releases or tags yet. |
| Product horizon | Credible but overextended | Personal retrospective and maintainer observatory are near; Query, Team, RAG, desktop and richer content should remain sequenced. |

## The horizon

- **H0 — Release closure:** truth sync, security update, visual sign-off, joint v0.1.
- **H1 — Contract interoperability:** #304; ResearchFinding v1 hardening and v2 semantics; Windows proof reliability.
- **H2 — Evidence flagship:** #174 through one reusable lens pipeline.
- **H3 — Safe activation:** #201, #202 and one metadata-only canary.
- **H4 — Query and distribution:** deterministic Query Lab, optional manual Luna, npm/gh distribution.
- **H5 — Expansion:** aggregate Team mode, mature research workbench/RAG, desktop packaging and external brand.

## What not to do next

- Do not add another general governor, ledger, prompt hierarchy or agent framework.
- Do not build runtime third-party plugins before multiple internal lenses establish a stable extension shape.
- Do not rewrite the stable Story dashboard onto V2 as a prerequisite.
- Do not start individual developer scoring.
- Do not activate raw content or private repositories as the first real-data test.
- Do not let every review residual become current work.
