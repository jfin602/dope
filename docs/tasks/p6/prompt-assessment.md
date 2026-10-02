# Product Phase 6 Prompt Assessment

Status: **APPROVED / PROMPTS WRITTEN / READY FOR EXECUTION**
Activation source/package baseline: `710edb362f9881ab41215705db4f08d8daca6293`, `0.6.0`
Current planning authority: ADR 0020 as amended by ADR 0021, `docs/planning/p6/phase-6-plan.md`, PRODUCT-MODEL, ARCHITECTURE and stability contract

## Conclusion

Use eight ordered prompts.

Phase 6 is a provider-free Physical Map **Flow** implementation. The dependency chain is:

physical Flow contracts/endpoints
-> generic TypeScript invocation extraction
-> Adaptive SEO HTTP/persistence/external boundary extraction
-> bounded Flow query/path aggregation + diagnostics
-> pure directional Flow projection/layout
-> Architecture/Flow UI + tracing/evidence/source navigation
-> direct Adaptive SEO GUI/restart/package qualification
-> evidence-only closeout.

| Prompt | Boundary | Validation tier | Routing |
| --- | --- | --- | --- |
| P1 | Physical Flow facts/endpoints/evidence/snapshot contracts | T1 | GPT-6 Sol High |
| P2 | generic TypeScript deterministic invocation Flow | T1 | GPT-6 Sol High |
| P3 | Adaptive SEO Express/PostgreSQL/external boundary extraction | T2 | GPT-6 Sol High |
| P4 | generation-scoped Flow query/path aggregation + diagnostics | T2 | GPT-6 Sol High |
| P5 | pure directional Flow projection/layout | T1 | GPT-6 Sol High |
| P6 | Architecture/Flow UI, tracing, edge inspection/source navigation | T2 | GPT-6 Sol High |
| P7 | direct Adaptive SEO Flow qualification + exact-candidate release evidence | T3 | GPT-6 Sol High |
| P8 | evidence-only Phase 6 closeout | T3 audit | GPT-6 Sol Medium |

Versions are exactly `0.6.1` through `0.6.8`.

P1-P6 are implementation/integration prompts. P7 is the browser/manual qualification handoff. P8 is evidence-only closeout.

## Current source findings

### Software Map core

- `packages/software-map/src/contracts.ts` currently gives `PhysicalMapSnapshot` only `nodes`, structural `relationships`, `evidence` and `violations`. Flow facts/endpoints/coverage are not yet represented.
- `packages/software-map/src/graph.ts` owns snapshot validation, deterministic dedupe/order and lower-level relationship identity. P1 should extend this existing truth boundary rather than create a parallel Flow graph package.
- Existing `EvidenceClass` already includes deterministic syntax/semantic/framework, aggregate and runtime evidence. Flow should reuse that provenance vocabulary; it does not need a second evidence system.
- Existing aggregate structural relationships use origin IDs. The Flow equivalent should retain `originFlowFactIds` so P4 aggregation and P6 edge inspection stay traceable.

### Analyzer seam

- `packages/code-analysis/src/index.ts` currently returns nodes, structural relationships, evidence, optional synthesis-oriented `FrameworkFact[]`, analysis status and reuse diagnostics. Flow producers should extend the analysis result with dedicated physical Flow outputs rather than overloading `FrameworkFact`, whose meaning is architecture-synthesis evidence.
- `packages/code-analysis-typescript/src/index.ts` already builds real TypeScript Programs/type checkers, resolves aliases/modules/symbol declarations, emits stable code/evidence identities, excludes `.dope/`, and visits `CallExpression` for CommonJS require handling. P2 can add deterministic project-call resolution without replacing the analyzer.
- Adaptive SEO route handlers are commonly inline arrow/function callbacks. A useful HTTP -> handler -> internal-call path therefore needs deterministic physical identity for supported anonymous callables. P2/P3 must not incorrectly map request execution to the startup-time route-registration function.
- `packages/code-analysis-typescript/src/framework-extractor.ts` is currently Theia/Inversify architecture evidence. P3 should add a dedicated Flow-extractor seam rather than make synthesis-oriented framework facts physical execution truth.

### Publication/index seam

- `packages/code-analysis/src/node/software-map-index.ts` is the per-project in-memory publisher. It owns source/config/declaration fingerprints, generation ordering, latest-request-wins publication and `assemblePhysicalMap(...)`.
- Flow should publish through this same snapshot/generation path. No second publication clock/index/store is warranted at current scale.
- Unchanged input reuse already advances process-local generation while preserving input identity; Flow stability tests must respect the same distinction.

### Service/backend seam

- `SoftwareMapService` currently exposes hierarchy/node/structural relationship/evidence/violation/source queries over one attached project handle.
- `SoftwareMapBackend` already validates the attached canonical root and reads one current published snapshot. P4 should extend the provider-independent Software Map service/query contract for Flow rather than create a second backend authority.
- Flow result paging/query must retain project/generation guards and explicit truncation/coverage diagnostics.

### Physical Map presentation seam

- `PhysicalMapController` reads the inspector's shared published map, fetches visible structural relationships and guards workspace/generation/request races.
- `physical-map-projection.ts` is pure disposable browser geometry and is the right precedent for a separate pure Flow projection/layout adapter.
- `PhysicalMapWidget` already hosts React Flow, shared Physical/Planning canvas state, focus/selection/source navigation and project-scoped map presentation. P6 should add `Architecture | Flow` only to the Physical Map surface, not create an independent Flow widget/state owner and not add Flow editing to Planning Maps.
- React Flow remains presentation-only. Flow facts/endpoints/query results are Dope-owned domain/application state.

