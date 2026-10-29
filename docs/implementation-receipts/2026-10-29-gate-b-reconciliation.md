# Gate B documentation reconciliation — 2026-10-29

This completes the two documentation follow-ups in #317. G-ML-1 records the existing ADR-19 scope decision and no longer appears inside the additional owner-gate heading or G-ML-2 through G-ML-7 register range. The remaining gate rows and their dispositions are unchanged.

The curated-public dataset card now requires a reviewed capability identifier and provenance review alongside its source and curation-review reference. The owner's own consented data and curated-public scope, candidate-specific evidence bundle, consent revision where applicable, untouched holdout, release review, and retention/deletion obligations are preserved. No dataset, reader, model or capability is activated by the document.

The coordinator reviewed the one-document diff against the issue's two concrete defects. git diff --check passed. Local context verification stopped at the missing toolchain preflight; no successful context-validator run is claimed. Final independent review and exact-head hosted checks are recorded in the PR. No code, generated planning artifact, persistent schema or shared producer contract changes.
