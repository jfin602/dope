# Product Phase 5 — Visual Software Planning Worksheet

Status: OPEN PLANNING WORKSHEET  
Date: October 1, 2026  
Target phase: Product Phase 5 — Visual Software Planning

## Purpose

Resolve the ten highest-leverage product and interaction questions for the Phase 5 visual workflow before decomposing the phase into its implementation plan and prompt stack.

This worksheet does not change Phase 5 authority by itself. Resolved answers should be promoted into ADR 0017, the Phase 5 plan, architecture/product contracts, or the roadmap through the normal documentation workflow.

The focus is deliberately **visual planning**, not AI implementation. Phase 5 should prove that a developer can understand current architecture, design a target, derive work, implement through ordinary IDE surfaces, re-analyze, and reconcile.

## Already locked

The following are not open questions unless explicitly revisited through the normal decision process:

- Phase 5 is active from baseline `0.5.0`.
- Phase 5 must remain fully useful with no model/provider configured.
- The forward planning ontology is `PlanningMap -> PlannedTransformation -> WorkItem`.
- Historical Phase 3 `Plan -> PlanStep -> Task` is not restored or migrated.
- The Physical Map is evidence-backed current reality.
- Canonical architecture remains explicit developer authority.
- A Planning Map is durable target intent, not physical truth.
- Existing physical/canonical nodes are referenced by identity rather than copied into a second architecture database.
- The visual canvas is a projection of shared domain state; geometry/layout is presentation state.
- Physical Map and Planning Map surfaces belong in the center workspace.
- The left sMap inspector remains the primary architecture navigation/evidence surface.
- The right sidebar remains reserved for later Agent Mind/chat.
- Durable Phase 5 planning state is project-local at `.dope/planning-maps.json`.
- Editing a Planning Map does not silently mutate canonical architecture.
- **Adopt Target** is explicit.
- Planning Maps record their canonical/physical basis and become visibly stale when that basis changes.
- Rebase is explicit and conflict-aware.
- Reconciliation uses fresh deterministic Physical Map analysis and does not promote WorkItem completion into physical truth.
- General AI Presence, Agent Mind, ProposedAction, tool authority and delegation remain later phases.

## Decision worksheet

### Q1 — What is the default visual experience when the developer opens the Physical Map?

**Why it matters**

The first canvas view establishes whether the Software Map feels like a useful architectural workspace or a graph-demo hairball. The default should answer “what is this software?” before exposing low-level detail.

**Questions to resolve**

- Does the canvas initially show Systems only, or Systems plus first-level Subsystems?
- What happens in a one-System project such as a cohesive application?
- Should the first view optimize for architectural hierarchy, dependency flow, or spatial familiarity?
- Which information belongs directly on a node versus in the left inspector/details?
- What should the empty/uninitialized and partially analyzed states look like?
- Should reopening restore the last visual position or return to an architecture overview?

**Current leaning**

Open at the highest useful architectural level, normally System + immediate Subsystem context, with a deliberate **Fit Architecture** overview rather than rendering every code node. Restore the developer's last presentation state when it remains valid, while always providing a one-action return to the architecture overview.

**Decision**

Locked: default to a clean architecture overview showing **Systems plus their immediate Subsystems**. Do not show Components or code by default. In a one-System project, that System is the main frame and its Subsystems provide the first useful structure. Reopening restores the developer's last valid visual position when possible, with a one-action **Fit Architecture** command that returns to the high-level overview.

---

### Q2 — What is the visual grammar for architecture levels, relationships, and state?

**Why it matters**

Dope needs a visual language that lets the developer distinguish architecture meaning without reading every label or opening every inspector. If visual encoding is inconsistent or overloaded, the map becomes decoration rather than an engineering tool.

**Questions to resolve**

