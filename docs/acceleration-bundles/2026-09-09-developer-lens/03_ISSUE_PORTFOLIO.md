
# Outstanding issue portfolio

## Portfolio diagnosis

The 52 open issues are not 52 equal tasks. They fall into four fundamentally different classes:

1. **Outcome work:** release, consumer contracts and #174.
2. **Precondition work:** storage/activation protections needed only before a real path opens.
3. **Maintenance debt:** platform, Windows and context reliability.
4. **Deliberately frozen research:** RAG/workbench refinements with explicit future triggers.

The default GitHub view hides those distinctions because every open issue lacks a milestone.

## Cluster counts

| Cluster | Open issues |
|---|---:|
| `contract-system` | 12 |
| `activation-storage` | 11 |
| `governance-context` | 7 |
| `platform-hardening` | 7 |
| `frozen-research` | 4 |
| `product-evidence` | 4 |
| `future-product` | 3 |
| `release-truth` | 3 |
| `ux-hardening` | 1 |

## Recommended milestone assignment

### v0.1 Release Closure

- #200 — joint release programme.
- #298 — recreate, do not recover, release metadata.
- #221 — branch-cleanup rule is maintenance and should not block the tag.

### v0.2 Contracts

- #304 — PublicLensProjection v1.
- #318, #324, #325, #326 — ResearchFinding v1 robustness.
- #319, #320, #321, #327 — ResearchFinding v2 semantics.
- #181, #182, #189, #300 — adjacent contract/export hardening.

### v0.2 Evidence Flagship

- #174 — flagship second lens.
- #76, #80, #135 — fold only the parts touched by #174.
- #217, #293, #294 — proving and bundle reliability that affects this wave.

### v0.3 Safe Activation

- #201, #317 — charter and capability consistency.
- #202 with #5, #6, #57, #59, #86, #142, #168, #177.
- #183 only when scale evidence makes it relevant.

### v0.4 Query & Distribution

- #203, #205.
- Loopback session authorization becomes a packaging acceptance criterion.

### v0.5 Team

- #204, aggregate-only.

### Research / Later

- #66, #68, #69, #315 and other explicitly frozen research.
- Every parked issue must carry an unblocking trigger, not merely “later.”

## Immediate triage changes

- Label #304 and #318–#327 with an explicit contract horizon.
- Group #319/#320/#321/#327 under one ResearchFinding v2 parent or tracking issue.
- Group #318/#324/#325/#326 under one v1 robustness implementation issue.
- Keep #202 as the owner of #5/#6/#57/#59 and related activation preconditions.
- Mark #183 scale-triggered; do not optimize 100k revocation until the supported usage envelope justifies it.
- Mark #217 partly resolved: the Node crypto browser import was fixed by PR #284; retain only measured chunk work.
- Close or rewrite stale issue bodies after a live reconciliation rather than relying on historical comments as current state.

## Full open issue manifest

