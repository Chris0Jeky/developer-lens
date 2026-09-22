# Expansion ideas

These are deliberately separated from the execution queue.

## Near-adjacent ideas

### 1. Lens comparison ledger

Allow a user to compare two interpretations of the same evidence:

- method version;
- changed assumptions;
- resulting finding changes;
- support/coverage difference;
- reason one superseded the other.

This fits the existing correction/supersession philosophy and makes analytical evolution visible.

### 2. “What changed in our understanding?”

A retrospective surface that shows:

- new evidence since the previous run;
- findings strengthened, weakened or withdrawn;
- coverage changes;
- newly unsupported claims;
- method-version changes.

This is more distinctive than another static dashboard.

### 3. Evidence debt

Track system-level areas where a decision matters but evidence is persistently incomplete:

- source unavailable;
- instrumentation absent;
- censoring;
- incomparable eras;
- unimplemented producer.

Do not turn this into a score. Present it as an investigation queue.

### 4. Counterfactual-free intervention tracker

Record a user-declared engineering change and observe post-change evidence without claiming causality:

- intervention date/window;
- expected mechanism;
- metrics to watch;
- confounds;
- pre/post descriptive comparison;
- “not enough evidence” path.

This can become a powerful maintainer observatory feature while retaining epistemic restraint.

### 5. Architecture drift atlas

Use source-structure metadata to show:

- module addition/removal;
- dependency-cycle appearance;
- API-surface movement;
- concentration and coupling changes;
- generated/config/agent role changes.

Pair every structural statement with parser coverage and unsupported-language caveats.

### 6. Release confidence packet

Generate an owner-readable packet per release:

- exact code/provenance;
- coverage;
- known residuals;
- security/dependency state;
- synthetic visual proof;
- rollback notes;
- explicit unsupported claims.

Developer Lens could dogfood its own evidence architecture for release governance.

## Query ideas

### Deterministic first

- “Which repositories have the longest integration tail under comparable coverage?”
- “Which conclusions changed when partial coverage was excluded?”
- “Where did batch-size sensitivity disagree?”
- “What is currently unanswerable and why?”
- “Which release periods changed feedback shape?”
- “Show counter-evidence for this finding.”

### Model-assisted later

Use Luna only to:

- compose hypotheses from retrieved evidence;
- propose alternative explanations;
- summarize contradiction;
- draft questions for investigation.

Never allow it to:

- create observed facts;
- silently select evidence;
- activate a source;
- send external actions;
- output person-level judgement.

## Portfolio integration

### CommitAtlas

Public profile scenes should consume only a narrow projection:

- project constellation;
- work/system signature;
- bounded craft themes;
- delivery shape;
- controlled narratives;
- coverage warnings.

Never expose the private dashboard object or raw timeline.

### Taskdeck

Taskdeck can receive:

- open questions;
- evidence-debt captures;
- confirmed decisions;
- implementation tasks;
- release proof packets.

Taskdeck should not become the source of analytical truth; it is the execution surface.

### NavSentinel / agent-harness

Potential shared patterns:

- capability receipts;
- sink-policy evaluation;
- evidence-backed decision exports;
- local support bundles;
- exact-head release proof.

Share patterns through small libraries or documented contracts only after two real consumers exist.

## Longer-term product shapes

### Personal engineering retrospective

Strongest near-term story: private, reflective, aesthetically rich and evidence inspectable.

### Maintainer observatory

Likely strongest standalone utility: integration tail, feedback loops, dependency/release health, structural change and evidence debt.

### Engineering lead/team direction

Plausible after aggregate mode and governance proof. Keep audience, scope, uncertainty and non-person interpretation explicit.

### Research platform

Credible through the Lab, packs and model cards, but should remain a companion capability rather than dominate Product navigation.

## Ideas to reject or postpone

- universal developer score;
- public comparison leaderboard;
- hosted ingestion service before local product-market learning;
- automatic raw-code upload;
- arbitrary third-party runtime plugins;
- opaque AI recommendations;
- every possible GitHub endpoint;
- cross-product identity graph;
- gamified targets based on descriptive metrics.
