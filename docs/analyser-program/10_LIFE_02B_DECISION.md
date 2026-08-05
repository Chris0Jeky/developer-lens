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
   a closed registry (`job-`, `snap-`, `ckpt-`, `cov-`, `ev-`, `art-`, neutral-operation `op-`, and
   deletion-operation `del-`, each followed by 64 lowercase hex). New opaque keys are minted from
   fresh random entropy only; claims remain versioned-material IDs. No retained key is an HMAC or
   other function of an alias, provider ID, timestamp, path, or old ID. The existing installation-
   key seam authenticates C2 alias continuity and migration inputs but never produces a retained
   C1 key.
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
Deriving one stored HMAC alias from the other, or accepting the pair without exact ephemeral raw-ID
verification, is also forbidden.

## 2. Storage-v3 binding and present-table disposition

Storage v3 separates retained C1 anchors from C2 operational observations. Every scope-owned row
carries or resolves to the canonical `scope_id`; evidence and claims reference C1 anchors only.
Deleting an expired C2 observation therefore cannot strand a retained claim or require retaining
its exact range/job/timestamp fields. SQLite INSERT and UPDATE enforcement must reject cross-scope
parents, evidence anchors, coverage edges, supersession/derivation links, and artifact ownership.
Scope and canonical parent keys are immutable after insertion.

In the disposition contract, `preserve` means a C0/C1 field that may remain after class-appropriate
retention. An OID/SHA, provider/repository alias, caller ID, exact range, exact source timestamp, or
other C2 operational value may be copied only into the separately expiring C2 observation side of
a `rewrite`; it is never a preserved C1-anchor field. A whole C2 observation disappears at its
exact 13-month boundary even when its content-free C1 anchor remains.
In the normalized shadow schema that side may be a paired nullable field group on the same physical
row as its C1 anchor; "disappears" means every field in that C2 group, including its expiry marker,
becomes NULL atomically. It does not authorize deletion of the physical row or its declared C1
aggregate/classification fields. A physical row is deleted only when its disposition preserves no
C1 anchor.

| Present domain | Required storage-v3 disposition |
|---|---|
| `collection_job` | Split a C1 `job-` anchor from the C2 operational row; add `scope_id`; caller ID and exact times expire with the C2 row. |
| `source_snapshot` | Split a C1 `snap-` anchor from C2 observation/provenance; bind both to canonical scope/job. |
| `coverage_ledger` | Split a C1 `cov-` anchor from the C2 exact-range/job observation; claims/evidence reference only the anchor. |
| `collection_checkpoint` | Add `ckpt-`, `scope_id`, exact retention anchor, deletion order, and lineage coverage; the operational row expires as C2. |
| claim graph | Add scope-safe evidence/coverage-anchor addressing; rewrite all affected edges and remint claims under a new claim-material version when material changes. |
| `repository_identity` | Require the ephemeral raw provider ID for every unexpired identity. Independently recompute `provider_id` with the repository-provider domain and `analytical_key` with the repository-analytical domain using the existing installation key, require byte equality for both, then reuse an exact unique `claim_scope.scope_alias` match against the recomputed `provider_id` (never `analytical_key`) or mint a new random scope; absent input, ambiguity, or mismatch aborts. The raw ID stays process-only; the verified aliases remain C2 and never enter the target proof. |
| `commit_observation`, `pull_request_fact`, `dated_event_observation` | Inherit the exact repository scope; register as descendants with class-appropriate retention anchors. |
| `import_run` | Existing rows lack safe time/scope ownership: delete them during migration. Future rows bind participating scopes and an import time. |
| `coverage_observation` | Existing aggregates lack safe scope membership/time: delete them during migration and report absence honestly. Future aggregates bind every member scope; revoking one deletes the whole aggregate. |
| V2 bridge tables | Keep the present C0 synthetic-only domain explicit. `activation_card` provenance remains refused. Any future real writer must add scope/deletion metadata first. |

