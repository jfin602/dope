# ADR 0017 — Visual Planning Map and graph-derived work model

Status: Accepted
Date: 2026-10-01
Builds on: ADR 0007, ADR 0008, ADR 0009
Supersedes for forward planning ontology: historical Product Phase 3 Plan/PlanStep/Task model

## Context

Dope deliberately removed the qualified Phase 3 Planning implementation before building the Physical Map. That prevented an early task-first ontology from constraining the software-map-centered architecture.

Phase 4 now provides canonical developer-owned architecture, deterministic source-backed Physical Map evidence, implementation realization/drift, project-local Software Map persistence and the sMap inspector.

Phase 5 must turn that substrate into visual planning without creating a disconnected diagram database, silently changing architecture authority, or reviving Phase 3 compatibility complexity. It also needs explicit staleness semantics because code and canonical architecture may change after a target plan is created.

## Decision

### Forward planning ontology

The Phase 5 ontology is:

```text
PlanningMap
-> PlannedTransformation
-> WorkItem
```

Phase 5 does not restore `Plan -> PlanStep -> Task` and does not reuse or migrate `.dope/planning.json`.

### Planning Maps reference reality

A PlanningMap references canonical and Physical Map identities rather than cloning current architecture. Planned new architecture nodes may carry intended future canonical IDs but remain planned until explicit adoption.

A diagram is a projection of domain state. Node coordinates, viewport, selection, collapsed state, tabs and panel geometry are presentation state.

### Transformations are architectural intent

Initial PlannedTransformation operations are add, modify, remove, move, split, merge, redirect relationship and change contract.

The target remains distinct from canonical authority and physical truth.

### WorkItems are implementation planning

A WorkItem is a bounded actionable unit associated with one or more transformations. WorkItem mutation is not architectural mutation. Completing a WorkItem does not imply tests passed, canonical architecture changed, or implementation physically matches the target.

### Explicit target adoption

Editing a PlanningMap never silently writes canonical architecture.

**Adopt Target** validates the target, presents canonical changes and requires developer acceptance before updating canonical architecture through the existing authority boundary.

### Planning persistence

Durable Phase 5 planning state is project-local and versioned at `.dope/planning-maps.json`.

Repository + `.dope/` must be sufficient to recover PlanningMap/WorkItem truth. Historical `.dope/planning.json` is not a compatibility source. Machine-local caches and presentation/layout state are disposable and non-canonical.

### Explicit planning basis and staleness

Every PlanningMap records the canonical architecture revision/fingerprint and Physical Map input fingerprint/generation it branched from.

When either changes, the PlanningMap becomes visibly **stale**. Dope does not silently reinterpret or rebase it.

### Rebase is explicit and conflict-aware

Rebase compares old basis, current basis and target transformations. It surfaces removed/replaced referenced nodes, hierarchy/parent changes, identity changes, dependency/contract changes, relationship changes, already-realized transformations and implementation realized differently.

Non-conflicting refresh may be automated only inside an explicitly initiated rebase. The developer reviews the result.

### Reconciliation compares target with fresh physical truth

After implementation Dope deterministically re-analyzes the repository and compares the fresh Physical Map with the target.

Retained outcomes include implemented as planned, implemented differently, not implemented and unexpected implementation.

Reconciliation never silently changes canonical architecture or target intent and never promotes WorkItem completion into physical evidence.

### Center-workspace visual contract

ADR 0008 placement remains: sMap inspector left, Physical/Planning Map tabs center, later Agent Mind/chat right, execution diagnostics bottom.

Semantic zoom is architectural: System -> Subsystem -> Component -> Code. Visual detail changes must preserve identity and source navigation.

### Provider-free Phase 5

Visual Software Planning must work with no model configured. General AI Presence, Agent Mind, ProposedAction, tool authority and delegation remain later phases.

## Locked visual workflow

Phase 5 uses the following visual interaction contract.

### Default architecture view

Opening the Physical Map defaults to a clean architecture overview showing **Systems plus their immediate Subsystems**. Components and Code are not shown by default. In a one-System project, that System becomes the main frame and its Subsystems provide the first useful structure.

Reopening restores the last valid visual position when possible. **Fit Architecture** always returns to the high-level overview.

### Visual grammar

