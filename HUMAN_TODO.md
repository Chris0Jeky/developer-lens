# Human actions

There are no open owner decisions. On 2026-08-03 the owner explicitly delegated q-1 through q-4
to Codex with a productivity-first mandate. The checked items below record the resulting binding
defaults. A checked decision authorizes its bounded implementation; it does not claim that the
runtime capability, migration, deletion, or publication has already been executed or verified.

- [x] **q-1 — G2 retention and migration approved with the recommended lifetimes and a fixed
  migration protocol.** C1 retains 36 rolling months, C2 13 months, C3 90 days, and C4 only for
  the process/worker lifetime. Repository names remain in the isolated local identity boundary and
  use aliases elsewhere; PR titles are absent from canonical analytics. Before the first real v1
  migration, create one timestamped application-controlled backup, import atomically and
  idempotently into a new SQLite target, leave the old JSON untouched, and validate integrity,
  deterministic replay, and rollback. Keep the old JSON and migration backup for a seven-day grace
  period after a successful migration report, then remove them through application-controlled
  cleanup. On failure, retain the old JSON and switch readers back to it. Revocation/deletion covers
  application-controlled observations, descendants, caches, packs, and backups, while reports must
  state that copied exports, provider-held copies, filesystem snapshots, and physical-media erasure
  are outside the application's guarantee. Work within this policy needs a bounded task card and
  proving tests, not another owner decision.

- [x] **q-2 — Standing G3 authorization granted for all seven named sensitive sources.** Actions,
  deployments, dependencies, Dependabot/code-scanning security aggregates, Projects, ownership,
  and source structure may be implemented and used in their declared phases for repositories
  explicitly selected locally. The capability matrix's purpose, class ceiling, retained fields,
  deletion cascade, and rejected surfaces remain binding; secret scanning and draft/private
  advisories remain rejected. Use read-only least-privilege provider access. If current credentials
  lack a permission, record `restricted` or `unavailable` and continue with the remaining queue
  instead of asking for another policy decision or mutating account authorization. Runtime
  activation still needs the capability's bounded implementation, selected scope, and focused
  tests, but no further owner approval.

- [x] **q-3 — G4 refused for the current roadmap.** Keep `cap.external.model`
  `never_authorized`; do not add an external provider, SDK, transport, provider cache, telemetry,
  spend path, or model payload. The deterministic product is the complete product, and P12 is
  excluded from the active queue. Reopen G4 only after a future explicit owner request naming the
  provider, exact redacted input schema, spend limit, and verified retention/training terms.

- [x] **q-4 — Publication route chosen: public synthetic product, agent-authorized code-only branch.**
  Keep the existing public remote and synthetic Pages surface. Agents may implement, test, review,
  commit, push, and open or manage pull requests through the exact declared
  `origin` -> `Chris0Jeky/developer-lens` route. Only the top-routed Sol model may merge, and only
  after the exact tracked-diff, synthetic-showcase canary, required review, CI/proving checks, and
  post-push aging gates pass. The repository retains `sensitive_data=true`; this route changes the
  publication actor, not the protected-data boundary or the global runtime-hook pause.
  Publication may contain only code, tests, documentation, and invented synthetic assets. Never
  publish `.developer-lens/`, generated or private datasets, credentials, browser profiles, caches,
  local paths, or private inputs. The existing Pages workflow may publish only its verified synthetic
  artifact. Any separate registry reconciliation follows the matching public Developer Lens
  authority/policy commit and its own normal gates; do not copy private registry metadata here.

## Changelog

- 2026-08-03: the owner explicitly replaced q-4's human-only relay with full agent permission to
  push and open/manage pull requests for the code-only/synthetic public branch; only the top-routed
  Sol model may merge after normal diff, canary, review, CI/proving-check, and aging gates. The
  prohibited-data boundary and global runtime-hook pause are unchanged.
- 2026-08-03: the owner delegated q-1 through q-4 to Codex under a productivity-first mandate.
  Codex approved G2 with 36m/13m/90d/process retention and a seven-day migration grace period,
  granted standing G3 authorization to all seven named sources, refused G4 for the current roadmap,
  and initially selected a human-relayed code-only/synthetic public publication route; the newer
  entry above replaces only that route's actor restriction.
- 2026-08-03: G1 was explicitly approved in the initiating request. Developer Lens is declared T2
  with the `sensitive_data` overlay and `push: free` / `merge: free` authority.
- 2026-08-03: the owner changed implementation sequencing to demo-first. D1-D3 prioritize a
  working local synthetic demo, rapid feedback, and focused testing. Security/privacy hardening is
  documented in `docs/POST_DEMO_HARDENING.md` and deferred until D3, except for the irreversible
  floor and the real/private-data or publication boundaries above.
