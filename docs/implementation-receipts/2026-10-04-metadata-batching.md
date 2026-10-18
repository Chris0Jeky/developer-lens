# Bounded Git-index metadata commands (#257)

## Decision

The context verifier passed every eligible pathname to one `git ls-files --stage -z` command. Replace only that transport with preplanned literal batches: at most 128 paths and a conservative 12,000-unit UTF-16/quoting estimate including fixed arguments and executable headroom. Preflight the entire selection before executing any batch. Empty input produces no command; duplicate, NUL-containing or individually oversized paths fail with content-free errors.

Each batch uses the existing fatal UTF-8/NUL parser and must return exactly its requested paths once. The original protected-path classification, blob-by-object-ID reads and two-complete-snapshot reconciliation remain unchanged. This bounds arguments, not total output, large-blob policy, native executable path length or hostile concurrent Git-index mutation. Those #257 residuals are not closed by this slice.

## Proof and recovery

Base: `257a3cbf02c49a2bfc5eee376e147fcd282d0675`. The original verifier blob is `5a037ec088176c31d5bfa1cefa49c72b88cf34ca`; the existing validation module remains unchanged. Thirty tests cover literal metacharacters, Unicode/control characters, large selections, preflight failure, batch reply reconciliation, protected paths, changed snapshots and a real temporary Git index with 152 invented files.

Before implementation, the immediate/unbounded planner plus the actual existing adapter produced 15 failing assertions and 15 passing controls. After implementation all 30 passed under supplementary Node registration. That probe uses the actual relevant validation source, strips unused YAML/Zod imports and TypeScript types, and substitutes only test registration/import suffixes. It is not full Vitest, whole-module initialization, native Windows or application proof. Ordinary exact-head hosted checks and independent review are required before merge.

The task-local npm install ended with `Exit handler never called!`; no local full-suite pass is claimed. No repeated install or registry workaround is selected. The separately held fast-uri #406 candidate remains unapplied. An attempted temporary write-enabled blob-transfer workflow was blocked before creation and abandoned; no permission/ref/credential change resulted. The public issue records this friction. This receipt preserves the failure locally in source; the large central friction log and historical ledger were not rewritten by this transport-limited slice.

Rollback: revert the new adapter and its one verifier call-site change through a reviewed PR. No dependency, existing workflow, authority, real-data, model, telemetry, release or owner gate changes. Keep #257 open for the independent large-blob/binary policy residual.
