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
six `metrics`, optional ordered `gates`, one to eight `limitations` and `unsupported_claims`, and
`provenance`. Every object is strict. Metric values are finite and bounded by their registered
unit: `rate` and `ratio` are 0..1; integer `count` is 0..1,000,000; `count_per_year` is 0..10,000;
`hours` is 0..100,000. This initial registry uses rate and count_per_year.

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

### GateCode (registry order)

| code | display_text |
| --- | --- |
| `baseline_selection` | Baseline selection is viable |
| `candidate_selection` | Candidate selection is viable |
| `detection_floor` | Candidate meets detection floor |
| `delay_budget` | Candidate meets delay budget |
| `false_alert_improvement` | Candidate false alerts improve |
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
| `model_promotion` | This rejected trial cannot promote a model. |
| `online_pelt_performance` | Offline PELT markers do not establish online performance. |

Each code has exactly the displayed text. Runtime validation rejects a changed pairing, repeated
metric or gate codes, and gates that leave registry order. A rejected finding requires a failed
gate or a measured candidate metric worse than baseline under `better_when`.

## Canonical hash and privacy

`provenance.bundle_hash` is `sha256:` plus SHA-256 of the UTF-8 RFC 8785 JSON Canonicalization
Scheme serialization after removing only `provenance.bundle_hash`. Canonicalization sorts object
keys by JavaScript UTF-16 code units, preserves array order, emits no whitespace, uses JSON
string escaping and ECMAScript shortest-round-trip finite numbers, and rejects unsupported values,
sparse arrays, non-plain objects, `toJSON`, non-finite numbers, and lone surrogates. The fixture's
bundle hash is `sha256:700110c41bd24e7e9a8a991238ad8390878818ac7ee9a18464cf3c84f2562d6d`.

The published fixture is synthetic and contains no repository identity, person identifier, path,
email, handle, or date other than `generated_at`. The only permitted public URL is the literal
Pages method-trial URL in the fixture. The complete fixture file SHA-256 (including its trailing
newline) is:

`sha256:8c21e6b832c88ce525362c7f64f77af6d861cead9c143635e033ee9fe4e0ce20`

JCS acceptance vector (RFC 8785 section 3.2):

```json
{"numbers":[333333333.33333329,1E+30,4.50,2e-3,0.000001,5e-324],"literals":[null,true,false]}
```

canonical output:

```json
{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,0.000001,5e-324]}
```

Generate or check the tracked schema and fixture with:

```text
npm run generate:research-finding
npm run check:research-finding
```
