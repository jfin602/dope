# Product Phase 5 — Visual Software Planning Plan

Status: **ACTIVE PLAN**

Baseline: `0.5.0`

Authority:
- `docs/decisions/0007-software-model-centered-product-architecture.md`
- `docs/decisions/0008-software-map-terminology-and-workbench-placement.md`
- `docs/decisions/0017-visual-planning-map-and-work-model.md`
- `docs/PRODUCT-MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/stability-contract.md`

## Objective

Make architecture understanding, target design, work decomposition, implementation and reconciliation one coherent human-driven workflow centered on the Software Map.

```text
Physical Map
-> target Planning Map
-> PlannedTransformations
-> WorkItems
-> ordinary implementation
-> fresh Physical Map
-> Reconciliation
```

No model/provider is required.

## Product invariants

1. The Physical Map remains evidence-backed current reality.
2. Canonical architecture remains explicit developer authority.
3. A Planning Map is durable target intent, not physical truth.
4. Existing architecture nodes are referenced by identity, not copied.
5. The canvas is a projection of domain state, not a second database.
6. Editing target intent does not silently mutate canonical architecture.
7. Work completion does not imply architecture adoption or physical realization.
8. Stale target state is visible; rebase is explicit.
9. Reconciliation compares against freshly analyzed reality.
10. Historical Phase 3 planning state is not a compatibility requirement.
11. Phase 5 remains useful with no AI configured.
12. Theia renders the product; Theia does not own its domain semantics.

## Domain model

### PlanningMap

Required semantic state includes:
- stable map ID and project identity;
- title/objective and lifecycle status;
- canonical architecture revision/fingerprint at branch time;
- Physical Map input fingerprint/generation basis at branch time;
- PlannedTransformations and WorkItems;
- document/map revision for optimistic conflict handling;
- developer-authored mutation history sufficient to explain accepted target/work changes.

### PlannedTransformation

Initial kinds:
- add;
- modify;
- remove;
- move;
- split;
- merge;
- redirect relationship;
- change contract.

A transformation references affected current/canonical IDs where applicable and expresses target state explicitly. Planned new Systems, Subsystems and Components may carry intended future canonical IDs, but those IDs remain planned until target adoption.

### WorkItem

A WorkItem is a bounded unit of implementation work connected to one or more transformations. It may contain stable identity, objective, dependencies, requirements, constraints, acceptance criteria, validation targets, project-relative working-set references, status and completion notes.

WorkItems can be revised independently without silently changing target architecture. Do not recreate Phase 3 PlanStep under another name.

## Target adoption

Editing a PlanningMap never writes `.dope/architecture.json`.

Provide an explicit **Adopt Target** operation that validates the target, presents canonical changes, requires developer acceptance, updates canonical architecture through the existing authority boundary, and records the resulting architecture basis back into planning state.

Adoption may create declared-only architecture before implementation. It does not complete WorkItems or create physical evidence.

## Persistence

Canonical Phase 5 planning persistence is `.dope/planning-maps.json`.

Requirements:
- versioned readable Dope-owned schema;
- stable project identity;
- optimistic revision/conflict handling;
- safe path/root validation;
- restart/reopen recovery;
- project isolation;
- copy-to-new-root portability;
- fail closed on corrupt/unsupported state;
- external inspection/recovery with writers stopped.

Do not reuse or migrate historical Phase 3 `.dope/planning.json`. Repository + `.dope/` must be sufficient to recover durable Phase 5 planning truth.

## Presentation state

Viewport/pan/zoom, semantic LOD, focus, node coordinates/routing geometry, selection, relationship visibility, developer-selected node colors, collapsed groups, open tabs, panel sizes and transient filters are presentation state. Deleting them must not change PlanningMap meaning.

## Visual workspace

ADR 0008 placement remains:
- left: sMap inspector/navigation/evidence;
- center: Physical Map and Planning Map editor-like tabs;
- right: reserved for later Agent Mind/chat;
- bottom: terminal/tests/runtime/Problems.

