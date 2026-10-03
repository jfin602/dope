# Correction 6 — sMap Outline

Status: **APPROVED / READY FOR IMPLEMENTATION PLANNING**
Correction folder: `c6-smap-outline`
Required unchanged package version: `0.6.7`
Date approved: 2026-10-02
Phase context: Product Phase 6 P7 Not Green / P8 blocked
Authority: ADR 0008, ADR 0016, current Phase 6 plan, ARCHITECTURE, PRODUCT-MODEL, workflow, and retained Phase 6 evidence

## Purpose

Turn the left Software Map inspector into the compact hierarchy/navigation surface its existing product role requires.

The center Physical Map / Flow canvas remains the spatial map. The left inspector becomes the precise outline: easy to scan, collapsed by default, synchronized with the center selection, and still capable of deep evidence/source/diagnostic inspection.

## Problem observed

The current inspector renders hierarchy nodes using ordinary primary-button styling, so nearly every System, Subsystem and code row appears as an orange block. The tree is also effectively open by default for architecture nodes, producing a long wall of implementation detail.

Selection already has a shared architectural identity across the inspector and center map, but the inspector does not yet use that identity to reveal the selected node's ancestor path and scroll it into view.

This correction changes presentation/navigation behavior only. It does not redefine Software Map state or architecture truth.

## Locked product laws

1. **Outline, not button grid**
   - Architecture nodes render as compact hierarchy/navigation rows.
   - Ordinary rows do not use filled primary-action styling.
   - Brand orange is a restrained focus/selection/interaction accent rather than the persistent background of every hierarchy node.

2. **Type-first identity**
   - Use type-first labels:
     - `system - Adaptive SEO Service`
     - `subsystem - Content Collection`
     - `component - Collection Fetcher`
     - `file - src/server/collection/collection-content.ts`
   - Deeper code kinds may use the same grammar where useful.
   - Important names and source paths must remain fully readable; wrap rather than ellipsize/truncate.

3. **Collapsed initial state**
   - On fresh inspector state, every expandable architecture branch starts collapsed.
   - The initial Architecture surface acts as a high-level System index rather than eagerly rendering the full repository hierarchy.

4. **Shared selection reveal**
   - The existing Software Map controller selection remains the canonical shared architecture selection.
   - When a center-map selection targets an architecture node, the inspector:
     1. finds the corresponding hierarchy row;
     2. opens only the missing ancestor chain needed to expose it;
     3. scrolls that row into view;
     4. marks it selected.
   - Automatic reveal preserves unrelated branches the user manually expanded.

5. **Bidirectional synchronization**
   - Clicking/selecting a sidebar row continues to update the same shared Software Map selection observed by the center map.
   - Do not add a second inspector-only architecture selection owner.

6. **Disclosure is not selection**
   - The disclosure control expands/collapses a branch.
   - The row label selects the entity.
   - Preserve native keyboard operation, focus-visible treatment, accessible state and non-color selection cues.

7. **Presentation state stays presentation-only**
   - Expanded/collapsed IDs may remain widget-local/workbench presentation state.
   - Do not persist tree expansion into `.dope/`, architecture declarations, Software Map DTOs, Flow state, Planning state or other canonical project state.

8. **Compact secondary actions**
   - `Open Physical Map` and `Refresh Software Map` may be reduced to a compact action row instead of visually dominant primary buttons.
   - Do not introduce a new toolbar/domain architecture solely for these controls.

9. **Deep inspector capability remains**
   - Preserve hierarchy, responsibilities/details, relationships, evidence, source navigation, diagnostics, violations, partial-analysis state and unassigned implementation behavior.
   - The outline cleanup must not reduce the inspector to a shallow navigator.

## Existing seam to preserve

The existing implementation already shares architecture selection through `SoftwareMapController.selectedId`.

The Physical Map delegates physical architecture node selection to the same controller. The correction should therefore build reveal/scroll/selection presentation on that shared state rather than introducing synchronization messages or a second state store.

Expected primary implementation surface:
- `packages/theia-extension/src/browser/software-map-widget.ts`;
- `packages/theia-extension/src/browser/dope.css`;
- focused Software Map UI/navigation regression tests.

Controller/domain changes require explicit justification during `/prompt-plan`; they are not expected by this documentation contract.

## In scope

- hierarchy row DOM/presentation;
- collapsed/open tree behavior;
- ancestor reveal and scroll-into-view for shared selection;
- selected-row/focus styling;
- type-first labels;
- full path/name wrapping;
- disclosure/selection interaction separation;
- compact initialized-state top actions;
- focused permanent presentation/navigation regressions;
- direct GUI evidence appropriate to the eventual implementation plan.

## Out of scope

Do not change:
- Software Map evidence, hierarchy truth or query semantics;
- canonical System / Subsystem / Component identity;
- Flow facts, endpoints, extraction, aggregation, budgets or tracing;
- Physical Map or Planning Map domain semantics;
- synthesis providers or Model Runtime;
- `.dope/` schema/persistence;
- Phase 7 AI Presence;
- package version.

## Sequencing

This correction is independent of `c6-branch-seam` and may be planned/implemented separately.

It is also independent of the bounded Flow projection-contract repair. Do not use inspector cleanup as an excuse to modify Flow truth.

Retained P7 and map-canvas Not Green evidence remains historical truth. This correction does not relabel those results and does not unblock P8 by itself.

If the next fresh P7 GUI candidate is intended to include this inspector behavior, finish and validate this correction before that requalification.

## Next workflow

`/prompt-ass -> /prompt-plan -> /prompt-write c6-smap-outline`

No executable implementation prompt is created by this documentation application.
