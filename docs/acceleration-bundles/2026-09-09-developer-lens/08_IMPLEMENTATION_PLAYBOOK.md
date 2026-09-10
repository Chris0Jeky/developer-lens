
# Implementation playbook

## A. Release closeout

### Live-state reconciliation

Update all execution-facing state in one bounded slice:

- `docs/analyser-program/CURRENT_STATE.md`
- Product #200 comment/body if needed
- Lab #29 current sequence
- Taskdeck generated pack
- implementation ledger entry

Record:

- current Product and Lab heads;
- only open Product PR #323;
- #309 merged and its successor issues;
- zero tags/releases;
- exact q-10(c) status.

### Security dependency PR

Before merge:

1. confirm PR #323 still targets current `main`;
2. inspect only package/lock changes;
3. confirm the exact-head hosted gate;
4. merge normally;
5. verify Product Pages/main push gate;
6. update the release proof commit.

### Release metadata

Recreate rather than recover #298:

- bump package and lock version to `0.1.0`;
- produce changelog from current history;
- include AGPL/community, synthetic showcase, evidence architecture and Method Trial;
- do not claim real-data readiness;
- attach C0 assets only;
- publish a checksum manifest.

## B. PublicLensProjection.v1 (#304)

### Recommended wire shape

```json
{
  "schemaVersion": "PublicLensProjection.v1",
  "dataClass": "C0",
  "generatedAt": "2026-09-09T00:00:00Z",
  "coverage": {
    "complete": 8,
    "partial": 1,
    "unavailable": 1,
    "total": 10,
    "coverageRatio": 0.8,
    "coverageMethodId": "status-count-ratio.v1",
    "warnings": []
  },
  "themes": [
    { "key": "feature", "share": 0.31 },
    { "key": "other", "share": 0.04 }
  ],
  "delivery": {
    "medianMergeHours": 18.5
  },
  "narratives": [],
  "provenance": {
    "producerCommit": "...",
    "inputHash": "sha256:...",
    "projectionHash": "sha256:..."
  }
}
```

### Coverage formula

```ts
coverageRatio =
  total === 0
    ? null
    : complete / total
```

Do not silently count partial as complete. If a later consumer needs a weighted ratio, introduce a different `coverageMethodId` and schema version.

### Required tests

- 0/0 returns `null`, not zero or one;
- 8 complete, 1 partial, 1 unavailable produces 0.8;
- historical 80 versus 0.8 mismatch fails;
- unknown theme keys fold into `other`;
- known warning code round-trips;
- unknown warning code fails closed;
- C1 requires explicit acknowledgement;
- public sink rejects C1;
- URL, email, path, exact absolute date and identity-shaped prose denial fixtures;
- generated fixture validates and deep-equals after parse.

## C. ResearchFinding v1 hardening

One bounded PR:

- normalize README parser behavior across LF/CRLF;
- reject lone surrogates before canonical hashing;
- ensure every public `safeParse` returns a result, never throws;
- require non-whitespace text without transforming hashed values;
- broaden denied `@` detection to fail closed on address literals and emoji domains.

Example fail-closed check:

```ts
const atToken = /@[^\s@]/u
```

This deliberately over-matches. At a public projection boundary false positives are preferable to undocumented identity leakage.

## D. ResearchFinding v2

### ADR decisions

- v1 remains immutable.
- every exported gate is derivable from transported evidence;
- source trial rules remain authoritative;
- false-alert gate uses the preregistered 20% threshold;
- `This trial does not promote a model.` is outcome-neutral;
- threshold viability limitation is generated from threshold evidence;
- bundle hash proves transport integrity, while rule recomputation proves semantic consistency.

### Compatibility

Product publishes first. Lab exports second. CommitAtlas consumes only after both are pinned.

Ship:

- `schema.json`
- semantic validator
- README registries
- C0 fixture
- mutation corpus
- compatibility manifest
- migration note from v1.

## E. Lens kernel

Start with no framework package. Add a small internal module:

```text
server/lenses/
  contracts.ts
  registry.ts
  support.ts
  integrationTail/
    definition.ts
    query.ts
    estimator.ts
    finding.ts
    fixtures.ts
    *.test.ts
```

Register one lens. Generalize only the repeated portions observed during implementation.

### Support assessment

Provisional versioned parameters:

```ts
{
  minimumEligible: 20,
  minimumMergeEvents: 10,
  minimumPerGroup: 5,
  maximumMissingBatchFraction: 0.20
}
```

These are initial display-safety parameters, not scientific constants. Surface them in method provenance.

## F. #174 observation bridge

### Query boundary

Input:

- accepted selected-store handle;
- scope ID;
- half-open UTC window;
- required capability IDs;
- optional cancellation signal.

Output:

- presentation-safe PR observations;
- coverage vector;
- exclusions;
- deletion/tombstone lineage references;
- capability state;
- evidence references.

Do not expose:

- storage row IDs;
- repository names in generic finding identity;
- exact provider cursor;
- credentials;
- raw prose;
- operational timestamps at a finer grain than the lens requires.

### Cohort

V1 recommendation:

- include PRs with `created_at` inside `[start, end)`;
- merged time is event of interest;
- closed without merge is a competing outcome;
- open at end is right-censored;
- exclude invalid negative durations;
- report missing additions/deletions/changed-files separately;
- never coerce missing batch size to zero.

### Batch-size bases

- primary: changed files;
- sensitivity 1: `log1p(additions + deletions)`;
- sensitivity 2: continuous percentile rank;
- optional coarse groups only for display, with threshold provenance.

### Product estimators

- Kaplan–Meier merge-survival curve;
- at-risk table;
- cumulative incidence or clearly labelled competing-outcome table;
- median only when estimable;
- deterministic seeded bootstrap intervals;
- effect summaries as descriptive contrasts, not causal coefficients.

### Lab sensitivity

- Weibull and log-normal AFT;
- preregistered covariates only;
- convergence diagnostics;
- no Product promotion unless real-data validation and owner gates later permit it.

### UX

The surface must show:

- the question;
- eligible/event/censored/competing counts;
- batch definition;
- tail comparison;
- coverage and exclusions;
- sensitivity agreement/disagreement;
- supported decisions;
- unsupported decisions;
- an evidence drawer entry for every number.

## G. Safe activation programme

Implement #202 as one programme, not unrelated PRs:

1. canonical local identity before ASCII storage;
2. duplicate source identity rejection;
3. installation key creation/continuity/recovery;
4. minimum two-probe request budget;
5. content-free coverage IDs;
6. one trusted writer;
7. immutable selection/restore proof;
8. deletion and stale-backup replay;
9. exact activation card;
10. one bounded canary.

The exit proof should be a single reproducible script/report, not scattered comments.

## H. Local API packaging hardening

Before npm/gh/desktop distribution:

- random high-entropy per-launch bearer token;
- bind token to process lifetime;
- reject browser cross-origin requests by default;
- explicit origin/CSRF policy;
- no token in URL, logs or generated exports;
- port chosen dynamically or conflict-safe;
- content-free error responses;
- clean shutdown and stale-process handling.

## I. Performance priorities

Do not optimize from issue size alone.

Measure first:

- main browser chunk composition (#217);
- selected-store query time for #174;
- bootstrap runtime and memory;
- deletion planner stages for #183.

Prioritize performance only when it affects:

- interactive page load;
- a release/proving timeout;
- supported owner-data scale;
- deletion/revocation SLA.
