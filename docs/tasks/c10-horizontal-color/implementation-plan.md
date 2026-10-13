# /prompt-plan — c10-horizontal-color

**Status:** reviewed and authored, ready for execution after safe local preflight; source not modified by these documents.
**Baseline:** latest remotely inspected `c10-roadmap-qualify` implementation P1–P8 through `bcf2b628f72b5f10d138e9609832580296cc5f7a`; manual qualification restructure documentation at 0882f8551877bd6db1653508954dfc8da1ecc886. Verify local HEAD/ancestry and current code before implementation. Required package version `0.10.16`.

## Locked visual layout contract

1. Main phase path has monotonic **increasing X**, stable shared baseline **Y** and readable left-to-right sequence. Stable phase/checkpoint ordering uses the real projection; no synthetic dependencies.
2. Corrections and their gate/prompt descendants use vertical branches **above** the main progression. Ordinary supporting task stacks/evidence use branches **below**. Branches connect to the actual parent; absent relationships stay disconnected rather than drawing fake completion arcs. Never move a canonical dependency just to make layout attractive.
3. Deterministic subtree sizing reserves sufficient X/Y space for legible 280px cards, long labels and prompt chains. Keep dense graphs bounded, prevent unrelated node overlap, avoid crossing the center line, and preserve `roadmapVisibleGraph` semantic zoom disclosure / 96-prompt budget.
4. React Flow edges and handles visually enter/leave appropriate sides. Existing Fit/Focus, pan/pinch/scroll, selection, Arrange-only dragging and inspector opening remain functional. Tab/Arrow/Home/End navigation follows a documented logical order compatible with spatial layout; keyboard must not operate a different ordering from DOM traversal.
5. v1 saved viewport and Arrange placements are versioned as *presentation* preferences. Detect legacy orientation; migrate user adjustments relative to old/default anchors when safe, or preserve recoverable legacy state and provide a non-destructive intentional re-fit/reset path. Never silently interpret v1 X/Y as v2, overwrite original preferences, leak state across projects or change `RoadmapIndex.revision`.
6. Auto colors correspond to six existing statuses exactly: Green muted green, Active restrained orange, Not Green muted red, Waived a distinguishable muted violet, Not implemented neutral gray, Unknown neutral desaturated. An evidence-based `Owner-closed for sequencing` label persists independently of color; waived NEVER green. No inferred task completion or Green based on version, closed runner prompt or historical waiver.
7. Edge progress is derived *only* from known canonical endpoints and real edges; do not color a path Green through Active/Not Green/Waived/Unknown nodes. Correction branches can show their own status without converting their parent. Selection/focus is a distinct accessible treatment, not a status override. Labels/icons, patterns and contrast carry meaning without color.
8. Consume `--theia-*` / centralized `--dope-*` tokens for dark and alternate themes. Keep ordinary surfaces neutral and orange reserved for Active/intentional action. No new theme system, source owner or data schema.

## Ordered prompts and focused proof

| Prompt | Seam | Tests/proof | Deferred |
| --- | --- | --- | --- |
| P1 | `roadmap-canvas-model.ts`, `roadmap-viewport.ts`, React Flow node/edge placement in `roadmap-canvas-widget.ts` | update `roadmap-spatial-canvas.test.ts` plus `roadmap-viewport.test.ts`, `roadmap-prompt-open.test.ts` if navigation changes; dense fixture, v1 migration, no semantic mutation | style semantics, full GUI |
| P2 | `roadmap-canvas-widget.ts` node/edge statuses, `dope.css` + central theme tokens if needed | focused `roadmap-canvas.test.ts`, `roadmap-status-truth.test.ts`, theme test only if shared tokens changed; noncolor status and false-green negatives | animations, aggregate |
| P3 | cross-seam implementation evidence and manual handoff | affected spatial/viewport/status/theme suites only if changed/untested, version/runner validator, `git diff --check`; no repeated full test matrix | live P12/P13/P14 |

## Manual matrix disposition

Current `c10-roadmap-qualify/manual/P9`–`P14` **remain separate browser-tool manual prompts outside `codex:phase`**. The P12 UI/Chat/Electron family explicitly tests horizontal phase progression, vertical correction/support branches, dense layout, theme colors, true waived/not-green labels, keyboard, mouse/touch, narrow center split, refresh/restart and v1 layout migration. P13 adds false-green/authority-negative proof. P14 uses the final exact source SHA and replays only gates plausibly invalidated by this correction or subsequent repairs before the one final `npm run check`.

No runner gate for manual P9–P14, no `/activate`, no synthetic manual qualification commits, no extra qualification family. Completion of this correction means the presentation implementation is ready to be qualified, NOT that `c10-roadmap-qualify` or Product Phase 10 is Green.
