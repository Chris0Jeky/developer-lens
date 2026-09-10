
# Edge cases and test matrix

## Contract and text safety

| Case | Expected behavior |
|---|---|
| whitespace-only title/question/summary | semantic validation failure; value unchanged |
| lone high or low surrogate | `safeParse.success === false`; no throw |
| `me@[192.168.0.1]` | denied at public projection boundary |
| `me@💩.la` | denied |
| decomposed Unicode domain | denied |
| unknown registry code | fail closed |
| duplicate registry entries | fail closed |
| valid body with recomputed but semantically forged hash | hash passes; semantic rule validation still fails |
| CRLF README registry | parser yields exactly two cells per row |
| semantic invariant not expressible in JSON Schema | documented runtime-only canary and parity test |

## Coverage

| Case | Expected behavior |
|---|---|
| total = 0 | ratio is `null`; no “100% complete” |
| complete < total | exact count relationship |
| partial rows | not silently complete |
| unavailable source | limiting reason identifies source/capability absence |
| producer not implemented | `PRODUCER_NOT_IMPLEMENTED`, not a false consent/censoring claim |
| conflicting coverage scopes | abstain / contract failure |
| deleted source evidence | content-free tombstone lineage, not a dangling “complete” claim |

## Integration-tail analytics

| Case | Expected behavior |
|---|---|
| open PR at window end | right-censored |
| closed without merge | competing outcome |
| merge after close | invalid source row / exclusion |
| terminal before created | invalid-duration exclusion |
| PR created before window | excluded in v1 cohort; do not pretend no left truncation |
| no merge events | abstain |
| median not reached | “not estimable,” not max duration |
| missing changed files | excluded from primary batch comparison but retained in cohort accounting |
| changed files = 0 | valid only if provider semantics permit; not confused with missing |
| tiny group | abstain or combine display bins |
| sensitivity disagreement | show disagreement; weaken conclusion |
| all work in one batch group | no comparative claim |
| ties | deterministic handling documented |
| bootstrap | seeded and stable in fixtures |
| daylight saving | use UTC instants; display grain separate |
| absolute exact timestamp in public projection | denied or rounded per sink policy |

## Store and activation

| Case | Expected behavior |
|---|---|
| duplicate provider repository IDs | reject before opening/mutating target |
| installation key mismatch | explicit identity discontinuity refusal |
| partial key creation | task-owned recovery without deleting raced replacement |
| request budget 2 or 3 | zero-fetch refusal |
| second writer | content-free busy refusal before migration/WAL/deletion |
| selected DB lost, backup remains | restore requires external immutable selection proof |
| wrong task/key/root | fail closed |
| revocation crash | replayable intent and exact tombstones |
| stale backup | replay proves deletion remains effective |
| scope A claim cites scope B coverage | impossible by schema/writer invariants |
| 8.3 test temp path | fixture canonicalizes before production boundary |
| symlink/junction/hard link | production boundary remains strict |
| huge revocation | benchmark each stage before set-based rewrite |

## Export

| Case | Expected behavior |
|---|---|
| scanner fails before write | no output |
| scanner fails after write in new directory | all owned files removed; directory removed |
| scanner fails after write in existing directory | owned files removed; existing directory preserved |
| one cleanup `rm` fails | continue best effort; privacy failure remains primary error |
| unknown CLI option containing secret-shaped text | error does not echo full argument |
| local source without acknowledgement | refusal before reading source |
| public target with C1 | refusal |
| partial previous export | manifest-scoped replacement only |

## Browser/UI

- desktop 1440×900;
- 390×844 mobile;
- keyboard-only drawer interaction;
- screen-reader alternative for every analytical chart;
- missing values break plotted lines;
- no horizontal document overflow;
- small labels meet a documented readable floor;
- loading, empty, abstain, partial coverage and error are visually distinct;
- no measured-sounding copy when a measurement is unavailable;
- every displayed number has an evidence route or is explicitly decorative.

## Test levels

1. **Pure unit:** rule, support, cohort, estimator, projection.
2. **Contract mutation:** mutate one valid fixture per invariant.
3. **Store integration:** invented SQLite selected store.
4. **API round-trip:** response schema and evidence references.
5. **UI component:** rendering and interaction.
6. **Synthetic end to end:** same lens via C0 selected store.
7. **Hosted proof:** exact-head full gate.
8. **Activation rehearsal:** only after #201/#202, one explicit card.
