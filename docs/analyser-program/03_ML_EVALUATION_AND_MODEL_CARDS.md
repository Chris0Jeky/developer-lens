# ML Evaluation, Benchmarks, and Model Cards — Developer Lens Intelligence Platform

Status: **Draft (planning artifact)** · 2026-08-04 · Operationalises **ADR-19** (workbench, registry,
promotion gates), **ADR-17** (change-point/motif lab), **ADR-18** (graph research), **ADR-20**
(retrieval ladder), and canonical **§9** (statistical/ML/graph catalog) and **§13** (ML/LLM test
layer).

Authority note: `docs/analyser-program/` is a **non-authoritative working proposal space**. Canonical
contracts live in `../DEVELOPER_LENS_V2_ARCHITECTURE.md`, `../data-charter.md`, and
`../source-capability-matrix.md`. Where this file appears to disagree with those, those win and the
disagreement is a defect in this file.

Labels: **V** verified repository fact · **D** documented platform fact · **R** recommendation ·
**I** inference · **A** assumption (with reversal path) · **REJ** rejected · **G** owner gate.

---

## 0. What this document is, and what it must never be read as claiming

**R0.1 — Nothing here is implementation-ready.** Per ADR-19, every candidate in the register is
`seeded`. This document specifies *how a candidate would be evaluated if someone later chose to build
the workbench*. It authorises no code, no model, no dataset, no capability activation, no
provider, and no schedule. P11 (`server/research/*`) remains "Not now" in canonical §14.

**R0.2 — Invented fixtures prove mechanics, never validity.** A frozen invented benchmark suite can
prove only these five things, and the promotion ladder must never be read as claiming more:

| Invented fixtures CAN prove | Invented fixtures CANNOT prove |
|---|---|
| Contract conformance — the candidate emits a well-formed `model_output` with resolvable evidence IDs | That the effect exists in real software systems |
| Mechanics — the estimator recovers a *planted* effect the generator deliberately inserted | That real effects resemble planted effects |
| Privacy — no prohibited field survives into any sink; deletion cascades run | That the privacy model holds against real-corpus re-identification |
| Failure handling — abstention, drift trip, timeout, censoring, degraded coverage | Calibration against real base rates |
| Removability — deterministic product is unchanged when the candidate is deleted | Practical usefulness or decision value |

A planted-effect recovery number is a **statement about the generator**, not about software systems.
Every model card below repeats this in its own words; the copy dictionary must forbid rendering a
`benchmarked`-tier result with any language implying empirical validity.

**R0.3 — The analytical subject is the software system.** No candidate may take a person, a
pseudonymous person, or any person-resolvable grouping as a unit of analysis, a covariate, a label,
a target, or a stratification key. `GH-PEOPLE-X` and `PERSON-METRIC-X` have no authorization path
(matrix §Rejected capabilities); this document adds none. Where an evaluation needs stratification,
it stratifies by **repository alias, time window, language, parser bundle, and workflow alias only**.

**R0.4 — Evidence semantics are one-way.** `observed → deterministic → modelled →
hypothesis/abstention`. A benchmark result is a property of a *method*, not evidence about a system.
A promoted model produces `modelled`-layer claims only (ADR-01 `claim.layer`), never observed facts,
and never a single persuasive confidence scalar (principle 7).

**R0.5 — Removability is a gate, not an aspiration.** Canonical §8 (deterministic analysis catalog)
is the complete product. Each card names the exact deterministic surface that remains when the
candidate is deleted, and the promotion gate includes a test that deletes the model and asserts zero
empty primary panels on the synthetic corpus (brief §5 "deterministic completeness").

---

## 1. Workbench governance

### 1.1 Promotion ladder (ADR-19, elaborated)

```
seeded ──(A)──> benchmarked(invented) ──(B)──> validated(consented, real) ──(C)──> shipped
   ^                    |                            |                            |
   └────────────────────┴──── demoted ───────────────┴────────────────────────────┘
```

| State | Meaning | Entry requirement | What may render in UI |
|---|---|---|---|
| `seeded` | A named research question with a deterministic baseline identified. | A dataset card and a model card **skeleton** exist; no tuning has occurred. | Nothing. Not even a "coming soon" affordance. |
| `benchmarked` | The candidate beat its deterministic baseline on a frozen invented suite under a preregistration. | Gate **A** below. | Nothing user-visible. Results are visible only inside the workbench and the registry. |
| `validated` | The candidate beat its baseline on a separately authorised, consented, representative **real** dataset with its own dataset card and an untouched final holdout. | Gate **B** below — **each instance is its own owner gate (G)**. | Nothing yet; `validated` is a precondition, not a licence. |
| `shipped` | The model produces `modelled` claims in the product. | Gate **C** below: canonical §9's eight conditions, all met at the exact head. | `modelled`-layer claims with layer badge, evidence, alternatives, falsifier. |
| `demoted` | Any gate later fails (drift trip, calibration failure, defect, revoked data). | Automatic on trip. | Claims disappear automatically because the UI resolves the registry (ADR-19). |

**Gate A — benchmarked.** (i) Preregistration record frozen and hashed *before* any tuning run;
(ii) frozen benchmark suite checksummed and its generator version pinned; (iii) primary metric beats
the deterministic baseline by at least the preregistered **minimum meaningful improvement (MMI)** on
the final invented holdout; (iv) the primary test survives BH-FDR control (§1.4); (v) abstention,
drift, resource, and privacy sub-gates all pass; (vi) removal test passes.

**Gate B — validated.** Everything in A, plus: a consented or curated-public real dataset exists
with its own dataset card, an explicit reviewed capability/consent revision, a retention and
deletion plan, release review, and its own untouched final holdout. **Invented fixtures can never
carry a candidate past `benchmarked`** — this is absolute. Constitution-v2 records that
per-candidate validation is eligible under the existing consent, charter, matrix, and release
gates (DL-Q-CONSENT); it does not assemble a dataset, activate a reader or model, or approve a
candidate. **Each Gate B instance still requires its own reviewed candidate task and proofs**, and
the task's holdout may not be reused.

**Gate C — shipped.** Canonical §9's eight conditions, restated as executable checks:
1. beats a deterministic baseline on the preregistered offline gate;
2. time- **and** repository-held-out evaluation (plus language holdout where labels are lexical);
3. reports calibration and uncertainty (interval or per-class, never one scalar);
4. detects coverage/schema/parser drift and trips to abstention;
5. explains inputs without source prose (controlled feature codes only);
6. abstains below the ADR-02 coverage-vector floors for its claim family;
7. falls back to the deterministic product with no empty panel;
8. carries no collaborator/person identity or human-value target.