Legacy repository binding is never inferred from similarity. The stored `provider_id` and
`analytical_key` are independent domain-separated HMACs over a raw provider ID; one alias cannot be
recomputed from the other. For every identity with an unexpired valid descendant anchor, B1b
therefore requires an in-memory binding input containing the exact raw provider ID. With the
existing installation key it independently recomputes the repository-provider alias and the
repository-analytical alias, requires byte equality with both stored values, then uses an exact
`claim_scope.scope_alias` match against the recomputed provider/repository-domain alias only —
never `analytical_key`. Missing raw material fails with
`IDENTITY_BINDING_UNVERIFIABLE`; either mismatch fails with `IDENTITY_BINDING_MISMATCH`; a
non-unique exact scope match fails with `IDENTITY_BINDING_AMBIGUOUS`. No raw ID or installation key
is written to the target, proof, error, or log, and the verified alias pair never enters a proof,
error, or log. `provider_id` and `analytical_key` may exist only in the expiring C2 identity row;
`scope_alias` may exist only in its expiring C2 link. All three are absent at the exact 13-month
boundary. B1b tests inject invented bindings directly; it has
no filesystem/source reader. LIFE-03's first-real wrapper may supply the raw ID ephemerally from
the original migration source, inside its backup/grace boundary, but a v2 SQLite store alone is
insufficient authority. Binding inputs are an exact one-to-one set: duplicate raw/computed aliases,
or an extra input with no unexpired source identity, also fail as `IDENTITY_BINDING_AMBIGUOUS`.

After authentication, a store without a matching claim scope receives a new random scope and a C2
alias link timestamped at the proven legacy anchor; a conflicting match aborts. This mapping exists
only inside the copy transaction. Migration time is **not** a retention anchor. The legacy identity
anchor is the latest valid canonical source timestamp among its commit, PR, and dated-event
descendants. If none exists, or the anchor has already expired, the identity and its descendants
are not copied and a typed absence is reported without inventing a binding; an unverifiable/invalid
timestamp aborts rather than resetting the lifetime. At C2 expiry the raw input, `provider_id`, and
`analytical_key` are absent with their repository-bound operational descendants; the retained C1
scope survives.

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
The closed event is `c2_retention_expired`, restricted to retained `job`, `snapshot`, `checkpoint`,
and `coverage` anchors and a neutral `op-` operation. It is deliberately distinct from correction,
revocation, and deletion events; base observations and claim creation provenance have no separate
retained lineage subject and are cleared without inventing one.
Evidence and claims never FK-reference the deleted C2 row, so the sweep neither aborts nor silently
deletes the 36-month series. Revocation, by contrast, enumerates and tombstones the anchor and its
registered descendants.

A renewed alias link requires the existing installation-key continuity seam plus a durable reviewed
report/card binding, new consent/lifecycle epoch, and compare-and-swap revision before any caller
exists; an alias or visible `scope_id` alone is not authority. Exact replay is idempotent, and a
stale or different operation fails. If continuity is intentionally abandoned, a new scope receives
a `scope_series_restarted` event without an old-scope ID or expired-alias link; this is the explicit
series-fragmentation disposition.

### B2b-i structural continuity candidate (shipped)

B2b-i implements only a pure, caller-free structural candidate builder. It accepts a replay-valid
`CapabilityLifecycleSnapshot` plus a claimed reviewed report digest/time, positive continuity epoch,
nonnegative expected continuity revision, and a lowercase `op-` operation ID. Eligibility requires
exact `ACTIVE` `github.core`, matching non-null card/consent digests, non-null preview and exact-head
proof digests, no deletion receipt, and both deletion-intent fields null. The candidate and its
domain-separated C2 receipt digest are deterministic and deeply frozen; refusal codes are stable and contain
no receipt values. The result says only **replay-valid** and **structurally eligible** for the
**claimed review digest/time**. It never says authorized, authenticated, verified review, renewal
permitted, or retention extended. No raw provider ID or installation key is accepted or hashed, and no production module
imports this proposal.

