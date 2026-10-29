# Replay context snapshot — 2026-10-29

## Follow-up boundary

This follows #451's safe receipt/restore path with a narrower hardening of the direct internal authority-consumer helper. The production receipt already supplied a frozen context. The helper itself now completes all caller-controlled object inspection before reading the current opaque-handle state, preventing reentrant metadata access from redeeming an authority and then letting the outer call reuse a cached record.

The context must have exactly the seven expected enumerable own data fields, a plain or null prototype, and canonical primitive values. Accessors, extra keys and custom prototypes are refused without spending authority. A proxy trap may perform one legitimate nested redemption during snapshotting; the outer call then observes the consumed handle and fails. Later binding comparisons read only the frozen snapshot. The state-leaf change removes its extra EOF blank line.

## Discriminating evidence

- Tests were written first for getter non-invocation with a valid retry, proxy reentry with exactly one redemption, and malformed shapes followed by a valid null-prototype retry.
- A supplementary probe using the actual consumer and context-helper source failed all three cases before implementation and passed all three afterward. Marker revalidation and date/task validators were controlled dependencies; this is not full-module, SQLite or native-filesystem proof.
- Independent review found no actionable defect and verified compatibility with the existing frozen receipt context. The complete patch and explicit new-file whitespace were checked. Full exact-head hosted tests, compilation and PR checks are recorded in the PR before merge.

## Limits and rollback

This does not claim confinement of arbitrary hostile JavaScript in the same process. No timestamp-selection option, marker bytes, schema, persistence, retention, activation or owner authority changes. An ordinary reviewed source/test revert rolls back this follow-up; no data migration is needed.
