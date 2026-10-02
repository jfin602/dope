# Product Phase 6 — Data Flow Activation

Status: **OWNER APPROVED — ACTIVE / PLAN APPLIED**
Date: 2026-10-02
Package baseline: `0.6.0`
Activation baseline commit: `710edb362f9881ab41215705db4f08d8daca6293`
Authority: ADR 0020, `docs/planning/p6/phase-6-plan.md`, current Software Map / Physical Map contracts, Phase 5 owner closeout

## Entry disposition

Product Phase 5 — Visual Software Planning is owner-closed for sequencing.

Phase 5 qualification remains explicitly incomplete:
- P11 is Not Green;
- P12 was not executed;
- owner acceptance is a sequencing waiver, not retroactive qualification.

The retained Phase 5 implementation is the substrate for Data Flow. Missing Phase 5 evidence is revisited only when it materially blocks Phase 6 implementation/qualification or later roadmap work.

## Phase purpose

Phase 6 adds a provider-free **Data Flow** projection to the Physical Map so developers can follow evidence-backed information movement through existing software identities.

Architecture answers what exists and how it is organized. Data Flow answers how information moves through it.

Initial direction:
- System-first, with Subsystem focus;
- directional layout for readability without implying synchronous/sequential execution;
- evidence-backed Input / Boundary / Transformation / Store / External / Output projection roles;
- branch, join, fan-out, cycle, retry and async/external paths remain representable;
- payload/type/schema/event identity only when evidence supports it;
- source/provenance navigation on representative hops;
- Architecture <-> Data Flow switching preserves selected/focused identity.

## Architecture boundary

Data Flow is **not**:
- a fourth canonical map;
- a separate durable `DataFlowMap` database;
- new canonical System/Subsystem/Component kinds;
- AI-inferred physical truth;
- a Planning Map replacement.

It is a projection of existing Physical Map reality and evidence. Analyzer/query enrichment may deepen the underlying physical relationships, but every physical hop remains explainable through deterministic evidence or recorded runtime observation.

## Provider boundary

Phase 6 requires no model provider.

Do not introduce:
- general AI Presence / Agent Mind;
- OpenAI/Codex product-runtime dependency;
- autonomous explanation as physical truth;
- mutation/tool authority;
- scoped delegation;
- mandatory live runtime tracing.

General AI Presence is Product Phase 7.

## Framework/version boundary

- Dope package family: `0.6.x`;
- Theia remains `1.75.0` unless a separate framework-upgrade decision changes it;
- Electron remains `42.8.1`;
- Phase 6 planning starts from the coherent `0.6.0` owner-close baseline;
- no Phase 6 implementation is included in the baseline transition itself.

## Qualification direction

The principal dogfood specimen should remain a real mapped project such as Adaptive SEO.

Phase 6 qualification should prove, with no model configured, that a developer can:
- focus a representative System;
- switch Architecture -> Data Flow;
- follow a non-trivial evidence-backed path from input through processing and persistence/external boundary to output;
- inspect representative edge provenance and navigate to source;
- focus into a Subsystem without forking identity;
- observe a branch/fan-out or join;
- return to Architecture with selection/focus preserved.

## Applied Phase 6 plan

The approved implementation/qualification decomposition is documented in `docs/planning/p6/phase-6-plan.md` and `docs/tasks/p6/README.md`.

Expected versions:
- P1 `0.6.1` through P8 `0.6.8`.

## Next workflow

`/prompt-ass -> /prompt-plan -> /prompt-write p6`

Do not execute Phase 6 implementation until the executable prompt stack is written and validated.
