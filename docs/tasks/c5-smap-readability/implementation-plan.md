# Correction 5 Implementation Plan — sMap Readability

Status: **APPROVED PLAN / BLOCKED ON P11 GREEN**
Correction folder: c5-smap-readability
Required unchanged package version: 0.5.11
Assessment: prompt-assessment.md

## Shared invariants

- Physical Map remains evidence-backed current implementation.
- Canonical architecture remains developer authority.
- Planning Map remains target intent.
- Canvas projection/layout/filter/color state is presentation only.
- No model/provider is needed.
- No Data Flow concepts are introduced.
- The same stable architecture identity drives Physical and Planning Map presentation.
- A displayed identity is always complete.
- Color never carries exclusive meaning.

## P1 — Projection readability core

### Goal

Make semantic detail and relationship disclosure explicit and deterministic in the presentation projection/controller without involving React Flow viewport APIs yet.

### Presentation model

Introduce a browser-only semantic detail concept, preferably a compact type such as:
- overview;
- architecture;
- implementation.

Keep it out of Software Map and Visual Planning domain contracts.

The default detail supplied by callers remains architecture.

### Bounded semantic detail

Use focus depth to prevent project-wide explosion.

Required behavior:
- **Project / overview:** Systems only.
- **Project / architecture or implementation:** Systems + immediate Subsystems. Do not reveal every Component/Code entity globally.
- **Focused System / overview or architecture:** System + immediate Subsystems.
- **Focused System / implementation:** reveal Components beneath the visible Subsystems while preserving System/SubSystem containment.
- **Focused Subsystem / overview or architecture:** Subsystem + immediate Components.
- **Focused Subsystem / implementation:** reveal bounded Code roots beneath visible Components.
- **Focused Component:** Component + its Code children; closer detail may expose the available Code children but must not recursively explode unrelated code.
- Existing unassigned/detected-only treatment remains visible at the appropriate project level.

If the actual graph topology makes a slightly different bounded rule materially cleaner, preserve the principle: zooming deeper only expands the current architectural context, never the whole repository.

### Readable geometry

Move fixed-size assumptions toward deterministic text-aware sizing.

Node width/height must allow the complete visible name/identity to wrap. Account for:
- long System names;
- long Subsystem/Component names;
- code/file/module-like names;
- nested children.

Prefer deterministic layout helpers in physical-map-projection.ts over DOM measurement in domain code.

### Relationship-on-demand

Containment edges are always part of the hierarchy projection.

Dependency behavior:
- project overview/default must not draw all visible dependency edges continuously;
- focused views retain simplified cross-boundary dependency context required by Phase 5;
- selected architecture promotes its incident dependency neighborhood;
- selected-node outside endpoints may appear as context nodes when required to make the relationship intelligible;
- unrelated dependency edges remain hidden or subdued;
- dependency labels are shown only when they aid the selected/focused relationship context.

Do not invent data-flow verbs. Stay within existing deterministic relationship kinds/evidence.

### Controller changes

PhysicalMapController must treat selectedId as an input to relationship projection/query.

Update its loaded/query key or equivalent so selecting a node can fetch the selected node's relevant incoming/outgoing relationships.

Keep:
- generation/project race guards;
- workspace isolation;
- shared selection;
- focus/up/fit;
- source navigation.

Do not broaden queries to the whole graph.

### Planning projection

Update projectPlanningMap to pass/use the new presentation options so Current/Target/Diff remain readable at the same semantic detail and selection context.

Do not change PlanningMap data or transformation logic.

### Tests

Extend physical-map-canvas.test.ts and physical-map-navigation.test.ts to prove:
- project overview Systems-only;
- default architecture Systems + Subsystems;
- focused deeper detail is bounded and identity-stable;
- project-wide implementation detail does not explode Components/Code;
- selection promotes only its relevant dependency neighborhood;
- focused cross-boundary context remains;
- selection-only changes refresh required relationship queries;
- long names increase/readjust projection geometry rather than being shortened;
- no domain/service contract gains presentation fields.

Update planning-map-ui.test.ts for shared projection options as needed.

### Validation

T1 only:
- npm run build:extension;
- node --test test/unit/physical-map-canvas.test.ts test/unit/physical-map-navigation.test.ts test/unit/planning-map-ui.test.ts;
- git diff --check;
- package version/no-root-lock checks.

Do not run browser/manual/aggregate qualification.

## P2 — React Flow semantic zoom and readable renderer

### Goal

