# Open Questions, Owner Gates, and the Opportunity Frontier

Status: **Accepted (planning artifact)** · 2026-08-04 · Non-authoritative proposal space; owner
decisions bind only when recorded in `HUMAN_TODO.md`; charter/matrix changes bind only when made in
those documents. This file is the programme's question ledger: genuinely open owner gates, the full
frontier decision record, convergence evidence, and coordinator adjudications.

## 1. Constitution-resolved decision records (not active)

The 2026-08-18 constitution-v2 reconciliation records authority for planning reconciliation
only. These records do not activate a capability, source, sink, model, telemetry, credential, or
data path. A proposal can become executable only through the separately reviewed capability,
charter, matrix, policy, task, deletion, and (where a candidate is evaluated) holdout route.

| Record (card) | Recorded authority | Non-activation boundary and future prerequisites |
|---|---|---|
| DL-Q-PROSE | PR/issue prose is proposal-eligible only through explicit reviewed capability, class, retention, parser, deletion, and holdout work. | Commit subjects remain the only text input. No prose read, semantic analysis, durable text derivative, or model payload is active. |
| DL-Q-INDEX | `D1=DURABLE` retrieval is proposal-eligible only through a separately reviewed sink/policy/task with linkage and deletion controls. | ADR-20 task-scoped/process-local/deleted-on-revocation remains the default. No durable index is active; deletion-planner and holdout proofs remain prerequisites. |
| DL-Q-LOCALMODEL | `D12=NO` records the pinned offline local-model option as not planned; only a newer explicitly recorded owner decision may supersede it. | No model, dependency, weights, model invocation, or activation is active; no policy/task/agent route may reconsider or supersede D12=NO. The separate OpenAI/Luna G4 boundary is unchanged. |
| DL-Q-CONSENT | Own/curated-public per-candidate validation is proposal-eligible through the existing consent, charter, matrix, and release gates. | No dataset is assembled or used by this record. A future candidate task needs its dataset card, consent/refusal/deletion controls, release review, and untouched holdout. |
| DL-Q-AGENTCFG | `D5=PRES` records a presence-only `agent_config` role. | No content reads, portfolio timing, adoption inference, or runtime activation is allowed. Timing remains the separate DL-Q-AGENTCFG-TIMING gate. |
| G-e (artifact metadata) | Artifact/cache metadata-only counts are proposal-eligible only through a scoped reviewed capability/matrix change. | No artifact/cache access or collection is active; the standing G3 authority recorded by `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-2` does not cover this source. |
| GH-DISCUSS-01 | Discussion metadata is proposal-eligible only through a scoped reviewed capability/matrix change. | No discussion access or collection is active; the standing G3 authority recorded by `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-2` does not cover this source. |

## 2. Owner-gate register (remaining decisions — never assumed)

Each remaining gate exists as a QUESTION or owner-gated card on the seeded Taskdeck board. None
blocks the deterministic critical path.

| Gate (card) | Remaining decision | Required evidence or route |
|---|---|---|
| DL-Q-XCONTRACT | May a C4-byte content hash become a cross-repository identity key with a deletion cascade? | Coincidence fixture plus explicit owner decision; no inference from `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-2`. |
| DL-Q-AGENTCFG-TIMING | Is portfolio-level agent-config adoption timing suppressed to per-repository presence? | Explicit owner decision plus the two-portfolio fixture. |
| DL-Q-GRAIN | Does the ISO-week operational-timing floor bind freshness-age durations? | Explicit owner decision with the composition-ledger check. |
| G-d / DL-PORT-02 / DL-PROV-01 | May rulesets/branch-protection and attestations enter the capability matrix? | Reviewed matrix change or explicit owner route per source; these cards remain owner/matrix gated and unchanged. |
| DL-DEMO-A1 | May future local Taskdeck dogfood activate against an exact immutable Taskdeck ref and committed-tree scope? | Owner must explicitly select the exact immutable ref/scope and later approve the activation card; no Taskdeck access or activation is implied. |

