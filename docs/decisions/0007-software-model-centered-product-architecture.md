# ADR 0007 — Software-model-centered product architecture

Status: Accepted
Date: 2026-09-28

## Context

Dope already treated a living software model, conceptual observability and visual planning as important long-term ideas, but the active roadmap deferred ArchitectureModel and visual architecture work until after the initial AI phases.

Further product planning established that this sequencing is backwards for the intended product.

The developer should be able to understand the software that exists, reason about it at architectural scale, design a target system visually, connect that design directly to executable planning state, implement the change, and then reconcile intent against the code that actually exists.

This requires the software model to be core infrastructure rather than a later visualization feature.

The owner also builds software modularly and intends Dope-native software to make systems and subsystems explicit. The software model must therefore represent architecture above the file/symbol level instead of treating folders or inferred dependency clusters as the primary design.

## Decision

Dope is software-model-centered.

The primary architecture hierarchy is:

Project
-> System
-> Subsystem
-> Component
-> CodeEntity

Systems and especially Subsystems are first-class modular architecture objects with stable identity, purpose, owned implementation, public contracts, dependencies, forbidden dependencies, entry points, owned data, tests and child components as applicable.

### Physical Software Model

Dope owns a language-independent Physical Software Model representing implemented reality.

Physical source facts are produced by deterministic language/framework analyzers. Runtime relationships come from recorded observations. Inferred semantic relationships remain explicitly inferred.

Every physical node/relationship must retain provenance sufficient to explain why Dope believes it exists.

The extracted physical graph is rebuildable derived state. Developer-authored System/Subsystem declarations and architecture constraints are canonical project architecture state.

AI may explain, classify, group or propose architecture, but AI output cannot silently become physical software truth.

### Analyzer boundary

Semantic analyzers are language-specific adapters that emit the common Dope software graph.

The first implementation is TypeScript/JavaScript-first because Dope itself is the initial dogfood target. This does not make TypeScript concepts canonical product ontology.

Framework-specific deterministic extractors may enrich the graph where explicit recognition rules support concepts such as routes, jobs or schemas.

### Visual projections

Architecture diagrams are projections of shared software-model state.

Do not make a diagram canvas an independent architecture database.

Semantic zoom should allow movement from System -> Subsystem -> Component -> CodeEntity -> source while retaining identity.

### Planning graph

Planning diagrams stem from the physical model.

Existing physical nodes are referenced by identity, not duplicated. Plans can add proposed nodes or transformations such as add, modify, remove, move, split, merge, redirect relationship or change contract.

Physical/current and planned/target state must remain unambiguous.

Planning transformations connect to canonical Plan, PlanStep and Task execution intent.

### Reconciliation

After implementation Dope re-analyzes the repository and compares the resulting physical model with the target planning graph.

Reconciliation may identify:
- implemented as planned;
- implemented differently;
- not implemented;
- unexpected implementation.

Completing a Plan or Task never makes proposed architecture physical truth by itself.

## Roadmap consequence

The initial roadmap becomes:

Foundation Spike 0 — qualify Theia
-> Phase 1 — IDE Alive
-> Phase 2 — Project Mind
-> Phase 3 — Planning Foundation
-> Phase 4 — Physical Software Model
-> Phase 5 — Visual Planning
-> Phase 6 — AI Presence
-> Phase 7 — Scoped Delegation
-> Phase 8 — Development Sessions

The active Phase 3 implementation scope remains bounded. This ADR does not pull code analysis or diagram implementation into the current p3 task stack.

The prior Phase 4 AI Presence planning worksheet is retained and renumbered for Product Phase 6.

## Architectural constraints

- The software model is independent from Theia and any diagram/graph rendering library.
- The software model is independent from model/provider runtimes.
- Source analysis and graph construction are separable from visualization.
- The normalized graph is language-independent; analyzers are language-specific.
- Subsystem declarations do not reduce to directory names.
- Declared subsystem boundaries can be validated against extracted dependency relationships.
- Physical evidence, runtime observation, inference, developer-authored target state and agent proposal state remain distinguishable.
- No provider-specific object becomes canonical software-model identity.
- Dogfooding on Dope must not make the model specific to TypeScript/Theia.

## Consequences

- ArchitectureModel is no longer deferred beyond the initial roadmap.
- Visual planning is no longer a detached future canvas feature.
- AI Presence is intentionally delayed until the physical and planning models can supply structured architectural context.
- Agent context can later be assembled around Systems/Subsystems/Components rather than repeatedly reconstructing architecture from arbitrary files.
- Dope can eventually diagnose architectural boundary violations in addition to language/compiler errors.
- Planning and implementation gain an explicit target-versus-physical reconciliation loop.

## Revisit when

Revisit graph storage/indexing technology, analyzer implementation choices and rendering technology as evidence is gathered.

Do not revisit the core separation between physical evidence and proposed intent merely because an AI model can infer architecture conveniently.
