# Sol Ultra implementation orchestrator — redirect

<!-- prompt-source: redirect target: DL-P01-FLAGSHIP-GOVERNOR -->

**This file is no longer an executable prompt.** Orchestration prompts now live in the prompt
library behind stable IDs:

- **Coordinating a normal session:** `DL-P01-FLAGSHIP-GOVERNOR` in
  [docs/agent-system/PROMPT_LIBRARY.md](agent-system/PROMPT_LIBRARY.md).
- **Running unattended across many waves:** `DL-P03-OVERNIGHT-CONTINUOUS`, whose loop is specified
  in [docs/agent-system/CONTINUOUS_WORK_PROTOCOL.md](agent-system/CONTINUOUS_WORK_PROTOCOL.md).
- **Resuming after an interruption or handoff:** `DL-P04-RESUME-RECONCILE`.

Runtime routing is carried inside each body by the shared `runtime-bootstrap-v1` block: Claude reads
[CLAUDE.md](../CLAUDE.md) first and delegates through the named `dl-*` agents; Codex reads
[AGENTS.md](../AGENTS.md) first, then the shared canon it references, invokes the continuation
skill, and follows Sol/Terra/Luna routing.

Do not treat this redirect, or any historical prompt document, as project state.