The candidate records the existing capability-lifecycle epoch separately from the caller's proposed
continuity epoch; it neither equates nor advances them. A later writer must compare the continuity
epoch and revision with its own retained state. B2b-i performs no filesystem, clock, key, database,
network, lifecycle, retention, or capability mutation.

The success object omits the scope alias, card/preview/proof digests, claimed report digest/time,
and event transcript. Its sole derived receipt is still classified local C2 because it binds those
inputs; it is not a content-free proof or retained C1 key and may enter no log, API, export, model,
or public sink. The trusted loader/writer must retain or revalidate its own ephemeral inputs rather
than trying to recover identity or review metadata from this candidate.

### B2b-ii-a stable task-card snapshot prerequisite (shipped)

The next composition cannot honestly be called trusted yet. No independently anchored owner-reviewed
report digest or trusted clock exists, and the pre-B2b-ii task-card reader sampled content only once.
B2b-ii-a therefore hardens that prerequisite first: two exact bounded reads from one opened
descriptor must agree; BigInt file identity, one-link state, stable file metadata, and all confined
ancestor-directory identities are rechecked; owned buffers are zeroed; and decoding, hashing, and
duplicate-key-safe parsing happen only after stability. Same-size mutation, parent replacement, and
hard-link fixtures must fail with the existing content-free error.

This proves a stable observed snapshot, not owner review, hostile-writer atomicity, or continuity
authority. The loader still accepts a stable card that predates its read, and platform no-follow
flags are only defence in depth. It performs no database, key, clock, network, lifecycle, retention,
or capability mutation, and existing capability registry/API values remain `never_authorized`.
PR #116 head `d939e1b` passed hosted run `31003641095`, merged as `8e8b0bc`, and passed exact-merge
Pages/privacy run `31003872271` plus an empty late-comment sweep.

### B2b-ii-b strict C1 activation-result validator (shipped)

B2b-ii-b first isolates the exact versioned github.core runner-result projection. Its closed C1
shape contains only controlled capability/version, stability, coverage, limitation/retry, and
request-count facts. It accepts no local-C2 task/job/scope/card/report/key/digest/time/range/alias
field. `stable` means only equal bounded probe hashes and supplies no source-truth, review,
authentication, authorization, continuity, renewal, or retention claim.

The parser reconstructs exact own data properties, refuses inherited/accessor/symbol/extra input,
fails closed on hostile inspection traps, enforces only producer-reachable status/code/count/request
combinations, and deeply freezes a fixed-order result. It has no production caller or filesystem/
database/network/clock/key/lifecycle/capability dependency. PR #117 head `f910137` passed hosted run
`31005511635`, merged as `8aa19b3`, and passed exact-merge Pages/privacy run `31005770546` plus an
empty late-comment sweep.

### B2b-ii-c stable local-C2 activation report (shipped)

The strict `github-core-activation-report.v1` envelope embeds the B2b-ii-b object unchanged and adds
only caller-claimed C2 `taskId`, `jobId`, and logical `jobStartedAt`. It omits root capability/card/
report digests, scope, key, provider, range, review, authorization, continuity, operation, and prose
fields. A report-provided card digest would be forgeable provenance, not authority; the later anchor
must instead compare fresh card bytes and the external card digest against the persisted transition
consent revision and lifecycle state while jointly binding the external report digest.

One fixed-spec activation-artifact loader now serves both canonical `task-card.json` and
`last-run-report.json` paths without exposing a caller-selected filename or limit. The report path
keeps the card loader's 64 KiB bound, canonical ancestor and descriptor/path identity checks, one-
link rule, double exact read, mutation detection, fatal UTF-8, duplicate-key refusal, SHA binding,
and buffer zeroing. The github.core wrapper cross-checks the envelope task against the path and maps
all failures to one content-free code. The exact production chain is artifact loader → report loader
→ report parser → C1 result parser, with no caller above it and no writer or sink.

