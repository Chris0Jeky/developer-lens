# PR maintenance continuation, 2026-09-22

This is an evidence and continuation record, not an owner decision or capability authorization. Live GitHub heads, reviews and checks take precedence over this snapshot. No protected data, provider credential, model, release or tag is activated by this work.

## Recovery and source reconciliation

The uploaded archive identifies initial main `d67b3e5493b99a143a9b00a057e716888fdfc1bf`. Resumed main was `34a09f6697fe4247f458144caaedb3b7eb2c6595`: #350, #356, #347 and #352 had already merged. Their ten changed paths were reconciled with the archive rather than overwritten. This continuation merged #343, #353 and #355, bringing main to `d68b3e34d9e01c72e4a585dacbcc56fec8279571` at this checkpoint. Seven of the original nineteen PRs have merged across the interrupted work and this continuation.

Local Node was 22 rather than the required Node 24; a bounded npm bootstrap did not establish usable repository dependencies. No local full-suite result is claimed. Dependency-free native checks are distinguished from hosted Node 24 proof.

## Merged in this continuation

| PR | Reviewed head | Merge commit | Final proof |
| --- | --- | --- | --- |
| #343, emitted-resource guard | `b3eb4c303e6285e238a0363ce0ae540e808901f0` | `e91068fdc70e19d087607a1f4dd48a93acbde00c` | Full gate 35229884595/job 105230893037; original review threads resolved. Additive trusted-build-output check, not an arbitrary-markup browser sandbox. Syntax residual tracked in #362/#363. |
| #353, evidence coherence | `3ec23fb1efefdb82d068339920c20638af1149e6` | `8ade4e377f41e48e19c3d6d5848deaa6cce4c8d0` | Full gate 35672625176/job 106572261877; fresh exact-head Codex review; both threads resolved. |
| #355, Windows test roots | `85f698ef963b6efdda7bf3a7e64f9cd19d481f72` | `d68b3e34d9e01c72e4a585dacbcc56fec8279571` | Full Linux gate 35673850365/job 106576073825 and native Windows gate 35673850363/job 106576067784 passed; fresh exact-head Codex review without findings. |

#353 binds unresolved lineage to the non-null claim ID, rejects lineage on null-claim outcomes, and requires `MISSING_SCOPE` in the explanation's absent-scope slot while retaining cleared-alias furniture inside an existing scope. Test-only head `83a4943929f3b915d72941bc056710b6fc84ab49` failed exactly five planted cases in run 35670366131/job 106565235937, with 1,566 passing and two skipped tests. The PR description was corrected: nullability checks are not an independent claim-ID syntax validator.

#355's first native Windows run 35673515965 passed 30 tests with three skipped, but the work volume lacked an 8.3 alias. That was compatibility proof only. The final workflow creates a unique profile-temp folder, changes no volume policy, and fails unless a distinct short alias exists and Node confirms `os.tmpdir()` is noncanonical before Vitest initializes. That stronger probe and real artifact-catalogue fixtures passed in run 35673850363. Production root capture and confinement are unchanged.

Subsequent review-thread reads found no new findings on these merged PRs. Refresh the late-comment sweep before further integration; a point-in-time empty read is not a promise that no future review will arrive. No required check or branch-protection setting was weakened.

## #351: published implementation and final test-infrastructure repair

Current head: `7d930283ff3ad0f47fdcc635fb52c2487db65006` on `fix/local-toolchain-preflight-294`. Full final-head gate 35674875728/job 106579168416 and fresh Codex review were in progress at this checkpoint. The PR is not recorded as merged. All six review findings have implementation/evidence replies; resolve them and merge only after final qualification.

Implemented guard behavior:

- POSIX executable regular files, including symlink targets, with contained local manifests and shims.
- Windows standard/PATHEXT competing siblings, malformed or unselectable extension lists, and root-level command shadows.
- Actual open/fstat/close readability checks without consuming file contents.
- Node-only preflight before all 23 direct scripts invoking guarded TSX/TSC/Vite/Vitest/Oxlint commands; existing aggregate guards remain.
- Three `.mjs` regression suites discovered by normal Vitest.

Dependency versions and the lockfile are unchanged. The guard checks installation location and usability, not arbitrary package authenticity or concurrent hostile mutation. The Node interpreter launching the preflight is assumed trusted.

### Regression history and limitations

The initial executable/discovery test-only head produced five expected hosted failures. The Windows native probe then reproduced ten failures among fourteen cases against previous implementation blob `372670af9ecd16861817ab1d099b125f97f9ebd0`; the repaired version passed all fourteen. The entrypoint/root-shadow probe produced 28 failures and two valid aggregate-script controls before repair. The combined native suite passes all 44 checks. Production and package blobs at the final test-only head remain `1e3ea1dcd31c8bded9c352879997b37def59c444` and `0bc2f337fdbbefb4ee62b22e077bdfe1dc736ca2`.

