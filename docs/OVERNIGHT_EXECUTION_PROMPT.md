# Overnight execution — redirect

<!-- prompt-source: redirect target: DL-P03-OVERNIGHT-CONTINUOUS -->

**This file is no longer an executable prompt.** The unattended multi-wave launcher now lives in the
prompt library behind a stable ID:

- **Canonical prompt:** `DL-P03-OVERNIGHT-CONTINUOUS` in
  [docs/agent-system/PROMPT_LIBRARY.md](agent-system/PROMPT_LIBRARY.md).
- **The loop it executes:** [docs/agent-system/CONTINUOUS_WORK_PROTOCOL.md](agent-system/CONTINUOUS_WORK_PROTOCOL.md)
  — waves, deterministic queue hopping, the anti-manufacture legitimacy test, work-while-waiting,
  parallelism bounds, and the explicit policy/budget/tooling/queue stop conditions.
- **Cross-repository parity:** [.agent-harness/prompt-parity.json](../.agent-harness/prompt-parity.json).

Why the move: a copy-ready prompt kept in its own document drifts from the policy it restates. The
library holds one body per stable ID, every active body carries the shared `runtime-bootstrap-v1`
and `friction-tasking-v1` blocks, and `npm run verify:context` fails when a body, a block digest, or
an ID set drifts. A second copy here would be exactly the drift the manifest exists to prevent.

Authority is unchanged and lives where it always did: [CLAUDE.md](../CLAUDE.md),
[AGENTS.md](../AGENTS.md), [.agent-harness/tier.json](../.agent-harness/tier.json),
[docs/OWNER_CONSTITUTION.md](OWNER_CONSTITUTION.md), [HUMAN_TODO.md](../HUMAN_TODO.md) and
[docs/analyser-program/CURRENT_STATE.md](analyser-program/CURRENT_STATE.md).
