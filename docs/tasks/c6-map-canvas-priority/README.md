# Correction 6 — Map Canvas Priority

Status: **APPROVED / PLANNING READY**
Correction folder: `c6-map-canvas-priority`
Required unchanged version: `0.6.7`
Phase context: Product Phase 6 P7 Not Green / P8 blocked
Authority: current Phase 6 plan, ARCHITECTURE, PRODUCT-MODEL, roadmap, workflow, retained P7 evidence, and the subsequent P7 requalification result

## Purpose

Make the Physical Map / Flow center workspace diagram-first without changing Software Map or Flow truth.

The map is the primary workspace. Supporting controls and immediate inspection UI must consume the minimum persistent space necessary.

The correction addresses the fresh P7 presentation failure in which the intended focused Flow is now available but the focused Subsystem canvas is too dim to read immediately.

## Locked product laws

1. **One compact map toolbar**
   - Architecture/Flow mode and genuinely map-global actions share one compact toolbar.
   - The toolbar overlays or minimally borders the map rather than creating a large permanent region above it.
   - Context-specific node/edge actions remain contextual rather than bloating the global toolbar.

2. **Icon-first controls**
   - Replace ordinary text-heavy map tool buttons with recognizable icons where a clear visual representation exists.
   - Every icon action has a descriptive tooltip, accessible name, keyboard operation, and non-color active/disabled state.
   - Dope-specific actions that are not self-evident must remain explicitly explained.

3. **Maximum practical canvas**
   - Architecture and Flow consume the maximum useful center-workspace area.
   - No persistent center details pane may substantially shorten the graph viewport.
   - Architecture and Flow use the same canvas-priority shell.

4. **Floating selected-object inspection**
   - The current center details area becomes a floating overlay over the map.
   - It supports **expanded**, **compact**, and **minimized** states.
   - Minimized state remains a small recoverable affordance rather than clearing the selection.
   - Existing deterministic evidence/provenance/source actions remain available.

5. **Stable context and geometry**
   - Overlay state changes preserve selection, focus, trace and source-navigation context.
   - Opening, compacting or minimizing details should not force graph re-layout.
   - Actual workspace resize may recompute available canvas bounds normally.

6. **Immediate readability**
   - The focused map must be readable immediately under Dope Dark and supported alternate themes.
   - Active/focused paths and selected objects remain clear.
   - Subdued context remains perceptible instead of becoming effectively invisible.
   - Color is not the only state cue.

7. **Inspector authority remains split correctly**
   - The floating overlay is immediate map inspection.
   - The left sMap inspector remains the deeper provider-free hierarchy, responsibility, relationship, evidence, source and diagnostics surface.
   - This correction does not move that authority into the center overlay.

## In scope

- shared Physical Map / Flow center workspace presentation shell;
- toolbar consolidation;
- icon controls and tooltips;
- overlay details presentation and minimize/restore behavior;
- responsive canvas sizing;
- theme/readability tuning required by the P7 failure;
- focused presentation/controller tests;
- direct GUI qualification on the accepted Adaptive SEO test workspace.

## Out of scope

Do not change:
- `PhysicalFlowFact`, Flow endpoint or extraction semantics;
- Flow overview/query/aggregation behavior;
- hard query budgets;
- trace semantics repaired by `c6-flow-overview-priority`;
- canonical architecture or accepted sMap state;
- Flow persistence;
- Planning Map domain semantics;
- Phase 7 AI Presence;
- the packaged AppImage controlled-shutdown defect unless UI work directly causes it.

The native controlled-shutdown failure remains a separate P7 blocker.

## Approved decomposition

Plan this as a small correction stack at unchanged `0.6.7`:

### P1 — Map workspace shell

- create/refactor the shared canvas-first Architecture/Flow shell;
- consolidate map-global controls into one compact toolbar;
- maximize usable map viewport;
- preserve current Software Map/Flow controller and state ownership;
- add focused layout/controller regressions.

Validation target: focused T1/T2 evidence only as required by actual package boundaries.

### P2 — Inspection overlay and icon controls

- move center selection/details UI into an expanded/compact/minimized overlay;
- iconify applicable toolbar actions;
- add descriptive tooltips/accessibility/keyboard semantics;
- preserve selection/focus/trace/source context across overlay state;
- keep graph geometry stable;
- repair immediate focused-canvas readability without broad theme redesign.

Validation target: focused UI/controller/theme regressions plus affected builds only where required.

### P3 — Direct GUI qualification

Using the real Dope GUI and the accepted disposable Adaptive SEO P7 workspace:

- exercise Architecture and Flow;
- exercise System and focused Subsystem views;
- prove the diagram receives the maximum practical center area;
- prove focused Flow is readable immediately;
- open, compact, minimize and restore selected-object details;
- prove those transitions preserve selection/focus/trace and do not unnecessarily re-layout the graph;
- exercise icon tooltips and keyboard access;
- prove Architecture -> Flow -> Architecture preserves context;
- preserve explicit partial/unsupported coverage behavior.

This qualification does not absorb the independent AppImage controlled-shutdown failure.

## Version and routing

- Keep every correction prompt at coherent package version `0.6.7`.
- Do not advance to `0.6.8`.
- Preserve all earlier P7 Not Green evidence.
- After this correction qualifies, resume P7 rather than treating the correction itself as Phase 6 closeout.
- P8 remains blocked until P7 is Green, including native release/process evidence.

## Next workflow

`/prompt-ass + /prompt-plan + /prompt-write c6-map-canvas-priority`
