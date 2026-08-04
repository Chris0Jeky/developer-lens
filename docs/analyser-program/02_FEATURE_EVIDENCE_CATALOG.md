# Feature and Evidence Catalog — Developer Lens Intelligence Platform

Status: **Draft (planning artifact)** · Session: 2026-08-04 planning-and-seeding
Authority note: `docs/analyser-program/` is a **non-authoritative working proposal space**. Stable
contracts live only in `../DEVELOPER_LENS_V2_ARCHITECTURE.md` (canonical), `../data-charter.md`, and
`../source-capability-matrix.md`. Where this file disagrees with those, **those win**. This file
elaborates ADR-01…24 in `01_REFERENCE_ARCHITECTURE.md`; it never contradicts them.

Labels: **V** verified repository fact · **D** documented platform fact · **R** recommendation ·
**I** inference · **A** assumption (with reversal path) · **REJ** rejected · **G** owner gate.

## 0. How to read this catalog

**What this file is.** One compact entry per capability domain named in `00_PRODUCT_BRIEF.md` §6,
grouped by the brief's eight groups. Each entry carries exactly eight fields, in this order:

| Field | Contains |
|---|---|
| Q / decision | The humane user question; the legitimate decision it supports |
| Sources / fields | Authoritative sources and exact fields (canonical Appendix B inventory IDs `B1`–`B28`, matrix IDs `GH-*`/`GIT-*`/`SRC-*`/`X-*`) |
| Classes / prohibited / posture | Permitted classes C0–C4, prohibited inputs, collection vs ephemeral-compute posture (`D` default · `O` opt-in · `A` aggregate-only · `E` ephemeral compute · `X` reject) |
| Canonical objects | Facts, features (`DL.*` IDs), graph projections. `(P)` = proposed by this programme, not yet canonical |
| Baseline / modelled | Deterministic baseline; statistical/ML method only where justified, else `none justified` |
| Gates / corrections / coverage | Eligibility and sample gates, correction and deletion semantics, which ADR-02 coverage dimensions bind |
| Confounders / falsifiers / bounds | Confounders; what would falsify the claim; cost/resource bounds |
| UI / corpus / eval / deps / rollout | System Atlas view (ADR-23), synthetic corpus sketch, evaluation gate, ADR/card dependencies, rollout and rollback |

**What this file is not.** It does not restate canonical tables. The canonical metric dictionary
(§4), capability matrix (§3), privacy classes and sink contracts (§5), data contracts (§6), analysis
catalogs (§8–§9), LLM boundary (§10), storage/pack contract (§11), phase backlog (§14), and
Appendices B–G remain the authority for everything they already define. Entries below reference them
and add only the programme's **deltas** and **new proposed objects**.

**Binding conventions inherited, restated once, never re-litigated per entry.**
(1) **System, never person** — no productivity, performance, effort, attendance, hours, availability,
diligence, quality, worth, personality, sentiment, burnout, individual cadence, named or pseudonymous
bus factor, or people ranking, under any name (brief §3.1; charter *Product boundary*;
`PERSON-METRIC-X`, `GH-PEOPLE-X`); every entry has passed an ADR-14 proxy/composition review and says
in its gates field where it was coarsened or suppressed. (2) **The evidence ladder is one-way**
(canonical §6) — a modelled continuity match, a suggested edge, or a change-point candidate never
becomes an observed fact and never enters a deterministic ratio. (3) **Absence is never zero** —
`null` means ineligible, unavailable, censored, refused, or insufficient sample. (4) **No single
persuasive confidence scalar** — coverage is the ADR-02 registered vector (`permission, completeness,
freshness, censoring, conflict, sample, source_diversity, parser_coverage, comparability, drift,
calibration`), and degradation is monotone. (5) **Deterministic completeness** — with modelled and
hypothesis layers disabled, every primary panel still renders useful content. (6) **Embeddings
inherit the highest input class and are never anonymisation** (brief §3.6). (7) **Retention** (G2):
C1 36m · C2 13m · C3 90d · C4 process lifetime · X never; deletion is the ADR-03 registry-enumerated
cascade. (8) **Ephemeral compute** always means the ADR-06 isolated worker — no network, shell, or
repository executables/hooks/config/plugins; bounded input/time/memory/output; stdout/stderr
disabled; per-file crash recorded and skipped.

**Proposed limitation codes.** These extend the canonical §7 dictionary and are all `(P)`:
`PARSER_TIER_UNSUPPORTED`, `PARSER_BUNDLE_MAJOR_MISMATCH`, `SNAPSHOT_INCOMPARABLE`,
`COMMIT_MODULE_CAP_EXCEEDED`, `COMMIT_OVERSIZE_EXCLUDED`, `CODEOWNERS_FILE_TOO_LARGE`,
`TEAM_SIZE_ONE_SUPPRESSED`, `COVERAGE_SHIFT_CANDIDATE`, `SBOM_ECOSYSTEM_INCOMPLETE`,
`ATTESTATION_UNVERIFIABLE`, `DEP_ALERT_FEATURE_DISABLED`, `GIT_REFLOG_NOT_EVIDENCE`,
`CADENCE_GRAIN_FLOOR`, `SUGGESTED_EDGE_NOT_OBSERVED`, `MODEL_DEMOTED`, `INDEX_STALE`,
`SPARSE_SUPPRESSED`, `PARITY_UNREPRODUCIBLE`. `RERUN_NOT_FLAKE` already exists (canonical
Appendix F).

**Owner gates surfaced by this catalog** (flagged, never assumed authorised; each belongs in
`08_OPEN_QUESTIONS.md`): **G-a** ADR-10 Tier-2 semantics (PR/issue prose, durable text embeddings);
**G-b** ADR-20 step-3 durable vector index as a reviewed sink; **G-c** ADR-19 `validated` promotion
on consented real data, per candidate; **G-d** capability-registry rows that the canonical §3 matrix
describes but `source-capability-matrix.md` does not yet carry (`GH-RULE-01` policy aggregates,
`GH-ATTEST-01` attestation coverage, `GH-TAXONOMY-01` topics/licence/custom properties,
`GH-DISCUSS-01` discussion metadata); **G-e** artifact/cache **metadata-only** counts
(`GH-ACT-ART-X` is "not now", not approved). No card below **proceeds** on an ungated item
(2026-08-04 review correction): two entries source G-d capabilities — CAT-PRT-01's ruleset feed
(DL-PORT-02) and the attestation entry (DL-PROV-01) — and both are therefore OWNER_GATED/PARKED
on the board and in `07_DELIVERY_ROADMAP.md`, with G-d/G-e recorded in `08_OPEN_QUESTIONS.md` §1
and `HUMAN_TODO.md` q-6. Implementation before those gates is a charter change-control violation.

---

# Group 1 — Spine

*"Why am I seeing this, what is missing, and what did I consent to?"*

## CAT-SPN-01 — Evidence Spine 2.0 (typed claim / limitation graph)

- **Q / decision** — *"Why am I seeing this number, and what exactly is it standing on?"*
  Supports the decision to **trust, discount, or re-collect** a specific rendered statement before
  acting on it — and the meta-decision of whether the product is worth believing at all.
- **Sources / fields** — No external source. Inputs are internal: `CanonicalEnvelope` v2
  (`evidenceId`, `layer`, `provenance`, `capabilityId`, `consentRevision`, `coverageId`,
  `redactionRevision`, `supersedesEvidenceId`, canonical §6), `coverage_ledger` rows, the versioned
  limitation dictionary (canonical §7), and the feature registry. Provenance ultimately resolves to
  Appendix B `B1`–`B28` via the producing capability.
- **Classes / prohibited / posture** — Permitted **C1 only** by construction: statement codes,
  method IDs + versions, scope aliases, windows, schema versions, IDs. Prohibited: any payload
  value, prose, name, path, alias-to-name mapping, or free-text rationale in `claim.statement_code`;
  the enum is closed. Posture `D` (default, no collection of its own). No new sink (ADR-01).
- **Canonical objects** — Tables `claim`, `claim_evidence_edge`, `limitation_instance`,
  `lineage_event` (ADR-01, all STRICT + FK). Claim IDs `cl_` + SHA-256 over
  (`statement_code`, `method_id@version`, canonical-ordered input evidence IDs, window, scope alias,
  schema version). Features `DL.SPINE.CLAIM_RESOLUTION_RATIO.v1` (P) — rendered claims whose full
  walk resolves to stored records / rendered claims; `DL.SPINE.CONTRADICTION_COUNT.v1` (P) — edges
  with `role='contradicts'` per claim family × window; `DL.SPINE.SUPERSESSION_COUNT.v1` (P) — claims
  replaced via `superseded_by` per window (the correction-visibility measure).
- **Baseline / modelled** — Deterministic relational walk (UI element → claim → edges → evidence →
  coverage → capability → consent revision). **None justified**: ranking or scoring claims by a
  learned relevance model would reintroduce a persuasive scalar (brief §3.7). Retrieval ranking is a
  separate, gated concern (CAT-INT-02).
- **Gates / corrections / coverage** — Eligibility: a claim may only be written if every referenced
  evidence ID exists in the same store transaction. Corrections: a changed input set produces a
  **new** claim plus a `superseded_by` link and a `lineage_event(correction)` — never an in-place
  overwrite. Deletion: revocation cascades delete claims and edges whose evidence basis is deleted,
  writing `lineage_event(tombstone_cascade)`; a claim may never outlive its basis. Coverage
  dimensions bound: **all** — the spine is the carrier, but the spine's own health binds
  `conflict` (contradiction edges) and `completeness` (unresolvable references are a
  CI-blocking data-quality finding, not a rounded-away miss).
- **Confounders / falsifiers / bounds** — Confounder: deterministic ID instability across platforms
  (float formatting, locale, collation) would silently fork claim identity; the canonicalisation
  function is therefore versioned. Falsifier: a replay of identical inputs producing a different
  claim ID, or a rendered claim whose walk fails to resolve — either falsifies the spine's core
  promise. Bounds: SQLite joins over the four families; if claim volume degrades the Evidence Drawer
  on realistic corpora, add **materialised projection tables, not a new engine** (ADR-01 revisit).
- **UI / corpus / eval / deps / rollout** — UI: **Evidence Drawer** (universal claim inspector,
  card UX-ED) plus every view's clickable numbers. Corpus: invented claim sets containing a
  supported claim, a contradicted claim, a superseded claim with correction lineage, a claim whose
  evidence was revoked mid-session, and a deliberately dangling reference. Eval gate: 100% of
  rendered insights resolve every cited evidence ID; replay reproduces identical claim IDs and table
  checksums (brief §5). Deps: ADR-01; cards SPINE-01/02/03, UX-ED. Rollout: additive tables in the
  P2 store; rollback = drop the four families — deterministic features are unaffected.

## CAT-SPN-02 — Coverage and confidence intelligence

- **Q / decision** — *"What is missing here, and how much should that change what I conclude?"*
  Supports deciding whether to **act, wait for more collection, widen consent, or accept an
  abstention** — and it is the guardrail that stops every other entry from over-claiming.
- **Sources / fields** — Internal: `CoverageRecord` (`status`, `expectedUnits`, `observedUnits`,
  `omittedUnits`, `saturationReason`, `retryable`, `limitationCode`, canonical §6), connector
  `reconcile()` output (canonical §7), the capability manifest (REST/GraphQL versions, permission
  probes, plan/GHES constraints), and per-domain parser/snapshot metadata from CAT-STR-02/03.
- **Classes / prohibited / posture** — **C1**. Prohibited: any reason string derived from a provider
  message, raw stderr, exception cause, or path; only stable codes. Posture `D`. Absence of a source
  is recorded as one of the ten canonical `CoverageStatus` values, never as zero units.
- **Canonical objects** — Existing `DL.COV.COMPLETE_RATIO.v1`, `DL.COV.FRESHNESS_AGE_H.v1`,
  `DL.DQ.CONFLICT_RATIO.v1` (canonical §4 — unchanged). Programme deltas:
  `DL.COV.DIMENSION_VECTOR.v1` (P) — the registered twelve-dimension vector with a `limiting_reason`
  per dimension; `DL.COV.ABSTENTION_RATIO.v1` (P) — claims abstained / claims attempted per family ×
  window; `DL.COV.PARSER_COVERAGE.v1` (P) — admitted files or bytes / eligible, per language ×
  parser tier; `DL.COV.COMPARABILITY.v1` (P) — snapshot pairs with equal parser major and config
  revision / snapshot pairs compared. `EvidenceConfidence`'s six fields map 1:1 into the extended
  set (ADR-02 compatibility).
- **Baseline / modelled** — Deterministic ledger arithmetic plus per-claim-family **minimum vector
  requirements** and monotone abstention (ADR-02). Statistical candidate: **probabilistic
  observability / missingness** (canonical §9, WB-C7) — predicts *observability*, never activity,
  needs ≥500 collection outcomes across repeated probes, evaluated by calibration/Brier against
  later probes. Justified only as a collection-planning aid; it may never adjust a displayed
  coverage number. Baseline stays the explicit ledger.
- **Gates / corrections / coverage** — A missing dimension is `null` + limiting reason, **never a
  default 1.0**. Claim tiers declare floors (e.g. a modelled change-point claim requires
  `completeness ≥ 0.8`, `comparability = 1`, `calibration ≠ null`); no dimension can compensate for
  another below a floor. Corrections: a later successful collection supersedes the coverage record
  and recomputes only dependent features. Deletion: coverage rows are descendants of their
  capability and are deleted by the ADR-03 cascade; the content-free tombstone remains. Dimensions
  bound: **all eleven** (this is their registry).
- **Confounders / falsifiers / bounds** — Confounder: `expectedUnits` is itself an estimate; an
  optimistic expectation manufactures apparent incompleteness and a pessimistic one manufactures
  false completeness. Falsifier: a degraded-coverage fixture on which the system does **not**
  abstain or downgrade; any silent-zero in the canary suite. Bounds: O(coverage rows); negligible
  compute. Limitation-copy resolution is a dictionary lookup keyed by (claim family × limiting
  dimension).
- **UI / corpus / eval / deps / rollout** — UI: **Coverage/Privacy Cockpit** (UX-CC) and coverage
  furniture inside every other view — suppressed or missing data renders explicitly, never blank.
  Corpus: fixture suites with deliberately degraded coverage per dimension (refused, restricted,
  truncated at each documented cap, stale, censored, conflicting, failed, deleted), plus a
  fully-covered control. Eval gate: abstention correctness ≥ the preregistered proportion on the
  degraded suites; zero silent-zero violations (brief §5). Deps: ADR-02; cards SPINE-04, SPINE-05,
  UX-CC. Rollout: new dimensions are additive; rollback = ignore the new dimensions and fall back to
  the six `EvidenceConfidence` fields.

## CAT-SPN-03 — Capability lifecycle, consent, revocation, deletion

- **Q / decision** — *"What did I actually authorise, what is being kept, and what happens if I
  revoke it?"* Supports the decision to **activate, suspend, revoke, or re-consent** a capability
  with a truthful preview of what would be deleted.
- **Sources / fields** — Internal: `capability_consent`, the hash-bound activation card (exact
  scope, purpose, retained fields, deletion, proving checks), the schema registry (source of
  descendant enumeration), retention clocks per class, `lineage_event`, and the canonical §3 /
  matrix boundary per capability ID.
