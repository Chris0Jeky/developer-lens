# Claim graph v1 — table proposal (DL-SPINE-01/02)

Status: proposal only. STRICT SQLite tables, FK-bound, additive to the P2 store.

```sql
-- proposal, non-executable illustration
CREATE TABLE claim (
  claim_id TEXT PRIMARY KEY,            -- 'cl_' + sha256(canonical inputs)
  layer TEXT NOT NULL CHECK (layer IN ('deterministic','modelled','hypothesis','abstention')),
  statement_code TEXT NOT NULL,          -- closed enum, registry-validated
  method_id TEXT NOT NULL,
  method_version TEXT NOT NULL,
  window_start TEXT NOT NULL, window_end TEXT NOT NULL,   -- half-open UTC
  scope_alias TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  superseded_by TEXT REFERENCES claim(claim_id)
) STRICT;
-- stability key (accepted 2026-08-04): groupable claim series
CREATE INDEX claim_stability_key
  ON claim (statement_code, method_id, method_version, window_start, window_end,
            scope_alias, schema_version);

CREATE TABLE claim_evidence_edge (
  claim_id TEXT NOT NULL REFERENCES claim(claim_id),
  target_id TEXT NOT NULL,              -- evidence_id or claim_id (derives_from)
  role TEXT NOT NULL CHECK (role IN
    ('supports','contradicts','contextualizes','derives_from','coverage_basis','limitation_basis'))
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
  "scope_alias": "repo_a7", "schema_version": "1.0.0",
  "edges": [
    {"target_id": "ev_det_4", "role": "supports"},
    {"target_id": "ev_det_5", "role": "contradicts"},
    {"target_id": "cov_112", "role": "coverage_basis"}
  ],
  "limitations": [
    {"limitation_code": "GH_ACTIONS_FILTERED_1000_CAP", "dimension": "censoring", "copy_key": "hyp.ci_shift.censored"}
  ]
}
```
