# Human actions

G1 and G2 are owner-approved. G3 standing authorization is owner-approved for the sensitive
sources named in `docs/source-capability-matrix.md`, within that matrix and the data charter. G4 is
owner-approved only for the OpenAI/GPT-5.6-Luna boundary recorded below. q-4's synthetic-only
publication route remains active.

- [x] **q-1 — G2 retention and real migration approved.** The owner delegated the implementation
  details and accepted the existing conservative policy: C1 retains 36 rolling months, C2 13
  months, C3 90 days, and C4 only for the process/worker lifetime. A real v1 migration uses one
  timestamped application-controlled backup, a new SQLite target, atomic/idempotent import,
  untouched old JSON, integrity/replay/rollback proof, and a seven-day grace period after a
  successful migration report. On failure, retain the old JSON and switch readers back. After the
  grace period, application-controlled cleanup removes the old JSON and migration backup. This
  approval does not waive issues #5/#6, bounded task cards, selected paths, failure tests, or the
  prohibition on tracking/publishing private data.

- [x] **q-2 — Standing G3 authorization approved for named sensitive sources.** The current set is
  Actions, deployments, dependencies, Dependabot/code-scanning security aggregates, Projects,
  ownership, and source structure. Secret scanning, draft/private advisories, people graphs, raw
  content, logs, artifacts/caches, and working-tree data remain rejected. A future source may be
  named through a reviewed matrix/registry change without another owner question only when it stays
  inside the existing product boundary, classes, read-only least-privilege posture, explicit local
  selection, retention/deletion rules, and prohibited-surface list. Every executable capability
  remains `never_authorized` until a bounded implementation supplies and tests its activation path;
  this approval does not mutate credentials or authorize external writes.

- [x] **q-3 — G4 external-model use approved for OpenAI GPT-5.6 Luna.** On 2026-08-04 the owner
  explicitly chose OpenAI as provider, `gpt-5.6-luna` as model, and the environment variable
  `Llm__OpenAi__ApiKey` as the only credential source. The approved boundary is the stateless
  Responses API with `store: false`, no hosted tools/files/vector stores, local retrieval only, a
  strict user-reviewable C1 evidence allowlist, structured hypotheses, and hard per-run token,
  request, and spend ceilings. OpenAI's published default may still retain abuse-monitoring content
  by default for up to 30 days (subject to its documented legal/safety exceptions) and encrypted
  prompt-cache state for up to 24 hours; this is not a zero-data-retention claim. Local revocation
  cannot recall provider-held copies. The exact contract is in
  `docs/data-charter.md` and `docs/source-capability-matrix.md`. This approval authorizes bounded
  implementation, not an automatic request: `cap.external.model` remains `never_authorized` until
  a separate task card, strict payload/output tests, review, and exact hosted gate activate it.

- [x] **q-4 — Publication route chosen: public synthetic product, agent-authorized code-only branch.**
  Keep the existing public remote and synthetic Pages surface. Agents may implement, test, review,
  commit, push, and open or manage pull requests through the exact declared
  `origin` -> `Chris0Jeky/developer-lens` route. Only the top-routed Sol model may merge, and only
  after the exact tracked-diff, synthetic-showcase canary, required review, CI/proving checks, and
  post-push aging gates pass. The repository retains `sensitive_data=true`; this route changes the
  publication actor, not the protected-data boundary.
  Publication may contain only code, tests, documentation, and invented synthetic assets. Never
  publish `.developer-lens/`, generated or private datasets, credentials, browser profiles, caches,
  local paths, or private inputs. The existing Pages workflow may publish only its verified synthetic
  artifact. Any separate registry reconciliation follows the matching public Developer Lens
  authority/policy commit and its own normal gates; do not copy private registry metadata here.

- [x] **q-5 — First bounded `github.core` repository selected.** On 2026-08-04 the owner
  explicitly selected one public repository and authorized end-to-end completion within the
  existing G2 product boundary. The exact repository identity, provider ID, task path, and runtime
  values stay only in an ignored local task card. The approved read boundary is public,
  unauthenticated, GET-only repository lifecycle metadata plus open issue/pull-request lifecycle
  units in a bounded time range and pagination/rate-limit headers. It does not authorize a token,
  credential mutation, local checkout/database/working-tree inspection, prose or people fields,
  private output publication, or an external-model request. Runtime activation still requires the
  reviewed parser, transport, projection, storage, rollback, deletion, and exact-head proving
  checks named by that private card.

