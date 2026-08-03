# Source capability and consent matrix

Contract version: **1.0.0**. This is the human-readable companion to the fail-closed registry in
`shared/capabilities.ts`. Recommended retention values are inert metadata until G2 is approved.
Every capability definition starts `never_authorized`. A definition describes a possible contract;
it is never consent, and P1 cannot activate collection, storage, or a source query. G2 is a
prerequisite for every real/private source read or retained record. A named G3 approval is additive
to G2 for its sensitive source; it never replaces G2.

The owner-selected D1-D3 demo lane is synthetic-only and therefore does not wait for G2/G3/G4.
These gates become active scheduling constraints only when a slice proposes its named real/private
source or external transmission.

| Capability ID | Purpose and retained minimum | Class ceiling | Consent / phase | Recommended retention | Delete / revoke behavior | Refusal or absence |
|---|---|---:|---|---|---|---|
| `github.core` | Repository/system lifecycle: stable IDs, flags, dates, numeric surfaces, PR/check/issue/release edges, and coverage; no names, prose, URLs, or people dimensions | C2 source → C1 facts | Contract definition only in P1; real-data activation is closed until G2, then implemented no earlier than P4/P7 for selected repositories | C1 36m; C2 13m | Delete source observations and every dependent fact, feature, alias, checkpoint, and pack | Remain `never_authorized`; when later refused/absent, record the exact coverage state and never infer zero |
| `cap.local.git` | Explicit selected-ref topology and self-attributed aggregate change facts | C2 | **G2 required**, then explicit root/ref consent in P6; no implicit fetch or working-tree scope | 13m | Delete observations, topology descendants, checkpoints, aliases, and derived outputs | `refused`; do not inspect roots or execute Git |
| `cap.git.signatures` | Aggregate commit/tag verification-policy coverage | C3 source → C1 summary | **G2 required**, then separate opt-in after local-Git consent | C3 90d; C1 36m | Delete verification grades and dependent summaries | `refused` or `unavailable`; never run repository verifiers |
| `cap.commit.intent` | Aggregate controlled maintenance/feature/test/docs/refactor/unknown mix | C4 input → C1 summary | **G2 required**, then separate ephemeral opt-in; no external model | C4 process only; C1 36m | Destroy subjects immediately; delete summaries and classifier cache | `refused`; do not read subjects |
| `cap.github.issue_taxonomy` | Issue/linkage facts and approved local taxonomy aliases | C3 source → C1 summary | **G2 required**, then opt-in in P7; no Projects custom values | C3 90d; C1 36m | Delete aliases, observations, edges, summaries, and packs | Do not query labels, milestones, or project linkage |
| `cap.github.actions` | Attempt-aware aggregate workflow-run/job feedback shape; no names, logs, artifacts, or caches | C3 source → C1 summary | **G2 + separate G3 required**, P8 | C3 90d; C1 36m | Delete run/job observations, aliases, features, caches, and packs | No workflow discovery; report `refused`, `restricted`, or `unavailable` |
| `cap.github.deployments` | Deployment outcome and release/change linkage using controlled states | C3 source → C1 summary | **G2 + separate G3 required**, P8 | C3 90d; C1 36m | Delete observations and descendants; disclose provider-history censoring | No deployment/environment query; absence is not zero |
| `cap.github.dependencies` | Aggregate ecosystem/update waves with local or pack-scoped aliases | C3 | **G2 + separate G3 required**, P9 | 90d | Delete dependency aliases, observations, graph edges, summaries, and packs | No SBOM/alert request or local manifest read |
| `cap.github.security` | Isolated aggregate Dependabot/code-scanning alert lifecycle | C3 restricted | **G2 + separate G3 and storage decision required**, P9 | 90d | Delete restricted observations, aliases, summaries, caches, and packs | Distinguish disabled/403/404; never ingest secret scanning or private advisories |
| `cap.github.projects` | ProjectV2 status snapshots and aggregate transitions | C3 | **G2 + separate G3 required**, P10 | 90d | Delete project/item/field aliases, observations, transitions, and packs | No Projects token/scope request; unavailable history remains coverage |
| `cap.github.ownership` | Repository-level ownership coverage counts only | C4 input → C3 graph/C1 summary | **G2 + separate G3 required**, P10 | C4 process only; C3 90d; C1 36m | Destroy CODEOWNERS/team inputs; delete graph and summary descendants | No CODEOWNERS/team reads; never emit people or named bus factor |
| `cap.source.structure` | Committed-tree composition, opaque module graph, cycles, coupling, and API-surface counts | C4 input → C3 graph/C1 summary | **G2 + separate G3 required**, P10; selected immutable refs only | C4 process only; C3 90d; C1 36m | Destroy paths/source/parser diagnostics; delete parser cache, graph, summaries, and packs | No tree/blob read, working-tree scan, repository executable, plugin, or network |
| `cap.external.model` | Optional hypotheses over a user-reviewed compact evidence bundle | C1 input/output only | **G2 for any real evidence + G4 required**, P12 | Owner/provider decision required | Delete request cache and model output without touching deterministic evidence | No transport, SDK, initialization, cache, telemetry, or request |

## Rejected capabilities

The registry must not expose an authorization path for these capabilities:

| Rejected ID | Rejected surface | Reason |
|---|---|---|
| `GH-PEOPLE-X` | Contributor/reviewer graph, ranking, centrality, named or pseudonymous bus factor | Human surveillance and re-identification |
| `GH-SECRET-X` | Secret-scanning alerts, even aggregate counts | Privilege and exposure exceed reflective value |
| `GH-ADVISORY-X` | Draft/private security advisories | Embargoed exploit detail and no legitimate current question |
| `SRC-WORKTREE-X` | Dirty or untracked working-tree data | Unstable, materially more sensitive, and unnecessary |
| `RAW-CONTENT-X` | Source, diffs, patches, paths, bodies, comments, logs, artifact/cache contents, binaries | Prohibited from every sink |
| `PERSON-METRIC-X` | Productivity, performance, effort, attendance, hours, quality, sentiment, personality, worth, individual forecast | Outside the product boundary regardless of pseudonymization |

## Gate status

- G1: approved 2026-08-03; T2 + `sensitive_data` is declared.
- G2: unapproved; no real private-data read, retention, migration, backup, or deletion execution.
- G3: every named sensitive capability unapproved independently.
- G4: unapproved; external-model transport is absent.
