# Developer Lens showcase demo

Primary duration: **5-8 minutes**

Use the [live Method Trial](https://chris0jeky.github.io/developer-lens/?view=method-trial) for the
complete decision story. It shows why a more complex detector was rejected while the deterministic
baseline remained. The earlier [synthetic V2 story](https://chris0jeky.github.io/developer-lens/?demo=v2)
remains the shorter 3-5 minute product-only fallback. The regular
[public showcase](https://chris0jeky.github.io/developer-lens/) contains the broader dashboard and
Wrapped experience, including a visible link to the Method Trial under *Coverage & privacy*.

## Boundary to state first

Everything shown on the hosted site is invented C0 demo data. The page uses no GitHub account,
repository, API credential, private dataset, or local Git history. It is a static, privacy-checked
artifact and cannot connect to a real source.

## Local fallback

```powershell
npm install
npm run dev:web
```

Open <http://127.0.0.1:5173/?view=method-trial>. The committed fixture makes this route independent
of the API and lab. For the shorter fallback, open <http://127.0.0.1:5173/?demo=v2>. Stop Vite with
`Ctrl+C` when the walkthrough ends.

## Primary Method Trial talk track

1. **0:00 - Set the premise.** Developer Lens asks what kind of development system a body of work
   became. It reflects on repositories, delivery flow, feedback, and attention patterns rather than
   rating people. State the C0 boundary before interpreting a number.
2. **0:45 - Ask the method question, then show the verdict.** BOCPD was tested as a candidate for
   reducing false alerts without giving up detection. Lead with **REJECTED**: this is a strong
   decision from an invented benchmark, not a failed experiment and not evidence about a real
   repository.
3. **1:30 - Compare the methods.** Contrast the rolling median/MAD baseline with Gaussian BOCPD.
   Keep PELT in its declared role: an offline descriptive boundary cue, never an online candidate or
   promotion result.
4. **2:15 - Read the paired scorecard.** Baseline and candidate detection are both `0.75`. False
   alerts rise from `2.966666666666667` to `4.2` per year: `1.2333` extra, or about `41.6%` more.
   Show delay and candidate Brier `0.017341137335170863` where measured; leave unavailable values
   visibly unavailable. Neither selected configuration met its viability gate.
5. **3:15 - Inspect the three deterministic timelines.** Show one no-change control, one planted
   level change, and one parser-shift instrumentation confound. These are selected by a declared
   final-holdout rule and fixed tie-break, not hand-picked anecdotes. Missing observations, alerts,
   markers, and the offline PELT cue remain explicit.
6. **4:45 - Walk the acceptance ladder.** Read pass and fail labels as well as their reason codes;
   colour is supplementary. Selection viability and false-alert improvement fail. Detection, delay,
   not-worse detection, and confound checks are reported exactly as the producer exported them.
7. **5:45 - Explain why the simple baseline won.** Detection did not improve, the candidate added
   `1.2333` false alerts per year, and there was no viable selected configuration. The complete,
   deterministic baseline therefore remains the fallback.
8. **6:30 - Close on boundaries and reproducibility.** Separate supported from unsupported claims,
   then expand the disclosure only if the audience wants commits, digests, exact lab commands, and
   hosted/local verification status.

## Short V2 fallback

1. **0:00 - Set the premise and C0 boundary.** Developer Lens reflects on systems, never people.
2. **0:30 - Show the evidence ladder.** Move through **Observed**, **Derived**, and **Hypothesis**.
3. **1:30 - Inspect guardrails.** Missing or partial sources lower coverage; they never become zero.
4. **2:15 - End with reflection.** Read **Question to carry forward**, which asks what evidence could
   change an interpretation rather than prescribing action or producing a productivity score.
5. **3:00 - Widen the view if useful.** Open the regular public showcase for the dashboard and
   Wrapped story, all generated from the separate synthetic dataset.

## What has been achieved

- A public, responsive, synthetic dashboard and Wrapped story with a verified private/public split.
- A typed C0 evidence story that keeps observed facts, deterministic derivations, and hypotheses
  visibly distinct, including confidence, limitations, and the reflection question.
- A product-owned, lab-produced Method Trial artifact with closed presentation fields, deterministic
  representative-case selection, exact acceptance gates, and a visible rejection decision.
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
- Do not say BOCPD was validated for real repositories, promoted, or generally outperformed. The
  demonstrated conclusion is only that it was rejected on this bounded invented C0 trial.
- Do not present the three timelines as manually selected examples or PELT as an online result.
- Do not present pseudonymous aliases or aggregate patterns as anonymous or complete when coverage
  says otherwise.

## Reproduce the proof

```powershell
npm test -- shared/methodTrialView.test.ts src/components/MethodTrialRoute.test.tsx src/App.test.tsx
npm run check:method-trial-view
npm run test:demo:v2
npm run check
npm run build:showcase
```

The focused test validates the committed lab fixture through the normative product runtime semantics
and the standalone structural schema, renders all three cases without network access, and protects
the lazy route plus existing fallbacks. Draft 2020-12 alone is not semantic acceptance: any producer
or consumer must also enforce the runtime-equivalent cross-field rules for exact run commands,
scorecard-derived gates and decisions, threshold viability, and coherent timeline indexes/markers.
`build:showcase` regenerates the invented public data, renders the social card, builds the
Pages artifact, verifies synthetic identities and export boundaries, and scans for credential and
local-path patterns.

To reproduce the producer side from a fresh `developer-lens-lab` checkout after the demo exporter
lands, install its locked environment and run the exact disclosure recorded in the fixture:

```powershell
uv sync --locked --all-groups
uv run dllab doctor
uv run dllab benchmark wb-c1 --smoke --run-id wbc1_demo
uv run dllab run reproduce wbc1_demo
uv run dllab report build wbc1_demo
uv run dllab export method-trial wbc1_demo
uv run dllab contracts check
```

The exported `method-trial-view.json` must pass the vendored structural schema and an equivalent
implementation of the product semantic rules before it is copied into the product. Its current
SHA-256 is `dee7b6c2221eb2226e6b95363da752f1834994d64e95e328e530543ec4396435`.