- How are System, Subsystem, Component, and Code visually distinguished?
- How are containment and dependency relationships distinguished?
- How are canonical, realized, declared-only, detected-only, drifted, unassigned, planned, stale, conflicted, and unresolved states shown?
- Which distinctions use structure/shape/icon/border/line style versus color?
- How does the grammar remain readable under non-Dope themes and for color-vision deficiencies?
- How much provenance/confidence information belongs directly on the canvas?

**Current leaning**

Use hierarchy/shape/icon/line semantics first and theme color as reinforcement, not the sole carrier of meaning. Keep dense evidence/provenance in the inspector while showing concise state badges/edge treatments on the canvas.

**Decision**

Locked: distinguish **System / Subsystem / Component / Code** primarily through structure, scale, shape, iconography, containment and edge semantics. Color reinforces meaning but is never the only carrier of state. Containment and dependency relationships use distinct visual treatments. Canonical/physical/planned/drift/stale/conflict states use concise badges, borders or line treatments layered onto the architectural object rather than replacing its identity. Dense evidence, provenance, confidence and diagnostics remain in the inspector. The grammar must remain readable under alternate themes and for color-vision deficiencies.

---

### Q3 — How should semantic zoom and drill-down behave?

**Why it matters**

Semantic zoom is one of the central differentiators of the product. It must reveal progressively deeper architecture without making zoom level an accidental source of truth or causing the user's mental position to jump around.

**Questions to resolve**

- Is semantic detail controlled by geometric zoom, explicit drill-in/out commands, or both?
- At what point do Components and Code become visible?
- Should lower-level code detail appear inside parent boundaries, replace the parent view, or open a focused sub-map?
- How are cross-boundary dependencies preserved when focusing on one branch?
- Does selection remain stable when the selected object's representation changes?
- How does the developer jump from a visual node/edge to source and back without losing map context?

**Current leaning**

Combine ordinary pan/zoom with explicit architectural focus. Geometric zoom may reveal more detail, but deliberate **Focus / Up / Fit** navigation should define the reliable workflow. Preserve stable identity, selection, breadcrumb context, and source round-tripping across semantic levels.

**Decision**

Locked: use **both geometric zoom and explicit architectural focus**. Ordinary pan/zoom may progressively reveal useful detail, while **Focus** opens a dependable branch-centered view, **Up** returns one architectural level, and **Fit Architecture** restores the high-level overview. Selection and node identity remain stable as detail changes. Cross-boundary dependencies remain visible in simplified form while focused. Source navigation must round-trip back to the same architectural context rather than losing the developer's place.

---

### Q4 — What direct-manipulation interactions are allowed to change a Planning Map?

**Why it matters**

The Planning Map should feel like designing software, not filling out forms around a picture. But free-form diagram editing can create ambiguous architectural mutations unless every gesture maps cleanly to a typed transformation.

**Questions to resolve**

- Can the developer drag a Component between Subsystems to create a `move` transformation?
- Can dragging an edge create or redirect a relationship?
- How are `split` and `merge` expressed visually?
- How are `modify` and `change contract` represented when geometry alone is insufficient?
- Which mutations require an explicit property/detail editor?
- Is there undo/redo at the PlanningMap domain level?
- Does every gesture preview its semantic transformation before commit?

**Current leaning**

Support direct manipulation where the semantic operation is unambiguous, but translate every accepted gesture into an explicit typed PlannedTransformation. Complex operations use focused editors/previews rather than hidden gesture magic. Provide domain-level undo/redo for unadopted planning edits.

**Decision**

Locked: make the Planning Map directly editable **only where the semantic intent is unambiguous**, and translate every accepted gesture into an explicit typed PlannedTransformation. Dragging a Component between Subsystems creates `move`; drawing/redirecting a dependency creates a relationship transformation; adding a target node creates `add`; removing something from the target creates `remove` without deleting physical truth. Semantically rich operations such as `split`, `merge` and `change contract` use focused commands/editors. Before commit, show the exact semantic operation being created. Support domain-level undo/redo for unadopted planning edits.

---

