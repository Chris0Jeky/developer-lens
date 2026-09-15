# Developer Lens product direction

**Last reconciled: 15 September 2026**

This is the concise public product map. [ROADMAP.md](../ROADMAP.md) gives dependency order, [PROGRAMME_ROADMAP.md](PROGRAMME_ROADMAP.md) carries the deeper phase plan, [OWNER_CONSTITUTION.md](OWNER_CONSTITUTION.md) defines policy, and `analyser-program/CURRENT_STATE.md` remains the exact live resume point. A seeded issue, architecture, or capability record is not an activated source or shipped feature.

## North star

Developer Lens should help a developer understand the system of work behind their repositories without converting imperfect engineering evidence into a judgement of human value.

It should answer questions such as:

- Where did attention concentrate, and how did that change?
- How did work move from idea to integration?
- Which rhythms, feedback loops, or delivery shapes repeated?
- Where is the evidence thin, censored, stale, or contradictory?
- Which interpretation is plausible, and what observation could disprove it?
- What is worth examining next, rather than what should be scored?

The product remains private and local by default. Public surfaces use invented data or deliberately redacted, reviewed projections.

## Product layers

### Private retrospective

Authenticated GitHub history and explicitly selected local Git roots are collected into a local store, normalized, and analysed through deterministic rules. The interface presents activity, project structure, integration, rhythm, delivery, themes, DNA, archetype, evidence, and uncertainty.

### Synthetic public showcase

The full experience is publicly explorable through deterministic invented repositories and events. The showcase proves product behavior and communication, not claims about a real developer or repository.

### Evidence cockpit

Coverage, missingness, source boundaries, retention, and privacy are visible parts of the analysis rather than hidden diagnostics. Every consequential reading should open an evidence walk.

### Research bridge

Developer Lens Lab tests candidate methods under a separate research boundary. Product-owned schemas decide what the stable product can understand. A candidate may be rejected, revised once, or benchmarked; none of those decisions silently means “ship.”

### Publication bridge

Cards, reports, portable experiences, and CommitAtlas projections are allowlisted views built from redacted aggregate schemas. Publication is explicit, reviewed, and irreversible once committed publicly.

## Current foundation

The repository already provides:

- six- and twelve-month retrospective views;
- deterministic pattern and hypothesis generation;
- an interactive dashboard and nine-part Wrapped story;
- evidence drawers, coverage, confidence, limitations, and counter-hypotheses;
- the V2 coverage cockpit;
- a deterministic Integration Shape exhibit;
- the frozen Method Trial negative-result story;
- privacy-checked synthetic GitHub Pages deployment;
- local-only authenticated collection and opt-in Git-root aggregation;
- Share Studio and headless artifact export with redaction acknowledgement;
- product-owned Method Trial and Research Finding projection contracts;
- source/capability, data-class, retention, deletion, sink, and authority documentation;
- a staged but inactive Observatory adapter for the synthetic showcase.

There is no public GitHub release yet. Tagging and publication remain owner-controlled gates. There is no hosted private product, ambient repository discovery, automatic external-model transmission, or default telemetry.

## Priority 1 — truthful baseline release

The first tagged baseline should package what already works rather than wait for every planned source or analytic method.

It should establish:

- the synthetic showcase and local runtime as separate products of one codebase;
- the frozen Method Trial as the canonical worked example of a rejected candidate;
- V2 coverage/privacy semantics;
- deterministic operation with no model requirement;
- redacted export and publication contracts;
- exact release evidence, licence, support, and limitation wording.

A release proves a reproducible baseline. It does not validate every insight on representative real repositories.

## Priority 2 — one integrated evidence vertical

The first deeper vertical asks how long integration work takes to land and what the tail looks like.

The vertical should combine:

- explicit cohort/question definition;
- event and censoring semantics;
- competing outcomes;
- matched eras or comparison windows;
- Kaplan–Meier and interpretable accelerated-failure-time baselines;
- uncertainty and bootstrap intervals;
- complete numerator/denominator and missingness;
- clickable evidence walks;
- counter-hypotheses and limitations;
- synthetic public proof and separate local-real-data execution.

The objective is not “add survival analysis.” It is to demonstrate the complete product contract for one consequential question from source through interpretation.

## Priority 3 — explicit capability profiles

New sources should enter as reviewed capabilities, not as a broad “scan everything” switch.

A candidate core profile may include Actions, Deployments, and Source Structure for selected repositories. Dependencies, security aggregates, discussions, text-rich sources, external models, team views, sinks, and observability remain separate opt-ins.

Every capability needs:

- named purpose and supported questions;
- source and selected scope;
- data class and fields;
- consent and authority;
- collection budget and failure behavior;
- retention, migration, deletion, pause, and revoke paths;
- allowed analytical and export sinks;
- deterministic fallback or explicit refusal;
- evidence that activation did not leak into the public showcase.

Code presence is not activation. A source registry entry is not consent. An owner policy decision is not a completed implementation task.

## Priority 4 — recommendations as reviewable questions

