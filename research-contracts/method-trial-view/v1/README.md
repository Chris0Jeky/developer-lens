# DeveloperLensMethodTrialView.v1

This is the product-owned C0 presentation contract for the WB-C1 Method Trial. It is a strict,
path-free view of invented weekly system series: the rolling median/MAD baseline remains the
deterministic fallback, BOCPD is rejected when the preregistered gates do not hold, and PELT is
reported only as `offline_descriptive` boundary evidence. It is not a ResearchPack, dataset, or
production evaluation result.

The runtime contract is [`shared/methodTrialView.ts`](../../../shared/methodTrialView.ts). Generate
the standalone Draft 2020-12 schema with `npm run generate:method-trial-view`; `npm run check` runs
the byte-for-byte drift check. The lab owns the later synthetic `wbc1.fixture.json` and must
validate it against this schema before any route consumes it.
