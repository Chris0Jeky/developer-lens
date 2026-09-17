# Agent start here

## Purpose

This bundle is a **non-authoritative acceleration intake** for `Chris0Jeky/developer-lens`. It contains a repository review, proposed portfolio model, decision deck, code sketches and machine-readable manifests.

The repository's own authority order remains binding. This bundle must not supersede:

1. the current user instruction;
2. repository root authority/instructions;
3. owner constitution and human-action gates;
4. current-state and programme documents;
5. reviewed task cards and source/sink policy.

## First run

1. Refresh `origin/main`, open pull requests, issues, checks, tags and releases.
2. Compare live facts with `agent/repository-snapshot.json`.
3. Mark every stale observation in a reconciliation note.
4. Read `interactive-decision-deck.html` export if the owner supplied one.
5. Validate:
   - `agent/issue-manifest.json` index and every listed part
   - `agent/decision-catalog.json` index and every listed part
   - run `node agent/materialize-manifests.mjs` to prove 52 issues and 27 decisions
   - exported decisions against `agent/decisions.schema.json`
6. Do not implement all suggestions automatically.

## Unbundling algorithm

### Step 1 — classify decisions

For each decision export:

- `confirmed`: write to the correct ADR/owner-decision location and seed dependent work.
- `proposed-default`: import as planning context only.
- `changed-unconfirmed`: create a human decision capture, not implementation.
- `deferred`: record its trigger and keep parked.

### Step 2 — reconcile issue portfolio

For each issue manifest row:

- verify it is still open;
- preserve original issue history;
- propose milestone/labels;
- do not close issues solely because this bundle groups them;
- add parent/dependency links where GitHub supports them;
- put frozen research behind explicit trigger labels.

### Step 3 — seed the execution queue

Import `agent/work_queue.json` in dependency order.

The first executable task should be `DL-ACC-00`, unless live state has already superseded it.

### Step 4 — create implementation artifacts

Use snippets as sketches, not patches. Reconcile them with actual repository types and rules.

Each seeded task must include:

- outcome;
- demonstrated problem;
- scope and non-goals;
- authority/data class/sink;
- dependencies;
- exact files likely touched;
- discriminating tests;
- hosted/local proof;
- human gate;
- rollback and residuals.

### Step 5 — preserve product focus

For H0–H2 enforce the recommended effort split:

- 70% product/data path;
- 20% adjacent hardening;
- 10% governance.

Reject a new permanent mechanism unless it removes a repeated failure or replaces existing machinery.

## Hard stops

Stop before:

- real/private source activation;
- credentials or token provisioning;
- reading protected ignored paths;
- public non-C0 output;
- remote model transmission;
- remote telemetry;
- release tag without q-10(c);
- Taskdeck write without exact reviewed integration authority;
- individual ranking/person inference;
- changing published v1 contract meaning without versioning.

## Expected first report

Return:

- live facts that differ from this bundle;
- imported confirmed/proposed/deferred decisions;
- milestone/label changes proposed;
- first three executable tasks;
- exact human gate still open;
- risks or conflicts with repository authority;
- work actually completed and proved.
