# DL-LIFE-02B execution decision

Status: **accepted for bounded implementation; not a completion or activation record**
Date: 2026-08-05
Authority: `HUMAN_TODO.md` q-1/q-2, `docs/data-charter.md`,
`docs/source-capability-matrix.md`, architecture revocation/retention rules, canonical card
DL-LIFE-02, and issue #80.

PR #103 delivered slice A: a fail-closed transactional planner for the registered incremental and
claim SQLite graph. It deliberately reports `completeProduct:false`. This record defines the work
still required before DL-LIFE-02 may be DONE, issue #80 may be closed, or a retained C2/C3 source
may become schedulable. Every executable capability remains `never_authorized`; all proving data
is invented.

## 1. Decisions and rejected shortcuts

1. **Use a copy/shadow storage-v3 migration, not opportunistic in-place alteration.** The source
   store stays selected and unchanged until the complete target passes schema, graph, privacy,
   integrity, replay, and rollback proof. Failure discards only the incomplete target. No task may
   inspect a real store while designing or testing this path.
2. **Preserve the existing canonical forms that are already contractual.** Scope IDs remain
   `scope-` plus 64 lowercase hex; claim IDs remain `cl_` plus 64 lowercase hex under their
   versioned claim-ID material. New retained C1 keys for currently opaque operational entities use
   a closed registry (`job-`, `snap-`, `ckpt-`, `cov-`, `ev-`, `art-`, and `del-`, each followed by
   64 lowercase hex). Retained C1 keys are minted from fresh random entropy only; they are never an
   HMAC or other function of an alias, provider ID, timestamp, path, or old ID. The existing
   installation-key seam authenticates C2 alias continuity and migration inputs but never produces
   a retained C1 key.
3. **Do not retain an old-to-new mapping.** Alias-bearing `coverage_id`, caller job/snapshot/
   checkpoint IDs, exact range material, and temporary migration maps remain C2. A migration keeps
   its complete mapping in transaction memory only, rewrites every dependent edge, remints every
   claim whose versioned ID material changes, proves closure, and destroys the map before the target
   becomes selectable. Counts and content-free hashes are the only migration proof outputs.
4. **A permanent refusal is not a migrated domain.** Every present app-owned SQL table receives a
   concrete preserve/rewrite/delete disposition below. An ambiguous binding aborts the whole target;
   it never becomes an `unknown` scope and never partially migrates.
5. **Retention is exact and exhaustive.** Clearing only `claim_scope.scope_alias` is insufficient.
   Every incremental row containing C2 identifiers or exact operational timestamps expires, or is
   rewritten into a C1-only retained form, under the 13-month rule below.
6. **Deletion explanations use C1 subjects.** Resolver tombstones cannot be addressed by the
   alias-bearing coverage/job keys they replace. Coverage, job, snapshot, checkpoint, evidence,
   claim, scope, and registered artifact subjects use the closed C1 key registry. Arbitrary opaque
   lineage subjects/causes and old alias-bearing lineage rows do not survive storage-v3 migration.
7. **Present user-directed exports are outside app-controlled deletion.** The current analysis-pack
   builder accepts a caller-selected output directory and has no scope-ownership catalogue. Treat
   its output as a user-directed export that cannot be recalled. A future app-owned pack cannot
   reach `COMPLETE` until a confined catalogue durably binds the whole artifact to all owning
   scopes. Revoking any one scope deletes the whole app-owned artifact; immutable packs are never
   edited in place.
8. **LIFE-03 stays separate.** LIFE-02 may enumerate and delete a registered backup artifact, but it
   does not create, select, validate, restore, or replay backups. LIFE-03 owns resurrection safety
   and the first-real-migration wrapper: a timestamped backup, the copy protocol's seven-day
   grace/fallback window, cleanup of the old JSON source plus migration backup, restore proof, and
   tombstone replay before a real source can run.

