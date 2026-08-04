# Open Questions, Owner Gates, and the Opportunity Frontier

Status: **Accepted (planning artifact)** · 2026-08-04 · Non-authoritative proposal space; owner
decisions bind only when recorded in `HUMAN_TODO.md`; charter/matrix changes bind only when made in
those documents. This file is the programme's question ledger: genuinely open owner gates, the full
frontier decision record, convergence evidence, and coordinator adjudications.

## 1. Owner-gate register (open decisions — never assumed)

Each gate exists as a QUESTION card on the seeded Taskdeck board. None blocks the critical path.

| Gate (card) | Decision the owner would make | If approved | If refused | Unblocking evidence to attach |
|---|---|---|---|---|
| DL-Q-PROSE | May PR/issue prose (titles/bodies) ever enter ephemeral semantic analysis or durable text derivatives? | A reviewed charter+matrix revision defining a new text tier with its own class/retention/deletion; tier-2 semantic features become designable | Commit subjects (`cap.commit.intent`) remain the only text input — the programme is complete without it | The tier-1 intent-mix results on real consented data, showing where subject-only semantics abstains |
| DL-Q-INDEX | May any retrieval index become durable (outlive its task)? | A separately reviewed sink with retention/deletion/linkage rules | Indexes stay task-scoped, process-local, deleted on revocation (ADR-20 default) | RAG-02 benchmark evidence that rebuild cost is material |
| DL-Q-LOCALMODEL | May a pinned, licensed, offline local model be added for composition/retrieval? | Weights-provenance + resource-budget review, then a WB candidate | Deterministic composer + optional G4 external route remain the whole surface | WB-C9 ladder verdicts showing a concrete gap |
| DL-Q-CONSENT | Per WB candidate: may a representative, consented real dataset be assembled for validation? | Candidate may attempt `benchmarked → validated` with its own dataset card + untouched holdout | Candidate stays at `benchmarked` forever — a legitimate end-state (roadmap F1) | The candidate's invented-benchmark gate result |
| DL-Q-XCONTRACT | May a cross-repository artifact identity key (content hash of C4 bytes) exist for shared-contract drift? | A new linkage primitive with two-way deletion cascade, reviewed as its own sink | Shared-contract drift stays parked (A11); co-change lift (COUP-03) remains the only cross-repo signal | The four-repo coincidence fixture: can alias-only matching exclude coincidental version tokens? |
| DL-Q-AGENTCFG | (a) May the role taxonomy gain `agent_config`? (b) If yes, is portfolio-level adoption timing suppressed to per-repository presence? | Presence-only role lands; portfolio timing suppressed per (b) | Taxonomy stays at 14 roles; agent-config surfaces stay invisible | The two-portfolio fixture: can a reader name the adoption week from aggregate output? |

| G-d (registry rows) | May the capability matrix gain rows for `GH-RULE-01` (rulesets/branch protection — may need administration-read), `GH-ATTEST-01` (attestations), or `GH-DISCUSS-01` (discussion metadata)? These are in the canonical §3 catalog but NOT in the q-2 standing-G3 set. | Reviewed matrix/registry change per source; DL-PORT-02 and DL-PROV-01 unblock | Policy-evolution and provenance-coverage features stay ungated-off; the programme is complete without them | The specific decision question each source would answer, from CI/portfolio evidence |
| G-e (artifact metadata) | May artifact/cache **metadata-only** counts (`GH-ACT-ART-X` is "not now") ever be collected? | A reviewed matrix row with its own class/retention | Stays rejected-for-now | A demonstrated disk/cost decision it would change |

Also open (pre-existing, reaffirmed): the six GitHub issues in DL-Q-CONSTRAINTS gate real
migration (#5, #6, #59), the P12 lane (#41, #57), and UX polish (#55).

**2026-08-04 review correction:** DL-PORT-02 and DL-PROV-01 originally carried standing-G3
authority lines on the board; both are now OWNER_GATED/PARKED behind G-d, and `02` §0's
"no ungated dependency" sentence was corrected accordingly.

## 2. Frontier decision ledger (31 candidates, 3 passes)

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
| A14 | Agent-config presence role (owner-gated, not parked) | DL-Q-AGENTCFG owner decision with the two-portfolio fixture attached — listed here so all 31 candidates have a §2 disposition row |

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

## 3. Convergence statement

Three independent passes ran: Scout A (archaeology/contracts lens, 14 candidates), Scout B
(dynamics/counterfactuals/evidence-quality lens, 14 candidates), and a completeness critic given
both reports and instructed to search only un-covered spaces. The critic returned three survivors —
all in the product's own honesty machinery, none in the "analyse the repository differently" space —
and returned no distinct high-value candidate outside it, with a nine-item near-miss kill list.
Per the programme's stopping rule, and reworded by the 2026-08-04 reconciliation to avoid claiming
the problem space itself is exhausted: **backlog expansion is closed for this planning cycle. New
analytical ideas enter through evidence-backed questions (DL-OPEN-01's generators) after the first
value slice (DL-VALUE-01) is evaluated; no further speculative scouting occurs before then.**

## 4. Coordinator adjudications (recorded decisions on draft-raised items)

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

## 5. Documentation-reconciliation queue (verified doc-vs-code deltas, 2026-08-04)

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

## 6. Cheapest-evidence menu (what would resolve the biggest open questions)

| Question | Cheapest resolving evidence | Cost class |
|---|---|---|
| Is continuity matching stable enough for split/merge claims? | TIME-02 planted-fixture stability run | fixtures only |
| Do vectors ever beat structured retrieval here? | RAG-02 benchmark + WB-C9 ladder on invented packs | fixtures only |
| Is the metadata-only CI-family classifier viable? | WB-C3 preregistered run (likely-reject expected) | fixtures only |
| Can alias-only contract matching exclude coincidences? | A11 four-repo coincidence fixture | fixtures only |
| Is portfolio agent-config timing a personal-timeline proxy? | A14 two-portfolio fixture | fixtures only |
| Does the banding rule actually collapse fingerprints? | DL-PACK-06 distinctiveness probe on fixture packs | fixtures only |
| What does subject-only semantics miss? | Tier-1 intent mix on real consented data (after activation) | consented run |
