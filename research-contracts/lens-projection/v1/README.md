# PublicLensProjection.v1

This is the producer-owned, strict `PublicLensProjection.v1` contract: a narrowed projection of
Developer Lens's `PortableExportPayload` for profile rendering (CommitAtlas). `schema.json` is
structural transport validation generated from the runtime contract; consumers must also run the
semantic, `projectionHash` and privacy rules in
[`shared/lensProjection.ts`](../../../shared/lensProjection.ts) (`PublicLensProjectionSchema`),
which this README states in full. Every object rejects unknown properties, every code is a closed
enum, and v1 grows only by a new schema version.

`showcase.fixture.json` is C0 invented data, produced by the real projection function
(`src/lib/publicLensProjection.ts`) from the synthetic showcase. It is the only fixture; an
owner's real projection is never a fixture anywhere.

## Data class and producer command

`dataClass` is the data charter's single C-axis. `C0` ⇔ `scope: "public-demo"` ⇔
`repositoryRedaction: "synthetic"`, and every repository `disclosure` is `synthetic`. `C1` ⇔
`scope: "redacted-local"`; `private-aliases` admits only `public-name` and `private-alias`
disclosures, `all-aliases` only `masked-alias`. C2 and above cannot be expressed.

```text
npm run export:profile                                   # C0 showcase (default)
npm run export:profile -- --source local --acknowledge-redaction [--range 6m|12m]
                          [--repository-redaction private-aliases|all-aliases] [--out <dir>]
```

The command writes `lens-profile.v1.json` plus an `export-manifest.json` through the same Export
sink as `npm run export:artifacts`: the full contract and a differential canary check run in
memory, the forbidden-pattern scan runs before and after the write, the written file is re-read
and re-validated, and a rerun replaces only files its previous manifest names. A local export
defaults to `private-aliases` and refuses without `--acknowledge-redaction`. The public Pages sink
is C0-only: the C1 projection is the owner's export and is never a Pages artifact or a fixture.

## Shape and semantics

Field names are camelCase and follow `PortableExportPayload`. Bounds:

- `generatedAt`: canonical UTC seconds, `YYYY-MM-DDTHH:MM:SSZ` (no fractional seconds); the only
  admitted absolute date. `range` is `6m` or `12m`; `rangeLabel` ≤ 40, relative wording.
- `summary`: integer `commits`, `mergedPullRequests`, `reviews`, `issues`, `activeDays`,
  `activeWeeks`, `repositories`, each `0..1,000,000`.
