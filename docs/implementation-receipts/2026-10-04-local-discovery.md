# Literal local-root discovery and honest coverage

## Outcome and scope

Replace glob interpretation in the existing explicit-root local Git collector with deterministic directory-metadata traversal. Preserve the marker-at-level-six cutoff; prune dependency/build folders and protected output subtrees, never descend a symlink, and cap the request at 10,000 visited directories. Repeated/overlapping roots reuse directory listings while a deeper explicitly selected root retains its own depth allowance.

Previously missing roots and rejected Git markers could disappear from discovery while the collector reported complete coverage. Failed directory checks, invalid markers and budget truncation now contribute only a count to the existing coverage detail. A successfully inspected repository plus another failure produces partial coverage, even when the successful inspection finds zero matching commits. Failure without any successful repository inspection produces unavailable. A wholly successful zero-activity inspection remains complete. Successful inspection counts are independent of emitted commits, so the existing analytics coverage calculation retains partial local coverage instead of excluding it as unavailable. No new warning schema or raw exception/path diagnostic is introduced.

The walker does not read Git marker contents. The existing collector still validates candidates through Git, including linked-worktree resolution, and retains its existing identity and commit-feature behavior. No new collection caller, capability grant, credential, model, telemetry, release or permission is enabled. This is not hostile concurrent-writer confinement: metadata can change between pathname operations, and explicit roots may have pre-existing ancestor indirection. Skipped symlink children and depth-excluded subtrees are outside the declared scan scope, not a claim of machine-wide inventory.

## Dependency and identity boundaries

This removes one fast-glob consumer, not the installed dependency graph. The context verifier still uses fast-glob, and package.json/package-lock.json are unchanged. #398 and the unapplied #406 fast-uri candidate remain open. No clean-audit or exploitability claim follows from this refactor.

The older common-directory case-folding and fallback repository-ID semantics are deliberately unchanged. An independent invented Linux probe found two repositories named Repo/repo collapse to one; #410 owns the platform-aware identity and downstream aggregation decision. Its failed probe remains preserved separately and is not counted among this slice's passing tests.

## Initial proof and first review correction

Based on merged #409 at `0a4ba64f79ed8515d5ecaeb00b88bf4beb39d31a`. Initial head `eac4795b7b2ccc491a8e89764820430832830f67` passed full hosted run 37162942414/job111319970800: 2,212 tests in 136 files, three existing skips, plus context/contracts/lint/build/privacy/SDK checks. Its integration was `81e24274462c94530525e3598166f4abe7d4ff3c`. This green run did not override review 5403511246: comment 4175449733 identified the successful-empty-inspection coverage defect.

Five new actual-collector tests reproduced three unavailable-versus-partial failures and one overstated successful-inspection count, with one passing zero-activity control. They create explicitly dated invented commits, missing roots, invalid markers and a deliberately broken ref in isolated temporary repositories. The correction counts a successful Git-log inspection after parsing/filtering and before the empty-match early continuation. All 40 discovery/coverage probes then passed under supplementary Node registration. The corrected caller blob is `8a6a3459b4dac56c3c4164e457630b9fc72bc386`; the new five-test file is `6ea1c969d064736fe6a722814de3e35dff7d86c2`. The walker and original 35 tests remain unchanged. Fresh hosted checks and exact-head review are required for this correction.

## Reproduction and execution limits

The initial 33-test attempt had two passing controls and 31 failures: 26 established the missing walker contract against an empty stub, one reproduced the actual old missing-root complete-coverage defect, and four were missing-glob-runtime errors rather than behavioral reproduction. Do not reinterpret those four as product defects. After implementation all 33 passed, then the explicit-deeper-root and native symlink checks raised the passing set to 35. The later five coverage regressions described above are actual behavior reproductions, not missing-runtime failures.

Supplementary execution uses the actual helper and full collector/import chain with TypeScript stripping and test-registration/import-suffix adaptation. Fixtures use newly created directories, symlinks and invented Git history only. Local full npm installation was unavailable; a Linux symlink pass is not a native Windows-junction or full Vitest proof. Hosted checks establish full module/build compatibility only for their exact tested head.

Before merge require fresh exact-head hosted checks, independent review and a final thread sweep. Roll back through a normal reviewed revert of the helper/caller/tests; retain these evidence limits and #410. The operational state record and live GitHub supersede this timestamped proof plan.
