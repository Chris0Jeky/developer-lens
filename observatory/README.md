# Pulseboard SDK v3.1 (public synthetic showcase only)

Source: `Chris0Jeky/Pulseboard` `observatory/adapters/build-sdk.mjs`, built for project `developer-lens`
from Pulseboard `main` at `5b53836` (SDK 3.1.0, issue Chris0Jeky/Pulseboard#105). The artifact is
`observatory/pulseboard.js`; `observatory.lock.json` pins its SHA-256.

## Where it runs

Only `npm run build:showcase` (`vite build --mode showcase`) emits it. The artifact is kept outside
`public/` on purpose, because Vite copies `public/` into every build. For the showcase build a Vite
plugin (`vite.config.ts`) re-checks the lock, emits `pulseboard.js`, adds
`<script defer src="/developer-lens/pulseboard.js">` and an empty
`<div data-pulseboard-bar style="min-height:2.5rem">` as the first child of `<body>`, and marks the landing route with `<html data-pulseboard-route="home">` (every page opens on the dashboard; Wrapped and Share Studio call `route()` themselves).

Local and private builds (`npm run build`, `npm run dev`), local datasets, share artifacts and
portable exports never load it. Three guards prove that:

- `npm run build` ends in `verify:uninstrumented`, which fails if any file or file name in `dist`
  mentions Pulseboard, the collector origin or the old adapter.
- `verify:showcase` checks that the showcase `index.html` loads exactly the locked artifact once, and
  that share and portable-export outputs carry no marker.
- The product calls in `src/lib/showcaseUsage.ts` are compiled away outside `--mode showcase` and fire
  only for the `public-demo` dataset.

The SDK itself stays inert off its registered origin (`https://chris0jeky.github.io`) and under
automation.

## Events

| Call | When | Props |
|---|---|---|
| `route('story')` + `track('story.opened')` | Wrapped opens | `story: 'wrapped'`, `range: '6m' \| '12m'` |
| `track('share.requested')` | a Share Studio control is used | `channel: native \| copy \| image \| report \| portable-share \| portable-download \| link`, `context: overview \| wrapped` |
| `route('share')`, `route('home')` | Share Studio opens, Wrapped or Share Studio closes | none |

Props are closed enums from product code. Captions, repository names, titles, dataset contents and
export contents are never sent. Every call is guarded, so the product works when the SDK is absent,
blocked or throws.

## Check and rebuild

- `node observatory/check.mjs` verifies the lock hash, the `pulseboard-sdk 3.1.0` header, the collector
  origin `https://pulseboard-observatory.commit-atlas.workers.dev`, the registered routes and events,
  no server constants, no network before mount, and inertness off-origin. `npm test` runs it too.
- Rebuild from a Pulseboard checkout:
  `cd <Pulseboard>/observatory && node adapters/build-sdk.mjs developer-lens <this checkout> observatory/pulseboard.js`,
  then update the `sha256` in `observatory.lock.json`.

Nothing is stored until Pulseboard lists `developer-lens` in `COLLECT_STAT_PROJECTS` and
`COLLECT_PRODUCT_PROJECTS`; until then the collector refuses the requests. GitHub Pages sets no CSP for
the showcase; if one is added, `connect-src` must include the collector origin.
