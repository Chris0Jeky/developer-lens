# Developer Lens showcase demo

Duration: **3-5 minutes**

Use the [live synthetic V2 story](https://chris0jeky.github.io/developer-lens/?demo=v2) for the
shortest walkthrough. The regular [public showcase](https://chris0jeky.github.io/developer-lens/)
contains the broader dashboard and Wrapped experience.

## Boundary to state first

Everything shown on the hosted site is invented C0 demo data. The page uses no GitHub account,
repository, API credential, private dataset, or local Git history. It is a static, privacy-checked
artifact and cannot connect to a real source.

## Local fallback

```powershell
npm install
npm run dev:web
```

Open <http://127.0.0.1:5173/?demo=v2>. Stop Vite with `Ctrl+C` when the walkthrough ends.

## Talk track

1. **0:00 - Set the premise.** Developer Lens asks what kind of development system a body of work
   became. It reflects on repositories, delivery flow, feedback, and attention patterns rather than
   rating people.
2. **0:30 - Show the evidence ladder.** Move through **Observed**, **Derived**, and **Hypothesis**.
   Observed is a direct synthetic fact; Derived combines facts through deterministic rules;
   Hypothesis is explicitly an interpretation.
3. **1:30 - Inspect the guardrails.** Point out the evidence, confidence, and limitation text. A
   missing or partial source lowers coverage; it is never converted into zero activity.
4. **2:15 - End with reflection.** On the Hypothesis card, read **Question to carry forward**. The
   product asks what evidence could change the interpretation instead of prescribing an action or
   producing a productivity score.
5. **3:00 - Widen the view if useful.** Open the regular public showcase to show the interactive
   dashboard, project constellation, Signal Lab, and Wrapped story, all generated from the separate
   synthetic dataset.

## What has been achieved

- A public, responsive, synthetic dashboard and Wrapped story with a verified private/public split.
- A typed C0 evidence story that keeps observed facts, deterministic derivations, and hypotheses
  visibly distinct, including confidence, limitations, and the reflection question.
- Default-off GitHub-core foundations for confined task cards, projected public GET transport,
  complete/noncomplete coverage, stable two-read classification, opt-in SQLite persistence, and
  task-owned installation-key continuity.
- Default-off OpenAI/Luna foundations for strict local C1 retrieval, a user-reviewable bounded
  request, structured output validation, spend/usage limits, and a one-call HTTP adapter.

## Claims to avoid

- Do not say the selected real repository or any other repository has been read through the new
  activation runner.
- Do not say the OpenAI/Luna adapter has been invoked; the environment credential remains unread by
  Developer Lens and `cap.external.model` remains `never_authorized`.
- Do not present the hosted artifact as a private dashboard, production activation, workplace
  analytics, or a person-scoring system.
- Do not present pseudonymous aliases or aggregate patterns as anonymous or complete when coverage
  says otherwise.

## Reproduce the proof

```powershell
npm run test:demo:v2
npm run check
npm run build:showcase
```

`build:showcase` regenerates the invented public data, renders the social card, builds the Pages
artifact, verifies synthetic identities and export boundaries, and scans for credential and local-
path patterns.