- **Classes / prohibited / posture** — **C1/C2** (consent revisions, capability IDs, timestamps,
  card hashes). Prohibited: storing the card's free text as an analytical field; storing any
  provider identity; inferring a state from a gate approval. Posture `D`. **Approval of G2/G3/G4
  never performs a state transition** — proven by a registry-snapshot test that walks every
  capability after simulated approvals and asserts state is unchanged (ADR-03).
- **Canonical objects** — State machine `never_authorized → card_bound → previewed → active ⇄
  suspended → revoked(tombstoned)`. Features `DL.LIFE.CAPABILITY_STATE.v1` (P) — current state per
  capability (presentation fact, not a metric); `DL.LIFE.RETENTION_AGE_RATIO.v1` (P) — oldest
  retained row age / class retention limit, per capability × class;
  `DL.LIFE.DELETION_CASCADE_COMPLETENESS.v1` (P) — descendant tables enumerated from the registry
  and successfully deleted / enumerated, emitted by the cascade itself.
- **Baseline / modelled** — Deterministic typed state machine + registry-generated enumeration.
  **None justified** — a learned model of "what would be deleted" is a category error; deletion
  completeness must be derivable, not estimated.
- **Gates / corrections / coverage** — Transitions require: `card_bound` = reviewed hash-bound card;
  `previewed` = the user saw the exact read boundary and retention; `active` = proving checks green
  at the exact head. Reconsent after a card change re-enters at `card_bound`. Corrections: a card
  hash mismatch fails closed and blocks collection. Deletion: stop collection → enumerate
  descendants (facts, features, claims, graph projections, caches, retrieval indexes, model outputs,
  application-controlled packs/backups) → delete → content-free tombstone → `lineage_event`.
  Restore replays tombstones **last**, so backup cannot resurrect revoked data. Dimensions bound:
  `permission` primarily; a suspended capability drives `completeness` and `freshness` downward in
  every dependent claim.
- **Confounders / falsifiers / bounds** — Confounder: descendant enumeration drifting behind a new
  table; that is a **CI-blocking schema-registry defect**, not an acceptable gap. Falsifier: a
  canary row surviving a revocation cascade; a gate approval that moves a state. Bounds: deletion is
  O(descendant rows); the product **cannot** promise recall from user-copied exports, provider-held
  copies, filesystem snapshots, or physical media, and must say so (charter).
- **UI / corpus / eval / deps / rollout** — UI: **Coverage/Privacy Cockpit** (UX-PC/UX-CC) — per
  capability: state, retained classes, ages vs retention clocks, last collection, **deletion
  preview**, provider-held-copy disclosure. Corpus: invented capabilities in each state; a card-hash
  mismatch; a partially failed cascade; a backup taken before revocation and restored after. Eval
  gate: fail-closed on unknown state or missing card; a failed cascade leaves the capability
  `suspended` with a data-quality finding, **never half-deleted-but-active**. Deps: ADR-03; cards
  LIFE-01/02/03, UX-PC. Rollout: P4's card parser/loader and P12's activation slices become
  instantiations, not rewrites; rollback = the previous per-capability flow with the state machine
  in observe-only mode.

---

# Group 2 — Structure

*"How is this system built, and how did its shape change?"*

## CAT-STR-01 — Repository X-Ray (committed-tree composition)

- **Q / decision** — *"What is this repository actually made of, and where are its boundaries?"*
  Supports deciding **where structural work is worth doing** — which package boundary, which role
  surface is missing (no CI definition, no migrations, no API surface) — without reading a path.
- **Sources / fields** — `SRC-COMP-01` / `REPO-DOC-01` via Appendix `B27` (`git ls-tree -r -z
  --long <card_bound_ref_oid>^{tree}`): mode, blob size, and path — all consumed **inside** the
  worker. **The activation card binds the exact OID; no mutable ref is ever selected** (never
  `HEAD`, `HEAD^{tree}`, a branch name, or any symbolic ref), and moving the checkout's `HEAD` must
  not change the output — XRAY-02 carries a test asserting byte-identical enumeration across
  checkout `HEAD` movement. `GH-LANG-01` (Appendix `B1` language edges) as an independent
  cross-check for `source_diversity`. **Manifest handling here is name-only:**
  `cap.source.structure` alone permits filename/extension/presence classification, so a
  `dependency_manifest` file may be **counted and role-classified by its name** and nothing more.
  Reading or parsing a manifest **body** — declared dependencies, workspace topology, SBOM-adjacent
  content — requires `cap.github.dependencies` (a future local-manifest capability would first
  need its own reviewed matrix row — none exists today) to be
  **separately active with its own explicit card dependency**; consent is never piggybacked on
  `cap.source.structure`, and `GH-SBOM-01` rules (`B16`) govern bodies only inside that capability.
- **Classes / prohibited / posture** — Input **C4** (paths, names, file lists, modes) destroyed
  in-process; retained **C1** only. Prohibited: paths, file names, identifiers, symbols, source
  bytes, parser diagnostics, working-tree state (`SRC-WORKTREE-X`), submodule recursion without its
  own consent, **manifest bodies of any kind under this capability alone**, and any content read
  beyond the closed role-sniffing tables. Posture `O+E→A` under
  `cap.source.structure` (G3 approved, P10).
- **Canonical objects** — Closed role taxonomy {build, test, docs, config, migration, api_surface,
  ci_definition, dependency_manifest, generated, vendored, binary_asset, schema_definition,
  fixture_golden, snapshot_artifact} (14 roles, ADR-05). Features
  `DL.XRAY.LANGUAGE_SHARE.v1` (P) — byte share by controlled language vocabulary;
  `DL.XRAY.ROLE_PRESENCE.v1` (P) — presence boolean + file count per role;
  `DL.XRAY.PACKAGE_BOUNDARY_COUNT.v1` (P) — distinct package/monorepo boundaries via
  manifest-presence classes (**filename/extension presence only — no body is read**);
  `DL.XRAY.ENUMERATION_COVERAGE.v1` (P) — enumerated / expected entries.
- **Baseline / modelled** — Deterministic enumeration and table-driven classification. **Layer:
  deterministic (derived), never observed** — language shares, role counts, and boundary counts are
  products of enumeration plus the closed classification tables and carry `parser_coverage`
  limitations; only `GH-LANG-01`'s provider edges are an observed fact. **None
  justified** — a learned role classifier would need file names or content as features, which are
  C4/X; the extension/manifest-name tables are both sufficient and auditable.
- **Gates / corrections / coverage** — Eligibility: one card-bound immutable ref OID; a dirty
  working tree, or a checkout whose `HEAD` points elsewhere, must produce an identical result.
  `n≥1` entries. Corrections: a new snapshot **replaces**, never merges — composition is a
  snapshot-scoped derivation, not an accumulating observation. Deletion: `cap.source.structure`
  revocation deletes summaries and the parser cache; C4 never persisted, so nothing to delete
  there. Dimensions bound:
  `parser_coverage` (role sniffing that abstains), `completeness` (truncated enumeration),
  `comparability` (config revision), `permission`. A failed classification degrades
  `parser_coverage`; it never fabricates a composition share.
- **Confounders / falsifiers / bounds** — Confounders: vendored and generated trees inflate language
  share; monorepos make "repository composition" a weak unit; provider language detection and local
  enumeration legitimately disagree. Falsifier: two enumerations of the same card-bound OID
  producing different shares; an enumeration that changes when the checkout's `HEAD` moves; a role
  marked present whose only evidence was an excluded generated file. Bounds: `O(F)` entries
  (canonical §12); **no manifest bytes are admitted under this capability** — bounded `O(B)` body
  parses exist only inside the separately-consented dependency capability (CAT-FBK-03); worker
  time/memory/output caps; no network, no lazy fetch.
- **UI / corpus / eval / deps / rollout** — UI: **Evidence Atlas** (system overview card) and
  **Architecture Time Machine** (composition strip). Corpus: monorepo with three packages; a
  generated-heavy repository; vendored directory; binary and symlink entries; NUL-safe unusual
  names; an empty tree; a repository whose only test evidence is generated; schema, golden-fixture,
  and snapshot-artifact trees for the three roles added in ADR-05; **a checkout whose `HEAD` is
  moved to an unrelated ref between two runs of the same card-bound OID**. Eval gate: identical
  output with a dirty working tree **and across checkout `HEAD` movement**; zero paths/names in any
  sink under the adversarial canary scan; **zero manifest-body reads with only
  `cap.source.structure` active**. Deps: ADR-05, ADR-06 (worker), matrix `cap.source.structure`
  (**manifest bodies additionally require `cap.github.dependencies`**); cards XRAY-01/02/03.
  Rollout: opt-in activation card; rollback = revoke capability, delete summaries.

## CAT-STR-02 — Code Anatomy Atlas (opaque module graph, API surface, test topology)

- **Q / decision** — *"How is this system wired, where does it knot, and how wide is what it
  exposes?"* Supports deciding **which coupling or cycle to attack**, and whether an API surface
  moved in a way worth documenting.
- **Sources / fields** — `SRC-MODULE-01`, `SRC-API-01` via `B27`: committed blobs streamed into
  pinned bundled parsers. Tier-1 TypeScript/JavaScript via the pinned TS compiler API (typed import
  graph, public-declaration counts). Tier-2 pinned tree-sitter grammars (initial: Python, C#, Java,
  Go, Rust) for import/reference edges and declaration counts (ADR-06).
- **Classes / prohibited / posture** — Input **C4** (source bytes, AST, identifiers, import strings,
  parser diagnostics) destroyed in-process. Retained: **C3** opaque graph (90d) — HMAC module nodes,
  typed edge counts — plus **C1** summaries (36m). Prohibited: names, import strings, signatures,
  symbols, any reverse map in packs, LSP servers or any non-bundled executable (`REJ` per ADR-06
  option (d)), and repository-supplied parser plugins. Posture `O` under `cap.source.structure`.
- **Canonical objects** — `graph_projection` family `module.v1` (P) with `graph_node`/`graph_edge`.
  Existing `DL.ARCH.CYCLE.v1` (Tarjan SCC: SCC count, largest SCC, nodes-in-cycles ratio) and
  `DL.ARCH.API_SURFACE_DELTA.v1` (added/removed public declarations, current total) — canonical,
  unchanged. Programme deltas: `DL.ATLAS.MODULE_DEGREE_DIST.v1` (P) — in/out degree distribution;
  `DL.ATLAS.FANIN_FANOUT.v1` (P) — per-module fan-in/fan-out with sparse suppression;
  `DL.ATLAS.TEST_TOPOLOGY_RATIO.v1` (P) — modules with an inbound edge from a `test`-role module /
  modules, **framed as declared test reachability, never as test quality or adequacy**.
- **Baseline / modelled** — Deterministic graph algorithms (SCC/components `O(V+E)`, degree
  distributions, declaration counts). **Layer: module counts, degree distributions, and declaration
  counts are deterministic (derived) parser products, never observed facts**, and every one of them
  carries its `parser_coverage` limitation. Statistical candidates deferred to research: community
  detection and graph embeddings stay WB-C5 (ADR-18); the architecture-change classifier stays WB-C8
  with deterministic API/graph-delta thresholds as its baseline (canonical §9). **None justified for
  shipping now.**
- **Gates / corrections / coverage** — Eligibility: `≥2` nodes and declared parser coverage for
  `DL.ARCH.CYCLE.v1`; API deltas need **two comparable snapshots** (equal parser major, equal config
  revision) and a supported extractor. `parser_bundle_version` stamps every output. Corrections:
  graph correction is **snapshot replacement**; a parser-bundle upgrade invalidates only dependent
  features. Deletion: C3 graph rows expire at 90 days and are deleted by cascade; the C1 summary
  survives to 36 months but is unusable as a graph. Dimensions bound: `parser_coverage`,
  `comparability`, `completeness`, `permission`. Unsupported languages **abstain** with
  `PARSER_TIER_UNSUPPORTED` (P); they never contribute zero edges.
- **Confounders / falsifiers / bounds** — Confounders: dynamic imports, dependency injection,
  code generation, and re-export barrels make static edges partial; a "cycle" may be a valid design;
  declaration counts are syntax, not compatibility. Falsifier: a planted cycle the extractor misses,
  or a rename-only fixture producing a non-zero API delta. Bounds: parse `O(B + AST nodes)`; one
  isolated worker process per run; per-file crash is recorded and skipped; parser concurrency chosen
  from configured CPU/memory, **not** repository count (canonical §12).
- **UI / corpus / eval / deps / rollout** — UI: **Architecture Time Machine** (structure panel) and
  **Evidence Atlas**. Corpus: planted 2-node and 5-node cycles; a module split and a module merge;
  unsupported grammar; parser crash on one file; rename-only change; hostile input (deeply nested,
  pathological, oversized, injection-shaped identifiers). Eval gate: hostile fixtures produce **zero
  execution** and zero retained C4; planted cycles recovered exactly; rename-only yields
  `DL.ARCH.API_SURFACE_DELTA.v1 = {0,0,unchanged}`. Deps: ADR-06 (blocks ADR-07, ADR-09 structural
  cross-checks, ADR-18); cards ATLAS-01…06. Rollout: capability activation card per repository;
  rollback = delete graph + summaries; adding a language requires a documented grammar-quality note
  and fixture corpus, **never at runtime**.

## CAT-STR-03 — Architecture Time Machine (comparable snapshots and eras)

- **Q / decision** — *"How did this system's shape change, and is that the system changing or my
  instrument changing?"* Supports deciding **whether an architectural narrative is real** before
  building a story or a refactor plan on it.
- **Sources / fields** — Composed, not collected: CAT-STR-01 composition, CAT-STR-02 graph and API
  counts, CAT-FBK-01/02 policy and CI aggregates, CAT-FBK-03 dependency aggregates — all keyed to
  the **same card-bound immutable ref OID** (never a mutable ref). Snapshot key: (repository alias,
  ref OID, `parser_bundle_version`, config revision) (ADR-07).
- **Classes / prohibited / posture** — **C3** graph members (90d) + **C1** aggregates (36m).
  Prohibited: cross-parser-major deltas presented as system change; era labels derived from
  anything but accepted change-points, policy/CI transitions, or user annotation. Posture `O+A`
  under `cap.source.structure` (plus whichever capability supplied each member).
- **Canonical objects** — `snapshot` contract (P) and features `DL.TIME.SNAPSHOT_COMPARABILITY.v1`
  (P) — comparable pairs / pairs attempted; `DL.TIME.MODULE_CONTINUITY.v1` (P, **modelled layer**) —
  continuity, split, and merge assignments from content-overlap matching over HMAC'd normalised
  identifier sets, with reported match confidence; `DL.TIME.ERA_DIFF.v1` (P) — deterministic diff of
  snapshot aggregates between two era boundaries, each element carrying its layer badge.
- **Baseline / modelled** — Deterministic aggregate diff is the baseline and is complete on its own.
  **Modelled and justified:** module continuity matching — without it, every rename reads as a
  deletion plus a creation, which manufactures architecture drift. It ships as a *modelled* claim
  with reported confidence and is excluded from every deterministic ratio. If continuity proves
  unstable on fixtures (below the preregistered stability threshold), **ship era diffs without
  continuity claims** (ADR-07 revisit).
