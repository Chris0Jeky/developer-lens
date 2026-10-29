# Unknown coverage-dimension refusal — 2026-10-29

## Bounded change

The exported registry helpers previously indexed arbitrary runtime keys. Unknown or inherited names could throw an incidental TypeError, while an array containing a valid dimension could be coerced into a registered key. `limitingReasonsFor` now requires a string that is an own registry key before lookup. Unknown dimensions have no registered reasons, so `isLimitingReasonRegistered` returns false for every reason, including universal absence codes.

This changes one production line and adds twelve discriminating input cases. Existing exhaustive positive controls preserve all twelve registered dimensions and their own/universal codes. The helpers' TypeScript signatures remain unchanged. Production callers already receive typed or schema-enum-validated dimensions; this is exported-helper robustness, not evidence of an observed persisted-data failure.

## Evidence and limits

- Tests were written before the guard. An actual-source probe evaluated the checked-in registry and helper source after Node type stripping, without importing Zod or Vitest. All twelve invalid-input expectations failed before the guard and passed afterward; all twelve known dimensions retained their reason lists and registrations.
- Tests cover unknown/empty/wrong-case and inherited names, null/undefined, number, symbol, array, and an object whose coercion throws. Every invalid case denies the complete registered reason enum.
- Independent review verified the two-file diff and exact source/test blobs, with no actionable findings. Diff and syntax checks passed. The probe does not establish full-module/schema/Vitest/compiler proof; exact-head hosted results are recorded in the PR.

No registry entry, source_diversity formula or clamp decision, producer-unavailable code, schema, version, projection or frozen v1 artifact changes. #76 remains open for those substantive policy/producer decisions. Rollback is an ordinary source/test revert.
