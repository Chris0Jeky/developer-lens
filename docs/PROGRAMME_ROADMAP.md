# Programme roadmap (owner mandate v2, 2026-08-08)

Phase roadmap unpacked from [docs/OWNER_CONSTITUTION.md](OWNER_CONSTITUTION.md). Live execution
state and the focused wave stay in `docs/analyser-program/CURRENT_STATE.md`; this file is the
stable phase plan and issue-disposition record. GitHub issues are the unlimited opportunity
backlog; labels `now`/`next`/`later`/`idea`/`owner-gated` mark queue position.

## P0 — Control-plane reconciliation (the governor bootstrap) — DELIVERED by this programme

Owner constitution + governor operating system + model-routing supersession (q-9 → A5, runtime
verified) + state/canon reconciliation + label/milestone taxonomy. #193 was already fixed
(PR #194) and CURRENT_STATE already truthful before this mandate executed; both recorded, not
redone. AGPL/community/release scaffolding was deliberately split out of the bootstrap PR into
the P0.5 release programme so the control plane stays one coherent reviewable batch.

## P0.5 — `v0.1.0` release programme (next)

Order (mandate release sequence):

1. AGPL-3.0-only licence text + SPDX + README/package notices (copyright Cristian Tcaci),
   `COMMERCIAL_OPTION.md` (intent only, no legal claims; CLA review stays a human gate).
2. Community scaffolding: `CONTRIBUTING.md`, Code of Conduct, issue/PR templates, Discussions,
   compact public roadmap.
3. Lab-side release prep (harness deny/parity fixes lab #12/#13 equivalents; one maintenance PR
   before the next lab experiment per H2) — product q-8 closed 2026-08-09; proceed under the Lab's
   normal worktree, review, and CI gates.
4. Dependency-alert triage (H6) both repos.
5. Final browser/visual QA (agent proof + five-minute owner sign-off, H7).
6. Tag `v0.1.0` both repos with synchronized changelogs; publish selected C0 JSON/HTML release
   assets (O4); release notes, screenshots, walkthrough.
7. Repository descriptions/topics/social cards; owner pins repos and updates portfolio (T4).

Do not wait for #174; the current frozen Method Trial baseline is the v0.1.0 exhibit.

## P1 — #174 integrated vertical (primary flagship)

Product-owned research-input + presentation contracts (bounded selected-store export; Lab
consumes; product renders `IntegrationTailStudyView.v1`-style view in a lazy route + Evidence
Drawer), KM + AFT baseline with censoring/competing outcomes/bootstrap/matched eras, dual visual
redesign (cinematic Story vs scientific notebook Research), synthetic public path + local
own/curated path, mandatory cross-repo compatibility CI. Non-blocking bounded design lanes:
Research Lab hub, automatic Query/Recommendations, Taskdeck dogfood (ref = owner gate),
future private share URL. #181/#182 semantics land alongside contract design (H1); #135 and
#76 fold in where the Evidence Drawer/resolver/coverage registry is touched; #80's resolver
lineage joins ride with #174.

## P2 — Automatic sources and real-data profiles

Data Charter v2 (layered classes C0/C1/C2/C3/C4/P/X; sink rules per persistence, logs, API,
frontend, export, model, telemetry, release), modular capability profiles (Core default:
Actions+Deployments+Source Structure; Extended; Text-rich; Full inspection; Team research;
Custom) with one-time workspace opt-in then auto-activation, pause/revoke/delete/budget
controls. Reassess #168/#177 exact residuals before real activation (H5); #86 enforced before
real connector persistence; #5/#6/#59/#57 become one pre-activation readiness programme. Own
(this repo + lab) and 3–5 documented curated public repositories (REST first, selection-bias
documented, no representativeness claim).

## P3 — Query / Auto-Luna + raw text pipeline

Local deterministic recommendations first (trigger on materially changed analysis runs);
automatic model hypotheses after workspace opt-in within cost ceilings; manual Luna preserved;
later rich-text excerpt mode with separate toggle, payload preview, redaction, provider
disclosure. Raw-content pipeline with secret rejection, parser isolation, poisoning canaries.
#66/#69 unpark when retrieval activates; #68 FDR governance before any large multi-candidate
tournament.

## P4 — Packaging and broader modes

`gh` launcher → npm CLI → casual-bootstrap Electron shell; Team/Leadership aggregate mode
(transparent, separately enabled); umbrella-brand exploration (owner names it); local-pro /
consulting experiments. `agent_config` presence-only role near adoption (D5). Local model stays
an option with a provider interface + evaluation card, not planned work (D12).

## Standing issue dispositions (mandate register)

| Issue | Disposition |
|---|---|
| #193 | Fixed pre-mandate (PR #194); verified in the bootstrap. |
| #174 | P1 flagship; do not start before P0.5 baseline tag. |
| #189 | Freeze v1; cheap a11y visibles fold into redesign; v2 only on a second experiment. |
| #181/#182 | Schedule with #174 contract design (H1 trigger). #181 shipped its schema slice (PR #198). |
| #135 | Fold into #174 Evidence Drawer/resolver work. |
| #168/#177 | Reassess exact residuals before real activation (H5); close stale acceptance items. |
| #142 | One trusted writer; never claim hostile same-user containment (H4); no native VFS now. |
| #183 | Parked until real scopes exceed ~10k retained subjects or profiling shows impact (H3). |
| #80 | Split: resolver/deletion lineage joins → #174; terminal retention separate lifecycle task. |
| #86 | Both halves closed; re-verify before real connector persistence. |
| #5/#6/#59/#57 | One pre-activation readiness programme with discriminating tests (P2). |
| #76 | Fold into #174/coverage work. |
| #68 | Resolve before a large multi-candidate/holdout tournament. |
| #66/#69 | Parked until Query Lab/retrieval activates. |
| #55 | Fold into the redesign/visual QA wave. |
| #41 | Opportunistic; before claiming full historical date support. |
| lab #5/#6/#7/#23/#24 | Lab lane; product q-8 closed 2026-08-09, so normal cross-repo review and CI gates apply; separate Lab owner gates remain item-specific. |