- **Gates / corrections / coverage** — **Comparability requires equal parser major and equal config
  revision.** Incomparable pairs render as **separate eras** with an explicit `comparability`
  limitation (`SNAPSHOT_INCOMPARABLE` (P) / `PARSER_BUNDLE_MAJOR_MISMATCH` (P)) — **never as
  deltas**. A missing snapshot member degrades `comparability`, not the delta's magnitude.
  Corrections: re-snapshot replaces. Deletion: era labels are presentation and are deletable without
  touching facts. Dimensions bound: `comparability` (hard floor), `parser_coverage`, `completeness`,
  `drift`.
- **Confounders / falsifiers / bounds** — Confounders: parser drift, config drift, monorepo package
  addition, vendoring changes, and repository transfer all mimic architectural change. Falsifier: a
  planted split/merge fixture that continuity matching mislabels above the preregistered error rate;
  a delta that survives only across a parser-major boundary. Bounds: `O(snapshots × nodes)` matching
  with bounded candidate sets; snapshots are stored, not recomputed.
- **UI / corpus / eval / deps / rollout** — UI: **Architecture Time Machine** (UX-TM) and **Era
  Comparator** (UX-EC). Corpus: planted split, planted merge, rename-only era, parser-major bump
  between otherwise identical trees, a missing snapshot member, and an era boundary that coincides
  with a coverage shift. Eval gate: incomparable pairs never render as deltas; continuity stability
  meets the preregistered threshold or the feature ships disabled. Deps: ADR-07 (needs ADR-05/06,
  consumes ADR-17 change-points for era boundaries); cards TIME-01/02/03, UX-TM, UX-EC. Rollout:
  behind the same capability; rollback = drop continuity claims, keep era diffs.

---

# Group 3 — Change

*"What changes together, and what kinds of change recur?"*

## CAT-CHG-01 — Explicit-ref Git topology and history

- **Q / decision** — *"What is the real shape of this history, and where does the record stop?"*
  Supports deciding **which windows can carry any claim at all** — it is the dependency for
  coupling, cadence, traceability ancestry, releases, and snapshots.
- **Sources / fields** — `GIT-GRAPH-01`, `GIT-REF-01`, `GIT-SIGN-01` via Appendix `B24`/`B25`/`B26`:
  `git rev-list`, `git log`, `for-each-ref`, `merge-base --is-ancestor`, `verify-commit`,
  `verify-tag` — with `--no-replace-objects`, `--no-lazy-fetch`, aliases/hooks/filters/textconv/
  external-diff disabled. **Never `--all`, never an implicit fetch, never a repository executable.**
  Fields: OIDs, parent edges, author/committer ISO timestamps, ref class, annotated flag, tip OID,
  movement observations, verification outcome type + signature family + verifier + policy version.
- **Classes / prohibited / posture** — Retained **C2** (13m): HMAC commit/parent/tree/ref keys,
  timestamps, enums. Signature grades **C3** (90d) → C1 summaries. Prohibited: names, emails,
  subjects (that is CAT-CHG-03's separate ephemeral capability), paths, raw stderr (swallowed into
  stable codes), remotes, ref/tag names, signer identity, key fingerprints, verifier output.
  `GIT-REFLOG-X`: reflog is **not** analytical evidence — optional availability diagnostic only, and
  its absence can never prove no rewrite (`GIT_REFLOG_NOT_EVIDENCE` (P)). Posture `O` under
  `cap.local.git`; signatures `O+A` under `cap.git.signatures`.
- **Canonical objects** — Facts `fact_ref_movement` (canonical §6, existing). Programme deltas:
  `DL.GIT.MERGE_STRUCTURE_MIX.v1` (P) — share of commits by parent count (root / single / merge) per
  window; `DL.GIT.FIRST_PARENT_DEPTH.v1` (P) — first-parent distance between release targets;
  `DL.GIT.REF_MOVEMENT_MIX.v1` (P) — counts by movement enum {fast_forward, non_fast_forward,
  deleted, stale_upstream}; `DL.GIT.SIGN_COVERAGE.v1` (P) — objects passing the local verification
  policy / objects verified, by grade; `DL.GIT.REVERT_CANDIDATE_RATE.v1` (P, **modelled**) — revert
  and backport **candidates** identified by topology patterns only.
- **Baseline / modelled** — Deterministic graph extraction. **Modelled and justified (narrowly):**
  revert/backport candidacy — the provider exposes no authoritative revert edge, and topology
  patterns are genuinely informative; they ship as candidates with alternatives and are excluded
  from deterministic ratios (ADR-08). Sequence ML over commit topology stays research only.
- **Gates / corrections / coverage** — Eligibility: explicitly selected immutable refs; a linked
  worktree's non-primary head needs its own inclusion. Corrections: force-pushed/vanished history
  becomes **censored coverage**, never a deletion assertion; a non-fast-forward observation is
  recorded, and **"force push" is never labelled without authoritative movement observation**.
  Current reachability is **never** evidence of historical publication. Deletion: `cap.local.git`
  revocation deletes observations, topology descendants, checkpoints, aliases, derived outputs.
  Dimensions bound: `completeness`, `censoring` (`GIT_SHALLOW_BOUNDARY`,
  `GIT_PARTIAL_OBJECT_MISSING`), `permission`, `freshness`.
- **Confounders / falsifiers / bounds** — Confounders: shallow and partial clones truncate ancestry;
  grafts and replace objects rewrite apparent topology; squash-merge collapses batches; rebase
  rewrites timestamps. Falsifier: a hostile-config fixture that causes any execution; a shallow
  fixture whose boundary is not surfaced as coverage; a claim of publication from current
  reachability. Bounds: initial `O(C + parent_edges)`, incremental `O(new commits + new edges)`;
  verification is per-object and can be expensive, so it is separately opt-in.
- **UI / corpus / eval / deps / rollout** — UI: **Change River** (topology strip) and **Evidence
  Atlas**. Corpus: linear/merge/first-parent histories; annotated and lightweight tags;
  shallow/partial/replace/graft repositories; linked worktrees and detached heads; initialised and
  uninitialised submodules; stale and missing upstream refs; non-fast-forward movement; malicious
  diff/textconv/filter/signature configuration that **must not execute**. Eval gate: zero execution
  on the hostile corpus; every boundary appears as a coverage record with the right limitation code;
  raw stderr never reaches a sink. Deps: ADR-08 (blocks ADR-07, ADR-09, ADR-11 ancestry, ADR-14);
  cards GIT-01/02/03. Rollout: `cap.local.git` off by default; rollback = revocation cascade. Only a
  documented Git behaviour change reopens the flag set.

## CAT-CHG-02 — Temporal coupling and change amplification

- **Q / decision** — *"Which parts of this system keep moving together, and how wide does a typical
  change reach?"* Supports deciding **where a boundary is failing** and whether a migration was a
  contained wave or a long smear.
- **Sources / fields** — `SRC-COUPLING-01` over CAT-CHG-01 topology: selected commit diffsets mapped
  **ephemerally** path→HMAC module inside the ADR-06 worker (`B27`); cross-repository waves reuse
  pack-scoped dependency/contract aliases from `GH-SBOM-01`/`B16`.
- **Classes / prohibited / posture** — Input **C4** (paths, diffs, subjects) destroyed in-process;
  retained **C3** sparse graph (90d) + **C1** summaries (36m). Prohibited: paths, diffs, commit
  messages, module-name reverse maps in packs, and any framing of co-change as dependency,
  fault-proneness, ownership, or design quality. Posture `O` under `cap.source.structure` (+
  `cap.github.dependencies` for cross-repo waves).
- **Canonical objects** — Existing `DL.ARCH.TEMPORAL_COUPLING.v1` (pair co-change ratio with
  support) and `DL.CROSS.REPO_COOCCURRENCE_LIFT.v1` (weekly binary presence lift) — canonical,
  unchanged. Programme deltas: `DL.ARCH.CHANGE_RADIUS_DIST.v1` (P) — distribution of modules touched
  per eligible commit, over time; `DL.ARCH.COUPLING_STABILITY.v1` (P) — share of windows in which a
  pair remains above its support gate; `DL.ARCH.MIGRATION_WAVE.v1` (P) — connected subgraphs of
  elevated co-change bounded in time (size, span, member count);
  `DL.CROSS.CONTRACT_WAVE_LIFT.v1` (P) — cross-repository contract wave lift over dependency aliases.
- **Baseline / modelled** — Deterministic counting with support gates. **None justified** for
  coupling itself. Change-point detection over the radius series is a *separate* claim owned by
  CAT-PRT-02, never folded in here.
- **Gates / corrections / coverage** — Caps: **≤50 modules per commit** (excess excluded and
  disclosed, `COMMIT_MODULE_CAP_EXCEEDED` (P)); oversize and generated-only commits excluded and
  disclosed (`COMMIT_OVERSIZE_EXCLUDED` (P)). Canonical gates: `≥20` eligible commits and pair
  support `≥3` for `DL.ARCH.TEMPORAL_COUPLING.v1`; `≥12` eligible weeks and each side present `≥3`
  for the lift. Corrections: rename heuristics are **versioned**; a heuristic change invalidates
  dependent features only. Deletion: C3 sparse graph expires at 90 days and cascades on revocation.
  Dimensions bound: `completeness`, `sample`, `parser_coverage` (path→module mapping),
  `comparability` (rename-heuristic version), `censoring`.
- **Confounders / falsifiers / bounds** — Confounders: monorepo boundaries, formatting and lint
  sweeps, generated-code regeneration, squash merges, release-calendar synchrony, and shared
  automation all manufacture co-change. **Hard wording rule (copy dictionary, enforced):
  co-change is association; dependency, fault, ownership, or design-quality claims require
  independent structural evidence (ADR-06 edges) and then still render as separate claims with
  their own evidence.** Falsifier: a planted pair with no structural edge that a user can confirm is
  a formatting sweep; a wave that disappears when generated-only commits are re-included. Bounds:
  naive pair generation is `O(Σ changed_modules²)` — the per-commit cap is what makes it tractable;
  edges spill to SQLite/Parquet rather than an in-memory portfolio graph.
- **UI / corpus / eval / deps / rollout** — UI: **Change River** (UX-CR) with coupling and radius
  bands; pairs surface in **Architecture Time Machine**. Corpus: a huge commit above the cap; a
  rename wave; generated-only changes; a monorepo boundary crossing; a planted migration wave; a
  formatting sweep designed to produce spurious coupling. Eval gate: every exclusion appears as a
  disclosed count; suppressed sparse pairs never render; the copy dictionary rejects any dependency
  or quality wording. Deps: ADR-09 (needs ADR-08, ADR-06); cards COUP-01/02/03. Rollout: opt-in;
  rollback = delete graph + summaries. If support gates leave everything suppressed on real corpora,
  gates lower **only** through the preregistered display-gate process.

## CAT-CHG-03 — Semantic change analyser (charter-safe tier)

- **Q / decision** — *"What kinds of change does this system mostly receive?"* Supports deciding
  whether a period was **mostly maintenance, mostly feature work, or mostly migration** — a
  system-level mix, never a person's output.
- **Sources / fields** — `GIT-SEM-01` / `cap.commit.intent` via `B24`: ephemeral parse of **selected
  self-attributed commit subjects** (conventional-commit and rule families), emitting category,
  revert/fixup flags, rule-family version, and language-detected/unknown.
- **Classes / prohibited / posture** — Input **C4** (subject text) destroyed immediately; retained
  **C1** category counts only (36m). Prohibited: subjects, bodies, PR/issue prose, durable text
  embeddings, any per-author dimension, and any external model. Posture `O+E→A`. **Tier-2 (PR/issue
  prose, durable text embeddings, richer semantic retention) is owner gate G-a — not designed into
  any dependency here and assumed by no card** (ADR-10).
- **Canonical objects** — Existing `DL.CHANGE.INTENT_MIX.v1` (controlled categories {maintenance,
  feature, test, docs, refactor, fix, migration, config, dependency, revert, unknown}) — canonical,
  unchanged. Programme delta: `DL.CHANGE.INTENT_UNKNOWN_SHARE.v1` (P) — the `unknown` component
  promoted to a first-class coverage-facing feature, so a low-confidence mix is visibly
  low-confidence rather than quietly renormalised.
- **Baseline / modelled** — Deterministic rule families, language-agnostic first, `unknown`
  otherwise. **Modelled: not now.** A change-intent classifier stays WB-C2 research (ADR-19,
  canonical §9): it needs ≥500 owner-labelled invented/consented items and ≥50 per class, time and
  repository holdout, macro-F1 + calibration + abstention, **no commit-author features**, and it
  must beat the rule baseline on a preregistered gate. If it does not, it is rejected, not shipped
  with a caveat.
- **Gates / corrections / coverage** — Canonical gates: `≥20` subjects and **`≥80%` parser
  completion** per repository × window; components sum to 1 including `unknown`. Below gate:
  **abstain**. Corrections: a rule-family version bump recomputes the mix and supersedes prior
  claims; it does not rewrite them. Deletion: subjects are never persisted; revocation deletes
  summaries and the classifier cache. Dimensions bound: `parser_coverage`, `sample`, `completeness`,
  `drift` (convention change over time).
- **Confounders / falsifiers / bounds** — Confounders: text convention is not actual intent;
  conventional-commit adoption changes mid-history; multilingual and templated subjects; bot commits
  following a fixed template; squash commits summarising heterogeneous work. Falsifier: an
  owner-labelled invented corpus where the rules disagree with the label beyond the preregistered
  rate; a mix that shifts when only the rule version changed. Bounds: `O(subjects)` in-process;
  bounded subject length; no retention.
- **UI / corpus / eval / deps / rollout** — UI: **Change River** (family bands over time). Corpus:
  multilingual subjects; ambiguous subjects; injection-shaped subjects; revert/fixup chains; empty
  and very long subjects; a window that falls below the 80% gate. Eval gate: zero subject bytes in
  any sink; below-gate windows abstain rather than render a partial mix. Deps: ADR-10, matrix
  `cap.commit.intent`; cards SEM-01, SEM-02, research WB-C2. Rollout: separate ephemeral runtime
  opt-in; rollback = delete summaries.

---

# Group 4 — Flow

*"How does intent become integrated, released change?"*

## CAT-FLW-01 — Issue → PR → commit → release → deployment traceability graph

- **Q / decision** — *"How does a stated intention actually reach a release here — and how often
  does it not?"* Supports deciding **where the trail breaks** (untracked work, unlinked PRs,
  releases with no traceable batch) and whether linking discipline is worth adding.
- **Sources / fields** — `X-FLOW-01` composed from `GH-ISSUE-01` (`B6`: ID, state/reason/type,
  timestamps, parent/subissue, blocking, **closing-PR edges**), `GH-PR-01` (`B4`: merge OID),
  `GH-REL-01` (`B14`: tag target OID), `GH-DEPLOY-01` (`B15`: commit OID, state), and CAT-CHG-01
  first-parent ancestry (`B24`).
- **Classes / prohibited / posture** — **C2** IDs/OIDs → **C1** edges and ratios; deployment members
  **C3**. Prohibited: titles, bodies, comments, creators, assignees, branch names, URLs, and any
  causal or completion claim. Posture `D`/`O+A` under `github.core`, `cap.github.issue_taxonomy`,
  `cap.github.deployments`.