Stable matching report bytes still provide no report origin, owner review, trusted time, card/key
binding, authorization, continuity, renewal, retention, or completeness claim. Next add a separately
owner-reviewed anchor for report/card/key/lifecycle/time plus a trusted clock. A report self-hash or
caller-supplied expected hash is not that anchor. CAS revision is read transactionally and the
operation is writer-owned. Only then may a caller-free composer feed the compare-and-swap writer,
followed by restart handling and the migration-origin disposition for already-expired never-retained
C2 groups.

PR #118 head `c393bd1` passed hosted run `31008061712`, merged as `cb9161c`, and passed
exact-merge Pages/privacy run `31008333181` plus an empty late-comment sweep.

### B2b-ii-d continuity review anchor (shipped)

The pure `github-core-continuity-review-anchor.v1` parser accepts only one fixed local-C2 syntactic
record. It binds caller claims for the reviewed report, task card, installation-key fingerprint,
active lifecycle epoch, preview, exact-head proof, next continuity epoch, and canonical millisecond
UTC review time to one path-safe task ID. Its review decision literal remains a claim, not owner
authentication or evidence. All deletion intent, intent-digest, and receipt-digest fields must be
exactly null so an apparently active lifecycle with pending revocation cannot be represented as a
clean reviewed state.

The parser has no imports or production caller and performs no filesystem, clock, database, key,
lifecycle, writer, network, retention, authorization, or activation work. A later composer must
bind the anchor to one path-selected task and same-scope C1 row; freshly re-read report/card/key;
the persisted consent revision; and a replayed lifecycle snapshot with exact epoch, preview/proof,
and deletion-null equality. It must enforce
`report.jobStartedAt <= reviewedAt <= trustedNow` and
`reviewedContinuityEpoch === currentContinuityEpoch + 1` inside the writer's CAS transaction. The
composer must reject pending revocation even while lifecycle state remains `active`. This parser
intentionally performs none of those checks and activates nothing.

PR #119 head `02094d2` passed hosted run `31010122666`, merged as `8cabc53`, and passed
exact-merge Pages/privacy run `31010364274` plus an empty late-comment sweep.

### B2b-ii-e trusted process clock (shipped)

The clock boundary exposes separate zero-argument captures for canonical millisecond UTC wall time
and Node's finite nonnegative monotonic milliseconds. The wall reading is the only value that may
feed the later persisted `reviewedAt <= trustedNow` chronology check. The monotonic reading is only
for in-process elapsed budgets; it must never be persisted, treated as wall time, or compared across
process restarts. There is no caller-supplied or injectable time source and no combined record that
encourages the two clock domains to cross a sink together.

Invalid or throwing runtime sources map to one content-free error. The module has no production
caller and no anchor, artifact, lifecycle, database, writer, network, retention, or capability
dependency. Its source import is limited to Node's monotonic performance clock. This boundary does
not authenticate the review anchor or authorize continuity, renewal, retention, collection, or
activation. The later composer must capture wall time internally and continue to reject caller-
supplied substitutes.

PR #120 head `5a08fcf` passed hosted run `31011375033`, merged as `cdaa083`, and passed
exact-merge Pages/privacy run `31011609025` plus an empty late-comment sweep.

### B2b-ii-f stable continuity-anchor loading (shipped)

The review anchor lives only at the fixed ignored task path
`continuity-review-anchor.json` under `.developer-lens/activation/<taskId>/`. Its loader reuses the
card/report seam's closed 64 KiB input, canonical path and stable descriptor identities, one-link
rule, double exact read, mutation checks, fatal UTF-8, duplicate-key rejection, digest binding, and
buffer zeroing. The github.core wrapper parses the closed anchor, rejects a path/anchor task
mismatch, returns the observed stable digest with the frozen parsed anchor, and exposes no filename
or limit selector.