Intermediate hosted run 35673030028 failed two read-denial simulations, with 1,587 passing and two skipped tests. The Vitest-only fs mock did not reach the native ESM binding. The subsequent built-in-binding interception attempt also failed in hosted Vitest: run 35674009282/job 106576550579 at `9758abc3c144188224e6e3ccd46b04c16b520fd2` had 1,609 passing tests, two failed denial tests with zero intercepted calls, and one entrypoint-suite import failure because the transformed `import.meta.url` was not a file URL. Build and showcase were correctly skipped. These failures must not be described as a successful gate.

Final commits `a083bb07c72186f87f723a71b7370d4c2ec1c8fe` and `7d930283ff3ad0f47fdcc635fb52c2487db65006` change tests only. Entry points are read from the actual npm package-root filesystem path. Read-denial tests launch bounded, shell-free native Node subprocesses importing the actual production module. Each proves success before/after, requires an intercepted denied open, checks refusal and content-free diagnostics, and restores the binding. Paths are separate argv values, never interpolated code. Both isolated child cases and all 44 native checks pass locally; this is still not a substitute for the final full hosted gate. No assertion or production check was weakened.

## Repaired but still blocked PRs

| PR | Published head | Proof and remaining blocker |
| --- | --- | --- |
| #346 | `eaaac42630673e2b1ecd4231b998e75566c31c3f` | Full gate 35672537411 green; fresh authority-sync findings remain. |
| #349 | `6aef2c51da1926220a8a495dec91f893fc7e12d9` | Full gate 35672559153 green; fresh quota-assignment and diagram findings remain. |
| #363 | `69a11e9b0d9b42b6f4093c2006ac18827fc71eaa` | Test-first draft: gate 35673218824/job 106574120188 failed exactly six new cases, with 1,574 passing and two skipped tests. Implementation outstanding. |

For #346, the published catalogue restricts `agent_config` to a point-in-time per-repository boolean, without cardinality or temporal/portfolio comparisons. Propagate the same exceptions to the canonical architecture, ADR-05/ADR-07, DL-XRAY-01/DL-TIME-01 source cards and regenerated projections. Prove identical analytical outputs when only agent-config presence or timing differs. Fresh P1 threads and #313 remain open.

For #349, a greedy fixed role priority can assign a multiply-qualified support row to coverage despite a coverage-only alternative that would permit all minima. Specify deterministic quota-aware assignment, prove feasible minima survive input-order permutations, and preserve explicit shortfalls when infeasible. The diagram must rank the admitted working set after the ceiling binds, not all original eligible rows. #66/#69 and the fresh findings remain open.

#363 is the explicit residual from the safe #343 merge. Its six observed false negatives are CSS escapes in schemes, function names and import identifiers; URL tab normalization; special-URL backslashes; and quoted angle brackets in markup attributes. The local-resource/outbound-anchor/SVG data-URI control passed. Preserve the six regressions while implementing bounded browser-consistent handling, then qualify the full gate and review. Do not merge the red draft.

## Other original PRs: preserved restart conditions

- #328: invalidate stale persisted catalogue decisions and fully qualify `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c)`. No completed implementation of those blockers was recovered or published here; an earlier progress message is not implementation evidence.
- #344: reject empty issue-template frontmatter instead of treating empty extraction as absent; authenticate hosted label reads with the read-only workflow token in both authoritative callers, preserving network-free local validation. Fresh findings remain open.
- #345: separate fail-fast prior-bundle replacement from exhaustive post-write privacy cleanup. A locked old artifact currently permits deletion of other valid old artifacts before refusal. Add a regression preserving all prior bytes when the first replacement removal fails. A transactional replacement redesign is a separate scope.
- #348: preserve or version the published strict ResearchFinding v1 contract before replacing its disclaimer literal.
- #354/#357: reconcile lazy optional surfaces with the manual-chunk alternative; prove actual module evaluation and measure output. Asynchronous interaction assertions alone are insufficient.
- #340: preserve #202's coherent pre-activation programme boundary. Do not merge this budget component as standalone activation or close #57 independently.
- #359/#360: recovery dossiers, not wholesale merge candidates. Map retained capabilities and invariants to current code, tests or named successors before closure.

## Tooling cleanup and continuation rules

The temporary branch-only materializer created immutable blobs from pinned public inputs. Run 35670943628/job 106567016234 succeeded without updating trees, commits, refs or merges. Connected Git-data actions separately published the inspected repairs. The temporary workflow was deleted in `c70546ed01d00aaa8e252c43b897417044fd0300`; it must not land on main. The durable #361 scope is this record and the friction log, not a write-enabled workflow.

Administrative branch-protection reads were unavailable. A check-run annotation request was rejected by the fetch allowlist; the supported workflow-job-log action supplied the exact failures instead. One contents update rejected a stale blob SHA; the current file was reread and reconciled before retrying. Do not force overwrites or retry equivalent generic network workarounds.

Use exact-head jobs, current review threads and SHA-guarded merges. Fresh review findings remain blockers even with green CI. Queued, running and skipped jobs are not passing proof. Refresh this dated checkpoint before continuing; no automatic or unattended merging was configured.
