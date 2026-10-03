# Dependency audit collection: recovery and event coverage

## Decision and boundaries

Consumer: maintainers triaging issue #398. The collector produces inspectable dependency/advisory identities and an exact lockfile digest, not a security approval. Successful collection can contain vulnerabilities. No package versions, existing required gates, permissions, source capabilities, telemetry, or release gates change.

PR #402 reached its bounded review-repair ceiling and was parked at `f36a144114ea24d8d2645ff57fdd7940916e69de`. This coordinator-owned replacement is based on main `964181769efef1d5f40eeca0a1907f67cf93e032`, preserving #403. It retains the four reviewed audit script/test blobs unchanged and completes only the outstanding retarget-event contract. The old branch and its failed receipts are preserved; no shared history is rewritten.

## Implementation and proof plan

The workflow subscribes to `edited` and reuses the required PR gate's predicate: `github.event.action != 'edited' || github.event.changes.base`. A title/body edit must not collect a new report, cancel existing proving, or imply fresh security acceptance. Base retargets must collect against the new integration. There is no audit concurrency group, privileged `pull_request_target`, secret input, installation, lifecycle script, or mutation command.

Five new configuration regressions accompany the change. Supplementary Node execution of the same assertions, adapting only Vitest registration, had three failures/two passes before and five passes afterward. This does not replace Vitest, GitHub expression evaluation, or full-suite proof.

Native acceptance: open the replacement draft against a temporary branch pinned to the same base, verify no main-filtered audit runs there, retarget to main, and inspect the resulting exact-head run. Then edit only the title/body and inspect the skipped collector without cancelling proving. Record run IDs and outcomes in the replacement PR. Retain the test base ref under the existing no-deletion policy.

## Earlier evidence and remaining work

At the archived head, PR gate 37142259745 and audit collection 37142259653 passed. Failed run 37141869452 remains a failed receipt: asset-style URL transformation broke test filesystem reads. The final archived scripts use repository-root filesystem resolution. These old receipts do not prove this replacement or its newer base.

Issue #398 retains dependency remediation. The earlier report had four affected package entries representing two advisory chains. Fresh advisory identity, registry metadata, install and audit evidence must precede any dependency-change claim. No full local npm, native Windows, browser, release or activation proof is inferred from the supplementary tests.

Rollback: revert this optional collector and its tests through a reviewed PR; existing required proving remains unchanged. Stop on changed ownership, permission requirements, unresolved review findings or failed exact-head gates. A later session starts from live main and the replacement PR, never from the archive's stale SHA alone.
