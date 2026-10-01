# ADR 0020 — Data Flow as a Physical Map projection and Product Phase 6

Status: Accepted
Date: 2026-10-01
Builds on: ADR 0007, ADR 0008, ADR 0009, ADR 0017, ADR 0019
Amends future sequencing in: ADR 0005, ADR 0006, ADR 0007

## Context

Dope's active roadmap reaches Product Phase 5 — Visual Software Planning before general AI Presence. Phase 4 established the evidence-backed Software Map/Physical Map substrate; Phase 5 adds visual target design, graph-derived work and deterministic reconciliation.

The Software Map can answer architectural questions such as what Systems, Subsystems, Components and code entities exist and how they relate. A second high-value question remains distinct: how information moves through those same implemented structures from inputs through processing, persistence and external boundaries to outputs.

Putting general AI Presence immediately after Visual Software Planning would make AI consume a weaker project model than necessary. Data Flow belongs in the software-understanding substrate and should be qualified before general AI becomes a first-class collaborator.

## Decision

### Roadmap insertion

Insert a new provider-free phase before AI Presence:

```text
Phase 4 — Physical Map
Phase 5 — Visual Software Planning
Phase 6 — Data Flow
Phase 7 — AI Presence
Phase 8 — Scoped Delegation
Phase 9 — Development Sessions
```

This insertion does not change active Phase 5 scope, P11/P12 qualification criteria or the current `0.5.x` package line. Phase 6 begins only after Phase 5 closeout establishes the `0.6.0` successor baseline.

ADR 0006's decision to use OpenAI/Codex as the first reference implementation for general AI remains accepted; its activation moves with AI Presence from the historical Phase 6 numbering to Product Phase 7.

### Data Flow is a Physical Map projection

Do not create a fourth canonical map or independent `DataFlowMap` authority.

The Software Map continues to separate canonical architecture, Physical Map reality and Planning Map target intent. Data Flow is an evidence-backed directional **projection of the Physical Map**.

The center Physical Map surface may therefore offer complementary views such as:

```text
[ Architecture ] [ Data Flow ]
```

Architecture answers **what exists and how it is organized**. Data Flow answers **how information moves through it**.

Both views consume the same stable System / Subsystem / Component / CodeEntity identities. Switching views preserves selected/focused architectural scope and source-navigation context.

### Scope and visual semantics

Initial Data Flow scope is **System-first**, with Subsystem focus supported. Project-wide flow may be added when it remains readable and performant; it is not required to force all flows into one graph.

The layout should be directional, normally left-to-right or top-to-bottom, to make input -> processing -> output paths easy to follow. Directional layout is presentation state and must not imply that execution itself is synchronous, sequential or acyclic.

Branches, joins, fan-out, cycles, retries, asynchronous boundaries and external round trips remain representable.

The projection may use roles such as:
- Input;
- Boundary;
- Transformation;
- Store;
- External;
- Output.

These are projection roles, not new canonical architecture node kinds.

### Flow evidence

Physical flow follows the same evidence rule as the Physical Map: Dope must be able to explain why it believes a relationship exists.

Supported analyzers/query layers may derive flow from evidence such as:
- route/request/response registration;
- symbol references and calls;
- type/schema relationships;
- serialization/deserialization;
- persistence reads and writes;
- event/job/queue production and consumption;
- framework bindings;
- external API/client calls;
- recorded runtime observations.

Edges may carry payload/type/schema/event identity only when evidence supports that detail.

If Dope can establish a relationship but cannot establish the payload, the relationship remains visible with unknown payload. If Dope cannot establish a hop, it must not invent one.

AI may later explain, summarize or propose interpretations of flow, but AI output does not silently become physical flow evidence.

### Provider-free Phase 6

Product Phase 6 requires no model provider.

It does not introduce:
- general AI Presence or Agent Mind;
- mutation/tool authority;
- scoped delegation;
- autonomous planning;
- a required live runtime tracer;
- a separate durable Data Flow database.

Recorded runtime observations may enrich flow evidence when available, but Phase 6 qualification must work from deterministic/reproducible project evidence without requiring a running traced system.

### Relationship to Planning

Phase 6's initial Data Flow mode is read-only Physical Map functionality.

A future Planning Map Data Flow projection may visualize planned relationship/contract changes using the existing PlannedTransformation model, but Phase 6 does not create a second planning ontology or expand Phase 5 qualification retroactively.

### AI Presence follows the richer model

When Product Phase 7 AI Presence begins, read-only AI context may include:
- Project Mind;
- canonical architecture;
- Physical Map Architecture projection;
- Physical Map Data Flow projection;
- active Planning Maps / transformations / WorkItems;
- ordinary editor/project context.

This preserves the product principle that AI consumes Dope-owned structured understanding rather than substituting for missing project understanding.

## Qualification direction

The principal Phase 6 dogfood specimen should include a real mapped project such as Adaptive SEO.

Qualification should prove, with no model configured, that a developer can:
- focus a representative System;
- switch Architecture -> Data Flow;
- follow a non-trivial evidence-backed path from input through transformation and persistence and/or an external boundary to output;
- inspect representative edge provenance and navigate it to source;
- focus into a Subsystem without forking identity;
- observe at least one branch/fan-out or join;
- return to Architecture with selection/focus identity preserved.

## Consequences

Dope gains a second major explanatory projection without fragmenting the Software Map domain.

General AI moves one phase later but starts with materially richer structured context.

Analyzer/query work may need to deepen around data-bearing relationships, but those additions strengthen the Physical Map rather than creating a provider-dependent inference layer.

The roadmap becomes:

```text
understand structure
-> design change
-> understand information flow
-> add observable AI assistance
-> add bounded mutation/delegation
-> make development sessions durable
```
