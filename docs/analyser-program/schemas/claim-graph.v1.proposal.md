# Claim graph v1 — table proposal (DL-SPINE-01/02)

Status: proposal only. STRICT SQLite tables, FK-bound, additive to the P2 store.
Revised 2026-08-04 (reconciliation): typed edge targets with real FKs; C2 scope reference split
out of the C1 claim row; pack projection re-mints pack-local claim IDs.

```sql
-- proposal, non-executable illustration
CREATE TABLE claim (
  claim_id TEXT PRIMARY KEY,            -- 'cl_' + sha256(canonical inputs)
  layer TEXT NOT NULL CHECK (layer IN ('deterministic','modelled','hypothesis','abstention')),
  statement_code TEXT NOT NULL,          -- closed enum, registry-validated
  method_id TEXT NOT NULL,
  method_version TEXT NOT NULL,
  window_start TEXT NOT NULL, window_end TEXT NOT NULL,   -- half-open UTC
  scope_id TEXT NOT NULL REFERENCES claim_scope(scope_id), -- opaque content-free surrogate
  schema_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  superseded_by TEXT REFERENCES claim(claim_id)
) STRICT;
-- C2 partition: the installation-scoped alias VALUE lives beside, not inside, the C1 claim row
-- (charter alias-link classification: C2, 13-month local-only; pack projection emits a fresh
-- pack-scoped C1 alias and never copies this value). The scope_id surrogate carries no alias
-- content, so the C1 claim row can group per-scope series without holding C2 data; clearing
-- scope_alias on its retention clock leaves series grouping intact.
CREATE TABLE claim_scope (
  scope_id TEXT PRIMARY KEY,            -- opaque surrogate, content-free
  scope_alias TEXT                      -- C2 value; cleared on its own retention clock
) STRICT;
-- stability key (accepted 2026-08-04): groupable per-scope claim series — series must never
-- merge across repository scopes, hence scope_id in the index
CREATE INDEX claim_stability_key
  ON claim (statement_code, method_id, method_version, window_start, window_end,
            scope_id, schema_version);

CREATE TABLE claim_evidence_edge (
  claim_id TEXT NOT NULL REFERENCES claim(claim_id),
  -- typed targets: exactly one non-null, all real FKs (unconstrained polymorphic text is
  -- prohibited — SQLite must reject dangling targets)
  target_evidence_id TEXT REFERENCES evidence(evidence_id),
  target_claim_id TEXT REFERENCES claim(claim_id),        -- derives_from
  target_coverage_id TEXT REFERENCES coverage(coverage_id),
  role TEXT NOT NULL CHECK (role IN
    ('supports','contradicts','contextualizes','derives_from','coverage_basis','limitation_basis')),
  CHECK ((target_evidence_id IS NOT NULL) + (target_claim_id IS NOT NULL)
       + (target_coverage_id IS NOT NULL) = 1),
  -- role→target compatibility (corrected 2026-08-04 review round): an FK-valid edge with a
  -- semantically wrong target kind must not exist — derives_from targets claims, coverage_basis
  -- targets coverage, evidentiary roles target evidence
  CHECK (
    (role = 'derives_from'   AND target_claim_id    IS NOT NULL) OR
    (role = 'coverage_basis' AND target_coverage_id IS NOT NULL) OR
    (role IN ('supports','contradicts','contextualizes','limitation_basis')
                             AND target_evidence_id IS NOT NULL)
  )
) STRICT;

CREATE TABLE limitation_instance (
  claim_id TEXT NOT NULL REFERENCES claim(claim_id),
  limitation_code TEXT NOT NULL,        -- existing dictionary
  dimension TEXT NOT NULL,              -- coverage-vector dimension that triggered it
  copy_key TEXT NOT NULL
) STRICT;

CREATE TABLE lineage_event (
  subject_id TEXT NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN
    ('correction','tombstone_cascade','export_included','reconsent','index_built','index_deleted')),
  caused_by TEXT,
  occurred_at TEXT NOT NULL
) STRICT;
```

Example claim row (invented):

```json
{
  "claim_id": "cl_9f2ab8…",
  "layer": "hypothesis",
  "statement_code": "CI_SHIFT_MAY_ALIGN_WITH_WORKFLOW_CHANGE",
  "method_id": "hyp.composer", "method_version": "1.0.0",
  "window_start": "2026-01-05T00:00:00Z", "window_end": "2026-04-06T00:00:00Z",
  "scope_id": "sc_01", "schema_version": "1.0.0",
  "scope_note": "C2 alias value ('repo_a7') lives only in claim_scope, joined on demand",
  "edges": [
    {"target_evidence_id": "ev_det_4", "role": "supports"},
    {"target_evidence_id": "ev_det_5", "role": "contradicts"},
    {"target_coverage_id": "cov_112", "role": "coverage_basis"}
  ],
  "limitations": [
    {"limitation_code": "GH_ACTIONS_FILTERED_1000_CAP", "dimension": "censoring_freedom", "copy_key": "hyp.ci_shift.censored"}
  ]
}
```

Pack projection rule (2026-08-04): pack-local claim IDs are **re-minted** from pack-scoped
evidence/scope identifiers, and every edge, lineage, and `superseded_by` reference is rewritten
transactionally during projection — a canonical `claim_id` never appears in two packs.
