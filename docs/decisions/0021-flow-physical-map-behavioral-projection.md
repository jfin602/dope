# ADR 0021 — Flow as the Physical Map behavioral projection

Status: Accepted
Date: 2026-10-02
Builds on: ADR 0007, ADR 0008, ADR 0009, ADR 0017, ADR 0019, ADR 0020
Amends: ADR 0020 Phase 6 naming and minimum Flow semantics

## Context

ADR 0020 correctly identified a missing layer between architecture/planning and general AI Presence: Dope needs a directional explanation of how software behaves through real entry points, processing, state and external boundaries.

During Phase 6 planning, the narrower **Data Flow** framing created an unnecessary requirement: it suggested that every useful edge must prove data/payload movement. That would push the phase toward interprocedural data-lineage or taint-style analysis before Dope can answer a more immediate and valuable question:

> When this thing happens, what happens next through the software?

The current Physical Map already explains structure. The next missing substrate is application-level execution/behavioral flow.

## Decision

### Rename Product Phase 6 to Flow

The current roadmap term is:

```text
Phase 4 — Physical Map
Phase 5 — Visual Software Planning
Phase 6 — Flow
Phase 7 — AI Presence
Phase 8 — Scoped Delegation
Phase 9 — Development Sessions
```

ADR 0020's sequencing decision remains accepted. Only the Phase 6 product name and minimum semantics are broadened.

### Flow is application-level execution, not a compiler CFG

Flow is a directional Physical Map projection that explains application behavior across stable Software Map identities and derived physical endpoints.

It may represent evidence-backed interactions such as:
- inbound request/event -> handler;
- project-code caller -> callee invocation;
- processing -> persistence read/write;
- producer -> queue/topic -> consumer;
- application -> external service;
- handler/service -> response/output.

Flow does **not** mean compiler basic blocks, statement-by-statement control flow, dominator trees, or exhaustive language-level CFG visualization.

### Deterministic invocation is sufficient Flow evidence

A deterministically resolved project-code call is a valid Flow interaction even when Dope cannot prove which specific argument fields or return values matter.

This creates the initial capability ladder:

```text
architecture structure
-> execution/invocation Flow
-> state/boundary Flow
-> optional data/type/schema annotations
-> richer lineage later
```

Data semantics enrich Flow; they do not gate the existence of an otherwise-proven execution edge.

### Structural dependency is still not execution

The negative invariant becomes:

```text
import != invocation
reference != invocation
dependency != execution flow
```

Imports, references and aggregated architecture dependencies may guide discovery, but cannot independently produce a Flow hop.

### One physical Flow substrate

Phase 6 does not create separate `ControlFlowFact` and `DataFlowFact` domains.

Use one presentation-independent evidence-backed physical Flow fact model. A Flow fact may carry optional data/type/schema/event annotations when separately evidenced.

Initial Phase 6 interaction semantics are:
- `receives`;
- `invokes`;
- `reads`;
- `writes`;
- `calls-external`;
- `publishes`;
- `consumes`;
- `responds`.

`returns` is not a separate base interaction in Phase 6; return information enriches invocation/output semantics when evidenced. Data/type/schema/event information remains optional enrichment.

### Projection roles

Initial contextual roles are:
- Input;
- Boundary;
- Processing;
- Store;
- External;
- Output.

Roles are view semantics, not canonical architecture node kinds.

### Static and observed Flow

Static deterministic evidence establishes possible application execution relationships.

Future recorded-runtime evidence may identify an **observed** execution path. Static Flow must not be presented as proof that one concrete runtime request executed every reachable branch.

### Provider and persistence boundaries remain unchanged

Phase 6 remains provider-free.

Flow is rebuildable Physical Map-derived state. There is no required `.dope/flow.json` or separate Flow database.

AI may later explain Flow in Phase 7, but AI output does not silently establish physical Flow truth.

## Consequences

Dope can deliver a useful execution map before solving full data lineage.

Generic TypeScript call resolution becomes immediately valuable. Framework extractors then add request/response, persistence, event and external boundaries. Optional data semantics can grow progressively without redesigning the projection.

The center Physical Map terminology becomes:

```text
[ Architecture ] [ Flow ]
```

The existing Phase 6 P1-P8 decomposition and `0.6.x` versions remain valid, with scope reframed around Flow.
