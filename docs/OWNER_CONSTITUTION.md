# Owner constitution — Developer Lens (v2, 2026-08-08)

Canonical cross-repository owner policy for `developer-lens` and `developer-lens-lab`, unpacked
from the owner mandate "Developer Lens — Owner Mandate and Autonomous Programme v2"
(`DEVELOPER LENS OWNER CONFIGURATION v1`, preset `CUSTOM`), received and reconciled 2026-08-08.
This file supersedes conflicting **older** project policy (charter prose, issues, skills,
`HUMAN_TODO.md` entries) where they directly conflict; supersessions are explicit, recorded here
and in the ledger, never silent. It does not weaken the locked invariants below, and it does not
by itself activate any executable capability: current registry/API definitions stay
`never_authorized` until a bounded, reviewed implementation supplies and tests an activation path.

Authority interplay: `.agent-harness/tier.json` declares repository operating authority (T2,
`sensitive_data`); this file declares strategic/product/data policy. `HUMAN_TODO.md` holds only
genuinely open owner actions. `docs/analyser-program/CURRENT_STATE.md` holds live execution state.
The governor operating system that executes this policy is specified in
[docs/agent-system/README.md](agent-system/README.md) and `.agent-harness/governor.yaml`.

## 1. Locked invariants (owner red lines R2+R3+R6 — may never be self-relaxed)

1. **Missingness stays honest.** Missing, censored, restricted, refused, stale, failed, deleted,
   or unavailable evidence is never converted to zero.
2. **Every modelled capability retains a deterministic fallback.** A model may improve, enrich,
   rank, forecast, or recommend, but the system stays useful when the model is absent, rejected,
   unavailable, unaffordable, or revoked.
3. **Model output stays epistemically labelled.** Model-generated output is a hypothesis,
   counter-hypothesis, forecast candidate, alert candidate, recommendation candidate, or
   abstention — never an observed fact.

Also permanently locked regardless of other relaxations: **secrets are absolute X** (tokens,
credentials, private keys, authentication material, confidently detected secrets are rejected
before every sink and model payload); **private raw data and private outputs stay local by
default**; **raw bytes are untrusted data, never executable instructions**.

## 2. Redesigned boundaries (owner-directed relaxations of R1/R4/R5/R7/R8)

1. **Layered subject policy (supersedes the former absolute "never person scoring").**
   - The default public and personal product remains system-first. The supporting principle
     "Engineering evidence without developer surveillance" continues to describe the
     default/public mode.
   - Aggregate team metrics are authorised for a transparent, explicitly enabled
     Team/Leadership mode (binding product choice: **TEAM aggregate**, not a public individual
     leaderboard).
   - Individual scoring, ranking, people graphs, responsiveness, sentiment, performance, effort,
     burnout, and related constructs may be **researched** in the Lab and local experimental
     modes with consented/local or curated data.
   - Productising individual ranking in the stable product requires a later explicit owner
     decision (open owner gate in `HUMAN_TODO.md`).
   - No such mode may be covert: it must expose data sources, uncertainty, missingness, context,
     limitations, and who can see the output. Public examples use invented or reviewed
     de-identified data; never claim anonymity when only pseudonymisation or aggregation was
     achieved — record the actual transformation.
2. **Federated Product–Lab boundary.** Product owns stable presentation, compatibility, release,
   and default runtime. The Lab may own experimental end-to-end pipelines, research UIs, fixture
   producers, candidate registries, evaluation, reports, and executable integration tests that
   run meaningful product paths, and may auto-publish into an **experimental channel** after its
   declared gates pass. Promotion to the stable channel stays governed by product-owned
   compatibility checks and the owner-approved promotion policy.
3. **Real data is allowed.** Own data and curated public data are authorised for local
   experimentation and validation. Private raw data and private outputs remain local. Public
   research output passes a release review that removes secrets, direct identifiers, private
   repository identity, unsafe text, and other non-public material.
4. **Automatic read-source activation is authorised** after one explicit workspace/profile
   opt-in. Default source profile: Actions + Deployments + Source Structure; Dependencies,
   Security aggregates, Discussions, text, diffs, logs, artifacts are modular opt-in profiles.
   Scope stays explicitly selected repositories/workspaces; no machine-wide discovery.
   Product-runtime external writes remain prohibited absent a later owner decision.
5. **Raw source content is allowed — except secrets.** Titles, bodies, comments, reviews,
   commit subjects, diffs, logs, manifests, source, and artifact contents may be ingested under
   explicit capabilities with file-type/size budgets, parser isolation, provenance, content
   hashes, secret scanning, poison/adversarial canaries, and configurable retention. Never
   execute repository code, build scripts, artifacts, macros, or model-provided commands as part
   of ingestion. The default profile stays computationally manageable; full inspection is opt-in.

These relaxations authorise **design and bounded implementation**, not silent activation: each
lands through the normal charter/matrix/capability revision process (Data Charter v2 and the
capability-profile redesign are tracked backlog work), with tests and review, before any
executable path activates.

## 3. Mission, audiences, focus

