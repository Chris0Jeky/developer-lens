
# Decision catalog

The interactive HTML is the primary decision surface. This file provides the same catalog in compact form.

## Decision status model

- `confirmed` — explicitly approved by the owner.
- `proposed-default` — recommendation selected by this bundle, not yet owner authority.
- `changed-unconfirmed` — user selected a non-default option but has not confirmed it.
- `deferred` — deliberately postponed with no implicit default authority.

## Proposed defaults

| ID | Area | Decision | Proposed option |
|---|---|---|---|
| `REL-01` | Release | Release shape | `joint` |
| `REL-02` | Release | Open security dependency PR #323 | `merge` |
| `REL-03` | Release | Final Product visual sign-off | `approve-packet` |
| `PRD-01` | Product | Post-release order | `304-then-174` |
| `PRD-02` | Portfolio | GitHub milestone model | `outcome-milestones` |
| `GOV-01` | Governance | Governance expansion budget | `freeze` |
| `PRD-03` | Product | Story-mode identity language | `separate` |
| `CON-01` | Contracts | Coverage representation in PublicLensProjection | `ratio` |
| `CON-02` | Contracts | ResearchFinding repair strategy | `split` |
| `CON-03` | Contracts | Gate representation | `evidence-gates` |
| `CON-04` | Contracts | False-alert improvement rule | `20-percent` |
| `CON-05` | Contracts | Outcome and limitation wording | `derive` |
| `ARC-01` | Architecture | Contract source of truth | `codegen` |
| `ARC-02` | Architecture | Lens extension model | `compile-time` |
| `ARC-03` | Architecture | Legacy dashboard versus V2 | `strangler` |
| `ANA-01` | Analytics | #174 analytical method split | `split` |
| `ANA-02` | Analytics | #174 cohort and support floor | `created-window` |
| `PLT-01` | Platform | Windows 8.3 path failure | `fixture-fix` |
| `SEC-01` | Security | Loopback API authorization | `packaging-gate` |
| `DAT-01` | Activation | Real-data activation order | `ordered` |
| `DAT-02` | Activation | Cross-repository C4 content hashes | `no-default` |
| `DAT-03` | Product | Freshness and exact timestamps | `layered` |
| `OPS-01` | Operations | Telemetry | `local` |
| `DST-01` | Distribution | Distribution ladder | `cli-gh-desktop` |
| `TEAM-01` | Team | Team mode boundary | `aggregate` |
| `INT-01` | Integration | Taskdeck integration identity | `exact-private` |
| `DAT-04` | Activation | First real canary scope | `one-canary` |

## Export contract

The deck exports `DeveloperLensDecisionExport.v1`. The in-repo agent should:

1. validate it against `agent/decisions.schema.json`;
2. copy confirmed decisions into the appropriate authority/ADR file;
3. keep proposed defaults in a non-authoritative intake;
4. seed implementation issues only when their dependencies and human gates are satisfied;
5. record exact provenance: bundle version, export timestamp and selected option ID.

## Strongest recommendations

- Release Product and Lab jointly.
- Merge #323 after exact-head proof.
- #304 first, then #174 as the dominant lane.
- Add outcome milestones.
- Freeze new governance mechanisms for two waves.
- Make Product the executable contract authority.
- Use evidence-bearing gates in ResearchFinding v2.
- Use the preregistered 20% false-alert rule.
- Build a compile-time LensDefinition kernel.
- Use deterministic survival tables in Product and model sensitivity in Lab.
- Activate real data only after #174, #201 and #202.
