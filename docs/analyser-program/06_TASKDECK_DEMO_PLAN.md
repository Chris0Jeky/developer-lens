# Taskdeck Demo Plan — Real Planning Board · Future Local Dogfood · Public Synthetic Twin

Status: **Accepted (planning artifact)** · 2026-08-04 · Non-authoritative. Three strictly separate
demonstrations with structurally incompatible data paths. Nothing here claims Taskdeck has been
analysed by Developer Lens; it has not.

## 1. Real planning board (DONE 2026-08-04 — the planning control plane)

Taskdeck is used for real as the programme's planning control plane. State achieved this session:

- **Board:** "Developer Lens — Intelligence Platform" in a **fresh, dedicated database** created
  this session in a dedicated workstation-local dogfood folder outside both repositories (exact
  path, credentials, IDs, and restart commands live only in the untracked `RESUME.md` beside the
  database; the path was predeclared and creation failed-closed had the file existed). No
  pre-existing Taskdeck database was opened, inspected, or modified. Tracked docs carry no local
  absolute paths (q-4 boundary).
- **Runtime:** the already-built Taskdeck Release binary (built 2026-07-27) and prebuilt frontend
  `dist` were **copied to a session scratchpad** and run from the copy, so the Taskdeck checkout
  was never modified (its FirstRun bootstrapper writes `appsettings.local.json` beside the exe —
  that write landed in the copy). No dependency install, build, or migration against an existing
  database occurred. The API binds `http://localhost:5000`; an absolute `Data Source` path was
  required to defeat the FirstRun AppData rewrite.
- **Seeding:** starter pack `developer-lens-intelligence-platform.taskdeck.json` (tracked in this
  folder) — validate-manifest → `isValid: true, 0 errors` → dry-run `179 actions, 0 conflicts` →
  apply `applied: true`. Final board: **118 cards, 58 labels, 6 columns** (Open Questions /
  Proposed / Ready / In Progress / Review / Done). Idempotency proven live: re-applying skips
  existing cards as warning conflicts with `hasBlockingConflicts: false`.
- **MCP demonstration (honest pending state):** the same binary run with `--mcp` (stdio), bound to
  the new board owner via `McpServer__DefaultUserId` and the same connection string. `tools/list`
  exposed the 11 documented tools; `create_card` produced **proposal `PendingReview`** with the
  server message "Review and approve in Taskdeck to create the card."; `list_proposals` shows it
  pending. **No MCP approve/apply/execute tool exists** — approval and execution are deliberately
  left to the explicit Taskdeck user in the product UI. The proposal is safe to dismiss.
- **Browser walkthrough:** signed in as the local-only `dl-planner` user; the Home surface shows
  the board and the one pending proposal; the board route renders all columns, cards, and labels
  (verified textually via the in-app browser; the unattended pane could not composite screenshots).
- **Export:** `GET /api/export/boards/{id}/json` saved beside the database (398 KB; 118 cards).
  It is a **lossy structural transfer, not a backup**: re-import creates fresh IDs and drops
  timestamps, blocked state/reason, accesses, comments, and operational history. It contains user
  IDs and stays **outside Git**, as do the local credentials note and MCP transcripts.
- **Template declarations** are deliberately absent from the manifest: the live apply path
  validates but never persists or materialises them (verified against source 2026-08-04).
