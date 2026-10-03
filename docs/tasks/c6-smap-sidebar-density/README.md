# Correction 6 — sMap Sidebar Density

Status: **APPROVED / READY FOR ONE-OFF IMPLEMENTATION**
Correction folder: `c6-smap-sidebar-density`
Required unchanged package version: `0.6.7`
Activation source: `847b8098776a29991f2ce33844740823a6747dca`
Date approved: 2026-10-02
Phase context: Product Phase 6 P7 Not Green / P8 blocked
Authority: ADR 0008, ADR 0016, ADR 0024, current Phase 6 plan, `c6-smap-outline` Green closeout, `c6-map-color-grammar` Green closeout, ARCHITECTURE, PRODUCT-MODEL, workflow, and retained Phase 6 evidence

## Purpose

Perform one final density/readability pass on the initialized left Software Map inspector after the Green `c6-smap-outline` correction.

The inspector should feel like a compact architecture navigator: minimal header chrome, compact controls/status, shallow horizontal indentation, and immediately scannable entity kinds without sacrificing hierarchy, selection synchronization, diagnostics, or future status-marker room.

This correction is presentation-only. It must not reopen or relabel the completed `c6-smap-outline` correction.

## Current observed shape

The Green outline behavior is correct, but the current initialized inspector still spends too much vertical and horizontal space:

- the body renders a large `Software Map` heading even though the Activity Bar/view already identifies sMap;
- generation/completeness/node/violation status occupies a separate full line/block;
- Open/Refresh are compact but not yet arranged as an intentional two-row control block;
- each nested outline level still spends substantial width on list indentation plus disclosure gutter;
- entity kinds are textually present but not visually differentiated;
- the approved `c6-edit-architecture` follow-on will also need a stable action-row slot.

## Locked product laws

1. **No giant body title**
   - Remove the large body `Software Map` H1/H2 from the initialized inspector.
   - The Activity Bar/view identity already establishes that this is the Software Map surface.
   - Do not remove Software Map terminology from the product, Activity Bar entry, caption, or accessibility labels.

2. **Compact control header**
   - The initialized inspector control area uses the compact heading `SMAP CONTROLS`.
   - Keep the control block visually secondary to the architecture outline.

3. **Two-row action layout**
   - First row is compact `OPEN` and `REFRESH`, inline.
   - The second row is reserved for `EDIT ARCHITECTURE` and should visually align with the combined first row.
   - If `c6-edit-architecture` is already implemented when this correction runs, style its real action in that second-row slot.
   - If `c6-edit-architecture` is not yet implemented, do **not** ship an enabled no-op or invent editing behavior. Establish the layout seam so the real action can occupy it without another redesign.
   - Preserve keyboard operation, focus-visible styling, descriptive accessible names, and existing Open/Refresh behavior.

4. **One-line synthesis/status summary**
   - Condense the normal published-generation summary into one compact line, approximately:
     `SYNTHESIS  G1 | partial | 4419 nodes | 0 violations`
   - Preserve the actual generation, completeness, node count, and violation count.
   - Keep error/loading/uninitialized states truthful.
   - Partial-analysis/error diagnostics remain separately visible when they carry actionable meaning; compacting the summary must not hide warnings.

5. **Horizontal space is a first-class constraint**
   - Reduce per-level outline indentation materially from the current treatment.
   - Reduce disclosure/spacer gutter width where practical.
   - Labels should begin as far left as possible while parent/child depth remains obvious.
   - Preserve wrapping for long names/paths; do not solve width pressure with ellipsis or clipping.
   - Do not flatten the hierarchy merely to save pixels.

6. **Kind color belongs on the kind token**
   - Visually distinguish at least `system`, `subsystem`, `component`, and `file`/supported code kinds.
   - Prefer coloring only the type token/prefix or another zero/near-zero-width accent rather than painting whole rows or adding wide pills.
   - The `- Name/path` portion remains normal foreground so labels stay readable.
   - Selection/focus styling remains independent and stronger than kind coloring.
   - Color is supplemental; textual kind labels and hierarchy remain authoritative.

