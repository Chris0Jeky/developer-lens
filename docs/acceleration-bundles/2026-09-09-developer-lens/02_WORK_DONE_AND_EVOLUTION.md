# Work done and project evolution

## 1. Private retrospective and public synthetic showcase

Developer Lens began as a local GitHub development retrospective: six- and twelve-month views, project constellation, rhythm and delivery patterns, a nine-part Wrapped story, deterministic insights, and portable sharing.

A central early design choice was to split the product into two surfaces:

- the local lens, which can use authenticated public/private GitHub metadata and explicitly selected local Git roots;
- the hosted showcase, which is rebuilt from invented identities and events and passes synthetic-identity, export and secret/path checks before publication.

The sharing system then grew beyond screenshots into compact reports, full portable dashboard/Wrapped HTML and a headless artifact exporter, with explicit redaction acknowledgement and post-write scanning.

## 2. Evidence-aware V2 foundation

The project subsequently developed a second architecture centred on evidence integrity rather than dashboard convenience. Work now includes:

- field classes, capability contracts, consent and coverage states;
- provenance envelopes and versioned analytical definitions;
- explicit missingness, censoring, limitations and abstention;
- SQLite migration and incremental storage contracts;
- installation-scoped aliases and confined activation cards;
- bounded GitHub REST acquisition and replay;
- analysis packs, claim graphs and deterministic evidence resolution;
- deletion planning, revocation replay, restore and selected-store proofs.

This foundation is technically substantial. It also creates the present programme tension: a large amount of safety and evidence infrastructure exists before a second major stored-data lens consumes it end to end.

## 3. Product and Lab federation

The Product/Lab split matured into a contract boundary:

- Product owns stable schemas, presentation semantics, public fixtures and promotion policy;
- Lab owns experimental pipelines, candidate methods, evaluations and research evidence;
- consumers pin Product-owned contracts rather than importing internal dashboard objects.

The Method Trial route, ResearchPack, MethodTrialSummary and ResearchFindingProjection are concrete outputs of this model. PR #309 completed the latest producer-side step by publishing ResearchFindingProjection v1.

## 4. Governed agent delivery system

The repository also became an experiment in governed agentic software development. It now contains:

- an owner constitution and human decision register;
- a single current-state resume artifact;
- work classes and a governor state machine;
- Codex and Claude continuation skills;
- a prompt library and parity checks;
- Taskdeck generation and drift verification;
- an append-only implementation ledger and friction log;
- one-writer/worktree rules, exact-head proving and bounded review rounds.

This system has supported a high volume of small, reviewed PRs. It is a genuine project asset, but it should now be treated as infrastructure to maintain rather than the primary source of new product scope.

## 5. Current maturity

### Strongest completed capabilities

- coherent local-first product thesis;
- attractive Story/Wrapped experience;
- deterministic analytical baseline;
- synthetic/public versus private/local separation;
- strict export boundaries and hostile-content tests;
- evidence, coverage and limitation contracts;
- robust storage/deletion/restore research;
- cross-repository Product/Lab contract discipline;
- strong CI and agent handoff mechanics.

### Incomplete or weakly consumed capabilities

- no tagged baseline release;
- no second major stored-observation lens in the stable Product;
- no settled public profile projection for CommitAtlas;
- published ResearchFinding v1 has known robustness and semantic follow-ups;
- legacy whole-dashboard and V2 evidence paths still coexist;
- real-data activation remains intentionally incomplete;
- Query, Team and broad distribution modes remain future programmes.

## 6. Recommended next evolution

The project should move from **foundation accumulation** to **vertical proof**:

1. close the joint v0.1 release;
2. publish the narrow consumer projection under #304;
3. harden ResearchFinding v1 and version semantic changes into v2;
4. introduce a small compile-time lens kernel;
5. deliver #174 from selected-store observations to an inspectable Product finding;
6. only then land Data Charter v2 and the consolidated first-real-activation programme.

The useful long-term identity is not “GitHub analytics with more metrics.” It is a local engineering observatory that can explain what it knows, what it does not know, how a conclusion was produced, and what evidence could change it.