- **Caveat:** the Release binary predates HEAD (48 newer source files, incl. an unrelated
  transcripts migration). The starter-pack, import, auth, and MCP surfaces used here date from
  2026-02/04 and behaved exactly as the HEAD contracts describe; a future session preferring HEAD
  behaviour should build Taskdeck itself (out of scope for this session's no-build rule).

**Resume/restart (exact human step):** follow the untracked `RESUME.md` beside the database — it
carries the exact absolute DB path, environment values, restart commands, sign-in note, and the
pending MCP proposal ID awaiting your approve/dismiss decision in Review. (An absolute
`Data Source` path is required; relative paths are silently rewritten to AppData by Taskdeck's
FirstRun bootstrapper.)

## 2. Demo contract A — future real local Taskdeck dogfood analysis (OWNER-GATED, not run)

Card DL-DEMO-A1. Taskdeck (the workstation-local checkout registered in the estate registry) is
the **named future source-structure/code-analysis dogfood subject** — named by the owner in this session's
initiating request, and entirely separate from the recorded q-5 `github.core` selection, whose
identity stays confined to its ignored local task card (not inspected by this session).

The future activation card must specify, and this plan seeds:

- **Exact scope:** explicitly selected immutable refs (a named tag or exact SHA on `main`, chosen
  by the owner at activation time — never `--all`, never worktree branches); public GitHub
  repository metadata within the `github.core` boundary; committed-tree structure within
  `cap.source.structure` (tier-1 TS/JS + tier-2 C# when ATLAS-03 lands).
- **Purpose:** prove the structure/anatomy lanes on a real, consented, well-understood system and
  produce the first real Coverage Cockpit + X-Ray + module-graph render.
- **Processing:** all paths/manifests/AST C4-ephemeral inside the isolated worker; retained
  projections only C1 composition/role/graph summaries + C3 opaque graphs (90d) under
  installation aliases; Taskdeck's name lives only in the identity vault.
- **Identity handling:** `is_self` attribution only; no author dimensions; the 23 `codex-*`
  worktrees are **out of scope** (worktree heads need explicit inclusion per canonical identity
  rules — none is granted).
- **Deletion/rollback:** full ADR-03 cascade on revocation; the activation card's consentRevision
  is its SHA-256 per the existing idiom; proving checks named per capability card.
- **Resource caps:** worker defaults; repository is ~medium; one run, no schedule.
- **Prohibited:** no execution of Taskdeck code, hooks, or builds during analysis; no prose fields;
  no publication of any real output (q-4 boundary); no reuse of anything real in the synthetic twin.

**Unlock event:** owner selects the exact refs and approves the activation card
(DL-Q-* register, `HUMAN_TODO.md`). Until then this is a specification only.

## 3. Demo contract B — public Taskdeck-shaped synthetic twin (C0, invented)

Cards DL-DEMO-B1/B2. A public showcase system that *feels like* analysing a board-tool product
while copying **nothing** from real Taskdeck.

**Structural non-derivation checklist (binding on DL-DEMO-B1):** the generator's parameters may
not be sourced from, tuned to, or checked against real Taskdeck data — no identifier, path, title,
count, timing, module structure, dependency name, contributor fact, or derived statistic. The
invented narrative is authored first (a fictional team-planning product, "Cardframe", with invented
history: a monolith split era, a CI migration, a golden-fixture regeneration wave, one abandoned
feature branch era, a dependency shockwave, and a censored early history). Parameters derive from
that narrative document alone; the checklist is re-verified at review by diffing generator inputs
against the narrative. The twin ships through the existing C0 synthetic route and showcase
verifier (extended to any new surfaces).

**The twin must exercise:** repository X-ray + module graph with one planted cycle; an
architecture era boundary with a parser-version comparability limitation; issue→PR→release chains
incl. censored tails; weekly cadence distributions; one genuine change-point and one
coverage-shift decoy; negative space (a slot honestly empty); an open question ending the story.

**Showcase script (5–8 min, DL-DEMO-B2 seeds this):**

1. **0:00 — The real planning board.** Open the local Taskdeck board: 118 cards, dependency-true
   statuses, owner gates in Open Questions. "This is how the platform is being built — planning is
   evidence too."
2. **0:45 — Boundary statement.** Everything analytical from here is invented C0 data about a
   fictional system; no account, credential, or real repository is involved; the real dogfood run
   is specified but owner-gated.
3. **1:15 — Evidence Atlas (annotated wireframe/demo seam).** The system overview: coverage
   cockpit first — what we know, what is missing, what was refused. Absence renders as coverage.
4. **2:00 — Code anatomy.** X-ray roles, the opaque module graph, the planted cycle — with the
   parser-coverage badge and "cycles are not automatically defects" copy.
5. **2:45 — Architecture Time Machine.** Two eras; the matched-window comparison shows what
   changed *in the system* vs what changed *in the instrument*; the split/merge continuity claim
   wears its modelled badge.
6. **3:30 — Delivery map.** An issue→PR→release chain end-to-end; one suggested association in
   hypothesis styling beside observed edges; a censored tail with its tipping-fraction bound.
7. **4:15 — Pattern Lens.** The genuine change-point survives its coverage-shift alternative; the
   decoy is classified `coverage_shift_candidate` — the product distrusts itself first, out loud.
8. **5:00 — Counter-evidence.** Open the Evidence Drawer on the hypothesis: supports,
   contradicts, limitation, method version — "why am I seeing this" in one walk.
9. **5:45 — The question.** The story ends on the Open Questions Observatory: what evidence would
   change the interpretation, and what it would cost to get. No score. No prescription.
10. **6:30 — Close.** The seeded board's DL-BRIDGE-01 card on screen: "this exact card is where
    implementation starts."

**Claims to avoid** (extends `docs/SHOWCASE_DEMO.md`): do not present the twin as Taskdeck; do not
claim the dogfood run happened; do not present planning cards as shipped features; do not present
pseudonymous aliases as anonymity.
