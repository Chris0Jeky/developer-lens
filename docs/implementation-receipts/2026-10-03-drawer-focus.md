# Evidence Drawer focus and native pointer recovery (#397)

## Why this is a product correction

The diagnostic-only #407 reached its two-round correction limit at `04c0fe34b3e3fb86d392192e662ec246d50930fa`. Preserve that branch and its failed receipts. This coordinator replacement retains every harness/test/workflow blob unchanged and changes only the two automatic focus calls in EvidenceDrawer, adds three React regressions and this receipt. It includes current main's external #405 settings change; that work is not overwritten or attributed to this session.

Native run 37148902182/job 111278426473 on integration `a9df3247f26396712232526f53c7152a2d45613d` (04c0fe3 into 7cb4623) passed three desktop and two narrow sequences. The sixth sequence correctly failed before the lower-bound click: scrollY rose from 9670 to 10225 and the target moved from y=483.03125 to -71.96875, losing hit visibility. The preceding primary click and its exact evidence drawer passed. These are measured scroll/geometry changes, not proof that all historical pointer failures share a cause.

The actual component calls focus() both on modal entry and restoration, while the page has smooth scrolling. HTML focus defaults to scrolling its target into view; preventScroll explicitly suppresses that side effect (WHATWG HTML, interaction/focus API). The correction requests `{ preventScroll: true }` for those two automatic transfers. It preserves focus, Escape, focus-trap keyboard scrolling, mark semantics, rendering, data and all smoke assertions. It does not disable animation globally or retry clicks.

## Proof plan and boundaries

Before the correction, supplementary execution of the actual effect body failed both no-scroll focus assertions and passed the closed-drawer control. Afterward all three passed. The published component blob exactly matches the locally probed bytes (`efd67669092b8ee5dfd75fb3264bc22f3e1fbefd`). These probes are not React or native application proof. Three actual React tests cover opening, dismissal and unmount restoration, and all 47 pure pointer/drawer/readiness/receipt probes remain green locally.

Required before merge: full hosted suite/build/context/privacy checks, unchanged six-sequence native smoke, exact-head independent review and a final unresolved-thread sweep. Retain the prior five passes and one failure; do not rerun an unchanged failing head into a success claim. A new native pass supports this bounded focus repair, not universal root-cause closure for #397's older public-deployment failure. Public deployment, physical devices and assistive technology remain separate acceptance scopes.

Rollback is a normal reviewed revert of this optional QA lane and two-line focus change. No dependency, capability, credential, telemetry, publication or permission change is selected. The prior harness lane is superseded, not merged despite its failure. Future sessions refresh live main and the replacement PR rather than restarting from the exhausted diagnostic branch.
