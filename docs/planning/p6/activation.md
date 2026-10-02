# Product Phase 6 — Flow Activation

Status: **OWNER APPROVED — ACTIVE / PROMPTS WRITTEN / READY FOR EXECUTION**
Date: 2026-10-02
Package baseline: `0.6.0`
Activation baseline commit: `710edb362f9881ab41215705db4f08d8daca6293`
Authority: ADR 0020 as amended by ADR 0021, `docs/planning/p6/phase-6-plan.md`, current Software Map / Physical Map contracts, Phase 5 owner closeout

## Entry disposition

Product Phase 5 — Visual Software Planning is owner-closed for sequencing.

Phase 5 qualification remains explicitly incomplete:
- P11 is Not Green;
- P12 was not executed;
- owner acceptance is a sequencing waiver, not retroactive qualification.

The retained Phase 5 implementation is the substrate for Flow. Missing Phase 5 evidence is revisited only when it materially blocks Phase 6 implementation/qualification or later roadmap work.

## Phase purpose

Phase 6 adds a provider-free **Flow** projection to the Physical Map so developers can follow what happens through real software.

Architecture answers **what exists and how it is organized**.

Flow answers **what happens next through it**.

Flow is application-level execution/behavioral flow, not a compiler CFG. Deterministically resolved calls, request/response boundaries, persistence reads/writes, events/queues and external interactions may form the execution path. Proven data/type/schema semantics enrich those interactions when available.

## Architecture boundary

Flow is **not**:
- a fourth canonical map;
- a separate durable Flow database;
- a compiler basic-block/control-flow graph;
- new canonical System/Subsystem/Component kinds;
- AI-inferred physical truth;
- a Planning Map replacement.

It is a projection of existing Physical Map reality and evidence.

## Truth boundary

Permanent negative rule:

```text
import != invocation
reference != invocation
dependency != execution flow
```

A deterministically resolved invocation is valid Flow evidence even when its payload semantics are unknown.

Unknown payload remains unknown. Unknown execution hops remain gaps.

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
- Theia remains `1.75.0` unless separately changed;
- Electron remains `42.8.1`;
- Phase 6 starts from coherent `0.6.0`;
- the existing P1-P8 version sequence remains unchanged.

## Qualification direction

The principal dogfood specimen remains a real mapped project such as Adaptive SEO.

Phase 6 qualification should prove, with no model configured, that a developer can:
- focus a representative System;
- switch Architecture -> Flow;
- follow a non-trivial evidence-backed execution path from an input/boundary through internal processing and state/external interaction to output;
- inspect representative edge provenance and navigate it to source;
- focus into a Subsystem without forking identity;
- observe at least one branch/fan-out or join;
- return to Architecture with selection/focus preserved.

Payload/type/schema labels are useful enrichment where proven, not a prerequisite for the base execution path.

## Execution readiness

The ten Phase 6 Flow decisions are locked and the executable P1-P8 stack is written under `docs/tasks/p6/`.

Validate:

`npm run codex:phase:validate -- p6`

Then execute through the runner. P7 is the browser/manual qualification handoff and P8 is evidence-only closeout.
