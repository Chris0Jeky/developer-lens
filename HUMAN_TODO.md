# Human actions

Only G1 is trusted as owner-approved. G2, G3, and G4 remain open and require a new explicit owner
decision; earlier checked boxes or generated policy prose do not authorize them. The current task
separately reaffirms q-4's synthetic-only publication route.

- [ ] **q-1 — Decide G2 retention and real-migration policy.** No real/private migration, backup,
  grace-period cleanup, deletion, or production reader may run until the owner explicitly approves
  the complete policy in a new bounded task.

- [ ] **q-2 — Decide G3 authorization for each named sensitive source.** No sensitive-source
  collector or runtime activation may run until the owner explicitly approves the named source and
  scope.

- [ ] **q-3 — Decide G4 external-model policy.** Until then, keep `cap.external.model`
  `never_authorized` and do not add or run a provider, SDK, transport, cache, telemetry, spend path,
  or model payload.

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

## Changelog

- 2026-08-03: the owner explicitly clarified that only G1 is trusted as approved and that generated
  G2/G3/G4 checks or prose are not authorization. q-1 through q-3 are reopened; q-4 remains active
  for this explicitly requested synthetic-only code/PR route.
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