System / Subsystem / Component / Code identity is communicated primarily through structure, scale, shape, iconography, containment and edge semantics. Color reinforces meaning but is never the only carrier of state.

Containment and dependency relationships use distinct treatments. Canonical, physical, planned, drift, stale and conflict states use concise badges, borders or line treatments layered onto the architectural object rather than replacing its identity. Dense evidence/provenance remains in the sMap inspector.

### Semantic navigation

Use both geometric zoom and explicit architectural navigation:
- **Focus** opens a branch-centered map;
- **Up** returns one architecture level;
- **Fit Architecture** returns to the project overview.

Selection and stable identity survive semantic-detail changes. Cross-boundary dependencies remain visible in simplified form. Source navigation must round-trip back to the same map context.

Any supported System, Subsystem, Component or architecture branch may be opened as its own focused map in a separate center-workspace tab. These tabs are projections of shared state, not copies.

### Direct manipulation

Direct manipulation is allowed only when architectural intent is unambiguous. Every accepted gesture becomes an explicit typed PlannedTransformation:
- moving a Component between Subsystems -> `move`;
- drawing/redirecting a dependency -> relationship transformation;
- adding a target node -> `add`;
- removing from target -> `remove` without deleting physical truth.

Semantically rich operations such as `split`, `merge` and `change contract` use focused commands/editors. Show the semantic operation before commit. Unadopted planning edits support domain-level undo/redo.

### Physical-versus-target comparison

The primary Planning Map is an **overlay/diff view** over referenced physical/canonical structure. Unchanged reality remains visible while target changes are layered on top.

Provide **Current only / Target only / Diff** modes. Side-by-side comparison is secondary, not the default.

### Planning Map lifecycle and branching

A project may have multiple durable Planning Maps. The lifecycle is:

`Draft -> Active -> Completed -> Superseded / Archived`.

Developers may explicitly duplicate/branch maps to explore alternative designs. Multiple maps may be active at once. Incompatible overlapping active maps surface explicit conflicts; Phase 5 does not auto-merge them.

Completed/superseded maps remain durable project history but are hidden from the ordinary active workspace by default.

### WorkItems

PlannedTransformations are the architectural source for work. Dope may deterministically suggest WorkItem groupings/dependencies, but the developer explicitly accepts, edits, splits or merges them.

One transformation may require several WorkItems; one WorkItem may cover several tightly related transformations.

WorkItems live primarily in a dedicated work projection rather than becoming architecture nodes. WorkItem and transformation selections highlight each other bidirectionally.

### Bounded target adoption

**Adopt Target** may adopt a coherent System, Subsystem, Component branch or compatible transformation set rather than requiring whole-map adoption.

Dope includes deterministic required dependencies when safe or blocks adoption until unresolved dependencies/conflicts are addressed. Before acceptance, show a canonical-architecture diff.

Partial adoption leaves the remaining target intact and visibly distinguishes adopted target from still-planned target.

### Localized staleness and explicit rebase

Track staleness at whole-map, affected-branch and individual-transformation levels. Unrelated physical changes may refresh context without marking unrelated work stale.

Rebase uses an explicit three-way comparison:

```text
Old basis
-> Current reality
-> Target intent
```

Unaffected references may advance during the explicit operation. Conflicted transformations require developer resolution. Already-realized and differently-realized transformations are identified rather than silently rewriting the plan.

### Reconciliation and closeout

Reconciliation is transformation-centered with rollups to WorkItems, branches and the whole Planning Map.

At minimum retain:
- Implemented as planned;
- Implemented differently;
- Not implemented;
- Unexpected implementation.

Original target intent is preserved. **Implemented differently** may be an accepted final outcome.

A Planning Map becomes **Completed only through explicit developer closeout**. Every transformation must be resolved, accepted as intentionally different, deferred into another Planning Map, or explicitly abandoned. Completed maps preserve intended-versus-realized history.

## Consequences

Dope regains planning as a graph-centered product rather than restoring Phase 3. Architecture intent, canonical authority and physical evidence remain independently inspectable. Planning survives restart/copy/reopen without Theia or provider dependence. Staleness, rebase and adoption become explicit developer decisions. A visualization library can be replaced without migrating canonical planning semantics.
