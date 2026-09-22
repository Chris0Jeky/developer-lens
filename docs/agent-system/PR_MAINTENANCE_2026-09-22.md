# PR maintenance continuation, 2026-09-22

This is an evidence and continuation record, not an owner decision or capability authorization. Live GitHub heads, reviews and checks take precedence over this dated snapshot. No protected data, provider credential, model, release or tag is activated by this work.

## Final disposition

Main reached `88c14c1a326d929bc0fcae1ebc49073a0c713ea4`. This continuation merged **#343, #351, #353 and #355**. Together with **#350, #356, #347 and #352**, already merged before resumption, eight of the original nineteen PRs have merged. Eleven original PRs remain, plus the new evidence draft #361 and regression-first follow-up #363.

The uploaded archive identifies initial main `d67b3e5493b99a143a9b00a057e716888fdfc1bf`. Resumed main was `34a09f6697fe4247f458144caaedb3b7eb2c6595`; its ten changed paths were reconciled with the archive rather than overwritten. Local Node was 22 rather than required Node 24, and a bounded npm bootstrap did not establish usable repository dependencies. No local full-suite execution is claimed. Native dependency-free probes are distinguished from hosted Node 24 proof.

## Merged in this continuation

| PR | Reviewed head | Merge commit | Final proof |
| --- | --- | --- | --- |
| #343, emitted-resource guard | `b3eb4c303e6285e238a0363ce0ae540e808901f0` | `e91068fdc70e19d087607a1f4dd48a93acbde00c` | Full gate 35229884595/job 105230893037; original review threads resolved. Additive trusted-build-output check, not an arbitrary-markup browser sandbox. Syntax residual tracked in #362/#363. |
| #351, local toolchain | `7d930283ff3ad0f47fdcc635fb52c2487db65006` | `88c14c1a326d929bc0fcae1ebc49073a0c713ea4` | Full gate 35674875728/job 106579168416; fresh exact-head Codex review completed at 01:18:46Z; all six findings replied to and resolved. |
| #353, evidence coherence | `3ec23fb1efefdb82d068339920c20638af1149e6` | `8ade4e377f41e48e19c3d6d5848deaa6cce4c8d0` | Full gate 35672625176/job 106572261877; fresh exact-head Codex review; both threads resolved. |
| #355, Windows test roots | `85f698ef963b6efdda7bf3a7e64f9cd19d481f72` | `d68b3e34d9e01c72e4a585dacbcc56fec8279571` | Full Linux gate 35673850365/job 106576073825 and native Windows gate 35673850363/job 106576067784 passed; fresh exact-head Codex review without findings. |

Every merge used expected-head protection. Full gates included context/drift checks, lint, the complete unit suite, type-check/build and synthetic showcase/privacy checks. No required check or branch-protection setting was weakened. Subsequent thread reads found no new findings on #343/#353/#355. Refresh delayed-review sweeps, particularly for the newest #351 merge; a point-in-time empty read is not a promise about future comments. No unattended monitoring or auto-merge was configured.

## #351: repaired execution boundary and regression evidence

The guard now validates POSIX executable regular files and contained local manifests/shims, including symlink targets. Windows validation covers competing standard/PATHEXT siblings, malformed or unselectable extension lists, and root-level command shadows. Readability is checked with actual open/fstat/close without consuming file contents. All 23 direct scripts invoking guarded TSX/TSC/Vite/Vitest/Oxlint commands run the Node-only preflight first; aggregate guards remain. Normal Vitest discovers all three `.mjs` suites.

Dependency versions and the lockfile are unchanged. This is an installation location/usability guard, not package-content authentication or a concurrent-hostile-mutation sandbox. The Node interpreter launching it is assumed trusted.

The initial executable/discovery test-only head produced five expected hosted failures. A Windows native probe reproduced ten failures among fourteen cases against implementation blob `372670af9ecd16861817ab1d099b125f97f9ebd0`; the repair passed all fourteen. The entrypoint/root-shadow probe produced 28 failures and two valid aggregate controls before repair. The combined native suite passes all 44 checks. Final production/package blobs are `1e3ea1dcd31c8bded9c352879997b37def59c444` and `0bc2f337fdbbefb4ee62b22e077bdfe1dc736ca2`.

