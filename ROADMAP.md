# Roadmap

Direction, not a schedule. There are no dates and no delivery promises here: the order below is the
dependency order the project intends to follow, and anything in it may be re-cut or dropped.

The detailed phase plan lives in [`docs/PROGRAMME_ROADMAP.md`](docs/PROGRAMME_ROADMAP.md); the
policy it answers to lives in [`docs/OWNER_CONSTITUTION.md`](docs/OWNER_CONSTITUTION.md).

## Constants

These hold across every phase.

- Local-first. Private raw data and private output stay on the machine that produced them by
  default; a deliberate, reviewed export is the user's choice, never something the product does on
  its own.
- The public showcase carries invented synthetic data only.
- Missing, censored, restricted, refused, stale, or failed evidence is never converted to zero.
- Every modelled capability keeps a deterministic fallback that works when no model is available.
- Model output is labelled as a hypothesis or candidate, never presented as an observed fact.
- The default product analyses systems, not people.

## Now — the `v0.1.0` baseline

The first tagged release is cut from what already exists, rather than waiting for the next vertical.

- The frozen Method Trial v1 exhibit as the canonical worked example of a rejected candidate.
- The offline synthetic demo and the V2 coverage cockpit, both runnable with no account and no data.
- The GitHub Pages synthetic showcase.
- Licensing, community scaffolding, and release assets around that baseline.

## Next — integrated evidence vertical

Tracked as [issue #174](https://github.com/Chris0Jeky/developer-lens/issues/174). One question
answered end to end: how long integration work takes to land, and what the tail looks like.

Survival analysis over stored observations — Kaplan-Meier curves plus an interpretable accelerated
failure time baseline, with censoring, competing outcomes, bootstrap intervals, and matched eras.
Every number stays clickable through to its evidence walk, its missingness, and a stated
counter-hypothesis. A synthetic path ships publicly; a local path runs against your own data.

## After that

**Automatic sources and real-data profiles.** A second version of the data charter with layered
data classes and explicit sink rules, plus modular capability profiles. A core profile of Actions,
Deployments, and Source Structure activates after one explicit opt-in for explicitly selected
repositories; dependencies, security aggregates, discussions, and text-rich inspection stay separate
opt-ins. No machine-wide discovery, and pause, revoke, delete, and budget controls throughout.

**Query and recommendations.** Deterministic local recommendations first, triggered by materially
changed analysis runs, with the deterministic mode remaining a complete standalone fallback.
Optional model-assisted hypotheses arrive later behind opt-in and cost ceilings. A raw-content
pipeline follows, with secret rejection, parser isolation, and adversarial-input guardrails.

**Packaging and broader modes.** Running from source today, then the companion Lab published via
`uvx`/PyPI, a thin `gh` launcher, an npm CLI, and a bootstrap desktop shell. A transparent aggregate
team mode is a separately enabled surface, never a covert or default one.

## Not planned

- Individual scoring, ranking, or any productivity, performance, effort, or surveillance metric in
  the stable product. Such constructs may be *researched* in the separate Lab under the layered
  subject policy, with consented, local, or curated data; productising any of them would take an
  explicit, recorded decision and would never happen silently.
- Publishing non-invented data or private output through the public site or release assets.
- A hosted product. No hosted service holds your history. The only server is the local API running
  on your own machine.

Ideas and requests are welcome as
[Discussions](https://github.com/Chris0Jeky/developer-lens/discussions) or issues. See
[`CONTRIBUTING.md`](CONTRIBUTING.md).