Observed bytes matching an external digest remain only byte integrity; neither value authenticates
owner identity, review, approval, origin, trusted time, or any report/card/key/lifecycle/CAS claim.
The existing task-card `localBoundary` shape does not yet name this artifact, so the first reviewed
composition/caller contract must explicitly add or otherwise close that path invariant before use.
The loader has no caller, writer, database, clock, network, lifecycle mutation, retention action,
sink, or capability effect. Next composition may produce only a structural consistency proposal;
owner authentication, same-scope C1 state, lifecycle freshness under race, next-epoch CAS, and the
writer-owned operation remain mandatory before renewal or retention can be claimed.

PR #121 head `cad4d73` passed hosted run `31013045188`, merged as `1706df1`, and passed
exact-merge Pages/privacy run `31013362189` plus an empty late-comment sweep.

### B2b-ii-g task-card anchor-path contract (shipped)

Before the no-caller composer may load the B2b-ii-f artifact, the closed github.core task card must
declare it. Its strict `localBoundary` therefore adds only
`continuityReviewAnchor: "continuity-review-anchor.json"`. The parser rejects omission, alternate
or absolute names, traversal, and extras, while invented parser/loader/runner/transport fixtures
carry the literal. This closes a confused-deputy path where code could otherwise read an artifact
that the reviewed task boundary never named.

The change performs no filesystem read, protected-card migration, lifecycle replay, clock capture,
database operation, renewal, retention extension, or activation. The ignored selected task card
remains uninspected and must be updated only inside a later deliberately scoped real activation with
its own exact-path and proving boundary. After this contract lands, the next composer may load the
anchor first, use only its claimed card/report digests and key fingerprint as fixed loader inputs,
replay lifecycle, and capture wall time internally, but may return only structural consistency.

PR #122 head `16f4c7d` passed hosted run `31014606288`, merged as `c66d602`, and passed
exact-merge Pages/privacy run `31014845736` plus an empty late-comment sweep.

### B2b-ii-h structural continuity composition (shipped)

The no-caller composer accepts only one path/task-selected anchor digest and a lifecycle transcript.
It synchronously copies the transcript through recursive own-data inspection with explicit depth,
node, field, array-item, and string budgets before replay, so async artifact loading cannot observe a
later caller mutation and an unbounded history cannot drive unbounded replay. Those limits are depth
8, 8,192 object/array nodes, 32 own fields per object, 1,024 items per array, and 262,144 total
string code units; any excess gets the same refusal and a future runtime must revisit compaction
before increasing them. The first fixed artifact load is the anchor; its exact claimed card/report
digests and installation-key fingerprint are then the only
inputs to the existing hash/fingerprint-bound task-local loaders.

Structural consistency requires one task throughout; card/consent, active epoch, preview, proof, and
deletion-null equality; no pending revocation; and the report request ceiling matching the reviewed
card. It also closes a repository-scope confused-deputy path: the composer derives the exact
provider-domain repository alias used by the runner from the card's ephemeral provider repository
ID and task-owned key, then matches it to the replayed lifecycle scope. Chronology is strengthened
to require card authorization no later than job start, the card range start before job start, job
start no later than review, and review no later than the internally captured process wall time.

Every failure is one content-free error. Success is a frozen static structural-consistency object;
it contains no task/path/scope, card/report/key/lifecycle value, digest, epoch, time, operation, or
revision. A direct-import gate admits only the closed loaders, lifecycle replay, process wall clock,
and path validation, and rejects every production caller of the composer.

This slice deliberately cannot authenticate the anchor's owner or origin, make a claimed report
start trusted, bind a persisted same-scope C1 identity row, make four individually stable reads one
atomic snapshot, lock lifecycle freshness against concurrent revocation, compare a continuity epoch
or CAS revision, own an operation ID, write state, renew a link, or extend retention. `Date.now()` is
also mutable inside the process. Those are hard promotion stops: no writer, API, runtime, or caller
may treat this structural result as authority. Every executable capability remains
`never_authorized`.