- `dna`: exactly six entries in the fixed order `focus`, `shipping`, `collaboration`,
  `consistency`, `breadth`, `stewardship`; `value` is `0..1` (the payload's `0..100` ÷ 100).
- `archetype`: `name` ≤ 40, `description` ≤ 160.
- `repositories`: ≤ 12, ordered by `attentionShare` descending, labels unique. When more than 12
  are observed, the 12 with the largest payload attention share are kept (ties by source order)
  and `summary.repositories` still reports the full count. `label` ≤ 40; a
  `private-alias` or `masked-alias` label matches `^Project [A-Z][a-z]+(?: [1-9][0-9]{0,2})?# PublicLensProjection.v1

This is the producer-owned, strict `PublicLensProjection.v1` contract: a narrowed projection of
Developer Lens's `PortableExportPayload` for profile rendering (CommitAtlas). `schema.json` is
structural transport validation generated from the runtime contract; consumers must also run the
semantic, `projectionHash` and privacy rules in
[`shared/lensProjection.ts`](../../../shared/lensProjection.ts) (`PublicLensProjectionSchema`),
which this README states in full. Every object rejects unknown properties, every code is a closed
enum, and v1 grows only by a new schema version.

`showcase.fixture.json` is C0 invented data, produced by the real projection function
(`src/lib/publicLensProjection.ts`) from the synthetic showcase. It is the only fixture; an
owner's real projection is never a fixture anywhere.

## Data class and producer command

`dataClass` is the data charter's single C-axis. `C0` ⇔ `scope: "public-demo"` ⇔
`repositoryRedaction: "synthetic"`, and every repository `disclosure` is `synthetic`. `C1` ⇔
`scope: "redacted-local"`; `private-aliases` admits only `public-name` and `private-alias`
disclosures, `all-aliases` only `masked-alias`. C2 and above cannot be expressed.

```text
npm run export:profile                                   # C0 showcase (default)
npm run export:profile -- --source local --acknowledge-redaction [--range 6m|12m]
                          [--repository-redaction private-aliases|all-aliases] [--out <dir>]
```

The command writes `lens-profile.v1.json` plus an `export-manifest.json` through the same Export
sink as `npm run export:artifacts`: the full contract and a differential canary check run in
memory, the forbidden-pattern scan runs before and after the write, the written file is re-read
and re-validated, and a rerun replaces only files its previous manifest names. A local export
defaults to `private-aliases` and refuses without `--acknowledge-redaction`. The public Pages sink
is C0-only: the C1 projection is the owner's export and is never a Pages artifact or a fixture.

## Shape and semantics

Field names are camelCase and follow `PortableExportPayload`. Bounds:

- `generatedAt`: canonical UTC seconds, `YYYY-MM-DDTHH:MM:SSZ` (no fractional seconds); the only
  admitted absolute date. `range` is `6m` or `12m`; `rangeLabel` ≤ 40, relative wording.
- `summary`: integer `commits`, `mergedPullRequests`, `reviews`, `issues`, `activeDays`,
  `activeWeeks`, `repositories`, each `0..1,000,000`.
- `dna`: exactly six entries in the fixed order `focus`, `shipping`, `collaboration`,
  `consistency`, `breadth`, `stewardship`; `value` is `0..1` (the payload's `0..100` ÷ 100).
- `archetype`: `name` ≤ 40, `description` ≤ 160.
.
  Labels are truncated to 40 UTF-16 units without splitting a character; a label that repeats an
  earlier one (a shared display name or a shared 40-character prefix) gets the smallest free
  ordinal suffix ` (2)`, ` (3)`, … in output order, its base shortened so the result still fits
  40, and the first occurrence is unchanged. `primaryLanguage` (≤ 32) is omitted when no language
  was detected. `attentionShare` is `0..1`; `activeWeeks`, `mergedPullRequests`, `reviews`
  are integers; `momentum` is a `-1..1` score (next section).
- `themes`: ≤ 9, keys unique from `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`,
  `revert`, `other`, ordered by `share` descending (ties in that key order). The producer folds
  every other conventional-commit type (`style`, `wip`, `deps`, …) into `other` before export.
- Shares: `repositories[].attentionShare` and `themes[].share` are apportioned in thousandths by
  largest remainder (ties by source order) from the payload's attention shares and theme counts,
  so each set sums to exactly 1 (or all 0) and never exceeds the 1.0001 bound. Attention is
  apportioned across the **exported** repositories only, so it is each repository's share of the
  attention of the exported set; with 12 or fewer repositories a projected share differs from the
  payload's independently rounded share by at most 0.001, and with more it is renormalized.
- `delivery` (optional): `mergedSamples` (integer ≥ 1, equals `summary.mergedPullRequests`),
  `medianMergeHours` (`0..100,000`, follows `summary.medianMergeHours`), `openAtRangeEnd`
  (authored pull requests still open at collection), and `censored` (true exactly when
  `openAtRangeEnd > 0`, i.e. open work is excluded from the median). The block is omitted
  entirely when the median or the open-work count is unavailable; it is never zero-filled and
  never carries `null`.
- `narratives`: ≤ 3, orders unique and ascending from `1 | 2 | 3`; the first payload narrative of
  each order is kept. `title` ≤ 80, `body` ≤ 280, `limitation` ≤ 200.
- `coverage`: see the next section. `warnings` ≤ 8, unique, in registry order.
- `provenance`: `producer` is `developer-lens`; `producerVersion` is the package semver;
  `producerCommit` is 40 lowercase hex; `inputHash` and `projectionHash` are `sha256:` + 64 hex;
  `showcaseUrl` is admitted only on C0 and only as `https://chris0jeky.github.io/developer-lens/`.

Every string is bounded and must contain a non-whitespace character.

### Renames against the consumer draft

The CommitAtlas draft (`docs/PROJECTION_CONTRACTS.md`) is followed except for these producer
decisions, which the consumer follows:

| Draft | Published | Reason |
| --- | --- | --- |
| `coverage.score` | `coverage.scorePercent` | The scale is named in the field: an integer percent, never a 0..1 ratio. |
| `coverage.warnings[].display_text` | `coverage.warnings[].displayText` | One casing per schema; this seam is camelCase. |
| `delivery.medianMergeHours: number \| null` | `number`, block omitted when unavailable | Tighter: absence is the only unavailable form. |
| `dna` array, any order | fixed-order six-entry tuple | Tighter: the JSON Schema itself enforces exactly six keys. |

## Repository momentum

`PortableExportPayload.repositories[].momentum` is the analytics late/early activity **ratio**
`(secondHalfActivity + 0.5) / (firstHalfActivity + 0.5)` at two decimals (`1` = even, `2` ≈
twice the activity late in the window); it is not a percent. The projection exports a symmetric
score in `-1..1`:

`momentum = round3((ratio − 1) / (ratio + 1))`

An even ratio scores `0`; `r` and `1 / r` score as exact opposites; growth approaches `1` and
fading approaches `-1`, so no clamp is needed. A non-finite or negative ratio scores `0`.

| ratio | momentum |
| --- | --- |
| 1 | 0 |
| 2 | 0.333 |
| 0.5 | -0.333 |
| 3 | 0.5 |
| 10 | 0.818 |
| 21 | 0.909 |
| 0 | -1 |

`21` is an emergence case (no first-half activity, ten weighted second-half signals).

## Coverage score

`coverage.complete`, `partial`, `unavailable` and `total` follow `PortableExportPayload.coverage`
(`complete + partial + unavailable = total`). `coverage.scorePercent` follows
`PortableExportPayload.summary.coverageScore`: an **integer percent `0..100`**, never a `0..1`
ratio. It is `DashboardMeta.coverageScore`, which analytics computes as

`scorePercent = round(100 × round2((complete + 0.65 × partial) / d))`, with `d = 0 ⇒ 0`,

where `d` is `total`, or `total − 1` when the one optional source analytics excludes (an
unavailable local Git enrichment) is among the unavailable sources. The counts cannot say which,
so the contract admits exactly the values below and rejects everything else — including every
non-integer and every `0..1` rendering of the same coverage (`0.83`, or `1` for full coverage).

### Coverage score vectors

| complete | partial | unavailable | total | admitted scorePercent |
| --- | --- | --- | --- | --- |
| 2 | 0 | 0 | 2 | 100 |
| 1 | 1 | 1 | 3 | 55, 83 |
| 3 | 1 | 0 | 4 | 91 |
| 1 | 0 | 1 | 2 | 50, 100 |
| 0 | 0 | 0 | 0 | 0 |

The fixture is the first row. The second row is the analytics regression case: an 83% dashboard
(one complete, one partial, local Git unavailable) exports `83`, and `0.83` is rejected.

## Closed registries

### CoverageWarningCode

| code | displayText |
| --- | --- |
| `synthetic_showcase` | Synthetic showcase data; these statistics do not describe a person. |
| `commit_detail_partial` | Commit detail was incomplete or reconstructed for some repositories. |
| `search_detail_capped` | Pull-request or issue detail was capped; totals keep the larger count. |
| `review_detail_partial` | Review detail was capped, so review coverage may be partial. |
| `line_changes_partial` | Authored line statistics were unavailable for some repositories. |
| `private_activity_aggregated` | Some restricted private contributions are counted only in aggregate. |
| `local_git_partial` | Local Git enrichment was unavailable or excluded some repositories. |
| `unrecognized_warning` | Another collection warning was recorded; its detail stays local. |

Each code has exactly this display text; consumers render only it. The producer maps its
free-text `DashboardMeta.warnings` onto codes by matching fixed template phrases and never
exports the warning text, because those templates interpolate repository names. A warning no rule
recognizes maps deterministically to `unrecognized_warning` — it is neither dropped nor copied.
The registry has exactly eight codes, so the de-duplicated list always fits the eight-item bound.

## Canonical hashes and privacy

`provenance.projectionHash` is `sha256:` plus the SHA-256 of the UTF-8 RFC 8785 JSON
Canonicalization Scheme serialization of the projection after removing only
`provenance.projectionHash`. The canonicalizer is the one the ResearchFinding seam publishes
(`canonicalizeJson` in `shared/researchFinding.ts`, with its RFC 8785 acceptance vector).
`provenance.inputHash` is the same hash over the JCS form of the projection's input — the
already-redacted `PortableExportPayload` (with absent optional fields dropped), never the raw
dashboard — so it commits to what was projected without exposing anything the payload did not.
A commit or hash is provenance, not an identity key or promotion authority.

`producerCommit` means different things in the tracked fixture and in a CLI export:

- **Tracked fixture:** `producerCommit` is the fixed **showcase-generator anchor**
  `d05533bbe17b3db524f9d404ef6c4a95a482e4bd`, the Developer Lens main commit whose synthetic
  showcase generator the fixture is projected from. It is **not** the commit that publishes the
  fixture (a file cannot name its own commit), and it does not change when later commits touch the
  repository, so the fixture does not churn. `generatedAt` is likewise pinned to
  `2026-09-01T12:00:00Z`, and the showcase is generated at that instant in UTC. Consumers pin the
  publishing commit themselves, outside the artifact.
- **CLI export (`npm run export:profile`):** `producerCommit` is the live `git rev-parse HEAD`
  of the checkout that ran the export, and `generatedAt` is the dashboard's own generation time.
  The export refuses if HEAD cannot be resolved to a 40-hex commit.

Fixture hash vectors:

- `projectionHash`: `sha256:a97f47a7c76ee3bf0c4c44ec6730a88c6a0e47b2de95155c3f358ec920e5a9b3`
- `inputHash`: `sha256:ce1151426b16a1b99a2143662c4b383edf777b641fad9a12f36d4db397a228b2`
- complete fixture file SHA-256 (LF line endings, trailing newline):
  `sha256:dfea3cd8f62e4eef17af433690cf586335fff6346bc37ac2638a0580b9cc3b78`

Denied content (rejected by `PublicLensProjectionSchema`): any absolute date other than
`generatedAt` (ISO or worded); handles, including digit-, underscore- and non-ASCII-leading
ones; emails; paths; `owner/repository` tokens; any URL other than the literal `showcaseUrl`;
and, inside narratives, `#number` references, URL schemes and `www.` hosts. The handle, email,
path and repository patterns are the ResearchFinding `DENIED_TOKEN`, reused unchanged. Aliases
reduce identification but are not anonymity; `privacyNote` is rendered, not hidden.

Generate or check the tracked schema and fixture with:

```text
npm run generate:lens-projection
npm run check:lens-projection
```
