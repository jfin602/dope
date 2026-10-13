# P3 Flow-only replay after projection repair

Date: 2026-10-02 (America/Chicago). **Not Green for P3.** This is additive evidence after the historical P3 closeout, which remains unchanged. Product Phase 6 P7 remains Not Green and P8 remains blocked.

## Exact candidate and scope

- Activation source `0cd080b12a71f67a78ae53ea3d3da8523894454c` is reachable. The repaired code candidate is `e688b7d4e54f12c14dccb037d7c4027fbdce88f3`, still at coherent `0.6.7`. No `0.6.8` work was made.
- `projectFlowMap` now renders `aggregates` for System/Subsystem overview results and `facts` for detail results, as identified by the required `projectionLevel`. It no longer tries to recover visible summaries from raw facts. The backend test checks the overview aggregate result. The focused regression covers aggregate-only System and Subsystem results and detail facts.
- The historical P1/P2 candidate evidence remains as recorded in `closeout.md`. This replay exercised the Flow GUI evidence blocked by that candidate's empty canvas; it did not repeat the already observed Architecture, Planning, or toolbar presentation matrix.

## Automated evidence

| Check | Result |
| --- | --- |
| Focused Flow projection/query/backend/UI tests | 29/29 passed. |
| Map, navigation, Flow UI, Planning UI, readability, theme and projection tests | 42/42 passed. |
| `npm run check` | Passed: typecheck, repository tests, browser build and Electron build. Product tests passed 204/204; initialization tests passed 22/22. |
| Correction validator / hygiene | `npm run codex:phase:validate -- c6-map-canvas-priority` returned `VALID`; `git diff --check` passed. Root and live workspace manifests/internal references remain `0.6.7`; no root `package-lock.json`. |

## Direct Flow GUI evidence

The real browser workbench used a fresh disposable copy, `/tmp/adaptive-seo-dope-c6-projection-ZvorD6`, from accepted `/home/jfin/dev/adaptive-seo-dope`. Both began and ended with Git status `?? .dope/` and `?? MODULES.md`. Their only `.dope/` files were `architecture.json` (SHA-256 `b5a09a50397149f589a80c2f9987ec66c0023a85c75ad98b4a973ebd1d370208`) and `smap.json` (SHA-256 `b35801cb0d6ea2100c7fa47c28f2e75b186dab8ff9fae28cdf7fff446b4bc583`). The accepted source was not modified. Analysis of the copy published generation 1, `partial`, 4,419 nodes and zero architecture violations; no architecture regeneration or acceptance occurred.

| P3 Flow area | Direct observation | Result |
| --- | --- | --- |
| Aggregate-only overviews | Adaptive SEO Service rendered **15 participants / 31 edges**, including an Input, Output and shared Store, matching 31 summarized relationships in inspection. Adaptive Recommendations rendered **18 participants / 27 edges**, matching 27 summarized relationships. The prior empty-canvas defect did not recur. | Passed projection contract. |
| GET opportunities behavior | The focused canvas exposed `GET /api/workspaces/:workspaceId/projects/:projectId/opportunities` as an Input, a `receives` edge to `adaptive-routes.ts`, an `invokes` summary to `adaptive-repository.ts`, reads to the PostgreSQL endpoint, and a GET `responds` edge. Selecting the GET Input and downstream trace highlighted `receives`, `invokes`, two read summaries and `responds` while leaving unrelated edges subdued. The `invokes` edge included `AdaptiveRepository.list` at `adaptive-routes.ts:62`. Read summaries exposed the three required `AdaptiveRepository.list` sites at `adaptive-repository.ts:162`, `:166` and `:170`; the unlabeled read summary also contains other repository reads and does not assert one observed request. The GET response summary exposed three source-backed branches at `adaptive-routes.ts:54`, `:59` and `:60`. Coverage stayed explicitly `partial`; data semantics stayed unresolved where evidence was absent. | Passed source-backed possible-Flow inspection, with overview summarization explicit. |
| Edge provenance/source | The GET `receives` edge showed one source record at `adaptive-routes.ts:48`. **Open edge source** opened that file in the ordinary editor at line 48. The response edge showed three backing interactions and three source records. | Passed. |
| Inspection overlay | Expanded → compact → minimized → expanded preserved selected edge and downstream trace. At the default viewport, stage height stayed **581px** and React Flow transform stayed `translate(292.176px, 23.8153px) scale(0.349521)` across those transitions. Minimized inspection left a recoverable affordance. | Passed state/no-refit check. |
| Architecture round trip | Flow → Architecture → Flow retained `Project / Adaptive SEO Service / Adaptive Recommendations` focus and the selected GET Input. Trace direction cleared on mode switch, consistent with the current controller behavior; it could be started again. | Passed focus/selection; trace retention is not claimed. |
| Alternate theme | Dark (Theia) retained 18 nodes, 27 edges, descriptive toolbar labels, selected path outlines and subdued context; the trace had five selected overview edges and 22 subdued edges. Dope Dark was restored afterward. | Passed state/contrast cues observed; density remains a readability problem. |
| Focused readability | In the browser's default 1280×720 viewport, the 987×581px stage fitted the 18-node Flow at **0.350×**. At a 1280×1080 viewport matching the earlier P3 stage height (987×941px), a fresh focus fitted at **0.566×**. Node identities and edge labels were still too small to read comfortably without zoom, and the right side of the path sat beneath inspection. Theme switching did not fix this. | **Failed P3 immediate-readability requirement.** |

The projection repair is verified, but the focused canvas is still too dense at first fit. This is a distinct presentation limitation; the replay made no layout or query-budget change. The existing `docs/tasks/c6-map-canvas-priority/closeout.md` remains the historical P3 Not Green result at `d4f17c7`, and `docs/tasks/p6/P7-flow-dogfooding-evidence.md` remains the original P7 Not Green record. P3 is still **Not Green**. Fresh P7 requalification has not run. P8 remains blocked. The packaged AppImage controlled-shutdown failure remains a separate unresolved P7 blocker and was not exercised here.
