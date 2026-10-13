# c6-smap-outline closeout

Result: **Green for this bounded correction** (2026-10-02). This does not change the retained Phase 6 P7 Not Green result, the map-canvas P3 history, or the P8 block.

## Candidate and scope

- Pre-task HEAD: `979c95b887e03d777feb53815436c71ae99749cd` with a clean Dope worktree.
- Final implementation candidate: `ac7fd5a29fb9d6dca4fc2f137f8fdef7f2a20439`.
- Root, live workspace packages and internal `@dope/*` dependencies remain exactly `0.6.7`; no root `package-lock.json` was introduced.
- Changed: `packages/theia-extension/src/browser/software-map-widget.ts`, `software-map-outline.ts`, `dope.css`, `test/unit/software-map-outline.test.ts`, this README and this closeout.
- The inspector now renders separate disclosure and selection controls with type-first, wrapping labels. Expansion remains widget-local, starts closed, and reveals only the selected node's missing ancestors. The existing `SoftwareMapController.selectedId` remains the sole architecture selection owner. Initialized top actions are compact. Existing detail, relationship, evidence, source and diagnostic paths remain in place.

## Focused automated evidence

- `npm run build:extension`: passed.
- `corepack yarn workspace @dope/browser build`: passed with zero build errors.
- Directly affected Software Map UI, Physical Map navigation, sMap placement, Dope theme and new outline tests: **41 passed, 0 failed**.
- The new tests cover type-first labels, full file paths, closed initial state, ancestor reveal that preserves unrelated expansion, shared selection wiring, distinct accessible controls, compact actions, wrapping styles and presentation-only expansion state. No domain contract or project persistence file changed.
- `git diff --check`: passed. Version and root lockfile checks passed.

## Targeted browser GUI evidence

Replayed the built Dope browser against `/home/jfin/dev/adaptive-seo-dope` using its existing accepted architecture. Refresh Software Map published generation 1 with 4,419 nodes, partial analysis and zero violations. No architecture regeneration or acceptance was performed.

- Fresh Architecture showed two collapsed Systems as compact text rows. The unassigned count remained visible. The hierarchy had no wall of filled orange architecture buttons. The top actions remained available and visually secondary; Open Physical Map and Refresh Software Map both worked.
- Clicking a System disclosure expanded it without selecting it. A sidebar Subsystem selection produced its detail, outgoing and incoming relationships, and evidence buttons. The same selection was observed on the center Physical Map. Keyboard Space operated the disclosure while the previous selection stayed unchanged.
- Selecting Customer Site Feed Runtime on the center map selected its inspector row and scrolled it into view while a manually expanded Adaptive SEO Service branch remained open. Selecting Customer PHP Feed Rendering on the map opened the missing Customer Site Feed Runtime ancestor, selected the Subsystem row and scrolled it into view; the unrelated branch stayed open.
- File paths in the narrow inspector wrapped instead of being cut off. The selected row had a background plus a left border and heavier text. In Dark (Theia), the selected row used a readable white foreground on a dark blue selection background with a blue left border. Dope Dark was restored after the check.
- Selected node purpose, incoming/outgoing relationships and evidence remained visible. Activating a declaration evidence button opened `.dope/architecture.json` in the editor. Partial-analysis status and the zero-violations summary remained visible.

## Bounded presentation repair and limits

The first GUI pass exposed 98 unassigned roots filling the fresh inspector below Architecture. One presentation repair put this list behind a collapsed native disclosure while retaining access and selected-path reveal. The affected extension/browser builds, 41 focused tests and GUI surface were replayed successfully after the repair.

No actual architecture violation was present to inspect in this reference map. The initialized workspace did not exercise setup, synthesis or review screens; their controls were left on the existing action-button path and covered by focused source assertions. The GUI replay reached a deep Subsystem selection, but did not observe a Component or code selection from the center map. These are evidence limits for this correction, not new Green claims for wider Phase 6 qualification. No AppImage or full Phase 6 qualification matrix was run for this T2 correction.