- **Canonical objects** — One typed `graph_projection` family **`traceability.v2`** with node kinds
  {issue, pr, commit_alias, release, deployment} and edge kinds {closes (**provider-observed**),
  blocks, parent, subissue, merge, release_ancestor (**first-parent proof**), deployment_of,
  revert_candidate (**modelled**), backport_candidate (**modelled**), suggested_assoc
  (**modelled**)} (ADR-11). Existing `DL.FLOW.ISSUE_PR_RELEASE_RATIO.v1` — canonical, unchanged, and
  **observed-edges-only**. Programme deltas: `DL.FLOW.CHAIN_COMPLETENESS.v1` (P) — chains whose every
  hop is observed / chains with at least one hop; `DL.FLOW.SUGGESTED_ASSOC_PRECISION.v1` (P,
  **modelled/calibration**) — suggested edges later confirmed by a provider edge / suggested edges,
  measured only on fixtures and on real supersession events.
- **Baseline / modelled** — Deterministic observed-edge graph; ratios use observed edges only.
  **Modelled and justified:** suggested associations (temporal adjacency, branch-topology patterns)
  — they are genuinely useful and the provider often has no edge. They render **only** in hypothesis
  styling, carry calibrated uncertainty, alternatives, and falsifiers, and are **excluded from every
  deterministic ratio**. The suggested-edge generator is removable without touching observed flow.
- **Gates / corrections / coverage** — Canonical gate: `≥10` eligible closed issues and complete
  issue/PR/release coverage for the ratio. Corrections: **history is never rewritten** — a new
  provider edge supersedes a suggested claim via `lineage_event`, and the Delivery Map **shows the
  correction**. Deletion: revoking any member capability deletes its nodes/edges and every dependent
  claim. Dimensions bound: `completeness` (any incomplete member forces abstention),
  `permission`, `censoring` (`GH_DEPLOY_STATUS_90D_CENSOR`), `calibration` (suggested edges only),
  `conflict`.
- **Confounders / falsifiers / bounds** — Confounders: teams that link nothing look identical to
  teams with no work; squash and backport break OID ancestry; monorepo releases batch unrelated
  issues; issue transfer and deletion produce ambiguous responses (`PERMISSION_AMBIGUOUS_404`).
  Falsifier: a suggested edge contradicted by a later provider edge above the calibrated rate; a
  ratio that moves when only linking convention changed. Bounds: pagination `O(Σ ceil(I_r/100))` +
  PR expansion (canonical §12); ancestry checks are `merge-base` queries against local topology.
- **UI / corpus / eval / deps / rollout** — UI: **Delivery/Traceability Map** (UX-DM); corrections
  animate as supersessions. Corpus: fully linked chain; unlinked chain; censored chain (deployment
  older than 90 days); reverted chain; transferred issue; a suggested edge later contradicted by a
  provider edge. Eval gate: deterministic ratios provably contain zero modelled edges (schema-level
  test); every correction is visible. Deps: ADR-11 (needs ADR-08 ancestry, ADR-01 claims); cards
  TRACE-01/02/03. Rollout: observed edges first, suggested-edge generator second and separately
  flagged; rollback = disable the generator.

## CAT-FLW-02 — Pull-request integration and rework observatory

- **Q / decision** — *"What shape does integration take here, and where does the queue actually
  stall?"* Supports deciding **whether to change batch size, split a stack, or leave it alone** —
  as a property of the queue, never of a person.
- **Sources / fields** — `GH-PR-01` (`B4`), `GH-PR-TL-01` (`B5`: ready/draft events, review state
  and time, thread resolved/outdated counts, head changes), `GH-STACK-01` (base/head relationships,
  linked PRs, merge-queue events where present, auto-merge state), `GH-CHECK-01` (`B13`) for first
  signal, `GH-REL-01` (`B14`) for batch shape.
- **Classes / prohibited / posture** — **C2** IDs/OIDs (13m) → **C1** enums, times, counts (36m).
  Prohibited: titles, bodies, review comments, branch names, URLs, reviewer or author identity —
  **the schema has no reviewer/author dimension at all** (ADR-12), so per-person latency is not
  suppressed at render time, it is unrepresentable. Posture `D` minimal under `github.core`.
- **Canonical objects** — Existing `DL.PR.INTEGRATION_DURATION_H.v1`,
  `DL.PR.FIRST_SIGNAL_DURATION_H.v1`, `DL.PR.REWORK_EPISODES.v1`, `DL.PR.CHANGE_SURFACE.v1`,
  `DL.REVIEW.COVERAGE_RATIO.v1`, `DL.REL.CHANGE_BATCH.v1` — canonical, unchanged. Programme deltas:
  `DL.PR.DRAFT_TRANSITION_MIX.v1` (P) — counts of draft↔ready sequences per PR cohort;
  `DL.PR.HEAD_MOVEMENT_EPISODES.v1` (P) — head-OID changes between review states (distinct from
  rework episodes, which require a `CHANGES_REQUESTED` precursor); `DL.PR.STACK_DEPTH.v1` (P) —
  observed base-chain depth; `DL.PR.RETARGET_COUNT.v1` (P) — base-retarget events;
  `DL.PR.CENSORED_TAIL_RATIO.v1` (P) — open/abandoned PRs at window end / eligible PRs, so the tail
  is a first-class number rather than a footnote.
- **Baseline / modelled** — Deterministic ECDF/quantiles with eligible and censored counts. **No
  means without a distribution** (ADR-12). Statistical candidate: **time-to-event / survival**
  (WB-C6, canonical §9) — Kaplan–Meier baseline, censoring-aware, Cox/AFT only with ≥100 events and
  ≥10 events per parameter, **no people/identity covariates**. Justified because right-censoring is
  intrinsic here and empirical quantiles discard the open tail; it stays research until it beats the
  KM baseline on a preregistered gate. Fallback: empirical completed/censored distributions.
- **Gates / corrections / coverage** — Canonical gates: `≥5` eligible events for PR distributions
  and review coverage; negative intervals are rejected as data-quality failures, not clamped.
  `ready_start` = `ReadyForReviewEvent`, else first complete observation where non-draft, else
  creation for never-draft PRs; store `event|censored`. **Cohort/eligibility:** PRs whose
  `ready_start` falls inside the window on repositories with complete timeline coverage; membership
  is fixed at `ready_start` and never re-assigned by merge date. **Event:** merge for integration
  duration, first check or review signal for first-signal duration, `CHANGES_REQUESTED`-preceded
  head movement for a rework episode. **Censoring:** PRs unterminated at the window boundary are
  **right-censored at that boundary**, counted in `DL.PR.CENSORED_TAIL_RATIO.v1` — never dropped,
  never zero, and absence of an event is never a duration. **Prohibited interpretations:** not
  throughput, effort, responsiveness, or any person's speed; not causal; a shorter duration is not
  a better one. Corrections: provider revision upsert;
  review edits and dismissals preserve state revision and supersede the projection with **no body
  retained**; a late timeline page recomputes only affected features. Deletion: `github.core`
  cascade. Dimensions bound: `completeness` (timeline pages), `censoring` (open tails,
  `GH_PR_COMMITS_250_CAP`, `GH_PR_FILES_3000_CAP`), `sample`, `freshness`, `conflict`.
- **Confounders / falsifiers / bounds** — Confounders: batching, merge queues, release freezes,
  time-zone-independent but source-lagged timestamps, bot reviews, stacked PRs whose child waits on
  a parent, and reviews that legitimately happen elsewhere or are unnecessary. **Wording rule: every
  latency is a system/queue property; the copy dictionary has no per-person formulation, and "fast"
  is never framed as a good.** Falsifier: a distribution that inverts when censored tails are
  included; a "rework episode" fixture where head movement provably did not respond to the review.
  Bounds: `Σ_r ceil((P_r+overlap)/100)` PR pages + per-PR review/timeline expansion (canonical §12);
  nested reviews saturate at 100 per page and must emit a truncation warning.
- **UI / corpus / eval / deps / rollout** — UI: **Delivery/Traceability Map** integration panel plus
  the Evidence Atlas summary; the ADR-04 first vertical slice renders a PR-integration-shape panel.
  Corpus: draft→ready→draft; closed-unmerged; reopened; >250 commits; >3,000 files; force-pushed
  head; missing timeline page; base retarget; deleted head; queue cancellation; a cohort that is
  entirely censored. Eval gate: no mean renders without its distribution; censored counts always
  displayed; schema contains no reviewer/author column (structural test). Deps: ADR-12 (extends the
  P7 lane); cards OBSV-PR-01/02/03; research WB-C6. Rollout: extends existing P7 facts additively;
  rollback = drop the new fact columns, canonical features unaffected.

## CAT-FLW-03 — Projects and aggregate ownership coverage

- **Q / decision** — *"Are the surfaces of this system covered by a declared rule, and how does
  planned work move between declared states?"* Supports deciding **where to add an ownership rule or
  a workflow state** — never who owns anything.
- **Sources / fields** — `GH-PROJV2-01` (`B9`: ProjectV2/item/field/status-change events, archive
  state, timestamps), `GH-CODEOWNERS-01` (`B22`: standard locations + provider error endpoint;
  content parsed ephemerally), `GH-TEAM-01` (`B23`: team ID/hierarchy/size band/repository
  association).
- **Classes / prohibited / posture** — Input **C4** (CODEOWNERS patterns and owners, project custom
  values, file paths) destroyed in-process; retained **C3** aliases/graph (90d) → **C1** summaries.
  Prohibited: handles, emails, member lists, team names/slugs, patterns, paths, custom-field prose,
  and any people graph or named bus factor (`GH-PEOPLE-X` remains rejected with **no authorization
  path**). **Copy dictionary bans "actively owned", "responsible team", "stewardship"; the only
  permitted claim is *declared-rule coverage*** (ADR-13). Posture `O+E→A` under
  `cap.github.projects` and `cap.github.ownership`.
- **Canonical objects** — Existing `DL.OWN.COVERAGE_RATIO.v1` (eligible committed files matched by
  ≥1 valid rule / eligible files; paths ephemeral) — canonical, unchanged. Programme deltas:
  `DL.OWN.RULE_ERROR_RATIO.v1` (P) — invalid or skipped CODEOWNERS lines / lines parsed, surfaced
  because a broken rule file looks identical to an absent one otherwise;
  `DL.GOV.PROJECT_TRANSITION_MIX.v1` (P) — aggregate transition counts between approved local status
  aliases; `DL.OWN.TEAM_COVERAGE_BAND.v1` (P) — repository coverage by team **size band**, with
  size-one suppressed.
- **Baseline / modelled** — Deterministic matching and counting. **None justified** — every learned
  variant of "ownership" collapses toward person inference, which is out of boundary categorically.
- **Gates / corrections / coverage** — Eligibility: complete file enumeration required for
  `DL.OWN.COVERAGE_RATIO.v1` (`n≥1`); a >3 MB CODEOWNERS file is **not loaded** by the provider
  (`CODEOWNERS_FILE_TOO_LARGE` (P)) and becomes coverage; invalid lines are skipped and counted.
  **Size-one team bands are suppressed** (`TEAM_SIZE_ONE_SUPPRESSED` (P)) — the proxy/composition
  review found a size-one band is a named individual by another route. Corrections: coverage is
  base-ref specific; a new ref snapshot replaces. Deletion: C4 destroyed immediately; C3 at 90 days;
  cascade on revocation. Dimensions bound: `permission` (hidden teams, `read:project` absent —
  `GITHUB_TOKEN` is documented as insufficient), `completeness`, `censoring`
  (`PROJECT_FIELD_HISTORY_UNAVAILABLE`), `sample`.
- **Confounders / falsifiers / bounds** — Confounders: declared coverage is not stewardship; a
  catch-all rule yields 100% coverage with no meaning; project boards are often abandoned mid-life;
  arbitrary custom-field history is **not generally available** (documentation uncertainty, canonical
  §15). Falsifier: a fixture with a catch-all rule that the UI presents as meaningful coverage
  without the catch-all disclosure; any rendered output resolvable to one person. Bounds: `ceil(T/100)`
  project pages + nested field-value pages; 50,000-item and field limits are documented.
- **UI / corpus / eval / deps / rollout** — UI: **Evidence Atlas** governance card; transitions in
  **Change River**. Corpus: multiple CODEOWNERS locations; invalid lines; >3 MB file; base-ref
  change; hidden team; inherited membership; size-one team; deleted project field; unsupported host
  schema; status history with unavailable custom-field history. Eval gate: sparse-suppression proofs;
  zero patterns/handles/names in any sink; banned copy strings fail the copy-dictionary test. Deps:
  ADR-13, matrix `cap.github.projects`/`cap.github.ownership` (G3 approved, P10); cards
  GOV-01/02/03. Rollout: per-capability activation card; rollback = revocation cascade.

## CAT-FLW-04 — System cadence and work-shape observatory

- **Q / decision** — *"At what rhythm does this system release and integrate, and did that rhythm
  change?"* Supports deciding **whether a release or integration rhythm shift is real** — at a grain
  deliberately too coarse to reconstruct anyone's schedule.
- **Sources / fields** — Composed from CAT-CHG-01 (release ancestry), CAT-FLW-02 (integration
  distributions), CAT-FBK-01 (CI queue/exec distributions), CAT-FBK-02 (release intervals), and
  CAT-STR-03 policy/CI transitions. No source of its own.
- **Classes / prohibited / posture** — **C1** only. **Prohibited outputs, schema-rejected (ADR-14):**
  event calendars, work-session boundaries, pause/return detection, hour-of-day or day-of-week
  profiles, cross-repository personal timelines, low-support windows, and any per-identity series.
  **Time-grain floors: nothing finer than ISO week for any cadence surface**; day grain is permitted
  *only* inside CI queue/exec distributions where the subject is provider infrastructure and support
  gates hold (`CADENCE_GRAIN_FLOOR` (P) when a request would go finer). Posture `D` derived.
- **Canonical objects** — `DL.CAD.RELEASE_INTERVAL_DIST.v1` (P) — distribution of first-parent
  release intervals per repository × window; `DL.CAD.INTEGRATION_SHAPE_TREND.v1` (P) — weekly
  quantile trace of `DL.PR.INTEGRATION_DURATION_H.v1` with censored counts;
  `DL.CAD.MACHINE_FEEDBACK_SHAPE.v1` (P) — weekly trace of CI queue/exec quantiles;
  `DL.CAD.TOPOLOGY_TRANSITION_COUNT.v1` (P) — sufficiently-supported coordination/topology
  transitions (e.g. merge-queue adoption, ruleset change) per window.
- **Baseline / modelled** — Deterministic weekly distributions. **None justified here** —
  change-point detection over these series belongs to CAT-PRT-02 and renders as a *separate*
  modelled claim, so cadence itself never carries a model.
