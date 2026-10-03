# Correction 6 — Edit Architecture

Status: **P4 NOT GREEN — time-boxed direct GUI evidence; see [closeout.md](closeout.md)**
Correction folder: `c6-edit-architecture`
Required unchanged package version: `0.6.7`
Date approved: 2026-10-02
Phase context: Product Phase 6 P7 Not Green / P8 blocked
Authority: ADR 0024, ADR 0008, ADR 0009, ADR 0014, ADR 0018, current Phase 6 authority, ARCHITECTURE, PRODUCT-MODEL, workflow, and retained Phase 6 evidence

## Purpose

Promote the one-time center Architecture Review into a permanent **Edit Architecture** workspace that works both before initial acceptance and after a Software Map has already been accepted.

Architecture is the canonical user-facing term for System -> Subsystem -> Component structure. Hierarchy remains a technical description, not a competing workspace/action name.

## Product behavior

### Initial synthesis

When synthesis reaches review:

- open/focus **Edit Architecture** in the center workspace;
- present the pending proposal as an editable architecture draft;
- preserve the existing evidence, correction and Search Deeper capabilities;
- finish with explicit **Accept Architecture** or decline.

### Accepted map

When the Software Map is already initialized:

- the left Software Map action row exposes **Edit Architecture** beside **Open Physical Map** and **Refresh Software Map**;
- activation opens/focuses one Edit Architecture center tab for the current project;
- the editor starts from current canonical architecture;
- edits affect a draft only;
- explicit **Save Architecture** validates and commits the resulting canonical architecture;
- ordinary deterministic Software Map analysis/reconciliation follows a successful save;
- Save Architecture does not automatically rerun whole-project AI synthesis.

## Locked product laws

1. **Architecture terminology**
   - User-facing structural surfaces/actions use Architecture: Edit Architecture, Save Architecture, Accept Architecture.
   - Do not introduce Edit Hierarchy, Save Hierarchy or a separate Hierarchy product mode.
   - Technical phrases such as hierarchy-first synthesis or System -> Subsystem -> Component hierarchy remain valid.

2. **Independent workspace state**
   - Edit Architecture owns its own selection, expansion, scroll/focus and draft state.
   - Do not synchronize Edit Architecture selection/navigation with the Physical Map, Flow or left Software Map outline.
   - The existing c6-smap-outline left-outline <-> center-map shared-selection behavior remains unchanged.

3. **Draft-first canonical editing**
   - Opening an initialized project creates an editor draft from canonical architecture.
   - Typing, add/remove/reparent operations and accepted Search Deeper refinements modify the draft only.
   - `.dope/architecture.json` changes only through explicit Save Architecture.
   - Save uses strict architecture validation and bounded stale/conflict protection.

4. **Search Deeper**
   - Available for Systems and Subsystems in initial and accepted-map editing.
   - Starts from the current edited branch.
   - Produces a preview first.
   - Accept Refinement changes only the editor draft.
   - Reject Refinement changes nothing.
   - Preserve unrelated branches/manual edits.
   - Reject stale results when the branch changed while analysis ran.
   - Require an explicitly ready provider only when Search Deeper is invoked.

5. **Reuse the existing editor seam**
   - Prefer evolving the current review widget/controller behavior into a permanent architecture editor instead of building two competing editors.
   - Review-only internal identities may be renamed cleanly when implementation confirms no concrete persistence/external compatibility requirement.

6. **One tab per project**
   - Repeated Edit Architecture activation focuses the existing project editor tab rather than opening duplicates.

7. **No new history subsystem**
   - Do not add architecture revision browsing/history, a new edit-session database, or durable accepted-map draft persistence in this correction.

## Expected implementation seam

Current source indicates the primary implementation surfaces are expected to include:

- `packages/theia-extension/src/browser/software-map-review-widget.ts`;
- `packages/theia-extension/src/browser/software-map-widget.ts`;
- `packages/theia-extension/src/browser/software-map-controller.ts`;
- `packages/theia-extension/src/browser/frontend-module.ts`;
- `packages/theia-extension/src/node/software-map-backend.ts`;
- `packages/software-map/src/service.ts`;
- focused Software Map initialization/UI/backend regression tests.

Implementation planning must inspect the exact canonical-write boundary before choosing the smallest safe service/API extension.

## In scope

- canonical Architecture UI terminology for the affected live surfaces;
- permanent Edit Architecture center workspace;
- initialized-map launch action beside Open/Refresh;
- accepted canonical architecture -> editable draft;
- explicit Save Architecture;
- stale/conflict protection on accepted-map save;
- branch-local Search Deeper from accepted architecture;
- deterministic Software Map refresh/reconciliation after save;
- focused permanent regression coverage;
- direct GUI evidence appropriate to the implementation plan.

## Out of scope

Do not change:

- Physical Map/Flow/left-outline selection synchronization rules;
- Software Map evidence truth;
- Flow extraction/query/aggregation semantics;
- Planning Map domain semantics;
- provider-independent architecture authority;
- general AI Presence/chat/delegation;
- architecture history/revision UX;
- project persistence outside the existing canonical architecture boundary unless implementation evidence proves a minimal bounded change is required;
- package version.

## Prompt stack

Activation/source baseline: `b447d925ee4c12891ff072f235368e7b29a6854d`.

Required predecessor `c6-smap-outline` is Green at implementation candidate `ac7fd5a29fb9d6dca4fc2f137f8fdef7f2a20439`.

| Prompt | Scope | Tier | Model |
| --- | --- | --- | --- |
| P1 | lossless canonical Architecture read/edit/save service seam | T2 | GPT-6 Sol High |
| P2 | permanent Edit Architecture workspace + initialized left action | T2 | GPT-6 Sol High |
| P3 | accepted-map Search Deeper + provider/evidence integration | T2 | GPT-6 Sol High |
| P4 | direct browser qualification + evidence-only closeout | T3 | GPT-6 Sol High |

All prompts keep package version exactly `0.6.7`.

Prompt files:
- `P1-canonical-architecture-edit-service.txt`;
- `P2-edit-architecture-workspace.txt`;
- `P3-accepted-search-deeper.txt`;
- `P4-browser-qualification-closeout.txt`.

Planning artifacts:
- `prompt-assessment.md`;
- `implementation-plan.md`.

## Sequencing

`c6-smap-outline` is already Green and its compact initialized action row is the predecessor seam for this stack.

`c6-branch-seam` remains independent.

Retained Phase 6 P7 and map-canvas Not Green evidence remains historical truth. This correction does not relabel prior results and does not unblock P8 by itself.

## Next workflow

Validate the correction prompt stack if supported, then execute P1-P3 in order and perform P4 as the manual/browser T3 handoff.

`npm run codex:phase:validate -- c6-edit-architecture`

`npm run codex:phase -- c6-edit-architecture`

P4 is the direct GUI/provider qualification and closeout gate.