Also open (pre-existing, reaffirmed): the six GitHub issues in DL-Q-CONSTRAINTS gate real
migration (#5, #6, #59), the P12 lane (#41, #57), and UX polish (#55).

**2026-08-18 reconciliation note:** Discussions and artifact metadata are proposal-eligible only
through scoped reviewed capability/matrix work and are not active. Rulesets and attestations remain
behind the reviewed-matrix or explicit-owner route. This note does not widen the standing G3
authority recorded by `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-2`.

**2026-08-04 review correction:** DL-PORT-02 and DL-PROV-01 originally carried standing-G3
authority lines on the board; both are now OWNER_GATED/PARKED behind G-d, and `02` §0's
"no ungated dependency" sentence was corrected accordingly.

## 3. Frontier decision ledger (31 candidates, 3 passes)

Verdicts are the coordinator's, after adjudicating Scout A (system archaeology/contracts lens),
Scout B (temporal dynamics/counterfactuals/evidence-quality lens), and the convergence critic.
Full nine-question treatments live in the session's scout reports; the decisions and their reasons
are recorded here durably.

### Adopted → cards on the board

| ID | Candidate | Card | One-line reason |
|---|---|---|---|
| A1 | CI declaration-vs-execution drift map | DL-DRIFT-01 | Two approved capabilities, zero new data, honest by construction (set difference + coverage gate) |
| A3 | Migration-ledger archaeology | DL-MIG-01 | Real architectural question; failure mode already owned by LAB-02 separation |
| A4 | Role-taxonomy extension + golden-rewrite waves | ADR-05 amendment + DL-FIX-01 | Taxonomy gap (schema/fixture/golden invisible) was real; highest-leverage single extension |
| A5 | Declared build/workspace graph | DL-BUILD-01 | Declared-vs-import disagreement is the most actionable structural fact in the set |
| A7 | Release-train signature vocabulary | DL-REL-01 | Closed, non-normative, preregistered-threshold regime labels; conditions binding |
| C-01 | Adverse-tail counterfactual bounds | DL-EVQ-01 | Turns "absence is never zero" from disclaimer into a number (tipping fraction) |
| C-02 | Evidence-degradation fragility profile | DL-EVQ-02 | Reuses SPINE-05 machinery as a product surface; compute-on-demand, store nothing |
| C-03 | Claim stability across re-collections | DL-EVQ-03 + ADR-01 stability key | The stability key is needed by ADR-01 regardless; drift-producer role stays research |
| C-04 | Calibration scoreboard for past hypotheses | DL-EVQ-04 | Fills ADR-02's orphaned `calibration` dimension; honest selection-bias counter-check specified |
| C-05 | Replication SQL per claim family | DL-EVQ-05 | Makes principle 7 literally user-testable; highest honesty-per-line |
| C-06 | Coverage-horizon calendar | DL-EVQ-06 | Retention arithmetic, time-critical for the user; ML version explicitly rejected |
| C-07 | Negative space (covered windows only) | DL-EVQ-07 | Disciplined inverse of absence-is-never-zero; copy ban is a blocking dependency |
| C-08 | Matched-window era comparison | DL-EVQ-08 + ADR-07 amendment | The honest middle case between comparable and incomparable |
| D-01 | Machine-checkable composition ledger | DL-CAD-03 | ADR-14's pair/triple requirement was structurally unenforceable as a human checklist |
| D-02 | Export distinctiveness at pack build | DL-PACK-06 | Converts the accepted banding rule from assertion into evidence; never an anonymity claim |
| D-03 | Grant preview (cost dossier + producer set) | DL-LIFE-04 | The consent moment currently has an empty evidence surface on cold installs; yield promise stays research |

### Research → workbench/pattern-lab cards

| ID | Candidate | Card | Gate it must pass |
|---|---|---|---|
| A2 | Docs/API co-movement | (question-generator first) | Neutral rendering must carry decision value on the (a)/(b)/(c) fixture before any panel |
| A6 | Dependency shockwave absorption | (folds into LAB machinery) | Matched-baseline must suppress the release-crunch confound fixture |
| A8 | API-compatibility eras | (LAB/WB lane) | Era claim must survive rename-wave and parser-major fixtures via LAB-02 |
| C-09 | Policy-transition study | DL-EVQ-09 | Placebo+ledger must beat plain side-by-side ECDFs; four person-risk conditions binding |
| C-10 | Wave lead/lag ordering | DL-EVQ-10 | Must distinguish planted propagation from fixed-scheduler artefacts |
| WB-C10 | Traceability calibration benchmark (from the 03 draft) | accepted as DL-TRACE-03's evaluation spec | Explicit-link P/R reported separately from inferred-link calibration, never pooled |

### Parked (named unblocking events)

| ID | Candidate | Unblocking event |
|---|---|---|
| A9 | Licence/dependency-composition drift | Owner decision on C3 horizon for dependency facts; meanwhile the repo-SPDX transition folds into DL-PORT-01 scope (accepted) |
| A10 | Test-topology evolution | DL-TIME-02 continuity matching reaches its preregistered stability floor |
| A11 | Cross-repo shared-contract drift | Coincidence fixture + DL-Q-XCONTRACT owner gate |
| C-11 | Seasonality atlas | Only the machine-subject-only slice may return, and only if LAB-01's baseline genuinely needs an explicit seasonal producer; human-initiated families are schema-rejected, not coarsened |
| C-12 | Deliberate mutability probe | Fold measurement into the checkpoint protocol's existing bounded-overlap re-reads (accepted); revisit only if overlap-derived mutability is too sparse |
| A14 | Agent-config presence role (presence resolved; timing still owner-gated) | DL-Q-AGENTCFG-TIMING owner decision with the two-portfolio fixture attached — listed here so all 31 candidates have a disposition row |

### Rejected (recorded so they are not re-proposed under new names)

| ID | Candidate | Kill reason |
|---|---|---|
| A12 | Maintenance-burden composite index | Unfalsifiable composite; a ranked list of the owner's work; the appetite routes into DL-OPEN-01 (question kind `structural_drift_gap`, accepted) |
| A13 | Agent-authored change-share archaeology | Commit trailers are person attribution; an individual working-method profile survives any coarsening |
| C-13 | Claim-churn → upstream edit attribution | Per-object mutation timing is session-boundary reconstruction; no coarsening keeps value and removes harm |
| C-14 | DiD/synthetic-control effect size | Invalid controls on a single-owner portfolio + persuasive scalar + person-shaped by composition; rejected as a *shape* |
| — | Synthetic twin from real analysis parameters | Covert channel; violates the structurally-incompatible-paths principle |
| — | Cross-installation benchmarking | Linkage primitive + hosted surface (non-goals) |
| — | Retention-aware C3→C1 rollup | A summary whose evidence evaporated cannot resolve its IDs; the horizon calendar is the honest answer |
| — | Collection cost-per-evidence optimiser | Optimises toward more of the cheapest data; inverts charter minimality |
| — | Query Lab attention analytics | Behaviour trace of the owner; explicit non-goal |

## 4. Convergence statement

Three independent passes ran: Scout A (archaeology/contracts lens, 14 candidates), Scout B
(dynamics/counterfactuals/evidence-quality lens, 14 candidates), and a completeness critic given
both reports and instructed to search only un-covered spaces. The critic returned three survivors —
all in the product's own honesty machinery, none in the "analyse the repository differently" space —
and returned no distinct high-value candidate outside it, with a nine-item near-miss kill list.
Per the programme's stopping rule, and reworded by the 2026-08-04 reconciliation to avoid claiming
the problem space itself is exhausted: **backlog expansion is closed for this planning cycle. New
analytical ideas enter through evidence-backed questions (DL-OPEN-01's generators) after the first
value slice (DL-VALUE-01) is evaluated; no further speculative scouting occurs before then.**

## 5. Coordinator adjudications (recorded decisions on draft-raised items)

1. **ADR-01 stability key** (C-03 finding): accepted; amended into ADR-01. Claim history groups by
   (`statement_code`, `method_id@version`, `window`, `scope_alias`, `schema_version`).
2. **14-role taxonomy** (A4): accepted; ADR-05 amended; DL-XRAY-01 card scope updated on the board.
3. **Matched-window middle case** (C-08): accepted; ADR-07 amended.
4. **Banded structural exports** (Scout A cross-cutting fingerprinting risk): accepted as a
   cross-cutting pack rule; ADR-22 amended; DL-PACK-05 card scope updated on the board.
5. **Product-operational timestamps under the ADR-14 grain floor** (Scout B R2): accepted;
   collection/claim-version timing renders at ISO-week grain or coarser everywhere.
6. **Coverage-dimension producers**: `calibration` ← DL-EVQ-04; `drift` ← DL-EVQ-03 (research
   role). Scout B correctly observed both dimensions previously had no named producer.
7. **Copy-dictionary extensions** (Scout B R3): accepted — absence is never a deficiency; a bound
   is never a value; before/after is never improvement; the calibration scoreboard's subject is the
   method, never the user.
8. **WB-C10** (03 draft proposal): accepted as the evaluation specification for DL-TRACE-03, not a
   separate board card.
9. **Query Lab file access** (05 draft G-UX-2): ruled **not a new sink** — a user-initiated local
   read of the user's own already-redacted, checksum-verified export, with no write path and no
   transmission; the ADR-22 degraded mode remains the fallback. Recorded as a decision, reversible
   by the owner.
10. **UX assumptions A-UX-1..5** (05 draft): accepted as stated, each with its reversal path.
11. **Repo-SPDX transitions** (A9 residue): folded into DL-PORT-01 scope rather than a new card.
12. **Mutability measurement** (C-12 residue): folded into the checkpoint protocol's
    bounded-overlap re-reads; no scheduler, ever (non-goal).

## 6. Documentation-reconciliation queue (verified doc-vs-code deltas, 2026-08-04)

The code-map pass verified thirteen deltas between the canonical architecture's descriptions and
live code. Disposition:

- **Closed by this session's decisions:** D5/D6 (three disagreeing pack-manifest shapes →
  PACK-00 + ADR-22 authority ruling); D8 (stale "no tier/human-action file" open-risk line →
  corrected in the canonical 2026-08-04 addendum).
- **Recorded for the canonical addendum (docs-only corrections):** D3 (doc's TS contract omits
  class `X` that code and the doc's own §5 table include); D7 (`shared/types.ts` line anchors
  off-by-one after `reflectionQuestion` landed); D12 (stale ShareStudio anchors); D9 (current-state
  map omits the `?demo=v2` seam, P2/P3/P4/P12 subtrees, and `verify:context`); D4 (consent-registry
  table lists 12 capabilities; code has 13 incl. `github.core`).
- **Already-tracked or card-owned:** D1 (named-but-absent paths are future card outputs — the
  phase table reads as delivered structure; addendum notes them as *planned* paths); D2
  (`DEVELOPER_LENS_STORAGE_V2` flag documented nowhere — BRIDGE-01 documents it); D10 (P4 "adapt
  server/github.ts with feature flag" superseded by the structurally-incompatible injected
  transport — addendum notes the supersession); D11 (orphaned P12 modules — the P12 lane's
  existing resume point already owns assembly); D13 (portable-export alias default not implemented
  as documented — owned by DL-BRIDGE-05).

## 7. Cheapest-evidence menu (what would resolve the biggest open questions)

| Question | Cheapest resolving evidence | Cost class |
|---|---|---|
| Is continuity matching stable enough for split/merge claims? | TIME-02 planted-fixture stability run | fixtures only |
| Do vectors ever beat structured retrieval here? | RAG-02 benchmark + WB-C9 ladder on invented packs | fixtures only |
| Is the metadata-only CI-family classifier viable? | WB-C3 preregistered run (likely-reject expected) | fixtures only |
| Can alias-only contract matching exclude coincidences? | A11 four-repo coincidence fixture | fixtures only |
| Is portfolio agent-config timing a personal-timeline proxy? | A14 two-portfolio fixture | fixtures only |
| Does the banding rule actually collapse fingerprints? | DL-PACK-06 distinctiveness probe on fixture packs | fixtures only |
| What does subject-only semantics miss? | Tier-1 intent mix on real consented data (after activation) | consented run |