**R1.1** A candidate may be **rejected outright at any tier**. `rejected_for_now` is a first-class
registry state with a recorded reason and the evidence that would reopen it. Rejection is a
successful outcome of the ladder, not a failure of it (ADR-20's ladder makes "vectors are not
justified" a measurable result; the same posture applies to every candidate here).

### 1.2 Preregistration record (frozen before tuning)

Proposed table `wb_preregistration` (**proposed**, additive to the P2 store, C1 by construction).
The record is hashed (SHA-256 over canonical-ordered fields) and the hash is stamped into every
result row; a result whose prereg hash is absent or mismatched is **not admissible evidence**.

| Field | Meaning | Rule |
|---|---|---|
| `prereg_id`, `candidate_id` | `pr_<sha256-prefix>`, `WB-C{n}` | Immutable. |
| `question` | One falsifiable sentence about a *system* property. | Must name no person concept. |
| `primary_metric` | **Exactly one** metric, with its estimator and its direction. | Secondary metrics are descriptive only and may never promote. |
| `minimum_meaningful_improvement` | Absolute improvement over the baseline that would change a product decision. | Stated in the metric's own units, with the decision it would change. Never "statistically significant". |
| `baseline_method_id@version` | The deterministic incumbent. | Must be a method that actually ships or is specified in canonical §8. |
| `feature_availability_time` | For every input feature, the earliest timestamp at which it is knowable **for the unit being predicted**. | Uses `times.observedAt`, never `times.occurredAt`, when the feature comes from a provider snapshot (provider lag is real). |
| `split_policy` | Rolling-origin outer folds; nested rolling-origin inner selection; purge and embargo lengths; grouping keys. | §1.3. |
| `final_holdout_spec` | Which fold/seed range/repository aliases are sealed. | Sealed by checksum; opened once. |
| `holdout_reuse_policy` | **A failed gate consumes the holdout.** | §1.5. |
| `abstention_rule` | Coverage-vector floors and sample gates that force abstention. | ADR-02 registered dimensions. |
| `drift_rule` | Which drift signals trip demotion. | §1.7. |
| `resource_budget` | Wall clock, peak RSS, process isolation, no network. | §1.8. |
| `privacy_classification` | Class of inputs, outputs, and any intermediate index. | Embedding inherits highest input class (principle 6). |
| `rejection_threshold` | The result that ends the candidate. | Must be stated *before* seeing results. |
| `analysis_plan` | Test statistic, multiplicity family membership, tie/NaN handling. | §1.4. Family membership is fixed at first preregistration and carried across every later wave; a successor candidate inherits its predecessor's family and its accumulated `m`. |
| `frozen_at`, `frozen_by_method_bundle` | Timestamp and workbench version. | Any change ⇒ new `prereg_id`, not an edit. |

### 1.3 Time-aware evaluation: rolling-origin with nested selection

**R1.2 — Outer loop: rolling origin.** Order units by `feature_availability_time`. For fold `k`,
train on `[t0, o_k)`, evaluate on `[o_k + embargo, o_k + embargo + h)`. Origins advance by a fixed
step; folds never shuffle; no fold ever trains on data later than its evaluation window. Minimum
5 outer folds, or the candidate is not evaluable and stays `seeded`.

**R1.3a — Baseline-tuning symmetry (2026-08-04 correction).** Any free parameter of the
deterministic baseline (e.g. WB-C1's median/MAD alert threshold) receives **identical** nested
selection to the candidate's — otherwise the comparison confounds "better method" with "more
tuning budget". A baseline with no free parameters runs as preregistered.

**R1.3 — Inner loop: nested rolling origin.** Hyperparameter and threshold selection happens *only*
inside each training prefix, using its own rolling-origin sub-folds. No selection statistic is ever
computed on an outer evaluation window. A single global threshold chosen from the whole series is a
leakage route (§1.6, L11), not a simplification.

**R1.4 — Purge and embargo.** Between train and evaluation windows, purge every unit whose feature
window overlaps the evaluation window, then embargo a further gap of at least the longest feature
lookback (e.g. a 12-week rolling median needs ≥12 weeks embargo). Rationale: coupling, cadence, and
coverage features are windowed, so adjacency alone leaks.

**R1.5 — Grouping.** Splits are grouped by **repository alias** (a repository never straddles
train/test), by **generator seed family** for invented data (near-duplicate fixtures never straddle),
and by **language** where labels are lexical. Report per-group results, never only the pooled number.

**R1.6 — Sample floors.** Canonical §9's per-family minimums are **evaluation-entry gates, not
production thresholds** (canonical §9 preamble). A candidate below its floor abstains from the whole
evaluation and stays `seeded` with `sample` recorded as the limiting dimension.

### 1.4 Multiplicity: the chosen false-discovery procedure

**R1.7 — Decision: Benjamini–Hochberg (BH) at q = 0.10 over the correction family's primary tests,
carried across waves.** Exactly as ADR-19 states ("Benjamini–Hochberg across the family's primary
tests"), made concrete:

1. **One primary test per candidate per promotion attempt.** Secondary metrics are reported but are
   never inputs to promotion. This is what keeps the family small enough to control.
2. **The family is the candidate-family, fixed at first preregistration and carried across waves**
   (2026-08-04 review correction): family membership is declared when a candidate is first
   preregistered and **never changes** — it cannot be redefined per attempt or per wave, `m ≥` the
   declared family size always, and a candidate submitting alone still carries the family's `m`. A
   promotion wave groups the tests actually *run*: it is a **scheduling unit, never a correction
   unit**. `q` is a property of the family, not of a wave. **What `m` denotes (clarified
   2026-08-04):** under the item-6(a) preallocation rule the operative BH denominator `m` is the
   family's **preregistered maximum size, fixed from the first test onward** — the *membership
   count* grows toward that maximum as successors join, but the denominator never changes and
   never shrinks below the declaration. A growing denominator is exactly the design item 6 voids.
3. **Procedure (BH step-up):** order the family's *p*-values ascending; let `i*` be the **largest**
   `i` with `p_(i) ≤ (i/m)·q`; reject H0 for **all tests of rank `1…i*`** (none if no such `i`
   exists); `q = 0.10` at `benchmarked` tier. (Corrected 2026-08-04: rejecting only rank `i*`
   inverts promotion ordering.)
4. **A rejected null is necessary but not sufficient**: the MMI on the point estimate must also be
   met. A statistically detectable improvement smaller than the MMI is **not** a promotion.
5. **Dependence.** Invented benchmark suites share generators, so the family's tests are positively
   dependent at best and of unknown structure at worst. **R:** at `benchmarked` tier BH is accepted
   (PRDS is plausible under shared generators, and the cost of a false promotion is bounded because
   nothing ships from `benchmarked`). At `validated` tier, where a false promotion can reach users,
   use **Benjamini–Yekutieli** at q = 0.10 (valid under arbitrary dependence) — the conservatism is
   the point. *Reversal path:* if a family's dependence structure is measured and shown PRDS, a
   reviewed change may drop back to BH for that family.
6. **Repeated promotion attempts across waves (2026-08-04 reconciliation).** A wave is a scheduling
   unit, so nothing about a wave may reset a correction. Otherwise a failed candidate could
   re-preregister into a later wave — possibly alone — and collect a fresh wave-level `q = 0.10`,
   accumulating uncontrolled false-discovery probability one wave at a time. Four rules bind, and
   they replace any informal "inflate `m` a bit" arrangement:

   - **(i) One primary promotion attempt per `candidate_id` per ladder tier.** A `candidate_id`
     that has opened its sealed holdout at a tier has spent its attempt at that tier (§1.5). There
     is no second primary test for the same `candidate_id` at the same tier, in any later wave.
   - **(ii) A materially new method or version is a NEW preregistered candidate that stays in the
     SAME correction family.** Changing the method, its feature set, its hyperparameter space, or
     its version by enough to justify re-testing produces a new `candidate_id`, a new `prereg_id`,
     and a new sealed holdout — and that successor is **permanently a member of its predecessor's
     family**. Family membership is fixed at first preregistration and carried across every later
     wave, so every predecessor attempt counts against the family's preallocated size whatever
     wave it ran in — the **membership count only ever grows toward the preregistered maximum,
     while the BH denominator stays fixed at that maximum** (see item 2 and the next paragraph).
     The lineage is recorded in the registry, never re-derived per wave.
     **Adaptive growth voids fixed-family BH (corrected twice, 2026-08-04 review rounds):**
     when a successor is introduced *because* its predecessor failed, the family size and the
     stopping rule depend on observed p-values, and neither the original BH decision **nor a
     recomputation after each addition** restores the promised FDR control (worked example:
     independent global-null tests at `q = 0.10` — the first rejects with probability 0.10; if it
     fails and a second is added, BH at `m = 2` contributes a further `0.90 × 0.05 = 0.045`,
     giving 0.145 overall). Therefore only two admissible designs exist for successors:
     **(a) preallocation** — the family's **maximum size is preregistered at its first
     preregistration**, every BH threshold is computed at that maximum `m` from the first test
     onward, and a successor beyond the preallocated size is rejected outright; or **(b) the
     (iv) online-FDR amendment** for genuinely adaptive streams. A retrospective
     recompute-and-demote sweep may still run as a *conservative cleanup* when a family is found
     mis-sized, but it is explicitly **not** a control guarantee and never licenses growth.
   - **(iii) Re-testing an unchanged candidate in a later wave is prohibited.** Same method, same
     version, same features, new wave is not a new candidate — it is the same test run again until
     it passes, which is exactly the search this procedure exists to control. Such an attempt is
     inadmissible and its result is not evidence (§1.2 prereg-hash rule).
   - **(iv) Online FDR only if formally specified.** An online false-discovery procedure (e.g.
     alpha-investing / LORD, spending an alpha-wealth budget over a stream of tests arriving in
     time) may replace the carried-family rule **only** when a dedicated **preregistration
     amendment** specifies the procedure, its initial wealth, its wealth/reward schedule, and the
     stream it applies to, frozen before the next test. Absent that amendment, the carried-family
     rule binds.

   **Attempt cap.** Attempts across a family lineage — the original `candidate_id` plus every
   successor admitted under (ii) — are capped at **three per lineage per tier** (law 11), and every
   one of them consumes the **same family `m`**. The third failure records `rejected_for_now` on
   the lineage; only a reviewed new-evidence decision reopens it. (Corrected 2026-08-04: without
   carried family membership and a cap, per-wave families would reset `m` and void both the FDR
   control and the termination guarantee.)
7. **Never** apply FDR control to secondary/exploratory metrics and then report the survivors as
   findings. Exploratory output is labelled exploratory and cannot enter a card's evidence section.

### 1.5 Final holdout custody ("no-holdout-reuse")

**R1.8** The final holdout is sealed at preregistration (checksum recorded, generator seed range
reserved) and may be opened **once**, at the gate decision, by a run that writes its result
immediately and irreversibly into `wb_result` (**proposed**) with the prereg hash.

- A **failed** gate **consumes** the holdout. The candidate cannot re-attempt on the same holdout.
  Re-attempt is admissible **only as a materially new candidate** under §1.4 item 6(ii) — a new
  `candidate_id` with a *new* preregistration and a *new* sealed holdout (new generator seed range,
  or for real data a new consented slice — which is a new owner gate) — and that successor stays in
  its predecessor's correction family. Re-running the *unchanged* candidate in a later wave is
  prohibited outright (§1.4 item 6(iii)).
- A **passed** gate also consumes it: post-promotion monitoring uses drift monitors and fresh data,
  never the holdout.
- Accidental opening (a script reading the sealed range) is a **CI-blocking defect** and marks the
  holdout consumed. The workbench harness must make this hard: sealed ranges live behind an explicit
  `open_final_holdout(prereg_id)` call that logs a `lineage_event` (ADR-01) and refuses a second call.
- **Proposed limitation code `WB_HOLDOUT_CONSUMED`** renders wherever a candidate's card is shown
  after a consumed-and-failed gate.

### 1.6 Leakage-route checklist (every card must tick every row)

| # | Route | Concrete failure in this product | Required control |
|---|---|---|---|
| L1 | Future evidence in features | Using a PR's `merged_at` to build a feature predicting its own integration outcome | `feature_availability_time` per feature; automated check that no feature timestamp ≥ unit's prediction time |
| L2 | Provider-lag leakage | Using `occurredAt` when only `observedAt` was knowable (attribution lags, canonical `GH-CONTRIB-01`) | Features derive availability from `times.observedAt` for provider sources |
| L3 | Coverage leakage | The planted change is also planted in the coverage series, so the model learns the coverage signal | ADR-17 joint coverage-series evaluation; a candidate that only fires where coverage shifts is `coverage_shift_candidate`, not a detection |
| L4 | Label leakage from the generator | Model recovers the seed, not the effect (e.g. planted magnitude correlated with fixture ID ordering) | Seed–label independence test in the dataset card; shuffled-label control run must score at chance |
| L5 | Repository leakage | Same repository alias in train and test | Grouped splits by repository alias (§1.5) |
| L6 | Language leakage | Lexical classifier memorises one language's conventions | Language holdout for WB-C2/C3/C8 |
| L7 | Parser-version leakage | Parser bundle major change correlates with era labels, so "architecture change" = instrument change | ADR-07 comparability: equal parser major required; parser version is a *stratifier*, never a feature |
| L8 | Normalisation leakage | z-scoring/standardising over the full series before splitting (affects ADR-20's standardized-distance ranking) | Fit scalers inside the training prefix only |
| L9 | Censoring leakage | Survival eligibility defined using the event that is being predicted | Risk-set construction reviewed; right-censoring recorded at window end, never dropped |
| L10 | Duplicate/near-duplicate leakage | Two fixtures from the same seed family straddle folds | Seed-family grouping; near-duplicate detection over controlled feature vectors |
| L11 | Threshold/selection leakage | Alert threshold chosen on the full series (§1.3) | Nested selection only |
| L12 | Holdout reuse | Tuning against the final holdout | §1.5 custody |
| L13 | Retrieval index leakage | Index built over documents that include the evaluation queries or their answers | Index build excludes the query set; deletion proof re-run after each fold |
| L14 | Correction/lineage leakage | Using superseded/corrected claims that only exist after the prediction time | Claim `superseded_by` and `lineage_event` respected in feature construction |
| L15 | Retention leakage | C3 rows expire (90d), so re-runs silently see different data and results drift | Benchmarks run on invented C0 fixtures with no retention clock; real-data runs record the retention state as coverage |
| L16 | Person-shaped leakage | Any feature that reconstructs identity, schedule, or attendance | **Not a leakage fix — a rejection route.** Proxy/composition review (ADR-14) applied to the candidate's whole feature set and to plausible combinations |

### 1.7 Drift detection and automatic demotion

Every shipped candidate declares drift monitors. Tripping any monitor moves it to `demoted` and its
claims vanish (registry-resolved). Monitors, all C1:

- **Input drift**: population stability of the controlled feature vector vs the training window.
- **Coverage drift**: any ADR-02 dimension crossing the family's floor (`completeness`,
  `parser_coverage`, `comparability`, `censoring`).
- **Schema/method drift**: `schema_version`, `parser_bundle_version` major, connector version, or
  feature `@version` change touching an input ⇒ automatic abstention until re-benchmarked.
- **Calibration drift**: rolling calibration error above the preregistered ceiling.
- **Volume drift**: eligible sample below the family's display gate.

**R1.9** Drift trips are **fail-closed**: abstain first, investigate second. A trip writes a
`data_quality_finding` and a `lineage_event`, never a silent fallback.

### 1.8 Resource budgets and workbench isolation

**R1.10** Research runs execute in the same isolation posture as the parser worker (ADR-06): one
isolated process, **no network**, no shell, no repository executables, bounded input/time/memory/
output, stdout/stderr disabled, crash recorded as coverage. Default budgets per candidate run over
the reference invented corpus (**A**, revisable by measurement): ≤ 5 min wall clock, ≤ 1 GiB peak
RSS, ≤ 2 cores, ≤ 200 MiB emitted artifacts. A candidate that cannot meet its budget is not
"slow" — it is **rejected for cost** unless a card justifies a raised budget with a decision it
changes. No candidate may require a GPU, a download, or a model weight fetched at runtime.

### 1.9 Registry mechanics

`model_registry` (ADR-19) rows carry: `method_id`, `method_version`, `candidate_id`,
`promotion_state`, `prereg_id`, `dataset_card_id`, `model_card_id`, `gate_evidence_ids`,
`abstention_rule_id`, `drift_monitor_ids`, `fallback_method_id`, `privacy_class_ceiling`,
`resource_budget`, `demoted_reason`, `superseded_by`. Invariants (**R**, testable):

1. A `claim` with `layer='modelled'` **must** join to a registry row in state `shipped`. A demoted
   model's claims cannot render — enforced by the query path, not by cleanup.
2. Registry state transitions are append-only with `lineage_event` rows.
3. Deleting a registry row's dataset (revocation) cascades to its results and any model outputs
   (ADR-03 enumeration from the schema registry).
4. No registry row may reference a capability in a state other than `active` at claim time.

---

## 2. Card templates

### 2.1 Dataset card template (invented benchmark = generator parameters)

**R2.1 — For invented suites, the generator parameters *are* the dataset card.** A frozen suite is
`{generator_id@version, parameter set, seed range, checksum}`; regenerating from the same tuple must
reproduce byte-identical fixtures, or the suite is not frozen.

```
dataset_card:
  dataset_id:           BENCH-WB-C{n}.v1            # proposed ID style
  kind:                 invented | consented_real
  generator_id:         gen.wb.<family>.v1          # proposed
  generator_version:    <semver>                    # bump ⇒ new dataset_id
  seed_range:           [lo, hi]                    # final holdout sub-range sealed separately
  checksum:             sha256:...                  # over emitted fixture files
  units:                what one row is (never a person)
  planted_effects:      list of {effect_kind, magnitude, location, prevalence}
  nuisance_processes:   seasonality, trend, heteroscedasticity, missingness, coverage shifts
  negative_controls:    fixtures with NO planted effect (required, ≥30% of units)
  confound_controls:    fixtures where a coverage/parser shift mimics the effect (required)
  class_balance:        per-class support, including `unknown`
  privacy_class:        C0 for invented; real datasets carry their true class
  known_limitations:    explicit list, always including "planted effects are not real effects"
  not_represented:      what the generator deliberately does not model
  consent_ref:          null for invented; capability + consent_revision for real
  retention_deletion:   invented = tracked test asset; real = capability cascade (ADR-03)
```

**R2.2 — Negative controls and confound controls are mandatory.** A suite without no-effect fixtures
cannot measure false alarms; a suite without coverage/parser-shift confounders cannot separate system
change from instrument change (ADR-07, ADR-17). Both are gate-A blocking.

### 2.2 Model card template

```
model_card:
  card_id / candidate_id / method_id@version / promotion_state / prereg_id
  1  task                    # one falsifiable question about a system
  2  deterministic_baseline  # the incumbent it must beat, by ID
  3  benchmark_design        # dataset_card ref + planted-effect parameters
  4  metrics                 # primary (one) + secondary (descriptive) + holdout axes
  5  abstention_rule         # coverage-vector floors, sample gates, tie behaviour
  6  drift_detection         # monitors + trip action
  7  resource_budget         # wall clock, RSS, isolation
  8  privacy_classification  # inputs, outputs, intermediates, index (if any)
  9  rejection_threshold     # the result that ends the candidate
  10 removal_fallback_path   # what remains when deleted; which panels rely on it
  11 explainability          # controlled feature codes, evidence IDs, alternatives, falsifier
  12 proxy_composition_review# ADR-14 checklist outcome for the feature set and combinations
  13 owner_gates             # what would need a new owner decision
```

### 2.3 Reading the cards below

Every card is a **skeleton**: fields are specified, thresholds are proposed (**R**/**A**), and no
result exists. Numeric gate values marked **A** are assumptions with the reversal path "measure on
the frozen suite and re-preregister". All benchmark data is **C0 invented** (ADR-19).

---

## 3. Candidate model cards WB-C1 … WB-C9

### WB-C1 — Change-point detection over weekly system series

- **Task.** Given a weekly C1 system series (release intervals, CI outcome mix, integration-duration
  quantiles, composition shares), locate structural change points with an interval, and say when
  there is none.
- **Deterministic baseline.** ADR-17 rung 2: rolling median/MAD residual alerts with preregistered
  thresholds and a **false-alert budget expressed per year of observation**. Candidates: **BOCPD**
  (Bayesian **online** change-point detection) and **PELT** (**offline** whole-series segmentation)
  (canonical §9). Proposed method IDs `mth.wb.cp.bocpd.v0`, `mth.wb.cp.pelt.v0` (**proposed**).
  **The two are not scored on the same metrics** — see *Evaluation arms* below.
- **Benchmark design (dataset card `BENCH-WB-C1.v1`, proposed).** Generator
  `gen.wb.series.v1` emits ≥ 400 series × 260 weeks. Planted-effect parameters: change kind
  {level, variance, trend-slope, seasonal-amplitude}; magnitude in robust-σ units
  {0.5, 1, 2, 4}; count per series {0, 1, 2, 3}; minimum separation {8, 26} weeks; noise
  {gaussian, heavy-tailed t(3), count/Poisson}; seasonality {none, weekly-of-year, annual};
  missingness {0, 5, 20}% MCAR and **block** missingness; and — critically — **coverage-shift
  confounders**: permission loss, `GH_ACTIONS_FILTERED_1000_CAP` truncation,
  `GIT_SHALLOW_BOUNDARY`, and parser-major changes planted *without* a system change. ≥ 30% of
  series carry **no** change point (negative controls).
- **Evaluation arms (2026-08-04 correction — offline methods get offline metrics).** PELT segments a
  **whole series at once**: every reported boundary is a function of *all* observations, including
  those after the boundary itself, so an offline fit **has no causal alert time**. Scoring PELT on
  an online alert metric — false alarms at a fixed detection-delay budget, or onset-to-alert delay —
  would read future observations into a quantity defined as "when would a user have been warned".
  That is leakage (§1.6, L1), not a conservative approximation, and it would also make the
  candidate comparison dishonest by crediting an offline method with online performance. The card
  therefore runs two arms whose metrics are **never pooled**:
  - **Online arm (the promotion arm): baseline median/MAD vs BOCPD only.** Scored on the online
    alert operating point — false alarms per year of observation at a fixed detection-delay budget,
    with onset-to-alert delay as its descriptive companion. **PELT does not enter this arm.**
  - **Offline arm (descriptive): PELT vs the baseline's alert positions read as boundary
    estimates** (the deterministic baseline is an alerter, so its localisation output is defined as
    the set of alert weeks; that definition is preregistered). Scored on **localisation only** —
    boundary distance to the nearest planted change index, a covering / segmentation-error metric
    against the planted segmentation, and segment-count error against the planted count. **No alert
    time, no detection delay, and no false-alarms-per-year is computed for PELT.**
  - *Optional causal wrapper (not run unless separately preregistered).* If an alert-delay
    comparison of PELT is ever wanted, it runs **only** inside an explicitly specified
    **repeated-prefix causal wrapper**: for each week `t`, refit PELT on the prefix `[t0, t]` alone;
    the alert time for a planted change is the first prefix whose **final-segment boundary** falls
    within a preregistered tolerance of that change index **and persists** across `p` consecutive
    subsequent prefixes. The refit schedule, the tolerance, and `p` must all be written into the
    preregistration before any run, and the wrapper's cost binds §1.8. Absent that specification,
    **no PELT alert-delay or false-alarm number is admissible evidence.**
- **Metrics (mission-specified).** *Primary (exactly one, §1.2):* **false alarms per year of
  observation** at a fixed detection-delay budget, **on the online arm (baseline vs BOCPD)** — the
  product's cost is a user chasing a phantom turning point. *Secondary (descriptive, never
  promoting):* on the online arm, **onset-to-alert delay** distribution (weeks from true onset to
  alert) and **interval calibration** (empirical coverage of the reported change-location interval
  at nominal 80/95%); on the offline arm, **localisation error** (boundary distance / covering
  metric against the planted change indices) and segment-count error; and across both arms, power
  by magnitude and the **coverage-confound false-alarm rate** (fires on a planted coverage shift
  with no system change — an alert rate on the online arm, a spurious-boundary rate on the offline
  arm) — this last one is *reported separately and has its own hard ceiling*. Holdouts: time
  (rolling origin) and generator-seed family.
- **Abstention rule.** Abstain unless `completeness ≥ 0.8`, `comparability = 1`, `calibration ≠ null`
  (ADR-02 worked example), ≥ 52 weekly observations (canonical §9), and the window is free of an
  overlapping coverage transition; otherwise emit `coverage_shift_candidate` or an abstention claim
  with the limiting dimension named.
- **Drift detection.** Series-length/coverage drift; seasonality regime change; connector version
  change touching the input feature; calibration drift on interval coverage.
- **Resource budget.** §1.8 default; PELT is O(T)–O(T²) method-dependent (canonical §9) so the
  budget binds the penalty search, not the other way round. A preregistered repeated-prefix wrapper
  multiplies that cost by the number of prefixes and must fit the **same** budget.
- **Privacy.** Inputs C1 weekly aggregates; outputs C1 modelled claims; no C2/C3 needed. Time grain
  floor: **ISO week** (ADR-14) — no candidate may request finer grain to improve detection.
- **Rejection threshold.** Reject if **BOCPD** cannot beat median/MAD on the primary metric — false
  alarms/year at the fixed detection-delay budget on the online arm — by the MMI (**A**: MMI = 1.0
  fewer false alarms per year at equal detection delay), **or** if its coverage-confound
  false-alarm rate exceeds the baseline's, **or** if interval calibration is worse than nominal by
  more than 10 percentage points (**A**). The offline arm cannot trigger promotion: PELT's
  localisation result is descriptive under this preregistration, and promoting PELT would require
  its own preregistration naming a **localisation** primary metric — a new candidate inside the
  **same** correction family (§1.4 item 6(ii)).
- **Removal/fallback.** Delete ⇒ ADR-17 rung 2 residual alerts remain; the Pattern Lens and Era
  Comparator still render deterministic transition counts and era boundaries from policy/CI
  transitions and user annotation (ADR-07). No empty panel.

### WB-C2 — Change-intent classifier (over ephemeral commit subjects)

- **Task.** Assign a controlled change category {maintenance, feature, test, docs, refactor, fix,
  migration, config, dependency, revert, unknown} to an ephemeral commit subject, aggregating to
  `DL.CHANGE.INTENT_MIX.v1`.
- **Deterministic baseline.** ADR-10 tier-1 rule families: conventional-commit parsing plus
  language-agnostic rule families, `unknown` otherwise. This baseline **ships**; the classifier must
  beat it or die.
- **Benchmark design (`BENCH-WB-C2.v1`, proposed).** Generator `gen.wb.subjects.v1` emits ≥ 2,000
  **invented** subjects with owner-defined ground-truth labels, ≥ 50 per class (canonical §9), across
  ≥ 8 natural languages and ≥ 5 convention regimes (strict conventional-commit, loose, none, mixed,
  bot-generated). Planted parameters: label prior skew {uniform, realistic-skewed}; ambiguity rate;
  multilingual share; injection-like and adversarial strings; empty/very long subjects; revert/fixup
  forms (matching canonical `GIT-SEM-01` fixtures). Negative controls: subjects whose true label is
  genuinely `unknown`.
- **Metrics (mission-specified).** *Primary:* **macro-F1** across the controlled categories including
  `unknown`. *Secondary:* **per-class support** (always reported alongside per-class F1 — a class
  with support < 50 is reported as unevaluable, not as a number), **calibration error** (ECE and a
  reliability diagram over the predicted-class probability), **selective risk** (risk–coverage curve;
  the abstention policy is evaluated, not assumed), and holdouts on **repository alias, time, and
  language**. Never any author/committer feature (canonical §9: "no commit author features").
- **Abstention rule.** Predict `unknown` when max class probability < the nested-selected threshold;
  abstain at aggregate level below `≥20` subjects and `≥80%` parser completion
  (`DL.CHANGE.INTENT_MIX.v1` gates).
- **Drift.** Language/convention drift, model version, `unknown` share moving beyond the training
  band.
- **Resource budget.** §1.8; local-only model (canonical §9 "local model only initially"). No
  external provider — G4's boundary is the hypothesis composer, not a classifier, and proposing
  otherwise would be outside authority.
- **Privacy.** Input subjects are **C4, destroyed in-process**; only category counts and classifier
  version persist (C1). Any durable text embedding, cache of subjects, or model fine-tuned on
  subjects is **outside the charter** — a Tier-2 owner gate (ADR-10), not an assumption. **G**
- **Rejection threshold.** Reject if macro-F1 improvement over rules < MMI (**A**: +0.05 macro-F1)
  on the sealed holdout, or calibration error > 0.10 ECE (**A**), or if the gain vanishes on the
  language holdout (i.e. it learned English conventions).
- **Removal/fallback.** Delete ⇒ rule families produce the mix with a larger `unknown` share, which
  is honest and already the shipped behaviour.

### WB-C3 — CI failure-family classifier (metadata-only) — *likely reject*

- **Task.** Assign a coarse failure family to a failed CI attempt using **metadata only** (attempt
  index, queue/exec durations, conclusion transitions, matrix/concurrency presence classes, workflow
  alias, timing shape).
- **Deterministic baseline (2026-08-04 correction — the baseline must classify).** macro-F1 is a
  **per-run** metric, so the baseline must emit **one family label per failed run**. Two classifying
  baselines are preregistered, and the **stronger of the two on the sealed holdout** is the
  comparison baseline:
  1. `mth.wb.ci.majority.v0` (**proposed**) — **majority-class classifier**, fitted on the training
     prefix only, assigning every run that prefix's most frequent family. This is the floor: it
     measures whether the candidate learns anything at all beyond the class prior.
  2. `mth.wb.ci.metarule.v0` (**proposed**) — **deterministic metadata rule classifier**: fixed,
     preregistered rules over the same metadata-only features (attempt index, conclusion/attempt
     transitions, queue-vs-exec duration shape, timeout-shaped durations, matrix/concurrency
     presence class, workflow alias, truncation flags), with an explicit `unknown` default. Its
     thresholds receive the **same** nested selection as the candidate's (R1.3a).

  Taking the **stronger** of the two is not a tuning choice and does not reuse the holdout: both
  baselines are preregistered, both are scored inside the *same single* holdout opening (§1.5), and
  the rule strictly raises the bar the candidate must clear.

  The shipped aggregate surfaces — `DL.CI.OUTCOME_MIX.v1`, `DL.CI.RERUN_RATIO.v1`,
  `DL.CI.RECOVERY_TRANSITION_RATIO.v1` — remain the **descriptive product context** and the removal
  fallback, but they emit portfolio-level distributions and assign **no per-run label**, so they are
  **explicitly not the evaluation baseline**: a macro-F1 "against them" is undefined, not merely
  hard to compute.
- **Benchmark design (`BENCH-WB-C3.v1`, proposed).** Generator `gen.wb.ci.v1` emits ≥ 500 failed runs
  with ≥ 50 per family and **owner-approved invented labels**. Planted parameters: family prior;
  metadata separability parameter (the deliberately tunable knob: how much signal the *metadata*
  carries about the family, from 0 to strong); label-noise rate (weak labels are the expected
  reality); workflow heterogeneity; matrix fanout; rerun/recovery patterns; truncation at
  `GH_ACTIONS_FILTERED_1000_CAP` and `GH_CHECK_SUITES_1000_CAP`.
- **Metrics.** *Primary (exactly one, §1.2):* **macro-F1 against the named classifying baseline** —
  the stronger of `mth.wb.ci.majority.v0` and `mth.wb.ci.metarule.v0` on the sealed holdout, both
  scored per run over the same label set. *Secondary:* per-class support, calibration error,
  selective risk, repository/time/workflow-alias holdouts, and the macro-F1 of each classifying
  baseline reported separately. **A separability sweep is mandatory**: report macro-F1 as a
  function of the planted separability parameter, because the honest answer is probably "metadata
  does not carry the label".
- **Abstention rule.** ADR-02 floors plus `≥10`–`≥20` CI sample gates from the dictionary.
- **Drift.** Workflow drift (canonical §9), runner-class mix, schema.
- **Resource budget.** §1.8.
- **Privacy.** C3 source facts → C1 aggregates. **Logs, artifacts, caches, annotations, step names,
  and job names remain prohibited (`RAW-CONTENT-X`).** Canonical §9 is explicit: *if metadata is
  insufficient, reject rather than request logs.* This card inherits that as a hard rule.
- **Rejection threshold.** **Reject if the named classifying baseline is unbeaten by the MMI**
  (**A**: +0.05 macro-F1 over the stronger of `mth.wb.ci.majority.v0` / `mth.wb.ci.metarule.v0` on
  the sealed holdout) — and reject permanently rather than escalating the input class. Also reject
  if the gain exists only at high planted separability with no evidence that real metadata is
  separable.
- **Removal/fallback.** Delete ⇒ CI Studio renders attempt-aware outcome/rerun/recovery
  distributions, which is the shipped product (context, not the evaluation baseline — see above).
  Wording rules bind regardless (rerun ≠ flaky, failure ≠ poor quality — ADR-15).

### WB-C4 — Sequence/motif discovery

- **Task.** Find recurring ordered patterns in controlled system event codes (e.g. ready → check
  failure → head move → approval → merge → release) that are stable across time.
- **Deterministic baseline.** n-gram and event-transition counts (ADR-17, canonical §9).
- **Benchmark design (`BENCH-WB-C4.v1`, proposed).** Generator `gen.wb.sequences.v1` emits ≥ 20
  eligible sequences totalling ≥ 200 ordered events (canonical §9 floor) and, for power, a large
  arm at 10× that. Planted parameters: motif alphabet size; planted motif length {3, 5, 8};
  planted motif prevalence {1, 5, 20}%; background transition matrix entropy; insertion/deletion
  noise rate; time-varying motif prevalence (so time-held-out stability is measurable); and
  distractor motifs that appear only in one era.
- **Metrics.** *Primary:* **planted-motif recovery** — precision/recall over the planted motif set at
  a fixed report size — against the n-gram baseline. *Secondary:* **time-held-out stability**
  (Jaccard of the discovered motif set across time folds), false-discovery count on
  motif-free negative controls, and per-motif support. Holdouts: time and repository alias.
- **Abstention rule.** Suppress motifs below support gates; abstain entirely below the §9 floors;
  never render a motif whose support comes from a single repository alias (sparse suppression).
- **Drift.** Source/schema drift changing the event alphabet (canonical §9); alphabet version is part
  of the method version.
- **Resource budget.** §1.8; bounded suffix/tree mining (canonical §9) — an unbounded miner is
  rejected for cost.
- **Privacy.** Controlled event codes only (C1). No prose, no identity, no per-person sequence —
  **a sequence is a property of a change system, never of an actor**. Proxy review must confirm the
  motif alphabet cannot reconstruct a schedule.
- **Rejection threshold.** Reject if recovery does not beat n-grams by the MMI (**A**: +0.10 F1 at
  equal report size) or if time-held-out stability < 0.5 Jaccard (**A**) — an unstable motif set is
  a random-pattern generator with a nice UI.
- **Removal/fallback.** Delete ⇒ transition counts remain (canonical §9 fallback).

### WB-C5 — Dynamic communities and graph embeddings

- **Task.** Detect module/repository community structure and its change across comparable snapshots
  (ADR-18); optionally embed graphs for similarity.
- **Deterministic baseline.** SCC/components, degree and fan-in/out distributions, density, simple
  centralities **of modules/repositories only** (`DL.ARCH.CYCLE.v1`, ADR-18 baseline).
- **Benchmark design (`BENCH-WB-C5.v1`, proposed).** Generator `gen.wb.graphs.v1` emits ≥ 4
  comparable snapshots × ≥ 20 opaque nodes (canonical §9 floors), plus a larger arm. Planted
  parameters: **planted-partition** model with within/between edge probabilities (mixing parameter
  µ ∈ {0.1 … 0.6}); community count and size skew; node split/merge events between snapshots
  (matching ADR-07 continuity fixtures); edge noise; **parser-coverage loss** planted independently
  (nodes missing because a grammar failed, not because the system changed); and parser-major changes
  that must render as *incomparable eras*, never as drift.
- **Metrics (mission-specified).** *Primary:* **planted-structure recovery** — adjusted mutual
  information / adjusted Rand index against the planted partition — versus the SCC/components
  baseline on the same task. *Secondary:* **seed stability** (agreement across ≥ 20 seeds; a
  community that moves with the seed is not a finding), **snapshot sensitivity** (partition change
  under a 1-node perturbation and under planted parser-coverage loss), sparse-suppression compliance,
  and per-snapshot support.
- **Abstention rule.** Abstain when `parser_coverage` or `comparability` fails the family floor; never
  emit a community below the sparse-suppression gate; **semantic labels are never asserted from
  structure alone** (ADR-18) — a community renders as an opaque cluster with its evidence, never as
  "the auth layer".
- **Drift.** Graph/parser drift (canonical §9); parser bundle major ⇒ new era, not a delta.
- **Resource budget.** §1.8; canonical §9 warns of potentially high memory — spill to SQLite/Parquet
  (canonical §12) rather than raising RAM.
- **Privacy.** C3 graph, C1 summaries. **Schema-enforced: no people nodes** (ADR-18). Embeddings
  inherit the highest input class — a module-graph embedding is **C3**, never anonymisation
  (principle 6). Any durable embedding index is a separately reviewed sink. **G**
- **Rejection threshold.** Reject if AMI improvement over baseline < MMI (**A**: +0.10 AMI at
  µ = 0.3), or seed stability < 0.8 (**A**), or if planted parser-coverage loss changes the partition
  more than a real planted split does (instrument beats system ⇒ unusable).
- **Removal/fallback.** Delete ⇒ SCC/components and degree distributions remain (ADR-18 baseline).

### WB-C6 — Time-to-event with censoring (queues and integration)

- **Task.** Model time-to-integration / time-to-first-signal / time-to-recovery **as queue
  properties of the system**, with right-censoring for open and abandoned tails (ADR-12).
- **Deterministic baseline.** **Kaplan–Meier** survival curves plus the empirical completed/censored
  distributions (canonical §9); ECDF/quantiles with eligible and censored counts (ADR-12 —
  "no means without distribution"). Candidates: Cox PH, AFT, only with ≥ 100 events and ≥ 10 events
  per parameter, censoring-aware (canonical §9).
- **Benchmark design (`BENCH-WB-C6.v1`, proposed).** Generator `gen.wb.survival.v1` emits ≥ 100
  events per arm. Planted parameters: baseline hazard shape {exponential, Weibull increasing,
  Weibull decreasing, bathtub}; **censoring mechanism** {administrative at window end, random
  right-censoring at rate 10/30/50%, and **informative censoring** — abandoned PRs whose censoring
  depends on the covariate}; covariate set restricted to **system** covariates (change surface
  quartile, workflow alias, batch position, queue depth, draft/ready transitions) — **never a person
  covariate** (canonical §9); planted proportional-hazards **violations** (crossing hazards) so the
  assumption check is actually exercised; and truncation at provider caps.
- **Metrics (mission-specified).** *Primary (exactly one, §1.2 — 2026-08-04 correction):* **IBS
  (integrated Brier score) improvement over the KM baseline**, computed under the correct censoring
  weights (IPCW) over a preregistered horizon grid. *Secondary (descriptive, never promoting):*
  **time-dependent concordance** — reported for discrimination context only, and explicitly **not** a
  promotion criterion — **censoring accounting** (eligible/censored counts reported on every curve;
  a metric computed after dropping censored units is a defect, not a result), **assumption checks**
  (Schoenfeld-style proportional-hazards diagnostics with the planted violation detected),
  calibration of predicted survival at fixed horizons, and repository/time holdouts.
- **Abstention rule.** Abstain below ≥ 100 events / ≥ 10 events-per-parameter; abstain when the
  censoring share exceeds the preregistered ceiling; abstain when the PH check fails and no AFT
  alternative was preregistered. Display gates from `DL.PR.INTEGRATION_DURATION_H.v1` (`≥5` events
  plus censored count) still bind the rendered surface.
- **Drift.** Workflow drift (canonical §9); censoring-share drift; queue-policy transitions
  (merge-queue/auto-merge availability changes are era boundaries, not covariates to absorb).
- **Resource budget.** §1.8.
- **Privacy.** C1 features, C2 supporting facts. **Copy rule (ADR-12): every latency is a
  system/queue property; the schema has no reviewer/author dimension and the copy dictionary has no
  per-person formulation.** A survival model here must never be describable as "how fast someone
  responds".
- **Rejection threshold.** Reject if the **primary metric** — IBS improvement over KM — is below the
  MMI (**A**: 10% relative IBS reduction), or if that IBS improvement disappears under informative
  censoring, or if any covariate proposed is person-resolvable (immediate rejection, not a tuning
  problem). A favourable time-dependent concordance **cannot** rescue a failed IBS gate: the
  promotion gate reads the primary metric and nothing else.
- **Removal/fallback.** Delete ⇒ KM curves and empirical censored distributions remain — already the
  shipped ADR-12 surface.

### WB-C7 — Probabilistic observability (missingness), *never activity*

- **Task.** Predict whether the *next* collection attempt for a capability×scope will yield complete
  evidence — i.e. model the **instrument**, not the system.
- **Deterministic baseline.** The explicit coverage ledger itself: current coverage state and its
  recent history (canonical §9 baseline).
- **Benchmark design (`BENCH-WB-C7.v1`, proposed).** Generator `gen.wb.observability.v1` emits
  ≥ 500 collection outcomes across repeated probes (canonical §9 floor). Planted parameters:
  permission-transition process (grant/revoke/SAML/plan changes producing
  `PERMISSION_AMBIGUOUS_404`); rate-limit and truncation events (`GH_SEARCH_1000_CAP`,
  `GH_ACTIONS_FILTERED_1000_CAP`, `GH_CHECK_SUITES_1000_CAP`); provider censoring
  (`GH_DEPLOY_STATUS_90D_CENSOR`); Git boundaries (`GIT_SHALLOW_BOUNDARY`,
  `GIT_PARTIAL_OBJECT_MISSING`); staleness and retry outcomes; and a deliberate **decoy**: an
  activity process correlated with observability, to test that the model is not repurposed as an
  activity predictor.
- **Metrics.** *Primary:* **Brier score** for next-probe completeness against the coverage-ledger
  baseline. *Secondary:* calibration (reliability curve, ECE), per-limitation-code breakdown,
  capability/time holdouts, and a **decoy test** with a concrete preregistered ceiling
  (2026-08-04 correction — a reject criterion must be able to fail): an adversary given the
  model's observability predictions must not reconstruct the planted activity process better than
  **AUC ≤ 0.55 at N = 1,000 probe windows** (same form as `04` §5.2 #10); above the ceiling the
  candidate is rejected outright.
- **Abstention rule.** Abstain when probe history is below floor or when a capability's consent state
  changed inside the window (state change ⇒ new regime).
- **Drift.** Permission/plan drift (canonical §9), connector version, provider API version.
- **Resource budget.** §1.8 (trivially met).
- **Privacy.** C1/C2 (canonical §9). Output is a **coverage** annotation, never an activity claim;
  the copy dictionary must have no phrasing where low predicted observability reads as low activity —
  that would be "absence is zero" laundered through a model (principle 4).
- **Rejection threshold.** Reject if Brier improvement over the ledger baseline < MMI (**A**: 15%
  relative), or if the decoy test shows activity reconstruction above the ceiling — the latter is a
  **hard** reject regardless of accuracy.
- **Removal/fallback.** Delete ⇒ direct coverage state (canonical §9 fallback), which is what the
  Coverage Cockpit renders anyway.

### WB-C8 — Architecture-change classifier

- **Task.** Classify a snapshot-to-snapshot architecture delta into controlled change classes
  (e.g. {module split, module merge, layer introduction, cycle formation, cycle removal,
  API-surface expansion, API-surface contraction, no material change}).
- **Deterministic baseline.** Threshold rules over `DL.ARCH.API_SURFACE_DELTA.v1`,
  `DL.ARCH.CYCLE.v1`, `DL.ARCH.TEMPORAL_COUPLING.v1` and the ADR-07 era diff.
- **Benchmark design (`BENCH-WB-C8.v1`, proposed).** Generator `gen.wb.arch.v1` emits ≥ 500 labelled
  changes across ≥ 10 invented systems (canonical §9 floors). Planted parameters: change class prior;
  change magnitude; **module continuity** ground truth (planted splits/merges, so ADR-07's
  content-overlap matching is measured, not assumed); parser-coverage loss planted independently;
  **parser bundle major changes planted with no system change** (the instrument-drift confounder —
  fixture set **(a)** below) **and equal-major grammar-bundle minor/patch drift planted with no
  system change** (fixture set **(b)** below); language mix; monorepo boundary count; and
  vendored/generated share.
- **Parser-drift fixture split (2026-08-04 correction — the false-positive gate was vacuous).** The
  abstention rule below excludes **every** unequal-parser-major pair *before* classification. If all
  planted parser-drift fixtures bump the parser major, the parser-drift false-positive rate is
  computed over an **empty denominator** and the gate passes without the model ever having
  classified anything. The planted parser-drift fixtures are therefore split into two disjoint sets
  with two different gates:
  - **(a) Incomparable / parser-shift fixtures** — parser bundle **major** change or config-revision
    change between snapshots. Scored under a separate **abstention-correctness gate**: the model
    **must abstain**, and the pair must render as separate eras carrying
    `WB_PARSER_MAJOR_INCOMPARABLE`. **Abstaining on these is the success criterion**, not a coverage
    failure. They are **excluded from the false-positive denominator** and from every classification
    metric. Gate: abstention on set (a) = **100%**; any classified delta across a parser-major
    boundary is a blocking defect (G-SA7).
  - **(b) Comparable parser-drift fixtures** — `comparability = 1` (equal parser major **and** equal
    config revision) with genuine planted **instrument** drift inside that major: grammar-bundle
    minor/patch changes, grammar-coverage gain or loss, and vendored/generated reclassification, all
    with **no system change**. These **do reach classification**, carry the ground-truth label
    `no material change`, and form the denominator of the **parser-drift false-positive rate** and
    of the classification gates.

  **The gate fails if zero fixtures reach classification.** A parser-drift false-positive rate whose
  set-(b) denominator is empty, or below the canonical §9 per-class floor (≥ 50 fixtures), is
  recorded as **unevaluable** — a gate failure, never a pass.
- **Metrics.** *Primary (exactly one, §1.2):* macro-F1 over the change classes vs the threshold-rule
  baseline, computed over the fixtures that **reach classification** (the comparable fixtures,
  including set (b); set (a) is excluded by construction).
  *Secondary:* per-class support, calibration error, selective risk, **feature attribution over
  controlled features only**, continuity-match accuracy (recovery of planted splits/merges),
  **parser-drift false-positive rate over fixture set (b) only** — how often residual, *comparable*
  instrument drift is labelled a system change class — and **abstention-correctness rate over
  fixture set (a)**. Holdouts: repository (held-out systems), time, and language.
- **Abstention rule.** Abstain unless `comparability = 1` (equal parser major **and** equal config
  revision, ADR-07) and `parser_coverage` clears the family floor. Incomparable snapshot pairs render
  as separate eras — never as a classified delta. This rule is exactly why fixture set (a) is an
  **abstention** test and never a classification test, and why the false-positive gate must be
  measured on set (b).
- **Drift.** Parser/language drift (canonical §9); grammar bundle changes force re-benchmarking.
- **Resource budget.** §1.8.
- **Privacy.** C3 graph inputs → C1 summaries; C4 AST destroyed in-worker (ADR-06).
- **Rejection threshold.** Reject if macro-F1 gain < MMI (**A**: +0.05) on held-out systems, or if
  the **parser-drift false-positive rate measured over fixture set (b)** exceeds the baseline's — a
  classifier that manufactures architecture drift from parser drift is worse than no classifier
  (ADR-07's stated failure mode). Reject also if the **abstention-correctness gate** on fixture set
  (a) is below 100%, and treat the parser-drift comparison as **failed (unevaluable)** — never as
  passed — if no fixture reaches classification.
- **Removal/fallback.** Delete ⇒ deterministic era diffs of snapshot aggregates plus modelled
  continuity remain (ADR-07); each element keeps its layer badge.

### WB-C9 — Aggregate evidence retrieval ranking (ADR-20 ladder rungs 2 and 3)

- **Task.** Given a claim family and a window, return the smallest evidence set that a
  deterministic composer needs — **including contradicting, coverage, and limitation evidence**.
- **Deterministic baseline.** ADR-20 rung 1: SQL filtering over typed facts + feature registry with
  standardized-distance ranking, **with mandatory per-class quotas** (supporting / contradicting /
  coverage / limitation). This is the shipped default. Candidates: rung 2 BM25 over rendered
  controlled templates; rung 3 local pinned offline embedding over the same templates.
- **Benchmark design (`BENCH-WB-C9.v1`, proposed).** Generator `gen.wb.retrieval.v1` emits ≥ 200
  aggregate evidence rows (canonical §9 floor) plus an authored query set with **owner-authored
  relevance judgements**. Planted parameters: query type mix {similar-window, similar-system,
  counter-evidence-seeking, coverage-explaining}; relevant-set size; **planted counter-evidence** for
  every query (so counter-evidence recall is measurable, not incidental); distractors that are
  lexically similar but semantically irrelevant; coverage rows that must appear; **uniqueness
  canaries** — deliberately rare evidence rows used as membership-inference probes; and prohibited-
  field canaries (charter §Fixture rule) that must never appear in an index, a template, or a result.
- **Metrics (mission-specified).** *Primary:* **counter-evidence recall@k**, as defined
  canonically in `04_LOCAL_RAG_DESIGN.md` §5.2 #5 (pre-quota top-k, planted falsifier denominator;
  the post-quota delivered value is a separate quota-engine check) — because the product's
  failure mode is a persuasive one-sided story, not a missed nice-to-have. *Secondary:* **Recall@k**,
  **nDCG**, **MRR**, **citation validity** (every returned evidence ID resolves to a stored record in
  the same pack — must be 100%, a hard gate not a metric), unsupported-claim rate downstream,
  stale-index behaviour, **deletion proof** (after revocation the index rebuilds empty and no result
  references a deleted ID), and **membership-inference / uniqueness-leakage canary results**.
  Holdouts: query set and time.
- **Abstention rule.** If quotas cannot be filled (no contradicting or coverage evidence exists),
  the retrieval **returns the gap explicitly** so the composer abstains or downgrades — it never
  silently returns a supporting-only set.
- **Drift.** Feature-version drift (canonical §9); template/enum registry changes invalidate the
  index; a stale index must fail closed, not serve stale IDs.
- **Resource budget.** §1.8; the index must be rebuildable within budget, because deletion requires
  rebuild.
- **Privacy.** Templates contain **statement codes and registered enums only, no prose** (ADR-20).
  **An embedding inherits the highest class of every input (C1 here) and is never anonymisation**
  (principle 6). Any index is task-scoped, process-local, non-exportable, non-cross-pack-linkable,
  and deleted on revocation. **A durable index is a separately reviewed sink — an owner gate (G).**
  No hosted files, vector stores, external embeddings, web search, or tools — ever, under current
  authority (ADR-20, charter G4).
- **Rejection threshold.** **Rung 2 is evaluated only if rung 1 measurably fails recall.** Rung 3 is
  adopted only if it beats rungs 1 **and** 2 on Recall@k/nDCG **and** counter-evidence recall **and**
  passes the reconstruction/membership-inference canaries. Otherwise: **rejected**, and that is the
  expected and acceptable outcome (§7).
- **Removal/fallback.** Delete ⇒ rung 1 structured retrieval, which is the shipped default and needs
  no model at all.

### WB-C10 (**proposed**) — Traceability link evaluation: explicit vs inferred

ADR-19's register runs C1…C9, but ADR-11 requires suggested associations to carry **calibrated**
uncertainty and ADR-07 requires module continuity to report **match confidence**. Those are modelled
outputs with no home in the register. **R:** add a tenth candidate rather than let calibration be
implicit. *This ID is proposed and requires coordinator adjudication (§8).*

- **Task.** For issue↔PR↔commit↔release↔deployment, (a) measure the **explicit, provider-observed**
  link extraction, and (b) calibrate **inferred** (`suggested_assoc`, `revert_candidate`,
  `backport_candidate`) links.
- **Deterministic baseline.** Provider-observed edges only (`DL.FLOW.ISSUE_PR_RELEASE_RATIO.v1` stays
  observed-edges-only — ADR-11). Inferred links have no baseline to beat; they have a calibration
  bar to clear.
- **Benchmark design (`BENCH-WB-C10.v1`, proposed).** Generator `gen.wb.trace.v1` plants known
  ground-truth chains with: link density; provider-edge presence rate (some true links have **no**
  provider edge); temporal-adjacency distractors (two unrelated things that happen close together);
  reverts and backports with and without topological signatures; squash/rebase forms; and censored
  history (`GIT_SHALLOW_BOUNDARY`, force-push).
- **Metrics (mission-specified).** **Explicit-link precision/recall reported separately from
  inferred-link calibration** — they are different claims about different things and must never be
  pooled into one number. Explicit: P/R/F1 of provider-edge extraction (target: precision 1.0,
  because an extraction error is a correctness bug). Inferred: reliability diagram and ECE of the
  suggested-association probability, plus precision at the rendering threshold, plus **correction
  behaviour** (when a later provider edge arrives, the suggested claim is superseded via lineage and
  the Delivery Map shows the correction — ADR-11). Both tracks are *reported* metrics; if this
  evaluation is ever preregistered, §1.2 still requires it to name **exactly one** of them as the
  primary metric, with the other descriptive — two reported tracks are not two primaries.
- **Abstention rule.** Below calibration or support gates, suggested associations are not rendered at
  all; deterministic flow ratios never include them, in any state.
- **Privacy.** C1 aggregates over C2 IDs; no identities.
- **Rejection threshold.** Reject inferred links entirely if ECE > 0.10 (**A**) or if precision at
  the rendering threshold < 0.7 (**A**) — an uncalibrated "maybe related" edge is worse than an
  honest gap.
- **Removal/fallback.** Delete ⇒ observed edges plus explicit unlinked-cohort counts, which is the
  ADR-11 deterministic surface.

---

## 4. Static-analysis evaluation gates (ADR-05/06/07 instrument quality)

The parser tier is an **instrument**, and an unvalidated instrument invalidates every downstream
architecture claim (WB-C5, WB-C8, and the Time Machine). These gates are not ML gates; they are
prerequisites for any architecture-flavoured candidate leaving `seeded`.

| Gate | Requirement | Failure behaviour |
|---|---|---|
| **G-SA1 parser correctness** | Per language and per grammar version, a golden fixture corpus with hand-checked expected outputs: import/reference edge counts, public-declaration counts, module boundaries, cycle presence. Precision and recall reported **per language**, never pooled. | A language below its documented quality note is not admitted to tier-2 (ADR-06); it abstains with `parser_coverage` recorded. |
| **G-SA2 coverage accounting** | Every file is accounted for as {parsed, skipped-by-rule, skipped-generated/vendored, failed}. Sum equals enumerated files. `parser_coverage` is computed from this, never estimated. | Any unaccounted file is a defect. Missing coverage degrades the dimension; it never becomes an implicit "0 edges". |
| **G-SA3 deterministic replay** | Same immutable ref + same `parser_bundle_version` + same config revision ⇒ byte-identical module graph and identical table checksums under different locale, timezone, path separator, filesystem ordering, and concurrency (canonical §13 deterministic-replay layer). | Non-determinism blocks the snapshot contract (ADR-07) outright. |
| **G-SA4 unsupported-language abstention** | For a language with no admitted grammar, the worker emits **abstention plus coverage**, never partial edges and never zero. Fixture: a repository that is 60% unsupported-language. | A run that reports "0 modules" for an unsupported language is a silent-zero violation (brief §5 guardrail). |
| **G-SA5 adversarial input** | Hostile fixtures: pathological nesting, multi-MB single lines, invalid UTF-8, NUL-safe unusual names, symlink loops, LFS-like pointers, zip/decompression-bomb shapes, files that trigger quadratic grammar behaviour, and the canonical hostile-Git-config corpus (ADR-08). | Bounded failure only: per-file skip + coverage. Zero execution of repository code, hooks, filters, textconv, or plugins — asserted, not assumed. |
| **G-SA6 resource isolation** | One isolated worker process; no network; no shell; bounded input size, wall clock, memory, and output; stdout/stderr disabled; crash of one file recorded and skipped (ADR-06). Timeout and OOM are **tested by injection**, not by inspection. | Breach = blocking defect; capability cannot activate. |
| **G-SA7 parser-version drift** | Changing the grammar bundle major produces a **new snapshot key** and an **incomparable** pair (ADR-07). Fixture: identical tree parsed by two bundle majors must render as separate eras with a `comparability` limitation, never as architecture drift. | A delta rendered across a parser major boundary is the canonical failure mode this gate exists to prevent. |
| **G-SA8 privacy of parser output** | Adversarial canaries (paths, identifiers, import strings, source snippets, diagnostics) must not survive into any persistent, log, API, export, model, or pack sink; AST and diagnostics are C4 (ADR-06, charter fixture rule). | Any survival is a charter violation, blocking. |

**R4.1** G-SA1…G-SA8 are gate-A prerequisites for **WB-C5** and **WB-C8**, and gate any architecture
claim rendered at deterministic layer too. An architecture candidate benchmarked on a parser tier
that has not passed these gates is measuring its instrument's noise.

---

## 5. Explainability contract

**R5.1** Every rendered output above the observed layer — deterministic, modelled, hypothesis, or
abstention — resolves, in one deterministic walk (ADR-01), to all six of:

| # | Element | Resolution path | Rule |
|---|---|---|---|
| 1 | **Evidence IDs** | `claim → claim_evidence_edge → evidence_id` with `role` ∈ {supports, contradicts, contextualizes, derives_from, coverage_basis, limitation_basis} | 100% of cited IDs resolve to a stored, replayable record (brief §5 success metric). A model may **never add evidence IDs** — schema-rejected (ADR-21). |
| 2 | **Method version** | `claim.method_id@method_version` → `model_registry` row → `prereg_id`, `dataset_card_id`, `model_card_id`, gate evidence | A modelled claim whose registry row is not `shipped` cannot render (§1.9 invariant 1). |
| 3 | **Coverage** | `coverage_basis` edges → coverage vector (ADR-02 registered dimensions) with `limiting_reason` | Displayed as a **vector with the limiting dimension named**, never averaged into a score (principle 7). |
| 4 | **Limitations** | `limitation_instance(claim_id, limitation_code, dimension, copy_key)` → versioned limitation dictionary | Copy resolved per (claim family × limiting dimension) so the same truncation reads correctly in each context. |
| 5 | **Alternatives** | Closed per-family alternative enum (ADR-21), **always including the coverage alternative** for change-point-flavoured claims (ADR-17) | An interpretation with no stated alternative does not render. |
| 6 | **Correction lineage** | `lineage_event` {correction, tombstone_cascade, export_included, reconsent, index_built, index_deleted} + `claim.superseded_by` | History is never rewritten; a superseded claim is shown as corrected, with the correction visible (ADR-11). |

**R5.2 — Feature explanation without prose.** Model explanations cite **controlled feature codes**
(`DL.*` IDs and registered enums) and their contribution, never source text, names, paths, titles, or
identifiers (canonical §9 condition 5). Attribution over free text is impossible here by
construction, because free text never persists.

**R5.3 — Falsifier is mandatory.** Every hypothesis surface ends in at least one question that could
change it, generated from the family's falsifier registry (ADR-21, ADR-24). A model card whose
candidate cannot produce a falsifier for its claim family fails gate C.

**R5.4 — Replay.** Replaying a pack reproduces identical table checksums and identical deterministic
claim IDs (ADR-01). A modelled claim replays to the same value only if the method is seeded and
deterministic; a non-deterministic method must record its seed in `model_provenance`
(canonical Appendix D: provider/model/prompt/schema/seed/temperature and evaluation state) and
declare non-determinism in its card. **A method that cannot state a seed cannot ship.**

---

## 6. Rejected candidates (no authorization path)

These are rejected as a matter of product boundary, not of accuracy. They may not be reopened by a
better benchmark, and the registry must expose no promotion path to them (brief §5 guardrail:
"the rejected-capability registry never gains an authorization path").

| REJ | Candidate | Why rejected | Registry anchor |
|---|---|---|---|
| REJ-1 | **Individual output/performance/behaviour forecasting** | Categorically outside the product boundary (canonical §9 Reject row, §4 rejected-metric ledger). | `PERSON-METRIC-X` |
| REJ-2 | **Sentiment / tone / emotion from reviews, issues, commits** | Invalid, identity-targeting, and requires prohibited prose that is never collected. | `PERSON-METRIC-X`, `RAW-CONTENT-X` |
| REJ-3 | **Personality, archetype, "DNA", developer-type inference** | Behavioural profiling with weak validity and high reification risk; already retired from V1 (ADR-04 step 6). | `PERSON-METRIC-X` |
| REJ-4 | **People centrality / contributor graph embeddings / collaboration-network ML** | Surveillance-oriented even when pseudonymised; schema rejects person-node analytical output. | `GH-PEOPLE-X` |
| REJ-5 | **Named or pseudonymous bus-factor / key-person risk models** | Human-value inference and re-identification. Only *declared-rule ownership coverage* exists (ADR-13). | `GH-PEOPLE-X` |
| REJ-6 | **Reviewer responsiveness / per-person latency models** | Collaborator surveillance; the schema has no reviewer/author dimension (ADR-12). | `PERSON-METRIC-X` |
| REJ-7 | **Effort, hours-worked, attendance, availability, or cadence-of-a-person estimation from timestamps** | Highest re-identification risk domain; grain floors (ISO week) exist precisely to make it impossible (ADR-14). | `PERSON-METRIC-X` |
| REJ-8 | **Burnout / wellbeing / engagement classifiers** | Person-shaped under a caring name; principle 1 forbids reintroduction under softer names. | `PERSON-METRIC-X` |
| REJ-9 | **Code-quality, technical-debt, maturity, or risk scoring models** | Explicit non-goal (brief §4); LOC/change size as quality is a rejected metric; a "score" is exactly the persuasive scalar principle 7 forbids. | canonical §4 ledger |
| REJ-10 | **Vulnerability-location, exploitability, or security-posture models** | Aggregate lifecycle only, isolated; alert count is not security posture (ADR-15). Secret scanning and draft advisories are rejected sources. | `GH-SECRET-X`, `GH-ADVISORY-X` |
| REJ-11 | **Any model trained on source, diffs, patches, paths, bodies, comments, logs, or artifacts** | Those bytes are `RAW-CONTENT-X`, prohibited from every sink; a model is a sink. | `RAW-CONTENT-X` |
| REJ-12 | **Working-tree / uncommitted-work models** | `SRC-WORKTREE-X`: unstable and materially more sensitive. | `SRC-WORKTREE-X` |
| REJ-13 | **Hosted embeddings, hosted vector stores, external retrieval, web search, agentic tools** | Outside the G4 boundary (OpenAI `gpt-5.6-luna`, one stateless Responses request, no tools). Proposing them as available would be a false authority claim. | charter §G4 |
| REJ-14 | **A single composite "confidence" or "health" scalar produced by a model** | Principle 7 and ADR-02 option (c) explicitly rejected. | ADR-02 |

**R6.1** REJ-1…REJ-14 also bind *composition*: a combination of individually permitted features that
reconstructs a rejected quantity is itself rejected (ADR-14 proxy/composition review). Each model
card records its proxy/composition review outcome (template field 12).

---

## 7. Likely-reject pending evidence

These are honest candidates whose most probable outcome is rejection. Recording that expectation now
prevents the sunk-cost drift that turns "research" into "shipping because we built it".

| Candidate | Why rejection is the likely outcome | The evidence that would change it | Where it goes if rejected |
|---|---|---|---|
| **WB-C3 CI failure-family classifier (metadata-only)** | Canonical §9 says labels are "likely weak" and logs are prohibited. Metadata (durations, attempt index, matrix presence) plausibly carries very little family signal. | Metadata-only macro-F1 beating the preregistered **classifying** baseline (majority-class / deterministic metadata rules — the aggregate outcome/attempt distributions are context, not a baseline) by the MMI at *realistic* planted separability, with per-class support ≥ 50 and calibrated probabilities. | Permanently rejected at the metadata boundary. **Never** re-opened by requesting logs — that boundary is `RAW-CONTENT-X`. |
| **WB-C9 rung 3, vector retrieval** | Over C1 codes and numbers, structured retrieval is probably sufficient (ADR-20). Embeddings add a sensitive derivative, a durable-index sink question, and membership-inference exposure for little expected gain. | Rung 1 (and then rung 2) *measurably failing* recall, plus rung 3 beating both on Recall@k/nDCG **and** counter-evidence recall with clean canaries. | Rejected; rung 1 remains the shipped default. This is a **success** of ADR-20's ladder. |
| **WB-C9 rung 2, BM25 over controlled templates** | Templates are statement codes and enums; lexical matching over a closed vocabulary may add nothing over SQL filtering on the same vocabulary. | A measured recall failure of rung 1 on the authored query set. | Rejected; skip straight past it. |
| **WB-C5 graph embeddings (sub-candidate)** | Community *detection* has a measurable planted-partition target; *embeddings* mainly enable similarity search that structured features may already serve, at C3 sensitivity. | Embedding-based similarity beating standardized-distance over deterministic graph features on an authored task. | Rejected; SCC/components/degree distributions remain. |
| **CI-load forecasting** (canonical §9 "research only with a legitimate capacity decision") | No capacity decision exists for a single-owner local tool; high drift, limited value. | A named, real capacity decision with a cost function. | Not entered into the register at all until such a decision exists. |
| **WB-C7 as anything other than a coverage annotation** | Any framing beyond "will the next probe be complete?" slides toward activity prediction. | Nothing — the decoy test exists to keep this closed. | Stays a coverage annotation or is deleted. |
| **WB-C10 inferred traceability links** (proposed) | Temporal adjacency is a weak signal; miscalibrated "maybe related" edges corrupt the Delivery Map's credibility. | ECE ≤ 0.10 and precision ≥ 0.7 at the rendering threshold on planted chains. | Observed edges only; unlinked cohorts rendered honestly as gaps. |

---

## 8. Owner gates raised by this document (do not assume)

| G | Gate | Why it is a gate, not a decision this document can make |
|---|---|---|
| **G-ML-1** | Any candidate's transition from `benchmarked` to `validated`, per candidate. | ADR-19 still requires a representative consented or curated-public dataset with its own card, explicit reviewed capability/consent revision, retention/deletion, release review, and untouched holdout. Constitution-v2/DL-Q-CONSENT records eligibility under the existing gates; it is not dataset, reader, model, or candidate activation, and this row requests no redundant owner authorization. Each reviewed candidate task must supply these proofs. |
| **G-ML-2** | Any **durable index** (lexical or vector) built by WB-C9. | ADR-20: "any durable index is a separately reviewed sink (owner gate)". |
| **G-ML-3** | ADR-10 **Tier-2 semantics** (PR/issue prose, durable text embeddings) as an input to WB-C2. | ADR-10 records this as an explicit owner-gated policy proposal; **no card here assumes it**. |
| **G-ML-4** | Adding **WB-C10** to the ADR-19 candidate register. | **Adjudicated 2026-08-04 (08 §4.8): accepted as DL-TRACE-03's evaluation specification, not a separate register entry or board card.** The register stays C1…C9. |
| **G-ML-5** | Any **local model weight** shipped or downloaded for WB-C2/C9. | Must be pinned, licensed, offline, non-executing-remote-code (ADR-21). Licensing and distribution are owner questions. |
| **G-ML-6** | Raising any §1.8 **resource budget** above the defaults. | Cost is a product boundary here; a raised budget needs the decision it changes. |
| **G-ML-7** | Storing **model outputs** durably (`model_output` table population). | Canonical §10: initial model output is process-only; "a later reviewed task may store validated C1 output separately". |

---

## 9. Evidence to revisit / open questions

1. **Are the canonical §9 sample floors achievable on a single owner's portfolio at all?** ≥ 500
   labelled CI failures, ≥ 500 architecture changes across ≥ 10 systems, ≥ 104 complete weekly
   observations. **I:** several candidates may be permanently unevaluable on real data for this
   product's actual scale — which is itself a finding worth recording, and an argument for rejection
   rather than for lowering floors.
2. **MMI values are placeholders (A).** Every `MMI` above needs to be re-derived from the decision it
   would change before any preregistration is frozen. A preregistration with an unjustified MMI is
   ceremony, not control.
3. **BH vs BY at `validated` tier** (§1.4 item 5) should be revisited once any correction family's
   dependence structure is measurable.
4. **Does invented-fixture realism have a ceiling that makes `benchmarked` nearly meaningless for
   some candidates?** WB-C3 and WB-C6 are the likeliest: their planted parameters (metadata
   separability, informative censoring) are exactly the quantities nobody can invent honestly.
5. **Claim-volume performance** (ADR-01 revisit note) interacts with retrieval benchmarks: measure in
   the pack benchmark card before assuming SQL retrieval scales.
6. **Proxy/composition review of the workbench itself.** The benchmark harness holds labels, seeds,
   and results — confirm none of that becomes a durable surface that leaks about real repositories
   when a real dataset ever exists.

---

## 10. Proposed ID register (all **proposed**, none authorised)

| Kind | Proposed IDs | Style anchor |
|---|---|---|
| Candidate | `WB-C10` (traceability link evaluation) | ADR-19 `WB-C1…C9` |
| Cards | `WB-03` (preregistration + holdout custody), `WB-04` (leakage checklist harness), `WB-05` (drift monitors + auto-demotion) | ADR-19 `WB-01`, `WB-02` |
| Datasets | `BENCH-WB-C1.v1` … `BENCH-WB-C10.v1` | new family |
| Generators | `gen.wb.series.v1`, `gen.wb.subjects.v1`, `gen.wb.ci.v1`, `gen.wb.sequences.v1`, `gen.wb.graphs.v1`, `gen.wb.survival.v1`, `gen.wb.observability.v1`, `gen.wb.arch.v1`, `gen.wb.retrieval.v1`, `gen.wb.trace.v1` | new family |
| Methods | `mth.wb.cp.pelt.v0`, `mth.wb.cp.bocpd.v0`, `mth.wb.ci.majority.v0`, `mth.wb.ci.metarule.v0` (further method IDs per candidate at build time) | ADR-01 `method_id@method_version` |
| Tables | `wb_preregistration`, `wb_result`, `wb_benchmark_suite` (additive, C1, STRICT, FK-bound) | ADR-01 additive-table pattern |
| Limitation codes | `WB_HOLDOUT_CONSUMED`, `WB_MODEL_DEMOTED`, `WB_BENCHMARKED_NOT_VALIDATED`, `WB_PARSER_MAJOR_INCOMPARABLE` | canonical §7 limitation dictionary |
| Static-analysis gates | `G-SA1` … `G-SA8` | new, scoped to ADR-05/06/07 |
| Owner gates | `G-ML-1` … `G-ML-7` | brief label **G** |

---

## 11. Closing statement (must survive summarisation)

Invented fixtures prove **contracts, mechanics, privacy, and failure handling** — never empirical
validity. The `benchmarked` tier is a statement about a generator. **No candidate in WB-C1…WB-C10
becomes implementation-ready in this planning session**; every one remains `seeded`, P11 remains
"Not now", and the deterministic product in canonical §8 is the complete product with every one of
them deleted.