Connect React Flow viewport scale to the P1 semantic detail model, remove label truncation, prevent zoom/LOD fit loops, and strengthen map orientation/visual grammar.

### Semantic zoom mechanics

Do not use absolute React Flow zoom thresholds that can make an initial Fit Architecture unexpectedly open at the wrong semantic level on differently sized maps.

Preferred behavior:
1. Fit/open/focus establishes the current fitted zoom as the architecture baseline.
2. Compare user viewport zoom to that baseline.
3. a substantial zoom-out requests overview;
4. the baseline range requests architecture;
5. a substantial zoom-in requests implementation.

Keep thresholds centralized and hysteretic/debounced enough to prevent flicker around a boundary.

The exact constants are implementation details, but tests must cover transitions.

### No snap-back

Refactor current renderedGraph/fitView logic.

Auto-fit is allowed for:
- initial usable graph;
- explicit Fit Architecture;
- Focus/Up navigation when that operation intentionally establishes a new context;
- project/tab initialization.

Auto-fit is **not** allowed merely because a semantic LOD transition added/removed nodes while the user was zooming.

A semantic detail transition must preserve the current viewport center/scale as far as React Flow permits.

### Complete labels — K7MX

Remove the current truncation rules:
- no text-overflow: ellipsis for map identity;
- no white-space: nowrap for map identity;
- no parent overflow rule that clips the identity.

Render complete text.

Use:
- normal wrapping;
- overflow-wrap/word-break appropriate to names;
- path-aware break opportunities where practical;
- the text-aware geometry from P1.

Do not alter the underlying identity string to fit.

A tooltip may supplement, never replace, complete rendered text.

### Visual grammar

Keep:
- System stronger frame;
- Subsystem contained frame;
- Component/card distinction;
- Code implementation styling;
- realization/drift/unassigned/planning states.

Improve selected/focused relationship emphasis without using color as the only cue.

Outside-focus context should remain visibly secondary through border/opacity/shape semantics while remaining readable.

### Orientation and inspector synchronization

Keep the existing breadcrumb nav and make its context unambiguous:
Project / System / Subsystem / Component as applicable.

Breadcrumb actions continue to focus exact stable IDs.

Selection must keep the left sMap inspector synchronized. Do not duplicate all evidence into the canvas.

### Planning Map

Physical and Planning Map modes use the same semantic LOD and full-label renderer.

Ensure planned add/modify/remove/move/contract, stale and conflict classes remain visible and not overridden by the readability styling.

### Tests

Add a focused permanent readability renderer test, e.g. test/unit/smap-readability.test.ts, and wire it into test:product.

Prove:
- map CSS contains no ellipsis/nowrap/clipping path for visible identity text;
- rendered node text uses the full item.name;
- path-aware/wrap behavior preserves all characters;
- semantic detail changes are driven by relative baseline zoom or equivalent robust logic;
- LOD-only graph changes do not trigger fitView;
- explicit Fit Architecture still does;
- breadcrumbs remain stable;
- alternate semantic theme variables are used rather than hard-coded background/text colors;
- Planning Map state classes remain intact.

### Validation

T2:
- npm run build:extension;
- node --test test/unit/physical-map-canvas.test.ts test/unit/physical-map-navigation.test.ts test/unit/planning-map-ui.test.ts test/unit/software-map-ui.test.ts test/unit/smap-readability.test.ts;
- npm run build:browser;
- git diff --check;
- package version/no-root-lock checks.

Do not perform manual browser qualification yet.

## P3 — Project-scoped selectable node colors

### Goal

Implement +F6QK as restart-persistent, theme-aware, nonsemantic presentation state.

### Storage boundary

Create a small browser-only presentation state module/controller rather than adding color to SoftwareMapController domain state.

Preferred ownership:
- packages/theia-extension/src/browser/smap-presentation-state.ts;
- singleton binding in frontend-module.ts;
- Theia StorageService backing.

Persist a versioned object keyed by project/workspace with:
- node ID -> palette key.

Default/reset removes the node override.

Do not:
- write .dope files;
- add backend/RPC methods;
- add fields to graph/architecture/planning DTOs;
- include colors in physical input fingerprints or Planning Map basis.

Stale stored IDs may be ignored safely. They are presentation debris, not a migration failure.

### Palette

Use a small fixed palette plus Default.

Prefer semantic/theme tokens for accents, e.g. focus/chart token families, and derive a subtle surface tint if supported. Text remains theme foreground.

Do not override meaning-bearing drift/conflict/planning border semantics. Color should be a background/accent reinforcement layer underneath those state cues.

No custom hex picker in this correction.