The Phase 5 canvas must consume semantic theme tokens.

The Physical Map canvas is a projection of existing Software Map state and should support semantic zoom from System -> Subsystem -> Component -> Code while preserving identity and source navigation.

The Planning Map overlays target intent on referenced physical/canonical structure and visibly distinguishes unchanged reality, additions, modifications, removals, moved/reparented structure, relationship/contract changes, and stale/unresolved/conflicted state.

## Staleness and rebase

A PlanningMap becomes stale when its canonical architecture basis or relevant Physical Map input basis changes.

Do not silently rebase.

Explicit rebase compares old basis, new basis and target intent. Conflicts include removed/replaced targets, parent/hierarchy changes, identity changes, dependency/contract changes, relationship changes, transformations already realized and implementation realized differently.

Non-conflicting reference refresh may occur inside an explicitly initiated rebase, but the developer reviews the result before acceptance.

## Reconciliation

After implementation, run deterministic Software Map analysis and compare the fresh Physical Map with the PlanningMap target.

Retain at least:
- implemented as planned;
- implemented differently;
- not implemented;
- unexpected implementation.

Reconciliation does not rewrite target or canonical architecture automatically.

## Project Mind relationship

Planning Maps and WorkItems may reference Project Mind artifacts by stable ID. Referenced knowledge remains owned by Project Mind.

## Implementation surfaces

WorkItems target ordinary editor/source navigation, terminal, tests, debugger, SCM/diffs and Problems/diagnostics. Phase 5 does not add an execution agent.

## Locked visual workflow contract

The resolved Phase 5 worksheet is authoritative planning input.

### Overview and navigation

- Default project view: Systems plus immediate Subsystems.
- One-System projects use the System as the main frame.
- Restore last valid map presentation context on reopen.
- Always expose **Fit Architecture**.
- Support geometric pan/zoom plus explicit **Focus / Up / Fit Architecture**.
- Preserve stable identity/selection and source-navigation round-trip.
- Keep simplified cross-boundary dependencies visible while focused.
- Allow project/System/Subsystem/Component/branch-focused map tabs simultaneously; every tab is a projection of the same shared state.

### Visual grammar

Use hierarchy, containment, scale, shape, iconography and edge semantics before color.

The current 0.5.11 visual-planning candidate may remain compact, but the pre-P11-rerun `c5-smap-readability` correction locks the fuller presentation contract: progressive semantic LOD, hierarchy-first rendering, relationship-on-demand, stable breadcrumbs/focus context and complete visible labels. A label may be omitted at a deliberately lower LOD; if it is shown, it must not be truncated, clipped or ellipsized. Layout may wrap labels, break paths at sensible boundaries, grow nodes and reflow geometry.

Color is reinforcement only. Alternate themes and color-vision-deficiency readability are qualification requirements. Use a curated palette of no more than ten map-safe colors. Systems receive deterministic Automatic defaults; Subsystems, Components and deeper mapped implementation inherit the nearest resolved ancestor color. An explicit developer override starts a new inherited color root for that branch, while Automatic clears the override and resumes inheritance/default resolution. The selector must show each available color with a visible swatch and readable label. Explicit project-scoped node-color preferences may survive restart, but Automatic assignment/inheritance is derived presentation state and cannot alter identity, evidence, planning semantics or staleness.

Planning Map projections preserve this Architecture color identity so current and target structure remain visually recognizable. Meaning-bearing planning/realization/drift states still require shape, border, badge, edge or other non-color semantics and must not be encoded only by palette choice.

Keep detailed evidence/provenance/diagnostics in the left sMap inspector; use concise state markers on the canvas. Selection on the canvas and inspector remains shared so provider-free responsibility/relationship/evidence/source detail explains the selected node.

### Planning comparison and editing

