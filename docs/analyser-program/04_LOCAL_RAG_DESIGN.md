# Local Retrieval and RAG Design — elaboration of ADR-20

Status: **Proposal (planning artifact)** · Session: 2026-08-04 planning-and-seeding
Authority note: this file is a **non-authoritative working proposal**. Stable contracts live only in
`../DEVELOPER_LENS_V2_ARCHITECTURE.md`, `../data-charter.md`, and `../source-capability-matrix.md`.
Where this file disagrees with those, those win. It elaborates **ADR-20** and never contradicts it;
it also depends on ADR-01 (claim graph), ADR-02 (coverage vector / monotone abstention),
ADR-03 (lifecycle + revocation cascade), ADR-19 (research governance), ADR-21 (composer),
ADR-22 (Analysis Pack 2.0).

**Implementation status and critical-path position (2026-08-04 reconciliation).** *Nothing in this
document is implemented.* Structured retrieval (§1 L1) and every rung above it are **optional
interpretation**, scheduled in the **M7 interpretation** wave (`DL-RAG-01` → `DL-RAG-02` →
`DL-HYP-01`, all `BLOCKED_BY_DEPENDENCY`) **V** (07 card index), and they sit **off the
deterministic product's critical path**: the deterministic analysis product — Atlas, Time Machine,
Change River, Delivery Map, Coverage Cockpit, Query Lab, and the ADR-21 deterministic-first composer
— must remain **complete and useful with this entire design unimplemented**. That is a design
constraint, not a consolation: §10's rollback is the proof obligation, and any change here that
makes deterministic value depend on retrieval is a defect in *this* document. (07 routes its
user-visible-value critical path through `DL-RAG-01`; that sequences the *interpretation* surface
and is not a dependency of the deterministic product.) The only retrieval code that exists today is
a strictly narrower injected-C1-bundle helper, described under L1 below.

Labels: **V** verified repository fact · **D** documented platform fact · **R** recommendation ·
**I** inference · **A** assumption (with reversal path) · **REJ** rejected · **G** owner gate.

---

## 0. Scope, subject, and what retrieval is not

- **Subject.** Retrieval selects *evidence about a software system*. There is no person dimension in
  any retrieval input, index key, ranking feature, quota, or output. Person-shaped selection is
  schema-impossible because no source table carries a person dimension (`GH-PEOPLE-X`,
  `PERSON-METRIC-X` remain rejected). **V** (matrix, rejected-capability table.)
- **Retrieval creates no evidence.** It is a *selection function over already-stored evidence IDs*.
  A retrieved row keeps the layer it already had (`observed | deterministic | modelled |
  hypothesis`). Retrieval never promotes a layer, never mints an evidence ID, never writes a fact.
  **R**
- **Ranking score is not confidence.** The ordering scalar is an internal device. It is never
  rendered, never exported, never stored on a claim, and never mapped to a confidence band
  (bands come only from the ADR-02 coverage vector). This is the ADR-20-level restatement of
  principle 7's "no single persuasive confidence scalar". **R**
- **A retrieval miss is not absence.** Failing to retrieve contradicting evidence is a *limitation*
  on the downstream claim, never a finding that no contradicting evidence exists (§4). **R**
- **Not in scope:** code search, prose search, semantic search over repository content, any query
  path over the canonical operational store, any network call. **REJ**

### Source of truth for retrieval

