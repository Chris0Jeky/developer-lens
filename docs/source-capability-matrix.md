# Source capability and consent matrix

Contract version: **1.1.0**. This is the human-readable companion to the fail-closed registry in
`shared/capabilities.ts`. The listed retention values became active owner policy when G2 was
approved on 2026-08-03. Every executable capability definition still starts `never_authorized`:
the decisions below authorize bounded implementation, but do not themselves activate collection,
storage, credentials, or a source query. G2 is satisfied for every listed source. Standing G3
authorization is also satisfied for Actions, deployments, dependencies, security, Projects,
ownership, and source structure within the purpose/class/scope limits below. G4 is satisfied only
for the OpenAI `gpt-5.6-luna` boundary recorded in the external-model row and data charter.

The owner-selected D1-D3 demo lane is synthetic-only and does not depend on any real-source
activation. The approved G2/G3 decisions apply when a later task card proposes its named
real/private source. Approved G4 permits a bounded OpenAI/Luna implementation, but external
transmission remains default-off and is not active until its own reviewed task card and tests pass.

| Capability ID | Purpose and retained minimum | Class ceiling | Consent / phase | Retention policy | Delete / revoke behavior | Refusal or absence |
|---|---|---:|---|---|---|---|
| `github.core` | Repository/system lifecycle: stable IDs, flags, dates, numeric surfaces, PR/check/issue/release edges, and coverage; no names, prose, URLs, or people dimensions | C2 source → C1 facts | **G2 approved**; implement no earlier than P4/P7 for repositories explicitly selected locally | C1 36m, including the content-free revocation replay family; C2 13m; old source and migration backup seven days after successful selection | Delete source observations and every dependent fact, feature, alias, checkpoint, and pack only after a content-free C1 replay intent is durable; retain that replay family through stale-backup risk, then delete it by 36m or whole-task-root deletion | Remain `never_authorized` until implemented; when later refused/absent, record the exact coverage state and never infer zero; a missing/foreign/unapplied replay family is unavailable, never legacy fallback |
| `cap.local.git` | Explicit selected-ref topology and self-attributed aggregate change facts | C2 | **G2 approved**; explicit selected roots/refs in P6, with no implicit fetch or working-tree scope | 13m | Delete observations, topology descendants, checkpoints, aliases, and derived outputs | `refused`; do not inspect roots or execute Git |
| `cap.git.signatures` | Aggregate commit/tag verification-policy coverage | C3 source → C1 summary | **G2 approved**; separate runtime opt-in after local-Git activation | C3 90d; C1 36m | Delete verification grades and dependent summaries | `refused` or `unavailable`; never run repository verifiers |
| `cap.commit.intent` | Aggregate controlled maintenance/feature/test/docs/refactor/unknown mix | C4 input → C1 summary | **G2 approved**; separate ephemeral runtime opt-in; no external model | C4 process only; C1 36m | Destroy subjects immediately; delete summaries and classifier cache | `refused`; do not read subjects |
| `cap.github.issue_taxonomy` | Issue/linkage facts and approved local taxonomy aliases | C3 source → C1 summary | **G2 approved**; implement in P7 for selected repositories; no Projects custom values | C3 90d; C1 36m | Delete aliases, observations, edges, summaries, and packs | Do not query labels, milestones, or project linkage until implemented |
| `cap.github.actions` | Attempt-aware aggregate workflow-run/job feedback shape; no names, logs, artifacts, or caches | C3 source → C1 summary | **G2 + G3 approved**, P8 | C3 90d; C1 36m | Delete run/job observations, aliases, features, caches, and packs | Before implementation report `refused`; with insufficient permission report `restricted` or `unavailable` |
| `cap.github.deployments` | Deployment outcome and release/change linkage using controlled states | C3 source → C1 summary | **G2 + G3 approved**, P8 | C3 90d; C1 36m | Delete observations and descendants; disclose provider-history censoring | Before implementation make no query; absence is never zero |
| `cap.github.dependencies` | Aggregate ecosystem/update waves with local or pack-scoped aliases | C3 | **G2 + G3 approved**, P9 | 90d | Delete dependency aliases, observations, graph edges, summaries, and packs | Before implementation make no SBOM/alert request or local manifest read |
| `cap.github.security` | Isolated aggregate Dependabot/code-scanning alert lifecycle | C3 restricted | **G2 + G3 approved**; P9 task card must fix its isolated schema/storage design | 90d | Delete restricted observations, aliases, summaries, caches, and packs | Distinguish disabled/403/404; never ingest secret scanning or private advisories |
| `cap.github.projects` | ProjectV2 status snapshots and aggregate transitions | C3 | **G2 + G3 approved**, P10 | 90d | Delete project/item/field aliases, observations, transitions, and packs | Do not mutate token/scopes; unavailable history remains coverage |
| `cap.github.ownership` | Repository-level ownership coverage counts only | C4 input → C3 graph/C1 summary | **G2 + G3 approved**, P10 | C4 process only; C3 90d; C1 36m | Destroy CODEOWNERS/team inputs; delete graph and summary descendants | Before implementation make no CODEOWNERS/team reads; never emit people or named bus factor |
| `cap.source.structure` | Committed-tree composition, opaque module graph, cycles, coupling, and API-surface counts. Role classification is **filename/extension/presence only** — manifest **bodies** are never read under this capability; declared-dependency/workspace content belongs to `cap.github.dependencies` with its own active consent and explicit card dependency (clarified 2026-08-04) | C4 input → C3 graph/C1 summary | **G2 + G3 approved**, P10; selected immutable refs only | C4 process only; C3 90d; C1 36m | Destroy paths/source/parser diagnostics; delete parser cache, graph, summaries, and packs | Before implementation make no tree/blob read, working-tree scan, repository executable, plugin, or network |
| `cap.external.model` | Optional structured hypotheses over a user-reviewed, locally retrieved compact evidence bundle | C1 input/output only | **G2 + G4 approved only for OpenAI `gpt-5.6-luna`**, P12; still `never_authorized` until bounded activation | Initial prompt/response process-only; `store: false`; provider abuse logs may remain up to 30d and encrypted prompt-cache state up to 24h under published defaults | Delete local retrieval index, validated output, usage receipt, and descendants; provider-held copies cannot be recalled locally | No credential read or request while inactive/refused; no hosted files/vector stores/tools; failure or changed terms/pricing stops without retry |

