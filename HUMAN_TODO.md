# Human actions

G1 and G2 are owner-approved. G3 standing authorization is owner-approved for the sensitive
sources named in `docs/source-capability-matrix.md`, within that matrix and the data charter. G4
remains open and is not approved. q-4's synthetic-only publication route remains active.

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

- [ ] **q-3 — Decide whether to approve G4 external-model use.** G4 is separate because it would
  transmit data to another provider and introduces provider retention/training terms, telemetry,
  prompt-injection and payload-review risk, spend controls, provider-held copies, and model-output
  deletion. Until explicitly approved, keep `cap.external.model` `never_authorized` and do not add
  or run a provider, SDK, transport, cache, telemetry, spend path, or model payload.

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
  private output publication, or G4. Runtime activation still requires the reviewed parser,
  transport, projection, storage, rollback, deletion, and exact-head proving checks named by that
  private card.

## Changelog

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