Intermediate run 35673030028 failed two read-denial simulations, with 1,587 passing and two skipped tests. A Vitest fs mock did not reach the native ESM binding. The subsequent built-in-binding interception also failed under hosted Vitest: run 35674009282/job 106576550579 at `9758abc3c144188224e6e3ccd46b04c16b520fd2` had 1,609 passing tests, two failed denial tests with zero intercepted calls, and an entrypoint-suite import failure because transformed `import.meta.url` was not a file URL. Build/showcase were correctly skipped. Neither failed run was waived or represented as green.

Final commits `a083bb07c72186f87f723a71b7370d4c2ec1c8fe` and `7d930283ff3ad0f47fdcc635fb52c2487db65006` change tests only. Entry points are read using the npm package-root filesystem path. Denial tests launch bounded, shell-free native Node subprocesses importing the actual production module. Each proves success before/after, requires an intercepted denied open, checks refusal and content-free diagnostics, and restores the binding. Paths are separate argv values, not interpolated code. Both child cases pass locally, and final hosted run 35674875728 passes the entire gate. No assertion or production check was weakened.

## #353 and #355: identity and native-platform proof

#353 binds unresolved lineage to its non-null claim ID, rejects lineage on null-claim outcomes, and requires `MISSING_SCOPE` in the explanation's absent-scope slot while retaining cleared-alias furniture inside an existing scope. Test-only head `83a4943929f3b915d72941bc056710b6fc84ab49` failed exactly five planted cases in run 35670366131/job 106565235937, with 1,566 passing and two skipped tests. Its PR description was corrected: nullability checks are not an independent claim-ID syntax validator.

#355's first native run 35673515965 passed 30 tests with three skipped, but the work volume lacked an 8.3 alias. That was compatibility proof only. The final read-only workflow creates a unique profile-temp folder, changes no volume policy, and fails unless a distinct short alias exists and Node confirms noncanonical `os.tmpdir()` before Vitest initializes. That stronger probe and real artifact-catalogue fixtures passed in run 35673850363. Production root capture and confinement remain unchanged.

## Repaired but still blocked

| PR | Published head | Proof and remaining blocker |
| --- | --- | --- |
| #346 | `eaaac42630673e2b1ecd4231b998e75566c31c3f` | Full gate 35672537411 green; fresh authority-sync findings remain. |
| #349 | `6aef2c51da1926220a8a495dec91f893fc7e12d9` | Full gate 35672559153 green; fresh quota-assignment and diagram findings remain. |
| #363 | `69a11e9b0d9b42b6f4093c2006ac18827fc71eaa` | Test-first draft: gate 35673218824/job 106574120188 failed exactly six new cases, with 1,574 passing and two skipped tests. Implementation outstanding. |

For #346, the catalogue now restricts `agent_config` to a point-in-time per-repository boolean, without cardinality or temporal/portfolio comparisons. Propagate those exceptions to the canonical architecture, ADR-05/ADR-07, DL-XRAY-01/DL-TIME-01 source cards and regenerated projections. Prove identical analytical outputs when only agent-config presence or timing differs. Fresh P1 findings and #313 remain open.

For #349, greedy fixed role priority can assign a multiply-qualified support row to coverage despite a coverage-only alternative that would permit all minima. Specify deterministic quota-aware assignment, prove feasible minima survive input-order permutations, and preserve explicit shortfalls when infeasible. The diagram must rank the admitted working set after the ceiling binds, not all original eligible rows. #66/#69 and fresh findings remain open.

#363 is the explicit follow-up to the safe #343 merge. Its six observed false negatives are CSS escapes in schemes, function names and import identifiers; URL tab normalization; special-URL backslashes; and quoted angle brackets in markup attributes. The local-resource/outbound-anchor/SVG data-URI control passed. Preserve the regressions while implementing bounded browser-consistent handling, then qualify the full gate and review. Do not merge the red draft.

