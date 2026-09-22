# PR maintenance continuation, 2026-09-22

This is an evidence and continuation record, not an owner decision or capability authorization. Live GitHub heads, reviews and checks take precedence over this snapshot. No protected data, provider credential, model, release or tag is activated by this work.

## Recovery and source reconciliation

The uploaded archive identifies initial main `d67b3e5493b99a143a9b00a057e716888fdfc1bf`. The resumed main was `34a09f6697fe4247f458144caaedb3b7eb2c6595`: #350, #356, #347 and #352 had already merged. Their ten changed paths were reconciled with the archive rather than overwritten. The continuation then merged #343 and #353, bringing main to `8ade4e377f41e48e19c3d6d5848deaa6cce4c8d0` at this checkpoint. Six of the original nineteen PRs have therefore merged across the interrupted work and this continuation.

Local Node was 22 rather than the required Node 24; a bounded npm bootstrap did not establish usable repository dependencies. No local full-suite result is claimed. Dependency-free native checks are identified separately from hosted Node 24 proof.

## Merged in this continuation

| PR | Reviewed head | Merge commit | Proof |
| --- | --- | --- | --- |
| #343, emitted-resource guard | `b3eb4c303e6285e238a0363ce0ae540e808901f0` | `e91068fdc70e19d087607a1f4dd48a93acbde00c` | Full PR gate 35229884595, job 105230893037; original review threads resolved. This is an additive trusted-build-output check, not an arbitrary-markup browser sandbox. Its syntax residual is in #362/#363. |
| #353, evidence semantic coherence | `3ec23fb1efefdb82d068339920c20638af1149e6` | `8ade4e377f41e48e19c3d6d5848deaa6cce4c8d0` | Full PR gate 35672625176, job 106572261877; fresh exact-head Codex review; both threads resolved. |

#353 binds unresolvable lineage to its non-null claim ID, rejects lineage on null-claim outcomes, and requires `MISSING_SCOPE` in the explanation's missing-scope slot while retaining cleared-alias furniture inside an existing scope. Test-only head `83a4943929f3b915d72941bc056710b6fc84ab49` failed exactly five planted cases in run 35670366131/job 106565235937, with 1,566 passing and two skipped tests. Its PR description no longer overstates nullability checks as an independent claim-ID syntax validator.

A subsequent review-thread sweep found no new findings on #343 or #353. No branch-protection settings or required checks were weakened.

## Published repairs awaiting qualification or further work

| PR | Exact published head | Status and next action |
| --- | --- | --- |
| #351, local toolchain | `9758abc3c144188224e6e3ccd46b04c16b520fd2` | Final repairs published; full gate 35674009282/job 106576550579 was queued at this checkpoint. Obtain the exact-head result and fresh review before resolving remaining threads or merging. |
| #355, Windows test roots | `85f698ef963b6efdda7bf3a7e64f9cd19d481f72` | Strong native Windows run 35673850363/job 106576067784 passed; full PR gate 35673850365/job 106576073825 was queued. Fresh final-head review requested; do not replace the full gate with the focused Windows proof. |
| #346, source taxonomy | `eaaac42630673e2b1ecd4231b998e75566c31c3f` | Full gate 35672537411 green, but fresh authority-sync findings remain. Catalogue-only changes are not sufficient to close #313. |
| #349, role-aware retrieval | `6aef2c51da1926220a8a495dec91f893fc7e12d9` | Full gate 35672559153 green, but fresh quota-allocation and diagram findings remain. Do not close #66/#69 yet. |
| #363, scanner syntax follow-up | `69a11e9b0d9b42b6f4093c2006ac18827fc71eaa` | Test-first draft. Run 35673218824/job 106574120188 failed exactly six new cases; 1,574 tests passed and two were skipped. Implementation remains outstanding. |

### #351: actual repair and regression evidence

The guard validates POSIX executable regular files, Windows competing standard/PATHEXT siblings, actual read access by open/fstat/close without consuming contents, malformed or unselectable extension lists, and root-level Windows command shadows. All 23 direct package scripts that launch guarded tools now invoke the Node-only preflight first; existing aggregate guards remain. Dependency versions and the lockfile are unchanged. Vitest discovers the `.mjs` regression suites.

The first Windows native probe reproduced ten failures among fourteen cases against the exact previous implementation blob `372670af9ecd16861817ab1d099b125f97f9ebd0`. After repair all fourteen passed. The next entrypoint/root-shadow probe had 28 failures and two passing aggregate-script controls before its implementation; the combined native suite then passed all 44 checks. The checked local production and package blobs match published hashes `1e3ea1dcd31c8bded9c352879997b37def59c444` and `0bc2f337fdbbefb4ee62b22e077bdfe1dc736ca2`.