Retrieval reads **completed Analysis Packs only** (ADR-22 / Appendix D layout), never the canonical
SQLite store. **R**, consistent with the charter ("retrieval occurs locally over explicitly selected
C1 analysis-pack facts") **D-charter** and with ADR-22's rule that the pack is the already-redacted,
already-suppressed, already-pack-aliased surface.

**I** Reading the pack rather than the canonical store gives three properties for free: pack-scoped
aliasing (no cross-pack linkage), build-time sparse suppression, and an immutable `COMPLETE` +
checksum boundary that makes "what was indexed" auditable. Indexing the canonical store would
re-open all three questions and is therefore **REJ** for this design; changing it is an owner gate
(§8, G-RAG-4).

Admissible pack tables: `tables/coverage.parquet`, `tables/quality/data_quality_findings.parquet`,
`tables/features/feature_values.parquet`, `tables/facts/*.parquet`,
`tables/insights/deterministic.parquet`, and — when present — claim/limitation/question tables added
by ADR-01/ADR-24 to the pack. Exact graph node/edge tables are **not present in ordinary packs at
all** (ADR-22 as reconciled 2026-08-04: packs carry banded C1 structural summaries only; exact
topology/edge lists never leave C3), so they cannot enter any retrieval index or result set.

### One immutable snapshot, opened once (no verify-then-reopen)

Verification and reading must target **the same bytes**. The reader therefore:

1. resolves the user-selected pack path **exactly once**;
2. materialises **one immutable, task-owned byte snapshot** of the pack — either by opening durable
   handles to every pack file up front and holding them for the task's lifetime, or, wherever the
   platform cannot guarantee handle-stable reads (Windows rename/replace semantics, network or
   removable volumes, any writer holding delete/rename rights on the directory), by **copying** the
   pack into a task-owned location the writer cannot reach;
3. verifies the `COMPLETE` marker, `pack_schema_version` bounds, `build_id`, and `checksums.sha256`
   **on that snapshot**, through the same handles or copy that later reads use;
4. performs **every** subsequent read — manifest, DuckDB attach, every Parquet scan, every re-read —
   from that same snapshot handle/copy, with **no path re-resolution after verification**;
5. re-asserts the checksums on the same snapshot at task end. A mismatch means the snapshot was not
   immutable after all: the task's results are **discarded**, not reported. **R**

**I** The property this buys is that verification is a statement about the bytes actually consumed.
The flow this replaces — verify `checksums.sha256`, then hand the *paths* to DuckDB — is a TOCTOU
hole: a concurrent or hostile writer replaces file contents between the checksum pass and the scan,
and the design is then attesting to bytes nobody read. It is not a race an attacker must win
reliably; one success is enough, and the pack directory is user-selected, so the attacker may own
it. "Checked, then re-opened by name" is not a mitigation, and §7's hostile-pack row is written
accordingly.

---

## 1. The retrieval ladder

Three steps. Each is a strict superset of evidence-access rights of nothing — they all read the same
admissible pack rows. What changes is the *matching mechanism*. A step is adopted only if it beats
the step below it on the §5 battery under ADR-19 preregistration.

### L1 — Deterministic structured retrieval (planned default/baseline, **not yet implemented**)

**Status.** **Planned deterministic default/baseline — `DL-RAG-01`, not yet implemented.** L1 is the
*intended* default and the baseline the other rungs are measured against; it is not shipped. No part
of the pack-SQL filter, the standardized-distance ranker, the counter-evidence quota engine, or the
limitation emission exists in the repository. `DL-RAG-01` is `BLOCKED_BY_DEPENDENCY` on `DL-PACK-02`
in the M7 interpretation wave. **V** (07 card index.) Everything below this paragraph describes
*intended* behaviour and must not be read as implemented.

**What exists today** is a strictly narrower helper: `server/externalModel/localRetrieval.ts`
exposes `retrieveLocalC1Facts(facts, request)`, which selects over a **caller-injected bundle of
already-approved C1 facts** (≤ 128 rows supplied as an argument), filters on `feature_id` / `unit` /
`coverage_status` code sets, sorts on `(feature_id, fact_id)`, and truncates to a requested `limit`.
It performs **no I/O**: it opens no pack, runs no SQL, computes no distance, applies no quotas,
emits no limitations, and reads no coverage. It is a bundle-shaping guard on the external-model
boundary — the input side of §6 — not this design's L1. **V** (file as of 2026-08-04.) The gap
between that helper and L1 is the whole of `DL-RAG-01`.

**Mechanism (planned).** Filter-then-rank, always in that order.

1. **Filter (SQL/structured).** The claim family under composition resolves, through the
   **feature registry**, to: a set of `feature_id`s, a set of fact families, the coverage dimensions
   its ADR-02 gate reads, and its limitation-code neighbourhood. The filter is a parameterised query
   over the **verified pack snapshot**: `feature_id IN (…) AND window OVERLAPS (…) AND scope_alias
   IN (…) AND support_count >= gate`. The filter is a **set** predicate: it yields the *eligible
   set*, and it carries **no `LIMIT`** and no unordered truncation of any kind. **R**

   **Nothing is truncated before ranking.** Every eligible row is ranked (step 2), and the candidate
   cap (**R** 500 rows) is applied **after** ranking, to the ranked sequence — so the cap removes the
   *lowest-ranked* rows and never an arbitrary subset. **I** This is what makes step 3's
   byte-identical claim true rather than merely stated: `LIMIT` without a total `ORDER BY` returns an
   implementation-chosen subset (DuckDB is free to vary it with row order, parallelism, or scan
   plan), so a pre-rank cap would let two runs over the same pack admit *different* candidate pools,
   producing different result sets, different quota fills, and different claims from identical
   inputs — while §5.2 #4 still passed, because every returned ID would resolve fine.

   **Eligible-set ceiling (resource guard, still deterministic).** If the eligible set exceeds a
   preregistered working ceiling (**R** 50,000 rows) beyond which ranking every row is impractical,
   the reader does **not** fall back to an unordered `LIMIT`. It orders the *entire* eligible set by
   the total pre-cap key `(-support_count, window_start, feature_id, scope_alias, evidence_id)`
   ascending, and takes the ceiling-sized **prefix** of that order. The key is a **total** order, not
   a heuristic: `evidence_id` is unique within a pack (**V** canonical dictionary — "every ID must
   exist in the same pack"; IDs are pack-scoped opaque strings), so it is an absolute final
   tie-break and no two distinct rows can compare equal. Two runs over the same snapshot therefore
   take the same prefix, whatever the physical row order. **R**

   **Scope of that guarantee (stated precisely, because it is easy to overclaim).** Pack-uniqueness
   plus pack immutability gives reproducibility **over the same pack build** — which is what the
   byte-identical claim in step 3 asserts and all this design needs. It does **not** by itself give
   reproducibility **across rebuilds** of the same underlying data: if `evidence_id` is assigned by
   build sequence rather than derived from row content, a rebuild can permute the tie-break and flip
   the admitted prefix. Making cross-build replay reproducible therefore requires the pack contract
   to guarantee a **build-stable, content-derived** `evidence_id` — a requirement this design places
   on `DL-PACK-01/02`, not a property it may assume today (A-RAG-8). Where that guarantee is absent,
   cross-build comparisons must be treated as a different pack, not as a replay. **R**

   **Truncation is recorded whenever it binds — both kinds.** If the eligible-set ceiling binds, or
   the post-ranking candidate cap binds, or both, the reader returns a
   `RAG_CANDIDATE_POOL_TRUNCATED` limitation (proposed code) carrying the eligible-row count, the
   ranked count, and the admitted count as bounded integers; `completeness` is lowered and the tier
   gate is re-evaluated (§4.3). A cap that binds silently is a defect, not an optimisation: it is
   precisely the case where the retrieved set stops being a faithful selection over the pack, and
   the downstream claim must be told. **R**
2. **Rank (standardized distance).** For "similar window / similar system" queries: z-score each
   numeric feature *within its own `feature_id` and unit* across the pack snapshot, then rank by
   Euclidean distance over the registered feature subset for that family. Missing components are
   **not** imputed to 0 or to the mean — they reduce the compared dimension count and set a
   `comparability` penalty in the coverage vector; a candidate with fewer than the family's minimum
   comparable dimensions is dropped rather than scored. **R** (This is the direct expression of
   "absence is never zero" inside the ranking function.)

   **Degenerate-dimension guard — the standardisation must itself be admissible.** A z-score is
   defined only where its normalising statistics are. Before a dimension may enter the distance it
   must pass **both** checks, evaluated per `feature_id` (in its unit) over the snapshot:

   - (a) **normalisation support ≥ 2** — at least two non-null observations, so a sample standard
     deviation exists at all. (This is the count of observations behind the *normalisation*, a
     distinct quantity from a row's `support_count` evidence column.)
   - (b) **variance > ε** — a preregistered, unit-aware, scale-relative epsilon
     (**R** `sd > ε_rel · max(|mean|, ε_abs)`), so a constant or near-constant column cannot divide
     by ~0 and turn rounding noise into rank order.

   A dimension failing either check is **dropped from the distance for that query**, exactly like a
   missing component: it lowers the compared dimension count, adds the same `comparability` penalty,
   and is **recorded explicitly** — by registered `feature_id`, with which check failed and the
   observation count — as a `RAG_RANKING_DIMENSION_DEGENERATE` limitation (proposed code). It is
   never imputed, never scored as 0, never silently retained, and never permitted to yield `NaN` or
   `±Inf`. If the surviving dimension count falls below the family's minimum, the candidate is
   dropped and, if that empties the pool, the query abstains through the ordinary §4.3 path. **R**

   **I** A single-observation or constant dimension is the common real case, not an exotic one — a
   feature present in exactly one window, or a saturated flag — and `0/0` there is the classic way a
   ranker starts ordering on `NaN`. The guard exists so that "we could not compare on this
   dimension" is a *recorded limitation on the claim* rather than an invisible arithmetic accident,
   which is the same principle as "absence is never zero" applied one level up, to the statistics.

   **Non-finite is a defect, not a value.** The ranker never orders on a non-finite scalar. If a
   distance is non-finite after these guards, the guard is broken: retrieval **aborts** that query
   and abstains rather than emitting an order, because comparator behaviour with `NaN` present is
   implementation-defined and would silently void the byte-identical guarantee below. **R**
3. **Deterministic total order.** Rows are ordered by `(distance, -support_count, window_start,
   feature_id, scope_alias, evidence_id)` ascending — a **total** order, not merely a tie-break:
   `evidence_id` is unique within the pack, so no two distinct rows compare equal and the sort
   algorithm's stability cannot affect the outcome. Distances are accumulated
   over the registered feature subset **in registered order**, so floating-point summation is
   reproducible, and rows are compared on the accumulated value rather than re-derived per
   comparison. Same **snapshot** + same registry/feature versions + same query ⇒ **byte-identical**
   result set (same-build scope, per step 1). That conclusion now *follows from* the stated procedure — whole eligible set ranked
   (or a deterministic prefix of a total order taken), no unordered `LIMIT` anywhere, no non-finite
   scalars, cap applied after ranking — instead of being asserted beside it. §5.2 #14 tests it by
   replay under permuted physical row order. **R**

**Inputs.** Registered `feature_id`s, numeric values, units, `support_count`, coverage status enums,
limitation codes, statement codes, controlled dimension enums, pack-scoped aliases, bounded UTC
window bounds. Nothing else (§3). **All C1.**

**Index lifecycle.** *There is no index.* L1 is a query over the task-owned pack snapshot
(DuckDB/Parquet or the same reader the Query Lab uses). Nothing to build, nothing to delete, nothing
to go stale beyond the pack itself. **I** This is L1's largest advantage and the reason it is the
planned default: the entire "index as a new durable sink" problem does not exist.

**Evidence that would justify moving up.** L1 is declared insufficient only if, on the frozen
benchmark (§5), it fails the preregistered **Recall@10 floor for the relevant set** *or* the
**counter-evidence recall floor**, with the failures concentrated in query classes where the
structured filter has no discriminating column (**I** the plausible case: free-form owner questions
that do not map cleanly onto a claim family). A latency complaint is not evidence; a subjective
"results feel wrong" is not evidence.

### L2 — BM25 over controlled templates (**research**)

**Mechanism.** Each admissible pack row is rendered into a **controlled template string** — a
whitespace-joined sequence of registered tokens only:

```
<statement_code|feature_id> <scope_alias> <window_bucket> <coverage_status>
<limitation_code>* <dimension_enum>* <value_bucket> <support_bucket>
```

Numeric values enter only as **registered buckets** (e.g. `VAL_Q3`, `SUPPORT_GE_20`), never as free
digits, so the template alphabet is finite and enumerable from the registry. BM25 (k1/b pinned and
versioned) over that alphabet. **R**

**Inputs.** Identical to L1 plus the bucket vocabulary. No prose, no titles, no names, no paths, no
identifiers outside the pack-scoped alias space.

**Index lifecycle.**
- **Build:** in-process, from one `COMPLETE`-verified pack **snapshot** (§0), after the §3 registry
  gate. Build is a pure function of (pack build_id, registry version, template version, tokenizer
  version) — which holds only because the snapshot's bytes cannot change under the build.
- **Task-scope:** an index instance is bound to one composition task and one pack build_id.
- **Process-local:** held in the analysis worker's memory. **R** No file is written under the default
  design; writing one is **G-RAG-1**.
- **Non-exportable:** the index object has no serializer, is absent from the pack manifest table
  allowlist, and is excluded from `ExportView` by construction (it is not an `ExportView` type).
- **Non-cross-pack-linkable:** the index namespace is keyed by `build_id`; a loader that is offered
  postings from two `build_id`s fails closed. Aliases are already pack-scoped, so a joint index would
  not link anyway — but the loader still refuses, so the property is enforced rather than argued.
- **Deletion on revocation:** the index is a registered descendant in the ADR-03 schema registry, so
  the revocation cascade enumerates and destroys it; a `lineage_event` with
  `event_kind = index_deleted` is written (ADR-01 already reserves `index_built` / `index_deleted`).
  Because it is process-local, revocation also terminates the owning worker. **R**
- **Stale behaviour:** every index carries a fingerprint
  `(pack_build_id, pack_schema_version, redaction_revision, consent_revision, feature_versions_hash,
  registry_version, template_version)`. Any mismatch at query time ⇒ **refuse to serve**, fall back
  to L1, and **return** coverage status `stale` with limitation `RAG_INDEX_STALE` (proposed) for the
  composer to attach to every claim composed in that task. Never serve-and-warn. **R**

**Evidence that would justify adoption.** BM25 beats L1 on Recall@k *and* nDCG@k *and* does not
regress counter-evidence recall, on the frozen benchmark, at the preregistered minimum practically
meaningful improvement, with the ADR-19 final holdout untouched until the decision. Because L2 is a
*durable-shaped* structure over C1 data, adoption additionally requires the §5 privacy probes to pass.

**I — honest note on L2 sensitivity.** An inverted index over templates *is* the templates: postings
reconstruct each row's token multiset almost exactly. L2 is therefore **not** a de-identifying
transform; it is a copy of pack facts in a different shape, inherits C1, and inherits the pack's
retention and deletion. Nothing about "it's just an index" reduces its class.

### L3 — Local pinned offline vector index (**research, likely-reject**)

**Mechanism.** A pinned, bundled, offline embedding model over **the same controlled templates as
L2** (never over prose, never over source, never over raw values), plus exact nearest-neighbour
search over the **eligible set** that L1's filter already produced (the eligible set, not L1's
post-rank capped pool — otherwise L1's own distance would silently pre-select L3's candidates and
the ladder comparison in §5 would not be measuring what it claims). Filter-then-rank still binds:
vectors reorder an SQL-eligible set, they never widen it, and the candidate cap is applied to the
vector-ranked sequence exactly as in L1 step 1. **R**

**Inputs.** Identical to L2. **The embedding inherits the highest class of every input (C1) and is
never anonymisation** — principle 6, restated because it is the exact place people forget it.

**Index lifecycle.** Every L2 lifecycle rule applies unchanged, plus:
- the embedding model is **bundled and pinned** (version + checksum recorded in the model registry
  per ADR-19), runs **offline with no network**, and executes no remote code;
- the model binary is a supply-chain surface and a licence surface — introducing it is **G-RAG-3**,
  even though it is local;
- vectors are float arrays derived from C1 templates; they are **C1**, not "derived and therefore
  safe", and they are subject to the same non-export, non-cross-pack, revocation-deletion rules.

**Evidence that would justify adoption.** L3 must beat **both** L1 and L2 on Recall@k **and** nDCG@k
**and** counter-evidence recall, at the preregistered margin, **and** pass reconstruction /
model-inversion and membership-inference probes at their preregistered ceilings (§5). Any one miss
⇒ reject; the final holdout is consumed and not reused (ADR-19). **R**

**Why "likely-reject" is the honest prior.** **I** The corpus is a finite alphabet of registered
codes plus bucketed numbers. Lexical and structured matching over a closed vocabulary have very
little semantic gap for embeddings to close; the plausible gain is on paraphrase, and there is no
paraphrase in a controlled template. The expected upside is small and the added surface (a durable-
shaped index, a pinned model binary, an inversion attack surface) is not.

### Ladder decision rule (summary)

| Step | Status | Adopt only if | Blocking privacy conditions | New sink? |
|---|---|---|---|---|
| L1 structured + standardized distance | **planned deterministic default/baseline** — `DL-RAG-01`, **not yet implemented** | — (it is the baseline) | none (no index) | no |
| L2 BM25 over templates | research | L1 measurably fails Recall@k or counter-evidence recall on the frozen benchmark | prohibited-field canaries clean; uniqueness-leakage gate | no (process-local); file = **G-RAG-1** |
| L3 local pinned offline vectors | research, **likely-reject** | beats L1 **and** L2 on Recall@k, nDCG@k **and** counter-evidence recall at the preregistered margin | all of L2 **plus** the membership-inference ceiling; reconstruction is a mandatory *disclosure* metric (§5.2 #12 — no pass/fail gate) | no (process-local); file = **G-RAG-1**; model bundle = **G-RAG-3** |

Demotion is symmetric: an **adopted** step (none is adopted yet — L1 itself is unbuilt) that fails
re-evaluation after a registry/feature-version change falls back to the step below it **automatically** (the fallback path is a runtime code path,
not a manual decision), because ADR-19 requires every model to have a fallback and to disappear from
claims when demoted.

---

## 2. Where retrieval sits in the pipeline

```
Analysis Pack directory on disk (user-selected — untrusted until verified)
        │
        ▼  open ONE immutable task-owned snapshot (§0), verify identity + checksums ON that snapshot
Verified pack snapshot (COMPLETE, checksummed, C1, pack-scoped aliases)
        │    every read below uses this same handle/copy — no path re-resolution
        ▼  [§3 field-registry gate — reject before any template/index write]
Admissible row set
        │
        ▼  L1 filter — set predicate, no LIMIT
Eligible set  (above the working ceiling: deterministic total-order prefix + truncation limitation)
        │
        ▼  rank ALL eligible rows (L1 distance | L2 BM25 | L3 vectors) → total-order ranked sequence
        │
        ▼  candidate cap applied to the RANKED sequence (RAG_CANDIDATE_POOL_TRUNCATED if it binds)
        │
        ▼  §4 counter-evidence quotas
Retrieval result set (evidence IDs + roles + coverage rows) + transient RetrievalLimitation[]
        │
        ├──────────────► ADR-21 deterministic composer (local, complete product)
        │
        └──────────────► evidence-bundle builder  ──[separate gate, §6]──►  G4 boundary
```

Retrieval hands the composer a **role-tagged result set**, not prose:
`{evidence_id, role ∈ {supports, contradicts, contextualizes, coverage_basis, limitation_basis},
layer, feature_id|statement_code, value, unit, support_count, coverage_status, limitation_codes[],
window}`, **plus** a transient `RetrievalLimitation[]` describing everything that degraded the
selection (§3 Rule 4a). Roles map 1:1 onto ADR-01 `claim_evidence_edge.role`, so a composed claim's
edges are a projection of what retrieval returned — auditable after the fact. **R**

**Retrieval is a pure read.** Every arrow above points forward. Retrieval writes to no store: not
the pack, not the snapshot, not the canonical SQLite store, not a findings table. Its outputs are
return values, and the **composer** is what persists anything (§3 Rule 4a, §4.3). **R**

---

## 3. Strict field registry gate (before templating, before any index write)

This is a hard gate, executed **before** a row is rendered into a template, embedded, tokenised,
scored, or written into any structure. **R**

**Rule 1 — allowlist by registration, not by inspection.** A field may enter retrieval only if the
field-classification registry (`shared/privacy.ts` lineage, **V** contract exists from P1) contains
it with: a registered name, a class, a unit or enum domain, and an explicit `retrieval_admissible`
flag. *A field absent from the registry is prohibited* — this is the charter's existing sink rule
**D-charter**, applied to retrieval as a sink of its own.

**Rule 2 — admissible classes.** Only **C1** (and C0 in the synthetic/demo lane) are
`retrieval_admissible`. C2, C3, C4, X are rejected. Concretely: no OIDs, no provider IDs, no
installation-HMAC analytical keys, no repository names, no module/graph node IDs (C3), no workflow or
dependency aliases (C3), no paths, no subjects, no titles, no labels, no bodies, no diagnostics.

**Rule 3 — classification inheritance.** Any derived artifact of the retrieval pipeline — template
string, token, posting list, bucket, vector, distance matrix, cache entry, result set, ranking
intermediate — **inherits the maximum class of every input that contributed to it**, and inherits the
shortest retention and the union of deletion cascades of those inputs. There is no declassification
step anywhere in this design. An embedding of C1 is C1. A hash of C1 is C1. A bucket of C1 is C1.
**R**, per principle 6 and the charter's "pseudonymous identifiers are not anonymous".

**Rule 4 — prohibited-field rejection is fail-closed and pre-write.** On encountering an unregistered
field, a registered-but-inadmissible class, an unknown enum value, an unknown `feature_id`, an unknown
limitation code, or a value outside its registered domain:

1. the **row** is rejected (not sanitised, not truncated, not coerced);
2. a **transient** `RetrievalLimitation` value is appended to what the reader **returns** to its
   caller, carrying a stable code (`RAG_FIELD_REGISTRY_REJECT`) and bounded numeric metadata only —
   counts, never the offending value, per the Logs/errors sink contract **D-charter**;
3. the **caller** (the ADR-21 composer) lowers the affected coverage dimension from that returned
   limitation, so downstream claims see the shortfall;
4. if rejections exceed a preregistered share of the eligible set, the whole retrieval **aborts**
   and the composer abstains — a partially-admissible pack is a data-quality event, not a smaller
   corpus. **R**

**Rule 4a — the reader writes nothing, anywhere.** Retrieval's source is an immutable `COMPLETE`
pack snapshot, so its findings are **returned, not persisted**. Concretely, the reader **does not**
write `data_quality_findings` rows, **does not** update `coverage`, **does not** mutate the pack or
its snapshot, and **does not** open the canonical SQLite store at all. **I** A canonical write from
a pack-reading component would be an undeclared side effect in a component whose entire contract is
"a selection function over already-stored evidence" (§0): invisible to the ADR-03 lifecycle that
governs that store's sinks, unattributable to any ingestion run, and — because the pack is immutable
and pack-aliased — not even writable back to the thing that was actually wrong. Persistent
data-quality findings and coverage updates belong **only** to the authorised ingestion and
pack-build stages, where those writes are declared sinks with a schema, a retention clock, and a
revocation path. Retrieval discovering invalid rows in a `COMPLETE` pack is evidence that the
**pack build** admitted them; the fix is at `DL-PACK-01/02`, and having the consumer also record it
would double-count a build defect as a read defect. **R**

Shape (proposed): `RetrievalLimitation { code, dimension, scope: query | result_set | dimension,
counts: { … bounded integers }, feature_ids?: registered ids }`, returned as
`RetrievalLimitation[]` alongside the result set. Every §4.3 code travels this way — registry
rejections, pool truncation, degenerate ranking dimensions, quota shortfalls, uniqueness
suppression. **No `RetrievalLimitation` is a row anywhere until the composer binds it to a claim.**

**Rule 5 — order is load-bearing and testable.** The gate runs *before* the template renderer is
called. The test asserts ordering directly: a canary row is injected, and the template renderer and
index writer are instrumented to record every input they ever received; both must record zero
observations of the canary row. Asserting only "the canary is not in the output" would pass even if
the canary transited the index. **R**

---

## 4. Counter-evidence mandate mechanics

### 4.1 Quotas

Every **claim family** declares, in the registry, a quota tuple over evidence roles:

`{supports_min, contradicts_min, coverage_min, limitation_min, total_max}`

Proposed defaults (**R**, all preregistered per family, none of these are platform facts):

| Claim family (proposed IDs) | supports_min | contradicts_min | coverage_min | limitation_min | total_max |
|---|---:|---:|---:|---:|---:|
| `CF.CI_FEEDBACK_SHIFT` | 3 | 2 | 2 | 1 | 12 |
| `CF.INTEGRATION_SHAPE` | 3 | 2 | 2 | 1 | 12 |
| `CF.FLOW_LINKAGE` | 3 | 2 | 2 | 2 | 12 |
| `CF.ARCH_EVOLUTION` | 3 | 2 | 3 | 2 | 14 |
| `CF.PORTFOLIO_TRANSITION` | 3 | 2 | 2 | 1 | 12 |
| `CF.COVERAGE_STATE` | 2 | 1 | 3 | 2 | 10 |

**What counts as contradicting.** Not "a row with the opposite sign". A row fills a `contradicts`
slot only if the family's registry entry names it as a **registered falsifier channel**: the
alternative-explanation feature (e.g. for a CI-duration shift, the runner-class mix and the queue
distribution), the same feature in an adjacent comparable window, the same feature at a different
scope where the family predicts the effect should also appear, or a coverage series whose movement
would explain the signal (the ADR-17 `coverage_shift_candidate` channel). **R** This keeps
"contradiction" deterministic and auditable rather than a vibe.

### 4.2 Fill order (budget safety)

Slots are filled in the order **coverage → limitation → contradicts → supports**, and only then is
`total_max` (and, downstream, the G4 16,000-byte input ceiling **D-charter**) applied by truncating
**supporting** evidence. **R**

**I** This ordering is the whole mechanism. Any budget-driven truncation that ran in natural relevance
order would preferentially delete counter-evidence, because counter-evidence ranks lower by
construction. Fill-order inversion makes cherry-picking structurally impossible rather than
policy-forbidden.

### 4.3 Shortfall → limitation → claim tier

A shortfall is a *first-class output*, never silence:

| Shortfall | Emitted limitation (proposed code) | Effect on downstream claim (ADR-02 monotone) |
|---|---|---|
| `contradicts` slots unfilled | `RAG_QUOTA_SHORTFALL_CONTRADICTING` | claim tier capped at `hypothesis`; a mandatory alternative `COUNTER_EVIDENCE_NOT_RETRIEVABLE` is added; deterministic-tier rendering is refused |
| `coverage` slots unfilled | `RAG_QUOTA_SHORTFALL_COVERAGE` | **abstention** — no claim; an ADR-24 `question` of kind `evidence_gap` is generated instead |
| `limitation` slots unfilled | `RAG_QUOTA_SHORTFALL_LIMITATION` | claim tier lowered one step; limitation copy resolved from the (family × dimension) dictionary |
| eligible-set ceiling or candidate cap bound | `RAG_CANDIDATE_POOL_TRUNCATED` | `completeness` dimension lowered; tier gate re-evaluated; eligible/ranked/admitted counts carried as bounded integers (§1 L1 step 1) |
| ranking dimension dropped (normalisation support < 2, or variance ≤ ε) | `RAG_RANKING_DIMENSION_DEGENERATE` | `comparability` lowered per dropped dimension; below the family's minimum comparable dimensions ⇒ **abstention** (§1 L1 step 2) |
| registry-gate row rejection | `RAG_FIELD_REGISTRY_REJECT` | `completeness` lowered; rejection storm ⇒ abort + abstain (§3 Rule 4) |
| index stale / absent | `RAG_INDEX_STALE` / `RAG_INDEX_ABSENT` | fall back to L1; `comparability` lowered; tier re-evaluated |
| result set fails the uniqueness gate | `RAG_SPARSE_SUPPRESSED` | offending rows removed **and** counted as a shortfall on their slot |

Retrieval **returns** each of these as a transient `RetrievalLimitation` (§3 Rule 4a); the
**composer** is what persists the corresponding `limitation_instance` row (ADR-01), bound to the
claim it composes, with the coverage-vector dimension that triggered it. A limitation that never
reaches a composed claim is never written anywhere — it was a property of a read, not a fact about
the store. Because ADR-02's rule is monotone, no other dimension can compensate a quota shortfall
back upward. **R**

**Never inferred:** "no contradicting evidence was retrieved" is rendered as *"counter-evidence for
this family was not retrievable from this pack"*, with the falsifier channels that were searched
listed by code. It is never rendered as *"nothing contradicts this"*. The copy dictionary carries no
phrasing for the latter. **R**

---

## 5. Evaluation plan

### 5.1 Governance

The retrieval benchmark is an ADR-19 candidate family (`WB-C9`). Therefore: frozen invented benchmark
suites with a dataset card (generator parameters *are* the card); preregistration of primary metric,
minimum practically meaningful improvement, split policy, and a final holdout that a failed gate
consumes; Benjamini–Hochberg control across the family's primary tests; repository- and time-held-out
splits. **R**, restating ADR-19 rather than inventing a parallel process.

All fixtures are invented (charter fixture rule **D-charter**). Proposed fixture corpora:

| Fixture (proposed) | Construction | Purpose |
|---|---|---|
| `FX-RAG-01` base corpus | ≥ 2,000 synthetic pack rows across ≥ 8 alias'd systems, ≥ 24 windows, ≥ 20 registered feature IDs; planted relevance sets per query | Recall@k, nDCG, MRR |
| `FX-RAG-02` contradiction corpus | for each of 200 queries, planted supporting **and** planted falsifier rows on registered channels | counter-evidence recall, quota mechanics |
| `FX-RAG-03` degraded-coverage corpus | `FX-RAG-01` with coverage rows forced to `truncated`/`restricted`/`censored`/`stale` at known positions | abstention correctness, shortfall handling |
| `FX-RAG-04` canary corpus | rows carrying unique invented C2/C3/C4/X canaries in unregistered fields | prohibited-field gate, §3 Rule 5 ordering |
| `FX-RAG-05` uniqueness corpus | code combinations with equivalence-class sizes 1, 2, 4, 5, 20 by construction | uniqueness-leakage gate |
| `FX-RAG-06` twin-pack corpus | two packs built from the same synthetic store with different pack keys | cross-pack-linkage tests |
| `FX-RAG-07` revocation corpus | `FX-RAG-01` plus a capability whose rows are individually tagged | deletion proof |
| `FX-RAG-08` hostile corpus | malformed manifest, wrong checksum, missing `COMPLETE`, unknown schema version, injection-shaped pseudo-codes, adversarial duplicate flooding, **and a TOCTOU case: a pack whose bytes are replaced by a concurrent writer after checksum verification and before the table scan** | §7 threat mitigations, snapshot immutability |
| `FX-RAG-09` degeneracy + scale corpus | feature dimensions that are constant, near-constant (`sd` ≤ ε), and single-observation by construction; plus an eligible set built above the working ceiling, and the same rows written in several physical orders | degenerate-dimension guard, non-finite absence, deterministic pre-cap ordering, truncation recording |

### 5.2 Metric definitions (operational, on the fixtures above)

1. **Recall@k** — for query *q* with planted relevant set *R(q)* (generator ground truth), and
   returned top-*k* set *S_k(q)*: `|S_k(q) ∩ R(q)| / |R(q)|`. Report macro-mean over queries at
   *k* ∈ {5, 10, 20}. Primary *k* = 10. Corpus: `FX-RAG-01`.
2. **nDCG@k** — graded relevance from the generator (3 = planted primary, 2 = planted secondary,
   1 = same-family same-window, 0 = other); `DCG@k = Σ_{i=1..k} rel_i / log2(i+1)`, normalised by the
   ideal ordering. Corpus: `FX-RAG-01`.
3. **MRR** — `mean(1 / rank of first planted-primary row)`; 0 if no primary in top-*k*. Corpus:
   `FX-RAG-01`.
4. **Citation validity** — over every returned result set: fraction of returned evidence IDs that
   resolve to a row **in the same pack build_id**. Gate: **1.000, exact**; any value < 1 is a
   CI-blocking defect, not a metric. Corpus: all.
5. **Counter-evidence recall — THE canonical definition (2026-08-04 review correction; 02 and 03
   reference this verbatim, never restate).** For each query in `FX-RAG-02` with planted falsifier
   set *F(q)*: `|topK(q) ∩ F(q)| / |F(q)|`, computed over the **pre-quota top-k ranking** — this is
   the number that discriminates rungs L1/L2/L3, because the quota engine would otherwise compress
   it toward a constant (`contradicts_min` fills from an independent pool). The post-quota
   delivered-set value `|S(q) ∩ F(q)| / |F(q)|` is **also** reported, separately, as a
   quota-engine correctness check only, never as the ladder metric. `limitation` rows are never
   pooled into either number. Reported separately from Recall@k and never averaged into it.
6. **Unsupported-claim rate (downstream)** — run the ADR-21 composer over the retrieval output on
   `FX-RAG-02`/`FX-RAG-03`. A composed claim is **unsupported** if any of: (a) it cites an evidence ID
   absent from the delivered result set; (b) its family's ADR-02 vector gate was not met by the
   delivered coverage rows; (c) a planted falsifier with support ≥ the claim's own support existed in
   the corpus and was neither delivered nor disclosed as a shortfall. Metric =
   `unsupported_claims / total_claims`. Gate: **0** for (a) and (b) (schema-enforceable);
   preregistered ceiling for (c).
7. **Deletion proof** — on `FX-RAG-07`: build an index (L2/L3 only), revoke the tagged capability, run
   the ADR-03 cascade, then assert (i) the worker process holding the index is terminated, (ii) a
   rebuild from the post-revocation pack yields **zero** postings/vectors derived from tagged rows,
   (iii) queries whose planted answers were tagged now return empty result sets with
   `RAG_INDEX_ABSENT`, (iv) a `lineage_event(index_deleted)` row exists, (v) no on-disk artifact
   containing tagged tokens exists under the application-controlled tree. Binary pass/fail.
8. **Stale-index behaviour** — on `FX-RAG-01`: build an index, then mutate exactly one fingerprint
   component (`redaction_revision`, then `consent_revision`, then `feature_versions_hash`, then
   `registry_version`, then `pack_schema_version`, one per case). Assert for each: the index refuses
   to serve, L1 fallback executes, `RAG_INDEX_STALE` reaches every claim composed in that task, and
   no result is served from the stale structure. Five binary cases; all must pass.
9. **Prohibited-field canaries** — on `FX-RAG-04`: assert the §3 gate rejected the row **and** the
   instrumented template renderer / tokenizer / index writer recorded zero observations of it, **and**
   the canary (in exact, escaped, encoded, case-folded and truncated forms per the canonical
   adversarial-fixture rule) appears in no index structure, result set, log line, error, bundle,
   claim, or memory dump taken at the end of the task. Binary.
10. **Membership inference** — build index *A* over corpus *C* and index *B* over *C ∪ {t}* for a
    target row *t*. An attacker with query access only (no index internals) issues N = 1,000 queries
    and scores "is *t* present?". Metric = attacker ROC-AUC. Preregistered ceiling **R** AUC ≤ 0.55
    for L2/L3 adoption. Repeat with *t* drawn from common and from rare equivalence classes.
11. **Uniqueness leakage** — on `FX-RAG-05`: for every delivered result set, compute the
    equivalence-class size of each returned row's registered-code combination within the pack.
    Metrics: (a) share of result sets exposing a class of size < 5; (b) minimum class size observed.
    Gate: (a) = 0 after the suppression pass; suppressed rows count as quota shortfalls (§4.3).
    **I** This gate matters specifically for retrieval because ranking *selects for unusualness* —
    build-time suppression alone is not sufficient once a component's job is to surface outliers.
12. **Reconstruction / model-inversion** — given only the index structure (postings for L2; vectors +
    the pinned model for L3), attempt to recover each row's template. Metrics: exact template-token
    multiset reconstruction rate; per-bucket numeric recovery accuracy. **R** No pass/fail *gate* is
    proposed, because the expected honest result is "high" (§1, L2 note); the metric exists to force
    the true sensitivity into the model card so the index is classified as a C1 copy rather than as a
    de-identified derivative. A *claimed* low reconstruction rate would be the surprising result and
    would itself need independent verification.
13. **Cross-pack linkage** — on `FX-RAG-06`: (a) attempt to match aliases across the twin packs by
    ranking-behaviour similarity; report matching accuracy against the generator's ground-truth
    correspondence; preregistered ceiling = chance + margin. (b) Attempt to load postings from two
    `build_id`s into one index: must fail closed. (c) Assert no result set ever contains rows from two
    `build_id`s. (b) and (c) are binary.
14. **Determinism (byte-identical replay)** — on `FX-RAG-01` and `FX-RAG-09`: run every benchmark
    query N = 20 times in fresh processes over the same snapshot, and repeat over packs whose
    Parquet **physical row order is permuted** with contents identical. Assert the serialised result
    sets — including limitation lists and their ordering — are byte-identical across every run and
    every permutation. **I** The permutation arm is the load-bearing one: a design that truncates
    before ranking, or sorts on a non-total key, passes a naive repeat-run test and fails this.
    Additionally assert (a) no result set was produced from a non-finite distance, (b) every
    dropped degenerate dimension appears as a `RAG_RANKING_DIMENSION_DEGENERATE` limitation, and
    (c) every bound cap appears as a `RAG_CANDIDATE_POOL_TRUNCATED` limitation with counts. Binary.
    **Cross-build arm (reported, not gated, until A-RAG-8 resolves):** rebuild the same corpus into
    a second pack and report whether result sets still match. A mismatch here is a finding about
    `evidence_id` stability in the **pack contract**, not a retrieval defect, and must be reported
    as such rather than silently weakening the same-build gate.
15. **Snapshot immutability (TOCTOU)** — on `FX-RAG-08`: verify a pack, then have a concurrent
    writer replace file bytes (and, separately, rename/replace the directory entry) before the table
    scan. Assert the reader either serves the originally verified bytes or fails closed, and in no
    case serves post-swap bytes as verified; assert the end-of-task checksum re-assertion catches
    any snapshot that did prove mutable and that the task's results are discarded. Also assert, by
    instrumenting path resolution, that the pack path is resolved **exactly once per task**. Binary.
16. **Read-only proof** — on all corpora: instrument every write path (pack directory, snapshot,
    canonical SQLite store, findings and coverage tables) for the duration of a retrieval task and
    assert **zero** writes originate from the retrieval module, including on the rejection-storm and
    hostile-pack paths where a "record the finding" reflex is most likely. Binary; a write here is a
    CI-blocking defect, not a metric.

### 5.3 Reporting

Results are reported as a **vector**, never as a single retrieval score, and land in the ADR-19 model
card for `WB-C9`. A step that wins on Recall@k while losing counter-evidence recall has **failed**.
**R**

---

## 6. Relationship to the G4 boundary and to a future local model

- **Retrieval is entirely local.** It performs no network I/O. It is not a hosted retrieval object.
  It creates no OpenAI Files object, no vector store, no embeddings API call, no web search, no tool.
  Those are all explicitly outside G4 **D-charter**. **R**
- **Retrieval output is an input to the bundle builder, not a payload.** The evidence-bundle builder
  is a **separate component with its own independent Model-sink allowlist check**. It re-validates
  every field against the Model-sink contract and **re-mints request-scoped opaque evidence IDs**, so
  retrieval-internal identifiers and pack-scoped aliases never leave the machine. Double validation is
  deliberate: retrieval passing its own gate must not be usable as an argument that the bundle is
  transmissible. **R**
- **Nothing in this document authorises transmission.** `cap.external.model` is `never_authorized`
  **V** (matrix) and stays so until its own bounded activation card, canaries, transport tests, and
  proving gate pass. A working retrieval layer changes none of that. Retrieval is fully useful with
  the external step permanently off — the ADR-21 composer is deterministic-first and is the complete
  product. **R**
- **Ordering constraint.** The G4 ceilings (one request, ≤ 16,000 input UTF-8 bytes, ≤ 2,000 output
  tokens, ≤ USD 0.01 **D-charter**) apply to the *bundle*, and the §4.2 fill order guarantees that
  shrinking a bundle to fit removes supporting evidence before counter-evidence. **R**
- **Future pinned offline local model (composer side).** ADR-21 allows "a future local model must be
  pinned, licensed, offline, non-executing-remote-code". Introducing one is **G-RAG-3** territory:
  a bundled model binary is a new supply-chain, licence, disk, and (for embeddings) inversion surface.
  It is an owner gate, not an assumption, and it is **not** required by anything in this design.
- **Deliberate non-assumption.** Nothing here presumes ADR-10's Tier-2 (PR/issue prose, durable text
  embeddings). Retrieval indexes controlled codes only; if Tier-2 were ever gated in, retrieval would
  need its own re-review, not an automatic extension. **A** (reversal path: this paragraph is the
  reversal path — a Tier-2 decision reopens §3.)

---

## 7. Threat model

| Threat | Vector | Mitigation | Test |
|---|---|---|---|
| **Hostile pack content** | A pack is a directory the user selects; it may be edited, truncated, or supplied from elsewhere | Open **one immutable task-owned snapshot** (held handles, or a copy where handle-stable reads are not guaranteed), then verify `checksums.sha256`, the `COMPLETE` marker, `build_id`, and `pack_schema_version` bounds **on that snapshot**, and serve every later read from the same handle/copy with **no path re-resolution** (§0); refuse to open on failure (ADR-22 rule); re-assert checksums on the same snapshot at task end and discard results on mismatch; then apply the §3 registry gate row-by-row | `FX-RAG-08`, §5.2 #15 |
| **Byte substitution between verification and read (TOCTOU)** | A concurrent or hostile writer — who may own the user-selected directory — replaces file contents after the checksum pass and before the DuckDB scan | The snapshot **is** the mitigation: verification and every read go through the same bytes, so there is no window to substitute into. **Verify-then-reopen-by-path is explicitly not a mitigation** — it attests to bytes nobody consumed, and the attacker need win the race only once | `FX-RAG-08` TOCTOU case, §5.2 #15 |
| **Unknown-code smuggling** | A crafted pack carries plausible-looking but unregistered `feature_id`/`limitation_code`/`statement_code` values | Registry membership is required, not pattern-matched; unknown code ⇒ row rejected + a **transient** `RAG_FIELD_REGISTRY_REJECT` limitation returned to the caller (bounded metadata only; the reader writes nothing — §3 Rule 4a); unknown codes are **never** admitted as an `unknown` token, because that would make the corpus attacker-extensible | `FX-RAG-08` |
| **Hostile pack driving writes into the canonical store** | A crafted pack full of invalid rows induces a reader that "records data-quality findings" to write attacker-shaped volume into the operational store | Retrieval performs **no writes at all** (§3 Rule 4a): findings are return values, persistence belongs to ingestion/pack-build. There is no write path to drive | §5.2 #16 |
| **Index poisoning / ranking flooding** | Thousands of near-duplicate rows crafted to dominate top-*k* and starve counter-evidence | (a) filter-then-rank: ranking can only reorder the SQL-eligible set; (b) per-role quotas are filled from *independent* pools, so flooding the `supports` pool cannot consume `contradicts` slots; (c) support gates, and a candidate cap applied **to the ranked sequence** — never as a pre-rank `LIMIT`, which would let flooding decide *which* rows an attacker-chosen physical order fed to the ranker; (d) duplicate collapse on the natural key before ranking | `FX-RAG-08` |
| **Injection through codes** | A code value shaped like an instruction (`IGNORE_PREVIOUS_INSTRUCTIONS`) reaching a prompt | Codes are registry members, so such a value is rejected at §3. Structurally: **codes are never concatenated into prose anywhere in the local pipeline** — the copy dictionary resolves codes to text only at render time in the UI, and the bundle carries codes, not rendered sentences. The composer's statement enums are closed, and model output cannot add evidence IDs or statement codes (ADR-21) | `FX-RAG-08` + existing prompt-injection canaries |
| **Re-identification via rare code combinations** | Ranking surfaces outliers; a unique (feature, window, coverage, limitation) tuple can identify a system or a specific event | Build-time sparse suppression (ADR-22) **plus** a result-set-level uniqueness gate (§5.2 #11); suppressed rows become quota shortfalls, not silent removals | `FX-RAG-05` |
| **Cross-pack correlation** | Two packs of the same systems, correlated by behaviour rather than by ID | Pack-scoped alias keys (**V** canonical §6: export IDs use a new pack-scoped key); loader refuses mixed `build_id`; explicit linkage benchmark | `FX-RAG-06` |
| **Index outliving its consent** | Revocation cascades over tables but forgets an in-memory or on-disk index | The index is a registered descendant in the ADR-03 schema registry (enumeration is *generated*, not curated); a canary that finds an unenumerated structure is a CI-blocking schema-registry defect (ADR-03's stated rule) | `FX-RAG-07` |
| **Stale index laundering deleted evidence** | Pack rebuilt after deletion, index still holds old postings | Fingerprint mismatch ⇒ refuse to serve, never serve-and-warn | `FX-RAG-01` staleness cases |
| **Reintroducing a person-shaped surface** | "Similar window" ranking over features that jointly reconstruct a schedule | Grain floors bind upstream (ADR-14: nothing finer than ISO week on cadence surfaces); the ADR-14 proxy/composition review is applied to the *ranking feature subset* per claim family as a card checklist item, since ranking is itself a feature combination | proxy/composition review recorded on `RAG-01` |
| **Retrieval as a covert query endpoint** | An HTTP surface that lets a local process run arbitrary selections | No new API endpoint. Retrieval runs in-process for composition; user-facing exploration is the ADR-22 Query Lab over the pack, in-browser. The charter's ban on a generic SQL/table endpoint is unchanged | API tests (existing) |

---

## 8. Owner gates (flag, do not assume)

| Gate | Question | Current posture |
|---|---|---|
| **G-RAG-1** | May a retrieval index be written **durably to disk** (a new persistence sink), rather than living process-local? | **Not assumed.** Under this design every index is process-local and non-exportable. A durable index is a new reviewed sink needing: schema registration, class assignment (C1, inherited), retention clock, revocation enumeration, backup/restore semantics, and its own canary suite. Owner decision. |
| **G-RAG-2** | May an **external embedding provider** be used? | **REJ as an assumption.** G4 explicitly excludes embeddings, Files, and vector stores **D-charter**. This design proposes nothing beyond that boundary. Changing it is a new owner decision on a new external transmission boundary — flagged here, not designed for. |
| **G-RAG-3** | May a **pinned offline local model binary** (embedding model for L3, or a local composer model) be bundled? | **Not assumed.** Local does not mean free: it adds supply-chain, licence, disk, and inversion surfaces. Owner decision, even though no data leaves. |
| **G-RAG-4** | May retrieval read the **canonical SQLite store** instead of / in addition to completed packs? | **Not assumed; recommended against.** It would forfeit pack-scoped aliasing, build-time suppression, and the immutable audited boundary. Owner decision if ever proposed. |
| **G-RAG-5** | May **C3 graph rows** (module/dependency/workflow projections) enter retrieval? | **Not assumed.** C3 is excluded from ordinary exports and from the Model sink; admitting it to retrieval is a separate class decision. |

Per ADR-03, approving any of these gates **does not activate anything** — the capability state machine
still requires a card-bound, previewed, proving-checks-green transition. **R**

---

## 9. Cards, IDs, and dependencies

**Existing cards (ADR-20):** `RAG-01` (structured retrieval + counter-evidence quotas),
`RAG-02` (retrieval benchmark + canaries), `WB-C9` (lexical/vector candidates, research).

**Proposed additional cards** (same style, marked proposed):

- `RAG-03` (proposed) — field-registry gate: `retrieval_admissible` flag, pre-write rejection,
  transient-`RetrievalLimitation` return contract and read-only proof (§3 Rules 4/4a),
  ordering-instrumentation test (§3 Rule 5).
- `RAG-07` (proposed) — pack snapshot reader: single path resolution, one immutable task-owned
  snapshot (handles or copy), verification on the snapshot, end-of-task re-assertion, TOCTOU
  fixture case (§0, §5.2 #15).
- `RAG-04` (proposed) — quota engine: fill order, shortfall → limitation → ADR-02 tier effect,
  falsifier-channel registry per claim family.
- `RAG-05` (proposed) — index lifecycle harness (L2/L3 only): fingerprinting, staleness refusal,
  registry-enumerated deletion, `lineage_event` emission.
- `RAG-06` (proposed) — privacy probe suite: membership inference, uniqueness leakage,
  reconstruction, cross-pack linkage.

**Proposed IDs introduced here** (all marked proposed; none exist in the canonical dictionaries yet):

- Limitation codes: `RAG_QUOTA_SHORTFALL_CONTRADICTING`, `RAG_QUOTA_SHORTFALL_COVERAGE`,
  `RAG_QUOTA_SHORTFALL_LIMITATION`, `RAG_CANDIDATE_POOL_TRUNCATED`, `RAG_INDEX_STALE`,
  `RAG_INDEX_ABSENT`, `RAG_SPARSE_SUPPRESSED`, `RAG_FIELD_REGISTRY_REJECT`,
  `RAG_RANKING_DIMENSION_DEGENERATE`. All are carried as **transient** `RetrievalLimitation` values
  in the reader's return (§3 Rule 4a); they become rows only when the composer binds them to a claim.
- Transient type (proposed, no schema/table): `RetrievalLimitation` — the reader's return-value
  shape defined in §3 Rule 4a. Deliberately **not** a persisted entity and **not** a sink.
- Claim families: `CF.CI_FEEDBACK_SHIFT`, `CF.INTEGRATION_SHAPE`, `CF.FLOW_LINKAGE`,
  `CF.ARCH_EVOLUTION`, `CF.PORTFOLIO_TRANSITION`, `CF.COVERAGE_STATE`.
- Evaluation feature IDs (benchmark-internal, C1): `DL.RAG.RECALL_AT_K.v1`, `DL.RAG.NDCG_AT_K.v1`,
  `DL.RAG.MRR.v1`, `DL.RAG.CITATION_VALIDITY.v1`, `DL.RAG.COUNTER_EVIDENCE_RECALL.v1`,
  `DL.RAG.UNSUPPORTED_CLAIM_RATE.v1`, `DL.RAG.QUOTA_SHORTFALL_RATIO.v1`.
- Alternative code: `COUNTER_EVIDENCE_NOT_RETRIEVABLE`.
- Rejected capability (proposed addition to the rejected register): `RAG-EXTERNAL-EMBED-X` —
  external/hosted embedding or vector-store retrieval. Reason: outside G4; new external transmission
  boundary; embeddings inherit input class and are not anonymisation.
- Fixtures: `FX-RAG-01` … `FX-RAG-09`.

**Dependencies.** `PACK` (ADR-22) → `RAG-01/03` → `RAG-04` → `HYP` (ADR-21). `SPINE` (ADR-01/02) is a
hard prerequisite for §4's shortfall→tier mechanics. `LIFE` (ADR-03) is a hard prerequisite for
`RAG-05`. `WB-01/02` (ADR-19) are hard prerequisites for `WB-C9` and for `RAG-02`'s preregistration.
Per the cross-cutting spine rule, **no index card schedules before its contracts, deletion path,
coverage semantics, benchmark, and claim grammar exist** — L2/L3 cards start in
`BLOCKED_BY_DEPENDENCY`. **R**

---

## 10. Failure, rollback, and revisit

- **Failure mode: pack unreadable / checksum fail.** Refuse to open; composer abstains; ADR-24
  question of kind `evidence_gap`. No partial read. **R**
- **Failure mode: snapshot proved mutable.** If the end-of-task checksum re-assertion over the same
  snapshot fails, the snapshot was not immutable and every read taken from it is unattested: the
  task's results are **discarded**, not degraded and not reported with a limitation. A limitation
  would imply the output is usable-but-caveated; here nothing about it is known. **R**
- **Failure mode: registry-gate rejection storm.** Abort retrieval, abstain, and **return** the
  transient limitation set to the caller — the reader writes no findings (§3 Rule 4a). Never compose
  from the admissible remainder. **R**
- **Failure mode: ranking impossible (all dimensions degenerate).** The family drops below its
  minimum comparable dimensions; retrieval abstains and returns
  `RAG_RANKING_DIMENSION_DEGENERATE`. It never falls back to an arbitrary or insertion order,
  because an order nobody can justify is worse than no result. **R**
- **Failure mode: quota unfillable.** Documented in §4.3 — the claim degrades or abstains; it never
  ships as a deterministic-tier statement. **R**
- **Rollback.** The current state *is* the rollback state: L1 is unbuilt, and the deterministic
  product is complete and useful without it (see the status note at the top of this file). Once
  built, L1 is removable by deleting the retrieval module: the composer then has no evidence slots to
  fill and abstains everywhere — the deterministic *analysis* product (Atlas, Time Machine, Change
  River, Delivery Map, Coverage Cockpit, Query Lab) is untouched, because retrieval feeds only
  interpretation. L2/L3 are removable by deleting their index modules; L1 remains the fallback path
  that is always compiled in. **I** This satisfies principle 2's removability requirement at each
  rung, and it is testable today rather than at M7: any deterministic surface that would break if
  this module never existed is a critical-path violation.
- **Revisit triggers.** (a) L1 misses the preregistered Recall/counter-evidence floors on the frozen
  benchmark; (b) the registry gains a materially larger controlled vocabulary (making lexical matching
  meaningful); (c) an ADR-10 Tier-2 decision changes what may be templated; (d) a pack-format change
  invalidates the fingerprint scheme. Each reopens this document, not the code first.

---

## 11. Assumption register (with reversal paths)

- **A-RAG-1.** The claim-family → feature/coverage/limitation mapping is dense enough that a
  structured filter reaches the relevant rows for realistic questions. *Reason:* the corpus is
  registered codes and numbers, not prose. *Reversible by:* the §5 benchmark showing L1 below floor,
  which is exactly the L2 trigger.
- **A-RAG-2.** Completed packs, not the canonical store, are a sufficient retrieval corpus.
  *Reason:* the pack already carries the facts, features, coverage, insights, and (post-ADR-01)
  claims. *Reversible by:* G-RAG-4.
- **A-RAG-3.** Process-local indexes are sufficient for the L2/L3 research steps (no durable index is
  needed to evaluate them). *Reason:* benchmarks run inside one process over one pack.
  *Reversible by:* G-RAG-1 if measured build cost makes per-task rebuild impractical — and build cost
  must then be *measured*, not asserted.
- **A-RAG-4.** The default quota tuples in §4.1 are the right starting shape. *Reason:* they are the
  smallest numbers that force at least one falsifier channel and one coverage row into every claim.
  *Reversible by:* per-family preregistered override through the registry, never ad-hoc in code.
- **A-RAG-5.** Ranking-score suppression (never surfacing it) is enough to prevent it being read as
  confidence. *Reason:* it never reaches a `PresentationView`. *Reversible by:* if a UX card ever
  needs an ordering hint, it must be rendered as an ordinal position, not a score.
- **A-RAG-6.** Holding one immutable task-owned snapshot per retrieval task (open handles, or a copy
  where handle-stable reads are not guaranteed) is affordable at realistic pack sizes. *Reason:*
  packs are bounded, per-task, and read once. *Reversible by:* a **measured** pack-size distribution
  showing snapshot cost dominates — in which case the answer is a stronger handle or locking
  guarantee, or a content-addressed pack store, and never a return to verify-then-reopen-by-path.
- **A-RAG-7.** Ranking the whole eligible set is affordable below the working ceiling, and above it
  the deterministic total-order prefix is an acceptable degradation because it is *recorded*.
  *Reason:* a recorded, reproducible truncation is auditable; an unordered one is not.
  *Reversible by:* measured eligible-set sizes on realistic packs — a ceiling that binds routinely
  is a signal to narrow the filter through the registry, not to raise the ceiling silently.
- **A-RAG-8.** `evidence_id` is unique within a pack (**V**), which is sufficient for the
  same-build byte-identical guarantee. Cross-**rebuild** replay additionally needs a build-stable,
  content-derived `evidence_id`, which is **not** currently a documented property — the canonical
  dictionary specifies only pack-scoped opaque IDs that must resolve within the same pack.
  *Reason:* this design needs same-build determinism to be sound; cross-build determinism is a
  stronger property it would like but must not assume. *Reversible by:* `DL-PACK-01/02` declaring
  content-derived evidence IDs (as ADR-01 already does for **claim** IDs), at which point §1 L1
  step 1's caveat and §5.2 #14's cross-build arm are both promoted from "requirement on the pack
  contract" to **V**.