### Q5 — How should the Physical Map and Planning Map be compared while designing?

**Why it matters**

Planning only works if the developer can continuously see what exists versus what they intend to change. A completely separate target drawing would recreate the disconnected-diagram problem Phase 5 is intended to solve.

**Options to evaluate**

- Target overlay directly on the Physical Map.
- Side-by-side current versus target.
- Toggle between current / target / diff.
- Branch-focused compare mode for one System or Subsystem.
- A combination with one primary default.

**Current leaning**

Make an **overlay/diff Planning Map** the primary editing view: unchanged physical/canonical structure stays visible while transformations are layered on top. Add current-only and target-only toggles, with side-by-side comparison available when useful rather than making it the default.

**Decision**

Locked: the primary Planning Map is an **overlay/diff view** over referenced physical/canonical structure rather than a disconnected target drawing. Unchanged reality remains visible while planned additions, removals, moves, modifications and relationship/contract changes are layered on top. Provide **Current only / Target only / Diff** modes, with side-by-side comparison available when useful rather than as the default.

Any **System, Subsystem, Component, or other supported architectural branch** may also be opened as its own focused map in a separate center-workspace tab. Those focused tabs are projections of the same shared Physical/Planning Map domain state, preserve the same stable identities and transformation semantics, and must not fork or duplicate architecture/planning state. Multiple focused maps may therefore remain open alongside the project-level map while the developer moves between different architectural areas.

---

### Q6 — What is the lifecycle and branching model for Planning Maps?

**Why it matters**

Developers may need alternative designs, incremental plans, or several independent pieces of work. If Dope assumes one eternal plan per project, it will become cluttered; if it allows unconstrained branches, planning state will become difficult to understand.

**Questions to resolve**

- Can a project have multiple Planning Maps?
- Is there one active map or several active maps?
- Can a developer duplicate/branch a map to explore an alternative design?
- What statuses are actually needed: draft, active, completed, superseded, archived?
- Can Planning Maps overlap the same physical nodes?
- What happens when two active maps propose conflicting target changes?
- How are completed/superseded maps retained as project history without cluttering the live workspace?

**Current leaning**

Allow multiple durable Planning Maps with at most one explicitly foregrounded map per visual workspace, not a global one-plan restriction. Support deliberate branching/duplication for alternatives. Surface overlapping/conflicting active transformations rather than attempting automatic multi-plan merge semantics in Phase 5.

**Decision**

Locked: a project may have **multiple durable Planning Maps**. Each map represents a coherent intended change or alternative design. The developer may explicitly duplicate/branch a map to explore another approach without mutating the original. The lifecycle is **Draft -> Active -> Completed -> Superseded / Archived**.

Multiple Planning Maps may be active at once. When active maps touch the same architectural area and propose incompatible changes, Dope surfaces that conflict explicitly rather than attempting automatic merge semantics in Phase 5.

Completed/superseded maps remain available as project history but are kept out of the normal active workspace by default. Opening a System/Subsystem/Component as a focused map tab does **not** create a new Planning Map; it is another projection of the same underlying Physical/Planning Map state unless the developer explicitly creates or branches a Planning Map.

---

### Q7 — How should WorkItems be derived from visual transformations and presented back to the developer?

**Why it matters**

This is the bridge from architecture design to actual development work. If WorkItems are disconnected manual TODOs, the graph-centered planning model loses its value. If Dope over-automates decomposition, Phase 5 starts inventing work the developer did not approve.

**Questions to resolve**

- Are WorkItems created manually from selected transformations, deterministically suggested, or both?
- What qualifies as one coherent WorkItem?
- How are dependency order and parallelizable work shown?
- Can one WorkItem cover several transformations?
- Can one transformation require several WorkItems?
- Where are WorkItems shown: on the canvas, a planning panel, a dependency lane, or multiple projections?
- How does selecting a WorkItem reveal affected architecture and working-set source?

**Current leaning**

