# /prompt-ass — c10-horizontal-color

**Date:** 2026-10-13 (America/Chicago).
**Disposition:** bounded presentation correction before the `c10-roadmap-qualify` manual P9–P14 qualification; not a product-authority redesign. Unchanged `0.10.16`; Phase 10 NOT GREEN / NOT OWNER-CLOSED.

## Current source and risk

- `packages/project-intelligence/src/roadmap-projection.ts` already separates `lane: path | branch`, projection `status` and `statusLabel`, and dependency/branch edges. Its six canonical statuses are `green`, `not-green`, `not-implemented`, `waived`, `active`, `unknown`. Layout/colors are caller presentation state; do NOT mutate `RoadmapIndex` or derive official status from prompt filenames/runner commits.
- `packages/theia-extension/src/browser/roadmap-canvas-model.ts` `roadmapSpatialLayout` currently places phases in one X column and advances Y, while branch depth changes X. `roadmapCanvasOrder` governs DOM/keyboard order, and detail levels disclose/cap descendants. Rotate the presentation contract without losing that disclosure and boundedness.
- `roadmap-canvas-widget.ts` uses the existing React Flow canvas, left/right source handles, Fit/Focus, selected state, Arrange placements, and `roadmapNextId`. `roadmap-viewport.ts` persists v1 coordinates, viewport, selection and expansion. Existing v1 placements require an explicit safe migration/compatibility policy, not a blind reinterpretation.
- `dope.css` currently gives node and edge outlines neutral theme colors. Theme authority is ADR 0016; use centralized semantic tokens instead of hardcoded hex in components. ADR 0037 preserves the human entry point, visible state, feedback, focus and narrow screens.
- Focused tests: `test/unit/roadmap-spatial-canvas.test.ts` (currently asserts vertical phases), `roadmap-viewport.test.ts`, `roadmap-canvas.test.ts`, `roadmap-status-truth.test.ts` and `dope-theme.test.ts` if theme registration changes. Update the first test rather than leaving contradictory assertions.

## Assessment / split

**P1 — layout, T2 / Sol High.** One coherent seam: horizontal monotonic main path; correction branches above, support below; nested task/prompt fan-out; no collisions in dense graphs; true existing edge relationships; keyboard/handle direction; legacy viewport/Arrange compatibility; stable identity across refresh/restart. Moderate algorithm and interaction risk justifies High. Narrow to graph layout + associated UI presentation/test code.

**P2 — colors, T1 / Sol Medium.** Render-only classes/tokens for six statuses, selected/focused contrast, noncolor cues, truthful dependency/branch path tinting, light/dark and custom theme fallback. No synthetic completion percentages or added persisted status. T1 tests and style source inspection.

**P3 — implementation closeout, T2 / Sol Medium.** One focused cross-seam verification plus exact handoff to manual matrix, not a duplicate live GUI qualification. Do not run a full aggregate or claim Phase 10 Green. The runner requires one final `closeout` prompt; this is its only closeout, Browser required no. Manual P12/P13/P14 remain the sole live UI/authority/final qualification authority.

## Prompt Efficiency and UI/Human gates

- Three prompt grammar, two implementation responsibilities, no speculative backend changes, no new runtime/library/provider.
- P1 may need a bounded T2 exception to the <=8-minute target because dense branch placement and v1 migration must be correct; prefer minimal deterministic algorithm and existing React Flow mechanics over a rewrite.
- P2 targets <=8 minutes including changed-source tests; no full browser/Electron build in ordinary prompts. Build only changed theia-extension outputs if tests require compiled artifacts; tests importing TS source can run directly under existing test conventions.
- P3 reuses P1/P2 passing evidence on unchanged source, runs only meaningful focused cross-seam checks and `codex:phase:validate`; manual P14 owns the single exact-source `npm run check`. Do not invoke a full aggregate twice.
- UI compliance: existing restrained dark-orange identity, theme tokens, no orange borders on every card, readable status in light/dark, clear focus, no status/selection conflation and no hardcoded local palette. Orange signals Active only; Green remains earned.
- Human usability: developer sees phase progression when entering Roadmap, can follow branches without obscuring the main path, read status without color, use pan/zoom and keyboard, recover/fit in a narrow viewport, and retain saved Chat placement. Actual human/native behavior remains a T3 manual P12 test.
- Runner grammar: `Correction 10 / P1..P3`, identical required unchanged version, one final closeout, exactly one Sol recommendation and Browser-required metadata per prompt. No `/activate` or activation-only failure gate.
- Preserve historical P16/P19 Not Green and current P9–P14 append-only loop evidence; invalidated UI evidence is replayed on the final committed source rather than erased.

## Explicitly deferred

No automatic percent/progress roll-ups lacking a trusted denominator, no animation dependency, no new roadmap data schema/status transitions, no invented correction reconnect edges, no rebuilt Chat or separate map engine, no real Electron/native qualification during these runner prompts, no Phase 11 usability overhaul.
