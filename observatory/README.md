# Observatory integration

Source kit: [Pulseboard #15](https://github.com/Chris0Jeky/Pulseboard/pull/15), hardened source commit `8d92fff11f581d600c357e402cd521426665f318`.

This adapter is loaded only by the synthetic `showcase` build. It has an empty endpoint and performs no collection or consent storage. Local/private builds and portable exports must remain uninstrumented. The script is vendored, not loaded from a third-party CDN.

Check the vendored artifact with `node observatory/check.mjs`. The shared kit has 58 local tests; this repository's full build, privacy scan and browser checks still need to pass. In particular, prove that normal local builds and exported reports never load the script.

Activation is a separate reviewed change: deploy the collector, review the notice and CSP, regenerate with an exact project endpoint, run the host checks, then test explicit consent and withdrawal. Do not put a read token in this script. Use the kit's installer to preserve the SHA-256 lock and refuse accidental overwrites.

Once activated, the baseline emits opted-in page views and content-free error occurrence counts. `story.opened` and `share.requested` are reserved contracts, not yet wired success funnels. Add explicit UI hooks without repository names, titles, dataset contents, export contents or identity. No local GitHub data belongs in these events.
