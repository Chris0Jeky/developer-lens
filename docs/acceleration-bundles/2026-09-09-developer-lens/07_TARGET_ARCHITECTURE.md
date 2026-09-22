
# Target architecture

## Architectural objective

Converge Developer Lens on one reusable path:

```text
Source / imported fixture
        │
        ▼
Capability-gated connector or importer
        │
        ▼
ObservationEnvelope + CoverageLedger + Lifecycle
        │
        ▼
Selected ObservationStore (SQLite v3)
        │
        ▼
LensDefinition
  ├─ observation query
  ├─ parameter contract
  ├─ support / abstention
  ├─ deterministic analysis
  └─ finding construction
        │
        ▼
Finding + EvidenceGraph + Limitations + Alternatives
        │
        ▼
Projection Registry + Sink Policy
  ├─ Product API/UI
  ├─ local export
  ├─ C0 public showcase
  ├─ Lab handoff
  └─ CommitAtlas profile projection
```

Cross-cutting controls:

```text
Capability state · data class · sink policy · coverage/missingness
provenance hashes · deletion lineage · budget · cancellation
```

## Why this architecture

The repository currently has two material data planes:

1. a stable legacy dashboard produced as whole-file JSON and rendered by the Story experience;
2. a V2 SQLite/evidence architecture exposed through `/api/v2`.

The second plane is much richer but has too few analytical consumers. A lens kernel makes #174 a reusable bridge instead of another bespoke vertical.

## Component responsibilities

### 1. Connector / importer

Owns acquisition only:

- bounded source request;
- allowlisted fields;
- page receipts and checkpoints;
- raw-to-observation projection;
- collection coverage;
- no analytical claim language.

### 2. Observation store

Owns durable facts and lifecycle:

- normalized provider facts;
- explicit scope and window;
- coverage/job/capability state;
- content-free lifecycle and deletion lineage;
- no UI prose;
- no public-ready aliases as canonical identity.

### 3. LensDefinition

Owns an analytical question:

```ts
interface LensDefinition<Row, Params, Result> {
  id: string
  version: string
  requiredCapabilities: string[]
  assessSupport(rows: readonly Row[], params: Params): LensSupport
  analyse(rows: readonly Row[], params: Params): Result
  toFinding(result: Result, context: EvidenceContext): Finding
}
```

A lens must define:

- construct and question;
- eligible cohort;
- parameters and sensitivity bases;
- support floor;
- missingness and exclusion policy;
- deterministic estimator;
- limitations and unsupported decisions;
- evidence references;
- public/synthetic compatibility.

### 4. Finding and EvidenceGraph

This is the **canonical internal analytical output**. It should be richer than any public wire format.

A finding should contain:

- stable finding ID and method version;
- subject class, scope and window;
- observed measurements;
- derived estimates;
- support assessment;
- coverage and exclusions;
- limitations and counter-evidence;
- supported and unsupported decisions;
- evidence edges;
- correction/supersession lineage.

### 5. Projection registry

Projections are consumers, not sources of truth.

Each projection defines:

- source finding versions it accepts;
- target schema;
- allowed data class;
- field-level transformations;
- closed copy/registry vocabulary;
- denial corpus;
- provenance and hash method;
- sink policy.

Examples:

- `PublicLensProjection.v1`
- `ResearchFindingProjection.v2`
- `MethodTrialSummary.v1`
- Product API finding response
- local portable export.

### 6. Sink policy

One central evaluator should answer:

```text
Can value V of data class C, with provenance P,
be sent to sink S under capability state A?
```

Do not encode this separately in every exporter.

## Contract generation architecture

Use one Product-owned executable registry to generate:

- Draft 2020-12 JSON Schema;
- README registry tables;
- typed fixture builders;
- positive and negative conformance vectors;
- rule-set hash;
- consumer compatibility manifest.

Keep two validation layers explicit:

1. **structural schema** — portable JSON shape;
2. **semantic validator** — cross-field derivation, registry and hash invariants.

Never claim JSON Schema parity for invariants it cannot express.

## Gate architecture

ResearchFinding v2 gate proposal:

```ts
interface EvidenceGate {
  code: GateCode
  verdict: 'pass' | 'fail' | 'not_applicable'
  rule: {
    id: string
    version: string
    parametersHash: `sha256:${string}`
  }
  evidence: MeasurementRef[]
  notApplicableReason?: NotApplicableCode
}
```

Rules:

- `pass`/`fail` requires all rule evidence.
- `not_applicable` requires a closed reason.
- a verdict is recomputed during validation;
- prose labels are generated from the rule registry;
- a projection cannot override source decision semantics.

## Legacy migration

Use a strangler pattern:

- v0.1 Story remains stable except fixes.
- all new System and Research work uses V2.
- add an adapter only when an old Story surface is materially changed.
- remove a legacy field after its final consumer migrates.
- never require a big-bang rewrite before #174.

## Process boundaries

### Product

- stable schemas and registries;
- deterministic analysis needed by the UI;
- data/sink/capability enforcement;
- selected-store and evidence graph;
- public C0 exhibits.

### Lab

- estimators, benchmarks and model sensitivity;
- preregistration;
- model cards and rejected candidates;
- reviewed projection generation against Product contracts.

### CommitAtlas

- read-only presentation consumer;
- vendors an exact Product fixture/schema commit;
- never reinterprets coverage or gate semantics;
- fails closed on unknown versions.

### Taskdeck

- planning/intake and execution coordination;
- imports this bundle as non-authoritative intelligence;
- writes back only through explicit integration/activation authority.

## Avoid premature architecture

Do not add yet:

- arbitrary runtime code plugins;
- networked hosted multi-user service;
- universal event bus;
- generic workflow engine;
- dynamic schema marketplace;
- distributed workers;
- cross-installation identity graph;
- model-generated observed facts.
