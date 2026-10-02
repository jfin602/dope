# Product Phase 6 — Data Flow Plan

Status: **OWNER APPROVED / ACTIVE PLAN**
Baseline: `0.6.0`
Activation baseline: `710edb362f9881ab41215705db4f08d8daca6293`
Execution folder: `p6`

Authority:
- ADR 0020 — Data Flow as a Physical Map projection;
- Phase 6 activation;
- Software Map / Physical Map contracts;
- current PRODUCT-MODEL / ARCHITECTURE / stability contract;
- Phase 5 owner closeout as sequencing entry disposition.

## Objective

Make Dope explain evidence-backed information movement through implemented software without requiring a model provider.

North-star question:

> Can I pick a System and follow how real information enters it, moves through it, touches state or another boundary, and leaves it—and can Dope prove every hop to me?

## Product invariants

1. Data Flow is a Physical Map projection, not a fourth canonical map.
2. Stable System / Subsystem / Component / Code identities remain shared between Architecture and Data Flow.
3. Data Flow is rebuildable derived state; no new required Data Flow persistence store is introduced.
4. Every rendered flow hop has dedicated deterministic evidence or recorded-runtime evidence.
5. `import`, `reference` and architecture `depends-on` facts alone do not prove data movement.
6. Unknown payload or missing hops remain unknown/missing rather than inferred for visual completeness.
7. Flow roles are projection semantics, not canonical architecture node kinds.
8. Data Flow queries are bounded and generation/project guarded.
9. Directional layout is presentation state and does not imply synchronous, sequential or acyclic execution.
10. Phase 6 works with no model provider.
11. AI Presence, Agent Mind, tool authority and delegation remain Phase 7+.

## Domain model

### PhysicalFlowFact

Introduce a language-independent derived physical-flow fact inside `@dope/software-map`.

A fact owns:
- deterministic stable ID for unchanged evidence/input;
- typed directional flow semantic;
- source and target identity references;
- evidence IDs;
- optional origin flow fact IDs when an architecture-level/aggregated hop summarizes lower-level facts;
- optional evidenced payload/type/schema/event label;
- explicit unknown/unsupported detail where applicable.

Source/target may reference existing Software Map nodes or stable derived physical endpoints such as an inbound route boundary, store, queue or external service. Derived endpoints do not become canonical architecture nodes.

Initial flow semantics should cover the concrete Phase 6 slice rather than a universal ontology. Required categories are inbound input/boundary, internal invocation, transformation, persistence read/write, external request/round trip and output/response. Producer/consumer event semantics may be added where deterministic qualification evidence exists.

### FlowRole

Projection roles:
- Input;
- Boundary;
- Transformation;
- Store;
- External;
- Output.

A single identity may have different roles in different focused projections. Roles are never written into canonical architecture.

## Evidence rules

The negative invariant is permanent:

```text
import != call
reference != value flow
dependency != data flow
```

An import/reference/dependency may help locate candidates or explain architecture, but no Data Flow edge is emitted from that fact alone.

Physical flow is backed by deterministic syntax/semantic/framework evidence or explicit recorded runtime observation. AI output remains explanation/proposal only.

Payload/type/schema/event labels appear only when supported by evidence. Unknown remains unknown.

## Analyzer plan

### Generic TypeScript invocation

Use TypeScript compiler/type-checker semantics to resolve supported `CallExpression` targets into project code. Emit physical invocation flow facts only when the target is deterministically resolved.

Do not turn general identifier references into calls. Declaration files may support type resolution without becoming ordinary physical code nodes, following existing analyzer boundaries.

### Adaptive SEO boundary vertical slice

Add bounded deterministic extractors sufficient to qualify a real Adaptive SEO flow. Inspect actual Adaptive SEO source before implementation; expected useful surfaces include:
- Express-style route/request/response handling;
- PostgreSQL persistence reads/writes;
- supported external HTTP/client boundaries where present.

Extractor contracts must be replaceable and evidence-backed. Do not hardcode Adaptive SEO file paths, IDs or expected answers.

Do not promise arbitrary Express variants, all database libraries or all Node frameworks in Phase 6.

## Query model

Add a provider-independent generation-scoped Data Flow query over the published Physical Map.

The query must:
- be focused/bounded by System or Subsystem context;
- aggregate lower-level facts to the active architectural detail level;
- retain origin/evidence traceability;
- preserve branches, joins, cycles and external round trips;
- expose explicit unknown/truncated/unsupported state;
- use deterministic ordering/stable IDs;
- reject stale project/generation publication.

React Flow/browser presentation must not own flow discovery, aggregation or truth.