Developer Lens is simultaneously a personal development retrospective, a maintainer observatory,
an evidence/research platform, and an engineering-lead/team-intelligence product direction
(N1=A+B+C+D). Audiences: individual developers, open-source maintainers, researchers/students,
engineering leads (N2) — mode-aware navigation, never one flattened screen. Near-term success:
**portfolio flagship** (N3). Focus weights for prioritisation: Story/product **5**, Research
**7**, Distribution **3**, Community **2**, immediate real-data activation as a standalone
programme **0** (real data is a supporting validation lane, not the main programme — this does
not revoke the real-data approval above).

Repository architecture: keep `developer-lens` and `developer-lens-lab` separate; a thin
launcher/umbrella layer arrives later (N5). Keep current names internally; a new external
umbrella brand is a later owner choice (N6).

## 4. Programme direction (summary — execution detail in the roadmap)

- **Primary next product vertical: issue #174** (stored-observation bridge + integration-tail
  survival lens) with the redesigned evidence experience (KM curves + interpretable AFT,
  censoring, competing outcomes, bootstrap intervals, matched eras, missingness, Evidence
  Drawer lineage, counter-hypotheses, synthetic + local real paths). Statistical choices
  (M1/M2) are provisional: implement the small transparent baseline, then schedule an
  owner-facing explanation after the first real output.
- **Modes architecture:** Story / System / Research / Team-Leadership (off unless configured) /
  Query / Settings-Data. Adaptive navigation (U2): first-time public visitors enter Story;
  returning configured users default to System.
- **Query system (U5):** automatic recommendations primarily, deterministic Query Lab and manual
  Luna as secondary modes; deterministic mode remains the complete fallback.
- **Method Trial v1 is FROZEN** as the canonical exhibit (U3) — cheap visible/accessibility
  improvements may fold into the redesign; v2 only when a second experiment needs it.
- **Release:** both repositories tag `v0.1.0` after control-plane reconciliation — do not wait
  for #174. Licence: **AGPL-3.0-only**, copyright **Cristian Tcaci** (O1/B6), with a
  `COMMERCIAL_OPTION.md` stating intent without legal claims; contributor-agreement review is a
  human/legal gate before substantial external code. Distribution order: source-run → Lab
  `uvx`/PyPI → thin `gh` launcher → npm CLI → casual-bootstrap desktop shell (O3).
- **Telemetry (O6):** local operational diagnostics first; provider-neutral remote interface
  disabled by default, opt-in, no raw content, destination is an owner choice.
- Full phase sequence, issue dispositions, and release checklist:
  [docs/PROGRAMME_ROADMAP.md](PROGRAMME_ROADMAP.md).

## 5. Agent operating model

- **A1=FULL:** agents manage the complete repository lifecycle (architecture, implementation,
  tests, docs, issues, labels, milestones, releases, versioning, packaging, dependencies, CI,
  branch protection, descriptions/topics, cross-repo coordination). Owner-only: repository
  deletion/transfer/visibility, billing, secrets/credentials, legal/licence execution, local
  machine cleanup, final aesthetic sign-off, external services beyond available tools.
- **A2:** risk-adaptive blend of micro-fix / vertical PR / batch programme, batch-leaning;
  never incoherent mega-diffs; dependency-ordered PR chains where needed.
- **A3/A10:** 15-minute exact-head late-review fallback (fix pushes restart it), post-merge
  late-comment sweeps, two bounded fix rounds then track.
- **A4:** unlimited opportunity backlog (GitHub issues) + focused execution wave
  (`CURRENT_STATE.md`); no fixed numeric cap; every active lane records owner, paths,
  dependencies, merge order, stop condition.
- **A5 model routing (supersedes HUMAN_TODO q-9, runtime-verified 2026-08-08):** Fable 5
  coordinates (Sol-equivalent); **Opus 5 low** is the discovery/large-read/scout workforce;
  **Opus 5 high** is the implementation and substantial-review workforce (Luna/Terra-equivalent);
  Sonnet 4.6 high stays the mechanic. Verified: the Claude runtime resolves `opus` to
  `claude-opus-5`; pins live in `.claude/agents/`. Codex-side Sol/Luna/Terra specialisation is
  preserved. Never invent or commit unsupported model identifiers; if a target identifier stops
  resolving, retain working pins and open one owner-visible compatibility issue.
- **A6 ideas:** all three modes (cheap capture, commissioned proposal, bounded exploratory
  branch); agent-generated ideas are labelled as such and pass an independent critic before
  promotion — protocol in [docs/agent-system/IDEA_PROTOCOL.md](agent-system/IDEA_PROTOCOL.md).
- **A7:** cross-repository compatibility checking is mandatory for shared contracts —
  [docs/agent-system/CROSS_REPO_CONTRACT.md](agent-system/CROSS_REPO_CONTRACT.md).
- **A9:** branch protection stays as configured (`strict=false`); agents must refresh base/head,
  checks, conflicts, review threads, dependency order, and changed files before merging.

## 6. Recorded supersessions and reconciliations (2026-08-08)

