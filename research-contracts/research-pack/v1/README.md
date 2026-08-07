# ResearchPack v1 standalone contract

`schema.json` is a generated, standalone [JSON Schema Draft 2020-12][draft] description of a
`DeveloperLensResearchPack.v1` pack. `invented.fixture.json` is a deterministic, invented,
schema-valid example. Both files are produced by `scripts/generateResearchPack.ts`
(`npm run generate:research-pack`) and are drift-gated by `npm run check:research-pack`; edit the
generator, never these files.

The authoritative validator is the TypeScript `ResearchPackSchema` in `shared/researchPack.ts`.
The standalone schema exists so external Draft 2020-12 consumers can reject as many malformed
packs as the vocabulary allows without importing our runtime. It is **necessary but not
sufficient**: it never accepts something forbidden by a construct it *can* express, but a pack it
accepts is not guaranteed valid — the runtime validator remains the source of truth.

## Encoded toward parity (rejected by the standalone schema)

- Present vs. non-present **relation** and **temporal-availability** field-presence
  (`if`/`then` on `state`, with `const` / `not:{const:null}` guards).
- **Relation-specific `schema_id`**: a present relation must carry exactly its own contract id
  (`schema_id: { const: "developer-lens.<relation>.v1" }`), mirroring the runtime wrong-`schema_id`
  rejection.
- A non-present relation may not carry present-relation fields — e.g. an
  `intentionally_omitted` relation with `row_count: 0` is rejected (`row_count: { const: null }`).
- Present-relation artifact `media_type` must be Parquet (`const`).
- The nonempty-coverage dependency: any analytical relation with `row_count > 0` requires a
  present, nonempty `coverage` relation.
- The closed interpretation-code vocabulary (`enum`) plus the required `NOT_PERSON_MEASURE`
  code (`contains`), and the person/productivity `feature_id` prohibition (`pattern`).
- The C1 `T00:00:00Z` midnight floor on `generated_at` and each present operational window
  boundary (`pattern`).

## Runtime-validation-only invariants (NOT expressible in Draft 2020-12)

These `superRefine` rules require comparing or de-duplicating values across sibling fields, for
which standard Draft 2020-12 has no keyword. A Draft 2020-12 validator **cannot** reject these;
consumers that need full validity MUST run the TypeScript validator:

1. **Ordered temporal windows.** `window.start` must be strictly before `window.end`; a reversed
   window (end before start) passes the standalone schema. No standard keyword compares two
   sibling instant strings. (We deliberately do not use ajv's non-standard `$data`, which would
   make the artifact non-portable.)
2. **Distinct artifact digests.** Present relations must not share one `artifact.sha256`;
   cross-property uniqueness over separately named relations is not expressible.
3. **Unique `feature_id`.** `feature_registry` entries must be unique by `feature_id`; `uniqueItems`
   only de-duplicates whole objects, not one field.
4. **C1 ISO-week and 36-month bounds.** Beyond the encoded `T00:00:00Z` floor, the runtime also
   requires each floored boundary to fall on a UTC Monday and every present window `start` to lie
   within 36 UTC calendar months of `generated_at`. Monday-ness and the rolling `generated_at`-
   relative cutoff are runtime-only (the corresponding `$comment` in the schema records this).

[draft]: https://json-schema.org/draft/2020-12/schema