Hosted run 35673030028 at the intermediate `7958066` head failed only two read-denial simulations, with 1,587 passing and two skipped tests. The Vitest-only fs mock did not intercept the native ESM binding. Commit `786c9586599df1e3ee0fb4552adeead0bf1ee20b` changed only the test interception, synchronizes/restores the built-in binding, counts actual denial attempts, and retains before/after valid-file controls. The production guard was not weakened. Final hosted proof is still required; native denial injection is not a claim that a real Windows ACL was modified in the local environment.

### #355: genuine Windows short-path qualification

The first native Windows run 35673515965 passed 30 tests with three skipped, but the hosted work volume lacked an 8.3 alias. That was compatibility proof only. The final workflow uses a unique folder in profile temp, changes no machine/volume policy, and fails unless a distinct short alias exists and Node confirms `os.tmpdir()` is noncanonical before Vitest initializes. That stronger probe and the real artifact-catalogue fixtures passed in run 35673850363. Production root capture and confinement remain unchanged.

### #346 and #349: fresh blockers preserved

For #346, the published catalogue restricts `agent_config` to a point-in-time per-repository boolean, without cardinality or temporal/portfolio comparisons. The same noninterference boundaries still need propagation to the canonical architecture, ADR-05/ADR-07, DL-XRAY-01/DL-TIME-01 source cards and regenerated projections. Add fixtures with identical analytical outputs when only agent-config presence or timing differs. The fresh P1 threads remain open.

For #349, the fixed greedy role priority can assign a multiply-qualified support row to coverage even when a coverage-only alternative would permit all minima. Specify deterministic quota-aware assignment and prove feasible minima survive physical-order permutations; preserve explicit shortfalls for infeasible cases. The diagram must rank the admitted working set, not all original eligible rows after a working ceiling has bound. These findings remain open despite green documentation checks.

### #363: explicit residual from the safe #343 merge

The six observed false negatives are CSS escapes in schemes, function names and import identifiers; URL tab normalization; special-URL backslashes; and quoted angle brackets in markup attributes. The local-asset/outbound-anchor/SVG data-URI control passed. Preserve those regressions while implementing bounded browser-consistent handling, then pass the full gate and review. This draft is not a completed fix and must not merge while red.

## Other open lanes and concrete continuation

- #328: invalidate stale persisted catalogue decisions and qualify the handoff as `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c)`. No completed implementation of those two blockers was recovered or published here; an earlier progress message is not evidence of one.
- #344: reject empty issue-template frontmatter instead of treating empty text as absent extraction; authenticate hosted label reads using the read-only workflow token in both authoritative callers, while preserving network-free local validation. Both fresh review findings remain open.
- #345: separate fail-fast prior-bundle replacement from exhaustive post-write privacy cleanup. A locked old artifact currently permits deletion of other valid old artifacts before refusal. Add a regression preserving all old bytes when the first replacement removal fails. A transactional replacement redesign is a separate scope.
- #348: preserve or version the published strict ResearchFinding v1 contract before changing its disclaimer literal.
- #354/#357: reconcile lazy optional surfaces with the manual-chunk alternative. Add actual module-evaluation proof and measured output; asynchronous interaction assertions alone do not prove deferred evaluation.
- #340: preserve the #202 coherent pre-activation programme boundary; do not merge this budget component as standalone activation or close #57 independently.
- #359/#360: recovery dossiers, not wholesale merge candidates. Map retained capabilities/invariants to current code, tests or named successors before closing historical branches.

## Tooling cleanup and continuation rules

The temporary branch-only materializer created immutable blobs from pinned public inputs. Run 35670943628/job 106567016234 succeeded without updating trees, commits, refs or merges. Connected Git-data actions separately published the inspected repairs. The temporary workflow was deleted in commit `c70546ed01d00aaa8e252c43b897417044fd0300`; it must not land on main. The durable #361 scope is this record and the friction log, not a write-enabled workflow.

The connection could not read administrative branch protection. A later check-run annotation URL was rejected by the fetch allowlist; the supported workflow-job-log action supplied the exact failure evidence instead. Do not retry equivalent network workarounds or infer passing results from unavailable evidence.

Use the declared `Prove the pull request` check, exact-head jobs, current review threads and SHA-guarded merges. Fresh review findings remain blockers even when CI is green. Queued checks are not proof. Refresh this checkpoint's heads and statuses before continuing; no automatic or unattended merging was configured.
