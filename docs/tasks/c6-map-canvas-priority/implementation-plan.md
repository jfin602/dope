# Correction 6 Implementation Plan — Map Canvas Priority

Status: **APPROVED / READY**
Correction folder: `c6-map-canvas-priority`
Required unchanged package version: `0.6.7`
Activation source: `561ad62678f6e20a6da21b3537d136290d07f0e3`
Assessment: `prompt-assessment.md`

## Shared invariants

- The center diagram is the primary map workspace.
- Physical Map Architecture and Flow reuse the existing `PhysicalMapController` and shared Software Map publication.
- Planning Map continues to use the existing `PlanningMapController`; this correction changes presentation, not Planning semantics.
- Flow extraction, facts, endpoints, query/aggregation, budgets and trace semantics are frozen.
- The left sMap inspector remains the deep hierarchy/evidence/source-navigation surface.
- Toolbar/overlay state is presentation-only and must not enter canonical architecture, Physical Map evidence, Flow DTOs, Planning Map basis or `.dope/`.
- Package version stays `0.6.7`.
- The known AppImage controlled-shutdown failure is not repaired or qualified by this stack unless the presentation change itself directly causes a new native failure.

## P1 — Canvas-first map workspace shell

### Goal

Refactor `PhysicalMapWidget` so Architecture, Flow and Planning use one compact Dope-owned map toolbar and the React Flow canvas receives the maximum practical remaining space.

### Structural shell

Replace the current vertical stack of independent map bars with a shared layout approximately equivalent to:

```text
map workspace
  toolbar
  canvas stage
    React Flow canvas
    lightweight floating status/orientation affordances
    later inspection overlay
```

The exact DOM/component decomposition is implementation-owned.

The toolbar should remain a single compact row when normal width permits and may wrap/overflow gracefully on narrow widths without recreating several persistent vertical tool bands.

### Toolbar ownership

Move genuinely map-global actions into the shared toolbar.

Architecture/common candidates:
- Architecture / Flow mode;
- Planning Map toggle when applicable;
- Up;
- Focus;
- Open selected tab;
- Open source;
- Fit;
- node color.

Flow candidates:
- trace downstream;
- trace upstream;
- clear trace.

Planning candidates:
- map selection/view controls that are genuinely global to the current Planning Map.

Do not put detailed selected WorkItem/edge/evidence content into the toolbar.

P1 may keep text labels internally while establishing structure; P2 converts applicable actions to final icon-first affordances.

### React Flow controls

The built-in React Flow `Controls` currently creates a second tool cluster.

Remove that duplicate surface and expose necessary zoom/fit map operations through the Dope toolbar using the existing `ReactFlowInstance` seam.

At minimum preserve:
- zoom in;
- zoom out;
- Fit Architecture / appropriate current-map fit.

Do not break `MapViewport` semantic zoom baseline/hysteresis.

Toolbar zoom must behave like ordinary geometric zoom and must not silently focus a node or alter domain state.

### Breadcrumbs and status

Do not keep breadcrumbs/status as large independent rows if that prevents maximum canvas area.

Preferred:
- integrate breadcrumbs/orientation into the toolbar or a single compact overlay/rail;
- keep the status live region for accessibility, but visual status may be a small floating pill/line over the canvas.

Preserve full breadcrumb identity and existing Focus/Up semantics.

### Canvas sizing

Make the widget/canvas stage a flex/grid fill region with correct minimum-height/min-width behavior so React Flow uses all remaining center space.

No permanent normal-flow Flow/Planning details panel should determine canvas height after P2; P1 should establish the stage that makes this possible.

Resize should continue to behave correctly when Theia panels/sidebar sizes change.

### State and fit guards

Structural rerendering must not create extra:
- `fitView` calls;
- Flow queries;
- relationship queries;
- focus changes;
- selection changes.

Preserve the existing `mapFitContext`, `fitRequested`, and semantic-LOD no-snap behavior.

### Tests

Add/extend focused tests to prove:
- one shared Dope toolbar exists;
- old separate Flow toolbar is no longer a second permanent control band;
- React Flow built-in `Controls` is not rendered as a separate cluster;
- zoom in/out/fit actions route through the existing flow instance;
- map shell gives the canvas a fill/flex stage rather than fixed leftover height;
- breadcrumbs/status remain available without becoming domain state;
- Architecture/Flow/Planning mode switching still preserves existing controller identity;
- no Flow/domain DTO gains toolbar/layout state.

### Validation — T2

