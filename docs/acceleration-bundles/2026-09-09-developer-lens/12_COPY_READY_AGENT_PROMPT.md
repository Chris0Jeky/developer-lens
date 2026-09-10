# Historical agent handoff formulation

<!-- prompt-source: historical target: DL-P04-RESUME-RECONCILE -->

> RETIRED PROMPT - HISTORICAL RECORD ONLY - DO NOT EXECUTE.

**Prompt classification:** historical advisory intake. Do not paste this file as an executable repository prompt. Invoke `$developer-lens-continuation` and use `docs/agent-system/PROMPT_LIBRARY.md` as the only canonical executable prompt surface. The text below records the requirements that the original external handoff formulation was intended to carry.

A repository agent should unbundle this directory as a non-authoritative intelligence pack, reconcile it against the live repository, and turn only confirmed parts into repository-native planning and implementation.

## Authority

Read the repository's root instructions, owner constitution, HUMAN_TODO, current-state file, programme roadmap, governor and relevant task cards first. Those sources override this bundle. Never infer that a proposed default is an owner decision.

## Objectives

1. Reconcile the live Product/Lab state. PR #309 was observed merged and Product PR #323 was the only open PR on 2026-09-09, but re-measure everything.
2. Import the issue manifest and propose outcome milestones:
   - v0.1 Release Closure
   - v0.2 Contracts
   - v0.2 Evidence Flagship
   - v0.3 Safe Activation
   - v0.4 Query & Distribution
   - v0.5 Team
   - Research / Later
3. Read an exported `DeveloperLensDecisionExport.v1` if present. Treat only `confirmed` entries as authority.
4. Seed the work queue in dependency order. Start with live-state reconciliation, the open security dependency PR, and the release proof packet unless already complete.
5. After v0.1, deliver #304, ResearchFinding robustness/v2, and then #174 through a reusable compile-time lens pipeline.
6. Keep real activation ordered behind #174, #201 and #202.

## Working rules

- Progress is merged, proved product value, not planning volume.
- Preserve missingness, censoring, coverage, limitations and counter-evidence.
- Never convert model output into observed fact.
- No person scoring or leaderboard.
- Use invented fixtures until a named activation card is approved.
- Keep public output C0.
- Product owns canonical contracts; Lab follows pinned Product versions.
- Do not introduce a runtime plugin system.
- Do not rewrite the stable Story dashboard as a prerequisite.
- Do not create another permanent governance mechanism unless it replaces an older one or fixes a repeated demonstrated failure.
- Follow the repository's bounded review/fix-round law.
- Keep human-facing GitHub text concise and ordinary.

## Required deliverables

Create or update, as appropriate:

- a live-state reconciliation;
- milestone and label proposal/import;
- parent/dependency grouping for contract and activation issue families;
- repository-native ADRs for confirmed decisions;
- Taskdeck intake/generated artifacts through the existing generator;
- implementation task cards for the first executable wave;
- code/tests for any task you can safely complete now;
- exact proof and residual report.

## First execution wave

1. `DL-ACC-00` — reconcile current state.
2. `DL-ACC-01` — inspect/re-prove/merge the security dependency update if still open and authorized.
3. `DL-ACC-02` — prepare the bounded v0.1 Product visual proof packet.
4. Stop at q-10(c) if owner approval is absent.
5. In parallel only where file ownership is disjoint, prepare #304 and the ResearchFinding issue grouping without publishing or changing v1 semantics.

## Completion report

Report only:

- changed;
- proved;
- not proved;
- decisions imported and their status;
- human action required;
- residuals;
- exact next task.
