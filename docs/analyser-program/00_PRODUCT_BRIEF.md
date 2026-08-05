# Developer Lens Intelligence Platform — Product Brief

Status: **Accepted (planning artifact)** · Session: 2026-08-04 planning-and-seeding
Authority note: this folder (`docs/analyser-program/`) is a **non-authoritative working proposal
space**. Stable contracts live only in `docs/DEVELOPER_LENS_V2_ARCHITECTURE.md`,
`docs/data-charter.md`, and `docs/source-capability-matrix.md`; the live resume point lives only
in `docs/analyser-program/CURRENT_STATE.md` (the ledger is the history archive). If this folder
disagrees with those, those win.

Labels used across this folder: **V** verified repository fact · **D** documented platform fact ·
**R** recommendation · **I** inference · **A** assumption (with reversal path) · **REJ** rejected ·
**G** owner gate.

## 1. Thesis

Developer Lens becomes a **local-first intelligence platform for software systems**: an
evidence-grounded analyser that understands not just contribution totals but how systems are
structured, how they change, how issues become pull requests and releases, which change patterns
recur, how architecture and delivery evolve, where evidence is incomplete, and which hypotheses are
genuinely supported.

The analytical subject is always the **software system** — repositories, modules, contracts,
workflows, queues, changes, releases, dependencies, and the evidence about them. It is never a
person. The product's feeling is **biography and mechanics of a living system**: curiosity and
delight, not judgement.

One sentence: *Developer Lens tells you what kind of system a body of work became, shows you
exactly why it believes that, and tells you what evidence would change its mind.*

Reconciled thesis (owner directive, 2026-08-04): *Developer Lens is a local-first evidence system
that explains how a software change system evolved, what evidence supports that explanation, what
it could not observe, what alternative interpretations remain, and what evidence would distinguish
them.* Its durable differentiator is **local evidence + source coverage + provenance +
reproducible metrics + falsifiable findings + counter-evidence + portable analysis** — not generic
charts, GitHub collection, a Wrapped animation, or an LLM. The immediate goal is not the largest
possible roadmap: it is **one complete vertical slice proving that thesis** (DL-VALUE-01), with
decision-useful deterministic findings prioritised ahead of packs, retrieval, and modelled
interpretation.

### 1a. One evidence engine, two system-centred experiences

- **Investigate — the System Atlas.** Question-first, comparative, evidence-oriented exploration:
  what changed, where a distribution or delivery tail moved, which repositories/modules/workflows
  account for the difference, what evidence is missing or censored, whether the conclusion
  survives reasonable alternative definitions, what contradicts it, and what would settle the
  remaining uncertainty. **This is the principal product.**
- **Narrate — the System Story.** A guided, humane, visually distinctive narrative over the same
  versioned findings and evidence: one system or portfolio, one selected era or comparison; no
  score, archetype, DNA, productivity framing, or personal profile; no narrative-only metric; no
  claim that cannot be opened in the Atlas and Evidence Drawer; and **no forced question or filler
  when the evidence contains no unresolved question**. It is the successor to the appealing part
  of Wrapped — the presentation and emotional accessibility, never the person-shaped analytics.
  The visual identity may be reused; the analytical semantics may not.

## 2. Audience and jobs-to-be-done

| Audience | Job | What they get |
|---|---|---|
| The owner-developer reflecting on their own systems | "What did this system become? Where is it heading?" | Era comparisons, architecture evolution, delivery-flow shape, honest coverage |
| A maintainer deciding where structural work matters | "Which couplings, cycles, and contract drifts are real and recurring?" | Deterministic structure facts with counter-evidence and abstention |
| A curious engineer exploring a system's history | "How do changes actually flow from issue to release here?" | Traceability graphs, motif/pattern findings, open questions |
| A privacy-conscious user evaluating the tool itself | "What does it collect, keep, and refuse?" | Coverage/privacy cockpit, capability lifecycle, deletion proofs |

Explicit non-audience: managers seeking productivity, performance, attendance, or ranking signals.
The product refuses those questions structurally, not just editorially.

## 3. Product principles (binding for every capability in this programme)

1. **System, never person.** No productivity, performance, effort, attendance, working-hours,
   availability, diligence, quality, worth, personality, sentiment, burnout, cadence-of-a-person,
   named or pseudonymous bus-factor, or people ranking — and no reintroduction under softer names.
   Every capability passes a **proxy/composition review**: if a feature or combination of features
   can reasonably reconstruct attendance, schedule, effort, or individual behaviour, it is
   coarsened, suppressed, or rejected.
2. **Deterministic completeness.** Deterministic local analysis is a complete, useful product. ML
   and LLM layers must beat deterministic baselines on preregistered gates and be removable without
   weakening the deterministic experience.
3. **Strict evidence semantics.** `observed → deterministic → modelled → hypothesis/abstention` is
   a one-way ladder enforced by types and tables. A model output never becomes an observed fact.
   Every interpretation carries evidence, counter-evidence, alternatives, limitations, and a
   question that could change it.
4. **Absence is never zero.** Missing, refused, restricted, truncated, censored, stale, deleted,
   conflicting, or failed evidence is surfaced as coverage, never converted to zero activity or
   quietly averaged away.