The focused composition/proposal proof passes 2 files / 23 tests and the full local gate passes 75
files / 1,114 tests plus context verification, lint, typecheck, build, and diff checking. Fresh
implementation and privacy/authority reviews found no HIGH/CRITICAL product defect after every
filesystem-heavy adversarial scenario was isolated to remove a reproduced test-timeout blocker.

PR #123 head `c5256bb` passed hosted run `31017359944`, merged as `65dfd155`, and passed
exact-merge Pages/privacy run `31017611856` plus an empty late-comment sweep.

### B2b-ii-i isolated continuity CAS proposal (shipped)

The next bounded prerequisite is a separate, fixture-only SQLite CAS primitive rather than a
renewal writer. The structural anchor still has no owner-authenticated origin, and the application
has no transactionally bound same-scope C1 identity plus lifecycle-freshness state. An alias can be
cleared and later rebound, the four task-local files are only individually stable, and a stale
active transcript can race revocation. Treating B2b-ii-h as authority would therefore renew the
wrong series or extend retention after revocation. The CAS proposal proves only the mechanical
state transition while keeping those promotion stops explicit.

Its closed input is `scopeId`, nonnegative safe `expectedRevision`, `operationId`, and one opaque
lowercase `payloadSha256`. The digest is local C2 because it can bind a structural receipt; the
proposal grants it no production retention, sink, or expiry semantics. All tests use invented
values and disposable databases. The standalone schema has its own application/user identity,
exact object fingerprint, strict tables, monotonic revision state, and immutable operation history.
It installs only into an empty main and temporary schema, enables connection-local foreign keys and
recursive triggers, and validates integrity, quick check, foreign keys, schema identity, and exact
state/history continuity.

Every apply runs under `BEGIN IMMEDIATE` on one connection. Exact replay compares operation,
scope, expected/applied revisions, and digest; a reused operation with any mismatch is `conflict`
before stale-revision classification. A new operation performs a revision-guarded update, requires
exactly one changed row, inserts its immutable operation record, revalidates the history, and commits
once. Unknown scopes return `stale` and are never silently seeded. The maximum safe integer is
reserved rather than incremented into an unaddressable JavaScript revision. Failures after either
mutation stage roll back, lock contention and all SQLite failures collapse to one content-free
error, and success returns only frozen static `applied`, `replayed`, `stale`, or `conflict` status.

This is not the shadow store, a scope registry, continuity-epoch state, authenticated anchor
provenance, lifecycle lock, renewal, retention extension, lineage writer, API, runtime caller, or
capability activation. A production promotion must first authenticate the anchor origin, seed the
same retained C1 scope through that authority, bind current lifecycle/revocation and continuity
epoch in the same transaction, define the 13-month receipt expiry/sweep, and prove that an expired
alias cannot bind a new scope series. The import gate rejects every production import of this
proposal; every executable capability remains `never_authorized`.

The focused CAS/proposal proof passes 2 files / 21 tests. The composer regression proof now passes
16 tests after its fixture stopped redundantly exercising the durability-heavy key-creation seam;
preview and proof mismatches are independently covered. The full local gate passes 76 files / 1,128
tests plus context verification, lint, typecheck, build, and diff checking. Fresh SQL/concurrency,
correctness, and privacy/authority reviews found no HIGH/CRITICAL defect. The only remaining review
caveat is the deliberate promotion stop around the local-C2 digest lifetime described above.

PR #124 head `006728e` passed hosted run `31020379782`, merged as `34af993`, and passed
exact-merge Pages/privacy run `31020694799` plus an empty late-comment sweep.

### B2b-ii-j inert review-signature verification proposal (merged)