The primary Planning Map is an overlay/diff over physical/canonical state with **Current only / Target only / Diff** modes. Side-by-side is optional secondary presentation.

Direct gestures are semantic commands, not raw geometry mutation:
- add target node -> `add`;
- drag/reparent -> `move`;
- remove from target -> `remove`;
- draw/redirect dependency -> relationship transformation.

Preview the typed semantic operation before commit. Use focused editors for split/merge/change-contract. Support domain undo/redo for unadopted edits.

### Multiple maps and alternatives

Allow multiple durable Planning Maps with lifecycle:
`Draft -> Active -> Completed -> Superseded / Archived`.

Explicit duplication/branching creates alternatives. Overlapping incompatible active transformations surface conflicts; do not auto-merge maps.

Focused map tabs do not create branches.

### Work projection

PlannedTransformations drive deterministic WorkItem suggestions. The developer accepts/edits/splits/merges suggestions.

WorkItems live in a dedicated work projection with visible dependency/parallelism information. WorkItem selection highlights affected transformations/architecture and vice versa.

### Adoption

Adopt Target supports coherent partial slices. Show canonical diff and dependency/conflict checks. Partial adoption distinguishes adopted target from still-planned target.

### Staleness/rebase

Track stale state at map/branch/transformation granularity.

Explicit rebase presents old basis -> current reality -> target intent. Advance unaffected references only within that explicit operation; require developer resolution for conflicts.

### Reconciliation/closeout

Reconciliation is transformation-centered and rolls up to WorkItems/branches/map. Preserve original target plus observed outcome.

Completion requires explicit developer closeout with every transformation resolved, intentionally accepted as different, deferred, or abandoned.

## Pre-P11-rerun readability boundary

`c5-smap-readability` is an active unchanged-`0.5.11` correction authorized from `158b61d601947b342472e457fe61d78b24bf5152`. It refines only Physical/Planning Map presentation, then returns to the existing P11 qualification gate. It does not claim P11 Green or replace P11 evidence.

The correction may change browser-only projection, layout, React Flow interaction, inspector synchronization and project-scoped presentation preferences. It must not change canonical architecture contracts, deterministic evidence, Physical Map service/domain state, PlanningMap/PlannedTransformation/WorkItem semantics, staleness basis, adoption or reconciliation. No provider/model is required.

## Forward projection boundary

ADR 0020 inserts Product Phase 6 — Data Flow after Phase 5. The readability correction remains a bounded 0.5.11 presentation correction before the P11 rerun; Data Flow still waits for P11 Green, P12 closeout and the 0.6.0 successor baseline. This does **not** add Data Flow to Phase 5.

## Validation strategy

Use normal repository T1/T2/T3 tiers.

T3 qualification must directly prove in a disposable copy of the mapped `/home/jfin/dev/adaptive-seo-dope` workspace: Physical Map -> Planning Map -> meaningful transformations -> WorkItems -> restart/copy recovery -> stale detection -> explicit rebase -> optional Adopt Target -> ordinary implementation -> re-analysis -> reconciliation, plus project isolation, corrupt-state fail-closed behavior and semantic zoom/source navigation. Verify usable canonical/Physical Map state before the direct loop. The Dope repository remains the host/IDE/Project Mind/sMap regression and exact-candidate browser/Electron/native/package fixture; its own canonical map is not required for the visual loop.

## Explicit non-goals

Phase 5 does not implement AI Presence/chat, Agent Mind, provider selection for planning, ProposedAction, tool authority, AI mutation/delegation, durable Development Sessions, Phase 3 Planning migration/compatibility, automatic plan generation, autonomous target adoption or autonomous rebase conflict resolution.

## Exit condition

Phase 5 is qualified when the developer can use Dope itself, with no model configured, to understand current architecture visually, design a durable target, derive executable work, implement through ordinary IDE workflows, re-analyze reality and reconcile the result without losing the distinction among physical truth, canonical architecture and planning intent.