Run:
- `npm run build:extension`;
- `node --test test/unit/physical-map-canvas.test.ts test/unit/physical-map-navigation.test.ts test/unit/physical-map-flow-ui.test.ts test/unit/planning-map-ui.test.ts test/unit/smap-readability.test.ts`;
- any new focused map-workspace test;
- `npm run build:browser`;
- `git diff --check`;
- package-version/no-root-lock checks.

Do not run direct browser qualification or packaging.

## P2 — Inspection overlay, icon controls and focused readability

### Goal

Finish the canvas-first interaction model: move details/work content into a floating three-state overlay, make tool actions icon-first with explanatory tooltips, and repair the P7 focused-Flow readability failure.

### Shared inspection overlay

Create a presentation-only overlay shell inside the canvas stage.

States:
- **expanded** — full available inspection/work detail;
- **compact** — selected identity/coverage summary plus primary contextual actions;
- **minimized** — tiny recoverable affordance/chip retaining current selection/context.

Overlay state is widget/presentation state. No persistence is required by this correction.

Overlay state transitions must not:
- clear selection;
- change focus;
- change trace direction;
- clear selected Flow edge;
- trigger a Flow query merely because the overlay changed;
- change `mapFitContext`;
- call `fitView`;
- alter React Flow nodes/edges or canonical/planning state.

### Flow inspection

Move the current `flowPanel` contents into the overlay:
- coverage/truncation summary;
- diagnostics;
- visible participant list;
- visible edge list;
- selected edge details;
- origin Flow facts/evidence;
- unresolved data semantics;
- Open edge source.

Preserve accessible alternate participant/edge selection in expanded mode.

When a Flow node/edge is selected, the overlay may open/compact automatically if useful, but it must never obscure the fact that the selection remains on the map.

### Planning work/details

Move the existing `workPanel` rich details into the same overlay shell when Planning mode is active.

Do not change:
- PlanningMap selection;
- transformation/work-item semantics;
- Current/Target/Diff;
- stale/conflict/reconciliation behavior.

Planning creation/edit dialogs may remain dialogs. Only the persistent details surface is reorganized.

### Icon-first toolbar

Convert applicable tool buttons to codicon/icon controls using the Theia icon seam already imported by the widget.

Every icon-only control must have:
- `title` or equivalent visible hover tooltip text;
- `aria-label`;
- native button keyboard operation;
- disabled state where appropriate;
- pressed/selected state where applicable;
- focus-visible styling;
- meaning not dependent on color alone.

Use familiar icons for navigation/zoom/source/tab/trace where available.

For Dope-specific or potentially ambiguous actions, tooltip text must explain the action, e.g. `Trace downstream — follow evidenced execution from the selected participant`.

Architecture/Flow may remain an explicit compact segmented mode control if icon-only representation would be ambiguous; the product law is icon-first, not icon-at-all-costs.

### Readability repair

Fix the direct P7 failure where focused Flow is too dim to read immediately.

Required:
- selected/traced Flow remains full-strength;
- subdued context remains visibly readable instead of effectively disappearing;
- edge text/background remains legible;
- focus/selection uses outline/weight/shape in addition to color;
- coverage/diagnostic overlay text meets the same theme-token discipline;
- Dope Dark and compatible alternate themes remain usable.

The current `opacity: .45` context rule may be revised. Prefer a centralized theme-aware visual grammar rather than hard-coded brand colors.

Do not change the Flow projection's `subdued` semantic flag.

### Overlay placement

Default placement should avoid covering the center of the current graph where practical, e.g. a bounded top/right or bottom/right floating card.

The overlay must:
- have bounded width/height;
- scroll internally when expanded;
- remain above the graph but below global dialogs/menus;
- not resize the React Flow canvas;
- remain usable at typical narrow center widths.

Do not implement draggable/dockable panel architecture unless it is already trivial; it is not required.

### Tests

Add permanent presentation regressions proving:
- expanded/compact/minimized state transitions retain selected Flow participant/edge and controller focus/trace;
- overlay state does not change fit context or call fit;
- Flow details/source action remain present in expanded mode;
- Planning work detail uses the overlay without changing Planning data;
- icon-only controls have tooltip/title + aria-label;
- toolbar controls remain keyboard-native and focus-visible;
- no duplicate permanent Flow/details bar remains;
- subdued Flow styling remains theme-based and perceptible;
- selected Flow has stronger non-color cue;
- alternate-theme variables are used;
- left sMap inspector source remains untouched as authority.

### Validation — T2

Run:
- `npm run build:extension`;
- `node --test test/unit/physical-map-canvas.test.ts test/unit/physical-map-navigation.test.ts test/unit/physical-map-flow-ui.test.ts test/unit/planning-map-ui.test.ts test/unit/smap-readability.test.ts test/unit/dope-theme.test.ts`;
- new overlay/toolbar tests;
- `npm run build:browser`;
- `git diff --check`;
- package-version/no-root-lock checks.