### Current test/manifest shape

- Root `test:product` already composes Software Map/analyzer/UI suites; P1-P6 should add focused Phase 6 files to the real aggregate command as capabilities land.
- `test/unit/theia-baseline.test.ts` asserts all ten live root/app/internal manifests and `@dope/*` references are coherent at `0.6.0`. Every phase prompt must advance those live versions/references coherently.
- Theia remains exactly `1.75.0`, Electron `42.8.1`, TypeScript runtime `5.9.3`. Phase 6 does not upgrade them.
- `@xyflow/react` is already present from Phase 5; P5/P6 must reuse it and add no Dagre/ELK dependency.

## Domain decisions carried into prompts

### One Flow substrate

Do not create separate ControlFlow/DataFlow domains.

P1 adds one language-independent physical Flow model with:
- `PhysicalFlowFact`;
- typed derived `PhysicalFlowEndpoint`;
- Flow-specific coverage/diagnostic state separate from overall Software Map analysis completeness;
- optional data/type/schema/event enrichment;
- deterministic ID helpers and strict snapshot validation.

Initial interaction semantics are exactly:
- `receives`;
- `invokes`;
- `reads`;
- `writes`;
- `calls-external`;
- `publishes`;
- `consumes`;
- `responds`.

No base `returns` interaction.

### Callable identity

Resolved named calls use existing CodeEntity identities.

For supported anonymous function/arrow callbacks that must participate in Flow, use deterministic source-backed CodeEntity identity (for example `codeKind: other` plus an analyzer kind and stable path/span identity) rather than pretending the callback is a named symbol or treating the route-registration function as request execution.

This is required for real Adaptive SEO inline Express handlers.

### Boundary extractors

P3 supports the real Adaptive SEO slice without path/name hardcoding:
- Express 5 route registration + response boundary semantics through helper registration functions;
- PostgreSQL `Database` / `QueryExecutor` calls, including transaction executors;
- raw Node `http`/`https` external requests;
- identifiable external client calls such as the current Google GenAI boundary where the library/type evidence is deterministic;
- generic P2 invocations connecting those boundaries.

Worker/job/event Flow is secondary and not mandatory for P7 Green.

### Query truth

P4 stitches only proven Flow facts.

Default hard query bounds:
- 100 visible Flow nodes/endpoints;
- 200 Flow edges/facts;
- 32 hops per path.

Exceeding a bound yields explicit truncation/continue-deeper state.

Architectural aggregation requires a continuous evidenced origin path and retains origin Flow IDs. Missing hops remain gaps.

### UX

P6 opens Flow as a quiet System-level overview. Known Inputs are behavioral entry points. Selection highlights relevant Static Flow while unrelated Flow is subdued. Explicit `Trace downstream`, `Trace upstream` and `Clear trace` controls deepen exploration. Code-level detail is progressively disclosed by focus.

## Applicable risks

- **False execution truth:** imports/references/dependencies emitted as invocation.
- **Wrong caller identity:** inline route callback behavior attributed to registration/startup code.
- **Endpoint over-merge:** unrelated DB/external calls collapsed into one generic endpoint without identity evidence.
- **Snapshot split brain:** Flow publication diverging from Physical Map generation/input identity.
- **Framework hardcoding:** extractors memorizing Adaptive SEO paths/names instead of semantics.
- **Wrapper blindness:** app helpers hiding the real PostgreSQL/external boundary.
- **Path explosion:** call traversal producing unreadable/unbounded graphs.
- **Invented aggregation:** System/Subsystem edges bridging unsupported lower-level gaps.
- **Static/observed confusion:** reachable branches presented as a concrete runtime trace.
- **Payload overclaim:** broad/inferred types presented as proven data lineage.
- **Async falsification:** ordinary Promise continuation confused with queue/event handoff.
- **UI hairball:** every CodeEntity/call rendered in the default System view.
- **Async UI races:** late Flow query results from another generation/project rendering current.
- **Planning leakage:** Flow mode/edit semantics leaking into Planning Map truth.
- **Provider leakage:** Phase 7 AI/runtime concepts pulled into provider-free Phase 6.
- **Qualification optimism:** a polished partial graph shown without unsupported/truncated diagnostics.

## Stability answers

1. Behavior at risk: existing Physical/Planning Map canvas, sMap inspector/query backend, TypeScript analysis, Project Mind, package/restart behavior and exact Phase 5 retained implementation.
2. Invariants: Flow is derived Physical Map truth; canonical architecture/planning stay distinct; one shared snapshot generation; no provider requirement; no separate durable Flow state.
3. Integrated-only evidence: real Adaptive SEO HTTP/internal/persistence-or-external/output path, branch/join, GUI tracing/edge evidence/source navigation, restart reconstruction, package/native candidate.
4. Baseline: reachable Phase 5 owner-close transition `710edb362f9881ab41215705db4f08d8daca6293`, coherent `0.6.0`, current Flow authority on top.
5. Durable knowledge: Phase 6 prompt assessment/plan, P7 direct evidence and P8 closeout.
6. UI-state risk: Flow mode, tracing selection, viewport and layout are disposable presentation state; deleting them cannot change Physical Map facts.
7. Provider coupling: none. Inherited sMap synthesis providers remain unrelated to Flow and must not become required.

## Deferred

Whole-program CFG/basic blocks, field-level/taint lineage, arbitrary cross-language execution lineage, exhaustive SQL/schema lineage, required runtime tracing, Observed Flow runtime capture, Planning Map Flow editing, AI explanations, Agent Mind, tool authority/delegation, new layout engine, worker/job qualification as a mandatory P7 path, and framework-general coverage beyond the bounded initial slice.
