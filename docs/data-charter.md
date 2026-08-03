# Developer Lens data charter

Version: **1.0.0**

Architecture: [`DEVELOPER_LENS_V2_ARCHITECTURE.md`](./DEVELOPER_LENS_V2_ARCHITECTURE.md)

Authority: G1 approved 2026-08-03; G2, every G3 capability, and G4 remain unapproved.

## Product boundary

Developer Lens is a local-first system-retrospective product. Its analytical subjects are
repositories, workflows, queues, releases, dependencies, and opaque modules—not people.
Deterministic local processing is the complete baseline product.

The product must never produce productivity, performance, effort, attendance, hours-worked,
availability, diligence, quality, worth, personality, sentiment, named bus-factor,
collaborator-surveillance, or individual-output metrics. Contributor and reviewer identity is not
an analysis target. Verified owner email may be compared ephemerally and emits only `is_self`.

Private repository metadata remains private even when the same repository is public on GitHub.
Repository names live only in an isolated local identity boundary; analytical and exported records
use installation- or pack-scoped aliases. Missing, refused, restricted, truncated, stale, failed,
deleted, or censored evidence is never converted to zero activity.

## Field classes

| Class | Meaning | Examples | Allowed lifetime and boundary |
|---|---|---|---|
| C0 | Invented synthetic public data | Allowlisted demo identities and repositories | May be tracked and published through the synthetic-only schema |
| C1 | Low-identifiability aggregates | Counts, distributions, coverage states, controlled enums | Proposed 36 rolling months; exportable only after suppression and schema validation |
| C2 | Local identifiers and provenance | Provider IDs, OIDs, exact source timestamps, local alias links | Proposed 13 months; local-only or remapped to pack-scoped aliases |
| C3 | High-sensitivity isolated metadata | Workflow, dependency, security, project, team, or module aliases | Proposed 90 days; isolated and excluded from ordinary exports |
| C4 | Ephemeral source-derived bytes | Subjects, paths, manifests, workflow YAML, CODEOWNERS, source AST | Process/worker lifetime only; never persisted, logged, or exported |
| X | Prohibited | Tokens, secrets, code, diffs, bodies, comments, logs, artifact/cache contents, binaries | Rejected before every sink |

The C1/C2/C3 periods are recommendations, not active policy. They require G2 before retention or
migration behavior is implemented. Pseudonymous identifiers are not anonymous.

## Sink contract

Every sink accepts a purpose-built strict schema. Unknown fields, field classes, capabilities,
coverage states, schema versions, and export classifications fail closed.

| Sink | Allowed contract | Required denial |
|---|---|---|
| Persistence | Typed C1/C2 tables and separately authorized C3 tables | C0 unless explicitly synthetic; all C4/X; provider response blobs; unclassified fields |
| Logs/errors | Stable codes and bounded numeric metadata | Names, paths, arguments, bodies, exception causes, source strings, all C2/C3/C4/X values |
| Local API | Resource-specific presentation schemas; C0/C1 and explicitly permitted local C2 | Generic records/files, C3 without endpoint consent, C4/X, unknown fields |
| Frontend | `PresentationView` only | Canonical/source records and any private field not required by the view |
| Export | Pre-redacted `ExportView`, pack-scoped IDs, manifest allowlist | Identity vault, raw IDs/OIDs, private paths, operational cursors, C4/X |
| Model | Controlled evidence codes, values, and existing evidence IDs | Source prose, names, titles, labels, paths, bodies, comments, dependencies, security details, tools |
| Public Pages | C0 constructors and the public-only schema | Every private schema/capability/table and all non-synthetic identifiers |

No runtime may serialize an upstream object wholesale. Classification is attached to registered
fields, not supplied by an untrusted caller. A field absent from the registry is prohibited.

## Consent, refusal, and deletion

Capabilities are individually registered with purpose, retained minimum, class ceiling, consent
gate, proposed retention, deletion cascade, and refusal behavior. The authoritative inventory is
[`source-capability-matrix.md`](./source-capability-matrix.md).

Refusal prevents discovery and collection for that capability. Revocation stops collection and
deletes source observations, dependent facts/features, graph projections, caches, model outputs,
and application-controlled packs/backups, leaving only a content-free tombstone. Developer Lens
must disclose that it cannot recall user-copied exports, provider-held copies, filesystem snapshots,
or guarantee physical-media erasure.

## Fixture and verification rule

All fixtures are invented. Privacy tests use unique adversarial canaries for credentials, paths,
identities, repository metadata, titles, labels, bodies, review text, subjects, CI names,
dependencies, source, and security details. They are rejected inputs and must not survive into any
persistent, log, API, frontend, export, model, screenshot, bundle, or Pages golden output.

Tests and implementation work must not inspect `.developer-lens/`, `public/data`, `dist`, caches,
browser profiles, credentials, real account activity, untracked private inputs, or generated
operational datasets without the exact later authorization described by G2/G3 and a named migration
task card.

## Change control

A change to classes, sinks, capability purpose, retention, deletion, schema compatibility, or the
private/synthetic boundary requires a separate reviewed architecture decision before dependent
implementation. The decision records alternatives, privacy effect, migration effect, and rollback.