Treat transformations as the architectural source and let Dope offer deterministic graph-derived grouping/dependency suggestions that the developer explicitly accepts or reshapes. Keep WorkItems visible as a separate work projection tied bidirectionally to highlighted map transformations rather than turning every task into another graph node on the architecture canvas.

**Decision**

Locked: **PlannedTransformations are the architectural source of truth for work**. Dope may deterministically suggest WorkItems from selected transformations, but the developer explicitly accepts, edits, splits or merges those suggestions. One transformation may require several WorkItems; one WorkItem may cover several tightly related transformations.

WorkItems are presented primarily in a dedicated planning/work projection rather than as another architecture-node type on the canvas. Dependencies and parallelizable work remain visible there. Selecting a WorkItem highlights the exact Systems/Subystems/Components/transformations it affects, and selecting a transformation reveals its associated WorkItems.

Each WorkItem exposes its objective, requirements, constraints, acceptance criteria, validation targets and working-set references. This WorkItem remains suitable as the later Phase 7 delegation unit without requiring Phase 5 to introduce AI execution.

---

### Q8 — What exactly can **Adopt Target** adopt, and when should the developer use it?

**Why it matters**

Target adoption is the boundary between exploratory design and canonical architecture authority. If adoption is too coarse, incremental implementation becomes awkward. If it is too casual, planning edits can accidentally become architectural law.

**Questions to resolve**

- Is adoption whole-PlanningMap only, or can a System/Subsystem/selected transformation set be adopted?
- Must dependencies among selected transformations also be adopted?
- Can the developer implement before adoption?
- Can an already-implemented change be adopted afterward?
- What validation is required before adoption?
- What exact review/diff does the developer see before `.dope/architecture.json` changes?
- How are rejected or deferred target changes retained in the Planning Map?

**Current leaning**

Support explicit **bounded adoption** of a coherent target slice rather than forcing all-or-nothing map adoption. Show a canonical architecture diff and dependency/conflict check before acceptance. Planning and implementation may proceed before adoption; adoption remains a deliberate statement of architectural intent, not a workflow checkbox.

**Decision**

Locked: **Adopt Target is bounded rather than whole-map only**. The developer may adopt a coherent System, Subsystem, Component branch, or selected compatible transformation set. Dope includes required dependent target changes where that is deterministic and safe, or blocks adoption until unresolved dependencies/conflicts are addressed.

Before adoption, Dope shows a clear canonical-architecture diff. Adoption explicitly updates `.dope/architecture.json`; it never happens because a WorkItem completed. The developer may implement before adoption, adopt before implementation, or adopt afterward when implementation/reconciliation supports the intended architecture.

Partial adoption preserves the remaining Planning Map target. The UI must clearly distinguish **adopted target** from **still-planned target** so progressive architecture decisions do not blur into one state.

---

### Q9 — How should stale-plan and rebase conflicts appear in the visual workflow?

**Why it matters**

Staleness cannot be a tiny warning badge. Once the underlying architecture/code changes, the developer needs to understand which parts of the target remain valid and which assumptions broke.

**Questions to resolve**

- Is staleness map-wide, branch-local, transformation-local, or all three?
- Which changes should mark a target as affected versus merely update its physical context?
- How are removed/reparented/renamed/replaced targets represented?
- How are already-realized or differently-realized transformations shown?
- Does rebase use a three-way view: old basis / current basis / target?
- Can unaffected branches rebase independently?
- What happens when the developer chooses to keep planning against the old basis?

**Current leaning**

Track staleness at the map and affected transformation/branch levels. Use an explicit rebase workspace that compares **old basis -> current reality -> target intent** and lets unaffected references advance while conflicted transformations require developer resolution. Never hide a stale assumption through automatic background repair.

**Decision**

Locked: track staleness at **whole-map, affected-branch, and individual-transformation** levels. Physical/canonical changes that do not affect a target may refresh context without making unrelated work appear stale.

