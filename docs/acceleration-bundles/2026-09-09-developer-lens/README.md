# Developer Lens acceleration bundle

Original review generated **2026-09-04**. Live repository state refreshed **2026-09-09** against Product main `6a59aa26eee939555dba1af9468c05b598a2be40`.

## Status

This is a non-authoritative review and acceleration intake. Repository instructions, the owner constitution, `HUMAN_TODO.md`, live GitHub state and current task cards remain authoritative.

## Start here

1. Read `01_LIVE_SNAPSHOT.md` and refresh every live fact before mutation.
2. Run `node serve-deck.mjs` from this directory and open the printed loopback URL.
3. Confirm, change or defer the proposed decisions and export JSON or Markdown.
4. Invoke the repository's canonical `$developer-lens-continuation` workflow.
5. Give the exported decision file and this directory to the in-repo agent.
6. The agent begins with `11_AGENT_START_HERE.md` and validates the machine files under `agent/`.

## Contents

| Path | Purpose |
|---|---|
| `00_EXECUTIVE_REVIEW.md` | Verdict, strengths, weaknesses and strategy |
| `01_LIVE_SNAPSHOT.md` | Measured repository state and review limits |
| `02_WORK_DONE_AND_EVOLUTION.md` | Evolution of product, architecture and development style |
| `03_ISSUE_PORTFOLIO.md` | All 52 open issues clustered and sequenced |
| `04_HORIZON_AND_SEQUENCE.md` | H0-H5 roadmap and dependencies |
| `05_HUMAN_ACTIONS.md` | Blocking and deferred human tasks |
| `06_DECISION_CATALOG.md` | 27 decisions and proposed defaults |
| `07_TARGET_ARCHITECTURE.md` | Lens kernel, evidence and projection architecture |
| `08_IMPLEMENTATION_PLAYBOOK.md` | Concrete implementation directions |
| `09_EDGE_CASES_AND_TESTS.md` | Test and failure-mode matrix |
| `10_EXPANSION_IDEAS.md` | Additional ideas kept off the active queue |
| `11_AGENT_START_HERE.md` | Safe unbundling procedure |
| `12_COPY_READY_AGENT_PROMPT.md` | Historical handoff formulation; redirect to canonical repository prompts |
| `agent/` | Sharded JSON/CSV manifests, schemas, snapshot and materializer |
| `snippets/` | TypeScript/YAML implementation sketches, not drop-in patches |
| `sources/SOURCE_MAP.md` | Evidence map and review limits |
| `interactive-decision-deck.html` | Local interactive decision surface |
| `serve-deck.mjs` | Dependency-free loopback static server for the deck |

## Key recommendation

Finish the joint v0.1 release, publish #304, harden and version ResearchFinding, and then make #174 the proof that the mature V2 storage/evidence foundation produces user-visible analytical value.

## Import rule

Only decisions exported as `confirmed` may be promoted into repository-native ADRs or tasks. Proposed defaults remain advisory. No file in this directory authorizes release, real-data collection, credentials, external-model transmission, telemetry, Taskdeck writes or publication of non-C0 output.