Rejected shortcuts: `ON DELETE CASCADE` without tombstone replay; a retained C2 mapping table;
hashing aliases into supposedly C1 keys; a generic filesystem scan; deleting all packs when scope
ownership is unknown; retaining expired aliases for continuity; changing only TypeScript writers
while raw SQL UPDATE remains able to cross scopes; or counting a refused legacy domain as deleted.

## 2. Storage-v3 binding and present-table disposition

Storage v3 separates retained C1 anchors from C2 operational observations. Every scope-owned row
carries or resolves to the canonical `scope_id`; evidence and claims reference C1 anchors only.
Deleting an expired C2 observation therefore cannot strand a retained claim or require retaining
its exact range/job/timestamp fields. SQLite INSERT and UPDATE enforcement must reject cross-scope
parents, evidence anchors, coverage edges, supersession/derivation links, and artifact ownership.
Scope and canonical parent keys are immutable after insertion.

| Present domain | Required storage-v3 disposition |
|---|---|
| `collection_job` | Split a C1 `job-` anchor from the C2 operational row; add `scope_id`; caller ID and exact times expire with the C2 row. |
| `source_snapshot` | Split a C1 `snap-` anchor from C2 observation/provenance; bind both to canonical scope/job. |
| `coverage_ledger` | Split a C1 `cov-` anchor from the C2 exact-range/job observation; claims/evidence reference only the anchor. |
| `collection_checkpoint` | Add `ckpt-`, `scope_id`, exact retention anchor, deletion order, and lineage coverage; the operational row expires as C2. |
| claim graph | Add scope-safe evidence/coverage-anchor addressing; rewrite all affected edges and remint claims under a new claim-material version when material changes. |
| `repository_identity` | Verify `analytical_key` against `provider_id` with the existing installation key, then reuse an exact unique `claim_scope.scope_alias` match or mint a new random scope; ambiguity/mismatch aborts. Exact provider ID and analytical alias both expire as C2. |
| `commit_observation`, `pull_request_fact`, `dated_event_observation` | Inherit the exact repository scope; register as descendants with class-appropriate retention anchors. |
| `import_run` | Existing rows lack safe time/scope ownership: delete them during migration. Future rows bind participating scopes and an import time. |
| `coverage_observation` | Existing aggregates lack safe scope membership/time: delete them during migration and report absence honestly. Future aggregates bind every member scope; revoking one deletes the whole aggregate. |
| V2 bridge tables | Keep the present C0 synthetic-only domain explicit. `activation_card` provenance remains refused. Any future real writer must add scope/deletion metadata first. |

Legacy repository binding is never inferred from similarity. The migrator recomputes the expected
installation alias from the exact provider ID using the existing key, requires byte equality, then
uses the exact alias match above. A store without a matching claim scope receives a new random
scope and a C2 alias link timestamped at the proven legacy anchor; a conflicting match aborts. This
mapping exists only inside the copy transaction. Migration time is **not** a retention anchor. The
legacy identity anchor is the latest valid canonical source timestamp among its commit, PR, and
dated-event descendants. If none exists, or the anchor has already expired, the identity and its
descendants are not copied and a typed absence is reported; an unverifiable/invalid timestamp
aborts rather than resetting the lifetime. At C2 expiry both `provider_id` and `analytical_key` are
deleted with their repository-bound operational descendants; the retained C1 scope survives.

The rewrite graph is closed: incremental rows, evidence anchors, claim edges, transitive claim
dependencies, supersession, limitations, safe lineage, and claim stability keys are all checked.
Mixed material versions, cycles, dangling references, cross-scope edges, or an unregistered managed
table abort selection of the target.

## 3. Exact C2 lifetime and continuity

For a canonical UTC timestamp `T`, expiry is `addUtcMonthsClamped(T, 13)`:

1. add 13 to the UTC year/month;
2. retain UTC time and day when valid, otherwise clamp the day to the target month's final day;
3. compare inclusively: eligible exactly when `asOf >= expiresAt`;
4. reject local time, DST, locale arithmetic, approximate day counts, and SQLite month arithmetic.

