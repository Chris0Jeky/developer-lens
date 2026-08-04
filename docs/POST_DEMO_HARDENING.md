# Post-demo hardening backlog

Owner decision: **2026-08-03**. G4 provider-boundary update: **2026-08-04**.

Developer Lens is developed as a local pet-project demo first. Until the D3 working-demo milestone
in [`DEVELOPER_LENS_V2_ARCHITECTURE.md`](./DEVELOPER_LENS_V2_ARCHITECTURE.md), this file is the only
work product expected for security, privacy hardening, operational resilience, or distribution
readiness.

## Rule during D1-D3

- Record a newly discovered concern here with a short direct failure path and the likely proving
  test. Do not interrupt the demo slice to implement it.
- Do not add speculative authentication, encryption, migration, deployment, policy, scanner,
  sandbox, or compliance infrastructure.
- The exception is the irreversible floor: no secrets or private/generated data in tracked/public
  outputs, no destroyed user work, no external/production mutation, and no public publication of
  the sensitive-data branch without the named owner decision.
- Invented C0 fixtures are the default. G2 and all seven named G3 sources are approved for later
  bounded activation. G4 is approved only for the OpenAI/Luna contract in the data charter;
  external-model transmission stays inactive until its own bounded task and gate pass.

## Seed backlog

These items are intentionally **not demo blockers**.

| ID | Deferred work | Revisit after D3 with |
|---|---|---|
| HARD-001 | Retention, migration, backup, revocation, descendant deletion, and physical-erasure disclosures for real/private data | Approved G2 protocol, synthetic migration fixture, rollback and failure-injection plan |
| HARD-002 | Repository-name isolation, PR-title removal, identity minimization, pack-scoped aliases, and sparse suppression | Field-by-field migration map and re-identification review |
| HARD-003 | Loopback API bearer secret, exact Host/Origin rules, CORS/CSRF denial, pagination bounds, and stable redacted errors | Local attack test matrix and browser compatibility proof |
| HARD-004 | Log/error scrubbing and taint coverage for raw, escaped, encoded, and nested prohibited values | Sink-specific fuzz/canary suite |
| HARD-005 | SQLite transactionality, locking, integrity checks, WAL policy, atomic migrations, backups, and disk-full recovery | Storage design review and destructive-failure fixtures |
| HARD-006 | Export/public-build isolation, private-type import denylist, checksums, COMPLETE marker, acknowledgement invalidation, and bundle/source-map scans | End-to-end export and Pages regression suite |
| HARD-007 | Connector permissions, pagination, rate/cost budgets, retries, checkpoint overlap, idempotency, truncation, and deletion coverage | Per-capability task card and provider-limit fixtures |
| HARD-008 | Local Git and parser process isolation, no-network/no-exec controls, lazy-fetch prevention, resource caps, and malicious config handling | Invented repository corpus and worker sandbox proof |
| HARD-009 | External-model provider terms, payload preview, retention/training claims, spend limit, injection resistance, and deterministic fallback | OpenAI/Luna contract approved; prove the default-off payload/output/transport/budget/deletion seam with invented fixtures before activation |
| HARD-010 | Dependency pinning, supply-chain review, CI hardening, artifact provenance, and release/distribution controls | Distribution plan and release gate |
| HARD-011 | Restricted storage and deletion semantics for security/dependency/Projects/ownership/source-structure capabilities | Standing G3 authorization plus a bounded schema/storage task for each capability |
| HARD-012 | Full threat model, abuse cases, property/fuzz tests, and runtime privacy verification across every sink | Demo-frozen interfaces and risk-based test plan |

## Completion rule

After D3, re-triage this list against the actual demo. Delete irrelevant items, combine duplicates,
and implement only what is required for the next declared use: local real data, private sharing,
external model use, or distribution. Do not treat this seed list as a promise to build every item.
