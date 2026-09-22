# ResearchFindingProjection.v1

This is the producer-owned, strict `ResearchFindingProjection.v1` contract for immutable
research evidence. The schema is structural transport validation; consumers must also run the
semantic and privacy rules in [`shared/researchFinding.ts`](../../../shared/researchFinding.ts).
Unknown fields and codes fail closed. v1 grows only by a new schema version.

The current producer is `developer-lens-lab` and emits C0 only. C0 means invented synthetic
evidence; C1 is structurally admitted for a future bounded aggregate producer. A commit or hash
is provenance, not an identity key or promotion authority. The `benchmarked` outcome is evidence,
never promotion. Consumers must render an unavailable metric as `NOT MEASURED`, and must enforce
that `reject` retains the baseline method while non-reject outcomes retain no fallback.

In this exemplar, `source_product_contract_commit` anchors the existing Product WB-C1 input/view
contract used to derive the finding. It is not a self-hash or circular commit field; consumers
later pin the newly published ResearchFinding schema commit externally when they vendor this seam.

## Shape and semantics

The artifact uses snake_case and contains `schema_version`, `classification`, `subject_class`,
canonical UTC `generated_at`, `finding`, distinct baseline/candidate `methods`, `decision`, one to
six `metrics`, optional `threshold_viability`, optional ordered `gates`, one to eight `limitations`
and `unsupported_claims`, and `provenance`. Every object is strict. Metric values are finite and
bounded by their registered unit: `rate` and `ratio` are 0..1; integer `count` is 0..1,000,000;
`count_per_year` is 0..10,000; `weeks` is 0..1,000,000; `hours` is 0..100,000. This registry uses
rate, count_per_year and weeks. `threshold_viability` is `{ "baseline": boolean, "candidate":
boolean }`, the source view's `scorecard.threshold_selection.baseline.viable` and
`scorecard.threshold_selection.candidate.viable`.

## Closed registries

### MethodCode

| code | display_text |
| --- | --- |
| `rolling_median_mad` | Rolling median and MAD |
| `bocpd_gaussian` | Gaussian BOCPD |
| `pelt_offline` | PELT descriptive marker |

### MetricCode

| code | label | unit | better_when |
| --- | --- | --- | --- |
| `detection_rate` | Detection rate | rate | higher |
| `false_alerts_per_year` | False alerts per year | count_per_year | lower |
| `median_detection_delay_weeks` | Median detection delay | weeks | lower |
| `coverage_confound_false_alert_rate` | Coverage-confound false-alert rate | rate | lower |

### GateCode (registry order)

| code | display_text |
| --- | --- |
| `baseline_selection` | Baseline selection is viable |
| `candidate_selection` | Candidate selection is viable |
| `detection_floor` | Candidate meets detection floor |
| `delay_budget` | Candidate meets delay budget |
| `false_alert_improvement` | Candidate false alerts are lower than baseline |
| `not_worse_detection` | Candidate detection is not worse |
| `confound_guard` | Candidate confound guard is measured |

### LimitationCode

| code | display_text |
| --- | --- |
| `c0_synthetic_only` | Evidence is limited to invented C0 weekly system series. |
| `bounded_three_case_selection` | Only three bounded representative windows are exported. |
| `missingness_and_confound` | Missing observations and instrumentation confounds are explicit. |
| `thresholds_nonviable` | Both threshold selections are nonviable. |

### UnsupportedClaimCode

| code | display_text |
| --- | --- |
| `real_repository_validity` | This result does not establish validity on real repositories. |
| `person_level_inference` | No person-level inference is supported or attempted. |
| `model_promotion` | This trial does not promote a model. |
| `online_pelt_performance` | Offline PELT markers do not establish online performance. |

Each code has exactly the displayed text. Runtime validation rejects a changed pairing, repeated
metric or gate codes, and gates that leave registry order. A rejected finding requires a failed
gate or a measured candidate metric worse than baseline under `better_when`. In v1,
`pelt_offline` is reserved in the method registry and cannot be selected as the baseline or
candidate because the published metrics and gates describe online comparisons; an offline finding
requires a future schema version. Every gate is derived from evidence the artifact itself carries,
and runtime validation rejects any other value:

- `baseline_selection` and `candidate_selection` must equal `threshold_viability.baseline` and
  `threshold_viability.candidate`;
- `detection_floor` must equal candidate `detection_rate` >= 0.75, the preregistered floor;
- `delay_budget` must equal candidate `median_detection_delay_weeks` <= 8, the preregistered budget;
- `false_alert_improvement` must equal candidate `false_alerts_per_year` < baseline;
- `not_worse_detection` must equal candidate `detection_rate` >= baseline;
- `confound_guard` must equal candidate `coverage_confound_false_alert_rate` <= baseline.

When a measurement one of those rules needs is `unavailable`, or its metric is absent, that gate
must be `null`, mirroring the source contract's `not_applicable`; when `threshold_viability` is
absent, both selection gates must be `null`. The `thresholds_nonviable` limitation is admissible
only when both selections are nonviable, and is required in that case. Nonviability is read from
`threshold_viability` when present, whether or not the selection gates are exported; without that
block it would need both selection gates at `passed: false`, which the null rule above forbids.

`false_alert_improvement` is deliberately weaker than the source view. The source contract scores
its gate with a preregistered 20% rule (candidate <= 0.8 x baseline); this projection publishes
only that the candidate's false alerts are lower than baseline, and its label says exactly that.
Over `0.8 x baseline < candidate < baseline` the projection's gate passes where the trial's gate
fails (for example baseline 3.0 and candidate 2.9). A consumer that needs the trial's acceptance
verdict must read the producer's source view contract, never this gate. The runtime also recomputes `bundle_hash`
over the canonical artifact body and rejects a mismatch; `bundle_hash` proves transport integrity
only, and never attests that a gate verdict follows from evidence.

## Canonical hash and privacy

`provenance.bundle_hash` is `sha256:` plus SHA-256 of the UTF-8 RFC 8785 JSON Canonicalization
Scheme serialization after removing only `provenance.bundle_hash`. Canonicalization sorts object
keys by JavaScript UTF-16 code units, preserves array order, emits no whitespace, uses JSON
string escaping and ECMAScript shortest-round-trip finite numbers, and rejects unsupported values,
sparse arrays, non-plain objects, `toJSON`, non-finite numbers, and lone surrogates. The fixture's
bundle hash is `sha256:070bf161dbd7fa5bcb858d484024de69f315550ce8692776b241899d54c4cf35`.

The published fixture is synthetic and contains no repository identity, person identifier, path,
email, handle, or date other than `generated_at`. The only permitted public URL is the literal
Pages method-trial URL in the fixture. The complete fixture file SHA-256 (including its trailing
newline) is:

`sha256:64f759894e92c72931bcdc19b726dfd0264aa1ddf2da3e9b328f2f266e47b84d`

JCS acceptance vector (RFC 8785 section 3.2):

```json
{"numbers":[333333333.33333329,1E+30,4.50,2e-3,0.000001,5e-324],"literals":[null,true,false]}
```

canonical output:

```json
{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,0.000001,5e-324]}
```

## Amendments before first consumption

v1 was amended in place, rather than versioned, while no consumer had pinned it:

- #320: the `model_promotion` claim text became outcome-neutral.
- #319, #321, #327: the metric registry gained `median_detection_delay_weeks` (unit `weeks`) and
  `coverage_confound_false_alert_rate`, the optional `threshold_viability` block was added, and all
  seven gates became derived and validated; `false_alert_improvement` was relabelled
  "Candidate false alerts are lower than baseline" to state its weaker-than-source rule; and
  `thresholds_nonviable` was bound to both selections being nonviable. The fixture now carries the
  source view's delay (baseline 2, candidate 1), confound (0.5, 0.5) and viability (false, false)
  evidence; its bundle hash changed from `sha256:d694f81a...` to `sha256:070bf161...`.

Any later change grows v1 only by a new schema version.

Generate or check the tracked schema and fixture with:

```text
npm run generate:research-finding
npm run check:research-finding
```