Required boundary examples include `2025-01-31T12:00:00.000Z` becoming
`2026-02-28T12:00:00.000Z`, leap-day behavior, one millisecond before expiry, exact expiry,
idempotent replay, and two-writer contention.

The alias-link sweep atomically clears both `claim_scope.scope_alias` and its exact `linked_at`
(nullable in storage v3), writes a C1 `scope_alias_expired` event against the retained scope, and
preserves the C1 claim series. The incremental sweep deletes each expired C2 operational row—alias,
caller IDs, exact ranges/timestamps, cursor/watermark material, and provenance—while leaving only
its C1 anchor and a typed retention event when a retained claim still references that anchor.
Evidence and claims never FK-reference the deleted C2 row, so the sweep neither aborts nor silently
deletes the 36-month series. Revocation, by contrast, enumerates and tombstones the anchor and its
registered descendants.

A renewed alias link requires the existing installation-key continuity seam plus a durable reviewed
report/card binding, new consent/lifecycle epoch, and compare-and-swap revision before any caller
exists; an alias or visible `scope_id` alone is not authority. Exact replay is idempotent, and a
stale or different operation fails. If continuity is intentionally abandoned, a new scope receives
a `scope_series_restarted` event without an old-scope ID or expired-alias link; this is the explicit
series-fragmentation disposition.

## 4. Lineage, resolver, and app-owned artifacts

Storage v3 uses a versioned closed lineage schema with separate `subject_kind`, canonical
`subject_id`, closed `event_kind`, stable `operation_id`, closed `capability_id`, and ISO-week event
grain. A deletion request mints one random `del-` operation ID and binds it to the reviewed request;
exact replay reuses it, while a different operation for an already-tombstoned subject conflicts.
The capability stays the controlled literal `github.core`, never inferred from the operation ID.
A deletion transaction first enumerates every registered subject, writes its C1 tombstone under
that stable operation, deletes dependents before parents, verifies integrity/FKs, and commits once.
Old alias-bearing subjects/causes are rewritten only when the in-memory migration map proves their
class; otherwise they are removed and counted in content-free migration proof. The slice-A
compatibility record is never dropped: a valid
`scope_tombstone_` plus 64-hex subject with `cap_github_core` cause becomes a typed
`legacy_deletion_operation` subject `del-` plus the same hex, preserving event time and capability
without inventing a scope binding; its exact old time is floored to ISO week. Migration replay
produces the identical row; a conflicting legacy event aborts. No alias canary may remain.

The resolver addresses coverage/job absence through canonical C1 keys. It distinguishes an
intentional tombstone from unexplained damage and never emits the retired coverage ID, caller job
ID, exact range, scope alias, or migration map.

An app-owned artifact catalogue records only canonical `art-` identity, controlled kind/state,
content/manifest hash, confined relative locator, and all owning `scope-` IDs. It never stores an
arbitrary absolute path. Deletion targets only an exact registered artifact beneath a separately
reviewed controlled root, refuses symlinks/reparse points or hash/kind mismatch, persists crash-
resumable deletion state, and does not report success while a registered artifact remains. It does
not scan directories or attempt to recall a user-directed export.

The app-controlled SQLite database is itself an owned artifact boundary. B3 must checkpoint and
truncate its exact WAL, rebuild/compact the logical database under an idempotent post-delete state,
and handle only the exact configured database sibling `-wal`/`-shm` plus registered migration temp
targets. It cannot report lifecycle completion while that state is pending. Failures resume the
checkpoint/rebuild; they do not restore revoked rows. No directory scan, unrelated sibling delete,
or physical-media/SSD-erasure claim is permitted.

## 5. Reviewable execution sequence

Each item is a separate exact-base PR with focused tests, `npm run check`, fresh adversarial review
proportional to its lifecycle/privacy risk, hosted gate, aging floor, merge, and state refresh.