- [ ] **q-6 — Intelligence-platform owner gates (none blocking; decide at leisure).** The
  2026-08-04 planning session (plus its reconciliation) consolidated seven genuinely open owner
  decisions in
  `docs/analyser-program/08_OPEN_QUESTIONS.md` §1, mirrored as QUESTION cards on the seeded local
  Taskdeck board: (a) PR/issue prose semantic tier; (b) durable retrieval index as a reviewed
  sink; (c) pinned offline local model option; (d) per-candidate consented real datasets for ML
  validation; (e) cross-repository artifact identity key; (f) `agent_config` role class +
  adoption-timing suppression; (g) capability-matrix rows for rulesets/attestations/discussions
  (G-d) and artifact metadata-only counts (G-e) — the affected cards (DL-PORT-02, DL-PROV-01) are
  owner-gated on the board and must not be implemented before a reviewed matrix change or your
  decision; (h) *(added by the 2026-08-04 reconciliation review; question card DL-Q-GRAIN on the
  board and in `08_OPEN_QUESTIONS.md` §1)* display grain for freshness age:
  the UX renders staleness as an hour-precision age (`stale 31h`, canonical feature
  `DL.COV.FRESHNESS_AGE_H.v1`) while operational collection timing is floored to ISO week — decide
  whether the week floor also binds derived age durations (which can pin the collection run) or
  whether hour-grain staleness is an accepted exception. Additionally, the future real local
  Taskdeck dogfood analysis
  (spec: `docs/analyser-program/06_TASKDECK_DEMO_PLAN.md` §2) still needs your explicit selection
  of exact immutable refs and approval of its activation card before any run. Nothing on the
  implementation critical path depends on any of these; refusing all of them leaves a complete
  deterministic product.

- [x] **q-7 — `PR gate / Prove the pull request` is required on `main`.** On 2026-08-05 the
  owner configured classic branch protection for `main` to require the exact
  `Prove the pull request` check. Direct REST and GraphQL reads confirm that context is required;
  force pushes and branch deletion are disabled. The rule does not require an up-to-date branch
  (`strict=false`) and does not enforce administrator inclusion, so repository law still supplies
  the no-red-CI rule for privileged merges. The stated q-7 action is complete.