### UI

When a real architecture node is selected, expose a compact color selector in the Physical/Planning Map toolbar or another existing map presentation control.

Requirements:
- current color shown;
- immediate update;
- Default/reset;
- disabled when no valid selected map identity;
- selection applies to the same identity in Physical and Planning projections;
- planned future node IDs may use the same presentation mechanism when visible.

### Persistence/race behavior

Project/workspace switch must not leak colors between projects.

Late async StorageService reads must not paint the new project with the old project's preferences.

Restart/reopen in the same Dope profile/project restores colors.

### Tests

Add test/unit/smap-presentation-state.test.ts or equivalent and wire it into test:product.

Prove:
- schema/versioned storage key;
- workspace/project isolation;
- reset removes override;
- late old-project load is ignored;
- only palette keys are persisted;
- no .dope/domain/service contract receives color;
- Physical and Planning node renderer consumes the same identity-based presentation lookup;
- CSS uses theme-aware tokens and does not erase state classes.

### Validation

T1:
- npm run build:extension;
- node --test test/unit/smap-presentation-state.test.ts test/unit/smap-readability.test.ts test/unit/planning-map-ui.test.ts;
- git diff --check;
- package version/no-root-lock checks.

Do not run npm test or browser qualification.

## P4 — Direct browser qualification and closeout

### Goal

Prove the exact 0.5.11 correction candidate in the real Dope browser UI against the accepted Adaptive SEO mapped workspace, then close Green/Not Green.

### Preflight

Require:
- README activation source recorded;
- Phase 5 P11 Green;
- P1-P3 exact candidate;
- package exactly 0.5.11;
- no unexpected product-source drift.

Create a disposable copy of /home/jfin/dev/adaptive-seo-dope for direct interaction. Do not regenerate accepted architecture merely for this correction.

### Automated gate

Run once:
- correction focused unit tests;
- npm run check;
- git diff --check;
- version/no-root-lock;
- npm run codex:phase:validate -- c5-smap-readability if applicable to an activated correction folder.

Do not rerun broad validation after tiny visual changes unless those changes could invalidate it.

### Browser evidence

Open Dope browser on the disposable Adaptive SEO copy.

Prove:
1. Default view is understandable as Systems + immediate Subsystems.
2. Zooming far out reaches the simpler semantic view without truncation.
3. Zooming in within focus reveals bounded deeper detail without dumping the entire repository.
4. Crossing LOD thresholds does not auto-fit/snap back.
5. Focus, Up, Fit Architecture and breadcrumbs preserve orientation.
6. Selecting a node promotes its relevant dependency neighborhood; unrelated edges do not become a spiderweb.
7. Focused cross-boundary dependency context remains intelligible.
8. Left inspector follows selection and exposes purpose/relationships/evidence/source navigation.
9. Representative long names/paths render in full. Use existing long identities where available; automated K7MX coverage remains the authoritative exhaustive proof.
10. Planning Map Current/Target/Diff still shows planned/stale/conflict semantics at the same LOD.
11. Select at least two different node colors, verify labels and state cues remain readable, reload/reopen, verify persistence, reset one to Default.
12. Open/switch to an alternate compatible theme and verify hierarchy, labels, selection and color accents remain readable without color being the only distinction.

### Tiny-fix allowance

P4 may apply one bounded directly observed presentation correction limited to:
- zoom threshold/hysteresis;
- CSS wrapping/spacing;
- context/edge emphasis;
- palette token/contrast;
- small toolbar/breadcrumb behavior.

After a tiny fix, rerun the smallest affected focused tests/build and recheck that exact surface.

If the defect requires projection/domain redesign, new persistence architecture, Data Flow, provider behavior or broad Planning semantics, close Not Green instead.

### Closeout

Write docs/tasks/c5-smap-readability/closeout.md and update README status.

Record:
- activation source;
- exact candidate;
- P1-P3 evidence;
- T3 automated result;
- direct browser observations;
- any tiny P4 fix;
- residual gaps;
- final Green / Not Green.

Do not modify known-issues.md or feature-ideas.md automatically. If Green, report that K7MX and +F6QK are eligible for the explicit /resolve workflow.

### Exit routing

If Green:
- correction closes Green/Qualified at unchanged 0.5.11;
- resume Phase 5 P12 closeout;
- Phase 6 remains blocked until P12 establishes the 0.6.0 successor baseline;
- no Phase 6 code is implemented here.

If Not Green:
- keep P12 and Phase 6 blocked;
- identify the narrow readability defect and strongest evidence.
