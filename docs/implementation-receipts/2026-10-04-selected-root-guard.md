# Explicit-root discovery guard

## Finding and correction

Post-merge review comment 4175505891 on #411 identified a path into the protected-data boundary: explicit roots were sent directly to traversal while only discovered children received exclusion checks. This follow-up checks resolved native path components against the same case-insensitive single-component and parent/child exclusions before any stat or enumeration. Selecting an excluded directory or any descendant records one content-free failed location. Other selected roots remain eligible; their spelling, discovery budgets, symlink policy and coverage propagation are unchanged.

This is lexical boundary enforcement, not hostile-writer confinement or a new realpath/ancestor-symlink guarantee. No collection caller, capability, identity, dependency, permission, telemetry or release changes.

## Reproduction

Base is main f41a96aa02a2cbdb5a51efca11c3310ca4a4d909. The recovered helper was checked against Git blob 3c8c9ea5ec597a24d9a235a57205bdead81d09f8 before editing. Forty-five supplementary tests initially produced 39 assertion failures and six passing lookalike controls. The guard then passed all 45 unchanged tests, including mixed safe/refused ordering, normalized dot segments, case variants, descendants, pre-access refusal and an invented temporary directory tree using the default filesystem adapter.

The runner adapts only Vitest registration to node:test and the helper import suffix, using Node 22 type stripping. It executes the complete helper without replacing production functions. It does not establish full Vitest, native Windows or whole-project success. Changed helper blob: 54f1c600204108fb838508cd747195b39c0c962a. Test blob: 9422b95cfddc87d8301e50d59327661e5a1b83de.

## Execution friction and acceptance

A public pinned-archive download failed DNS resolution; no alternate network or credential route was attempted. The supplied archive was retained, and relevant source bytes were reconciled against the connector's immutable blob identity. Local toolchain preflight reports missing tsc, tsx, vite, vitest and oxlint, so no local full-suite success is claimed. This follows the earlier failed installation; repeated registry attempts were not selected. GitHub remains the ordinary source publication and hosted proving path.

The large central friction log is preserved, not rewritten for transport convenience. A local append patch records these occurrences under #411/#412; this receipt and the PR discussion preserve the same failures remotely. Central-log publication must be reported separately rather than inferred from this receipt.

Before merge require ordinary exact-head hosted checks, independent review and unresolved-thread inspection. Resolve the original post-merge finding only after this follow-up is delivered. Rollback is a reviewed revert; the separately tracked #410 identity collision and #406 dependency candidate remain outside this correction.
