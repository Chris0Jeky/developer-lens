# Current state (compact resume artifact — DL-CONTEXT-01)

This is the single operational resume artifact. Live Git and GitHub outrank its timestamped
observations and must be refreshed before action; `docs/IMPLEMENTATION_LEDGER.md` retains
completed-slice evidence and history.

```yaml
updated: '2026-10-02'
state_observed_at: '2026-09-22T23:25:00Z'
work_class: 'W3 product slices and producer-owned cross-repository contracts'
active_wave: 'P0.5 v0.1.0 release programme — Product issue #200 (owner-gated); Phase E and #202 readiness advancing'
remote_refs_last_observed_at: '2026-09-22T23:25:00Z'
observation_semantics: >-
  product_main and lab_main are last-observed remote-ref snapshots at remote_refs_last_observed_at,
  not perpetual current-baseline assertions; refresh live Git/GitHub before any action.
product_main: 'b4b82535237e0ccbcbe37d4d101e668aafad4e54'
lab_main: '551c518d0281419d3a009b4c0a56b0ed026011c3'
active_slice: >-
  2026-10-02 task: main was refreshed at 9704118b578f2901a18b29753a3b6f7a945572e5.
  #385 owns #375 on fix/change-batch-withheld-quantiles (68ed29f): typed withholding of
  cohort values plus sensitivity/tampering checks; 200 focused tests passed. The companion
  draft #387 on fix/stored-change-batch-preactivation owns all five #376 findings; 119 focused
  tests, lint, TypeScript, context, fixture drift, showcase/privacy build and independent review
  passed. Original exact-head Windows full checks passed for #385 (1835 tests) and #387 (1852 tests),
  each with 13 existing skips. #385's fresh hosted gate passed and it merged as cbee0c4.
  The owner now authorizes review/fixes/safe merges and the established synthetic Pages deployment.
  #387 merged as 76a659e after exact-head 47a98e2 passed 1852 Windows tests (13 existing skips),
  showcase and hosted proving; SDK 3.3.1 from #391 is preserved. #385's ledger thread is resolved.
  #389 now fixes the review's primary-role swap using canonical cbt.all and full metric/scope/window
  identity: eight failing-first regressions, then 83 focused tests passed. Qualify its new head,
  then #390's omitted-row count-reference correction; the PR Proof sections carry exact-head evidence.
  One writer per isolated checkout,
  one suite/build and one test worker.
  No real data, endpoint activation, release tag or owner-hold override is selected.
  The September remote snapshots above remain dated history.
next_value_slice: >-
  Complete exact-head qualification and safe integration of #389/#390, then verify the final
  main's Pages deployment and public synthetic smoke. #389 and #390 address the already reproduced
  #386/#388 consistency findings. Other choices after this campaign include
  #202's remainder:
  the #86 `v2_coverage_record` id-shape decision, the #168/#177 H5 reassessment, and a Windows
  owner-only ACL / secure task-root check for the installation key. (3) #80's scope-unbound C1
  expiry and resolver lineage join. (4) #201 Data Charter v2. (5) The low-risk trackers #368, #371
  and #374. Consumers: CommitAtlas #145/#154 can now vendor PublicLensProjection.v1 (`d34e41b`) and
  the amended ResearchFinding v1 (`d9e40c1`); Lab #97 can consume ResearchFinding v1. All three
  consumers were announced on CommitAtlas #111 and Lab #97. The v0.1.0 tag stays blocked on
  Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c), and the release-prep slice is re-created from
  scratch only after that gate (#298).
blockers: >-
  Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c) remains the sole tag-blocking owner gate. Real
  migration and collection are already owner-approved within
  Chris0Jeky/developer-lens::HUMAN_TODO.md::q-1 and Chris0Jeky/developer-lens::HUMAN_TODO.md::q-5;
  their activation still requires #202's remaining implementation preconditions plus a bounded,
  reviewed activation task card whose parser, transport, projection, storage, rollback, deletion
  and exact-head checks pass before any capability leaves `never_authorized`. The stored Phase E
  endpoint requires #375/#376. The other Chris0Jeky/developer-lens::HUMAN_TODO.md::q-6 and
  Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10 items are deferred and nonblocking for the tag,
  except that Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(f) still owner-gates package-registry
  credentials. No
  tag, release or package publication is authorized before
  Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c). Existing verified synthetic Pages publication
  remains permitted by Chris0Jeky/developer-lens::HUMAN_TODO.md::q-4.
last_verified_checks: >-
  Each merged PR's exact-head `Prove the pull request` run succeeded before merge (#367 also passed
  `Prove native Windows test roots`), and main's `Deploy public showcase` runs succeeded through
  `3a8c34e`; the run for `b4b8253` was in progress at the observation. Local Windows proofs:
  `npm run check` at #373's final head `ada1427` passed 112 files (1716 passed, 13 skipped);
  `npm run test:demo:v2` 9/9; `npm run build:showcase` passed on each export- or UI-touching
  branch. Every non-documentation PR received one fresh-context adversarial review, plus a scoped
  review of its fix diff; #373 also received the analytical-validity review #174 requires. Details
  are in the 2026-09-22 ledger entry. No protected data, real input, release, tag, package, external
  model, telemetry, or credential path was touched.
active_horizon:
  - 'P0 governor bootstrap PR #206 — delivered'
  - 'P0.5 v0.1.0 release programme #200 — active, product-only release preparation'

operational_resume:
  consumer: 'The next Product/Lab coordinator.'
  question: 'What is landed, parked, unproved, owner-gated, and agent-executable?'
  product_state: >-
    Product main above is a last-observed remote-ref snapshot, not a perpetual current baseline; it
    is the `b4b8253` merge of PR #373. There are zero open Product pull requests, zero tags and zero
    releases, and 28 open issues at the observation.
  lab_state: >-
    Lab main above is a last-observed remote-ref snapshot (`551c518`, the PR #106 merge). Lab #97
    may now consume the amended ResearchFinding v1. CommitAtlas #145 and #154 may consume their
    producer contracts.
  next_selection: >-
    See next_value_slice. Prefer #376/#375 or #202's remainder when advancing towards activation,
    and #201 when advancing the charter. Do not tag or publish a release/package before
    Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c).

lab_delivery:
  repository: 'Chris0Jeky/developer-lens-lab'
  main_check: 'Lab main 551c518 (PR #106 merge, 2026-09-10); refresh its Check run before any Lab action.'
  open_pull_requests: 'Zero open Lab pull requests at the 2026-09-22 observation; Lab #97 is unblocked.'

release_readiness:
  lab_q11: 'CLOSED: Chris0Jeky/developer-lens-lab::HUMAN_TODO.md::q-11 is recorded signed off.'
  browser_visual_qa: >-
    VERIFIED earlier for the tracked invented C0 Method Trial at desktop and 390px. The new Phase E
    Atlas panel and the 2026-09-22 chunk split have not had a separate browser/visual pass.
  remaining_owner_gate: >-
    Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c) — five-minute Product aesthetic sign-off.
  release_actor_after_owner_gate: >-
    OWNER_CONSTITUTION.md A1=FULL: agents execute synchronized tag, version, package, and
    C0-publication mechanics after Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c), under normal
    exact-head gates.
  prohibited_until_then: >-
    No tag, release, package publication or owner decision is inferred from this state. Only the
    existing verified C0 showcase follows Chris0Jeky/developer-lens::HUMAN_TODO.md::q-4.

authority_and_boundary:
  owner_policy: 'docs/OWNER_CONSTITUTION.md'
  human_actions: 'HUMAN_TODO.md'
  no_activation: >-
    No real-data collection, external-model call, telemetry, credential handling, or
    protected-data access is selected. The Phase E stored endpoint is unwired and answers 404.
  source_of_history: 'docs/IMPLEMENTATION_LEDGER.md'

exact_resume_point: >-
  #385 merged as cbee0c4 after exact-head local/hosted proof. Refresh #387/#389/#390 heads, reviews
  and checks, retarget to main in dependency order and requalify before each authorized merge.
  All are synthetic-only fixes; the owner authorized safe merge and the existing verified Pages
  deployment on 2026-10-02. Verify the final deployed commit and public C0 smoke, retaining the
  previous verified main 9704118 as the rollback baseline. Run one suite/build and one test worker.
  Stored-path activation of
  Phase E requires #375 and #376 first; real migration or collection requires #202's remainder and
  a bounded, reviewed activation task card within the approved Chris0Jeky/developer-lens::HUMAN_TODO.md::q-1 and
  Chris0Jeky/developer-lens::HUMAN_TODO.md::q-5 boundaries. Do NOT attempt to refresh release/prepare-product-v0.1.0-20260818
  at 54217ff: Product #298 owns re-creating that slice after
  Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c). Until that owner action, no tag, release,
  package publication is authorized. Existing verified synthetic Pages publication remains
  permitted by Chris0Jeky/developer-lens::HUMAN_TODO.md::q-4.
```