1. **B1a — inert identity and migration contract.** Add isolated, proposal-only typed C1 key,
   lineage-v3, storage-v3, claim-material-v3, and exhaustive present-table disposition contracts
   in `server/storage/v3Proposal.ts`, proved only by `server/storage/v3Proposal.test.ts` and explicit
   existing-v2 regression tests. Do **not** append them to the live `CLAIM_ID_MATERIAL_VERSIONS`,
   `LINEAGE_EVENT_KINDS`, installer DDL, writers, resolver, or capability registry. Existing v2
   behavior and accepted schemas remain unchanged. The proof snapshots live version/kind arrays and
   installer SQL, and rejects any production-module import of `v3Proposal`; a test-only import is the
   only allowed edge. B1b owns the atomic switch from proposal to live versioned storage. This is
   the exact next slice.
2. **B1b — copy migration and graph rewrite.** Implement the shadow target, every present-table
   disposition, transient old/new mapping, atomic graph/claim remint, rollback, rerun, and target-
   selection proof using invented stores only. No real-store invocation, source selection change,
   migration backup, grace cleanup, or production caller; those remain blocked until LIFE-03.
   Production migration mints fresh random, non-derived C1 keys. Replayed steps within the same
   target attempt reuse identities already inserted in that target; a failed target is discarded,
   so a fresh attempt may mint different surrogates. Synthetic replay proof therefore injects
   deterministic entropy where exact fixtures need it and compares normalized graph/checksum
   output with random surrogate keys alpha-renamed. It never derives or persists a stable seed from
   C2 source material.
3. **B2 — enforcement, retention, continuity, and resolver.** Add INSERT+UPDATE scope constraints,
   C1-anchor/C2-observation split, exact sweep, authenticated link renewal, and canonical coverage/
   job absence resolution. Version and migrate the resolver/API/PresentationView/Evidence Drawer so
   no consumer retains or renders retired coverage IDs, caller job IDs, exact ranges/timestamps, or
   `linked_at`. Prove storage, API, UI, privacy, boundary, replay, and concurrency fixtures.
4. **B3 — complete SQL deletion and lineage v3.** Extend the planner from slice A to every present
   private SQL descendant, including checkpoints and migrated legacy rows, with per-subject C1
   tombstones, slice-A compatibility remint, rollback injection after every SQL step, and the exact
   WAL/SHM checkpoint/rebuild completion saga.
5. **B4 — app-owned artifact ownership/deletion.** Add the confined catalogue and deletion saga;
   classify the existing arbitrary-output pack as user-directed; prove multi-scope whole-artifact
   deletion, path confinement, immutable `COMPLETE`, crash recovery, and future-domain registration.

Only B4's merged state refresh may mark DL-LIFE-02 DONE or close the covered #80 conditions. It
unblocks LIFE-03; it does **not** by itself schedule a retained C2/C3 connector. The first real
migration/connector additionally requires LIFE-03's timestamped backup, seven-day grace/fallback,
restore/tombstone-replay proof, and resolution of #86's V2 alias-bearing coverage surface. No new
owner decision blocks B1a-B4 inside the approved charter; q-6 is non-blocking and q-7/q-8 are
unrelated admin/hygiene actions.

## 6. Stop conditions

Stop and keep LIFE-02 incomplete if any present table lacks a concrete disposition; checkpoint
ownership/retention is absent; retained claim/evidence/lineage still contains old coverage/job/
range identity; claim material changes without reminting; UPDATE bypasses scope enforcement; an
alias can extend retention without new authenticated consent/card state; arbitrary legacy lineage
survives; expired `linked_at` or repository aliases remain; a C2 observation is still FK-required by
a retained claim; resolver/API/UI still exposes retired exact fields; an app-owned pack can become
complete before scope registration; SQLite sidecar/rebuild completion is absent; filesystem
deletion needs a scan or unconstrained path; backup restore enters this card; #86 is treated as
resolved by C0-only V2; or any proof would require protected/private/generated data.