Do not run AppImage packaging or native qualification.

## P3 — Direct browser qualification and correction closeout

### Goal

Prove the exact `0.6.7` correction candidate in the real Dope GUI against a fresh disposable Adaptive SEO workspace, close this correction Green/Not Green, then route back to P7.

### Preflight

Require:
- activation source `561ad62678f6e20a6da21b3537d136290d07f0e3` reachable;
- P1/P2 focused evidence Green;
- package exactly `0.6.7`;
- clean intended candidate;
- original P7 Not Green evidence preserved;
- `c6-flow-overview-priority` history preserved.

Create a fresh disposable copy from:

`/home/jfin/dev/adaptive-seo-dope`

Use the same accepted `.dope/` state. Do not regenerate/reaccept architecture merely for this correction.

### Automated T3 gate

Run once on the exact candidate:
- correction-focused map tests;
- `npm run check`;
- `git diff --check`;
- package-version/no-root-lock checks;
- `npm run codex:phase:validate -- c6-map-canvas-priority` if the current correction validator supports unchanged-version stacks.

Do not package the AppImage for this correction solely to revisit the already-known controlled-shutdown defect.

### Direct GUI evidence

Prove all of the following.

1. **Canvas-first shell**
   - Architecture and Flow each open with the diagram visibly dominating the center tab.
   - No large details band sits above the diagram.
   - There is one compact Dope-owned toolbar; no second React Flow controls cluster.

2. **Toolbar**
   - zoom in/out/fit work;
   - Up / Focus / source / open-tab behavior still works when applicable;
   - Architecture/Flow switching works;
   - Flow trace downstream/upstream/clear works;
   - icon controls show descriptive hover tooltips and keyboard focus/activation;
   - disabled/pressed state remains understandable without color.

3. **Overlay**
   - select representative Flow participant and edge;
   - inspect expanded details/evidence/source;
   - change expanded -> compact -> minimized -> expanded;
   - selection, focused Subsystem and trace direction survive;
   - minimizing/restoring does not visibly re-layout/refit the graph.

4. **Real Adaptive SEO trace**
   - reproduce the intended GET opportunities behavior exposed after the overview correction;
   - HTTP Input -> handler -> `AdaptiveRepository.list` -> three PostgreSQL reads -> three response branches;
   - representative source evidence remains inspectable;
   - partial coverage remains explicit.

5. **Immediate readability**
   - focused Subsystem Flow is readable immediately on Dope Dark;
   - traced/selected path is clear;
   - unrelated/subdued context remains perceptible;
   - labels/edge labels remain readable.

6. **Alternate theme**
   - switch to a compatible non-Dope theme and recheck toolbar, overlay, selected path and subdued context.

7. **Architecture round trip**
   - Flow -> Architecture -> Flow preserves intended focus/selection context as before.

8. **Planning presentation regression**
   - open the available Planning Map surface;
   - confirm the unified shell does not break Current/Target/Diff or Planning controls;
   - rich work details use the overlay rather than permanently shrinking the canvas;
   - no presentation action changes Planning data.

### Tiny-fix allowance

One bounded directly observed presentation repair is allowed for:
- toolbar spacing/icon choice;
- tooltip wording;
- overlay size/placement;
- focus-visible styling;
- Flow opacity/contrast;
- minor responsive behavior.

After a tiny fix:
- update the permanent regression;
- rerun only the smallest invalidated build/test;
- recheck the affected GUI surface.

Do not use this allowance for Flow query/extraction changes, controller ownership redesign, Planning domain changes or native shutdown repair.

### Closeout

Write:
`docs/tasks/c6-map-canvas-priority/closeout.md`

Update:
`docs/tasks/c6-map-canvas-priority/README.md`

Record:
- activation source;
- exact candidate SHA;
- P1/P2 evidence;
- automated T3 evidence;
- direct GUI observations;
- tiny fix if any;
- residual gaps;
- Green / Not Green decision.

If Green:
- route back to Phase 6 P7 requalification;
- explicitly state that P8 remains blocked until P7 itself is Green;
- carry forward the packaged AppImage controlled-shutdown failure as a separate P7 blocker.

If Not Green:
- keep P7/P8 blocked and identify the narrow failed presentation contract.

## Expected production shape

```text
PhysicalMapWidget
  one compact map toolbar
  canvas stage
    React Flow canvas
    compact map status/orientation
    selected-object/work inspection overlay
      expanded | compact | minimized

PhysicalMapController
  unchanged architecture/Flow authority

PlanningMapController
  unchanged planning authority
```

No domain schema or persistence change is expected.
