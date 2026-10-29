# Backup identity and restore cleanup — 2026-10-29

## Scope

Two bounded follow-ups for #142 and #168. Reject an ambiguous all-zero backup file identity before catalogue mutation, while retaining valid identities where just the device or inode is zero. Keep the restore copy's temporary descriptor owned until the backup source has been closed successfully.

The source descriptor is relinquished before its single close attempt. An error after a close may already have released the descriptor; retrying it could close an unrelated descriptor if the number were reused. The temporary descriptor remains owned and is cleaned up on that failure path.

## Evidence

- The initial tests-only commit `fd5c1adba55161fc2d43b56e071a775dd8ccf322` was exercised by PR gate run [40803530116](https://github.com/Chris0Jeky/developer-lens/actions/runs/40803530116). It produced the three intended regression failures: two accepted all-zero identities and the leaked temporary descriptor. The other 2,463 tests passed, with four platform skips.
- The regression covers both SQLite and manifest identities, accepts each supported single-zero pair, checks immutable catalogue binding, and exercises a real filesystem source-close failure after the copy handoff.
- Independent review of the first implementation found that its cleanup could retry an ambiguous source close. The revision relinquishes source ownership before closing and asserts exactly one close attempt. A supplementary actual-source Node 24 probe failed with two close attempts before the correction and passed with one afterward; it also checked the temporary descriptor was closed, the temporary file removed, and backup bytes unchanged.
- The full restore regression additionally checks backup, manifest and selection-proof bytes remain unchanged and a fresh verified retry restores the same selection.
- Local `git diff --check` and syntax checks pass. The executor cannot install dependencies because registry access is denied. Full Vitest, SQLite restore/retry, lint, build and showcase verification therefore belong to the exact final GitHub Actions head; the PR records those results when available.

This slice changes no persistent schema, retention policy, activation route or private inputs. The umbrella issues remain open for their other native-host and durable-proof acceptance items.