Ordering note (2026-08-04): the deletion column above is not aspirational — any capability whose
implementation creates retained C2/C3 descendants (dependency aliases, graphs, security facts,
retrieval indexes) is schedulable only after the registry-derived deletion planner exists
(programme card DL-LIFE-02); rollback prose never substitutes for an implemented cascade.

The revocation replay family, including its mandatory tail head, is local-only integrity state: it
reaches no API, export, public asset, or model payload. Seven-day legacy/backup cleanup must preserve
it; C1 expiry or whole-task-root deletion removes it. Its presence never activates collection or
authorizes a fallback reader.

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
- G2: approved 2026-08-03 with C1=36m, C2=13m, C3=90d, C4=process lifetime,
  repository-name isolation, canonical PR-title removal, and the seven-day migration protocol in
  `HUMAN_TODO.md`.
- G3: standing authorization granted 2026-08-03 for Actions, deployments, dependencies,
  Dependabot/code-scanning security aggregates, Projects, ownership, and source structure within
  this matrix. Missing permissions become explicit coverage, not a new owner gate. A future source
  may join this standing authority only through a reviewed registry/matrix change that remains
  inside the charter and rejected-capability boundaries.
- G4: approved 2026-08-04 only for OpenAI `gpt-5.6-luna`, the stateless Responses API with
  `store: false`, local-only retrieval, the exact C1 allowlist, structured output, the
  `Llm__OpenAi__ApiKey` environment credential, one-request/16,000-input-byte/2,000-output-token/USD
  0.01 ceilings, published ordinary-retention disclosure, and local deletion boundary in the data
  charter. The executable capability remains `never_authorized` until a bounded implementation and
  exact-head proving gate pass. Any broader provider/model/payload/tool/retention boundary requires
  a new owner decision.