## Other original PRs: restart conditions

- #328: invalidate stale persisted catalogue decisions and fully qualify `Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c)`. No completed implementation of those blockers was recovered or published here; an earlier progress message is not implementation evidence.
- #344: reject empty issue-template frontmatter rather than treating empty extraction as absent; authenticate hosted label reads with the read-only workflow token in both authoritative callers, retaining network-free local validation. Fresh findings remain open.
- #345: separate fail-fast prior-bundle replacement from exhaustive post-write privacy cleanup. A locked old artifact currently permits deletion of other valid old artifacts before refusal. Add a regression preserving all prior bytes when the first replacement removal fails. Transactional replacement redesign is a separate scope.
- #348: preserve or version the published strict ResearchFinding v1 contract before replacing its disclaimer literal.
- #354/#357: reconcile lazy optional surfaces with manual chunking; prove actual module evaluation and measure output. Asynchronous interaction assertions alone are insufficient.
- #340: preserve #202's coherent pre-activation programme boundary. Do not merge this budget component as standalone activation or close #57 independently.
- #359/#360: recovery dossiers, not wholesale merge candidates. Map retained capabilities/invariants to current code, tests or named successors before closure.

## Tooling cleanup and continuation rules

The temporary branch-only materializer created immutable blobs from pinned public inputs. Run 35670943628/job 106567016234 succeeded without updating trees, commits, refs or merges. Connected Git-data actions separately published inspected repairs. The temporary workflow was deleted in `c70546ed01d00aaa8e252c43b897417044fd0300`; it must not land on main. Durable #361 scope is this record and the friction log, not a write-enabled workflow.

Administrative branch-protection reads were unavailable. An annotation request was rejected by the fetch allowlist; the supported workflow-job-log action supplied exact failures instead. One contents update rejected a stale blob SHA; the file was reread and reconciled before retry. Do not force overwrites or retry equivalent generic network workarounds.

Use exact-head jobs, current review threads and SHA-guarded merges. Fresh findings remain blockers even with green CI. Queued, running and skipped jobs are not passing proof. Refresh this checkpoint and late-review observations before continuing.

## Addendum — unattended session later 2026-09-22 (all times UTC)

Merged **#348** (`ed10ed3`, closes #320), **#349** (`4c7df83`, closes #66/#69) and **#345**
(`d12a35f`, closes #300). Main is now `d12a35f`. Post-merge main verified: both touched-seam
suites 5/5 green, `verify:context` passes, tree clean.

- #349 Round-2 batch `3a9f20a` resolved both blocking threads in text (scarcity-first
  multiply-qualified allocation + admitted-working-set diagram arrow, proof #17 extended) and
  answered all five inline threads (two fixed, three already-repaired). Gate passed at the fix
  head before merge.
- #345 reviewed inline: no blocking findings (seams default to the real implementations,
  refusal/cleanup messages carry no paths or values, CLI redaction only echoes `name=` forms).
  Focused suite 4/4 green locally at the head; hosted gate green at the head.
- Local full `npm run check` on the Sep-17 PR base shows storage-v3 failures that pass
  identically on current main (`v3SelectionProof` 6/6 green on main) — a stale-base
  environmental red herring from pre-#351/#355 Windows-local fixes, not a PR defect. Do not
  treat a stale-base full-suite red as a merge gate without the main-controlled comparison.
- #354 fix batch pushed (`7e370d4`): discriminating module-evaluation test green on the lazy
  branch and clean-red on static imports, all 10 dashboard tests + lint green, measured chunks
  index 859.91 → 636.79 kB (gzip 255.82 → 187.77 kB) with both surfaces on demand. Evidence
  commented on the PR; gate rerunning. #217 stays open: index still exceeds the 500 kB warning.

Tooling notes: PowerShell `>` redirect writes UTF-16 and corrupted one falsification probe
(`File appears to be binary`); byte-exact writes used instead. Multi-line exact-text edits fail
to match on CRLF working-tree files; single-line edits plus a CRLF-preserving patch script used
instead (see FR-101/FR-102).