Cryptographic consistency is the next separable prerequisite, not owner authentication. The
process-only verifier accepts exact bounded anchor bytes, one caller-supplied candidate canonical
Ed25519 SPKI public key, and a closed versioned signature envelope. It recomputes the anchor and key
digests and verifies fixed signing material: the ASCII domain
`developer-lens:github-core-continuity-review-signature:v1`, one NUL byte, the binary anchor digest,
and the binary SPKI digest. Exact canonical base64, 44-byte Ed25519 SPKI DER, a 64-byte signature,
and S below the Ed25519 group order are required.

`signature_matches` proves only that the candidate key verifies the supplied bytes. It is not owner
identity, review provenance, approval, authorization, scope continuity, lifecycle freshness,
renewal, retention extension, or capability activation. The proposal has no signer, key generation,
trusted-key registry, enrollment, path, artifact loader, persistence, clock, lifecycle, CAS, API,
network, or production caller. Tests use ephemeral invented keys only, the production import gate
rejects the module, and every executable capability remains `never_authorized`.

The focused proposal/import proof passes 2 files / 17 tests. The full local gate passes 77 files /
1,137 tests plus context verification, lint, typecheck, build, and diff checking; only the two
existing Evidence Drawer Fast Refresh warnings and bundle-size advisory remain. Fresh
cryptographic/parser and privacy/authority reviews found no HIGH/CRITICAL defect. Promotion first
requires a separate process-owned, owner-controlled
trust-root and credential enrollment/rotation/revocation contract that selects the canonical key
and fixed-path parsed anchor; it then requires same-scope retained C1, current lifecycle/revocation,
continuity epoch, C2 receipt expiry/sweep, and CAS state under the same writer lock.

PR #125 head `96957f4` passed hosted run `31022622947`, merged as `2afaa609`, and passed
exact-merge Pages/privacy run `31022859341`. A Codex P2 arrived after merge: low-order or
noncanonical Ed25519 public-key and signature-`R` encodings can invalidate the private-key-possession
meaning of a successful verification. Issue #80 now carries the mandatory promotion condition.
Before a trust root admits a key, reject low-order/noncanonical public keys; before any production
signature integration, also reject low-order/noncanonical `R` and prove the identity-point key/`R`
with `S = 0` forgery fails closed. The current caller-free proposal remains inert and untrusted.

For that migration-origin disposition, “never-retained” describes a C2 payload already expired at
migration time, not an omitted C1 anchor. Emit the existing `c2_retention_expired` event at the
original expiry week only when the retained same-scope C1 anchor is reachable from a retained claim:
coverage is reached directly or through claim → evidence → coverage; its job and optional snapshot
follow that coverage; a checkpoint follows only when both its job and snapshot are reachable. A
claim remains retained for this test when its own `created_at` C2 provenance is NULL. Unreferenced,
unbound/omitted, and base-observation anchors emit no origin event. Ambiguous ownership, reachability,
or source expiry aborts instead of inferring lineage.

## 4. Lineage, resolver, and app-owned artifacts

Storage v3 uses a versioned closed lineage schema with separate `subject_kind`, canonical
`subject_id`, closed `event_kind`, stable `operation_id`, closed `capability_id`, and ISO-week event
grain. A deletion request mints one random `del-` operation ID and binds it to the reviewed request;
exact replay reuses it, while a different operation for an already-tombstoned subject conflicts.
Only `tombstone_cascade`, `index_deleted`, and `legacy_deletion_operation` use a `del-` deletion
operation ID. Every other closed event kind uses a neutral random `op-` operation ID; correction,
export, reconsent, index-built, alias-expiry, C2-retention-expiry, and series-restart events must
never invent a deletion operation. The
capability stays the controlled literal `github.core`, never inferred from the operation ID.
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

Each item, including each B1b sub-slice, is a separate exact-base PR with focused tests,
`npm run check`, fresh adversarial review proportional to its lifecycle/privacy risk, hosted gate,
aging floor, merge, and state refresh.

