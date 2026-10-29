# Verified selection replay authority — 2026-10-29

## Boundary

This implements #177 using the existing runtime-opaque selection proof handle. First selection still takes report time from the runtime clock. Restoring an authenticated committed selection enters a synchronous authority scope, then redeems that authority once to recover the original report time and its exact seven-day grace deadline. Ordinary proof consumption returns data and destroys replay authority; return, throw or continuation after await expires unused scope authority. A retry requires a freshly verified handle.

Replay rechecks the live installation key, canonical root, exact marker bytes/signature, selection identifiers and report context before successful redemption. The production receipt entrypoint snapshots and freezes its context before passing it to the proof helper. A read/validation leaf breaks the receipt/proof dependency cycle while preserving existing public read/type/error/root-binding imports. Storage DDL and marker bytes remain unchanged.

The arbitrary-time receipt/reader fixture issuers and the plain-selection marker publisher are removed. Fixture clocks now control only Date around the real clock-owned API, with finally restoration; marker publication reads a committed validated database receipt.

## Evidence

- Tests-first head `d9ae49049826587c8c7a0ee399e98969f64987e8`, [PR gate 40805750727 / job 123224179474](https://github.com/Chris0Jeky/developer-lens/actions/runs/40805750727/job/123224179474), produced exactly three intended behavioral failures. Each former API successfully minted or published a caller-chosen time. The other 2,482 tests passed, with four existing skips; context, drift and lint checks passed.
- New authority cases cover forged/cloned, fresh, ordinarily consumed, expired and spent handles; wrong root/key/identifiers/context; changed marker bytes; double redemption; callback return/throw and post-await expiry; fresh verification after failure; and exact report/grace preservation.
- The independent reviewer checked the full production path, fixture clock migration, dependency boundary and cleanup order and found no blocking defect in the intended API paths. Node syntax checks passed for all fourteen changed/new TypeScript files; git diff --check passed. Local dependency execution remains unavailable, so full SQLite/Vitest, compilation and hosted proving are recorded separately in the PR.
- Before publication, the proposal import-ownership guard was three-way reconciled with merged #448 and #449, preserving both the read-only resolver allowance and the fourteen literal ISO-year cases.


- First implementation hosted run [40806932979 / job 123228154282](https://github.com/Chris0Jeky/developer-lens/actions/runs/40806932979/job/123228154282) passed 2,520 tests with four skips. All new authority, receipt, reader-selection and restore regressions passed. One architecture guard failed because its artifact-catalogue allowlist omitted the receipt's new type-only replay root parameter import. The repair adds that exact consumer using the existing guard convention; no production behavior changes. Fresh exact-head full proving remains required.

## Limits

The scope expires unused replay authority; an already issued, context-bound success-report proof retains its existing lifetime. The marker does not contain backupAt: replay validates its canonical shape and ordering, while restore continues to supply it from verified backup metadata. The import guard is a repository ownership check, not a hostile-code sandbox. A direct-helper accessor reentrancy hardening opportunity is separate from the intended receipt path, which supplies a frozen snapshot; it cannot select a different report time. No source activation or private input is involved.
