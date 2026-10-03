# ADR 0024 — Persistent Architecture Editing and Canonical Architecture Terminology

Status: Accepted
Date: 2026-10-02
Builds on: ADR 0008, ADR 0009, ADR 0014, ADR 0018
Phase context: Product Phase 6 at 0.6.7 with P7 Not Green / P8 blocked

## Context

Dope already uses **Architecture** as the primary user-facing structural term in the Physical Map, synthesis setup, acceptance flow and canonical project state. The current center review surface, however, is still treated as a one-time Architecture Review that exists only while an initial synthesis proposal is pending. After acceptance, the developer loses that dense System -> Subsystem -> Component editing context even though canonical architecture remains developer-owned and must remain correctable.

The same review surface is also the most natural place for branch-local **Search Deeper** because it presents the whole architecture compactly while preserving evidence and developer edits.

Using a new user-facing term such as **Edit Hierarchy** would create unnecessary vocabulary drift. Hierarchy is useful as a technical description of structure and synthesis choreography, but the product concept being edited is Architecture.

## Decision

### Architecture is the canonical user-facing structural term

**Architecture** is the canonical user-facing term for Dope's System -> Subsystem -> Component organization and its editing surface.

**Hierarchy**, **hierarchical** and **hierarchy-first** remain valid technical/descriptive terms for tree shape, traversal, decomposition and synthesis strategy. They are not competing names for a product workspace, mode or primary action.

Canonical user-facing structural actions and surfaces should therefore use terms such as:
- Architecture;
- Edit Architecture;
- Save Architecture;
- Accept Architecture;
- Architecture validation;
- Architecture changed.

The umbrella feature remains **Software Map (sMap)**. **Physical Map**, **Flow** and **Planning Map** keep their existing meanings. This decision does not rename Software Map to Architecture.

### Edit Architecture is a permanent center-workspace surface

The existing center Architecture Review evolves into a reusable **Edit Architecture** workspace.

During initial synthesis, Edit Architecture operates on the pending proposal/draft and ends in explicit **Accept Architecture** or decline.

After initialization, Edit Architecture opens from the accepted canonical architecture and operates on an editable draft. It ends in explicit **Save Architecture** or cancellation/discard of the draft.

The same underlying editor behavior should be reused rather than maintaining separate one-time review and accepted-map editors.

### Entry point

For an initialized Software Map, the left inspector's compact top action group includes:

- Open Physical Map;
- Refresh Software Map;
- Edit Architecture.

**Edit Architecture** opens or focuses one center-workspace tab for the current project. Repeated activation must not create duplicate editor tabs for the same project.

### Edit Architecture is independent from map presentation state

Edit Architecture shares canonical architecture data with the Software Map but does **not** synchronize transient UI state with the Physical Map, Flow projection or left sMap outline.

In particular, Edit Architecture owns its own:
- selected node;
- expansion/collapse state;
- scroll position;
- focused branch;
- Search Deeper preview/busy/error state;
- unsaved draft state.

Selecting or expanding something in Edit Architecture must not select, pan, focus, expand or navigate the Physical Map/Flow/left outline, and map selection must not drive Edit Architecture.

This does not change the existing `c6-smap-outline` contract: the left sMap outline and center Physical Map/Flow may continue sharing the existing Software Map selection identity.

### Accepted architecture edits are draft-first

Opening Edit Architecture on an initialized project creates an editable draft from the current canonical architecture.

Ordinary field edits, add/remove/reparent operations and accepted Search Deeper refinements update only that draft. Typing or accepting a refinement must not write `.dope/architecture.json` immediately.

**Save Architecture** is the explicit canonical mutation boundary.

The save path must:
- validate the resulting architecture with existing canonical rules;
- reject stale/conflicting saves using the current architecture fingerprint/revision or an equivalent bounded optimistic-concurrency guard;
- atomically update canonical architecture according to the existing project-local persistence contract;
- preserve stable IDs where the developer has not intentionally changed identity;
- trigger the ordinary deterministic Software Map analysis/reconciliation required to project the new canonical architecture against current implementation.

Saving Architecture must not automatically run a fresh full AI synthesis.

### Search Deeper remains branch-local and preview-first

Search Deeper is available for Systems and Subsystems in both pending initial proposals and accepted-map Edit Architecture drafts.

For accepted architecture:
- it starts from the **current edited branch**, not a stale canonical snapshot;
- it gathers bounded evidence relevant to that branch under the existing evidence/provenance laws;
- it produces a preview rather than mutating the draft immediately;
- Accept Refinement updates only the Edit Architecture draft;
- Reject Refinement leaves the draft unchanged;
- unrelated branches and manual edits are preserved;
- a result is rejected when its target branch changed after analysis began;
- canonical architecture changes only after explicit Save Architecture.

Search Deeper requires an explicitly ready synthesis provider when invoked. Manual architecture editing remains provider-independent.

### No new history system in this correction

The first Edit Architecture correction does not add architecture revision browsing, long-lived edit-draft persistence, or a new history store merely because those capabilities could be useful later.

Existing canonical architecture remains project-local in `.dope/architecture.json`. Existing unaccepted synthesis review work remains governed by ADR 0018. Any future persistent post-acceptance edit session/history design requires separate approval.

## Correction

Implement this decision through bounded correction:

`c6-edit-architecture`

at unchanged package version `0.6.7`.

The correction follows `c6-smap-outline` for the overlapping left-panel action row. `c6-branch-seam` remains independent and may proceed separately.

## Out of scope

This decision does not authorize:
- synchronization between Edit Architecture and map/outline presentation state;
- automatic architecture mutation from AI output;
- automatic full synthesis on Save Architecture;
- a new canonical architecture database or schema solely for this UI;
- Planning Map semantic changes;
- Flow semantic changes;
- general Phase 7 AI Presence, chat or delegation;
- architecture revision/history UX;
- package-version changes.

## Consequences

- Developers can revisit and correct accepted architecture without rerunning whole-project synthesis.
- Search Deeper becomes useful as an ongoing branch-level architecture refinement tool.
- The post-synthesis review and long-term architecture editor share one mental model and implementation direction.
- Architecture terminology becomes consistent with the existing Architecture/Flow product language.
- The left outline remains a synchronized navigation surface while Edit Architecture remains an independent editing workspace.