- **Gates / corrections / coverage** — Minimum ISO-week grain; low-support windows are **suppressed,
  not smoothed**; canonical release-batch gate `≥3` valid intervals for distributions.
  **Cohort/eligibility:** one repository × ISO week, admitted only when every contributing source
  window is complete and above its own support gate; a partially covered week is suppressed, not
  partially plotted. **Event:** the terminal event of the underlying feature — release publication,
  PR merge, run completion — inherited from the source entry and never redefined here.
  **Censoring:** the trailing week and any item unterminated at the window edge are
  **right-censored at the boundary** and marked as such. A **fully covered eligible week with no
  events is an observed zero for event counts** — known inactivity is evidence, and dropping quiet
  weeks would bias cadence distributions toward active weeks. Duration/interval statistics over an
  empty cohort are a different matter: quantiles of zero observations are **undefined and stay
  `null` with an explicit empty-cohort marker** — a zero-duration observation is never fabricated
  (refined 2026-08-04 review round). `null` without the marker remains reserved for suppressed,
  incomplete, or otherwise unknown weeks. Corrections:
  late events recompute the affected week only; a re-collected window supersedes. Deletion: derived
  features cascade from their sources. Dimensions bound: `sample` (hard floor — this is the
  re-identification-critical domain), `completeness`, `censoring`, `comparability` (a policy change
  mid-series makes windows incomparable).
- **Confounders / falsifiers / bounds** — Confounders: holidays, release freezes, provider incidents,
  and collection gaps all reshape a cadence trace; a single-maintainer repository makes any cadence
  series a proxy for one person's calendar — **which is exactly why the grain floor and support
  gates are hard, not advisory**. Falsifier: any combination of shipped cadence features from which
  an attendance, schedule, or session pattern can be reconstructed on the proxy-review corpus.
  **Copy rule: "fast" and "busy" are never framed as goods; trend copy is descriptive.** Bounds:
  negligible compute over stored features.
- **UI / corpus / eval / deps / rollout** — UI: **Change River** (rhythm band) and **Era Comparator**.
  Corpus: a repository with one commit per quarter; a bot-driven weekly release train; a holiday gap;
  a permission loss mid-series; a synthetic single-maintainer repository used **specifically** as the
  proxy-review adversary. Eval gate: **ADR-14 schema-rejection tests** — every prohibited output
  fails at the schema layer, not at render; the proxy/composition review (CAD-02 checklist) is
  recorded for this and every other card. Deps: ADR-14 (needs ADR-08, ADR-12, ADR-15); cards
  CAD-01/02/03. Rollout: derived only; rollback = hide the views, delete nothing.

---

# Group 5 — Feedback

*"What did the machines say back, and how did the system respond?"*

## CAT-FBK-01 — CI and checks feedback studio

- **Q / decision** — *"What is the machine feedback loop actually like — how long, how noisy, how
  recoverable?"* Supports deciding **whether to invest in CI time, concurrency, or reliability**.
- **Sources / fields** — `GH-ACT-RUN-01` (`B10`: run/workflow IDs, attempt, event, status/conclusion,
  head OID, created/started/updated times), `GH-ACT-JOB-01` (`B11`: attempt-specific job IDs,
  timestamps, status/conclusion, step count, coarse runner class), `GH-CHECK-01` (`B13`: check
  runs/suites and commit statuses, annotation **count**), `GH-ACT-DEF-01` (`B12`: ephemeral
  data-only YAML parse for trigger classes, concurrency/path-filter presence, matrix-size category).
- **Classes / prohibited / posture** — **C3** observations (90d) → **C1** distributions (36m); YAML
  input **C4**. Prohibited: logs, artifacts, cache contents or keys, workflow/job/step/runner/
  environment **names**, display titles, branches, actors, annotation content or paths, raw YAML,
  and Actions expressions — which are **never evaluated** (`GH-ACT-ART-X` metadata is owner gate
  G-e). Posture `O+A` under `cap.github.actions` (G3 approved, P8).
- **Canonical objects** — Existing `DL.CI.QUEUE_DURATION_S.v1`, `DL.CI.EXEC_DURATION_S.v1`,
  `DL.CI.RERUN_RATIO.v1`, `DL.CI.RECOVERY_TRANSITION_RATIO.v1`, `DL.CI.OUTCOME_MIX.v1`,
  `DL.SYS.CHANGE_CI_ASSOC.v1` — canonical, unchanged. Programme deltas:
  `DL.CI.ATTEMPT_DEPTH_DIST.v1` (P) — distribution of max attempt per primary run;
  `DL.CI.CANCELLATION_CLASS_MIX.v1` (P) — cancellations classified by declared concurrency presence
  (from `GH-ACT-DEF-01` classes), because concurrency-cancelled and human-cancelled runs are
  otherwise indistinguishable; `DL.CI.MATRIX_FANOUT_CLASS.v1` (P) — jobs per run bucketed against
  the declared matrix-size category.
- **Baseline / modelled** — Deterministic attempt-aware distributions. **Modelled: rejected for
  now.** The CI failure-family classifier (WB-C3) is metadata-only by construction — logs stay
  prohibited — and canonical §9 states plainly: *if metadata is insufficient, reject rather than
  request logs*. CI-load forecasting (seasonal-naive baseline, ≥104 complete weekly observations)
  is research with a legitimate capacity decision only.
- **Gates / corrections / coverage** — Canonical gates: `≥10` for queue/exec/recovery/outcome-mix,
  `≥20` for rerun ratio, `≥20` observations per displayed bin and `≥3` bins for
  `DL.SYS.CHANGE_CI_ASSOC.v1`. Negative queue durations are data-quality failures, not clamps.
  Cancelled and skipped are **separate outcomes, never duration zero**. **Cohort/eligibility:** runs
  created inside the window on repositories where `cap.github.actions` was active for the whole
  window, keyed by (run ID, attempt). **Event:** queue duration = created→started, exec duration =
  started→completed for the attempt; an outcome is the recorded conclusion enum, not an
  interpretation of it. **Censoring:** runs still in progress at the window boundary are
  **right-censored at the boundary and disclosed** — never a zero duration, never an implied
  failure. Runs lost to a saturated listing cap were **never observed** and cannot be censored
  subjects (no identity, no start time, no at-risk duration): saturation is **cohort truncation**
  that lowers `completeness` or renders the window ineligible, and it never enters survival-style
  denominators (corrected 2026-08-04 review round). Absence is never zero. Corrections: key by run ID +
  attempt and use attempt-specific job endpoints (default listing is latest execution unless
  `filter=all`); deleted attempts censor. Deletion: C3 at 90 days plus cascade. Dimensions bound:
  `completeness` (`GH_ACTIONS_FILTERED_1000_CAP`, `GH_CHECK_SUITES_1000_CAP` — saturation is
  cohort truncation, per the correction above), `censoring_freedom` (in-progress runs at the
  window boundary), `sample`, `permission`, `drift_stability` (workflow definition change
  mid-window).
- **Confounders / falsifiers / bounds** — Confounders: runner class, cache state, matrix width,
  concurrency groups, provider scheduling, and self-hosted capacity dominate durations. **Wording
  rules, enforced in the copy dictionary and claim statement enums: rerun ≠ flaky
  (`RERUN_NOT_FLAKE`), failure ≠ poor quality, CI duration ≠ efficiency.** Falsifier: a duration
  shift that disappears when stratified by runner class or workflow definition version; a "recovery"
  fixture where the later attempt ran a different workflow definition. Bounds:
  `Σ_r ceil((A_r+overlap)/100)` run pages + `Σ_a ceil(J_a/100)` job pages; filtered run lists cap at
  1,000 — partition by repository and bounded date range and mark saturation.
- **UI / corpus / eval / deps / rollout** — UI: **Evidence Atlas** feedback card; **Change River**
  machine-feedback band; **Pattern Lens** for residual alerts. Corpus: 1,001 runs; cancelled by
  concurrency; delayed start; missing run; rerun attempts; latest-vs-all jobs; >1,000 check suites;
  fork PR; skipped steps; self-hosted coarse class; YAML with aliases, expressions, malicious
  strings, and reusable workflows. Eval gate: zero names/logs/expressions in any sink; attempt-aware
  keys prove idempotent replay; saturation always surfaces. Deps: ADR-15; cards CI-01, CI-02.
  Rollout: bounded capability activation; rollback = revoke, delete run/job observations, aliases,
  features, caches, packs.

## CAT-FBK-02 — Release and deployment studio

- **Q / decision** — *"How big are the batches this system ships, and what happened when they
  landed?"* Supports deciding **whether to change release cadence or batch size**, with the
  censoring horizon stated up front.
- **Sources / fields** — `GH-REL-01` (`B14`: release ID, tag target OID alias, draft/prerelease/
  immutable flags, dates, asset count and bytes), `GH-DEPLOY-01` (`B15`: deployment/status/
  environment IDs, commit OID, state, timestamps, production/transient flags, policy traits),
  CAT-CHG-01 first-parent ancestry (`B24`), CAT-FLW-02 merged-PR facts.
- **Classes / prohibited / posture** — Release **C2** IDs/OIDs → **C1** aggregates; deployment
  observations **C3** (90d). Prohibited: release names, bodies, asset names, uploader, URLs,
  environment/ref names (local alias only), payloads, reviewers. Posture `D` minimal for releases;
  `O+A` for deployments under `cap.github.deployments`.
- **Canonical objects** — Existing `DL.REL.CHANGE_BATCH.v1` — canonical, unchanged. Programme
  deltas: `DL.DEPLOY.OUTCOME_MIX.v1` (P) — deployment state mix per environment alias × window;
  `DL.DEPLOY.RELEASE_LINK_RATIO.v1` (P) — deployments whose commit OID is reachable from a release
  target / eligible deployments; `DL.REL.PRERELEASE_SHARE.v1` (P) — prerelease vs full release
  share, which materially changes how batch numbers should be read.
- **Baseline / modelled** — Deterministic first-parent interval arithmetic and state counting.
  **None justified** — deployment outcome prediction has no legitimate decision here and would sit
  on a 90-day censored record.
- **Gates / corrections / coverage** — Canonical gate: `≥3` valid intervals for batch distributions;
  `null` when targets are non-ancestor or history is censored. **Cohort/eligibility:** releases
  published inside the window whose tag target OID resolves and lies on the first-parent path;
  drafts and non-ancestor targets are excluded **and disclosed**, never silently skipped.
  **Event:** an interval is the first-parent distance between two consecutive eligible release
  targets; a deployment event is its recorded state transition. **Censoring:** the interval opened
  by the last release in the window is **right-censored at the boundary** and never counted as
  completed, and deployment history beyond the provider's 90-day horizon stays censored — an
  absent release or deployment is never zero. **Prohibited interpretations:** batch size and
  release interval are not velocity, throughput, quality, or risk; a longer interval is not a worse
  one. Corrections: retagging and deleted
  releases supersede; a non-ancestor target is a recorded finding, not a silent skip. Deletion:
  deployment C3 at 90 days plus cascade; **provider history older than 90 days remains censored even
  after local deletion, and the disclosure says so**. Dimensions bound: `censoring`
  (`GH_DEPLOY_STATUS_90D_CENSOR` — binding and permanent), `completeness`, `sample`, `permission`.
- **Confounders / falsifiers / bounds** — Confounders: backports, squashes, retags, monorepo
  releases, and continuous deployment without releases all break the batch abstraction; "latest"
  semantics are provider-specific; releases are **not** all tags. Falsifier: a batch count that
  changes when the first-parent path is recomputed after a retag; a deployment linked to a release
  it does not descend from. Bounds: release and deployment pagination at 100/page; ancestry via
  local `merge-base`.
- **UI / corpus / eval / deps / rollout** — UI: **Delivery/Traceability Map** (release lane) and
  **Change River**. Corpus: prerelease; retag; deleted release; non-ancestor target; >90-day
  deployment history; environment rename; permission loss mid-window. Eval gate: the 90-day censor
  renders on every deployment surface; non-ancestor targets never produce a batch number. Deps:
  ADR-15, ADR-11; cards CI-03. Rollout: releases with `github.core`; deployments behind their own
  activation card; rollback = revocation cascade.

## CAT-FBK-03 — Dependency composition and update waves

- **Q / decision** — *"How does dependency change move through my systems — together, or one at a
  time?"* Supports deciding **whether to batch or automate upgrades**, and where a shared contract
  actually binds repositories together.
- **Sources / fields** — `GH-SBOM-01` (`B16`: SPDX SBOM or local manifest parser, processed **in
  memory** — packages, ecosystems, dependency relationships, licences), plus update events observed
  through `github.core` PR/commit facts. `X-RELEASE-01` composes releases with dependency aliases.
- **Classes / prohibited / posture** — Input **C4** (raw SBOM/manifests, names, versions, PURLs,
  paths) destroyed in-process; retained **C3** (90d) aliases and graph; **C1** wave summaries (36m).
  Prohibited: package names, versions, ranges, PURLs, raw SBOM, and any exact name leaving C3.
  Posture `O+E→A` under `cap.github.dependencies` (G3 approved, P9).
- **Canonical objects** — Existing `DL.DEP.UPDATE_WAVE.v1` (pack-scoped alias × ISO week; wave size
  = distinct repos; lift via the co-occurrence formula) — canonical, unchanged. Programme deltas:
  `DL.DEP.ECOSYSTEM_MIX.v1` (P) — share by ecosystem, from controlled vocabulary;
  `DL.DEP.DIRECT_TRANSITIVE_RATIO.v1` (P) — direct / (direct + transitive) buckets;
  `DL.DEP.SBOM_COVERAGE.v1` (P) — ecosystems with a complete SBOM / ecosystems detected
  (`SBOM_ECOSYSTEM_INCOMPLETE` (P)), because SBOM completeness varies sharply by ecosystem.
- **Baseline / modelled** — Deterministic weekly co-occurrence and lift (ADR-09 mechanics).
  **None justified** — a learned "upgrade propagation" model adds nothing a supported lift with an
  alternatives list does not already say honestly.
- **Gates / corrections / coverage** — Canonical gates: `≥5` updates and `≥2` repositories for a
  wave; sparse pairs suppressed (`SPARSE_SUPPRESSED` (P)). Corrections: alias remapping is versioned;
  a renamed package keeps its alias only if the provider identity is stable, otherwise it becomes a
  new alias and the wave is recomputed. Deletion: C3 at 90 days plus cascade including the alias
  graph. Dimensions bound: `completeness`, `sample`, `source_diversity` (SBOM vs manifest parse
  agreement), `permission`.
- **Confounders / falsifiers / bounds** — Confounders: automation (Dependabot/Renovate) creates
  waves that reflect a bot schedule, not coordination; monorepo lockfile churn; same-version intent
  is not guaranteed; report/download URLs expire. Falsifier: a wave that vanishes when automated
  update PRs are stratified out. Bounds: `ceil(D/100)` pages; manifest parse `O(B)` inside the
  worker; feature/plan availability varies.
- **UI / corpus / eval / deps / rollout** — UI: **Change River** (dependency band); waves in
  **Pattern Lens**. Corpus: private-package canaries; malformed SPDX; the same update inside and
  outside a wave; a sparse pair that must be suppressed; a bot-only wave. Eval gate: zero package
  names/versions/PURLs in any sink; sparse suppression proven; ecosystem coverage always shown next
  to the mix. Deps: ADR-15, ADR-09 mechanics; cards DEP-01. Rollout: activation card; rollback =
  delete aliases, observations, graph edges, summaries, packs.

## CAT-FBK-04 — Isolated security-alert lifecycle

- **Q / decision** — *"How long do declared dependency and code-scanning findings stay open here?"*
  Supports deciding **whether the remediation loop is working as a process** — explicitly **not** a
  security posture, score, or exploitability claim.
