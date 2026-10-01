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

## Consequences

Dope regains planning as a graph-centered product rather than restoring Phase 3. Architecture intent, canonical authority and physical evidence remain independently inspectable. Planning survives restart/copy/reopen without Theia or provider dependence. Staleness, rebase and adoption become explicit developer decisions. A visualization library can be replaced without migrating canonical planning semantics.
