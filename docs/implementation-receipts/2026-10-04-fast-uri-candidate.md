# Fast-uri candidate: exact patch preserved, committed remediation still pending

## Current status

PR #406 remains draft at `7e9682901b964282a27639e2142508728fcaf7cf`. Its actual tracked lockfile still selects fast-uri 3.1.7. Do not merge that head or infer remediation from the green candidate job. The adjacent [three-field patch](2026-10-04-fast-uri-3.1.8.patch) was generated from authoritative npm metadata and fully tested in an uncommitted hosted candidate, not applied to the repository's active dependency graph.

## Reproduced failure and candidate proof

Initial head `3167c2a3a71ace657a4d35c52280cdaa11f5699b`, run 37147250384/job 111273632916, exercised the actual fast-uri selected by Ajv: three encoded-host cases failed; 2,097 tests passed in total, including both controls; three existing tests skipped. No assertions were weakened.

Candidate run [37149963917/job 111281507331](https://github.com/Chris0Jeky/developer-lens/actions/runs/37149963917/job/111281507331) proved integration `c56cc4210e4e62a15eeaf37259ba5360814e063f` of head `7e9682901b964282a27639e2142508728fcaf7cf` into then-main `257a3cbf02c49a2bfc5eee376e147fcd282d0675`. It obtained fast-uri@3.1.8 metadata from registry.npmjs.org, permitted only version/resolved/integrity to change, and passed npm ci, full npm run check, synthetic showcase/privacy and locked SDK checks: **2,162 tests across 136 files passed, with three existing skips**. All five URI regressions passed.

The audit collected at 2026-10-03T20:03:59Z contains no fast-uri entry and retains three high affected package entries in the braces/micromatch/fast-glob chain. This is dated candidate evidence, not a current clean-audit claim. Ordinary committed-head run 37149963656/job 111281506781 remained red at its unit-test step and skipped build; that required gate was never replaced by candidate success.

## Durable recovery identities

Original lockfile SHA-256: `a7e75152881f7418f3595c39ae565ff9dbc1a3e4f476f0d5f8a935020b5becfc`.

Candidate lockfile SHA-256: `084addf0af8dc4cf56a72e9c1325580ce460e0ebadfd0a09f2a09e28a5cab8d1`.

Candidate Git blob, computed locally: `d011bb887d883498069c64d1f075b1dcf35d2643`. A GitHub blob lookup returned 404 during recovery, so this is not a claim that the candidate already exists as a repository object.

Artifact 11283846471, `fast-uri-3.1.8-candidate-37149963917`, expires 2026-11-02. Downloaded ZIP SHA-256: `adc66eeae80fba58a4a02e16727b19c5a4c6a714160dc5ef0e13235318acc559`. Its seven-file inventory, both lockfile digests, semantic three-field delta and exact Git patch replay were independently rechecked in the task container. Adjacent patch SHA-256: `ca16e258e1bf66126591ecff920570e9654bdf1fa8456e294bc5667ee40122ec`.

## Publication friction and stop decision

No coding worker started: the repository has no configured Codex coding environment. The connected source-write functions accept full content strings, not a local-file/patch parameter. The coordinator considered a temporary hash-pinned blob-transfer workflow to avoid retranscribing the 221 KB lockfile. Creation of that write-enabled workflow was blocked by the tool safety check before it was created. It changed no permission, ref, Git blob or credential. That route was abandoned and must not be retried indirectly. No hidden credential or network workaround was used.

The exact public patch and proof identities are saved here instead of claiming that a candidate equals a committed change. Local full npm was unavailable; only the explicitly identified hosted gates provide full-suite proof.

## Finish safely

Refresh live main, #406 head, ownership and reviews. Confirm the original lock digest or reconcile any intervening dependency change, apply the patch through an ordinary supported source-write path, and verify the resulting candidate digest. Remove the PR-specific candidate workflow and candidate-only helpers before final integration; its source-version contract intentionally expects 3.1.7. Retain the five actual URI behavior regressions. Obtain fresh ordinary exact-head install/full checks/audit/review before merge.

The separate literal-discovery change removes one glob consumer but does not remove fast-glob from package.json/package-lock or the context verifier. #398 therefore remains open. No real/private collection, source/model activation, telemetry, permission, release, tag or owner sign-off is selected by this receipt.