- **Sources / fields** — `GH-DEPALERT-01` (`B17`: alert ID, state, times, coarse severity/CWE/CVSS/
  EPSS, ecosystem, scope, patched-version-available), `GH-CODESEC-01` (`B18`: alert ID, state, times,
  coarse severity/CWE, tool class, commit alias).
- **Classes / prohibited / posture** — **C3 in a physically isolated store** (90d). Prohibited:
  exact package, version, or range; advisory prose; alert instances, paths, messages, rules,
  locations, dismissal comments; identities. `GH-SECRET-X` (secret scanning, **even aggregate
  counts**) and `GH-ADVISORY-X` (draft/private advisories) are **rejected with no authorization
  path**. Posture `O+A` under `cap.github.security` (G3 approved; **P9's task card must fix the
  isolated schema/storage design first** — matrix requirement).
- **Canonical objects** — `DL.SEC.ALERT_LIFECYCLE_DIST.v1` (P) — distribution of open→resolved
  durations by coarse severity band; `DL.SEC.EXPOSURE_WINDOW_DIST.v1` (P) — time from alert creation
  to a patched version being available, where observable; `DL.SEC.FEATURE_STATE.v1` (P) — the
  enabled/disabled/restricted state itself, so a disabled feature can never read as zero alerts
  (`DEP_ALERT_FEATURE_DISABLED` (P)).
- **Baseline / modelled** — Deterministic lifecycle distributions. **None justified** — every
  modelled variant here trends toward risk scoring, which canonical §4 rejects outright.
- **Gates / corrections / coverage** — **Never silently infer zero from disabled, 403, or 404** —
  the three are distinguished and recorded. Sparse severity bands suppressed.
  **Cohort/eligibility:** alerts created inside the window on repositories where the producing
  feature was enabled for the whole window, with `DL.SEC.FEATURE_STATE.v1` as the eligibility
  witness. **Event:** the provider-recorded open→resolved transition, never a dismissal comment or
  an inferred fix. **Censoring:** alerts still open at the window boundary are **right-censored
  there**, counted and disclosed rather than dropped or resolved-at-zero. Corrections: reopened
  alerts supersede; initial provider processing lags and that lag is coverage, not absence.
  Deletion: restricted observations, aliases, summaries, caches, and packs, all inside the isolated
  store. Dimensions bound: `permission` (hard), `completeness`, `censoring`, `sample`.
- **Confounders / falsifiers / bounds** — Confounders: **tool enablement and coverage dominate alert
  counts** (canonical §4 rejected ledger); deleted analyses erase evidence; default-branch semantics
  limit code-scanning visibility. Falsifier: a lifecycle distribution that changes materially when
  tool enablement history is overlaid. Bounds: endpoint-specific `ceil(D/100)` pagination; the
  isolated store must not be joinable to ordinary analytical tables.
- **UI / corpus / eval / deps / rollout** — UI: a **dedicated isolated panel** reachable from the
  Coverage/Privacy Cockpit — deliberately **not** merged into the Evidence Atlas, so no composite
  "health" reading is possible. Corpus: disabled feature; 403; 404; renamed package alias; reopened
  alert; deleted analysis; non-default-branch instance; a poison location string. Eval gate:
  isolation test (no FK or join path from the ordinary store); zero advisory prose or locations in
  any sink; "alert count as security quality" wording rejected by the copy dictionary. Deps:
  ADR-15, matrix `cap.github.security`; cards SEC-01. Rollout: separate restricted database;
  rollback = drop that database.

## CAT-FBK-05 — Build-provenance and attestation coverage

- **Q / decision** — *"Do the artefacts this system publishes carry verifiable provenance?"*
  Supports deciding **whether to add attestation to a release pipeline** — a coverage question, not
  a trust verdict.
- **Sources / fields** — `GH-ATTEST-01` (`B20`: subject-digest alias, predicate type, builder class,
  bundle verification result performed independently).
- **Classes / prohibited / posture** — **C1** coverage ratios + **C3** digest aliases. Prohibited:
  raw bundle, certificate, signer identity, key material. Posture `O+A`. **Owner gate G-d:** the
  canonical §3 matrix describes `GH-ATTEST-01`, but `source-capability-matrix.md` carries no
  capability row for it — a registry/matrix change is required before any implementation card.
- **Canonical objects** — `DL.PROV.ATTESTATION_COVERAGE.v1` (P) — release artefacts with an
  attestation that **independently verifies** / eligible artefacts, plus separate counts for
  present-but-unverifiable (`ATTESTATION_UNVERIFIABLE` (P)).
- **Baseline / modelled** — Deterministic verification outcome counting. **None justified.**
- **Gates / corrections / coverage** — Eligibility: repository and plan dependent; 100/page cursor.
  **Existence of an attestation is never trust** — verified, unverifiable, and absent are three
  distinct states and are rendered as three. Corrections: re-verification supersedes. Deletion:
  cascade with the owning capability. Dimensions bound: `permission`, `completeness`,
  `source_diversity`.
- **Confounders / falsifiers / bounds** — Confounders: plan availability; a valid attestation for an
  irrelevant subject; builder-class heterogeneity. Falsifier: an existing-but-invalid attestation
  counted as coverage. Bounds: verification cost per artefact; cursor pagination.
- **UI / corpus / eval / deps / rollout** — UI: **Delivery/Traceability Map** release lane badge.
  Corpus: existing-but-invalid attestation; unsupported plan; absent attestation; mismatched
  subject digest. Eval gate: the three states are never collapsed to two. Deps: ADR-15; card
  PROV-01; **blocked by owner gate G-d**. Rollout: not before the registry row exists.

---

# Group 6 — Portfolio

*"What eras, waves, and turning points exist across systems?"*

## CAT-PRT-01 — Repository and portfolio evolution

- **Q / decision** — *"How is my attention distributed across systems, and how did that
  distribution move?"* Supports deciding **which system to pick up next** — as a description of
  distribution, never a ranking of worth.
- **Sources / fields** — `GH-REPO-01` (`B1`: stable ID, visibility, archive/disabled/fork/mirror/
  template flags, timestamps, default branch, parent/source IDs), `GH-LANG-01` (`B1` language
  edges), `GH-RULE-01` (`B21`: enforcement, rule types, required-count flags), `X-PORT-01` composed
  over one homogeneous event family at a time.
- **Classes / prohibited / posture** — **C2** stable IDs and isolated aliases; **C1** flags, times,
  transitions; policy aggregates **C3**. Prohibited: repository names, URLs, descriptions in
  analytical tables (names live only in the isolated identity vault); ruleset patterns, status
  names, bypass actors, integrations; **ranked lists with normative framing — the copy dictionary
  bans "top", "best", "healthiest", "most mature"** (ADR-16). Posture `D`. **Owner gate G-d** for
  `GH-RULE-01` and `GH-TAXONOMY-01`: ADR-16 depends on their aggregates, but the capability matrix
  carries no row for either.
- **Canonical objects** — Existing `DL.PORT.EFFECTIVE_REPOSITORIES.v1` (inverse HHI over **one**
  event family — never a weighted blend of commits, PRs and reviews) and `DL.PORT.TRANSITION_JS.v1`
  (Jensen–Shannon distance between adjacent equal windows) — canonical, unchanged. Programme deltas:
  `DL.PORT.LIFECYCLE_TRANSITION_COUNT.v1` (P) — counts by transition kind {emergence, archive, fork,
  transfer, visibility_boundary}; `DL.PORT.COMPOSITION_JS.v1` (P) — JS distance over composition
  vectors from CAT-STR-01; `DL.PORT.POLICY_TRANSITION_COUNT.v1` (P) — policy/CI-config transitions
  per window; `DL.PORT.ERA_COMPARISON.v1` (P) — portfolio-level era comparison assembled from
  CAT-STR-03 era diffs.
- **Baseline / modelled** — Deterministic distribution measures. **None justified** — every
  candidate "portfolio health" model is a leaderboard in disguise (brief §4 non-goals).
- **Gates / corrections / coverage** — Canonical gates: `≥10` events and `≥2` repositories for
  effective repositories (range `[1,R]`); `≥20` events in **each** window for the JS transition;
  missing repositories receive zero probability **within a window that is otherwise complete**, and
  an incomplete window abstains instead. Corrections: rename and transfer keep the stable provider
  ID canonical; alias history is isolated and expires. Deletion: cascade per capability. Dimensions
  bound: `completeness` (hard — **changed observability mimics transition**), `permission`, `sample`,
  `comparability` (event-family definition must be identical across the pair).
- **Confounders / falsifiers / bounds** — Confounders: a permission change, a token scope change, or
  a newly-private repository each produce a transition signal identical to a real one; forks and
  mirrors double-count; archived repositories keep receiving bot commits. Falsifier: a transition
  that disappears once the coverage series is overlaid (this is the CAT-PRT-02 coverage-shift test
  applied here). Bounds: `ceil(R/100)` discovery pages; distribution maths is negligible.
- **UI / corpus / eval / deps / rollout** — UI: **Era Comparator** (UX-EC) and **Evidence Atlas**
  portfolio card. Corpus: concentrated portfolio; even portfolio; no-data portfolio; rename;
  transfer; fork; archive; private→restricted transition; a permission loss engineered to mimic a
  transition. Eval gate: coverage-overlay test on every transition claim; banned normative copy
  fails the dictionary test. Deps: ADR-16 (needs ADR-07 for eras, ADR-09 for waves); cards
  PORT-01/02/03. Rollout: derived; rollback = hide views.

## CAT-PRT-02 — Pattern, motif, and notable-change lab

- **Q / decision** — *"Did something actually change here, or did my visibility change?"* Supports
  deciding **whether a turning point deserves investigation** — with the coverage alternative always
  on the table.
- **Sources / fields** — No source of its own: consumes C1 feature series from every other entry,
  **plus the matching coverage series** for each (this pairing is the point of the entry).
- **Classes / prohibited / posture** — **C1**. Prohibited: alerts on any person-shaped series (none
  exist), alerts below support gates, and motifs built from identity features. Posture `D` derived.
- **Canonical objects** — `DL.LAB.RESIDUAL_ALERT.v1` (P) — rolling median/MAD residual exceeding a
  preregistered threshold, with a **false-alert budget expressed per year of observation**;
  `DL.LAB.CHANGE_POINT_CANDIDATE.v1` (P, **modelled**) — candidate location and strength with
  interval; `DL.LAB.COVERAGE_SHIFT_FLAG.v1` (P) — the classification
  `coverage_shift_candidate` when a candidate coincides with a coverage, permission, or parser shift
  (`COVERAGE_SHIFT_CANDIDATE` (P)); `DL.LAB.MOTIF_SUPPORT.v1` (P) — n-gram/transition motif counts
  with support.
- **Baseline / modelled** — Three-rung ladder (ADR-17): (1) deterministic transition and frequency
  counts — **complete on their own**; (2) robust baseline residuals (rolling median/MAD) with
  preregistered thresholds and a false-alert budget; (3) **offline change-point research** (PELT,
  Bayesian online detection) gated by ADR-19 — justified because robust residuals over-alert on
  seasonal series, but ≥52 weekly C1 observations and ≥80% complete coverage are entry gates, and
  **seasonal controls (weekly/annual) are part of the baseline, not the model's job to discover**.
  Motif mining beyond counts (suffix-tree) stays WB-C4 research with time-held-out stability.
- **Gates / corrections / coverage** — **Every change-point evaluation runs jointly on the coverage
  series.** A candidate coinciding with a coverage/permission/parser shift is classified
  `coverage_shift_candidate`, **not a system change**, unless the signal survives within
  fully-covered subwindows. Corrections: a re-collected window recomputes candidates and supersedes
  claims. Deletion: candidates cascade from their input features. Dimensions bound: `completeness`
  (≥0.8 floor for modelled candidates), `comparability` (= 1), `calibration` (≠ null), `sample`,
  `drift`.
- **Confounders / falsifiers / bounds** — Confounders: seasonality, holidays, collection outages,
  schema/parser changes, and single large events; multiple testing across many series inflates
  discoveries — controlled by Benjamini–Hochberg across the candidate family (ADR-19). Falsifier: an
  accepted change-point that does not survive restriction to fully-covered subwindows; an alert rate
  exceeding the preregistered per-year budget. Bounds: `O(T)`–`O(T²)` method-dependent; fallback is
  median/MAD or abstention.
- **UI / corpus / eval / deps / rollout** — UI: **Pattern Lens** (UX-PL); accepted change-points feed
  era boundaries in **Architecture Time Machine**. Corpus: injected step change; injected gradual
  drift; a pure coverage outage engineered to look like a change; a seasonal series with no real
  change; a series with a schema version bump mid-window. Eval gate: LAB-02 coverage-shift separation
  fixtures — the coverage-only fixture must **never** produce a system-change claim; measured
  false-alert rate within budget. Deps: ADR-17, ADR-19, ADR-02; cards LAB-01, LAB-02, WB-C1, WB-C4.
  Rollout: rung 1 ships first and alone; rungs 2–3 behind registry promotion; rollback = demote in
  the registry, and claims disappear automatically.

## CAT-PRT-03 — Graph and dynamic-community research

- **Q / decision** — *"What structural shape do these typed graphs have?"* Supports deciding **where
  structural attention is warranted** using only statistics that are meaningful without labels.
- **Sources / fields** — The typed `graph_projection` families produced elsewhere: `module.v1` (P),
  `repository.v1` (P), `dependency.v1` (P), `traceability.v2`, `workflow.v1` (P),
  `temporal_cochange.v1` (P). **Never merged into one universal graph, and never containing people
  nodes — schema-enforced** (ADR-18).
- **Classes / prohibited / posture** — **C3** nodes/edges (90d) → **C1** summary statistics.
  Prohibited: person nodes (schema rejection), semantic labels asserted from structure alone, and
  any centrality presented as importance of a person. Posture `O+A` per owning capability.
- **Canonical objects** — `DL.GRAPH.COMPONENT_STATS.v1` (P) — component count, largest component
  share, SCC statistics per projection; `DL.GRAPH.DENSITY.v1` (P); `DL.GRAPH.CENTRALITY_DIST.v1` (P)
  — simple centrality **distribution** of modules/repositories only, with system framing and sparse
  suppression.
- **Baseline / modelled** — Deterministic SCC/components, degree distributions, density, simple
  centralities. **Modelled: research only.** Community detection (e.g. Leiden) and graph embeddings
  stay WB-C5 behind planted-partition recovery, seed stability, snapshot sensitivity, and sparse
  suppression gates before **any** UI exposure; ≥4 comparable snapshots and ≥20 opaque nodes are
  entry gates (canonical §9). Community labels have **no ground truth** and are never asserted as
  semantic.
- **Gates / corrections / coverage** — Sparse graphs are suppressed rather than rendered. Corrections:
  graph replacement by snapshot. Deletion: C3 expiry plus cascade. Dimensions bound:
  `parser_coverage`, `comparability`, `completeness`, `sample`.
- **Confounders / falsifiers / bounds** — Confounders: parser coverage determines the graph more than
  the system does at low coverage; centrality is highly sensitive to missing edges. Falsifier: a
  planted-partition fixture the method fails to recover; a centrality ordering that inverts when one
  language's parser is enabled. Bounds: `O(V+E)` for baselines; community methods can be
  memory-heavy — fallback is SCC/components.
