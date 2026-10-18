# Explicit-root discovery guard

## Finding and correction

Post-merge review comment 4175505891 on #411 identified explicit roots bypassing the exclusions used for discovered children. Check resolved native path components before any stat or enumeration. Selecting an excluded directory or descendant records one content-free failed location. Other selected roots retain their spelling, discovery budgets and existing coverage handling.

Review 4175718609 then identified ambiguous trailing ASCII dots/spaces. The first correction rejects any component ending in an ASCII dot or space, both for explicit roots and discovered child directories. This conservative scope applies on all platforms, including POSIX names that could otherwise be legal; it does not rewrite names or claim all filesystems treat them as equivalent. Internal spaces, interior dots and leading-dot ordinary names remain supported. Microsoft's [Windows naming guidance](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file) documents the trailing-name and namespace distinctions. The tests show path.win32.resolve preserves those suffixes; no native Win32 filesystem execution is claimed.

This is lexical boundary enforcement, not hostile-writer confinement, complete filesystem-alias resolution or an ancestor-symlink guarantee. No caller, capability, identity, dependency, permission, telemetry or release change.

## Reproduction

Base main: f41a96aa02a2cbdb5a51efca11c3310ca4a4d909. Original helper blob: 3c8c9ea5ec597a24d9a235a57205bdead81d09f8. The initial 45 supplementary root-selection tests produced 39 assertion failures and six lookalike controls, then all passed after the root guard. Initial head 38858ac54a71926cbb36d0cd408e87ecc4f9747b passed ordinary PR gate 37168573199, but the subsequent review findings remained binding.

Twenty-nine alias tests then reproduced 25 failures with four controls. After the suffix guard all 29 alias tests and the unchanged 45 root-selection tests passed. The complete helper is executed with Node 22 type stripping and only test-registration/import-suffix adaptation. These 74 supplementary passes do not replace fresh whole-project hosted proving. Final helper blob: a5ed4707bfa92810b58a0d1976737196b79a7560; alias-test blob: e6b6a9c9b125ec1ec3b6105b063b77f47c337105.

## Execution friction and acceptance

The pinned source-archive download failed DNS. Existing supplied source was reconciled by immutable blob identity. Local preflight reports missing tsc, tsx, vite, vitest and oxlint; no local full-suite success exists. The ordinary coding-bot request explicitly reported no configured environment and started no worker. No credential, permission or network workaround was used.

The exact [central-log append patch](2026-10-04-central-friction.patch) is now preserved in this PR rather than existing only locally. Its application was verified against the original 210006-byte log prefix, yielding candidate blob 892e88e2d19d6d2889d2dabc1cfbe6c567d882be with that prefix unchanged. The actual central log is still not updated by this commit. Therefore comment 4175718614 remains unresolved and the PR must remain draft despite a green code gate until ordinary source publication satisfies that requirement. A patch is not a waiver or an applied update.

Obtain fresh ordinary exact-head tests and independent review for the changed source. Resolve the original #411 late finding only after this follow-up is delivered. Rollback is a reviewed revert; #410 identity and #406 dependency work remain separate.
