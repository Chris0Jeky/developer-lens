# Contributing to Developer Lens

Thanks for looking at Developer Lens. This is a small, opinionated project with an unusual
constraint: it analyses development history, so its contribution rules are stricter about data than
about code style.

Read this file, then [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). If you want the deeper design
context, [`CLAUDE.md`](CLAUDE.md) is the repository canon and
[`docs/data-charter.md`](docs/data-charter.md) is the binding data boundary.

## The data rule (read this first)

Developer Lens is local-first. Real collected data lives in the gitignored `.developer-lens/`
directory and never leaves the machine that produced it. The public GitHub Pages showcase is built
from invented synthetic data only.

Everything you contribute must follow the same split:

- **All fixtures are invented.** Test data, demo data, and showcase data are class `C0` in the data
  charter: made-up repositories, made-up subjects, made-up events. Do not derive a fixture from a
  real repository, even your own, and even if it looks harmless.
- **Never include real or private data.** No `.developer-lens/` content, no generated
  `public/data/` output, no real repository or organisation names, no pull-request titles, issue
  bodies, commit subjects, file paths, or usernames taken from an actual history.
- **Never include real credentials.** Tokens, keys, cookies, `gh` auth material, and anything
  genuinely secret must not appear in a branch, a test, a screenshot, or an issue comment. The
  exception is deliberate: rejection and privacy tests need clearly invented secret-shaped canaries
  to prove that the guards actually fire, and the data charter requires them. Keep such a canary
  obviously fake, confine it to the test that exercises the guard, and never let one survive into a
  generated fixture, golden file, export, or any other persistent output.
- **Screenshots and recordings count as data.** Redact or, better, capture them from the synthetic
  demo (`npm run dev:web`, then `?demo=v2`).

If you are unsure whether something is safe to attach, invent a substitute instead. An invented
example that reproduces the bug is always acceptable; a real one may not be.

## Setting up

Prerequisites: Node.js, Git, and (only for the private local lens) an authenticated
[GitHub CLI](https://cli.github.com/) session. Contributing to the code and the synthetic demo needs
no GitHub authentication at all.

The hosted gate proves on **Node 24**, so that is the safest choice. The locked toolchain sets the
floor: Vite 8 declares `^20.19.0 || >=22.12.0`, so an older 20.x or 22.x will not run the build. Use
one recent even-numbered LTS major per installation; odd majors such as 21 are not supported.

```powershell
npm ci
npm run dev:web   # offline synthetic demo at http://127.0.0.1:5173/?demo=v2
```

**Use one Node major version per installation.** `better-sqlite3` is compiled against a specific
Node ABI, so switching Node major versions between installs produces confusing native-module load
failures. If you switch, delete `node_modules` and run `npm ci` again.

On Windows, use PowerShell and quote every path. Prefer explicit Vitest paths over shell globs,
which expand inconsistently across shells.

## Proving a change

Run the narrowest command that actually exercises what you changed, then the aggregate before you
open the pull request.

| What you changed | Narrow proof |
|---|---|
| Offline V2 demo UI | `npm run test:demo:v2` |
| Server behaviour or one contract | `npm test -- <explicit-test-path>` |
| Analysis pack | `npm test -- server/analysisPack/analysisPack.test.ts` |
| Storage or importer | `npm test -- server/storage/migration.test.ts` |
| Documentation, authority files, skills | `npm run verify:context` and `git diff --check origin/main..HEAD` |
| Any code or configuration milestone | `npm run check` |
| Public, demo, or export seam | `npm run build:showcase` |

`npm run check` runs the linter, context verification, the generated-artifact drift checks, the test
suite, and the production build. `npm run build:showcase` additionally rebuilds the synthetic export
and runs the privacy checks that guard the published artifact. Give `git diff --check` an explicit
range (`origin/main..HEAD`); the bare form inspects only the working tree and misses whitespace you
have already committed.

The hosted gate runs one check that `npm run check` does not: the Taskdeck planning-artifact drift
guard, `node docs/analyser-program/taskdeck/tools/generate.mjs --check`. Run it yourself if you touch
that tooling or its generated manifests, otherwise the first sign of drift is a red gate.

A run that never touches the files you changed is not a proof. Say in the pull request which command
you ran and what it covered.

## Pull requests

- Branch from `main`; keep one pull request to one coherent change.
- Commit in small logical increments with plain, factual messages.
- Open the pull request **ready for review**, not as a draft, once the work is complete.
- The hosted gate `Prove the pull request` (`.github/workflows/pr-gate.yml`) must be green. It is
  required by branch protection and a failure blocks the merge; failures are investigated, never
  dismissed as flaky.
- Merges use a **merge commit**. Squash-merging is disabled on purpose so the commit history and
  count survive.
- Fill in [the pull request template](.github/PULL_REQUEST_TEMPLATE.md) honestly, including what you
  did *not* verify. An accurate gap is more useful than an optimistic claim.

Documentation and authority files (`CLAUDE.md`, `AGENTS.md`, `docs/data-charter.md`,
`docs/source-capability-matrix.md`, `docs/OWNER_CONSTITUTION.md`, `HUMAN_TODO.md`) are checked by
`npm run verify:context` for required markers, internal links, and size budgets. Edit them with care;
they are load-bearing for both humans and agents.

## Reporting bugs and proposing features

Use the [issue templates](.github/ISSUE_TEMPLATE). Bug reports need an invented reproduction, the
command you ran, and what happened instead. Feature proposals should say which problem they solve
and how the result stays inside the data boundary above. Open-ended questions are better as
[Discussions](https://github.com/Chris0Jeky/developer-lens/discussions).

## Licence and contributor agreement

Developer Lens is licensed **AGPL-3.0-only**, copyright Cristian Tcaci. By opening a pull request you
are proposing your contribution under that licence.

The maintainer intends to review whether substantial external contributions should also be covered by
a contributor agreement. That review has not happened yet, and no agreement text exists in this
repository. Until it does, expect a substantial external contribution to wait on that decision. This
paragraph states intent only and is not legal advice or a legal instrument.

## Scope and expectations

This is a personal project maintained in the open. Direction is set by the maintainer and summarised
in [`ROADMAP.md`](ROADMAP.md). Small fixes, honest bug reports, documentation corrections, and
accessibility improvements are the easiest contributions to accept. Large architectural proposals are
best raised as a discussion or issue before you write the code.
