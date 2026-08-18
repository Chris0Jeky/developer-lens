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

- [ ] **q-6 — Intelligence-platform owner gates (constitution-v2 reconciliation; open and
  non-blocking).** The 2026-08-18 reconciliation replaces the stale “seven genuinely open”
  framing. The following are resolved, agent-executable policy work (not activation): (a) PR/issue
  prose under explicit capability, retention, and parser controls; (b) a durable retrieval index,
  `D1=DURABLE`, subject to the deletion planner and a reviewed task card; (d) own/curated-public
  per-candidate validation under the existing consent, charter, matrix, and release gates; (f)
  `agent_config` presence-only classification, `D5=PRES`; and (g) Discussions and artifact-metadata
  eligibility through reviewed capability/matrix work. The pinned offline local model option (c)
  is recorded as `D12=NO` (option only), not planned implementation. These constitution decisions
  do not activate any capability, source, sink, model, telemetry, credential, or data path; charter
  and capability-matrix reconciliation remains agent work under those gates.

  Retain as genuinely open owner decisions (q-6 remains unchecked): (e) C4-byte content-hash
  cross-repository linkage and deletion cascade; portfolio adoption-timing suppression; rulesets /
  attestations eligibility; freshness-age display grain; and the exact immutable Taskdeck ref plus
  activation when its later card activates. No Taskdeck access or activation is implied by this
  reconciliation, and the deterministic product remains complete without these choices.

- [x] **q-7 — `PR gate / Prove the pull request` is required on `main`.** On 2026-08-05 the
  owner configured classic branch protection for `main` to require the exact
  `Prove the pull request` check. Direct REST and GraphQL reads confirm that context is required;
  force pushes and branch deletion are disabled. The rule does not require an up-to-date branch
  (`strict=false`) and does not enforce administrator inclusion, so repository law still supplies
  the no-red-CI rule for privileged merges. The stated q-7 action is complete.