| Issue | Title | Cluster | Proposed milestone | Horizon | Severity |
|---:|---|---|---|---|---|
| #5 | Accept the full local collector repository-name domain in v1 migration | `activation-storage` | `v0.3-safe-activation` | `later` | medium |
| #6 | Reject duplicate repository identities and pin installation-key continuity before real migration | `activation-storage` | `v0.3-safe-activation` | `later` | high |
| #41 | Harden C1 ancient-year range arithmetic | `platform-hardening` | `later` | `later` | low |
| #55 | Harden reflection-question layer semantics and small-copy readability | `ux-hardening` | `later` | `later` | low |
| #57 | Reject undersized two-probe request budgets before runtime binding | `activation-storage` | `v0.3-safe-activation` | `later` | medium |
| #59 | Define recovery for failed installation-key creation | `activation-storage` | `v0.3-safe-activation` | `later` | medium |
| #66 | RAG eligible-set ceiling (50k pre-rank prefix) is role-blind and support-ordered | `frozen-research` | `research-later` | `later` | medium |
| #68 | Frozen WB: FDR governance — tier-selected BH/BY, online-FDR first-test accounting, preallocated-BH decision point | `frozen-research` | `research-later` | `later` | high |
| #69 | Frozen DL-RAG-01: reserve supports_min quota before contextualizes rows consume the candidate budget | `frozen-research` | `research-later` | `later` | medium |
| #76 | DL-SPINE-05 registry finishing: source_diversity clamp decision + producer-absence limiting codes | `product-evidence` | `v0.2-evidence-flagship` | `next` | medium |
| #80 | DL-LIFE-02: claim-graph deletion seam — NO ACTION FKs abort scope erasure; scope binding; C2 retention sweeper | `product-evidence` | `v0.2-evidence-flagship` | `next` | high |
| #86 | coverage_id embeds the collection scope_alias and now travels inside C1 claim-graph identifiers — re-mint content-free before real collection | `activation-storage` | `v0.3-safe-activation` | `later` | high |
| #135 | Evidence resolve contract: residual semantic-coherence refinements | `product-evidence` | `v0.2-evidence-flagship` | `next` | medium |
| #142 | Storage v3: enforce one writer; native file binding before hostile-writer claims | `activation-storage` | `v0.3-safe-activation` | `later` | high |
| #168 | LIFE-03 restore: persist an external immutable selection proof | `activation-storage` | `v0.3-safe-activation` | `later` | high |
| #174 | Phase E: bridge stored observations into a second evidence-aware lens | `product-evidence` | `v0.2-evidence-flagship` | `next` | critical |
| #177 | LIFE-03: bind restore timestamp replay to verified selection | `activation-storage` | `v0.3-safe-activation` | `later` | medium |
| #181 | Encode ResearchPack runtime refinements in standalone JSON Schema | `contract-system` | `v0.2-contracts` | `next` | medium |
| #182 | Harden ResearchPack semantic consistency after v1 producer | `contract-system` | `v0.2-contracts` | `next` | high |
| #183 | Optimize very-large scope revocation deletion throughput | `activation-storage` | `v0.3-safe-activation` | `later` | medium |
| #189 | Harden MethodTrialView parity and accessible missing-state rendering | `contract-system` | `v0.2-contracts` | `later` | medium |
| #200 | P0.5: v0.1.0 release programme — AGPL-3.0-only, community scaffolding, C0 release assets | `release-truth` | `v0.1-release` | `now` | critical |
| #201 | Data Charter v2: layered classes (C0–C4/P/X), capability profiles, sink rules | `activation-storage` | `v0.3-safe-activation` | `next` | critical |
| #202 | Pre-activation readiness programme: consolidate #5 #6 #59 #57 with discriminating tests | `activation-storage` | `v0.3-safe-activation` | `later` | critical |
| #203 | Query system programme: automatic recommendations + deterministic Query Lab + manual Luna | `future-product` | `v0.4-query-distribution` | `later` | high |
| #204 | Team/Leadership aggregate mode (transparent, separately enabled) | `future-product` | `v0.5-team` | `later` | medium |
| #205 | Distribution ladder: gh launcher, npm CLI, casual-bootstrap desktop shell | `future-product` | `v0.4-query-distribution` | `later` | medium |
| #207 | verify:context: parse governor.yaml as YAML instead of key-spelling checks | `governance-context` | `maintenance` | `later` | medium |
| #208 | Governor follow-ups from Codex #206 sweep: release-prompt authority reads, post-merge sweep window, dl-reviewer invariant lenses, P1 real-data gating note | `governance-context` | `maintenance` | `later` | medium |
| #216 | Prompt OS post-review hardening (non-blocking) | `governance-context` | `maintenance` | `later` | low |
| #217 | Investigate browser node:crypto externalization and oversized main chunk warnings | `platform-hardening` | `v0.2-evidence-flagship` | `later` | medium |
| #221 | Reconcile merged-branch cleanup with the branch-deletion rule | `release-truth` | `v0.1-release` | `later` | medium |
| #222 | Add Windows-safe governor maintenance helpers for recurrent proof and cleanup checks | `platform-hardening` | `maintenance` | `later` | medium |
| #243 | Count every root-level Markdown fence in current-state validation | `governance-context` | `maintenance` | `later` | low |
| #246 | Friction log: fold recurring frictions into occurrence updates on existing entries | `governance-context` | `maintenance` | `later` | low |
| #257 | Harden residual tracked-text guard compatibility | `platform-hardening` | `maintenance` | `later` | medium |
| #293 | FR-050 root cause: Windows 8.3 short-path TMP breaks storage-v3 artifact-root identity checks | `platform-hardening` | `v0.2-evidence-flagship` | `later` | high |
| #294 | Empty local node_modules/.bin let a foreign repository's tsc run npm run build and produce a false red | `platform-hardening` | `v0.2-evidence-flagship` | `later` | high |
| #298 | v0.1.0 release-prep branch release/prepare-product-v0.1.0-20260818 (54217ff) is unrecoverable | `release-truth` | `v0.1-release` | `later` | medium |
| #300 | Headless export: untested post-write cleanup branch and two low-severity argument/IO edges | `platform-hardening` | `v0.2-contracts` | `later` | medium |
| #304 | Publish PublicLensProjection.v1: schema, C0 fixture, registries, and export-profile | `contract-system` | `v0.2-contracts` | `candidate-now` | critical |
| #313 | Reconcile remaining 14-role taxonomy references | `governance-context` | `maintenance` | `later` | low |
| #315 | Reconcile retrieval-ladder sequencing and rung-2 acceptance | `frozen-research` | `research-later` | `later` | medium |
| #317 | Finish Gate B register and curated capability consistency | `governance-context` | `v0.3-safe-activation` | `later` | medium |
| #318 | researchFinding README registry test fails on Windows checkouts (CRLF) | `contract-system` | `v0.2-contracts` | `candidate-now` | medium |
| #319 | ResearchFinding v1 cannot derive four of its seven exported gates | `contract-system` | `v0.2-contracts` | `candidate-now` | high |
| #320 | model_promotion claim text is reject-specific but admissible on every outcome | `contract-system` | `v0.2-contracts` | `candidate-now` | medium |
| #321 | ResearchFinding v1 and MethodTrialView v1 disagree on false_alert_improvement | `contract-system` | `v0.2-contracts` | `candidate-now` | high |
| #324 | safeParse throws on lone surrogates instead of reporting a validation issue | `contract-system` | `v0.2-contracts` | `candidate-now` | high |
| #325 | DENIED_TOKEN misses RFC 5321 address literals and emoji-domain emails | `contract-system` | `v0.2-contracts` | `candidate-now` | medium |
| #326 | ResearchFinding: whitespace-only finding prose passes min(1) | `contract-system` | `v0.2-contracts` | `candidate-now` | medium |
| #327 | ResearchFinding: thresholds_nonviable limitation admitted alongside passing selection gates | `contract-system` | `v0.2-contracts` | `candidate-now` | high |

Machine-readable equivalents are in:

- `agent/issue-manifest.json`
- `agent/issue-manifest.csv`
- `agent/issue-manifest.schema.json`