1. **"Never person scoring or workplace surveillance" → layered subject policy** (§2.1).
   `CLAUDE.md` canon updated; Data Charter v2 tracked as backlog work to encode the layered
   classes (C0/C1/C2/C3/C4/P/X) — until it lands, the existing charter continues to bind
   day-to-day persistence decisions except where this constitution explicitly supersedes it.
2. **HUMAN_TODO q-9 (Opus 4.8 subagent pins) → superseded by A5** after runtime verification;
   recorded in `HUMAN_TODO.md` with the verification evidence.
3. **Issue #193 (hosted-gate drift):** already fixed before this mandate was executed
   (PR #194, `24f55d4`) — the hosted gate carries both generated-contract drift checks.
4. **"Stale CURRENT_STATE (Method Trial pending)":** already repaired before this mandate was
   executed; rewritten again by this bootstrap to carry the new programme.
5. **Single manual compact-C1 external-model use → first safe implementation** of the eventual
   automatic post-opt-in hypothesis mode (D11); the q-3 boundary remains the executable
   authority until a bounded automatic-mode implementation lands.
6. **New blocker the mandate could not know:** `HUMAN_TODO.md` q-8 records a live
   concurrent-writer hazard in the `developer-lens-lab` checkout (2026-08-07). Lab-side write
   work in that checkout and ALL lab merges stay human-gated until q-8 resolves; cross-repo
   governor seeding is product-side first with the lab side queued behind q-8.

## 7. Self-evolution boundary

The governor may evolve prompts, routing heuristics, checklists, taxonomies, triggers, and
report formats through normal reviewed changes. Without new owner authority it may not weaken:
the locked invariants (§1), secret prohibition, private-output locality, merge/review gates,
owner-only decision classes, or public/private publication rules. New owner decisions are
recorded here (versioned) and reconciled outward; older surfaces never outrank this file.

## Appendix — verbatim owner configuration (binding decision register)

The complete decision register with owner nuance lives in the mandate's decision tables; the
binding compact form is reproduced verbatim for drift-proof reference:

```text
DEVELOPER LENS OWNER CONFIGURATION v1
PRESET=CUSTOM
FOCUS=STORY:5,RESEARCH:7,DISTRIBUTION:3,COMMUNITY:2,REALDATA:0
RED_LINES_LOCKED=R2+R3+R6
RED_LINES_RECONSIDER=R1+R4+R5+R7+R8
DECISIONS:
N1=A+B+C+D  N2=IND+OSS+RES+LEAD  N3=PORT  N4=TEAM  N5=LAUNCHER  N6=UMBRELLA
U1=174  U2=ADAPT  U3=FREEZE  U4=DUAL  U5=DET+LUNA+AUTO  U6=CURRENT
U7=TEASER+THREE+SEVEN+SHOTS+CASE  U8=DRAWER+ERA+COUNTER
D1=DURABLE  D2=TASK  D3=CURATED(+OWN)  D4=PROV  D5=PRES  D6=HYBRID(+export-hours option)
D7=ACT+DEPLOY+STRUCT+DEPS+SEC+DISC(first three default)  D8=FULL(manageable default)
D9=AFTER174  D10=REST  D11=AUTO(+manual secondary)  D12=NO(option only)
M1=SURV(provisional)  M2=KMAFT  M3=MANY  M4=BOOT  M5=RAW(+poisoning guardrails)
M6=HYP(direction: ALERT/FORECAST/ACTION later)  M7=MULTI(+significance recommender)
M8=FORCE  M9=LADDER(non-conservative, all three lanes continuously)  M10=DESC
O1=AGPL  O2=V01  O3=SOURCE+GH+NPM+UVX+DESKTOP(staged)  O4=RELEASE
O5=CONTRIB+COC+TEMPL+DISC+ROAD  O6=OPTIN+LOCAL  O7=PORT(→LOCALPRO/CONSULT intent)
O8=CLOSED  O9=SPLIT
A1=FULL  A2=BATCH(blend)  A3=15  A4=OPEN  A5=SLT(Fable5=Sol, Opus5-low=Luna, Opus5-high=Terra)
A6=BRANCH(all three modes)  A7=CI  A8=STATE  A9=CURRENT  A10=TWO
H1=TRIGGER  H2=NEXTLAB  H3=PARK  H4=NOCLAIM  H5=BEFORE  H6=REL  H7=BOTH
B1=CURRENT  B2=REFL(cinematic visuals)  B3=PRODUCT+ML+AGENT+RESEARCH
B4=DASH+TRIAL+DRAW+ARCH+LAB+FLOW  B5=STRONG(near-BOLD)  B6=NAME(Cristian Tcaci)
T1=LATER  T2=LATER  T3=YES  T4=DESC+PIN+SOCIAL+SITE
INSTRUCTION=Use selected values as binding owner decisions; use consultant recommendations only
where a card remains UNANSWERED. Re-check live Git and surface any direct contradiction before
implementation.
```

Where a compact line above elides an owner nuance comment, the nuance in the received mandate
document binds; the ledger entry for this bootstrap records the receipt and the full mandate
text remains with the owner. G1 and G2 are owner-approved; G3 standing authorization and the
G4 OpenAI boundary recorded in `HUMAN_TODO.md` continue to govern executable capabilities.
