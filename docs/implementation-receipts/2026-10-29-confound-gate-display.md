# Confound gate display — 2026-10-29

This bounded UI follow-up for #371 labels the confound gate as its actual acceptance condition: the candidate's confound false-alert rate does not exceed the baseline. The adjacent Pass, Fail or Not applicable status continues to carry the result. Every other gate retains its supplied display label.

The change affects only the Method Trial renderer. Frozen MethodTrialView/ResearchFinding v1 labels, serialized fixtures, hashes, producers and score calculations remain unchanged. A coordinated future contract revision is still needed to improve the wire label for other consumers; #371 remains open for that work.

Independent review checked the rendered condition against the shared candidate <= baseline rule, including unavailable measurements producing Not applicable, and verified that #446's alert-week changes are retained. git diff --check passed. Existing component, semantic-contract, type/build and showcase checks are used for this low-impact copy change rather than adding a test that merely repeats its label. Full hosted results are recorded in the PR; local dependency execution is unavailable in this executor.
