# Native-v3 explanations — 2026-10-29

## Behavior

The explanation resolver selects a native-v3 SQL adapter only for the exact supported SQLite application and user versions. Native-shaped stores with missing, foreign or future identities fail closed. The legacy adapter and its coverage-reference format remain unchanged.

After establishing the root claim, every native descendant lookup is pinned to that root's scope: edges, claims, evidence, coverage, jobs, limitations, lineage, ancestry and supersession. An explicitly mismatched request scope is refused. Direct coverage edges resolve by their scoped C1 anchor before any legacy composite-key checks. Canonical native coverage anchors keep direct edge references distinct even when two rows share the same job and date fields; the older range/job pair remains presentation data for native rows.

Missing targets include scoped lineage where available. Deleted roots can recover their retained lineage without a caller-supplied scope only when the exact claim has one unambiguous, valid scope cause. Unknown or ambiguous roots disclose no foreign lineage.

C2 expiry legitimately removes exact dates. The internal explanation projection permits those fields to be null, validates retained coverage accounting/status/limitation rules, and keeps lineage as its retained calendar-valid ISO week. The Evidence Drawer renders absent dates as unknown and retained weeks verbatim. No exact instant is reconstructed from a week.

## Evidence

- Tests-first head `78847abccdfe99928554e36d20092df9d8bce3cf`: [PR gate 40803655093](https://github.com/Chris0Jeky/developer-lens/actions/runs/40803655093) demonstrated twelve intended failures across native resolution, nullable/week contract validation and Drawer rendering. The other 2,460 tests passed, with four platform skips.
- The final invented native fixtures cover all edge roles, distinct coverage references, root and descendant scope boundaries, missing and deleted lineage, real C2 expiry and scope deletion, absent/ambiguous deleted-root scope inference, bounded cycles, schema identity refusal, no-write serialization, and alias/source-field canaries.
- Internal contract tests retain coverage semantic checks even after temporal expiry and reject ambiguous timestamp/week combinations. Client-side calendar validation includes years below 100 without JavaScript's Date.UTC year remapping.
- Fresh independent review caught one remaining direct-coverage summary path still passing a null retained date to the date formatter. It now uses the same unknown-date renderer as the expanded coverage view; the existing expiry regression explicitly asserts the collapsed summary before expansion.
- The import-boundary test admits only the resolver's read-only schema-identity constants import. No schema installer or writer is invoked by the resolver.
- Local diff checks pass. Dependency installation is unavailable in the executor; full compilation, legacy/native Vitest, public showcase and contract drift checks run on the exact final GitHub Actions head and are recorded in the PR.

## Boundaries

This addresses #431 and part of #80. It changes no storage DDL, producer fixture, frozen ResearchPack/MethodTrialView/ResearchFinding bytes, endpoint wiring, capability activation or private input. The current Lab sync consumers were inspected and do not consume the internal whyContract. Reverting the change requires no persistent migration.