- **UI / corpus / eval / deps / rollout** — UI: **Architecture Time Machine** structure statistics;
  **Pattern Lens** for research output once promoted. Corpus: planted communities; a graph with 60%
  parser coverage; a disconnected graph; a single-node graph. Eval gate: seeded repeatability;
  schema test proving no person node type exists in any projection. Deps: ADR-18; cards GRAPH-01,
  WB-C5. Rollout: baselines ship; research is registry-gated; rollback = delete projections.

---

# Group 7 — Interpretation

*"Which interpretations survive evidence, and how do I explore it myself?"*

## CAT-INT-01 — ML research workbench, model registry, promotion gates

- **Q / decision** — *"Has any model here earned its place against the deterministic baseline?"*
  Supports deciding **whether to promote, keep, or demote a candidate** — and the product-level
  decision to ship nothing that has not beaten a baseline.
- **Sources / fields** — Frozen **invented** benchmark suites (fixture generators with planted
  effects, versioned and checksummed; the generation parameters **are** the dataset card). No source
  collection.
- **Classes / prohibited / posture** — **C0** benchmark data. Prohibited: person targets of any
  kind; collaborator or identity covariates; training on real data without a separately authorised,
  consented, carded dataset (**owner gate G-c**); reusing a consumed final holdout. Posture `E`
  offline (`server/research/*` or notebooks, P11).
- **Canonical objects** — `model_registry` rows (method ID/version, card links, gate evidence,
  promotion state) and `statistical_output`/`model_output` tables (canonical §6). Feature
  `DL.WB.PROMOTION_STATE.v1` (P) — the registry state itself, resolved by every UI claim so **a
  demoted model's claims disappear automatically** (`MODEL_DEMOTED` (P)).
- **Baseline / modelled** — The workbench **is** the baseline discipline: preregistration (primary
  metric, minimum practically-meaningful improvement, feature-availability time, split policy —
  rolling-origin / nested time-aware — and the final holdout fixed **before tuning**), false-discovery
  control across the candidate family (Benjamini–Hochberg), dataset cards, model cards, and the
  promotion ladder `seeded → benchmarked(invented) → validated(consented,real) → shipped`. **Invented
  fixtures can never carry a candidate past `benchmarked`.** Candidate register, all `seeded`, none
  implementation-ready: C1 change-points, C2 change-intent classifier, C3 CI-family classifier
  (metadata-only; **reject if baseline unbeaten**), C4 motifs, C5 communities/embeddings, C6
  time-to-event, C7 probabilistic observability, C8 architecture-change classifier, C9 aggregate
  retrieval ranking.
- **Gates / corrections / coverage** — Every shipped model keeps the canonical §9 eight conditions
  (beats a deterministic baseline on a preregistered offline gate; time- and repository-held-out
  evaluation; calibration and uncertainty; coverage/schema drift detection; explains inputs without
  source prose; abstains below coverage/sample gates; falls back to the deterministic product; no
  person targets). A failed gate **consumes the holdout** — no reuse. Corrections: a demotion is a
  registry transition plus a lineage event; dependent claims vanish. Deletion: model outputs are
  descendants and cascade. Dimensions bound: `calibration`, `drift`, `sample`, `completeness`.
- **Confounders / falsifiers / bounds** — Confounders: planted-effect benchmarks are easier than
  reality, which is exactly why `benchmarked ≠ validated`; leakage through feature-availability time;
  multiple comparisons across nine candidate families. Falsifier: a candidate that beats the baseline
  on invented data and fails on the consented set — the ladder is designed to make this visible, not
  embarrassing. Bounds: offline compute only; no model runs inside a collection path.
- **UI / corpus / eval / deps / rollout** — UI: registry state surfaces as **layer badges** wherever a
  modelled claim renders; there is no "model dashboard" competing with evidence. Corpus: the frozen
  benchmark suites themselves, plus a deliberately-leaky split used as a negative control. Eval gate:
  WB-01 harness + WB-02 registry mechanics; a candidate cannot render in the UI without a registry
  row in `shipped`. Deps: ADR-19; cards WB-01, WB-02, WB-C1…C9. Rollout: research only in this
  programme; rollback = demote, which is a data change, not a code change.

## CAT-INT-02 — Local evidence retrieval and RAG

- **Q / decision** — *"Which evidence is relevant to this question — including the evidence that
  argues against it?"* Supports the composer's decision about **what to put in front of the user**,
  and the product decision of **whether vectors are justified at all**.
- **Sources / fields** — Explicitly selected **C1 analysis-pack facts** only (CAT-INT-04), plus the
  feature registry's claim-family → feature/coverage/limitation mapping. No repository bytes, no
  prose.
- **Classes / prohibited / posture** — **C1 only**, and an index **inherits the highest input class
  and is never anonymisation**. Prohibited: hosted files, vector stores, external embeddings, web
  search, browsing, repository access, tools, agentic actions — **ever, under current authority**
  (ADR-20, charter G4 boundary). Posture `E` process-local; **any durable index is a separately
  reviewed sink — owner gate G-b**.
- **Canonical objects** — `DL.RAG.CITATION_VALIDITY.v1` (P) — returned IDs that resolve / returned
  IDs (must be 1.0); `DL.RAG.COUNTER_EVIDENCE_RECALL.v1` (P) — contradicting/limitation evidence
  returned (canonical definition: `04_LOCAL_RAG_DESIGN.md` §5.2 #5 — pre-quota top-k over the
  planted falsifier set; never restated here), the metric that makes cherry-picking measurable; `INDEX_STALE` (P) as its
  limitation code.
- **Baseline / modelled** — Three-step ladder, each step must **beat the previous on the retrieval
  benchmark before adoption** (ADR-20): (1) **deterministic structured retrieval — the planned
  deterministic default/baseline** (planning artifact: nothing here is shipped): SQL filtering over
  typed facts + registry mapping, with standardized-distance ranking (z-scored numeric features)
  for "similar windows/systems", and a **mandate** that every result set
  deliberately includes supporting, contradicting, coverage, and limitation evidence by quota;
  (2) **controlled-template lexical index (research)**: BM25 over rendered controlled templates
  (statement codes + registered enums only, **no prose**) — evaluated only if (1) measurably fails
  recall; (3) **vector index (research, likely-reject)**: local, pinned, offline embedding over the
  same controlled templates only; task-scoped, process-local, non-exportable,
  non-cross-pack-linkable, deleted on revocation. Adopted only if it beats (1) and (2) on
  Recall@k/nDCG **and** counter-evidence recall with acceptable reconstruction and
  membership-inference canary results.
- **Gates / corrections / coverage** — Strict field registry applies **before** templating or
  embedding. Corrections: a superseded claim must fall out of the index; a stale index is disclosed,
  not silently served. Deletion: **index rebuilt-empty after revocation is a proof obligation**, not
  a best effort. Dimensions bound: `completeness` (of the pack), `freshness` (index staleness),
  `calibration` (ranking quality), `sample`.
- **Confounders / falsifiers / bounds** — Confounders: a benchmark written by the same author as the
  retriever flatters it; controlled templates are low-entropy, so lexical and vector methods may look
  similar for uninteresting reasons. Falsifier: (1) failing recall on the benchmark would justify (2);
  a vector index that fails to beat (1) on counter-evidence recall **kills the vector step** — "vectors
  are not justified" is a measurable success here, not an ideology. Bounds: evaluation battery =
  Recall@k, nDCG/MRR, citation validity, counter-evidence recall, unsupported-claim rate downstream,
  deletion proof, stale-index behaviour, prohibited-field canaries, membership-inference and
  uniqueness-leakage probes.
- **UI / corpus / eval / deps / rollout** — UI: retrieval is invisible; its **effects** appear as the
  evidence list in the **Evidence Drawer** and hypothesis cards. Corpus: fact sets where the
  contradicting evidence is rare and easily missed; a revoked capability mid-session; a stale index; a
  prohibited-field canary in a template slot. Eval gate: RAG-02 benchmark + canaries; counter-evidence
  quotas enforced structurally, not by convention. Deps: ADR-20 (feeds ADR-21; sourced from ADR-22);
  cards RAG-01, RAG-02, WB-C9. Rollout: step (1) only; steps (2)/(3) research; rollback = SQL
  filtering, which is the default anyway.

## CAT-INT-03 — Hypothesis and counter-hypothesis composer

- **Q / decision** — *"What is a defensible interpretation of this evidence, what argues against it,
  and what would change my mind?"* Supports deciding **which interpretation to carry forward** — with
  its falsifier attached.
- **Sources / fields** — CAT-INT-02 retrieval output over C1 pack facts; the closed per-family
  alternative enum; the family's **falsifier registry**; ADR-02 coverage vectors.
- **Classes / prohibited / posture** — **C1 in, C1 out**. The optional external step is **exactly**
  the approved G4 boundary: OpenAI `gpt-5.6-luna`, one synchronous standard-tier Responses request,
  `store: false`, `Llm__OpenAi__ApiKey` read at call time, ≤16,000 input UTF-8 bytes, ≤2,000 output
  tokens, ≤USD 0.01, no retry, no tools, no cache, no telemetry. `cap.external.model` remains
  `never_authorized`; **nothing beyond that boundary is proposed as if authorised**. Prohibited:
  source prose, names, repository IDs or aliases, URLs, titles, labels, paths, bodies, comments,
  dependency or security details, and all C2/C3/C4/X. Posture `O`, default-off.
- **Canonical objects** — `hypothesis_output` (canonical §6) and the `ModelClaim` contract
  (canonical §10). Features `DL.HYP.ABSTENTION_RATIO.v1` (P) — abstentions / compositions attempted;
  `DL.HYP.FALSIFIER_PRESENCE.v1` (P) — hypothesis claims carrying at least one falsifying question /
  hypothesis claims (**must be 1.0**; brief §5 question yield).
- **Baseline / modelled** — **Deterministic-first**: template-driven claim assembly (statement code +
  evidence slots filled by retrieval with its counter-evidence quotas), alternatives from the closed
  enum, confidence **bands** derived from the coverage vector (never a scalar score), abstention when
  gates fail, and a mandatory "what evidence would change this?" generated from the falsifier
  registry. The model step, if ever activated, **only re-ranks or re-words within the closed enums**:
  it cannot add evidence IDs (schema-rejected) or new statement codes. A future local model must be
  pinned, licensed, offline, and non-executing-remote-code.
- **Gates / corrections / coverage** — Composition is refused when the family's minimum vector
  requirements fail — the output is an **abstention claim with a reason code**, which is a first-class
  result, not an error. Corrections: superseded evidence supersedes the hypothesis via lineage.
  Deletion: hypotheses cascade from their evidence; initial model output is process-only. Dimensions
  bound: **all**, via the family's declared floors.
- **Confounders / falsifiers / bounds** — Confounders: templates can smuggle causal implication
  through phrasing — hence the closed statement enum and the copy dictionary; a fluent hypothesis is
  more persuasive than a true one. **Typed evidence is treated as untrusted data**; repository prose
  never enters a bundle; prompt-injection canaries are required. Falsifier: any rendered hypothesis
  without a falsifying question; any evidence ID in the output that was absent from the request.
  Bounds: the G4 ceilings above; provider retention disclosure (abuse logs up to 30 days,
  encrypted prompt-cache state up to 24 hours; `store: false` is **not** a Zero Data Retention claim)
  and revalidation of model/pricing terms before every runtime task.
- **UI / corpus / eval / deps / rollout** — UI: hypothesis cards in **Pattern Lens**, **Era
  Comparator**, and **System Story**; each ends on its falsifying question; **Evidence Drawer**
  resolves every citation. Corpus: an evidence set with strong contradiction; a set below gates
  (must abstain); an injection-shaped controlled template; a response containing an unknown evidence
  ID (must reject the whole response). Eval gate: HYP-01/HYP-02 plus the existing P12 activation
  gate; deterministic mode alone must still populate every hypothesis surface with abstentions and
  questions. Deps: ADR-21 (needs ADR-20, ADR-02, ADR-01); cards HYP-01, HYP-02, P12 lane. Rollout:
  deterministic composer ships; external step stays default-off behind its own activation card;
  rollback = disable the external step with zero effect on deterministic content.

## CAT-INT-04 — Analysis Pack 2.0 and Query Lab

- **Q / decision** — *"Can I check this myself, with my own tools?"* Supports the decision to **trust
  the product by verifying it** — and to keep evidence usable in later sessions, notebooks, and
  statistics tools.
- **Sources / fields** — The canonical store, projected through the audited `ExportView`. Target
  layout is canonical **Appendix D** (facts, features, graphs, insights/claims, coverage,
  data-quality, dictionary, example SQL, notebook plan).
- **Classes / prohibited / posture** — **C1** ceiling per table, declared in the manifest
  (`classification_ceiling`). Prohibited from packs: identity vault, raw platform IDs, raw OIDs,
  private paths, operational cursors, consent secrets, C4/X. **Pack-scoped aliases** are minted at
  build so packs are not straightforwardly linkable to each other. Posture: explicit export with
  preview and acknowledgement.
- **Canonical objects** — Manifest (canonical §11) plus programme deltas:
  `DL.PACK.TABLE_INTEGRITY.v1` (P) — tables whose checksum verifies / tables declared (must be 1.0
  before `COMPLETE` is written); `DL.PACK.SUPPRESSION_COUNT.v1` (P) — rows suppressed by sparsity at
  build, surfaced in the preview so suppression is visible rather than silent. New table families
  land **with their producing capability**, never speculatively.
- **Baseline / modelled** — Deterministic build. **Query Lab runs over the pack, not the canonical
  store**: the local UI opens a user-selected completed pack directory via **DuckDB-WASM entirely
  in-browser** — no new API endpoint, no server SQL surface — offering example queries from the
  pack's own `queries/` and a read-only schema browser. This honours the charter's prohibition on a
  generic SQL/table endpoint while making evidence explorable in-product. **None justified** for any
  model here.
- **Gates / corrections / coverage** — Preview returns schema, fields, row counts, byte estimate,
  classifications, suppression decisions, and checksums **before** acknowledgement; changing
  redaction options invalidates acknowledgement and prior checksums. `COMPLETE` is written last and
  atomically renamed; `pack_schema_version` gates readers; a pack failing checksum or `COMPLETE`
  **refuses to open**. Deletion: application-controlled packs are enumerated in the schema registry
  and deleted by the ADR-03 cascade. Dimensions bound: `completeness` (the pack carries its own
  coverage table), `permission`, `censoring`.
- **Confounders / falsifiers / bounds** — Confounders: a pack is a snapshot and ages; suppression
  changes distributions in ways a naive query will not notice — hence the suppression count and the
  dictionary shipping inside the pack. Falsifier: a pack whose replay does not reproduce identical
  table checksums; a canary surviving into any pack file. Bounds: pack bytes = exact sum of generated
  files; build from a consistent read snapshot into a sibling temporary directory. **Revisit:** if
  DuckDB-WASM bundle cost is unacceptable, Query Lab degrades to copyable SQL plus external-tool
  instructions — **still no server SQL endpoint**.