- [ ] **q-8 — Check for and terminate any leaked Claude session processes from the pre-handoff
  session.** On 2026-08-04 the handed-off session kept executing for over an hour after handoff —
  it merged [PR #87](https://github.com/Chris0Jeky/developer-lens/pull/87) itself and collided in a
  worktree on the [PR #89](https://github.com/Chris0Jeky/developer-lens/pull/89) lane before it
  stood down cleanly. Leaked agent/MCP processes waste RAM and usage and can interfere with active
  lanes. Check for and terminate any orphaned Claude session processes — use Task Manager, or the
  `claude-config` repo's `tools/mcp-hygiene.ps1` sweep. This is a local machine-hygiene action for a
  human to perform; agents cannot verify or close it, so it stays open until you confirm no leaked
  session remains.

  Update (2026-08-04, R1 wave 3 state-sync): a second leaked-process instance occurred this run — a
  lane worker's `vite` dev server survived its worker and blocked a worktree removal; the process
  was identified by its command line and terminated. Separately, the orphaned partial worktree
  directory `C:/Users/jekyt/Desktop/Printer Config/Others/Git/dl-worktrees/value01` remains for
  manual deletion: git has already deregistered it, and the repository floor guard correctly refuses
  recursive deletion outside the project, so an agent cannot remove it. Its contents are regenerable
  build artifacts plus a partial copy of already-pushed tracked files — nothing unique is at risk.
  q-8 stays open.

  Update (2026-08-07, parallel-lanes session): a THIRD concurrent-writer instance was observed, this
  time in the sibling `developer-lens-lab` checkout. During a delegated lab #6 correctness slice a
  separate process ran a `checkout main` + `pull` inside the SAME lab working directory mid-run
  (reflog-confirmed), briefly landing the worker's commits on `main` before the worker remediated them
  onto its branch; local lab `main` also sat behind its upstream, and several unexplained refs plus an
  elevated host process count (none created by this session) corroborated the competing writer. The
  product repo was verified UNAFFECTED (clean reflog, upstream unmoved). To avoid racing the other
  writer, the lab #6 work was preserved as a parked pull request (do-not-merge) rather than merged, and
  no further lab lanes were spawned. **Until this is resolved — a human terminates any leaked session,
  or a verified isolated worktree is used — agents must NOT run further WRITE work in the affected lab
  checkout: a competing writer in the same working directory can corrupt a branch mid-slice, as it did
  here.** A human must identify and terminate any leaked session before lab merges proceed. q-8 stays
  open.

- [x] **q-9 — Claude subagent model pins approved.** On 2026-08-07 the owner directed, in the
  session that introduced the dual-runtime harness (PR #191), that Claude subagent pins use
  Opus 4.8 (high effort) for implementation and review and Sonnet 4.6 (high effort) for mechanical
  work, with the coordinating session staying at the orchestration/decision/architecture level.
  Opus 5 is deliberately not used for subagents (owner-observed regressions). The pins live in
  `.claude/agents/`; changing them requires a new owner decision.

## Changelog

- 2026-08-07 (parallel-lanes session): expanded q-8 with a third concurrent-writer instance —
  a separate process writing the sibling `developer-lens-lab` checkout mid-run (foreign
  `checkout main`/`pull` reflog entries, divergent local lab `main`, unexplained refs and an elevated
  process count, none created by this session). Product repo verified unaffected. Lab #6 work parked as
  a pull request rather than merged; no owner approval inferred and no other item changed. q-8 stays
  open.
- 2026-08-05: closed q-7 after the owner configured `main` branch protection and live REST plus
  GraphQL reads confirmed `Prove the pull request` is required. No capability was activated;
  q-6 and q-8 remain open.
- 2026-08-04 (R1 wave 3 state-sync): expanded q-8 with a second leaked-process instance observed
  this run — a lane worker's `vite` dev server survived its worker and blocked a worktree removal,
  identified by command line and terminated — plus the orphaned partial worktree directory
  `dl-worktrees/value01` left for manual deletion (git-deregistered; the floor guard refuses
  recursive out-of-project deletion; contents are regenerable artifacts + a partial copy of pushed
  tracked files). q-8 stays open; no approval was inferred and no other item was changed.
- 2026-08-04: the R1 wave-2 state-sync closeout recorded q-8 — a human machine-hygiene check to
  terminate any leaked Claude session processes from the pre-handoff session, which kept executing
  for over an hour after handoff. No approval was inferred and no existing item was changed.
- 2026-08-04: DL-OPS-CI-01 landed the hosted pull-request gate `.github/workflows/pr-gate.yml` and
  recorded q-7, the admin-only step of marking that check required in `main` branch protection. No
  owner approval was inferred and no capability was activated; the workflow uses no secrets and no
  real data.
- 2026-08-04 (reconciliation): the post-PR #62 reconciliation added q-6 item (h)
  (freshness-age display grain) surfaced by the review pass, and changed no other human action.
  The directive's resolved design choices were integrated into docs/cards directly, not turned
  into new HUMAN_TODO items; no approval was inferred for any existing gate.
- 2026-08-04: the intelligence-platform planning session recorded q-6 — a consolidated register of
  six new open owner gates plus the future Taskdeck-dogfood ref selection. No approval was inferred;
  every listed decision remains open and non-blocking.
- 2026-08-04: the owner explicitly approved G4 for OpenAI `gpt-5.6-luna` using the securely assigned
  `Llm__OpenAi__ApiKey` environment variable. q-3 records the narrow provider, payload, retention,
  retrieval, spend, and deletion boundary without activating a runtime request.
- 2026-08-04: the owner selected the first real public repository for a bounded `github.core`
  activation and delegated end-to-end execution. q-5 records only the public policy boundary; the
  selected identity and operational values remain in the ignored local task card.

- 2026-08-03: the owner explicitly approved real migration/retention and every named sensitive
  source, delegating reasonable details. q-1 adopts the existing conservative retention/migration
  protocol; q-2 grants standing G3 authority within the charter/matrix. G4 was discussed but not
  approved, so q-3 remains open and `cap.external.model` stays `never_authorized`.
- 2026-08-03: earlier that day, the owner clarified that only G1 was then trusted as approved and
  that generated G2/G3/G4 checks or prose were not authorization. q-1 through q-3 were reopened;
  the newer explicit decision above now supersedes that G2/G3 state while leaving G4 open.
- 2026-08-03: the owner explicitly replaced q-4's human-only relay with full agent permission to
  push and open/manage pull requests for the code-only/synthetic public branch; only the top-routed
  Sol model may merge after normal diff, canary, review, CI/proving-check, and aging gates. The
  prohibited-data boundary is unchanged.
- 2026-08-03: a superseded generated entry claimed Codex could approve G2/G3/G4. The owner's later
  clarification above establishes that claim as non-authoritative and it authorizes no work.
- 2026-08-03: G1 was explicitly approved in the initiating request. Developer Lens is declared T2
  with the `sensitive_data` overlay and `push: free` / `merge: free` authority.
- 2026-08-03: the owner changed implementation sequencing to demo-first. D1-D3 prioritize a
  working local synthetic demo, rapid feedback, and focused testing. Security/privacy hardening is
  documented in `docs/POST_DEMO_HARDENING.md` and deferred until D3, except for the irreversible
  floor and the real/private-data or publication boundaries above.
