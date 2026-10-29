# Literal ISO-week years — 2026-10-29

Native-v3's proposal validator used Date.UTC(year, 0, 1), which remaps years 0 through 99 to 1900 through 1999. Its four-digit vocabulary and the native SQLite constraint admit the literal earlier years. This discrepancy was found while implementing #448's retained lineage display.

Constructing January 1 with setUTCFullYear keeps the requested UTC year. The existing syntax and 52/53-week rule are unchanged. Fourteen explicit calendar cases cover early and modern years, boundaries and malformed shapes. A Node 24 probe executing the actual source predicate passed 11/14 before the fix: it wrongly accepted 0003-W53 and rejected 0004-W53 and 0099-W53. The same probe passed 14/14 after the fix. Independent review checked the calendar expectations against Python's proleptic Gregorian calendar and found no defect. Both TypeScript syntax checks and git diff --check passed.

No schema DDL, persistent bytes, producer contract, activation or source input changed. Full schema/Vitest, lint/build and showcase proof run in GitHub Actions because local dependencies cannot be installed; the PR records final results. This work preserves the separate explanation resolver import-boundary change if #448 lands first.
