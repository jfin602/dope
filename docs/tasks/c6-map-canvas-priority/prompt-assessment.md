# Correction 6 Prompt Assessment — Map Canvas Priority

Status: **APPROVED / READY**
Correction folder: `c6-map-canvas-priority`
Required unchanged package version: `0.6.7`
Activation/docs authority source: `561ad62678f6e20a6da21b3537d136290d07f0e3`

## Conclusion

Use exactly three prompts.

1. **P1 — canvas-first map workspace shell (T2).** Refactor the current stacked Physical/Flow/Planning presentation into one compact map toolbar plus a maximized canvas, while preserving the existing controllers, map state, semantic zoom and query behavior.
2. **P2 — inspection overlay, icon controls and readability (T2).** Move Flow/Planning inspection out of permanent vertical layout, add expanded/compact/minimized overlay behavior, replace applicable text buttons with icons/tooltips, and repair the focused-Flow contrast/readability failure.
3. **P3 — direct Adaptive SEO browser qualification + correction closeout (T3).** Prove the exact `0.6.7` candidate in the real Dope GUI, record Green/Not Green, and route back to P7. Native AppImage controlled shutdown remains a separate P7 blocker.

Do not advance the package version. The correction is presentation-only and does not replace the existing P7 qualification gate.

## Current-source findings

### The canvas is structurally starved by normal-flow UI

`physical-map-widget.ts` currently appends, in order:

`header -> planningBar -> workPanel -> flowBar -> flowPanel -> breadcrumbs -> status -> canvas`.

All of those elements participate in normal layout before the React Flow canvas. In Flow mode the `.dope-flow-panel` alone may consume up to 190px; Planning work may consume up to 210px. This directly conflicts with the new canvas-first product law.

The correct seam is the existing browser widget/CSS layer. Do not move layout state into `@dope/software-map`, `@dope/visual-planning` or Flow query DTOs.

### Map controls are fragmented across multiple control surfaces

The main header currently owns:
- Planning Map toggle;
- Architecture / Flow mode buttons;
- Up;
- Focus;
- Open Selected Tab;
- Open Source;
- Fit Architecture;
- node color.

Flow mode separately creates:
- Trace downstream;
- Trace upstream;
- Clear trace;
- Static Flow status.

Planning mode separately creates its own planning bar.

React Flow also renders its built-in `Controls`, creating another visual tool cluster.

P1 should establish one Dope-owned map toolbar and eliminate the duplicate React Flow control cluster by routing zoom/fit behavior through the same toolbar where practical.

### The existing widget already has the right state owners

`PhysicalMapController` already owns:
- architecture/flow mode;
- focus/up/fit;
- shared selection;
- Flow selection/trace;
- edge inspection;
- project/generation/mode/focus/trace race guards.

`PlanningMapController` already owns Planning Map state.

`MapViewport` already owns semantic zoom baseline/hysteresis.

The correction should reorganize presentation around these owners, not introduce another map service or state authority.

### The Flow details pane is the immediate P7 problem

`renderFlow()` currently places all of the following above the canvas:
- coverage/truncation;
- per-scope coverage;
- diagnostics;
- all visible participants;
- the full visible edge list;
- selected edge evidence/details;
- Open edge source.

Those are valid inspection capabilities but are not required to reserve permanent vertical space. P2 should keep the information and source actions while moving it into a floating inspection overlay.

The expanded overlay may retain participant/edge lists as an accessible alternate selection route. Compact/minimized states should preserve the current selected participant/edge and coverage state without keeping the full list visible.

### Planning work is also presentation-heavy

`workPanel` is another persistent normal-flow details surface. Because the product law is map-canvas-first, P2 should reuse the same overlay shell for Planning work/details when Planning mode is active, while leaving Planning domain/edit semantics unchanged.

Planning-specific map-global controls may join the unified toolbar. Rich work details belong in the overlay rather than another permanent row.

### Current readability regression is identifiable

The existing Flow context rule uses `.dope-flow-subdued { opacity: .45; }`.

The recent P7 requalification found the focused Subsystem canvas too dim to read immediately. P2 should tune the Flow visual grammar so:
- selected/traced path is full-strength and unmistakable;
- subdued context remains clearly perceptible;
- labels and edges remain readable under Dope Dark and supported alternate themes;
- state is not carried by color/opacity alone.

Do not perform a broad brand/theme redesign.

### Existing tests already cover the important semantic boundaries

Relevant focused regressions:
- `physical-map-canvas.test.ts`;
- `physical-map-navigation.test.ts`;
- `physical-map-flow-ui.test.ts`;
- `flow-map-projection.test.ts`;
- `planning-map-ui.test.ts`;
- `smap-readability.test.ts`;
- `smap-presentation-state.test.ts`;
- `dope-theme.test.ts`.

Add a focused map-workspace presentation regression if useful rather than pushing layout assertions into domain tests.

## Decomposition rationale

P1 owns structure and toolbar consolidation because canvas sizing/React Flow lifecycle can regress independently of inspection content.

P2 owns overlay state, icon affordances and contrast because these are interaction/readability concerns and need explicit permanent tests around state preservation and no-reflow behavior.

P3 concentrates expensive GUI evidence into one manual gate. It does not repeat P7 native packaging because the known controlled-shutdown failure is explicitly outside this correction.

## Validation allocation

### P1 — T2

Run:
- `npm run build:extension`;
- focused Physical/Flow/Planning map UI tests;
- `npm run build:browser`;
- `git diff --check`;
- package-version/no-root-lock checks.

No manual browser evidence yet.

### P2 — T2

Run:
- P1 focused map UI tests;
- new overlay/toolbar/readability regressions;
- `smap-readability.test.ts`;
- `dope-theme.test.ts` if theme CSS changes materially;
- affected extension + browser build;
- `git diff --check`;
- package-version/no-root-lock checks.

Do not run packaging/native qualification.

### P3 — T3

On the exact candidate:
- run the correction-focused suite;
- run `npm run check` once;
- run `git diff --check`;
- verify package remains exactly `0.6.7`;
- direct browser qualification against a fresh disposable copy of `/home/jfin/dev/adaptive-seo-dope`.

Do not require AppImage packaging/controlled shutdown for this correction. Record that P7 remains blocked on that separate release/process issue even if this correction closes Green.

## Material-gate rule

Return Planning only if current source invalidates the approved presentation seam—for example the center map is no longer owned by `PhysicalMapWidget`, React Flow has been replaced, or satisfying the request requires changing Flow/domain semantics.

Ordinary line drift, icon choice, CSS mechanics, toolbar ordering or small component extraction are implementation details.

## Green definition

Green requires:
- exactly one compact Dope-owned map toolbar for map-global controls in the active map mode;
- no second React Flow control cluster;
- Architecture/Flow diagram gets the maximum practical center area;
- center inspection/work details no longer reserve a large permanent band above the diagram;
- inspection supports expanded/compact/minimized states;
- overlay-state changes preserve selection/focus/trace/source context and do not trigger unnecessary fit/re-layout;
- applicable tool actions are icon-first with descriptive tooltip, accessible name, keyboard operation and non-color state;
- focused Flow is immediately readable under Dope Dark and a compatible alternate theme;
- left sMap inspector authority is unchanged;
- Flow truth/query semantics and Planning domain semantics are unchanged;
- package remains `0.6.7`.