5. **Local first, minimal, revocable.** Raw source, paths, diffs, bodies, comments, logs,
   artifacts, secrets, and identities never become a casual analytics lake. Collection is explicit,
   class-bounded (C0–C4/X), and deletable with descendants.
6. **Embeddings are sensitive derivatives.** An embedding inherits the highest class of every input
   and is never treated as anonymisation.
7. **Reproducible without trust.** Every insight replays from versioned evidence and is
   understandable without trusting a model or an opaque score. No persuasive single confidence
   scalar; coverage is a vector.
8. **Delight through honesty.** The interface celebrates what is known, shows exactly why, and makes
   open questions a first-class destination rather than a footnote.
9. **Public means invented.** Public demonstration remains C0 invented data. A real local analysis
   and a public synthetic twin are separate products with structurally incompatible data paths.
10. **Ceremony earns its keep.** Verification scales with blast radius; reversible design decisions
    are made autonomously and recorded with reversal paths.

## 4. Non-goals

- Employee analytics, team dashboards, or any multi-person comparative surface.
- A hosted service, telemetry, or any always-on network dependency.
- A general code-search, code-review, or code-generation tool.
- A security scanner or vulnerability-location product (aggregate lifecycle only, isolated).
- A "technical debt score", maturity model, or leaderboard of repositories.
- Completeness theatre: the product will not claim historical coverage GitHub/Git cannot supply.

## 5. Success and guardrail metrics (product-level, all C0/C1)

Success (measured on invented fixtures and, later, consented local runs):

- **Evidence integrity:** 100% of rendered insights resolve every cited evidence ID to a stored,
  replayable record; replay of a pack reproduces identical table checksums.
- **Abstention correctness:** on fixture suites with deliberately degraded coverage, the system
  abstains or downgrades claims in ≥ the preregistered proportion of cases; zero silent-zero
  violations in the canary suite.
- **Deterministic completeness:** with every modelled/hypothesis layer disabled, all primary
  views render with useful deterministic content (measured as zero empty primary panels on the
  synthetic corpus).
- **Time-to-first-insight:** a fresh local run over the synthetic corpus reaches a populated
  Evidence Atlas within one bounded collection cycle (budget fixed per capability card).
- **Question yield (corrected 2026-08-04):** every hypothesis surface ends in its falsifying
  question **when a genuine one exists**; the Open Questions surface is populated only from real
  gaps, contradictions, or untested alternatives. A fully covered, fully resolved state renders an
  honest "no unresolved question under the current evidence" — fabricating a question to satisfy
  this metric is itself a guardrail failure.

Guardrails (hard failures, tested):

- Zero prohibited-field (X-class) values in any persistent, log, API, frontend, export, model, or
  public sink — proven by adversarial canaries per sink.
- Zero person-shaped metrics: schema-level rejection of person-node analytical output; the
  rejected-capability registry (`GH-PEOPLE-X`, `PERSON-METRIC-X`, …) never gains an authorization
  path.
- Proxy/composition review recorded for every shipped feature; any feature that fails it ships
  coarsened or not at all.
- No claim of anonymisation, GDPR compliance, or guaranteed erasure; disclosures stay accurate to
  the charter's provider-retention and physical-media limitations.

## 6. The questions the platform answers (capability domains)

Grouped map of the mandatory programme; each domain is specified in `01_REFERENCE_ARCHITECTURE.md`
(decisions), `02_FEATURE_EVIDENCE_CATALOG.md` (contracts), and `07_DELIVERY_ROADMAP.md` (order):

| Group | Domains | Question archetype |
|---|---|---|
| Spine | Evidence Spine 2.0 · Coverage/Confidence Intelligence · Capability Lifecycle | "Why am I seeing this, what is missing, and what did I consent to?" |
| Structure | Repository X-Ray · Code Anatomy Atlas · Architecture Time Machine | "How is this system built, and how did its shape change?" |
| Change | Explicit-Ref Git Topology · Temporal Coupling · Semantic Change Analyser | "What changes together, and what kinds of change recur?" |
| Flow | Traceability Graph · PR Integration Observatory · Projects/Ownership Coverage · System Cadence | "How does intent become integrated, released change?" |
| Feedback | CI/Release/Deployment/Dependency Studio | "What did the machines say back, and how did the system respond?" |
| Portfolio | Repository & Portfolio Evolution · Pattern/Motif/Change-Point Lab · Graph Research | "What eras, waves, and turning points exist across systems?" |
| Interpretation | ML Workbench · Local Retrieval/RAG · Hypothesis Composer · Analysis Pack 2.0 & Query Lab | "Which interpretations survive evidence, and how do I explore it myself?" |
| Experience | System Atlas UX · Open Questions Observatory · Migration Bridge (P5) | "How do I live inside this evidence, and what should we ask next?" |

## 7. Relationship to the existing V2 architecture

This programme **extends** the accepted 2026-08-03 architecture; it does not replace it. The
capability matrix, data classes, sink contracts, metric dictionary, phase backlog P0–P12, and gate
status remain binding. The programme's deltas are: an explicit evidence-claim graph (Spine 2.0),
the P5 migration bridge made concrete, richer coverage vectors, an architecture time dimension, a
research governance layer (benchmarks/model cards/promotion gates), local retrieval design, Analysis
Pack 2.0, the System Atlas UX, and the open-questions surface. Accepted deltas are routed into the
canonical architecture document at the end of the planning session; everything else stays proposal.
