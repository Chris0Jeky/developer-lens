
# Horizon and execution sequence

## Portfolio rule

For the next two product waves use a fixed allocation:

- **70%** user-visible product/data path;
- **20%** adjacent hardening required by that path;
- **10%** governance and maintenance.

A control-plane task may exceed that budget only when it blocks release, causes recurring false proof, permits data loss/leakage, or replaces an older mechanism.

## H0 — Release closure

### Exit outcome

A real v0.1.0 release exists in Product and Lab, with approved invented public assets and reproducible source commits.

### Sequence

1. Refresh live refs and truth-sync current-state material.
2. Re-prove and merge PR #323.
3. Build one final Product screenshot/video/checksum packet.
4. Obtain q-10(c) approval.
5. Recreate version/changelog work from current main.
6. Run exact release gates.
7. Tag both repositories and attach only approved C0 assets.
8. Verify public links and release manifests.
9. Close #200 and Lab #29 with exact tag evidence.

### Stop conditions

- Any protected/private input appears in an asset.
- The tag does not point to the proved commit.
- Product and Lab contract fixtures disagree.
- q-10(c) remains unapproved.

## H1 — Interoperability and contract integrity

### Exit outcome

CommitAtlas can consume a canonical public projection; ResearchFinding consumers cannot crash on malformed text; v2 semantics are explicit.

### Sequence

1. Fix the Windows proof baseline (#293/#294/#318).
2. Publish #304.
3. Land v1 robustness (#318/#324/#325/#326).
4. Record ResearchFinding v2 ADR.
5. Implement v2 across Product and Lab.
6. Publish cross-repository conformance vectors.

### Do not include

- a hosted API;
- weekly raw events in the public projection;
- a generic plugin runtime;
- silent semantic changes to v1.

## H2 — Evidence flagship

### Exit outcome

The selected v3 observation store powers a second user-visible analytical lens with support, censoring, coverage, limitations and evidence lineage.

### Recommended implementation slices

1. **Lens kernel:** compile-time interfaces and abstention vocabulary.
2. **Observation bridge:** explicit scope/window query from invented selected store.
3. **Support assessment:** coverage/comparability/sample/event thresholds.
4. **Estimator:** Kaplan–Meier and cumulative risk/competing outcome tables.
5. **Sensitivity:** changed-files primary; log lines-changed and continuous rank.
6. **Finding/evidence graph:** every displayed number resolvable.
7. **API:** one versioned endpoint.
8. **UI:** extend a reachable System/Research surface.
9. **Synthetic showcase:** use the same implementation through an explicit C0 source.
10. **Analytical review:** construct validity, cohort, censoring, alternatives and usefulness.

## H3 — Safe activation

### Exit outcome

One real, public, owner-selected metadata scope can be collected and deleted locally with bounded authority.

### Sequence

1. #201 Data Charter v2.
2. #317 capability consistency.
3. #202 consolidated readiness, not scattered micro-PRs.
4. Exact activation card.
5. One public repository, metadata only.
6. Request/retention receipt.
7. Analysis through the already valuable #174 path.
8. Revoke and prove complete deletion/replay.
9. No public derived output.

## H4 — Query and distribution

### Exit outcome

Users can ask deterministic questions of local evidence and install/use the useful core without cloning developer tooling.

1. Deterministic Query Lab.
2. Automatic local recommendations with traceable ranking.
3. Optional manual Luna hypothesis generation only after preview and opt-in.
4. npm CLI.
5. thin `gh` launcher.
6. desktop spike only if measured setup friction supports it.
7. per-launch loopback session token before casual packaging.

## H5 — Expansion

Only after H2/H3 establish product utility:

- aggregate Team mode;
- richer source structure;
- raw-content profile under strict capability;
- mature RAG ladder and research workbench;
- desktop shell;
- external brand/commercial options;
- carefully selected real-data research publication.

## Parallelism

Safe parallel lanes are possible, but only with disjoint authority and files:

- release truth + isolated Windows test-fixture fix;
- #304 contract + #174 design spike, provided shared export/types are owned by one lane;
- Product v1 robustness + Lab non-overlapping packaging;
- docs portfolio seeding + code implementation.

Never parallelize:

- two writers to the same contract registry;
- Product and Lab publishing the same version independently;
- release metadata against a moving unmerged security base;
- real activation while charter/readiness is unresolved.
