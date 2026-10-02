# Correction 5 Prompt Assessment — sMap Readability

Status: **APPROVED PLAN / BLOCKED ON ACTIVATION**
Correction folder: c5-smap-readability
Required unchanged package version after activation: 0.5.12
Docs authority source: 312972ef8143eefe1bd0c5a400fa0f89dfe2856a

## Conclusion

Use exactly four prompts.

1. **P1 — projection readability core (T1).** Make semantic detail and relationship disclosure explicit in the browser presentation model/controller. Preserve map/domain contracts.
2. **P2 — readable React Flow integration (T2).** Tie semantic detail to bounded viewport/focus behavior, remove label truncation, prevent LOD-triggered auto-fit snap-back, and strengthen orientation/visual grammar.
3. **P3 — project-scoped node colors (T1).** Add the curated selectable palette through a separate presentation-state seam backed by Theia StorageService.
4. **P4 — browser qualification + closeout (T3).** Exercise the exact candidate on a disposable copy of the accepted Adaptive SEO mapped workspace and close only on direct readability evidence.

Do not execute until the README records the exact Phase 5 P12 closeout activation commit at 0.5.12.

## Source findings

### Projection is already cleanly separated from domain state

physical-map-projection.ts owns disposable CanvasNode / CanvasEdge geometry and state. The Software Map graph contracts do not contain React Flow geometry.

That is the correct seam for semantic detail and relationship presentation. Do not add zoom/focus/color fields to @dope/software-map or @dope/visual-planning domain contracts.

### Current semantic navigation exists, but geometric zoom is not semantic

physical-map-controller.ts already provides:
- shared selection;
- focus;
- up;
- fit;
- breadcrumbs;
- source navigation.

physical-map-projection.ts currently renders:
- project: Systems + immediate Subsystems;
- focused node: focus + immediate children;
- focused outside dependency context.

physical-map-widget.ts uses React Flow geometric zoom but does not translate viewport zoom into a semantic detail level.

### Current dependency rendering is noisier than the new contract

projectPhysicalMap currently adds aggregate dependency edges among visible architecture by default, and focused projection gathers dependency context around the focus/children.

The new contract should keep containment quiet, keep simplified cross-boundary focus context, and promote the selected node's dependency neighborhood rather than continuously presenting every visible dependency.

### Selection refresh currently cannot drive relationship-on-demand by itself

PhysicalMapController.loadedKey currently includes workspace/generation/node counts/violations/focus, but not selectedId. A selection-only change therefore can render shared selection without necessarily refreshing relationship queries for the selected architecture node.

P1 should make selection an explicit dependency of the relationship projection/query path.

### The inspector already provides the deterministic explanation surface

software-map-widget.ts already renders selected-node:
- name/kind/ID;
- purpose;
- source/ownership for code;
- incoming relationships;
- outgoing relationships;
- evidence;
- originating physical edges;
- source navigation.

Do not create an AI Explain This implementation. The correction needs to keep canvas selection and this inspector synchronized and readable.

### The current CSS directly violates K7MX

dope.css currently contains:
- .dope-map-node { ... overflow: hidden; ... }
- .dope-map-node strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

This must be removed/replaced. A tooltip is not an acceptable substitute.

The projection currently uses fixed node dimensions, so CSS-only wrapping can still clip text. Geometry/layout must be allowed to grow with display text.

### Current auto-fit will fight true semantic LOD

physical-map-widget.ts builds renderedGraph from focus + rendered node IDs and automatically calls flow.fitView whenever that graph key changes.

If semantic zoom reveals/hides nodes, using the same key rule would immediately refit after a zoom-driven LOD transition and can snap the viewport back.

P2 must separate:
- initial/focus/up/explicit Fit Architecture navigation;
from:
- semantic-detail node-set changes caused by the user's current viewport.

LOD changes must not invoke Fit Architecture automatically.

### Planning Map reuses the Physical projection

planning-map-projection.ts calls projectPhysicalMap for Current/Target/Diff bases.

Readability changes must therefore be carried through Planning Map projections without changing planned intent markers, stale/conflict markers, target identity or transformation semantics.

### StorageService is already available in the browser composition

frontend-module.ts already resolves Theia StorageService for synthesis preferences.

Do not reuse SoftwareMapController as a bag for map appearance. Create a small browser-only sMap presentation-state controller/store and inject it into the map widget.

Recommended initial persistence:
- one versioned workbench storage key;
- project/workspace key;
- node ID -> curated palette key;
- Default removes the override;
- no .dope file;
- no analyzer/backend/service changes.

This gives restart persistence while keeping colors outside architecture/evidence/planning truth.

## Decomposition rationale

P1 and P2 are separated because projection semantics and React Flow viewport mechanics fail differently and should have independent permanent tests.

P3 is separate because persistence/theme behavior is independent from semantic zoom and can be implemented/tested without reopening graph logic.

P4 concentrates expensive integrated/browser evidence into one gate.

## Validation allocation

### P1 — T1
Run only:
- build:extension as required for compiled test imports;
- physical-map-canvas.test.ts;
- physical-map-navigation.test.ts;
- planning-map-ui.test.ts if projection signatures/behavior affect it;
- git diff --check;
- version/no-root-lock checks.

### P2 — T2
Run:
- P1 focused tests;
- new readability renderer/static test;
- software-map-ui.test.ts if inspector synchronization changes;
- planning-map-ui.test.ts;
- affected extension build;
- browser build because React Flow/runtime composition changed;
- git diff --check.

No manual browser evidence yet.

### P3 — T1
Run:
- focused presentation-state/color test;
- readability renderer test;
- planning-map-ui.test.ts if shared color identity is covered there;
- affected extension build;
- git diff --check.

Do not run npm test merely because persistence was added.

### P4 — T3
Run the correction's focused automated suite plus npm run check once on the exact candidate, then direct browser evidence on a disposable Adaptive SEO copy.

No Linux package/native AppImage gate is required unless P1-P3 unexpectedly change packaging/composition beyond the normal browser extension seam.

## Material-gate rule

Return Planning needed only if current 0.5.12 source after Phase 5 closeout materially invalidates these seams—for example React Flow is replaced, the map presentation boundary is redesigned, or Phase 5 closeout changes the shared selection/projection ownership model.

Ordinary line drift, test renames or small layout differences are implementation details, not a reason to replan.

## Green definition

Green requires all README exit behaviors plus explicit proof that:
- map presentation changes do not alter graph/domain payloads;
- semantic LOD cannot force a fit loop;
- K7MX has a permanent regression guard;
- selectable colors are nonsemantic, project-scoped workbench presentation state;
- Planning Map intent/stale/conflict visuals remain distinguishable;
- alternate theme remains readable;
- package remains exactly 0.5.12.
