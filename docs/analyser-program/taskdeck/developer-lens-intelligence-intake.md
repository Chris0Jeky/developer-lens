# Developer Lens intelligence-platform intake

Compact planning intake for Taskdeck markdown import (`POST /api/import/notes/markdown`). Each
heading below becomes one Inbox capture for later triage; the authoritative card set is the
starter-pack manifest beside this file. All content is planning prose — no private data, no
credentials, no real analytical output.

# Initiative: make the V2 spine user-visible

The first bounded slice (DL-BRIDGE-01) mounts read-only /api/v2 coverage+capabilities endpoints
over a synthetic-importer store and renders a Coverage Cockpit panel. Until this lands, every V2
subsystem has zero production callers and the platform is disconnected architecture. Entry point:
docs/analyser-program/09_IMPLEMENTATION_LAUNCHER.md.

# Initiative: evidence claim graph

Typed claim/limitation/lineage tables with deterministic content-derived claim IDs make every
rendered statement resolvable to supports, contradicts, coverage, and corrections
("why am I seeing this?"). Cards DL-SPINE-01..05.

# Initiative: capability lifecycle and deletion completeness

One state machine for every capability (never_authorized → card_bound → previewed → active →
revoked) with a tested invariant that gate approvals never activate anything, and deletion
enumeration generated from the schema registry. Cards DL-LIFE-01..03.

# Initiative: structure atlas on invented fixtures

Hardened explicit-ref Git topology, committed-tree X-ray, and an isolated parser worker feeding an
opaque module graph — cycles, coupling, API-surface movement — all provable on invented
repositories before any real selection. Cards DL-GIT-*, DL-XRAY-*, DL-ATLAS-*.

# Initiative: flow and feedback observatories

PR transition/rework, traceability (observed edges only), attempt-aware CI shape, releases,
deployments, dependency waves — system distributions with censoring surfaced, never person
metrics. Cards DL-FLOW-*, DL-TRACE-*, DL-OBSV-*, DL-CI-*, DL-DEP-01.

# Initiative: governed research workbench

Frozen invented benchmarks, model cards, preregistration, and a promotion ladder that no candidate
crosses on invented data alone. Rejection is a successful outcome. Cards DL-WB-*.

# Initiative: pack 2.0, retrieval, hypotheses, open questions

Multi-table analysis packs with an in-browser Query Lab, structured evidence retrieval with
mandatory counter-evidence quotas, a deterministic hypothesis composer, and open questions as a
first-class surface. Cards DL-PACK-*, DL-RAG-*, DL-HYP-*, DL-OPEN-*.

# Initiative: honest demos

Contract A: a fully specified (owner-gated, not run) future real local Taskdeck dogfood analysis.
Contract B: a public, entirely invented Taskdeck-shaped synthetic twin and a 5-8 minute showcase
script. Cards DL-DEMO-A1, DL-DEMO-B1, DL-DEMO-B2.
