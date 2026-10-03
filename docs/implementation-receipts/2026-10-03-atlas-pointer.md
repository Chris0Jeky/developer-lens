# Atlas native pointer evidence (#397)

## Consumer and selected design

The unresolved #397 public smoke missed the lower-bound p90 control after closing the first Evidence Drawer. It did not capture hit identity or native events. This slice adds a repeatable, dependency-free Chrome DevTools Protocol smoke, not a speculative product patch. Existing required gates and application code stay unchanged.

Run `CHROME_PATH=google-chrome node scripts/atlasPointerSmoke.mjs dist` only against a freshly built, privacy-verified invented showcase (`npm run build:showcase`). The optional workflow builds that artifact itself. It never accepts a remote URL, attaches to an existing browser, reads a real profile, or enables collection. A new disposable profile and process-private CDP pipe are used. The fixture is served on an ephemeral loopback port; off-origin requests and the collector SDK are blocked. This is trusted C0-build QA, not a hostile-code sandbox or arbitrary-directory server.

Three fresh-page sequences at each 1280/390 width target the first stratum's primary p90, assert its matching visible drawer, close by native Escape, and target lower-bound p90. Every native mouse event records before/after geometry and hit identity. Exactly one trusted down/up/click sequence must reach the selected mark. Missing, ambiguous, obscured, disabled, detached or moving targets fail before a click. There is no DOM `.click()`, click retry, assertion weakening, or deletion of failed receipts. Readiness polling waits for the declared C0 surface, document and fonts; two animation frames separate scrolling from the first witness.

## Local and hosted proof boundaries

Nineteen contract tests were authored first. A fail-open stub produced 17 failures and two passing controls; the implementation passed all 19 using the same assertions with Node test registration. A native invented `about:blank` DOM separately proved private-pipe transport, the actual serialized DOM witness and trusted input delivery. This is not a full application/browser pass.

The exact Pages artifact for main `964181769efef1d5f40eeca0a1907f67cf93e032` was retrieved through GitHub (artifact 11281740127, run 37143008447) and its archive SHA-256 matched `4b1e535bbeb017168aced5db369446e4d01c40c4f93bf95a9100d25780a5cb45`. Both public and loopback browser navigation were refused by this container's browser policy with ERR_BLOCKED_BY_ADMINISTRATOR. No policy workaround or product-defect inference was selected. Hosted native proof is required for the actual application.

Keep #397 open until its public-deployment sequence is qualified and any observed cause is localized. A successful local hosted-build smoke does not establish physical-device, native Windows, public deployment or assistive-technology acceptance. The existing failure remains real historical evidence. The workflow prints every attempted sequence, including failures, into exact-head job logs. Later changes may promote this optional lane only after stability is demonstrated.

Rollback: revert this optional harness, tests and workflow through a normal PR. No data schema, metric, capability, dependency, release or owner gate changes. Review stop conditions are failed or absent native proof, unexpected network access, ambiguous target semantics or changed ownership.
