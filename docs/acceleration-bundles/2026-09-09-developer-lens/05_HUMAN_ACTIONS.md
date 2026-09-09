
# Human actions and owner decisions

## Current blocking action

### Product q-10(c) — final aesthetic release sign-off

This is the only current Product action that blocks the v0.1 tag.

The agent should prepare exactly:

- exact Product commit;
- full desktop screenshot;
- above-the-fold desktop screenshot;
- 390×844 mobile screenshot;
- short scroll-through video or GIF;
- browser console result;
- horizontal-overflow result;
- public/synthetic provenance statement;
- SHA-256 manifest of the reviewed files.

The owner response should be one of:

- `APPROVE q-10(c) for the exact packet and commit shown`;
- `REQUEST one bounded correction: <specific visible defect>`;
- `REJECT because <release-blocking usability problem>`.

Do not ask the owner to re-decide the product architecture during this gate.

## Non-blocking owner decisions worth taking now

The interactive deck includes proposed defaults for:

- milestone structure;
- #304 versus #174 ordering;
- Story/System language;
- coverage semantics;
- ResearchFinding v2 gate design;
- #174 cohort and method;
- real-data activation order;
- Taskdeck pinning;
- future telemetry and distribution.

The agent may import proposed defaults, but must distinguish:

- **confirmed** owner decision;
- **proposed default** from this review;
- **changed but unconfirmed** selection;
- **deferred** decision.

## Deferred human tasks

These do not block current product work:

- legal review of CLA/commercial-relicensing strategy before substantial outside code;
- per-study public transformation review for any real-data-derived research;
- supply exact real-data scope/credentials only when a reviewed activation card is ready;
- select remote telemetry provider and approve privacy notice if remote telemetry is ever enabled;
- npm/PyPI publishing credentials;
- external umbrella brand and commercial licence terms;
- individual ranking or person-level product mode;
- hosted private-service URL;
- exact conduct inbox;
- machine-local cleanup named only in private handoff.

## Recommendation on the remaining q-6 choices

### Cross-repository content hashes

Default: **do not persist them**. Introduce purpose-scoped keyed linkage only for a concrete lens.

### Adoption-timing suppression

Default: suppress portfolio/change-analysis findings for the first two complete post-adoption periods, and display “baseline still forming.” Keep the rule versioned and overrideable in local inspection.

### Rulesets and attestations

Default: eligible for system-level policy/coverage findings after source capability and evidence mapping exist; never present as a proxy for developer quality.

### Freshness grain

Default: age/coarse status in normal UI; exact timestamp in local evidence detail; day/week or suppressed in public exports.

### Taskdeck identity

Default: exact immutable commit/schema in private local integration config; public compatibility range in documentation; explicit activation card for writes.
