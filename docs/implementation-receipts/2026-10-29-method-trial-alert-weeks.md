# Method Trial alert-week text alternatives — 2026-10-29

## User-visible behavior

Every declared baseline or candidate alert week now appears in the timeline's text alternative. Rows name the two methods independently, including simultaneous alerts and consecutive alerts inside a persistent planted-change or confound run. Ordinary weeks still collapse; missing/marker transitions, run endings and every offline PELT boundary remain visible.

The observation/marker transition state is unchanged. Alert presence selects its own week rather than manufacturing an extra end-of-alert transition. This fixes the remaining alert-week accessibility item in #189; its semantic and paired-Lab contract work remains open. No frozen research schema, fixture, hash or analytical decision changes.

## Verification

The corrected tests-only head `d1e81e395a9be64ec35f9b2f6ab54a530be11d7e` ran as integration `45a1cfd` into main `bae3bdd` in [hosted run 40803598176](https://github.com/Chris0Jeky/developer-lens/actions/runs/40803598176), job `123217410631`. Exactly the ten new cases failed because alert weeks or method labels were absent. The other 2,459 tests passed, with four skipped. Transition-only scenes clear unrelated fixture alerts in cloned setup; canonical fixture bytes are untouched.

Native Node 24 evaluation of the actual selector/label source passed 12 behavior scenarios after implementation, including every committed alert week and PELT boundary. `git diff --check` passed. Local npm/React/compiler/build validation is unavailable because the executor cannot install the pinned dependency graph. Final exact-head required proving, showcase proof and independent review are recorded on [PR #446](https://github.com/Chris0Jeky/developer-lens/pull/446).

These are automated rendered-text and selector assertions, not native assistive-technology or physical-device acceptance. Rollback is an ordinary revert of the presentation/test slice.