- **UI / corpus / eval / deps / rollout** — UI: **Query Lab** (UX-QL) and the export preview flow.
  Corpus: a pack with a deliberately corrupted checksum; a pack missing `COMPLETE`; a pack with a
  suppressed sparse table; an unknown `pack_schema_version`; canary rows in every table family. Eval
  gate: manifest/schema/checksum/COMPLETE validation, pack-scoped ID uniqueness, sparse suppression,
  acknowledgement invalidation, and the DuckDB example queries replaying. Deps: ADR-22 (feeds ADR-20);
  cards PACK-01…05, QL-01, QL-02. Rollout: incremental table families; rollback = delete the pack
  (packs are disposable by design).

---

# Group 8 — Experience

*"How do I live inside this evidence, and what should we ask next?"*

## CAT-EXP-01 — System Atlas UX and storytelling

- **Q / decision** — *"Where am I, what does this view claim, and how do I get to the evidence?"*
  Supports every other decision by making the evidence layer legible at a glance.
- **Sources / fields** — `PresentationView` only (charter sink contract). The UI **never** receives
  canonical or source records.
- **Classes / prohibited / posture** — **C0/C1** plus explicitly permitted local C2. Prohibited:
  canonical records, identity-bearing dimensions, sparse values, **and interaction telemetry of any
  kind** (assumption **A2**, canonical §15: no telemetry is required; reversible only by an
  independently consented aggregate-only design). Posture: presentation.
- **Canonical objects** — Information architecture (ADR-23): **Evidence Atlas** (home: system
  overview + coverage), **Architecture Time Machine**, **Change River**, **Delivery/Traceability
  Map**, **Pattern Lens**, **Era Comparator**, **Evidence Drawer**, **Coverage/Privacy Cockpit**,
  **Query Lab**, and a guided **System Story** (the Wrapped successor, narrating one era of one
  system). One visual grammar: layer badges and styling tokens for the seven statuses —
  fact / derivation / model / hypothesis / contradiction / limitation / question.
- **Baseline / modelled** — Deterministic view models. **None justified** — no personalised ordering,
  no learned salience; salience comes from coverage and contradiction, which are data.
- **Gates / corrections / coverage** — **Every number is clickable to its claim; every hypothesis card
  ends with its falsifying question; suppressed or missing data renders as explicit coverage
  furniture, never blank.** Corrections: a superseded claim re-renders as a correction, visibly.
  Deletion: revoking a capability empties its panels into coverage furniture, not into zeros.
  Dimensions bound: whichever bind the underlying claim — the grammar's job is to show them.
- **Confounders / falsifiers / bounds** — Confounder: a beautiful chart is persuasive independent of
  its evidence — the layer badge exists to fight exactly that. Falsifier: **any primary panel that
  goes blank with modelled and hypothesis layers disabled** (brief §5 deterministic completeness);
  any number that cannot be clicked through to a claim. Bounds: desktop and mobile wireframes are
  specified in `05_UX_STORYBOARD.md`; **no React/CSS implementation in this planning session**.
- **UI / corpus / eval / deps / rollout** — UI: itself. Corpus: the synthetic importer's C0 dataset
  rendered through every view, including a fully-degraded-coverage variant. Eval gate: one UX
  acceptance card per view; zero empty primary panels on the synthetic corpus with modelled layers
  off. Deps: ADR-23 (adoption follows the ADR-04 bridge order); cards UX-VG, UX-CC, UX-ED, UX-TM,
  UX-CR, UX-DM, UX-PL, UX-EC, UX-QL, UX-SS. Rollout: view-by-view; rollback = the `legacy-read-only`
  flag pins the app to V1 rendering.

## CAT-EXP-02 — Open Questions and Opportunity Observatory

- **Q / decision** — *"What should I ask next, and what is the cheapest way to find out?"* Supports
  deciding **which single next collection, consent, or analysis action buys the most understanding**.
- **Sources / fields** — Internal: coverage gaps (CAT-SPN-02), contradiction edges (CAT-SPN-01),
  untested alternatives from the closed alternative enums, and falsifier registries (CAT-INT-03).
- **Classes / prohibited / posture** — **C1**. Prohibited: questions whose resolving action lies
  outside current authority being presented as available — an ungated action renders as an **owner
  gate**, not a button. Posture `D` derived.
- **Canonical objects** — A `question` claim family (ADR-24): kind ∈ {evidence_gap, contradiction,
  untested_alternative, future_source, calibration_check}; the claims/coverage rows that spawned it;
  the **cheapest resolving evidence** from a registered enum of collection/consent/analysis actions
  with a cost class; status ∈ {open, answered(link), obsolete}. Features
  `DL.OPEN.QUESTION_YIELD.v1` (P) — questions generated per hypothesis surface (**≥1**, brief §5);
  `DL.OPEN.RESOLUTION_COST_CLASS.v1` (P) — distribution of open questions by cost class.
- **Baseline / modelled** — Deterministic generators from coverage and contradiction data, plus a
  **"surprise me"** exploration that samples under-visited evidence regions via a coverage-weighted
  random walk over the claim graph with a **deterministic seed, so it is reproducible**. **None
  justified** beyond that — a learned "interestingness" model would reintroduce opaque salience.
- **Gates / corrections / coverage** — A question is generated only from a real coverage gap,
  contradiction, or untested alternative — **never filler** (brief §5). Corrections: a question
  becomes `answered(link)` when its resolving evidence lands, or `obsolete` when its basis is
  deleted. Deletion: questions cascade from their spawning claims. Dimensions bound: whichever
  dimension produced the gap.
- **Confounders / falsifiers / bounds** — Confounder: cheap questions crowd out important ones if
  cost class is the only ordering — so the view filters by kind as well as cost. Falsifier: an Open
  Questions surface populated with generic filler rather than data-derived items; a "surprise me"
  walk that is not reproducible from its seed. Bounds: walk length bounded; questions are data, so
  **packs export them and the System Story can end on one**.
- **UI / corpus / eval / deps / rollout** — UI: **Open Questions Observatory** (a first-class
  destination, not a footnote) plus the closing beat of **System Story**. Corpus: a corpus with a
  planted contradiction; a corpus with an untested alternative; a corpus where every question is
  answered (the surface must say so honestly, not invent one). Eval gate: question yield ≥1 per
  hypothesis surface; seed reproducibility. Deps: ADR-24 (needs ADR-01, ADR-02, ADR-21); cards
  OPEN-01, OPEN-02. Rollout: ships with the first hypothesis surface; rollback = hide the view,
  questions remain as data.

## CAT-EXP-03 — P5 migration bridge (V1 → V2)

- **Q / decision** — *"Can I move to the new evidence model without losing the working product — or
  quietly carrying the old person-shaped analytics across?"* Supports the decision to **migrate view
  by view**, with a rollback at every step.
- **Sources / fields** — One **invented** V1 dataset with a golden mapping; the V1 whole-file JSON
  shape (read-only); the synthetic importer's output as the first data behind `/api/v2/*`.
- **Classes / prohibited / posture** — **C0 fixtures only** during the bridge. Prohibited: reading
  real private V1 JSON (the separately-gated real migration protocol under G2 governs that, with one
  timestamped backup, atomic idempotent import, integrity/replay/rollback validation, and a seven-day
  grace period); importing V1 DNA/archetype/streak output as canonical features; computing the V1
  scalar from V2 data. Posture: local, no collection.
- **Canonical objects** — `DL.BRIDGE.PARITY_DELTA.v1` (P) — safe-aggregate differences (counts,
  windows, coverage mapping) between the V1 golden dataset and its V2 import;
  `PARITY_UNREPRODUCIBLE` (P) for V1 aggregates that cannot be reproduced from V2 facts (e.g.
  search-enriched counts) — **recorded as a coverage limitation, never patched with V1 data**.
- **Baseline / modelled** — Deterministic import and comparison. **None justified.**
- **Gates / corrections / coverage** — Order (ADR-04): (1) freeze V1 as a read-only compatibility
  surface with a `legacy-read-only` pin; (2) mount `/api/v2/*` served from the P2 store, first data
  from the synthetic importer; (3) parity fixtures — **person-shaped V1 outputs (DNA, archetypes,
  streaks) are deliberately absent from parity: their retirement is the specified behaviour, asserted
  by a test that the V2 API exposes no such fields**; (4) view-by-view adoption, each behind its UX
  acceptance card, then a deprecation banner, then a separate removal card; (5) scalar confidence
  renders only in legacy views; (6) deprecation order: DNA/archetype/persona → scalar confidence →
  legacy insight stack → legacy exporters (ShareStudio moves to `ExportView`-fed builders) → legacy
  collector **last**, and only after the G2 real-migration protocol has run. Dimensions bound:
  `completeness`, `comparability` (V1 and V2 coverage models are not the same model).
- **Confounders / falsifiers / bounds** — Confounder: parity pressure tempts reproducing V1 numbers
  that were never sound; the retirement list exists to resist that. Falsifier: a V2 API response
  containing any person-shaped field; a parity gap silently filled from V1. Bounds: fixtures only —
  the bridge runs entirely on invented data until the separately-gated real migration.
- **UI / corpus / eval / deps / rollout** — UI: the programme's **smallest user-visible vertical
  slice and first implementation card** — Coverage Cockpit + PR-integration-shape panel rendered from
  `/api/v2/coverage` and `/api/v2/features` over synthetic-importer data, with the Evidence Drawer
  resolving **one claim end-to-end**. This exercises spine, storage, API, and UX in one bounded slice.
  Corpus: the invented V1 dataset plus its golden mapping; a V1 record containing DNA/archetype fields
  that must not survive. Eval gate: parity on safe aggregates; a structural test that the V2 API
  exposes no person-shaped field; `legacy-read-only` proven to pin the whole app. Deps: ADR-04 (needs
  ADR-01/02/03); cards BRIDGE-01…05, UX-CC, UX-ED. Rollout: strangler; rollback = the
  `legacy-read-only` flag, plus each view card's own revert.

---

# Rejected metrics reaffirmed

This programme **adds no exception** to the canonical rejected-metric ledger
(`DEVELOPER_LENS_V2_ARCHITECTURE.md` §4, *Rejected metric ledger*) or the rejected-capability
registry (`source-capability-matrix.md`, *Rejected capabilities*). Both remain authoritative and are
not restated here. The programme's only additions are the restatement of *why they stay rejected
under the new surfaces this catalog introduces*:

| Canonical rejection | New surface that could have reintroduced it | Why it still does not |
|---|---|---|
| Commits/day, PRs/day, reviews/day as performance | CAT-FLW-04 cadence traces | ISO-week grain floor, support gates, system-scope subject, descriptive copy rule |
| Streaks, weekend share, hour-of-day, lulls | CAT-FLW-04, CAT-PRT-02 change-points | ADR-14 schema rejection of event calendars, session boundaries, pause/return detection, hour/day profiles |
| DNA, personality, archetype labels | CAT-EXP-01 System Story, CAT-INT-03 hypotheses | ADR-04 retires them explicitly; V2 API structurally exposes no such field; statement enums are closed |
| PRs per active day, velocity score | CAT-FLW-02 observatory | No author dimension exists in the schema; all latencies are queue properties |
| Reviewer response ranking, per-person latency | CAT-FLW-02, CAT-FLW-03 | `GH-PEOPLE-X` has no authorization path; the PR fact family has no reviewer column |
| Bus factor by named or pseudonymous people | CAT-FLW-03 ownership, CAT-PRT-03 centrality | Ownership is *declared-rule coverage* only; centrality is of modules/repositories only; size-one bands suppressed |
| LOC/change size as quality, risk, impact, effort | CAT-FLW-02 change surface, CAT-CHG-02 radius | Rendered as distributions with confounder copy; `DL.SYS.CHANGE_CI_ASSOC.v1` forbids a combined causal scalar |
| CI duration as quality or efficiency | CAT-FBK-01 studio | Copy dictionary and claim statement enums reject the framing; stratification by workflow is mandatory |
| Rerun = flaky test | CAT-FBK-01 attempt depth | `RERUN_NOT_FLAKE` limitation code on every rerun surface; recovery ≠ flakiness |
| Vulnerability/alert count as security quality | CAT-FBK-04 lifecycle | Isolated store, no join path, `DL.SEC.FEATURE_STATE.v1` prevents disabled-reads-as-zero |
| Sentiment or tone from reviews/issues | ADR-10 Tier-2 temptation | Tier-2 prose is **owner gate G-a**; no card depends on it; sentiment stays categorically rejected regardless |
| Individual output/performance forecasting | CAT-INT-01 workbench | Candidate register contains no person target; the eight shipping conditions include "no person targets" |

**Proxy/composition standing rule (ADR-14, programme-wide).** For each feature *and each plausible
combination of features*, the card asks: *could this reasonably reconstruct attendance, schedule,
effort, diligence, or individual behaviour?* If yes → coarsen (grain, aggregation), suppress (sample
gates), or reject — and record the decision in the card. The single-maintainer synthetic repository
is the standing adversary for this review, because that is the case where system metrics and personal
metrics converge.

---

# Cross-cutting notes for the coordinator

**Coverage-dimension binding summary (ADR-02).** Every entry names its binding dimensions above;
across the catalog the load-bearing ones are: `parser_coverage` (Structure group — CAT-STR-01/02/03,
CAT-CHG-02), `comparability` (CAT-STR-03 hard floor, CAT-PRT-01), `censoring` (CAT-FLW-01/02,
CAT-FBK-02 permanently via `GH_DEPLOY_STATUS_90D_CENSOR`), `sample` (CAT-FLW-04 hard floor — the
re-identification-critical domain), `calibration` (CAT-FLW-01 suggested edges, CAT-PRT-02 candidates,
CAT-INT-02 ranking), `permission` (every opt-in capability), `completeness` (universal).

**Where "none justified" was recorded** — 14 of 28 entries ship deterministic-only with no
statistical or ML method proposed: CAT-SPN-01, CAT-SPN-03, CAT-STR-01, CAT-CHG-02, CAT-FLW-03,
CAT-FLW-04, CAT-FBK-02, CAT-FBK-03, CAT-FBK-04, CAT-FBK-05, CAT-PRT-01, CAT-INT-04, CAT-EXP-01,
CAT-EXP-02, CAT-EXP-03. Modelled methods are proposed in only five places, each with a named reason
the deterministic baseline is insufficient: module continuity (CAT-STR-03), revert/backport
candidacy (CAT-CHG-01), suggested traceability associations (CAT-FLW-01), change-point candidates
(CAT-PRT-02), and time-to-event for censored PR tails (CAT-FLW-02, research). All five are removable
without weakening the deterministic experience.

**Dependency spine.** Unchanged from `01_REFERENCE_ARCHITECTURE.md` *Cross-cutting dependency
spine*; the catalog IDs map onto it as SPINE → CAT-SPN-01/02/03 · BRIDGE → CAT-EXP-03 · GIT →
CAT-CHG-01 · XRAY/ATLAS → CAT-STR-01/02 · TIME → CAT-STR-03 · COUP → CAT-CHG-02 · TRACE/OBSV →
CAT-FLW-01/02 · LAB/WB → CAT-PRT-02, CAT-INT-01 · RAG/HYP → CAT-INT-02/03 · PACK → CAT-INT-04. No
high-sensitivity connector, parser, ML feature, RAG index, or model narrative schedules before its
contracts, deletion path, coverage semantics, benchmark, and UI claim grammar exist
(`BLOCKED_BY_DEPENDENCY` on the cards).
