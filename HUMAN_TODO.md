# Human actions

Read this file at session start and surface every open item in milestone summaries. Agents may
close an item only after the owner supplies the named decision and every stated condition is
directly verified. Do not infer approval, acknowledgement, or subjective confirmation.

- [ ] **q-1 — Decide G2 retention and migration before any real private data is read or moved.**
  Context: P2 cannot inspect or migrate the existing private JSON without an explicit policy for
  retention, repository-name isolation, PR-title removal, backup, grace period, deletion, rollback,
  and the limits of physical/external erasure. Recommended action: approve C1=36 rolling months,
  C2=13 months, C3=90 days, C4=process lifetime, names isolated locally, and PR titles absent from
  canonical analytics. Human step: review `docs/data-charter.md`, then state either `Approve G2 as
  recommended` or list the exact revisions. Until then, keep P2 synthetic-only and do not read
  `.developer-lens/` or any generated/private dataset.

- [ ] **q-2 — Authorize each G3 source only when its phase is ready.** Context: Actions,
  deployments, dependencies, security, Projects, ownership, and source-structure access each have
  distinct privilege and re-identification risk. Recommended action: leave every G3 capability off
  until G2 is approved and its bounded task card identifies the provider permissions, selected
  repositories, retained fields, deletion behavior, and proving tests. Human step: close q-1 first,
  then approve or refuse one named capability; approval of one never authorizes another.

- [ ] **q-3 — Keep G4 external-model transmission absent unless a concrete provider contract is
  reviewed.** Context: the deterministic local product is complete without a model. Recommended
  action: leave G4 closed. Human step if this ever changes: name the provider, exact redacted input
  schema, spend limit, and verified retention/training terms before any SDK, transport, provider
  cache, telemetry, or payload is introduced.

- [ ] **q-4 — Choose the publication route before this sensitive-data branch reaches the public
  remote.** Context: T2 `push: free` governs autonomy, but the `sensitive_data` overlay still denies
  agent pushes to the repository's currently public remote; the free dial does not override that
  privacy wall. Recommended action: keep the branch local until the exact code-only/synthetic diff
  is reviewed, then either make the remote private or explicitly authorize a human-relayed public
  branch push while preserving synthetic-only Pages. Human step: state the chosen route; do not
  copy `.developer-lens/`, generated data, credentials, or any private input into the relay.

## Changelog

- 2026-08-03: G1 was explicitly approved in the initiating request. Developer Lens is declared T2
  with the `sensitive_data` overlay and `push: free` / `merge: free` authority. G2, G3, and G4 remain
  unapproved.