## Projection and layout

The initial Data Flow projection is directional and normally left-to-right.

Use deterministic layered layout implemented in Dope presentation/projection code. Support:
- entry lanes;
- transformations;
- stores/external boundaries;
- outputs;
- fan-out/branch;
- joins;
- explicit cycles/back-edges.

Do not add Dagre/ELK or another automatic layout dependency in the initial stack. A future bounded correction may add one only if real qualification shows the deterministic layout is inadequate.

## UI integration

The existing center Physical Map workspace gains complementary projection modes:

`[ Architecture ] [ Data Flow ]`

Do not create an independent Data Flow state owner/widget hierarchy.

Switching mode preserves:
- workspace/project;
- selected/focused architecture identity;
- System/Subsystem focus;
- source navigation context.

Data Flow edges are inspectable. Edge inspection exposes evidence/provenance and ordinary source navigation. Detailed evidence remains compatible with the left sMap inspector/provider-free explanation surface.

## Persistence

No `.dope/data-flow.json` is introduced.

Physical flow facts/projections are derived from source/config/canonical inputs and supported runtime observations. Restart/copy qualification rebuilds equivalent flow rather than recovering a separate persisted flow authority.

## Phase stack

| Prompt | Version | Boundary | Tier | Model | GUI |
| --- | --- | --- | --- | --- | --- |
| P1 | `0.6.1` | physical-flow domain contracts, evidence validation, deterministic IDs | T1 | GPT-6 Sol High | no |
| P2 | `0.6.2` | generic TypeScript internal-call flow extraction | T1 | GPT-6 Sol High | no |
| P3 | `0.6.3` | Adaptive SEO boundary extractors: supported Express/PostgreSQL/external vertical slice | T2 | GPT-6 Sol High | no |
| P4 | `0.6.4` | Data Flow query/path aggregation, generation guards and diagnostics | T2 | GPT-6 Sol High | no |
| P5 | `0.6.5` | pure directional projection and deterministic layered layout | T1 | GPT-6 Sol High | no |
| P6 | `0.6.6` | Architecture/Data Flow UI, edge inspection, source navigation and focus identity | T2 | GPT-6 Sol High | no |
| P7 | `0.6.7` | direct Adaptive SEO Data Flow qualification plus exact-candidate T3 evidence | T3 | GPT-6 Sol High | yes |
| P8 | `0.6.8` | evidence-only Phase 6 closeout | T3 audit | GPT-6 Sol Medium | no |

## Validation discipline

P1/P2/P5 use T1 focused tests and affected builds only.

P3/P4/P6 are T2 because they cross analyzer/query/application/presentation boundaries. Run affected integration tests/builds, not the entire release matrix.

P7 owns direct real-GUI and broad exact-candidate evidence:
- Adaptive SEO Data Flow direct interaction;
- focused Phase 6 suites;
- current `npm run check`;
- restart integration;
- browser/Electron builds;
- Linux AppImage/package inspection and native launch;
- phase prompt validation;
- diff/version/no-root-lock coherence.

P8 is evidence-only. It must not repair P7 failures.

## P7 dogfood target

Use a fresh disposable copy of the mapped accepted Adaptive SEO workspace. Keep the accepted reference unchanged.

Directly prove:
- focus a representative System;
- Architecture -> Data Flow switch;
- one real non-trivial evidence-backed input -> processing -> persistence and/or external boundary -> output path;
- representative edge provenance and source navigation;
- Subsystem focus without identity fork;
- at least one real branch/fan-out or join;
- Data Flow -> Architecture return with focus/selection preserved;
- no model/provider required.

A controlled fixture may supplement cycles/retries/rare shapes but cannot replace the real Adaptive SEO path.

## Explicit non-goals

Phase 6 does not implement:
- whole-program variable/taint analysis;
- arbitrary cross-language lineage;
- exhaustive SQL/table/column lineage;
- mandatory runtime tracing;
- AI-generated missing hops or flow explanations as physical truth;
- Planning Map Data Flow editing;
- persisted Data Flow database/state;
- general AI Presence / Agent Mind;
- mutation/tool authority or delegation;
- a framework upgrade;
- arbitrary Node/DB framework coverage.

## Exit condition

Phase 6 is qualified when, on one exact provider-free candidate, a developer can use the real Dope GUI to follow a meaningful evidence-backed Data Flow through a real mapped project, prove every representative hop to source/provenance, preserve architectural identity/focus across projection modes, observe non-linear flow shape, and reconstruct equivalent derived flow after restart/reanalysis—while aggregate/package/native evidence is Green for the designated T3 gate.