- [x] **q-8 — Check for and terminate any leaked Claude session processes from the pre-handoff
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
  orphaned partial worktree directory for `value01` remains for the owner's manual review and
  deletion: git has already deregistered it, and the repository floor guard correctly refuses
  recursive deletion outside the project, so an agent cannot remove it. Its contents are regenerable
  build artifacts plus a partial copy of already-pushed tracked files — nothing unique is at risk.
  At that time, product q-8 stayed open; the 2026-08-09 closure below supersedes this historical
  update.

  Update (2026-08-08, P0.5 first-batch session): lab PR #24 — the exact PR this gate parked — was
  MERGED at 22:14:27Z by the account Chris0Jeky, with the lab `Check` workflow green at the merged
  head (`ef57045`). This session cannot verify whether a human performed that merge and infers no
  approval from it; every q-8 gate on lab-checkout write work and future lab merges was treated as
  still binding throughout the session (no lab writes, no lab merges were performed). Owner, please
  confirm: (a) did you merge lab #24 yourself? (b) has the leaked-session sweep been run (Task
  Manager or `tools/mcp-hygiene.ps1`) AND did it confirm that no leaked session process remains?
  q-8 closes only on that confirmed-clean result — the original condition is "no leaked session
  remains", and merely having run the sweep does not satisfy it. (c) the merged CODE_OF_CONDUCT.md
  (PR #212) lists your commit-metadata-public email as the confidential conduct-reporting route;
  an agent cannot commit your inbox, so please confirm you will monitor it for such reports,
  choose a different channel, or direct its removal — until you do, the public routes remain the
  primary documented path. At that time, product q-8 stayed open; the 2026-08-09 closure below
  supersedes this historical update.

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
  here.** A human had to identify and terminate any leaked session before lab merges proceeded; at
  that time, product q-8 stayed open. The 2026-08-09 closure below supersedes this historical
  update.

  Closure (2026-08-09, owner decision + live hygiene evidence): the owner explicitly confirmed
  **"YES, I MERGED"** for lab PR #24 and **"q8 session: CLOSE IT"**. After that answer,
  `claude agents --json --all` reported no active sessions, and the report-only MCP-hygiene sweep
  reported `claude.exe` 0, orphan MCP 0, and Docker MCP containers 0. The confirmed-clean result
  satisfies q-8; it no longer gates lab checkout write work or lab merges. The deregistered
  `dl-worktrees/value01` directory remains a manual owner review/delete action, but is not a
  blocker to this closed process gate.

  Update (2026-08-15, Product #200 ownership observation): a guarded delegate at
  `docs/record-post268-friction-20260815` / `6e90dec` found a pre-existing `FRICTION_LOG.md`
  modification, made no write, and stopped. Immediate refresh found clean new commit `934ed23`
  with the intended one-line correction; the remote branch later advanced to that exact head before
  this governor's guarded push. Ownership cannot be inferred, no work was lost, and the occupied
  worktree was relinquished. This is one FR-001 occurrence, recorded by
  [Product #200 comment 5304291181](https://github.com/Chris0Jeky/developer-lens/issues/200#issuecomment-5304291181)
  and [Product #200 comment 5304325128](https://github.com/Chris0Jeky/developer-lens/issues/200#issuecomment-5304325128).
  It does not prove a leaked process or reopen this checked owner closure; normal Lab gates remain
  in force.

- [x] **q-9 — Claude subagent model pins: SUPERSEDED by owner decision A5 (mandate v2,
  2026-08-08).** On 2026-08-07 the owner directed Opus 4.8 (high) pins for implementation/review
  and Sonnet 4.6 (high) for mechanical work, deliberately avoiding Opus 5. The owner mandate v2
  received 2026-08-08 (`docs/OWNER_CONSTITUTION.md` §5, decision A5) explicitly supersedes that
  preference: Fable 5 coordinates, Opus 5 low is the discovery workforce (`dl-scout`), Opus 5
  high implements and reviews (`dl-implementer`/`dl-reviewer`), Sonnet 4.6 high stays the
  mechanic. Runtime identifiers were verified before the pins changed (the Claude Agent runtime
  resolves `opus` to `claude-opus-5`; a live launch succeeded). Pins live in `.claude/agents/`;
  a further change requires another owner decision.

- [ ] **q-10 — Owner/manual action register from mandate v2 (none blocking for current work).**
  Consolidated from the mandate's remaining human actions: (a) AGPL/CLA legal review — approve the
  contributor-agreement approach before substantial external code is accepted; (b) choose the
  external umbrella brand (N6, later); (c) final five-minute screenshot/video aesthetic sign-off per
  release (H7/T3) — this one BLOCKS each release tag (roadmap P0.5 step 5 precedes the v0.1.0
  tag); (d) choose the Taskdeck immutable ref when the dogfood card activates (T2,
  after #174); (e) choose any remote telemetry destination and approve its privacy notice (O6);
  (f) supply/approve npm/PyPI/packaging credentials when distribution reaches those rungs (O3);
  (g) approve any future stable individual-ranking product mode (constitution §2.1 gate);
  (h) approve private hosted URL architecture/provider later (U6). Agents may prepare options for
  each; none may be self-authorised.

  Owner decisions (2026-08-09): defer q-10(a) CLA/legal review until before substantial external
  code is accepted; all other q-10 decisions remain deferred, except that the joint H7 release is
  reaffirmed. For confidential CoC reports, the owner selected a **separate inbox** but has not
  supplied or approved its monitored address. `CODE_OF_CONDUCT.md` now removes the old personal
  address, warns against posting sensitive details publicly, and provides a content-free request
  route for arranging private contact. Publishing the dedicated monitored address remains an open
  q-10/release action. The q-10(c) five-minute aesthetic sign-off still blocks each release tag.

## Changelog

- 2026-08-18 (constitution-v2 reconciliation): replaced q-6’s stale “seven genuinely open”
  framing with resolved agent-executable policy lanes and retained only the owner decisions that
  remain open; q-6 stays unchecked and no capability is activated.
- 2026-08-15 (Product #200 ownership observation): added the factual guarded-delegate/remote-head
  sequence to closed q-8 and FR-001: a pre-existing friction-log modification caused a no-write
  stop, the intended correction appeared cleanly at `934ed23`, and the occupied worktree was
  relinquished with no work lost. Ownership remains uninferrable; no leaked process, owner action,
  or q-8 reopening is claimed, and normal Lab gates remain in force. Evidence: Product #200
  comments 5304291181 and 5304325128.
- 2026-08-09 (owner-decision closeout): closed q-8 on the owner's explicit confirmation that they
  merged lab PR #24 and that the leaked-session action should close, plus the subsequently clean
  `claude agents --json --all` and report-only MCP-hygiene results (claude.exe/orphan MCP/Docker MCP
  containers all 0). The separately deregistered `value01` directory remains for the owner's manual
  review/delete and does not reopen the process gate. The owner chose a separate, as-yet-unsupplied
  monitored CoC inbox. The old personal address was removed from `CODE_OF_CONDUCT.md`, which now
  warns against public sensitive details and provides only a content-free route for arranging
  private contact until the dedicated address is approved. CLA review and all other q-6/q-10
  decisions are deferred; the joint release remains reaffirmed. No capability changed.
- 2026-08-08 (P0.5 first-batch session, late evening): expanded q-8 with the lab PR #24 merge
  observation (merged 22:14:27Z by account Chris0Jeky, lab CI green; human-vs-agent authorship
  unverifiable from the session; no approval inferred; gates held binding) and asked the owner to
  confirm the merge authorship and the leaked-session sweep. No other item changed; no approval was
  inferred for any gate. Note for q-10(a)/(c): the AGPL baseline merged (PR #209) and community
  scaffolding (PR #212) deliberately contain no CLA text; the CoC lists the maintainer email
  already public in commit metadata as the confidential conduct channel — this was question (c)
  under the q-8 update above and then required explicit owner confirmation; the 2026-08-09
  closeout above supersedes that historical request.
- 2026-08-08 (governor bootstrap): recorded the owner mandate v2 reception. q-9 marked SUPERSEDED
  by owner decision A5 (Opus 5 routing, runtime-verified before the pin change); q-10 added as the
  consolidated owner/manual action register from the mandate (AGPL/CLA legal review, umbrella
  brand, aesthetic sign-off, Taskdeck ref, telemetry destination, packaging credentials,
  individual-ranking gate, private-URL provider). The binding policy unpacking lives in
  `docs/OWNER_CONSTITUTION.md`; no capability was activated and product q-8 remained open at that
  time — lab-checkout write work and ALL lab merges stayed human-gated until the closure recorded
  above.
- 2026-08-07 (parallel-lanes session): expanded q-8 with a third concurrent-writer instance —
  a separate process writing the sibling `developer-lens-lab` checkout mid-run (foreign
  `checkout main`/`pull` reflog entries, divergent local lab `main`, unexplained refs and an elevated
  process count, none created by this session). Product repo verified unaffected. Lab #6 work parked as
  a pull request rather than merged; no owner approval inferred and no other item changed. Product
  q-8 stayed open at that time.
- 2026-08-05: closed q-7 after the owner configured `main` branch protection and live REST plus
  GraphQL reads confirmed `Prove the pull request` is required. No capability was activated;
  q-6 and product q-8 remained open at that time.
- 2026-08-04 (R1 wave 3 state-sync): expanded q-8 with a second leaked-process instance observed
  this run — a lane worker's `vite` dev server survived its worker and blocked a worktree removal,
  identified by command line and terminated — plus the orphaned partial worktree directory
  `dl-worktrees/value01` left for manual deletion (git-deregistered; the floor guard refuses
  recursive out-of-project deletion; contents are regenerable artifacts + a partial copy of pushed
  tracked files). Product q-8 stayed open at that time; no approval was inferred and no other item
  was changed.
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