7. **Separate sidebar-kind color from map color grammar**
   - `c6-map-color-grammar` owns center-map branch/node hue, inheritance, explicit overrides, and Flow direction coloring.
   - This correction's sidebar kind colors are stable **entity-kind semantics**, not per-node color preferences.
   - Do not mirror user node-color overrides into the sidebar kind token.
   - Do not persist sidebar kind colors.
   - Warning/error/status semantics remain separate from both color systems.

8. **Future marker compatibility without empty cost**
   - Row composition should permit future warning/status icons near the disclosure/kind area.
   - Do not render empty placeholder gutters or reserve meaningful width for absent future icons today.
   - Future markers must be additive and must not require rewriting the hierarchy layout.

9. **Preserve the Green outline contract**
   - Keep fresh architecture branches collapsed.
   - Keep disclosure distinct from selection.
   - Keep shared `SoftwareMapController.selectedId` as the only architecture selection identity.
   - Center-map selection still reveals missing ancestors, scrolls the row into view, and preserves unrelated manual expansion.
   - Sidebar selection still drives the same shared center-map selection.
   - Preserve full path/name wrapping and presentation-only expansion state.

10. **Preserve deep inspector capability**
    - Keep selected-node detail, incoming/outgoing relationships, evidence, source navigation, diagnostics, violations, partial-analysis state, and collapsed unassigned implementation.
    - Do not turn setup/synthesis/review action controls into outline rows.
    - Do not move center-map or Edit Architecture domain behavior into this presentation correction.

## Expected implementation seam

Expected primary production surface:

- `packages/theia-extension/src/browser/software-map-widget.ts`;
- `packages/theia-extension/src/browser/dope.css`;
- existing/new focused Software Map sidebar presentation tests.

Small presentation helpers are allowed when they materially improve readability/testability.

Changes to Software Map/Physical Map controllers, backend services, domain DTOs, or persistence require explicit evidence and are not expected.

## Validation / qualification

Use one bounded manual **GPT-6 Sol High** one-off implementation prompt.

Validation tier: **T2 plus targeted GUI evidence**.

Focused automated evidence should prove at minimum:

- no large body `Software Map` heading remains in the initialized surface;
- `SMAP CONTROLS` exists;
- normal published generation stats are one compact line;
- Open/Refresh use the intended inline first row;
- the Edit Architecture second-row seam does not create a fake enabled capability;
- outline indentation/gutter is materially denser than the Green `c6-smap-outline` baseline;
- kind-specific presentation exists for System/Subsystem/Component/file or supported code;
- kind styling does not replace selection/focus semantics;
- kind styling is independent from map node-color preferences;
- shared selection reveal/manual expansion behavior remains Green;
- important names/paths still wrap;
- setup/review/synthesis controls remain ordinary actions.

Targeted GUI replay should use the accepted Adaptive SEO reference without regenerating or reaccepting architecture and directly inspect narrow-sidebar density, type scanning, shared selection reveal, Dope Dark, and one compatible alternate theme.

Do not run AppImage packaging or the full Phase 6 qualification matrix solely for this correction.

## Out of scope

Do not change:

- canonical architecture;
- Software Map evidence or hierarchy/query truth;
- Flow facts/endpoints/extraction/query/aggregation/tracing;
- Physical Map/Planning Map domain semantics;
- map node-color persistence or override semantics;
- Edit Architecture domain/save/Search Deeper behavior;
- synthesis/model/provider runtime behavior;
- `.dope/` persistence;
- Phase 7 AI Presence;
- package version.

## Sequencing

`c6-smap-outline` remains Green historical evidence and is not reopened.

`c6-smap-sidebar-density` may land before `c6-edit-architecture`; if so, the later Edit Architecture implementation must reuse the established second-row action layout rather than undoing it. If Edit Architecture lands first, this correction styles the real action rather than replacing it with a placeholder.

`c6-branch-seam` remains independent.

This correction does not relabel Phase 6 P7, unblock P8 by itself, or authorize Phase 7 AI Presence.

## Next workflow

Write/run one manual GPT-6 Sol High one-off prompt for `c6-smap-sidebar-density`.

Do not create a multi-prompt phase stack for this correction.