Conflicted targets receive explicit visual markers on the affected nodes/edges. Rebase opens a dedicated three-way comparison workspace:

```text
Old basis
-> Current reality
-> Target intent
```

Within an explicitly initiated rebase, unaffected references may advance automatically. Conflicted transformations require developer resolution. Already-realized transformations are recognized explicitly, while differently realized implementation is shown as divergence rather than rewriting the plan. The developer may deliberately continue against the older basis, but stale state remains visible and explainable.

---

### Q10 — What does reconciliation look like, and when is a Planning Map actually “done”?

**Why it matters**

The value of the visual workflow is not merely designing a target; it is closing the loop between intent and implemented reality. Completion must preserve deviations and learning rather than reducing everything to checked boxes.

**Questions to resolve**

- Where are `implemented as planned`, `implemented differently`, `not implemented`, and `unexpected implementation` shown?
- Is reconciliation per transformation, WorkItem, architecture branch, or map?
- Can the developer accept an implementation that differs from the target without rewriting history?
- When should canonical architecture be updated if implementation intentionally diverged?
- Does completing a WorkItem require a reconciliation result?
- What unresolved states prevent a Planning Map from becoming completed?
- How are the original target and final realized outcome retained for future understanding?

**Current leaning**

Make reconciliation transformation-centered with rollups to WorkItems, branches, and the whole Planning Map. Preserve both original target intent and observed outcome. A map should only become completed through an explicit developer closeout that addresses unresolved transformations; “implemented differently” can be an accepted final outcome without pretending the original target was what happened.

**Decision**

TBD.

## Secondary implementation questions

These matter during prompt decomposition but should not displace the ten product decisions above.

| Area | Questions |
| --- | --- |
| Canvas technology | Which graph/canvas library best supports large interactive graphs, editor-like embedding, custom nodes/edges, accessibility, deterministic testing, and replacement behind a presentation adapter? |
| Layout | Which layouts are appropriate at System, Subsystem, Component and dependency views? How much layout stability should survive graph refresh? |
| Performance | What repository/node sizes define the Phase 5 interaction target? When do virtualization, clustering or progressive rendering become required? |
| Keyboard UX | What are the minimum keyboard-only navigation/editing operations for canvas qualification? |
| Undo/redo | Which planning mutations participate in domain undo/redo, and what survives restart? |
| Clipboard | Can architecture nodes/transformations be copied between Planning Maps without duplicating canonical identity incorrectly? |
| Search | How does existing sMap/search navigation focus the center canvas? |
| Multi-tab behavior | What happens when the same Planning Map is open in more than one editor-like tab? |
| Dirty state | How should unsaved presentation edits differ from durable PlanningMap mutations if mutations are persisted eagerly? |
| Export | Is a static image/Mermaid/export needed in Phase 5, or should it remain deferred until the live workflow is proven? |

## Decisions to settle before Phase 5 prompt decomposition

All ten primary questions should be answered before the final `/prompt-ass -> /prompt-plan -> /prompt-write p5` decomposition.

The most architecture-sensitive decisions are:

1. visual grammar;
2. semantic zoom/focus behavior;
3. direct-manipulation transformation semantics;
4. Planning Map lifecycle/branching;
5. WorkItem derivation;
6. adoption granularity;
7. stale/rebase interaction;
8. reconciliation/closeout semantics.

Canvas-library selection should follow these product decisions rather than define them.

## Relationship to existing authority

This worksheet is subordinate to:

- `docs/planning/p5/activation.md`
- `docs/planning/p5/phase-5-plan.md`
- `docs/decisions/0017-visual-planning-map-and-work-model.md`
- `docs/decisions/0008-software-map-terminology-and-workbench-placement.md`
- `docs/PRODUCT-MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/stability-contract.md`
- `docs/roadmap/mvp-roadmap.md`

Resolved answers should be promoted into those authorities through `/docs-review -> /docs-apply`. The worksheet remains planning context rather than competing canonical product authority.