1. **B1a — inert identity and migration contract.** Add isolated, proposal-only typed C1 key,
   lineage-v3, storage-v3, claim-material-v3, and exhaustive present-table disposition contracts
   in `server/storage/v3Proposal.ts`, proved only by `server/storage/v3Proposal.test.ts` and explicit
   existing-v2 regression tests. Do **not** append them to the live `CLAIM_ID_MATERIAL_VERSIONS`,
   `LINEAGE_EVENT_KINDS`, installer DDL, writers, resolver, or capability registry. Existing v2
   behavior and accepted schemas remain unchanged. The proof snapshots live version/kind arrays and
   installer SQL, and rejects any production-module import of `v3Proposal`; a test-only import is the
   only allowed edge. This slice is merged and remains inert. Three late review findings require a
   smallest follow-up before B1b: classify exact C2 observation fields under rewrite/expiry rather
   than C1 preserve; add neutral `op-` identity for non-deletion lineage; and make unremintable,
   dangling, or cross-scope claim-graph states abort instead of silently deleting them. The
   follow-up stays in `v3Proposal.ts`/its focused test and remains caller-free. It is the exact next
   slice.
2. **B1b — copy migration and graph rewrite.** Implement the shadow target, every present-table
   disposition, transient old/new mapping, atomic graph/claim remint, rollback, rerun, and target-
   selection proof using invented stores only. No real-store invocation, source selection change,
   migration backup, grace cleanup, or production caller; those remain blocked until LIFE-03.
   Accept repository-binding material only as an explicit in-memory invented-fixture input under
   the fail-closed alias checks above; a v2 store without raw provider identity cannot self-authorize
   migration.
   Production migration mints fresh random, non-derived C1 keys. Replayed steps within the same
   target attempt reuse identities already inserted in that target; a failed target is discarded,
   so a fresh attempt may mint different surrogates. Synthetic replay proof therefore injects
   deterministic entropy where exact fixtures need it and compares normalized graph/checksum
   output with random surrogate keys alpha-renamed. It never derives or persists a stable seed from
   C2 source material.
   Deliver B1b in three dependency-true sub-PRs: **B1b-i** compiles/installs the isolated v3 shadow
   schema and proves all 18 dispositions plus source immutability; **B1b-ii** adds authenticated
   repository binding and the transient base/incremental/claim/lineage rewrite engine; **B1b-iii**
   adds per-stage rollback injection, post-close reopen/integrity/privacy proof, replay-normalized
   checksums, and the first selectable-target result. B1b-i/ii must return an explicit incomplete,
   non-selectable result. None changes the v2 reader, existing migration selector, production
   caller graph, backup/grace behavior, or capability state.
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
owner decision blocks B1a-B4 inside the approved charter; q-6 is non-blocking, q-7 is complete, and
q-8 is an unrelated hygiene action.

## 6. Stop conditions

Stop and keep LIFE-02 incomplete if any present table lacks a concrete disposition; checkpoint
ownership/retention is absent; retained claim/evidence/lineage still contains old coverage/job/
range identity; claim material changes without reminting; UPDATE bypasses scope enforcement; an
alias can extend retention without new authenticated consent/card state; arbitrary legacy lineage
survives; a SHA/OID/exact timestamp is classified as preserved C1; a lineage event outside the
exact `tombstone_cascade`/`index_deleted`/`legacy_deletion_operation` set carries a `del-` operation,
or one inside that set carries `op-`; an unremintable/dangling/cross-scope graph row is dropped rather than aborting;
expired `linked_at` or repository aliases remain; a C2 observation is still FK-required by a
retained claim; resolver/API/UI still exposes retired exact fields; an app-owned pack can become
complete before scope registration; SQLite sidecar/rebuild completion is absent; filesystem
deletion needs a scan or unconstrained path; backup restore enters this card; #86 is treated as
resolved by C0-only V2; a stored HMAC alias is treated as raw provider identity; an unexpired
repository migrates without exact ephemeral raw-ID verification of both aliases; or any proof would
require protected/private/generated data.
