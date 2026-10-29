# Backup identity and restore cleanup — 2026-10-29

## Scope and behavior

This bounded maintenance slice addresses two pre-existing failure cases under issues #142 and #168. Both programme issues retain their other acceptance criteria.

An unavailable `(dev, ino) = (0, 0)` identity is refused before it can become the immutable identity of a migration backup or its manifest. A legitimate pair with only one zero component remains accepted and exactly replayable. Refusal leaves the attempt row unchanged, so a subsequent usable identity can still bind.

Restore now finishes closing the verified source descriptor while the temporary copy still has a local cleanup owner. If closing the source throws, the existing failure cleanup can close the owned destination descriptor and remove its provisional file. The selected store is not published, the immutable backup, manifest and selection marker remain unchanged, and a fresh verified retry retains the original selection and grace time.

No schema, artifact format, capability, activation path, filesystem privilege or hostile-writer guarantee changes. Reverting this code/test slice is the rollback; no data migration is involved.

## Discriminating proof

The tests-only PR #447 head `fd5c1adba55161fc2d43b56e071a775dd8ccf322` ran as integration `f7d69fd` against main `bae3bdd` in [hosted run 40803530116](https://github.com/Chris0Jeky/developer-lens/actions/runs/40803530116), job `123216967304`. It failed exactly the three intended assertions: both all-zero identity admissions and the restore temporary-descriptor closure. The other 2,463 tests passed; four were skipped. Production fixes were added after that observed failure.

The tests use invented fixtures and real SQLite/filesystem behavior. The restore fault injector closes the actual source descriptor and then throws once at the copy handoff. It checks descriptor closure, provisional-file removal, no selected-store publication, immutable-byte preservation and an exact-time retry. Its own failure cleanup keeps the counterfactual run self-contained.

`git diff --check` and Node 24 syntax checks passed locally. This executor cannot install the pinned npm graph because its registry connection is refused; no local Vitest/typecheck pass is claimed. Final independent review and the fresh exact-head required gate are recorded on [PR #447](https://github.com/Chris0Jeky/developer-lens/pull/447). Native Windows and hostile concurrent-writer qualifications remain separate.
