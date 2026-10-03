# Literal local-root discovery and honest coverage

## Outcome and scope

Replace glob interpretation in the existing explicit-root local Git collector with deterministic directory-metadata traversal. Preserve the marker-at-level-six cutoff; prune dependency/build folders and protected output subtrees, never descend a symlink, and cap the request at 10,000 visited directories. Repeated/overlapping roots reuse directory listings while a deeper explicitly selected root retains its own depth allowance.

Previously missing roots and rejected Git markers could disappear from discovery while the collector reported complete coverage. Failed directory checks, invalid markers and budget truncation now contribute only a count to the existing coverage detail. Valid observations plus failure produce partial coverage; failure without observations produces unavailable, not a complete zero. A successfully inspected repository with no matching activity remains complete. No new warning schema or raw exception/path diagnostic is introduced.

The walker does not read Git marker contents. The existing collector still validates candidates through Git, including linked-worktree resolution, and retains its existing identity and commit-feature behavior. No new collection caller, capability grant, credential, model, telemetry, release or permission is enabled. This is not hostile concurrent-writer confinement: metadata can change between pathname operations, and explicit roots may have pre-existing ancestor indirection. Skipped symlink children and depth-excluded subtrees are outside the declared scan scope, not a claim of machine-wide inventory.

## Dependency and identity boundaries

This removes one fast-glob consumer, not the installed dependency graph. The context verifier still uses fast-glob, and package.json/package-lock.json are unchanged. #398 and the unapplied #406 fast-uri candidate remain open. No clean-audit or exploitability claim follows from this refactor.

The older common-directory case-folding and fallback repository-ID semantics are deliberately unchanged. An independent invented Linux probe found two repositories named Repo/repo collapse to one; #410 owns the platform-aware identity and downstream aggregation decision. Its failed probe remains preserved separately and is not counted among this slice's passing tests.

## Proof and continuation

Based on merged #409 at `0a4ba64f79ed8515d5ecaeb00b88bf4beb39d31a`. Source bytes: localGit.ts `a1f96bd032a9092d6fff20260fbd186095c5a4ae`; localGitDiscovery.ts `59d777983ec5212603cc9b9a3bb584a3289f1549`; test `cef1279d9ed6b4ff42b8c92024ec0191f7f4e662`.

Thirty-five supplementary Node tests pass, using the actual new helper and full collector/import chain with TypeScript stripping and test-registration/import-suffix adaptation. Fixtures create their own temporary directories, symlinks or junctions, and explicitly dated invented Git commits with empty hooks; no real user history is inspected. Cases cover literal metacharacters/Unicode, exclusions, depth and request budgets, overlapping-root depth, directory replacement, failures, actual symlinks, zero activity, partial coverage and repeated-root deduplication.

The initial 33-test attempt had two passing controls and 31 failures: 26 established the missing walker contract against an empty stub, one reproduced the actual old missing-root complete-coverage defect, and four were missing-glob-runtime errors rather than behavioral reproduction. Do not reinterpret those four as product defects. After implementation all 33 passed, then the explicit-deeper-root and native symlink checks raised the passing set to 35. Local full npm installation was unavailable; native Windows and full Vitest/build/context/privacy proof require the actual hosted gates. A Linux symlink pass is not a Windows-junction execution claim.

Before merge require full exact-head hosted checks, independent review and a final thread sweep. Roll back through a normal reviewed revert of the helper/caller/tests; retain these evidence limits and #410. The operational state record and live GitHub supersede this timestamped proof plan.