Recommendations should begin as deterministic local prompts generated only when the evidence materially changes.

A useful recommendation includes:

- the observation and time window;
- why it changed;
- the affected repositories or workflow;
- coverage and limitations;
- a proposed inspection or experiment;
- what result would change the recommendation;
- an option to dismiss, defer, or record a different explanation.

Optional model assistance may later generate candidate hypotheses or alternative explanations. It remains labelled, cost-bounded, payload-previewed, one-call authorized, and backed by a complete deterministic mode.

Developer Lens does not autonomously create work in Taskdeck or mutate a repository.

## Priority 5 — packaging without weakening locality

Potential packaging includes:

- a tagged Product baseline;
- Developer Lens Lab through `uvx`/PyPI;
- a thin `gh` launcher;
- an npm CLI;
- a bootstrap desktop shell.

Packaging should make local use easier without turning the product into a hosted service or moving private data into a central account. Updates, migrations, backup, deletion, port/host behavior, credentials, and source compatibility require the same evidence discipline as analytics.

## Evidence vocabulary

Developer Lens should keep these states distinct:

- **observed** — directly exposed by a named source within declared coverage;
- **derived** — deterministic calculation over observations;
- **hypothesis** — an interpretation that can be challenged by more evidence;
- **synthetic** — invented data used to demonstrate product behavior;
- **operator-declared** — a human decision, label, or context statement;
- **research finding** — method evidence under the Lab/product projection contract;
- **missing/refused/stale/restricted** — evidence that cannot support the requested claim;
- **published projection** — a reviewed redacted artifact, not a live connection to the private lens.

Confidence never replaces coverage. More activity is not automatically better. Lines changed are not productivity. Repository language is not proficiency. Faster integration is not always healthier. A model-generated explanation is not an observed fact.

## Privacy and authority rules

- Private raw data and private outputs stay local by default.
- The public showcase stays synthetic.
- Local Git roots are explicit; no machine-wide discovery.
- Tokens are used through existing tools and are not persisted by Developer Lens.
- Publication requires a reviewed redacted view.
- External model payloads require an activated capability, payload preview, credential, budget, and bounded invocation.
- The Observatory adapter for the showcase remains inert until a separate notice, CSP, vocabulary, retention, endpoint, and hosted collector review activates it.
- Protected/private data is not used merely because a task would benefit from it.
- Product, Lab, CommitAtlas, Pulseboard, and Taskdeck boundaries remain explicit.

## Cross-project direction

### Developer Lens Lab

The Lab qualifies methods, datasets, and claims. Product semantics and presentation schemas remain Product-owned. The Lab cannot silently promote a research candidate.

### CommitAtlas

CommitAtlas may display a pinned, reviewed public projection. It never fetches Developer Lens locally, accepts arbitrary projection URLs, or turns a private analysis into GitHub evidence.

### Pulseboard

Pulseboard may later receive bounded operational or publication receipts. The synthetic-showcase adapter is not permission to send private retrospective data.

### Taskdeck

A Lens finding can become a human-reviewed proposal or exported note. Taskdeck integration must preserve source evidence, exact refs, authority, and a visible apply boundary.

## Measures that matter

- whether a user can trace a claim to its evidence;
- coverage and missingness understood at decision time;
- deterministic reruns producing stable interpretations;
- false or overconfident hypotheses caught by counter-evidence;
- time from a question to a useful evidence walk;
- redacted exports that preserve meaning without leaking identity or paths;
- source/capability activation that stays within declared budgets and sinks;
- integrated verticals that survive synthetic, local, failure, and migration tests;
- whether the retrospective prompts better questions rather than more scores;
- whether packaging reduces setup friction without weakening locality.

## Non-goals

Developer Lens is not currently:

- a productivity, effort, performance, or employee score;
- a covert team surveillance system;
- a hosted private analytics service;
- a mandatory external-model workflow;
- a machine-wide repository scanner;
- an autonomous recommendation or task-execution agent;
- a replacement for code review, incident analysis, project context, or human judgement;
- evidence that a public synthetic finding applies to a real repository;
- a pipeline that automatically publishes private/local insights.

## Horizons

### H0 — truthful baseline

Tag and document the existing local product and synthetic showcase with exact privacy, release, and support boundaries.

### H1 — integrated evidence vertical

Deliver the integration-duration question end to end with uncertainty, censoring, evidence walks, and synthetic/local parity.

### H2 — capability-profile foundation

Activate selected automatic sources through explicit profiles, budgets, retention, deletion, and refusal contracts.

### H3 — deterministic recommendations

Turn material analytical changes into reviewable local questions and experiments.

### H4 — bounded model assistance and richer sources

Add text-rich inspection and model-generated candidate hypotheses only behind named capabilities and complete deterministic fallback.

### H5 — packaging and transparent broader modes

Improve distribution and optionally support an explicitly enabled aggregate team view without creating a covert hosted surveillance product.

These are dependency horizons, not dates or promises. [ROADMAP.md](../ROADMAP.md) and the live analyser state remain authoritative for sequence and implementation status.
